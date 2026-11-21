import path from 'node:path';
import fs from 'node:fs';
import { BrowserWindow, WebContentsView, shell } from 'electron';
import type { ShellMode } from '../shared/contract';
import { CHANNELS } from '../shared/contract';
import { validateExternalUrl } from './urlValidation';

/**
 * Window management.
 *
 * The main window loads the local chrome/launcher page (file://) which is the
 * ONLY page that receives the desktopBridge preload. Remote runtime content
 * and the offline atlas are shown inside a WebContentsView that has NO
 * preload, so no desktop IPC is ever exposed to remote pages.
 *
 * There is intentionally no TLS certificate bypass handler anywhere in this
 * project: invalid certificates always fail closed.
 */

export const TOOLBAR_HEIGHT = 44;

export interface ShellWindows {
  window: BrowserWindow;
  /** Present while content mode is active. */
  contentView: WebContentsView | null;
}

export function getRendererDistDir(): string {
  return path.join(__dirname, '..', 'renderer');
}

export function getAtlasDir(): string | null {
  const candidates = [
    // Packaged location (electron-builder extraResources).
    ...(process.resourcesPath ? [path.join(process.resourcesPath, 'atlas')] : []),
    // Development checkout.
    path.join(__dirname, '..', '..', 'resources', 'atlas'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

/** Validate + open an external URL in the user's default browser. */
export async function openExternalUrl(raw: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = validateExternalUrl(raw);
    await shell.openExternal(url);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Deny new windows; route valid http(s) targets to the external browser. */
function guardWindowOpen(webContents: Electron.WebContents): void {
  webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrl(url);
    return { action: 'deny' };
  });
}

export function createShellWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 760,
    minHeight: 600,
    title: 'Daftar',
    backgroundColor: '#f6f7f4',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Never enabled anywhere in this project.
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  win.removeMenu();

  guardWindowOpen(win.webContents);
  // The chrome page must never navigate away to a remote origin.
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      void openExternalUrl(url);
    }
  });

  void win.loadFile(path.join(getRendererDistDir(), 'chrome.html'));
  return win;
}

function createContentView(): WebContentsView {
  // NOTE: no preload here on purpose — remote pages get no desktop bridge.
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  guardWindowOpen(view.webContents);
  // Remote content may navigate within https:; anything else goes external.
  view.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'file:') {
        return; // allowed: app-internal navigations
      }
    } catch {
      // fall through to block
    }
    event.preventDefault();
  });

  return view;
}

export class WindowManager {
  private win: BrowserWindow;
  private contentView: WebContentsView | null = null;
  private mode: ShellMode = 'launcher';
  private currentContentUrl: string | null = null;

  constructor() {
    this.win = createShellWindow();
    const applyBounds = () => this.layoutContent();
    this.win.on('resize', applyBounds);
    this.win.on('maximize', applyBounds);
    this.win.on('unmaximize', applyBounds);
    this.win.on('closed', () => {
      this.contentView = null;
    });
    // Re-sync mode with the chrome page after every (re)load.
    this.win.webContents.on('did-finish-load', () => {
      this.setMode(this.mode, this.currentContentUrl);
    });
  }

  get window(): BrowserWindow {
    return this.win;
  }

  private layoutContent(): void {
    if (!this.contentView || this.win.isDestroyed()) return;
    const [width, height] = this.win.getContentSize();
    this.contentView.setBounds({
      x: 0,
      y: TOOLBAR_HEIGHT,
      width: width ?? 0,
      height: Math.max(0, (height ?? 0) - TOOLBAR_HEIGHT),
    });
  }

  private setMode(mode: ShellMode, url: string | null): void {
    this.mode = mode;
    this.currentContentUrl = url;
    if (!this.win.isDestroyed()) {
      this.win.webContents.send(CHANNELS.modeChanged, mode, url);
    }
  }

  private attachContentView(): WebContentsView {
    this.detachContentView();
    const view = createContentView();
    this.contentView = view;
    this.win.contentView.addChildView(view);
    this.layoutContent();
    return view;
  }

  private detachContentView(): void {
    if (this.contentView) {
      try {
        this.win.contentView.removeChildView(this.contentView);
        this.contentView.webContents.close();
      } catch {
        // already gone
      }
      this.contentView = null;
    }
  }

  /** Show the offline atlas (packaged static SPA) in the content view. */
  async openOfflineAtlas(): Promise<{ ok: boolean; error?: string }> {
    const atlasDir = getAtlasDir();
    if (!atlasDir) {
      return {
        ok: false,
        error:
          'Offline atlas is not installed. Run `npm run sync-atlas` in desktop-shell after building the web app.',
      };
    }
    const view = this.attachContentView();
    // Restrict the atlas to its own directory tree.
    view.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('file://')) {
        event.preventDefault();
        void openExternalUrl(url);
        return;
      }
      const target = path.resolve(decodeURIComponent(new URL(url).pathname));
      const root = path.resolve(atlasDir);
      if (target !== root && !target.startsWith(root + path.sep)) {
        event.preventDefault();
      }
    });
    await view.webContents.loadFile(path.join(atlasDir, 'index.html'));
    this.setMode('content', 'atlas://offline');
    return { ok: true };
  }

  /** Open the authenticated online runtime in the content view (no bridge). */
  async openRuntime(normalizedUrl: string): Promise<{ ok: boolean; error?: string }> {
    const view = this.attachContentView();
    try {
      await view.webContents.loadURL(normalizedUrl);
    } catch (err) {
      this.detachContentView();
      this.setMode('launcher', null);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    this.setMode('content', normalizedUrl);
    return { ok: true };
  }

  backToLauncher(): void {
    this.detachContentView();
    this.setMode('launcher', null);
  }

  getMode(): { mode: ShellMode; url: string | null } {
    return { mode: this.mode, url: this.currentContentUrl };
  }
}
