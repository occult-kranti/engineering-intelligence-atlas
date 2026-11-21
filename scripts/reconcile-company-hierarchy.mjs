#!/usr/bin/env node
/** Additive owner reconciliation. No imports, provider calls, network or raw state writes.
 * Preview reads the initialized state without running native migrations. Full plans
 * contain private company identities and must be written outside every Git checkout.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createNativeCall } from '../tools/atlas-mcp.mjs';
import { syncStateHash } from '../desktop-shell/dist/main/cloudSync.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAFE_ID = /^[A-Za-z0-9_.-]{1,100}$/;
const ALGORITHM = 'additive-company-hierarchy-v1';
const MAX_STATE_BYTES = 32_000_000;
export const PREFERRED_REPOSITORIES = Object.freeze({
  'control-platform': 'engineering-intelligence-atlas',
  'civic-intelligence': 'india-corporate-intelligence',
  'learning-games': 'fact-duel',
  'evidence-archives': 'archiveshelf',
  'scientific-labs': 'newton-tesla-research-lab',
  'audio-resonance': 'open-sync',
  'pattern-symbolic': 'astrology-sim',
  'personal-tools': 'wardrobe-tracker',
  'growth-and-ventures': 'fintech-hackathon-studio',
});
const PRESET_NAMES = new Map(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'company/portfolio-presets.json'), 'utf8')).groups
  .map(group => [group.name.trim().toLowerCase(), group.key]));
PRESET_NAMES.set('growth & ventures', 'growth-and-ventures');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const fail = message => { throw new Error(`Company hierarchy: ${message}`); };
const id = (value, label) => {
  if (typeof value !== 'string' || !SAFE_ID.test(value) || value === '.' || value === '..') fail(`${label} contains an invalid ID.`);
  return value;
};
const unique = (values, label) => { if (new Set(values).size !== values.length) fail(`${label} contains duplicate IDs.`); };

function repositoryName(company) {
  if (company.repoUrl == null) return null;
  if (typeof company.repoUrl !== 'string') fail('A company repository URL is invalid.');
  let url;
  try { url = new URL(company.repoUrl); } catch { fail('A company repository URL is invalid.'); }
  const parts = url.pathname.replace(/\/$/, '').split('/').slice(1);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash || parts.length !== 2 || parts.some(part => !/^[A-Za-z0-9_.-]+$/.test(part))) fail('A company repository must have a canonical GitHub URL.');
  return parts[1].replace(/\.git$/i, '').toLowerCase();
}

function presetKey(group) {
  const value = group.id.toLowerCase();
  const matches = Object.keys(PREFERRED_REPOSITORIES).filter(key => value === key || ['-', '_', '.'].some(separator => value.endsWith(separator + key)));
  if (matches.length > 1) fail('A portfolio group matches multiple presets.');
  return matches[0] ?? PRESET_NAMES.get(String(group.name ?? '').trim().toLowerCase()) ?? null;
}

/** Validate every existing and proposed relation before the first mutation. */
function validateForest(parents) {
  for (const [companyId, parentId] of parents) {
    if (parentId !== null && !parents.has(parentId)) fail('A company parent references a missing company.');
    if (parentId === companyId) fail('The company hierarchy contains a self cycle.');
  }
  const done = new Set();
  for (const start of parents.keys()) {
    const visiting = new Set();
    let cursor = start;
    while (cursor !== null && !done.has(cursor)) {
      if (visiting.has(cursor)) fail('The company hierarchy contains a cycle.');
      visiting.add(cursor);
      cursor = parents.get(cursor);
    }
    for (const visited of visiting) done.add(visited);
  }
}

export function planCompanyHierarchy(snapshot) {
  if (!Array.isArray(snapshot?.companies) || snapshot.companies.length < 1 || snapshot.companies.length > 2000 || !Array.isArray(snapshot?.portfolio?.groups) || snapshot.portfolio.groups.length > 100 || !Array.isArray(snapshot.portfolio.services)) fail('An initialized, bounded native office snapshot is required.');
  const companies = [...snapshot.companies].sort((a, b) => compare(String(a?.id), String(b?.id)));
  for (const company of companies) {
    id(company?.id, 'Company');
    if (typeof company.name !== 'string' || company.name.length > 1000) fail('A company name is invalid.');
    if (company.parentCompanyId != null) id(company.parentCompanyId, 'Company parent');
    repositoryName(company);
  }
  unique(companies.map(company => company.id), 'Company registry');
  const byId = new Map(companies.map(company => [company.id, company]));
  const originalParents = new Map(companies.map(company => [company.id, company.parentCompanyId ?? null]));
  validateForest(originalParents);
  const roots = companies.filter(company => repositoryName(company) === PREFERRED_REPOSITORIES['control-platform']);
  if (roots.length !== 1) fail('Exactly one existing Daftar repository company is required.');
  const root = roots[0];
  const groups = [...snapshot.portfolio.groups].sort((a, b) => compare(String(a?.id), String(b?.id)));
  for (const group of groups) id(group?.id, 'Portfolio group');
  unique(groups.map(group => group.id), 'Portfolio groups');
  const membership = new Map();
  for (const group of groups) {
    if (!Array.isArray(group.companyIds) || group.companyIds.length > 2000) fail('A portfolio group has invalid membership.');
    unique(group.companyIds, 'Portfolio group membership');
    for (const companyId of group.companyIds) {
      id(companyId, 'Portfolio group member');
      if (!byId.has(companyId)) fail('A portfolio group references a missing company; repair membership before reconciliation.');
      if (membership.has(companyId)) fail('A company belongs to multiple portfolio groups; resolve the ambiguity before reconciliation.');
      membership.set(companyId, group.id);
    }
  }
  const sharedServiceCompanies = new Set();
  for (const companyId of [snapshot.portfolio.ceo?.sharedServicesCompanyId, ...snapshot.portfolio.services.map(service => service?.companyId)]) {
    if (companyId == null) continue;
    id(companyId, 'Shared-service company');
    if (!byId.has(companyId)) fail('A shared service references a missing company.');
    sharedServiceCompanies.add(companyId);
  }
  const proposedParents = new Map(originalParents), changes = [], groupPlans = [];
  const add = (companyId, parentCompanyId, reason, groupId = null) => {
    if (companyId === root.id || originalParents.get(companyId) !== null) return;
    if (proposedParents.get(companyId) !== null) fail('Multiple proposed edges target the same company.');
    proposedParents.set(companyId, parentCompanyId);
    changes.push({ companyId, companyName: byId.get(companyId).name, previousParentCompanyId: null,
      parentCompanyId, parentCompanyName: byId.get(parentCompanyId).name, reason, groupId });
  };
  for (const group of groups) {
    const key = presetKey(group);
    const members = [...group.companyIds].sort(compare);
    const preferredRepository = key ? PREFERRED_REPOSITORIES[key] : null;
    const preferred = preferredRepository ? members.filter(companyId => repositoryName(byId.get(companyId)) === preferredRepository && byId.get(companyId).visibility !== 'private') : [];
    if (preferred.length > 1) fail('A portfolio group has multiple preferred repository anchors.');
    // Daftar is explicitly the control-platform anchor even if that saved group
    // omitted it. Other preferred anchors must already belong to their group.
    const anchorCompanyId = members.length ? key === 'control-platform' ? root.id : preferred[0] ?? members[0] : null;
    groupPlans.push({ groupId: group.id, groupName: group.name, presetKey: key, preferredRepository,
      anchorCompanyId, anchorReason: anchorCompanyId === null ? 'empty-group' : key === 'control-platform' || preferred.length ? 'preferred-repository' : 'first-existing-member-by-id', companyIds: members });
    if (anchorCompanyId === null) continue;
    add(anchorCompanyId, root.id, 'group-anchor', group.id);
    for (const companyId of members) if (companyId !== anchorCompanyId) add(companyId, anchorCompanyId, 'group-member', group.id);
  }
  for (const companyId of [...sharedServiceCompanies].sort(compare)) {
    if (!membership.has(companyId) && byId.get(companyId).repoUrl == null) add(companyId, root.id, 'shared-services');
  }
  validateForest(proposedParents);
  const baseStateHash = syncStateHash(snapshot);
  // Include the starting revision so a later, explicitly cleared relationship
  // does not accidentally replay an old native receipt from a prior plan.
  for (const change of changes) {
    change.command = { action: 'set_company_parent', companyId: change.companyId, parentCompanyId: change.parentCompanyId };
    change.requestId = `hierarchy-v1-${crypto.createHash('sha256').update(JSON.stringify([baseStateHash, change.command])).digest('hex')}`;
  }
  const preservedParents = companies.filter(company => originalParents.get(company.id) !== null)
    .map(company => ({ companyId: company.id, companyName: company.name, parentCompanyId: originalParents.get(company.id), reason: 'existing-parent' }));
  const unassignedCompanies = companies.filter(company => company.id !== root.id && proposedParents.get(company.id) === null)
    .map(company => ({ companyId: company.id, companyName: company.name, reason: 'no-saved-group-or-shared-service' }));
  return { schemaVersion: 1, classification: 'private-owner-workspace', algorithm: ALGORITHM, mode: 'plan', baseStateHash,
    root: { companyId: root.id, companyName: root.name, parentCompanyId: root.parentCompanyId ?? null },
    groups: groupPlans, changes, preservedParents, unassignedCompanies,
    counts: { companies: companies.length, groups: groups.length, parentChanges: changes.length, preservedParents: preservedParents.length, unassignedCompanies: unassignedCompanies.length },
    effects: { providerRequests: 0, externalWrites: 0, workerProcessesStarted: 0, inheritedAccessGrants: 0 } };
}

function unwrapNative(result) {
  if (!result?.ok || !result.snapshot || typeof result.snapshot !== 'object') {
    const code = typeof result?.code === 'string' && /^[A-Z_]{1,80}$/.test(result.code) ? result.code : 'NATIVE_FAILED';
    fail(`Native operation failed (${code}). Stop and inspect a fresh plan; no automatic retry was attempted.`);
  }
  return result.snapshot;
}

/** Every mutation has the latest expected revision; transport errors are not retried. */
export async function applyCompanyHierarchy(snapshot, { command }) {
  const plan = planCompanyHierarchy(snapshot);
  let current = snapshot, applied = 0;
  for (const change of plan.changes) {
    const company = current.companies.find(item => item.id === change.companyId);
    if (!company || company.parentCompanyId != null || !current.companies.some(item => item.id === change.parentCompanyId)) fail('The reviewed hierarchy changed; stop and prepare a fresh plan.');
    current = unwrapNative(await command({ action: 'apply_remote_command', id: change.requestId,
      expectedStateHash: syncStateHash(current), command: change.command }));
    if (current.companies.find(item => item.id === change.companyId)?.parentCompanyId !== change.parentCompanyId) fail('A native receipt did not establish the planned parent; inspect the current hierarchy before continuing.');
    applied++;
  }
  return { snapshot: current, plan, receipt: { mode: 'applied', ...plan.counts, appliedParentChanges: applied, ...plan.effects } };
}

function hasGitHistory(directory) {
  if (!fs.lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) return false;
  const metadata = fs.lstatSync(path.join(directory, '.git'), { throwIfNoEntry: false });
  if (metadata) {
    // Managed workspaces can contain an empty, unusable metadata placeholder.
    // It has no history or worktree identity; every nonempty marker fails closed.
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || fs.readdirSync(path.join(directory, '.git')).length > 0) return true;
  }
  // Bare repositories have no .git child but still contain repository data.
  return fs.lstatSync(path.join(directory, 'HEAD'), { throwIfNoEntry: false })?.isFile() === true
    && fs.lstatSync(path.join(directory, 'objects'), { throwIfNoEntry: false })?.isDirectory() === true
    && fs.lstatSync(path.join(directory, 'refs'), { throwIfNoEntry: false })?.isDirectory() === true;
}

/** Reject Git trees and symlink aliases, including ignored directories in a checkout. */
export function assertOutsideGit(target) {
  if (typeof target !== 'string' || !path.isAbsolute(target)) fail('Private state and output paths must be absolute.');
  const absolute = path.resolve(target);
  let cursor = path.parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
    if (part === '.git' || hasGitHistory(cursor)) fail('Private state and plans must remain outside Git repositories.');
    cursor = path.join(cursor, part);
    const stat = fs.lstatSync(cursor, { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) fail('Private paths must not contain symbolic links.');
  }
  if (hasGitHistory(absolute)) fail('Private state and plans must remain outside Git repositories.');
  return absolute;
}

function readOffice(userDataPath) {
  const stateFile = assertOutsideGit(path.join(userDataPath, 'company', 'company-state.json'));
  let descriptor;
  try {
    descriptor = fs.openSync(stateFile, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > MAX_STATE_BYTES) fail('Native state must be an initialized, bounded regular file.');
    const state = JSON.parse(fs.readFileSync(descriptor, 'utf8'));
    if (!state.office) fail('Initialize the native office before reconciliation.');
    return state.office;
  } catch (error) {
    if (error.message.startsWith('Company hierarchy:')) throw error;
    fail('Could not read the existing native office. No state was initialized or replaced.');
  } finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
}

function outputPath(value) {
  const filename = assertOutsideGit(value);
  if (fs.existsSync(filename)) fail('Choose a new output file; existing plans are never overwritten.');
  const directory = path.dirname(filename);
  if (!fs.statSync(directory, { throwIfNoEntry: false })?.isDirectory()) fail('The output directory must already exist outside Git.');
  fs.accessSync(directory, fs.constants.W_OK | fs.constants.X_OK);
  return filename;
}

export async function main(argv = process.argv.slice(2)) {
  const usage = 'Usage: node scripts/reconcile-company-hierarchy.mjs --core /absolute/atlas-core --user-data-path /private/runtime --output /private/plan.json [--apply]. With --apply, --output is optional and stdout contains counts only.';
  if (argv.length === 1 && argv[0] === '--help') { console.log(usage); return; }
  const opts = {}, allowed = new Set(['--core', '--user-data-path', '--output', '--apply']);
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!allowed.has(key) || Object.hasOwn(opts, key)) fail('Unsupported or duplicate command-line argument.');
    opts[key] = key === '--apply' ? true : argv[++index];
    if (!opts[key] || typeof opts[key] === 'string' && opts[key].startsWith('--')) fail('Missing command-line value.');
  }
  if (!opts['--core'] || !path.isAbsolute(opts['--core']) || !opts['--user-data-path'] || !opts['--apply'] && !opts['--output']) fail(usage);
  const core = fs.lstatSync(opts['--core'], { throwIfNoEntry: false });
  if (!core?.isFile() || core.isSymbolicLink()) fail('The native core must be an existing absolute binary path.');
  fs.accessSync(opts['--core'], fs.constants.X_OK);
  const userDataPath = assertOutsideGit(opts['--user-data-path']);
  const output = opts['--output'] ? outputPath(opts['--output']) : null;
  let snapshot = readOffice(userDataPath);
  let plan = planCompanyHierarchy(snapshot); // all malformed input fails before native housekeeping
  let nativeCall;
  if (opts['--apply']) {
    nativeCall = createNativeCall({ binary: opts['--core'], stateDir: path.join(userDataPath, 'company'), seedDir: path.join(REPO_ROOT, 'company'), repoRoot: REPO_ROOT });
    snapshot = unwrapNative(await nativeCall('office_snapshot', {}));
    plan = planCompanyHierarchy(snapshot);
  }
  // Save the entire reviewable plan before any hierarchy mutation. Exclusive
  // creation and private mode keep the report out of a repository or old plan.
  if (output) fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  const receipt = opts['--apply']
    ? (await applyCompanyHierarchy(snapshot, { command: payload => nativeCall('office_command', payload) })).receipt
    : { mode: 'plan', ...plan.counts, appliedParentChanges: 0, ...plan.effects };
  console.log(JSON.stringify(receipt));
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message.startsWith('Company hierarchy:') ? error.message : 'Company hierarchy: local operation failed. Inspect a fresh plan before retrying; no automatic retry was attempted.'); process.exitCode = 1; });
}
