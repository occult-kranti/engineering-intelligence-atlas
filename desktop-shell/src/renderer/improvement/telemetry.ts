/** Bounded, read-only projections of retained native records. No clocks, timers,
 * requests, persistence, inferred billing history or execution authority live here. */
export interface TelemetryScope { companyId: string; officeId?: string; departmentId?: string }
export interface TelemetryOptions {
  scope: TelemetryScope;
  now: string;
  sampledAt?: string;
  freshnessMs?: number;
  windowHours?: number;
  bins?: number;
  /** Runtime callback evidence only. A claimed job/lease is preparation, not a
   * provider call. The caller must not synthesize this from snapshot status. */
  workerEvidence?: { sampledAt: string; activeCalls: readonly { jobId: string; phase: 'provider' | 'model'; startedAt: string }[] };
}
export interface ActivityGroup {
  id: string;
  name: string;
  loadedEmployees: number;
  jobs: number;
  recordedRunning: number;
  leasedRunning: number | null;
  executing: number | null;
  queued: number;
  waitingBudget: number;
  paused: number;
  unverifiedRunning: number;
  unsupportedJobs: number;
  state: 'running' | 'preparing' | 'queued' | 'paused' | 'quiet' | 'unknown';
  label: string;
}
export interface TelemetryBin {
  from: string;
  to: string;
  finishedJobs: number;
  recordedOutputs: number;
  acceptedOutputs: number;
  observedUsd: number;
  estimatedUsd: number;
  unknownCostJobs: number;
}
export interface ImprovementTelemetry {
  available: boolean;
  reason: string | null;
  scope: TelemetryScope;
  sample: { status: 'fresh' | 'stale' | 'unknown'; at: string | null; ageMs: number | null };
  activity: {
    summary: ActivityGroup;
    runningEmployees: number | null;
    perEmployee: Record<string, ActivityGroup>;
    perDepartment: Record<string, ActivityGroup>;
  } | null;
  costs: { observedUsd: number; estimatedUsd: number; reservedUsd: number; committedUsd: number | null; unknownJobs: number } | null;
  outputs: { recorded: number; accepted: number; reviewRepair: number } | null;
  history: {
    basis: 'retained-native-jobs'; complete: false; from: string; to: string;
    costBasis: 'completed-job-cost-by-finish-time'; bins: TelemetryBin[];
    undatedJobs: number; excludedFutureJobs: number;
  } | null;
  /** Earliest time this projection's freshness/lease decision can change. */
  nextChangeAt: string | null;
  diagnostics: string[];
}

type Row = Record<string, unknown>;
const MAX_RECORDS = 60_000;
const MAX_BINS = 48;
const MAX_USD = 1e9;
const FRESHNESS_MS = 15_000;
const STATES = new Set(['queued', 'waiting-budget', 'running', 'paused', 'cancelled', 'completed', 'failed', 'budget-exhausted', 'needs-review']);
const TERMINAL = new Set(['cancelled', 'completed', 'failed', 'budget-exhausted', 'needs-review']);
const row = (v: unknown): Row | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Row : null;
const text = (v: unknown): string => typeof v === 'string' ? v : '';
const id = (v: unknown): string => typeof v === 'string' && v.length > 0 && v.length <= 160 && !/[\u0000-\u001f\u007f]/.test(v) ? v : '';
const timestamp = (v: unknown): number | null => {
  if (typeof v !== 'string' || v.length > 64 || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v)) return null;
  const n = Date.parse(v); return Number.isFinite(n) ? n : null;
};
const usd = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_USD ? v : null;
const hash = (v: unknown): string | null => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v) ? v.toLowerCase() : null;
const sameNullable = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

/** Acceptance requires the native paired identities and both current artifact
 * hashes. A completed provider request or a cached result is not acceptance. */
export function verifiedAcceptance(primary: unknown, jobs: ReadonlyMap<string, unknown>, now: number): { reviewId: string; recordedAt: number } | null {
  const p = row(primary), pp = row(p?.pair);
  if (!Number.isFinite(now) || !p || !id(p.id) || !id(p.companyId) || !id(p.officeId) || p.status !== 'completed' || p.reviewFailure || pp?.phase !== 'primary' || pp.primaryJobId !== p.id || !id(pp.stepId)) return null;
  const r = row(jobs.get(text(pp.reviewJobId))), rp = row(r?.pair), review = row(r?.review);
  if (!r || !id(r.id) || r.status !== 'completed' || r.reviewFailure || rp?.phase !== 'review' || r.employeeId === p.employeeId) return null;
  if (!id(p.employeeId) || !id(r.employeeId) || rp.primaryJobId !== p.id || rp.reviewJobId !== r.id || pp.reviewJobId !== r.id
      || pp.peerEmployeeId !== r.employeeId || rp.peerEmployeeId !== p.employeeId || rp.stepId !== pp.stepId) return null;
  if (p.companyId !== r.companyId || p.officeId !== r.officeId || !sameNullable(p.departmentId, r.departmentId)
      || !sameNullable(p.goalId, r.goalId) || !sameNullable(p.goalIteration, r.goalIteration)) return null;
  const ph = hash(p.artifactSha256), rh = hash(r.artifactSha256);
  if (!ph || !rh || review?.verdict !== 'accepted' || review.primaryArtifactComplete !== true
      || hash(review.primaryArtifactSha256) !== ph || hash(review.reviewArtifactSha256) !== rh) return null;
  const at = timestamp(review.recordedAt), pf = timestamp(p.finishedAt), rf = timestamp(r.finishedAt);
  if (at === null || pf === null || rf === null || at > now || at < pf || at < rf) return null;
  return { reviewId: text(r.id), recordedAt: at };
}

export function buildImprovementTelemetry(input: unknown, options: TelemetryOptions): ImprovementTelemetry {
  const source = row(input), now = timestamp(options?.now), sampled = timestamp(options?.sampledAt);
  const suppliedFreshness = options?.freshnessMs;
  const freshness = typeof suppliedFreshness === 'number' && Number.isFinite(suppliedFreshness)
    ? Math.max(1000, Math.min(60_000, suppliedFreshness)) : FRESHNESS_MS;
  const age = now !== null && sampled !== null && sampled <= now ? now - sampled : null;
  const fresh = age !== null && age <= freshness;
  const result: ImprovementTelemetry = {
    available: false, reason: null, scope: { ...options?.scope },
    sample: { status: age === null ? 'unknown' : fresh ? 'fresh' : 'stale', at: sampled === null ? null : new Date(sampled).toISOString(), ageMs: age },
    activity: null, costs: null, outputs: null, history: null, nextChangeAt: null, diagnostics: [],
  };
  const unavailable = (reason: string) => { result.reason = reason; return result; };
  if (!source || now === null || !id(options?.scope?.companyId)) return unavailable('A native snapshot, company scope and explicit timestamp are required.');
  if (options.scope.officeId !== undefined && !id(options.scope.officeId) || options.scope.departmentId !== undefined && !id(options.scope.departmentId)) return unavailable('The selected office and department identifiers must be valid.');
  let total = 0;
  function collection(value: unknown): Row[] | null {
    if (!Array.isArray(value) || (total += value.length) > MAX_RECORDS) return null;
    const ids = new Set<string>(), rows: Row[] = [];
    for (const valueRow of value) {
      const item = row(valueRow), key = id(item?.id);
      if (!item || !key || ids.has(key)) return null;
      ids.add(key); rows.push(item);
    }
    return rows;
  }
  const companies = collection(source.companies), offices = collection(source.offices), departments = collection(source.departments),
    employees = collection(source.employees), jobs = collection(source.jobs);
  if (!companies || !offices || !departments || !employees || !jobs) return unavailable('Native collections are invalid, duplicated or exceed the 60,000-record limit. No partial chart is shown.');
  const scope = result.scope;
  const company = companies.find(item => item.id === scope.companyId);
  if (!company) return unavailable('The selected company is not in this snapshot.');
  if (scope.departmentId) {
    const department = departments.find(item => item.id === scope.departmentId && item.companyId === scope.companyId);
    if (!department || !id(department.officeId) || scope.officeId && scope.officeId !== department.officeId) return unavailable('The department does not belong to the selected company and office.');
    scope.officeId = text(department.officeId);
  }
  if (scope.officeId && !offices.some(item => item.id === scope.officeId && item.companyId === scope.companyId)) return unavailable('The office does not belong to the selected company.');
  const matches = (item: Row) => item.companyId === scope.companyId && (!scope.officeId || item.officeId === scope.officeId)
    && (!scope.departmentId || item.departmentId === scope.departmentId);
  const execution = options.workerEvidence, executionAt = timestamp(execution?.sampledAt);
  const calls = new Map<string, number>();
  let executionFresh = fresh && executionAt !== null && executionAt <= now && now - executionAt <= freshness
    && Array.isArray(execution?.activeCalls) && execution.activeCalls.length <= 256;
  if (executionFresh) for (const value of execution!.activeCalls) {
    const call = row(value), key = id(call?.jobId), at = timestamp(call?.startedAt);
    if (!key || calls.has(key) || !['provider', 'model'].includes(text(call?.phase)) || at === null || at > executionAt!) { executionFresh = false; calls.clear(); break; }
    calls.set(key, at);
  }
  const selected = jobs.filter(matches), jobMap = new Map(jobs.map(item => [text(item.id), item])), employeeMap = new Map(employees.map(item => [text(item.id), item]));
  const group = (key: string, name: string): ActivityGroup => ({ id: key, name, loadedEmployees: 0, jobs: 0, recordedRunning: 0,
    leasedRunning: fresh ? 0 : null, executing: executionFresh ? 0 : null, queued: 0, waitingBudget: 0, paused: 0, unverifiedRunning: 0,
    unsupportedJobs: 0, state: 'unknown', label: 'Execution evidence unavailable' });
  const summary = group(scope.departmentId || scope.officeId || scope.companyId, text(company.name));
  const perEmployee: Record<string, ActivityGroup> = Object.create(null), perDepartment: Record<string, ActivityGroup> = Object.create(null);
  const loaded = new Set<string>(), running = new Set<string>();
  for (const employee of employees) if (matches(employee) && employee.status !== 'fired') {
    const key = text(employee.id); loaded.add(key); perEmployee[key] = group(key, text(employee.name)); perEmployee[key]!.loadedEmployees = 1;
  }
  for (const department of departments) if (department.companyId === scope.companyId && (!scope.officeId || department.officeId === scope.officeId) && (!scope.departmentId || department.id === scope.departmentId)) {
    const key = text(department.id); perDepartment[key] = group(key, text(department.name));
  }
  for (const employee of employees) if (loaded.has(text(employee.id)) && perDepartment[text(employee.departmentId)]) perDepartment[text(employee.departmentId)]!.loadedEmployees++;
  const costs = { observedUsd: 0, estimatedUsd: 0, reservedUsd: 0, committedUsd: 0 as number | null, unknownJobs: 0 };
  const outputs = { recorded: 0, accepted: 0, reviewRepair: 0 };
  const hours = typeof options.windowHours === 'number' && Number.isFinite(options.windowHours) ? Math.max(1, Math.min(168, options.windowHours)) : 24;
  const binCount = typeof options.bins === 'number' && Number.isFinite(options.bins) ? Math.max(1, Math.min(MAX_BINS, Math.floor(options.bins))) : 12;
  const start = now - hours * 3600_000, width = (now - start) / binCount;
  const bins: TelemetryBin[] = Array.from({ length: binCount }, (_, i) => ({ from: new Date(start + i * width).toISOString(), to: new Date(start + (i + 1) * width).toISOString(),
    finishedJobs: 0, recordedOutputs: 0, acceptedOutputs: 0, observedUsd: 0, estimatedUsd: 0, unknownCostJobs: 0 }));
  const binAt = (at: number) => at < start || at > now ? undefined : bins[Math.min(binCount - 1, Math.floor((at - start) / width))];
  let next = fresh && sampled !== null ? sampled + freshness + 1 : Infinity;
  if (executionFresh) next = Math.min(next, executionAt! + freshness + 1);
  let undatedJobs = 0, excludedFutureJobs = 0, unsupported = 0;
  for (const job of selected) {
    const employeeId = text(job.employeeId), employee = employeeMap.get(employeeId);
    if (employee && !perEmployee[employeeId]) perEmployee[employeeId] = group(employeeId, text(employee.name));
    const targets = [summary, perEmployee[employeeId], perDepartment[text(job.departmentId)]].filter((item): item is ActivityGroup => !!item);
    const status = text(job.status), lease = timestamp(job.leaseExpiresAt), started = timestamp(job.startedAt);
    const callStarted = calls.get(text(job.id));
    const matchingCall = executionFresh && callStarted !== undefined && started !== null && callStarted >= started;
    // The website deliberately redacts worker IDs. A fresh, callback-bound
    // server observation can corroborate that same current lease without
    // exposing the worker identity. A lease alone never proves execution.
    const leased = fresh && status === 'running' && lease !== null && lease > now && started !== null && started <= now && (!!id(job.workerId) || matchingCall) && !!employee;
    const executing = leased && matchingCall;
    if (leased) next = Math.min(next, lease!);
    if (executing) running.add(employeeId);
    if (!STATES.has(status)) unsupported++;
    for (const target of targets) {
      target.jobs++;
      if (status === 'running') { target.recordedRunning++; if (leased) target.leasedRunning = (target.leasedRunning ?? 0) + 1; else target.unverifiedRunning++; }
      if (executing) target.executing = (target.executing ?? 0) + 1;
      if (!STATES.has(status)) target.unsupportedJobs++;
      if (status === 'queued') target.queued++;
      if (status === 'waiting-budget') target.waitingBudget++;
      if (status === 'paused') target.paused++;
    }
    const cost = usd(row(job.usage)?.costUsd), costStatus = text(job.costStatus);
    const known = cost !== null && ['none', 'observed', 'estimated', 'reserved'].includes(costStatus) && (costStatus !== 'none' || cost === 0)
      && (costStatus !== 'observed' || job.usageRecorded === true);
    if (!known) costs.unknownJobs++;
    else if (costStatus === 'observed') costs.observedUsd += cost!;
    else if (costStatus === 'estimated') costs.estimatedUsd += cost!;
    else if (costStatus === 'reserved') costs.reservedUsd += cost!;
    const recordedOutput = status === 'completed' && !!hash(job.artifactSha256) && row(job.pair)?.phase !== 'review';
    if (recordedOutput) outputs.recorded++;
    if (job.reviewFailure) outputs.reviewRepair++;
    const accepted = verifiedAcceptance(job, jobMap, now);
    if (accepted) { outputs.accepted++; const bin = binAt(accepted.recordedAt); if (bin) bin.acceptedOutputs++; }
    if (!TERMINAL.has(status)) continue;
    const finished = timestamp(job.finishedAt);
    if (finished === null) { undatedJobs++; continue; }
    if (finished > now) { excludedFutureJobs++; continue; }
    const bin = binAt(finished); if (!bin) continue;
    bin.finishedJobs++; if (recordedOutput) bin.recordedOutputs++;
    if (!known || costStatus === 'reserved') bin.unknownCostJobs++;
    else if (costStatus === 'observed') bin.observedUsd += cost!;
    else if (costStatus === 'estimated') bin.estimatedUsd += cost!;
  }
  function finish(g: ActivityGroup): void {
    if (!fresh) { g.state = 'unknown'; g.label = result.sample.status === 'stale' ? 'Snapshot stale · current activity unknown' : 'Snapshot time unavailable · current activity unknown'; }
    else if ((g.executing ?? 0) > 0) { g.state = 'running'; g.label = `${g.executing} active provider calls · fresh runtime evidence`; }
    else if ((g.leasedRunning ?? 0) > 0) { g.state = 'preparing'; g.label = `${g.leasedRunning} leased / preparing · execution not confirmed`; }
    else if (g.unverifiedRunning) { g.state = 'unknown'; g.label = `${g.unverifiedRunning} recorded running · lease unverified`; }
    else if (g.unsupportedJobs) { g.state = 'unknown'; g.label = 'Unsupported job state · current activity unknown'; }
    else if (g.queued || g.waitingBudget) { g.state = 'queued'; g.label = `${g.queued} queued · ${g.waitingBudget} waiting for budget`; }
    else if (g.paused) { g.state = 'paused'; g.label = `${g.paused} paused jobs`; }
    else { g.state = 'quiet'; g.label = 'No recorded leased work'; }
  }
  summary.loadedEmployees = loaded.size;
  for (const g of [summary, ...Object.values(perEmployee), ...Object.values(perDepartment)]) finish(g);
  costs.committedUsd = costs.unknownJobs ? null : costs.observedUsd + costs.estimatedUsd + costs.reservedUsd;
  if (unsupported) result.diagnostics.push(`${unsupported} retained jobs have unsupported status; their activity is not inferred.`);
  if (costs.unknownJobs) result.diagnostics.push(`${costs.unknownJobs} jobs have incomplete cost evidence. Known amounts are subtotals.`);
  if (undatedJobs || excludedFutureJobs) result.diagnostics.push(`${undatedJobs} finished records lack a usable finish timestamp; ${excludedFutureJobs} future-dated records are omitted from history.`);
  result.available = true;
  result.activity = { summary, runningEmployees: executionFresh ? running.size : null, perEmployee, perDepartment };
  result.costs = costs; result.outputs = outputs;
  result.history = { basis: 'retained-native-jobs', complete: false, from: new Date(start).toISOString(), to: new Date(now).toISOString(),
    costBasis: 'completed-job-cost-by-finish-time', bins, undatedJobs, excludedFutureJobs };
  result.nextChangeAt = Number.isFinite(next) ? new Date(next).toISOString() : null;
  return result;
}
