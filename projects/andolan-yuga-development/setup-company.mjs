#!/usr/bin/env node
/** Repository-bound, additive company setup through Daftar's native command API. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNativeCall, createToolHandler } from '../../tools/atlas-mcp.mjs';
import { validateCompanyKits, planCompanyKits, applyCompanyKits } from '../../scripts/apply-company-kits.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(directory, '../..');
export const REPOSITORY = 'occult-kranti/ANDOLAN';
export const REPOSITORY_URL = `https://github.com/${REPOSITORY}`;
export const MODEL = 'qwen3-coder:30b-a3b-q4_K_M';
const ID = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}$/;
const fail = message => { throw new Error(`ANDOLAN / YUGA setup: ${message}`); };
const json = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));

/** An identity comparison only; never follow or fetch a stored repository URL. */
export function repositoryIdentity(value) {
  if (typeof value !== 'string' || value.length > 500) return null;
  const ssh = /^git@github\.com:([^\s]+)$/i.exec(value);
  let id;
  if (ssh) id = ssh[1];
  else {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com'
        || url.username || url.password || url.port || url.search || url.hash) return null;
      id = url.pathname.slice(1);
    } catch { return null; }
  }
  id = id.replace(/\/$/, '').replace(/\.git$/i, '');
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(id) ? id.toLowerCase() : null;
}

export function prepareCompany(snapshot, { companyId } = {}) {
  if (!Array.isArray(snapshot?.companies)) fail('Use a complete current native office snapshot.');
  if (companyId !== undefined && !ID.test(companyId)) fail('companyId must be a native company ID.');
  const matches = snapshot.companies.filter(company => repositoryIdentity(company.repoUrl) === REPOSITORY.toLowerCase());
  let existing;
  if (companyId !== undefined) {
    existing = snapshot.companies.find(company => company.id === companyId);
    if (!existing || !matches.includes(existing)) fail('The selected company is not bound to occult-kranti/ANDOLAN.');
  } else {
    if (matches.length > 1) fail('Several companies use this repository; select the intended companyId.');
    existing = matches[0];
  }
  const plan = json('company-kit.json');
  const company = plan.companies[0];
  if (existing) Object.assign(company, { id: existing.id, name: existing.name });
  else if (snapshot.companies.some(row => row.id === company.id)) fail('The deterministic company ID is already used by a different repository.');
  validateCompanyKits(plan);
  for (const employee of company.employees) for (const skill of employee.skillPaths) {
    if (!fs.statSync(path.join(repoRoot, skill)).isFile()) fail('A required skill is missing from this Daftar checkout.');
  }
  return { plan, preview: planCompanyKits(plan, snapshot), companyId: company.id,
    companyStatus: existing ? 'existing_repository_binding' : 'new_repository_binding', repository: REPOSITORY };
}

function modelSelections(plan, receipt, snapshot) {
  const profile = json('profile.json').models[0];
  const company = plan.companies[0], installed = receipt.companies[0];
  return company.employees.flatMap((spec, index) => {
    if (!profile.assignmentRoleKeys.includes(spec.key)) return [];
    const employee = snapshot.employees.find(row => row.id === installed.employeeIds[index]);
    const active = employee?.status === 'active'
      && snapshot.companies.some(row => row.id === company.id && row.status === 'active')
      && snapshot.offices.some(row => row.id === employee.officeId && row.status === 'active')
      && (!employee.departmentId || snapshot.departments.some(row => row.id === employee.departmentId && row.status === 'active'));
    return [{ roleKey: spec.key, status: active ? 'pending_installed_digest_verification' : 'paused_scope_preserved',
      method: 'POST', path: '/v1/models/select', body: { companyId: company.id, employeeId: employee.id, model: MODEL } }];
  });
}

/** No model, authority, budget, schedule, external write or worker API is called. */
export async function applyCompany({ snapshot, command, companyId }) {
  if (typeof command !== 'function') fail('A real native command adapter is required.');
  const prepared = prepareCompany(snapshot, { companyId });
  const result = await applyCompanyKits(prepared.plan, { snapshot, command: async (action, payload) => {
    const next = await command(action, action === 'create_company' ? { ...payload, repoUrl: REPOSITORY_URL } : payload);
    const company = next?.companies?.find(row => row.id === prepared.companyId);
    if (!company || repositoryIdentity(company.repoUrl) !== REPOSITORY.toLowerCase()) fail('The committed native repository binding could not be verified. Inspect current state before retrying.');
    return next;
  } });
  const company = result.snapshot.companies.find(row => row.id === prepared.companyId);
  if (repositoryIdentity(company?.repoUrl) !== REPOSITORY.toLowerCase()) fail('The final repository binding is not the expected company.');
  return { snapshot: result.snapshot, receipt: { ...result.receipt, repository: REPOSITORY,
    teamState: 'definitions_applied_execution_not_started',
    roleBindings: prepared.plan.companies[0].employees.map((spec, index) => ({ roleKey: spec.key, employeeId: result.receipt.companies[0].employeeIds[index] })),
    pendingModelSelections: modelSelections(prepared.plan, result.receipt, result.snapshot),
    modelAssignmentsApplied: 0, downloadsStarted: 0, authorityChanges: 0, budgetChanges: 0,
    nextStep: 'Inspect the connected runtime model and creative inventories. Select a verified installed digest and approved project scope through their normal APIs before preparing an execution job.' } };
}

function regular(file, maximum) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) fail('Use absolute file paths.');
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximum) fail('Use a bounded regular file, not a symbolic link.');
  return fs.readFileSync(file);
}

export async function main(argv = process.argv.slice(2)) {
  const names = new Set(['--state-dir', '--company-id', '--core', '--report', '--apply']);
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const name = argv[index];
    if (!names.has(name) || Object.hasOwn(options, name)) fail('Unsupported or duplicate argument.');
    options[name] = name === '--apply' ? true : argv[++index];
    if (!options[name] || (typeof options[name] === 'string' && options[name].startsWith('--'))) fail('An argument value is missing.');
  }
  const stateDir = options['--state-dir'];
  if (!stateDir || !path.isAbsolute(stateDir)) fail('Usage: node projects/andolan-yuga-development/setup-company.mjs --state-dir /absolute/current/company [--company-id ID] [--core /absolute/atlas-core] [--apply] [--report /absolute/new-report.json]');
  const reportFile = options['--report'];
  if (reportFile && (!path.isAbsolute(reportFile) || fs.existsSync(reportFile))) fail('Choose a new absolute report path.');
  // The default preview cannot initialize, migrate or overwrite owner state.
  const file = path.join(stateDir, 'company-state.json');
  const initial = JSON.parse(regular(file, 32 * 1024 * 1024)).office;
  const prepared = prepareCompany(initial, { companyId: options['--company-id'] });
  let receipt = { ...prepared.preview, repository: REPOSITORY, companyId: prepared.companyId,
    companyStatus: prepared.companyStatus, teamState: 'preview_only', modelAssignmentsApplied: 0,
    downloadsStarted: 0, authorityChanges: 0, budgetChanges: 0, workerProcessesStarted: 0 };
  if (options['--apply']) {
    const binary = options['--core'] ?? path.join(repoRoot, 'desktop-shell/native', process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core');
    regular(binary, 128 * 1024 * 1024);
    const handler = createToolHandler({ nativeCall: createNativeCall({ repoRoot, stateDir, seedDir: path.join(repoRoot, 'company'), binary }),
      fetchImpl: async () => { throw new Error('Company setup does not make network requests.'); } });
    const snapshot = (await handler('office_snapshot', {})).snapshot;
    const fresh = prepareCompany(snapshot, { companyId: options['--company-id'] });
    if (fresh.companyId !== prepared.companyId || fresh.companyStatus !== prepared.companyStatus) fail('Company identity changed after preview. Review current state before applying.');
    receipt = (await applyCompany({ snapshot, companyId: options['--company-id'],
      command: async (action, payload) => (await handler('office_command', { action, payload })).snapshot })).receipt;
  }
  if (reportFile) {
    fs.mkdirSync(path.dirname(reportFile), { recursive: true, mode: 0o700 });
    fs.writeFileSync(reportFile, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  }
  console.log(JSON.stringify(receipt));
  return receipt;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  console.error(error.message?.startsWith('ANDOLAN / YUGA setup:') ? error.message : 'ANDOLAN / YUGA setup failed. Inspect the current native state and source paths before retrying.');
  process.exitCode = 1;
});
