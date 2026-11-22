/** Portable owner workbench. Electron remains a platform adapter, never a backend dependency. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createEncryptedCloudStorage } from './cloud-sync.mjs';
import { readSecretFile } from './secrets.mjs';
import { atomicJson, privateDirectory, readJson, processIdentity } from './host-control-contract.mjs';
import { WORKBENCH_METHODS, MANAGED_OFFICE_ACTIONS, WorkbenchError, validateWorkbenchCall, validateWorkbenchEnvelope } from './workbench-contract.mjs';

const require = createRequire(import.meta.url);
const RECEIPT_LIMIT = 512;
const genericError = 'Workbench operation could not be confirmed. Inspect current state before a new request; no automatic retry was sent.';
const executable = promisify(execFile);
const now = () => new Date().toISOString();
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function createWorkbench({ runtime, repoRoot, dataDir, secretFiles = {}, platform = {} }) {
  if (!runtime?.office || !runtime?.worker || typeof repoRoot !== 'string' || typeof dataDir !== 'string') throw new WorkbenchError('WORKBENCH_CONFIG', 'Native runtime and private workbench paths are required.', 503);
  const dist = path.join(repoRoot, 'desktop-shell/dist/main');
  let modules;
  try { modules = Object.assign({}, ...['company', 'projects', 'catalog', 'systemInfo', 'venv', 'downloads', 'jobs', 'settings', 'vault', 'providers', 'ollama', 'globalBudget', 'cloudSync'].map(name => require(path.join(dist, `${name}.js`)))); }
  catch { throw new WorkbenchError('WORKBENCH_BUILD', 'Build the portable workbench modules before starting.', 503); }
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 }); privateDirectory(dataDir);
  const directory = path.join(dataDir, 'workbench'); privateDirectory(directory, true);
  const keyFile = path.join(directory, 'vault.key');
  try { fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw new WorkbenchError('WORKBENCH_STORAGE', 'Private credential storage is unavailable.', 503); }
  const storage = createEncryptedCloudStorage(keyFile, 'https://daftar-workbench.invalid');
  const lockFile = path.join(directory, 'owner.lock'); const nonce = crypto.randomUUID();
  try {
  const owner = { pid: process.pid, identity: processIdentity(process.pid), nonce };
  const acquire = () => fs.writeFileSync(lockFile, JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
  try { acquire(); }
  catch (error) {
    if (error.code !== 'EEXIST') { storage.destroy(); throw new WorkbenchError('WORKBENCH_STORAGE', 'Workbench ownership could not be saved.', 503); }
    const old = readJson(lockFile, 2048);
    let alive = true;
    if (!Number.isInteger(old?.pid) || old.pid < 1) { storage.destroy(); throw new WorkbenchError('WORKBENCH_BUSY', 'Workbench ownership requires local review.', 503); }
    try { process.kill(old.pid, 0); } catch (failure) { if (failure.code === 'ESRCH') alive = false; }
    const identity = processIdentity(old.pid);
    if (alive && (!identity || !old.identity || identity === old.identity)) { storage.destroy(); throw new WorkbenchError('WORKBENCH_BUSY', 'Another workbench owns this state directory.', 409); }
    fs.unlinkSync(lockFile); acquire();
  }
  const receiptFile = path.join(directory, 'receipts.json');
  let receipts;
  try {
    receipts = readJson(receiptFile, 16 * 1024 * 1024, true) ?? [];
    if (!Array.isArray(receipts) || receipts.length > RECEIPT_LIMIT || receipts.some(row => !row || typeof row.id !== 'string' || !/^[a-f0-9]{64}$/.test(row.hash) || !['pending', 'done'].includes(row.state))) throw new Error();
  } catch { fs.unlinkSync(lockFile); storage.destroy(); throw new WorkbenchError('WORKBENCH_STORAGE', 'Workbench receipts require local review.', 503); }
  let closed = false, closing = false, fenced = false, dispatched = false, chain = Promise.resolve();
  const methods = { ...WORKBENCH_METHODS }; const extraHandlers = new Map();
  const lifetime = new AbortController(); const pending = new Set(); const activeRuns = new Set(); const ownedJobs = new Set();
  const vault = new modules.CredentialVault(dataDir, storage);
  const settings = new modules.SettingsStore(dataDir);
  const projects = new modules.ProjectStore(dataDir);
  const jobs = new modules.JobManager(path.join(directory, 'logs'));
  const getSecret = provider => secretFiles[provider] ? readSecretFile(secretFiles[provider]) : vault.getKey(provider);
  const fetcher = async (url, options = {}) => (platform.fetch ?? globalThis.fetch)(url, { ...options,
    signal: options.signal ? AbortSignal.any([options.signal, lifetime.signal]) : lifetime.signal });
  const assertLegacyModelScope = provider => {
    if (provider === 'ollama' && runtime.resources?.isEnforced()) throw new WorkbenchError('WORKBENCH_RESOURCE_SCOPE_REQUIRED',
      'Shared model ownership is enabled. Use resourcePlan and resourceStart with a company, employee and granted model resource; legacy projects do not carry this scope.', 403);
  };
  const generateAdapter = platform.generate ?? (async request => {
    if (request.provider === 'ollama') return modules.generateWithOllama(request, fetcher);
    const key = getSecret(request.provider);
    if (!key) throw new WorkbenchError('WORKBENCH_CREDENTIAL', 'Configure a usable provider credential first.', 403);
    return modules.generateWithProvider(request.provider, key, request, platform.providerSdk);
  });
  // Check immediately before every dispatch, including an already active project
  // and trusted test adapters. Enabling ownership cannot leave a legacy lane open.
  const generate = async request => { assertLegacyModelScope(request.provider); return generateAdapter(request); };
  const runner = new modules.ProjectRunner(projects, modules.withGlobalBudget(async request => generate({ ...request,
    abortSignal: AbortSignal.any([request.abortSignal, lifetime.signal]) }), request => runtime.office.workerCommand(request)));
  const onRun = run => { if (['running', 'paused'].includes(run.status)) activeRuns.add(run.id); else activeRuns.delete(run.id); };
  runner.on('run', onRun);
  const company = new modules.CompanyService({ userDataPath: dataDir, seedDir: path.join(repoRoot, 'company'),
    binaryPath: runtime.binaryPath ?? path.join(repoRoot, 'native-core/target/release/atlas-core'), repositoryRoot: repoRoot,
    listRuns: () => projects.listRuns(), fetch: fetcher });
  const catalogPath = path.join(repoRoot, 'desktop-shell/models.catalog.json');
  const system = () => platform.systemInfo ? platform.systemInfo(dataDir) : modules.getSystemInfo(dataDir, {
    execFileFn: async (file, args, options) => (platform.execFile ?? executable)(file, args, { ...options, shell: false, windowsHide: true, signal: lifetime.signal }) });
  // Environment-managed cloud synchronization retains its deployment protocol.
  // Otherwise the same explicit manual CloudSyncService used by desktop is reused.
  const managedCloud = runtime.cloudSync?.enabled === true;
  const cloud = managedCloud ? runtime.cloudSync.service : new modules.CloudSyncService({ userDataPath: dataDir, safeStorage: storage,
    snapshot: () => runtime.office.officeSnapshot(), command: request => runtime.office.officeCommand(request), fetch: fetcher });
  const saveReceipts = () => {
    try { const bytes = JSON.stringify(receipts); if (Buffer.byteLength(bytes) > 16 * 1024 * 1024) throw new Error(); atomicJson(receiptFile, receipts); }
    catch { fenced = true; throw new WorkbenchError('WORKBENCH_STORAGE_UNCERTAIN', 'Receipt persistence is uncertain. Reopen and inspect this workbench before further mutations.', 503); }
  };
  const sanitize = value => {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (['leaseToken', 'workerId', 'deviceToken', 'siteAccessToken', 'apiKey', 'remoteReceipts'].includes(key)) continue;
      out[key] = (key === 'error' || key === 'lastError' || key === 'githubError') && item ? genericError : sanitize(item);
    }
    return out;
  };
  const vaultStatus = () => {
    const status = vault.status();
    for (const provider of ['openai', 'anthropic', 'github']) if (secretFiles[provider]) {
      let readable = false; try { readable = Boolean(getSecret(provider)); } catch {}
      status.providers[provider] = { configured: true, readable, updatedAt: null, source: 'deployment-secret-file' };
    }
    return { ...status, storage: 'aes-256-gcm-protected-file-key', osKeychain: false };
  };
  const background = (kind, task) => {
    if (ownedJobs.size >= 32) throw new WorkbenchError('WORKBENCH_CAPACITY', 'Too many managed downloads or environment jobs are active.', 409);
    const { job, signal } = jobs.createJob(kind, kind === 'create-venv' ? 'Create Python environment' : 'Download reviewed model');
    ownedJobs.add(job.id); jobs.update(job.id, { status: 'running', progress: 0 });
    const operation = Promise.resolve().then(() => task(job, AbortSignal.any([signal, lifetime.signal])))
      .then(() => jobs.finish(job.id, signal.aborted || lifetime.signal.aborted ? 'cancelled' : 'succeeded'))
      .catch(() => jobs.finish(job.id, signal.aborted || lifetime.signal.aborted ? 'cancelled' : 'failed', genericError))
      .finally(() => { ownedJobs.delete(job.id); pending.delete(operation); });
    pending.add(operation); return { ok: true, jobId: job.id, pending: true };
  };
  async function dispatch(method, args, id) {
    if (extraHandlers.has(method)) return extraHandlers.get(method)(args, { id, signal: lifetime.signal });
    const host = { hostStatus: 'status', hostConfigure: 'configure', hostSubmit: 'submit', hostApprove: 'approve', hostCancel: 'cancel', hostInspect: 'inspect', hostStopAll: 'stopAll' };
    if (Object.hasOwn(host, method)) return runtime.hostOperation(host[method], args[0] ?? {});
    if (methods[method].platformDelegated) return { ok: false, code: 'PLATFORM_DELEGATION', delegated: true, action: method,
      error: 'This action belongs to the editor or desktop platform. No platform action was performed.' };
    switch (method) {
      case 'officeSnapshot': return runtime.snapshot();
      case 'officeCommand': {
        const { expectedStateHash, command } = args[0];
        if (!MANAGED_OFFICE_ACTIONS.includes(command.action)) return runtime.command({ id, expectedStateHash, command });
        const current = await runtime.snapshot();
        if (current.stateHash !== expectedStateHash) throw new WorkbenchError('CONFLICT', 'Office state changed. Read it before preparing a new owner command.', 409);
        const result = await runtime.office.officeCommand(command);
        if (!result?.ok || !result.snapshot) throw new WorkbenchError('WORKBENCH_OFFICE_UNCERTAIN', genericError, 503);
        const projected = runtime.projection(result.snapshot);
        // Managed owner results are needed by the renderer, but are not part of
        // synchronized state. Keep CAS on the unchanged native cloud projection.
        const lastAction = {};
        for (const key of ['github', 'ledgerWarning', 'reviewScheduleIds', 'created', 'enabled']) {
          if (Object.hasOwn(result.snapshot.lastAction ?? {}, key)) lastAction[key] = result.snapshot.lastAction[key];
        }
        return { ok: true, id, ...projected, snapshot: { ...projected.snapshot, lastAction: sanitize(lastAction) } };
      }
      case 'officeWorkerStatus': return (await runtime.status()).worker;
      case 'setOfficeWorker': return runtime.setEnabled(args[0].enabled).worker;
      case 'runOfficeQueue': return runtime.runOnce().worker;
      case 'modelPoolSnapshot': return runtime.modelOperation('snapshot', args[0]);
      case 'modelPoolRequest': return runtime.modelOperation('request', args[0]);
      case 'modelPoolCancel': return runtime.modelOperation('cancel', args[0]);
      case 'modelPoolSelect': return runtime.modelOperation('select', args[0]);
      case 'companySnapshot': return company.companySnapshot();
      case 'registerCompany': return company.registerCompany(args[0]);
      case 'refreshCompany': return company.refreshCompany();
      case 'updateCompanyTask': return company.updateCompanyTask(args[0]);
      case 'indexCompanyRepository': return company.indexCompanyRepository();
      case 'getSystemInfo': return system();
      case 'getModelCatalog': return modules.loadCatalog(catalogPath);
      case 'checkModelRequirements': {
        const model = modules.findModel(modules.loadCatalog(catalogPath), args[0]);
        if (!model) throw new WorkbenchError('WORKBENCH_INPUT', 'Choose a reviewed catalog model.');
        return modules.checkModelRequirements(model, await system());
      }
      case 'downloadModel': {
        const request = args[0];
        if (request?.confirmed !== true || typeof request.modelId !== 'string') throw new WorkbenchError('WORKBENCH_INPUT', 'A reviewed model and explicit confirmation are required.');
        const model = modules.findModel(modules.loadCatalog(catalogPath), request.modelId);
        if (!model) throw new WorkbenchError('WORKBENCH_INPUT', 'Choose a reviewed catalog model.');
        modules.assertModelDownloadable(model);
        if (!modules.checkModelRequirements(model, await system()).canDownload) throw new WorkbenchError('WORKBENCH_REQUIREMENTS', 'This host does not meet the model requirements.');
        return background('download-model', (job, signal) => modules.downloadModelFiles({ fetchFn: fetcher, model, modelsRoot: path.join(dataDir, 'models'), signal,
          onProgress: (progress) => jobs.update(job.id, { progress }) }));
      }
      case 'createVenv': {
        const request = args[0];
        if (request?.confirmed !== true) throw new WorkbenchError('WORKBENCH_INPUT', 'Environment creation requires explicit confirmation.');
        const destination = modules.resolveVenvPath(dataDir, request.name);
        const receipt = background('create-venv', (job, signal) => modules.createVenv({ userDataPath: dataDir,
          execFileFn: (file, argv, options) => (platform.execFile ?? executable)(file, argv, { ...options, shell: false, windowsHide: true, signal }),
          onProgress: () => jobs.update(job.id, { detail: 'Preparing Python environment' }) }, request));
        return { ...receipt, path: destination, pythonPath: modules.venvPythonPath(destination) };
      }
      case 'getJobStatus': return jobs.list(args[0]);
      case 'cancelJob': return jobs.cancel(args[0]);
      case 'getSettings': {
        const value = settings.get();
        if (value.runtimeUrl) { const url = new URL(value.runtimeUrl); url.search = ''; url.hash = ''; value.runtimeUrl = url.href; }
        return value;
      }
      case 'getVaultStatus': return vaultStatus();
      case 'setApiKey': {
        if (secretFiles[args[0]]) throw new WorkbenchError('WORKBENCH_DEPLOYMENT_SECRET', 'This credential is supplied by deployment configuration. Remove that secret file setting before replacing it in the workbench.', 409);
        return { ...vault.setKey(args[0], args[1]), status: vaultStatus() };
      }
      case 'revokeApiKey': {
        if (secretFiles[args[0]]) throw new WorkbenchError('WORKBENCH_DEPLOYMENT_SECRET', 'This credential is supplied by deployment configuration. Remove that secret file setting to revoke it.', 409);
        return { ...vault.revoke(args[0]), status: vaultStatus() };
      }
      case 'listProviderModels': {
        if (args[0] === 'ollama') { const value = await modules.detectOllama(fetcher); return { ok: value.available, models: value.models, error: value.error }; }
        if (!modules.isApiProvider(args[0])) throw new WorkbenchError('WORKBENCH_INPUT', 'Unknown model provider.');
        const key = getSecret(args[0]); if (!key) return { ok: false, models: [], error: 'Configure a usable provider credential first.' };
        return { ok: true, models: await modules.listProviderModels(args[0], key, fetcher) };
      }
      case 'detectOllama': return modules.detectOllama(fetcher);
      case 'listProjects': return projects.listProjects();
      case 'createProject': return { ok: true, project: projects.createProject(args[0]) };
      case 'getProject': return projects.getProject(args[0]);
      case 'startRun': {
        const project = projects.getProject(args[0]?.projectId); if (project) assertLegacyModelScope(project.provider);
        return runner.start(args[0]?.projectId, args[0]?.runBudget, args[0]?.priceRates);
      }
      case 'pauseRun': return runner.pause(args[0]);
      case 'resumeRun': {
        const run = projects.listRuns().find(item => item.id === args[0]);
        if (run) { const project = projects.getProject(run.projectId); if (project) assertLegacyModelScope(project.provider); }
        return runner.resume(args[0]);
      }
      case 'cancelRun': return runner.cancel(args[0]);
      case 'listRuns': return projects.listRuns(args[0]);
      case 'readArtifact': { const result = projects.readArtifact(...args); return result ? { ok: true, ...result } : { ok: false, error: 'Artifact not found.' }; }
      case 'cloudStatus': return cloud.status();
      case 'configureCloud':
        if (managedCloud) throw new WorkbenchError('WORKBENCH_DEPLOYMENT_CLOUD', 'Cloud pairing is managed by deployment files. Change that deployment configuration first.', 409);
        return cloud.configure(args[0]);
      case 'syncCloud': return managedCloud ? runtime.cloudSync.syncOnce() : cloud.sync();
      case 'disconnectCloud':
        if (managedCloud) throw new WorkbenchError('WORKBENCH_DEPLOYMENT_CLOUD', 'Cloud pairing is managed by deployment files. Change that deployment configuration first.', 409);
        return cloud.disconnect();
      default: throw new WorkbenchError('WORKBENCH_METHOD', 'Workbench method is unavailable.', 404);
    }
  }
  const capabilities = () => ({ version: 1, transport: 'headless-workbench', credentialStorage: 'aes-256-gcm-protected-file-key', osKeychain: false,
    legacyOllamaScopeRequiresResources: runtime.resources?.isEnforced() === true,
    legacyOllamaScopeGuidance: 'When shared model ownership is enabled, use resourcePlan/resourceStart with canonical company, employee and resource scope. Existing legacy projects can still use budgeted OpenAI/Anthropic providers.',
    officeCommandInput: '{expectedStateHash,command}', lifecycle: 'owned jobs are cancelled on close; uncertain mutations are never replayed automatically',
    methods: Object.fromEntries(Object.entries(methods).map(([name, value]) => [name, { available: !value.platformDelegated,
      mutates: value.mutates, platformDelegated: value.platformDelegated, minArgs: value.minArgs, maxArgs: value.maxArgs,
      ...(managedCloud && ['configureCloud', 'disconnectCloud'].includes(name) ? { available: false, reason: 'deployment-managed' } : {}) }])) });
  function call(method, args = [], options = {}) {
    const input = validateWorkbenchCall(method, args, options.id, methods);
    const execute = async () => {
      if (closed || closing) throw new WorkbenchError('WORKBENCH_CLOSED', 'This workbench is closed.', 503);
      dispatched = true;
      if (options.signal?.aborted) throw new WorkbenchError('WORKBENCH_ABORTED', 'Request was cancelled before dispatch.', 409);
      if (input.spec.mutates && fenced) throw new WorkbenchError('WORKBENCH_STORAGE_UNCERTAIN', 'Receipt persistence requires reopening and review.', 503);
      const nativeReceipt = (method === 'officeCommand' && !MANAGED_OFFICE_ACTIONS.includes(args[0].command.action)) || ['hostSubmit', 'hostApprove', 'hostCancel'].includes(method);
      const durable = input.spec.mutates && !nativeReceipt;
      const requestHash = hash({ method, args }); let receipt;
      if (durable) {
        receipt = receipts.find(row => row.id === options.id);
        if (receipt && receipt.hash !== requestHash) throw new WorkbenchError('WORKBENCH_ID_CONFLICT', 'This request id belongs to a different operation.', 409);
        if (receipt?.state === 'pending') throw new WorkbenchError('WORKBENCH_UNCERTAIN', 'This request has an uncertain saved outcome. Inspect its state; it will not be executed again.', 409);
        if (receipt?.state === 'done') return structuredClone(receipt.result);
        if (receipts.length >= RECEIPT_LIMIT) throw new WorkbenchError('WORKBENCH_CAPACITY', 'The workbench receipt limit needs local archival.', 409);
        receipt = { id: options.id, hash: requestHash, state: 'pending', at: now() }; receipts.push(receipt); saveReceipts();
      }
      try {
        const result = sanitize(await dispatch(method, args, options.id));
        if (durable) { receipt.state = 'done'; receipt.result = result; saveReceipts(); }
        return result;
      } catch (error) {
        if (error instanceof WorkbenchError || error?.name === 'RuntimeError') throw error;
        throw new WorkbenchError('WORKBENCH_FAILED', genericError, 503);
      }
    };
    const result = chain.then(execute); chain = result.catch(() => undefined); return result;
  }
  async function close() {
    if (closed) return;
    closing = true; lifetime.abort();
    for (const id of ownedJobs) jobs.cancel(id);
    for (const id of activeRuns) runner.cancel(id);
    await chain;
    await Promise.allSettled([...pending]);
    const deadline = Date.now() + 10000;
    while (activeRuns.size && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    runner.removeListener('run', onRun); jobs.removeAllListeners();
    if (readJson(lockFile, 2048, true)?.nonce === nonce) fs.unlinkSync(lockFile);
    storage.destroy(); closed = true;
  }
  const addMethods = additions => {
    if (dispatched || closed || !additions || typeof additions !== 'object') throw new WorkbenchError('WORKBENCH_CONFIG', 'Register trusted methods before workbench dispatch.', 503);
    for (const [name, entry] of Object.entries(additions)) {
      if (!/^[A-Za-z][A-Za-z0-9]{1,63}$/.test(name) || Object.hasOwn(methods, name) || typeof entry?.handler !== 'function'
          || !Number.isInteger(entry.minArgs) || !Number.isInteger(entry.maxArgs) || entry.minArgs < 0 || entry.maxArgs < entry.minArgs || entry.maxArgs > 8 || typeof entry.mutates !== 'boolean') throw new WorkbenchError('WORKBENCH_CONFIG', 'Invalid trusted workbench method registration.', 503);
      methods[name] = { minArgs: entry.minArgs, maxArgs: entry.maxArgs, mutates: entry.mutates, platformDelegated: false };
      extraHandlers.set(name, entry.handler);
    }
  };
  return { call, capabilities, close, getSecret, addMethods, cloudStatus: () => sanitize(cloud.status()), validateEnvelope: value => validateWorkbenchEnvelope(value, methods),
    diagnostics: () => ({ closed, activeJobs: ownedJobs.size, activeRuns: activeRuns.size, pending: pending.size, listeners: runner.listenerCount('run') + jobs.eventNames().reduce((sum, name) => sum + jobs.listenerCount(name), 0) }) };
  } catch (error) {
    try { if (readJson(lockFile, 2048, true)?.nonce === nonce) fs.unlinkSync(lockFile); } catch {}
    storage.destroy();
    if (error instanceof WorkbenchError) throw error;
    throw new WorkbenchError('WORKBENCH_STORAGE', 'Portable workbench initialization failed. Inspect private storage and its build.', 503);
  }
}
