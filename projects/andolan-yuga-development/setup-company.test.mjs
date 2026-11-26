import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createNativeCall, createToolHandler } from '../../tools/atlas-mcp.mjs';
import { bindingUri, validateCompanyKits, applyCompanyKits, kitEntityId } from '../../scripts/apply-company-kits.mjs';
import { MODEL, REPOSITORY_URL, repositoryIdentity, prepareCompany, applyCompany } from './setup-company.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(directory, '../..');
const binary = path.join(repoRoot, 'desktop-shell/native', process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core');
const kit = JSON.parse(fs.readFileSync(path.join(directory, 'company-kit.json')));

async function fixture(t) {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-yuga-native-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const make = () => createToolHandler({ nativeCall: createNativeCall({ repoRoot, stateDir, seedDir: path.join(repoRoot, 'company'), binary }),
    fetchImpl: async () => { throw new Error('Unexpected network request in native company acceptance.'); } });
  let handler = make(), snapshot = (await handler('office_snapshot', {})).snapshot;
  const commands = [];
  return { stateDir, commands, get snapshot() { return snapshot; },
    command: async (action, payload) => { commands.push(action); return snapshot = (await handler('office_command', { action, payload })).snapshot; },
    restart: async () => { handler = make(); return snapshot = (await handler('office_snapshot', {})).snapshot; } };
}

test('the reviewed company kit and model profile match the native schema and exact model admission', () => {
  assert.equal(validateCompanyKits(kit), kit);
  assert.equal(kit.companies[0].employees.length, 12);
  const profile = JSON.parse(fs.readFileSync(path.join(directory, 'profile.json')));
  assert.equal(profile.models[0].id, MODEL);
  assert.equal(profile.models[0].contextTokens, 8192);
  assert.equal(profile.models[0].storageCeilingBytes, 24 * 1024 ** 3);
  assert.equal(profile.models[0].trialInferenceConcurrency, 1);
  assert.equal(profile.repository.inspectedCommit, 'a35493d67cf5111d7da2ff9eea6c58ed3499aeca');
  assert.equal(profile.currentSourceUpdate.sharedHandoffKeys.length, 5);
  assert.deepEqual(kit.companies[0].knowledge.slice(-5).map(row => row.key), profile.currentSourceUpdate.sharedHandoffKeys);
  for (const spec of kit.companies[0].employees) {
    assert.ok(kit.companies[0].knowledge.some(row => row.key === `prompt-${spec.key}`));
    for (const skill of spec.skillPaths) assert.ok(fs.statSync(path.join(repoRoot, skill)).isFile());
  }
});

test('repository matching rejects URL tricks and never treats a display name as identity', () => {
  assert.equal(repositoryIdentity(REPOSITORY_URL), 'occult-kranti/andolan');
  assert.equal(repositoryIdentity('git@github.com:occult-kranti/ANDOLAN.git'), 'occult-kranti/andolan');
  for (const value of ['https://github.com.attacker.test/occult-kranti/ANDOLAN', 'https://user:secret@github.com/occult-kranti/ANDOLAN',
    'https://github.com/occult-kranti/ANDOLAN?repository=other', 'file:///private/repo', 'https://github.com/occult-kranti/ANDOLAN/tree/main']) {
    assert.equal(repositoryIdentity(value), null);
  }
});

test('real native setup creates repository-bound definitions, role prompts and pending selections without execution', async t => {
  const f = await fixture(t), before = structuredClone(f.snapshot);
  const prepared = prepareCompany(f.snapshot);
  assert.equal(prepared.companyStatus, 'new_repository_binding');
  const result = await applyCompany({ snapshot: f.snapshot, command: f.command });
  const company = result.snapshot.companies.find(row => row.id === prepared.companyId);
  assert.equal(company.repoUrl, REPOSITORY_URL);
  assert.equal(result.receipt.created.employeeDefinitions, prepared.preview.projected.employeeDefinitions);
  assert.equal(result.receipt.roleBindings.length, 12);
  assert.equal(result.receipt.pendingModelSelections.length, 8);
  assert.equal(result.receipt.sourceCommit, 'a35493d67cf5111d7da2ff9eea6c58ed3499aeca');
  assert.equal(result.receipt.teamState, 'definitions_applied_execution_not_started');
  for (const request of result.receipt.pendingModelSelections) {
    assert.equal(request.body.model, MODEL);
    assert.equal(request.body.companyId, company.id);
    assert.ok(result.snapshot.employees.some(employee => employee.id === request.body.employeeId && employee.companyId === company.id));
    assert.equal(request.status, 'pending_installed_digest_verification');
  }
  for (const role of result.receipt.roleBindings) {
    const address = bindingUri(prepared.plan.companies[0], 'knowledge', `prompt-${role.roleKey}`);
    const binding = JSON.parse(result.snapshot.knowledge.find(row => row.artifactUri === address).summary);
    assert.ok(result.snapshot.knowledge.some(row => row.id === binding.entityId && row.companyId === company.id));
  }
  assert.deepEqual(result.snapshot.policy, before.policy);
  assert.deepEqual(result.snapshot.authority.grants, before.authority.grants);
  assert.deepEqual(result.snapshot.jobs, before.jobs);
  assert.deepEqual(result.snapshot.schedules, before.schedules);
  assert.equal(result.snapshot.activeCompanyId, before.activeCompanyId);
  for (const action of ['grant_authority', 'set_policy', 'enqueue_job', 'enable_schedule']) assert.equal(f.commands.includes(action), false);
  const repeated = await applyCompany({ snapshot: await f.restart(), command: f.command });
  assert.equal(repeated.receipt.mutations, 0);
  assert.deepEqual(repeated.receipt.roleBindings, result.receipt.roleBindings);
});

test('prior native kit gains current-source handoffs and two roles while retaining owner contracts and progress', async t => {
  const f = await fixture(t);
  const legacy = JSON.parse(fs.readFileSync(path.join(directory, 'fixtures/company-kit-20261125.json')));
  const oldCompany = legacy.companies[0];
  oldCompany.knowledge.find(row => row.key === 'prompt-moe-coder').summary = 'OWNER_CONTRACT_RETAINED: require independent review before accepting a code patch.';
  const initial = await applyCompanyKits(legacy, { snapshot: f.snapshot,
    command: (action, payload) => f.command(action, action === 'create_company' ? { ...payload, repoUrl: REPOSITORY_URL } : payload) });
  const companyId = initial.receipt.companies[0].companyId;
  const priorEmployeeIds = initial.receipt.companies[0].employeeIds;
  const coder = priorEmployeeIds[oldCompany.employees.findIndex(row => row.key === 'moe-coder')];
  await f.command('rename_company', { companyId, name: 'Owner current Yuga team' });
  await f.command('pause_employee', { employeeId: coder });
  const oldGateId = kitEntityId(oldCompany, 'roadmap', 'source-baseline');
  const oldGate = f.snapshot.portfolio.roadmap.find(row => row.id === oldGateId);
  await f.command('upsert_roadmap_item', { ...oldGate, title: 'Owner accepted source audit', status: 'done', evidence: 'Synthetic owner acceptance retained across the team update.' });
  const before = structuredClone(f.snapshot);
  const current = await applyCompany({ snapshot: f.snapshot, command: f.command });
  assert.equal(current.receipt.created.companies, 0);
  assert.equal(current.receipt.created.employeeDefinitions, 2);
  assert.equal(current.receipt.created.roadmapItems, 6);
  assert.deepEqual(current.receipt.roleBindings.slice(0, 10).map(row => row.employeeId), priorEmployeeIds);
  assert.equal(current.snapshot.companies.find(row => row.id === companyId).name, 'Owner current Yuga team');
  assert.equal(current.receipt.pendingModelSelections.find(row => row.roleKey === 'moe-coder').status, 'paused_scope_preserved');
  const currentGate = current.snapshot.portfolio.roadmap.find(row => row.id === oldGateId);
  assert.equal(currentGate.title, 'Owner accepted source audit');
  assert.equal(currentGate.status, 'done');
  assert.equal(currentGate.evidence, 'Synthetic owner acceptance retained across the team update.');
  for (const record of before.knowledge) assert.deepEqual(current.snapshot.knowledge.find(row => row.id === record.id), record);
  const shared = current.snapshot.knowledge.filter(row => row.companyId === companyId && !row.title.startsWith('Company kit identity:')).slice(-5);
  assert.deepEqual(shared.map(row => row.title), kit.companies[0].knowledge.slice(-5).map(row => row.title));
  assert.ok(shared.every(row => row.artifactUri.includes('a35493d67cf5111d7da2ff9eea6c58ed3499aeca')));
  assert.deepEqual(current.snapshot.authority.grants, before.authority.grants);
  assert.deepEqual(current.snapshot.authority.managedEmployeeIds, before.authority.managedEmployeeIds);
  assert.deepEqual(current.snapshot.policy, before.policy);
  assert.deepEqual(current.snapshot.budget, before.budget);
  assert.deepEqual(current.snapshot.jobs, before.jobs);
  assert.deepEqual(current.snapshot.schedules, before.schedules);
  assert.equal((await applyCompany({ snapshot: await f.restart(), command: f.command })).receipt.mutations, 0);
});

test('existing exact repo identity, owner naming and paused staff are preserved on rerun', async t => {
  const f = await fixture(t);
  await f.command('create_company', { id: 'existing-yuga', name: 'Owner Yuga studio', repoUrl: REPOSITORY_URL });
  const result = await applyCompany({ snapshot: f.snapshot, command: f.command });
  assert.equal(result.receipt.created.companies, 0);
  assert.equal(result.receipt.companies[0].companyId, 'existing-yuga');
  await f.command('rename_company', { companyId: 'existing-yuga', name: 'Owner renamed studio' });
  const coder = result.receipt.roleBindings.find(row => row.roleKey === 'moe-coder').employeeId;
  await f.command('pause_employee', { employeeId: coder });
  const repeated = await applyCompany({ snapshot: await f.restart(), command: f.command });
  assert.equal(repeated.receipt.mutations, 0);
  assert.equal(repeated.snapshot.companies.find(row => row.id === 'existing-yuga').name, 'Owner renamed studio');
  assert.equal(repeated.receipt.pendingModelSelections.find(row => row.roleKey === 'moe-coder').status, 'paused_scope_preserved');
});

test('foreign and ambiguous companies fail before any setup mutation', async t => {
  const f = await fixture(t);
  await f.command('create_company', { id: 'other-company', name: 'Other company', repoUrl: 'https://github.com/example/other' });
  const before = f.commands.length;
  await assert.rejects(applyCompany({ snapshot: f.snapshot, command: f.command, companyId: 'other-company' }), /not bound/);
  assert.equal(f.commands.length, before);
  await f.command('create_company', { id: 'first-yuga', name: 'First studio', repoUrl: REPOSITORY_URL });
  // Current native creation deduplicates repository identities. Challenge a
  // legacy/corrupt snapshot explicitly without pretending native created it.
  const legacy = structuredClone(f.snapshot);
  legacy.companies.push({ ...legacy.companies.find(row => row.id === 'first-yuga'), id: 'second-yuga', name: 'Second studio' });
  assert.throws(() => prepareCompany(legacy), /Several companies/);
  assert.equal(prepareCompany(legacy, { companyId: 'first-yuga' }).companyId, 'first-yuga');
});

test('CLI preview is read-only and explicit apply writes a real native receipt in synthetic state', async t => {
  const f = await fixture(t), file = path.join(f.stateDir, 'company-state.json');
  const before = fs.readFileSync(file);
  const args = [path.join(directory, 'setup-company.mjs'), '--state-dir', f.stateDir];
  const preview = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: 'utf8', timeout: 30000 });
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).teamState, 'preview_only');
  assert.deepEqual(fs.readFileSync(file), before);
  const report = path.join(f.stateDir, 'synthetic-acceptance.json');
  const applied = spawnSync(process.execPath, [...args, '--apply', '--report', report], { cwd: repoRoot, encoding: 'utf8', timeout: 60000 });
  assert.equal(applied.status, 0, applied.stderr);
  const receipt = JSON.parse(fs.readFileSync(report));
  assert.equal(receipt.mode, 'applied');
  assert.equal(receipt.created.companies, 1);
  assert.equal(receipt.modelAssignmentsApplied, 0);
  assert.equal(receipt.workerProcessesStarted, 0);
  assert.equal(receipt.providerRequests, 0);
  assert.equal(receipt.externalWrites, 0);
  assert.equal((await f.restart()).companies.find(row => row.id === 'andolan-yuga-development').repoUrl, REPOSITORY_URL);
});
