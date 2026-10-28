import { ConfigService } from '@nestjs/config';
import { DeliveryStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContextService } from '../src/common/context/tenant-context.service';
import { PasswordService } from '../src/auth/password.service';
import { RegistrationPersistence } from '../src/tenant-registration/registration.persistence';
import { WelcomeMailService } from '../src/tenant-registration/welcome-mail.service';
import { DeliveryService } from '../src/tenant-registration/delivery.service';
import { TenantRegistrationService } from '../src/tenant-registration/tenant-registration.service';
import { ActivationService } from '../src/tenant-registration/activation.service';
import { ActivationRateLimitService } from '../src/tenant-registration/activation-rate-limit.service';

describe('ADR006 real PostgreSQL (disposable database only)', () => {
  let prisma: PrismaService,
    persistence: RegistrationPersistence,
    registration: TenantRegistrationService,
    activation: ActivationService;
  let delivery: DeliveryService;
  const context = new TenantContextService();
  let adminId: string;
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  const sent: string[] = [];
  const send = jest.fn();
  const config = new ConfigService({ TENANT_REGISTRATION_ENABLED: true });
  const run = <T>(fn: () => T) =>
    context.run(
      {
        userId: adminId,
        tenantId: null,
        tenantRole: null,
        platformRole: 'ADMIN',
      },
      fn,
    );
  const payload = () => ({
    tenantName: 'Test tenant',
    tenantSlug: `reg-${randomUUID()}`,
    ownerName: 'Test owner',
    ownerEmail: `${randomUUID()}@example.com`,
  });
  const register = async () => {
    const result = await run(() => registration.register(payload()));
    tenantIds.push(result.tenant.id);
    userIds.push(result.onboarding.ownerUserId);
    return { result, token: sent[sent.length - 1] };
  };
  const ageAttempt = async (tenantId: string) => {
    const o = await prisma.tenantOnboarding.findUniqueOrThrow({
      where: { tenantId },
    });
    await prisma.deliveryAttempt.updateMany({
      where: { onboardingId: o.id },
      data: {
        createdAt: new Date(Date.now() - 120000),
        leaseExpiresAt: new Date(Date.now() - 60000),
      },
    });
    return o;
  };
  beforeAll(async () => {
    if (!process.env.INTEGRATION_TEST_DATABASE_URL)
      throw new Error(
        'Disposable migrated INTEGRATION_TEST_DATABASE_URL required',
      );
    prisma = new PrismaService();
    await prisma.$connect();
    adminId = (
      await prisma.user.create({
        data: {
          name: 'Registration admin',
          email: `${randomUUID()}@example.com`,
          passwordHash: 'not-used',
          platformRole: 'ADMIN',
        },
      })
    ).id;
    persistence = new RegistrationPersistence(prisma);
    delivery = new DeliveryService(persistence, {
      send,
    } as unknown as WelcomeMailService);
    registration = new TenantRegistrationService(
      persistence,
      delivery,
      context,
      config,
    );
    activation = new ActivationService(
      prisma,
      persistence,
      new PasswordService(),
    );
  });
  beforeEach(() => {
    send
      .mockReset()
      .mockImplementation(
        (_email: string, _name: string, _tenant: string, token: string) => {
          sent.push(token);
          return Promise.resolve('ACCEPTED');
        },
      );
    config.set('TENANT_REGISTRATION_ENABLED', true);
  });
  afterAll(async () => {
    if (!prisma) return;
    const onboardings = await prisma.tenantOnboarding.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { id: true },
    });
    const where = { onboardingId: { in: onboardings.map((o) => o.id) } };
    await prisma.firstAccessChallenge.deleteMany({ where });
    await prisma.activationLink.deleteMany({ where });
    await prisma.deliveryAttempt.deleteMany({ where });
    await prisma.tenantOnboarding.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await prisma.userTenant.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await prisma.role.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.user.deleteMany({
      where: { id: { in: [...userIds, adminId] } },
    });
    await prisma.$disconnect();
  });

  it('registers atomically with roles, unusable verifier, membership and hashed link; no admin context change', async () => {
    const { result, token } = await register();
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: result.onboarding.ownerUserId },
    });
    expect(owner.mustChangePassword).toBe(true);
    expect(owner.platformRole).toBeNull();
    expect(owner.passwordHash.startsWith('!activation-only!')).toBe(true);
    expect(result.onboarding.deliveryStatus).toBe('ACCEPTED');
    expect(JSON.stringify(result)).not.toContain(token);
    expect(
      await prisma.role.count({ where: { tenantId: result.tenant.id } }),
    ).toBe(2);
    const membership = await prisma.userTenant.findUniqueOrThrow({
      where: {
        userId_tenantId: { userId: owner.id, tenantId: result.tenant.id },
      },
      include: { role: true },
    });
    expect(membership.role.name).toBe('OWNER');
    run(() => {
      expect(context.getTenantId()).toBeNull();
    });
  });
  it.each(['slug', 'email'])(
    'serializes concurrent equivalent %s registrations without partial tenants/users',
    async (kind) => {
      const a = payload(),
        b = payload();
      if (kind === 'slug') b.tenantSlug = a.tenantSlug;
      else b.ownerEmail = `  ${a.ownerEmail.toUpperCase()}  `;
      const results = await Promise.allSettled([
        run(() => registration.register(a)),
        run(() => registration.register(b)),
      ]);
      const success = results.filter(
        (
          r,
        ): r is PromiseFulfilledResult<
          Awaited<ReturnType<TenantRegistrationService['register']>>
        > => r.status === 'fulfilled',
      );
      for (const r of success) {
        tenantIds.push(r.value.tenant.id);
        userIds.push(r.value.onboarding.ownerUserId);
      }
      expect(success).toHaveLength(1);
      expect(
        await prisma.tenant.count({
          where: { slug: { in: [a.tenantSlug, b.tenantSlug] } },
        }),
      ).toBe(1);
      expect(send).toHaveBeenCalledTimes(1);
    },
  );
  it('rolls back a later write failure without sending SMTP', async () => {
    const dto = payload();
    const fail = prisma.$extends({
      query: {
        deliveryAttempt: {
          create() {
            throw new Error('injected attempt failure');
          },
        },
      },
    });
    const p = new RegistrationPersistence(fail as unknown as PrismaService);
    const r = new TenantRegistrationService(
      p,
      new DeliveryService(p, { send } as unknown as WelcomeMailService),
      context,
      config,
    );
    await expect(run(() => r.register(dto))).rejects.toThrow('injected');
    expect(await prisma.tenant.count({ where: { slug: dto.tenantSlug } })).toBe(
      0,
    );
    expect(await prisma.user.count({ where: { email: dto.ownerEmail } })).toBe(
      0,
    );
    expect(send).not.toHaveBeenCalled();
  });
  it('allows exactly one simultaneous redemption and one simultaneous completion', async () => {
    const { token, result } = await register();
    const results = await Promise.allSettled([
      activation.redeem(token),
      activation.redeem(token),
    ]);
    const success = results.filter(
      (
        r,
      ): r is PromiseFulfilledResult<
        Awaited<ReturnType<ActivationService['redeem']>>
      > => r.status === 'fulfilled',
    );
    expect(success).toHaveLength(1);
    const challenge = success[0].value.firstAccessToken;
    await expect(activation.complete(challenge, 'weak')).rejects.toThrow();
    const completed = await Promise.allSettled([
      activation.complete(challenge, 'UnicodeÁrbol123!'),
      activation.complete(challenge, 'UnicodeÁrbol123!'),
    ]);
    expect(completed.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: result.onboarding.ownerUserId },
    });
    expect(owner.mustChangePassword).toBe(false);
    expect(
      await new PasswordService().compare(
        'UnicodeÁrbol123!',
        owner.passwordHash,
      ),
    ).toBe(true);
    await expect(
      run(() => registration.resend(result.tenant.id)),
    ).rejects.toThrow('cannot be resent');
  });
  it('resend first invalidates old challenge and simultaneous resends reserve only once', async () => {
    const { token, result } = await register();
    const challenge = await activation.redeem(token);
    await ageAttempt(result.tenant.id);
    const results = await Promise.allSettled([
      run(() => registration.resend(result.tenant.id)),
      run(() => registration.resend(result.tenant.id)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await expect(
      activation.complete(challenge.firstAccessToken, 'MySecurePass123!'),
    ).rejects.toThrow('Invalid first-access');
  });
  it('completion racing resend cannot both succeed for the original generation', async () => {
    const { token, result } = await register();
    const challenge = await activation.redeem(token);
    await ageAttempt(result.tenant.id);
    const results = await Promise.allSettled([
      activation.complete(challenge.firstAccessToken, 'MySecurePass123!'),
      run(() => registration.resend(result.tenant.id)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it.each(['FAILED', 'UNKNOWN'] as DeliveryStatus[])(
    'keeps registration committed after SMTP %s',
    async (status) => {
      send.mockResolvedValue(status);
      const { result } = await register();
      expect(result.onboarding.deliveryStatus).toBe(status);
      expect(
        await prisma.tenant.count({ where: { id: result.tenant.id } }),
      ).toBe(1);
    },
  );
  it('lease expiry is UNKNOWN in query and stale SMTP cannot overwrite a newer attempt', async () => {
    const { result } = await register();
    const o = await ageAttempt(result.tenant.id);
    await prisma.deliveryAttempt.updateMany({
      where: { onboardingId: o.id },
      data: { status: 'SENDING' },
    });
    await prisma.tenantOnboarding.update({
      where: { id: o.id },
      data: { deliveryStatus: 'SENDING' },
    });
    expect((await registration.get(result.tenant.id)).deliveryStatus).toBe(
      'UNKNOWN',
    );
    const attempt = await prisma.deliveryAttempt.findFirstOrThrow({
      where: { onboardingId: o.id },
    });
    await run(() => registration.resend(result.tenant.id));
    await delivery.send(
      {
        onboardingId: o.id,
        generation: 1,
        attemptId: attempt.id,
        token: 'old',
      },
      'owner@example.com',
      'Owner',
      'Org',
    );
    expect((await registration.get(result.tenant.id)).deliveryStatus).toBe(
      'ACCEPTED',
    );
  });
  it('delivery limits survive a new service instance and count initial attempt', async () => {
    const { result } = await register();
    const restarted = new TenantRegistrationService(
      new RegistrationPersistence(prisma),
      delivery,
      context,
      config,
    );
    await expect(
      run(() => restarted.resend(result.tenant.id)),
    ).rejects.toMatchObject({ status: 429 });
    const o = await ageAttempt(result.tenant.id);
    for (let i = 0; i < 4; i++) {
      const generation = i + 10;
      await prisma.deliveryAttempt.create({
        data: {
          onboardingId: o.id,
          generation,
          createdAt: new Date(Date.now() - 120000),
          leaseExpiresAt: new Date(Date.now() - 60000),
          status: 'FAILED',
        },
      });
    }
    await expect(
      run(() => restarted.resend(result.tenant.id)),
    ).rejects.toMatchObject({ status: 429 });
  });
  it('persistent antiabuse limits are atomic under concurrent requests and restart', async () => {
    const limiter = new ActivationRateLimitService(persistence);
    const id = randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => limiter.consume('redeem', id, id)),
    );
    expect(
      results.filter((r) => r.status === 'fulfilled').length,
    ).toBeLessThanOrEqual(5);
    // Some callers may fail closed on retry exhaustion rather than incrementing
    // a contended bucket. Fill the remaining window sequentially before restart.
    for (let i = 0; i < 5; i++) {
      try {
        await limiter.consume('redeem', id, id);
      } catch {
        /* rate denied */
      }
    }
    await expect(
      new ActivationRateLimitService(
        new RegistrationPersistence(prisma),
      ).consume('redeem', id, id),
    ).rejects.toMatchObject({ status: 429 });
    // Only this test's hashed keys, not a global limiter reset.
    const { createHash } = await import('node:crypto');
    await prisma.activationRateLimit.deleteMany({
      where: {
        key: { endsWith: createHash('sha256').update(id).digest('hex') },
      },
    });
  });
  it('flag off stops writes but existing credentials can still activate', async () => {
    const { token } = await register();
    config.set('TENANT_REGISTRATION_ENABLED', false);
    await expect(
      run(() => registration.register(payload())),
    ).rejects.toMatchObject({ status: 503 });
    const challenge = await activation.redeem(token);
    expect(
      await activation.complete(challenge.firstAccessToken, 'MySecurePass123!'),
    ).toEqual({ action: 'LOGIN_REQUIRED' });
  });
});
