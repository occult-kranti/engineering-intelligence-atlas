import fs from 'node:fs';
import path from 'node:path';
import type { DesktopSettings } from '../shared/contract';
import { normalizeRuntimeUrl } from './urlValidation';

/**
 * Persistent shell settings. The ONLY persisted field is the non-secret
 * runtime URL. No tokens, credentials, or paths outside userData.
 */
export class SettingsStore {
  private readonly filePath: string;
  private settings: DesktopSettings = { runtimeUrl: null };

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'settings.json');
    this.load();
  }

  private load(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Record<string, unknown>;
      if (typeof raw.runtimeUrl === 'string') {
        // Re-validate on load; discard anything that no longer passes.
        try {
          this.settings.runtimeUrl = normalizeRuntimeUrl(raw.runtimeUrl);
        } catch {
          this.settings.runtimeUrl = null;
        }
      }
    } catch {
      // Missing or unreadable settings file: start fresh.
    }
  }

  get(): DesktopSettings {
    return { ...this.settings };
  }

  setRuntimeUrl(url: string): DesktopSettings {
    const normalized = normalizeRuntimeUrl(url); // throws on invalid input
    this.settings.runtimeUrl = normalized;
    this.persist();
    return this.get();
  }

  private persist(): void {
    const tmp = `${this.filePath}.tmp`;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(this.settings, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }
}
