import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { WelcomeMailService } from './welcome-mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
describe('Welcome SMTP transport (no real messages)', () => {
  const sendMail = jest.fn();
  const close = jest.fn();
  let service: WelcomeMailService;
  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail,
      close,
    });
    service = new WelcomeMailService(
      new ConfigService({
        PLATFORM_ACTIVATION_URL: 'https://frontend.example/#/activate',
        SMTP_HOST: 'smtp.invalid',
        SMTP_PORT: '465',
        SMTP_USER: 'test',
        SMTP_PASSWORD: 'not-real',
        SMTP_FROM: 'sender@example.com',
        SMTP_TLS_MODE: 'implicit',
      }),
    );
  });
  afterEach(() => jest.useRealTimers());
  it('escapes HTML, uses configured fragment URL and includes no password', async () => {
    sendMail.mockResolvedValue({ accepted: ['owner@example.com'] });
    expect(
      await service.send(
        'owner@example.com',
        '<img src=x>',
        'Org & Co',
        'opaque',
      ),
    ).toBe('ACCEPTED');
    const calls = sendMail.mock.calls as unknown[][];
    const message = calls[0][0] as { text: string; html: string };
    expect(message.text).toContain(
      'https://frontend.example/#/activate?code=opaque',
    );
    expect(message.html).toContain('&lt;img src=x&gt;');
    expect(message.html).toContain('Org &amp; Co');
    expect(message.text).toContain('24 horas');
    expect(close).toHaveBeenCalled();
  });
  it('sanitizes transport rejection into a status', async () => {
    sendMail.mockRejectedValue({
      responseCode: 550,
      message: 'sensitive provider response',
    });
    expect(
      await service.send('owner@example.com', 'Owner', 'Org', 'opaque'),
    ).toBe('FAILED');
  });
  it('bounds total send time to 15 seconds and closes transport', async () => {
    jest.useFakeTimers();
    sendMail.mockReturnValue(new Promise(() => undefined));
    const result = service.send('owner@example.com', 'Owner', 'Org', 'opaque');
    await jest.advanceTimersByTimeAsync(15000);
    expect(await result).toBe('UNKNOWN');
    expect(close).toHaveBeenCalled();
  });
});
