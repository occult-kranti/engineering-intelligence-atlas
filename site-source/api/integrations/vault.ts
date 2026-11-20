import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";

/**
 * Integration credential vault — AES-256-GCM, server-only key.
 *
 * Security contract:
 *  - Key comes ONLY from process.env.INTEGRATION_ENCRYPTION_KEY (64 hex chars
 *    or base64, decoding to 32 bytes). It is never read from the DB, never
 *    accepted from a client, never logged, never sent to the browser.
 *  - Fail closed: if the key is missing or malformed, every vault operation
 *    throws VaultUnavailable. There is no fallback key and no plaintext path.
 *  - AAD binds owner + provider + recordKey: a ciphertext copied to another
 *    owner, provider, or record row fails GCM authentication on decrypt.
 *  - The plaintext exists only inside encrypt/decrypt call frames; callers
 *    must never log it or return it from a procedure.
 */

export class VaultUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultUnavailable";
  }
}

export class VaultIntegrityError extends Error {
  constructor(message = "ciphertext failed integrity/authenticity check") {
    super(message);
    this.name = "VaultIntegrityError";
  }
}

export const VAULT_KEY_VERSION = 1;

function loadKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw || raw.trim() === "") {
    throw new VaultUnavailable(
      "INTEGRATION_ENCRYPTION_KEY is not set — credential storage is disabled (fail closed)",
    );
  }
  const trimmed = raw.trim();
  let key: Buffer | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    key = Buffer.from(trimmed, "hex");
  } else {
    try {
      const b = Buffer.from(trimmed, "base64");
      if (b.length === 32) key = b;
    } catch {
      key = null;
    }
  }
  if (!key || key.length !== 32) {
    throw new VaultUnavailable(
      "INTEGRATION_ENCRYPTION_KEY is malformed — expected 32 bytes as 64 hex chars or base64",
    );
  }
  return key;
}

/** AAD for a record: binds owner, provider, and the immutable record key. */
export function vaultAad(ownerId: number, provider: string, recordKey: string): string {
  return `integration:v${VAULT_KEY_VERSION}:${ownerId}:${provider}:${recordKey}`;
}

export interface VaultCiphertext {
  ciphertext: string; // base64
  iv: string; // base64, 12-byte nonce
  authTag: string; // base64, 16-byte tag
  keyVersion: number;
}

export function encryptSecret(plaintext: string, aad: string): VaultCiphertext {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ct.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: VAULT_KEY_VERSION,
  };
}

export function decryptSecret(
  stored: { ciphertext: string; iv: string; authTag: string },
  aad: string,
): string {
  const key = loadKey();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(stored.iv, "base64"));
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(stored.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(stored.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // GCM auth failure covers tamper AND wrong-owner/wrong-record AAD.
    throw new VaultIntegrityError();
  }
}

/** Mint the immutable record key bound into the AAD (uuid v4). */
export function newRecordKey(): string {
  return randomUUID();
}
