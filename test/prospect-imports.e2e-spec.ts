import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { createFakePrisma } from './support/fake-prisma';

describe('Prospect imports HTTP', () => {
  let app: INestApplication;
  let owner: string;
  let member: string;
  let admin: string;
  let globalAdmin: string;
  let create: jest.Mock;
  const file = Buffer.from('name,email\nAlice,alice@example.com');
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);
  beforeEach(async () => {
    const fake = await createFakePrisma();
    create = jest.fn().mockResolvedValue({ id: 'new-prospect' });
    const client = Object.assign(fake, {
      campaign: {
        findFirst: ({ where }: { where: { tenantId: string; id: string } }) =>
          Promise.resolve(
            where.tenantId === 'tenant-a' && where.id === 'campaign-a'
              ? { id: 'campaign-a' }
              : null,
          ),
      },
      prospect: { findMany: jest.fn().mockResolvedValue([]), create },
      campaignProspect: { upsert: jest.fn().mockResolvedValue({}) },
    });
    Object.assign(client, {
      $transaction: (fn: (tx: typeof client) => unknown) => fn(client),
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(client)
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
    await app.init();
    const jwt = app.get(JwtService);
    owner = jwt.sign({
      email: 'test@example.com',
      sub: 'user-owner',
      tenantId: 'tenant-a',
      tenantRole: 'OWNER',
      platformRole: null,
    });
    member = jwt.sign({
      email: 'test@example.com',
      sub: 'user-member',
      tenantId: 'tenant-a',
      tenantRole: 'MEMBER',
      platformRole: null,
    });
    admin = jwt.sign({
      email: 'test@example.com',
      sub: 'user-admin',
      tenantId: 'tenant-a',
      tenantRole: null,
      platformRole: 'ADMIN',
    });
    globalAdmin = jwt.sign({
      email: 'test@example.com',
      sub: 'user-admin',
      tenantId: null,
      tenantRole: null,
      platformRole: 'ADMIN',
    });
  });
  afterEach(async () => {
    await app.close();
  });

  it('requires authentication and denies MEMBER on both routes', async () => {
    for (const route of ['preview', 'confirm']) {
      await http().post(`/api/v1/prospects/import/${route}`).expect(401);
      await http()
        .post(`/api/v1/prospects/import/${route}`)
        .set('Authorization', `Bearer ${member}`)
        .expect(403);
    }
    expect(create).not.toHaveBeenCalled();
  });
  it('allows OWNER/ADMIN previews without writes and requires tenant', async () => {
    for (const token of [owner, admin]) {
      await http()
        .post('/api/v1/prospects/import/preview')
        .set('Authorization', `Bearer ${token}`)
        .field('campaignId', 'campaign-a')
        .attach('file', file, 'contacts.csv')
        .expect(200);
    }
    await http()
      .post('/api/v1/prospects/import/preview')
      .set('Authorization', `Bearer ${globalAdmin}`)
      .field('campaignId', 'campaign-a')
      .attach('file', file, 'contacts.csv')
      .expect(403);
    expect(create).not.toHaveBeenCalled();
  });
  it('confirms multipart reference and rejects another campaign', async () => {
    const preview = await http()
      .post('/api/v1/prospects/import/preview')
      .set('Authorization', `Bearer ${owner}`)
      .field('campaignId', 'campaign-a')
      .attach('file', file, 'contacts.csv')
      .expect(200);
    const body = preview.body as { data: { previewReference: string } };
    await http()
      .post('/api/v1/prospects/import/confirm')
      .set('Authorization', `Bearer ${owner}`)
      .field('campaignId', 'campaign-a')
      .field('previewReference', body.data.previewReference)
      .field('decisions', '[{"record":1,"action":"CREATE"}]')
      .attach('file', file, 'contacts.csv')
      .expect(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-a',
          source: 'csv',
          sourceIdentifier: null,
        }) as unknown,
      }),
    );
    await http()
      .post('/api/v1/prospects/import/preview')
      .set('Authorization', `Bearer ${owner}`)
      .field('campaignId', 'campaign-other-tenant')
      .attach('file', file, 'contacts.csv')
      .expect(404);
  });
  it('rejects unknown fields, Excel and missing files', async () => {
    await http()
      .post('/api/v1/prospects/import/preview')
      .set('Authorization', `Bearer ${owner}`)
      .field('tenantId', 'other')
      .attach('file', file, 'contacts.csv')
      .expect(400);
    await http()
      .post('/api/v1/prospects/import/preview')
      .set('Authorization', `Bearer ${owner}`)
      .field('campaignId', 'campaign-a')
      .attach('file', file, 'contacts.xlsx')
      .expect(400);
    await http()
      .post('/api/v1/prospects/import/preview')
      .set('Authorization', `Bearer ${owner}`)
      .field('campaignId', 'campaign-a')
      .expect(400);
  });
});
