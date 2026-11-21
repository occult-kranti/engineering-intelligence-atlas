import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Explicit twin parity for the Phase 0 assistant contract: the module and
 * its golden fixture must remain byte-identical between the desktop shell
 * (desktop-shell/src/shared) and the web app (app/contracts), with the
 * workspace root copy as the source of truth for the fixture.
 */

const desktopShared = path.resolve(import.meta.dirname, '../src/shared');
const appContracts = path.resolve(import.meta.dirname, '../../app/contracts');
const rootDir = path.resolve(import.meta.dirname, '../..');

describe('assistant contract twin parity', () => {
  it('assistant.ts is byte-identical in desktop-shell and app', () => {
    const desktopFile = path.join(desktopShared, 'assistant.ts');
    const appFile = path.join(appContracts, 'assistant.ts');
    expect(fs.existsSync(appFile), 'app twin assistant.ts must exist').toBe(true);
    expect(fs.readFileSync(appFile, 'utf8')).toBe(fs.readFileSync(desktopFile, 'utf8'));
  });

  it('assistant-operations.fixture.json is byte-identical at root, app, and desktop', () => {
    const desktopFixture = path.join(desktopShared, 'assistant-operations.fixture.json');
    const appFixture = path.join(appContracts, 'assistant-operations.fixture.json');
    const rootFixture = path.join(rootDir, 'assistant-operations.fixture.json');
    expect(fs.existsSync(appFixture), 'app twin fixture must exist').toBe(true);
    expect(fs.existsSync(rootFixture), 'root fixture must exist').toBe(true);
    const desktopBytes = fs.readFileSync(desktopFixture, 'utf8');
    expect(fs.readFileSync(appFixture, 'utf8')).toBe(desktopBytes);
    expect(fs.readFileSync(rootFixture, 'utf8')).toBe(desktopBytes);
  });
});
