import { useMemo } from "react";
import type { EnterpriseView } from "@contracts/enterprise";
import {
  GRAPH_NODE_H,
  GRAPH_NODE_W,
  layoutEnterpriseView,
} from "./adapter";

/**
 * Interactive enterprise → company → department → contract graph (lazy
 * chunk). Nodes are real keyboard-focusable buttons; selection keys are the
 * canonical list row keys, so graph and list selection stay in parity.
 * Deterministic layout — no physics, no animation (reduced-motion safe).
 */
export default function EnterpriseGraph({
  view,
  selectedKey,
  onSelect,
}: {
  view: EnterpriseView;
  selectedKey: string | null;
  onSelect(key: string | null): void;
}) {
  const layout = useMemo(() => layoutEnterpriseView(view), [view]);
  const nodeByKey = useMemo(
    () => new Map(layout.nodes.map((n) => [n.key, n])),
    [layout.nodes],
  );
  const selected = selectedKey ? (nodeByKey.get(selectedKey) ?? null) : null;
  // Edges adjacent to the selection get emphasis; everything else dims.
  const adjacent = useMemo(() => {
    if (!selectedKey) return new Set<string>();
    return new Set(
      layout.edges
        .filter((e) => e.from === selectedKey || e.to === selectedKey)
        .map((e) => e.key),
    );
  }, [layout.edges, selectedKey]);

  return (
    <figure className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
      <figcaption className="flex flex-wrap items-center gap-2">
        <span className="kicker">Structure graph</span>
        <span className="text-[12px] text-[hsl(var(--ink-soft))]">
          {layout.nodes.length} nodes · {layout.edges.length} edges
          {selected ? ` · selected ${selected.kind} ${selected.key}` : " · click or Tab+Enter to select"}
        </span>
      </figcaption>
      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="ent-graph"
          role="group"
          aria-label={`Enterprise structure graph: ${layout.nodes.filter((n) => n.kind === "company").length} companies, ${layout.nodes.filter((n) => n.kind === "department").length} departments, ${layout.nodes.filter((n) => n.kind === "contract").length} contracts`}
        >
          {/* Column headers */}
          {(["company", "department", "contract"] as const).map((kind) => {
            const x = layout.nodes.find((n) => n.kind === kind)?.x ?? 0;
            return (
              <text key={kind} x={x} y={16} className="ent-graph-col-label">
                {kind}s
              </text>
            );
          })}
          {layout.edges.map((e) => {
            const from = nodeByKey.get(e.from);
            const to = nodeByKey.get(e.to);
            if (!from || !to) return null;
            const x1 = from.x + GRAPH_NODE_W;
            const y1 = from.y + GRAPH_NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + GRAPH_NODE_H / 2;
            const emphasized = adjacent.size === 0 || adjacent.has(e.key);
            return (
              <line
                key={e.key}
                x1={x1}
                y1={y1}
                x2={e.kind === "serves" ? x2 + GRAPH_NODE_W : x2}
                y2={y2}
                className={`ent-graph-edge ${e.kind === "serves" ? "ent-graph-edge-serves" : ""}`}
                opacity={emphasized ? 1 : 0.15}
              />
            );
          })}
          {layout.nodes.map((n) => (
            <g
              key={n.key}
              transform={`translate(${n.x}, ${n.y})`}
              data-node-key={n.key}
              data-kind={n.kind}
            >
              <rect
                width={GRAPH_NODE_W}
                height={GRAPH_NODE_H}
                className={`ent-graph-node ent-graph-node-${n.kind} ${selectedKey === n.key ? "ent-graph-node-selected" : ""}`}
              />
              <foreignObject width={GRAPH_NODE_W} height={GRAPH_NODE_H}>
                <button
                  type="button"
                  className="ent-graph-node-btn"
                  aria-pressed={selectedKey === n.key}
                  aria-label={`${n.kind} ${n.key}${n.status ? `, status ${n.status}` : ""}`}
                  onClick={() => onSelect(selectedKey === n.key ? null : n.key)}
                >
                  <span className="ent-graph-node-label">{n.label}</span>
                  {n.status ? <span className="ent-graph-node-status">{n.status}</span> : null}
                </button>
              </foreignObject>
            </g>
          ))}
        </svg>
      </div>
      {selected ? (
        <p className="mt-2 text-[13px]" role="status">
          Selected {selected.kind} <span className="mono font-bold">{selected.key}</span>
          {selected.status ? ` — status ${selected.status}` : ""}. The matching
          row in the canonical lists below is highlighted.
        </p>
      ) : null}
    </figure>
  );
}
