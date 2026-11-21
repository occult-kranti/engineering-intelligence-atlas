import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { defaultRunBudget } from "@contracts/dag";
import { TERMINAL_RUN_STATES } from "@contracts/run";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorNote } from "./DirectorShell";
import { navigate } from "@/lib/utils";

/**
 * Director home — project overview. Counts and status at a glance, a clear
 * create-project flow (dialog, not an always-on form), and secondary links
 * to skills / integrations / settings. Per-project run counts use the
 * existing runs.listByProject endpoint; nothing is simulated.
 */
export default function DirectorHome() {
  const list = trpc.projects.list.useQuery(undefined, { retry: false });
  const approvalsQ = trpc.approvals.listPending.useQuery(
    {},
    { refetchInterval: 5000, retry: false },
  );
  const [createOpen, setCreateOpen] = useState(false);

  if (list.error) {
    return (
      <ErrorNote
        message={`projects could not be loaded (${list.error.message}). The Director API may be unavailable; the public atlas still works.`}
      />
    );
  }

  const projects = list.data ?? [];
  const active = projects.filter((p) => p.status === "active").length;
  const pending = approvalsQ.data?.length;

  return (
    <div className="dw">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Projects</h1>
          <p className="prose-evidence mt-1 max-w-2xl text-[14px] text-[hsl(var(--ink-soft))]">
            Owner-scoped research projects. Each carries a goal, a risk tier,
            and token/call/minute/dollar budgets enforced server-side. Open a
            project to enter its command workspace.
          </p>
        </div>
        <button
          type="button"
          className="btn ml-auto border-[hsl(var(--ink))] text-[14px] font-bold"
          onClick={() => setCreateOpen(true)}
        >
          New project
        </button>
      </div>

      {/* Counts / status strip */}
      <dl className="mt-4 flex flex-wrap gap-2">
        <Stat label="projects" value={list.data ? `${projects.length}` : "…"} />
        <Stat label="active" value={list.data ? `${active}` : "…"} />
        <Stat
          label="draft / archived"
          value={list.data ? `${projects.length - active}` : "…"}
        />
        <Stat
          label="approvals pending"
          value={pending != null ? `${pending}` : "…"}
          tone={pending ? "mustard" : undefined}
          href="#/director/approvals"
        />
      </dl>

      {list.isLoading ? (
        <div className="mt-6 grid gap-3" aria-label="Loading projects">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))]"
            />
          ))}
        </div>
      ) : projects.length ? (
        <ol className="mt-6 grid gap-3" aria-label="Projects">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </ol>
      ) : (
        <div className="mt-8 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-8 text-center">
          <h2 className="text-lg font-extrabold">No projects yet</h2>
          <p className="prose-evidence mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[hsl(var(--ink-soft))]">
            A project pairs one research goal with an approved agent squad and
            hard budget limits. Create the first one — the plan starts empty
            and nothing runs until you approve it.
          </p>
          <button
            type="button"
            className="btn mt-4 border-[hsl(var(--ink))] text-[14px] font-bold"
            onClick={() => setCreateOpen(true)}
          >
            Create the first project
          </button>
          <p className="mt-3 text-[13px]">
            <a className="ext-link" href="#/overview">
              Browse the public atlas
            </a>{" "}
            <span className="text-[hsl(var(--ink-soft))]">
              — no sign-in needed for the evidence catalog.
            </span>
          </p>
        </div>
      )}

      {/* Secondary surfaces — deliberately not peers of the flow */}
      <nav aria-label="Supporting surfaces" className="mt-10 border-t border-[hsl(var(--line))] pt-4">
        <span className="kicker">Supporting</span>
        <div className="mt-2 flex flex-wrap gap-2">
          <a className="btn text-[13px]" href="#/director/enterprises">
            Enterprises (CEO)
          </a>
          <a className="btn text-[13px]" href="#/director/approvals">
            Approvals{pending ? ` (${pending})` : ""}
          </a>
          <a className="btn text-[13px]" href="#/director/skills">
            Skill registry
          </a>
          <a className="btn text-[13px]" href="#/director/integrations">
            Integrations
          </a>
          <a className="btn text-[13px]" href="#/director/settings">
            Settings
          </a>
        </div>
      </nav>

      <NewProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: string;
  tone?: "mustard";
  href?: string;
}) {
  const inner = (
    <>
      <dt className="text-[12px] font-bold uppercase tracking-wider text-[hsl(var(--ink-soft))]">
        {label}
      </dt>
      <dd className={`mono text-xl font-bold ${tone === "mustard" ? "text-[hsl(40_85%_28%)]" : ""}`}>
        {value}
      </dd>
    </>
  );
  const cls =
    "grid gap-0.5 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] px-4 py-3";
  return href ? (
    <a href={href} className={`${cls} hover:border-[hsl(var(--ink))]`}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function ProjectCard({
  project,
}: {
  project: { id: number; name: string; goal: string; riskTier: string; status: string };
}) {
  const runsQ = trpc.runs.listByProject.useQuery(
    { projectId: project.id },
    { retry: false },
  );
  const runs = runsQ.data ?? [];
  const activeRuns = runs.filter((r) => !TERMINAL_RUN_STATES.has(r.state));
  const latest = runs[0];

  return (
    <li>
      <article className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <a
            href={`#/director/projects/${project.id}`}
            className="text-[16px] font-bold underline"
          >
            {project.name}
          </a>
          <span className="chip chip-mustard">risk: {project.riskTier}</span>
          <span className="chip">{project.status}</span>
          {activeRuns.map((r) => (
            <span key={r.id} className="chip chip-cornflower">
              run #{r.id} {r.state}
            </span>
          ))}
          {!runsQ.isLoading && !activeRuns.length && latest ? (
            <span className="chip">last run #{latest.id} {latest.state}</span>
          ) : null}
          {runsQ.error ? (
            <span className="chip chip-alert">runs unavailable</span>
          ) : null}
        </div>
        <p className="prose-evidence mt-1 text-[14px]">{project.goal}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn text-[13px]" href={`#/director/projects/${project.id}`}>
            Open workspace
          </a>
          <a
            className="btn text-[13px]"
            href={`#/director/projects/${project.id}/runs`}
          >
            Runs ({runsQ.data ? runs.length : "…"})
          </a>
        </div>
      </article>
    </li>
  );
}

function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const utils = trpc.useUtils();
  const create = trpc.projects.create.useMutation({
    onSuccess: (p) => {
      void utils.projects.list.invalidate();
      onOpenChange(false);
      navigate(`#/director/projects/${p.id}`);
    },
  });
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [riskTier, setRiskTier] = useState<"low" | "medium" | "high">("medium");
  const budget = defaultRunBudget();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Creates the project and an empty plan revision. Nothing runs until
            you propose a squad, save, and approve a revision.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ name, goal, riskTier, budget });
          }}
        >
          <label className="text-[13px] font-bold">
            Name
            <input
              required
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1 text-[13px]"
            />
          </label>
          <label className="text-[13px] font-bold">
            Research goal
            <textarea
              required
              maxLength={8000}
              rows={4}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="input mt-1 text-[13px]"
            />
          </label>
          <label className="text-[13px] font-bold">
            Risk tier
            <select
              value={riskTier}
              onChange={(e) => setRiskTier(e.target.value as typeof riskTier)}
              className="input mt-1 text-[13px]"
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
          <p className="border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-2 text-[12px] text-[hsl(var(--ink-soft))]">
            Default run budget: {budget.maxTokens.toLocaleString()} tokens ·{" "}
            {budget.maxCalls} calls · {budget.maxMinutes} min · $
            {budget.maxCostUsd.toFixed(2)} — adjustable per plan and per node
            in the Roadmap stage; enforced server-side.
          </p>
          {create.error ? <ErrorNote message={create.error.message} /> : null}
          <div className="flex gap-2">
            <button type="submit" className="btn text-[13px] font-bold" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create project"}
            </button>
            <button type="button" className="btn text-[13px]" onClick={() => onOpenChange(false)}>
              Cancel
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
