'use strict';
const vscode = require('vscode');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { AtlasClient, origin } = require('./client');
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
  const raw = error instanceof Error ? error.message : 'Daftar could not complete this operation. Inspect its saved state.';
  return raw.replace(/(?:sk-ant-|sk-proj-|github_pat_|ghp_)[A-Za-z0-9_-]+/g, '[credential removed]').slice(0, 500);
}
function activate(context) {
  let connection = null, client = null, capabilities = null, verified = false;
  let lastSnapshot = null;
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
  const publish = () => {
    if (disposed) return;
    const value = info(); panel?.notifyConnection(value); void view?.webview.postMessage({ type: 'state', ...value });
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
      client?.close?.(); connection = next; client = candidate; lastSnapshot = initial.snapshot; capabilities = metadata; verified = true; publish();
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
      await restored; if (!client || disposed) { publish(); return; }
      const generation = epoch; const current = client;
      try {
        const result = await current.snapshot();
        if (generation !== epoch || disposed) return;
        if (connection.kind === 'runtime' && !capabilities) capabilities = await current.capabilities();
        if (generation !== epoch || disposed) return;
        lastSnapshot = result.snapshot; verified = true; publish(); panel?.postEvent('office', result); return result;
      } catch (error) { if (generation === epoch && !disposed) { verified = false; publish(); } throw error; }
    })().finally(() => { refreshPromise = null; });
    return refreshPromise;
  }
  async function call(method, args = [], request = {}) {
    requireTrust(); await restored;
    const local = { openComputeCenter: computeCenter, backToLauncher: computeCenter, startLocalRuntime, connectRuntimePrompt: () => connectRuntime(), connectCompute, connectDesktopPrompt: connectDesktop, connectCloudPrompt: connectCloud,
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
  async function computeCenter() {
    const selected = await vscode.window.showQuickPick([
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
    'atlas.openOffice': openOffice, 'atlas.startLocalRuntime': startLocalRuntime, 'atlas.startPersistentRuntime': startPersistentRuntime, 'atlas.connectRuntime': () => connectRuntime(), 'atlas.connectCompute': connectCompute,
    'atlas.openComputeCenter': computeCenter, 'atlas.hireCloudOperator': () => computeOffice.hireOperator(), 'atlas.copyMcpConfig': copyMcpConfig,
    'atlas.connectDesktop': connectDesktop, 'atlas.connectCloud': connectCloud, 'atlas.disconnect': disconnect, 'atlas.refresh': refresh,
    'atlas.openWebsite': () => vscode.env.openExternal(vscode.Uri.parse(connection?.kind === 'cloud' ? connection.url : 'https://occult-kranti.github.io/engineering-intelligence-atlas/')),
    'atlas.openMcpGuide': () => vscode.env.openExternal(vscode.Uri.parse(GUID)),
  };
  for (const [id, action] of Object.entries(commands)) own(vscode.commands.registerCommand(id, async () => { try { return await action(); } catch (error) { void vscode.window.showErrorMessage(safeMessage(error)); } }));
  own(vscode.window.registerWebviewViewProvider('atlas.office', { resolveWebviewView(resolved) {
    view = resolved; view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] }; view.webview.html = sidebarHtml(view.webview, context.extensionUri);
    const listener = view.webview.onDidReceiveMessage(message => { if (typeof message?.command === 'string' && Object.hasOwn(commands, message.command)) void vscode.commands.executeCommand(message.command); if (message?.type === 'ready') publish(); });
    const dispose = view.onDidDispose(() => { listener.dispose(); dispose.dispose(); if (view === resolved) view = null; }); own(listener); own(dispose); publish();
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
function sidebarHtml(webview, root) {
  const nonce = crypto.randomBytes(20).toString('hex'); const asset = name => webview.asWebviewUri(vscode.Uri.joinPath(root, 'media', name));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; connect-src 'none'; base-uri 'none'; form-action 'none'"><link rel="stylesheet" href="${asset('office.css')}"><title>Daftar</title></head><body>
  <header><div class="brand">DAFTAR<span>One workspace. Every company.</span></div></header><p id="connection" class="muted" role="status">Choose where your workspace runs.</p>
  <button class="primary" data-command="atlas.openOffice">Open infinite office canvas</button><p>Companies, departments, employees and Donna share one blueprint. Office tools open on the canvas.</p>
  <h2>Compute & ownership</h2><button data-command="atlas.startLocalRuntime">Start workspace on this host</button><button data-command="atlas.startPersistentRuntime">Persistent workspace · tmux</button><button data-command="atlas.connectRuntime">Connect private runtime</button><button data-command="atlas.connectCompute">Vast.ai / SSH compute</button><button data-command="atlas.openComputeCenter">Donna’s compute controls</button>
  <p class="muted">In a Remote-SSH window, this extension runs on that remote host. A stopped instance stays stopped until you resume it.</p>
  <details><summary>Existing connections</summary><button data-command="atlas.connectDesktop">Connect desktop</button><button data-command="atlas.connectCloud">Connect website</button><button data-command="atlas.copyMcpConfig">Copy MCP configuration</button><button data-command="atlas.disconnect">Disconnect editor</button></details>
  <script nonce="${nonce}" src="${asset('office.js')}"></script></body></html>`;
}
module.exports = { activate, safeMessage, deactivate: () => deactivateActive() };
