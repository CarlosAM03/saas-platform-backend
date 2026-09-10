import { validateEnvironment } from './configuration';

const valid = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://example.invalid/test',
  JWT_SECRET: 'unit-test-secret',
  JWT_EXPIRES_IN: '8h',
  PROSPECTOR_SERVICE_URL: 'http://example.invalid',
  PROSPECTOR_API_KEY: 'unit-test-key',
  CORS_ORIGINS: 'http://localhost:4200',
  ADMIN_NAME: 'Test',
  ADMIN_EMAIL: 'test@example.invalid',
  ADMIN_PASSWORD: 'Test-only-123!',
};

describe('F4 configuration', () => {
  it.each(Object.keys(valid))('rejects missing %s before startup', (key) => {
    expect(() => validateEnvironment({ ...valid, [key]: ' ' })).toThrow(key);
  });
  it('enforces the closed JWT lifetime and a valid port', () => {
    expect(() =>
      validateEnvironment({ ...valid, JWT_EXPIRES_IN: '30d' }),
    ).toThrow();
    expect(() => validateEnvironment({ ...valid, PORT: 'NaN' })).toThrow();
    expect(validateEnvironment(valid).PORT).toBe(3000);
  });
});
