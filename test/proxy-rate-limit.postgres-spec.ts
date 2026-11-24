import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { request as nodeRequest } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureTrustedProxy } from '../src/common/config/trusted-proxy';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

describe('BR04 proxy boundary and persistent PostgreSQL limits', () => {
  let app: NestExpressApplication, db: PrismaService, port: number;
  const seed = randomBytes(4);
  const client = '192.0.2.' + ((seed[0] % 200) + 1),
    other = '198.51.100.' + ((seed[1] % 200) + 1);
  const credential = randomBytes(32).toString('base64url');
  const digest = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  const start = async (trust: string | undefined) => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureTrustedProxy(app, trust);
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(app.get(GlobalExceptionFilter));
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as { port: number }).port;
    db = app.get(PrismaService);
  };
  const send = (
    forwarded: string,
    token = credential,
    localAddress = '127.0.0.1',
  ) =>
    new Promise<number>((resolve, reject) => {
      const body = JSON.stringify({ activationToken: token });
      const req = nodeRequest(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/v1/auth/redeem-first-access',
          method: 'POST',
          localAddress,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-Forwarded-For': forwarded,
          },
        },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode!));
        },
      );
      req.on('error', reject);
      req.end(body);
    });
  afterAll(async () => {
    const keys = [client, other, '127.0.0.2', '127.0.0.1'].map(
      (ip) => 'redeem:ip:' + digest(ip),
    );
    keys.push('redeem:credential:' + digest(credential));
    await db.activationRateLimit.deleteMany({ where: { key: { in: keys } } });
    await app?.close();
  });
  it('separates clients, ignores spoofed prefixes, returns 429 and survives app restart', async () => {
    await start('127.0.0.1/32');
    for (let i = 0; i < 5; i++)
      expect(await send('203.0.113.' + i + ', ' + client)).toBe(401);
    expect(await send('10.0.0.9, ' + client)).toBe(429);
    // New IP and credential receive their own allowance.
    expect(await send(other, randomBytes(32).toString('base64url'))).toBe(401);
    expect(
      (
        await db.activationRateLimit.findUniqueOrThrow({
          where: { key: 'redeem:ip:' + digest(client) },
        })
      ).count,
    ).toBe(6);
    await app.close();
    await start('127.0.0.1/32');
    expect(await send(client)).toBe(429);
  });
  it('an untrusted direct peer cannot choose client identity through XFF', async () => {
    for (let i = 0; i < 5; i++)
      expect(
        await send(
          '203.0.113.' + i,
          randomBytes(32).toString('base64url'),
          '127.0.0.2',
        ),
      ).toBe(401);
    expect(
      await send(
        '198.51.100.1',
        randomBytes(32).toString('base64url'),
        '127.0.0.2',
      ),
    ).toBe(429);
    expect(
      (
        await db.activationRateLimit.findUniqueOrThrow({
          where: { key: 'redeem:ip:' + digest('127.0.0.2') },
        })
      ).count,
    ).toBe(6);
  });
});
