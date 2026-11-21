/**
 * Sanitized bridge errors. Pure module.
 *
 * Rules:
 *  - Never echo the Authorization header, the token, or request headers.
 *  - Never include the full URL with query strings (may carry ids only, but
 *    keep it minimal).
 *  - Collapse network failures to short, actionable messages.
 */

export class BridgeError extends Error {
  readonly status?: number;
  readonly code: string;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

/** Remove any occurrence of the token (defense in depth) from a message. */
export function redactToken(message: string, token: string | undefined): string {
  if (!token) return message;
  return message.split(token).join('[redacted]');
}

export function httpError(status: number, statusText: string | undefined, token?: string): BridgeError {
  const raw = statusText && statusText.length <= 80 ? statusText : '';
  const text = redactToken(raw, token).replace(/[\r\n]/g, ' ').trim();
  switch (status) {
    case 401:
    case 403:
      return new BridgeError('unauthorized', `Desktop rejected the pairing token (HTTP ${status}). Re-pair.`, status);
    case 404:
      return new BridgeError('not-found', `Desktop endpoint not found (HTTP 404). Is the desktop up to date?`, status);
    case 409:
      return new BridgeError('conflict', `Desktop reported a conflict (HTTP 409)${text ? `: ${text}` : ''}`, status);
    case 422:
      return new BridgeError('rejected', `Desktop rejected the request (HTTP 422)${text ? `: ${text}` : ''}`, status);
    default:
      return new BridgeError('http', `Desktop request failed (HTTP ${status})${text ? `: ${text}` : ''}`, status);
  }
}

export function networkError(err: unknown, token?: string): BridgeError {
  if (err instanceof BridgeError) return err;
  const name = err instanceof Error ? err.name : '';
  if (name === 'AbortError' || name === 'TimeoutError') {
    return new BridgeError('timeout', 'Desktop did not respond in time.');
  }
  const raw = err instanceof Error ? err.message : String(err);
  const msg = redactToken(raw, token)
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 120);
  if (/ECONNREFUSED|fetch failed|ECONNRESET|EHOSTUNREACH|socket/i.test(msg)) {
    return new BridgeError('unreachable', 'Cannot reach Research Director Desktop on the paired loopback address.');
  }
  return new BridgeError('network', `Bridge network error: ${msg || 'unknown'}`);
}

/** Best-effort extraction of a server-provided error string from a JSON body. */
export function serverErrorMessage(body: unknown, token?: string): string | undefined {
  if (body && typeof body === 'object' && 'error' in body) {
    const e = (body as { error?: unknown }).error;
    if (typeof e === 'string' && e.length > 0 && e.length <= 200) {
      return redactToken(e.replace(/[\r\n]+/g, ' '), token);
    }
  }
  return undefined;
}
