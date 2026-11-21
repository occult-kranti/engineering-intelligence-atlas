import { createHash } from "node:crypto";
import type { ConnectorErrorClass, GithubRepoInspection } from "@contracts/integrations";
import {
  BlockedUrlError,
  ConnectorHttpError,
  ConnectorTimeoutError,
  connectorBase,
  guardedJson,
  guardedRequest,
  ResponseTooLargeError,
} from "./http";

/**
 * Read-only provider connectors. Every call:
 *  - is explicit (invoked by an owner click via the router — no background sync);
 *  - uses fixed official endpoints with an exact host allowlist;
 *  - caps output size and item counts;
 *  - throws errors classified to a stable, secret-free error class.
 * Tokens arrive here already decrypted in-memory and are never logged,
 * returned, or persisted.
 */

export class ConnectorError extends Error {
  readonly errorClass: ConnectorErrorClass;
  constructor(errorClass: ConnectorErrorClass, message: string) {
    super(message);
    this.name = "ConnectorError";
    this.errorClass = errorClass;
  }
}

/** Classify any thrown connector error into a stable, secret-free class. */
export function classifyConnectorError(err: unknown): {
  errorClass: ConnectorErrorClass;
  detail: string;
} {
  if (err instanceof ConnectorError) return { errorClass: err.errorClass, detail: err.message };
  if (err instanceof BlockedUrlError) return { errorClass: "blocked_url", detail: err.message };
  if (err instanceof ConnectorTimeoutError)
    return { errorClass: "unreachable", detail: "request timed out" };
  if (err instanceof ResponseTooLargeError)
    return { errorClass: "bad_response", detail: "response exceeded the size cap" };
  if (err instanceof ConnectorHttpError) {
    if (err.status === 401 || err.status === 403)
      return { errorClass: "auth", detail: `credential rejected (HTTP ${err.status})` };
    if (err.status === 404) return { errorClass: "not_found", detail: "resource not found" };
    if (err.status === 429) return { errorClass: "rate_limited", detail: "provider rate limit" };
    if (err.status >= 500)
      return { errorClass: "unreachable", detail: `provider error (HTTP ${err.status})` };
    return { errorClass: "bad_response", detail: `unexpected HTTP ${err.status}` };
  }
  return { errorClass: "unreachable", detail: "network request failed" };
}

function bearerHeaders(token: string, extra: Record<string, string> = {}): Record<string, string> {
  return { authorization: `Bearer ${token}`, ...extra };
}

function throwForStatus(status: number, what: string): void {
  if (status >= 200 && status < 300) return;
  throw new ConnectorHttpError(status, `${what} returned HTTP ${status}`);
}

// ── GitHub (fixed api.github.com endpoints, read-only) ──────────

function hostsOf(base: string): string[] {
  return [new URL(base).hostname.toLowerCase()];
}

const GH_TREE_CAP = 500;
const GH_README_CAP = 256 * 1024;

export function parseGithubRepoUrl(repoUrl: string): { owner: string; repo: string } {
  let url: URL;
  try {
    url = new URL(repoUrl);
  } catch {
    throw new ConnectorError("bad_response", "not a valid URL");
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
    throw new ConnectorError("blocked_url", "only https://github.com/<owner>/<repo> URLs are accepted");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new ConnectorError("bad_response", "expected https://github.com/<owner>/<repo>");
  }
  const [owner, repo] = parts;
  const ok = /^[A-Za-z0-9_.-]+$/.test(owner!) && /^[A-Za-z0-9_.-]+$/.test(repo!);
  if (!ok) throw new ConnectorError("bad_response", "invalid owner/repo in URL");
  return { owner: owner!, repo: repo!.replace(/\.git$/, "") };
}

/**
 * Full 40-hex sha of the default-branch HEAD (one read-only call, same
 * allowlist/0-redirect/cap guardrails). Required by RepositoryMetadataSchema.
 */
export async function githubHeadSha(
  repoUrl: string,
  token: string | null,
  defaultBranch?: string,
): Promise<{ commitSha: string; defaultBranch: string }> {
  const { owner, repo } = parseGithubRepoUrl(repoUrl);
  const base = connectorBase("github", "https://api.github.com");
  const headers = token ? bearerHeaders(token) : {};
  let branch = defaultBranch ?? "";
  if (!branch) {
    const meta = await guardedJson<Record<string, unknown>>(
      `${base}/repos/${owner}/${repo}`,
      { headers, allowHosts: hostsOf(base), maxRedirects: 0, maxBytes: 256 * 1024 },
    );
    throwForStatus(meta.status, "GitHub repo metadata");
    branch = String(meta.json.default_branch ?? "main");
  }
  const commit = await guardedJson<{ sha?: unknown }>(
    `${base}/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`,
    { headers, allowHosts: hostsOf(base), maxRedirects: 0, maxBytes: 256 * 1024 },
  );
  throwForStatus(commit.status, "GitHub HEAD commit");
  const sha = String(commit.json.sha ?? "");
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new ConnectorError("bad_response", "GitHub returned a malformed HEAD commit sha");
  }
  return { commitSha: sha, defaultBranch: branch };
}

/** Read-only repo metadata + tree paths + README hash/excerpt. No token needed for public repos. */
export async function githubInspectRepo(
  repoUrl: string,
  token: string | null,
): Promise<GithubRepoInspection> {
  const { owner, repo } = parseGithubRepoUrl(repoUrl);
  const base = connectorBase("github", "https://api.github.com");
  const headers = token ? bearerHeaders(token) : {};
  const meta = await guardedJson<Record<string, unknown>>(
    `${base}/repos/${owner}/${repo}`,
    { headers, allowHosts: hostsOf(base), maxRedirects: 0, maxBytes: 256 * 1024 },
  );
  throwForStatus(meta.status, "GitHub repo metadata");
  const m = meta.json;
  const defaultBranch = String(m.default_branch ?? "main");
  const { commitSha } = await githubHeadSha(repoUrl, token, defaultBranch);

  const tree = await guardedJson<{ tree?: { path?: string }[]; truncated?: boolean }>(
    `${base}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
    { headers, allowHosts: hostsOf(base), maxRedirects: 0, maxBytes: 4 * 1024 * 1024 },
  );
  throwForStatus(tree.status, "GitHub tree");
  const treePaths = (tree.json.tree ?? [])
    .map((t) => t.path)
    .filter((p): p is string => typeof p === "string")
    .slice(0, GH_TREE_CAP);

  // README via the dedicated endpoint; raw bytes, hashed, excerpted, capped.
  let readmeSha256: string | null = null;
  let readmeBytes = 0;
  let readmeExcerpt: string | null = null;
  try {
    const readme = await guardedRequest(`${base}/repos/${owner}/${repo}/readme`, {
      headers: { ...headers, accept: "application/vnd.github.raw+json" },
      allowHosts: hostsOf(base),
      maxRedirects: 0,
      maxBytes: GH_README_CAP,
    });
    if (readme.status >= 200 && readme.status < 300) {
      readmeSha256 = createHash("sha256").update(readme.body).digest("hex");
      readmeBytes = readme.body.byteLength;
      readmeExcerpt = readme.body.toString("utf8").slice(0, 2_000);
    }
  } catch (err) {
    if (err instanceof ConnectorHttpError && err.status === 404) {
      // No README is a valid outcome.
    } else {
      throw err;
    }
  }

  const rawVisibility = String(m.visibility ?? (m.private === true ? "private" : "public"));
  const visibility =
    rawVisibility === "private" || rawVisibility === "internal" ? rawVisibility : "public";
  const topics = (Array.isArray(m.topics) ? m.topics : [])
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .slice(0, 32);

  return {
    fullName: String(m.full_name ?? `${owner}/${repo}`),
    description: String(m.description ?? ""),
    defaultBranch,
    commitSha,
    topics,
    visibility,
    archived: m.archived === true,
    language: typeof m.language === "string" ? m.language : null,
    license:
      m.license && typeof m.license === "object"
        ? String((m.license as Record<string, unknown>).spdx_id ?? "")
        : null,
    stars: typeof m.stargazers_count === "number" ? m.stargazers_count : 0,
    updatedAt: String(m.updated_at ?? ""),
    htmlUrl: String(m.html_url ?? `https://github.com/${owner}/${repo}`),
    treePaths,
    treeTruncated: Boolean(tree.json.truncated) || treePaths.length === GH_TREE_CAP,
    readmeSha256,
    readmeBytes,
    readmeExcerpt,
  };
}

/** Fetches raw README bytes for import (hash-verified by the caller). */
export async function githubFetchReadme(
  repoUrl: string,
  token: string | null,
): Promise<{ sha256: string; text: string } | null> {
  const { owner, repo } = parseGithubRepoUrl(repoUrl);
  const base = connectorBase("github", "https://api.github.com");
  const headers = token ? bearerHeaders(token) : {};
  const readme = await guardedRequest(`${base}/repos/${owner}/${repo}/readme`, {
    headers: { ...headers, accept: "application/vnd.github.raw+json" },
    allowHosts: hostsOf(base),
    maxRedirects: 0,
    maxBytes: GH_README_CAP,
  });
  if (readme.status === 404) return null;
  throwForStatus(readme.status, "GitHub README");
  const sha256 = createHash("sha256").update(readme.body).digest("hex");
  return { sha256, text: readme.body.toString("utf8") };
}

/** PAT connection test: GET /user (read-only identity check). */
export async function githubTestConnection(token: string): Promise<void> {
  const base = connectorBase("github", "https://api.github.com");
  const res = await guardedJson(`${base}/user`, {
    headers: bearerHeaders(token),
    allowHosts: hostsOf(base),
    maxRedirects: 0,
    maxBytes: 64 * 1024,
  });
  throwForStatus(res.status, "GitHub identity check");
}

// ── Figma (fixed api.figma.com endpoints, read-only) ────────────

const FIGMA_BASE = () => connectorBase("figma", "https://api.figma.com");

export async function figmaTestConnection(token: string): Promise<void> {
  const base = FIGMA_BASE();
  const res = await guardedJson(`${base}/v1/me`, {
    headers: { "x-figma-token": token },
    allowHosts: hostsOf(base),
    maxRedirects: 0,
    maxBytes: 64 * 1024,
  });
  throwForStatus(res.status, "Figma identity check");
}

/** Read-only file metadata: depth=1 document shell, capped. */
export async function figmaFileMeta(
  token: string,
  fileKey: string,
): Promise<{ name: string; lastModified: string; version: string; pageCount: number }> {
  const res = await guardedJson<Record<string, unknown>>(
    `${FIGMA_BASE()}/v1/files/${encodeURIComponent(fileKey)}?depth=1`,
    { headers: { "x-figma-token": token }, allowHosts: hostsOf(FIGMA_BASE()), maxRedirects: 0, maxBytes: 2 * 1024 * 1024 },
  );
  throwForStatus(res.status, "Figma file metadata");
  const doc = (res.json.document ?? {}) as Record<string, unknown>;
  const children = Array.isArray(doc.children) ? doc.children.length : 0;
  return {
    name: String(res.json.name ?? ""),
    lastModified: String(res.json.lastModified ?? res.json.last_modified ?? ""),
    version: String(res.json.version ?? ""),
    pageCount: children,
  };
}

// ── Google Drive (fixed www.googleapis.com endpoints, read-only) ─
//
// Honest limitation: the owner pastes a short-lived OAuth access token.
// There is NO refresh-token flow here — when the token expires (typically
// ~1 hour) the connection test will report `auth` and the owner must paste
// a fresh token. Nothing is downloaded or modified.

const DRIVE_BASE = () => connectorBase("google-drive", "https://www.googleapis.com");
const DRIVE_MAX_PAGES = 2; // hard page cap — no unbounded listing

export async function driveTestConnection(token: string): Promise<void> {
  const base = DRIVE_BASE();
  const res = await guardedJson(`${base}/drive/v3/about?fields=user`, {
    headers: bearerHeaders(token),
    allowHosts: hostsOf(base),
    maxRedirects: 0,
    maxBytes: 64 * 1024,
  });
  throwForStatus(res.status, "Google Drive identity check");
}

export interface DriveFileView {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: string | null;
}

export async function driveListFiles(
  token: string,
  pageSize: number,
): Promise<{ files: DriveFileView[]; truncated: boolean }> {
  const files: DriveFileView[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  let truncated = false;
  do {
    const params = new URLSearchParams({
      pageSize: String(pageSize),
      fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size)",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await guardedJson<{
      files?: Record<string, unknown>[];
      nextPageToken?: string;
    }>(`${DRIVE_BASE()}/drive/v3/files?${params}`, {
      headers: bearerHeaders(token),
      allowHosts: hostsOf(DRIVE_BASE()),
      maxRedirects: 0,
      maxBytes: 1024 * 1024,
    });
    throwForStatus(res.status, "Google Drive file list");
    for (const f of res.json.files ?? []) {
      files.push({
        id: String(f.id ?? ""),
        name: String(f.name ?? ""),
        mimeType: String(f.mimeType ?? ""),
        modifiedTime: String(f.modifiedTime ?? ""),
        size: typeof f.size === "string" ? f.size : null,
      });
    }
    pageToken = res.json.nextPageToken;
    pages += 1;
    if (pageToken && pages >= DRIVE_MAX_PAGES) {
      truncated = true;
      break;
    }
  } while (pageToken);
  return { files, truncated };
}

// ── OpenAI / Anthropic (official SDKs, connection test + discovery) ──

const DISCOVERY_MODEL_CAP = 50;

export async function openaiTestAndListModels(apiKey: string): Promise<string[]> {
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 15_000 });
    const page = await client.models.list();
    const ids: string[] = [];
    for (const m of page.data) {
      if (typeof m.id === "string") ids.push(m.id);
      if (ids.length >= DISCOVERY_MODEL_CAP) break;
    }
    return ids.sort();
  } catch (err) {
    throw sdkToConnectorError(err);
  }
}

export async function anthropicTestAndListModels(apiKey: string): Promise<string[]> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 15_000 });
    const page = await client.models.list({ limit: DISCOVERY_MODEL_CAP });
    const ids: string[] = [];
    for (const m of page.data) {
      if (typeof m.id === "string") ids.push(m.id);
    }
    return ids.sort();
  } catch (err) {
    throw sdkToConnectorError(err);
  }
}

function sdkToConnectorError(err: unknown): ConnectorError {
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") {
    return new ConnectorError(
      status === 401 || status === 403
        ? "auth"
        : status === 429
          ? "rate_limited"
          : status >= 500
            ? "unreachable"
            : "bad_response",
      `provider returned HTTP ${status}`,
    );
  }
  const name = (err as Error)?.name ?? "";
  if (/timeout|abort/i.test(name)) return new ConnectorError("unreachable", "request timed out");
  return new ConnectorError("unreachable", "could not reach provider");
}
