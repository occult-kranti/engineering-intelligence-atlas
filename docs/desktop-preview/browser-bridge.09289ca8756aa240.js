/** Browser transport for the same owner-only desktop workspace. No credentials are returned. */
const browserWindow = window;
const personalBrowser = location.protocol === 'http:' && location.hostname === '127.0.0.1' && !!document.querySelector('meta[name="atlas-personal-dashboard"]');
if (!browserWindow.desktopBridge && personalBrowser) {
    const sessionToken = new URLSearchParams(location.hash.slice(1)).get('session');
    if (sessionToken)
        history.replaceState(null, '', location.pathname);
    const ready = sessionToken ? fetch('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: sessionToken }), credentials: 'same-origin' }).then(async (res) => { if (!res.ok)
        throw new Error('Open a fresh dashboard link from the desktop app.'); }) : Promise.resolve();
    const call = async (method, ...args) => { await ready; const response = await fetch('/api/call', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ method, args }) }); const payload = await response.json(); if (!response.ok || payload.error)
        throw new Error(payload.error || 'Private workspace is locked. Reopen it from the desktop app.'); return payload.result; };
    const methods = ['cloudStatus', 'configureCloud', 'syncCloud', 'disconnectCloud', 'copyEditorPairing', 'getSystemInfo', 'getModelCatalog', 'checkModelRequirements', 'createVenv', 'downloadModel', 'getJobStatus', 'cancelJob', 'getSettings', 'getVaultStatus', 'setApiKey', 'revokeApiKey', 'importCredentialFile', 'listProviderModels', 'detectOllama', 'companySnapshot', 'registerCompany', 'refreshCompany', 'updateCompanyTask', 'indexCompanyRepository', 'officeSnapshot', 'officeCommand', 'officeWorkerStatus', 'setOfficeWorker', 'runOfficeQueue', 'modelPoolSnapshot', 'modelPoolRequest', 'modelPoolCancel', 'modelPoolSelect', 'listProjects', 'createProject', 'getProject', 'startRun', 'pauseRun', 'resumeRun', 'cancelRun', 'listRuns', 'readArtifact'];
    const bridge = { version: 3, transport: 'personal-browser' };
    for (const method of methods)
        bridge[method] = (...args) => call(method, ...args);
    bridge.openExternal = async (url) => { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol))
        return { ok: false, error: 'Unsupported link' }; window.open(parsed.href, '_blank', 'noopener,noreferrer'); return { ok: true }; };
    bridge.openOfflineAtlas = async () => { window.open('https://occult-kranti.github.io/engineering-intelligence-atlas/', '_blank', 'noopener,noreferrer'); return { ok: true }; };
    bridge.connectRuntime = async () => ({ ok: false, error: 'Use the desktop app to attach a separate runtime.' });
    bridge.backToLauncher = async () => ({ ok: true });
    bridge.openPersonalDashboard = async () => ({ ok: true, url: location.origin });
    bridge.onModeChanged = () => () => undefined;
    bridge.onJobEvent = (listener) => { const interval = setInterval(() => { void call('getJobStatus').then(rows => { if (Array.isArray(rows))
        rows.forEach(listener); }).catch(() => undefined); }, 5000); return () => clearInterval(interval); };
    bridge.onProjectEvent = (listener) => { const interval = setInterval(() => { void call('listRuns').then(rows => { if (Array.isArray(rows))
        rows.forEach(listener); }).catch(() => undefined); }, 5000); return () => clearInterval(interval); };
    browserWindow.desktopBridge = bridge;
}
if (!browserWindow.desktopBridge && ['http:', 'https:'].includes(location.protocol) && !personalBrowser) {
    const preview = fetch('./preview-state.6339761d7902456b.json').then(async (response) => { if (!response.ok)
        throw new Error('Starter preview is unavailable.'); return response.json(); });
    const bridge = { version: 3, transport: 'public-preview' };
    const unavailable = async () => ({ ok: false, snapshot: null, error: 'This is a read-only starter preview. Open the private desktop/browser workspace to make changes.' });
    for (const method of ['configureCloud', 'syncCloud', 'disconnectCloud', 'copyEditorPairing', 'officeCommand', 'setOfficeWorker', 'runOfficeQueue', 'registerCompany', 'refreshCompany', 'updateCompanyTask', 'indexCompanyRepository', 'setApiKey', 'revokeApiKey', 'importCredentialFile', 'listProviderModels', 'createProject', 'getProject', 'startRun', 'pauseRun', 'resumeRun', 'cancelRun', 'readArtifact', 'createVenv', 'downloadModel', 'cancelJob', 'connectRuntime', 'openPersonalDashboard'])
        bridge[method] = unavailable;
    bridge.cloudStatus = async () => ({ configured: false, connected: false, url: null, revision: null, lastSyncedAt: null, pendingCommands: 0, error: null, capability: 'snapshot-and-commands', encryptionAvailable: false });
    bridge.companySnapshot = async () => ({ ...(await preview).company, available: false, backend: 'unavailable', error: null, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, runCount: 0, completedRuns: 0, failedRuns: 0, source: 'local-project-runs' } });
    bridge.officeSnapshot = async () => ({ ok: true, snapshot: (await preview).office });
    bridge.officeWorkerStatus = async () => ({ enabled: false, running: false, activeJobId: null, lastError: null });
    bridge.getVaultStatus = async () => ({ encryptionAvailable: false, providers: Object.fromEntries(['openai', 'anthropic', 'github'].map(provider => [provider, { configured: false, readable: false, updatedAt: null }])) });
    bridge.listProjects = async () => [];
    bridge.listRuns = async () => [];
    bridge.getJobStatus = async () => [];
    bridge.getModelCatalog = async () => ({ models: [], rejected: [], catalogPath: 'Preview has no local model catalog.' });
    bridge.detectOllama = async () => ({ available: false, models: [], error: 'Local runtimes are available in the private app.' });
    bridge.getSettings = async () => ({ lastRuntimeUrl: null });
    bridge.getSystemInfo = async () => { throw new Error('Device information is available only in your private workspace.'); };
    bridge.openExternal = async (url) => { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol))
        return { ok: false }; window.open(parsed.href, '_blank', 'noopener,noreferrer'); return { ok: true }; };
    bridge.openOfflineAtlas = async () => { location.href = '../'; return { ok: true }; };
    bridge.backToLauncher = async () => ({ ok: true });
    for (const method of ['onModeChanged', 'onJobEvent', 'onProjectEvent'])
        bridge[method] = () => () => undefined;
    browserWindow.desktopBridge = bridge;
}
export {};
