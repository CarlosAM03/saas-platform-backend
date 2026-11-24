import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleName, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/context/tenant-context.service';
import { PasswordService } from '../auth/password.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateUserRequest } from './dto/create-user.request';
import { UpdateUserRequest } from './dto/update-user.request';
import { UserResponse } from './dto/user.response';
import { normalizeEmail } from '../common/validation/normalize-email';

const userInclude = {
  userTenants: {
    include: {
      tenant: true,
      role: true,
    },
    orderBy: { joinedAt: 'asc' as const },
  },
} satisfies Prisma.UserInclude;

type UserWithTenants = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly passwordService: PasswordService,
  ) {}

  async create(createUserDto: CreateUserRequest): Promise<UserResponse> {
    const tenantId = this.tenantContext.requireTenantId();
    const passwordHash = await this.passwordService.hash(
      createUserDto.password,
    );

    try {
      const user = await this.write(async (transaction) => {
        const actor = await this.requireAdministrator(transaction, tenantId);
        const role = await this.resolveRole(
          transaction,
          tenantId,
          createUserDto.roleId,
        );
        await this.authorizeRole(
          transaction,
          tenantId,
          role,
          actor.platformRole === 'ADMIN',
        );
        const createdUser = await transaction.user.create({
          data: {
            name: createUserDto.name,
            email: normalizeEmail(createUserDto.email),
            passwordHash,
          },
        });
        await transaction.userTenant.create({
          data: { userId: createdUser.id, tenantId, roleId: role.id },
        });
        return transaction.user.findUniqueOrThrow({
          where: { id: createdUser.id },
          include: userInclude,
        });
      });

      return this.toResponse(user, tenantId);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async findByIdForAuthentication(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        mustChangePassword: true,
      },
    });
  }

  async findAll(
    filters: { search?: string },
    pagination: PaginationDto,
  ): Promise<{
    data: UserResponse[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const tenantId = this.tenantContext.requireTenantId();
    const search = filters.search?.trim();
    const where: Prisma.UserWhereInput = {
      userTenants: { some: { tenantId } },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => this.toResponse(user, tenantId)),
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async findOne(id: string): Promise<UserResponse> {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id, userTenants: { some: { tenantId } } },
      include: userInclude,
    });
    if (!user) {
      throw new NotFoundException('User not found in the current tenant');
    }

    return this.toResponse(user, tenantId);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserRequest,
  ): Promise<UserResponse> {
    const tenantId = this.tenantContext.requireTenantId();
    const passwordHash = updateUserDto.password
      ? await this.passwordService.hash(updateUserDto.password)
      : undefined;

    try {
      const user = await this.write(async (transaction) => {
        const actor = await this.requireAdministrator(transaction, tenantId);
        const existing = await this.findUserInTenant(id, tenantId, transaction);
        if (
          existing.mustChangePassword &&
          (updateUserDto.password !== undefined ||
            updateUserDto.email !== undefined)
        ) {
          throw new ForbiddenException(
            'Pending accounts must complete activation; credentials cannot be edited',
          );
        }
        const membership = existing.userTenants.find(
          (m) => m.tenantId === tenantId,
        )!;
        // D3: shared identities (including self) and privileged targets are protected.
        if (
          actor.platformRole !== 'ADMIN' &&
          (existing.platformRole === 'ADMIN' ||
            existing.userTenants.some(
              (m) =>
                m.tenantId !== tenantId ||
                (m.role.name === RoleName.OWNER && existing.id !== actor.id),
            ))
        ) {
          throw new ForbiddenException({
            message: 'Global identity changes require platform administration',
            details: { reason: 'GLOBAL_IDENTITY_PROTECTED' },
          });
        }
        if (updateUserDto.roleId) {
          const role = await this.resolveRole(
            transaction,
            tenantId,
            updateUserDto.roleId,
          );
          await this.authorizeRole(
            transaction,
            tenantId,
            role,
            actor.platformRole === 'ADMIN',
            existing.id,
          );
          if (
            membership.role.name === RoleName.OWNER &&
            role.name !== RoleName.OWNER
          ) {
            await this.protectOperationalOwner(transaction, existing, tenantId);
          }
        }
        if (updateUserDto.status === UserStatus.INACTIVO) {
          await this.protectOperationalOwner(transaction, existing);
        }
        await transaction.user.update({
          where: { id: existing.id },
          data: {
            name: updateUserDto.name,
            email:
              updateUserDto.email === undefined
                ? undefined
                : normalizeEmail(updateUserDto.email),
            passwordHash,
            status: updateUserDto.status,
          },
        });
        if (updateUserDto.roleId) {
          await transaction.userTenant.update({
            where: { userId_tenantId: { userId: id, tenantId } },
            data: { roleId: updateUserDto.roleId },
          });
        }
        return transaction.user.findUniqueOrThrow({
          where: { id },
          include: userInclude,
        });
      });

      return this.toResponse(user, tenantId);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    await this.write(async (transaction) => {
      const actor = await this.requireAdministrator(transaction, tenantId);
      if (actor.platformRole !== 'ADMIN')
        throw new ForbiddenException('Platform administration required');
      const existing = await this.findUserInTenant(id, tenantId, transaction);
      await this.protectOperationalOwner(transaction, existing);
      await transaction.user.update({
        where: { id },
        data: { status: UserStatus.INACTIVO },
      });
    });
  }

  private async requireAdministrator(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ) {
    const context = this.tenantContext.getRequiredContext();
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${context.userId} FOR SHARE`;
    await tx.$queryRaw`SELECT user_id FROM user_tenants WHERE user_id = ${context.userId} AND tenant_id = ${tenantId} FOR SHARE`;
    const actor = await tx.user.findUnique({
      where: { id: context.userId },
      include: userInclude,
    });
    if (
      !actor ||
      actor.status !== UserStatus.ACTIVO ||
      actor.mustChangePassword
    )
      throw new ForbiddenException('Current administration authority required');
    if (actor.platformRole === 'ADMIN') return actor;
    const membership = actor.userTenants.find((m) => m.tenantId === tenantId);
    if (
      !membership ||
      membership.tenant.status !== 'ACTIVO' ||
      membership.role.tenantId !== tenantId ||
      membership.role.name !== RoleName.OWNER
    )
      throw new ForbiddenException('Current administration authority required');
    return actor;
  }

  private async resolveRole(
    tx: Prisma.TransactionClient,
    tenantId: string,
    roleId?: string,
  ) {
    const role = await tx.role.findFirst({
      where: {
        tenantId,
        ...(roleId ? { id: roleId } : { name: RoleName.MEMBER }),
      },
    });
    if (!role) throw new NotFoundException('Role not found in this tenant');
    return role;
  }

  private async authorizeRole(
    tx: Prisma.TransactionClient,
    tenantId: string,
    role: { id: string; name: RoleName },
    admin: boolean,
    userId?: string,
  ) {
    if (role.name !== RoleName.OWNER) return;
    if (!admin)
      throw new ForbiddenException(
        'Only platform administration can assign OWNER',
      );
    const owners = await tx.userTenant.findMany({
      where: { tenantId, roleId: role.id },
    });
    if (owners.some((m) => m.userId !== userId))
      throw new ConflictException('Tenant already has an OWNER');
  }

  private async protectOperationalOwner(
    tx: Prisma.TransactionClient,
    user: UserWithTenants,
    onlyTenantId?: string,
  ) {
    for (const m of user.userTenants) {
      if (
        m.role.name !== RoleName.OWNER ||
        m.tenant.status !== 'ACTIVO' ||
        (onlyTenantId && m.tenantId !== onlyTenantId)
      )
        continue;
      const activeOwners = await tx.userTenant.findMany({
        where: {
          tenantId: m.tenantId,
          roleId: m.roleId,
          user: { status: UserStatus.ACTIVO },
        },
      });
      if (!activeOwners.some((owner) => owner.userId !== user.id))
        throw new ConflictException('Cannot remove the last operational OWNER');
    }
  }

  // PostgreSQL SSI protects the owner predicate and authority reads together with
  // all identity/membership writes. A concurrent role change retries from fresh DB state.
  private async write<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' ||
            (error.code === 'P2010' &&
              ['40001', '40P01'].includes(String(error.meta?.code))))
        ) {
          if (attempt < 2) continue;
          throw new ConflictException('Concurrent user administration; retry');
        }
        throw error;
      }
    }
    throw new ConflictException('Concurrent user administration; retry');
  }

  private async findUserInTenant(
    id: string,
    tenantId: string,
    transaction: Prisma.TransactionClient = this.prisma,
  ): Promise<UserWithTenants> {
    const user = await transaction.user.findFirst({
      where: { id, userTenants: { some: { tenantId } } },
      include: userInclude,
    });
    if (!user) {
      throw new NotFoundException('User not found in the current tenant');
    }

    return user;
  }

  private toResponse(
    user: UserWithTenants,
    currentTenantId: string,
  ): UserResponse {
    const currentMembership = user.userTenants.find(
      ({ tenantId }) => tenantId === currentTenantId,
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      platformRole: user.platformRole,
      role: currentMembership
        ? {
            id: currentMembership.role.id,
            name: currentMembership.role.name,
            tenantId: currentMembership.role.tenantId,
          }
        : null,
      tenants: user.userTenants
        .filter(({ tenantId }) => tenantId === currentTenantId)
        .map(({ tenant, role }) => ({
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          role: {
            id: role.id,
            name: role.name,
            tenantId: role.tenantId,
          },
        })),
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private handlePersistenceError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A user with that email already exists');
    }

    throw error;
  }
}
