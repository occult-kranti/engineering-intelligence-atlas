import "dotenv/config";
import { describe, expect, it, vi, afterEach } from "vitest";
import { generateText } from "ai";
import { ArtifactObjectSchema } from "@contracts/artifacts";
import { AI_ERROR_COPY } from "@contracts/run";
import { getProvider } from "./provider";
import { listGatewayModels } from "./list-models";
import { AiUnavailable } from "./ai-client";
import { mapAiErr } from "../routers/planning";

/**
 * Gateway AI SDK path (spec §8.4, §11.2 "AI integration").
 *
 * - attribution: captured outbound requests carry X-Kimi-App-Id === APP_ID;
 * - degradation mapping: mocked quota/auth/5xx responses map to typed errors
 *   (and to the mapped UI copy via mapAiErr);
 * - no automatic billed retries: a mocked 5xx produces exactly ONE outbound
 *   call (maxRetries: 0);
 * - real smoke: exactly one tiny billed generateText against the provisioned
 *   gateway (skipped when unprovisioned). listModels is read-only/free.
 */

const PROVISIONED = !!(
  process.env.KIMI_AGENTGW_API_KEY && process.env.KIMI_AGENTGW_BASE_URL
);

const VALID_OBJECT = JSON.stringify({
  title: "smoke",
  summary: "s",
  markdown: "# t\n\n## Summary\n\nx",
  keyFindings: [],
  limitations: [],
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function completionResponse(content: string): Response {
  return jsonResponse(200, {
    id: "chatcmpl-mock",
    object: "chat.completion",
    created: 1_700_000_000,
    model: "mock-gateway-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
  });
}

interface CapturedCall {
  url: string;
  appId: string | null;
  authorization: string | null;
}

function captureFetch(impl: (url: string) => Response | Promise<Response>) {
  const calls: CapturedCall[] = [];
  const spy = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      appId: headers.get("x-kimi-app-id"),
      authorization: headers.get("authorization"),
    });
    return impl(url);
  });
  vi.stubGlobal("fetch", spy);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gateway attribution + degradation (mocked HTTP capture)", () => {
  it.skipIf(!PROVISIONED)(
    "generateStructured sends X-Kimi-App-Id === APP_ID and returns structured output",
    async () => {
      const calls = captureFetch(() => completionResponse(VALID_OBJECT));
      const provider = await getProvider("gateway");
      const res = await provider.generateStructured({
        system: "ARTIFACT_TYPE: research-brief",
        prompt: "NODE_GOAL: header capture test",
        schema: ArtifactObjectSchema,
        maxOutputTokens: 512,
        model: "capture-model", // mocked endpoint echoes anything
      });
      expect(calls.length).toBe(1);
      expect(calls[0]!.url.startsWith(process.env.KIMI_AGENTGW_BASE_URL!)).toBe(true);
      expect(calls[0]!.appId).toBe(process.env.APP_ID);
      expect(calls[0]!.appId!.length).toBeGreaterThan(0);
      expect(calls[0]!.authorization).toBe(
        `Bearer ${process.env.KIMI_AGENTGW_API_KEY}`,
      );
      expect(res.object).toMatchObject({ title: "smoke" });
      expect(res.usage.promptTokens).toBe(11);
    },
  );

  it.skipIf(!PROVISIONED)(
    "403 access_terminated_error (schema-conforming body) → AiUnavailable → quota copy",
    async () => {
      captureFetch(() =>
        jsonResponse(403, {
          error: { type: "access_terminated_error", message: "quota exhausted" },
        }),
      );
      const provider = await getProvider("gateway");
      const err = await provider
        .generateStructured({
          system: "s",
          prompt: "p",
          schema: ArtifactObjectSchema,
          maxOutputTokens: 64,
          model: "capture-model",
        })
        .catch((e) => e);
      expect(err).toBeInstanceOf(AiUnavailable);
      const trpcErr = mapAiErr(err);
      expect(trpcErr.message).toBe(AI_ERROR_COPY.AiUnavailable);
      expect(trpcErr.message).toContain("额度耗尽");
    },
  );

  it.skipIf(!PROVISIONED)(
    "403 access_terminated_error with non-schema body still maps via responseBody fallback",
    async () => {
      captureFetch(() =>
        jsonResponse(403, { error: { type: "access_terminated_error" } }),
      );
      const provider = await getProvider("gateway");
      const err = await provider
        .generateStructured({
          system: "s",
          prompt: "p",
          schema: ArtifactObjectSchema,
          maxOutputTokens: 64,
          model: "capture-model",
        })
        .catch((e) => e);
      expect(err).toBeInstanceOf(AiUnavailable);
    },
  );

  it.skipIf(!PROVISIONED)(
    "mocked 5xx on a billable call → AiTransient with exactly ONE outbound request (no auto-retry)",
    async () => {
      const calls = captureFetch(() =>
        jsonResponse(500, { error: { message: "boom" } }),
      );
      const provider = await getProvider("gateway");
      const err = await provider
        .generateStructured({
          system: "s",
          prompt: "p",
          schema: ArtifactObjectSchema,
          maxOutputTokens: 64,
          model: "capture-model",
        })
        .catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).name).toBe("AiTransient");
      expect(calls.length).toBe(1); // maxRetries: 0 — billed work is never re-sent
    },
  );
});

describe("real gateway (provisioned)", () => {
  it.skipIf(!PROVISIONED)(
    "listModels returns a live defaultModelId (read-only, excluded from budget accounting)",
    async () => {
      const list = await listGatewayModels(true);
      expect(list.defaultModelId.length).toBeGreaterThan(0);
      expect(list.models.some((m) => m.id === list.defaultModelId)).toBe(true);
    },
  );

  it.skipIf(!PROVISIONED)(
    "smoke: ONE tiny billed generateText through the attributed factory (maxRetries 0)",
    { timeout: 120_000 },
    async () => {
      const { kimiGw } = await import("./provider-factory");
      const list = await listGatewayModels();
      const res = await generateText({
        model: kimiGw(list.defaultModelId),
        prompt: "Reply with exactly one word: ok",
        // Reasoning models (e.g. k3-agent) spend part of the output budget on
        // reasoning tokens; 64 leaves room for both reasoning and the word.
        maxOutputTokens: 64,
        maxRetries: 0, // smoke test honors the no-auto-retry rule too
      });
      expect(res.text.trim().length).toBeGreaterThan(0);
      console.log(
        `smoke ok: model=${list.defaultModelId} usage=${JSON.stringify(res.usage)}`,
      );
    },
  );
});
