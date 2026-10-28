import { isIP } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';

/** Trust network identities, never arbitrary hop counts or client headers. */
export function trustedProxies(value: unknown): string[] | false {
  if (value === undefined || value === '') return false;
  if (typeof value !== 'string') throw new Error('Invalid TRUSTED_PROXY_CIDRS');
  const entries = value.split(',').map((entry) => entry.trim());
  if (
    entries.some((entry) => {
      const [address, prefix, extra] = entry.split('/');
      const version = isIP(address);
      return (
        !version ||
        extra !== undefined ||
        (prefix !== undefined &&
          (!/^\d+$/.test(prefix) ||
            Number(prefix) < 1 ||
            Number(prefix) > (version === 4 ? 32 : 128)))
      );
    })
  )
    throw new Error(
      'TRUSTED_PROXY_CIDRS must list explicit IP addresses/CIDRs; unrestricted trust is forbidden',
    );
  return entries;
}

export function configureTrustedProxy(
  app: NestExpressApplication,
  value: unknown,
): void {
  app.set('trust proxy', trustedProxies(value));
}
