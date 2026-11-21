import { useMemo, useState } from "react";
import type {
  Availability,
  InspectorTarget,
  OfficeBlueprintData,
  ReassignInput,
  ReassignResult,
} from "./model";
import {
  deriveRoomHealth,
  flattenTeamBoard,
  seatsUsed,
  teamBoardKey,
  type TeamBoardKeyState,
} from "./derive";
import ReassignMenu from "./ReassignMenu";

/**
 * Team Board — the hierarchical list alternative to the floor plan. Same
 * data, `role="tree"`, roving focus, aria-expanded; every spatial action
 * exists here as a ≥44px control. This is the keyboard-, screen-reader-,
 * and mobile-canonical surface ("every graph ships with its list").
 */
export default function TeamBoard({
  blueprint,
  onReassign,
  onInspect,
  initialExpanded,
}: {
  blueprint: Availability<OfficeBlueprintData>;
  onReassign: (input: ReassignInput) => Promise<ReassignResult>;
  onInspect?: (target: InspectorTarget) => void;
  initialExpanded?: string[];
}) {
  const [state, setState] = useState<TeamBoardKeyState>({
    focusIndex: 0,
    expanded: new Set(initialExpanded ?? []),
  });
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const data = blueprint.status === "live" ? blueprint.data : null;
  const rows = useMemo(
    () => (data ? flattenTeamBoard(data.rooms, data.bench, state.expanded) : []),
    [data, state.expanded],
  );
  const agentById = useMemo(() => {
    const m = new Map();
    if (data) {
      for (const a of [...data.rooms.flatMap((r) => r.agents), ...data.bench]) {
        m.set(a.workerId, a);
      }
    }
    return m as Map<number, OfficeBlueprintData["bench"][number]>;
  }, [data]);

  if (!data) {
    return (
      <section aria-labelledby="tb-heading">
        <h1 id="tb-heading" className="text-xl font-extrabold tracking-tight">
          Team board
        </h1>
        <div
          role="status"
          className="mt-2 border border-dashed border-[hsl(var(--ink)/0.3)] bg-[hsl(var(--paper-raised))] p-6"
        >
          <p className="kicker">control data unavailable</p>
          <p className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
            {blueprint.status === "unavailable" ? blueprint.reason : "office payload missing"}
          </p>
        </div>
      </section>
    );
  }

  const focused = rows[Math.min(state.focusIndex, Math.max(0, rows.length - 1))];
  const pickerAgent = pickerFor != null ? agentById.get(pickerFor) : undefined;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (pickerFor != null) {
      if (e.key === "Escape") setPickerFor(null);
      return;
    }
    if (e.key === "m" || e.key === "M") {
      if (focused && focused.workerId != null) setPickerFor(focused.workerId);
      return;
    }
    if (e.key === "Enter") {
      if (!focused || !onInspect) return;
      if (focused.kind === "room" && focused.roomKey !== "__bench__") {
        const room = data.rooms.find((r) => r.roomKey === focused.roomKey);
        if (room) onInspect({ kind: "room", room });
      } else if (focused.workerId != null) {
        const a = agentById.get(focused.workerId);
        if (a) onInspect({ kind: "agent", agent: a });
      }
      return;
    }
    const next = teamBoardKey(e.key, state, rows);
    if (next !== state) {
      setState(next);
      e.preventDefault();
    }
  };

  return (
    <section aria-labelledby="tb-heading" onKeyDown={onKeyDown}>
      <div className="flex flex-wrap items-center gap-2">
        <h1 id="tb-heading" className="text-xl font-extrabold tracking-tight">
          Team board
        </h1>
        <span className="text-[12px] text-[hsl(var(--ink-soft))]">
          <kbd className="mono">↑↓</kbd> move · <kbd className="mono">←→</kbd> collapse/expand ·{" "}
          <kbd className="mono">M</kbd> reassign · <kbd className="mono">Enter</kbd> inspect
        </span>
      </div>

      <ul
        role="tree"
        aria-label="Office rooms and agents"
        className="mt-2 flex flex-col gap-1"
      >
        {data.rooms.map((room) => {
          const rowId = `room:${room.roomKey}`;
          const health = deriveRoomHealth(room);
          const expanded = state.expanded.has(room.roomKey);
          const focusedHere = focused?.id === rowId;
          return (
            <li key={room.roomKey} role="none">
              <div
                role="treeitem"
                aria-expanded={expanded}
                aria-level={1}
                aria-selected={focusedHere}
                aria-label={`${room.name} — seats ${seatsUsed(room)}/${room.capacity} · ${health.level}${health.reasons.length ? ` (${health.reasons.join(", ")})` : ""}`}
                tabIndex={focusedHere ? 0 : -1}
                className="flex min-h-[44px] flex-wrap items-center gap-2 border border-[hsl(var(--ink)/0.15)] bg-[hsl(var(--paper-raised))] px-2 py-1"
                data-health={health.level}
                onClick={() =>
                  setState((s) => ({
                    focusIndex: Math.max(0, rows.findIndex((r) => r.id === rowId)),
                    expanded: s.expanded,
                  }))
                }
              >
                <button
                  type="button"
                  className="btn min-h-[44px] min-w-[44px] px-2 text-[13px]"
                  aria-label={expanded ? `Collapse ${room.name}` : `Expand ${room.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setState((s) => {
                      const next = new Set(s.expanded);
                      if (next.has(room.roomKey)) next.delete(room.roomKey);
                      else next.add(room.roomKey);
                      return { ...s, expanded: next };
                    });
                  }}
                >
                  <span aria-hidden>{expanded ? "▾" : "▸"}</span>
                </button>
                <span aria-hidden>{room.glyph}</span>
                <span className="text-[14px] font-extrabold">{room.name}</span>
                <span className="mono text-[12px]">
                  seats {seatsUsed(room)}/{room.capacity}
                </span>
                <span
                  className={
                    health.level === "healthy"
                      ? "chip chip-sage"
                      : health.level === "strained"
                        ? "chip chip-mustard"
                        : "chip chip-alert"
                  }
                >
                  {health.level}
                  {health.reasons.length ? ` (${health.reasons[0]})` : ""}
                </span>
              </div>
              {expanded ? (
                <ul role="group" className="ml-8 mt-1 flex flex-col gap-1">
                  {room.agents.map((a) => (
                    <AgentRow
                      key={a.workerId}
                      rowId={`agent:${a.workerId}`}
                      focused={focused?.id === `agent:${a.workerId}`}
                      label={`${a.name} — ${a.status} · ${a.workload.activeClaims > 0 ? `${a.workload.activeClaims} claim${a.workload.activeClaims === 1 ? "" : "s"}` : "idle"}`}
                      detail={
                        <>
                          <span className="text-[13px] font-bold">{a.name}</span>
                          <span className="mono text-[12px] text-[hsl(var(--ink-soft))]">
                            {a.role}
                          </span>
                          <span className="mono text-[12px]">{a.status}</span>
                          {a.currentTasks.slice(0, 1).map((t) => (
                            <span key={t.nodeKey} className="chip mono">
                              task: {t.nodeKey} ({t.state})
                            </span>
                          ))}
                        </>
                      }
                      onReassign={() => setPickerFor(a.workerId)}
                      onInspect={
                        onInspect ? () => onInspect({ kind: "agent", agent: a }) : undefined
                      }
                    />
                  ))}
                  {!room.agents.length ? (
                    <li role="none" className="px-2 py-1 text-[13px] text-[hsl(var(--ink-soft))]">
                      no agents seated — {room.purpose}
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </li>
          );
        })}

        {/* Bench group */}
        <li role="none">
          <div
            role="treeitem"
            aria-expanded={state.expanded.has("__bench__")}
            aria-level={1}
            aria-selected={focused?.id === "room:__bench__"}
            tabIndex={focused?.id === "room:__bench__" ? 0 : -1}
            className="ob-bench flex min-h-[44px] flex-wrap items-center gap-2 px-2 py-1"
          >
            <button
              type="button"
              className="btn min-h-[44px] min-w-[44px] px-2 text-[13px]"
              aria-label={state.expanded.has("__bench__") ? "Collapse bench" : "Expand bench"}
              onClick={() =>
                setState((s) => {
                  const next = new Set(s.expanded);
                  if (next.has("__bench__")) next.delete("__bench__");
                  else next.add("__bench__");
                  return { ...s, expanded: next };
                })
              }
            >
              <span aria-hidden>{state.expanded.has("__bench__") ? "▾" : "▸"}</span>
            </button>
            <span className="text-[14px] font-extrabold">Bench (unassigned)</span>
            <span className="mono text-[12px]">{data.bench.length}</span>
          </div>
          {state.expanded.has("__bench__") ? (
            <ul role="group" className="ml-8 mt-1 flex flex-col gap-1">
              {data.bench.map((a) => (
                <AgentRow
                  key={a.workerId}
                  rowId={`agent:${a.workerId}`}
                  focused={focused?.id === `agent:${a.workerId}`}
                  label={`${a.name} — on the bench`}
                  detail={
                    <>
                      <span className="text-[13px] font-bold">{a.name}</span>
                      <span className="mono text-[12px] text-[hsl(var(--ink-soft))]">
                        {a.role}
                      </span>
                      <span className="chip chip-neutral">bench</span>
                    </>
                  }
                  reassignLabel="Assign to room…"
                  onReassign={() => setPickerFor(a.workerId)}
                  onInspect={
                    onInspect ? () => onInspect({ kind: "agent", agent: a }) : undefined
                  }
                />
              ))}
              {!data.bench.length ? (
                <li role="none" className="px-2 py-1 text-[13px] text-[hsl(var(--ink-soft))]">
                  empty — hire from the approved plan.
                </li>
              ) : null}
            </ul>
          ) : null}
        </li>
      </ul>

      {pickerAgent ? (
        <ReassignMenu
          agent={pickerAgent}
          rooms={data.rooms}
          onReassign={async (input) => {
            const result = await onReassign(input);
            if (result.ok) {
              setPickerFor(null);
              setAnnouncement(`Reassignment confirmed for worker ${input.workerId}.`);
            } else {
              setAnnouncement(`Blocked: ${result.error.cause} — ${result.error.message}`);
            }
            return result;
          }}
          onClose={() => setPickerFor(null)}
        />
      ) : null}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

function AgentRow({
  rowId,
  focused,
  label,
  detail,
  onReassign,
  onInspect,
  reassignLabel = "Reassign…",
}: {
  rowId: string;
  focused: boolean;
  label: string;
  detail: React.ReactNode;
  onReassign: () => void;
  onInspect?: () => void;
  reassignLabel?: string;
}) {
  return (
    <li role="none">
      <div
        role="treeitem"
        aria-level={2}
        aria-selected={focused}
        aria-label={label}
        tabIndex={focused ? 0 : -1}
        className="flex min-h-[44px] flex-wrap items-center gap-2 border border-[hsl(var(--ink)/0.12)] px-2 py-1"
        data-row-id={rowId}
      >
        {detail}
        <span className="ml-auto inline-flex gap-1">
          {onInspect ? (
            <button type="button" className="btn min-h-[44px] px-2 text-[12px]" onClick={onInspect}>
              Inspect
            </button>
          ) : null}
          <button type="button" className="btn min-h-[44px] px-2 text-[12px]" onClick={onReassign}>
            {reassignLabel}
          </button>
        </span>
      </div>
    </li>
  );
}
