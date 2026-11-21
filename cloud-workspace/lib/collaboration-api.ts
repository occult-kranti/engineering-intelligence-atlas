/** Collaboration API: /api/collaboration/*. Does not touch legacy owner authenticate(). No outbound network. */
import type { AtlasEnv } from './atlas-api.ts';
import { hasSecret } from './atlas-api.ts';
import { CollabError, insist, errorResponse, resolveUser, requireOwner, requireSameOrigin, readJsonBody, boundedString, requireMembership, currentMembership, companyExists, type CollabUser } from './collaboration-auth.ts';
import { authorizedCompanyView } from './collaboration-projection.ts';
type Row = Record<string, any>;
const enc = new TextEncoder();
const now = () => new Date().toISOString();
async function sha256(v: string): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(v)))].map((x) => x.toString(16).padStart(2, '0')).join(''); }
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } });
}
const ID = /^[A-Za-z0-9_.:-]{1,120}$/;
function idParam(v: string): string { const s = decodeURIComponent(v); insist(ID.test(s), 'Invalid identifier.', 400, 'bad_id'); return s; }
function event(env: AtlasEnv, actor: string, action: string, companyId: string | null, scopeId: string | null, summary: string, gateSql?: string, gateArgs: unknown[] = []) {
  const base = [crypto.randomUUID(), actor, action, companyId, scopeId, summary.slice(0, 900), now()];
  if (!gateSql) return env.DB!.prepare('INSERT INTO daftar_collaboration_events (id,actor_user_id,action,company_id,scope_id,summary,created_at) VALUES (?,?,?,?,?,?,?)').bind(...base);
  return env.DB!.prepare('INSERT INTO daftar_collaboration_events (id,actor_user_id,action,company_id,scope_id,summary,created_at) SELECT ?,?,?,?,?,?,? WHERE ' + gateSql).bind(...base, ...gateArgs);
}
const COMPANY_OK = "EXISTS (SELECT 1 FROM atlas_workspace w, json_each(json_extract(w.snapshot,'$.companies')) c WHERE w.id='owner' AND json_extract(c.value,'$.id') = ?)";
const ACTIVE_MEMBER_SQL = "EXISTS (SELECT 1 FROM daftar_company_memberships m JOIN daftar_users u ON u.id=m.user_id WHERE m.workspace_id='owner' AND m.company_id=? AND m.user_id=? AND m.status='active' AND m.revoked_at IS NULL AND m.role IN ('contributor') AND (m.expires_at IS NULL OR m.expires_at > ?) AND u.status='active')";
const ACTIVE_WRITER_SQL = "(EXISTS (SELECT 1 FROM daftar_workspace_owners o JOIN daftar_users u ON u.id=o.user_id WHERE o.workspace_id='owner' AND o.user_id=? AND u.status='active') OR " + ACTIVE_MEMBER_SQL + ')';
async function writerGuard(env: AtlasEnv, user: CollabUser, companyId: string): Promise<{ sql: string; args: unknown[] }> {
  return { sql: COMPANY_OK + ' AND ' + ACTIVE_WRITER_SQL, args: [companyId, user.id, companyId, user.id, now()] };
}
function safeEmail(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  insist(typeof v === 'string' && v.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email.');
  return v.trim().toLowerCase();
}
async function companiesList(env: AtlasEnv): Promise<Row[]> {
  const row = await env.DB!.prepare("SELECT snapshot FROM atlas_workspace WHERE id = 'owner'").first<Row>();
  if (!row) return [];
  try { const s = JSON.parse(row.snapshot); return Array.isArray(s?.companies) ? s.companies.filter((c: Row) => c && typeof c.id === 'string') : []; } catch { return []; }
}
async function session(env: AtlasEnv, user: CollabUser): Promise<Response> {
  const all = await companiesList(env);
  const out: Row[] = [];
  if (user.isOwner) {
    for (const c of all.slice(0, 200)) out.push({ id: c.id, name: String(c.name ?? '').slice(0, 200), role: 'owner', capabilities: ['read', 'write', 'invite', 'decide'] });
  } else {
    const rows = (await env.DB!.prepare("SELECT m.* FROM daftar_company_memberships m JOIN daftar_users u ON u.id=m.user_id WHERE m.workspace_id='owner' AND m.user_id=? AND m.status='active' AND m.revoked_at IS NULL AND m.role IN ('viewer','contributor') AND u.status='active'").bind(user.id).all<Row>()).results;
    for (const m of rows) {
      if (m.expires_at && !(Date.parse(m.expires_at) > Date.now())) continue;
      const c = all.find((x) => x.id === m.company_id); if (!c) continue;
      out.push({ id: c.id, name: String(c.name ?? '').slice(0, 200), role: m.role, expiresAt: m.expires_at ?? null, capabilities: m.role === 'contributor' ? ['read', 'write'] : ['read'] });
    }
  }
  const u = await env.DB!.prepare('SELECT display_name FROM daftar_users WHERE id=?').bind(user.id).first<Row>();
  return json({ ok: true, user: { id: user.id, displayName: u?.display_name ?? null, isOwner: user.isOwner }, companies: out });
}
async function companyMembers(env: AtlasEnv, user: CollabUser, companyId: string): Promise<Response> {
  await requireMembership(env, user, companyId);
  const rows = (await env.DB!.prepare("SELECT m.id,m.user_id,m.role,m.expires_at,u.display_name,u.email FROM daftar_company_memberships m JOIN daftar_users u ON u.id=m.user_id WHERE m.workspace_id='owner' AND m.company_id=? AND m.status='active' AND m.revoked_at IS NULL AND u.status='active' AND m.role IN ('viewer','contributor') ORDER BY m.created_at,m.id LIMIT 200").bind(companyId).all<Row>()).results;
  const live = rows.filter((m) => !m.expires_at || Date.parse(m.expires_at) > Date.now());
  const owner = await env.DB!.prepare("SELECT u.id,u.display_name,u.email FROM daftar_workspace_owners o JOIN daftar_users u ON u.id=o.user_id WHERE o.workspace_id='owner'").first<Row>();
  type HumanDto = { membershipId: string; userId: string; displayName: string; role: string; expiresAt: string | null; email?: string | null };
  const humans: HumanDto[] = live.map((m): HumanDto => ({ membershipId: m.id, userId: m.user_id, displayName: m.display_name ?? 'Member', role: m.role, expiresAt: m.expires_at ?? null, ...(user.isOwner ? { email: m.email ?? null } : {}) }));
  if (owner) humans.unshift({ membershipId: 'owner', userId: owner.id, displayName: owner.display_name ?? 'Owner', role: 'owner', expiresAt: null, ...(user.isOwner ? { email: owner.email ?? null } : {}) });
  return json({ ok: true, humans, note: 'Human company ownership; AI employees are listed separately in the company view.' });
}
async function createInvitation(env: AtlasEnv, user: CollabUser, companyId: string, request: Request): Promise<Response> {
  requireOwner(user);
  insist(await companyExists(env, companyId), 'Company not found.', 404, 'not_found');
  const b = await readJsonBody(request, 4000);
  insist(b.role === 'viewer' || b.role === 'contributor', 'Role must be viewer or contributor.');
  const intended = safeEmail(b.intendedEmail);
  const exp = typeof b.expiresAt === 'string' ? Date.parse(b.expiresAt) : NaN;
  insist(Number.isFinite(exp) && exp > Date.now() + 60000 && exp <= Date.now() + 30 * 86400000, 'Expiry must be 1 minute to 30 days ahead.');
  const pending = await env.DB!.prepare("SELECT COUNT(*) n FROM daftar_invitations WHERE company_id=? AND status='pending'").bind(companyId).first<Row>();
  insist((pending?.n ?? 0) < 100, 'Too many pending invitations.', 429, 'capacity');
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((n) => n.toString(16).padStart(2, '0')).join('');
  const id = crypto.randomUUID(); const exps = new Date(exp).toISOString();
  const admit = "(SELECT COUNT(*) FROM daftar_invitations WHERE company_id=? AND status='pending') < 100 AND " + COMPANY_OK + " AND EXISTS (SELECT 1 FROM daftar_workspace_owners o JOIN daftar_users u ON u.id=o.user_id WHERE o.workspace_id='owner' AND o.user_id=? AND u.status='active')";
  const admitArgs = [companyId, companyId, user.id];
  const createResults = await env.DB!.batch([
    env.DB!.prepare("INSERT INTO daftar_invitations (id,company_id,role,token_digest,intended_email,invited_by_user_id,status,expires_at,created_at) SELECT ?,?,?,?,?,?,'pending',?,? WHERE " + admit).bind(id, companyId, b.role, await sha256(token), intended, user.id, exps, now(), ...admitArgs),
    event(env, user.id, 'invitation.create', companyId, id, `Created ${b.role} invitation`, "changes() = 1 AND EXISTS (SELECT 1 FROM daftar_invitations WHERE id=? AND status='pending')", [id]),
  ]);
  if ((createResults[0].meta?.changes ?? 0) !== 1) throw new CollabError('Invitation capacity reached or company unavailable.', 429, 'capacity');
  return json({ ok: true, invitation: { id, companyId, role: b.role, intendedEmail: intended, expiresAt: exps }, token, joinPath: `/join#invite=${token}`, shownOnce: true, siteAccessNote: 'The invitee must also be granted access to this Site through its custom-access settings; no bypass token is provided.' }, 201);
}
async function listInvitations(env: AtlasEnv, user: CollabUser, companyId: string): Promise<Response> {
  requireOwner(user);
  const rows = (await env.DB!.prepare('SELECT id,role,intended_email,status,expires_at,accepted_by_user_id,accepted_at,created_at FROM daftar_invitations WHERE company_id=? ORDER BY created_at DESC,id LIMIT 200').bind(companyId).all<Row>()).results;
  return json({ ok: true, invitations: rows.map((r) => ({ id: r.id, role: r.role, intendedEmail: r.intended_email, status: r.status, expiresAt: r.expires_at, acceptedAt: r.accepted_at, createdAt: r.created_at })) });
}
async function revokeInvitation(env: AtlasEnv, user: CollabUser, id: string): Promise<Response> {
  requireOwner(user);
  const inv = await env.DB!.prepare('SELECT company_id FROM daftar_invitations WHERE id=?').bind(id).first<Row>();
  insist(inv, 'Invitation not found.', 404, 'not_found');
  const [r] = await env.DB!.batch([
    env.DB!.prepare("UPDATE daftar_invitations SET status='revoked' WHERE id=? AND status='pending'").bind(id),
    event(env, user.id, 'invitation.revoke', inv.company_id, id, 'Revoked invitation', "changes() = 1 AND EXISTS (SELECT 1 FROM daftar_invitations WHERE id=? AND status='revoked')", [id]),
  ]);
  return json({ ok: true, revoked: (r.meta?.changes ?? 0) === 1 });
}
async function acceptInvitation(env: AtlasEnv, user: CollabUser, request: Request): Promise<Response> {
  const b = await readJsonBody(request, 2000);
  insist(typeof b.token === 'string' && /^[a-f0-9]{64}$/.test(b.token), 'Invalid invitation.', 400, 'invalid_invitation');
  const inv = await env.DB!.prepare('SELECT * FROM daftar_invitations WHERE token_digest=?').bind(await sha256(b.token)).first<Row>();
  insist(inv, 'Invitation is not valid.', 404, 'invalid_invitation');
  if (inv.status === 'accepted') {
    insist(inv.accepted_by_user_id === user.id, 'Invitation is not valid.', 409, 'invalid_invitation');
    const cur = await currentMembership(env, user, inv.company_id);
    insist(cur && cur.role !== 'owner', 'Invitation is not valid.', 409, 'invalid_invitation');
    return json({ ok: true, replay: true, membership: { companyId: inv.company_id, role: cur.role, expiresAt: cur.expiresAt } });
  }
  const existing = await env.DB!.prepare("SELECT * FROM daftar_company_memberships WHERE workspace_id='owner' AND company_id=? AND user_id=?").bind(inv.company_id, user.id).first<Row>();
  insist(inv.status === 'pending', 'Invitation is not valid.', 409, 'invalid_invitation');
  insist(Date.parse(inv.expires_at) > Date.now(), 'Invitation expired.', 410, 'expired');
  if (inv.intended_email) insist(user.email && user.email.toLowerCase() === String(inv.intended_email).toLowerCase(), 'Invitation is for a different account.', 403, 'wrong_email');
  insist(await companyExists(env, inv.company_id), 'Company not found.', 404, 'not_found');
  insist(inv.role === 'viewer' || inv.role === 'contributor', 'Invitation is not valid.', 409, 'invalid_invitation');
  if (existing && existing.revoked_at) insist(Date.parse(inv.created_at) > Date.parse(existing.revoked_at), 'This invitation predates a revoked membership; ask the owner for a new one.', 403, 'predates_revocation');
  const stamp = now();
  const mid = existing?.id ?? crypto.randomUUID();
  const exRev = existing ? existing.acl_revision : null;
  const exRevoked = existing ? existing.revoked_at ?? null : null;
  // Shared admission gate evaluated BEFORE the consume statement in the same transaction.
  const gate = "EXISTS (SELECT 1 FROM daftar_invitations i WHERE i.id=? AND i.status='pending' AND i.expires_at > ? AND (i.intended_email IS NULL OR lower(i.intended_email)=lower(?))) AND EXISTS (SELECT 1 FROM daftar_users u WHERE u.id=? AND u.status='active') AND EXISTS (SELECT 1 FROM daftar_workspace_owners o JOIN daftar_users ou ON ou.id=o.user_id WHERE o.workspace_id='owner' AND ou.status='active') AND " + COMPANY_OK;
  const gateArgs = [inv.id, stamp, user.email ?? '', user.id, inv.company_id];
  const membershipStmt = existing
    ? env.DB!.prepare("UPDATE daftar_company_memberships SET role=?,status='active',revoked_at=NULL,revoked_by_user_id=NULL,expires_at=?,acl_revision=acl_revision+1,granted_by_user_id=?,updated_at=? WHERE id=? AND acl_revision=? AND COALESCE(revoked_at,'')=COALESCE(?,'') AND (revoked_at IS NULL OR revoked_at < (SELECT created_at FROM daftar_invitations WHERE id=?)) AND " + gate).bind(inv.role, inv.expires_at, inv.invited_by_user_id, stamp, mid, exRev, exRevoked, inv.id, ...gateArgs)
    : env.DB!.prepare("INSERT INTO daftar_company_memberships (id,workspace_id,company_id,user_id,role,status,expires_at,acl_revision,granted_by_user_id,created_at,updated_at) SELECT ?,'owner',?,?,?,'active',?,1,?,?,? WHERE NOT EXISTS (SELECT 1 FROM daftar_company_memberships WHERE workspace_id='owner' AND company_id=? AND user_id=?) AND " + gate).bind(mid, inv.company_id, user.id, inv.role, inv.expires_at, inv.invited_by_user_id, stamp, stamp, inv.company_id, user.id, ...gateArgs);
  // Consume only if the immediately preceding statement in this transaction changed exactly one membership row.
  let results: any[];
  try {
    results = await env.DB!.batch([
      membershipStmt,
      env.DB!.prepare("UPDATE daftar_invitations SET status='accepted',accepted_by_user_id=?,accepted_at=? WHERE id=? AND status='pending' AND expires_at > ? AND changes() = 1 AND EXISTS (SELECT 1 FROM daftar_company_memberships WHERE workspace_id='owner' AND id=? AND company_id=? AND user_id=? AND status='active' AND revoked_at IS NULL)").bind(user.id, stamp, inv.id, stamp, mid, inv.company_id, user.id),
      event(env, user.id, 'invitation.accept', inv.company_id, inv.id, `Accepted ${inv.role} invitation granted by ${inv.invited_by_user_id}`, "changes() = 1", []),
    ]);
  } catch (e) {
    const again = await env.DB!.prepare('SELECT status,accepted_by_user_id FROM daftar_invitations WHERE id=?').bind(inv.id).first<Row>();
    if (again && again.status === 'accepted' && again.accepted_by_user_id === user.id) {
      const cur = await currentMembership(env, user, inv.company_id);
      if (cur && cur.role !== 'owner') return json({ ok: true, replay: true, membership: { companyId: inv.company_id, role: cur.role, expiresAt: cur.expiresAt } });
    }
    throw new CollabError(409, 'invitation_conflict', 'Invitation could not be accepted; retry.');
  }
  if ((results[0].meta?.changes ?? 0) !== 1 || (results[1].meta?.changes ?? 0) !== 1) {
    // No compensating write: a losing attempt leaves state untouched (membership CAS lost or admission failed).
    const after = await env.DB!.prepare('SELECT status,accepted_by_user_id FROM daftar_invitations WHERE id=?').bind(inv.id).first<Row>();
    if (after && after.status === 'accepted' && after.accepted_by_user_id === user.id) {
      const cur = await currentMembership(env, user, inv.company_id);
      if (cur && cur.role !== 'owner') return json({ ok: true, replay: true, membership: { companyId: inv.company_id, role: cur.role, expiresAt: cur.expiresAt } });
    }
    throw new CollabError(409, 'invalid_invitation', 'Invitation is not valid.');
  }
  return json({ ok: true, membership: { companyId: inv.company_id, role: inv.role, expiresAt: inv.expires_at } }, 201);
}
async function revokeMembership(env: AtlasEnv, user: CollabUser, id: string): Promise<Response> {
  requireOwner(user);
  const m = await env.DB!.prepare("SELECT * FROM daftar_company_memberships WHERE id=? AND workspace_id='owner'").bind(id).first<Row>();
  insist(m, 'Membership not found.', 404, 'not_found');
  const stamp = now();
  const results = await env.DB!.batch([
    env.DB!.prepare("UPDATE daftar_company_memberships SET status='revoked',revoked_at=?,revoked_by_user_id=?,acl_revision=acl_revision+1,updated_at=? WHERE id=? AND workspace_id='owner' AND status='active'").bind(stamp, user.id, stamp, id),
    event(env, user.id, 'membership.revoke', m.company_id, id, `Revoked membership of ${m.user_id}`, "changes() = 1 AND EXISTS (SELECT 1 FROM daftar_company_memberships WHERE id=? AND workspace_id='owner' AND status='revoked' AND revoked_at=?)", [id, stamp]),
    env.DB!.prepare("UPDATE daftar_resource_grants SET revoked_at=? WHERE (beneficiary_user_id=? OR owner_user_id=?) AND company_id=? AND revoked_at IS NULL AND EXISTS (SELECT 1 FROM daftar_company_memberships WHERE id=? AND workspace_id='owner' AND status='revoked' AND revoked_at=?)").bind(stamp, m.user_id, m.user_id, m.company_id, id, stamp),
    env.DB!.prepare("UPDATE daftar_task_proposals SET assigned_user_id=NULL WHERE company_id=? AND assigned_user_id=? AND status='proposed' AND EXISTS (SELECT 1 FROM daftar_company_memberships WHERE id=? AND workspace_id='owner' AND status='revoked' AND revoked_at=?)").bind(m.company_id, m.user_id, id, stamp),
  ]);
  return json({ ok: true, revoked: (results[0].meta?.changes ?? 0) === 1 });
}
function credentialLike(s: string): boolean { return hasSecret(s) || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s) || /\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S{8,}/i.test(s); }
async function listMessages(env: AtlasEnv, user: CollabUser, companyId: string, url: URL): Promise<Response> {
  await requireMembership(env, user, companyId);
  const cursor = url.searchParams.get('cursor') ?? '';
  let stamp = '', cid = '';
  if (cursor) { const i = cursor.indexOf('|'); stamp = cursor.slice(0, i); cid = cursor.slice(i + 1); insist(i > 0 && Number.isFinite(Date.parse(stamp)) && ID.test(cid), 'Invalid cursor.'); }
  const rows = (await env.DB!.prepare("SELECT m.id,m.author_user_id,m.content,m.created_at,u.display_name FROM daftar_member_messages m LEFT JOIN daftar_users u ON u.id=m.author_user_id WHERE m.company_id=? AND m.visibility='company' AND (?='' OR m.created_at > ? OR (m.created_at = ? AND m.id > ?)) ORDER BY m.created_at,m.id LIMIT 51").bind(companyId, stamp, stamp, stamp, cid).all<Row>()).results;
  const page = rows.slice(0, 50); const last = page.at(-1);
  return json({ ok: true, messages: page.map((r) => ({ id: r.id, authorUserId: r.author_user_id, authorName: r.display_name ?? 'Member', content: r.content, createdAt: r.created_at })), nextCursor: rows.length > 50 && last ? `${last.created_at}|${last.id}` : null });
}
async function postMessage(env: AtlasEnv, user: CollabUser, companyId: string, request: Request): Promise<Response> {
  await requireMembership(env, user, companyId, true);
  const b = await readJsonBody(request, 20000);
  const content = boundedString(b.content, 'content', 4000);
  insist(!credentialLike(content), 'Remove credentials from the message.', 400, 'credential_like');
  const id = crypto.randomUUID(); const stamp = now();
  const g = await writerGuard(env, user, companyId);
  const [ins] = await env.DB!.batch([
    env.DB!.prepare("INSERT INTO daftar_member_messages (id,company_id,author_user_id,visibility,role,content,created_at) SELECT ?,?,?,'company','user',?,? WHERE " + g.sql).bind(id, companyId, user.id, content, stamp, ...g.args),
    event(env, user.id, 'message.post', companyId, id, 'Posted company message', 'EXISTS (SELECT 1 FROM daftar_member_messages WHERE id=?)', [id]),
  ]);
  insist((ins.meta?.changes ?? 0) === 1, 'Company not found or access denied.', 404, 'not_found');
  return json({ ok: true, message: { id, authorUserId: user.id, content, createdAt: stamp } }, 201);
}
function safeLinks(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  insist(Array.isArray(v) && v.length <= 5, 'At most 5 evidence links.');
  return v.map((x) => {
    insist(typeof x === 'string' && x.length <= 500, 'Invalid evidence link.');
    let u: URL; try { u = new URL(x); } catch { throw new CollabError(400, 'bad_request', 'Invalid evidence link.'); }
    insist(u.protocol === 'https:' && !u.username && !u.password && !u.hash && !/token|key|secret|password|signature/i.test(u.search) && !credentialLike(x), 'Evidence links must be safe HTTPS URLs.');
    return u.toString();
  });
}
function proposalDto(r: Row): Row { let links: string[] = []; try { links = r.evidence_links ? JSON.parse(r.evidence_links) : []; } catch { /* ignore */ } return { id: r.id, requesterUserId: r.requester_user_id, assignedUserId: r.assigned_user_id ?? null, brief: r.brief, evidenceLinks: links, status: r.status, queuedCommandId: r.queued_command_id ?? null, nativeRef: typeof r.native_ref === 'string' && r.native_ref.length <= 200 ? r.native_ref : null, createdAt: r.created_at, decidedAt: r.decided_at ?? null }; }
async function listProposals(env: AtlasEnv, user: CollabUser, companyId: string): Promise<Response> {
  await requireMembership(env, user, companyId);
  const rows = (await env.DB!.prepare('SELECT * FROM daftar_task_proposals WHERE company_id=? ORDER BY created_at DESC,id LIMIT 100').bind(companyId).all<Row>()).results;
  return json({ ok: true, proposals: rows.map(proposalDto) });
}
async function createProposal(env: AtlasEnv, user: CollabUser, companyId: string, request: Request): Promise<Response> {
  await requireMembership(env, user, companyId, true);
  const b = await readJsonBody(request, 20000);
  const brief = boundedString(b.brief, 'brief', 4000);
  insist(!credentialLike(brief), 'Remove credentials from the brief.', 400, 'credential_like');
  const links = safeLinks(b.evidenceLinks);
  const key = boundedString(b.idempotencyKey, 'idempotencyKey', 100); insist(ID.test(key), 'Invalid idempotency key.');
  const hash = await sha256(JSON.stringify({ companyId, brief, links }));
  const id = 'prop-' + (await sha256(`${user.id}|${companyId}|${key}`)).slice(0, 40);
  const prior = await env.DB!.prepare('SELECT * FROM daftar_task_proposals WHERE id=?').bind(id).first<Row>();
  if (prior) { insist(prior.source_hash === hash, 'Idempotency key conflicts with different content.', 409, 'conflict'); return json({ ok: true, replay: true, proposal: proposalDto(prior) }); }
  const pending = await env.DB!.prepare("SELECT COUNT(*) n FROM daftar_task_proposals WHERE company_id=? AND status='proposed'").bind(companyId).first<Row>();
  insist((pending?.n ?? 0) < 500, 'Too many open proposals.', 429, 'capacity');
  const g = await writerGuard(env, user, companyId);
  const stampP = now();
  const [pins] = await env.DB!.batch([
    env.DB!.prepare("INSERT OR IGNORE INTO daftar_task_proposals (id,company_id,requester_user_id,brief,source_hash,evidence_links,status,created_at) SELECT ?,?,?,?,?,?,'proposed',? WHERE " + g.sql).bind(id, companyId, user.id, brief, hash, JSON.stringify(links), stampP, ...g.args),
    event(env, user.id, 'proposal.create', companyId, id, 'Submitted task proposal', 'EXISTS (SELECT 1 FROM daftar_task_proposals WHERE id=? AND created_at=? AND requester_user_id=?)', [id, stampP, user.id]),
  ]);
  const row = await env.DB!.prepare('SELECT * FROM daftar_task_proposals WHERE id=?').bind(id).first<Row>();
  insist(row || (pins.meta?.changes ?? 0) === 1, 'Company not found or access denied.', 404, 'not_found');
  insist(row && row.source_hash === hash, 'Idempotency key conflicts with different content.', 409, 'conflict');
  return json({ ok: true, proposal: proposalDto(row) }, 201);
}
async function claimProposal(env: AtlasEnv, user: CollabUser, id: string, request: Request): Promise<Response> {
  const p = await env.DB!.prepare('SELECT * FROM daftar_task_proposals WHERE id=?').bind(id).first<Row>();
  insist(p, 'Proposal not found.', 404, 'not_found');
  const m = await requireMembership(env, user, p.company_id, true);
  const b = await readJsonBody(request, 2000);
  insist(p.status === 'proposed', 'Proposal is no longer open.', 409, 'closed');
  let target: string | null; let expectedAssignee: string | null = p.assigned_user_id ?? null;
  if (b.assigneeUserId !== undefined && b.assigneeUserId !== user.id) {
    insist(m.role === 'owner', 'Only the owner can assign others.', 403, 'owner_required');
    if (b.assigneeUserId === null) target = null;
    else {
      insist(typeof b.assigneeUserId === 'string' && ID.test(b.assigneeUserId), 'Invalid assignee.');
      const au = await env.DB!.prepare("SELECT id FROM daftar_users WHERE id=? AND status='active'").bind(b.assigneeUserId).first<Row>();
      insist(au, 'Assignee not found.', 404, 'not_found');
      target = b.assigneeUserId;
    }
  } else if (b.unclaim === true) {
    insist(expectedAssignee === user.id || m.role === 'owner', 'Cannot unclaim another member.', 403, 'forbidden');
    target = null;
  } else {
    insist(expectedAssignee === null || expectedAssignee === user.id, 'Already claimed.', 409, 'claimed');
    target = user.id;
  }
  const g = await writerGuard(env, user, p.company_id);
  const tgtSql = target === null ? '1=1' : "(EXISTS (SELECT 1 FROM daftar_workspace_owners o JOIN daftar_users u ON u.id=o.user_id WHERE o.workspace_id='owner' AND o.user_id=? AND u.status='active') OR " + ACTIVE_MEMBER_SQL + ')';
  const tgtArgs = target === null ? [] : [target, p.company_id, target, now()];
  const stampC = now();
  const [r] = await env.DB!.batch([
    env.DB!.prepare("UPDATE daftar_task_proposals SET assigned_user_id=? WHERE id=? AND status='proposed' AND COALESCE(assigned_user_id,'')=COALESCE(?,'') AND " + g.sql + ' AND ' + tgtSql).bind(target, id, expectedAssignee, ...g.args, ...tgtArgs),
    event(env, user.id, 'proposal.claim', p.company_id, id, target ? `Assigned to ${target}` : 'Unassigned', "EXISTS (SELECT 1 FROM daftar_task_proposals WHERE id=? AND status='proposed' AND COALESCE(assigned_user_id,'')=COALESCE(?,'')) AND changes() = 1", [id, target]),
  ]);
  void stampC;
  insist((r.meta?.changes ?? 0) === 1, 'Proposal was claimed by someone else or access changed.', 409, 'claimed');
  return json({ ok: true, assignedUserId: target });
}
async function decideProposal(env: AtlasEnv, user: CollabUser, id: string, request: Request): Promise<Response> {
  requireOwner(user);
  const b = await readJsonBody(request, 2000);
  insist(b.decision === 'accept' || b.decision === 'reject', 'Decision must be accept or reject.');
  const p = await env.DB!.prepare('SELECT * FROM daftar_task_proposals WHERE id=?').bind(id).first<Row>();
  insist(p, 'Proposal not found.', 404, 'not_found');
  insist(p.status === 'proposed', 'Proposal already decided.', 409, 'closed');
  const stamp = now();
  if (b.decision === 'reject') {
    const [r] = await env.DB!.batch([
      env.DB!.prepare("UPDATE daftar_task_proposals SET status='rejected',approver_user_id=?,decided_at=? WHERE id=? AND status='proposed'").bind(user.id, stamp, id),
      event(env, user.id, 'proposal.reject', p.company_id, id, 'Rejected proposal', "EXISTS (SELECT 1 FROM daftar_task_proposals WHERE id=? AND status='rejected' AND decided_at=? AND approver_user_id=?)", [id, stamp, user.id]),
    ]);
    insist((r.meta?.changes ?? 0) === 1, 'Proposal already decided.', 409, 'closed');
    return json({ ok: true, status: 'rejected' });
  }
  const ws = await env.DB!.prepare("SELECT revision FROM atlas_workspace WHERE id='owner'").first<Row>();
  insist(ws, 'Workspace has not been synced.', 409, 'no_workspace');
  insist(Number.isSafeInteger(b.expectedRevision) && b.expectedRevision === ws.revision, 'Workspace revision changed; refresh before accepting.', 409, 'revision');
  insist(await companyExists(env, p.company_id), 'Company not found.', 404, 'not_found');
  const title = p.brief.split(/\r?\n/)[0].slice(0, 200) || 'Proposal';
  const command = { action: 'create_goal', payload: { scope: { kind: 'company', id: p.company_id }, title, description: p.brief.slice(0, 4000), mode: 'plan', maxIterations: 1 } };
  const cid = crypto.randomUUID(); const key = 'proposal-accept-' + id;
  const results = await env.DB!.batch([
    env.DB!.prepare("INSERT INTO atlas_commands (id,idempotency_key,command,status,created_at,base_revision) SELECT ?,?,?,'queued',?,? WHERE (SELECT COUNT(*) FROM atlas_commands WHERE status='queued') < 1000 AND (SELECT revision FROM atlas_workspace WHERE id='owner') = ? AND EXISTS (SELECT 1 FROM daftar_task_proposals WHERE id=? AND status='proposed') AND " + COMPANY_OK).bind(cid, key, JSON.stringify(command), stamp, ws.revision, ws.revision, id, p.company_id),
    env.DB!.prepare("UPDATE daftar_task_proposals SET status='queued',queued_command_id=?,approver_user_id=?,decided_at=? WHERE id=? AND status='proposed' AND EXISTS (SELECT 1 FROM atlas_commands WHERE id=?)").bind(cid, user.id, stamp, id, cid),
    event(env, user.id, 'proposal.accept', p.company_id, id, 'Accepted proposal; queued fixed plan-only create_goal for desktop', "EXISTS (SELECT 1 FROM daftar_task_proposals WHERE id=? AND status='queued' AND queued_command_id=? AND decided_at=?)", [id, cid, stamp]),
  ]);
  insist((results[0].meta?.changes ?? 0) === 1 && (results[1].meta?.changes ?? 0) === 1, 'Queue admission changed or proposal already decided.', 409, 'conflict');
  return json({ ok: true, status: 'queued', commandId: cid, note: 'Awaiting desktop; no native goal exists yet.' }, 202);
}
async function patchMe(env: AtlasEnv, user: CollabUser, request: Request): Promise<Response> {
  const b = await readJsonBody(request, 2000);
  const name = boundedString(b.displayName, 'displayName', 100);
  insist(!credentialLike(name), 'Invalid display name.');
  await env.DB!.batch([env.DB!.prepare('UPDATE daftar_users SET display_name=?,updated_at=? WHERE id=?').bind(name, now(), user.id), event(env, user.id, 'user.rename', null, user.id, 'Updated display name')]);
  return json({ ok: true, displayName: name });
}
export async function handleCollaborationApi(request: Request, env: AtlasEnv): Promise<Response> {
  try {
    requireSameOrigin(request);
    const user = await resolveUser(request, env);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const m = request.method;
    let x: RegExpMatchArray | null;
    if (path === '/api/collaboration/session' && m === 'GET') return await session(env, user);
    if (path === '/api/collaboration/me' && m === 'PATCH') return await patchMe(env, user, request);
    if (path === '/api/collaboration/invitations/accept' && m === 'POST') return await acceptInvitation(env, user, request);
    if ((x = path.match(/^\/api\/collaboration\/invitations\/([^/]+)$/)) && m === 'DELETE') return await revokeInvitation(env, user, idParam(x[1]));
    if ((x = path.match(/^\/api\/collaboration\/memberships\/([^/]+)$/)) && m === 'DELETE') return await revokeMembership(env, user, idParam(x[1]));
    if ((x = path.match(/^\/api\/collaboration\/proposals\/([^/]+)\/claim$/)) && m === 'POST') return await claimProposal(env, user, idParam(x[1]), request);
    if ((x = path.match(/^\/api\/collaboration\/proposals\/([^/]+)\/decision$/)) && m === 'POST') return await decideProposal(env, user, idParam(x[1]), request);
    if ((x = path.match(/^\/api\/collaboration\/companies\/([^/]+)(?:\/(members|invitations|messages|proposals))?$/))) {
      const cid = idParam(x[1]); const sub = x[2];
      if (!sub && m === 'GET') return json({ ok: true, ...(await authorizedCompanyView(env, user, cid)) });
      if (sub === 'members' && m === 'GET') return await companyMembers(env, user, cid);
      if (sub === 'invitations' && m === 'POST') return await createInvitation(env, user, cid, request);
      if (sub === 'invitations' && m === 'GET') return await listInvitations(env, user, cid);
      if (sub === 'messages' && m === 'GET') return await listMessages(env, user, cid, url);
      if (sub === 'messages' && m === 'POST') return await postMessage(env, user, cid, request);
      if (sub === 'proposals' && m === 'GET') return await listProposals(env, user, cid);
      if (sub === 'proposals' && m === 'POST') return await createProposal(env, user, cid, request);
    }
    throw new CollabError(404, 'not_found', 'Endpoint not found.');
  } catch (error) {
    return errorResponse(error);
  }
}
