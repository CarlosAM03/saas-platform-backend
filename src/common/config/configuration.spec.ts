import { validateEnvironment } from './configuration';

const valid = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://example.invalid/test',
  JWT_SECRET: 'unit-test-secret',
  JWT_EXPIRES_IN: '8h',
  CORS_ORIGINS: 'http://localhost:4200',
};

describe('F4 configuration', () => {
  it('starts without Prospector configuration', () => {
    expect(() => validateEnvironment(valid)).not.toThrow();
  });
  it.each(['ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'])(
    'does not require seed-only %s at runtime',
    (key) => {
      expect(() => validateEnvironment({ ...valid, [key]: ' ' })).not.toThrow();
    },
  );
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
