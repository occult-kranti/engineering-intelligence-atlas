import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { existingUserDataPath } from '../src/main/profileMigration';

const DATA = path.join(path.sep, 'data');
const at = (...parts: string[]) => path.join(DATA, ...parts);

describe('Daftar profile continuity', () => {
  it('reuses a prior installed profile after the product rename', () => {
    expect(existingUserDataPath(at('Daftar'), DATA, false, p => p === at('Research Director Desktop'))).toBe(at('Research Director Desktop'));
  });
  it('preserves an explicit isolated profile and an existing Daftar profile', () => {
    const isolated = path.join(path.sep, 'temp', 'isolated');
    expect(existingUserDataPath(isolated, DATA, true, () => true)).toBe(isolated);
    expect(existingUserDataPath(at('Daftar'), DATA, false, () => true)).toBe(at('Daftar'));
  });
  it('keeps a new installation and supports the older source-run profile name', () => {
    expect(existingUserDataPath(at('Daftar'), DATA, false, () => false)).toBe(at('Daftar'));
    expect(existingUserDataPath(at('Daftar'), DATA, false, p => p === at('research-director-desktop-shell'))).toBe(at('research-director-desktop-shell'));
  });
});
