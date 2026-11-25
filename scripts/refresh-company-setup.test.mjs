import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createNativeCall } from '../tools/atlas-mcp.mjs';
import { syncStateHash } from '../desktop-shell/dist/main/cloudSync.js';
import { planCompanySetup, applyCompanySetup, validateSetupProfiles } from './refresh-company-setup.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binary = process.env.DAFTAR_TEST_CORE ?? path.join(repoRoot, 'native-core/target/release', process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core');
const script = path.join(repoRoot, 'scripts/refresh-company-setup.mjs');
const skill = name => `skills/${name}/SKILL.md`;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-setup-refresh-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function repository(t, names = ['custom-b', 'custom-a', 'assistant', 'assignment', 'group', 'common', 'unrelated']) {
  const directory = temporary(t);
  for (const name of names) {
    const file = path.join(directory, skill(name)); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `---\nname: ${name}\ndescription: Synthetic fixture.\n---\n`);
  }
  return directory;
}
const employee = (id, extra = {}) => ({ id, companyId: 'civic', officeId: 'civic-office', departmentId: null,
  name: `Synthetic ${id}`, role: 'Keep this owner-written role.', kind: 'specialist', status: 'active',
  assignmentKey: null, skillPaths: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...extra });
function office() {
  return { schemaVersion: 1, activeCompanyId: 'civic',
    companies: [{ id: 'civic', name: 'Synthetic civic company', assistantId: 'company-assistant', status: 'active' }],
    offices: [{ id: 'civic-office', companyId: 'civic', name: 'Synthetic office', assistantId: 'office-assistant', status: 'paused' }],
    departments: [{ id: 'civic-dept', companyId: 'civic', officeId: 'civic-office', name: 'Synthetic department', assistantId: 'department-assistant', status: 'active' }],
    employees: [
      employee('donna', { name: 'Renamed global assistant', kind: 'assistant', companyId: null, officeId: null, assignmentKey: 'ceo-assistant', skillPaths: [skill('custom-b'), skill('custom-a')] }),
      employee('company-assistant', { kind: 'assistant', officeId: null }),
      employee('office-assistant', { kind: 'assistant', status: 'paused' }),
      employee('department-assistant', { kind: 'assistant', departmentId: 'civic-dept' }),
      employee('code', { assignmentKey: 'code-engineer', skillPaths: [skill('custom-b'), skill('custom-a')] }),
      employee('curator', { assignmentKey: 'knowledge-curator', status: 'paused' }),
      employee('steward', { assignmentKey: 'github-steward' }),
      employee('director', { assignmentKey: 'subdirector' }),
      employee('qa', { assignmentKey: 'qa-lead' }),
      employee('name-decoy', { name: 'Donna', role: 'code-engineer' }),
      employee('key-decoy', { assignmentKey: 'shared:code-engineer' }),
      employee('historical', { assignmentKey: 'code-engineer', status: 'fired', skillPaths: [skill('retired-and-unavailable')] }),
    ],
    knowledge: [{ id: 'private-fixture', summary: 'Synthetic private knowledge must not enter the plan.', artifactUri: '/synthetic/private-source' }],
    jobs: [], goals: [], schedules: [], budget: { remainingUsd: 20 }, policy: { approvalMode: 'review', dispatchPaused: true },
    portfolio: { groups: [{ id: 'app-civic-intelligence', name: 'Owner-renamed label', companyIds: ['civic'], status: 'paused' }], services: [], contracts: [], roadmap: [] },
    authority: { grants: [{ id: 'keep-permission-fixture', capabilities: ['synthetic.read'] }] }, remoteReceipts: [], events: [], lastAction: null,
  };
}
function profiles() {
  return { schemaVersion: 1, revision: '2026-11-25', classification: 'public-generic-preset', assistantSkillPaths: [skill('assistant')],
    assignmentSkills: { 'code-engineer': [skill('assignment'), skill('common')], 'qa-lead': [skill('unrelated')] },
    groupSkills: { 'app-civic-intelligence': [skill('group'), skill('common')] } };
}

test('every generic portfolio preset has an exact setup route and the existing growth kit ID remains supported', () => {
  const preset = JSON.parse(fs.readFileSync(path.join(repoRoot, 'company/portfolio-presets.json'), 'utf8'));
  const profile = validateSetupProfiles(JSON.parse(fs.readFileSync(path.join(repoRoot, 'company/setup-profiles.json'), 'utf8')));
  for (const group of preset.groups) assert.ok(profile.groupSkills[`app-${group.key}`]?.length, `Missing exact group route for app-${group.key}`);
  assert.deepEqual(profile.groupSkills['app-growth-and-ventures'], profile.groupSkills['growth-and-ventures']);
});

test('exact assistant references, assignment keys and saved group IDs add skills while preserving custom order', t => {
  const root = repository(t), snapshot = office(), before = structuredClone(snapshot);
  const plan = planCompanySetup(snapshot, profiles(), { repoRoot: root });
  const byId = new Map(plan.changes.map(change => [change.employeeId, change]));
  assert.deepEqual(byId.get('donna').skillPaths, ['custom-b', 'custom-a', 'assistant'].map(skill));
  assert.deepEqual(byId.get('code').skillPaths, ['custom-b', 'custom-a', 'assignment', 'common', 'group'].map(skill));
  for (const id of ['company-assistant', 'office-assistant', 'department-assistant']) assert.deepEqual(byId.get(id).skillPaths, [skill('assistant')]);
  for (const id of ['curator', 'steward', 'director']) assert.deepEqual(byId.get(id).skillPaths, ['group', 'common'].map(skill));
  assert.deepEqual(byId.get('qa').skillPaths, [skill('unrelated')], 'Group skills must not leak to QA through a display role.');
  for (const id of ['name-decoy', 'key-decoy', 'historical']) assert.equal(byId.has(id), false);
  assert.equal(plan.counts.assistantEmployees, 4);
  assert.equal(plan.counts.groupEmployees, 4);
  assert.equal(plan.counts.skippedFiredEmployees, 1);
  assert.equal(plan.counts.pausedEmployeesUpdated, 2);
  assert.deepEqual(snapshot, before);
  assert.deepEqual(planCompanySetup(snapshot, profiles(), { repoRoot: root }), plan);
  assert.ok(plan.changes.every(change => /^setup-v1-[a-f0-9]{64}$/.test(change.requestId)));
  const text = JSON.stringify(plan);
  for (const privateValue of ['Synthetic private knowledge', '/synthetic/private-source', 'Keep this owner-written role.', 'keep-permission-fixture']) assert.equal(text.includes(privateValue), false);
});

test('unmatched group IDs are reported and name similarities never select a group', t => {
  const root = repository(t), snapshot = office(), profile = profiles();
  snapshot.portfolio.groups[0].id = 'renamed-id';
  snapshot.portfolio.groups[0].name = 'app-civic-intelligence';
  profile.assignmentSkills['no-current-assignment'] = [skill('unrelated')];
  const plan = planCompanySetup(snapshot, profile, { repoRoot: root });
  assert.deepEqual(plan.unmatchedGroupIds, ['app-civic-intelligence']);
  assert.deepEqual(plan.unmatchedAssignmentKeys, ['no-current-assignment']);
  assert.equal(plan.counts.groupEmployees, 0);
  assert.equal(plan.changes.some(change => change.addedSkillPaths.includes(skill('group'))), false);
});

test('missing profile or custom paths and an overflow late in the plan fail before the first command', async t => {
  const root = repository(t, [...['custom-b', 'custom-a', 'assistant', 'assignment', 'group', 'common', 'unrelated'], ...Array.from({ length: 20 }, (_, i) => `existing-${i}`)]);
  const cases = [
    (snapshot, profile) => { profile.groupSkills['not-currently-saved'] = [skill('missing')]; },
    snapshot => { snapshot.employees.find(e => e.id === 'code').skillPaths.push(skill('missing')); },
    snapshot => { snapshot.employees.find(e => e.id === 'steward').skillPaths = Array.from({ length: 20 }, (_, i) => skill(`existing-${i}`)); },
  ];
  for (const mutate of cases) {
    const snapshot = office(), profile = profiles(); mutate(snapshot, profile); let writes = 0;
    await assert.rejects(applyCompanySetup(snapshot, profile, { repoRoot: root, command: async () => { writes++; } }), /missing|20-skill limit/);
    assert.equal(writes, 0);
  }
});

test('invalid references, duplicate skills and symlink escapes cannot enter a native update', t => {
  const root = repository(t);
  for (const invalid of ['/tmp/SKILL.md', 'skills/../custom-a/SKILL.md', 'skills/custom-a/../../SKILL.md', 'skills\\custom-a\\SKILL.md']) {
    const profile = profiles(); profile.assistantSkillPaths = [invalid];
    assert.throws(() => validateSetupProfiles(profile, { repoRoot: root }), /repository-relative/);
  }
  const duplicate = profiles(); duplicate.assistantSkillPaths.push(skill('assistant'));
  assert.throws(() => validateSetupProfiles(duplicate, { repoRoot: root }), /duplicates/);
  const outside = repository(t, ['escaped']);
  fs.symlinkSync(path.join(outside, 'skills/escaped'), path.join(root, 'skills/escaped'), 'dir');
  const escaped = profiles(); escaped.assistantSkillPaths = [skill('escaped')];
  assert.throws(() => validateSetupProfiles(escaped, { repoRoot: root }), /inside this checkout/);
});

test('native receipt capacity is checked for the entire plan before any employee update', async t => {
  const root = repository(t), snapshot = office(); let writes = 0;
  snapshot.remoteReceipts = Array.from({ length: 9999 }, (_, i) => ({ id: `synthetic-receipt-${i}` }));
  await assert.rejects(applyCompanySetup(snapshot, profiles(), { repoRoot: root, command: async () => { writes++; } }), /receipt capacity/);
  assert.equal(writes, 0);
});

test('invalid assistant ownership and duplicate or dangling registry references fail before any mutation', async t => {
  const root = repository(t);
  for (const mutate of [
    snapshot => { snapshot.companies[0].assistantId = 'name-decoy'; },
    snapshot => { snapshot.departments[0].assistantId = 'office-assistant'; },
    snapshot => snapshot.employees.push(structuredClone(snapshot.employees[0])),
    snapshot => snapshot.portfolio.groups[0].companyIds.push('missing-company'),
  ]) {
    const snapshot = office(); mutate(snapshot); let writes = 0;
    await assert.rejects(applyCompanySetup(snapshot, profiles(), { repoRoot: root, command: async () => { writes++; } }), /ownership|duplicates|missing company/);
    assert.equal(writes, 0);
  }
});

test('each applied transaction guards the latest revision, retains paused/fired records, and reruns with zero updates', async t => {
  const root = repository(t), original = office(); let current = structuredClone(original), commands = [];
  const command = async payload => {
    assert.equal(payload.action, 'apply_remote_command');
    assert.equal(payload.expectedStateHash, syncStateHash(current));
    assert.deepEqual(Object.keys(payload.command).sort(), ['action', 'employeeId', 'skillPaths']);
    commands.push(payload); current = structuredClone(current);
    const employee = current.employees.find(employee => employee.id === payload.command.employeeId);
    employee.skillPaths = [...payload.command.skillPaths]; employee.updatedAt = '2026-11-25T12:00:00Z';
    current.events.push({ id: payload.id, action: 'update_employee' });
    current.remoteReceipts.push({ id: payload.id });
    return { ok: true, snapshot: structuredClone(current) };
  };
  const result = await applyCompanySetup(original, profiles(), { repoRoot: root, command });
  assert.equal(result.receipt.appliedEmployeeUpdates, result.plan.changes.length);
  assert.equal(result.snapshot.employees.find(e => e.id === 'curator').status, 'paused');
  assert.deepEqual(result.snapshot.employees.find(e => e.id === 'historical'), original.employees.find(e => e.id === 'historical'));
  const withoutSkills = rows => rows.map(({ skillPaths, updatedAt, ...row }) => row);
  assert.deepEqual(withoutSkills(result.snapshot.employees), withoutSkills(original.employees));
  for (const key of ['companies', 'offices', 'departments', 'knowledge', 'jobs', 'goals', 'schedules', 'budget', 'policy', 'portfolio', 'authority']) assert.deepEqual(result.snapshot[key], original[key], key);
  const count = commands.length;
  const again = await applyCompanySetup(result.snapshot, profiles(), { repoRoot: root, command });
  assert.equal(again.receipt.appliedEmployeeUpdates, 0);
  assert.equal(commands.length, count);
  assert.deepEqual(original, office());
});

test('a conflict is not retried, and a lost acknowledgement can be recovered by a fresh idempotent plan', async t => {
  const root = repository(t); let writes = 0;
  await assert.rejects(applyCompanySetup(office(), profiles(), { repoRoot: root, command: async () => {
    writes++; return { ok: false, code: 'CONFLICT' };
  } }), /CONFLICT/);
  assert.equal(writes, 1);
  let current = office(); const planned = planCompanySetup(current, profiles(), { repoRoot: root });
  await assert.rejects(applyCompanySetup(current, profiles(), { repoRoot: root, command: async payload => {
    current = structuredClone(current);
    current.employees.find(employee => employee.id === payload.command.employeeId).skillPaths = payload.command.skillPaths;
    throw new Error('Synthetic acknowledgement lost');
  } }), /acknowledgement lost/);
  assert.equal(planCompanySetup(current, profiles(), { repoRoot: root }).changes.length, planned.changes.length - 1);
});

async function nativeFixture(t) {
  const directory = temporary(t);
  const nativeCall = createNativeCall({ repoRoot, seedDir: path.join(repoRoot, 'company'), stateDir: path.join(directory, 'company'), binary });
  const invoke = async (operation, payload = {}) => {
    const result = await nativeCall(operation, payload); assert.equal(result.ok, true, result.code ?? 'Native fixture failed'); return result.snapshot;
  };
  let snapshot = await invoke('office_snapshot');
  const command = async (action, payload = {}) => snapshot = await invoke('office_command', { action, ...payload });
  await command('create_company', { id: 'fixture-refresh', name: 'Synthetic refresh company', repoUrl: 'https://github.com/example/fixture-refresh' });
  await command('bootstrap_directors', { companyId: 'fixture-refresh' });
  await command('upsert_portfolio_group', { id: 'app-civic-intelligence', name: 'Synthetic group', companyIds: ['fixture-refresh'] });
  const code = snapshot.employees.find(e => e.companyId === 'fixture-refresh' && e.assignmentKey === 'code-engineer');
  await command('update_employee', { employeeId: code.id, skillPaths: [skill('chemistry-research'), skill('biology-research')] });
  await command('grant_authority', { employeeId: code.id, scope: { kind: 'company', id: 'fixture-refresh' }, preset: 'partial',
    capabilities: ['team.manage'], reason: 'Synthetic permission-preservation fixture', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
  await command('pause_employee', { employeeId: code.id });
  const qa = snapshot.employees.find(e => e.companyId === 'fixture-refresh' && e.assignmentKey === 'qa-lead');
  await command('fire_employee', { employeeId: qa.id });
  const profile = { schemaVersion: 1, revision: '2026-11-25', classification: 'public-generic-preset',
    assistantSkillPaths: [skill('graph-memory-research')], assignmentSkills: { 'code-engineer': [skill('agent-research-director')] },
    groupSkills: { 'app-civic-intelligence': [skill('physics-research')] } };
  const profilePath = path.join(directory, 'profiles.json'); fs.writeFileSync(profilePath, JSON.stringify(profile));
  return { directory, profilePath, profile, snapshot, invoke, nativeCall, command, codeId: code.id, firedId: qa.id, stateFile: path.join(directory, 'company/company-state.json') };
}
const runCli = (f, extra, core = binary) => spawnSync(process.execPath, [script, '--profiles', f.profilePath, '--core', core, '--user-data-path', f.directory, ...extra], { cwd: repoRoot, encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024 });

test('real native CLI preview is read-only; apply preserves scope, permissions and work; second apply writes no employee changes', async t => {
  const f = await nativeFixture(t), before = await f.invoke('office_snapshot'), bytes = hash(fs.readFileSync(f.stateFile));
  const fakeCore = path.join(f.directory, 'do-not-run-core'); fs.writeFileSync(fakeCore, '#!/bin/sh\nexit 99\n', { mode: 0o700 });
  const output = path.join(f.directory, 'review.json');
  const preview = runCli(f, ['--output', output], fakeCore);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(hash(fs.readFileSync(f.stateFile)), bytes);
  assert.equal(fs.statSync(output).mode & 0o777, 0o600);
  assert.equal(preview.stdout.includes('fixture-refresh'), false);
  const planned = JSON.parse(fs.readFileSync(output, 'utf8'));
  const applied = runCli(f, ['--apply', '--output', path.join(f.directory, 'applied-plan.json')]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).appliedEmployeeUpdates, planned.changes.length);
  const after = await f.invoke('office_snapshot');
  assert.deepEqual(after.employees.find(e => e.id === f.codeId).skillPaths, ['chemistry-research', 'biology-research', 'agent-research-director', 'physics-research'].map(skill));
  assert.equal(after.employees.find(e => e.id === f.codeId).status, 'paused');
  assert.deepEqual(after.employees.find(e => e.id === f.firedId), before.employees.find(e => e.id === f.firedId));
  const withoutSkills = values => values.map(({ skillPaths, updatedAt, ...value }) => value);
  assert.deepEqual(withoutSkills(after.employees), withoutSkills(before.employees));
  for (const key of ['companies', 'offices', 'departments', 'knowledge', 'portfolio', 'jobs', 'schedules', 'policy', 'budget', 'blueprints', 'chatThreads', 'goals', 'checkpoints']) assert.deepEqual(after[key], before[key], key);
  // Native edits append audit entries and rebuild the derived staff index, but
  // neither operation may grant, revoke, widen or change enforcement settings.
  assert.ok(before.authority.grants.length > 0);
  assert.deepEqual(after.authority.grants, before.authority.grants);
  assert.deepEqual(after.authority.managedEmployeeIds, before.authority.managedEmployeeIds);
  assert.deepEqual(after.authority.ledger.slice(0, before.authority.ledger.length), before.authority.ledger);
  const again = runCli(f, ['--apply']);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(JSON.parse(again.stdout).appliedEmployeeUpdates, 0);
  assert.equal((await f.invoke('office_snapshot')).remoteReceipts.length, after.remoteReceipts.length);
});

test('native concurrent changes are not overwritten, and invalid profile CLI writes nothing', async t => {
  const f = await nativeFixture(t), before = await f.invoke('office_snapshot'); let calls = 0;
  await assert.rejects(applyCompanySetup(before, f.profile, { command: async payload => {
    calls++; await f.command('rename_company', { companyId: 'fixture-refresh', name: 'Synthetic owner edit' });
    return f.nativeCall('office_command', payload);
  } }), /CONFLICT/);
  assert.equal(calls, 1);
  const fresh = await f.invoke('office_snapshot');
  assert.deepEqual(fresh.employees, before.employees);
  const bytes = hash(fs.readFileSync(f.stateFile));
  const bad = structuredClone(f.profile); bad.groupSkills['unused-group'] = [skill('synthetic-does-not-exist')];
  fs.writeFileSync(f.profilePath, JSON.stringify(bad));
  const output = path.join(f.directory, 'must-not-be-created.json');
  const rejected = runCli(f, ['--apply', '--output', output]);
  assert.notEqual(rejected.status, 0);
  assert.equal(hash(fs.readFileSync(f.stateFile)), bytes);
  assert.equal(fs.existsSync(output), false);
});
