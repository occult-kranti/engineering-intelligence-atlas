import { useMemo, useState } from "react";
import type { DriftItem, RunNodeLike, WbNode, WhiteboardDoc } from "./model";
import { NODE_MAX_ATTEMPTS } from "@contracts/run";
import { moveIndex, wbSelectionForNode } from "./derive";

/**
 * Ownership Whiteboard — diagram view. SVG edge layer under HTML node
 * cards (no canvas-only interactions: arrows move focus, Enter selects,
 * E edits, O cycles ownership — every pointer action has a key). Selecting
 * a bound task reports its dagNodeKey so the shell can sync PlanStage, the
 * queue, and the blueprint room.
 */
export default function WhiteboardCanvas({
  doc,
  live,
  drift = [],
  selectedNodeKey = null,
  locked = false,
  onSelect,
  onEditNode,
  onCycleOwnership,
  onInspectNode,
}: {
  doc: WhiteboardDoc;
  live?: (nodeKey: string) => RunNodeLike | undefined;
  drift?: DriftItem[];
  selectedNodeKey?: string | null;
  locked?: boolean;
  onSelect?: (nodeKey: string | null) => void;
  onEditNode?: (nodeId: string) => void;
  onCycleOwnership?: (nodeId: string) => void;
  onInspectNode?: (nodeId: string) => void;
}) {
  const ordered = useMemo(
    () =>
      [...doc.nodes].sort(
        (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
      ),
    [doc.nodes],
  );
  const [focusIdx, setFocusIdx] = useState(0);
  const focusedNode = ordered[Math.min(focusIdx, Math.max(0, ordered.length - 1))];
  const byId = useMemo(() => new Map(doc.nodes.map((n) => [n.id, n])), [doc.nodes]);
  const driftByNode = useMemo(() => {
    const m = new Map<string, DriftItem[]>();
    for (const d of drift) {
      if (!d.wbNodeId) continue;
      m.set(d.wbNodeId, [...(m.get(d.wbNodeId) ?? []), d]);
    }
    return m;
  }, [drift]);

  const selectNode = (n: WbNode) => {
    onSelect?.(wbSelectionForNode(n));
    onInspectNode?.(n.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!ordered.length) return;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        setFocusIdx((i) => moveIndex(i, 1, ordered.length));
        e.preventDefault();
        break;
      case "ArrowUp":
      case "ArrowLeft":
        setFocusIdx((i) => moveIndex(i, -1, ordered.length));
        e.preventDefault();
        break;
      case "Enter":
        if (focusedNode) selectNode(focusedNode);
        break;
      case "e":
      case "E":
        if (focusedNode && !locked) onEditNode?.(focusedNode.id);
        break;
      case "o":
      case "O":
        if (focusedNode && !locked && focusedNode.kind === "task") {
          onCycleOwnership?.(focusedNode.id);
        }
        break;
      default:
        return;
    }
  };

  const syncedNode = selectedNodeKey
    ? doc.nodes.find((n) => n.binding?.dagNodeKey === selectedNodeKey)
    : undefined;
  const syncedLive = selectedNodeKey ? live?.(selectedNodeKey) : undefined;

  return (
    <div
      className="wb-canvas border border-[hsl(var(--cornflower)/0.35)]"
      role="application"
      aria-label="Ownership whiteboard diagram"
      aria-roledescription="editable roadmap diagram"
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-locked={locked || undefined}
    >
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
        width="100%"
        height="100%"
      >
        {doc.edges.map((e) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={e.id}
              x1={a.position.x}
              y1={a.position.y}
              x2={b.position.x}
              y2={b.position.y}
              stroke={
                e.kind === "ownership"
                  ? "hsl(var(--cornflower))"
                  : e.kind === "note-link"
                    ? "hsl(var(--mustard))"
                    : "hsl(var(--ink))"
              }
              strokeOpacity={0.55}
              strokeWidth={e.kind === "dependency" ? 2 : 1.5}
              strokeDasharray={e.kind === "note-link" ? "4 3" : undefined}
            />
          );
        })}
      </svg>

      {doc.nodes.map((n) => {
        const isFocused = focusedNode?.id === n.id;
        const isSynced = n.binding?.dagNodeKey != null && n.binding.dagNodeKey === selectedNodeKey;
        const row = n.binding ? live?.(n.binding.dagNodeKey) : undefined;
        const nodeDrift = driftByNode.get(n.id) ?? [];
        const w = n.kind === "milestone" ? 300 : n.kind === "note" ? 220 : 210;
        return (
          <button
            key={n.id}
            type="button"
            className="wb-node p-2"
            data-kind={n.kind}
            data-node-id={n.id}
            data-selected={isSynced || undefined}
            data-focused={isFocused || undefined}
            data-locked={locked || undefined}
            style={{
              left: n.position.x,
              top: n.position.y,
              width: w,
              outline: isFocused ? "2px solid hsl(var(--cornflower))" : undefined,
              zIndex: isFocused ? 2 : 1,
            }}
            tabIndex={-1}
            aria-label={nodeAriaLabel(n, row, isSynced)}
            onClick={() => {
              setFocusIdx(Math.max(0, ordered.findIndex((o) => o.id === n.id)));
              selectNode(n);
            }}
          >
            {n.kind === "milestone" ? (
              <span className="flex items-center gap-2">
                <span className="kicker">{n.milestoneKey ?? "milestone"}</span>
                <span className="text-[14px] font-extrabold" style={{ fontFamily: "'PT Serif', serif" }}>
                  {n.title}
                </span>
              </span>
            ) : (
              <>
                <span className="block text-[14px] font-extrabold">{n.title}</span>
                {n.binding ? (
                  <span className="mono mt-0.5 flex flex-wrap items-center gap-1 text-[11px]">
                    <span className="chip chip-cornflower">{n.binding.dagNodeKey}</span>
                    {row ? (
                      <span className="chip mono">
                        {row.state} · attempt {row.attempts}/{NODE_MAX_ATTEMPTS}
                      </span>
                    ) : (
                      <span className="chip chip-neutral">not scheduled</span>
                    )}
                  </span>
                ) : n.kind === "task" ? (
                  <span className="chip chip-mustard mt-0.5">not in the approved plan</span>
                ) : null}
                {n.kind === "note" && n.body ? (
                  <span className="mt-0.5 block text-[12px] text-[hsl(var(--ink-soft))]">
                    {n.body}
                  </span>
                ) : null}
                {isSynced ? (
                  <span className="chip chip-cornflower mt-0.5">⇄ synced</span>
                ) : null}
                {nodeDrift.map((d, i) => (
                  <span key={i} className="chip chip-mustard mt-0.5">
                    drift · {d.kind}
                  </span>
                ))}
              </>
            )}
          </button>
        );
      })}

      {syncedNode && selectedNodeKey ? (
        <p
          role="status"
          className="absolute bottom-2 left-2 flex flex-wrap items-center gap-2 border border-[hsl(var(--cornflower))] bg-[hsl(var(--paper-raised))] px-2 py-1 text-[12px]"
        >
          <strong>⇄ synced</strong> — run node{" "}
          <span className="mono font-bold">{selectedNodeKey}</span>
          {syncedLive ? <span className="chip mono">{syncedLive.state}</span> : null}
        </p>
      ) : null}

      {locked ? (
        <p role="note" className="wb-hatch absolute inset-x-0 top-0 px-3 py-1 text-center text-[12px]">
          read-only — edit lease held elsewhere
        </p>
      ) : null}
    </div>
  );
}

function nodeAriaLabel(
  n: WbNode,
  row: RunNodeLike | undefined,
  isSynced: boolean,
): string {
  const parts = [n.kind, n.title];
  if (n.binding) {
    parts.push(`bound to ${n.binding.dagNodeKey}`);
    parts.push(row ? `state ${row.state}` : "not scheduled");
  } else if (n.kind === "task") {
    parts.push("not in the approved plan");
  }
  if (isSynced) parts.push("synced with selection");
  return parts.join(", ");
}
