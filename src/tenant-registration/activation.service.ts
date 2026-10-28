import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationPersistence } from './registration.persistence';

export const secretHash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
export const newSecret = (): string => randomBytes(32).toString('base64url');
const invalid = () =>
  new UnauthorizedException('Invalid first-access credentials');

export function validateInitialPassword(password: string): void {
  if (
    [...password].length < 10 ||
    Buffer.byteLength(password, 'utf8') > 72 ||
    !/\p{L}/u.test(password) ||
    !/\p{N}/u.test(password) ||
    !/[^\p{L}\p{N}]/u.test(password)
  ) {
    throw new BadRequestException(
      'Password requires 10 Unicode characters, a letter, number and special character; maximum 72 UTF-8 bytes',
    );
  }
}

@Injectable()
export class ActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly persistence: RegistrationPersistence,
    private readonly passwords: PasswordService,
  ) {}

  async redeem(token: string) {
    const hash = secretHash(token);
    const found = await this.prisma.activationLink.findUnique({
      where: { tokenHash: hash },
      select: { onboardingId: true },
    });
    if (!found) throw invalid();
    const challenge = newSecret();
    return this.persistence.serializable(async (tx) => {
      await this.persistence.lock(tx, found.onboardingId);
      const now = await this.persistence.now(tx);
      const link = await tx.activationLink.findUnique({
        where: { tokenHash: hash },
        include: { onboarding: { include: { owner: true, tenant: true } } },
      });
      if (
        !link ||
        link.consumedAt ||
        link.expiresAt <= now ||
        !this.pending(link.onboarding) ||
        link.generation !== link.onboarding.generation
      )
        throw invalid();
      const used = await tx.activationLink.updateMany({
        where: { id: link.id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (used.count !== 1) throw invalid();
      const expiresAt = new Date(
        Math.min(now.getTime() + 15 * 60000, link.expiresAt.getTime()),
      );
      await tx.firstAccessChallenge.create({
        data: {
          onboardingId: link.onboardingId,
          generation: link.generation,
          tokenHash: secretHash(challenge),
          createdAt: now,
          expiresAt,
        },
      });
      return {
        action: 'CHANGE_PASSWORD_REQUIRED' as const,
        firstAccessToken: challenge,
        expiresAt: expiresAt.toISOString(),
      };
    }, invalid);
  }

  async complete(token: string, password: string) {
    validateInitialPassword(password); // Invalid password never consumes the challenge.
    const hash = secretHash(token);
    const found = await this.prisma.firstAccessChallenge.findUnique({
      where: { tokenHash: hash },
      select: { onboardingId: true },
    });
    if (!found) throw invalid();
    const passwordHash = await this.passwords.hash(password); // bcrypt outside transaction.
    return this.persistence.serializable(async (tx) => {
      await this.persistence.lock(tx, found.onboardingId);
      const now = await this.persistence.now(tx);
      const challenge = await tx.firstAccessChallenge.findUnique({
        where: { tokenHash: hash },
        include: { onboarding: { include: { owner: true, tenant: true } } },
      });
      if (
        !challenge ||
        challenge.consumedAt ||
        challenge.expiresAt <= now ||
        !this.pending(challenge.onboarding) ||
        challenge.generation !== challenge.onboarding.generation
      )
        throw invalid();
      const used = await tx.firstAccessChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (used.count !== 1) throw invalid();
      await tx.user.update({
        where: { id: challenge.onboarding.ownerUserId },
        data: { passwordHash, mustChangePassword: false },
      });
      await tx.activationLink.updateMany({
        where: { onboardingId: challenge.onboardingId, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.firstAccessChallenge.updateMany({
        where: { onboardingId: challenge.onboardingId, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.tenantOnboarding.update({
        where: { id: challenge.onboardingId },
        data: { activationStatus: 'COMPLETED', completedAt: now },
      });
      return { action: 'LOGIN_REQUIRED' as const };
    }, invalid);
  }

  private pending(o: {
    activationStatus: string;
    completedAt: Date | null;
    owner: {
      mustChangePassword: boolean;
      status: string;
      platformRole: string | null;
    };
    tenant: { status: string };
  }) {
    return (
      o.activationStatus === 'PENDING_FIRST_ACCESS' &&
      !o.completedAt &&
      o.owner.mustChangePassword &&
      o.owner.status === 'ACTIVO' &&
      o.owner.platformRole === null &&
      o.tenant.status === 'ACTIVO'
    );
  }
}
