import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PasswordService } from '../auth/password.service';
import { TenantRegistrationController } from './tenant-registration.controller';
import { ActivationController } from './activation.controller';
import { TenantRegistrationService } from './tenant-registration.service';
import { ActivationService } from './activation.service';
import { DeliveryService } from './delivery.service';
import { WelcomeMailService } from './welcome-mail.service';
import { RegistrationPersistence } from './registration.persistence';
import { ActivationRateLimitService } from './activation-rate-limit.service';
import { ActivationRateLimitGuard } from './activation-rate-limit.guard';

@Module({
  imports: [CommonModule, PrismaModule, ConfigModule],
  controllers: [TenantRegistrationController, ActivationController],
  providers: [
    TenantRegistrationService,
    ActivationService,
    DeliveryService,
    WelcomeMailService,
    RegistrationPersistence,
    ActivationRateLimitService,
    ActivationRateLimitGuard,
    PasswordService,
  ],
})
export class TenantRegistrationModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((_req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
      })
      .forRoutes(TenantRegistrationController, ActivationController);
  }
}
