import path from 'node:path';
import fs from 'node:fs';
import { BrowserWindow, WebContentsView, shell } from 'electron';
import type { ShellMode } from '../shared/contract';
import { CHANNELS } from '../shared/contract';
import { isAllowedContentNavigation, validateExternalUrl } from './urlValidation';

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
    minWidth: 900,
    minHeight: 600,
    title: 'Research Director Desktop',
    backgroundColor: '#0f1420',
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
  return view;
}

export class WindowManager {
  private win: BrowserWindow;
  private contentView: WebContentsView | null = null;
  private mode: ShellMode = 'launcher';
  private currentContentUrl: string | null = null;
  /** What the content view currently shows; drives the navigation policy. */
  private contentKind: 'runtime' | 'atlas' | null = null;
  /** Validated runtime session origin (https, or loopback http only). */
  private runtimeOrigin: string | null = null;
  /** Resolved atlas root while the offline atlas is shown. */
  private atlasRoot: string | null = null;

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
    // Navigation policy (isAllowedContentNavigation is pure and unit-tested):
    // runtime => https only (http only for the validated loopback session
    // origin); atlas => contained file: paths only; everything else denied.
    view.webContents.on('will-navigate', (event, url) => {
      const allowed = isAllowedContentNavigation(url, {
        kind: this.contentKind,
        runtimeOrigin: this.runtimeOrigin,
        atlasRoot: this.atlasRoot,
      });
      if (!allowed) {
        event.preventDefault();
        // Atlas-mode web links open in the user's browser instead.
        if (/^https?:/i.test(url)) void openExternalUrl(url);
      }
    });
    // Keep the toolbar location in sync with in-app runtime navigations.
    view.webContents.on('did-navigate', (_event, url) => {
      if (this.contentKind === 'runtime') this.setMode('content', url);
    });
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
    this.contentKind = null;
    this.runtimeOrigin = null;
    this.atlasRoot = null;
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
    // The shared will-navigate policy restricts the atlas to this directory.
    this.contentKind = 'atlas';
    this.atlasRoot = path.resolve(atlasDir);
    await view.webContents.loadFile(path.join(atlasDir, 'index.html'));
    this.setMode('content', 'atlas://offline');
    return { ok: true };
  }

  /** Open the authenticated online runtime in the content view (no bridge). */
  async openRuntime(normalizedUrl: string): Promise<{ ok: boolean; error?: string }> {
    const view = this.attachContentView();
    // normalizedUrl is pre-validated: https:, or http: for loopback only.
    this.contentKind = 'runtime';
    this.runtimeOrigin = new URL(normalizedUrl).origin;
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
