import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isISO8601 } from 'class-validator';
import type { StartProspectingJobRequest } from './dto/start-prospecting-job.request';
import type {
  AcceptedJob,
  AcceptedJobResponse,
} from './dto/accepted-job.response';

@Injectable()
export class ProspectorClientService {
  constructor(private readonly config: ConfigService) {}

  async cancelJob(jobId: string): Promise<void> {
    const serviceUrl = this.config.getOrThrow<string>('PROSPECTOR_SERVICE_URL');
    const apiKey = this.config.getOrThrow<string>('PROSPECTOR_API_KEY');
    let response: Response;
    try {
      response = await fetch(
        new URL(
          `/api/v1/prospecting/jobs/${encodeURIComponent(jobId)}/cancel`,
          serviceUrl,
        ),
        {
          method: 'POST',
          headers: { Accept: 'application/json', 'X-API-Key': apiKey },
          redirect: 'error',
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'Unable to request job cancellation',
      );
    }
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 409)
      throw new ConflictException('Job can no longer be cancelled');
    if (response.status !== 202)
      throw new ServiceUnavailableException('Cancellation was not accepted');
  }

  async startJob(request: StartProspectingJobRequest): Promise<AcceptedJob> {
    const serviceUrl = this.config.getOrThrow<string>('PROSPECTOR_SERVICE_URL');

    const apiKey = this.config.getOrThrow<string>('PROSPECTOR_API_KEY');

    let response: Response;

    try {
      const url = new URL('/api/v1/prospecting/jobs', serviceUrl);

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(request),
        redirect: 'error',
      });
    } catch {
      throw new ServiceUnavailableException(
        'Unable to connect to Prospector Service',
      );
    }

    if (response.status !== 202) {
      // No necesitamos leer ni exponer el cuerpo del error externo.
      await response.body?.cancel().catch(() => undefined);

      if (response.status === 409) {
        throw new ConflictException(
          'Prospector Service reported a job conflict',
        );
      }

      throw new ServiceUnavailableException(
        'Prospector Service could not accept the job',
      );
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      throw new ServiceUnavailableException(
        'Prospector Service returned invalid JSON',
      );
    }

    if (!this.isAcceptedJobResponse(body, request.jobId)) {
      throw new ServiceUnavailableException(
        'Prospector Service returned an invalid acceptance response',
      );
    }

    return body.data;
  }

  private isAcceptedJobResponse(
    value: unknown,
    expectedJobId: string,
  ): value is AcceptedJobResponse {
    if (!this.isObject(value) || value.success !== true) {
      return false;
    }

    const data = value.data;

    if (!this.isObject(data)) {
      return false;
    }

    return (
      typeof data.jobId === 'string' &&
      data.jobId === expectedJobId &&
      data.status === 'QUEUED' &&
      typeof data.acceptedAt === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        data.acceptedAt,
      ) &&
      isISO8601(data.acceptedAt, { strict: true, strictSeparator: true })
    );
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
