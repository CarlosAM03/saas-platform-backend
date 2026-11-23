import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContextService } from '../src/common/context/tenant-context.service';
import { ProspectCsvParser } from '../src/prospects/imports/prospect-csv.parser';
import { ProspectImportsService } from '../src/prospects/imports/prospect-imports.service';
import { CampaignsService } from '../src/campaigns/campaigns.service';
import { CampaignProspectsQuery } from '../src/campaigns/dto/campaign-prospects.query';

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
    await prisma.campaignActivity.deleteMany({ where: { tenantId } });
    await prisma.campaignProspect.deleteMany({ where: { campaignId } });
    await prisma.prospectProvenance.deleteMany({ where: { tenantId } });
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
  it('RI06 CSV creates a distinct master consciously and preserves the weak candidate', async () => {
    const original = await prisma.prospect.create({
      data: { tenantId, campaignId, name: 'Empresa Demo', source: 'manual' },
    });
    await prisma.campaignProspect.create({
      data: { campaignId, prospectId: original.id, commercialStage: 'CERRADO' },
    });
    const participation = await prisma.campaignProspect.findUniqueOrThrow({
      where: { campaignId_prospectId: { campaignId, prospectId: original.id } },
    });
    const csv = Buffer.from('name\nEmpresa Demo');
    await run(async () => {
      const preview = await service.preview(campaignId, csv);
      expect(preview.rows[0].classification).toBe('MATCH');
      expect(
        await prisma.prospectProvenance.count({ where: { tenantId } }),
      ).toBe(0);
      const result = await service.confirm(
        campaignId,
        csv,
        preview.previewReference,
        '[{"record":1,"action":"CREATE"}]',
      );
      const createdId = result.rows[0].prospectId;
      expect(result.summary.created).toBe(1);
      expect(createdId).toBeDefined();
      expect(createdId).not.toBe(original.id);
      expect(
        await prisma.prospect.findUniqueOrThrow({ where: { id: original.id } }),
      ).toEqual(original);
      expect(
        await prisma.campaignProspect.findUniqueOrThrow({
          where: {
            campaignId_prospectId: { campaignId, prospectId: original.id },
          },
        }),
      ).toEqual(participation);
      expect(
        await prisma.campaignProspect.findUniqueOrThrow({
          where: {
            campaignId_prospectId: { campaignId, prospectId: createdId! },
          },
        }),
      ).toMatchObject({
        commercialStage: 'SIN_GESTIONAR',
        evaluation: 'SIN_EVALUAR',
        responsibleId: null,
      });
      const provenance = await prisma.prospectProvenance.findMany({
        where: { tenantId },
      });
      expect(provenance).toHaveLength(1);
      expect(provenance[0]).toMatchObject({
        prospectId: createdId,
        type: 'CREATED',
        source: 'csv',
        actorUserId: userId,
        details: { resolution: 'CREATE', candidateIds: [original.id] },
      });
      expect(await prisma.campaignActivity.count({ where: { tenantId } })).toBe(
        1,
      );
      await expect(
        service.confirm(
          campaignId,
          csv,
          preview.previewReference,
          '[{"record":1,"action":"CREATE"}]',
        ),
      ).rejects.toThrow('new preview');
      expect(await prisma.prospect.count({ where: { tenantId } })).toBe(2);
    });
  });

  it('RI08 UPDATE in a new campaign proves reuse there without rewriting legacy incorporation', async () => {
    const original = await prisma.prospect.create({
      data: { tenantId, campaignId, name: 'Empresa Demo', source: 'manual' },
    });
    await prisma.campaignProspect.create({
      data: { campaignId, prospectId: original.id },
    });
    const destination = await prisma.campaign.create({
      data: { tenantId, name: 'Synthetic destination', createdBy: userId },
    });
    const dashboards = new CampaignsService(prisma, context);
    const csv = Buffer.from('name\nEmpresa Demo');
    try {
      await run(async () => {
        const preview = await service.preview(destination.id, csv);
        expect(preview.rows[0].classification).toBe('MATCH');
        const result = await service.confirm(
          destination.id,
          csv,
          preview.previewReference,
          '[{"record":1,"action":"UPDATE_EXISTING"}]',
        );
        expect(result.summary.updated).toBe(1);
        expect(
          (await dashboards.dashboard(destination.id)).incorporation,
        ).toEqual({
          new: 0,
          reused: 1,
          unknownLegacy: 0,
        });
        expect((await dashboards.dashboard(campaignId)).incorporation).toEqual({
          new: 0,
          reused: 0,
          unknownLegacy: 1,
        });
        expect(
          await prisma.prospectProvenance.count({
            where: {
              tenantId,
              campaignId: destination.id,
              prospectId: original.id,
              type: 'LINKED',
            },
          }),
        ).toBe(1);
        // Updating an already existing legacy association must not manufacture incorporation evidence.
        const existingPreview = await service.preview(campaignId, csv);
        await service.confirm(
          campaignId,
          csv,
          existingPreview.previewReference,
          '[{"record":1,"action":"UPDATE_EXISTING"}]',
        );
        expect((await dashboards.dashboard(campaignId)).incorporation).toEqual({
          new: 0,
          reused: 0,
          unknownLegacy: 1,
        });
        expect(
          await prisma.prospectProvenance.count({
            where: {
              tenantId,
              campaignId,
              prospectId: original.id,
              type: 'LINKED',
            },
          }),
        ).toBe(0);
        const repeat = await service.preview(destination.id, csv);
        await service.confirm(
          destination.id,
          csv,
          repeat.previewReference,
          '[{"record":1,"action":"UPDATE_EXISTING"}]',
        );
        expect(
          await prisma.prospectProvenance.count({
            where: { tenantId, campaignId: destination.id, type: 'LINKED' },
          }),
        ).toBe(1);
        expect(
          await prisma.campaignActivity.count({
            where: {
              tenantId,
              campaignId: destination.id,
              type: 'ASSOCIATION',
            },
          }),
        ).toBe(1);
        expect(await prisma.prospect.count({ where: { tenantId } })).toBe(1);
        expect(
          (
            await prisma.prospect.findUniqueOrThrow({
              where: { id: original.id },
            })
          ).campaignId,
        ).toBe(campaignId);
      });
    } finally {
      await prisma.campaignActivity.deleteMany({
        where: { tenantId, campaignId: destination.id },
      });
      await prisma.prospectProvenance.deleteMany({
        where: { tenantId, campaignId: destination.id },
      });
      await prisma.campaignProspect.deleteMany({
        where: { campaignId: destination.id },
      });
      await prisma.campaign.delete({ where: { id: destination.id } });
    }
  });

  it('AC-P4-03 UPDATE_EXISTING from B changes the shared master seen from A and records the change', async () => {
    const master = await prisma.prospect.create({
      data: {
        tenantId,
        campaignId,
        name: 'Shared Master',
        address: 'Old address',
        source: 'manual',
      },
    });
    await prisma.campaignProspect.create({
      data: { campaignId, prospectId: master.id },
    });
    const second = await prisma.campaign.create({
      data: { tenantId, name: 'Second campaign', createdBy: userId },
    });
    await prisma.campaignProspect.create({
      data: { campaignId: second.id, prospectId: master.id },
    });
    const csv = Buffer.from('name,address\nShared Master,New address');
    try {
      await run(async () => {
        const preview = await service.preview(second.id, csv);
        expect(preview.rows[0].classification).toBe('MATCH');
        const result = await service.confirm(
          second.id,
          csv,
          preview.previewReference,
          '[{"record":1,"action":"UPDATE_EXISTING"}]',
        );
        // The row carries the explicit action André must surface as a warning.
        expect(result.rows).toEqual([
          { record: 1, action: 'UPDATE_EXISTING', prospectId: master.id },
        ]);
        expect(result.summary.updated).toBe(1);
        // Global effect: campaign A reads the updated shared master.
        const fromA = await new CampaignsService(prisma, context).findProspects(
          campaignId,
          Object.assign(new CampaignProspectsQuery(), {}),
        );
        const row = fromA.data.find((item) => item.id === master.id)!;
        expect(row.address).toBe('New address');
        // Origin and protected fields stay untouched.
        expect(row.campaignId).toBe(campaignId);
        expect(row.source).toBe('manual');
        expect(
          await prisma.prospectProvenance.count({
            where: {
              tenantId,
              campaignId: second.id,
              prospectId: master.id,
              type: 'MASTER_UPDATED',
            },
          }),
        ).toBe(1);
      });
    } finally {
      await prisma.campaignActivity.deleteMany({
        where: { tenantId, campaignId: second.id },
      });
      await prisma.prospectProvenance.deleteMany({
        where: { tenantId, campaignId: second.id },
      });
      await prisma.campaignProspect.deleteMany({
        where: { campaignId: second.id },
      });
      await prisma.campaign.delete({ where: { id: second.id } });
    }
  });

  it('AC-P4-07 reports created, linked, updated and skipped rows faithfully in one confirmation', async () => {
    const linked = await prisma.prospect.create({
      data: { tenantId, campaignId, name: 'Linked Master', source: 'manual' },
    });
    const updated = await prisma.prospect.create({
      data: {
        tenantId,
        campaignId,
        name: 'Updated Master',
        address: 'Old street',
        source: 'manual',
      },
    });
    const csv = Buffer.from(
      [
        'name,address',
        'Brand New,Street 1',
        'Linked Master,Street 2',
        'Updated Master,Street 3',
        'Skipped Master,Street 4',
      ].join('\n'),
    );
    await run(async () => {
      const preview = await service.preview(campaignId, csv);
      expect(preview.rows.map((row) => row.classification)).toEqual([
        'NEW',
        'MATCH',
        'MATCH',
        'NEW',
      ]);
      const result = await service.confirm(
        campaignId,
        csv,
        preview.previewReference,
        JSON.stringify([
          { record: 1, action: 'CREATE' },
          { record: 2, action: 'LINK_EXISTING' },
          { record: 3, action: 'UPDATE_EXISTING' },
          { record: 4, action: 'SKIP' },
        ]),
      );
      const created = result.rows.find((row) => row.record === 1)!;
      expect(created.action).toBe('CREATE');
      expect(created.prospectId).toBeDefined();
      expect(created.prospectId).not.toBe(linked.id);
      expect(result.rows.slice(1)).toEqual([
        { record: 2, action: 'LINK_EXISTING', prospectId: linked.id },
        { record: 3, action: 'UPDATE_EXISTING', prospectId: updated.id },
        { record: 4, action: 'SKIP' },
      ]);
      expect(result.summary).toEqual({
        total: 4,
        created: 1,
        linked: 1,
        updated: 1,
        skipped: 1,
        rejected: 0,
      });
      // Persisted truth matches the reported per-row outcome.
      expect(
        await prisma.prospect.count({ where: { tenantId, name: 'Brand New' } }),
      ).toBe(1);
      expect(
        await prisma.prospect.count({
          where: { tenantId, name: 'Skipped Master' },
        }),
      ).toBe(0);
      const afterUpdate = await prisma.prospect.findUniqueOrThrow({
        where: { id: updated.id },
      });
      expect(afterUpdate.address).toBe('Street 3');
      const afterLink = await prisma.prospect.findUniqueOrThrow({
        where: { id: linked.id },
      });
      expect(afterLink.address).toBeNull();
      expect(
        await prisma.campaignProspect.count({
          where: {
            campaignId,
            prospectId: { in: [linked.id, updated.id, created.prospectId!] },
          },
        }),
      ).toBe(3);
    });
  });

  it('T04/P4 rejects multiple candidates without changing any persisted row', async () => {
    await prisma.prospect.createMany({
      data: ['Empresa Demo', ' empresa   demo '].map((name) => ({
        tenantId,
        campaignId,
        name,
        source: 'manual',
      })),
    });
    const snapshot = async () => ({
      prospects: await prisma.prospect.findMany({
        where: { tenantId },
        orderBy: { id: 'asc' },
      }),
      participations: await prisma.campaignProspect.findMany({
        where: { campaignId },
      }),
      activities: await prisma.campaignActivity.findMany({
        where: { tenantId },
      }),
      provenance: await prisma.prospectProvenance.findMany({
        where: { tenantId },
      }),
    });
    const before = await snapshot();
    await run(async () => {
      const csv = Buffer.from('name\nEmpresa Demo');
      const preview = await service.preview(campaignId, csv);
      expect(preview.rows[0].classification).toBe('CONFLICT');
      expect(preview.rows[0].matches).toHaveLength(2);
      expect(await snapshot()).toEqual(before);
      const result = await service.confirm(
        campaignId,
        csv,
        preview.previewReference,
        '[]',
      );
      expect(result.rows[0]).toMatchObject({ record: 1, action: 'REJECTED' });
      expect(result.rows[0].errors?.length).toBeGreaterThan(0);
      expect(await snapshot()).toEqual(before);
      await expect(
        service.confirm(
          campaignId,
          csv,
          preview.previewReference,
          JSON.stringify([
            {
              record: 1,
              action: 'LINK_EXISTING',
              candidateId: before.prospects[0].id,
            },
          ]),
        ),
      ).rejects.toThrow();
      expect(await snapshot()).toEqual(before);
    });
  });
});
