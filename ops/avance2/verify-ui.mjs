import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const [container, envPath, out, port = '18443'] = process.argv.slice(2);
const cfg = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const evidence = [];
const base = 'https://localhost:' + port;
function act(d) {
  const r = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'python',
      '-c',
      "import sys,urllib.request;print(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:6090',data=sys.stdin.buffer.read()),timeout=100).read().decode())",
    ],
    { input: JSON.stringify(d), encoding: 'utf8', timeout: 110000 },
  );
  if (r.status) throw new Error(r.stderr);
  const v = JSON.parse(r.stdout);
  if (!v.ok) throw new Error(v.error);
  return v.data;
}
function record(name, s) {
  const clean = JSON.stringify(s).replaceAll(
    cfg.LOCAL_DEMO_PASSWORD,
    '[REDACTED]',
  );
  evidence.push({ name, data: JSON.parse(clean) });
  console.log(name + ' PASS');
}
function login(email) {
  let s = act({ action: 'goto', url: base + '/#/login' });
  if (!s.url.includes('/login')) {
    act({ action: 'click', name: 'Cerrar sesión', exact: true });
  }
  act({ action: 'fill', name: 'Correo electrónico', value: email });
  act({ action: 'fill', name: 'Contraseña', value: cfg.LOCAL_DEMO_PASSWORD });
  return act({ action: 'click', name: 'Iniciar sesión', wait: 3 });
}
try {
  for (const p of [
    {
      role: 'OWNER-A',
      email: 'owner.demo-norte@demo.example',
      tenant: 'Demo Norte',
    },
    {
      role: 'MEMBER-A',
      email: 'member.demo-norte@demo.example',
      tenant: 'Demo Norte',
    },
    {
      role: 'OWNER-B',
      email: 'owner.demo-sur@demo.example',
      tenant: 'Demo Sur',
    },
    {
      role: 'MEMBER-B',
      email: 'member.demo-sur@demo.example',
      tenant: 'Demo Sur',
    },
  ]) {
    const s = login(p.email);
    assert(s.url.includes('dashboard'), JSON.stringify(s));
    assert(s.aria.includes(p.tenant));
    record(p.role + ' login-dashboard', s);
    act({
      action: 'screenshot',
      name: 'core-' + p.role.toLowerCase() + '.png',
    });
    const campaigns = act({ action: 'goto', url: base + '/#/campaigns' });
    assert(campaigns.aria.includes(p.tenant));
    assert(
      !campaigns.aria.includes(
        p.tenant === 'Demo Norte' ? 'Demo Sur' : 'Demo Norte',
      ),
    );
    record(p.role + ' campaigns-isolation', campaigns);
    const users = act({ action: 'goto', url: base + '/#/users' });
    if (p.role.startsWith('MEMBER'))
      assert(!users.aria.includes('Crear usuario'));
    record(p.role + ' users-permissions', users);
    act({ action: 'click', name: 'Cerrar sesión', exact: true });
    const loggedOut = act({ action: 'goto', url: base + '/#/dashboard' });
    assert(loggedOut.url.includes('/login'));
    record(p.role + ' logout-protected-route', loggedOut);
  }
  const ad = login('admin@demo.example');
  assert(ad.url.includes('select-tenant'));
  record('ADMIN tenant-discovery', ad);
  act({ action: 'screenshot', name: 'core-admin-tenant-discovery.png' });
  fs.writeFileSync(
    out,
    JSON.stringify(
      { date: new Date().toISOString(), pass: true, container, evidence },
      null,
      2,
    ),
  );
  console.log('UI_SMOKE_PASS');
} catch (e) {
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        pass: false,
        error: String(e),
        evidence,
      },
      null,
      2,
    ),
  );
  console.error(String(e));
  process.exitCode = 1;
}
