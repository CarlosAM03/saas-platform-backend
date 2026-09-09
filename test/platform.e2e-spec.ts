import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContextService } from '../src/common/context/tenant-context.service';
import { createFakePrisma } from './support/fake-prisma';
import { TestTenantContextService } from './support/test-tenant-context';

describe('Platform authentication and tenant isolation (e2e)', () => {
  let app: INestApplication;

  async function createApp(): Promise<void> {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '8h';
    process.env.PROSPECTOR_API_KEY = 'test-key';
    process.env.CORS_ORIGINS = 'http://localhost:4200';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(await createFakePrisma())
      .overrideProvider(TenantContextService)
      .useValue(new TestTenantContextService())
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

    expect(response.status).toBe(201);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.currentTenantId).toBe('tenant-a');
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

    expect(response.status).toBe(201);
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
      .delete(`/api/v1/users/${target.id}`)
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
});
