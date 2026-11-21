import { describe, expect, it, beforeEach, afterAll } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  newRecordKey,
  vaultAad,
  VaultIntegrityError,
  VaultUnavailable,
} from "./vault";

/**
 * Vault unit tests: round-trip, tamper, wrong-owner/wrong-record AAD,
 * missing/malformed key fail-closed. No DB required.
 */

const TEST_KEY = "a".repeat(64); // 32 bytes hex — test-only, not a real secret
const savedKey = process.env.INTEGRATION_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  if (savedKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
  else process.env.INTEGRATION_ENCRYPTION_KEY = savedKey;
});

describe("vault", () => {
  it("round-trips a secret with AAD binding", () => {
    const aad = vaultAad(1, "openai", newRecordKey());
    const sealed = encryptSecret("sk-test-plaintext", aad);
    expect(sealed.ciphertext).not.toContain("sk-test-plaintext");
    expect(sealed.keyVersion).toBe(1);
    expect(decryptSecret(sealed, aad)).toBe("sk-test-plaintext");
  });

  it("fails closed when the key is missing", () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    expect(() => encryptSecret("x", vaultAad(1, "openai", "k"))).toThrow(VaultUnavailable);
  });

  it("fails closed when the key is malformed", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = "not-a-key";
    expect(() => encryptSecret("x", vaultAad(1, "openai", "k"))).toThrow(VaultUnavailable);
    process.env.INTEGRATION_ENCRYPTION_KEY = "abcd"; // too short hex
    expect(() => encryptSecret("x", vaultAad(1, "openai", "k"))).toThrow(VaultUnavailable);
  });

  it("accepts a base64 32-byte key", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const aad = vaultAad(9, "github", "rec");
    expect(decryptSecret(encryptSecret("tok", aad), aad)).toBe("tok");
  });

  it("rejects tampered ciphertext (GCM auth failure)", () => {
    const aad = vaultAad(1, "github", "rec-1");
    const sealed = encryptSecret("ghp_secret", aad);
    const raw = Buffer.from(sealed.ciphertext, "base64");
    raw[0] = raw[0]! ^ 0xff;
    expect(() =>
      decryptSecret({ ...sealed, ciphertext: raw.toString("base64") }, aad),
    ).toThrow(VaultIntegrityError);
  });

  it("rejects tampered auth tag", () => {
    const aad = vaultAad(1, "github", "rec-1");
    const sealed = encryptSecret("ghp_secret", aad);
    const tag = Buffer.from(sealed.authTag, "base64");
    tag[0] = tag[0]! ^ 0x01;
    expect(() =>
      decryptSecret({ ...sealed, authTag: tag.toString("base64") }, aad),
    ).toThrow(VaultIntegrityError);
  });

  it("rejects decryption under a different owner (AAD binding)", () => {
    const recordKey = newRecordKey();
    const sealed = encryptSecret("sk-owner-a", vaultAad(1, "openai", recordKey));
    expect(() => decryptSecret(sealed, vaultAad(2, "openai", recordKey))).toThrow(
      VaultIntegrityError,
    );
  });

  it("rejects decryption under a different provider or record (AAD binding)", () => {
    const recordKey = newRecordKey();
    const sealed = encryptSecret("sk-owner-a", vaultAad(1, "openai", recordKey));
    expect(() => decryptSecret(sealed, vaultAad(1, "anthropic", recordKey))).toThrow(
      VaultIntegrityError,
    );
    expect(() => decryptSecret(sealed, vaultAad(1, "openai", newRecordKey()))).toThrow(
      VaultIntegrityError,
    );
  });
});
