import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createNativeCall } from '../../tools/atlas-mcp.mjs';
import { setupCreativeCompany } from '../../integrations/creative-tools/setup-company.mjs';
import { CreativeToolsService } from '../creative-tools.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const core = path.join(repoRoot, 'native-core/target/release/atlas-core');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-creative-setup-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const userDataPath = path.join(root, 'runtime'), projectRoot = path.join(root, 'project'), configFile = path.join(root, 'creative.json');
  fs.mkdirSync(userDataPath, { mode: 0o700 }); fs.mkdirSync(projectRoot);
  const git = args => execFileSync('git', ['-C', projectRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '--initial-branch=main']); git(['config', 'user.name', 'Synthetic fixture']); git(['config', 'user.email', 'fixture@example.test']);
  git(['remote', 'add', 'origin', 'https://github.com/example/creative-fixture.git']);
  fs.writeFileSync(path.join(projectRoot, 'README.md'), 'Synthetic reviewed fixture.\n'); git(['add', 'README.md']); git(['commit', '-m', 'Synthetic fixture']);
  fs.writeFileSync(configFile, JSON.stringify({ schemaVersion: 1, tools: { blender: { executable: process.execPath }, unreal: { executable: '/not-installed/UnrealEditor-Cmd' }, ffmpeg: { executable: '/not-installed/ffprobe' } }, projects: [] }), { mode: 0o600 });
  const native = createNativeCall({ repoRoot, binary: core, seedDir: path.join(repoRoot, 'company'), stateDir: path.join(userDataPath, 'company') });
  const invoke = async (operation, payload = {}) => { const result = await native(operation, payload); assert.equal(result.ok, true, JSON.stringify(result)); return result.snapshot; };
  const command = async (action, payload = {}) => invoke('office_command', { action, ...payload });
  await invoke('office_snapshot'); await command('create_company', { id: 'creative-fixture', name: 'Synthetic creative studio', repoUrl: 'https://github.com/example/creative-fixture' });
  const options = { userDataPath, projectRoot, configFile, core, companyId: 'creative-fixture', repository: 'example/creative-fixture' };
  return { root, ...options, options, git, command, snapshot: () => invoke('office_snapshot'), stateFile: path.join(userDataPath, 'company/company-state.json'),
    readState: () => JSON.parse(fs.readFileSync(path.join(userDataPath, 'company/company-state.json'), 'utf8')).office };
}

test('setup preview verifies repo and plans existing company without native/config/registry writes', async t => {
  const f = await fixture(t), stateHash = hash(f.stateFile), configHash = hash(f.configFile);
  const preview = await setupCreativeCompany({ ...f.options, core: '/this/core/must/not/be/invoked' });
  assert.equal(preview.mode, 'preview'); assert.equal(preview.preview.projected.companies, 0);
  assert.equal(preview.preview.projected.departments, 3); assert.equal(preview.preview.projected.employeeDefinitions, 8);
  assert.equal(preview.projects.length, 3); assert.equal(preview.repositoryDirty, false);
  assert.equal(hash(f.stateFile), stateHash); assert.equal(hash(f.configFile), configHash);
  assert.ok(!fs.existsSync(path.join(f.userDataPath, 'creative-tools')));
});

test('read-only preview disables repository fsmonitor hooks and ignores inherited Git directory overrides', async t => {
  const f = await fixture(t), marker = path.join(f.root, 'hook-ran'), hook = path.join(f.root, 'fsmonitor.sh');
  fs.writeFileSync(hook, `#!/bin/sh\ntouch '${marker}'\n`, { mode: 0o700 });
  f.git(['config', 'core.fsmonitor', hook]);
  const prior = process.env.GIT_DIR; process.env.GIT_DIR = '/invalid-inherited-git-dir';
  try { const result = await setupCreativeCompany(f.options); assert.equal(result.repository, f.repository); assert.ok(!fs.existsSync(marker)); }
  finally { if (prior === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = prior; }
});

test('real native setup binds five permanent specialists, three departments, scoped grants and tool assignments once', async t => {
  const f = await fixture(t), before = f.readState();
  const result = await setupCreativeCompany({ ...f.options, apply: true });
  const state = f.readState(), company = result.kit.companies[0];
  assert.equal(result.kit.created.companies, 0); assert.equal(result.kit.created.departments, 3);
  assert.equal(company.employeeIds.length, 5); assert.equal(result.projectsAdded, 3);
  assert.equal(result.grants.filter(g => g.status === 'created').length, 5);
  const grants = state.authority.grants.filter(g => company.employeeIds.includes(g.employeeId));
  assert.equal(grants.length, 5);
  for (const grant of grants) { assert.deepEqual(grant.capabilities, ['creative.execute', 'provider.run']); assert.equal(grant.issuer, 'owner'); assert.equal(grant.scope.kind, 'department'); assert.ok(Date.parse(grant.expiresAt) - Date.now() <= 24 * 3600000); }
  assert.equal(state.jobs.length, before.jobs.length); assert.equal(state.schedules.length, before.schedules.length);
  assert.deepEqual(state.policy, before.policy); assert.deepEqual(state.budget, before.budget);
  assert.equal(state.activeCompanyId, before.activeCompanyId);
  assert.equal(fs.statSync(f.configFile).mode & 0o777, 0o600);
  const config = JSON.parse(fs.readFileSync(f.configFile));
  assert.ok(config.projects.every(p => p.repository === 'example/creative-fixture' && p.root === f.projectRoot && p.departmentId));
  const registryPath = path.join(f.userDataPath, 'creative-tools/registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath));
  assert.equal(registry.assignments.length, 5); assert.equal(registry.jobs.length, 0);
  const nativeHash = hash(f.stateFile), configHash = hash(f.configFile), registryHash = hash(registryPath);
  const repeated = await setupCreativeCompany({ ...f.options, apply: true });
  assert.equal(repeated.kit.mutations, 0); assert.equal(repeated.projectsAdded, 0);
  assert.ok(repeated.grants.every(g => g.status === 'retained_without_renewal'));
  assert.equal(hash(f.stateFile), nativeHash); assert.equal(hash(f.configFile), configHash); assert.equal(hash(registryPath), registryHash);
  assert.equal(repeated.providerRequests + repeated.creativeJobsStarted + repeated.remoteWrites, 0);
});

test('rerun preserves revoked grant, removed assignment, renamed employee and paused department', async t => {
  const f = await fixture(t), installed = await setupCreativeCompany({ ...f.options, apply: true });
  const employeeId = installed.kit.companies[0].employeeIds[0], grantId = installed.grants.find(g => g.employeeId === employeeId).grantId;
  await f.command('revoke_authority', { grantId, issuer: 'owner', reason: 'Synthetic owner revocation' });
  await f.command('update_employee', { employeeId, name: 'Owner chosen name', role: 'Owner chosen creative role' });
  const assignment = installed.assignments.find(a => a.employeeId === employeeId);
  const service = new CreativeToolsService({ stateDir: f.userDataPath, repoRoot, configFile: f.configFile, snapshot: async () => ({ ok: true, snapshot: f.readState() }) });
  await service.assign({ id: 'owner-remove-tools', companyId: f.companyId, employeeId, projectId: assignment.projectId, toolIds: [] }); await service.close();
  const departmentId = f.readState().employees.find(e => e.id === employeeId).departmentId;
  await f.command('pause_department', { departmentId });
  const before = f.readState();
  await setupCreativeCompany({ ...f.options, apply: true });
  const after = f.readState();
  assert.deepEqual(after.authority.grants, before.authority.grants);
  assert.equal(after.employees.find(e => e.id === employeeId).name, 'Owner chosen name');
  assert.equal(after.departments.find(d => d.id === departmentId).status, 'paused');
  const assignments = JSON.parse(fs.readFileSync(path.join(f.userDataPath, 'creative-tools/registry.json'))).assignments;
  assert.deepEqual(assignments.find(a => a.employeeId === employeeId).toolIds, []);
});

test('unknown company, mismatched origin and invalid private config fail before changes', async t => {
  const f = await fixture(t), stateHash = hash(f.stateFile);
  await assert.rejects(setupCreativeCompany({ ...f.options, companyId: 'missing', apply: true }), /existing company/);
  await assert.rejects(setupCreativeCompany({ ...f.options, repository: 'example/other', apply: true }), /does not match/);
  fs.chmodSync(f.configFile, 0o644);
  await assert.rejects(setupCreativeCompany({ ...f.options, apply: true }), { code: 'CREATIVE_CONFIG_INVALID' });
  assert.equal(hash(f.stateFile), stateHash); assert.ok(!fs.existsSync(path.join(f.userDataPath, 'creative-tools')));
});

test('running runtime lock blocks setup before employee mutation', async t => {
  const f = await fixture(t), before = hash(f.stateFile);
  const service = new CreativeToolsService({ stateDir: f.userDataPath, repoRoot, configFile: f.configFile, snapshot: async () => ({ ok: true, snapshot: f.readState() }) });
  try { await assert.rejects(setupCreativeCompany({ ...f.options, apply: true }), { code: 'CREATIVE_STATE_BUSY' }); assert.equal(hash(f.stateFile), before); }
  finally { await service.close(); }
});

test('owner-edited project configuration is never silently overwritten', async t => {
  const f = await fixture(t); await setupCreativeCompany({ ...f.options, apply: true });
  const config = JSON.parse(fs.readFileSync(f.configFile)); config.projects[0].allowedOperations = ['blender.inspect']; fs.writeFileSync(f.configFile, JSON.stringify(config));
  const before = hash(f.configFile), stateHash = hash(f.stateFile);
  await assert.rejects(setupCreativeCompany({ ...f.options, apply: true }), /changed by the owner/);
  assert.equal(hash(f.configFile), before); assert.equal(hash(f.stateFile), stateHash);
});

test('fired bound specialist requires explicit review instead of recreation', async t => {
  const f = await fixture(t), installed = await setupCreativeCompany({ ...f.options, apply: true });
  await f.command('fire_employee', { employeeId: installed.kit.companies[0].employeeIds[1] });
  const before = hash(f.stateFile);
  await assert.rejects(setupCreativeCompany({ ...f.options, apply: true }), /fired/);
  assert.equal(hash(f.stateFile), before);
});
