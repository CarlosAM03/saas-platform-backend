import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { ProspectorPolicy } from './prospector-policy';
import {
  ProspectorClientService,
  ProspectorTransportError,
} from './prospector-client.service';
import { policyFixture } from '../../test/support/prospector-policy.fixture';

const jobId = 'c000000000000000000000001';
const start = {
  jobId,
  tenantId: 'c000000000000000000000002',
  callbackUrl: '/api/v1/internal/prospecting-jobs/' + jobId + '/events',
  query: {
    keyword: 'cafe',
    location: 'Tijuana',
    source: 'google_maps' as const,
    limit: 5,
  },
};
describe('Prospector real HTTP transport boundary', () => {
  let server: Server, client: ProspectorClientService;
  let status: number,
    responseBody: unknown,
    calls: number,
    delay: number,
    contentType: string;
  let observed: { key?: string | string[]; body?: unknown; path?: string };
  beforeEach(async () => {
    status = 202;
    responseBody = {
      success: true,
      data: { jobId, status: 'QUEUED', acceptedAt: new Date().toISOString() },
      meta: {},
    };
    calls = 0;
    delay = 0;
    contentType = 'application/json';
    observed = {};
    server = createServer((request, response) => {
      calls++;
      observed.key = request.headers['x-api-key'];
      observed.path = request.url;
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        if (chunks.length)
          observed.body = JSON.parse(
            Buffer.concat(chunks).toString('utf8'),
          ) as unknown;
        setTimeout(() => {
          response.writeHead(status, {
            'Content-Type': contentType,
            Location: '/trap',
          });
          response.end(JSON.stringify(responseBody));
        }, delay);
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const port = (server.address() as AddressInfo).port;
    const config = new ConfigService({
      ...policyFixture,
      PROSPECTOR_SERVICE_URL: 'http://127.0.0.1:' + port,
      PROSPECTOR_HTTP_TIMEOUT_MS: '100',
    });
    client = new ProspectorClientService(new ProspectorPolicy(config));
  });
  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it('posts the exact request with the outbound credential and validates 202', async () => {
    expect(await client.startJob(start)).toMatchObject({
      jobId,
      status: 'QUEUED',
    });
    expect(observed).toMatchObject({
      key: policyFixture.PROSPECTOR_SERVICE_API_KEY,
      body: start,
      path: '/api/v1/prospecting/jobs',
    });
    expect(calls).toBe(1);
  });
  it.each([400, 401, 409, 503])(
    'classifies HTTP %s without exposing the upstream body or retrying',
    async (code) => {
      status = code;
      responseBody = {
        error: { message: policyFixture.PROSPECTOR_SERVICE_API_KEY },
      };
      await expect(client.startJob(start)).rejects.toMatchObject({
        kind: 'UPSTREAM_' + code,
      });
      try {
        await client.startJob(start);
      } catch (error) {
        expect(String(error)).not.toContain(
          policyFixture.PROSPECTOR_SERVICE_API_KEY,
        );
      }
      expect(calls).toBe(2); // Two deliberate calls, no automatic retry.
    },
  );
  it('does not follow redirects or deliver the key to the redirect destination', async () => {
    status = 307;
    await expect(client.startJob(start)).rejects.toMatchObject({
      kind: 'REDIRECT',
    });
    expect(calls).toBe(1);
    expect(observed.path).not.toBe('/trap');
  });
  it('distinguishes total deadline timeout from definitive rejection', async () => {
    delay = 250;
    await expect(client.startJob(start)).rejects.toMatchObject({
      kind: 'TIMEOUT',
      definitiveRejection: false,
    });
    expect(calls).toBe(1);
  });
  it.each([
    { success: false },
    {
      success: true,
      data: {
        jobId: 'another',
        status: 'QUEUED',
        acceptedAt: new Date().toISOString(),
      },
      meta: {},
    },
    {
      success: true,
      data: {
        jobId,
        status: 'COMPLETED',
        acceptedAt: new Date().toISOString(),
      },
      meta: {},
    },
    {
      success: true,
      data: { jobId, status: 'QUEUED', acceptedAt: 'not-a-date' },
      meta: {},
    },
  ])('rejects malformed 202 body %# as uncertain', async (body) => {
    responseBody = body;
    await expect(client.startJob(start)).rejects.toMatchObject({
      kind: 'INVALID_RESPONSE',
      definitiveRejection: false,
    });
  });
  it('requires all real readiness checks before admission', async () => {
    status = 200;
    responseBody = {
      status: 'ready',
      checks: {
        configuration: true,
        engine_browser_startup_probe: true,
        worker: true,
        queue_capacity: true,
        registry_capacity: false,
      },
    };
    await expect(
      client.assertReady(client.assertAvailable()),
    ).rejects.toThrow();
    expect(observed.key).toBeUndefined();
  });
  it('network refusal is uncertain and no internal HTTP cancellation is introduced', async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await expect(client.startJob(start)).rejects.toBeInstanceOf(
      ProspectorTransportError,
    );
    await expect(client.cancelJob(jobId)).rejects.toThrow();
  });
});
