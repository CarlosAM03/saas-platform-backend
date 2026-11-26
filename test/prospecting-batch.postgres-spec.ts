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
  const realFixture = process.env.PROSPECTOR_BATCH_REAL_FIXTURE;
  const callbackKey = 'c'.repeat(48);
  const config = {
    PROSPECTOR_BATCH_ENABLED: 'true',
    PROSPECTOR_BATCH_SOLUTION_ID: 'postgres-fixture',
    PROSPECTOR_BATCH_API_KEY: 'a'.repeat(48),
    PROSPECTOR_BATCH_ASSERTION_KEY: 'b'.repeat(48),
    PROSPECTOR_BATCH_CALLBACK_KEY: callbackKey,
    PROSPECTOR_BATCH_ASSERTION_ISSUER: 'postgres-fixture',
    PROSPECTOR_BATCH_SERVICE_ORIGIN:
      realFixture ?? 'https://service.example.invalid',
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
    if (
      realFixture !== undefined &&
      realFixture !== 'https://127.0.0.1:18752'
    ) {
      throw new Error('The real fixture must be the isolated loopback Service');
    }
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
      await prisma.prospectingBatchConfirmation.deleteMany({
        where: { job: { batch: batches } },
      });
      await prisma.prospectingBatchEvent.deleteMany({
        where: { job: { batch: batches } },
      });
      await prisma.prospectingBatchJob.deleteMany({
        where: { batch: batches },
      });
      await prisma.prospectingBatch.deleteMany({ where: batches });
      await prisma.campaignActivity.deleteMany({ where: batches });
      await prisma.prospectProvenance.deleteMany({ where: batches });
      await prisma.campaignProspect.deleteMany({
        where: { campaign: batches },
      });
      await prisma.prospect.deleteMany({ where: batches });
      await prisma.campaign.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
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

  it('commits partial results once, keeps commercial state and reconciles ACK separately', async () => {
    const strong = await prisma.prospect.create({
      data: {
        tenantId,
        campaignId,
        name: 'Existing strong',
        source: 'google_maps',
        sourceIdentifier: 'fixture-verified-strong',
      },
    });
    const weak = await prisma.prospect.create({
      data: {
        tenantId,
        campaignId,
        name: 'Existing weak',
        source: 'manual',
        phone: '123-456-7890',
      },
    });
    await prisma.campaignProspect.create({
      data: {
        campaignId,
        prospectId: strong.id,
        commercialStage: 'CONTACTADO',
        evaluation: 'APTO',
      },
    });
    const legacyOrigin = await prisma.campaign.create({
      data: {
        tenantId,
        createdBy: userIds[0],
        name: 'Synthetic second origin',
      },
    });
    await prisma.prospect.createMany({
      data: ['Collision A', 'Collision B'].map((name, index) => ({
        tenantId,
        campaignId: index === 0 ? campaignId : legacyOrigin.id,
        name,
        source: 'google_maps',
        sourceIdentifier: 'fixture-verified-collision',
      })),
    });
    const row = (
      name: string,
      sourceIdentifier: string | null = null,
      phone: string | null = null,
    ) => ({
      name,
      sourceIdentifier,
      phone,
      source: 'google_maps',
      category: null,
      address: null,
      email: null,
      website: null,
      language: null,
      metadata: null,
    });
    const entries = [
      row('Strong observed', 'fixture-verified-strong'),
      row('Weak observed under a different name', null, '1234567890'),
      row('Confirm a new business'),
      row('Blocked identity', 'fixture-verified-collision'),
    ];
    const snapshotId = randomUUID();
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    let snapshotExpiry = expiresAt;
    let jobId = '';
    let ackAttempts = 0;
    let purges = 0;
    let snapshotReads = 0;
    const success = (data: object, status = 200, meta: object = {}) =>
      Response.json({ success: true, data, meta }, { status });
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (typeof url !== 'string') throw new TypeError('Expected URL string');
      const path = new URL(url).pathname;
      if (path.endsWith('/ack')) {
        ackAttempts++;
        expect(
          await prisma.prospectingBatchConfirmation.count({ where: { jobId } }),
        ).toBe(1);
        expect(
          await prisma.prospect.count({
            where: { tenantId, name: entries[2].name },
          }),
        ).toBe(1);
        if (ackAttempts === 1) throw new Error('controlled lost ACK');
        return success({ ackAt: new Date().toISOString() });
      }
      if (path.endsWith('/purge')) {
        purges++;
        return success({ availability: 'PURGED' });
      }
      if (path.endsWith('/results')) {
        snapshotReads++;
        return success(entries, 200, { snapshotId, expiresAt: snapshotExpiry });
      }
      if (typeof options?.body !== 'string')
        throw new TypeError('Expected JSON request');
      const input = JSON.parse(options.body) as {
        batchId: string;
        jobs: { jobId: string }[];
      };
      jobId = input.jobs[0].jobId;
      return success(
        {
          batchId: input.batchId,
          jobIds: [jobId],
          status: 'QUEUED',
          acceptedAt: new Date().toISOString(),
        },
        202,
      );
    });
    const batch = batchData(await create(randomUUID()).expect(202));
    const job = batch.jobs[0];
    await http()
      .post(
        `/api/v1/internal/prospecting-batches/${batch.id}/jobs/${job.id}/events`,
      )
      .set('X-API-Key', callbackKey)
      .send({
        schemaVersion: '1.0',
        eventId: randomUUID(),
        batchId: batch.id,
        jobId: job.id,
        queryIndex: 0,
        sequence: 4,
        status: 'COMPLETED',
        kind: 'TERMINAL',
        timestamp: new Date().toISOString(),
        quality: 'PARTIAL',
        availability: 'AVAILABLE',
        snapshotId,
        expiresAt,
      })
      .expect(200);
    const endpoint = `${api}/${batch.id}/jobs/${job.id}`;
    const authorization = `Bearer ${owner}`;
    const preview = await http()
      .get(`${endpoint}/results`)
      .set('Authorization', authorization)
      .expect(200);
    expect(preview.body).toMatchObject({
      data: {
        quality: 'PARTIAL',
        rows: [
          { strongProspect: { id: strong.id } },
          { candidates: [{ id: weak.id }] },
          { candidates: [] },
          { blocked: true },
        ],
      },
    });
    expect(ackAttempts).toBe(0);
    expect(purges).toBe(0);
    const decisions = [
      { index: 0, action: 'LINK_EXISTING', candidateId: strong.id },
      { index: 1, action: 'LINK_EXISTING', candidateId: weak.id },
      { index: 2, action: 'CREATE' },
      { index: 3, action: 'SKIP' },
    ];
    const confirm = (chosen: typeof decisions) =>
      http()
        .post(`${endpoint}/confirm`)
        .set('Authorization', authorization)
        .send({ snapshotId, decisions: chosen });
    // The private status can report AVAILABLE while retrieval finds an expired snapshot.
    snapshotExpiry = new Date(Date.now() - 60_000).toISOString();
    await confirm(decisions).expect(410);
    expect(ackAttempts).toBe(0);
    snapshotExpiry = expiresAt;
    await confirm([
      ...decisions.slice(0, 3),
      { index: 3, action: 'CREATE' },
    ]).expect(409);
    expect(
      await prisma.prospectingBatchConfirmation.count({
        where: { jobId: job.id },
      }),
    ).toBe(0);
    const committed = await confirm(decisions).expect(200);
    expect(committed.body).toMatchObject({
      data: { processedCount: 3, omittedCount: 1, ackAt: null, purgedAt: null },
    });
    expect(ackAttempts).toBe(1);
    expect(purges).toBe(0);
    expect(
      await prisma.campaignProspect.findUniqueOrThrow({
        where: { campaignId_prospectId: { campaignId, prospectId: strong.id } },
      }),
    ).toMatchObject({ commercialStage: 'CONTACTADO', evaluation: 'APTO' });
    const events = await prisma.prospectProvenance.findMany({
      where: { tenantId, source: 'google_maps' },
    });
    expect(events).toHaveLength(3);
    for (const event of events)
      expect(event.details).toMatchObject({ batchId: batch.id, jobId: job.id });
    const readsBeforeReplay = snapshotReads;
    await app.close();
    await prisma.$disconnect();
    prisma = new PrismaService();
    await boot();
    const protectedBatch = await http()
      .get(`${api}/${batch.id}`)
      .set('Authorization', authorization)
      .expect(200);
    expect(batchData(protectedBatch).jobs[0].id).toBe(job.id);
    await confirm(decisions).expect(200);
    await confirm(decisions).expect(200);
    expect(ackAttempts).toBe(2);
    expect(purges).toBe(1);
    expect(snapshotReads).toBe(readsBeforeReplay);
    await http()
      .get(`${endpoint}/results`)
      .set('Authorization', authorization)
      .expect(410);
  });

  (realFixture ? it : it.skip)(
    'exchanges private TLS requests with real FastAPI and confirms its offline fixture in PostgreSQL',
    async () => {
      const batch = batchData(await create(randomUUID()).expect(202));
      expect(batch.admission).toBe('ACCEPTED');
      const jobId = batch.jobs[0].id;
      const path = `${api}/${batch.id}`;
      const authorization = `Bearer ${owner}`;
      let events: Array<{ batchId: string; jobId: string; kind: string }> = [];
      for (let attempt = 0; attempt < 40; attempt++) {
        const response = await fetch(`${realFixture}/__fixture/events`, {
          signal: AbortSignal.timeout(2000),
        });
        expect(response.ok).toBe(true);
        const all = (await response.json()) as typeof events;
        events = all.filter((event) => event.batchId === batch.id);
        if (events.some((event) => event.kind === 'TERMINAL')) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      expect(events.some((event) => event.kind === 'TERMINAL')).toBe(true);
      // The offline fixture captures actual Service callback payloads. Relay
      // those payloads into NestJS so no inbound host port is exposed.
      for (const event of events.reverse()) {
        await http()
          .post(
            `/api/v1/internal/prospecting-batches/${batch.id}/jobs/${event.jobId}/events`,
          )
          .set('X-API-Key', callbackKey)
          .send(event)
          .expect(200);
      }
      await http()
        .post(`${path}/reconcile`)
        .set('Authorization', authorization)
        .expect(200);
      const job = `${path}/jobs/${jobId}`;
      const preview = await http()
        .get(`${job}/results`)
        .set('Authorization', authorization)
        .expect(200);
      const view = preview.body as {
        data: { snapshotId: string; rows: Array<{ row: { name: string } }> };
      };
      expect(view.data.rows).toHaveLength(1);
      expect(view.data.rows[0].row.name).toBe('SYNTHETIC_RESULT_SENTINEL');
      const download = await http()
        .get(`${job}/export?format=csv`)
        .set('Authorization', authorization)
        .expect(200);
      expect(download.text).toContain('SYNTHETIC_RESULT_SENTINEL');
      const confirmation = await http()
        .post(`${job}/confirm`)
        .set('Authorization', authorization)
        .send({
          snapshotId: view.data.snapshotId,
          decisions: [{ index: 0, action: 'CREATE' }],
        })
        .expect(200);
      expect(confirmation.body).toMatchObject({
        data: {
          processedCount: 1,
          ackAt: expect.any(String) as unknown,
          purgedAt: expect.any(String) as unknown,
        },
      });
      expect(
        await prisma.prospect.count({
          where: { tenantId, name: 'SYNTHETIC_RESULT_SENTINEL' },
        }),
      ).toBe(1);
      await http()
        .get(`${job}/results`)
        .set('Authorization', authorization)
        .expect(410);
    },
    20000,
  );
});
