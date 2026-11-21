import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { navigate } from "@/lib/utils";
import { TERMINAL_RUN_STATES } from "@contracts/run";
import { ErrorNote } from "../DirectorShell";
import GoalRail from "./GoalRail";
import PlanStage, { type PlanView } from "./PlanStage";
import QueueTable from "./QueueTable";
import NodeInspector from "./NodeInspector";
import ApprovalsInbox, { type Decision } from "./ApprovalsInbox";
import OpsDeck from "./OpsDeck";
import EvidenceStage from "./EvidenceStage";
import CommandPalette, { type PaletteCommand } from "./CommandPalette";
import { useWorkspaceData } from "./useWorkspaceData";
import { useDirectorHotkeys } from "./useDirectorHotkeys";
import type { StageId } from "./adapter";
import GoalModePanel from "../office/GoalModePanel";
import AutonomyPanel from "../office/AutonomyPanel";
import "./workspace.css";

// Heavy run console (full control surface) loads only when stage 04 opens.
const RunConsole = lazy(() => import("../RunConsole"));

const ZONE_IDS: Record<string, string> = {
  queue: "dw-queue",
  approvals: "dw-approvals",
  evidence: "dw-evidence",
  roadmap: "dw-main",
};

/**
 * The Director command workspace for #/director/projects/:id — one screen,
 * five zones mapped to the flow goal → roadmap/squad → queue → control →
 * evidence. All data comes from the adapter hook backed by the live control
 * router (roadmapStatus + pool + lease lifecycle); if the control API is
 * unreachable the surfaces degrade to honest "control data unavailable"
 * states instead of faking controls.
 */
export default function WorkspaceShell({
  projectId,
  focusRunId,
  initialStage,
  user,
  onSignOut,
}: {
  projectId: number;
  focusRunId?: number;
  initialStage?: StageId;
  user: { name?: string | null; email?: string | null };
  onSignOut(): void;
}) {
  const data = useWorkspaceData(projectId, focusRunId);
  const utils = trpc.useUtils();

  const [stage, setStage] = useState<StageId>(initialStage ?? "roadmap");
  const [planView, setPlanView] = useState<PlanView | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [focusedApprovalId, setFocusedApprovalId] = useState<number | null>(null);
  const [focusedNodeKey, setFocusedNodeKey] = useState<string | null>(null);
  const [inspectedNodeKey, setInspectedNodeKey] = useState<string | null>(null);

  /**
   * Shared selection across roadmap/graph/list/queue/office views and the
   * inspector: selecting a node anywhere focuses the queue row and opens
   * the inspector (when the node is in the active run).
   */
  const selectNode = useCallback((key: string | null) => {
    setFocusedNodeKey(key);
    setInspectedNodeKey(key);
  }, []);

  const decideM = trpc.approvals.decide.useMutation({
    onSuccess: () => {
      void utils.approvals.listPending.invalidate();
      void data.queries.runDetailQ.refetch();
    },
  });
  const onDecide = useCallback(
    (id: number, decision: Decision, note: string) =>
      decideM.mutate({ approvalId: id, decision, note }),
    [decideM],
  );

  const focusZone = useCallback((zone: "queue" | "approvals" | "evidence" | "roadmap") => {
    if (zone === "roadmap") setStage("roadmap");
    const el = document.getElementById(ZONE_IDS[zone]);
    if (el) {
      el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: false });
    }
  }, []);

  const moveItem = useCallback(
    (delta: 1 | -1) => {
      // Move within approvals if one is focused or the focus is in the inbox;
      // otherwise move within the queue table.
      const approvalIds = data.pendingApprovals.map((a) => a.id);
      const inApprovals =
        focusedApprovalId != null ||
        (document.activeElement instanceof HTMLElement &&
          !!document.activeElement.closest("#dw-approvals"));
      if (inApprovals && approvalIds.length) {
        const idx = focusedApprovalId == null ? -1 : approvalIds.indexOf(focusedApprovalId);
        const next = approvalIds[(idx + delta + approvalIds.length) % approvalIds.length]!;
        setFocusedApprovalId(next);
        document.getElementById(`dw-approval-${next}`)?.focus();
        return;
      }
      const keys = (data.queueRows ?? []).map((r) => r.nodeKey);
      if (!keys.length) return;
      const idx = focusedNodeKey == null ? -1 : keys.indexOf(focusedNodeKey);
      const next = keys[(idx + delta + keys.length) % keys.length]!;
      setFocusedNodeKey(next);
      document.getElementById(`dw-queue-${next}`)?.focus();
    },
    [data.pendingApprovals, data.queueRows, focusedApprovalId, focusedNodeKey],
  );

  const clickFocusedDecision = useCallback((action: "approve" | "reject") => {
    if (focusedApprovalId == null) return;
    // Route keyboard decisions through the same button → same confirm dialog.
    const card = document.getElementById(`dw-approval-${focusedApprovalId}`);
    card?.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)?.click();
  }, [focusedApprovalId]);

  useDirectorHotkeys({
    openPalette: () => setPaletteOpen(true),
    openHelp: () => setHelpOpen(true),
    setPlanView: (v) => {
      setStage("roadmap");
      setPlanView(v);
    },
    focusZone,
    moveItem,
    inspectFocused: () => {
      if (focusedApprovalId != null) {
        const card = document.getElementById(`dw-approval-${focusedApprovalId}`);
        card?.querySelector<HTMLButtonElement>("button")?.focus();
      } else if (focusedNodeKey) {
        setInspectedNodeKey(focusedNodeKey);
      }
    },
    approveFocused: () => clickFocusedDecision("approve"),
    rejectFocused: () => clickFocusedDecision("reject"),
    requestStop: () => {
      if (data.activeRun && !TERMINAL_RUN_STATES.has(data.activeRun.state)) {
        setStopConfirmOpen(true);
      }
    },
  });

  const commands = useMemo<PaletteCommand[]>(() => {
    const stages: PaletteCommand[] = [
      { id: "s-goal", label: "Go to stage 01 · Goal", group: "Stages", run: () => setStage("goal") },
      { id: "s-roadmap", label: "Go to stage 02 · Roadmap & squad", group: "Stages", shortcut: "G R", run: () => { setStage("roadmap"); } },
      { id: "s-queue", label: "Focus task queue", group: "Stages", shortcut: "G Q", run: () => focusZone("queue") },
      { id: "s-approvals", label: "Focus approvals inbox", group: "Stages", shortcut: "G A", run: () => focusZone("approvals") },
      { id: "s-evidence", label: "Go to stage 05 · Artifacts & evaluation", group: "Stages", shortcut: "G E", run: () => setStage("evidence") },
    ];
    const actions: PaletteCommand[] = [
      { id: "a-graph", label: "Plan view: Graph", group: "Actions", shortcut: "1", run: () => { setStage("roadmap"); setPlanView("graph"); } },
      { id: "a-list", label: "Plan view: List", group: "Actions", shortcut: "2", run: () => { setStage("roadmap"); setPlanView("list"); } },
      { id: "a-blueprint", label: "Office blueprint", group: "Actions", shortcut: "G B", run: () => { setStage("roadmap"); setPlanView("blueprint"); } },
      { id: "a-team", label: "Office team board", group: "Actions", shortcut: "G T", run: () => { setStage("roadmap"); setPlanView("team"); } },
      { id: "a-whiteboard", label: "Ownership whiteboard", group: "Actions", shortcut: "G W", run: () => { setStage("roadmap"); setPlanView("whiteboard"); } },
    ];
    if (data.activeRun && !TERMINAL_RUN_STATES.has(data.activeRun.state)) {
      actions.push({
        id: "a-stop",
        label: `Stop run #${data.activeRun.id} (with confirmation)`,
        group: "Actions",
        shortcut: "S",
        run: () => setStopConfirmOpen(true),
      });
    }
    const nav: PaletteCommand[] = [
      { id: "n-home", label: "Director home — all projects", group: "Navigate", run: () => navigate("#/director") },
      { id: "n-enterprises", label: "Enterprises — CEO dashboard", group: "Navigate", run: () => navigate("#/director/enterprises") },
      { id: "n-approvals", label: "Global approvals (all projects)", group: "Navigate", run: () => navigate("#/director/approvals") },
      { id: "n-skills", label: "Skill registry", group: "Navigate", run: () => navigate("#/director/skills") },
      { id: "n-integrations", label: "Integrations", group: "Navigate", run: () => navigate("#/director/integrations") },
      { id: "n-settings", label: "Settings", group: "Navigate", run: () => navigate("#/director/settings") },
      { id: "n-atlas", label: "Back to the public atlas", group: "Navigate", run: () => navigate("#/overview") },
      { id: "n-out", label: "Sign out", group: "Navigate", run: onSignOut },
    ];
    return [...stages, ...actions, ...nav];
  }, [data.activeRun, focusZone, onSignOut]);

  const pendingCount = data.pendingApprovals.length;
  const project = data.project;

  return (
    <div className="dw dw-shell">
      <a
        href="#dw-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-[hsl(var(--ink))] focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-[hsl(var(--paper))]"
      >
        Skip to main content
      </a>

      {/* ── Top command bar ── */}
      <header className="dw-topbar">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center bg-[hsl(var(--dark))] text-sm font-extrabold text-[hsl(42_78%_55%)]"
        >
          ▽
        </span>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px] text-[hsl(var(--ink-soft))]">
          <a href="#/overview" className="font-extrabold text-[hsl(var(--ink))] hover:underline">
            ← Atlas
          </a>
          <span aria-hidden>/</span>
          <a href="#/director" className="font-bold hover:underline">
            Director
          </a>
          <span aria-hidden>/</span>
          <span className="truncate font-extrabold text-[hsl(var(--ink))]">
            {project?.name ?? (data.loading ? "loading…" : `project #${projectId}`)}
          </span>
          {project ? <span className="chip chip-mustard">risk: {project.riskTier}</span> : null}
          {project ? <span className="chip">{project.status}</span> : null}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {data.providers.map((p) => (
            <span
              key={p.id}
              className={`chip ${p.tone === "ok" ? "chip-sage" : p.tone === "degraded" ? "chip-mustard" : ""}`}
            >
              {p.label}
            </span>
          ))}
          <a
            href="#/director/approvals"
            className={`chip ${pendingCount ? "chip-mustard" : ""} min-h-[32px] font-bold`}
            aria-label={`${pendingCount} pending approvals across projects — open global approvals`}
          >
            ⚠ {pendingCount} approval{pendingCount === 1 ? "" : "s"}
          </a>
          <button
            type="button"
            className="btn min-h-[36px] gap-2 px-2 text-[12px]"
            onClick={() => setPaletteOpen(true)}
          >
            Command palette <Kbd aria-hidden>⌘K</Kbd>
          </button>
          <span className="text-[12px] text-[hsl(var(--ink-soft))]">
            {user.name ?? user.email ?? "owner"}
          </span>
          <button type="button" className="btn min-h-[36px] px-2 text-[12px]" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {/* ── Zone A: goal rail ── */}
      <aside className="dw-rail" aria-label="Goal and flow">
        <GoalRail
          project={project}
          stages={data.stages}
          activeStage={stage}
          onStageSelect={setStage}
          meters={data.meters}
          directorLease={data.directorLease}
        />
      </aside>

      {/* ── Zone C: stage ── */}
      <main id="dw-main" className="dw-center" tabIndex={-1}>
        {data.apiDown ? (
          <div className="dw-notice" data-severity="alert" role="alert">
            <span className="chip chip-alert">API unreachable</span>
            <span>
              Project data could not be loaded ({data.apiError}). The public
              atlas still works —{" "}
              <a className="underline" href="#/overview">
                back to atlas
              </a>
              . No automatic retry storm; refresh manually.
            </span>
          </div>
        ) : data.projectMissing ? (
          <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-6">
            <h1 className="text-lg font-extrabold">No such project</h1>
            <p className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
              Project #{projectId} does not exist or is owned by someone else.
            </p>
            <a className="btn mt-4 inline-flex text-[13px]" href="#/director">
              Back to Director home
            </a>
          </div>
        ) : (
          <StageBody
            stage={stage}
            projectId={projectId}
            data={data}
            planView={planView}
            onPlanViewChange={setPlanView}
            selectedNodeKey={focusedNodeKey}
            onSelectNode={selectNode}
            userName={user.name ?? user.email ?? "owner"}
            focusedApprovalId={focusedApprovalId}
            setFocusedApprovalId={setFocusedApprovalId}
            focusedNodeKey={focusedNodeKey}
            setFocusedNodeKey={setFocusedNodeKey}
            onInspectNode={setInspectedNodeKey}
            onDecide={onDecide}
            deciding={decideM.isPending}
            decideError={decideM.error?.message ?? null}
          />
        )}
      </main>

      {/* ── Zone D: approvals inbox over ownership queue ── */}
      <div className="dw-right">
        <div id="dw-approvals">
          <ApprovalsInbox
            approvals={data.pendingApprovals}
            onDecide={onDecide}
            deciding={decideM.isPending}
            focusedId={focusedApprovalId}
            onFocus={setFocusedApprovalId}
            error={decideM.error?.message ?? null}
          />
        </div>
        <div id="dw-queue" className="flex min-h-0 flex-1 flex-col">
          <QueueTable
            rows={data.queueRows}
            noRun={!data.activeRun && !data.apiDown}
            leaseUnavailableReason={data.controlFeedError}
            focusedKey={focusedNodeKey}
            onFocus={setFocusedNodeKey}
            onInspect={setInspectedNodeKey}
          />
        </div>
      </div>

      {/* ── Node inspector (assign / reassign / cancel) ── */}
      <NodeInspector
        row={data.queueRows?.find((r) => r.nodeKey === inspectedNodeKey) ?? null}
        workers={
          data.controlPlane.pool.status === "live" ? data.controlPlane.pool.data.workers : []
        }
        controls={data.controlPlane.nodeControls}
        open={
          inspectedNodeKey != null &&
          !!data.queueRows?.some((r) => r.nodeKey === inspectedNodeKey)
        }
        onClose={() => setInspectedNodeKey(null)}
      />

      {/* ── Zone E: operations deck ── */}
      <OpsDeck
        projectId={projectId}
        data={data}
        stopConfirmOpen={stopConfirmOpen}
        onStopConfirmChange={setStopConfirmOpen}
      />

      {/* ── Status bar ── */}
      <footer className="dw-statusbar" aria-label="System status">
        {data.apiDown ? (
          <span className="text-[hsl(8_62%_65%)]">
            ● API down — {data.apiError}
          </span>
        ) : (
          <span>
            <span className="text-[hsl(82_30%_60%)]">●</span> API healthy
          </span>
        )}
        <span>polling 2–5 s · paused when tab hidden</span>
        <span>reduced-motion: respected</span>
        <span className="ml-auto hidden gap-4 md:flex">
          <button type="button" className="underline" onClick={() => setHelpOpen(true)}>
            <Kbd aria-hidden>?</Kbd> shortcuts
          </button>
          <span aria-hidden>
            G Q queue · G A approvals · G E artifacts · G B office
          </span>
        </span>
      </footer>

      {/* ── Mobile bottom section nav ── */}
      <nav className="dw-bottomnav" aria-label="Director sections">
        {data.stages.map((s) => {
          const meta = { goal: "01", roadmap: "02", queue: "03", control: "04", evidence: "05" }[s.id];
          return (
            <button
              key={s.id}
              type="button"
              className="dw-step"
              data-active={stage === s.id}
              data-attention={stage !== s.id && s.attention}
              aria-current={stage === s.id ? "step" : undefined}
              onClick={() => setStage(s.id)}
            >
              <span className="dw-step-num" aria-hidden>{meta}</span>
              <span className="dw-step-name text-[12px]">{s.id}</span>
            </button>
          );
        })}
      </nav>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />

      {/* ── Shortcut help ── */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard map</DialogTitle>
            <DialogDescription>
              Direct shortcuts work when you are not typing in a field.
              Approval decisions always ask for confirmation.
            </DialogDescription>
          </DialogHeader>
          <table className="table-cat text-[13px]">
            <tbody>
              {[
                ["⌘K / Ctrl+K", "command palette"],
                ["1 / 2", "plan view: Graph / List"],
                ["G then Q / A / E / R", "focus queue / approvals / artifacts / roadmap"],
                ["G then B / T / W", "office blueprint / team board / whiteboard"],
                ["J / K", "next / previous queue row or approval"],
                ["Enter", "inspect focused item"],
                ["A / R", "approve / reject focused approval (with confirmation)"],
                ["S", "stop run (two-step confirmation)"],
                ["?", "this help"],
              ].map(([keys, action]) => (
                <tr key={keys}>
                  <td className="mono text-[12px] font-bold">{keys}</td>
                  <td>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Center-stage switch: exactly one primary surface at a time. */
function StageBody({
  stage,
  projectId,
  data,
  planView,
  onPlanViewChange,
  selectedNodeKey,
  onSelectNode,
  userName,
  focusedApprovalId,
  setFocusedApprovalId,
  focusedNodeKey,
  setFocusedNodeKey,
  onInspectNode,
  onDecide,
  deciding,
  decideError,
}: {
  stage: StageId;
  projectId: number;
  data: ReturnType<typeof useWorkspaceData>;
  planView: PlanView | null;
  onPlanViewChange(v: PlanView): void;
  selectedNodeKey: string | null;
  onSelectNode(k: string | null): void;
  userName: string;
  focusedApprovalId: number | null;
  setFocusedApprovalId(id: number | null): void;
  focusedNodeKey: string | null;
  setFocusedNodeKey(k: string | null): void;
  onInspectNode(k: string): void;
  onDecide(id: number, decision: Decision, note: string): void;
  deciding: boolean;
  decideError: string | null;
}) {
  switch (stage) {
    case "goal":
      return <GoalStage projectId={projectId} data={data} />;
    case "roadmap":
      return (
        <PlanStage
          projectId={projectId}
          roadmap={data.roadmap}
          view={planView}
          onViewChange={onPlanViewChange}
          office={{
            activeRun: data.activeRun,
            userName,
            selectedNodeKey,
            onSelect: onSelectNode,
          }}
        />
      );
    case "queue":
      return (
        <div className="border border-[hsl(var(--line))]">
          <QueueTable
            rows={data.queueRows}
            noRun={!data.activeRun}
            leaseUnavailableReason={data.controlFeedError}
            focusedKey={focusedNodeKey}
            onFocus={setFocusedNodeKey}
            onInspect={onInspectNode}
          />
        </div>
      );
    case "control":
      if (!data.activeRun) {
        return (
          <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-6">
            <h1 className="text-lg font-extrabold">No run to control</h1>
            <p className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
              Approve a plan revision in the Roadmap stage and start a mock or
              live run; the console, budget meters, and gates appear here.
            </p>
            {data.pendingApprovals.length ? (
              <div className="mt-4 border border-[hsl(var(--line))]">
                <ApprovalsInbox
                  approvals={data.pendingApprovals}
                  onDecide={onDecide}
                  deciding={deciding}
                  focusedId={focusedApprovalId}
                  onFocus={setFocusedApprovalId}
                  error={decideError}
                />
              </div>
            ) : null}
          </div>
        );
      }
      return (
        <div className="grid gap-3">
          {data.runs.length > 1 ? (
            <nav aria-label="Run history" className="flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="font-bold text-[hsl(var(--ink-soft))]">Runs:</span>
              {data.runs.slice(0, 12).map((r) => (
                <a
                  key={r.id}
                  href={`#/director/projects/${projectId}/runs/${r.id}`}
                  className={`chip ${r.id === data.activeRun!.id ? "chip-cornflower" : ""}`}
                  aria-current={r.id === data.activeRun!.id ? "true" : undefined}
                >
                  #{r.id} {r.state}
                </a>
              ))}
            </nav>
          ) : null}
          <Suspense
            fallback={
              <div
                className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-6 text-[13px] text-[hsl(var(--ink-soft))]"
                role="status"
              >
                Loading run console…
              </div>
            }
          >
            <RunConsole runId={data.activeRun.id} projectId={projectId} />
          </Suspense>
        </div>
      );
    case "evidence":
      return <EvidenceStage projectId={projectId} data={data} />;
  }
}

/** Stage 01 — the goal as the single serif brief, plus project maintenance. */
function GoalStage({
  projectId,
  data,
}: {
  projectId: number;
  data: ReturnType<typeof useWorkspaceData>;
}) {
  const utils = trpc.useUtils();
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState("");
  const renameM = trpc.projects.rename.useMutation({
    onSuccess: () => {
      setRenameOpen(false);
      void utils.projects.get.invalidate({ id: projectId });
      void utils.projects.list.invalidate();
    },
  });
  const p = data.project;
  if (!p) return <ErrorNote message="project is unavailable" />;
  return (
    <section aria-labelledby="dw-goalstage-heading" className="grid max-w-3xl gap-4">
      <span className="kicker">01 · Goal</span>
      <h1 id="dw-goalstage-heading" className="text-2xl font-extrabold tracking-tight">
        {p.name}
      </h1>
      <p className="prose-evidence text-[16px] leading-relaxed">{p.goal}</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="chip chip-mustard">risk: {p.riskTier}</span>
        <span className="chip">{p.status}</span>
        <span className="chip mono">project #{p.id}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn text-[13px]"
          onClick={() => {
            setName(p.name);
            setRenameOpen(true);
          }}
        >
          Rename project
        </button>
      </div>
      <p className="text-[12px] text-[hsl(var(--ink-soft))]">
        The goal text and risk tier are fixed at creation for now — the API
        exposes rename only. Approved plan hashes are never silently
        invalidated by edits here.
      </p>

      <GoalModePanel />
      <AutonomyPanel
        projectId={projectId}
        riskTier={p.riskTier}
        activeRun={data.activeRun}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              Renaming does not touch the goal, plan revisions, or runs.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              renameM.mutate({ id: projectId, name });
            }}
          >
            <label className="text-[13px] font-bold">
              Name
              <input
                required
                className="input mt-1 text-[13px]"
                value={name}
                maxLength={255}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {renameM.error ? <ErrorNote message={renameM.error.message} /> : null}
            <div>
              <button type="submit" className="btn text-[13px]" disabled={renameM.isPending}>
                {renameM.isPending ? "Saving…" : "Save name"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
