// Ejecutar por stdin dentro de un runtime conectado solo al PG16 desechable.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { cpSync, mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { PrismaClient } = require('@prisma/client');

const target = new URL(process.env.DATABASE_URL ?? 'http://invalid');
assert.equal(target.protocol, 'postgresql:');
assert.equal(target.hostname, 'test-db');
assert.equal(target.pathname, '/saas_test');
assert.equal(process.env.DATABASE_ENV, 'test');

const legacyMigrations = ['20260909152421_init', '20261027000100_tenant_registration'];
const sprint = '20261122000100_campaign_participation_sprint';
const forwardFix = '20261123000100_campaign_participation_history_forward_fix';
const original = resolve('Prisma');
const staged = mkdtempSync(join(tmpdir(), 'cp11-migrations-'));
cpSync(join(original, 'schema.prisma'), join(staged, 'schema.prisma'));
cpSync(join(original, 'migrations', 'migration_lock.toml'), join(staged, 'migrations', 'migration_lock.toml'));

function include(...migrations) {
  for (const name of migrations) {
    cpSync(join(original, 'migrations', name), join(staged, 'migrations', name), { recursive: true });
  }
}

function run(databaseUrl, expectedStatus = 0, action = 'deploy') {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', action, '--schema', join(staged, 'schema.prisma')], {
    encoding: 'utf8', env: { ...process.env, DATABASE_URL: databaseUrl.href }, timeout: 30_000,
  });
  assert.equal(result.status, expectedStatus, `migrate ${action} (${databaseUrl.searchParams.get('schema')})`);
  return result;
}

function client(schema) {
  const url = new URL(target);
  url.searchParams.set('schema', schema);
  return { url, db: new PrismaClient({ datasources: { db: { url: url.href } } }) };
}

async function main() {
  const legacy = client('cpclose_adr');
  const interrupted = client('cpclose_interrupt');
  try {
    include(...legacyMigrations);
    run(legacy.url);
    run(interrupted.url);
    const sql = (statement) => legacy.db.$executeRawUnsafe(statement);
    await sql(`INSERT INTO tenants (id,name,slug,updated_at) VALUES
      ('north','Synthetic North','synthetic-north',now()),('south','Synthetic South','synthetic-south',now())`);
    await sql(`INSERT INTO users (id,name,email,password_hash,updated_at) VALUES
      ('actor','Synthetic Actor','actor@synthetic.test','unused',now())`);
    await sql(`INSERT INTO campaigns (id,tenant_id,created_by,name,updated_at) VALUES
      ('north-a','north','actor','Synthetic A',now()),('north-b','north','actor','Synthetic B',now()),
      ('south-a','south','actor','Synthetic C',now())`);
    await sql(`INSERT INTO prospects (id,tenant_id,campaign_id,name,source,source_identifier,created_at,updated_at) VALUES
      ('master-a','north','north-a','Synthetic Duplicate','google_maps','legacy-1','2025-01-01','2025-01-02'),
      ('master-b','north','north-b','Synthetic Duplicate','google_maps','legacy-1','2025-01-03','2025-01-04'),
      ('master-c','south','south-a','Synthetic Existing','manual',NULL,'2025-01-05','2025-01-06')`);
    await sql(`INSERT INTO campaign_prospects (campaign_id,prospect_id,status,added_at) VALUES
      ('north-b','master-a','LEGACY','2025-01-07')`);
    const projection = () => legacy.db.$queryRaw`SELECT id,tenant_id,campaign_id,source,source_identifier,created_at,updated_at FROM prospects ORDER BY id`;
    const before = await projection();
    const existing = await legacy.db.$queryRaw`SELECT campaign_id,prospect_id,status,added_at FROM campaign_prospects`;
    include(sprint);
    run(legacy.url);
    assert.equal(await legacy.db.campaignProspect.count(), 4);
    const fabricated = await legacy.db.prospectProvenance.count();
    assert.equal(fabricated, 3);
    await legacy.db.prospectProvenance.create({ data: {
      id: 'confirmed-synthetic', tenantId: 'north', prospectId: 'master-a', campaignId: 'north-b',
      actorUserId: 'actor', source: 'csv', type: 'LINKED', recordedAt: new Date('2026-01-08T00:00:00Z'),
    } });

    // Colisión DDL sintética tardía, creada exclusivamente en otro esquema.
    await interrupted.db.$executeRaw`CREATE TABLE campaign_activities (marker integer)`;
    const failure = run(interrupted.url, 1);
    assert.match(failure.stderr, /P3018/);
    const [catalog] = await interrupted.db.$queryRaw`
      SELECT to_regtype('"CommercialStage"') IS NOT NULL AS enum_exists,
             EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='cpclose_interrupt'
                       AND table_name='prospects' AND column_name='identity_hash') AS column_exists`;
    const [ledger] = await interrupted.db.$queryRaw`
      SELECT finished_at IS NULL AS unfinished, rolled_back_at IS NULL AS unresolved
      FROM _prisma_migrations WHERE migration_name=${sprint}`;
    assert.deepEqual(ledger, { unfinished: true, unresolved: true });
    assert.match(run(interrupted.url, 1).stderr, /P3009/);
    console.log(JSON.stringify({ check: 'interruption', prisma: ['P3018', 'P3009'], ...catalog, ...ledger }));

    include(forwardFix);
    run(legacy.url);
    run(legacy.url, 0, 'status');
    assert.deepEqual(await projection(), before);
    const history = await legacy.db.prospectProvenance.findMany({ select: { id: true } });
    assert.deepEqual(history, [{ id: 'confirmed-synthetic' }]);
    assert.deepEqual(await legacy.db.$queryRaw`SELECT campaign_id,prospect_id,status,added_at FROM campaign_prospects WHERE status='LEGACY'`, existing);
    assert.equal(await legacy.db.campaignProspect.count(), 4);
    console.log(JSON.stringify({ check: 'legacy', masters: before.length, initialParticipations: existing.length,
      finalParticipations: 4, fabricatedAfterFirst: fabricated, authenticAfterFix: history.length }));
  } finally {
    await Promise.all([legacy.db.$disconnect(), interrupted.db.$disconnect()]);
  }
}

main().catch((error) => {
  // No se imprimen sentencias, URLs, trazas Prisma ni valores de fixtures.
  console.error(JSON.stringify({ check: 'migration', error: error.code ?? error.name }));
  process.exitCode = 1;
});
