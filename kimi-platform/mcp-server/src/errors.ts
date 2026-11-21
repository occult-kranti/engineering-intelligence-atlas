/**
 * Typed, sanitized error surface for tool results.
 *
 * Every tool returns a JSON object. Failures look like:
 *   { ok: false, error: { code, message, ... } }
 * Messages are written for end users and never contain the pairing token,
 * HTTP headers, stack traces, or raw upstream bodies.
 */

export type ToolErrorCode =
  /** Pairing token env var missing/empty at startup. */
  | 'auth_not_configured'
  /** Companion rejected the token (401/403). */
  | 'auth_failed'
  /** Route not present in this desktop build (or companion disabled). Never faked. */
  | 'capability_unavailable'
  /** Companion unreachable / timed out. */
  | 'companion_unreachable'
  /** Companion returned an error status or an unparseable/oversized body. */
  | 'companion_error'
  /** The addressed project/run/artifact/session does not exist. */
  | 'not_found'
  /** --enable-writes not set on the server CLI. */
  | 'writes_disabled'
  /** --enable-provider-writes (and --enable-writes) not set. */
  | 'provider_writes_disabled'
  /** Input lacked confirmed:true. */
  | 'confirmation_required'
  /** Input failed schema/business validation (e.g. missing payloadHash). */
  | 'validation_failed';

export interface ToolError {
  code: ToolErrorCode;
  message: string;
}

export function toolError(code: ToolErrorCode, message: string): { ok: false; error: ToolError } {
  return { ok: false, error: { code, message } };
}

/** The desktop's catch-all 404 body is exactly this sentinel. */
export const COMPANION_ROUTE_NOT_FOUND = 'not found';

export function capabilityUnavailable(capability: string, hint?: string): { ok: false; error: ToolError & { capability: string } } {
  return {
    ok: false,
    error: {
      code: 'capability_unavailable',
      capability,
      message:
        `The desktop companion at this version does not provide '${capability}'. ` +
        'No data was fabricated. Upgrade the desktop app or add the companion route to enable it.' +
        (hint ? ` ${hint}` : ''),
    },
  };
}
