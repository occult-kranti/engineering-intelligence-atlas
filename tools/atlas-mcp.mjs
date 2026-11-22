#!/usr/bin/env node
// Daftar - local stdio MCP server (Node >= 22, built-ins only).
// Local state is owned by the native Rust core. External calls only discover
// public GitHub metadata; this server does not execute provider jobs or code.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_INFO = Object.freeze({ name: 'atlas-company', version: '0.5.0' });
export const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze(['2025-11-25', '2025-06-18']);
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export const NATIVE_TIMEOUT_MS = 25_000;
export const NATIVE_OUTPUT_LIMIT = 16 * 1024 * 1024;
export const REQUEST_LIMIT = 1024 * 1024;
export const GITHUB_BODY_LIMIT = 1024 * 1024;
export const GITHUB_TIMEOUT_MS = 12_000;
export const TOOL_OUTPUT_LIMIT = 1024 * 1024;
export const OFFICE_QUERY_PAGE_BYTES = 128 * 1024;

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'daftar-mcp/0.5.0';
const TASK_STATUSES = Object.freeze(['todo', 'in-progress', 'blocked', 'done']);
const SEGMENT_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$|^[A-Za-z0-9]$/;
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const SHA_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export class ToolError extends Error {
  constructor(message, code = 'tool_error') {
    super(message);
    this.name = 'ToolError';
    this.code = code;
  }
}

export class InvalidParams extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidParams';
  }
}

// ---------------------------------------------------------------------------
// Repository parsing
// ---------------------------------------------------------------------------

function validRepoSegments(owner, repo) {
  if (!OWNER_RE.test(owner)) return false;
  if (!SEGMENT_RE.test(repo)) return false;
  if (repo === '.' || repo === '..' || repo.endsWith('.git')) return false;
  if (owner.includes('--')) return false;
  return true;
}

/**
 * Parse a repository reference. Accepts https://github.com/owner/repo (optional
 * terminal .git or trailing slash) or owner/repo shorthand. Throws InvalidParams otherwise.
 */
export function parseRepository(input) {
  if (typeof input !== 'string') throw new InvalidParams('repository must be a string');
  const raw = input.trim();
  if (raw.length === 0 || raw.length > 300) throw new InvalidParams('repository length invalid');
  if (/[\s\\\u0000-\u001f\u007f]/.test(raw)) throw new InvalidParams('repository contains forbidden characters');

  let owner;
  let repo;
  if (/^https?:\/\//i.test(raw)) {
    const m = /^https:\/\/github\.com\/([^/?#@:]+)\/([^/?#@:]+?)(?:\.git)?\/?$/.exec(raw);
    if (!m) throw new InvalidParams('repository URL must be https://github.com/owner/repo');
    owner = m[1];
    repo = m[2];
    // Re-handle the case where regex lazily stripped only one ".git"; reject double suffixes.
    if (repo.endsWith('.git')) throw new InvalidParams('invalid repository name');
  } else {
    if (raw.includes(':') || raw.includes('@') || raw.includes('?') || raw.includes('#')) {
      throw new InvalidParams('repository shorthand must be owner/repo');
    }
    const m = /^([^/]+)\/([^/]+)$/.exec(raw);
    if (!m) throw new InvalidParams('repository shorthand must be owner/repo');
    owner = m[1];
    repo = m[2];
    if (repo.endsWith('.git')) repo = repo.slice(0, -4);
  }
  if (!validRepoSegments(owner, repo)) throw new InvalidParams('invalid owner or repository name');
  return { owner, repo, repoUrl: `https://github.com/${owner}/${repo}` };
}

// ---------------------------------------------------------------------------
// Native core invocation
// ---------------------------------------------------------------------------

export function resolveLaunchConfig(env = process.env, moduleUrl = import.meta.url) {
  const modulePath = fileURLToPath(moduleUrl);
  const defaultRepoRoot = resolve(dirname(modulePath), '..');
  const repoRoot = resolve(env.ATLAS_REPO_ROOT || defaultRepoRoot);
  const stateDir = resolve(
    env.ATLAS_STATE_DIR || join(homedir(), '.local', 'share', 'engineering-intelligence-atlas', 'company')
  );
  const binary = resolve(env.ATLAS_CORE_BINARY || join(repoRoot, 'native-core', 'target', 'release', process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core'));
  const seedDir = join(repoRoot, 'company');
  for (const [label, p] of [['repoRoot', repoRoot], ['stateDir', stateDir], ['binary', binary]]) {
    if (!isAbsolute(p)) throw new Error(`${label} must be absolute`);
  }
  return { repoRoot, stateDir, seedDir, binary };
}

/**
 * Create a nativeCall(command, payload) function bound to launch-time configuration.
 * Callers can never supply binary/stateDir/seedDir/repositoryRoot.
 */
export function createNativeCall(config, { spawnImpl = spawn } = {}) {
  const { binary, stateDir, seedDir, repoRoot } = config;
  return function nativeCall(command, payload = {}) {
    return new Promise((resolvePromise, rejectPromise) => {
      const request = JSON.stringify({
        command,
        stateDir,
        seedDir,
        repositoryRoot: repoRoot,
        payload
      });
      let child;
      try {
        child = spawnImpl(binary, [], { shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      } catch (err) {
        rejectPromise(new ToolError(`native core could not be started: ${err.message}`, 'native_spawn_failed'));
        return;
      }
      let settled = false;
      let out = [];
      let outBytes = 0;
      let errBytes = 0;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
        finish(rejectPromise, new ToolError('native core timed out', 'native_timeout'));
      }, NATIVE_TIMEOUT_MS);

      child.on('error', (err) => {
        finish(rejectPromise, new ToolError(`native core failed: ${err.message}`, 'native_spawn_failed'));
      });
      child.stdout.on('data', (chunk) => {
        outBytes += chunk.length;
        if (outBytes > NATIVE_OUTPUT_LIMIT) {
          try { child.kill('SIGKILL'); } catch { /* ignore */ }
          finish(rejectPromise, new ToolError('Native response exceeded 16 MiB. State may already be saved; inspect it before replaying any mutation.', 'native_output_too_large'));
          return;
        }
        out.push(chunk);
      });
      child.stderr.on('data', (chunk) => {
        errBytes += chunk.length; // drained and discarded; stderr is never forwarded to the protocol stream
      });
      child.stdin.on('error', () => { /* handled via close/exit */ });
      child.on('close', (code) => {
        if (settled) return;
        const text = Buffer.concat(out).toString('utf8');
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          finish(rejectPromise, new ToolError(`native core returned invalid output (exit ${code})`, 'native_bad_output'));
          return;
        }
        if (!parsed || typeof parsed !== 'object' || typeof parsed.ok !== 'boolean') {
          finish(rejectPromise, new ToolError('native core returned unexpected shape', 'native_bad_output'));
          return;
        }
        finish(resolvePromise, parsed);
      });
      child.stdin.end(request);
    });
  };
}

// ---------------------------------------------------------------------------
// GitHub metadata (public, unauthenticated, fixed endpoints only)
// ---------------------------------------------------------------------------

async function readBoundedJson(response, limit = GITHUB_BODY_LIMIT) {
  const declared = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw new ToolError('GitHub response too large', 'github_too_large');
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text();
    if (Buffer.byteLength(text) > limit) throw new ToolError('GitHub response too large', 'github_too_large');
    return parseJsonText(text);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new ToolError('GitHub response too large', 'github_too_large');
    }
    chunks.push(value);
  }
  return parseJsonText(Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8'));
}

function parseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new ToolError('GitHub returned invalid JSON', 'github_bad_json');
  }
}

async function githubGet(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'error',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS)
    });
  } catch (err) {
    throw new ToolError(`GitHub request failed: ${err?.name === 'TimeoutError' ? 'timeout' : err?.message || 'network error'}`, 'github_network');
  }
  if (!response.ok) {
    if (response.status === 404) throw new ToolError('GitHub repository not found or not public', 'github_not_found');
    if (response.status === 403 || response.status === 429) throw new ToolError('GitHub rate limit or access denied', 'github_rate_limited');
    throw new ToolError(`GitHub responded with HTTP ${response.status}`, 'github_http_error');
  }
  try {
    return await readBoundedJson(response);
  } catch (err) {
    if (err instanceof ToolError) throw err;
    throw new ToolError(`GitHub response could not be read: ${err.message}`, 'github_network');
  }
}

function isCount(n) {
  return Number.isSafeInteger(n) && n >= 0;
}

function isIsoDate(s) {
  return typeof s === 'string' && s.length <= 40 && !Number.isNaN(Date.parse(s));
}

export function validateRepoMetadata(meta, parsed) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new ToolError('GitHub metadata malformed', 'github_bad_shape');
  const { default_branch: defaultBranch, description, stargazers_count: stars, open_issues_count: openIssues, pushed_at: pushedAt } = meta;
  if (typeof defaultBranch !== 'string' || defaultBranch.length === 0 || defaultBranch.length > 255 || /[\u0000-\u001f\u007f]/.test(defaultBranch)) {
    throw new ToolError('GitHub metadata has invalid default_branch', 'github_bad_shape');
  }
  if (!(description === null || description === undefined || (typeof description === 'string' && description.length <= 2000))) {
    throw new ToolError('GitHub metadata has invalid description', 'github_bad_shape');
  }
  if (!isCount(stars) || !isCount(openIssues)) throw new ToolError('GitHub metadata has invalid counts', 'github_bad_shape');
  if (!isIsoDate(pushedAt)) throw new ToolError('GitHub metadata has invalid pushed_at', 'github_bad_shape');
  if (typeof meta.full_name === 'string') {
    if (meta.full_name.toLowerCase() !== `${parsed.owner}/${parsed.repo}`.toLowerCase()) {
      throw new ToolError('GitHub metadata does not match requested repository', 'github_bad_shape');
    }
  }
  return { defaultBranch, description: description ?? null, stars, openIssues, pushedAt };
}

export function validateCommit(commit) {
  if (!commit || typeof commit !== 'object' || typeof commit.object?.sha !== 'string' || !SHA_RE.test(commit.object.sha)) {
    throw new ToolError('GitHub commit SHA malformed', 'github_bad_sha');
  }
  return commit.object.sha;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const EMPTY_SCHEMA = Object.freeze({ type: 'object', properties: {}, additionalProperties: false });
export const OFFICE_COLLECTIONS = Object.freeze(['companies','offices','departments','employees','jobs','schedules','knowledge','events','chatThreads','goals','checkpoints','blueprints','rooms','desks','whiteboards','goalSteps','groups','services','contracts','transfers','roadmap','decisionPanels','authorityGrants','authorityLedger','index','stickyNotes','improvementSessions','improvementAllowances']);
const QUERY_SCOPE_KINDS = Object.freeze(['company','office','department','employee','goal','group']);
const NESTED_COLLECTIONS = Object.freeze({ rooms: 100, desks: 1000, whiteboards: 200, goalSteps: 12 });
const NESTED_SCOPE_KINDS = Object.freeze({ rooms: ['company','office'], desks: ['company','office'], whiteboards: ['company','office'], goalSteps: ['company','office','department','employee','goal'] });
const NESTED_FIELDS = Object.freeze({
  rooms: ['id','name','departmentId','x','y','width','height'],
  desks: ['id','roomId','employeeId','x','y'],
  whiteboards: ['id','roomId','ownerEmployeeId','title','goalIds','jobIds','roadmapItemIds','x','y','revision'],
  goalSteps: ['id','title','employeeId','dependsOn','serviceContractId','knowledgeTransferIds','reviewerEmployeeId','reviewerServiceContractId','estimate','reviewEstimate','officeId','departmentId'],
});

export const OFFICE_ACTIONS = Object.freeze(['create_company','select_company','create_office','create_department','hire_employee','pause_employee','resume_employee','fire_employee','pause_company','resume_company','pause_office','resume_office','pause_department','resume_department','enqueue_job','claim_job','reserve_job','finish_job','heartbeat_job','cancel_job','pause_job','resume_job','create_schedule','pause_schedule','resume_schedule','tick_schedules','configure_cache','clear_cache','get_cache','put_cache','add_knowledge','configure_policy','reserve_external','settle_external','approve_job','bootstrap_directors','post_chat','post_assistant_message','create_goal','create_paired_workflow','plan_goal','set_goal_plan','execute_goal','advance_goal','tick_goals','pause_goal','resume_goal','checkpoint_goal','ensure_blueprint','save_blueprint','upsert_room','place_employee','upsert_whiteboard','configure_ceo','upsert_portfolio_group','ensure_shared_services','optimize_portfolio','contract_service','share_knowledge','upsert_roadmap_item','convene_panel','start_panel_round','record_panel_decision','pause_panel','resume_panel','grant_authority','promote_employee','revoke_authority','set_authority_enforcement','rebuild_office_index','apply_employee_command','check_worker_authority','rename_company','set_company_parent','set_department_parent','upsert_sticky_note','archive_sticky_note','register_improvement_allowance','create_improvement_session','control_improvement_session']);

export const TOOL_DEFINITIONS = Object.freeze([
  { name:'office_snapshot', title:'Office control snapshot', description:'Read the local office. Large wire results are successful metadata summaries with snapshotOmitted:true; use office_query for paginated metadata. No provider calls.', inputSchema:EMPTY_SCHEMA, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false} },
  { name:'office_query', title:'Query office metadata', description:'Read bounded metadata pages. Nested rooms, desks and whiteboards require an explicit company or office scope; goalSteps requires company, office, department, employee or goal scope. Canonical IDs, geometry and bounded dependency/link arrays are preserved; omissions are explicit. Prompts, chat bodies, evidence text, local paths and credentials are excluded. Scope filters do not grant authority. Reuse nextCursor with unchanged filters; query_changed means restart the read. Local state only.', inputSchema:{type:'object',properties:{collection:{type:'string',enum:[...OFFICE_COLLECTIONS]},scope:{type:'object',properties:{kind:{type:'string',enum:[...QUERY_SCOPE_KINDS]},id:{type:'string',minLength:1,maxLength:150}},required:['kind','id'],additionalProperties:false},search:{type:'string',maxLength:200},pageSize:{type:'integer',minimum:1,maximum:100,default:25},cursor:{type:'string',maxLength:1024}},required:['collection'],additionalProperties:false,allOf:[{if:{properties:{collection:{enum:['rooms','desks','whiteboards']}}},then:{required:['scope'],properties:{scope:{properties:{kind:{enum:['company','office']}}}}}},{if:{properties:{collection:{const:'goalSteps'}}},then:{required:['scope'],properties:{scope:{properties:{kind:{enum:['company','office','department','employee','goal']}}}}}}]},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false} },
  { name:'office_command', title:'Office control operation', description:'Apply an explicit local state command. A large result returns a successful receipt with snapshotOmitted:true: do not replay that mutation; use office_query. No code or provider execution; jobs require a separately enabled worker and budget authorization.', inputSchema:{type:'object',properties:{action:{type:'string',enum:[...OFFICE_ACTIONS]},payload:{type:'object'}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:false} },
  { name:'github_import_account',title:'Import public repositories as companies',description:'Read public repositories for one GitHub account and create corresponding local company/office/assistant definitions. No private repositories, provider calls, or external writes.',inputSchema:{type:'object',properties:{owner:{type:'string',maxLength:39}},required:['owner'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true} },

  {
    name: 'company_snapshot',
    title: 'Company snapshot',
    description: 'Return the local company state (company, employees, tasks, milestones, activity, repository index) from the native core. Reads local state only; no network access.',
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: 'company_register',
    title: 'Register company from GitHub repository',
    description: 'Fetch public, unauthenticated metadata for a GitHub repository from api.github.com (repo and default-branch head commit) and persist it as the company in local state. External data is read-only; the only write is to local atlas state. Fails without registering if GitHub is unreachable or returns invalid data.',
    inputSchema: {
      type: 'object',
      properties: {
        repository: { type: 'string', maxLength: 300, description: 'https://github.com/owner/repo (optional .git or trailing slash) or owner/repo' }
      },
      required: ['repository'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  },
  {
    name: 'team_list',
    title: 'List team',
    description: 'List employees (roster) from local state. Reads local state only; no network access.',
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: 'roadmap_list',
    title: 'List roadmap',
    description: 'List roadmap tasks and milestones from local state. Reads local state only; no network access.',
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: 'roadmap_update',
    title: 'Update roadmap task',
    description: 'Update the status (and optional evidence) of one roadmap task in local state. Marking a task done requires non-empty evidence. Overwrites the task status; local only.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', minLength: 1, maxLength: 100 },
        status: { type: 'string', enum: [...TASK_STATUSES] },
        evidence: { type: 'string', maxLength: 2000 }
      },
      required: ['id', 'status'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
  },
  {
    name: 'repository_index',
    title: 'Index repository',
    description: 'Ask the native core to rebuild its bounded index of the configured local repository and store it in local state. Does not execute repository code or accept caller-supplied paths.',
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }
]);

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

function assertPlainObject(args, name) {
  if (args === undefined || args === null) return {};
  if (typeof args !== 'object' || Array.isArray(args)) throw new InvalidParams(`${name}: arguments must be an object`);
  return args;
}

function assertNoKeys(args, allowed, name) {
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) throw new InvalidParams(`${name}: unknown argument "${key}"`);
  }
}

function unwrapNative(result) {
  if (result && result.ok === true && result.snapshot && typeof result.snapshot === 'object') return result.snapshot;
  const message = typeof result?.error === 'string' ? result.error : 'native core error';
  throw new ToolError(message, typeof result?.code === 'string' ? result.code : 'native_error');
}

const SECRET_TEXT = /(?:sk-ant-|sk-proj-|sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{8,}|\bBearer\s+[A-Za-z0-9._~-]+/gi;
const ID_FIELDS = ['id','entityId','parentId','parentCompanyId','parentDepartmentId','companyId','officeId','departmentId','employeeId','ownerEmployeeId','reviewerEmployeeId','reviewerServiceContractId','assistantId','goalId','jobId','scheduleId','panelId','grantId','blueprintId','roomId','whiteboardId','roadmapItemId','serviceId','serviceContractId','contractId','transferId','knowledgeId','groupId','recipientCompanyId','recipientOfficeId','recipientDepartmentId','sourceCompanyId','targetId'];
const TEXT_FIELDS = ['name','title','role','kind','status','action','actor','outcome','type','preset','issuer','mode','provider','model','costStatus','source','visibility','githubStatus'];
const DATE_FIELDS = ['at','createdAt','updatedAt','importedAt','grantedAt','expiresAt','revokedAt','dueAt','startedAt','finishedAt','nextRunAt','lastEnqueuedAt'];
const NUMBER_FIELDS = ['iteration','maxIterations','round','maxRounds','everyMinutes','indexEntries','imported','created','revision'];
const BOOL_FIELDS = ['enabled','authorized','allowed','revoked','requiresGrants','rebuilt','queued'];
const ARRAY_COUNTS = ['messages','steps','jobs','jobIds','goalIds','dependencies','members','decisions','rooms','desks','whiteboards','companyIds','employeeIds','relatedIds','parentGrantIds','skillPaths'];
const hash = value => createHash('sha256').update(value).digest('hex');
const list = value => Array.isArray(value) ? value : [];

function summaryText(value, limit = 240) {
  return String(value).replace(SECRET_TEXT, '[credential omitted]')
    .replace(/\b(?:token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, '[credential omitted]')
    .replace(/(?:file:\/\/|\/home\/|\/Users\/|\/workspace\/|[A-Z]:\\)[^\s<>"']+/gi, '[local path omitted]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, limit);
}

function summaryId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,160}$/.test(value)) return undefined;
  // Identifiers are canonical references, not human text. Redacting a valid
  // credential-like prefix changes the entity being addressed.
  return value;
}

function collectionRows(snapshot, name) {
  if (name === 'improvementAllowances') return snapshot.improvementAllowance ? [snapshot.improvementAllowance] : [];
  if (['groups','services','contracts','transfers','roadmap'].includes(name)) return list(snapshot.portfolio?.[name]);
  if (name === 'authorityGrants') return list(snapshot.authority?.grants);
  if (name === 'authorityLedger') return list(snapshot.authority?.ledger);
  if (name === 'index') return list(snapshot.authority?.index);
  return list(snapshot[name]);
}

export function officeCollectionCounts(snapshot) {
  return Object.fromEntries(OFFICE_COLLECTIONS.map(name => [name, Object.hasOwn(NESTED_COLLECTIONS, name)
    ? list(snapshot[name === 'goalSteps' ? 'goals' : 'blueprints']).reduce((n, parent) => n + list(parent?.[name === 'goalSteps' ? 'steps' : name]).length, 0)
    : collectionRows(snapshot, name).length]));
}

// Duplicate identities are ambiguous, so they cannot establish ancestry for a
// nested read. These maps are request-local and retain no snapshot between calls.
function canonicalMap(rows) {
  const result = new Map(), ambiguous = new Set();
  for (const row of rows) {
    const id = summaryId(row?.id); if (!id || ambiguous.has(id)) continue;
    if (result.has(id)) { result.delete(id); ambiguous.add(id); } else result.set(id, row);
  }
  return result;
}
function officeMetadataContext(snapshot) {
  const maps = Object.fromEntries(['companies','offices','departments','employees','goals','jobs','contracts','transfers','roadmap','groups','stickyNotes','improvementSessions'].map(name => [name, canonicalMap(collectionRows(snapshot, name))]));
  const companiesForScope = scope => {
    if (scope?.kind === 'company') return new Set(maps.companies.has(scope.id) ? [scope.id] : []);
    if (scope?.kind === 'global' && scope.id === 'portfolio') return new Set(maps.companies.keys());
    if (scope?.kind === 'group') return new Set(list(maps.groups.get(scope.id)?.companyIds).filter(id => maps.companies.has(id)));
    return new Set();
  };
  return { maps, companiesForScope };
}
function nestedOfficeRows(snapshot, name, matches, context) {
  const { maps } = context, rows = []; let omittedRows = 0, sourceTruncated = false;
  const goalSteps = name === 'goalSteps';
  const parents = list(snapshot[goalSteps ? 'goals' : 'blueprints']);
  const parentMap = canonicalMap(parents);
  for (const parent of parents) {
    if (!parent || typeof parent !== 'object') continue;
    const children = list(parent[goalSteps ? 'steps' : name]);
    const scope = parent.scope;
    const goalScopeValid = scope?.kind === 'company' ? scope.id === parent.companyId
      : scope?.kind === 'office' ? maps.offices.get(scope.id)?.companyId === parent.companyId
        : scope?.kind === 'department' ? maps.departments.get(scope.id)?.companyId === parent.companyId
          : scope?.kind === 'employee' && maps.employees.has(scope.id) && (maps.employees.get(scope.id).companyId === null || maps.employees.get(scope.id).companyId === parent.companyId);
    const parentValid = parentMap.get(parent.id) === parent && maps.companies.has(parent.companyId)
      && (goalSteps ? goalScopeValid : maps.offices.get(parent.officeId)?.companyId === parent.companyId);
    const roomMap = canonicalMap(list(parent.rooms));
    const childMap = canonicalMap(children);
    const base = { companyId: parent.companyId, ...(goalSteps ? { goalId: parent.id, scope: parent.scope } : { blueprintId: parent.id, officeId: parent.officeId }) };
    if (!goalSteps && !matches(base, name)) continue;
    for (let i = 0; i < Math.min(children.length, NESTED_COLLECTIONS[name]); i++) {
      const child = children[i];
      const row = child && typeof child === 'object' && !Array.isArray(child) ? { ...child, ...base } : { ...base };
      if (goalSteps) {
        // The enclosing goal owns the scope. A shared worker's home office must
        // never move recipient work into another company's metadata view.
        delete row.officeId; delete row.departmentId;
        const department = parent.scope?.kind === 'department' ? maps.departments.get(parent.scope.id) : null;
        const employee = maps.employees.get(row.employeeId);
        const contract = maps.contracts.get(row.serviceContractId);
        const officeId = parent.scope?.kind === 'office' ? parent.scope.id : department?.officeId
          ?? (employee?.companyId === parent.companyId ? employee.officeId : undefined)
          ?? (contract?.recipientCompanyId === parent.companyId ? contract.recipientOfficeId : undefined);
        if (maps.offices.get(officeId)?.companyId === parent.companyId) row.officeId = officeId;
        if (department?.companyId === parent.companyId) row.departmentId = department.id;
      }
      if (!matches(row, name)) continue;
      const room = roomMap.get(row.roomId);
      const validRoom = room && (!room.departmentId || maps.departments.get(room.departmentId)?.companyId === parent.companyId && maps.departments.get(room.departmentId)?.officeId === parent.officeId);
      const coordinate = key => Number.isFinite(row[key]) && row[key] >= 0 && row[key] <= 1;
      const valid = parentValid && childMap.get(row.id) === child && summaryId(row.id)
        && (goalSteps ? maps.employees.has(row.employeeId)
          : name === 'rooms' ? typeof row.name === 'string' && ['x','y','width','height'].every(coordinate) && row.width > 0 && row.height > 0 && row.x + row.width <= 1.000000001 && row.y + row.height <= 1.000000001
            && (!row.departmentId || maps.departments.get(row.departmentId)?.companyId === parent.companyId && maps.departments.get(row.departmentId)?.officeId === parent.officeId)
          : validRoom && coordinate('x') && coordinate('y') && maps.employees.has(name === 'desks' ? row.employeeId : row.ownerEmployeeId));
      if (!valid) { omittedRows++; continue; }
      // A nested record cannot invent another scope, parent, or actor alias.
      rows.push(Object.fromEntries([...Object.keys(base), ...NESTED_FIELDS[name]].filter(key => row[key] !== undefined).map(key => [key, row[key]])));
    }
    // Do not pretend a malformed over-cap source was completely inspected.
    if (children.length > NESTED_COLLECTIONS[name]) {
      sourceTruncated = true;
      if (matches(base, name)) omittedRows += children.length - NESTED_COLLECTIONS[name];
    }
  }
  return { rows, omittedRows, sourceTruncated };
}

function linkedMetadata(out, row, collection, context) {
  const { maps, companiesForScope } = context;
  const companies = collection === 'roadmap' ? companiesForScope(row.scope) : new Set([row.companyId]);
  const missing = {};
  const ids = (key, limit, valid = () => true) => {
    const source = row[key] === undefined ? [] : row[key];
    const result = []; let omitted = Array.isArray(source) ? Math.max(0, source.length - limit) : 1;
    for (const id of list(source).slice(0, limit)) {
      if (summaryId(id) && valid(id)) result.push(id); else omitted++;
    }
    out[key] = result; if (omitted) missing[key] = omitted;
  };
  if (['stickyNotes','improvementSessions'].includes(collection)) {
    ids('goalIds',100,id=>maps.goals.get(id)?.companyId===row.companyId);
    if(collection==='improvementSessions')ids('taskNoteIds',128,id=>{
      const note=maps.stickyNotes.get(id);return note?.companyId===row.companyId&&note.officeId===row.officeId&&note.departmentId===(row.departmentId??null);
    });
  }
  if (collection === 'whiteboards' || collection === 'roadmap') {
    ids('goalIds', 100, id => companies.has(maps.goals.get(id)?.companyId));
    ids('jobIds', 100, id => companies.has(maps.jobs.get(id)?.companyId));
    if (collection === 'whiteboards') ids('roadmapItemIds', 100, id => companiesForScope(maps.roadmap.get(id)?.scope).has(row.companyId));
    else ids('dependencies', 100, id => id !== row.id && maps.roadmap.has(id) && (row.scope?.kind === 'global' || [...companiesForScope(maps.roadmap.get(id).scope)].some(company => companies.has(company))));
  }
  if (collection === 'goalSteps') {
    const siblings = canonicalMap(list(maps.goals.get(row.goalId)?.steps));
    ids('dependsOn', 12, id => id !== row.id && siblings.has(id));
    ids('knowledgeTransferIds', 100, id => maps.transfers.get(id)?.recipientCompanyId === row.companyId);
  }
  if (['whiteboards','roadmap','goalSteps','stickyNotes','improvementSessions'].includes(collection)) {
    out.referencesComplete = Object.keys(missing).length === 0;
    out.omittedReferences = missing;
  }
  if (collection === 'roadmap') out.evidencePresent = typeof row.evidence === 'string' && row.evidence.trim().length > 0;
  for (const key of ['estimate','reviewEstimate']) {
    if (!['roadmap','goalSteps'].includes(collection) || row[key] === undefined) continue;
    if (row[key] === null) { out[key] = null; continue; }
    const values = ['optimisticMinutes','likelyMinutes','pessimisticMinutes'].map(name => row[key]?.[name]);
    if (values.every(n => Number.isFinite(n) && n >= 0.01 && n <= 1440) && values[0] <= values[1] && values[1] <= values[2]) out[key] = Object.fromEntries(['optimisticMinutes','likelyMinutes','pessimisticMinutes'].map((name, i) => [name, values[i]]));
    else { out.metadataIncomplete = true; }
  }
  if (collection === 'goals') {
    for (const key of ['sourceRequestId', 'sourceMessageId', 'requestSha256']) {
      if (row[key] === null) out[key] = null;
      else if (row[key] !== undefined) {
        if (key === 'requestSha256' ? typeof row[key] === 'string' && /^[a-f0-9]{64}$/.test(row[key]) : summaryId(row[key])) out[key] = row[key];
        else out.metadataIncomplete = true;
      }
    }
  }
  if (collection === 'jobs') {
    for (const key of ['requestSha256','artifactSha256','deliverableSha256']) if (typeof row[key] === 'string' && /^[a-f0-9]{64}$/.test(row[key])) out[key] = row[key];
    if (row.pair === null) out.pair = null;
    else if (row.pair && ['primary','review'].includes(row.pair.phase) && ['stepId','peerEmployeeId','primaryJobId','reviewJobId'].every(key => summaryId(row.pair[key]))) out.pair = Object.fromEntries(['stepId','phase','peerEmployeeId','primaryJobId','reviewJobId'].map(key => [key, row.pair[key]]));
    else if (row.pair !== undefined) out.metadataIncomplete = true;
    if (row.review === null) out.review = null;
    else if (row.review && ['accepted','revise','blocked'].includes(row.review.verdict) && ['primaryArtifactSha256','reviewArtifactSha256'].every(key => /^[a-f0-9]{64}$/.test(row.review[key] ?? '')) && isIsoDate(row.review.recordedAt)) {
      const refs = list(row.review.evidenceRefs), evidenceRefs = refs.slice(0, 20).filter(id => summaryId(id));
      const coverageKnown = typeof row.review.primaryArtifactComplete === 'boolean';
      out.review = { verdict: row.review.verdict, primaryArtifactSha256: row.review.primaryArtifactSha256, reviewArtifactSha256: row.review.reviewArtifactSha256,
        primaryArtifactComplete: coverageKnown ? row.review.primaryArtifactComplete : null,
        summary: summaryText(row.review.summary ?? '', 1000), evidenceRefs, omittedEvidenceRefs: refs.length - evidenceRefs.length, recordedAt: row.review.recordedAt };
      if (!coverageKnown) out.metadataIncomplete = true;
    } else if (row.review !== undefined) out.metadataIncomplete = true;
    if (row.reviewFailure === null) out.reviewFailure = null;
    else if (row.reviewFailure && ['malformed-output','input-budget','artifact-mismatch','recording-unconfirmed'].includes(row.reviewFailure.reason)
      && typeof row.reviewFailure.summary === 'string' && row.reviewFailure.summary.trim()
      && Buffer.byteLength(row.reviewFailure.summary, 'utf8') <= 2000 && isIsoDate(row.reviewFailure.recordedAt)) {
      // A trusted adapter failure is not a model verdict or evidence of acceptance.
      out.reviewFailure = { reason: row.reviewFailure.reason, summary: summaryText(row.reviewFailure.summary, 1000), recordedAt: row.reviewFailure.recordedAt };
    } else if (row.reviewFailure !== undefined) out.metadataIncomplete = true;
  }
}

/** Deliberately a metadata allowlist, not a recursively redacted full record. */
function metadataSummary(row, collection, context) {
  const out = {};
  if (!row || typeof row !== 'object') return out;
  for (const key of ID_FIELDS) { const value = summaryId(row[key]); if (value !== undefined) out[key] = value; }
  for(const key of ['improvementSessionId','allowanceId','primaryEmployeeId','activeGoalId','activeNoteId']) {
    if(row[key]===null)out[key]=null;else if(summaryId(row[key]))out[key]=row[key];
  }
  for (const key of ['parentCompanyId','parentDepartmentId','departmentId','serviceContractId','reviewerEmployeeId','reviewerServiceContractId']) if (row[key] === null) out[key] = null;
  for (const key of TEXT_FIELDS) if (typeof row[key] === 'string') out[key] = summaryText(row[key]);
  for (const key of DATE_FIELDS) if (isIsoDate(row[key])) out[key] = row[key];
  for (const key of NUMBER_FIELDS) if (Number.isFinite(row[key])) out[key] = row[key];
  for(const key of ['cycle','budgetHoldUsd','capUsd','carriedObservedUsd','carriedEstimatedUsd'])if(Number.isFinite(row[key])&&row[key]>=0)out[key]=row[key];
  if(collection==='improvementSessions') {
    out.continuation=['until-budget','backlog'].includes(row.continuation)?row.continuation:null;
    out.maxCycles=row.maxCycles===null?null:Number.isInteger(row.maxCycles)&&row.maxCycles>=1&&row.maxCycles<=1000?row.maxCycles:null;
    out.objectivePreview=summaryText(row.objective??'',1000);out.objectiveIncomplete=out.objectivePreview!==row.objective;
    out.stopReason=row.stopReason===null?null:summaryText(row.stopReason??'',300);
    const routes=list(row.allowedRoutes);out.allowedRoutes=routes.slice(0,16).filter(route=>['anthropic','openai','ollama'].includes(route?.provider)&&typeof route.model==='string'&&/^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,199}$/.test(route.model)).map(route=>({provider:route.provider,model:route.model}));
    out.omittedRoutes=routes.length-out.allowedRoutes.length;
    out.outcomeKind='proposed-artifact-unless-tool-evidence';
  }
  if(collection==='stickyNotes') {
    out.text=summaryText(row.text??'',4000);out.textIncomplete=out.text!==row.text;
    if(['yellow','blue','green','pink','purple','gray'].includes(row.color))out.color=row.color;
    for(const key of ['x','y'])if(Number.isFinite(row[key])&&row[key]>=0&&row[key]<=1)out[key]=row[key];
  }
  if(collection==='improvementAllowances')out.sourceReference=summaryText(row.sourceReference??'',300);
  for (const key of BOOL_FIELDS) if (typeof row[key] === 'boolean') out[key] = row[key];
  for (const key of ARRAY_COUNTS) if (Array.isArray(row[key])) out[`${key}Count`] = row[key].length;
  if (row.scope && typeof row.scope.kind === 'string' && summaryId(row.scope.id)) out.scope = { kind: summaryText(row.scope.kind, 30), id: summaryId(row.scope.id) };
  if (Array.isArray(row.capabilities)) out.capabilities = row.capabilities.filter(c => typeof c === 'string').slice(0, 20).map(c => summaryText(c, 80));
  if (row.usage && typeof row.usage === 'object') {
    out.usage = {};
    for (const key of ['inputTokens','outputTokens','costUsd']) if (Number.isFinite(row.usage[key])) out.usage[key] = row.usage[key];
  }
  if (['rooms','desks','whiteboards'].includes(collection)) for (const key of ['x','y','width','height']) if (Number.isFinite(row[key])) out[key] = row[key];
  if (context) linkedMetadata(out, row, collection, context);
  return out;
}

/** Scope is a read filter. It never grants permission to execute an operation. */
function scopeMatcher(snapshot, scope) {
  if (!scope) return () => true;
  const kinds = { company:'companies', office:'offices', department:'departments', employee:'employees', goal:'goals', group:'groups', job:'jobs', knowledge:'knowledge', roadmap:'roadmap', authority:'authorityGrants' };
  const maps = Object.fromEntries(Object.entries(kinds).map(([kind, name]) => [kind, new Map(collectionRows(snapshot, name).map(row => [row.id, row]))]));
  const ownKind = Object.fromEntries(Object.entries(kinds).map(([kind, name]) => [name, kind]));
  return (row, collection) => {
    const references = new Set();
    const add = (kind, id, ancestors = true) => {
      if (typeof id !== 'string' || references.has(`${kind}:${id}`)) return;
      references.add(`${kind}:${id}`);
      if (!ancestors) return;
      const entity = maps[kind]?.get(id);
      if (entity) location(entity);
    };
    const location = entity => {
      for (const key of ['companyId','recipientCompanyId','sourceCompanyId']) add('company', entity[key]);
      for (const key of ['officeId','recipientOfficeId']) add('office', entity[key]);
      for (const key of ['departmentId','recipientDepartmentId']) add('department', entity[key]);
      const located = entity.companyId || entity.officeId || entity.departmentId;
      add('employee', entity.employeeId, !located);
      add('employee', entity.primaryEmployeeId, !located);
      add('employee', entity.reviewerEmployeeId, !located);
      add('employee', entity.ownerEmployeeId, !located && !entity.scope);
      add('goal', entity.goalId, !located);
      for (const id of list(entity.goalIds)) add('goal', id, false);
      for (const id of list(entity.employeeIds)) add('employee', id, false);
      for (const id of list(entity.companyIds)) add('company', id);
      if (entity.scope) add(entity.scope.kind, entity.scope.id);
    };
    location(row);
    if (ownKind[collection]) add(ownKind[collection], row.id);
    if (collection === 'index') add(row.kind === 'artifact' ? 'job' : row.kind, row.entityId);
    if (collection === 'events') for (const [kind, map] of Object.entries(maps)) if (map.has(row.entityId)) add(kind, row.entityId);
    if (scope.kind === 'group') return references.has(`group:${scope.id}`) || list(maps.group.get(scope.id)?.companyIds).some(id => references.has(`company:${id}`));
    return references.has(`${scope.kind}:${scope.id}`);
  };
}

function validateOfficeQuery(args) {
  const a = assertPlainObject(args, 'office_query');
  assertNoKeys(a, ['collection','scope','search','pageSize','cursor'], 'office_query');
  if (!OFFICE_COLLECTIONS.includes(a.collection)) throw new InvalidParams('office_query: choose a supported collection');
  if (a.pageSize !== undefined && (!Number.isSafeInteger(a.pageSize) || a.pageSize < 1 || a.pageSize > 100)) throw new InvalidParams('office_query: pageSize must be 1–100');
  if (a.search !== undefined && (typeof a.search !== 'string' || a.search.length > 200)) throw new InvalidParams('office_query: search must be up to 200 characters');
  if (a.scope !== undefined) {
    if (!a.scope || typeof a.scope !== 'object' || Array.isArray(a.scope)) throw new InvalidParams('office_query: invalid scope');
    assertNoKeys(a.scope, ['kind','id'], 'office_query scope');
    if (!QUERY_SCOPE_KINDS.includes(a.scope.kind) || !summaryId(a.scope.id) || a.scope.id.length > 150) throw new InvalidParams('office_query: scope needs a supported kind and identifier');
  }
  if (Object.hasOwn(NESTED_SCOPE_KINDS, a.collection) && !NESTED_SCOPE_KINDS[a.collection].includes(a.scope?.kind)) throw new InvalidParams('office_query: this nested collection requires an explicit supported scope');
  let cursor;
  if (a.cursor !== undefined) {
    if (typeof a.cursor !== 'string' || a.cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(a.cursor)) throw new InvalidParams('office_query: invalid cursor');
    try { cursor = JSON.parse(Buffer.from(a.cursor, 'base64url').toString('utf8')); } catch { throw new InvalidParams('office_query: invalid cursor'); }
    if (!cursor || cursor.v !== 1 || typeof cursor.query !== 'string' || typeof cursor.revision !== 'string' || !Number.isSafeInteger(cursor.offset) || cursor.offset < 0) throw new InvalidParams('office_query: invalid cursor');
  }
  return { collection:a.collection, scope:a.scope || null, search:(a.search || '').trim().toLowerCase(), pageSize:a.pageSize || 25, cursor };
}

function queryOffice(snapshot, query) {
  const matches = scopeMatcher(snapshot, query.scope);
  const context = officeMetadataContext(snapshot);
  const source = Object.hasOwn(NESTED_COLLECTIONS, query.collection) ? nestedOfficeRows(snapshot, query.collection, matches, context)
    : { rows: collectionRows(snapshot, query.collection), omittedRows: 0, sourceTruncated: false };
  const rows = source.rows.filter(row => row && typeof row === 'object' && matches(row, query.collection))
    .map(row => metadataSummary(row, query.collection, context)).filter(row => !query.search || JSON.stringify(row).toLowerCase().includes(query.search));
  const order = row => [row.id || '', row.goalId || '', row.blueprintId || ''].join('\0');
  rows.sort((a, b) => order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0);
  const identity = hash(JSON.stringify([query.collection, query.scope?.kind || null, query.scope?.id || null, query.search]));
  const revision = hash(JSON.stringify([rows, source.omittedRows, source.sourceTruncated]));
  if (query.cursor && (query.cursor.query !== identity || query.cursor.revision !== revision)) throw new ToolError('Office query changed. Restart this read without a cursor; no mutation was requested.', 'query_changed');
  const offset = query.cursor?.offset || 0;
  if (offset > rows.length) throw new InvalidParams('office_query: cursor is outside this result');
  const items = []; let size = 0;
  for (let i = offset; i < rows.length && items.length < query.pageSize; i++) {
    const bytes = Buffer.byteLength(JSON.stringify(rows[i]));
    if (bytes > OFFICE_QUERY_PAGE_BYTES) throw new ToolError('A metadata record exceeds the bounded page size. Inspect it locally; no mutation was requested.', 'metadata_record_too_large');
    if (size + bytes > OFFICE_QUERY_PAGE_BYTES) break;
    items.push(rows[i]); size += bytes;
  }
  const next = offset + items.length;
  const nextCursor = next < rows.length ? Buffer.from(JSON.stringify({ v:1, query:identity, revision, offset:next })).toString('base64url') : null;
  return { ok:true, metadataOnly:true, collection:query.collection, scope:query.scope, search:query.search, total:rows.length,
    pageSize:query.pageSize, returned:items.length, items, nextCursor, revision,
    omittedRows: source.omittedRows, sourceTruncated: source.sourceTruncated,
    omitted:'Prompts, chat messages, evidence text, local paths, worker leases and credentials are not included. Reference omissions are explicit; do not replace a record from incomplete metadata.' };
}

function compactOfficeResult(structured, context, fullResultBytes) {
  if (!['office_snapshot','office_command','github_import_account'].includes(context?.name) || !structured?.snapshot || Array.isArray(structured.snapshot)) return null;
  const snapshot = structured.snapshot;
  const summary = { counts:officeCollectionCounts(snapshot) };
  const activeCompanyId = summaryId(snapshot.activeCompanyId); if (activeCompanyId) summary.activeCompanyId = activeCompanyId;
  if (Number.isSafeInteger(snapshot.schemaVersion)) summary.schemaVersion = snapshot.schemaVersion;
  summary.lastAction = metadataSummary(snapshot.lastAction);
  if (snapshot.budget) {
    summary.budget = {};
    for (const key of ['observedUsd','estimatedUsd','reservedUsd','committedUsd','remainingUsd','committedTokens','remainingTokens']) if (Number.isFinite(snapshot.budget[key])) summary.budget[key] = snapshot.budget[key];
    for (const key of ['warning','atCap']) if (typeof snapshot.budget[key] === 'boolean') summary.budget[key] = snapshot.budget[key];
  }
  const mutation = context.name !== 'office_snapshot';
  return { ok:true, operationSucceeded:true, mutationApplied:mutation, snapshotOmitted:true, fullResultBytes, tool:context.name,
    ...(context.name === 'office_command' && OFFICE_ACTIONS.includes(context.args?.action) ? { action:context.args.action } : {}),
    ...(Number.isSafeInteger(structured.imported) ? { imported:structured.imported } : {}), summary,
    next:{ tool:'office_query', arguments:{ collection:'index', pageSize:25 } },
    guidance:mutation ? 'The native state operation succeeded. Do not replay it to retrieve its output; use office_query. This is a metadata receipt, not a complete snapshot or evidence of provider/code execution.' : 'The read succeeded. Use office_query for bounded metadata pages; a complete snapshot is omitted from this wire result.' };
}

/**
 * Returns async handler(name, args) -> structured result object (throws InvalidParams for
 * bad input, ToolError for application failures).
 */
export function createToolHandler({ nativeCall, fetchImpl = globalThis.fetch } = {}) {
  if (typeof nativeCall !== 'function') throw new TypeError('nativeCall is required');

  const snapshot = async () => unwrapNative(await nativeCall('snapshot', {}));

  const handlers = {
    async office_snapshot(args) {
      assertNoKeys(assertPlainObject(args,'office_snapshot'),[],'office_snapshot');
      return {snapshot:unwrapNative(await nativeCall('office_snapshot',{}))};
    },
    async office_query(args) {
      const query = validateOfficeQuery(args);
      return queryOffice(unwrapNative(await nativeCall('office_snapshot', {})), query);
    },
    async office_command(args) {
      const a=assertPlainObject(args,'office_command');
      assertNoKeys(a,['action','payload'],'office_command');
      if (!OFFICE_ACTIONS.includes(a.action)) throw new InvalidParams('Unknown office action');
      const payload=assertPlainObject(a.payload,'payload');
      if(Buffer.byteLength(JSON.stringify(payload))>65536) throw new InvalidParams('Office command payload exceeds 64 KiB');
      const inspect=(v,depth=0)=>{if(depth>16)throw new InvalidParams('Payload nesting too deep');if(v&&typeof v==='object')for(const [key,value] of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(key))throw new InvalidParams('Reserved object key');inspect(value,depth+1);}};inspect(payload);
      if (Object.prototype.hasOwnProperty.call(payload,'action')) throw new InvalidParams('payload cannot override action');
      return {snapshot:unwrapNative(await nativeCall('office_command',{...payload,action:a.action}))};
    },
    async github_import_account(args) {
      const a=assertPlainObject(args,'github_import_account');
      assertNoKeys(a,['owner'],'github_import_account');
      if(typeof a.owner!=='string'||!OWNER_RE.test(a.owner)) throw new InvalidParams('owner must be a GitHub account name');
      const repositories=[]; const seen=new Set(); let complete=false;
      for(let page=1;page<=21;page++) {
        const data=await githubGet(fetchImpl,`${GITHUB_API}/users/${a.owner}/repos?type=owner&sort=full_name&per_page=100&page=${page}`);
        if(!Array.isArray(data)||data.length>100) throw new ToolError('GitHub catalog invalid','github_bad_shape');
        if(page===21 && data.length>0) throw new ToolError('Account exceeds the 2000-repository discovery limit; no partial import performed','catalog_limit');
        for(const item of data) {
          if(!item||item.private!==false||typeof item.name!=='string'||typeof item.owner?.login!=='string'||item.owner.login.toLowerCase()!==a.owner.toLowerCase()) throw new ToolError('Repository identity mismatch','github_bad_shape');
          const parsed=parseRepository(`${item.owner.login}/${item.name}`);
          if(item.html_url!==parsed.repoUrl) throw new ToolError('Repository URL mismatch','github_bad_shape');
          if(!seen.has(parsed.repoUrl.toLowerCase())) { repositories.push({name:item.name,repoUrl:parsed.repoUrl,source:'github-public-api',importedAt:new Date().toISOString()}); seen.add(parsed.repoUrl.toLowerCase()); }
        }
        if(data.length<100) {complete=true;break;}
      }
      if(!complete) throw new ToolError('Account exceeds the 2000-repository discovery limit; no partial import performed','catalog_limit');
      let snap=unwrapNative(await nativeCall('office_snapshot',{}));
      let imported=0;
      for(let offset=0;offset<repositories.length;offset+=200) {
        try {snap=unwrapNative(await nativeCall('office_command',{action:'import_repositories',repositories:repositories.slice(offset,offset+200)})); imported+=Math.min(200,repositories.length-offset);} catch(error) {throw new ToolError(`Imported ${imported} of ${repositories.length} repositories before local state rejected a batch: ${error.message}`,'partial_import');}
      }
      return {imported,snapshot:snap};
    },
    async company_snapshot(args) {
      assertNoKeys(assertPlainObject(args, 'company_snapshot'), [], 'company_snapshot');
      return { snapshot: await snapshot() };
    },

    async team_list(args) {
      assertNoKeys(assertPlainObject(args, 'team_list'), [], 'team_list');
      const snap = await snapshot();
      return { employees: snap.employees ?? [] };
    },

    async roadmap_list(args) {
      assertNoKeys(assertPlainObject(args, 'roadmap_list'), [], 'roadmap_list');
      const snap = await snapshot();
      return { tasks: snap.tasks ?? [], milestones: snap.milestones ?? [] };
    },

    async repository_index(args) {
      assertNoKeys(assertPlainObject(args, 'repository_index'), [], 'repository_index');
      const snap = unwrapNative(await nativeCall('index_repository', {}));
      return { index: snap.index ?? null, snapshot: snap };
    },

    async roadmap_update(args) {
      const a = assertPlainObject(args, 'roadmap_update');
      assertNoKeys(a, ['id', 'status', 'evidence'], 'roadmap_update');
      if (typeof a.id !== 'string' || a.id.length === 0 || a.id.length > 100) throw new InvalidParams('roadmap_update: id must be a string of 1-100 characters');
      if (typeof a.status !== 'string' || !TASK_STATUSES.includes(a.status)) {
        throw new InvalidParams(`roadmap_update: status must be one of ${TASK_STATUSES.join(', ')}`);
      }
      if (a.evidence !== undefined && (typeof a.evidence !== 'string' || a.evidence.length > 2000)) {
        throw new InvalidParams('roadmap_update: evidence must be a string of at most 2000 characters');
      }
      const evidence = a.evidence === undefined ? undefined : a.evidence.trim();
      if (a.status === 'done' && !evidence) throw new InvalidParams('roadmap_update: status "done" requires non-empty evidence');
      const payload = { id: a.id, status: a.status };
      if (evidence !== undefined) payload.evidence = evidence;
      const snap = unwrapNative(await nativeCall('update_task', payload));
      const task = (snap.tasks ?? []).find((t) => t && t.id === a.id) ?? null;
      return { task, snapshot: snap };
    },

    async company_register(args) {
      const a = assertPlainObject(args, 'company_register');
      assertNoKeys(a, ['repository'], 'company_register');
      if (a.repository === undefined) throw new InvalidParams('company_register: repository is required');
      const parsed = parseRepository(a.repository);
      if (typeof fetchImpl !== 'function') throw new ToolError('fetch is unavailable', 'github_network');

      let meta;
      let sha;
      let checkedAt;
      try {
        const repoBody = await githubGet(fetchImpl, `${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}`);
        meta = validateRepoMetadata(repoBody, parsed);
        const commitBody = await githubGet(
          fetchImpl,
          `${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${encodeURIComponent(meta.defaultBranch)}`
        );
        sha = validateCommit(commitBody);
        checkedAt = new Date().toISOString();
      } catch (err) {
        if (err instanceof ToolError) {
          await recordFailure(parsed, err);
        }
        throw err;
      }

      const payload = {
        repoUrl: parsed.repoUrl,
        owner: parsed.owner,
        repo: parsed.repo,
        defaultBranch: meta.defaultBranch,
        description: meta.description,
        stars: meta.stars,
        openIssues: meta.openIssues,
        pushedAt: meta.pushedAt,
        headSha: sha,
        checkedAt
      };
      const snap = unwrapNative(await nativeCall('register_company', payload));
      return { registered: true, company: snap.company ?? null, snapshot: snap };
    }
  };

  // Best effort: only annotate the currently registered company when it is the same repository.
  async function recordFailure(parsed, err) {
    try {
      const current = unwrapNative(await nativeCall('snapshot', {}));
      const c = current.company;
      if (!c || c.owner !== parsed.owner || c.repo !== parsed.repo) return;
      await nativeCall('record_github_check', {
        repoUrl: parsed.repoUrl,
        owner: parsed.owner,
        repo: parsed.repo,
        ok: false,
        error: String(err.message).slice(0, 500),
        checkedAt: new Date().toISOString()
      });
    } catch {
      // Recording a failed check is best effort and must never mask the original error.
    }
  }

  return async function handleTool(name, args) {
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(handlers, name)) {
      throw new InvalidParams(`Unknown tool: ${String(name).slice(0, 100)}`);
    }
    return handlers[name](args);
  };
}

// ---------------------------------------------------------------------------
// JSON-RPC / MCP protocol
// ---------------------------------------------------------------------------

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function isValidId(id) {
  return (typeof id === 'string' && id.length <= 256) || (typeof id === 'number' && Number.isFinite(id));
}

function toolResult(structured, isError = false, context = null) {
  let text = JSON.stringify(structured);
  const wrapped = () => ({ content: [{ type: 'text', text }], structuredContent: structured, isError });
  const fullResultBytes = Buffer.byteLength(text);
  // Both MCP representations count toward the wire ceiling. Never turn an
  // already-successful office mutation into a false failure just to fit them.
  if (fullResultBytes > TOOL_OUTPUT_LIMIT || Buffer.byteLength(JSON.stringify(wrapped())) > TOOL_OUTPUT_LIMIT) {
    const receipt = !isError && compactOfficeResult(structured, context, fullResultBytes);
    if (receipt) structured = receipt;
    else {
      isError = true;
      structured = { error: 'tool output exceeded size limit', code: 'output_too_large' };
    }
    text = JSON.stringify(structured);
  }
  return wrapped();
}

/**
 * Creates a processor: async (line) -> response object | null. Never throws.
 */
export function createMessageProcessor({ handleTool }) {
  return async function processLine(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return rpcError(null, -32700, 'Parse error');
    }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      const id = msg && typeof msg === 'object' && isValidId(msg.id) ? msg.id : null;
      return rpcError(id, -32600, 'Invalid Request');
    }
    const hasId = Object.prototype.hasOwnProperty.call(msg, 'id');
    if (hasId && !isValidId(msg.id)) return rpcError(null, -32600, 'Invalid Request');
    const isNotification = !hasId;
    const id = msg.id;

    try {
      switch (msg.method) {
        case 'notifications/initialized':
        case 'notifications/cancelled':
          return null;
        case 'initialize': {
          if (isNotification) return null;
          const p = msg.params;
          if (!p || typeof p !== 'object' || Array.isArray(p) || typeof p.protocolVersion !== 'string') {
            return rpcError(id, -32602, 'initialize requires params.protocolVersion');
          }
          const version = SUPPORTED_PROTOCOL_VERSIONS.includes(p.protocolVersion) ? p.protocolVersion : LATEST_PROTOCOL_VERSION;
          return {
            jsonrpc: '2.0',
            id,
            result: { protocolVersion: version, capabilities: { tools: {} }, serverInfo: { ...SERVER_INFO } }
          };
        }
        case 'ping':
          return isNotification ? null : { jsonrpc: '2.0', id, result: {} };
        case 'tools/list':
          return isNotification ? null : { jsonrpc: '2.0', id, result: { tools: TOOL_DEFINITIONS } };
        case 'tools/call': {
          if (isNotification) return null;
          const p = msg.params;
          if (!p || typeof p !== 'object' || Array.isArray(p) || typeof p.name !== 'string') {
            return rpcError(id, -32602, 'tools/call requires params.name');
          }
          if (p.arguments !== undefined && (p.arguments === null || typeof p.arguments !== 'object' || Array.isArray(p.arguments))) {
            return rpcError(id, -32602, 'params.arguments must be an object');
          }
          try {
            const out = await handleTool(p.name, p.arguments ?? {});
            return { jsonrpc: '2.0', id, result: toolResult(out, false, { name:p.name, args:p.arguments }) };
          } catch (err) {
            if (err instanceof InvalidParams) return rpcError(id, -32602, err.message);
            const message = err instanceof ToolError ? err.message : 'internal tool failure';
            const code = err instanceof ToolError ? err.code : 'internal_error';
            return { jsonrpc: '2.0', id, result: toolResult({ error: message, code }, true) };
          }
        }
        default:
          return isNotification ? null : rpcError(id, -32601, `Method not found: ${msg.method.slice(0, 100)}`);
      }
    } catch {
      return isNotification ? null : rpcError(id, -32603, 'Internal error');
    }
  };
}

// ---------------------------------------------------------------------------
// stdio server
// ---------------------------------------------------------------------------

export function startServer({ stdin = process.stdin, stdout = process.stdout, handleTool } = {}) {
  const processLine = createMessageProcessor({ handleTool });
  let buffer = '';
  let discarding = false;
  let chain = Promise.resolve();
  let pending = 0;

  const write = (obj) => {
    stdout.write(`${JSON.stringify(obj)}\n`);
  };

  const enqueue = (line) => {
    if (pending >= 64) { write(rpcError(null, -32000, 'Server queue full')); return; }
    pending += 1;
    chain = chain.then(async () => {
      try {
        const response = await processLine(line);
        if (response) write(response);
      } catch {
        // processLine never throws; swallow defensively to avoid unhandled rejections.
      } finally { pending -= 1; }
    });
  };

  stdin.setEncoding('utf8');
  stdin.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      const idx = buffer.indexOf('\n');
      if (idx === -1) break;
      const line = buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
      if (discarding) {
        discarding = false;
        continue;
      }
      if (line.trim().length === 0) continue;
      if (Buffer.byteLength(line) > REQUEST_LIMIT) {
        chain = chain.then(() => write(rpcError(null, -32600, 'Request too large')));
        continue;
      }
      enqueue(line);
    }
    if (Buffer.byteLength(buffer) > REQUEST_LIMIT) {
      buffer = '';
      discarding = true;
      chain = chain.then(() => write(rpcError(null, -32600, 'Request too large')));
    }
  });
  stdin.on('end', () => {
    const rest = buffer.trim();
    buffer = '';
    if (rest && !discarding && Buffer.byteLength(rest) <= REQUEST_LIMIT) enqueue(rest);
  });
  return { drain: () => chain };
}

export function main() {
  const config = resolveLaunchConfig();
  const nativeCall = createNativeCall(config);
  const handleTool = createToolHandler({ nativeCall, fetchImpl: globalThis.fetch });
  startServer({ handleTool });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
