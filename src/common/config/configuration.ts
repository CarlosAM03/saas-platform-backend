export function validateEnvironment(environment: Record<string, unknown>) {
  const requiredVariables = [
    'DATABASE_URL',
    'JWT_SECRET',
    'PROSPECTOR_API_KEY',
  ];
  const missingVariables = requiredVariables.filter(
    (variable) => !environment[variable],
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(', ')}`,
    );
  }

  return environment;
}
