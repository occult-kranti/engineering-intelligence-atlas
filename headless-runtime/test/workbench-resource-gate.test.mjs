import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuntime } from '../runtime.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const result = () => ({ text: 'Synthetic gated output', inputTokens: 1, outputTokens: 1, usageObserved: true });
const projectInput = (provider, twoNodes = false) => ({ name: 'Resource gate fixture', goal: 'Synthetic output', provider, model: 'unregistered:fixture',
  nodes: [{ role: 'custom', title: 'First', instructions: 'Synthetic output', dependsOn: [] },
    ...(twoNodes ? [{ role: 'custom', title: 'Second', instructions: 'Synthetic followup', dependsOn: [0] }] : [])] });
const runInput = projectId => ({ projectId, runBudget: { maxTokens: 64000, maxMinutes: 1, maxUsd: 1 }, priceRates: { inputUsdPerMillion: 1, outputUsdPerMillion: 1 } });
const scopeRequired = error => error.code === 'WORKBENCH_RESOURCE_SCOPE_REQUIRED';
async function until(read, predicate) {
  const end = Date.now() + 3000;
  do { const value = await read(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 10)); } while (Date.now() < end);
  assert.fail('Synthetic run did not settle within the test bound.');
}
function fixture(t, generate) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-workbench-resource-gate-'));
  const runtime = createRuntime({ repoRoot, dataDir, generate,
    workbenchPlatform: { fetch: async () => { assert.fail('No external transport is allowed.'); } } });
  t.after(async () => { await runtime.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  let sequence = 0;
  return { runtime, call: (method, args = []) => runtime.workbench.call(method, args, { id: `gate-${++sequence}` }),
    enable: () => runtime.resources.configure({ expectedRevision: 0, resources: [], grants: [], routes: [] }) };
}

test('resource enforcement blocks legacy Ollama start before dispatch and leaves budgeted hosted projects usable', async t => {
  const calls = []; const f = fixture(t, async request => { calls.push(request.provider); return result(); });
  await f.enable(); assert.equal(f.runtime.workbench.capabilities().legacyOllamaScopeRequiresResources, true);
  const local = await f.call('createProject', [projectInput('ollama')]);
  await assert.rejects(f.call('startRun', [runInput(local.project.id)]), scopeRequired);
  assert.equal((await f.call('listRuns', [local.project.id])).length, 0); assert.deepEqual(calls, []);
  for (const provider of ['openai', 'anthropic']) {
    const created = await f.call('createProject', [projectInput(provider)]); const started = await f.call('startRun', [runInput(created.project.id)]);
    assert.equal(started.ok, true); await until(() => f.call('listRuns', [created.project.id]), rows => rows[0]?.status === 'completed');
  }
  assert.deepEqual(calls, ['openai', 'anthropic']);
});

test('enabling resource policy during an active legacy project blocks its next model dispatch', async t => {
  let calls = 0, release; const first = new Promise(resolve => { release = resolve; });
  const f = fixture(t, async () => { calls++; if (calls === 1) await first; return result(); });
  t.after(() => release());
  const created = await f.call('createProject', [projectInput('ollama', true)]); await f.call('startRun', [runInput(created.project.id)]);
  await until(async () => calls, value => value === 1); await f.enable(); release();
  const runs = await until(() => f.call('listRuns', [created.project.id]), rows => ['failed','completed','terminated','cancelled'].includes(rows[0]?.status));
  assert.equal(calls, 1); assert.equal(runs[0].nodeStates['node-2'].status, 'failed');
});

test('a paused legacy Ollama run cannot resume after resource enforcement is enabled', async t => {
  let started; const ready = new Promise(resolve => { started = resolve; }); let calls = 0;
  const f = fixture(t, request => { calls++; started(); return new Promise((_, reject) => { const abort = () => reject(new Error('Synthetic cancellation')); request.abortSignal.addEventListener('abort', abort, { once: true }); if (request.abortSignal.aborted) abort(); }); });
  const created = await f.call('createProject', [projectInput('ollama')]); const run = await f.call('startRun', [runInput(created.project.id)]); await ready;
  await f.call('pauseRun', [run.runId]); await f.enable(); await assert.rejects(f.call('resumeRun', [run.runId]), scopeRequired);
  await f.call('cancelRun', [run.runId]); await until(() => f.call('listRuns', [created.project.id]), rows => rows[0]?.status === 'cancelled'); assert.equal(calls, 1);
});
