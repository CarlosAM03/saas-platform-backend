import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, RateLimitEntry>();
  private readonly maxAttempts = 5;
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const clientIp = request.ip ?? 'unknown';
    const now = Date.now();
    const current = this.attempts.get(clientIp);

    if (!current || now - current.windowStartedAt >= this.windowMs) {
      this.attempts.set(clientIp, { count: 1, windowStartedAt: now });
      return true;
    }

    if (current.count >= this.maxAttempts) {
      throw new HttpException(
        'Too many authentication attempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    return true;
  }
}
