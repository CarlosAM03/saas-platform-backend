import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { StartProspectingJobRequest } from './dto/start-prospecting-job.request';
import type { AcceptedJob } from './dto/accepted-job.response';

/** Disabled adapter for the first deployment; never contacts Python. */
@Injectable()
export class ProspectorClientService {
  assertAvailable(): never {
    throw this.unavailable();
  }

  startJob(_request: StartProspectingJobRequest): Promise<AcceptedJob> {
    void _request;
    return Promise.reject(this.unavailable());
  }

  cancelJob(_jobId: string): Promise<void> {
    void _jobId;
    return Promise.reject(this.unavailable());
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      message: 'Prospector integration is pending',
      details: { reason: 'PROSPECTOR_INTEGRATION_PENDING' },
    });
  }
}
