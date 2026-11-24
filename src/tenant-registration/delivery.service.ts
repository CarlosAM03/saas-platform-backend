import { ConflictException, HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RegistrationPersistence } from './registration.persistence';
import { WelcomeMailService, DeliveryResult } from './welcome-mail.service';
import { newSecret, secretHash } from './activation.service';

export interface ReservedDelivery {
  onboardingId: string;
  attemptId: string;
  generation: number;
  token: string;
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly persistence: RegistrationPersistence,
    private readonly mail: WelcomeMailService,
  ) {}

  /** Caller must hold onboarding lock (or have just created it) in this transaction. */
  async reserve(
    tx: Prisma.TransactionClient,
    onboardingId: string,
  ): Promise<ReservedDelivery> {
    const now = await this.persistence.now(tx);
    const o = await tx.tenantOnboarding.findUniqueOrThrow({
      where: { id: onboardingId },
      include: {
        owner: true,
        tenant: true,
        attempts: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (
      o.activationStatus !== 'PENDING_FIRST_ACCESS' ||
      o.completedAt ||
      !o.owner.mustChangePassword ||
      o.owner.platformRole !== null ||
      o.owner.status !== 'ACTIVO' ||
      o.tenant.status !== 'ACTIVO'
    )
      throw new ConflictException('Onboarding cannot be resent');
    if (
      o.attempts.some((a) => a.status === 'SENDING' && a.leaseExpiresAt > now)
    )
      throw new ConflictException('Delivery attempt in progress');
    if (
      o.attempts.some((a) => a.createdAt.getTime() > now.getTime() - 60000) ||
      o.attempts.filter((a) => a.createdAt.getTime() > now.getTime() - 3600000)
        .length >= 5
    )
      throw new HttpException('Welcome delivery limit exceeded', 429);
    await tx.deliveryAttempt.updateMany({
      where: { onboardingId, status: 'SENDING', leaseExpiresAt: { lte: now } },
      data: { status: 'UNKNOWN' },
    });
    const generation = o.attempts.length ? o.generation + 1 : o.generation;
    await tx.activationLink.updateMany({
      where: { onboardingId, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.firstAccessChallenge.updateMany({
      where: { onboardingId, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.tenantOnboarding.update({
      where: { id: onboardingId },
      data: { generation, deliveryStatus: 'SENDING' },
    });
    const token = newSecret();
    await tx.activationLink.create({
      data: {
        onboardingId,
        generation,
        tokenHash: secretHash(token),
        createdAt: now,
        expiresAt: new Date(now.getTime() + 24 * 3600000),
      },
    });
    const attempt = await tx.deliveryAttempt.create({
      data: {
        onboardingId,
        generation,
        createdAt: now,
        status: 'SENDING',
        leaseExpiresAt: new Date(now.getTime() + 60000),
      },
    });
    return { onboardingId, generation, attemptId: attempt.id, token };
  }

  /** Never inside an SMTP transaction. No secrets or provider errors are logged. */
  async send(
    reservation: ReservedDelivery,
    email: string,
    name: string,
    tenantName: string,
  ): Promise<void> {
    let result: DeliveryResult;
    try {
      result = await this.mail.send(email, name, tenantName, reservation.token);
    } catch {
      result = 'UNKNOWN';
    }
    try {
      await this.persistence.serializable(async (tx) => {
        await this.persistence.lock(tx, reservation.onboardingId);
        const now = await this.persistence.now(tx);
        const o = await tx.tenantOnboarding.findUniqueOrThrow({
          where: { id: reservation.onboardingId },
        });
        if (
          o.generation !== reservation.generation ||
          o.activationStatus !== 'PENDING_FIRST_ACCESS'
        )
          return;
        const attempt = await tx.deliveryAttempt.findUniqueOrThrow({
          where: { id: reservation.attemptId },
        });
        if (attempt.status !== 'SENDING') return;
        const status = attempt.leaseExpiresAt <= now ? 'UNKNOWN' : result;
        await tx.deliveryAttempt.update({
          where: { id: attempt.id },
          data: {
            status,
            providerAcceptedAt: status === 'ACCEPTED' ? now : null,
          },
        });
        await tx.tenantOnboarding.update({
          where: { id: o.id },
          data: { deliveryStatus: status },
        });
      });
    } catch {
      // Registration already committed. Persisted lease provides UNKNOWN after
      // interruption/database failure; never roll back or retry SMTP automatically.
    }
  }
}
