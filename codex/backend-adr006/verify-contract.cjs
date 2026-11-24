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

// ADR-006 guard: the approved snapshot must keep the 33 baseline operations
// plus exactly the five tenant-registration operations it introduced.
const tenantRegistrationOperations = [
  'POST /api/v1/tenants/register',
  'GET /api/v1/tenants/{id}/onboarding',
  'POST /api/v1/tenants/{id}/resend-welcome',
  'POST /api/v1/auth/redeem-first-access',
  'POST /api/v1/auth/complete-first-access',
].sort();
const approvedOperations = operations(approved).sort();
assert.equal(approvedOperations.length, 38);
const baselineOperations = approvedOperations.filter(
  (operation) => !tenantRegistrationOperations.includes(operation),
);
assert.equal(baselineOperations.length, 33);

// Baseline compatibility: every pre-ADR-006 operation still exists in the
// live contract. Tenant registration operations are served by
// deploymentDocument and intentionally absent from the YAML source.
const liveOperations = operations(core).sort();
for (const operation of baselineOperations)
  assert(liveOperations.includes(operation), `missing baseline op ${operation}`);

// Sprint CP extension: the live contract may only grow by this explicit
// allowlist. Anything else is unreviewed contract surface.
const campaignParticipationOperations = [
  'GET /api/v1/campaigns/{id}/dashboard',
  'GET /api/v1/campaigns/{campaignId}/prospects/{prospectId}/participation',
  'PATCH /api/v1/campaigns/{campaignId}/prospects/{prospectId}/stage',
  'PATCH /api/v1/campaigns/{campaignId}/prospects/{prospectId}/evaluation',
  'GET /api/v1/campaigns/{campaignId}/prospects/{prospectId}/responsibles',
  'PUT /api/v1/campaigns/{campaignId}/prospects/{prospectId}/responsible',
  'DELETE /api/v1/campaigns/{campaignId}/prospects/{prospectId}/responsible',
  'GET /api/v1/campaigns/{campaignId}/prospects/{prospectId}/activities',
  'POST /api/v1/campaigns/{campaignId}/prospects/{prospectId}/activities',
  'POST /api/v1/prospects/match',
  'POST /api/v1/prospects/resolve',
  'GET /api/v1/prospects/{id}/campaigns',
  'GET /api/v1/prospects/{id}/provenance',
].sort();
const addedToLive = liveOperations.filter(
  (operation) => !baselineOperations.includes(operation),
);
assert.deepEqual(addedToLive, campaignParticipationOperations);
assert.equal(liveOperations.length, baselineOperations.length + 13);

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
    baselineOperations: baselineOperations.length,
    approvedOperations: approvedOperations.length,
    liveOperations: liveOperations.length,
    addedTenantRegistration: tenantRegistrationOperations.length,
    addedCampaignParticipation: addedToLive.length,
    localReferences: 'PASS',
    loginContract: 'unchanged',
    result: 'PASS',
  }),
);
