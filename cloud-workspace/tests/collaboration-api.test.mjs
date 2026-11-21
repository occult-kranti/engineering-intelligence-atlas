import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { handleCollaborationApi } from '../lib/collaboration-api.ts';

const origin = 'https://atlas.example';
const T = '2026-01-01T00:00:00.000Z';
function database() {
  const db = new DatabaseSync(':memory:');
  for (const name of fs.readdirSync(new URL('../drizzle/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort()) db.exec(fs.readFileSync(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
  let queue = Promise.resolve();
  const hooks = { beforeBatch: null };
  const facade = {
    raw: db, hooks,
    prepare(sql) {
      let args = [];
      const s = {
        bind(...a) { args = a; return s; },
        async first() { return db.prepare(sql).get(...args) ?? null; },
        async all() { const results = db.prepare(sql).all(...args); return { results, meta: { changes: Number(db.prepare('SELECT changes() AS n').get().n) } }; },
        async run() { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
        _exec() { const st = db.prepare(sql); if (/^\s*(select|with)/i.test(sql)) { const results = st.all(...args); return { results, meta: { changes: 0 } }; } const r = st.run(...args); return { results: [], meta: { changes: Number(r.changes) } }; },
      };
      return s;
    },
    batch(statements) {
      const run = queue.then(async () => {
        if (hooks.beforeBatch) { const h = hooks.beforeBatch; hooks.beforeBatch = null; h(db); }
        db.exec('BEGIN');
        try { const out = []; for (const s of statements) out.push(s._exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
      });
      queue = run.catch(() => {});
      return run;
    },
  };
  return facade;
}
function snap() {
  return { companies: [{ id: 'c1', name: 'One' }, { id: 'c2', name: 'Two' }], offices: [], departments: [], employees: [], jobs: [], goals: [], portfolio: {} };
}
function setup() {
  const DB = database();
  DB.raw.prepare("INSERT INTO atlas_workspace (id,revision,snapshot,updated_at) VALUES ('owner',3,?,?)").run(JSON.stringify(snap()), T);
  const env = { DB, ATLAS_OWNER_EMAIL: 'owner@example.com' };
  const prev = globalThis.fetch; globalThis.fetch = () => { throw new Error('network forbidden'); };
  const call = async (path, who, method = 'GET', body, extra = {}) => {
    const headers = { 'content-type': 'application/json', ...(who ? { 'oai-authenticated-user-id': who.sub, 'oai-authenticated-user-email': who.email } : {}), ...(method !== 'GET' ? { origin } : {}), ...extra };
    const r = await handleCollaborationApi(new Request(origin + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
    return { status: r.status, body: await r.json() };
  };
  return { DB, env, call, restore: () => { globalThis.fetch = prev; } };
}
const owner = { sub: 'sub-owner', email: 'owner@example.com' };
const alice = { sub: 'sub-alice', email: 'alice@example.com' };
const bob = { sub: 'sub-bob', email: 'bob@example.com' };
const carol = { sub: 'sub-carol', email: 'carol@example.com' };
const events = (t, action) => t.DB.raw.prepare('SELECT COUNT(*) n FROM daftar_collaboration_events WHERE action=?').get(action).n;
const uid = (t, who) => t.DB.raw.prepare('SELECT id FROM daftar_users WHERE subject=?').get(who.sub).id;
async function invite(t, company, role, email) {
  const r = await t.call('/api/collaboration/companies/' + company + '/invitations', owner, 'POST', { role, intendedEmail: email, expiresAt: new Date(Date.now() + 3600e3).toISOString() });
  assert.equal(r.status, 201); return r.body.token;
}
async function join(t, who, company, role) {
  const tok = await invite(t, company, role, who.email);
  const r = await t.call('/api/collaboration/invitations/accept', who, 'POST', { token: tok });
  assert.equal(r.status, 201); return tok;
}
async function boot() { const t = setup(); await t.call('/api/collaboration/session', owner); return t; }

test('absent subject, wrong origin, legacy path, spoofed actor', async () => {
  const t = await boot();
  assert.equal((await t.call('/api/collaboration/session', null)).status, 401);
  const bad = await handleCollaborationApi(new Request(origin + '/api/collaboration/me', { method: 'PATCH', headers: { 'content-type': 'application/json', origin: 'https://evil.example', 'oai-authenticated-user-id': 'x' }, body: '{"displayName":"A"}' }), t.env);
  assert.equal(bad.status, 403);
  assert.equal((await t.call('/api/collaboration/other', alice)).status, 404);
  await join(t, alice, 'c1', 'contributor');
  const spoof = await t.call('/api/collaboration/companies/c1/proposals', alice, 'POST', { brief: 'Hello', idempotencyKey: 'k1', requesterUserId: 'x', actor: 'owner' });
  assert.equal(spoof.status, 201);
  assert.equal(spoof.body.proposal.requesterUserId, uid(t, alice));
  t.restore();
});

test('two companies, roles, private messages hidden', async () => {
  const t = await boot();
  await join(t, alice, 'c1', 'viewer'); await join(t, bob, 'c2', 'contributor');
  assert.equal((await t.call('/api/collaboration/companies/c2', alice)).status, 404);
  assert.equal((await t.call('/api/collaboration/companies/c1/messages', alice, 'POST', { content: 'hi' })).status, 403);
  assert.equal((await t.call('/api/collaboration/companies/c2/messages', bob, 'POST', { content: 'team note' })).status, 201);
  t.DB.raw.prepare("INSERT INTO daftar_member_messages (id,company_id,author_user_id,visibility,role,content,created_at) VALUES ('p1','c2',?,'private','user','PRIVATE',?)").run(uid(t, bob), T);
  const list = await t.call('/api/collaboration/companies/c2/messages', bob);
  assert.equal(JSON.stringify(list.body).includes('PRIVATE'), false);
  assert.equal((await t.call('/api/collaboration/invitations/accept', alice, 'POST', { token: 'z' })).status, 400);
  t.restore();
});

test('invite: wrong email, expiry, revoke, replay, other user', async () => {
  const t = await boot();
  const tok = await invite(t, 'c1', 'viewer', alice.email);
  assert.equal((await t.call('/api/collaboration/invitations/accept', bob, 'POST', { token: tok })).status, 403);
  assert.equal((await t.call('/api/collaboration/invitations/accept', alice, 'POST', { token: tok })).status, 201);
  const again = await t.call('/api/collaboration/invitations/accept', alice, 'POST', { token: tok });
  assert.equal(again.status, 200); assert.equal(again.body.replay, true);
  assert.equal((await t.call('/api/collaboration/invitations/accept', bob, 'POST', { token: tok })).status, 409);
  assert.equal(events(t, 'invitation.accept'), 1);
  const tok2 = await invite(t, 'c1', 'viewer', carol.email);
  t.DB.raw.prepare("UPDATE daftar_invitations SET expires_at=? WHERE status='pending'").run('2020-01-01T00:00:00.000Z');
  assert.equal((await t.call('/api/collaboration/invitations/accept', carol, 'POST', { token: tok2 })).status, 410);
  const tok3 = await invite(t, 'c1', 'viewer', carol.email);
  const inv = t.DB.raw.prepare('SELECT id FROM daftar_invitations WHERE status=\'pending\'').get();
  assert.equal((await t.call('/api/collaboration/invitations/' + inv.id, owner, 'DELETE')).status, 200);
  assert.equal((await t.call('/api/collaboration/invitations/accept', carol, 'POST', { token: tok3 })).status, 409);
  t.restore();
});

test('old invite cannot resurrect revoked membership; fresh invite can', async () => {
  const t = await boot();
  const tok = await join(t, alice, 'c1', 'contributor');
  const mid = t.DB.raw.prepare('SELECT id FROM daftar_company_memberships').get().id;
  assert.equal((await t.call('/api/collaboration/memberships/' + mid, owner, 'DELETE')).status, 200);
  assert.equal((await t.call('/api/collaboration/invitations/accept', alice, 'POST', { token: tok })).status, 409);
  assert.equal((await t.call('/api/collaboration/companies/c1', alice)).status, 404);
  await new Promise((r) => setTimeout(r, 5));
  const fresh = await invite(t, 'c1', 'viewer', alice.email);
  assert.equal((await t.call('/api/collaboration/invitations/accept', alice, 'POST', { token: fresh })).status, 201);
  assert.equal((await t.call('/api/collaboration/companies/c1', alice)).status, 200);
  t.restore();
});

test('revocation just before accept batch yields no membership and no accept audit', async () => {
  const t = await boot();
  await join(t, alice, 'c1', 'viewer');
  const mid = t.DB.raw.prepare('SELECT id FROM daftar_company_memberships').get().id;
  await t.call('/api/collaboration/memberships/' + mid, owner, 'DELETE');
  await new Promise((r) => setTimeout(r, 5));
  const tok = await invite(t, 'c1', 'viewer', alice.email);
  const before = events(t, 'invitation.accept');
  t.DB.hooks.beforeBatch = (db) => { db.prepare("UPDATE daftar_invitations SET status='revoked' WHERE status='pending'").run(); };
  const r = await t.call('/api/collaboration/invitations/accept', alice, 'POST', { token: tok });
  assert.equal(r.status, 409);
  assert.equal(events(t, 'invitation.accept'), before);
  assert.equal(t.DB.raw.prepare('SELECT status FROM daftar_company_memberships WHERE id=?').get(mid).status, 'revoked');
  t.restore();
});

test('concurrent accepters: one winner; two pending invites same member does not 500', async () => {
  const t = await boot();
  const tok = await invite(t, 'c1', 'viewer', null);
  await t.call('/api/collaboration/session', alice); await t.call('/api/collaboration/session', bob);
  const [a, b] = await Promise.all([t.call('/api/collaboration/invitations/accept', alice, 'POST', { token: tok }), t.call('/api/collaboration/invitations/accept', bob, 'POST', { token: tok })]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  assert.equal(events(t, 'invitation.accept'), 1);
  assert.equal(t.DB.raw.prepare('SELECT COUNT(*) n FROM daftar_company_memberships').get().n, 1);
  const t1 = await invite(t, 'c2', 'viewer', carol.email), t2 = await invite(t, 'c2', 'contributor', carol.email);
  const r1 = await t.call('/api/collaboration/invitations/accept', carol, 'POST', { token: t1 });
  const r2 = await t.call('/api/collaboration/invitations/accept', carol, 'POST', { token: t2 });
  assert.equal(r1.status, 201); assert.ok(r2.status < 500);
  assert.equal(t.DB.raw.prepare("SELECT COUNT(*) n FROM daftar_company_memberships WHERE company_id='c2'").get().n, 1);
  t.restore();
});

async function proposal(t, who, key = 'k') {
  const r = await t.call('/api/collaboration/companies/c1/proposals', who, 'POST', { brief: 'Brief ' + key, idempotencyKey: key });
  assert.equal(r.status, 201); return r.body.proposal.id;
}

test('claims: viewer denied, claim/unclaim, competing, revoked between preflight and write', async () => {
  const t = await boot();
  await join(t, alice, 'c1', 'contributor'); await join(t, bob, 'c1', 'contributor'); await join(t, carol, 'c1', 'viewer');
  const pid = await proposal(t, alice);
  assert.equal((await t.call('/api/collaboration/proposals/' + pid + '/claim', carol, 'POST', {})).status, 403);
  assert.equal((await t.call('/api/collaboration/proposals/' + pid + '/claim', alice, 'POST', {})).status, 200);
  assert.equal((await t.call('/api/collaboration/proposals/' + pid + '/claim', alice, 'POST', { unclaim: true })).status, 200);
  t.DB.hooks.beforeBatch = (db) => { db.prepare("UPDATE daftar_task_proposals SET assigned_user_id='someone-else' WHERE id=?").run(pid); };
  const before = events(t, 'proposal.claim');
  assert.equal((await t.call('/api/collaboration/proposals/' + pid + '/claim', bob, 'POST', {})).status, 409);
  assert.equal(events(t, 'proposal.claim'), before);
  t.DB.raw.prepare('UPDATE daftar_task_proposals SET assigned_user_id=NULL WHERE id=?').run(pid);
  const bid = uid(t, bob);
  t.DB.hooks.beforeBatch = (db) => { db.prepare("UPDATE daftar_company_memberships SET status='revoked',revoked_at=? WHERE user_id=?").run(new Date().toISOString(), bid); };
  assert.equal((await t.call('/api/collaboration/proposals/' + pid + '/claim', bob, 'POST', {})).status, 409);
  assert.equal(t.DB.raw.prepare('SELECT assigned_user_id a FROM daftar_task_proposals WHERE id=?').get(pid).a, null);
  assert.equal(events(t, 'proposal.claim'), before);
  t.restore();
});

test('owner assignment rejects disabled, revoked, expired assignees; accepts contributor', async () => {
  const t = await boot();
  await join(t, alice, 'c1', 'contributor'); await join(t, bob, 'c1', 'contributor'); await join(t, carol, 'c1', 'viewer');
  const pid = await proposal(t, alice);
  const assign = (u) => t.call('/api/collaboration/proposals/' + pid + '/claim', owner, 'POST', { assigneeUserId: u });
  assert.equal((await assign(uid(t, carol))).status, 409);
  t.DB.raw.prepare("UPDATE daftar_users SET status='disabled' WHERE id=?").run(uid(t, bob));
  assert.ok((await assign(uid(t, bob))).status >= 400);
  t.DB.raw.prepare("UPDATE daftar_users SET status='active' WHERE id=?").run(uid(t, bob));
  t.DB.raw.prepare('UPDATE daftar_company_memberships SET expires_at=? WHERE user_id=?').run('2020-01-01T00:00:00.000Z', uid(t, bob));
  assert.ok((await assign(uid(t, bob))).status >= 400);
  t.DB.raw.prepare("UPDATE daftar_company_memberships SET status='revoked',revoked_at=? WHERE user_id=?").run(T, uid(t, alice));
  assert.ok((await assign(uid(t, alice))).status >= 400);
  assert.equal(t.DB.raw.prepare('SELECT assigned_user_id a FROM daftar_task_proposals WHERE id=?').get(pid).a, null);
  assert.equal(events(t, 'proposal.claim'), 0);
  t.restore();
});

test('proposals: replay/conflict, one event, decide gating, fixed command once, nativeRef', async () => {
  const t = await boot();
  await join(t, alice, 'c1', 'contributor');
  const pid = await proposal(t, alice, 'same');
  const replay = await t.call('/api/collaboration/companies/c1/proposals', alice, 'POST', { brief: 'Brief same', idempotencyKey: 'same' });
  assert.equal(replay.body.replay, true);
  assert.equal((await t.call('/api/collaboration/companies/c1/proposals', alice, 'POST', { brief: 'Different', idempotencyKey: 'same' })).status, 409);
  assert.equal(events(t, 'proposal.create'), 1);
  assert.equal((await t.call('/api/collaboration/proposals/' + pid + '/decision', alice, 'POST', { decision: 'accept', expectedRevision: 3 })).status, 403);
  const ok = await t.call('/api/collaboration/proposals/' + pid + '/decision', owner, 'POST', { decision: 'accept', expectedRevision: 3, command: { action: 'evil' }, tools: ['x'] });
  assert.equal(ok.status, 202);
  const cmds = t.DB.raw.prepare('SELECT command FROM atlas_commands').all();
  assert.equal(cmds.length, 1);
  const c = JSON.parse(cmds[0].command);
  assert.equal(c.action, 'create_goal'); assert.equal(c.payload.mode, 'plan'); assert.equal(c.payload.maxIterations, 1);
  assert.equal((await t.call('/api/collaboration/proposals/' + pid + '/decision', owner, 'POST', { decision: 'accept', expectedRevision: 3 })).status, 409);
  assert.equal(events(t, 'proposal.accept'), 1);
  t.DB.raw.prepare('UPDATE daftar_task_proposals SET native_ref=? WHERE id=?').run('goal-123', pid);
  const list = await t.call('/api/collaboration/companies/c1/proposals', owner);
  assert.equal(list.body.proposals[0].nativeRef, 'goal-123');
  assert.equal(list.body.proposals[0].status, 'queued');
  t.restore();
});

test('decision: revision race, capacity race, removed company leave no false audit/command', async () => {
  const t = await boot();
  await join(t, alice, 'c1', 'contributor');
  const p1 = await proposal(t, alice, 'a'), p2 = await proposal(t, alice, 'b'), p3 = await proposal(t, alice, 'c');
  t.DB.hooks.beforeBatch = (db) => { db.prepare("UPDATE atlas_workspace SET revision=revision+1 WHERE id='owner'").run(); };
  assert.equal((await t.call('/api/collaboration/proposals/' + p1 + '/decision', owner, 'POST', { decision: 'accept', expectedRevision: 3 })).status, 409);
  assert.equal(t.DB.raw.prepare('SELECT COUNT(*) n FROM atlas_commands').get().n, 0);
  assert.equal(events(t, 'proposal.accept'), 0);
  assert.equal(t.DB.raw.prepare('SELECT status FROM daftar_task_proposals WHERE id=?').get(p1).status, 'proposed');
  t.DB.raw.prepare("UPDATE atlas_workspace SET revision=3 WHERE id='owner'").run();
  t.DB.hooks.beforeBatch = (db) => { const ins = db.prepare("INSERT INTO atlas_commands (id,idempotency_key,command,status,created_at,base_revision) VALUES (?,?,?,'queued',?,3)"); for (let i = 0; i < 1000; i++) ins.run('f' + i, 'fk' + i, '{}', T); };
  assert.equal((await t.call('/api/collaboration/proposals/' + p2 + '/decision', owner, 'POST', { decision: 'accept', expectedRevision: 3 })).status, 409);
  assert.equal(events(t, 'proposal.accept'), 0);
  t.DB.raw.prepare('DELETE FROM atlas_commands').run();
  t.DB.raw.prepare("UPDATE atlas_workspace SET snapshot=? WHERE id='owner'").run(JSON.stringify({ ...snap(), companies: [{ id: 'c2', name: 'Two' }] }));
  assert.equal((await t.call('/api/collaboration/proposals/' + p3 + '/decision', owner, 'POST', { decision: 'accept', expectedRevision: 3 })).status, 404);
  assert.equal(t.DB.raw.prepare('SELECT COUNT(*) n FROM atlas_commands').get().n, 0);
  assert.equal(events(t, 'proposal.accept'), 0);
  t.restore();
});

test('member write after revocation in-transaction is denied; owner snapshot unchanged', async () => {
  const t = await boot();
  await join(t, alice, 'c1', 'contributor');
  const before = t.DB.raw.prepare("SELECT revision,snapshot FROM atlas_workspace WHERE id='owner'").get();
  t.DB.hooks.beforeBatch = (db) => { db.prepare("UPDATE daftar_company_memberships SET status='revoked',revoked_at=?").run(new Date().toISOString()); };
  assert.equal((await t.call('/api/collaboration/companies/c1/messages', alice, 'POST', { content: 'late' })).status, 404);
  assert.equal(t.DB.raw.prepare('SELECT COUNT(*) n FROM daftar_member_messages').get().n, 0);
  assert.equal(events(t, 'message.post'), 0);
  const after = t.DB.raw.prepare("SELECT revision,snapshot FROM atlas_workspace WHERE id='owner'").get();
  assert.deepEqual(after, before);
  t.restore();
});
