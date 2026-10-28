import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import type { UserResponse } from '../src/users/dto/user.response';
type WireUser = Omit<UserResponse, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
  passwordHash?: never;
};

describe('G1 BR03 authoritative user administration and QF01 (PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService, reader: PrismaClient;
  let a: string,
    b: string,
    ownerId: string,
    sharedId: string,
    localId: string,
    adminId: string;
  let ownerRole: string, memberRole: string, bOwner: string, bMember: string;
  let owner: string, admin: string, adminB: string;
  let userIds: string[];
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);
  const patch = (id: string, body: object, token = owner) =>
    http()
      .patch('/api/v1/users/' + id)
      .set('Authorization', 'Bearer ' + token)
      .send(body);
  const post = (roleId: string | undefined, token = owner) =>
    http()
      .post('/api/v1/users')
      .set('Authorization', 'Bearer ' + token)
      .send({
        name: 'Synthetic member',
        email: randomUUID() + '@example.test',
        password: 'Synthetic-password-123!',
        ...(roleId ? { roleId } : {}),
      });
  beforeAll(async () => {
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
    db = app.get(PrismaService);
    reader = new PrismaClient();
    await reader.$connect();
  });
  beforeEach(async () => {
    userIds = [];
    a = (
      await db.tenant.create({
        data: { name: 'ACME synthetic', slug: 'g1-a-' + randomUUID() },
      })
    ).id;
    b = (
      await db.tenant.create({
        data: { name: 'B synthetic', slug: 'g1-b-' + randomUUID() },
      })
    ).id;
    ownerRole = (await db.role.create({ data: { tenantId: a, name: 'OWNER' } }))
      .id;
    memberRole = (
      await db.role.create({ data: { tenantId: a, name: 'MEMBER' } })
    ).id;
    bOwner = (await db.role.create({ data: { tenantId: b, name: 'OWNER' } }))
      .id;
    bMember = (await db.role.create({ data: { tenantId: b, name: 'MEMBER' } }))
      .id;
    for (const name of ['owner', 'shared', 'local', 'admin']) {
      userIds.push(
        (
          await db.user.create({
            data: {
              name,
              email: randomUUID() + '@example.test',
              passwordHash: 'unused',
              platformRole: name === 'admin' ? 'ADMIN' : null,
            },
          })
        ).id,
      );
    }
    [ownerId, sharedId, localId, adminId] = userIds;
    for (const [userId, tenantId, roleId] of [
      [ownerId, a, ownerRole],
      [sharedId, a, memberRole],
      [sharedId, b, bMember],
      [localId, a, memberRole],
      [adminId, a, memberRole],
    ])
      await db.userTenant.create({ data: { userId, tenantId, roleId } });
    const jwt = app.get(JwtService);
    const sign = (
      id: string,
      tenantId: string,
      platformRole: string | null,
      tenantRole: string | null,
    ) =>
      jwt.sign({
        sub: id,
        email: 'synthetic@example.test',
        tenantId,
        platformRole,
        tenantRole,
      });
    owner = sign(ownerId, a, null, 'OWNER');
    admin = sign(adminId, a, 'ADMIN', null);
    adminB = sign(adminId, b, 'ADMIN', null);
  });
  afterEach(async () => {
    await db.campaignProspect.deleteMany({
      where: { campaign: { tenantId: { in: [a, b] } } },
    });
    await db.prospect.deleteMany({ where: { tenantId: { in: [a, b] } } });
    await db.campaign.deleteMany({ where: { tenantId: { in: [a, b] } } });
    const memberships = await db.userTenant.findMany({
      where: { tenantId: { in: [a, b] } },
    });
    userIds.push(...memberships.map((m) => m.userId));
    await db.userTenant.deleteMany({ where: { tenantId: { in: [a, b] } } });
    await db.role.deleteMany({ where: { tenantId: { in: [a, b] } } });
    await db.tenant.deleteMany({ where: { id: { in: [a, b] } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  });
  afterAll(async () => {
    await reader?.$disconnect();
    await app?.close();
  });
  it('OWNER POST cannot assign OWNER and leaves no partial identity', async () => {
    const before = await reader.user.count();
    await post(ownerRole).expect(403);
    expect(await reader.user.count()).toBe(before);
  });
  it('OWNER PATCH cannot promote MEMBER and leaves identity and membership unchanged', async () => {
    const before = await reader.user.findUniqueOrThrow({
      where: { id: localId },
    });
    await patch(localId, { name: 'Forbidden', roleId: ownerRole }).expect(403);
    expect(
      await reader.user.findUniqueOrThrow({ where: { id: localId } }),
    ).toEqual(before);
    expect(
      (
        await reader.userTenant.findUniqueOrThrow({
          where: { userId_tenantId: { userId: localId, tenantId: a } },
        })
      ).roleId,
    ).toBe(memberRole);
  });
  it('ADMIN second OWNER POST/PATCH returns 409 without partial writes', async () => {
    const before = await reader.user.count();
    await post(ownerRole, admin).expect(409);
    await patch(
      localId,
      { name: 'Forbidden', roleId: ownerRole },
      admin,
    ).expect(409);
    expect(await reader.user.count()).toBe(before);
    expect(
      (await reader.user.findUniqueOrThrow({ where: { id: localId } })).name,
    ).toBe('local');
  });
  it('concurrent ADMIN POST assigns exactly one first OWNER', async () => {
    const responses = await Promise.all([
      post(bOwner, adminB),
      post(bOwner, adminB),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      await reader.userTenant.count({ where: { tenantId: b, roleId: bOwner } }),
    ).toBe(1);
  });
  it('concurrent ADMIN PATCH assigns exactly one first OWNER', async () => {
    await db.userTenant.create({
      data: { userId: localId, tenantId: b, roleId: bMember },
    });
    const responses = await Promise.all([
      patch(localId, { roleId: bOwner }, adminB),
      patch(sharedId, { roleId: bOwner }, adminB),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await reader.userTenant.count({ where: { tenantId: b, roleId: bOwner } }),
    ).toBe(1);
  });
  it('revalidates a prior OWNER JWT after demotion without mutations', async () => {
    await db.userTenant.update({
      where: { userId_tenantId: { userId: ownerId, tenantId: a } },
      data: { roleId: memberRole },
    });
    const before = await reader.user.count();
    await post(undefined).expect(403);
    await patch(localId, { name: 'Forbidden' }).expect(403);
    expect(await reader.user.count()).toBe(before);
    expect(
      (await reader.user.findUniqueOrThrow({ where: { id: localId } })).name,
    ).toBe('local');
  });
  it('revalidates a prior ADMIN JWT after global demotion', async () => {
    await db.user.update({
      where: { id: adminId },
      data: { platformRole: null },
    });
    await post(undefined, admin).expect(403);
    await patch(localId, { status: 'INACTIVO' }, admin).expect(403);
    await http()
      .delete('/api/v1/users/' + localId)
      .set('Authorization', 'Bearer ' + admin)
      .expect(403);
    expect(
      (await reader.user.findUniqueOrThrow({ where: { id: localId } })).status,
    ).toBe('ACTIVO');
  });
  it('blocks shared self editing and another OWNER', async () => {
    await db.userTenant.create({
      data: { userId: ownerId, tenantId: b, roleId: bMember },
    });
    await patch(ownerId, { name: 'Forbidden' }).expect(403);
    await db.userTenant.update({
      where: { userId_tenantId: { userId: sharedId, tenantId: b } },
      data: { roleId: bOwner },
    });
    await patch(sharedId, { status: 'INACTIVO' }).expect(403);
    expect(
      (await reader.user.findUniqueOrThrow({ where: { id: ownerId } })).name,
    ).toBe('owner');
  });
  it('ADMIN cannot deactivate or demote the last operational OWNER', async () => {
    await patch(ownerId, { roleId: memberRole }, admin).expect(409);
    await patch(ownerId, { status: 'INACTIVO' }, admin).expect(409);
    await http()
      .delete('/api/v1/users/' + ownerId)
      .set('Authorization', 'Bearer ' + admin)
      .expect(409);
    expect(
      (await reader.user.findUniqueOrThrow({ where: { id: ownerId } })).status,
    ).toBe('ACTIVO');
  });
  it('creates conventional MEMBER and rereads valid paginated QF01 JSON across tenants', async () => {
    const created = await post(undefined).expect(201);
    const createdBody = created.body as { data: WireUser };
    expect(
      (
        await reader.userTenant.findUniqueOrThrow({
          where: {
            userId_tenantId: { userId: createdBody.data.id, tenantId: a },
          },
          include: { role: true },
        })
      ).role.name,
    ).toBe('MEMBER');
    for (const token of [admin, owner, adminB, admin]) {
      const r = await http()
        .get('/api/v1/users?page=1&limit=100')
        .set('Authorization', 'Bearer ' + token)
        .expect(200);
      const body = r.body as {
        success: boolean;
        data: WireUser[];
        meta: { total: number };
      };
      expect(body.success).toBe(true);
      expect(body.meta.total).toBeGreaterThan(0);
      for (const u of body.data) {
        expect(typeof u.id).toBe('string');
        expect(typeof u.email).toBe('string');
        expect([null, 'ADMIN']).toContain(u.platformRole);
        expect(['OWNER', 'MEMBER']).toContain(u.role!.name);
        expect(Number.isNaN(Date.parse(u.createdAt))).toBe(false);
        expect(u.tenants).toHaveLength(1);
        expect(u.tenants[0].role.tenantId).toBe(u.role!.tenantId);
        expect(u.passwordHash).toBeUndefined();
      }
    }
  });

  it('preserves Campaign and Prospect CRUD, relationships and tenant isolation', async () => {
    const result = await http()
      .post('/api/v1/campaigns')
      .set('Authorization', 'Bearer ' + owner)
      .send({ name: 'Synthetic campaign', description: 'before' })
      .expect(201);
    const campaignId = (result.body as { data: { id: string } }).data.id;
    expect(
      (await reader.campaign.findUniqueOrThrow({ where: { id: campaignId } }))
        .createdBy,
    ).toBe(ownerId);
    await http()
      .patch('/api/v1/campaigns/' + campaignId)
      .set('Authorization', 'Bearer ' + owner)
      .send({ description: null, status: 'PAUSADA' })
      .expect(200);
    expect(
      (await reader.campaign.findUniqueOrThrow({ where: { id: campaignId } }))
        .description,
    ).toBeNull();
    await http()
      .get('/api/v1/campaigns/' + campaignId)
      .set('Authorization', 'Bearer ' + adminB)
      .expect(404);
    const created = await http()
      .post('/api/v1/prospects')
      .set('Authorization', 'Bearer ' + owner)
      .send({
        campaignId,
        name: 'Synthetic manual',
        email: 'prospect@example.test',
      })
      .expect(201);
    const prospectId = (created.body as { data: { id: string } }).data.id;
    expect(
      (await reader.prospect.findUniqueOrThrow({ where: { id: prospectId } }))
        .tenantId,
    ).toBe(a);
    await http()
      .patch('/api/v1/prospects/' + prospectId)
      .set('Authorization', 'Bearer ' + owner)
      .send({ email: null, status: 'INACTIVO' })
      .expect(200);
    const before = await reader.prospect.findUniqueOrThrow({
      where: { id: prospectId },
    });
    expect(before.email).toBeNull();
    await http()
      .patch('/api/v1/prospects/' + prospectId)
      .set('Authorization', 'Bearer ' + adminB)
      .send({ name: 'Forbidden' })
      .expect(404);
    expect(
      await reader.prospect.findUniqueOrThrow({ where: { id: prospectId } }),
    ).toEqual(before);
    const listing = await http()
      .get('/api/v1/campaigns/' + campaignId + '/prospects?page=1&limit=1')
      .set('Authorization', 'Bearer ' + owner)
      .expect(200);
    expect((listing.body as { data: { id: string }[] }).data[0].id).toBe(
      prospectId,
    );
    await http()
      .delete('/api/v1/campaigns/' + campaignId)
      .set('Authorization', 'Bearer ' + owner)
      .expect(200);
    expect(
      (await reader.campaign.findUniqueOrThrow({ where: { id: campaignId } }))
        .status,
    ).toBe('ARCHIVADA');
    await http()
      .delete('/api/v1/campaigns/' + campaignId + '?permanent=true')
      .set('Authorization', 'Bearer ' + owner)
      .expect(403);
    await http()
      .delete('/api/v1/campaigns/' + campaignId + '?permanent=true')
      .set('Authorization', 'Bearer ' + admin)
      .expect(409);
  });
  it('persists CSV CREATE, SKIP, LINK_EXISTING and UPDATE_EXISTING via HTTP', async () => {
    const origin = await db.campaign.create({
      data: { tenantId: a, createdBy: ownerId, name: 'CSV origin' },
    });
    const target = await db.campaign.create({
      data: { tenantId: a, createdBy: ownerId, name: 'CSV target' },
    });
    const confirm = async (
      campaignId: string,
      file: Buffer,
      decisions: object[],
    ) => {
      const preview = await http()
        .post('/api/v1/prospects/import/preview')
        .set('Authorization', 'Bearer ' + owner)
        .field('campaignId', campaignId)
        .attach('file', file, 'synthetic.csv')
        .expect(200);
      const reference = (preview.body as { data: { previewReference: string } })
        .data.previewReference;
      return http()
        .post('/api/v1/prospects/import/confirm')
        .set('Authorization', 'Bearer ' + owner)
        .field('campaignId', campaignId)
        .field('previewReference', reference)
        .field('decisions', JSON.stringify(decisions))
        .attach('file', file, 'synthetic.csv')
        .expect(200);
    };
    await confirm(
      origin.id,
      Buffer.from(
        'name,email\nCSV Alpha,alpha@example.test\nCSV Skip,skip@example.test',
      ),
      [
        { record: 1, action: 'CREATE' },
        { record: 2, action: 'SKIP' },
      ],
    );
    expect(await reader.prospect.count({ where: { tenantId: a } })).toBe(1);
    const prospect = await reader.prospect.findFirstOrThrow({
      where: { tenantId: a },
    });
    expect(prospect.source).toBe('csv');
    expect(prospect.campaignId).toBe(origin.id);
    const update = Buffer.from('name,email\nCSV Alpha,changed@example.test');
    await confirm(target.id, update, [{ record: 1, action: 'LINK_EXISTING' }]);
    expect(
      await reader.campaignProspect.count({
        where: { campaignId: target.id, prospectId: prospect.id },
      }),
    ).toBe(1);
    expect(
      (await reader.prospect.findUniqueOrThrow({ where: { id: prospect.id } }))
        .email,
    ).toBe('alpha@example.test');
    await confirm(target.id, update, [
      { record: 1, action: 'UPDATE_EXISTING' },
    ]);
    expect(
      (await reader.prospect.findUniqueOrThrow({ where: { id: prospect.id } }))
        .email,
    ).toBe('changed@example.test');
    expect(await reader.prospect.count({ where: { tenantId: a } })).toBe(1);
  });
});
