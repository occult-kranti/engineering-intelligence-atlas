import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  integrationDiscoveries,
  skillFiles,
  skills,
} from "@db/schema";
import {
  CreateIntegrationInputSchema,
  DriveListInputSchema,
  FigmaFileMetaInputSchema,
  GithubImportInputSchema,
  GithubInspectInputSchema,
  McpAllowlistSchema,
  McpRegisterInputSchema,
  type ConnectionTestResult,
  type IntegrationProvider,
} from "@contracts/integrations";
import { intakeSkillMarkdown } from "../registry/intake";
import { env } from "../lib/env";
import { log } from "../lib/logger";
import {
  createRecord,
  decryptRecordSecret,
  deleteOwnedRecord,
  getOwnedRecord,
  listOwnedRecords,
  recordCheckOutcome,
  toView,
} from "./store";
import {
  anthropicTestAndListModels,
  classifyConnectorError,
  ConnectorError,
  driveListFiles,
  driveTestConnection,
  figmaFileMeta,
  figmaTestConnection,
  githubFetchReadme,
  githubInspectRepo,
  githubTestConnection,
  openaiTestAndListModels,
  parseGithubRepoUrl,
} from "./connectors";
import { mcpDiscoverTools } from "./mcp";
import { localHttpAllowed } from "./http";
import { ownerSettings } from "@db/schema";
import { VaultUnavailable } from "./vault";

/**
 * Owner-scoped integration/credential router.
 *
 * Invariants enforced here:
 *  - every query/mutation is owner-scoped; cross-owner access returns
 *    NOT_FOUND (indistinguishable from absence);
 *  - secrets are write-only inputs; no output path contains them;
 *  - nothing request-shaped (bodies, headers, tokens) is logged;
 *  - connector failures map to stable error classes stored on the record.
 */

const MCP_ALLOWLIST_KEY = "mcp_allowed_hosts";
const DISCOVERY_CAP = 200;

/** Production runs must not accept credentials over plaintext HTTP. */
function requireSecureTransport(ctx: { req: Request }): void {
  if (!env.isProduction) return;
  const proto = ctx.req.headers.get("x-forwarded-proto");
  if (proto !== null && proto.toLowerCase() !== "https") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "credential operations require HTTPS",
    });
  }
}

function vaultGuard(err: unknown): never {
  if (err instanceof VaultUnavailable) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message });
  }
  throw err;
}

async function getMcpAllowlist(ownerId: number): Promise<string[]> {
  const row = await getDb().query.ownerSettings.findFirst({
    where: and(eq(ownerSettings.ownerId, ownerId), eq(ownerSettings.key, MCP_ALLOWLIST_KEY)),
  });
  const v = row?.value;
  if (!v || typeof v !== "object") return [];
  const hosts = (v as Record<string, unknown>).hosts;
  return Array.isArray(hosts) ? hosts.filter((h): h is string => typeof h === "string") : [];
}

async function runCheck(
  ownerId: number,
  recordId: number,
  fn: () => Promise<Omit<ConnectionTestResult, "ok">>,
): Promise<ConnectionTestResult> {
  try {
    const extra = await fn();
    await recordCheckOutcome(ownerId, recordId, true, null);
    return { ok: true, ...extra };
  } catch (err) {
    const { errorClass, detail } = classifyConnectorError(err);
    await recordCheckOutcome(ownerId, recordId, false, errorClass);
    // Log the class only — never the underlying error (may embed request data).
    log.info("integration check failed", { recordId, errorClass });
    return { ok: false, errorClass, detail };
  }
}

export const integrationsRouter = createRouter({
  /** Lists configured providers + status only. Never secrets/ciphertext. */
  list: authedQuery.query(async ({ ctx }) => {
    const rows = await listOwnedRecords(ctx.user.id);
    return {
      records: rows.map(toView),
      mcpAllowlist: await getMcpAllowlist(ctx.user.id),
    };
  }),

  create: authedQuery
    .input(CreateIntegrationInputSchema.omit({ provider: true }).extend({
      provider: CreateIntegrationInputSchema.shape.provider.exclude(["mcp"]),
    }))
    .mutation(async ({ ctx, input }) => {
      requireSecureTransport(ctx);
      try {
        const row = await createRecord({
          ownerId: ctx.user.id,
          provider: input.provider,
          label: input.label,
          secret: input.secret,
          metadata: input.metadata,
        });
        return { record: toView(row) };
      } catch (err) {
        if ((err as { code?: string })?.code === "ER_DUP_ENTRY") {
          throw new TRPCError({
            code: "CONFLICT",
            message: `a ${input.provider} integration with this label already exists`,
          });
        }
        vaultGuard(err);
      }
    }),
  revoke: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await deleteOwnedRecord(ctx.user.id, input.id);
      // Discoveries tied to the revoked record go with it.
      await getDb()
        .delete(integrationDiscoveries)
        .where(
          and(
            eq(integrationDiscoveries.recordId, input.id),
            eq(integrationDiscoveries.ownerId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),

  /** Explicit connection test (user click). Updates status/error class. */
  test: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const row = await getOwnedRecord(ctx.user.id, input.id);
      if (row.provider === "mcp") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "MCP servers are verified via discovery (mcpDiscover), not a ping",
        });
      }
      let secret: string | null = null;
      try {
        secret = decryptRecordSecret(row);
      } catch (err) {
        vaultGuard(err);
      }
      return runCheck(ctx.user.id, row.id, async () => {
        switch (row.provider as Exclude<IntegrationProvider, "mcp">) {
          case "openai":
            if (!secret) throw new ConnectorError("not_configured", "no credential stored");
            return { models: await openaiTestAndListModels(secret) };
          case "anthropic":
            if (!secret) throw new ConnectorError("not_configured", "no credential stored");
            return { models: await anthropicTestAndListModels(secret) };
          case "github":
            if (!secret) throw new ConnectorError("not_configured", "no credential stored");
            await githubTestConnection(secret);
            return {};
          case "figma":
            if (!secret) throw new ConnectorError("not_configured", "no credential stored");
            await figmaTestConnection(secret);
            return {};
          case "google-drive":
            if (!secret) throw new ConnectorError("not_configured", "no credential stored");
            await driveTestConnection(secret);
            return {};
        }
      });
    }),

  // ── GitHub ─────────────────────────────────────────────────────

  githubInspect: authedQuery
    .input(GithubInspectInputSchema)
    .mutation(async ({ ctx, input }) => {
      let token: string | null = null;
      if (input.recordId !== undefined) {
        const row = await getOwnedRecord(ctx.user.id, input.recordId);
        if (row.provider !== "github") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "record is not a GitHub credential" });
        }
        try {
          token = decryptRecordSecret(row);
        } catch (err) {
          vaultGuard(err);
        }
      }
      try {
        return await githubInspectRepo(input.repoUrl, token);
      } catch (err) {
        const { errorClass, detail } = classifyConnectorError(err);
        throw new TRPCError({ code: "BAD_REQUEST", message: `${errorClass}: ${detail}` });
      }
    }),

  /**
   * Import README as a QUARANTINED skill draft. The README is re-fetched
   * server-side and must hash to the value the human reviewed during
   * inspect; mismatch aborts. Content is parsed/hashed/risk-scanned via the
   * standard intake pipeline — never cloned, never executed.
   */
  githubImport: authedQuery
    .input(GithubImportInputSchema)
    .mutation(async ({ ctx, input }) => {
      let token: string | null = null;
      if (input.recordId !== undefined) {
        const row = await getOwnedRecord(ctx.user.id, input.recordId);
        if (row.provider !== "github") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "record is not a GitHub credential" });
        }
        try {
          token = decryptRecordSecret(row);
        } catch (err) {
          vaultGuard(err);
        }
      }
      const { owner, repo } = parseGithubRepoUrl(input.repoUrl);
      let readme;
      try {
        readme = await githubFetchReadme(input.repoUrl, token);
      } catch (err) {
        const { errorClass, detail } = classifyConnectorError(err);
        throw new TRPCError({ code: "BAD_REQUEST", message: `${errorClass}: ${detail}` });
      }
      if (!readme) {
        throw new TRPCError({ code: "NOT_FOUND", message: "repository has no README to import" });
      }
      if (readme.sha256 !== input.expectedReadmeSha256) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "README content changed since review (hash mismatch) — inspect again before importing",
        });
      }
      const safeName = `gh-import-${owner}-${repo}`
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, "-")
        .slice(0, 180);
      const doc = [
        "---",
        `name: ${safeName}`,
        "version: 0.1.0",
        `description: Imported README from github.com/${owner}/${repo} (quarantined; review before use)`,
        `provenance: https://github.com/${owner}/${repo}`,
        "---",
        "",
        readme.text.slice(0, 100_000),
      ].join("\n");
      const intake = intakeSkillMarkdown(doc);
      const db = getDb();
      const dup = await db.query.skills.findFirst({
        where: and(eq(skills.name, intake.manifest.name), eq(skills.version, intake.manifest.version)),
      });
      if (dup) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${intake.manifest.name}@${intake.manifest.version} is already in the registry`,
        });
      }
      const [row] = await db.insert(skills).values({
        ownerId: ctx.user.id,
        name: intake.manifest.name,
        version: intake.manifest.version,
        description: intake.manifest.description,
        manifest: intake.manifest,
        bodyText: intake.body,
        riskSignals: intake.riskSignals,
        contentSha256: intake.contentSha256,
        status: "quarantined",
        provenanceUrl: `https://github.com/${owner}/${repo}`,
        licenseDeclared: "",
      });
      const skillId = Number(row.insertId);
      await db.insert(skillFiles).values({
        skillId,
        path: "SKILL.md",
        size: Buffer.byteLength(doc),
        sha256: intake.contentSha256,
        kind: "body",
      });
      log.info("github repo imported as quarantined skill draft", {
        skillId,
        ownerId: ctx.user.id,
        sha256: intake.contentSha256,
      });
      return {
        id: skillId,
        status: "quarantined" as const,
        contentSha256: intake.contentSha256,
        riskSignals: intake.riskSignals,
      };
    }),

  // ── Figma ──────────────────────────────────────────────────────

  figmaFileMeta: authedQuery
    .input(FigmaFileMetaInputSchema)
    .mutation(async ({ ctx, input }) => {
      const row = await getOwnedRecord(ctx.user.id, input.recordId);
      if (row.provider !== "figma") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "record is not a Figma credential" });
      }
      let token: string | null;
      try {
        token = decryptRecordSecret(row);
      } catch (err) {
        vaultGuard(err);
      }
      if (!token) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "no credential stored" });
      try {
        return await figmaFileMeta(token, input.fileKey);
      } catch (err) {
        const { errorClass, detail } = classifyConnectorError(err);
        throw new TRPCError({ code: "BAD_REQUEST", message: `${errorClass}: ${detail}` });
      }
    }),

  // ── Google Drive ───────────────────────────────────────────────

  driveList: authedQuery
    .input(DriveListInputSchema)
    .mutation(async ({ ctx, input }) => {
      const row = await getOwnedRecord(ctx.user.id, input.recordId);
      if (row.provider !== "google-drive") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "record is not a Drive credential" });
      }
      let token: string | null;
      try {
        token = decryptRecordSecret(row);
      } catch (err) {
        vaultGuard(err);
      }
      if (!token) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "no credential stored" });
      try {
        return await driveListFiles(token, input.pageSize);
      } catch (err) {
        const { errorClass, detail } = classifyConnectorError(err);
        throw new TRPCError({ code: "BAD_REQUEST", message: `${errorClass}: ${detail}` });
      }
    }),

  // ── MCP ────────────────────────────────────────────────────────

  mcpSetAllowlist: authedQuery
    .input(McpAllowlistSchema)
    .mutation(async ({ ctx, input }) => {
      const hosts = [
        ...new Set(input.hosts.map((h) => h.trim().toLowerCase()).filter((h) => /^[a-z0-9.-]+$/.test(h))),
      ];
      const db = getDb();
      const existing = await db.query.ownerSettings.findFirst({
        where: and(eq(ownerSettings.ownerId, ctx.user.id), eq(ownerSettings.key, MCP_ALLOWLIST_KEY)),
      });
      if (existing) {
        await db
          .update(ownerSettings)
          .set({ value: { hosts } })
          .where(eq(ownerSettings.id, existing.id));
      } else {
        await db.insert(ownerSettings).values({
          ownerId: ctx.user.id,
          key: MCP_ALLOWLIST_KEY,
          value: { hosts },
        });
      }
      return { ok: true, hosts };
    }),

  mcpRegister: authedQuery
    .input(McpRegisterInputSchema)
    .mutation(async ({ ctx, input }) => {
      requireSecureTransport(ctx);
      let url: URL;
      try {
        url = new URL(input.url);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "invalid URL" });
      }
      const host = url.hostname.toLowerCase();
      const isLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
      if (url.protocol === "http:" && !(localHttpAllowed() && isLoopback)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "MCP servers must use https:// (local http only in explicit development mode)",
        });
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "unsupported URL scheme" });
      }
      const allowlist = await getMcpAllowlist(ctx.user.id);
      if (!allowlist.includes(host)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `host ${host} is not on your MCP allowlist — add it first`,
        });
      }
      try {
        const row = await createRecord({
          ownerId: ctx.user.id,
          provider: "mcp",
          label: input.label,
          secret: input.secret ?? null,
          metadata: { url: url.toString() },
        });
        return { record: toView(row) };
      } catch (err) {
        if ((err as { code?: string })?.code === "ER_DUP_ENTRY") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "an MCP server with this label already exists",
          });
        }
        vaultGuard(err);
      }
    }),

  /** initialize + tools/list only; tool schemas stored as quarantined records. */
  mcpDiscover: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const row = await getOwnedRecord(ctx.user.id, input.id);
      if (row.provider !== "mcp") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "record is not an MCP server" });
      }
      const url = typeof row.metadata?.url === "string" ? row.metadata.url : null;
      if (!url) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "record has no server URL" });
      }
      const host = new URL(url).hostname.toLowerCase();
      const allowlist = await getMcpAllowlist(ctx.user.id);
      if (!allowlist.includes(host)) {
        throw new TRPCError({ code: "FORBIDDEN", message: `host ${host} is not on your MCP allowlist` });
      }
      let bearer: string | null = null;
      try {
        bearer = decryptRecordSecret(row);
      } catch (err) {
        vaultGuard(err);
      }
      return runCheck(ctx.user.id, row.id, async () => {
        const { tools, serverInfo } = await mcpDiscoverTools(url, bearer);
        const db = getDb();
        // Replace prior discovery set for this record (fresh explicit click).
        await db
          .delete(integrationDiscoveries)
          .where(
            and(
              eq(integrationDiscoveries.recordId, row.id),
              eq(integrationDiscoveries.ownerId, ctx.user.id),
            ),
          );
        const capped = tools.slice(0, DISCOVERY_CAP);
        for (const t of capped) {
          const payload = { name: t.name, description: t.description, inputSchema: t.inputSchema };
          await db.insert(integrationDiscoveries).values({
            ownerId: ctx.user.id,
            recordId: row.id,
            kind: "mcp_tool",
            name: t.name,
            payload,
            sha256: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
            status: "quarantined",
          });
        }
        return {
          detail: `server ${serverInfo.name || "?"} ${serverInfo.version || ""} — ${capped.length} tool(s) quarantined`,
        };
      });
    }),

  /** Quarantined discovery records for one integration record. */
  discoveries: authedQuery
    .input(z.object({ recordId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await getOwnedRecord(ctx.user.id, input.recordId); // ownership check
      const rows = await getDb()
        .select()
        .from(integrationDiscoveries)
        .where(
          and(
            eq(integrationDiscoveries.recordId, input.recordId),
            eq(integrationDiscoveries.ownerId, ctx.user.id),
          ),
        )
        .orderBy(desc(integrationDiscoveries.createdAt))
        .limit(DISCOVERY_CAP);
      return rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        name: r.name,
        description: String((r.payload as Record<string, unknown>)?.description ?? ""),
        sha256: r.sha256,
        status: r.status,
        createdAt: r.createdAt,
      }));
    }),

  capabilities: authedQuery.query(() => ({
    vaultConfigured: !!process.env.INTEGRATION_ENCRYPTION_KEY,
    localHttpMode: localHttpAllowed(),
  })),
});
