import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import type { JobEventRequest } from '../src/prospector-client/dto/job-event.request';
import { ProspectingJobsService } from '../src/prospecting-jobs/prospecting-jobs.service';

type Job = Awaited<ReturnType<ProspectingJobsService['findOne']>>;
function data<T>(response: { body: unknown }): T {
  return (response.body as { data: T }).data;
}

describe('Baseline data and disabled Jobs with PostgreSQL (isolated fixtures)', () => {
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
  async function boot() {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
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
    await prisma.campaignProspect.deleteMany({ where: { campaign: where } });
    await prisma.prospect.deleteMany({ where });
    await prisma.prospectingJob.deleteMany({ where });
    await prisma.campaign.deleteMany({ where });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function jobFixture(tenantId = tenantA, campaignId = campaignA) {
    // A pre-existing baseline record, not a simulated scraping execution.
    return prisma.prospectingJob.create({
      data: {
        tenantId,
        campaignId,
        requestedBy: userId,
        query: payload().query,
        requestedLimit: 20,
      },
    });
  }

  it('uses the baseline schema without the retired idempotency table', async () => {
    const rows = await prisma.$queryRaw<Array<{ present: boolean }>>`
      SELECT to_regclass('public.prospecting_job_requests') IS NOT NULL AS present
    `;
    expect(rows).toEqual([{ present: false }]);
  });

  it('rejects repeated and concurrent starts without allocating jobs', async () => {
    const send = () =>
      http()
        .post('/api/v1/prospecting-jobs')
        .set('Authorization', auth())
        .set('Idempotency-Key', 'same-key')
        .send(payload());
    const responses = await Promise.all(Array.from({ length: 4 }, send));
    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.body as unknown).toMatchObject({
        success: false,
        error: {
          details: { reason: 'PROSPECTOR_INTEGRATION_PENDING' },
        },
      });
    }
    expect(
      await prisma.prospectingJob.count({ where: { tenantId: tenantA } }),
    ).toBe(0);
  });

  it('preserves authentication, tenant and request validation on disabled creation', async () => {
    await http().post('/api/v1/prospecting-jobs').send(payload()).expect(401);
    await http()
      .post('/api/v1/prospecting-jobs')
      .set('Authorization', `Bearer ${globalAdmin}`)
      .set('Idempotency-Key', 'key')
      .send(payload())
      .expect(403);
    await http()
      .post('/api/v1/prospecting-jobs')
      .set('Authorization', auth())
      .send(payload())
      .expect(400);
    for (const body of [
      {},
      { ...payload(), tenantId: tenantB },
      { ...payload(), query: { ...payload().query, limit: 0 } },
    ]) {
      await http()
        .post('/api/v1/prospecting-jobs')
        .set('Authorization', auth())
        .set('Idempotency-Key', 'key')
        .send(body)
        .expect(400);
    }
  });

  it('lists baseline jobs within the tenant and hides foreign detail', async () => {
    const job = await jobFixture();
    await jobFixture(tenantB, campaignB);
    const list = await http()
      .get('/api/v1/prospecting-jobs?limit=1')
      .set('Authorization', auth())
      .expect(200);
    expect(list.body as unknown).toMatchObject({
      data: [{ id: job.id }],
      meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });
    const detail = await http()
      .get(`/api/v1/prospecting-jobs/${job.id}`)
      .set('Authorization', auth())
      .expect(200);
    expect(data<Job>(detail)).toMatchObject({
      id: job.id,
      status: 'QUEUED',
      resultsAvailable: false,
    });
    await http()
      .get(`/api/v1/prospecting-jobs/${job.id}`)
      .set('Authorization', `Bearer ${other}`)
      .expect(404);
    await http()
      .get('/api/v1/prospecting-jobs?limit=101')
      .set('Authorization', auth())
      .expect(400);
  });

  it('does not change baseline job records through cancellation or callbacks', async () => {
    const job = await jobFixture();
    await http()
      .post(`/api/v1/prospecting-jobs/${job.id}/cancel`)
      .set('Authorization', `Bearer ${member}`)
      .expect(503);
    const event: JobEventRequest = {
      eventId: randomUUID(),
      jobId: job.id,
      sequence: 1,
      status: 'RUNNING',
      timestamp: new Date().toISOString(),
      progress: null,
      results: null,
      error: null,
    };
    await http()
      .post(`/api/v1/internal/prospecting-jobs/${job.id}/events`)
      .set('X-API-Key', 'wrong')
      .send(event)
      .expect(401);
    await http()
      .post(`/api/v1/internal/prospecting-jobs/${job.id}/events`)
      .set('X-API-Key', 'test-key')
      .send(event)
      .expect(503);
    expect(
      await prisma.prospectingJob.findUniqueOrThrow({ where: { id: job.id } }),
    ).toEqual(job);
  });

  it('keeps completed jobs and persisted prospects unchanged when import/export are unavailable', async () => {
    const job = await jobFixture();
    await prisma.prospectingJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED' },
    });
    const prospect = await prisma.prospect.create({
      data: {
        tenantId: tenantA,
        campaignId: campaignA,
        name: 'Existing contact',
        source: 'google_maps',
      },
    });
    const detail = await http()
      .get(`/api/v1/prospecting-jobs/${job.id}`)
      .set('Authorization', auth())
      .expect(200);
    expect(data<Job>(detail)).toMatchObject({
      status: 'COMPLETED',
      resultsAvailable: false,
      results: null,
      progress: null,
    });
    for (const call of [
      http().post(`/api/v1/prospecting-jobs/${job.id}/persist`),
      http().get(`/api/v1/prospecting-jobs/${job.id}/export?format=csv`),
      http().get(`/api/v1/prospecting-jobs/${job.id}/export?format=xlsx`),
    ]) {
      const response = await call.set('Authorization', auth()).expect(503);
      expect(response.body as unknown).toMatchObject({
        success: false,
        error: {
          details: { reason: 'PROSPECTOR_INTEGRATION_PENDING' },
        },
      });
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toBeUndefined();
    }
    expect(
      await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } }),
    ).toEqual(prospect);
    expect(await prisma.prospect.count({ where: { tenantId: tenantA } })).toBe(
      1,
    );
    expect(
      await prisma.campaignProspect.count({ where: { campaignId: campaignA } }),
    ).toBe(0);
    await http()
      .get(`/api/v1/prospecting-jobs/${job.id}/export?format=pdf`)
      .set('Authorization', auth())
      .expect(400);
  });

  it('Prospects supports nullable patches, search, pagination and prevents cross-tenant access', async () => {
    const prospect = await prisma.prospect.create({
      data: {
        tenantId: tenantA,
        campaignId: campaignA,
        name: 'Restaurant',
        source: 'google_maps',
        sourceIdentifier: 'fixture-1',
        email: 'hello@example.com',
        metadata: { rating: 4.5 },
      },
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
