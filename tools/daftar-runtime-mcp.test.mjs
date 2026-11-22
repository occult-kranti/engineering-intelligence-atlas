import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import {
  normalizeRuntimeOrigin, readControlToken, createRuntimeClient, createToolHandler,
  createMessageProcessor, startServer, TOOL_DEFINITIONS, REQUEST_LIMIT, TOOL_OUTPUT_LIMIT,
} from './daftar-runtime-mcp.mjs';

const TOKEN = 'synthetic_control_token_01234567890123456789';
const HASH = 'a'.repeat(64);
const config = { origin: 'http://127.0.0.1:8788', token: TOKEN };
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const command = () => ({ id: 'request-one', expectedStateHash: HASH, command: { action: 'create_company', name: 'Synthetic company' } });
const snapshot = () => ({ schemaVersion: 1, activeCompanyId: 'company-a', companies: [{ id: 'company-a', name: 'A' }], offices: [], departments: [],
  employees: Array.from({ length: 5 }, (_, i) => ({ id: `employee-${i}`, companyId: 'company-a', name: `Employee ${i}`, role: 'Analyst' })),
  jobs: [{ id: 'job-a', companyId: 'company-a', goal: 'PRIVATE PROMPT', status: 'running', leaseToken: 'PRIVATE LEASE', apiKey: 'PRIVATE KEY', artifactUri: '/workspace/private/report.md' }],
  chatThreads: [{ id: 'chat-a', messages: [{ content: 'PRIVATE CHAT' }] }],
  budget: { observedUsd: 0.2, committedUsd: 0.3, remainingUsd: 1, atCap: false },
  authority: { ledger: [], grants: [], index: [] }, lastAction: { leaseToken: 'PRIVATE LEASE' },
});

function fixture(overrides = {}) {
  const calls = [];
  const office = snapshot();
  const handler = createToolHandler({ request: async (method, route, body) => {
    calls.push({ method, route, body });
    if (overrides.request) return overrides.request(method, route, body);
    if (route === '/v1/status') return { ok: true, execution: 'headless', worker: { enabled: false, running: false, lastError: 'PRIVATE ERROR /workspace/private/log' },
      capabilities: { providerJobs: true, arbitraryCode: false, providerAdapters: ['openai', 'anthropic'], secret: TOKEN },
      cloud: { configured: true, connected: false, revision: 8, error: 'PRIVATE ERROR /workspace/private/cloud', url: 'https://private.example', deviceToken: TOKEN } };
    if (route === '/v1/workers') return { ok: true, worker: { enabled: body.enabled, running: false, activeJobId: null } };
    return { ok: true, snapshot: office, stateHash: HASH, ...(body ? { id: body.id, replayed: false } : {}) };
  } });
  return { calls, handler, office };
}

async function initialized(handler) {
  const process = createMessageProcessor({ handleTool: handler });
  const response = await process(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } } }));
  assert.equal(response.result.protocolVersion, '2025-11-25');
  await process(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
  return process;
}

test('configured origin is exact and rejects credentials, non-loopback HTTP, path escapes, and aliases', () => {
  for (const origin of ['http://127.0.0.1:8788', 'http://localhost:8788', 'http://[::1]:8788', 'https://daftar.example']) assert.equal(normalizeRuntimeOrigin(`${origin}/`), origin);
  for (const origin of ['http://daftar.example', 'http://127.0.0.1.evil.example', 'https://user:password@daftar.example', 'https://daftar.example/path',
    'https://daftar.example/?', 'https://daftar.example/#', 'https://daftar.example/../', 'https://daftar.example\\evil', ' http://127.0.0.1:8788',
    'http://2130706433:8788', 'http://127.1:8788', 'file:///secret', 'https://daftar.example:443']) assert.throws(() => normalizeRuntimeOrigin(origin));
});

test('control credential is read only from a bounded private regular file, never a symlink', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-mcp-token-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'token');
  fs.writeFileSync(file, `${TOKEN}\n`, { mode: 0o600 });
  assert.equal(readControlToken(file), TOKEN);
  if (process.platform !== 'win32') { fs.chmodSync(file, 0o644); assert.throws(() => readControlToken(file)); fs.chmodSync(file, 0o400); assert.equal(readControlToken(file), TOKEN); }
  const link = path.join(dir, 'link'); fs.symlinkSync(file, link); assert.throws(() => readControlToken(link));
  assert.throws(() => readControlToken('relative-token'));
  fs.chmodSync(file, 0o600); fs.writeFileSync(file, 'x'.repeat(259)); assert.throws(() => readControlToken(file));
  fs.writeFileSync(file, `${TOKEN} another`); assert.throws(() => readControlToken(file));
});

test('the adapter advertises only owner-facing tools and accurate worker side effects', async () => {
  const f = fixture(); const process = await initialized(f.handler);
  const response = await process(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }));
  assert.deepEqual(response.result.tools.map(t => t.name), ['activity_status', 'activity_query', 'activity_summarize', 'design_catalog', 'design_plan', 'design_install', 'design_inspect', 'environment_status', 'environment_prepare', 'environment_inspect', 'environment_run', 'resource_status', 'resource_configure', 'resource_resolve', 'resource_plan', 'resource_start', 'resource_inspect', 'resource_cancel', 'runtime_status', 'office_summary', 'office_query', 'office_command', 'worker_set_enabled', 'model_pool_status', 'model_pool_request', 'model_pool_cancel', 'model_pool_select', 'host_status', 'host_configure', 'host_god_mode', 'host_submit', 'host_approve', 'host_cancel', 'host_inspect', 'host_stop_all']);
  assert.equal(f.calls.length, 0);
  const owner = TOOL_DEFINITIONS.find(t => t.name === 'office_command');
  assert.equal(owner.annotations.openWorldHint, true);
  for (const action of ['claim_job', 'reserve_job', 'finish_job', 'heartbeat_job', 'reserve_external', 'settle_external', 'put_cache', 'get_cache', 'tick_schedules', 'import_cloud_message', 'record_step_review', 'record_review_failure']) assert.equal(owner.inputSchema.properties.command.properties.action.enum.includes(action), false, action);
  const worker = TOOL_DEFINITIONS.find(t => t.name === 'worker_set_enabled');
  assert.equal(worker.annotations.readOnlyHint, false); assert.equal(worker.annotations.idempotentHint, false); assert.equal(worker.annotations.openWorldHint, true); assert.match(worker.description, /charges/);
});

test('model tools validate scope, reviewed refs and bounded download receipts before transport', async () => {
  const f = fixture();
  for (const args of [{ companyId: 'company-a', employeeId: 'employee-0', model: 'gpt-oss:120b-cloud', idempotencyKey: 'pull-1' },
    { companyId: 'company-a', employeeId: 'employee-0', model: 'qwen3:4b', idempotencyKey: 'pull-1', baseUrl: 'http://attacker' },
    { companyId: 'company-a', employeeId: 'employee-0', model: 'qwen3:4b', idempotencyKey: 'pull-1', maxBytes: -1 }]) await assert.rejects(f.handler('model_pool_request', args));
  await assert.rejects(f.handler('model_pool_cancel', { companyId: 'company-a', employeeId: 'employee-0', requestId: '../escape' }));
  await assert.rejects(f.handler('model_pool_status', { companyId: 'company-a', arbitrary: true }));
  assert.equal(f.calls.length, 0);
  assert.equal(TOOL_DEFINITIONS.find(tool => tool.name === 'model_pool_request').annotations.openWorldHint, true);
});

test('model tools pass exact scoped operations and project only shared model metadata', async () => {
  const model = 'qwen3:4b';
  const f = fixture({ request: async () => ({ ok: true, requestId: 'request-1', replayed: false, reused: true, snapshot: {
    companyId: 'company-a', available: true, enabled: true, endpoint: '/workspace/private', secret: TOKEN,
    catalog: [{ id: model, name: 'Qwen', description: 'Catalog', storageCeilingBytes: 100, sourceUrl: 'https://attacker.example' }],
    models: [{ name: model, digest: HASH, sizeBytes: 100, loaded: true, localPath: '/workspace/private/model' }],
    requests: [{ id: 'request-1', companyId: 'company-a', employeeId: 'employee-0', model, status: 'pulling', completedBytes: 20, totalBytes: 100, error: null, key: 'PRIVATE' },
      { id: 'request-2', companyId: 'company-b', employeeId: 'foreign', model, status: 'ready' }],
    assignments: [{ companyId: 'company-a', employeeId: 'employee-0', model, digest: HASH, path: '/workspace/private' }], error: null,
  } }) });
  const args = { companyId: 'company-a', employeeId: 'employee-0', model, idempotencyKey: 'request-1' };
  const result = await f.handler('model_pool_request', args);
  await f.handler('model_pool_status', { companyId: 'company-a', employeeId: 'employee-0' });
  await f.handler('model_pool_select', { companyId: 'company-a', employeeId: 'employee-0', model });
  await f.handler('model_pool_cancel', { companyId: 'company-a', employeeId: 'employee-0', requestId: 'request-1' });
  assert.deepEqual(f.calls.map(call => call.route), ['/v1/models/pull', '/v1/models?companyId=company-a&employeeId=employee-0', '/v1/models/select', '/v1/models/cancel']);
  assert.deepEqual(f.calls[0].body, args); assert.equal(result.snapshot.requests.length, 1);
  assert.equal(result.snapshot.catalog[0].sourceUrl, 'https://ollama.com/library/qwen3:4b');
  for (const text of ['PRIVATE', '/workspace/', 'attacker.example', 'company-b', TOKEN]) assert.equal(JSON.stringify(result).includes(text), false);
});

test('model inventory route accepts only exact bounded scope query fields', async () => {
  const calls = [];
  const client = createRuntimeClient(config, { fetchImpl: async (url) => { calls.push(url); return json({ ok: true }); } });
  await client('GET', '/v1/models?companyId=company-a&employeeId=employee-0');
  for (const route of ['/v1/models?companyId=company-a&companyId=company-b', '/v1/models?companyId=company-a&url=http://evil', '/v1/models?employeeId=employee-0', '/v1/models?companyId=../x']) await assert.rejects(client('GET', route));
  assert.equal(calls.length, 1);
});

const hostJob = (overrides = {}) => ({ id: 'host-job', companyId: 'company-a', employeeId: 'donna', status: 'running',
  commandHash: HASH, createdAt: '2026-11-22T00:00:00.000Z', startedAt: '2026-11-22T00:00:01.000Z', finishedAt: null,
  timeoutSeconds: 30, maxOutputBytes: 65536, outputBytes: 7, exitCode: null, reason: null, tmuxSession: 'daftar-host-job', ...overrides });
const hostStatus = (overrides = {}) => ({ configured: true, available: true, mode: 'auto', revision: 4,
  grants: [{ id: 'grant-1', companyId: 'company-a', employeeId: 'donna' }], jobCount: 1, jobs: [hostJob()],
  capabilities: { arbitraryCode: true }, limits: { outputBytes: 8388608 }, ...overrides });
const hostSubmission = () => ({ id: 'host-job', companyId: 'company-a', employeeId: 'donna', command: 'printf ready', cwd: '/tmp', timeoutSeconds: 30, maxOutputBytes: 65536 });

test('host tool schemas advertise owner shell authority and reject malformed input before transport', async () => {
  const f = fixture();
  for (const args of [
    { ...hostSubmission(), env: { SECRET: 'forbidden' } }, { ...hostSubmission(), command: '' },
    { ...hostSubmission(), command: 'x'.repeat(65537) }, { ...hostSubmission(), cwd: 'relative' },
    { ...hostSubmission(), timeoutSeconds: 86401 }, { ...hostSubmission(), maxOutputBytes: 8388609 },
    { ...hostSubmission(), id: '../escape' }, { ...hostSubmission(), companyId: '' },
  ]) await assert.rejects(f.handler('host_submit', args));
  for (const args of [
    { expectedRevision: -1, mode: 'auto', grants: [] }, { expectedRevision: 0, mode: 'root', grants: [] },
    { expectedRevision: 0, mode: 'auto', grants: [{ id: 'x', companyId: 'a', employeeId: null, administrator: true }] },
    { expectedRevision: 0, mode: 'auto', grants: Array.from({ length: 257 }, (_, i) => ({ id: `g${i}`, companyId: 'a', employeeId: null })) },
  ]) await assert.rejects(f.handler('host_configure', args));
  await assert.rejects(f.handler('host_status', { companyId: 'company-a' }));
  await assert.rejects(f.handler('host_inspect', { id: 'host-job', offset: -1 }));
  await assert.rejects(f.handler('host_approve', { id: 'host-job', command: 'changed' }));
  await assert.rejects(f.handler('host_stop_all', { includeUnmanaged: true }));
  assert.equal(f.calls.length, 0);
  for (const name of ['host_submit', 'host_configure', 'host_approve', 'host_cancel', 'host_stop_all']) {
    const definition = TOOL_DEFINITIONS.find(tool => tool.name === name);
    assert.equal(definition.annotations.readOnlyHint, false); assert.equal(definition.annotations.openWorldHint, true);
    assert.equal(definition.annotations.destructiveHint, true);
  }
  for (const name of ['host_status', 'host_inspect']) assert.equal(TOOL_DEFINITIONS.find(tool => tool.name === name).annotations.readOnlyHint, true);
});

test('host tools use exact routes, compact receipts and explicitly bounded output', async () => {
  const f = fixture({ request: async (_method, route) => {
    if (['/v1/host', '/v1/host/configure', '/v1/host/stop-all'].includes(route)) return { ok: true, host: hostStatus({ command: 'PRIVATE COMMAND', secret: TOKEN }) };
    return { ok: true, id: 'host-job', replayed: true, job: hostJob({ command: 'PRIVATE COMMAND', cwd: '/workspace/private', secret: TOKEN }),
      output: 'ready\n/workspace/project\napi_key=sk-proj-abcdefghijk\n', offset: 0, nextOffset: 54, eof: true, truncated: false };
  } });
  const status = await f.handler('host_status', {});
  const configure = await f.handler('host_configure', { expectedRevision: 4, mode: 'manual', grants: [] });
  const submitted = await f.handler('host_submit', hostSubmission());
  await f.handler('host_approve', { id: 'host-job' }); await f.handler('host_cancel', { id: 'host-job' });
  const inspected = await f.handler('host_inspect', { id: 'host-job', offset: 0 });
  await f.handler('host_stop_all', {});
  assert.deepEqual(f.calls.map(call => call.route), ['/v1/host', '/v1/host/configure', '/v1/host/submit', '/v1/host/approve', '/v1/host/cancel', '/v1/host/inspect', '/v1/host/stop-all']);
  assert.deepEqual(f.calls[2].body, hostSubmission());
  assert.equal(status.host.mode, 'auto'); assert.equal(configure.host.revision, 4); assert.equal(submitted.id, 'host-job');
  assert.equal(submitted.replayed, true); assert.equal('output' in submitted, false);
  assert.doesNotMatch(JSON.stringify({ status, configure, submitted }), /PRIVATE|workspace|synthetic_control_token/);
  assert.match(inspected.output, /ready\n\/workspace\/project/); assert.doesNotMatch(inspected.output, /sk-proj|abcdefghijk/);
  assert.equal(inspected.nextOffset, 54);
});

test('host metadata and output stay within MCP limits and reject mismatched receipts', async () => {
  const long = 'x'.repeat(150);
  const f = fixture({ request: async () => ({ ok: true, host: hostStatus({
    grants: Array.from({ length: 256 }, (_, i) => ({ id: `${long}${i}`, companyId: long, employeeId: long })),
    jobs: Array.from({ length: 256 }, (_, i) => hostJob({ id: `${long}${i}`, companyId: long, employeeId: long, reason: '\\'.repeat(180), tmuxSession: long })), jobCount: 256,
  }) }) });
  const processor = await initialized(f.handler);
  const status = await processor(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'host_status', arguments: {} } }));
  assert.equal(status.result.isError, false); assert.equal(status.result.structuredContent.host.jobs.length, 50);
  assert.equal(status.result.structuredContent.host.jobsOmitted, 206);
  assert.ok(Buffer.byteLength(JSON.stringify(status)) < TOOL_OUTPUT_LIMIT);
  for (const output of ['x'.repeat(65537), '😀'.repeat(32769)]) {
    const handler = fixture({ request: async () => ({ ok: true, id: 'host-job', job: hostJob(), output, offset: 0, nextOffset: 65537, eof: true, truncated: false }) }).handler;
    await assert.rejects(handler('host_inspect', { id: 'host-job' }), error => error.code === 'runtime_bad_response');
  }
  const bad = fixture({ request: async () => ({ ok: true, id: 'another-job', job: hostJob() }) });
  await assert.rejects(bad.handler('host_submit', hostSubmission()), error => error.code === 'runtime_bad_response');
  assert.equal(bad.calls.length, 1);
});

test('host job and scope identifiers round-trip unchanged even with credential-like prefixes', async () => {
  for (const prefix of ['sk-', 'sk-proj-', 'ghp_', 'github_pat_']) {
    const id = `${prefix}syntheticjob1234`, companyId = `${prefix}syntheticcompany1234`, employeeId = `${prefix}syntheticemployee1234`, grantId = `${prefix}syntheticgrant1234`;
    const job = hostJob({ id, companyId, employeeId });
    const f = fixture({ request: async (_method, route, body) => {
      if (route === '/v1/host' || route === '/v1/host/configure') return { ok: true, host: hostStatus({ grants: [{ id: grantId, companyId, employeeId }], jobs: [job] }) };
      return { ok: true, id: body.id, job, output: 'done', offset: body.offset ?? 0, nextOffset: (body.offset ?? 0) + 4, eof: true, truncated: false };
    } });
    const submitted = await f.handler('host_submit', { ...hostSubmission(), id, companyId, employeeId });
    assert.equal(submitted.id, id); assert.equal(submitted.job.id, id);
    const status = await f.handler('host_status', {});
    assert.deepEqual(status.host.grants, [{ id: grantId, companyId, employeeId }]);
    assert.equal(status.host.jobs[0].id, id);
    await f.handler('host_configure', { expectedRevision: status.host.revision, mode: 'manual', grants: status.host.grants });
    for (const name of ['host_inspect', 'host_approve', 'host_cancel']) {
      const receipt = await f.handler(name, { id: status.host.jobs[0].id });
      assert.equal(receipt.id, id); assert.equal(receipt.job.id, id);
      assert.equal(receipt.job.companyId, companyId); assert.equal(receipt.job.employeeId, employeeId);
      assert.equal(f.calls.at(-1).body.id, id);
    }
  }
});

test('host output offsets must match the requested byte offset and never rewind', async () => {
  const make = (offset, nextOffset) => fixture({ request: async () => ({ ok: true, id: 'host-job', job: hostJob(), output: '', offset, nextOffset, eof: false, truncated: false }) });
  for (const [args, offset, nextOffset] of [
    [{ id: 'host-job' }, 1, 1], [{ id: 'host-job', offset: 70000 }, 0, 0],
    [{ id: 'host-job', offset: 70000 }, 70000, 8], [{ id: 'host-job', offset: 70000 }, 70001, 70001],
  ]) await assert.rejects(make(offset, nextOffset).handler('host_inspect', args), error => error.code === 'runtime_bad_response');
  const beyond = await make(70000, 70000).handler('host_inspect', { id: 'host-job', offset: 70000 });
  assert.equal(beyond.offset, 70000); assert.equal(beyond.nextOffset, 70000); assert.equal(beyond.output, '');
  const initial = await make(0, 0).handler('host_inspect', { id: 'host-job' }); assert.equal(initial.offset, 0);
});

test('host HTTP whitelist forbids route tricks and uncertain launches are never retried', async () => {
  const calls = [];
  const client = createRuntimeClient(config, { fetchImpl: async (url) => { calls.push(url); return json({ ok: true }); } });
  await client('GET', '/v1/host'); await client('POST', '/v1/host/submit', hostSubmission());
  for (const route of ['/v1/host/submit?command=true', '/v1/host/../commands', '/v1/host/close', '/v1/host/submit#fragment']) {
    await assert.rejects(client('POST', route, {}));
  }
  assert.equal(calls.length, 2);
  const hung = createRuntimeClient(config, { timeoutMs: 10, fetchImpl: async () => { calls.push('hung'); return new Promise(() => {}); } });
  await assert.rejects(hung('POST', '/v1/host/submit', hostSubmission()), error => error.code === 'runtime_timeout' && /host_status or host_inspect/.test(error.message) && /No retry/.test(error.message));
  assert.equal(calls.filter(value => value === 'hung').length, 1);
});

test('status and summary use allowlisted metadata and never expose a worker lease, error, or prompt', async () => {
  const f = fixture();
  const status = await f.handler('runtime_status', {});
  assert.equal(status.worker.hasError, true);
  assert.deepEqual(status.capabilities.providerAdapters, ['openai', 'anthropic']);
  assert.deepEqual(Object.keys(status.cloud).sort(), ['configured', 'connected', 'error', 'revision']);
  assert.equal(status.cloud.configured, true); assert.equal(status.cloud.revision, 8);
  const office = await f.handler('office_summary', {});
  assert.equal(office.stateHash, HASH); assert.equal(office.summary.counts.jobs, 1); assert.equal(office.summary.budget.remainingUsd, 1);
  const output = JSON.stringify({ status, office });
  for (const value of ['PRIVATE', TOKEN, '/workspace/', 'leaseToken', 'apiKey']) assert.equal(output.includes(value), false, value);
  assert.deepEqual(f.calls.map(c => c.route), ['/v1/status', '/v1/office']);
});

test('bounded office query paginates with matching stateHash and filters confidential fields', async () => {
  const f = fixture(); const ids = []; let cursor;
  do {
    const page = await f.handler('office_query', { collection: 'employees', pageSize: 2, ...(cursor ? { cursor } : {}) });
    assert.equal(page.stateHash, HASH); assert.equal(page.metadataOnly, true); ids.push(...page.items.map(item => item.id)); cursor = page.nextCursor;
  } while (cursor);
  assert.equal(new Set(ids).size, 5);
  const result = await f.handler('office_query', { collection: 'jobs' });
  for (const value of ['PRIVATE', '/workspace/', 'leaseToken', 'apiKey']) assert.equal(JSON.stringify(result).includes(value), false, value);
  assert.ok(f.calls.every(c => c.method === 'GET' && c.route === '/v1/office'));
});

test('invalid metadata query and raw/internal commands are rejected before any HTTP call', async () => {
  const f = fixture();
  for (const args of [{ collection: 'credentials' }, { collection: 'jobs', pageSize: 101 }, { collection: 'jobs', shell: 'anything' }]) await assert.rejects(f.handler('office_query', args));
  for (const action of ['claim_job', 'finish_job', 'reserve_external', 'apply_remote_command', 'import_cloud_message']) await assert.rejects(f.handler('office_command', { ...command(), command: { action } }));
  for (const value of [{ ...command(), expectedStateHash: undefined }, { ...command(), id: 'not/a/receipt' }, { ...command(), path: '/tmp/anywhere' },
    JSON.parse(`{"id":"id","expectedStateHash":"${HASH}","command":{"action":"create_company","constructor":{}}}`)]) await assert.rejects(f.handler('office_command', value));
  await assert.rejects(f.handler('claim_job', {}));
  assert.equal(f.calls.length, 0);
});

test('owner commands preserve envelope identity and return a successful compact receipt for large snapshots', async () => {
  const f = fixture(); f.office.chatThreads[0].messages[0].content = 'PRIVATE'.repeat(350000);
  const args = command(); const result = await f.handler('office_command', args);
  assert.deepEqual(f.calls, [{ method: 'POST', route: '/v1/commands', body: args }]);
  assert.equal(result.operationSucceeded, true); assert.equal(result.id, args.id); assert.equal(result.stateHash, HASH);
  assert.equal(result.snapshotOmitted, true); assert.equal('snapshot' in result, false);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 5000);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});

test('a saved command remains successful when its snapshot projection is unavailable', async () => {
  const f = fixture({ request: async () => ({ ok: true, id: 'request-one', replayed: true, snapshotOmitted: true, notice: 'PRIVATE server note' }) });
  const result = await f.handler('office_command', command());
  assert.equal(result.ok, true); assert.equal(result.replayed, true); assert.equal(result.snapshotOmitted, true);
  assert.equal('stateHash' in result, false); assert.equal(f.calls.length, 1); assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});

test('remote nested board metadata keeps exact IDs, parent scope, links and the same-read CAS hash', async () => {
  const office = snapshot(), id = 'sk-ant-1234567890';
  office.companies.push({id:'company-b',name:'B'});
  office.offices=[{id:'office-a',companyId:'company-a'},{id:'office-b',companyId:'company-b'}];
  office.employees.push({id,companyId:'company-a',officeId:'office-a',name:'Owner'});
  office.goals=[{id:'goal-a',companyId:'company-a',scope:{kind:'company',id:'company-a'},steps:[{id:'step-a',title:'Step',employeeId:id,goal:'PRIVATE STEP',dependsOn:[]}]}];
  office.blueprints=['a','b'].map(suffix=>({id:`blueprint-${suffix}`,companyId:`company-${suffix}`,officeId:`office-${suffix}`,
    rooms:[{id:`room-${suffix}`,name:'Room',x:0,y:0,width:1,height:1}],desks:[],
    whiteboards:[{id:suffix==='a'?id:'board-b',title:'Board',ownerEmployeeId:id,roomId:`room-${suffix}`,x:.2,y:.3,goalIds:suffix==='a'?['goal-a']:[],jobIds:[],roadmapItemIds:[]}]}));
  const calls=[];
  const handler=createToolHandler({request:async(method,route,body)=>{calls.push({method,route,body});return {ok:true,stateHash:HASH,snapshot:office};}});
  const result=await handler('office_query',{collection:'whiteboards',scope:{kind:'company',id:'company-a'}});
  assert.equal(result.stateHash,HASH);assert.equal(result.items.length,1);assert.equal(result.items[0].id,id);assert.equal(result.items[0].ownerEmployeeId,id);
  assert.equal(result.items[0].companyId,'company-a');assert.deepEqual(result.items[0].goalIds,['goal-a']);assert.equal(result.items[0].referencesComplete,true);
  const summary=await handler('office_summary',{});assert.equal(summary.summary.counts.whiteboards,2);assert.equal(summary.summary.counts.rooms,2);assert.equal(summary.summary.counts.goalSteps,1);
  const steps=await handler('office_query',{collection:'goalSteps',scope:{kind:'goal',id:'goal-a'}});assert.equal(steps.items[0].employeeId,id);assert.equal(JSON.stringify(steps).includes('PRIVATE STEP'),false);
  const count=calls.length;
  await assert.rejects(handler('office_query',{collection:'whiteboards'}));
  await assert.rejects(handler('office_command',{id:'internal-review',expectedStateHash:HASH,command:{action:'record_step_review',jobId:'job-a'}}));
  await assert.rejects(handler('office_command',{id:'internal-review-failure',expectedStateHash:HASH,command:{action:'record_review_failure',jobId:'job-a'}}));
  assert.equal(calls.length,count);assert.ok(calls.every(call=>call.method==='GET'&&call.route==='/v1/office'));
});

test('atomic workflow recovery preserves source identity and uses the same owner CAS boundary', async () => {
  const f=fixture(),requestId='sk-12345678';
  f.office.goals=[{id:'goal-atomic',companyId:'company-a',scope:{kind:'company',id:'company-a'},sourceRequestId:requestId,sourceMessageId:'message-atomic',requestSha256:'b'.repeat(64),content:'PRIVATE WORKFLOW BRIEF'}];
  const page=await f.handler('office_query',{collection:'goals',scope:{kind:'company',id:'company-a'}});
  assert.equal(page.stateHash,HASH);assert.equal(page.items[0].sourceRequestId,requestId);assert.equal(page.items[0].sourceMessageId,'message-atomic');assert.equal(page.items[0].requestSha256,'b'.repeat(64));
  assert.equal(JSON.stringify(page).includes('PRIVATE WORKFLOW BRIEF'),false);
  const envelope={id:'outer-stable-workflow',expectedStateHash:page.stateHash,command:{action:'create_paired_workflow',requestId,scope:{kind:'company',id:'company-a'},title:'Paired goal',content:'Synthetic requested brief',mode:'plan'}};
  await f.handler('office_command',envelope);
  assert.deepEqual(f.calls,[{method:'GET',route:'/v1/office',body:undefined},{method:'POST',route:'/v1/commands',body:envelope}]);
  await assert.rejects(f.handler('office_command',{...envelope,command:{action:'record_step_review',jobId:'review-worker-job'}}));
  assert.equal(f.calls.length,2,'the owner recovery path cannot settle worker reviews');
});

test('canonical credential-like IDs survive remote projection while real control-token collisions fail explicitly', async () => {
  const office=snapshot(), canonical='github_pat_1234567890';office.activeCompanyId=canonical;office.companies[0].id=canonical;
  office.employees[0].id='sk-12345678';office.employees[0].name=`Fixture ${TOKEN}`;
  let response={ok:true,stateHash:HASH,snapshot:office},calls=0;
  const request=createRuntimeClient(config,{fetchImpl:async()=>{calls++;return json(response);}});
  const handler=createToolHandler({request});
  assert.equal((await handler('office_summary',{})).summary.activeCompanyId,canonical);
  const employees=await handler('office_query',{collection:'employees'});
  assert.ok(employees.items.some(row=>row.id==='sk-12345678'));assert.equal(JSON.stringify(employees).includes(TOKEN),false);
  for(const record of [{id:TOKEN},{ownerEmployeeId:`prefix-${TOKEN}`},{dependencies:[TOKEN]},{review:{evidenceRefs:[TOKEN]}}]){
    response={ok:true,snapshot:{record}};
    await assert.rejects(request('GET','/v1/office'),error=>error.code==='runtime_identity_credential_collision'&&!error.message.includes(TOKEN));
  }
  response={ok:true,id:TOKEN};const before=calls;
  await assert.rejects(request('POST','/v1/commands',command()),error=>error.code==='runtime_identity_credential_collision'&&/No retry was sent/.test(error.message));
  assert.equal(calls,before+1);
});

test('worker control sends only the explicit Boolean and never silently runs a one-shot', async () => {
  const f = fixture(); await f.handler('worker_set_enabled', { enabled: true });
  await f.handler('worker_set_enabled', { enabled: false });
  assert.deepEqual(f.calls.map(c => c.body), [{ enabled: true }, { enabled: false }]);
  assert.ok(f.calls.every(c => c.route === '/v1/workers'));
  await assert.rejects(f.handler('worker_set_enabled', { enabled: 'true' }));
  await assert.rejects(f.handler('worker_set_enabled', { enabled: true, runOnce: true }));
  assert.equal(f.calls.length, 2);
});

test('HTTP client binds the credential to a fixed origin and forbids unexposed paths', async () => {
  const calls = [];
  const request = createRuntimeClient(config, { fetchImpl: async (url, options) => { calls.push({ url, options }); return json({ ok: true }); } });
  await request('GET', '/v1/status');
  assert.equal(calls[0].url, `${config.origin}/v1/status`); assert.equal(calls[0].options.redirect, 'error'); assert.equal(calls[0].options.headers.Authorization, `Bearer ${TOKEN}`);
  for (const route of ['/v1/workers/run-once', '//evil.example', '/v1/office?token=anything', '/v1/secrets']) await assert.rejects(request('GET', route));
  assert.equal(calls.length, 1);
});

test('HTTP errors and ambiguous mutation timeouts never leak raw errors or retry', async () => {
  let calls = 0;
  const request = createRuntimeClient(config, { fetchImpl: async () => { calls++; return json({ ok: false, code: 'CONFLICT', error: `PRIVATE ${TOKEN} /workspace/secret` }, 409); } });
  await assert.rejects(request('POST', '/v1/commands', command()), error => error.code === 'CONFLICT' && /No retry was sent/.test(error.message) && !/PRIVATE|workspace|synthetic_control_token/.test(error.message));
  assert.equal(calls, 1);
  const hung = createRuntimeClient(config, { timeoutMs: 10, fetchImpl: async () => { calls++; return new Promise(() => {}); } });
  await assert.rejects(hung('POST', '/v1/commands', command()), error => error.code === 'runtime_timeout' && /may already have been applied/.test(error.message));
  assert.equal(calls, 2);
});

test('bounded body and JSON checks reject invalid responses without exposing payloads', async () => {
  const bodies = [
    () => json({ ok: true, text: 'x'.repeat(2000) }),
    () => json({ ok: true }, 200, { 'Content-Length': '2000' }),
    () => new Response('<html>PRIVATE</html>', { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('PRIVATE invalid JSON', { headers: { 'Content-Type': 'application/json' } }),
  ];
  for (const body of bodies) {
    const request = createRuntimeClient(config, { responseLimit: 1000, fetchImpl: async () => body() });
    await assert.rejects(request('GET', '/v1/office'), error => !error.message.includes('PRIVATE'));
  }
  const hanging = createRuntimeClient(config, { timeoutMs: 10, fetchImpl: async () => new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'application/json' } }) });
  await assert.rejects(hanging('GET', '/v1/status'), error => error.code === 'runtime_timeout');
});

test('exact control credential is removed even if an upstream metadata field repeats it', async () => {
  const request = createRuntimeClient(config, { fetchImpl: async () => json({ ok: true, text: TOKEN, nested: { text: `prefix ${TOKEN}` } }) });
  assert.equal(JSON.stringify(await request('GET', '/v1/status')).includes(TOKEN), false);
});

test('real HTTP redirects do not forward the owner token to another destination', async t => {
  let destinationHits = 0;
  const destination = http.createServer((req, res) => { destinationHits++; res.end('{}'); });
  const source = http.createServer((req, res) => { assert.equal(req.headers.authorization, `Bearer ${TOKEN}`); res.writeHead(302, { Location: `http://127.0.0.1:${destination.address().port}/target` }); res.end(); });
  for (const server of [destination, source]) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => { server.closeAllConnections(); server.close(); }); }
  const request = createRuntimeClient({ origin: `http://127.0.0.1:${source.address().port}`, token: TOKEN });
  await assert.rejects(request('GET', '/v1/status'));
  assert.equal(destinationHits, 0);
});

test('MCP lifecycle, error envelopes, and notifications cannot invoke hidden tools', async () => {
  const f = fixture(); const uninitialized = createMessageProcessor({ handleTool: f.handler });
  assert.equal((await uninitialized(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }))).error.code, -32002);
  assert.equal((await uninitialized('{')).error.code, -32700);
  const process = await initialized(f.handler);
  assert.equal(await process(JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'worker_set_enabled', arguments: { enabled: true } } })), null);
  assert.equal((await process(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'company_register', arguments: {} } }))).error.code, -32602);
  assert.equal((await process(JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'resources/list' }))).error.code, -32601);
  assert.equal(f.calls.length, 0);
  const result = await process(JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'office_query', arguments: { collection: 'jobs' } } }));
  assert.equal(result.result.isError, false); assert.equal(result.result.structuredContent.stateHash, HASH);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < TOOL_OUTPUT_LIMIT);
});

test('stdio handles fragmented UTF-8 lines, CRLF, missing trailing newline, and oversized input', async () => {
  const stdin = new PassThrough(); const stdout = new PassThrough(); const chunks = [];
  stdout.on('data', value => chunks.push(value));
  const f = fixture(); const server = startServer({ stdin, stdout, handleTool: f.handler });
  const initialize = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', clientInfo: { name: 'कार्यालय', version: '1' } } }) + '\r\n');
  const split = initialize.indexOf(Buffer.from('क')) + 1;
  stdin.write(initialize.subarray(0, split)); stdin.write(initialize.subarray(split));
  stdin.write('x'.repeat(REQUEST_LIMIT + 1)); stdin.write('\n');
  stdin.end(JSON.stringify({ jsonrpc: '2.0', id: 'status', method: 'tools/call', params: { name: 'runtime_status', arguments: {} } }));
  await server.done;
  const results = Buffer.concat(chunks).toString('utf8').trim().split('\n').map(JSON.parse);
  assert.equal(results.length, 3); assert.equal(results[0].result.serverInfo.name, 'daftar-runtime');
  assert.equal(results[1].error.message, 'Request too large'); assert.equal(results[2].id, 'status');
  assert.equal(f.calls.length, 1);
});

test('CLI launches as a clean stdio subprocess against a synthetic HTTP runtime', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-mcp-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const tokenFile = path.join(dir, 'control-token'); fs.writeFileSync(tokenFile, TOKEN, { mode: 0o600 });
  let requests = 0;
  const httpServer = http.createServer((req, res) => {
    assert.equal(req.url, '/v1/status'); assert.equal(req.headers.authorization, `Bearer ${TOKEN}`); requests++;
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, execution: 'headless', worker: { enabled: false, running: false }, capabilities: { providerJobs: true } }));
  });
  httpServer.listen(0, '127.0.0.1'); await once(httpServer, 'listening');
  t.after(() => { httpServer.closeAllConnections(); httpServer.close(); });
  const child = spawn(process.execPath, [fileURLToPath(new URL('./daftar-runtime-mcp.mjs', import.meta.url))], { env: { ...process.env,
    DAFTAR_RUNTIME_URL: `http://127.0.0.1:${httpServer.address().port}`, DAFTAR_CONTROL_TOKEN_FILE: tokenFile }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const out = []; const err = []; child.stdout.on('data', chunk => out.push(chunk)); child.stderr.on('data', chunk => err.push(chunk));
  child.stdin.end([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'runtime_status', arguments: {} } },
  ].map(JSON.stringify).join('\n') + '\n');
  const exit = once(child, 'close'); const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  const [code] = await exit; clearTimeout(timer);
  assert.equal(code, 0); assert.equal(Buffer.concat(err).length, 0); assert.equal(requests, 1);
  const wire = Buffer.concat(out).toString('utf8'); assert.equal(wire.includes(TOKEN), false);
  const responses = wire.trim().split('\n').map(JSON.parse);
  assert.deepEqual(responses.map(r => r.id), [1, 2, 3]); assert.equal(responses[2].result.structuredContent.worker.enabled, false);
});

test('God mode uses the fixed owner route with current membership and rejects malformed scopes before transport', async () => {
  const f = fixture({ request: async () => ({ ok: true, host: hostStatus({ godMode: { enabled: true, companyIds: ['company-a'], activatedAt: '2026-01-01T00:00:00.000Z' } }) }) });
  const input = { expectedRevision: 4, enabled: true, companyIds: ['company-a'] };
  const result = await f.handler('host_god_mode', input);
  assert.deepEqual(f.calls.map(call => [call.method, call.route, call.body]), [['POST', '/v1/host/god-mode', input]]);
  assert.equal(result.host.godMode.enabled, true); assert.deepEqual(result.host.godMode.companyIds, ['company-a']);
  for (const malformed of [{ ...input, companyIds: [] }, { ...input, companyIds: ['a', 'a'] }, { ...input, enabled: false }, { ...input, disableChecks: true }]) {
    await assert.rejects(f.handler('host_god_mode', malformed));
  }
  assert.equal(f.calls.length, 1);
  assert.equal(TOOL_DEFINITIONS.find(tool => tool.name === 'host_god_mode').annotations.readOnlyHint, false);
});
