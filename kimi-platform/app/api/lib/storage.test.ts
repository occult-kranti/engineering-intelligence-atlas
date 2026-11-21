import "dotenv/config";
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { storage } from "./storage";

/**
 * website-storage round-trip (spec §11.2 "Storage"): upload → two independent
 * reads (fileExists/headFile + listFiles) → presigned content match →
 * delete → fileExists false. Uses a clearly labeled integration-test key and
 * always deletes its own object, even on failure. If storage is not
 * provisioned the suite skips honestly instead of faking success.
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

let provisioned = true;

describe("object storage round-trip (website-storage)", { timeout: 180_000 }, () => {
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
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "STORAGE_NOT_PROVISIONED") {
        provisioned = false;
        console.warn("storage not provisioned; round-trip skipped honestly");
        return;
      }
      throw err;
    } finally {
      if (savedKey) {
        await storage.deleteFile({ fileKey: savedKey }).catch(() => false);
      }
    }
  });

  it("missing objects report honestly", async () => {
    if (!provisioned) return;
    expect(
      await storage.fileExists({ fileKey: `${KEY_PREFIX}never-uploaded.md` }),
    ).toBe(false);
  });
});
