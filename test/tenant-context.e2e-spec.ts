import { TenantContextService } from '../src/common/context/tenant-context.service';

describe('TenantContextService', () => {
  it('establece el contexto dentro de la request y lo aísla fuera de ella', async () => {
    const service = new TenantContextService();
    const context = {
      userId: 'user-a',
      tenantId: 'tenant-a',
      tenantRole: 'OWNER' as const,
      platformRole: null,
    };

    expect(service.getContext()).toBeUndefined();

    await service.run(context, async () => {
      expect(service.getRequiredContext()).toEqual(context);
      expect(service.requireTenantId()).toBe('tenant-a');
      await Promise.resolve();
      expect(service.getUserId()).toBe('user-a');
    });

    expect(service.getContext()).toBeUndefined();
  });

  it('rechaza operaciones tenant-scoped sin contexto', () => {
    const service = new TenantContextService();

    expect(() => service.getRequiredContext()).toThrow();
    expect(() => service.requireTenantId()).toThrow();
  });
});
