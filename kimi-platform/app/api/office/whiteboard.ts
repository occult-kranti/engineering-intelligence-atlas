import type {
  WbDriftKind,
  WbEdge,
  WbExportFormat,
  WbNode,
  WbNote,
  WhiteboardOp,
} from "@contracts/office";

/**
 * Whiteboard domain ops (autonomy design §5, whiteboard design §4). Pure
 * and deterministic; the router shell runs `applyWhiteboardOps` inside one
 * transaction whose first statement is the guarded board update
 * (version = version + 1 WHERE id = ? AND version = ?) — affectedRows is
 * the arbiter, so two concurrent op-batches cannot both win.
 *
 * No execution surface exists: node kinds are a closed enum (no
 * script/html kind), content is capped text, the server never evaluates
 * content, and export is server-rendered JSON/markdown — injection-like
 * content is stored and exported as inert DATA.
 */

// ── Board document ───────────────────────────────────────────────

export interface WbEditLease {
  token: string;
  holder: string;
  /** Epoch milliseconds. */
  expiresAtMs: number;
}

export interface WbBoard {
  id: number;
  projectId: number;
  title: string;
  /** Snapshot identity; bumps per applied op-batch. */
  revision: number;
  /** OCC guard on every applyOps (mirrors run_nodes.version discipline). */
  version: number;
  status: "active" | "archived";
  nodes: WbNode[];
  edges: WbEdge[];
  /** Append-only; never snapshotted, never updated/deleted. */
  notes: WbNote[];
  editLease: WbEditLease | null;
}

/** Snapshot row shape (whiteboard_revisions; notes excluded by design). */
export interface WbSnapshot {
  revision: number;
  doc: { nodes: WbNode[]; edges: WbEdge[] };
}

// ── Edit lease (single-writer; same discipline as worker leases) ─

export type LeaseCheck =
  | { ok: true }
  | { ok: false; error: "lease_required" }
  | { ok: false; error: "locked"; holder: string; expiresAtMs: number }
  | { ok: false; error: "fenced"; holder: string };

/**
 * Gate a mutation on the edit lease:
 *  - no lease on the board → lease_required (a writer MUST acquire first;
 *    an arbitrary presented token never substitutes for acquisition);
 *  - active (unexpired) lease held by someone else → locked (read-only);
 *  - expired lease (force-expired by Take over, or TTL lapsed) and the
 *    caller is the stale holder → fenced (the stale holder's save loses;
 *    their work survives only as an unsaved local copy);
 *  - token matches the active lease → ok.
 */
export function checkEditLease(
  board: WbBoard,
  presentedToken: string | null,
  nowMs: number,
): LeaseCheck {
  const lease = board.editLease;
  if (!lease) {
    return { ok: false, error: "lease_required" };
  }
  const active = lease.expiresAtMs > nowMs;
  if (active) {
    if (presentedToken === lease.token) return { ok: true };
    return {
      ok: false,
      error: "locked",
      holder: lease.holder,
      expiresAtMs: lease.expiresAtMs,
    };
  }
  // Expired lease: only a stale holder replaying their old token is fenced;
  // a writer who acquired a fresh lease presents the NEW token, which the
  // board row would then hold — handled by the acquire path, not here.
  return { ok: false, error: "fenced", holder: lease.holder };
}

/** Take-over: force-expire the current lease and seat the new holder. */
export function takeOverEditLease(
  board: WbBoard,
  newLease: WbEditLease,
): WbBoard {
  return { ...board, editLease: newLease };
}

// ── Reference integrity (same-project rule) ──────────────────────

/** Lookup result for a referenced run node or artifact. */
export interface RefResolution {
  exists: boolean;
  /** Owning project when it exists; null when not found. */
  projectId: number | null;
}

export type RefResolver = (
  ref: { runId: number; nodeKey: string } | { artifactId: number },
) => RefResolution;

function refsOf(node: WbNode): Array<Parameters<RefResolver>[0]> {
  const refs: Array<Parameters<RefResolver>[0]> = [];
  if (node.kind === "run-node-ref" && node.refRunId !== null && node.refNodeKey) {
    refs.push({ runId: node.refRunId, nodeKey: node.refNodeKey });
  }
  if (node.kind === "artifact-ref" && node.refArtifactId !== null) {
    refs.push({ artifactId: node.refArtifactId });
  }
  return refs;
}

// ── applyOps (design §5.2) ───────────────────────────────────────

export type ApplyOpsError =
  | { error: "version_conflict"; currentVersion: number }
  | { error: "archived" }
  | LeaseCheck & { ok: false }
  | { error: "bad_request"; message: string }
  | { error: "conflict"; message: string }
  | { error: "forbidden"; message: string };

export interface ApplyOpsSuccess {
  ok: true;
  board: WbBoard;
  snapshot: WbSnapshot;
}

/**
 * Apply an op-batch. Order of checks mirrors the transaction:
 *  1. OCC: expectedVersion must equal board.version (the guarded update
 *     is the arbiter in the real tx).
 *  2. Edit lease (single writer).
 *  3. Ops applied to a working copy; node/edge key uniqueness enforced
 *     (unique (whiteboard_id, key) indexes in the real tx).
 *  4. Reference integrity: referenced run nodes/artifacts must exist AND
 *     belong to the same project (cross-project ⇒ forbidden — the
 *     whiteboard equivalent of mustOwnRun).
 *  5. End-state integrity: every edge endpoint exists.
 * Success bumps version AND revision and returns the revision snapshot —
 * versioning is transactional with the content change.
 */
export function applyWhiteboardOps(input: {
  board: WbBoard;
  ops: WhiteboardOp[];
  expectedVersion: number;
  editToken: string | null;
  nowMs: number;
  resolveRef?: RefResolver;
}): ApplyOpsSuccess | { ok: false; error: ApplyOpsError } {
  const { board } = input;
  if (input.expectedVersion !== board.version) {
    return {
      ok: false,
      error: { error: "version_conflict", currentVersion: board.version },
    };
  }
  if (board.status === "archived") {
    return { ok: false, error: { error: "archived" } };
  }
  const lease = checkEditLease(board, input.editToken, input.nowMs);
  if (!lease.ok) return { ok: false, error: lease };

  const nodes = new Map<string, WbNode>(board.nodes.map((n) => [n.nodeKey, n]));
  const edges = new Map<string, WbEdge>(board.edges.map((e) => [e.edgeKey, e]));
  const notes: WbNote[] = [...board.notes];

  for (const op of input.ops) {
    switch (op.op) {
      case "addNode": {
        if (nodes.has(op.node.nodeKey)) {
          return {
            ok: false,
            error: {
              error: "conflict",
              message: `duplicate node key: ${op.node.nodeKey}`,
            },
          };
        }
        nodes.set(op.node.nodeKey, op.node);
        break;
      }
      case "updateNode": {
        const existing = nodes.get(op.nodeKey);
        if (!existing) {
          return {
            ok: false,
            error: {
              error: "bad_request",
              message: `unknown node key: ${op.nodeKey}`,
            },
          };
        }
        nodes.set(op.nodeKey, { ...existing, ...op.patch });
        break;
      }
      case "removeNode": {
        if (!nodes.has(op.nodeKey)) {
          return {
            ok: false,
            error: {
              error: "bad_request",
              message: `unknown node key: ${op.nodeKey}`,
            },
          };
        }
        nodes.delete(op.nodeKey);
        break;
      }
      case "addEdge": {
        if (edges.has(op.edge.edgeKey)) {
          return {
            ok: false,
            error: {
              error: "conflict",
              message: `duplicate edge key: ${op.edge.edgeKey}`,
            },
          };
        }
        edges.set(op.edge.edgeKey, op.edge);
        break;
      }
      case "removeEdge": {
        if (!edges.has(op.edgeKey)) {
          return {
            ok: false,
            error: {
              error: "bad_request",
              message: `unknown edge key: ${op.edgeKey}`,
            },
          };
        }
        edges.delete(op.edgeKey);
        break;
      }
      case "addNote": {
        if (op.note.nodeKey !== null && !nodes.has(op.note.nodeKey)) {
          return {
            ok: false,
            error: {
              error: "bad_request",
              message: `note targets unknown node: ${op.note.nodeKey}`,
            },
          };
        }
        notes.push(op.note);
        break;
      }
    }
  }

  // Reference integrity (design §5.2 step 3).
  const resolveRef = input.resolveRef;
  if (resolveRef) {
    for (const node of nodes.values()) {
      for (const ref of refsOf(node)) {
        const resolved = resolveRef(ref);
        if (!resolved.exists) {
          return {
            ok: false,
            error: {
              error: "bad_request",
              message: `reference not found for node ${node.nodeKey}`,
            },
          };
        }
        if (resolved.projectId !== board.projectId) {
          return {
            ok: false,
            error: {
              error: "forbidden",
              message: `cross-project reference on node ${node.nodeKey}`,
            },
          };
        }
      }
    }
  }

  // End-state structural integrity: edges must land on live nodes.
  for (const edge of edges.values()) {
    if (!nodes.has(edge.fromKey) || !nodes.has(edge.toKey)) {
      return {
        ok: false,
        error: {
          error: "bad_request",
          message: `edge ${edge.edgeKey} references a missing node`,
        },
      };
    }
  }

  const nextBoard: WbBoard = {
    ...board,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    notes,
    version: board.version + 1,
    revision: board.revision + 1,
  };
  return {
    ok: true,
    board: nextBoard,
    snapshot: {
      revision: nextBoard.revision,
      doc: { nodes: nextBoard.nodes, edges: nextBoard.edges },
    },
  };
}

// ── Drift detection (cartographer; design §4.1 / §7.2) ───────────

export interface WbDrift {
  kind: WbDriftKind;
  /** Whiteboard node carrying the stale intent, when applicable. */
  nodeKey: string | null;
  message: string;
}

export interface WbLiveState {
  /** Live run nodes as "runId:nodeKey". */
  runNodeIds: ReadonlySet<string>;
  /** Live artifact ids. */
  artifactIds: ReadonlySet<number>;
}

/**
 * Deterministic drift report — the derived truth is the run graph; the
 * whiteboard refs are the owner's intent. Drift is reported, never
 * auto-corrected (the cartographer annotates; the owner decides).
 * Sorted by (kind, nodeKey/message) for stable rendering.
 */
export function detectWhiteboardDrift(
  board: Pick<WbBoard, "nodes">,
  live: WbLiveState,
): WbDrift[] {
  const drift: WbDrift[] = [];
  const referencedRunNodes = new Set<string>();

  for (const node of board.nodes) {
    if (node.kind === "run-node-ref" && node.refRunId !== null && node.refNodeKey) {
      const id = `${node.refRunId}:${node.refNodeKey}`;
      referencedRunNodes.add(id);
      if (!live.runNodeIds.has(id)) {
        drift.push({
          kind: "run-node-ref-missing",
          nodeKey: node.nodeKey,
          message: `whiteboard node ${node.nodeKey} references missing run node ${id}`,
        });
      }
    }
    if (node.kind === "artifact-ref" && node.refArtifactId !== null) {
      if (!live.artifactIds.has(node.refArtifactId)) {
        drift.push({
          kind: "artifact-ref-missing",
          nodeKey: node.nodeKey,
          message: `whiteboard node ${node.nodeKey} references missing artifact ${node.refArtifactId}`,
        });
      }
    }
  }

  for (const id of [...live.runNodeIds].sort()) {
    if (!referencedRunNodes.has(id)) {
      drift.push({
        kind: "unreferenced-run-node",
        nodeKey: null,
        message: `run node ${id} has no whiteboard reference`,
      });
    }
  }

  return drift.sort((a, b) =>
    a.kind === b.kind
      ? a.message.localeCompare(b.message)
      : a.kind.localeCompare(b.kind),
  );
}

// ── Export (design §5.3): server-rendered, provenance-honest ─────

export interface WbExport {
  format: WbExportFormat;
  body: string;
}

/**
 * Export-safe JSON: the document plus provenance, content verbatim as
 * data. JSON.stringify can never emit executable content; no `eval`, no
 * HTML. Keys are emitted in a fixed order for stable diffs/snapshots.
 */
export function exportWhiteboardJson(board: WbBoard): WbExport {
  const payload = {
    format: "whiteboard+json",
    whiteboardId: board.id,
    projectId: board.projectId,
    title: board.title,
    revision: board.revision,
    nodes: board.nodes,
    edges: board.edges,
    notes: board.notes,
  };
  return { format: "json", body: JSON.stringify(payload, null, 2) };
}

const KIND_ORDER: Record<WbNode["kind"], number> = {
  section: 0,
  text: 1,
  sticky: 2,
  "artifact-ref": 3,
  "run-node-ref": 4,
};

/**
 * Server-rendered markdown: title, nodes grouped by kind (with resolved
 * reference labels), edges, notes. Content is emitted as plain text data
 * under list items — markdown is inert; the server never evaluates it.
 */
export function exportWhiteboardMarkdown(board: WbBoard): WbExport {
  const lines: string[] = [
    `# ${board.title}`,
    "",
    `_whiteboard ${board.id} · revision ${board.revision}_`,
    "",
    "## Nodes",
  ];
  const sorted = [...board.nodes].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.nodeKey.localeCompare(b.nodeKey),
  );
  for (const node of sorted) {
    const ref =
      node.kind === "run-node-ref" && node.refRunId !== null
        ? ` → run ${node.refRunId} node ${node.refNodeKey}`
        : node.kind === "artifact-ref" && node.refArtifactId !== null
          ? ` → artifact ${node.refArtifactId}`
          : "";
    lines.push(`- [${node.kind}] \`${node.nodeKey}\`${ref}`);
    if (node.content) lines.push(`  - ${node.content}`);
  }
  lines.push("", "## Edges");
  for (const edge of [...board.edges].sort((a, b) =>
    a.edgeKey.localeCompare(b.edgeKey),
  )) {
    lines.push(
      `- \`${edge.edgeKey}\` (${edge.kind}): \`${edge.fromKey}\` → \`${edge.toKey}\``,
    );
  }
  lines.push("", "## Notes");
  for (const note of board.notes) {
    const target = note.nodeKey ? ` on \`${note.nodeKey}\`` : "";
    lines.push(`- (${note.author}: ${note.authorRef})${target}: ${note.body}`);
  }
  return { format: "markdown", body: lines.join("\n") };
}

export function exportWhiteboard(
  board: WbBoard,
  format: WbExportFormat,
): WbExport {
  return format === "json"
    ? exportWhiteboardJson(board)
    : exportWhiteboardMarkdown(board);
}
