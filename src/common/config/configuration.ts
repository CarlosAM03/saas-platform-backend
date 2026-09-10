export function validateEnvironment(environment: Record<string, unknown>) {
  const requiredVariables = [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'PROSPECTOR_SERVICE_URL',
    'PROSPECTOR_API_KEY',
    'CORS_ORIGINS',
    'ADMIN_NAME',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
  ];
  const missingVariables = requiredVariables.filter((variable) => {
    const value = environment[variable];
    return (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    );
  });

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(', ')}`,
    );
  }

  if (environment.JWT_EXPIRES_IN !== '8h') {
    throw new Error('JWT_EXPIRES_IN must be 8h (ADR-004)');
  }
  const port = Number(environment.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }
  return { ...environment, PORT: port };
}
