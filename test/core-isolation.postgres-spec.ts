import { JwtService } from '@nestjs/jwt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { hash } from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { ProspectorClientService } from '../src/prospector-client/prospector-client.service';

jest.setTimeout(60000);
const data = <T>(r: { body: object }) => (r.body as { data: T }).data;
type Actor = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  platformRole: string | null;
};
describe('Core MVP without Service: real PostgreSQL and independent A/B tenants', () => {
  let app: INestApplication, db: PrismaService;
  const tenantIds: string[] = [],
    userIds: string[] = [];
  let a: string,
    b: string,
    ca: string,
    cb: string,
    pa: string,
    pb: string,
    ja: string,
    jb: string;
  let ownerA: Actor,
    memberA: Actor,
    ownerB: Actor,
    memberB: Actor,
    shared: Actor,
    admin: Actor;
  let oa: string, ma: string, ob: string, mb: string, ga: string, aa: string;
  let out: jest.SpiedFunction<ProspectorClientService['startJob']>,
    ready: jest.SpiedFunction<ProspectorClientService['assertReady']>;
  const password = 'IsolatedAuditOnly123!';
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);
  const get = (path: string, token = oa) =>
    http()
      .get('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token);
  const patch = (path: string, body: object, token = oa) =>
    http()
      .patch('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token)
      .send(body);
  const post = (path: string, body: object, token = oa) =>
    http()
      .post('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token)
      .send(body);
  const del = (path: string, token = oa) =>
    http()
      .delete('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token);
  async function login(user: Actor) {
    return data<{ accessToken: string; currentTenantId: string | null }>(
      await http()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password })
        .expect(200),
    );
  }
  async function select(token: string, id: string) {
    return data<{ accessToken: string }>(
      await post('/auth/select-tenant', { tenantId: id }, token).expect(200),
    ).accessToken;
  }
  const preview = (file: Buffer, campaign = ca, token = oa) =>
    http()
      .post('/api/v1/prospects/import/preview')
      .set('Authorization', 'Bearer ' + token)
      .field('campaignId', campaign)
      .attach('file', file, 'audit.csv');
  const confirm = (
    file: Buffer,
    reference: string,
    decisions: unknown[],
    campaign = ca,
    token = oa,
  ) =>
    http()
      .post('/api/v1/prospects/import/confirm')
      .set('Authorization', 'Bearer ' + token)
      .field('campaignId', campaign)
      .field('previewReference', reference)
      .field('decisions', JSON.stringify(decisions))
      .attach('file', file, 'audit.csv');
  beforeAll(async () => {
    if (!process.env.INTEGRATION_TEST_DATABASE_URL)
      throw Error('Disposable PostgreSQL required');
    for (const key of Object.keys(process.env))
      if (key.startsWith('PROSPECTOR_')) delete process.env[key];
    db = new PrismaService();
    for (const label of ['A', 'B']) {
      const t = await db.tenant.create({
        data: { name: 'Audit ' + label, slug: 'audit-' + randomUUID() },
      });
      tenantIds.push(t.id);
      for (const name of ['OWNER', 'MEMBER'] as const)
        await db.role.create({ data: { tenantId: t.id, name } });
    }
    [a, b] = tenantIds;
    const users: Actor[] = [];
    for (const name of [
      'Owner A',
      'Member A',
      'Owner B',
      'Member B',
      'Shared member',
      'Global admin',
    ]) {
      const u = await db.user.create({
        data: {
          name,
          email: randomUUID() + '@test.example',
          passwordHash: await hash(password, 4),
          platformRole: name === 'Global admin' ? 'ADMIN' : null,
        },
      });
      users.push(u);
      userIds.push(u.id);
    }
    [ownerA, memberA, ownerB, memberB, shared, admin] = users;
    for (const [user, tenant, name] of [
      [ownerA, a, 'OWNER'],
      [memberA, a, 'MEMBER'],
      [ownerB, b, 'OWNER'],
      [memberB, b, 'MEMBER'],
      [shared, a, 'MEMBER'],
      [shared, b, 'MEMBER'],
      [admin, a, 'MEMBER'],
    ] as const) {
      const role = await db.role.findUniqueOrThrow({
        where: { tenantId_name: { tenantId: tenant, name } },
      });
      await db.userTenant.create({
        data: { userId: user.id, tenantId: tenant, roleId: role.id },
      });
    }
    const campaigns = await Promise.all(
      [a, b].map((tenantId, i) =>
        db.campaign.create({
          data: {
            tenantId,
            createdBy: i === 0 ? ownerA.id : ownerB.id,
            name: 'Private campaign ' + i,
          },
        }),
      ),
    );
    [ca, cb] = campaigns.map((c) => c.id);
    const prospects = await Promise.all(
      campaigns.map((c, i) =>
        db.prospect.create({
          data: {
            tenantId: c.tenantId,
            campaignId: c.id,
            name: 'Private prospect ' + i,
            source: 'manual',
            sourceIdentifier: null,
          },
        }),
      ),
    );
    [pa, pb] = prospects.map((p) => p.id);
    for (const p of prospects)
      await db.campaignProspect.create({
        data: { campaignId: p.campaignId, prospectId: p.id },
      });
    const jobs = await Promise.all(
      campaigns.map((c, i) =>
        db.prospectingJob.create({
          data: {
            tenantId: c.tenantId,
            campaignId: c.id,
            requestedBy: i === 0 ? ownerA.id : ownerB.id,
            status: 'COMPLETED',
            query: {
              keyword: 'controlled',
              location: 'test',
              source: 'google_maps',
              limit: 1,
            },
            dispatchState: 'ACCEPTED',
            resultsExpiresAt: new Date(Date.now() + 3600000),
            snapshot: {
              create: {
                results: [
                  {
                    name: 'Private snapshot ' + i,
                    source: 'google_maps',
                    metadata: null,
                  },
                ],
                bytes: 100,
                expiresAt: new Date(Date.now() + 3600000),
              },
            },
          },
        }),
      ),
    );
    [ja, jb] = jobs.map((j) => j.id);
    const cfg = new ConfigService({
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_URL: process.env.INTEGRATION_TEST_DATABASE_URL,
      JWT_SECRET: 'isolated-core-audit-secret-not-for-deployment',
      JWT_EXPIRES_IN: '8h',
      CORS_ORIGINS: 'http://localhost:4200',
      PROSPECTOR_ENABLED: 'false',
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(ConfigService)
      .useValue(cfg)
      .compile();
    app = module.createNestApplication();
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
    out = jest.spyOn(app.get(ProspectorClientService), 'startJob');
    ready = jest.spyOn(app.get(ProspectorClientService), 'assertReady');
    oa = (await login(ownerA)).accessToken;
    ma = (await login(memberA)).accessToken;
    ob = (await login(ownerB)).accessToken;
    mb = (await login(memberB)).accessToken;
    ga = (await login(admin)).accessToken;
    aa = await select(ga, a);
  });
  it('allows tenant-local role changes for a shared user without changing B', async () => {
    const before = await db.userTenant.findUniqueOrThrow({
      where: { userId_tenantId: { userId: shared.id, tenantId: b } },
    });
    const role = await db.role.findUniqueOrThrow({
      where: { tenantId_name: { tenantId: a, name: 'OWNER' } },
    });
    await patch('/users/' + shared.id, { roleId: role.id }).expect(200);
    const after = await db.userTenant.findUniqueOrThrow({
      where: { userId_tenantId: { userId: shared.id, tenantId: b } },
    });
    expect(after).toEqual(before);
    await db.userTenant.update({
      where: { userId_tenantId: { userId: shared.id, tenantId: a } },
      data: {
        roleId: (
          await db.role.findUniqueOrThrow({
            where: { tenantId_name: { tenantId: a, name: 'MEMBER' } },
          })
        ).id,
      },
    });
  });
  afterAll(async () => {
    await app?.close();
    if (db) {
      const where = { tenantId: { in: tenantIds } };
      await db.prospectingJob.deleteMany({ where });
      await db.campaignProspect.deleteMany({ where: { campaign: where } });
      await db.prospect.deleteMany({ where });
      await db.campaign.deleteMany({ where });
      await db.userTenant.deleteMany({ where });
      await db.role.deleteMany({ where });
      await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.$disconnect();
    }
    jest.restoreAllMocks();
  });
  it('P0 revoked membership cannot continue reading with a previously issued JWT', async () => {
    const where = { userId_tenantId: { userId: ownerA.id, tenantId: a } };
    const membership = await db.userTenant.findUniqueOrThrow({ where });
    await db.userTenant.delete({ where });
    try {
      await get('/campaigns', oa).expect(401);
    } finally {
      await db.userTenant.create({ data: membership });
    }
  });
  it('P0 downgraded role and suspended tenant invalidate prior authorization claims', async () => {
    const where = { userId_tenantId: { userId: ownerA.id, tenantId: a } };
    const original = await db.userTenant.findUniqueOrThrow({ where });
    const role = await db.role.findUniqueOrThrow({
      where: { tenantId_name: { tenantId: a, name: 'MEMBER' } },
    });
    await db.userTenant.update({ where, data: { roleId: role.id } });
    try {
      await post(
        '/prospects',
        { campaignId: ca, name: 'must not be created' },
        oa,
      ).expect(401);
    } finally {
      await db.userTenant.update({ where, data: { roleId: original.roleId } });
    }
    await db.tenant.update({
      where: { id: a },
      data: { status: 'SUSPENDIDO' },
    });
    try {
      await get('/prospects', oa).expect(401);
    } finally {
      await db.tenant.update({ where: { id: a }, data: { status: 'ACTIVO' } });
    }
  });
  it('P0 revoked ADMIN cannot retain platform authority in an old token', async () => {
    await db.user.update({
      where: { id: admin.id },
      data: { platformRole: null },
    });
    try {
      await post(
        '/tenants',
        { name: 'must not be created', slug: 'forbidden-' + randomUUID() },
        ga,
      ).expect(401);
    } finally {
      await db.user.update({
        where: { id: admin.id },
        data: { platformRole: 'ADMIN' },
      });
    }
  });
  it('P0 OWNER cannot overwrite a global ADMIN identity through a local membership', async () => {
    try {
      await patch(
        '/users/' + admin.id,
        { password: 'OwnerMustNotResetAdmin123!' },
        oa,
      ).expect(403);
    } finally {
      await db.user.update({
        where: { id: admin.id },
        data: { passwordHash: admin.passwordHash },
      });
    }
  });
  it('P0 OWNER cannot overwrite a shared identity belonging to another tenant', async () => {
    try {
      await patch(
        '/users/' + shared.id,
        { name: 'Cross-tenant identity mutation' },
        oa,
      ).expect(403);
    } finally {
      await db.user.update({
        where: { id: shared.id },
        data: { name: shared.name },
      });
    }
  });
  it('isolates resource GETs and authenticated lists/counts for both independent tenants', async () => {
    for (const [
      token,
      foreignUser,
      foreignCampaign,
      foreignProspect,
      foreignJob,
    ] of [
      [oa, ownerB.id, cb, pb, jb],
      [ob, ownerA.id, ca, pa, ja],
    ]) {
      for (const path of [
        '/users/' + foreignUser,
        '/campaigns/' + foreignCampaign,
        '/campaigns/' + foreignCampaign + '/prospects',
        '/prospects/' + foreignProspect,
        '/prospecting-jobs/' + foreignJob,
      ]) {
        const r = await get(path, token).expect(404);
        expect(JSON.stringify(r.body)).not.toContain('Private');
      }
      for (const [path, excluded] of [
        ['/users', foreignUser],
        ['/campaigns', foreignCampaign],
        ['/prospects', foreignProspect],
        ['/prospecting-jobs', foreignJob],
      ]) {
        const r = await get(path, token).expect(200);
        expect(JSON.stringify(r.body)).not.toContain(excluded);
      }
    }
    await get('/campaigns?search=Private&page=1&limit=1', oa).expect((r) => {
      expect((r.body as { meta: { total: number } }).meta.total).toBe(1);
    });
  });
  it('rejects cross-tenant PATCH, DELETE, role references and campaign associations without writes', async () => {
    await patch('/campaigns/' + cb, { name: 'forbidden' }, oa).expect(404);
    await del('/campaigns/' + cb, oa).expect(404);
    await del('/campaigns/' + cb + '?permanent=true', aa).expect(404);
    await patch('/prospects/' + pb, { name: 'forbidden' }, oa).expect(404);
    await patch('/users/' + ownerB.id, { name: 'forbidden' }, oa).expect(404);
    await del('/users/' + ownerB.id, aa).expect(404);
    const roleB = await db.role.findUniqueOrThrow({
      where: { tenantId_name: { tenantId: b, name: 'OWNER' } },
    });
    await patch('/users/' + memberA.id, { roleId: roleB.id }, oa).expect(404);
    await post('/prospects', { campaignId: cb, name: 'forbidden' }, oa).expect(
      404,
    );
    await post('/campaigns', { name: 'forbidden', tenantId: b }, oa).expect(
      400,
    );
    await post(
      '/prospects',
      { campaignId: ca, name: 'forbidden', tenantId: b },
      oa,
    ).expect(400);
  });
  it('protects MEMBER operations and ADMIN requires selected tenant for domain routes', async () => {
    for (const token of [ma, mb]) {
      await post(
        '/users',
        { name: 'forbidden', email: randomUUID() + '@test.example', password },
        token,
      ).expect(403);
      await post(
        '/prospects',
        { campaignId: ca, name: 'forbidden' },
        token,
      ).expect(403);
      await del('/users/' + memberA.id, token).expect(403);
      await preview(Buffer.from('name\nSynthetic\n'), ca, token).expect(403);
    }
    for (const path of [
      '/users',
      '/campaigns',
      '/prospects',
      '/prospecting-jobs',
    ])
      await get(path, ga).expect(403);
    await post('/auth/select-tenant', { tenantId: b }, oa).expect(403);
  });
  it('supports contractual core CRUD with Service credentials absent', async () => {
    await http().get('/api/v1/health/live').expect(200);
    await http().get('/api/v1/health/ready').expect(200);
    const created = data<{ id: string }>(
      await post(
        '/users',
        {
          name: 'Synthetic new user',
          email: randomUUID() + '@test.example',
          password,
        },
        oa,
      ).expect(201),
    );
    userIds.push(created.id);
    await patch(
      '/users/' + created.id,
      { name: 'Synthetic edited' },
      oa,
    ).expect(200);
    await del('/users/' + created.id, oa).expect(403);
    await del('/users/' + created.id, aa).expect(200);
    const campaign = data<{ id: string }>(
      await post('/campaigns', { name: 'Synthetic new campaign' }, ma).expect(
        201,
      ),
    );
    await patch(
      '/campaigns/' + campaign.id,
      { description: null, status: 'PAUSADA' },
      oa,
    ).expect(200);
    await del('/campaigns/' + campaign.id, oa).expect(200);
    await del('/campaigns/' + campaign.id + '?permanent=true', aa).expect(200);
    const p = data<{ id: string }>(
      await post(
        '/prospects',
        { campaignId: ca, name: 'Synthetic manual' },
        oa,
      ).expect(201),
    );
    await patch(
      '/prospects/' + p.id,
      { category: null, phone: '00123' },
      ma,
    ).expect(200);
    await get('/prospects/' + p.id, ob).expect(404);
    const t = data<{ id: string }>(
      await post(
        '/tenants',
        { name: 'Synthetic new tenant', slug: 'audit-' + randomUUID() },
        ga,
      ).expect(201),
    );
    tenantIds.push(t.id);
    await get('/tenants/' + t.id, ga).expect(200);
    await get('/tenants/' + t.id, oa).expect(404);
  });
  it('preserves old JWT tenant scope across a legitimate switch without granting foreign resources', async () => {
    const loginShared = {
      accessToken: app.get(JwtService).sign({
        sub: shared.id,
        email: shared.email,
        platformRole: null,
        tenantId: null,
        tenantRole: null,
      }),
    };
    const oldA = await select(loginShared.accessToken, a);
    const currentB = await select(oldA, b);
    await get('/prospects/' + pa, currentB).expect(404);
    await get('/prospects/' + pb, oldA).expect(404);
    await get('/prospects/' + pa, oldA).expect(200);
    await get('/prospects/' + pb, currentB).expect(200);
  });
  it('isolates snapshots and denies callbacks without any internal credential', async () => {
    const j = data<{ results: { name: string }[] }>(
      await get('/prospecting-jobs/' + ja, oa).expect(200),
    );
    expect(j.results[0].name).toBe('Private snapshot 0');
    await get('/prospecting-jobs/' + ja, ob).expect(404);
    await http()
      .post('/api/v1/internal/prospecting-jobs/' + ja + '/events')
      .set('X-API-Key', 'not-configured')
      .send({})
      .expect(401);
  });
  it('disabled capabilities and direct creation cannot invoke Service or create a fictitious Job', async () => {
    expect(
      data<unknown>(await get('/prospecting-jobs/capabilities').expect(200)),
    ).toMatchObject({
      create: false,
      cancel: false,
      persist: false,
      export: false,
    });
    const before = await db.prospectingJob.count();
    await http()
      .post('/api/v1/prospecting-jobs')
      .set('Authorization', 'Bearer ' + oa)
      .set('Idempotency-Key', randomUUID())
      .send({
        campaignId: ca,
        query: {
          keyword: 'test',
          location: 'test',
          source: 'google_maps',
          limit: 1,
        },
      })
      .expect(503);
    expect(await db.prospectingJob.count()).toBe(before);
    expect(out).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
  });
  it('binds CSV preview to user, tenant, campaign and exact bytes', async () => {
    const file = Buffer.from('name\nSynthetic binding\n');
    const p = data<{ previewReference: string }>(
      await preview(file).expect(200),
    );
    const decisions = [{ record: 1, action: 'CREATE' }];
    await preview(file, cb, oa).expect(404);
    await confirm(file, p.previewReference, decisions, cb, ob).expect(400);
    await confirm(file, p.previewReference, decisions, ca, aa).expect(400);
    await confirm(
      Buffer.from('name\nChanged bytes\n'),
      p.previewReference,
      decisions,
    ).expect(400);
  });
  it('imports a synthetic 600-row batch transactionally and rejects repeated confirmation', async () => {
    const file = readFileSync('Docs/examples/prospects-demo-600.csv');
    const before = await db.prospect.count({ where: { tenantId: a } });
    const p = data<{
      previewReference: string;
      rows: { record: number; classification: string }[];
      summary: { total: number; new: number };
    }>(await preview(file).expect(200));
    expect(p.summary).toMatchObject({ total: 600, new: 600 });
    expect(p.rows.every((r) => r.classification === 'NEW')).toBe(true);
    const decisions = p.rows.map((r) => ({
      record: r.record,
      action: 'CREATE',
    }));
    const confirmed = data<{ summary: { created: number } }>(
      await confirm(file, p.previewReference, decisions).expect(200),
    );
    expect(confirmed.summary.created).toBe(600);
    expect(await db.prospect.count({ where: { tenantId: a } })).toBe(
      before + 600,
    );
    await confirm(file, p.previewReference, decisions).expect(409);
    expect(await db.prospect.count({ where: { tenantId: a } })).toBe(
      before + 600,
    );
    await get('/prospects?limit=1', ob).expect((r) =>
      expect((r.body as { meta: { total: number } }).meta.total).toBe(1),
    );
    mkdirSync('.tmp', { recursive: true });
    writeFileSync(
      '.tmp/core-isolation-evidence.json',
      JSON.stringify(
        {
          tenantA: a,
          tenantB: b,
          syntheticCsvRows: 600,
          csvCreated: 600,
          noServiceCalls: true,
          postgres: true,
        },
        null,
        2,
      ),
    );
  });
  it('classifies malformed values, duplicates and conflicts without silently dropping rows', async () => {
    const file = Buffer.from(
      'name,email,website,status\nRepeated,,https://example.com,ACTIVO\n repeated ,,https://example.com,ACTIVO\nBad,invalid,missing-protocol,UNKNOWN\nPrivate prospect 0,,,ACTIVO\n',
    );
    const p = data<{
      summary: { total: number; invalid: number; matches: number };
      rows: { record: number }[];
    }>(await preview(file).expect(200));
    expect(p.summary).toMatchObject({ total: 4, invalid: 3, matches: 1 });
    expect(p.rows).toHaveLength(4);
  });
});
