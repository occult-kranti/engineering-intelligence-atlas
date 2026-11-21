// Pure Freeflow scene model: portfolio -> company -> office/department blueprint.
// Structural readonly snapshot types mirror shared/office.ts; no runtime shared imports.
import { cmp, gridColumns, looksNormalized, packClusters, packGrid, unionBounds, type LRect } from './layout.js';
import { projectThread, sortThreads, type SceneThread } from './threads.js';

export type { SceneThread } from './threads.js';
export type { LRect } from './layout.js';

type RO<T> = { readonly [K in keyof T]: T[K] };
interface SCompany { id: string; name: string; status: string; repoUrl?: string | null; parentCompanyId?: string | null }
interface SOffice { id: string; companyId: string; name: string; status: string }
interface SDepartment { id: string; companyId: string; officeId: string; name: string; status: string }
interface SEmployee { id: string; companyId: string | null; officeId: string | null; departmentId: string | null; name: string; role: string; kind: string; status: string }
interface SJob { id: string; companyId: string; officeId?: string; departmentId?: string | null; employeeId: string; status: string; usage?: { costUsd: number; inputTokens: number; outputTokens: number }; costStatus?: string; serviceContractId?: string | null }
interface SRoom { id: string; name: string; departmentId: string | null; x: number; y: number; width: number; height: number }
interface SDesk { id: string; roomId: string; employeeId: string; x: number; y: number }
interface SBoard { id: string; roomId: string; ownerEmployeeId: string; title: string; goalIds?: string[]; jobIds?: string[]; roadmapItemIds?: string[]; x: number; y: number }
interface SBlueprint { id: string; companyId: string; officeId: string; rooms: SRoom[]; desks: SDesk[]; whiteboards: SBoard[] }
interface SGroup { id: string; name: string; companyIds: string[]; status?: string }
interface SService { id: string; key: string; name: string; companyId: string; officeId: string; departmentId: string; employeeIds: string[]; retiredEmployeeIds?: string[]; status: string }
interface SContract { id: string; serviceId: string; recipientCompanyId: string; recipientOfficeId: string | null; recipientDepartmentId: string | null; employeeIds: string[]; allowedTools: string[]; status: string }

export interface FreeflowSnapshot {
  readonly companies?: readonly RO<SCompany>[];
  readonly offices?: readonly RO<SOffice>[];
  readonly departments?: readonly RO<SDepartment>[];
  readonly employees?: readonly RO<SEmployee>[];
  readonly jobs?: readonly RO<SJob>[];
  readonly blueprints?: readonly RO<SBlueprint>[];
  readonly portfolio?: {
    readonly ceo?: { readonly sharedServicesCompanyId?: string | null };
    readonly groups?: readonly RO<SGroup>[];
    readonly services?: readonly RO<SService>[];
    readonly contracts?: readonly RO<SContract>[];
  };
}

export type FreeflowFocus =
  | { kind: 'portfolio' }
  | { kind: 'company'; companyId: string }
  | { kind: 'office'; companyId: string; officeId: string }
  | { kind: 'department'; companyId: string; officeId: string; departmentId: string };

export type SceneNodeKind = 'folio' | 'office' | 'department' | 'room' | 'employee' | 'whiteboard' | 'reference' | 'fallback';

export interface SceneNode {
  id: string;
  kind: SceneNodeKind;
  entityId: string;
  companyId: string;
  officeId?: string;
  departmentId?: string;
  employeeId?: string;
  roomId?: string;
  boardId?: string;
  contractId?: string;
  parentId: string | null;
  label: string;
  subtitle: string;
  status: string;
  rect: LRect;
  metadata: Record<string, string | number | boolean | string[] | null>;
  counts: Record<string, number>;
}

export interface FreeflowScene {
  /** Presentation-only conference table geometry (portfolio scope), computed from the same seat geometry. */
  tableBounds?: LRect;
  title: string;
  breadcrumbs: Array<{ label: string; focus: FreeflowFocus }>;
  focus: FreeflowFocus;
  bounds: LRect;
  nodes: SceneNode[];
  threads: SceneThread[];
  counts: Record<string, number>;
  warnings: string[];
}

type CompanyFocus = Exclude<FreeflowFocus, { kind: 'portfolio' }>;

const FOLIO_W = 360, FOLIO_H = 240, GAP = 60;
const SHEET_W = 900, SHEET_H = 640;
const SCALE_W = 860, SCALE_H = 440; // normalized room extents inside an office sheet
const ROOM_X0 = 20, ROOM_Y0 = 50;
const EMP_W = 120, EMP_H = 56, BOARD_W = 140, BOARD_H = 90;
const PAD = 6;

function byId<T extends { id: string }>(xs: readonly T[] | undefined): T[] {
  return [...(xs ?? [])].sort((a, b) => cmp(a.id, b.id));
}

function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? '?') + (w[1]?.[0] ?? '')).toUpperCase();
}

function fin(n: number): number { return Number.isFinite(n) ? n : 0; }
function clamp(v: number, lo: number, hi: number): number { return hi < lo ? lo : Math.min(hi, Math.max(lo, v)); }

function empty(focus: FreeflowFocus, title: string, warnings: string[]): FreeflowScene {
  return { title, breadcrumbs: [{ label: 'Portfolio', focus: { kind: 'portfolio' } }], focus, bounds: unionBounds([]), nodes: [], threads: [], counts: {}, warnings };
}

interface CompanyForest { parentOf: Map<string, string>; childrenOf: Map<string, string[]>; warnings: string[] }

/** Defensive, bounded projection of explicit parentCompanyId relationships. Never infers from groups/names. */
function projectForest(companies: readonly RO<SCompany>[]): CompanyForest {
  const warnings: string[] = [];
  const ids = new Set(companies.map((c) => c.id));
  const seen = new Set<string>();
  const raw = new Map<string, string>();
  for (const c of companies) {
    if (seen.has(c.id)) { warnings.push(`Duplicate company id ${c.id}; first record used.`); continue; }
    seen.add(c.id);
    const p = c.parentCompanyId;
    if (p === undefined || p === null || p === '') continue;
    if (p === c.id) { warnings.push(`Company ${c.id} names itself as parent; treated as root.`); continue; }
    if (!ids.has(p)) { warnings.push(`Company ${c.id} references missing parent ${p}; treated as root.`); continue; }
    raw.set(c.id, p);
  }
  const limit = ids.size + 1;
  const cyclic = new Set<string>();
  for (const start of [...raw.keys()].sort(cmp)) {
    let cur: string | undefined = start;
    const path = new Set<string>();
    let steps = 0;
    while (cur !== undefined && steps++ <= limit) {
      if (path.has(cur)) { for (const x of path) cyclic.add(x); break; }
      path.add(cur);
      cur = raw.get(cur);
    }
  }
  const parentOf = new Map<string, string>();
  for (const [k, v] of raw) {
    if (cyclic.has(k)) continue;
    parentOf.set(k, v);
  }
  for (const k of [...cyclic].sort(cmp)) warnings.push(`Company ${k} is part of a parent cycle; treated as root.`);
  const childrenOf = new Map<string, string[]>();
  for (const [k, v] of [...parentOf].sort((a, b) => cmp(a[0], b[0]))) childrenOf.set(v, [...(childrenOf.get(v) ?? []), k]);
  return { parentOf, childrenOf, warnings };
}

function ancestorsOf(forest: CompanyForest, id: string, bound: number): string[] {
  const out: string[] = [];
  let cur = forest.parentOf.get(id);
  let n = 0;
  while (cur !== undefined && n++ < bound && !out.includes(cur) && cur !== id) { out.push(cur); cur = forest.parentOf.get(cur); }
  return out.reverse();
}

const officeNodeId = (cid: string, oid: string) => `office:${cid}:${oid}`;
const roomNodeId = (cid: string, oid: string, rid: string) => `room:${cid}:${oid}:${rid}`;
const boardNodeId = (cid: string, oid: string, bid: string) => `board:${cid}:${oid}:${bid}`;
const leadershipId = (cid: string) => `fallback:${cid}:leadership`;
const globalId = (cid: string) => `reference:${cid}:global-assistant`;

function employeeNode(e: RO<SEmployee>, parentId: string, rect: LRect, companyId: string, jobs: readonly RO<SJob>[], extra: Partial<SceneNode> = {}): SceneNode {
  const own = jobs.filter((j) => j.employeeId === e.id && j.companyId === companyId);
  const running = own.filter((j) => j.status === 'running').length;
  return {
    id: `employee:${companyId}:${e.id}`, kind: 'employee', entityId: e.id, companyId,
    officeId: e.officeId ?? undefined, departmentId: e.departmentId ?? undefined, employeeId: e.id,
    parentId, label: e.name, subtitle: e.role, status: e.status, rect,
    metadata: { monogram: initials(e.name), employeeKind: e.kind, homeCompanyId: e.companyId },
    counts: { jobs: own.length, running, queued: own.filter((j) => j.status === 'queued').length },
    ...extra,
  };
}

export function buildScene(snapshot: FreeflowSnapshot, focus: FreeflowFocus): FreeflowScene {
  const warnings: string[] = [];
  const companies = byId(snapshot.companies);
  const jobs = byId(snapshot.jobs);
  if (focus.kind === 'portfolio') return portfolioScene(snapshot, companies, jobs, warnings);
  const company = companies.find((c) => c.id === focus.companyId);
  if (!company) return empty(focus, 'Missing company', [`Company ${focus.companyId} not found.`]);
  return companyScene(snapshot, company, focus, jobs, warnings);
}

function portfolioScene(snap: FreeflowSnapshot, companies: RO<SCompany>[], jobs: RO<SJob>[], warnings: string[]): FreeflowScene {
  const focus: FreeflowFocus = { kind: 'portfolio' };
  const known = new Set(companies.map((c) => c.id));
  const groups = byId(snap.portfolio?.groups);
  const groupOf = new Map<string, RO<SGroup>>();
  const memberships = new Map<string, string[]>();
  for (const g of groups) {
    for (const cid of [...g.companyIds].sort(cmp)) {
      if (!known.has(cid)) { warnings.push(`Group ${g.id} references missing company ${cid}.`); continue; }
      memberships.set(cid, [...(memberships.get(cid) ?? []), g.id]);
      if (!groupOf.has(cid)) groupOf.set(cid, g);
    }
  }
  const forest = projectForest(companies);
  for (const w of forest.warnings) warnings.push(w);
  const nameById = new Map(companies.map((c) => [c.id, c.name]));
  const shared = snap.portfolio?.ceo?.sharedServicesCompanyId ?? null;
  const nodes: SceneNode[] = [];
  // Deterministic seats around one table: one seat per visible company, sorted by id.
  const seatRects = seatLayout(companies.length);
  {
    companies.forEach((c, i) => {
      const k = groupOf.get(c.id)?.id ?? '~ungrouped';
      const emps = (snap.employees ?? []).filter((e) => e.companyId === c.id && e.status !== 'fired');
      const cj = jobs.filter((j) => j.companyId === c.id);
      const running = cj.filter((j) => j.status === 'running').length;
      const isShared = c.id === shared;
      const parentId = forest.parentOf.get(c.id) ?? null;
      const kids = forest.childrenOf.get(c.id) ?? [];
      nodes.push({
        id: `folio:${c.id}`, kind: 'folio', entityId: c.id, companyId: c.id, parentId: parentId ? `folio:${parentId}` : null,
        label: c.name, subtitle: [parentId ? `Subcompany of ${nameById.get(parentId) ?? parentId}` : '', isShared ? 'Shared services' : '', c.status === 'paused' ? 'Paused' : ''].filter(Boolean).join(' · '),
        status: c.status, rect: seatRects.seats[i]!.rect,
        metadata: { seat: true, seatSide: seatRects.seats[i]!.side, seatIndex: i, groupIds: memberships.get(c.id) ?? [], cluster: k === '~ungrouped' ? null : k, sharedServices: isShared, parentCompanyId: parentId, parentCompanyName: parentId ? (nameById.get(parentId) ?? parentId) : null, childCompanyIds: kids, childCompanyNames: kids.map((x) => nameById.get(x) ?? x) },
        counts: { employees: emps.length, jobs: cj.length, running, queued: cj.filter((j) => j.status === 'queued').length, offices: (snap.offices ?? []).filter((o) => o.companyId === c.id).length, subcompanies: kids.length },
      });
    });
  }
  const hierarchyThreads: SceneThread[] = [];
  for (const [childId, parentId] of forest.parentOf) {
    const t = projectThread({ kind: 'company-parent', fromId: `folio:${parentId}`, toId: `folio:${childId}`, label: 'Organizational parent → subcompany' });
    if (t) hierarchyThreads.push({ ...t, id: `thread:company-parent:${parentId}:${childId}`, contractId: null, homeCompanyId: null });
  }
  const threads = sortThreads([...portfolioContractThreads(snap, known), ...hierarchyThreads]);
  return {
    title: 'Conference table', breadcrumbs: [{ label: 'Portfolio', focus }], focus,
    tableBounds: seatRects.table,
    bounds: unionBounds([...nodes.map((n) => n.rect), seatRects.table], 120), nodes, threads,
    counts: { companies: companies.length, folios: nodes.length, threads: threads.length, runningJobs: jobs.filter((j) => j.status === 'running').length, hiredEmployees: (snap.employees ?? []).filter((e) => e.status !== 'fired').length },
    warnings,
  };
}

const SEAT_W = 260, SEAT_H = 150, SEAT_GAP = 36, TABLE_PAD = 70, TABLE_MIN_W = 520, TABLE_MIN_H = 220;
type SeatSide = 'north' | 'south' | 'east' | 'west';

/** Deterministic perimeter layout: seats alternate north/south along a table that lengthens with count; overflow beyond two long sides adds end seats. Table bounds derive from the same geometry. */
function seatLayout(count: number): { seats: Array<{ rect: LRect; side: SeatSide }>; table: LRect } {
  const n = Math.max(0, count);
  const perSide = Math.max(1, Math.ceil(n / 2));
  const span = perSide * SEAT_W + (perSide - 1) * SEAT_GAP;
  const tableW = Math.max(TABLE_MIN_W, span + TABLE_PAD * 2);
  const tableH = Math.max(TABLE_MIN_H, n > 2 * 24 ? 320 : TABLE_MIN_H);
  const table: LRect = { x: -tableW / 2, y: -tableH / 2, width: tableW, height: tableH };
  const seats: Array<{ rect: LRect; side: SeatSide }> = [];
  const startX = -span / 2;
  for (let i = 0; i < n; i++) {
    const col = Math.floor(i / 2);
    const north = i % 2 === 0;
    const x = startX + col * (SEAT_W + SEAT_GAP);
    const y = north ? table.y - SEAT_H - 24 : table.y + table.height + 24;
    seats.push({ rect: { x, y, width: SEAT_W, height: SEAT_H }, side: north ? 'north' : 'south' });
  }
  return { seats, table };
}

function portfolioContractThreads(snap: FreeflowSnapshot, known: Set<string>): SceneThread[] {
  const out: SceneThread[] = [];
  const services = new Map((snap.portfolio?.services ?? []).map((s) => [s.id, s]));
  for (const k of snap.portfolio?.contracts ?? []) {
    if (k.status !== 'active') continue;
    const s = services.get(k.serviceId);
    if (!s || s.status !== 'active' || !known.has(s.companyId) || !known.has(k.recipientCompanyId)) continue;
    const t = projectThread({ kind: 'service-contract', fromId: `folio:${s.companyId}`, toId: `folio:${k.recipientCompanyId}`, contractId: k.id, homeCompanyId: s.companyId, label: s.name });
    if (t) out.push({ ...t, id: `thread:contract:${k.id}` });
  }
  return out;
}

/** Fit a card of preferred size inside a room with padding, anchored at the room-relative normalized point. */
function placeInRoom(room: LRect, nx: number, ny: number, prefW: number, prefH: number): LRect {
  const w = Math.max(1, Math.min(prefW, room.width - PAD * 2));
  const h = Math.max(1, Math.min(prefH, room.height - PAD * 2));
  const ax = room.x + clamp(fin(nx), 0, 1) * room.width;
  const ay = room.y + clamp(fin(ny), 0, 1) * room.height;
  return {
    x: clamp(ax, room.x + PAD, room.x + room.width - w - PAD),
    y: clamp(ay, room.y + PAD, room.y + room.height - h - PAD),
    width: w, height: h,
  };
}

function mapRoom(r: SRoom, origin: { x: number; y: number }, norm: boolean): LRect {
  const sx = norm ? SCALE_W : 1, sy = norm ? SCALE_H : 1;
  return { x: origin.x + fin(r.x) * sx, y: origin.y + fin(r.y) * sy, width: Math.max(1, fin(r.width) * sx), height: Math.max(1, fin(r.height) * sy) };
}

function companyScene(snap: FreeflowSnapshot, company: RO<SCompany>, focus: CompanyFocus, jobs: RO<SJob>[], warnings: string[]): FreeflowScene {
  const cid = company.id;
  const isCompany = focus.kind === 'company';
  const focusOffice = focus.kind === 'company' ? null : focus.officeId;
  const wantDept = focus.kind === 'department' ? focus.departmentId : null;
  const offices = byId(snap.offices).filter((o) => o.companyId === cid && (isCompany || o.id === focusOffice));
  if (!isCompany && !offices.length) warnings.push(`Office ${focusOffice} not found in ${cid}.`);
  const allEmployees = byId(snap.employees);
  const empById = new Map(allEmployees.map((e) => [e.id, e]));
  const employees = allEmployees.filter((e) => e.companyId === cid && e.status !== 'fired');
  const depts = byId(snap.departments).filter((d) => d.companyId === cid);
  const deptIds = new Set(depts.map((d) => d.id));
  const services = new Map((snap.portfolio?.services ?? []).map((s) => [s.id, s]));
  const nodes: SceneNode[] = [];
  const nodeIds = new Set<string>();
  const push = (n: SceneNode) => { if (!nodeIds.has(n.id)) { nodeIds.add(n.id); nodes.push(n); } };
  const placedLocal = new Set<string>();
  const placedRef = new Set<string>(); // contract:employee keys already placed in a room
  const placedHost = new Set<string>(); // service:employee keys already placed as host-member references
  const allServices = byId(snap.portfolio?.services);
  const hostFor = (eid: string, officeId: string) => {
    for (const s of allServices) {
      if (s.companyId !== cid || s.officeId !== officeId) continue;
      const current = s.employeeIds.includes(eid);
      const retired = (s.retiredEmployeeIds ?? []).includes(eid);
      if (current || retired) return { s, current };
    }
    return null;
  };
  const sheets = packGrid(offices.length, SHEET_W, SHEET_H, GAP * 2, gridColumns(offices.length));

  // Active contracts that apply to this scene (recipient company/office/department).
  const contracts = [...(snap.portfolio?.contracts ?? [])]
    .sort((a, b) => cmp(a.id, b.id))
    .filter((k) => {
      if (k.status !== 'active' || k.recipientCompanyId !== cid) return false;
      const s = services.get(k.serviceId);
      if (!s || s.status !== 'active') return false;
      if (!isCompany) {
        if (k.recipientOfficeId && k.recipientOfficeId !== focusOffice) return false;
        if (wantDept && k.recipientDepartmentId && k.recipientDepartmentId !== wantDept) return false;
      }
      return true;
    });
  const contractFor = (eid: string, officeId: string, deptId: string | null) => {
    for (const k of contracts) {
      const s = services.get(k.serviceId)!;
      if (!k.employeeIds.includes(eid) || !s.employeeIds.includes(eid)) continue;
      if (k.recipientOfficeId && k.recipientOfficeId !== officeId) continue;
      if (k.recipientDepartmentId && k.recipientDepartmentId !== deptId) continue;
      return { k, s };
    }
    return null;
  };
  const refNode = (k: RO<SContract>, s: RO<SService>, e: RO<SEmployee>, parentId: string | null, rect: LRect, extra: Partial<SceneNode> = {}): SceneNode => ({
    id: `reference:${cid}:${k.id}:${e.id}`, kind: 'reference', entityId: e.id, companyId: cid,
    officeId: k.recipientOfficeId ?? undefined, departmentId: k.recipientDepartmentId ?? undefined,
    employeeId: e.id, contractId: k.id, parentId, label: e.name, subtitle: e.role, status: 'contracted', rect,
    metadata: { homeCompanyId: e.companyId, serviceCompanyId: s.companyId, allowedTools: [...k.allowedTools].sort(cmp), reference: true, monogram: initials(e.name) },
    counts: {},
    ...extra,
  });

  offices.forEach((o, oi) => {
    const sheet = sheets[oi]!;
    const oid = officeNodeId(cid, o.id);
    const oemps = employees.filter((e) => e.officeId === o.id);
    push({ id: oid, kind: 'office', entityId: o.id, companyId: cid, officeId: o.id, parentId: null, label: o.name, subtitle: o.status === 'paused' ? 'Paused' : 'Office sheet', status: o.status, rect: sheet, metadata: {}, counts: { employees: oemps.length, departments: depts.filter((d) => d.officeId === o.id).length, running: jobs.filter((j) => j.companyId === cid && j.officeId === o.id && j.status === 'running').length } });
    const bp = (snap.blueprints ?? []).find((b) => b.companyId === cid && b.officeId === o.id);
    if (bp) {
      const norm = looksNormalized(bp.rooms);
      const origin = { x: sheet.x + ROOM_X0, y: sheet.y + ROOM_Y0 };
      const rooms = [...bp.rooms].sort((a, b) => cmp(a.id, b.id)).filter((r) => !wantDept || r.departmentId === wantDept);
      const roomRect = new Map<string, LRect>();
      for (const r of rooms) {
        const rect = mapRoom(r, origin, norm);
        roomRect.set(r.id, rect);
        push({ id: roomNodeId(cid, o.id, r.id), kind: 'room', entityId: r.id, companyId: cid, officeId: o.id, departmentId: r.departmentId ?? undefined, roomId: r.id, parentId: oid, label: r.name, subtitle: 'Room', status: 'saved', rect, metadata: {}, counts: { desks: bp.desks.filter((d) => d.roomId === r.id).length, whiteboards: bp.whiteboards.filter((w) => w.roomId === r.id).length } });
      }
      for (const d of [...bp.desks].sort((a, b) => cmp(a.id, b.id))) {
        const room = roomRect.get(d.roomId);
        if (!room) continue;
        const e = empById.get(d.employeeId);
        if (!e) { warnings.push(`Desk ${d.id} references missing employee ${d.employeeId}.`); continue; }
        const rect = placeInRoom(room, d.x, d.y, EMP_W, EMP_H);
        const parent = roomNodeId(cid, o.id, d.roomId);
        const local = e.companyId === cid && e.status !== 'fired';
        if (local) {
          if (placedLocal.has(e.id)) continue;
          placedLocal.add(e.id);
          push(employeeNode(e, parent, rect, cid, jobs, { roomId: d.roomId, officeId: o.id, departmentId: e.departmentId ?? undefined }));
          continue;
        }
        const host = hostFor(e.id, o.id);
        if (host) {
          const hkey = `${host.s.id}:${e.id}`;
          if (placedHost.has(hkey)) continue;
          placedHost.add(hkey);
          const live = host.current && host.s.status === 'active' && e.status === 'active';
          push({
            id: `reference:${cid}:${o.id}:host:${host.s.id}:${e.id}`, kind: 'reference', entityId: e.id, companyId: cid,
            officeId: o.id, employeeId: e.id, roomId: d.roomId, parentId: parent, label: e.name, subtitle: e.role,
            status: live ? 'service-host' : 'service-host-historical', rect,
            metadata: { homeCompanyId: e.companyId, serviceCompanyId: host.s.companyId, serviceId: host.s.id, serviceHost: true, reference: true, layoutOnly: true, current: live, unavailable: !live, monogram: initials(e.name) },
            counts: {},
          });
          continue;
        }
        if (e.status !== 'active') { warnings.push(`Desk ${d.id} occupant ${e.id} is not active and has no local employment.`); continue; }
        const room0 = rooms.find((r) => r.id === d.roomId);
        const hit = contractFor(e.id, o.id, room0?.departmentId ?? null);
        if (!hit) { warnings.push(`Desk ${d.id} occupant ${e.id} has no active matching contract.`); continue; }
        const key = `${hit.k.id}:${e.id}`;
        if (placedRef.has(key)) continue;
        placedRef.add(key);
        push(refNode(hit.k, hit.s, e, parent, rect, { roomId: d.roomId, officeId: o.id }));
      }
      for (const w of [...bp.whiteboards].sort((a, b) => cmp(a.id, b.id))) {
        const room = roomRect.get(w.roomId);
        if (!room) continue;
        push({ id: boardNodeId(cid, o.id, w.id), kind: 'whiteboard', entityId: w.id, companyId: cid, officeId: o.id, roomId: w.roomId, boardId: w.id, employeeId: w.ownerEmployeeId, parentId: roomNodeId(cid, o.id, w.roomId), label: w.title, subtitle: 'Whiteboard', status: 'saved', rect: placeInRoom(room, w.x, w.y, BOARD_W, BOARD_H), metadata: {}, counts: { goals: w.goalIds?.length ?? 0, jobs: w.jobIds?.length ?? 0, roadmapItems: w.roadmapItemIds?.length ?? 0 } });
      }
    } else if (!isCompany) warnings.push(`No saved blueprint for office ${o.id}.`);

    // Unplaced departments and employees go to a marked fallback area at the sheet bottom.
    const fb: SceneNode[] = [];
    for (const d of depts.filter((d) => d.officeId === o.id && (!wantDept || d.id === wantDept))) {
      if (nodes.some((n) => n.kind === 'room' && n.officeId === o.id && n.departmentId === d.id)) continue;
      fb.push({ id: `fallback:${cid}:${o.id}:dept:${d.id}`, kind: 'fallback', entityId: d.id, companyId: cid, officeId: o.id, departmentId: d.id, parentId: oid, label: d.name, subtitle: 'Unplaced department', status: d.status, rect: sheet, metadata: { fallback: true }, counts: {} });
    }
    for (const e of oemps) {
      if (placedLocal.has(e.id)) continue;
      if (wantDept && e.departmentId !== wantDept) continue;
      if (e.departmentId && !deptIds.has(e.departmentId)) warnings.push(`Employee ${e.id} references missing department ${e.departmentId}.`);
      placedLocal.add(e.id);
      fb.push(employeeNode(e, oid, sheet, cid, jobs, { metadata: { monogram: initials(e.name), employeeKind: e.kind, homeCompanyId: e.companyId, fallback: true } }));
    }
    const cells = packGrid(fb.length, 130, EMP_H, 12, 6, sheet.x + 20, sheet.y + sheet.height - 140 + 20);
    fb.forEach((n, i) => { n.rect = cells[i]!; });
    fb.forEach(push);
  });

  // Company-level leadership/unplaced area and shared global assistant (company focus only).
  const sheetsBox = unionBounds(sheets, 0);
  const baseY = (offices.length ? sheetsBox.y + sheetsBox.height : 0) + 60;
  const baseX = offices.length ? sheetsBox.x : 0;
  let leadBottom = baseY;
  if (isCompany) {
    const leaders = employees.filter((e) => !e.officeId && !placedLocal.has(e.id));
    const hasGlobal = allEmployees.some((e) => e.companyId === null && e.kind === 'assistant' && e.status !== 'fired') || allEmployees.some((e) => e.companyId === null && e.status !== 'fired');
    const globals = allEmployees.filter((e) => e.companyId === null && e.status !== 'fired').slice(0, 1);
    const total = leaders.length + (hasGlobal ? globals.length : 0);
    const lid = leadershipId(cid);
    const cols = Math.max(2, Math.min(6, gridColumns(Math.max(1, total))));
    const cellsL = packGrid(total, 130, EMP_H, 12, cols, baseX + 20, baseY + 40);
    const rows = Math.max(1, Math.ceil(total / cols));
    const area: LRect = { x: baseX, y: baseY, width: Math.max(SHEET_W, cols * 142 + 28), height: 40 + rows * (EMP_H + 12) + 16 };
    leadBottom = area.y + area.height;
    push({ id: lid, kind: 'fallback', entityId: `${cid}:leadership`, companyId: cid, parentId: null, label: 'Company leadership & unplaced', subtitle: 'Company staff without an office, plus shared global assistant', status: 'saved', rect: area, metadata: { fallback: true, companyLevel: true }, counts: { employees: leaders.length, globalAssistants: globals.length } });
    let ci = 0;
    for (const e of leaders) {
      placedLocal.add(e.id);
      push(employeeNode(e, lid, cellsL[ci++]!, cid, jobs, { metadata: { monogram: initials(e.name), employeeKind: e.kind, homeCompanyId: e.companyId, fallback: true } }));
    }
    for (const g of globals) {
      push({ id: globalId(cid), kind: 'reference', entityId: g.id, companyId: cid, employeeId: g.id, parentId: lid, label: g.name, subtitle: 'Global assistant (shared identity)', status: 'shared', rect: cellsL[ci++]!, metadata: { homeCompanyId: null, globalAssistant: true, reference: true, monogram: initials(g.name) }, counts: {} });
    }
    if (!offices.length && !leaders.length && !globals.length) warnings.push(`Company ${cid} has no offices or staff.`);
  } else {
    warnings.push('Scoped view: company leadership, other offices and the shared global assistant are outside this scope.');
  }

  // Contract reference cells: only references not already placed in a room.
  const refPending: Array<{ k: RO<SContract>; s: RO<SService>; e: RO<SEmployee> }> = [];
  const refSeen = new Set<string>();
  for (const k of contracts) {
    const s = services.get(k.serviceId)!;
    for (const eid of [...k.employeeIds].sort(cmp)) {
      const e = empById.get(eid);
      if (!e) { warnings.push(`Contract ${k.id} covers missing employee ${eid}.`); continue; }
      if (e.status !== 'active' || !s.employeeIds.includes(eid)) continue;
      const key = `${k.id}:${eid}`;
      if (refSeen.has(key) || placedRef.has(key)) continue;
      refSeen.add(key);
      refPending.push({ k, s, e });
    }
  }
  const refTop = (isCompany ? leadBottom : baseY) + 60;
  const refCells = packGrid(refPending.length, 130, EMP_H, 12, 8, baseX + 20, refTop);
  refPending.forEach(({ k, s, e }, i) => {
    const parent = k.recipientOfficeId && offices.some((o) => o.id === k.recipientOfficeId) ? officeNodeId(cid, k.recipientOfficeId) : null;
    const n = refNode(k, s, e, parent, refCells[i]!);
    n.counts = { jobs: jobs.filter((j) => j.employeeId === e.id && j.companyId === cid && j.serviceContractId === k.id).length };
    push(n);
  });

  // Threads with real endpoints. Portal anchors carry identity/contract metadata only.
  const threads: SceneThread[] = [];
  const portals = new Map<string, SceneNode>();
  const portalCells: LRect[] = [];
  const portal = (companyId: string, role: 'service' | 'home', name: string): string => {
    const id = `portal:${cid}:${role}:${companyId}`;
    if (!portals.has(id)) {
      const idx = portals.size;
      const rect: LRect = { x: baseX - 240, y: baseY + idx * 76, width: 180, height: 56 };
      portalCells.push(rect);
      portals.set(id, { id, kind: 'reference', entityId: companyId, companyId, parentId: null, label: name, subtitle: role === 'service' ? 'Service company (portal)' : 'Home company (portal)', status: 'portal', rect, metadata: { portal: true, role, reference: true, homeCompanyId: companyId }, counts: {} });
    }
    return id;
  };
  const compName = (id: string) => (snap.companies ?? []).find((c) => c.id === id)?.name ?? id;
  const addThread = (t: SceneThread | null, id: string) => { if (t) threads.push({ ...t, id }); };
  for (const k of contracts) {
    const s = services.get(k.serviceId)!;
    const target = k.recipientOfficeId && offices.some((o) => o.id === k.recipientOfficeId) ? officeNodeId(cid, k.recipientOfficeId) : (offices.length ? officeNodeId(cid, offices[0]!.id) : null);
    if (target) addThread(projectThread({ kind: 'service-contract', fromId: portal(s.companyId, 'service', compName(s.companyId)), toId: target, contractId: k.id, homeCompanyId: s.companyId, label: s.name }), `thread:contract:${k.id}`);
  }
  for (const n of nodes) {
    if (n.kind !== 'reference' || !n.contractId) continue;
    const home = n.metadata['homeCompanyId'];
    const svc = n.metadata['serviceCompanyId'];
    if (typeof svc === 'string') addThread(projectThread({ kind: 'service-contract', fromId: portal(svc, 'service', compName(svc)), toId: n.id, contractId: n.contractId, homeCompanyId: typeof home === 'string' ? home : null, label: 'contracted staff' }), `thread:service:${n.contractId}:${n.employeeId}`);
    if (typeof home === 'string' && home !== cid) addThread(projectThread({ kind: 'shared-staff', fromId: portal(home, 'home', compName(home)), toId: n.id, contractId: n.contractId, homeCompanyId: home, label: 'home company' }), `thread:staff:${n.contractId}:${n.employeeId}`);
  }
  for (const n of nodes) {
    if (n.kind !== 'whiteboard' || !n.employeeId || !n.officeId) continue;
    const owner = nodes.find((m) => (m.kind === 'employee' || m.kind === 'reference') && m.employeeId === n.employeeId);
    if (owner) addThread(projectThread({ kind: 'ownership', fromId: owner.id, toId: n.id, label: 'owns board' }), `thread:ownership:${n.id}`);
  }
  for (const p of [...portals.values()].sort((a, b) => cmp(a.id, b.id))) push(p);

  const allCompanies = byId(snap.companies);
  const forest = projectForest(allCompanies);
  for (const w of forest.warnings) warnings.push(w);
  const cname = new Map(allCompanies.map((c) => [c.id, c.name]));
  const crumbs: FreeflowScene['breadcrumbs'] = [{ label: 'Portfolio', focus: { kind: 'portfolio' } }];
  for (const aid of ancestorsOf(forest, cid, allCompanies.length)) crumbs.push({ label: cname.get(aid) ?? aid, focus: { kind: 'company', companyId: aid } });
  crumbs.push({ label: company.name, focus: { kind: 'company', companyId: cid } });
  // Organizational navigation portals (parent / direct subcompanies). Navigation only; grants nothing.
  {
    const parent = forest.parentOf.get(cid);
    const kids = forest.childrenOf.get(cid) ?? [];
    const orgIds = [...(parent ? [parent] : []), ...kids];
    orgIds.forEach((oid2, idx) => {
      const role = oid2 === parent ? 'parent' : 'child';
      const id = `portal:${cid}:${role}:${oid2}`;
      if (nodeIds.has(id)) return;
      push({ id, kind: 'reference', entityId: oid2, companyId: oid2, parentId: null, label: cname.get(oid2) ?? oid2, subtitle: role === 'parent' ? 'Parent company (organizational link)' : 'Subcompany (organizational link)', status: 'portal', rect: { x: baseX - 240, y: baseY + (portals.size + idx) * 76 + 400, width: 180, height: 56 }, metadata: { portal: true, role, reference: true, organizational: true, homeCompanyId: oid2 }, counts: {} });
    });
  }
  if (!isCompany) {
    const o = offices[0];
    if (o) crumbs.push({ label: o.name, focus: { kind: 'office', companyId: cid, officeId: o.id } });
  }
  if (focus.kind === 'department') {
    const d = depts.find((x) => x.id === focus.departmentId);
    if (d) crumbs.push({ label: d.name, focus });
    else warnings.push(`Department ${focus.departmentId} not found.`);
  }
  const safeThreads = threads.filter((t) => nodeIds.has(t.fromId) && nodeIds.has(t.toId));
  const cj = jobs.filter((j) => j.companyId === cid);
  const costed = cj.filter((j) => j.usage && j.costStatus && j.costStatus !== 'none');
  const isRef = (n: SceneNode) => n.kind === 'reference' && !n.metadata['portal'] && !n.metadata['globalAssistant'] && !n.metadata['serviceHost'];
  return {
    title: company.name, breadcrumbs: crumbs, focus,
    bounds: unionBounds(nodes.map((n) => n.rect), 120), nodes, threads: sortThreads(safeThreads),
    counts: {
      offices: offices.length, rooms: nodes.filter((n) => n.kind === 'room').length, whiteboards: nodes.filter((n) => n.kind === 'whiteboard').length,
      employees: nodes.filter((n) => n.kind === 'employee').length, references: nodes.filter(isRef).length,
      serviceHostReferences: nodes.filter((n) => n.metadata['serviceHost'] === true).length,
      fallbacks: nodes.filter((n) => n.kind === 'fallback').length, hiredEmployees: employees.length,
      runningJobs: cj.filter((j) => j.status === 'running').length, recordedCostUsd: costed.reduce((a, j) => a + (j.usage?.costUsd ?? 0), 0),
      unknownCostJobs: cj.length - costed.length,
      subcompanies: (forest.childrenOf.get(cid) ?? []).length,
    },
    warnings,
  };
}
