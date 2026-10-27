import type { Role } from '@prisma/client';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Core identity protection with the baseline PostgreSQL schema', () => {
  let app: INestApplication;
  let db: PrismaService;
  const tenants: string[] = [];
  const users: string[] = [];
  const roles: Role[] = [];
  let a: string, b: string, ownerId: string, sharedId: string, adminId: string;
  let localId: string, memberRole: string, ownerRole: string, bRole: string;
  let owner: string, member: string, admin: string;
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);
  const patch = (id: string, body: object, token = owner) =>
    http()
      .patch('/api/v1/users/' + id)
      .set('Authorization', 'Bearer ' + token)
      .send(body);

  beforeAll(async () => {
    if (!process.env.INTEGRATION_TEST_DATABASE_URL)
      throw new Error('Explicit disposable database required');
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
    for (const name of ['A', 'B']) {
      const t = await db.tenant.create({
        data: { name, slug: 'core-' + randomUUID() },
      });
      tenants.push(t.id);
    }
    [a, b] = tenants;
    for (const [tenantId, name] of [
      [a, 'OWNER'],
      [a, 'MEMBER'],
      [b, 'MEMBER'],
    ] as const) {
      roles.push(await db.role.create({ data: { tenantId, name } }));
    }
    ownerRole = roles[0].id;
    memberRole = roles[1].id;
    bRole = roles[2].id;
    for (const name of ['owner', 'shared', 'admin', 'local']) {
      const u = await db.user.create({
        data: {
          name,
          email: randomUUID() + '@test.example',
          passwordHash: 'not-used',
          platformRole: name === 'admin' ? 'ADMIN' : null,
        },
      });
      users.push(u.id);
    }
    [ownerId, sharedId, adminId, localId] = users;
    for (const [userId, tenantId, roleId] of [
      [ownerId, a, ownerRole],
      [sharedId, a, memberRole],
      [sharedId, b, bRole],
      [adminId, a, memberRole],
      [localId, a, memberRole],
    ]) {
      await db.userTenant.create({ data: { userId, tenantId, roleId } });
    }
    const jwt = app.get(JwtService);
    owner = jwt.sign({
      sub: ownerId,
      email: 'owner@test.example',
      tenantId: a,
      tenantRole: 'OWNER',
      platformRole: null,
    });
    member = jwt.sign({
      sub: sharedId,
      email: 'member@test.example',
      tenantId: a,
      tenantRole: 'MEMBER',
      platformRole: null,
    });
    admin = jwt.sign({
      sub: adminId,
      email: 'admin@test.example',
      tenantId: a,
      tenantRole: null,
      platformRole: 'ADMIN',
    });
  });

  afterAll(async () => {
    if (db) {
      await db.userTenant.deleteMany({ where: { userId: { in: users } } });
      await db.role.deleteMany({
        where: { id: { in: roles.map((role) => role.id) } },
      });
      await db.tenant.deleteMany({ where: { id: { in: tenants } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    await app?.close();
  });

  it('has no experimental tables or columns', async () => {
    const rows = await db.$queryRaw<
      Array<{ table_name: string }>
    >`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('prospecting_job_events','prospecting_job_snapshots','prospecting_job_requests')`;
    expect(rows).toEqual([]);
    const columns = await db.$queryRaw<
      Array<{ column_name: string }>
    >`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='prospecting_jobs' AND column_name IN ('dispatch_state','idempotency_key_hash','results_expires_at')`;
    expect(columns).toEqual([]);
  });

  it.each([
    { name: 'Forbidden' },
    { email: 'forbidden@test.example' },
    { password: 'DeniedUpdate123!' },
    { status: 'INACTIVO' },
  ])('rejects shared identity edit atomically: %p', async (body) => {
    const before = await db.user.findUniqueOrThrow({ where: { id: sharedId } });
    await patch(sharedId, { ...body, roleId: ownerRole }).expect(403);
    expect(
      await db.user.findUniqueOrThrow({ where: { id: sharedId } }),
    ).toEqual(before);
    expect(
      (
        await db.userTenant.findUniqueOrThrow({
          where: { userId_tenantId: { userId: sharedId, tenantId: a } },
        })
      ).roleId,
    ).toBe(memberRole);
  });

  it('protects another ADMIN identity', async () => {
    await patch(adminId, { name: 'Forbidden' }).expect(403);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: adminId } })).name,
    ).toBe('admin');
  });

  it('allows local identity, own identity, and platform administration', async () => {
    await patch(localId, { name: 'Local edit' }).expect(200);
    await patch(ownerId, { name: 'Own edit' }).expect(200);
    await patch(sharedId, { name: 'Global edit' }, admin).expect(200);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: sharedId } })).name,
    ).toBe('Global edit');
  });

  it('changes only the local membership for a shared user', async () => {
    await patch(sharedId, { roleId: ownerRole }).expect(200);
    expect(
      (
        await db.userTenant.findUniqueOrThrow({
          where: { userId_tenantId: { userId: sharedId, tenantId: b } },
        })
      ).roleId,
    ).toBe(bRole);
    await db.userTenant.update({
      where: { userId_tenantId: { userId: sharedId, tenantId: a } },
      data: { roleId: memberRole },
    });
  });

  it('denies MEMBER administration and cross-tenant identifiers', async () => {
    await patch(localId, { name: 'Forbidden' }, member).expect(403);
    const external = await db.user.create({
      data: {
        name: 'B only',
        email: randomUUID() + '@test.example',
        passwordHash: 'not-used',
      },
    });
    users.push(external.id);
    await db.userTenant.create({
      data: { userId: external.id, tenantId: b, roleId: bRole },
    });
    await patch(external.id, { name: 'Forbidden' }).expect(404);
  });

  it('keeps the approved JWT snapshot and rejects inactive identities', async () => {
    await db.userTenant.update({
      where: { userId_tenantId: { userId: ownerId, tenantId: a } },
      data: { roleId: memberRole },
    });
    try {
      // Deliberate residual policy: prior OWNER JWT stays authorized until expiry/new token.
      await patch(localId, { name: 'Snapshot authorized edit' }).expect(200);
      await db.user.update({
        where: { id: ownerId },
        data: { status: 'INACTIVO' },
      });
      await http()
        .get('/api/v1/users')
        .set('Authorization', 'Bearer ' + owner)
        .expect(401);
    } finally {
      await db.user.update({
        where: { id: ownerId },
        data: { status: 'ACTIVO' },
      });
      await db.userTenant.update({
        where: { userId_tenantId: { userId: ownerId, tenantId: a } },
        data: { roleId: ownerRole },
      });
    }
  });
});
