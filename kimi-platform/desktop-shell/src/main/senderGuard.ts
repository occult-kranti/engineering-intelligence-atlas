import type { WebContents } from 'electron';

/**
 * Strict IPC sender validation.
 *
 * The desktopBridge must only ever serve the shell's own chrome window
 * (a local file:// page). Remote runtime content runs in a WebContentsView
 * with no preload, but we verify the sender anyway as defense in depth:
 *  1. the sender must be exactly the shell window's webContents, and
 *  2. the sender frame must be a top-level local file:// page.
 */

export interface SenderLike {
  sender: WebContents | { id: number };
  senderFrame?: { url: string; top?: { url: string } | null } | null;
}

export function isTrustedLocalSender(
  event: SenderLike,
  shellWebContents: { id: number } | null,
): boolean {
  if (shellWebContents === null) return false;
  if (event.sender.id !== shellWebContents.id) return false;
  const frameUrl = event.senderFrame?.url;
  if (typeof frameUrl !== 'string' || !frameUrl.startsWith('file://')) return false;
  // The bridge lives only on the top-level chrome page; reject subframes.
  const topUrl = event.senderFrame?.top?.url;
  if (typeof topUrl === 'string' && topUrl !== frameUrl) return false;
  return true;
}

export class UntrustedSenderError extends Error {
  constructor() {
    super('Refused: IPC sender is not the local shell window (file://)');
    this.name = 'UntrustedSenderError';
  }
}
