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
const hostEnabled = process.env.DAFTAR_REQUIRE_TMUX === '1';
let hostRequest;
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
  service = await startServer({ repoRoot, dataDir, tokenFile, host: '127.0.0.1', port: 0, hostControlEnabled: hostEnabled });
  let origin = `http://127.0.0.1:${service.server.address().port}`;
  const client = connect(origin);
  await initialize(client);
  const listed = await client.call('tools/list', {});
  assert.deepEqual(listed.result.tools.map(t => t.name).sort(),
    ['creative_assign', 'creative_cancel', 'creative_inventory', 'creative_job', 'creative_run', 'activity_query', 'activity_status', 'activity_summarize', 'design_catalog', 'design_plan', 'design_install', 'design_inspect', 'environment_inspect', 'environment_prepare', 'environment_run', 'environment_status', 'resource_cancel', 'resource_configure', 'resource_inspect', 'resource_plan', 'resource_resolve', 'resource_start', 'resource_status', 'host_approve', 'host_cancel', 'host_configure', 'host_god_mode', 'host_inspect', 'host_status', 'host_stop_all', 'host_submit',
      'model_pool_cancel', 'model_pool_request', 'model_pool_select', 'model_pool_status', 'office_command', 'office_query', 'office_summary', 'runtime_status', 'worker_set_enabled'].sort());
  record(`MCP initializes and advertises exactly ${listed.result.tools.length} reviewed office, creative, compute and activity tools`);

  const status = await tool(client, 'runtime_status');
  assert.equal(status.worker.enabled, false);
  assert.equal(status.capabilities.arbitraryCode, hostEnabled);
  assert.equal(status.host.mode, 'off');
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

  const creative = await tool(client, 'creative_inventory', { companyId: 'mcp-integration-company' });
  assert.equal(creative.configured, false);
  assert.equal(creative.tools.length, 5);
  assert.ok(creative.tools.every(adapter => adapter.available === false));
  assert.deepEqual(creative.jobs, []);
  assert.doesNotMatch(JSON.stringify(creative), /control-token|executable|stateDir/);
  record('creative discovery crosses stdio and HTTP while unconfigured adapters remain unavailable');

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

  const hostPolicy = await tool(client, 'host_status');
  assert.equal(hostPolicy.host.configured, hostEnabled);
  assert.equal(hostPolicy.host.mode, 'off');
  record('MCP host status accurately distinguishes process opt-in and policy off');
  if (hostEnabled) {
    const fixture = (await service.runtime.snapshot()).snapshot;
    const company = fixture.companies.find(item => item.status === 'active' && item.assistantId);
    assert.ok(company, 'native fixture must have an actual company assistant');
    await tool(client, 'host_configure', { expectedRevision: hostPolicy.host.revision, mode: 'auto',
      grants: [{ id: 'mcp-host-grant', companyId: company.id, employeeId: company.assistantId }] });
    hostRequest = { id: 'mcp-host-once', companyId: company.id, employeeId: company.assistantId,
      cwd: dataDir, command: 'sleep 1; printf "once\\n" >> mcp-host-marker; printf "host-ready\\n"', timeoutSeconds: 10 };
    const submitted = await tool(client, 'host_submit', hostRequest);
    assert.equal(submitted.replayed, false);
    assert.ok(['running', 'completed'].includes(submitted.job.status), 'real tmux launch must succeed');
    record('owner stdio MCP dispatches a granted real native-company shell job through HTTP and tmux');
  }

  await client.close();
  const alive = await fetch(origin + '/v1/status', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(alive.status, 200);
  assert.equal((await alive.json()).execution, 'headless');
  record('daemon remains available after the stdio client disconnects');

  await service.close(); service = null;
  service = await startServer({ repoRoot, dataDir, tokenFile, host: '127.0.0.1', port: 0, hostControlEnabled: hostEnabled });
  origin = `http://127.0.0.1:${service.server.address().port}`;
  const resumed = connect(origin);
  await initialize(resumed);
  const saved = await tool(resumed, 'office_command', command);
  assert.equal(saved.replayed, true);
  assert.equal(saved.summary.counts.companies, initial.summary.counts.companies + 1);
  assert.equal((await tool(resumed, 'runtime_status')).worker.enabled, false);
  if (hostRequest) {
    let output;
    const deadline = Date.now() + 10000;
    do {
      output = await tool(resumed, 'host_inspect', { id: hostRequest.id });
      if (output.eof) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    } while (Date.now() < deadline);
    assert.equal(output.job.status, 'completed');
    assert.equal(output.output, 'host-ready\n');
    assert.equal((await tool(resumed, 'host_submit', hostRequest)).replayed, true);
    assert.equal(fs.readFileSync(path.join(dataDir, 'mcp-host-marker'), 'utf8'), 'once\n');
    const stopped = await tool(resumed, 'host_stop_all');
    assert.equal(stopped.host.mode, 'off');
    record('real tmux work survives daemon/client replacement and MCP replay executes it exactly once');
  }
  await resumed.close();
  record('new daemon and MCP processes retain native receipts and start paused');

  const receipt = { ok: true, suite: 'real-native-http-stdio', checkedAt: new Date().toISOString(),
    checks, hostTmuxRequired: hostEnabled, hostTmuxVerified: Boolean(hostRequest),
    providerCalls: 0, infrastructureProvisioned: false, privateWorkspaceUsed: false };
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
} finally {
  for (const client of clients) client.kill('SIGTERM');
  if (service) {
    if (hostRequest) {
      try { await service.runtime.hostOperation('stopAll', {}); } catch {}
    }
    await service.close();
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
}
