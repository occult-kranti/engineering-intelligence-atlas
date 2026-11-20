import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import http from "node:http";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";

/**
 * DB-backed integration-layer suite: owner scoping, write-only API surface,
 * revocation, mocked connector flows (GitHub/Figma/Drive/OpenAI/Anthropic),
 * MCP discovery with no-tools/call enforcement, allowlist enforcement, and
 * no-secret canaries across API responses, discovery records, and app.log.
 *
 * No real external calls: every connector is redirected to a loopback mock
 * (dev-only test hook) or the SDK module is mocked.
 */

// Must run before any app module import (logger/env read env at load).
process.env.KIMI_LOG_DIR = `/tmp/kimi-logs-test-${process.pid}`;
process.env.KIMI_LOG_FILE = `${process.env.KIMI_LOG_DIR}/app.log`;
process.env.INTEGRATION_ENCRYPTION_KEY = "c".repeat(64);
process.env.INTEGRATIONS_ALLOW_LOCAL_HTTP = "1";

// ── Mocked official SDKs (no real OpenAI/Anthropic calls) ───────
const sdkSecretsSeen: string[] = [];
vi.mock("openai", () => ({
  default: class MockOpenAI {
    constructor(opts: { apiKey: string }) {
      sdkSecretsSeen.push(opts.apiKey);
    }
    models = {
      list: async () => ({ data: [{ id: "gpt-test-1" }, { id: "gpt-test-2" }] }),
    };
  },
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    constructor(opts: { apiKey: string }) {
      sdkSecretsSeen.push(opts.apiKey);
    }
    models = {
      list: async () => ({ data: [{ id: "claude-test-1" }] }),
    };
  },
}));

const { appRouter } = await import("../router");
const { getDb } = await import("../queries/connection");
const { users, integrationRecords, integrationDiscoveries, skills } = await import("@db/schema");
const { __setConnectorBaseForTests } = await import("./http");
const { sha256Hex } = await import("../registry/intake");
type User = (typeof users.$inferSelect);

const DB_OK = !!process.env.DATABASE_URL;
const stamp = Date.now().toString(36);

// Distinctive canary secrets — must never appear in outputs/logs.
const GH_TOKEN = `ghp_CANARY${stamp}GitHubToken`;
const FIGMA_TOKEN = `figd_CANARY${stamp}FigmaToken`;
const DRIVE_TOKEN = `ya29.CANARY${stamp}DriveToken`;
const OPENAI_KEY = `sk-CANARY${stamp}OpenAI`;
const MCP_BEARER = `mcpbearer-CANARY${stamp}`;
const ALL_SECRETS = [GH_TOKEN, FIGMA_TOKEN, DRIVE_TOKEN, OPENAI_KEY, MCP_BEARER];

let ownerA: User;
let ownerB: User;
let server: http.Server;
let base: string;
const mcpMethodsSeen: string[] = [];
const authHeadersSeen: (string | undefined)[] = [];

const README_TEXT = `# Mock Repo\n\nThis is a mocked README for import testing.\n`;
const README_SHA = sha256Hex(README_TEXT);

type Caller = ReturnType<typeof appRouter.createCaller>;
function callerFor(user?: User): Caller {
  return appRouter.createCaller({
    req: new Request("http://integration.test/"),
    resHeaders: new Headers(),
    ...(user ? { user } : {}),
  });
}

async function expectCode(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (err) {
    expect((err as { code?: string }).code, String(err)).toBe(code);
    return;
  }
  throw new Error(`expected ${code} but call succeeded`);
}

describe.skipIf(!DB_OK)("integration router", () => {
  beforeAll(async () => {
    const db = getDb();
    const mkUser = async (tag: string): Promise<User> => {
      const unionId = `test-integ-${tag}-${stamp}`;
      await db.delete(users).where(eq(users.unionId, unionId));
      const [r] = await db.insert(users).values({ unionId, name: `Integ ${tag}` });
      const u = await db.query.users.findFirst({ where: eq(users.unionId, unionId) });
      void r;
      return u!;
    };
    ownerA = await mkowner("a");
    ownerB = await mkowner("b");
    async function mkowner(t: string) {
      return mkUser(t);
    }

    // One loopback mock server for github/figma/drive/mcp.
    server = http.createServer((req, res) => {
      authHeadersSeen.push(req.headers.authorization ?? req.headers["x-figma-token"] as string | undefined);
      const url = req.url ?? "";
      const json = (code: number, obj: unknown, headers: Record<string, string> = {}) => {
        res.writeHead(code, { "content-type": "application/json", ...headers });
        res.end(JSON.stringify(obj));
      };
      // GitHub
      if (url === "/gh/user") return json(200, { login: "mock-user" });
      if (url === "/gh/repos/octo/demo") {
        return json(200, {
          full_name: "octo/demo",
          description: "demo",
          default_branch: "main",
          language: "TypeScript",
          license: { spdx_id: "MIT" },
          stargazers_count: 42,
          updated_at: "2026-01-01T00:00:00Z",
          html_url: "https://github.com/octo/demo",
        });
      }
      if (url.startsWith("/gh/repos/octo/demo/git/trees/")) {
        return json(200, { tree: [{ path: "README.md" }, { path: "src/index.ts" }], truncated: false });
      }
      if (url === "/gh/repos/octo/demo/readme") {
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end(README_TEXT);
      }
      if (url === "/gh/repos/octo/private") return json(404, { message: "Not Found" });
      // Figma
      if (url === "/fg/v1/me") return json(200, { email: "u@example.com" });
      if (url.startsWith("/fg/v1/files/")) {
        return json(200, {
          name: "Mock File",
          lastModified: "2026-01-02T00:00:00Z",
          version: "7",
          document: { children: [{}, {}] },
        });
      }
      if (url.startsWith("/gh/") || url.startsWith("/fg/")) return json(404, {});
      // Drive
      if (url.startsWith("/drive/v3/about")) return json(200, { user: { displayName: "Mock" } });
      if (url.startsWith("/drive/v3/files")) {
        return json(200, {
          files: [
            { id: "f1", name: "Doc 1", mimeType: "application/pdf", modifiedTime: "2026-01-01", size: "100" },
          ],
          nextPageToken: "always-more", // forces the page cap to bite
        });
      }
      // MCP (Streamable HTTP: single POST endpoint)
      if (url === "/mcp" && req.method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          let msg: { id?: number; method?: string };
          try {
            msg = JSON.parse(body);
          } catch {
            return json(400, { error: "bad json" });
          }
          mcpMethodsSeen.push(msg.method ?? "?");
          if (msg.method === "initialize") {
            return json(200, {
              jsonrpc: "2.0",
              id: msg.id,
              result: {
                protocolVersion: "2025-03-26",
                capabilities: { tools: {} },
                serverInfo: { name: "mock-mcp", version: "1.0.0" },
              },
            });
          }
          if (msg.method === "notifications/initialized") {
            res.writeHead(202);
            return res.end();
          }
          if (msg.method === "tools/list") {
            return json(200, {
              jsonrpc: "2.0",
              id: msg.id,
              result: {
                tools: [
                  {
                    name: "mock_search",
                    description: "mock tool",
                    inputSchema: { type: "object", properties: { q: { type: "string" } } },
                  },
                ],
              },
            });
          }
          return json(200, {
            jsonrpc: "2.0",
            id: msg.id,
            error: { code: -32601, message: "method not supported" },
          });
        });
        return;
      }
      if (url === "/mcp" && req.method === "DELETE") {
        res.writeHead(200);
        return res.end();
      }
      if (url === "/mcp" && req.method === "GET") {
        // Server does not offer a standalone SSE stream (405 is spec-legal).
        res.writeHead(405);
        return res.end();
      }
      return json(404, { error: "not found" });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    __setConnectorBaseForTests("github", `${base}/gh`);
    __setConnectorBaseForTests("figma", `${base}/fg`);
    __setConnectorBaseForTests("google-drive", base);
  }, 60_000);

  afterAll(async () => {
    __setConnectorBaseForTests("github", null);
    __setConnectorBaseForTests("figma", null);
    __setConnectorBaseForTests("google-drive", null);
    await new Promise((r) => server.close(r));
    const db = getDb();
    const { skillFiles, ownerSettings } = await import("@db/schema");
    for (const u of [ownerA, ownerB]) {
      if (!u) continue;
      await db.delete(integrationDiscoveries).where(eq(integrationDiscoveries.ownerId, u.id));
      await db.delete(integrationRecords).where(eq(integrationRecords.ownerId, u.id));
      await db.delete(ownerSettings).where(eq(ownerSettings.ownerId, u.id));
      const ownedSkills = await db.select({ id: skills.id }).from(skills).where(eq(skills.ownerId, u.id));
      for (const s of ownedSkills) {
        await db.delete(skillFiles).where(eq(skillFiles.skillId, s.id));
      }
      await db.delete(skills).where(eq(skills.ownerId, u.id));
      await db.delete(users).where(eq(users.id, u.id));
    }
  });

  it("stores credentials encrypted; API views contain no secret material", async () => {
    const a = callerFor(ownerA);
    const created = await a.integrations.create({
      provider: "github",
      label: `gh-${stamp}`,
      secret: GH_TOKEN,
    });
    const viewJson = JSON.stringify(created);
    expect(viewJson).not.toContain(GH_TOKEN);
    expect(viewJson).not.toContain("ciphertext");
    expect(viewJson).not.toContain("authTag");

    // Raw DB row has ciphertext, and it is not the plaintext.
    const db = getDb();
    const row = await db.query.integrationRecords.findFirst({
      where: eq(integrationRecords.id, created.record.id),
    });
    expect(row?.ciphertext).toBeTruthy();
    expect(row!.ciphertext).not.toContain(GH_TOKEN);
    expect(row!.ownerId).toBe(ownerA.id);

    // List is owner-scoped and secret-free.
    const listA = await a.integrations.list();
    expect(listA.records.length).toBe(1);
    const listJson = JSON.stringify(listA);
    for (const s of ALL_SECRETS) expect(listJson).not.toContain(s);
    expect(listJson).not.toContain("ciphertext");

    // Owner B sees nothing of A's records.
    const b = callerFor(ownerB);
    const listB = await b.integrations.list();
    expect(listB.records.length).toBe(0);
  });

  it("denies cross-owner access to test/revoke/discover (NOT_FOUND)", async () => {
    const a = callerFor(ownerA);
    const b = callerFor(ownerB);
    const created = await a.integrations.create({
      provider: "figma",
      label: `fg-${stamp}`,
      secret: FIGMA_TOKEN,
    });
    await expectCode(b.integrations.test({ id: created.record.id }), "NOT_FOUND");
    await expectCode(b.integrations.revoke({ id: created.record.id }), "NOT_FOUND");
    await expectCode(b.integrations.figmaFileMeta({ recordId: created.record.id, fileKey: "abc" }), "NOT_FOUND");
    // Revocation is explicit and owner-checked; it deletes the row.
    await a.integrations.revoke({ id: created.record.id });
    const db = getDb();
    const gone = await db.query.integrationRecords.findFirst({
      where: eq(integrationRecords.id, created.record.id),
    });
    expect(gone).toBeUndefined();
  });

  it("requires authentication", async () => {
    const anon = callerFor(undefined);
    await expectCode(anon.integrations.list(), "UNAUTHORIZED");
    await expectCode(
      anon.integrations.create({ provider: "github", label: "x", secret: "y" }),
      "UNAUTHORIZED",
    );
  });

  it("github: public repo inspect works without a token; private 404 maps to not_found", async () => {
    const a = callerFor(ownerA);
    const insp = await a.integrations.githubInspect({ repoUrl: "https://github.com/octo/demo" });
    expect(insp.fullName).toBe("octo/demo");
    expect(insp.readmeSha256).toBe(README_SHA);
    expect(insp.treePaths).toContain("README.md");
    await expectCode(
      a.integrations.githubInspect({ repoUrl: "https://github.com/octo/private" }),
      "BAD_REQUEST",
    );
    // Non-github URLs are refused before any fetch.
    await expectCode(
      a.integrations.githubInspect({ repoUrl: "https://evil.example.com/octo/demo" }),
      "BAD_REQUEST",
    );
  });

  it("github: import requires the reviewed hash and lands in quarantine", async () => {
    const a = callerFor(ownerA);
    // Wrong hash → refused, nothing written.
    await expectCode(
      a.integrations.githubImport({
        repoUrl: "https://github.com/octo/demo",
        expectedReadmeSha256: "0".repeat(64),
      }),
      "CONFLICT",
    );
    const imp = await a.integrations.githubImport({
      repoUrl: "https://github.com/octo/demo",
      expectedReadmeSha256: README_SHA,
    });
    expect(imp.status).toBe("quarantined");
    const db = getDb();
    const skill = await db.query.skills.findFirst({ where: eq(skills.id, imp.id) });
    expect(skill?.status).toBe("quarantined");
    expect(skill?.ownerId).toBe(ownerA.id);
    expect(skill?.provenanceUrl).toBe("https://github.com/octo/demo");
    // Duplicate import conflicts (same name@version).
    await expectCode(
      a.integrations.githubImport({
        repoUrl: "https://github.com/octo/demo",
        expectedReadmeSha256: README_SHA,
      }),
      "CONFLICT",
    );
  });

  it("figma: connection test + file metadata (read-only)", async () => {
    const a = callerFor(ownerA);
    const created = await a.integrations.create({
      provider: "figma",
      label: `fg2-${stamp}`,
      secret: FIGMA_TOKEN,
    });
    const t = await a.integrations.test({ id: created.record.id });
    expect(t.ok).toBe(true);
    const meta = await a.integrations.figmaFileMeta({
      recordId: created.record.id,
      fileKey: "abcDEF123",
    });
    expect(meta.name).toBe("Mock File");
    expect(meta.pageCount).toBe(2);
    await a.integrations.revoke({ id: created.record.id });
  });

  it("drive: list is page-capped and read-only", async () => {
    const a = callerFor(ownerA);
    const created = await a.integrations.create({
      provider: "google-drive",
      label: `gd-${stamp}`,
      secret: DRIVE_TOKEN,
    });
    const t = await a.integrations.test({ id: created.record.id });
    expect(t.ok).toBe(true);
    const listed = await a.integrations.driveList({ recordId: created.record.id, pageSize: 25 });
    // Server always offers another page → exactly 2 pages (the hard cap).
    expect(listed.files.length).toBe(2);
    expect(listed.truncated).toBe(true);
    await a.integrations.revoke({ id: created.record.id });
  });

  it("openai: connection test uses the official SDK (mocked) and stores status only", async () => {
    const a = callerFor(ownerA);
    const created = await a.integrations.create({
      provider: "openai",
      label: `oa-${stamp}`,
      secret: OPENAI_KEY,
    });
    const t = await a.integrations.test({ id: created.record.id });
    expect(t.ok).toBe(true);
    expect(t.models).toContain("gpt-test-1");
    expect(sdkSecretsSeen).toContain(OPENAI_KEY); // used in-memory server-side
    expect(JSON.stringify(t)).not.toContain(OPENAI_KEY); // never returned
    const db = getDb();
    const row = await db.query.integrationRecords.findFirst({
      where: eq(integrationRecords.id, created.record.id),
    });
    expect(row?.lastCheckStatus).toBe("ok");
  });

  it("mcp: allowlist enforced; discovery runs initialize+tools/list only; tools quarantined", async () => {
    const a = callerFor(ownerA);
    // Not on the allowlist yet.
    await expectCode(
      a.integrations.mcpRegister({ label: `mcp-${stamp}`, url: `${base}/mcp` }),
      "FORBIDDEN",
    );
    await a.integrations.mcpSetAllowlist({ hosts: ["127.0.0.1"] });
    const reg = await a.integrations.mcpRegister({
      label: `mcp-${stamp}`,
      url: `${base}/mcp`,
      secret: MCP_BEARER,
    });
    expect(reg.record.provider).toBe("mcp");
    const disc = await a.integrations.mcpDiscover({ id: reg.record.id });
    expect(disc.ok).toBe(true);
    // No tool execution ever happened — only handshake + list + notification.
    expect(mcpMethodsSeen).not.toContain("tools/call");
    for (const m of mcpMethodsSeen) {
      expect(["initialize", "notifications/initialized", "tools/list"]).toContain(m);
    }
    const rows = await a.integrations.discoveries({ recordId: reg.record.id });
    expect(rows.length).toBe(1);
    expect(rows[0]!.status).toBe("quarantined");
    expect(JSON.stringify(rows)).not.toContain(MCP_BEARER);
    // Bearer was actually presented to the server (in the auth header only).
    expect(authHeadersSeen).toContain(`Bearer ${MCP_BEARER}`);
  });

  it("canary: the app log contains no integration secret", async () => {
    // Allow async log writes to flush.
    await new Promise((r) => setTimeout(r, 500));
    let content = "";
    try {
      content = fs.readFileSync(process.env.KIMI_LOG_FILE!, "utf8");
    } catch {
      content = "";
    }
    for (const s of ALL_SECRETS) {
      expect(content.includes(s), `log leaked secret ${s.slice(0, 12)}…`).toBe(false);
    }
  });
});
