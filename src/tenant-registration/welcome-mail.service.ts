import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
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
    const transport = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: Number(this.config.get('SMTP_PORT')),
      secure: this.config.get('SMTP_TLS_MODE') === 'implicit',
      requireTLS: this.config.get('SMTP_TLS_MODE') === 'starttls',
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_PASSWORD'),
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      logger: false,
      debug: false,
      tls: { rejectUnauthorized: true },
    });
    const close = () => {
      try {
        transport.close();
      } catch {
        /* Never surface provider errors. */
      }
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const sent = transport
        .sendMail({
          from: this.config.getOrThrow<string>('SMTP_FROM'),
          to: email,
          subject: 'Bienvenido: activa tu cuenta',
          text,
          html:
            '<p>' +
            escape(text).replace(/\n/g, '<br>') +
            '</p><p><a href="' +
            escape(url.href) +
            '">Activar cuenta</a></p>',
          disableFileAccess: true,
          disableUrlAccess: true,
        })
        .then((r) =>
          r.accepted.length ? ('ACCEPTED' as const) : ('FAILED' as const),
        );
      return await Promise.race([
        sent,
        new Promise<'UNKNOWN'>((resolve) => {
          timer = setTimeout(() => {
            close();
            resolve('UNKNOWN');
          }, 15000);
        }),
      ]);
    } catch (error: unknown) {
      // Never log SMTP errors: provider errors can contain recipient, credentials or message.
      const code =
        typeof error === 'object' && error !== null && 'responseCode' in error
          ? error.responseCode
          : undefined;
      return typeof code === 'number' && code >= 400 ? 'FAILED' : 'UNKNOWN';
    } finally {
      if (timer) clearTimeout(timer);
      close();
    }
  }
}
