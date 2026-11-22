import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('T31 CP HTTP isolation with homonymous tenants on PostgreSQL', () => {
  let app: INestApplication;
  let db: PrismaService;
  const tenants: string[] = [],
    users: string[] = [],
    campaigns: string[] = [],
    prospects: string[] = [];
  let ownerA: string, ownerB: string, memberA: string, withoutTenant: string;
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);
  const body = <T>(response: { body: unknown }) =>
    response.body as { success: boolean; data: T };
  type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
  const base = (c: string, p: string) =>
    `/api/v1/campaigns/${c}/prospects/${p}`;
  const routes: {
    method: Method;
    path: (c: string, p: string) => string;
    body?: object;
  }[] = [
    { method: 'get', path: (c) => `/api/v1/campaigns/${c}/dashboard` },
    { method: 'get', path: (c, p) => `${base(c, p)}/participation` },
    {
      method: 'patch',
      path: (c, p) => `${base(c, p)}/stage`,
      body: { stage: 'CONTACTADO' },
    },
    {
      method: 'patch',
      path: (c, p) => `${base(c, p)}/evaluation`,
      body: { evaluation: 'NO_APTO', reason: 'Synthetic reason' },
    },
    { method: 'get', path: (c, p) => `${base(c, p)}/responsibles` },
    { method: 'put', path: (c, p) => `${base(c, p)}/responsible` },
    { method: 'delete', path: (c, p) => `${base(c, p)}/responsible` },
    { method: 'get', path: (c, p) => `${base(c, p)}/activities` },
    {
      method: 'post',
      path: (c, p) => `${base(c, p)}/activities`,
      body: { type: 'NOTE', content: 'Synthetic note' },
    },
    { method: 'post', path: () => '/api/v1/prospects/match' },
    { method: 'post', path: () => '/api/v1/prospects/resolve' },
    { method: 'get', path: (_, p) => `/api/v1/prospects/${p}/campaigns` },
    { method: 'get', path: (_, p) => `/api/v1/prospects/${p}/provenance` },
  ];
  const bodyFor = (route: (typeof routes)[number], campaignId: string) => {
    if (route.path('', '').endsWith('/responsible') && route.method === 'put')
      return { responsibleId: users[0] };
    if (route.path('', '').endsWith('/match'))
      return { campaignId, name: 'Empresa Demo' };
    if (route.path('', '').endsWith('/resolve'))
      return { campaignId, name: 'Empresa Demo', resolution: 'CREATE' };
    return route.body ?? {};
  };
  const snapshot = async () => ({
    prospects: await db.prospect.findMany({
      where: { tenantId: { in: tenants } },
      orderBy: { id: 'asc' },
    }),
    participations: await db.campaignProspect.findMany({
      where: { campaignId: { in: campaigns } },
      orderBy: { campaignId: 'asc' },
    }),
    activities: await db.campaignActivity.findMany({
      where: { tenantId: { in: tenants } },
      orderBy: { id: 'asc' },
    }),
    provenance: await db.prospectProvenance.findMany({
      where: { tenantId: { in: tenants } },
      orderBy: { id: 'asc' },
    }),
  });

  beforeAll(async () => {
    if (!process.env.INTEGRATION_TEST_DATABASE_URL)
      throw new Error('Disposable PostgreSQL required');
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(app.get(GlobalExceptionFilter));
    app.useGlobalInterceptors(app.get(ResponseInterceptor));
    await app.init();
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    const jwt = app.get(JwtService);
    const tokens: string[] = [];
    for (let i = 0; i < 2; i++) {
      const tenant = await db.tenant.create({
        data: { name: 'Tenant Demo', slug: `cp-isolation-${randomUUID()}` },
      });
      tenants.push(tenant.id);
      const role = await db.role.create({
        data: { tenantId: tenant.id, name: 'OWNER' },
      });
      const user = await db.user.create({
        data: {
          name: 'Owner Demo',
          email: `${randomUUID()}@synthetic.test`,
          passwordHash: 'not-used',
        },
      });
      users.push(user.id);
      await db.userTenant.create({
        data: { tenantId: tenant.id, userId: user.id, roleId: role.id },
      });
      const campaign = await db.campaign.create({
        data: { tenantId: tenant.id, createdBy: user.id, name: 'Campana Demo' },
      });
      campaigns.push(campaign.id);
      const prospect = await db.prospect.create({
        data: {
          tenantId: tenant.id,
          campaignId: campaign.id,
          name: 'Empresa Demo',
          email: 'contacto@demo.test',
          address: 'Direccion Demo',
          source: 'manual',
        },
      });
      prospects.push(prospect.id);
      await db.campaignProspect.create({
        data: { campaignId: campaign.id, prospectId: prospect.id },
      });
      await db.campaignActivity.create({
        data: {
          tenantId: tenant.id,
          campaignId: campaign.id,
          prospectId: prospect.id,
          type: 'NOTE',
          content: 'Synthetic contextual note',
          actorUserId: user.id,
        },
      });
      await db.prospectProvenance.create({
        data: {
          tenantId: tenant.id,
          prospectId: prospect.id,
          campaignId: campaign.id,
          type: 'CREATED',
          source: 'manual',
          actorUserId: user.id,
        },
      });
      tokens.push(
        jwt.sign({
          sub: user.id,
          email: user.email,
          tenantId: tenant.id,
          tenantRole: 'OWNER',
          platformRole: null,
        }),
      );
    }
    [ownerA, ownerB] = tokens;
    const memberRole = await db.role.create({
      data: { tenantId: tenants[0], name: 'MEMBER' },
    });
    const member = await db.user.create({
      data: {
        name: 'Member Demo',
        email: `${randomUUID()}@synthetic.test`,
        passwordHash: 'not-used',
      },
    });
    users.push(member.id);
    await db.userTenant.create({
      data: { tenantId: tenants[0], userId: member.id, roleId: memberRole.id },
    });
    memberA = jwt.sign({
      sub: member.id,
      email: member.email,
      tenantId: tenants[0],
      tenantRole: 'MEMBER',
      platformRole: null,
    });
    const owner = await db.user.findUniqueOrThrow({ where: { id: users[0] } });
    withoutTenant = jwt.sign({
      sub: owner.id,
      email: owner.email,
      tenantId: null,
      tenantRole: null,
      platformRole: null,
    });
  });
  afterAll(async () => {
    if (db) {
      const where = { tenantId: { in: tenants } };
      await db.campaignActivity.deleteMany({ where });
      await db.prospectProvenance.deleteMany({ where });
      await db.campaignProspect.deleteMany({
        where: { campaignId: { in: campaigns } },
      });
      await db.prospect.deleteMany({ where });
      await db.campaign.deleteMany({ where });
      await db.userTenant.deleteMany({ where });
      await db.role.deleteMany({ where });
      await db.tenant.deleteMany({ where: { id: { in: tenants } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    await app?.close();
  });

  it.each(routes)(
    '$method denies session/tenant omissions and cross-tenant identifiers: $path',
    async (route) => {
      const before = await snapshot();
      await http()
        [route.method](route.path(campaigns[0], prospects[0]))
        .send(bodyFor(route, campaigns[0]))
        .expect(401);
      await http()
        [route.method](route.path(campaigns[0], prospects[0]))
        .set('Authorization', `Bearer ${withoutTenant}`)
        .send(bodyFor(route, campaigns[0]))
        .expect(403);
      const response = await http()
        [route.method](route.path(campaigns[1], prospects[1]))
        .set('Authorization', `Bearer ${ownerA}`)
        .send(bodyFor(route, campaigns[1]))
        .expect(404);
      expect(body(response).success).toBe(false);
      expect(JSON.stringify(response.body)).not.toContain(prospects[1]);
      expect(await snapshot()).toEqual(before);
    },
  );

  it.each(routes.filter((r) => r.path('c', 'p').includes('/prospects/p/')))(
    '$method hides mixed campaign A/prospect B identifiers: $path',
    async (route) => {
      const before = await snapshot();
      await http()
        [route.method](route.path(campaigns[0], prospects[1]))
        .set('Authorization', `Bearer ${ownerA}`)
        .send(bodyFor(route, campaigns[0]))
        .expect(404);
      expect(await snapshot()).toEqual(before);
    },
  );

  it('denies an external responsible and keeps campaign aggregates tenant-scoped', async () => {
    const before = await snapshot();
    await http()
      .put(`${base(campaigns[0], prospects[0])}/responsible`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({ responsibleId: users[1] })
      .expect(400);
    const response = await http()
      .get(`/api/v1/campaigns/${campaigns[0]}/dashboard`)
      .set('Authorization', `Bearer ${ownerA}`)
      .expect(200);
    expect(body(response).success).toBe(true);
    expect(body<{ total: number }>(response).data.total).toBe(1);
    const filtered = await http()
      .get(
        `/api/v1/campaigns/${campaigns[0]}/prospects?search=Empresa&stage=SIN_GESTIONAR&evaluation=SIN_EVALUAR`,
      )
      .set('Authorization', `Bearer ${ownerA}`)
      .expect(200);
    expect(body(filtered).data).toHaveLength(1);
    expect(body<Array<{ id: string }>>(filtered).data[0].id).toBe(prospects[0]);
    expect(JSON.stringify(filtered.body)).not.toContain(prospects[1]);
    expect(await snapshot()).toEqual(before);
  });

  it('P4 denies MEMBER and cross-tenant preview/confirm references without writes', async () => {
    const before = await snapshot();
    const csv = Buffer.from('name\nNew synthetic entity');
    const preview = (token: string, campaignId: string) =>
      http()
        .post('/api/v1/prospects/import/preview')
        .set('Authorization', `Bearer ${token}`)
        .field('campaignId', campaignId)
        .attach('file', csv, 'synthetic.csv');
    await preview(memberA, campaigns[0]).expect(403);
    await preview(ownerA, campaigns[1]).expect(404);
    const result = await preview(ownerA, campaigns[0]).expect(200);
    const confirm = (token: string, campaignId: string) =>
      http()
        .post('/api/v1/prospects/import/confirm')
        .set('Authorization', `Bearer ${token}`)
        .field('campaignId', campaignId)
        .field(
          'previewReference',
          body<{ previewReference: string }>(result).data.previewReference,
        )
        .field('decisions', '[{"record":1,"action":"CREATE"}]')
        .attach('file', csv, 'synthetic.csv');
    await confirm(memberA, campaigns[0]).expect(403);
    const crossed = await confirm(ownerB, campaigns[1]).expect(400);
    expect(body(crossed).success).toBe(false);
    expect(await snapshot()).toEqual(before);
  });

  it.each(['match', 'resolve'])(
    'denies MEMBER manual %s without changing data',
    async (operation) => {
      const before = await snapshot();
      await http()
        .post(`/api/v1/prospects/${operation}`)
        .set('Authorization', `Bearer ${memberA}`)
        .send({
          campaignId: campaigns[0],
          name: 'Empresa Demo',
          ...(operation === 'resolve' ? { resolution: 'CREATE' } : {}),
        })
        .expect(403);
      expect(await snapshot()).toEqual(before);
    },
  );

  it('allows a local activity but hides a correction target in another tenant', async () => {
    const foreign = await db.campaignActivity.findFirstOrThrow({
      where: { tenantId: tenants[1] },
    });
    const before = await snapshot();
    await http()
      .post(`${base(campaigns[0], prospects[0])}/activities`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({
        type: 'NOTE',
        content: 'Synthetic correction',
        correctsId: foreign.id,
      })
      .expect(404);
    expect(await snapshot()).toEqual(before);
    const result = await http()
      .post(`${base(campaigns[0], prospects[0])}/activities`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({ type: 'NOTE', content: 'Synthetic local note' })
      .expect(201);
    expect(body(result).success).toBe(true);
    expect(body(result).data).toMatchObject({
      campaignId: campaigns[0],
      prospectId: prospects[0],
      tenantId: tenants[0],
      actorUserId: users[0],
    });
    expect(
      await db.campaignActivity.count({ where: { tenantId: tenants[0] } }),
    ).toBe(2);
  });
  it('T09-T22 executes contextual stage, evaluation, activity, responsible, filters and dashboard', async () => {
    const campaignA2 = await db.campaign.create({
      data: {
        tenantId: tenants[0],
        createdBy: users[0],
        name: 'Campana A2',
      },
    });
    campaigns.push(campaignA2.id);
    await db.campaignProspect.create({
      data: { campaignId: campaignA2.id, prospectId: prospects[0] },
    });

    await http()
      .patch(`${base(campaigns[0], prospects[0])}/stage`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({ stage: 'CONTACTADO' })
      .expect(200);
    const a2Before = await db.campaignProspect.findUniqueOrThrow({
      where: {
        campaignId_prospectId: {
          campaignId: campaignA2.id,
          prospectId: prospects[0],
        },
      },
    });
    expect(a2Before.commercialStage).toBe('SIN_GESTIONAR');

    await http()
      .patch(`${base(campaigns[0], prospects[0])}/stage`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({ stage: 'CERRADO' })
      .expect(200);
    await http()
      .patch(`${base(campaigns[0], prospects[0])}/stage`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({ stage: 'EN_SEGUIMIENTO' })
      .expect(200);

    await http()
      .patch(`${base(campaigns[0], prospects[0])}/evaluation`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({ evaluation: 'NO_APTO', reason: '   ' })
      .expect(400);
    await http()
      .patch(`${base(campaigns[0], prospects[0])}/evaluation`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({ evaluation: 'NO_APTO', reason: 'Synthetic reason' })
      .expect(200);
    await http()
      .patch(`${base(campaigns[0], prospects[0])}/evaluation`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({ evaluation: 'APTO', reason: 'Changed later' })
      .expect(200);

    const original = await http()
      .post(`${base(campaigns[0], prospects[0])}/activities`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({ type: 'CALL', content: 'Original synthetic call' })
      .expect(201);
    await http()
      .post(`${base(campaigns[0], prospects[0])}/activities`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({
        type: 'NOTE',
        content: 'Synthetic correction',
        correctsId: body<{ id: string }>(original).data.id,
      })
      .expect(201);
    const activities = await http()
      .get(`${base(campaigns[0], prospects[0])}/activities?page=1&limit=20`)
      .set('Authorization', `Bearer ${ownerA}`)
      .expect(200);
    expect(body<{ data: unknown[] }>(activities).data.length).toBeGreaterThan(1);

    await http()
      .put(`${base(campaigns[0], prospects[0])}/responsible`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({ responsibleId: users[2] })
      .expect(200);
    await http()
      .delete(`${base(campaigns[0], prospects[0])}/responsible`)
      .set('Authorization', `Bearer ${ownerA}`)
      .expect(200);
    const eligible = await http()
      .get(`${base(campaigns[0], prospects[0])}/responsibles`)
      .set('Authorization', `Bearer ${ownerA}`)
      .expect(200);
    expect(JSON.stringify(eligible.body)).not.toContain(users[1]);

    const filtered = await http()
      .get(
        `/api/v1/campaigns/${campaigns[0]}/prospects?stage=EN_SEGUIMIENTO&evaluation=APTO&page=1&limit=10`,
      )
      .set('Authorization', `Bearer ${ownerA}`)
      .expect(200);
    expect(body<{ id: string }[]>(filtered).data[0].id).toBe(prospects[0]);

    const dashboard = await http()
      .get(`/api/v1/campaigns/${campaigns[0]}/dashboard`)
      .set('Authorization', `Bearer ${ownerA}`)
      .expect(200);
    expect(body<{ total: number; stages: Record<string, number>; evaluations: Record<string, number> }>(dashboard).data).toMatchObject({
      total: 1,
      stages: { EN_SEGUIMIENTO: 1 },
      evaluations: { APTO: 1 },
    });

    const campaignsView = await http()
      .get(`/api/v1/prospects/${prospects[0]}/campaigns`)
      .set('Authorization', `Bearer ${ownerA}`)
      .expect(200);
    expect(body<{ campaigns: unknown[] }>(campaignsView).data.campaigns.length).toBeGreaterThanOrEqual(2);

    const provenance = await http()
      .get(`/api/v1/prospects/${prospects[0]}/provenance`)
      .set('Authorization', `Bearer ${ownerA}`)
      .expect(200);
    expect(body<{ data: unknown[] }>(provenance).data.length).toBeGreaterThan(0);
    expect(
      await db.campaignActivity.count({ where: { tenantId: tenants[1] } }),
    ).toBe(1);
  });
});
