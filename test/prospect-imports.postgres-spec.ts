import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContextService } from '../src/common/context/tenant-context.service';
import { ProspectCsvParser } from '../src/prospects/imports/prospect-csv.parser';
import { ProspectImportsService } from '../src/prospects/imports/prospect-imports.service';

describe('CSV atomicity with disposable PostgreSQL', () => {
  let prisma: PrismaService;
  let tenantId: string;
  let campaignId: string;
  let userId: string;
  let service: ProspectImportsService;
  const context = new TenantContextService();
  const file = Buffer.from('name\nAlice\nBob');
  const decisions =
    '[{"record":1,"action":"CREATE"},{"record":2,"action":"CREATE"}]';
  const run = <T>(fn: () => T) =>
    context.run(
      { userId, tenantId, tenantRole: 'OWNER', platformRole: null },
      fn,
    );
  beforeAll(async () => {
    if (!process.env.INTEGRATION_TEST_DATABASE_URL)
      throw new Error(
        'A migrated disposable INTEGRATION_TEST_DATABASE_URL is required',
      );
    prisma = new PrismaService();
    await prisma.$connect();
    tenantId = (
      await prisma.tenant.create({
        data: { name: 'CSV test', slug: `csv-${randomUUID()}` },
      })
    ).id;
    userId = (
      await prisma.user.create({
        data: {
          name: 'CSV owner',
          email: `${randomUUID()}@test.example`,
          passwordHash: 'not-used',
        },
      })
    ).id;
    campaignId = (
      await prisma.campaign.create({
        data: { name: 'CSV', tenantId, createdBy: userId },
      })
    ).id;
    service = new ProspectImportsService(
      prisma,
      context,
      new ProspectCsvParser(),
      new ConfigService({ JWT_SECRET: 'test-preview-secret' }),
    );
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.campaignProspect.deleteMany({ where: { campaignId } });
    await prisma.prospect.deleteMany({ where: { tenantId } });
  });
  afterAll(async () => {
    if (!prisma) return;
    if (campaignId) await prisma.campaign.delete({ where: { id: campaignId } });
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });
  it('persists the complete batch and rejects a repeated stale confirmation', async () => {
    await run(async () => {
      const preview = await service.preview(campaignId, file);
      await service.confirm(
        campaignId,
        file,
        preview.previewReference,
        decisions,
      );
      expect(await prisma.prospect.count({ where: { tenantId } })).toBe(2);
      expect(
        await prisma.campaignProspect.count({ where: { campaignId } }),
      ).toBe(2);
      await expect(
        service.confirm(campaignId, file, preview.previewReference, decisions),
      ).rejects.toThrow('new preview');
    });
  });
  it('serializes simultaneous confirmations without duplicating the batch', async () => {
    const preview = await run(() => service.preview(campaignId, file));
    const results = await Promise.allSettled([
      run(() =>
        service.confirm(campaignId, file, preview.previewReference, decisions),
      ),
      run(() =>
        service.confirm(campaignId, file, preview.previewReference, decisions),
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await prisma.prospect.count({ where: { tenantId } })).toBe(2);
    expect(await prisma.campaignProspect.count({ where: { campaignId } })).toBe(
      2,
    );
  });
  it('rolls back earlier real writes when a later infrastructure error occurs', async () => {
    await run(async () => {
      const preview = await service.preview(campaignId, file);
      let writes = 0;
      // Test-only query extension: first INSERT is real, second fails inside
      // the same real transaction. No production Prisma extension is added.
      const failingClient = prisma.$extends({
        query: {
          prospect: {
            create({ args, query }) {
              if (++writes === 2)
                throw new Error('Injected infrastructure failure');
              return query(args);
            },
          },
        },
      });
      const failing = new ProspectImportsService(
        failingClient as unknown as PrismaService,
        context,
        new ProspectCsvParser(),
        new ConfigService({ JWT_SECRET: 'test-preview-secret' }),
      );
      await expect(
        failing.confirm(campaignId, file, preview.previewReference, decisions),
      ).rejects.toThrow('Injected infrastructure failure');
      expect(writes).toBe(2);
      expect(await prisma.prospect.count({ where: { tenantId } })).toBe(0);
      expect(
        await prisma.campaignProspect.count({ where: { campaignId } }),
      ).toBe(0);
    });
  });
});
