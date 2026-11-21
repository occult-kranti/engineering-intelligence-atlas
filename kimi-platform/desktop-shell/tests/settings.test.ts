import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SettingsStore } from '../src/main/settings';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dshell-settings-'));
}

describe('SettingsStore', () => {
  it('starts empty', () => {
    expect(new SettingsStore(tmp()).get()).toEqual({ runtimeUrl: null });
  });

  it('persists only the non-secret runtime URL', () => {
    const dir = tmp();
    const store = new SettingsStore(dir);
    store.setRuntimeUrl('https://director.example.com');
    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
    expect(Object.keys(raw)).toEqual(['runtimeUrl']);
    expect(raw.runtimeUrl).toBe('https://director.example.com');
    // A fresh store reads it back.
    expect(new SettingsStore(dir).get().runtimeUrl).toBe('https://director.example.com');
  });

  it('rejects invalid URLs at write time', () => {
    const store = new SettingsStore(tmp());
    expect(() => store.setRuntimeUrl('http://evil.example.com')).toThrow();
    expect(() => store.setRuntimeUrl('https://u:p@example.com')).toThrow();
    expect(store.get().runtimeUrl).toBeNull();
  });

  it('discards a tampered persisted URL on load', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ runtimeUrl: 'http://evil.example.com' }));
    expect(new SettingsStore(dir).get().runtimeUrl).toBeNull();
  });
});
