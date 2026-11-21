/**
 * Loopback-only URL handling for the desktop bridge.
 * Pure module — no 'vscode' / 'node:*' imports so it is unit-testable.
 */

export const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export interface BridgeAddress {
  /** Normalized loopback host ('127.0.0.1' | 'localhost' | '[::1]'). */
  host: string;
  port: number;
}

export function normalizeLoopbackHost(raw: string): string | null {
  const h = raw.trim().toLowerCase();
  if (h === '::1') return '[::1]';
  if (LOOPBACK_HOSTS.has(h)) return h === '::1' ? '[::1]' : h;
  return null;
}

export function parsePort(raw: string): number | null {
  if (!/^\d{1,5}$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1 || n > 65535) return null;
  return n;
}

export function parseBridgeAddress(hostRaw: string, portRaw: string): BridgeAddress | null {
  const host = normalizeLoopbackHost(hostRaw);
  const port = parsePort(portRaw);
  if (!host || port === null) return null;
  return { host, port };
}

export function baseUrlFor(addr: BridgeAddress): string {
  return `http://${addr.host}:${addr.port}`;
}

/**
 * Defense in depth: even after input validation, verify any fully-built URL
 * before it is handed to fetch. Rejects credentials, non-http(s) schemes and
 * non-loopback hosts.
 */
export function assertLoopbackUrl(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error('Invalid bridge URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Bridge URL must be http(s)');
  }
  if (u.username || u.password) {
    throw new Error('Bridge URL must not contain credentials');
  }
  const host = u.hostname === '::1' ? '[::1]' : u.hostname.toLowerCase();
  if (!LOOPBACK_HOSTS.has(host) && host !== '[::1]') {
    throw new Error('Bridge URL host must be loopback');
  }
  return u;
}

/** Percent-encode a single path segment (ids may contain arbitrary chars). */
export function seg(id: string): string {
  return encodeURIComponent(id);
}
