import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { RequestContextMiddleware } from './context/request-context.middleware';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/config.module';
import { TenantContextService } from './context/tenant-context.service';
import { AuthGuard } from './guards/auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RolesGuard } from './guards/roles.guard';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { RequestIdInterceptor } from './interceptors/request-id.interceptor';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    LoggerModule.forRoot({
      forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        autoLogging: false,
        serializers: { req: () => undefined, res: () => undefined },
        redact: [
          'req.headers',
          'res.headers',
          'password',
          'passwordHash',
          'accessToken',
          'token',
          'secret',
          'apiKey',
        ],
      },
    }),
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    TenantContextService,
    AuthGuard,
    RolesGuard,
    RateLimitGuard,
    GlobalExceptionFilter,
    RequestIdInterceptor,
    LoggingInterceptor,
    ResponseInterceptor,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [
    AppConfigModule,
    TenantContextService,
    AuthGuard,
    RolesGuard,
    RateLimitGuard,
    GlobalExceptionFilter,
    RequestIdInterceptor,
    LoggingInterceptor,
    ResponseInterceptor,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
