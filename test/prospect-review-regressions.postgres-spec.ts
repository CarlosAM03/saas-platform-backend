import { ConflictException, NotFoundException } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContextService } from '../src/common/context/tenant-context.service';
import { ProspectsService } from '../src/prospects/prospects.service';
import { CreateProspectRequest } from '../src/prospects/dto/create-prospect.request';

describe('CP declared identity DTO bounds', () => {
  it.each(['', '   ', 'a'.repeat(513)])(
    'rejects invalid identifier %j',
    (identityIdentifier) => {
      const dto = Object.assign(new CreateProspectRequest(), {
        campaignId: 'synthetic-campaign',
        name: 'Synthetic',
        identitySource: 'google_maps',
        identityIdentifier,
      });
      expect(validateSync(dto).map((error) => error.property)).toContain(
        'identityIdentifier',
      );
    },
  );
  it('accepts the 512-character boundary without imposing an external format', () => {
    const dto = Object.assign(new CreateProspectRequest(), {
      campaignId: 'synthetic-campaign',
      name: 'Synthetic',
      identitySource: 'google_maps',
      identityIdentifier: 'A'.repeat(512),
    });
    expect(validateSync(dto)).toEqual([]);
  });
  it('rejects a source outside the existing enum', () => {
    const dto = Object.assign(new CreateProspectRequest(), {
      campaignId: 'synthetic-campaign',
      name: 'Synthetic',
      identitySource: 'manual',
      identityIdentifier: 'Declared-ID',
    });
    expect(validateSync(dto).map((error) => error.property)).toContain(
      'identitySource',
    );
  });
});

// Synthetic fixtures only. setup-postgres-env.ts enforces the disposable target.
describe('CP prospect review regressions with PostgreSQL', () => {
  let db: PrismaService;
  let actor: string;
  let tenants: string[];
  let campaigns: string[];
  const context = new TenantContextService();
  const run = <T>(tenantId: string, fn: () => T) =>
    context.run(
      { tenantId, userId: actor, tenantRole: 'OWNER', platformRole: null },
      fn,
    );
  const hash = (identifier: string) =>
    createHash('sha256')
      .update(`google_maps:${identifier.trim()}`)
      .digest('hex');
  const request = () => ({
    campaignId: campaigns[1],
    name: 'New display name',
    identitySource: 'google_maps' as const,
    identityIdentifier: ' place-review ',
  });
  const legacy = (
    campaignId = campaigns[0],
    tenantId = tenants[0],
    identifier = 'place-review',
  ) =>
    db.prospect.create({
      data: {
        tenantId,
        campaignId,
        name: 'Historical display name',
        source: 'google_maps',
        sourceIdentifier: identifier,
      },
    });
  const modern = () =>
    db.prospect.create({
      data: {
        tenantId: tenants[0],
        campaignId: campaigns[0],
        name: 'Modern display name',
        source: 'google_maps',
        sourceIdentifier: 'place-review',
        identitySource: 'google_maps',
        identityHash: hash('place-review'),
      },
    });
  const counts = async () => ({
    masters: await db.prospect.count({ where: { tenantId: tenants[0] } }),
    participations: await db.campaignProspect.count({
      where: { campaignId: { in: campaigns.slice(0, 2) } },
    }),
    provenance: await db.prospectProvenance.count({
      where: { tenantId: tenants[0] },
    }),
    activity: await db.campaignActivity.count({
      where: { tenantId: tenants[0] },
    }),
  });

  beforeAll(async () => {
    if (!process.env.INTEGRATION_TEST_DATABASE_URL)
      throw new Error('Disposable PostgreSQL required');
    db = new PrismaService();
    await db.$connect();
    actor = (
      await db.user.create({
        data: {
          name: 'Synthetic reviewer',
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
            data: {
              name: 'Synthetic tenant',
              slug: `review-${randomUUID()}`,
            },
          })
        ).id,
      );
    }
    for (const tenantId of [tenants[0], tenants[0], tenants[1]]) {
      campaigns.push(
        (
          await db.campaign.create({
            data: { tenantId, createdBy: actor, name: 'Synthetic campaign' },
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

  it.each(['place-review', ' place-review '])(
    'AC-P1-01: reuses unique legacy identity %j despite a different name without backfill',
    async (identifier) => {
      const stored = await legacy(campaigns[0], tenants[0], identifier);
      const service = new ProspectsService(db, context);
      const match = await run(tenants[0], () => service.match(request()));
      expect(match.strongProspect?.id).toBe(stored.id);
      const result = await run(tenants[0], () => service.create(request()));
      expect(result.id).toBe(stored.id);
      expect(result.campaignId).toBe(campaigns[0]);
      expect(await counts()).toEqual({
        masters: 1,
        participations: 1,
        provenance: 1,
        activity: 1,
      });
      expect(
        await db.prospect.findUniqueOrThrow({ where: { id: stored.id } }),
      ).toEqual(stored);
      expect(
        await db.prospectProvenance.findFirstOrThrow({
          where: { prospectId: stored.id },
        }),
      ).toMatchObject({
        type: 'LINKED',
        tenantId: tenants[0],
        campaignId: campaigns[1],
        actorUserId: actor,
      });
    },
  );

  it.each(['legacy', 'modern'])(
    'P1 owner casing: %s original differing only in casing is not reused',
    async (kind) => {
      const stored =
        kind === 'legacy'
          ? await legacy(campaigns[0], tenants[0], 'Place-Review')
          : await modern();
      const service = new ProspectsService(db, context);
      const input = {
        ...request(),
        identityIdentifier: kind === 'legacy' ? 'place-review' : 'Place-Review',
      };
      const match = await run(tenants[0], () => service.match(input));
      expect(match.strongProspect).toBeNull();
      expect(match.candidates).toEqual([]);
      const created = await run(tenants[0], () => service.create(input));
      expect(created.id).not.toBe(stored.id);
      expect(await counts()).toEqual({
        masters: 2,
        participations: 1,
        provenance: 1,
        activity: 1,
      });
      expect(
        await db.prospect.findUniqueOrThrow({ where: { id: stored.id } }),
      ).toEqual(stored);
      expect(
        await db.prospect.findUniqueOrThrow({ where: { id: created.id } }),
      ).toMatchObject({
        sourceIdentifier: input.identityIdentifier,
        identityHash: hash(input.identityIdentifier),
      });
    },
  );

  it('P1 old lowercase hash is never reused for a different original and conflicts with zero effects', async () => {
    const stored = await db.prospect.create({
      data: {
        tenantId: tenants[0],
        campaignId: campaigns[0],
        name: 'Historical casing',
        source: 'google_maps',
        sourceIdentifier: 'Place-Review',
        identitySource: 'google_maps',
        identityHash: hash('place-review'),
      },
    });
    const service = new ProspectsService(db, context);
    const before = await counts();
    for (const action of [
      () => service.match(request()),
      () => service.create(request()),
      () => service.resolve({ ...request(), resolution: 'CREATE' }),
      () =>
        service.resolve({
          ...request(),
          resolution: 'LINK_EXISTING',
          candidateId: stored.id,
        }),
    ]) {
      await run(tenants[0], () =>
        expect(action()).rejects.toBeInstanceOf(ConflictException),
      );
      expect(await counts()).toEqual(before);
    }
    expect(
      await db.prospect.findUniqueOrThrow({ where: { id: stored.id } }),
    ).toEqual(stored);
  });

  it('P1 exact trimmed original remains reusable with an old lowercase hash, without backfill', async () => {
    const stored = await db.prospect.create({
      data: {
        tenantId: tenants[0],
        campaignId: campaigns[0],
        name: 'Historical casing',
        source: 'google_maps',
        sourceIdentifier: ' Place-Review ',
        identitySource: 'google_maps',
        identityHash: hash('place-review'),
      },
    });
    const service = new ProspectsService(db, context);
    const input = { ...request(), identityIdentifier: ' Place-Review ' };
    expect(
      (await run(tenants[0], () => service.match(input))).strongProspect?.id,
    ).toBe(stored.id);
    expect((await run(tenants[0], () => service.create(input))).id).toBe(
      stored.id,
    );
    expect(
      await db.prospect.findUniqueOrThrow({ where: { id: stored.id } }),
    ).toEqual(stored);
    expect(await counts()).toEqual({
      masters: 1,
      participations: 1,
      provenance: 1,
      activity: 1,
    });
  });

  it('P1 rejects a foreign destination campaign before matching or writing', async () => {
    await modern();
    const service = new ProspectsService(db, context);
    const before = await counts();
    const input = { ...request(), campaignId: campaigns[2] };
    await run(tenants[0], () =>
      expect(service.match(input)).rejects.toBeInstanceOf(NotFoundException),
    );
    await run(tenants[0], () =>
      expect(service.create(input)).rejects.toBeInstanceOf(NotFoundException),
    );
    expect(await counts()).toEqual(before);
  });

  it.each(['legacy/legacy', 'modern/legacy'])(
    'INV-10: %s strong collisions conflict without selecting first or writing',
    async (kind) => {
      const first = kind === 'legacy/legacy' ? await legacy() : await modern();
      const second = await legacy(campaigns[1]);
      const service = new ProspectsService(db, context);
      const before = await counts();
      await run(tenants[0], () =>
        expect(service.match(request())).rejects.toBeInstanceOf(
          ConflictException,
        ),
      );
      await run(tenants[0], () =>
        expect(service.create(request())).rejects.toBeInstanceOf(
          ConflictException,
        ),
      );
      await run(tenants[0], () =>
        expect(
          service.resolve({ ...request(), resolution: 'CREATE' }),
        ).rejects.toBeInstanceOf(ConflictException),
      );
      expect(await counts()).toEqual(before);
      expect(
        await db.prospect.findUniqueOrThrow({ where: { id: first.id } }),
      ).toEqual(first);
      expect(
        await db.prospect.findUniqueOrThrow({ where: { id: second.id } }),
      ).toEqual(second);
    },
  );

  it('AC-P1-01: explicit LINK_EXISTING accepts the unique strong candidate without a weak name match', async () => {
    const stored = await modern();
    const service = new ProspectsService(db, context);
    const match = await run(tenants[0], () => service.match(request()));
    expect(match.strongProspect?.id).toBe(stored.id);
    expect(match.candidates).toEqual([]);
    const result = await run(tenants[0], () =>
      service.resolve({
        ...request(),
        resolution: 'LINK_EXISTING',
        candidateId: stored.id,
      }),
    );
    expect(result.action).toBe('LINK_EXISTING');
    if (result.action !== 'LINK_EXISTING') throw new Error('Expected link');
    expect(result.prospect.id).toBe(stored.id);
    expect(await counts()).toEqual({
      masters: 1,
      participations: 1,
      provenance: 1,
      activity: 1,
    });
    expect(
      await db.prospect.findUniqueOrThrow({ where: { id: stored.id } }),
    ).toEqual(stored);
  });

  it('AC-P4-04: explicit choice is revalidated server-side when the candidate no longer matches', async () => {
    const stored = await db.prospect.create({
      data: {
        tenantId: tenants[0],
        campaignId: campaigns[0],
        name: 'Stale Candidate',
        source: 'manual',
      },
    });
    const before = await counts();
    const service = new ProspectsService(db, context);
    // The chosen candidate is no longer a candidate for this request.
    await expect(
      run(tenants[0], () =>
        service.resolve({
          ...request(),
          name: 'Totally Different Name',
          resolution: 'LINK_EXISTING',
          candidateId: stored.id,
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await counts()).toEqual(before);
    // A stale candidate id is never linked silently.
    expect(
      await db.campaignProspect.count({
        where: { campaignId: campaigns[0], prospectId: stored.id },
      }),
    ).toBe(0);
    expect(
      await db.prospectProvenance.count({ where: { prospectId: stored.id } }),
    ).toBe(0);
  });

  it('AC-P1-04: CREATE durably records the conscious decision, actor and tenant-local candidates', async () => {
    const existing = await db.prospect.create({
      data: {
        tenantId: tenants[0],
        campaignId: campaigns[0],
        name: 'Review Company',
        source: 'manual',
      },
    });
    const foreign = await db.prospect.create({
      data: {
        tenantId: tenants[1],
        campaignId: campaigns[2],
        name: 'Review Company',
        source: 'manual',
      },
    });
    const service = new ProspectsService(db, context);
    const result = await run(tenants[0], () =>
      service.resolve({
        campaignId: campaigns[1],
        name: ' REVIEW   COMPANY ',
        resolution: 'CREATE',
      }),
    );
    expect(result.action).toBe('CREATE');
    if (result.action !== 'CREATE') throw new Error('Expected creation');
    expect(result.prospect.id).not.toBe(existing.id);
    const events = await db.prospectProvenance.findMany({
      where: { prospectId: result.prospect.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'CREATED',
      tenantId: tenants[0],
      campaignId: campaigns[1],
      actorUserId: actor,
      details: { resolution: 'CREATE', candidateIds: [existing.id] },
    });
    expect(events[0].recordedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(events[0].details)).not.toContain(foreign.id);
    expect(
      await db.prospect.findUniqueOrThrow({ where: { id: existing.id } }),
    ).toEqual(existing);
    expect(await counts()).toEqual({
      masters: 2,
      participations: 1,
      provenance: 1,
      activity: 1,
    });
  });

  it('T06: foreign strong identity is neither exposed nor selectable', async () => {
    const foreign = await legacy(campaigns[2], tenants[1]);
    const service = new ProspectsService(db, context);
    const match = await run(tenants[0], () => service.match(request()));
    expect(match.strongProspect).toBeNull();
    expect(match.candidates).toEqual([]);
    await run(tenants[0], () =>
      expect(
        service.resolve({
          ...request(),
          resolution: 'LINK_EXISTING',
          candidateId: foreign.id,
        }),
      ).rejects.toBeInstanceOf(ConflictException),
    );
    expect(await counts()).toEqual({
      masters: 0,
      participations: 0,
      provenance: 0,
      activity: 0,
    });
    const own = await run(tenants[0], () => service.create(request()));
    expect(own.id).not.toBe(foreign.id);
    expect(
      await db.prospect.findUniqueOrThrow({ where: { id: foreign.id } }),
    ).toEqual(foreign);
  });

  it.each([
    { source: 'manual', sourceIdentifier: 'place-review' },
    { source: 'csv', sourceIdentifier: 'place-review' },
    { source: 'google_maps', sourceIdentifier: null },
    { source: 'google_maps', sourceIdentifier: '   ' },
  ])(
    'P1: does not promote untrusted or empty legacy identity %j',
    async (data) => {
      await db.prospect.create({
        data: {
          ...data,
          tenantId: tenants[0],
          campaignId: campaigns[0],
          name: 'Unrelated historical name',
        },
      });
      const service = new ProspectsService(db, context);
      const match = await run(tenants[0], () => service.match(request()));
      expect(match.strongProspect).toBeNull();
      expect(match.candidates).toEqual([]);
    },
  );

  it('INV-10: revalidates if a legacy identity commits after the preflight read', async () => {
    let inserted = false;
    const client = db.$extends({
      query: {
        prospect: {
          async findMany({ args, query }) {
            const result = await query(args);
            if (!inserted) {
              inserted = true;
              // Real commit on another connection after preflight returned rows.
              await legacy();
            }
            return result;
          },
        },
      },
    });
    const service = new ProspectsService(
      client as unknown as PrismaService,
      context,
    );
    await run(tenants[0], () =>
      expect(service.create(request())).rejects.toBeInstanceOf(
        ConflictException,
      ),
    );
    expect(inserted).toBe(true);
    expect(await counts()).toEqual({
      masters: 1,
      participations: 0,
      provenance: 0,
      activity: 0,
    });
  });

  it('INV-10: explicit CREATE cannot bypass an already-confirmed strong legacy identity', async () => {
    const existing = await legacy();
    const service = new ProspectsService(db, context);
    await run(tenants[0], () =>
      expect(
        service.resolve({ ...request(), resolution: 'CREATE' }),
      ).rejects.toBeInstanceOf(ConflictException),
    );
    expect(await counts()).toEqual({
      masters: 1,
      participations: 0,
      provenance: 0,
      activity: 0,
    });
    expect(
      await db.prospect.findUniqueOrThrow({ where: { id: existing.id } }),
    ).toEqual(existing);
  });

  it('T07 two simultaneous LINKs to the same absent participation commit one association and one event', async () => {
    const stored = await modern();
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Both real LINK upserts must overlap')),
        4000,
      );
    });
    const client = db.$extends({
      query: {
        campaignProspect: {
          async upsert({ args, query }) {
            if (++arrivals === 2) release();
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
    const link = () =>
      run(tenants[0], () =>
        service.resolve({
          ...request(),
          resolution: 'LINK_EXISTING',
          candidateId: stored.id,
        }),
      );
    try {
      const results = await Promise.allSettled([link(), link()]);
      expect(arrivals).toBe(2);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
      expect(await counts()).toEqual({
        masters: 1,
        participations: 1,
        provenance: 1,
        activity: 1,
      });
      expect(
        await db.prospectProvenance.findFirstOrThrow({
          where: { tenantId: tenants[0] },
        }),
      ).toMatchObject({ type: 'LINKED' });
      expect(
        await db.campaignActivity.findFirstOrThrow({
          where: { tenantId: tenants[0] },
        }),
      ).toMatchObject({ type: 'ASSOCIATION' });
      // A later, separately confirmed appearance must not create another association event.
      const repeated = new ProspectsService(db, context);
      await run(tenants[0], () =>
        repeated.resolve({
          ...request(),
          resolution: 'LINK_EXISTING',
          candidateId: stored.id,
        }),
      );
      expect(await counts()).toEqual({
        masters: 1,
        participations: 1,
        provenance: 2,
        activity: 1,
      });
      expect(
        await db.prospectProvenance.count({
          where: { tenantId: tenants[0], type: 'REAPPEARED' },
        }),
      ).toBe(1);
    } finally {
      clearTimeout(timer);
      release();
    }
  });

  it('T07: overlapping new strong inserts retain one commit, one 409 and atomic history', async () => {
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Both real INSERTs must overlap')),
        4000,
      );
    });
    const client = db.$extends({
      query: {
        prospect: {
          async create({ args, query }) {
            if (++arrivals === 2) release();
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
        campaigns
          .slice(0, 2)
          .map((campaignId) =>
            run(tenants[0], () => service.create({ ...request(), campaignId })),
          ),
      );
      expect(arrivals).toBe(2);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
      expect(await counts()).toEqual({
        masters: 1,
        participations: 1,
        provenance: 1,
        activity: 1,
      });
    } finally {
      clearTimeout(timer);
      release();
    }
  });
});
