import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateRegistrationConfig } from '../common/config/tenant-registration.config';
export type DeliveryResult = 'ACCEPTED' | 'FAILED' | 'UNKNOWN';
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
@Injectable()
export class WelcomeMailService {
  constructor(private readonly config: ConfigService) {}
  async send(
    email: string,
    name: string,
    tenant: string,
    token: string,
  ): Promise<DeliveryResult> {
    try {
      validateRegistrationConfig({
        TENANT_REGISTRATION_ENABLED: true,
        NODE_ENV: this.config.get('NODE_ENV'),
        PLATFORM_ACTIVATION_URL: this.config.get('PLATFORM_ACTIVATION_URL'),
        BREVO_API_KEY: this.config.get('BREVO_API_KEY'),
        BREVO_FROM_EMAIL: this.config.get('BREVO_FROM_EMAIL'),
      });
    } catch {
      return 'FAILED';
    }
    const url = new URL(
      this.config.getOrThrow<string>('PLATFORM_ACTIVATION_URL'),
    );
    url.hash = '/activate?code=' + encodeURIComponent(token);
    const text =
      'Hola ' +
      name +
      ',\nBienvenido a ' +
      tenant +
      '.\nTu correo de acceso: ' +
      email +
      '\nActiva tu cuenta y elige tu contraseña: ' +
      url.href +
      '\nEl enlace vence en 24 horas y solo puede utilizarse una vez. Si necesitas otro, contacta al administrador.';
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const sent = fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'api-key': this.config.getOrThrow<string>('BREVO_API_KEY'),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: this.config.getOrThrow<string>('BREVO_FROM_EMAIL') },
          to: [{ email }],
          subject: 'Bienvenido: activa tu cuenta',
          textContent: text,
          htmlContent:
            '<p>' +
            escape(text).replace(/\n/g, '<br>') +
            '</p><p><a href="' +
            escape(url.href) +
            '">Activar cuenta</a></p>',
        }),
      }).then(async (response): Promise<DeliveryResult> => {
        if (response.status >= 400 && response.status < 500) {
          await response.body?.cancel();
          return 'FAILED';
        }
        if (response.status !== 201) {
          await response.body?.cancel();
          return 'UNKNOWN';
        }
        const body: unknown = await response.json();
        return typeof body === 'object' &&
          body !== null &&
          'messageId' in body &&
          typeof body.messageId === 'string' &&
          body.messageId.length > 0
          ? 'ACCEPTED'
          : 'UNKNOWN';
      });
      return await Promise.race([
        sent,
        new Promise<'UNKNOWN'>((resolve) => {
          timer = setTimeout(() => {
            controller.abort();
            resolve('UNKNOWN');
          }, 15000);
        }),
      ]);
    } catch {
      // Provider bodies/errors may contain credentials, links or recipients.
      // An interrupted request has an uncertain delivery outcome; never retry.
      return 'UNKNOWN';
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
    }
  }
}
