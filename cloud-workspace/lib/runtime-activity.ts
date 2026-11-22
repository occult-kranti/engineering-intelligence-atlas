/** Bounded owner-runtime activity projection. Initial Haiku source independently reviewed and corrected. */
export type RuntimeExecution = {
  sampledAt: string;
  activeCalls: Array<{
    jobId: string;
    phase: 'provider' | 'model';
    startedAt: string;
  }>;
};

type ProjectionResult = {
  available: boolean;
  execution: RuntimeExecution | null;
  receivedAt: string | null;
  reason: string | null;
};

const MAX_CALLS = 8;
const MAX_JOBS = 5000;
const MAX_COMPANIES = 2000;
const MAX_ID_LENGTH = 120;
const SAMPLE_MAX_AGE_MS = 45_000;
const FUTURE_SKEW_MS = 5_000;
const ID_PATTERN = /^[A-Za-z0-9_:.-]+$/;
const RFC3339_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const PHASES = ['provider', 'model'] as const;
const EXECUTION_KEYS = ['sampledAt', 'activeCalls'] as const;
const CALL_KEYS = ['jobId', 'phase', 'startedAt'] as const;

function hasOnlyKeys(obj: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(obj);
  if (keys.length !== allowed.length) return false;
  for (const k of keys) {
    if (!allowed.includes(k)) return false;
  }
  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function ownValue(obj: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

function isSafeNow(nowMs: unknown): nowMs is number {
  return typeof nowMs === 'number' && Number.isSafeInteger(nowMs) && nowMs >= 0;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = RFC3339_PATTERN.exec(value);
  if (!match) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || !Number.isSafeInteger(ms)) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const year = Number(match[1]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > days[month - 1]) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return ms;
}

function canonicalId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > MAX_ID_LENGTH) return null;
  if (!ID_PATTERN.test(value)) return null;
  return value;
}

function isPhase(value: unknown): value is 'provider' | 'model' {
  return typeof value === 'string' && (PHASES as readonly string[]).includes(value);
}

type SnapshotJob = {
  id: string;
  status: string;
  companyId: string;
  provider: string | null;
  startedAt: number | null;
  leaseExpiresAt: number | null;
};

type IndexedSnapshot = {
  jobs: Map<string, SnapshotJob>;
  companies: Set<string>;
};

function indexSnapshot(snapshot: unknown): IndexedSnapshot | null {
  if (!isPlainObject(snapshot)) return null;
  const rawJobs = ownValue(snapshot, 'jobs');
  const rawCompanies = ownValue(snapshot, 'companies');
  if (!Array.isArray(rawJobs) || !Array.isArray(rawCompanies)) return null;
  if (rawJobs.length > MAX_JOBS || rawCompanies.length > MAX_COMPANIES) return null;

  const companies = new Set<string>();
  for (const company of rawCompanies) {
    if (!isPlainObject(company)) continue;
    const id = canonicalId(ownValue(company, 'id'));
    if (id !== null) companies.add(id);
  }

  const jobs = new Map<string, SnapshotJob>();
  for (const job of rawJobs) {
    if (!isPlainObject(job)) continue;
    const id = canonicalId(ownValue(job, 'id'));
    const status = ownValue(job, 'status');
    const companyId = canonicalId(ownValue(job, 'companyId'));
    if (id === null || typeof status !== 'string' || companyId === null) continue;
    const leaseRaw = ownValue(job, 'leaseExpiresAt');
    let leaseExpiresAt: number | null = null;
    if (typeof leaseRaw === 'string') {
      leaseExpiresAt = parseTimestamp(leaseRaw);
    }
    if (jobs.has(id)) return null;
    const provider = ownValue(job, 'provider');
    jobs.set(id, { id, status, companyId, leaseExpiresAt,
      provider: typeof provider === 'string' ? provider : null,
      startedAt: parseTimestamp(ownValue(job, 'startedAt')) });
  }
  return { jobs, companies };
}

function isLiveJob(job: SnapshotJob, index: IndexedSnapshot, nowMs: number): boolean {
  return (
    job.status === 'running' &&
    job.leaseExpiresAt !== null &&
    job.leaseExpiresAt > nowMs &&
    index.companies.has(job.companyId)
  );
}

function matchesCall(job: SnapshotJob, phase: 'provider' | 'model', startedMs: number): boolean {
  return job.startedAt !== null && startedMs >= job.startedAt - FUTURE_SKEW_MS
    && (phase === 'model' ? job.provider === 'ollama' : ['anthropic', 'openai'].includes(job.provider ?? ''));
}

function validateSampledAt(value: unknown, nowMs: number): { iso: string; ms: number } {
  const ms = parseTimestamp(value);
  if (ms === null) throw new Error('invalid sampledAt');
  if (ms > nowMs + FUTURE_SKEW_MS) throw new Error('sampledAt is in the future');
  if (nowMs - ms > SAMPLE_MAX_AGE_MS) throw new Error('sampledAt is stale');
  return { iso: value as string, ms };
}

function validateCalls(
  raw: unknown,
  sampledMs: number,
  index: IndexedSnapshot,
  nowMs: number,
): RuntimeExecution['activeCalls'] {
  if (!Array.isArray(raw)) throw new Error('activeCalls must be an array');
  if (raw.length > MAX_CALLS) throw new Error('too many active calls');

  const seen = new Set<string>();
  const calls: RuntimeExecution['activeCalls'] = [];
  for (const entry of raw) {
    if (!isPlainObject(entry)) throw new Error('invalid active call');
    if (!hasOnlyKeys(entry, CALL_KEYS)) throw new Error('unexpected keys in active call');

    const jobId = canonicalId(ownValue(entry, 'jobId'));
    if (jobId === null) throw new Error('invalid jobId');
    if (seen.has(jobId)) throw new Error('duplicate jobId');
    seen.add(jobId);

    const phase = ownValue(entry, 'phase');
    if (!isPhase(phase)) throw new Error('invalid phase');

    const startedRaw = ownValue(entry, 'startedAt');
    const startedMs = parseTimestamp(startedRaw);
    if (startedMs === null) throw new Error('invalid startedAt');
    if (startedMs > sampledMs + FUTURE_SKEW_MS) throw new Error('startedAt is after sampledAt');
    if (startedMs > nowMs + FUTURE_SKEW_MS) throw new Error('startedAt is in the future');

    const job = index.jobs.get(jobId);
    if (job === undefined) throw new Error('job not found in snapshot');
    if (!isLiveJob(job, index, nowMs) || !matchesCall(job, phase, startedMs)) throw new Error('job is not live or does not match the call');

    calls.push({ jobId, phase, startedAt: startedRaw as string });
  }
  return calls;
}

export function validateRuntimeExecution(
  input: unknown,
  snapshot: unknown,
  nowMs: number,
): RuntimeExecution {
  if (!isSafeNow(nowMs)) throw new Error('invalid nowMs');
  if (!isPlainObject(input)) throw new Error('invalid execution');
  if (!hasOnlyKeys(input, EXECUTION_KEYS)) throw new Error('unexpected keys in execution');

  const index = indexSnapshot(snapshot);
  if (index === null) throw new Error('invalid snapshot');

  const sampled = validateSampledAt(ownValue(input, 'sampledAt'), nowMs);
  const activeCalls = validateCalls(ownValue(input, 'activeCalls'), sampled.ms, index, nowMs);

  return {
    sampledAt: sampled.iso,
    activeCalls,
  };
}

function unavailable(reason: string): ProjectionResult {
  return { available: false, execution: null, receivedAt: null, reason };
}

export function projectRuntimeExecution(
  stored: unknown,
  snapshot: unknown,
  nowMs: number,
): ProjectionResult {
  if (!isSafeNow(nowMs)) return unavailable('invalid_now');
  if (!isPlainObject(stored)) return unavailable('missing');

  const receivedAt = ownValue(stored, 'receivedAt');
  const receivedMs = parseTimestamp(receivedAt);
  if (receivedMs === null) return unavailable('malformed');
  if (nowMs - receivedMs > SAMPLE_MAX_AGE_MS) return unavailable('stale');
  if (receivedMs > nowMs + FUTURE_SKEW_MS) return unavailable('future');

  const clientId = ownValue(stored, 'clientId');
  if (canonicalId(clientId) === null) return unavailable('malformed');

  const rawExecution = ownValue(stored, 'execution');
  if (!isPlainObject(rawExecution) || !hasOnlyKeys(rawExecution, EXECUTION_KEYS)) {
    return unavailable('malformed');
  }

  const index = indexSnapshot(snapshot);
  if (index === null) return unavailable('invalid_snapshot');

  const sampledMs = parseTimestamp(ownValue(rawExecution, 'sampledAt'));
  if (sampledMs === null) return unavailable('malformed');
  if (sampledMs > nowMs + FUTURE_SKEW_MS) return unavailable('future');
  if (nowMs - sampledMs > SAMPLE_MAX_AGE_MS) return unavailable('stale');

  const rawCalls = ownValue(rawExecution, 'activeCalls');
  if (!Array.isArray(rawCalls) || rawCalls.length > MAX_CALLS) {
    return unavailable('malformed');
  }

  const seen = new Set<string>();
  const calls: RuntimeExecution['activeCalls'] = [];
  for (const entry of rawCalls) {
    if (!isPlainObject(entry)) return unavailable('malformed');
    const jobId = canonicalId(ownValue(entry, 'jobId'));
    if (jobId === null || seen.has(jobId)) return unavailable('malformed');
    seen.add(jobId);

    const phase = ownValue(entry, 'phase');
    if (!isPhase(phase)) return unavailable('malformed');

    const startedRaw = ownValue(entry, 'startedAt');
    const startedMs = parseTimestamp(startedRaw);
    if (startedMs === null) return unavailable('malformed');
    if (startedMs > sampledMs + FUTURE_SKEW_MS) return unavailable('malformed');
    if (startedMs > nowMs + FUTURE_SKEW_MS) return unavailable('future');

    const job = index.jobs.get(jobId);
    if (job === undefined || !isLiveJob(job, index, nowMs) || !matchesCall(job, phase, startedMs)) continue;

    calls.push({ jobId, phase, startedAt: startedRaw as string });
  }

  return {
    available: true,
    execution: {
      sampledAt: ownValue(rawExecution, 'sampledAt') as string,
      activeCalls: calls,
    },
    receivedAt: receivedAt as string,
    reason: null,
  };
}
