import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import GoalRail from "./GoalRail";
import QueueTable from "./QueueTable";
import ApprovalsInbox from "./ApprovalsInbox";
import PlanStage from "./PlanStage";
import PoolPanel from "./PoolPanel";
import {
  deriveQueueRows,
  deriveStageStatuses,
  deriveWorkerViews,
  live,
  unavailable,
  type RoadmapSnapshot,
} from "./adapter";
import { defaultRunBudget, defaultNodeBudget, defaultTermination } from "@contracts/dag";
import type { DagSpec } from "@contracts/dag";

/**
 * Component-level smoke tests (SSR markup, node environment — no DOM needed).
 * They assert the honest-state contract: unavailable control data is labeled,
 * empty states teach, and status is never conveyed by color alone.
 */

const spec: DagSpec = {
  revision: 1,
  budget: defaultRunBudget(),
  nodes: [
    {
      key: "scan",
      role: "Research Scientist",
      skill: { name: "research", version: "1.0.0", sha256: "c".repeat(64) },
      goal: "scan the literature",
      inputArtifactTypes: [],
      outputArtifactType: "research-brief",
      toolsAllowed: ["read"],
      resourceUrls: [],
      budget: defaultNodeBudget(),
      termination: defaultTermination(),
    },
  ],
  edges: [],
};

const roadmap: RoadmapSnapshot = {
  revisionId: 1,
  revision: 1,
  approved: false,
  planHash: "deadbeef".repeat(8),
  nodeCount: 1,
  edgeCount: 0,
  spec,
};

describe("GoalRail", () => {
  const stages = deriveStageStatuses({
    project: null,
    roadmap,
    activeRun: null,
    queueCounts: null,
    pendingApprovals: 0,
    artifacts: null,
    budgetUsedPct: null,
  });

  it("renders the goal, five steps, and the honest lease-unavailable box", () => {
    const html = renderToStaticMarkup(
      <GoalRail
        project={{
          id: 1,
          name: "P",
          goal: "Map the evidence.",
          riskTier: "medium",
          status: "active",
          createdAt: new Date(0),
        }}
        stages={stages}
        activeStage="roadmap"
        onStageSelect={() => undefined}
        meters={null}
        directorLease={unavailable("not exposed yet")}
      />,
    );
    expect(html).toContain("Map the evidence.");
    expect(html).toContain("01");
    expect(html).toContain("05");
    expect(html).toContain("control data unavailable");
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("risk: medium");
    // meters fall back to a clear message instead of fake zeros
    expect(html).toContain("No active run");
  });
});

describe("QueueTable", () => {
  it("labels the lease column as unavailable rather than faking countdowns", () => {
    const rows = deriveQueueRows(
      [{ nodeKey: "scan", state: "running", attempts: 2 }],
      spec,
      [],
    );
    const html = renderToStaticMarkup(
      <QueueTable
        rows={rows}
        noRun={false}
        leaseUnavailableReason="lease endpoints missing"
        focusedKey={null}
        onFocus={() => undefined}
      />,
    );
    expect(html).toContain("scan");
    expect(html).toContain("running");
    expect(html).toContain("no lease feed");
    expect(html).toContain("control data unavailable");
    expect(html).toContain("research@1.0.0");
  });

  it("teaches the empty state when no run exists", () => {
    const html = renderToStaticMarkup(
      <QueueTable
        rows={null}
        noRun={true}
        leaseUnavailableReason={null}
        focusedKey={null}
        onFocus={() => undefined}
      />,
    );
    expect(html).toContain("No run yet");
  });
});

describe("ApprovalsInbox", () => {
  it("renders decisions behind explicit buttons and shows escalation options as informational chips", () => {
    const html = renderToStaticMarkup(
      <ApprovalsInbox
        approvals={[
          {
            id: 7,
            runId: 3,
            nodeKey: "scan",
            kind: "external-action",
            excerpt: '{ "options": ["retry","reassign"] }',
            options: ["retry", "reassign"],
          },
        ]}
        onDecide={() => undefined}
        deciding={false}
        focusedId={null}
        onFocus={() => undefined}
      />,
    );
    expect(html).toContain("1 pending");
    expect(html).toContain("blocks run");
    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
    expect(html).toContain("retry");
    expect(html).toContain("recorded as decision note");
  });

  it("has a teaching empty state", () => {
    const html = renderToStaticMarkup(
      <ApprovalsInbox
        approvals={[]}
        onDecide={() => undefined}
        deciding={false}
        focusedId={null}
        onFocus={() => undefined}
      />,
    );
    expect(html).toContain("No pending approvals");
  });
});

describe("PlanStage (list view)", () => {
  it("renders the accessible list alternative with owner and budget text", () => {
    const html = renderToStaticMarkup(
      <PlanStage
        projectId={1}
        roadmap={roadmap}
        view="list"
        onViewChange={() => undefined}
      />,
    );
    expect(html).toContain("plan rev 1");
    expect(html).toContain("not approved");
    expect(html).toContain("scan");
    expect(html).toContain("Research Scientist");
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
  });

  it("renders an honest empty-roadmap state", () => {
    const html = renderToStaticMarkup(
      <PlanStage
        projectId={1}
        roadmap={{ ...roadmap, spec: null, nodeCount: 0, revision: null, revisionId: null, planHash: null }}
        view="list"
        onViewChange={() => undefined}
      />,
    );
    expect(html).toContain("No roadmap yet");
  });
});

// ── Control plane surfaces (SSR honesty checks) ──

describe("QueueTable — live control data", () => {
  it("renders a stale lease honestly and shows the live assignment", () => {
    const rows = deriveQueueRows(
      [
        {
          nodeKey: "scan",
          state: "running",
          attempts: 2,
          version: 3,
          assignedWorkerId: 4,
          assignmentMode: "hybrid",
          leaseWorkerId: 4,
        },
      ],
      spec,
      [],
      () =>
        live({
          holder: "researcher-1",
          heartbeatAgeSec: 240,
          expiresInSec: -120,
          stale: true,
        }),
      { workerName: () => "researcher-1" },
    );
    const html = renderToStaticMarkup(
      <QueueTable
        rows={rows}
        noRun={false}
        leaseUnavailableReason={null}
        focusedKey={null}
        onFocus={() => undefined}
        onInspect={() => undefined}
      />,
    );
    expect(html).toContain("lease expired");
    expect(html).toContain("→ researcher-1");
    expect(html).toContain("hybrid");
    expect(html).toContain("Inspect");
    expect(html).not.toContain("no lease feed");
  });

  it("shows claimed/waiting/paused/cancelled states as text chips", () => {
    const rows = deriveQueueRows(
      [
        { nodeKey: "scan", state: "claimed", attempts: 1 },
        { nodeKey: "waited", state: "waiting", attempts: 0, waitReason: "event" },
        { nodeKey: "halted", state: "paused", attempts: 1 },
        { nodeKey: "gone", state: "cancelled", attempts: 0 },
      ],
      null,
      [],
    );
    const html = renderToStaticMarkup(
      <QueueTable
        rows={rows}
        noRun={false}
        leaseUnavailableReason={null}
        focusedKey={null}
        onFocus={() => undefined}
      />,
    );
    for (const s of ["claimed", "waiting", "paused", "cancelled"]) {
      expect(html).toContain(s);
    }
    expect(html).toContain("waiting on event");
  });
});

describe("PoolPanel", () => {
  const workers = deriveWorkerViews(
    [
      {
        id: 1,
        name: "director",
        kind: "director",
        role: "director",
        capabilities: ["read"],
        skillRefs: [],
        status: "active",
        maxConcurrentClaims: 1,
        leaseTtlSeconds: 120,
        lastSeenAt: new Date(1_000_000 - 5_000),
      },
      {
        id: 2,
        name: "researcher-1",
        kind: "subagent",
        role: "Evidence Synthesizer",
        capabilities: ["read"],
        skillRefs: [],
        status: "suspended",
        maxConcurrentClaims: 2,
        leaseTtlSeconds: 120,
        lastSeenAt: new Date(1_000_000 - 500_000),
      },
    ],
    [{ nodeKey: "scan", state: "ready", attempts: 0 }],
    spec,
    { now: 1_000_000 },
  );

  const controls = {
    startPool: async () => ({ ok: true as const, data: { directorWorkerId: 1, advancing: 0 } }),
    pausePool: async () => ({ ok: true as const, data: { paused: 1 } }),
    resumePool: async () => ({ ok: true as const, data: { resumed: 1 } }),
    stopPool: async () => ({ ok: true as const, data: { stopped: 1 } }),
    pumpOnce: async () => ({ ok: true as const, data: { pumped: null } }),
    sweepExpiredLeases: async () => ({
      ok: true as const,
      data: { swept: 0, recycled: [], failed: [] },
    }),
  };
  const workerControls = {
    register: async () => ({ ok: true as const, data: { workerId: 9 } }),
    setStatus: async () => ({ ok: true as const, data: { ok: true } }),
    setCapacity: async () => ({ ok: true as const, data: { ok: true } }),
  };

  it("renders the paused pool, worker capacity, staleness and eligibility failures", () => {
    const html = renderToStaticMarkup(
      <PoolPanel
        pool={live({ paused: true, activeRuns: [{ id: 5, state: "paused" }], workers })}
        controls={controls}
        workerControls={workerControls}
        hasRun={true}
        runTerminal={false}
        budgetExhausted={false}
      />,
    );
    expect(html).toContain("pool paused");
    expect(html).toContain("Resume pool");
    expect(html).toContain("Pump once");
    expect(html).toContain("Sweep expired leases");
    expect(html).toContain("Stop pool");
    expect(html).toContain("#1 director");
    expect(html).toContain("suspended");
    expect(html).toContain("stale — seen 500s ago");
    // worker 2 is suspended → cannot claim the ready node
    expect(html).toContain("cannot claim");
    expect(html).toContain("worker suspended");
    // capacity controls + registration are real buttons
    expect(html).toContain("increase capacity of researcher-1");
    expect(html).toContain("Register worker");
  });

  it("disables pump with an honest note when the budget is exhausted", () => {
    const html = renderToStaticMarkup(
      <PoolPanel
        pool={live({ paused: false, activeRuns: [{ id: 5, state: "running" }], workers: [] })}
        controls={controls}
        workerControls={workerControls}
        hasRun={true}
        runTerminal={false}
        budgetExhausted={true}
      />,
    );
    expect(html).toContain("Budget exhausted — pump is disabled");
    expect(html).toContain("No workers registered");
  });

  it("degrades honestly when the control API is unavailable", () => {
    const html = renderToStaticMarkup(
      <PoolPanel
        pool={unavailable("worker pool status unavailable: connection refused")}
        controls={null}
        workerControls={null}
        hasRun={false}
        runTerminal={true}
        budgetExhausted={false}
      />,
    );
    expect(html).toContain("control data unavailable");
    expect(html).toContain("connection refused");
    expect(html).not.toContain("Pause pool");
  });
});
