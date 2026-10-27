import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
export async function startControlledService(
  backendOrigin: string,
  key: string,
  callbackKey: string,
  mode: 'normal' | 'early-callback' | 'delayed' = 'normal',
) {
  const runtime = existsSync('.tmp/mvp-runtime.json')
    ? (JSON.parse(readFileSync('.tmp/mvp-runtime.json', 'utf8')) as {
        python?: string;
      })
    : {};
  const python = process.env.PROSPECTOR_TEST_PYTHON ?? runtime.python;
  if (!python)
    throw new Error(
      'Set PROSPECTOR_TEST_PYTHON to the interpreter with the verified Service and Engine packages',
    );
  const child = spawn(python, [resolve('test/support/controlled_service.py')], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      MVP_BACKEND_ORIGIN: backendOrigin,
      MVP_SERVICE_KEY: key,
      MVP_CALLBACK_KEY: callbackKey,
      MVP_DELAY_ACCEPTANCE: String(mode === 'delayed'),
      MVP_CALLBACK_BEFORE_ACCEPTANCE: String(mode === 'early-callback'),
    },
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-16000);
  });
  const origin = await new Promise<string>((resolveReady, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Controlled Service startup timed out'));
    }, 15000);
    child.once('error', () => {
      clearTimeout(timer);
      reject(new Error('Cannot launch controlled Service'));
    });
    child.once('exit', () => {
      clearTimeout(timer);
      reject(
        new Error('Controlled Service exited before readiness: ' + stderr),
      );
    });
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const end = output.indexOf('\n');
      if (end < 0) return;
      try {
        const ready = JSON.parse(output.slice(0, end)) as { port: number };
        clearTimeout(timer);
        resolveReady('http://127.0.0.1:' + ready.port);
      } catch {
        clearTimeout(timer);
        child.kill();
        reject(new Error('Invalid controlled Service startup'));
      }
    });
  });
  for (let i = 0; i < 150; i++) {
    try {
      const response = await fetch(origin + '/health/ready');
      if (response.status === 200) break;
    } catch {
      /* startup not bound yet */
    }
    if (i === 149) {
      child.kill();
      throw new Error('Controlled Service did not become ready: ' + stderr);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
  }
  return {
    origin,
    diagnostics: () => stderr,
    async stop() {
      if (child.exitCode !== null) return;
      const exited = new Promise<void>((resolveExit) =>
        child.once('exit', () => resolveExit()),
      );
      child.stdin.write('stop\n');
      const timer = setTimeout(() => child.kill(), 5000);
      await exited;
      clearTimeout(timer);
    },
  };
}
