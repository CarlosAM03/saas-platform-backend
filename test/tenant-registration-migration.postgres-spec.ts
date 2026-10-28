import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('ADR006 additive migration and collision audit (isolated schemas)', () => {
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
    schema = `adr006_${randomUUID().replace(/-/g, '')}`;
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const u = new URL(process.env.INTEGRATION_TEST_DATABASE_URL!);
    u.searchParams.set('schema', schema);
    url = u.href;
    client = new PrismaClient({ datasources: { db: { url } } });
    migrate('Prisma/migrations/20260909152421_init/migration.sql');
  });
  afterEach(async () => {
    await client.$disconnect();
    // Generated per-test schema only, never public or a preexisting schema.
    if (/^adr006_[a-f0-9]{32}$/.test(schema))
      await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
  afterAll(async () => {
    await admin?.$disconnect();
  });
  const insert = (id: string, email: string) =>
    client.$executeRaw`INSERT INTO users (id, name, email, password_hash, updated_at) VALUES (${id}, 'Historical', ${email}, 'existing-hash', NOW())`;
  it('normalizes historical email, defaults flag false and does not create onboarding', async () => {
    await insert('historical', '  Mixed.Case@Example.com  ');
    migrate(
      'Prisma/migrations/20261027000100_tenant_registration/migration.sql',
    );
    expect(
      await client.user.findUniqueOrThrow({
        where: { email: 'mixed.case@example.com' },
      }),
    ).toMatchObject({
      id: 'historical',
      mustChangePassword: false,
      passwordHash: 'existing-hash',
    });
    expect(await client.tenantOnboarding.count()).toBe(0);
    await expect(
      insert('collision', 'MIXED.CASE@EXAMPLE.COM'),
    ).rejects.toThrow();
  });
  it('aborts on collisions before changing historical data or schema', async () => {
    await insert('one', 'collision@example.com');
    await insert('two', ' COLLISION@example.com ');
    expect(() =>
      migrate(
        'Prisma/migrations/20261027000100_tenant_registration/migration.sql',
      ),
    ).toThrow();
    const rows = await client.$queryRaw<
      { email: string }[]
    >`SELECT email FROM users ORDER BY id`;
    expect(rows.map((r) => r.email)).toEqual([
      'collision@example.com',
      ' COLLISION@example.com ',
    ]);
    const columns = await client.$queryRaw<
      { column_name: string }[]
    >`SELECT column_name FROM information_schema.columns WHERE table_schema = ${schema} AND table_name = 'users' AND column_name = 'must_change_password'`;
    expect(columns).toHaveLength(0);
  });
});
