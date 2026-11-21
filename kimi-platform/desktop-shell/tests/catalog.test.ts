import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertModelDownloadable,
  findModel,
  loadCatalog,
  validateCatalogEntry,
} from '../src/main/catalog';
import type { CatalogModel } from '../src/shared/contract';

function makeEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test-model',
    family: 'test',
    task: 'text-generation',
    repoId: 'org/model',
    revision: 'a'.repeat(40),
    format: 'GGUF',
    quantization: 'Q4_K_M',
    sizeBytes: 4,
    files: [{ path: 'm.bin', sizeBytes: 4, sha256: null }],
    minRamBytes: 1024,
    minVramBytes: null,
    license: 'mit',
    sourceUrl: 'https://huggingface.co/org/model',
    runtime: 'llama.cpp',
    remoteCodeRequired: false,
    availability: 'available',
    ...overrides,
  };
}

describe('validateCatalogEntry', () => {
  it('accepts a fully valid entry', () => {
    const { model, errors } = validateCatalogEntry(makeEntry());
    expect(errors).toEqual([]);
    expect(model?.id).toBe('test-model');
  });

  it('rejects moving revision refs (revision pinning)', () => {
    for (const rev of ['main', 'master', 'v1.0', 'a'.repeat(39), 'A'.repeat(40), '']) {
      const { errors } = validateCatalogEntry(makeEntry({ revision: rev }));
      expect(errors.join(' ')).toMatch(/pinned 40-hex/);
    }
  });

  it('rejects invalid repo IDs', () => {
    for (const repo of ['org', 'org/../x', 'org name/x', 'https://x/y', '', 'org/..']) {
      const { errors } = validateCatalogEntry(makeEntry({ repoId: repo }));
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects non-https sourceUrl', () => {
    const { errors } = validateCatalogEntry(makeEntry({ sourceUrl: 'http://example.com/x' }));
    expect(errors.join(' ')).toMatch(/https/);
  });

  it('blocks remote-code models presented as available', () => {
    const { errors } = validateCatalogEntry(makeEntry({ remoteCodeRequired: true }));
    expect(errors.join(' ')).toMatch(/quarantined/);
  });

  it('allows remote-code models only when quarantined with a note', () => {
    const { model, errors } = validateCatalogEntry(
      makeEntry({
        remoteCodeRequired: true,
        availability: 'quarantined',
        availabilityNote: 'research only',
      }),
    );
    expect(errors).toEqual([]);
    expect(model?.availability).toBe('quarantined');
    expect(model?.remoteCodeRequired).toBe(true);
  });

  it('requires availabilityNote for unavailable/quarantined entries', () => {
    const { errors } = validateCatalogEntry(makeEntry({ availability: 'unavailable' }));
    expect(errors.join(' ')).toMatch(/availabilityNote/);
  });

  it('requires sizeBytes to equal the reviewed file sum for available models', () => {
    const { errors } = validateCatalogEntry(makeEntry({ sizeBytes: 999 }));
    expect(errors.join(' ')).toMatch(/does not equal the sum/);
  });

  it('rejects unsafe file paths inside files[]', () => {
    const { errors } = validateCatalogEntry(
      makeEntry({ files: [{ path: '../evil.bin', sizeBytes: 4, sha256: null }] }),
    );
    expect(errors.join(' ')).toMatch(/unsafe/);
  });

  it('rejects malformed sha256 in files', () => {
    const { errors } = validateCatalogEntry(
      makeEntry({ files: [{ path: 'm.bin', sizeBytes: 4, sha256: 'xyz' }] }),
    );
    expect(errors.join(' ')).toMatch(/sha256/);
  });

  it('accepts null minRamBytes (unknown, not zero)', () => {
    const { model, errors } = validateCatalogEntry(makeEntry({ minRamBytes: null }));
    expect(errors).toEqual([]);
    expect(model?.minRamBytes).toBeNull();
  });
});

describe('loadCatalog', () => {
  it('returns empty result for missing catalog', () => {
    const res = loadCatalog('/nonexistent/catalog.json');
    expect(res.models).toEqual([]);
    expect(res.rejected.length).toBeGreaterThan(0);
  });

  it('separates valid and rejected entries', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dshell-cat-'));
    const file = path.join(dir, 'catalog.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        models: [makeEntry(), makeEntry({ id: 'bad', revision: 'main' })],
      }),
    );
    const res = loadCatalog(file);
    expect(res.models.map((m) => m.id)).toEqual(['test-model']);
    expect(res.rejected).toHaveLength(1);
    expect(res.rejected[0]?.id).toBe('bad');
  });
});

describe('assertModelDownloadable', () => {
  const base = validateCatalogEntry(makeEntry()).model as CatalogModel;

  it('allows available models', () => {
    expect(() => assertModelDownloadable(base)).not.toThrow();
  });

  it('blocks quarantined (remote-code) models', () => {
    const m = { ...base, availability: 'quarantined', remoteCodeRequired: true } as CatalogModel;
    expect(() => assertModelDownloadable(m)).toThrow(/quarantined/);
  });

  it('blocks unavailable (gated) models', () => {
    const m = { ...base, availability: 'unavailable' } as CatalogModel;
    expect(() => assertModelDownloadable(m)).toThrow(/unavailable/);
  });
});

describe('shipped models.catalog.json', () => {
  const catalogPath = path.join(__dirname, '..', 'models.catalog.json');
  const res = loadCatalog(catalogPath);

  it('loads with zero rejected entries', () => {
    expect(res.rejected).toEqual([]);
    expect(res.models.length).toBe(7);
  });

  it('has exact pinned revisions and repo ids for every entry', () => {
    for (const m of res.models) {
      expect(m.revision).toMatch(/^[0-9a-f]{40}$/);
      expect(m.repoId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/);
      expect(m.sourceUrl.startsWith('https://huggingface.co/')).toBe(true);
    }
  });

  it('available entries have exact file sums and all sizes positive', () => {
    for (const m of res.models.filter((x) => x.availability === 'available')) {
      expect(m.files.length).toBeGreaterThan(0);
      expect(m.files.reduce((a, f) => a + f.sizeBytes, 0)).toBe(m.sizeBytes);
    }
  });

  it('qwen3-coder-next has the exact 4-shard Q4_K_M set', () => {
    const m = findModel(res, 'qwen3-coder-next-q4_k_m');
    expect(m).toBeDefined();
    expect(m?.files).toHaveLength(4);
    expect(m?.sizeBytes).toBe(48410992032);
    expect(m?.files.map((f) => f.path)).toEqual([
      'Qwen3-Coder-Next-Q4_K_M/Qwen3-Coder-Next-Q4_K_M-00001-of-00004.gguf',
      'Qwen3-Coder-Next-Q4_K_M/Qwen3-Coder-Next-Q4_K_M-00002-of-00004.gguf',
      'Qwen3-Coder-Next-Q4_K_M/Qwen3-Coder-Next-Q4_K_M-00003-of-00004.gguf',
      'Qwen3-Coder-Next-Q4_K_M/Qwen3-Coder-Next-Q4_K_M-00004-of-00004.gguf',
    ]);
  });

  it('qwen3-8b is the exact 5027783488-byte single file', () => {
    const m = findModel(res, 'qwen3-8b-q4_k_m');
    expect(m?.sizeBytes).toBe(5027783488);
    expect(m?.files).toEqual([
      {
        path: 'Qwen3-8B-Q4_K_M.gguf',
        sizeBytes: 5027783488,
        sha256: 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785',
      },
    ]);
  });

  it('FLUX.1-schnell is unavailable (gated), not one-click', () => {
    const m = findModel(res, 'flux1-schnell');
    expect(m?.availability).toBe('unavailable');
    expect(m?.remoteCodeRequired).toBe(false);
    expect(m?.availabilityNote).toMatch(/[Gg]ated/);
    expect(() => assertModelDownloadable(m as CatalogModel)).toThrow();
  });

  it('TripoSR and TRELLIS.2 are quarantined with remoteCodeRequired=true', () => {
    for (const id of ['triposr', 'trellis-2-4b']) {
      const m = findModel(res, id);
      expect(m?.availability).toBe('quarantined');
      expect(m?.remoteCodeRequired).toBe(true);
      expect(m?.availabilityNote).toBeTruthy();
      expect(() => assertModelDownloadable(m as CatalogModel)).toThrow(/quarantined/);
    }
  });
});
