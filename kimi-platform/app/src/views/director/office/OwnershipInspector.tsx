import type { InspectorTarget, RunNodeLike } from "./model";
import { NODE_MAX_ATTEMPTS } from "@contracts/run";
import { deriveRoomHealth, fmtCountdown, fmtHeartbeatAge } from "./derive";

/**
 * Shared inspector for the blueprint and the whiteboard: one panel, three
 * target kinds. A bound task shows the live run-node row; an unbound task
 * says so honestly and offers the plan-draft path (plan hash unchanged
 * until approved). Never invents a run row that does not exist.
 */
export default function OwnershipInspector({
  target,
  live,
  onSelect,
  onClose,
  onAllocateRoom,
}: {
  target: InspectorTarget | null;
  live?: (nodeKey: string) => RunNodeLike | undefined;
  onSelect?: (nodeKey: string | null) => void;
  onClose: () => void;
  /** Opens the room budget/capacity editor (office.allocate, OCC-guarded). */
  onAllocateRoom?: (room: Extract<InspectorTarget, { kind: "room" }>["room"]) => void;
}) {
  if (!target) return null;

  return (
    <aside
      role="complementary"
      aria-label="Ownership inspector"
      className="border border-[hsl(var(--ink))] bg-[hsl(var(--paper-raised))] p-3"
      data-testid="ownership-inspector"
    >
      <div className="flex items-center gap-2">
        <span className="kicker">⇄ Inspector</span>
        <button
          type="button"
          className="btn ml-auto min-h-[44px] px-3 text-[13px]"
          onClick={onClose}
        >
          Close <span aria-hidden>(Esc)</span>
        </button>
      </div>

      {target.kind === "room" ? <RoomDetail room={target.room} onAllocate={onAllocateRoom} /> : null}
      {target.kind === "agent" ? <AgentDetail target={target} /> : null}
      {target.kind === "node" ? (
        <NodeDetail target={target} live={live} onSelect={onSelect} />
      ) : null}
    </aside>
  );
}

function RoomDetail({
  room,
  onAllocate,
}: {
  room: Extract<InspectorTarget, { kind: "room" }>["room"];
  onAllocate?: (room: Extract<InspectorTarget, { kind: "room" }>["room"]) => void;
}) {
  const health = deriveRoomHealth(room);
  return (
    <div className="mt-2">
      <h2 className="text-[15px] font-extrabold">
        {room.glyph} {room.name}
      </h2>
      <p className="mono text-[12px] text-[hsl(var(--ink-soft))]">
        {room.roomKey} · capacity {room.capacity} · config v{room.version}
      </p>
      <p className="mt-1 text-[13px]">
        health: <strong>{health.level}</strong>
        {health.reasons.length ? ` — ${health.reasons.join(" · ")}` : " — no outstanding reasons"}
      </p>
      <p className="mt-1 text-[13px] text-[hsl(var(--ink-soft))]">
        eligible roles: {room.eligibleRolePatterns.join(", ") || "none configured"}
        {room.capabilitiesRequired.length
          ? ` · requires: ${room.capabilitiesRequired.join(", ")}`
          : ""}
      </p>
      {onAllocate ? (
        <button
          type="button"
          className="btn mt-2 min-h-[44px] px-3 text-[13px]"
          onClick={() => onAllocate(room)}
        >
          Edit budgets &amp; capacity…
        </button>
      ) : null}
    </div>
  );
}

function AgentDetail({ target }: { target: Extract<InspectorTarget, { kind: "agent" }> }) {
  const a = target.agent;
  const lease = a.lease.status === "live" ? a.lease.data : null;
  return (
    <div className="mt-2">
      <h2 className="text-[15px] font-extrabold">{a.name}</h2>
      <p className="mono text-[12px] text-[hsl(var(--ink-soft))]">
        worker #{a.workerId} · {a.kind} · {a.role} · {a.status} · row v{a.version}
      </p>
      <p className="mt-1 text-[13px]">
        workload: {a.workload.activeClaims} / {a.maxConcurrentClaims} claims · {a.workload.queued}{" "}
        queued
      </p>
      {lease ? (
        <p className={`mt-1 text-[13px] ${lease.stale ? "font-bold text-[hsl(var(--alert))]" : ""}`}>
          {lease.stale
            ? `lease stale — heartbeat ${fmtHeartbeatAge(lease.heartbeatAgeSec)}; sweeper or force-expire & requeue is required (owner action, audited).`
            : `lease ${fmtCountdown(lease.expiresInSec)} · heartbeat ${fmtHeartbeatAge(lease.heartbeatAgeSec)}`}
        </p>
      ) : (
        <p className="chip chip-neutral mt-1">
          {a.lease.status === "unavailable" ? a.lease.reason : ""}
        </p>
      )}
      {a.currentTasks.length ? (
        <ul className="mt-1 flex flex-wrap gap-1">
          {a.currentTasks.map((t) => (
            <li key={t.nodeKey} className="chip mono">
              {t.nodeKey} · {t.state} · attempt {t.attempt}/{NODE_MAX_ATTEMPTS}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] text-[hsl(var(--ink-soft))]">no current tasks</p>
      )}
    </div>
  );
}

function NodeDetail({
  target,
  live,
  onSelect,
}: {
  target: Extract<InspectorTarget, { kind: "node" }>;
  live?: (nodeKey: string) => RunNodeLike | undefined;
  onSelect?: (nodeKey: string | null) => void;
}) {
  const row = live?.(target.nodeKey);
  return (
    <div className="mt-2">
      <h2 className="mono text-[15px] font-extrabold">{target.nodeKey}</h2>
      {target.bound ? (
        row ? (
          <>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="chip chip-cornflower">⇄ synced</span>
              <span className="chip mono">{row.state}</span>
              <span className="mono text-[12px]">
                attempt {row.attempts}/{NODE_MAX_ATTEMPTS}
              </span>
            </p>
            {target.ownerRoom || target.ownerAgent ? (
              <p className="mt-1 text-[13px]">
                owner: {target.ownerRoom ? `${target.ownerRoom.glyph} ${target.ownerRoom.roomName}` : "—"}
                {target.ownerAgent ? ` · ${target.ownerAgent}` : ""}
              </p>
            ) : null}
            {onSelect ? (
              <button
                type="button"
                className="btn mt-2 min-h-[44px] px-3 text-[13px]"
                onClick={() => onSelect(target.nodeKey)}
              >
                Focus in queue &amp; plan
              </button>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-[13px] text-[hsl(var(--ink-soft))]">
            bound to the approved plan, but no run has scheduled this node yet — state appears
            when a run starts.
          </p>
        )
      ) : (
        <p className="mt-1 text-[13px]">
          <span className="chip chip-mustard">not in the approved plan</span> — add it via the
          plan draft (plan hash unchanged until a new revision is approved).
        </p>
      )}
    </div>
  );
}
