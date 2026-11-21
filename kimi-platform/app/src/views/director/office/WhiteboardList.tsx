import type { RunNodeLike, WhiteboardDoc } from "./model";
import { NODE_MAX_ATTEMPTS } from "@contracts/run";

/**
 * Whiteboard List — the milestone-grouped, fully keyboard-operable parity
 * view of the diagram. Same doc, same selection: selecting a bound task
 * row reports its dagNodeKey exactly like clicking the diagram node.
 */
export default function WhiteboardList({
  doc,
  live,
  roomOf,
  selectedNodeKey = null,
  locked = false,
  onSelect,
  onEditNode,
  onCycleOwnership,
}: {
  doc: WhiteboardDoc;
  live?: (nodeKey: string) => RunNodeLike | undefined;
  roomOf?: (nodeKey: string) => { roomName: string; glyph: string; agent: string | null } | undefined;
  selectedNodeKey?: string | null;
  locked?: boolean;
  onSelect?: (nodeKey: string | null) => void;
  onEditNode?: (nodeId: string) => void;
  onCycleOwnership?: (nodeId: string) => void;
}) {
  const milestones = doc.nodes
    .filter((n) => n.kind === "milestone")
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const notesFor = (taskId: string) =>
    doc.edges
      .filter((e) => e.kind === "note-link" && e.to === taskId)
      .map((e) => doc.nodes.find((n) => n.id === e.from))
      .filter((n): n is NonNullable<typeof n> => n != null && n.kind === "note");

  const groups = milestones.map((m) => ({
    milestone: m,
    tasks: doc.nodes.filter(
      (n) => n.kind === "task" && (n.milestoneKey ?? null) === (m.milestoneKey ?? m.id),
    ),
  }));
  const ungrouped = doc.nodes.filter(
    (n) =>
      n.kind === "task" &&
      !groups.some((g) => g.tasks.some((t) => t.id === n.id)),
  );

  return (
    <table className="table-cat text-[13px]" data-testid="whiteboard-list">
      <caption className="sr-only">
        Whiteboard revision {doc.revision} — milestones, tasks, owners, live state, and notes
      </caption>
      <thead>
        <tr>
          <th scope="col">Task</th>
          <th scope="col">Owner</th>
          <th scope="col">Live state</th>
          <th scope="col">Notes</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {groups.map(({ milestone, tasks }) => (
          <MilestoneGroup
            key={milestone.id}
            label={`${milestone.milestoneKey ?? "M"} · ${milestone.title}`}
            tasks={tasks}
            live={live}
            roomOf={roomOf}
            notesFor={notesFor}
            selectedNodeKey={selectedNodeKey}
            locked={locked}
            onSelect={onSelect}
            onEditNode={onEditNode}
            onCycleOwnership={onCycleOwnership}
          />
        ))}
        {ungrouped.length ? (
          <MilestoneGroup
            label="Ungrouped"
            tasks={ungrouped}
            live={live}
            roomOf={roomOf}
            notesFor={notesFor}
            selectedNodeKey={selectedNodeKey}
            locked={locked}
            onSelect={onSelect}
            onEditNode={onEditNode}
            onCycleOwnership={onCycleOwnership}
          />
        ) : null}
        {!groups.length && !ungrouped.length ? (
          <tr>
            <td colSpan={5} className="text-[hsl(var(--ink-soft))]">
              empty whiteboard — add milestones and tasks while holding the edit lease.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function MilestoneGroup({
  label,
  tasks,
  live,
  roomOf,
  notesFor,
  selectedNodeKey,
  locked,
  onSelect,
  onEditNode,
  onCycleOwnership,
}: {
  label: string;
  tasks: WhiteboardDoc["nodes"];
  live?: (nodeKey: string) => RunNodeLike | undefined;
  roomOf?: (nodeKey: string) => { roomName: string; glyph: string; agent: string | null } | undefined;
  notesFor: (taskId: string) => WhiteboardDoc["nodes"];
  selectedNodeKey: string | null;
  locked: boolean;
  onSelect?: (nodeKey: string | null) => void;
  onEditNode?: (nodeId: string) => void;
  onCycleOwnership?: (nodeId: string) => void;
}) {
  return (
    <>
      <tr>
        <th scope="rowgroup" colSpan={5} className="text-left">
          <span style={{ fontFamily: "'PT Serif', serif" }}>{label}</span>
        </th>
      </tr>
      {tasks.map((t) => {
        const bound = t.binding?.dagNodeKey ?? null;
        const row = bound ? live?.(bound) : undefined;
        const owner = bound ? roomOf?.(bound) : undefined;
        const notes = notesFor(t.id);
        const isSynced = bound != null && bound === selectedNodeKey;
        return (
          <tr key={t.id} data-node-id={t.id} data-selected={isSynced || undefined}>
            <td>
              <button
                type="button"
                className="min-h-[44px] text-left font-bold underline-offset-2 hover:underline"
                onClick={() => onSelect?.(bound)}
                aria-label={`Select ${t.title}${bound ? `, bound to ${bound}` : ", not in the approved plan"}`}
              >
                {t.title}
              </button>
              {bound ? (
                <span className="mono ml-1 text-[12px] text-[hsl(var(--cornflower))]">{bound}</span>
              ) : (
                <span className="chip chip-mustard ml-1">not in the approved plan</span>
              )}
              {isSynced ? <span className="chip chip-cornflower ml-1">⇄ synced</span> : null}
            </td>
            <td className="text-[13px]">
              {owner ? (
                <>
                  {owner.glyph} {owner.roomName}
                  {owner.agent ? ` · ${owner.agent}` : ""}
                </>
              ) : (
                <span className="text-[hsl(var(--ink-soft))]">—</span>
              )}
            </td>
            <td>
              {row ? (
                <span className="chip mono">
                  {row.state} · {row.attempts}/{NODE_MAX_ATTEMPTS}
                </span>
              ) : bound ? (
                <span className="chip chip-neutral">not scheduled</span>
              ) : (
                <span className="text-[hsl(var(--ink-soft))]">—</span>
              )}
            </td>
            <td className="mono text-[12px]">
              {notes.length ? (
                <ul>
                  {notes.map((n) => (
                    <li key={n.id} className="max-w-56 truncate" title={n.body}>
                      ✎ {n.title}
                    </li>
                  ))}
                </ul>
              ) : (
                "0"
              )}
            </td>
            <td>
              <span className="inline-flex gap-1">
                <button
                  type="button"
                  className="btn min-h-[44px] px-2 text-[12px]"
                  disabled={locked}
                  onClick={() => onEditNode?.(t.id)}
                  aria-label={`Edit ${t.title}`}
                >
                  Edit (E)
                </button>
                {t.kind === "task" ? (
                  <button
                    type="button"
                    className="btn min-h-[44px] px-2 text-[12px]"
                    disabled={locked}
                    onClick={() => onCycleOwnership?.(t.id)}
                    aria-label={`Cycle ownership for ${t.title}`}
                  >
                    Owner (O)
                  </button>
                ) : null}
              </span>
            </td>
          </tr>
        );
      })}
    </>
  );
}
