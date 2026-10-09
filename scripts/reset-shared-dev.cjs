require('dotenv/config');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

if (
  process.env.DATABASE_ENV !== 'shared-dev' ||
  process.env.ALLOW_DATABASE_RESET !== 'true'
) {
  console.error(
    'Refusing reset: DATABASE_ENV=shared-dev and ALLOW_DATABASE_RESET=true are both required.',
  );
  process.exit(1);
}
if (!process.env.DATABASE_URL || !process.env.DEV_SEED_PASSWORD) {
  console.error('DATABASE_URL and DEV_SEED_PASSWORD are required.');
  process.exit(1);
}

const root = path.join(__dirname, '..');
function run(bin, args) {
  const result = spawnSync(process.execPath, [path.join(root, bin), ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('node_modules/prisma/build/index.js', [
  'migrate',
  'reset',
  '--force',
  '--skip-seed',
]);
run('node_modules/ts-node/dist/bin.js', ['Prisma/seed_dev.ts']);
