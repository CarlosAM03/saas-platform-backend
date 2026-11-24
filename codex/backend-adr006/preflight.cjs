'use strict';
// Explicit target, no dotenv loading; preflight is read-only unless --apply is given.
const { PrismaClient } = require('@prisma/client');
const { execFileSync } = require('node:child_process');
const { readFileSync, readdirSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const args = process.argv.slice(2);
const option = (key) => {
  const index = args.indexOf(key);
  return index < 0 ? undefined : args[index + 1];
};
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error('Explicit DATABASE_URL required');
  const url = new URL(process.env.DATABASE_URL);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== option('--expected-host') ||
    database !== option('--expected-db')
  )
    throw new Error('Target confirmation mismatch');
  const production = args.includes('--production');
  if (production) {
    if (
      url.searchParams.get('sslmode') !== 'require' ||
      url.searchParams.get('pgbouncer') === 'true' ||
      url.port === '6543'
    )
      throw new Error(
        'Production migration requires confirmed direct TLS connection, not a transaction pooler',
      );
    if (
      process.env.DATABASE_ENV !== 'production' ||
      option('--owner-go') !== 'ADR006_OWNER_GO' ||
      !option('--verified-backup-id') ||
      !args.includes('--ack-restore-tested')
    )
      throw new Error(
        'Owner GO, verified backup/restore and segregated production environment required',
      );
  } else if (
    !['localhost', '127.0.0.1', '[::1]', 'g1-pg', 'prospector-g1-pg'].includes(
      url.hostname,
    ) ||
    !['test', 'local'].includes(process.env.DATABASE_ENV) ||
    !/^g1_[a-z0-9_]+$/.test(database)
  )
    throw new Error('Local laboratory target required');
  const db = new PrismaClient({ datasources: { db: { url: url.href } } });
  const report = {
    timestamp: new Date().toISOString(),
    host: url.hostname,
    database,
    production,
    mode: args.includes('--apply') ? 'apply' : 'read-only',
  };
  try {
    await db.$connect();
    const identity = await db.$queryRawUnsafe(
      "SELECT current_database() AS database, current_setting('server_version_num')::int AS version",
    );
    if (identity[0].database !== database)
      throw new Error('Connected database mismatch');
    report.postgresMajor = Math.floor(identity[0].version / 10000);
    if (!production && report.postgresMajor !== 16)
      throw new Error('Local rehearsal requires PostgreSQL 16');
    const directories = readdirSync('Prisma/migrations')
      .filter((n) => /^\d+_/.test(n))
      .sort();
    const audit = readFileSync('Prisma/audit-email.sql', 'utf8').replace(
      /;\s*$/,
      '',
    );
    const pre = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const collisions = await tx.$queryRawUnsafe(audit);
      const roles = await tx.$queryRawUnsafe(
        "SELECT ut.tenant_id FROM user_tenants ut JOIN roles r ON r.id=ut.role_id WHERE r.name='OWNER' GROUP BY ut.tenant_id HAVING count(*)>1",
      );
      const mismatches = await tx.$queryRawUnsafe(
        'SELECT count(*)::int AS count FROM user_tenants ut JOIN roles r ON r.id=ut.role_id WHERE ut.tenant_id<>r.tenant_id',
      );
      const migrations = await tx.$queryRawUnsafe(
        'SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY started_at',
      );
      return {
        collisions: collisions.length,
        multipleOwnerTenants: roles.length,
        roleTenantMismatches: mismatches[0].count,
        migrations,
      };
    });
    report.preflight = {
      emailCollisionGroups: pre.collisions,
      multipleOwnerTenants: pre.multipleOwnerTenants,
      roleTenantMismatches: pre.roleTenantMismatches,
    };
    if (pre.collisions || pre.multipleOwnerTenants || pre.roleTenantMismatches)
      throw new Error(
        'Preflight integrity conflict; stop for explicit resolution',
      );
    for (const m of pre.migrations) {
      if (m.rolled_back_at) continue;
      if (!m.finished_at || !directories.includes(m.migration_name))
        throw new Error('Unfinished or unexpected migration; stop');
      const checksum = createHash('sha256')
        .update(
          readFileSync(
            resolve('Prisma/migrations', m.migration_name, 'migration.sql'),
          ),
        )
        .digest('hex');
      if (checksum !== m.checksum)
        throw new Error('Applied migration checksum mismatch; stop');
    }
    report.appliedBefore = pre.migrations
      .filter((m) => m.finished_at && !m.rolled_back_at)
      .map((m) => m.migration_name);
    if (args.includes('--apply')) {
      const started = Date.now();
      execFileSync(
        process.execPath,
        [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
        {
          stdio: 'pipe',
          timeout: 120000,
          env: { ...process.env, DATABASE_URL: url.href },
        },
      );
      report.migrationMilliseconds = Date.now() - started;
      const rows = await db.$queryRawUnsafe(
        'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
      );
      report.appliedAfter = rows.map((m) => m.migration_name);
      if (JSON.stringify(report.appliedAfter) !== JSON.stringify(directories))
        throw new Error('Post-migration history mismatch');
      const pending = await db.user.count({
        where: { mustChangePassword: true },
      });
      report.pendingAccounts = pending;
      const indexes = await db.$queryRawUnsafe(
        "SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND indexname='users_email_case_insensitive_key'",
      );
      if (indexes.length !== 1)
        throw new Error('Canonical email index missing');
      const tables = await db.$queryRawUnsafe(
        "SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name IN ('tenant_onboardings','activation_links','first_access_challenges','delivery_attempts','activation_rate_limits')",
      );
      const triggers = await db.$queryRawUnsafe(
        "SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema=current_schema() AND trigger_name='users_normalize_email'",
      );
      const flags = await db.$queryRawUnsafe(
        "SELECT is_nullable,column_default FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='users' AND column_name='must_change_password'",
      );
      if (
        tables.length !== 5 ||
        triggers.length !== 2 ||
        flags[0]?.is_nullable !== 'NO' ||
        flags[0]?.column_default !== 'false'
      )
        throw new Error('Expanded schema/trigger/default verification failed');
      const constraints = await db.$queryRawUnsafe(
        "SELECT contype,count(*)::int AS count FROM pg_constraint WHERE conrelid IN ('tenant_onboardings'::regclass,'activation_links'::regclass,'first_access_challenges'::regclass,'delivery_attempts'::regclass,'activation_rate_limits'::regclass) GROUP BY contype ORDER BY contype",
      );
      report.schema = {
        tables: tables.length,
        emailTriggerEvents: triggers.length,
        canonicalEmailIndex: true,
        legacyFlagDefault: false,
        constraints,
      };
      report.postflight = 'PASS';
    }
    report.result = 'PASS';
    console.log(JSON.stringify(report));
    return report;
  } catch (error) {
    report.result = 'FAIL';
    // Emit only controlled messages; never raw Prisma/CLI/provider diagnostics.
    report.reason =
      error?.constructor === Error && !error.message.includes('Command failed')
        ? error.message
        : 'Database/migration operation failed; inspect privately sanitized diagnostics';
    console.log(JSON.stringify(report));
    throw new Error('ADR006 preflight/migration stopped');
  } finally {
    await db.$disconnect();
  }
}
if (require.main === module)
  main().catch(() => {
    process.exitCode = 1;
  });
module.exports = { main };
