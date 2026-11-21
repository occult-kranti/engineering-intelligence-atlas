import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { existingUserDataPath } from '../src/main/profileMigration';

const DATA = path.join(path.sep, 'data');
const at = (...parts: string[]) => path.join(DATA, ...parts);

describe('Daftar profile continuity', () => {
  it('reuses a prior installed profile after the product rename', () => {
    const getAppData = vi.fn(() => DATA);
    expect(existingUserDataPath(at('Daftar'), getAppData, false, p => p === at('Research Director Desktop'))).toBe(at('Research Director Desktop'));
    expect(getAppData).toHaveBeenCalledTimes(1);
  });
  it('preserves an explicit isolated profile and an existing Daftar profile', () => {
    const isolated = path.join(path.sep, 'temp', 'isolated');
    const unavailableAppData = vi.fn(() => { throw new Error("Failed to get 'appData' path"); });
    const unexpectedProbe = vi.fn(() => { throw new Error('Explicit profiles must not probe migration paths'); });
    expect(existingUserDataPath(isolated, unavailableAppData, true, unexpectedProbe)).toBe(isolated);
    expect(existingUserDataPath(at('Daftar'), unavailableAppData, false, () => true)).toBe(at('Daftar'));
    expect(unavailableAppData).not.toHaveBeenCalled();
    expect(unexpectedProbe).not.toHaveBeenCalled();
  });
  it('keeps a new installation and supports the older source-run profile name', () => {
    expect(existingUserDataPath(at('Daftar'), () => DATA, false, () => false)).toBe(at('Daftar'));
    expect(existingUserDataPath(at('Daftar'), () => DATA, false, p => p === at('research-director-desktop-shell'))).toBe(at('research-director-desktop-shell'));
  });
  it('reports an unavailable migration root when no usable profile was supplied', () => {
    const unavailableAppData = vi.fn(() => { throw new Error("Failed to get 'appData' path"); });
    expect(() => existingUserDataPath(at('Daftar'), unavailableAppData, false, () => false)).toThrow("Failed to get 'appData' path");
    expect(unavailableAppData).toHaveBeenCalledTimes(1);
  });
});
