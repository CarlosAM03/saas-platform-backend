import { ConfigService } from '@nestjs/config';
import { WelcomeMailService } from './welcome-mail.service';

describe('Brevo HTTPS transport, no network or real messages', () => {
  let service: WelcomeMailService;
  let http: jest.SpiedFunction<typeof fetch>;
  const config = {
    PLATFORM_ACTIVATION_URL: 'https://frontend.example/#/activate',
    BREVO_API_KEY: 'synthetic-not-real',
    BREVO_FROM_EMAIL: 'sender@example.com',
  };
  const send = () =>
    service.send('owner@example.com', '<img src=x>', 'Org & Co', 'opaque');
  beforeEach(() => {
    http = jest.spyOn(globalThis, 'fetch');
    service = new WelcomeMailService(new ConfigService(config));
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('sends one authenticated HTTPS request and escaped HTML with trusted fragment', async () => {
    http.mockResolvedValue(
      new Response(JSON.stringify({ messageId: 'synthetic-message' }), {
        status: 201,
      }),
    );
    expect(await send()).toBe('ACCEPTED');
    expect(http).toHaveBeenCalledTimes(1);
    const [url, options] = http.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options?.redirect).toBe('error');
    expect(options?.headers).toMatchObject({ 'api-key': config.BREVO_API_KEY });
    const body = JSON.parse(options?.body as string) as {
      htmlContent: string;
      textContent: string;
      sender: { email: string };
    };
    expect(body.htmlContent).toContain('&lt;img src=x&gt;');
    expect(body.htmlContent).toContain('Org &amp; Co');
    expect(body.textContent).toContain(
      'https://frontend.example/#/activate?code=opaque',
    );
    expect(body.textContent).toContain('24 horas');
    expect(body.sender.email).toBe(config.BREVO_FROM_EMAIL);
    expect(body).not.toHaveProperty('password');
  });
  it.each([400, 401, 403, 429])(
    'HTTP %s becomes FAILED without logging or retry',
    async (status) => {
      const log = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      http.mockResolvedValue(
        new Response('sensitive provider body', { status }),
      );
      expect(await send()).toBe('FAILED');
      expect(http).toHaveBeenCalledTimes(1);
      expect(log).not.toHaveBeenCalled();
    },
  );
  it.each([500, 502, 503, 302, 200])(
    'HTTP %s has uncertain outcome and no retry',
    async (status) => {
      http.mockResolvedValue(
        new Response('sensitive provider body', { status }),
      );
      expect(await send()).toBe('UNKNOWN');
      expect(http).toHaveBeenCalledTimes(1);
    },
  );
  it.each(['{}', 'null', '{"messageId":42}', 'not-json'])(
    'unexpected 201 body is sanitized: %s',
    async (body) => {
      http.mockResolvedValue(new Response(body, { status: 201 }));
      expect(await send()).toBe('UNKNOWN');
    },
  );
  it('sanitizes network errors containing secrets and links', async () => {
    http.mockRejectedValue(
      new Error(
        'sensitive provider response with credentials and activation link',
      ),
    );
    expect(await send()).toBe('UNKNOWN');
    expect(http).toHaveBeenCalledTimes(1);
  });
  it('bounds request plus response body to 15 seconds and aborts', async () => {
    jest.useFakeTimers();
    http.mockImplementation(() => new Promise(() => undefined));
    const pending = send();
    await jest.advanceTimersByTimeAsync(15000);
    expect(await pending).toBe('UNKNOWN');
    expect(http.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
  it.each([
    { BREVO_API_KEY: '' },
    { BREVO_FROM_EMAIL: 'bad' },
    { PLATFORM_ACTIVATION_URL: 'https://user:secret@frontend.example/' },
  ])('invalid config fails without a request', async (override) => {
    service = new WelcomeMailService(
      new ConfigService({ ...config, ...override }),
    );
    expect(await send()).toBe('FAILED');
    expect(http).not.toHaveBeenCalled();
  });
});
