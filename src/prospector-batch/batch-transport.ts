import { createHash, createHmac } from 'node:crypto';

const basePath = '/api/v1/prospecting/batches';
const cuid = /^c[a-z0-9]{20,127}$/u;
const replayKey = /^[A-Za-z0-9._~-]{1,128}$/u;
const assertionHeader = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString(
  'base64url',
);

export interface BatchScope {
  tenantId: string;
  userId: string;
}

export interface BatchServiceConfig {
  origin: string;
  apiKey: string;
  assertionKey: string;
  issuer: string;
  audience: string;
  solutionId: string;
  timeoutMs: number;
}

export interface AdmissionReceipt {
  batchId: string;
  jobIds: string[];
  status: 'QUEUED';
  acceptedAt: string;
}

export interface RemoteBatchEnvelope {
  data: unknown;
  meta: unknown;
}

export class BatchTransportError extends Error {
  constructor(
    readonly kind:
      'rejected' | 'uncertain' | 'unavailable' | 'invalid-response',
    readonly status?: number,
  ) {
    super(`Prospector Service ${kind}`);
    this.name = 'BatchTransportError';
  }
}

interface Operation {
  method: 'GET' | 'POST';
  path: string;
  scope: string;
  actor: 'owner' | 'platform';
  body?: string;
  idempotencyKey?: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function batchPath(batchId: string): string {
  if (!cuid.test(batchId)) throw new TypeError('Invalid batch identifier');
  return `${basePath}/${batchId}`;
}

function jobPath(batchId: string, jobId: string): string {
  if (!cuid.test(jobId)) throw new TypeError('Invalid job identifier');
  return `${batchPath(batchId)}/jobs/${jobId}`;
}

/** Wire adapter for the private contract. Platform controls replay and persistence. */
export class BatchTransport {
  private readonly origin: string;

  constructor(
    private readonly config: BatchServiceConfig,
    private readonly http: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    const url = new URL(config.origin);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !config.issuer ||
      !config.audience ||
      !config.solutionId ||
      Buffer.byteLength(config.apiKey) < 32 ||
      !/^[\x21-\x7e]+$/u.test(config.apiKey) ||
      Buffer.byteLength(config.assertionKey) < 32 ||
      config.apiKey === config.assertionKey ||
      !Number.isSafeInteger(config.timeoutMs) ||
      config.timeoutMs <= 0 ||
      config.timeoutMs > 120_000
    ) {
      throw new TypeError('Invalid private Prospector Service configuration');
    }
    this.origin = url.origin;
  }

  async admit(
    identity: BatchScope,
    batchId: string,
    jobIds: readonly string[],
    body: string,
    idempotencyKey: string,
  ): Promise<AdmissionReceipt> {
    batchPath(batchId);
    if (
      !replayKey.test(idempotencyKey) ||
      jobIds.length < 1 ||
      jobIds.length > 5 ||
      new Set(jobIds).size !== jobIds.length ||
      !jobIds.every((id) => cuid.test(id)) ||
      !body ||
      Buffer.byteLength(body) > 65_536
    ) {
      throw new TypeError('Invalid batch admission envelope');
    }
    const payload: unknown = JSON.parse(body);
    if (
      !record(payload) ||
      payload.batchId !== batchId ||
      !Array.isArray(payload.jobs) ||
      payload.jobs.length !== jobIds.length ||
      !payload.jobs.every(
        (job, index) => record(job) && job.jobId === jobIds[index],
      )
    ) {
      throw new TypeError(
        'Batch body does not match the registered identifiers',
      );
    }
    const { data } = await this.send(identity, {
      method: 'POST',
      path: basePath,
      actor: 'owner',
      scope: 'prospecting:batches:create',
      body,
      idempotencyKey,
    });
    if (!isReceipt(data, batchId, jobIds)) {
      throw new BatchTransportError('uncertain', 202);
    }
    return data;
  }

  readStatus(
    identity: BatchScope,
    batchId: string,
  ): Promise<RemoteBatchEnvelope> {
    return this.send(identity, {
      method: 'GET',
      path: batchPath(batchId),
      actor: 'owner',
      scope: 'prospecting:batches:read',
    });
  }

  readSnapshot(
    identity: BatchScope,
    batchId: string,
    jobId: string,
  ): Promise<RemoteBatchEnvelope> {
    return this.send(identity, {
      method: 'GET',
      path: `${jobPath(batchId, jobId)}/results`,
      actor: 'platform',
      scope: 'prospecting:results:import',
    });
  }

  acknowledge(identity: BatchScope, batchId: string, jobId: string) {
    return this.send(identity, {
      method: 'POST',
      path: `${jobPath(batchId, jobId)}/ack`,
      actor: 'platform',
      scope: 'prospecting:results:ack',
    });
  }

  purge(identity: BatchScope, batchId: string, jobId: string) {
    return this.send(identity, {
      method: 'POST',
      path: `${jobPath(batchId, jobId)}/purge`,
      actor: 'platform',
      scope: 'prospecting:results:purge',
    });
  }

  private sign(identity: BatchScope, operation: Operation): string {
    if (!cuid.test(identity.tenantId) || !cuid.test(identity.userId)) {
      throw new TypeError('Invalid Platform identity');
    }
    const issuedAt = Math.floor(this.now() / 1000);
    const claims = {
      iss: this.config.issuer,
      aud: this.config.audience,
      solutionId: this.config.solutionId,
      iat: issuedAt,
      exp: issuedAt + 120,
      tenantId: identity.tenantId,
      sub: identity.userId,
      actorType: operation.actor,
      scope: operation.scope,
      method: operation.method,
      path: operation.path,
      query: '',
      idempotencyKey: operation.idempotencyKey ?? '',
      bodySha256: createHash('sha256')
        .update(operation.body ?? '', 'utf8')
        .digest('hex'),
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const input = `${assertionHeader}.${payload}`;
    const signature = createHmac('sha256', this.config.assertionKey)
      .update(input)
      .digest('base64url');
    return `${input}.${signature}`;
  }

  private async send(
    identity: BatchScope,
    operation: Operation,
  ): Promise<RemoteBatchEnvelope> {
    const isAdmission = operation.idempotencyKey !== undefined;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-API-Key': this.config.apiKey,
      'X-Platform-Assertion': this.sign(identity, operation),
    };
    if (isAdmission) {
      headers['Idempotency-Key'] = operation.idempotencyKey!;
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await this.http(this.origin + operation.path, {
        method: operation.method,
        headers,
        body: operation.body,
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch {
      throw new BatchTransportError(isAdmission ? 'uncertain' : 'unavailable');
    }

    const expected = isAdmission ? 202 : 200;
    if (response.status !== expected) {
      await response.body?.cancel().catch(() => undefined);
      if ([400, 401, 403, 404, 409, 410, 413, 429].includes(response.status)) {
        throw new BatchTransportError('rejected', response.status);
      }
      throw new BatchTransportError(
        isAdmission ? 'uncertain' : 'unavailable',
        response.status,
      );
    }

    let envelope: unknown;
    try {
      envelope = await response.json();
    } catch {
      throw new BatchTransportError(
        isAdmission ? 'uncertain' : 'invalid-response',
        response.status,
      );
    }
    if (
      !record(envelope) ||
      envelope.success !== true ||
      !('data' in envelope)
    ) {
      throw new BatchTransportError(
        isAdmission ? 'uncertain' : 'invalid-response',
        response.status,
      );
    }
    return { data: envelope.data, meta: envelope.meta };
  }
}

function isReceipt(
  data: unknown,
  batchId: string,
  jobIds: readonly string[],
): data is AdmissionReceipt {
  return (
    record(data) &&
    data.batchId === batchId &&
    data.status === 'QUEUED' &&
    typeof data.acceptedAt === 'string' &&
    Number.isFinite(Date.parse(data.acceptedAt)) &&
    Array.isArray(data.jobIds) &&
    data.jobIds.length === jobIds.length &&
    jobIds.every((id, index) => id === (data.jobIds as unknown[])[index])
  );
}
