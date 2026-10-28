'use strict';
const { spawnSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const steps = process.argv.includes('--postgres-only')
  ? [['postgres', 'npm', ['run', 'test:postgres', '--', '--silent']]]
  : [
      ['generate', 'npm', ['run', 'prisma:generate']],
      ['validate', 'npx', ['prisma', 'validate']],
      ['types', 'npx', ['tsc', '--noEmit']],
      ['build', 'npm', ['run', 'build']],
      ['lint', 'npm', ['run', 'lint:check']],
      ['format', 'npm', ['run', 'format:check']],
      ['unit', 'npm', ['run', 'test:unit:ci', '--', '--silent']],
      ['http', 'npm', ['run', 'test:e2e:ci', '--', '--silent']],
      ['postgres', 'npm', ['run', 'test:postgres', '--', '--silent']],
      ['migrations', 'npx', ['prisma', 'migrate', 'status']],
      [
        'contract',
        process.execPath,
        ['codex/backend-adr006/verify-contract.cjs'],
      ],
    ];
for (const [name, cmd, args] of steps) {
  const started = Date.now();
  let output;
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 30 * 1024 * 1024,
  });
  output = String(result.stdout || '') + String(result.stderr || '');
  if (result.status !== 0) {
    writeFileSync('/tmp/g1-' + name + '.log', output);
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        name,
        command: [cmd, ...args].join(' '),
        result: 'FAIL',
        privateLog: '/tmp/g1-' + name + '.log',
      }),
    );
    process.exit(1);
  }
  writeFileSync('/tmp/g1-' + name + '.log', output);
  const summary = output
    .split('\n')
    .filter((l) =>
      /^(Test Suites:|Tests:|Time:|All matched|Database schema)/.test(l),
    );
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      name,
      command: [cmd, ...args].join(' '),
      result: 'PASS',
      elapsedMilliseconds: Date.now() - started,
      summary,
    }),
  );
}
