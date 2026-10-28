import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { TenantRegistrationService } from '../src/tenant-registration/tenant-registration.service';
import { ActivationService } from '../src/tenant-registration/activation.service';
import { ActivationRateLimitService } from '../src/tenant-registration/activation-rate-limit.service';
import { createFakePrisma } from './support/fake-prisma';

describe('ADR006 HTTP and pending identity protection', () => {
  let app: INestApplication;
  let fake: Awaited<ReturnType<typeof createFakePrisma>>;
  let admin: string, selectedAdmin: string, owner: string, member: string;
  const payload = {
    tenantName: 'Company',
    tenantSlug: 'new-company',
    ownerName: 'Owner',
    ownerEmail: 'owner-new@example.com',
  };
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);
  beforeEach(async () => {
    fake = await createFakePrisma();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fake)
      .overrideProvider(ActivationRateLimitService)
      .useValue({ consume: jest.fn().mockResolvedValue(undefined) })
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
      tenantRole: string | null,
      platformRole: string | null = null,
    ) =>
      jwt.sign({
        sub,
        email: 'test@example.com',
        tenantId,
        tenantRole,
        platformRole,
      });
    admin = token('user-admin', null, null, 'ADMIN');
    selectedAdmin = token('user-admin', 'tenant-a', null, 'ADMIN');
    owner = token('user-owner', 'tenant-a', 'OWNER');
    member = token('user-member', 'tenant-a', 'MEMBER');
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });
  it('requires ADMIN, accepts ADMIN with/without tenant and is disabled without writes by default', async () => {
    for (const jwt of [admin, selectedAdmin]) {
      await http()
        .post('/api/v1/tenants/register')
        .set('Authorization', `Bearer ${jwt}`)
        .send(payload)
        .expect(503)
        .expect('Cache-Control', 'no-store');
      await http()
        .post('/api/v1/tenants/tenant-a/resend-welcome')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(503);
    }
    for (const jwt of [owner, member]) {
      await http()
        .post('/api/v1/tenants/register')
        .set('Authorization', `Bearer ${jwt}`)
        .send(payload)
        .expect(403);
      await http()
        .get('/api/v1/tenants/tenant-a/onboarding')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(403);
      await http()
        .post('/api/v1/tenants/tenant-a/resend-welcome')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(403);
    }
    await http()
      .post('/api/v1/tenants/register')
      .send(payload)
      .expect(401)
      .expect('Cache-Control', 'no-store');
    expect(fake._state.tenants).toHaveLength(2);
  });
  it('keeps consultation available when disabled and exposes no secret fields', async () => {
    const state = {
      tenantId: 'tenant-a',
      ownerUserId: 'user-owner',
      ownerEmail: 'owner@example.com',
      activationStatus: 'PENDING_FIRST_ACCESS',
      deliveryStatus: 'UNKNOWN',
      createdAt: new Date(0),
      lastAttemptAt: null,
      providerAcceptedAt: null,
      activationLinkExpiresAt: null,
      completedAt: null,
    };
    jest
      .spyOn(app.get(TenantRegistrationService), 'get')
      .mockResolvedValue(
        state as Awaited<ReturnType<TenantRegistrationService['get']>>,
      );
    const r = await http()
      .get('/api/v1/tenants/tenant-a/onboarding')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(r.body as unknown).toEqual({
      success: true,
      data: { ...state, createdAt: state.createdAt.toISOString() },
    });
  });
  it('closes DTOs and rejects body on resend', async () => {
    await http()
      .post('/api/v1/auth/redeem-first-access')
      .set('Content-Type', 'application/json')
      .send('{"broken"')
      .expect(400)
      .expect('X-Request-Id', /^[a-f0-9-]{36}$/)
      .expect('Cache-Control', 'no-store');
    await http()
      .post('/api/v1/tenants/register')
      .set('Authorization', `Bearer ${admin}`)
      .send({ ...payload, password: 'not-allowed' })
      .expect(400)
      .expect('Cache-Control', 'no-store');
    await http()
      .post('/api/v1/tenants/tenant-a/resend-welcome')
      .set('Authorization', `Bearer ${admin}`)
      .send({ email: 'other@example.com' })
      .expect(400);
  });
  it('redeem and complete use body credentials without JWT and preserve action shapes', async () => {
    const activation = app.get(ActivationService);
    jest.spyOn(activation, 'redeem').mockResolvedValue({
      action: 'CHANGE_PASSWORD_REQUIRED',
      firstAccessToken: 'challenge',
      expiresAt: new Date().toISOString(),
    });
    jest
      .spyOn(activation, 'complete')
      .mockResolvedValue({ action: 'LOGIN_REQUIRED' });
    const r = await http()
      .post('/api/v1/auth/redeem-first-access')
      .send({ activationToken: 'a'.repeat(43) })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect((r.body as { data: object }).data).not.toHaveProperty('accessToken');
    await http()
      .post('/api/v1/auth/complete-first-access')
      .send({ firstAccessToken: 'challenge', newPassword: 'MySecurePass123!' })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    await http()
      .post('/api/v1/auth/redeem-first-access')
      .set('Authorization', `Bearer ${admin}`)
      .send({})
      .expect(400);
  });
  it('pending flag blocks normal login, JWT, me and select-tenant even when feature disabled', async () => {
    fake._state.users.find((u) => u.id === 'user-owner')!.mustChangePassword =
      true;
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'SecurePass123!' })
      .expect(401);
    await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${owner}`)
      .expect(401);
    await http()
      .post('/api/v1/auth/select-tenant')
      .set('Authorization', `Bearer ${owner}`)
      .send({ tenantId: 'tenant-a' })
      .expect(401);
    await http()
      .get('/api/v1/campaigns')
      .set('Authorization', `Bearer ${owner}`)
      .expect(401);
  });
  it('ADMIN cannot bypass pending activation through Users password/email or internal DTO flags', async () => {
    fake._state.users.find((u) => u.id === 'user-owner')!.mustChangePassword =
      true;
    for (const changes of [
      { password: 'SecurePass123!' },
      { email: 'changed@example.com' },
    ]) {
      await http()
        .patch('/api/v1/users/user-owner')
        .set('Authorization', `Bearer ${selectedAdmin}`)
        .send(changes)
        .expect(403);
    }
    await http()
      .patch('/api/v1/users/user-owner')
      .set('Authorization', `Bearer ${selectedAdmin}`)
      .send({ mustChangePassword: false })
      .expect(400);
  });
});
