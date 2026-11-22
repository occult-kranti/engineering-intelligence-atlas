import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuntime } from '../runtime.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const projectInput = provider => ({ name: 'Legacy pair gate fixture', goal: 'Synthetic output', provider, model: 'unregistered:fixture',
  nodes: [{ role: 'build', title: 'Primary', instructions: 'Synthetic output', dependsOn: [] },
    { role: 'review', title: 'Reviewer', instructions: 'Synthetic review', dependsOn: [0] }] });
const runInput = projectId => ({ projectId, runBudget: { maxTokens: 64000, maxMinutes: 1, maxUsd: 1 }, priceRates: { inputUsdPerMillion: 1, outputUsdPerMillion: 1 } });
function fixture(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-workbench-pair-gate-')); let generations = 0, fetches = 0;
  const runtime = createRuntime({ repoRoot, dataDir,
    generate: async () => { generations++; assert.fail('Legacy generation is forbidden.'); },
    workbenchPlatform: { fetch: async () => { fetches++; assert.fail('External transport is forbidden.'); } } });
  t.after(async () => { await runtime.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  let sequence = 0;
  return { runtime, calls: () => ({ generations, fetches }),
    call: (method, args = []) => runtime.workbench.call(method, args, { id: `gate-${++sequence}` }) };
}

for (const resourcesEnabled of [false, true]) test(`all legacy providers require native pairing with resource enforcement ${resourcesEnabled ? 'on' : 'off'}`, async t => {
  const f = fixture(t);
  if (resourcesEnabled) await f.runtime.resources.configure({ expectedRevision: 0, resources: [], grants: [], routes: [] });
  const before = (await f.runtime.snapshot()).snapshot.budget;
  for (const provider of ['ollama', 'openai', 'anthropic']) {
    const created = await f.call('createProject', [projectInput(provider)]);
    const receipt = await f.call('startRun', [runInput(created.project.id)]);
    assert.equal(receipt.ok, false); assert.equal(receipt.code, 'PAIR_REQUIRED');
    assert.match(receipt.error, /Donna.*paired office goal/);
    assert.equal((await f.call('resumeRun', ['historical-run'])).code, 'PAIR_REQUIRED');
    assert.deepEqual(await f.call('listRuns', [created.project.id]), []);
    assert.equal((await f.call('getProject', [created.project.id])).nodes.length, 2, 'legacy role names are not canonical employee pairs');
  }
  assert.deepEqual(f.calls(), { generations: 0, fetches: 0 });
  assert.deepEqual((await f.runtime.snapshot()).snapshot.budget, before);
  const capabilities = f.runtime.workbench.capabilities();
  assert.equal(capabilities.legacyProjectExecution.enabled, false);
  assert.equal(capabilities.legacyOllamaScopeRequiresResources, resourcesEnabled);
});

test('uncertain resource persistence cannot reopen a legacy provider or billing lane', async t => {
  const f = fixture(t); const original = fs.renameSync;
  fs.renameSync = (source, destination) => {
    if (path.basename(path.dirname(destination)) === 'model-resources' && path.basename(destination) === 'registry.json') throw Object.assign(new Error('Synthetic write uncertainty'), { code: 'EIO' });
    return original(source, destination);
  };
  try { await assert.rejects(f.runtime.resources.configure({ expectedRevision: 0, resources: [], grants: [], routes: [] }), error => error.code === 'RESOURCE_STATE_UNCERTAIN'); }
  finally { fs.renameSync = original; }
  const before = (await f.runtime.snapshot()).snapshot.budget;
  for (const provider of ['ollama', 'openai', 'anthropic']) {
    const created = await f.call('createProject', [projectInput(provider)]);
    assert.equal((await f.call('startRun', [runInput(created.project.id)])).code, 'PAIR_REQUIRED');
  }
  assert.deepEqual(f.calls(), { generations: 0, fetches: 0 });
  assert.deepEqual((await f.runtime.snapshot()).snapshot.budget, before);
});
