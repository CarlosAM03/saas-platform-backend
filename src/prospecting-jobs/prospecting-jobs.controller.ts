import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JobEventRequest } from '../prospector-client/dto/job-event.request';
import {
  CreateJobRequest,
  JobExportQuery,
  JobListQuery,
} from './dto/job.request';
import { ProspectingJobsService } from './prospecting-jobs.service';
import { InternalApiKeyGuard } from './internal-api-key.guard';

@Controller('prospecting-jobs')
@Roles('ADMIN', 'OWNER', 'MEMBER')
export class ProspectingJobsController {
  constructor(private readonly jobs: ProspectingJobsService) {}
  @Post()
  create(
    @Body() body: CreateJobRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.jobs.create(body, key);
  }
  @Get()
  list(@Query() query: JobListQuery) {
    return this.jobs.findAll(query);
  }
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.jobs.findOne(id);
  }
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string) {
    return this.jobs.cancel(id);
  }
  @Post(':id/persist')
  @HttpCode(200)
  persist(@Param('id') id: string) {
    return this.jobs.persist(id);
  }
  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query() query: JobExportQuery,
    @Res() response: Response,
  ): Promise<void> {
    const buffer = await this.jobs.export(id, query.format);
    response.type(
      query.format === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.attachment(`prospects.${query.format}`).send(buffer);
  }
}

@Controller('internal/prospecting-jobs')
export class JobEventsController {
  constructor(private readonly jobs: ProspectingJobsService) {}
  // Public bypasses only JWT; InternalApiKeyGuard still requires credentials.
  @Public()
  @UseGuards(InternalApiKeyGuard)
  @Post(':jobId/events')
  @HttpCode(200)
  receive(@Param('jobId') id: string, @Body() event: JobEventRequest) {
    return this.jobs.receiveEvent(id, event);
  }
}
