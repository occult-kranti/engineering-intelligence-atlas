// Pure Freeflow scene model: portfolio -> company -> office/department blueprint.
// Structural readonly snapshot types mirror shared/office.ts; no runtime shared imports.
import { cmp, gridColumns, looksNormalized, mapNative, packClusters, packGrid, unionBounds, type LRect } from './layout.js';
import { projectThread, sortThreads, type SceneThread } from './threads.js';

export type { SceneThread } from './threads.js';
export type { LRect } from './layout.js';

type RO<T> = { readonly [K in keyof T]: T[K] };
interface SCompany { id: string; name: string; status: string; repoUrl?: string | null }
interface SOffice { id: string; companyId: string; name: string; status: string }
interface SDepartment { id: string; companyId: string; officeId: string; name: string; status: string }
interface SEmployee { id: string; companyId: string | null; officeId: string | null; departmentId: string | null; name: string; role: string; kind: string; status: string }
interface SJob { id: string; companyId: string; officeId?: string; departmentId?: string | null; employeeId: string; status: string; usage?: { costUsd: number; inputTokens: number; outputTokens: number }; costStatus?: string; serviceContractId?: string | null }
interface SRoom { id: string; name: string; departmentId: string | null; x: number; y: number; width: number; height: number }
interface SDesk { id: string; roomId: string; employeeId: string; x: number; y: number }
interface SBoard { id: string; roomId: string; ownerEmployeeId: string; title: string; goalIds?: string[]; jobIds?: string[]; roadmapItemIds?: string[]; x: number; y: number }
interface SBlueprint { id: string; companyId: string; officeId: string; rooms: SRoom[]; desks: SDesk[]; whiteboards: SBoard[] }
interface SGroup { id: string; name: string; companyIds: string[]; status?: string }
interface SService { id: string; key: string; name: string; companyId: string; officeId: string; departmentId: string; employeeIds: string[]; status: string }
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
  title: string;
  breadcrumbs: Array<{ label: string; focus: FreeflowFocus }>;
  focus: FreeflowFocus;
  bounds: LRect;
  nodes: SceneNode[];
  threads: SceneThread[];
  counts: Record<string, number>;
  warnings: string[];
}

const FOLIO_W = 360, FOLIO_H = 240, GAP = 60;
const SHEET_W = 900, SHEET_H = 640;
const SCALE = 800; // normalized blueprint geometry -> world units

function byId<T extends { id: string }>(xs: readonly T[] | undefined): T[] {
  return [...(xs ?? [])].sort((a, b) => cmp(a.id, b.id));
}

function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? '?') + (w[1]?.[0] ?? '')).toUpperCase();
}

function empty(focus: FreeflowFocus, title: string, warnings: string[]): FreeflowScene {
  return { title, breadcrumbs: [{ label: 'Portfolio', focus: { kind: 'portfolio' } }], focus, bounds: unionBounds([]), nodes: [], threads: [], counts: {}, warnings };
}

function employeeNode(e: RO<SEmployee>, parentId: string, rect: LRect, companyId: string, jobs: readonly RO<SJob>[], extra: Partial<SceneNode> = {}): SceneNode {
  const own = jobs.filter((j) => j.employeeId === e.id && j.companyId === companyId);
  const running = own.filter((j) => j.status === 'running').length;
  return {
    id: `employee:${companyId}:${e.id}`, kind: 'employee', entityId: e.id, companyId,
    officeId: e.officeId ?? undefined, departmentId: e.departmentId ?? undefined, employeeId: e.id,
    parentId, label: e.name, subtitle: e.role, status: e.status, rect,
    metadata: { monogram: initials(e.name), employeeKind: e.kind },
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
  const groups = byId(snap.portfolio?.groups).filter((g) => g.status !== 'paused' || true);
  const groupOf = new Map<string, RO<SGroup>>();
  const memberships = new Map<string, string[]>();
  for (const g of groups) {
    for (const cid of [...g.companyIds].sort(cmp)) {
      if (!known.has(cid)) { warnings.push(`Group ${g.id} references missing company ${cid}.`); continue; }
      memberships.set(cid, [...(memberships.get(cid) ?? []), g.id]);
      if (!groupOf.has(cid)) groupOf.set(cid, g);
    }
  }
  const clusters = new Map<string, RO<SCompany>[]>();
  for (const c of companies) {
    const key = groupOf.get(c.id)?.id ?? '~ungrouped';
    clusters.set(key, [...(clusters.get(key) ?? []), c]);
  }
  const keys = [...clusters.keys()].sort(cmp);
  const packed = packClusters(keys.map((k) => clusters.get(k)!.length), FOLIO_W, FOLIO_H, GAP);
  const shared = snap.portfolio?.ceo?.sharedServicesCompanyId ?? null;
  const nodes: SceneNode[] = [];
  keys.forEach((k, ki) => {
    const members = clusters.get(k)!;
    members.forEach((c, i) => {
      const emps = (snap.employees ?? []).filter((e) => e.companyId === c.id && e.status !== 'fired');
      const cj = jobs.filter((j) => j.companyId === c.id);
      const running = cj.filter((j) => j.status === 'running').length;
      const isShared = c.id === shared;
      nodes.push({
        id: `folio:${c.id}`, kind: 'folio', entityId: c.id, companyId: c.id, parentId: null,
        label: c.name, subtitle: [isShared ? 'Shared services' : '', c.status === 'paused' ? 'Paused' : ''].filter(Boolean).join(' · '),
        status: c.status, rect: packed.rects[ki]![i]!,
        metadata: { groupIds: memberships.get(c.id) ?? [], cluster: k === '~ungrouped' ? null : k, sharedServices: isShared },
        counts: { employees: emps.length, jobs: cj.length, running, queued: cj.filter((j) => j.status === 'queued').length, offices: (snap.offices ?? []).filter((o) => o.companyId === c.id).length },
      });
    });
  });
  const threads = sortThreads(contractThreads(snap, known, nodes));
  return {
    title: 'Conference table', breadcrumbs: [{ label: 'Portfolio', focus }], focus,
    bounds: unionBounds(nodes.map((n) => n.rect), 200), nodes, threads,
    counts: { companies: companies.length, folios: nodes.length, threads: threads.length, runningJobs: jobs.filter((j) => j.status === 'running').length, hiredEmployees: (snap.employees ?? []).filter((e) => e.status !== 'fired').length },
    warnings,
  };
}

function contractThreads(snap: FreeflowSnapshot, known: Set<string>, nodes: SceneNode[]): SceneThread[] {
  const out: SceneThread[] = [];
  const services = new Map((snap.portfolio?.services ?? []).map((s) => [s.id, s]));
  for (const k of snap.portfolio?.contracts ?? []) {
    if (k.status !== 'active') continue;
    const s = services.get(k.serviceId);
    if (!s || !known.has(s.companyId) || !known.has(k.recipientCompanyId)) continue;
    const t = projectThread({ kind: 'service-contract', fromId: `folio:${s.companyId}`, toId: `folio:${k.recipientCompanyId}`, contractId: k.id, homeCompanyId: s.companyId, label: s.name });
    if (t) out.push({ ...t, id: `thread:contract:${k.id}` });
  }
  return nodes.length ? out : [];
}

function companyScene(snap: FreeflowSnapshot, company: RO<SCompany>, focus: FreeflowFocus, jobs: RO<SJob>[], warnings: string[]): FreeflowScene {
  const cid = company.id;
  const offices = byId(snap.offices).filter((o) => o.companyId === cid && (focus.kind === 'company' || (focus.kind !== 'portfolio' && o.id === focus.officeId)));
  if (focus.kind !== 'company' && !offices.length) warnings.push(`Office ${focus.kind === 'portfolio' ? '' : focus.officeId} not found in ${cid}.`);
  const employees = byId(snap.employees).filter((e) => e.companyId === cid && e.status !== 'fired');
  const depts = byId(snap.departments).filter((d) => d.companyId === cid);
  const nodes: SceneNode[] = [];
  const placed = new Set<string>();
  const allDeptIds = new Set(depts.map((d) => d.id));
  const sheets = packGrid(offices.length, SHEET_W, SHEET_H, GAP * 2, gridColumns(offices.length));
  offices.forEach((o, oi) => {
    const sheet = sheets[oi]!;
    const oid = `office:${cid}:${o.id}`;
    const oemps = employees.filter((e) => e.officeId === o.id);
    nodes.push({ id: oid, kind: 'office', entityId: o.id, companyId: cid, officeId: o.id, parentId: null, label: o.name, subtitle: o.status === 'paused' ? 'Paused' : 'Office sheet', status: o.status, rect: sheet, metadata: {}, counts: { employees: oemps.length, departments: depts.filter((d) => d.officeId === o.id).length, running: jobs.filter((j) => j.companyId === cid && j.officeId === o.id && j.status === 'running').length } });
    const bp = (snap.blueprints ?? []).find((b) => b.companyId === cid && b.officeId === o.id);
    const wantDept = focus.kind === 'department' ? focus.departmentId : null;
    if (bp) {
      const rooms = [...bp.rooms].sort((a, b) => cmp(a.id, b.id)).filter((r) => !wantDept || r.departmentId === wantDept);
      const norm = looksNormalized(bp.rooms);
      const sc = norm ? SCALE : 1;
      const origin = { x: sheet.x + 20, y: sheet.y + 40 };
      const roomIds = new Set<string>();
      for (const r of rooms) {
        roomIds.add(r.id);
        nodes.push({ id: `room:${cid}:${r.id}`, kind: 'room', entityId: r.id, companyId: cid, officeId: o.id, departmentId: r.departmentId ?? undefined, roomId: r.id, parentId: oid, label: r.name, subtitle: 'Room', status: 'saved', rect: mapNative(r, origin, sc), metadata: {}, counts: { desks: bp.desks.filter((d) => d.roomId === r.id).length, whiteboards: bp.whiteboards.filter((w) => w.roomId === r.id).length } });
      }
      for (const d of [...bp.desks].sort((a, b) => cmp(a.id, b.id))) {
        const e = employees.find((x) => x.id === d.employeeId);
        if (!roomIds.has(d.roomId)) continue;
        if (!e) { warnings.push(`Desk ${d.id} references missing employee ${d.employeeId}.`); continue; }
        if (placed.has(e.id)) continue;
        placed.add(e.id);
        const p = mapNative({ x: d.x, y: d.y, width: 0.08, height: 0.06 }, origin, sc);
        nodes.push(employeeNode(e, `room:${cid}:${d.roomId}`, { x: p.x, y: p.y, width: 120, height: 56 }, cid, jobs, { roomId: d.roomId }));
      }
      for (const w of [...bp.whiteboards].sort((a, b) => cmp(a.id, b.id))) {
        if (!roomIds.has(w.roomId)) continue;
        const p = mapNative({ x: w.x, y: w.y, width: 0.12, height: 0.08 }, origin, sc);
        nodes.push({ id: `board:${cid}:${w.id}`, kind: 'whiteboard', entityId: w.id, companyId: cid, officeId: o.id, roomId: w.roomId, boardId: w.id, employeeId: w.ownerEmployeeId, parentId: `room:${cid}:${w.roomId}`, label: w.title, subtitle: 'Whiteboard', status: 'saved', rect: { x: p.x, y: p.y, width: 140, height: 90 }, metadata: {}, counts: { goals: w.goalIds?.length ?? 0, jobs: w.jobIds?.length ?? 0, roadmapItems: w.roadmapItemIds?.length ?? 0 } });
      }
    } else if (focus.kind !== 'company') warnings.push(`No saved blueprint for office ${o.id}.`);
    // Unplaced departments and employees go to a clearly marked fallback area.
    const fb: SceneNode[] = [];
    for (const d of depts.filter((d) => d.officeId === o.id && (!wantDept || d.id === wantDept))) {
      if (nodes.some((n) => n.kind === 'room' && n.departmentId === d.id)) continue;
      fb.push({ id: `fallback:${cid}:dept:${d.id}`, kind: 'fallback', entityId: d.id, companyId: cid, officeId: o.id, departmentId: d.id, parentId: oid, label: d.name, subtitle: 'Unplaced department', status: d.status, rect: sheet, metadata: { fallback: true }, counts: {} });
    }
    for (const e of oemps) {
      if (placed.has(e.id)) continue;
      if (wantDept && e.departmentId !== wantDept) continue;
      if (e.departmentId && !allDeptIds.has(e.departmentId)) warnings.push(`Employee ${e.id} references missing department ${e.departmentId}.`);
      placed.add(e.id);
      fb.push(employeeNode(e, oid, sheet, cid, jobs, { metadata: { monogram: initials(e.name), employeeKind: e.kind, fallback: true } }));
    }
    const fy = sheet.y + sheet.height - 140;
    const cells = packGrid(fb.length, 130, 56, 12, 6, sheet.x + 20, fy + 20);
    fb.forEach((n, i) => { n.rect = cells[i]!; });
    nodes.push(...fb);
  });
  // Cross-company contracted staff: reference cards only for active, matching contracts.
  const threads: SceneThread[] = [];
  const services = new Map((snap.portfolio?.services ?? []).map((s) => [s.id, s]));
  const refs = new Set<string>();
  const sheet0 = offices.length ? sheets[0]! : unionBounds([]);
  const refCells = packGrid(64, 130, 56, 12, 6, sheet0.x + 20, sheet0.y + sheet0.height + 40);
  let ri = 0;
  for (const k of [...(snap.portfolio?.contracts ?? [])].sort((a, b) => cmp(a.id, b.id))) {
    if (k.status !== 'active' || k.recipientCompanyId !== cid) continue;
    if (focus.kind !== 'company') {
      if (k.recipientOfficeId && k.recipientOfficeId !== focus.officeId) continue;
      if (focus.kind === 'department' && k.recipientDepartmentId && k.recipientDepartmentId !== focus.departmentId) continue;
    }
    const s = services.get(k.serviceId);
    if (!s) { warnings.push(`Contract ${k.id} references missing service ${k.serviceId}.`); continue; }
    const toId = k.recipientOfficeId ? `office:${cid}:${k.recipientOfficeId}` : null;
    for (const eid of [...k.employeeIds].sort(cmp)) {
      const e = (snap.employees ?? []).find((x) => x.id === eid);
      if (!e || e.status !== 'active') { if (!e) warnings.push(`Contract ${k.id} covers missing employee ${eid}.`); continue; }
      const key = `${k.id}:${eid}`;
      if (refs.has(key)) continue;
      refs.add(key);
      const nid = `reference:${cid}:${k.id}:${eid}`;
      nodes.push({
        id: nid, kind: 'reference', entityId: eid, companyId: cid, officeId: k.recipientOfficeId ?? undefined,
        departmentId: k.recipientDepartmentId ?? undefined, employeeId: eid, contractId: k.id, parentId: toId,
        label: e.name, subtitle: e.role, status: 'contracted', rect: refCells[ri++ % refCells.length]!,
        metadata: { homeCompanyId: s.companyId, allowedTools: [...k.allowedTools].sort(cmp), reference: true, monogram: initials(e.name) },
        counts: { jobs: jobs.filter((j) => j.employeeId === eid && j.companyId === cid && j.serviceContractId === k.id).length },
      });
      const t = projectThread({ kind: 'shared-staff', fromId: `folio:${s.companyId}`, toId: nid, contractId: k.id, homeCompanyId: s.companyId, label: 'contracted staff' });
      if (t) threads.push({ ...t, id: `thread:staff:${k.id}:${eid}` });
    }
    const ct = projectThread({ kind: 'service-contract', fromId: `folio:${s.companyId}`, toId: toId ?? `folio:${cid}`, contractId: k.id, homeCompanyId: s.companyId, label: s.name });
    if (ct) threads.push({ ...ct, id: `thread:contract:${k.id}` });
  }
  const crumbs: FreeflowScene['breadcrumbs'] = [{ label: 'Portfolio', focus: { kind: 'portfolio' } }, { label: company.name, focus: { kind: 'company', companyId: cid } }];
  if (focus.kind === 'office' || focus.kind === 'department') {
    const o = offices[0];
    if (o) crumbs.push({ label: o.name, focus: { kind: 'office', companyId: cid, officeId: o.id } });
  }
  if (focus.kind === 'department') {
    const d = depts.find((x) => x.id === focus.departmentId);
    if (d) crumbs.push({ label: d.name, focus });
    else warnings.push(`Department ${focus.departmentId} not found.`);
  }
  const cj = jobs.filter((j) => j.companyId === cid);
  const costed = cj.filter((j) => j.usage && j.costStatus && j.costStatus !== 'none');
  return {
    title: company.name, breadcrumbs: crumbs, focus,
    bounds: unionBounds(nodes.map((n) => n.rect), 120), nodes, threads: sortThreads(threads),
    counts: {
      offices: offices.length, rooms: nodes.filter((n) => n.kind === 'room').length, whiteboards: nodes.filter((n) => n.kind === 'whiteboard').length,
      employees: nodes.filter((n) => n.kind === 'employee').length, references: nodes.filter((n) => n.kind === 'reference').length,
      fallbacks: nodes.filter((n) => n.kind === 'fallback').length, hiredEmployees: employees.length,
      runningJobs: cj.filter((j) => j.status === 'running').length, recordedCostUsd: costed.reduce((a, j) => a + (j.usage?.costUsd ?? 0), 0),
      unknownCostJobs: cj.length - costed.length,
    },
    warnings,
  };
}
