import { describe, expect, it, vi } from 'vitest';
import {
  buildSelectionContext,
  collectSelectionContext,
  composeSelectionMessage,
  containsAbsolutePath,
  MAX_SELECTION_CHARS,
  sanitizeRelativeLabel,
  type SelectionSource,
} from '../src/coding/selectionContext.js';

describe('selection label privacy', () => {
  it('accepts workspace-relative labels and normalizes separators', () => {
    expect(sanitizeRelativeLabel('src/app/main.ts')).toBe('src/app/main.ts');
    expect(sanitizeRelativeLabel('src\\app\\main.ts')).toBe('src/app/main.ts');
    expect(sanitizeRelativeLabel('./src/x.ts')).toBe('src/x.ts');
  });

  it('drops absolute paths instead of leaking them', () => {
    for (const p of [
      '/home/u/secret/main.ts',
      '/etc/passwd',
      'C:/Users/u/secret.ts',
      'c:\\Users\\u\\secret.ts',
      '\\\\server\\share\\x',
      '//server/share/x',
    ]) {
      expect(sanitizeRelativeLabel(p), p).toBeNull();
    }
  });

  it('drops traversal and NUL', () => {
    expect(sanitizeRelativeLabel('../outside.ts')).toBeNull();
    expect(sanitizeRelativeLabel('a/../../b')).toBeNull();
    expect(sanitizeRelativeLabel('a\0b')).toBeNull();
  });
});

describe('no unintended file reads', () => {
  it('collectSelectionContext performs exactly the three allowed reads', () => {
    const readSelection = vi.fn(() => 'const x = 1;');
    const languageId = vi.fn(() => 'typescript');
    const relativeLabel = vi.fn(() => 'src/x.ts');
    // The source interface exposes nothing else: no readWholeDocument, no
    // listFiles, no readFile — any such access would be a type error.
    const src: SelectionSource = { readSelection, languageId, relativeLabel };
    const ctx = collectSelectionContext(src);
    expect(readSelection).toHaveBeenCalledTimes(1);
    expect(languageId).toHaveBeenCalledTimes(1);
    expect(relativeLabel).toHaveBeenCalledTimes(1);
    expect(ctx).toMatchObject({ text: 'const x = 1;', languageId: 'typescript', fileLabel: 'src/x.ts' });
  });

  it('context contains only selection + language + relative label (no absolute path)', () => {
    const ctx = buildSelectionContext({
      selectedText: 'function f() {}',
      languageId: 'typescript',
      relativePath: '/home/u/ws/src/f.ts', // an absolute leak attempt
    });
    expect(ctx.fileLabel).toBeNull();
    const msg = composeSelectionMessage('review this', ctx);
    expect(msg).not.toContain('/home/u');
    expect(containsAbsolutePath(msg)).toBe(false);
  });

  it('composed message embeds only the selection, language id and relative label', () => {
    const ctx = buildSelectionContext({
      selectedText: 'let a = 1;',
      languageId: 'typescript',
      relativePath: 'src/a.ts',
    });
    const msg = composeSelectionMessage('explain', ctx);
    expect(msg).toContain('`src/a.ts`');
    expect(msg).toContain('```typescript');
    expect(msg).toContain('let a = 1;');
    expect(containsAbsolutePath(msg)).toBe(false);
  });

  it('caps oversized selections', () => {
    const ctx = buildSelectionContext({
      selectedText: 'y'.repeat(MAX_SELECTION_CHARS + 100),
      languageId: 'plaintext',
      relativePath: null,
    });
    expect(ctx.text).toHaveLength(MAX_SELECTION_CHARS);
    expect(ctx.truncated).toBe(true);
  });

  it('handles an empty selection gracefully (input-box path)', () => {
    const ctx = buildSelectionContext({ selectedText: '', languageId: 'python', relativePath: 'a.py' });
    const msg = composeSelectionMessage('how do I profile this?', ctx);
    expect(msg).toBe('how do I profile this?');
    expect(msg).not.toContain('```');
  });
});

describe('containsAbsolutePath detector', () => {
  it('flags POSIX/Windows/UNC absolute paths', () => {
    expect(containsAbsolutePath('see /home/u/x.ts')).toBe(true);
    expect(containsAbsolutePath('C:\\Users\\u\\x')).toBe(true);
    expect(containsAbsolutePath('\\\\server\\share')).toBe(true);
  });
  it('does not flag relative labels or urls-in-code samples', () => {
    expect(containsAbsolutePath('src/app/main.ts')).toBe(false);
    expect(containsAbsolutePath('ask about `a/b/c.py`')).toBe(false);
  });
});
