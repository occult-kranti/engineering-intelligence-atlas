import type { EligibilityVerdict, RoomState } from "./model";
import { deriveRoomHealth, fmtMb, fmtTokens, fmtUsdMicros, seatsUsed } from "./derive";
import AgentChip from "./AgentChip";

const HEALTH_CHIP: Record<string, string> = {
  healthy: "chip chip-sage",
  strained: "chip chip-mustard",
  degraded: "chip chip-alert",
};

/**
 * One room of the floor plan: capacity, agents, task counts, compute +
 * storage meters, health with named reasons. All values are props — a room
 * never invents data; unmetered storage says "metering unavailable".
 */
export default function RoomCard({
  room,
  selected = false,
  dropVerdict = null,
  tabIndex = -1,
  onFocus,
  onInspect,
  onInspectAgent,
  onReassignAgent,
  onDropAgent,
  dark = false,
}: {
  room: RoomState;
  selected?: boolean;
  /** Live eligibility verdict while an agent drag hovers this room. */
  dropVerdict?: EligibilityVerdict | null;
  tabIndex?: number;
  onFocus?: () => void;
  onInspect?: () => void;
  onInspectAgent?: (workerId: number) => void;
  onReassignAgent?: (workerId: number) => void;
  onDropAgent?: (workerId: number) => void;
  /** Operations Deck — the machine room stays dark. */
  dark?: boolean;
}) {
  const health = deriveRoomHealth(room);
  const used = seatsUsed(room);
  const over = used > room.capacity;
  const budgetPct =
    room.compute.allocUsdMicros > 0
      ? Math.round((room.compute.usedUsdMicros / room.compute.allocUsdMicros) * 100)
      : 0;
  const storagePct =
    room.storage.usedMb != null && room.storage.allocMb > 0
      ? Math.round((room.storage.usedMb / room.storage.allocMb) * 100)
      : null;
  const label = `${room.name}, ${used} of ${room.capacity} seats, health ${health.level}${
    health.reasons.length ? `, ${health.reasons.join(", ")}` : ""
  }, budget ${budgetPct} percent`;

  return (
    <section
      className={`${dark ? "ob-room-dark panel-dark" : "ob-room"} flex min-w-0 flex-col`}
      data-room-key={room.roomKey}
      data-health={health.level}
      data-selected={selected || undefined}
      data-drop={dropVerdict ? (dropVerdict.ok ? "eligible" : "blocked") : undefined}
      aria-label={label}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onDragOver={(e) => {
        if (onDropAgent) e.preventDefault();
      }}
      onDrop={(e) => {
        const id = Number(e.dataTransfer?.getData("text/x-worker-id"));
        if (onDropAgent && Number.isFinite(id)) {
          e.preventDefault();
          onDropAgent(id);
        }
      }}
    >
      <header className={`${dark ? "" : "ob-room-head"} flex flex-wrap items-center gap-2 px-3 py-2`}>
        <span aria-hidden className="text-[15px]">
          {room.glyph}
        </span>
        <h3 className="text-[15px] font-extrabold tracking-tight">{room.name}</h3>
        <span className={HEALTH_CHIP[health.level]}>
          {health.level}
          {health.reasons.length ? ` · ${health.reasons[0]}` : ""}
        </span>
        {over ? <span className="chip chip-alert">over capacity {used}/{room.capacity} — resolve</span> : null}
        {onInspect ? (
          <button
            type="button"
            className="btn ml-auto min-h-[44px] px-2 text-[12px]"
            onClick={onInspect}
            aria-label={`Inspect ${room.name}`}
          >
            Inspect
          </button>
        ) : null}
      </header>

      <div className="flex flex-col gap-2 px-3 py-2">
        <p className={`mono text-[12px] ${dark ? "text-[hsl(var(--paper)/0.75)]" : "text-[hsl(var(--ink-soft))]"}`}>
          seats {used}/{room.capacity} · {room.tasks.running} running · {room.tasks.ready} ready ·{" "}
          {room.tasks.blocked} blocked · {room.tasks.failed} failed
        </p>

        {room.agents.length ? (
          <ul className="flex flex-col gap-1">
            {room.agents.map((a) => (
              <li key={a.workerId} draggable={onDropAgent != null} data-worker-id={a.workerId}>
                <AgentChip
                  agent={a}
                  onInspect={onInspectAgent ? () => onInspectAgent(a.workerId) : undefined}
                  onReassign={onReassignAgent ? () => onReassignAgent(a.workerId) : undefined}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={`text-[13px] ${dark ? "text-[hsl(var(--paper)/0.7)]" : "text-[hsl(var(--ink-soft))]"}`}>
            Empty room — {room.purpose}
          </p>
        )}

        {dropVerdict ? (
          <p
            role="status"
            className={`border px-2 py-1 text-[12px] ${
              dropVerdict.ok
                ? "border-[hsl(var(--cornflower))] bg-[hsl(var(--cornflower)/0.12)]"
                : "border-[hsl(var(--alert))] bg-[hsl(var(--alert)/0.1)]"
            }`}
          >
            {dropVerdict.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`kicker ${dark ? "text-[hsl(var(--paper)/0.6)]" : ""}`}>compute</span>
            <span className="mono text-[12px]">
              {fmtTokens(room.compute.usedTokens)} / {fmtTokens(room.compute.allocTokens)} tok ·{" "}
              {fmtUsdMicros(room.compute.usedUsdMicros)} / {fmtUsdMicros(room.compute.allocUsdMicros)}
              {room.compute.simulated ? " · simulated" : ""}
            </span>
          </div>
          <div
            className="ob-meter-track"
            role="meter"
            aria-label={`${room.name} compute budget`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={budgetPct}
          >
            <div className="ob-meter-fill" style={{ width: `${Math.min(100, budgetPct)}%` }} />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className={`kicker ${dark ? "text-[hsl(var(--paper)/0.6)]" : ""}`}>storage</span>
            <span className="mono text-[12px]">
              {room.storage.usedMb != null ? (
                <>
                  {fmtMb(room.storage.usedMb)} / {fmtMb(room.storage.allocMb)} · artifacts{" "}
                  {room.storage.artifactCount}
                </>
              ) : (
                <>metering unavailable · artifacts {room.storage.artifactCount}</>
              )}
              {room.storage.storageErrors > 0 ? (
                <span className="chip chip-alert ml-1">
                  storage: {room.storage.storageErrors} error{room.storage.storageErrors === 1 ? "" : "s"} — retry
                </span>
              ) : null}
            </span>
          </div>
          <div
            className="ob-meter-track"
            role="meter"
            aria-label={`${room.name} storage`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={storagePct ?? 0}
            aria-valuetext={storagePct == null ? "metering unavailable" : `${storagePct} percent`}
          >
            <div
              className="ob-meter-fill"
              data-tone="storage"
              data-over={storagePct != null && storagePct >= 100 ? "true" : undefined}
              style={{ width: `${storagePct == null ? 0 : Math.min(100, storagePct)}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
