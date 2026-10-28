import { validateRegistrationConfig } from './tenant-registration.config';
import { validateEnvironment } from './configuration';

describe('ADR006 Brevo HTTPS configuration', () => {
  const valid = {
    TENANT_REGISTRATION_ENABLED: 'true',
    NODE_ENV: 'production',
    PLATFORM_ACTIVATION_URL: 'https://frontend.example/#/activate',
    BREVO_API_KEY: 'synthetic-not-real',
    BREVO_FROM_EMAIL: 'sender@example.com',
  };
  const runtime = {
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'postgresql://example.invalid/local',
    JWT_SECRET: 'unit-test-secret',
    JWT_EXPIRES_IN: '8h',
    CORS_ORIGINS: 'http://localhost:4200',
  };
  it('is off by default without provider credentials', () => {
    expect(validateRegistrationConfig({})).toEqual({
      TENANT_REGISTRATION_ENABLED: false,
    });
  });
  it('accepts complete HTTPS config', () => {
    expect(validateRegistrationConfig(valid)).toEqual({
      TENANT_REGISTRATION_ENABLED: true,
    });
  });
  it('starts flag OFF without provider config', () => {
    expect(
      validateEnvironment({ ...runtime, TENANT_REGISTRATION_ENABLED: 'false' })
        .TENANT_REGISTRATION_ENABLED,
    ).toBe(false);
  });
  it.each(['PLATFORM_ACTIVATION_URL', 'BREVO_API_KEY', 'BREVO_FROM_EMAIL'])(
    'requires %s only when enabled',
    (key) => {
      for (const value of ['', undefined])
        expect(() =>
          validateRegistrationConfig({ ...valid, [key]: value }),
        ).toThrow(key);
    },
  );
  it('allows local frontend with HTTPS transport', () => {
    expect(
      validateRegistrationConfig({
        ...valid,
        NODE_ENV: 'development',
        PLATFORM_ACTIVATION_URL: 'http://localhost:4200/#/activate',
      }).TENANT_REGISTRATION_ENABLED,
    ).toBe(true);
  });
  it.each([
    { PLATFORM_ACTIVATION_URL: 'http://frontend.example/#/activate' },
    { PLATFORM_ACTIVATION_URL: 'https://frontend.example/?code=secret' },
    { BREVO_API_KEY: 'bad\nheader' },
    { BREVO_FROM_EMAIL: 'bad' },
    { PLATFORM_ACTIVATION_URL: 'https://user:password@frontend.example/' },
  ])('rejects unsafe config %j', (changes) => {
    expect(() =>
      validateRegistrationConfig({ ...valid, ...changes }),
    ).toThrow();
  });
});
