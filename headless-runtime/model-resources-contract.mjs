import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { atomicJson, hash, object, privateDirectory, processIdentity, readJson, validId } from './host-control-contract.mjs';
export { hash, object, validId };
export const RESOURCE_LIMITS = Object.freeze({ resources: 512, grants: 2048, routes: 128, experts: 4, receipts: 256, coveredScopes: 2048, registryBytes: 16 * 1024 * 1024, taskBytes: 16000 });
export class ModelResourcesError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'ModelResourcesError'; this.code = code; this.status = status; }
}
export const resourceFail = (code, message, status = 400) => { throw new ModelResourcesError(code, message, status); };
export function fields(input, allowed, required = allowed, fail = resourceFail) {
  if (!object(input) || Object.keys(input).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(input, key))) fail('RESOURCE_INPUT_INVALID', 'Unexpected or missing input fields.');
}
export function safeId(value, fail = resourceFail) { if (!validId(value)) fail('RESOURCE_INPUT_INVALID', 'A canonical ID is required.'); return value; }
export function bounded(value, min, max, fail = resourceFail) { if (!Number.isFinite(value) || value < min || value > max) fail('RESOURCE_INPUT_INVALID', 'A numeric limit is invalid.'); return value; }
export function revision(value, fail = resourceFail) { if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) fail('RESOURCE_INPUT_INVALID', 'A safe integer revision is required.'); }
export function scope(value) { fields(value, ['kind', 'id']); if (!['company', 'office', 'department', 'employee'].includes(value.kind)) resourceFail('RESOURCE_INPUT_INVALID', 'Unknown resource scope.'); safeId(value.id); return { kind: value.kind, id: value.id }; }
export async function nativeSnapshot(callback, fail = resourceFail) {
  let response; try { response = await callback(); } catch { fail('RESOURCE_SCOPE_UNAVAILABLE', 'Fresh native office state is unavailable.', 503); }
  const state = response?.ok === true ? response.snapshot : response;
  if (!object(state) || !['companies', 'offices', 'departments', 'employees'].every(key => Array.isArray(state[key]))) fail('RESOURCE_SCOPE_UNAVAILABLE', 'Fresh native office state is unavailable.', 503);
  return state;
}
export function assertActor(state, companyId, employeeId, location, fail = resourceFail) {
  const company = state.companies.find(item => item.id === companyId && item.status === 'active');
  const employee = state.employees.find(item => item.id === employeeId && item.status === 'active');
  if (!company || !employee) fail('RESOURCE_SCOPE_DENIED', 'An active canonical company and employee are required.', 403);
  const office = (id, company) => !id || state.offices.some(item => item.id === id && item.companyId === company && item.status === 'active');
  const department = (id, company, officeId) => !id || state.departments.some(item => item.id === id && item.companyId === company && (!officeId || item.officeId === officeId) && item.status === 'active');
  if (!office(employee.officeId, employee.companyId ?? companyId) || !department(employee.departmentId, employee.companyId ?? companyId, employee.officeId)) fail('RESOURCE_SCOPE_DENIED', 'The employee home location is inactive.', 403);
  if (location && (!office(location.officeId, companyId) || !department(location.departmentId, companyId, location.officeId))) fail('RESOURCE_SCOPE_DENIED', 'The selected work location is inactive.', 403);
  const own = employee.companyId === companyId || (employee.companyId === null && company.assistantId === employeeId);
  if (own && (!location || ((!employee.officeId || employee.officeId === location.officeId) && (!employee.departmentId || employee.departmentId === location.departmentId)))) return employee;
  const contracts = state.portfolio?.contracts ?? []; const services = state.portfolio?.services ?? [];
  const contract = contracts.find(item => item.status === 'active' && item.recipientCompanyId === companyId && item.employeeIds?.includes(employeeId)
    && (!location?.serviceContractId || item.id === location.serviceContractId)
    && office(item.recipientOfficeId, companyId) && department(item.recipientDepartmentId, companyId, item.recipientOfficeId)
    && (!location || ((!item.recipientOfficeId || item.recipientOfficeId === location.officeId) && (!item.recipientDepartmentId || item.recipientDepartmentId === location.departmentId) && item.allowedTools?.includes('provider.run')))
    && services.some(service => service.id === item.serviceId && service.status === 'active' && service.companyId === employee.companyId && service.employeeIds?.includes(employeeId)
      && state.companies.some(provider => provider.id === service.companyId && provider.status === 'active') && office(service.officeId, service.companyId) && department(service.departmentId, service.companyId, service.officeId)));
  if (!contract || (location && location.serviceContractId !== contract.id)) fail('RESOURCE_SCOPE_DENIED', 'An explicit active shared-service contract is required.', 403);
  return employee;
}
export function scopeEntity(state, target) {
  const lists = { company: state.companies, office: state.offices, department: state.departments, employee: state.employees };
  const entity = lists[target.kind]?.find(item => item.id === target.id && item.status === 'active');
  if (!entity) resourceFail('RESOURCE_SCOPE_DENIED', 'A resource scope is missing or inactive.', 403);
  return entity;
}

/** Common single-owner durable sidecar. A failed atomic write fences every API
 * until reopening; rollback never guesses whether rename/fsync committed. */
export function createPrivateRegistry({ stateDir, name, initial, validate, fail = resourceFail, ErrorType = ModelResourcesError }) {
  const directory = path.join(path.resolve(stateDir), name); const filename = path.join(directory, 'registry.json'); const lock = path.join(directory, 'owner.lock');
  let value; let fenced = false; let closed = false; let chain = Promise.resolve(); const nonce = crypto.randomUUID();
  const fence = () => { fenced = true; fail('RESOURCE_STATE_UNCERTAIN', 'A persistent write has an uncertain outcome. Close and reopen the service before continuing.', 503); };
  const write = (file, data) => { if (fenced) fence(); try { atomicJson(file, data); } catch { fence(); } };
  try {
    fs.mkdirSync(path.resolve(stateDir), { recursive: true, mode: 0o700 }); privateDirectory(directory, true);
    const acquire = () => fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, identity: processIdentity(process.pid), nonce }), { flag: 'wx', mode: 0o600 });
    try { acquire(); } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const old = readJson(lock, 1024); if (!object(old) || !Number.isInteger(old.pid) || old.pid < 1) fail('RESOURCE_BUSY', 'Inspect the sidecar owner lock locally.', 503);
      let alive = true; try { process.kill(old.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
      const identity = processIdentity(old.pid);
      if (alive && (!identity || !old.identity || identity === old.identity)) fail('RESOURCE_BUSY', 'Another service owns this sidecar.', 503);
      fs.unlinkSync(lock); acquire();
    }
    value = readJson(filename, RESOURCE_LIMITS.registryBytes, true) ?? structuredClone(initial); validate(value); write(filename, value);
  } catch (error) {
    try { if (readJson(lock, 1024, true)?.nonce === nonce) fs.unlinkSync(lock); } catch {}
    if (error instanceof ErrorType) throw error;
    fail('RESOURCE_STATE_INVALID', 'The private sidecar could not be initialized safely.', 503);
  }
  return {
    directory, get value() { return value; },
    assertHealthy() { if (closed) fail('RESOURCE_CLOSED', 'The service is closed.', 503); if (fenced) fence(); },
    write, fence,
    update(mutator) {
      if (closed) fail('RESOURCE_CLOSED', 'The service is closed.', 503); if (fenced) fence();
      const next = structuredClone(value); mutator(next); validate(next);
      if (Buffer.byteLength(JSON.stringify(next)) > RESOURCE_LIMITS.registryBytes) fail('RESOURCE_CAPACITY', 'The private registry size limit has been reached.', 409);
      write(filename, next); value = next;
    },
    serial(operation) {
      const pending = chain.then(async () => {
        if (closed) fail('RESOURCE_CLOSED', 'The service is closed.', 503); if (fenced) fence();
        try { return await operation(); } catch (error) { if (error instanceof ErrorType) throw error; fail('RESOURCE_OPERATION_FAILED', 'The managed operation failed; inspect its durable receipt.', 503); }
      }); chain = pending.catch(() => undefined); return pending;
    },
    close() {
      const pending = chain.then(() => { if (closed) return; closed = true; if (readJson(lock, 1024, true)?.nonce === nonce) fs.unlinkSync(lock); });
      chain = pending.catch(() => undefined); return pending;
    }
  };
}

const id = { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,160}$', maxLength: 160 };
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const scopeSchema = obj({ kind: { type: 'string', enum: ['company', 'office', 'department', 'employee'] }, id });
const expert = obj({ employeeId: id, resourceId: id, officeId: id, departmentId: { anyOf: [id, { type: 'null' }] }, serviceContractId: { anyOf: [id, { type: 'null' }] }, reviewerEmployeeId: { anyOf: [id, { type: 'null' }] }, reviewerServiceContractId: { anyOf: [id, { type: 'null' }] } }, ['employeeId', 'resourceId', 'officeId', 'departmentId']);
const resource = obj({ id, companyId: id, ownerScope: scopeSchema, model: { type: 'string', minLength: 1, maxLength: 200 }, digest: { type: 'string', pattern: '^[a-f0-9]{64}$' } });
const grant = obj({ id, resourceId: id, targetScope: scopeSchema, permissions: { type: 'array', minItems: 1, maxItems: 3, uniqueItems: true, items: { type: 'string', enum: ['use', 'assign', 'inspect'] } }, includeDescendants: { type: 'boolean' }, membershipRevision: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER - 1 } }, ['id', 'resourceId', 'targetScope', 'permissions']);
const route = obj({ id, companyId: id, strategy: { type: 'string', enum: ['single', 'ensemble'] }, experts: { type: 'array', minItems: 1, maxItems: 4, items: expert }, aggregator: { anyOf: [expert, { type: 'null' }] }, limits: obj({ maxTokens: { type: 'integer', minimum: 1, maximum: 1000000 }, maxMinutes: { type: 'number', minimum: 0.05, maximum: 1440 }, maxParallel: { type: 'integer', minimum: 1, maximum: 2 } }) }, ['id', 'companyId', 'strategy', 'experts', 'limits']);
export const RESOURCE_TOOL_SCHEMAS = Object.freeze({
  status: obj({ scope: scopeSchema }, []),
  configure: obj({ expectedRevision: { type: 'integer', minimum: 0 }, resources: { type: 'array', maxItems: 512, items: resource }, grants: { type: 'array', maxItems: 2048, items: grant }, routes: { type: 'array', maxItems: 128, items: route }, officeParents: { type: 'array', maxItems: 2048, items: obj({ officeId: id, parentOfficeId: { anyOf: [id, { type: 'null' }] } }) } }, ['expectedRevision', 'resources', 'grants', 'routes']),
  resolve: obj({ companyId: id, employeeId: id, resourceId: id, purpose: { type: 'string', enum: ['use', 'assign', 'inspect'] } }),
  plan: obj({ id, companyId: id, employeeId: id, routeId: id, task: { type: 'string', minLength: 1, maxLength: RESOURCE_LIMITS.taskBytes } }),
  start: obj({ id, planId: id, expectedPlanHash: { type: 'string', pattern: '^[a-f0-9]{64}$' } }),
  inspect: obj({ id }), cancel: obj({ id })
});
function expertValue(value) {
  fields(value, ['employeeId', 'resourceId', 'officeId', 'departmentId', 'serviceContractId', 'reviewerEmployeeId', 'reviewerServiceContractId'], ['employeeId', 'resourceId', 'officeId', 'departmentId']);
  for (const key of ['employeeId', 'resourceId', 'officeId']) safeId(value[key]);
  if (value.departmentId !== null) safeId(value.departmentId);
  if (value.serviceContractId != null) safeId(value.serviceContractId);
  if (value.reviewerEmployeeId != null) safeId(value.reviewerEmployeeId);
  if (value.reviewerServiceContractId != null) safeId(value.reviewerServiceContractId);
  if (value.reviewerEmployeeId === value.employeeId || (value.reviewerServiceContractId != null && value.reviewerEmployeeId == null)) resourceFail('RESOURCE_PAIR_REQUIRED', 'Select a distinct reviewer for an explicit review service contract.');
  return { employeeId: value.employeeId, resourceId: value.resourceId, officeId: value.officeId, departmentId: value.departmentId, serviceContractId: value.serviceContractId ?? null,
    reviewerEmployeeId: value.reviewerEmployeeId ?? null, reviewerServiceContractId: value.reviewerServiceContractId ?? null };
}
export function normalizeConfiguration(input) {
  fields(input, ['expectedRevision', 'resources', 'grants', 'routes', 'officeParents'], ['expectedRevision', 'resources', 'grants', 'routes']); revision(input.expectedRevision);
  for (const key of ['resources', 'grants', 'routes']) if (!Array.isArray(input[key]) || input[key].length > RESOURCE_LIMITS[key]) resourceFail('RESOURCE_INPUT_INVALID', 'A resource collection exceeds its bound.');
  const unique = (list, key = 'id') => { const ids = new Set(); for (const item of list) { if (ids.has(item[key])) resourceFail('RESOURCE_INPUT_INVALID', 'Collection identities must be unique.'); ids.add(item[key]); } };
  const resources = input.resources.map(value => {
    fields(value, ['id', 'companyId', 'ownerScope', 'model', 'digest']); safeId(value.id); safeId(value.companyId);
    if (typeof value.model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,199}$/.test(value.model) || !/^[a-f0-9]{64}$/.test(value.digest)) resourceFail('RESOURCE_INPUT_INVALID', 'An exact model name and SHA-256 digest are required.');
    return { id: value.id, companyId: value.companyId, ownerScope: scope(value.ownerScope), model: value.model, digest: value.digest };
  });
  const grants = input.grants.map(value => {
    fields(value, ['id', 'resourceId', 'targetScope', 'permissions', 'includeDescendants', 'membershipRevision'], ['id', 'resourceId', 'targetScope', 'permissions']); safeId(value.id); safeId(value.resourceId);
    if (!Array.isArray(value.permissions) || value.permissions.length < 1 || value.permissions.length > 3 || value.permissions.some(item => !['use', 'assign', 'inspect'].includes(item)) || new Set(value.permissions).size !== value.permissions.length) resourceFail('RESOURCE_INPUT_INVALID', 'Explicit model permissions are required.');
    if (value.includeDescendants !== undefined && typeof value.includeDescendants !== 'boolean') resourceFail('RESOURCE_INPUT_INVALID', 'Descendant inclusion must be explicit.'); revision(value.membershipRevision ?? 0);
    return { id: value.id, resourceId: value.resourceId, targetScope: scope(value.targetScope), permissions: [...value.permissions].sort(), includeDescendants: value.includeDescendants ?? false, membershipRevision: value.membershipRevision ?? 0 };
  });
  const routes = input.routes.map(value => {
    fields(value, ['id', 'companyId', 'strategy', 'experts', 'aggregator', 'limits'], ['id', 'companyId', 'strategy', 'experts', 'limits']); safeId(value.id); safeId(value.companyId);
    if (!['single', 'ensemble'].includes(value.strategy)) resourceFail('RESOURCE_TRAINING_UNSUPPORTED', 'Only request routing and bounded ensembles are supported; this service does not train MoE weights.');
    if (!Array.isArray(value.experts) || value.experts.length < 1 || value.experts.length > 4 || (value.strategy === 'single' && (value.experts.length !== 1 || value.aggregator != null))) resourceFail('RESOURCE_INPUT_INVALID', 'The expert collection is invalid.');
    fields(value.limits, ['maxTokens', 'maxMinutes', 'maxParallel']); bounded(value.limits.maxTokens, value.experts.length + (value.aggregator ? 1 : 0), 1000000); bounded(value.limits.maxMinutes, 0.05, 1440);
    if (!Number.isInteger(value.limits.maxTokens) || ![1, 2].includes(value.limits.maxParallel)) resourceFail('RESOURCE_INPUT_INVALID', 'Token and parallel limits must be bounded integers.');
    const experts = value.experts.map(expertValue); const aggregator = value.aggregator ? expertValue(value.aggregator) : null;
    const employees = [...experts, ...(aggregator ? [aggregator] : [])].map(item => item.employeeId);
    if (new Set(employees).size !== employees.length) resourceFail('RESOURCE_INPUT_INVALID', 'Use distinct employees for each expert and aggregator.');
    return { id: value.id, companyId: value.companyId, strategy: value.strategy, experts, aggregator, limits: { ...value.limits } };
  });
  const officeParents = input.officeParents ?? []; if (!Array.isArray(officeParents) || officeParents.length > 2048) resourceFail('RESOURCE_INPUT_INVALID', 'Office grouping exceeds its bound.');
  const parents = officeParents.map(value => { fields(value, ['officeId', 'parentOfficeId']); safeId(value.officeId); if (value.parentOfficeId !== null) safeId(value.parentOfficeId); return { ...value }; });
  unique(resources); unique(grants); unique(routes); unique(parents, 'officeId');
  return { expectedRevision: input.expectedRevision, resources, grants, routes, officeParents: parents };
}
export function validateResourceOperation(operation, input = {}) {
  const schema = Object.hasOwn(RESOURCE_TOOL_SCHEMAS, operation) && RESOURCE_TOOL_SCHEMAS[operation];
  if (!schema) resourceFail('RESOURCE_INPUT_INVALID', 'Unsupported resource operation.');
  fields(input, Object.keys(schema.properties), schema.required);
  if (operation === 'configure') return normalizeConfiguration(input);
  for (const key of ['id', 'companyId', 'employeeId', 'resourceId', 'routeId', 'planId']) if (input[key] !== undefined) safeId(input[key]);
  if (input.scope) scope(input.scope);
  if (operation === 'resolve' && !['use', 'assign', 'inspect'].includes(input.purpose)) resourceFail('RESOURCE_INPUT_INVALID', 'Unknown model permission.');
  if (operation === 'plan' && (typeof input.task !== 'string' || !input.task.trim() || input.task.includes('\0') || Buffer.byteLength(input.task) > RESOURCE_LIMITS.taskBytes)) resourceFail('RESOURCE_INPUT_INVALID', 'A bounded task description is required.');
  if (operation === 'start' && !/^[a-f0-9]{64}$/.test(input.expectedPlanHash)) resourceFail('RESOURCE_INPUT_INVALID', 'An exact plan hash is required.');
  return input;
}
