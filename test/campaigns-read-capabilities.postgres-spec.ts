import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContextService } from '../src/common/context/tenant-context.service';
import { CampaignsService } from '../src/campaigns/campaigns.service';
import { CampaignProspectsQuery } from '../src/campaigns/dto/campaign-prospects.query';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const parse = (value: Record<string, unknown>) =>
  pipe.transform(value, {
    type: 'query',
    metatype: CampaignProspectsQuery,
  }) as Promise<CampaignProspectsQuery>;

describe('Campaign read date DTO', () => {
  it.each([
    '2026-01-02',
    '2026-01-02T12:00:00',
    '01/02/2026',
    '2026-02-30T00:00:00Z',
    'invalid',
  ])('rejects ambiguous/invalid timestamp %s with 400', async (date) => {
    for (const field of [
      'addedFrom',
      'addedTo',
      'activityFrom',
      'activityTo',
    ]) {
      await expect(parse({ [field]: date })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });
  it.each(['added', 'activity'])(
    'rejects inverted %s range with 400',
    async (prefix) => {
      await expect(
        parse({
          [`${prefix}From`]: '2026-01-02T00:00:00Z',
          [`${prefix}To`]: '2026-01-01T00:00:00Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
  it('accepts equal instants with offsets and preserves pagination constraints', async () => {
    const query = await parse({
      addedFrom: '2026-01-01T00:00:00Z',
      addedTo: '2025-12-31T18:00:00-06:00',
      page: '2',
      limit: '1',
    });
    expect(query.page).toBe(2);
    expect(query.limit).toBe(1);
    for (const value of [{ page: 0 }, { limit: 101 }, { limit: 0 }])
      await expect(parse(value)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Campaign read capabilities on disposable PostgreSQL', () => {
  const context = new TenantContextService();
  let db: PrismaService;
  let svc: CampaignsService;
  let tenantId: string;
  let foreignTenantId: string;
  let actor: string;
  let responsibleId: string;
  let campaignId: string;
  let campaignB: string;
  let prospectIds: string[];
  const instant = new Date('2026-01-10T12:00:00Z');
  const run = <T>(fn: () => T, selectedTenant = tenantId) =>
    context.run(
      {
        tenantId: selectedTenant,
        userId: actor,
        tenantRole: 'OWNER',
        platformRole: null,
      },
      fn,
    );
  const list = async (
    query: Record<string, unknown> = {},
    campaign = campaignId,
  ) =>
    run(() =>
      svc.findProspects(
        campaign,
        Object.assign(new CampaignProspectsQuery(), query),
      ),
    );

  beforeAll(async () => {
    if (!process.env.INTEGRATION_TEST_DATABASE_URL)
      throw new Error('Disposable PostgreSQL required');
    db = new PrismaService();
    await db.$connect();
    svc = new CampaignsService(db, context);
  });
  beforeEach(async () => {
    tenantId = (
      await db.tenant.create({
        data: { name: 'Synthetic reads', slug: randomUUID() },
      })
    ).id;
    foreignTenantId = (
      await db.tenant.create({
        data: { name: 'Synthetic foreign', slug: randomUUID() },
      })
    ).id;
    const role = await db.role.create({ data: { tenantId, name: 'OWNER' } });
    const users: string[] = [];
    for (let i = 0; i < 2; i++) {
      const user = await db.user.create({
        data: {
          name: `Synthetic ${i}`,
          email: `${randomUUID()}@synthetic.test`,
          passwordHash: 'unused',
        },
      });
      users.push(user.id);
      await db.userTenant.create({
        data: { tenantId, userId: user.id, roleId: role.id },
      });
    }
    [actor, responsibleId] = users;
    const campaigns: string[] = [];
    for (let i = 0; i < 2; i++)
      campaigns.push(
        (
          await db.campaign.create({
            data: { tenantId, createdBy: actor, name: `Synthetic ${i}` },
          })
        ).id,
      );
    [campaignId, campaignB] = campaigns;
    prospectIds = [];
    for (let i = 0; i < 3; i++) {
      const p = await db.prospect.create({
        data: {
          tenantId,
          campaignId,
          name: 'Synthetic same name',
          category: 'Sector',
          address: 'Synthetic location',
          source: 'manual',
          status: 'INACTIVO',
          metadata: { synthetic: i },
          createdAt: new Date('2020-01-01T00:00:00Z'),
        },
      });
      prospectIds.push(p.id);
      await db.campaignProspect.create({
        data: {
          campaignId,
          prospectId: p.id,
          addedAt: i === 2 ? new Date('2026-01-11T12:00:00Z') : instant,
          commercialStage: 'CONTACTADO',
          evaluation: 'APTO',
        },
      });
    }
    await db.campaignProspect.create({
      data: {
        campaignId: campaignB,
        prospectId: prospectIds[0],
        commercialStage: 'CERRADO',
        addedAt: new Date('2025-01-01T00:00:00Z'),
      },
    });
    await db.campaignProspect.create({
      data: { campaignId: campaignB, prospectId: prospectIds[2] },
    });
    for (const prospectId of prospectIds.slice(0, 2))
      for (let i = 0; i < 2; i++)
        await db.campaignActivity.create({
          data: {
            tenantId,
            campaignId,
            prospectId,
            actorUserId: actor,
            type: 'NOTE',
            content: 'Synthetic',
            recordedAt: instant,
            declaredAt: new Date('2020-01-01T00:00:00Z'),
          },
        });
    await db.campaignActivity.create({
      data: {
        tenantId,
        campaignId: campaignB,
        prospectId: prospectIds[2],
        actorUserId: actor,
        type: 'NOTE',
        recordedAt: instant,
      },
    });
    // Deliberately inconsistent fixture verifies explicit activity tenant scoping.
    await db.campaignActivity.create({
      data: {
        tenantId: foreignTenantId,
        campaignId,
        prospectId: prospectIds[2],
        actorUserId: actor,
        type: 'NOTE',
        recordedAt: instant,
      },
    });
  });
  afterEach(async () => {
    const tenants = [tenantId, foreignTenantId];
    await db.campaignActivity.deleteMany({
      where: { tenantId: { in: tenants } },
    });
    await db.campaignProspect.deleteMany({ where: { campaign: { tenantId } } });
    await db.prospect.deleteMany({ where: { tenantId } });
    await db.campaign.deleteMany({ where: { tenantId } });
    await db.userTenant.deleteMany({ where: { tenantId } });
    await db.role.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: { in: tenants } } });
    await db.user.deleteMany({ where: { id: { in: [actor, responsibleId] } } });
  });
  afterAll(async () => {
    if (db) await db.$disconnect();
  });

  it('AND filters all participations before pagination, inclusive offsets, stable counts and no duplicates', async () => {
    const query = {
      addedFrom: '2026-01-10T06:00:00-06:00',
      addedTo: instant.toISOString(),
      activityFrom: instant.toISOString(),
      activityTo: instant.toISOString(),
      stage: 'CONTACTADO',
      evaluation: 'APTO',
      responsibleId: 'UNASSIGNED',
      search: 'same',
      category: 'sector',
      address: 'location',
      source: 'manual',
      limit: 1,
    };
    const first = await list(query);
    const second = await list({ ...query, page: 2 });
    expect(first.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(second.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect([first.data[0].id, second.data[0].id]).toEqual(
      prospectIds.slice(0, 2).sort(),
    );
    expect((await list({ ...query, page: 3 })).data).toEqual([]);
    expect((await list({ ...query, evaluation: 'NO_APTO' })).meta.total).toBe(
      0,
    );
    expect(
      (
        await list({
          activityFrom: instant.toISOString(),
          activityTo: instant.toISOString(),
        })
      ).meta.total,
    ).toBe(2);
    expect(
      (await list({ addedFrom: '2026-01-11T12:00:00Z' })).data.map((p) => p.id),
    ).toEqual([prospectIds[2]]);
    expect((await list({ addedTo: '2026-01-09T23:59:59Z' })).meta.total).toBe(
      0,
    );
    expect(
      (await list({ activityFrom: '2026-01-10T12:00:00.001Z' })).meta.total,
    ).toBe(0);
    expect(
      (await list({ activityTo: '2026-01-10T11:59:59.999Z' })).meta.total,
    ).toBe(0);
    expect(
      (
        await list({
          activityFrom: '2020-01-01T00:00:00Z',
          activityTo: '2020-01-01T00:00:00Z',
        })
      ).meta.total,
    ).toBe(0); // declaredAt is not recorded activity time.
    for (const excluded of [
      { category: 'absent' },
      { address: 'absent' },
      { source: 'absent' },
      { search: 'absent' },
      { stage: 'CERRADO' },
    ])
      expect((await list({ ...query, ...excluded })).meta.total).toBe(0);
    await expect(
      list({
        addedFrom: '2026-01-11T00:00:00Z',
        addedTo: '2026-01-10T00:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('preserves legacy master fields/status and adds independent campaign participation', async () => {
    const result = await list();
    const row = result.data.find((p) => p.id === prospectIds[0])!;
    const master = await db.prospect.findUniqueOrThrow({
      where: { id: row.id },
    });
    const publicMaster = Object.fromEntries(
      Object.entries(master).filter(
        ([key]) =>
          !['tenantId', 'identitySource', 'identityHash'].includes(key),
      ),
    );
    expect(row).toMatchObject(publicMaster);
    expect(row.status).toBe('INACTIVO');
    expect(row).toHaveProperty(
      'participation',
      expect.objectContaining({
        campaignId,
        prospectId: row.id,
        status: 'ACTIVO',
        commercialStage: 'CONTACTADO',
        evaluation: 'APTO',
        evaluationReason: null,
        responsibleId: null,
        addedAt: instant,
        updatedAt: expect.any(Date) as unknown,
        responsible: null,
      }),
    );
    const b = await list({ stage: 'CERRADO' }, campaignB);
    expect(b.data.map((p) => p.id)).toEqual([row.id]);
    expect(b.data[0]).toHaveProperty(
      'participation.commercialStage',
      'CERRADO',
    );
    expect((await list({ stage: 'CERRADO' })).meta.total).toBe(0);
    await expect(
      run(
        () => svc.findProspects(campaignId, new CampaignProspectsQuery()),
        foreignTenantId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      run(() => svc.getParticipation(campaignId, row.id), foreignTenantId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('AC-C2-02 keeps an independent evaluation per campaign for the same master', async () => {
    const prospectId = prospectIds[0];
    const a = await run(() =>
      svc.updateEvaluation(campaignId, prospectId, 'APTO'),
    );
    const b = await run(() =>
      svc.updateEvaluation(campaignB, prospectId, 'NO_APTO', 'Not useful here'),
    );
    expect(a.evaluation).toBe('APTO');
    expect(a.evaluationReason).toBeNull();
    expect(b.evaluation).toBe('NO_APTO');
    expect(b.evaluationReason).toBe('Not useful here');
    const rereadA = await run(() =>
      svc.getParticipation(campaignId, prospectId),
    );
    const rereadB = await run(() =>
      svc.getParticipation(campaignB, prospectId),
    );
    expect(rereadA.evaluation).toBe('APTO');
    expect(rereadA.evaluationReason).toBeNull();
    expect(rereadB.evaluation).toBe('NO_APTO');
    // The master itself and its campaign A stage are untouched by B's judgement.
    expect(
      await db.prospect.findUniqueOrThrow({ where: { id: prospectId } }),
    ).toMatchObject({ status: 'INACTIVO', campaignId });
    expect(rereadA.commercialStage).toBe('CONTACTADO');
  });

  it('AC-C4-03 assigns a different responsible per campaign for the same master', async () => {
    const prospectId = prospectIds[0];
    const assignedA = await run(() =>
      svc.assignResponsible(campaignId, prospectId, actor),
    );
    const assignedB = await run(() =>
      svc.assignResponsible(campaignB, prospectId, responsibleId),
    );
    expect(assignedA.responsibleId).toBe(actor);
    expect(assignedB.responsibleId).toBe(responsibleId);
    const rows = await db.campaignProspect.findMany({
      where: { prospectId },
      orderBy: { campaignId: 'asc' },
    });
    const byCampaign = new Map(rows.map((row) => [row.campaignId, row]));
    expect(byCampaign.get(campaignId)!.responsibleId).toBe(actor);
    expect(byCampaign.get(campaignB)!.responsibleId).toBe(responsibleId);
    // Each campaign reports only its own assignment, never the other tenant's user.
    const dashboardA = await run(() => svc.dashboard(campaignId));
    const dashboardB = await run(() => svc.dashboard(campaignB));
    expect(dashboardA.responsibility[actor]).toBe(1);
    expect(dashboardA.responsibility[responsibleId]).toBeUndefined();
    expect(dashboardB.responsibility[responsibleId]).toBe(1);
    expect(dashboardB.responsibility[actor]).toBeUndefined();
    expect(
      (await run(() => svc.getParticipation(campaignId, prospectId)))
        .responsible,
    ).toMatchObject({ id: actor, eligible: true });
  });

  it('AC-C8-01 keeps separate dashboard totals for a master shared by two campaigns', async () => {
    const shared = prospectIds[0];
    expect(
      await db.campaignProspect.count({
        where: { campaignId, prospectId: shared },
      }),
    ).toBe(1);
    expect(
      await db.campaignProspect.count({
        where: { campaignId: campaignB, prospectId: shared },
      }),
    ).toBe(1);
    await run(() => svc.updateStage(campaignB, shared, 'CERRADO'));
    const dashboardA = await run(() => svc.dashboard(campaignId));
    const dashboardB = await run(() => svc.dashboard(campaignB));
    expect(dashboardA.total).toBe(3);
    expect(dashboardB.total).toBe(2);
    // The shared master is counted once per campaign, never twice inside one.
    expect(dashboardA.stages.CERRADO).toBe(0);
    expect(dashboardB.stages.CERRADO).toBe(1);
    expect(dashboardA.stages.CONTACTADO).toBe(3);
  });

  it('AC-C3-04 stores a manual activity as a human record without delivery claims', async () => {
    const prospectId = prospectIds[0];
    const created = await run(() =>
      svc.createActivity(campaignId, prospectId, {
        type: 'CALL',
        content: 'Called the business, no answer',
        declaredAt: '2026-01-10T11:00:00Z',
      }),
    );
    expect(created).toMatchObject({
      type: 'CALL',
      content: 'Called the business, no answer',
      actorUserId: actor,
      tenantId,
    });
    // No transport/delivery metadata exists: the platform only records the report.
    for (const field of [
      'sentAt',
      'deliveredAt',
      'providerMessageId',
      'status',
      'channel',
    ]) {
      expect(created).not.toHaveProperty(field);
    }
    const stored = await db.campaignActivity.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(Object.keys(stored).sort()).toEqual(
      [
        'actorUserId',
        'campaignId',
        'content',
        'correctsId',
        'declaredAt',
        'id',
        'newValue',
        'previousValue',
        'reason',
        'recordedAt',
        'tenantId',
        'type',
        'prospectId',
      ].sort(),
    );
    expect(stored.content).toBe('Called the business, no answer');
  });

  it('AC-C2-01 rejects NO_APTO without a reason and mutates nothing', async () => {
    const prospectId = prospectIds[0];
    const participation = () =>
      db.campaignProspect.findUniqueOrThrow({
        where: { campaignId_prospectId: { campaignId, prospectId } },
      });
    const before = await participation();
    const activitiesBefore = await db.campaignActivity.count({
      where: { tenantId, campaignId, prospectId },
    });
    for (const reason of [undefined, '', '   ']) {
      await expect(
        run(() =>
          svc.updateEvaluation(campaignId, prospectId, 'NO_APTO', reason),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(await participation()).toEqual(before);
    expect(
      await db.campaignActivity.count({
        where: { tenantId, campaignId, prospectId },
      }),
    ).toBe(activitiesBefore);
  });

  it('AC-C4-02 rejects inactive or non-member responsibles without any write', async () => {
    const prospectId = prospectIds[0];
    const active = await run(() =>
      svc.assignResponsible(campaignId, prospectId, responsibleId),
    );
    expect(active.responsibleId).toBe(responsibleId);
    const snapshot = async () => ({
      row: await db.campaignProspect.findUniqueOrThrow({
        where: { campaignId_prospectId: { campaignId, prospectId } },
      }),
      activities: await db.campaignActivity.count({
        where: { tenantId, campaignId, prospectId },
      }),
    });
    const before = await snapshot();

    // Same tenant, no membership.
    const outsider = await db.user.create({
      data: {
        name: 'Synthetic outsider',
        email: `${randomUUID()}@synthetic.test`,
        passwordHash: 'unused',
      },
    });
    await expect(
      run(() => svc.assignResponsible(campaignId, prospectId, outsider.id)),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Member, but inactive.
    await db.user.update({
      where: { id: actor },
      data: { status: 'INACTIVO' },
    });
    await expect(
      run(() => svc.assignResponsible(campaignId, prospectId, actor)),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(await snapshot()).toEqual(before);
    await db.user.update({ where: { id: actor }, data: { status: 'ACTIVO' } });
    await db.user.delete({ where: { id: outsider.id } });
  });

  it('AC-C8-04 answers a coherent empty dashboard without NaN or negatives', async () => {
    const empty = await db.campaign.create({
      data: { tenantId, createdBy: actor, name: 'Empty campaign' },
    });
    const result = await run(() => svc.dashboard(empty.id));
    expect(result).toMatchObject({
      total: 0,
      stages: {
        SIN_GESTIONAR: 0,
        EN_INVESTIGACION: 0,
        CONTACTADO: 0,
        EN_SEGUIMIENTO: 0,
        OPORTUNIDAD: 0,
        CERRADO: 0,
      },
      evaluations: { SIN_EVALUAR: 0, APTO: 0, NO_APTO: 0 },
      responsibility: {},
      incorporation: { new: 0, reused: 0, unknownLegacy: 0 },
      activity: { total: 0, manual: 0, events: 0 },
    });
    const numbers = [
      result.total,
      ...Object.values(result.stages),
      ...Object.values(result.evaluations),
      ...Object.values(result.responsibility),
      ...Object.values(result.incorporation),
      result.activity.total,
      result.activity.manual,
      result.activity.events,
    ];
    expect(numbers.every((value) => Number.isFinite(value))).toBe(true);
    expect(numbers.some((value) => value < 0)).toBe(false);
    // Reading an empty campaign writes nothing.
    expect(
      await db.campaignActivity.count({
        where: { tenantId, campaignId: empty.id },
      }),
    ).toBe(0);
    expect(
      await db.campaignProspect.count({ where: { campaignId: empty.id } }),
    ).toBe(0);
  });

  it.each(['membership', 'inactive'])(
    'computes eligibility after %s loss without rewriting assignment/history',
    async (loss) => {
      const prospectId = prospectIds[0];
      const assigned = await run(() =>
        svc.assignResponsible(campaignId, prospectId, responsibleId),
      );
      expect(assigned.responsible).toMatchObject({
        id: responsibleId,
        eligible: true,
      });
      expect(assigned.responsible).not.toHaveProperty('userTenants');
      const unchanged = await run(() =>
        svc.assignResponsible(campaignId, prospectId, responsibleId),
      );
      expect(unchanged.responsible).toMatchObject({
        id: responsibleId,
        eligible: true,
      });
      const before = await db.campaignProspect.findUniqueOrThrow({
        where: { campaignId_prospectId: { campaignId, prospectId } },
      });
      const history = await db.campaignActivity.findMany({
        where: { tenantId, campaignId, prospectId },
        orderBy: { id: 'asc' },
      });
      if (loss === 'membership')
        await db.userTenant.delete({
          where: { userId_tenantId: { userId: responsibleId, tenantId } },
        });
      else
        await db.user.update({
          where: { id: responsibleId },
          data: { status: 'INACTIVO' },
        });
      const participation = await run(() =>
        svc.getParticipation(campaignId, prospectId),
      );
      expect(participation.responsible).toMatchObject({
        id: responsibleId,
        eligible: false,
      });
      expect(participation.responsible).not.toHaveProperty('userTenants');
      const row = (await list({ responsibleId })).data[0];
      expect(row).toHaveProperty('participation.responsible.eligible', false);
      expect(row).not.toHaveProperty('participation.responsible.userTenants');
      expect(
        await db.campaignProspect.findUniqueOrThrow({
          where: { campaignId_prospectId: { campaignId, prospectId } },
        }),
      ).toEqual(before);
      expect(
        await db.campaignActivity.findMany({
          where: { tenantId, campaignId, prospectId },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(history);
      const cleared = await run(() =>
        svc.assignResponsible(campaignId, prospectId, null),
      );
      expect(cleared.responsible).toBeNull();
      expect(cleared.responsibleId).toBeNull();
    },
  );

  // Every participation in these fixtures is created atomically with exactly
  // one automatic event and no manual activity. Any consistent snapshot must
  // therefore satisfy equality, not a lower bound: a mixed-instant read shows
  // more events than participations (or the reverse).
  const assertOneSnapshot = (
    result: Awaited<ReturnType<CampaignsService['dashboard']>>,
    expected: number,
  ) => {
    const sum = (values: Record<string, number>) =>
      Object.values(values).reduce((a, b) => a + b, 0);
    expect(result.total).toBe(expected);
    expect(sum(result.stages)).toBe(expected);
    expect(sum(result.evaluations)).toBe(expected);
    expect(sum(result.responsibility)).toBe(expected);
    expect(Object.values(result.incorporation).reduce((a, b) => a + b, 0)).toBe(
      expected,
    );
    expect(result.activity.manual).toBe(0);
    expect(result.activity.events).toBe(expected);
    expect(result.activity.total).toBe(expected);
  };

  it('keeps one snapshot when a writer commits between the two activity counts', async () => {
    const target = await db.campaign.create({
      data: { tenantId, createdBy: actor, name: 'Gated snapshot' },
    });
    const seed = async (name: string) => {
      const prospect = await db.prospect.create({
        data: { tenantId, campaignId: target.id, name, source: 'manual' },
      });
      await db.$transaction([
        db.campaignProspect.create({
          data: { campaignId: target.id, prospectId: prospect.id },
        }),
        db.campaignActivity.create({
          data: {
            tenantId,
            campaignId: target.id,
            prospectId: prospect.id,
            type: 'ASSOCIATION',
            actorUserId: actor,
          },
        }),
      ]);
    };
    await seed('Seeded A');
    await seed('Seeded B');

    // Gate the second count until a writer has committed, so a sequential
    // implementation must observe two different instants. The proxy serves both
    // shapes: a root client (no transaction) and a transaction client.
    let countCalls = 0;
    let whenSecondCount!: () => void;
    const secondCountStarted = new Promise<void>((resolve) => {
      whenSecondCount = resolve;
    });
    let releaseSecondCount!: () => void;
    const secondCountGate = new Promise<void>((resolve) => {
      releaseSecondCount = resolve;
    });
    // Keep member access through a proxy typed as `unknown`: Prisma delegates
    // are closures, so binding the owner preserves their behaviour.
    const bindMember = (member: unknown, owner: object): unknown =>
      typeof member === 'function'
        ? (member as (...args: unknown[]) => unknown).bind(owner)
        : member;
    type ActivityClient = {
      count: (...args: unknown[]) => Promise<number>;
    };
    const gateActivity = (activity: ActivityClient) =>
      new Proxy(activity, {
        get(targetActivity, property: string | symbol) {
          if (property === 'count') {
            return async (...args: unknown[]) => {
              countCalls += 1;
              if (countCalls === 1) {
                whenSecondCount();
                await secondCountGate;
              }
              return targetActivity.count(...args);
            };
          }
          return bindMember(
            Reflect.get(targetActivity, property),
            targetActivity,
          );
        },
      });
    type PrismaLike = {
      campaignActivity: ActivityClient;
      $transaction: (fn: unknown, options?: unknown) => Promise<unknown>;
    };
    const gatedPrisma = new Proxy(db, {
      get(target, property: string | symbol) {
        if (property === 'campaignActivity')
          return gateActivity(target.campaignActivity);
        if (property === '$transaction')
          return (inner: unknown, options?: unknown) => {
            // Calling through the real client keeps Prisma's `this` binding.
            const runTransaction = (fn: unknown, opts?: unknown) =>
              (target.$transaction as unknown as PrismaLike['$transaction'])(
                fn,
                opts,
              );
            if (typeof inner !== 'function')
              return runTransaction(inner, options);
            return runTransaction(async (client: unknown) => {
              const clientScope = client as {
                campaignActivity: ActivityClient;
              };
              return (inner as (value: unknown) => Promise<unknown>)({
                ...(client as object),
                campaignActivity: gateActivity(clientScope.campaignActivity),
              });
            }, options);
          };
        return bindMember(Reflect.get(target, property, target), target);
      },
    });
    const gatedService = new CampaignsService(gatedPrisma, context);

    const pending = run(() => gatedService.dashboard(target.id));
    await secondCountStarted;
    await seed('Committed between the counts');
    releaseSecondCount();
    const result = await pending;

    // The write committed after the snapshot was taken stays invisible.
    assertOneSnapshot(result, 2);
    // A later read does see it, proving the gate actually wrote.
    assertOneSnapshot(await run(() => svc.dashboard(target.id)), 3);
  });

  it('returns dashboard totals from one snapshot while participations are added concurrently', async () => {
    const target = await db.campaign.create({
      data: { tenantId, createdBy: actor, name: 'Concurrent dashboard' },
    });
    for (let i = 0; i < 3; i++) {
      const prospect = await db.prospect.create({
        data: {
          tenantId,
          campaignId: target.id,
          name: `Seeded ${i}`,
          source: 'manual',
        },
      });
      await db.$transaction([
        db.campaignProspect.create({
          data: { campaignId: target.id, prospectId: prospect.id },
        }),
        db.campaignActivity.create({
          data: {
            tenantId,
            campaignId: target.id,
            prospectId: prospect.id,
            type: 'ASSOCIATION',
            actorUserId: actor,
          },
        }),
      ]);
    }
    const check = (
      result: Awaited<ReturnType<CampaignsService['dashboard']>>,
    ) => {
      const sum = (values: Record<string, number>) =>
        Object.values(values).reduce((a, b) => a + b, 0);
      expect(sum(result.stages)).toBe(result.total);
      expect(sum(result.evaluations)).toBe(result.total);
      expect(sum(result.responsibility)).toBe(result.total);
      expect(sum(result.incorporation)).toBe(result.total);
      expect(result.activity.manual).toBe(0);
      expect(result.activity.events).toBe(result.total);
      expect(result.activity.total).toBe(result.total);
    };
    const writers = Array.from({ length: 20 }, async (_, index) => {
      const prospect = await db.prospect.create({
        data: {
          tenantId,
          campaignId: target.id,
          name: `Concurrent ${index}`,
          source: 'manual',
        },
      });
      await db.$transaction([
        db.campaignProspect.create({
          data: { campaignId: target.id, prospectId: prospect.id },
        }),
        db.campaignActivity.create({
          data: {
            tenantId,
            campaignId: target.id,
            prospectId: prospect.id,
            type: 'ASSOCIATION',
            actorUserId: actor,
          },
        }),
      ]);
    });
    const readers = Array.from({ length: 20 }, async () =>
      check(await run(() => svc.dashboard(target.id))),
    );
    const settled = await Promise.allSettled([...writers, ...readers]);
    const rejected = settled.filter(
      (item): item is PromiseRejectedResult => item.status === 'rejected',
    );
    expect(rejected.map((item) => String(item.reason))).toEqual([]);
    check(await run(() => svc.dashboard(target.id)));
  });

  it('keeps dashboard hidden for foreign tenants without leaking aggregates', async () => {
    await expect(
      run(() => svc.dashboard(campaignId), foreignTenantId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
