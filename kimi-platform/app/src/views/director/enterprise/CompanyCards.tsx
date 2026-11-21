import type { PlanStatus, SnapshotLike, WorkerRowLike } from "./adapter";

/**
 * Company cards: each company links its real project office/workspace, shows
 * its plan-approval truth (drafts stay unapproved until a human approves in
 * the company project), its program run status, and its worker count.
 */
export default function CompanyCards({
  snapshot,
  planStatusByKey,
  workers,
}: {
  snapshot: SnapshotLike;
  planStatusByKey: Map<string, PlanStatus>;
  workers: WorkerRowLike[];
}) {
  const runByCompany = new Map(snapshot.program?.companyRuns.map((cr) => [cr.companyKey, cr]) ?? []);
  return (
    <section aria-label="Companies">
      <ol className="grid gap-3 md:grid-cols-2">
        {snapshot.companies.map((c) => {
          const plan = planStatusByKey.get(c.key);
          const run = runByCompany.get(c.key);
          const companyWorkers = workers.filter((w) => w.companyKey === c.key);
          const contracts = snapshot.contracts.filter((w) => w.companyId === c.id);
          const departments = snapshot.departments.filter((d) => d.companyId === c.id);
          return (
            <li key={c.key}>
              <article className="grid gap-2 border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4" data-company-key={c.key}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-[16px] font-extrabold">{c.name}</h2>
                  <span className="chip">{c.kind}</span>
                  {c.active ? (
                    <span className="chip chip-sage">active</span>
                  ) : (
                    <span className="chip chip-mustard">inactive · zero budget</span>
                  )}
                </div>
                <p className="prose-evidence text-[13px] text-[hsl(var(--ink-soft))]">{c.mission}</p>
                <div className="flex flex-wrap gap-1.5 text-[12px]">
                  {c.disciplines.map((d) => (
                    <span key={d} className="chip chip-neutral">{d}</span>
                  ))}
                </div>
                <dl className="flex flex-wrap gap-2 text-[12px]">
                  <span className="chip">{departments.length} departments</span>
                  <span className="chip">
                    {contracts.filter((w) => w.staffed).length}/{contracts.length} contracts staffed
                  </span>
                  <span className="chip">{companyWorkers.length} workers</span>
                  {run ? (
                    <span className={`chip ${run.status === "completed" ? "chip-sage" : run.status === "running" ? "chip-cornflower" : run.status === "pending" ? "" : "chip-alert"}`}>
                      run: {run.status}
                    </span>
                  ) : null}
                </dl>

                {/* Plan gate truth — approve in the company project, never here. */}
                <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-2 text-[13px]">
                  {plan?.state === "approved" ? (
                    <span className="chip chip-sage">plan approved · rev {plan.revision}</span>
                  ) : plan?.state === "unapproved" ? (
                    <span className="chip chip-mustard">plan draft unapproved · rev {plan.revision}</span>
                  ) : plan?.state === "no-plan" ? (
                    <span className="chip chip-mustard">no plan revision</span>
                  ) : (
                    <span className="chip">{plan?.detail ?? "plan status unknown"}</span>
                  )}
                  <p className="mt-1 text-[12px] text-[hsl(var(--ink-soft))]">{plan?.detail}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a className="btn text-[13px]" href={`#/director/projects/${c.projectId}`}>
                    Open project office / workspace
                  </a>
                  {plan?.state === "unapproved" ? (
                    <a className="btn border-[hsl(var(--mustard))] text-[13px] font-bold" href={`#/director/projects/${c.projectId}`}>
                      Review & approve plan (roadmap stage)
                    </a>
                  ) : null}
                  {run?.runId != null ? (
                    <a className="btn text-[13px]" href={`#/director/projects/${c.projectId}/runs/${run.runId}`}>
                      Run #{run.runId}
                    </a>
                  ) : null}
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
