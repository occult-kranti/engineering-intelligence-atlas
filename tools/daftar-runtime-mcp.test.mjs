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
  assert.deepEqual(response.result.tools.map(t => t.name), ['runtime_status', 'office_summary', 'office_query', 'office_command', 'worker_set_enabled', 'model_pool_status', 'model_pool_request', 'model_pool_cancel', 'model_pool_select']);
  assert.equal(f.calls.length, 0);
  const owner = TOOL_DEFINITIONS.find(t => t.name === 'office_command');
  assert.equal(owner.annotations.openWorldHint, true);
  for (const action of ['claim_job', 'reserve_job', 'finish_job', 'heartbeat_job', 'reserve_external', 'settle_external', 'put_cache', 'get_cache', 'tick_schedules', 'import_cloud_message']) assert.equal(owner.inputSchema.properties.command.properties.action.enum.includes(action), false, action);
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
