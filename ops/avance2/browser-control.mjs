import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const [container, envPath, ...args] = process.argv.slice(2);
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const payload = JSON.parse(args.join(' ') || '{}');
const sequence = Array.isArray(payload) ? payload : [payload];
for (const data of sequence) {
  if (data.value === '__DEMO_PASSWORD__') data.value = env.LOCAL_DEMO_PASSWORD;
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'python',
      '-c',
      "import sys,urllib.request;print(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:6090',data=sys.stdin.buffer.read())).read().decode())",
    ],
    { input: JSON.stringify(data), encoding: 'utf8', timeout: 100000 },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  let output = result.stdout.replaceAll(env.LOCAL_DEMO_PASSWORD, '[REDACTED]');
  console.log(output);
  if (!JSON.parse(output).ok) {
    process.exitCode = 1;
    break;
  }
}
