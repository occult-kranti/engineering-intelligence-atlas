import { useCallback, useMemo, useState } from "react";
import type { RoomBudgets } from "@contracts/office";
import { BUDGET_CEILINGS } from "@contracts/dag";
import type { RunLike } from "../workspace/adapter";
import OfficeBlueprint from "./OfficeBlueprint";
import TeamBoard from "./TeamBoard";
import SetupChecklist from "./SetupChecklist";
import OwnershipWhiteboard, { type OwnershipTargetOption } from "./OwnershipWhiteboard";
import { useOfficeData } from "./useOfficeData";
import { useWhiteboardData } from "./useWhiteboardData";
import { deriveDrift } from "./derive";
import type { RoomState, SetupStepId } from "./model";

export type OfficeView = "blueprint" | "team" | "whiteboard";

function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
}

/**
 * The office container inside stage 02 — hosts the Office Blueprint, the
 * Team Board, and the Ownership Whiteboard as real workspace views fed by
 * the live office/whiteboard routers (via useOfficeData/useWhiteboardData).
 * Mobile defaults to the Team Board for the blueprint view; the whiteboard
 * itself defaults to its List parity view on small screens. Selection is
 * the shared selectedNodeKey, synchronized with the queue and inspector.
 */
export default function OfficeStage({
  projectId,
  view,
  activeRun,
  planHash,
  userName,
  selectedNodeKey,
  onSelect,
}: {
  projectId: number;
  view: OfficeView;
  activeRun: RunLike | null;
  planHash: string | null;
  userName: string;
  selectedNodeKey: string | null;
  onSelect: (nodeKey: string | null) => void;
}) {
  const office = useOfficeData(projectId, activeRun);
  const wb = useWhiteboardData(projectId, { planHash, userName });
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [allocateFor, setAllocateFor] = useState<RoomState | null>(null);
  const [setupMsg, setSetupMsg] = useState<string | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [mobile] = useState(isMobileViewport);

  const bp = office.blueprint.status === "live" ? office.blueprint.data : null;

  const roomOf = useCallback(
    (nodeKey: string) => {
      if (!bp) return undefined;
      for (const room of bp.rooms) {
        for (const a of room.agents) {
          if (a.currentTasks.some((t) => t.nodeKey === nodeKey)) {
            return {
              roomKey: room.roomKey,
              roomName: room.name,
              glyph: room.glyph,
              agent: a.name,
            };
          }
        }
      }
      return undefined;
    },
    [bp],
  );

  /** Eligible ownership-cycle targets: rooms with a free seat + active agents. */
  const ownershipTargets = useMemo<OwnershipTargetOption[]>(() => {
    if (!bp) return [];
    const targets: OwnershipTargetOption[] = [];
    for (const room of bp.rooms) {
      if (room.agents.length < room.capacity) {
        targets.push({
          key: `room:${room.roomKey}`,
          label: room.name,
          ownership: { roomKey: room.roomKey },
        });
      }
      for (const a of room.agents) {
        if (a.status === "active") {
          targets.push({
            key: `worker:${a.workerId}`,
            label: a.name,
            ownership: { workerId: a.workerId },
          });
        }
      }
    }
    for (const a of bp.bench) {
      if (a.status === "active") {
        targets.push({
          key: `worker:${a.workerId}`,
          label: `${a.name} (bench)`,
          ownership: { workerId: a.workerId },
        });
      }
    }
    return targets;
  }, [bp]);

  /** Server drift + client-side ownership-intent drift (deterministic). */
  const drift = useMemo(() => {
    const doc = wb.doc.status === "live" ? wb.doc.data : null;
    if (!doc || !bp) return wb.drift;
    const ownershipDrift = deriveDrift({
      doc,
      dagNodeKeys: [], // server drift already covers run-node references
      roomHasSeat: (roomKey) => {
        const room = bp.rooms.find((r) => r.roomKey === roomKey);
        return room != null && room.agents.length < room.capacity;
      },
      workerEligible: (workerId) =>
        [...bp.rooms.flatMap((r) => r.agents), ...bp.bench].some(
          (a) => a.workerId === workerId && a.status === "active",
        ),
      claimingRoomOf: (dagNodeKey) => roomOf(dagNodeKey)?.roomKey,
    });
    return [...wb.drift, ...ownershipDrift];
  }, [wb.doc, wb.drift, bp, roomOf]);

  const runSetup = async () => {
    setSetupBusy(true);
    setSetupMsg(null);
    const res = await office.setup();
    setSetupBusy(false);
    setSetupMsg(res.ok ? null : (res.message ?? "setup failed"));
  };

  const onSkip = (id: SetupStepId) => setSkipped((s) => new Set(s).add(id));

  const setupCta = office.needsSetup ? (
    <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
      <h2 className="text-[15px] font-extrabold">Set up your office</h2>
      <p className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
        First run materializes the blueprint revision 1 with the canonical
        rooms and seats the two permanent propose-only roles (Blueprint Ops,
        Roadmap Cartographer) — one audited transaction, confirmed by the
        server.
      </p>
      <button
        type="button"
        className="btn mt-3 min-h-[44px] px-4 text-[13px] font-bold"
        disabled={setupBusy}
        onClick={() => void runSetup()}
      >
        {setupBusy ? "Setting up…" : "Set up the office"}
      </button>
      {setupMsg ? (
        <p role="alert" className="mt-2 text-[13px] font-bold text-[hsl(var(--alert))]">
          {setupMsg}
        </p>
      ) : null}
    </div>
  ) : null;

  if (view === "whiteboard") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {wb.needsCreation ? (
          <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
            <h2 className="text-[15px] font-extrabold">Create the ownership whiteboard</h2>
            <p className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
              Creates the board server-side with an immutable revision 1.
              Nothing is kept locally-as-if-remote.
            </p>
            <button
              type="button"
              className="btn mt-3 min-h-[44px] px-4 text-[13px] font-bold"
              disabled={wb.createPending}
              onClick={() => void wb.create()}
            >
              {wb.createPending ? "Creating…" : "Create whiteboard"}
            </button>
          </div>
        ) : null}
        <OwnershipWhiteboard
          doc={wb.doc}
          live={office.liveNode}
          roomOf={roomOf}
          drift={drift}
          lease={wb.lease}
          revisions={wb.revisions}
          ownershipTargets={ownershipTargets}
          selectedNodeKey={selectedNodeKey}
          onSelect={onSelect}
          onSave={wb.onSave}
          onSaveAsNewRevision={wb.onSaveAsNewRevision}
          onReloadLatest={wb.onReloadLatest}
          onAcquireLease={() => void wb.acquireLease()}
          onTakeOver={() => void wb.acquireLease()}
          onExport={wb.onExport}
        />
        <ServerExportRow
          disabled={wb.doc.status !== "live" || wb.exportPending}
          onServerExport={wb.onServerExport}
        />
      </div>
    );
  }

  const checklist = bp ? (
    <SetupChecklist blueprint={office.blueprint} skipped={skipped} onSkip={onSkip} />
  ) : null;

  // Mobile default: the Team Board is the canonical blueprint surface.
  if (view === "team" || mobile) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {setupCta}
        {checklist}
        {mobile && view === "blueprint" ? (
          <p className="text-[12px] text-[hsl(var(--ink-soft))]">
            small screen — the Team Board is the blueprint&apos;s list parity view.
          </p>
        ) : null}
        <TeamBoard blueprint={office.blueprint} onReassign={office.onReassign} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {setupCta}
      {checklist}
      <OfficeBlueprint
        blueprint={office.blueprint}
        live={office.liveNode}
        selectedNodeKey={selectedNodeKey}
        onSelect={onSelect}
        onReassign={office.onReassign}
        onAllocateRoom={setAllocateFor}
      />
      {allocateFor ? (
        <AllocateDialog
          room={allocateFor}
          initial={office.roomBudgetsByKey.get(allocateFor.roomKey) ?? null}
          onClose={() => setAllocateFor(null)}
          onSubmit={async (budgets, capacity) => {
            const meta = office.roomBudgetsByKey.get(allocateFor.roomKey);
            if (!meta) return { ok: false as const, message: "room is not in the active blueprint" };
            const res = await office.allocateRoom({
              roomId: meta.id,
              budgets,
              capacity,
              expectedVersion: meta.version,
            });
            if (res.ok) setAllocateFor(null);
            return res;
          }}
        />
      ) : null}
    </div>
  );
}

/** Server-rendered export row (stored artifact row, honest storage errors). */
function ServerExportRow({
  disabled,
  onServerExport,
}: {
  disabled: boolean;
  onServerExport: (format: "json" | "markdown") => Promise<{
    ok: boolean;
    message: string;
    storageKey?: string;
  }>;
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (format: "json" | "markdown") => {
    setBusy(true);
    setMsg(null);
    const res = await onServerExport(format);
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[hsl(var(--line))] pt-2">
      <span className="kicker">Server export</span>
      {(["json", "markdown"] as const).map((f) => (
        <button
          key={f}
          type="button"
          className="btn min-h-[44px] px-3 text-[13px]"
          disabled={disabled || busy}
          onClick={() => void run(f)}
        >
          {busy ? "Exporting…" : `Store ${f.toUpperCase()} export`}
        </button>
      ))}
      {msg ? (
        <span
          role="status"
          className={`text-[13px] ${msg.ok ? "text-[hsl(var(--ink-soft))]" : "font-bold text-[hsl(var(--alert))]"}`}
        >
          {msg.text}
        </span>
      ) : (
        <span className="text-[12px] text-[hsl(var(--ink-soft))]">
          stored as an artifact + exports row; storage failures are reported, never faked
        </span>
      )}
    </div>
  );
}

/** OCC-guarded room budget/capacity editor (office.allocate). */
function AllocateDialog({
  room,
  initial,
  onClose,
  onSubmit,
}: {
  room: RoomState;
  /** Live budgets/version from office.status — never view-model guesses. */
  initial: { budgets: RoomBudgets; capacity: number; version: number } | null;
  onClose: () => void;
  onSubmit: (
    budgets: RoomBudgets,
    capacity: number,
  ) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [maxTokens, setMaxTokens] = useState(initial?.budgets.maxTokens ?? room.compute.allocTokens);
  const [maxCalls, setMaxCalls] = useState(initial?.budgets.maxCalls ?? 1);
  const [maxMinutes, setMaxMinutes] = useState(initial?.budgets.maxMinutes ?? 1);
  const [maxCostUsd, setMaxCostUsd] = useState(
    initial?.budgets.maxCostUsd ?? room.compute.allocUsdMicros / 1e6,
  );
  const [maxStorageBytes, setMaxStorageBytes] = useState(
    initial?.budgets.maxStorageBytes ?? Math.round(room.storage.allocMb * 1_000_000),
  );
  const [capacity, setCapacity] = useState(initial?.capacity ?? room.capacity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await onSubmit(
      { maxTokens, maxCalls, maxMinutes, maxCostUsd, maxStorageBytes },
      capacity,
    );
    setBusy(false);
    if (!res.ok) setError(res.message ?? "allocation failed");
  };

  const field = (
    label: string,
    value: number,
    set: (v: number) => void,
    max: number,
    step = 1,
  ) => (
    <label className="block text-[13px] font-bold">
      {label}
      <input
        type="number"
        className="input mt-1 text-[13px]"
        value={value}
        min={0}
        max={max}
        step={step}
        onChange={(e) => set(Number(e.target.value))}
      />
    </label>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Edit budgets for ${room.name}`}
      className="border border-[hsl(var(--ink))] bg-[hsl(var(--paper-raised))] p-4"
    >
      <h2 className="text-[15px] font-extrabold">
        {room.glyph} {room.name} — budgets &amp; capacity
      </h2>
      <p className="mono text-[12px] text-[hsl(var(--ink-soft))]">
        config v{room.version} · guarded update (expectedVersion) — a concurrent edit loses with 409
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {field("Max tokens", maxTokens, setMaxTokens, BUDGET_CEILINGS.runMaxTokens)}
        {field("Max calls", maxCalls, setMaxCalls, BUDGET_CEILINGS.runMaxCalls)}
        {field("Max minutes", maxMinutes, setMaxMinutes, BUDGET_CEILINGS.runMaxMinutes)}
        {field("Max cost (USD)", maxCostUsd, setMaxCostUsd, BUDGET_CEILINGS.runMaxCostUsd, 0.01)}
        {field("Max storage (bytes)", maxStorageBytes, setMaxStorageBytes, 1_073_741_824)}
        {field("Capacity (seats)", capacity, setCapacity, 32)}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] font-bold text-[hsl(var(--alert))]">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn min-h-[44px] px-4 text-[13px] font-bold"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Allocating…" : "Save allocation"}
        </button>
        <button type="button" className="btn min-h-[44px] px-4 text-[13px]" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
