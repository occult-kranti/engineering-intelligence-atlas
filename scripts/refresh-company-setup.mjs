#!/usr/bin/env node
/** Add missing skill references to saved staff definitions. No jobs, grants, network or model calls. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createNativeCall } from '../tools/atlas-mcp.mjs';
import { syncStateHash } from '../desktop-shell/dist/main/cloudSync.js';
import { assertOutsideGit } from './reconcile-company-hierarchy.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALGORITHM = 'additive-company-skill-refresh-v1';
const MAX_STATE_BYTES = 32_000_000;
const MAX_SKILLS = 20;
const GROUP_ASSIGNMENTS = new Set(['subdirector', 'code-engineer', 'knowledge-curator', 'github-steward']);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const fail = message => { throw new Error(`Company setup: ${message}`); };
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stable = value => Array.isArray(value) ? value.map(stable) : plainObject(value)
  ? Object.fromEntries(Object.keys(value).sort(compare).map(key => [key, stable(value[key])])) : value;
const digest = value => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
function identifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(value) || value === '.' || value === '..') fail(`${label} has an invalid ID.`);
  return value;
}
function rows(value, label, maximum) {
  if (!Array.isArray(value) || value.length > maximum) fail(`${label} must be a bounded array.`);
  return value;
}
function distinct(values, label) {
  if (new Set(values).size !== values.length) fail(`${label} contains duplicates.`);
}
function registry(values, label, maximum) {
  rows(values, label, maximum);
  for (const value of values) identifier(value?.id, label);
  distinct(values.map(value => value.id), label);
  return new Map(values.map(value => [value.id, value]));
}

function skillReference(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value) > 300
      || !/^skills\/(?:[A-Za-z0-9_.-]+\/)+SKILL\.md$/.test(value)
      || value.split('/').some(part => part === '.' || part === '..')) fail('Skills must be repository-relative skills/.../SKILL.md references.');
  return value;
}
function requireSkillFile(value, repoRoot) {
  skillReference(value);
  const filename = path.join(repoRoot, value);
  let resolved, stat;
  try { resolved = fs.realpathSync(filename); stat = fs.statSync(filename); }
  catch { fail(`A skill file is missing from the checkout: ${value}`); }
  const relative = path.relative(repoRoot, resolved);
  if (!stat.isFile() || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail('A skill reference must resolve to a regular file inside this checkout.');
}
function skillList(value, label, repoRoot) {
  rows(value, label, MAX_SKILLS); distinct(value, label);
  for (const skill of value) requireSkillFile(skill, repoRoot);
  return [...value];
}

/** Validate every configured path, including currently unmatched assignments/groups. */
export function validateSetupProfiles(profiles, { repoRoot = REPO_ROOT } = {}) {
  let root;
  try { root = fs.realpathSync(repoRoot); } catch { fail('The repository checkout is unavailable.'); }
  if (!plainObject(profiles) || profiles.schemaVersion !== 1 || profiles.classification !== 'public-generic-preset'
      || typeof profiles.revision !== 'string' || !/^[A-Za-z0-9_.-]{1,80}$/.test(profiles.revision)) fail('A versioned public generic setup profile is required.');
  const assistantSkillPaths = skillList(profiles.assistantSkillPaths, 'Assistant skills', root);
  const maps = {};
  for (const key of ['assignmentSkills', 'groupSkills']) {
    const values = profiles[key];
    if (!plainObject(values) || Object.keys(values).length > 1000) fail(`${key} must be a bounded object.`);
    maps[key] = Object.fromEntries(Object.keys(values).sort(compare).map(name => {
      if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(name) || ['__proto__', 'constructor', 'prototype', '.', '..'].includes(name)) fail(`${key} has an invalid lookup key.`);
      return [name, skillList(values[name], key, root)];
    }));
  }
  return { schemaVersion: 1, revision: profiles.revision, classification: profiles.classification, assistantSkillPaths, ...maps };
}

/** Plan an additive union without editing the snapshot or guessing identities from display names. */
export function planCompanySetup(snapshot, profiles, { repoRoot = REPO_ROOT } = {}) {
  const root = fs.realpathSync(repoRoot), profile = validateSetupProfiles(profiles, { repoRoot: root });
  if (!plainObject(snapshot) || !plainObject(snapshot.portfolio)) fail('A complete initialized native office snapshot is required.');
  const companies = registry(snapshot.companies, 'Companies', 2000);
  const offices = registry(snapshot.offices, 'Offices', 10000);
  const departments = registry(snapshot.departments, 'Departments', 20000);
  const employees = registry(snapshot.employees, 'Employees', 50000);
  const groups = registry(snapshot.portfolio.groups, 'Portfolio groups', 100);
  if (!companies.size || !employees.size) fail('An initialized native office is required.');
  const assistantReasons = new Map();
  const owns = (employeeId, companyId, officeId, departmentId, reason) => {
    identifier(employeeId, 'Assistant reference');
    const employee = employees.get(employeeId);
    if (!employee || employee.kind !== 'assistant' || !['active', 'paused'].includes(employee.status)
        || (employee.companyId ?? null) !== companyId || (employee.officeId ?? null) !== officeId
        || (employee.departmentId ?? null) !== departmentId) fail('A saved assistant reference has inconsistent ownership.');
    if (assistantReasons.has(employeeId)) fail('An assistant is referenced by multiple scopes.');
    assistantReasons.set(employeeId, reason);
  };
  // The native schema fixes Donna's identity to "donna"; her display name is editable.
  owns('donna', null, null, null, 'assistant:global');
  for (const company of companies.values()) {
    if (!['active', 'paused'].includes(company.status)) fail('A company has an invalid status.');
    owns(company.assistantId, company.id, null, null, 'assistant:company');
  }
  for (const office of offices.values()) {
    if (!companies.has(office.companyId) || !['active', 'paused'].includes(office.status)) fail('An office has invalid company ownership or status.');
    owns(office.assistantId, office.companyId, office.id, null, 'assistant:office');
  }
  for (const department of departments.values()) {
    if (!companies.has(department.companyId) || offices.get(department.officeId)?.companyId !== department.companyId
        || !['active', 'paused'].includes(department.status)) fail('A department has invalid office ownership or status.');
    owns(department.assistantId, department.companyId, department.officeId, department.id, 'assistant:department');
  }
  const companyGroups = new Map();
  for (const group of [...groups.values()].sort((a, b) => compare(a.id, b.id))) {
    rows(group.companyIds, 'Group membership', 2000); distinct(group.companyIds, 'Group membership');
    for (const companyId of group.companyIds) {
      if (!companies.has(companyId)) fail('A group references a missing company.');
      if (!companyGroups.has(companyId)) companyGroups.set(companyId, []);
      companyGroups.get(companyId).push(group.id);
    }
  }
  const changes = [], matchedAssignments = new Set(), matchedGroups = new Set();
  let skippedFiredEmployees = 0, matchedEmployees = 0, assistantEmployees = 0, assignmentEmployees = 0, groupEmployees = 0;
  for (const employee of [...employees.values()].sort((a, b) => compare(a.id, b.id))) {
    if (!['assistant', 'specialist'].includes(employee.kind) || !['active', 'paused', 'fired'].includes(employee.status)) fail('An employee has an invalid kind or status.');
    if (employee.id !== 'donna' && !companies.has(employee.companyId)) fail('An employee references a missing company.');
    if (employee.officeId != null && offices.get(employee.officeId)?.companyId !== employee.companyId) fail('An employee has inconsistent office ownership.');
    if (employee.departmentId != null && (departments.get(employee.departmentId)?.companyId !== employee.companyId
        || departments.get(employee.departmentId)?.officeId !== employee.officeId)) fail('An employee has inconsistent department ownership.');
    if (employee.status === 'fired') { skippedFiredEmployees++; continue; }
    rows(employee.skillPaths, 'Saved employee skills', MAX_SKILLS); distinct(employee.skillPaths, 'Saved employee skills');
    for (const skill of employee.skillPaths) skillReference(skill);
    const additions = [], reasons = [];
    if (assistantReasons.has(employee.id)) {
      assistantEmployees++; reasons.push(assistantReasons.get(employee.id)); additions.push(...profile.assistantSkillPaths);
    }
    const assignment = employee.assignmentKey;
    if (typeof assignment === 'string' && Object.hasOwn(profile.assignmentSkills, assignment)) {
      assignmentEmployees++; matchedAssignments.add(assignment); reasons.push(`assignment:${assignment}`); additions.push(...profile.assignmentSkills[assignment]);
    }
    if (GROUP_ASSIGNMENTS.has(assignment)) {
      let matched = false;
      for (const groupId of companyGroups.get(employee.companyId) ?? []) if (Object.hasOwn(profile.groupSkills, groupId)) {
        matched = true; matchedGroups.add(groupId); reasons.push(`group:${groupId}`); additions.push(...profile.groupSkills[groupId]);
      }
      if (matched) groupEmployees++;
    }
    if (!reasons.length) continue;
    matchedEmployees++;
    const merged = [...employee.skillPaths];
    for (const skill of additions) if (!merged.includes(skill)) merged.push(skill);
    if (merged.length > MAX_SKILLS) fail('The complete additive plan exceeds the native 20-skill limit for an employee; no updates were sent.');
    // Existing custom paths remain in their saved order and must also be usable.
    for (const skill of merged) requireSkillFile(skill, root);
    if (merged.length === employee.skillPaths.length) continue;
    changes.push({ employeeId: employee.id, companyId: employee.companyId ?? null, assignmentKey: employee.assignmentKey ?? null,
      status: employee.status, previousSkillPaths: [...employee.skillPaths], skillPaths: merged,
      addedSkillPaths: merged.slice(employee.skillPaths.length), reasons,
      command: { action: 'update_employee', employeeId: employee.id, skillPaths: merged } });
  }
  const baseStateHash = syncStateHash(snapshot), profileSha256 = digest(profile);
  for (const change of changes) change.requestId = `setup-v1-${digest([baseStateHash, profileSha256, change.command])}`;
  if (Array.isArray(snapshot.remoteReceipts) && snapshot.remoteReceipts.length + changes.length > 10000) fail('The complete plan exceeds native receipt capacity; no updates were sent.');
  const unmatchedAssignmentKeys = Object.keys(profile.assignmentSkills).filter(key => !matchedAssignments.has(key));
  const unmatchedGroupIds = Object.keys(profile.groupSkills).filter(key => !groups.has(key));
  return { schemaVersion: 1, classification: 'private-owner-workspace', algorithm: ALGORITHM, mode: 'plan',
    profileRevision: profile.revision, profileSha256, baseStateHash, changes, unmatchedAssignmentKeys, unmatchedGroupIds,
    counts: { companies: companies.size, groups: groups.size, employees: employees.size, assistantEmployees, assignmentEmployees, groupEmployees,
      matchedEmployees, changedEmployees: changes.length, skillReferencesAdded: changes.reduce((n, change) => n + change.addedSkillPaths.length, 0),
      activeEmployeesUpdated: changes.filter(change => change.status === 'active').length,
      pausedEmployeesUpdated: changes.filter(change => change.status === 'paused').length,
      skippedFiredEmployees, unchangedEmployees: employees.size - skippedFiredEmployees - changes.length,
      unmatchedAssignments: unmatchedAssignmentKeys.length, unmatchedGroups: unmatchedGroupIds.length, matchedGroups: matchedGroups.size },
    effects: { providerRequests: 0, networkRequests: 0, workerProcessesStarted: 0, permissionChanges: 0, budgetChanges: 0, jobsCreated: 0, goalsCreated: 0 } };
}

function unwrapNative(result) {
  if (!result?.ok || !plainObject(result.snapshot)) {
    const code = typeof result?.code === 'string' && /^[A-Z_]{1,80}$/.test(result.code) ? result.code : 'NATIVE_FAILED';
    fail(`Native operation failed (${code}). Previous updates may already be committed; prepare a fresh plan. No automatic retry was attempted.`);
  }
  return result.snapshot;
}
const preservedEmployee = ({ skillPaths, updatedAt, ...employee }) => employee;

/** Validate the whole plan before the first mutation, then guard each native transaction with its current revision. */
export async function applyCompanySetup(snapshot, profiles, { command, repoRoot = REPO_ROOT } = {}) {
  if (typeof command !== 'function') fail('A native command adapter is required.');
  const plan = planCompanySetup(snapshot, profiles, { repoRoot });
  let current = snapshot, applied = 0;
  for (const change of plan.changes) {
    const before = current.employees.find(employee => employee.id === change.employeeId);
    if (!before || before.status !== change.status || !same(before.skillPaths, change.previousSkillPaths)) fail('The reviewed employee definition changed; prepare a fresh plan.');
    current = unwrapNative(await command({ action: 'apply_remote_command', id: change.requestId,
      expectedStateHash: syncStateHash(current), command: change.command }));
    const after = current.employees?.find(employee => employee.id === change.employeeId);
    if (!after || !same(after.skillPaths, change.skillPaths) || !same(preservedEmployee(before), preservedEmployee(after))) fail('A native receipt did not preserve the planned employee definition; stop and inspect the current state.');
    applied++;
  }
  return { snapshot: current, plan, receipt: { mode: 'applied', profileRevision: plan.profileRevision, ...plan.counts,
    appliedEmployeeUpdates: applied, ...plan.effects } };
}

function readJsonFile(filename, maximum, label) {
  let descriptor;
  try {
    descriptor = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > maximum) fail(`${label} must be a bounded regular file.`);
    return JSON.parse(fs.readFileSync(descriptor, 'utf8'));
  } catch (error) {
    if (error.message.startsWith('Company setup:')) throw error;
    fail(`Could not read ${label}; no state was initialized or replaced.`);
  } finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
}
function privatePath(value) {
  try { return assertOutsideGit(value); }
  catch { fail('Private state and output must use absolute paths outside Git repositories without symbolic links.'); }
}
function outputPath(value) {
  const filename = privatePath(value), directory = path.dirname(filename);
  if (fs.existsSync(filename)) fail('Choose a new output file; existing plans are never overwritten.');
  if (!fs.statSync(directory, { throwIfNoEntry: false })?.isDirectory()) fail('The private output directory must already exist.');
  fs.accessSync(directory, fs.constants.W_OK | fs.constants.X_OK);
  return filename;
}

export async function main(argv = process.argv.slice(2)) {
  const usage = 'Usage: node scripts/refresh-company-setup.mjs --profiles company/setup-profiles.json --core /absolute/atlas-core --user-data-path /private/runtime --output /private/setup-plan.json [--apply]. With --apply, --output is optional; stdout contains counts only.';
  if (argv.length === 1 && argv[0] === '--help') { console.log(usage); return; }
  const opts = {}, allowed = new Set(['--profiles', '--core', '--user-data-path', '--output', '--apply']);
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!allowed.has(key) || Object.hasOwn(opts, key)) fail('Unsupported or duplicate command-line argument.');
    opts[key] = key === '--apply' ? true : argv[++index];
    if (!opts[key] || typeof opts[key] === 'string' && opts[key].startsWith('--')) fail('Missing command-line value.');
  }
  if (!opts['--profiles'] || !opts['--core'] || !path.isAbsolute(opts['--core']) || !opts['--user-data-path']
      || !opts['--apply'] && !opts['--output']) fail(usage);
  const core = fs.lstatSync(opts['--core'], { throwIfNoEntry: false });
  if (!core?.isFile() || core.isSymbolicLink()) fail('The native core must be an existing absolute binary path.');
  fs.accessSync(opts['--core'], fs.constants.X_OK);
  const profiles = readJsonFile(path.resolve(opts['--profiles']), 1_000_000, 'the setup profiles');
  const userDataPath = privatePath(opts['--user-data-path']);
  const output = opts['--output'] ? outputPath(opts['--output']) : null;
  const state = readJsonFile(privatePath(path.join(userDataPath, 'company', 'company-state.json')), MAX_STATE_BYTES, 'the initialized native office');
  if (!state.office) fail('Initialize the native office before refreshing its setup.');
  let snapshot = state.office, plan = planCompanySetup(snapshot, profiles);
  let nativeCall;
  if (opts['--apply']) {
    nativeCall = createNativeCall({ binary: opts['--core'], stateDir: path.join(userDataPath, 'company'), seedDir: path.join(REPO_ROOT, 'company'), repoRoot: REPO_ROOT });
    snapshot = unwrapNative(await nativeCall('office_snapshot', {}));
    plan = planCompanySetup(snapshot, profiles);
  }
  if (output) fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  const receipt = opts['--apply']
    ? (await applyCompanySetup(snapshot, profiles, { command: payload => nativeCall('office_command', payload) })).receipt
    : { mode: 'plan', profileRevision: plan.profileRevision, ...plan.counts, appliedEmployeeUpdates: 0, ...plan.effects };
  console.log(JSON.stringify(receipt));
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message.startsWith('Company setup:') ? error.message : 'Company setup: local operation failed. Previous updates may already be committed; prepare a fresh plan before retrying.'); process.exitCode = 1; });
}
