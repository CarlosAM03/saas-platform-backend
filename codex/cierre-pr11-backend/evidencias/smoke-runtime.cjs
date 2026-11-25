// Ejecutar por stdin dentro de la imagen del laboratorio, con cwd /app.
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const target = new URL(process.env.DATABASE_URL ?? 'http://invalid');
assert.equal(target.protocol, 'postgresql:');
assert.equal(target.hostname, 'test-db');
assert.equal(target.pathname, '/saas_test');
assert.equal(process.env.DATABASE_ENV, 'test');
assert.equal(process.env.TENANT_REGISTRATION_ENABLED, 'false');

const db = new PrismaClient();
const base = `http://127.0.0.1:${process.env.PORT}`;
let token;

async function request(path, status, { method = 'GET', body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(`${base}${path}`, {
    method, headers, body, signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, status, `${method} ${path.replace(/\?.*$/, '')}`);
  return response.json();
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

async function samples(label, operation) {
  const durations = [];
  for (let sample = 0; sample < 20; sample++) {
    const start = performance.now();
    await operation();
    durations.push(performance.now() - start);
  }
  durations.sort((left, right) => left - right);
  const medianMs = (durations[9] + durations[10]) / 2;
  console.log(JSON.stringify({ label, samples: durations.length, medianMs, p95Ms: durations[18] }));
}

async function seedTenant(label, userId) {
  const tenant = await db.tenant.create({ data: { name: label, slug: `${label}-${randomUUID()}` } });
  const role = await db.role.create({ data: { tenantId: tenant.id, name: 'OWNER' } });
  await db.userTenant.create({ data: { userId, tenantId: tenant.id, roleId: role.id } });
  return tenant;
}

function csv(campaignId, rows, fields = {}) {
  const form = new FormData();
  form.set('campaignId', campaignId);
  form.set('file', new Blob([`name\n${rows.join('\n')}`], { type: 'text/csv' }), 'synthetic.csv');
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

async function main() {
  for (const path of ['health', 'health/live', 'health/ready']) {
    await request(`/api/v1/${path}`, 200);
  }
  const openapi = await request('/api/docs-json', 200);
  const counts = { routes: Object.keys(openapi.paths).length, schemas: Object.keys(openapi.components.schemas).length };
  const matrixPaths = Object.entries(openapi.paths).flatMap(([path, item]) =>
    Object.keys(item).filter((method) => /^(get|post|put|patch|delete)$/.test(method)).map((method) => `${method.toUpperCase()} ${path}`));
  console.log(JSON.stringify({ check: 'openapi', ...counts, digest: digest(openapi), operations: matrixPaths }));

  const email = `${randomUUID()}@synthetic.test`;
  const password = randomUUID();
  const user = await db.user.create({ data: { name: 'Owner sintético', email, passwordHash: await bcrypt.hash(password, 10) } });
  const tenant = await seedTenant('synthetic-north', user.id);
  const foreign = await seedTenant('synthetic-south', user.id);
  const login = await request('/api/v1/auth/login', 200, { method: 'POST', body: { email, password } });
  token = login.data.accessToken;
  const selected = await request('/api/v1/auth/select-tenant', 200, { method: 'POST', body: { tenantId: tenant.id } });
  token = selected.data.accessToken;

  const created = await request('/api/v1/campaigns', 201, { method: 'POST', body: { name: 'Campaña sintética' } });
  const campaignId = created.data.id;
  await request(`/api/v1/campaigns/${campaignId}`, 200);
  await request(`/api/v1/campaigns/${campaignId}`, 200, { method: 'PATCH', body: { description: 'Actualización sintética' } });
  const manual = await request('/api/v1/prospects', 201, { method: 'POST', body: { campaignId, name: 'Maestro sintético' } });
  const participation = `/api/v1/campaigns/${campaignId}/prospects/${manual.data.id}`;
  await request(`${participation}/stage`, 200, { method: 'PATCH', body: { stage: 'CONTACTADO' } });
  const selector = await request(`${participation}/responsibles`, 200);
  const eligible = selector.data.find((candidate) => candidate.id === user.id);
  assert.ok(eligible, 'El selector debe incluir al owner activo');
  console.log(JSON.stringify({ check: 'responsibles', eligibleField: eligible.eligible ?? 'absent' }));

  const uploaded = ['Importado sintético'];
  const preview = await request('/api/v1/prospects/import/preview', 200, { method: 'POST', body: csv(campaignId, uploaded) });
  assert.equal(await db.prospect.count({ where: { tenantId: tenant.id } }), 1);
  const confirmed = await request('/api/v1/prospects/import/confirm', 200, { method: 'POST', body: csv(campaignId, uploaded, {
    previewReference: preview.data.previewReference,
    decisions: JSON.stringify([{ record: preview.data.rows[0].record, action: 'CREATE' }]),
  }) });
  assert.equal(confirmed.data.summary.created, 1);
  const dashboard = await request(`/api/v1/campaigns/${campaignId}/dashboard`, 200);
  assert.equal(dashboard.data.total, 2);
  assert.equal(dashboard.data.stages.CONTACTADO, 1);
  const empty = await request('/api/v1/campaigns', 201, { method: 'POST', body: { name: 'Segunda campaña sintética' } });
  await request(`/api/v1/campaigns/${empty.data.id}`, 200, { method: 'DELETE' });
  assert.equal(await db.prospectingJob.count({ where: { tenantId: tenant.id } }), 0);
  console.log(JSON.stringify({ check: 'runtime', health: 3, auth: true, campaignCrud: true, manual: true, csv: true, dashboard: true, prospectingJobs: 0 }));

  const loadCampaign = await db.campaign.create({ data: { tenantId: tenant.id, createdBy: user.id, name: 'Campaña de medición' } });
  const foreignCampaign = await db.campaign.create({ data: { tenantId: foreign.id, createdBy: user.id, name: 'Campaña paralela' } });
  await db.prospect.createMany({ data: Array.from({ length: 1000 }, (_, index) => ({ tenantId: foreign.id, campaignId: foreignCampaign.id, name: `Carga sintética ${index}`, source: 'manual' })) });
  let existing = 2;
  for (const size of [600, 1000, 5000]) {
    while (existing < size) {
      const length = Math.min(size - existing, 500);
      await db.prospect.createMany({ data: Array.from({ length }, (_, index) => ({ tenantId: tenant.id, campaignId: loadCampaign.id, name: `Carga sintética ${existing + index}`, source: 'manual' })) });
      existing += length;
    }
    await samples(`manual-match-${size}`, async () => {
      const result = await request('/api/v1/prospects/match', 201, { method: 'POST', body: { campaignId: loadCampaign.id, name: 'Carga sintética 3' } });
      assert.equal(result.data.candidates.length, 1);
    });
    const rows = Array.from({ length: Math.min(size, 1000) }, (_, index) => `Nueva fila sintética ${index}`);
    let previewReference;
    await samples(`csv-preview-${rows.length}-tenant-${size}`, async () => {
      const result = await request('/api/v1/prospects/import/preview', 200, { method: 'POST', body: csv(loadCampaign.id, rows) });
      assert.equal(result.data.rows.length, rows.length);
      previewReference = result.data.previewReference;
    });
    const decisions = JSON.stringify(rows.map((_, index) => ({ record: index + 1, action: 'SKIP' })));
    await samples(`csv-confirm-skip-${rows.length}-tenant-${size}`, async () => {
      const result = await request('/api/v1/prospects/import/confirm', 200, {
        method: 'POST', body: csv(loadCampaign.id, rows, { previewReference, decisions }),
      });
      assert.equal(result.data.summary.skipped, rows.length);
    });
  }
  assert.equal(await db.prospect.count({ where: { tenantId: tenant.id } }), 5000);
  if (eligible.eligible !== true) process.exitCode = 2;
}

main().catch((error) => {
  // Mantener fuera de logs las URLs de base, credenciales, cuerpos y tokens.
  console.error(JSON.stringify({ check: 'runtime', error: error.code ?? error.name,
    ...(error.code === 'ERR_ASSERTION' ? { assertion: error.message } : {}) }));
  process.exitCode = 1;
}).finally(() => db.$disconnect());
