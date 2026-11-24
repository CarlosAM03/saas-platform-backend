import { HttpException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RegistrationPersistence } from './registration.persistence';

@Injectable()
export class ActivationRateLimitService {
  constructor(private readonly persistence: RegistrationPersistence) {}

  async consume(
    operation: 'redeem' | 'complete',
    ip: string,
    credential: string,
  ) {
    const digest = (s: string) => createHash('sha256').update(s).digest('hex');
    const keys = [
      `${operation}:ip:${digest(ip)}`,
      `${operation}:credential:${digest(credential)}`,
    ];
    // A separate committed transaction counts failed/invalid attempts too.
    const allowed = await this.persistence.serializable(
      async (tx) => {
        const now = await this.persistence.now(tx);
        for (const key of keys) {
          const [row] = await tx.$queryRaw<{ count: number }[]>`
          INSERT INTO activation_rate_limits (key, count, expires_at)
          VALUES (${key}, 1, ${new Date(now.getTime() + 60000)})
          ON CONFLICT (key) DO UPDATE SET
            count = CASE WHEN activation_rate_limits.expires_at <= ${now} THEN 1 ELSE LEAST(activation_rate_limits.count + 1, 6) END,
            expires_at = CASE WHEN activation_rate_limits.expires_at <= ${now} THEN EXCLUDED.expires_at ELSE activation_rate_limits.expires_at END
          RETURNING count`;
          // Denied IPs must not create unlimited per-credential rows.
          if (row.count > 5) return false;
        }
        return true;
      },
      () => new HttpException('Too many concurrent first-access attempts', 429),
    );
    if (!allowed)
      throw new HttpException('Too many first-access attempts', 429);
  }
}
