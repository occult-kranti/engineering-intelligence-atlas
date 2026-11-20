import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Canary tests (no DB): secrets must never cross into the client bundle,
 * browser storage, or persisted event/artifact payloads.
 *
 *  - the client tree (src/) must not reference the server vault key or import
 *    the vault/store/http modules (they import node:crypto/node:https and
 *    would also fail the browser build — this test fails first, loudly);
 *  - the Integrations UI must not persist secrets in localStorage etc.;
 *  - the tRPC router's record view must not select ciphertext columns;
 *  - if a build exists in dist/public, scan it for the vault key env name.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("secret canaries", () => {
  it("client source never references the vault key or server-only modules", () => {
    for (const file of walk(path.join(ROOT, "src"))) {
      const text = fs.readFileSync(file, "utf8");
      expect(text, file).not.toContain("INTEGRATION_ENCRYPTION_KEY");
      expect(text, file).not.toContain("api/integrations/vault");
      expect(text, file).not.toContain("api/integrations/store");
    }
  });

  it("Integrations UI never touches browser storage or event sinks for secrets", () => {
    const text = fs.readFileSync(
      path.join(ROOT, "src/views/director/Integrations.tsx"),
      "utf8",
    );
    expect(text).not.toMatch(/localStorage|sessionStorage|indexedDB/i);
    expect(text).not.toMatch(/document\.cookie/);
    // Credential inputs are write-only password fields.
    expect(text).toContain('type="password"');
  });

  it("API record view structurally excludes ciphertext fields", () => {
    const store = fs.readFileSync(path.join(ROOT, "api/integrations/store.ts"), "utf8");
    const toView = store.slice(store.indexOf("export function toView"));
    const viewBody = toView.slice(0, toView.indexOf("\n}"));
    for (const forbidden of ["ciphertext", "authTag", ".iv", "recordKey"]) {
      expect(viewBody, `toView must not expose ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("built client bundle contains no vault key reference (when dist exists)", () => {
    const dist = path.join(ROOT, "dist/public");
    if (!fs.existsSync(dist)) return; // pre-build run — source scans above still apply
    for (const file of walk(dist)) {
      const text = fs.readFileSync(file, "utf8");
      expect(text, file).not.toContain("INTEGRATION_ENCRYPTION_KEY");
    }
  });
});
