import type {
  NodeDepth,
  NodeKind,
  NodeStatus,
  OfficeRoom,
  OfficeRoomMember,
  OfficeSnapshot,
  Project,
  ProjectNode,
  ProjectRun,
} from './contract';

/**
 * Office room projection. Rooms are a pure, deterministic DERIVATION of the
 * project hierarchy plus (optionally) live run node states — never a second
 * source of truth. Only layout metadata (order/labels) and node reassignment
 * fields (roomId/parentId) are persisted on the project.
 *
 * This module is dependency-free so both the main process and the renderer
 * can share the exact same derivation (room/list parity by construction).
 */

export const MAX_HIERARCHY_DEPTH = 2 as const;
export const MAX_PROJECT_NODES = 24 as const;

export const OFFICE_ROOMS = [
  { id: 'executive', label: 'Executive' },
  { id: 'research', label: 'Research' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'design', label: 'Design' },
  { id: 'data', label: 'Data' },
  { id: 'qa', label: 'QA' },
  { id: 'operations', label: 'Operations' },
] as const;

export type OfficeRoomId = (typeof OFFICE_ROOMS)[number]['id'];

const ROOM_IDS = new Set<string>(OFFICE_ROOMS.map((r) => r.id));

export function isOfficeRoomId(value: unknown): value is OfficeRoomId {
  return typeof value === 'string' && ROOM_IDS.has(value);
}

const KIND_BY_DEPTH: Record<NodeDepth, NodeKind> = {
  0: 'director',
  1: 'subdirector',
  2: 'worker',
};

export function kindForDepth(depth: NodeDepth): NodeKind {
  return KIND_BY_DEPTH[depth];
}

const ROLE_DEFAULT_ROOM: Record<string, OfficeRoomId> = {
  director: 'executive',
  research: 'research',
  build: 'engineering',
  review: 'qa',
  custom: 'operations',
};

const TITLE_ROOM_HINTS: Array<[RegExp, OfficeRoomId]> = [
  [/research|analys|literature|evidence/i, 'research'],
  [/architect/i, 'architecture'],
  [/engineer|build|deliver|implement/i, 'engineering'],
  [/design|ux|ui|visual/i, 'design'],
  [/data|analytics|intelligence/i, 'data'],
  [/assurance|qa|quality|review|audit/i, 'qa'],
  [/operations|delivery|program|pm\b/i, 'operations'],
];

/**
 * Deterministic default room for a node: explicit roomId wins, then skill
 * role, then kind/role/title conventions, then the parent's room.
 */
export function defaultRoomForNode(
  node: ProjectNode,
  parentRoom: OfficeRoomId | null,
  skillRole: string | null,
): OfficeRoomId {
  if (isOfficeRoomId(node.roomId)) return node.roomId;
  if (node.kind === 'director' || node.depth === 0) return 'executive';
  if (skillRole !== null && isOfficeRoomId(skillRole)) return skillRole;
  if (node.kind === 'subdirector' || node.kind === 'worker') {
    for (const [pattern, room] of TITLE_ROOM_HINTS) {
      if (pattern.test(node.title)) return room;
    }
    if (parentRoom !== null && parentRoom !== 'executive') return parentRoom;
    return 'operations';
  }
  return ROLE_DEFAULT_ROOM[node.role] ?? 'operations';
}

export interface DeriveOfficeOptions {
  /** skill id -> canonical room id, from the SkillRegistry (optional). */
  skillRoles?: ReadonlyMap<string, string>;
  /** Live run for member status; nodeStates take precedence over design status. */
  run?: ProjectRun | null;
}

/**
 * Project the project nodes into rooms. Parity invariant: every node appears
 * in exactly one room, so sum(members) === project.nodes.length.
 */
export function deriveOfficeRooms(project: Project, options: DeriveOfficeOptions = {}): OfficeRoom[] {
  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  const roomOf = new Map<string, OfficeRoomId>();

  // Resolve in hierarchy order (parents before children) so workers can
  // inherit their sub-director's room. Depth-first over parentId chains with
  // memoization; cycles fall back to role defaults (validation rejects them
  // upstream, but derivation must never throw).
  const resolve = (node: ProjectNode, seen: Set<string>): OfficeRoomId => {
    const cached = roomOf.get(node.id);
    if (cached) return cached;
    let parentRoom: OfficeRoomId | null = null;
    if (node.parentId && !seen.has(node.parentId)) {
      const parent = byId.get(node.parentId);
      if (parent) {
        seen.add(node.id);
        parentRoom = resolve(parent, seen);
        seen.delete(node.id);
      }
    }
    const skillRole =
      node.skillRef != null ? options.skillRoles?.get(node.skillRef) ?? null : null;
    const room = defaultRoomForNode(node, parentRoom, skillRole);
    roomOf.set(node.id, room);
    return room;
  };

  const members = new Map<OfficeRoomId, OfficeRoomMember[]>();
  for (const node of project.nodes) {
    const room = resolve(node, new Set());
    const status: NodeStatus = options.run?.nodeStates[node.id]?.status ?? node.status;
    const member: OfficeRoomMember = {
      nodeId: node.id,
      title: node.title,
      kind: node.kind ?? null,
      role: node.role,
      depth: node.depth ?? null,
      parentId: node.parentId ?? null,
      roomId: room,
      skillRef: node.skillRef ?? null,
      status,
    };
    const list = members.get(room) ?? [];
    list.push(member);
    members.set(room, list);
  }

  // Canonical order, with persisted layout overrides (order/labels) applied.
  const orderOverride = new Map<string, number>();
  if (Array.isArray(project.office?.roomOrder)) {
    project.office.roomOrder.forEach((id, i) => {
      if (isOfficeRoomId(id) && !orderOverride.has(id)) orderOverride.set(id, i);
    });
  }
  const labels = project.office?.roomLabels ?? {};

  const rooms: OfficeRoom[] = [];
  for (const [index, def] of OFFICE_ROOMS.entries()) {
    const roomMembers = members.get(def.id);
    if (!roomMembers || roomMembers.length === 0) continue;
    const customLabel = labels[def.id];
    rooms.push({
      id: def.id,
      label: typeof customLabel === 'string' && customLabel.trim().length > 0 ? customLabel.trim().slice(0, 60) : def.label,
      order: orderOverride.get(def.id) ?? index,
      members: roomMembers,
    });
  }
  rooms.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return rooms;
}

/** Full snapshot DTO for IPC. */
export function deriveOfficeSnapshot(
  project: Project,
  run: ProjectRun | null,
  skillRoles?: ReadonlyMap<string, string>,
): OfficeSnapshot {
  const rooms = deriveOfficeRooms(project, { run, skillRoles });
  return {
    projectId: project.id,
    version: project.version,
    template: project.template ?? 'standard',
    runId: run?.id ?? null,
    rooms,
    nodeCount: project.nodes.length,
  };
}
