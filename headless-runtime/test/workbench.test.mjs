import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createRuntime } from '../runtime.mjs';
import { createWorkbench } from '../workbench.mjs';
import { WORKBENCH_METHODS, validateWorkbenchCall } from '../workbench-contract.mjs';
import { createServer } from '../server.mjs';
import { OUTPUT_LIMIT } from '../contract.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const token = 'synthetic_workbench_control_012345678901234567890';
const disabledFetch = async () => { throw new Error('External calls are forbidden in this test.'); };
const systemInfo = async () => ({ cpuModel: 'Synthetic CPU', logicalCores: 8, totalRamBytes: 2 ** 40, freeRamBytes: 2 ** 40,
  os: { platform: 'linux', release: 'test', arch: 'x64' }, disk: { totalBytes: 2 ** 40, freeBytes: 2 ** 40, path: '/test' }, gpus: [], notes: [] });
const project = () => ({ name: 'Portable project', goal: 'Produce one synthetic report.', provider: 'anthropic', model: 'mock-local-test',
  nodes: [{ role: 'custom', title: 'Writer', instructions: 'Write a concise report.', dependsOn: [] }] });
const runInput = projectId => ({ projectId, runBudget: { maxTokens: 64000, maxMinutes: 1, maxUsd: 2 }, priceRates: { inputUsdPerMillion: 1, outputUsdPerMillion: 1 } });
const id = name => ({ id: name });
async function until(read, predicate) {
  const end = Date.now() + 5000; let value;
  do { value = await read(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 15)); } while (Date.now() < end);
  assert.fail('Expected managed operation to settle within five seconds.');
}
function nativeFixture(t, options = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-workbench-native-'));
  const runtimes = [];
  const open = () => { const runtime = createRuntime({ repoRoot, dataDir, ...options, workbenchPlatform: { fetch: disabledFetch, systemInfo, ...options.workbenchPlatform } }); runtimes.push(runtime); return runtime; };
  t.after(async () => { for (const runtime of runtimes) await runtime.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  return { dataDir, open, runtime: open() };
}

test('workbench manifest covers desktop backend families and explicitly delegates platform effects', async t => {
  const { runtime } = nativeFixture(t); const wb = runtime.workbench;
  const manifest = wb.capabilities();
  for (const name of ['officeSnapshot', 'officeCommand', 'setOfficeWorker', 'modelPoolRequest', 'companySnapshot', 'listProjects', 'getModelCatalog', 'createVenv', 'downloadModel', 'getVaultStatus', 'configureCloud', 'hostSubmit']) assert.equal(manifest.methods[name].available, true, name);
  for (const name of ['startRun', 'resumeRun']) {
    assert.equal(manifest.methods[name].available, false, name);
    assert.equal(manifest.methods[name].code, 'PAIR_REQUIRED');
    assert.match(manifest.methods[name].reason, /Donna.*paired office goal/);
  }
  assert.equal(manifest.legacyProjectExecution.enabled, false);
  for (const name of ['openExternal', 'openPersonalDashboard', 'importCredentialFile', 'onJobEvent']) assert.equal(manifest.methods[name].platformDelegated, true, name);
  assert.equal(manifest.credentialStorage, 'aes-256-gcm-protected-file-key'); assert.equal(manifest.osKeychain, false);
  const delegated = await wb.call('openExternal', ['https://example.invalid']);
  assert.equal(delegated.code, 'PLATFORM_DELEGATION'); assert.equal(delegated.ok, false); assert.equal(delegated.delegated, true);
  assert.equal((await wb.call('getSystemInfo')).cpuModel, 'Synthetic CPU');
  assert.ok(Array.isArray((await wb.call('getModelCatalog')).models));
  assert.equal((await wb.call('companySnapshot')).backend, 'rust');
  assert.deepEqual(await wb.call('getSettings'), { runtimeUrl: null });
  assert.equal((await wb.call('cloudStatus')).configured, false);
  assert.equal((await wb.call('hostStatus')).host.configured, false);
});

test('HTTP workbench keeps owner/Origin controls, rejects unknown methods and returns native CAS receipts', async t => {
  const { runtime } = nativeFixture(t);
  const server = createServer({ runtime, token }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (body, headers = {}) => fetch(origin + '/v1/workbench/call', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await fetch(origin + '/v1/workbench')).status, 401);
  assert.equal((await request({ method: 'officeSnapshot', args: [] }, { Origin: 'https://foreign.invalid' })).status, 403);
  for (const method of ['getSecret', '__proto__', 'workerCommand', 'shell']) assert.equal((await request({ method, args: [] })).status, 404);
  assert.equal((await request({ id: 'bad', method: 'officeCommand', args: [{ action: 'reserve_external' }] })).status, 400);
  const blocked = await request({ id: 'legacy-http-denial', method: 'startRun', args: [runInput('historical-project')] });
  assert.equal(blocked.status, 200); assert.equal((await blocked.json()).result.code, 'PAIR_REQUIRED');
  const snapshot = (await (await request({ method: 'officeSnapshot', args: [] })).json()).result;
  const body = { id: 'create-company', method: 'officeCommand', args: [{ expectedStateHash: snapshot.stateHash,
    command: { action: 'create_company', id: 'workbench-company', name: 'Workbench company' } }] };
  const saved = await (await request(body)).json(); assert.equal(saved.ok, true); assert.equal(saved.result.ok, true);
  assert.equal((await (await request(body)).json()).result.replayed, true);
  assert.equal((await request({ ...body, id: 'stale-owner-intent' })).status, 409);
  assert.equal(saved.result.snapshot.companies.filter(row => row.id === 'workbench-company').length, 1);
});

test('private vault roundtrip, deployment precedence and live model discovery never return key material', async t => {
  const key = 'synthetic-provider-key-not-a-real-credential'; let received;
  const f = nativeFixture(t, { workbenchPlatform: { fetch: async (_url, init) => { received = init.headers['x-api-key']; return new Response(JSON.stringify({ data: [{ id: 'test-model', display_name: 'Test model' }] }), { headers: { 'content-type': 'application/json' } }); } } });
  const result = await f.runtime.workbench.call('setApiKey', ['anthropic', key], id('save-provider'));
  assert.equal(result.status.providers.anthropic.readable, true);
  assert.equal(f.runtime.workbench.getSecret('anthropic'), key);
  await f.runtime.workbench.call('listProviderModels', ['anthropic']); assert.equal(received, key);
  assert.equal((await f.runtime.status()).capabilities.configuredProviders.includes('anthropic'), true);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(key));
  const ciphertext = fs.readFileSync(path.join(f.dataDir, 'vault', 'anthropic.bin')); assert.equal(ciphertext.includes(Buffer.from(key)), false);
  assert.equal(fs.readFileSync(path.join(f.dataDir, 'workbench', 'receipts.json'), 'utf8').includes(key), false);
  await f.runtime.close(); const reopened = f.open(); assert.equal(reopened.workbench.getSecret('anthropic'), key);
  const secretFile = path.join(f.dataDir, 'deployment-secret'); fs.writeFileSync(secretFile, 'synthetic-deployment-precedence', { mode: 0o600 });
  await reopened.close();
  const deployed = createRuntime({ repoRoot, dataDir: f.dataDir, secretFiles: { anthropic: secretFile }, workbenchPlatform: { fetch: disabledFetch } });
  t.after(() => deployed.close());
  assert.equal(deployed.workbench.getSecret('anthropic'), 'synthetic-deployment-precedence');
  await assert.rejects(deployed.workbench.call('revokeApiKey', ['anthropic'], id('revoke-deployment')), error => error.code === 'WORKBENCH_DEPLOYMENT_SECRET');
  await deployed.close();
});

test('legacy projects remain readable while production start and resume do not dispatch or reserve budget', async t => {
  let generations = 0;
  const f = nativeFixture(t, { generate: async () => { generations++; return { text: 'Synthetic portable deliverable.', inputTokens: 12, outputTokens: 8, usageObserved: true }; } });
  const wb = f.runtime.workbench;
  const before = (await f.runtime.snapshot()).snapshot.budget;
  const created = await wb.call('createProject', [project()], id('project-create'));
  assert.equal((await wb.call('createProject', [project()], id('project-create'))).project.id, created.project.id);
  assert.equal((await wb.call('listProjects')).length, 1);
  const input = runInput(created.project.id);
  const started = await wb.call('startRun', [input], id('project-start'));
  assert.equal(started.ok, false); assert.equal(started.code, 'PAIR_REQUIRED');
  assert.deepEqual(await wb.call('startRun', [input], id('project-start')), started);
  assert.equal((await wb.call('resumeRun', ['historical-run'], id('project-resume'))).code, 'PAIR_REQUIRED');
  assert.deepEqual(await wb.call('listRuns', [created.project.id]), []);
  assert.equal(generations, 0); assert.deepEqual((await f.runtime.snapshot()).snapshot.budget, before);
  assert.equal((await wb.call('getProject', [created.project.id])).goal, project().goal);
  await f.runtime.close(); const restored = f.open();
  assert.equal((await restored.workbench.call('createProject', [project()], id('project-create'))).project.id, created.project.id);
  await assert.rejects(restored.workbench.call('createProject', [{ ...project(), name: 'Changed intent' }], id('project-create')), error => error.code === 'WORKBENCH_ID_CONFLICT');
});

test('historical runs and artifacts from the isolated legacy engine remain readable after the production block', async t => {
  const f = nativeFixture(t); const wb = f.runtime.workbench;
  const { ProjectStore, ProjectRunner } = createRequire(import.meta.url)(path.join(repoRoot, 'desktop-shell/dist/main/projects.js'));
  const store = new ProjectStore(f.dataDir); const created = store.createProject(project());
  // Create historical evidence through an isolated synthetic engine, never the production runner.
  const runner = new ProjectRunner(store, async () => ({ text: 'Historical synthetic artifact.', inputTokens: 1, outputTokens: 1, usageObserved: true }));
  const input = runInput(created.id); const started = runner.start(created.id, input.runBudget, input.priceRates); assert.equal(started.ok, true);
  await until(async () => store.listRuns(created.id), rows => rows[0]?.status === 'completed');
  const before = store.getRun(created.id, started.runId);
  assert.match((await wb.call('readArtifact', [created.id, started.runId, 'node-1'])).text, /Historical synthetic artifact/);
  assert.equal((await wb.call('resumeRun', [started.runId], id('historical-resume'))).code, 'PAIR_REQUIRED');
  assert.deepEqual(store.getRun(created.id, started.runId), before);
  await f.runtime.close(); const reopened = f.open();
  assert.deepEqual((await reopened.workbench.call('listRuns', [created.id]))[0], before);
  assert.match((await reopened.workbench.call('readArtifact', [created.id, started.runId, 'node-1'])).text, /Historical synthetic artifact/);
});

test('a newly saved vault key reaches the existing office worker and GitHub resolver without restarting', async t => {
  const providers = createRequire(import.meta.url)(path.join(repoRoot, 'desktop-shell/dist/main/providers.js'));
  const original = providers.generateWithProvider; const observed = [];
  providers.generateWithProvider = async (provider, key, request) => {
    observed.push({ provider, key });
    const text = request.system.includes('distinct helper and reviewer')
      ? JSON.stringify({ verdict: 'accepted', summary: 'The complete synthetic artifact matches the credential propagation task.', evidenceRefs: ['synthetic-artifact-check'] })
      : 'Synthetic worker output';
    return { text, inputTokens: 3, outputTokens: 2, usageObserved: true };
  };
  t.after(() => { providers.generateWithProvider = original; });
  const f = nativeFixture(t); const wb = f.runtime.workbench;
  const key = 'synthetic-live-vault-key';
  await wb.call('setApiKey', ['anthropic', key], id('live-anthropic'));
  await wb.call('setApiKey', ['github', 'synthetic-live-github-key'], id('live-github'));
  assert.equal(f.runtime.office.options.githubToken(), 'synthetic-live-github-key');
  assert.equal((await f.runtime.status()).capabilities.githubPublish, true);
  const snapshot = await wb.call('officeSnapshot'); const company = snapshot.snapshot.companies.find(value => value.status === 'active');
  const office = snapshot.snapshot.offices.find(value => value.companyId === company.id && value.status === 'active');
  const hired = await wb.call('officeCommand', [{ expectedStateHash: snapshot.stateHash, command: { action: 'hire_employee', companyId: company.id,
    officeId: office.id, name: 'Credential fixture reviewer', role: 'Quality reviewer', skillPaths: [] } }], id('hire-vault-reviewer'));
  const reviewer = hired.snapshot.employees.find(employee => employee.companyId === company.id && employee.name === 'Credential fixture reviewer');
  assert.ok(reviewer); assert.notEqual(reviewer.id, company.assistantId);
  await wb.call('officeCommand', [{ expectedStateHash: hired.stateHash, command: { action: 'enqueue_job', companyId: company.id,
    officeId: office.id, employeeId: company.assistantId, reviewerEmployeeId: reviewer.id, goal: 'Synthetic credential propagation verification', mode: 'provider', provider: 'anthropic',
    model: 'synthetic-model', authorized: true, maxTokens: 64000, maxUsd: 1, maxMinutes: 1,
    priceRates: { inputUsdPerMillion: 1, outputUsdPerMillion: 1 }, idempotencyKey: 'live-vault-job' } }], id('enqueue-live-vault'));
  await wb.call('runOfficeQueue', [], id('run-live-vault-primary'));
  await until(() => wb.call('officeWorkerStatus'), value => !value.running);
  await wb.call('runOfficeQueue', [], id('run-live-vault-review'));
  await until(() => wb.call('officeWorkerStatus'), value => !value.running);
  const finished = await wb.call('officeSnapshot');
  const primary = finished.snapshot.jobs.find(job => job.idempotencyKey === 'live-vault-job');
  assert.equal(primary?.status, 'completed'); assert.equal(primary?.pair?.peerEmployeeId, reviewer.id);
  const reviewed = finished.snapshot.jobs.find(job => job.id === primary.pair.reviewJobId);
  assert.equal(reviewed?.status, 'completed'); assert.equal(reviewed?.review?.verdict, 'accepted');
  assert.deepEqual(observed, [{ provider: 'anthropic', key }, { provider: 'anthropic', key }]);
  assert.equal((await wb.call('officeWorkerStatus')).enabled, false);
});

test('uncertain receipt persistence fences writes and restart cannot duplicate a saved project', async t => {
  const f = nativeFixture(t); const wb = f.runtime.workbench;
  const original = fs.renameSync; let writes = 0;
  fs.renameSync = (from, to) => {
    if (to === path.join(f.dataDir, 'workbench', 'receipts.json') && ++writes === 2) throw Object.assign(new Error('synthetic write failure'), { code: 'EIO' });
    return original(from, to);
  };
  try { await assert.rejects(wb.call('createProject', [project()], id('uncertain-project')), error => error.code === 'WORKBENCH_STORAGE_UNCERTAIN'); }
  finally { fs.renameSync = original; }
  assert.equal((await wb.call('listProjects')).length, 1);
  await assert.rejects(wb.call('createProject', [project()], id('another-project')), error => error.code === 'WORKBENCH_STORAGE_UNCERTAIN');
  await f.runtime.close(); const reopened = f.open();
  await assert.rejects(reopened.workbench.call('createProject', [project()], id('uncertain-project')), error => error.code === 'WORKBENCH_UNCERTAIN');
  assert.equal((await reopened.workbench.call('listProjects')).length, 1);
});

test('reviewed model download returns a job promptly and disposal aborts its only transport', async t => {
  let entered; const downloading = new Promise(resolve => { entered = resolve; }); let calls = 0, aborted = false;
  const f = nativeFixture(t, { workbenchPlatform: { fetch: async (_url, options) => {
    calls++; entered(); return new Promise((_, reject) => options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('synthetic abort')); }, { once: true }));
  } } });
  const wb = f.runtime.workbench;
  const receipt = await wb.call('downloadModel', [{ modelId: 'qwen3-8b-q4_k_m', confirmed: true }], id('download-once'));
  assert.equal(receipt.pending, true); assert.ok(receipt.jobId); await downloading;
  const replay = await wb.call('downloadModel', [{ modelId: 'qwen3-8b-q4_k_m', confirmed: true }], id('download-once'));
  assert.equal(replay.jobId, receipt.jobId); assert.equal(calls, 1);
  await f.runtime.close(); assert.equal(aborted, true); assert.equal(wb.diagnostics().activeJobs, 0); assert.equal(wb.diagnostics().pending, 0);
});

test('close aborts environment processes and removes listeners while legacy generation remains disabled', async t => {
  let generations = 0, processStarted; const processStart = new Promise(resolve => { processStarted = resolve; });
  const f = nativeFixture(t, {
    generate: async () => { generations++; assert.fail('Production legacy generation must remain disabled.'); },
    workbenchPlatform: { execFile: async (_file, args, options) => { if (args[0] === '--version') return { stdout: 'Python 3.11.0', stderr: '' }; processStarted(); return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('synthetic process abort')), { once: true })); } },
  });
  const wb = f.runtime.workbench; const created = await wb.call('createProject', [project()], id('close-project'));
  assert.equal((await wb.call('startRun', [runInput(created.project.id)], id('close-run'))).code, 'PAIR_REQUIRED');
  const environment = await wb.call('createVenv', [{ name: 'test-env', confirmed: true }], id('close-env')); assert.equal(environment.pending, true); await processStart;
  assert.equal(generations, 0);
  await f.runtime.close();
  assert.deepEqual(wb.diagnostics(), { closed: true, activeJobs: 0, activeRuns: 0, pending: 0, listeners: 0 });
  await assert.rejects(wb.call('listProjects'), error => error.code === 'WORKBENCH_CLOSED');
  const reopened = f.open(); assert.deepEqual(await reopened.workbench.call('listRuns', [created.project.id]), []);
});

test('200 reopen/request/dispose cycles retain no workbench listeners, jobs or ownership lock', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-workbench-cycles-')); t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const runtime = { office: {}, worker: {}, cloudSync: { enabled: false } };
  for (let count = 0; count < 200; count++) {
    const wb = createWorkbench({ runtime, repoRoot, dataDir, platform: { fetch: disabledFetch } });
    assert.deepEqual(await wb.call('getSettings'), { runtimeUrl: null });
    assert.equal((await wb.call('getVaultStatus')).osKeychain, false);
    await wb.close(); await wb.close();
    assert.deepEqual(wb.diagnostics(), { closed: true, activeJobs: 0, activeRuns: 0, pending: 0, listeners: 0 });
    assert.equal(fs.existsSync(path.join(dataDir, 'workbench', 'owner.lock')), false);
  }
});

test('trusted extension methods are registered once, bounded, authenticated, and cannot replace builtins', async t => {
  const f = nativeFixture(t); const wb = f.runtime.workbench;
  wb.addMethods({ extensionFixtureStatus: { minArgs: 0, maxArgs: 0, mutates: false, handler: async () => ({ ok: true, resources: [] }) } });
  assert.equal(wb.capabilities().methods.extensionFixtureStatus.available, true);
  assert.throws(() => wb.addMethods({ getSecret: { minArgs: 0, maxArgs: 9, mutates: false, handler: () => null } }));
  assert.deepEqual(await wb.call('extensionFixtureStatus'), { ok: true, resources: [] });
  assert.throws(() => wb.addMethods({ later: { minArgs: 0, maxArgs: 0, mutates: false, handler: () => null } }));
  assert.throws(() => validateWorkbenchCall('getSettings', [true]));
  assert.throws(() => validateWorkbenchCall('setApiKey', ['anthropic', 'private']));
  assert.equal(Object.hasOwn(WORKBENCH_METHODS, 'getSecret'), false);
});

test('managed GitHub result survives owner projection without exposing worker fields or changing CAS', async t => {
  const { runtime } = nativeFixture(t); const wb = runtime.workbench;
  const current = await runtime.snapshot(); const native = (await runtime.office.officeSnapshot()).snapshot;
  let calls = 0;
  runtime.office.officeCommand = async () => { calls++; return { ok: true, snapshot: { ...native, lastAction: {
    github: { branches: [{ name: 'main', sha: 'a'.repeat(40) }], apiKey: 'synthetic-hidden-key' },
    leaseToken: 'synthetic-hidden-lease', workerId: 'private-worker',
  } } }; };
  const args = [{ expectedStateHash: current.stateHash, command: { action: 'github_operation', companyId: 'owner', operation: 'branches' } }];
  const result = await wb.call('officeCommand', args, id('managed-github'));
  assert.equal(result.snapshot.lastAction.github.branches[0].name, 'main');
  assert.equal(result.stateHash, current.stateHash);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-hidden|private-worker/);
  assert.deepEqual(await wb.call('officeCommand', args, id('managed-github')), result);
  assert.equal(calls, 1);
});

test('oversized workbench reads never become apparent successful mutation receipts', async t => {
  const { runtime } = nativeFixture(t);
  runtime.workbench.addMethods({ largeRead: { minArgs: 0, maxArgs: 0, mutates: false,
    handler: async () => ({ ok: true, output: 'x'.repeat(OUTPUT_LIMIT) }) } });
  const server = createServer({ runtime, token }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/workbench/call`, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'read-with-id', method: 'largeRead', args: [] }) });
  assert.equal(response.status, 503);
  const body = await response.json(); assert.equal(body.ok, false); assert.equal(body.code, 'RESPONSE_TOO_LARGE');
});
