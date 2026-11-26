import { createHash, createHmac } from 'node:crypto';
import { BatchTransport, type BatchServiceConfig } from './batch-transport';

const batchId = 'c' + 'a'.repeat(24);
const jobId = 'c' + 'b'.repeat(24);
const tenantId = 'c' + 't'.repeat(24);
const userId = 'c' + 'u'.repeat(24);
const identity = { tenantId, userId };
const config: BatchServiceConfig = {
  origin: 'https://service.example.invalid',
  apiKey: 'a'.repeat(32),
  assertionKey: 'b'.repeat(32),
  issuer: 'platform-test',
  audience: 'prospector-service/v1',
  solutionId: 'synthetic-saas',
  timeoutMs: 1000,
};
const body = JSON.stringify({
  batchId,
  jobs: [
    {
      jobId,
      query: {
        source: 'google_maps',
        keyword: 'Café sintético',
        location: 'Ciudad de prueba',
        limit: 1,
      },
    },
  ],
});
const receipt = {
  batchId,
  jobIds: [jobId],
  status: 'QUEUED',
  acceptedAt: '2026-11-25T20:00:00Z',
};
const batch = `/api/v1/prospecting/batches/${batchId}`;
const job = `${batch}/jobs/${jobId}`;

function json(data: unknown, status = 200): Response {
  return Response.json({ success: true, data, meta: {} }, { status });
}

function claims(token: string): unknown {
  const [header, payload, signature] = token.split('.');
  expect(Buffer.from(header, 'base64url').toString()).toBe(
    '{"alg":"HS256","typ":"JWT"}',
  );
  expect(signature).toBe(
    createHmac('sha256', config.assertionKey)
      .update(`${header}.${payload}`)
      .digest('base64url'),
  );
  return JSON.parse(Buffer.from(payload, 'base64url').toString()) as unknown;
}

describe('private batch wire transport', () => {
  const http = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  const candidate = new BatchTransport(config, http, () => 1_790_000_000_123);

  beforeEach(() => http.mockReset());

  it('binds admission to the exact UTF-8 transmitted bytes and ordered receipt', async () => {
    http.mockResolvedValueOnce(json(receipt, 202));
    await expect(
      candidate.admit(identity, batchId, [jobId], body, 'synthetic-a'),
    ).resolves.toEqual(receipt);
    expect(http).toHaveBeenCalledTimes(1);
    const [url, init] = http.mock.calls[0];
    expect(url).toBe(`${config.origin}/api/v1/prospecting/batches`);
    expect(init).toMatchObject({ method: 'POST', body, redirect: 'error' });
    const headers = new Headers(init?.headers);
    expect(headers.get('Idempotency-Key')).toBe('synthetic-a');
    expect(headers.get('X-API-Key')).toBe(config.apiKey);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(claims(headers.get('X-Platform-Assertion')!)).toEqual({
      iss: config.issuer,
      aud: config.audience,
      solutionId: config.solutionId,
      iat: 1_790_000_000,
      exp: 1_790_000_120,
      tenantId,
      sub: userId,
      actorType: 'owner',
      scope: 'prospecting:batches:create',
      method: 'POST',
      path: '/api/v1/prospecting/batches',
      query: '',
      idempotencyKey: 'synthetic-a',
      bodySha256: createHash('sha256').update(body).digest('hex'),
    });
  });

  it.each([
    ['GET', batch, 'owner', 'prospecting:batches:read'],
    ['GET', `${job}/results`, 'platform', 'prospecting:results:import'],
    ['POST', `${job}/ack`, 'platform', 'prospecting:results:ack'],
    ['POST', `${job}/purge`, 'platform', 'prospecting:results:purge'],
  ])('binds %s %s with no body', async (method, path, actorType, scope) => {
    http.mockResolvedValueOnce(json({}));
    switch (scope) {
      case 'prospecting:batches:read':
        await candidate.readStatus(identity, batchId);
        break;
      case 'prospecting:results:import':
        await candidate.readSnapshot(identity, batchId, jobId);
        break;
      case 'prospecting:results:ack':
        await candidate.acknowledge(identity, batchId, jobId);
        break;
      default:
        await candidate.purge(identity, batchId, jobId);
    }
    const [url, init] = http.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(url).toBe(config.origin + path);
    expect(init?.body).toBeUndefined();
    expect(init?.method).toBe(method);
    expect(headers.has('Idempotency-Key')).toBe(false);
    expect(claims(headers.get('X-Platform-Assertion')!)).toMatchObject({
      method,
      path,
      scope,
      actorType,
      query: '',
      idempotencyKey: '',
      bodySha256: createHash('sha256').digest('hex'),
    });
  });

  it('treats a lost admission response as uncertain without a retry', async () => {
    http.mockRejectedValueOnce(new Error('lost response'));
    await expect(
      candidate.admit(identity, batchId, [jobId], body, 'synthetic-a'),
    ).rejects.toMatchObject({ kind: 'uncertain' });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('treats a receipt for different jobs as an uncertain admission', async () => {
    http.mockResolvedValueOnce(json({ ...receipt, jobIds: [batchId] }, 202));
    await expect(
      candidate.admit(identity, batchId, [jobId], body, 'synthetic-a'),
    ).rejects.toMatchObject({ kind: 'uncertain', status: 202 });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('preserves explicit conflicts and expirations without copying remote text', async () => {
    http.mockResolvedValueOnce(
      new Response('synthetic remote detail', { status: 409 }),
    );
    await expect(
      candidate.admit(identity, batchId, [jobId], body, 'synthetic-a'),
    ).rejects.toMatchObject({
      kind: 'rejected',
      status: 409,
      message: 'Prospector Service rejected',
    });
    http.mockResolvedValueOnce(new Response(null, { status: 410 }));
    await expect(
      candidate.readSnapshot(identity, batchId, jobId),
    ).rejects.toMatchObject({
      kind: 'rejected',
      status: 410,
    });
  });

  it('rejects untrusted origin shapes, reused signing keys, and path injection', async () => {
    for (const origin of [
      'http://service.example.invalid',
      'https://service.example.invalid/other',
      'https://name@service.example.invalid',
      'https://service.example.invalid/?other=1',
    ]) {
      expect(() => new BatchTransport({ ...config, origin }, http)).toThrow(
        TypeError,
      );
    }
    expect(
      () =>
        new BatchTransport({ ...config, assertionKey: config.apiKey }, http),
    ).toThrow(TypeError);
    expect(() => candidate.readStatus(identity, '../unsafe')).toThrow(
      TypeError,
    );
    await expect(
      candidate.readStatus({ ...identity, tenantId: 'short' }, batchId),
    ).rejects.toThrow(TypeError);
    expect(http).not.toHaveBeenCalled();
  });
});
