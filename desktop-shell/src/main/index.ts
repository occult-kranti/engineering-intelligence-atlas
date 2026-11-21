import { app, clipboard, dialog, safeStorage, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { WindowManager, openExternalUrl } from './windows';
import { JobManager } from './jobs';
import { SettingsStore } from './settings';
import { registerIpc } from './ipc';
import { CredentialVault } from './vault';
import { generateWithProvider } from './providers';
import { generateWithOllama } from './ollama';
import { ProjectRunner, ProjectStore, type GenerateFn } from './projects';
import { CompanyService, findNativeCore } from './company';
import { OfficeService } from './office';
import { OfficeWorkerPool } from './officeWorker';
import { PersonalDashboardServer } from './personalDashboard';
import { withGlobalBudget } from './globalBudget';
import { CloudSyncService } from './cloudSync';
import { existingUserDataPath } from './profileMigration';

/**
 * Daftar — main process entry.
 *
 * Security posture:
 *  - contextIsolation: true, nodeIntegration: false, sandbox: true everywhere.
 *  - No remote module, no TLS certificate bypass, no shell-based process
 *    spawning, no arbitrary command execution (only fixed execFile argument
 *    vectors for python -m venv / pip install, nvidia-smi and the bundled
 *    Rust metadata/state core; no repository code is executed).
 *  - Remote pages run in a WebContentsView with NO preload, so the
 *    desktopBridge IPC surface is unreachable from remote content; every IPC
 *    handler additionally validates the sender is the local file:// chrome.
 *  - API keys live only as safeStorage-encrypted blobs under userData/vault.
 *    They are decrypted in main, per call, and never exposed over IPC.
 */

// Main-only, bounded, sanitized startup record. Never exposed to renderer/IPC.
interface StartupStage { stage: string; outcome: 'start' | 'ok' | 'error'; tMs: number; error?: { name: string; message: string; stack?: string } }
interface StartupLifecycle { event: string; tMs: number; id?: number; code?: number; reason?: string; detail?: string }
const startupT0 = Date.now();
const startupStages: StartupStage[] = [];
const startupLifecycle: StartupLifecycle[] = [];
function sanitizeStartupText(value: unknown, max: number): string {
  try {
    return String(value ?? '')
      .replace(/file:\/\/\/?[^\s)'"]*/gi, (m) => 'file://<path>/' + (m.split(/[\\/]/).pop() ?? '').split(/[?#]/)[0])
      .replace(/https?:\/\/[^\s)'"?#]*[?#][^\s)'"]*/gi, (m) => m.split(/[?#]/)[0])
      .replace(/[A-Za-z]:[\\/](?:[^\\/\s:)'"]+[\\/])+/g, '<path>/')
      .replace(/(?:\/(?:home|Users|root|var|tmp|opt|mnt|private)\/)(?:[^\/\s:)'"]+\/)*/g, '<path>/')
      .replace(/(^|[^A-Za-z0-9_-])(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{8,}/g, '$1[redacted]')
      .replace(/(token|secret|password|authorization|api[_-]?key)(\s*[=:]\s*)\S+/gi, '$1$2[redacted]')
      .slice(0, max);
  } catch { return '[unsanitizable]'; }
}
function recordStage(stage: string, outcome: StartupStage['outcome'], error?: unknown): void {
  try {
    if (startupStages.length >= 64) return;
    const entry: StartupStage = { stage: stage.slice(0, 64), outcome, tMs: Date.now() - startupT0 };
    if (error !== undefined) {
      const e = error instanceof Error ? error : new Error(String(error));
      entry.error = { name: sanitizeStartupText(e.name, 80), message: sanitizeStartupText(e.message, 500), stack: sanitizeStartupText((e.stack ?? '').split('\n').slice(0, 6).join('\n'), 1200) };
    }
    startupStages.push(entry);
  } catch { /* recording must never throw */ }
}
function recordLifecycle(event: string, extra: Partial<StartupLifecycle> = {}): void {
  try {
    if (startupLifecycle.length >= 100) return;
    const entry: StartupLifecycle = { event: event.slice(0, 48), tMs: Date.now() - startupT0 };
    if (typeof extra.id === 'number') entry.id = extra.id;
    if (typeof extra.code === 'number') entry.code = extra.code;
    if (extra.reason !== undefined) entry.reason = sanitizeStartupText(extra.reason, 80);
    if (extra.detail !== undefined) entry.detail = sanitizeStartupText(extra.detail, 200);
    startupLifecycle.push(entry);
  } catch { /* ignore */ }
}
function safeIdentity(): Record<string, unknown> {
  const out: Record<string, unknown> = { pid: process.pid, electron: process.versions.electron, node: process.versions.node };
  try { out.packaged = app.isPackaged; } catch { /* ignore */ }
  try { out.version = app.getVersion(); } catch { /* ignore */ }
  try { out.appPath = path.basename(app.getAppPath()); } catch { /* ignore */ }
  return out;
}
(globalThis as Record<string, unknown>).__atlasStartupRecord = () => ({ stages: startupStages.slice(), lifecycle: startupLifecycle.slice(), identity: safeIdentity() });
recordStage('entry', 'ok');
// Monitor only: does not replace Node's normal uncaught-exception handling.
process.on('uncaughtExceptionMonitor', (err) => { recordStage('uncaughtException', 'error', err); });

function installLifecycleRecorders(): void {
  app.on('browser-window-created', (_e, win) => {
    recordLifecycle('browser-window-created', { id: win.id });
    win.on('closed', () => recordLifecycle('window-closed', { id: win.id }));
  });
  app.on('web-contents-created', (_e, contents) => {
    recordLifecycle('web-contents-created', { id: contents.id });
    contents.on('did-fail-load', (_ev, code, description, url) => recordLifecycle('did-fail-load', { id: contents.id, code, reason: String(description), detail: String(url) }));
    contents.on('did-finish-load', () => recordLifecycle('did-finish-load', { id: contents.id }));
    contents.on('render-process-gone', (_ev, details) => recordLifecycle('render-process-gone', { id: contents.id, code: details?.exitCode, reason: details?.reason }));
  });
}

function applySessionHardening(): void {
  const ses = session.defaultSession;
  // Deny all permission requests (camera, mic, notifications, …) by default.
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  // Block any attempt to install service workers from remote content? The
  // online Director may legitimately use them; leave default behavior.
}

async function main(): Promise<void> {
  recordStage('profile-resolve', 'start');
  const currentProfile = app.getPath('userData');
  const preservedProfile = existingUserDataPath(currentProfile, app.getPath('appData'), app.commandLine.hasSwitch('user-data-dir'), fs.existsSync);
  if (preservedProfile !== currentProfile) app.setPath('userData', preservedProfile);
  recordStage('profile-resolve', 'ok');
  recordStage('app-ready', 'start');
  await app.whenReady();
  recordStage('app-ready', 'ok');
  recordStage('session-hardening', 'start');
  applySessionHardening();
  recordStage('session-hardening', 'ok');

  const userDataPath = app.getPath('userData');
  installLifecycleRecorders();
  recordStage('window-construct', 'start');
  const windowManager = new WindowManager();
  recordStage('window-construct', 'ok');
  const jobManager = new JobManager(path.join(userDataPath, 'logs'));
  const settings = new SettingsStore(userDataPath);
  const catalogPath = path.join(app.getAppPath(), 'models.catalog.json');
  const vault = new CredentialVault(userDataPath, safeStorage);
  const projectStore = new ProjectStore(userDataPath);

  // Resolves credentials per call from the vault; keys are never cached,
  // logged, persisted in projects, or sent to the renderer. Ollama needs no
  // key (loopback only).
  const generate: GenerateFn = async (req) => {
    if (req.provider === 'ollama') {
      return generateWithOllama(req);
    }
    const key = vault.getKey(req.provider);
    if (!key) {
      throw new Error(
        `No usable ${req.provider} API key is configured. Set one in Local Projects → API keys.`,
      );
    }
    return generateWithProvider(req.provider, key, req);
  };
  const checkoutRoot = path.resolve(app.getAppPath(), '..');
  const companyService = new CompanyService({
    userDataPath,
    seedDir: app.isPackaged ? path.join(process.resourcesPath, 'company') : path.join(checkoutRoot, 'company'),
    binaryPath: findNativeCore(app.getAppPath(), app.isPackaged ? process.resourcesPath : undefined),
    repositoryRoot: !app.isPackaged && fs.existsSync(path.join(checkoutRoot, '.git')) ? checkoutRoot : null,
    listRuns: () => projectStore.listRuns(),
    pickRepository: async () => {
      const selection = await dialog.showOpenDialog(windowManager.window, {
        title: 'Choose the local company repository',
        buttonLabel: 'Index this folder',
        properties: ['openDirectory'],
      });
      return selection.canceled ? null : selection.filePaths[0] ?? null;
    },
  });
  const officeService = new OfficeService({
    githubToken: () => vault.getKey('github'),
    userDataPath,
    seedDir: app.isPackaged ? path.join(process.resourcesPath, 'company') : path.join(checkoutRoot, 'company'),
    binaryPath: findNativeCore(app.getAppPath(), app.isPackaged ? process.resourcesPath : undefined),
  });
  const projectRunner = new ProjectRunner(projectStore, withGlobalBudget(generate, request => officeService.workerCommand(request)));
  const cloudSync = new CloudSyncService({
    userDataPath, safeStorage,
    snapshot: () => officeService.officeSnapshot(),
    command: request => officeService.officeCommand(request),
  });
  const officeWorker = new OfficeWorkerPool({
    prepareContext: (job) => officeService.prepareWorkerContext(job),
    executeTool: async (job, text) => {
      if (!job.allowedTools.includes('github.publish_changes')) throw new Error('Publishing is not an allowed capability for this job.');
      await officeService.assertWorkerCapability(job, 'github.publish_changes');
      let changes: Record<string, unknown>;
      try { changes = JSON.parse(text); } catch { throw new Error('The code employee did not return a valid JSON changeset. Artifact preserved.'); }
      if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Expected a changeset object.');
      const result = await officeService.githubOperation({ ...changes, action: 'github_operation', companyId: job.companyId, operation: 'publish_changes', reviewed: job.authorized });
      if (!result.ok) throw new Error(result.error || 'GitHub publication failed.');
      const published = result.snapshot?.lastAction?.github as { url?: string; commit?: string };
      if (!published?.url) throw new Error('GitHub publication returned no verified commit evidence.');
      return { summary: `Published commit ${published.commit}`, evidenceUrl: published.url };
    },
    snapshot: () => officeService.officeSnapshot(),
    command: (request) => officeService.workerCommand(request),
    generate,
    artifactRoot: path.join(userDataPath, 'office-artifacts'),
    seedDir: app.isPackaged ? path.join(process.resourcesPath, 'company') : path.join(checkoutRoot, 'company'),
  });
  app.once('before-quit', () => officeWorker.stop());

  let browserHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const personalDashboard = new PersonalDashboardServer({
    rendererRoot: path.join(__dirname, '../renderer'),
    dispatch: (method, args) => {
      const handler = browserHandlers.get(method);
      if (!handler || method === 'openPersonalDashboard') throw new Error('Unsupported browser operation.');
      return handler(...args);
    },
  });
  browserHandlers = registerIpc({ windowManager, jobManager, settings, vault, projectStore, projectRunner, companyService, officeService, officeWorker, cloudSync, catalogPath, userDataPath,
    copyEditorPairing: async () => {
      try { clipboard.writeText(await personalDashboard.launchUrl()); return { ok: true, expiresAt: new Date(Date.now() + 5 * 60000).toISOString() }; }
      catch { return { ok: false, error: 'The editor pairing link could not be copied.' }; }
    },
    openPersonalDashboard: async () => {
      try { const url = await personalDashboard.launchUrl(); const opened = await openExternalUrl(url); return { ...opened, url: new URL(url).origin }; }
      catch { return { ok: false, error: 'The personal browser dashboard could not start.' }; }
    },
  });
  app.once('before-quit', () => { void personalDashboard.close(); });
  recordStage('init-complete', 'ok');

  app.on('activate', () => {
    // Single-window shell: re-create only if the window was destroyed.
    if (windowManager.window.isDestroyed()) {
      runStartup('activation');
    }
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

/** Single explicit error boundary for initial and activation startup. No retry, no substitute window. */
function runStartup(origin: 'initial' | 'activation'): void {
  main().catch((err) => {
    recordStage(origin === 'initial' ? 'main-rejected' : 'activation-rejected', 'error', err);
    try { console.error('Daftar startup failed (' + origin + '):', sanitizeStartupText(err instanceof Error ? err.message : err, 500)); } catch { /* ignore */ }
  });
}

runStartup('initial');
