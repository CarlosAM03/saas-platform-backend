import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContextService } from '../src/common/context/tenant-context.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { ProspectsController } from '../src/prospects/prospects.controller';
import { ProspectsService } from '../src/prospects/prospects.service';
import { CampaignsService } from '../src/campaigns/campaigns.service';

// Synthetic, disposable profile only. HTTP harness exercises DTOs/serialization,
// not the protected authentication/role guards (covered by the isolation suite).
describe('P2/P3 contextual reads and master update with PostgreSQL', () => {
  let db: PrismaService;
  let app: INestApplication<Server>;
  let service: ProspectsService;
  let actor: string;
  let tenants: string[];
  let campaigns: string[];
  let prospectId: string;
  let foreignId: string;
  const http = () => request(app.getHttpServer());
  const context = new TenantContextService();
  const run = <T>(fn: () => T) =>
    context.run(
      {
        tenantId: tenants[0],
        userId: actor,
        tenantRole: 'OWNER',
        platformRole: null,
      },
      fn,
    );
  const snapshot = async () => ({
    masters: await db.prospect.findMany({
      where: { tenantId: { in: tenants } },
      orderBy: { id: 'asc' },
    }),
    events: await db.prospectProvenance.findMany({
      where: { tenantId: { in: tenants } },
      orderBy: { id: 'asc' },
    }),
    activity: await db.campaignActivity.findMany({
      where: { tenantId: { in: tenants } },
      orderBy: { id: 'asc' },
    }),
    participations: await db.campaignProspect.findMany({
      where: { campaignId: { in: campaigns } },
      orderBy: [{ campaignId: 'asc' }, { prospectId: 'asc' }],
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
          name: 'Synthetic reader',
          email: `${randomUUID()}@synthetic.test`,
          passwordHash: 'not-used',
        },
      })
    ).id;
    service = new ProspectsService(db, context);
    const module = await Test.createTestingModule({
      controllers: [ProspectsController],
      providers: [{ provide: ProspectsService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.use((_req: Request, _res: Response, next: NextFunction) => run(next));
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  beforeEach(async () => {
    tenants = [];
    campaigns = [];
    for (let i = 0; i < 2; i++)
      tenants.push(
        (
          await db.tenant.create({
            data: { name: 'Synthetic tenant', slug: `reads-${randomUUID()}` },
          })
        ).id,
      );
    // A/B associated, C unassociated, D foreign.
    for (const tenantId of [tenants[0], tenants[0], tenants[0], tenants[1]]) {
      campaigns.push(
        (
          await db.campaign.create({
            data: { tenantId, createdBy: actor, name: 'Synthetic campaign' },
          })
        ).id,
      );
    }
    prospectId = (
      await db.prospect.create({
        data: {
          tenantId: tenants[0],
          campaignId: campaigns[0],
          source: 'manual',
          name: 'Shared master',
        },
      })
    ).id;
    foreignId = (
      await db.prospect.create({
        data: {
          tenantId: tenants[1],
          campaignId: campaigns[3],
          source: 'manual',
          name: 'Foreign master',
        },
      })
    ).id;
    await db.campaignProspect.createMany({
      data: [
        {
          campaignId: campaigns[0],
          prospectId,
          responsibleId: actor,
          commercialStage: 'SIN_GESTIONAR',
        },
        { campaignId: campaigns[1], prospectId, commercialStage: 'CONTACTADO' },
        { campaignId: campaigns[3], prospectId: foreignId },
      ],
    });
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
    await db.userTenant.deleteMany({ where });
    await db.role.deleteMany({ where });
    await db.tenant.deleteMany({ where: { id: { in: tenants } } });
    await db.user.update({ where: { id: actor }, data: { status: 'ACTIVO' } });
  });
  afterAll(async () => {
    if (app) await app.close();
    if (db) {
      if (actor) await db.user.delete({ where: { id: actor } });
      await db.$disconnect();
    }
  });

  it('P2 returns A/B once with contextual latest activity, stable tie order, nested meta and no writes', async () => {
    const recordedAt = new Date('2026-01-01T00:00:00Z');
    await db.campaignActivity.createMany({
      data: [
        {
          id: `a-${prospectId}`,
          tenantId: tenants[0],
          campaignId: campaigns[0],
          prospectId,
          type: 'NOTE',
          content: 'A old tie',
          recordedAt,
        },
        {
          id: `z-${prospectId}`,
          tenantId: tenants[0],
          campaignId: campaigns[0],
          prospectId,
          type: 'NOTE',
          content: 'A latest tie',
          recordedAt,
        },
        {
          tenantId: tenants[0],
          campaignId: campaigns[1],
          prospectId,
          type: 'NOTE',
          content: 'B only',
          recordedAt,
        },
        {
          tenantId: tenants[1],
          campaignId: campaigns[3],
          prospectId: foreignId,
          type: 'NOTE',
          content: 'Foreign secret',
        },
      ],
    });
    const before = await snapshot();
    const response = await http()
      .get(`/prospects/${prospectId}/campaigns`)
      .expect(200);
    const body = response.body as {
      data: Awaited<ReturnType<ProspectsService['campaignsForProspect']>>;
      meta?: unknown;
    };
    expect(body.data.originCampaignId).toBe(campaigns[0]);
    expect(body.data.meta).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
    expect(body.meta).toBeUndefined();
    const rows = body.data.campaigns;
    expect(rows).toHaveLength(2);
    expect(
      new Set(rows.map((row: { campaign: { id: string } }) => row.campaign.id))
        .size,
    ).toBe(2);
    expect(
      rows.find((row: { isOrigin: boolean }) => row.isOrigin),
    ).toMatchObject({
      stage: 'SIN_GESTIONAR',
      latestActivity: {
        id: `z-${prospectId}`,
        type: 'NOTE',
        content: 'A latest tie',
      },
      responsible: { id: actor, eligible: false },
    });
    expect(
      rows.find((row: { isOrigin: boolean }) => !row.isOrigin),
    ).toMatchObject({
      stage: 'CONTACTADO',
      latestActivity: { content: 'B only' },
      responsible: null,
    });
    expect(JSON.stringify(response.body)).not.toContain('userTenants');
    expect(JSON.stringify(response.body)).not.toContain('Foreign secret');
    const p1 = await run(() =>
      service.campaignsForProspect(prospectId, { page: 1, limit: 1 }),
    );
    const p2 = await run(() =>
      service.campaignsForProspect(prospectId, { page: 2, limit: 1 }),
    );
    expect(p1.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(p1.campaigns[0].campaign.id).not.toBe(p2.campaigns[0].campaign.id);
    expect(await snapshot()).toEqual(before);
  });

  it('AC-P2-02 mutating B leaves the A summary untouched', async () => {
    const campaignsService = new CampaignsService(db, context);
    const summarise = async () => {
      const result = await run(() => service.campaignsForProspect(prospectId));
      const pick = (campaignId: string) => {
        const row = result.campaigns.find(
          (item) => item.campaign.id === campaignId,
        )!;
        return {
          campaign: row.campaign,
          isOrigin: row.isOrigin,
          stage: row.stage,
          evaluation: row.evaluation,
          responsible: row.responsible,
          addedAt: row.addedAt,
        };
      };
      return { a: pick(campaigns[0]), b: pick(campaigns[1]) };
    };
    const before = await summarise();
    expect(before.a.isOrigin).toBe(true);
    expect(before.b.isOrigin).toBe(false);

    await run(() =>
      campaignsService.updateStage(campaigns[1], prospectId, 'CERRADO'),
    );
    await run(() =>
      campaignsService.updateEvaluation(
        campaigns[1],
        prospectId,
        'NO_APTO',
        'Synthetic reason for B',
      ),
    );

    const after = await summarise();
    // A's summary is byte-identical: no stage, evaluation or metadata drift.
    expect(after.a).toEqual(before.a);
    expect(after.b.stage).toBe('CERRADO');
    expect(after.b.evaluation).toBe('NO_APTO');
    // The master keeps pointing at its original campaign.
    expect(
      (await db.prospect.findUniqueOrThrow({ where: { id: prospectId } }))
        .campaignId,
    ).toBe(campaigns[0]);
  });

  it('AC-P3-04 returns only provenance rows backed by the database', async () => {
    const seeded = [
      {
        type: 'CREATED' as const,
        campaignId: campaigns[0],
        recordedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        type: 'LINKED' as const,
        campaignId: campaigns[1],
        recordedAt: new Date('2026-02-01T00:00:00Z'),
      },
      {
        type: 'MASTER_UPDATED' as const,
        campaignId: null,
        recordedAt: new Date('2026-03-01T00:00:00Z'),
      },
    ];
    for (const event of seeded)
      await db.prospectProvenance.create({
        data: {
          tenantId: tenants[0],
          prospectId,
          source: 'manual',
          actorUserId: actor,
          ...event,
        },
      });
    const page = await run(() =>
      service.provenance(prospectId, { page: 1, limit: 10 }),
    );
    const stored = await db.prospectProvenance.findMany({
      where: { tenantId: tenants[0], prospectId },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    });
    expect(page.meta).toEqual({ page: 1, limit: 10, total: 3, totalPages: 1 });
    expect(page.data.map((event) => event.id)).toEqual(
      stored.map((event) => event.id),
    );
    // Every exposed date, type and campaign comes from the stored row verbatim.
    for (const [index, event] of page.data.entries()) {
      expect(event.recordedAt.getTime()).toBe(
        stored[index].recordedAt.getTime(),
      );
      expect(event.type).toBe(stored[index].type);
      expect(event.campaignId).toBe(stored[index].campaignId);
      expect(event.source).toBe(stored[index].source);
    }
    expect(page.data[0]).toMatchObject({
      type: 'MASTER_UPDATED',
      campaignId: null,
    });
  });

  it('P2 eligibility requires active user AND membership in this tenant; empty activity is null', async () => {
    const role = await db.role.create({
      data: { tenantId: tenants[0], name: 'OWNER' },
    });
    const foreignRole = await db.role.create({
      data: { tenantId: tenants[1], name: 'OWNER' },
    });
    await db.userTenant.create({
      data: { userId: actor, tenantId: tenants[1], roleId: foreignRole.id },
    });
    let result = await run(() => service.campaignsForProspect(prospectId));
    expect(
      result.campaigns.find((row) => row.isOrigin)?.responsible?.eligible,
    ).toBe(false);
    await db.userTenant.create({
      data: { userId: actor, tenantId: tenants[0], roleId: role.id },
    });
    result = await run(() => service.campaignsForProspect(prospectId));
    expect(
      result.campaigns.find((row) => row.isOrigin)?.responsible?.eligible,
    ).toBe(true);
    await db.user.update({
      where: { id: actor },
      data: { status: 'INACTIVO' },
    });
    result = await run(() => service.campaignsForProspect(prospectId));
    expect(
      result.campaigns.find((row) => row.isOrigin)?.responsible?.eligible,
    ).toBe(false);
    expect(result.campaigns.every((row) => row.latestActivity === null)).toBe(
      true,
    );
    await db.userTenant.delete({
      where: { userId_tenantId: { userId: actor, tenantId: tenants[0] } },
    });
    await db.user.update({ where: { id: actor }, data: { status: 'ACTIVO' } });
    result = await run(() => service.campaignsForProspect(prospectId));
    expect(
      result.campaigns.find((row) => row.isOrigin)?.responsible?.eligible,
    ).toBe(false);
  });

  it('P3 pages tied recordedAt by id DESC with exact total, defaults, out-of-range and no writes', async () => {
    const recordedAt = new Date('2026-01-01T00:00:00Z');
    await db.prospectProvenance.createMany({
      data: ['a', 'b', 'c'].map((prefix) => ({
        id: `${prefix}-${prospectId}`,
        tenantId: tenants[0],
        prospectId,
        campaignId: campaigns[0],
        type: 'CREATED' as const,
        source: 'manual',
        recordedAt,
      })),
    });
    await db.prospectProvenance.create({
      data: {
        tenantId: tenants[1],
        prospectId: foreignId,
        type: 'CREATED',
        source: 'manual',
      },
    });
    const before = await snapshot();
    const first = await http()
      .get(`/prospects/${prospectId}/provenance?page=1&limit=2`)
      .expect(200);
    const firstBody = first.body as Awaited<
      ReturnType<ProspectsService['provenance']>
    >;
    expect(firstBody.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(firstBody.data.map((event: { id: string }) => event.id)).toEqual([
      `c-${prospectId}`,
      `b-${prospectId}`,
    ]);
    const second = await run(() =>
      service.provenance(prospectId, { page: 2, limit: 2 }),
    );
    expect(second.data.map((event) => event.id)).toEqual([`a-${prospectId}`]);
    expect(second.meta.total).toBe(3);
    const defaults = await http()
      .get(`/prospects/${prospectId}/provenance`)
      .expect(200);
    expect((defaults.body as { meta: unknown }).meta).toEqual({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });
    expect(
      (await run(() => service.provenance(prospectId, { page: 4, limit: 2 })))
        .data,
    ).toEqual([]);
    expect(await snapshot()).toEqual(before);
  });

  it.each(['campaigns', 'provenance'])(
    '%s validates page/limit without master sort and hides foreign prospect',
    async (route) => {
      const before = await snapshot();
      for (const query of [
        'page=0',
        'page=bad',
        'page=1.5',
        'limit=0',
        'limit=101',
        'limit=bad',
        'sortBy=name',
      ]) {
        await http()
          .get(`/prospects/${prospectId}/${route}?${query}`)
          .expect(400);
      }
      await http()
        .get(`/prospects/${prospectId}/${route}?limit=100`)
        .expect(200);
      await http().get(`/prospects/${foreignId}/${route}`).expect(404);
      expect(await snapshot()).toEqual(before);
    },
  );

  it('AC-P3-03 PATCH from B traces B while preserving origin A and commercial history', async () => {
    await db.campaignActivity.create({
      data: {
        tenantId: tenants[0],
        campaignId: campaigns[0],
        prospectId,
        type: 'NOTE',
        content: 'Historical commercial note in A',
      },
    });
    const before = await snapshot();
    const response = await http()
      .patch(`/prospects/${prospectId}`)
      .send({ name: 'Updated master', contextCampaignId: campaigns[1] })
      .expect(200);
    const body = response.body as {
      data: { campaignId: string; name: string; contextCampaignId?: string };
    };
    expect(body.data).toMatchObject({
      name: 'Updated master',
      campaignId: campaigns[0],
    });
    expect(body.data.contextCampaignId).toBeUndefined();
    const after = await snapshot();
    expect(after.activity).toEqual(before.activity);
    expect(after.participations).toEqual(before.participations);
    expect(after.events).toHaveLength(1);
    expect(after.events[0]).toMatchObject({
      prospectId,
      campaignId: campaigns[1],
      type: 'MASTER_UPDATED',
      actorUserId: actor,
      tenantId: tenants[0],
    });
    const original = before.masters.find((row) => row.id === prospectId)!;
    const updated = after.masters.find((row) => row.id === prospectId)!;
    expect(updated).toEqual({
      ...original,
      name: 'Updated master',
      updatedAt: updated.updatedAt,
    });
    await run(() => service.update(prospectId, { phone: '5550000000' }));
    expect(
      await db.prospectProvenance.count({
        where: { prospectId, campaignId: campaigns[0], type: 'MASTER_UPDATED' },
      }),
    ).toBe(1);
  });

  it('PATCH rejects foreign/unassociated context and foreign master atomically', async () => {
    const before = await snapshot();
    for (const contextCampaignId of [campaigns[2], campaigns[3], 'missing']) {
      await http()
        .patch(`/prospects/${prospectId}`)
        .send({ name: 'Must not persist', contextCampaignId })
        .expect(404);
    }
    await http()
      .patch(`/prospects/${foreignId}`)
      .send({ name: 'Must not persist', contextCampaignId: campaigns[0] })
      .expect(404);
    expect(await snapshot()).toEqual(before);
  });

  it('PATCH rejects context-only, null/blank/overlong/non-string context with zero effects', async () => {
    const before = await snapshot();
    await http()
      .patch(`/prospects/${prospectId}`)
      .send({ contextCampaignId: campaigns[1] })
      .expect(400);
    for (const contextCampaignId of [null, '', '   ', 'x'.repeat(129), 42]) {
      await http()
        .patch(`/prospects/${prospectId}`)
        .send({ name: 'No update', contextCampaignId })
        .expect(400);
    }
    expect(await snapshot()).toEqual(before);
  });
});
