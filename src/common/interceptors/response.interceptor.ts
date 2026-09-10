import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data: unknown) => {
        if (response.statusCode === 204) {
          return data;
        }

        if (typeof data === 'object' && data !== null && 'data' in data) {
          const wrapped = data as { data: unknown; meta?: unknown };
          return { success: true, data: wrapped.data, meta: wrapped.meta };
        }

        return { success: true, data: data ?? {}, meta: undefined };
      }),
    );
  }
}
