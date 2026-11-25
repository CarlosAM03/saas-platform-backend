import { createHash } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../common/context/tenant-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProspectsService } from '../prospects/prospects.service';
import { BatchCallbackDto, CreateBatchDto, EventKind } from './batch.dto';
import { BatchRuntime } from './batch-runtime';
import { BatchTransportError } from './batch-transport';
import { parseBatchStatus, parseSnapshot } from './remote-batch';

const details = {
  jobs: { orderBy: { position: 'asc' } },
} satisfies Prisma.ProspectingBatchInclude;
type StoredBatch = Prisma.ProspectingBatchGetPayload<{
  include: typeof details;
}>;
const validKey = /^[A-Za-z0-9._~-]{1,128}$/u;

function digest(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function progressOf(
  progress: BatchCallbackDto['progress'],
): Prisma.InputJsonObject | undefined {
  if (!progress) return undefined;
  const { kind, stage, name, value } = progress;
  if (
    (kind === 'stage_started' || kind === 'stage_completed') &&
    typeof stage === 'string' &&
    Object.keys(progress).length === 2
  ) {
    return { kind, stage };
  }
  if (
    kind === 'metric_updated' &&
    typeof name === 'string' &&
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Object.keys(progress).length === 3
  ) {
    return { kind, name, value };
  }
  throw new BadRequestException('Invalid callback progress');
}

@Injectable()
export class BatchAdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TenantContextService,
    private readonly runtime: BatchRuntime,
    private readonly prospects: ProspectsService,
  ) {}

  async create(input: CreateBatchDto, key: string | undefined) {
    const { transport, solutionId } = this.runtime.connect();
    if (!key || !validKey.test(key)) {
      throw new BadRequestException('Valid Idempotency-Key is required');
    }
    const identity = await this.identity();
    const { tenantId, userId: ownerId } = identity;
    const queries = input.queries.map(
      ({ source, keyword, location, limit }) => ({
        source,
        keyword,
        location,
        limit,
      }),
    );
    const makeBody = (batchId: string, ids: readonly string[]) =>
      JSON.stringify({
        batchId,
        jobs: queries.map((query, position) => ({
          jobId: ids[position],
          query,
        })),
      });
    const cuidLengthSample = 'c'.padEnd(25, 'a');
    if (
      Buffer.byteLength(
        makeBody(
          cuidLengthSample,
          queries.map(() => cuidLengthSample),
        ),
      ) > 65_536
    ) {
      throw new BadRequestException('Batch request is too large');
    }
    const request = {
      solutionId,
      tenantId,
      ownerId,
      requestKeyHash: digest(key),
    };
    const requestHash = digest(
      JSON.stringify({ campaignId: input.campaignId, queries }),
    );

    const previous = await this.prisma.prospectingBatch.findUnique({
      where: { batchRequest: request },
      include: details,
    });
    if (previous) {
      if (previous.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency-Key already used with different input',
        );
      }
      return this.view(previous);
    }
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: input.campaignId, tenantId },
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    let reservation: StoredBatch;
    try {
      reservation = await this.prisma.prospectingBatch.create({
        data: {
          ...request,
          requestHash,
          campaignId: campaign.id,
          jobs: { create: queries.map((_, position) => ({ position })) },
        },
        include: details,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      const winner = await this.prisma.prospectingBatch.findUnique({
        where: { batchRequest: request },
        include: details,
      });
      if (!winner) throw error;
      if (winner.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency-Key already used with different input',
        );
      }
      return this.view(winner);
    }

    const ids = reservation.jobs.map(({ id }) => id);
    try {
      const receipt = await transport.admit(
        identity,
        reservation.id,
        ids,
        makeBody(reservation.id, ids),
        reservation.id,
      );
      await this.prisma.$transaction([
        this.prisma.prospectingBatch.update({
          where: { id: reservation.id },
          data: {
            admission: 'ACCEPTED',
            acceptedAt: new Date(receipt.acceptedAt),
          },
        }),
        this.prisma.prospectingBatchJob.updateMany({
          where: { batchId: reservation.id, state: null },
          data: { state: 'QUEUED', observedAt: new Date(receipt.acceptedAt) },
        }),
      ]);
    } catch (error) {
      if (!(error instanceof BatchTransportError)) throw error;
      await this.prisma.prospectingBatch.updateMany({
        where: { id: reservation.id, admission: 'PENDING' },
        data:
          error.kind === 'rejected'
            ? { admission: 'REJECTED', rejectionStatus: error.status }
            : { admission: 'UNCERTAIN' },
      });
    }
    return this.view(
      await this.prisma.prospectingBatch.findUniqueOrThrow({
        where: { id: reservation.id },
        include: details,
      }),
    );
  }

  async detail(id: string) {
    return this.view((await this.owned(id)).batch);
  }

  async reconcile(id: string) {
    const { batch, identity, transport } = await this.owned(id);
    try {
      const remote = parseBatchStatus(
        (await transport.readStatus(identity, id)).data,
        batch,
      );
      await this.prisma.$transaction([
        this.prisma.prospectingBatch.update({
          where: { id },
          data: {
            admission: 'ACCEPTED',
            acceptedAt: remote.acceptedAt,
            rejectionStatus: null,
          },
        }),
        ...remote.jobs.map(({ id: jobId, ...observation }) =>
          this.prisma.prospectingBatchJob.updateMany({
            where: {
              batchId: id,
              id: jobId,
              OR: [
                { sequence: { lt: observation.sequence } },
                { sequence: observation.sequence, state: null },
              ],
            },
            data: observation,
          }),
        ),
      ]);
    } catch (error) {
      // A missing remote batch does not prove a timed-out admission was rejected.
      if (
        error instanceof BatchTransportError &&
        error.status === 404 &&
        (batch.admission === 'PENDING' || batch.admission === 'UNCERTAIN')
      ) {
        return { ...this.view(batch), remoteObserved: false };
      }
      throw this.upstream(error);
    }
    return { ...(await this.detail(id)), remoteObserved: true };
  }

  async preview(id: string, jobId: string) {
    const { batch, identity, transport } = await this.owned(id);
    const job = batch.jobs.find((item) => item.id === jobId);
    if (!job) throw new NotFoundException('Batch job not found');
    if (job.availability && job.availability !== 'AVAILABLE') {
      throw new GoneException('Snapshot is no longer available');
    }
    if (job.availability !== 'AVAILABLE' || !job.quality) {
      throw new ConflictException(
        'Snapshot availability has not been confirmed',
      );
    }
    try {
      const {
        id: snapshotId,
        expiresAt,
        rows,
      } = parseSnapshot(
        await transport.readSnapshot(identity, id, jobId),
        batch.campaignId,
      );
      if (expiresAt.getTime() <= Date.now()) {
        throw new GoneException('Snapshot is no longer available');
      }
      return {
        snapshotId,
        expiresAt,
        quality: job.quality,
        rows: await Promise.all(
          rows.map(async (row, index) => {
            try {
              return {
                index,
                row,
                ...(await this.prospects.match(row)),
                blocked: false,
              };
            } catch (error) {
              if (!(error instanceof ConflictException)) throw error;
              return { index, row, blocked: true };
            }
          }),
        ),
      };
    } catch (error) {
      throw this.upstream(error);
    }
  }

  private async owned(id: string) {
    const { solutionId, transport } = this.runtime.connect();
    const identity = await this.identity();
    const { tenantId, userId: ownerId } = identity;
    const batch = await this.prisma.prospectingBatch.findFirst({
      where: { id, solutionId, tenantId, ownerId },
      include: details,
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return { batch, identity, transport };
  }

  private upstream(error: unknown) {
    if (!(error instanceof BatchTransportError)) return error;
    if (error.status === 410)
      return new GoneException('Snapshot is no longer available');
    if (error.status === 404)
      return new NotFoundException('Remote batch or job not found');
    if (error.status === 409)
      return new ConflictException(
        'Remote batch state does not allow this operation',
      );
    if (error.status === 429)
      return new HttpException('Service quota exceeded', 429);
    return new BadGatewayException(
      'Private batch service could not confirm the operation',
    );
  }

  async receive(
    solutionId: string,
    batchId: string,
    jobId: string,
    event: BatchCallbackDto,
  ) {
    if (event.batchId !== batchId || event.jobId !== jobId) {
      throw new NotFoundException('Batch job not found');
    }
    const progress = progressOf(event.progress);
    if ((event.kind === EventKind.PROGRESS) !== (progress !== undefined)) {
      throw new BadRequestException('Callback event and progress differ');
    }
    const eventHash = digest(
      JSON.stringify({
        jobId,
        batchId,
        schemaVersion: event.schemaVersion,
        queryIndex: event.queryIndex,
        sequence: event.sequence,
        timestamp: event.timestamp,
        kind: event.kind,
        status: event.status,
        progress,
        quality: event.quality,
        availability: event.availability,
        snapshotId: event.snapshotId,
        expiresAt: event.expiresAt,
        error: event.error && {
          code: event.error.code,
          message: event.error.message,
        },
      }),
    );
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.prospectingBatchJob.findFirst({
        where: {
          id: jobId,
          batchId,
          position: event.queryIndex,
          batch: { solutionId },
        },
        select: { id: true },
      });
      if (!job) throw new NotFoundException('Batch job not found');
      const inserted = await tx.prospectingBatchEvent.createMany({
        data: {
          id: event.eventId,
          jobId,
          sequence: event.sequence,
          digest: eventHash,
        },
        skipDuplicates: true,
      });
      if (inserted.count === 0) {
        const receipt = await tx.prospectingBatchEvent.findUniqueOrThrow({
          where: { id: event.eventId },
          select: { digest: true },
        });
        if (receipt.digest !== eventHash) {
          throw new ConflictException('Callback event identifier already used');
        }
        return { acknowledged: true };
      }
      await tx.prospectingBatchJob.updateMany({
        where: { id: jobId, sequence: { lt: event.sequence } },
        data: {
          sequence: event.sequence,
          state: event.status,
          observedAt: new Date(event.timestamp),
          progress,
          quality: event.quality,
          availability: event.availability,
          errorCode: event.error?.code,
          snapshotId: event.snapshotId,
          expiresAt: event.expiresAt ? new Date(event.expiresAt) : undefined,
        },
      });
      await tx.prospectingBatch.updateMany({
        where: { id: batchId, admission: { in: ['PENDING', 'UNCERTAIN'] } },
        data: { admission: 'ACCEPTED' },
      });
      return { acknowledged: true };
    });
  }

  private async identity() {
    const tenantId = this.context.requireTenantId();
    const claims = this.context.getRequiredContext();
    const [user, tenant] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: claims.userId },
        select: {
          platformRole: true,
          status: true,
          userTenants: {
            where: { tenantId, role: { tenantId } },
            select: { role: { select: { name: true } } },
          },
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { status: true },
      }),
    ]);
    const admin =
      claims.platformRole === 'ADMIN' && user?.platformRole === 'ADMIN';
    const owner =
      claims.tenantRole === 'OWNER' &&
      user?.userTenants.some(({ role }) => role.name === 'OWNER');
    if (
      tenant?.status !== 'ACTIVO' ||
      user?.status !== 'ACTIVO' ||
      (!admin && !owner)
    ) {
      throw new ForbiddenException('Insufficient batch permissions');
    }
    return { tenantId, userId: claims.userId };
  }

  private view(
    batch: Prisma.ProspectingBatchGetPayload<{ include: typeof details }>,
  ) {
    const {
      id,
      campaignId,
      admission,
      rejectionStatus,
      acceptedAt,
      createdAt,
      jobs,
    } = batch;
    return {
      id,
      campaignId,
      admission,
      rejectionStatus,
      acceptedAt,
      createdAt,
      jobs: jobs.map((job) => ({
        id: job.id,
        position: job.position,
        state: job.state,
        sequence: job.sequence,
        quality: job.quality,
        availability: job.availability,
        progress: job.progress,
        snapshotId: job.snapshotId,
        expiresAt: job.expiresAt,
        observedAt: job.observedAt,
        ackAt: job.ackAt,
        errorCode: job.errorCode,
      })),
    };
  }
}
