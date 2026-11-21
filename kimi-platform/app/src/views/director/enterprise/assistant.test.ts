import { describe, expect, it } from "vitest";
import {
  ASSISTANT_ACTIONS,
  ASSISTANT_ACTION_POLICIES,
  ASSISTANT_GATES,
  ASSISTANT_JOB_POLICIES,
  CACHE_NAMESPACES,
  EMERGENCY_STOP_ACTION_ID,
  STUDY_QUEUE_CAP,
  createAssistantProposal,
  validateAssistantAction,
} from "@contracts/assistant";
import { snapshotFixture } from "./testFixtures";
import {
  ASSISTANT_ACTION_SURFACES,
  EMERGENCY_STOP_COPY,
  PROVIDER_CACHE_POLICY,
  buildQueueReorderInput,
  buildReorderOrder,
  describeAssistantError,
  deriveAssistantActionCoverage,
  deriveIntakeControls,
  deriveJobRow,
  deriveProposalView,
  deriveRepoApplyControl,
  deriveScopeOptions,
  formatCountdown,
  parseRepoUrls,
  parseScopeValue,
  previewStudyItems,
  requiredGates,
  scopeValue,
  studySkillOptions,
  summarizeStudyItems,
  validateTransferDraft,
  verifyPayloadHash,
  type JobRowLike,
  type ProposalRowLike,
} from "./useAssistantData";

/**
 * Focused assistant UI logic tests: scope selection, queue OCC, fire/archive
 * gate confirmations, schedule policy (never paid-auto), cache namespaces,
 * repository intake/apply rules, study dedupe/cap, knowledge refs, the
 * emergency-stop direct path, and API error mapping. All pure — the server
 * remains the source of truth for the guards.
 */

const snapshot = snapshotFixture();

describe("scope selector (snapshot-fed)", () => {
  it("offers enterprise + every snapshot company + every department; office is disabled with a reason", () => {
    const options = deriveScopeOptions(snapshot);
    expect(options[0]).toMatchObject({ scope: "enterprise", scopeKey: "", disabled: false });
    const companies = options.filter((o) => o.scope === "company");
    const departments = options.filter((o) => o.scope === "department");
    expect(companies.map((c) => c.scopeKey).sort()).toEqual(snapshot.companies.map((c) => c.key).sort());
    expect(departments.map((d) => d.scopeKey).sort()).toEqual(snapshot.departments.map((d) => d.key).sort());
    const office = options.find((o) => o.scope === "office");
    expect(office?.disabled).toBe(true);
    expect(office?.reason).toContain("not materialized");
  });

  it("round-trips scope values", () => {
    expect(parseScopeValue("enterprise")).toEqual({ scope: "enterprise", scopeKey: "" });
    expect(parseScopeValue(scopeValue("company", "software"))).toEqual({ scope: "company", scopeKey: "software" });
    expect(parseScopeValue(scopeValue("department", "svc-design"))).toEqual({ scope: "department", scopeKey: "svc-design" });
  });
});

describe("queue reorder (dense order + OCC)", () => {
  const items = [{ itemKey: "a" }, { itemKey: "b" }, { itemKey: "c" }];

  it("moves one step and always submits the full permutation", () => {
    expect(buildReorderOrder(items, "b", -1)).toEqual(["b", "a", "c"]);
    expect(buildReorderOrder(items, "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("returns null at the edges and for unknown keys (no-op, never a bad mutation)", () => {
    expect(buildReorderOrder(items, "a", -1)).toBeNull();
    expect(buildReorderOrder(items, "c", 1)).toBeNull();
    expect(buildReorderOrder(items, "zzz", 1)).toBeNull();
  });

  it("pins the reorder to the exact queue version (expectedQueueVersion OCC)", () => {
    const input = buildQueueReorderInput("company", "software", ["b", "a", "c"], 7);
    expect(input.expectedQueueVersion).toBe(7);
    expect(input.scope).toBe("company");
    expect(input.scopeKey).toBe("software");
  });
});

describe("fire / archive confirmations (gates + drain-preserve)", () => {
  it("worker.fire requires high-risk + plan-approval and drains/preserves", () => {
    expect(requiredGates("worker.fire")).toEqual(["high-risk", "plan-approval"]);
    expect(ASSISTANT_ACTION_POLICIES["worker.fire"].drainAndPreserve).toBe(true);
  });

  it("company.archive and department.archive are high-risk structural drain+preserve; pause/resume need plan-approval only", () => {
    for (const action of ["company.archive", "department.archive"] as const) {
      expect(requiredGates(action)).toEqual(["high-risk", "plan-approval"]);
      expect(ASSISTANT_ACTION_POLICIES[action].structural).toBe(true);
      expect(ASSISTANT_ACTION_POLICIES[action].drainAndPreserve).toBe(true);
    }
    for (const action of ["company.pause", "company.resume", "department.pause", "department.resume", "worker.hire"] as const) {
      expect(requiredGates(action)).toEqual(["plan-approval"]);
    }
  });

  it("the contract rejects a fire/archive payload without drain+preserve (server re-check parity)", () => {
    const proposal = createAssistantProposal({
      id: "p1",
      scope: "enterprise",
      actor: "donna",
      action: "worker.fire",
      payload: { contractKey: "c1" },
      expectedVersion: 1,
      proposedAt: 0,
    });
    expect(() =>
      validateAssistantAction(proposal, { approved: true, confirmedGates: [...ASSISTANT_GATES] }),
    ).toThrow(/drain/);
  });
});

describe("schedules (real countdown; never paid-auto)", () => {
  it("every job kind is provider-free, paid-free, and never executes proposals", () => {
    for (const policy of Object.values(ASSISTANT_JOB_POLICIES)) {
      expect(policy.providerCalls).toBe(false);
      expect(policy.paidCalls).toBe(false);
      expect(policy.executesProposals).toBe(false);
    }
  });

  it("upsert and run_now require the plan-approval gate; pause/resume/delete do not", () => {
    expect(requiredGates("schedule.upsert")).toEqual(["plan-approval"]);
    expect(requiredGates("schedule.run_now")).toEqual(["plan-approval"]);
    expect(requiredGates("schedule.pause")).toEqual([]);
    expect(requiredGates("schedule.resume")).toEqual([]);
    expect(requiredGates("schedule.delete")).toEqual([]);
  });

  it("formatCountdown reports due/soon/never honestly", () => {
    const now = 1_800_000_000_000;
    expect(formatCountdown(null, now)).toBe("no further run");
    expect(formatCountdown(now - 1000, now)).toBe("due now");
    expect(formatCountdown(now + 90_000, now)).toBe("in 1m 30s");
    expect(formatCountdown(now + 26 * 3_600_000, now)).toBe("in 1d 2h");
  });

  it("deriveJobRow exposes nextRun, countdown, maxRuns and the zero-reservation budget", () => {
    const now = 1_800_000_000_000;
    const job: JobRowLike = {
      id: 1,
      jobKey: "ledger-hourly",
      scope: "enterprise",
      scopeKey: "",
      kind: "ledger_refresh",
      schedule: { type: "interval", intervalMs: 3_600_000, anchorAt: now - 3_600_000 },
      enabled: true,
      nextRunAt: now + 600_000,
      lastRunAt: now - 3_600_000,
      runCount: 4,
      maxRuns: 10,
      version: 5,
    };
    const row = deriveJobRow(job, now);
    expect(row.countdown).toBe("in 10m");
    expect(row.runsLabel).toBe("4/10 runs");
    expect(row.budgetLabel).toContain("zero reservation");
    expect(row.effect).toBe("refresh-ledger");
    expect(row.scheduleText).toContain("every 1h");
  });
});

describe("cache namespaces (provider responses never cached)", () => {
  it("invalidation targets are exactly the four deterministic namespaces", () => {
    expect([...CACHE_NAMESPACES]).toEqual(["skill-excerpts", "blueprint", "snapshot", "repository-metadata"]);
    expect(PROVIDER_CACHE_POLICY).toContain("Provider responses are never cached");
    expect(requiredGates("cache.invalidate")).toEqual([]);
  });
});

describe("repository intake (public vs credentialed; quarantine; hash-bound apply)", () => {
  it("parses pasted URLs: trims, dedupes first-wins, caps at 50 honestly", () => {
    const many = Array.from({ length: 55 }, (_, i) => `https://github.com/o/r${i}`).join("\n");
    const parsed = parseRepoUrls(` https://github.com/a/b \nhttps://github.com/a/b\n\n${many}`);
    expect(parsed.duplicates).toBe(1);
    expect(parsed.urls).toHaveLength(50);
    expect(parsed.truncated).toBe(6); // 55 + 1 unique - 50 kept
    expect(parsed.urls[0]).toBe("https://github.com/a/b");
  });

  it("public-anonymous allows preview and forbids a record id; credentialed refuses preview and requires one", () => {
    const pub = deriveIntakeControls("public-anonymous");
    expect(pub.previewEnabled).toBe(true);
    expect(pub.recordIdForbidden).toBe(true);
    expect(pub.requiresRecordId).toBe(false);
    const cred = deriveIntakeControls("credentialed-approved");
    expect(cred.previewEnabled).toBe(false);
    expect(cred.previewReason).toContain("credentialed previews are refused");
    expect(cred.requiresRecordId).toBe(true);
    // import always carries the external-writes + credentials + high-risk gates
    expect(cred.gates).toEqual(["external-writes", "credentials", "high-risk"]);
  });

  it("assigned plans apply via repository.assign (plan-approval); new structure is an explicit high-risk proposal; quarantine has no apply", () => {
    const assigned = deriveRepoApplyControl({ status: "assigned", appliedBy: null });
    expect(assigned).toMatchObject({ enabled: true, kind: "assign" });
    expect(assigned.gates).toEqual(["plan-approval"]);
    const structure = deriveRepoApplyControl({ status: "proposed_new_structure", appliedBy: null });
    expect(structure).toMatchObject({ enabled: true, kind: "propose_structure" });
    expect(structure.gates).toEqual(["high-risk", "plan-approval"]);
    const quarantined = deriveRepoApplyControl({ status: "quarantined", appliedBy: null });
    expect(quarantined.enabled).toBe(false);
    expect(quarantined.reason).toContain("quarantined");
    const applied = deriveRepoApplyControl({ status: "assigned", appliedBy: "ceo@example.com" });
    expect(applied.enabled).toBe(false);
    expect(applied.reason).toContain("already applied");
  });
});

describe("study queue (dedupe / cap / drafts)", () => {
  it("first occurrence wins on duplicate refs and the cap is enforced", () => {
    const refs = ["r1", "r2", "r1", ...Array.from({ length: STUDY_QUEUE_CAP + 5 }, (_, i) => `rx${i}`)];
    const items = previewStudyItems("ai-research-frontier", refs, "learn the frontier");
    expect(items.length).toBe(STUDY_QUEUE_CAP);
    const refSet = new Set(items.map((i) => i.resourceRef));
    expect(refSet.size).toBe(items.length); // deduped
    expect(items[0]!.resourceRef).toBe("r1"); // first occurrence wins, order stable
    for (const item of items) {
      expect(item.status).toBe("draft");
      expect(item.providerCalls).toBe(false);
      expect(item.id).toMatch(/^ai-research-frontier:[0-9a-f]{12}$/); // content-derived id
    }
  });

  it("skill options come from the snapshot contracts (never invented)", () => {
    const skills = studySkillOptions(snapshot);
    expect(skills.length).toBeGreaterThan(0);
    for (const w of snapshot.contracts) expect(skills).toContain(w.skillPin.skillId);
  });

  it("summarizes statuses without fabricating counts", () => {
    const summary = summarizeStudyItems([
      { id: 1, itemKey: "a", skillId: "s", resourceRef: "r1", topic: "", goal: "g", evaluation: "", status: "draft" },
      { id: 2, itemKey: "b", skillId: "s", resourceRef: "r2", topic: "", goal: "g", evaluation: "", status: "completed" },
    ]);
    expect(summary).toEqual({
      total: 2,
      byStatus: { draft: 1, queued: 0, "in-progress": 0, completed: 1, dropped: 0 },
    });
  });
});

describe("knowledge transfer (refs only)", () => {
  const base = { transferKey: "handoff-1", from: "svc-design", to: "svc-backend-engineering", summary: "design tokens", artifactIds: [1, 2] };

  it("accepts a valid refs-only draft", () => {
    expect(validateTransferDraft(base)).toBeNull();
  });

  it("requires at least one artifact reference and caps at 16", () => {
    expect(validateTransferDraft({ ...base, artifactIds: [] })).toContain("at least one artifact reference");
    expect(
      validateTransferDraft({ ...base, artifactIds: Array.from({ length: 17 }, (_, i) => i + 1) }),
    ).toContain("at most 16");
  });

  it("requires kebab-case key, from and to", () => {
    expect(validateTransferDraft({ ...base, transferKey: "Bad Key!" })).toContain("kebab-case");
    expect(validateTransferDraft({ ...base, from: " " })).toContain("from");
    expect(validateTransferDraft({ ...base, to: "" })).toContain("to");
  });
});

describe("proposal inbox (typed diff + hash + OCC)", () => {
  const payload = { contractKey: "w-backend", drain: true, preserveArtifacts: true };
  const row: ProposalRowLike = {
    id: 42,
    proposalKey: "prop-42",
    scope: "enterprise",
    actor: "donna",
    action: "worker.fire",
    payload,
    payloadHash: "", // filled below with the real contract hash
    expectedVersion: 3,
    risk: "high",
    requiresApproval: true,
    confirmedGates: ["high-risk"],
    status: "proposed",
    resultSummary: "",
    proposedAt: 1,
    decidedAt: null,
    executedAt: null,
  };
  const realHash = createAssistantProposal({
    id: "prop-42",
    scope: "enterprise",
    actor: "donna",
    action: "worker.fire",
    payload,
    expectedVersion: 3,
    proposedAt: 1,
  }).payloadHash;

  it("verifies the payload hash against the contract canonical encoding", () => {
    expect(verifyPayloadHash(payload, realHash)).toBe(true);
    expect(verifyPayloadHash(payload, "0".repeat(64))).toBe(false);
  });

  it("exposes risk, scope, expectedVersion, gate state and a typed payload diff", () => {
    const view = deriveProposalView({ ...row, payloadHash: realHash });
    expect(view.risk).toBe("high");
    expect(view.scope).toBe("enterprise");
    expect(view.expectedVersion).toBe(3);
    expect(view.hashVerified).toBe(true);
    expect(view.requiredGates).toEqual(["high-risk", "plan-approval"]);
    expect(view.missingGates).toEqual(["plan-approval"]);
    expect(view.diffLines).toContain('+ contractKey: "w-backend"');
    expect(view.diffLines).toContain("+ drain: true");
    expect(view.diffLines).toContain("+ preserveArtifacts: true");
    const tampered = deriveProposalView({ ...row, payloadHash: "f".repeat(64) });
    expect(tampered.hashVerified).toBe(false);
  });
});

describe("emergency stop (direct path, never an assistant proposal)", () => {
  it("is absent from the closed action set and rejected by the contract", () => {
    expect([...ASSISTANT_ACTIONS]).not.toContain(EMERGENCY_STOP_ACTION_ID);
    expect(() =>
      createAssistantProposal({
        id: "stop-1",
        scope: "enterprise",
        actor: "donna",
        action: EMERGENCY_STOP_ACTION_ID as never,
        payload: {},
        expectedVersion: 1,
        proposedAt: 0,
      }),
    ).toThrow(/not in the closed action set/);
    expect(EMERGENCY_STOP_COPY).toContain("enterprise.programCancel");
    expect(EMERGENCY_STOP_COPY).toContain("never travels through an assistant proposal");
  });
});

describe("action coverage (every closed action mapped to a drawer surface)", () => {
  it("maps all 24 actions with no gaps", () => {
    const coverage = deriveAssistantActionCoverage();
    expect(coverage).toHaveLength(ASSISTANT_ACTIONS.length);
    for (const row of coverage) {
      expect(row.surface.length).toBeGreaterThan(0);
      expect(ASSISTANT_ACTION_SURFACES[row.id]).toBe(row.surface);
    }
  });
});

describe("API error mapping", () => {
  it("maps tRPC codes to honest operator notes", () => {
    expect(describeAssistantError(null)).toBeNull();
    expect(describeAssistantError({ data: { code: "CONFLICT" }, message: "queue changed concurrently — reload and retry" })).toContain("State changed concurrently");
    expect(describeAssistantError({ data: { code: "PRECONDITION_FAILED" }, message: "GATE_NOT_CONFIRMED" })).toContain("approval gate");
    expect(describeAssistantError({ data: { code: "NOT_FOUND" }, message: "queue not found" })).toContain("Not found");
    expect(describeAssistantError({ data: { code: "FORBIDDEN" }, message: "not the owner" })).toContain("different owner");
    expect(describeAssistantError({ data: { code: "BAD_REQUEST" }, message: "invalid" })).toContain("failed");
  });
});
