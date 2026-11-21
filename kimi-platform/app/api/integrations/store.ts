import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../queries/connection";
import { integrationRecords, type IntegrationRecord } from "@db/schema";
import type { IntegrationProvider, IntegrationRecordView } from "@contracts/integrations";
import { decryptSecret, encryptSecret, newRecordKey, vaultAad } from "./vault";

/**
 * Credential store: the only module that touches ciphertext columns.
 * Every read for API output goes through toView(), which structurally
 * cannot contain ciphertext, iv, authTag, or any part of the secret.
 */

export function toView(row: IntegrationRecord): IntegrationRecordView {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    metadata: row.metadata ?? {},
    lastCheckStatus: row.lastCheckStatus,
    lastCheckErrorClass: row.lastCheckErrorClass,
    lastCheckAt: row.lastCheckAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listOwnedRecords(ownerId: number): Promise<IntegrationRecord[]> {
  return getDb()
    .select()
    .from(integrationRecords)
    .where(eq(integrationRecords.ownerId, ownerId))
    .orderBy(desc(integrationRecords.createdAt));
}

export async function createRecord(input: {
  ownerId: number;
  provider: IntegrationProvider;
  label: string;
  /** null for MCP servers registered without a bearer credential. */
  secret: string | null;
  metadata?: Record<string, unknown>;
}): Promise<IntegrationRecord> {
  const recordKey = newRecordKey();
  // AAD binds owner/provider/record BEFORE the row exists.
  const aad = vaultAad(input.ownerId, input.provider, recordKey);
  const sealed = input.secret !== null ? encryptSecret(input.secret, aad) : null;
  const [row] = await getDb()
    .insert(integrationRecords)
    .values({
      ownerId: input.ownerId,
      provider: input.provider,
      label: input.label,
      recordKey,
      ciphertext: sealed?.ciphertext ?? null,
      iv: sealed?.iv ?? "",
      authTag: sealed?.authTag ?? "",
      keyVersion: sealed?.keyVersion ?? 0,
      metadata: input.metadata ?? {},
      lastCheckStatus: "unchecked",
    });
  const created = await getDb().query.integrationRecords.findFirst({
    where: eq(integrationRecords.id, Number(row.insertId)),
  });
  if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return created;
}

/** Owner-scoped fetch. Cross-owner access is indistinguishable from absence. */
export async function getOwnedRecord(ownerId: number, id: number): Promise<IntegrationRecord> {
  const row = await getDb().query.integrationRecords.findFirst({
    where: and(eq(integrationRecords.id, id), eq(integrationRecords.ownerId, ownerId)),
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "integration not found" });
  return row;
}

/** Decrypts the record's secret in-memory for one server-side connector call. */
export function decryptRecordSecret(row: IntegrationRecord): string | null {
  if (row.ciphertext === null) return null;
  return decryptSecret(
    { ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag },
    vaultAad(row.ownerId, row.provider, row.recordKey),
  );
}

export async function deleteOwnedRecord(ownerId: number, id: number): Promise<void> {
  await getOwnedRecord(ownerId, id); // ownership check
  await getDb()
    .delete(integrationRecords)
    .where(and(eq(integrationRecords.id, id), eq(integrationRecords.ownerId, ownerId)));
}

export async function recordCheckOutcome(
  ownerId: number,
  id: number,
  ok: boolean,
  errorClass: string | null,
): Promise<void> {
  await getDb()
    .update(integrationRecords)
    .set({
      lastCheckStatus: ok ? "ok" : "failed",
      lastCheckErrorClass: ok ? null : errorClass,
      lastCheckAt: new Date(),
    })
    .where(and(eq(integrationRecords.id, id), eq(integrationRecords.ownerId, ownerId)));
}

/**
 * AI provider adapter hook: returns the owner's stored API key for
 * openai/anthropic, or undefined when the owner has no record (callers then
 * fall back to server env). Used ONLY server-side by provider adapters.
 */
export async function resolveVaultApiKey(
  provider: "openai" | "anthropic",
  ownerId: number,
): Promise<string | undefined> {
  const rows = await getDb()
    .select()
    .from(integrationRecords)
    .where(and(eq(integrationRecords.ownerId, ownerId), eq(integrationRecords.provider, provider)))
    .orderBy(desc(integrationRecords.updatedAt))
    .limit(1);
  const row = rows[0];
  if (!row || row.ciphertext === null) return undefined;
  return decryptSecret(
    { ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag },
    vaultAad(ownerId, provider, row.recordKey),
  );
}
