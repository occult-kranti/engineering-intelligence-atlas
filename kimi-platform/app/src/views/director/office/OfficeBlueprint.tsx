import { useCallback, useMemo, useState } from "react";
import type {
  Availability,
  InspectorTarget,
  OfficeBlueprintData,
  ReassignInput,
  ReassignResult,
  RoomState,
  RunNodeLike,
} from "./model";
import {
  deriveOfficeTotals,
  evaluateEligibility,
  fmtMb,
  fmtTokens,
  fmtUsdMicros,
  moveIndex,
  reassignRequestFor,
} from "./derive";
import RoomCard from "./RoomCard";
import ReassignMenu from "./ReassignMenu";
import OwnershipInspector from "./OwnershipInspector";
import "./office.css";

const DARK_ROOM = "operations";

/**
 * Zone C surface — the Office Blueprint floor plan. Eight rooms on a
 * drafting grid, the bench along the bottom edge, the Operations Deck in
 * the dark machine-room panel. Renders the Availability envelope honestly:
 * no endpoint → no fake rooms.
 *
 * Keyboard: [ / ] previous/next room · J / K next/previous agent ·
 * M reassign focused agent · Enter inspect · Esc cancel picker/drag.
 * Pointer drag of agent chips mirrors the same path; it is never required.
 */
export default function OfficeBlueprint({
  blueprint,
  live,
  selectedNodeKey = null,
  onSelect,
  onReassign,
  onAllocateRoom,
}: {
  blueprint: Availability<OfficeBlueprintData>;
  live?: (nodeKey: string) => RunNodeLike | undefined;
  selectedNodeKey?: string | null;
  onSelect?: (nodeKey: string | null) => void;
  onReassign: (input: ReassignInput) => Promise<ReassignResult>;
  /** Opens the room budget editor (office.allocate) from the inspector. */
  onAllocateRoom?: (room: RoomState) => void;
}) {
  const [roomFocus, setRoomFocus] = useState(0);
  const [agentFocus, setAgentFocus] = useState(0);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [dragWorkerId, setDragWorkerId] = useState<number | null>(null);
  const [inspector, setInspector] = useState<InspectorTarget | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const data = blueprint.status === "live" ? blueprint.data : null;
  const allAgents = useMemo(
    () => (data ? [...data.rooms.flatMap((r) => r.agents), ...data.bench] : []),
    [data],
  );
  const agentById = useMemo(
    () => new Map(allAgents.map((a) => [a.workerId, a])),
    [allAgents],
  );

  const findAgent = useCallback(
    (workerId: number) => agentById.get(workerId),
    [agentById],
  );

  const openPicker = (workerId: number) => {
    setPickerFor(workerId);
    const a = findAgent(workerId);
    if (a) setAnnouncement(`Reassigning ${a.name}. Choose a destination room.`);
  };

  const handleReassign = useCallback(
    async (input: ReassignInput): Promise<ReassignResult> => {
      const result = await onReassign(input);
      if (result.ok) {
        setPickerFor(null);
        setAnnouncement(
          `Reassignment confirmed for worker ${input.workerId} — office refreshed from server truth.`,
        );
      } else {
        setAnnouncement(`Reassignment blocked: ${result.error.cause} — ${result.error.message}`);
      }
      return result;
    },
    [onReassign],
  );

  if (!data) {
    const reason =
      blueprint.status === "unavailable" ? blueprint.reason : "office payload missing";
    return (
      <section aria-labelledby="ob-heading" className="flex min-h-0 flex-1 flex-col gap-3">
        <h1 id="ob-heading" className="text-xl font-extrabold tracking-tight">
          Office blueprint
        </h1>
        <div
          role="status"
          className="border border-dashed border-[hsl(var(--ink)/0.3)] bg-[hsl(var(--paper-raised))] p-6"
        >
          <p className="kicker">control data unavailable</p>
          <p className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
            {reason} No rooms are fabricated: the floor plan lights up when the worker
            pool endpoints land. The roadmap graph remains available as the fallback surface.
          </p>
        </div>
      </section>
    );
  }

  const totals = deriveOfficeTotals(data);
  const rooms = data.rooms;
  const focusedRoom = rooms[Math.min(roomFocus, rooms.length - 1)];
  const pickerAgent = pickerFor != null ? findAgent(pickerFor) : undefined;
  const dragAgent = dragWorkerId != null ? findAgent(dragWorkerId) : undefined;
  const hired = totals.seatsUsed + data.bench.length;

  const onStageKeyDown = (e: React.KeyboardEvent) => {
    if (pickerFor != null) {
      if (e.key === "Escape") {
        setPickerFor(null);
        setAnnouncement("Reassignment cancelled.");
      }
      return;
    }
    switch (e.key) {
      case "[":
        setRoomFocus((i) => moveIndex(i, -1, rooms.length));
        e.preventDefault();
        break;
      case "]":
        setRoomFocus((i) => moveIndex(i, 1, rooms.length));
        e.preventDefault();
        break;
      case "j":
      case "J":
        setAgentFocus((i) => moveIndex(i, 1, Math.max(1, focusedRoom?.agents.length ?? 0)));
        break;
      case "k":
      case "K":
        setAgentFocus((i) => moveIndex(i, -1, Math.max(1, focusedRoom?.agents.length ?? 0)));
        break;
      case "m":
      case "M": {
        const a = focusedRoom?.agents[Math.min(agentFocus, (focusedRoom?.agents.length || 1) - 1)];
        if (a) openPicker(a.workerId);
        break;
      }
      case "Enter":
        if (focusedRoom) setInspector({ kind: "room", room: focusedRoom });
        break;
      case "Escape":
        setDragWorkerId(null);
        setInspector(null);
        break;
      default:
        return;
    }
  };

  return (
    <section
      aria-labelledby="ob-heading"
      className="flex min-h-0 flex-1 flex-col gap-3"
      onKeyDown={onStageKeyDown}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 id="ob-heading" className="text-xl font-extrabold tracking-tight">
          Office blueprint — {rooms.length} rooms
        </h1>
        <span className="chip mono">
          seats {totals.seatsUsed} / {totals.seatsTotal}
        </span>
        <span className="chip chip-sage">{totals.healthy} healthy</span>
        {totals.strained ? <span className="chip chip-mustard">{totals.strained} strained</span> : null}
        {totals.degraded ? <span className="chip chip-alert">{totals.degraded} degraded</span> : null}
        <span className="chip mono">
          {fmtTokens(totals.tokensUsed)} / {fmtTokens(totals.tokensAlloc)} tok ·{" "}
          {fmtUsdMicros(totals.usdUsedMicros)} / {fmtUsdMicros(totals.usdAllocMicros)} ·{" "}
          {totals.storageUsedMb != null
            ? `${fmtMb(totals.storageUsedMb)} / ${fmtMb(totals.storageAllocMb)}`
            : "storage metering unavailable"}
        </span>
        <span className="ml-auto hidden text-[12px] text-[hsl(var(--ink-soft))] md:inline">
          <kbd className="mono">[</kbd> <kbd className="mono">]</kbd> rooms ·{" "}
          <kbd className="mono">M</kbd> reassign · <kbd className="mono">Enter</kbd> inspect
        </span>
      </div>

      {hired === 0 ? (
        <p
          role="note"
          className="border border-dashed border-[hsl(var(--ink)/0.3)] bg-[hsl(var(--paper-raised))] px-3 py-2 text-[13px] text-[hsl(var(--ink-soft))]"
        >
          No hires yet — the rooms below are empty outlines with their purposes. Hire your first
          agent from the approved plan; hiring lands on the bench, never silently in a seat.
        </p>
      ) : null}

      <div
        className="ob-stage grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4"
        onDragStart={(e) => {
          const el = (e.target as HTMLElement).closest("[data-worker-id]");
          const id = el ? Number(el.getAttribute("data-worker-id")) : NaN;
          if (Number.isFinite(id) && e.dataTransfer) {
            e.dataTransfer.setData("text/x-worker-id", String(id));
            e.dataTransfer.effectAllowed = "move";
            setDragWorkerId(id);
          }
        }}
        onDragEnd={() => setDragWorkerId(null)}
      >
        {rooms.map((room, i) => (
          <RoomCard
            key={room.roomKey}
            room={room}
            dark={room.roomKey === DARK_ROOM}
            tabIndex={i === roomFocus ? 0 : -1}
            selected={
              selectedNodeKey != null &&
              room.agents.some((a) => a.currentTasks.some((t) => t.nodeKey === selectedNodeKey))
            }
            dropVerdict={dragAgent ? evaluateEligibility(dragAgent, room) : null}
            onFocus={() => setRoomFocus(i)}
            onInspect={() => setInspector({ kind: "room", room })}
            onInspectAgent={(id) => {
              const a = findAgent(id);
              if (a) setInspector({ kind: "agent", agent: a });
            }}
            onReassignAgent={openPicker}
            onDropAgent={(workerId) => {
              const a = findAgent(workerId);
              setDragWorkerId(null);
              if (!a) return;
              const verdict = evaluateEligibility(a, room);
              setAnnouncement(`${a.name} → ${room.name}: ${verdict.message}`);
              const req = reassignRequestFor(a, room);
              if (req.ok) {
                void handleReassign(req.input);
              } else if (req.cause === "claims_policy_required") {
                openPicker(workerId); // claims force the explicit policy choice
              }
            }}
          />
        ))}
      </div>

      <div className="ob-bench flex flex-wrap items-center gap-2 px-3 py-2" aria-label="Bench — hired, unassigned agents">
        <h2 className="text-[13px] font-extrabold">Bench</h2>
        <span className="text-[12px] text-[hsl(var(--ink-soft))]">— hired, unassigned:</span>
        {data.bench.length ? (
          data.bench.map((a) => (
            <span key={a.workerId} className="inline-flex items-center gap-1" data-worker-id={a.workerId} draggable>
              <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: "hsl(var(--sage))" }} />
              <span className="text-[13px] font-bold">{a.name}</span>
              <span className="mono text-[12px] text-[hsl(var(--ink-soft))]">{a.role}</span>
              <button
                type="button"
                className="btn min-h-[44px] px-2 text-[12px]"
                onClick={() => openPicker(a.workerId)}
              >
                Assign to room…
              </button>
            </span>
          ))
        ) : (
          <span className="text-[13px] text-[hsl(var(--ink-soft))]">
            empty — hire from the approved plan, or release a seat here.
          </span>
        )}
      </div>

      {pickerAgent ? (
        <ReassignMenu
          agent={pickerAgent}
          rooms={rooms}
          onReassign={handleReassign}
          onClose={() => setPickerFor(null)}
        />
      ) : null}

      <OwnershipInspector
        target={inspector}
        live={live}
        onSelect={onSelect}
        onClose={() => setInspector(null)}
        onAllocateRoom={onAllocateRoom}
      />

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
