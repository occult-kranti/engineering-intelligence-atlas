import path from 'node:path';

/**
 * URL validation and normalization for the desktop shell.
 *
 * Policy:
 *  - Runtime connection URLs: HTTPS always; HTTP only for local development
 *    loopback hosts (localhost, *.localhost, 127.0.0.0/8 literals, [::1]).
 *  - External links opened in the user's browser: http: and https: only.
 *  - Embedded credentials are always rejected (we never persist secrets).
 */

export class UrlValidationError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = 'UrlValidationError';
    this.reason = reason;
  }
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', 'ip6-localhost']);

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (LOOPBACK_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.localhost')) return true;
  // IPv6 loopback, URL hostname keeps the brackets in some Node versions.
  const bare = host.replace(/^\[|\]$/g, '');
  if (bare === '::1') return true;
  // Any 127.0.0.0/8 IPv4 literal is loopback.
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(bare);
  if (m && Number(m[1]) === 127) return true;
  return false;
}

function parseAndCheckCommon(raw: string): URL {
  const input = raw.trim();
  if (input.length === 0) throw new UrlValidationError('URL is empty');
  if (input.length > 2048) throw new UrlValidationError('URL is too long');
  // Reject control characters and whitespace inside the URL.
  if (/[\x00-\x20]/.test(input)) {
    throw new UrlValidationError('URL contains whitespace or control characters');
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UrlValidationError('URL is not parseable');
  }
  if (url.username || url.password) {
    throw new UrlValidationError('URLs with embedded credentials are not allowed');
  }
  return url;
}

/**
 * Validate and normalize a runtime (online Director) URL.
 * Returns the normalized URL string (origin + path, no fragment).
 */
export function normalizeRuntimeUrl(raw: string): string {
  const url = parseAndCheckCommon(raw);
  if (url.protocol === 'http:') {
    if (!isLoopbackHost(url.hostname)) {
      throw new UrlValidationError(
        'http:// is only allowed for local development hosts (localhost / 127.x / [::1])',
      );
    }
  } else if (url.protocol !== 'https:') {
    throw new UrlValidationError(`Unsupported protocol "${url.protocol}"; use https://`);
  }
  url.hash = '';
  // Strip a trailing slash on the root path for stable comparisons.
  const normalized = url.toString();
  return normalized.endsWith('/') && url.pathname === '/' ? normalized.slice(0, -1) : normalized;
}

/**
 * Validate a URL that the user wants to open in the external browser.
 * Only http: and https: are permitted.
 */
export function validateExternalUrl(raw: string): string {
  const url = parseAndCheckCommon(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlValidationError(`Refusing to open external URL with protocol "${url.protocol}"`);
  }
  return url.toString();
}

/** True when the URL points at a local (file://) shell resource. */
export function isLocalFileUrl(raw: string): boolean {
  try {
    return new URL(raw).protocol === 'file:';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Content-view navigation policy (runtime content + offline atlas)
// ---------------------------------------------------------------------------

export interface ContentNavigationContext {
  /** What the content view currently shows. */
  kind: 'runtime' | 'atlas' | null;
  /** Origin of the validated runtime session (https:, or loopback http: only). */
  runtimeOrigin: string | null;
  /** Resolved absolute atlas root while the offline atlas is shown. */
  atlasRoot: string | null;
}

/**
 * Pure navigation policy for the (preload-less) content view:
 *  - runtime mode: https: anywhere; http: ONLY for the exact validated
 *    loopback session origin; file: never.
 *  - atlas mode: file: ONLY for paths contained in the bundled atlas root;
 *    http(s) is denied here (callers route those to the external browser).
 *  - everything else (about:, data:, chrome:, …) is denied.
 */
export function isAllowedContentNavigation(rawUrl: string, ctx: ContentNavigationContext): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') return ctx.kind === 'runtime';
  if (url.protocol === 'http:') {
    return (
      ctx.kind === 'runtime' &&
      ctx.runtimeOrigin !== null &&
      ctx.runtimeOrigin.startsWith('http:') &&
      url.origin === ctx.runtimeOrigin
    );
  }
  if (url.protocol === 'file:') {
    if (ctx.kind !== 'atlas' || ctx.atlasRoot === null) return false;
    let target: string;
    try {
      target = path.resolve(decodeURIComponent(url.pathname));
    } catch {
      return false;
    }
    return target === ctx.atlasRoot || target.startsWith(ctx.atlasRoot + path.sep);
  }
  return false;
}
