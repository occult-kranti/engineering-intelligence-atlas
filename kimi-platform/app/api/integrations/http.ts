import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import type { LookupAddress, LookupOptions } from "node:dns";
import net from "node:net";
import { Readable } from "node:stream";

/**
 * SSRF-hardened outbound HTTP for read-only connectors.
 *
 * Protections (all enforced server-side, per request, per redirect hop):
 *  - scheme: https only; http is accepted solely in explicit development mode
 *    (INTEGRATIONS_ALLOW_LOCAL_HTTP=1 AND not production) and only for
 *    loopback hosts — so tests/dev can use a local mock server;
 *  - DNS: the hostname is resolved up front and EVERY resolved address must
 *    be a public IP; the connection itself uses a pinned lookup that returns
 *    only those pre-validated addresses, so DNS rebinding between validation
 *    and connect cannot redirect us to a private address;
 *  - redirects: manual; each Location is re-validated (scheme, host allowlist,
 *    DNS pin); capped at maxRedirects (default 3, fixed-endpoint providers 0);
 *  - fixed-endpoint providers pass an exact host allowlist;
 *  - every response is byte-capped and time-capped.
 *
 * Nothing here logs request bodies, headers, or URLs with query strings.
 */

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

export class ResponseTooLargeError extends Error {
  constructor(limit: number) {
    super(`response exceeded the ${limit}-byte cap`);
    this.name = "ResponseTooLargeError";
  }
}

export class ConnectorHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ConnectorHttpError";
    this.status = status;
  }
}

export class ConnectorTimeoutError extends Error {
  constructor(ms: number) {
    super(`request timed out after ${ms}ms`);
    this.name = "ConnectorTimeoutError";
  }
}

// ── Private/reserved IP detection ────────────────────────────────

function isPrivateIpv4(ip: string): boolean {
  const p = ip.split(".").map((s) => Number(s));
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  const a1 = a!, b1 = b!;
  if (a1 === 0 || a1 === 10 || a1 === 127) return true; // 0/8, 10/8, loopback
  if (a1 === 169 && b1 === 254) return true; // link-local (cloud metadata)
  if (a1 === 172 && b1 >= 16 && b1 <= 31) return true; // 172.16/12
  if (a1 === 192 && b1 === 168) return true;
  if (a1 === 100 && b1 >= 64 && b1 <= 127) return true; // CGNAT
  if (a1 === 192 && b1 === 0) return true; // 192.0.0/24 + this-network
  if (a1 === 198 && (b1 === 18 || b1 === 19)) return true; // benchmarking
  if (a1 >= 224) return true; // multicast + reserved (224/4, 240/4)
  // Documentation ranges are not routable; treat as blocked.
  if (a1 === 192 && b1 === 0 && p[2] === 2) return true;
  if (a1 === 198 && b1 === 51 && p[2] === 100) return true;
  if (a1 === 203 && b1 === 0 && p[2] === 113) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === "::1" || norm === "::") return true;
  if (norm.startsWith("::ffff:")) {
    const mapped = norm.slice(7);
    if (net.isIPv4(mapped)) return isPrivateIpv4(mapped);
    return true;
  }
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // unique local fc00::/7
  if (/^fe[89ab]/.test(norm)) return true; // link-local fe80::/10
  return false;
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateIpv6(ip);
  return true; // unparseable → treat as blocked
}

// ── Policy ───────────────────────────────────────────────────────

const BLOCKED_HOSTNAMES = [/\.local$/i, /\.internal$/i, /\.localhost$/i, /\.lan$/i];

/** Local plaintext HTTP is a development-only escape hatch. */
export function localHttpAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.INTEGRATIONS_ALLOW_LOCAL_HTTP === "1"
  );
}

interface ResolvedTarget {
  url: URL;
  addresses: LookupAddress[];
}

async function resolveAndValidate(
  rawUrl: string,
  allowHosts: readonly string[] | null,
): Promise<ResolvedTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError("unparseable URL");
  }
  if (url.username || url.password) {
    throw new BlockedUrlError("credentials in URL are not allowed");
  }
  const host = url.hostname.toLowerCase();
  const isLoopback =
    host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";

  if (url.protocol === "http:") {
    if (!(localHttpAllowed() && isLoopback)) {
      throw new BlockedUrlError("only https:// endpoints are allowed");
    }
  } else if (url.protocol !== "https:") {
    throw new BlockedUrlError(`scheme ${url.protocol} is not allowed`);
  }

  if (BLOCKED_HOSTNAMES.some((re) => re.test(host))) {
    throw new BlockedUrlError("local-network hostnames are not allowed");
  }
  if (allowHosts && !allowHosts.includes(host)) {
    throw new BlockedUrlError(`host ${host} is not in the connector allowlist`);
  }

  let addresses: LookupAddress[];
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new BlockedUrlError(`DNS resolution failed for ${host}`);
  }
  if (addresses.length === 0) throw new BlockedUrlError(`DNS returned no addresses for ${host}`);
  if (!(localHttpAllowed() && isLoopback)) {
    for (const a of addresses) {
      if (isPrivateIp(a.address)) {
        throw new BlockedUrlError(`host ${host} resolves to a non-public address`);
      }
    }
  }
  return { url, addresses };
}

// ── Test hooks (never available in production) ──────────────────

type Transport = (
  target: ResolvedTarget,
  opts: {
    method: string;
    headers: Record<string, string>;
    body?: string | Buffer;
    timeoutMs: number;
    signal?: AbortSignal;
  },
) => Promise<{ status: number; headers: http.IncomingHttpHeaders; stream: Readable }>;

let transportOverride: Transport | null = null;
const baseOverrides = new Map<string, string>();

export function __setTransportForTests(t: Transport | null): void {
  if (process.env.NODE_ENV === "production") throw new Error("test hook disabled in production");
  transportOverride = t;
}

/** Redirect a fixed-endpoint connector base URL (e.g. to a local mock). */
export function __setConnectorBaseForTests(service: string, base: string | null): void {
  if (process.env.NODE_ENV === "production") throw new Error("test hook disabled in production");
  if (base === null) baseOverrides.delete(service);
  else baseOverrides.set(service, base);
}

export function connectorBase(service: string, officialBase: string): string {
  return baseOverrides.get(service) ?? officialBase;
}

// ── Core request ─────────────────────────────────────────────────

export interface GuardedRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeoutMs?: number;
  /** Response byte cap. Default 1 MiB. */
  maxBytes?: number;
  /** Redirects followed with full re-validation. Default 3. */
  maxRedirects?: number;
  /** Exact hostname allowlist; null = any public https host. */
  allowHosts?: readonly string[] | null;
  signal?: AbortSignal;
}

function defaultTransport(
  target: ResolvedTarget,
  opts: {
    method: string;
    headers: Record<string, string>;
    body?: string | Buffer;
    timeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<{ status: number; headers: http.IncomingHttpHeaders; stream: Readable }> {
  const { url, addresses } = target;
  const isHttps = url.protocol === "https:";
  const mod = isHttps ? https : http;
  // DNS pinning: the TLS/socket layer resolves ONLY against the addresses we
  // validated — a rebind between validation and connect cannot move us.
  let i = 0;
  const lookup: (
    hostname: string,
    options: LookupOptions,
    cb: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
  ) => void = (_hostname, _options, cb) => {
    const a = addresses[i++ % addresses.length]!;
    cb(null, a.address, a.family);
  };
  return new Promise((resolve, reject) => {
    const req = mod.request(
      url,
      {
        method: opts.method,
        headers: opts.headers,
        lookup: lookup as never,
        servername: isHttps && !net.isIP(url.hostname) ? url.hostname : undefined,
      },
      (res) => resolve({ status: res.statusCode ?? 0, headers: res.headers, stream: res }),
    );
    req.setTimeout(opts.timeoutMs, () => {
      req.destroy(new ConnectorTimeoutError(opts.timeoutMs));
    });
    if (opts.signal) {
      if (opts.signal.aborted) req.destroy(new ConnectorTimeoutError(opts.timeoutMs));
      else opts.signal.addEventListener("abort", () => req.destroy(new ConnectorTimeoutError(opts.timeoutMs)), { once: true });
    }
    req.on("error", reject);
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

async function oneHop(
  rawUrl: string,
  opts: Required<Pick<GuardedRequestOptions, "timeoutMs" | "allowHosts">> & GuardedRequestOptions,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; stream: Readable; url: URL }> {
  const target = await resolveAndValidate(rawUrl, opts.allowHosts ?? null);
  const transport = transportOverride ?? defaultTransport;
  const res = await transport(target, {
    method: opts.method ?? "GET",
    headers: opts.headers ?? {},
    body: opts.body,
    timeoutMs: opts.timeoutMs,
    signal: opts.signal,
  });
  return { ...res, url: target.url };
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function consumeWithCap(stream: Readable, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    stream.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        stream.destroy();
        reject(new ResponseTooLargeError(maxBytes));
        return;
      }
      chunks.push(chunk);
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/** Buffered, fully validated request. Follows redirects with re-validation. */
export async function guardedRequest(
  rawUrl: string,
  opts: GuardedRequestOptions = {},
): Promise<{ status: number; body: Buffer; finalUrl: string }> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxBytes = opts.maxBytes ?? 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 3;
  let url = rawUrl;
  let method = opts.method ?? "GET";
  let body = opts.body;
  for (let hop = 0; ; hop++) {
    const res = await oneHop(url, { ...opts, method, body, timeoutMs, allowHosts: opts.allowHosts ?? null });
    if (REDIRECT_STATUSES.has(res.status) && typeof res.headers.location === "string") {
      res.stream.destroy();
      if (hop >= maxRedirects) throw new BlockedUrlError("too many redirects");
      const next = new URL(res.headers.location, res.url).toString();
      // 301/302/303 downgrade POST to GET per fetch semantics.
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method !== "GET" && method !== "HEAD")) {
        method = "GET";
        body = undefined;
      }
      url = next; // next loop re-validates scheme/host/DNS
      continue;
    }
    const buf = await consumeWithCap(res.stream, maxBytes);
    return { status: res.status, body: buf, finalUrl: res.url.toString() };
  }
}

/** JSON convenience wrapper with fixed caps. */
export async function guardedJson<T = unknown>(
  rawUrl: string,
  opts: GuardedRequestOptions = {},
): Promise<{ status: number; json: T }> {
  const res = await guardedRequest(rawUrl, {
    ...opts,
    headers: { accept: "application/json", ...(opts.headers ?? {}) },
  });
  let json: T;
  try {
    json = JSON.parse(res.body.toString("utf8")) as T;
  } catch {
    throw new ConnectorHttpError(res.status, "response was not valid JSON");
  }
  return { status: res.status, json };
}

/**
 * WHATWG-fetch adapter over the pinned transport, for SDKs that accept a
 * custom fetch (e.g. the official MCP SDK's StreamableHTTPClientTransport).
 * Enforces the same scheme/DNS/redirect/cap policy. Responses are delivered
 * as a capped byte stream.
 */
export function makeGuardedFetch(opts: Omit<GuardedRequestOptions, "method" | "body"> = {}) {
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    // Normalize any Headers/sequence/plain-object init into a plain map.
    const headerMap: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers).forEach((v, k) => {
        headerMap[k.toLowerCase()] = v;
      });
    }
    const res = await oneHop(String(input), {
      ...opts,
      method: init?.method ?? "GET",
      headers: headerMap,
      body: typeof init?.body === "string" ? init.body : undefined,
      timeoutMs: opts.timeoutMs ?? 20_000,
      allowHosts: opts.allowHosts ?? null,
      signal: init?.signal ?? undefined,
      // The SDK manages its own protocol flow; we still never auto-follow.
      maxRedirects: 0,
    });
    if (REDIRECT_STATUSES.has(res.status)) {
      res.stream.destroy();
      throw new BlockedUrlError("redirects are not followed for this connector");
    }
    let received = 0;
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maxBytes) {
          controller.error(new ResponseTooLargeError(maxBytes));
          res.stream.destroy();
          return;
        }
        controller.enqueue(chunk);
      },
    });
    const web = Readable.toWeb(res.stream) as ReadableStream<Uint8Array>;
    const headers = new Headers();
    for (const [k, v] of Object.entries(res.headers)) {
      if (typeof v === "string") headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(", "));
    }
    return new Response(web.pipeThrough(counter), { status: res.status, headers });
  };
}
