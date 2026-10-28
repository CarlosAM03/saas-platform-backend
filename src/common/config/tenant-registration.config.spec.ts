import { validateRegistrationConfig } from './tenant-registration.config';
import { validateEnvironment } from './configuration';

describe('ADR006 configuration', () => {
  const valid = {
    TENANT_REGISTRATION_ENABLED: 'true',
    NODE_ENV: 'production',
    PLATFORM_ACTIVATION_URL: 'https://frontend.example/#/activate',
    SMTP_HOST: 'smtp.example',
    SMTP_PORT: '587',
    SMTP_USER: 'user',
    SMTP_PASSWORD: 'not-real',
    SMTP_FROM: 'sender@example.com',
    SMTP_TLS_MODE: 'starttls',
  };
  it('is off without SMTP by default', () => {
    expect(validateRegistrationConfig({})).toEqual({
      TENANT_REGISTRATION_ENABLED: false,
    });
  });
  it('requires all SMTP configuration only when enabled', () => {
    expect(validateRegistrationConfig(valid)).toEqual({
      TENANT_REGISTRATION_ENABLED: true,
    });
    expect(() =>
      validateRegistrationConfig({ TENANT_REGISTRATION_ENABLED: 'true' }),
    ).toThrow();
  });
  const runtime = {
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'postgresql://example.invalid/local',
    JWT_SECRET: 'unit-test-secret',
    JWT_EXPIRES_IN: '8h',
    CORS_ORIGINS: 'http://localhost:4200',
  };
  it('validates normal startup with the flag explicitly false and no SMTP', () => {
    expect(
      validateEnvironment({ ...runtime, TENANT_REGISTRATION_ENABLED: 'false' })
        .TENANT_REGISTRATION_ENABLED,
    ).toBe(false);
  });
  it.each([
    'PLATFORM_ACTIVATION_URL',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
    'SMTP_TLS_MODE',
  ])('blocks enabled startup when %s is empty or missing', (key) => {
    for (const value of ['', undefined]) {
      expect(() =>
        validateEnvironment({
          ...runtime,
          ...valid,
          NODE_ENV: 'development',
          [key]: value,
        }),
      ).toThrow(key);
    }
  });
  it('accepts the local frontend with SMTP 587/STARTTLS when enabled', () => {
    expect(
      validateEnvironment({
        ...runtime,
        ...valid,
        NODE_ENV: 'development',
        PLATFORM_ACTIVATION_URL: 'http://localhost:4200/#/activate',
      }).TENANT_REGISTRATION_ENABLED,
    ).toBe(true);
  });
  it.each([
    { PLATFORM_ACTIVATION_URL: 'http://frontend.example/#/activate' },
    { PLATFORM_ACTIVATION_URL: 'https://frontend.example/?code=secret' },
    { SMTP_TLS_MODE: 'none' },
    { SMTP_PORT: '0' },
    { SMTP_FROM: 'bad' },
  ])('fails closed for unsafe config %j', (changes) => {
    expect(() =>
      validateRegistrationConfig({ ...valid, ...changes }),
    ).toThrow();
  });
});
