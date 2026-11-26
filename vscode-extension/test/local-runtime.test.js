'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { pathToFileURL } = require('node:url');
const { createLocalRuntime, verifyRuntime, childEnvironment } = require('../src/local-runtime');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const repoRoot = path.resolve(__dirname, '../..');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-local-test-'));
  const runtimeRoot = path.join(directory, 'package'), storagePath = path.join(directory, 'storage');
  const corePath = `native-core/target/release/${process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core'}`;
  const files = {};
  for (const [relative, contents] of [['headless-runtime/server.mjs', '// synthetic fake-process test only'], [corePath, 'synthetic native fixture']]) {
    const file = path.join(runtimeRoot, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, contents);
    files[relative] = { bytes: Buffer.byteLength(contents), sha256: sha(contents) };
  }
  const manifest = { schemaVersion: 1, platform: process.platform, arch: process.arch, nodeMajorMinimum: 22,
    entrypoint: 'headless-runtime/server.mjs', corePath, files };
  fs.writeFileSync(path.join(runtimeRoot, 'manifest.json'), JSON.stringify(manifest));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, runtimeRoot, storagePath, manifest };
}

function fakeProcesses({ nodeVersion = 'v24.1.0', hangVersion = false, prematureExit = false } = {}) {
  const calls = []; let pid = 1000000;
  const spawnProcess = (file, args, options) => {
    const child = new EventEmitter(); child.pid = ++pid; child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.exitCode = null; child.signalCode = null; child.kills = []; child.done = false;
    child.finish = (code = 0, signal = null) => {
      if (child.done) return; child.done = true; child.exitCode = code; child.signalCode = signal;
      child.stdout.end(); child.stderr.end(); child.emit('exit', code, signal); child.emit('close', code, signal);
    };
    child.kill = signal => { child.kills.push(signal); queueMicrotask(() => child.finish(null, signal)); return true; };
    calls.push({ file, args, options, child });
    queueMicrotask(() => {
      if (args[0] === '--version') { if (!hangVersion) { child.stdout.write(nodeVersion + '\n'); child.finish(); } }
      else if (prematureExit) { child.stderr.write('synthetic private backend failure'); child.finish(1); }
      else { child.stdout.write('Daftar headless runtime listening on 127.'); child.stdout.write('0.0.1:45454; workers paused.\n'); }
    });
    return child;
  };
  return { calls, spawnProcess };
}
const ready = () => new Response(JSON.stringify({ ok: true, execution: 'headless', worker: { enabled: false }, capabilities: { workbench: true } }),
  { headers: { 'content-type': 'application/json' } });
function noResources(runtime, processes) {
  assert.deepEqual(runtime.diagnostics(), { children: 0, startupTimer: false, childListeners: 0 });
  for (const { child } of processes.calls) {
    assert.equal(child.eventNames().reduce((sum, event) => sum + child.listenerCount(event), 0), 0);
    assert.equal(child.stdout.listenerCount('data'), 0); assert.equal(child.stderr.listenerCount('data'), 0);
  }
}

test('launcher verifies package, probes Node, keeps owner credential private and starts paused on ephemeral loopback', async t => {
  const f = fixture(t), processes = fakeProcesses(); let request;
  const pythonPath = path.join(f.directory, 'chosen Python', 'python');
  const runtime = createLocalRuntime({ ...f, ...processes, pythonPath, environment: { PATH: '/synthetic/bin', OPENAI_API_KEY: 'never-inherited',
    ANTHROPIC_API_KEY_FILE: '/private/key', NODE_OPTIONS: '--inspect', SSH_AUTH_SOCK: '/agent.sock', DAFTAR_HOST: '0.0.0.0', DAFTAR_PYTHON_PATH: '/ambient/not-selected' },
    fetcher: async (url, options) => { request = { url, options }; return ready(); } });
  t.after(() => runtime.close());
  const first = runtime.start(), second = runtime.start(); assert.equal(first, second);
  const connection = await first;
  assert.equal(connection.kind, 'runtime'); assert.equal(connection.url, 'http://127.0.0.1:45454'); assert.match(connection.controlToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(request.options.headers.Authorization, `Bearer ${connection.controlToken}`); assert.equal(request.options.redirect, 'error');
  assert.equal(processes.calls.length, 2); const env = processes.calls[1].options.env;
  for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY_FILE', 'NODE_OPTIONS', 'SSH_AUTH_SOCK']) assert.equal(Object.hasOwn(env, key), false);
  assert.equal(env.DAFTAR_HOST, '127.0.0.1'); assert.equal(env.DAFTAR_PORT, '0'); assert.equal(env.DAFTAR_HOST_CONTROL, '0');
  assert.equal(env.DAFTAR_PYTHON_PATH, pythonPath);
  assert.equal(env.ELECTRON_RUN_AS_NODE, '1'); assert.equal(processes.calls[1].options.shell, false);
  assert.equal(fs.readFileSync(env.DAFTAR_CONTROL_TOKEN_FILE, 'utf8').trim(), connection.controlToken);
  if (process.platform !== 'win32') assert.equal(fs.statSync(env.DAFTAR_CONTROL_TOKEN_FILE).mode & 0o777, 0o600);
  assert.equal(JSON.stringify(runtime.status()).includes(connection.controlToken), false);
  await runtime.close(); await runtime.close(); noResources(runtime, processes);
  assert.equal(fs.existsSync(path.join(f.storagePath, 'runtime/launcher.lock')), false);
  assert.equal(fs.existsSync(env.DAFTAR_CONTROL_TOKEN_FILE), false);
  assert.deepEqual(processes.calls[0].child.kills, []); assert.deepEqual(processes.calls[1].child.kills, ['SIGTERM']);
  await assert.rejects(runtime.start(), error => error.code === 'LOCAL_RUNTIME_CLOSED');
});

test('Python selection is explicit and rejects relative paths or control characters before spawning', async t => {
  const f = fixture(t), processes = fakeProcesses();
  for (const pythonPath of ['python3', './.venv/bin/python', '/python\nother', null]) {
    assert.throws(() => createLocalRuntime({ ...f, ...processes, pythonPath }), error => error.code === 'LOCAL_RUNTIME_CONFIG');
  }
  const env = childEnvironment({ DAFTAR_PYTHON_PATH: '/ambient/not-selected' }, {
    runtimeRoot: f.runtimeRoot, dataDir: f.storagePath, tokenFile: path.join(f.directory, 'token'), corePath: f.manifest.corePath,
  });
  assert.equal(Object.hasOwn(env, 'DAFTAR_PYTHON_PATH'), false);
  assert.equal(processes.calls.length, 0);
});

test('100 independent reopen/start/close cycles leave no children, timers, listeners or stale lock', async t => {
  const f = fixture(t);
  for (let index = 0; index < 100; index++) {
    const processes = fakeProcesses(); const runtime = createLocalRuntime({ ...f, ...processes, fetcher: async () => ready() });
    await runtime.start(); await runtime.close(); noResources(runtime, processes);
    assert.equal(fs.existsSync(path.join(f.storagePath, 'runtime/launcher.lock')), false);
  }
});

test('Node versions below22, early exits and invalid authenticated health cannot become ready', async t => {
  for (const config of [{ nodeVersion: 'v20.19.0' }, { prematureExit: true }, { health: false }]) {
    const f = fixture(t), processes = fakeProcesses(config);
    const runtime = createLocalRuntime({ ...f, ...processes, fetcher: async () => config.health === false
      ? new Response('private credential text', { status: 401, headers: { 'content-type': 'application/json' } }) : ready() });
    await assert.rejects(runtime.start(), error => /^LOCAL_RUNTIME_/.test(error.code) && !/private|synthetic/.test(error.message));
    await runtime.close(); noResources(runtime, processes);
    assert.equal(fs.existsSync(path.join(f.storagePath, 'runtime/launcher.lock')), false);
  }
});

test('cancel, startup timeout and close during version probe stop only the owned child', async t => {
  for (const mode of ['cancel', 'timeout', 'close']) {
    const f = fixture(t), processes = fakeProcesses({ hangVersion: true }); const abort = new AbortController();
    const runtime = createLocalRuntime({ ...f, ...processes, startupTimeoutMs: 100, stopTimeoutMs: 20, fetcher: async () => ready() });
    const outcome = runtime.start({ signal: abort.signal }).catch(error => error);
    if (mode === 'cancel') abort.abort();
    if (mode === 'close') await runtime.close();
    assert.match((await outcome).code, /^LOCAL_RUNTIME_/); await runtime.close();
    assert.equal(processes.calls.length, 1); assert.ok(processes.calls[0].child.kills.includes('SIGTERM')); noResources(runtime, processes);
  }
});

test('package tampering, platform mismatch, links and live ownership prevent all process dispatch', async t => {
  const f = fixture(t); const processes = fakeProcesses();
  fs.appendFileSync(path.join(f.runtimeRoot, 'headless-runtime/server.mjs'), 'modified');
  const runtime = createLocalRuntime({ ...f, ...processes, fetcher: async () => ready() });
  await assert.rejects(runtime.start(), error => error.code === 'LOCAL_RUNTIME_PACKAGE'); assert.equal(processes.calls.length, 0); await runtime.close();
  fs.writeFileSync(path.join(f.runtimeRoot, 'manifest.json'), JSON.stringify({ ...f.manifest, arch: 'not-this-architecture' }));
  assert.throws(() => verifyRuntime(f.runtimeRoot), error => error.code === 'LOCAL_RUNTIME_PLATFORM');
  const second = fixture(t); fs.mkdirSync(path.join(second.storagePath, 'runtime'), { recursive: true });
  fs.writeFileSync(path.join(second.storagePath, 'runtime/launcher.lock'), JSON.stringify({ ownerPid: process.pid, nonce: 'another-live-owner' }));
  const busy = createLocalRuntime({ ...second, ...processes, fetcher: async () => ready() });
  await assert.rejects(busy.start(), error => error.code === 'LOCAL_RUNTIME_BUSY'); await busy.close();
  assert.equal(processes.calls.length, 0); assert.equal(fs.existsSync(path.join(second.storagePath, 'runtime/launcher.lock')), true);
  if (process.platform !== 'win32') {
    fs.unlinkSync(path.join(second.storagePath, 'runtime/launcher.lock'));
    const outside = path.join(second.directory, 'outside-token'); fs.writeFileSync(outside, 'preserve outside');
    fs.symlinkSync(outside, path.join(second.storagePath, 'runtime/control-token'));
    const linked = createLocalRuntime({ ...second, ...processes, fetcher: async () => ready() });
    await assert.rejects(linked.start()); await linked.close(); assert.equal(fs.readFileSync(outside, 'utf8'), 'preserve outside');
    assert.equal(processes.calls.length, 0);
  }
});

test('private storage checks preserve strict Unix modes and the explicit Windows directory-fsync fallback', async t => {
  const f = fixture(t);
  const { atomicJson, readPrivate } = await import(pathToFileURL(path.join(repoRoot, 'headless-runtime/host-control-contract.mjs')).href);
  const file = path.join(f.directory, 'private.json'); atomicJson(file, { private: true });
  assert.deepEqual(JSON.parse(readPrivate(file, 100)), { private: true });
  if (process.platform !== 'win32') {
    fs.chmodSync(file, 0o666); assert.throws(() => readPrivate(file, 100), /permissions/);
    const platform = Object.getOwnPropertyDescriptor(process, 'platform'); const open = fs.openSync;
    try {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      assert.deepEqual(JSON.parse(readPrivate(file, 100)), { private: true });
      fs.openSync = (name, flags, ...rest) => { if (name === f.directory) throw new Error('Windows cannot fsync a directory'); return open(name, flags, ...rest); };
      atomicJson(file, { windowsFallback: true });
      assert.deepEqual(JSON.parse(readPrivate(file, 100)), { windowsFallback: true });
      const link = path.join(f.directory, 'link.json'); fs.symlinkSync(file, link); assert.throws(() => readPrivate(link, 100), /regular/);
    } finally { fs.openSync = open; Object.defineProperty(process, 'platform', platform); }
  }
});

test('redirected or oversized readiness responses are cancelled and cannot expose a connection', async t => {
  for (const oversized of [false, true]) {
    const f = fixture(t), processes = fakeProcesses(); let cancelled = false;
    const response = { ok: true, redirected: !oversized, headers: new Headers({ 'content-type': 'application/json' }),
      body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(66000)); }, cancel() { cancelled = true; } }) };
    const runtime = createLocalRuntime({ ...f, ...processes, fetcher: async () => response });
    await assert.rejects(runtime.start(), error => error.code === 'LOCAL_RUNTIME_HEALTH');
    await runtime.close(); assert.equal(cancelled, true); noResources(runtime, processes);
  }
});

test('unconfirmed child termination retains its ownership lock and blocks a duplicate launcher', async t => {
  const f = fixture(t), processes = fakeProcesses();
  const runtime = createLocalRuntime({ ...f, ...processes, stopTimeoutMs: 10, fetcher: async () => ready() });
  await runtime.start(); const child = processes.calls[1].child;
  child.kill = signal => { child.kills.push(signal); return false; };
  await assert.rejects(runtime.close(), error => error.code === 'LOCAL_RUNTIME_STOP_UNCONFIRMED');
  assert.deepEqual(child.kills, ['SIGTERM', 'SIGKILL']);
  assert.equal(fs.existsSync(path.join(f.storagePath, 'runtime/launcher.lock')), true);
  const blocked = createLocalRuntime({ ...f, ...processes, fetcher: async () => ready() });
  await assert.rejects(blocked.start(), error => error.code === 'LOCAL_RUNTIME_BUSY'); await blocked.close();
  assert.equal(processes.calls.length, 2); child.finish();
});

test('actual packaged runtime starts independently, authenticates native owner mutation and disposes cleanly', async t => {
  const runtimeRoot = path.join(repoRoot, 'vscode-extension/resources/runtime');
  if (!fs.existsSync(path.join(runtimeRoot, 'manifest.json'))) {
    if (process.env.DAFTAR_REQUIRE_LOCAL_RUNTIME === '1') assert.fail('Build the portable runtime before this required acceptance gate.');
    return t.skip('Run node vscode-extension/scripts/build-runtime.mjs for actual packaged-runtime acceptance.');
  }
  const storagePath = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-local-native-'));
  const runtime = createLocalRuntime({ runtimeRoot, storagePath });
  t.after(async () => { await runtime.close(); fs.rmSync(storagePath, { recursive: true, force: true }); });
  const connection = await runtime.start();
  const headers = { Authorization: `Bearer ${connection.controlToken}`, 'Content-Type': 'application/json' };
  const snapshot = await (await fetch(connection.url + '/v1/office', { headers })).json(); assert.equal(snapshot.ok, true);
  const response = await fetch(connection.url + '/v1/workbench/call', { method: 'POST', headers,
    body: JSON.stringify({ id: 'packaged-native-owner', method: 'officeCommand', args: [{ expectedStateHash: snapshot.stateHash,
      command: { action: 'create_company', id: 'packaged-native-company', name: 'Packaged native acceptance' } }] }) });
  const result = await response.json(); assert.equal(response.status, 200); assert.equal(result.result.ok, true);
  assert.ok(result.result.snapshot.companies.some(company => company.id === 'packaged-native-company'));
  assert.equal((await fetch(connection.url + '/v1/workbench')).status, 401);
  const manifest = verifyRuntime(runtimeRoot);
  assert.equal(Object.keys(manifest.files).some(file => /node_modules|\.env|\.key|control-token|electron(?:\/|\.js$)/.test(file)), false);
  const vault = await (await fetch(connection.url + '/v1/workbench/call', { method: 'POST', headers,
    body: JSON.stringify({ method: 'getVaultStatus', args: [] }) })).json();
  assert.equal(vault.result.osKeychain, false);
  await runtime.close(); assert.deepEqual(runtime.diagnostics(), { children: 0, startupTimer: false, childListeners: 0 });
});
