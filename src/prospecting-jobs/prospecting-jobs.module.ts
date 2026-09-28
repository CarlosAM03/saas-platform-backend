import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { ProspectsModule } from '../prospects/prospects.module';
import { ProspectorClientModule } from '../prospector-client/prospector-client.module';
import { ProspectingJobsService } from './prospecting-jobs.service';
import {
  JobEventsController,
  ProspectingJobsController,
} from './prospecting-jobs.controller';
import { JobMemoryService } from './services/job-memory.service';
import { JobExportService } from './services/job-export.service';
import { InternalApiKeyGuard } from './internal-api-key.guard';

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    CampaignsModule,
    ProspectsModule,
    ProspectorClientModule,
  ],
  controllers: [ProspectingJobsController, JobEventsController],
  providers: [
    ProspectingJobsService,
    JobMemoryService,
    JobExportService,
    InternalApiKeyGuard,
  ],
})
export class ProspectingJobsModule {}
