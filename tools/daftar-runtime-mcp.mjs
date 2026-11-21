#!/usr/bin/env node
/**
 * Daftar's owner-only stdio bridge to the headless runtime (Node >= 22).
 * Configure DAFTAR_RUNTIME_URL and DAFTAR_CONTROL_TOKEN_FILE in the launcher.
 * This is not a public HTTP/OAuth MCP endpoint. A local MCP client or Secure
 * MCP Tunnel can launch this process. It never reads native state or leases.
 */
import fs from 'node:fs';
import { once } from 'node:events';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createToolHandler as createOfficeMetadataHandler,
  InvalidParams,
  ToolError,
  OFFICE_COLLECTIONS,
  TOOL_DEFINITIONS as LOCAL_TOOL_DEFINITIONS,
} from './atlas-mcp.mjs';
import { OWNER_ACTIONS, TOKEN_PATTERN, validateCommandEnvelope } from '../headless-runtime/contract.mjs';

export const SERVER_INFO = Object.freeze({ name: 'daftar-runtime', version: '0.1.0' });
export const PROTOCOL_VERSIONS = Object.freeze(['2025-11-25', '2025-06-18']);
export const REQUEST_LIMIT = 272 * 1024;
export const RESPONSE_LIMIT = 9 * 1024 * 1024;
export const TOOL_OUTPUT_LIMIT = 512 * 1024;
export const REQUEST_TIMEOUT_MS = 30_000;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,160}$/;
const EMPTY_SCHEMA = { type: 'object', properties: {}, additionalProperties: false };
const READ_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const OFFICE_QUERY_SCHEMA = LOCAL_TOOL_DEFINITIONS.find(tool => tool.name === 'office_query').inputSchema;
const ROUTES = new Set(['GET /v1/status', 'GET /v1/office', 'POST /v1/commands', 'POST /v1/workers', 'POST /v1/models/pull', 'POST /v1/models/cancel', 'POST /v1/models/select']);
const MODEL_SCOPE_SCHEMA = { companyId: { type: 'string', pattern: ID_PATTERN.source }, employeeId: { type: 'string', pattern: ID_PATTERN.source } };
const MODEL_REF_SCHEMA = { type: 'string', enum: ['llama3.2:1b', 'qwen3:4b', 'qwen3:8b'] };

export const TOOL_DEFINITIONS = Object.freeze([
  {
    name: 'runtime_status', title: 'Read Daftar runtime status',
    description: 'Use this to inspect the connected headless runtime and worker state. Read only; does not start jobs. Worker errors are represented as a flag; inspect private server logs for details.',
    inputSchema: EMPTY_SCHEMA, annotations: READ_ANNOTATIONS,
  },
  {
    name: 'office_summary', title: 'Read Daftar office summary',
    description: 'Read office collection counts, budget totals, and the current stateHash needed for an owner command. Full records, prompts, chat bodies, credentials, and local paths are omitted. Use office_query for bounded metadata pages.',
    inputSchema: EMPTY_SCHEMA, annotations: READ_ANNOTATIONS,
  },
  {
    name: 'office_query', title: 'Query Daftar office metadata',
    description: 'Read one bounded metadata page from the connected runtime, optionally filtered by scope or search. Returns stateHash from the same read. Scope is a read filter, not an authorization grant. Reuse nextCursor with unchanged filters; query_changed means restart the read.',
    inputSchema: OFFICE_QUERY_SCHEMA, annotations: READ_ANNOTATIONS,
  },
  {
    name: 'office_command', title: 'Apply a Daftar owner command',
    description: 'Apply one explicitly requested owner action using a unique id and expectedStateHash from a recent office read. Enqueue, approve, execute, or resume actions may start paid work when workers are enabled. The runtime enforces authority, budgets, and atomic command receipts. A successful result is a compact receipt. Never create a new id to repeat an uncertain mutation; inspect state first. Worker lease/accounting operations are unavailable.',
    inputSchema: {
      type: 'object', properties: {
        id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,100}$', description: 'Unique stable command receipt ID; retain it if delivery is uncertain.' },
        expectedStateHash: { type: 'string', pattern: '^[a-f0-9]{64}$', description: 'State hash from the office read used to prepare this command.' },
        command: { type: 'object', properties: { action: { type: 'string', enum: [...OWNER_ACTIONS] } }, required: ['action'], additionalProperties: true },
      }, required: ['id', 'expectedStateHash', 'command'], additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'worker_set_enabled', title: 'Enable or disable Daftar workers',
    description: 'Set the runtime worker pool enabled state. Enabling can immediately dispatch already-authorized jobs and incur model-provider charges within their budgets. Disabling stops dispatch and requests cancellation of active work; already-dispatched usage may still be charged. No automatic retry is performed. Inspect runtime_status after an uncertain response.',
    inputSchema: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'], additionalProperties: false },
    // Re-enabling can trigger work, so advertise conservatively despite a Boolean setting.
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'model_pool_status', title: 'Read shared local model status',
    description: 'Read the reviewed model catalog, installed/loaded models, and this company’s model requests and employee assignments. Owner access only; employee IDs select a scope, not an independent login. Shared model bytes do not share company prompts or artifacts. Infrastructure costs are separate from model token charges.',
    inputSchema: { type: 'object', properties: MODEL_SCOPE_SCHEMA, required: ['companyId'], additionalProperties: false }, annotations: READ_ANNOTATIONS,
  },
  {
    name: 'model_pool_request', title: 'Request a shared local model download',
    description: 'Request an explicitly approved catalog model for an employee in an active company or shared-service contract. Downloads can consume substantial disk space and network transfer; this does not rent hardware. Requests deduplicate against shared local model bytes. Keep the same idempotencyKey after an uncertain result; inspect status before a new request. Requires a managed loopback daemon with Ollama cloud disabled.',
    inputSchema: { type: 'object', properties: { ...MODEL_SCOPE_SCHEMA, model: MODEL_REF_SCHEMA,
      idempotencyKey: { type: 'string', pattern: ID_PATTERN.source }, maxBytes: { type: 'integer', minimum: 1, maximum: 10737418240 } },
      required: ['companyId', 'employeeId', 'model', 'idempotencyKey'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'model_pool_cancel', title: 'Cancel an employee model request',
    description: 'Cancel this scoped request. Other employees can keep a shared download running. Cancelling the last requester aborts Daftar’s pull stream; partial daemon cache files may remain. Never deletes an installed model.',
    inputSchema: { type: 'object', properties: { ...MODEL_SCOPE_SCHEMA, requestId: { type: 'string', pattern: ID_PATTERN.source } }, required: ['companyId', 'employeeId', 'requestId'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'model_pool_select', title: 'Assign an installed local model',
    description: 'Select a verified installed catalog model and pin its digest for an employee’s company scope. A future self-hosted job must explicitly request this exact model; existing jobs and paid routes are not rewritten. Does not start workers or create a job.',
    inputSchema: { type: 'object', properties: { ...MODEL_SCOPE_SCHEMA, model: MODEL_REF_SCHEMA }, required: ['companyId', 'employeeId', 'model'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
]);

export function normalizeRuntimeOrigin(raw = 'http://127.0.0.1:8788') {
  const error = () => new ToolError('DAFTAR_RUNTIME_URL must be a canonical HTTPS origin, or a loopback HTTP origin, without credentials, paths, queries, or fragments.', 'invalid_runtime_origin');
  if (typeof raw !== 'string' || raw.length > 2048 || !/^https?:\/\/[^/?#\\\s]+\/?$/.test(raw)) throw error();
  let url;
  try { url = new URL(raw); } catch { throw error(); }
  const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) ||
      raw.replace(/\/$/, '') !== url.origin) throw error();
  return url.origin;
}

/** Bounded regular-file read; never accept a secret as a command-line argument. */
export function readControlToken(file) {
  const failure = () => new ToolError('DAFTAR_CONTROL_TOKEN_FILE must name an absolute private regular file containing a valid control token (0400 or 0600 on POSIX; no symlink).', 'invalid_control_token_file');
  if (typeof file !== 'string' || !isAbsolute(file) || file.length > 4096 || file.includes('\0')) throw failure();
  let fd;
  try {
    if (fs.lstatSync(file).isSymbolicLink()) throw failure();
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size < 32 || stat.size > 258 ||
        (process.platform !== 'win32' && ![0o400, 0o600].includes(stat.mode & 0o777))) throw failure();
    const buffer = Buffer.alloc(259);
    const length = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const text = buffer.subarray(0, length).toString('utf8');
    if (!/^[A-Za-z0-9_-]{32,256}(?:\r?\n)?$/.test(text)) throw failure();
    return text.trim();
  } catch { throw failure(); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}

export function loadRuntimeConfig(env = process.env) {
  return { origin: normalizeRuntimeOrigin(env.DAFTAR_RUNTIME_URL), token: readControlToken(env.DAFTAR_CONTROL_TOKEN_FILE) };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactArgs(args, keys) {
  if (!isObject(args) || Object.keys(args).some(key => !keys.includes(key))) throw new InvalidParams('Arguments must match this tool\'s schema.');
  return args;
}

function safeText(value, limit = 160) {
  return String(value).replace(/(?:sk-ant-|sk-proj-|sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{8,}|\bBearer\s+\S+/gi, '[credential omitted]')
    .replace(/\b(?:token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, '[credential omitted]')
    .replace(/(?:file:\/\/|\/home\/|\/Users\/|\/workspace\/|[A-Z]:\\)[^\s<>"']+/gi, '[local path omitted]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, limit);
}

function safeId(value) { return typeof value === 'string' && ID_PATTERN.test(value) ? safeText(value) : undefined; }

function modelArgs(args, kind) {
  const allowed = kind === 'status' ? ['companyId', 'employeeId'] : kind === 'request' ? ['companyId', 'employeeId', 'model', 'idempotencyKey', 'maxBytes'] : kind === 'cancel' ? ['companyId', 'employeeId', 'requestId'] : ['companyId', 'employeeId', 'model'];
  exactArgs(args, allowed);
  for (const key of ['companyId', ...(kind === 'status' && args.employeeId === undefined ? [] : ['employeeId']), ...(kind === 'request' ? ['idempotencyKey'] : []), ...(kind === 'cancel' ? ['requestId'] : [])]) {
    if (typeof args[key] !== 'string' || !ID_PATTERN.test(args[key])) throw new InvalidParams(`A valid ${key} is required.`);
  }
  if (['request', 'select'].includes(kind) && !MODEL_REF_SCHEMA.enum.includes(args.model)) throw new InvalidParams('Choose a reviewed local model from model_pool_status.');
  if (args.maxBytes !== undefined && (!Number.isSafeInteger(args.maxBytes) || args.maxBytes < 1 || args.maxBytes > 10737418240)) throw new InvalidParams('maxBytes must be a positive integer within the catalog ceiling.');
  return args;
}

function modelResult(result) {
  const value = result.snapshot;
  if (!isObject(value) || !safeId(value.companyId)) throw new ToolError('Runtime returned invalid model status.', 'runtime_bad_response');
  const snapshot = { companyId: safeId(value.companyId), available: value.available === true, enabled: value.enabled === true,
    endpoint: 'Self-hosted Ollama (loopback)', infrastructureCost: 'separate', catalog: [], models: [], requests: [], assignments: [],
    requestCount: Array.isArray(value.requests) ? value.requests.length : 0, assignmentCount: Array.isArray(value.assignments) ? value.assignments.length : 0,
    error: value.error ? 'The local model service needs review. Inspect private runtime configuration and logs.' : null };
  const validModel = model => typeof model === 'string' && MODEL_REF_SCHEMA.enum.includes(model);
  const bytes = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
  for (const row of (Array.isArray(value.catalog) ? value.catalog : []).slice(0, 16)) {
    if (!isObject(row) || !validModel(row.id)) continue;
    snapshot.catalog.push({ id: row.id, name: safeText(row.name, 80), description: safeText(row.description, 300), storageCeilingBytes: bytes(row.storageCeilingBytes), sourceUrl: `https://ollama.com/library/${row.id}` });
  }
  for (const row of (Array.isArray(value.models) ? value.models : []).slice(0, 32)) {
    if (isObject(row) && validModel(row.name) && HASH_PATTERN.test(row.digest ?? '')) snapshot.models.push({ name: row.name, digest: row.digest, sizeBytes: bytes(row.sizeBytes), loaded: row.loaded === true });
  }
  for (const row of (Array.isArray(value.requests) ? value.requests : []).slice(-100)) {
    if (!isObject(row) || row.companyId !== value.companyId || !safeId(row.id) || !safeId(row.employeeId) || !validModel(row.model)
        || !['queued', 'pulling', 'ready', 'failed', 'cancelled', 'interrupted'].includes(row.status)) continue;
    snapshot.requests.push({ id: safeId(row.id), companyId: snapshot.companyId, employeeId: safeId(row.employeeId), model: row.model, status: row.status,
      completedBytes: bytes(row.completedBytes), totalBytes: bytes(row.totalBytes), error: row.error ? 'This request needs review. Inspect local daemon state before another request.' : null });
  }
  for (const row of (Array.isArray(value.assignments) ? value.assignments : []).slice(-100)) {
    if (isObject(row) && row.companyId === value.companyId && safeId(row.employeeId) && validModel(row.model) && HASH_PATTERN.test(row.digest ?? '')) snapshot.assignments.push({ companyId: snapshot.companyId, employeeId: safeId(row.employeeId), model: row.model, digest: row.digest });
  }
  return { ok: true, snapshot, ...(safeId(result.requestId) ? { requestId: safeId(result.requestId) } : {}), ...(typeof result.replayed === 'boolean' ? { replayed: result.replayed } : {}), ...(typeof result.reused === 'boolean' ? { reused: result.reused } : {}) };
}

function workerSummary(worker) {
  if (!isObject(worker)) throw new ToolError('Runtime returned an invalid worker status.', 'runtime_bad_response');
  const out = {};
  for (const key of ['enabled', 'running']) if (typeof worker[key] === 'boolean') out[key] = worker[key];
  if (Number.isSafeInteger(worker.concurrency) && worker.concurrency >= 0 && worker.concurrency <= 100) out.concurrency = worker.concurrency;
  out.activeJobId = safeId(worker.activeJobId) ?? null;
  if (Array.isArray(worker.activeJobIds)) out.activeJobIds = worker.activeJobIds.slice(0, 100).map(safeId).filter(Boolean);
  out.hasError = Boolean(worker.lastError || worker.error);
  return out;
}

function capabilitiesSummary(capabilities) {
  if (Array.isArray(capabilities)) return capabilities.slice(0, 32).filter(v => typeof v === 'string').map(v => safeText(v, 80));
  if (!isObject(capabilities)) return {};
  const out = Object.fromEntries(Object.entries(capabilities).slice(0, 32)
    .filter(([key, value]) => /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key) && typeof value === 'boolean'));
  for (const key of ['providerAdapters', 'configuredProviders']) {
    if (Array.isArray(capabilities[key])) out[key] = [...new Set(capabilities[key].filter(value => ['openai', 'anthropic', 'ollama-loopback'].includes(value)))];
  }
  return out;
}

function collectionRows(snapshot, name) {
  const value = ['groups', 'services', 'contracts', 'transfers', 'roadmap'].includes(name) ? snapshot.portfolio?.[name]
    : name === 'authorityGrants' ? snapshot.authority?.grants
      : name === 'authorityLedger' ? snapshot.authority?.ledger
        : name === 'index' ? snapshot.authority?.index : snapshot[name];
  return Array.isArray(value) ? value : [];
}

function officeSummary(snapshot) {
  if (!isObject(snapshot)) throw new ToolError('Runtime returned an invalid office snapshot.', 'runtime_bad_response');
  const out = { counts: Object.fromEntries(OFFICE_COLLECTIONS.map(name => [name, collectionRows(snapshot, name).length])) };
  const activeCompanyId = safeId(snapshot.activeCompanyId);
  if (activeCompanyId) out.activeCompanyId = activeCompanyId;
  if (Number.isSafeInteger(snapshot.schemaVersion)) out.schemaVersion = snapshot.schemaVersion;
  if (isObject(snapshot.budget)) {
    out.budget = {};
    for (const key of ['observedUsd', 'estimatedUsd', 'reservedUsd', 'committedUsd', 'remainingUsd', 'committedTokens', 'remainingTokens']) {
      if (Number.isFinite(snapshot.budget[key])) out.budget[key] = snapshot.budget[key];
    }
    for (const key of ['warning', 'atCap']) if (typeof snapshot.budget[key] === 'boolean') out.budget[key] = snapshot.budget[key];
  }
  return out;
}

function requireOffice(result) {
  if (!isObject(result.snapshot) || !HASH_PATTERN.test(result.stateHash ?? '')) throw new ToolError('Runtime returned an invalid office response.', 'runtime_bad_response');
  return result;
}

async function readBoundedJson(response, limit, signal) {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    void response.body?.cancel().catch(() => {});
    throw new ToolError('Runtime response exceeded the transport limit.', 'runtime_response_too_large');
  }
  if (!/\bapplication\/json\b/i.test(response.headers.get('content-type') || '')) throw new ToolError('Runtime did not return JSON.', 'runtime_bad_response');
  const reader = response.body?.getReader();
  if (!reader) throw new ToolError('Runtime returned an empty response.', 'runtime_bad_response');
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks = []; let size = 0;
  try {
    for (;;) {
      if (signal.aborted) throw new ToolError('Runtime request timed out.', 'runtime_timeout');
      const { done, value } = await reader.read();
      if (signal.aborted) throw new ToolError('Runtime request timed out.', 'runtime_timeout');
      if (done) break;
      size += value.byteLength;
      if (size > limit) { cancel(); throw new ToolError('Runtime response exceeded the transport limit.', 'runtime_response_too_large'); }
      chunks.push(Buffer.from(value));
    }
    try { return JSON.parse(Buffer.concat(chunks, size).toString('utf8')); }
    catch { throw new ToolError('Runtime returned invalid JSON.', 'runtime_bad_response'); }
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

function rejection(status, body) {
  const known = {
    CONFLICT: 'The office changed. Read its current state before preparing a new command.',
    REMOTE_RECEIPT_MISMATCH: 'This command ID already belongs to a different command. Inspect the existing result.',
    REMOTE_ACTION_DENIED: 'This operation is reserved for the managed runtime worker.',
    INVALID_REQUEST: 'The runtime rejected the command envelope.',
    INVALID_INPUT: 'The runtime rejected one or more command fields.',
    CAPACITY: 'The runtime reached a capacity bound. Inspect its state before submitting more work.',
  };
  if (status === 401 || status === 403) return new ToolError('Runtime access was denied. Verify the private control-token file and runtime owner access.', 'runtime_access_denied');
  if (status >= 300 && status < 400) return new ToolError('Runtime redirects are not allowed.', 'runtime_redirect_rejected');
  const code = isObject(body) && Object.hasOwn(known, body.code) ? body.code : null;
  if (code) return new ToolError(known[code], code);
  if (status === 409) return new ToolError(known.CONFLICT, 'CONFLICT');
  if (status === 429) return new ToolError('The runtime is busy. Inspect status before attempting another operation.', 'runtime_busy');
  return new ToolError('The runtime rejected the operation. Inspect private server logs and office state for details.', 'runtime_rejected');
}

/** Only fixed routes; credentials never appear in returned objects or errors. */
export function createRuntimeClient(config, { fetchImpl = globalThis.fetch, timeoutMs = REQUEST_TIMEOUT_MS, responseLimit = RESPONSE_LIMIT } = {}) {
  const origin = normalizeRuntimeOrigin(config?.origin);
  const token = config?.token;
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) throw new ToolError('Invalid control token configuration.', 'invalid_control_token_file');
  if (typeof fetchImpl !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > REQUEST_TIMEOUT_MS ||
      !Number.isSafeInteger(responseLimit) || responseLimit < 1 || responseLimit > RESPONSE_LIMIT) throw new TypeError('Invalid runtime client options');
  return async function request(method, route, body) {
    let modelRead = false;
    if (method === 'GET' && route.startsWith('/v1/models?')) {
      const query = new URL(route, origin).searchParams;
      modelRead = !route.includes('#') && query.getAll('companyId').length === 1 && query.getAll('employeeId').length <= 1 && [...query.entries()].every(([key, value]) => ['companyId', 'employeeId'].includes(key) && ID_PATTERN.test(value));
    }
    if (!ROUTES.has(`${method} ${route}`) && !modelRead) throw new InvalidParams('Runtime route is not exposed by this adapter.');
    const target = new URL(route, origin);
    if (target.origin !== origin) throw new InvalidParams('Runtime origin mismatch.');
    const serialized = body === undefined ? undefined : JSON.stringify(body);
    if (serialized && Buffer.byteLength(serialized) > REQUEST_LIMIT) throw new InvalidParams('Runtime request exceeded its size limit.');
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new ToolError('Runtime request timed out.', 'runtime_timeout')); }, timeoutMs);
    });
    const operation = async () => {
      const response = await fetchImpl(target.href, {
        method, redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(serialized ? { 'Content-Type': 'application/json' } : {}) },
        ...(serialized ? { body: serialized } : {}),
      });
      if (response.redirected || (response.url && new URL(response.url).origin !== origin)) throw new ToolError('Runtime redirects are not allowed.', 'runtime_redirect_rejected');
      if (!response.ok) {
        let errorBody;
        if (![401, 403].includes(response.status) && response.status >= 400) {
          try { errorBody = await readBoundedJson(response, Math.min(responseLimit, 64 * 1024), controller.signal); } catch { /* Never forward arbitrary server error text. */ }
        } else { void response.body?.cancel().catch(() => {}); }
        throw rejection(response.status, errorBody);
      }
      const result = await readBoundedJson(response, responseLimit, controller.signal);
      if (!isObject(result) || typeof result.ok !== 'boolean') throw new ToolError('Runtime returned an invalid response.', 'runtime_bad_response');
      if (!result.ok) throw rejection(response.status, result);
      // Redact the exact runtime token if an unexpected upstream text field repeats it.
      return JSON.parse(JSON.stringify(result).split(token).join('[control credential omitted]'));
    };
    try { return await Promise.race([operation(), timeout]); }
    catch (error) {
      controller.abort();
      const failure = error instanceof ToolError ? error : new ToolError('The runtime could not be reached at its configured origin.', 'runtime_unreachable');
      if (method === 'POST') throw new ToolError(`${failure.message} No retry was sent. The operation may already have been applied; inspect office_summary or runtime_status. Retain the original command id.`, failure.code);
      throw failure;
    } finally { clearTimeout(timer); }
  };
}

export function createToolHandler({ request }) {
  if (typeof request !== 'function') throw new TypeError('request is required');
  return async (name, args = {}) => {
    switch (name) {
      case 'runtime_status': {
        exactArgs(args, []);
        const result = await request('GET', '/v1/status');
        if (result.execution !== 'headless') throw new ToolError('Connected service is not a headless Daftar runtime.', 'runtime_bad_response');
        const cloud = result.cloud;
        return { ok: true, execution: 'headless', worker: workerSummary(result.worker), capabilities: capabilitiesSummary(result.capabilities),
          cloud: { configured: cloud?.configured === true, connected: cloud?.connected === true,
            revision: Number.isSafeInteger(cloud?.revision) && cloud.revision >= 0 ? cloud.revision : null,
            error: cloud?.error ? 'Cloud synchronization needs review. Inspect the private runtime configuration.' : null } };
      }
      case 'office_summary': {
        exactArgs(args, []);
        const result = requireOffice(await request('GET', '/v1/office'));
        return { ok: true, metadataOnly: true, stateHash: result.stateHash, summary: officeSummary(result.snapshot) };
      }
      case 'office_query': {
        let stateHash;
        // Reuse only the existing metadata validator/query. The callback refuses
        // every native operation except its one read; no native process is started.
        const read = createOfficeMetadataHandler({ nativeCall: async (command) => {
          if (command !== 'office_snapshot') throw new InvalidParams('Only office metadata reads are available.');
          const result = requireOffice(await request('GET', '/v1/office'));
          stateHash = result.stateHash;
          return { ok: true, snapshot: result.snapshot };
        }, fetchImpl: async () => { throw new InvalidParams('External discovery is unavailable.'); } });
        const result = await read('office_query', args);
        return { ...result, stateHash };
      }
      case 'office_command': {
        let envelope;
        try { envelope = validateCommandEnvelope(args); }
        catch { throw new InvalidParams('Provide a valid owner command, unique id, and current expectedStateHash. Worker-internal actions, reserved keys, and oversized payloads are not allowed.'); }
        const result = await request('POST', '/v1/commands', envelope);
        // A saved command must stay successful even when its snapshot projection
        // cannot be returned. Never reread or replay a mutation to fill the receipt.
        const receipt = { ok: true, operationSucceeded: true, id: envelope.id, replayed: result.replayed === true, snapshotOmitted: true,
          guidance: 'The runtime accepted this command. Do not repeat it with a new id. Read office_summary or office_query for current state.' };
        if (HASH_PATTERN.test(result.stateHash ?? '')) receipt.stateHash = result.stateHash;
        if (isObject(result.snapshot)) receipt.summary = officeSummary(result.snapshot);
        return receipt;
      }
      case 'worker_set_enabled': {
        exactArgs(args, ['enabled']);
        if (typeof args.enabled !== 'boolean') throw new InvalidParams('enabled must be a Boolean.');
        const result = await request('POST', '/v1/workers', { enabled: args.enabled });
        return { ok: true, worker: workerSummary(result.worker), guidance: 'Inspect runtime_status to follow dispatch. Already-dispatched usage can remain billable after disabling workers.' };
      }
      case 'model_pool_status': {
        const input = modelArgs(args, 'status');
        const result = await request('GET', `/v1/models?${new URLSearchParams(input)}`);
        return modelResult(result);
      }
      case 'model_pool_request': return modelResult(await request('POST', '/v1/models/pull', modelArgs(args, 'request')));
      case 'model_pool_cancel': return modelResult(await request('POST', '/v1/models/cancel', modelArgs(args, 'cancel')));
      case 'model_pool_select': return modelResult(await request('POST', '/v1/models/select', modelArgs(args, 'select')));
      default: throw new InvalidParams('Unknown tool.');
    }
  };
}

const validId = id => (typeof id === 'string' && id.length <= 256) || (typeof id === 'number' && Number.isFinite(id));
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

function toolResult(data, isError = false) {
  const result = { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data, isError };
  if (Buffer.byteLength(JSON.stringify(result)) > TOOL_OUTPUT_LIMIT) return toolResult({ ok: false, error: 'Metadata output exceeded the limit. Use a smaller pageSize.', code: 'output_too_large' }, true);
  return result;
}

export function createMessageProcessor({ handleTool }) {
  let initialized = false;
  return async line => {
    let message;
    try { message = JSON.parse(line); } catch { return rpcError(null, -32700, 'Parse error'); }
    if (!isObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return rpcError(null, -32600, 'Invalid Request');
    const notification = !Object.hasOwn(message, 'id');
    if (!notification && !validId(message.id)) return rpcError(null, -32600, 'Invalid Request');
    if (notification) return null; // Notifications cannot invoke any action.
    const { id, method, params } = message;
    if (method === 'initialize') {
      if (!isObject(params) || typeof params.protocolVersion !== 'string') return rpcError(id, -32602, 'initialize requires protocolVersion');
      initialized = true;
      return { jsonrpc: '2.0', id, result: {
        protocolVersion: PROTOCOL_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} }, serverInfo: SERVER_INFO,
        instructions: 'Owner-only Daftar runtime. Read office_summary or office_query for stateHash before office_command. Keep each command id stable. Do not retry uncertain mutations automatically. Worker enable may dispatch paid authorized jobs. Tools expose metadata only; local artifact paths, credentials, and leases are unavailable.',
      } };
    }
    if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
    if (!initialized) return rpcError(id, -32002, 'Server not initialized');
    if (method === 'tools/list') {
      if (params !== undefined && (!isObject(params) || Object.keys(params).some(key => key !== '_meta'))) return rpcError(id, -32602, 'tools/list has no pagination');
      return { jsonrpc: '2.0', id, result: { tools: TOOL_DEFINITIONS } };
    }
    if (method !== 'tools/call') return rpcError(id, -32601, 'Method not found');
    if (!isObject(params) || typeof params.name !== 'string' || (params.arguments !== undefined && !isObject(params.arguments))) return rpcError(id, -32602, 'Invalid tool call');
    if (!TOOL_DEFINITIONS.some(tool => tool.name === params.name)) return rpcError(id, -32602, 'Unknown tool');
    try {
      return { jsonrpc: '2.0', id, result: toolResult(await handleTool(params.name, params.arguments ?? {})) };
    } catch (error) {
      if (error instanceof InvalidParams) return rpcError(id, -32602, safeText(error.message, 400));
      const known = error instanceof ToolError;
      return { jsonrpc: '2.0', id, result: toolResult({ ok: false, error: known ? safeText(error.message, 600) : 'Internal tool failure.', code: known ? safeText(error.code, 80) : 'internal_error' }, true) };
    }
  };
}

/** MCP stdio uses one UTF-8 JSON-RPC message per line, not Content-Length. */
export function startServer({ stdin = process.stdin, stdout = process.stdout, handleTool } = {}) {
  const processLine = createMessageProcessor({ handleTool });
  let buffer = ''; let discarding = false; let pending = 0; let chain = Promise.resolve();
  let finish;
  const done = new Promise(resolveDone => { finish = resolveDone; });
  const write = async object => { if (!stdout.write(`${JSON.stringify(object)}\n`)) await once(stdout, 'drain'); };
  const enqueue = line => {
    if (pending >= 32) {
      let id = null;
      try { const message = JSON.parse(line); if (validId(message.id)) id = message.id; } catch { /* malformed */ }
      // This request is rejected before any tool is invoked.
      void write(rpcError(id, -32000, 'Server queue full')).catch(() => {});
      return;
    }
    pending += 1;
    chain = chain.then(async () => {
      try { const response = await processLine(line); if (response) await write(response); }
      catch { /* Do not expose stack traces or credentials on the protocol stream. */ }
      finally { pending -= 1; }
    });
  };
  const tooLarge = () => { chain = chain.then(() => write(rpcError(null, -32600, 'Request too large'))).catch(() => {}); };
  stdin.setEncoding('utf8');
  stdin.on('data', chunk => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline < 0) break;
      const line = buffer.slice(0, newline).replace(/\r$/, ''); buffer = buffer.slice(newline + 1);
      if (discarding) { discarding = false; continue; }
      if (!line.trim()) continue;
      if (Buffer.byteLength(line) > REQUEST_LIMIT) { tooLarge(); continue; }
      enqueue(line);
    }
    if (Buffer.byteLength(buffer) > REQUEST_LIMIT) { buffer = ''; discarding = true; tooLarge(); }
  });
  stdin.on('end', () => {
    if (!discarding && buffer.trim()) enqueue(buffer);
    buffer = '';
    void chain.finally(finish);
  });
  stdin.on('error', () => { buffer = ''; void chain.finally(finish); });
  return { drain: () => chain, done };
}

export function main() {
  const request = createRuntimeClient(loadRuntimeConfig());
  return startServer({ handleTool: createToolHandler({ request }) });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { main(); }
  catch (error) {
    process.stderr.write(`${error instanceof ToolError ? error.message : 'Daftar runtime MCP could not start.'}\n`);
    process.exitCode = 1;
  }
}
