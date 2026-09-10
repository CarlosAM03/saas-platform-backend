import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { TenantContextService } from '../context/tenant-context.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly tenantContext: TenantContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & { requestId?: string }>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseBody =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as {
            message?: string | string[];
            error?: string;
            details?: unknown;
          })
        : undefined;
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (responseBody?.message ?? 'Internal server error');
    const codeByStatus: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    const details = Array.isArray(message)
      ? { messages: message }
      : (responseBody?.details ?? {});

    this.logger.warn(
      {
        requestId: request.requestId,
        method: request.method,
        path: (request.route as { path?: string } | undefined)?.path,
        statusCode: status,
        userId: this.tenantContext.getContext()?.userId,
        tenantId: this.tenantContext.getContext()?.tenantId,
        ip: request.ip,
        userAgent: request.get('user-agent'),
      },
      'request rejected',
    );

    response.status(status).json({
      success: false,
      error: {
        code: codeByStatus[status] ?? `HTTP_${status}`,
        message:
          status >= 500
            ? 'Internal server error'
            : Array.isArray(message)
              ? 'Validation failed'
              : message,
        details,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
