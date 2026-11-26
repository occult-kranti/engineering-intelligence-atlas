'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { AtlasClient, MAX_REQUEST } = require('../src/client');
const { RuntimeClient } = require('../src/runtime-client');

const SECRET_KEY = 'atlas.office.connection.v1';
const VAST_KEY = 'daftar.compute.vast.api-key';
const token = 'synthetic_owner_runtime_credential_1234567890123';
const connection = { kind: 'runtime', url: 'http://127.0.0.1:18788', controlToken: token };
const cloud = { kind: 'cloud', url: 'https://workspace.invalid', deviceToken: 'synthetic_device_key_1234567890' };
const hash = 'a'.repeat(64), nextHash = 'b'.repeat(64);
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const turn = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) { for (let count = 0; count < 40; count++) { if (predicate()) return; await turn(); } assert.fail('Expected mocked integration operation to reach its boundary.'); }

function harness(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-activation-'));
  const commands = new Map(), inputs = [], picks = [], errors = [], notices = [], clipboard = [], outgoing = [];
  const clients = [], panels = [], tunnels = [], launchers = [], subscriptions = [], intervals = new Map(), requests = [];
  const secrets = new Map(options.connection ? [[SECRET_KEY, JSON.stringify(options.connection)]] : []); const globals = new Map();
  const controls = { inputs, picks, requests, storeGate: null, storeStarted: false, fileGate: null, fetch: null, vastCalls: 0,
    instances: [{ id: 61877512, actual_status: 'stopped', gpu_name: 'Unverified metadata' }] };
  const disposable = callback => { const value = { disposed: false, dispose() { if (!value.disposed) { value.disposed = true; return callback?.(); } } }; subscriptions.push(value); return value; };
  const uri = value => ({ fsPath: value, toString: () => value });
  const vscode = {
    StatusBarAlignment: { Left: 1 }, ProgressLocation: { Notification: 1 }, ViewColumn: { Active: 1 },
    Uri: { joinPath: (root, ...parts) => uri(path.join(root.fsPath, ...parts)), parse: uri },
    env: { remoteName: options.remoteName, clipboard: { async writeText(value) { clipboard.push(value); } }, async openExternal() { return true; } },
    workspace: { isTrusted: options.trusted !== false, getConfiguration: () => ({ get: (key, fallback) => options.configuration?.[key] ?? fallback }), fs: {
      async stat() { return { size: 40 }; }, async readFile() { return Buffer.from('synthetic_provider_key_12345'); },
    } },
    commands: { registerCommand(name, callback) { commands.set(name, callback); return disposable(() => commands.delete(name)); },
      executeCommand(name, ...args) { return commands.get(name)?.(...args); } },
    window: {
      createStatusBarItem() { return Object.assign(disposable(), { show() {} }); },
      registerWebviewViewProvider(_name, value) { controls.viewProvider = value; return disposable(); },
      async showInputBox(spec) { controls.inputCount = (controls.inputCount ?? 0) + 1; const value = inputs.shift(); return typeof value === 'function' ? value(spec) : value; },
      async showQuickPick(items, spec) { const value = picks.shift(); return typeof value === 'function' ? value(items, spec) : value; },
      async showErrorMessage(value) { errors.push(value); }, async showInformationMessage(value) { notices.push(value); },
      async showOpenDialog() { return controls.fileGate ? controls.fileGate.promise : []; },
      async withProgress(_options, callback) { return callback({}, { onCancellationRequested: () => disposable() }); },
    },
  };
  const context = { subscriptions: [], extensionPath: path.resolve(__dirname, '..'), extensionUri: uri(path.resolve(__dirname, '..')),
    globalStorageUri: uri(directory), secrets: {
      async get(key) { return secrets.get(key); }, async store(key, value) { if (key === SECRET_KEY && controls.storeGate) { controls.storeStarted = true; await controls.storeGate.promise; } secrets.set(key, value); },
      async delete(key) { secrets.delete(key); },
    }, globalState: { get: (key, fallback) => globals.get(key) ?? fallback, async update(key, value) { globals.set(key, value); } } };
  class ObservedRuntime extends RuntimeClient { constructor(...args) { super(...args); clients.push(this); } }
  class ObservedAtlas extends AtlasClient { constructor(...args) { super(...args); clients.push(this); } }
  class ComputeConnection {
    constructor() { this.closed = false; tunnels.push(this); }
    async connect(profile) { this.profile = profile; return { runtimeUrl: connection.url }; }
    async close() { this.closed = true; }
  }
  const createOfficePanel = (_vscode, _context, bridge) => {
    assert.equal(typeof bridge.connectionInfo, 'function'); assert.equal(typeof bridge.call, 'function');
    const panel = { bridge, disposed: false, visible: true, reveals: 0, reveal() { this.reveals++; },
      dispose() { this.disposed = true; }, isDisposed() { return this.disposed; }, isVisible() { return !this.disposed && this.visible; },
      notifyConnection(value) { outgoing.push({ type: 'connection', value: structuredClone(value) }); },
      postEvent(type, value) { outgoing.push({ type, value: structuredClone(value) }); } };
    panels.push(panel); return panel;
  };
  const createLocalRuntime = config => { const value = { config, closed: false, async start() { return { ...connection }; }, async close() { this.closed = true; } }; launchers.push(value); return value; };
  const originalLoad = Module._load, originalFetch = globalThis.fetch, originalSetInterval = globalThis.setInterval, originalClearInterval = globalThis.clearInterval;
  let intervalId = 0;
  globalThis.setInterval = callback => { const id = ++intervalId; intervals.set(id, callback); return id; };
  globalThis.clearInterval = id => intervals.delete(id);
  globalThis.fetch = async (url, init = {}) => {
    const record = { url, init, body: init.body ? JSON.parse(init.body) : null }; requests.push(record);
    if (controls.fetch) { const custom = await controls.fetch(record); if (custom !== undefined) return custom; }
    if (url.endsWith('/v1/office')) return response({ ok: true, stateHash: hash, snapshot: { companies: [{ id: 'acme', status: 'active' }], jobs: [] } });
    if (url.endsWith('/v1/workbench')) return response({ ok: true, workbench: { methods: { officeCommand: { available: true, mutates: true }, getJobStatus: { available: true } } } });
    if (url.endsWith('/v1/status')) return response({ ok: true, execution: 'headless', worker: { enabled: false }, capabilities: { workbench: true } });
    if (url.endsWith('/v1/workbench/call')) {
      let result = { ok: true };
      if (record.body.method === 'officeCommand') result = { ok: true, stateHash: nextHash, snapshot: { companies: [{ id: 'acme' }] } };
      if (record.body.method === 'getJobStatus') result = [{ id: 'job-a', status: 'running' }];
      if (record.body.method === 'listRuns') result = [{ id: 'run-a', status: 'running' }];
      return response({ ok: true, id: record.body.id, result });
    }
    throw new Error('Unexpected mocked integration route.');
  };
  const extensionFile = require.resolve('../src/extension');
  Module._load = function(request, parent, isMain) {
    if (request === 'vscode') return vscode;
    if (parent?.filename === extensionFile) {
      if (request === './client') return { ...require('../src/client'), AtlasClient: ObservedAtlas };
      if (request === './runtime-client') return { RuntimeClient: ObservedRuntime };
      if (request === './workbench-panel') return { createOfficePanel };
      if (request === './local-runtime') return { createLocalRuntime };
      if (request === './compute-office') return { createComputeOffice: bridge => { controls.computeBridge = bridge; return { async menu() {}, async hireOperator() {} }; } };
      if (request === './compute-connection') return { ComputeConnection, validateProfile: value => value,
        async fetchVastInstances() { controls.vastCalls++; return { instances: controls.instances }; } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[extensionFile];
  let api; try { api = require(extensionFile).activate(context); } finally { Module._load = originalLoad; }
  let cleaned = false;
  async function cleanup() {
    if (cleaned) return; cleaned = true;
    for (const item of [...context.subscriptions].reverse()) await item.dispose();
    await turn();
    globalThis.fetch = originalFetch; globalThis.setInterval = originalSetInterval; globalThis.clearInterval = originalClearInterval;
    delete require.cache[extensionFile]; fs.rmSync(directory, { recursive: true, force: true });
  }
  t.after(cleanup);
  return { api, vscode, context, controls, commands, panels, clients, launchers, tunnels, secrets, globals, clipboard, outgoing, errors, notices,
    subscriptions, intervals, cleanup, async command(name) { return commands.get(name)(); }, tick() { for (const callback of intervals.values()) callback(); } };
}

test('fresh offline profile activates without a runtime, SSH, provider request, or invented company', async t => {
  const h = harness(t); await turn();
  assert.equal(h.api.connectionInfo().connected, false); assert.equal(h.api.connectionInfo().configured, false);
  await h.command('atlas.openOffice'); await turn();
  assert.equal(h.panels.length, 1); assert.equal(h.controls.requests.length, 0); assert.equal(h.launchers.length, 0); assert.equal(h.tunnels.length, 0);
  h.panels[0].dispose(); await h.command('atlas.openOffice'); assert.equal(h.panels.length, 2);
  await h.cleanup(); assert.equal(h.intervals.size, 0); assert.ok(h.subscriptions.every(item => item.disposed)); assert.ok(h.panels.every(item => item.disposed));
});

test('actual runtime client is cached, refreshes coalesce, and native CAS identity survives bridge dispatch', async t => {
  const h = harness(t); h.controls.inputs.push(connection.url, token);
  await h.command('atlas.connectRuntime'); await until(() => h.api.connectionInfo().connected);
  assert.equal(h.clients.length, 1); const client = h.clients[0];
  const panel = h.panels[0]; const result = await panel.bridge.call('officeCommand', [{ action: 'pause_company', companyId: 'acme' }], { id: 'fixed-owner-intent' });
  assert.equal(result.stateHash, nextHash);
  const sent = h.controls.requests.find(item => item.body?.id === 'fixed-owner-intent');
  assert.deepEqual(sent.body.args, [{ expectedStateHash: hash, command: { action: 'pause_company', companyId: 'acme' } }]);
  await turn(); const gate = deferred(); let reads = 0;
  h.controls.fetch = async item => { if (item.url.endsWith('/v1/office')) { reads++; await gate.promise; } };
  const readsInFlight = Array.from({ length: 25 }, () => h.api.refresh()); await until(() => reads === 1);
  assert.equal(h.clients[0], client); gate.resolve(); await Promise.all(readsInFlight); assert.equal(reads, 1);
  assert.equal(JSON.stringify(h.outgoing).includes(token), false);
  await h.command('atlas.copyMcpConfig'); const config = JSON.parse(h.clipboard[0]);
  assert.equal(h.clipboard[0].includes(token), false); assert.equal(config.servers.daftar.env.DAFTAR_RUNTIME_URL, connection.url);
  assert.equal(fs.readFileSync(config.servers.daftar.env.DAFTAR_CONTROL_TOKEN_FILE, 'utf8').trim(), token);
  await h.cleanup(); assert.equal(client.closed, true); assert.equal(client.controllers.size, 0);
});

test('stopped Vast instance is saved from metadata without creating SSH or starting compute', async t => {
  const h = harness(t); h.secrets.set(VAST_KEY, 'synthetic_vast_api_key_1234567890');
  h.controls.picks.push(items => items.find(item => item.action === 'vast'), items => items[0]);
  await h.command('atlas.connectCompute');
  assert.equal(h.controls.vastCalls, 1); assert.equal(h.tunnels.length, 0); assert.equal(h.launchers.length, 0); assert.equal(h.controls.requests.length, 0);
  assert.equal(h.api.connectionInfo().configured, false);
  const saved = h.globals.get('daftar.compute.profiles.v1'); assert.equal(saved[0].status, 'stopped'); assert.equal(saved[0].metadata.gpuVerified, false);
  assert.equal(JSON.stringify(h.outgoing).includes('synthetic_vast_api_key'), false);
});

test('disconnect fences a pending connection secret write and prevents later restoration', async t => {
  const h = harness(t); const gate = deferred(); h.controls.storeGate = gate;
  h.controls.inputs.push(connection.url, token); const setup = h.command('atlas.connectRuntime');
  await until(() => h.controls.storeStarted); const disconnected = h.command('atlas.disconnect');
  await turn(); gate.resolve(); await Promise.all([setup, disconnected]);
  assert.equal(h.secrets.has(SECRET_KEY), false); assert.equal(h.api.connectionInfo().configured, false); assert.equal(h.api.connectionInfo().connected, false);
  assert.ok(h.clients.every(client => client.closed));
});

test('disconnect while connection picker is open invalidates its eventual answer', async t => {
  const h = harness(t); const gate = deferred(); h.controls.inputs.push(gate.promise, token);
  const setup = h.command('atlas.connectRuntime'); await until(() => h.controls.inputCount === 1);
  await h.command('atlas.disconnect'); gate.resolve(connection.url); await setup;
  assert.equal(h.controls.requests.length, 0); assert.equal(h.clients.length, 0); assert.equal(h.api.connectionInfo().configured, false);
  assert.equal(h.secrets.has(SECRET_KEY), false);
});

test('credential import is bound to its original owner connection while a file dialog waits', async t => {
  const h = harness(t, { connection }); await h.command('atlas.openOffice'); await until(() => h.api.connectionInfo().connected);
  h.controls.fileGate = deferred();
  const pending = h.panels[0].bridge.call('importCredentialFile', ['anthropic']).catch(error => error);
  await turn(); await h.command('atlas.disconnect');
  h.controls.inputs.push(connection.url, 'synthetic_second_owner_credential_1234567890123'); await h.command('atlas.connectRuntime');
  h.controls.fileGate.resolve([{ fsPath: '/synthetic/key' }]); const result = await pending;
  assert.match(result.message, /connection changed/); assert.equal(h.controls.requests.some(item => item.body?.method === 'setApiKey'), false);
});

test('poll requests do not overlap and old successful results cannot cross a connection epoch', async t => {
  const h = harness(t, { connection }); await h.command('atlas.openOffice'); await until(() => h.api.connectionInfo().connected);
  const gate = deferred(); let jobs = 0, runs = 0;
  h.controls.fetch = async item => {
    if (item.body?.method === 'getJobStatus') { jobs++; return response({ ok: true, id: item.body.id, result: [{ id: 'old-owner-job' }] }); }
    if (item.body?.method === 'listRuns') { runs++; await gate.promise; }
  };
  h.tick(); await until(() => jobs === 1 && runs === 1); for (let count = 0; count < 20; count++) h.tick();
  assert.equal(jobs, 1); assert.equal(runs, 1);
  // Make the successful job result finish before changing the connection while
  // the independent run read remains pending.
  await until(() => h.clients[0].controllers.size === 1); await turn();
  await h.command('atlas.disconnect'); gate.resolve(); await turn(); await turn();
  assert.equal(h.outgoing.some(item => item.type === 'job' && item.value.id === 'old-owner-job'), false);
});

test('activation disposal cancels owned clients, panel, launcher and all subscriptions', async t => {
  const pythonPath = path.resolve(os.tmpdir(), 'selected-venv', 'bin', 'python');
  const h = harness(t, { remoteName: 'ssh-remote', configuration: { pythonPath } }); await h.command('atlas.startLocalRuntime'); await until(() => h.api.connectionInfo().connected);
  assert.equal(h.launchers.length, 1); assert.match(h.api.connectionInfo().location, /Remote extension host/);
  assert.equal(h.launchers[0].config.pythonPath, pythonPath);
  await h.cleanup(); assert.equal(h.intervals.size, 0); assert.ok(h.clients.every(client => client.closed));
  assert.ok(h.panels.every(panel => panel.disposed)); assert.ok(h.launchers.every(launcher => launcher.closed)); assert.ok(h.subscriptions.every(item => item.disposed));
});

test('legacy clients abort uncooperative fetch/read adapters and release bounded request state', async () => {
  const client = new AtlasClient(cloud, async () => new Promise(() => {}));
  const requests = Array.from({ length: 32 }, () => client.snapshot().catch(error => error));
  await assert.rejects(client.snapshot(), /capacity/); await turn(); client.close();
  const failures = await Promise.all(requests); assert.ok(failures.every(error => error instanceof Error)); assert.equal(client.controllers.size, 0); assert.equal(client.connection, null);
  await assert.rejects(client.snapshot(), /closed/);
  let cancelled = 0, released = 0;
  const reader = { read: async () => new Promise(() => {}), cancel() { cancelled++; return Promise.resolve(); }, releaseLock() { released++; } };
  const streaming = new AtlasClient(cloud, async () => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), body: { getReader: () => reader } }));
  const pending = streaming.snapshot().catch(error => error); await turn(); streaming.close(); await pending;
  assert.equal(cancelled, 1); assert.equal(released, 1); assert.equal(streaming.controllers.size, 0);
});

test('legacy route/body limits run before credentials leave and server errors never echo secrets', async () => {
  let calls = 0;
  const client = new AtlasClient(cloud, async () => { calls++; return response({ ok: false, error: cloud.deviceToken }); });
  await assert.rejects(client.request('//other.invalid/api/session'), /endpoint/);
  await assert.rejects(client.request('/api/commands', 'POST', { content: 'x'.repeat(MAX_REQUEST) }), /256 KiB/); assert.equal(calls, 0);
  await assert.rejects(client.snapshot(), error => !error.message.includes(cloud.deviceToken)); assert.equal(calls, 1); client.close();
  let cancelled = false; const gate = deferred();
  const late = new AtlasClient(cloud, async () => gate.promise); const request = late.snapshot().catch(error => error); await turn(); late.close(); await request;
  gate.resolve({ body: { cancel() { cancelled = true; } } }); await turn(); assert.equal(cancelled, true);
});

test('100 legacy client request/close cycles retain no controllers or credential objects', async () => {
  for (let count = 0; count < 100; count++) {
    const client = new AtlasClient(cloud, async () => response({ revision: count, snapshot: { companies: [] } }));
    await client.snapshot(); assert.equal(client.controllers.size, 0); client.close(); assert.equal(client.connection, null);
  }
});
test('website canvas preserves queued state and shows only confirmed scoped chat replies', async t => {
  const h = harness(t, { connection: cloud });
  const snapshot = { companies: [{ id: 'acme', name: 'Acme' }], activeCompanyId: 'acme', chatThreads: [] };
  h.controls.fetch = async record => {
    if (record.url.endsWith('/api/workspace')) return response({ revision: 4, snapshot });
    if (record.url.endsWith('/api/commands')) return response({ ok: true, commandId: 'queued-command', status: 'queued' });
    if (record.url.endsWith('/api/chat')) return response({ ok: true, jobId: 'confirmed-cloud-receipt', reply: 'Confirmed synthetic reply.', usage: { inputTokens: 2, outputTokens: 3 } });
  };
  await h.command('atlas.openOffice'); await until(() => h.api.connectionInfo().connected);
  const panel = h.panels[0]; const before = h.controls.requests.length;
  const queued = await panel.bridge.call('officeCommand', [{ action: 'pause_company', companyId: 'acme' }]);
  assert.equal(queued.queued, true); assert.equal(queued.commandId, 'queued-command'); assert.deepEqual(queued.snapshot, snapshot);
  assert.equal(h.controls.requests.length, before + 1, 'No post-mutation read can turn a queued receipt into an apparent failure');
  const chat = await panel.bridge.call('sendCloudChat', [{ scope: { kind: 'company', id: 'acme' }, message: 'Synthetic brief.', idempotencyKey: 'unique-chat-request' }]);
  assert.equal(chat.reply, 'Confirmed synthetic reply.'); assert.equal(chat.snapshot.chatThreads[0].messages.length, 2);
  assert.equal(chat.snapshot.chatThreads[0].messages[1].source, 'cloud-receipt');
  assert.ok(!JSON.stringify(h.outgoing).includes(cloud.deviceToken));
});
