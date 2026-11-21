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
  const sources = ['src/main/index.ts', 'src/main/windows.ts', 'src/main/ipc.ts', 'src/main/systemInfo.ts', 'src/main/venv.ts', 'src/main/downloads.ts', 'src/main/vault.ts', 'src/main/providers.ts', 'src/main/ollama.ts', 'src/main/projects.ts', 'src/main/skills.ts', 'src/main/hiring.ts', 'src/main/textCap.ts', 'src/main/senderGuard.ts', 'src/main/chat.ts', 'src/main/companion.ts', 'src/main/assistant.ts', 'src/main/githubMeta.ts', 'src/shared/office.ts', 'src/preload/index.ts'].map(read);

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
    const registrations = ipc.match(/ipcMain\.handle\(CHANNELS\.\w+,/g) ?? [];
    const guarded = ipc.match(/ipcMain\.handle\(CHANNELS\.\w+, guard\(/g) ?? [];
    expect(registrations.length).toBeGreaterThan(0);
    expect(guarded.length).toBe(registrations.length);
  });

  it('registers every contract channel in the main IPC layer', () => {
    const ipc = read('src/main/ipc.ts');
    const registered = new Set(ipc.match(/(?<=ipcMain\.handle\(CHANNELS\.)\w+/g) ?? []);
    const sendOnly = new Set(['jobEvent', 'modeChanged', 'projectEvent', 'enterpriseEvent', 'assistantEvent']); // main -> renderer pushes
    for (const key of Object.keys(CHANNELS)) {
      if (sendOnly.has(key)) continue;
      expect(registered.has(key), `CHANNELS.${key} has no ipcMain.handle registration`).toBe(true);
    }
  });

  it('skill registry treats bundled scripts as inert (never reads or runs them)', () => {
    const skills = read('src/main/skills.ts');
    expect(skills).not.toContain('child_process');
    // Only the SKILL.md body path is ever read; no path string ever points at scripts/.
    expect(skills).not.toMatch(/['"`][^'"`\n]*scripts\//);
    expect(skills).toContain('SKILL.md');
  });

  it('providers never auto-retry billed calls', () => {
    expect(read('src/main/providers.ts')).toContain('maxRetries: 0');
  });

  it('companion bridge binds loopback only and checks the token in constant time', () => {
    const companion = read('src/main/companion.ts');
    expect(companion).toContain("server.listen(port, '127.0.0.1'");
    expect(companion).not.toContain("listen(port, '0.0.0.0'");
    expect(companion).toContain('crypto.timingSafeEqual');
    expect(companion).not.toContain('Access-Control-Allow-Origin');
    expect(companion).not.toMatch(/console\.(log|info|debug)/);
  });

  it('companion status/IPC never returns the pairing token', () => {
    const contract = read('src/shared/contract.ts');
    const statusBlock = contract.slice(contract.indexOf('interface CompanionStatus'), contract.indexOf('interface CompanionEnableResult'));
    expect(statusBlock).not.toContain('token?:');
    expect(statusBlock).toContain('tokenFingerprint');
    const ipc = read('src/main/ipc.ts');
    // Only enable/regenerate handlers may mention tokens at all.
    expect(ipc).not.toMatch(/companionStatus[\s\S]{0,200}token/);
  });

  it('v6 github metadata reader is tokenless, api.github.com-only, no redirects', () => {
    const githubMeta = read('src/main/githubMeta.ts');
    expect(githubMeta).toContain("api.github.com");
    expect(githubMeta).toContain("redirect: 'manual'");
    expect(githubMeta).not.toMatch(/['"]authorization['"]\s*:/i);
    expect(githubMeta).not.toContain('Bearer');
    expect(githubMeta).not.toMatch(/ghp_[A-Za-z0-9]|github_pat_/);
    // No clone/download/code execution endpoints (the archived FLAG is metadata and stays).
    expect(githubMeta).not.toMatch(/\/tarball|\/zipball|git\/trees|\/contents|\/git\/refs/);
    expect(githubMeta).not.toContain('child_process');
  });

  it('v6 assistant store has no provider calls, no secrets, no shell', () => {
    const assistant = read('src/main/assistant.ts');
    expect(assistant).not.toContain('child_process');
    expect(assistant).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(assistant).not.toMatch(/authorization\s*:/i);
    // Never an emergency-stop action channel.
    const contract = read('src/shared/contract.ts');
    expect(Object.values(CHANNELS).some((c) => c.includes('stop') && c.includes('ast'))).toBe(false);
    expect(contract).not.toContain('emergency.stop');
  });

  it('v6 preload exposes bridge version 6', () => {
    const preload = read('src/preload/index.ts');
    expect(preload).toContain('version: 6');
    const contract = read('src/shared/contract.ts');
    expect(contract).toContain('BRIDGE_VERSION = 6');
  });

  it('bundled skills catalog and SKILL.md bodies contain no secret material', () => {
    const secretPatterns = [/sk-[A-Za-z0-9]{16,}/, /AKIA[0-9A-Z]{16}/, /BEGIN [A-Z ]*PRIVATE KEY/, /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]/i];
    const skillsRoot = path.join(root, 'resources', 'skills');
    const stack = [skillsRoot];
    const files: string[] = [];
    while (stack.length > 0) {
      const dir = stack.pop() as string;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) stack.push(p);
        else files.push(p);
      }
    }
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of secretPatterns) {
        expect(pattern.test(content), `${file} matches secret pattern ${pattern}`).toBe(false);
      }
    }
  });
});
