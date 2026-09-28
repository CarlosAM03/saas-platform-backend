import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProspectorClientModule } from '../prospector-client/prospector-client.module';
import { ProspectingJobsService } from './prospecting-jobs.service';
import {
  JobEventsController,
  ProspectingJobsController,
} from './prospecting-jobs.controller';
import { InternalApiKeyGuard } from './internal-api-key.guard';

@Module({
  imports: [CommonModule, PrismaModule, ProspectorClientModule],
  controllers: [ProspectingJobsController, JobEventsController],
  providers: [ProspectingJobsService, InternalApiKeyGuard],
})
export class ProspectingJobsModule {}
