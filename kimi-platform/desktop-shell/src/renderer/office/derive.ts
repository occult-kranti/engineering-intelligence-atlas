/**
 * Pure derivations from Project/ProjectRun objects. Every surface (canvas
 * rooms, sitemap list, roadmap DAG, canonical list) is built from these same
 * functions — there is no parallel fake state.
 */

import type { NodeStatus, Project, ProjectNode, ProjectRun, RunEventRecord } from './types.js';

export interface Room {
  id: string;
  label: string;
  nodeIds: string[];
}

export interface DeskStatus {
  nodeId: string;
  status: NodeStatus;
  error: string | null;
}

/** Stable room id for a node: explicit v3 roomId, else derived from role. */
export function roomIdForNode(node: ProjectNode): string {
  if (node.roomId && node.roomId.trim().length > 0) return node.roomId;
  return `room:${node.role}`;
}

const ROLE_ROOM_LABELS: Record<string, string> = {
  'room:director': 'Direction',
  'room:research': 'Research',
  'room:build': 'Build',
  'room:review': 'Review',
  'room:custom': 'Specialists',
};

export function roomLabel(roomId: string): string {
  const known = ROLE_ROOM_LABELS[roomId];
  if (known) return known;
  const stripped = roomId.replace(/^room:/, '');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/**
 * Group project nodes into rooms, preserving project node order inside each
 * room and first-appearance order for the rooms themselves.
 */
export function deriveRooms(project: Project): Room[] {
  const rooms: Room[] = [];
  const byId = new Map<string, Room>();
  for (const node of project.nodes) {
    const id = roomIdForNode(node);
    let room = byId.get(id);
    if (!room) {
      room = { id, label: roomLabel(id), nodeIds: [] };
      byId.set(id, room);
      rooms.push(room);
    }
    room.nodeIds.push(node.id);
  }
  return rooms;
}

/** Live desk status for a node from the current run (pending without a run). */
export function deskStatusFor(nodeId: string, run: ProjectRun | null): DeskStatus {
  const state = run?.nodeStates[nodeId];
  return {
    nodeId,
    status: state?.status ?? 'pending',
    error: state?.error ?? null,
  };
}

// --------------------------------------------------------------------------
// Canvas layout (deterministic; world coordinates)
// --------------------------------------------------------------------------

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1600;
const ROOM_MARGIN = 80;
const ROOM_PAD = 28;
const ROOM_HEADER = 46;
const DESK_W = 190;
const DESK_H = 64;
const DESK_GAP = 16;
/** Desks shrink (never grow) so dense rooms always fit their cell: no overflow at 24 nodes. */
const DESK_W_MIN = 110;
const DESK_H_MIN = 44;

export interface DeskLayout {
  nodeId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface RoomLayout {
  room: Room;
  x: number;
  y: number;
  w: number;
  h: number;
  desks: DeskLayout[];
}

/** Natural (unshrunk) cell budget for content-aware clustering. */
const NATURAL_CELL_W = 1120;
const NATURAL_CELL_H = 840;
const CELL_SLACK = 56;

interface RoomSize {
  deskCols: number;
  deskW: number;
  deskRows: number;
  deskH: number;
  w: number;
  h: number;
}

/** Size a room's desk grid to fit innerW×innerH, shrinking desks toward the readable minimum. */
function sizeRoom(count: number, innerW: number, innerH: number): RoomSize {
  // Wider-than-tall desk grid that best fills the cell aspect ratio.
  let deskCols = Math.max(1, Math.min(count, Math.round(Math.sqrt((count * innerW) / Math.max(1, innerH * 1.6)))));
  let deskW = DESK_W;
  const widthFor = (c: number, w: number) => c * w + (c - 1) * DESK_GAP;
  while (deskCols > 1 && widthFor(deskCols, Math.max(DESK_W_MIN, deskW)) > innerW) {
    deskCols -= 1;
  }
  deskW = Math.max(DESK_W_MIN, Math.min(DESK_W, Math.floor((innerW - (deskCols - 1) * DESK_GAP) / deskCols)));
  let deskRows = Math.ceil(count / deskCols);
  let deskH = Math.max(
    DESK_H_MIN,
    Math.min(DESK_H, Math.floor((innerH - (deskRows - 1) * DESK_GAP) / Math.max(1, deskRows))),
  );
  // If even the minimum height overflows, add columns (desks stay readable width-first).
  while (deskRows > 1 && deskRows * DESK_H_MIN + (deskRows - 1) * DESK_GAP > innerH && deskCols < count) {
    deskCols += 1;
    deskW = Math.max(DESK_W_MIN, Math.min(DESK_W, Math.floor((innerW - (deskCols - 1) * DESK_GAP) / deskCols)));
    deskRows = Math.ceil(count / deskCols);
    deskH = Math.max(DESK_H_MIN, Math.min(DESK_H, Math.floor((innerH - (deskRows - 1) * DESK_GAP) / deskRows)));
  }
  const w = ROOM_PAD * 2 + widthFor(deskCols, deskW);
  const h = ROOM_HEADER + ROOM_PAD * 2 + deskRows * deskH + (deskRows - 1) * DESK_GAP;
  return { deskCols, deskW, deskRows, deskH, w, h };
}

/**
 * Lay rooms out on a deterministic grid sized to the desk counts. Cells are
 * content-tight: small offices cluster (so the camera's initial fit keeps
 * desks readable instead of shrinking to the whole world); dense offices
 * (e.g. 24 rooms / 24 desks in a room) shrink desks toward the readable
 * minimum so nothing ever overflows the room or the world.
 */
export function layoutRooms(rooms: Room[]): RoomLayout[] {
  if (rooms.length === 0) return [];
  const cols = Math.ceil(Math.sqrt(rooms.length));
  const rows = Math.ceil(rooms.length / cols);
  const worldCellW = Math.floor((WORLD_WIDTH - ROOM_MARGIN * 2) / cols);
  const worldCellH = Math.floor((WORLD_HEIGHT - ROOM_MARGIN * 2) / rows);
  // Pass 1: natural sizes decide how tight the grid may cluster.
  let naturalW = 0;
  let naturalH = 0;
  for (const room of rooms) {
    const size = sizeRoom(room.nodeIds.length, NATURAL_CELL_W - 32 - ROOM_PAD * 2, NATURAL_CELL_H - 32 - ROOM_HEADER - ROOM_PAD * 2);
    naturalW = Math.max(naturalW, size.w);
    naturalH = Math.max(naturalH, size.h);
  }
  const cellW = Math.min(worldCellW, naturalW + CELL_SLACK);
  const cellH = Math.min(worldCellH, naturalH + CELL_SLACK);
  const innerW = cellW - 32 - ROOM_PAD * 2;
  const innerH = cellH - 32 - ROOM_HEADER - ROOM_PAD * 2;
  // Pass 2: fit each room into its final cell.
  return rooms.map((room, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const count = room.nodeIds.length;
    const { deskCols, deskW, deskRows, deskH, w, h } = sizeRoom(count, innerW, innerH);
    const x = ROOM_MARGIN + col * cellW + Math.floor((cellW - w) / 2);
    const y = ROOM_MARGIN + row * cellH + Math.floor((cellH - h) / 2);
    const desks: DeskLayout[] = room.nodeIds.map((nodeId, d) => {
      const dc = d % deskCols;
      const dr = Math.floor(d / deskCols);
      return {
        nodeId,
        x: x + ROOM_PAD + dc * (deskW + DESK_GAP),
        y: y + ROOM_HEADER + ROOM_PAD + dr * (deskH + DESK_GAP),
        w: deskW,
        h: deskH,
      };
    });
    return { room, x, y, w, h, desks };
  });
}

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Tight bounds of the actually-used room area, for content-aware camera fit. */
export function usedBounds(layouts: RoomLayout[], padding = 120): WorldBounds {
  if (layouts.length === 0) return { minX: 0, minY: 0, maxX: WORLD_WIDTH, maxY: WORLD_HEIGHT };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const l of layouts) {
    minX = Math.min(minX, l.x);
    minY = Math.min(minY, l.y);
    maxX = Math.max(maxX, l.x + l.w);
    maxY = Math.max(maxY, l.y + l.h);
  }
  return {
    minX: Math.max(0, minX - padding),
    minY: Math.max(0, minY - padding),
    maxX: Math.min(WORLD_WIDTH, maxX + padding),
    maxY: Math.min(WORLD_HEIGHT, maxY + padding),
  };
}

export interface DeskEdge {
  fromNodeId: string;
  toNodeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Dependency edges between desk centers, for the canvas SVG edge layer. */
export function layoutEdges(project: Project, layouts: RoomLayout[]): DeskEdge[] {
  const deskByNode = new Map<string, DeskLayout>();
  for (const layout of layouts) {
    for (const desk of layout.desks) deskByNode.set(desk.nodeId, desk);
  }
  const edges: DeskEdge[] = [];
  for (const node of project.nodes) {
    const to = deskByNode.get(node.id);
    if (!to) continue;
    for (const dep of node.dependsOn) {
      const from = deskByNode.get(dep);
      if (!from) continue;
      edges.push({
        fromNodeId: dep,
        toNodeId: node.id,
        x1: from.x + from.w / 2,
        y1: from.y + from.h / 2,
        x2: to.x + to.w / 2,
        y2: to.y + to.h / 2,
      });
    }
  }
  return edges;
}

// --------------------------------------------------------------------------
// Roadmap DAG layers + loop attempts
// --------------------------------------------------------------------------

export interface RoadmapRow {
  node: ProjectNode;
  /** Topological depth (longest dependency chain). 0 for roots. */
  layer: number;
  /** Owner: parent node title when v3 parentId exists, else the room label. */
  owner: string;
  /** Highest loop iteration observed for this node in run events (0 = none). */
  loopAttempts: number;
  status: NodeStatus;
  error: string | null;
}

/** Longest-path layering of the dependency DAG (cycle-safe). */
export function dependencyLayers(project: Project): Map<string, number> {
  const layers = new Map<string, number>();
  const visiting = new Set<string>();
  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  const layerOf = (id: string): number => {
    const memo = layers.get(id);
    if (memo !== undefined) return memo;
    if (visiting.has(id)) return 0; // cycle guard
    const node = byId.get(id);
    if (!node) return 0;
    visiting.add(id);
    let layer = 0;
    for (const dep of node.dependsOn) {
      layer = Math.max(layer, layerOf(dep) + 1);
    }
    visiting.delete(id);
    layers.set(id, layer);
    return layer;
  };
  for (const node of project.nodes) layerOf(node.id);
  return layers;
}

/** Number of bounded-loop revision requeues per node from persisted events. */
export function loopRequeuesByNode(events: RunEventRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const ev of events) {
    if (ev.event !== 'loop-requeued' || !ev.nodeId) continue;
    map.set(ev.nodeId, (map.get(ev.nodeId) ?? 0) + 1);
  }
  return map;
}

/** Canonical roadmap rows — the list view and the SVG DAG both read these. */
export function roadmapRows(project: Project, run: ProjectRun | null, events: RunEventRecord[]): RoadmapRow[] {
  const layers = dependencyLayers(project);
  const requeues = loopRequeuesByNode(events);
  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  return project.nodes.map((node) => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const state = run?.nodeStates[node.id];
    // Loop attempts: prefer the persisted attempt counter; fall back to
    // counting loop-requeued events for this node.
    const loopAttempts = state?.attempt ?? requeues.get(node.id) ?? 0;
    return {
      node,
      layer: layers.get(node.id) ?? 0,
      owner: parent ? parent.title : roomLabel(roomIdForNode(node)),
      loopAttempts,
      status: state?.status ?? 'pending',
      error: state?.error ?? null,
    };
  });
}

/** Run is in a state where it can (attempt to) be recovered. */
export function isRecoverable(run: ProjectRun | null): boolean {
  return run !== null && run.status === 'interrupted';
}

/** Run is active (start disabled, cancel enabled). */
export function isRunActive(run: ProjectRun | null): boolean {
  return (
    run !== null &&
    (run.status === 'running' || run.status === 'paused' || run.status === 'waiting-approval')
  );
}
