#!/usr/bin/env node
// Engineering Intelligence Atlas - local stdio MCP server (Node >= 22, built-ins only).
// Local state is owned by the native Rust core; the only external call is a
// read-only, unauthenticated fetch of public GitHub repo metadata during company_register.

import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_INFO = Object.freeze({ name: 'atlas-company', version: '0.4.0' });
export const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze(['2025-11-25', '2025-06-18']);
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export const NATIVE_TIMEOUT_MS = 25_000;
export const NATIVE_OUTPUT_LIMIT = 2 * 1024 * 1024;
export const REQUEST_LIMIT = 1024 * 1024;
export const GITHUB_BODY_LIMIT = 1024 * 1024;
export const GITHUB_TIMEOUT_MS = 12_000;
export const TOOL_OUTPUT_LIMIT = 1024 * 1024;

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'engineering-intelligence-atlas-mcp/0.3.0';
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
  const binary = resolve(env.ATLAS_CORE_BINARY || join(repoRoot, 'native-core', 'target', 'release', 'atlas-core'));
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
          finish(rejectPromise, new ToolError('native core output exceeded limit', 'native_output_too_large'));
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

export const OFFICE_ACTIONS = Object.freeze(['create_company','select_company','create_office','create_department','hire_employee','pause_employee','resume_employee','fire_employee','pause_company','resume_company','pause_office','resume_office','pause_department','resume_department','enqueue_job','claim_job','reserve_job','finish_job','heartbeat_job','cancel_job','pause_job','resume_job','create_schedule','pause_schedule','resume_schedule','tick_schedules','configure_cache','clear_cache','get_cache','put_cache','add_knowledge','configure_policy','reserve_external','settle_external','approve_job','bootstrap_directors','post_chat','post_assistant_message','create_goal','plan_goal','set_goal_plan','execute_goal','advance_goal','tick_goals','pause_goal','resume_goal','checkpoint_goal','ensure_blueprint','save_blueprint','upsert_room','place_employee','upsert_whiteboard','configure_ceo','upsert_portfolio_group','ensure_shared_services','optimize_portfolio','contract_service','share_knowledge','upsert_roadmap_item']);

export const TOOL_DEFINITIONS = Object.freeze([
  { name:'office_snapshot', title:'Office control snapshot', description:'Read persistent companies, offices, departments, Donna and employees, jobs, schedules, cache and event ledger. Local state only.', inputSchema:EMPTY_SCHEMA, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false} },
  { name:'office_command', title:'Office control operation', description:'Apply an explicit local office state command. This tool cannot execute code or issue provider calls; provider jobs require a separately enabled worker and budget authorization.', inputSchema:{type:'object',properties:{action:{type:'string',enum:[...OFFICE_ACTIONS]},payload:{type:'object'}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:false} },
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

function toolResult(structured, isError = false) {
  let text = JSON.stringify(structured);
  if (Buffer.byteLength(text) > TOOL_OUTPUT_LIMIT) {
    isError = true;
    structured = { error: 'tool output exceeded size limit', code: 'output_too_large' };
    text = JSON.stringify(structured);
  }
  return { content: [{ type: 'text', text }], structuredContent: structured, isError };
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
            return { jsonrpc: '2.0', id, result: toolResult(out) };
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
