/**
 * Spatial office canvas: monochrome line-based rooms with live worker desks
 * on a large pannable/zoomable world. Pan/zoom is provided by the vendored
 * `panzoom` package (MIT, loaded from ./vendor/panzoom — no CDN). The factory
 * is injected so tests can run deterministically under jsdom.
 *
 * Camera contract (v0.4):
 *  - Content-aware initial fit: the used room bounds are centered at a
 *    readable scale, never the whole world (desks stay legible).
 *  - Manual navigation (drag / wheel / controls) disables auto-refit;
 *    Reset always recovers the fitted view.
 *  - focusNode/focusRoom is an interruptible smooth flight; with reduced
 *    motion it jumps instantly and outlines the room instead.
 *  - Every animation path checks the shared reduced-motion gate.
 */

import { clear, el, svgEl } from './dom.js';
import { MOTION_TOKENS, animate, isMotionReduced } from './motion.js';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  deriveRooms,
  deskStatusFor,
  layoutEdges,
  layoutRooms,
  usedBounds,
  type Room,
  type RoomLayout,
  type WorldBounds,
} from './derive.js';
import type { NodeStatus, Project, ProjectRun } from './types.js';

/** Structural view of the vendored panzoom 9.x API actually shipped. */
export interface PanzoomInstance {
  moveTo?(x: number, y: number): void;
  smoothMoveTo?(x: number, y: number): void;
  moveBy?(dx: number, dy: number, smooth?: boolean): void;
  zoomAbs?(x: number, y: number, scale: number): void;
  smoothZoom?(x: number, y: number, scaleMultiplier: number): void;
  smoothZoomAbs?(x: number, y: number, scale: number): void;
  showRectangle?(rect: { left: number; top: number; right: number; bottom: number }): void;
  getTransform?(): { x: number; y: number; scale: number };
  getScale?(): number;
  on?(eventName: string, cb: (...args: unknown[]) => void): void;
  dispose(): void;
}
export type PanzoomFactory = (elem: HTMLElement, options?: Record<string, unknown>) => PanzoomInstance;

export interface CanvasOptions {
  viewport: HTMLElement;
  world: HTMLElement;
  panzoomFactory: PanzoomFactory;
  onSelectNode(nodeId: string): void;
}

export interface OfficeCanvas {
  /** `rooms` overrides local derivation (e.g. from a v3 office snapshot). */
  update(project: Project | null, run: ProjectRun | null, rooms?: Room[]): void;
  setSelected(nodeId: string | null): void;
  /** Fly the camera to the room containing the node (interruptible). */
  focusNode(nodeId: string): void;
  zoomIn(): void;
  zoomOut(): void;
  /** Directional pan (non-drag alternative, also keyboard arrows). */
  panBy(dx: number, dy: number): void;
  /** Refit on container resize, but only until the user navigates manually. */
  notifyResize(): void;
  resetView(): void;
  dispose(): void;
}

interface CameraTransform {
  x: number;
  y: number;
  scale: number;
}

/** Minimum readable scale for the content-aware fit (desks stay legible). */
const MIN_FIT_SCALE = 0.2;
const MAX_FIT_SCALE = 1;
const ZOOM_STEP = 1.3;
const PAN_STEP = 120;

export function createOfficeCanvas(opts: CanvasOptions): OfficeCanvas {
  const { viewport, world, panzoomFactory, onSelectNode } = opts;
  world.style.width = `${WORLD_WIDTH}px`;
  world.style.height = `${WORLD_HEIGHT}px`;

  let project: Project | null = null;
  let run: ProjectRun | null = null;
  let roomsOverride: Room[] | null = null;
  let selectedNodeId: string | null = null;
  let pz: PanzoomInstance | null = null;
  let fittedOnce = false;
  let manualNav = false;
  let lastLayouts: RoomLayout[] = [];
  let lastBounds: WorldBounds | null = null;
  /** Room currently outlined by a focus jump/flight; survives re-renders. */
  let focusedRoomId: string | null = null;
  let flight: { cancel: () => void } | null = null;
  /** Suppresses manual-nav marking while a programmatic camera op runs. */
  let programmaticDepth = 0;

  function ensurePanzoom(): void {
    if (pz) return;
    // Vendored panzoom bounds are minZoom/maxZoom; keyboard pan/zoom stays
    // enabled (arrow keys / +/-) via our own handlers for accessibility.
    pz = panzoomFactory(world, {
      minZoom: 0.25,
      maxZoom: 2.5,
      zoomSpeed: 0.065,
      smoothScroll: !isMotionReduced(),
    });
    pz.on?.('panstart', () => {
      if (programmaticDepth === 0) manualNav = true;
      cancelFlight();
    });
  }

  function currentTransform(): CameraTransform {
    return pz?.getTransform?.() ?? { x: 0, y: 0, scale: 1 };
  }

  function applyTransform(t: CameraTransform): void {
    if (!pz) return;
    // zoomAbs keeps the focal viewport point stationary; with focal (0,0) the
    // translate is preserved as-is, then moveTo sets the absolute pan.
    pz.zoomAbs?.(0, 0, t.scale);
    pz.moveTo?.(t.x, t.y);
  }

  function programmatic(fn: () => void): void {
    programmaticDepth += 1;
    try {
      fn();
    } finally {
      window.setTimeout(() => {
        programmaticDepth = Math.max(0, programmaticDepth - 1);
      }, 60);
    }
  }

  function cancelFlight(): void {
    flight?.cancel();
    flight = null;
  }

  function viewportSize(): { vw: number; vh: number } {
    return { vw: viewport.clientWidth, vh: viewport.clientHeight };
  }

  /** Transform that centers `bounds` at a readable fit scale. */
  function fitTransform(bounds: WorldBounds): CameraTransform | null {
    const { vw, vh } = viewportSize();
    if (vw === 0 || vh === 0) return null; // jsdom / hidden panel
    const bw = Math.max(1, bounds.maxX - bounds.minX);
    const bh = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.min(MAX_FIT_SCALE, Math.max(MIN_FIT_SCALE, Math.min(vw / bw, vh / bh)));
    return {
      scale,
      x: (vw - bw * scale) / 2 - bounds.minX * scale,
      y: (vh - bh * scale) / 2 - bounds.minY * scale,
    };
  }

  /** Scale the world so the used room area is centered and readable. */
  function fitToViewport(force = false): void {
    if (!pz || (fittedOnce && !force) || !lastBounds) return;
    const target = fitTransform(lastBounds);
    if (!target) return;
    programmatic(() => applyTransform(target));
    fittedOnce = true;
  }

  function focusRoomOutline(roomId: string | null): void {
    focusedRoomId = roomId;
    for (const room of Array.from(world.querySelectorAll<HTMLElement>('.room'))) {
      room.classList.toggle('room-focused', room.dataset.roomId === roomId);
    }
  }

  // ---------------------------------------------------------------- render

  function render(): void {
    clear(world);
    lastLayouts = [];
    lastBounds = null;
    if (!project) {
      const empty = el('div', 'canvas-empty');
      const title = el('p', 'canvas-empty-title', 'No project selected');
      const hint = el(
        'p',
        'muted',
        'Pick a project from the rail above, or create one with “New Project”. The office floor plan appears here.',
      );
      empty.append(title, hint);
      world.append(empty);
      return;
    }

    const rooms = roomsOverride ?? deriveRooms(project);
    const layouts = layoutRooms(rooms);
    lastLayouts = layouts;
    lastBounds = usedBounds(layouts);
    const edges = layoutEdges(project, layouts);

    // Edge layer: dependency lines between desk centers (below the rooms).
    const svg = svgEl('svg', {
      class: 'canvas-edges',
      viewBox: `0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`,
      width: String(WORLD_WIDTH),
      height: String(WORLD_HEIGHT),
      'aria-hidden': 'true',
    });
    const defs = svgEl('defs', {});
    const marker = svgEl('marker', {
      id: 'edge-arrow',
      viewBox: '0 0 10 10',
      refX: '9',
      refY: '5',
      markerWidth: '7',
      markerHeight: '7',
      orient: 'auto-start-reverse',
    });
    marker.append(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'edge-arrow-head' }));
    defs.append(marker);
    svg.append(defs);
    for (const edge of edges) {
      svg.append(
        svgEl('line', {
          x1: String(edge.x1),
          y1: String(edge.y1),
          x2: String(edge.x2),
          y2: String(edge.y2),
          class: 'edge-line',
          'marker-end': 'url(#edge-arrow)',
        }),
      );
    }
    world.append(svg);

    for (const layout of layouts) {
      const room = el('section', 'room');
      room.style.left = `${layout.x}px`;
      room.style.top = `${layout.y}px`;
      room.style.width = `${layout.w}px`;
      room.style.height = `${layout.h}px`;
      room.dataset.roomId = layout.room.id;
      if (layout.room.id === focusedRoomId) room.classList.add('room-focused');

      const header = el('header', 'room-header');
      const name = el('span', 'room-name', layout.room.label);
      const count = el(
        'span',
        'room-count',
        `${layout.room.nodeIds.length} desk${layout.room.nodeIds.length === 1 ? '' : 's'}`,
      );
      header.append(name, count);
      room.append(header);

      for (const desk of layout.desks) {
        const node = project.nodes.find((n) => n.id === desk.nodeId);
        if (!node) continue;
        const status: NodeStatus = deskStatusFor(node.id, run).status;
        const deskBtn = el('button', `desk status-${status}`);
        deskBtn.type = 'button';
        deskBtn.style.left = `${desk.x - layout.x}px`;
        deskBtn.style.top = `${desk.y - layout.y}px`;
        deskBtn.style.width = `${desk.w}px`;
        deskBtn.style.height = `${desk.h}px`;
        deskBtn.dataset.nodeId = node.id;
        deskBtn.setAttribute(
          'aria-label',
          `${node.title}, ${node.role}, status ${status}. Activate to inspect.`,
        );
        if (node.id === selectedNodeId) deskBtn.classList.add('selected');

        const dot = el('span', `desk-dot status-${status}`);
        dot.setAttribute('aria-hidden', 'true');
        const title = el('span', 'desk-title', node.title);
        const meta = el('span', 'desk-meta', `${node.role} · ${status}`);
        deskBtn.append(dot, title, meta);
        deskBtn.addEventListener('click', () => onSelectNode(node.id));
        room.append(deskBtn);
      }
      world.append(room);
    }
  }

  // ---------------------------------------------------------------- camera

  function viewportCenter(): { cx: number; cy: number } {
    const { vw, vh } = viewportSize();
    return { cx: vw / 2, cy: vh / 2 };
  }

  function zoomBy(factor: number): void {
    if (!pz) return;
    manualNav = true;
    const { cx, cy } = viewportCenter();
    if (isMotionReduced() || !pz.smoothZoom) {
      const scale = currentTransform().scale * factor;
      programmatic(() => pz?.zoomAbs?.(cx, cy, scale));
    } else {
      programmatic(() => pz?.smoothZoom?.(cx, cy, factor));
    }
  }

  function focusRoomBounds(roomId: string | null, bounds: WorldBounds | null): void {
    if (!bounds || !pz) return;
    cancelFlight();
    const { vw, vh } = viewportSize();
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    const scale = Math.min(1.25, Math.max(0.35, Math.min(vw / (bw + 160), vh / (bh + 160))));
    const target: CameraTransform = {
      scale,
      x: (vw - bw * scale) / 2 - bounds.minX * scale,
      y: (vh - bh * scale) / 2 - bounds.minY * scale,
    };
    manualNav = true;
    if (isMotionReduced() || vw === 0 || vh === 0) {
      // Reduced motion: jump instantly, outline the room as the feedback.
      programmatic(() => applyTransform(target));
      if (roomId) focusRoomOutline(roomId);
      return;
    }
    const from = currentTransform();
    programmatic(() => {
      flight = animate(MOTION_TOKENS.emphasis, (t) => {
        applyTransform({
          x: from.x + (target.x - from.x) * t,
          y: from.y + (target.y - from.y) * t,
          scale: from.scale + (target.scale - from.scale) * t,
        });
      });
    });
    if (roomId) focusRoomOutline(roomId);
  }

  return {
    update(nextProject: Project | null, nextRun: ProjectRun | null, rooms?: Room[]): void {
      project = nextProject;
      run = nextRun;
      roomsOverride = rooms ?? null;
      ensurePanzoom();
      render();
      fitToViewport();
    },
    setSelected(nodeId: string | null): void {
      selectedNodeId = nodeId;
      for (const desk of Array.from(world.querySelectorAll<HTMLElement>('.desk'))) {
        desk.classList.toggle('selected', desk.dataset.nodeId === nodeId);
      }
    },
    focusNode(nodeId: string): void {
      const layout = lastLayouts.find((l) => l.room.nodeIds.includes(nodeId));
      if (!layout) return;
      focusRoomBounds(layout.room.id, {
        minX: layout.x,
        minY: layout.y,
        maxX: layout.x + layout.w,
        maxY: layout.y + layout.h,
      });
    },
    zoomIn(): void {
      zoomBy(ZOOM_STEP);
    },
    zoomOut(): void {
      zoomBy(1 / ZOOM_STEP);
    },
    panBy(dx: number, dy: number): void {
      if (!pz) return;
      manualNav = true;
      cancelFlight();
      programmatic(() => {
        if (pz?.moveBy) pz.moveBy(dx, dy, false);
        else if (pz?.moveTo) {
          const t = currentTransform();
          pz.moveTo(t.x + dx, t.y + dy);
        }
      });
    },
    notifyResize(): void {
      // Refit on resize only before the user has navigated manually.
      if (manualNav) return;
      fittedOnce = false;
      fitToViewport();
    },
    resetView(): void {
      // Reset always recovers: clears manual navigation and refits.
      manualNav = false;
      fittedOnce = false;
      cancelFlight();
      if (!lastBounds && pz) {
        programmatic(() => applyTransform({ x: 0, y: 0, scale: 1 }));
        return;
      }
      fitToViewport(true);
    },
    dispose(): void {
      cancelFlight();
      pz?.dispose();
      pz = null;
    },
  };
}
