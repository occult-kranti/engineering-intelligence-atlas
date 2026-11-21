import { useState } from "react";
import type {
  Availability,
  DriftItem,
  EditLeaseInfo,
  InspectorTarget,
  RunNodeLike,
  WbEdge,
  WbRevisionMeta,
  WbSaveResult,
  WhiteboardDoc,
} from "./model";
import WhiteboardCanvas from "./WhiteboardCanvas";
import WhiteboardList from "./WhiteboardList";
import EditLeaseBar from "./EditLeaseBar";
import ConflictDialog, { type SaveConflict } from "./ConflictDialog";
import VersionRail from "./VersionRail";
import ExportMenu, { type WbExportPayload } from "./ExportMenu";
import OwnershipInspector from "./OwnershipInspector";
import { cycleOwnershipEdge } from "./derive";
import "./office.css";

export type WbView = "diagram" | "list";

export interface OwnershipTargetOption {
  /** Stable key for cycling (room key or worker id as string). */
  key: string;
  label: string;
  ownership: WbEdge["ownership"];
}

function defaultView(): WbView {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
    return "list";
  }
  return "diagram";
}

/**
 * The Ownership Whiteboard surface: edit-lease bar, Diagram/List parity
 * control, canvas + list, shared inspector, OCC conflict dialog, export,
 * and the append-only version rail. Editing requires the edit lease;
 * saves are OCC (expectedVersion) — a 409 opens the three-option dialog.
 * Nothing is saved locally-as-if-remote: the doc only changes when the
 * server confirms a new revision.
 */
export default function OwnershipWhiteboard({
  doc,
  live,
  roomOf,
  drift = [],
  lease,
  revisions,
  ownershipTargets = [],
  selectedNodeKey = null,
  onSelect,
  onSave,
  onSaveAsNewRevision,
  onReloadLatest,
  onAcquireLease,
  onTakeOver,
  onRestoreRevision,
  onExport,
}: {
  doc: Availability<WhiteboardDoc>;
  live?: (nodeKey: string) => RunNodeLike | undefined;
  roomOf?: (nodeKey: string) => { roomKey: string; roomName: string; glyph: string; agent: string | null } | undefined;
  drift?: DriftItem[];
  lease: Availability<EditLeaseInfo>;
  revisions: Availability<WbRevisionMeta[]>;
  /** Eligible ownership targets for the O-key cycle (rooms/agents). */
  ownershipTargets?: OwnershipTargetOption[];
  selectedNodeKey?: string | null;
  onSelect?: (nodeKey: string | null) => void;
  onSave: (doc: WhiteboardDoc, expectedVersion: number) => Promise<WbSaveResult>;
  /** Host: fetch latest, rebaseWhiteboard(mine, latest), save as new head. */
  onSaveAsNewRevision?: (mine: WhiteboardDoc) => Promise<WbSaveResult>;
  onReloadLatest?: () => void;
  onAcquireLease?: () => void;
  onTakeOver?: () => void;
  onRestoreRevision?: (revision: number) => void;
  onExport?: (payload: WbExportPayload) => void;
}) {
  const [view, setView] = useState<WbView>(defaultView);
  const [draft, setDraft] = useState<WhiteboardDoc | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [conflict, setConflict] = useState<SaveConflict | null>(null);
  const [pending, setPending] = useState(false);
  const [inspector, setInspector] = useState<InspectorTarget | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const liveDoc = doc.status === "live" ? doc.data : null;
  const effective = draft ?? liveDoc;
  const editable = lease.status === "live" && lease.data.heldByYou;

  if (!liveDoc || !effective) {
    return (
      <section aria-labelledby="wb-heading" className="flex min-h-0 flex-1 flex-col gap-3">
        <h1 id="wb-heading" className="text-xl font-extrabold tracking-tight">
          Ownership whiteboard
        </h1>
        <div
          role="status"
          className="border border-dashed border-[hsl(var(--ink)/0.3)] bg-[hsl(var(--paper-raised))] p-6"
        >
          <p className="kicker">control data unavailable</p>
          <p className="prose-evidence mt-1 text-[14px] text-[hsl(var(--ink-soft))]">
            {doc.status === "unavailable" ? doc.reason : "loading"} No document is fabricated —
            the whiteboard appears when the endpoint lands.
          </p>
        </div>
      </section>
    );
  }

  const inspectNode = (nodeId: string) => {
    const n = effective.nodes.find((x) => x.id === nodeId);
    if (!n) return;
    if (n.kind === "task") {
      const bound = n.binding?.dagNodeKey;
      const owner = bound ? roomOf?.(bound) : undefined;
      setInspector({
        kind: "node",
        nodeKey: bound ?? n.title,
        bound: bound != null,
        ownerRoom: owner ? { roomKey: owner.roomKey, roomName: owner.roomName, glyph: owner.glyph } : undefined,
        ownerAgent: owner?.agent ?? undefined,
      });
    }
  };

  const beginEdit = (nodeId: string) => {
    if (!editable) return;
    const n = effective.nodes.find((x) => x.id === nodeId);
    if (!n) return;
    setEditingId(nodeId);
    setEditTitle(n.title);
    setEditBody(n.body ?? "");
  };

  const applyEdit = () => {
    if (!editingId) return;
    setDraft({
      ...effective,
      nodes: effective.nodes.map((n) =>
        n.id === editingId ? { ...n, title: editTitle, body: editBody || undefined } : n,
      ),
    });
    setEditingId(null);
    setAnnouncement("Edit staged — save to append a new revision.");
  };

  const cycleOwnership = (nodeId: string) => {
    if (!editable) return;
    const n = effective.nodes.find((x) => x.id === nodeId);
    if (!n || n.kind !== "task") return;
    const { edges, appliedKey } = cycleOwnershipEdge(
      effective.edges,
      nodeId,
      ownershipTargets.map((t) => ({ key: t.key, ownership: t.ownership })),
    );
    if (appliedKey == null) {
      setAnnouncement("No eligible ownership targets — seat an agent first.");
      return;
    }
    setDraft({ ...effective, edges });
    setAnnouncement(
      `Ownership intent → ${ownershipTargets.find((t) => t.key === appliedKey)?.label ?? appliedKey}. Save to persist.`,
    );
  };

  const save = async () => {
    if (!draft) return;
    setPending(true);
    try {
      const result = await onSave(draft, draft.version);
      if (result.ok) {
        setDraft(null);
        setConflict(null);
        setAnnouncement(`Saved — revision ${result.revision} appended.`);
      } else if (result.cause === "version_conflict" || result.cause === "fenced") {
        setConflict({ cause: result.cause, message: result.message });
      } else {
        setAnnouncement(`Save unavailable — ${result.message}`);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-labelledby="wb-heading" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 id="wb-heading" className="text-xl font-extrabold tracking-tight">
          Ownership whiteboard
        </h1>
        <span className="chip">rev {effective.revision}</span>
        {draft ? <span className="chip chip-mustard">unsaved edits</span> : null}
        {liveDoc.planHash ? (
          <span className="chip mono">plan {liveDoc.planHash.slice(0, 8)}…</span>
        ) : null}
        <div
          role="tablist"
          aria-label="Whiteboard view"
          className="ml-auto inline-flex border border-[hsl(var(--line))]"
        >
          {(["diagram", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className="tab-control min-h-[44px] px-4 text-[13px]"
              onClick={() => setView(v)}
            >
              {v === "diagram" ? "Diagram" : "List"}
            </button>
          ))}
        </div>
        {onExport ? <ExportMenu doc={effective} onExport={onExport} disabled={pending} /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <EditLeaseBar
          lease={lease}
          onAcquire={onAcquireLease}
          onTakeOver={onTakeOver}
          pending={pending}
        />
        {draft ? (
          <button
            type="button"
            className="btn min-h-[44px] px-4 text-[13px] font-bold"
            disabled={pending || !editable}
            onClick={() => void save()}
          >
            {pending ? "Saving…" : "Save revision"}
          </button>
        ) : null}
        {drift.length ? (
          <span className="chip chip-mustard">drift ×{drift.length}</span>
        ) : null}
      </div>

      {view === "diagram" ? (
        <WhiteboardCanvas
          doc={effective}
          live={live}
          drift={drift}
          selectedNodeKey={selectedNodeKey}
          locked={!editable}
          onSelect={onSelect}
          onEditNode={beginEdit}
          onCycleOwnership={cycleOwnership}
          onInspectNode={inspectNode}
        />
      ) : (
        <WhiteboardList
          doc={effective}
          live={live}
          roomOf={roomOf}
          selectedNodeKey={selectedNodeKey}
          locked={!editable}
          onSelect={onSelect}
          onEditNode={beginEdit}
          onCycleOwnership={cycleOwnership}
        />
      )}

      {editingId ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit whiteboard node"
          className="border border-[hsl(var(--ink))] bg-[hsl(var(--paper-raised))] p-3"
        >
          <h2 className="text-[15px] font-extrabold">Edit node</h2>
          <label className="mt-2 block text-[13px] font-bold">
            Title
            <input
              className="mt-1 block min-h-[44px] w-full border border-[hsl(var(--ink)/0.3)] bg-[hsl(var(--paper))] px-2 text-[14px]"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </label>
          <label className="mt-2 block text-[13px] font-bold">
            Body (notes only — never secrets)
            <textarea
              className="mt-1 block w-full border border-[hsl(var(--ink)/0.3)] bg-[hsl(var(--paper))] px-2 py-1 text-[14px]"
              rows={3}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn min-h-[44px] px-4 text-[13px] font-bold" onClick={applyEdit}>
              Apply
            </button>
            <button type="button" className="btn min-h-[44px] px-4 text-[13px]" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <ConflictDialog
        conflict={conflict}
        pending={pending}
        onReloadLatest={() => {
          setConflict(null);
          setDraft(null);
          onReloadLatest?.();
          setAnnouncement("Reloaded latest — your edits remain available as a JSON export.");
        }}
        onSaveAsNew={() => {
          if (!draft || !onSaveAsNewRevision) return;
          setPending(true);
          void onSaveAsNewRevision(draft)
            .then((result) => {
              if (result.ok) {
                setDraft(null);
                setConflict(null);
                setAnnouncement(`Rebased and saved — revision ${result.revision} appended.`);
              } else {
                setConflict({ cause: result.cause, message: result.message });
              }
            })
            .finally(() => setPending(false));
        }}
        onCancel={() => setConflict(null)}
      />

      <OwnershipInspector
        target={inspector}
        live={live}
        onSelect={onSelect}
        onClose={() => setInspector(null)}
      />

      <VersionRail
        revisions={revisions}
        currentRevision={liveDoc.revision}
        onRestore={onRestoreRevision}
        pending={pending}
      />

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
