import fs from 'node:fs';
import assert from 'node:assert/strict';
const [envFile, output] = process.argv.slice(2);
const env = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const origin = 'http://127.0.0.1:18441',
  results = [];
let token;
async function req(path, method = 'GET', body, expect = 200, auth = token) {
  const headers = auth ? { Authorization: 'Bearer ' + auth } : {};
  if (path === '/api/v1/prospecting-jobs' && method === 'POST')
    headers['Idempotency-Key'] = 'avance2-core-disabled-probe';
  if (body && !(body instanceof FormData))
    headers['Content-Type'] = 'application/json';
  const r = await fetch(origin + path, {
    method,
    headers,
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  let b;
  try {
    b = await r.json();
  } catch {
    b = {};
  }
  assert.equal(
    r.status,
    expect,
    method + ' ' + path + ' ' + JSON.stringify(b).slice(0, 300),
  );
  results.push({ method, path, status: r.status });
  return b.data ?? b;
}
async function login(email) {
  const c = await req(
    '/api/v1/auth/login',
    'POST',
    { email, password: env.LOCAL_DEMO_PASSWORD },
    200,
    null,
  );
  assert(c.accessToken);
  return c;
}
try {
  await req('/api/v1/health/live', 'GET', undefined, 200, null);
  await req('/api/v1/health/ready', 'GET', undefined, 200, null);
  const sw = await fetch(origin + '/api/docs-json');
  assert.equal(sw.status, 200);
  const spec = await sw.json();
  assert.equal(spec.info.version, '1.0.0');
  assert(!Object.keys(spec.paths).some((p) => p.includes('callback')));
  results.push({
    swaggerVersion: spec.info.version,
    operations: Object.values(spec.paths).reduce(
      (n, p) =>
        n +
        Object.keys(p).filter((k) =>
          ['get', 'post', 'patch', 'delete', 'put'].includes(k),
        ).length,
      0,
    ),
  });
  for (const originHeader of [
    'https://localhost:18443',
    'https://untrusted.invalid',
  ]) {
    const r = await fetch(origin + '/api/v1/campaigns', {
      method: 'OPTIONS',
      headers: {
        Origin: originHeader,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    });
    assert.equal(
      r.headers.get('access-control-allow-origin'),
      originHeader.includes('localhost') ? originHeader : null,
    );
    results.push({
      corsOrigin: originHeader,
      status: r.status,
      allowed: originHeader.includes('localhost'),
    });
  }
  const a = await login('owner.demo-norte@demo.example');
  const b = await login('owner.demo-sur@demo.example');
  const ma = await login('member.demo-norte@demo.example');
  const mb = await login('member.demo-sur@demo.example');
  const ad = await login('admin@demo.example');
  token = a.accessToken;
  await req('/api/v1/auth/me');
  const ca = await req('/api/v1/campaigns');
  const cb = await req(
    '/api/v1/campaigns',
    'GET',
    undefined,
    200,
    b.accessToken,
  );
  const pa = await req('/api/v1/prospects');
  const pb = await req(
    '/api/v1/prospects',
    'GET',
    undefined,
    200,
    b.accessToken,
  );
  assert(ca.every((x) => !cb.some((y) => y.id === x.id)));
  assert(pa.every((x) => !pb.some((y) => y.id === x.id)));
  assert(ca.length && cb.length && pa.length && pb.length);
  await req('/api/v1/prospects/' + pb[0].id, 'GET', undefined, 404);
  await req(
    '/api/v1/campaigns/' + ca[0].id,
    'GET',
    undefined,
    404,
    b.accessToken,
  );
  await req('/api/v1/users', 'GET', undefined, 200, ma.accessToken);
  await req('/api/v1/users', 'GET', undefined, 200, mb.accessToken);
  await req(
    '/api/v1/users/' + a.user.id,
    'PATCH',
    { name: 'Forbidden' },
    403,
    ma.accessToken,
  );
  await req('/api/v1/campaigns', 'GET', undefined, 200, ma.accessToken);
  await req('/api/v1/prospects', 'GET', undefined, 200, mb.accessToken);
  await req('/api/v1/prospects', 'GET', undefined, 403, ad.accessToken);
  const tenants = await req(
    '/api/v1/tenants',
    'GET',
    undefined,
    200,
    ad.accessToken,
  );
  assert(tenants.some((t) => t.id === a.currentTenantId));
  const sel = await req(
    '/api/v1/auth/select-tenant',
    'POST',
    { tenantId: b.currentTenantId },
    200,
    ad.accessToken,
  );
  await req('/api/v1/campaigns', 'GET', undefined, 200, sel.accessToken);
  await req(
    '/api/v1/auth/select-tenant',
    'POST',
    { tenantId: b.currentTenantId },
    403,
  );
  let camp = ca.find((c) => c.name === 'Avance2 validación sintética');
  if (!camp)
    camp = await req(
      '/api/v1/campaigns',
      'POST',
      {
        name: 'Avance2 validación sintética',
        description: 'Solo datos locales reservados para validación',
      },
      201,
      ma.accessToken,
    );
  await req(
    '/api/v1/campaigns/' + camp.id,
    'PATCH',
    { description: 'Comprobación MEMBER permitida por contrato' },
    200,
    ma.accessToken,
  );
  const csv =
    'name,phone,email\r\nAV2 Runtime Synthetic,0012345,av2-runtime@demo.example\r\n';
  function multipart(campaignId, extra = {}) {
    const f = new FormData();
    f.append('file', new Blob([csv], { type: 'text/csv' }), 'synthetic.csv');
    f.append('campaignId', campaignId);
    for (const [k, v] of Object.entries(extra)) f.append(k, v);
    return f;
  }
  await req(
    '/api/v1/prospects/import/preview',
    'POST',
    multipart(cb[0].id),
    404,
  );
  await req(
    '/api/v1/prospects/import/preview',
    'POST',
    multipart(camp.id),
    403,
    ma.accessToken,
  );
  const preview = await req(
    '/api/v1/prospects/import/preview',
    'POST',
    multipart(camp.id),
  );
  const decisions = preview.rows
    .filter((r) => !['INVALID', 'CONFLICT'].includes(r.classification))
    .map((r) => ({
      record: r.record,
      action: r.classification === 'NEW' ? 'CREATE' : 'LINK_EXISTING',
    }));
  const confirmed = await req(
    '/api/v1/prospects/import/confirm',
    'POST',
    multipart(camp.id, {
      previewReference: preview.previewReference,
      decisions: JSON.stringify(decisions),
    }),
  );
  assert.equal(confirmed.summary.rejected, 0);
  const imported = await req(
    '/api/v1/prospects?search=AV2%20Runtime%20Synthetic',
  );
  assert.equal(imported.length, 1);
  assert.equal(imported[0].phone, '0012345');
  const jobs = await req('/api/v1/prospecting-jobs');
  assert(jobs.length);
  await req('/api/v1/prospecting-jobs/' + jobs[0].id);
  await req(
    '/api/v1/prospecting-jobs',
    'POST',
    {
      campaignId: camp.id,
      query: {
        keyword: 'synthetic',
        location: 'local',
        source: 'google_maps',
        limit: 1,
      },
    },
    503,
  );
  await req(
    '/api/v1/prospecting-jobs/' + jobs[0].id + '/cancel',
    'POST',
    {},
    503,
  );
  await req('/api/v1/auth/logout', 'POST', {});
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        artifact: 'Dockerfile runtime',
        origin,
        pass: true,
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ pass: true, checks: results.length }));
} catch (e) {
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        pass: false,
        error: String(e),
        results,
      },
      null,
      2,
    ),
  );
  console.error(String(e));
  process.exitCode = 1;
}
