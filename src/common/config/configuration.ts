export function validateEnvironment(environment: Record<string, unknown>) {
  const requiredVariables = [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'CORS_ORIGINS',
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
  if (environment.NODE_ENV === 'production') {
    const secret = environment.JWT_SECRET;
    if (
      typeof secret !== 'string' ||
      secret.length < 32 ||
      secret !== secret.trim() ||
      /^(replace|change.?me|test|integration)/i.test(secret)
    )
      throw new Error(
        'Production JWT_SECRET must be a strong externally managed secret of at least 32 characters',
      );
    const origins = String(environment.CORS_ORIGINS).split(',');
    if (
      origins.some((value) => {
        try {
          const u = new URL(value.trim());
          return (
            u.protocol !== 'https:' ||
            u.origin !== value.trim() ||
            !!u.username ||
            !!u.password
          );
        } catch {
          return true;
        }
      })
    )
      throw new Error(
        'Production CORS_ORIGINS must contain explicit HTTPS origins',
      );
  }
  return { ...environment, PORT: port };
}
