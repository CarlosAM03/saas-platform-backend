import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  TenantContext,
  TenantContextService,
} from '../context/tenant-context.service';

interface AuthenticatedUser {
  id?: string;
  userId?: string;
  sub?: string;
  email?: string;
  tenantId?: string | null;
  tenantRole?: 'OWNER' | 'MEMBER' | null;
  platformRole?: 'ADMIN' | null;
  status?: string;
  isActive?: boolean;
}

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const authenticated = await super.canActivate(context);
    if (!authenticated) {
      return false;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    const userId = user?.id ?? user?.userId ?? user?.sub;

    if (
      !user ||
      !userId ||
      user.status === 'INACTIVO' ||
      user.isActive === false
    ) {
      throw new UnauthorizedException(
        'Authenticated user is inactive or invalid',
      );
    }

    const tenantContext: TenantContext = {
      userId,
      tenantId: user.tenantId ?? null,
      tenantRole: user.tenantRole ?? null,
      platformRole: user.platformRole ?? null,
      email: user.email,
    };
    this.tenantContext.setContext(tenantContext);

    return true;
  }
}
