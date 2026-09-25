import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProspectorClientService } from './prospector-client.service';
import type { StartProspectingJobRequest } from './dto/start-prospecting-job.request';

describe('ProspectorClientService', () => {
  let service: ProspectorClientService;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  const jobId = 'cm123456789012345678901234';

  const request: StartProspectingJobRequest = {
    jobId,
    tenantId: 'cm987654321098765432109876',
    query: {
      keyword: 'restaurantes',
      location: 'Tijuana, México',
      source: 'google_maps',
      limit: 20,
    },
    callbackUrl: `http://localhost:3000/api/v1/internal/prospecting-jobs/${jobId}/events`,
  };

  const acceptedJob = {
    jobId,
    status: 'QUEUED',
    acceptedAt: '2026-09-24T18:30:00.000Z',
  };

  beforeEach(() => {
    const config = new ConfigService({
      PROSPECTOR_SERVICE_URL: 'http://localhost:8000',
      PROSPECTOR_API_KEY: 'test-api-key',
    });

    service = new ProspectorClientService(config);

    fetchMock = jest.spyOn(globalThis, 'fetch');

    // Ninguna prueba debe hacer una conexión real por accidente.
    fetchMock.mockRejectedValue(new Error('No simulated response configured'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests cancellation with the internal key and does not follow redirects', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    await expect(service.cancelJob(jobId)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(`http://localhost:8000/api/v1/prospecting/jobs/${jobId}/cancel`),
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-API-Key': 'test-api-key' },
        redirect: 'error',
      },
    );
  });

  it('preserves a cancellation conflict', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 409 }));
    await expect(service.cancelJob(jobId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it.each([200, 401, 404, 503])(
    'rejects unexpected cancellation status %s',
    async (status) => {
      fetchMock.mockResolvedValue(new Response(null, { status }));
      await expect(service.cancelJob(jobId)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );

  it('does not claim cancellation when the connection fails', async () => {
    fetchMock.mockRejectedValue(new Error('Connection refused'));
    await expect(service.cancelJob(jobId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('envía la solicitud y devuelve el trabajo aceptado', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: acceptedJob,
        }),
        {
          status: 202,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const result = await service.startJob(request);

    expect(result).toEqual(acceptedJob);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('http://localhost:8000/api/v1/prospecting/jobs'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-Key': 'test-api-key',
        },
        body: JSON.stringify(request),
        redirect: 'error',
      },
    );
  });

  it('devuelve un error de disponibilidad si falla la conexión', async () => {
    fetchMock.mockRejectedValue(new Error('Connection refused'));

    await expect(service.startJob(request)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('devuelve un conflicto si Python responde 409', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 409 }));

    await expect(service.startJob(request)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it.each([200, 400, 401, 500, 503])(
    'rechaza el código HTTP %s como aceptación',
    async (status) => {
      fetchMock.mockResolvedValue(new Response(null, { status }));

      await expect(service.startJob(request)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );

  it('rechaza una respuesta que no contiene JSON válido', async () => {
    fetchMock.mockResolvedValue(
      new Response('Esto no es JSON', { status: 202 }),
    );

    await expect(service.startJob(request)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it.each([
    null,
    {},
    { success: false, data: acceptedJob },
    { success: true, data: null },
    {
      success: true,
      data: { ...acceptedJob, acceptedAt: '2026-02-30T12:00:00Z' },
    },
    {
      success: true,
      data: { ...acceptedJob, jobId: 'another-job' },
    },
    {
      success: true,
      data: { ...acceptedJob, status: 'COMPLETED' },
    },
    {
      success: true,
      data: { ...acceptedJob, acceptedAt: 'invalid-date' },
    },
  ])('rechaza una respuesta de aceptación inválida: %j', async (body) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(body), { status: 202 }),
    );

    await expect(service.startJob(request)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
