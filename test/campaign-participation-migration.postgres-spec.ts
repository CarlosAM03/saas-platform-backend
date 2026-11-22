import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

describe('campaign participation forward migration fix', () => {
  let admin: PrismaClient;
  let client: PrismaClient;
  let schema: string;
  let url: string;

  const migrate = (file: string) =>
    execFileSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'db',
        'execute',
        '--schema',
        resolve('Prisma/schema.prisma'),
        '--file',
        resolve(file),
      ],
      { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } },
    );

  beforeAll(async () => {
    if (!process.env.INTEGRATION_TEST_DATABASE_URL)
      throw new Error('Disposable INTEGRATION_TEST_DATABASE_URL required');
    admin = new PrismaClient();
    await admin.$connect();
  });

  beforeEach(async () => {
    schema = `campaign_fix_${randomUUID().replace(/-/g, '')}`;
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const databaseUrl = new URL(process.env.INTEGRATION_TEST_DATABASE_URL!);
    databaseUrl.searchParams.set('schema', schema);
    url = databaseUrl.href;
    client = new PrismaClient({ datasources: { db: { url } } });

    migrate('Prisma/migrations/20260909152421_init/migration.sql');
    await client.$executeRawUnsafe(
      "INSERT INTO tenants (id, name, slug, updated_at) VALUES ('tenant', 'Tenant synthetic', 'tenant-synthetic', NOW())",
    );
    await client.$executeRawUnsafe(
      "INSERT INTO users (id, name, email, password_hash, updated_at) VALUES ('actor', 'Actor synthetic', 'actor@synthetic.test', 'hash', NOW())",
    );
    await client.$executeRawUnsafe(
      "INSERT INTO campaigns (id, tenant_id, created_by, name, updated_at) VALUES ('campaign', 'tenant', 'actor', 'Campaign synthetic', NOW())",
    );
    await client.$executeRawUnsafe(
      "INSERT INTO prospects (id, tenant_id, campaign_id, name, source, created_at, updated_at) VALUES ('legacy-prospect', 'tenant', 'campaign', 'Legacy synthetic', 'legacy-source', NOW(), NOW())",
    );
    migrate('Prisma/migrations/20261122000100_campaign_participation_sprint/migration.sql');
    migrate(
      'Prisma/migrations/20261123000100_campaign_participation_history_forward_fix/migration.sql',
    );
  });

  afterEach(async () => {
    await client.$disconnect();
    if (/^campaign_fix_[a-f0-9]{32}$/.test(schema))
      await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });

  afterAll(async () => {
    await admin?.$disconnect();
  });

  it('removes generated legacy provenance without removing the participation', async () => {
    expect(await client.prospectProvenance.count()).toBe(0);
    expect(await client.campaignProspect.count()).toBe(1);
  });

  it('restricts deletion of participation and prospect when history exists', async () => {
    await client.$executeRawUnsafe(
      "INSERT INTO campaign_activities (id, tenant_id, campaign_id, prospect_id, type) VALUES ('activity', 'tenant', 'campaign', 'legacy-prospect', 'NOTE')",
    );
    await expect(
      client.$executeRawUnsafe(
        "DELETE FROM campaign_prospects WHERE campaign_id = 'campaign' AND prospect_id = 'legacy-prospect'",
      ),
    ).rejects.toThrow();

    await client.$executeRawUnsafe("DELETE FROM campaign_activities WHERE id = 'activity'");
    await client.$executeRawUnsafe(
      "DELETE FROM campaign_prospects WHERE campaign_id = 'campaign' AND prospect_id = 'legacy-prospect'",
    );
    await client.$executeRawUnsafe(
      "INSERT INTO prospect_provenance (id, tenant_id, prospect_id, campaign_id, type, source) VALUES ('confirmed', 'tenant', 'legacy-prospect', 'campaign', 'CREATED', 'manual')",
    );
    await expect(
      client.$executeRawUnsafe("DELETE FROM prospects WHERE id = 'legacy-prospect'"),
    ).rejects.toThrow();
  });
});
