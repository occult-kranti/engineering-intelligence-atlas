import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { HeadlessCloudSync, createEncryptedCloudStorage } from '../cloud-sync.mjs';
import { createRuntime } from '../runtime.mjs';
import { configurationFromEnv } from '../server.mjs';
import { requireBuild } from './build-required.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const token = 'synthetic_device_token_for_vps_01234567890123456789';
const clientId = 'vps-fixture-device';
const binaryPath = path.join(repoRoot, 'native-core/target/release/atlas-core');
const compiled = path.join(repoRoot, 'desktop-shell/dist/main/cloudSync.js');

function files(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-headless-cloud-'));
  const stateDir = path.join(root, 'state'); fs.mkdirSync(stateDir, { mode: 0o700 });
  const keyFile = path.join(root, 'key'); fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  const pairingFile = path.join(root, 'pairing'); fs.writeFileSync(pairingFile, JSON.stringify({ deviceToken: token, clientId, siteAccessToken: '' }), { mode: 0o600 });
  const cleanup = []; t.after(async () => { for (const close of cleanup.reverse()) await close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, stateDir, keyFile, pairingFile, cleanup };
}

async function cloudServer(f) {
  const remote = { revision: 0, sourceClientId: null, snapshot: null, updatedAt: new Date().toISOString() };
  const data = { commands: [], acks: [], calls: [], writes: 0, revoked: false, failAck: false, failPutAck: false, holdWorkspace: null, reachedWorkspace: null, onClaim: null };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1'); data.calls.push(`${req.method} ${url.pathname}`);
    const send = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (data.revoked || req.headers.authorization !== `Bearer ${token}`) return send({ error: 'revoked' }, 401);
    const chunks = []; for await (const chunk of req) chunks.push(chunk); const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    if (url.pathname === '/api/session') return send({ signedIn: true, clientId, deviceId: clientId });
    if (url.pathname === '/api/workspace' && req.method === 'GET') { data.reachedWorkspace?.(); if (data.holdWorkspace) await data.holdWorkspace; return send(remote); }
    if (url.pathname === '/api/workspace/claim-writer') {
      if (body.expectedRevision !== remote.revision || (remote.sourceClientId && remote.sourceClientId !== clientId)) return send({ error: 'writer conflict' }, 409);
      remote.sourceClientId = clientId; data.onClaim?.(); return send(remote);
    }
    if (url.pathname === '/api/commands') return send({ commands: data.commands });
    if (/^\/api\/commands\/[^/]+\/ack$/.test(url.pathname)) {
      if (remote.sourceClientId !== clientId) return send({ error: 'not writer' }, 403);
      if (data.failAck) { data.failAck = false; res.destroy(); return; }
      data.acks.push(body); data.commands = data.commands.filter(command => !url.pathname.includes(`/${command.id}/`)); return send({ ok: true });
    }
    if (url.pathname === '/api/cloud-threads') return send({ messages: [], cursor: '', nextCursor: null });
    if (url.pathname === '/api/workspace' && req.method === 'PUT') {
      if (body.expectedRevision !== remote.revision || (remote.sourceClientId && remote.sourceClientId !== body.clientId)) return send({ error: 'conflict' }, 409);
      remote.revision++; remote.sourceClientId = body.clientId; remote.snapshot = body.snapshot; data.writes++;
      if (data.failPutAck) { data.failPutAck = false; res.destroy(); return; }
      return send(remote);
    }
    return send({ error: 'Unknown fixture route' }, 404);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  f.cleanup.push(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { url: `http://127.0.0.1:${server.address().port}`, data, remote };
}

function nativeAvailable(t) {
  return requireBuild(t, [binaryPath, compiled]);
}

test('AES-GCM file-key storage encrypts, authenticates origin and detects modified ciphertext', t => {
  const f = files(t); const storage = createEncryptedCloudStorage(f.keyFile, 'https://workspace.example');
  f.cleanup.push(() => storage.destroy());
  const plain = JSON.stringify({ deviceToken: token });
  const encrypted = storage.encryptString(plain);
  assert.equal(storage.getSelectedStorageBackend(), 'aes-256-gcm-file-key');
  assert.equal(encrypted.includes(Buffer.from(token)), false); assert.equal(storage.decryptString(encrypted), plain);
  assert.notDeepEqual(storage.encryptString(plain), encrypted);
  const tampered = Buffer.from(encrypted); tampered[tampered.length - 1] ^= 1;
  assert.throws(() => storage.decryptString(tampered), /authenticated/);
  const foreignOrigin = createEncryptedCloudStorage(f.keyFile, 'https://other.example');
  assert.throws(() => foreignOrigin.decryptString(encrypted), /authenticated/); foreignOrigin.destroy();
  storage.destroy(); assert.equal(storage.isEncryptionAvailable(), false); assert.throws(() => storage.encryptString(plain), /closed/);
});

test('cloud supervisor defaults off and rejects weak keys, symlinks, unsafe origins and rapid loops', async t => {
  const f = files(t); const disabled = new HeadlessCloudSync({ enabled: false }); disabled.start();
  assert.deepEqual(disabled.status(), { configured: false, connected: false, revision: null, error: null }); await disabled.close();
  const options = { enabled: true, url: 'https://workspace.example', stateDir: f.stateDir, keyFile: f.keyFile, pairingFile: f.pairingFile,
    CloudSyncService: class {}, snapshot: async () => ({}), command: async () => ({}), stateHash: () => '' };
  for (const url of ['http://cloud.example', 'https://user:pass@cloud.example', 'https://cloud.example/path', 'http://127.1:8788']) assert.throws(() => new HeadlessCloudSync({ ...options, url }));
  assert.throws(() => new HeadlessCloudSync({ ...options, intervalSeconds: 59 }));
  const insideKey = path.join(f.stateDir, 'key'); fs.copyFileSync(f.keyFile, insideKey); fs.chmodSync(insideKey, 0o600);
  assert.throws(() => new HeadlessCloudSync({ ...options, keyFile: insideKey }));
  fs.writeFileSync(f.keyFile, 'short'); assert.throws(() => createEncryptedCloudStorage(f.keyFile, options.url));
  fs.writeFileSync(f.keyFile, crypto.randomBytes(32).toString('hex'));
  const link = path.join(f.root, 'key-link'); fs.symlinkSync(f.keyFile, link); assert.throws(() => createEncryptedCloudStorage(link, options.url));
  if (process.platform !== 'win32') { fs.chmodSync(f.keyFile, 0o644); assert.throws(() => createEncryptedCloudStorage(f.keyFile, options.url)); }
  assert.equal(configurationFromEnv({}).cloudSyncEnabled, false);
  assert.equal(configurationFromEnv({ DAFTAR_CLOUD_SYNC: '1', DAFTAR_CLOUD_SYNC_INTERVAL_SECONDS: '120' }).cloudSyncIntervalSeconds, 120);
});

test('real native receipts survive a lost cloud acknowledgment; encrypted pairing persists without secret-bearing status', async t => {
  if (!nativeAvailable(t)) return;
  const f = files(t); const remote = await cloudServer(f);
  const { CloudSyncService, syncStateHash } = require(compiled); const { OfficeService } = require(path.join(repoRoot, 'desktop-shell/dist/main/office.js'));
  const office = new OfficeService({ userDataPath: f.stateDir, seedDir: path.join(repoRoot, 'company'), binaryPath });
  const options = { enabled: true, ...f, url: remote.url, CloudSyncService, stateHash: syncStateHash, snapshot: () => office.officeSnapshot(), command: input => office.officeCommand(input) };
  const sync = new HeadlessCloudSync(options); f.cleanup.push(() => sync.close());
  assert.equal((await sync.syncOnce()).ok, true); assert.equal(remote.remote.sourceClientId, clientId);
  remote.data.commands.push({ id: 'cloud-create-company', baseRevision: remote.remote.revision,
    command: { action: 'create_company', payload: { id: 'cloud-company', name: 'Cloud queued company' } } });
  remote.data.failAck = true;
  assert.equal((await sync.syncOnce()).ok, false);
  let local = (await office.officeSnapshot()).snapshot;
  assert.equal(local.companies.filter(row => row.id === 'cloud-company').length, 1);
  assert.equal(remote.data.acks.length, 0); assert.equal(remote.data.commands.length, 1);
  assert.equal((await sync.syncOnce()).ok, true);
  local = (await office.officeSnapshot()).snapshot;
  assert.equal(local.companies.filter(row => row.id === 'cloud-company').length, 1);
  assert.equal(local.remoteReceipts.filter(row => row.id === 'cloud-create-company').length, 1);
  assert.deepEqual(remote.data.acks, [{ ok: true }]);
  assert.equal(fs.readFileSync(path.join(f.stateDir, 'cloud/device.bin')).includes(Buffer.from(token)), false);
  assert.deepEqual(Object.keys(sync.status()).sort(), ['configured', 'connected', 'error', 'revision']);
  assert.doesNotMatch(JSON.stringify(sync.status()), /synthetic_device|siteAccess|http:|clientId/);
  await sync.close();
  const restarted = new HeadlessCloudSync(options); f.cleanup.push(() => restarted.close());
  assert.equal((await restarted.syncOnce()).ok, true); assert.equal(remote.data.acks.length, 1);
});

test('another writer, populated unmatched seed and revoked pairing preserve local and remote work', async t => {
  if (!nativeAvailable(t)) return;
  const f = files(t); const remote = await cloudServer(f); const { CloudSyncService, cloudSnapshot, syncStateHash } = require(compiled);
  const { OfficeService } = require(path.join(repoRoot, 'desktop-shell/dist/main/office.js'));
  const office = new OfficeService({ userDataPath: f.stateDir, seedDir: path.join(repoRoot, 'company'), binaryPath });
  const initial = (await office.officeSnapshot()).snapshot; const initialHash = syncStateHash(initial);
  remote.remote.revision = 3; remote.remote.snapshot = cloudSnapshot(initial); remote.remote.snapshot.companies[0].name = 'Existing remote work';
  const sync = new HeadlessCloudSync({ enabled: true, ...f, url: remote.url, CloudSyncService, stateHash: syncStateHash, snapshot: () => office.officeSnapshot(), command: input => office.officeCommand(input) });
  f.cleanup.push(() => sync.close());
  assert.equal((await sync.syncOnce()).ok, false); assert.equal(remote.data.writes, 0); assert.equal(syncStateHash((await office.officeSnapshot()).snapshot), initialHash);
  remote.remote.snapshot = cloudSnapshot(initial); remote.remote.sourceClientId = 'other-desktop';
  assert.equal((await sync.syncOnce()).ok, false); assert.equal(remote.data.writes, 0);
  remote.remote.sourceClientId = null; assert.equal((await sync.syncOnce()).ok, true);
  const revision = remote.remote.revision;
  remote.data.commands.push({ id: 'revoked-command', baseRevision: revision, command: { action: 'create_company', payload: { id: 'denied-company', name: 'Must not execute' } } });
  remote.data.revoked = true;
  assert.equal((await sync.syncOnce()).ok, false); assert.equal(remote.remote.revision, revision);
  assert.equal(remote.data.commands.length, 1); assert.equal(remote.data.acks.length, 0);
  assert.equal(syncStateHash((await office.officeSnapshot()).snapshot), initialHash);
  assert.equal(sync.status().connected, false); assert.match(sync.status().error, /needs review/);
});

test('a restored saved revision cannot overwrite different same-writer cloud work or acknowledge its queue', async t => {
  if (!nativeAvailable(t)) return;
  for (const remoteRevision of [9, 2]) await t.test(`remote revision ${remoteRevision}`, async child => {
    const f = files(child); const server = await cloudServer(f); const { CloudSyncService, syncStateHash } = require(compiled);
    const { OfficeService } = require(path.join(repoRoot, 'desktop-shell/dist/main/office.js'));
    const office = new OfficeService({ userDataPath: f.stateDir, seedDir: path.join(repoRoot, 'company'), binaryPath });
    let commandCalls = 0;
    const options = { enabled: true, ...f, url: server.url, CloudSyncService, stateHash: syncStateHash,
      snapshot: () => office.officeSnapshot(), command: input => { commandCalls++; return office.officeCommand(input); } };
    const sync = new HeadlessCloudSync(options); f.cleanup.push(() => sync.close());
    for (let i = 0; i < 4; i++) assert.equal((await sync.syncOnce()).ok, true);
    const beforeHash = syncStateHash((await office.officeSnapshot()).snapshot);
    await sync.close();
    server.remote.revision = remoteRevision; server.remote.snapshot.companies[0].name = 'Different cloud work from the same device';
    server.data.commands.push({ id: 'preserve-pending-command', baseRevision: remoteRevision,
      command: { action: 'create_company', payload: { id: 'must-remain-queued', name: 'Queued cloud company' } } });
    const remoteBefore = structuredClone(server.remote); server.data.calls.length = 0;
    const restored = new HeadlessCloudSync(options); f.cleanup.push(() => restored.close());
    assert.equal((await restored.syncOnce()).ok, false); assert.equal(restored.status().revision, 4);
    assert.deepEqual(server.remote, remoteBefore); assert.equal(server.data.writes, 4);
    assert.equal(commandCalls, 0); assert.equal(server.data.acks.length, 0); assert.equal(server.data.commands.length, 1);
    assert.deepEqual(server.data.calls, ['GET /api/session', 'GET /api/workspace']);
    assert.equal(syncStateHash((await office.officeSnapshot()).snapshot), beforeHash);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.stateDir, 'cloud/connection.json'), 'utf8')).revision, 4);
  });
});

test('a lost PUT acknowledgment recovers after restart only from the exact same-writer local projection', async t => {
  if (!nativeAvailable(t)) return;
  const f = files(t); const server = await cloudServer(f); const { CloudSyncService, syncStateHash } = require(compiled);
  const { OfficeService } = require(path.join(repoRoot, 'desktop-shell/dist/main/office.js'));
  const office = new OfficeService({ userDataPath: f.stateDir, seedDir: path.join(repoRoot, 'company'), binaryPath });
  const options = { enabled: true, ...f, url: server.url, CloudSyncService, stateHash: syncStateHash,
    snapshot: () => office.officeSnapshot(), command: input => office.officeCommand(input) };
  const sync = new HeadlessCloudSync(options); f.cleanup.push(() => sync.close());
  assert.equal((await sync.syncOnce()).ok, true);
  server.data.commands.push({ id: 'saved-before-response-lost', baseRevision: 1,
    command: { action: 'create_company', payload: { id: 'saved-cloud-company', name: 'Saved before response loss' } } });
  server.data.failPutAck = true;
  assert.equal((await sync.syncOnce()).ok, false); assert.equal(sync.status().revision, 1); assert.equal(server.remote.revision, 2);
  assert.equal(syncStateHash(server.remote.snapshot), syncStateHash((await office.officeSnapshot()).snapshot));
  await sync.close();
  const restored = new HeadlessCloudSync(options); f.cleanup.push(() => restored.close());
  assert.equal((await restored.syncOnce()).ok, true); assert.equal(restored.status().revision, 3);
  const local = (await office.officeSnapshot()).snapshot;
  assert.equal(local.companies.filter(row => row.id === 'saved-cloud-company').length, 1);
  assert.equal(local.remoteReceipts.filter(row => row.id === 'saved-before-response-lost').length, 1);
  assert.deepEqual(server.data.acks, [{ ok: true }]); assert.equal(server.data.commands.length, 0);
});

test('cold start never lets a reused same-writer pairing overwrite a legacy or mismatched snapshot', async t => {
  if (!nativeAvailable(t)) return;
  const f = files(t); const remote = await cloudServer(f); const { CloudSyncService, cloudSnapshot, syncStateHash } = require(compiled);
  const migrated = cloudSnapshot(JSON.parse(fs.readFileSync(path.join(repoRoot, 'company/preview-state.json'), 'utf8')).office);
  for (const company of migrated.companies) company.parentCompanyId = null;
  for (const department of migrated.departments) department.parentDepartmentId = null;
  const legacy = structuredClone(migrated);
  for (const company of legacy.companies) delete company.parentCompanyId;
  for (const department of legacy.departments) delete department.parentDepartmentId;
  assert.notEqual(syncStateHash(legacy), syncStateHash(migrated), 'Absent legacy fields and explicit null defaults are not hash-equivalent');
  remote.remote.revision = 3; remote.remote.sourceClientId = clientId; remote.remote.snapshot = legacy;
  const sync = new HeadlessCloudSync({ enabled: true, ...f, url: remote.url, CloudSyncService, stateHash: syncStateHash,
    snapshot: async () => ({ ok: true, snapshot: migrated }), command: async () => { throw new Error('No command should execute'); } });
  f.cleanup.push(() => sync.close());
  assert.equal((await sync.syncOnce()).ok, false); assert.equal(remote.data.writes, 0); assert.deepEqual(remote.remote.snapshot, legacy);
  remote.remote.snapshot = structuredClone(migrated); remote.remote.snapshot.companies[0].name = 'Different current work';
  assert.equal((await sync.syncOnce()).ok, false); assert.equal(remote.data.writes, 0);
  remote.remote.snapshot = structuredClone(migrated);
  assert.equal((await sync.syncOnce()).ok, true); assert.equal(remote.data.writes, 1);
});

function schemaSnapshots(cloudSnapshot) {
  const local = cloudSnapshot(JSON.parse(fs.readFileSync(path.join(repoRoot, 'company/preview-state.json'), 'utf8')).office);
  for (const company of local.companies) company.parentCompanyId = null;
  for (const department of local.departments) department.parentDepartmentId = null;
  if (!local.jobs.length) local.jobs.push({ id: 'schema-job', status: 'completed', usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } });
  const remote = structuredClone(local);
  for (const company of remote.companies) delete company.parentCompanyId;
  for (const department of remote.departments) delete department.parentDepartmentId;
  return { local, remote };
}

test('known-schema comparison accepts only absent parent null defaults with identical records and all other content', t => {
  if (!nativeAvailable(t)) return;
  const { cloudSnapshot, knownParentDefaultsMatch } = require(compiled);
  const pair = schemaSnapshots(cloudSnapshot);
  assert.equal(knownParentDefaultsMatch(pair.remote, pair.local), true);
  for (const edit of [
    state => { state.companies[0].parentCompanyId = state.companies[1]?.id ?? 'new-parent'; },
    state => { state.departments[0].parentDepartmentId = 'new-parent'; },
    state => { state.companies[0].name = 'New company content'; },
    state => { state.employees[0].status = state.employees[0].status === 'paused' ? 'active' : 'paused'; },
    state => { state.jobs[0].usage.costUsd = 99; },
    state => { state.companies.push({ ...state.companies[0], id: 'another-company' }); },
    state => { state.departments[0].id = 'different-department'; },
  ]) { const changed = structuredClone(pair.local); edit(changed); assert.equal(knownParentDefaultsMatch(pair.remote, changed), false); }
  assert.equal(Object.hasOwn(pair.remote.companies[0], 'parentCompanyId'), false, 'The comparator must not modify its source snapshot');
});

test('known null defaults migrate only with explicit opt-in, an empty queue and an unassigned writer', async t => {
  if (!nativeAvailable(t)) return;
  const { CloudSyncService, cloudSnapshot, syncStateHash, knownParentDefaultsMatch } = require(compiled);
  for (const scenario of [
    { name: 'default-off', enabled: false, writer: null, queued: false, accepted: false },
    { name: 'queued-command', enabled: true, writer: null, queued: true, accepted: false },
    { name: 'another-writer', enabled: true, writer: 'another-device', queued: false, accepted: false },
    { name: 'same-active-writer', enabled: true, writer: clientId, queued: false, accepted: false },
    { name: 'reviewed-release', enabled: true, writer: null, queued: false, accepted: true },
  ]) await t.test(scenario.name, async child => {
    const f = files(child); const server = await cloudServer(f); const pair = schemaSnapshots(cloudSnapshot); let commands = 0;
    server.remote.revision = 8; server.remote.sourceClientId = scenario.writer; server.remote.snapshot = pair.remote;
    if (scenario.queued) server.data.commands.push({ id: 'pending-change', baseRevision: 8, command: { action: 'pause_company', payload: { companyId: pair.local.companies[0].id } } });
    const sync = new HeadlessCloudSync({ enabled: true, ...f, url: server.url, CloudSyncService, stateHash: syncStateHash,
      allowKnownSchemaDefaults: scenario.enabled, knownParentDefaultsMatch, snapshot: async () => ({ ok: true, snapshot: pair.local }), command: async () => { commands++; throw new Error('Migration must not execute commands'); } });
    f.cleanup.push(() => sync.close());
    assert.equal((await sync.syncOnce()).ok, scenario.accepted); assert.equal(commands, 0);
    assert.equal(server.data.writes, scenario.accepted ? 1 : 0);
    assert.equal(server.data.acks.length, 0);
    if (scenario.accepted) { assert.deepEqual(server.remote.snapshot, pair.local); assert.equal(server.remote.revision, 9); assert.equal(server.data.calls.includes('GET /api/cloud-threads'), false); }
    else { assert.deepEqual(server.remote.snapshot, pair.remote); assert.equal(server.remote.sourceClientId, scenario.writer); }
  });
});

test('a command arriving after migration writer claim remains queued and prevents snapshot publication', async t => {
  if (!nativeAvailable(t)) return;
  const { CloudSyncService, cloudSnapshot, syncStateHash, knownParentDefaultsMatch } = require(compiled);
  const f = files(t); const server = await cloudServer(f); const pair = schemaSnapshots(cloudSnapshot);
  server.remote.revision = 8; server.remote.snapshot = pair.remote;
  server.data.onClaim = () => { server.data.commands.push({ id: 'new-queued-command', baseRevision: 8, command: { action: 'pause_company', payload: { companyId: pair.local.companies[0].id } } }); };
  const sync = new HeadlessCloudSync({ enabled: true, ...f, url: server.url, CloudSyncService, stateHash: syncStateHash,
    allowKnownSchemaDefaults: true, knownParentDefaultsMatch, snapshot: async () => ({ ok: true, snapshot: pair.local }), command: async () => { throw new Error('No command may execute'); } });
  f.cleanup.push(() => sync.close()); assert.equal((await sync.syncOnce()).ok, false);
  assert.equal(server.data.writes, 0); assert.equal(server.data.commands.length, 1); assert.equal(server.data.acks.length, 0); assert.deepEqual(server.remote.snapshot, pair.remote);
});

test('the first restored-base proof survives a native command commit and lost ACK across restart', async t => {
  if (!nativeAvailable(t)) return;
  const f = files(t); const remote = await cloudServer(f); const { CloudSyncService, cloudSnapshot, syncStateHash } = require(compiled);
  const { OfficeService } = require(path.join(repoRoot, 'desktop-shell/dist/main/office.js'));
  const office = new OfficeService({ userDataPath: f.stateDir, seedDir: path.join(repoRoot, 'company'), binaryPath });
  remote.remote.revision = 4; remote.remote.snapshot = cloudSnapshot((await office.officeSnapshot()).snapshot);
  remote.data.commands.push({ id: 'first-cloud-command', baseRevision: 4, command: { action: 'create_company', payload: { id: 'first-cloud-company', name: 'First sync queued command' } } });
  remote.data.failAck = true;
  const options = { enabled: true, ...f, url: remote.url, CloudSyncService, stateHash: syncStateHash, snapshot: () => office.officeSnapshot(), command: input => office.officeCommand(input) };
  const sync = new HeadlessCloudSync(options); f.cleanup.push(() => sync.close());
  assert.equal((await sync.syncOnce()).ok, false);
  assert.equal(fs.existsSync(path.join(f.stateDir, 'cloud/bootstrap.bin')), true);
  assert.equal((await office.officeSnapshot()).snapshot.companies.filter(row => row.id === 'first-cloud-company').length, 1);
  await sync.close(); const restored = new HeadlessCloudSync(options); f.cleanup.push(() => restored.close());
  remote.remote.revision = 5;
  assert.equal((await restored.syncOnce()).ok, false); assert.equal(remote.data.writes, 0); assert.equal(remote.data.acks.length, 0);
  remote.remote.revision = 4;
  const originalRemote = structuredClone(remote.remote.snapshot); remote.remote.snapshot.companies[0].name = 'Changed after the verified base';
  assert.equal((await restored.syncOnce()).ok, false); assert.equal(remote.data.writes, 0); assert.equal(remote.data.acks.length, 0);
  remote.remote.snapshot = originalRemote;
  assert.equal((await restored.syncOnce()).ok, true);
  assert.equal((await office.officeSnapshot()).snapshot.companies.filter(row => row.id === 'first-cloud-company').length, 1);
  assert.deepEqual(remote.data.acks, [{ ok: true }]); assert.equal(remote.remote.revision, 5);
  assert.equal(fs.existsSync(path.join(f.stateDir, 'cloud/bootstrap.bin')), false);
});

test('close aborts transport, awaits the active sync and stops later scheduling', async t => {
  if (!nativeAvailable(t)) return;
  const f = files(t); const remote = await cloudServer(f); const { CloudSyncService, syncStateHash } = require(compiled);
  const { OfficeService } = require(path.join(repoRoot, 'desktop-shell/dist/main/office.js'));
  const office = new OfficeService({ userDataPath: f.stateDir, seedDir: path.join(repoRoot, 'company'), binaryPath });
  remote.data.holdWorkspace = new Promise(() => {});
  const reached = new Promise(resolve => { remote.data.reachedWorkspace = resolve; });
  const sync = new HeadlessCloudSync({ enabled: true, ...f, url: remote.url, CloudSyncService, stateHash: syncStateHash, snapshot: () => office.officeSnapshot(), command: input => office.officeCommand(input) });
  f.cleanup.push(() => sync.close()); sync.start(); await reached; const pending = sync.pending;
  await sync.close(); assert.equal((await pending).ok, false); assert.equal(sync.pending, null); assert.equal(sync.timer, null);
  assert.equal(remote.data.writes, 0); assert.equal((await sync.syncOnce()).ok, false);
});

test('headless runtime opt-in starts cloud sync while its worker pool remains paused', async t => {
  if (!nativeAvailable(t)) return;
  const f = files(t); const remote = await cloudServer(f);
  const runtime = createRuntime({ repoRoot, binaryPath, dataDir: f.stateDir, cloudSyncEnabled: true, cloudUrl: remote.url,
    cloudPairingFile: f.pairingFile, cloudEncryptionKeyFile: f.keyFile, cloudSyncIntervalSeconds: 60 });
  f.cleanup.push(() => runtime.close()); await runtime.cloudSync.syncOnce();
  assert.equal(runtime.status().worker.enabled, false); assert.equal(runtime.status().cloud.configured, true);
  assert.equal(runtime.status().cloud.connected, true); assert.equal(runtime.status().capabilities.cloudSync, true);
  assert.doesNotMatch(JSON.stringify(runtime.status().cloud), /deviceToken|clientId|http:/);
});
