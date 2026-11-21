import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AssignmentMode } from "@contracts/run";
import type {
  ControlActionResult,
  ControlError,
  NodeControls,
  QueueRow,
  WorkerView,
} from "./adapter";

const ASSIGNABLE_STATES = new Set(["pending", "ready", "waiting"]);
const REASSIGNABLE_STATES = new Set(["ready", "claimed", "running", "waiting", "paused"]);
const TERMINAL_STATES = new Set(["accepted", "failed", "skipped", "cancelled"]);

/**
 * Node inspector — the owner-level control surface for one run node.
 * Opens from the queue table (Enter / Inspect). Everything here is a real
 * control-router mutation with an idempotency key; cancellation sends the
 * row's OCC version as expectedVersion, so a stale view loses with an
 * honest 409 instead of cancelling the wrong state.
 */
export default function NodeInspector({
  row,
  workers,
  controls,
  open,
  onClose,
}: {
  row: QueueRow | null;
  workers: WorkerView[];
  controls: NodeControls | null;
  open: boolean;
  onClose(): void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        {row ? (
          <InspectorBody row={row} workers={workers} controls={controls} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function InspectorBody({
  row,
  workers,
  controls,
}: {
  row: QueueRow;
  workers: WorkerView[];
  controls: NodeControls | null;
}) {
  const [workerId, setWorkerId] = useState<number | "">(row.assignedWorkerId ?? "");
  const [mode, setMode] = useState<AssignmentMode>(
    (row.assignmentMode as AssignmentMode | null) ?? "hybrid",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<ControlError | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const canAssign = controls != null && ASSIGNABLE_STATES.has(row.state);
  const canReassign = controls != null && REASSIGNABLE_STATES.has(row.state);
  const canCancel = controls != null && !TERMINAL_STATES.has(row.state) && row.state !== "unscheduled";

  const act = async <T,>(
    label: string,
    fn: () => Promise<ControlActionResult<T>>,
  ): Promise<T | null> => {
    setBusy(label);
    setError(null);
    setNote(null);
    const r = await fn();
    setBusy(null);
    if (r.ok) return r.data;
    setError(r.error);
    return null;
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Task <span className="mono">{row.nodeKey}</span>
        </DialogTitle>
        <DialogDescription>
          Owner controls are deliberate and audited. Cancellation is terminal
          and propagates downstream; reassignment fences the current lease.
        </DialogDescription>
      </DialogHeader>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
        <dt className="text-[hsl(var(--ink-soft))]">State</dt>
        <dd>
          <span className="chip">{row.awaitingHuman ? "awaiting you" : row.state}</span>
        </dd>
        <dt className="text-[hsl(var(--ink-soft))]">Plan role</dt>
        <dd>{row.ownerRole ?? "—"}</dd>
        <dt className="text-[hsl(var(--ink-soft))]">Assigned worker</dt>
        <dd>{row.assignedWorkerName ?? "unassigned"}</dd>
        <dt className="text-[hsl(var(--ink-soft))]">Assignment mode</dt>
        <dd>{row.assignmentMode ?? "—"}</dd>
        <dt className="text-[hsl(var(--ink-soft))]">Version (OCC)</dt>
        <dd className="mono">v{row.version}</dd>
        <dt className="text-[hsl(var(--ink-soft))]">Attempts</dt>
        <dd className="mono">{row.attempts}</dd>
        <dt className="text-[hsl(var(--ink-soft))]">Dependencies</dt>
        <dd>
          {row.dependencies.total === 0
            ? "none"
            : row.dependencies.unmet === 0
              ? `${row.dependencies.total} met`
              : `awaits ${row.dependencies.unmetKeys.join(", ")}`}
        </dd>
        <dt className="text-[hsl(var(--ink-soft))]">Lease</dt>
        <dd>
          {row.lease.status === "live"
            ? row.lease.data.stale
              ? `expired (held by ${row.lease.data.holder}) — will be swept`
              : `held by ${row.lease.data.holder} · expires in ${row.lease.data.expiresInSec}s · hb ${row.lease.data.heartbeatAgeSec}s ago`
            : row.lease.reason}
        </dd>
      </dl>
      {row.blockedReason ? (
        <p className="text-[12px] text-[hsl(var(--ink-soft))]">{row.blockedReason}</p>
      ) : null}

      {controls ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[12px] font-bold">
              Worker
              <select
                className="input mt-1 block text-[13px]"
                value={workerId}
                onChange={(e) =>
                  setWorkerId(e.target.value === "" ? "" : Number(e.target.value))
                }
              >
                <option value="">unassigned (self-claimable)</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label} · {w.role}
                    {w.suspended ? " · suspended" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] font-bold">
              Mode
              <select
                className="input mt-1 block text-[13px]"
                value={mode}
                onChange={(e) => setMode(e.target.value as AssignmentMode)}
              >
                <option value="hybrid">hybrid</option>
                <option value="director">director</option>
                <option value="self-claim">self-claim</option>
              </select>
            </label>
            <button
              type="button"
              className="btn min-h-[36px] px-2 text-[12px]"
              disabled={busy != null || !canAssign}
              title={
                canAssign
                  ? "Assign without touching any lease"
                  : `cannot assign while ${row.state}`
              }
              onClick={() =>
                void act("assign", () =>
                  controls.assign({
                    nodeKey: row.nodeKey,
                    workerId: workerId === "" ? null : workerId,
                    assignmentMode: mode,
                  }),
                ).then((d) => d && setNote(`assigned ${row.nodeKey}`))
              }
            >
              {busy === "assign" ? "Assigning…" : "Assign"}
            </button>
            <button
              type="button"
              className="btn min-h-[36px] px-2 text-[12px]"
              disabled={busy != null || !canReassign}
              title={
                canReassign
                  ? "Fence the current lease, return to ready, retarget"
                  : `cannot reassign while ${row.state}`
              }
              onClick={() =>
                void act("reassign", () =>
                  controls.reassign({
                    nodeKey: row.nodeKey,
                    workerId: workerId === "" ? null : workerId,
                  }),
                ).then((d) => d && setNote(`reassigned ${row.nodeKey} (previous lease fenced)`))
              }
            >
              {busy === "reassign" ? "Reassigning…" : "Reassign (fences lease)"}
            </button>
          </div>

          {!confirmCancel ? (
            <button
              type="button"
              className="btn min-h-[36px] px-2 text-[12px]"
              disabled={busy != null || !canCancel}
              title={canCancel ? "Cancel this node and its downstream" : `nothing to cancel while ${row.state}`}
              onClick={() => setConfirmCancel(true)}
            >
              Cancel node…
            </button>
          ) : (
            <div className="dw-notice" data-severity="alert" role="alertdialog" aria-label="Confirm cancellation">
              <span className="text-[13px]">
                Cancel <b className="mono">{row.nodeKey}</b> at v{row.version} and every
                non-terminal downstream node? This is terminal and recorded.
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  className="btn min-h-[36px] px-2 text-[12px]"
                  disabled={busy != null}
                  onClick={() =>
                    void act("cancel", () =>
                      controls.cancel({ nodeKey: row.nodeKey, expectedVersion: row.version }),
                    ).then((d) => {
                      if (d) {
                        setConfirmCancel(false);
                        setNote(`cancelled: ${d.cancelled.join(", ")}`);
                      }
                    })
                  }
                >
                  {busy === "cancel" ? "Cancelling…" : "Yes, cancel it"}
                </button>
                <button
                  type="button"
                  className="btn min-h-[36px] px-2 text-[12px]"
                  onClick={() => setConfirmCancel(false)}
                >
                  Keep it
                </button>
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-[hsl(var(--ink-soft))]">
          <span className="chip chip-mustard">control data unavailable</span> Node
          controls need the control router and an active run.
        </p>
      )}

      {note ? (
        <p className="text-[12px] text-[hsl(var(--ink-soft))]" role="status">
          {note}
        </p>
      ) : null}
      {error ? (
        <p className="text-[12px] text-[hsl(8_62%_45%)]" role="alert">
          <b>{error.recoverable ? "Recoverable: " : ""}</b>
          {error.message} <span className="text-[hsl(var(--ink-soft))]">{error.hint}</span>
        </p>
      ) : null}
    </>
  );
}
