import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';
import { TenantContextService } from '../context/tenant-context.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: PinoLogger,
    private readonly tenantContext: TenantContextService,
  ) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<
      Request & {
        requestId?: string;
        user?: { id?: string; userId?: string; sub?: string };
      }
    >();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.info(
          {
            requestId: request.requestId,
            method: request.method,
            path: request.originalUrl ?? request.url,
            statusCode: response.statusCode,
            duration: Date.now() - startedAt,
            userId:
              request.user?.id ?? request.user?.userId ?? request.user?.sub,
            tenantId: this.tenantContext.getContext()?.tenantId,
            ip: request.ip,
            userAgent: request.get('user-agent'),
          },
          'request completed',
        );
      }),
    );
  }
}
