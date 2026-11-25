import { ConflictException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContextService } from '../src/common/context/tenant-context.service';
import { ProspectsService } from '../src/prospects/prospects.service';

describe('CP identity with disposable PostgreSQL', () => {
  let db: PrismaService;
  let tenants: string[] = [];
  let campaigns: string[] = [];
  let actor: string;
  const context = new TenantContextService();
  const run = <T>(tenantId: string, fn: () => T) =>
    context.run(
      { tenantId, userId: actor, tenantRole: 'OWNER', platformRole: null },
      fn,
    );

  beforeAll(async () => {
    if (!process.env.INTEGRATION_TEST_DATABASE_URL)
      throw new Error('Disposable PostgreSQL required');
    db = new PrismaService();
    await db.$connect();
    actor = (
      await db.user.create({
        data: {
          name: 'Synthetic owner',
          email: `${randomUUID()}@synthetic.test`,
          passwordHash: 'not-used',
        },
      })
    ).id;
  });
  beforeEach(async () => {
    tenants = [];
    campaigns = [];
    for (let i = 0; i < 2; i++) {
      tenants.push(
        (
          await db.tenant.create({
            data: { name: 'Tenant Demo', slug: `identity-${randomUUID()}` },
          })
        ).id,
      );
    }
    for (const tenantId of [tenants[0], tenants[0], tenants[1]]) {
      campaigns.push(
        (
          await db.campaign.create({
            data: { tenantId, createdBy: actor, name: 'Campana Demo' },
          })
        ).id,
      );
    }
  });
  afterEach(async () => {
    const where = { tenantId: { in: tenants } };
    await db.campaignActivity.deleteMany({ where });
    await db.prospectProvenance.deleteMany({ where });
    await db.campaignProspect.deleteMany({
      where: { campaignId: { in: campaigns } },
    });
    await db.prospect.deleteMany({ where });
    await db.campaign.deleteMany({ where });
    await db.tenant.deleteMany({ where: { id: { in: tenants } } });
  });
  afterAll(async () => {
    if (db) {
      if (actor) await db.user.delete({ where: { id: actor } });
      await db.$disconnect();
    }
  });

  it('T07 overlapping strong-identity inserts yield one commit and one 409, with no orphan history', async () => {
    let arrived = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let timeout: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () =>
          reject(
            new Error('Both real transactions must reach the INSERT barrier'),
          ),
        4000,
      );
    });
    const client = db.$extends({
      query: {
        prospect: {
          async create({ args, query }) {
            if (++arrived === 2) release();
            await Promise.race([barrier, deadline]);
            return query(args);
          },
        },
      },
    });
    const service = new ProspectsService(
      client as unknown as PrismaService,
      context,
    );
    try {
      const results = await Promise.allSettled(
        campaigns.slice(0, 2).map((campaignId, i) =>
          run(tenants[0], () =>
            service.create({
              campaignId,
              name: 'Empresa Demo',
              identitySource: 'google_maps',
              identityIdentifier: i ? ' Place-123 ' : 'Place-123',
            }),
          ),
        ),
      );
      expect(arrived).toBe(2);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failed = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(failed?.reason).toBeInstanceOf(ConflictException);
      expect((failed?.reason as ConflictException).getStatus()).toBe(409);
      const rows = await db.prospect.findMany({
        where: { tenantId: tenants[0] },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        identitySource: 'google_maps',
        identityHash: createHash('sha256')
          .update('google_maps:Place-123')
          .digest('hex'),
      });
      expect(
        await db.campaignProspect.count({ where: { prospectId: rows[0].id } }),
      ).toBe(1);
      expect(
        await db.prospectProvenance.count({
          where: { tenantId: tenants[0], type: 'CREATED' },
        }),
      ).toBe(1);
      expect(
        await db.campaignActivity.count({
          where: { tenantId: tenants[0], type: 'ASSOCIATION' },
        }),
      ).toBe(1);
      expect(await db.prospect.count({ where: { tenantId: tenants[1] } })).toBe(
        0,
      );
    } finally {
      clearTimeout(timeout!);
      release();
    }
  });

  it('T02/T06 reuses a master within a tenant while the same strong key stays independent in B', async () => {
    const service = new ProspectsService(db, context);
    const create = (tenantId: string, campaignId: string) =>
      run(tenantId, () =>
        service.create({
          campaignId,
          name: 'Empresa Demo',
          identitySource: 'google_maps',
          identityIdentifier: 'place-123',
        }),
      );
    const first = await create(tenants[0], campaigns[0]);
    const linked = await create(tenants[0], campaigns[1]);
    const other = await create(tenants[1], campaigns[2]);
    expect(linked.id).toBe(first.id);
    expect(linked.campaignId).toBe(campaigns[0]);
    expect(other.id).not.toBe(first.id);
    expect(
      await db.campaignProspect.count({ where: { prospectId: first.id } }),
    ).toBe(2);
    expect(await db.prospect.count({ where: { tenantId: tenants[0] } })).toBe(
      1,
    );
    expect(await db.prospect.count({ where: { tenantId: tenants[1] } })).toBe(
      1,
    );
  });

  it('T03/T05 weak names require explicit resolution and CREATE preserves the existing candidate', async () => {
    const service = new ProspectsService(db, context);
    const existing = await run(tenants[0], () =>
      service.create({
        campaignId: campaigns[0],
        name: 'Empresa Demo',
      }),
    );
    expect(existing.id).toBeDefined();

    const match = await run(tenants[0], () =>
      service.match({
        campaignId: campaigns[0],
        name: ' EMPRESA   DEMO ',
      }),
    );
    expect(match.strongProspect).toBeNull();
    expect(match.candidates.map((candidate) => candidate.id)).toEqual([
      existing.id,
    ]);

    await run(tenants[0], () =>
      expect(
        service.create({
          campaignId: campaigns[0],
          name: 'EMPRESA DEMO',
        }),
      ).rejects.toBeInstanceOf(ConflictException),
    );

    const resolved = await run(tenants[0], () =>
      service.resolve({
        campaignId: campaigns[1],
        name: 'EMPRESA DEMO',
        resolution: 'CREATE',
      }),
    );
    expect(resolved.action).toBe('CREATE');
    expect(await db.prospect.count({ where: { tenantId: tenants[0] } })).toBe(
      2,
    );
    expect(
      await db.prospect.findUnique({ where: { id: existing.id } }),
    ).not.toBeNull();
  });

  it('T08 LINK_EXISTING to an existing relation does not restart or duplicate participation', async () => {
    const service = new ProspectsService(db, context);
    const prospect = await run(tenants[0], () =>
      service.create({
        campaignId: campaigns[0],
        name: 'Empresa Demo',
      }),
    );
    const before = await db.campaignProspect.findUniqueOrThrow({
      where: {
        campaignId_prospectId: {
          campaignId: campaigns[0],
          prospectId: prospect.id,
        },
      },
    });

    const resolved = await run(tenants[0], () =>
      service.resolve({
        campaignId: campaigns[0],
        name: 'EMPRESA DEMO',
        resolution: 'LINK_EXISTING',
        candidateId: prospect.id,
      }),
    );
    expect(resolved.action).toBe('LINK_EXISTING');

    const after = await db.campaignProspect.findUniqueOrThrow({
      where: {
        campaignId_prospectId: {
          campaignId: campaigns[0],
          prospectId: prospect.id,
        },
      },
    });
    expect(after.addedAt).toEqual(before.addedAt);
    expect(after.commercialStage).toBe(before.commercialStage);
    expect(after.evaluation).toBe(before.evaluation);
    expect(
      await db.campaignProspect.count({
        where: { campaignId: campaigns[0], prospectId: prospect.id },
      }),
    ).toBe(1);
  });
});
