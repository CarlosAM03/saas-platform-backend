import { ConfigService } from '@nestjs/config';
import { ProspectorPolicy } from './prospector-policy';

import { policyFixture } from '../../test/support/prospector-policy.fixture';
const policy = (change: Record<string, unknown> = {}) =>
  new ProspectorPolicy(new ConfigService({ ...policyFixture, ...change }));
describe('Prospector admission configuration', () => {
  it('is disabled by default and cannot be enabled by URL alone', () => {
    expect(policy({ PROSPECTOR_ENABLED: undefined }).inspect().enabled).toBe(
      false,
    );
    expect(() =>
      policy({ PROSPECTOR_BUDGET_APPROVED: 'false' }).requireEnabled(),
    ).toThrow();
    expect(() =>
      policy({ PROSPECTOR_MAX_ACTIVE_JOBS: '' }).requireEnabled(),
    ).toThrow();
  });
  it('accepts explicit bounded local test policy and adopts Backend snapshot TTL', () => {
    expect(policy().requireEnabled()).toMatchObject({
      maxActive: 1,
      resultsTtlSeconds: 3600,
    });
  });
  it.each([
    { NODE_ENV: 'production' },
    { PROSPECTOR_SERVICE_URL: 'http://service.example' },
    { PROSPECTOR_SERVICE_URL: 'https://example.test/api/v1' },
    { PROSPECTOR_SERVICE_URL: 'https://user:secret@example.test' },
    { PROSPECTOR_CALLBACK_ORIGIN: 'https://example.test/?target=other' },
    { PROSPECTOR_SERVICE_API_KEY: '' },
    { PROSPECTOR_CALLBACK_API_KEY: '' },
    { PROSPECTOR_MAX_ACTIVE_JOBS: '18' },
    { PROSPECTOR_GLOBAL_JOBS_PER_PERIOD: '101' },
    {
      PROSPECTOR_TENANT_JOBS_PER_PERIOD: '99',
      PROSPECTOR_GLOBAL_JOBS_PER_PERIOD: '10',
    },
    { PROSPECTOR_MAX_RESULT_BYTES: '2097152' },
    { PROSPECTOR_QUOTA_PERIOD_SECONDS: '0' },
  ])('rejects unsafe or incomplete policy %#', (change) => {
    expect(policy(change).inspect().settings).toBeNull();
    expect(() => policy(change).requireEnabled()).toThrow();
  });
});
