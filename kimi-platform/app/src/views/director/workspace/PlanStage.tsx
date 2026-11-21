import { lazy, Suspense, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import type { RoadmapSnapshot, RunLike } from "./adapter";
import OfficeStage, { type OfficeView } from "../office/OfficeStage";

// GraphEditor (React Flow) is heavy — it is only fetched when the graph
// view is actually opened, keeping the workspace chunk lean.
const GraphEditor = lazy(() => import("../GraphEditor"));

export type PlanView = "graph" | "list" | OfficeView;

/** Everything the office views need from the workspace shell. */
export interface OfficeStageContext {
  activeRun: RunLike | null;
  userName: string;
  selectedNodeKey: string | null;
  onSelect(nodeKey: string | null): void;
}

function defaultView(): PlanView {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
    return "list";
  }
  return "graph";
}

/**
 * Zone C, stage 02 — roadmap & squad. The Graph/List segmented control is
 * the honest-accessibility contract: every graph ships with its list. The
 * list is the screen-reader- and keyboard-canonical representation of the
 * same DagSpec (no new data).
 */
export default function PlanStage({
  projectId,
  roadmap,
  view,
  onViewChange,
  office,
}: {
  projectId: number;
  roadmap: RoadmapSnapshot;
  view: PlanView | null;
  onViewChange(v: PlanView): void;
  /** Present when the office routers are wired (always in the live shell). */
  office?: OfficeStageContext;
}) {
  const [internal, setInternal] = useState<PlanView>(defaultView);
  const current = view ?? internal;
  const setView = (v: PlanView) => {
    setInternal(v);
    onViewChange(v);
  };

  return (
    <section aria-labelledby="dw-roadmap-heading" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 id="dw-roadmap-heading" className="text-xl font-extrabold tracking-tight">
          Roadmap &amp; squad
        </h1>
        {roadmap.revision != null ? (
          <span className="chip">plan rev {roadmap.revision}</span>
        ) : null}
        {roadmap.revision != null ? (
          roadmap.approved ? (
            <span className="chip chip-sage">approved · frozen</span>
          ) : (
            <span className="chip chip-mustard">not approved</span>
          )
        ) : null}
        {roadmap.planHash ? (
          <span className="chip mono">hash {roadmap.planHash.slice(0, 8)}…</span>
        ) : null}
        <div
          role="tablist"
          aria-label="Plan view"
          className="ml-auto inline-flex border border-[hsl(var(--line))]"
        >
          {(
            [
              ["graph", "Graph", "1"],
              ["list", "List", "2"],
              ["blueprint", "Blueprint", "G B"],
              ["team", "Team", "G T"],
              ["whiteboard", "Whiteboard", "G W"],
            ] as [PlanView, string, string][]
          ).map(([v, label, kbd]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={current === v}
              className="tab-control min-h-[44px] px-4 text-[13px]"
              onClick={() => setView(v)}
            >
              {label} <Kbd aria-hidden>{kbd}</Kbd>
            </button>
          ))}
        </div>
      </div>

      {current === "graph" ? (
        <Suspense
          fallback={
            <div
              className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-6 text-[13px] text-[hsl(var(--ink-soft))]"
              role="status"
            >
              Loading graph editor…
            </div>
          }
        >
          <GraphEditor projectId={projectId} />
        </Suspense>
      ) : current === "list" ? (
        <PlanList
          roadmap={roadmap}
          selectedNodeKey={office?.selectedNodeKey ?? null}
          onSelect={office?.onSelect}
        />
      ) : office ? (
        <OfficeStage
          projectId={projectId}
          view={current}
          activeRun={office.activeRun}
          planHash={roadmap.planHash}
          userName={office.userName}
          selectedNodeKey={office.selectedNodeKey}
          onSelect={office.onSelect}
        />
      ) : (
        <PlanList roadmap={roadmap} />
      )}
    </section>
  );
}

/** Accessible list alternative to the canvas — same DagSpec, tabular form. */
function PlanList({
  roadmap,
  selectedNodeKey = null,
  onSelect,
}: {
  roadmap: RoadmapSnapshot;
  /** Shared selection, synchronized with queue/inspector/office views. */
  selectedNodeKey?: string | null;
  onSelect?: (nodeKey: string | null) => void;
}) {
  const spec = roadmap.spec;
  if (!spec || !spec.nodes.length) {
    return (
      <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-6">
        <h2 className="text-[15px] font-extrabold">No roadmap yet</h2>
        <p className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
          This project has no plan nodes. Open the Graph view to propose a
          squad (a degraded provider returns a clearly labeled mock draft) or
          to add nodes by hand, then validate, save, and approve a revision.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <table className="table-cat text-[13px]">
        <caption className="sr-only">
          Plan nodes, revision {roadmap.revision}, with owners, pinned skills,
          budgets, and approval gates
        </caption>
        <thead>
          <tr>
            <th scope="col">Node</th>
            <th scope="col">Owner · skill</th>
            <th scope="col">Output</th>
            <th scope="col">Budget</th>
            <th scope="col">Gate</th>
          </tr>
        </thead>
        <tbody>
          {spec.nodes.map((n) => (
            <tr
              key={n.key}
              data-selected={selectedNodeKey === n.key || undefined}
              className={selectedNodeKey === n.key ? "bg-[hsl(var(--cornflower)/0.12)]" : undefined}
              onClick={onSelect ? () => onSelect(n.key) : undefined}
            >
              <td>
                <div className="mono text-[12px] font-bold">{n.key}</div>
                <div className="max-w-64 text-[12px] text-[hsl(var(--ink-soft))]">
                  {n.goal}
                </div>
              </td>
              <td className="text-[13px]">
                {n.role}
                <div className="mono text-[12px] text-[hsl(var(--ink-soft))]">
                  {n.skill.name}@{n.skill.version}
                </div>
              </td>
              <td>
                <span className="chip">{n.outputArtifactType}</span>
              </td>
              <td className="mono text-[12px]">
                {n.budget.maxTokens.toLocaleString()} tok · {n.budget.maxCalls}{" "}
                calls · ${n.budget.maxCostUsd.toFixed(2)}
              </td>
              <td className="text-[13px]">
                {n.approvalBefore ? (
                  <span className="chip chip-mustard">approval: {n.approvalBefore}</span>
                ) : (
                  <span className="text-[hsl(var(--ink-soft))]">none</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="table-cat text-[13px]">
        <caption className="sr-only">Plan edges (artifact and control handoffs)</caption>
        <thead>
          <tr>
            <th scope="col">From</th>
            <th scope="col">To</th>
            <th scope="col">Kind</th>
          </tr>
        </thead>
        <tbody>
          {spec.edges.map((e, i) => (
            <tr key={`${e.from}-${e.to}-${i}`}>
              <td className="mono text-[12px]">{e.from}</td>
              <td className="mono text-[12px]">{e.to}</td>
              <td>
                <span className="chip">{e.kind}</span>
              </td>
            </tr>
          ))}
          {!spec.edges.length ? (
            <tr>
              <td colSpan={3} className="text-[hsl(var(--ink-soft))]">
                No handoffs — nodes are independent.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
