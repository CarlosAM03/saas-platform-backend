import { BadGatewayException } from '@nestjs/common';
import {
  BatchJobState,
  BatchResultAvailability,
  BatchResultQuality,
} from '@prisma/client';
import { isUUID } from 'class-validator';
import type { CreateProspectRequest } from '../prospects/dto/create-prospect.request';
import type { RemoteBatchEnvelope } from './batch-transport';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalid(): never {
  throw new BadGatewayException('Invalid private batch response');
}

function remoteDate(value: unknown): Date {
  if (
    typeof value !== 'string' ||
    !/T.*(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    invalid();
  }
  return new Date(value);
}

function parseEnum<T extends string>(value: unknown, options: readonly T[]): T {
  const option = options.find((item) => item === value);
  return option ?? invalid();
}

function remoteString(value: unknown): string | null {
  if (value === null || typeof value === 'string') return value;
  return invalid();
}

function snapshotId(value: unknown): string {
  if (typeof value !== 'string' || !isUUID(value)) invalid();
  return value;
}

export function parseBatchStatus(
  data: unknown,
  batch: { id: string; jobs: Array<{ id: string; position: number }> },
) {
  if (
    !isRecord(data) ||
    data.batchId !== batch.id ||
    typeof data.active !== 'boolean' ||
    !Array.isArray(data.jobs) ||
    data.jobs.length !== batch.jobs.length
  ) {
    invalid();
  }
  const acceptedAt = remoteDate(data.acceptedAt);
  const seen = new Set<string>();
  const jobs = (data.jobs as unknown[]).map((item) => {
    if (!isRecord(item)) return invalid();
    const stored = batch.jobs.find(
      ({ id, position }) => item.jobId === id && item.queryIndex === position,
    );
    const sequence = item.sequence;
    if (
      !stored ||
      seen.has(stored.id) ||
      typeof sequence !== 'number' ||
      !Number.isInteger(sequence) ||
      sequence < 0 ||
      sequence > 2_147_483_647
    ) {
      return invalid();
    }
    seen.add(stored.id);
    return {
      id: stored.id,
      sequence,
      state: parseEnum(item.status, Object.values(BatchJobState)),
      observedAt: remoteDate(item.updatedAt),
      availability:
        item.availability === null
          ? null
          : parseEnum(
              item.availability,
              Object.values(BatchResultAvailability),
            ),
      quality:
        item.quality === null
          ? null
          : parseEnum(item.quality, Object.values(BatchResultQuality)),
      ackAt: item.ackAt === null ? null : remoteDate(item.ackAt),
      errorCode: remoteString(item.errorCode),
      snapshotId:
        item.snapshotId === undefined ? null : snapshotId(item.snapshotId),
      expiresAt:
        item.expiresAt === undefined ? null : remoteDate(item.expiresAt),
    };
  });
  return { acceptedAt, jobs };
}

export function parseSnapshot(
  envelope: RemoteBatchEnvelope,
  campaignId: string,
) {
  const { data, meta } = envelope;
  if (!isRecord(meta) || !Array.isArray(data) || data.length > 150) invalid();
  const id = snapshotId(meta.snapshotId);
  const expiresAt = remoteDate(meta.expiresAt);
  const rows = (data as unknown[]).map((row): CreateProspectRequest => {
    if (
      !isRecord(row) ||
      row.source !== 'google_maps' ||
      typeof row.name !== 'string' ||
      !row.name.trim() ||
      (row.metadata !== null && !isRecord(row.metadata))
    ) {
      return invalid();
    }
    const identifier = remoteString(row.sourceIdentifier);
    if (
      identifier !== null &&
      (!identifier.trim() || identifier.length > 512)
    ) {
      return invalid();
    }
    return {
      campaignId,
      name: row.name,
      category: remoteString(row.category),
      address: remoteString(row.address),
      phone: remoteString(row.phone),
      email: remoteString(row.email),
      website: remoteString(row.website),
      language: remoteString(row.language),
      // By contract the Service mapper includes a sourceIdentifier only for verified Place IDs.
      ...(identifier === null
        ? {}
        : { identitySource: 'google_maps', identityIdentifier: identifier }),
    };
  });
  return { id, expiresAt, rows };
}

export function parseAck(data: unknown) {
  if (!isRecord(data)) invalid();
  return remoteDate(data.ackAt);
}

export function checkPurge(data: unknown): void {
  if (!isRecord(data) || data.availability !== 'PURGED') invalid();
}
