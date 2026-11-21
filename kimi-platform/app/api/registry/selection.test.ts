import { describe, expect, it } from "vitest";
import type { LinkedResource } from "@contracts/registry";
import { goalKeywords, selectRoleResources, triggerMatches } from "./selection";

/**
 * Role/goal-relevant resource selection: deterministic ordering
 * (core → trigger-matched conditional → internal), stale exclusion, and caps.
 */

let seq = 0;
function link(over: Partial<LinkedResource> = {}): LinkedResource {
  seq += 1;
  return {
    linkId: `RL-${String(seq).padStart(4, "0")}`,
    roleSlug: "research-scientist",
    url: `https://example.org/r${seq}`,
    name: `Resource ${seq}`,
    domain: "Testing",
    type: "Documentation",
    flag: "core",
    tier: "core",
    evidence: "E3",
    access: "Free",
    license: "CC-BY",
    trigger: "",
    stale: false,
    ...over,
  };
}

describe("trigger matching", () => {
  it("matches a conditional trigger on significant goal keywords only", () => {
    const goal = goalKeywords("Design the mobile onboarding flow for Android");
    expect(triggerMatches("mobile UX patterns", goal)).toBe(true);
    expect(triggerMatches("mainframe modernization", goal)).toBe(false);
    expect(triggerMatches("", goal)).toBe(false);
    // stopwords / short tokens alone never match
    expect(triggerMatches("the and for", goal)).toBe(false);
  });
});

describe("selectRoleResources", () => {
  it("orders core before trigger-matched conditional before internal", () => {
    const links = [
      link({ flag: "internal", name: "Internal literacy doc" }),
      link({ flag: "conditional", name: "Kubernetes scaling guide", trigger: "kubernetes rollout" }),
      link({ flag: "core", name: "Core craft handbook" }),
    ];
    const sel = selectRoleResources(links, "plan the kubernetes rollout");
    expect(sel.selected.map((s) => s.flag)).toEqual(["core", "conditional", "internal"]);
    expect(sel.selected[1]!.triggerMatched).toBe(true);
  });

  it("excludes conditional links whose trigger does not match, with a count", () => {
    const links = [
      link({ flag: "core" }),
      link({ flag: "conditional", trigger: "kubernetes rollout" }),
      link({ flag: "conditional", trigger: "mainframe migration" }),
    ];
    const sel = selectRoleResources(links, "write a research brief on batteries");
    expect(sel.selected).toHaveLength(1);
    expect(sel.excludedConditionalCount).toBe(2);
  });

  it("excludes stale (E0-stale / flagged) resources and reports them explicitly", () => {
    const links = [
      link({ flag: "core", name: "Good" }),
      link({ flag: "core", name: "Dead link", stale: true }),
      link({ flag: "core", name: "404 evidence", evidence: "E0-stale" }),
    ];
    const sel = selectRoleResources(links, "any goal");
    expect(sel.selected.map((s) => s.name)).toEqual(["Good"]);
    expect(sel.excludedStale.map((s) => s.name).sort()).toEqual(["404 evidence", "Dead link"]);
  });

  it("ranks goal-relevant, better-evidence resources higher within a flag", () => {
    const links = [
      link({ name: "Unrelated cookbook", evidence: "E2", tier: "advanced" }),
      link({ name: "Battery recycling economics survey", evidence: "E3", tier: "core" }),
    ];
    const sel = selectRoleResources(links, "battery recycling economics");
    expect(sel.selected[0]!.name).toBe("Battery recycling economics survey");
    expect(sel.selected[0]!.relevance).toBeGreaterThan(sel.selected[1]!.relevance);
  });

  it("applies the deterministic cap and de-dupes by URL", () => {
    const dup = link({ name: "Dup A", url: "https://example.org/same" });
    const links = [
      dup,
      { ...dup, linkId: "RL-9999" },
      ...Array.from({ length: 12 }, () => link()),
    ];
    const sel = selectRoleResources(links, "goal", { maxResources: 8 });
    expect(sel.selected).toHaveLength(8);
    expect(new Set(sel.selected.map((s) => s.url)).size).toBe(8);
  });

  it("is byte-identical across repeated runs (determinism)", () => {
    const links = Array.from({ length: 20 }, (_, i) =>
      link({
        flag: i % 3 === 0 ? "internal" : i % 3 === 1 ? "core" : "conditional",
        trigger: "mobile android",
        evidence: i % 2 ? "E3" : "E2",
      }),
    );
    const a = selectRoleResources(links, "mobile android study");
    const b = selectRoleResources(links, "mobile android study");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
