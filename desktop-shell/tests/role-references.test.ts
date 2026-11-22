import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRoleReference } from '../src/main/roleReferences';

const dirs: string[] = [];

function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'role-ref-'));
  dirs.push(d);
  return d;
}

afterEach(() => {
  while (dirs.length) {
    const d = dirs.pop()!;
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function role(over: Record<string, unknown> = {}) {
  return {
    key: 'engineer',
    title: 'Engineer',
    brief: 'Builds things.',
    document: 'docs/engineer.md',
    examples: ['examples/a.md'],
    references: [{ title: 'Guide', url: 'https://example.com/guide' }],
    handoff: 'Hand off with a summary.',
    capabilities: ['code-review'],
    ...over,
  };
}

function writeIndex(seed: string, content: unknown) {
  const dir = path.join(seed, 'role-library');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'index.json'),
    typeof content === 'string' ? content : JSON.stringify(content),
  );
}

function idx(roles: unknown[]) {
  return { schemaVersion: 1, roles };
}

describe('loadRoleReference', () => {
  it('loads the bundled research and cloud-operations roles through the same bounded runtime loader', () => {
    const seed = fileURLToPath(new URL('../../company/', import.meta.url));
    const repo = path.dirname(seed.replace(/[\\/]$/, ''));
    for (const key of ['newton', 'tesla', 'research-skeptic', 'resonance-advisor', 'paired-research', 'cloud-operations']) {
      const result = loadRoleReference(seed, key);
      expect(result, `Missing or invalid bundled runtime role: ${key}`).not.toBeNull();
      expect(result!.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(fs.existsSync(path.join(repo, result!.document))).toBe(true);
      for (const example of result!.examples) expect(fs.existsSync(path.join(repo, example))).toBe(true);
      expect(result!.brief.length).toBeLessThan(8000);
    }
  });
  it('loads a valid role with links only', () => {
    const seed = tmp();
    writeIndex(seed, idx([role()]));
    const r = loadRoleReference(seed, 'engineer');
    expect(r).not.toBeNull();
    expect(r!.key).toBe('engineer');
    expect(r!.document).toBe('docs/engineer.md');
    expect(r!.examples).toEqual(['examples/a.md']);
    expect(r!.references[0].url).toBe('https://example.com/guide');
    expect(r!.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash changes when selected role changes', () => {
    const a = tmp();
    const b = tmp();
    writeIndex(a, idx([role()]));
    writeIndex(b, idx([role({ brief: 'Builds other things.' })]));
    expect(loadRoleReference(a, 'engineer')!.sha256).not.toBe(
      loadRoleReference(b, 'engineer')!.sha256,
    );
  });

  it('hash is stable when unrelated roles change', () => {
    const a = tmp();
    const b = tmp();
    writeIndex(a, idx([role(), role({ key: 'designer', title: 'Designer' })]));
    writeIndex(
      b,
      idx([role({ key: 'designer', title: 'Changed', brief: 'x' }), role(), role({ key: 'qa' })]),
    );
    expect(loadRoleReference(a, 'engineer')!.sha256).toBe(
      loadRoleReference(b, 'engineer')!.sha256,
    );
  });

  it('returns null for missing file, missing role, and bad role keys', () => {
    const seed = tmp();
    expect(loadRoleReference(seed, 'engineer')).toBeNull();
    writeIndex(seed, idx([role()]));
    expect(loadRoleReference(seed, 'nobody')).toBeNull();
    expect(loadRoleReference(seed, null)).toBeNull();
    expect(loadRoleReference(seed, undefined)).toBeNull();
    expect(loadRoleReference(seed, '../engineer')).toBeNull();
    expect(loadRoleReference(seed, 'Engineer')).toBeNull();
  });

  it('rejects traversal and unsafe document/example paths', () => {
    const bad = ['../x.md', '/etc/passwd', 'a\\b.md', 'a/../b.md', 'C:/x.md', 'a\u0001b.md'];
    for (const p of bad) {
      const seed = tmp();
      writeIndex(seed, idx([role({ document: p })]));
      expect(loadRoleReference(seed, 'engineer')).toBeNull();
      const seed2 = tmp();
      writeIndex(seed2, idx([role({ examples: [p] })]));
      expect(loadRoleReference(seed2, 'engineer')).toBeNull();
    }
  });

  it('refuses a symlinked index.json', () => {
    const seed = tmp();
    const outside = tmp();
    fs.writeFileSync(path.join(outside, 'real.json'), JSON.stringify(idx([role()])));
    fs.mkdirSync(path.join(seed, 'role-library'), { recursive: true });
    try {
      fs.symlinkSync(
        path.join(outside, 'real.json'),
        path.join(seed, 'role-library', 'index.json'),
      );
    } catch {
      return; // symlinks unavailable on this platform
    }
    expect(loadRoleReference(seed, 'engineer')).toBeNull();
  });

  it('refuses a role-library directory symlink escaping seedDir', () => {
    const seed = tmp();
    const outside = tmp();
    fs.mkdirSync(path.join(outside, 'lib'));
    fs.writeFileSync(path.join(outside, 'lib', 'index.json'), JSON.stringify(idx([role()])));
    try {
      fs.symlinkSync(path.join(outside, 'lib'), path.join(seed, 'role-library'), 'dir');
    } catch {
      return;
    }
    expect(loadRoleReference(seed, 'engineer')).toBeNull();
  });

  it('refuses oversize index (>200KB)', () => {
    const seed = tmp();
    writeIndex(seed, idx([role({ brief: 'x'.repeat(7000) })]) && 'x'.repeat(200 * 1024 + 1));
    expect(loadRoleReference(seed, 'engineer')).toBeNull();
  });

  it('returns null for wrong schemaVersion, non-JSON, and wrong shapes', () => {
    const s1 = tmp();
    writeIndex(s1, { schemaVersion: 2, roles: [role()] });
    expect(loadRoleReference(s1, 'engineer')).toBeNull();
    const s2 = tmp();
    writeIndex(s2, '{not json');
    expect(loadRoleReference(s2, 'engineer')).toBeNull();
    const s3 = tmp();
    writeIndex(s3, { schemaVersion: 1, roles: 'nope' });
    expect(loadRoleReference(s3, 'engineer')).toBeNull();
    const s4 = tmp();
    writeIndex(s4, [role()]);
    expect(loadRoleReference(s4, 'engineer')).toBeNull();
  });

  it('refuses duplicate matching keys', () => {
    const seed = tmp();
    writeIndex(seed, idx([role(), role({ title: 'Other' })]));
    expect(loadRoleReference(seed, 'engineer')).toBeNull();
  });

  it('rejects malicious or non-https URLs', () => {
    const bad = [
      'http://example.com/x',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'https://user:pw@example.com/x',
      'https://user@example.com/x',
      'not a url',
    ];
    for (const url of bad) {
      const seed = tmp();
      writeIndex(seed, idx([role({ references: [{ title: 'x', url }] })]));
      expect(loadRoleReference(seed, 'engineer')).toBeNull();
    }
  });

  it('rejects invalid types and exceeded bounds', () => {
    const cases: Array<Record<string, unknown>> = [
      { title: 5 },
      { brief: 'x'.repeat(8001) },
      { title: 'x'.repeat(161) },
      { handoff: 'x'.repeat(2001) },
      { capabilities: ['x'.repeat(101)] },
      { capabilities: Array.from({ length: 17 }, (_, i) => `c${i}`) },
      { examples: Array.from({ length: 13 }, (_, i) => `e/${i}.md`) },
      {
        references: Array.from({ length: 13 }, (_, i) => ({
          title: 't',
          url: `https://example.com/${i}`,
        })),
      },
      { examples: 'a.md' },
      { capabilities: [1] },
    ];
    for (const over of cases) {
      const seed = tmp();
      writeIndex(seed, idx([role(over)]));
      expect(loadRoleReference(seed, 'engineer')).toBeNull();
    }
  });

  it('reflects updated index content on subsequent calls (no cache)', () => {
    const seed = tmp();
    writeIndex(seed, idx([role()]));
    const first = loadRoleReference(seed, 'engineer');
    writeIndex(seed, idx([role({ title: 'Senior Engineer' })]));
    const second = loadRoleReference(seed, 'engineer');
    expect(first!.title).toBe('Engineer');
    expect(second!.title).toBe('Senior Engineer');
  });

  it('does not read referenced documents and never throws on missing files', () => {
    const seed = tmp();
    writeIndex(seed, idx([role()])); // docs/engineer.md does not exist
    expect(() => loadRoleReference(seed, 'engineer')).not.toThrow();
    expect(loadRoleReference(seed, 'engineer')).not.toBeNull();
  });
});
