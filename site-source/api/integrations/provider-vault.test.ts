import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { z } from "zod";
import { eq } from "drizzle-orm";

/**
 * Provider-adapter vault use: the openai adapter must resolve the owner's
 * stored credential server-side (in preference to env), fall back to env
 * when no owner is attached, and report availability accordingly. The AI SDK
 * modules are mocked so no real provider call happens.
 */

process.env.INTEGRATION_ENCRYPTION_KEY = "d".repeat(64);

const hoisted = vi.hoisted(() => ({
  generateObject: vi.fn(async () => ({ object: { ok: true }, usage: {} })),
  openaiKeys: [] as (string | undefined)[],
}));
vi.mock("ai", () => ({ generateObject: hoisted.generateObject }));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: (opts: { apiKey?: string }) => {
    hoisted.openaiKeys.push(opts.apiKey);
    return (model: string) => ({ model });
  },
}));

const { getProvider } = await import("../ai/provider");
const { getDb } = await import("../queries/connection");
const { users, integrationRecords } = await import("@db/schema");
const { createRecord } = await import("./store");
type User = typeof users.$inferSelect;

const DB_OK = process.env.RUN_DATABASE_TESTS === "1";
const stamp = Date.now().toString(36);
const VAULT_KEY = `sk-vault-canary-${stamp}`;
let owner: User;

describe.skipIf(!DB_OK)("provider adapter vault use", () => {
  beforeAll(async () => {
    expect(process.env.DATABASE_URL, "RUN_DATABASE_TESTS requires an isolated DATABASE_URL").toBeTruthy();
    const db = getDb();
    const unionId = `test-provault-${stamp}`;
    await db.delete(users).where(eq(users.unionId, unionId));
    await db.insert(users).values({ unionId, name: "ProvVault" });
    owner = (await db.query.users.findFirst({ where: eq(users.unionId, unionId) }))!;
    await createRecord({
      ownerId: owner.id,
      provider: "openai",
      label: `pv-${stamp}`,
      secret: VAULT_KEY,
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(integrationRecords).where(eq(integrationRecords.ownerId, owner.id));
    await db.delete(users).where(eq(users.id, owner.id));
  });

  it("uses the owner's vault credential when ownerId is attached", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.OPENAI_MODEL = "gpt-test-model";
    const provider = await getProvider("openai");
    const res = await provider.generateStructured({
      system: "s",
      prompt: "p",
      schema: z.object({ ok: z.boolean() }),
      maxOutputTokens: 10,
      ownerId: owner.id,
    });
    expect(res.object).toEqual({ ok: true });
    expect(hoisted.openaiKeys.at(-1)).toBe(VAULT_KEY);
  });

  it("falls back to the server env key without an ownerId", async () => {
    process.env.OPENAI_API_KEY = "sk-env-fallback";
    const provider = await getProvider("openai");
    await provider.generateStructured({
      system: "s",
      prompt: "p",
      schema: z.object({ ok: z.boolean() }),
      maxOutputTokens: 10,
    });
    expect(hoisted.openaiKeys.at(-1)).toBe("sk-env-fallback");
    delete process.env.OPENAI_API_KEY;
  });

  it("availabilityFor is vault-aware (env key absent, vault key present)", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.OPENAI_MODEL = "gpt-test-model";
    const provider = await getProvider("openai");
    expect(provider.availability().configured).toBe(false); // env-only view
    const forOwner = await provider.availabilityFor!(owner.id);
    expect(forOwner.configured).toBe(true);
  });
});
