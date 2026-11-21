import { describe, it, expect } from 'vitest';
import { existingUserDataPath } from '../src/main/profileMigration';

describe('Daftar profile continuity', () => {
  it('reuses a prior installed profile after the product rename', () => {
    expect(existingUserDataPath('/data/Daftar', '/data', false, p => p === '/data/Research Director Desktop')).toBe('/data/Research Director Desktop');
  });
  it('preserves an explicit isolated profile and an existing Daftar profile', () => {
    expect(existingUserDataPath('/temp/isolated', '/data', true, () => true)).toBe('/temp/isolated');
    expect(existingUserDataPath('/data/Daftar', '/data', false, () => true)).toBe('/data/Daftar');
  });
  it('keeps a new installation and supports the older source-run profile name', () => {
    expect(existingUserDataPath('/data/Daftar', '/data', false, () => false)).toBe('/data/Daftar');
    expect(existingUserDataPath('/data/Daftar', '/data', false, p => p.endsWith('research-director-desktop-shell'))).toBe('/data/research-director-desktop-shell');
  });
});
