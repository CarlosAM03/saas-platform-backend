'use strict';
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcrypt');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const [phase, database, base] = process.argv.slice(2);
if (!/^g1_(history_[123]|collision)$/.test(database || ''))
  throw new Error('Explicit synthetic laboratory database required');
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== 'prospector-g1-pg' || process.env.DATABASE_ENV !== 'test')
  throw new Error('Isolated G1 host required');
const manager = new PrismaClient({ datasources: { db: { url: url.href } } });
url.pathname = '/' + database;
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
const id = (n) => 'c' + String(n).padStart(24, '0');
const tables = [
  'tenants',
  'roles',
  'users',
  'user_tenants',
  'campaigns',
  'prospects',
  'campaign_prospects',
  'prospecting_jobs',
];
const snapshot = async () =>
  Object.fromEntries(
    await Promise.all(
      tables.map(async (table) => {
        const rows = await db.$queryRawUnsafe('SELECT * FROM "' + table + '"');
        // Expected normalization is explicitly part of ADR006. Hashes/IDs/relations stay exact.
        if (table === 'users')
          for (const row of rows) {
            row.email = row.email.trim().toLowerCase();
            delete row.must_change_password;
          }
        const stable = rows
          .map((row) =>
            JSON.stringify(
              Object.fromEntries(
                Object.entries(row).sort(([a], [b]) => a.localeCompare(b)),
              ),
            ),
          )
          .sort();
        return [
          table,
          {
            count: rows.length,
            sha256: createHash('sha256')
              .update(stable.join('\n'))
              .digest('hex'),
          },
        ];
      }),
    ),
  );
const cli = (schema) =>
  execFileSync(
    process.execPath,
    [
      require.resolve('prisma/build/index.js'),
      'migrate',
      'deploy',
      '--schema',
      schema,
    ],
    { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url.href } },
  );
async function init() {
  await manager.$executeRawUnsafe('CREATE DATABASE "' + database + '"');
  const root = '/tmp/g1-historical';
  fs.mkdirSync(root + '/migrations/20260909152421_init', { recursive: true });
  for (const [source, target] of [
    ['Prisma/schema.prisma', 'schema.prisma'],
    ['Prisma/migrations/migration_lock.toml', 'migrations/migration_lock.toml'],
    [
      'Prisma/migrations/20260909152421_init/migration.sql',
      'migrations/20260909152421_init/migration.sql',
    ],
  ])
    fs.copyFileSync(source, root + '/' + target);
  cli(root + '/schema.prisma');
}
async function seed() {
  const passwordHash = await hash('Synthetic-password-123!', 12);
  for (const n of [1, 2])
    await db.$executeRaw`INSERT INTO tenants(id,name,slug,updated_at) VALUES (${id(n)},${n === 1 ? 'ACME synthetic' : 'B synthetic'},${'g1-historical-' + n},NOW())`;
  for (const [n, t, name] of [
    [11, 1, 'OWNER'],
    [12, 1, 'MEMBER'],
    [21, 2, 'OWNER'],
    [22, 2, 'MEMBER'],
  ])
    await db.$executeRawUnsafe(
      'INSERT INTO roles(id,tenant_id,name,updated_at) VALUES ($1,$2,$3::"RoleName",NOW())',
      id(n),
      id(t),
      name,
    );
  for (const [n, name, admin] of [
    [101, 'admin', true],
    [102, 'owner-a', false],
    [103, 'member-a', false],
    [104, 'shared', false],
    [105, 'owner-b', false],
  ])
    await db.$executeRaw`INSERT INTO users(id,name,email,password_hash,platform_role,updated_at) VALUES (${id(n)},${name},${name + '@example.test'},${passwordHash},${admin ? 'ADMIN' : null},NOW())`;
  for (const [u, t, r] of [
    [102, 1, 11],
    [103, 1, 12],
    [104, 1, 12],
    [104, 2, 22],
    [105, 2, 21],
  ])
    await db.$executeRaw`INSERT INTO user_tenants(user_id,tenant_id,role_id) VALUES (${id(u)},${id(t)},${id(r)})`;
  for (const [t, u, c, p, j] of [
    [1, 102, 201, 301, 401],
    [2, 105, 202, 302, 402],
  ]) {
    await db.$executeRaw`INSERT INTO campaigns(id,tenant_id,created_by,name,updated_at) VALUES (${id(c)},${id(t)},${id(u)},'Historical campaign',NOW())`;
    await db.$executeRaw`INSERT INTO prospects(id,tenant_id,campaign_id,name,source,source_identifier,metadata,updated_at) VALUES (${id(p)},${id(t)},${id(c)},'Historical CSV prospect','csv',${'csv-' + p},'{"synthetic":true}'::jsonb,NOW())`;
    await db.$executeRaw`INSERT INTO campaign_prospects(campaign_id,prospect_id) VALUES (${id(c)},${id(p)})`;
    await db.$executeRaw`INSERT INTO prospecting_jobs(id,tenant_id,campaign_id,requested_by,status,query,updated_at) VALUES (${id(j)},${id(t)},${id(c)},${id(u)},'COMPLETED','{"keyword":"synthetic","location":"lab","source":"google_maps","limit":1}'::jsonb,NOW())`;
  }
  // Real transformation exercised without altering historical credentials.
  await db.$executeRaw`UPDATE users SET email='  MEMBER-A@EXAMPLE.TEST  ' WHERE id=${id(103)}`;
}
async function http(method, path, body, token, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(response.status, expected, method + ' ' + path + ' HTTP status');
  if (expected === 204) return;
  return response.json();
}
async function smoke() {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base + '/api/v1/health/ready')).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, 'Backend must become ready within local laboratory deadline');
  const login = await http('POST', '/api/v1/auth/login', {
    email: 'owner-a@example.test',
    password: 'Synthetic-password-123!',
  });
  const owner = login.data.accessToken;
  assert(owner);
  const list = await http(
    'GET',
    '/api/v1/users?page=1&limit=100',
    undefined,
    owner,
  );
  assert(
    list.data.some((u) => u.platformRole === null && u.role.name === 'MEMBER'),
  );
  assert(
    list.data.every((u) => u.tenants.length === 1 && u.role.tenantId === id(1)),
  );
  for (const route of [
    '/api/v1/auth/me',
    '/api/v1/campaigns',
    '/api/v1/prospects',
    '/api/v1/prospecting-jobs',
  ])
    await http('GET', route, undefined, owner);
  await http(
    'POST',
    '/api/v1/auth/select-tenant',
    { tenantId: id(2) },
    owner,
    403,
  );
  const adminLogin = await http('POST', '/api/v1/auth/login', {
    email: 'admin@example.test',
    password: 'Synthetic-password-123!',
  });
  const selected = await http(
    'POST',
    '/api/v1/auth/select-tenant',
    { tenantId: id(1) },
    adminLogin.data.accessToken,
  );
  const admin = selected.data.accessToken;
  // Writes and independent readback on historical identities.
  const name = 'Synthetic re-read ' + phase;
  await http('PATCH', '/api/v1/users/' + id(103), { name }, admin);
  const reader = new PrismaClient({ datasources: { db: { url: url.href } } });
  try {
    const row =
      await reader.$queryRaw`SELECT name FROM users WHERE id=${id(103)}`;
    assert.equal(row[0].name, name);
  } finally {
    await reader.$disconnect();
  }
  const multi = await http('POST', '/api/v1/auth/login', {
    email: 'shared@example.test',
    password: 'Synthetic-password-123!',
  });
  for (const t of [1, 2, 1]) {
    const chosen = await http(
      'POST',
      '/api/v1/auth/select-tenant',
      { tenantId: id(t) },
      multi.data.accessToken,
    );
    const users = await http(
      'GET',
      '/api/v1/users?page=1&limit=100',
      undefined,
      chosen.data.accessToken,
    );
    assert(users.data.every((u) => u.role.tenantId === id(t)));
  }
  const swagger = await http('GET', '/api/docs-json');
  const ops = Object.values(swagger.paths).reduce(
    (n, item) =>
      n +
      Object.keys(item).filter((k) =>
        ['get', 'post', 'patch', 'put', 'delete'].includes(k),
      ).length,
    0,
  );
  assert.equal(ops, phase === 'candidate' ? 38 : 33);
  if (phase === 'candidate') {
    const before = await db.tenant.count();
    await http(
      'POST',
      '/api/v1/tenants/register',
      {
        tenantName: 'Disabled',
        tenantSlug: 'disabled-lab',
        ownerName: 'Synthetic',
        ownerEmail: 'disabled@example.test',
      },
      admin,
      503,
    );
    assert.equal(await db.tenant.count(), before);
  }
  return {
    http: 'PASS',
    independentRead: 'PASS',
    tenantSwitch: 'PASS',
    userWireShape: 'PASS',
    swaggerOperations: ops,
  };
}
async function main() {
  const started = Date.now();
  let detail;
  if (phase === 'prepare') {
    await init();
    await seed();
    detail = await snapshot();
  } else if (phase === 'save') {
    detail = await snapshot();
    fs.writeFileSync(
      '/tmp/' + database + '-before.json',
      JSON.stringify(detail),
    );
  } else if (phase === 'check') {
    assert.deepEqual(
      await snapshot(),
      JSON.parse(fs.readFileSync('/tmp/' + database + '-before.json', 'utf8')),
    );
    detail = { historicalIntegrity: 'PASS' };
  } else if (phase === 'migrate') {
    const before = JSON.parse(
      fs.readFileSync('/tmp/' + database + '-before.json', 'utf8'),
    );
    const stdout = execFileSync(
      process.execPath,
      [
        'codex/backend-adr006/preflight.cjs',
        '--expected-host',
        url.hostname,
        '--expected-db',
        database,
        '--apply',
      ],
      { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url.href } },
    );
    detail = JSON.parse(stdout.toString().trim());
    assert.deepEqual(
      await snapshot(),
      before,
      'All historical rows and relations retained',
    );
    const invalid = await db.$queryRawUnsafe(
      'SELECT count(*)::int AS n FROM users WHERE must_change_password=true',
    );
    assert.equal(invalid[0].n, 0);
    detail.historicalIntegrity = 'PASS';
  } else if (phase === 'collision') {
    await init();
    await seed();
    await db.$executeRaw`INSERT INTO users(id,name,email,password_hash,updated_at) VALUES ('collision','Synthetic','OWNER-A@EXAMPLE.TEST','unchanged',NOW())`;
    const before = await snapshot();
    let rejected = false;
    try {
      cli(resolve('Prisma/schema.prisma'));
    } catch {
      rejected = true;
    }
    assert(rejected, 'Migration must fail on canonical collision');
    assert.deepEqual(await snapshot(), before);
    const columns = await db.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='must_change_password'",
    );
    const functions = await db.$queryRawUnsafe(
      "SELECT proname FROM pg_proc WHERE proname='canonical_user_email' AND pronamespace='public'::regnamespace",
    );
    assert.equal(columns.length, 0);
    assert.equal(functions.length, 0);
    detail = {
      migrationRejected: true,
      partialDDL: 0,
      historicalIntegrity: 'PASS',
    };
  } else if (['before', 'old-after', 'candidate'].includes(phase))
    detail = await smoke();
  else throw new Error('Unknown phase');
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      phase,
      database,
      elapsedMilliseconds: Date.now() - started,
      result: 'PASS',
      detail,
    }),
  );
}
main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        phase,
        database,
        result: 'FAIL',
        reason:
          error?.constructor === assert.AssertionError
            ? error.message
            : 'Laboratory operation failed; no raw secrets emitted',
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await manager.$disconnect();
  });
