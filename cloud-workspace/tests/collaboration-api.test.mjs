import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { handleCollaborationApi } from '../lib/collaboration-api.ts';
import { handleAtlasApi } from '../lib/atlas-api.ts';

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

// Deterministic race helpers: freeze the clock and hold the first two matching reads until both have captured their row.
function freezeClock() {
  const RealDate = globalThis.Date; const clock = RealDate.now();
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [clock])); } static now() { return clock; } };
  return () => { globalThis.Date = RealDate; };
}
function readBarrier(t, match) {
  const realPrepare = t.DB.prepare.bind(t.DB);
  const state = { seen: 0 }; let release; const both = new Promise((r) => { release = r; });
  t.DB.prepare = (sql) => {
    const stmt = realPrepare(sql);
    if (match(sql)) {
      const first = stmt.first.bind(stmt);
      stmt.first = async () => { const row = await first(); state.seen++; if (state.seen === 2) release(); if (state.seen <= 2) await both; return row; };
    }
    return stmt;
  };
  return { state, restore: () => { t.DB.prepare = realPrepare; } };
}
const MEMBERSHIP_READ = "SELECT * FROM daftar_company_memberships WHERE workspace_id='owner' AND company_id=? AND user_id=?";
const PROPOSAL_READ = 'SELECT * FROM daftar_task_proposals WHERE id=?';

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
  t.DB.raw.prepare("INSERT INTO daftar_member_messages (id,company_id,author_user_id,visibility,role,content,created_at) VALUES ('p1','c2',?,'personal','user','PRIVATE',?)").run(uid(t, bob), T);
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
  const r3 = await t.call('/api/collaboration/companies/c1/invitations', owner, 'POST', { role: 'viewer', intendedEmail: carol.email, expiresAt: new Date(Date.now() + 3600e3).toISOString() });
  assert.equal(r3.status, 201);
  const tok3 = r3.body.token;
  assert.equal((await t.call('/api/collaboration/invitations/' + r3.body.invitation.id, owner, 'DELETE')).status, 200);
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

test('membership revoked between precheck and accept batch: no accept event, state preserved, invite pending', async () => {
  const t = await boot();
  await join(t, alice, 'c1', 'viewer');
  const m = t.DB.raw.prepare('SELECT id FROM daftar_company_memberships').get();
  const tok = await invite(t, 'c1', 'contributor', alice.email);
  const before = events(t, 'invitation.accept');
  const rev0 = t.DB.raw.prepare('SELECT acl_revision r FROM daftar_company_memberships WHERE id=?').get(m.id).r;
  let intercepted = false;
  t.DB.hooks.beforeBatch = (db) => { intercepted = true; db.prepare("UPDATE daftar_company_memberships SET status='revoked',revoked_at=?,acl_revision=acl_revision+1 WHERE id=?").run(new Date(Date.now() + 1000).toISOString(), m.id); };
  const r = await t.call('/api/collaboration/invitations/accept', alice, 'POST', { token: tok });
  assert.equal(intercepted, true);
  assert.equal(r.status, 409);
  assert.equal(events(t, 'invitation.accept'), before);
  const row = t.DB.raw.prepare('SELECT status,revoked_at,acl_revision FROM daftar_company_memberships WHERE id=?').get(m.id);
  assert.equal(row.status, 'revoked'); assert.ok(row.revoked_at); assert.equal(row.acl_revision, rev0 + 1);
  assert.equal(t.DB.raw.prepare("SELECT COUNT(*) n FROM daftar_invitations WHERE status='pending'").get().n, 1);
  t.restore();
});

test('same-clock concurrent acceptance of two pending invites for existing member: one winner, one ACL increment', { timeout: 20000 }, async () => {
  const t = await boot();
  await join(t, alice, 'c1', 'viewer');
  const t1 = await invite(t, 'c1', 'contributor', alice.email), t2 = await invite(t, 'c1', 'contributor', alice.email);
  const rev0 = t.DB.raw.prepare('SELECT acl_revision r FROM daftar_company_memberships').get().r;
  const before = events(t, 'invitation.accept');
  const resetClock = freezeClock();
  const barrier = readBarrier(t, (sql) => sql === MEMBERSHIP_READ);
  try {
    const [a, b] = await Promise.all([
      t.call('/api/collaboration/invitations/accept', alice, 'POST', { token: t1 }),
      t.call('/api/collaboration/invitations/accept', alice, 'POST', { token: t2 }),
    ]);
    assert.equal(barrier.state.seen, 2);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    assert.equal(events(t, 'invitation.accept'), before + 1);
    assert.equal(t.DB.raw.prepare('SELECT acl_revision r FROM daftar_company_memberships').get().r, rev0 + 1);
    assert.equal(t.DB.raw.prepare("SELECT COUNT(*) n FROM daftar_invitations WHERE status='accepted' AND accepted_by_user_id=?").get(uid(t, alice)).n, 2);
    assert.equal(t.DB.raw.prepare("SELECT COUNT(*) n FROM daftar_invitations WHERE status='pending'").get().n, 1);
  } finally { barrier.restore(); resetClock(); t.restore(); }
});

test('concurrent same-key proposal submission: one row, one event, one replay', { timeout: 20000 }, async () => {
  const t = await boot();
  await join(t, alice, 'c1', 'contributor');
  const resetClock = freezeClock();
  const barrier = readBarrier(t, (sql) => sql === PROPOSAL_READ);
  try {
    const send = () => t.call('/api/collaboration/companies/c1/proposals', alice, 'POST', { brief: 'Same brief', idempotencyKey: 'dup' });
    const [a, b] = await Promise.all([send(), send()]);
    assert.equal(barrier.state.seen >= 2, true);
    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
    assert.equal([a, b].filter((x) => x.body.replay === true).length, 1);
    assert.equal(t.DB.raw.prepare('SELECT COUNT(*) n FROM daftar_task_proposals').get().n, 1);
    assert.equal(events(t, 'proposal.create'), 1);
  } finally { barrier.restore(); resetClock(); t.restore(); }
});

test('repeated membership revoke and concurrent reject add no extra success events', async () => {
  const t = await boot();
  await join(t, alice, 'c1', 'contributor');
  const mid = t.DB.raw.prepare('SELECT id FROM daftar_company_memberships').get().id;
  const r1 = await t.call('/api/collaboration/memberships/' + mid, owner, 'DELETE');
  const r2 = await t.call('/api/collaboration/memberships/' + mid, owner, 'DELETE');
  assert.equal(r1.body.revoked, true); assert.equal(r2.body.revoked, false);
  assert.equal(events(t, 'membership.revoke'), 1);
  await join(t, bob, 'c1', 'contributor');
  const pid = await proposal(t, bob, 'rj');
  const resetClock = freezeClock();
  const barrier = readBarrier(t, (sql) => sql === PROPOSAL_READ);
  try {
    const rej = () => t.call('/api/collaboration/proposals/' + pid + '/decision', owner, 'POST', { decision: 'reject' });
    const [x, y] = await Promise.all([rej(), rej()]);
    assert.equal(barrier.state.seen >= 2, true);
    assert.deepEqual([x.status, y.status].sort(), [200, 409]);
    assert.equal(events(t, 'proposal.reject'), 1);
  } finally { barrier.restore(); resetClock(); t.restore(); }
});

test('legacy owner-only API denies genuine members; owner remains valid', async () => {
  const t = await boot();
  await join(t, alice, 'c1', 'contributor');
  const legacy = async (path, who, method = 'GET') => {
    const headers = { 'content-type': 'application/json', 'oai-authenticated-user-id': who.sub, 'oai-authenticated-user-email': who.email, ...(method !== 'GET' ? { origin } : {}) };
    const r = await handleAtlasApi(new Request(origin + path, { method, headers }), t.env);
    return r.status;
  };
  assert.equal(await legacy('/api/workspace', alice), 403);
  assert.equal(await legacy('/api/commands', alice), 403);
  assert.equal(await legacy('/api/workspace', owner), 200);
  assert.equal(await legacy('/api/commands', owner), 200);
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

test('owner access dashboard includes explicit history and audit, never invitation tokens; members cannot read it', async () => {
  const t = await boot();
  try {
    await join(t, alice, 'c1', 'contributor');
    const mid = t.DB.raw.prepare('SELECT id FROM daftar_company_memberships').get().id;
    await t.call('/api/collaboration/memberships/' + mid, owner, 'DELETE');
    const pending = await invite(t, 'c1', 'viewer', bob.email);
    const view = await t.call('/api/collaboration/companies/c1/access', owner);
    assert.equal(view.status, 200);
    assert.equal(view.body.company.name, 'One');
    assert.equal(view.body.memberships[0].status, 'revoked');
    assert.equal(view.body.memberships[0].email, alice.email);
    assert.ok(view.body.audit.some(e => e.action === 'membership.revoke'));
    assert.equal(JSON.stringify(view.body).includes(pending), false);
    assert.equal(JSON.stringify(view.body).includes('token_digest'), false);
    assert.equal((await t.call('/api/collaboration/companies/c1/access', bob)).status, 403);
    assert.equal((await t.call('/api/collaboration/audit', bob)).status, 403);
    assert.equal((await t.call('/api/collaboration/audit?companyId=c1', owner)).status, 200);
  } finally { t.restore(); }
});

test('invitation inspection reveals the exact grant only to its intended account and does not accept it', async () => {
  const t = await boot();
  try {
    const token = await invite(t, 'c1', 'contributor', alice.email);
    const denied = await t.call('/api/collaboration/invitations/inspect', bob, 'POST', { token });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.invitation, undefined);
    const review = await t.call('/api/collaboration/invitations/inspect', alice, 'POST', { token });
    assert.equal(review.status, 200);
    assert.equal(review.body.invitation.company.name, 'One');
    assert.equal(review.body.invitation.role, 'contributor');
    assert.equal(review.body.invitation.accountEmail, alice.email);
    assert.ok(Date.parse(review.body.invitation.expiresAt) > Date.now());
    assert.equal(t.DB.raw.prepare('SELECT COUNT(*) n FROM daftar_company_memberships').get().n, 0);
    assert.equal(events(t, 'invitation.accept'), 0);
    assert.equal(JSON.stringify(review.body).includes(token), false);
  } finally { t.restore(); }
});

test('membership role/expiry update uses ACL revision, revokes downgraded resources and never restores revoked access', async () => {
  const t = await boot();
  try {
    await join(t, alice, 'c1', 'contributor');
    const member = t.DB.raw.prepare('SELECT * FROM daftar_company_memberships').get();
    const pid = await proposal(t, alice, 'membership-change');
    await t.call('/api/collaboration/proposals/' + pid + '/claim', alice, 'POST', {});
    t.DB.raw.prepare("INSERT INTO daftar_resource_grants (id,connection_id,owner_user_id,beneficiary_user_id,company_id,operations,created_at) VALUES ('grant-fixture','connection-fixture',?,?,'c1','[]',?)").run(uid(t, owner), uid(t, alice), T);
    const patch = { role: 'viewer', expiresAt: null, expectedAclRevision: member.acl_revision };
    assert.equal((await t.call('/api/collaboration/memberships/' + member.id, alice, 'PATCH', patch)).status, 403);
    const result = await t.call('/api/collaboration/memberships/' + member.id, owner, 'PATCH', patch);
    assert.equal(result.status, 200);
    assert.equal(result.body.membership.aclRevision, member.acl_revision + 1);
    assert.equal(t.DB.raw.prepare('SELECT assigned_user_id FROM daftar_task_proposals WHERE id=?').get(pid).assigned_user_id, null);
    assert.ok(t.DB.raw.prepare("SELECT revoked_at FROM daftar_resource_grants WHERE id='grant-fixture'").get().revoked_at);
    assert.equal((await t.call('/api/collaboration/companies/c1/messages', alice, 'POST', { content: 'blocked' })).status, 403);
    assert.equal((await t.call('/api/collaboration/memberships/' + member.id, owner, 'PATCH', patch)).status, 409);
    assert.equal(events(t, 'membership.update'), 1);
    await t.call('/api/collaboration/memberships/' + member.id, owner, 'DELETE');
    assert.equal((await t.call('/api/collaboration/memberships/' + member.id, owner, 'PATCH', { ...patch, expectedAclRevision: member.acl_revision + 2 })).status, 409);
    assert.equal((await t.call('/api/collaboration/companies/c1', alice)).status, 404);
  } finally { t.restore(); }
});

test('a losing access update cannot clear assignments or write audit under a competing update at the same timestamp', async () => {
  const resetClock = freezeClock();
  const t = await boot();
  try {
    await join(t, alice, 'c1', 'contributor');
    const member = t.DB.raw.prepare('SELECT * FROM daftar_company_memberships').get();
    const pid = await proposal(t, alice, 'competing-access');
    await t.call('/api/collaboration/proposals/' + pid + '/claim', alice, 'POST', {});
    t.DB.hooks.beforeBatch = db => db.prepare('UPDATE daftar_company_memberships SET acl_revision=acl_revision+1,updated_at=? WHERE id=?').run(new Date().toISOString(), member.id);
    const result = await t.call('/api/collaboration/memberships/' + member.id, owner, 'PATCH', { role: 'viewer', expiresAt: null, expectedAclRevision: member.acl_revision });
    assert.equal(result.status, 409);
    assert.equal(t.DB.raw.prepare('SELECT role FROM daftar_company_memberships WHERE id=?').get(member.id).role, 'contributor');
    assert.equal(t.DB.raw.prepare('SELECT assigned_user_id FROM daftar_task_proposals WHERE id=?').get(pid).assigned_user_id, uid(t, alice));
    assert.equal(events(t, 'membership.update'), 0);
  } finally { resetClock(); t.restore(); }
});

test('owner deactivation before proposal admission leaves no queued command or acceptance event', async () => {
  const t = await boot();
  try {
    await join(t, alice, 'c1', 'contributor');
    const pid = await proposal(t, alice, 'owner-disabled');
    t.DB.hooks.beforeBatch = db => db.prepare("UPDATE daftar_users SET status='disabled' WHERE id=?").run(uid(t, owner));
    const result = await t.call('/api/collaboration/proposals/' + pid + '/decision', owner, 'POST', { decision: 'accept', expectedRevision: 3 });
    assert.equal(result.status, 409);
    assert.equal(t.DB.raw.prepare('SELECT COUNT(*) n FROM atlas_commands').get().n, 0);
    assert.equal(t.DB.raw.prepare('SELECT status FROM daftar_task_proposals WHERE id=?').get(pid).status, 'proposed');
    assert.equal(events(t, 'proposal.accept'), 0);
  } finally { t.restore(); }
});

test('revocation while a company snapshot read is pending denies the entire member response', async () => {
  const t = await boot();
  try {
    await join(t, alice, 'c1', 'viewer');
    const prepare = t.DB.prepare.bind(t.DB);
    let intercepted = false;
    t.DB.prepare = sql => {
      const statement = prepare(sql);
      if (sql.startsWith('SELECT revision, snapshot FROM atlas_workspace')) {
        const first = statement.first.bind(statement);
        statement.first = async () => {
          const snapshot = await first();
          intercepted = true;
          t.DB.raw.prepare("UPDATE daftar_company_memberships SET status='revoked',revoked_at=?,acl_revision=acl_revision+1 WHERE user_id=?").run(new Date().toISOString(), uid(t, alice));
          return snapshot;
        };
      }
      return statement;
    };
    const result = await t.call('/api/collaboration/companies/c1', alice);
    assert.equal(intercepted, true);
    assert.equal(result.status, 404);
    assert.equal(result.body.company, undefined);
  } finally { t.restore(); }
});

test('owner company selector includes more than 200 registered companies without broadening a member list', async () => {
  const t = await boot();
  try {
    const state = snap();
    state.companies.push(...Array.from({ length: 250 }, (_, i) => ({ id: 'company-' + i, name: 'Company ' + i })));
    t.DB.raw.prepare("UPDATE atlas_workspace SET snapshot=? WHERE id='owner'").run(JSON.stringify(state));
    assert.equal((await t.call('/api/collaboration/session', owner)).body.companies.length, 252);
    await join(t, alice, 'c1', 'viewer');
    const result = await t.call('/api/collaboration/session', alice);
    assert.deepEqual(result.body.companies.map(c => c.id), ['c1']);
    assert.equal(result.body.companyListTruncated, undefined);
  } finally { t.restore(); }
});

test('latest company notes paginate backward without duplicating or returning another company', async () => {
  const t = await boot();
  try {
    await join(t, alice, 'c1', 'viewer');
    const insert = t.DB.raw.prepare("INSERT INTO daftar_member_messages (id,company_id,author_user_id,visibility,role,content,created_at) VALUES (?, ?, ?, 'company', 'user', ?, ?)");
    for (let i = 0; i < 55; i++) insert.run('note-' + String(i).padStart(3, '0'), 'c1', uid(t, owner), 'Shared note ' + i, T);
    insert.run('hidden-note', 'c2', uid(t, owner), 'HIDDEN OTHER COMPANY', T);
    const first = await t.call('/api/collaboration/companies/c1/messages?latest=1', alice);
    assert.equal(first.status, 200);
    assert.equal(first.body.messages[0].id, 'note-005');
    assert.equal(first.body.messages.at(-1).id, 'note-054');
    const older = await t.call('/api/collaboration/companies/c1/messages?latest=1&cursor=' + encodeURIComponent(first.body.nextCursor), alice);
    assert.deepEqual(older.body.messages.map(m => m.id), ['note-000', 'note-001', 'note-002', 'note-003', 'note-004']);
    assert.equal(older.body.nextCursor, null);
    assert.equal(JSON.stringify(first.body).includes('HIDDEN'), false);
    assert.equal(JSON.stringify(older.body).includes('HIDDEN'), false);
  } finally { t.restore(); }
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
