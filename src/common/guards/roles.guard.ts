import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTHORIZED_ROLES_KEY,
  AuthorizedRole,
} from '../decorators/roles.decorator';
import { TenantContextService } from '../context/tenant-context.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AuthorizedRole[]>(
      AUTHORIZED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const authenticatedContext = this.tenantContext.getRequiredContext();
    const hasRole = requiredRoles.some((role) => {
      if (role === 'ADMIN') {
        return authenticatedContext.platformRole === 'ADMIN';
      }

      return authenticatedContext.tenantRole === role;
    });

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
