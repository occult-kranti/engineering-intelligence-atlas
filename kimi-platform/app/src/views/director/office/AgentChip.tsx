import type { AgentCard } from "./model";
import { NODE_MAX_ATTEMPTS } from "@contracts/run";
import { fmtCountdown, fmtHeartbeatAge } from "./derive";

/**
 * One agent seat: name, role (mono), status dot + text (never color alone),
 * workload, lease countdown, heartbeat age, stale marker. Actions are real
 * ≥44px buttons — dragging (in the floor plan) is never the only path.
 */
export default function AgentChip({
  agent,
  focused = false,
  onFocus,
  onInspect,
  onReassign,
}: {
  agent: AgentCard;
  focused?: boolean;
  onFocus?: () => void;
  onInspect?: () => void;
  onReassign?: () => void;
}) {
  const lease = agent.lease.status === "live" ? agent.lease.data : null;
  const stale = lease?.stale === true;
  const workload =
    agent.workload.activeClaims > 0
      ? `${agent.workload.activeClaims} claim${agent.workload.activeClaims === 1 ? "" : "s"}`
      : "idle";
  return (
    <div
      className="ob-agent flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5"
      data-status={agent.status}
      data-worker-id={agent.workerId}
      data-focused={focused || undefined}
      onFocus={onFocus}
      tabIndex={-1}
    >
      <span
        aria-hidden
        className="inline-block size-2 rounded-full"
        style={{
          background:
            agent.status === "suspended"
              ? "hsl(var(--ink-soft))"
              : stale
                ? "hsl(var(--alert))"
                : agent.workload.activeClaims > 0
                  ? "hsl(var(--cornflower))"
                  : "hsl(var(--sage))",
        }}
      />
      <span className="text-[13px] font-bold">{agent.name}</span>
      <span className="chip chip-neutral">{agent.kind}</span>
      <span className="mono max-w-28 truncate text-[12px] text-[hsl(var(--ink-soft))]">
        {agent.role}
      </span>
      <span className="mono text-[12px]">
        {agent.status === "suspended" ? "suspended" : workload}
      </span>
      {lease ? (
        <span
          className={`mono text-[12px] ${stale ? "chip chip-alert" : "text-[hsl(var(--ink-soft))]"}`}
        >
          {stale
            ? `stale · hb ${fmtHeartbeatAge(lease.heartbeatAgeSec)}`
            : agent.workload.activeClaims > 0
              ? `lease ${fmtCountdown(lease.expiresInSec)}`
              : `hb ${fmtHeartbeatAge(lease.heartbeatAgeSec)}`}
        </span>
      ) : (
        <span className="chip chip-neutral" title={agent.lease.status === "unavailable" ? agent.lease.reason : undefined}>
          no lease feed
        </span>
      )}
      {agent.currentTasks.slice(0, 2).map((t) => (
        <span key={t.nodeKey} className="chip mono" title={`attempt ${t.attempt}/${NODE_MAX_ATTEMPTS}`}>
          {t.nodeKey} · {t.state}
        </span>
      ))}
      <span className="ml-auto inline-flex gap-1">
        {onInspect ? (
          <button
            type="button"
            className="btn min-h-[44px] px-2 text-[12px]"
            onClick={onInspect}
            aria-label={`Inspect ${agent.name}`}
          >
            Inspect
          </button>
        ) : null}
        {onReassign ? (
          <button
            type="button"
            className="btn min-h-[44px] px-2 text-[12px]"
            onClick={onReassign}
            aria-label={`Reassign ${agent.name}`}
          >
            Reassign…
          </button>
        ) : null}
      </span>
    </div>
  );
}
