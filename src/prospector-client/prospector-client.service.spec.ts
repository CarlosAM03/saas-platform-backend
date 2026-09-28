import { ServiceUnavailableException } from '@nestjs/common';
import { ProspectorClientService } from './prospector-client.service';

describe('ProspectorClientService disabled adapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('refuses availability before a caller writes jobs', () => {
    expect(() => new ProspectorClientService().assertAvailable()).toThrow(
      ServiceUnavailableException,
    );
  });

  it('rejects start and cancellation without contacting Python', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected network call'));
    const service = new ProspectorClientService();
    await expect(
      service.startJob({
        jobId: 'cm123456789012345678901234',
        tenantId: 'cm987654321098765432109876',
        query: {
          keyword: 'restaurants',
          location: 'Tijuana',
          source: 'google_maps',
          limit: 20,
        },
        callbackUrl: '/api/v1/internal/prospecting-jobs/job/events',
      }),
    ).rejects.toMatchObject({
      status: 503,
      response: { details: { reason: 'PROSPECTOR_INTEGRATION_PENDING' } },
    });
    await expect(service.cancelJob('job')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
