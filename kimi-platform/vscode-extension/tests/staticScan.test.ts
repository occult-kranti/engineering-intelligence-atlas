/**
 * Static safety scans over our own sources — run in CI to keep the extension
 * within its stated security envelope:
 *  - no child_process / terminal / remote execution
 *  - token confined to SecretStorage access (bridge/manager.ts only)
 *  - webview script has no network APIs and no innerHTML
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function listFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
      out.push(...listFiles(full, exts));
    } else if (exts.some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

const SRC_FILES = listFiles(join(ROOT, 'src'), ['.ts']);
const MEDIA_JS = readFileSync(join(ROOT, 'media', 'chat.js'), 'utf8');

describe('no execution escapes', () => {
  it('no child_process, exec, spawn, or terminal usage anywhere in src', () => {
    const banned = [
      /child_process/,
      /\bexecSync\b/,
      /\bexecFileSync\b/,
      /\bspawnSync?\b/,
      /createTerminal/,
      /shell\.exec/,
    ];
    for (const file of SRC_FILES) {
      const text = readFileSync(file, 'utf8');
      for (const re of banned) {
        expect(re.test(text), `${relative(ROOT, file)} matches ${re}`).toBe(false);
      }
    }
  });

  it('no WebSocket/EventSource in extension code (polling only)', () => {
    for (const file of SRC_FILES) {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/new WebSocket/);
      expect(text).not.toMatch(/EventSource/);
    }
  });

  it('no deprecated chat participant API', () => {
    for (const file of SRC_FILES) {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/vscode\.chat\.createChatParticipant/);
      expect(text).not.toMatch(/registerChatParticipant/);
    }
  });
});

describe('token confinement', () => {
  it('SecretStorage is touched only in bridge/manager.ts', () => {
    for (const file of SRC_FILES) {
      const text = readFileSync(file, 'utf8');
      const rel = relative(ROOT, file);
      if (rel === join('src', 'bridge', 'manager.ts')) {
        expect(text).toContain('context.secrets');
      } else {
        expect(text, rel).not.toMatch(/secrets\.(store|get|delete)/);
      }
    }
  });

  it('token is never written to settings/workspaceState/globalState', () => {
    for (const file of SRC_FILES) {
      const text = readFileSync(file, 'utf8');
      expect(text, relative(ROOT, file)).not.toMatch(/workspaceState.*[Tt]oken/);
      expect(text, relative(ROOT, file)).not.toMatch(/globalState.*[Tt]oken/);
      expect(text, relative(ROOT, file)).not.toMatch(/update\([^)]*token/i);
    }
  });

  it('the webview script never sees tokens, hosts, or ports', () => {
    expect(MEDIA_JS).not.toMatch(/token/i);
    expect(MEDIA_JS).not.toMatch(/Authorization/i);
    expect(MEDIA_JS).not.toMatch(/127\.0\.0\.1|localhost|\[::1\]/);
  });
});

describe('webview script hygiene', () => {
  it('renders with textContent only — never innerHTML', () => {
    expect(MEDIA_JS).not.toMatch(/innerHTML/);
    expect(MEDIA_JS).not.toMatch(/outerHTML/);
    expect(MEDIA_JS).not.toMatch(/document\.write/);
    expect(MEDIA_JS).not.toMatch(/insertAdjacentHTML/);
  });

  it('has no network egress or eval', () => {
    expect(MEDIA_JS).not.toMatch(/\bfetch\s*\(/);
    expect(MEDIA_JS).not.toMatch(/XMLHttpRequest/);
    expect(MEDIA_JS).not.toMatch(/WebSocket/);
    expect(MEDIA_JS).not.toMatch(/EventSource/);
    expect(MEDIA_JS).not.toMatch(/\beval\s*\(/);
    expect(MEDIA_JS).not.toMatch(/new Function/);
    expect(MEDIA_JS).not.toMatch(/import\s*\(/);
  });
});
