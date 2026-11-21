import { describe, expect, it } from "vitest";
import {
  ENTERPRISE_ACTIONS,
  blueprintHash,
  enterpriseApprovalPayloadHash,
  partitionBudget,
} from "@contracts/enterprise";
import {
  EMPTY_LEDGER_FILTER,
  ENTERPRISE_ACTION_SURFACES,
  buildApplyInput,
  buildLedgerMaps,
  deriveActionCoverage,
  deriveBudgetMeters,
  deriveContractControls,
  deriveDepartmentPool,
  deriveMemoryControls,
  derivePlanStatus,
  deriveProgramControls,
  deriveStewardRecommendations,
  describeSnapshotError,
  filterLedger,
  layoutEnterpriseView,
  ledgerEntryCompanyKey,
} from "./adapter";
import {
  blueprintFixture,
  ledgerEntry,
  revisionsFixture,
  snapshotFixture,
  workersFixture,
} from "./testFixtures";

const snapshot = snapshotFixture();
const workers = workersFixture(snapshot);

describe("blueprint fixture shape (5/7/9 from one snapshot)", () => {
  it("carries five companies, seven shared departments, nine contracts", () => {
    expect(snapshot.companies).toHaveLength(5);
    expect(snapshot.departments).toHaveLength(7);
    expect(snapshot.contracts).toHaveLength(9);
    expect(snapshot.departments.every((d) => d.key.startsWith("svc-"))).toBe(true);
  });
});

describe("blueprint apply hash pinning", () => {
  it("builds the apply input with the exact previewed hashes", () => {
    const bp = blueprintFixture();
    const preview = {
      blueprint: bp,
      blueprintHash: blueprintHash(bp),
      payloadHash: enterpriseApprovalPayloadHash({ stub: true }),
    };
    const input = buildApplyInput(preview);
    expect(input.approved).toBe(true);
    expect(input.expectedBlueprintHash).toBe(preview.blueprintHash);
    expect(input.expectedPayloadHash).toBe(preview.payloadHash);
    expect(input.programId).toBe("ctg-2026");
    expect(input.budget).toEqual(bp.budget);
    // recompute independently: the pinned hash is the contract hash
    expect(blueprintHash(bp)).toBe(input.expectedBlueprintHash);
  });

  it("refuses to apply when the preview hash does not match the blueprint", () => {
    const bp = blueprintFixture();
    expect(() =>
      buildApplyInput({
        blueprint: bp,
        blueprintHash: "0".repeat(64),
        payloadHash: "1".repeat(64),
      }),
    ).toThrowError(/preview hash mismatch/);
  });
});

describe("plan gate (derivePlanStatus)", () => {
  it("reports loading, no-plan, unapproved draft, and approved truthfully", () => {
    expect(derivePlanStatus(undefined).state).toBe("loading");
    expect(derivePlanStatus(revisionsFixture("none")).state).toBe("no-plan");
    const draft = derivePlanStatus(revisionsFixture("draft"));
    expect(draft.state).toBe("unapproved");
    if (draft.state === "unapproved") {
      expect(draft.revision).toBe(1);
      expect(draft.detail).toContain("human plan approval required");
    }
    const approved = derivePlanStatus(revisionsFixture("approved"));
    expect(approved.state).toBe("approved");
    if (approved.state === "approved") {
      // finds the approved revision even when a newer draft exists
      expect(approved.revision).toBe(1);
    }
  });
});

describe("budget partition meters", () => {
  it("matches the contract partitioner and never fabricates usage", () => {
    const meters = deriveBudgetMeters(snapshot.enterprise, snapshot.companies, snapshot.usage);
    const direct = partitionBudget(
      snapshot.enterprise.budget,
      snapshot.companies.map((c) => ({ companyKey: c.key, capacityShare: c.capacityShare, active: c.active })),
    );
    expect(meters.rows.map((r) => r.reservation)).toEqual(direct.partitions.map((p) => p.reservation));
    expect(meters.withinEnvelope).toBe(true);
    // music's only skill is unvetted in the fixture → inactive → zero reservation
    const music = meters.rows.find((r) => r.companyKey === "music");
    // music also has a design contract that IS staffed in the fixture blueprint,
    // so it is active; shared-services has no contracts → inactive zero.
    const shared = meters.rows.find((r) => r.companyKey === "shared-services");
    expect(shared?.active).toBe(false);
    expect(shared?.reservation.maxTokens).toBe(0);
    void music;
    // usage is the snapshot rollup, never estimated
    expect(meters.usage.tokens.used).toBe(150_000);
    expect(meters.usage.calls.used).toBe(12);
    expect(meters.usage.costUsdMicros.used).toBe(1_250_000);
    expect(meters.usage.tokens.fraction).toBeCloseTo(150_000 / 2_000_000);
  });
});

describe("contract decision / release controls", () => {
  it("proposed + staffed: decide enabled, release disabled with reason", () => {
    const c = snapshot.contracts.find((w) => w.staffed && w.status === "proposed")!;
    const ctl = deriveContractControls(c);
    expect(ctl.approve.enabled).toBe(true);
    expect(ctl.reject.enabled).toBe(true);
    expect(ctl.release.enabled).toBe(false);
    expect(ctl.release.reason).toContain("proposed");
  });

  it("proposed + unstaffed: approve disabled naming the unvetted skill", () => {
    const c = snapshot.contracts.find((w) => !w.staffed)!;
    expect(c.status).toBe("proposed");
    const ctl = deriveContractControls(c);
    expect(ctl.approve.enabled).toBe(false);
    expect(ctl.approve.reason).toContain(c.skillPin.skillId);
    expect(ctl.reject.enabled).toBe(true);
  });

  it("active: release (drain) enabled; draining: complete release", () => {
    const s = snapshotFixture({
      contractStatus: {
        "ai-cyber--svc-mathematics": { status: "active", secondeeWorkerId: 502, capacityGroupId: "ent-1:dept-11" },
        "software--svc-backend-engineering": { status: "draining" },
      },
    });
    const active = s.contracts.find((w) => w.key === "ai-cyber--svc-mathematics")!;
    const draining = s.contracts.find((w) => w.key === "software--svc-backend-engineering")!;
    expect(deriveContractControls(active).release).toMatchObject({ enabled: true, label: "Release (drain)" });
    expect(deriveContractControls(active).approve.enabled).toBe(false);
    expect(deriveContractControls(draining).release).toMatchObject({ enabled: true, label: "Complete release" });
    const released = snapshotFixture({
      contractStatus: { "ai-cyber--svc-mathematics": { status: "released" } },
    }).contracts.find((w) => w.key === "ai-cyber--svc-mathematics")!;
    const ctl = deriveContractControls(released);
    expect(ctl.release.enabled).toBe(false);
    expect(ctl.approve.enabled).toBe(false);
  });
});

describe("memory hash / decision controls", () => {
  it("pending + verified: promote enabled; pending + unverified: refused with reason", () => {
    const ok = deriveMemoryControls({ id: 1, state: "pending", contentSha256: "a".repeat(64), verified: true });
    expect(ok.promote.enabled).toBe(true);
    expect(ok.reject.enabled).toBe(true);
    expect(ok.revoke.enabled).toBe(false);
    const bad = deriveMemoryControls({ id: 2, state: "pending", contentSha256: "b".repeat(64), verified: false });
    expect(bad.promote.enabled).toBe(false);
    expect(bad.promote.reason).toMatch(/no longer matches|no hash/i);
    expect(bad.reject.enabled).toBe(true);
  });

  it("promoted: revoke only; rejected/revoked: nothing", () => {
    const promoted = deriveMemoryControls({ id: 3, state: "promoted", contentSha256: "c".repeat(64), verified: true });
    expect(promoted.revoke.enabled).toBe(true);
    expect(promoted.promote.enabled).toBe(false);
    const rejected = deriveMemoryControls({ id: 4, state: "rejected", contentSha256: "d".repeat(64), verified: true });
    expect(rejected.promote.enabled).toBe(false);
    expect(rejected.revoke.enabled).toBe(false);
  });
});

describe("program controls", () => {
  it("awaiting_plan_approval: only start (+cancel) enabled", () => {
    const ctls = deriveProgramControls(snapshot.program!);
    const byId = new Map(ctls.map((c) => [c.id, c]));
    expect(byId.get("start")?.enabled).toBe(true);
    expect(byId.get("pause")?.enabled).toBe(false);
    expect(byId.get("resume")?.enabled).toBe(false);
    expect(byId.get("pump")?.enabled).toBe(false);
    expect(byId.get("cancel")?.enabled).toBe(true);
    expect(byId.get("pause")?.reason).toContain("awaiting_plan_approval");
  });

  it("running: pause/pump enabled; paused: resume only", () => {
    const running = snapshotFixture({ programState: "running" }).program!;
    const byId = new Map(deriveProgramControls(running).map((c) => [c.id, c]));
    expect(byId.get("start")?.enabled).toBe(false);
    expect(byId.get("pause")?.enabled).toBe(true);
    expect(byId.get("pump")?.enabled).toBe(true);
    const paused = snapshotFixture({ programState: "running", pausedAt: new Date() }).program!;
    const p = new Map(deriveProgramControls(paused).map((c) => [c.id, c]));
    expect(p.get("resume")?.enabled).toBe(true);
    expect(p.get("pause")?.reason).toBe("program is already paused");
    expect(p.get("pump")?.reason).toContain("paused");
  });

  it("terminal: cancel disabled with the terminal state named", () => {
    const done = snapshotFixture({ programState: "completed" }).program!;
    const byId = new Map(deriveProgramControls(done).map((c) => [c.id, c]));
    expect(byId.get("cancel")?.enabled).toBe(false);
    expect(byId.get("cancel")?.reason).toContain("completed");
  });
});

describe("ledger filters (company / department / employee / kind)", () => {
  const maps = buildLedgerMaps(
    {
      ...snapshot,
      program: {
        ...snapshot.program!,
        companyRuns: [
          { companyKey: "software", runId: 7001, status: "running" },
          { companyKey: "ai-cyber", runId: 7002, status: "running" },
        ],
      },
    },
    workers,
  );
  const entries = [
    ledgerEntry({ runId: 7001, projectId: 101, kind: "assignment", nodeKey: "backend-engineering", workerId: 501 }),
    ledgerEntry({ runId: 7002, projectId: 102, kind: "artifact", nodeKey: "mathematics", workerId: 502 }),
    ledgerEntry({ runId: 7002, projectId: 102, kind: "error", nodeKey: "cybersecurity", workerId: 503 }),
  ];

  it("resolves company via the program's recorded run ids", () => {
    expect(ledgerEntryCompanyKey(entries[0]!, maps)).toBe("software");
    expect(ledgerEntryCompanyKey(entries[1]!, maps)).toBe("ai-cyber");
    const filtered = filterLedger(entries, maps, { ...EMPTY_LEDGER_FILTER, companyKey: "software" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.runId).toBe(7001);
  });

  it("filters by department via worker pool or node discipline", () => {
    const mathDept = snapshot.departments.find((d) => d.discipline === "mathematics")!;
    const byDept = filterLedger(
      entries,
      maps,
      { ...EMPTY_LEDGER_FILTER, departmentId: mathDept.id },
      snapshot.departments,
    );
    // worker 502 is pooled under math; entry nodeKey "mathematics" matches the discipline
    expect(byDept.map((e) => e.seq)).toContain(entries[1]!.seq);
    // worker 503 is pooled under design and nodeKey cybersecurity ≠ mathematics
    expect(byDept.map((e) => e.seq)).not.toContain(entries[2]!.seq);
  });

  it("filters by employee and kind", () => {
    const byWorker = filterLedger(entries, maps, { ...EMPTY_LEDGER_FILTER, workerId: 502 });
    expect(byWorker).toHaveLength(1);
    expect(byWorker[0]!.kind).toBe("artifact");
    const errors = filterLedger(entries, maps, { ...EMPTY_LEDGER_FILTER, kind: "error" });
    expect(errors).toHaveLength(1);
  });
});

describe("graph/list parity", () => {
  it("layout nodes are exactly the canonical list keys per kind", () => {
    const layout = layoutEnterpriseView(snapshot.view!);
    const keys = (kind: string) => layout.nodes.filter((n) => n.kind === kind).map((n) => n.key).sort();
    expect(keys("company")).toEqual(snapshot.view!.lists.companies.map((r) => r.key).sort());
    expect(keys("department")).toEqual(snapshot.view!.lists.departments.map((r) => r.key).sort());
    expect(keys("contract")).toEqual(snapshot.view!.lists.contracts.map((r) => r.key).sort());
    // every edge endpoint resolves to a laid-out node
    const all = new Set(layout.nodes.map((n) => n.key));
    for (const e of layout.edges) {
      expect(all.has(e.from)).toBe(true);
      expect(all.has(e.to)).toBe(true);
    }
    // deterministic: re-layout is identical
    expect(layoutEnterpriseView(snapshot.view!)).toEqual(layout);
  });
});

describe("action parity (ENTERPRISE_ACTIONS → surface + procedure)", () => {
  const serverActions = ENTERPRISE_ACTIONS.map((a) => ({
    ...a,
    procedure: `enterprise.${a.id.split(".")[0]}.${a.id.split(".")[1]}`,
  }));

  it("every registry action has a UI surface", () => {
    for (const a of ENTERPRISE_ACTIONS) {
      expect(ENTERPRISE_ACTION_SURFACES[a.id], `missing surface for ${a.id}`).toBeTruthy();
    }
  });

  it("coverage is complete when the server advertises procedures", () => {
    const rows = deriveActionCoverage(serverActions);
    expect(rows).toHaveLength(ENTERPRISE_ACTIONS.length);
    expect(rows.every((r) => r.covered)).toBe(true);
  });

  it("coverage degrades honestly when the registry is unavailable", () => {
    const rows = deriveActionCoverage(undefined);
    expect(rows.every((r) => !r.covered)).toBe(true);
    expect(rows.every((r) => r.surface !== null)).toBe(true);
    expect(rows.every((r) => r.procedure === null)).toBe(true);
  });
});

describe("steward recommendations (system, no provider calls)", () => {
  it("derives deterministic proposals from snapshot facts", () => {
    const recs = deriveStewardRecommendations(snapshot, workers, 0);
    expect(recs.length).toBeGreaterThanOrEqual(3);
    for (const r of recs) {
      expect(r.derivedBy).toBe("system");
      expect(r.providerCalls).toBe(false);
      if (r.actionId !== null) {
        expect(ENTERPRISE_ACTIONS.map((a) => a.id)).toContain(r.actionId);
      }
    }
    // unstaffed proposed contract → contract.decide proposal
    expect(recs.some((r) => r.actionId === "contract.decide")).toBe(true);
    // empty ledger → program.start proposal
    expect(recs.some((r) => r.kind === "ledger" && r.actionId === "program.start")).toBe(true);
    // suspended worker → blueprint-ops handoff proposal
    expect(recs.some((r) => r.steward === "blueprint-ops" && r.actionId === "worker.suspend")).toBe(true);
    // deterministic
    expect(deriveStewardRecommendations(snapshot, workers, 0)).toEqual(recs);
  });

  it("withholds ledger proposals when the ledger probe failed (null total)", () => {
    const recs = deriveStewardRecommendations(snapshot, workers, null);
    expect(recs.some((r) => r.steward === "evidence-ledger-steward")).toBe(false);
  });
});

describe("department pool truth", () => {
  it("reports staffed/unstaffed contracts and real pooled workers", () => {
    const pool = deriveDepartmentPool(snapshot, workers);
    expect(pool).toHaveLength(7);
    const math = pool.find((d) => d.discipline === "mathematics")!;
    expect(math.workers.map((w) => w.id).sort()).toEqual([501, 502]);
    expect(math.suspendedWorkers).toBe(1);
    expect(math.totalCapacity).toBe(3);
    const musicDept = pool.find((d) => d.discipline === "music-production")!;
    expect(musicDept.unstaffedContracts).toBeGreaterThan(0);
    expect(musicDept.workers).toHaveLength(0);
    expect(musicDept.totalCapacity).toBe(0);
  });
});

describe("owner / API error mapping", () => {
  it("maps NOT_FOUND / FORBIDDEN / generic honestly", () => {
    expect(describeSnapshotError("NOT_FOUND", "enterprise not found", 42)).toContain("#42");
    expect(describeSnapshotError("FORBIDDEN", "not your enterprise", 42)).toContain("different owner");
    expect(describeSnapshotError("INTERNAL_SERVER_ERROR", "boom", 42)).toContain("boom");
    expect(describeSnapshotError(undefined, "network", 42)).toContain("unavailable");
  });
});
