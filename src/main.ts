import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { SwaggerModule } from '@nestjs/swagger';
import { deploymentDocument } from './common/openapi/deployment-document';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: configService.getOrThrow<string>('CORS_ORIGINS').split(','),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(app.get(GlobalExceptionFilter));
  app.useGlobalInterceptors(
    app.get(RequestIdInterceptor),
    app.get(LoggingInterceptor),
    app.get(ResponseInterceptor),
  );
  app.enableShutdownHooks();

  // Describe deployed capabilities while preserving the baseline target contract.
  const document = deploymentDocument();

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'SaaS Platform API',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.getOrThrow<number>('PORT');
  const env = configService.get<string>('NODE_ENV') || 'development';

  await app.listen(port);

  // 🚀 Logs informativos
  logger.log(`✅ Server running on http://localhost:${port}`);
  logger.log(`📄 Swagger UI: http://localhost:${port}/api/docs`);
  logger.log(`🌍 Environment: ${env}`);
  logger.log(`🔗 API base: http://localhost:${port}/api/v1`);
  if (env === 'development') {
    logger.warn('⚠️  Development mode - CORS and logging are enabled');
  }
}
void bootstrap();
