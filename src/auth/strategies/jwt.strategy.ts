import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { UsersService } from '../../users/users.service';

export interface JwtClaims {
  sub: string;
  email: string;
  platformRole: 'ADMIN' | null;
  tenantId: string | null;
  tenantRole: 'OWNER' | 'MEMBER' | null;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly tenantContext: TenantContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtClaims) {
    const user = await this.usersService.findByIdForAuthentication(payload.sub);

    if (!user || user.status !== 'ACTIVO') {
      throw new UnauthorizedException('User is inactive or does not exist');
    }

    const authenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      platformRole: payload.platformRole,
      tenantId: payload.tenantId,
      tenantRole: payload.tenantRole,
    };
    this.tenantContext.setContext({
      userId: authenticatedUser.id,
      email: authenticatedUser.email,
      platformRole: authenticatedUser.platformRole,
      tenantId: authenticatedUser.tenantId,
      tenantRole: authenticatedUser.tenantRole,
    });

    return authenticatedUser;
  }
}
