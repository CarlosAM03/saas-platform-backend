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

describe('production configuration safety', () => {
  const production = {
    ...valid,
    NODE_ENV: 'production',
    JWT_SECRET: 'secure-production-placeholder-for-tests-123456',
    CORS_ORIGINS: 'https://frontend.example.invalid',
  };
  it('starts without any Service configuration', () =>
    expect(() => validateEnvironment(production)).not.toThrow());
  it.each(['short', 'replace-with-a-production-secret-even-if-long'])(
    'rejects unsafe signing key %s',
    (secret) =>
      expect(() =>
        validateEnvironment({ ...production, JWT_SECRET: secret }),
      ).toThrow('JWT_SECRET'),
  );
  it.each([
    '*',
    'http://frontend.example.invalid',
    'https://user:password@frontend.example.invalid',
    'https://frontend.example.invalid/path',
  ])('rejects unsafe CORS origin %s', (origin) =>
    expect(() =>
      validateEnvironment({ ...production, CORS_ORIGINS: origin }),
    ).toThrow('CORS_ORIGINS'),
  );
});
