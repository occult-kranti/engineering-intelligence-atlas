import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createManagedEnvironments, ManagedEnvironmentError } from '../managed-environments.mjs';
import { ENVIRONMENT_TOOL_SCHEMAS, validateEnvironmentOperation } from '../managed-environments-contract.mjs';
import { createHostControl } from '../host-control.mjs';
import { hash } from '../host-control-contract.mjs';
const runnerFile = fileURLToPath(new URL('../host-job-runner.mjs', import.meta.url));
const pythonPath = spawnSync('python3', ['-I', '-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' }).stdout.trim();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, predicate, timeout = 20000) { const end = Date.now() + timeout; while (Date.now() < end) { const value = await fn(); if (predicate(value)) return value; await pause(80); } throw new Error('Managed environment did not reach expected state'); }
function setup(t, { hostControl: supplied, mode = 'auto' } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-environment-test-'));
  const state = { companies: [{ id: 'acme', status: 'active', assistantId: 'donna' }], offices: [], departments: [], employees: [{ id: 'donna', companyId: null, officeId: null, departmentId: null, status: 'active' }] };
  const active = new Map(); const runner = { available: async () => true, launch: async ({ session, jobDir }) => {
    const child = spawn(process.execPath, [runnerFile, jobDir], { detached: true, stdio: 'ignore', env: { ...process.env, OPENAI_API_KEY: 'synthetic-not-for-python' } }); active.set(session, child); child.once('exit', () => active.delete(session)); child.unref();
  }, isAlive: async session => active.has(session), terminate: async session => { active.get(session)?.kill('SIGTERM'); } };
  const hostControl = supplied ?? createHostControl({ stateDir: directory, enabled: true, snapshot: async () => ({ ok: true, snapshot: state }), runner });
  const options = { stateDir: directory, hostControl, snapshot: async () => ({ ok: true, snapshot: state }), pythonPath };
  const service = createManagedEnvironments(options); const services = [service];
  t.after(async () => { for (const item of services) await item.close().catch(() => {}); await hostControl.stopAll?.(); await hostControl.close?.(); fs.rmSync(directory, { force: true, recursive: true }); });
  const configure = () => hostControl.configure({ expectedRevision: 0, mode, grants: [{ id: 'grant', companyId: 'acme', employeeId: null }] });
  const prepare = { id: 'prepare', companyId: 'acme', employeeId: 'donna', environmentId: 'python-env' };
  const run = (id = 'python-run', command = 'print("hello")') => ({ id, companyId: 'acme', employeeId: 'donna', environmentId: 'python-env', command, cwd: directory });
  return { directory, state, service, hostControl, configure, prepare, run, restart() { const next = createManagedEnvironments(options); services.push(next); return next; } };
}
const reject = (promise, code) => assert.rejects(promise, error => error instanceof ManagedEnvironmentError && error.code === code);
test('real virtualenv preparation respects manual host approval; Python execution verifies isolation and scrubbed variables', async t => {
  const f = setup(t, { mode: 'manual' }); await f.configure();
  const pending = await f.service.prepare(f.prepare); assert.equal(pending.environment.state, 'preparing'); assert.equal(pending.job.state, 'pending_approval');
  await reject(f.service.run(f.run()), 'ENVIRONMENT_NOT_READY');
  await f.hostControl.approve({ id: pending.job.hostJobId });
  const ready = await until(() => f.service.inspect({ id: 'prepare' }), item => item.environment.state === 'ready' || item.environment.state === 'failed');
  assert.equal(ready.environment.state, 'ready', JSON.stringify(ready)); assert.ok(ready.environment.interpreterSha256);
  const source = 'import os,sys,json; print(json.dumps({"isolated":sys.prefix!=sys.base_prefix,"venv":os.environ.get("VIRTUAL_ENV"),"required":os.environ.get("PIP_REQUIRE_VIRTUALENV"),"no_user":os.environ.get("PYTHONNOUSERSITE"),"token":os.environ.get("OPENAI_API_KEY")}))';
  const job = await f.service.run(f.run('python-run', source)); assert.equal(job.job.state, 'pending_approval'); await f.hostControl.approve({ id: job.job.hostJobId });
  const result = await until(() => f.service.inspect({ id: 'python-run' }), item => item.eof);
  assert.equal(result.job.state, 'completed', JSON.stringify(result)); const proof = JSON.parse(result.output);
  assert.equal(proof.isolated, true); assert.equal(proof.required, 'true'); assert.equal(proof.no_user, '1'); assert.equal(proof.token, null); assert.ok(proof.venv);
  assert.ok(!JSON.stringify(await f.service.status()).includes(source));
  const duplicate = await Promise.all(Array.from({ length: 16 }, () => f.service.run(f.run('python-run', source)))); assert.ok(duplicate.every(item => item.replayed));
  await reject(f.service.run(f.run('python-run', 'print("different")')), 'ENVIRONMENT_IDEMPOTENCY_CONFLICT');
  await f.service.close(); assert.equal((await f.restart().inspect({ id: 'python-run' })).job.state, 'completed');
});
test('interpreter replacement and stale native scope block managed Python dispatch', async t => {
  const f = setup(t); await f.configure(); await f.service.prepare(f.prepare);
  const ready = await until(() => f.service.inspect({ id: 'prepare' }), item => ['ready', 'failed'].includes(item.environment.state)); assert.equal(ready.environment.state, 'ready', JSON.stringify(ready));
  f.state.employees[0].status = 'fired'; await reject(f.service.run(f.run()), 'ENVIRONMENT_SCOPE_DENIED'); f.state.employees[0].status = 'active';
  const python = path.join(f.directory, 'managed-environments', 'environments', hash('python-env'), 'bin', 'python');
  fs.appendFileSync(python, '\n'); await reject(f.service.run(f.run()), 'ENVIRONMENT_CHANGED');
});
test('unknown host outcome is durable and duplicate preparation never resubmits', async t => {
  let calls = 0; const hostControl = { submit: async () => { calls++; throw new Error('lost reply'); }, inspect: async () => { throw Object.assign(new Error('missing'), { code: 'HOST_JOB_NOT_FOUND' }); } };
  const f = setup(t, { hostControl }); const first = await f.service.prepare(f.prepare); assert.equal(first.job.state, 'uncertain');
  assert.equal((await f.service.prepare(f.prepare)).replayed, true); assert.equal(calls, 1);
  await f.service.close(); assert.equal((await f.restart().prepare(f.prepare)).replayed, true); assert.equal(calls, 1);
});
test('uncertain environment writes fence before a host dispatch; owner locks release on close', async t => {
  let calls = 0; const f = setup(t, { hostControl: { submit: async () => { calls++; }, inspect: async () => { throw Object.assign(new Error('missing'), { code: 'HOST_JOB_NOT_FOUND' }); } } });
  assert.throws(() => f.restart(), error => error.code === 'ENVIRONMENT_BUSY');
  const rename = fs.renameSync; const target = path.join(f.directory, 'managed-environments', 'registry.json');
  fs.renameSync = (source, destination) => { if (destination === target) throw Object.assign(new Error('EIO'), { code: 'EIO' }); return rename(source, destination); };
  try { await reject(f.service.prepare(f.prepare), 'ENVIRONMENT_STATE_UNCERTAIN'); } finally { fs.renameSync = rename; }
  await reject(f.service.status(), 'ENVIRONMENT_STATE_UNCERTAIN'); assert.equal(calls, 0); await f.service.close(); assert.equal((await f.restart().status()).environments.items.length, 0);
});
test('schemas require Python source and bounded paths; requirements and shell installation are not exposed', () => {
  assert.equal(ENVIRONMENT_TOOL_SCHEMAS.run.properties.command.description.includes('Python source'), true);
  assert.throws(() => validateEnvironmentOperation('run', { id: 'x', companyId: 'c', employeeId: 'e', environmentId: 'v', command: 'print(1)', cwd: '../outside' }), ManagedEnvironmentError);
  assert.throws(() => validateEnvironmentOperation('prepare', { id: 'x', companyId: 'c', employeeId: 'e', environmentId: 'v', requirements: 'anything' }), ManagedEnvironmentError);
  assert.throws(() => validateEnvironmentOperation('__proto__', {}), ManagedEnvironmentError);
});
