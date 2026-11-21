import { useEffect, useMemo, useState } from 'react';
import { SearchInput } from '@/components/SearchInput';
import { matchesQuery } from '@/lib/format';

/**
 * Reference network explorer (lazy-loaded; fetched on demand).
 *
 * Renders an accessible, filterable connection list over
 * /research/agent_reference_graph.json — the reproducible agent reference
 * graph built by .work/build_agent_reference_graph.py. The graph JSON is
 * never part of the initial bundle: this component is a lazy chunk and the
 * fetch fires only when the explorer is opened.
 */

interface GraphNode {
  id: string;
  type: string;
  label: string;
  provenance: string;
  paths?: { web?: string; workspace?: string };
  [k: string]: unknown;
}

interface GraphEdge {
  type: string;
  from: string;
  to: string;
  provenance: string;
  [k: string]: unknown;
}

interface Graph {
  counts: {
    nodes: number;
    edges: number;
    nodesByType: Record<string, number>;
    edgesByType: Record<string, number>;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const NODE_TYPES = [
  'all',
  'role',
  'skill',
  'agent-context',
  'resource',
  'repo-case',
  'lab',
  'script',
  'sample-asset',
  'document',
  'evaluation-task',
  'steward',
] as const;

const PAGE = 50;

export default function ReferenceNetwork() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let cancelled = false;
    fetch('research/agent_reference_graph.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((g: Graph) => {
        if (!cancelled) setGraph(g);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(
    () => new Map((graph?.nodes ?? []).map((n) => [n.id, n])),
    [graph],
  );

  const filtered = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.filter((n) => {
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      if (!query.trim()) return true;
      return matchesQuery(`${n.label} ${n.id} ${n.type}`, query);
    });
  }, [graph, typeFilter, query]);

  const connections = useMemo(() => {
    if (!graph || !selected) return [];
    return graph.edges.filter((e) => e.from === selected || e.to === selected);
  }, [graph, selected]);

  if (error) {
    return (
      <p role="alert" className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4 text-sm">
        Could not load the reference network ({error}). The graph JSON is
        available directly at{' '}
        <a className="text-[hsl(var(--cornflower))] underline underline-offset-2" href="research/agent_reference_graph.json">
          research/agent_reference_graph.json
        </a>
        .
      </p>
    );
  }
  if (!graph) {
    return (
      <p className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4 text-sm" aria-live="polite">
        Loading the reference network…
      </p>
    );
  }

  const selNode = selected ? byId.get(selected) : null;

  return (
    <div className="space-y-4">
      <p className="mono text-xs text-[hsl(var(--ink-soft))]" aria-live="polite">
        {graph.counts.nodes} nodes · {graph.counts.edges} edges ·{' '}
        {Object.entries(graph.counts.edgesByType)
          .map(([t, n]) => `${t} ${n}`)
          .join(' · ')}
      </p>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setShown(PAGE);
          }}
          label="Search nodes by name or id"
          placeholder="Search nodes, e.g. “game-audio” or “music21”"
        />
        <div>
          <label htmlFor="refnet-type" className="sr-only">
            Filter by node type
          </label>
          <select
            id="refnet-type"
            className="input"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setShown(PAGE);
            }}
          >
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'all'
                  ? `All types (${graph.counts.nodes})`
                  : `${t} (${graph.counts.nodesByType[t] ?? 0})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mono mb-2 text-xs text-[hsl(var(--ink-soft))]" aria-live="polite">
            {filtered.length} of {graph.counts.nodes} nodes match
          </p>
          <ul className="max-h-[420px] space-y-1 overflow-y-auto border border-[hsl(var(--line))] p-2">
            {filtered.slice(0, shown).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setSelected(n.id)}
                  aria-pressed={selected === n.id}
                  className={`w-full border px-2 py-1 text-left text-sm ${
                    selected === n.id
                      ? 'border-[hsl(var(--cornflower))] bg-[hsl(var(--paper))] font-bold'
                      : 'border-transparent hover:bg-[hsl(var(--paper-raised))]'
                  }`}
                >
                  <span className="mono mr-2 text-xs text-[hsl(var(--ink-soft))]">{n.type}</span>
                  {n.label}
                </button>
              </li>
            ))}
          </ul>
          {filtered.length > shown && (
            <button
              type="button"
              className="mono mt-2 text-xs font-bold text-[hsl(var(--cornflower))] underline underline-offset-2"
              onClick={() => setShown((s) => s + PAGE)}
            >
              Show {Math.min(PAGE, filtered.length - shown)} more of {filtered.length - shown}
            </button>
          )}
        </div>

        <div>
          {selNode ? (
            <div className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-4">
              <p className="mono text-xs text-[hsl(var(--ink-soft))]">{selNode.type} · {selNode.id}</p>
              <h3 className="mt-1 text-base font-extrabold tracking-tight">{selNode.label}</h3>
              <p className="prose-evidence mt-1 text-xs text-[hsl(var(--ink-soft))]">
                provenance: {selNode.provenance}
              </p>
              {selNode.paths?.web && (
                <p className="mt-1 text-xs">
                  <a
                    className="text-[hsl(var(--cornflower))] underline underline-offset-2"
                    href={selNode.paths.web}
                  >
                    {selNode.paths.web}
                  </a>
                </p>
              )}
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-[hsl(var(--ink-soft))]">
                {connections.length} connection{connections.length === 1 ? '' : 's'}
              </p>
              <ul className="mt-1 max-h-[300px] space-y-1 overflow-y-auto">
                {connections.map((e, i) => {
                  const otherId = e.from === selNode.id ? e.to : e.from;
                  const other = byId.get(otherId);
                  const dir = e.from === selNode.id ? '→' : '←';
                  return (
                    <li key={`${e.type}-${otherId}-${i}`} className="text-sm">
                      <span className="mono text-xs text-[hsl(var(--ink-soft))]">
                        {e.type} {dir}{' '}
                      </span>
                      <button
                        type="button"
                        className="text-left text-[hsl(var(--cornflower))] underline underline-offset-2"
                        onClick={() => setSelected(otherId)}
                      >
                        {other?.label ?? otherId}
                      </button>
                      <span className="prose-evidence block text-xs text-[hsl(var(--ink-soft))]">
                        {e.provenance}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="border border-dashed border-[hsl(var(--line))] p-4 text-sm text-[hsl(var(--ink-soft))]">
              Select a node to list its typed connections with provenance.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
