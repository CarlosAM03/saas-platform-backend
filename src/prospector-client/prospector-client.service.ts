import { Injectable } from '@nestjs/common';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import {
  ProspectorPolicy,
  ProspectorSettings,
  unavailable,
} from './prospector-policy';
import type { StartProspectingJobRequest } from './dto/start-prospecting-job.request';
import type { AcceptedJob } from './dto/accepted-job.response';

type TransportFailure =
  | 'TIMEOUT'
  | 'NETWORK'
  | 'INVALID_RESPONSE'
  | 'REDIRECT'
  | 'UPSTREAM_400'
  | 'UPSTREAM_401'
  | 'UPSTREAM_409'
  | 'UPSTREAM_503';
export class ProspectorTransportError extends Error {
  constructor(readonly kind: TransportFailure) {
    super('Prospector transport failure: ' + kind);
  }
  get definitiveRejection(): boolean {
    return ['UPSTREAM_400', 'UPSTREAM_401', 'UPSTREAM_503'].includes(this.kind);
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The existing Service has only start + health. No redirect, retry, cancel or export calls. */
@Injectable()
export class ProspectorClientService {
  constructor(private readonly policy: ProspectorPolicy) {}
  assertAvailable(): ProspectorSettings {
    return this.policy.requireEnabled();
  }
  async assertReady(settings: ProspectorSettings): Promise<void> {
    let body: unknown;
    try {
      body = await this.send(settings, '/health/ready', 'GET', 200);
    } catch {
      throw unavailable('PROSPECTOR_SERVICE_UNAVAILABLE');
    }
    const required = [
      'configuration',
      'engine_browser_startup_probe',
      'worker',
      'queue_capacity',
      'registry_capacity',
    ];
    if (
      !object(body) ||
      body.status !== 'ready' ||
      !object(body.checks) ||
      required.some(
        (key) => (body.checks as Record<string, unknown>)[key] !== true,
      )
    ) {
      throw unavailable('PROSPECTOR_SERVICE_UNAVAILABLE');
    }
  }
  async startJob(
    request: StartProspectingJobRequest,
    settings = this.policy.requireEnabled(),
  ): Promise<AcceptedJob> {
    const body = await this.send(
      settings,
      '/api/v1/prospecting/jobs',
      'POST',
      202,
      request,
    );
    if (
      !object(body) ||
      body.success !== true ||
      !object(body.data) ||
      !object(body.meta) ||
      Object.keys(body).some(
        (key) => !['success', 'data', 'meta'].includes(key),
      ) ||
      body.data.jobId !== request.jobId ||
      body.data.status !== 'QUEUED' ||
      typeof body.data.acceptedAt !== 'string' ||
      !/T.*(?:Z|\+00:00)$/.test(body.data.acceptedAt) ||
      !Number.isFinite(Date.parse(body.data.acceptedAt))
    ) {
      throw new ProspectorTransportError('INVALID_RESPONSE');
    }
    return {
      jobId: request.jobId,
      status: 'QUEUED',
      acceptedAt: body.data.acceptedAt,
    };
  }
  cancelJob(_jobId: string): Promise<void> {
    void _jobId;
    return Promise.reject(unavailable());
  }

  private send(
    settings: ProspectorSettings,
    path: string,
    method: 'GET' | 'POST',
    expected: number,
    data?: unknown,
  ): Promise<unknown> {
    const payload =
      data === undefined ? undefined : Buffer.from(JSON.stringify(data));
    if (payload && payload.length > 65536)
      return Promise.reject(new ProspectorTransportError('UPSTREAM_400'));
    const url = new URL(path, settings.serviceOrigin);
    return new Promise((resolve, reject) => {
      let timedOut = false;
      const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
        url,
        {
          method,
          headers: {
            Accept: 'application/json',
            ...(payload
              ? {
                  'Content-Type': 'application/json',
                  'Content-Length': payload.length,
                  'X-API-Key': settings.serviceKey,
                }
              : {}),
          },
        },
        (response) => {
          const status = response.statusCode;
          const chunks: Buffer[] = [];
          let length = 0;
          response.on('data', (chunk: Buffer) => {
            length += chunk.length;
            if (length > 65536) {
              response.destroy();
              reject(new ProspectorTransportError('INVALID_RESPONSE'));
            } else chunks.push(chunk);
          });
          response.on('error', () =>
            reject(
              new ProspectorTransportError(timedOut ? 'TIMEOUT' : 'NETWORK'),
            ),
          );
          response.on('end', () => {
            clearTimeout(timer);
            if ([400, 401, 409, 503].includes(status ?? 0)) {
              reject(
                new ProspectorTransportError(
                  ('UPSTREAM_' + status) as TransportFailure,
                ),
              );
              return;
            }
            if (status !== expected) {
              reject(
                new ProspectorTransportError(
                  status && status >= 300 && status < 400
                    ? 'REDIRECT'
                    : 'INVALID_RESPONSE',
                ),
              );
              return;
            }
            if (
              !response.headers['content-type']
                ?.toLowerCase()
                .includes('application/json')
            ) {
              reject(new ProspectorTransportError('INVALID_RESPONSE'));
              return;
            }
            try {
              resolve(
                JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
              );
            } catch {
              reject(new ProspectorTransportError('INVALID_RESPONSE'));
            }
          });
        },
      );
      const timer = setTimeout(() => {
        timedOut = true;
        request.destroy();
      }, settings.timeoutMs);
      timer.unref();
      request.on('error', () => {
        clearTimeout(timer);
        reject(new ProspectorTransportError(timedOut ? 'TIMEOUT' : 'NETWORK'));
      });
      request.end(payload);
    });
  }
}
