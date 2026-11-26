'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createPersistentRuntime } = require('../src/persistent-runtime');

const linux = { skip: process.platform !== 'linux' ? 'Persistent supervisor supports Linux only.' : false };
const token = 'synthetic_persistent_runtime_token_123456789012345';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
async function until(predicate) { for (let count = 0; count < 40; count++) { if (predicate()) return; await turn(); } assert.fail('Expected persistent bootstrap to reach its mocked boundary.'); }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-persistent-test-'));
  const runtimeRoot = path.join(directory, 'runtime'), storagePath = path.join(directory, 'storage');
  const dataDir = path.join(storagePath, 'persistent-runtime'), tokenFile = path.join(dataDir, 'secrets/control-token');
  const files = {};
  for (const relative of ['headless-runtime/server.mjs', 'deploy/tmux-runtime.mjs', 'native-core/target/release/atlas-core']) {
    const destination = path.join(runtimeRoot, relative); fs.mkdirSync(path.dirname(destination), { recursive: true });
    const source = '// synthetic fixture; no process is executed'; fs.writeFileSync(destination, source);
    files[relative] = { bytes: source.length, sha256: digest(source) };
  }
  fs.writeFileSync(path.join(runtimeRoot, 'manifest.json'), JSON.stringify({ schemaVersion: 1, platform: 'linux', arch: process.arch,
    nodeMajorMinimum: 22, entrypoint: 'headless-runtime/server.mjs', corePath: 'native-core/target/release/atlas-core', files }));
  const execCalls = [], fetchCalls = [];
  const controls = { metadata: {}, attempts: 0, exec: null, fetch: null };
  const execFileFn = async (file, args, settings) => {
    execCalls.push({ file, args, settings });
    if (controls.exec) { const value = await controls.exec(args, settings); if (value !== undefined) return value; }
    if (args[0] === '--version') return { stdout: options.version ?? 'v24.1.0\n', stderr: '' };
    assert.equal(args[1], 'start'); fs.mkdirSync(path.dirname(tokenFile), { recursive: true, mode: 0o700 });
    if (!fs.existsSync(tokenFile)) fs.writeFileSync(tokenFile, token + '\n', { flag: 'wx', mode: options.tokenMode ?? 0o600 });
    return { stdout: JSON.stringify({ ok: true, running: true, dataDir, repoRoot: runtimeRoot,
      runtimeUrl: 'http://127.0.0.1:8788', controlTokenFile: tokenFile, hostControlEnabled: true, ...controls.metadata }), stderr: '' };
  };
  const fetcher = async (url, init) => {
    fetchCalls.push({ url, init }); controls.attempts++;
    if (controls.fetch) { const value = await controls.fetch(url, init); if (value !== undefined) return value; }
    return json({ ok: true, execution: 'headless', capabilities: { workbench: true },
      worker: { enabled: options.workerEnabled ?? false, running: false }, host: { configured: true, mode: options.mode ?? 'off' } });
  };
  const input = { runtimeRoot, storagePath, execFileFn, fetcher, environment: { PATH: '/synthetic/bin', HOME: '/synthetic/home',
    NODE_OPTIONS: '--inspect', OPENAI_API_KEY: 'never-inherit-this', GITHUB_TOKEN_FILE: '/do-not-inherit', SSH_AUTH_SOCK: '/agent.sock', DAFTAR_PYTHON_PATH: '/ambient/not-selected' } };
  const adapters = [];
  const create = extra => { const adapter = createPersistentRuntime({ ...input, ...extra }); adapters.push(adapter); return adapter; };
  t.after(async () => { for (const adapter of adapters) await adapter.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return { directory, runtimeRoot, storagePath, dataDir, tokenFile, execCalls, fetchCalls, controls, create };
}

test('persistent mode rejects unsupported platforms before touching files or starting commands', () => {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  try {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    assert.throws(() => createPersistentRuntime({ runtimeRoot: '/does-not-exist', storagePath: '/does-not-exist' }), error => error.code === 'PERSISTENT_RUNTIME_PLATFORM');
  } finally { Object.defineProperty(process, 'platform', descriptor); }
});

test('persistent start coalesces one fixed supervisor invocation and keeps credentials private', linux, async t => {
  const f = fixture(t), pythonPath = path.join(f.directory, 'chosen Python', 'python'), adapter = f.create({ pythonPath });
  const pending = Array.from({ length: 20 }, () => adapter.start()); assert.ok(pending.every(value => value === pending[0]));
  const connections = await Promise.all(pending); assert.equal(f.execCalls.length, 2); assert.equal(f.fetchCalls.length, 1);
  assert.deepEqual(f.execCalls[1].args, [path.join(f.runtimeRoot, 'deploy/tmux-runtime.mjs'), 'start', '--repo', f.runtimeRoot, '--data', f.dataDir, '--enable-host-control']);
  const settings = f.execCalls[1].settings;
  assert.equal(settings.shell, false); assert.equal(settings.maxBuffer, 65536); assert.equal(settings.env.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(settings.env.DAFTAR_PYTHON_PATH, pythonPath);
  for (const key of ['NODE_OPTIONS', 'OPENAI_API_KEY', 'GITHUB_TOKEN_FILE', 'SSH_AUTH_SOCK']) assert.equal(Object.hasOwn(settings.env, key), false);
  assert.equal(connections[0].controlToken, token); assert.equal(connections[0].kind, 'runtime');
  assert.equal(f.fetchCalls[0].url, 'http://127.0.0.1:8788/v1/status'); assert.equal(f.fetchCalls[0].init.headers.Authorization, `Bearer ${token}`);
  assert.equal(JSON.stringify(adapter.status()).includes(token), false); assert.equal(adapter.dataDir, f.dataDir);
  await adapter.close(); await adapter.close();
  assert.equal(adapter.status().state, 'detached'); assert.equal(adapter.status().daemonMayBeRunning, true);
  assert.equal(fs.readFileSync(f.tokenFile, 'utf8').trim(), token);
  assert.equal(f.execCalls.some(call => call.args.includes('stop') || call.args.includes('kill-session') || call.args.includes('--build')), false);
  assert.deepEqual(adapter.diagnostics(), { pendingOperations: 0, bootstrapTimer: false, retryTimer: false });
});

test('persistent Python selection rejects relative paths and does not inherit an ambient override', linux, async t => {
  const f = fixture(t);
  for (const pythonPath of ['python3', './.venv/bin/python', '/python\nother', null]) {
    assert.throws(() => f.create({ pythonPath }), error => error.code === 'PERSISTENT_RUNTIME_CONFIG');
  }
  const adapter = f.create(); await adapter.start();
  assert.equal(Object.hasOwn(f.execCalls[1].settings.env, 'DAFTAR_PYTHON_PATH'), false);
  await adapter.close();
});

test('readiness retries only authenticated reads and reconnect preserves authorized worker policy', linux, async t => {
  const f = fixture(t, { workerEnabled: true, mode: 'auto' });
  f.controls.fetch = async () => { if (f.controls.attempts < 3) throw new Error('Synthetic not listening yet'); };
  const adapter = f.create(); await adapter.start(); assert.equal(f.fetchCalls.length, 3); assert.equal(f.execCalls.length, 2);
  assert.ok(f.fetchCalls.every(call => call.init.method === 'GET' && call.init.redirect === 'error'));
  await adapter.close(); const reopened = f.create(); await reopened.start();
  assert.equal(f.execCalls.filter(call => call.args[1] === 'start').length, 2);
  assert.equal(reopened.status().state, 'ready'); assert.equal(f.execCalls.some(call => call.args.includes('stop')), false);
});

test('wrong credential or foreign supervisor identity never becomes ready and never repeats start', linux, async t => {
  for (const failure of ['credential', 'url', 'data', 'repo', 'token-path', 'redirect']) {
    const f = fixture(t);
    if (failure === 'credential') f.controls.fetch = async () => json({ ok: false, error: token }, 401);
    if (failure === 'url') f.controls.metadata.runtimeUrl = 'https://other.invalid:8788';
    if (failure === 'data') f.controls.metadata.dataDir = path.join(f.directory, 'other-data');
    if (failure === 'repo') f.controls.metadata.repoRoot = path.join(f.directory, 'other-package');
    if (failure === 'token-path') f.controls.metadata.controlTokenFile = path.join(f.directory, 'other-token');
    if (failure === 'redirect') f.controls.fetch = async () => ({ ok: true, status: 200, redirected: true, body: { cancel() {} } });
    const adapter = f.create();
    await assert.rejects(adapter.start(), error => /^PERSISTENT_RUNTIME_(IDENTITY|CREDENTIAL)$/.test(error.code) && !error.message.includes(token));
    assert.equal(f.execCalls.filter(call => call.args[1] === 'start').length, 1);
    assert.equal(f.fetchCalls.length, ['credential', 'redirect'].includes(failure) ? 1 : 0);
    await adapter.close(); assert.equal(fs.existsSync(f.tokenFile), true); assert.equal(f.execCalls.some(call => call.args.includes('stop')), false);
  }
});

test('unsafe or linked token files, old Node and tampered package are refused before authentication', linux, async t => {
  const permission = fixture(t, { tokenMode: 0o644 }); const adapter = permission.create();
  await assert.rejects(adapter.start(), error => error.code === 'PERSISTENT_RUNTIME_CREDENTIAL'); assert.equal(permission.fetchCalls.length, 0);
  const linked = fixture(t); fs.mkdirSync(path.dirname(linked.tokenFile), { recursive: true, mode: 0o700 });
  const outside = path.join(linked.directory, 'outside'); fs.writeFileSync(outside, token, { mode: 0o600 }); fs.symlinkSync(outside, linked.tokenFile);
  await assert.rejects(linked.create().start(), error => error.code === 'PERSISTENT_RUNTIME_CREDENTIAL'); assert.equal(linked.fetchCalls.length, 0);
  const old = fixture(t, { version: 'v20.19.0\n' }); await assert.rejects(old.create().start(), error => error.code === 'PERSISTENT_RUNTIME_NODE'); assert.equal(old.execCalls.length, 1);
  const altered = fixture(t); fs.appendFileSync(path.join(altered.runtimeRoot, 'deploy/tmux-runtime.mjs'), 'altered');
  await assert.rejects(altered.create().start(), error => error.code === 'LOCAL_RUNTIME_PACKAGE'); assert.equal(altered.execCalls.length, 0);
});

test('closing uncooperative bootstrap or readiness settles promptly without sending daemon stop', linux, async t => {
  for (const stage of ['bootstrap', 'fetch', 'reader']) {
    const f = fixture(t); let started = false, cancelled = 0, released = 0;
    if (stage === 'bootstrap') f.controls.exec = async args => { if (args[1] === 'start') { started = true; return new Promise(() => {}); } };
    if (stage === 'fetch') f.controls.fetch = async () => { started = true; return new Promise(() => {}); };
    if (stage === 'reader') f.controls.fetch = async () => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), body: {
      getReader: () => ({ read() { started = true; return new Promise(() => {}); }, cancel() { cancelled++; }, releaseLock() { released++; } }),
    } });
    const adapter = f.create(); const pending = adapter.start().catch(error => error); await until(() => started); await adapter.close();
    assert.match((await pending).code, /^PERSISTENT_RUNTIME_/); assert.equal(adapter.status().daemonMayBeRunning, true);
    assert.equal(f.execCalls.filter(call => call.args[1] === 'start').length, 1); assert.equal(f.execCalls.some(call => call.args.includes('stop')), false);
    if (stage === 'reader') { assert.equal(cancelled, 1); assert.equal(released, 1); }
    assert.deepEqual(adapter.diagnostics(), { pendingOperations: 0, bootstrapTimer: false, retryTimer: false });
  }
});

test('bootstrap deadline and oversized readiness fail without retrying any command', linux, async t => {
  const f = fixture(t); f.controls.fetch = async () => new Promise(() => {});
  const adapter = f.create({ startupTimeoutMs: 100 }); await assert.rejects(adapter.start(), error => error.code === 'PERSISTENT_RUNTIME_ABORTED');
  assert.equal(f.execCalls.length, 2); await adapter.close(); assert.deepEqual(adapter.diagnostics(), { pendingOperations: 0, bootstrapTimer: false, retryTimer: false });
  const oversized = fixture(t); oversized.controls.fetch = async () => json({ text: 'x'.repeat(65536) });
  await assert.rejects(oversized.create().start(), error => error.code === 'PERSISTENT_RUNTIME_IDENTITY'); assert.equal(oversized.fetchCalls.length, 1);
});

test('100 adapter start/detach cycles retain no bootstrap timers or operations and never stop the daemon', linux, async t => {
  const f = fixture(t);
  for (let count = 0; count < 100; count++) {
    const adapter = f.create(); await adapter.start(); await adapter.close();
    assert.deepEqual(adapter.diagnostics(), { pendingOperations: 0, bootstrapTimer: false, retryTimer: false });
  }
  assert.equal(f.execCalls.filter(call => call.args[1] === 'start').length, 100);
  assert.equal(f.execCalls.some(call => call.args.includes('stop') || call.args.includes('kill-server')), false);
});
