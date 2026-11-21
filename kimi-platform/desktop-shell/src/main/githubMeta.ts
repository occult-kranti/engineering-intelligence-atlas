import {
  RepositoryMetadataSchema,
  type RepositoryMetadata,
} from '../shared/assistant';

/**
 * v0.6 GitHub metadata reader (desktop) — PUBLIC, ANONYMOUS, READ-ONLY.
 *
 * Hard rules:
 *  - Exact host allowlist: requests go ONLY to https://api.github.com. Input
 *    URLs must be https://github.com/<owner>/<repo>; every other host,
 *    scheme, userinfo, port, or path shape is refused (SSRF guard).
 *  - No tokens, ever: there is no credential parameter and no Authorization
 *    header is ever set. Private reads stay on the web app behind a
 *    credential + approval; here a non-public repository is reported so the
 *    caller can quarantine it via routeRepository (shared contract).
 *  - No redirects (redirect:'manual'; any 3xx is an error), HTTPS only,
 *    256 KiB body cap per response, hard timeout, at most 2 requests per
 *    repository (metadata + HEAD commit), and a process-local rate budget.
 *  - NO clone, NO download of code, NO archive or bundle endpoints, NO code
 *    execution. Only JSON metadata is read: description, language, topics,
 *    license, archived flag, default branch, and the HEAD commit sha.
 *
 * Error classes mirror the web connectors (api/integrations/connectors.ts)
 * so web/desktop report identically: blocked_url | not_found | rate_limited
 * | auth | unreachable | bad_response | private.
 */

export const GITHUB_API_HOST = 'api.github.com' as const;
export const GITHUB_WEB_HOST = 'github.com' as const;
export const GITHUB_META_MAX_BYTES = 256 * 1024;
export const GITHUB_META_TIMEOUT_MS = 10_000;
/** At most this many metadata reads per process-hour (anonymous cap is 60). */
export const GITHUB_META_RATE_BUDGET = 50;
/** Selected-repository cap enforced by the assistant store (per enterprise). */
export const MAX_SELECTED_REPOSITORIES = 50;

export type GithubMetaErrorClass =
  | 'blocked_url'
  | 'not_found'
  | 'rate_limited'
  | 'auth'
  | 'unreachable'
  | 'bad_response'
  | 'private';

export class GithubMetaError extends Error {
  readonly errorClass: GithubMetaErrorClass;
  constructor(errorClass: GithubMetaErrorClass, message: string) {
    super(message);
    this.name = 'GithubMetaError';
    this.errorClass = errorClass;
  }
}

/** Stable, secret-free classification for UI/reporting. */
export function classifyGithubMetaError(err: unknown): { errorClass: GithubMetaErrorClass; detail: string } {
  if (err instanceof GithubMetaError) return { errorClass: err.errorClass, detail: err.message };
  return { errorClass: 'unreachable', detail: 'network request failed' };
}

const OWNER_REPO_RE = /^[A-Za-z0-9_.-]{1,100}$/;

/**
 * Parse an https://github.com/<owner>/<repo> URL. Anything else — other
 * hosts (including lookalikes such as github.com.evil.tld), non-HTTPS
 * schemes, userinfo, ports, query strings with credentials — is refused.
 */
export function parseGithubRepoUrl(repoUrl: string): { owner: string; repo: string } {
  if (typeof repoUrl !== 'string' || repoUrl.length === 0 || repoUrl.length > 1000) {
    throw new GithubMetaError('bad_response', 'repository url must be a string of 1..1000 characters');
  }
  let url: URL;
  try {
    url = new URL(repoUrl);
  } catch {
    throw new GithubMetaError('bad_response', 'not a valid URL');
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== GITHUB_WEB_HOST) {
    throw new GithubMetaError('blocked_url', 'only https://github.com/<owner>/<repo> URLs are accepted');
  }
  if (url.username !== '' || url.password !== '' || url.port !== '') {
    throw new GithubMetaError('blocked_url', 'URLs with credentials or ports are refused');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 2) {
    throw new GithubMetaError('bad_response', 'expected exactly https://github.com/<owner>/<repo>');
  }
  const [owner, rawRepo] = parts;
  const repo = rawRepo!.replace(/\.git$/, '');
  if (!OWNER_REPO_RE.test(owner!) || !OWNER_REPO_RE.test(repo)) {
    throw new GithubMetaError('bad_response', 'invalid owner/repo in URL');
  }
  return { owner: owner!, repo };
}

export interface FetchLikeResponse {
  status: number;
  headers: { get(name: string): string | null };
  body: unknown;
  arrayBuffer(): Promise<ArrayBuffer>;
}
export type GithubFetchFn = (url: string, init: Record<string, unknown>) => Promise<FetchLikeResponse>;

export interface GithubMetaDeps {
  /** Injectable for tests; production uses global fetch. */
  fetchFn?: GithubFetchFn;
  timeoutMs?: number;
  /** Wall-clock ms; injectable for deterministic tests. */
  now?: () => number;
}

interface CacheEntry {
  metadata: RepositoryMetadata;
  fetchedAt: number;
}

const META_CACHE_TTL_MS = 5 * 60_000;

/**
 * Process-local metadata cache (the "repository-metadata" cache namespace):
 * 5-minute TTL, capped at MAX_SELECTED_REPOSITORIES entries. Never persisted;
 * cache.invalidate with namespace repository-metadata clears it.
 */
export class GithubMetaCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(url: string, now: number): RepositoryMetadata | null {
    const entry = this.entries.get(url);
    if (!entry) return null;
    if (now - entry.fetchedAt > META_CACHE_TTL_MS) {
      this.entries.delete(url);
      return null;
    }
    return entry.metadata;
  }

  set(url: string, metadata: RepositoryMetadata, now: number): void {
    if (this.entries.size >= MAX_SELECTED_REPOSITORIES && !this.entries.has(url)) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(url, { metadata, fetchedAt: now });
  }

  clear(): number {
    const n = this.entries.size;
    this.entries.clear();
    return n;
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Process-local anonymous rate budget (sliding window). */
class RateBudget {
  private stamps: number[] = [];
  constructor(private readonly limit: number) {}
  consume(now: number): void {
    const windowStart = now - 60 * 60_000;
    this.stamps = this.stamps.filter((t) => t >= windowStart);
    if (this.stamps.length >= this.limit) {
      throw new GithubMetaError('rate_limited', 'local anonymous GitHub rate budget exhausted (try again later)');
    }
    this.stamps.push(now);
  }
}

const sharedBudget = new RateBudget(GITHUB_META_RATE_BUDGET);

async function readCappedBody(res: FetchLikeResponse, maxBytes: number): Promise<string> {
  const length = res.headers.get('content-length');
  if (length !== null && Number(length) > maxBytes) {
    throw new GithubMetaError('bad_response', 'response exceeded the size cap');
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new GithubMetaError('bad_response', 'response exceeded the size cap');
  }
  return buf.toString('utf8');
}

/**
 * One guarded GET to api.github.com. Fixed host (built by the caller from a
 * validated owner/repo), HTTPS, zero redirects, capped body, hard timeout,
 * tokenless headers only.
 */
async function guardedGithubGet(
  path: string,
  deps: Required<Pick<GithubMetaDeps, 'now'>> & GithubMetaDeps,
): Promise<{ status: number; json: unknown }> {
  const url = `https://${GITHUB_API_HOST}${path}`;
  const hostCheck = new URL(url);
  if (hostCheck.protocol !== 'https:' || hostCheck.hostname !== GITHUB_API_HOST) {
    throw new GithubMetaError('blocked_url', 'request host is not api.github.com');
  }
  sharedBudget.consume(deps.now());
  const timeoutMs = deps.timeoutMs ?? GITHUB_META_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  let res: FetchLikeResponse;
  try {
    const fetchFn = deps.fetchFn ?? (globalThis.fetch as unknown as GithubFetchFn);
    res = await fetchFn(url, {
      method: 'GET',
      redirect: 'manual', // zero redirects followed
      signal: controller.signal,
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'research-director-desktop/0.6 (public metadata only)',
        // NEVER an authorization header: tokenless by design.
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) throw new GithubMetaError('unreachable', 'request timed out');
    const name = (err as { name?: string })?.name ?? '';
    if (/abort|timeout/i.test(name)) throw new GithubMetaError('unreachable', 'request timed out');
    throw new GithubMetaError('unreachable', 'network request failed');
  }
  clearTimeout(timer);

  if (res.status >= 300 && res.status < 400) {
    throw new GithubMetaError('blocked_url', `redirect refused (HTTP ${res.status}); redirects are never followed`);
  }
  if (res.status === 404) throw new GithubMetaError('not_found', 'repository not found (or private without credentials)');
  if (res.status === 429 || res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (res.status === 429 || remaining === '0') {
      throw new GithubMetaError('rate_limited', 'GitHub anonymous rate limit reached');
    }
    throw new GithubMetaError('bad_response', `unexpected HTTP ${res.status}`);
  }
  if (res.status === 401) throw new GithubMetaError('auth', 'endpoint demanded authentication; desktop reads are anonymous only');
  if (res.status >= 500) throw new GithubMetaError('unreachable', `GitHub error (HTTP ${res.status})`);
  if (res.status < 200 || res.status >= 300) throw new GithubMetaError('bad_response', `unexpected HTTP ${res.status}`);

  const text = await readCappedBody(res, GITHUB_META_MAX_BYTES);
  try {
    return { status: res.status, json: JSON.parse(text) as unknown };
  } catch {
    throw new GithubMetaError('bad_response', 'response was not valid JSON');
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GithubMetaError('bad_response', 'unexpected response shape');
  }
  return value as Record<string, unknown>;
}

/**
 * Fetch confirmed public metadata for one GitHub repository: repo metadata
 * (description/language/topics/license/archived/defaultBranch/visibility)
 * plus the default-branch HEAD commit sha. Two requests maximum.
 *
 * Throws GithubMetaError('private', …) when the repository is not public —
 * the caller quarantines it via routeRepository; private reads remain a
 * web-only, credential + approval flow and are never attempted here.
 */
export async function fetchGithubRepoMetadata(
  repoUrl: string,
  deps: GithubMetaDeps = {},
): Promise<RepositoryMetadata> {
  const { owner, repo } = parseGithubRepoUrl(repoUrl);
  const now = deps.now ?? Date.now;
  const enc = encodeURIComponent;

  const metaRes = await guardedGithubGet(`/repos/${enc(owner)}/${enc(repo)}`, { ...deps, now });
  const m = asRecord(metaRes.json);

  const visibilityRaw = typeof m.visibility === 'string' ? m.visibility.toLowerCase() : '';
  const isPrivate = m.private === true || (visibilityRaw !== '' && visibilityRaw !== 'public');
  const defaultBranch = typeof m.default_branch === 'string' && m.default_branch.length > 0 ? m.default_branch : 'main';

  // HEAD commit sha of the default branch (second and final request).
  const commitRes = await guardedGithubGet(
    `/repos/${enc(owner)}/${enc(repo)}/commits/${enc(defaultBranch)}?per_page=1`,
    { ...deps, now },
  );
  const commit = asRecord(commitRes.json);
  const commitSha = typeof commit.sha === 'string' ? commit.sha.toLowerCase() : '';
  if (!/^[0-9a-f]{40}$/.test(commitSha)) {
    throw new GithubMetaError('bad_response', 'could not confirm a full 40-character HEAD commit sha');
  }

  if (isPrivate) {
    throw new GithubMetaError(
      'private',
      'repository is not public; desktop performs confirmed public metadata reads only (quarantine it for triage)',
    );
  }

  const topics: string[] = [];
  if (Array.isArray(m.topics)) {
    for (const t of m.topics) {
      if (typeof t === 'string' && t.length > 0 && t.length <= 80 && topics.length < 32) topics.push(t);
    }
  }
  const licenseObj = typeof m.license === 'object' && m.license !== null ? (m.license as Record<string, unknown>) : null;
  const spdx = licenseObj && typeof licenseObj.spdx_id === 'string' ? licenseObj.spdx_id.toLowerCase() : null;
  const license = spdx !== null && spdx !== 'noassertion' ? spdx : null;

  return RepositoryMetadataSchema.parse({
    url: `https://github.com/${owner}/${repo}`,
    owner,
    name: typeof m.name === 'string' ? m.name : repo,
    description: typeof m.description === 'string' ? m.description.slice(0, 2000) : '',
    language: typeof m.language === 'string' ? m.language.slice(0, 80) : null,
    topics,
    license,
    archived: m.archived === true,
    defaultBranch,
    commitSha,
    visibility: 'public',
  });
}
