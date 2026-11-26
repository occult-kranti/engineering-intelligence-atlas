import { OWNER_ACTIONS } from './contract.mjs';
import { WORKBENCH_METHODS } from './workbench-contract.mjs';
import { object, validId } from './host-control-contract.mjs';

export class ActivityJournalError extends Error {
  constructor(code, message, status = 400) {
    super(message); this.name = 'ActivityJournalError'; this.code = code.replace(/^RESOURCE_/, 'JOURNAL_'); this.status = status;
  }
}
export const journalFail = (code, message, status = 400) => { throw new ActivityJournalError(code, message, status); };
export const ACTIVITY_JOURNAL_LIMITS = Object.freeze({ events: 1000, registryBytes: 1024 * 1024, query: 100, summaryCache: 64, durationMs: 7 * 24 * 60 * 60 * 1000 });
export const ACTIVITY_OUTCOMES = Object.freeze(['accepted', 'success', 'error', 'rejected', 'cancelled', 'unknown']);
const managedMethods = [
  ...['Status', 'Prepare', 'Run', 'Inspect'].map(name => `environment${name}`),
  ...['Status', 'Configure', 'Resolve', 'Plan', 'Start', 'Inspect', 'Cancel'].map(name => `resource${name}`),
  ...['Catalog', 'Plan', 'Install', 'Inspect'].map(name => `design${name}`), 'hostGodMode',
];
export const ACTIVITY_OPERATIONS = Object.freeze(Object.fromEntries(Object.entries({
  runtime: ['start', 'stop', 'close', 'status', 'connection', 'configure', 'idle', 'wake', 'delay', 'diagnostic'],
  office: ['command', ...OWNER_ACTIONS],
  worker: ['generate', 'setEnabled', 'runOnce', 'start', 'stop'],
  host: ['configure', 'submit', 'approve', 'cancel', 'stopAll', 'godMode'],
  environment: ['prepare', 'run'], resource: ['configure', 'plan', 'start', 'cancel'], design: ['plan', 'install'],
  model: ['request', 'cancel', 'select', 'generate'],
  workbench: [...Object.keys(WORKBENCH_METHODS), ...managedMethods],
  compute: ['discover', 'connect', 'disconnect', 'profile', 'diagnostic', 'intake'],
}).map(([family, operations]) => [family, Object.freeze([...new Set(operations)])])));

const secretShape = /(?:^|[.:])(?:sk-|gh[pousr]_|github_pat_|bearer(?:[.:_-]|$)|api[_-]?key[.:_-]|password[.:_-]|secret[.:_-]|token[.:_-])/i;
function fields(input, allowed, required = []) {
  if (!object(input) || Object.keys(input).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(input, key))) {
    journalFail('JOURNAL_INPUT_INVALID', 'Only the documented activity metadata fields are accepted.');
  }
}
function identifier(value) {
  if (!validId(value) || secretShape.test(value)) journalFail('JOURNAL_INPUT_INVALID', 'An activity identifier is invalid or resembles credential material.');
  return value;
}
const id = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,160}$', maxLength: 160 };
const objectSchema = properties => ({ type: 'object', properties, additionalProperties: false });
export const ACTIVITY_JOURNAL_SCHEMAS = Object.freeze({
  status: objectSchema({}),
  query: objectSchema({ afterSequence: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    limit: { type: 'integer', minimum: 1, maximum: ACTIVITY_JOURNAL_LIMITS.query }, companyId: id, employeeId: id,
    outcome: { type: 'string', enum: ACTIVITY_OUTCOMES } }),
  summarize: objectSchema({ companyId: id, employeeId: id }),
});
export function validateActivityJournalOperation(operation, input = {}) {
  const schema = Object.hasOwn(ACTIVITY_JOURNAL_SCHEMAS, operation) && ACTIVITY_JOURNAL_SCHEMAS[operation];
  if (!schema) journalFail('JOURNAL_INPUT_INVALID', 'Unknown activity operation.');
  fields(input, Object.keys(schema.properties)); const value = {};
  for (const key of ['companyId', 'employeeId']) if (input[key] !== undefined) value[key] = identifier(input[key]);
  if (operation === 'query') {
    const afterSequence = input.afterSequence ?? 0, limit = input.limit ?? 50;
    if (!Number.isSafeInteger(afterSequence) || afterSequence < 0 || !Number.isInteger(limit) || limit < 1 || limit > ACTIVITY_JOURNAL_LIMITS.query) journalFail('JOURNAL_INPUT_INVALID', 'Activity cursor or page size is invalid.');
    if (input.outcome !== undefined && !ACTIVITY_OUTCOMES.includes(input.outcome)) journalFail('JOURNAL_INPUT_INVALID', 'Unknown activity outcome.');
    return { ...value, afterSequence, limit, ...(input.outcome !== undefined ? { outcome: input.outcome } : {}) };
  }
  return value;
}
export function validateActivityRecord(input) {
  fields(input, ['family', 'operation', 'outcome', 'code', 'companyId', 'employeeId', 'jobId', 'requestId', 'durationMs'], ['family', 'operation', 'outcome']);
  if (!Object.hasOwn(ACTIVITY_OPERATIONS, input.family) || !ACTIVITY_OPERATIONS[input.family].includes(input.operation)
      || !ACTIVITY_OUTCOMES.includes(input.outcome)) journalFail('JOURNAL_INPUT_INVALID', 'The activity family, operation or outcome is not allowlisted.');
  const value = { family: input.family, operation: input.operation, outcome: input.outcome };
  for (const key of ['companyId', 'employeeId', 'jobId', 'requestId']) if (input[key] !== undefined) value[key] = identifier(input[key]);
  if (input.code !== undefined) {
    if (typeof input.code !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(input.code) || /[\r\n\0]/.test(input.code) || secretShape.test(input.code)) journalFail('JOURNAL_INPUT_INVALID', 'An activity error code must be a bounded symbolic code.');
    value.code = input.code;
  }
  if (input.durationMs !== undefined) {
    if (typeof input.durationMs !== 'number' || !Number.isFinite(input.durationMs) || input.durationMs < 0 || input.durationMs > ACTIVITY_JOURNAL_LIMITS.durationMs) journalFail('JOURNAL_INPUT_INVALID', 'Activity duration is outside its bound.');
    value.durationMs = Math.round(input.durationMs);
  }
  return value;
}
