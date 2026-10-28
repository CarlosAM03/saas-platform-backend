'use strict';
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const checks = [
  {
    label: 'mismatched destination',
    url: 'postgresql://synthetic:synthetic@localhost/g1_test',
    args: [
      '--expected-host',
      'other.invalid',
      '--expected-db',
      'g1_test',
      '--apply',
    ],
    reason: 'Target confirmation mismatch',
  },
  {
    label: 'remote forbidden in local mode',
    url: 'postgresql://synthetic:synthetic@remote.invalid/g1_test',
    args: [
      '--expected-host',
      'remote.invalid',
      '--expected-db',
      'g1_test',
      '--apply',
    ],
    reason: 'Local laboratory target required',
  },
  {
    label: 'non-lab database forbidden',
    url: 'postgresql://synthetic:synthetic@localhost/customer_data',
    args: [
      '--expected-host',
      'localhost',
      '--expected-db',
      'customer_data',
      '--apply',
    ],
    reason: 'Local laboratory target required',
  },
  {
    label: 'production requires verified TLS',
    url: 'postgresql://synthetic:synthetic@remote.invalid/g1_test',
    args: [
      '--production',
      '--expected-host',
      'remote.invalid',
      '--expected-db',
      'g1_test',
      '--apply',
    ],
    reason:
      'Production migration requires confirmed direct TLS connection, not a transaction pooler',
  },
  {
    label: 'production requires new owner GO and restored backup',
    url: 'postgresql://synthetic:synthetic@remote.invalid/g1_test?sslmode=require',
    args: [
      '--production',
      '--expected-host',
      'remote.invalid',
      '--expected-db',
      'g1_test',
      '--apply',
    ],
    reason:
      'Owner GO, verified backup/restore and segregated production environment required',
  },
];
for (const check of checks) {
  const code =
    "process.argv=['node','preflight',..." +
    JSON.stringify(check.args) +
    "];require('./codex/backend-adr006/preflight.cjs').main().then(()=>process.exit(9)).catch(error=>{if(error.message===" +
    JSON.stringify(check.reason) +
    ')process.exit(0);process.exit(8);});';
  const result = spawnSync(process.execPath, ['-e', code], {
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_ENV: check.args.includes('--production') ? 'production' : 'test',
      DATABASE_URL: check.url,
    },
  });
  assert.equal(result.status, 0, check.label + ' must stop before connecting');
}
const denied = spawnSync(
  process.execPath,
  ['-r', 'ts-node/register', '-e', "require('./test/setup-postgres-env.ts')"],
  {
    encoding: 'utf8',
    env: {
      ...process.env,
      INTEGRATION_TEST_DATABASE_URL:
        'postgresql://synthetic:synthetic@remote.invalid/g1_test',
    },
  },
);
assert.notEqual(denied.status, 0);
assert(
  denied.stderr.includes(
    'PostgreSQL tests require an allowlisted disposable local target',
  ),
);
console.log(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    result: 'PASS',
    preConnectionGuards: checks.map((c) => c.label),
    postgresTestRemoteGuard: 'PASS',
    externalConnections: 0,
  }),
);
