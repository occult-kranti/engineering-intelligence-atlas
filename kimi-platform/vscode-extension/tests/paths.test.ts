import { describe, expect, it } from 'vitest';
import { isContained, joinInsideWorkspace, validateWorkspaceRelativePath } from '../src/artifacts/paths.js';

describe('workspace-relative path validation', () => {
  it('accepts plain relative paths', () => {
    expect(validateWorkspaceRelativePath('src/app.ts')).toEqual({ ok: true, normalized: 'src/app.ts' });
    expect(validateWorkspaceRelativePath('a/b/c.md')).toMatchObject({ ok: true });
    expect(validateWorkspaceRelativePath('file.txt')).toMatchObject({ ok: true });
  });

  it('rejects absolute paths (POSIX, Windows, UNC)', () => {
    for (const p of ['/etc/passwd', '/home/u/x', 'C:/windows/x', 'c:/x', 'D:/']) {
      const v = validateWorkspaceRelativePath(p);
      expect(v.ok, p).toBe(false);
    }
  });

  it('rejects backslashes and NUL bytes', () => {
    expect(validateWorkspaceRelativePath('a\\b').ok).toBe(false);
    expect(validateWorkspaceRelativePath('a\0b').ok).toBe(false);
  });

  it('rejects traversal and empty segments', () => {
    for (const p of ['../x', 'a/../b', './a', 'a//b', '..', '.', 'a/./b']) {
      expect(validateWorkspaceRelativePath(p).ok, p).toBe(false);
    }
  });

  it('rejects empty, overlong, and overdeep paths', () => {
    expect(validateWorkspaceRelativePath('').ok).toBe(false);
    expect(validateWorkspaceRelativePath('   ').ok).toBe(false);
    expect(validateWorkspaceRelativePath('x'.repeat(241)).ok).toBe(false);
    expect(validateWorkspaceRelativePath(Array(18).fill('a').join('/')).ok).toBe(false);
  });
});

describe('join + containment', () => {
  const root = '/home/u/ws';

  it('joins valid relative paths inside the root', () => {
    expect(joinInsideWorkspace(root, 'src/app.ts')).toBe('/home/u/ws/src/app.ts');
  });

  it('never produces a path outside the root', () => {
    expect(joinInsideWorkspace(root, '../evil')).toBeNull();
    expect(joinInsideWorkspace(root, '/etc/passwd')).toBeNull();
    expect(joinInsideWorkspace(root, 'C:/evil')).toBeNull();
    expect(joinInsideWorkspace(root, 'a/../../b')).toBeNull();
  });

  it('isContained is strict about the boundary', () => {
    expect(isContained('/home/u/ws', '/home/u/ws/a.txt')).toBe(true);
    expect(isContained('/home/u/ws', '/home/u/ws2/a.txt')).toBe(false);
    expect(isContained('/home/u/ws', '/home/u/ws')).toBe(false);
    expect(isContained('/home/u/ws', '/home/u/ws/../ws2/a')).toBe(false);
    expect(isContained('/home/u/ws/', '/home/u/ws/a/b/c')).toBe(true);
  });
});
