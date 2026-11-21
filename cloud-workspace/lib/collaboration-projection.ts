/** Pure member projection for ONE authorized company over the ACTUAL native OfficeState shapes.
 * Allowlist only; unknown fields dropped. Filter by company/relationship BEFORE bounding. */
import type { AtlasEnv } from './atlas-api.ts';
import { insist, requireMembership, type CollabUser } from './collaboration-auth.ts';
type Row = Record<string, any>;
export const LIMITS = { offices: 50, departments: 200, roleCards: 200, blueprints: 50, rooms: 60, desks: 200, whiteboards: 100, jobs: 200, goals: 100, roadmap: 200, links: 25 } as const;
const obj = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (v: unknown): Row[] => (Array.isArray(v) ? v.filter(obj) : []);
const str = (v: unknown, n = 300): string | null => (typeof v === 'string' && v.length > 0 ? v.slice(0, n) : null);
const fin = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const unit = (v: unknown): number | null => { const n = fin(v); return n !== null && n >= 0 && n <= 1 ? n : null; };
const size = (v: unknown): number | null => { const n = fin(v); return n !== null && n > 0 && n <= 1 ? n : null; };
const strs = (v: unknown, cap: number = LIMITS.links): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length <= 120).slice(0, cap) : []);
function meta(matched: number, returned: number) { return { matched, returned, truncated: returned < matched }; }
function cap<T>(items: T[], n: number): { out: T[]; m: ReturnType<typeof meta> } { const out = items.slice(0, n); return { out, m: meta(items.length, out.length) }; }
const q = (...p: string[]) => p.join('::');

export function projectCompanyForMember(snapshot: unknown, companyId: string): Row | null {
  if (!obj(snapshot) || typeof companyId !== 'string') return null;
  const company = list(snapshot.companies).find((c) => c.id === companyId);
  if (!company) return null;
  const portfolio = obj(snapshot.portfolio) ? snapshot.portfolio : {};
  const allEmployees = list(snapshot.employees);
  const empById = new Map<string, Row>(); for (const e of allEmployees) if (typeof e.id === 'string') empById.set(e.id, e);

  const officesAll = list(snapshot.offices).filter((o) => o.companyId === companyId && str(o.id));
  const officeIds = new Set(officesAll.map((o) => o.id as string));
  const deptsAll = list(snapshot.departments).filter((d) => d.companyId === companyId && officeIds.has(d.officeId) && str(d.id));
  const deptIds = new Set(deptsAll.map((d) => d.id as string));
  const offices = cap(officesAll, LIMITS.offices);
  const retainedOffices = new Set(offices.out.map((o) => o.id as string));
  const departments = cap(deptsAll.filter((d) => retainedOffices.has(d.officeId)), LIMITS.departments);
  const retainedDepts = new Set(departments.out.map((d) => d.id as string));

  // Services/contracts relevant to this company.
  const services = list(portfolio.services);
  const contracts = list(portfolio.contracts);
  const svcById = new Map<string, Row>(); for (const s of services) if (typeof s.id === 'string') svcById.set(s.id, s);
  const officeById = new Map<string, Row>(); for (const o of officesAll) officeById.set(o.id, o);
  const deptById = new Map<string, Row>(); for (const d of deptsAll) deptById.set(d.id, d);
  const recipientContracts = contracts.filter((c) => {
    if (c.recipientCompanyId !== companyId || !svcById.has(c.serviceId)) return false;
    const ro = c.recipientOfficeId, rd = c.recipientDepartmentId;
    if (ro != null && !officeById.has(ro)) return false;
    if (rd != null) { const d = deptById.get(rd); if (!d) return false; if (ro != null && d.officeId !== ro) return false; }
    return true;
  });
  const contractOffice = (employeeId: string, officeId: string): boolean => recipientContracts.some((c) => strs(c.employeeIds, 500).includes(employeeId) && (c.recipientOfficeId == null || c.recipientOfficeId === officeId));
  const hostServices = services.filter((s) => s.companyId === companyId && officeIds.has(s.officeId));

  // roleRefs: employeeId -> provenance info
  const refs = new Map<string, { home: boolean; hostMember: boolean; hostRetired: boolean; contract: boolean; contractActive: boolean; layout: boolean; serviceId: string | null }>();
  const ref = (id: string) => { let r = refs.get(id); if (!r) { r = { home: false, hostMember: false, hostRetired: false, contract: false, contractActive: false, layout: false, serviceId: null }; refs.set(id, r); } return r; };
  for (const e of allEmployees) if (e.companyId === companyId && str(e.id)) ref(e.id).home = true;
  for (const s of hostServices) {
    for (const id of strs(s.employeeIds, 500)) { const r = ref(id); r.hostMember = true; r.serviceId = s.id; }
    for (const id of strs(s.retiredEmployeeIds, 500)) { const r = ref(id); r.hostRetired = true; r.serviceId = r.serviceId ?? s.id; }
  }
  for (const c of recipientContracts) {
    const s = svcById.get(c.serviceId)!;
    const active = c.status === 'active' && s.status === 'active';
    const members = new Set(strs(s.employeeIds, 500));
    for (const id of strs(c.employeeIds, 500)) {
      const r = ref(id); r.contract = true; r.serviceId = r.serviceId ?? s.id;
      if (active && members.has(id)) r.contractActive = true;
    }
  }

  // Blueprints: validate company+office linkage, geometry.
  const bpAll = list(snapshot.blueprints).filter((b) => b.companyId === companyId && officeIds.has(b.officeId) && str(b.id));
  const blueprints = cap(bpAll.filter((b) => retainedOffices.has(b.officeId)), LIMITS.blueprints);
  const roomTotals = { matched: 0, returned: 0 }, deskTotals = { matched: 0, returned: 0 }, boardTotals = { matched: 0, returned: 0 };
  const sceneBps: Row[] = [];
  // Pre-pass collect candidate layout employee refs so role cards can include them.
  const preDeskEmp = new Set<string>(); const preBoardOwner = new Set<string>();
  const placeable = (employeeId: unknown, officeId: string): boolean => {
    if (typeof employeeId !== 'string') return false;
    const e = empById.get(employeeId); if (!e) return false;
    if (e.companyId === companyId) return e.officeId == null || e.officeId === officeId;
    if (hostServices.some((s) => s.officeId === officeId && (strs(s.employeeIds, 500).includes(employeeId) || strs(s.retiredEmployeeIds, 500).includes(employeeId)))) return true;
    return contractOffice(employeeId, officeId);
  };
  for (const b of blueprints.out) { for (const d of list(b.desks)) if (placeable(d.employeeId, b.officeId)) preDeskEmp.add(d.employeeId); for (const w of list(b.whiteboards)) if (placeable(w.ownerEmployeeId, b.officeId)) preBoardOwner.add(w.ownerEmployeeId); }
  // Role relevance: layout reference counts only if validated against host/contract relationships.
  for (const id of [...preDeskEmp, ...preBoardOwner]) {
    const emp = empById.get(id); if (!emp) continue;
    const r = refs.get(id);
    if (r && (r.home || r.hostMember || r.hostRetired || r.contract)) r.layout = true;
  }
  // Role cards
  const cards: Row[] = [];
  for (const [id, r] of refs) {
    const e = empById.get(id); if (!e) continue;
    const foreign = !r.home;
    if (foreign && !(r.hostMember || r.hostRetired || r.contract)) continue;
    if (foreign && !r.hostMember && !r.hostRetired && !r.contractActive && !r.layout && !r.contract) continue;
    let availability: string;
    if (e.status === 'fired') availability = 'unavailable';
    else if (r.home) availability = e.status === 'active' ? 'active' : 'paused';
    else if (r.contractActive && e.status === 'active') availability = 'active';
    else if (r.hostMember && e.status === 'active') availability = 'host-service';
    else if (r.hostRetired && !r.hostMember) availability = 'historical';
    else availability = 'layout-only';
    const card: Row = { id, name: str(e.name, 120), role: str(e.role, 120), kind: str(e.kind, 20), shared: foreign, availability, provenance: r.home ? 'home' : r.hostMember || r.hostRetired ? 'service-host' : 'service-contract', toolAccess: false };
    if (r.home) { card.status = str(e.status, 20); card.officeId = retainedOffices.has(e.officeId) ? e.officeId : null; card.departmentId = retainedDepts.has(e.departmentId) ? e.departmentId : null; }
    else { if (r.serviceId) card.serviceId = r.serviceId; }
    cards.push(card);
  }
  cards.sort((a, b) => (a.shared === b.shared ? String(a.id).localeCompare(String(b.id)) : a.shared ? 1 : -1));
  const roleCards = cap(cards, LIMITS.roleCards);
  const retainedRoles = new Set(roleCards.out.map((r) => r.id as string));

  // Retained room/desk/board projection with closure.
  for (const b of blueprints.out) {
    const rooms: Row[] = []; const roomIds = new Set<string>();
    const roomsValid = list(b.rooms).filter((r) => {
      if (!str(r.id)) return false;
      const x = unit(r.x), y = unit(r.y), w = size(r.width), h = size(r.height);
      if (x === null || y === null || w === null || h === null) return false;
      if (x + w > 1.0001 || y + h > 1.0001) return false;
      if (r.departmentId != null) { const dd = deptById.get(r.departmentId); if (!dd || dd.officeId !== b.officeId) return false; }
      return true;
    });
    roomTotals.matched += roomsValid.length;
    for (const r of roomsValid.slice(0, LIMITS.rooms)) {
      if (roomIds.has(r.id)) continue;
      roomIds.add(r.id); roomTotals.returned++;
      rooms.push({ id: r.id, sceneId: q(companyId, b.officeId, r.id), name: str(r.name, 120), departmentId: r.departmentId && retainedDepts.has(r.departmentId) ? r.departmentId : null, x: r.x, y: r.y, width: r.width, height: r.height });
    }
    const desksValid = list(b.desks).filter((d) => {
      if (!str(d.id) || !roomIds.has(d.roomId) || !retainedRoles.has(d.employeeId) || !placeable(d.employeeId, b.officeId)) return false;
      return unit(d.x) !== null && unit(d.y) !== null;
    });
    deskTotals.matched += desksValid.length;
    const desks = desksValid.slice(0, LIMITS.desks).map((d) => { deskTotals.returned++; return { id: d.id, sceneId: q(companyId, b.officeId, d.id), roomId: d.roomId, roomSceneId: q(companyId, b.officeId, d.roomId), employeeId: d.employeeId, x: d.x, y: d.y }; });
    const boardsValid = list(b.whiteboards).filter((w) => str(w.id) && roomIds.has(w.roomId) && unit(w.x) !== null && unit(w.y) !== null && retainedRoles.has(w.ownerEmployeeId) && placeable(w.ownerEmployeeId, b.officeId));
    boardTotals.matched += boardsValid.length;
    const whiteboards = boardsValid.slice(0, LIMITS.whiteboards).map((w) => { boardTotals.returned++; return { id: w.id, sceneId: q(companyId, b.officeId, w.id), roomId: w.roomId, roomSceneId: q(companyId, b.officeId, w.roomId), title: str(w.title, 200), ownerEmployeeId: w.ownerEmployeeId, x: w.x, y: w.y, _goalIds: strs(w.goalIds, 200), _jobIds: strs(w.jobIds, 200), _roadmapIds: strs(w.roadmapItemIds, 200) }; });
    sceneBps.push({ id: b.id, officeId: b.officeId, companyId, rooms, desks, whiteboards });
  }

  // Goals / jobs: company scoped.
  const goalsAll = list(snapshot.goals).filter((g) => g.companyId === companyId && str(g.id));
  const goals = cap(goalsAll, LIMITS.goals);
  const goalById = new Map<string, Row>(); for (const g of goalsAll) goalById.set(g.id, g);
  const retainedGoals = new Set(goals.out.map((g) => g.id as string));
  const scopeOf = (s: unknown): Row | null => {
    if (!obj(s)) return null; const k = s.kind, id = s.id; if (typeof id !== 'string') return null;
    if (k === 'company') return id === companyId ? { kind: 'company', id } : null;
    if (k === 'office') return retainedOffices.has(id) ? { kind: 'office', id } : null;
    if (k === 'department') return retainedDepts.has(id) ? { kind: 'department', id } : null;
    if (k === 'employee') return retainedRoles.has(id) ? { kind: 'employee', id } : null;
    return null;
  };
  const goalsOut = goals.out.map((g) => { const sc = scopeOf(g.scope); return { id: g.id, title: str(g.title, 200), status: str(g.status, 40), scope: sc, scopeRestricted: sc === null }; });
  const jobsAll = list(snapshot.jobs).filter((j) => j.companyId === companyId && str(j.id));
  const jobs = cap(jobsAll, LIMITS.jobs);
  const retainedJobs = new Set(jobs.out.map((j) => j.id as string));
  const jobsOut = jobs.out.map((j) => {
    const goal = typeof j.goalId === 'string' ? goalById.get(j.goalId) : undefined;
    const step = goal ? list(goal.steps).find((s) => s.employeeId === j.employeeId && s.id && str(s.title)) : undefined;
    return { id: j.id, status: str(j.status, 40), label: step ? str(step.title, 200) : 'Job', employeeId: retainedRoles.has(j.employeeId) ? j.employeeId : null, goalId: retainedGoals.has(j.goalId) ? j.goalId : null, officeId: retainedOffices.has(j.officeId) ? j.officeId : null, departmentId: j.departmentId && retainedDepts.has(j.departmentId) ? j.departmentId : null };
  });

  // Roadmap: company-scoped only.
  const allRoad = list(portfolio.roadmap);
  const roadAll = allRoad.filter((r) => obj(r.scope) && r.scope.kind === 'company' && r.scope.id === companyId && str(r.id));
  const visibleBoardRoad = new Set<string>(); for (const b of blueprints.out) for (const w of list(b.whiteboards)) for (const id of strs(w.roadmapItemIds, 200)) visibleBoardRoad.add(id);
  const restrictedLinked = allRoad.filter((r) => typeof r.id === 'string' && visibleBoardRoad.has(r.id) && !(obj(r.scope) && r.scope.kind === 'company' && r.scope.id === companyId)).length;
  const road = cap(roadAll, LIMITS.roadmap);
  const retainedRoad = new Set(road.out.map((r) => r.id as string));
  const contractIds = new Set(recipientContracts.map((c) => c.id as string));
  const roadOut = road.out.map((r) => ({ id: r.id, title: str(r.title, 200), status: str(r.status, 20), ownerEmployeeId: retainedRoles.has(r.ownerEmployeeId) ? r.ownerEmployeeId : null, departmentId: r.departmentId && retainedDepts.has(r.departmentId) ? r.departmentId : null, serviceContractId: contractIds.has(r.serviceContractId) ? r.serviceContractId : null, dependencies: strs(r.dependencies, LIMITS.links).filter((d) => retainedRoad.has(d)), goalIds: strs(r.goalIds, 200).filter((g) => retainedGoals.has(g)).slice(0, LIMITS.links), jobIds: strs(r.jobIds, 200).filter((j) => retainedJobs.has(j)).slice(0, LIMITS.links) }));
  // Finish boards: filter links to retained targets, drop internals.
  for (const bp of sceneBps) bp.whiteboards = bp.whiteboards.map((w: Row) => { const { _goalIds, _jobIds, _roadmapIds, ...rest } = w; return { ...rest, goalIds: _goalIds.filter((g: string) => retainedGoals.has(g)).slice(0, LIMITS.links), jobIds: _jobIds.filter((j: string) => retainedJobs.has(j)).slice(0, LIMITS.links), roadmapItemIds: _roadmapIds.filter((r: string) => retainedRoad.has(r)).slice(0, LIMITS.links) }; });

  const officesOut = offices.out.map((o) => ({ id: o.id, companyId, name: str(o.name, 200), status: str(o.status, 20) }));
  const deptsOut = departments.out.map((d) => ({ id: d.id, companyId, officeId: d.officeId, name: str(d.name, 200), status: str(d.status, 20) }));
  const roleOut = roleCards.out;
  return {
    company: { id: company.id, name: str(company.name, 200), status: str(company.status, 20) },
    offices: officesOut, departments: deptsOut, roleCards: roleOut, blueprints: sceneBps, jobs: jobsOut, goals: goalsOut, roadmap: roadOut,
    truncation: { offices: meta(officesAll.length, offices.out.length), departments: meta(deptsAll.length, departments.out.length), parentCapOmitted: { blueprints: bpAll.length - bpAll.filter((b) => retainedOffices.has(b.officeId)).length, departments: deptsAll.length - deptsAll.filter((d) => retainedOffices.has(d.officeId)).length }, roleCards: roleCards.m, blueprints: blueprints.m, rooms: meta(roomTotals.matched, roomTotals.returned), desks: meta(deskTotals.matched, deskTotals.returned), whiteboards: meta(boardTotals.matched, boardTotals.returned), jobs: jobs.m, goals: goals.m, roadmap: road.m, restrictedLinkedRoadmap: restrictedLinked },
    counts: { offices: officesOut.length, departments: deptsOut.length, roleCards: roleOut.length, jobs: jobsOut.length, goals: goalsOut.length, roadmap: roadOut.length },
  };
}
function canonicalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === 'object') { const out: Row = {}; for (const k of Object.keys(v as Row).sort()) out[k] = canonicalize((v as Row)[k]); return out; }
  return v;
}
/** Versioned SHA-256 freshness digest over a deterministic serialization of the permitted body only. */
export async function viewFingerprint(body: Row, companyId: string, userId: string): Promise<string> {
  const text = JSON.stringify(canonicalize({ body, companyId, userId }));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  let hex = ''; for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, '0');
  return 'vf1:' + hex;
}
/** Route-facing helper: authorize current membership, then project the current owner snapshot. */
export async function authorizedCompanyView(env: AtlasEnv, user: CollabUser, companyId: string): Promise<Row> {
  const membership = await requireMembership(env, user, companyId);
  const row = await env.DB!.prepare("SELECT revision, snapshot FROM atlas_workspace WHERE id = 'owner'").first<Row>();
  insist(row, 'Company not found or access denied.', 404, 'not_found');
  let snap: unknown; try { snap = JSON.parse(row.snapshot); } catch { snap = null; }
  const view = projectCompanyForMember(snap, companyId);
  insist(view, 'Company not found or access denied.', 404, 'not_found');
  const body: Row = { ...view, membership: { role: membership.role, expiresAt: membership.expiresAt, aclRevision: membership.aclRevision } };
  // Owner keeps the exact global revision for proposal-acceptance CAS.
  if (user.isOwner === true) return { ...body, revision: row.revision };
  // Members: no revision property at all; fingerprint is freshness metadata only, never authority for mutations.
  return { ...body, viewFingerprint: await viewFingerprint(body, companyId, user.id) };
}
