import { NotFoundException } from '@nestjs/common';
import { CommercialEvaluation, CommercialStage, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { CampaignsService } from '../src/campaigns/campaigns.service';
import { CampaignProspectsQuery } from '../src/campaigns/dto/campaign-prospects.query';
import { TenantContextService } from '../src/common/context/tenant-context.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('G4 campaign performance on disposable PostgreSQL', () => {
  // Timeout del arnés, no SLA del producto.
  jest.setTimeout(180_000);
  const db = new PrismaService();
  const context = new TenantContextService();
  const service = new CampaignsService(db, context);
  const tenantIds = [randomUUID(), randomUUID()];
  const campaignIds = [randomUUID(), randomUUID(), randomUUID()];
  const userId = randomUUID();
  const stages = Object.values(CommercialStage);
  const evaluations = Object.values(CommercialEvaluation);
  const timings: Record<string, number[]> = {};
  let authorizedTarget = false;
  const rows = Array.from({ length: 5000 }, (_, index) => ({
    id: randomUUID(),
    index,
    stage: stages[index % stages.length],
    evaluation: evaluations[Math.floor(index / 6) % evaluations.length],
    category: index % 2 === 0 ? 'Restaurante' : 'Taller',
    address: Math.floor(index / 2) % 2 === 0 ? 'Zona Norte' : 'Zona Sur',
    source: Math.floor(index / 4) % 2 === 0 ? 'manual' : 'csv',
    responsibleId: index % 2 === 0 ? userId : null,
  }));
  const foreignRows = Array.from({ length: 1000 }, () => ({
    id: randomUUID(),
    tenantId: tenantIds[1],
    campaignId: campaignIds[2],
    name: 'Empresa sintetica homonima',
    category: 'Restaurante',
    address: 'Zona Norte',
    source: 'manual',
  }));
  const scope = <T>(tenantId: string, action: () => T): T =>
    context.run(
      { tenantId, userId, tenantRole: 'OWNER', platformRole: null },
      action,
    );
  const query = (values: Partial<CampaignProspectsQuery> = {}) =>
    Object.assign(new CampaignProspectsQuery(), {
      ...values,
      // Nombres iguales: fuerza el desempate estable por ID del servicio.
      sortBy: 'name' as const,
      sortOrder: 'asc' as const,
    });
  const list = (filter: CampaignProspectsQuery) =>
    scope(tenantIds[0], () => service.findProspects(campaignIds[0], filter));
  const dashboard = () =>
    scope(tenantIds[0], () => service.dashboard(campaignIds[0]));
  const measure = async <T>(label: string, action: () => Promise<T>) => {
    const start = performance.now();
    const result = await action();
    (timings[label] ??= []).push(performance.now() - start);
    return result;
  };
  const batch = async <T>(
    items: T[],
    insert: (chunk: T[]) => Promise<unknown>,
  ) => {
    for (let offset = 0; offset < items.length; offset += 500) {
      await insert(items.slice(offset, offset + 500));
    }
  };

  beforeAll(async () => {
    const raw = process.env.INTEGRATION_TEST_DATABASE_URL;
    if (!raw) throw new Error('Disposable Compose PostgreSQL required');
    const target = new URL(raw);
    if (
      !['postgres:', 'postgresql:'].includes(target.protocol) ||
      target.hostname !== 'test-db' ||
      target.pathname !== '/saas_test' ||
      process.env.DATABASE_ENV !== 'test' ||
      process.env.DATABASE_URL !== raw
    ) {
      throw new Error('Only the authorized Compose test database is allowed');
    }
    authorizedTarget = true;
    await db.$connect();
    const start = performance.now();
    await db.tenant.createMany({
      data: tenantIds.map((id) => ({ id, name: 'Tenant sintetico', slug: id })),
    });
    await db.user.create({
      data: {
        id: userId,
        name: 'Usuario sintetico',
        email: `${userId}@synthetic.test`,
        passwordHash: 'unused-synthetic-fixture',
      },
    });
    for (const tenantId of tenantIds) {
      const role = await db.role.create({
        data: { tenantId, name: 'OWNER' },
      });
      await db.userTenant.create({
        data: { userId, tenantId, roleId: role.id },
      });
    }
    await db.campaign.createMany({
      data: campaignIds.map((id, index) => ({
        id,
        tenantId: tenantIds[index === 2 ? 1 : 0],
        createdBy: userId,
        name: 'Campana sintetica homonima',
      })),
    });
    const prospects: Prisma.ProspectCreateManyInput[] = rows.map((row) => ({
      id: row.id,
      tenantId: tenantIds[0],
      campaignId: campaignIds[row.index % 3 === 1 ? 1 : 0],
      name: 'Empresa sintetica homonima',
      category: row.category,
      address: row.address,
      source: row.source,
    }));
    await batch([...prospects, ...foreignRows], (data) =>
      db.prospect.createMany({ data }),
    );
    const participations: Prisma.CampaignProspectCreateManyInput[] = rows.map(
      (row) => ({
        campaignId: campaignIds[0],
        prospectId: row.id,
        commercialStage: row.stage,
        evaluation: row.evaluation,
        evaluationReason:
          row.evaluation === 'NO_APTO' ? 'Motivo sintetico' : null,
        responsibleId: row.responsibleId,
      }),
    );
    participations.push(
      ...rows
        .filter((row) => row.index % 3 === 1)
        .map((row) => ({
          campaignId: campaignIds[1],
          prospectId: row.id,
        })),
      ...foreignRows.map((row) => ({
        campaignId: campaignIds[2],
        prospectId: row.id,
      })),
    );
    await batch(participations, (data) =>
      db.campaignProspect.createMany({ data }),
    );
    const subjects = [
      ...rows.map((row) => ({
        id: row.id,
        tenantId: tenantIds[0],
        campaignId: campaignIds[0],
      })),
      ...foreignRows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        campaignId: row.campaignId,
      })),
    ];
    const activities: Prisma.CampaignActivityCreateManyInput[] =
      subjects.flatMap((row) => {
        const base = {
          tenantId: row.tenantId,
          campaignId: row.campaignId,
          prospectId: row.id,
          actorUserId: userId,
        };
        return [
          { ...base, type: 'NOTE' as const, content: 'Nota sintetica' },
          { ...base, type: 'CALL' as const, content: 'Llamada sintetica' },
          { ...base, type: 'ASSOCIATION' as const },
        ];
      });
    await batch(activities, (data) => db.campaignActivity.createMany({ data }));
    // RI05: la reutilización exige LINKED real en la campaña primaria;
    // CREATED en otra campaña no basta. Fechas sintéticas ordenan ambos hechos.
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const linkedAt = new Date('2026-01-02T00:00:00.000Z');
    const provenance: Prisma.ProspectProvenanceCreateManyInput[] = rows
      .filter((row) => row.index % 3 !== 2)
      .map((row) => ({
        tenantId: tenantIds[0],
        prospectId: row.id,
        campaignId: campaignIds[row.index % 3 === 1 ? 1 : 0],
        type: 'CREATED',
        source: row.source,
        actorUserId: userId,
        recordedAt: createdAt,
      }));
    provenance.push(
      ...rows
        .filter((row) => row.index % 3 === 1)
        .map((row) => ({
          tenantId: tenantIds[0],
          prospectId: row.id,
          campaignId: campaignIds[0],
          type: 'LINKED' as const,
          source: row.source,
          actorUserId: userId,
          recordedAt: linkedAt,
        })),
    );
    await batch(provenance, (data) =>
      db.prospectProvenance.createMany({ data }),
    );
    // JSON saneado: solo tamaños y tiempos, sin identificadores ni secretos.
    console.info(
      'G4_PERF_FIXTURE',
      JSON.stringify({
        tenants: 2,
        campaigns: 3,
        masters: prospects.length + foreignRows.length,
        primaryParticipations: rows.length,
        totalParticipations: participations.length, // 7667
        activities: activities.length, // 18000
        provenance: provenance.length, // 5001
        seedMs: Number((performance.now() - start).toFixed(3)),
      }),
    );
  });

  afterAll(async () => {
    try {
      if (authorizedTarget) {
        // Orden FK; exclusivamente IDs aleatorios propios, aun con setup parcial.
        const where = { tenantId: { in: tenantIds } };
        await db.campaignActivity.deleteMany({ where });
        await db.prospectProvenance.deleteMany({ where });
        await db.campaignProspect.deleteMany({
          where: { campaignId: { in: campaignIds } },
        });
        await db.prospect.deleteMany({ where });
        await db.campaign.deleteMany({ where });
        await db.userTenant.deleteMany({ where });
        await db.role.deleteMany({ where });
        await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
        await db.user.deleteMany({ where: { id: userId } });
      }
    } finally {
      await db.$disconnect();
      const summary = Object.entries(timings).map(([label, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const round = (value: number) => Number(value.toFixed(3));
        return {
          label,
          samples: values.length,
          valuesMs: values.map(round),
          firstMs: round(values[0]),
          minMs: round(sorted[0]),
          medianMs: round(sorted[Math.floor(sorted.length / 2)]),
          maxMs: round(sorted[sorted.length - 1]),
        };
      });
      console.info('G4_PERF_SUMMARY', JSON.stringify(summary));
    }
  });

  it('applies AND filters globally and returns exact stable pages', async () => {
    const filter = query({
      search: 'sintetica',
      stage: 'CONTACTADO',
      evaluation: 'APTO',
      category: 'Restaurante',
      address: 'Norte',
      source: 'manual',
      responsibleId: userId,
      limit: 37,
    });
    // Oráculo independiente calculado desde la fixture.
    const expected = rows
      .filter(
        (row) =>
          row.stage === 'CONTACTADO' &&
          row.evaluation === 'APTO' &&
          row.category === 'Restaurante' &&
          row.address.includes('Norte') &&
          row.source === 'manual' &&
          row.responsibleId === userId,
      )
      .map((row) => row.id)
      .sort();
    expect(expected.length).toBeGreaterThan(filter.limit);
    // Cinco muestras descriptivas; la primera no se presume de caché fría.
    for (let sample = 0; sample < 5; sample++) {
      const result = await measure('filter_page_1', () => list(filter));
      expect(result.meta).toEqual({
        page: 1,
        limit: 37,
        total: expected.length,
        totalPages: Math.ceil(expected.length / 37),
      });
      expect(result.data.map((row) => row.id)).toEqual(expected.slice(0, 37));
    }
    const seen: string[] = [];
    const totalPages = Math.ceil(expected.length / 37);
    for (let page = 1; page <= totalPages; page++) {
      const result = await list(query({ ...filter, page }));
      expect(result.meta).toEqual({
        page,
        limit: 37,
        total: expected.length,
        totalPages,
      });
      expect(result.data.map((row) => row.id)).toEqual(
        expected.slice((page - 1) * 37, page * 37),
      );
      seen.push(...result.data.map((row) => row.id));
    }
    expect(seen).toEqual(expected);
    expect(new Set(seen).size).toBe(expected.length);
    const outside = await list(query({ ...filter, page: totalPages + 1 }));
    expect(outside.data).toEqual([]);
    expect(outside.meta.total).toBe(expected.length);
  });

  it('measures deep offset pagination without inflated counts', async () => {
    const expected = rows.map((row) => row.id).sort();
    for (let sample = 0; sample < 5; sample++) {
      const result = await measure('unfiltered_page_100', () =>
        list(query({ page: 100, limit: 50 })),
      );
      expect(result.meta).toEqual({
        page: 100,
        limit: 50,
        total: 5000,
        totalPages: 100,
      });
      expect(result.data.map((row) => row.id)).toEqual(expected.slice(4950));
    }
    const first = await list(query({ page: 1, limit: 50 }));
    const second = await list(query({ page: 2, limit: 50 }));
    expect(first.data.map((row) => row.id)).toEqual(expected.slice(0, 50));
    expect(second.data.map((row) => row.id)).toEqual(expected.slice(50, 100));
    const outside = await list(query({ page: 101, limit: 50 }));
    expect(outside.data).toEqual([]);
    expect(outside.meta.total).toBe(5000);
  });

  it('measures the dashboard and verifies every aggregate independently', async () => {
    const expectedStages = Object.fromEntries(
      stages.map((stage) => [
        stage,
        rows.filter((row) => row.stage === stage).length,
      ]),
    );
    const expectedEvaluations = Object.fromEntries(
      evaluations.map((evaluation) => [
        evaluation,
        rows.filter((row) => row.evaluation === evaluation).length,
      ]),
    );
    for (let sample = 0; sample < 5; sample++) {
      const result = await measure('dashboard_5000', dashboard);
      expect(result).toEqual({
        total: 5000,
        stages: expectedStages,
        evaluations: expectedEvaluations,
        responsibility: { [userId]: 2500, SIN_ASIGNAR: 2500 },
        activity: { total: 15000, manual: 10000, events: 5000 },
        incorporation: { new: 1667, reused: 1667, unknownLegacy: 1666 },
      });
      expect(
        Object.values(result.stages).reduce((sum, count) => sum + count, 0),
      ).toBe(result.total);
      expect(
        Object.values(result.evaluations).reduce(
          (sum, count) => sum + count,
          0,
        ),
      ).toBe(result.total);
    }
    const secondary = await scope(tenantIds[0], () =>
      service.dashboard(campaignIds[1]),
    );
    expect(secondary.total).toBe(1667);
    expect(secondary.activity).toEqual({ total: 0, manual: 0, events: 0 });
    expect(secondary.incorporation).toEqual({
      new: 1667,
      reused: 0,
      unknownLegacy: 0,
    });
  });

  it('keeps homonymous tenant datasets isolated at volume', async () => {
    const foreignDashboard = await scope(tenantIds[1], () =>
      service.dashboard(campaignIds[2]),
    );
    expect(foreignDashboard.total).toBe(1000);
    expect(foreignDashboard.activity).toEqual({
      total: 3000,
      manual: 2000,
      events: 1000,
    });
    expect(foreignDashboard.incorporation).toEqual({
      new: 0,
      reused: 0,
      unknownLegacy: 1000,
    });
    const foreignList = await scope(tenantIds[1], () =>
      service.findProspects(
        campaignIds[2],
        query({ search: 'sintetica', limit: 100 }),
      ),
    );
    expect(foreignList.meta.total).toBe(1000);
    expect(foreignList.data).toHaveLength(100);
    const foreignIds = new Set(foreignRows.map((row) => row.id));
    expect(foreignList.data.every((row) => foreignIds.has(row.id))).toBe(true);
    await expect(
      scope(tenantIds[0], () => service.dashboard(campaignIds[2])),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      scope(tenantIds[1], () => service.findProspects(campaignIds[0], query())),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
