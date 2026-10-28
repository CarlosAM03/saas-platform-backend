import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActivationService,
  newSecret,
  secretHash,
  validateInitialPassword,
} from './activation.service';
import { RegistrationPersistence } from './registration.persistence';

describe('First access lifecycle', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  const token = newSecret();
  let link: Record<string, unknown>;
  let challenge: Record<string, unknown>;
  let o: {
    activationStatus: string;
    completedAt: Date | null;
    generation: number;
    ownerUserId: string;
    owner: { status: string; mustChangePassword: boolean; platformRole: null };
    tenant: { status: string };
  };
  const tx = {
    activationLink: { findUnique: jest.fn(), updateMany: jest.fn() },
    firstAccessChallenge: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { update: jest.fn() },
    tenantOnboarding: { update: jest.fn() },
  };
  let service: ActivationService;
  const hash = jest.fn().mockResolvedValue('bcrypt-hash');
  beforeEach(() => {
    jest.clearAllMocks();
    o = {
      activationStatus: 'PENDING_FIRST_ACCESS',
      completedAt: null,
      generation: 1,
      ownerUserId: 'owner',
      owner: { status: 'ACTIVO', mustChangePassword: true, platformRole: null },
      tenant: { status: 'ACTIVO' },
    };
    link = {
      id: 'link',
      onboardingId: 'o',
      consumedAt: null,
      expiresAt: new Date(now.getTime() + 600000),
      generation: 1,
      onboarding: o,
    };
    challenge = { ...link, id: 'challenge' };
    tx.activationLink.findUnique.mockImplementation(() => link);
    tx.activationLink.updateMany.mockResolvedValue({ count: 1 });
    tx.firstAccessChallenge.findUnique.mockImplementation(() => challenge);
    tx.firstAccessChallenge.updateMany.mockResolvedValue({ count: 1 });
    const persistence = {
      serializable: (work: (client: unknown) => Promise<unknown>) => work(tx),
      lock: jest.fn(),
      now: () => now,
    };
    service = new ActivationService(
      {
        activationLink: tx.activationLink,
        firstAccessChallenge: tx.firstAccessChallenge,
      } as unknown as PrismaService,
      persistence as unknown as RegistrationPersistence,
      { hash } as unknown as PasswordService,
    );
  });
  it('issues a different opaque challenge capped at original expiration, stores only hash', async () => {
    const result = await service.redeem(token);
    expect(result.action).toBe('CHANGE_PASSWORD_REQUIRED');
    expect(result.firstAccessToken).not.toBe(token);
    expect(result.expiresAt).toBe((link.expiresAt as Date).toISOString());
    expect(tx.firstAccessChallenge.create).toHaveBeenCalledWith({
      data: {
        onboardingId: 'o',
        generation: 1,
        tokenHash: secretHash(result.firstAccessToken),
        createdAt: now,
        expiresAt: link.expiresAt,
      },
    });
    expect(result).not.toHaveProperty('accessToken');
  });
  it.each([
    'consumed',
    'expired',
    'generation',
    'inactive-user',
    'inactive-tenant',
    'completed',
  ])('rejects %s with generic credentials error', async (kind) => {
    if (kind === 'consumed') link.consumedAt = now;
    if (kind === 'expired') link.expiresAt = now;
    if (kind === 'generation') link.generation = 0;
    if (kind === 'inactive-user') o.owner.status = 'INACTIVO';
    if (kind === 'inactive-tenant') o.tenant.status = 'SUSPENDIDO';
    if (kind === 'completed') o.activationStatus = 'COMPLETED';
    await expect(service.redeem(token)).rejects.toThrow(
      'Invalid first-access credentials',
    );
    expect(tx.firstAccessChallenge.create).not.toHaveBeenCalled();
  });
  it('does not hash or consume a valid challenge on weak password', async () => {
    await expect(service.complete(token, 'weak')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.firstAccessChallenge.updateMany).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });
  it('caps challenge lifetime at fifteen minutes when the link lasts longer', async () => {
    link.expiresAt = new Date(now.getTime() + 24 * 3600000);
    const result = await service.redeem(token);
    expect(result.expiresAt).toBe(
      new Date(now.getTime() + 15 * 60000).toISOString(),
    );
  });
  it.each([
    'consumed',
    'expired',
    'generation',
    'inactive-user',
    'inactive-tenant',
    'completed',
    'not-pending',
  ])('cannot complete with %s challenge/account', async (kind) => {
    if (kind === 'consumed') challenge.consumedAt = now;
    if (kind === 'expired') challenge.expiresAt = now;
    if (kind === 'generation') challenge.generation = 0;
    if (kind === 'inactive-user') o.owner.status = 'INACTIVO';
    if (kind === 'inactive-tenant') o.tenant.status = 'SUSPENDIDO';
    if (kind === 'completed') o.activationStatus = 'COMPLETED';
    if (kind === 'not-pending') o.owner.mustChangePassword = false;
    await expect(service.complete(token, 'MySecurePass123!')).rejects.toThrow(
      'Invalid first-access credentials',
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it('rejects unknown link and challenge without issuing credentials or hashing passwords', async () => {
    tx.activationLink.findUnique.mockReturnValue(null);
    tx.firstAccessChallenge.findUnique.mockReturnValue(null);
    await expect(service.redeem(token)).rejects.toThrow(
      'Invalid first-access credentials',
    );
    await expect(service.complete(token, 'MySecurePass123!')).rejects.toThrow(
      'Invalid first-access credentials',
    );
    expect(hash).not.toHaveBeenCalled();
  });
  it('completes without issuing a session, consumes credentials and clears pending flag', async () => {
    expect(await service.complete(token, 'NuevaClave123!')).toEqual({
      action: 'LOGIN_REQUIRED',
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'owner' },
      data: { passwordHash: 'bcrypt-hash', mustChangePassword: false },
    });
    expect(tx.tenantOnboarding.update).toHaveBeenCalledWith({
      where: { id: 'o' },
      data: { activationStatus: 'COMPLETED', completedAt: now },
    });
  });
  it('accepts Unicode policy and enforces bytes, not only character count', () => {
    expect(() => validateInitialPassword('ÁrbolSeguro123!')).not.toThrow();
    expect(() =>
      validateInitialPassword('密'.repeat(23) + '1!a'),
    ).not.toThrow();
    expect(() => validateInitialPassword('密'.repeat(24) + '1!')).toThrow();
    expect(() => validateInitialPassword('123456789!')).toThrow();
  });
});

describe('RegistrationPersistence retries', () => {
  it('bounds retries and never retries SMTP or arbitrary failures', async () => {
    const transaction = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('serialization', {
        code: 'P2034',
        clientVersion: '5',
      }),
    );
    const persistence = new RegistrationPersistence({
      $transaction: transaction,
    } as unknown as PrismaService);
    await expect(
      persistence.serializable(() => Promise.resolve('ok')),
    ).rejects.toThrow('Concurrent onboarding');
    expect(transaction).toHaveBeenCalledTimes(3);
    transaction.mockClear().mockRejectedValue(new Error('network'));
    await expect(
      persistence.serializable(() => Promise.resolve('ok')),
    ).rejects.toThrow('network');
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
