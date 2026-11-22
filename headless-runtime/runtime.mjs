import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { RuntimeError, validateCommandEnvelope } from './contract.mjs';
import { readSecretFile } from './secrets.mjs';
import { HeadlessCloudSync } from './cloud-sync.mjs';
import { createHostControl } from './host-control.mjs';
import { validateHostOperation } from './host-control-contract.mjs';
import { createWorkbench } from './workbench.mjs';
import { createManagedEnvironments } from './managed-environments.mjs';
import { createModelResources } from './model-resources.mjs';
import { validateEnvironmentOperation } from './managed-environments-contract.mjs';
import { validateResourceOperation } from './model-resources-contract.mjs';
import { createDesignToolchain } from './design-toolchain.mjs';
import { validateDesignToolchainOperation } from './design-toolchain-contract.mjs';
import { createActivityJournal } from './activity-journal.mjs';
import { validateActivityJournalOperation, ACTIVITY_OPERATIONS } from './activity-journal-contract.mjs';

const require = createRequire(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function publicImprovementCoordinator(value) {
  const time = stamp => typeof stamp === 'string' && stamp.length <= 40 && Number.isFinite(Date.parse(stamp));
  const id = identity => typeof identity === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(identity);
  if (!value || !time(value.sampledAt) || typeof value.enabled !== 'boolean' || typeof value.checking !== 'boolean') return undefined;
  const row = value.observation;
  const valid = row && id(row.sessionId) && id(row.companyId) && id(row.officeId)
    && (row.departmentId === null || id(row.departmentId)) && Number.isSafeInteger(row.sessionRevision) && row.sessionRevision >= 0
    && time(row.checkedAt) && ['checking','blocked','progress','idle'].includes(row.outcome)
    && [null,'no-current-eligible-priced-route','attempt-needs-review','improvement-state-needs-review'].includes(row.reason);
  return { sampledAt: value.sampledAt, enabled: value.enabled, checking: value.checking, observation: valid ? {
    sessionId: row.sessionId, sessionRevision: row.sessionRevision, companyId: row.companyId, officeId: row.officeId,
    departmentId: row.departmentId, checkedAt: row.checkedAt, outcome: row.outcome, reason: row.reason,
  } : null };
}

function publicWorkerStatus(worker) {
  const state = typeof worker.status === 'function' ? worker.status() : worker;
  const improvement = publicImprovementCoordinator(state.improvement);
  return {
    enabled: state.enabled === true,
    running: state.running === true,
    activeJobId: typeof state.activeJobId === 'string' ? state.activeJobId : null,
    activeJobIds: Array.isArray(state.activeJobIds) ? state.activeJobIds : [],
    concurrency: state.concurrency ?? 1,
    ...(improvement ? { improvement } : {}),
    execution: { sampledAt: new Date().toISOString(), activeCalls: Array.isArray(state.execution?.activeCalls)
      ? state.execution.activeCalls.slice(0, 8).filter(call => typeof call.jobId === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(call.jobId)
        && ['provider','model'].includes(call.phase) && Number.isFinite(Date.parse(call.startedAt))).map(call => ({ jobId: call.jobId, phase: call.phase, startedAt: call.startedAt })) : [] },
    scheduling: Array.isArray(state.scheduling) ? state.scheduling.slice(0, 4).map(slot => ({
      baseIntervalMs: slot.baseIntervalMs, maxIntervalMs: slot.maxIntervalMs, lastOutcome: slot.lastOutcome,
      idlePolls: slot.idlePolls, errorPolls: slot.errorPolls, pollDelayMs: slot.pollDelayMs, nextPollAt: slot.nextPollAt,
    })) : [],
    // Worker errors can contain private paths/provider details. Expose status only.
    lastError: state.lastError ? 'A worker operation needs review. Inspect the saved job evidence.' : null,
  };
}

function unwrap(result) {
  if (result?.ok === true && result.snapshot) return result.snapshot;
  const code = typeof result?.code === 'string' && /^[A-Z_]{1,80}$/.test(result.code)
    ? result.code : 'NATIVE_UNAVAILABLE';
  const conflict = ['CONFLICT', 'REMOTE_RECEIPT_MISMATCH', 'STATE_BUSY'].includes(code);
  const uncertain = /^(?:CORE_FAILED|CORE_INVALID|NATIVE_UNAVAILABLE|OFFICE_ERROR|IO_ERROR)$/.test(code);
  throw new RuntimeError(code,
    uncertain ? 'The native outcome could not be confirmed. Inspect state; retain the same command id and body if replay is needed.'
      : conflict ? 'State or command identity changed. Read current state before a new operation.'
      : 'The native runtime rejected this operation. Existing state was preserved; inspect the job or local configuration.',
    uncertain ? 503 : conflict ? 409 : code === 'REMOTE_ACTION_DENIED' ? 403 : 400);
}

/** Injectable controller; persistent command idempotency belongs to the Rust core. */
export class RuntimeController {
  constructor({ office, worker, projectSnapshot, stateHash, modelPool, cloudSync, hostControl, capabilities = {} }) {
    this.office = office;
    this.worker = worker;
    this.projectSnapshot = projectSnapshot;
    this.stateHash = stateHash;
    this.capabilities = capabilities;
    this.modelPool = modelPool;
    this.cloudSync = cloudSync;
    this.hostControl = hostControl;
    this.singleRun = null;
  }

  async status() {
    const credentialConfigured = provider => { try { return Boolean(this.workbench?.getSecret(provider)); } catch { return false; } };
    const host = this.hostControl ? (await this.hostOperation('status', {})).host
      : { configured: false, mode: 'off', revision: 0, grants: [], jobs: [], capabilities: {} };
    return { ok: true, execution: 'headless', worker: publicWorkerStatus(this.workerStatus()), improvement: this.improvement?.status() ?? null,
      observer: this.office.observerStatus?.() ?? null,
      activity: this.activity ? (await this.activity.status()).activity : null,
      cloud: this.cloudSync?.enabled === true ? this.cloudSync.status()
        : this.workbench?.cloudStatus() ?? this.cloudSync?.status() ?? { configured: false, connected: false, revision: null, error: null },
      host: { configured: host.configured === true, available: host.available === true, mode: host.mode, revision: host.revision,
        grantCount: host.grants.length, jobCount: host.jobCount ?? host.jobs.length },
      capabilities: { providerJobs: true, cloudSync: false, ...this.capabilities,
        ...(this.workbench ? { workbench: true, configuredProviders: ['openai', 'anthropic'].filter(credentialConfigured),
          githubRead: credentialConfigured('github'), githubPublish: credentialConfigured('github') } : {}),
        hostControl: host.configured === true, arbitraryCode: host.configured === true,
        hostControlActive: host.configured === true && host.mode !== 'off' } };
  }

  projection(snapshot) {
    try { return { snapshot: this.projectSnapshot(snapshot), stateHash: this.stateHash(snapshot) }; }
    catch { throw new RuntimeError('PROJECTION_UNAVAILABLE',
      'The workspace cannot be safely projected within the current limits. Inspect it locally.', 503); }
  }

  workerStatus() { return this.combineWorkerExecution ? this.combineWorkerExecution(this.worker.status(), this.improvement?.workerStatus(), this.improvement?.coordinatorStatus()) : this.worker.status(); }

  async snapshot() {
    return { ok: true, ...this.projection(unwrap(await this.office.officeSnapshot())) };
  }

  async command(body) {
    const envelope = validateCommandEnvelope(body);
    const snapshot = unwrap(await this.office.officeCommand({ action: 'apply_remote_command', ...envelope }));
    this.improvement?.wake(envelope.command);
    const receipt = { ok: true, id: envelope.id, replayed: snapshot.lastAction?.replayed === true };
    try { return { ...receipt, ...this.projection(snapshot) }; }
    catch {
      // The mutation and its receipt were committed together. Projection failure
      // must never turn this into an apparent failed mutation or invite a new id.
      return { ...receipt, snapshotOmitted: true,
        notice: 'Command saved; projection unavailable. Do not replay with a new id. Inspect state locally.' };
    }
  }

  async modelOperation(operation, input) {
    if (!this.modelPool || !['snapshot', 'request', 'cancel', 'select'].includes(operation)) {
      throw new RuntimeError('MODEL_POOL_UNAVAILABLE', 'This runtime has no shared model controller.', 503);
    }
    try {
      if (this.resources?.isEnforced()) await this.resources.authorizeModelOperation(operation, input);
      return await this.modelPool[operation](input);
    }
    catch (error) {
      if (['ModelPoolError', 'ModelResourcesError'].includes(error?.name) && /^[A-Z_]{1,80}$/.test(error.code)) {
        throw new RuntimeError(error.code, error.message, error.status);
      }
      throw new RuntimeError('MODEL_UNAVAILABLE', 'The local model operation could not be confirmed. Inspect model status before a new request.', 503);
    }
  }

  async resourceOperation(operation, input = {}) {
    return this.managedOperation('resources', operation, input, validateResourceOperation);
  }

  async environmentOperation(operation, input = {}) {
    return this.managedOperation('environments', operation, input, validateEnvironmentOperation);
  }
  async designOperation(operation, input = {}) {
    return this.managedOperation('design', operation, input, validateDesignToolchainOperation);
  }
  async activityOperation(operation, input = {}) {
    return this.managedOperation('activity', operation, input, validateActivityJournalOperation);
  }

  async managedOperation(service, operation, input, validate) {
    try {
      const validated = validate(operation, input);
      if (!this[service] || typeof this[service][operation] !== 'function') throw new RuntimeError('SERVICE_UNAVAILABLE', 'This managed service is unavailable.', 503);
      return await this[service][operation](validated);
    } catch (error) {
      if (error instanceof RuntimeError) throw error;
      if (['ManagedEnvironmentError', 'ModelResourcesError', 'DesignToolchainError', 'ActivityJournalError'].includes(error?.name) && /^[A-Z_]{1,80}$/.test(error.code)) {
        throw new RuntimeError(error.code, error.message, [400,403,404,409,413,429,503].includes(error.status) ? error.status : 503);
      }
      throw new RuntimeError('SERVICE_UNAVAILABLE', 'This managed operation could not be confirmed. Inspect its original receipt before repeating it.', 503);
    }
  }

  async hostOperation(operation, input = {}) {
    if (!this.hostControl || !['status', 'configure', 'godMode', 'submit', 'approve', 'cancel', 'inspect', 'stopAll'].includes(operation)) {
      throw new RuntimeError('HOST_UNAVAILABLE', 'This runtime has no host-control controller.', 503);
    }
    try { return await this.hostControl[operation](validateHostOperation(operation, input)); }
    catch (error) {
      if (error?.name === 'HostControlError' && /^[A-Z_]{1,80}$/.test(error.code)) {
        const status = [400, 403, 404, 409, 413, 429, 503].includes(error.status) ? error.status : 503;
        throw new RuntimeError(error.code,
          status === 409 ? 'Host state or job identity changed. Inspect host status and retain the original job id before another operation.'
            : status === 400 || status === 413 ? 'The host operation does not match its bounded input contract.'
            : status === 403 ? 'Host control requires process opt-in, an active owner policy, and a valid scope grant.'
            : 'The host operation could not be confirmed. Inspect host status and retain the original job id; no automatic retry was sent.', status);
      }
      throw new RuntimeError('HOST_UNAVAILABLE', 'The host operation could not be confirmed. Inspect host status before another request; no automatic retry was sent.', 503);
    }
  }

  setEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw new RuntimeError('INVALID_REQUEST', 'enabled must be boolean.');
    const current = this.worker.status();
    if ((enabled && current.enabled) || (!enabled && !current.enabled && !current.running)) {
      return { ok: true, worker: publicWorkerStatus(this.workerStatus()) };
    }
    this.worker.setEnabled(enabled);
    return { ok: true, worker: publicWorkerStatus(this.workerStatus()) };
  }

  runOnce() {
    if (this.singleRun || this.worker.status().running) {
      throw new RuntimeError('WORKER_RUNNING', 'A worker attempt is already running.', 409);
    }
    this.singleRun = Promise.resolve(this.worker.runOnce()).catch(() => undefined)
      .finally(() => { this.singleRun = null; });
    return { ok: true, accepted: true, worker: publicWorkerStatus(this.workerStatus()) };
  }

  async close() {
    this.office.stopObserving?.();
    this.worker.stop();
    this.improvement?.close(); this.improvementDiscovery?.close();
    await this.workbench?.close();
    await this.cloudSync?.close();
    await this.resources?.close();
    await this.environments?.close();
    await this.design?.close();
    await this.modelPool?.close();
    await this.hostControl?.close();
    // The pool aborts provider calls. A short grace period allows their durable
    // settlement; an unconfirmed attempt is reconciled by native lease recovery.
    const deadline = Date.now() + 10000;
    while (this.workerStatus().running && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await this.activity?.record({ family: 'runtime', operation: 'stop', outcome: 'success' });
    await this.activity?.close();
  }
}

export function createRuntime(options = {}) {
  const repoRoot = path.resolve(options.repoRoot ?? defaultRepoRoot);
  const dataDir = path.resolve(options.dataDir ?? path.join(repoRoot, 'headless-runtime/.daftar-runtime'));
  const binaryPath = path.resolve(options.binaryPath ?? path.join(repoRoot, 'native-core/target/release/atlas-core'));
  const seedDir = path.join(repoRoot, 'company');
  const concurrency = options.concurrency ?? 2;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new RuntimeError('INVALID_CONFIG', 'Concurrency must be between one and four.', 503);
  }
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const dist = path.join(repoRoot, 'desktop-shell/dist/main');
  let modules;
  try {
    modules = {
      ...require(path.join(dist, 'office.js')),
      ...require(path.join(dist, 'officeWorker.js')),
      ...require(path.join(dist, 'improvementWorker.js')),
      ...require(path.join(dist, 'providers.js')),
      ...require(path.join(dist, 'ollama.js')),
      ...require(path.join(dist, 'modelPool.js')),
      ...require(path.join(dist, 'cloudSync.js')),
    };
  } catch {
    throw new RuntimeError('BUILD_REQUIRED', 'Build the portable runtime modules before starting the service.', 503);
  }
  const secrets = options.secretFiles ?? {};
  let workbench, activity, improvement;
  const metadata = (input, result) => {
    const source = input && typeof input === 'object' ? input : {};
    const output = {};
    for (const key of ['companyId', 'employeeId']) {
      const value = source[key] ?? result?.job?.[key] ?? result?.run?.[key];
      if (typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value) && value.trim() === value) output[key] = value;
    }
    for (const [key, value] of [['requestId', source.requestId ?? source.id], ['jobId', source.jobId ?? result?.job?.id]]) {
      if (typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value) && value.trim() === value) output[key] = value;
    }
    return output;
  };
  const observe = async (family, operation, input, perform) => {
    const started = Date.now();
    const record = async (outcome, result, code) => {
      if (!activity) return { recorded: true };
      const entry = { family, operation, outcome, ...metadata(input, result),
        durationMs: Math.min(604800000, Math.max(0, Date.now() - started)),
        ...(typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? { code } : {}) };
      try { return await activity.record(entry); } catch { return { recorded: false }; }
    };
    try {
      const result = await perform();
      const diagnostic = await record(result?.ok === false ? 'rejected' : result?.accepted === true || result?.pending === true ? 'accepted' : 'success', result, result?.code);
      // Diagnostics never replace a committed action receipt or invite replay.
      if (!diagnostic.recorded && result && typeof result === 'object') return { ...result,
        activityWarning: 'The operation result is preserved, but its activity record needs review. Inspect activity status; do not repeat the operation.' };
      return result;
    } catch (error) {
      await record(error?.status >= 400 && error.status < 500 ? 'rejected' : 'unknown', null, error?.code);
      throw error;
    }
  };
  const getSecret = provider => secrets[provider] ? readSecretFile(secrets[provider]) : workbench?.getSecret(provider) ?? null;
  const office = new modules.OfficeService({
    userDataPath: dataDir, seedDir, binaryPath, githubToken: () => getSecret('github'),
  });
  // Programmatic injection is for local tests; no CLI/environment/HTTP setting
  // can replace the model adapter or execute supplied code.
  if (options.generate !== undefined && typeof options.generate !== 'function') {
    throw new RuntimeError('INVALID_CONFIG', 'The injected generation adapter must be a function.', 503);
  }
  const cloudSync = new HeadlessCloudSync({ enabled: options.cloudSyncEnabled === true, url: options.cloudUrl,
    pairingFile: options.cloudPairingFile, keyFile: options.cloudEncryptionKeyFile, intervalSeconds: options.cloudSyncIntervalSeconds,
    stateDir: dataDir, CloudSyncService: modules.CloudSyncService,
    stateHash: modules.syncStateHash,
    allowKnownSchemaDefaults: options.cloudAllowKnownSchemaDefaults === true, knownParentDefaultsMatch: modules.knownParentDefaultsMatch,
    snapshot: () => office.officeSnapshot(), command: async request => { const result = await office.officeCommand(request); if(result.ok)improvement?.wake(request.command ?? request); return result; },
    getWorkerExecution: () => runtime.workerStatus().execution,
    ...(options.cloudFetch ? { fetchImpl: options.cloudFetch } : {}) });
  const modelPool = new modules.ModelPoolService({ stateDir: dataDir, snapshot: () => office.officeSnapshot(),
    baseUrl: options.ollamaBaseUrl, localOnlyConfirmed: options.ollamaLocalOnly === true,
    ...(options.modelFetch ? { fetchFn: options.modelFetch } : {}) });
  const hostControl = createHostControl({ stateDir: dataDir, enabled: options.hostControlEnabled === true,
    snapshot: () => office.officeSnapshot() });
  const environments = createManagedEnvironments({ stateDir: dataDir, hostControl, snapshot: () => office.officeSnapshot(),
    ...(options.pythonPath ? { pythonPath: options.pythonPath } : {}) });
  const resources = createModelResources({ stateDir: dataDir, snapshot: () => office.officeSnapshot(), modelPool,
    nativeCommand: command => office.officeCommand(command), environmentService: environments });
  const design = createDesignToolchain({ stateDir: dataDir, hostControl, snapshot: () => office.officeSnapshot() });
  const generate = options.generate ?? (async (request, job) => {
    if (request.provider === 'ollama') {
      return modelPool.generateForJob(job, request);
    }
    if (!['openai', 'anthropic'].includes(request.provider)) {
      throw new RuntimeError('PROVIDER_UNAVAILABLE', 'This provider adapter is unavailable.', 503);
    }
    const key = getSecret(request.provider);
    if (!key) throw new RuntimeError('SECRET_UNAVAILABLE', 'The selected provider secret is not configured.', 503);
    return modules.generateWithProvider(request.provider, key, request);
  });
  const workerOptions = {
    snapshot: () => office.officeSnapshot(), command: request => office.workerCommand(request),
    artifactRoot: path.join(dataDir, 'office-artifacts'), seedDir,
    generate: (request, job) => observe('worker', 'generate', { ...metadata(job), jobId: job?.id }, () => generate(request, job)),
    prepareContext: job => office.prepareWorkerContext(job),
    validateJob: job => resources.isEnforced() ? resources.validateJob(job) : modelPool.validateJob(job),
    executeTool: async (job, text) => {
      if (!job.allowedTools.includes('github.publish_changes')) throw new Error('GitHub publication capability is unavailable.');
      await office.assertWorkerCapability(job, 'github.publish_changes');
      let changes;
      try { changes = JSON.parse(text); } catch { throw new Error('Expected a managed JSON changeset. Artifact preserved.'); }
      if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Expected a managed JSON changeset.');
      const result = await office.githubOperation({ ...changes, action: 'github_operation',
        companyId: job.companyId, operation: 'publish_changes', reviewed: job.authorized });
      const snapshot = unwrap(result);
      const published = snapshot.lastAction?.github;
      if (typeof published?.url !== 'string') throw new Error('GitHub publication returned no verified evidence.');
      return { summary: `Published commit ${published.commit}`, evidenceUrl: published.url };
    },
  };
  const worker = new modules.OfficeWorkerPool(workerOptions, concurrency);
  const runtime = new RuntimeController({ office, worker, modelPool, cloudSync, hostControl,
    projectSnapshot: modules.cloudSnapshot, stateHash: modules.syncStateHash,
    capabilities: { providerAdapters: ['openai', 'anthropic', 'ollama-loopback'],
      configuredProviders: ['openai', 'anthropic'].filter(provider => !!secrets[provider]),
      githubRead: !!secrets.github, githubPublish: !!secrets.github, sharedModels: options.ollamaLocalOnly === true,
      cloudSync: options.cloudSyncEnabled === true, activityJournal: true } });
  runtime.binaryPath = binaryPath;
  runtime.resources = resources;
  runtime.environments = environments;
  runtime.design = design;
  runtime.combineWorkerExecution = modules.combineWorkerExecution;
  workbench = createWorkbench({ runtime, repoRoot, dataDir, secretFiles: secrets,
    platform: { ...(options.generate ? { generate: options.generate } : {}), ...options.workbenchPlatform } });
  runtime.workbench = workbench;
  const discovery = modules.createImprovementRouteDiscovery({
    credentialFingerprint: provider => { const key=getSecret(provider); return key ? modules.fingerprintCredential(key) : null; },
    discover: (provider, signal) => modules.listProviderModels(provider,getSecret(provider),
      (url,init) => (options.workbenchPlatform?.fetch ?? fetch)(url,{...init,signal})),
    localEligible: async (session,route) => {
      try {
        if(resources.isEnforced()) await resources.validateImprovementRoute(session,route);
        else for(const [employeeId,serviceContractId] of [[session.primaryEmployeeId,session.serviceContractId],[session.reviewerEmployeeId,session.reviewerServiceContractId]]) {
          await modelPool.validateJob({provider:'ollama',model:route.model,companyId:session.companyId,officeId:session.officeId,departmentId:session.departmentId,employeeId,serviceContractId});
        }
        return true;
      } catch { return false; }
    },
  });
  improvement = new modules.ImprovementWorker({snapshot:()=>office.officeSnapshot(),command:request=>office.workerCommand(request),
    workerOptions,priceCatalogPath:path.join(seedDir,'provider-price-catalog.json'),eligibleRoutes:discovery.eligibleRoutes});
  runtime.improvement=improvement;runtime.improvementDiscovery=discovery;
  activity = createActivityJournal({ stateDir: dataDir });
  runtime.activity = activity;
  for (const [method, family, reads] of [
    ['hostOperation', 'host', ['status', 'inspect']], ['environmentOperation', 'environment', ['status', 'inspect']],
    ['resourceOperation', 'resource', ['status', 'inspect', 'resolve']], ['designOperation', 'design', ['catalog', 'inspect']],
    ['modelOperation', 'model', ['snapshot']],
  ]) {
    const invoke = runtime[method].bind(runtime);
    runtime[method] = (operation, input) => reads.includes(operation) || !ACTIVITY_OPERATIONS[family].includes(operation)
      ? invoke(operation, input) : observe(family, operation, input, () => invoke(operation, input));
  }
  const command = runtime.command.bind(runtime);
  runtime.command = input => observe('office', ACTIVITY_OPERATIONS.office.includes(input?.command?.action) ? input.command.action : 'command',
    { ...metadata(input?.command), requestId: input?.id }, () => command(input));
  for (const method of ['setEnabled', 'runOnce']) {
    const invoke = runtime[method].bind(runtime);
    runtime[method] = (...args) => observe('worker', method, {}, () => invoke(...args));
  }
  const additional = {};
  for (const [prefix, operations, dispatch] of [
    ['environment', ['status', 'prepare', 'inspect', 'run'], (operation, input) => runtime.environmentOperation(operation, input)],
    ['resource', ['status', 'configure', 'resolve', 'plan', 'start', 'inspect', 'cancel'], (operation, input) => runtime.resourceOperation(operation, input)],
    ['design', ['catalog', 'plan', 'install', 'inspect'], (operation, input) => runtime.designOperation(operation, input)],
    ['activity', ['status', 'query', 'summarize'], (operation, input) => runtime.activityOperation(operation, input)],
  ]) for (const operation of operations) {
    additional[prefix + operation[0].toUpperCase() + operation.slice(1)] = {
      minArgs: ['status','catalog'].includes(operation) || prefix === 'activity' ? 0 : 1, maxArgs: operation === 'catalog' || ['environment','activity'].includes(prefix) && operation === 'status' ? 0 : 1,
      mutates: !['status', 'inspect', 'resolve','catalog','query','summarize'].includes(operation), handler: args => dispatch(operation, args[0] ?? {}),
    };
  }
  workbench.addMethods(additional);
  const workbenchCall = workbench.call.bind(workbench);
  workbench.call = (method, args = [], context = {}) => {
    const { spec } = workbench.validateEnvelope({ method, args, ...(context.id !== undefined ? { id: context.id } : {}) });
    const invoke = () => workbenchCall(method, args, context);
    // Runtime-routed mutations already have their own precise audit entry.
    const recordedByRuntime = method === 'officeCommand' || /^(host|environment|resource|design)/.test(method)
      || ['setOfficeWorker','runOfficeQueue','modelPoolRequest','modelPoolCancel','modelPoolSelect'].includes(method);
    return spec?.mutates && !recordedByRuntime ? observe('workbench', method,
      { ...metadata(args[0]), requestId: context.id }, invoke) : invoke();
  };
  office.startObserving(); cloudSync.start(); improvement.start();
  return runtime;
}
