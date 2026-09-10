import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/context/tenant-context.service';
import { UserTenantService } from '../users/services/user-tenant.service';
import { PasswordService } from './password.service';
import {
  AuthContextResponse,
  AuthTenantResponse,
  AuthUserResponse,
} from './dto/auth.response';

type UserWithTenants = Prisma.UserGetPayload<{
  include: {
    userTenants: { include: { tenant: true; role: true } };
  };
}>;

type AuthenticatedUser = Pick<
  UserWithTenants,
  | 'id'
  | 'name'
  | 'email'
  | 'passwordHash'
  | 'platformRole'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
> & {
  userTenants: UserWithTenants['userTenants'];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userTenantService: UserTenantService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly tenantContext: TenantContextService,
    private readonly logger: PinoLogger,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.userTenantService.findUserByEmail(email);

    if (!user || user.status !== 'ACTIVO') {
      this.logger.warn({ email, outcome: 'failure' }, 'login failed');
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await this.passwordService.compare(
      password,
      user.passwordHash,
    );
    if (!validPassword) {
      this.logger.warn({ email, outcome: 'failure' }, 'login failed');
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(user: AuthenticatedUser): Promise<AuthContextResponse> {
    const activeTenants = user.userTenants.filter(
      ({ tenant }) => tenant.status === 'ACTIVO',
    );
    if (user.platformRole !== 'ADMIN' && activeTenants.length === 0) {
      this.logger.warn({ userId: user.id, outcome: 'failure' }, 'login failed');
      throw new UnauthorizedException('User has no active tenant membership');
    }
    const selectedTenant =
      user.platformRole === 'ADMIN'
        ? null
        : activeTenants.length === 1
          ? activeTenants[0]
          : null;
    const accessToken = await this.createToken(
      user,
      selectedTenant?.tenantId ?? null,
      selectedTenant?.role.name ?? null,
    );

    this.logger.info(
      { userId: user.id, outcome: 'success' },
      'login succeeded',
    );
    return {
      accessToken,
      user: this.toUserResponse(user),
      tenants: activeTenants.map(({ tenant }) => this.toTenantResponse(tenant)),
      currentTenantId: selectedTenant?.tenantId ?? null,
    };
  }

  async selectTenant(
    userId: string,
    tenantId: string,
  ): Promise<AuthContextResponse> {
    const user = await this.findUser(userId);
    const membership = await this.userTenantService.findActiveMembership(
      userId,
      tenantId,
    );

    if (!membership && user.platformRole !== 'ADMIN') {
      throw new ForbiddenException('User does not belong to this tenant');
    }

    const tenant =
      membership?.tenant ??
      (await this.prisma.tenant.findFirst({
        where: { id: tenantId, status: 'ACTIVO' },
      }));
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const accessToken = await this.createToken(
      user,
      tenant.id,
      membership?.role.name ?? null,
    );

    return {
      accessToken,
      user: this.toUserResponse(user),
      tenants: user.userTenants
        .filter(
          ({ tenant: currentTenant }) => currentTenant.status === 'ACTIVO',
        )
        .map(({ tenant: currentTenant }) =>
          this.toTenantResponse(currentTenant),
        ),
      currentTenantId: tenant.id,
    };
  }

  async getMe(
    userId: string,
    accessToken: string,
  ): Promise<AuthContextResponse> {
    const user = await this.findUser(userId);
    const context = this.tenantContext.getContext();

    return {
      accessToken,
      user: this.toUserResponse(user),
      tenants: user.userTenants
        .filter(({ tenant }) => tenant.status === 'ACTIVO')
        .map(({ tenant }) => this.toTenantResponse(tenant)),
      currentTenantId: context?.tenantId ?? null,
    };
  }

  logout(userId: string): void {
    this.logger.info({ userId }, 'logout requested');
  }

  private async findUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.userTenantService.findUserById(userId);
    if (!user || user.status !== 'ACTIVO') {
      throw new UnauthorizedException('User is inactive or does not exist');
    }

    return user;
  }

  private async createToken(
    user: AuthenticatedUser,
    tenantId: string | null,
    tenantRole: 'OWNER' | 'MEMBER' | null,
  ): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole === 'ADMIN' ? 'ADMIN' : null,
      tenantId,
      tenantRole: user.platformRole === 'ADMIN' ? null : tenantRole,
    });
  }

  private toUserResponse(user: AuthenticatedUser): AuthUserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      platformRole: user.platformRole,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toTenantResponse(
    tenant: AuthenticatedUser['userTenants'][number]['tenant'],
  ): AuthTenantResponse {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
    };
  }
}
