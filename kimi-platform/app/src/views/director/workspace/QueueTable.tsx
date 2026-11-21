import type { QueueRow } from "./adapter";
import type { RunNodeState } from "@contracts/run";

const STATE_CHIP: Record<RunNodeState | "unscheduled", string> = {
  waiting: "chip",
  pending: "chip",
  ready: "chip chip-cornflower",
  claimed: "chip chip-cornflower",
  running: "chip chip-mustard",
  paused: "chip chip-mustard",
  verifying: "chip chip-mustard",
  accepted: "chip chip-sage",
  failed: "chip chip-alert",
  skipped: "chip",
  cancelled: "chip",
  unscheduled: "chip",
};

/**
 * Zone D bottom — task ownership & queue. Answers "who is working on what,
 * for how much longer" from live run-node state: plan role, live assignment
 * (control.roadmapStatus), state, lease/heartbeat with stale marking, and
 * attempt count. Enter (or the Inspect button) opens the node inspector
 * with the real assign/reassign/cancel controls.
 */
export default function QueueTable({
  rows,
  noRun,
  leaseUnavailableReason,
  focusedKey,
  onFocus,
  onInspect,
  queueUnavailableReason,
}: {
  rows: QueueRow[] | null;
  noRun: boolean;
  leaseUnavailableReason: string | null;
  focusedKey: string | null;
  onFocus(nodeKey: string | null): void;
  onInspect?(nodeKey: string): void;
  queueUnavailableReason?: string | null;
}) {
  return (
    <section aria-labelledby="dw-queue-heading" className="dw-queue">
      <h2 id="dw-queue-heading" className="flex items-center gap-2 text-sm font-extrabold">
        Task queue &amp; ownership
        <span className="chip ml-auto">{rows ? `${rows.length} tasks` : "—"}</span>
      </h2>

      {noRun ? (
        <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
          No run yet. The queue fills from live node state once an approved
          plan is started from the Roadmap stage.
        </p>
      ) : queueUnavailableReason ? (
        <p className="mt-2 text-[13px]" role="status">
          <span className="chip chip-mustard">control data unavailable</span>{" "}
          <span className="text-[hsl(var(--ink-soft))]">{queueUnavailableReason}</span>
        </p>
      ) : null}

      {rows && rows.length ? (
        <table className="table-cat mt-2 text-[13px]">
          <thead>
            <tr>
              <th scope="col">Task · owner</th>
              <th scope="col">State</th>
              <th scope="col">Lease</th>
              <th scope="col">Att.</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.nodeKey}
                id={`dw-queue-${r.nodeKey}`}
                className="dw-queue-row"
                data-focused={focusedKey === r.nodeKey}
                tabIndex={0}
                onFocus={() => onFocus(r.nodeKey)}
                onBlur={() => onFocus(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && onInspect) {
                    e.preventDefault();
                    onInspect(r.nodeKey);
                  }
                }}
                aria-label={`task ${r.nodeKey}, ${r.awaitingHuman ? "awaiting you" : r.state}`}
              >
                <td>
                  <div className="mono text-[12px] font-bold">{r.nodeKey}</div>
                  <div className="text-[12px] text-[hsl(var(--ink-soft))]">
                    {r.ownerRole ?? "unassigned — no agent claimed this yet"}
                    {r.skillPin ? (
                      <>
                        {" · "}
                        <span className="mono" title={r.skillSha ? `sha256 ${r.skillSha}` : undefined}>
                          {r.skillPin}
                        </span>
                      </>
                    ) : null}
                  </div>
                  {r.assignedWorkerName || r.assignmentMode ? (
                    <div className="text-[12px] text-[hsl(var(--ink-soft))]">
                      {r.assignedWorkerName ? `→ ${r.assignedWorkerName}` : "→ unassigned"}
                      {r.assignmentMode ? ` · ${r.assignmentMode}` : ""}
                    </div>
                  ) : null}
                </td>
                <td>
                  <span className={STATE_CHIP[r.state]}>
                    {r.awaitingHuman ? "awaiting you" : r.state}
                  </span>
                  {r.blockedReason && !r.awaitingHuman ? (
                    <div className="mt-0.5 text-[12px] text-[hsl(var(--ink-soft))]">
                      {r.blockedReason}
                    </div>
                  ) : null}
                </td>
                <td className="mono text-[12px]">
                  {r.lease.status === "live" ? (
                    <>
                      <span title={`held by ${r.lease.data.holder}`}>
                        {r.lease.data.stale
                          ? "expired"
                          : r.lease.data.expiresInSec >= 0
                            ? `${r.lease.data.expiresInSec}s`
                            : "—"}
                      </span>
                      <div className="text-[hsl(var(--ink-soft))]">
                        {r.lease.data.stale
                          ? "lease expired — will be re-queued"
                          : r.lease.data.heartbeatAgeSec >= 0
                            ? `hb ${r.lease.data.heartbeatAgeSec}s ago`
                            : "hb n/a"}
                      </div>
                    </>
                  ) : (
                    <span
                      className="text-[hsl(var(--ink-soft))]"
                      title={leaseUnavailableReason ?? r.lease.reason}
                    >
                      —
                      <div>
                        {r.lease.reason === "no active lease"
                          ? "no active lease"
                          : "no lease feed"}
                      </div>
                    </span>
                  )}
                </td>
                <td className="mono text-[12px]">{r.attempts || "—"}</td>
                <td>
                  {onInspect ? (
                    <button
                      type="button"
                      className="text-[12px] underline"
                      aria-label={`inspect task ${r.nodeKey} — assignment and cancellation controls`}
                      onClick={() => onInspect(r.nodeKey)}
                    >
                      Inspect
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {rows && !rows.length ? (
        <p className="mt-2 text-[13px] text-[hsl(var(--ink-soft))]">
          The run has no node states yet — workers appear here as tasks are
          dispatched.
        </p>
      ) : null}

      {rows && leaseUnavailableReason ? (
        <p className="mt-2 text-[12px] text-[hsl(var(--ink-soft))]" role="note">
          <span className="chip">control data unavailable</span> Lease feed:
          {leaseUnavailableReason}. States above are still live from run
          events.
        </p>
      ) : null}
    </section>
  );
}
