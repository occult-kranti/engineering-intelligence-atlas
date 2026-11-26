import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer, configurationFromEnv } from '../server.mjs';
import { RuntimeError, BODY_LIMIT, OUTPUT_LIMIT } from '../contract.mjs';
import { RuntimeController } from '../runtime.mjs';
import { CreativeToolsService } from '../creative-tools.mjs';
import { createRuntimeClient, createToolHandler } from '../../tools/daftar-runtime-mcp.mjs';

const { AtlasClient } = createRequire(import.meta.url)('../../vscode-extension/src/client.js');

const token = 'synthetic_creative_control_01234567890123456789';
async function fixture(t, perform = async (operation, input) => ({ ok: true, operation, ...input })) {
  const calls = [];
  const server = createServer({ token, runtime: { creativeOperation: async (operation, input) => { calls.push({ operation, input }); return perform(operation, input); } } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (route, body, headers = {}) => fetch(origin + route, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { origin, request, calls };
}

test('all creative reads and mutations require owner authentication before dispatch', async t => {
  const f = await fixture(t);
  for (const [route, body] of [['/v1/creative?companyId=a'], ['/v1/creative/jobs?companyId=a&jobId=j'], ['/v1/creative/assign', {}], ['/v1/creative/run', {}], ['/v1/creative/cancel', {}]]) {
    assert.equal((await f.request(route, body, { Authorization: '' })).status, 401);
    assert.equal((await f.request(route, body, { Origin: 'https://untrusted.example' })).status, 403);
  }
  assert.equal(f.calls.length, 0);
});

test('creative query routes reject missing, duplicated, empty, escaped and unknown scopes', async t => {
  const f = await fixture(t);
  for (const route of ['/v1/creative', '/v1/creative?companyId=', '/v1/creative?companyId=a&companyId=b', '/v1/creative?companyId=a&employeeId=x&employeeId=y', '/v1/creative?companyId=a&path=/tmp', '/v1/creative?companyId=../b', '/v1/creative/jobs?companyId=a', '/v1/creative/jobs?jobId=j', '/v1/creative/jobs?companyId=a&jobId=j&employeeId=x', '/v1/creative/jobs?companyId=a&jobId=j&jobId=k']) assert.equal((await f.request(route)).status, 400, route);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.request('/v1/creative?companyId=a&employeeId=e')).status, 200);
  assert.equal((await f.request('/v1/creative/jobs?companyId=a&jobId=j')).status, 200);
  assert.deepEqual(f.calls, [{ operation: 'snapshot', input: { companyId: 'a', employeeId: 'e' } }, { operation: 'job', input: { companyId: 'a', jobId: 'j' } }]);
});

test('creative mutations retain exact receipt identity and distinguish accepted jobs from completed work', async t => {
  const f = await fixture(t, async (operation, input) => ({ ok: true, id: input.id, ...(operation === 'run' ? { accepted: true, job: { id: input.id, status: 'queued' } } : {}) }));
  const bodies = { assign: { id: 'assignment-1', companyId: 'a', employeeId: 'e', projectId: 'p', toolIds: ['blender'] }, run: { id: 'task-1', companyId: 'a', employeeId: 'e', projectId: 'p', operation: 'blender.render', input: { path: 'scenes/main.blend', width: 512 } }, cancel: { id: 'cancel-1', companyId: 'a', jobId: 'task-1' } };
  for (const [operation, body] of Object.entries(bodies)) {
    const response = await f.request('/v1/creative/' + operation, body);
    assert.equal(response.status, operation === 'run' ? 202 : 200);
    const result = await response.json();assert.equal(result.id, body.id);
    if (operation === 'run') { assert.equal(result.accepted, true); assert.equal(result.job.status, 'queued'); }
    assert.deepEqual(f.calls.at(-1), { operation, input: body });
  }
  for (const route of ['/v1/creative/assign', '/v1/creative/run', '/v1/creative/cancel']) assert.equal((await f.request(route)).status, 404);
  assert.equal((await f.request('/v1/creative/run?companyId=b', bodies.run)).status, 404);
  assert.equal(f.calls.length, 3);
});

test('creative input transport bounds and errors are preserved without leaking unknown exceptions', async t => {
  const f = await fixture(t, async (_operation, input) => { if (input.id === 'known') throw new RuntimeError('CREATIVE_AUTHORITY_DENIED', 'Current creative.execute authority is missing.', 403); throw new Error('PRIVATE_KEY /workspace/private'); });
  assert.equal((await f.request('/v1/creative/run', {}, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await f.request('/v1/creative/run', { text: 'x'.repeat(BODY_LIMIT) })).status, 413);
  assert.equal(f.calls.length, 0);
  const denied = await f.request('/v1/creative/run', { id: 'known' });assert.equal(denied.status, 403);assert.equal((await denied.json()).code, 'CREATIVE_AUTHORITY_DENIED');
  const unknown = await f.request('/v1/creative/run', { id: 'unknown' });assert.equal(unknown.status, 500);assert.doesNotMatch(await unknown.text(), /PRIVATE_KEY|workspace/);
});

test('private creative configuration is explicit and never inferred from a caller path', () => {
  assert.equal(configurationFromEnv({ DAFTAR_CREATIVE_CONFIG_FILE: '/private/creative.json' }).creativeConfigFile, '/private/creative.json');
  assert.equal(configurationFromEnv({}).creativeConfigFile, undefined);
});
test('an oversized saved creative response remains a successful receipt instead of encouraging another start', async t => {
  const f = await fixture(t, async (_operation, input) => ({ ok: true, accepted: true, id: input.id, replayed: false, job: { result: 'x'.repeat(OUTPUT_LIMIT) } }));
  const response = await f.request('/v1/creative/run', { id: 'saved-creative' });
  assert.equal(response.status, 200);
  const receipt = await response.json();assert.equal(receipt.ok, true);assert.equal(receipt.id, 'saved-creative');assert.equal(receipt.snapshotOmitted, true);assert.match(receipt.notice, /Do not replay/);
  assert.equal(f.calls.length, 1);
});
test('real creative service discovery and scoped errors survive HTTP, MCP and editor clients without any tool or provider execution', async t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-creative-transport-'));
  const service = new CreativeToolsService({ stateDir, repoRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
    snapshot: async () => ({ ok: true, snapshot: { companies: [{ id: 'a', status: 'active' }], employees: [], offices: [], departments: [], authority: { grants: [] } } }),
    spawnImpl: () => assert.fail('Unconfigured discovery must not execute a tool'),
  });
  const runtime = new RuntimeController({ creativeTools: service, office: {}, worker: { stop() {}, status: () => ({ running: false, activeJobIds: [] }) } });
  t.after(async () => { await runtime.close(); fs.rmSync(stateDir, { recursive: true, force: true }); });
  const f = await fixture(t, (operation, input) => runtime.creativeOperation(operation, input));
  const mcp = createToolHandler({ request: createRuntimeClient({ origin: f.origin, token }) });
  const editor = new AtlasClient({ kind: 'runtime', url: f.origin, controlToken: token });
  for (const inventory of [await mcp('creative_inventory', { companyId: 'a' }), await editor.creative('snapshot', { companyId: 'a' })]) {
    assert.equal(inventory.configured, false);assert.equal(inventory.tools.length, 5);
    assert.ok(inventory.tools.every(tool => tool.available === false && tool.configured === false));
    assert.equal(inventory.jobs.length, 0);assert.equal(JSON.stringify(inventory).includes(stateDir), false);
  }
  await assert.rejects(mcp('creative_inventory', { companyId: 'foreign' }), error => error.code === 'CREATIVE_SCOPE_DENIED');
  // The shared runtime client preserves the public error code while sanitizing
  // backend messages, which can otherwise include host-specific details.
  await assert.rejects(editor.creative('snapshot', { companyId: 'foreign' }), /authorization was refused \(CREATIVE_SCOPE_DENIED\)/);
  assert.equal(f.calls.every(call => call.operation === 'snapshot'), true);
});
