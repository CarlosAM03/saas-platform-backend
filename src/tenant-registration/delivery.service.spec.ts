import { Prisma } from '@prisma/client';
import { DeliveryService } from './delivery.service';
import { RegistrationPersistence } from './registration.persistence';
import { WelcomeMailService } from './welcome-mail.service';

describe('Persistent delivery reservation and late results', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  const o = {
    id: 'o',
    generation: 1,
    activationStatus: 'PENDING_FIRST_ACCESS',
    completedAt: null,
    owner: { mustChangePassword: true, status: 'ACTIVO', platformRole: null },
    tenant: { status: 'ACTIVO' },
    attempts: [] as { status: string; createdAt: Date; leaseExpiresAt: Date }[],
  };
  const tx = {
    tenantOnboarding: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    activationLink: { create: jest.fn(), updateMany: jest.fn() },
    firstAccessChallenge: { updateMany: jest.fn() },
    deliveryAttempt: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };
  const send = jest.fn();
  let service: DeliveryService;
  beforeEach(() => {
    jest.clearAllMocks();
    o.generation = 1;
    o.activationStatus = 'PENDING_FIRST_ACCESS';
    o.attempts = [];
    tx.tenantOnboarding.findUniqueOrThrow.mockResolvedValue(o);
    tx.deliveryAttempt.create.mockResolvedValue({ id: 'attempt' });
    tx.deliveryAttempt.findUniqueOrThrow.mockResolvedValue({
      id: 'attempt',
      status: 'SENDING',
      leaseExpiresAt: new Date(now.getTime() + 60000),
    });
    send.mockResolvedValue('ACCEPTED');
    service = new DeliveryService(
      {
        serializable: (work: (t: unknown) => unknown) => work(tx),
        now: () => now,
        lock: jest.fn(),
      } as unknown as RegistrationPersistence,
      { send } as unknown as WelcomeMailService,
    );
  });
  it('reserves initial attempt and only hashed credentials in the caller transaction', async () => {
    const reservation = await service.reserve(
      tx as unknown as Prisma.TransactionClient,
      'o',
    );
    expect(reservation.token).toHaveLength(43);
    expect(send).not.toHaveBeenCalled();
    expect(JSON.stringify(tx.activationLink.create.mock.calls)).not.toContain(
      reservation.token,
    );
    expect(tx.deliveryAttempt.create).toHaveBeenCalledWith({
      data: {
        onboardingId: 'o',
        generation: 1,
        createdAt: now,
        status: 'SENDING',
        leaseExpiresAt: new Date(now.getTime() + 60000),
      },
    });
  });
  it('rejects active lease and persists cooldown/hourly count semantics', async () => {
    o.attempts = [
      {
        status: 'SENDING',
        createdAt: now,
        leaseExpiresAt: new Date(now.getTime() + 1000),
      },
    ];
    await expect(
      service.reserve(tx as unknown as Prisma.TransactionClient, 'o'),
    ).rejects.toThrow('in progress');
    o.attempts[0].status = 'FAILED';
    await expect(
      service.reserve(tx as unknown as Prisma.TransactionClient, 'o'),
    ).rejects.toThrow('limit');
    o.attempts = Array.from({ length: 5 }, (_, i) => ({
      status: 'FAILED',
      createdAt: new Date(now.getTime() - (i + 2) * 60000),
      leaseExpiresAt: now,
    }));
    await expect(
      service.reserve(tx as unknown as Prisma.TransactionClient, 'o'),
    ).rejects.toThrow('limit');
  });
  it('rotates generation and invalidates links/challenges on manual recovery', async () => {
    o.attempts = [
      {
        status: 'SENDING',
        createdAt: new Date(now.getTime() - 120000),
        leaseExpiresAt: new Date(now.getTime() - 60000),
      },
    ];
    const r = await service.reserve(
      tx as unknown as Prisma.TransactionClient,
      'o',
    );
    expect(r.generation).toBe(2);
    expect(tx.firstAccessChallenge.updateMany).toHaveBeenCalled();
    expect(tx.deliveryAttempt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'UNKNOWN' } }),
    );
  });
  it.each(['ACCEPTED', 'FAILED', 'UNKNOWN'])(
    'records %s without claiming mailbox delivery',
    async (result) => {
      send.mockResolvedValue(result);
      await service.send(
        {
          onboardingId: 'o',
          attemptId: 'attempt',
          generation: 1,
          token: 'secret',
        },
        'owner@example.com',
        'Owner',
        'Tenant',
      );
      expect(tx.tenantOnboarding.update).toHaveBeenCalledWith({
        where: { id: 'o' },
        data: { deliveryStatus: result },
      });
    },
  );
  it('never overwrites current state with an old generation or completed attempt', async () => {
    o.generation = 2;
    await service.send(
      { onboardingId: 'o', attemptId: 'old', generation: 1, token: 'secret' },
      'owner@example.com',
      'Owner',
      'Tenant',
    );
    expect(tx.tenantOnboarding.update).not.toHaveBeenCalled();
    o.generation = 1;
    o.activationStatus = 'COMPLETED';
    await service.send(
      { onboardingId: 'o', attemptId: 'old', generation: 1, token: 'secret' },
      'owner@example.com',
      'Owner',
      'Tenant',
    );
    expect(tx.tenantOnboarding.update).not.toHaveBeenCalled();
  });
  it('treats success after lease expiration as UNKNOWN', async () => {
    tx.deliveryAttempt.findUniqueOrThrow.mockResolvedValue({
      id: 'attempt',
      status: 'SENDING',
      leaseExpiresAt: now,
    });
    await service.send(
      {
        onboardingId: 'o',
        attemptId: 'attempt',
        generation: 1,
        token: 'secret',
      },
      'owner@example.com',
      'Owner',
      'Tenant',
    );
    expect(tx.tenantOnboarding.update).toHaveBeenCalledWith({
      where: { id: 'o' },
      data: { deliveryStatus: 'UNKNOWN' },
    });
  });
});
