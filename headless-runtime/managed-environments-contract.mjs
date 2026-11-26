import path from 'node:path';
import { fields, safeId, bounded } from './model-resources-contract.mjs';
export class ManagedEnvironmentError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'ManagedEnvironmentError'; this.code = code.replace(/^RESOURCE_/, 'ENVIRONMENT_'); this.status = status; }
}
export const environmentFail = (code, message, status = 400) => { throw new ManagedEnvironmentError(code, message, status); };
export const ENVIRONMENT_LIMITS = Object.freeze({ environments: 128, receipts: 256, sourceBytes: 65536 });
const id = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,160}$', maxLength: 160 };
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
export const ENVIRONMENT_TOOL_SCHEMAS = Object.freeze({
  status: obj({}), prepare: obj({ id, companyId: id, employeeId: id, environmentId: id }), inspect: obj({ id }),
  run: obj({ id, companyId: id, employeeId: id, environmentId: id, command: { type: 'string', minLength: 1, maxLength: 65536, description: 'Python source executed by the verified virtual environment interpreter; this is not a shell command.' }, cwd: { type: 'string', minLength: 1, maxLength: 4096, pattern: '^/' }, timeoutSeconds: { type: 'integer', minimum: 1, maximum: 86400 }, maxOutputBytes: { type: 'integer', minimum: 1, maximum: 8388608 } }, ['id', 'companyId', 'employeeId', 'environmentId', 'command', 'cwd'])
});
export function validateEnvironmentOperation(operation, input = {}) {
  const schema = Object.hasOwn(ENVIRONMENT_TOOL_SCHEMAS, operation) && ENVIRONMENT_TOOL_SCHEMAS[operation];
  if (!schema) environmentFail('ENVIRONMENT_INPUT_INVALID', 'Unknown environment operation.');
  fields(input, Object.keys(schema.properties), schema.required, environmentFail);
  for (const key of ['id', 'companyId', 'employeeId', 'environmentId']) if (input[key] !== undefined) safeId(input[key], environmentFail);
  if (operation === 'run') {
    if (typeof input.command !== 'string' || !input.command.trim() || input.command.includes('\0') || Buffer.byteLength(input.command) > ENVIRONMENT_LIMITS.sourceBytes) environmentFail('ENVIRONMENT_INPUT_INVALID', 'A bounded Python source string is required.');
    if (typeof input.cwd !== 'string' || !path.isAbsolute(input.cwd) || Buffer.byteLength(input.cwd) > 4096 || /[\x00-\x1f\x7f]/.test(input.cwd)) environmentFail('ENVIRONMENT_INPUT_INVALID', 'An absolute working directory is required.');
    for (const [key, max] of [['timeoutSeconds', 86400], ['maxOutputBytes', 8388608]]) if (input[key] !== undefined && (!Number.isInteger(input[key]) || bounded(input[key], 1, max, environmentFail) < 1)) environmentFail('ENVIRONMENT_INPUT_INVALID', 'A job limit is invalid.');
    return { ...input, cwd: path.normalize(input.cwd), timeoutSeconds: input.timeoutSeconds ?? 1800, maxOutputBytes: input.maxOutputBytes ?? 1048576 };
  }
  return input;
}
