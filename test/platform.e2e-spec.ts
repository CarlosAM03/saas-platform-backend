import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import type { AuthContextResponse } from '../src/auth/dto/auth.response';
import type { UserResponse } from '../src/users/dto/user.response';

interface TestResponse {
  status: number;
  headers: Record<string, string>;
  body: {
    success: boolean;
    data: AuthContextResponse &
      UserResponse &
      UserResponse[] & { passwordHash?: string };
    error?: { code: string; message: string };
  };
}
interface TestRequest extends PromiseLike<TestResponse> {
  get(path: string): TestRequest;
  post(path: string): TestRequest;
  patch(path: string): TestRequest;
  delete(path: string): TestRequest;
  set(name: string, value: string): TestRequest;
  send(body: unknown): TestRequest;
}
// HTTP payloads are checked by assertions; this boundary avoids propagating
// Supertest's untyped body through the test suite.
const request = supertest as unknown as (server: unknown) => TestRequest;
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createFakePrisma } from './support/fake-prisma';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { RequestIdInterceptor } from '../src/common/interceptors/request-id.interceptor';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Platform authentication and tenant isolation (e2e)', () => {
  let app: INestApplication;
  let fake: Awaited<ReturnType<typeof createFakePrisma>>;

  async function createApp(): Promise<void> {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '8h';
    process.env.PROSPECTOR_SERVICE_URL = 'http://localhost:8000';
    process.env.PROSPECTOR_API_KEY = 'test-key';
    process.env.CORS_ORIGINS = 'http://localhost:4200';
    process.env.ADMIN_NAME = 'Test Admin';
    process.env.ADMIN_EMAIL = 'admin@test.example';
    process.env.ADMIN_PASSWORD = 'SecurePass123!';

    fake = await createFakePrisma();
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(fake)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(app.get(GlobalExceptionFilter));
    app.useGlobalInterceptors(
      app.get(RequestIdInterceptor),
      app.get(LoggingInterceptor),
      app.get(ResponseInterceptor),
    );
    await app.init();
  }

  beforeEach(async () => createApp());
  afterEach(async () => app.close());

  async function login(email: string, password = 'SecurePass123!') {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
  }

  it('login exitoso devuelve token', async () => {
    const response = await login('owner@example.com');

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.currentTenantId).toBe('tenant-a');
  });

  it('mantiene el snapshot del rol hasta emitir un nuevo JWT', async () => {
    const token = (await login('owner@example.com')).body.data.accessToken;
    fake._state.userTenants.find((m) => m.userId === 'user-owner')!.roleId =
      'role-a-member';
    const oldContext = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Snapshot',
        email: 'snapshot@example.com',
        password: 'Test-password-123!',
      });
    expect(oldContext.status).toBe(201);
    const renewed = (await login('owner@example.com')).body.data.accessToken;
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/users')
          .set('Authorization', `Bearer ${renewed}`)
          .send({
            name: 'Forbidden',
            email: 'forbidden@example.com',
            password: 'Test-password-123!',
          })
      ).status,
    ).toBe(403);
  });

  it('login fallido devuelve 401', async () => {
    expect((await login('owner@example.com', 'wrong-password')).status).toBe(
      401,
    );
  });

  it('token inválido devuelve 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });

  it('usuario inactivo no puede autenticarse', async () => {
    expect((await login('inactive@example.com')).status).toBe(401);
  });

  it('select-tenant funciona para un usuario con múltiples tenants', async () => {
    const loginResponse = await login('multi@example.com');
    expect(loginResponse.body.data.currentTenantId).toBeNull();
    expect(loginResponse.body.data.tenants).toHaveLength(2);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/select-tenant')
      .set('Authorization', `Bearer ${loginResponse.body.data.accessToken}`)
      .send({ tenantId: 'tenant-b' });

    expect(response.status).toBe(200);
    expect(response.body.data.currentTenantId).toBe('tenant-b');
  });

  it('protege el CRUD de usuarios con los roles adecuados', async () => {
    const ownerToken = (await login('owner@example.com')).body.data.accessToken;
    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Created User',
        email: 'created@example.com',
        password: 'SecurePass123!',
      });

    expect(created.status).toBe(201);
    expect(created.body.data.passwordHash).toBeUndefined();
    const userId = created.body.data.id;

    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/users/${userId}`)
          .set('Authorization', `Bearer ${ownerToken}`)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/api/v1/users/${userId}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ name: 'Updated User' })
      ).status,
    ).toBe(200);
  });

  it('realiza desactivación lógica solo con ADMIN', async () => {
    const adminToken = (await login('admin@example.com')).body.data.accessToken;
    const tenantToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/select-tenant')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tenantId: 'tenant-a' })
    ).body.data.accessToken;
    const users = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${tenantToken}`);
    const target = users.body.data.find(
      (user: { id: string }) => user.id === 'user-member',
    );

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/users/${target!.id}`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(response.status).toBe(200);
    expect((await login('member@example.com')).status).toBe(401);
  });

  it('aísla usuarios entre tenants', async () => {
    const tenantAToken = (await login('owner@example.com')).body.data
      .accessToken;
    const tenantAResponse = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${tenantAToken}`);
    expect(tenantAResponse.status).toBe(200);
    expect(
      tenantAResponse.body.data.some(
        (user: { id: string }) => user.id === 'user-owner-b',
      ),
    ).toBe(false);

    const tenantBToken = (await login('owner-b@example.com')).body.data
      .accessToken;
    const crossTenant = await request(app.getHttpServer())
      .get('/api/v1/users/user-owner')
      .set('Authorization', `Bearer ${tenantBToken}`);
    expect(crossTenant.status).toBe(404);
  });

  it('rechaza el sexto intento de login dentro de 60 segundos', async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        login('owner@example.com', 'wrong-password'),
      ),
    );
    expect(
      responses.slice(0, 5).every((response) => response.status === 401),
    ).toBe(true);
    expect(responses[5].status).toBe(429);
  });

  it('mantiene ADMIN global, me sin renovación y logout con EmptySuccess', async () => {
    const token = (await login('admin@example.com')).body.data.accessToken;
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.currentTenantId).toBeNull();
    expect(me.body.data.accessToken).toBe(token);
    expect(me.body.data.user.platformRole).toBe('ADMIN');
    const users = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);
    expect(users.status).toBe(403);
    expect(users.headers['x-request-id']).toEqual(expect.any(String));
    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(200);
    expect(logout.body).toEqual({ success: true, data: {} });
  });

  it('aísla contextos de requests concurrentes y no filtra memberships ajenas', async () => {
    const a = (await login('owner@example.com')).body.data.accessToken;
    const b = (await login('owner-b@example.com')).body.data.accessToken;
    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        request(app.getHttpServer())
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${i % 2 ? b : a}`),
      ),
    );
    responses.forEach((response, i) => {
      expect(response.status).toBe(200);
      response.body.data.forEach((user) =>
        expect(
          user.tenants.every(
            (m) => m.tenantId === (i % 2 ? 'tenant-b' : 'tenant-a'),
          ),
        ).toBe(true),
      );
    });
    const unauthenticated = await request(app.getHttpServer()).get(
      '/api/v1/users',
    );
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('permite me antes de seleccionar tenant y rechaza selección ajena', async () => {
    const multi = (await login('multi@example.com')).body.data.accessToken;
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${multi}`)
      ).status,
    ).toBe(200);
    const owner = (await login('owner@example.com')).body.data.accessToken;
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/select-tenant')
          .set('Authorization', `Bearer ${owner}`)
          .send({ tenantId: 'tenant-b' })
      ).status,
    ).toBe(403);
  });

  it('no permite evadir el límite con X-Forwarded-For', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (
          await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .set('X-Forwarded-For', `192.0.2.${i}`)
            .send({ email: 'owner@example.com', password: 'wrong' })
        ).status,
      );
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  });
});
