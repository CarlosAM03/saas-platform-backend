export class TestTenantContextService {
  private context:
    | {
        userId: string;
        tenantId: string | null;
        tenantRole: 'OWNER' | 'MEMBER' | null;
        platformRole: 'ADMIN' | null;
        email?: string;
      }
    | undefined;

  setContext(context: typeof this.context): void {
    this.context = context ? { ...context } : undefined;
  }

  getContext(): typeof this.context {
    return this.context ? { ...this.context } : undefined;
  }

  getRequiredContext() {
    if (!this.context) {
      throw new Error('Tenant context is unavailable');
    }
    return this.context;
  }

  requireTenantId(): string {
    const tenantId = this.getRequiredContext().tenantId;
    if (!tenantId) {
      throw new Error('Tenant context is unavailable');
    }
    return tenantId;
  }

  getUserId(): string | undefined {
    return this.context?.userId;
  }

  getTenantId(): string | null {
    return this.getRequiredContext().tenantId;
  }

  getTenantRole(): 'OWNER' | 'MEMBER' | null {
    return this.getRequiredContext().tenantRole;
  }

  getPlatformRole(): 'ADMIN' | null {
    return this.getRequiredContext().platformRole;
  }
}
