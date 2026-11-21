/**
 * Output sanitization: every tool result passes through here before it is
 * handed to the MCP client.
 *
 *  - Size caps: structured payloads are serialized once and hard-truncated to
 *    the configured character budget so a huge desktop response cannot blow
 *    up the client's context window.
 *  - Secret scrubbing: the exact pairing token plus common credential shapes
 *    (Bearer values, sk-*, GitHub/Slack/Anthropic key formats) are redacted
 *    from all text.
 *  - Sensitive object keys (token/secret/password/apiKey/authorization/...)
 *    are dropped recursively, with an allowlist for safe metadata
 *    (e.g. tokenFingerprint, which is a SHA-256 prefix, not a secret).
 *  - Fields that look like raw chain-of-thought (reasoning/cot/...) are
 *    dropped so internal model traces never surface as tool output.
 */

/** Keys that are always safe to keep even though they match a deny pattern. */
const SAFE_KEYS = new Set(['tokenfingerprint', 'tokenupdatedat', 'paired']);

const DENY_KEY = /token|secret|password|api[-_]?key|authorization|credential|private[-_]?key|cookie/i;
const COT_KEY = /^(reasoning|chain[-_]?of[-_]?thought|cot|internal[-_]?monologue|thoughts?)$/i;

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\bsk-ant-[A-Za-z0-9_-]{8,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{16,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\b-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

const REDACTED = '[redacted]';

export class Sanitizer {
  /** The exact pairing token, captured once; never stored anywhere else. */
  constructor(private readonly pairingToken: string | null) {}

  scrubText(text: string): string {
    let out = text;
    if (this.pairingToken !== null && this.pairingToken.length >= 8 && out.includes(this.pairingToken)) {
      out = out.split(this.pairingToken).join(REDACTED);
    }
    for (const pattern of SECRET_PATTERNS) {
      out = out.replace(pattern, REDACTED);
    }
    return out;
  }

  /** Deep-sanitize an arbitrary JSON-ish value. Returns a fresh structure. */
  scrubValue(value: unknown, depth = 0): unknown {
    if (depth > 24) return '[truncated:depth]';
    if (typeof value === 'string') return this.scrubText(value);
    if (Array.isArray(value)) return value.map((v) => this.scrubValue(v, depth + 1));
    if (typeof value === 'object' && value !== null) {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        const lower = key.toLowerCase();
        if (!SAFE_KEYS.has(lower) && (DENY_KEY.test(key) || COT_KEY.test(key))) continue;
        out[key] = this.scrubValue(val, depth + 1);
      }
      return out;
    }
    return value;
  }

  /** Sanitize + serialize + hard-cap a structured tool payload. */
  toToolPayload(value: unknown, maxChars: number): { structured: Record<string, unknown>; text: string } {
    const structured = this.scrubValue(value) as Record<string, unknown>;
    let text = JSON.stringify(structured, null, 2);
    let truncated = false;
    if (text.length > maxChars) {
      truncated = true;
      text = text.slice(0, maxChars);
    }
    if (truncated) {
      structured['truncated'] = true;
      text = JSON.stringify(structured, null, 2).slice(0, maxChars);
      text += '\n… [output truncated to size cap]';
    }
    return { structured, text };
  }
}

/** Truncate a plain string with an explicit marker. */
export function capText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: `${text.slice(0, maxChars)}\n… [truncated: ${text.length - maxChars} chars omitted]`, truncated: true };
}
