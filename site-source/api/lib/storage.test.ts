import "dotenv/config";
import { beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { storage } from "./storage";

/**
 * website-storage round-trip (spec §11.2 "Storage"): upload → two independent
 * reads (fileExists/headFile + listFiles) → presigned content match →
 * delete → fileExists false. Uses a clearly labeled integration-test key and
 * always deletes its own object, even on failure. RUN_STORAGE_TESTS=1 is an
 * explicit external-write opt-in. Missing configuration fails an opted-in run;
 * the default suite reports these tests as skipped, never as successful probes.
 *
 * The end-to-end artifact/export flow itself (server module uploading through
 * the engine and the exports router, presigned download matching the recorded
 * content hash) is covered in api/integration.test.ts — OAuth/browser upload
 * is not required by the product (uploads are server-side only).
 */

const stamp = Date.now().toString(36);
const KEY_PREFIX = `itest-storage/${stamp}/`;
const CONTENT =
  `storage round-trip integration test ${stamp}\n` +
  "upload → head/list → presigned match → delete.\n";

describe.skipIf(process.env.RUN_STORAGE_TESTS !== "1")("object storage round-trip (explicit live opt-in)", { timeout: 180_000 }, () => {
  beforeAll(() => {
    for (const name of ["KIMI_AGENTGW_API_KEY", "KIMI_AGENTGW_BASE_URL", "KIMI_STORAGE_RESOURCE_ID"]) {
      expect(!!process.env[name], `RUN_STORAGE_TESTS requires ${name}`).toBe(true);
    }
  });
  it("upload → exists/head → list → presigned match → delete → gone", async () => {
    let savedKey: string | null = null;
    try {
      const up = await storage.uploadFile({
        fileContent: Buffer.from(CONTENT, "utf8"),
        fileName: `${KEY_PREFIX}roundtrip.md`,
        contentType: "text/markdown",
      });
      savedKey = up.key;
      // The SDK appends an 8-char suffix; the hierarchy/extension is kept.
      expect(savedKey.startsWith("itest-storage/")).toBe(true);
      expect(savedKey.endsWith(".md")).toBe(true);
      expect(savedKey.startsWith("http")).toBe(false);

      // Independent read 1: fileExists + headFile metadata.
      expect(await storage.fileExists({ fileKey: savedKey })).toBe(true);
      const head = await storage.headFile({ fileKey: savedKey });
      expect(head.size).toBe(Buffer.byteLength(CONTENT));
      expect(head.contentType).toContain("markdown");

      // Independent read 2: listFiles by prefix shows the object.
      const listed = await storage.listFiles({ prefix: KEY_PREFIX });
      expect(listed.objects.some((o) => o.key === savedKey)).toBe(true);

      // Presigned render: minted at request time, content matches byte-for-byte.
      const { url } = await storage.getPresignedUrl({ key: savedKey });
      expect(url.startsWith("http")).toBe(true);
      const body = await (await fetch(url)).text();
      expect(body).toBe(CONTENT);
      expect(createHash("sha256").update(body).digest("hex")).toBe(
        createHash("sha256").update(CONTENT).digest("hex"),
      );

      // Owner-scoped delete; then the object is really gone.
      expect(await storage.deleteFile({ fileKey: savedKey })).toBe(true);
      savedKey = null;
      expect(await storage.fileExists({ fileKey: up.key })).toBe(false);
    } finally {
      if (savedKey) {
        await storage.deleteFile({ fileKey: savedKey }).catch(() => false);
      }
    }
  });

  it("missing objects report honestly", async () => {
    expect(
      await storage.fileExists({ fileKey: `${KEY_PREFIX}never-uploaded.md` }),
    ).toBe(false);
  });
});
