import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProspectingJob } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/context/tenant-context.service';
import { createPaginationMeta } from '../common/dto/pagination.dto';
import { CampaignsService } from '../campaigns/campaigns.service';
import { ProspectsService } from '../prospects/prospects.service';
import { ProspectorClientService } from '../prospector-client/prospector-client.service';
import { JobEventRequest } from '../prospector-client/dto/job-event.request';
import { CreateJobRequest, JobListQuery } from './dto/job.request';
import { JobMemoryService } from './services/job-memory.service';
import { JobExportService } from './services/job-export.service';

@Injectable()
export class ProspectingJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TenantContextService,
    private readonly campaigns: CampaignsService,
    private readonly prospects: ProspectsService,
    private readonly client: ProspectorClientService,
    private readonly memory: JobMemoryService,
    private readonly exporter: JobExportService,
    private readonly config: ConfigService,
  ) {}

  async create(request: CreateJobRequest, key: string | undefined) {
    const tenantId = this.context.requireTenantId();
    const userId = this.context.getRequiredContext().userId;
    if (typeof key !== 'string' || key.trim().length === 0)
      throw new BadRequestException('Idempotency-Key is required');
    const hash = (value: string) =>
      createHash('sha256').update(value).digest('hex');
    const keyHash = hash(key);
    const query = {
      keyword: request.query.keyword,
      location: request.query.location,
      source: request.query.source,
      limit: request.query.limit,
    };
    const payloadHash = hash(
      JSON.stringify({ campaignId: request.campaignId, query }),
    );
    return this.memory.exclusive(
      `request:${tenantId}:${userId}:${keyHash}`,
      async () => {
        const where = {
          tenantId_userId_keyHash: { tenantId, userId, keyHash },
        };
        let record = await this.prisma.prospectingJobRequest.findUnique({
          where,
        });
        if (!record) {
          await this.campaigns.findOne(request.campaignId);
          try {
            record = await this.prisma.$transaction(async (tx) => {
              const job = await tx.prospectingJob.create({
                data: {
                  tenantId,
                  requestedBy: userId,
                  campaignId: request.campaignId,
                  query,
                  requestedLimit: query.limit,
                },
              });
              return tx.prospectingJobRequest.create({
                data: { tenantId, userId, keyHash, payloadHash, jobId: job.id },
              });
            });
          } catch (error) {
            if (
              !(error instanceof Prisma.PrismaClientKnownRequestError) ||
              error.code !== 'P2002'
            )
              throw error;
            record = await this.prisma.prospectingJobRequest.findUnique({
              where,
            });
            if (!record) throw error;
          }
        }
        if (record.payloadHash !== payloadHash)
          throw new ConflictException(
            'Idempotency-Key already used with another payload',
          );
        const job = await this.getJob(record.jobId);
        if (!record.acceptedAt && job.status === 'QUEUED') {
          const path = `/api/v1/internal/prospecting-jobs/${job.id}/events`;
          const baseUrl = this.config.get<string>('PLATFORM_CALLBACK_BASE_URL');
          const callbackUrl = baseUrl
            ? new URL(path, baseUrl).toString()
            : path;
          const accepted = await this.client.startJob({
            jobId: job.id,
            tenantId,
            query,
            callbackUrl,
          });
          await this.prisma.prospectingJobRequest.update({
            where: { id: record.id, tenantId, userId },
            data: { acceptedAt: new Date(accepted.acceptedAt) },
          });
          // A callback/cancellation may have arrived while the HTTP call ran.
          const latest = await this.getJob(job.id);
          if (latest.status === 'CANCELLED')
            await this.client.cancelJob(job.id);
        }
        return this.findOne(job.id);
      },
    );
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

  async cancel(id: string) {
    // Do not hold a callback lock while waiting for an external service.
    const action = await this.memory.exclusive(id, async () => {
      const job = await this.getJob(id);
      if (job.status === 'COMPLETED' || job.status === 'FAILED')
        throw new ConflictException('Terminal job cannot be cancelled');
      if (job.status === 'CANCELLED') {
        const record = await this.prisma.prospectingJobRequest.findUnique({
          where: { jobId: id },
        });
        return Boolean(record?.acceptedAt);
      }
      if (job.status === 'QUEUED') {
        const updated = await this.prisma.prospectingJob.updateMany({
          where: { id, tenantId: job.tenantId, status: 'QUEUED' },
          data: { status: 'CANCELLED', completedAt: new Date() },
        });
        if (!updated.count)
          throw new ConflictException('Job changed; retry cancellation');
        const record = await this.prisma.prospectingJobRequest.findUnique({
          where: { jobId: id },
        });
        return Boolean(record?.acceptedAt);
      }
      return true;
    });
    if (action) await this.client.cancelJob(id);
    return this.findOne(id);
  }

  async persist(id: string) {
    return this.memory.exclusive(id, async () => {
      const job = await this.getJob(id);
      const results = this.availableResults(job);
      const cached = this.memory.get(id);
      if (cached?.persisted) return { persisted: 0, skipped: results.length };
      const summary = await this.prospects.persistResults(
        job.campaignId,
        results,
      );
      if (cached) this.memory.set(id, { ...cached, persisted: true });
      return summary;
    });
  }

  async export(id: string, format: 'csv' | 'xlsx') {
    const job = await this.getJob(id);
    return this.exporter.render(this.availableResults(job), format);
  }

  async receiveEvent(id: string, event: JobEventRequest): Promise<void> {
    if (id !== event.jobId)
      throw new BadRequestException('Event jobId does not match route');
    if (
      (event.status !== 'COMPLETED' && event.results !== null) ||
      (event.status !== 'FAILED' && event.error !== null)
    )
      throw new BadRequestException('Event payload does not match status');

    await this.memory.exclusive(id, async () => {
      // This method is called only by the API-key protected internal route.
      // Tenant authority comes from the stored job, never callback input.
      const job = await this.prisma.prospectingJob.findUnique({
        where: { id },
      });
      if (!job) throw new NotFoundException('Job not found');
      const cached = this.memory.get(id);
      if (
        event.sequence <= (cached?.sequence ?? 0) ||
        event.eventId === cached?.eventId
      )
        return;
      if (job.status === 'CANCELLED') return;
      if (['COMPLETED', 'FAILED'].includes(job.status)) {
        if (event.status === job.status) return;
        throw new ConflictException('Terminal job cannot change state');
      }
      if (job.status === 'RUNNING' && event.status === 'QUEUED')
        throw new ConflictException('Job cannot return to QUEUED');
      if (
        job.status === 'QUEUED' &&
        !['QUEUED', 'RUNNING'].includes(event.status)
      )
        throw new ConflictException('Job must enter RUNNING before completion');
      const terminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(
        event.status,
      );
      const changed = await this.prisma.prospectingJob.updateMany({
        where: {
          id,
          tenantId: job.tenantId,
          status: job.status,
          updatedAt: job.updatedAt,
        },
        data: {
          status: event.status,
          startedAt:
            event.status === 'RUNNING' && !job.startedAt
              ? new Date(event.timestamp)
              : undefined,
          completedAt: terminal ? new Date(event.timestamp) : undefined,
          error: event.error
            ? `${event.error.code}: ${event.error.message}`
            : undefined,
        },
      });
      if (!changed.count)
        throw new ConflictException('Job changed; retry event');
      this.memory.set(id, {
        sequence: event.sequence,
        eventId: event.eventId,
        results: event.results,
        progress: event.progress,
      });
    });
  }

  private async getJob(id: string): Promise<ProspectingJob> {
    const job = await this.prisma.prospectingJob.findFirst({
      where: { id, tenantId: this.context.requireTenantId() },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private availableResults(job: ProspectingJob) {
    const results = this.memory.get(job.id)?.results;
    if (job.status !== 'COMPLETED' || results == null)
      throw new ConflictException('Completed job results are not available');
    return results;
  }

  private detail(job: ProspectingJob) {
    const cached = this.memory.get(job.id);
    const results =
      job.status === 'COMPLETED' ? (cached?.results ?? null) : null;
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
      resultsAvailable: results !== null,
      results,
      progress: cached?.progress ?? null,
    };
  }
}
