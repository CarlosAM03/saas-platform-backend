import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { secretHash } from '../src/tenant-registration/activation.service';

type RegistrationBody = {
  data: {
    tenant: { id: string };
    onboarding: { ownerUserId: string; deliveryStatus: string };
  };
};
describe('G1 complete HTTP onboarding with real PostgreSQL and simulated Brevo HTTPS', () => {
  let app: INestApplication,
    db: PrismaService,
    reader: PrismaClient,
    config: ConfigService;
  let adminId: string,
    admin: string,
    tenantIds: string[],
    userIds: string[],
    token: string;
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);
  const dto = () => ({
    tenantName: 'Synthetic HTTP tenant',
    tenantSlug: 'http-' + randomUUID(),
    ownerName: 'Synthetic owner',
    ownerEmail: randomUUID() + '@example.test',
  });
  const register = async (
    status = 201,
    body = '{"messageId":"synthetic-message"}',
  ) => {
    jest.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      const mail = JSON.parse(options?.body as string) as {
        textContent: string;
      };
      const match = mail.textContent.match(/code=([^\s]+)/);
      token = decodeURIComponent(match![1]);
      if (status === 0)
        return Promise.reject(
          new DOMException('Synthetic timeout', 'AbortError'),
        );
      return Promise.resolve(new Response(body, { status }));
    });
    const response = await http()
      .post('/api/v1/tenants/register')
      .set('Authorization', 'Bearer ' + admin)
      .send(dto())
      .expect(201);
    const result = response.body as RegistrationBody;
    tenantIds.push(result.data.tenant.id);
    userIds.push(result.data.onboarding.ownerUserId);
    return result.data;
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
    db = app.get(PrismaService);
    reader = new PrismaClient();
    await reader.$connect();
    config = app.get(ConfigService);
  });
  beforeEach(async () => {
    tenantIds = [];
    userIds = [];
    adminId = (
      await db.user.create({
        data: {
          name: 'Synthetic admin',
          email: randomUUID() + '@example.test',
          passwordHash: 'unused',
          platformRole: 'ADMIN',
        },
      })
    ).id;
    admin = app.get(JwtService).sign({
      sub: adminId,
      email: 'admin@example.test',
      platformRole: 'ADMIN',
      tenantId: null,
      tenantRole: null,
    });
    config.set('TENANT_REGISTRATION_ENABLED', true);
    config.set(
      'PLATFORM_ACTIVATION_URL',
      'https://frontend.example/#/activate',
    );
    config.set('BREVO_API_KEY', 'synthetic-not-real');
    config.set('BREVO_FROM_EMAIL', 'sender@example.com');
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    config.set('TENANT_REGISTRATION_ENABLED', false);
    const onboardings = await db.tenantOnboarding.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { id: true },
    });
    const where = { onboardingId: { in: onboardings.map((o) => o.id) } };
    await db.firstAccessChallenge.deleteMany({ where });
    await db.activationLink.deleteMany({ where });
    await db.deliveryAttempt.deleteMany({ where });
    await db.tenantOnboarding.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await db.userTenant.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.role.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.user.deleteMany({ where: { id: { in: [...userIds, adminId] } } });
    await db.activationRateLimit.deleteMany({
      where: {
        key: {
          in: [
            'redeem:ip:' + secretHash('::ffff:127.0.0.1'),
            'complete:ip:' + secretHash('::ffff:127.0.0.1'),
            'redeem:credential:' + secretHash(token || ''),
          ],
        },
      },
    });
  });
  afterAll(async () => {
    await reader?.$disconnect();
    await app?.close();
  });
  it.each([
    [201, '{"messageId":"synthetic-message"}', 'ACCEPTED'],
    [400, 'rejected', 'FAILED'],
    [429, 'quota exhausted', 'FAILED'],
    [503, 'uncertain', 'UNKNOWN'],
    [201, '{}', 'UNKNOWN'],
    [0, 'synthetic timeout', 'UNKNOWN'],
  ])(
    'HTTP provider %s retains committed tenant and correct state',
    async (status, body, expected) => {
      const result = await register(Number(status), String(body));
      expect(result.onboarding.deliveryStatus).toBe(expected);
      const persisted = await reader.tenantOnboarding.findUniqueOrThrow({
        where: { tenantId: result.tenant.id },
        include: { attempts: true, owner: true },
      });
      expect(persisted.deliveryStatus).toBe(expected);
      expect(persisted.attempts).toHaveLength(1);
      expect(persisted.attempts[0].status).toBe(expected);
      expect(persisted.owner.mustChangePassword).toBe(true);
      expect(
        await reader.role.count({ where: { tenantId: result.tenant.id } }),
      ).toBe(2);
      expect(
        await reader.userTenant.count({
          where: {
            tenantId: result.tenant.id,
            userId: result.onboarding.ownerUserId,
          },
        }),
      ).toBe(1);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result).includes(token)).toBe(false);
    },
  );
  it('can redeem and complete with flag OFF, enforces byte policy, then requires normal login', async () => {
    const result = await register();
    const owner = await reader.user.findUniqueOrThrow({
      where: { id: result.onboarding.ownerUserId },
    });
    await http()
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: 'Synthetic-password-123!' })
      .expect(401);
    const forged = app.get(JwtService).sign({
      sub: owner.id,
      email: owner.email,
      tenantId: result.tenant.id,
      tenantRole: 'OWNER',
      platformRole: null,
    });
    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer ' + forged)
      .expect(401);
    const selectedAdmin = app.get(JwtService).sign({
      sub: adminId,
      email: 'admin@example.test',
      tenantId: result.tenant.id,
      tenantRole: null,
      platformRole: 'ADMIN',
    });
    await http()
      .patch('/api/v1/users/' + owner.id)
      .set('Authorization', 'Bearer ' + selectedAdmin)
      .send({ password: 'Bypass-password-123!' })
      .expect(403);
    config.set('TENANT_REGISTRATION_ENABLED', false);
    const before = await reader.tenant.count();
    await http()
      .post('/api/v1/tenants/register')
      .set('Authorization', 'Bearer ' + admin)
      .send(dto())
      .expect(503);
    await http()
      .post('/api/v1/tenants/' + result.tenant.id + '/resend-welcome')
      .set('Authorization', 'Bearer ' + admin)
      .expect(503);
    expect(await reader.tenant.count()).toBe(before);
    const redeem = await http()
      .post('/api/v1/auth/redeem-first-access')
      .send({ activationToken: token })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    const challenge = (
      redeem.body as { data: { firstAccessToken: string; action: string } }
    ).data;
    expect(challenge.action).toBe('CHANGE_PASSWORD_REQUIRED');
    const persisted = await reader.firstAccessChallenge.findUniqueOrThrow({
      where: { tokenHash: secretHash(challenge.firstAccessToken) },
    });
    expect(
      persisted.expiresAt.getTime() - persisted.createdAt.getTime(),
    ).toBeLessThanOrEqual(15 * 60000);
    await http()
      .post('/api/v1/auth/complete-first-access')
      .send({
        firstAccessToken: challenge.firstAccessToken,
        newPassword: 'Á'.repeat(40) + '123!',
      })
      .expect(400);
    expect(
      (
        await reader.firstAccessChallenge.findUniqueOrThrow({
          where: { id: persisted.id },
        })
      ).consumedAt,
    ).toBeNull();
    const completed = await http()
      .post('/api/v1/auth/complete-first-access')
      .send({
        firstAccessToken: challenge.firstAccessToken,
        newPassword: 'UnicodeÁrbol123!',
      })
      .expect(200);
    expect((completed.body as { data: object }).data).toEqual({
      action: 'LOGIN_REQUIRED',
    });
    expect(
      (await reader.user.findUniqueOrThrow({ where: { id: owner.id } }))
        .mustChangePassword,
    ).toBe(false);
    expect(
      (
        await reader.tenantOnboarding.findUniqueOrThrow({
          where: { tenantId: result.tenant.id },
        })
      ).activationStatus,
    ).toBe('COMPLETED');
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: 'UnicodeÁrbol123!' })
      .expect(200);
    expect(
      typeof (login.body as { data: { accessToken: string } }).data.accessToken,
    ).toBe('string');
  });
  it('rejects an expired challenge without changing password or consumption', async () => {
    const result = await register();
    const redeemed = await http()
      .post('/api/v1/auth/redeem-first-access')
      .send({ activationToken: token })
      .expect(200);
    const challenge = (redeemed.body as { data: { firstAccessToken: string } })
      .data.firstAccessToken;
    await db.firstAccessChallenge.updateMany({
      where: { tokenHash: secretHash(challenge) },
      data: {
        createdAt: new Date(Date.now() - 20 * 60000),
        expiresAt: new Date(Date.now() - 10 * 60000),
      },
    });
    const before = await reader.user.findUniqueOrThrow({
      where: { id: result.onboarding.ownerUserId },
    });
    await http()
      .post('/api/v1/auth/complete-first-access')
      .send({ firstAccessToken: challenge, newPassword: 'UnicodeÁrbol123!' })
      .expect(401);
    expect(
      await reader.user.findUniqueOrThrow({ where: { id: before.id } }),
    ).toEqual(before);
    expect(
      (
        await reader.firstAccessChallenge.findUniqueOrThrow({
          where: { tokenHash: secretHash(challenge) },
        })
      ).consumedAt,
    ).toBeNull();
  });
  it('rejects expired links according to PostgreSQL timestamps without consumption', async () => {
    await register();
    await db.activationLink.updateMany({
      where: { tokenHash: secretHash(token) },
      data: {
        createdAt: new Date(Date.now() - 48 * 3600000),
        expiresAt: new Date(Date.now() - 24 * 3600000),
      },
    });
    await http()
      .post('/api/v1/auth/redeem-first-access')
      .send({ activationToken: token })
      .expect(401);
    expect(
      (
        await reader.activationLink.findUniqueOrThrow({
          where: { tokenHash: secretHash(token) },
        })
      ).consumedAt,
    ).toBeNull();
  });
  it('revalidates ADMIN before registration writes with an older JWT', async () => {
    await db.user.update({
      where: { id: adminId },
      data: { platformRole: null },
    });
    const before = await reader.tenant.count();
    await http()
      .post('/api/v1/tenants/register')
      .set('Authorization', 'Bearer ' + admin)
      .send(dto())
      .expect(403);
    expect(await reader.tenant.count()).toBe(before);
  });
});
