import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const yaml = require('../../node_modules/js-yaml');
const [backendSpec, frontendSpec, out] = process.argv.slice(2);
const b = backendSpec.startsWith('http')
    ? await (await fetch(backendSpec)).json()
    : yaml.load(fs.readFileSync(backendSpec, 'utf8')),
  f = yaml.load(fs.readFileSync(frontendSpec, 'utf8'));
function canon(x) {
  if (Array.isArray(x)) return x.map(canon);
  if (x && typeof x === 'object')
    return Object.fromEntries(
      Object.keys(x)
        .sort()
        .filter(
          (k) =>
            ![
              'description',
              'summary',
              'example',
              'examples',
              'operationId',
              'tags',
              'externalDocs',
            ].includes(k),
        )
        .map((k) => [k, canon(x[k])]),
    );
  return x;
}
const diff = [];
function cmp(a, z, path) {
  if (JSON.stringify(canon(a)) !== JSON.stringify(canon(z))) diff.push(path);
}
for (const name of new Set([
  ...Object.keys(b.components.schemas),
  ...Object.keys(f.components.schemas),
]))
  cmp(b.components.schemas[name], f.components.schemas[name], 'schema/' + name);
const ops = [];
for (const path of new Set([
  ...Object.keys(b.paths),
  ...Object.keys(f.paths),
])) {
  for (const method of ['get', 'post', 'patch', 'delete', 'put', 'options']) {
    const bo = b.paths[path]?.[method],
      fo = f.paths[path]?.[method];
    if (!bo && !fo) continue;
    ops.push({
      method: method.toUpperCase(),
      path,
      backend: !!bo,
      frontend: !!fo,
      enabled: !(
        path.includes('/internal/') ||
        (path.includes('prospecting-jobs') && method !== 'get') ||
        path.endsWith('/export')
      ),
    });
    if (!bo || !fo) diff.push(method + ' ' + path);
    else {
      cmp(bo.requestBody, fo.requestBody, method + ' ' + path + ' requestBody');
      cmp(bo.parameters, fo.parameters, method + ' ' + path + ' parameters');
      for (const status of Object.keys(bo.responses ?? {}))
        if (status[0] === '2')
          cmp(
            bo.responses[status],
            fo.responses?.[status],
            method + ' ' + path + ' response ' + status,
          );
    }
  }
}
const result = {
  date: new Date().toISOString(),
  backendSpec,
  frontendSpec,
  backendVersion: b.info.version,
  frontendVersion: f.info.version,
  operations: ops,
  differences: diff,
  pass: diff.length === 0,
};
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (diff.length) process.exitCode = 1;
