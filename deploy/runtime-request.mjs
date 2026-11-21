#!/usr/bin/env node
// Small operator client: reads a secret file and never puts its value in argv.
import { readSecretFile } from '../headless-runtime/secrets.mjs';

const actions = {
  status: { path: '/v1/status', method: 'GET' },
  office: { path: '/v1/office', method: 'GET' },
  pause: { path: '/v1/workers', method: 'POST', body: { enabled: false } },
  resume: { path: '/v1/workers', method: 'POST', body: { enabled: true } },
};

try {
  const action = Object.hasOwn(actions, process.argv[2]) ? actions[process.argv[2]] : null;
  if (!action || process.argv.length !== 3) throw new Error('Usage: node deploy/runtime-request.mjs status|office|pause|resume');
  const base = new URL(process.env.DAFTAR_RUNTIME_URL || 'http://127.0.0.1:8788');
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)
      || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('This operator client uses a loopback HTTP address. Use SSH forwarding for another machine.');
  }
  const token = readSecretFile(process.env.DAFTAR_CONTROL_TOKEN_FILE, { controlToken: true });
  const response = await fetch(new URL(action.path, base), {
    method: action.method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(action.body ? { body: JSON.stringify(action.body) } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  const value = await response.json();
  console.log(JSON.stringify(value, null, 2));
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  // The token itself is never included in a request URL or error message.
  console.error(error?.message || 'Runtime request failed.');
  process.exitCode = 1;
}
