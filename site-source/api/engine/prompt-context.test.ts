import { describe, expect, it, vi } from "vitest";
import { defaultNodeBudget, defaultTermination, type NodeSpec } from "@contracts/dag";
import { buildPromptContext, CompiledPromptCache, MAX_HANDOFF_CHARACTERS, MAX_SKILL_CHARACTERS } from "./prompt-context";
import { memoizeValidationContext } from "./context";

const run = { id: 7, startedBy: 4, provider: "openai", model: "operator-model" };
const node: NodeSpec = {
  key: "research", role: "Research Scientist", goal: "Compare the evidence",
  skill: { name: "research", version: "1", sha256: "a".repeat(64) },
  inputArtifactTypes: [], outputArtifactType: "research-brief",
  toolsAllowed: ["read"], resourceUrls: [], budget: defaultNodeBudget(), termination: defaultTermination(),
};

describe("bounded compiled prompt cache", () => {
  it("reuses stable instructions while keeping each goal and run outside the cache", () => {
    const cache = new CompiledPromptCache();
    const first = buildPromptContext(run, node, "Reviewed source", [], cache);
    const next = buildPromptContext({ ...run, id: 8 }, { ...node, goal: "A different goal" }, "Reviewed source", [], cache);
    expect(first.diagnostics.compiledPrefixHit).toBe(false);
    expect(next.diagnostics.compiledPrefixHit).toBe(true);
    expect(next.system).toBe(first.system);
    expect(first.system).not.toContain(node.goal);
    expect(next.prompt).toContain("NODE_GOAL: A different goal");
    expect(next.diagnostics.requestSha256).not.toBe(first.diagnostics.requestSha256);
  });

  it("invalidates on owner, provider, model, pinned version, and actual source content", () => {
    const cache = new CompiledPromptCache();
    buildPromptContext(run, node, "Source", [], cache);
    for (const changed of [{ ...run, startedBy: 5 }, { ...run, provider: "anthropic" }, { ...run, model: "other" }]) {
      expect(buildPromptContext(changed, node, "Source", [], cache).diagnostics.compiledPrefixHit).toBe(false);
    }
    expect(buildPromptContext(run, { ...node, skill: { ...node.skill, version: "2" } }, "Source", [], cache).diagnostics.compiledPrefixHit).toBe(false);
    expect(buildPromptContext(run, node, "Changed source under the same pin", [], cache).diagnostics.compiledPrefixHit).toBe(false);
  });

  it("expires entries without extending TTL on a read and evicts the least recently used", () => {
    let now = 0;
    const cache = new CompiledPromptCache(2, 100, 10, () => now);
    cache.getOrCompile("a", () => "A");
    cache.getOrCompile("b", () => "B");
    now = 5;
    expect(cache.getOrCompile("a", () => "changed").hit).toBe(true);
    cache.getOrCompile("c", () => "C");
    expect(cache.getOrCompile("b", () => "B2").hit).toBe(false);
    now = 10;
    expect(cache.getOrCompile("a", () => "A2").hit).toBe(false);
    expect(cache.size).toBeLessThanOrEqual(2);
  });

  it("accounts UTF-8 bytes and does not store an oversized entry", () => {
    const cache = new CompiledPromptCache(10, 8);
    cache.getOrCompile("a", () => "猫猫"); // 7 bytes, including key
    cache.getOrCompile("b", () => "猫猫");
    expect(cache.size).toBe(1);
    expect(cache.getOrCompile("huge", () => "猫猫猫").hit).toBe(false);
    expect(cache.getOrCompile("huge", () => "猫猫猫").hit).toBe(false);
    expect(cache.size).toBe(1);
  });

  it("deduplicates handoffs, keeps full hashes, and gives equivalent references stable order", () => {
    const a = { id: 1, nodeKey: "a", title: "One", summary: "Verified summary", sha256: "c".repeat(64) };
    const b = { ...a, id: 2, nodeKey: "b", title: "Two" };
    const first = buildPromptContext(run, node, "Source", [b, a, a]);
    const next = buildPromptContext(run, node, "Source", [a, b]);
    expect(first.prompt).toBe(next.prompt);
    expect(first.diagnostics.acceptedReferenceCount).toBe(2);
    expect(first.prompt).toContain(a.sha256);
    expect(first.prompt.indexOf('"node":"a"')).toBeLessThan(first.prompt.indexOf('"node":"b"'));
  });

  it("rejects oversize skills and summaries instead of silently removing evidence", () => {
    expect(() => buildPromptContext(run, node, "s".repeat(MAX_SKILL_CHARACTERS + 1), [])).toThrow("Pinned skill body");
    expect(() => buildPromptContext(run, node, "source", [{ id: 1, nodeKey: "a", title: "Evidence", summary: "s".repeat(MAX_HANDOFF_CHARACTERS), sha256: "a".repeat(64) }])).toThrow("Accepted artifact summaries");
  });
});

it("coalesces concurrent validation lookups only within their request", async () => {
  const source = { resolveSkill: vi.fn(async () => null), roleExists: vi.fn(async () => true), resourceExists: vi.fn(async () => true) };
  const first = memoizeValidationContext(source);
  await Promise.all([first.resolveSkill("a", "1"), first.resolveSkill("a", "1"), first.roleExists("role"), first.roleExists("role"), first.resourceExists("url"), first.resourceExists("url")]);
  expect(source.resolveSkill).toHaveBeenCalledTimes(1);
  expect(source.roleExists).toHaveBeenCalledTimes(1);
  expect(source.resourceExists).toHaveBeenCalledTimes(1);
  await first.resolveSkill("a", "2");
  await memoizeValidationContext(source).resolveSkill("a", "1");
  expect(source.resolveSkill).toHaveBeenCalledTimes(3);
});
