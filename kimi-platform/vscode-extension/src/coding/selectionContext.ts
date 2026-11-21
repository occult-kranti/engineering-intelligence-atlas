/**
 * Coding-first workflow: build the *only* context ever attached to a
 * "Ask Director about selection" message.
 *
 * Privacy rules (enforced here, tested in tests/coding.test.ts):
 *  - Context is exactly: the selected text, the document language id, and a
 *    workspace-relative file label.
 *  - Absolute paths are never accepted: callers must pass an already
 *    workspace-relative path (from vscode.workspace.asRelativePath). Anything
 *    absolute or traversal-y is dropped to null rather than leaked.
 *  - No whole-file text, no workspace crawling, no other documents.
 *
 * Pure module — no 'vscode' / 'node:*' imports.
 */

/** Hard cap so a huge selection cannot blow up the chat payload. */
export const MAX_SELECTION_CHARS = 20_000;

export interface SelectionContextInput {
  /** Exactly the editor selection text (may be empty). */
  selectedText: string;
  /** TextDocument.languageId of the active editor. */
  languageId: string;
  /**
   * Workspace-relative path (forward slashes) or null when the file is
   * outside every workspace folder / untitled.
   */
  relativePath: string | null;
}

export interface SelectionContext {
  text: string;
  languageId: string;
  /** Safe display label such as "src/app/main.ts", or null. */
  fileLabel: string | null;
  truncated: boolean;
}

/**
 * Normalize a workspace-relative label. Returns null when the input looks
 * absolute (POSIX "/", Windows drive, UNC), contains NUL, or escapes the
 * workspace via "..". Backslashes are converted to "/".
 */
export function sanitizeRelativeLabel(relativePath: string | null): string | null {
  if (!relativePath) return null;
  if (relativePath.includes('\0')) return null;
  let p = relativePath.replace(/\\/g, '/');
  // Absolute forms: "/x", "C:/x", "//server/share"
  if (p.startsWith('/')) return null;
  if (/^[A-Za-z]:\//.test(p)) return null;
  const segments = p.split('/').filter((s) => s.length > 0 && s !== '.');
  if (segments.length === 0) return null;
  if (segments.some((s) => s === '..')) return null;
  p = segments.join('/');
  if (p.length > 260) p = p.slice(0, 260);
  return p;
}

/** Minimal read surface — a fake in tests can only expose these three reads. */
export interface SelectionSource {
  /** Returns ONLY the selected text (empty string when nothing selected). */
  readSelection(): string;
  languageId(): string;
  /** Workspace-relative path or null (untitled/outside workspace). */
  relativeLabel(): string | null;
}

export function collectSelectionContext(src: SelectionSource): SelectionContext {
  return buildSelectionContext({
    selectedText: src.readSelection(),
    languageId: src.languageId(),
    relativePath: src.relativeLabel(),
  });
}

export function buildSelectionContext(input: SelectionContextInput): SelectionContext {
  const raw = typeof input.selectedText === 'string' ? input.selectedText : '';
  const truncated = raw.length > MAX_SELECTION_CHARS;
  return {
    text: truncated ? raw.slice(0, MAX_SELECTION_CHARS) : raw,
    languageId: typeof input.languageId === 'string' && input.languageId ? input.languageId : 'plaintext',
    fileLabel: sanitizeRelativeLabel(input.relativePath),
    truncated,
  };
}

/**
 * Compose the exact user message sent to the Director. The only code content
 * is the selection inside a fenced block tagged with the language id and an
 * optional relative file label.
 */
export function composeSelectionMessage(question: string, ctx: SelectionContext): string {
  const parts: string[] = [];
  const q = question.trim();
  parts.push(q.length > 0 ? q : 'Please review this selection.');
  if (ctx.text.length > 0) {
    parts.push('');
    parts.push(`Context: selection${ctx.fileLabel ? ` from \`${ctx.fileLabel}\`` : ''} (language: ${ctx.languageId})`);
    parts.push('```' + (ctx.languageId || ''));
    parts.push(ctx.text);
    parts.push('```');
    if (ctx.truncated) {
      parts.push(`(selection truncated to ${MAX_SELECTION_CHARS} characters)`);
    }
  }
  return parts.join('\n');
}

/**
 * True when the text the user is about to send contains an absolute path
 * (defense-in-depth check used by tests and the command before sending).
 */
export function containsAbsolutePath(text: string): boolean {
  return /(^|[\s"'(=])\/[^\s)]+/.test(text) || /[A-Za-z]:\\[^\s)]+/.test(text) || /\\\\[^\s\\]+\\/.test(text);
}
