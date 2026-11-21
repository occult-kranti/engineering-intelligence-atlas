import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createNativeCall } from '../tools/atlas-mcp.mjs';
import { planCompanyHierarchy, applyCompanyHierarchy, assertOutsideGit, PREFERRED_REPOSITORIES } from './reconcile-company-hierarchy.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binary = process.env.DAFTAR_TEST_CORE ?? path.join(repoRoot, 'native-core/target/release', process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core');
const script = path.join(repoRoot, 'scripts/reconcile-company-hierarchy.mjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const company = (id, repo = null, parentCompanyId = null) => ({ id, name: `Synthetic ${id}`, repoUrl: repo ? `https://github.com/example/${repo}` : null, visibility: repo ? 'public' : null, parentCompanyId });
const group = (id, companyIds, name = id) => ({ id, name, companyIds, status: 'active' });
function office() {
  return { schemaVersion: 1, activeCompanyId: 'root', companies: [company('root', 'engineering-intelligence-atlas')],
    employees: [{ id: 'synthetic-worker', privateFixture: 'Employee data remains unchanged.' }],
    knowledge: [{ id: 'synthetic-knowledge', summary: 'Private synthetic body must not enter a plan.', artifactUri: '/synthetic/private-note' }],
    portfolio: { groups: [], services: [], contracts: [{ id: 'contract', fixture: 'Preserve me.' }], ceo: { sharedServicesCompanyId: null }, roadmap: [], transfers: [] } };
}
const commandsById = plan => new Map(plan.changes.map(change => [change.companyId, change.command.parentCompanyId]));

test('all nine public anchors and saved group members receive the requested additive parent relationships', () => {
  const snapshot = office();
  for (const [key, repo] of Object.entries(PREFERRED_REPOSITORIES)) {
    const anchor = key === 'control-platform' ? 'root' : `anchor-${key}`;
    if (anchor !== 'root') snapshot.companies.push(company(anchor, repo));
    snapshot.companies.push(company(`member-${key}`, `example-${key}`));
    snapshot.portfolio.groups.push(group(`app-${key}`, [`member-${key}`, anchor]));
  }
  snapshot.companies.push(company('shared'), company('unrelated', 'unrelated-repo'));
  snapshot.portfolio.ceo.sharedServicesCompanyId = 'shared';
  snapshot.portfolio.services.push({ id: 'service', companyId: 'shared' });
  const before = structuredClone(snapshot), plan = planCompanyHierarchy(snapshot), edges = commandsById(plan);
  for (const key of Object.keys(PREFERRED_REPOSITORIES)) {
    const anchor = key === 'control-platform' ? 'root' : `anchor-${key}`;
    assert.equal(edges.get(`member-${key}`), anchor);
    if (anchor !== 'root') assert.equal(edges.get(anchor), 'root');
  }
  assert.equal(edges.get('shared'), 'root');
  assert.equal(edges.has('root'), false);
  assert.equal(edges.has('unrelated'), false);
  assert.equal(plan.changes.length, 18);
  assert.deepEqual(snapshot, before);
  assert.deepEqual(planCompanyHierarchy(snapshot), plan);
  const text = JSON.stringify(plan);
  for (const privateField of ['Private synthetic body', '/synthetic/private-note', 'Employee data remains', 'Preserve me.']) assert.equal(text.includes(privateField), false);
  assert.ok(plan.changes.every(change => /^hierarchy-v1-[a-f0-9]{64}$/.test(change.requestId)));
  assert.equal(new Set(plan.changes.map(change => change.requestId)).size, plan.changes.length);
});

test('fallback anchors sort existing IDs and recognize preset labels while preserving all existing custom parents', () => {
  const snapshot = office();
  snapshot.companies.push(company('z-last'), company('a-first'), company('custom'), company('member', 'another-repo', 'custom'));
  snapshot.portfolio.groups = [group('owner-renamed-group', ['z-last', 'member', 'a-first'], 'Growth & Ventures')];
  const plan = planCompanyHierarchy(snapshot), edges = commandsById(plan);
  assert.equal(plan.groups[0].presetKey, 'growth-and-ventures');
  assert.equal(plan.groups[0].anchorCompanyId, 'a-first');
  assert.equal(plan.groups[0].anchorReason, 'first-existing-member-by-id');
  assert.equal(edges.get('a-first'), 'root');
  assert.equal(edges.get('z-last'), 'a-first');
  assert.equal(edges.has('member'), false);
  assert.equal(plan.preservedParents[0].parentCompanyId, 'custom');
  assert.equal(edges.has('custom'), false, 'An unrelated non-repository company is not assumed to be a shared service.');
  snapshot.portfolio.groups[0].name = 'An owner-defined group';
  assert.equal(planCompanyHierarchy(snapshot).groups[0].anchorCompanyId, 'a-first');
});

test('existing root parent and shared-service parent remain untouched; empty groups create no identity', () => {
  const snapshot = office();
  snapshot.companies.push(company('custom', 'custom-owner-root'), company('shared', null, 'custom'));
  snapshot.companies[0].parentCompanyId = 'custom';
  snapshot.portfolio.services = [{ id: 'service', companyId: 'shared' }];
  snapshot.portfolio.groups = [group('app-learning-games', [])];
  const plan = planCompanyHierarchy(snapshot);
  assert.equal(plan.changes.length, 0);
  assert.equal(plan.preservedParents.length, 2);
  assert.equal(plan.root.parentCompanyId, 'custom');
  assert.equal(plan.groups[0].anchorCompanyId, null);
});

test('duplicate companies, groups, member edges and multi-group ambiguity fail before any command', async () => {
  const base = office(); base.companies.push(company('child', 'child'));
  const variants = [
    snapshot => snapshot.companies.push(structuredClone(snapshot.companies[0])),
    snapshot => snapshot.portfolio.groups.push(group('group', []), group('group', [])),
    snapshot => snapshot.portfolio.groups.push(group('group', ['child', 'child'])),
    snapshot => snapshot.portfolio.groups.push(group('group-a', ['child']), group('group-b', ['child'])),
  ];
  for (const change of variants) {
    const snapshot = structuredClone(base); change(snapshot); let writes = 0;
    await assert.rejects(applyCompanyHierarchy(snapshot, { command: async () => { writes++; } }), /duplicate|multiple portfolio groups/);
    assert.equal(writes, 0);
  }
});

test('deleted or missing group, parent and shared-service IDs are rejected without inventing replacements', () => {
  for (const mutate of [
    snapshot => snapshot.portfolio.groups.push(group('group', ['deleted-company'])),
    snapshot => { snapshot.companies[0].parentCompanyId = 'deleted-company'; },
    snapshot => snapshot.portfolio.services.push({ id: 'service', companyId: 'deleted-company' }),
  ]) { const snapshot = office(); mutate(snapshot); assert.throws(() => planCompanyHierarchy(snapshot), /missing company/); }
  const missingRoot = office(); missingRoot.companies[0].repoUrl = 'https://github.com/example/another-root';
  assert.throws(() => planCompanyHierarchy(missingRoot), /Exactly one existing Daftar/);
  const duplicateRoot = office(); duplicateRoot.companies.push(company('second-root', 'engineering-intelligence-atlas'));
  assert.throws(() => planCompanyHierarchy(duplicateRoot), /Exactly one existing Daftar/);
});

test('existing and newly implied cycles are rejected as a complete plan before writes', async () => {
  for (const existingCycle of [false, true]) {
    const snapshot = office();
    snapshot.companies.push(company('anchor', 'india-corporate-intelligence', 'child'), company('child', 'child', existingCycle ? 'anchor' : null));
    snapshot.portfolio.groups.push(group('app-civic-intelligence', ['anchor', 'child']));
    let writes = 0;
    await assert.rejects(applyCompanyHierarchy(snapshot, { command: async () => { writes++; } }), /cycle/);
    assert.equal(writes, 0);
  }
  const self = office(); self.companies[0].parentCompanyId = 'root';
  assert.throws(() => planCompanyHierarchy(self), /self cycle/);
});

test('two matching repository anchors are ambiguous and private repositories are not preferred public anchors', () => {
  const snapshot = office();
  snapshot.companies.push(company('a-fallback', 'some-repo'), company('z-preferred', 'fact-duel'));
  snapshot.companies.at(-1).visibility = 'private';
  snapshot.portfolio.groups.push(group('app-learning-games', ['z-preferred', 'a-fallback']));
  assert.equal(planCompanyHierarchy(snapshot).groups[0].anchorCompanyId, 'a-fallback');
  snapshot.companies.at(-1).visibility = 'public';
  snapshot.companies.push({ ...company('another', 'fact-duel'), repoUrl: 'https://github.com/another-owner/fact-duel' });
  snapshot.portfolio.groups[0].companyIds.push('another');
  assert.throws(() => planCompanyHierarchy(snapshot), /multiple preferred repository anchors/);
});

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-hierarchy-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
async function fixture(t) {
  const directory = temporary(t);
  const nativeCall = createNativeCall({ repoRoot, seedDir: path.join(repoRoot, 'company'), stateDir: path.join(directory, 'company'), binary });
  const invoke = async (operation, payload = {}) => {
    const result = await nativeCall(operation, payload);
    assert.equal(result.ok, true, result.code ?? 'Native fixture command failed');
    return result.snapshot;
  };
  let snapshot = await invoke('office_snapshot');
  const command = async (action, payload = {}) => snapshot = await invoke('office_command', { action, ...payload });
  await command('create_company', { id: 'fixture-civic-anchor', name: 'Synthetic civic anchor', repoUrl: 'https://github.com/example/india-corporate-intelligence' });
  await command('create_company', { id: 'fixture-civic-member', name: 'Synthetic civic member', repoUrl: 'https://github.com/example/synthetic-member' });
  await command('ensure_shared_services', { preset: 'standard' });
  await command('upsert_portfolio_group', { id: 'app-civic-intelligence', name: 'Synthetic civic group', companyIds: ['fixture-civic-member', 'fixture-civic-anchor'] });
  await command('add_knowledge', { companyId: 'fixture-civic-member', title: 'Synthetic retained source', summary: 'Retain this fixture body.', artifactUri: 'https://example.com/synthetic-source' });
  return { directory, nativeCall, invoke, command, snapshot, stateFile: path.join(directory, 'company/company-state.json') };
}
const runCli = (f, extra, core = binary) => spawnSync(process.execPath, [script, '--core', core, '--user-data-path', f.directory, ...extra], { cwd: repoRoot, encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024 });

test('real native CLI preview is read-only; apply preserves records and a second apply has zero mutations', async t => {
  const f = await fixture(t), before = await f.invoke('office_snapshot'), originalBytes = hash(fs.readFileSync(f.stateFile));
  const unavailableCore = path.join(f.directory, 'never-invoke-core');
  fs.writeFileSync(unavailableCore, '#!/bin/sh\nexit 99\n', { mode: 0o700 });
  const output = path.join(f.directory, 'review.json');
  const preview = runCli(f, ['--output', output], unavailableCore);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(hash(fs.readFileSync(f.stateFile)), originalBytes);
  const plan = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(plan.changes.length, 3);
  assert.equal(fs.statSync(output).mode & 0o777, 0o600);
  assert.equal(preview.stdout.includes('fixture-civic'), false);
  const applied = runCli(f, ['--apply', '--output', path.join(f.directory, 'applied-plan.json')]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).appliedParentChanges, 3);
  assert.equal(applied.stdout.includes('fixture-civic'), false);
  const after = await f.invoke('office_snapshot');
  const withoutParents = companies => companies.map(({ parentCompanyId, ...other }) => other);
  assert.deepEqual(withoutParents(after.companies), withoutParents(before.companies));
  for (const key of ['employees', 'offices', 'departments', 'knowledge', 'portfolio', 'jobs', 'schedules', 'policy', 'budget', 'blueprints', 'chatThreads', 'goals', 'checkpoints']) assert.deepEqual(after[key], before[key], key);
  assert.equal(after.activeCompanyId, before.activeCompanyId);
  assert.equal(after.remoteReceipts.length - before.remoteReceipts.length, 3);
  const again = runCli(f, ['--apply']);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(JSON.parse(again.stdout).appliedParentChanges, 0);
  assert.equal((await f.invoke('office_snapshot')).remoteReceipts.length, after.remoteReceipts.length);
});

test('native expected-state guard stops a concurrent owner change without applying any planned parent', async t => {
  const f = await fixture(t), snapshot = await f.invoke('office_snapshot'); let calls = 0;
  await assert.rejects(applyCompanyHierarchy(snapshot, { command: async payload => {
    calls++;
    await f.command('rename_company', { companyId: 'fixture-civic-member', name: 'Synthetic owner rename' });
    return f.nativeCall('office_command', payload);
  } }), /CONFLICT/);
  assert.equal(calls, 1, 'No automatic retry is permitted.');
  const current = await f.invoke('office_snapshot');
  assert.ok(current.companies.every(item => item.parentCompanyId == null));
  assert.equal(current.companies.find(item => item.id === 'fixture-civic-member').name, 'Synthetic owner rename');
});

test('a response lost after native commit is recovered by re-planning without duplicate parent receipts', async t => {
  const f = await fixture(t), snapshot = await f.invoke('office_snapshot'), plan = planCompanyHierarchy(snapshot); let calls = 0;
  await assert.rejects(applyCompanyHierarchy(snapshot, { command: async payload => {
    calls++; const result = await f.nativeCall('office_command', payload); assert.equal(result.ok, true);
    throw new Error('Synthetic response lost after commit');
  } }), /response lost/);
  assert.equal(calls, 1);
  const fresh = await f.invoke('office_snapshot');
  assert.equal(planCompanyHierarchy(fresh).changes.length, plan.changes.length - 1);
  const resumed = await applyCompanyHierarchy(fresh, { command: payload => f.nativeCall('office_command', payload) });
  assert.equal(resumed.receipt.appliedParentChanges, plan.changes.length - 1);
  assert.equal(resumed.snapshot.remoteReceipts.length - snapshot.remoteReceipts.length, plan.changes.length);
  assert.equal(planCompanyHierarchy(resumed.snapshot).changes.length, 0);
});

test('CLI refuses state or output inside Git, symlink aliases, and existing plan files before applying', async t => {
  const f = await fixture(t), before = hash(fs.readFileSync(f.stateFile));
  const fakeCheckout = path.join(f.directory, 'checkout');
  assert.equal(spawnSync('git', ['init', '--quiet', fakeCheckout], { encoding: 'utf8' }).status, 0);
  assert.throws(() => assertOutsideGit(path.join(fakeCheckout, 'ignored/private.json')), /outside Git/);
  const alias = path.join(f.directory, 'alias'); fs.symlinkSync(fakeCheckout, alias, 'dir');
  assert.throws(() => assertOutsideGit(path.join(alias, 'plan.json')), /symbolic links/);
  const existing = path.join(f.directory, 'existing.json'); fs.writeFileSync(existing, 'Preserve the prior report.');
  for (const output of [path.join(repoRoot, 'hierarchy-private-test-must-not-exist.json'), path.join(fakeCheckout, 'plan.json'), path.join(alias, 'plan.json'), existing]) {
    const result = runCli(f, ['--apply', '--output', output]);
    assert.notEqual(result.status, 0);
    assert.equal(hash(fs.readFileSync(f.stateFile)), before);
  }
  assert.equal(fs.readFileSync(existing, 'utf8'), 'Preserve the prior report.');
  assert.equal(fs.existsSync(path.join(repoRoot, 'hierarchy-private-test-must-not-exist.json')), false);
  const missing = runCli({ directory: path.join(f.directory, 'missing-runtime') }, ['--apply']);
  assert.notEqual(missing.status, 0);
  assert.equal(fs.existsSync(path.join(f.directory, 'missing-runtime')), false);
});

test('an empty workspace metadata placeholder is not a repository; real nested and bare history remain blocked', t => {
  const directory = temporary(t);
  fs.mkdirSync(path.join(directory, '.git'));
  const privatePath = path.join(directory, 'private', 'plan.json');
  assert.equal(assertOutsideGit(privatePath), privatePath);
  assert.throws(() => assertOutsideGit(path.join(directory, '.git', 'private.json')), /outside Git/);
  const nested = path.join(directory, 'real-checkout');
  assert.equal(spawnSync('git', ['init', '--quiet', nested], { encoding: 'utf8' }).status, 0);
  assert.throws(() => assertOutsideGit(path.join(nested, 'ignored/private.json')), /outside Git/);
  const bare = path.join(directory, 'bare-repository');
  assert.equal(spawnSync('git', ['init', '--bare', '--quiet', bare], { encoding: 'utf8' }).status, 0);
  assert.throws(() => assertOutsideGit(path.join(bare, 'private.json')), /outside Git/);
  fs.writeFileSync(path.join(directory, '.git', 'damaged-history-marker'), 'Preserve unreadable metadata.');
  assert.throws(() => assertOutsideGit(privatePath), /outside Git/);
});
