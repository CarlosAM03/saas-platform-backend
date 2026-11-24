'use strict';
const { readFileSync } = require('node:fs');
const { load } = require('js-yaml');
const assert = require('node:assert/strict');
const core = load(readFileSync('Docs/Contracts/platform-api.v1.yaml', 'utf8'));
const approved = load(
  readFileSync(
    'Docs/Contracts/platform-api.tenant-registration.approved.yaml',
    'utf8',
  ),
);
const methods = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options'];
const operations = (doc) =>
  Object.entries(doc.paths).flatMap(([path, item]) =>
    methods.filter((m) => item[m]).map((m) => m.toUpperCase() + ' ' + path),
  );
const before = operations(core),
  after = operations(approved);
assert.equal(before.length, 33);
assert.equal(after.length, 38);
for (const op of before) assert(after.includes(op));
const added = after.filter((op) => !before.includes(op));
assert.deepEqual(
  added.sort(),
  [
    'POST /api/v1/tenants/register',
    'GET /api/v1/tenants/{id}/onboarding',
    'POST /api/v1/tenants/{id}/resend-welcome',
    'POST /api/v1/auth/redeem-first-access',
    'POST /api/v1/auth/complete-first-access',
  ].sort(),
);
function refs(node, root) {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref') {
      assert(value.startsWith('#/'));
      assert(
        value
          .slice(2)
          .split('/')
          .reduce(
            (p, k) => p?.[k.replace(/~1/g, '/').replace(/~0/g, '~')],
            root,
          ),
      );
    } else refs(value, root);
  }
}
refs(core, core);
refs(approved, approved);
// Approved descriptive text adds pending-account semantics; the wire contract stays fixed.
for (const key of ['security', 'requestBody', 'responses'])
  assert.deepEqual(
    core.paths['/api/v1/auth/login'].post[key],
    approved.paths['/api/v1/auth/login'].post[key],
  );
console.log(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    coreOperations: 33,
    totalOperations: 38,
    added,
    localReferences: 'PASS',
    loginContract: 'unchanged',
    result: 'PASS',
  }),
);
