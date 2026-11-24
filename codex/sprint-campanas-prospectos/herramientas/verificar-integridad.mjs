#!/usr/bin/env node
// Compare local authoritative docs/launcher tools with hashes bundled at creation time. Does not authorize execution.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(join(base,'MANIFEST_INTEGRIDAD.json'),'utf8'));
let failures=0;
for (const [file, expected] of Object.entries(manifest.sha256||{})) {
  try {
    const current=createHash('sha256').update(readFileSync(join(base,file))).digest('hex');
    const status=current===expected?'OK':'CHANGED';
    console.log(`${status} ${file}`); if(status!=='OK') failures++;
  } catch(e){ console.log(`MISSING ${file}`);failures++; }
}
console.log(`Checked ${Object.keys(manifest.sha256).length} files; anomalies: ${failures}.`);
if(failures) process.exitCode=1;
