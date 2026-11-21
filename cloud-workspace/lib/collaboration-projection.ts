/** Pure member projection for ONE authorized company. Allowlist only; unknown fields are dropped. */
import type { AtlasEnv } from './atlas-api.ts';
import { insist, requireMembership, type CollabUser } from './collaboration-auth.ts';
type Row = Record<string, any>;
const MAX = 200;
const obj = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): Row[] => (Array.isArray(v) ? v.filter(obj).slice(0, MAX) : []);
const str = (v: unknown, n = 300): string | null => (typeof v === 'string' ? v.slice(0, n) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pick = (r: Row, keys: string[]): Row => { const o: Row = {}; for (const k of keys) { const v = r[k]; if (typeof v === 'string') o[k] = v.slice(0, 300); else if (num(v) !== null) o[k] = v; else if (typeof v === 'boolean') o[k] = v; } return o; };
export function projectCompanyForMember(snapshot: unknown, companyId: string): Row | null {
  if (!obj(snapshot)) return null;
  const company = arr(snapshot.companies).find((c) => c.id === companyId);
  if (!company) return null;
  const offices = arr(snapshot.offices).filter((o) => o.companyId === companyId).map((o) => ({ ...pick(o, ['id', 'name', 'x', 'y', 'width', 'height', 'w', 'h']), companyId, rooms: arr(o.rooms).slice(0, 50).map((r) => pick(r, ['id', 'name', 'x', 'y', 'width', 'height', 'w', 'h'])) }));
  const departments = arr(snapshot.departments).filter((d) => d.companyId === companyId).map((d) => ({ ...pick(d, ['id', 'name', 'officeId', 'x', 'y', 'width', 'height']), companyId }));
  const employees = arr(snapshot.employees);
  const roleCards: Row[] = [];
  for (const e of employees) {
    const home = e.companyId === companyId;
    // Shared staff: only a recipient assignment to THIS company, with safe role/name.
    const shared = !home && arr(e.sharedAssignments ?? e.shares).some((s) => s.recipientCompanyId === companyId || s.companyId === companyId);
    if (!home && !shared) continue;
    roleCards.push({ id: str(e.id, 120), name: str(e.name, 120), role: str(e.role, 120), status: home ? str(e.status, 40) : null, departmentId: home ? str(e.departmentId, 120) : null, officeId: home ? str(e.officeId, 120) : null, shared: !home, ...(home ? pick(e, ['x', 'y']) : {}) });
  }
  const roleIds = new Set(roleCards.map((r) => r.id));
  const edges = arr(snapshot.edges ?? snapshot.relationships).filter((e) => roleIds.has(e.from) && roleIds.has(e.to)).map((e) => ({ from: str(e.from, 120), to: str(e.to, 120), kind: str(e.kind, 40) }));
  const portfolio = obj(snapshot.portfolio) ? snapshot.portfolio : {};
  const roadmap = arr(portfolio.roadmap).filter((r) => obj(r.scope) && r.scope.kind === 'company' && r.scope.id === companyId).map((r) => pick(r, ['id', 'title', 'status', 'lane', 'startDate', 'targetDate']));
  const jobs = arr(snapshot.jobs).filter((j) => j.companyId === companyId).map((j) => pick(j, ['id', 'title', 'status', 'goalId', 'assigneeId']));
  const goals = arr(snapshot.goals).filter((g) => g.companyId === companyId).map((g) => pick(g, ['id', 'title', 'status']));
  return {
    company: { id: str(company.id, 120), name: str(company.name, 200), repoUrl: str(company.repoUrl, 500), description: str(company.description, 1000) },
    offices, departments, roleCards, edges, roadmap, jobs, goals,
    counts: { offices: offices.length, departments: departments.length, roleCards: roleCards.length, jobs: jobs.length, goals: goals.length, roadmap: roadmap.length },
  };
}
/** Route-facing helper: authorize current membership, then project the current owner snapshot. */
export async function authorizedCompanyView(env: AtlasEnv, user: CollabUser, companyId: string): Promise<Row> {
  const membership = await requireMembership(env, user, companyId);
  const row = await env.DB!.prepare("SELECT revision, snapshot FROM atlas_workspace WHERE id = 'owner'").first<Row>();
  insist(row, 'Company not found or access denied.', 404, 'not_found');
  let snap: unknown; try { snap = JSON.parse(row.snapshot); } catch { snap = null; }
  const view = projectCompanyForMember(snap, companyId);
  insist(view, 'Company not found or access denied.', 404, 'not_found');
  return { ...view, membership: { role: membership.role, expiresAt: membership.expiresAt, aclRevision: membership.aclRevision }, revision: row.revision };
}
