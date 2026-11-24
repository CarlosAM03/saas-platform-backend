import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ActivationRateLimitService } from './activation-rate-limit.service';

@Injectable()
export class ActivationRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: ActivationRateLimitService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const redeem = req.path.endsWith('/redeem-first-access');
    const body = req.body as Record<string, unknown> | undefined;
    const value = body?.[redeem ? 'activationToken' : 'firstAccessToken'];
    await this.limiter.consume(
      redeem ? 'redeem' : 'complete',
      req.ip ?? 'unknown',
      typeof value === 'string' ? value : 'invalid',
    );
    return true;
  }
}
