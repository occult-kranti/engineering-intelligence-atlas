/** Shared Site budget accounting for legacy atlas_requests and member daftar_member_requests.
 * One allocation: committed = SUM(COALESCE(cost_micros,reserved_micros)) over both tables.
 * Unknown outcomes retain their reservation. All amounts are integer micro-USD; invalid accounting fails closed.
 * No cache; every admission recomputes inside its own atomic INSERT...SELECT. */
type Row = Record<string, any>;
type StmtLike = { bind(...a: any[]): StmtLike; first<T = any>(): Promise<T | null> };
type DbLike = { prepare(sql: string): StmtLike };

export const SHARED_ACTIVE_MAX = 2;
export const SHARED_ACTIVE_STATUSES_SQL = "('reserved','dispatching')";

/** Fixed (non-interpolated-input) SQL fragments. */
export const COMMITTED_SQL =
  '((SELECT COALESCE(SUM(COALESCE(cost_micros,reserved_micros)),0) FROM atlas_requests) + (SELECT COALESCE(SUM(COALESCE(cost_micros,reserved_micros)),0) FROM daftar_member_requests))';
export const ACTIVE_SQL =
  "((SELECT COUNT(*) FROM atlas_requests WHERE status IN ('reserved','dispatching')) + (SELECT COUNT(*) FROM daftar_member_requests WHERE status IN ('reserved','dispatching')))";
/** Invalid stored accounting count: any negative, non-integer or non-numeric amount in either table. */
export const INVALID_STORED_SQL =
  "((SELECT COUNT(*) FROM atlas_requests WHERE reserved_micros IS NULL OR typeof(reserved_micros)<>'integer' OR reserved_micros<0 OR (cost_micros IS NOT NULL AND (typeof(cost_micros)<>'integer' OR cost_micros<0))) + (SELECT COUNT(*) FROM daftar_member_requests WHERE reserved_micros IS NULL OR typeof(reserved_micros)<>'integer' OR reserved_micros<0 OR (cost_micros IS NOT NULL AND (typeof(cost_micros)<>'integer' OR cost_micros<0))))";

export function isMicros(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}

/** Parse configured Site cap (dollars) to integer micro-USD. Invalid/missing => 0 (no new spending). */
export function parseCapMicros(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  const micros = Math.floor(Math.min(n, 100) * 1e6 + 1e-6);
  return isMicros(micros) ? micros : 0;
}

/** Integer-ceiling cost from token counts and per-million micro rates. Throws on invalid input. */
export function ceilCostMicros(inputTokens: number, outputTokens: number, inputRateMicrosPerMTok: number, outputRateMicrosPerMTok: number): number {
  for (const v of [inputTokens, outputTokens, inputRateMicrosPerMTok, outputRateMicrosPerMTok]) if (!isMicros(v)) throw new Error('invalid accounting input');
  // BigInt() calls (not literals) keep integer arithmetic valid under target ES2017.
  const big = (n: number) => BigInt(n);
  const total = (big(inputTokens) * big(inputRateMicrosPerMTok) + big(outputTokens) * big(outputRateMicrosPerMTok) + big(999999)) / big(1000000);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('cost overflow');
  return Number(total);
}

export type SiteBudget = {
  capMicros: number; committedMicros: number; observedMicros: number; reservedMicros: number; remainingMicros: number; activeCount: number; valid: boolean;
};

/** Fresh read of the combined ledger. valid=false means fail closed. */
export async function readSiteBudget(db: DbLike, capRaw: unknown): Promise<SiteBudget> {
  const capMicros = parseCapMicros(capRaw);
  const row = await db.prepare(
    `SELECT ${COMMITTED_SQL} AS committed, ${ACTIVE_SQL} AS active, ${INVALID_STORED_SQL} AS invalid,` +
    ' ((SELECT COALESCE(SUM(COALESCE(cost_micros,0)),0) FROM atlas_requests) + (SELECT COALESCE(SUM(COALESCE(cost_micros,0)),0) FROM daftar_member_requests)) AS observed,' +
    ' ((SELECT COALESCE(SUM(CASE WHEN cost_micros IS NULL THEN reserved_micros ELSE 0 END),0) FROM atlas_requests) + (SELECT COALESCE(SUM(CASE WHEN cost_micros IS NULL THEN reserved_micros ELSE 0 END),0) FROM daftar_member_requests)) AS reserved'
  ).bind().first<Row>();
  const committed = row?.committed, observed = row?.observed, reserved = row?.reserved, active = row?.active;
  const valid = !!row && Number(row.invalid) === 0 && isMicros(committed) && isMicros(observed) && isMicros(reserved) && isMicros(active);
  if (!valid) return { capMicros, committedMicros: 0, observedMicros: 0, reservedMicros: 0, remainingMicros: 0, activeCount: 0, valid: false };
  return { capMicros, committedMicros: committed, observedMicros: observed, reservedMicros: reserved, remainingMicros: Math.max(0, capMicros - committed), activeCount: active, valid: true };
}

/** Owner view: both ledgers combined, all in USD. Usage-based calculation is not an invoice. */
export function ownerBudgetView(b: SiteBudget) {
  const usd = (m: number) => m / 1e6;
  return {
    capUsd: usd(b.capMicros), observedUsd: usd(b.observedMicros), reservedUsd: usd(b.reservedMicros), committedUsd: usd(b.committedMicros), remainingUsd: usd(b.remainingMicros),
    warning: b.valid && b.capMicros > 0 && b.committedMicros * 5 >= b.capMicros * 4, atCap: !b.valid || b.committedMicros >= b.capMicros,
    accountingValid: b.valid, activeRequests: b.activeCount,
    basis: { observed: 'calculated from observed token usage (not an invoice)', reserved: 'conservative estimated charge retained for unresolved requests' },
    allocation: 'One Site allocation shared by owner chat and member requests; reserved separately in the native global ledger.',
  };
}

/** Member view: only own/authorized-grant cap, usage, remaining, and a coarse Site pause flag. */
export function memberBudgetView(site: SiteBudget, own: { capMicros: number | null; committedMicros: number }) {
  const cap = own.capMicros;
  const remaining = cap === null ? null : Math.max(0, cap - own.committedMicros) / 1e6;
  const siteBudgetAvailable = site.valid && site.committedMicros < site.capMicros && site.activeCount < SHARED_ACTIVE_MAX;
  const pauseReason = !site.valid ? 'accounting-unavailable' : site.committedMicros >= site.capMicros ? 'site-budget-exhausted' : site.activeCount >= SHARED_ACTIVE_MAX ? 'site-busy' : null;
  return { capUsd: cap === null ? null : cap / 1e6, usedUsd: own.committedMicros / 1e6, remainingUsd: remaining, siteBudgetAvailable, pauseReason };
}

export type LegacyReservation = { sql: string; binds: any[] };

/** Atomic legacy INSERT...SELECT: combined Site spend and shared concurrency are checked in the same statement. */
export function legacyReservationStatement(a: { id: string; key: string; scopeKey: string; requestHash: string; reservedMicros: number; createdAt: string; capMicros: number }): LegacyReservation {
  if (!isMicros(a.reservedMicros) || !isMicros(a.capMicros)) throw new Error('invalid accounting input');
  return {
    sql: "INSERT INTO atlas_requests (id,idempotency_key,scope_key,status,request_hash,reserved_micros,created_at) SELECT ?,?,?,'reserved',?,?,? WHERE " +
      `${INVALID_STORED_SQL} = 0 AND ${COMMITTED_SQL} + ? <= ? AND ${ACTIVE_SQL} < ${SHARED_ACTIVE_MAX}`,
    binds: [a.id, a.key, a.scopeKey, a.requestHash, a.reservedMicros, a.createdAt, a.reservedMicros, a.capMicros],
  };
}

export type MemberAdmission = {
  id: string; companyId: string; requesterUserId: string; payerUserId: string; connectionId: string; grantId: string | null; operation: string;
  idempotencyKey: string; inputHash: string; reservedMicros: number; createdAt: string; siteCapMicros: number;
  connectionCapMicros: number | null; grantTotalCapMicros: number | null; perRequestCapMicros: number | null;
  /** Caller-supplied FIXED predicate text (no user input interpolated) with its binds: identity/membership/connection/grant currency. */
  currentPredicateSql: string; currentPredicateBinds: any[];
};

/** Atomic member INSERT...SELECT. Reservation is server-computed; checks Site total, connection lifetime, grant total, per-request cap, shared concurrency. */
export function memberAdmissionStatement(a: MemberAdmission): LegacyReservation {
  for (const v of [a.reservedMicros, a.siteCapMicros]) if (!isMicros(v)) throw new Error('invalid accounting input');
  for (const v of [a.connectionCapMicros, a.grantTotalCapMicros, a.perRequestCapMicros]) if (v !== null && !isMicros(v)) throw new Error('invalid accounting input');
  const connSpent = '(SELECT COALESCE(SUM(COALESCE(cost_micros,reserved_micros)),0) FROM daftar_member_requests WHERE connection_id = ?)';
  const grantSpent = '(SELECT COALESCE(SUM(COALESCE(cost_micros,reserved_micros)),0) FROM daftar_member_requests WHERE grant_id = ?)';
  const parts: string[] = [`${INVALID_STORED_SQL} = 0`, `${COMMITTED_SQL} + ? <= ?`, `${ACTIVE_SQL} < ${SHARED_ACTIVE_MAX}`];
  const binds: any[] = [a.id, a.companyId, a.requesterUserId, a.payerUserId, a.connectionId, a.grantId, a.operation, a.idempotencyKey, a.inputHash, a.reservedMicros, a.createdAt, a.reservedMicros, a.siteCapMicros];
  if (a.connectionCapMicros !== null) { parts.push(`${connSpent} + ? <= ?`); binds.push(a.connectionId, a.reservedMicros, a.connectionCapMicros); }
  if (a.grantId && a.grantTotalCapMicros !== null) { parts.push(`${grantSpent} + ? <= ?`); binds.push(a.grantId, a.reservedMicros, a.grantTotalCapMicros); }
  if (a.perRequestCapMicros !== null) { parts.push('? <= ?'); binds.push(a.reservedMicros, a.perRequestCapMicros); }
  parts.push(`(${a.currentPredicateSql})`); binds.push(...a.currentPredicateBinds);
  return {
    sql: "INSERT INTO daftar_member_requests (id,company_id,requester_user_id,payer_user_id,connection_id,grant_id,operation,idempotency_key,input_hash,status,reserved_micros,created_at) SELECT ?,?,?,?,?,?,?,?,?,'reserved',?,? WHERE " + parts.join(' AND '),
    binds,
  };
}

/** Own spend for a connection (+ optional grant), regardless of status or membership revocation. */
export async function ownSpend(db: DbLike, connectionId: string, grantId: string | null): Promise<{ connectionMicros: number; grantMicros: number }> {
  const c = await db.prepare('SELECT COALESCE(SUM(COALESCE(cost_micros,reserved_micros)),0) AS n FROM daftar_member_requests WHERE connection_id = ?').bind(connectionId).first<Row>();
  const g = grantId ? await db.prepare('SELECT COALESCE(SUM(COALESCE(cost_micros,reserved_micros)),0) AS n FROM daftar_member_requests WHERE grant_id = ?').bind(grantId).first<Row>() : { n: 0 };
  const cm = c?.n, gm = g?.n;
  if (!isMicros(cm) || !isMicros(gm)) throw new Error('invalid accounting');
  return { connectionMicros: cm, grantMicros: gm };
}
