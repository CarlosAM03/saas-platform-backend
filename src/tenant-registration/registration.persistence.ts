import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RegistrationPersistence {
  constructor(private readonly prisma: PrismaService) {}

  read<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 10000,
    });
  }

  async serializable<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    exhausted: () => Error = () =>
      new ConflictException('Concurrent onboarding operation; retry'),
  ): Promise<T> {
    for (let i = 0; i < 3; i++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' ||
            (error.code === 'P2010' &&
              ['40001', '40P01'].includes(String(error.meta?.code))))
        ) {
          if (i < 2) continue;
          throw exhausted();
        }
        throw error;
      }
    }
    throw exhausted();
  }

  async now(tx: Prisma.TransactionClient): Promise<Date> {
    const [row] = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT clock_timestamp() AS now`;
    return row.now;
  }

  async lock(
    tx: Prisma.TransactionClient,
    onboardingId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM tenant_onboardings WHERE id = ${onboardingId} FOR UPDATE`;
  }
}
