'use strict';
const vscode = require('vscode');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { AtlasClient, origin, studioUrl } = require('./client');
const {OPERATIONS,scopeRecords,managementCommand,ownershipSummary}=require('./management');
const {askCreativeAction,inventoryText}=require('./creative');
const {PRIMARY_MODEL,developmentReport,askDevelopmentAction,boundedMoECommand}=require('./development');
const { RuntimeClient } = require('./runtime-client');
const { ComputeConnection, fetchVastInstances, validateProfile } = require('./compute-connection');
const { createOfficePanel } = require('./workbench-panel');
const { createLocalRuntime } = require('./local-runtime');
const { createPersistentRuntime } = require('./persistent-runtime');
const { createComputeOffice } = require('./compute-office');
const SECRET_KEY = 'atlas.office.connection.v1';
const VAST_KEY = 'daftar.compute.vast.api-key';
const PROFILE_KEY = 'daftar.compute.profiles.v1';
const GUIDE = 'https://github.com/occult-kranti/engineering-intelligence-atlas/blob/design/infinite-blueprint-canvas/project/VSCODE_PRIMARY_PRODUCT.md';
const TOKEN = /^[A-Za-z0-9_-]{32,256}$/;
let deactivateActive = async () => {};
function safeMessage(error) {
  const raw = error && typeof error.message === 'string' ? error.message : 'Daftar could not complete this operation. Inspect its saved state.';
  return raw.replace(/(?:sk-ant-|sk-proj-|sk-|github_pat_|gh[pousr]_)[A-Za-z0-9_-]+/g,'[credential removed]').replace(/Bearer\s+[A-Za-z0-9._~-]+/gi,'Bearer [credential removed]').replace(/atlas_session=[a-f0-9]+/gi,'atlas_session=[credential removed]').slice(0,500);
}
function activate(context) {
  let connection = null, client = null, capabilities = null, verified = false;
  let lastSnapshot = null, selectedCompany = context.globalState.get('atlas.company', ''), scopeEpoch = 0, activeAction = false;
  let panel, view, launcher, persistent, tunnel, disposed = false, epoch = 0, busyConnect = false;
  let refreshPromise = null, pollPromise = null;
  let activeSetup = null, secretWrites = Promise.resolve();
  const pending = new Set();
  const own = value => { context.subscriptions.push(value); return value; };
  const status = own(vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20));
  status.command = 'atlas.openOffice'; status.text = '$(organization) Daftar'; status.show();
  const requireTrust = () => { if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before controlling its files and compute.'); };
  const info = () => ({ connected: verified, configured: !!connection, connectionEpoch: epoch, kind: connection?.kind ?? null, url: connection?.url ?? null,
    location: vscode.env.remoteName ? `Remote extension host (${vscode.env.remoteName})` : 'This computer',
    capabilities: capabilities?.methods ? Object.fromEntries(Object.entries(capabilities.methods).map(([name, value]) => [name, value.available === true || value.platformDelegated === true])) : capabilities,
    notice: connection ? verified ? 'Connected to the owner workspace.' : 'Connection saved; runtime readiness has not been verified.' : 'Start a workspace here or connect an existing private runtime.' });
  const post = message => { if(!disposed) { void view?.webview.postMessage(message); if(message.type==='notice')notify(message.message); } };
  const currentClient = () => { if(!client)throw new Error('Start a workspace or connect an existing desktop, website or runtime first.'); return client; };
  const chooseCompany = snapshot => { if(!snapshot?.companies?.some(row=>row.id===selectedCompany))selectedCompany=snapshot?.companies?.find(row=>row.id===snapshot.activeCompanyId)?.id||snapshot?.companies?.[0]?.id||''; };
  const publish = () => {
    if (disposed) return;
    const value = info(); panel?.notifyConnection(value); void view?.webview.postMessage({ type: 'state', ...value, connection: connection ? {kind:connection.kind,url:connection.url} : null, snapshot:lastSnapshot, selectedCompany, ownership:lastSnapshot&&selectedCompany?ownershipSummary(lastSnapshot,selectedCompany):[] });
    status.text = verified ? '$(organization) Daftar' : connection ? '$(plug) Daftar offline' : '$(organization) Daftar';
    status.tooltip = `${value.location}. ${value.notice}`;
  };
  const notify = message => { if (!disposed) { void vscode.window.showInformationMessage(String(message).slice(0, 800)); panel?.postEvent('compute', { message: String(message).slice(0, 800) }); } };
  const makeClient = value => {
    if (value?.kind === 'runtime') return new RuntimeClient(value);
    if (!value || !['desktop','cloud'].includes(value.kind)) throw new Error('Unknown saved connection type.');
    return new AtlasClient({ ...value, url: origin(value.url) });
  };
  const assertSetup = () => { if (disposed || !activeSetup || activeSetup.abort.signal.aborted || activeSetup.epoch !== epoch) throw new Error('Connection setup was cancelled.'); };
  const writeConnection = (value, generation) => {
    const operation = secretWrites.then(async () => {
      if (generation !== epoch || (disposed && value !== null)) return;
      if (value === null) await context.secrets.delete(SECRET_KEY);
      else await context.secrets.store(SECRET_KEY, JSON.stringify(value));
    });
    secretWrites = operation.catch(() => {}); return operation;
  };
  const restored = (async () => {
    const generation = epoch; const stored = await context.secrets.get(SECRET_KEY);
    if (!stored || disposed || generation !== epoch) return;
    try {
      if (stored.length > 18000) throw new Error();
      const value = JSON.parse(stored); const next = makeClient(value);
      if (disposed || generation !== epoch) { next.close?.(); return; }
      connection = value; client = next; publish();
    } catch { notify('The saved connection needs to be paired again.'); }
  })();
  async function useConnection(next) {
    requireTrust(); assertSetup(); const generation = ++epoch; activeSetup.epoch = generation;
    const candidate = makeClient(next); pending.add(candidate);
    try {
      const metadata = next.kind === 'runtime' ? await candidate.capabilities() : null;
      const initial = await candidate.snapshot();
      if (disposed || generation !== epoch) throw new Error('Connection selection changed before verification completed.');
      await writeConnection(next, generation);
      if (disposed || generation !== epoch) throw new Error('Connection selection changed.');
      client?.close?.(); connection = next; client = candidate; lastSnapshot = initial.snapshot; chooseCompany(lastSnapshot); capabilities = metadata; verified = true; publish();
    } finally { pending.delete(candidate); if (client !== candidate) candidate.close?.(); }
  }
  async function withConnectionSetup(action) {
    requireTrust(); if (busyConnect) throw new Error('Finish the current connection setup first.');
    busyConnect = true; const setup = { epoch, abort: new AbortController() }; activeSetup = setup;
    try { await restored; assertSetup(); return await action(); }
    finally { if (activeSetup === setup) activeSetup = null; busyConnect = false; }
  }
  async function refresh() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      await restored; if (!client || disposed || !vscode.workspace.isTrusted) { publish(); return; }
      const generation = epoch; const current = client;
      try {
        const result = await current.snapshot();
        if (generation !== epoch || disposed) return;
        if (connection.kind === 'runtime' && !capabilities) capabilities = await current.capabilities();
        if (generation !== epoch || disposed) return;
        lastSnapshot = result.snapshot; chooseCompany(lastSnapshot); verified = true; publish(); panel?.postEvent('office', result); await readCompanyStatus(current, generation); return result;
      } catch (error) { if (generation === epoch && !disposed) { verified = false; publish(); } throw error; }
    })().finally(() => { refreshPromise = null; });
    return refreshPromise;
  }
  async function readCompanyStatus(current, generation) {
    const companyId=selectedCompany, scope=scopeEpoch;
    if(!companyId||!view)return;
    const reads=await Promise.allSettled([
      current.development(companyId),
      connection?.kind==='runtime'?current.creative('snapshot',{companyId}):Promise.resolve(null),
      connection?.kind==='cloud'?current.chatHistory(companyId):Promise.resolve(null),
    ]);
    if(disposed||generation!==epoch||scope!==scopeEpoch||current!==client||companyId!==selectedCompany)return;
    post({type:'developmentState',companyId,...(reads[0].status==='fulfilled'?reads[0].value:{error:'Model and worker observations are unavailable.'})});
    if(reads[1].status==='fulfilled'&&reads[1].value)post({type:'creativeState',companyId,inventory:reads[1].value});
    else if(reads[1].status==='rejected')post({type:'creativeState',companyId,error:safeMessage(reads[1].reason)});
    if(reads[2].status==='fulfilled'&&reads[2].value)post({type:'chatHistory',companyId,messages:reads[2].value.messages||[]});
  }
  async function call(method, args = [], request = {}) {
    requireTrust(); await restored;
    const local = { openCreativeDevelopment:()=>onMessage({type:'creativeDevelopment'}), openComputeCenter: computeCenter, backToLauncher: computeCenter, startLocalRuntime, connectRuntimePrompt: () => connectRuntime(), connectCompute, connectDesktopPrompt: connectDesktop, connectCloudPrompt: connectCloud,
      openPersonalDashboard: openOffice, openOfflineAtlas: openOffice, copyEditorPairing: copyMcpConfig };
    if (Object.hasOwn(local, method)) { await local[method](); return { ok: true }; }
    if (method === 'openExternal') {
      if (typeof args[0] !== 'string' || args[0].length > 2048) throw new Error('Invalid link.');
      const url = new URL(args[0]); if (url.protocol !== 'https:' || url.username || url.password) throw new Error('External links must use HTTPS without credentials.');
      return { ok: await vscode.env.openExternal(vscode.Uri.parse(url.href)) };
    }
    if (method === 'connectRuntime') { await connectRuntime(args[0]); return { ok: true }; }
    if (!client) throw new Error('Start a workspace or connect a private runtime from Compute & connections.');
    if (method === 'setApiKey') return promptProviderKey(args[0]);
    if (method === 'configureCloud') return promptCloudConfiguration();
    if (method === 'importCredentialFile') return importCredentialFile(args[0]);
    if(method==='officeCommand'&&args[0]?.action==='select_company')scopeEpoch++;
    const current = client; const generation = epoch; let result;
    if (connection.kind === 'cloud') {
      if (method === 'officeSnapshot') result = { ok: true, ...(await current.snapshot()) };
      else if (method === 'officeCommand') {
        if (!lastSnapshot) lastSnapshot = (await current.snapshot()).snapshot;
        if (disposed || generation !== epoch) throw new Error('Connection changed before this command was sent.');
        if (args[0]?.action === 'select_company') {
          if (!lastSnapshot.companies.some(company => company.id === args[0].companyId)) throw new Error('Choose an existing company.');
          result = { ok: true, snapshot: { ...lastSnapshot, activeCompanyId: args[0].companyId } };
        } else {
          const snapshot = lastSnapshot;
          result = { ...await current.command(args[0], request), ok: true, snapshot, queued: true };
        }
      }
      else if (method === 'sendCloudChat') {
        const input = args[0];
        if (!input || !['company','office','department','employee'].includes(input.scope?.kind) || typeof input.scope?.id !== 'string' || input.scope.id.length > 200
            || typeof input.message !== 'string' || !input.message.trim() || Buffer.byteLength(input.message) > 10000 || !/^[A-Za-z0-9_-]{1,150}$/.test(input.idempotencyKey || '')) throw new Error('Provide a bounded conversation scope, brief and stable request ID.');
        if (!lastSnapshot) lastSnapshot = (await current.snapshot()).snapshot;
        const snapshot = structuredClone(lastSnapshot);
        const reply = await current.request('/api/chat','POST',input,request);
        if (typeof reply.reply !== 'string') throw new Error('The cloud reply was not confirmed. Inspect its original request ID before retrying.');
        snapshot.chatThreads ||= [];
        let thread = snapshot.chatThreads.find(item => item.scope.kind === input.scope.kind && item.scope.id === input.scope.id);
        if (!thread) { thread = { id: `cloud-${input.scope.kind}-${input.scope.id}`, scope: input.scope, messages: [] }; snapshot.chatThreads.push(thread); }
        const at = new Date().toISOString(); const base = reply.jobId || input.idempotencyKey;
        for (const [suffix, role, content] of [['user','user',input.message],['reply','assistant',reply.reply]]) {
          const id = `${base}-${suffix}`; if (!thread.messages.some(message => message.id === id)) thread.messages.push({ id, role, content, createdAt: at, source: 'cloud-receipt' });
        }
        result = { ...reply, ok: true, snapshot };
      }
      else if (method === 'cloudStatus') result = { ok: true, connected: true, url: connection.url };
      else if (method === 'officeWorkerStatus') result = { enabled: false, running: false, activeJobId: null, lastError: null, notice: 'Website commands await runtime synchronization.' };
      else if (method === 'getSettings') result = { runtimeUrl: null };
      else throw new Error('This operation needs a local or remote Daftar runtime. Website pairing retains its queued synchronization workflow.');
    } else result = await current.call(method, args, request);
    if (disposed || generation !== epoch) throw new Error('Connection changed while this operation ran. Inspect its original receipt; it was not retried.');
    if (result?.snapshot) lastSnapshot = result.snapshot;
    if(method==='officeCommand'&&args[0]?.action==='select_company'&&lastSnapshot?.companies?.some(row=>row.id===args[0].companyId)){
      if(selectedCompany!==args[0].companyId)scopeEpoch++;selectedCompany=args[0].companyId;await context.globalState.update('atlas.company',selectedCompany);publish();
    }
    return result;
  }
  const computeOffice = createComputeOffice({ vscode, call, snapshot: async () => {
    const result = await call('officeSnapshot'); if (!result?.ok || !result.snapshot) throw new Error('Read a valid company workspace first.'); return result.snapshot;
  }, notify });
  function openOffice() {
    if (!panel || panel.isDisposed?.()) panel = createOfficePanel(vscode, context, { call, connectionInfo: info });
    panel.reveal(); publish(); void refresh().catch(error => notify(safeMessage(error)));
  }
  async function connectRuntime(initialUrl) {
    return withConnectionSetup(async () => {
      const raw = await vscode.window.showInputBox({ title: 'Connect an existing Daftar runtime', value: typeof initialUrl === 'string' ? initialUrl : 'http://127.0.0.1:8788', prompt: 'Private HTTPS origin or loopback address in this extension host.', ignoreFocusOut: true });
      if (!raw) return;
      const url = origin(raw); const controlToken = await vscode.window.showInputBox({ title: 'Runtime owner credential', password: true, ignoreFocusOut: true, prompt: 'The runtime control token. SSH keys and provider keys are separate.', validateInput: value => TOKEN.test(value) ? null : 'Use the generated runtime control token.' });
      if (!controlToken) return;
      await useConnection({ kind: 'runtime', url, controlToken }); openOffice();
    });
  }
  async function startLocalRuntime() {
    return withConnectionSetup(async () => {
      assertSetup();
      if (!launcher) launcher = createLocalRuntime({ runtimeRoot: path.join(context.extensionPath, 'resources/runtime'), storagePath: context.globalStorageUri.fsPath,
        nodePath: vscode.workspace.getConfiguration('atlas').get('nodePath', '') || process.execPath,
        hostControlEnabled: process.platform === 'linux' && vscode.workspace.getConfiguration('atlas').get('hostControlEnabled', true) });
      const next = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Starting Daftar ${vscode.env.remoteName ? 'on this remote host' : 'on this computer'}`, cancellable: true }, async (_progress, cancellation) => {
        const abort = activeSetup.abort; const listener = cancellation.onCancellationRequested(() => abort.abort());
        try { return await launcher.start({ signal: abort.signal }); } finally { listener.dispose(); }
      });
      await useConnection(next); openOffice(); notify('Workspace ready. Workers are paused; host policy starts off. Assign ownership and execution in Compute & connections.');
    });
  }
  async function startPersistentRuntime() {
    return withConnectionSetup(async () => {
      assertSetup();
      if (process.platform !== 'linux') throw new Error('Persistent tmux workspaces run on Linux. Open your Linux VPS in Remote-SSH and run this command there.');
      persistent ||= createPersistentRuntime({ runtimeRoot: path.join(context.extensionPath, 'resources/runtime'), storagePath: context.globalStorageUri.fsPath,
        nodePath: vscode.workspace.getConfiguration('atlas').get('nodePath', '') || process.execPath });
      const next = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Starting persistent Daftar workspace in tmux', cancellable: true }, async (_progress, cancellation) => {
        const abort = activeSetup.abort; const listener = cancellation.onCancellationRequested(() => abort.abort());
        try { return await persistent.start({ signal: abort.signal }); } finally { listener.dispose(); }
      });
      await useConnection(next); openOffice();
      notify('Persistent workspace connected. Closing VS Code detaches; this tmux runtime continues on the instance. The instance itself must remain running.');
    });
  }
  async function connectDesktop() {
    return withConnectionSetup(async () => {
      const link = await vscode.window.showInputBox({ title: 'Connect Daftar desktop', prompt: 'Paste the fresh Pair VS Code link from desktop Settings.', password: true, ignoreFocusOut: true });
      assertSetup(); if (link) { await useConnection(await AtlasClient.connectDesktop(link, fetch, { signal: activeSetup.abort.signal })); openOffice(); }
    });
  }
  async function connectCloud() {
    return withConnectionSetup(async () => {
      const raw = await vscode.window.showInputBox({ title: 'Connect signed-in website', value: vscode.workspace.getConfiguration('atlas').get('websiteUrl', ''), prompt: 'HTTPS origin of your private website.', ignoreFocusOut: true });
      if (!raw) return;
      const url = origin(raw); const pairing = await vscode.window.showInputBox({ title: 'Website pairing JSON', password: true, ignoreFocusOut: true });
      assertSetup(); if (pairing) { await useConnection(await AtlasClient.connectCloud(url, pairing, fetch, { signal: activeSetup.abort.signal })); openOffice(); }
    });
  }
  async function saveProfile(record) {
    const saved = context.globalState.get(PROFILE_KEY, []);
    await context.globalState.update(PROFILE_KEY, [...(Array.isArray(saved) ? saved.filter(item => item?.id !== record.id).slice(-31) : []), record]);
  }
  async function askProfile(seed = {}) {
    const input = async (title, value, validateInput) => { const answer = await vscode.window.showInputBox({ title, value: String(value ?? ''), ignoreFocusOut: true, validateInput }); assertSetup(); return answer; };
    const host = await input('SSH host', seed.host); if (!host) return;
    const port = await input('SSH port', seed.port ?? 22, v => /^\d+$/.test(v) && Number(v) > 0 && Number(v) < 65536 ? null : 'Enter a port from 1 to 65535.'); if (!port) return;
    const user = await input('SSH user', seed.user ?? 'root'); if (!user) return;
    const label = await input('Compute profile name', seed.label ?? host); if (!label) return;
    const keyFile = await input('Optional existing private-key path on this extension host', seed.keyFile ?? ''); if (keyFile === undefined) return;
    const localPort = await input('Local tunnel port', seed.localPort ?? 18788); if (!localPort) return;
    const remotePort = await input('Daftar runtime port on the instance', seed.remotePort ?? 8788); if (!remotePort) return;
    return validateProfile({ id: seed.id ?? crypto.randomUUID(), label, host, port: Number(port), user, localPort: Number(localPort), remotePort: Number(remotePort), ...(keyFile ? { keyFile } : {}) });
  }
  async function connectCompute() {
    return withConnectionSetup(async () => {
      const profiles = context.globalState.get(PROFILE_KEY, []);
      const selected = await vscode.window.showQuickPick([
        { label: 'Discover existing Vast.ai instances', action: 'vast', description: 'Read-only listing; never starts or rents an instance' },
        { label: 'Add an existing SSH host', action: 'manual', description: 'Uses verified known_hosts and existing SSH authentication' },
        ...(Array.isArray(profiles) ? profiles.map(record => ({ label: record.label || record.profile?.label || record.id, description: record.status || 'Saved SSH profile', record })) : []),
      ], { title: 'Connect compute', placeHolder: 'Already in Remote-SSH? Use Start workspace on this host.' });
      assertSetup();
      if (!selected) return;
      let record = selected.record;
      if (selected.action === 'vast' || record?.provider === 'vast') {
        let apiKey = await context.secrets.get(VAST_KEY);
        if (!apiKey) { apiKey = await vscode.window.showInputBox({ title: 'Vast.ai API key', prompt: 'Saved in VS Code SecretStorage; used only to list existing instances.', password: true, ignoreFocusOut: true }); assertSetup(); if (!apiKey) return; await context.secrets.store(VAST_KEY, apiKey); }
        assertSetup(); const listing = await fetchVastInstances(apiKey, { signal: activeSetup.abort.signal });
        const chosen = record?.instanceId ? listing.instances.find(item => item.id === record.instanceId) : await vscode.window.showQuickPick(listing.instances.map(instance => ({ label: `Instance ${instance.id}`, description: `${instance.actual_status || 'unknown'} · ${instance.gpu_name || 'GPU not verified'}`, instance })), { title: 'Existing Vast instances' }).then(item => item?.instance);
        assertSetup();
        if (!chosen) { notify('No matching instance was returned. Saved profiles remain available; no compute was started or rented.'); return; }
        record = { id: `vast-${chosen.id}`, provider: 'vast', instanceId: chosen.id, label: `Vast ${chosen.id}`, status: chosen.actual_status, profile: record?.profile ?? null, metadata: { gpuName: chosen.gpu_name, gpuVerified: false } };
        await saveProfile(record);
        if (chosen.actual_status !== 'running') { notify(`Instance ${chosen.id} is ${chosen.actual_status || 'not running'}. Its profile is saved. Resume it in Vast when needed, then reconnect.`); return; }
        record.profile = await askProfile({ ...record.profile, id: record.id, label: record.label, host: chosen.ssh_host, port: chosen.ssh_port });
      } else if (selected.action === 'manual') {
        const profile = await askProfile(); if (!profile) return;
        record = { id: profile.id, profile, provider: 'ssh', label: profile.label, status: 'saved' };
      }
      if (!record?.profile) return;
      await saveProfile(record);
      const controlToken = await vscode.window.showInputBox({ title: 'Private runtime control token', prompt: 'The runtime must already run on the target. SSH uses your existing key or agent.', password: true, ignoreFocusOut: true, validateInput: value => TOKEN.test(value) ? null : 'Use the generated runtime control token.' });
      assertSetup();
      if (!controlToken) return;
      await tunnel?.close();
      assertSetup();
      tunnel = new ComputeConnection({ probe: async (url, signal) => {
        const probe = new RuntimeClient({ kind: 'runtime', url, controlToken });
        try { const state = await probe.request('/v1/status', 'GET', undefined, { signal }); return state?.ok === true && state.execution === 'headless'; } finally { probe.close(); }
      } });
      const currentTunnel = tunnel; const setupSignal = activeSetup.abort.signal;
      const cancelTunnel = () => { void currentTunnel.close(); }; setupSignal.addEventListener('abort', cancelTunnel, { once: true });
      try {
        const result = await tunnel.connect(record.profile); await useConnection({ kind: 'runtime', url: result.runtimeUrl, controlToken });
        await saveProfile({ ...record, status: 'runtime connected' }); openOffice(); notify('Private runtime connected. GPU availability still needs a diagnostic. Assign Donna and employee grants in Compute & connections.');
      } catch (error) { await currentTunnel.close(); throw error; }
      finally { setupSignal.removeEventListener('abort', cancelTunnel); }
    });
  }
  async function disconnect() {
    ++epoch; activeSetup?.abort.abort(); for (const candidate of pending) candidate.close?.(); pending.clear();
    client?.close?.(); client = null; connection = null; capabilities = null; lastSnapshot = null; verified = false;
    await writeConnection(null, epoch); await tunnel?.close(); publish();
  }
  async function importCredentialFile(provider) {
    const target = client; const generation = epoch;
    if (!['openai','anthropic','github'].includes(provider)) throw new Error('Choose a supported provider.');
    const files = await vscode.window.showOpenDialog({ title: `Import ${provider} credential`, canSelectMany: false, canSelectFiles: true, canSelectFolders: false });
    if (!files?.[0]) return { ok: false, cancelled: true };
    const stat = await vscode.workspace.fs.stat(files[0]); if (stat.size > 16384) throw new Error('Credential file is too large.');
    const bytes = await vscode.workspace.fs.readFile(files[0]);
    try {
      if (bytes.byteLength > 16384) throw new Error('Credential file is too large.');
      if (disposed || generation !== epoch || target !== client) throw new Error('Credential import cancelled because its target connection changed.');
      return await target.call('setApiKey', [provider, Buffer.from(bytes).toString('utf8').trim()], { id: crypto.randomUUID() });
    } finally { bytes.fill(0); }
  }
  async function promptProviderKey(provider) {
    if (!['openai','anthropic','github'].includes(provider)) throw new Error('Choose a supported provider.');
    const target = client, generation = epoch;
    const key = await vscode.window.showInputBox({ title: `Save ${provider} credential`, password: true, ignoreFocusOut: true,
      prompt: 'Stored by the connected runtime. The office canvas never receives this credential.', validateInput: value => value.length > 0 && value.length <= 16384 ? null : 'Enter a credential under 16 KiB.' });
    if (!key) return { ok: false, cancelled: true };
    if (disposed || generation !== epoch || target !== client) throw new Error('Credential target changed. Choose the intended connection first.');
    return target.call('setApiKey', [provider, key], { id: crypto.randomUUID() });
  }
  async function promptCloudConfiguration() {
    const target = client, generation = epoch;
    const raw = await vscode.window.showInputBox({ title: 'Pair this runtime with your website', prompt: 'Private website HTTPS origin.', ignoreFocusOut: true });
    if (!raw) return { ok: false, cancelled: true };
    const url = origin(raw); if (!url.startsWith('https://')) throw new Error('Website synchronization requires HTTPS.');
    const token = await vscode.window.showInputBox({ title: 'Runtime website device token', prompt: 'Paste the device token or complete pairing JSON. Stored on this runtime.', password: true, ignoreFocusOut: true });
    if (!token) return { ok: false, cancelled: true };
    if (disposed || generation !== epoch || target !== client) throw new Error('Cloud pairing target changed.');
    return target.call('configureCloud', [{ url, token }], { id: crypto.randomUUID() });
  }
  async function copyMcpConfig() {
    await restored; if (connection?.kind !== 'runtime') throw new Error('Connect a standalone runtime before creating its MCP configuration.');
    const target = { ...connection }, generation = epoch;
    const root = path.join(context.globalStorageUri.fsPath, 'mcp'); await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const directory = await fs.lstat(root); if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('The MCP credential directory must be a real private directory.');
    if (process.platform !== 'win32') await fs.chmod(root, 0o700);
    const tokenFile = path.join(root, `control-${crypto.randomUUID()}`);
    await fs.writeFile(tokenFile, target.controlToken + '\n', { mode: 0o600, flag: 'wx' });
    if (disposed || generation !== epoch) { await fs.unlink(tokenFile); throw new Error('MCP configuration target changed.'); }
    const config = { servers: { daftar: { type: 'stdio', command: vscode.workspace.getConfiguration('atlas').get('nodePath', '') || process.execPath, args: [path.join(context.extensionPath, 'resources/runtime/tools/daftar-runtime-mcp.mjs')], env: { ELECTRON_RUN_AS_NODE: '1', DAFTAR_RUNTIME_URL: target.url, DAFTAR_CONTROL_TOKEN_FILE: tokenFile } } } };
    await vscode.env.clipboard.writeText(JSON.stringify(config, null, 2)); notify('VS Code MCP configuration copied with a private token-file path. ChatGPT needs a separate MCP tunnel or supported remote MCP registration.');
  }
  async function ensureCompanySelection(){ await restored; if(!lastSnapshot)await refresh();chooseCompany(lastSnapshot); }
  async function command(data) {
    requireTrust(); await ensureCompanySelection();
    const c=currentClient(), companyId=selectedCompany, version=epoch,scopeVersion=scopeEpoch;
    const snapshot=(await c.snapshot()).snapshot;
    if(disposed||version!==epoch||scopeVersion!==scopeEpoch || companyId!==selectedCompany)throw new Error('The selected workspace changed. Review the action in its company again.');
    if(!snapshot?.companies?.some(company=>company.id===companyId))throw new Error('Choose an existing company.');
    let action;
    if(data.type==='employee') {
      if(!['pause','resume'].includes(data.operation))throw new Error('Choose a supported employee action.');
      action=managementCommand(snapshot,companyId,{action:data.operation==='pause'?'pause_employee':'resume_employee',employeeId:data.id});
    } else if(data.type==='job') {
      const job=snapshot.jobs.find(j=>j.id===data.id && j.companyId===companyId);
      if(!job || !['pause','resume'].includes(data.operation))throw new Error('Job action is outside this company.');
      action={action:data.operation==='pause'?'pause_job':'resume_job',jobId:job.id};
    } else if(data.type==='panel') {
      if(typeof data.task!=='string'||!data.task.trim()||Buffer.byteLength(data.task)>12000)throw new Error('Write a panel question under 12 KB.');
      if(!['software','design','research','data'].includes(data.focus))throw new Error('Choose a supported panel focus.');
      action={action:'convene_panel',companyId,scope:{kind:'company',id:companyId},title:data.task.slice(0,160),task:data.task,focus:data.focus,maxRounds:1,maxUsd:2,maxTokens:60000,maxMinutes:10};
    } else if(data.type==='manageTeam') {
      const input=await askManagement(snapshot,companyId);
      if(!input)return;
      action=managementCommand(snapshot,companyId,input);
    } else throw new Error('Unsupported editor action.');
    if(disposed||version!==epoch||scopeVersion!==scopeEpoch || companyId!==selectedCompany)throw new Error('The selected workspace changed. Review the action in its company again.');
    const result=await c.command(action);
    if(disposed||version!==epoch||scopeVersion!==scopeEpoch || companyId!==selectedCompany)return;
    post({type:'notice',message:result.queued?'Waiting for desktop: command saved. Use Sync now in the installed app.':connection.kind==='runtime'?'Applied in the connected runtime.':'Saved in the desktop workspace.'});
    await refresh();
  }
  async function onMessage(message) {
    try {
      if(!message||typeof message!=='object')return;
      if(typeof message.command==='string'&&Object.hasOwn(commands,message.command))return await vscode.commands.executeCommand(message.command);
      if(message.type==='ready'||message.type==='refresh')return await refresh();
      if(message.type==='connectDesktop')return await connectDesktop();
      if(message.type==='connectCloud')return await connectCloud();
      if(message.type==='connectRuntime')return await connectRuntime();
      if(message.type==='disconnect')return await disconnect();
      if(message.type==='openWebsite')return await openWebsite();
      if(message.type==='openStudio') {
        requireTrust(); await restored;
        if(connection?.kind!=='cloud')throw new Error('Connect this editor to your private website to open its studio views.');
        if(!lastSnapshot?.companies.some(c=>c.id===selectedCompany))throw new Error('Choose an existing company.');
        return await vscode.env.openExternal(vscode.Uri.parse(studioUrl(connection.url,selectedCompany,message.view)));
      }
      if(message.type==='company') {
        if(typeof message.id!=='string'||!lastSnapshot?.companies.some(c=>c.id===message.id))throw new Error('Unknown company.');
        scopeEpoch++;selectedCompany=message.id;await context.globalState.update('atlas.company',selectedCompany);
        if(connection?.kind==='cloud'){lastSnapshot={...lastSnapshot,activeCompanyId:selectedCompany};publish();return readCompanyStatus(currentClient(),epoch);}
        await call('officeCommand',[{action:'select_company',companyId:selectedCompany}]);await refresh();return readCompanyStatus(currentClient(),epoch);
      }
      if(message.type==='reviewOwnership')return await reviewOwnership();
      if(['chat','employee','job','panel','manageTeam','creativeTools','creativeDevelopment'].includes(message.type)) {
        if(activeAction)throw new Error('Wait for the current action to finish before sending another.');
        if(message.companyId!==undefined && message.companyId!==selectedCompany)throw new Error('The selected company changed. Review the action in its company again.');
        activeAction=true;post({type:'busy',value:true});
        try {
          if(message.type==='creativeTools')return await creativeTools();
          if(message.type==='creativeDevelopment')return await creativeDevelopment();
          if(message.type!=='chat')return await command(message);
          requireTrust(); await ensureCompanySelection();
          const companyId=selectedCompany,version=epoch,scopeVersion=scopeEpoch;
          if(!lastSnapshot?.companies.some(c=>c.id===companyId))throw new Error('Choose a company first.');
          const result=await currentClient().chat(companyId,message.content,crypto.randomUUID());
          if(disposed||version!==epoch||scopeVersion!==scopeEpoch || companyId!==selectedCompany)return;
          post({type:'chatSent',companyId,content:message.content,reply:result.reply ?? result.message?.content ?? null,usage:result.usage,budget:result.budget,saved:result.saved});
          if(result.saved)post({type:'notice',message:connection.kind==='runtime'?'Brief saved in the runtime. This saved message does not start provider work.':'Brief saved locally. Open Donna in the desktop to create and authorize a bounded provider goal.'});
          return await refresh();
        } finally { activeAction=false;post({type:'busy',value:false}); }
      }
    } catch(error) { post({type:'error',message:safeMessage(error)});post({type:'busy',value:activeAction});void vscode.window.showErrorMessage(safeMessage(error)); }
  }
  async function reviewOwnership() {
    requireTrust(); await ensureCompanySelection();
    const companyId=selectedCompany,version=epoch,scopeVersion=scopeEpoch;
    const snapshot=(await currentClient().snapshot()).snapshot;
    if(disposed||version!==epoch||scopeVersion!==scopeEpoch || companyId!==selectedCompany)return;
    const rows=ownershipSummary(snapshot,companyId);
    const lines=['Donna and assistant ownership', '', 'Owner commands are validated by the native backend. Displayed grant counts are current direct grant records, not a determination of effective delegated authority.', ''];
    for(const row of rows)lines.push(`${row.kind}: ${row.name}`, `Assistant: ${row.assistantName} (${row.assistantId || 'unassigned'}) · ${row.status}`, `Ownership record: ${row.validOwner?'consistent':'needs repair'} · ${row.grantCount} current direct grant(s) at ${row.grantScope.kind} ${row.grantScope.id}`, '');
    const document=await vscode.workspace.openTextDocument({content:lines.join('\n'),language:'plaintext'});
    await vscode.window.showTextDocument(document,{preview:true});
  }
  async function creativeTools(options={}) {
    requireTrust(); await ensureCompanySelection();
    if(connection?.kind!=='runtime') {
      const choice=await vscode.window.showInformationMessage('Creative execution is available through a configured headless runtime. Connecting replaces this editor’s active backend.','Connect runtime');
      if(choice==='Connect runtime')await connectRuntime();
      return;
    }
    const c=currentClient(),companyId=selectedCompany,version=epoch,scopeVersion=scopeEpoch;
    const assertCurrent=()=>{requireTrust();if(disposed||version!==epoch||scopeVersion!==scopeEpoch||companyId!==selectedCompany)throw new Error('The selected workspace changed. Review the creative action in its company again.');};
    const snapshot=(await c.snapshot()).snapshot;assertCurrent();
    const company=snapshot.companies?.find(row=>row.id===companyId);if(!company)throw new Error('Choose an existing company.');
    const inventory=await c.creative('snapshot',{companyId});assertCurrent();
    post({type:'creativeState',companyId,inventory});
    const action=await askCreativeAction(vscode.window,inventory,company.name,assertCurrent,options);assertCurrent();if(!action)return;
    if(action.kind==='report') {
      const document=await vscode.workspace.openTextDocument({language:'plaintext',content:inventoryText(inventory)});assertCurrent();
      await vscode.window.showTextDocument(document,{preview:true});return;
    }
    const {kind,...fields}=action;
    const input={companyId,...fields,...(kind==='job'?{}:{id:crypto.randomUUID()})};
    const result=await c.creative(kind,input);if(disposed||version!==epoch||scopeVersion!==scopeEpoch||companyId!==selectedCompany)return;
    if(result.receiptOnly){post({type:'notice',message:`Creative request ${result.id} was saved. Read creative tasks for its current result; do not start it again with a new id.`});await refresh();return;}
    if(kind==='assign')post({type:'notice',message:'Creative assignment saved. Native authority is checked when a task starts.'});
    else {
      const job=result.job;
      const remotePending=job.operation.startsWith('adobe.')&&(kind==='cancel'||job.result?.cleanup==='pending'||job.result?.state==='outcome_unconfirmed');
      post({type:'notice',message:`Creative task ${job.id}: ${job.status}. ${kind==='run'?'Acceptance is not completion; use Creative tools to check the result.':kind==='cancel'?'Cancellation status reflects the runtime response.':''}${remotePending?' Local state does not confirm Adobe stopped or uploaded assets were removed; inspect remote outcome and cleanup before another request.':''}`});
      const document=await vscode.workspace.openTextDocument({language:'json',content:JSON.stringify(job,null,2)});assertCurrent();
      await vscode.window.showTextDocument(document,{preview:true});
    }
    await refresh();
  }
  async function creativeDevelopment() {
    requireTrust(); await ensureCompanySelection();
    const c=currentClient(),companyId=selectedCompany,version=epoch,scopeVersion=scopeEpoch,connectionKind=connection.kind;
    const assertCurrent=()=>{requireTrust();if(disposed||version!==epoch||scopeVersion!==scopeEpoch||companyId!==selectedCompany)throw new Error('The selected workspace changed. Review development work in its company again.');};
    const snapshot=(await c.snapshot()).snapshot;assertCurrent();
    const company=snapshot.companies?.find(row=>row.id===companyId);if(!company)throw new Error('Choose an existing company.');
    const [developmentResult,creativeResult]=await Promise.allSettled([c.development(companyId),connectionKind==='runtime'?c.creative('snapshot',{companyId}):Promise.resolve(null)]);assertCurrent();
    const development=developmentResult.status==='fulfilled'?developmentResult.value:{models:null,status:null};
    const inventory=creativeResult.status==='fulfilled'?creativeResult.value:null;
    post({type:'developmentState',companyId,...development});if(inventory)post({type:'creativeState',companyId,inventory});
    const context={company,snapshot,...development,inventory,connectionKind};
    const action=await askDevelopmentAction(vscode.window,context,assertCurrent);assertCurrent();if(!action)return;
    if(action.kind==='connect')return await connectRuntime();
    if(['blender','unreal'].includes(action.kind))return await creativeTools({tool:action.kind,run:true});
    if(action.kind==='report') {
      const document=await vscode.workspace.openTextDocument({language:'plaintext',content:developmentReport(context)});assertCurrent();
      await vscode.window.showTextDocument(document,{preview:true});return;
    }
    const {kind,digest,...fields}=action;
    const request=kind==='task'?{...fields,digest,idempotencyKey:crypto.randomUUID()}
      :{companyId,...fields,...(kind==='pull'?{idempotencyKey:crypto.randomUUID()}:{})};
    const command=kind==='task'?boundedMoECommand(snapshot,development.models,companyId,request):null;
    const review={company:company.name,companyId,action:kind,model:kind==='cancel'?undefined:PRIMARY_MODEL,
      ...(digest?{reviewedDigest:digest}:{}),...(command?{command}:{request}),
      effects:kind==='task'?'Queues one authorized text task. Enabled workers may execute it; this action does not enable workers. Native authority and model digest checks still apply.'
        :kind==='pull'?'Downloads a published artifact of about 19 GB to the existing local-only daemon. GPU/VPS rental, storage and transfer bills are separate.'
        :kind==='select'?'Assigns the currently installed model digest to this employee. It does not enqueue a task.'
        :'Cancels this employee’s model download subscription. Partial files can remain in the daemon.'};
    const document=await vscode.workspace.openTextDocument({language:'json',content:JSON.stringify(review,null,2)});assertCurrent();
    await vscode.window.showTextDocument(document,{preview:true});assertCurrent();
    const titles={task:'Authorize and queue this bounded MoE task',pull:'Start this reviewed model download',select:'Assign this installed model',cancel:'Cancel this download subscription'};
    const confirmed=await vscode.window.showQuickPick([{id:'submit',label:titles[kind],description:company.name},{id:'review',label:'Keep the review without submitting'}],{title:'Review the prepared action',ignoreFocusOut:true});assertCurrent();
    if(confirmed?.id!=='submit')return;
    if(kind==='task') {
      const freshSnapshot=(await c.snapshot()).snapshot;assertCurrent();
      const freshModels=(await c.models('snapshot',{companyId,employeeId:request.employeeId})).snapshot;assertCurrent();
      const freshCommand=boundedMoECommand(freshSnapshot,freshModels,companyId,request);
      let result;
      try {result=await c.command(freshCommand);}catch(error){throw new Error(`${safeMessage(error)} Retain job key ${request.idempotencyKey}; inspect the work queue before another submission.`);}
      assertCurrent();
      const jobId=result.snapshot?.lastAction?.jobId;
      post({type:'notice',message:`Bounded MoE task saved${typeof jobId==='string'?` · ${jobId}`:''}. Acceptance is not completion. Inspect the work queue and worker state; no worker was enabled by this action.`});
    } else {
      if(kind==='select') {
        const fresh=(await c.models('snapshot',{companyId,employeeId:request.employeeId})).snapshot;assertCurrent();
        if(!fresh.models.some(row=>row.name===PRIMARY_MODEL&&row.digest===digest))throw new Error('The installed digest changed during review. Inspect it and prepare the selection again.');
      }
      const result=await c.models(kind,request);assertCurrent();
      post({type:'developmentState',companyId,models:result.snapshot,status:development.status});
      if(kind==='select'&&!result.snapshot.assignments.some(row=>row.employeeId===request.employeeId&&row.model===PRIMARY_MODEL&&row.digest===digest))throw new Error('The backend recorded a different current digest during selection. Review model status before queueing any work.');
      post({type:'notice',message:kind==='select'?'Installed model digest assigned. This action did not enqueue provider work.':kind==='pull'?`Model download request saved · ${result.requestId}. Inspect its progress; accepted does not mean installed.`:'Model cancellation saved. Shared or partial model files may remain.'});
    }
    await refresh();
  }
  async function openWebsite(){return vscode.env.openExternal(vscode.Uri.parse(connection?.kind==='cloud'?connection.url:'https://occult-kranti.github.io/engineering-intelligence-atlas/'));}
  async function computeCenter() {
    const selected = await vscode.window.showQuickPick([
      { label:'Creative development · MoE, Blender & Unreal',action:()=>onMessage({type:'creativeDevelopment'}),description:'Review scoped model and creative work'},
      { label: 'Donna · ownership, models & environments', action: () => computeOffice.menu(), description: verified ? 'Manage this workspace' : 'Connect a workspace first' },
      { label: 'Start workspace on this host', action: startLocalRuntime, description: vscode.env.remoteName ? 'Uses the current Remote-SSH extension host' : 'Standalone backend; no desktop app needed' },
      { label: 'Start persistent workspace in tmux', action: startPersistentRuntime, description: 'Linux host; continues after the editor closes' },
      { label: 'Connect existing private runtime', action: () => connectRuntime() }, { label: 'Connect Vast.ai / SSH compute', action: connectCompute },
      { label: 'Copy runtime MCP configuration', action: copyMcpConfig }, { label: 'Connect desktop', action: connectDesktop }, { label: 'Connect signed-in website', action: connectCloud },
      { label: 'Disconnect editor', action: disconnect, description: 'Closes the editor tunnel; does not stop or destroy the VPS' },
    ], { title: 'Compute & connections', placeHolder: info().location });
    if (selected) await selected.action();
  }
  async function poll() {
    if (pollPromise || !verified || !client || !panel?.isVisible?.() || disposed) return;
    const generation = epoch, target = client;
    pollPromise = (async () => {
      const results = await Promise.allSettled([call('getJobStatus'), call('listRuns')]);
      if (disposed || generation !== epoch || target !== client) return;
      if (results[0].status === 'fulfilled') for (const job of Array.isArray(results[0].value) ? results[0].value : []) panel?.postEvent('job', job);
      if (results[1].status === 'fulfilled') for (const run of Array.isArray(results[1].value) ? results[1].value : []) panel?.postEvent('project', run);
    })().finally(() => { pollPromise = null; }); return pollPromise;
  }
  const commands = {
    'atlas.manageTeam':()=>onMessage({type:'manageTeam'}),'atlas.reviewOwnership':reviewOwnership,'atlas.creativeTools':()=>onMessage({type:'creativeTools'}),'atlas.creativeDevelopment':()=>onMessage({type:'creativeDevelopment'}),
    'atlas.openOffice': openOffice, 'atlas.startLocalRuntime': startLocalRuntime, 'atlas.startPersistentRuntime': startPersistentRuntime, 'atlas.connectRuntime': () => connectRuntime(), 'atlas.connectCompute': connectCompute,
    'atlas.openComputeCenter': computeCenter, 'atlas.hireCloudOperator': () => computeOffice.hireOperator(), 'atlas.copyMcpConfig': copyMcpConfig,
    'atlas.connectDesktop': connectDesktop, 'atlas.connectCloud': connectCloud, 'atlas.disconnect': disconnect, 'atlas.refresh': refresh,
    'atlas.openWebsite': () => vscode.env.openExternal(vscode.Uri.parse(connection?.kind === 'cloud' ? connection.url : 'https://occult-kranti.github.io/engineering-intelligence-atlas/')),
    'atlas.openMcpGuide': () => vscode.env.openExternal(vscode.Uri.parse(GUIDE)),
  };
  for (const [id, action] of Object.entries(commands)) own(vscode.commands.registerCommand(id, async () => { try { return await action(); } catch (error) { void vscode.window.showErrorMessage(safeMessage(error)); } }));
  own(vscode.window.registerWebviewViewProvider('atlas.office', { resolveWebviewView(resolved) {
    view = resolved; view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] }; view.webview.html = sidebarHtml(view.webview, context.extensionUri);
    const listener = view.webview.onDidReceiveMessage(onMessage);
    const dispose = view.onDidDispose(() => { listener.dispose(); dispose.dispose(); if (view === resolved) view = null; }); own(listener); own(dispose); publish(); void refresh().catch(error=>notify(safeMessage(error)));
  } }));
  const timer = setInterval(() => void poll().catch(() => {}), 5000);
  let cleanupPromise;
  const disposeOwned = () => {
    if (cleanupPromise) return cleanupPromise;
    disposed = true; ++epoch; activeSetup?.abort.abort(); clearInterval(timer); client?.close?.();
    for (const candidate of pending) candidate.close?.(); pending.clear(); panel?.dispose(); connection = null; client = null;
    cleanupPromise = Promise.allSettled([tunnel?.close(), launcher?.close(), persistent?.close()]).then(() => undefined);
    return cleanupPromise;
  };
  deactivateActive = disposeOwned;
  own({ dispose() { void disposeOwned(); } });
  return { openOffice, refresh, disconnect, connectionInfo: info };
}
async function askManagement(snapshot, companyId) {
  const records=scopeRecords(snapshot,companyId);
  const choose=async(rows,title)=>vscode.window.showQuickPick(rows.map(row=>({label:row.name,description:row.role||row.status,record:row})),{title,ignoreFocusOut:true});
  const prompt=async(title,value='',maximum=150)=>vscode.window.showInputBox({title,value,ignoreFocusOut:true,validateInput:value=>!value.trim()||Buffer.byteLength(value.trim())>maximum?'Enter nonempty text within '+maximum+' bytes.':undefined});
  const operation=await vscode.window.showQuickPick(OPERATIONS.map(([action,label])=>({action,label})),{title:`Manage ${records.company.name}`,ignoreFocusOut:true});
  if(!operation)return;
  const action=operation.action;
  if(action==='create_office'){const name=await prompt('Office name');return name===undefined?undefined:{action,name};}
  if(['rename_office','create_department','hire_employee'].includes(action)) {
    const office=(await choose(records.offices,'Choose an office'))?.record;if(!office)return;
    if(action!=='hire_employee'){const name=await prompt(action==='rename_office'?'Office name':'Department name',action==='rename_office'?office.name:'');return name===undefined?undefined:{action,officeId:office.id,name};}
    const target=await choose([{id:null,name:'Office staff'},...records.departments.filter(row=>row.officeId===office.id)],'Choose an employee department');if(!target)return;
    const name=await prompt('Permanent employee name');if(name===undefined)return;
    const role=await prompt('Role definition (responsibility, not access permissions)','',200);if(role===undefined)return;
    return {action,companyId,officeId:office.id,departmentId:target.record.id,name,role,skillPaths:[]};
  }
  if(['update_employee','fire_employee'].includes(action)) {
    const people=records.employees.filter(row=>row.status!=='fired'&&(action!=='fire_employee'||row.kind==='specialist'&&row.id!=='donna'));
    const person=(await choose(people,'Choose an employee'))?.record;if(!person)return;
    if(action==='fire_employee') {
      const confirmed=await vscode.window.showWarningMessage(`Retire ${person.name}? Work is cancelled and history is retained. A retired definition cannot be resumed.`,{modal:true},'Retire specialist');
      return confirmed==='Retire specialist'?{action,employeeId:person.id}:undefined;
    }
    const field=await vscode.window.showQuickPick([{label:'Name',key:'name'},{label:'Role definition',key:'role'},{label:'Repository skill paths',key:'skillPaths'}],{title:`Edit ${person.name}`,ignoreFocusOut:true});if(!field)return;
    if(field.key==='skillPaths') {
      const raw=await vscode.window.showInputBox({title:'Skill paths, separated by commas; blank removes skill bindings',value:(person.skillPaths||[]).join(', '),ignoreFocusOut:true});
      return raw===undefined?undefined:{action,employeeId:person.id,skillPaths:raw.trim()?raw.split(',').map(value=>value.trim()):[]};
    }
    const value=await prompt(field.label,person[field.key],field.key==='role'?200:150);return value===undefined?undefined:{action,employeeId:person.id,[field.key]:value};
  }
  const department=(await choose(records.departments,'Choose a department'))?.record;if(!department)return;
  if(action==='rename_department'){const name=await prompt('Department name',department.name);return name===undefined?undefined:{action,departmentId:department.id,name};}
  if(action==='set_department_parent') {
    const parent=await choose([{id:null,name:'Top level in this office'},...records.departments.filter(row=>row.officeId===department.officeId&&row.id!==department.id)],'Choose parent department');
    return parent?{action,departmentId:department.id,parentDepartmentId:parent.record.id}:undefined;
  }
  return {action,departmentId:department.id};
}
function sidebarHtml(webview,root) {
  const nonce=crypto.randomBytes(20).toString('hex');
  const css=webview.asWebviewUri(vscode.Uri.joinPath(root,'media','office.css'));
  const js=webview.asWebviewUri(vscode.Uri.joinPath(root,'media','office.js'));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource}; connect-src 'none'; form-action 'none'; base-uri 'none';"><link rel="stylesheet" href="${css}"><title>Daftar Office</title></head><body>
  <header><div class="brand">DAFTAR <span>Command Studio</span></div><button id="refresh" title="Refresh workspace">Refresh</button></header>
  <section aria-label="Workspace and compute"><button data-command="atlas.openOffice" class="primary">Open full office</button><button data-command="atlas.openComputeCenter">Compute &amp; connections</button><button data-command="atlas.startLocalRuntime">Start workspace on this host</button><button data-command="atlas.startPersistentRuntime">Start persistent workspace in tmux</button></section>
  <p id="connection" class="muted">Pair your workspace to begin.</p>
  <section id="connect"><h1>Your office, beside your code.</h1><p>One Donna conversation, permanent teams, and a roadmap tied to their work.</p><button id="connect-runtime" class="primary">Connect runtime</button><button id="connect-desktop">Connect desktop</button><button id="connect-cloud">Connect signed-in website</button><p class="muted">Choose one active backend. Execution and provider keys stay in the connected runtime, desktop or website.</p></section>
  <div id="notice" role="status" aria-live="polite"></div>
  <main id="workspace" hidden><label for="company">Company</label><select id="company"></select>
  <div id="budget" class="budget"></div>
  <section class="development-panel" aria-labelledby="creative-heading"><p class="eyebrow">Build with your company</p><h2 id="creative-heading">Creative development</h2><p>One scoped workflow for coding, Blender assets and Unreal validation.</p><p id="development-state" class="muted" aria-live="polite">Inspect the connected model pool and provider workers.</p><p id="creative-state" class="muted">Connect a headless runtime to discover tools and approved projects.</p><div class="development-actions"><button id="creative-development" class="primary">Model and development workflow</button><button id="creative-tools">Tool assignments and receipts</button></div><p class="development-limit">Qwen MoE · 8k context profile. Device readiness comes from completed render receipts; Unreal rendering remains unavailable.</p></section>
  <div id="studio-links" class="studio-links" hidden><p class="muted">Open this company in the connected studio</p><div><button data-studio="blueprint">Blueprint</button><button data-studio="softboard">Ownership</button><button data-studio="timeline">Roadmap</button><button data-studio="whiteboard">Whiteboard</button></div></div>
  <nav aria-label="Workspace views"><button data-tab="chat" aria-pressed="true">Donna</button><button data-tab="team" aria-pressed="false">Team</button><button data-tab="roadmap" aria-pressed="false">Roadmap</button></nav>
  <section id="tab-chat"><h2>Donna's desk</h2><p id="chat-mode" class="muted"></p><div id="messages" aria-live="polite"></div><form id="chat-form"><label for="brief">What should we work on?</label><textarea id="brief" rows="4" maxlength="12000" placeholder="Describe a decision, goal, or improvement…" required></textarea><button type="submit" class="primary" id="send">Send brief</button></form><details><summary>Convene a decision panel</summary><p>Donna reuses experts or fills missing roles. This creates a draft; execution is reviewed in Daftar.</p><label for="panel-focus">Expertise</label><select id="panel-focus"><option value="software">Software and architecture</option><option value="design">Design and experience</option><option value="research">Research · Newton · Tesla · skeptic</option><option value="data">Data and caching</option></select><button id="panel">Use current brief for a panel</button><p class="muted">One round · $2 panel ceiling · 60,000 token allowance per request. The allowance includes context and is not a consumption target.</p></details><div id="panels"></div></section>
  <section id="tab-team" hidden><h2>People and ownership</h2><p class="muted">Employee definitions persist between tasks. Job states below show actual execution. Role text and skill bindings do not grant access.</p><div class="team-actions"><button id="manage-team" class="primary">Manage team</button><button id="review-ownership">Review Donna ownership</button></div><div id="ownership"></div><div id="team"></div><h2>Work queue</h2><div id="jobs"></div></section>
  <section id="tab-roadmap" hidden><h2>Roadmap and ownership</h2><div id="roadmap"></div><h2>Goals</h2><div id="goals"></div></section>
  <footer><button id="open-website">Open website</button><button id="disconnect">Disconnect editor</button></footer></main>
  <script nonce="${nonce}" src="${js}"></script></body></html>`;
}
module.exports = { activate, safeMessage, deactivate: () => deactivateActive() };
