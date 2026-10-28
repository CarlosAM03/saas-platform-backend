'use strict';
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcrypt');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const [phase, base] = process.argv.slice(2);
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== 'prospector-g1-pg' || process.env.DATABASE_ENV !== 'test')
  throw new Error('Isolated laboratory required');
const manager = new PrismaClient({ datasources: { db: { url: url.href } } });
url.pathname = '/g1_case';
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
(async () => {
  if (phase === 'prepare') {
    await manager.$executeRawUnsafe('CREATE DATABASE g1_case');
    execFileSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        '/tmp/g1-historical/schema.prisma',
      ],
      { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url.href } },
    );
    const passwordHash = await hash('Synthetic-password-123!', 12);
    await db.$executeRaw`INSERT INTO tenants(id,name,slug,updated_at) VALUES ('case-tenant','Case synthetic','case-synthetic',NOW())`;
    await db.$executeRaw`INSERT INTO roles(id,tenant_id,name,updated_at) VALUES ('case-role','case-tenant','MEMBER',NOW())`;
    await db.$executeRaw`INSERT INTO users(id,name,email,password_hash,updated_at) VALUES ('case-user','Case synthetic','LEGACY.CASE@EXAMPLE.TEST',${passwordHash},NOW())`;
    await db.$executeRaw`INSERT INTO user_tenants(user_id,tenant_id,role_id) VALUES ('case-user','case-tenant','case-role')`;
  } else {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + '/api/v1/health/ready')).status === 200) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(ready);
    const login = async (email) => {
      const r = await fetch(base + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Synthetic-password-123!' }),
      });
      await r.body?.cancel();
      return r.status;
    };
    if (phase === 'before')
      assert.equal(await login('LEGACY.CASE@EXAMPLE.TEST'), 200);
    else {
      assert.equal(await login('LEGACY.CASE@EXAMPLE.TEST'), 401);
      assert.equal(await login('legacy.case@example.test'), 200);
    }
  }
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      phase,
      result: 'PASS',
      meaning:
        phase === 'after'
          ? 'Core original requires canonical lowercase input after email normalization; rollback conditional'
          : 'Historical case-sensitive login fixture verified',
    }),
  );
})()
  .catch(() => {
    console.error('FAIL: isolated legacy login check');
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await manager.$disconnect();
  });
