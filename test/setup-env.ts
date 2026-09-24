// ConfigModule validates at import time, before any beforeEach hook runs.
// These values belong only to the isolated E2E suite (Prisma is replaced).
Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'test-secret',
  JWT_EXPIRES_IN: '8h',
  PROSPECTOR_SERVICE_URL: 'http://localhost:8000',
  PROSPECTOR_API_KEY: 'test-key',
  CORS_ORIGINS: 'http://localhost:4200',
  ADMIN_NAME: 'Test Admin',
  ADMIN_EMAIL: 'admin@test.example',
  ADMIN_PASSWORD: 'SecurePass123!',
});
