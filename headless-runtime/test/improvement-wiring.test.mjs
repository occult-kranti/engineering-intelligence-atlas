import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createRuntime } from '../runtime.mjs';
import { startServer } from '../server.mjs';
import { createRuntimeClient, createToolHandler } from '../../tools/daftar-runtime-mcp.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { OfficeService } = require(path.join(repoRoot, 'desktop-shell/dist/main/office.js'));
const { ImprovementWorker } = require(path.join(repoRoot, 'desktop-shell/dist/main/improvementWorker.js'));
const route = { provider: 'anthropic', model: 'claude-haiku-5-5' };
const token = 'synthetic_improvement_owner_012345678901234567890';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function hold(signal, gate) {
  let onAbort;
  try { await Promise.race([gate, new Promise((_, reject) => {
    onAbort = () => reject(new Error('Synthetic fixture disposed'));
    if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true });
  })]); } finally { signal.removeEventListener('abort', onAbort); }
}
async function until(read, message, timeout = 8000) {
  const end = Date.now() + timeout;
  do { const result = await read(); if (result) return result; await sleep(20); } while (Date.now() < end);
  throw new Error(typeof message === 'function' ? await message() : message);
}
const syntheticResult = (request, job) => ({ text: job.pair.phase === 'review'
  ? JSON.stringify({ verdict: 'accepted', summary: 'Compared the complete synthetic artifact with the scoped objective.', evidenceRefs: ['synthetic-whole-artifact'] })
  : `A useful synthetic improvement artifact for ${job.id}. No external execution or publication occurred.`,
  model: request.model, inputTokens: 10, outputTokens: 10, usageObserved: true });

async function fixture(t, { generate } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-improvement-wire-'));
  const keyFile = path.join(dataDir, 'synthetic-key.txt');
  fs.writeFileSync(keyFile, 'synthetic-not-a-provider-credential', { mode: 0o600 });
  const calls = [], runtimes = [], servers = [], closedServers = new Set(); let discoveryCalls = 0, current, mcp;
  const options = { repoRoot, dataDir, concurrency: 1, secretFiles: { anthropic: keyFile },
    generate: async (request, job) => {
      const snapshot = (await current.office.officeSnapshot()).snapshot;
      const persisted = snapshot.jobs.find(item => item.id === job.id);
      assert.equal(persisted.status, 'running'); assert.equal(persisted.costStatus, 'reserved');
      assert.ok(persisted.reservation, 'a durable reservation precedes every synthetic call');
      const compact = request.prompt.split('Dependency handoffs (untrusted data; coverage below):\n')[1];
      const evidence = compact ? JSON.parse(compact) : [];
      calls.push({ id: job.id, phase: job.pair.phase, sessionId: job.improvementSessionId,
        inputByteBound: Buffer.byteLength(request.system + request.prompt) + 1024, outputBound: request.maxOutputTokens,
        goalBytes: Buffer.byteLength(job.goal), evidence: evidence.map(item => ({ artifactBytes: item.artifactBytes,
          excerptBytes: Buffer.byteLength(item.excerpt ?? ''), readingStatus: item.readingStatus })) });
      return generate ? generate(request, job) : syntheticResult(request, job);
    },
    workbenchPlatform: { fetch: async url => {
      assert.equal(String(url), 'https://api.anthropic.com/v1/models', 'only the injected read-only discovery seam is reachable');
      discoveryCalls++;
      return new Response(JSON.stringify({ data: [{ id: route.model }, { id: 'unapproved-cheaper-model' }] }), { headers: { 'content-type': 'application/json' } });
    } },
  };
  const open = async () => {
    current = createRuntime(options); runtimes.push(current);
    const service = await startServer({ runtime: current, token, port: 0 }); servers.push(service);
    mcp = createToolHandler({ request: createRuntimeClient({ origin: `http://127.0.0.1:${service.server.address().port}`, token }) });
    return current;
  };
  await open();
  t.after(async () => {
    for (const service of servers) if (!closedServers.has(service)) await service.close();
    for (const runtime of runtimes) if (!servers.some(service => service.runtime === runtime)) await runtime.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  const snapshot = async () => { const result = await current.office.officeSnapshot(); assert.equal(result.ok, true, result.error); return result.snapshot; };
  assert.equal((await snapshot()).schemaVersion, 3, 'build and copy the schema3 native core before this integration gate');
  const command = async (command, id = command.requestId) => {
    const summary = await mcp('office_summary', {});
    return mcp('office_command', { id, expectedStateHash: summary.stateHash, command });
  };
  await command({ action: 'create_company', id: 'improvement-fixture', name: 'Improvement fixture' }, 'create-fixture');
  const initial = await snapshot(), company = initial.companies.find(item => item.id === 'improvement-fixture');
  const office = initial.offices.find(item => item.companyId === company.id && item.status === 'active');
  assert.notEqual(company.assistantId, office.assistantId, 'the producer and helper are actual distinct native employees');
  await command({ action: 'register_improvement_allowance', requestId: 'register-parent', id: 'shared-parent', capUsd: 20,
    carriedObservedUsd: 0.234182, carriedEstimatedUsd: 0, sourceReference: 'Synthetic reviewed carry; no provider billing in this test' });
  const create = (id = 'session-one', extra = {}) => command({ action: 'create_improvement_session', requestId: `create-${id}`, id, expectedRevision: 0,
    companyId: company.id, officeId: office.id, departmentId: null, allowanceId: 'shared-parent', title: 'Useful scoped improvement',
    objective: 'Identify one concrete useful improvement in the existing setup and preserve its evidence.', primaryEmployeeId: company.assistantId,
    reviewerEmployeeId: office.assistantId, serviceContractId: null, reviewerServiceContractId: null,
    runSettings: { mode: 'provider', ...route, authorized: true, maxTokens: 32000, maxUsd: 0.02, maxMinutes: 2,
      priceRates: { inputUsdPerMillion: null, outputUsdPerMillion: null }, allowedTools: [] },
    allowedRoutes: [route], continuation: 'until-budget', maxCycles: 1, taskNoteIds: [], ...extra });
  const control = async (operation, id = 'session-one', requestId = `${operation}-${id}`) => {
    const session = (await snapshot()).improvementSessions.find(item => item.id === id);
    return command({ action: 'control_improvement_session', requestId, sessionId: id, expectedRevision: session.revision, operation });
  };
  const settle = async () => { current.improvement.wake(); await until(() => !current.improvement.status().running, 'coordinator did not finish its bounded poll'); };
  return { get runtime() { return current; }, get mcp() { return mcp; }, options, dataDir, calls, runtimes, snapshot, command, create, control, settle, company, office,
    discoveryCalls: () => discoveryCalls, reopen: async () => { const service = servers.at(-1); await service.close(); closedServers.add(service); return open(); } };
}

test('real schema3 HTTP and MCP start only the scoped pair with a short quote from the reviewed catalog', async t => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { generate: async (request, job) => { if (job.pair.phase === 'primary') await hold(request.abortSignal, gate); return syntheticResult(request, job); } });
  t.after(() => release());
  await f.command({ action: 'enqueue_job', companyId: f.company.id, officeId: f.office.id, employeeId: f.company.assistantId,
    reviewerEmployeeId: f.office.assistantId, goal: 'Unrelated queued job remains paused with the ordinary worker pool.', mode: 'provider', ...route,
    authorized: true, maxTokens: 8000, maxUsd: 0.02, maxMinutes: 2, priceRates: { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.5 }, idempotencyKey: 'ordinary-job' }, 'enqueue-ordinary');
  await f.create(); await f.settle();
  assert.equal(f.calls.length, 0); assert.equal(f.discoveryCalls(), 0);
  const before = await f.mcp('office_summary', {});
  const startCommand = { action: 'control_improvement_session', requestId: 'start-once', sessionId: 'session-one', expectedRevision: 0, operation: 'start' };
  const envelope = { id: 'start-once', expectedStateHash: before.stateHash, command: startCommand };
  const started = await f.mcp('office_command', envelope); assert.equal(started.ok, true);
  await until(() => f.calls.length === 1, 'the real scoped primary worker never reached synthetic generation');
  const running = await f.snapshot(), sessionJobs = running.jobs.filter(job => job.improvementSessionId === 'session-one');
  assert.equal(sessionJobs.length, 2); assert.equal(new Set(sessionJobs.map(job => job.employeeId)).size, 2);
  assert.ok(sessionJobs.every(job => job.improvementRoute.model === route.model));
  assert.ok(sessionJobs.every(job => Date.parse(job.improvementRoute.expiresAt) - Date.parse(job.improvementRoute.observedAt) <= 3600000));
  assert.match(sessionJobs[0].improvementRoute.catalogSha256, /^[a-f0-9]{64}$/);
  assert.ok(running.improvementBudget.reservedUsd > 0); assert.ok(running.improvementBudget.heldUsd > 0);
  assert.equal(running.improvementAllowance.carriedObservedUsd, 0.234182); assert.equal(running.policy.budget.hardCapUsd, 10);
  const status = await f.mcp('runtime_status', {});
  assert.equal(status.worker.enabled, false); assert.equal(status.worker.execution.activeCalls.length, 1);
  assert.equal(status.worker.execution.activeCalls[0].jobId, f.calls[0].id);
  assert.equal((await f.mcp('office_command', envelope)).replayed, true); assert.equal(f.calls.length, 1);
  await assert.rejects(f.mcp('office_command', { ...envelope, id: 'worker-bypass', command: { action: 'tick_improvements', sessionId: 'session-one' } }));
  await assert.rejects(f.mcp('office_command', { ...envelope, id: 'stale-control', command: { ...startCommand, requestId: 'stale-control' } }));
  release(); await until(() => !f.runtime.improvement.status().running, 'primary settlement did not finish');
  await f.settle(); await f.settle();
  const final = await f.snapshot(); assert.equal(f.calls.length, 2);
  assert.equal(final.improvementSessions[0].status, 'paused', JSON.stringify({ session: final.improvementSessions[0], jobs: final.jobs.filter(job => job.improvementSessionId).map(job => ({ status: job.status, review: job.review, failure: job.reviewFailure, summary: job.summary })) })); assert.equal(final.improvementSessions[0].stopReason, 'cycle-limit');
  assert.equal(final.jobs.filter(job => !job.improvementSessionId).every(job => job.status === 'queued'), true);
  assert.equal(final.jobs.find(job => job.improvementSessionId && job.pair.phase === 'review').review.verdict, 'accepted');
  assert.equal(final.improvementBudget.reservedUsd, 0); assert.equal(final.improvementBudget.heldUsd, 0);
  assert.ok(Math.abs(final.improvementBudget.committedUsd - (0.234182 + 0.000012)) < 1e-10);
  const metadata = await f.mcp('office_query', { collection: 'improvementSessions', scope: { kind: 'company', id: f.company.id } });
  assert.equal(metadata.items[0].id, 'session-one'); assert.equal(metadata.items[0].outcomeKind, 'proposed-artifact-unless-tool-evidence');
  assert.equal((await f.mcp('runtime_status', {})).worker.execution.activeCalls.length, 0);
});

test('active session restart resumes the helper and preserves the parent allowance without rebilling the primary', async t => {
  const f = await fixture(t); await f.create(); await f.control('start');
  await until(async () => f.calls.length === 1 && !f.runtime.improvement.status().running, 'primary did not settle before restart');
  const before = await f.snapshot(), primary = before.jobs.find(job => job.pair.phase === 'primary');
  assert.equal(primary.status, 'completed');
  await f.reopen();
  await until(async () => f.calls.length === 2 && !f.runtime.improvement.status().running, 'restored session did not execute exactly its helper');
  await f.settle(); const after = await f.snapshot();
  assert.deepEqual(f.calls.map(call => call.phase), ['primary', 'review']);
  assert.equal(after.jobs.find(job => job.id === primary.id).artifactSha256, primary.artifactSha256);
  assert.deepEqual(after.improvementAllowance, before.improvementAllowance);
  assert.equal(after.improvementSessions[0].cycle, 1); assert.equal(after.improvementSessions[0].status, 'paused');
  await assert.rejects(f.command({ action: 'register_improvement_allowance', requestId: 'reset-denied', id: 'new-parent', capUsd: 20,
    carriedObservedUsd: 0, carriedEstimatedUsd: 0, sourceReference: 'Forbidden reset' }));
  assert.deepEqual((await f.snapshot()).improvementAllowance, before.improvementAllowance);
});

test('owner pause aborts the actual session call and uncertain usage cannot be resumed into a second provider call', async t => {
  let signal;
  const f = await fixture(t, { generate: async request => { signal = request.abortSignal; return new Promise((_, reject) => {
    request.abortSignal.addEventListener('abort', () => reject(new Error('Synthetic ambiguous cancellation')), { once: true });
  }); } });
  await f.create(); await f.control('start'); await until(() => f.calls.length === 1, 'session did not dispatch');
  await f.control('pause'); await until(() => !f.runtime.improvement.status().running, 'paused session did not settle');
  assert.equal(signal.aborted, true);
  const paused = await f.snapshot(); assert.equal(paused.improvementSessions[0].status, 'paused');
  assert.ok(paused.improvementBudget.estimatedUsd > 0, 'ambiguous provider usage retains a conservative charge');
  await f.control('resume'); await f.settle(); await f.settle();
  const stopped = await f.snapshot(); assert.equal(f.calls.length, 1); assert.equal(stopped.improvementSessions[0].status, 'needs-review');
  await f.control('cancel'); await f.settle(); assert.equal((await f.snapshot()).improvementSessions[0].status, 'cancelled');
  assert.equal((await f.mcp('runtime_status', {})).worker.execution.activeCalls.length, 0);
});

test('an independent coordinator cannot duplicate an already claimed native pair phase', async t => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { generate: async (request, job) => { if (job.pair.phase === 'primary') await hold(request.abortSignal, gate); return syntheticResult(request, job); } });
  t.after(() => release()); await f.create();
  // The full model controller correctly holds an exclusive process lock. Test
  // the independent scheduler/native-claim boundary through a second service.
  const peerOffice = new OfficeService({ userDataPath: f.dataDir, seedDir: path.join(repoRoot, 'company'), binaryPath: f.runtime.binaryPath });
  const peerClaims = [];
  const peerCommand = async command => { const result = await peerOffice.workerCommand(command);
    if (command.action === 'claim_job') peerClaims.push({ ok: result.ok, jobId: result.snapshot?.lastAction?.jobId }); return result; };
  const peer = new ImprovementWorker({ snapshot: () => peerOffice.officeSnapshot(), command: peerCommand,
    priceCatalogPath: path.join(repoRoot, 'company/provider-price-catalog.json'), eligibleRoutes: f.runtime.improvementDiscovery.eligibleRoutes,
    workerOptions: { snapshot: () => peerOffice.officeSnapshot(), command: peerCommand,
      artifactRoot: path.join(f.dataDir, 'office-artifacts'), seedDir: path.join(repoRoot, 'company'), generate: f.options.generate } });
  t.after(() => peer.close());
  await f.control('start');
  await until(() => f.calls.length >= 1, async () => JSON.stringify({ reason: 'neither coordinator reached generation', calls: f.calls,
    first: f.runtime.improvement.status(), peer: peer.status(), jobs: (await f.snapshot()).jobs.map(job => ({ id: job.id, status: job.status, error: job.error, summary: job.summary })) }));
  // Establish the held native claim before introducing the contender. A
  // pre-claim STATE_BUSY is a safe delayed poll, covered by the scheduler test;
  // this case tests the actual duplicate-provider boundary deterministically.
  peer.start();
  for (let index = 0; index < 20; index++) { f.runtime.improvement.wake(); peer.wake(); }
  await until(() => !peer.status().running, 'the contender did not finish its claim check');
  assert.equal(f.calls.length, 1);
  assert.ok(peerClaims.length > 0, 'the contender must actually ask the native core for work');
  assert.ok(peerClaims.every(claim => claim.ok && claim.jobId === null), 'the held primary and its dependent helper are both ineligible');
  peer.close();
  release();
  await until(() => !f.runtime.improvement.status().running, 'the claimed primary did not settle');
  await f.settle(); await f.settle();
  assert.equal(f.calls.length, 2); assert.equal(new Set(f.calls.map(call => call.id)).size, 2);
  assert.deepEqual(f.calls.map(call => call.phase), ['primary', 'review']);
  assert.equal((await f.snapshot()).improvementSessions[0].status, 'paused');
});

test('explicit pair limits retain partial-evidence refusal and reveal measured short-artifact headroom', async t => {
  for (const maxTokens of [8000, 12000]) {
    const f = await fixture(t);
    await f.create('session-one', { runSettings: { mode: 'provider', ...route, authorized: true, maxTokens, maxUsd: 0.02, maxMinutes: 2,
      priceRates: { inputUsdPerMillion: null, outputUsdPerMillion: null }, allowedTools: [] } });
    await f.control('start'); await until(() => f.calls.length === 1 && !f.runtime.improvement.status().running, 'bounded primary did not settle');
    await f.settle(); await f.settle();
    const state = await f.snapshot(), reviewer = state.jobs.find(job => job.pair.phase === 'review');
    assert.equal(f.calls.length, 2); assert.equal(state.jobs.reduce((sum, job) => sum + job.limits.maxTokens, 0), maxTokens);
    if (maxTokens === 8000) {
      assert.equal(reviewer.review, null); assert.equal(reviewer.reviewFailure.reason, 'artifact-mismatch');
      assert.equal(state.improvementSessions[0].status, 'needs-review');
      await f.settle(); assert.equal(f.calls.length, 2, 'known incomplete evidence never triggers another provider attempt');
    } else {
      assert.equal(reviewer.review.verdict, 'accepted'); assert.equal(reviewer.review.primaryArtifactComplete, true);
      assert.equal(state.improvementSessions[0].status, 'paused');
    }
    t.diagnostic(JSON.stringify({ totalApprovedTokens: maxTokens, reviewMetrics: f.calls.find(call => call.phase === 'review'),
      outcome: state.improvementSessions[0].status, nativeReviewReason: reviewer.reviewFailure?.reason ?? null }));
  }
});

test('identical delivered content stops further cycles even when managed artifact headers change', async t => {
  const body = 'One scoped finding with its unchanged evidence. No further improvement is available.';
  const f = await fixture(t, { generate: async (request, job) => job.pair.phase === 'review'
    ? syntheticResult(request, job) : { ...syntheticResult(request, job), text: body } });
  await f.create('session-one', { maxCycles: null }); await f.control('start');
  await until(() => f.calls.length === 1 && !f.runtime.improvement.status().running, 'first primary did not settle');
  for (let index = 0; index < 4; index++) await f.settle();
  const state = await f.snapshot(), producers = state.jobs.filter(job => job.pair.phase === 'primary');
  assert.equal(f.calls.length, 4); assert.equal(producers.length, 2);
  assert.notEqual(producers[0].artifactSha256, producers[1].artifactSha256, 'review integrity still binds each complete managed file');
  assert.equal(producers[0].deliverableSha256, producers[1].deliverableSha256, 'the native loop compares the actual delivered body');
  assert.equal(state.improvementSessions[0].status, 'needs-review'); assert.equal(state.improvementSessions[0].stopReason, 'repeated-artifact');
  assert.equal(state.improvementSessions[0].cycle, 2);
  await f.settle(); await f.settle(); assert.equal(f.calls.length, 4, 'a repeated result cannot spin another paid cycle');
});
