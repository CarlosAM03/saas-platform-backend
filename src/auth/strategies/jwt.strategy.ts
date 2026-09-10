import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
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
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtClaims) {
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.email !== 'string' ||
      ![null, 'ADMIN'].includes(payload.platformRole) ||
      !(
        payload.tenantId === null ||
        (typeof payload.tenantId === 'string' && payload.tenantId.length > 0)
      ) ||
      ![null, 'OWNER', 'MEMBER'].includes(payload.tenantRole) ||
      (payload.tenantId === null && payload.tenantRole !== null) ||
      (payload.platformRole === 'ADMIN' && payload.tenantRole !== null) ||
      (payload.platformRole === null &&
        payload.tenantId !== null &&
        payload.tenantRole === null)
    ) {
      throw new UnauthorizedException('Invalid authorization context');
    }
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
    return authenticatedUser;
  }
}
