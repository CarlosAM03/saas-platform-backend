import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProspectingJob } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/context/tenant-context.service';
import { createPaginationMeta } from '../common/dto/pagination.dto';
import { ProspectorClientService } from '../prospector-client/prospector-client.service';
import { JobEventRequest } from '../prospector-client/dto/job-event.request';
import { CreateJobRequest, JobListQuery } from './dto/job.request';

@Injectable()
export class ProspectingJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TenantContextService,
    private readonly client: ProspectorClientService,
  ) {}

  create(request: CreateJobRequest, key: string | undefined): never {
    this.context.requireTenantId();
    if (typeof key !== 'string' || key.trim().length === 0)
      throw new BadRequestException('Idempotency-Key is required');
    // Preserve input validation, but do not allocate jobs or store keys.
    void request;
    return this.client.assertAvailable();
  }

  async findAll(query: JobListQuery) {
    const where = { tenantId: this.context.requireTenantId() };
    const [jobs, total] = await this.prisma.$transaction([
      this.prisma.prospectingJob.findMany({
        where,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          campaignId: true,
          status: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      this.prisma.prospectingJob.count({ where }),
    ]);
    return {
      data: jobs,
      meta: createPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string) {
    return this.detail(await this.getJob(id));
  }

  cancel(id: string): never {
    this.context.requireTenantId();
    void id;
    return this.client.assertAvailable();
  }

  persist(id: string): never {
    this.context.requireTenantId();
    void id;
    return this.client.assertAvailable();
  }

  export(id: string, format: 'csv' | 'xlsx'): never {
    this.context.requireTenantId();
    void id;
    void format;
    return this.client.assertAvailable();
  }

  receiveEvent(id: string, event: JobEventRequest): never {
    // The controller still requires API-key authentication and DTO validation.
    void id;
    void event;
    return this.client.assertAvailable();
  }

  private async getJob(id: string): Promise<ProspectingJob> {
    const job = await this.prisma.prospectingJob.findFirst({
      where: { id, tenantId: this.context.requireTenantId() },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private detail(job: ProspectingJob) {
    return {
      id: job.id,
      tenantId: job.tenantId,
      campaignId: job.campaignId,
      requestedBy: job.requestedBy,
      status: job.status,
      query: job.query,
      requestedLimit: job.requestedLimit,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      resultsAvailable: false,
      results: null,
      progress: null,
    };
  }
}
