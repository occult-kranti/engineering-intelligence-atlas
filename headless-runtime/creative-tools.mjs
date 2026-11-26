import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'interrupted']);
const TOOL_OPERATIONS = Object.freeze({
  blender: ['blender.inspect', 'blender.render', 'blender.export_glb'],
  unreal: ['unreal.inspect', 'unreal.validate'],
  inkscape: ['inkscape.export_png'],
  ffmpeg: ['ffmpeg.probe'],
  'adobe-photoshop': ['adobe.manifest', 'adobe.render'],
});
const OPERATIONS = Object.values(TOOL_OPERATIONS).flat();
const DEFAULT_LIMITS = Object.freeze({ maxConcurrentJobs: 1, maxQueuedJobs: 8, maxDurationMs: 120000,
  maxOutputBytes: 262144, maxArtifactBytes: 33554432, maxInputBytes: 536870912, maxMemoryBytes: 4294967296 });
const LIMIT_RANGES = { maxConcurrentJobs: [1, 4], maxQueuedJobs: [0, 32], maxDurationMs: [100, 1200000],
  maxOutputBytes: [1024, 1048576], maxArtifactBytes: [1024, 104857600], maxInputBytes: [1024, 1073741824], maxMemoryBytes: [268435456, 17179869184] };
const MAX_RECORDS = 10000;
const MAX_REGISTRY_BYTES = 16 * 1024 * 1024;
const now = () => new Date().toISOString();
const validTimestamp = value => typeof value === 'string' && value.length <= 40 && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const copy = value => structuredClone(value);

export class CreativeToolsError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'CreativeToolsError'; this.code = code; this.status = status; }
}
const fail = (code, message, status = 400) => { throw new CreativeToolsError(code, message, status); };
function fields(value, allowed, required = allowed) {
  if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !(key in value))) {
    fail('INVALID_REQUEST', 'Use only the documented creative-tool fields.');
  }
}
function identifier(value) {
  if (typeof value !== 'string' || !ID.test(value)) fail('INVALID_REQUEST', 'Use a bounded canonical identifier.');
  return value;
}
function canonical(value, depth = 0) {
  if (depth > 10) fail('INVALID_REQUEST', 'Creative requests must be shallow JSON.');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(item => canonical(item, depth + 1)).join(',') + ']';
  if (!plain(value) || Object.keys(value).some(key => ['__proto__', 'prototype', 'constructor'].includes(key))) {
    fail('INVALID_REQUEST', 'Creative requests must contain ordinary JSON values.');
  }
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key], depth + 1)).join(',') + '}';
}
function digest(value) {
  const text = canonical(value);
  if (Buffer.byteLength(text) > 16384) fail('INVALID_REQUEST', 'Creative request exceeds its size limit.');
  return crypto.createHash('sha256').update(text).digest('hex');
}
function integer(value, low, high, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < low || value > high) fail('INVALID_REQUEST', 'Creative dimensions and limits must be bounded integers.');
  return value;
}
function relativeInput(value) {
  if (typeof value !== 'string' || value.length > 512 || !value || /[\\:\x00-\x1f\x7f%?#]/.test(value)
      || path.isAbsolute(value) || value.split('/').some(piece => !piece || piece === '.' || piece === '..')) {
    fail('PATH_DENIED', 'Input must be a relative file inside the configured reviewed project.', 403);
  }
  return value;
}
function operationInput(operation, value) {
  if (!OPERATIONS.includes(operation)) fail('OPERATION_DENIED', 'This creative operation is not implemented.', 403);
  const extras = operation === 'blender.render' ? ['frame', 'width', 'height', 'samples']
    : ['inkscape.export_png', 'adobe.render'].includes(operation) ? ['width', 'height', ...(operation === 'adobe.render' ? ['format'] : [])] : [];
  fields(value, ['path', ...extras], ['path']);
  const input = { path: relativeInput(value.path) };
  const extension = path.extname(input.path).toLowerCase();
  const allowed = operation.startsWith('blender.') ? ['.blend'] : operation.startsWith('unreal.') ? ['.uproject']
    : operation === 'inkscape.export_png' ? ['.svg'] : operation === 'adobe.manifest' ? ['.psd'] : operation === 'adobe.render' ? ['.psd', '.png', '.jpg', '.jpeg']
    : ['.mp4', '.m4v', '.mov', '.mkv', '.webm', '.wav', '.mp3', '.flac', '.ogg', '.avi', '.png', '.jpg', '.jpeg'];
  if (!allowed.includes(extension)) fail('INPUT_TYPE_DENIED', 'This operation requires a supported project file type.');
  if (extras.includes('width')) input.width = integer(value.width, 16, 2048, 1024);
  if (extras.includes('height')) input.height = integer(value.height, 16, 2048, 1024);
  if (extras.includes('frame')) input.frame = integer(value.frame, 0, 100000, 1);
  if (extras.includes('samples')) input.samples = integer(value.samples, 1, 64, 16);
  if (extras.includes('format')) {
    input.format = value.format ?? 'png';
    if (!['png', 'jpeg'].includes(input.format)) fail('INVALID_REQUEST', 'Render format must be png or jpeg.');
  }
  return input;
}

/** Refuse symlinks in every existing path component, including parent directories. */
function noLinks(filename, { directory = false, maxBytes = Infinity, privateFile = false } = {}) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename) || filename.includes('\0')) fail('PATH_DENIED', 'Configure an absolute regular path.', 403);
  const resolved = path.resolve(filename);
  let current = path.parse(resolved).root;
  let info;
  for (const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { info = fs.lstatSync(current); } catch { fail('PATH_DENIED', 'The configured creative path is unavailable.', 403); }
    if (info.isSymbolicLink()) fail('PATH_DENIED', 'Symlinked creative paths require owner review.', 403);
  }
  if (!info || (directory ? !info.isDirectory() : !info.isFile()) || info.size > maxBytes) fail('PATH_DENIED', 'Creative path type or size is not permitted.', 403);
  if (privateFile && process.platform !== 'win32' && ![0o400, 0o600].includes(info.mode & 0o777)) {
    fail('CREATIVE_CONFIG_INVALID', 'Creative configuration and credential files must use mode 0400 or 0600.', 503);
  }
  if (fs.realpathSync(resolved) !== resolved) fail('PATH_DENIED', 'Creative path does not resolve to its reviewed location.', 403);
  return { filename: resolved, info };
}
function readJson(filename, maxBytes, privateFile = false) {
  const { info } = noLinks(filename, { maxBytes, privateFile });
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fs.fstatSync(fd);
    if (opened.dev !== info.dev || opened.ino !== info.ino || opened.size > maxBytes) fail('PATH_DENIED', 'Creative file changed during review.', 403);
    return JSON.parse(fs.readFileSync(fd, 'utf8'));
  } finally { fs.closeSync(fd); }
}
function privateDirectory(dirname) {
  fs.mkdirSync(dirname, { recursive: true, mode: 0o700 });
  const { info } = noLinks(dirname, { directory: true });
  if (process.platform !== 'win32' && (info.mode & 0o077)) fail('CREATIVE_STATE_INVALID', 'Creative state requires a private directory.', 503);
}
function processIdentity(pid) {
  try { const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]; } catch { return null; }
}
function safeError(error) {
  if (typeof error?.code === 'string' && /^ADOBE_[A-Z_]{1,60}$/.test(error.code)) return { code: error.code,
    message: 'The remote creative outcome needs review. Inspect the retained Adobe receipt before any new request; local cancellation does not confirm remote cancellation.' };
  return error instanceof CreativeToolsError ? { code: error.code, message: error.message }
    : { code: 'TOOL_FAILED', message: 'The creative operation could not be confirmed. Inspect the private runtime configuration and retained receipt.' };
}
function safeText(value, limit = 80) {
  return typeof value === 'string' && value.length <= limit && /^[A-Za-z0-9 ._+(),-]*$/.test(value) ? value : undefined;
}
function safeResult(value) {
  if (!plain(value)) return {};
  const output = {};
  for (const key of ['objects', 'meshes', 'materials', 'scenes', 'cameras', 'lights', 'frameStart', 'frameEnd', 'frame', 'width', 'height', 'samples', 'fileVersion', 'modules', 'plugins', 'durationSeconds', 'layers', 'deviceCount', 'deviceIndex', 'renderDurationSeconds']) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key]) && Math.abs(value[key]) < 1e12) output[key] = value[key];
  }
  for (const key of ['format', 'blenderVersion', 'engine', 'device', 'backend', 'deviceName', 'engineAssociation', 'provider', 'operation']) {
    const text = safeText(value[key]); if (text !== undefined) output[key] = text;
  }
  for (const key of ['engineExecuted', 'validationPassed', 'remoteAuthVerified']) if (typeof value[key] === 'boolean') output[key] = value[key];
  if (typeof value.inputSha256 === 'string' && /^[a-f0-9]{64}$/.test(value.inputSha256)) output.inputSha256 = value.inputSha256;
  if (typeof value.adobeJobId === 'string' && /^[A-Za-z0-9:_-]{1,240}$/.test(value.adobeJobId)) output.adobeJobId = value.adobeJobId;
  if (['complete', 'pending'].includes(value.cleanup)) output.cleanup = value.cleanup;
  if (['submitted', 'running', 'succeeded', 'failed', 'outcome_unconfirmed', 'cancelled'].includes(value.state)) output.state = value.state;
  if (Array.isArray(value.streams)) output.streams = value.streams.slice(0, 64).filter(plain).map(stream => {
    const row = {};
    for (const key of ['codecType', 'codecName']) { const text = safeText(stream[key]); if (text !== undefined) row[key] = text; }
    for (const key of ['width', 'height', 'sampleRate', 'channels']) if (Number.isFinite(stream[key]) && stream[key] >= 0 && stream[key] < 1e9) row[key] = stream[key];
    return row;
  });
  return output;
}

/** Read-only owner configuration validation; creates no registry and probes no tool. */
export function readCreativeConfig(configFile) {
  if (!configFile) return { schemaVersion: 1, tools: {}, projects: [], limits: { ...DEFAULT_LIMITS } };
  try {
    const value = readJson(configFile, 1024 * 1024, true);
    fields(value, ['schemaVersion', 'tools', 'projects', 'limits'], ['schemaVersion', 'tools', 'projects']);
    if (value.schemaVersion !== 1 || !plain(value.tools) || !Array.isArray(value.projects) || value.projects.length > 1000) throw new Error('invalid config');
    for (const [id, tool] of Object.entries(value.tools)) {
      if (!Object.hasOwn(TOOL_OPERATIONS, id)) throw new Error('unknown tool');
      if (id === 'adobe-photoshop') {
        fields(tool, ['enabled', 'allowPaidRequests', 'clientIdFile', 'clientSecretFile', 'assetStorageFile']);
        if (typeof tool.enabled !== 'boolean' || typeof tool.allowPaidRequests !== 'boolean'
          || ![tool.clientIdFile, tool.clientSecretFile, tool.assetStorageFile].every(p => typeof p === 'string' && path.isAbsolute(p))) throw new Error('invalid Adobe config');
      } else {
        fields(tool, id === 'blender' ? ['executable', 'renderDevice', 'renderDeviceIndex'] : ['executable'], ['executable']);
        if (typeof tool.executable !== 'string' || !path.isAbsolute(tool.executable)) throw new Error('invalid executable');
        if (id === 'blender') {
          if (tool.renderDevice !== undefined && !['CPU', 'CUDA', 'OPTIX'].includes(tool.renderDevice)) throw new Error('invalid render device');
          if (tool.renderDeviceIndex !== undefined) integer(tool.renderDeviceIndex, 0, 15);
          if ((tool.renderDevice ?? 'CPU') === 'CPU' && (tool.renderDeviceIndex ?? 0) !== 0) throw new Error('CPU has no GPU index');
        }
      }
    }
    const ids = new Set();
    for (const project of value.projects) {
      fields(project, ['id', 'companyId', 'departmentId', 'root', 'repository', 'trusted', 'allowedOperations', 'allowExternalUpload'], ['id', 'companyId', 'root', 'trusted', 'allowedOperations']);
      identifier(project.id); identifier(project.companyId); if (project.departmentId !== undefined) identifier(project.departmentId);
      if (ids.has(project.id) || project.trusted !== true || typeof project.root !== 'string' || !path.isAbsolute(project.root)
        || !Array.isArray(project.allowedOperations) || project.allowedOperations.length > OPERATIONS.length || new Set(project.allowedOperations).size !== project.allowedOperations.length
        || project.allowedOperations.some(operation => !OPERATIONS.includes(operation))
        || (project.repository !== undefined && (typeof project.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(project.repository)))
        || (project.allowExternalUpload !== undefined && typeof project.allowExternalUpload !== 'boolean')) throw new Error('invalid project');
      ids.add(project.id);
    }
    if (value.limits !== undefined) fields(value.limits, Object.keys(DEFAULT_LIMITS), []);
    const limits = { ...DEFAULT_LIMITS, ...value.limits };
    for (const key of Object.keys(limits)) integer(limits[key], ...LIMIT_RANGES[key]);
    return { ...value, limits };
  } catch { fail('CREATIVE_CONFIG_INVALID', 'Creative configuration is missing, unsafe or invalid. Review the private owner-authored configuration.', 503); }
}

/** Owner-configured fixed adapters; this is not an arbitrary-code or OS sandbox. */
export class CreativeToolsService {
  constructor({ stateDir, repoRoot, configFile, snapshot, spawnImpl = spawn }) {
    if (typeof snapshot !== 'function' || typeof spawnImpl !== 'function') fail('CREATIVE_CONFIG_INVALID', 'A native snapshot source is required.', 503);
    this.nativeSnapshot = snapshot; this.spawnImpl = spawnImpl;
    this.repoRoot = path.resolve(repoRoot); this.configFile = configFile;
    this.directory = path.join(path.resolve(stateDir), 'creative-tools');
    this.file = path.join(this.directory, 'registry.json'); this.lock = path.join(this.directory, 'owner.lock');
    this.chain = Promise.resolve(); this.running = new Map(); this.options = new Map(); this.probes = new Map();
    this.closed = false; this.closing = null;
    privateDirectory(this.directory); privateDirectory(path.join(this.directory, 'artifacts'));
    this.acquireLock();
    try {
      this.registry = this.readRegistry();
      for (const job of this.registry.jobs) if (!TERMINAL.has(job.status)) {
        job.status = 'interrupted'; job.finishedAt = now();
        job.error = { code: 'RUNTIME_RESTARTED', message: 'Execution was interrupted. Inspect the receipt and outputs before an explicit new request; it was not replayed.' };
        job.outputs = this.remoteReceipt(job);
      }
      this.save(this.registry);
    } catch (error) { this.releaseLock(); throw error; }
  }
  acquireLock() {
    this.lockIdentity = { pid: process.pid, identity: processIdentity(process.pid), nonce: crypto.randomUUID() };
    const write = () => fs.writeFileSync(this.lock, JSON.stringify(this.lockIdentity), { flag: 'wx', mode: 0o600 });
    try { write(); return; } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const recovery = path.join(this.directory, 'lock-recovery');
    try { fs.mkdirSync(recovery, { mode: 0o700 }); } catch { fail('CREATIVE_STATE_BUSY', 'Another creative controller owns or is recovering this state directory.', 503); }
    try {
      const saved = readJson(this.lock, 1024, true);
      if (!Number.isSafeInteger(saved.pid) || saved.pid < 1) fail('CREATIVE_STATE_BUSY', 'The creative owner lock requires local review.', 503);
      const identity = processIdentity(saved.pid);
      const reused = typeof saved.identity === 'string' && identity !== null && identity !== saved.identity;
      if (!reused) {
        try { process.kill(saved.pid, 0); fail('CREATIVE_STATE_BUSY', 'Another creative controller owns this state directory.', 503); }
        catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
      fs.unlinkSync(this.lock);
      try { write(); } catch { fail('CREATIVE_STATE_BUSY', 'Another creative controller acquired this state directory.', 503); }
    } finally { fs.rmdirSync(recovery); }
  }
  releaseLock() {
    try { if (readJson(this.lock, 1024, true).nonce === this.lockIdentity.nonce) fs.unlinkSync(this.lock); } catch { /* A changed lock is never removed. */ }
  }
  readRegistry() {
    if (!fs.existsSync(this.file)) return { schemaVersion: 1, assignments: [], jobs: [], receipts: [] };
    let state;
    try { state = readJson(this.file, MAX_REGISTRY_BYTES, true); } catch { fail('CREATIVE_STATE_INVALID', 'The creative registry requires local review.', 503); }
    if (!plain(state) || state.schemaVersion !== 1 || !['assignments', 'jobs', 'receipts'].every(key => Array.isArray(state[key]) && state[key].length <= MAX_RECORDS)) {
      fail('CREATIVE_STATE_INVALID', 'The creative registry requires local review.', 503);
    }
    const jobIds = new Set(); const receiptIds = new Set();
    const validAssignment = row => plain(row) && [row.companyId, row.employeeId, row.projectId].every(value => typeof value === 'string' && ID.test(value))
      && Array.isArray(row.toolIds) && row.toolIds.length <= Object.keys(TOOL_OPERATIONS).length && new Set(row.toolIds).size === row.toolIds.length
      && row.toolIds.every(id => Object.hasOwn(TOOL_OPERATIONS, id)) && validTimestamp(row.updatedAt);
    const assignmentIds = new Set();
    for (const row of state.assignments) {
      const identity = `${row?.companyId}:${row?.employeeId}:${row?.projectId}`;
      if (!validAssignment(row) || assignmentIds.has(identity)) fail('CREATIVE_STATE_INVALID', 'Stored creative assignments require review.', 503);
      assignmentIds.add(identity);
    }
    for (const row of state.jobs) {
      if (!plain(row) || ![row.id, row.companyId, row.employeeId, row.projectId].every(value => typeof value === 'string' && ID.test(value))
        || !OPERATIONS.includes(row.operation) || !['queued', 'running', ...TERMINAL].includes(row.status) || jobIds.has(row.id)
        || !/^[a-f0-9]{32}$/.test(row.storageId) || !Array.isArray(row.outputs) || row.outputs.length > 8 || !plain(row.input)
        || !validTimestamp(row.createdAt) || (row.startedAt !== undefined && !validTimestamp(row.startedAt)) || (row.finishedAt !== undefined && !validTimestamp(row.finishedAt))
        || row.outputs.some(output => !plain(output) || !/^[a-z][a-z0-9.-]{0,79}$/.test(output.path) || !/^[a-f0-9]{64}$/.test(output.sha256)
          || !Number.isSafeInteger(output.bytes) || output.bytes < 0 || output.bytes > 104857600 || !['application/json', 'image/png', 'image/jpeg', 'model/gltf-binary'].includes(output.mediaType))
        || (row.error && (!plain(row.error) || !/^[A-Z_]{1,80}$/.test(row.error.code) || typeof row.error.message !== 'string' || row.error.message.length > 512 || /[\\/\x00-\x1f]/.test(row.error.message)))) fail('CREATIVE_STATE_INVALID', 'Stored creative jobs require review.', 503);
      operationInput(row.operation, row.input); jobIds.add(row.id);
    }
    for (const row of state.receipts) {
      if (!plain(row) || !ID.test(row.id) || !/^[a-f0-9]{64}$/.test(row.digest) || !['assign', 'run', 'cancel'].includes(row.kind) || receiptIds.has(row.id)
        || (row.kind !== 'assign' && !jobIds.has(row.jobId)) || (row.kind === 'run' && row.id !== row.jobId)
        || (row.kind === 'assign' && !validAssignment(row.assignment))) fail('CREATIVE_STATE_INVALID', 'Stored creative receipts require review.', 503);
      receiptIds.add(row.id);
    }
    return state;
  }
  save(state) {
    const contents = JSON.stringify(state);
    if (Buffer.byteLength(contents) > MAX_REGISTRY_BYTES || ['jobs', 'assignments', 'receipts'].some(key => state[key].length > MAX_RECORDS)) {
      fail('CREATIVE_CAPACITY', 'Creative history is full. Export and review it locally; no receipts were evicted.', 409);
    }
    const temporary = `${this.file}.${crypto.randomUUID()}.tmp`;
    let fd;
    try {
      fd = fs.openSync(temporary, 'wx', 0o600); fs.writeFileSync(fd, contents); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      fs.renameSync(temporary, this.file);
      if (process.platform !== 'win32') { const dir = fs.openSync(this.directory, 'r'); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); } }
    } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  commit(change) { const next = copy(this.registry); const result = change(next); this.save(next); this.registry = next; return result; }
  serial(work, allowClosed = false) {
    const pending = this.chain.then(() => { if (this.closed && !allowClosed) fail('CREATIVE_CLOSED', 'The creative controller is stopping.', 503); return work(); });
    this.chain = pending.catch(() => undefined); return pending;
  }
  config() { return readCreativeConfig(this.configFile); }
  async office() {
    let result; try { result = await this.nativeSnapshot(); } catch { /* Never expose native exception paths. */ }
    if (!result?.ok || !plain(result.snapshot) || !['companies', 'employees', 'offices', 'departments'].every(key => Array.isArray(result.snapshot[key]))) {
      fail('CREATIVE_SCOPE_UNAVAILABLE', 'Fresh native scope state is unavailable.', 503);
    }
    return result.snapshot;
  }
  scope(snapshot, companyId, employeeId, project, active = true) {
    const company = snapshot.companies.find(row => row.id === companyId);
    if (!company || (active && company.status !== 'active')) fail('CREATIVE_SCOPE_DENIED', 'The requested company is unavailable or paused.', 403);
    if (!employeeId) return { company };
    const employee = snapshot.employees.find(row => row.id === employeeId);
    const donna = employee?.id === 'donna' && employee.kind === 'assistant' && employee.companyId === null && employee.officeId === null && employee.departmentId === null;
    if (!employee || (!donna && employee.companyId !== companyId) || (active && employee.status !== 'active')) fail('CREATIVE_SCOPE_DENIED', 'The employee is outside this active company scope.', 403);
    const office = employee.officeId ? snapshot.offices.find(row => row.id === employee.officeId && row.companyId === companyId) : undefined;
    if (employee.officeId && (!office || (active && office.status !== 'active'))) fail('CREATIVE_SCOPE_DENIED', 'The employee office is unavailable or paused.', 403);
    const departmentId = project?.departmentId ?? employee.departmentId;
    if (project?.departmentId && employee.departmentId && employee.departmentId !== project.departmentId) fail('CREATIVE_SCOPE_DENIED', 'The project is assigned to a different department.', 403);
    let department = departmentId ? snapshot.departments.find(row => row.id === departmentId && row.companyId === companyId) : undefined;
    if (departmentId && !department) fail('CREATIVE_SCOPE_DENIED', 'The project department is unavailable.', 403);
    if (department && office && department.officeId !== office.id) fail('CREATIVE_SCOPE_DENIED', 'The project is outside the employee office.', 403);
    const seen = new Set(); let cursor = department;
    while (cursor) {
      if (seen.has(cursor.id) || seen.size > snapshot.departments.length || (active && cursor.status !== 'active')) fail('CREATIVE_SCOPE_DENIED', 'The department hierarchy is unavailable or paused.', 403);
      seen.add(cursor.id);
      const parentOffice = snapshot.offices.find(row => row.id === cursor.officeId && row.companyId === companyId);
      if (!parentOffice || (active && parentOffice.status !== 'active')) fail('CREATIVE_SCOPE_DENIED', 'The project office is unavailable or paused.', 403);
      const parentId = cursor.parentDepartmentId;
      if (!parentId) break;
      const parent = snapshot.departments.find(row => row.id === parentId && row.companyId === companyId && row.officeId === cursor.officeId);
      if (!parent) fail('CREATIVE_SCOPE_DENIED', 'The department hierarchy is invalid.', 403);
      cursor = parent;
    }
    return { company, employee, office, department };
  }
  grant(snapshot, context) {
    const grants = snapshot.authority?.grants;
    if (!Array.isArray(grants)) fail('CREATIVE_AUTHORITY_DENIED', 'Grant current scoped creative.execute authority before running a tool.', 403);
    const clock = Date.now();
    const current = row => plain(row) && row.revokedAt == null && Number.isFinite(Date.parse(row.grantedAt)) && Date.parse(row.grantedAt) <= clock && Date.parse(row.expiresAt) > clock;
    const contains = scope => scope?.kind === 'company' ? scope.id === context.company.id : scope?.kind === 'department' ? scope.id === context.department?.id
      : scope?.kind === 'office' ? scope.id === (context.department?.officeId ?? context.office?.id)
      : scope?.kind === 'employee' ? scope.id === context.employee.id : false;
    const chain = row => {
      const ids = row.parentGrantIds ?? [];
      if (!Array.isArray(ids) || new Set(ids).size !== ids.length) return false;
      if (row.issuer === 'owner') return ids.length === 0;
      if (row.issuer !== 'donna' || row.employeeId === 'donna' || ids.length === 0) return false;
      const parents = ids.map(id => grants.find(parent => parent.id === id));
      return parents.every(parent => current(parent) && parent.issuer === 'owner' && parent.employeeId === 'donna'
        && (parent.parentGrantIds ?? []).length === 0 && contains(parent.scope) && Date.parse(parent.expiresAt) >= Date.parse(row.expiresAt))
        && ['authority.manage', ...row.capabilities].every(capability => parents.some(parent => parent.capabilities?.includes(capability)));
    };
    const allowed = grants.some(row => current(row) && row.employeeId === context.employee.id && Array.isArray(row.capabilities) && row.capabilities.includes('creative.execute') && contains(row.scope) && chain(row));
    if (!allowed) fail('CREATIVE_AUTHORITY_DENIED', 'Current creative.execute authority is missing, expired, revoked or outside this project scope.', 403);
  }
  project(config, companyId, projectId) {
    const project = config.projects.find(row => row.id === projectId && row.companyId === companyId);
    if (!project) fail('CREATIVE_PROJECT_DENIED', 'The project is not configured for this company.', 403);
    return project;
  }
  inputFile(project, input, limits) {
    const root = noLinks(project.root, { directory: true }).filename;
    const filename = path.resolve(root, relativeInput(input.path));
    if (!filename.startsWith(root + path.sep)) fail('PATH_DENIED', 'Creative input must remain inside its reviewed project.', 403);
    const typeLimit = path.extname(input.path).toLowerCase() === '.svg' ? 8 * 1024 * 1024 : path.extname(input.path).toLowerCase() === '.uproject' ? 1024 * 1024 : limits.maxInputBytes;
    return noLinks(filename, { maxBytes: Math.min(limits.maxInputBytes, typeLimit) });
  }
  async authorize(job, internal = {}) {
    if (internal.signal?.aborted) fail('CREATIVE_CANCELLED', 'Creative execution was cancelled.', 409);
    const config = this.config(); const project = this.project(config, job.companyId, job.projectId);
    const toolId = Object.keys(TOOL_OPERATIONS).find(id => TOOL_OPERATIONS[id].includes(job.operation));
    const configurationDigest = digest({ project, tool: config.tools[toolId] ?? null, limits: config.limits });
    if (job.configurationDigest && job.configurationDigest !== configurationDigest) fail('CREATIVE_CONFIGURATION_CHANGED', 'The reviewed tool or project configuration changed. Inspect the original job before a new request.', 409);
    if (!config.tools[toolId] || !project.allowedOperations.includes(job.operation)) fail('OPERATION_DENIED', 'This operation is not enabled for the reviewed project.', 403);
    const snapshot = await this.office(); const context = this.scope(snapshot, job.companyId, job.employeeId, project); this.grant(snapshot, context);
    const assignment = this.registry.assignments.find(row => row.companyId === job.companyId && row.employeeId === job.employeeId && row.projectId === job.projectId);
    if (!assignment?.toolIds.includes(toolId)) fail('CREATIVE_NOT_ASSIGNED', 'Assign this tool and reviewed project to the employee first.', 403);
    noLinks(project.root, { directory: true });
    if (toolId === 'adobe-photoshop' && (project.allowExternalUpload !== true || config.tools[toolId].enabled !== true || config.tools[toolId].allowPaidRequests !== true)) {
      fail('EXTERNAL_UPLOAD_DENIED', 'The owner must explicitly enable this project upload and licensed API billing before remote execution.', 403);
    }
    if (toolId === 'adobe-photoshop') for (const filename of [config.tools[toolId].clientIdFile, config.tools[toolId].clientSecretFile, config.tools[toolId].assetStorageFile]) {
      noLinks(filename, { privateFile: true, maxBytes: 16384 });
    }
    if (internal.authorize) {
      try { if (await internal.authorize() === false) throw new Error('denied'); }
      catch { fail('CREATIVE_AUTHORITY_DENIED', 'The native worker no longer authorizes this creative execution.', 403); }
    }
    return { config, project, toolId, configurationDigest };
  }
  receipt(kind, request) {
    const fingerprint = digest({ kind, request }); const saved = this.registry.receipts.find(row => row.id === request.id);
    if (saved && (saved.kind !== kind || saved.digest !== fingerprint)) fail('CREATIVE_RECEIPT_MISMATCH', 'This command id already belongs to a different creative request. Preserve the original id and body.', 409);
    return { saved, fingerprint };
  }
  publicJob(job) {
    return { id: job.id, companyId: job.companyId, employeeId: job.employeeId, projectId: job.projectId, operation: job.operation,
      status: job.status, createdAt: job.createdAt, ...(job.startedAt ? { startedAt: job.startedAt } : {}), ...(job.finishedAt ? { finishedAt: job.finishedAt, evidenceUri: `creative://jobs/${job.id}` } : {}),
      outputs: job.outputs.map(row => ({ path: row.path, bytes: row.bytes, sha256: row.sha256, mediaType: row.mediaType })),
      ...(job.result ? { result: safeResult(job.result) } : {}), ...(job.error ? { error: safeError(new CreativeToolsError(job.error.code, job.error.message)) } : {}) };
  }
  publicAssignment(row) {
    return { companyId: row.companyId, employeeId: row.employeeId, projectId: row.projectId, toolIds: [...row.toolIds], updatedAt: row.updatedAt };
  }
  async snapshot(request) {
    fields(request, ['companyId', 'employeeId'], ['companyId']); identifier(request.companyId); if (request.employeeId !== undefined) identifier(request.employeeId);
    if (this.closed) fail('CREATIVE_CLOSED', 'The creative controller is stopping.', 503);
    const config = this.config(); const snapshot = await this.office(); this.scope(snapshot, request.companyId, request.employeeId, undefined, false);
    const tools = await Promise.all(Object.keys(TOOL_OPERATIONS).map(id => this.probe(id, config.tools[id])));
    const matches = row => row.companyId === request.companyId && (!request.employeeId || row.employeeId === request.employeeId);
    const eligibleEmployees = snapshot.employees.filter(employee => {
      if (request.employeeId && employee.id !== request.employeeId) return false;
      try { this.scope(snapshot, request.companyId, employee.id); return true; } catch { return false; }
    }).map(employee => ({ id: employee.id, name: employee.name, role: employee.role, departmentId: employee.departmentId, status: employee.status }));
    return { ok: true, companyId: request.companyId, ...(request.employeeId ? { employeeId: request.employeeId } : {}), configured: !!this.configFile, tools,
      projects: config.projects.filter(row => row.companyId === request.companyId).map(row => ({ id: row.id, companyId: row.companyId,
        ...(row.departmentId ? { departmentId: row.departmentId } : {}), ...(row.repository ? { repository: row.repository } : {}), allowedOperations: [...row.allowedOperations], allowExternalUpload: row.allowExternalUpload === true })),
      assignments: this.registry.assignments.filter(matches).map(row => this.publicAssignment(row)), jobs: this.registry.jobs.filter(matches).slice(-100).map(row => this.publicJob(row)), eligibleEmployees, limits: config.limits };
  }
  assign(request) {
    return this.serial(async () => {
      fields(request, ['id', 'companyId', 'employeeId', 'projectId', 'toolIds']); for (const key of ['id', 'companyId', 'employeeId', 'projectId']) identifier(request[key]);
      if (!Array.isArray(request.toolIds) || request.toolIds.length > Object.keys(TOOL_OPERATIONS).length || new Set(request.toolIds).size !== request.toolIds.length || request.toolIds.some(id => !Object.hasOwn(TOOL_OPERATIONS, id))) fail('INVALID_REQUEST', 'Choose distinct implemented creative tools.');
      const { saved, fingerprint } = this.receipt('assign', request);
      if (saved) {
        this.scope(await this.office(), request.companyId, request.employeeId, undefined, false);
        return { ok: true, assignment: this.publicAssignment(saved.assignment), replayed: true };
      }
      const config = this.config(); const project = this.project(config, request.companyId, request.projectId);
      this.scope(await this.office(), request.companyId, request.employeeId, project, !saved && request.toolIds.length > 0);
      if (request.toolIds.some(id => !config.tools[id] || !TOOL_OPERATIONS[id].some(operation => project.allowedOperations.includes(operation)))) fail('OPERATION_DENIED', 'A selected tool is not configured for this project.', 403);
      if (request.toolIds.length) noLinks(project.root, { directory: true });
      const assignment = { companyId: request.companyId, employeeId: request.employeeId, projectId: request.projectId, toolIds: [...request.toolIds], updatedAt: now() };
      this.commit(state => {
        const index = state.assignments.findIndex(row => row.companyId === request.companyId && row.employeeId === request.employeeId && row.projectId === request.projectId);
        if (index < 0) state.assignments.push(assignment); else state.assignments[index] = assignment;
        state.receipts.push({ id: request.id, kind: 'assign', digest: fingerprint, assignment });
      });
      return { ok: true, assignment: copy(assignment), replayed: false };
    });
  }
  run(request, internal = {}) {
    return this.serial(async () => {
      fields(request, ['id', 'companyId', 'employeeId', 'projectId', 'operation', 'input']); for (const key of ['id', 'companyId', 'employeeId', 'projectId']) identifier(request[key]);
      const input = operationInput(request.operation, request.input);
      if (internal.authorize !== undefined && typeof internal.authorize !== 'function') fail('INVALID_REQUEST', 'The internal authority callback must be callable.');
      const { saved, fingerprint } = this.receipt('run', request);
      if (saved) { this.scope(await this.office(), request.companyId, request.employeeId, undefined, false); return { ok: true, accepted: true, replayed: true, job: this.publicJob(this.registry.jobs.find(row => row.id === saved.jobId)) }; }
      const candidate = { ...request, input }; const { config, project, configurationDigest } = await this.authorize(candidate, internal);
      if (this.registry.jobs.filter(row => !TERMINAL.has(row.status)).length >= config.limits.maxConcurrentJobs + config.limits.maxQueuedJobs) fail('CREATIVE_BUSY', 'Creative execution capacity is full. Retry this same request id and body later.', 429);
      const { info } = this.inputFile(project, input, config.limits);
      const job = { ...candidate, configurationDigest, status: 'queued', createdAt: now(), storageId: crypto.randomBytes(16).toString('hex'), outputs: [],
        inputIdentity: { dev: info.dev, ino: info.ino, size: info.size, mtimeMs: info.mtimeMs } };
      this.commit(state => { state.jobs.push(job); state.receipts.push({ id: request.id, kind: 'run', digest: fingerprint, jobId: job.id }); });
      this.options.set(job.id, internal); queueMicrotask(() => this.pump());
      return { ok: true, accepted: true, replayed: false, job: this.publicJob(job) };
    });
  }
  async job(request) {
    fields(request, ['companyId', 'jobId']); identifier(request.companyId); identifier(request.jobId);
    this.scope(await this.office(), request.companyId, undefined, undefined, false);
    const job = this.registry.jobs.find(row => row.id === request.jobId && row.companyId === request.companyId);
    if (!job) fail('CREATIVE_JOB_NOT_FOUND', 'This creative job is not in the requested company.', 404);
    return { ok: true, job: this.publicJob(job) };
  }
  cancel(request) {
    return this.serial(async () => {
      fields(request, ['id', 'companyId', 'jobId']); for (const key of ['id', 'companyId', 'jobId']) identifier(request[key]);
      const { saved, fingerprint } = this.receipt('cancel', request);
      this.scope(await this.office(), request.companyId, undefined, undefined, false);
      const job = this.registry.jobs.find(row => row.id === request.jobId && row.companyId === request.companyId);
      if (!job) fail('CREATIVE_JOB_NOT_FOUND', 'This creative job is not in the requested company.', 404);
      if (!saved) this.commit(state => {
        const row = state.jobs.find(row => row.id === job.id);
        if (!TERMINAL.has(row.status)) { row.status = 'cancelled'; row.finishedAt = now(); row.error = { code: 'CREATIVE_CANCELLED', message: 'The owner cancelled this creative operation.' }; }
        state.receipts.push({ id: request.id, kind: 'cancel', digest: fingerprint, jobId: job.id });
      });
      this.running.get(job.id)?.controller.abort(new CreativeToolsError('CREATIVE_CANCELLED', 'The owner cancelled this creative operation.', 409));
      return { ok: true, replayed: !!saved, job: this.publicJob(this.registry.jobs.find(row => row.id === job.id)) };
    });
  }
  async prepareWorker(job) {
    identifier(job.companyId); identifier(job.employeeId);
    const inventory = await this.snapshot({ companyId: job.companyId, employeeId: job.employeeId });
    const native = await this.office(); const config = this.config();
    const tools = inventory.tools.filter(tool => tool.available);
    const assignments = inventory.assignments.filter(assignment => assignment.toolIds.some(id => tools.some(tool => tool.id === id)));
    const projects = inventory.projects.flatMap(project => {
      const assignment = assignments.find(row => row.projectId === project.id);
      if (!assignment) return [];
      try {
        const configured = this.project(config, job.companyId, project.id);
        noLinks(configured.root, { directory: true });
        if (job.departmentId && configured.departmentId !== job.departmentId) return [];
        if (job.officeId && configured.departmentId && !native.departments.some(row => row.id === configured.departmentId && row.officeId === job.officeId && row.companyId === job.companyId)) return [];
        this.grant(native, this.scope(native, job.companyId, job.employeeId, configured));
        const allowedOperations = project.allowedOperations.filter(operation => tools.some(tool => assignment.toolIds.includes(tool.id) && tool.operations.includes(operation)
          && (tool.id !== 'adobe-photoshop' || configured.allowExternalUpload === true)));
        return allowedOperations.length ? [{ ...project, allowedOperations }] : [];
      } catch { return []; }
    });
    if (!projects.length) fail('CREATIVE_NOT_READY', 'Configure an available tool, reviewed project assignment and current creative.execute grant before dispatch.', 409);
    return { projects, tools, assignments: assignments.filter(row => projects.some(project => project.id === row.projectId)) };
  }
  childEnvironment(directory) {
    return { PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8',
      HOME: directory, TMPDIR: directory, TEMP: directory, TMP: directory, XDG_CONFIG_HOME: directory,
      XDG_CACHE_HOME: directory, XDG_DATA_HOME: directory, PYTHONNOUSERSITE: '1', PYTHONDONTWRITEBYTECODE: '1', OMP_NUM_THREADS: '2',
      BLENDER_USER_CONFIG: directory, BLENDER_USER_SCRIPTS: directory, BLENDER_USER_EXTENSIONS: directory };
  }
  executeProcess(executable, args, { directory, signal, durationMs, outputBytes, memoryBytes = DEFAULT_LIMITS.maxMemoryBytes, artifactBytes = DEFAULT_LIMITS.maxArtifactBytes, gpuMemory = false }) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(signal.reason ?? new CreativeToolsError('CREATIVE_CANCELLED', 'Creative execution was cancelled.', 409)); return; }
      let child; let settled = false; let reason; let count = 0; let stdout = ''; let stderr = ''; let killTimer; let hardTimer;
      const stop = error => {
        reason ??= error;
        const kill = force => {
          if (!child?.pid) return;
          try { if (process.platform !== 'win32') process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM'); else child.kill(force ? 'SIGKILL' : 'SIGTERM'); } catch { /* It may already have exited. */ }
        };
        kill(false); killTimer ??= setTimeout(() => kill(true), 150);
        hardTimer ??= setTimeout(() => { kill(true); child?.stdout?.destroy(); child?.stderr?.destroy(); child?.unref?.(); finish(reason); }, 2000);
      };
      const abort = () => stop(signal.reason instanceof CreativeToolsError ? signal.reason : new CreativeToolsError('CREATIVE_CANCELLED', 'Creative execution was cancelled.', 409));
      const timer = setTimeout(() => stop(new CreativeToolsError('CREATIVE_TIMEOUT', 'The creative operation exceeded its configured duration.', 408)), durationMs);
      const finish = (error, code) => {
        if (settled) return; settled = true;
        clearTimeout(timer); clearTimeout(killTimer); clearTimeout(hardTimer); signal?.removeEventListener('abort', abort);
        if (error || reason) reject(error ?? reason);
        else if (code !== 0 && stderr.split(/\r?\n/).includes('DAFTAR_GUARD_ERROR=GPU_CGROUP_REQUIRED')) reject(new CreativeToolsError('GPU_MEMORY_PREREQUISITE', 'GPU rendering requires a verified cgroup-v2 memory.max no larger than the configured maxMemoryBytes. Configure the bounded GPU host before retrying; no CPU fallback was used.', 503));
        else if (code !== 0 && stderr.split(/\r?\n/).includes('DAFTAR_DEVICE_ERROR=GPU_DEVICE_UNAVAILABLE')) reject(new CreativeToolsError('GPU_DEVICE_UNAVAILABLE', 'The configured Blender GPU backend or device is unavailable. No CPU fallback was used.', 503));
        else if (code !== 0) reject(new CreativeToolsError('TOOL_EXIT_FAILED', 'The configured tool did not complete successfully. Its private console output was not published.', 422));
        else resolve({ stdout, stderr });
      };
      try {
        const executableInfo = noLinks(executable).info;
        if (executableInfo.mode & 0o6000) fail('TOOL_UNAVAILABLE', 'Set-id executables are not permitted for creative tools.', 503);
        if (process.platform !== 'linux') fail('CREATIVE_PLATFORM_UNSUPPORTED', 'Managed creative execution currently requires a Linux runtime.', 503);
        const guard = path.join(this.repoRoot, 'integrations/creative-tools/process_guard.py'); noLinks(guard);
        const python = fs.realpathSync('/usr/bin/python3'); noLinks(python);
        const guardedArgs = ['-B', '-I', guard, String(process.pid), String(Math.ceil(durationMs / 1000) + 1), String(memoryBytes), String(artifactBytes), ...(gpuMemory ? ['--gpu-cgroup'] : []), executable, ...args];
        child = this.spawnImpl(python, guardedArgs, { cwd: directory, env: this.childEnvironment(directory), shell: false,
          detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        signal?.addEventListener('abort', abort, { once: true });
        for (const [stream, name] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) stream.on('data', data => {
          count += Buffer.byteLength(data);
          if (count > outputBytes) { stop(new CreativeToolsError('CREATIVE_OUTPUT_LIMIT', 'The tool exceeded its bounded console output.', 413)); return; }
          if (name === 'stdout') stdout += data.toString(); else stderr += data.toString();
        });
        child.once('error', () => finish(new CreativeToolsError('TOOL_UNAVAILABLE', 'The configured executable could not be started.', 503)));
        child.once('close', code => {
          // A tool may leave descendants after exiting. They must not continue
          // changing artifacts after the receipt is finalized.
          if (process.platform !== 'win32' && child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* No remaining group. */ } }
          finish(undefined, code);
        });
        if (signal?.aborted) abort();
      } catch (error) { finish(error instanceof CreativeToolsError ? error : new CreativeToolsError('TOOL_UNAVAILABLE', 'The configured executable is unavailable.', 503)); }
    });
  }
  async probe(id, config) {
    const base = { id, operations: [...TOOL_OPERATIONS[id]], configured: !!config, available: false,
      ...(id === 'blender' && config ? { renderDevice: config.renderDevice ?? 'CPU', renderDeviceIndex: config.renderDeviceIndex ?? 0,
        renderDeviceVerified: false, notice: 'Version discovery does not verify render-device availability; inspect a completed render receipt.' } : {}) };
    if (!config) return { ...base, readiness: 'not_configured', reason: 'TOOL_NOT_CONFIGURED' };
    if (id === 'adobe-photoshop') {
      try {
        if (config.enabled !== true || config.allowPaidRequests !== true) throw new Error('disabled');
        for (const filename of [config.clientIdFile, config.clientSecretFile, config.assetStorageFile]) noLinks(filename, { privateFile: true, maxBytes: 16384 });
        noLinks(path.join(this.repoRoot, 'integrations/adobe/photoshop-api.mjs'));
        return { ...base, available: true, readiness: 'configured_unverified', remoteAuthVerified: false,
          notice: 'Local API configuration is present. Remote authentication, licensing, billing and execution have not been verified.' };
      } catch { return { ...base, readiness: 'unavailable', remoteAuthVerified: false, reason: 'TOOL_CONFIGURATION_UNAVAILABLE' }; }
    }
    let key;
    try { const { info } = noLinks(config.executable); key = `${id}:${config.executable}:${info.ino}:${info.size}:${info.mtimeMs}:${config.renderDevice ?? 'CPU'}:${config.renderDeviceIndex ?? 0}`; }
    catch { return { ...base, readiness: 'unavailable', reason: 'TOOL_EXECUTABLE_UNAVAILABLE' }; }
    const prior = this.probes.get(key);
    if (prior && Date.now() - prior.at < 30000) return copy(await prior.promise);
    const promise = (this.probeChain ?? Promise.resolve()).then(async () => {
      if (this.closed) return { ...base, readiness: 'unavailable', reason: 'CREATIVE_CLOSED' };
      const directory = path.join(this.directory, `probe-${crypto.randomUUID()}`); privateDirectory(directory);
      const controller = new AbortController(); this.probeController = controller;
      try {
        const args = id === 'unreal' ? ['-version', '-unattended', '-NullRHI', '-NoSplash', '-NoSound'] : [id === 'ffmpeg' ? '-version' : '--version'];
        const result = await this.executeProcess(config.executable, args, { directory, signal: controller.signal, durationMs: 5000, outputBytes: 32768 });
        const text = result.stdout + '\n' + result.stderr;
        const patterns = { blender: /Blender\s+(\d+\.\d+(?:\.\d+)?)/i, inkscape: /Inkscape\s+(\d+\.\d+(?:\.\d+)?)/i,
          ffmpeg: /ffprobe version\s+([A-Za-z0-9._+-]{1,40})/i, unreal: /(?:Unreal Engine|Engine Version|UnrealEditor)\D{0,12}(\d+\.\d+(?:\.\d+)?)/i };
        const version = text.match(patterns[id])?.[1];
        if (!version) return { ...base, readiness: 'unavailable', reason: 'TOOL_PROBE_UNRECOGNIZED' };
        return { ...base, available: true, readiness: 'verified', version };
      } catch { return { ...base, readiness: 'unavailable', reason: 'TOOL_PROBE_FAILED' }; }
      finally { if (this.probeController === controller) this.probeController = null; fs.rmSync(directory, { recursive: true, force: true }); }
    });
    this.probeChain = promise.catch(() => undefined); this.probes.set(key, { at: Date.now(), promise });
    if (this.probes.size > 20) this.probes.delete(this.probes.keys().next().value);
    return copy(await promise);
  }
  pump() {
    if (this.closed || this.pumping) return;
    this.pumping = true;
    this.serial(() => {
      const config = this.config();
      while (this.running.size < config.limits.maxConcurrentJobs) {
        const job = this.registry.jobs.find(row => row.status === 'queued'); if (!job) break;
        const controller = new AbortController();
        this.commit(state => { const row = state.jobs.find(row => row.id === job.id); row.status = 'running'; row.startedAt = now(); });
        const execution = { controller, promise: null }; this.running.set(job.id, execution);
        execution.promise = Promise.resolve().then(() => this.executeJob(job.id, controller)).finally(() => {
          this.running.delete(job.id); this.options.delete(job.id); queueMicrotask(() => this.pump());
        });
        // Durable completion records carry failures; no unhandled rejection may stop other jobs.
        execution.promise.catch(() => undefined);
      }
    }).catch(error => this.serial(() => {
      if (!this.registry.jobs.some(job => job.status === 'queued')) return;
      this.commit(state => { for (const job of state.jobs) if (job.status === 'queued') {
        job.status = 'failed'; job.finishedAt = now(); job.error = safeError(error);
      } });
    }, true).catch(() => { /* Failed storage remains an interrupted receipt on restart. */ }))
      .finally(() => { this.pumping = false; });
  }
  copyInput(project, input, limits, identity, destination) {
    const { filename, info } = this.inputFile(project, input, limits);
    if (!identity || ['dev', 'ino', 'size', 'mtimeMs'].some(key => info[key] !== identity[key])) fail('CREATIVE_INPUT_CHANGED', 'The project input changed after admission. Review it before a new explicit request.', 409);
    const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0)); let output;
    try {
      const opened = fs.fstatSync(fd);
      if (['dev', 'ino', 'size', 'mtimeMs'].some(key => opened[key] !== identity[key])) fail('CREATIVE_INPUT_CHANGED', 'The project input changed during admission.', 409);
      output = fs.openSync(destination, 'wx', 0o600); const buffer = Buffer.alloc(65536); let total = 0; let count;
      while ((count = fs.readSync(fd, buffer)) > 0) {
        total += count; if (total > limits.maxInputBytes) fail('CREATIVE_INPUT_LIMIT', 'The input exceeded the configured size limit.', 413);
        fs.writeSync(output, buffer, 0, count);
      }
      const after = fs.fstatSync(fd);
      if (after.size !== total || after.mtimeMs !== identity.mtimeMs) fail('CREATIVE_INPUT_CHANGED', 'The project input changed while it was copied.', 409);
      fs.fsyncSync(output);
      return filename;
    } finally { fs.closeSync(fd); if (output !== undefined) fs.closeSync(output); }
  }
  artifactFiles(directory, limits, allowed) {
    noLinks(directory, { directory: true });
    const names = fs.readdirSync(directory);
    if (names.length > 8 || names.some(name => !allowed.includes(name))) fail('CREATIVE_ARTIFACT_INVALID', 'The tool produced an unexpected output file.', 422);
    let total = 0;
    return names.sort().map(name => {
      const filename = path.join(directory, name); const { info } = noLinks(filename, { maxBytes: limits.maxArtifactBytes });
      total += info.size; if (total > limits.maxArtifactBytes) fail('CREATIVE_ARTIFACT_LIMIT', 'Tool artifacts exceeded the configured byte limit.', 413);
      const hash = crypto.createHash('sha256'); const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
      try { const buffer = Buffer.alloc(65536); let count; while ((count = fs.readSync(fd, buffer)) > 0) hash.update(buffer.subarray(0, count)); }
      finally { fs.closeSync(fd); }
      return { path: name, bytes: info.size, sha256: hash.digest('hex'), mediaType: name.endsWith('.png') ? 'image/png' : name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.glb') ? 'model/gltf-binary' : 'application/json' };
    });
  }
  async executeJob(jobId, controller) {
    const job = this.registry.jobs.find(row => row.id === jobId); const options = this.options.get(jobId) ?? {};
    const abort = () => controller.abort(new CreativeToolsError('CREATIVE_CANCELLED', 'The native worker cancelled this creative operation.', 409));
    options.signal?.addEventListener('abort', abort, { once: true }); if (options.signal?.aborted) abort();
    let timer; let monitor; let busy = false; let directory;
    try {
      const current = () => this.authorize(job, { ...options, signal: controller.signal });
      const { config, project, toolId } = await current();
      const limits = config.limits; directory = path.join(this.directory, 'artifacts', job.storageId); privateDirectory(directory);
      const outputDir = path.join(directory, 'outputs'); privateDirectory(outputDir);
      const temporary = path.join(directory, 'temporary'); privateDirectory(temporary);
      const inputPath = path.join(temporary, 'input' + path.extname(job.input.path).toLowerCase());
      const originalPath = this.copyInput(project, job.input, limits, job.inputIdentity, inputPath);
      timer = setTimeout(() => controller.abort(new CreativeToolsError('CREATIVE_TIMEOUT', 'The creative operation exceeded its configured duration.', 408)), limits.maxDurationMs);
      const expected = job.operation === 'blender.inspect' ? ['inspection.json'] : job.operation === 'blender.render' ? ['render.png'] : job.operation === 'blender.export_glb' ? ['scene.glb']
        : job.operation === 'unreal.inspect' ? ['project.json'] : job.operation === 'unreal.validate' ? ['validation.json'] : job.operation === 'inkscape.export_png' ? ['render.png']
        : job.operation === 'ffmpeg.probe' ? ['media.json'] : job.operation === 'adobe.manifest' ? ['manifest.json', 'adobe-receipt.json'] : [job.input.format === 'jpeg' ? 'render.jpg' : 'render.png', 'adobe-receipt.json'];
      monitor = setInterval(async () => {
        if (busy || controller.signal.aborted) return; busy = true;
        try {
          await current();
          const names = fs.readdirSync(outputDir); let bytes = 0;
          if (names.length > 8) fail('CREATIVE_ARTIFACT_LIMIT', 'Tool artifact count exceeded the configured limit.', 413);
          for (const name of names) { const { info } = noLinks(path.join(outputDir, name)); bytes += info.size; }
          if (bytes > limits.maxArtifactBytes) fail('CREATIVE_ARTIFACT_LIMIT', 'Tool artifacts exceeded the configured byte limit.', 413);
        } catch (error) { controller.abort(error); }
        finally { busy = false; }
      }, 500);
      const processOptions = { directory: temporary, signal: controller.signal, durationMs: limits.maxDurationMs, outputBytes: limits.maxOutputBytes, memoryBytes: limits.maxMemoryBytes, artifactBytes: limits.maxArtifactBytes };
      let result;
      await current();
      if (toolId === 'blender') {
        const helper = path.join(this.repoRoot, 'integrations/creative-tools/blender_worker.py'); noLinks(helper);
        noLinks(path.join(this.repoRoot, 'integrations/creative-tools/blender_device.py'));
        const renderPolicy = { backend: config.tools.blender.renderDevice ?? 'CPU', deviceIndex: config.tools.blender.renderDeviceIndex ?? 0 };
        const gpuMemory = job.operation === 'blender.render' && renderPolicy.backend !== 'CPU';
        const execution = await this.executeProcess(config.tools.blender.executable,
          ['--background', '--factory-startup', '--disable-autoexec', '--threads', '2', '--python-exit-code', '1', '--python', helper, '--', job.operation, inputPath, outputDir, JSON.stringify(job.input), JSON.stringify(renderPolicy)], { ...processOptions, gpuMemory });
        const rows = execution.stdout.split(/\r?\n/).filter(line => line.startsWith('DAFTAR_RESULT='));
        try { result = JSON.parse(rows.at(-1)?.slice('DAFTAR_RESULT='.length)); } catch { fail('CREATIVE_RESULT_INVALID', 'Blender did not produce the fixed helper result.', 422); }
        if (job.operation === 'blender.render' && (result?.engine !== 'CYCLES' || result?.backend !== renderPolicy.backend
          || result?.device !== (gpuMemory ? 'GPU' : 'CPU') || result?.deviceCount !== (gpuMemory ? 1 : 0)
          || (gpuMemory && result?.deviceIndex !== renderPolicy.deviceIndex))) {
          fail('CREATIVE_DEVICE_MISMATCH', 'Blender did not confirm the configured render device. No successful render receipt was recorded.', 422);
        }
      } else if (job.operation === 'unreal.inspect') {
        const document = readJson(inputPath, Math.min(limits.maxInputBytes, 1024 * 1024));
        if (!plain(document)) fail('CREATIVE_RESULT_INVALID', 'The Unreal project descriptor is invalid.', 422);
        result = { format: 'uproject', fileVersion: document.FileVersion, engineAssociation: document.EngineAssociation,
          modules: Array.isArray(document.Modules) ? document.Modules.length : 0, plugins: Array.isArray(document.Plugins) ? document.Plugins.length : 0, engineExecuted: false };
        fs.writeFileSync(path.join(outputDir, 'project.json'), JSON.stringify(safeResult(result)), { flag: 'wx', mode: 0o600 });
      } else if (job.operation === 'unreal.validate') {
        const document = readJson(inputPath, Math.min(limits.maxInputBytes, 1024 * 1024));
        if (!plain(document) || document.AdditionalPluginDirectories?.length || document.AdditionalRootDirectories?.length) fail('CREATIVE_PROJECT_DENIED', 'Review and remove external Unreal project directories before validation.', 403);
        this.inspectTree(project.root);
        await this.executeProcess(config.tools.unreal.executable, [originalPath, '-run=DataValidation', '-unattended', '-NullRHI', '-NoSplash', '-NoSound', '-NoP4', '-stdout', '-UTF8Output', '-NoLog'], processOptions);
        result = { validationPassed: true, engineExecuted: true };
        fs.writeFileSync(path.join(outputDir, 'validation.json'), JSON.stringify(result), { flag: 'wx', mode: 0o600 });
      } else if (job.operation === 'inkscape.export_png') {
        const svg = fs.readFileSync(inputPath, 'utf8');
        if (Buffer.byteLength(svg) > 8 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject)\b|\bon\w+\s*=|@import|xml:base|\\|&#/i.test(svg)) fail('CREATIVE_INPUT_UNSAFE', 'Use a self-contained SVG without scripts, entities, imports or external resources.', 403);
        for (const match of svg.matchAll(/(?:\bhref\s*=\s*["'])([^"']*)/gi)) if (!/^#[A-Za-z0-9_.:-]+$/.test(match[1]) && !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(match[1])) fail('CREATIVE_INPUT_UNSAFE', 'SVG references must be embedded images or local fragment references.', 403);
        for (const match of svg.matchAll(/url\s*\(([^)]*)\)/gi)) if (!/^\s*["']?#[A-Za-z0-9_.:-]+["']?\s*$/.test(match[1])) fail('CREATIVE_INPUT_UNSAFE', 'SVG CSS references must remain local fragments.', 403);
        await this.executeProcess(config.tools.inkscape.executable, [inputPath, '--export-type=png', '--export-area-page', `--export-filename=${path.join(outputDir, 'render.png')}`, `--export-width=${job.input.width}`, `--export-height=${job.input.height}`], processOptions);
        result = { format: 'png', width: job.input.width, height: job.input.height };
      } else if (job.operation === 'ffmpeg.probe') {
        const execution = await this.executeProcess(config.tools.ffmpeg.executable, ['-v', 'error', '-protocol_whitelist', 'file', '-format_whitelist', 'mov,matroska,webm,wav,mp3,flac,ogg,avi,image2,jpeg_pipe,png_pipe', '-probesize', '5000000', '-analyzeduration', '5000000', '-show_entries', 'format=format_name,duration:stream=codec_type,codec_name,width,height,sample_rate,channels', '-of', 'json', inputPath], processOptions);
        let data; try { data = JSON.parse(execution.stdout); } catch { fail('CREATIVE_RESULT_INVALID', 'The media probe did not return its expected JSON.', 422); }
        result = { format: data.format?.format_name, durationSeconds: Number(data.format?.duration), streams: (Array.isArray(data.streams) ? data.streams : []).map(row => ({ codecType: row.codec_type, codecName: row.codec_name, width: row.width, height: row.height, sampleRate: Number(row.sample_rate), channels: row.channels })) };
        fs.writeFileSync(path.join(outputDir, 'media.json'), JSON.stringify(safeResult(result)), { flag: 'wx', mode: 0o600 });
      } else if (toolId === 'adobe-photoshop') {
        const adapterFile = path.join(this.repoRoot, 'integrations/adobe/photoshop-api.mjs'); noLinks(adapterFile);
        const { executePhotoshopOperation } = await import(pathToFileURL(adapterFile).href);
        const executed = await executePhotoshopOperation({ config: config.tools[toolId], operation: job.operation, inputPath, outputDir, input: job.input, signal: controller.signal, authorize: current });
        result = executed?.result;
      }
      await current();
      const outputs = this.artifactFiles(outputDir, limits, expected);
      if (outputs.length !== expected.length || outputs.some(row => row.bytes === 0)) fail('CREATIVE_ARTIFACT_INVALID', 'The tool did not produce every expected nonempty output artifact.', 422);
      await current();
      await this.serial(() => this.commit(state => {
        const row = state.jobs.find(saved => saved.id === jobId);
        if (!TERMINAL.has(row.status)) { row.status = 'succeeded'; row.finishedAt = now(); row.outputs = outputs; row.result = safeResult(result); }
      }), true);
    } catch (error) {
      await this.serial(() => this.commit(state => {
        const row = state.jobs.find(saved => saved.id === jobId);
        if (!TERMINAL.has(row.status)) { const reason = controller.signal.aborted ? controller.signal.reason : error;
          row.status = reason?.code === 'CREATIVE_CANCELLED' ? 'cancelled' : 'failed'; row.finishedAt = now(); row.error = safeError(reason); }
        if (job.operation.startsWith('adobe.')) row.outputs = this.remoteReceipt(row);
      }), true);
    } finally {
      clearTimeout(timer); clearInterval(monitor); options.signal?.removeEventListener('abort', abort);
      if (directory) fs.rmSync(path.join(directory, 'temporary'), { recursive: true, force: true });
    }
  }
  inspectTree(root) {
    const queue = [root]; let count = 0;
    while (queue.length) {
      const directory = queue.pop(); noLinks(directory, { directory: true });
      for (const name of fs.readdirSync(directory)) {
        if (++count > 100000) fail('CREATIVE_PROJECT_LIMIT', 'The reviewed project exceeds the validation file-count limit.', 413);
        const filename = path.join(directory, name); const info = fs.lstatSync(filename);
        if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) fail('PATH_DENIED', 'Unreal project resources must remain regular files inside the reviewed root.', 403);
        if (info.isDirectory()) queue.push(filename);
      }
    }
  }
  remoteReceipt(job) {
    if (!job.operation.startsWith('adobe.')) return [];
    try {
      const directory = path.join(this.directory, 'artifacts', job.storageId, 'outputs');
      const filename = path.join(directory, 'adobe-receipt.json');
      const receipt = readJson(filename, 16384);
      if (!plain(receipt) || !['adobe', 'adobe-photoshop-v2'].includes(receipt.provider) || receipt.operation !== job.operation) return [];
      const { info } = noLinks(filename, { maxBytes: 16384 });
      return [{ path: 'adobe-receipt.json', bytes: info.size, sha256: crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex'), mediaType: 'application/json' }];
    } catch { return []; }
  }
  close() {
    return this.closing ??= (async () => {
      let failure;
      try { await this.serial(() => {
        this.closed = true; this.probeController?.abort(new CreativeToolsError('CREATIVE_CANCELLED', 'Creative controller is stopping.', 409));
        try { this.commit(state => {
          for (const job of state.jobs) if (!TERMINAL.has(job.status)) {
            job.status = 'interrupted'; job.finishedAt = now(); job.error = { code: 'RUNTIME_STOPPED', message: 'The runtime stopped this execution. It will not be replayed automatically.' };
          }
        }); } finally { for (const execution of this.running.values()) execution.controller.abort(new CreativeToolsError('CREATIVE_CANCELLED', 'Creative controller is stopping.', 409)); }
      }, true); } catch (error) { failure = error; }
      await Promise.allSettled([...this.running.values()].map(execution => execution.promise));
      await this.probeChain; await this.chain; this.releaseLock();
      if (failure) throw failure;
    })();
  }
}
