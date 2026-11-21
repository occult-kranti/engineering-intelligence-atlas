/** Collaboration identity and authorization helpers. Legacy owner authenticate() is untouched.
 *
 * Issuer note: for this release the issuer is this Site's single canonical origin
 * (new URL(request.url).origin). There is NO configurable or unauthenticated issuer; the same
 * subject reached via a different origin is a different principal. Trusted identity headers
 * must be injected by the Sites platform. */
import type { AtlasEnv } from './atlas-api.ts';
type Row = Record<string, any>;
export class CollabError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export function insist(value: unknown, message: string, status = 400, code = 'bad_request'): asserts value {
  if (!value) throw new CollabError(status, code, message);
}
const now = () => new Date().toISOString();
export function errorResponse(error: unknown): Response {
  const e = error instanceof CollabError ? error : new CollabError(500, 'internal', 'Request could not be completed.');
  return new Response(JSON.stringify({ ok: false, code: e.code, error: e.message }), { status: e.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}
export type CollabUser = { id: string; issuer: string; subject: string; email: string | null; isOwner: boolean };
/** Trusted subject required. No email fallback, no bearer/device/GitHub tokens as human identity. */
export async function resolveUser(request: Request, env: AtlasEnv): Promise<CollabUser> {
  insist(env.DB, 'Workspace storage is unavailable.', 503, 'unavailable');
  const subject = request.headers.get('oai-authenticated-user-id')?.trim();
  insist(subject && subject.length <= 300, 'Sign in required.', 401, 'subject_required');
  const issuer = new URL(request.url).origin;
  const emailRaw = request.headers.get('oai-authenticated-user-email')?.trim() || null;
  const email = emailRaw && emailRaw.length <= 320 ? emailRaw : null;
  const DB = env.DB!;
  let user = await DB.prepare('SELECT * FROM daftar_users WHERE issuer = ? AND subject = ?').bind(issuer, subject).first<Row>();
  const stamp = now();
  let currentEmail: string | null = user?.email ?? null;
  if (!user) {
    const id = crypto.randomUUID();
    await DB.prepare('INSERT OR IGNORE INTO daftar_users (id,issuer,subject,email,display_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id, issuer, subject, email, null, 'active', stamp, stamp).run();
    user = await DB.prepare('SELECT * FROM daftar_users WHERE issuer = ? AND subject = ?').bind(issuer, subject).first<Row>();
    currentEmail = user?.email ?? null;
  } else if (email && user.email !== email) {
    await DB.prepare('UPDATE daftar_users SET email = ?, updated_at = ? WHERE id = ?').bind(email, stamp, user.id).run();
    currentEmail = email;
  }
  insist(user && user.status === 'active', 'Account is not active.', 403, 'inactive');
  const ownerEmail = env.ATLAS_OWNER_EMAIL?.trim().toLowerCase();
  let ownerRow = await DB.prepare("SELECT * FROM daftar_workspace_owners WHERE workspace_id = 'owner'").first<Row>();
  if (!ownerRow && ownerEmail && currentEmail && currentEmail.toLowerCase() === ownerEmail) {
    await DB.prepare("INSERT OR IGNORE INTO daftar_workspace_owners (workspace_id,user_id,bound_at) VALUES ('owner',?,?)").bind(user.id, stamp).run();
    ownerRow = await DB.prepare("SELECT * FROM daftar_workspace_owners WHERE workspace_id = 'owner'").first<Row>();
  }
  return { id: user.id, issuer, subject, email: currentEmail, isOwner: !!ownerRow && ownerRow.user_id === user.id };
}
export function requireOwner(user: CollabUser): void {
  insist(user.isOwner, 'Workspace owner required.', 403, 'owner_required');
}
/** Writes require exact same Origin (this Site's canonical origin). */
export function requireSameOrigin(request: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  insist(request.headers.get('origin') === new URL(request.url).origin, 'Same-origin request required.', 403, 'origin_mismatch');
}
/** Bounded streaming JSON reader: never buffers past `max` bytes; cancels the stream on overflow. */
export async function readJsonBody(request: Request, max = 100000): Promise<Row> {
  insist(request.headers.get('content-type')?.startsWith('application/json'), 'JSON is required.', 415, 'unsupported_media');
  const declared = request.headers.get('content-length');
  if (declared !== null) { const n = Number(declared); insist(Number.isFinite(n) && n >= 0 && n <= max, 'Request too large.', 413, 'too_large'); }
  insist(request.body, 'Object body required.', 400, 'invalid_body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { try { await reader.cancel(); } catch { /* ignore */ } throw new CollabError(413, 'too_large', 'Request too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total); let off = 0; for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
  let raw: string;
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new CollabError(400, 'invalid_utf8', 'Invalid UTF-8.'); }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new CollabError(400, 'invalid_json', 'Invalid JSON.'); }
  insist(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'Object body required.', 400, 'invalid_body');
  return parsed as Row;
}
export function boundedString(v: unknown, name: string, max = 4000): string {
  insist(typeof v === 'string' && v.trim().length > 0 && v.length <= max, `${name} must contain 1–${max} characters.`);
  return v.trim();
}
export async function companyExists(env: AtlasEnv, companyId: string): Promise<boolean> {
  const row = await env.DB!.prepare("SELECT snapshot FROM atlas_workspace WHERE id = 'owner'").first<Row>();
  if (!row) return false;
  try {
    const snap = JSON.parse(row.snapshot);
    return Array.isArray(snap?.companies) && snap.companies.some((c: Row) => c && c.id === companyId);
  } catch { return false; }
}
export type Membership = { id: string; companyId: string; role: 'viewer' | 'contributor' | 'owner'; expiresAt: string | null; aclRevision: number };
/** Current company membership only: workspace 'owner', active, unexpired, unrevoked. No hierarchy inheritance. Owner is implicit. */
export async function currentMembership(env: AtlasEnv, user: CollabUser, companyId: string): Promise<Membership | null> {
  if (!(await companyExists(env, companyId))) return null;
  if (user.isOwner) return { id: 'owner', companyId, role: 'owner', expiresAt: null, aclRevision: 0 };
  const m = await env.DB!.prepare("SELECT * FROM daftar_company_memberships WHERE workspace_id = 'owner' AND company_id = ? AND user_id = ? AND status = 'active' AND revoked_at IS NULL").bind(companyId, user.id).first<Row>();
  if (!m) return null;
  if (m.expires_at && !(Date.parse(m.expires_at) > Date.now())) return null;
  if (m.role !== 'viewer' && m.role !== 'contributor') return null;
  return { id: m.id, companyId, role: m.role, expiresAt: m.expires_at ?? null, aclRevision: m.acl_revision };
}
export async function requireMembership(env: AtlasEnv, user: CollabUser, companyId: string, needContributor = false): Promise<Membership> {
  const m = await currentMembership(env, user, companyId);
  insist(m, 'Company not found or access denied.', 404, 'not_found');
  if (needContributor) insist(m.role === 'contributor' || m.role === 'owner', 'Contributor role required.', 403, 'role_required');
  return m;
}
