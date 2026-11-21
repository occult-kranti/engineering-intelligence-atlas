import "dotenv/config";
import { describe, expect, it } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Deployment + secret-canary gates (spec §11.3, §11.1 credential boundaries).
 *
 * 1. The frontend bundle contains no gateway/storage credential VALUES, no
 *    gateway base URL, no direct-provider keys, and no hardcoded gateway
 *    model id (models are discovered at runtime).
 * 2. The server bundle boots from a copied `dist/` + `package.json` with NO
 *    node_modules (the platform deploy shape), serves `/`, and returns the
 *    JSON 404 for unregistered /api/* paths.
 * 3. Root index.html and the documented runtime configuration example exist.
 *    A clean-clone build never requires a private .env file.
 *
 * Requires `npm run build` to have produced dist/ first; fails loudly when
 * dist is missing rather than skipping (this is a release gate).
 */

const root = path.resolve(import.meta.dirname, "..");
const distPublic = path.join(root, "dist", "public");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function bundleText(): string {
  if (!fs.existsSync(distPublic)) {
    throw new Error("dist/public missing — run `npm run build` before this gate");
  }
  return walk(distPublic)
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
}

describe("secret canary (frontend bundle + sources)", () => {
  it("bundle contains no credential values or gateway base URL", async () => {
    const text = bundleText();
    const secretEnvNames = [
      "KIMI_AGENTGW_API_KEY",
      "KIMI_AGENTGW_BASE_URL",
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "APP_SECRET",
      "DATABASE_URL",
    ];
    for (const name of secretEnvNames) {
      const value = process.env[name];
      if (value) {
        expect(text.includes(value), `bundle must not contain ${name} value`).toBe(false);
      }
      // The variable names themselves must not appear in client code either.
      expect(text.includes(name), `bundle must not reference ${name}`).toBe(false);
    }
    // No key-shaped strings leaked (defense in depth). Tailwind arbitrary
    // properties (sk-image-b-from-color etc.) use hyphens, so require a long
    // uninterrupted alphanumeric run like a real API key.
    expect(/\bsk-[A-Za-z0-9]{20,}/.test(text)).toBe(false);
  });

  it("bundle contains no hardcoded gateway model id", async () => {
    const text = bundleText();
    // Model ids are discovered at runtime via listModels(); none may be baked
    // into the client bundle. Check the live default id plus known patterns.
    if (process.env.RUN_LIVE_AI_TESTS === "1" && process.env.KIMI_AGENTGW_API_KEY) {
      const { listGatewayModels } = await import("./ai/list-models");
      const list = await listGatewayModels();
      for (const m of list.models) {
        expect(
          text.includes(m.id),
          `gateway model id "${m.id}" must not be hardcoded in the bundle`,
        ).toBe(false);
      }
    }
    expect(/kimi-k\d|moonshot-v\d|\bk3-agent\b|\bk2d8/.test(text)).toBe(false);
  });

  it("server sources never embed credential values", () => {
    const files = walk(path.join(root, "api")).filter((f) => f.endsWith(".ts"));
    const text = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
    for (const name of ["KIMI_AGENTGW_API_KEY", "APP_SECRET", "DATABASE_URL"]) {
      const value = process.env[name];
      if (value) {
        expect(text.includes(value), `${name} value hardcoded in api/`).toBe(false);
      }
    }
  });
});

describe("deploy shape (spec §11.3)", () => {
  it("root index.html and a credential-free runtime configuration example exist", () => {
    expect(fs.existsSync(path.join(root, "index.html"))).toBe(true);
    const envText = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    for (const name of ["APP_ID", "APP_SECRET", "DATABASE_URL", "KIMI_AUTH_URL", "KIMI_OPEN_URL"]) {
      expect(envText.split("\n")).toContain(`${name}=`);
    }
  });

  it(
    "node dist/boot.js boots from copied dist+package.json with no node_modules",
    { timeout: 120_000 },
    async () => {
      const bootJs = path.join(root, "dist", "boot.js");
      if (!fs.existsSync(bootJs)) {
        throw new Error("dist/boot.js missing — run `npm run build` first");
      }
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "boot-gate-"));
      try {
        execFileSync("cp", ["-r", path.join(root, "dist"), tmp]);
        execFileSync("cp", [path.join(root, "package.json"), tmp]);
        expect(fs.existsSync(path.join(tmp, "node_modules"))).toBe(false);

        const port = 3210;
        const child = spawn("node", ["dist/boot.js"], {
          cwd: tmp,
          env: {
            ...process.env,
            NODE_ENV: "production",
            PORT: String(port),
            // Boot/auth-denial assertions need no connected services. These
            // child-only fixtures never reach a database, provider or OAuth host.
            APP_ID: "deployment-test-app",
            APP_SECRET: "deployment-test-secret-not-for-real-use",
            DATABASE_URL: "mysql://test:test@127.0.0.1:1/unreachable",
            KIMI_AUTH_URL: "https://oauth.invalid",
            KIMI_OPEN_URL: "https://api.invalid",
          },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";
        child.stderr.on("data", (d) => (stderr += String(d)));
        try {
          // Wait for the server to answer.
          const t0 = Date.now();
          let html = "";
          for (;;) {
            try {
              const res = await fetch(`http://127.0.0.1:${port}/`);
              expect(res.status).toBe(200);
              html = await res.text();
              break;
            } catch (err) {
              if (Date.now() - t0 > 30_000) {
                throw new Error(
                  `bundle did not serve / within 30s: ${(err as Error).message}\nstderr: ${stderr}`,
                );
              }
              await new Promise((r) => setTimeout(r, 500));
            }
          }
          expect(html).toContain("<div id=\"root\">");
          // Unregistered API paths return the JSON 404 (registration order).
          const miss = await fetch(`http://127.0.0.1:${port}/api/definitely-not-registered`);
          expect(miss.status).toBe(404);
          expect(await miss.json()).toEqual({ error: "Not Found" });
          // tRPC endpoint is mounted (unauthenticated → JSON error, not 404).
          const trpcRes = await fetch(`http://127.0.0.1:${port}/api/trpc/projects.list`);
          expect([400, 401]).toContain(trpcRes.status);
          // REST export download route (spec §9.3): registered above the 404
          // catch-all; unauthenticated → 401, never 404.
          const exRes = await fetch(
            `http://127.0.0.1:${port}/api/exports/1/download`,
            { redirect: "manual" },
          );
          expect(exRes.status).toBe(401);
        } finally {
          child.kill("SIGTERM");
        }
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    },
  );
});
