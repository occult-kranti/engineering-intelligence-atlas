import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer, startServer, configurationFromEnv } from '../server.mjs';
import { RuntimeController, createRuntime } from '../runtime.mjs';
import { validateCommandEnvelope, OWNER_ACTIONS, BODY_LIMIT, OUTPUT_LIMIT, RuntimeError } from '../contract.mjs';
import { readSecretFile } from '../secrets.mjs';
import { requireBuild } from './build-required.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const token = 'test_control_credential_012345678901234567890123456789';
const hash = 'a'.repeat(64);
const envelope = { id: 'request-one', expectedStateHash: hash,
  command: { action: 'create_company', id: 'new-company', name: 'A new company' } };

async function withServer(t, runtime, options = {}) {
  const server = createServer({ runtime, token, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const request = (route, data, headers = {}) => fetch(origin + route, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { origin, request, server };
}

function fakeRuntime(overrides = {}) {
  return {
    status: () => ({ ok: true, worker: { enabled: false, running: false } }),
    snapshot: async () => ({ ok: true, snapshot: { companies: [] }, stateHash: hash }),
    command: async body => ({ ok: true, id: body.id, replayed: false }),
    setEnabled: enabled => ({ ok: true, worker: { enabled } }),
    runOnce: () => ({ ok: true, accepted: true }), close: async () => {}, ...overrides,
  };
}

test('owner contract rejects settlement, nested dangerous keys and stale envelope shapes', () => {
  assert.deepEqual(validateCommandEnvelope(envelope), envelope);
  for (const action of ['update_employee', 'rename_department', 'rename_office']) {
    assert.equal(validateCommandEnvelope({ ...envelope, command: { action } }).command.action, action);
  }
  for (const action of ['claim_job', 'reserve_job', 'finish_job', 'heartbeat_job', 'reserve_external', 'settle_external', 'import_cloud_message', 'apply_remote_command', 'shell']) {
    assert.equal(OWNER_ACTIONS.includes(action), false);
    assert.throws(() => validateCommandEnvelope({ ...envelope, command: { action } }), /owner control/);
  }
  assert.throws(() => validateCommandEnvelope({ ...envelope, expectedStateHash: 'bad' }), /state hash/);
  assert.throws(() => validateCommandEnvelope({ ...envelope, anotherField: true }), /state hash/);
  assert.throws(() => validateCommandEnvelope({ ...envelope, command: JSON.parse('{"action":"create_company","payload":{"__proto__":{}}}') }), /Reserved/);
});

test('health reveals no state; all control routes need a valid credential', async t => {
  const { origin, request } = await withServer(t, fakeRuntime());
  const health = await fetch(origin + '/healthz');
  assert.deepEqual(await health.json(), { ok: true, service: 'daftar-headless', apiVersion: 1 });
  for (const route of ['/v1/status', '/v1/office']) {
    assert.equal((await fetch(origin + route)).status, 401);
    assert.equal((await request(route, undefined, { Authorization: 'Bearer wrong' })).status, 401);
    assert.equal((await request(route)).status, 200);
  }
  assert.equal((await request('/v1/workers', { enabled: true }, { Authorization: '' })).status, 401);
  assert.equal((await request('/v1/office', undefined, { Origin: 'https://foreign.example' })).status, 403);
  assert.equal((await request('/v1/workers', { enabled: true, unexpected: true })).status, 400);
  assert.equal((await request('/v1/commands', {}, { 'Content-Type': 'application/jsonp' })).status, 415);
  assert.equal((await request('/v1/workers/run-once', {})).status, 202);
});

test('shared model endpoints require owner authentication and reject unrecognized query fields before dispatch', async t => {
  const calls = [];
  const { request, origin } = await withServer(t, fakeRuntime({ modelOperation: async (operation, input) => { calls.push({ operation, input }); return { ok: true, snapshot: { companyId: input.companyId } }; } }));
  assert.equal((await fetch(origin + '/v1/models?companyId=company-a')).status, 401);
  assert.equal((await request('/v1/models?companyId=company-a&employeeId=employee-a')).status, 200);
  assert.deepEqual(calls[0], { operation: 'snapshot', input: { companyId: 'company-a', employeeId: 'employee-a' } });
  for (const query of ['?companyId=a&companyId=b', '?employeeId=a', '?companyId=a&baseUrl=http://evil']) assert.equal((await request('/v1/models' + query)).status, 400);
  for (const [route, operation] of [['pull', 'request'], ['cancel', 'cancel'], ['select', 'select']]) {
    assert.equal((await request('/v1/models/' + route, { companyId: 'company-a', employeeId: 'employee-a' })).status, 200);
    assert.equal(calls.at(-1).operation, operation);
  }
  assert.equal(calls.length, 4);
});

test('real model service: HTTP pull receipt, poll, assignment, cancellation and scope errors are owner bounded', async t => {
  const compiled = path.join(repoRoot, 'desktop-shell/dist/main/modelPool.js');
  if (!requireBuild(t, [compiled])) return;
  const { ModelPoolService } = createRequire(import.meta.url)(compiled);
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-http-models-'));
  const companyId = 'company-a', employeeId = 'employee-a', model = 'llama3.2:1b'; let installed = false; let pulls = 0;
  const office = { companies: [{ id: companyId, status: 'active', assistantId: employeeId }], employees: [{ id: employeeId, companyId, officeId: null, departmentId: null, status: 'active' }], offices: [], departments: [] };
  const modelPool = new ModelPoolService({ stateDir, localOnlyConfirmed: true, snapshot: async () => ({ ok: true, snapshot: office }), fetchFn: async url => {
    if (url.endsWith('/api/tags')) return Response.json({ models: installed ? [{ name: model, digest: hash, size: 100 }] : [] });
    if (url.endsWith('/api/ps')) return Response.json({ models: [] });
    if (url.endsWith('/api/show')) return Response.json({ model_info: { architecture: 'local-fixture' } });
    if (url.endsWith('/api/pull')) { pulls++; installed = true; return new Response('{"status":"success"}\n'); }
    throw new Error('An unexpected network operation was requested');
  } });
  const runtime = new RuntimeController({ modelPool, office: {}, worker: { status: () => ({ running: false }), stop() {} } });
  t.after(async () => { await runtime.close(); fs.rmSync(stateDir, { recursive: true, force: true }); });
  const { request } = await withServer(t, runtime);
  const input = { companyId, employeeId, model, idempotencyKey: 'model-request' };
  const receipt = await (await request('/v1/models/pull', input)).json(); assert.equal(receipt.ok, true); assert.ok(receipt.requestId);
  await modelPool.waitForIdle();
  const polled = await (await request('/v1/models?companyId=' + companyId)).json(); assert.equal(polled.snapshot.requests[0].status, 'ready');
  assert.equal((await (await request('/v1/models/pull', input)).json()).replayed, true); assert.equal(pulls, 1);
  const selected = await (await request('/v1/models/select', { companyId, employeeId, model })).json(); assert.equal(selected.snapshot.assignments[0].digest, hash);
  assert.equal((await request('/v1/models/pull', { ...input, idempotencyKey: 'other', employeeId: 'unknown' })).status, 403);
  assert.equal((await request('/v1/models/cancel', { companyId, employeeId, requestId: receipt.requestId })).status, 200);
  assert.equal((await request('/v1/models/pull', { ...input, idempotencyKey: 'cloud', model: 'gpt-oss:120b-cloud' })).status, 400);
  assert.equal(pulls, 1);
});

test('invalid Host is rejected even with authentication', async t => {
  const { server } = await withServer(t, fakeRuntime());
  const status = await new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port: server.address().port, path: '/v1/status',
      headers: { Host: 'attacker.example', Authorization: `Bearer ${token}` } }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
  });
  assert.equal(status, 403);
});

test('oversized requests and unknown exceptions cannot leak secrets', async t => {
  let calls = 0;
  const { request } = await withServer(t, fakeRuntime({ command: () => {
    calls += 1; throw new Error('provider key sk-proj-super-private-credential');
  } }));
  const big = await request('/v1/commands', { text: 'x'.repeat(BODY_LIMIT) });
  assert.equal(big.status, 413);
  assert.equal(calls, 0);
  const failed = await request('/v1/commands', envelope);
  assert.equal(failed.status, 500);
  assert.doesNotMatch(await failed.text(), /super-private|sk-proj/);
});

test('bounded HTTP capacity rejects excess requests without running them', async t => {
  let release;
  const blocker = new Promise(resolve => { release = resolve; });
  let entered;
  const arrival = new Promise(resolve => { entered = resolve; });
  const { request } = await withServer(t, fakeRuntime({ snapshot: async () => {
    entered(); await blocker; return { ok: true };
  } }), { maxConcurrent: 1 });
  const pending = request('/v1/office');
  await arrival;
  const busy = await request('/v1/status');
  assert.equal(busy.status, 429);
  assert.equal(busy.headers.get('retry-after'), '1');
  release();
  assert.equal((await pending).status, 200);
});

test('successful mutation remains a receipt if projection fails afterward', async () => {
  let called;
  const worker = { status: () => ({ enabled: false, running: false }), stop() {} };
  const runtime = new RuntimeController({ worker,
    office: { officeCommand: async request => { called = request; return { ok: true, snapshot: { lastAction: { replayed: true } } }; } },
    projectSnapshot: () => { throw new Error('possible secret'); }, stateHash: () => hash });
  const result = await runtime.command(envelope);
  assert.equal(called.action, 'apply_remote_command');
  assert.equal(called.id, envelope.id);
  assert.equal(result.ok, true);
  assert.equal(result.replayed, true);
  assert.equal(result.snapshotOmitted, true);
  assert.match(result.notice, /Do not replay/);
  assert.doesNotMatch(JSON.stringify(result), /possible secret/);
});

test('transport preserves a saved receipt when an adapter response exceeds its wire limit', async t => {
  const { request } = await withServer(t, fakeRuntime({ command: async body => ({
    ok: true, id: body.id, replayed: false, snapshot: { text: 'x'.repeat(OUTPUT_LIMIT) },
  }) }));
  const response = await request('/v1/commands', envelope);
  const receipt = await response.json();
  assert.equal(response.status, 200);
  assert.equal(receipt.id, envelope.id);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.snapshotOmitted, true);
  assert.match(receipt.notice, /Do not replay/);
});

test('repeating enabled state never triggers another pool pass; disable still aborts one-shot work', () => {
  const state = { enabled: false, running: false };
  const calls = [];
  const worker = { status: () => ({ ...state }), setEnabled(value) { calls.push(value); state.enabled = value; } };
  const runtime = new RuntimeController({ office: {}, worker });
  runtime.setEnabled(true);
  runtime.setEnabled(true);
  runtime.setEnabled(false);
  runtime.setEnabled(false);
  assert.deepEqual(calls, [true, false]);
  state.running = true;
  runtime.setEnabled(false);
  assert.deepEqual(calls, [true, false, false]);
});

test('worker status exposes no raw provider error and one-shot refuses overlap', async () => {
  let running = false, release;
  const worker = { status: () => ({ enabled: false, running, lastError: '/private/path key=secret-value' }),
    runOnce: () => { running = true; return new Promise(resolve => { release = () => { running = false; resolve(); }; }); },
    stop() { running = false; } };
  const runtime = new RuntimeController({ office: {}, worker, projectSnapshot: value => value, stateHash: () => hash });
  assert.doesNotMatch(JSON.stringify(runtime.status()), /private\/path|secret-value/);
  assert.equal(runtime.runOnce().accepted, true);
  assert.throws(() => runtime.runOnce(), /already running/);
  release(); await runtime.singleRun;
  await runtime.close();
});

test('cloud cleanup failure still stops observer and worker and releases the model registry once', async () => {
  const calls = [];
  const runtime = new RuntimeController({
    office: { stopObserving: () => calls.push('observer') },
    worker: { status: () => ({ running: false }), stop: () => calls.push('worker') },
    cloudSync: { close: async () => { calls.push('cloud'); throw new Error('Synthetic cloud close failure'); } },
    modelPool: { close: async () => { calls.push('models'); } },
  });
  const closing = runtime.close();
  assert.equal(runtime.close(), closing);
  await assert.rejects(closing, /Synthetic cloud close failure/);
  assert.deepEqual(calls, ['observer', 'worker', 'cloud', 'models']);
});

test('secret files must be regular and private; configuration does not contain key values', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-secret-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'control');
  fs.writeFileSync(file, token + '\n', { mode: 0o600 });
  assert.equal(readSecretFile(file, { controlToken: true }), token);
  const link = path.join(dir, 'link'); fs.symlinkSync(file, link);
  assert.throws(() => readSecretFile(link), /Secret file/);
  if (process.platform !== 'win32') {
    fs.chmodSync(file, 0o644); assert.throws(() => readSecretFile(file), /Secret file/);
  }
  assert.throws(() => readSecretFile('relative-key'), /absolute/);
  const configuration = configurationFromEnv({ OPENAI_API_KEY_FILE: '', ANTHROPIC_API_KEY_FILE: '/run/secrets/anthropic' });
  assert.deepEqual(configuration.secretFiles, { anthropic: '/run/secrets/anthropic' });
  assert.equal(configuration.host, '127.0.0.1');
});

test('public binds require an explicit container setting', async () => {
  await assert.rejects(startServer({ host: '0.0.0.0', token, runtime: fakeRuntime() }), /container-bind/);
  await assert.rejects(startServer({ host: '192.0.2.3', token, allowContainerBind: true, runtime: fakeRuntime() }), /container-bind/);
});

test('invalid HTTP configuration is rejected before accessing or starting the runtime', async () => {
  let touched = 0;
  const config = { host: '127.0.0.1', port: 0, token: 'short',
    get runtime() { touched++; throw new Error('Runtime must not start'); } };
  await assert.rejects(startServer(config), /control token/);
  const invalidCapacity = { host: '127.0.0.1', port: 0, token, maxConcurrent: 0,
    get runtime() { touched++; throw new Error('Runtime must not start'); } };
  await assert.rejects(startServer(invalidCapacity), /concurrency limit/);
  assert.equal(touched, 0);
});

test('startup construction failure closes runtime and repeated shutdown closes it only once', async () => {
  let closes = 0;
  const runtime = fakeRuntime({ close: async () => { closes++; } });
  await assert.rejects(startServer({ host: '127.0.0.1', port: 0, token, runtime, allowedHosts: 3 }), TypeError);
  assert.equal(closes, 1);
  const service = await startServer({ host: '127.0.0.1', port: 0, token, runtime });
  const closing = service.close();
  assert.equal(service.close(), closing);
  await closing;
  assert.equal(closes, 2);
});

test('HTTP sockets close even when runtime cleanup rejects', { timeout: 5000 }, async () => {
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  let snapshots = 0;
  const service = await startServer({ host: '127.0.0.1', port: 0, token,
    runtime: fakeRuntime({
      snapshot: async () => {
        if (snapshots++ === 0) return { ok: true, snapshot: {} };
        entered();
        return new Promise(() => {});
      },
      close: async () => { throw new Error('Synthetic cleanup failure'); },
    }) });
  const waiting = fetch(`http://127.0.0.1:${service.server.address().port}/v1/office`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000),
  }).then(() => 'unexpected response', error => error);
  await started;
  await assert.rejects(service.close(), /Synthetic cleanup failure/);
  assert.equal(service.server.listening, false);
  const error = await waiting;
  assert.equal(error.name, 'TypeError');
});

test('native outage is retryable and lock contention preserves command identity guidance', async t => {
  let code = 'CORE_UNAVAILABLE';
  const runtime = new RuntimeController({
    office: { officeCommand: async () => ({ ok: false, code }) },
    worker: { status: () => ({ enabled: false, running: false }) },
  });
  const { request } = await withServer(t, runtime);
  for (const unavailable of ['CORE_UNAVAILABLE', 'STATE_LOCK_ERROR', 'STATE_READ_ERROR', 'STATE_WRITE_ERROR']) {
    code = unavailable;
    const response = await request('/v1/commands', envelope);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /same command id and body/);
  }
  code = 'STATE_BUSY';
  const busy = await request('/v1/commands', envelope);
  assert.equal(busy.status, 409);
  assert.equal(busy.headers.get('retry-after'), '1');
  assert.match((await busy.json()).error, /Retry the same command id and body/);
});

test('real Rust: concurrent replay, stale state, restart and internal-field redaction', async t => {
  const binaryPath = path.join(repoRoot, 'native-core/target/release/atlas-core');
  const dist = path.join(repoRoot, 'desktop-shell/dist/main/cloudSync.js');
  if (!requireBuild(t, [binaryPath, dist])) return;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-runtime-test-'));
  const runtimes = [];
  t.after(async () => { for (const service of runtimes) await service.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const runtime = createRuntime({ repoRoot, binaryPath, dataDir });
  runtimes.push(runtime);
  assert.equal(runtime.status().worker.enabled, false);
  const initial = await runtime.snapshot();
  const body = { id: 'create-test-company', expectedStateHash: initial.stateHash,
    command: { action: 'create_company', id: 'runtime-test-company', name: 'Runtime integration test' } };
  const responses = await Promise.all(Array.from({ length: 8 }, () => runtime.command(body)));
  assert.equal(responses.filter(result => result.replayed === false).length, 1);
  assert.equal(responses.filter(result => result.replayed === true).length, 7);
  const after = await runtime.snapshot();
  assert.equal(after.snapshot.companies.filter(c => c.id === 'runtime-test-company').length, 1);
  assert.equal(after.snapshot.companies.length, initial.snapshot.companies.length + 1);
  await assert.rejects(runtime.command({ ...body, id: 'stale-command', command: {
    action: 'create_company', id: 'second-test-company', name: 'Should conflict' } }),
    error => error instanceof RuntimeError && error.status === 409);
  await assert.rejects(runtime.command({ ...body, command: { ...body.command, name: 'Different body' } }),
    error => error.code === 'REMOTE_RECEIPT_MISMATCH');
  await runtime.close();
  const restored = createRuntime({ repoRoot, binaryPath, dataDir });
  runtimes.push(restored);
  assert.equal((await restored.command(body)).replayed, true);
  assert.equal(restored.status().worker.enabled, false);
  const require = createRequire(import.meta.url);
  const { cloudSnapshot } = require(dist);
  const projected = cloudSnapshot({ ...after.snapshot,
    jobs: [{ id: 'redaction-fixture', leaseToken: 'private-lease', workerId: 'private-worker', artifactUri: '/private/artifact' }],
    lastAction: { leaseToken: 'private-lease' }, remoteReceipts: [{ id: 'private-receipt' }] });
  assert.doesNotMatch(JSON.stringify(projected), /private-lease|private-worker|\/private\/artifact|private-receipt/);
});

test('invalid programmatic adapter fails before creating state or registry leases', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-invalid-adapter-'));
  const dataDir = path.join(root, 'not-created');
  try {
    assert.throws(() => createRuntime({ repoRoot, dataDir, generate: 'invalid' }), error => error.code === 'INVALID_CONFIG');
    assert.equal(fs.existsSync(dataDir), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('failed cloud/model startup releases creative ownership before an immediate server retry', async t => {
  const binaryPath = path.join(repoRoot, 'native-core/target/release/atlas-core');
  if (!requireBuild(t, [binaryPath, path.join(repoRoot, 'desktop-shell/dist/main/modelPool.js')])) return;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-startup-recovery-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [name, broken, expected] of [
    ['cloud', { cloudSyncEnabled: true, cloudUrl: 'https://invalid.example/unexpected-path' }, /Cloud sync requires/],
    ['model', { ollamaBaseUrl: 'https://127.0.0.1:11434' }, /loopback only/],
  ]) {
    const dataDir = path.join(root, name);
    await assert.rejects(startServer({ repoRoot, binaryPath, dataDir, token, port: 0, ...broken }), expected);
    for (const registry of ['creative-tools', 'model-pool']) assert.equal(fs.existsSync(path.join(dataDir, registry, 'owner.lock')), false);
    const restored = await startServer({ repoRoot, binaryPath, dataDir, token, port: 0 });
    try {
      assert.equal(restored.runtime.status().worker.enabled, false);
      assert.equal((await restored.runtime.snapshot()).ok, true);
    } finally { await restored.close(); }
  }
});

test('late startup failure stops a started observer and releases both acquired registries', async t => {
  const compiled = path.join(repoRoot, 'desktop-shell/dist/main/office.js');
  if (!requireBuild(t, [compiled, path.join(repoRoot, 'desktop-shell/dist/main/modelPool.js')])) return;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-startup-observer-'));
  const { OfficeService } = createRequire(import.meta.url)(compiled);
  const original = new Error('Synthetic observer startup failure');
  let office, interval;
  t.after(() => { clearInterval(interval); fs.rmSync(dataDir, { recursive: true, force: true }); });
  t.mock.method(OfficeService.prototype, 'startObserving', function () {
    office = this;
    interval = this.observerTimer = setInterval(() => {}, 1000);
    interval.unref();
    throw original;
  });
  let caught;
  try { createRuntime({ repoRoot, dataDir }); } catch (error) { caught = error; }
  assert.equal(caught, original);
  assert.equal(Object.keys(caught).includes('cleanupPromise'), false);
  assert.ok(caught.cleanupPromise instanceof Promise);
  const results = await caught.cleanupPromise;
  assert.equal(results.filter(result => result.status === 'rejected').length, 0);
  assert.equal(office.observerTimer, null);
  for (const registry of ['creative-tools', 'model-pool']) assert.equal(fs.existsSync(path.join(dataDir, registry, 'owner.lock')), false);
});

test('real worker: mock provider continues after HTTP control completes and saves artifact plus budget', async t => {
  const binaryPath = path.join(repoRoot, 'native-core/target/release/atlas-core');
  if (!requireBuild(t, [binaryPath, path.join(repoRoot, 'desktop-shell/dist/main/officeWorker.js')])) return;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-worker-test-'));
  let release, entered, calls = 0;
  const started = new Promise(resolve => { entered = resolve; });
  const runtime = createRuntime({ repoRoot, binaryPath, dataDir, concurrency: 1,
    generate: async request => {
      calls += 1;
      entered(request);
      await new Promise((resolve, reject) => {
        release = resolve;
        request.abortSignal?.addEventListener('abort', () => reject(new Error('Mock cancelled')), { once: true });
      });
      return { text: 'Synthetic provider deliverable. No external API was called.',
        inputTokens: 120, outputTokens: 40, usageObserved: true };
    } });
  t.after(async () => { release?.(); await runtime.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const { request, server } = await withServer(t, runtime);
  const initial = await runtime.snapshot();
  const companyId = initial.snapshot.companies[0].id;
  const officeId = initial.snapshot.offices.find(office => office.companyId === companyId).id;
  const enqueue = await request('/v1/commands', {
    id: 'enqueue-mocked-provider', expectedStateHash: initial.stateHash,
    command: { action: 'enqueue_job', companyId, officeId, employeeId: 'donna',
      goal: 'Produce a synthetic verification artifact.', mode: 'provider', provider: 'anthropic',
      model: 'mock-provider', authorized: true, maxTokens: 64000, maxUsd: 1, maxMinutes: 5,
      priceRates: { inputUsdPerMillion: 1, outputUsdPerMillion: 1 }, idempotencyKey: 'mocked-worker-job' },
  });
  assert.equal(enqueue.status, 200);
  const enable = await request('/v1/workers', { enabled: true });
  assert.equal(enable.status, 200);
  await enable.json();
  const timer = setTimeout(() => entered(null), 3000);
  const generation = await started;
  clearTimeout(timer);
  assert.ok(generation, 'The real worker must reach the injected provider.');
  assert.equal(generation.model, 'mock-provider');
  assert.equal(calls, 1);
  const repeatEnable = await request('/v1/workers', { enabled: true });
  assert.equal(repeatEnable.status, 200);
  await repeatEnable.json();
  assert.equal(calls, 1);
  // Closing the completed control connection does not own the server's job.
  server.closeIdleConnections();
  assert.equal(generation.abortSignal.aborted, false);
  assert.equal(runtime.status().worker.running, true);
  release();
  const deadline = Date.now() + 3000;
  while (runtime.status().worker.running && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(runtime.status().worker.running, false);
  runtime.setEnabled(false);
  const final = await runtime.snapshot();
  const job = final.snapshot.jobs.find(job => job.idempotencyKey === 'mocked-worker-job');
  assert.equal(job.status, 'completed');
  assert.equal(job.usage.inputTokens, 120);
  assert.equal(job.usage.outputTokens, 40);
  assert.equal(job.usage.costUsd, 0.00016);
  assert.equal(final.snapshot.budget.observedUsd, 0.00016);
  assert.equal(final.snapshot.budget.reservedUsd, 0);
  const artifacts = fs.readdirSync(path.join(dataDir, 'office-artifacts')).filter(file => file.endsWith('.md'));
  assert.equal(artifacts.length, 1);
  assert.match(fs.readFileSync(path.join(dataDir, 'office-artifacts', artifacts[0]), 'utf8'), /Synthetic provider deliverable/);
  assert.equal(job.artifactUri, null);
  assert.equal(job.leaseToken, null);
  assert.equal(calls, 1);
});
