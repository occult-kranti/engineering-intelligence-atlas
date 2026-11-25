#!/usr/bin/env node
/** Offline, resumable wiring for an existing company and reviewed Git checkout. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applyCompanyKits, planCompanyKits, validateCompanyKits, bindingUri } from '../../scripts/apply-company-kits.mjs';
import { createNativeCall, parseRepository } from '../../tools/atlas-mcp.mjs';
import { CreativeToolsService, readCreativeConfig } from '../../headless-runtime/creative-tools.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(`Creative setup: ${message}`); };
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const OPERATIONS = {
  graphics: ['blender.inspect', 'blender.render', 'blender.export_glb', 'inkscape.export_png', 'ffmpeg.probe'],
  'game-engineering': ['unreal.inspect', 'unreal.validate', 'blender.inspect', 'ffmpeg.probe'],
  'creative-qa': ['blender.inspect', 'unreal.inspect', 'unreal.validate', 'ffmpeg.probe'],
};
const toolFor = operation => operation.startsWith('adobe.') ? 'adobe-photoshop' : operation.split('.')[0];

function regular(file, limit, directory = false) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || file.includes('\0')) fail('Use absolute local paths.');
  let current = path.parse(file).root;
  for (const part of path.resolve(file).slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part); const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) fail('Symlinked setup paths require local review.');
  }
  const stat = fs.lstatSync(file);
  if (directory ? !stat.isDirectory() : !stat.isFile() || stat.size > limit) fail('Use an existing bounded regular file or directory.');
  return stat;
}
function jsonFile(file, limit) { regular(file, limit); return JSON.parse(fs.readFileSync(file, 'utf8')); }
function nativeOffice(userDataPath) { return jsonFile(path.join(userDataPath, 'company/company-state.json'), 32 * 1024 * 1024).office; }
function normalizeRepo(value) {
  const ssh = /^git@github\.com:([^\s]+)$/.exec(value);
  const parsed = parseRepository(ssh ? ssh[1] : value); return `${parsed.owner}/${parsed.repo}`;
}
function gitIdentity(projectRoot, repository) {
  regular(projectRoot, 0, true);
  const git = args => execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-C', projectRoot, ...args], {
    encoding: 'utf8', timeout: 10000, maxBuffer: 65536, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
      GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  }).trim();
  try {
    if (path.resolve(git(['rev-parse', '--show-toplevel'])) !== path.resolve(projectRoot)) fail('The project root must be the Git checkout root.');
    if (normalizeRepo(git(['config', '--get', 'remote.origin.url'])) !== repository) fail('The checkout origin does not match the selected repository.');
    const commit = git(['rev-parse', '--verify', 'HEAD']); if (!/^[a-f0-9]{40,64}$/.test(commit)) fail('The checkout has no committed HEAD.');
    return { repository, commit, dirty: git(['status', '--porcelain', '--untracked-files=normal']).length > 0 };
  } catch (error) { if (error.message?.startsWith('Creative setup:')) throw error; fail('Could not verify the existing Git checkout and its GitHub origin.'); }
}

export function creativeCompanyPlan(snapshot, companyId) {
  const company = snapshot?.companies?.find(c => c.id === companyId);
  if (!company) fail('Select an existing company ID from Daftar before setup.');
  const plan = jsonFile(path.join(repoRoot, 'integrations/creative-tools/company-kit.json'), 256 * 1024);
  Object.assign(plan.companies[0], { id: company.id, name: company.name });
  for (const employee of plan.companies[0].employees) for (const skill of employee.skillPaths) regular(path.join(repoRoot, skill), 1024 * 1024);
  return validateCompanyKits(plan);
}

function projectSpecs({ companyId, repository, projectRoot, config, allowAdobeUpload }) {
  const prefix = `creative-${hash(`${companyId}\0${repository}`).slice(0, 16)}`;
  return Object.entries(OPERATIONS).map(([departmentKey, operations]) => {
    const allowed = [...operations];
    if (allowAdobeUpload && departmentKey === 'graphics') allowed.push('adobe.manifest', 'adobe.render');
    if (allowAdobeUpload && departmentKey === 'creative-qa') allowed.push('adobe.manifest');
    return { departmentKey, project: { id: `${prefix}-${departmentKey}`, companyId, root: path.resolve(projectRoot), repository, trusted: true,
      allowedOperations: allowed.filter(op => config.tools[toolFor(op)]),
      ...(allowAdobeUpload && departmentKey !== 'game-engineering' ? { allowExternalUpload: true } : {}) } };
  });
}
function findDepartment(snapshot, company, key) {
  const record = snapshot.knowledge.find(row => row.artifactUri === bindingUri(company, 'department', key));
  if (!record) return undefined;
  try { return JSON.parse(record.summary).entityId; } catch { fail('Existing department binding requires review.'); }
}
function assertExistingProjects(config, specs, departments) {
  for (const { departmentKey, project } of specs) {
    const old = config.projects.find(p => p.id === project.id);
    if (old && (!departments[departmentKey] || canonical(old) !== canonical({ ...project, departmentId: departments[departmentKey] }))) {
      fail('A project binding was changed by the owner. Review it explicitly; setup will not overwrite it.');
    }
  }
}
function writeConfig(file, config, expected) {
  if (hash(fs.readFileSync(file)) !== expected) fail('Configuration changed during setup; no configuration was overwritten. Rerun after review.');
  const temporary = `${file}.${crypto.randomUUID()}.tmp`; let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600); fs.writeFileSync(fd, JSON.stringify(config, null, 2) + '\n'); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    if (hash(fs.readFileSync(file)) !== expected) fail('Configuration changed during setup; no configuration was overwritten.');
    fs.renameSync(temporary, file);
    if (process.platform !== 'win32') { const dir = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); } }
  } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

/** No providers, engine jobs, paid API requests or remote Git writes are performed. */
export async function setupCreativeCompany({ userDataPath, companyId, projectRoot, repository, configFile,
  core = path.join(repoRoot, 'native-core/target/release/atlas-core'), apply = false, grantHours = 24, allowAdobeUpload = false }) {
  if (!ID.test(companyId ?? '') || !Number.isInteger(grantHours) || grantHours < 1 || grantHours > 168 || typeof allowAdobeUpload !== 'boolean' || typeof apply !== 'boolean') fail('Use a company ID, boolean apply/upload options and a grant lifetime of 1..168 hours.');
  regular(userDataPath, 0, true); regular(configFile, 1024 * 1024);
  const repositoryId = normalizeRepo(repository), identity = gitIdentity(projectRoot, repositoryId);
  const config = readCreativeConfig(configFile), configHash = hash(fs.readFileSync(configFile));
  const initial = nativeOffice(userDataPath), company = initial?.companies?.find(c => c.id === companyId);
  if (!company) fail('Select an existing company ID from Daftar before setup.');
  if (company.repoUrl && normalizeRepo(company.repoUrl) !== repositoryId) fail('The company is bound to a different repository.');
  const plan = creativeCompanyPlan(initial, companyId), kit = plan.companies[0], preview = planCompanyKits(plan, initial);
  const specs = projectSpecs({ companyId, repository: repositoryId, projectRoot, config, allowAdobeUpload });
  const knownDepartments = Object.fromEntries(kit.departments.map(d => [d.key, findDepartment(initial, kit, d.key)]));
  assertExistingProjects(config, specs, knownDepartments);
  if (config.projects.length + specs.filter(s => !config.projects.some(p => p.id === s.project.id)).length > 1000) fail('The creative project registry is full.');
  const report = { schemaVersion: 1, mode: apply ? 'applied' : 'preview', companyId, repository: identity.repository, repositoryCommit: identity.commit,
    repositoryDirty: identity.dirty, preview, projects: specs.map(s => ({ id: s.project.id, departmentKey: s.departmentKey, allowedOperations: s.project.allowedOperations })),
    grantHours, grants: [], assignments: [], providerRequests: 0, creativeJobsStarted: 0, remoteWrites: 0 };
  if (!apply) return report;
  regular(core, 128 * 1024 * 1024);
  const nativeCall = createNativeCall({ repoRoot, stateDir: path.join(userDataPath, 'company'), seedDir: path.join(repoRoot, 'company'), binary: core });
  const invoke = async (operation, payload = {}) => {
    const result = await nativeCall(operation, payload);
    if (result?.ok !== true || !result.snapshot?.companies) fail('The native operation was not confirmed. Inspect the saved state before retrying.');
    return result.snapshot;
  };
  // The same exclusive creative lock is held by a running VPS runtime. This
  // makes accidental online setup fail before any native employee mutation.
  const service = new CreativeToolsService({ stateDir: userDataPath, repoRoot, configFile, snapshot: async () => ({ ok: true, snapshot: await invoke('office_snapshot') }) });
  try {
    let state = await invoke('office_snapshot');
    const freshCompany = state.companies.find(c => c.id === companyId);
    if (!freshCompany || freshCompany.name !== company.name || freshCompany.repoUrl !== company.repoUrl) fail('Company identity changed before setup. Rerun the preview.');
    const command = async (action, payload) => state = await invoke('office_command', { action, ...payload });
    const installed = await applyCompanyKits(plan, { snapshot: state, command }); state = installed.snapshot;
    report.kit = installed.receipt;
    const installedCompany = installed.receipt.companies[0];
    const departments = Object.fromEntries(kit.departments.map((d, i) => [d.key, installedCompany.departmentIds[i]]));
    const liveConfig = readCreativeConfig(configFile);
    if (hash(fs.readFileSync(configFile)) !== configHash) fail('Configuration changed during setup; existing changes were preserved.');
    assertExistingProjects(liveConfig, specs, departments);
    const added = specs.filter(s => !liveConfig.projects.some(p => p.id === s.project.id)).map(s => ({ ...s.project, departmentId: departments[s.departmentKey] }));
    if (liveConfig.projects.length + added.length > 1000) fail('The creative project registry is full.');
    if (added.length) writeConfig(configFile, { ...liveConfig, projects: [...liveConfig.projects, ...added] }, configHash);
    report.projectsAdded = added.length;
    for (const [index, employeeSpec] of kit.employees.entries()) {
      const employeeId = installedCompany.employeeIds[index], departmentId = departments[employeeSpec.departmentKey];
      const employee = state.employees.find(e => e.id === employeeId), department = state.departments.find(d => d.id === departmentId);
      const project = specs.find(s => s.departmentKey === employeeSpec.departmentKey).project;
      const existing = (state.authority?.grants ?? []).filter(g => g.employeeId === employeeId && g.capabilities?.includes('creative.execute'));
      const active = state.companies.some(c => c.id === companyId && c.status === 'active') && employee?.status === 'active' && department?.status === 'active'
        && state.offices.some(o => o.id === employee.officeId && o.status === 'active');
      if (!existing.length && active) {
        await command('grant_authority', { employeeId, scope: { kind: 'department', id: departmentId }, preset: 'partial',
          capabilities: ['creative.execute', 'provider.run'], expiresAt: new Date(Date.now() + grantHours * 3600000).toISOString(),
          issuer: 'owner', reason: `Creative VPS setup v1 for ${project.id}; budgets and separate job approval remain required.` });
        report.grants.push({ employeeId, grantId: state.lastAction.grantId, status: 'created' });
      } else report.grants.push({ employeeId, status: existing.length ? 'retained_without_renewal' : 'paused_scope_preserved' });
      const previous = service.registry.assignments.find(a => a.companyId === companyId && a.employeeId === employeeId && a.projectId === project.id);
      if (previous || !active) { report.assignments.push({ employeeId, projectId: project.id, status: previous ? 'retained_without_changes' : 'paused_scope_preserved' }); continue; }
      const toolIds = [...new Set(project.allowedOperations.map(toolFor))];
      const requestId = `setup-${hash(`${companyId}\0${employeeId}\0${project.id}`).slice(0, 48)}`;
      const saved = await service.assign({ id: requestId, companyId, employeeId, projectId: project.id, toolIds });
      report.assignments.push({ employeeId, projectId: project.id, toolIds, status: saved.replayed ? 'already_saved' : 'created' });
    }
    return report;
  } finally { await service.close(); }
}

export async function main(argv = process.argv.slice(2)) {
  const options = {}, names = { '--user-data-path': 'userDataPath', '--company-id': 'companyId', '--project-root': 'projectRoot', '--repository': 'repository', '--config': 'configFile', '--core': 'core', '--grant-hours': 'grantHours', '--apply': 'apply', '--allow-adobe-upload': 'allowAdobeUpload' };
  for (let i = 0; i < argv.length; i++) {
    const key = names[argv[i]]; if (!key || Object.hasOwn(options, key)) fail('Unsupported or duplicate setup argument.');
    options[key] = ['apply', 'allowAdobeUpload'].includes(key) ? true : argv[++i];
    if (options[key] === undefined || (typeof options[key] === 'string' && options[key].startsWith('--'))) fail('A required argument value is missing.');
  }
  if (options.grantHours !== undefined) options.grantHours = Number(options.grantHours);
  const result = await setupCreativeCompany(options);
  console.log(JSON.stringify(result)); return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message?.startsWith('Creative setup:') ? error.message : 'Creative setup failed. Inspect the local configuration and retained native records before retrying.'); process.exitCode = 1; });
