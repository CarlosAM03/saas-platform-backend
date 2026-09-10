import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(
    req: Request & { requestId?: string },
    res: Response,
    next: NextFunction,
  ) {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    this.tenantContext.runRequest(next);
  }
}
