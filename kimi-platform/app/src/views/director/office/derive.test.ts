import { describe, expect, it } from "vitest";
import { unavailable } from "../workspace/adapter";
import {
  checkAllocation,
  cycleOwnershipEdge,
  deriveDrift,
  deriveOfficeTotals,
  deriveRoomHealth,
  deriveSetupChecklist,
  evaluateEligibility,
  flattenTeamBoard,
  fmtCountdown,
  isOverCapacity,
  moveIndex,
  reassignRequestFor,
  rebaseWhiteboard,
  roleMatches,
  seatsUsed,
  teamBoardKey,
  type TeamBoardKeyState,
  wbSelectionForNode,
  whiteboardExportJson,
  whiteboardToSvg,
} from "./derive";
import { agent, officeFixture, room, whiteboardFixture } from "./testFixtures";

describe("capacity", () => {
  it("counts suspended workers as holding a seat", () => {
    const r = room({
      roomKey: "engineering",
      capacity: 2,
      agents: [agent({ workerId: 1 }), agent({ workerId: 2, status: "suspended" })],
    });
    expect(seatsUsed(r)).toBe(2);
    expect(isOverCapacity(r)).toBe(false);
  });

  it("detects over-capacity when config shrinks under occupancy", () => {
    const r = room({
      roomKey: "engineering",
      capacity: 1,
      agents: [agent({ workerId: 1 }), agent({ workerId: 2 })],
    });
    expect(isOverCapacity(r)).toBe(true);
    const health = deriveRoomHealth(r);
    expect(health.level).toBe("degraded");
    expect(health.reasons.join(" ")).toContain("over capacity 2/1");
  });

  it("blocks reassignment into a full room with the capacity reason", () => {
    const full = room({
      roomKey: "engineering",
      capacity: 1,
      agents: [agent({ workerId: 1 })],
    });
    const mover = agent({ workerId: 2, roomKey: null });
    const verdict = evaluateEligibility(mover, full);
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toBe("blocked — room at capacity (1/1)");
    const req = reassignRequestFor(mover, full);
    expect(req.ok).toBe(false);
    if (!req.ok) expect(req.cause).toBe("room_at_capacity");
  });

  it("allows an agent already seated to stay even at capacity", () => {
    const r = room({ roomKey: "engineering", capacity: 1, agents: [agent({ workerId: 1 })] });
    expect(evaluateEligibility(r.agents[0]!, r).ok).toBe(true);
  });
});

describe("eligibility", () => {
  const target = room({
    roomKey: "ai-research",
    capacity: 4,
    eligibleRolePatterns: ["research", "analyst"],
    capabilitiesRequired: ["retrieval", "eval"],
    agents: [agent({ workerId: 5, role: "researcher", roomKey: "ai-research" })],
  });

  it("names the positive reasons", () => {
    const mover = agent({
      workerId: 6,
      role: "research analyst",
      roomKey: null,
      capabilities: ["retrieval", "eval"],
      skillPins: [{ name: "research", version: "1.0.0", sha256: "a".repeat(64), vetted: true }],
    });
    const v = evaluateEligibility(mover, target);
    expect(v.ok).toBe(true);
    expect(v.message).toBe("eligible — seat 2/4 · role match · 2 capabilities match · no active claims");
  });

  it("blocks suspended workers, role mismatch, missing capabilities, and unvetted pins", () => {
    const mover = agent({
      workerId: 7,
      role: "copywriter",
      status: "suspended",
      roomKey: null,
      capabilities: ["retrieval"],
      skillPins: [{ name: "sketch", version: "0.1.0", sha256: "b".repeat(64), vetted: false }],
    });
    const v = evaluateEligibility(mover, target);
    expect(v.ok).toBe(false);
    expect(v.message).toContain("worker suspended");
    expect(v.message).toContain('role "copywriter" not eligible here');
    expect(v.message).toContain('missing capability "eval"');
    expect(v.message).toContain("skill pin sketch@0.1.0 not vetted");
    const req = reassignRequestFor(mover, target);
    expect(req.ok).toBe(false);
    if (!req.ok) expect(req.cause).toBe("ineligible");
  });

  it("matches roles case-insensitively by pattern", () => {
    expect(roleMatches(["Research"], "senior researcher")).toBe(true);
    expect(roleMatches(["engineer"], "copywriter")).toBe(false);
  });

  it("requires an explicit claims policy when the worker holds claims", () => {
    const busy = agent({ workerId: 8, role: "researcher", roomKey: null, capabilities: ["retrieval", "eval"], workload: { activeClaims: 2, queued: 0 } });
    const noPolicy = reassignRequestFor(busy, target);
    expect(noPolicy.ok).toBe(false);
    if (!noPolicy.ok) {
      expect(noPolicy.cause).toBe("claims_policy_required");
      expect(noPolicy.verdict.message).toContain("drain or release-requeue");
    }
    const withPolicy = reassignRequestFor(busy, target, "drain");
    expect(withPolicy.ok).toBe(true);
    if (withPolicy.ok) {
      expect(withPolicy.input).toEqual({
        workerId: 8,
        toRoomKey: "ai-research",
        expectedVersion: busy.version,
        claimsPolicy: "drain",
      });
    }
  });

  it("moves to the bench honestly (and refuses a no-op)", () => {
    const seated = agent({ workerId: 9, roomKey: "engineering" });
    const ok = reassignRequestFor(seated, null);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.input.toRoomKey).toBeNull();
    const benched = agent({ workerId: 10, roomKey: null });
    expect(reassignRequestFor(benched, null).ok).toBe(false);
  });
});

describe("room health & stale leases", () => {
  it("degrades on a stale lease and names the worker", () => {
    const r = room({
      roomKey: "security-trust",
      agents: [
        agent({
          workerId: 1,
          name: "ST-1 Bram",
          lease: { status: "live", data: { holder: "ST-1 Bram", heartbeatAgeSec: 300, expiresInSec: -180, stale: true } },
        }),
      ],
    });
    const h = deriveRoomHealth(r);
    expect(h.level).toBe("degraded");
    expect(h.reasons).toContain("lease stale (ST-1 Bram)");
  });

  it("degrades on failed-at-max tasks and storage errors; strains on budget/storage/waiting", () => {
    expect(
      deriveRoomHealth(room({ roomKey: "x", tasks: { running: 0, ready: 0, blocked: 0, failed: 2 } })).reasons[0],
    ).toBe("2 failed at max attempts");
    expect(
      deriveRoomHealth(
        room({ roomKey: "x", storage: { allocMb: 1, usedMb: 0, artifactCount: 0, storageErrors: 1 } }),
      ).level,
    ).toBe("degraded");
    const strained = deriveRoomHealth(
      room({
        roomKey: "x",
        compute: { allocTokens: 1, usedTokens: 0, allocUsdMicros: 100, usedUsdMicros: 84, simulated: false },
        storage: { allocMb: 100, usedMb: 81, artifactCount: 0, storageErrors: 0 },
        tasks: { running: 0, ready: 0, blocked: 1, failed: 0 },
      }),
    );
    expect(strained.level).toBe("strained");
    expect(strained.reasons).toEqual(["budget 84%", "storage 81%", "1 waiting"]);
    expect(deriveRoomHealth(room({ roomKey: "x" })).level).toBe("healthy");
  });

  it("treats unavailable leases as unknown, never as fake countdowns", () => {
    const r = room({ roomKey: "x", agents: [agent({ workerId: 1, lease: unavailable("lease feed down") })] });
    expect(deriveRoomHealth(r).level).toBe("healthy");
  });
});

describe("totals & allocation invariant", () => {
  it("rolls up seats, budgets, and health; storage is null when any room is unmetered", () => {
    const bp = officeFixture();
    const t = deriveOfficeTotals(bp);
    expect(t.seatsUsed).toBe(5);
    expect(t.seatsTotal).toBe(21);
    expect(t.degraded).toBe(1); // security-trust: stale lease + failed
    expect(t.storageUsedMb).toBeNull(); // data-knowledge is unmetered
    const metered = officeFixture();
    for (const r of metered.rooms) if (r.storage.usedMb == null) r.storage.usedMb = 0;
    expect(deriveOfficeTotals(metered).storageUsedMb).not.toBeNull();
  });

  it("enforces Σ room allocations ≤ run budget", () => {
    const rooms = [
      room({ roomKey: "a", compute: { allocTokens: 0, usedTokens: 0, allocUsdMicros: 3_000_000, usedUsdMicros: 0, simulated: false } }),
      room({ roomKey: "b", compute: { allocTokens: 0, usedTokens: 0, allocUsdMicros: 2_500_000, usedUsdMicros: 0, simulated: false } }),
    ];
    const over = checkAllocation(rooms, 5_000_000);
    expect(over.ok).toBe(false);
    expect(over.overByUsdMicros).toBe(500_000);
    const ok = checkAllocation(rooms, 5_500_000);
    expect(ok.ok).toBe(true);
    expect(ok.unallocatedUsdMicros).toBe(0);
  });
});

describe("setup checklist (observed, never declared)", () => {
  it("starts at zero with no hires", () => {
    const steps = deriveSetupChecklist(emptyOfficeNoHires());
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(steps[0]!.detail).toContain("no agents yet");
  });

  it("observes hires, bench backlog, funding gaps, and running work", () => {
    const bp = officeFixture();
    const steps = deriveSetupChecklist(bp);
    const [hire, populate, allocate, work] = steps;
    expect(hire!.done).toBe(true);
    expect(populate!.done).toBe(false); // PD-3 Lark is still on the bench
    expect(populate!.detail).toContain("1 on the bench");
    expect(allocate!.done).toBe(false); // not all rooms funded
    expect(work!.done).toBe(true); // runningTasks: 1 — observed
    expect(work!.detail).toContain("observed");
  });

  it("completes populate only when the bench is empty", () => {
    const bp = officeFixture({ bench: [] });
    const steps = deriveSetupChecklist(bp, new Set(["allocate"]));
    expect(steps[1]!.done).toBe(true);
    expect(steps[2]!.skipped).toBe(true);
  });
});

function emptyOfficeNoHires() {
  const bp = officeFixture({ bench: [], runningTasks: 0 });
  return { ...bp, rooms: bp.rooms.map((r) => ({ ...r, agents: [] })) };
}

describe("whiteboard: selection sync, drift, rebase, export", () => {
  it("maps selection to the bound dag node key only for bound tasks", () => {
    const doc = whiteboardFixture();
    expect(wbSelectionForNode(doc.nodes.find((n) => n.id === "t2")!)).toBe("taxonomy-build");
    expect(wbSelectionForNode(doc.nodes.find((n) => n.id === "t3")!)).toBeNull(); // unbound
    expect(wbSelectionForNode(doc.nodes.find((n) => n.id === "m1")!)).toBeNull(); // milestone
  });

  it("flags drift in both directions plus ineligible owners and room/claim mismatch", () => {
    const doc = whiteboardFixture();
    const drift = deriveDrift({
      doc,
      dagNodeKeys: ["model-scan", "taxonomy-build", "publish-brief"],
      roomHasSeat: (k) => k !== "data-knowledge", // full → intent drift
      workerEligible: () => true,
      claimingRoomOf: (k) => (k === "taxonomy-build" ? "engineering" : null),
    });
    const kinds = drift.map((d) => d.kind);
    expect(kinds).toContain("unbound-task"); // t3 has no binding
    expect(kinds).toContain("unmapped-dag-node"); // publish-brief missing from board
    expect(kinds).toContain("owner-ineligible"); // ownership → full room
    expect(kinds).toContain("claim-not-in-room"); // claimed in engineering, intent data-knowledge
    const gone = deriveDrift({
      doc,
      dagNodeKeys: ["model-scan"],
      roomHasSeat: () => true,
      workerEligible: () => true,
      claimingRoomOf: () => null,
    });
    expect(gone.some((d) => d.kind === "unbound-task" && d.dagNodeKey === "taxonomy-build")).toBe(true);
  });

  it("cycles ownership only through eligible targets and wraps", () => {
    const doc = whiteboardFixture();
    const targets = [
      { key: "engineering", ownership: { roomKey: "engineering" } as const },
      { key: "ai-research", ownership: { roomKey: "ai-research" } as const },
    ];
    const first = cycleOwnershipEdge(doc.edges, "t2", targets);
    expect(first.appliedKey).toBe("engineering"); // current is data-knowledge → first target
    const second = cycleOwnershipEdge(first.edges, "t2", targets);
    expect(second.appliedKey).toBe("ai-research");
    const third = cycleOwnershipEdge(second.edges, "t2", targets);
    expect(third.appliedKey).toBe("engineering"); // wraps
    expect(third.edges.filter((e) => e.kind === "ownership")).toHaveLength(1); // replaced, not duplicated
    const none = cycleOwnershipEdge(doc.edges, "t2", []);
    expect(none.appliedKey).toBeNull();
    expect(none.edges).toBe(doc.edges); // unchanged
  });

  it("rebases deterministically: mine wins text/position, latest wins structure, bindings by dagNodeKey", () => {
    const latest = whiteboardFixture({ revision: 13, version: 31 });
    latest.nodes = latest.nodes.map((n) =>
      n.id === "t2" ? { ...n, title: "server title", position: { x: 1, y: 1 }, binding: { dagNodeKey: "taxonomy-build", runId: 19 } } : n,
    );
    latest.nodes.push({ id: "t9", kind: "task", title: "new server task", position: { x: 9, y: 9 } });
    const mine = whiteboardFixture();
    mine.nodes = mine.nodes.map((n) =>
      n.id === "t2" ? { ...n, title: "my title", position: { x: 2, y: 2 }, binding: { dagNodeKey: "taxonomy-build", runId: 18 } } : n,
    );
    const merged = rebaseWhiteboard(mine, latest);
    expect(merged.revision).toBe(13);
    expect(merged.version).toBe(31);
    const t2 = merged.nodes.find((n) => n.id === "t2")!;
    expect(t2.title).toBe("my title"); // my text wins
    expect(t2.position).toEqual({ x: 2, y: 2 }); // my position wins
    expect(t2.binding).toEqual({ dagNodeKey: "taxonomy-build", runId: 18 }); // same key → mine kept
    expect(merged.nodes.some((n) => n.id === "t9")).toBe(true); // server additions preserved
  });

  it("exports honest SVG/JSON with provenance and escaping", () => {
    const doc = whiteboardFixture();
    doc.nodes[5]!.title = 'a <b> & "c"';
    const svg = whiteboardToSvg(doc);
    expect(svg).toContain('data-revision="12"');
    expect(svg).toContain("taxonomy-build");
    expect(svg).toContain("a &lt;b&gt; &amp; &quot;c&quot;");
    const json = JSON.parse(whiteboardExportJson(doc, "2026-11-21T00:00:00Z"));
    expect(json.format).toBe("atlas.whiteboard.v1");
    expect(json.planHash).toBe("4c9a77e1abcdef00");
    expect(json.revision).toBe(12);
    expect(json.doc.nodes).toHaveLength(6);
  });
});

describe("keyboard helpers (team board parity)", () => {
  it("moveIndex wraps in both directions", () => {
    expect(moveIndex(0, -1, 3)).toBe(2);
    expect(moveIndex(2, 1, 3)).toBe(0);
    expect(moveIndex(1, 1, 0)).toBe(0);
  });

  it("flattens the same data the floor plan renders", () => {
    const bp = officeFixture();
    const collapsed = flattenTeamBoard(bp.rooms, bp.bench, new Set());
    expect(collapsed.filter((r) => r.kind === "room")).toHaveLength(9); // 8 rooms + bench group
    expect(collapsed.filter((r) => r.kind !== "room")).toHaveLength(0);
    const expanded = flattenTeamBoard(
      bp.rooms,
      bp.bench,
      new Set(["engineering", "__bench__"]),
    );
    const agents = expanded.filter((r) => r.kind !== "room");
    expect(agents.map((r) => r.workerId)).toEqual([1, 2, 3, 20]); // 3 engineers + bench Lark
  });

  it("arrow keys move, expand, collapse, and step out to the parent", () => {
    const bp = officeFixture();
    let state: TeamBoardKeyState = { focusIndex: 0, expanded: new Set<string>() };
    let rows = flattenTeamBoard(bp.rooms, bp.bench, state.expanded);
    // expand executive (index 0)
    state = { ...teamBoardKey("ArrowRight", state, rows) };
    rows = flattenTeamBoard(bp.rooms, bp.bench, state.expanded);
    expect(state.expanded.has("executive")).toBe(true);
    // move down into the director agent row
    state = { ...teamBoardKey("ArrowDown", state, rows) };
    expect(rows[state.focusIndex]!.kind).toBe("agent");
    // step back out to the parent room
    state = { ...teamBoardKey("ArrowLeft", state, rows) };
    rows = flattenTeamBoard(bp.rooms, bp.bench, state.expanded);
    expect(rows[state.focusIndex]!.id).toBe("room:executive");
    // collapse it
    state = { ...teamBoardKey("ArrowLeft", state, rows) };
    expect(state.expanded.has("executive")).toBe(false);
    // unknown keys change nothing
    expect(teamBoardKey("x", state, rows)).toBe(state);
  });
});

describe("formatting", () => {
  it("formats lease countdowns honestly", () => {
    expect(fmtCountdown(102)).toBe("01:42");
    expect(fmtCountdown(0)).toBe("00:00");
    expect(fmtCountdown(-5)).toBe("expired");
  });
});
