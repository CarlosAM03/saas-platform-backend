const databaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'INTEGRATION_TEST_DATABASE_URL is required for PostgreSQL integration tests.',
  );
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: databaseUrl,
  JWT_SECRET: 'integration-test-secret',
  JWT_EXPIRES_IN: '8h',
  CORS_ORIGINS: 'http://localhost:4200',
  PROSPECTOR_API_KEY: 'test-key',
});
