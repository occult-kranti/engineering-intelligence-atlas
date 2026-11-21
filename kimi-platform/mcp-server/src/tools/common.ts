/**
 * Shared plumbing for tool registration: context, result shaping, companion
 * error mapping, and write-gating helpers.
 */

import { z } from 'zod';
import type { ServerConfig } from '../config.js';
import type { CompanionFailure, CompanionHttpClient } from '../client/http.js';
import { capabilityUnavailable, toolError, type ToolError } from '../errors.js';
import type { Sanitizer } from '../sanitize.js';

export interface ToolContext {
  config: ServerConfig;
  http: CompanionHttpClient;
  sanitizer: Sanitizer;
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
}

export function okResult(ctx: ToolContext, value: Record<string, unknown>): ToolResult {
  const { structured, text } = ctx.sanitizer.toToolPayload(value, ctx.config.toolOutputMaxChars);
  return { content: [{ type: 'text', text }], structuredContent: structured };
}

export function failResult(ctx: ToolContext, err: { ok: false; error: ToolError } | { ok: false; error: ToolError & { capability: string } }): ToolResult {
  const { structured, text } = ctx.sanitizer.toToolPayload(err, ctx.config.toolOutputMaxChars);
  return { content: [{ type: 'text', text }], structuredContent: structured, isError: true };
}

/** Map a transport-level companion failure to a sanitized tool result. */
export function companionFailure(ctx: ToolContext, failure: CompanionFailure, capability: string): ToolResult {
  if (failure.code === 'capability_unavailable') {
    return failResult(ctx, capabilityUnavailable(capability));
  }
  return failResult(ctx, toolError(failure.code, failure.message));
}

/** Standard gate for state-changing tools. Returns null when allowed. */
export function gateWrites(ctx: ToolContext, confirmed: boolean | undefined): ToolResult | null {
  if (!ctx.config.enableWrites) {
    return failResult(
      ctx,
      toolError(
        'writes_disabled',
        'This tool changes desktop state and is disabled. Start research-director-mcp with --enable-writes to allow it, then pass confirmed:true.',
      ),
    );
  }
  if (confirmed !== true) {
    return failResult(
      ctx,
      toolError('confirmation_required', 'This write requires explicit user confirmation: call again with confirmed:true only after the user has approved this exact action.'),
    );
  }
  return null;
}

/** Stricter gate for provider-paid operations (chat send). */
export function gateProviderWrites(ctx: ToolContext, confirmed: boolean | undefined): ToolResult | null {
  const writesGate = gateWrites(ctx, true); // writes flag first (message tailored below)
  if (!ctx.config.enableWrites) return writesGate;
  if (!ctx.config.enableProviderWrites) {
    return failResult(
      ctx,
      toolError(
        'provider_writes_disabled',
        'This tool can incur provider API spend and is disabled. Start research-director-mcp with --enable-writes --enable-provider-writes to allow it, then pass confirmed:true.',
      ),
    );
  }
  if (confirmed !== true) {
    return failResult(
      ctx,
      toolError('confirmation_required', 'This provider-paid send requires explicit user confirmation: call again with confirmed:true only after the user has approved this exact message.'),
    );
  }
  return null;
}

// ------------------------------------------------------------- zod fragments

export const confirmedField = z
  .literal(true)
  .optional()
  .describe('Must be true to execute a write. Only set after the user explicitly approved this exact action.');

export const payloadHashField = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9:_-]+$/, 'payloadHash must be an opaque ASCII hash')
  .describe('SHA-256 (or desktop-issued) hash of the exact payload being approved, so the approval cannot be replayed against a different payload.');

export const idField = (name: string) => z.string().min(1).max(256).describe(`${name} (opaque desktop identifier)`);
