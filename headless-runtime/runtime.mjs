import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { RuntimeError, validateCommandEnvelope } from './contract.mjs';
import { readSecretFile } from './secrets.mjs';
import { HeadlessCloudSync } from './cloud-sync.mjs';
import { createHostControl } from './host-control.mjs';
import { validateHostOperation } from './host-control-contract.mjs';

const require = createRequire(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function publicWorkerStatus(worker) {
  const state = worker.status();
  return {
    enabled: state.enabled === true,
    running: state.running === true,
    activeJobId: typeof state.activeJobId === 'string' ? state.activeJobId : null,
    activeJobIds: Array.isArray(state.activeJobIds) ? state.activeJobIds : [],
    concurrency: state.concurrency ?? 1,
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
    const host = this.hostControl ? (await this.hostOperation('status', {})).host
      : { configured: false, mode: 'off', revision: 0, grants: [], jobs: [], capabilities: {} };
    return { ok: true, execution: 'headless', worker: publicWorkerStatus(this.worker),
      observer: this.office.observerStatus?.() ?? null,
      cloud: this.cloudSync?.status() ?? { configured: false, connected: false, revision: null, error: null },
      host: { configured: host.configured === true, available: host.available === true, mode: host.mode, revision: host.revision,
        grantCount: host.grants.length, jobCount: host.jobCount ?? host.jobs.length },
      capabilities: { providerJobs: true, cloudSync: false, ...this.capabilities,
        hostControl: host.configured === true, arbitraryCode: host.configured === true,
        hostControlActive: host.configured === true && host.mode !== 'off' } };
  }

  projection(snapshot) {
    try { return { snapshot: this.projectSnapshot(snapshot), stateHash: this.stateHash(snapshot) }; }
    catch { throw new RuntimeError('PROJECTION_UNAVAILABLE',
      'The workspace cannot be safely projected within the current limits. Inspect it locally.', 503); }
  }

  async snapshot() {
    return { ok: true, ...this.projection(unwrap(await this.office.officeSnapshot())) };
  }

  async command(body) {
    const envelope = validateCommandEnvelope(body);
    const snapshot = unwrap(await this.office.officeCommand({ action: 'apply_remote_command', ...envelope }));
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
    try { return await this.modelPool[operation](input); }
    catch (error) {
      if (error?.name === 'ModelPoolError' && /^[A-Z_]{1,80}$/.test(error.code)) {
        throw new RuntimeError(error.code, error.message, error.status);
      }
      throw new RuntimeError('MODEL_UNAVAILABLE', 'The local model operation could not be confirmed. Inspect model status before a new request.', 503);
    }
  }

  async hostOperation(operation, input = {}) {
    if (!this.hostControl || !['status', 'configure', 'submit', 'approve', 'cancel', 'inspect', 'stopAll'].includes(operation)) {
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
      return { ok: true, worker: publicWorkerStatus(this.worker) };
    }
    this.worker.setEnabled(enabled);
    return { ok: true, worker: publicWorkerStatus(this.worker) };
  }

  runOnce() {
    if (this.singleRun || this.worker.status().running) {
      throw new RuntimeError('WORKER_RUNNING', 'A worker attempt is already running.', 409);
    }
    this.singleRun = Promise.resolve(this.worker.runOnce()).catch(() => undefined)
      .finally(() => { this.singleRun = null; });
    return { ok: true, accepted: true, worker: publicWorkerStatus(this.worker) };
  }

  async close() {
    this.office.stopObserving?.();
    this.worker.stop();
    await this.cloudSync?.close();
    await this.modelPool?.close();
    await this.hostControl?.close();
    // The pool aborts provider calls. A short grace period allows their durable
    // settlement; an unconfirmed attempt is reconciled by native lease recovery.
    const deadline = Date.now() + 10000;
    while (this.worker.status().running && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
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
      ...require(path.join(dist, 'providers.js')),
      ...require(path.join(dist, 'ollama.js')),
      ...require(path.join(dist, 'modelPool.js')),
      ...require(path.join(dist, 'cloudSync.js')),
    };
  } catch {
    throw new RuntimeError('BUILD_REQUIRED', 'Build the portable runtime modules before starting the service.', 503);
  }
  const secrets = options.secretFiles ?? {};
  const getSecret = provider => secrets[provider] ? readSecretFile(secrets[provider]) : null;
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
    snapshot: () => office.officeSnapshot(), command: request => office.officeCommand(request),
    ...(options.cloudFetch ? { fetchImpl: options.cloudFetch } : {}) });
  const modelPool = new modules.ModelPoolService({ stateDir: dataDir, snapshot: () => office.officeSnapshot(),
    baseUrl: options.ollamaBaseUrl, localOnlyConfirmed: options.ollamaLocalOnly === true,
    ...(options.modelFetch ? { fetchFn: options.modelFetch } : {}) });
  const hostControl = createHostControl({ stateDir: dataDir, enabled: options.hostControlEnabled === true,
    snapshot: () => office.officeSnapshot() });
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
  const worker = new modules.OfficeWorkerPool({
    snapshot: () => office.officeSnapshot(), command: request => office.workerCommand(request),
    artifactRoot: path.join(dataDir, 'office-artifacts'), seedDir, generate,
    prepareContext: job => office.prepareWorkerContext(job),
    validateJob: job => modelPool.validateJob(job),
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
  }, concurrency);
  office.startObserving();
  cloudSync.start();
  return new RuntimeController({ office, worker, modelPool, cloudSync, hostControl,
    projectSnapshot: modules.cloudSnapshot, stateHash: modules.syncStateHash,
    capabilities: { providerAdapters: ['openai', 'anthropic', 'ollama-loopback'],
      configuredProviders: ['openai', 'anthropic'].filter(provider => !!secrets[provider]),
      githubRead: !!secrets.github, githubPublish: !!secrets.github, sharedModels: options.ollamaLocalOnly === true,
      cloudSync: options.cloudSyncEnabled === true } });
}
