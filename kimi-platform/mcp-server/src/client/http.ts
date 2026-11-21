/**
 * Loopback-only HTTP client for the desktop companion.
 *
 * Hard guarantees:
 *  - The base URL was validated as strict loopback in config.ts; requests are
 *    only ever `${baseUrl}${route.path}`. Redirects are refused.
 *  - Bearer token goes ONLY into the Authorization header of these requests.
 *    It is never logged and never appears in error messages/results.
 *  - Per-request timeout (AbortSignal), response body cap (streamed read),
 *    and sanitized error mapping. The desktop's catch-all 404 sentinel maps
 *    to `capability_unavailable`; other 404s map to `not_found`.
 */

import { COMPANION_ROUTE_NOT_FOUND, type ToolErrorCode } from '../errors.js';
import type { Sanitizer } from '../sanitize.js';
import type { RouteDef } from './routes.js';

export interface CompanionSuccess {
  ok: true;
  status: number;
  data: unknown;
}

export interface CompanionFailure {
  ok: false;
  code: Extract<
    ToolErrorCode,
    'auth_not_configured' | 'auth_failed' | 'capability_unavailable' | 'companion_unreachable' | 'companion_error' | 'not_found'
  >;
  message: string;
  capabilityPath?: string;
}

export type CompanionResult = CompanionSuccess | CompanionFailure;

export interface HttpClientOptions {
  baseUrl: string;
  token: string | null;
  timeoutMs: number;
  maxResponseBytes: number;
  sanitizer: Sanitizer;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class CompanionHttpClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: HttpClientOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  get hasToken(): boolean {
    return this.opts.token !== null;
  }

  async request(route: RouteDef): Promise<CompanionResult> {
    if (this.opts.token === null) {
      return {
        ok: false,
        code: 'auth_not_configured',
        message:
          'RESEARCH_DIRECTOR_PAIRING_TOKEN is not set. Enable the companion bridge in the desktop app, copy the pairing token shown once, and provide it via the environment.',
      };
    }

    const url = `${this.opts.baseUrl}${route.path}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: route.method,
        redirect: 'error',
        signal: AbortSignal.timeout(this.opts.timeoutMs),
        headers: {
          authorization: `Bearer ${this.opts.token}`,
          accept: 'application/json',
          ...(route.method === 'POST' ? { 'content-type': 'application/json' } : {}),
        },
        body: route.method === 'POST' ? JSON.stringify(route.body ?? {}) : undefined,
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'TimeoutError';
      return {
        ok: false,
        code: 'companion_unreachable',
        message: timedOut
          ? `The desktop companion did not respond within ${this.opts.timeoutMs} ms. Is the desktop app running and the companion bridge enabled?`
          : 'The desktop companion is unreachable. Is the desktop app running and the companion bridge enabled on the configured loopback port?',
      };
    }

    // Read the body with a hard byte cap (streamed; content-length may lie).
    const body = await this.readCapped(response);
    if (!body.ok) return body.failure;

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        code: 'auth_failed',
        message: 'The desktop companion rejected the pairing token. Regenerate the token in the desktop app and update the environment variable.',
      };
    }

    if (response.status === 404) {
      const msg = body.message;
      if (msg === COMPANION_ROUTE_NOT_FOUND) {
        return {
          ok: false,
          code: 'capability_unavailable',
          capabilityPath: route.path,
          message: `Route ${route.method} ${route.path} is not provided by this desktop companion build.`,
        };
      }
      return { ok: false, code: 'not_found', message: msg ?? 'The requested resource was not found.' };
    }

    if (response.status === 429) {
      return { ok: false, code: 'companion_error', message: 'The desktop companion rate-limited this request; retry shortly.' };
    }

    if (!response.ok) {
      return {
        ok: false,
        code: 'companion_error',
        message: `The desktop companion returned HTTP ${response.status}${body.message !== null ? `: ${body.message}` : '.'}`,
      };
    }

    if (!body.jsonOk) {
      return { ok: false, code: 'companion_error', message: 'The desktop companion returned a non-JSON response body.' };
    }

    return { ok: true, status: response.status, data: body.data };
  }

  private async readCapped(
    response: Response,
  ): Promise<{ ok: true; data: unknown; jsonOk: boolean; message: string | null } | { ok: false; failure: CompanionFailure }> {
    const cap = this.opts.maxResponseBytes;
    let buf: Uint8Array;
    try {
      if (response.body === null) {
        buf = new Uint8Array(0);
      } else {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        let overflow = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > cap) {
            overflow = true;
            void reader.cancel().catch(() => undefined);
            break;
          }
          chunks.push(value);
        }
        if (overflow) {
          return {
            ok: false,
            failure: {
              ok: false,
              code: 'companion_error',
              message: `The desktop companion response exceeded the ${cap}-byte safety cap and was discarded.`,
            },
          };
        }
        buf = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          buf.set(chunk, offset);
          offset += chunk.byteLength;
        }
      }
    } catch {
      return { ok: false, failure: { ok: false, code: 'companion_unreachable', message: 'Failed reading the desktop companion response.' } };
    }

    const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    if (text.trim() === '') return { ok: true, data: null, jsonOk: true, message: null };
    try {
      const parsed: unknown = JSON.parse(text);
      const message = extractErrorMessage(parsed);
      return { ok: true, data: parsed, jsonOk: true, message };
    } catch {
      // Non-JSON body: expose a short scrubbed snippet as the message only.
      const snippet = this.opts.sanitizer.scrubText(text.slice(0, 200));
      return { ok: true, data: null, jsonOk: false, message: snippet };
    }
  }
}

function extractErrorMessage(parsed: unknown): string | null {
  if (typeof parsed === 'object' && parsed !== null) {
    const err = (parsed as Record<string, unknown>)['error'];
    if (typeof err === 'string') return err.slice(0, 300);
  }
  return null;
}
