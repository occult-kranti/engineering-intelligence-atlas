import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { defaultRunBudget } from "@contracts/dag";
import { ErrorNote } from "./DirectorShell";
import { navigate } from "@/lib/utils";

export default function Projects({ focusId }: { focusId?: number }) {
  const utils = trpc.useUtils();
  const list = trpc.projects.list.useQuery();
  const create = trpc.projects.create.useMutation({
    onSuccess: (p) => {
      void utils.projects.list.invalidate();
      navigate(`#/director/projects/${p.id}/graph`);
    },
  });
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [riskTier, setRiskTier] = useState<"low" | "medium" | "high">("medium");

  const runsQ = trpc.runs.listByProject.useQuery(
    { projectId: focusId! },
    { enabled: !!focusId },
  );
  const exportsQ = trpc.exports.list.useQuery(
    { projectId: focusId! },
    { enabled: !!focusId },
  );
  const exportNow = trpc.exports.create.useMutation();
  const exportUrl = trpc.exports.downloadUrl.useMutation({
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
  });

  if (list.error) {
    return (
      <ErrorNote
        message={`projects could not be loaded (${list.error.message}). The Director API may be unavailable; the public atlas still works.`}
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Projects</h1>
      <p className="prose-evidence mt-1 text-sm text-[hsl(var(--ink-soft))]">
        Owner-scoped research projects. Each project carries a goal, a risk
        tier, and token/call/minute/dollar budgets enforced server-side.
      </p>

      <form
        className="mt-5 grid gap-3 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name, goal, riskTier, budget: defaultRunBudget() });
        }}
      >
        <h2 className="text-sm font-bold">New project</h2>
        <label className="text-xs font-bold">
          Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-[hsl(var(--line))] bg-transparent p-2 text-sm"
          />
        </label>
        <label className="text-xs font-bold">
          Research goal
          <textarea
            required
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            className="mt-1 w-full border border-[hsl(var(--line))] bg-transparent p-2 text-sm"
          />
        </label>
        <label className="text-xs font-bold">
          Risk tier
          <select
            value={riskTier}
            onChange={(e) => setRiskTier(e.target.value as typeof riskTier)}
            className="mt-1 border border-[hsl(var(--line))] bg-transparent p-2 text-sm"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        {create.error ? <ErrorNote message={create.error.message} /> : null}
        <div>
          <button type="submit" className="tab-control" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>

      <div className="mt-6 grid gap-3">
        {(list.data ?? []).map((p) => (
          <article
            key={p.id}
            className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <a
                href={`#/director/projects/${p.id}`}
                className="text-base font-bold underline"
              >
                {p.name}
              </a>
              <span className="chip chip-mustard">{p.riskTier}</span>
              <span className="chip">{p.status}</span>
            </div>
            <p className="prose-evidence mt-1 text-sm">{p.goal}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="tab-control text-xs" href={`#/director/projects/${p.id}/graph`}>
                Plan / DAG editor
              </a>
              <a className="tab-control text-xs" href={`#/director/projects/${p.id}`}>
                Runs & exports
              </a>
            </div>
          </article>
        ))}
        {list.data && list.data.length === 0 ? (
          <p className="text-sm text-[hsl(var(--ink-soft))]">No projects yet.</p>
        ) : null}
      </div>

      {focusId ? (
        <section className="mt-10">
          <h2 className="text-lg font-extrabold tracking-tight">Runs</h2>
          <ul className="mt-3 grid gap-2">
            {(runsQ.data ?? []).map((r) => (
              <li key={r.id} className="border border-[hsl(var(--line))] p-3 text-sm">
                <a className="font-bold underline" href={`#/director/projects/${focusId}/runs/${r.id}`}>
                  Run #{r.id}
                </a>{" "}
                · {r.mode} · {r.provider}
                {r.model ? `/${r.model}` : ""} · state <b>{r.state}</b>
                {r.endReason ? ` — ${r.endReason}` : ""}
              </li>
            ))}
          </ul>
          <h2 className="mt-8 text-lg font-extrabold tracking-tight">Exports</h2>
          <button
            type="button"
            className="tab-control mt-2 text-xs"
            onClick={() =>
              exportNow.mutate(
                { projectId: focusId, format: "markdown" },
                { onSuccess: () => void exportsQ.refetch() },
              )
            }
          >
            Export project report (Markdown → storage)
          </button>
          {exportNow.error ? <ErrorNote message={exportNow.error.message} /> : null}
          <ul className="mt-3 grid gap-2">
            {(exportsQ.data ?? []).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 border border-[hsl(var(--line))] p-3 text-sm">
                <span>
                  #{x.id} · {x.format} ·{" "}
                  {x.storageError ? `storage error ${x.storageError}` : "stored"}
                </span>
                {x.storageKey ? (
                  <button
                    type="button"
                    className="tab-control text-xs"
                    onClick={() => exportUrl.mutate({ id: x.id })}
                  >
                    Download (fresh URL)
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[hsl(var(--ink-soft))]">
            Only keys are persisted; download URLs are minted fresh (~10 min).
            Mock-run costs shown anywhere are simulated cents, not billing.
          </p>
          <BudgetLegend />
        </section>
      ) : null}
    </div>
  );
}

export function BudgetLegend() {
  return null;
}
