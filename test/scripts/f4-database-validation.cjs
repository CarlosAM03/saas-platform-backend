require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const db = new PrismaClient();
async function snapshot() {
  return { users: await db.user.count(), tenants: await db.tenant.count(), roles: await db.role.count(), memberships: await db.userTenant.count() };
}
(async () => {
  const before = await snapshot();
  const original = await db.user.findUnique({ where: { email: process.env.ADMIN_EMAIL } });
  for (let i = 0; i < 2; i++) execFileSync(process.execPath, ['node_modules/ts-node/dist/bin.js', 'Prisma/seed.ts'], { stdio: 'pipe', windowsHide: true });
  const after = await snapshot();
  assert.deepEqual(after, before);
  const admin = await db.user.findUnique({ where: { email: process.env.ADMIN_EMAIL }, include: { userTenants: true } });
  assert.equal(admin.platformRole, 'ADMIN');
  assert.equal(admin.status, 'ACTIVO');
  assert.equal(admin.passwordHash, original.passwordHash);
  assert.equal(Number(admin.passwordHash.split('$')[2]), 12);
  const migrations = await db.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations`;
  assert.equal(migrations.length, 1);
  assert(migrations[0].finished_at && !migrations[0].rolled_back_at);
  const sql = readFileSync('Prisma/migrations/20260909152421_init/migration.sql');
  assert.equal(createHash('sha256').update(sql).digest('hex'), migrations[0].checksum);
  console.log(JSON.stringify({ before, after, seedRuns: 2, hashUnchanged: true, bcryptCost: 12, adminGlobal: true, adminMemberships: admin.userTenants.length, migrationChecksum: true }));
})().catch(() => { console.error('Database validation failed; inspect counts, seed invariants or migration checksum without printing credentials.'); process.exitCode = 1; }).finally(() => db.$disconnect());
