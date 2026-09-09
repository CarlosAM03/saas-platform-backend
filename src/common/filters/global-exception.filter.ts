import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
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

    response.status(status).json({
      success: false,
      error: {
        code: codeByStatus[status] ?? `HTTP_${status}`,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
