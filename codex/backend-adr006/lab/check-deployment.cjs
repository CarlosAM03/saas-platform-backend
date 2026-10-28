'use strict';
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const base = 'https://frontend.example.test';
async function attempt() {
  const response = await fetch(base + '/api/v1/auth/redeem-first-access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '203.0.113.' + Math.floor(Math.random() * 200),
    },
    body: JSON.stringify({
      activationToken: randomBytes(32).toString('base64url'),
    }),
  });
  await response.body?.cancel();
  return response.status;
}
(async () => {
  if (process.argv.includes('--second-client')) {
    assert.equal(await attempt(), 401);
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        result: 'PASS',
        test: 'separate TCP client has independent allowance through verified TLS proxy',
      }),
    );
    return;
  }
  const good = await fetch(base + '/api/v1/health/ready', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://frontend.example.test',
      'Access-Control-Request-Method': 'POST',
    },
  });
  assert.equal(good.status, 204);
  assert.equal(
    good.headers.get('access-control-allow-origin'),
    'https://frontend.example.test',
  );
  const wrong = await fetch(base + '/api/v1/health/ready', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://untrusted.example.test',
      'Access-Control-Request-Method': 'POST',
    },
  });
  assert.equal(wrong.headers.get('access-control-allow-origin'), null);
  const db = new PrismaClient();
  try {
    const before = await db.activationRateLimit.count({ where: { count: 6 } });
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push(await attempt());
    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429]);
    assert.equal(
      await db.activationRateLimit.count({ where: { count: 6 } }),
      before + 1,
    );
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        result: 'PASS',
        tlsVerification: true,
        cors: 'PASS',
        spoofedForwardingHeaders: 'cannot evade 429',
        persistedSaturatedBucket: true,
      }),
    );
  } finally {
    await db.$disconnect();
  }
})().catch(() => {
  console.error(
    'FAIL: local deployment check; no raw response or secret emitted',
  );
  process.exitCode = 1;
});
