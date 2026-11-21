import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { OfficeJob, OfficeResult, OfficeSnapshot } from '../shared/office';
import type { FetchLike, GenerateRequest, GenerateResult } from './providers';
import type { ModelScope, ModelPullInput, ModelCancelInput, ModelSelectInput, ModelPoolSnapshot, ModelPoolResult, ModelRequestStatus, ModelRequestRecord, ModelAssignment, SharedModel } from '../shared/model-pool';
export type { ModelScope, ModelPullInput, ModelCancelInput, ModelSelectInput, ModelPoolSnapshot, ModelPoolResult } from '../shared/model-pool';
import { assertLocalOllamaModel, assertLoopbackOllamaUrl, canonicalLocalModel, generateWithOllama, OLLAMA_DEFAULT_BASE_URL, readOllamaJson } from './ollama';

const GiB = 1024 ** 3;
/** Reviewed references and admission ceilings, not a claim about exact disk/RAM needs. */
export const MODEL_CATALOG = Object.freeze([
  { id: 'llama3.2:1b', name: 'Llama 3.2 1B', description: 'Small local text model for short, low-stakes work. Review outputs before use.', storageCeilingBytes: 3 * GiB, sourceUrl: 'https://ollama.com/library/llama3.2:1b' },
  { id: 'qwen3:4b', name: 'Qwen3 4B', description: 'Local general-purpose model; a middle option when the small model is insufficient.', storageCeilingBytes: 6 * GiB, sourceUrl: 'https://ollama.com/library/qwen3:4b' },
  { id: 'qwen3:8b', name: 'Qwen3 8B', description: 'Larger local model for a machine with adequate memory. Benchmark your own work.', storageCeilingBytes: 10 * GiB, sourceUrl: 'https://ollama.com/library/qwen3:8b' },
]);
export interface ModelPoolOptions {
  stateDir: string; snapshot: () => Promise<OfficeResult>; baseUrl?: string; localOnlyConfirmed?: boolean;
  fetchFn?: FetchLike; pullTimeoutMs?: number;
}
export class ModelPoolError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); this.name = 'ModelPoolError'; }
}
interface SavedRequest extends ModelRequestRecord { key: string; maxBytes: number; createdAt: string; updatedAt: string }
interface Registry { version: 1; endpoint: string; requests: SavedRequest[]; assignments: ModelAssignment[] }
interface Pull { model: string; controller: AbortController; promise: Promise<void>; started: boolean; requestIds: Set<string> }
const terminal = (status: ModelRequestStatus) => !['queued', 'pulling'].includes(status);
const ID = /^[A-Za-z0-9_.:-]{1,160}$/;
const DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/;
const REGISTRY_LIMIT = 2 * 1024 * 1024;
const RECORD_LIMIT = 512;
function fail(code: string, message: string, status = 400): never { throw new ModelPoolError(code, message, status); }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function keys(value: unknown, allowed: string[]): asserts value is Record<string, unknown> {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('INVALID_REQUEST', 'Provide only the documented model request fields.');
}
function id(value: unknown): string { if (typeof value !== 'string' || !ID.test(value)) fail('INVALID_REQUEST', 'A valid company, employee, or request ID is required.'); return value; }
function processIdentity(pid: number): string | null {
  if (process.platform !== 'linux') return null;
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const startTime = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
    const boot = fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
    return startTime && boot ? `${boot}:${startTime}` : null;
  } catch { return null; }
}
function catalogModel(value: unknown) {
  if (typeof value !== 'string') fail('MODEL_NOT_REVIEWED', 'Choose a model from the reviewed catalog.');
  let canonical: string;
  try { canonical = canonicalLocalModel(value); } catch { return fail('MODEL_NOT_REVIEWED', 'Choose a local model from the reviewed catalog.'); }
  const model = MODEL_CATALOG.find(item => item.id === canonical);
  if (!model) fail('MODEL_NOT_REVIEWED', 'Choose a model from the reviewed catalog.');
  return model;
}

/** Owner-directed requests. An employee ID selects a scope; it is not a login. */
export class ModelPoolService {
  private readonly directory: string;
  private readonly file: string;
  private readonly lock: string;
  private readonly base: string;
  private readonly fetchFn: FetchLike;
  private readonly enabled: boolean;
  private readonly timeoutMs: number;
  private registry: Registry;
  private chain: Promise<unknown> = Promise.resolve();
  private readonly pulls = new Map<string, Pull>();
  private closed = false;

  constructor(private readonly options: ModelPoolOptions) {
    this.base = assertLoopbackOllamaUrl(options.baseUrl ?? OLLAMA_DEFAULT_BASE_URL);
    this.fetchFn = options.fetchFn ?? fetch;
    this.enabled = options.localOnlyConfirmed === true;
    this.timeoutMs = options.pullTimeoutMs ?? 30 * 60 * 1000;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 60 * 60 * 1000) fail('INVALID_CONFIG', 'Model pull timeout must be bounded.', 503);
    this.directory = path.join(path.resolve(options.stateDir), 'model-pool');
    this.file = path.join(this.directory, 'registry.json');
    this.lock = path.join(this.directory, 'owner.lock');
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const directoryStat = fs.lstatSync(this.directory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || (process.platform !== 'win32' && (directoryStat.mode & 0o077))) fail('MODEL_REGISTRY_INVALID', 'The model registry must be a private directory.', 503);
    this.acquireLock();
    try {
      this.registry = this.readRegistry();
      for (const request of this.registry.requests) if (!terminal(request.status)) {
        request.status = 'interrupted'; request.error = 'Runtime restarted. Inspect installed models before making a new explicit request.'; request.updatedAt = new Date().toISOString();
      }
      this.save();
    } catch (error) { fs.unlinkSync(this.lock); throw error; }
  }

  private acquireLock() {
    const mine = JSON.stringify({ pid: process.pid, identity: processIdentity(process.pid) });
    try { fs.writeFileSync(this.lock, mine, { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const stat = fs.lstatSync(this.lock);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512) fail('MODEL_REGISTRY_BUSY', 'Inspect the model registry owner lock locally.', 503);
      let saved: unknown; try { saved = JSON.parse(fs.readFileSync(this.lock, 'utf8')); } catch { fail('MODEL_REGISTRY_BUSY', 'Inspect the model registry owner lock locally.', 503); }
      if (!object(saved)) fail('MODEL_REGISTRY_BUSY', 'Inspect the model registry owner lock locally.', 503);
      const pid = Number(saved.pid);
      if (!Number.isSafeInteger(pid) || pid < 1) fail('MODEL_REGISTRY_BUSY', 'Inspect the model registry owner lock locally.', 503);
      const currentIdentity = processIdentity(pid);
      const reusedPid = typeof saved.identity === 'string' && currentIdentity !== null && saved.identity !== currentIdentity;
      if (!reusedPid) {
        try { process.kill(pid, 0); fail('MODEL_REGISTRY_BUSY', 'Another model controller owns this state directory.', 503); }
        catch (probe) { if ((probe as NodeJS.ErrnoException).code !== 'ESRCH') throw probe; }
      }
      fs.unlinkSync(this.lock);
      fs.writeFileSync(this.lock, mine, { flag: 'wx', mode: 0o600 });
    }
  }

  private readRegistry(): Registry {
    if (!fs.existsSync(this.file)) return { version: 1, endpoint: this.base, requests: [], assignments: [] };
    const stat = fs.lstatSync(this.file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > REGISTRY_LIMIT || (process.platform !== 'win32' && (stat.mode & 0o077))) fail('MODEL_REGISTRY_INVALID', 'The model registry requires local review.', 503);
    let value: unknown;
    try { value = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return fail('MODEL_REGISTRY_INVALID', 'The model registry requires local review.', 503); }
    if (!object(value) || value.version !== 1 || value.endpoint !== this.base || !Array.isArray(value.requests) || !Array.isArray(value.assignments)
        || value.requests.length > RECORD_LIMIT || value.assignments.length > RECORD_LIMIT) fail('MODEL_REGISTRY_INVALID', 'The model registry or endpoint changed. Review it locally before reuse.', 503);
    for (const row of value.requests) {
      if (!object(row) || !ID.test(String(row.id)) || !ID.test(String(row.companyId)) || !ID.test(String(row.employeeId))
          || !ID.test(String(row.key)) || !MODEL_CATALOG.some(model => model.id === row.model)
          || !['queued', 'pulling', 'ready', 'failed', 'cancelled', 'interrupted'].includes(String(row.status))
          || ![row.completedBytes, row.totalBytes, row.maxBytes].every(n => Number.isSafeInteger(n) && Number(n) >= 0)
          || typeof row.createdAt !== 'string' || typeof row.updatedAt !== 'string'
          || !(row.error === null || typeof row.error === 'string')) fail('MODEL_REGISTRY_INVALID', 'The model registry requires local review.', 503);
    }
    for (const row of value.assignments) if (!object(row) || !ID.test(String(row.companyId)) || !ID.test(String(row.employeeId))
        || !MODEL_CATALOG.some(model => model.id === row.model) || !DIGEST.test(String(row.digest))) fail('MODEL_REGISTRY_INVALID', 'The model registry requires local review.', 503);
    return value as unknown as Registry;
  }

  private save() {
    const contents = JSON.stringify(this.registry);
    if (Buffer.byteLength(contents) > REGISTRY_LIMIT) fail('CAPACITY', 'Model registry capacity reached.', 409);
    const temporary = `${this.file}.${crypto.randomUUID()}.tmp`;
    let fd: number | undefined;
    try {
      fd = fs.openSync(temporary, 'wx', 0o600); fs.writeFileSync(fd, contents); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      fs.renameSync(temporary, this.file);
      if (process.platform !== 'win32') { const directory = fs.openSync(this.directory, 'r'); try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); } }
    } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }

  private serial<T>(run: () => Promise<T> | T): Promise<T> {
    const pending = this.chain.then(() => { if (this.closed) fail('MODEL_POOL_CLOSED', 'The model controller is stopping.', 503); return run(); });
    this.chain = pending.catch(() => undefined); return pending;
  }
  private requireEnabled() { if (!this.enabled) fail('MODEL_POOL_DISABLED', 'Set OLLAMA_NO_CLOUD=1 on the managed daemon, then DAFTAR_OLLAMA_LOCAL_ONLY=1 on Daftar to enable self-hosted models.', 409); }
  private async office(): Promise<OfficeSnapshot> {
    const result = await this.options.snapshot();
    if (!result.ok || !result.snapshot) fail('MODEL_SCOPE_UNAVAILABLE', 'Fresh company and employee state is unavailable.', 503);
    return result.snapshot;
  }
  private scope(snapshot: OfficeSnapshot, companyId: string, employeeId?: string, active = true, job?: OfficeJob) {
    const company = snapshot.companies.find(item => item.id === companyId);
    if (!company || (active && company.status !== 'active')) fail('MODEL_SCOPE_DENIED', 'The requested company is unavailable or paused.', 403);
    if (!employeeId) return;
    const employee = snapshot.employees.find(item => item.id === employeeId);
    if (!employee || (active && employee.status !== 'active')) fail('MODEL_SCOPE_DENIED', 'The requested employee is unavailable or paused.', 403);
    const ownCompany = employee.companyId === companyId || (employee.companyId === null && company.assistantId === employee.id);
    const liveOffice = (officeId: string | null, target: string) => !officeId || snapshot.offices.some(item => item.id === officeId && item.companyId === target && (!active || item.status === 'active'));
    const liveDepartment = (departmentId: string | null, target: string) => !departmentId || snapshot.departments.some(item => item.id === departmentId && item.companyId === target && (!active || item.status === 'active'));
    if (!liveOffice(employee.officeId, employee.companyId ?? companyId) || !liveDepartment(employee.departmentId, employee.companyId ?? companyId)) fail('MODEL_SCOPE_DENIED', 'The employee location is unavailable or paused.', 403);
    if (ownCompany) {
      if (job && (!liveOffice(job.officeId, companyId) || !liveDepartment(job.departmentId, companyId)
          || (employee.officeId && employee.officeId !== job.officeId) || (employee.departmentId && employee.departmentId !== job.departmentId))) fail('MODEL_SCOPE_DENIED', 'The job location does not match its employee scope.', 403);
      return;
    }
    const portfolio = snapshot.portfolio;
    const contract = portfolio?.contracts.find(item => item.recipientCompanyId === companyId && item.status === 'active'
      && item.employeeIds.includes(employeeId) && (!job || item.id === job.serviceContractId)
      && (!job || !item.recipientOfficeId || item.recipientOfficeId === job.officeId)
      && (!job || !item.recipientDepartmentId || item.recipientDepartmentId === job.departmentId)
      && liveOffice(item.recipientOfficeId, companyId) && liveDepartment(item.recipientDepartmentId, companyId)
      && portfolio.services.some(service => service.id === item.serviceId && service.status === 'active'
        && service.companyId === employee.companyId && service.employeeIds.includes(employeeId)
        && snapshot.companies.some(provider => provider.id === service.companyId && provider.status === 'active')
        && liveOffice(service.officeId, service.companyId) && liveDepartment(service.departmentId, service.companyId)));
    if (!contract) fail('MODEL_SCOPE_DENIED', 'An active shared-service contract is required for this employee and company.', 403);
  }

  private async inventory(): Promise<SharedModel[]> {
    const metadata = await readOllamaJson(await this.fetchFn(`${this.base}/api/tags`, { redirect: 'error', signal: AbortSignal.timeout(8000) }));
    if (!Array.isArray(metadata.models) || metadata.models.length > 2048) fail('MODEL_METADATA_INVALID', 'Ollama returned invalid model inventory.', 503);
    const entries = MODEL_CATALOG.flatMap(model => {
      const matching = (metadata.models as unknown[]).filter(item => object(item) && item.name === model.id);
      if (matching.length > 1) fail('MODEL_METADATA_INVALID', 'Ollama returned ambiguous model inventory.', 503);
      return matching;
    });
    const verified = await Promise.all(entries.map(async item => {
      if (!object(item) || typeof item.name !== 'string' || typeof item.digest !== 'string' || !DIGEST.test(item.digest) || !Number.isSafeInteger(item.size) || Number(item.size) < 1) {
        fail('MODEL_METADATA_INVALID', 'Ollama returned incomplete installed model metadata.', 503);
      }
      await assertLocalOllamaModel(item.name, this.fetchFn, this.base);
      return { name: item.name, digest: item.digest.replace(/^sha256:/, ''), sizeBytes: Number(item.size), loaded: false };
    }));
    const rows: SharedModel[] = verified;
    try {
      const loaded = await readOllamaJson(await this.fetchFn(`${this.base}/api/ps`, { redirect: 'error', signal: AbortSignal.timeout(3000) }));
      if (Array.isArray(loaded.models)) for (const row of rows) row.loaded = loaded.models.some(item => object(item) && (item.name === row.name || item.model === row.name));
    } catch { /* Disk readiness does not depend on a running inference session. */ }
    return rows;
  }
  private view(input: ModelScope, models: SharedModel[], available: boolean, error: string | null): ModelPoolSnapshot {
    const matches = (row: { companyId: string; employeeId: string }) => row.companyId === input.companyId && (!input.employeeId || row.employeeId === input.employeeId);
    return { companyId: input.companyId, available, enabled: this.enabled, endpoint: 'Self-hosted Ollama (loopback)', infrastructureCost: 'separate',
      catalog: MODEL_CATALOG, models, requests: this.registry.requests.filter(matches).map(({ id, companyId, employeeId, model, status, completedBytes, totalBytes, error }) => ({ id, companyId, employeeId, model, status, completedBytes, totalBytes, error })),
      assignments: this.registry.assignments.filter(matches).map(row => ({ ...row })), error };
  }
  private async result(input: ModelScope): Promise<ModelPoolResult> {
    let models: SharedModel[] = []; let available = false; let error: string | null = null;
    if (!this.enabled) error = 'Self-hosted models are disabled. Configure a managed Ollama daemon with cloud disabled and confirm local-only mode.';
    else try { models = await this.inventory(); available = true; }
    catch { error = 'The local model inventory could not be verified. Check the managed Ollama daemon.'; }
    return { ok: true, snapshot: this.view(input, models, available, error) };
  }

  async snapshot(input: ModelScope): Promise<ModelPoolResult> {
    keys(input, ['companyId', 'employeeId']); id(input.companyId); if (input.employeeId !== undefined) id(input.employeeId);
    this.scope(await this.office(), input.companyId, input.employeeId, false);
    return this.serial(() => this.result(input));
  }

  async request(input: ModelPullInput): Promise<ModelPoolResult> {
    keys(input, ['companyId', 'employeeId', 'model', 'idempotencyKey', 'maxBytes']); id(input.companyId); id(input.employeeId); id(input.idempotencyKey);
    const model = catalogModel(input.model); const maxBytes = input.maxBytes ?? model.storageCeilingBytes;
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > model.storageCeilingBytes) fail('INVALID_REQUEST', 'maxBytes must be a positive integer within the catalog storage ceiling.');
    this.requireEnabled();
    return this.serial(async () => {
      this.scope(await this.office(), input.companyId, input.employeeId);
      const prior = this.registry.requests.find(row => row.companyId === input.companyId && row.key === input.idempotencyKey);
      if (prior) {
        if (prior.employeeId !== input.employeeId || prior.model !== model.id || prior.maxBytes !== maxBytes) fail('MODEL_REQUEST_CONFLICT', 'This idempotency key belongs to a different model request.', 409);
        return { ...await this.result(input), requestId: prior.id, replayed: true };
      }
      if (this.registry.requests.length >= RECORD_LIMIT) fail('CAPACITY', 'Model request history reached its bound. Archive it locally before creating more requests.', 409);
      let installed: SharedModel | undefined;
      try { installed = (await this.inventory()).find(row => row.name === model.id); }
      catch { fail('MODEL_UNAVAILABLE', 'The local daemon could not be verified. No pull was started.', 503); }
      if (installed && installed.sizeBytes > maxBytes) fail('MODEL_STORAGE_LIMIT', 'The installed model exceeds this request storage ceiling.', 409);
      const now = new Date().toISOString();
      const row: SavedRequest = { id: `model_${crypto.randomUUID()}`, key: input.idempotencyKey, companyId: input.companyId, employeeId: input.employeeId,
        model: model.id, maxBytes, status: installed ? 'ready' : 'queued', completedBytes: installed?.sizeBytes ?? 0, totalBytes: installed?.sizeBytes ?? 0,
        error: null, createdAt: now, updatedAt: now };
      this.registry.requests.push(row); this.save();
      if (!installed) this.schedule(model.id);
      return { ...await this.result(input), requestId: row.id, replayed: false, reused: !!installed || this.subscribers(model.id).length > 1 };
    });
  }

  async cancel(input: ModelCancelInput): Promise<ModelPoolResult> {
    keys(input, ['companyId', 'employeeId', 'requestId']); id(input.companyId); id(input.employeeId); id(input.requestId);
    return this.serial(async () => {
      // The owner can stop an old request even after its employee is paused or a contract is revoked.
      const office = await this.office(); this.scope(office, input.companyId, undefined, false);
      const row = this.registry.requests.find(item => item.id === input.requestId && item.companyId === input.companyId && item.employeeId === input.employeeId);
      if (!row) fail('MODEL_REQUEST_NOT_FOUND', 'No model request matches this company and employee.', 404);
      if (!terminal(row.status)) { row.status = 'cancelled'; row.error = null; row.updatedAt = new Date().toISOString(); this.save(); }
      const pull = this.pulls.get(row.model);
      if (pull && !this.pullSubscribers(pull).length) pull.controller.abort();
      return { ...await this.result({ companyId: input.companyId }), requestId: row.id };
    });
  }

  async select(input: ModelSelectInput): Promise<ModelPoolResult> {
    keys(input, ['companyId', 'employeeId', 'model']); id(input.companyId); id(input.employeeId); const model = catalogModel(input.model); this.requireEnabled();
    return this.serial(async () => {
      this.scope(await this.office(), input.companyId, input.employeeId);
      const installed = (await this.inventory()).find(item => item.name === model.id);
      if (!installed) fail('MODEL_NOT_READY', 'Download and verify the reviewed model before assigning it.', 409);
      const prior = this.registry.assignments.find(item => item.companyId === input.companyId && item.employeeId === input.employeeId);
      if (!prior && this.registry.assignments.length >= RECORD_LIMIT) fail('CAPACITY', 'Model assignment capacity reached.', 409);
      const assignment = { companyId: input.companyId, employeeId: input.employeeId, model: model.id, digest: installed.digest };
      if (prior) Object.assign(prior, assignment); else this.registry.assignments.push(assignment);
      this.save(); return { ...await this.result(input), reused: true };
    });
  }

  async validateJob(job: OfficeJob): Promise<void> {
    if (job.provider !== 'ollama') return;
    this.requireEnabled(); const model = catalogModel(job.model);
    this.scope(await this.office(), job.companyId, job.employeeId, true, job);
    await this.serial(async () => {
      const assignment = this.registry.assignments.find(item => item.companyId === job.companyId && item.employeeId === job.employeeId);
      if (!assignment || assignment.model !== model.id) fail('MODEL_NOT_ASSIGNED', 'Assign this exact model to the employee before running a self-hosted job.', 409);
      const installed = (await this.inventory()).find(item => item.name === model.id);
      if (!installed || installed.digest !== assignment.digest) fail('MODEL_DIGEST_CHANGED', 'The selected model is missing or changed. Review and select it again before running.', 409);
    });
  }
  async generateForJob(job: OfficeJob | undefined, request: GenerateRequest): Promise<GenerateResult> {
    if (!job || job.provider !== 'ollama' || request.model !== job.model) fail('MODEL_SCOPE_DENIED', 'Self-hosted employee generation requires its exact scoped job.', 403);
    await this.validateJob(job); request.abortSignal?.throwIfAborted();
    return generateWithOllama(request, this.fetchFn, this.base);
  }

  private subscribers(model: string) { return this.registry.requests.filter(row => row.model === model && !terminal(row.status)); }
  private pullSubscribers(pull: Pull) { return this.subscribers(pull.model).filter(row => pull.requestIds.has(row.id)); }
  private schedule(model: string) {
    const previous = this.pulls.get(model);
    if (previous) {
      if (!previous.controller.signal.aborted) for (const row of this.subscribers(model)) previous.requestIds.add(row.id);
      return;
    }
    const pull: Pull = { model, controller: new AbortController(), promise: Promise.resolve(), started: false, requestIds: new Set(this.subscribers(model).map(row => row.id)) };
    this.pulls.set(model, pull);
    // The first serial transition releases before a pull can update its durable progress.
    pull.promise = this.chain.then(async () => {
      while (!this.closed && [...this.pulls.values()].some(other => other !== pull && other.started)) await new Promise(resolve => setTimeout(resolve, 25));
      if (this.closed || pull.controller.signal.aborted || !this.subscribers(model).length) return;
      pull.started = true; await this.runPull(pull);
    }).catch(() => undefined).finally(() => {
      if (this.pulls.get(model) === pull) this.pulls.delete(model);
      if (!this.closed && this.subscribers(model).length) this.schedule(model);
    });
  }
  private async runPull(pull: Pull) {
    const timer = setTimeout(() => pull.controller.abort(new Error('Model download timed out.')), this.timeoutMs);
    const layers = new Map<string, { total: number; completed: number }>(); let success = false; let metadataBytes = 0; let buffered = '';
    const update = async () => this.serial(async () => {
      const office = await this.office(); const total = [...layers.values()].reduce((sum, row) => sum + row.total, 0); const completed = [...layers.values()].reduce((sum, row) => sum + row.completed, 0);
      for (const row of this.pullSubscribers(pull)) {
        try { this.scope(office, row.companyId, row.employeeId); }
        catch { row.status = 'cancelled'; row.error = 'Company, employee, or shared-service access changed.'; }
        if (!terminal(row.status) && total > row.maxBytes) { row.status = 'failed'; row.error = 'Download exceeds the requested storage ceiling. Partial bytes may remain in the daemon cache.'; }
        if (!terminal(row.status)) row.status = 'pulling';
        row.totalBytes = total; row.completedBytes = completed; row.updatedAt = new Date().toISOString();
      }
      this.save(); if (!this.pullSubscribers(pull).length) pull.controller.abort();
    });
    const line = async (text: string) => {
      if (!text.trim()) return;
      let value: unknown; try { value = JSON.parse(text); } catch { fail('MODEL_DOWNLOAD_INVALID', 'The daemon returned invalid download progress.'); }
      if (!object(value) || value.error) fail('MODEL_DOWNLOAD_FAILED', 'The daemon rejected the model download. Inspect local daemon logs.');
      if (typeof value.status !== 'string' || value.status.length > 512) fail('MODEL_DOWNLOAD_INVALID', 'The daemon returned invalid download progress.');
      success = value.status === 'success';
      if (value.digest !== undefined) {
        if (typeof value.digest !== 'string' || !DIGEST.test(value.digest) || !Number.isSafeInteger(value.total) || Number(value.total) < 0
            || !Number.isSafeInteger(value.completed ?? 0) || Number(value.completed ?? 0) < 0 || Number(value.completed ?? 0) > Number(value.total)) fail('MODEL_DOWNLOAD_INVALID', 'The daemon returned invalid download progress.');
        const digest = value.digest.replace(/^sha256:/, ''); const old = layers.get(digest);
        if ((!old && layers.size >= 64) || (old && old.total !== value.total)) fail('MODEL_DOWNLOAD_INVALID', 'The daemon returned inconsistent layer metadata.');
        layers.set(digest, { total: Number(value.total), completed: Math.max(old?.completed ?? 0, Number(value.completed ?? 0)) });
      }
      await update();
    };
    try {
      await update(); pull.controller.signal.throwIfAborted();
      const response = await this.fetchFn(`${this.base}/api/pull`, { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: pull.model, stream: true, insecure: false }), signal: pull.controller.signal });
      if (!response.ok || !response.body) fail('MODEL_DOWNLOAD_FAILED', 'The daemon rejected the model download. Inspect local daemon logs.');
      const reader = response.body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true });
      const abort = () => { void reader.cancel().catch(() => undefined); }; pull.controller.signal.addEventListener('abort', abort, { once: true });
      try {
        for (;;) {
          pull.controller.signal.throwIfAborted(); const part = await reader.read(); pull.controller.signal.throwIfAborted(); if (part.done) break;
          metadataBytes += part.value.byteLength; if (metadataBytes > 8 * 1024 * 1024) fail('MODEL_DOWNLOAD_INVALID', 'Download progress exceeded its metadata limit.');
          buffered += decoder.decode(part.value, { stream: true });
          for (;;) { const newline = buffered.indexOf('\n'); if (newline < 0) break; const text = buffered.slice(0, newline); buffered = buffered.slice(newline + 1); if (Buffer.byteLength(text) > 64 * 1024) fail('MODEL_DOWNLOAD_INVALID', 'Download progress exceeded its line limit.'); await line(text); }
          if (Buffer.byteLength(buffered) > 64 * 1024) fail('MODEL_DOWNLOAD_INVALID', 'Download progress exceeded its line limit.');
        }
        buffered += decoder.decode(); if (buffered.trim()) await line(buffered);
      } finally { pull.controller.signal.removeEventListener('abort', abort); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      if (!success) fail('MODEL_DOWNLOAD_INCOMPLETE', 'The download ended without a verified success receipt.');
      const installed = (await this.inventory()).find(item => item.name === pull.model);
      if (!installed) fail('MODEL_DOWNLOAD_INCOMPLETE', 'The model did not appear in verified local inventory.');
      await this.serial(async () => {
        const office = await this.office();
        for (const row of this.pullSubscribers(pull)) {
          try { this.scope(office, row.companyId, row.employeeId); if (installed.sizeBytes > row.maxBytes) throw new Error('storage');
            row.status = 'ready'; row.totalBytes = installed.sizeBytes; row.completedBytes = installed.sizeBytes; row.error = null;
          } catch { row.status = 'failed'; row.error = 'Model scope changed or the installed model exceeds the request storage ceiling.'; }
          row.updatedAt = new Date().toISOString();
        }
        this.save();
      });
    } catch (error) {
      if (!this.closed) await this.serial(() => {
        for (const row of this.pullSubscribers(pull)) { row.status = 'failed'; row.error = error instanceof ModelPoolError ? error.message : 'Download interrupted or unavailable. Inspect local models before submitting a new request.'; row.updatedAt = new Date().toISOString(); }
        this.save();
      }).catch(() => undefined);
    } finally { clearTimeout(timer); }
  }

  async waitForIdle(): Promise<void> { while (this.pulls.size) await Promise.all([...this.pulls.values()].map(pull => pull.promise)); await this.chain; }
  async close(): Promise<void> {
    if (this.closed) return; this.closed = true;
    for (const pull of this.pulls.values()) pull.controller.abort();
    await this.waitForIdle();
    for (const row of this.registry.requests) if (!terminal(row.status)) { row.status = 'interrupted'; row.error = 'Runtime stopped. Inspect installed models before an explicit new request.'; row.updatedAt = new Date().toISOString(); }
    this.save(); fs.unlinkSync(this.lock);
  }
}
