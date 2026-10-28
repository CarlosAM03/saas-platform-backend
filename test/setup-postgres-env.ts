const databaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'INTEGRATION_TEST_DATABASE_URL is required for PostgreSQL integration tests.',
  );
}
const target = new URL(databaseUrl);
if (
  !['postgres:', 'postgresql:'].includes(target.protocol) ||
  ![
    'localhost',
    '127.0.0.1',
    '[::1]',
    'test-db',
    'prospector-g1-pg',
    'g1-pg',
  ].includes(target.hostname) ||
  !/^(ci_test|saas_test|g1_test|g1_history_[123])$/.test(
    decodeURIComponent(target.pathname.slice(1)),
  )
)
  throw new Error(
    'PostgreSQL tests require an allowlisted disposable local target',
  );

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: databaseUrl,
  JWT_SECRET: 'integration-test-secret',
  JWT_EXPIRES_IN: '8h',
  CORS_ORIGINS: 'http://localhost:4200',
  PROSPECTOR_API_KEY: 'test-key',
});
