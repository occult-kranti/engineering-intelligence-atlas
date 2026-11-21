import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const dir = new URL('../drizzle/', import.meta.url);
const T = '2026-01-01T00:00:00.000Z';
const HISTORICAL_LAST = '0003_serious_silver_sable.sql';

function migrationNames() {
  return fs.readdirSync(dir).filter((n) => n.endsWith('.sql')).sort();
}
const apply = (db, name) => db.exec(fs.readFileSync(new URL(name, dir), 'utf8'));

function cols(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}
function indexes(db, table) {
  const out = {};
  for (const i of db.prepare(`PRAGMA index_list(${table})`).all()) {
    out[i.name] = {
      unique: Number(i.unique) === 1,
      cols: db.prepare(`PRAGMA index_info(${i.name})`).all().sort((a, b) => a.seqno - b.seqno).map((c) => c.name),
    };
  }
  return out;
}
const hasIndex = (idx, columns, unique) =>
  Object.values(idx).some((i) => i.unique === unique && JSON.stringify(i.cols) === JSON.stringify(columns));

function historicalFixture() {
  const names = migrationNames();
  const lastIdx = names.indexOf(HISTORICAL_LAST);
  assert.ok(lastIdx >= 0, 'historical migration ' + HISTORICAL_LAST + ' must exist');
  const newer = names.slice(lastIdx + 1);
  assert.ok(newer.length >= 1, 'a newly generated migration after ' + HISTORICAL_LAST + ' is required (run npm run db:generate)');
  const db = new DatabaseSync(':memory:');
  for (const n of names.slice(0, lastIdx + 1)) apply(db, n);
  db.prepare('INSERT INTO daftar_users (id,issuer,subject,email,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('owner1', 'iss', 'sub', 'o@example.com', 'active', T, T);
  db.prepare('INSERT INTO daftar_member_requests (id,company_id,requester_user_id,payer_user_id,connection_id,grant_id,operation,idempotency_key,input_hash,status,reserved_micros,cost_micros,input_tokens,output_tokens,created_at,finished_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('req-old', 'co1', 'owner1', 'owner1', 'conn1', 'grant1', 'chat', 'idem-old', 'hash-old', 'completed', 1234, 1000, 11, 22, T, T);
  db.prepare('INSERT INTO daftar_member_messages (id,company_id,author_user_id,visibility,role,content,request_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run('msg-old', 'co1', 'owner1', 'company', 'user', 'historical content', 'req-old', T);
  db.prepare('INSERT INTO daftar_member_messages (id,company_id,author_user_id,visibility,role,content,request_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run('post-old', 'co1', 'owner1', 'company', 'user', 'discussion', null, T);
  return { db, newer };
}

test('schema.ts declares required additive columns and indexes', () => {
  const src = fs.readFileSync(new URL('../db/schema.ts', import.meta.url), 'utf8');
  for (const c of ['execution_snapshot', 'usage_json', 'result_json', 'cost_basis']) assert.ok(src.includes("'" + c + "'"), 'schema.ts missing column ' + c);
  assert.ok(/uniqueIndex\([^)]*\)\.on\(t\.requestId,t\.role\)/.test(src), 'unique (request_id,role) on member messages missing');
});

test('generated migration applies over historical data and preserves it', () => {
  const { db, newer } = historicalFixture();
  for (const n of newer) apply(db, n);

  const rc = cols(db, 'daftar_member_requests');
  for (const c of ['execution_snapshot', 'usage_json', 'result_json', 'cost_basis']) assert.ok(rc.includes(c), 'missing column ' + c);
  for (const c of db.prepare('PRAGMA table_info(daftar_member_requests)').all()) {
    if (['execution_snapshot', 'usage_json', 'result_json', 'cost_basis'].includes(c.name)) {
      assert.equal(Number(c.notnull), 0, c.name + ' must be nullable');
      assert.equal(c.dflt_value, null, c.name + ' must have no default');
    }
  }

  const ri = indexes(db, 'daftar_member_requests');
  assert.ok(hasIndex(ri, ['connection_id', 'status'], false), 'index (connection_id,status) missing');
  assert.ok(hasIndex(ri, ['grant_id', 'status'], false), 'index (grant_id,status) missing');
  assert.ok(hasIndex(ri, ['requester_user_id', 'idempotency_key'], true), 'existing actor-key unique index lost');
  assert.ok(hasIndex(ri, ['payer_user_id', 'status'], false), 'existing admission index lost');
  const mi = indexes(db, 'daftar_member_messages');
  assert.ok(hasIndex(mi, ['request_id', 'role'], true), 'unique (request_id,role) missing');
  assert.ok(hasIndex(mi, ['company_id', 'visibility', 'created_at', 'id'], false), 'existing message index lost');

  const r = db.prepare('SELECT * FROM daftar_member_requests WHERE id=?').get('req-old');
  assert.equal(r.company_id, 'co1');
  assert.equal(r.requester_user_id, 'owner1');
  assert.equal(r.connection_id, 'conn1');
  assert.equal(r.grant_id, 'grant1');
  assert.equal(r.idempotency_key, 'idem-old');
  assert.equal(r.status, 'completed');
  assert.equal(Number(r.reserved_micros), 1234);
  assert.equal(Number(r.cost_micros), 1000);
  assert.equal(Number(r.input_tokens), 11);
  assert.equal(Number(r.output_tokens), 22);
  for (const c of ['execution_snapshot', 'usage_json', 'result_json', 'cost_basis']) assert.equal(r[c], null, c + ' must stay NULL on historical rows');
  const m = db.prepare('SELECT * FROM daftar_member_messages WHERE id=?').get('msg-old');
  assert.equal(m.content, 'historical content');
  assert.equal(m.request_id, 'req-old');
  assert.equal(db.prepare('SELECT content FROM daftar_member_messages WHERE id=?').get('post-old').content, 'discussion');
  db.close();
});

test('structured snapshot, usage and result round-trip', () => {
  const { db, newer } = historicalFixture();
  for (const n of newer) apply(db, n);
  const snapshot = { model: 'm', rates: { in: 1, out: 2 }, nested: [1, { a: 'b' }], unicode: 'é✓' };
  const usage = { input_tokens: 5, output_tokens: 7 };
  const result = { ok: true, text: 'reply', parts: ['a', 'b'] };
  db.prepare('UPDATE daftar_member_requests SET execution_snapshot=?, usage_json=?, result_json=?, cost_basis=? WHERE id=?')
    .run(JSON.stringify(snapshot), JSON.stringify(usage), JSON.stringify(result), 'measured', 'req-old');
  const r = db.prepare('SELECT * FROM daftar_member_requests WHERE id=?').get('req-old');
  assert.deepEqual(JSON.parse(r.execution_snapshot), snapshot);
  assert.deepEqual(JSON.parse(r.usage_json), usage);
  assert.deepEqual(JSON.parse(r.result_json), result);
  assert.equal(r.cost_basis, 'measured');
  assert.equal(Number(r.cost_micros), 1000);
  db.close();
});

test('duplicate non-null (request_id,role) rejected; NULL request ids stay independent', () => {
  const { db, newer } = historicalFixture();
  for (const n of newer) apply(db, n);
  const ins = db.prepare('INSERT INTO daftar_member_messages (id,company_id,author_user_id,visibility,role,content,request_id,created_at) VALUES (?,?,?,?,?,?,?,?)');
  assert.throws(() => ins.run('dup', 'co1', 'owner1', 'company', 'user', 'again', 'req-old', T), /UNIQUE|constraint/i);
  ins.run('asst', 'co1', 'owner1', 'company', 'assistant', 'answer', 'req-old', T);
  ins.run('post-2', 'co1', 'owner1', 'company', 'user', 'another discussion', null, T);
  ins.run('post-3', 'co1', 'owner1', 'company', 'user', 'third discussion', null, T);
  const n = db.prepare('SELECT COUNT(*) n FROM daftar_member_messages WHERE request_id IS NULL').get().n;
  assert.equal(Number(n), 3);
  db.close();
});
