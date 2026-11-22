import { RuntimeError, BODY_LIMIT, assertObject, OWNER_ACTIONS } from './contract.mjs';

export class WorkbenchError extends RuntimeError {
  constructor(code, message, status = 400) { super(code, message, status); this.name = 'WorkbenchError'; }
}
const definition = (minArgs, maxArgs, mutates = false, platformDelegated = false) => Object.freeze({ minArgs, maxArgs, mutates, platformDelegated });
export const WORKBENCH_METHODS = Object.freeze({
  officeSnapshot: definition(0, 0), officeCommand: definition(1, 1, true),
  officeWorkerStatus: definition(0, 0), setOfficeWorker: definition(1, 1, true), runOfficeQueue: definition(0, 0, true),
  modelPoolSnapshot: definition(1, 1), modelPoolRequest: definition(1, 1, true), modelPoolCancel: definition(1, 1, true), modelPoolSelect: definition(1, 1, true),
  companySnapshot: definition(0, 0), registerCompany: definition(1, 1, true), refreshCompany: definition(0, 0, true),
  updateCompanyTask: definition(1, 1, true), indexCompanyRepository: definition(0, 0, true),
  getSystemInfo: definition(0, 0), getModelCatalog: definition(0, 0), checkModelRequirements: definition(1, 1),
  createVenv: definition(1, 1, true), downloadModel: definition(1, 1, true), getJobStatus: definition(0, 1), cancelJob: definition(1, 1, true),
  getSettings: definition(0, 0), getVaultStatus: definition(0, 0), setApiKey: definition(2, 2, true), revokeApiKey: definition(1, 1, true),
  listProviderModels: definition(1, 1), detectOllama: definition(0, 0),
  listProjects: definition(0, 0), createProject: definition(1, 1, true), getProject: definition(1, 1),
  startRun: definition(1, 1, true), pauseRun: definition(1, 1, true), resumeRun: definition(1, 1, true), cancelRun: definition(1, 1, true),
  listRuns: definition(0, 1), readArtifact: definition(3, 3),
  cloudStatus: definition(0, 0), configureCloud: definition(1, 1, true), syncCloud: definition(0, 0, true), disconnectCloud: definition(0, 0, true),
  copyEditorPairing: definition(0, 0, false, true), openPersonalDashboard: definition(0, 0, false, true),
  openOfflineAtlas: definition(0, 0, false, true), connectRuntime: definition(1, 1, false, true),
  backToLauncher: definition(0, 0, false, true), openExternal: definition(1, 1, false, true), importCredentialFile: definition(1, 1, false, true),
  onJobEvent: definition(0, 0, false, true), onProjectEvent: definition(0, 0, false, true), onModeChanged: definition(0, 0, false, true),
  hostStatus: definition(0, 0), hostConfigure: definition(1, 1, true), hostSubmit: definition(1, 1, true),
  hostApprove: definition(1, 1, true), hostCancel: definition(1, 1, true), hostInspect: definition(1, 1), hostStopAll: definition(0, 0, true),
});
export const MANAGED_OFFICE_ACTIONS = Object.freeze(['import_github_account', 'github_operation', 'schedule_repository_reviews']);
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const HASH = /^[a-f0-9]{64}$/;
function inspect(value, depth = 0) {
  if (depth > 16) throw new WorkbenchError('WORKBENCH_INPUT', 'Request nesting exceeds its limit.');
  if (value && typeof value === 'object') {
    if (!Array.isArray(value)) assertObject(value);
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new WorkbenchError('WORKBENCH_INPUT', 'Reserved request property.');
      inspect(item, depth + 1);
    }
  }
}
export function validateWorkbenchCall(method, args = [], id, methods = WORKBENCH_METHODS) {
  if (typeof method !== 'string' || !Object.hasOwn(methods, method)) throw new WorkbenchError('WORKBENCH_METHOD', 'This workbench method is unavailable.', 404);
  const spec = methods[method];
  if (!Array.isArray(args) || args.length < spec.minArgs || args.length > spec.maxArgs) throw new WorkbenchError('WORKBENCH_INPUT', 'Arguments do not match the workbench method.');
  if (id !== undefined && (typeof id !== 'string' || !ID.test(id))) throw new WorkbenchError('WORKBENCH_INPUT', 'A bounded stable request id is required.');
  if (spec.mutates && id === undefined) throw new WorkbenchError('WORKBENCH_INPUT', 'Mutations require a stable request id.');
  inspect(args);
  if (Buffer.byteLength(JSON.stringify({ id, method, args })) > BODY_LIMIT) throw new WorkbenchError('WORKBENCH_INPUT', 'Workbench request exceeds its limit.', 413);
  if (method === 'officeCommand') {
    const value = assertObject(args[0]);
    if (Object.keys(value).some(key => !['expectedStateHash', 'command'].includes(key)) || !HASH.test(value.expectedStateHash ?? '')) throw new WorkbenchError('WORKBENCH_INPUT', 'officeCommand requires expectedStateHash and command.');
    const command = assertObject(value.command);
    if (![...OWNER_ACTIONS, ...MANAGED_OFFICE_ACTIONS].includes(command.action)) throw new WorkbenchError('WORKBENCH_ACTION', 'This action is not an owner workbench action.', 403);
  }
  if (method === 'setOfficeWorker' && (Object.keys(assertObject(args[0])).length !== 1 || typeof args[0].enabled !== 'boolean')) throw new WorkbenchError('WORKBENCH_INPUT', 'Provide only enabled as a Boolean.');
  if (['setApiKey', 'revokeApiKey', 'importCredentialFile'].includes(method) && !['openai', 'anthropic', 'github'].includes(args[0])) throw new WorkbenchError('WORKBENCH_INPUT', 'Unknown credential provider.');
  if (method === 'setApiKey' && (typeof args[1] !== 'string' || !args[1].trim() || args[1].length > 512 || /[\r\n\0]/.test(args[1]))) throw new WorkbenchError('WORKBENCH_INPUT', 'Credential shape is invalid.');
  if (['getProject', 'pauseRun', 'resumeRun', 'cancelRun', 'cancelJob', 'checkModelRequirements', 'listProviderModels', 'openExternal', 'connectRuntime'].includes(method)
      && (typeof args[0] !== 'string' || !args[0] || args[0].length > 4096 || args[0].includes('\0'))) throw new WorkbenchError('WORKBENCH_INPUT', 'A bounded string argument is required.');
  if (['getJobStatus', 'listRuns'].includes(method) && args.length && (typeof args[0] !== 'string' || !args[0] || args[0].length > 160)) throw new WorkbenchError('WORKBENCH_INPUT', 'An optional bounded identifier is required.');
  if (method === 'readArtifact' && args.some(value => typeof value !== 'string' || !value || value.length > 160)) throw new WorkbenchError('WORKBENCH_INPUT', 'Three artifact identifiers are required.');
  return { id, method, args, spec };
}
export function validateWorkbenchEnvelope(value, methods = WORKBENCH_METHODS) {
  assertObject(value);
  if (Object.keys(value).some(key => !['id', 'method', 'args'].includes(key))) throw new WorkbenchError('WORKBENCH_INPUT', 'Unexpected workbench envelope property.');
  return validateWorkbenchCall(value.method, value.args, value.id, methods);
}
