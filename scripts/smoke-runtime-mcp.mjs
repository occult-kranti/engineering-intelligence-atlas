#!/usr/bin/env node
/** Real Rust + HTTP daemon + stdio MCP, entirely synthetic and without model calls. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { startServer } from '../headless-runtime/server.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-mcp-native-'));
const token = crypto.randomBytes(32).toString('base64url');
const tokenFile = path.join(dataDir, 'control-token');
fs.writeFileSync(tokenFile, token + '\n', { mode: 0o600 });
const checks = [];
let service;
const clients = new Set();

function record(name) { checks.push({ name, passed: true }); }

function connect(origin) {
  const child = spawn(process.execPath, [path.join(repoRoot, 'tools/daftar-runtime-mcp.mjs')], {
    cwd: repoRoot,
    env: { ...process.env, DAFTAR_RUNTIME_URL: origin, DAFTAR_CONTROL_TOKEN_FILE: tokenFile },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  clients.add(child);
  let sequence = 0, buffer = '';
  const pending = new Map();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    if (Buffer.byteLength(buffer) > 1024 * 1024) child.kill('SIGTERM');
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      let message;
      try { message = JSON.parse(line); } catch { child.kill('SIGTERM'); continue; }
      const waiter = pending.get(message.id);
      if (waiter) { clearTimeout(waiter.timer); pending.delete(message.id); waiter.resolve(message); }
    }
  });
  // Never print stderr or credentials from a child in an integration receipt.
  child.stderr.resume();
  child.on('error', () => {
    for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('MCP subprocess could not start')); }
    pending.clear();
  });
  const exited = new Promise(resolve => child.once('exit', code => {
    clients.delete(child);
    for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('MCP exited before its response')); }
    pending.clear(); resolve(code);
  }));
  return {
    call(method, params) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('MCP integration request timed out')); }, 15000);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      });
    },
    async close() {
      child.stdin.end();
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      try { assert.equal(await exited, 0); } finally { clearTimeout(timer); }
    },
  };
}

async function tool(client, name, args = {}) {
  const result = await client.call('tools/call', { name, arguments: args });
  assert.equal(result.error, undefined);
  assert.equal(result.result?.isError, false);
  return result.result.structuredContent;
}

async function initialize(client) {
  const initialized = await client.call('initialize', { protocolVersion: '2025-11-25',
    capabilities: {}, clientInfo: { name: 'daftar-native-integration', version: '1' } });
  assert.equal(initialized.result.serverInfo.name, 'daftar-runtime');
}

try {
  service = await startServer({ repoRoot, dataDir, tokenFile, host: '127.0.0.1', port: 0 });
  let origin = `http://127.0.0.1:${service.server.address().port}`;
  const client = connect(origin);
  await initialize(client);
  const listed = await client.call('tools/list', {});
  assert.deepEqual(listed.result.tools.map(t => t.name).sort(),
    ['model_pool_cancel', 'model_pool_request', 'model_pool_select', 'model_pool_status', 'office_command', 'office_query', 'office_summary', 'runtime_status', 'worker_set_enabled']);
  record('MCP initializes and advertises the nine bounded runtime tools');

  const status = await tool(client, 'runtime_status');
  assert.equal(status.worker.enabled, false);
  assert.equal(status.capabilities.arbitraryCode, false);
  record('real headless runtime begins paused with honest capability metadata');

  const initial = await tool(client, 'office_summary');
  assert.match(initial.stateHash, /^[a-f0-9]{64}$/);
  const command = { id: 'mcp-native-create-company', expectedStateHash: initial.stateHash,
    command: { action: 'create_company', id: 'mcp-integration-company', name: 'MCP integration fixture' } };
  const applied = await tool(client, 'office_command', command);
  assert.equal(applied.operationSucceeded, true);
  assert.equal(applied.replayed, false);
  assert.equal(applied.snapshot, undefined);
  assert.equal(applied.summary.counts.companies, initial.summary.counts.companies + 1);
  record('stdio command crosses HTTP and commits through the real native core');

  const replayed = await tool(client, 'office_command', command);
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.summary.counts.companies, initial.summary.counts.companies + 1);
  record('same mutation receipt replays without a second company');

  const stale = await client.call('tools/call', { name: 'office_command', arguments: {
    ...command, id: 'mcp-native-stale', command: { action: 'create_company', id: 'must-not-exist', name: 'Stale' } } });
  assert.equal(stale.result.isError, true);
  assert.equal(stale.result.structuredContent.code, 'CONFLICT');
  record('stale state rejection survives all three transport boundaries');

  const queried = await tool(client, 'office_query', { collection: 'companies', search: 'mcp-integration-company', pageSize: 5 });
  assert.equal(queried.total, 1);
  assert.equal(queried.metadataOnly, true);
  assert.doesNotMatch(JSON.stringify(queried), /leaseToken|private-lease|artifactUri|control-token/);
  record('metadata query returns the new record without private execution fields');

  const denied = await client.call('tools/call', { name: 'office_command', arguments: {
    ...command, id: 'mcp-native-forbidden', command: { action: 'finish_job' } } });
  assert.equal(denied.error.code, -32602);
  record('MCP refuses internal worker settlement before dispatch');

  await client.close();
  const alive = await fetch(origin + '/v1/status', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(alive.status, 200);
  assert.equal((await alive.json()).execution, 'headless');
  record('daemon remains available after the stdio client disconnects');

  await service.close(); service = null;
  service = await startServer({ repoRoot, dataDir, tokenFile, host: '127.0.0.1', port: 0 });
  origin = `http://127.0.0.1:${service.server.address().port}`;
  const resumed = connect(origin);
  await initialize(resumed);
  const saved = await tool(resumed, 'office_command', command);
  assert.equal(saved.replayed, true);
  assert.equal(saved.summary.counts.companies, initial.summary.counts.companies + 1);
  assert.equal((await tool(resumed, 'runtime_status')).worker.enabled, false);
  await resumed.close();
  record('new daemon and MCP processes retain native receipts and start paused');

  const receipt = { ok: true, suite: 'real-native-http-stdio', checkedAt: new Date().toISOString(),
    checks, providerCalls: 0, infrastructureProvisioned: false, privateWorkspaceUsed: false };
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
} finally {
  for (const client of clients) client.kill('SIGTERM');
  if (service) await service.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
