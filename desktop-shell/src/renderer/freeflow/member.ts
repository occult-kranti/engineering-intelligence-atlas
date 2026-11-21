/** Read-only visitor canvas. Accepts the member DTO, never the native owner snapshot.
 * Network, identity validation, membership expiry and proposals remain with the host page. */
import { mountStudio, type Studio } from './studio.js';
import type { FreeflowFocus, FreeflowSnapshot, MemberRoleReference } from './model.js';

type Row = Record<string, unknown>;
const object = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const rows = (v: unknown, limit: number): Row[] => Array.isArray(v) ? v.filter(object).slice(0, limit) : [];
const text = (v: unknown, max = 200): string => typeof v === 'string' ? v.slice(0, max) : '';
const id = (v: unknown): string => typeof v === 'string' && v !== '.' && v !== '..' && /^[A-Za-z0-9_.-]{1,100}$/.test(v) ? v : '';
const unique = (v: Row[]): Row[] => { const seen = new Set<string>(); return v.filter((r) => { const k = id(r.id); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
const status = (v: unknown): string => typeof v === 'string' && /^[a-z-]{1,40}$/.test(v) ? v : 'unknown';
const unit = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
const links = (v: unknown): string[] => Array.isArray(v) ? v.map(id).filter(Boolean).slice(0, 25) : [];

export function projectMemberSnapshot(input: unknown): FreeflowSnapshot {
  if (!object(input) || !object(input.company) || !id(input.company.id) || !object(input.membership)
    || !['viewer', 'contributor', 'owner'].includes(String(input.membership.role))
    || !object(input.access) || input.access.mode !== 'member') throw new Error('The authorized company view is unavailable.');
  const companyId = id(input.company.id);
  const offices = unique(rows(input.offices, 50)).filter((o) => o.companyId === companyId)
    .map((o) => ({ id: id(o.id), companyId, name: text(o.name), status: status(o.status) }));
  const officeIds = new Set(offices.map((o) => o.id));
  const departments = unique(rows(input.departments, 200)).filter((d) => d.companyId === companyId && officeIds.has(id(d.officeId)))
    .map((d) => ({ id: id(d.id), companyId, officeId: id(d.officeId), name: text(d.name), status: status(d.status), parentDepartmentId: id(d.parentDepartmentId) || null }));
  const depts = new Map(departments.map((d) => [d.id, d]));
  for (const d of departments) if (d.parentDepartmentId && depts.get(d.parentDepartmentId)?.officeId !== d.officeId) d.parentDepartmentId = null;
  const roles = unique(rows(input.roleCards, 200));
  const roleIds = new Set(roles.map((r) => id(r.id)));
  const employees = roles.filter((r) => r.shared !== true).map((r) => ({
    id: id(r.id), companyId, officeId: officeIds.has(id(r.officeId)) ? id(r.officeId) : null,
    departmentId: depts.has(id(r.departmentId)) ? id(r.departmentId) : null,
    name: text(r.name, 120), role: text(r.role, 120), kind: r.kind === 'assistant' ? 'assistant' : 'specialist',
    status: status(r.status ?? r.availability),
  }));
  const memberReferences: MemberRoleReference[] = roles.filter((r) => r.shared === true).map((r) => ({
    id: id(r.id), name: text(r.name, 120), role: text(r.role, 120), availability: status(r.availability),
    provenance: r.provenance === 'service-host' ? 'service-host' : 'service-contract',
  }));
  const blueprints = unique(rows(input.blueprints, 50)).filter((b) => officeIds.has(id(b.officeId))).map((b) => {
    const officeId = id(b.officeId);
    const rooms = unique(rows(b.rooms, 60)).filter((r) => {
      const x = unit(r.x), y = unit(r.y), w = unit(r.width), h = unit(r.height);
      return x !== null && y !== null && w !== null && h !== null && w > 0 && h > 0 && x + w <= 1.0001 && y + h <= 1.0001;
    }).map((r) => ({ id: id(r.id), name: text(r.name, 120), departmentId: depts.get(id(r.departmentId))?.officeId === officeId ? id(r.departmentId) : null,
      x: r.x as number, y: r.y as number, width: r.width as number, height: r.height as number }));
    const roomIds = new Set(rooms.map((r) => r.id));
    const desks = unique(rows(b.desks, 200)).filter((d) => roomIds.has(id(d.roomId)) && roleIds.has(id(d.employeeId)))
      .map((d) => ({ id: id(d.id), roomId: id(d.roomId), employeeId: id(d.employeeId), x: unit(d.x) ?? 0.5, y: unit(d.y) ?? 0.5 }));
    const whiteboards = unique(rows(b.whiteboards, 100)).filter((w) => roomIds.has(id(w.roomId)) && roleIds.has(id(w.ownerEmployeeId)))
      .map((w) => ({ id: id(w.id), roomId: id(w.roomId), ownerEmployeeId: id(w.ownerEmployeeId), title: text(w.title),
        goalIds: links(w.goalIds), jobIds: links(w.jobIds), roadmapItemIds: links(w.roadmapItemIds), x: unit(w.x) ?? 0.5, y: unit(w.y) ?? 0.5 }));
    return { id: id(b.id), companyId, officeId, rooms, desks, whiteboards };
  });
  const jobs = unique(rows(input.jobs, 200)).map((j) => ({ id: id(j.id), companyId, status: status(j.status),
    employeeId: roleIds.has(id(j.employeeId)) ? id(j.employeeId) : '',
    officeId: officeIds.has(id(j.officeId)) ? id(j.officeId) : undefined,
    departmentId: depts.has(id(j.departmentId)) ? id(j.departmentId) : null }));
  return {
    companies: [{ id: companyId, name: text(input.company.name), status: status(input.company.status) }],
    offices, departments, employees, memberReferences, blueprints, jobs,
    access: { mode: 'member', role: input.membership.role as 'viewer' | 'contributor' | 'owner', restricted: true },
  };
}

export interface MemberStudio { update(dto: unknown): void; destroy(): void }

export function mountMemberStudio(host: HTMLElement, dto: unknown): MemberStudio {
  let snapshot = projectMemberSnapshot(dto);
  let companyId = snapshot.companies![0]!.id;
  let focus: FreeflowFocus = { kind: 'company', companyId };
  let destroyed = false;
  host.classList.add('ff-member-host');
  const denied = () => ({ enabled: false, reason: 'This visitor canvas is read-only. Use the company proposal and discussion controls on this page.' });
  const studio: Studio = mountStudio(host, {
    storage: null,
    capabilities: denied,
    onAction: () => { /* no owner bridge exists on this surface */ },
    onNavigate: (next) => {
      if (destroyed || next.kind === 'portfolio' || next.companyId !== companyId) return;
      if (next.kind !== 'company' && !snapshot.offices?.some((o) => o.id === next.officeId && o.companyId === companyId)) return;
      if (next.kind === 'department' && !snapshot.departments?.some((d) => d.id === next.departmentId && d.officeId === next.officeId)) return;
      focus = next; studio.update(snapshot, focus);
    },
  });
  studio.update(snapshot, focus);
  return {
    update(next) {
      if (destroyed) return;
      let projected: FreeflowSnapshot;
      try { projected = projectMemberSnapshot(next); }
      catch (error) { studio.destroy(); destroyed = true; host.classList.remove('ff-member-host'); throw error; }
      snapshot = projected;
      const nextId = snapshot.companies![0]!.id;
      const current = focus;
      const officeValid = current.kind === 'company' || current.kind === 'portfolio' || snapshot.offices?.some((o) => o.id === current.officeId);
      const departmentValid = current.kind !== 'department' || snapshot.departments?.some((d) => d.id === current.departmentId);
      if (nextId !== companyId || !officeValid || !departmentValid) { companyId = nextId; focus = { kind: 'company', companyId }; }
      studio.update(snapshot, focus);
    },
    destroy() { if (destroyed) return; destroyed = true; studio.destroy(); host.classList.remove('ff-member-host'); },
  };
}
