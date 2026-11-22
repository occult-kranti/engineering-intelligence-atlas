/** Owner-trusted container command control. These grants are attribution/policy,
 * not an OS sandbox or authentication boundary between mutually hostile users. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const LIMITS = Object.freeze({ commandBytes: 65536, jobs: 256, grants: 256,
  timeoutSeconds: 86400, defaultTimeoutSeconds: 1800, outputBytes: 8 * 1024 * 1024,
  defaultOutputBytes: 1024 * 1024, inspectBytes: 65536, registryBytes: 2 * 1024 * 1024 });
export const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'timed_out', 'output_limit', 'interrupted', 'uncertain']);
export const LIVE = new Set(['launching', 'running', 'cancelling']);
export const STATES = new Set(['pending_approval', ...LIVE, ...TERMINAL]);
export class HostControlError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'HostControlError'; this.code = code; this.status = status; }
}
export function fail(code, message, status = 400) { throw new HostControlError(code, message, status); }
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
export const validId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value);
export function exact(input, keys) {
  if (!object(input) || Object.keys(input).some(key => !keys.includes(key))) fail('HOST_INPUT_INVALID', 'Unexpected command-control input.');
}
export function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('HOST_INPUT_INVALID', `${name} is outside its allowed range.`);
  return value;
}
export function request(input) {
  exact(input, ['id', 'companyId', 'employeeId', 'command', 'cwd', 'timeoutSeconds', 'maxOutputBytes']);
  if (![input.id, input.companyId, input.employeeId].every(validId)) fail('HOST_INPUT_INVALID', 'Job, company and employee IDs are required.');
  if (typeof input.command !== 'string' || !input.command.trim() || input.command.includes('\0')
    || Buffer.byteLength(input.command) > LIMITS.commandBytes) fail('HOST_INPUT_INVALID', 'Command is empty, invalid or too large.');
  if (typeof input.cwd !== 'string' || !path.isAbsolute(input.cwd) || Buffer.byteLength(input.cwd) > 4096 || /[\x00-\x1f\x7f]/.test(input.cwd)) {
    fail('HOST_INPUT_INVALID', 'A valid absolute working directory is required.');
  }
  // Keep the caller's absolute path in the hash: repeats remain identifiable even
  // when their working directory was subsequently removed or a symlink changed.
  return { id: input.id, companyId: input.companyId, employeeId: input.employeeId, command: input.command,
    cwd: path.normalize(input.cwd), timeoutSeconds: integer(input.timeoutSeconds ?? LIMITS.defaultTimeoutSeconds, 1, LIMITS.timeoutSeconds, 'Timeout'),
    maxOutputBytes: integer(input.maxOutputBytes ?? LIMITS.defaultOutputBytes, 1, LIMITS.outputBytes, 'Output limit') };
}
export function privateDirectory(directory, create = false) {
  if (create) { try { fs.mkdirSync(directory, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('HOST_STATE_INVALID', 'Command-control storage must be a real directory.', 503);
  fs.chmodSync(directory, 0o700);
}
export function readPrivate(filename, maxBytes, optional = false) {
  let fd;
  try {
    fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > maxBytes || (stat.mode & 0o077)) fail('HOST_STATE_INVALID', 'Command-control file permissions or size are invalid.', 503);
    return fs.readFileSync(fd);
  } catch (error) {
    if (optional && error.code === 'ENOENT') return null;
    if (error instanceof HostControlError) throw error;
    fail('HOST_STATE_INVALID', 'Command-control state cannot be read safely.', 503);
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}
export function readJson(filename, maxBytes, optional = false) {
  const buffer = readPrivate(filename, maxBytes, optional);
  if (buffer === null) return null;
  try { return JSON.parse(buffer.toString('utf8')); }
  catch { fail('HOST_STATE_INVALID', 'Command-control state is malformed.', 503); }
}
export function atomicJson(filename, value) {
  const temp = `${filename}.${crypto.randomUUID()}.tmp`;
  let fd;
  try {
    fd = fs.openSync(temp, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    fs.renameSync(temp, filename);
    const directoryFd = fs.openSync(path.dirname(filename), 'r');
    try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
export function processIdentity(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return `${fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()}:${stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]}`;
  } catch { return null; }
}
export function safeEnvironment(source = process.env) {
  // Deliberately exclude tokens, SSH agents, NODE_OPTIONS, BASH_ENV and loaders.
  const env = { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', LANG: 'C.UTF-8', TERM: 'xterm-256color' };
  for (const key of ['HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL']) {
    if (typeof source[key] === 'string' && !source[key].includes('\0')) env[key] = source[key];
  }
  return env;
}
export function validResult(value, nonce) {
  return object(value) && value.version === 1 && value.nonce === nonce && TERMINAL.has(value.status)
    && (value.exitCode === null || Number.isInteger(value.exitCode))
    && Number.isSafeInteger(value.outputBytes) && value.outputBytes >= 0 && value.outputBytes <= LIMITS.outputBytes
    && typeof value.startedAt === 'string' && typeof value.finishedAt === 'string'
    && (value.reason === null || ['exit_nonzero', 'spawn_failed', 'cancelled', 'timed_out', 'output_limit', 'runner_signal'].includes(value.reason));
}
export function publicJob(job) {
  return Object.fromEntries(['id', 'companyId', 'employeeId', 'status', 'commandHash', 'createdAt', 'startedAt', 'finishedAt',
    'exitCode', 'reason', 'timeoutSeconds', 'maxOutputBytes', 'outputBytes', 'tmuxSession'].map(key => [key, job[key] ?? null]));
}

const idSchema = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,160}$', maxLength: 160 };
const schema = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const jobSchema = schema({ id: idSchema }, ['id']);
/** Shared HTTP/CLI/MCP schemas. Byte-size and absolute-path checks also run in
 * validateHostOperation because JSON Schema lengths count characters. */
export const HOST_TOOL_SCHEMAS = Object.freeze({
  status: schema({}),
  configure: schema({ expectedRevision: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER - 1 },
    mode: { type: 'string', enum: ['off', 'manual', 'auto'] },
    grants: { type: 'array', maxItems: LIMITS.grants, items: schema({ id: idSchema, companyId: idSchema,
      employeeId: { anyOf: [idSchema, { type: 'null' }] } }, ['id', 'companyId', 'employeeId']) }
  }, ['expectedRevision', 'mode', 'grants']),
  submit: schema({ id: idSchema, companyId: idSchema, employeeId: idSchema,
    command: { type: 'string', minLength: 1, maxLength: LIMITS.commandBytes },
    cwd: { type: 'string', minLength: 1, maxLength: 4096, pattern: '^/' },
    timeoutSeconds: { type: 'integer', minimum: 1, maximum: LIMITS.timeoutSeconds },
    maxOutputBytes: { type: 'integer', minimum: 1, maximum: LIMITS.outputBytes }
  }, ['id', 'companyId', 'employeeId', 'command', 'cwd']),
  approve: jobSchema, cancel: jobSchema,
  inspect: schema({ id: idSchema, offset: { type: 'integer', minimum: 0, maximum: LIMITS.outputBytes } }, ['id']),
  stopAll: schema({})
});
export function validateHostOperation(operation, input = {}) {
  const entry = Object.hasOwn(HOST_TOOL_SCHEMAS, operation) ? HOST_TOOL_SCHEMAS[operation] : undefined;
  if (!entry) fail('HOST_INPUT_INVALID', 'Unknown command-control operation.');
  exact(input, Object.keys(entry.properties));
  for (const field of entry.required) if (!Object.hasOwn(input, field)) fail('HOST_INPUT_INVALID', 'Required command-control input is missing.');
  if (operation === 'submit') return request(input);
  if (['approve', 'cancel', 'inspect'].includes(operation) && !validId(input.id)) fail('HOST_INPUT_INVALID', 'A valid job ID is required.');
  if (operation === 'inspect' && input.offset !== undefined) integer(input.offset, 0, LIMITS.outputBytes, 'Output offset');
  if (operation === 'configure') {
    integer(input.expectedRevision, 0, Number.MAX_SAFE_INTEGER - 1, 'Revision');
    if (!['off', 'manual', 'auto'].includes(input.mode) || !Array.isArray(input.grants) || input.grants.length > LIMITS.grants) fail('HOST_INPUT_INVALID', 'A mode and complete explicit grant list are required.');
    const ids = new Set();
    for (const grant of input.grants) {
      exact(grant, ['id', 'companyId', 'employeeId']);
      if (!validId(grant.id) || !validId(grant.companyId) || !(grant.employeeId === null || validId(grant.employeeId)) || ids.has(grant.id)) fail('HOST_INPUT_INVALID', 'Grant IDs must be unique and explicitly identify their scope.');
      ids.add(grant.id);
    }
  }
  return input;
}
