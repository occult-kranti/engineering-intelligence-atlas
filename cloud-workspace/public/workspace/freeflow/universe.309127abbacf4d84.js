// Live native blueprint compositor. One persistent company layout, independent of focus.
// Reuses buildScene unchanged; presentation-only geometry, no mutations or authority.
import { buildScene } from './model.0662349412329ff5.js';
import { cmp, unionBounds } from './layout.a2beae2ddc99ac8a.js';
import { MAX_COORD } from './camera.457a3ca4fd1e3c65.js';
import { projectStickyNotes } from '../improvement/notes.d28913ba9f0342d1.js';
const FOCUS_PAD = 40;
const BLUEPRINT_PREFIX = 'universe:blueprint:';
const TABLE_PLAN_PREFIX = 'universe:table-plan:';
export const COMPANY_FOOTPRINT_WIDTH = 1120;
export const COMPANY_FOOTPRINT_HEIGHT = 760;
export const FULL_COMPANY_PLAN_LIMIT = 24;
const COLUMN_PITCH = COMPANY_FOOTPRINT_WIDTH + 192;
const ROW_PITCH = COMPANY_FOOTPRINT_HEIGHT + 120;
const COLUMNS_PER_BAND = Math.floor((MAX_COORD - COMPANY_FOOTPRINT_WIDTH) / COLUMN_PITCH) + 1;
const ROW_PAIRS = Math.floor((Math.floor((MAX_COORD - COMPANY_FOOTPRINT_HEIGHT) / ROW_PITCH) + 1) / 2);
/** Finite camera-domain capacity, not a claim of unbounded in-memory projection. */
export const MAX_COMPANY_FOOTPRINTS = COLUMNS_PER_BAND * ROW_PAIRS * 2;
const CONTENT_INSET = { left: 32, right: 32, top: 92, bottom: 76 };
export const TABLE_PREVIEW_OFFICES = 2;
export const TABLE_PREVIEW_ROOMS = 32;
function finite(value, fallback = 0) { return Number.isFinite(value) ? value : fallback; }
function clamp(value, low, high) { return Math.min(high, Math.max(low, value)); }
function validRoomGeometry(room) {
    return Boolean(room && typeof room.id === 'string' && room.id.length > 0
        && [room.x, room.y, room.width, room.height].every(Number.isFinite)
        && room.width > 0 && room.height > 0 && Math.abs(room.x) <= MAX_COORD && Math.abs(room.y) <= MAX_COORD
        && room.x + room.width <= MAX_COORD && room.y + room.height <= MAX_COORD);
}
function safeRect(r) {
    const x = clamp(finite(r.x), -MAX_COORD, MAX_COORD - 1);
    const y = clamp(finite(r.y), -MAX_COORD, MAX_COORD - 1);
    return { x, y, width: clamp(finite(r.width, 1), 1, MAX_COORD - x), height: clamp(finite(r.height, 1), 1, MAX_COORD - y) };
}
function shiftRect(r, dx, dy) {
    const base = safeRect(r);
    return safeRect({ ...base, x: base.x + clamp(finite(dx), -MAX_COORD * 2, MAX_COORD * 2), y: base.y + clamp(finite(dy), -MAX_COORD * 2, MAX_COORD * 2) });
}
/**
 * Pure geometry shift of a scene. Returns a new scene; the input is never mutated.
 * Node metadata/counts and thread fields are cloned shallowly (arrays copied) so callers cannot alias input state.
 */
export function shiftSceneGeometry(scene, dx, dy, options = {}) {
    const p = options.idPrefix ?? '';
    const mapId = (id) => p + id;
    const nodes = scene.nodes.map((n) => {
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
        breadcrumbs: scene.breadcrumbs.map((b) => ({ label: b.label, focus: { ...b.focus } })),
        focus: { ...scene.focus },
    };
}
/** Two rows per band, wrapping before the finite camera boundary; never clamp
 * distinct company slots onto each other. The normal two-row portfolio is unchanged. */
export function companyFootprintAt(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= MAX_COMPANY_FOOTPRINTS) {
        throw new RangeError('Company footprint index exceeds the supported camera domain.');
    }
    const pair = Math.floor(index / 2);
    return { x: pair % COLUMNS_PER_BAND * COLUMN_PITCH,
        y: (Math.floor(pair / COLUMNS_PER_BAND) * 2 + index % 2) * ROW_PITCH,
        width: COMPANY_FOOTPRINT_WIDTH, height: COMPANY_FOOTPRINT_HEIGHT };
}
function readableWindow(plan) {
    const r = plan?.rect ?? { x: 0, y: 0, width: COMPANY_FOOTPRINT_WIDTH, height: COMPANY_FOOTPRINT_HEIGHT };
    return safeRect({ x: r.x - FOCUS_PAD, y: r.y - 20, width: r.width + FOCUS_PAD * 2, height: r.height + 40 });
}
/** Valid native state has unique identities; a malformed projection must still not
 * create duplicate DOM identities or unresolvable thread endpoints. */
function uniqueScene(scene) {
    const ids = new Set();
    const nodes = scene.nodes.filter(node => {
        if (ids.has(node.id))
            return false;
        ids.add(node.id);
        return true;
    });
    const threadIds = new Set();
    const threads = scene.threads.filter(thread => {
        if (threadIds.has(thread.id) || !ids.has(thread.fromId) || !ids.has(thread.toId))
            return false;
        threadIds.add(thread.id);
        return true;
    });
    return { ...scene, nodes, threads,
        warnings: nodes.length === scene.nodes.length ? scene.warnings : [...scene.warnings, 'Duplicate scene identities were omitted.'] };
}
function isSelected(focus) {
    return focus.kind !== 'portfolio';
}
/** Stable footprint and native company marker; bounded previews remain useful at any LOD. */
function companyPlans(scene, snapshot) {
    const seats = scene.nodes.filter(node => node.kind === 'folio');
    const slots = new Map(seats.map((seat, index) => [seat.companyId, companyFootprintAt(index)]));
    const nodes = seats.map((node, index) => {
        const slot = slots.get(node.companyId);
        return { ...node, parentId: TABLE_PLAN_PREFIX + node.companyId,
            rect: { x: slot.x + 32, y: slot.y + 16, width: 48, height: 48 },
            metadata: { ...node.metadata, seat: false, companyMarker: true, companyIndex: index,
                parentCompanyId: node.parentId?.startsWith('folio:') ? node.parentId.slice(6) : null } };
    });
    const companies = new Set(nodes.filter(node => node.kind === 'folio').map(node => node.companyId));
    const offices = new Map();
    for (const office of snapshot.offices ?? []) {
        if (!companies.has(office.companyId))
            continue;
        const companyOffices = offices.get(office.companyId) ?? new Map();
        if (!companyOffices.has(office.id))
            companyOffices.set(office.id, office);
        offices.set(office.companyId, companyOffices);
    }
    const blueprints = new Map();
    for (const blueprint of snapshot.blueprints ?? []) {
        if (!offices.get(blueprint.companyId)?.has(blueprint.officeId))
            continue;
        const plans = blueprints.get(blueprint.companyId) ?? new Map();
        // Same first-record rule as the full company projection.
        if (!plans.has(blueprint.officeId))
            plans.set(blueprint.officeId, blueprint);
        blueprints.set(blueprint.companyId, plans);
    }
    const previews = [];
    for (const seat of nodes.filter(node => node.kind === 'folio')) {
        const plans = [...(blueprints.get(seat.companyId)?.values() ?? [])].sort((a, b) => cmp(a.officeId, b.officeId));
        const preview = { officeCount: plans.length, roomCount: 0, invalidRoomCount: 0, offices: [] };
        let remaining = TABLE_PREVIEW_ROOMS;
        for (const [index, plan] of plans.entries()) {
            const rooms = Array.isArray(plan.rooms) ? plan.rooms : [];
            preview.roomCount += rooms.length;
            const chosen = [];
            const limit = index < TABLE_PREVIEW_OFFICES ? Math.ceil(remaining / (Math.min(TABLE_PREVIEW_OFFICES, plans.length) - index)) : 0;
            let normalized = rooms.length > 0;
            for (const room of rooms) {
                const valid = validRoomGeometry(room);
                if (!valid) {
                    preview.invalidRoomCount++;
                    normalized = false;
                    continue;
                }
                normalized &&= room.x >= 0 && room.y >= 0 && room.width <= 1.5 && room.height <= 1.5 && room.x + room.width <= 1.5 && room.y + room.height <= 1.5;
                if (!limit || chosen.some(item => item.id === room.id))
                    continue;
                const candidate = { id: room.id, label: room.name, rect: { x: room.x, y: room.y, width: room.width, height: room.height } };
                if (chosen.length < limit || cmp(candidate.id, chosen[chosen.length - 1].id) < 0) {
                    chosen.push(candidate);
                    chosen.sort((a, b) => cmp(a.id, b.id));
                    if (chosen.length > limit)
                        chosen.pop();
                }
            }
            if (index >= TABLE_PREVIEW_OFFICES)
                continue;
            // Match the full office sheet's saved normalized room scale; omit its common origin.
            if (normalized)
                for (const room of chosen) {
                    room.rect.x *= 860;
                    room.rect.width *= 860;
                    room.rect.y *= 440;
                    room.rect.height *= 440;
                }
            preview.offices.push({ officeId: plan.officeId, label: offices.get(seat.companyId).get(plan.officeId).name, blueprintId: plan.id, rooms: chosen });
            remaining -= chosen.length;
        }
        const shown = preview.offices.reduce((count, office) => count + office.rooms.length, 0);
        const summary = !plans.length ? 'No saved blueprint' : !preview.roomCount ? 'No saved rooms'
            : `Showing ${shown} of ${preview.roomCount} rooms · ${preview.offices.length} of ${preview.officeCount} offices${preview.invalidRoomCount ? ` · ${preview.invalidRoomCount} invalid omitted` : ''}`;
        previews.push({ id: TABLE_PLAN_PREFIX + seat.companyId, kind: 'reference', entityId: seat.companyId, companyId: seat.companyId, parentId: null,
            label: seat.label, subtitle: summary, status: plans.length ? 'saved' : 'unplanned',
            rect: { ...slots.get(seat.companyId) },
            metadata: { portal: true, tableBlueprint: true, companyFootprint: true, blueprintDetail: 'proxy', blueprintScale: 0 },
            counts: {}, blueprintPreview: preview });
    }
    const all = [...nodes, ...previews];
    return { ...scene, tableBounds: undefined, nodes: all, bounds: safeRect(unionBounds(previews.map(node => node.rect), 40)),
        counts: { ...scene.counts, tablePlans: previews.length, companyFootprints: previews.length } };
}
/** Fit the existing native projection inside its stable footprint. No room is invented. */
function fitCompany(source, plan, companyIds) {
    const portals = new Map(source.nodes.filter(node => node.metadata.portal === true).map(node => [node.id, node.companyId]));
    const local = source.nodes.filter(node => node.metadata.portal !== true && node.companyId === plan.companyId
        && !(node.kind === 'fallback' && node.metadata.companyLevel === true && !node.counts.employees && !node.counts.globalAssistants));
    const bounds = safeRect(unionBounds(local.map(node => safeRect(node.rect)), 0));
    const content = { x: plan.rect.x + CONTENT_INSET.left, y: plan.rect.y + CONTENT_INSET.top,
        width: plan.rect.width - CONTENT_INSET.left - CONTENT_INSET.right,
        height: plan.rect.height - CONTENT_INSET.top - CONTENT_INSET.bottom };
    const scale = Math.min(1, content.width / bounds.width, content.height / bounds.height);
    const origin = { x: content.x + (content.width - bounds.width * scale) / 2 - bounds.x * scale,
        y: content.y - bounds.y * scale };
    const localIds = new Set(local.map(node => node.id));
    const endpoint = (id) => localIds.has(id) ? BLUEPRINT_PREFIX + id
        : portals.has(id) && companyIds.has(portals.get(id)) ? 'folio:' + portals.get(id) : null;
    const nodes = local.map(node => {
        const r = safeRect(node.rect);
        const width = Math.min(content.width, Math.max(0.001, r.width * scale));
        const height = Math.min(content.height, Math.max(0.001, r.height * scale));
        return { ...node, id: BLUEPRINT_PREFIX + node.id,
            parentId: node.parentId && localIds.has(node.parentId) ? BLUEPRINT_PREFIX + node.parentId : plan.id,
            rect: { x: clamp(origin.x + r.x * scale, content.x, content.x + content.width - width),
                y: clamp(origin.y + r.y * scale, content.y, content.y + content.height - height), width, height },
            metadata: { ...Object.fromEntries(Object.entries(node.metadata).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])),
                companyFootprintId: plan.id, blueprintScale: scale }, counts: { ...node.counts } };
    });
    const threads = source.threads.flatMap(thread => {
        const fromId = endpoint(thread.fromId), toId = endpoint(thread.toId);
        return fromId && toId && fromId !== toId ? [{ ...thread, id: BLUEPRINT_PREFIX + plan.companyId + ':' + thread.id, fromId, toId }] : [];
    });
    plan.metadata = { ...plan.metadata, blueprintDetail: 'full', blueprintScale: scale, blueprintOriginX: origin.x, blueprintOriginY: origin.y };
    plan.counts = { ...source.counts };
    return { ...source, tableBounds: undefined, nodes, threads, bounds: safeRect(unionBounds(nodes.map(node => node.rect), 0)) };
}
export function buildUniverse(snapshot, focus, options = {}) {
    // A sanitized member projection must never be expanded into an owner portfolio.
    if (snapshot.access?.mode === 'member') {
        const scene = buildScene(snapshot, focus);
        return { ...scene, title: focus.kind === 'portfolio' ? 'Blueprint world' : scene.title,
            breadcrumbs: scene.breadcrumbs.map(crumb => ({ label: crumb.focus.kind === 'portfolio' ? 'Blueprint world' : crumb.label, focus: { ...crumb.focus } })),
            tableBounds: undefined, focusBounds: scene.bounds, worldMode: 'blueprint' };
    }
    const portfolio = companyPlans(uniqueScene(shiftSceneGeometry(buildScene(snapshot, { kind: 'portfolio' }), 0, 0)), snapshot);
    // Invalid saved geometry remains in native state and preview coverage counts,
    // but must not become a fabricated one-pixel room in the visual projection.
    const projection = { ...snapshot, blueprints: snapshot.blueprints?.map(plan => ({ ...plan,
            rooms: plan.rooms.filter(validRoomGeometry) })) };
    const plans = portfolio.nodes.filter(node => node.metadata.companyFootprint === true);
    const byCompany = new Map(plans.map(plan => [plan.companyId, plan]));
    const selectedPlan = isSelected(focus) ? byCompany.get(focus.companyId) : undefined;
    const first = selectedPlan ?? plans[0];
    const hint = options.detailCenter;
    const center = hint && Number.isFinite(hint.x) && Number.isFinite(hint.y)
        ? { x: clamp(hint.x, -MAX_COORD, MAX_COORD), y: clamp(hint.y, -MAX_COORD, MAX_COORD) }
        : { x: (first?.rect.x ?? 0) + (first?.rect.width ?? COMPANY_FOOTPRINT_WIDTH) / 2,
            y: (first?.rect.y ?? 0) + (first?.rect.height ?? COMPANY_FOOTPRINT_HEIGHT) / 2 };
    const distance = (plan) => Math.hypot(plan.rect.x + plan.rect.width / 2 - center.x, plan.rect.y + plan.rect.height / 2 - center.y);
    const detailed = [...plans].sort((a, b) => Number(b === selectedPlan) - Number(a === selectedPlan) || distance(a) - distance(b) || cmp(a.id, b.id)).slice(0, FULL_COMPANY_PLAN_LIMIT);
    const companyIds = new Set(byCompany.keys());
    const scenes = new Map();
    for (const plan of detailed) {
        const source = uniqueScene(buildScene(projection, { kind: 'company', companyId: plan.companyId }));
        scenes.set(plan.companyId, fitCompany(source, plan, companyIds));
    }
    const nodes = [...portfolio.nodes, ...plans.flatMap(plan => scenes.get(plan.companyId)?.nodes ?? [])];
    const stickies = projectStickyNotes(snapshot.stickyNotes, nodes);
    nodes.push(...stickies.nodes);
    const nodeIds = new Set(nodes.map(node => node.id));
    const threadIds = new Set();
    const threads = [...portfolio.threads, ...plans.flatMap(plan => scenes.get(plan.companyId)?.threads ?? [])]
        .filter(thread => {
        if (threadIds.has(thread.id) || !nodeIds.has(thread.fromId) || !nodeIds.has(thread.toId))
            return false;
        threadIds.add(thread.id);
        return true;
    }).sort((a, b) => cmp(a.id, b.id));
    const scoped = isSelected(focus) ? buildScene(projection, focus) : portfolio;
    const selected = selectedPlan && scenes.get(selectedPlan.companyId);
    let focusBounds = selectedPlan ? { ...selectedPlan.rect } : readableWindow(plans[0]);
    if (selected && focus.kind !== 'company' && focus.kind !== 'portfolio') {
        const ids = new Set(scoped.nodes.filter(node => node.metadata.portal !== true && (focus.kind !== 'department' || node.kind !== 'office')).map(node => BLUEPRINT_PREFIX + node.id));
        const targets = selected.nodes.filter(node => ids.has(node.id));
        if (targets.length)
            focusBounds = safeRect(unionBounds(targets.map(node => node.rect), 20));
    }
    const warnings = [...portfolio.warnings, ...[...scenes.values()].flatMap(scene => scene.warnings), ...scoped.warnings]
        .filter(warning => warning !== 'Scoped view: company leadership, other offices and the shared global assistant are outside this scope.');
    if (stickies.omitted)
        warnings.push(`${stickies.omitted} notes are outside the bounded spatial preview; use Notes & improvement to inspect saved records.`);
    return { ...portfolio, worldMode: 'blueprint', focus: { ...focus }, title: focus.kind === 'portfolio' ? 'Blueprint world' : scoped.title,
        breadcrumbs: scoped.breadcrumbs.map(crumb => ({ label: crumb.focus.kind === 'portfolio' ? 'Blueprint world' : crumb.label, focus: { ...crumb.focus } })),
        tableBounds: undefined, nodes, threads, bounds: safeRect(unionBounds(plans.map(plan => plan.rect), 40)), focusBounds,
        counts: { ...portfolio.counts, fullCompanyPlans: detailed.length, proxyCompanyPlans: plans.length - detailed.length,
            ...(selected ? Object.fromEntries(Object.entries(selected.counts).map(([key, value]) => ['blueprint.' + key, value])) : {}) },
        warnings: [...new Set(warnings)] };
}
