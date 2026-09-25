import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { createFakePrisma } from './support/fake-prisma';

type Row = Record<string, unknown>;
type Args = {
  where?: Row;
  data?: Row;
  select?: Record<string, boolean>;
  orderBy?: Record<string, string>[];
  skip?: number;
  take?: number;
};
const a = 'caaaaaaaaaaaaaaaaaaaaaaaa';
const b = 'cbbbbbbbbbbbbbbbbbbbbbbbb';
const other = 'cccccccccccccccccccccccc';
const createdId = 'cdddddddddddddddddddddddd';
const now = new Date('2026-09-24T00:00:00Z');

// Evaluate filters passed by the real service, including relation predicates.
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND')
      return (value as Row[]).every((part) => matches(row, part));
    if (key === 'OR')
      return (value as Row[]).some((part) => matches(row, part));
    if (value !== null && typeof value === 'object') {
      const condition = value as Row;
      if ('contains' in condition) {
        const field = row[key];
        return (typeof field === 'string' ? field : '')
          .toLowerCase()
          .includes(String(condition.contains).toLowerCase());
      }
      if ('some' in condition)
        return ((row[key] ?? []) as Row[]).some((item) =>
          matches(item, condition.some as Row),
        );
      return matches((row[key] ?? {}) as Row, condition);
    }
    return row[key] === value;
  });
}

function selected(row: Row, select?: Record<string, boolean>): Row {
  return select
    ? Object.fromEntries(
        Object.keys(select)
          .filter((key) => select[key])
          .map((key) => [key, row[key]]),
      )
    : { ...row };
}

function page(rows: Row[], args: Args): Row[] {
  return rows
    .filter((row) => matches(row, args.where))
    .sort((left, right) => {
      for (const order of args.orderBy ?? []) {
        const [key, direction] = Object.entries(order)[0];
        const comparison = String(left[key]).localeCompare(String(right[key]));
        if (comparison) return comparison * (direction === 'desc' ? -1 : 1);
      }
      return 0;
    })
    .slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? rows.length))
    .map((row) => selected(row, args.select));
}

function persistenceError(code: string): never {
  throw new Prisma.PrismaClientKnownRequestError('Test persistence error', {
    code,
    clientVersion: 'test',
  });
}

describe('Campaigns (e2e)', () => {
  let app: INestApplication;
  let campaigns: Row[];
  let prospects: Row[];
  let linkedJobs: Set<string>;
  let owner: string;
  let member: string;
  let tenantB: string;
  let admin: string;
  let globalAdmin: string;

  beforeEach(async () => {
    const fake = await createFakePrisma();
    campaigns = [
      {
        id: a,
        tenantId: 'tenant-a',
        name: 'Alpha',
        description: 'Restaurants',
        status: 'ACTIVA',
        createdBy: 'user-owner',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: b,
        tenantId: 'tenant-a',
        name: 'Beta',
        description: null,
        status: 'PAUSADA',
        createdBy: 'user-member',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: other,
        tenantId: 'tenant-b',
        name: 'Other',
        description: null,
        status: 'ACTIVA',
        createdBy: 'user-owner-b',
        createdAt: now,
        updatedAt: now,
      },
    ];
    prospects = [];
    linkedJobs = new Set();
    const prisma = Object.assign(fake, {
      campaign: {
        findFirst: (args: Args) => {
          const row = campaigns.find((item) => matches(item, args.where));
          return row ? selected(row, args.select) : null;
        },
        findMany: (args: Args) => page(campaigns, args),
        count: (args: Args) =>
          campaigns.filter((row) => matches(row, args.where)).length,
        create: (args: Args) => {
          const row = {
            id: createdId,
            description: null,
            status: 'ACTIVA',
            createdAt: now,
            updatedAt: now,
            ...Object.fromEntries(
              Object.entries(args.data ?? {}).filter(
                ([, value]) => value !== undefined,
              ),
            ),
          };
          campaigns.push(row);
          return selected(row, args.select);
        },
        update: (args: Args) => {
          const row = campaigns.find((item) => matches(item, args.where));
          if (!row) persistenceError('P2025');
          Object.assign(
            row,
            Object.fromEntries(
              Object.entries(args.data ?? {}).filter(
                ([, value]) => value !== undefined,
              ),
            ),
          );
          return selected(row, args.select);
        },
        delete: (args: Args) => {
          const index = campaigns.findIndex((item) =>
            matches(item, args.where),
          );
          if (index < 0) persistenceError('P2025');
          const row = campaigns[index];
          if (
            linkedJobs.has(String(row.id)) ||
            prospects.some(
              (prospect) =>
                prospect.campaignId === row.id ||
                ((prospect.campaignProspects ?? []) as Row[]).some(
                  (link) => link.campaignId === row.id,
                ),
            )
          )
            persistenceError('P2003');
          return campaigns.splice(index, 1)[0];
        },
      },
      prospect: {
        findMany: (args: Args) => page(prospects, args),
        count: (args: Args) =>
          prospects.filter((row) => matches(row, args.where)).length,
      },
    });
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
    owner = token('user-owner', 'tenant-a', 'OWNER');
    member = token('user-member', 'tenant-a', 'MEMBER');
    tenantB = token('user-owner-b', 'tenant-b', 'OWNER');
    admin = token('user-admin', 'tenant-a', null, 'ADMIN');
    globalAdmin = token('user-admin', null, null, 'ADMIN');
  });
  afterEach(async () => {
    await app?.close();
  });

  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

  it('protege todas las rutas y exige tenant incluso al ADMIN', async () => {
    for (const token of ['', globalAdmin]) {
      const requests = [
        http().get('/api/v1/campaigns'),
        http().post('/api/v1/campaigns').send({ name: 'Test' }),
        http().get(`/api/v1/campaigns/${a}`),
        http().patch(`/api/v1/campaigns/${a}`).send({ name: 'Changed' }),
        http().delete(`/api/v1/campaigns/${a}`),
        http().get(`/api/v1/campaigns/${a}/prospects`),
      ];
      const responses = await Promise.all(
        requests.map((call) =>
          call.set('Authorization', token ? `Bearer ${token}` : ''),
        ),
      );
      expect(responses.map((response) => response.status)).toEqual(
        Array(6).fill(token ? 403 : 401),
      );
    }
    expect(campaigns).toHaveLength(3);
  });

  it('MEMBER crea una campaña con identidad del contexto y respuesta pública', async () => {
    const response = await http()
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${member}`)
      .send({ name: 'New', description: 'Details' });
    expect(response.status).toBe(201);
    expect(response.body as unknown).toEqual({
      success: true,
      data: {
        id: createdId,
        name: 'New',
        description: 'Details',
        status: 'ACTIVA',
        createdBy: 'user-member',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
    expect(campaigns.find((row) => row.id === createdId)).toMatchObject({
      tenantId: 'tenant-a',
    });
  });

  it('pagina, busca y ordena sin mezclar tenants', async () => {
    const response = await http()
      .get('/api/v1/campaigns?page=2&limit=1&sortBy=name&sortOrder=desc')
      .set('Authorization', `Bearer ${owner}`);
    expect(response.status).toBe(200);
    expect(response.body as unknown).toMatchObject({
      data: [{ id: a }],
      meta: { page: 2, limit: 1, total: 2, totalPages: 2 },
    });
    const search = await http()
      .get('/api/v1/campaigns?search=RESTAURANTS')
      .set('Authorization', `Bearer ${owner}`);
    expect(search.body as unknown).toMatchObject({
      data: [{ id: a }],
      meta: { total: 1 },
    });
    const empty = await http()
      .get('/api/v1/campaigns?search=missing')
      .set('Authorization', `Bearer ${owner}`);
    expect(empty.body as unknown).toMatchObject({
      data: [],
      meta: { total: 0, totalPages: 0 },
    });
  });

  it('actualiza parcialmente, permite description null y conserva campos omitidos', async () => {
    const response = await http()
      .patch(`/api/v1/campaigns/${a}`)
      .set('Authorization', `Bearer ${member}`)
      .send({ description: null, status: 'COMPLETADA' });
    expect(response.status).toBe(200);
    expect(response.body as unknown).toMatchObject({
      data: {
        name: 'Alpha',
        description: null,
        status: 'COMPLETADA',
        createdBy: 'user-owner',
      },
    });
  });

  it.each([
    {},
    { name: null },
    { status: null },
    { status: 'RUNNING' },
    { createdBy: 'user-admin' },
    { tenantId: 'tenant-b' },
    { name: 12 },
  ])('rechaza PATCH inválido %j', async (body) => {
    const response = await http()
      .patch(`/api/v1/campaigns/${a}`)
      .set('Authorization', `Bearer ${owner}`)
      .send(body);
    expect(response.status).toBe(400);
    expect(campaigns[0].name).toBe('Alpha');
  });

  it.each([
    {},
    { name: null },
    { name: 1 },
    { name: 'X', tenantId: 'tenant-b' },
    { name: 'X', status: 'PAUSADA' },
    { name: 'X', createdBy: 'user-admin' },
  ])('rechaza POST inválido %j', async (body) => {
    expect(
      (
        await http()
          .post('/api/v1/campaigns')
          .set('Authorization', `Bearer ${owner}`)
          .send(body)
      ).status,
    ).toBe(400);
    expect(campaigns).toHaveLength(3);
  });

  it.each([
    'limit=101',
    'page=0',
    'page=1.5',
    'sortBy=tenantId',
    'sortBy=email',
    'sortOrder=invalid',
    'tenantId=tenant-b',
  ])('rechaza filtros inválidos %s', async (query) => {
    expect(
      (
        await http()
          .get(`/api/v1/campaigns?${query}`)
          .set('Authorization', `Bearer ${owner}`)
      ).status,
    ).toBe(400);
  });

  it('devuelve 404 al consultar o modificar campañas ajenas', async () => {
    const responses = await Promise.all(
      [
        http().get(`/api/v1/campaigns/${other}`),
        http().patch(`/api/v1/campaigns/${other}`).send({ name: 'Attack' }),
        http().delete(`/api/v1/campaigns/${other}`),
        http().get(`/api/v1/campaigns/${other}/prospects`),
      ].map((call) => call.set('Authorization', `Bearer ${owner}`)),
    );
    expect(responses.map((response) => response.status)).toEqual([
      404, 404, 404, 404,
    ]);
    expect(
      (
        await http()
          .delete(`/api/v1/campaigns/${other}?permanent=true`)
          .set('Authorization', `Bearer ${admin}`)
      ).status,
    ).toBe(404);
    expect(campaigns[2].name).toBe('Other');
  });

  it('archiva sin borrar, y permanent=false no se interpreta como true', async () => {
    const response = await http()
      .delete(`/api/v1/campaigns/${a}?permanent=false`)
      .set('Authorization', `Bearer ${member}`);
    expect(response.status).toBe(200);
    expect(response.body as unknown).toEqual({ success: true, data: {} });
    expect(campaigns[0].status).toBe('ARCHIVADA');
    expect(campaigns).toHaveLength(3);
    expect(
      (
        await http()
          .delete(`/api/v1/campaigns/${a}`)
          .set('Authorization', `Bearer ${owner}`)
      ).status,
    ).toBe(200);
  });

  it('reserva borrado físico a ADMIN y valida permanent', async () => {
    for (const token of [owner, member]) {
      expect(
        (
          await http()
            .delete(`/api/v1/campaigns/${a}?permanent=true`)
            .set('Authorization', `Bearer ${token}`)
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await http()
          .delete(`/api/v1/campaigns/${a}?permanent=oops`)
          .set('Authorization', `Bearer ${admin}`)
      ).status,
    ).toBe(400);
    expect(
      (
        await http()
          .delete(`/api/v1/campaigns/${a}?permanent=true`)
          .set('Authorization', `Bearer ${admin}`)
      ).status,
    ).toBe(200);
    expect(campaigns.some((row) => row.id === a)).toBe(false);
  });

  it('responde 409 si la campaña tiene jobs o prospectos relacionados', async () => {
    linkedJobs.add(a);
    expect(
      (
        await http()
          .delete(`/api/v1/campaigns/${a}?permanent=true`)
          .set('Authorization', `Bearer ${admin}`)
      ).status,
    ).toBe(409);
    linkedJobs.clear();
    prospects.push({ id: 'prospect', campaignId: a, tenantId: 'tenant-a' });
    expect(
      (
        await http()
          .delete(`/api/v1/campaigns/${a}?permanent=true`)
          .set('Authorization', `Bearer ${admin}`)
      ).status,
    ).toBe(409);
    expect(campaigns).toHaveLength(3);
  });

  it('lista prospectos de origen y asociados una sola vez, sin filtrar datos ajenos', async () => {
    prospects.push(
      {
        id: 'direct',
        campaignId: a,
        tenantId: 'tenant-a',
        name: 'Alpha Lead',
        campaignProspects: [
          { campaignId: a, campaign: { tenantId: 'tenant-a' } },
        ],
      },
      {
        id: 'linked',
        campaignId: b,
        tenantId: 'tenant-a',
        name: 'Beta Lead',
        campaignProspects: [
          { campaignId: a, campaign: { tenantId: 'tenant-a' } },
        ],
      },
      {
        id: 'foreign',
        campaignId: other,
        tenantId: 'tenant-b',
        name: 'Foreign Lead',
        campaignProspects: [
          { campaignId: a, campaign: { tenantId: 'tenant-a' } },
        ],
      },
      {
        id: 'unrelated',
        campaignId: b,
        tenantId: 'tenant-a',
        name: 'Unrelated',
      },
    );
    const response = await http()
      .get(`/api/v1/campaigns/${a}/prospects?limit=1&page=2`)
      .set('Authorization', `Bearer ${owner}`);
    expect(response.status).toBe(200);
    expect(response.body as unknown).toMatchObject({
      data: [{ id: 'linked', campaignId: b }],
      meta: { total: 2, totalPages: 2 },
    });
    expect(JSON.stringify(response.body)).not.toContain('tenantId');
    expect(JSON.stringify(response.body)).not.toContain('campaignProspects');
    const search = await http()
      .get(`/api/v1/campaigns/${a}/prospects?search=ALPHA`)
      .set('Authorization', `Bearer ${member}`);
    expect(search.body as unknown).toMatchObject({
      data: [{ id: 'direct' }],
      meta: { total: 1 },
    });
  });

  it('mantiene el tenant correcto en consultas concurrentes', async () => {
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        http()
          .get('/api/v1/campaigns')
          .set('Authorization', `Bearer ${i % 2 ? tenantB : owner}`),
      ),
    );
    responses.forEach((response, i) => {
      expect(response.status).toBe(200);
      expect(response.body as unknown).toMatchObject({
        data: i % 2 ? [{ id: other }] : [{ id: a }, { id: b }],
        meta: { total: i % 2 ? 1 : 2 },
      });
    });
  });
});
