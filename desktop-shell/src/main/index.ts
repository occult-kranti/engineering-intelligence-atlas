import { app, safeStorage, session } from 'electron';
import path from 'node:path';
import { WindowManager } from './windows';
import { JobManager } from './jobs';
import { SettingsStore } from './settings';
import { registerIpc } from './ipc';
import { CredentialVault } from './vault';
import { generateWithProvider } from './providers';
import { generateWithOllama } from './ollama';
import { ProjectRunner, ProjectStore, type GenerateFn } from './projects';

/**
 * Research Director Desktop — main process entry.
 *
 * Security posture:
 *  - contextIsolation: true, nodeIntegration: false, sandbox: true everywhere.
 *  - No remote module, no TLS certificate bypass, no shell-based process
 *    spawning, no arbitrary command execution (only fixed execFile argument
 *    vectors for python -m venv / pip install and nvidia-smi).
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
  const projectRunner = new ProjectRunner(projectStore, generate);

  registerIpc({ windowManager, jobManager, settings, vault, projectStore, projectRunner, catalogPath, userDataPath });

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
