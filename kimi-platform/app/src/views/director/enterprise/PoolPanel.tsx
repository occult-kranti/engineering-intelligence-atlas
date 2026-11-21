import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { ErrorNote } from "../DirectorShell";
import { deriveDepartmentPool, type SnapshotLike, type WorkerRowLike } from "./adapter";

/**
 * Departments + the shared worker pool. Staffed/unstaffed counts are the
 * contract truth (a contract is staffed iff its skill pin resolved in the
 * vetted registry at apply time). Per-employee controls dispatch the real
 * backend mutations with server-side OCC — concurrent edits surface CONFLICT
 * instead of silently winning.
 */
export default function PoolPanel({
  snapshot,
  workers,
  workersError,
  workersLoading,
}: {
  snapshot: SnapshotLike;
  workers: WorkerRowLike[];
  workersError: string | null;
  workersLoading: boolean;
}) {
  const pool = deriveDepartmentPool(snapshot, workers);
  return (
    <div className="grid gap-4">
      <section aria-label="Departments" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
        <span className="kicker">Shared departments ({pool.length})</span>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {pool.map((d) => (
            <article key={d.key} className="border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-3" data-department-key={d.key}>
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-[14px] font-extrabold">{d.name}</h3>
                <span className="chip chip-neutral">{d.discipline}</span>
                <span className="chip mono">owner: {d.ownerCompanyKey}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
                <span className="chip chip-sage">{d.staffedContracts} staffed contracts</span>
                {d.unstaffedContracts ? (
                  <span className="chip chip-mustard">{d.unstaffedContracts} unstaffed</span>
                ) : null}
                <span className="chip">{d.workers.length} pooled workers</span>
                <span className="chip">group capacity {d.totalCapacity}</span>
                {d.suspendedWorkers ? (
                  <span className="chip chip-mustard">{d.suspendedWorkers} suspended</span>
                ) : null}
              </div>
              {d.capacityGroupId ? (
                <p className="mono mt-1 text-[11px] text-[hsl(var(--ink-soft))]">pool {d.capacityGroupId}</p>
              ) : (
                <p className="mt-1 text-[11px] text-[hsl(var(--ink-soft))]">
                  no shared capacity pool yet — created when the first contract is approved
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section aria-label="Worker pool" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
        <span className="kicker">Worker pool ({workers.length})</span>
        {workersError ? (
          <div className="mt-2">
            <ErrorNote message={`the worker pool could not be loaded (${workersError}). Controls are hidden rather than shown dead.`} />
          </div>
        ) : workersLoading ? (
          <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]" role="status">Loading workers…</p>
        ) : workers.length === 0 ? (
          <p className="prose-evidence mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
            No pooled workers yet. Approving a staffed contract mints the
            origin pool worker and the borrowing-company secondee; stewards are
            deterministic system metadata and never appear here.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {workers.map((w) => (
              <WorkerRow key={w.id} worker={w} snapshot={snapshot} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function WorkerRow({ worker, snapshot }: { worker: WorkerRowLike; snapshot: SnapshotLike }) {
  const utils = trpc.useUtils();
  const invalidate = () => {
    void utils.enterprise.workers.invalidate({ enterpriseId: snapshot.enterprise.id });
    void utils.enterprise.snapshot.invalidate({ enterpriseId: snapshot.enterprise.id });
  };
  const suspendM = trpc.enterprise.workerSuspend.useMutation({ onSuccess: invalidate });
  const capacityM = trpc.enterprise.workerCapacity.useMutation({ onSuccess: invalidate });
  const reassignM = trpc.enterprise.workerReassign.useMutation({ onSuccess: invalidate });
  const error = suspendM.error ?? capacityM.error ?? reassignM.error;
  const pending = suspendM.isPending || capacityM.isPending || reassignM.isPending;
  const [capacity, setCapacity] = useState(String(worker.maxConcurrentClaims));
  const [departmentId, setDepartmentId] = useState(worker.departmentId === null ? "" : String(worker.departmentId));
  const suspended = worker.status === "suspended";
  const department = snapshot.departments.find((d) => d.id === worker.departmentId);

  return (
    <li className="border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-3" data-worker-id={worker.id}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-[13px] font-bold">{worker.name}</span>
        <span className={`chip ${suspended ? "chip-mustard" : "chip-sage"}`}>{worker.status}</span>
        <span className="chip chip-neutral">{worker.role}</span>
        {worker.companyKey ? <span className="chip mono">company {worker.companyKey}</span> : null}
        {department ? <span className="chip mono">dept {department.key}</span> : <span className="chip">no department pool</span>}
        <span className="chip">capacity {worker.maxConcurrentClaims}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <button
          type="button"
          className="btn text-[12px]"
          disabled={pending}
          onClick={() => suspendM.mutate({ workerId: worker.id, suspended: !suspended })}
        >
          {suspended ? "Resume" : "Suspend"}
        </button>
        <label className="text-[12px] font-bold">
          Max claims
          <select
            className="input ml-1 inline-block min-h-[36px] w-auto text-[12px]"
            value={capacity}
            disabled={pending}
            onChange={(e) => {
              setCapacity(e.target.value);
              capacityM.mutate({ workerId: worker.id, maxConcurrentClaims: Number(e.target.value) });
            }}
            aria-label={`Max concurrent claims for ${worker.name}`}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-bold">
          Reassign
          <select
            className="input ml-1 inline-block min-h-[36px] w-auto text-[12px]"
            value={departmentId}
            disabled={pending}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              reassignM.mutate({
                workerId: worker.id,
                departmentId: e.target.value === "" ? null : Number(e.target.value),
              });
            }}
            aria-label={`Reassign ${worker.name} to a department pool`}
          >
            <option value="">no pool (standalone)</option>
            {snapshot.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p className="mt-2 text-[12px] text-[hsl(8_64%_30%)]" role="alert">
          {/CONCURRENT|concurrently/i.test(error.message)
            ? `Conflict: ${error.message} — the row changed under you; it has been refreshed.`
            : error.message}
        </p>
      ) : null}
    </li>
  );
}
