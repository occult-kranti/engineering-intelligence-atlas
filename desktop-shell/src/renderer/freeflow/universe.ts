// Sonnet-authored Freeflow universe compositor, independently reviewed for scope continuity,
// finite geometry and member isolation. Reuses buildScene unchanged; no state mutations or tool calls.
import { buildScene, type FreeflowFocus, type FreeflowScene, type FreeflowSnapshot, type SceneNode, type SceneBlueprintPreview } from './model.js';
import { cmp, unionBounds, type LRect } from './layout.js';
import { MAX_COORD } from './camera.js';

const BLUEPRINT_GAP = 160; // vertical gap between table-side seats and the blueprint sheet
const READABLE_WIDTH = 1200; // a bounded opening; the complete table remains available by panning
const FOCUS_PAD = 40;
const BLUEPRINT_PREFIX = 'universe:blueprint:';
const TABLE_PLAN_PREFIX = 'universe:table-plan:';
const TABLE_DEPTH = 360;
export const TABLE_PREVIEW_OFFICES = 2;
export const TABLE_PREVIEW_ROOMS = 32;

export interface ShiftOptions {
  /** Prefix applied to every node id, node parentId, and thread endpoint/id. Empty string keeps ids. */
  idPrefix?: string;
}

function finite(value: number, fallback = 0): number { return Number.isFinite(value) ? value : fallback; }
function clamp(value: number, low: number, high: number): number { return Math.min(high, Math.max(low, value)); }
function safeRect(r: LRect): LRect {
  const x = clamp(finite(r.x), -MAX_COORD, MAX_COORD - 1);
  const y = clamp(finite(r.y), -MAX_COORD, MAX_COORD - 1);
  return { x, y, width: clamp(finite(r.width, 1), 1, MAX_COORD - x), height: clamp(finite(r.height, 1), 1, MAX_COORD - y) };
}
function shiftRect(r: LRect, dx: number, dy: number): LRect {
  const base = safeRect(r);
  return safeRect({ ...base, x: base.x + clamp(finite(dx), -MAX_COORD * 2, MAX_COORD * 2), y: base.y + clamp(finite(dy), -MAX_COORD * 2, MAX_COORD * 2) });
}

/**
 * Pure geometry shift of a scene. Returns a new scene; the input is never mutated.
 * Node metadata/counts and thread fields are cloned shallowly (arrays copied) so callers cannot alias input state.
 */
export function shiftSceneGeometry(scene: FreeflowScene, dx: number, dy: number, options: ShiftOptions = {}): FreeflowScene {
  const p = options.idPrefix ?? '';
  const mapId = (id: string): string => p + id;
  const nodes: SceneNode[] = scene.nodes.map((n) => {
    const metadata = Object.fromEntries(Object.entries(n.metadata).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]));
    return {
      ...n,
      id: mapId(n.id),
      parentId: n.parentId === null ? null : mapId(n.parentId),
      rect: shiftRect(n.rect, dx, dy),
      metadata,
      counts: { ...n.counts },
      ...(n.blueprintPreview ? { blueprintPreview: { ...n.blueprintPreview, offices: n.blueprintPreview.offices.map(office => ({ ...office, rooms: office.rooms.map(room => ({ ...room, rect: { ...room.rect } })) })) } } : {}),
    };
  });
  const threads = scene.threads.map((t) => ({ ...t, id: p ? mapId(t.id) : t.id, fromId: mapId(t.fromId), toId: mapId(t.toId) }));
  return {
    ...scene,
    tableBounds: scene.tableBounds ? shiftRect(scene.tableBounds, dx, dy) : undefined,
    // A corrupt source extent must not poison the translated union with Infinity/NaN.
    bounds: safeRect(unionBounds([shiftRect(scene.bounds, dx, dy), ...nodes.map(node => node.rect), ...(scene.tableBounds ? [shiftRect(scene.tableBounds, dx, dy)] : [])])),
    nodes,
    threads,
    counts: { ...scene.counts },
    warnings: [...scene.warnings],
    breadcrumbs: scene.breadcrumbs.map((b) => ({ label: b.label, focus: { ...b.focus } as FreeflowFocus })),
    focus: { ...scene.focus } as FreeflowFocus,
  };
}

function readableTableWindow(portfolio: FreeflowScene): LRect {
  const seats = portfolio.nodes.filter((n) => n.kind === 'folio');
  const table = portfolio.tableBounds;
  const all = seats.map((s) => s.rect);
  if (table) all.push(table);
  const full = unionBounds(all, FOCUS_PAD);
  if (full.width <= READABLE_WIDTH || !table) return full;
  // Huge portfolio: show central seats at a useful scale without moving their world coordinates.
  const half = READABLE_WIDTH / 2;
  const x = table.x + table.width / 2 - half;
  const rects: LRect[] = [table];
  for (const s of seats) {
    if (s.rect.x + s.rect.width > x && s.rect.x < x + READABLE_WIDTH) rects.push(s.rect);
  }
  const vb = unionBounds(rects, 0);
  return { x, y: vb.y - FOCUS_PAD, width: READABLE_WIDTH, height: vb.height + FOCUS_PAD * 2 };
}

/** Valid native state has unique identities; a malformed projection must still not
 * create duplicate DOM identities or unresolvable thread endpoints. */
function uniqueScene(scene: FreeflowScene): FreeflowScene {
  const ids = new Set<string>();
  const nodes = scene.nodes.filter(node => {
    if (ids.has(node.id)) return false;
    ids.add(node.id); return true;
  });
  const threadIds = new Set<string>();
  const threads = scene.threads.filter(thread => {
    if (threadIds.has(thread.id) || !ids.has(thread.fromId) || !ids.has(thread.toId)) return false;
    threadIds.add(thread.id); return true;
  });
  return { ...scene, nodes, threads,
    warnings: nodes.length === scene.nodes.length ? scene.warnings : [...scene.warnings, 'Duplicate scene identities were omitted.'] };
}

function isSelected(focus: FreeflowFocus): focus is Exclude<FreeflowFocus, { kind: 'portfolio' }> {
  return focus.kind !== 'portfolio';
}

/** Add one bounded, real blueprint preview per chair without building every full company scene. */
function tabletopPlans(scene: FreeflowScene, snapshot: FreeflowSnapshot): FreeflowScene {
  const oldTable = scene.tableBounds;
  if (!oldTable) return scene;
  const delta = Math.max(0, TABLE_DEPTH - oldTable.height);
  const table = { ...oldTable, y: oldTable.y - delta / 2, height: oldTable.height + delta };
  const nodes = scene.nodes.map(node => node.kind !== 'folio' ? node : { ...node, rect: { ...node.rect,
    y: node.rect.y + (node.metadata.seatSide === 'north' ? -delta / 2 : delta / 2) } });
  const companies = new Set(nodes.filter(node => node.kind === 'folio').map(node => node.companyId));
  const offices = new Map<string, Map<string, NonNullable<FreeflowSnapshot['offices']>[number]>>();
  for (const office of snapshot.offices ?? []) {
    if (!companies.has(office.companyId)) continue;
    const companyOffices = offices.get(office.companyId) ?? new Map();
    if (!companyOffices.has(office.id)) companyOffices.set(office.id, office);
    offices.set(office.companyId, companyOffices);
  }
  const blueprints = new Map<string, Map<string, NonNullable<FreeflowSnapshot['blueprints']>[number]>>();
  for (const blueprint of snapshot.blueprints ?? []) {
    if (!offices.get(blueprint.companyId)?.has(blueprint.officeId)) continue;
    const plans = blueprints.get(blueprint.companyId) ?? new Map();
    // Same first-record rule as the full company projection.
    if (!plans.has(blueprint.officeId)) plans.set(blueprint.officeId, blueprint);
    blueprints.set(blueprint.companyId, plans);
  }
  const previews: SceneNode[] = [];
  for (const seat of nodes.filter(node => node.kind === 'folio')) {
    const plans = [...(blueprints.get(seat.companyId)?.values() ?? [])].sort((a, b) => cmp(a.officeId, b.officeId));
    const preview: SceneBlueprintPreview = { officeCount: plans.length, roomCount: 0, invalidRoomCount: 0, offices: [] };
    let remaining = TABLE_PREVIEW_ROOMS;
    for (const [index, plan] of plans.entries()) {
      const rooms = Array.isArray(plan.rooms) ? plan.rooms : [];
      preview.roomCount += rooms.length;
      const chosen: Array<SceneBlueprintPreview['offices'][number]['rooms'][number]> = [];
      const limit = index < TABLE_PREVIEW_OFFICES ? Math.ceil(remaining / (Math.min(TABLE_PREVIEW_OFFICES, plans.length) - index)) : 0;
      let normalized = rooms.length > 0;
      for (const room of rooms) {
        const valid = room && typeof room.id === 'string' && room.id.length > 0
          && [room.x, room.y, room.width, room.height].every(Number.isFinite)
          && room.width > 0 && room.height > 0 && Math.abs(room.x) <= MAX_COORD && Math.abs(room.y) <= MAX_COORD
          && room.x + room.width <= MAX_COORD && room.y + room.height <= MAX_COORD;
        if (!valid) { preview.invalidRoomCount++; normalized = false; continue; }
        normalized &&= room.x >= 0 && room.y >= 0 && room.width <= 1.5 && room.height <= 1.5 && room.x + room.width <= 1.5 && room.y + room.height <= 1.5;
        if (!limit || chosen.some(item => item.id === room.id)) continue;
        const candidate = { id: room.id, label: room.name, rect: { x: room.x, y: room.y, width: room.width, height: room.height } };
        if (chosen.length < limit || cmp(candidate.id, chosen[chosen.length - 1]!.id) < 0) {
          chosen.push(candidate); chosen.sort((a, b) => cmp(a.id, b.id));
          if (chosen.length > limit) chosen.pop();
        }
      }
      if (index >= TABLE_PREVIEW_OFFICES) continue;
      // Match the full office sheet's saved normalized room scale; omit its common origin.
      if (normalized) for (const room of chosen) { room.rect.x *= 860; room.rect.width *= 860; room.rect.y *= 440; room.rect.height *= 440; }
      preview.offices.push({ officeId: plan.officeId, label: offices.get(seat.companyId)!.get(plan.officeId)!.name, blueprintId: plan.id, rooms: chosen });
      remaining -= chosen.length;
    }
    const shown = preview.offices.reduce((count, office) => count + office.rooms.length, 0);
    const summary = !plans.length ? 'No saved blueprint' : !preview.roomCount ? 'No saved rooms'
      : `Showing ${shown} of ${preview.roomCount} rooms · ${preview.offices.length} of ${preview.officeCount} offices${preview.invalidRoomCount ? ` · ${preview.invalidRoomCount} invalid omitted` : ''}`;
    const height = Math.min(150, table.height / 2 - 24), width = Math.min(236, seat.rect.width - 24);
    previews.push({ id: TABLE_PLAN_PREFIX + seat.companyId, kind: 'reference', entityId: seat.companyId, companyId: seat.companyId, parentId: seat.id,
      label: seat.label, subtitle: summary, status: plans.length ? 'saved' : 'unplanned',
      rect: { x: seat.rect.x + (seat.rect.width - width) / 2, y: table.y + (seat.metadata.seatSide === 'north' ? 12 : table.height / 2 + 12), width, height },
      metadata: { portal: true, tableBlueprint: true }, counts: {}, blueprintPreview: preview });
  }
  const all = [...nodes, ...previews];
  return { ...scene, tableBounds: table, nodes: all, bounds: safeRect(unionBounds([...all.map(node => node.rect), table], 20)),
    counts: { ...scene.counts, tablePlans: previews.length } };
}

export function buildUniverse(snapshot: FreeflowSnapshot, focus: FreeflowFocus): FreeflowScene & { focusBounds: LRect } {
  // Sanitized member projections never get a global view.
  if (snapshot.access?.mode === 'member') {
    const scene = buildScene(snapshot, focus);
    return { ...scene, focusBounds: scene.bounds };
  }

  const portfolio = tabletopPlans(uniqueScene(shiftSceneGeometry(buildScene(snapshot, { kind: 'portfolio' }), 0, 0)), snapshot);
  if (!isSelected(focus)) {
    return { ...portfolio, focus: { ...focus }, focusBounds: readableTableWindow(portfolio) };
  }

  const selected = buildScene(snapshot, focus);
  const seat = portfolio.nodes.find((n) => n.kind === 'folio' && n.companyId === focus.companyId);
  if (!seat) {
    // Unknown company: keep the existing missing-state result with warnings and safe geometry.
    const warnings = [...portfolio.warnings, ...selected.warnings];
    return { ...portfolio, focus: { ...focus }, title: selected.title, warnings, focusBounds: readableTableWindow(portfolio) };
  }

  // Scope changes move the camera, not the rooms. Always compose the complete
  // selected company's layout; the scoped scene supplies focus IDs/breadcrumbs.
  const blueprint = uniqueScene(shiftSceneGeometry(focus.kind === 'company' ? selected
    : buildScene(snapshot, { kind: 'company', companyId: focus.companyId }), 0, 0));

  // Deterministic anchor: sheet top-left centered under the selected seat, below the lowest portfolio geometry.
  const portfolioBox = unionBounds([...portfolio.nodes.map((n) => n.rect), ...(portfolio.tableBounds ? [portfolio.tableBounds] : [])], 0);
  const anchorX = seat.rect.x + seat.rect.width / 2;
  const anchorY = portfolioBox.y + portfolioBox.height + BLUEPRINT_GAP;
  const dx = anchorX - (blueprint.bounds.x + blueprint.bounds.width / 2);
  const dy = anchorY - blueprint.bounds.y;

  // Existing blueprint ids are namespaced so they cannot collide with portfolio ids.
  const shifted = shiftSceneGeometry(blueprint, dx, dy, { idPrefix: BLUEPRINT_PREFIX });

  // Portfolio ids already use folio:/thread: forms; ensure no duplicate survived the prefix.
  const seen = new Set(portfolio.nodes.map((n) => n.id));
  const bpNodes = shifted.nodes.filter((n) => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });
  const nodeIds = new Set([...seen, ...bpNodes.map((n) => n.id)]);
  const seenThreads = new Set(portfolio.threads.map((t) => t.id));
  const bpThreads = shifted.threads.filter((t) => {
    if (seenThreads.has(t.id) || !nodeIds.has(t.fromId) || !nodeIds.has(t.toId)) return false;
    seenThreads.add(t.id); return true;
  });

  const nodes = [...portfolio.nodes, ...bpNodes];
  const threads = [...portfolio.threads, ...bpThreads].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const blueprintBounds = shifted.bounds;
  const scopeIds = new Set(selected.nodes.map(node => BLUEPRINT_PREFIX + node.id));
  const focusNodes = focus.kind === 'company' ? [] : bpNodes.filter(node => scopeIds.has(node.id));
  // Containers stay in the world but do not force a department's camera to frame
  // an entire office when the department has visible rooms or staff.
  const detailNodes = focusNodes.filter(node => node.metadata.portal !== true && (focus.kind !== 'department' || node.kind !== 'office'));
  const focusBounds = detailNodes.length ? safeRect(unionBounds(detailNodes.map(node => node.rect), FOCUS_PAD)) : blueprintBounds;
  const rects = nodes.map((n) => n.rect);
  if (portfolio.tableBounds) rects.push(portfolio.tableBounds);
  rects.push(blueprintBounds);

  return {
    title: selected.title,
    breadcrumbs: selected.breadcrumbs.map((b) => ({ label: b.label, focus: { ...b.focus } as FreeflowFocus })),
    focus: { ...focus },
    tableBounds: portfolio.tableBounds,
    bounds: safeRect(unionBounds(rects, 20)),
    nodes,
    threads,
    counts: { ...portfolio.counts, ...Object.fromEntries(Object.entries(selected.counts).map(([k, v]) => [`blueprint.${k}`, v])) },
    warnings: [...new Set([...portfolio.warnings, ...blueprint.warnings, ...selected.warnings.filter(warning => warning !== 'Scoped view: company leadership, other offices and the shared global assistant are outside this scope.')])],
    focusBounds,
  };
}
