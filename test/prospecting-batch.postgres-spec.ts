import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

type Batch = {
  id: string;
  campaignId: string;
  admission: string;
  jobs: Array<{
    id: string;
    position: number;
    state: string;
    sequence: number;
  }>;
};

function batchData(response: { body: unknown }): Batch {
  return (response.body as { data: Batch }).data;
}

describe('Batch administration with NestJS and disposable PostgreSQL', () => {
  const api = '/api/v1/prospecting-batches';
  const callbackKey = 'c'.repeat(48);
  const config = {
    PROSPECTOR_BATCH_ENABLED: 'true',
    PROSPECTOR_BATCH_SOLUTION_ID: 'postgres-fixture',
    PROSPECTOR_BATCH_API_KEY: 'a'.repeat(48),
    PROSPECTOR_BATCH_ASSERTION_KEY: 'b'.repeat(48),
    PROSPECTOR_BATCH_CALLBACK_KEY: callbackKey,
    PROSPECTOR_BATCH_ASSERTION_ISSUER: 'postgres-fixture',
    PROSPECTOR_BATCH_SERVICE_ORIGIN: 'https://service.example.invalid',
  };
  const previous = Object.fromEntries(
    Object.keys(config).map((key) => [key, process.env[key]]),
  );
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let otherTenantId: string;
  let campaignId: string;
  let otherCampaignId: string;
  let owner: string;
  let anotherOwner: string;
  let member: string;
  const userIds: string[] = [];
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);
  const query = {
    source: 'google_maps',
    keyword: 'synthetic store',
    location: 'synthetic town',
    limit: 2,
  };
  const create = (
    key: string,
    jwt = owner,
    body = { campaignId, queries: [query] },
  ) =>
    http()
      .post(api)
      .auth(jwt, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);

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
    app.useGlobalInterceptors(app.get(ResponseInterceptor));
    await app.listen(0, '127.0.0.1');
  }

  beforeAll(async () => {
    Object.assign(process.env, config);
    prisma = new PrismaService();
    const tenants = await Promise.all(
      ['A', 'B'].map((name) =>
        prisma.tenant.create({ data: { name, slug: randomUUID() } }),
      ),
    );
    tenantId = tenants[0].id;
    otherTenantId = tenants[1].id;
    const ownerRole = await prisma.role.create({
      data: { tenantId, name: 'OWNER' },
    });
    const memberRole = await prisma.role.create({
      data: { tenantId, name: 'MEMBER' },
    });
    const users = await Promise.all(
      [ownerRole.id, ownerRole.id, memberRole.id].map((roleId) =>
        prisma.user.create({
          data: {
            name: 'Synthetic batch actor',
            email: `${randomUUID()}@example.invalid`,
            passwordHash: 'unused-fixture',
            userTenants: { create: { tenantId, roleId } },
          },
        }),
      ),
    );
    userIds.push(...users.map((user) => user.id));
    const campaigns = await Promise.all(
      [tenantId, otherTenantId].map((tenant) =>
        prisma.campaign.create({
          data: {
            name: 'Synthetic campaign',
            tenantId: tenant,
            createdBy: users[0].id,
          },
        }),
      ),
    );
    campaignId = campaigns[0].id;
    otherCampaignId = campaigns[1].id;
    await boot();
    const jwt = app.get(JwtService);
    const sign = (index: number, tenantRole: 'OWNER' | 'MEMBER') =>
      jwt.sign({
        sub: users[index].id,
        email: users[index].email,
        tenantId,
        tenantRole,
        platformRole: null,
      });
    owner = sign(0, 'OWNER');
    anotherOwner = sign(1, 'OWNER');
    member = sign(2, 'MEMBER');
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await app?.close();
    if (prisma && tenantId) {
      const batches = { tenantId };
      await prisma.prospectingBatchEvent.deleteMany({
        where: { job: { batch: batches } },
      });
      await prisma.prospectingBatchJob.deleteMany({
        where: { batch: batches },
      });
      await prisma.prospectingBatch.deleteMany({ where: batches });
      await prisma.campaign.deleteMany({
        where: { id: { in: [campaignId, otherCampaignId] } },
      });
      await prisma.userTenant.deleteMany({ where: { tenantId } });
      await prisma.role.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantId, otherTenantId] } },
      });
    }
    await prisma?.$disconnect();
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('rejects MEMBER and a foreign campaign before outbound admission', async () => {
    const outbound = jest.spyOn(globalThis, 'fetch');
    await create('member', member).expect(403);
    await create('other-tenant', owner, {
      campaignId: otherCampaignId,
      queries: [query],
    }).expect(404);
    await create('too-many', owner, {
      campaignId,
      queries: Array.from({ length: 6 }, () => query),
    }).expect(400);
    expect(outbound).not.toHaveBeenCalled();
  });

  it('reserves ordered IDs once and recovers status from authenticated callbacks', async () => {
    const outbound = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('fixture lost response'));
    const input = {
      campaignId,
      queries: [query, { ...query, keyword: 'second fixture' }],
    };
    const key = randomUUID();
    const [first, race] = await Promise.all([
      create(key, owner, input).expect(202),
      create(key, owner, input).expect(202),
    ]);
    const batch = batchData(first);
    expect(batchData(race).id).toBe(batch.id);
    expect(batch.jobs.map((job) => job.position)).toEqual([0, 1]);
    expect(outbound).toHaveBeenCalledTimes(1);
    await create(key, owner).expect(409);
    await http()
      .get(`${api}/${batch.id}`)
      .auth(anotherOwner, { type: 'bearer' })
      .expect(404);
    const detail = () =>
      http()
        .get(`${api}/${batch.id}`)
        .auth(owner, { type: 'bearer' })
        .expect(200);
    expect(batchData(await detail()).admission).toBe('UNCERTAIN');
    const job = batch.jobs[0];
    const callback = `/api/v1/internal/prospecting-batches/${batch.id}/jobs/${job.id}/events`;
    const terminal = {
      schemaVersion: '1.0',
      eventId: randomUUID(),
      batchId: batch.id,
      jobId: job.id,
      queryIndex: 0,
      sequence: 3,
      status: 'COMPLETED',
      kind: 'TERMINAL',
      timestamp: new Date().toISOString(),
      quality: 'PARTIAL',
      availability: 'AVAILABLE',
      snapshotId: randomUUID(),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
    await http().post(callback).send(terminal).expect(401);
    await http()
      .post(callback)
      .set('X-API-Key', callbackKey)
      .send({
        ...terminal,
        queryIndex: 1,
      })
      .expect(404);
    const notify = (event: object) =>
      http().post(callback).set('X-API-Key', callbackKey).send(event);
    await notify(terminal).expect(200);
    await notify(terminal).expect(200);
    await notify({ ...terminal, sequence: 4 }).expect(409);
    await notify({
      schemaVersion: '1.0',
      eventId: randomUUID(),
      batchId: batch.id,
      jobId: job.id,
      queryIndex: 0,
      sequence: 1,
      status: 'RUNNING',
      kind: 'STATE_CHANGED',
      timestamp: terminal.timestamp,
    }).expect(200);
    expect(
      await prisma.prospectingBatchEvent.count({ where: { jobId: job.id } }),
    ).toBe(2);
    expect(await prisma.prospect.count({ where: { tenantId } })).toBe(0);

    await app.close();
    await boot();
    const durable = batchData(await detail());
    expect(durable.admission).toBe('ACCEPTED');
    expect(durable.jobs[0]).toMatchObject({ sequence: 3, state: 'COMPLETED' });
  });
});
