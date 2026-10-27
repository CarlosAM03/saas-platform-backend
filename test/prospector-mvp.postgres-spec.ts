import { mkdirSync, writeFileSync } from 'node:fs';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, createHash } from 'node:crypto';
import { hash as passwordHash } from 'bcrypt';
import { json } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProspectorClientService } from '../src/prospector-client/prospector-client.service';
import { ProspectingJobsService } from '../src/prospecting-jobs/prospecting-jobs.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { PinoLogger } from 'nestjs-pino';
import { SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { deploymentDocument } from '../src/common/openapi/deployment-document';
import { policyFixture } from './support/prospector-policy.fixture';
import { startControlledService } from './support/service-process';

jest.setTimeout(30000);
type Detail = Awaited<ReturnType<ProspectingJobsService['findOne']>>;
const data = <T>(response: { body: unknown }) =>
  (response.body as { data: T }).data;
const cuid = /^c[a-z0-9]{20,}$/;
describe('MVP: real NestJS ↔ FastAPI ↔ controlled EnginePort ↔ PostgreSQL', () => {
  let app: INestApplication,
    prisma: PrismaService,
    config: ConfigService,
    jobs: ProspectingJobsService;
  let service: Awaited<ReturnType<typeof startControlledService>>;
  let backend: string,
    tenantA: string,
    tenantB: string,
    campaignA: string,
    campaignB: string,
    ownerId: string,
    memberId: string;
  let owner: string, member: string, other: string, globalAdmin: string;
  let dispatch: jest.SpiedFunction<ProspectorClientService['startJob']>;
  let warn: jest.SpiedFunction<PinoLogger['warn']>,
    publicWarn: jest.SpiedFunction<Logger['warn']>;
  const envBefore = { ...process.env };
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);
  const payload = (keyword = 'complete', campaignId = campaignA) => ({
    campaignId,
    query: { keyword, location: 'Tijuana', source: 'google_maps', limit: 2 },
  });
  const create = (
    keyword = 'complete',
    key = randomUUID(),
    token = owner,
    campaignId = campaignA,
  ) =>
    http()
      .post('/api/v1/prospecting-jobs')
      .set('Authorization', 'Bearer ' + token)
      .set('Idempotency-Key', key)
      .send(payload(keyword, campaignId));
  const detail = async (id: string, token = owner) =>
    data<Detail>(
      await http()
        .get('/api/v1/prospecting-jobs/' + id)
        .set('Authorization', 'Bearer ' + token)
        .expect(200),
    );
  const post = (
    body: ReturnType<typeof event>,
    key = policyFixture.PROSPECTOR_CALLBACK_API_KEY,
    path = body.jobId,
  ) =>
    http()
      .post('/api/v1/internal/prospecting-jobs/' + path + '/events')
      .set('X-API-Key', key)
      .send(body);
  function event(
    id: string,
    sequence: number,
    status:
      'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' = 'QUEUED',
  ) {
    return {
      jobId: id,
      sequence,
      status,
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      progress: null,
      results:
        status === 'COMPLETED'
          ? ([] as Array<{ name: string; source: string; metadata: null }>)
          : null,
      error:
        status === 'FAILED'
          ? {
              code: 'ENGINE_EXTRACTION_FAILED',
              message: 'Job execution failed',
            }
          : null,
    };
  }
  async function waitTerminal(id: string, token = owner) {
    for (let i = 0; i < 100; i++) {
      const current = await detail(id, token);
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(current.status))
        return current;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Job did not terminate');
  }
  async function fixtureJob() {
    return prisma.prospectingJob.create({
      data: {
        tenantId: tenantA,
        campaignId: campaignA,
        requestedBy: ownerId,
        query: payload().query,
        requestedLimit: 2,
        idempotencyKeyHash: createHash('sha256')
          .update(randomUUID())
          .digest('hex'),
        payloadHash: 'fixture',
        dispatchState: 'PENDING',
        serviceGeneration: policyFixture.PROSPECTOR_SERVICE_GENERATION,
        deadlineAt: new Date(Date.now() + 1800000),
      },
    });
  }
  async function restartService(
    mode: 'normal' | 'early-callback' | 'delayed',
    wrongCallback = false,
  ) {
    await service?.stop();
    service = await startControlledService(
      backend,
      policyFixture.PROSPECTOR_SERVICE_API_KEY,
      wrongCallback
        ? 'wrong-test-callback-key-12345678901234567890'
        : policyFixture.PROSPECTOR_CALLBACK_API_KEY,
      mode,
    );
    config.set('PROSPECTOR_SERVICE_URL', service.origin);
  }
  async function bootBackend() {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    config = app.get(ConfigService);
    for (const [key, value] of Object.entries(policyFixture))
      config.set(key, value);
    app.use(
      '/api/v1/internal/prospecting-jobs',
      json({ limit: 1048576 + 16384 }),
    );
    app.use(json());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(app.get(GlobalExceptionFilter));
    app.useGlobalInterceptors(
      app.get(ResponseInterceptor),
      app.get(LoggingInterceptor),
    );
    warn = jest.spyOn(PinoLogger.prototype, 'warn');
    publicWarn = jest.spyOn(Logger.prototype, 'warn');
    SwaggerModule.setup('api/docs', app, deploymentDocument());
    await app.init();
    await app.listen(0, '127.0.0.1');
    backend = await app.getUrl();
    config.set('PROSPECTOR_CALLBACK_ORIGIN', backend);
    jobs = app.get(ProspectingJobsService);
  }
  beforeAll(async () => {
    if (!process.env.INTEGRATION_TEST_DATABASE_URL)
      throw new Error('Disposable PostgreSQL is required');
    prisma = new PrismaService();
    const tenants = await Promise.all(
      ['A', 'B'].map((name) =>
        prisma.tenant.create({ data: { name, slug: 'mvp-' + randomUUID() } }),
      ),
    );
    [tenantA, tenantB] = tenants.map((tenant) => tenant.id);
    const users = await Promise.all(
      ['owner', 'member'].map(async (name) =>
        prisma.user.create({
          data: {
            name,
            email: randomUUID() + '@test.example',
            passwordHash: await passwordHash('IntegrationTest123!', 4),
          },
        }),
      ),
    );
    [ownerId, memberId] = users.map((user) => user.id);
    for (const tenantId of [tenantA, tenantB]) {
      const roles = await Promise.all(
        (['OWNER', 'MEMBER'] as const).map((name) =>
          prisma.role.create({ data: { tenantId, name } }),
        ),
      );
      await prisma.userTenant.create({
        data: { userId: ownerId, tenantId, roleId: roles[0].id },
      });
      if (tenantId === tenantA)
        await prisma.userTenant.create({
          data: { userId: memberId, tenantId, roleId: roles[1].id },
        });
    }
    const campaigns = await Promise.all(
      [tenantA, tenantB].map((tenantId) =>
        prisma.campaign.create({
          data: { tenantId, createdBy: ownerId, name: 'MVP fixture' },
        }),
      ),
    );
    [campaignA, campaignB] = campaigns.map((campaign) => campaign.id);
    await bootBackend();
    const jwt = app.get(JwtService);
    const token = (
      userId: string,
      tenantId: string | null,
      tenantRole: 'OWNER' | 'MEMBER' | null,
      platformRole: 'ADMIN' | null = null,
    ) =>
      jwt.sign({
        sub: userId,
        email: 'fixture@test.example',
        tenantId,
        tenantRole,
        platformRole,
      });
    owner = token(ownerId, tenantA, 'OWNER');
    member = token(memberId, tenantA, 'MEMBER');
    other = token(ownerId, tenantB, 'OWNER');
    globalAdmin = token(ownerId, null, null, 'ADMIN');
    dispatch = jest.spyOn(app.get(ProspectorClientService), 'startJob');
    await restartService('normal');
  });
  beforeEach(async () => {
    await prisma.prospectingJob.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    for (const [key, value] of Object.entries(policyFixture))
      if (
        !['PROSPECTOR_SERVICE_URL', 'PROSPECTOR_CALLBACK_ORIGIN'].includes(key)
      )
        config.set(key, value);
    dispatch.mockClear();
  });
  afterAll(async () => {
    await service?.stop();
    await app?.close();
    if (prisma) {
      const tenantIds = [tenantA, tenantB].filter(Boolean);
      await prisma.prospectingJob.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      await prisma.campaign.deleteMany({
        where: { id: { in: [campaignA, campaignB].filter(Boolean) } },
      });
      await prisma.userTenant.deleteMany({
        where: { tenantId: { in: tenantIds } },
      });
      await prisma.role.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      await prisma.user.deleteMany({
        where: { id: { in: [ownerId, memberId].filter(Boolean) } },
      });
      await prisma.$disconnect();
    }
    jest.restoreAllMocks();
    for (const key of Object.keys(policyFixture).concat(
      'PROSPECTOR_CALLBACK_ORIGIN',
      'PROSPECTOR_SERVICE_URL',
    )) {
      if (envBefore[key] === undefined) delete process.env[key];
      else process.env[key] = envBefore[key];
    }
  });
  it('executes COMPLETED and FAILED through actual HTTP callbacks and durable PostgreSQL states', async () => {
    const response = await create().expect(201);
    const job = data<Detail>(response);
    expect(job.id).toMatch(cuid);
    const complete = await waitTerminal(job.id);
    expect(complete).toMatchObject({
      status: 'COMPLETED',
      dispatchState: 'ACCEPTED',
      resultsAvailable: true,
      progress: null,
      retryAllowed: true,
    });
    expect(complete.results).toEqual([
      expect.objectContaining({
        name: 'Controlled Cafe',
        sourceIdentifier: null,
        metadata: null,
        phone: '00123',
      }),
    ]);
    expect(
      await prisma.prospectingJobEvent.count({ where: { jobId: job.id } }),
    ).toBe(3);
    const failed = await create('fail', randomUUID(), member).expect(201);
    const failure = await waitTerminal(data<Detail>(failed).id);
    expect(failure).toMatchObject({
      status: 'FAILED',
      failureCode: 'ENGINE_EXTRACTION_FAILED',
      resultsAvailable: false,
      retryAllowed: true,
    });
    expect(await prisma.prospect.count({ where: { tenantId: tenantA } })).toBe(
      0,
    );
  });
  it('preserves COMPLETED when callbacks finish before the delayed 202', async () => {
    await restartService('early-callback');
    const completed = data<Detail>(await create().expect(201));
    expect(completed.status).toBe('COMPLETED');
    expect(completed.resultsAvailable).toBe(true);
    await restartService('normal');
  });
  it('owns idempotency under concurrent HTTP requests, hashes keys and rejects payload conflict', async () => {
    const key = randomUUID();
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => create('complete', key)),
    );
    const ids = responses.map((response) =>
      response.status === 201
        ? data<Detail>(response).id
        : (response.body as { error: { details: { jobId: string } } }).error
            .details.jobId,
    );
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toMatch(cuid);
    expect(dispatch).toHaveBeenCalledTimes(1);
    await waitTerminal(ids[0]);
    expect(data<Detail>(await create('complete', key).expect(201)).id).toBe(
      ids[0],
    );
    await create('empty', key).expect(409);
    const row = await prisma.prospectingJob.findUniqueOrThrow({
      where: { id: ids[0] },
    });
    expect(row.idempotencyKeyHash).toBe(
      createHash('sha256').update(key).digest('hex'),
    );
    expect(JSON.stringify(row)).not.toContain(key);
    expect(
      await prisma.prospectingJob.count({ where: { tenantId: tenantA } }),
    ).toBe(1);
  });
  it('separates the same key by user and tenant, and prevents foreign campaign/result access', async () => {
    const key = randomUUID();
    const first = data<Detail>(await create('complete', key).expect(201));
    await waitTerminal(first.id);
    const second = data<Detail>(
      await create('complete', key, member).expect(201),
    );
    await waitTerminal(second.id);
    const third = data<Detail>(
      await create('complete', key, other, campaignB).expect(201),
    );
    await waitTerminal(third.id, other);
    expect(new Set([first.id, second.id, third.id]).size).toBe(3);
    await http()
      .get('/api/v1/prospecting-jobs/' + first.id)
      .set('Authorization', 'Bearer ' + other)
      .expect(404);
    await create('complete', randomUUID(), owner, campaignB).expect(404);
    await create('complete', randomUUID(), globalAdmin).expect(403);
  });
  it('keeps empty COMPLETED results available and expires/removes only the snapshot', async () => {
    const created = data<Detail>(await create('empty').expect(201));
    expect(await waitTerminal(created.id)).toMatchObject({
      status: 'COMPLETED',
      resultsAvailable: true,
      results: [],
    });
    const expiresAt = new Date(Date.now() - 1000);
    await prisma.prospectingJobSnapshot.update({
      where: { jobId: created.id },
      data: { expiresAt },
    });
    await prisma.prospectingJob.update({
      where: { id: created.id },
      data: { resultsExpiresAt: expiresAt },
    });
    expect(await detail(created.id)).toMatchObject({
      status: 'COMPLETED',
      resultsAvailable: false,
      results: null,
    });
    expect(
      await prisma.prospectingJobSnapshot.count({
        where: { jobId: created.id },
      }),
    ).toBe(0);
    expect(
      await prisma.prospectingJob.count({ where: { id: created.id } }),
    ).toBe(1);
  });
  it('authenticates callbacks, commits duplicates once and rejects regressions/collisions', async () => {
    const job = await fixtureJob();
    const queued = event(job.id, 1);
    await post(queued, 'wrong').expect(401);
    await post(queued).expect(200);
    const written = await prisma.prospectingJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    for (const response of await Promise.all(
      Array.from({ length: 4 }, () => post(queued)),
    ))
      expect(response.status).toBe(200);
    expect(
      await prisma.prospectingJobEvent.count({ where: { jobId: job.id } }),
    ).toBe(1);
    expect(
      (await prisma.prospectingJob.findUniqueOrThrow({ where: { id: job.id } }))
        .updatedAt,
    ).toEqual(written.updatedAt);
    await post({ ...queued, status: 'RUNNING' }).expect(409);
    await post(event(job.id, 2, 'RUNNING')).expect(200);
    await post(event(job.id, 1)).expect(409);
    await post(event(job.id, 3, 'COMPLETED')).expect(200);
    await post(event(job.id, 4, 'RUNNING')).expect(409);
    await post(
      { ...event(job.id, 4), jobId: campaignA },
      policyFixture.PROSPECTOR_CALLBACK_API_KEY,
      job.id,
    ).expect(400);
  });
  it('rolls back oversize/cardinality/invalid lifecycle payloads and accepts a valid final event afterwards', async () => {
    const job = await fixtureJob();
    const tooMany = event(job.id, 1, 'COMPLETED');
    tooMany.results = Array.from({ length: 3 }, () => ({
      name: 'x',
      source: 'google_maps',
      metadata: null,
    }));
    await post(tooMany).expect(400);
    config.set('PROSPECTOR_MAX_RESULT_BYTES', '1024');
    const tooBig = event(job.id, 1, 'COMPLETED');
    tooBig.results = [
      { name: 'x'.repeat(1500), source: 'google_maps', metadata: null },
    ];
    await post(tooBig).expect(400);
    await post({ ...event(job.id, 1), results: [] }).expect(400);
    expect(
      await prisma.prospectingJobEvent.count({ where: { jobId: job.id } }),
    ).toBe(0);
    expect(
      await prisma.prospectingJobSnapshot.count({ where: { jobId: job.id } }),
    ).toBe(0);
    await post(event(job.id, 3, 'COMPLETED')).expect(200); // Earlier deliveries may have been lost.
    expect(await detail(job.id)).toMatchObject({
      status: 'COMPLETED',
      results: [],
      resultsAvailable: true,
    });
  });
  it('enforces per-tenant/global budgets and active capacity transactionally', async () => {
    config.set('PROSPECTOR_TENANT_JOBS_PER_PERIOD', '1');
    config.set('PROSPECTOR_GLOBAL_JOBS_PER_PERIOD', '1');
    const first = data<Detail>(await create().expect(201));
    await waitTerminal(first.id);
    const tenant = await create();
    expect(tenant.status).toBe(429);
    expect(tenant.body as unknown).toMatchObject({
      error: { details: { reason: 'TENANT_QUOTA_EXHAUSTED' } },
    });
    const global = await create('complete', randomUUID(), other, campaignB);
    expect(global.status).toBe(429);
    expect(global.body as unknown).toMatchObject({
      error: { details: { reason: 'GLOBAL_QUOTA_EXHAUSTED' } },
    });
    expect(
      data<{ create: boolean }>(
        await http()
          .get('/api/v1/prospecting-jobs/capabilities')
          .set('Authorization', 'Bearer ' + owner)
          .expect(200),
      ).create,
    ).toBe(false);
  });
  it('reserves a single active slot under distinct concurrent intentions', async () => {
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => create('slow')),
    );
    expect(
      responses.filter((response) => response.status === 201),
    ).toHaveLength(1);
    expect(
      responses.filter((response) => response.status === 503),
    ).toHaveLength(3);
    expect(dispatch).toHaveBeenCalledTimes(1);
    await waitTerminal(
      data<Detail>(responses.find((response) => response.status === 201)!).id,
    );
  });
  it('does not resend uncertain dispatch, quarantines timeout and permits a new intention only after verified restart', async () => {
    await restartService('delayed', true);
    config.set('PROSPECTOR_HTTP_TIMEOUT_MS', '100');
    const key = randomUUID();
    const uncertain = await create('complete', key).expect(503);
    const id = (uncertain.body as { error: { details: { jobId: string } } })
      .error.details.jobId;
    expect(await detail(id)).toMatchObject({
      status: 'QUEUED',
      dispatchState: 'UNCERTAIN',
      retryAllowed: false,
    });
    await create('complete', key).expect(503);
    expect(dispatch).toHaveBeenCalledTimes(1);
    await prisma.prospectingJob.update({
      where: { id },
      data: { deadlineAt: new Date(Date.now() - 1000) },
    });
    await jobs.reconcile();
    expect(await detail(id)).toMatchObject({
      status: 'FAILED',
      failureCode: 'FINAL_EVENT_TIMEOUT',
      retryAllowed: false,
    });
    expect(
      data<{ create: boolean }>(
        await http()
          .get('/api/v1/prospecting-jobs/capabilities')
          .set('Authorization', 'Bearer ' + owner),
      ).create,
    ).toBe(false);
    await restartService('normal');
    config.set('PROSPECTOR_SERVICE_GENERATION', 'verified-restart-test-2');
    config.set('PROSPECTOR_HTTP_TIMEOUT_MS', '1000');
    await jobs.reconcile();
    expect((await detail(id)).retryAllowed).toBe(true);
    const fresh = data<Detail>(await create('complete').expect(201));
    expect(fresh.id).not.toBe(id);
    await waitTerminal(fresh.id);
  });
  it('records a late terminal acknowledgement without reviving the operationally failed Job', async () => {
    const job = await fixtureJob();
    await prisma.prospectingJob.update({
      where: { id: job.id },
      data: { deadlineAt: new Date(Date.now() - 1000) },
    });
    await jobs.reconcile();
    await post(event(job.id, 3, 'COMPLETED')).expect(200);
    expect(await detail(job.id)).toMatchObject({
      status: 'FAILED',
      failureCode: 'FINAL_EVENT_TIMEOUT',
      resultsAvailable: false,
      retryAllowed: true,
    });
    expect(
      await prisma.prospectingJobSnapshot.count({ where: { jobId: job.id } }),
    ).toBe(0);
  });
  it('keeps cancel/persist/export disabled and validates payloads without any Service execution', async () => {
    for (const query of [
      { keyword: ' ', location: 'x', source: 'google_maps', limit: 1 },
      { keyword: 'x', location: 'x', source: 'other', limit: 1 },
      { keyword: 'x', location: 'x', source: 'google_maps', limit: 101 },
      { keyword: 'x', location: 'x', source: 'google_maps', limit: true },
    ]) {
      await http()
        .post('/api/v1/prospecting-jobs')
        .set('Authorization', 'Bearer ' + owner)
        .set('Idempotency-Key', randomUUID())
        .send({ campaignId: campaignA, query })
        .expect(400);
    }
    await http().post('/api/v1/prospecting-jobs').send(payload()).expect(401);
    for (const path of ['/cancel', '/persist'])
      await http()
        .post('/api/v1/prospecting-jobs/' + campaignA + path)
        .set('Authorization', 'Bearer ' + owner)
        .expect(503);
    await http()
      .get('/api/v1/prospecting-jobs/' + campaignA + '/export?format=csv')
      .set('Authorization', 'Bearer ' + owner)
      .expect(503);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('serves the implemented contract and verifies capabilities against the live Service', async () => {
    const spec = (await http().get('/api/docs-json').expect(200))
      .body as OpenAPIObject;
    expect(spec.info.version).toBe('1.1.0');
    mkdirSync('.tmp', { recursive: true });
    writeFileSync(
      '.tmp/platform-api.served.json',
      JSON.stringify(spec, null, 2) + '\n',
    );
    expect(
      spec.paths['/api/v1/prospecting-jobs'].post!.responses['201'],
    ).toBeDefined();
    expect(
      spec.paths['/api/v1/prospecting-jobs/{id}/persist'].post!.responses[
        '200'
      ],
    ).toBeUndefined();
    const caps = data<unknown>(
      await http()
        .get('/api/v1/prospecting-jobs/capabilities')
        .set('Authorization', 'Bearer ' + owner)
        .expect(200),
    );
    expect(caps).toMatchObject({
      contractVersion: 'prospector-mvp-v1',
      create: true,
      cancel: false,
      persist: false,
      export: false,
      maxLimit: 100,
      resultsTtlSeconds: 3600,
    });
    config.set('PROSPECTOR_ENABLED', 'false');
    await create().expect(503);
    expect(
      await prisma.prospectingJob.count({ where: { tenantId: tenantA } }),
    ).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
    config.set('PROSPECTOR_ENABLED', 'true');
    config.set('PROSPECTOR_SERVICE_URL', 'http://127.0.0.1:1');
    await create().expect(503);
    expect(dispatch).not.toHaveBeenCalled();
    config.set('PROSPECTOR_SERVICE_URL', service.origin);
  });
  it('maps real internal 401 to user-facing 503 and treats Service duplicate 409 as uncertain', async () => {
    config.set(
      'PROSPECTOR_SERVICE_API_KEY',
      'invalid-outbound-test-key-1234567890',
    );
    const rejected = await create().expect(503);
    const id = (rejected.body as { error: { details: { jobId: string } } })
      .error.details.jobId;
    expect(await detail(id)).toMatchObject({
      status: 'FAILED',
      dispatchState: 'REJECTED',
      failureCode: 'UPSTREAM_401',
      retryAllowed: true,
    });
    config.set(
      'PROSPECTOR_SERVICE_API_KEY',
      policyFixture.PROSPECTOR_SERVICE_API_KEY,
    );
    const job = data<Detail>(await create().expect(201));
    await waitTerminal(job.id);
    await expect(
      app.get(ProspectorClientService).startJob({
        jobId: job.id,
        tenantId: tenantA,
        query: payload().query as {
          keyword: string;
          location: string;
          source: 'google_maps';
          limit: number;
        },
        callbackUrl:
          backend + '/api/v1/internal/prospecting-jobs/' + job.id + '/events',
      }),
    ).rejects.toMatchObject({
      kind: 'UPSTREAM_409',
      definitiveRejection: false,
    });
  });
  it('enforces live campaign and membership authority before allocating a Job', async () => {
    await prisma.campaign.update({
      where: { id: campaignA },
      data: { status: 'PAUSADA' },
    });
    await create().expect(409);
    await prisma.campaign.update({
      where: { id: campaignA },
      data: { status: 'ACTIVA' },
    });
    await prisma.tenant.update({
      where: { id: tenantA },
      data: { status: 'SUSPENDIDO' },
    });
    await create().expect(403);
    await prisma.tenant.update({
      where: { id: tenantA },
      data: { status: 'ACTIVO' },
    });
    const membership = await prisma.userTenant.findUniqueOrThrow({
      where: { userId_tenantId: { userId: memberId, tenantId: tenantA } },
    });
    await prisma.userTenant.delete({
      where: { userId_tenantId: { userId: memberId, tenantId: tenantA } },
    });
    await create('complete', randomUUID(), member).expect(403);
    await prisma.userTenant.create({ data: membership });
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('rolls back snapshot capacity rejection and enforces the physical unique constraint', async () => {
    config.set('PROSPECTOR_MAX_RESULT_BYTES', '1024');
    config.set('PROSPECTOR_MAX_TOTAL_RESULT_BYTES', '1024');
    const first = await fixtureJob();
    const second = await fixtureJob();
    const complete = event(first.id, 3, 'COMPLETED');
    complete.results = [
      { name: 'x'.repeat(650), source: 'google_maps', metadata: null },
    ];
    await post(complete).expect(200);
    await post({ ...complete, jobId: second.id, eventId: randomUUID() }).expect(
      503,
    );
    expect(
      (
        await prisma.prospectingJob.findUniqueOrThrow({
          where: { id: second.id },
        })
      ).lastSequence,
    ).toBe(0);
    expect(
      await prisma.prospectingJobEvent.count({ where: { jobId: second.id } }),
    ).toBe(0);
    expect(
      await prisma.prospectingJobSnapshot.count({
        where: { jobId: second.id },
      }),
    ).toBe(0);
    const { id: _id, ...duplicate } = first;
    void _id;
    await expect(
      prisma.prospectingJob.create({
        data: { ...duplicate, query: payload().query },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await post(event(second.id, 3, 'COMPLETED')).expect(200);
  });
  it('bounds the HTTP envelope before processing and persists results/deadlines across a Backend restart', async () => {
    await http()
      .post('/api/v1/internal/prospecting-jobs/' + campaignA + '/events')
      .set('X-API-Key', policyFixture.PROSPECTOR_CALLBACK_API_KEY)
      .send({ padding: 'x'.repeat(1070000) })
      .expect(413);
    const completed = data<Detail>(await create().expect(201));
    await waitTerminal(completed.id);
    const orphan = await fixtureJob();
    await prisma.prospectingJob.update({
      where: { id: orphan.id },
      data: { deadlineAt: new Date(Date.now() - 1000) },
    });
    await app.close();
    await bootBackend();
    expect(await detail(completed.id)).toMatchObject({
      status: 'COMPLETED',
      resultsAvailable: true,
    });
    expect(await detail(orphan.id)).toMatchObject({
      status: 'FAILED',
      failureCode: 'FINAL_EVENT_TIMEOUT',
      retryAllowed: false,
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    await restartService('normal');
  });
  it('does not write internal credentials into Backend logs', () => {
    const output = JSON.stringify([warn.mock.calls, publicWarn.mock.calls]);
    expect(output).not.toContain(policyFixture.PROSPECTOR_SERVICE_API_KEY);
    expect(output).not.toContain(policyFixture.PROSPECTOR_CALLBACK_API_KEY);
  });
});
