import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';
import { createRuntimeClient, createToolHandler } from '../../tools/daftar-runtime-mcp.mjs';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const token = 'isolated_activity_owner_012345678901234567890';
async function fixture(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-activity-wiring-'));
  let generated = 0;
  const service = await startServer({ repoRoot, dataDir, port: 0, token, hostControlEnabled: true,
    generate: async () => { generated++; throw new Error('No generation is permitted in this fixture'); },
    modelFetch: async () => { throw new Error('No model transport is permitted'); },
    workbenchPlatform: { fetch: async () => { throw new Error('No external transport is permitted'); } },
  });
  const origin = `http://127.0.0.1:${service.server.address().port}`;
  t.after(async () => { await service.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const request = async (route, body, authenticated = true) => {
    const response = await fetch(origin + route, { method: body === undefined ? 'GET' : 'POST', headers: {
      ...(authenticated ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const command = async (id, command) => {
    const current = await service.runtime.snapshot();
    return service.runtime.command({ id, expectedStateHash: current.stateHash, command });
  };
  return { runtime: service.runtime, dataDir, request, command, mcp: createToolHandler({ request: createRuntimeClient({ origin, token }) }), generated: () => generated };
}

test('authenticated HTTP, workbench and MCP share owner-mode activity with filtered cached summaries', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/v1/activity', undefined, false)).status, 401);
  assert.equal((await f.request('/v1/activity/query', {}, false)).status, 401);
  assert.equal((await f.request('/v1/host/god-mode', { expectedRevision: 0, enabled: false, companyIds: [] }, false)).status, 401);
  await f.command('activity-create', { action: 'create_company', name: 'Private name that must not enter metadata logs' });
  const current = await f.runtime.snapshot();
  const companyIds = current.snapshot.companies.filter(company => company.status === 'active').map(company => company.id).sort();
  const before = await f.mcp('host_status', {});
  const enabled = await f.mcp('host_god_mode', { expectedRevision: before.host.revision, enabled: true, companyIds });
  assert.equal(enabled.host.godMode.enabled, true); assert.equal(enabled.host.jobCount, 0); assert.equal(f.generated(), 0);
  await assert.rejects(f.mcp('host_god_mode', { expectedRevision: before.host.revision, enabled: true, companyIds }));
  const events = await f.mcp('activity_query', { limit: 100 });
  assert.ok(events.events.some(event => event.family === 'host' && event.operation === 'godMode' && event.outcome === 'success'));
  assert.ok(events.events.some(event => event.family === 'host' && event.operation === 'godMode' && event.outcome === 'rejected'));
  assert.ok(events.events.some(event => event.family === 'office' && event.requestId === 'activity-create'));
  const first = await f.mcp('activity_summarize', {}), second = await f.mcp('activity_summarize', {});
  assert.equal(first.cacheHit, false); assert.equal(second.cacheHit, true); assert.deepEqual(first.summary, second.summary);
  const empty = await f.mcp('activity_query', { companyId: 'no-company', limit: 10 }); assert.deepEqual(empty.events, []);
  const status = await f.request('/v1/workbench/call', { method: 'activityStatus', args: [] });
  assert.equal(status.status, 200); assert.equal(status.body.result.activity.eventCount, events.latestSequence);
  const wbQuery = await f.request('/v1/workbench/call', { method: 'activityQuery', args: [{ limit: 100 }] });
  assert.deepEqual(wbQuery.body.result.events, events.events);
  const disk = fs.readFileSync(path.join(f.dataDir, 'activity-journal/registry.json'), 'utf8');
  assert.ok(!disk.includes('Private name')); assert.ok(!disk.includes(token)); assert.ok(!disk.includes('expectedStateHash'));
  await f.mcp('host_god_mode', { expectedRevision: enabled.host.revision, enabled: false, companyIds: [] });
  const changed = await f.mcp('activity_summarize', {}); assert.equal(changed.cacheHit, false);
  assert.equal((await f.runtime.status()).worker.enabled, false);
});

test('uncertain journal persistence preserves the successful native mutation receipt and exposes degraded diagnostics', async t => {
  for (const afterRename of [false, true]) {
    const f = await fixture(t); const destination = path.join(f.dataDir, 'activity-journal/registry.json');
    const rename = fs.renameSync;
    fs.renameSync = (source, target) => {
      if (target !== destination) return rename(source, target);
      if (afterRename) rename(source, target);
      throw Object.assign(new Error('Synthetic journal storage fault'), { code: 'EIO' });
    };
    let saved;
    try { saved = await f.command('native-saved-once', { action: 'create_company', name: 'Native receipt survives audit trouble' }); }
    finally { fs.renameSync = rename; }
    assert.equal(saved.ok, true); assert.equal(saved.id, 'native-saved-once'); assert.ok(saved.activityWarning);
    assert.equal((await f.runtime.snapshot()).snapshot.companies.filter(company => company.name === 'Native receipt survives audit trouble').length, 1);
    const status = await f.mcp('activity_status', {}); assert.equal(status.activity.fenced, true); assert.equal(status.activity.latestSequence, null);
    assert.equal((await f.request('/v1/activity/query', {})).status, 503);
    assert.equal((await f.mcp('runtime_status', {})).activity.degraded, true);
    assert.equal(f.generated(), 0);
  }
});
