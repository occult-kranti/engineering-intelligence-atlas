/**
 * Read-only in-memory artifact documents (scheme rd-artifact:). Artifacts are
 * opened as markdown documents backed by memory only — nothing is written to
 * disk by opening/diffing.
 */

import * as vscode from 'vscode';
import type { ArtifactMeta } from '../bridge/types.js';

export const ARTIFACT_SCHEME = 'rd-artifact';

export interface ArtifactKey {
  projectId: string;
  runId: string;
  nodeId: string;
  attempt?: number;
}

export function artifactUri(key: ArtifactKey): vscode.Uri {
  const attempt = key.attempt !== undefined ? `/${key.attempt}` : '';
  return vscode.Uri.from({
    scheme: ARTIFACT_SCHEME,
    path: `/${encodeURIComponent(key.projectId)}/${encodeURIComponent(key.runId)}/${encodeURIComponent(
      key.nodeId,
    )}${attempt}.md`,
  });
}

export function parseArtifactUri(uri: vscode.Uri): ArtifactKey | null {
  if (uri.scheme !== ARTIFACT_SCHEME) return null;
  const parts = uri.path.split('/').filter((s) => s.length > 0);
  if (parts.length < 3) return null;
  const last = parts[parts.length - 1] ?? '';
  const m = /^(.*)\.md$/.exec(last);
  const nodeOrAttempt = m ? m[1] : last;
  const key: ArtifactKey = {
    projectId: decodeURIComponent(parts[0] ?? ''),
    runId: decodeURIComponent(parts[1] ?? ''),
    nodeId: decodeURIComponent(parts[2] ?? ''),
  };
  // Optional attempt segment is the 4th part (with .md suffix)
  if (parts.length >= 4) {
    key.nodeId = decodeURIComponent(parts[2] ?? '');
    const attemptPart = m ? nodeOrAttempt : '';
    const n = Number(attemptPart);
    if (Number.isInteger(n) && n > 0) key.attempt = n;
  }
  return key;
}

export class ArtifactDocumentProvider implements vscode.TextDocumentContentProvider {
  #contents = new Map<string, { text: string; meta?: ArtifactMeta }>();
  #onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.#onDidChange.event;

  set(key: ArtifactKey, text: string, meta?: ArtifactMeta): vscode.Uri {
    const uri = artifactUri(key);
    this.#contents.set(uri.toString(), { text, meta });
    this.#onDidChange.fire(uri);
    return uri;
  }

  meta(uri: vscode.Uri): ArtifactMeta | undefined {
    return this.#contents.get(uri.toString())?.meta;
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.#contents.get(uri.toString())?.text ?? '';
  }
}
