import { isEmail } from 'class-validator';

export function validateRegistrationConfig(env: Record<string, unknown>) {
  const flag = env.TENANT_REGISTRATION_ENABLED ?? 'false';
  if (flag !== 'true' && flag !== 'false' && flag !== true && flag !== false) {
    throw new Error('TENANT_REGISTRATION_ENABLED must be true or false');
  }
  const enabled = flag === true || flag === 'true';
  if (!enabled) return { TENANT_REGISTRATION_ENABLED: false };
  for (const key of [
    'PLATFORM_ACTIVATION_URL',
    'BREVO_API_KEY',
    'BREVO_FROM_EMAIL',
  ]) {
    if (typeof env[key] !== 'string' || !env[key].trim())
      throw new Error(`Missing registration configuration: ${key}`);
  }
  let url: URL;
  try {
    url = new URL(String(env.PLATFORM_ACTIVATION_URL));
  } catch {
    throw new Error('Invalid PLATFORM_ACTIVATION_URL');
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    (url.hash && url.hash !== '#/activate') ||
    (env.NODE_ENV === 'production' && url.protocol !== 'https:')
  ) {
    throw new Error(
      'PLATFORM_ACTIVATION_URL must be a trusted HTTP(S) frontend URL, HTTPS in production, without credentials/query; optional #/activate',
    );
  }
  if (!isEmail(String(env.BREVO_FROM_EMAIL)))
    throw new Error('Invalid BREVO_FROM_EMAIL');
  if (
    /[\r\n]/.test(String(env.BREVO_API_KEY)) ||
    String(env.BREVO_API_KEY).trim() !== env.BREVO_API_KEY
  )
    throw new Error('Invalid BREVO_API_KEY');
  return { TENANT_REGISTRATION_ENABLED: true };
}
