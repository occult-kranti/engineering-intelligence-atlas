import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "path";
import {
  ALL_DISCIPLINE_SKILL_IDS,
  DISCIPLINE_SKILLS,
  ENTERPRISE_ACTIONS,
  ENTERPRISE_CONTRACT_VERSION,
  EnterpriseBlueprintSchema,
  EnterpriseContractError,
  HandoffManifestSchema,
  PERMANENT_STEWARD_ROLES,
  PERMANENT_STEWARD_ROLE_NAMES,
  StewardRecommendationSchema,
  TimelineIndexEntrySchema,
  WorkLedgerEntrySchema,
  blueprintHash,
  canonicalJson,
  deriveEnterpriseView,
  deriveTimelineIndex,
  generateEnterpriseBlueprint,
  partitionBudget,
  sha256Hex,
  type EnterpriseBlueprint,
  type GenerateBlueprintInput,
  type PartitionRequest,
  type StewardRecommendation,
  type WorkLedgerEntry,
} from "@contracts/enterprise";

/**
 * Golden-fixture tests for the Phase 0 shared enterprise/CEO contract. The
 * fixture is byte-identical to desktop-shell/src/shared/enterprise-blueprint.
 * fixture.json and the desktop tests run the same assertions against it.
 */

interface Fixture {
  contractVersion: number;
  input: GenerateBlueprintInput;
  canonicalBlueprint: string;
  blueprintHash: string;
  partition: { requests: PartitionRequest[]; result: unknown };
  view: {
    nodeCount: number;
    edgeCount: number;
    companyCount: number;
    departmentCount: number;
    contractCount: number;
    containsEdgeCount: number;
    servesEdgeCount: number;
  };
  actions: { count: number; ids: string[] };
  stewards: { names: string[]; providerCalls: boolean; authority: string };
  samples: {
    workLedger: WorkLedgerEntry[];
    handoffManifest: unknown;
    timelineIndex: unknown;
    stewardRecommendations: StewardRecommendation[];
  };
}

const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(import.meta.dirname, "../../contracts/enterprise-blueprint.fixture.json"),
    "utf8",
  ),
) as Fixture;

const blueprint = generateEnterpriseBlueprint(fixture.input);

/** Deterministic PRNG (mulberry32) for seeded budget-rounding fuzz. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("enterprise contract fixture", () => {
  it("pins the contract version", () => {
    expect(ENTERPRISE_CONTRACT_VERSION).toBe(1);
    expect(fixture.contractVersion).toBe(ENTERPRISE_CONTRACT_VERSION);
    expect(blueprint.contractVersion).toBe(ENTERPRISE_CONTRACT_VERSION);
  });

  it("generates the exact golden blueprint and hash", () => {
    expect(canonicalJson(blueprint)).toBe(fixture.canonicalBlueprint);
    expect(blueprintHash(blueprint)).toBe(fixture.blueprintHash);
    // Cross-check the pure-TS sha256 against node:crypto.
    expect(crypto.createHash("sha256").update(fixture.canonicalBlueprint, "utf8").digest("hex")).toBe(
      fixture.blueprintHash,
    );
    expect(sha256Hex(fixture.canonicalBlueprint)).toBe(fixture.blueprintHash);
  });

  it("is deterministic: repeated generation is byte-identical", () => {
    const again = generateEnterpriseBlueprint(fixture.input);
    expect(canonicalJson(again)).toBe(canonicalJson(blueprint));
    expect(blueprintHash(again)).toBe(fixture.blueprintHash);
    // key order in the input must not matter (canonicalization sorts keys)
    const shuffled = JSON.parse(
      `{"name":${JSON.stringify(fixture.input.name)},"preset":"creative_technology_group","mission":${JSON.stringify(fixture.input.mission)},"budget":${JSON.stringify(fixture.input.budget)},"programId":"ctg-2026","availableSkillIds":${JSON.stringify(fixture.input.availableSkillIds)},"maxReplans":2,"maxConcurrentRuns":4}`,
    ) as GenerateBlueprintInput;
    expect(canonicalJson(generateEnterpriseBlueprint(shuffled))).toBe(fixture.canonicalBlueprint);
  });

  it("builds the creative_technology_group preset shape honestly", () => {
    expect(blueprint.companies).toHaveLength(5);
    expect(blueprint.companies.filter((c) => c.kind === "line")).toHaveLength(4);
    expect(blueprint.companies.filter((c) => c.kind === "shared-services")).toHaveLength(1);
    expect(blueprint.departments).toHaveLength(7);
    expect(blueprint.departments.every((d) => d.companyKey === "shared-services")).toBe(true);
    // 9 deterministic cross-company contracts (2+3+2+2 disciplines)
    expect(blueprint.contracts).toHaveLength(9);
    expect(blueprint.contracts.every((w) => w.departmentKey.startsWith("svc-"))).toBe(true);
    expect(blueprint.contracts.every((w) => w.companyKey !== "shared-services")).toBe(true);
    // staffed strictly from availableSkillIds; music skill absent => unstaffed
    const music = blueprint.contracts.find((w) => w.discipline === "music-production");
    expect(music?.skillPin.skillId).toBe("music-theory-production-engineering");
    expect(music?.staffed).toBe(false);
    const design = blueprint.contracts.find(
      (w) => w.companyKey === "civilization-design" && w.discipline === "design",
    );
    expect(design?.skillPin.skillId).toBe("civilization-art-design-research");
    expect(design?.staffed).toBe(true);
    // no invented skills anywhere
    for (const w of blueprint.contracts) {
      expect(ALL_DISCIPLINE_SKILL_IDS).toContain(w.skillPin.skillId);
      expect(DISCIPLINE_SKILLS[w.discipline]).toContain(w.skillPin.skillId);
    }
  });

  it("ignores unknown availableSkillIds instead of inventing roles", () => {
    const bp = generateEnterpriseBlueprint({
      ...fixture.input,
      availableSkillIds: [...fixture.input.availableSkillIds, "made-up-skill", "prompt-wizard"],
    });
    expect(canonicalJson(bp)).toBe(fixture.canonicalBlueprint);
    expect(bp.contracts.some((w) => w.skillPin.skillId === "made-up-skill")).toBe(false);
  });

  it("reproduces the golden budget partition and never overspends", () => {
    const result = partitionBudget(blueprint.budget, fixture.partition.requests);
    expect(JSON.parse(JSON.stringify(result))).toEqual(fixture.partition.result);
    expect(result.withinEnvelope).toBe(true);
    expect(result.totals.maxTokens).toBeLessThanOrEqual(blueprint.budget.maxTokens);
    expect(result.totals.maxCalls).toBeLessThanOrEqual(blueprint.budget.maxCalls);
    expect(result.totals.maxMinutes).toBeLessThanOrEqual(blueprint.budget.maxMinutes);
    expect(result.totals.maxCostUsdMicros).toBeLessThanOrEqual(blueprint.budget.maxCostUsdMicros);
    // inactive company gets an explicit zero reservation
    const music = result.partitions.find((p) => p.companyKey === "music");
    expect(music?.active).toBe(false);
    expect(music?.reservation).toEqual({
      maxTokens: 0,
      maxCalls: 0,
      maxMinutes: 0,
      maxCostUsdMicros: 0,
    });
  });

  it("derives graph and list views from one source with key parity", () => {
    const view = deriveEnterpriseView({ blueprint, program: null });
    expect(view.graph.nodes).toHaveLength(fixture.view.nodeCount);
    expect(view.graph.edges).toHaveLength(fixture.view.edgeCount);
    expect(view.lists.companies).toHaveLength(fixture.view.companyCount);
    expect(view.lists.departments).toHaveLength(fixture.view.departmentCount);
    expect(view.lists.contracts).toHaveLength(fixture.view.contractCount);
    expect(view.graph.edges.filter((e) => e.kind === "contains")).toHaveLength(
      fixture.view.containsEdgeCount,
    );
    expect(view.graph.edges.filter((e) => e.kind === "serves")).toHaveLength(
      fixture.view.servesEdgeCount,
    );
    // node/list key parity per kind
    const nodeKeys = (kind: string) =>
      view.graph.nodes.filter((n) => n.kind === kind).map((n) => n.key).sort();
    expect(nodeKeys("company")).toEqual(view.lists.companies.map((r) => r.key).sort());
    expect(nodeKeys("department")).toEqual(view.lists.departments.map((r) => r.key).sort());
    expect(nodeKeys("contract")).toEqual(view.lists.contracts.map((r) => r.key).sort());
    // every edge endpoint exists and edge keys are unique
    const allKeys = new Set(view.graph.nodes.map((n) => n.key));
    const edgeKeys = new Set<string>();
    for (const e of view.graph.edges) {
      expect(allKeys.has(e.from)).toBe(true);
      expect(allKeys.has(e.to)).toBe(true);
      expect(edgeKeys.has(e.key)).toBe(false);
      edgeKeys.add(e.key);
    }
  });
});

describe("enterprise contract rejection honesty", () => {
  it("rejects invalid disciplines in hand-crafted blueprints", () => {
    const bad = JSON.parse(fixture.canonicalBlueprint) as Record<string, unknown>;
    (bad.companies as Array<{ disciplines: string[] }>)[0]!.disciplines = ["alchemy"];
    const parsed = EnterpriseBlueprintSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    const issues = parsed.success ? [] : parsed.error.issues;
    // honest rejection: the failure is located at the offending field and
    // names the closed set of valid disciplines
    expect(issues.some((i) => i.path.join(".") === "companies.0.disciplines.0")).toBe(true);
    expect(JSON.stringify(issues)).toContain("mathematics");
  });

  it("rejects invented/mismatched contract skills", () => {
    const bad = JSON.parse(fixture.canonicalBlueprint) as EnterpriseBlueprint;
    bad.contracts[0]!.skillPin = { skillId: "made-up-skill", version: "0.0.0", sha256: null };
    const parsed = EnterpriseBlueprintSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.success ? [] : parsed.error.issues)).toContain("made-up-skill");
  });

  it("rejects duplicate contract keys", () => {
    const bad = JSON.parse(fixture.canonicalBlueprint) as EnterpriseBlueprint;
    bad.contracts[1]!.key = bad.contracts[0]!.key;
    const parsed = EnterpriseBlueprintSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.success ? [] : parsed.error.issues)).toContain(
      "duplicate contract key",
    );
  });

  it("rejects duplicate company and department keys", () => {
    const dupCompany = JSON.parse(fixture.canonicalBlueprint) as EnterpriseBlueprint;
    dupCompany.companies[1]!.key = dupCompany.companies[0]!.key;
    expect(EnterpriseBlueprintSchema.safeParse(dupCompany).success).toBe(false);
    const dupDept = JSON.parse(fixture.canonicalBlueprint) as EnterpriseBlueprint;
    dupDept.departments[1]!.key = dupDept.departments[0]!.key;
    expect(EnterpriseBlueprintSchema.safeParse(dupDept).success).toBe(false);
  });

  it("rejects invalid generator input and duplicate partition keys with codes", () => {
    expect(() =>
      generateEnterpriseBlueprint({ ...fixture.input, preset: "other-preset" as never }),
    ).toThrowError(EnterpriseContractError);
    expect(() =>
      generateEnterpriseBlueprint({
        ...fixture.input,
        budget: { ...fixture.input.budget, maxTokens: 0 },
      }),
    ).toThrowError(/invalid-generator-input/);
    expect(() =>
      partitionBudget(blueprint.budget, [
        { companyKey: "software", capacityShare: 1, active: true },
        { companyKey: "software", capacityShare: 2, active: true },
      ]),
    ).toThrowError(/duplicate-partition-key/);
  });
});

describe("budget rounding fuzz (seeded, 120 cases)", () => {
  it("never overspends and is deterministic", () => {
    const rand = mulberry32(0x5eed);
    for (let caseIndex = 0; caseIndex < 120; caseIndex++) {
      const envelope = {
        maxTokens: 1 + Math.floor(rand() * 1_000_000_000),
        maxCalls: 1 + Math.floor(rand() * 100_000),
        maxMinutes: Math.round((0.001 + rand() * 10_000) * 1000) / 1000,
        maxCostUsdMicros: 1 + Math.floor(rand() * 1_000_000_000_000),
      };
      const companyCount = 1 + Math.floor(rand() * 8);
      const requests: PartitionRequest[] = [];
      for (let i = 0; i < companyCount; i++) {
        requests.push({
          companyKey: `c${i}-fuzz`,
          capacityShare: 1 + Math.floor(rand() * 1000),
          active: rand() > 0.25,
        });
      }
      if (!requests.some((r) => r.active)) requests[0]!.active = true;
      const result = partitionBudget(envelope, requests);
      // proof: sum(active reservations) <= envelope in every dimension
      expect(result.withinEnvelope).toBe(true);
      expect(result.totals.maxTokens).toBeLessThanOrEqual(envelope.maxTokens);
      expect(result.totals.maxCalls).toBeLessThanOrEqual(envelope.maxCalls);
      expect(result.totals.maxMinutes).toBeLessThanOrEqual(envelope.maxMinutes);
      expect(result.totals.maxCostUsdMicros).toBeLessThanOrEqual(envelope.maxCostUsdMicros);
      // integer allocations, zero for inactive, nonneg for all
      let sumTokens = 0;
      let sumMicros = 0;
      for (const p of result.partitions) {
        expect(Number.isInteger(p.reservation.maxTokens)).toBe(true);
        expect(Number.isInteger(p.reservation.maxCalls)).toBe(true);
        expect(Number.isInteger(p.reservation.maxCostUsdMicros)).toBe(true);
        expect(p.reservation.maxTokens).toBeGreaterThanOrEqual(0);
        if (!p.active) {
          expect(p.reservation).toEqual({
            maxTokens: 0,
            maxCalls: 0,
            maxMinutes: 0,
            maxCostUsdMicros: 0,
          });
        } else {
          sumTokens += p.reservation.maxTokens;
          sumMicros += p.reservation.maxCostUsdMicros;
          // no single active company exceeds the envelope
          expect(p.reservation.maxTokens).toBeLessThanOrEqual(envelope.maxTokens);
          expect(p.reservation.maxCostUsdMicros).toBeLessThanOrEqual(envelope.maxCostUsdMicros);
        }
      }
      expect(sumTokens).toBe(result.totals.maxTokens);
      expect(sumMicros).toBe(result.totals.maxCostUsdMicros);
      // allocations never exceed the full envelope in aggregate (no lost capacity either)
      expect(sumTokens).toBeLessThanOrEqual(envelope.maxTokens);
      expect(sumTokens).toBeGreaterThan(envelope.maxTokens - requests.filter((r) => r.active).length);
      // determinism: identical inputs -> byte-identical output
      const repeat = partitionBudget(envelope, requests.map((r) => ({ ...r })));
      expect(canonicalJson(repeat)).toBe(canonicalJson(result));
    }
  });

  it("breaks remainder ties by stable company-key order", () => {
    const envelope = { maxTokens: 3, maxCalls: 3, maxMinutes: 0.003, maxCostUsdMicros: 3 };
    const requests: PartitionRequest[] = [
      { companyKey: "beta", capacityShare: 1, active: true },
      { companyKey: "alpha", capacityShare: 1, active: true },
      { companyKey: "gamma", capacityShare: 1, active: true },
    ];
    const result = partitionBudget(envelope, requests);
    expect(result.totals.maxTokens).toBe(3);
    expect(result.partitions.map((p) => p.reservation.maxTokens)).toEqual([1, 1, 1]);
  });
});

describe("token-free operations DTOs", () => {
  const FORBIDDEN_KEY = /^(prompt|promptText|rawPrompt|completion|rawCompletion|cot|chainOfThought|messages|transcript)$/i;

  function assertNoRawModelContent(value: unknown): void {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const v of value) assertNoRawModelContent(v);
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      expect(FORBIDDEN_KEY.test(k), `forbidden raw-content key "${k}"`).toBe(false);
      assertNoRawModelContent(v);
    }
  }

  it("parses the golden ledger/handoff/timeline samples", () => {
    for (const entry of fixture.samples.workLedger) {
      expect(WorkLedgerEntrySchema.safeParse(entry).success).toBe(true);
    }
    expect(HandoffManifestSchema.safeParse(fixture.samples.handoffManifest).success).toBe(true);
    const timeline = z_arrayTimeline().safeParse(fixture.samples.timelineIndex);
    expect(timeline.success).toBe(true);
    for (const rec of fixture.samples.stewardRecommendations) {
      expect(StewardRecommendationSchema.safeParse(rec).success).toBe(true);
    }
  });

  it("contains no raw prompts, completions, or chain-of-thought anywhere", () => {
    assertNoRawModelContent(fixture.samples);
  });

  it("derives the golden timeline index from the ledger (system derivation)", () => {
    const derived = deriveTimelineIndex(fixture.samples.workLedger);
    expect(JSON.parse(JSON.stringify(derived))).toEqual(fixture.samples.timelineIndex);
    // parity: one timeline entry per ledger entry, ledgerSeq back-pointers
    expect(derived).toHaveLength(fixture.samples.workLedger.length);
    for (const entry of derived) {
      const source = fixture.samples.workLedger.find((l) => l.seq === entry.ledgerSeq);
      expect(source).toBeDefined();
      expect(entry.ts).toBe(source!.ts);
      expect(entry.kind).toBe(source!.kind);
    }
    // re-derivation is deterministic
    expect(canonicalJson(deriveTimelineIndex(fixture.samples.workLedger))).toBe(
      canonicalJson(derived),
    );
  });

  it("rejects duplicate ledger seqs when deriving the timeline", () => {
    const dup = [fixture.samples.workLedger[0]!, { ...fixture.samples.workLedger[0]! }];
    expect(() => deriveTimelineIndex(dup)).toThrowError(/duplicate-ledger-seq/);
  });

  it("enforces bounded extractive text caps", () => {
    const overAsk = {
      ...fixture.samples.workLedger[0]!,
      intendedAsk: "x".repeat(1001),
    };
    expect(WorkLedgerEntrySchema.safeParse(overAsk).success).toBe(false);
    const overSummary = {
      ...fixture.samples.workLedger[2]!,
      returnedSummary: "y".repeat(2001),
    };
    expect(WorkLedgerEntrySchema.safeParse(overSummary).success).toBe(false);
  });
});

function z_arrayTimeline() {
  return TimelineIndexEntrySchema.array();
}

describe("declarative action registry", () => {
  it("matches the golden fixture ids exactly", () => {
    expect(ENTERPRISE_ACTIONS.map((a) => a.id)).toEqual(fixture.actions.ids);
    expect(ENTERPRISE_ACTIONS).toHaveLength(fixture.actions.count);
  });

  it("has unique ids and operations with valid approvals", () => {
    const ids = new Set<string>();
    const ops = new Set<string>();
    for (const action of ENTERPRISE_ACTIONS) {
      expect(ids.has(action.id)).toBe(false);
      ids.add(action.id);
      expect(ops.has(action.operation)).toBe(false);
      ops.add(action.operation);
      if (action.approval !== null) {
        expect([
          "blueprint-activation",
          "plan",
          "budget-increase",
          "memory-promote",
        ]).toContain(action.approval);
      }
    }
    // the 12 mandated operations are all present
    for (const id of [
      "blueprint.apply",
      "contract.decide",
      "contract.release",
      "program.start",
      "program.pause",
      "program.resume",
      "program.cancel",
      "worker.reassign",
      "worker.capacity",
      "worker.suspend",
      "memory.promote",
      "memory.revoke",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    // hard gates: blueprint apply + program start + memory promote require approvals
    expect(ENTERPRISE_ACTIONS.find((a) => a.id === "blueprint.apply")?.approval).toBe(
      "blueprint-activation",
    );
    expect(ENTERPRISE_ACTIONS.find((a) => a.id === "program.start")?.approval).toBe("plan");
    expect(ENTERPRISE_ACTIONS.find((a) => a.id === "memory.promote")?.approval).toBe(
      "memory-promote",
    );
  });
});

describe("permanent steward roles", () => {
  it("declares exactly the four propose-only system stewards", () => {
    expect(Object.keys(PERMANENT_STEWARD_ROLES).sort()).toEqual(
      [...PERMANENT_STEWARD_ROLE_NAMES].sort(),
    );
    expect(fixture.stewards.names).toEqual([...PERMANENT_STEWARD_ROLE_NAMES]);
    for (const role of Object.values(PERMANENT_STEWARD_ROLES)) {
      expect(role.actor).toBe("system");
      expect(role.authority).toBe("propose-only");
      expect(role.providerCalls).toBe(false);
      expect(role.executesNodes).toBe(false);
      expect(role.externalWrites).toBe(false);
      expect(role.derivation).toBe("deterministic");
    }
  });

  it("fixture recommendations are system-derived, not LLM work", () => {
    expect(fixture.samples.stewardRecommendations.length).toBeGreaterThanOrEqual(3);
    for (const rec of fixture.samples.stewardRecommendations) {
      expect(rec.derivedBy).toBe("system");
      expect(rec.providerCalls).toBe(false);
      expect(PERMANENT_STEWARD_ROLE_NAMES).toContain(rec.steward);
      // proposals reference real actions or explicitly none
      if (rec.actionId !== null) {
        expect(ENTERPRISE_ACTIONS.map((a) => a.id)).toContain(rec.actionId);
      }
    }
    // ledger, handoff, and budget/cache recommendation kinds are all shown
    const kinds = new Set(fixture.samples.stewardRecommendations.map((r) => r.kind));
    expect(kinds.has("ledger")).toBe(true);
    expect(kinds.has("handoff")).toBe(true);
    expect(kinds.has("budget") || kinds.has("cache")).toBe(true);
  });
});
