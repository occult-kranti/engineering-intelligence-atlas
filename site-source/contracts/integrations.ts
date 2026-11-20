import { z } from "zod";

/**
 * Integration/credential layer contracts (owner-scoped vault + read-only
 * connectors). Shared by the tRPC router and the Director UI.
 *
 * Hard rules encoded here:
 *  - plaintext secrets are write-only: `secret` appears ONLY on create inputs,
 *    never on any output type;
 *  - API outputs carry status/error-class/metadata only — no ciphertext,
 *    no iv/authTag, no token, no last-N characters of a secret;
 *  - all connector operations are explicit, read-only, and server-side.
 */

export const INTEGRATION_PROVIDERS = [
  "openai",
  "anthropic",
  "github",
  "figma",
  "google-drive",
  "mcp",
] as const;
export const IntegrationProviderSchema = z.enum(INTEGRATION_PROVIDERS);
export type IntegrationProvider = z.infer<typeof IntegrationProviderSchema>;

export const INTEGRATION_CHECK_STATUSES = ["unchecked", "ok", "failed"] as const;
export type IntegrationCheckStatus = (typeof INTEGRATION_CHECK_STATUSES)[number];

/** Stable error classes for connector failures. Never contains secret material. */
export const CONNECTOR_ERROR_CLASSES = [
  "auth", // 401/403 — credential rejected or insufficient scope
  "not_found",
  "rate_limited",
  "unreachable", // network/timeout/5xx
  "blocked_url", // SSRF/allowlist/policy refusal by our own guard
  "bad_response",
  "not_configured", // vault key missing / record absent
] as const;
export type ConnectorErrorClass = (typeof CONNECTOR_ERROR_CLASSES)[number];

/** What the API is allowed to return about a stored record. */
export interface IntegrationRecordView {
  id: number;
  provider: IntegrationProvider;
  label: string;
  /** Non-secret metadata (e.g. MCP server URL). Never the credential. */
  metadata: Record<string, unknown>;
  lastCheckStatus: IntegrationCheckStatus;
  lastCheckErrorClass: string | null;
  lastCheckAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const CreateIntegrationInputSchema = z.object({
  provider: IntegrationProviderSchema,
  label: z.string().min(1).max(120),
  /** Write-only. Never returned, never logged, never persisted in plaintext. */
  secret: z.string().min(1).max(8192),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ConnectionTestResultSchema = z.object({
  ok: z.boolean(),
  errorClass: z.enum(CONNECTOR_ERROR_CLASSES).optional(),
  /** Redacted, human-readable detail — safe to render, never a secret. */
  detail: z.string().max(500).optional(),
  /** Model discovery (openai/anthropic), capped. */
  models: z.array(z.string()).max(50).optional(),
});
export type ConnectionTestResult = z.infer<typeof ConnectionTestResultSchema>;

// ── GitHub (read-only) ──────────────────────────────────────────

export const GithubInspectInputSchema = z.object({
  /** https://github.com/owner/repo — public repos need no token. */
  repoUrl: z.string().min(1).max(500),
  /** Optional vault record holding a PAT (private repos). */
  recordId: z.number().int().positive().optional(),
});

export interface GithubRepoInspection {
  fullName: string;
  description: string;
  defaultBranch: string;
  language: string | null;
  license: string | null;
  stars: number;
  updatedAt: string;
  htmlUrl: string;
  /** First N entries of the default-branch tree (paths only, capped). */
  treePaths: string[];
  treeTruncated: boolean;
  /** sha256 of the fetched README bytes — import requires this exact hash. */
  readmeSha256: string | null;
  readmeBytes: number;
  /** First characters of the README for human review before import. */
  readmeExcerpt: string | null;
}

export const GithubImportInputSchema = z.object({
  repoUrl: z.string().min(1).max(500),
  recordId: z.number().int().positive().optional(),
  /** The hash the human reviewed during inspect; import aborts on mismatch. */
  expectedReadmeSha256: z.string().regex(/^[0-9a-f]{64}$/),
});

// ── Figma (read-only) ───────────────────────────────────────────

export const FigmaFileMetaInputSchema = z.object({
  recordId: z.number().int().positive(),
  fileKey: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9]+$/),
});

// ── Google Drive (read-only) ────────────────────────────────────

export const DriveListInputSchema = z.object({
  recordId: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(50).default(25),
});

// ── MCP (remote Streamable HTTP, discovery only) ────────────────

export const McpRegisterInputSchema = z.object({
  label: z.string().min(1).max(120),
  /** https:// URL of a remote Streamable HTTP MCP server. */
  url: z.string().url().max(1000),
  /** Optional bearer credential, stored in the same vault. */
  secret: z.string().max(8192).optional(),
});

export const McpAllowlistSchema = z.object({
  /** Exact hostnames the owner permits MCP discovery against. */
  hosts: z.array(z.string().min(1).max(255)).max(50),
});

export interface McpToolRecord {
  id: number;
  name: string;
  description: string;
  sha256: string;
  status: "quarantined";
  createdAt: Date;
}

/** Provider metadata shown in the UI. Unsupported ops are simply absent. */
export const INTEGRATION_PROVIDER_INFO: Record<
  IntegrationProvider,
  { name: string; secretLabel: string; capabilities: string[] }
> = {
  openai: {
    name: "OpenAI",
    secretLabel: "API key",
    capabilities: ["connection test", "model discovery", "use for Director runs"],
  },
  anthropic: {
    name: "Anthropic",
    secretLabel: "API key",
    capabilities: ["connection test", "model discovery", "use for Director runs"],
  },
  github: {
    name: "GitHub",
    secretLabel: "Personal access token (read-only scopes)",
    capabilities: ["connection test", "repo metadata/tree/README inspect", "quarantined import"],
  },
  figma: {
    name: "Figma",
    secretLabel: "Personal access token",
    capabilities: ["connection test", "file metadata (read-only)"],
  },
  "google-drive": {
    name: "Google Drive",
    secretLabel: "OAuth access token (short-lived)",
    capabilities: ["connection test", "file list/metadata (read-only, page-capped)"],
  },
  mcp: {
    name: "MCP server",
    secretLabel: "Bearer token (optional)",
    capabilities: ["initialize", "tools/list discovery (quarantined)"],
  },
};
