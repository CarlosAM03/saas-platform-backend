import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const supplied = request.headers['x-api-key'];
    const expected = this.config.getOrThrow<string>('PROSPECTOR_API_KEY');
    if (
      typeof supplied !== 'string' ||
      !supplied ||
      !expected ||
      !timingSafeEqual(
        createHash('sha256').update(supplied).digest(),
        createHash('sha256').update(expected).digest(),
      )
    )
      throw new UnauthorizedException('Invalid internal credential');
    return true;
  }
}
