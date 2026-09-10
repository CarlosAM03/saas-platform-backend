/* Local integration evidence. Fixtures are unique and removed by exact IDs. */
require('dotenv/config');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const yaml = require('js-yaml');
const fs = require('node:fs');
const mode = process.argv[2] || 'start';
const port = mode === 'start:dev' ? 31342 : 31341;
const db = new PrismaClient();
const tenantIds = [], userIds = [], tokens = [], checks = [];
let child, logs = '';
const contract = yaml.load(fs.readFileSync('Docs/Contracts/platform-api.v1.yaml', 'utf8'));
function schemaCheck(value, schema) {
  if (schema.$ref) return schemaCheck(value, schema.$ref.split('/').slice(1).reduce((v, k) => v[k], contract));
  if (value === null && schema.nullable) return;
  for (const part of schema.allOf || []) schemaCheck(value, part);
  if (schema.enum) assert(schema.enum.includes(value));
  if (schema.type === 'object') {
    assert(value !== null && typeof value === 'object' && !Array.isArray(value));
    for (const key of schema.required || []) assert(key in value, `Missing required ${key}`);
    for (const [key, item] of Object.entries(schema.properties || {})) if (key in value) schemaCheck(value[key], item);
    if (schema.maxProperties !== undefined) assert(Object.keys(value).length <= schema.maxProperties);
  }
  if (schema.type === 'array') { assert(Array.isArray(value)); value.forEach(v => schemaCheck(v, schema.items)); }
  if (schema.type === 'string') { assert.equal(typeof value, 'string'); if (schema.pattern) assert(new RegExp(schema.pattern).test(value)); }
  if (schema.type === 'boolean') assert.equal(typeof value, 'boolean');
  if (schema.type === 'integer') assert(Number.isInteger(value));
}
async function http(method, path, status, body, token) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), Cookie: 'f4-cookie-secret', 'x-api-key': 'f4-api-secret' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(response.status, status, `${method} ${path}`);
  const text = await response.text();
  if (path === '/api/docs') { assert(text.includes('swagger-ui')); checks.push({ method, path, status }); return; }
  assert(response.headers.get('x-request-id'));
  assert(response.headers.get('x-content-type-options'));
  const data = JSON.parse(text);
  assert.equal(data.success, status < 400);
  assert(!text.includes('passwordHash'));
  if (status >= 400) schemaCheck(data, contract.components.schemas.ErrorResponse);
  else {
    const route = path.split('?')[0].replace(/\/users\/[^/]+$/, '/users/{id}');
    let spec = contract.paths[route][method.toLowerCase()].responses[String(status)];
    if (spec.$ref) spec = contract.components.responses[spec.$ref.split('/').pop()];
    schemaCheck(data, spec.content['application/json'].schema);
  }
  checks.push({ method, path: path.replace(/\/users\/[^/?]+/, '/users/{id}'), status, wrapper: true, requestId: true });
  if (data.data?.accessToken) tokens.push(data.data.accessToken);
  return data.data;
}
async function main() {
  let occupied = false;
  try { await fetch(`http://127.0.0.1:${port}/api/v1/health`); occupied = true; } catch {}
  assert(!occupied, 'Validation port must be free before starting a new server');
  child = spawn(process.execPath, ['node_modules/@nestjs/cli/bin/nest.js', 'start', ...(mode === 'start:dev' ? ['--watch'] : [])], {
    env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stdout.on('data', d => { logs += d; }); child.stderr.on('data', d => { logs += d; });
  let ready = false;
  for (let n = 0; n < 90; n++) {
    try { ready = (await fetch(`http://127.0.0.1:${port}/api/v1/health`)).ok; } catch {}
    if (ready) break;
    if (child.exitCode !== null) throw new Error('Server exited before readiness');
    await new Promise(r => setTimeout(r, 500));
  }
  assert(ready, 'Server startup timeout');
  const origin = process.env.CORS_ORIGINS.split(',')[0];
  const cors = await fetch(`http://127.0.0.1:${port}/api/v1/health`, { headers: { Origin: origin } });
  assert.equal(cors.headers.get('access-control-allow-origin'), origin);
  for (const path of ['/api/v1/health', '/api/v1/health/live', '/api/v1/health/ready', '/api/docs']) await http('GET', path, 200);
  await http('GET', '/api/v1/auth/me', 401);
  await http('GET', '/api/v1/users', 401, undefined, 'invalid-token');
  await http('POST', '/api/v1/auth/login', 401, { email: process.env.ADMIN_EMAIL, password: 'invalid-password' });
  const admin = await http('POST', '/api/v1/auth/login', 200, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  assert.equal(admin.user.platformRole, 'ADMIN'); assert.equal(admin.currentTenantId, null);
  const me = await http('GET', '/api/v1/auth/me', 200, undefined, admin.accessToken);
  assert.equal(me.accessToken, admin.accessToken);
  await http('GET', '/api/v1/users', 403, undefined, admin.accessToken);
  const run = randomUUID();
  const password = 'F4-test-' + randomUUID() + '!7';
  const hash = await bcrypt.hash(password, 12);
  const owners = [];
  for (const suffix of ['a', 'b']) {
    const tenant = await db.tenant.create({ data: { name: 'F4 audit ' + suffix, slug: 'f4-audit-' + run + '-' + suffix } }); tenantIds.push(tenant.id);
    const role = await db.role.create({ data: { tenantId: tenant.id, name: 'OWNER' } });
    await db.role.create({ data: { tenantId: tenant.id, name: 'MEMBER' } });
    const user = await db.user.create({ data: { name: 'F4 owner ' + suffix, email: `${run}-${suffix}@example.invalid`, passwordHash: hash } }); userIds.push(user.id);
    await db.userTenant.create({ data: { userId: user.id, tenantId: tenant.id, roleId: role.id } });
    owners.push(await http('POST', '/api/v1/auth/login', 200, { email: user.email, password }));
  }
  const owner = owners[0].accessToken;
  await http('GET', '/api/v1/auth/me', 200, undefined, owner);
  await http('POST', '/api/v1/auth/select-tenant', 403, { tenantId: tenantIds[1] }, owner);
  await http('POST', '/api/v1/auth/select-tenant', 404, { tenantId: 'cmissingtenant000000000000' }, admin.accessToken);
  const selected = await http('POST', '/api/v1/auth/select-tenant', 200, { tenantId: tenantIds[0] }, admin.accessToken);
  const claims = JSON.parse(Buffer.from(selected.accessToken.split('.')[1], 'base64url').toString());
  assert.equal(claims.platformRole, 'ADMIN'); assert.equal(claims.tenantRole, null); assert.equal(claims.exp - claims.iat, 28800);
  assert.equal(JSON.parse(Buffer.from(selected.accessToken.split('.')[0], 'base64url').toString()).alg, 'HS256');
  const created = await http('POST', '/api/v1/users', 201, { name: 'F4 created', email: `${run}-created@example.invalid`, password }, owner); userIds.push(created.id);
  assert.equal(created.role.name, 'MEMBER');
  await http('GET', '/api/v1/users?search=F4&sortBy=name&sortOrder=desc&limit=1&page=1', 200, undefined, owner);
  await http('GET', '/api/v1/users/' + created.id, 200, undefined, owner);
  await http('GET', '/api/v1/users/' + created.id, 404, undefined, owners[1].accessToken);
  await http('PATCH', '/api/v1/users/' + created.id, 200, { name: 'F4 updated' }, owner);
  await http('POST', '/api/v1/users', 400, { name: 'bad', email: 'bad', password: 'short' }, owner);
  await http('DELETE', '/api/v1/users/' + created.id, 403, undefined, owner);
  await http('DELETE', '/api/v1/users/' + created.id, 200, undefined, selected.accessToken);
  assert.equal((await db.user.findUnique({ where: { id: created.id } })).status, 'INACTIVO');
  await http('POST', '/api/v1/auth/logout', 200, undefined, selected.accessToken);
  assert(!logs.includes('LegacyRouteConverter'));
  for (const secret of [process.env.JWT_SECRET, process.env.ADMIN_PASSWORD, process.env.PROSPECTOR_API_KEY, 'f4-cookie-secret', 'f4-api-secret', password, ...tokens]) if (secret?.length >= 5) assert(!logs.includes(secret), 'Sensitive value in logs');
  return { mode, checks, jwt: 'HS256/8h', cors: true, logging: 'no sensitive values or LegacyRouteConverter', database: 'real PostgreSQL', cleanup: 'exact fixture IDs' };
}
main().then(result => console.log(JSON.stringify(result))).catch(error => { console.error('F4 integration failed:', error.message); process.exitCode = 1; }).finally(async () => {
  try {
    if (userIds.length) { await db.userTenant.deleteMany({ where: { userId: { in: userIds } } }); await db.user.deleteMany({ where: { id: { in: userIds } } }); }
    if (tenantIds.length) { await db.role.deleteMany({ where: { tenantId: { in: tenantIds } } }); await db.tenant.deleteMany({ where: { id: { in: tenantIds } } }); }
    await db.$disconnect();
  } finally {
    if (child && child.exitCode === null) {
      const stop = spawn('C:/Windows/System32/taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      const code = await new Promise(resolve => { stop.on('exit', resolve); stop.on('error', () => resolve(-1)); });
      if (code !== 0 && child.exitCode === null) {
        console.error('Server cleanup requires permission; validation child PID:', child.pid);
        process.exitCode = 1;
      }
      child.stdout.destroy(); child.stderr.destroy(); child.stdin.destroy(); child.unref();
    }
  }
});
