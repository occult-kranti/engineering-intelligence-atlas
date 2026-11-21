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

function applySessionHardening(): void {
  const ses = session.defaultSession;
  // Deny all permission requests (camera, mic, notifications, …) by default.
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  // Block any attempt to install service workers from remote content? The
  // online Director may legitimately use them; leave default behavior.
}

async function main(): Promise<void> {
  const currentProfile = app.getPath('userData');
  const preservedProfile = existingUserDataPath(currentProfile, app.getPath('appData'), app.commandLine.hasSwitch('user-data-dir'), fs.existsSync);
  if (preservedProfile !== currentProfile) app.setPath('userData', preservedProfile);
  await app.whenReady();
  applySessionHardening();

  const userDataPath = app.getPath('userData');
  const windowManager = new WindowManager();
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

  app.on('activate', () => {
    // Single-window shell: re-create only if the window was destroyed.
    if (windowManager.window.isDestroyed()) {
      void main();
    }
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

void main();
