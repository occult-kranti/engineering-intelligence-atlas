/** Sonnet-authored observer, reviewed for timestamp bounds and full-ID equality.
 * Deterministic and read-only: no model, network request, repair, or authority grant.
 */
import type { OfficeSnapshot } from './office';

export interface ObserveInput {
  index: { entityCount: number; updatedAt?: string };
  ledger: Array<{ id: string; jobId?: string; kind: string; amountUsd: number }>;
  jobs: Array<{ id: string; status: string; updatedAt?: string; leaseExpiresAt?: string | null }>;
  now: number;
}
export interface ObserverIssue { code: string; entityId?: string; count: number }
export interface OfficeObservation {
  checkedAt: string; modelCalls: 0; health: 'healthy' | 'attention'; issues: ObserverIssue[];
}
const STALE_MS = 30 * 60 * 1000;
const MAX_ROWS = 200_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
function parseIso(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = ISO.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]!) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}
function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function safeId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value) ? value : undefined;
}

export function observeOffice(input: ObserveInput): OfficeObservation {
  const raw: unknown = input;
  const src: Record<string, unknown> = isObj(raw) ? raw : {};
  const now = typeof src.now === 'number' && Number.isFinite(src.now) && Math.abs(src.now) <= 8.64e15 ? src.now : null;
  const counts = new Map<string, number>();
  const firstId = new Map<string, string | undefined>();
  const add = (code: string, entityId?: string): void => {
    counts.set(code, (counts.get(code) ?? 0) + 1);
    if (!firstId.has(code)) firstId.set(code, entityId);
  };
  if (now === null) add('invalid_now');
  const index = src.index;
  if (!isObj(index)) add('invalid_index');
  else {
    if (typeof index.entityCount !== 'number' || !Number.isSafeInteger(index.entityCount) || index.entityCount < 0) add('invalid_index_count');
    if (index.updatedAt !== undefined && parseIso(index.updatedAt) === null) add('invalid_index_date');
  }
  const jobList: unknown[] = Array.isArray(src.jobs) ? src.jobs : [];
  if (!Array.isArray(src.jobs)) add('invalid_jobs');
  if (jobList.length > MAX_ROWS) add('job_limit_exceeded');
  const jobIds = new Set<string>();
  for (const job of jobList.slice(0, MAX_ROWS)) {
    if (!isObj(job)) { add('invalid_job'); continue; }
    const id = safeId(job.id);
    if (!id) add('invalid_job');
    else if (jobIds.has(id)) add('duplicate_job_id', id);
    else jobIds.add(id);
    if (job.updatedAt !== undefined || job.status === 'running') {
      const time = parseIso(job.updatedAt);
      if (time === null) add('invalid_job_date', id);
      else if (job.status === 'running' && now !== null) {
        const lease = job.leaseExpiresAt == null ? null : parseIso(job.leaseExpiresAt);
        if (job.leaseExpiresAt != null && lease === null) add('invalid_job_lease', id);
        else if (lease !== null && lease < now) add('expired_job_lease', id);
        else if (lease === null && now - time > STALE_MS) add('stale_running_job', id);
      }
    }
  }
  const ledgerList: unknown[] = Array.isArray(src.ledger) ? src.ledger : [];
  if (!Array.isArray(src.ledger)) add('invalid_ledger');
  if (ledgerList.length > MAX_ROWS) add('ledger_limit_exceeded');
  const ledgerIds = new Set<string>();
  for (const entry of ledgerList.slice(0, MAX_ROWS)) {
    if (!isObj(entry)) { add('invalid_ledger_entry'); continue; }
    const id = safeId(entry.id);
    if (!id) add('invalid_ledger_entry');
    else if (ledgerIds.has(id)) add('duplicate_ledger_id', id);
    else ledgerIds.add(id);
    if (typeof entry.amountUsd !== 'number' || !Number.isFinite(entry.amountUsd)) add('invalid_ledger_amount', id);
    else if (entry.amountUsd < 0) add('negative_ledger_amount', id);
    if (entry.jobId !== undefined && (typeof entry.jobId !== 'string' || !jobIds.has(entry.jobId))) add('ledger_unknown_job', id);
  }
  // Codes come only from the fixed checks above; output size is independent of rows.
  const issues = [...counts].map(([code, count]) => {
    const entityId = firstId.get(code);
    return entityId ? { code, count, entityId } : { code, count };
  });
  return { checkedAt: new Date(now ?? 0).toISOString(), modelCalls: 0, health: issues.length ? 'attention' : 'healthy', issues };
}

/** Adapts actual native records without inventing a second financial ledger. */
export function observeSnapshot(snapshot: OfficeSnapshot, now = Date.now()): OfficeObservation {
  const ledger = (snapshot.authority?.ledger ?? []).map(row => ({ id: `authority:${row.id}`, kind: row.action, amountUsd: 0 }));
  const result = observeOffice({
    index: { entityCount: snapshot.authority?.index.length ?? 0 },
    ledger: [...ledger,
      ...snapshot.jobs.filter(job => job.usageRecorded).map(job => ({ id: `usage:${job.id}`, jobId: job.id, kind: 'usage', amountUsd: job.usage.costUsd })),
      ...(snapshot.externalAttempts ?? []).filter(row => row.settled).map(row => ({ id: `external:${row.attemptId}`, kind: 'external', amountUsd: row.usage.costUsd }))],
    jobs: snapshot.jobs, now,
  });
  if (!snapshot.authority) {
    result.issues.push({ code: 'index_unavailable', count: 1 });
  } else {
    const indexed = new Set(snapshot.authority.index.map(row => `${row.kind}:${row.entityId}`));
    let missing = 0;
    for (const [kind, rows] of [['company', snapshot.companies], ['office', snapshot.offices], ['department', snapshot.departments],
      ['employee', snapshot.employees], ['job', snapshot.jobs], ['goal', snapshot.goals ?? []], ['knowledge', snapshot.knowledge]] as const) {
      for (const row of rows) if (!indexed.has(`${kind}:${row.id}`)) missing++;
    }
    if (missing) result.issues.push({ code: 'index_missing_entity', count: missing });
  }
  result.health = result.issues.length ? 'attention' : 'healthy';
  return result;
}
