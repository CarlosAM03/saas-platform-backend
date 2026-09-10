import { ForbiddenException, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantRole = 'OWNER' | 'MEMBER' | null;
export type PlatformRole = 'ADMIN' | null;

export interface TenantContext {
  userId: string;
  tenantId: string | null;
  tenantRole: TenantRole;
  platformRole: PlatformRole;
  email?: string;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<{
    context?: TenantContext;
  }>();

  runRequest<T>(callback: () => T): T {
    return this.storage.run({}, callback);
  }

  setContext(context: TenantContext): void {
    const scope = this.storage.getStore();
    if (!scope || scope.context) {
      throw new Error('Authentication context requires a fresh request scope');
    }
    scope.context = { ...context };
  }

  run<T>(context: TenantContext, callback: () => T): T {
    return this.storage.run({ context: { ...context } }, callback);
  }

  getContext(): TenantContext | undefined {
    const context = this.storage.getStore()?.context;
    return context ? { ...context } : undefined;
  }

  getRequiredContext(): TenantContext {
    const context = this.getContext();
    if (!context) {
      throw new Error(
        'Tenant context is not available outside an authenticated request',
      );
    }

    return context;
  }

  getUserId(): string | undefined {
    return this.getContext()?.userId;
  }

  getTenantId(): string | null {
    return this.getRequiredContext().tenantId;
  }

  requireTenantId(): string {
    const tenantId = this.getRequiredContext().tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Select a tenant before this operation');
    }

    return tenantId;
  }

  getTenantRole(): TenantRole {
    return this.getRequiredContext().tenantRole;
  }

  getPlatformRole(): PlatformRole {
    return this.getRequiredContext().platformRole;
  }
}
