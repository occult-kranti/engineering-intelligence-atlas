/**
 * Server configuration: CLI flags + environment, parsed ONCE at startup.
 *
 * Security invariants enforced here:
 *  - The pairing token is read ONLY from `process.env.RESEARCH_DIRECTOR_PAIRING_TOKEN`
 *    at startup. It is never read from a file, never logged, never included in
 *    tool output, and never sent anywhere except the loopback companion.
 *  - The companion base URL must be a strict loopback http:// URL. Anything
 *    else (DNS names, non-loopback IPs, https, credentials, ...) is rejected
 *    before the server starts, so no tool call can ever be used for SSRF.
 */

export const DEFAULT_COMPANION_URL = 'http://127.0.0.1:4319';
export const TOKEN_ENV_VAR = 'RESEARCH_DIRECTOR_PAIRING_TOKEN';
export const URL_ENV_VAR = 'RESEARCH_DIRECTOR_COMPANION_URL';

export const DEFAULT_TIMEOUT_MS = 8_000;
export const MAX_TIMEOUT_MS = 30_000;
/** Hard cap on a single companion HTTP response body. */
export const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
/** Hard cap on the JSON text placed in a single MCP tool result. */
export const DEFAULT_TOOL_OUTPUT_MAX_CHARS = 32_000;
/** Hard cap for read_artifact text (the tool's own default is lower). */
export const ARTIFACT_TEXT_HARD_CAP = 32_768;
export const ARTIFACT_TEXT_DEFAULT_CAP = 8_000;
/** Keyset page cap for read_events. */
export const EVENTS_PAGE_HARD_CAP = 200;
export const EVENTS_PAGE_DEFAULT = 100;
/** Chat message/char caps for get_chat. */
export const CHAT_MESSAGES_HARD_CAP = 200;
export const CHAT_TEXT_HARD_CAP = 32_768;

export interface ServerConfig {
  /** Validated, normalized loopback origin (no trailing slash, no path). */
  baseUrl: string;
  /** Pairing token from env, or null when not configured. Never logged. */
  token: string | null;
  enableWrites: boolean;
  enableProviderWrites: boolean;
  requestTimeoutMs: number;
  maxResponseBytes: number;
  toolOutputMaxChars: number;
}

export class ConfigError extends Error {}

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Validate that `raw` is a strict loopback http:// URL and return the
 * normalized origin. Throws ConfigError otherwise. This is the SSRF guard:
 * every request the client makes is built as `baseUrl + routePath`.
 */
export function validateLoopbackUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`${URL_ENV_VAR} is not a valid URL`);
  }
  if (url.protocol !== 'http:') {
    throw new ConfigError(`${URL_ENV_VAR} must use http:// (the companion is a plaintext loopback service)`);
  }
  if (!LOOPBACK_HOSTNAMES.has(url.hostname)) {
    throw new ConfigError(
      `${URL_ENV_VAR} must point at loopback (127.0.0.1, localhost or [::1]); got host ${JSON.stringify(url.hostname)}`,
    );
  }
  if (url.username !== '' || url.password !== '') {
    throw new ConfigError(`${URL_ENV_VAR} must not embed credentials`);
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new ConfigError(`${URL_ENV_VAR} must not contain a path`);
  }
  if (url.search !== '' || url.hash !== '') {
    throw new ConfigError(`${URL_ENV_VAR} must not contain a query string or fragment`);
  }
  const port = url.port === '' ? '80' : url.port;
  const portNum = Number(port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    throw new ConfigError(`${URL_ENV_VAR} has an invalid port`);
  }
  return url.origin;
}

export interface CliFlags {
  enableWrites: boolean;
  enableProviderWrites: boolean;
  help: boolean;
}

export function parseCliFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { enableWrites: false, enableProviderWrites: false, help: false };
  for (const arg of argv) {
    switch (arg) {
      case '--enable-writes':
        flags.enableWrites = true;
        break;
      case '--enable-provider-writes':
        flags.enableProviderWrites = true;
        break;
      case '--help':
      case '-h':
        flags.help = true;
        break;
      default:
        throw new ConfigError(`unknown argument: ${arg}`);
    }
  }
  return flags;
}

export const HELP_TEXT = `research-director-mcp — stdio MCP server for the Research Director desktop companion

Usage: research-director-mcp [--enable-writes] [--enable-provider-writes]

Environment:
  ${TOKEN_ENV_VAR}   Pairing token shown once by the desktop app when the
                             companion bridge is enabled. Required. Never put this
                             in a file that is committed or in tool arguments.
  ${URL_ENV_VAR}    Loopback companion URL (default ${DEFAULT_COMPANION_URL}).
                             Must be http://127.0.0.1, http://localhost or http://[::1].

Flags:
  --enable-writes            Allow state-changing tools (create_project, run
                             lifecycle, decide_approval, Donna proposals). Each
                             still requires confirmed:true and a payload hash
                             where applicable.
  --enable-provider-writes   Additionally allow provider-paid chat sends
                             (requires --enable-writes too).
`;

/** Parse full config from argv + env. Token value is captured, never printed. */
export function parseConfig(argv: string[], env: NodeJS.ProcessEnv): ServerConfig {
  const flags = parseCliFlags(argv);
  const tokenRaw = env[TOKEN_ENV_VAR];
  const token = typeof tokenRaw === 'string' && tokenRaw.trim() !== '' ? tokenRaw.trim() : null;
  const baseUrl = validateLoopbackUrl(env[URL_ENV_VAR]?.trim() || DEFAULT_COMPANION_URL);
  return {
    baseUrl,
    token,
    enableWrites: flags.enableWrites,
    enableProviderWrites: flags.enableProviderWrites && flags.enableWrites,
    requestTimeoutMs: DEFAULT_TIMEOUT_MS,
    maxResponseBytes: DEFAULT_MAX_RESPONSE_BYTES,
    toolOutputMaxChars: DEFAULT_TOOL_OUTPUT_MAX_CHARS,
  };
}
