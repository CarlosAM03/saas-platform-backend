import '../setup-postgres-env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hash } from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { deploymentDocument } from '../../src/common/openapi/deployment-document';
import { policyFixture } from '../support/prospector-policy.fixture';
import { startControlledService } from '../support/service-process';

// Test-only loopback stack. Requires the explicitly supplied disposable database.
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = app.get(ConfigService);
  for (const [key, value] of Object.entries(policyFixture))
    config.set(key, value);
  app.use(
    '/api/v1/internal/prospecting-jobs',
    json({ limit: 1048576 + 16384 }),
  );
  app.use(json());
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
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();
  config.set('PROSPECTOR_CALLBACK_ORIGIN', origin);
  const service = await startControlledService(
    origin,
    policyFixture.PROSPECTOR_SERVICE_API_KEY,
    policyFixture.PROSPECTOR_CALLBACK_API_KEY,
  );
  config.set('PROSPECTOR_SERVICE_URL', service.origin);
  const prisma = app.get(PrismaService);
  const email = randomUUID() + '@test.example';
  const password = 'IsolatedMvpTest123!';
  const user = await prisma.user.create({
    data: {
      email,
      name: 'MVP Flutter fixture',
      passwordHash: await hash(password, 4),
    },
  });
  const tenants = await Promise.all(
    ['A', 'B'].map((name) =>
      prisma.tenant.create({
        data: { name: 'MVP ' + name, slug: 'mvp-' + randomUUID() },
      }),
    ),
  );
  const tenantIds = tenants.map((t) => t.id);
  for (const tenant of tenants) {
    const role = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'OWNER' },
    });
    await prisma.userTenant.create({
      data: { tenantId: tenant.id, userId: user.id, roleId: role.id },
    });
  }
  const campaign = await prisma.campaign.create({
    data: {
      name: 'MVP Flutter campaign',
      tenantId: tenants[0].id,
      createdBy: user.id,
    },
  });
  mkdirSync('.tmp', { recursive: true });
  const stopFile = resolve('.tmp/mvp-stack-' + randomUUID() + '.stop');
  writeFileSync(
    '.tmp/mvp-stack.json',
    JSON.stringify(
      {
        apiBaseUrl: origin,
        stopFile,
        email,
        password,
        tenantId: tenants[0].id,
        otherTenantId: tenants[1].id,
        campaignId: campaign.id,
      },
      null,
      2,
    ),
  );
  process.stdout.write('MVP_STACK_READY\n');
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    clearInterval(control);
    await service.stop();
    await prisma.prospectingJob.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await prisma.campaignProspect.deleteMany({
      where: { campaign: { tenantId: { in: tenantIds } } },
    });
    await prisma.prospect.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await prisma.campaign.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await prisma.userTenant.deleteMany({ where: { userId: user.id } });
    await prisma.role.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.user.delete({ where: { id: user.id } });
    await app.close();
    await prisma.$disconnect();
    process.exitCode = 0;
    process.stdin.pause();
  };
  const control = setInterval(() => {
    if (existsSync(stopFile)) void stop();
  }, 100);
  process.stdin.on('data', (chunk: Buffer) => {
    if (chunk.toString().trim() === 'stop') void stop();
  });
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}
void main().catch(() => {
  process.stderr.write(
    'Isolated MVP stack failed; no production endpoint is used.\n',
  );
  process.exitCode = 1;
});
