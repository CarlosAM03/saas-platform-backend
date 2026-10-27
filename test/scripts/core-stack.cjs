// Disposable acceptance stack: compiled production entrypoint, no Service process or credentials.
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcrypt');
const { randomUUID, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const url = process.env.INTEGRATION_TEST_DATABASE_URL;
  const parsed = new URL(url || 'http://invalid');
  if (
    !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
    !parsed.pathname.endsWith('_test')
  )
    throw new Error(
      'Explicit loopback disposable database ending in _test required',
    );
  const root = path.resolve('.');
  const runtime = path.join(root, '.tmp', 'core-' + randomUUID());
  fs.mkdirSync(path.join(runtime, 'Docs', 'Contracts'), { recursive: true });
  fs.copyFileSync(
    path.join(root, 'Docs/Contracts/platform-api.v1.yaml'),
    path.join(runtime, 'Docs/Contracts/platform-api.v1.yaml'),
  );
  const egressFile = path.join(runtime, 'egress.json');
  const preload = path.join(runtime, 'no-http.cjs');
  fs.writeFileSync(
    preload,
    `let calls=0;global.fetch=async()=>{require('node:fs').writeFileSync(${JSON.stringify(egressFile)},JSON.stringify({calls:++calls}));throw Error('No HTTP dependency permitted in core acceptance')};`,
  );
  fs.writeFileSync(egressFile, '{"calls":0}');
  const db = new PrismaClient({ datasources: { db: { url } } });
  const password = randomBytes(24).toString('base64url');
  const user = await db.user.create({
    data: {
      name: 'Core isolated fixture',
      email: randomUUID() + '@test.example',
      passwordHash: await hash(password, 4),
    },
  });
  const tenants = [];
  for (const label of ['A', 'B']) {
    const tenant = await db.tenant.create({
      data: { name: 'Core fixture ' + label, slug: 'core-' + randomUUID() },
    });
    tenants.push(tenant);
    const role = await db.role.create({
      data: { tenantId: tenant.id, name: 'OWNER' },
    });
    await db.role.create({ data: { tenantId: tenant.id, name: 'MEMBER' } });
    await db.userTenant.create({
      data: { tenantId: tenant.id, userId: user.id, roleId: role.id },
    });
  }
  const campaign = await db.campaign.create({
    data: { tenantId: tenants[0].id, createdBy: user.id, name: 'Core CSV 600' },
  });
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (key.startsWith('PROSPECTOR_')) delete env[key];
  Object.assign(env, {
    NODE_ENV: 'production',
    DATABASE_URL: url,
    PORT: String(port),
    JWT_SECRET: randomBytes(48).toString('base64url'),
    JWT_EXPIRES_IN: '8h',
    CORS_ORIGINS: 'https://core.example.invalid',
    PROSPECTOR_ENABLED: 'false',
  });
  const log = fs.openSync(path.join(runtime, 'backend.log'), 'w');
  const child = spawn(
    process.execPath,
    ['--require', preload, path.join(root, 'dist/src/main.js')],
    { cwd: runtime, env, windowsHide: true, stdio: ['ignore', log, log] },
  );
  fs.closeSync(log);
  const origin = 'http://127.0.0.1:' + port;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + '/api/v1/health/ready')).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const stopFile = path.join(runtime, 'stop');
  const manifest = { csvPath: path.join(root, "Docs/examples/prospects-demo-600.csv"),
    apiBaseUrl: origin,
    email: user.email,
    password,
    tenantId: tenants[0].id,
    otherTenantId: tenants[1].id,
    campaignId: campaign.id,
    stopFile,
    egressFile,
    productionEntrypoint: true,
    serviceCredentials: false,
  };
  fs.writeFileSync(
    path.join(root, '.tmp/core-stack.json'),
    JSON.stringify(manifest, null, 2),
  );
  let closing = false;
  async function stop() {
    if (closing) return;
    closing = true;
    clearInterval(control);
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
    }
    const ids = tenants.map((t) => t.id);
    const extraUsers = await db.user.findMany({
      where: { userTenants: { some: { tenantId: { in: ids } } } },
      select: { id: true },
    });
    await db.prospectingJob.deleteMany({ where: { tenantId: { in: ids } } });
    await db.campaignProspect.deleteMany({
      where: { campaign: { tenantId: { in: ids } } },
    });
    await db.prospect.deleteMany({ where: { tenantId: { in: ids } } });
    await db.campaign.deleteMany({ where: { tenantId: { in: ids } } });
    await db.userTenant.deleteMany({ where: { tenantId: { in: ids } } });
    await db.role.deleteMany({ where: { tenantId: { in: ids } } });
    await db.tenant.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({
      where: { id: { in: extraUsers.map((u) => u.id) } },
    });
    await db.$disconnect();
    process.stdout.write('CORE_STACK_STOPPED\n');
  }
  const control = setInterval(() => {
    if (fs.existsSync(stopFile)) void stop();
  }, 100);
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
  if (!ready) {
    await stop();
    throw Error(
      'Compiled production entrypoint failed; inspect ignored runtime log',
    );
  }
  process.stdout.write('CORE_STACK_READY\n');
}
main().catch((error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});
