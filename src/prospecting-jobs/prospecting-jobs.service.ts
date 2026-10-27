import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, ProspectingJob, ProspectingJobStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/context/tenant-context.service';
import { createPaginationMeta } from '../common/dto/pagination.dto';
import {
  ProspectorClientService,
  ProspectorTransportError,
} from '../prospector-client/prospector-client.service';
import {
  ProspectorPolicy,
  ProspectorSettings,
  unavailable,
} from '../prospector-client/prospector-policy';
import { JobEventRequest } from '../prospector-client/dto/job-event.request';
import { CreateJobRequest, JobListQuery } from './dto/job.request';

const ACTIVE: ProspectingJobStatus[] = ['QUEUED', 'RUNNING'];
const TERMINAL: ProspectingJobStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED'];
function canonical(value: unknown, depth = 0): string {
  if (depth > 20) throw new BadRequestException('Payload nesting is too deep');
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value))
    return (
      '[' + value.map((item) => canonical(item, depth + 1)).join(',') + ']'
    );
  if (typeof value === 'object' && value !== null) {
    const object = value as Record<string, unknown>;
    return (
      '{' +
      Object.keys(object)
        .filter((key) => object[key] !== undefined)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) + ':' + canonical(object[key], depth + 1),
        )
        .join(',') +
      '}'
    );
  }
  throw new BadRequestException('Invalid payload');
}
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class ProspectingJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProspectingJobsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private maintaining = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TenantContextService,
    private readonly client: ProspectorClientService,
    private readonly policy: ProspectorPolicy,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.policy.inspect().settings) await this.reconcile();
    this.timer = setInterval(() => {
      void this.reconcile(true).catch(() =>
        this.logger.warn('prospecting_maintenance_failed'),
      );
    }, 60000);
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // One short, cross-process PostgreSQL lock coordinates admission, events and snapshot capacity.
  private async lock(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(738413279)');
  }
  private async maintain(
    tx: Prisma.TransactionClient,
    settings: ProspectorSettings | null,
    now: Date,
  ): Promise<void> {
    await tx.prospectingJobSnapshot.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    if (settings) {
      const oldGeneration = {
        dispatchState: { not: null },
        capacityReleasedAt: null,
        serviceGeneration: { not: settings.generation },
      } satisfies Prisma.ProspectingJobWhereInput;
      await tx.prospectingJob.updateMany({
        where: { ...oldGeneration, status: { in: ACTIVE } },
        data: {
          status: 'FAILED',
          completedAt: now,
          failureCode: 'SERVICE_RESTARTED',
          error:
            'El servicio fue reiniciado. Puedes iniciar una búsqueda nueva manualmente.',
        },
      });
      await tx.prospectingJob.updateMany({
        where: oldGeneration,
        data: { capacityReleasedAt: now },
      });
    }
    await tx.prospectingJob.updateMany({
      where: {
        dispatchState: { not: null },
        capacityReleasedAt: null,
        status: { in: ACTIVE },
        deadlineAt: { lte: now },
      },
      data: {
        status: 'FAILED',
        dispatchState: 'UNCERTAIN',
        completedAt: now,
        failureCode: 'FINAL_EVENT_TIMEOUT',
        error:
          'No llegó una confirmación final. La ejecución puede continuar; no se repetirá automáticamente.',
      },
    });
  }
  async reconcile(force = false): Promise<void> {
    const settings = this.policy.inspect().settings;
    if ((!settings && !force) || this.maintaining) return;
    this.maintaining = true;
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.lock(tx);
        await this.maintain(tx, settings, new Date());
      });
    } finally {
      this.maintaining = false;
    }
  }
  private async limitReason(
    tx: Prisma.TransactionClient,
    settings: ProspectorSettings,
    tenantId: string,
    now: Date,
  ): Promise<string | null> {
    const period = {
      createdAt: {
        gte: new Date(now.getTime() - settings.periodSeconds * 1000),
      },
      idempotencyKeyHash: { not: null },
    };
    const active = await tx.prospectingJob.count({
      where: {
        serviceGeneration: settings.generation,
        dispatchState: { not: null },
        capacityReleasedAt: null,
      },
    });
    if (active >= settings.maxActive) return 'PROSPECTOR_CAPACITY_EXHAUSTED';
    if (
      (await tx.prospectingJob.count({ where: { ...period, tenantId } })) >=
      settings.tenantJobs
    )
      return 'TENANT_QUOTA_EXHAUSTED';
    if (
      (await tx.prospectingJob.count({ where: period })) >= settings.globalJobs
    )
      return 'GLOBAL_QUOTA_EXHAUSTED';
    return null;
  }
  async capabilities() {
    const tenantId = this.context.requireTenantId();
    const policy = this.policy.inspect();
    let reason = policy.reason;
    if (policy.enabled && policy.settings && !/^c[a-z0-9]{20,}$/.test(tenantId))
      reason = 'PROSPECTOR_TENANT_ID_UNSUPPORTED';
    if (policy.enabled && policy.settings && reason === null) {
      const settings = policy.settings;
      reason = await this.prisma.$transaction(async (tx) => {
        await this.lock(tx);
        const now = new Date();
        await this.maintain(tx, settings, now);
        return this.limitReason(tx, settings, tenantId, now);
      });
      if (!reason) {
        try {
          await this.client.assertReady(settings);
        } catch {
          reason = 'PROSPECTOR_SERVICE_UNAVAILABLE';
        }
      }
    }
    return {
      contractVersion: 'prospector-mvp-v1',
      create: reason === null,
      cancel: false,
      persist: false,
      export: false,
      reason,
      source: 'google_maps',
      minLimit: 1,
      maxLimit: 100,
      resultsTtlSeconds: 3600,
    };
  }
  async create(request: CreateJobRequest, key: string | undefined) {
    const tenantId = this.context.requireTenantId();
    const requestedBy = this.context.getRequiredContext().userId;
    if (typeof key !== 'string' || !key.trim() || Buffer.byteLength(key) > 200)
      throw new BadRequestException('Idempotency-Key must contain 1–200 bytes');
    const settings = this.client.assertAvailable();
    if (!/^c[a-z0-9]{20,}$/.test(tenantId))
      throw unavailable('PROSPECTOR_TENANT_ID_UNSUPPORTED');
    const idempotencyKeyHash = hash(key);
    const payload = {
      campaignId: request.campaignId,
      query: {
        keyword: request.query.keyword,
        location: request.query.location,
        source: request.query.source,
        limit: request.query.limit,
      },
    };
    const payloadHash = hash(canonical(payload));
    const unique = {
      tenantId_requestedBy_idempotencyKeyHash: {
        tenantId,
        requestedBy,
        idempotencyKeyHash,
      },
    };
    await this.checkCampaign(
      this.prisma,
      request.campaignId,
      tenantId,
      requestedBy,
    );
    const existing = await this.prisma.prospectingJob.findUnique({
      where: unique,
    });
    if (existing) {
      this.checkPayload(existing, payloadHash);
      return this.present(existing);
    }
    await this.client.assertReady(settings);
    const admission = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx);
      const now = new Date();
      await this.maintain(tx, settings, now);
      const replay = await tx.prospectingJob.findUnique({ where: unique });
      if (replay) {
        this.checkPayload(replay, payloadHash);
        return { job: replay, dispatch: false };
      }
      await this.checkCampaign(tx, request.campaignId, tenantId, requestedBy);
      const reason = await this.limitReason(tx, settings, tenantId, now);
      if (reason)
        throw new HttpException(
          {
            message: 'Prospecting admission limit reached',
            details: { reason },
          },
          reason.endsWith('QUOTA_EXHAUSTED') ? 429 : 503,
        );
      const job = await tx.prospectingJob.create({
        data: {
          tenantId,
          requestedBy,
          campaignId: request.campaignId,
          query: payload.query,
          requestedLimit: request.query.limit,
          idempotencyKeyHash,
          payloadHash,
          dispatchState: 'PENDING',
          serviceGeneration: settings.generation,
          deadlineAt: new Date(
            now.getTime() + settings.jobTimeoutSeconds * 1000,
          ),
        },
      });
      return { job, dispatch: true };
    });
    if (admission.dispatch) {
      let failure: ProspectorTransportError | null = null;
      try {
        await this.client.startJob(
          {
            jobId: admission.job.id,
            tenantId,
            query: payload.query,
            callbackUrl:
              settings.callbackOrigin +
              '/api/v1/internal/prospecting-jobs/' +
              admission.job.id +
              '/events',
          },
          settings,
        );
      } catch (error) {
        failure =
          error instanceof ProspectorTransportError
            ? error
            : new ProspectorTransportError('NETWORK');
      }
      await this.prisma.$transaction(async (tx) => {
        await this.lock(tx);
        const current = await tx.prospectingJob.findUniqueOrThrow({
          where: { id: admission.job.id },
        });
        // A callback is stronger evidence than a missing, conflicting or delayed HTTP acceptance.
        if (
          current.lastSequence > 0 ||
          current.dispatchState !== 'PENDING' ||
          !ACTIVE.includes(current.status)
        )
          return;
        if (!failure)
          await tx.prospectingJob.update({
            where: { id: current.id },
            data: { dispatchState: 'ACCEPTED' },
          });
        else if (failure.definitiveRejection)
          await tx.prospectingJob.update({
            where: { id: current.id },
            data: {
              status: 'FAILED',
              dispatchState: 'REJECTED',
              capacityReleasedAt: new Date(),
              completedAt: new Date(),
              failureCode: failure.kind,
              error:
                'El servicio rechazó la búsqueda; no se confirmó una ejecución.',
            },
          });
        else
          await tx.prospectingJob.update({
            where: { id: current.id },
            data: { dispatchState: 'UNCERTAIN', failureCode: failure.kind },
          });
      });
      if (failure)
        this.logger.warn('prospecting_dispatch_' + failure.kind.toLowerCase());
    }
    return this.present(
      await this.prisma.prospectingJob.findUniqueOrThrow({
        where: { id: admission.job.id },
      }),
    );
  }
  private async checkCampaign(
    tx: Prisma.TransactionClient,
    campaignId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const campaign = await tx.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: { tenant: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.tenant.status !== 'ACTIVO')
      throw new ForbiddenException('Tenant is not active');
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVO')
      throw new ForbiddenException('User is not active');
    if (user.platformRole !== 'ADMIN') {
      const membership = await tx.userTenant.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        include: { role: true },
      });
      if (
        !membership ||
        membership.role.tenantId !== tenantId ||
        !['OWNER', 'MEMBER'].includes(membership.role.name)
      )
        throw new ForbiddenException('Active tenant membership required');
    }
    if (campaign.status !== 'ACTIVA')
      throw new ConflictException('Campaign must be active to start a search');
  }
  private checkPayload(job: ProspectingJob, expected: string): void {
    if (job.payloadHash !== expected)
      throw new ConflictException(
        'Idempotency-Key was already used with another payload',
      );
  }
  private async present(job: ProspectingJob) {
    if (job.dispatchState === 'PENDING' || job.dispatchState === 'UNCERTAIN')
      throw unavailable('PROSPECTOR_DISPATCH_UNCERTAIN', job.id);
    if (job.dispatchState === 'REJECTED')
      throw unavailable('PROSPECTOR_SERVICE_REJECTED', job.id);
    return this.findOne(job.id);
  }
  async findAll(query: JobListQuery) {
    const where = { tenantId: this.context.requireTenantId() };
    await this.reconcile();
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
    const tenantId = this.context.requireTenantId();
    await this.reconcile();
    const job = await this.prisma.prospectingJob.findFirst({
      where: { id, tenantId },
      include: { snapshot: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    const available =
      job.status === 'COMPLETED' &&
      job.snapshot !== null &&
      job.snapshot.expiresAt.getTime() > Date.now();
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
      resultsAvailable: available,
      results: available ? job.snapshot!.results : null,
      progress: null,
      resultsExpiresAt: job.resultsExpiresAt,
      dispatchState: job.dispatchState,
      failureCode: job.failureCode,
      retryAllowed:
        TERMINAL.includes(job.status) &&
        job.dispatchState !== null &&
        job.capacityReleasedAt !== null,
    };
  }
  cancel(id: string): never {
    this.context.requireTenantId();
    void id;
    throw unavailable();
  }
  persist(id: string): never {
    this.context.requireTenantId();
    void id;
    throw unavailable();
  }
  export(id: string, format: 'csv' | 'xlsx'): never {
    this.context.requireTenantId();
    void id;
    void format;
    throw unavailable();
  }

  async receiveEvent(id: string, event: JobEventRequest) {
    const settings = this.policy.requireConfigured();
    if (
      id !== event.jobId ||
      event.progress !== null ||
      (event.status === 'COMPLETED') !== (event.results !== null) ||
      (event.status === 'FAILED') !== (event.error !== null)
    )
      throw new BadRequestException(
        'Event does not match the Service lifecycle',
      );
    const timestamp = new Date(event.timestamp);
    if (timestamp.getTime() > Date.now() + 300000)
      throw new BadRequestException('Event timestamp is in the future');
    const resultsBytes =
      event.results === null
        ? 0
        : Buffer.byteLength(JSON.stringify(event.results));
    if (resultsBytes > settings.maxResultBytes)
      throw new BadRequestException(
        'Result payload exceeds the configured size',
      );
    const payloadHash = hash(canonical(event));
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx);
      const now = new Date();
      await this.maintain(tx, settings, now);
      const job = await tx.prospectingJob.findUnique({ where: { id } });
      if (!job) throw new NotFoundException('Job not found');
      if (!job.dispatchState)
        throw new ConflictException('Job has no integrated admission');
      if (
        event.results !== null &&
        event.results.length > (job.requestedLimit ?? 0)
      )
        throw new BadRequestException(
          'Result count exceeds the requested limit',
        );
      const replay = await tx.prospectingJobEvent.findUnique({
        where: { jobId_eventId: { jobId: id, eventId: event.eventId } },
      });
      if (replay) {
        if (replay.payloadHash !== payloadHash)
          throw new ConflictException(
            'Event identifier reused with another payload',
          );
        return {};
      }
      if (
        event.sequence <= job.lastSequence ||
        (await tx.prospectingJobEvent.findUnique({
          where: { jobId_sequence: { jobId: id, sequence: event.sequence } },
        }))
      )
        throw new ConflictException('Event sequence is stale or reused');
      let late = false;
      if (TERMINAL.includes(job.status)) {
        late =
          job.status === 'FAILED' &&
          ['FINAL_EVENT_TIMEOUT', 'SERVICE_RESTARTED'].includes(
            job.failureCode ?? '',
          ) &&
          TERMINAL.includes(event.status);
        if (!late)
          throw new ConflictException('Terminal jobs cannot change state');
      } else if (
        (job.status === 'RUNNING' && event.status === 'QUEUED') ||
        (event.status === 'QUEUED' && job.lastSequence !== 0)
      )
        throw new ConflictException('Job state cannot regress');
      if (!late && event.results !== null) {
        const used = await tx.prospectingJobSnapshot.aggregate({
          _sum: { bytes: true },
        });
        if (
          (used._sum.bytes ?? 0) + resultsBytes >
          settings.maxTotalResultBytes
        )
          throw unavailable('PROSPECTOR_SNAPSHOT_CAPACITY_EXHAUSTED');
        const expiresAt = new Date(
          now.getTime() + settings.resultsTtlSeconds * 1000,
        );
        await tx.prospectingJobSnapshot.create({
          data: {
            jobId: id,
            results: JSON.parse(
              JSON.stringify(event.results),
            ) as Prisma.InputJsonValue,
            bytes: resultsBytes,
            expiresAt,
          },
        });
      }
      await tx.prospectingJobEvent.create({
        data: {
          jobId: id,
          eventId: event.eventId,
          sequence: event.sequence,
          payloadHash,
          disposition: late ? 'LATE_TERMINAL_DISCARDED' : 'APPLIED',
        },
      });
      if (late) {
        await tx.prospectingJob.update({
          where: { id },
          data: { lastSequence: event.sequence, capacityReleasedAt: now },
        });
      } else {
        const terminal = TERMINAL.includes(event.status);
        await tx.prospectingJob.update({
          where: { id },
          data: {
            status: event.status,
            dispatchState: 'ACCEPTED',
            lastSequence: event.sequence,
            ...(event.status === 'RUNNING' && !job.startedAt
              ? { startedAt: timestamp }
              : {}),
            ...(terminal
              ? { completedAt: timestamp, capacityReleasedAt: now }
              : {}),
            ...(event.status === 'FAILED'
              ? {
                  failureCode: event.error!.code,
                  error: 'La búsqueda falló en el servicio de prospección.',
                }
              : {}),
            ...(event.status === 'COMPLETED'
              ? {
                  resultsExpiresAt: new Date(
                    now.getTime() + settings.resultsTtlSeconds * 1000,
                  ),
                }
              : {}),
          },
        });
      }
      return {};
    });
  }
}
