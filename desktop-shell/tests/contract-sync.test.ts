import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CHANNELS } from '../src/shared/contract';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('preload / contract sync', () => {
  const preload = read('src/preload/index.ts');

  it('predeclares exactly the contract channel strings', () => {
    for (const channel of Object.values(CHANNELS)) {
      expect(preload).toContain(`'${channel}'`);
    }
  });

  it('exposes the bridge only on file:// pages', () => {
    expect(preload).toContain("window.location.protocol === 'file:'");
    expect(preload).toContain("contextBridge.exposeInMainWorld('desktopBridge'");
  });

  it('exposes no generic exec, fs, or path access', () => {
    expect(preload).not.toMatch(/\bexec\b/);
    expect(preload).not.toContain('node:fs');
    expect(preload).not.toContain('node:path');
    expect(preload).not.toContain('node:child_process');
  });
});

describe('remote content isolation', () => {
  const windows = read('src/main/windows.ts');

  it('creates the content view without a preload (no bridge for remote pages)', () => {
    const block = windows.slice(windows.indexOf('function createContentView'));
    const prefs = block.slice(0, block.indexOf('}));'));
    expect(prefs).not.toMatch(/preload:/);
    expect(prefs).toContain('contextIsolation: true');
    expect(prefs).toContain('nodeIntegration: false');
    expect(prefs).toContain('sandbox: true');
  });

  it('hardens the shell window webPreferences', () => {
    expect(windows).toContain('contextIsolation: true');
    expect(windows).toContain('nodeIntegration: false');
    expect(windows).toContain('sandbox: true');
    expect(windows).toContain('webSecurity: true');
    expect(windows).toContain('allowRunningInsecureContent: false');
  });
});

describe('global security posture (static checks)', () => {
  const sources = ['src/main/index.ts', 'src/main/windows.ts', 'src/main/ipc.ts', 'src/main/systemInfo.ts', 'src/main/venv.ts', 'src/main/downloads.ts', 'src/main/vault.ts', 'src/main/providers.ts', 'src/main/ollama.ts', 'src/main/projects.ts', 'src/main/senderGuard.ts', 'src/main/company.ts', 'src/main/office.ts', 'src/main/officeWorker.ts', 'src/preload/index.ts'].map(read);

  it('never enables remote module or disables webSecurity', () => {
    for (const src of sources) {
      expect(src).not.toContain('enableRemoteModule');
      expect(src).not.toContain('webSecurity: false');
      expect(src).not.toContain('contextIsolation: false');
      expect(src).not.toContain('nodeIntegration: true');
      expect(src).not.toContain('sandbox: false');
    }
  });

  it('never bypasses certificate errors', () => {
    for (const src of sources) {
      expect(src).not.toContain("on('certificate-error'");
      expect(src).not.toContain('on("certificate-error"');
    }
  });

  it('never uses shell:true or shell-based child_process APIs', () => {
    for (const src of sources) {
      expect(src).not.toMatch(/shell:\s*true/);
      // execFile/execFileSync only; never exec()/execSync()/spawn().
      expect(src).not.toMatch(/(?<![.\w])exec\s*\(/);
      expect(src).not.toContain('execSync');
      expect(src).not.toMatch(/(?<![.\w])spawn\s*\(/);
    }
  });

  it('never downloads from metadata mirrors (huggingface.co only)', () => {
    for (const src of sources) {
      expect(src).not.toContain('hf-mirror');
    }
    expect(read('src/main/downloads.ts')).toContain('https://huggingface.co/');
  });

  it('preloads never read keys back (no getKey/getApiKey bridge path)', () => {
    expect(read('src/preload/index.ts')).not.toMatch(/getApiKey|readApiKey|getKey/);
  });

  it('IPC handlers enforce sender validation via the guard wrapper', () => {
    const ipc = read('src/main/ipc.ts');
    // Every handler registration must be wrapped in guard(...).
    const registrations = ipc.match(/register\(CHANNELS\.\w+,/g) ?? [];
    const guarded = ipc.match(/register\(CHANNELS\.\w+, guard\(/g) ?? [];
    expect(registrations.length).toBeGreaterThan(0);
    expect(guarded.length).toBe(registrations.length);
    expect(ipc).toContain('ipcMain.handle(channel, handler)');
  });
});
