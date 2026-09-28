import {
  INestApplication,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import request from 'supertest';
import { Workbook } from 'exceljs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { ProspectorClientService } from '../src/prospector-client/prospector-client.service';
import type { StartProspectingJobRequest } from '../src/prospector-client/dto/start-prospecting-job.request';
import type {
  BusinessResult,
  JobEventRequest,
} from '../src/prospector-client/dto/job-event.request';
import { ProspectingJobsService } from '../src/prospecting-jobs/prospecting-jobs.service';
import { ProspectsService } from '../src/prospects/prospects.service';
import { JobMemoryService } from '../src/prospecting-jobs/services/job-memory.service';
import { TenantContextService } from '../src/common/context/tenant-context.service';
import { ConfigService } from '@nestjs/config';
import { CampaignsService } from '../src/campaigns/campaigns.service';
import { JobExportService } from '../src/prospecting-jobs/services/job-export.service';

type Job = Awaited<ReturnType<ProspectingJobsService['findOne']>>;
function data<T>(response: { body: unknown }): T {
  return (response.body as { data: T }).data;
}

describe('Functional modules with PostgreSQL (isolated fixtures)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantA: string;
  let tenantB: string;
  let campaignA: string;
  let campaignB: string;
  let userId: string;
  let memberId: string;
  let owner: string;
  let member: string;
  let other: string;
  let admin: string;
  let globalAdmin: string;
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  const client = {
    startJob: jest.fn((body: StartProspectingJobRequest) =>
      Promise.resolve({
        jobId: body.jobId,
        status: 'QUEUED' as const,
        acceptedAt: new Date().toISOString(),
      }),
    ),
    cancelJob: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  };
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);
  const auth = () => `Bearer ${owner}`;
  const payload = () => ({
    campaignId: campaignA,
    query: {
      keyword: 'restaurants',
      location: 'Tijuana',
      source: 'google_maps',
      limit: 20,
    },
  });
  const result = (overrides: Partial<BusinessResult> = {}): BusinessResult => ({
    name: 'Restaurant',
    source: 'google_maps',
    sourceIdentifier: 'maps-1',
    email: 'hello@example.com',
    ...overrides,
  });

  async function boot() {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ProspectorClientService)
      .useValue(client)
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
  }

  beforeAll(() => {
    if (!process.env.JOBS_TEST_DATABASE_URL)
      throw new Error(
        'Set JOBS_TEST_DATABASE_URL to a migrated disposable PostgreSQL database',
      );
    prisma = new PrismaService();
  });

  beforeEach(async () => {
    client.startJob.mockClear();
    client.cancelJob.mockClear();
    const tenants = await Promise.all(
      ['A', 'B'].map((name) =>
        prisma.tenant.create({ data: { name, slug: `test-${randomUUID()}` } }),
      ),
    );
    tenantA = tenants[0].id;
    tenantB = tenants[1].id;
    tenantIds.push(tenantA, tenantB);
    const users = await Promise.all(
      ['owner', 'member', 'admin'].map((name) =>
        prisma.user.create({
          data: {
            name,
            email: `${randomUUID()}@test.example`,
            passwordHash: 'not-used-by-these-tests',
            platformRole: name === 'admin' ? 'ADMIN' : null,
          },
        }),
      ),
    );
    userIds.push(...users.map((user) => user.id));
    userId = users[0].id;
    memberId = users[1].id;
    const campaigns = await Promise.all(
      [tenantA, tenantB].map((tenantId) =>
        prisma.campaign.create({
          data: { name: 'Campaign', tenantId, createdBy: userId },
        }),
      ),
    );
    campaignA = campaigns[0].id;
    campaignB = campaigns[1].id;
    await boot();
    const jwt = app.get(JwtService);
    const token = (
      sub: string,
      tenantId: string | null,
      tenantRole: 'OWNER' | 'MEMBER' | null,
      platformRole: 'ADMIN' | null = null,
    ) =>
      jwt.sign({
        sub,
        email: 'test@example.com',
        tenantId,
        tenantRole,
        platformRole,
      });
    owner = token(userId, tenantA, 'OWNER');
    member = token(memberId, tenantA, 'MEMBER');
    other = token(userId, tenantB, 'OWNER');
    admin = token(users[2].id, tenantA, null, 'ADMIN');
    globalAdmin = token(users[2].id, null, null, 'ADMIN');
  });
  afterEach(async () => {
    await app?.close();
  });
  afterAll(async () => {
    if (!prisma) return;
    // Delete only the exact fixture IDs created by this suite, never truncate.
    const where = { tenantId: { in: tenantIds } };
    await prisma.prospectingJobRequest.deleteMany({ where });
    await prisma.campaignProspect.deleteMany({ where: { campaign: where } });
    await prisma.prospect.deleteMany({ where });
    await prisma.prospectingJob.deleteMany({ where });
    await prisma.campaign.deleteMany({ where });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function create(
    key = randomUUID(),
    token = owner,
    body: unknown = payload(),
  ) {
    const response = await http()
      .post('/api/v1/prospecting-jobs')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(body);
    expect(response.status).toBe(201);
    return data<Job>(response);
  }
  function event(
    jobId: string,
    status: JobEventRequest['status'],
    sequence: number,
    results: BusinessResult[] | null = null,
  ): JobEventRequest {
    return {
      eventId: randomUUID(),
      jobId,
      sequence,
      status,
      timestamp: new Date().toISOString(),
      progress: null,
      results,
      error:
        status === 'FAILED'
          ? { code: 'SCRAPE_FAILED', message: 'Source unavailable' }
          : null,
    };
  }
  const callback = (body: JobEventRequest) =>
    http()
      .post(`/api/v1/internal/prospecting-jobs/${body.jobId}/events`)
      .set('X-API-Key', 'test-key')
      .send(body);
  async function complete(results: BusinessResult[] = [result()]) {
    const job = await create();
    expect((await callback(event(job.id, 'RUNNING', 1))).status).toBe(200);
    expect(
      (await callback(event(job.id, 'COMPLETED', 2, results))).status,
    ).toBe(200);
    return job;
  }

  it('creates a tenant-scoped job and durable idempotency row; retries survive restart', async () => {
    const key = randomUUID();
    const first = await create(key);
    expect(first).toMatchObject({
      tenantId: tenantA,
      requestedBy: userId,
      status: 'QUEUED',
      resultsAvailable: false,
      results: null,
    });
    expect(client.startJob).toHaveBeenCalledTimes(1);
    expect((await create(key)).id).toBe(first.id);
    expect(client.startJob).toHaveBeenCalledTimes(1);
    await app.close();
    await boot();
    expect((await create(key)).id).toBe(first.id);
    expect(client.startJob).toHaveBeenCalledTimes(1);
    const stored = await prisma.prospectingJobRequest.findUniqueOrThrow({
      where: { jobId: first.id },
    });
    expect(stored.keyHash).not.toBe(key);
    expect(stored.acceptedAt).not.toBeNull();
    const conflict = await http()
      .post('/api/v1/prospecting-jobs')
      .set('Authorization', auth())
      .set('Idempotency-Key', key)
      .send({ ...payload(), query: { ...payload().query, limit: 21 } });
    expect(conflict.status).toBe(409);
  });

  it('scopes keys by tenant/user and handles simultaneous requests', async () => {
    const key = randomUUID();
    const jobs = await Promise.all(
      Array.from({ length: 8 }, () => create(key)),
    );
    expect(new Set(jobs.map((job) => job.id)).size).toBe(1);
    expect(
      await prisma.prospectingJob.count({ where: { tenantId: tenantA } }),
    ).toBe(1);
    expect(client.startJob).toHaveBeenCalledTimes(1);
    const byMember = await create(key, member);
    const byOtherTenant = await create(key, other, {
      ...payload(),
      campaignId: campaignB,
    });
    expect(new Set([jobs[0].id, byMember.id, byOtherTenant.id]).size).toBe(3);
  });

  it('reuses the queued job after an ambiguous network failure', async () => {
    const key = randomUUID();
    client.startJob.mockRejectedValueOnce(new ServiceUnavailableException());
    expect(
      (
        await http()
          .post('/api/v1/prospecting-jobs')
          .set('Authorization', auth())
          .set('Idempotency-Key', key)
          .send(payload())
      ).status,
    ).toBe(503);
    const queued = await prisma.prospectingJob.findFirstOrThrow({
      where: { tenantId: tenantA },
    });
    expect((await create(key)).id).toBe(queued.id);
    expect(client.startJob).toHaveBeenCalledTimes(2);
  });

  it('database uniqueness protects independent service instances', async () => {
    const context = app.get(TenantContextService);
    const second = new ProspectingJobsService(
      prisma,
      context,
      app.get(CampaignsService),
      app.get(ProspectsService),
      app.get(ProspectorClientService),
      new JobMemoryService(),
      app.get(JobExportService),
      app.get(ConfigService),
    );
    const first = app.get(ProspectingJobsService);
    const key = randomUUID();
    const body = {
      ...payload(),
      query: { ...payload().query, source: 'google_maps' as const },
    };
    const jobs = await Promise.all(
      [first, second].map((service) =>
        context.run(
          {
            userId,
            tenantId: tenantA,
            tenantRole: 'OWNER',
            platformRole: null,
          },
          () => service.create(body, key),
        ),
      ),
    );
    expect(jobs[0].id).toBe(jobs[1].id);
    expect(
      await prisma.prospectingJob.count({ where: { tenantId: tenantA } }),
    ).toBe(1);
    expect(
      await prisma.prospectingJobRequest.count({
        where: { tenantId: tenantA },
      }),
    ).toBe(1);
  });

  it('accepts completed events with unavailable results according to the nullable contract', async () => {
    const job = await create();
    await callback(event(job.id, 'RUNNING', 1));
    expect((await callback(event(job.id, 'COMPLETED', 2))).status).toBe(200);
    const response = await http()
      .get(`/api/v1/prospecting-jobs/${job.id}`)
      .set('Authorization', auth());
    expect(data<Job>(response)).toMatchObject({
      status: 'COMPLETED',
      results: null,
      resultsAvailable: false,
    });
    expect(
      (
        await http()
          .post(`/api/v1/prospecting-jobs/${job.id}/persist`)
          .set('Authorization', auth())
      ).status,
    ).toBe(409);
  });

  it('repeating persistence does not recreate a prospect edited after import', async () => {
    const job = await complete([result({ sourceIdentifier: null })]);
    expect(
      (
        await http()
          .post(`/api/v1/prospecting-jobs/${job.id}/persist`)
          .set('Authorization', auth())
      ).status,
    ).toBe(200);
    const prospect = await prisma.prospect.findFirstOrThrow({
      where: { tenantId: tenantA },
    });
    await http()
      .patch(`/api/v1/prospects/${prospect.id}`)
      .set('Authorization', auth())
      .send({ name: 'Corrected name' });
    const repeat = await http()
      .post(`/api/v1/prospecting-jobs/${job.id}/persist`)
      .set('Authorization', auth());
    expect(repeat.body as unknown).toMatchObject({
      data: { persisted: 0, skipped: 1 },
    });
    expect(await prisma.prospect.count({ where: { tenantId: tenantA } })).toBe(
      1,
    );
  });

  it('requires authentication, a selected tenant, a valid payload and idempotency key', async () => {
    for (const [token, status] of [
      [null, 401],
      [globalAdmin, 403],
    ] as const) {
      const response = await http()
        .post('/api/v1/prospecting-jobs')
        .set('Authorization', token ? `Bearer ${token}` : '')
        .set('Idempotency-Key', 'key')
        .send(payload());
      expect(response.status).toBe(status);
    }
    expect(
      (
        await http()
          .post('/api/v1/prospecting-jobs')
          .set('Authorization', auth())
          .send(payload())
      ).status,
    ).toBe(400);
    const bodies = [
      {},
      { ...payload(), tenantId: tenantB },
      { ...payload(), query: null },
      { ...payload(), query: { ...payload().query, limit: 0 } },
      { ...payload(), query: { ...payload().query, source: 'other' } },
      { ...payload(), query: { ...payload().query, unexpected: true } },
    ];
    for (const body of bodies)
      expect(
        (
          await http()
            .post('/api/v1/prospecting-jobs')
            .set('Authorization', auth())
            .set('Idempotency-Key', randomUUID())
            .send(body)
        ).status,
      ).toBe(400);
    expect(
      await prisma.prospectingJob.count({ where: { tenantId: tenantA } }),
    ).toBe(0);
  });

  it('isolates all job routes and the campaign used on creation', async () => {
    const job = await create();
    const calls = [
      http().get(`/api/v1/prospecting-jobs/${job.id}`),
      http().post(`/api/v1/prospecting-jobs/${job.id}/cancel`),
      http().post(`/api/v1/prospecting-jobs/${job.id}/persist`),
      http().get(`/api/v1/prospecting-jobs/${job.id}/export?format=csv`),
    ];
    for (const call of calls)
      expect((await call.set('Authorization', `Bearer ${other}`)).status).toBe(
        404,
      );
    const foreign = await http()
      .post('/api/v1/prospecting-jobs')
      .set('Authorization', auth())
      .set('Idempotency-Key', randomUUID())
      .send({ ...payload(), campaignId: campaignB });
    expect(foreign.status).toBe(404);
    const list = await http()
      .get('/api/v1/prospecting-jobs?limit=1')
      .set('Authorization', auth());
    expect(list.status).toBe(200);
    expect(list.body as unknown).toMatchObject({
      data: [{ id: job.id }],
      meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });
    expect(
      (
        await http()
          .get('/api/v1/prospecting-jobs?search=x')
          .set('Authorization', auth())
      ).status,
    ).toBe(400);
    expect(
      (
        await http()
          .get('/api/v1/prospecting-jobs?limit=101')
          .set('Authorization', auth())
      ).status,
    ).toBe(400);
  });

  it('authenticates callbacks with API key, not a user JWT; validates nested fields', async () => {
    const job = await create();
    const body = event(job.id, 'RUNNING', 1);
    for (const key of ['', 'wrong'])
      expect(
        (
          await http()
            .post(`/api/v1/internal/prospecting-jobs/${job.id}/events`)
            .set('Authorization', auth())
            .set('X-API-Key', key)
            .send(body)
        ).status,
      ).toBe(401);
    const invalid = {
      ...body,
      progress: {
        source: 'google_maps',
        stage: 'search',
        message: 'Working',
        percentage: 101,
      },
    };
    expect((await callback(invalid)).status).toBe(400);
    const mismatch = await http()
      .post(`/api/v1/internal/prospecting-jobs/${campaignA}/events`)
      .set('X-API-Key', 'test-key')
      .send(body);
    expect(mismatch.status).toBe(400);
    expect((await callback({ ...body, sequence: 0 })).status).toBe(400);
    const missingField: Partial<JobEventRequest> = { ...body };
    delete missingField.results;
    expect(
      (
        await http()
          .post(`/api/v1/internal/prospecting-jobs/${job.id}/events`)
          .set('X-API-Key', 'test-key')
          .send(missingField)
      ).status,
    ).toBe(400);
    expect((await callback(body)).status).toBe(200);
  });

  it('enforces lifecycle, duplicate/old event handling and completion', async () => {
    const job = await create();
    expect((await callback(event(job.id, 'COMPLETED', 1, []))).status).toBe(
      409,
    );
    const running = event(job.id, 'RUNNING', 2);
    running.progress = {
      source: 'google_maps',
      stage: 'search',
      message: 'Working',
      percentage: 40,
    };
    expect((await callback(running)).status).toBe(200);
    expect((await callback(running)).status).toBe(200);
    expect((await callback(event(job.id, 'QUEUED', 1))).status).toBe(200);
    expect((await callback(event(job.id, 'QUEUED', 3))).status).toBe(409);
    const done = event(job.id, 'COMPLETED', 4, [result()]);
    expect((await callback(done)).status).toBe(200);
    expect((await callback(done)).status).toBe(200);
    expect((await callback(event(job.id, 'RUNNING', 5))).status).toBe(409);
    const detail = await http()
      .get(`/api/v1/prospecting-jobs/${job.id}`)
      .set('Authorization', auth());
    expect(data<Job>(detail)).toMatchObject({
      status: 'COMPLETED',
      resultsAvailable: true,
      results: [result()],
    });
    expect(
      (await prisma.prospectingJob.findUniqueOrThrow({ where: { id: job.id } }))
        .completedAt,
    ).not.toBeNull();
  });

  it('records failure and disallows persistence/export/cancellation after failure', async () => {
    const job = await create();
    await callback(event(job.id, 'RUNNING', 1));
    expect((await callback(event(job.id, 'FAILED', 2))).status).toBe(200);
    const stored = await prisma.prospectingJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(stored.error).toBe('SCRAPE_FAILED: Source unavailable');
    for (const action of ['persist', 'cancel'])
      expect(
        (
          await http()
            .post(`/api/v1/prospecting-jobs/${job.id}/${action}`)
            .set('Authorization', auth())
        ).status,
      ).toBe(409);
    expect(
      (
        await http()
          .get(`/api/v1/prospecting-jobs/${job.id}/export?format=csv`)
          .set('Authorization', auth())
      ).status,
    ).toBe(409);
  });

  it('cancels QUEUED immediately; RUNNING only after the service callback', async () => {
    const queued = await create();
    const cancelled = await http()
      .post(`/api/v1/prospecting-jobs/${queued.id}/cancel`)
      .set('Authorization', `Bearer ${member}`);
    expect(cancelled.status).toBe(200);
    expect(data<Job>(cancelled).status).toBe('CANCELLED');
    expect(client.cancelJob).toHaveBeenCalledWith(queued.id);
    expect((await callback(event(queued.id, 'RUNNING', 1))).status).toBe(200);
    expect(
      (
        await prisma.prospectingJob.findUniqueOrThrow({
          where: { id: queued.id },
        })
      ).status,
    ).toBe('CANCELLED');
    expect(
      (
        await http()
          .post(`/api/v1/prospecting-jobs/${queued.id}/cancel`)
          .set('Authorization', auth())
      ).status,
    ).toBe(200);
    const running = await create();
    await callback(event(running.id, 'RUNNING', 1));
    client.cancelJob.mockRejectedValueOnce(new ServiceUnavailableException());
    expect(
      (
        await http()
          .post(`/api/v1/prospecting-jobs/${running.id}/cancel`)
          .set('Authorization', auth())
      ).status,
    ).toBe(503);
    const response = await http()
      .post(`/api/v1/prospecting-jobs/${running.id}/cancel`)
      .set('Authorization', auth());
    expect(response.status).toBe(200);
    expect(data<Job>(response).status).toBe('RUNNING');
    expect((await callback(event(running.id, 'CANCELLED', 2))).status).toBe(
      200,
    );
  });

  it('persists results, deduplicates identifiers and NULL identities, and creates associations', async () => {
    const job = await complete([
      result(),
      result(),
      result({ sourceIdentifier: null, name: 'No ID' }),
      result({ sourceIdentifier: null, name: 'No ID' }),
    ]);
    const response = await http()
      .post(`/api/v1/prospecting-jobs/${job.id}/persist`)
      .set('Authorization', `Bearer ${member}`);
    expect(response.status).toBe(200);
    expect(response.body as unknown).toMatchObject({
      data: { persisted: 2, skipped: 2 },
    });
    const repeated = await http()
      .post(`/api/v1/prospecting-jobs/${job.id}/persist`)
      .set('Authorization', auth());
    expect(repeated.body as unknown).toMatchObject({
      data: { persisted: 0, skipped: 4 },
    });
    expect(await prisma.prospect.count({ where: { tenantId: tenantA } })).toBe(
      2,
    );
    expect(
      await prisma.campaignProspect.count({ where: { campaignId: campaignA } }),
    ).toBe(2);
  });

  it('serializes competing persistence batches without duplicate NULL prospects', async () => {
    const service = app.get(ProspectsService);
    const context = app.get(TenantContextService);
    const results = [result({ sourceIdentifier: null })];
    const batches = await Promise.all(
      [0, 1].map(() =>
        context.run(
          {
            userId,
            tenantId: tenantA,
            tenantRole: 'OWNER',
            platformRole: null,
          },
          () => service.persistResults(campaignA, results),
        ),
      ),
    );
    expect(batches.reduce((sum, batch) => sum + batch.persisted, 0)).toBe(1);
    expect(await prisma.prospect.count({ where: { tenantId: tenantA } })).toBe(
      1,
    );
    expect(
      await prisma.campaignProspect.count({ where: { campaignId: campaignA } }),
    ).toBe(1);
  });

  it('exports real CSV/XLSX binaries with safe spreadsheet cells and no JSON wrapper', async () => {
    const job = await complete([
      result({ name: '=1+1', address: 'Street, "North"\nFloor 2' }),
    ]);
    const csv = await http()
      .get(`/api/v1/prospecting-jobs/${job.id}/export?format=csv`)
      .set('Authorization', auth());
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain("'=" + '1+1');
    expect(csv.text).toContain('""North""');
    const xlsx = await http()
      .get(`/api/v1/prospecting-jobs/${job.id}/export?format=xlsx`)
      .set('Authorization', auth())
      .buffer(true)
      .parse(
        (
          response: IncomingMessage,
          done: (error: Error | null, body?: Buffer) => void,
        ) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => done(null, Buffer.concat(chunks)));
          response.on('error', (error: Error) => done(error));
        },
      );
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers['content-disposition']).toContain('prospects.xlsx');
    const workbook = new Workbook();
    await workbook.xlsx.load(
      xlsx.body as Parameters<Workbook['xlsx']['load']>[0],
    );
    expect(workbook.worksheets[0].getCell('A2').value).toBe('=1+1');
    expect(
      (
        await http()
          .get(`/api/v1/prospecting-jobs/${job.id}/export?format=pdf`)
          .set('Authorization', auth())
      ).status,
    ).toBe(400);
  });

  it('does not substitute unrelated campaign prospects when the job cache expires', async () => {
    const job = await complete();
    await http()
      .post(`/api/v1/prospecting-jobs/${job.id}/persist`)
      .set('Authorization', auth());
    const memory = app.get(JobMemoryService);
    const expired = jest.spyOn(memory, 'get').mockReturnValue(undefined);
    try {
      const detail = await http()
        .get(`/api/v1/prospecting-jobs/${job.id}`)
        .set('Authorization', auth());
      expect(data<Job>(detail)).toMatchObject({
        status: 'COMPLETED',
        resultsAvailable: false,
        results: null,
      });
      expect(
        (
          await http()
            .get(`/api/v1/prospecting-jobs/${job.id}/export?format=csv`)
            .set('Authorization', auth())
        ).status,
      ).toBe(409);
    } finally {
      expired.mockRestore();
    }
    expect(await prisma.prospect.count({ where: { tenantId: tenantA } })).toBe(
      1,
    );
  });

  it('Prospects supports nullable patches, search, pagination and prevents cross-tenant access', async () => {
    const job = await complete([result({ metadata: { rating: 4.5 } })]);
    await http()
      .post(`/api/v1/prospecting-jobs/${job.id}/persist`)
      .set('Authorization', auth());
    const prospect = await prisma.prospect.findFirstOrThrow({
      where: { tenantId: tenantA },
    });
    const patch = await http()
      .patch(`/api/v1/prospects/${prospect.id}`)
      .set('Authorization', `Bearer ${member}`)
      .send({ email: null, metadata: null, status: 'INACTIVO' });
    expect(patch.status).toBe(200);
    expect(patch.body as unknown).toMatchObject({
      data: {
        name: 'Restaurant',
        email: null,
        metadata: null,
        status: 'INACTIVO',
      },
    });
    expect(JSON.stringify(patch.body)).not.toContain('tenantId');
    const raw = await prisma.prospect.findUniqueOrThrow({
      where: { id: prospect.id },
    });
    expect(raw.metadata).toBeNull();
    const list = await http()
      .get(
        '/api/v1/prospects?search=RESTAURANT&page=1&limit=1&sortBy=name&sortOrder=desc',
      )
      .set('Authorization', auth());
    expect(list.status).toBe(200);
    expect(list.body as unknown).toMatchObject({
      data: [{ id: prospect.id }],
      meta: { total: 1, totalPages: 1 },
    });
    for (const call of [
      http().get(`/api/v1/prospects/${prospect.id}`),
      http().patch(`/api/v1/prospects/${prospect.id}`).send({ name: 'Attack' }),
    ]) {
      expect((await call.set('Authorization', `Bearer ${other}`)).status).toBe(
        404,
      );
    }
    const foreignList = await http()
      .get('/api/v1/prospects')
      .set('Authorization', `Bearer ${other}`);
    expect(foreignList.body as unknown).toMatchObject({
      data: [],
      meta: { total: 0 },
    });
    for (const body of [
      {},
      { name: null },
      { email: 'bad' },
      { website: 'not-a-url' },
      { metadata: [] },
      { source: 'other' },
      { tenantId: tenantB },
      { status: null },
    ]) {
      expect(
        (
          await http()
            .patch(`/api/v1/prospects/${prospect.id}`)
            .set('Authorization', auth())
            .send(body)
        ).status,
      ).toBe(400);
    }
    expect(
      (
        await http()
          .get('/api/v1/prospects')
          .set('Authorization', `Bearer ${globalAdmin}`)
      ).status,
    ).toBe(403);
    expect((await http().get('/api/v1/prospects')).status).toBe(401);
    expect(
      (
        await http()
          .get('/api/v1/prospects?limit=101')
          .set('Authorization', auth())
      ).status,
    ).toBe(400);
    expect(
      (
        await http()
          .get('/api/v1/prospects?sortBy=tenantId')
          .set('Authorization', auth())
      ).status,
    ).toBe(400);
    expect(
      (
        await http()
          .get(`/api/v1/prospects/${prospect.id}`)
          .set('Authorization', `Bearer ${admin}`)
      ).status,
    ).toBe(200);
  });
});
