import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { deploymentDocument } from '../src/common/openapi/deployment-document';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createFakePrisma } from './support/fake-prisma';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Platform without Prospector configuration or network', () => {
  let app: INestApplication<App>;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let fake: Awaited<ReturnType<typeof createFakePrisma>>;
  let token: string;
  const previousUrl = process.env.PROSPECTOR_SERVICE_URL;
  const previousKey = process.env.PROSPECTOR_API_KEY;

  beforeAll(async () => {
    // Empty values also override any optional values in the developer's .env.
    process.env.PROSPECTOR_SERVICE_URL = '';
    process.env.PROSPECTOR_API_KEY = '';
    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected network call'));
    const { AppModule } =
      jest.requireActual<typeof import('../src/app.module')>(
        '../src/app.module',
      );
    fake = await createFakePrisma();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fake)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(app.get(GlobalExceptionFilter));
    app.useGlobalInterceptors(app.get(ResponseInterceptor));
    SwaggerModule.setup('api/docs', app, deploymentDocument());
    await app.init();
    // Keep one listener open while sequential request objects share the server.
    await app.listen(0, '127.0.0.1');
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'SecurePass123!' });
    expect(login.status).toBe(200);
    token = (login.body as { data: { accessToken: string } }).data.accessToken;
  });

  afterAll(async () => {
    await app?.close();
    jest.restoreAllMocks();
    if (previousUrl === undefined) delete process.env.PROSPECTOR_SERVICE_URL;
    else process.env.PROSPECTOR_SERVICE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.PROSPECTOR_API_KEY;
    else process.env.PROSPECTOR_API_KEY = previousKey;
  });

  it('starts, authenticates and serves health, tenants and users without Python', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    for (const path of ['tenants', 'users']) {
      await request(app.getHttpServer())
        .get(`/api/v1/${path}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects job creation and cancellation before accessing job persistence', async () => {
    const before = JSON.stringify(fake._state);
    // The fake deliberately has no Job repositories: touching them fails this test.
    const created = await request(app.getHttpServer())
      .post('/api/v1/prospecting-jobs')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'offline-test')
      .send({
        campaignId: 'cm123456789012345678901234',
        query: {
          keyword: 'restaurants',
          location: 'Tijuana',
          source: 'google_maps',
          limit: 20,
        },
      })
      .expect(503);
    expect(created.body).toMatchObject({
      success: false,
      error: {
        details: { reason: 'PROSPECTOR_INTEGRATION_PENDING' },
      },
    });
    await request(app.getHttpServer())
      .post('/api/v1/prospecting-jobs/job/cancel')
      .set('Authorization', `Bearer ${token}`)
      .expect(503);
    expect(JSON.stringify(fake._state)).toBe(before);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('protects disabled persistence and export without touching repositories', async () => {
    const before = JSON.stringify(fake._state);
    const calls = () => [
      request(app.getHttpServer()).post('/api/v1/prospecting-jobs/job/persist'),
      request(app.getHttpServer()).get(
        '/api/v1/prospecting-jobs/job/export?format=csv',
      ),
      request(app.getHttpServer()).get(
        '/api/v1/prospecting-jobs/job/export?format=xlsx',
      ),
    ];
    for (const call of calls()) await call.expect(401);
    for (const call of calls()) {
      const response = await call
        .set('Authorization', `Bearer ${token}`)
        .expect(503);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toBeUndefined();
      expect(response.body).toMatchObject({
        success: false,
        error: {
          details: { reason: 'PROSPECTOR_INTEGRATION_PENDING' },
        },
      });
    }
    await request(app.getHttpServer())
      .get('/api/v1/prospecting-jobs/job/export?format=pdf')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(JSON.stringify(fake._state)).toBe(before);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('publishes Swagger with unavailable integration operations and real read routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const document = response.body as OpenAPIObject;
    for (const [path, method] of [
      ['/api/v1/prospecting-jobs', 'post'],
      ['/api/v1/prospecting-jobs/{id}/cancel', 'post'],
      ['/api/v1/prospecting-jobs/{id}/persist', 'post'],
      ['/api/v1/prospecting-jobs/{id}/export', 'get'],
    ] as const) {
      const operation = document.paths[path][method]!;
      expect(operation.responses['503']).toBeDefined();
      expect(
        Object.keys(operation.responses).some((code) => code.startsWith('2')),
      ).toBe(false);
      expect(operation.security).toEqual([{ bearerAuth: [] }]);
    }
    expect(
      document.paths['/api/v1/prospecting-jobs'].get!.responses['200'],
    ).toBeDefined();
    expect(
      document.paths['/api/v1/prospecting-jobs/{id}'].get!.description,
    ).toContain('resultsAvailable=false');
    expect(
      document.paths['/api/v1/campaigns'].post!.responses['201'],
    ).toBeDefined();
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (
          key === '$ref' &&
          typeof child === 'string' &&
          child.startsWith('#/')
        ) {
          let target: unknown = document;
          for (const part of child.slice(2).split('/')) {
            target = (target as Record<string, unknown>)?.[
              part.replace(/~1/g, '/').replace(/~0/g, '~')
            ];
          }
          expect(target).toBeDefined();
        } else visit(child);
      }
    };
    visit(document);
  });

  it('rejects callbacks when the internal key is not configured', async () => {
    for (const supplied of ['', 'arbitrary-key']) {
      await request(app.getHttpServer())
        .post('/api/v1/internal/prospecting-jobs/job/events')
        .set('X-API-Key', supplied)
        .send({})
        .expect(401);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
