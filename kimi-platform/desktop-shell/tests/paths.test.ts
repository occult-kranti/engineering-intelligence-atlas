import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { isSafeRepoFilePath, isValidVenvName, resolveContainedPath } from '../src/main/paths';

describe('resolveContainedPath', () => {
  const root = path.join('/tmp', 'dshell-root');

  it('resolves paths inside the root', () => {
    expect(resolveContainedPath(root, 'a/b/c')).toBe(path.join(root, 'a', 'b', 'c'));
    expect(resolveContainedPath(root, 'model.gguf')).toBe(path.join(root, 'model.gguf'));
  });

  it('rejects traversal escapes', () => {
    expect(() => resolveContainedPath(root, '..')).toThrow(/escapes/);
    expect(() => resolveContainedPath(root, '../outside')).toThrow(/escapes/);
    expect(() => resolveContainedPath(root, 'a/../../outside')).toThrow(/escapes/);
    expect(() => resolveContainedPath(root, '/etc/passwd')).toThrow(/escapes/);
  });

  it('rejects NUL bytes', () => {
    expect(() => resolveContainedPath(root, 'a\0b')).toThrow(/NUL/);
  });
});

describe('isSafeRepoFilePath', () => {
  it('accepts normal repo-relative paths', () => {
    expect(isSafeRepoFilePath('model.gguf')).toBe(true);
    expect(isSafeRepoFilePath('ckpts/sub dir/model-00001-of-00002.safetensors')).toBe(true);
    expect(isSafeRepoFilePath('Qwen3-Coder-Next-Q4_K_M/Qwen3-Coder-Next-Q4_K_M-00001-of-00004.gguf')).toBe(true);
  });

  it('rejects traversal, absolute paths, backslashes, NUL', () => {
    expect(isSafeRepoFilePath('../secret')).toBe(false);
    expect(isSafeRepoFilePath('a/../../secret')).toBe(false);
    expect(isSafeRepoFilePath('/etc/passwd')).toBe(false);
    expect(isSafeRepoFilePath('C:\\Windows\\system32')).toBe(false);
    expect(isSafeRepoFilePath('a\\b')).toBe(false);
    expect(isSafeRepoFilePath('a\0b')).toBe(false);
    expect(isSafeRepoFilePath('')).toBe(false);
    expect(isSafeRepoFilePath('a//b')).toBe(false);
    expect(isSafeRepoFilePath('./x')).toBe(false);
  });
});

describe('isValidVenvName', () => {
  it('accepts simple names', () => {
    expect(isValidVenvName('hf-tools')).toBe(true);
    expect(isValidVenvName('my_venv.v2')).toBe(true);
  });

  it('rejects separators, traversal, and empties', () => {
    expect(isValidVenvName('../escape')).toBe(false);
    expect(isValidVenvName('a/b')).toBe(false);
    expect(isValidVenvName('a\\b')).toBe(false);
    expect(isValidVenvName('')).toBe(false);
    expect(isValidVenvName('.hidden-ok?')).toBe(false); // must start alnum
    expect(isValidVenvName('a..b')).toBe(false);
  });
});
