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
import { RoleService } from './services/role.service';

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
    private readonly roleService: RoleService,
  ) {}

  async create(createUserDto: CreateUserRequest): Promise<UserResponse> {
    this.assertCanManageUsers();
    const tenantId = this.tenantContext.requireTenantId();
    const role = createUserDto.roleId
      ? await this.roleService.getRoleById(tenantId, createUserDto.roleId)
      : await this.roleService.getRoleByName(tenantId, RoleName.MEMBER);
    const passwordHash = await this.passwordService.hash(
      createUserDto.password,
    );

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const createdUser = await transaction.user.create({
          data: {
            name: createUserDto.name,
            email: createUserDto.email,
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
        orderBy: { name: 'asc' },
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
    this.assertCanManageUsers();
    const tenantId = this.tenantContext.requireTenantId();
    const existing = await this.findUserInTenant(id, tenantId);
    const passwordHash = updateUserDto.password
      ? await this.passwordService.hash(updateUserDto.password)
      : undefined;

    if (updateUserDto.roleId) {
      await this.roleService.getRoleById(tenantId, updateUserDto.roleId);
    }

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        await transaction.user.update({
          where: { id: existing.id },
          data: {
            name: updateUserDto.name,
            email: updateUserDto.email,
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
    if (this.tenantContext.getPlatformRole() !== 'ADMIN') {
      throw new ForbiddenException('Only ADMIN can deactivate users');
    }
    const tenantId = this.tenantContext.requireTenantId();
    await this.findUserInTenant(id, tenantId);
    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVO },
    });
  }

  private async findUserInTenant(
    id: string,
    tenantId: string,
  ): Promise<UserWithTenants> {
    const user = await this.prisma.user.findFirst({
      where: { id, userTenants: { some: { tenantId } } },
      include: userInclude,
    });
    if (!user) {
      throw new NotFoundException('User not found in the current tenant');
    }

    return user;
  }

  private assertCanManageUsers(): void {
    const context = this.tenantContext.getRequiredContext();
    if (context.platformRole !== 'ADMIN' && context.tenantRole !== 'OWNER') {
      throw new ForbiddenException('Only OWNER or ADMIN can manage users');
    }
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
      tenants: user.userTenants.map(({ tenant, role }) => ({
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
