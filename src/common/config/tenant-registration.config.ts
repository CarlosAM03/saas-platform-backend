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
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
    'SMTP_TLS_MODE',
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
  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid SMTP_PORT');
  if (!['implicit', 'starttls'].includes(String(env.SMTP_TLS_MODE)))
    throw new Error('SMTP_TLS_MODE must be implicit or starttls');
  if (!isEmail(String(env.SMTP_FROM)) || /[\r\n]/.test(String(env.SMTP_HOST)))
    throw new Error('Invalid SMTP_FROM or SMTP_HOST');
  return { TENANT_REGISTRATION_ENABLED: true };
}
