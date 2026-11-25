import test from 'node:test';
import assert from 'node:assert/strict';
import { executeCreativeWorkerRequest, prepareCreativeWorkerContext } from '../creative-worker.mjs';

function fixture() {
  const job = { id: 'native-job-1', companyId: 'company-1', employeeId: 'artist-1', allowedTools: ['creative.execute'] };
  const calls = []; let saved;
  const office = { async assertWorkerCapability(scope, capability) { calls.push(['authorize', scope.id, capability]); } };
  const service = {
    async prepareWorker() { return { projects: [{ id: 'game', allowedOperations: ['blender.render'] }], tools: [], assignments: [] }; },
    async run(input, options) { calls.push(['run', input, options]); await options.authorize(); saved = input; return { ok: true, job: { ...input, status: 'running' } }; },
    async job() { calls.push(['poll']); return { ok: true, job: { ...saved, status: 'succeeded', evidenceUri: `creative://jobs/${saved.id}`, outputs: [{ path: 'render.png', sha256: 'a'.repeat(64), bytes: 100 }] } }; },
    async cancel(input) { calls.push(['cancel', input]); return { ok: true }; },
  };
  const controller = new AbortController();
  return { service, office, job, calls, controller, text: JSON.stringify({ projectId: 'game', operation: 'blender.render', input: { path: 'scene.blend', samples: 2 } }), signal: controller.signal, pollMs: 1 };
}

test('creative context checks native authority before reading adapter metadata', async () => {
  const f = fixture(); let reads = 0;
  f.service.prepareWorker = async () => { reads++; return {}; };
  f.office.assertWorkerCapability = async () => { throw new Error('revoked'); };
  await assert.rejects(prepareCreativeWorkerContext(f), /revoked/); assert.equal(reads, 0);
});

test('native scope and a stable job identity are attached by the host; completion carries durable evidence', async () => {
  const f = fixture(); const result = await executeCreativeWorkerRequest(f);
  const run = f.calls.find(c => c[0] === 'run');
  assert.equal(run[1].companyId, f.job.companyId); assert.equal(run[1].employeeId, f.job.employeeId);
  assert.match(run[1].id, /^creative-[a-f0-9]{40}$/);
  assert.equal(run[2].signal, f.signal);
  assert.equal(result.evidenceUrl, `creative://jobs/${run[1].id}`);
  assert.equal(f.calls.some(c => c[0] === 'cancel'), false);
  const replay = fixture(); await executeCreativeWorkerRequest(replay);
  assert.equal(replay.calls.find(c => c[0] === 'run')[1].id, run[1].id);
});

test('model output cannot replace employee scope, request identity or select an executable', async () => {
  for (const extra of [{ companyId: 'other' }, { employeeId: 'donna' }, { id: 'fresh-retry' }, { executable: '/bin/sh' }, { url: 'https://example.test' }]) {
    const f = fixture(); f.text = JSON.stringify({ ...JSON.parse(f.text), ...extra });
    await assert.rejects(executeCreativeWorkerRequest(f), /only projectId/);
    assert.equal(f.calls.length, 0);
  }
});

test('malformed and oversized requests stop before contacting the creative executor', async () => {
  for (const text of ['not json', '[]', '{}', 'x'.repeat(32769)]) {
    const f = fixture(); f.text = text;
    await assert.rejects(executeCreativeWorkerRequest(f)); assert.equal(f.calls.length, 0);
  }
});

test('model cannot select a different department project or an unadvertised operation', async () => {
  for (const change of [{ projectId: 'another-department' }, { operation: 'unreal.validate' }]) {
    const f = fixture(); f.text = JSON.stringify({ ...JSON.parse(f.text), ...change });
    await assert.rejects(executeCreativeWorkerRequest(f), /outside this current native job scope/);
    assert.equal(f.calls.some(c => c[0] === 'run'), false);
  }
});

test('a lost admission acknowledgement triggers cancellation of the original stable request', async () => {
  const f = fixture(), original = f.service.run;
  f.service.run = async (...args) => { await original(...args); throw new Error('acknowledgement lost'); };
  await assert.rejects(executeCreativeWorkerRequest(f), /acknowledgement lost/);
  const request = f.calls.find(c => c[0] === 'run')[1], cancel = f.calls.find(c => c[0] === 'cancel')[1];
  assert.equal(cancel.jobId, request.id); assert.equal(cancel.id, `cancel-${request.id}`);
});

test('a queued request is polled until its receipt succeeds without resubmitting it', async () => {
  const f = fixture(); let polls = 0; const original = f.service.job;
  f.service.job = async () => { const receipt = await original(); polls++; if (polls < 3) receipt.job.status = 'queued'; return receipt; };
  await executeCreativeWorkerRequest(f);
  assert.equal(polls, 3); assert.equal(f.calls.filter(c => c[0] === 'run').length, 1);
});

test('failed creative work does not become a completed native deliverable', async () => {
  const f = fixture(); const original = f.service.job;
  f.service.job = async () => { const receipt = await original(); receipt.job.status = 'failed'; return receipt; };
  await assert.rejects(executeCreativeWorkerRequest(f), /ended as failed/);
  assert.equal(f.calls.filter(c => c[0] === 'cancel').length, 1);
});

test('lease revocation at final acceptance preserves the receipt and rejects acceptance', async () => {
  const f = fixture(); let checks = 0;
  f.office.assertWorkerCapability = async () => { if (++checks === 3) throw new Error('lease revoked'); };
  await assert.rejects(executeCreativeWorkerRequest(f), /lease revoked/);
  assert.equal(f.calls.filter(c => c[0] === 'cancel').length, 1);
});

test('cancellation after admission cancels the original request with one stable cancellation identity', async () => {
  const f = fixture(); const run = f.service.run;
  f.service.run = async (...args) => { const result = await run(...args); f.controller.abort(); return result; };
  await assert.rejects(executeCreativeWorkerRequest(f), /abort/i);
  const cancel = f.calls.find(c => c[0] === 'cancel')[1];
  assert.equal(cancel.id, `cancel-${cancel.jobId}`); assert.equal(cancel.companyId, f.job.companyId);
});

test('cross-company or unrecognized receipts are rejected and retained for inspection', async () => {
  for (const change of [{ companyId: 'other' }, { employeeId: 'other' }, { projectId: 'other' }, { operation: 'unreal.validate' }, { id: 'other' }, { status: 'pretend_success' }, { evidenceUri: 'https://unverified.test' }]) {
    const f = fixture(); const original = f.service.job;
    f.service.job = async () => { const result = await original(); Object.assign(result.job, change); return result; };
    await assert.rejects(executeCreativeWorkerRequest(f));
    assert.equal(f.calls.filter(c => c[0] === 'cancel').length, 1);
  }
});
