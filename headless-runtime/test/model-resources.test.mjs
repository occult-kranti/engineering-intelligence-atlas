import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createModelResources, ModelResourcesError } from '../model-resources.mjs';
import { RESOURCE_TOOL_SCHEMAS, validateResourceOperation } from '../model-resources-contract.mjs';

const digest = 'a'.repeat(64);
function setup(t, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-resources-test-'));
  const state = { companies: [{ id: 'acme', status: 'active', assistantId: 'donna', parentCompanyId: null }, { id: 'child', status: 'active', assistantId: 'child-donna', parentCompanyId: 'acme' }, { id: 'other', status: 'active', assistantId: 'other-donna', parentCompanyId: null }],
    offices: [{ id: 'office', companyId: 'acme', status: 'active' }, { id: 'suboffice', companyId: 'acme', status: 'active' }, { id: 'child-office', companyId: 'child', status: 'active' }],
    departments: [{ id: 'engineering', companyId: 'acme', officeId: 'office', status: 'active', parentDepartmentId: null }, { id: 'research', companyId: 'acme', officeId: 'office', status: 'active', parentDepartmentId: 'engineering' }],
    employees: ['alice', 'bob', 'carol'].map(id => ({ id, companyId: 'acme', officeId: 'office', departmentId: 'engineering', status: 'active' })), portfolio: { services: [], contracts: [] }, jobs: [] };
  state.employees.push({ id: 'child-worker', companyId: 'child', officeId: 'child-office', departmentId: null, status: 'active' });
  const models = [{ name: 'qwen3:4b', digest, loaded: false, sizeBytes: 100 }];
  const calls = [];
  const modelPool = { snapshot: async ({ companyId }) => ({ ok: true, snapshot: { available: true, enabled: true, models: structuredClone(models), assignments: state.employees.map(employee => ({ companyId, employeeId: employee.id, model: 'qwen3:4b', digest })) } }), validateJob: async () => {} };
  const nativeCommand = async command => {
    calls.push(structuredClone(command));
    if (command.action === 'cancel_job') { state.jobs.find(job => job.id === command.jobId).status = 'cancelled'; return { ok: true, snapshot: state }; }
    if (!state.jobs.some(job => job.companyId === command.companyId && job.idempotencyKey === command.idempotencyKey)) state.jobs.push({ ...command, id: `native-${state.jobs.length}`, status: 'queued', artifactUri: null, limits: { maxTokens: command.maxTokens, maxMinutes: command.maxMinutes, maxUsd: command.maxUsd } });
    return { ok: true, snapshot: state };
  };
  const options = { stateDir: directory, snapshot: async () => ({ ok: true, snapshot: state }), modelPool, nativeCommand, ...overrides };
  const service = createModelResources(options); const services = [service];
  t.after(async () => { for (const item of services) await item.close().catch(() => {}); fs.rmSync(directory, { force: true, recursive: true }); });
  const resource = { id: 'model', companyId: 'acme', ownerScope: { kind: 'company', id: 'acme' }, model: 'qwen3:4b', digest };
  const grant = { id: 'grant', resourceId: 'model', targetScope: { kind: 'company', id: 'acme' }, permissions: ['use', 'assign', 'inspect'] };
  const expert = id => ({ employeeId: id, resourceId: 'model', officeId: 'office', departmentId: 'engineering' });
  const route = { id: 'route', companyId: 'acme', strategy: 'single', experts: [expert('alice')], limits: { maxTokens: 1000, maxMinutes: 1, maxParallel: 1 } };
  const config = (extra = {}) => ({ expectedRevision: 0, resources: [resource], grants: [grant], routes: [route], ...extra });
  const plan = (id = 'plan') => ({ id, companyId: 'acme', employeeId: 'alice', routeId: 'route', task: 'Review the project with evidence.' });
  return { directory, state, models, calls, service, config, resource, grant, route, expert, plan, restart() { const next = createModelResources(options); services.push(next); return next; } };
}
const reject = (promise, code) => assert.rejects(promise, error => error instanceof ModelResourcesError && error.code === code);
test('explicit active native scope and model grants are mandatory; immutable identities cannot be recycled', async t => {
  const f = setup(t); await f.service.configure(f.config({ grants: [] }));
  const input = { companyId: 'acme', employeeId: 'alice', resourceId: 'model', purpose: 'use' };
  await reject(f.service.resolve(input), 'RESOURCE_GRANT_REQUIRED');
  await f.service.configure(f.config({ expectedRevision: 1 })); assert.equal((await f.service.resolve(input)).resource.digest, digest);
  f.state.employees[0].status = 'fired'; await reject(f.service.resolve(input), 'RESOURCE_SCOPE_DENIED'); f.state.employees[0].status = 'active';
  await reject(f.service.resolve({ ...input, resourceId: 'missing' }), 'RESOURCE_NOT_FOUND');
  await reject(f.service.configure(f.config({ expectedRevision: 2, resources: [{ ...f.resource, digest: 'b'.repeat(64) }] })), 'RESOURCE_IDENTITY_CONFLICT');
  await f.service.configure({ expectedRevision: 2, resources: [], grants: [], routes: [] });
  await reject(f.service.configure(f.config({ expectedRevision: 3, resources: [{ ...f.resource, model: 'qwen3:8b' }] })), 'RESOURCE_IDENTITY_CONFLICT');
});
test('company descendant membership does not expand on reparent; departed descendants lose access', async t => {
  const f = setup(t); const grant = { ...f.grant, includeDescendants: true, membershipRevision: 0 }; await f.service.configure(f.config({ grants: [grant] }));
  const request = { companyId: 'child', employeeId: 'child-worker', resourceId: 'model', purpose: 'use' };
  assert.equal((await f.service.resolve(request)).ok, true);
  f.state.companies[1].parentCompanyId = null; await reject(f.service.resolve(request), 'RESOURCE_GRANT_REQUIRED');
  f.state.companies[2].parentCompanyId = 'acme'; f.state.employees.push({ id: 'new-worker', companyId: 'other', officeId: null, departmentId: null, status: 'active' });
  const newer = { ...request, companyId: 'other', employeeId: 'new-worker' };
  await reject(f.service.resolve(newer), 'RESOURCE_GRANT_REQUIRED');
  await f.service.configure(f.config({ expectedRevision: 1, grants: [grant] })); await reject(f.service.resolve(newer), 'RESOURCE_GRANT_REQUIRED');
  await f.service.configure(f.config({ expectedRevision: 2, grants: [{ ...grant, membershipRevision: 1 }] })); assert.equal((await f.service.resolve(newer)).ok, true);
});
test('department scopes and sidecar office parents validate canonical boundaries and cycles', async t => {
  const f = setup(t);
  await reject(f.service.configure(f.config({ officeParents: [{ officeId: 'office', parentOfficeId: 'child-office' }] })), 'RESOURCE_SCOPE_DENIED');
  await reject(f.service.configure(f.config({ officeParents: [{ officeId: 'office', parentOfficeId: 'suboffice' }, { officeId: 'suboffice', parentOfficeId: 'office' }] })), 'RESOURCE_HIERARCHY_INVALID');
  await f.service.configure(f.config({ grants: [{ ...f.grant, targetScope: { kind: 'department', id: 'engineering' }, includeDescendants: true }] }));
  f.state.employees[1].departmentId = 'research'; assert.equal((await f.service.resolve({ companyId: 'acme', employeeId: 'bob', resourceId: 'model', purpose: 'use' })).ok, true);
  assert.equal((await f.service.status()).resources.capabilities.nativeSuboffices, false);
});
test('concurrent plan/start duplicates enqueue one native job, never call a provider directly', async t => {
  const f = setup(t); await f.service.configure(f.config());
  const plans = await Promise.all(Array.from({ length: 20 }, () => f.service.plan(f.plan()))); assert.equal(plans.filter(item => !item.replayed).length, 1);
  const input = { id: 'run', planId: 'plan', expectedPlanHash: plans[0].plan.planHash };
  const runs = await Promise.all(Array.from({ length: 20 }, () => f.service.start(input)));
  assert.equal(runs.filter(item => !item.replayed).length, 1); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].action, 'enqueue_job'); assert.equal(f.calls[0].provider, 'ollama');
  assert.deepEqual(f.calls[0].allowedTools, ['provider.run']);
  await reject(f.service.plan({ ...f.plan(), task: 'Different' }), 'RESOURCE_IDEMPOTENCY_CONFLICT');
  await f.service.close(); const reopened = f.restart(); assert.equal((await reopened.start(input)).replayed, true); assert.equal(f.calls.length, 1);
});
test('native ensemble DAG carries distinct expert provenance and bounded aggregate limits', async t => {
  const f = setup(t); const route = { ...f.route, strategy: 'ensemble', experts: [f.expert('alice'), f.expert('bob')], aggregator: f.expert('carol') };
  await f.service.configure(f.config({ routes: [route] })); const plan = (await f.service.plan(f.plan())).plan;
  assert.equal(plan.trainedMoe, false); assert.deepEqual(plan.steps[1].dependsOn, [0]); assert.deepEqual(plan.steps[2].dependsOn, [0, 1]);
  await f.service.start({ id: 'run', planId: 'plan', expectedPlanHash: plan.planHash });
  assert.equal(f.calls.length, 3); assert.ok(f.calls.reduce((sum, item) => sum + item.maxTokens, 0) <= 1000);
  assert.deepEqual(f.calls[2].dependencies, ['native-0', 'native-1']); assert.ok(f.calls[2].goal.startsWith('Synthesize'));
  for (const job of f.state.jobs) { job.status = 'completed'; job.artifactUri = `artifact:${job.id}`; }
  const done = await f.service.inspect({ id: 'run' }); assert.equal(done.run.status, 'completed'); assert.equal(done.run.steps[2].artifactUri, 'artifact:native-2');
});
test('revocation and digest drift block start and already-enqueued worker validation', async t => {
  const f = setup(t); await f.service.configure(f.config()); const plan = (await f.service.plan(f.plan())).plan;
  f.models[0].digest = 'b'.repeat(64);
  await reject(f.service.start({ id: 'run', planId: 'plan', expectedPlanHash: plan.planHash }), 'RESOURCE_DIGEST_CHANGED');
  // Revocation remains possible while an installed digest has drifted.
  await f.service.configure(f.config({ expectedRevision: 1, grants: [] })); assert.equal(f.calls.length, 0);
  f.models[0].digest = digest; await reject(f.service.start({ id: 'run', planId: 'plan', expectedPlanHash: plan.planHash }), 'RESOURCE_GRANT_REQUIRED');
  await f.service.configure(f.config({ expectedRevision: 2 })); await f.service.start({ id: 'run', planId: 'plan', expectedPlanHash: plan.planHash });
  await f.service.validateJob(f.state.jobs[0]); await f.service.configure(f.config({ expectedRevision: 3, grants: [] }));
  await reject(f.service.validateJob(f.state.jobs[0]), 'RESOURCE_GRANT_REQUIRED');
  const cancelled = await f.service.cancel({ id: 'run' }); assert.equal(cancelled.run.status, 'cancelled');
});
test('a lost native enqueue result creates uncertainty and is not retried', async t => {
  let calls = 0; const f = setup(t, { nativeCommand: async () => { calls++; throw new Error('disconnected'); } });
  await f.service.configure(f.config()); const plan = (await f.service.plan(f.plan())).plan; const input = { id: 'run', planId: 'plan', expectedPlanHash: plan.planHash };
  assert.equal((await f.service.start(input)).run.status, 'uncertain'); await f.service.start(input); assert.equal(calls, 1);
  await f.service.close(); await f.restart().start(input); assert.equal(calls, 1);
});
test('uncertain resource persistence fences API authority before and after rename', async t => {
  for (const after of [false, true]) {
    const f = setup(t); const rename = fs.renameSync; const target = path.join(f.directory, 'model-resources', 'registry.json');
    fs.renameSync = (source, destination) => { if (destination !== target) return rename(source, destination); if (after) rename(source, destination); throw Object.assign(new Error('EIO'), { code: 'EIO' }); };
    try { await reject(f.service.configure(f.config()), 'RESOURCE_STATE_UNCERTAIN'); } finally { fs.renameSync = rename; }
    await reject(f.service.status(), 'RESOURCE_STATE_UNCERTAIN'); await reject(f.service.plan(f.plan()), 'RESOURCE_STATE_UNCERTAIN');
    await f.service.close(); assert.equal((await f.restart().status()).resources.revision, after ? 1 : 0);
  }
});
test('model gates reject unknown models, schema rejects training, locks release on close', async t => {
  const f = setup(t); await f.service.configure(f.config());
  assert.throws(() => f.restart(), error => error.code === 'RESOURCE_BUSY');
  assert.equal((await f.service.authorizeModelOperation('select', { companyId: 'acme', employeeId: 'alice', model: 'qwen3:4b' })).ok, true);
  await reject(f.service.authorizeModelOperation('select', { companyId: 'acme', employeeId: 'alice', model: 'unregistered' }), 'RESOURCE_NOT_REGISTERED');
  assert.throws(() => validateResourceOperation('configure', f.config({ routes: [{ ...f.route, strategy: 'train-moe' }] })), error => error.code === 'RESOURCE_TRAINING_UNSUPPORTED');
  assert.throws(() => validateResourceOperation('__proto__', {}), ModelResourcesError); assert.equal(Object.keys(RESOURCE_TOOL_SCHEMAS).length, 7);
});

test('foreign employees need a native service contract in addition to a resource grant', async t => {
  const f = setup(t); f.state.offices.push({ id: 'other-office', companyId: 'other', status: 'active' });
  f.state.employees.push({ id: 'visitor', companyId: 'other', officeId: 'other-office', departmentId: null, status: 'active' });
  await f.service.configure(f.config()); const input = { companyId: 'acme', employeeId: 'visitor', resourceId: 'model', purpose: 'use' };
  await reject(f.service.resolve(input), 'RESOURCE_SCOPE_DENIED');
  f.state.portfolio.services.push({ id: 'service', companyId: 'other', officeId: 'other-office', departmentId: null, employeeIds: ['visitor'], status: 'active' });
  f.state.portfolio.contracts.push({ id: 'contract', serviceId: 'service', recipientCompanyId: 'acme', recipientOfficeId: 'office', recipientDepartmentId: 'engineering', employeeIds: ['visitor'], allowedTools: ['provider.run'], status: 'active' });
  assert.equal((await f.service.resolve(input)).ok, true); f.state.portfolio.contracts[0].status = 'revoked';
  await reject(f.service.resolve(input), 'RESOURCE_SCOPE_DENIED');
});

test('worker validation rejects changed native commands and orphan routing identities', async t => {
  const f = setup(t); await f.service.configure(f.config()); const plan = (await f.service.plan(f.plan())).plan;
  await f.service.start({ id: 'run', planId: 'plan', expectedPlanHash: plan.planHash });
  await reject(f.service.validateJob({ ...f.state.jobs[0], goal: 'different instruction' }), 'RESOURCE_NATIVE_CONFLICT');
  await reject(f.service.validateJob({ ...f.state.jobs[0], id: 'orphan', idempotencyKey: 'resource:no-receipt' }), 'RESOURCE_NATIVE_CONFLICT');
});
