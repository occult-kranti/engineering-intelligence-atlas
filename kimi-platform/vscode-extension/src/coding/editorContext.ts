/**
 * Adapter between the active editor and the pure selection-context builder
 * (selectionContext.ts). The ONLY document read performed anywhere in this
 * extension is `document.getText(selection)` — exactly the selection, never
 * the whole document, never any other file. tests/coding.test.ts proves the
 * minimal read surface with a counting fake.
 */

import * as vscode from 'vscode';
import type { SelectionSource } from './selectionContext.js';

/**
 * Adapter over vscode.TextEditor. `readSelection` is the only place any
 * document text is accessed: `editor.document.getText(editor.selection)`.
 */
export function vscodeSelectionSource(editor: vscode.TextEditor): SelectionSource {
  return {
    readSelection(): string {
      if (editor.selection.isEmpty) return '';
      return editor.document.getText(editor.selection);
    },
    languageId(): string {
      return editor.document.languageId;
    },
    relativeLabel(): string | null {
      if (editor.document.isUntitled) return null;
      if (editor.document.uri.scheme !== 'file') return null;
      // asRelativePath returns a workspace-relative label; when the file is
      // outside every workspace folder it may return the absolute path, which
      // sanitizeRelativeLabel (inside buildSelectionContext) drops to null.
      return vscode.workspace.asRelativePath(editor.document.uri, false);
    },
  };
}
