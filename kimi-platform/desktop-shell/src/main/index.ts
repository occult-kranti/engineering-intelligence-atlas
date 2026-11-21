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
import { SkillRegistry } from './skills';
import { ChatManager, ChatStore } from './chat';
import { EnterpriseProgramRunner, EnterpriseStore } from './enterprises';
import { AssistantScheduler, AssistantStore } from './assistant';
import { CompanionServer, CompanionStore } from './companion';
import fs from 'node:fs';

/**
 * Resolve the bundled skills root: packaged builds get it via extraResources
 * (process.resourcesPath/skills), dev runs use resources/skills in the repo.
 */
function resolveSkillsRoot(): string {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'skills'),
    path.join(app.getAppPath(), 'resources', 'skills'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(path.join(candidate, 'skills.catalog.json'))) return candidate;
    } catch {
      // try next
    }
  }
  throw new Error('bundled skills catalog not found');
}

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
  const skills = { registry: new SkillRegistry(resolveSkillsRoot()), root: resolveSkillsRoot() };
  const projectRunner = new ProjectRunner(projectStore, generate, { skills });

  // v4: Director chat reuses the same vault-backed GenerateFn (keys never
  // leave the vault; Ollama stays loopback-only).
  const chat = new ChatManager(new ChatStore(userDataPath), projectStore, generate, { skills });

  // v4: VS Code companion bridge. Disabled by default; if the user enabled
  // it previously, start the loopback listener (fail closed without a token).
  const companion = new CompanionServer({
    store: new CompanionStore(userDataPath, safeStorage),
    projectStore,
    projectRunner,
    chat,
    skills,
  });
  void companion.startIfEnabled();
  app.on('will-quit', () => {
    void companion.close();
  });

  // v5: CEO mode. The enterprise store drives the SAME ProjectRunner — no
  // second agent runtime. Constructing the program runner reattaches any
  // program runs interrupted by a previous process.
  const enterpriseStore = new EnterpriseStore(userDataPath, { projects: projectStore, skills });
  const enterpriseRunner = new EnterpriseProgramRunner(enterpriseStore, projectRunner);

  // v6: Donna / shared assistants. The assistant store maps every executor
  // to the EXISTING stores above (no second runtime); the scheduler runs an
  // unref'd interval (never keeps the app alive) with boot reconciliation.
  const assistantStore = new AssistantStore(userDataPath, {
    enterprises: enterpriseStore,
    runner: enterpriseRunner,
    projects: projectStore,
    skills,
  });
  const assistantScheduler = new AssistantScheduler(assistantStore);
  assistantScheduler.start();
  app.on('will-quit', () => {
    assistantScheduler.stop();
  });

  registerIpc({ windowManager, jobManager, settings, vault, projectStore, projectRunner, skills, chat, companion, enterpriseStore, enterpriseRunner, assistantStore, assistantScheduler, catalogPath, userDataPath });

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
