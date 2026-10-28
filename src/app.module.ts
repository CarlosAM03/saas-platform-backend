import { Module } from '@nestjs/common';
import { TenantRegistrationModule } from './tenant-registration/tenant-registration.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ProspectsModule } from './prospects/prospects.module';
import { ProspectingJobsModule } from './prospecting-jobs/prospecting-jobs.module';
import { ProspectorClientModule } from './prospector-client/prospector-client.module';
import { ProspectImportsModule } from './prospects/imports/prospect-imports.module';

@Module({
  imports: [
    TenantRegistrationModule,
    ConfigModule,
    CommonModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    CampaignsModule,
    ProspectsModule,
    ProspectImportsModule,
    ProspectingJobsModule,
    ProspectorClientModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
