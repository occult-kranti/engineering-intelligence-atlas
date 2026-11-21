/**
 * Read-only, deterministic projections of the saved office record.
 * This file is a classic script: desktop, public preview and hosted renderer
 * execute the same implementation. It neither dispatches work nor stores state.
 */
namespace DaftarSignalModel {
  export type Level = 0 | 1 | 2 | 3 | 4 | 'unknown';
  export interface Metric {
    level: Level;
    value: number | null;
    numerator: number | null;
    denominator: number | null;
    ratio: number | null;
    unknown: boolean;
    label: string;
    detail: string;
  }
  export interface Group {
    id: string;
    name: string;
    jobs: number;
    employees: number;
    workload: Metric;
    budget: Metric;
    attention: Metric;
  }
  export interface Options {
    companyId?: string;
    officeId?: string;
    departmentId?: string;
    employeeId?: string;
    /** A caller-supplied clock makes deadline/lease decisions reproducible. */
    now: string;
    /** Time the bridge actually returned this snapshot, not last job activity. */
    sampledAt?: string;
    staleAfterMs?: number;
  }
  export interface LegendItem { level: Level; label: string; detail: string }
  export interface Result {
    version: 1;
    scopeValid: boolean;
    scope: { companyId: string | null; officeId: string | null; departmentId: string | null; employeeId: string | null };
    sample: { at: string | null; now: string | null; ageMs: number | null; stale: boolean; status: 'fresh' | 'stale' | 'unknown'; detail: string };
    summary: Group;
    perEmployee: Record<string, Group>;
    perDepartment: Record<string, Group>;
    perRoom: Record<string, Group>;
    globalBudget: Metric;
    legend: Record<'workload' | 'budget' | 'attention', readonly LegendItem[]>;
    diagnostics: { duplicateRecords: number; ambiguousPlacements: number; unplacedJobs: number; unknownStatusJobs: number; warnings: string[] };
  }
  type Row = Record<string, unknown>;
  interface Accumulator {
    id: string; name: string; jobs: number; people: Set<string>;
    unresolved: number; queued: number; running: number; paused: number; waitingBudget: number;
    attention: number; review: number; failed: number; exhausted: number; expired: number; dependencyBlocked: number;
    committed: number; observed: number; reserved: number; estimated: number; allowance: number;
    unknownStatus: number; unknownAttention: number; unknownBudget: number;
    zeroAllowanceSpend: boolean; attribution?: string;
  }
  const MAX_ITEMS = 60_000;
  const MAX_LINKS = 200_000;
  const NORMAL_STATUSES = new Set(['queued', 'waiting-budget', 'running', 'paused', 'cancelled', 'completed', 'failed', 'budget-exhausted', 'needs-review']);
  const UNRESOLVED = new Set(['queued', 'waiting-budget', 'running', 'paused']);
  const BLOCKING_DEPENDENCIES = new Set(['failed', 'cancelled', 'budget-exhausted', 'needs-review']);
  const record = (value: unknown): Row | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
  const str = (value: unknown): string => typeof value === 'string' ? value : '';
  const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
  const date = (value: unknown): number | null => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const own = <T>(): Record<string, T> => Object.create(null) as Record<string, T>;
  const money = (value: number): string => '$' + value.toFixed(value !== 0 && value < 0.01 ? 6 : 2);
  const percent = (ratio: number): string => ratio > 0 && ratio < 0.01 ? '<1%' : `${Math.floor(ratio * 100 + Number.EPSILON * Math.max(1, ratio * 100) * 4)}%`;
  const plural = (value: number, noun: string): string => `${value} ${noun}${value === 1 ? '' : 's'}`;
  const unknown = (detail: string, numerator: number | null = null, denominator: number | null = null): Metric => ({ level: 'unknown', value: numerator, numerator, denominator, ratio: null, unknown: true, label: 'No comparable data', detail });
  const accumulator = (id: string, name: string): Accumulator => ({ id, name, jobs: 0, people: new Set(), unresolved: 0, queued: 0, running: 0, paused: 0, waitingBudget: 0, attention: 0, review: 0, failed: 0, exhausted: 0, expired: 0, dependencyBlocked: 0, committed: 0, observed: 0, reserved: 0, estimated: 0, allowance: 0, unknownStatus: 0, unknownAttention: 0, unknownBudget: 0, zeroAllowanceSpend: false });

  const LEGEND: Result['legend'] = {
    workload: [
      { level: 0, label: '0 unresolved', detail: 'Recorded jobs exist; none are queued, running, waiting for budget or paused.' },
      { level: 1, label: '1–2 unresolved', detail: 'Count of retained unfinished jobs, not employee utilization.' },
      { level: 2, label: '3–5 unresolved', detail: 'The same absolute count threshold applies in every scope.' },
      { level: 3, label: '6–9 unresolved', detail: 'Queue size does not establish available compute or employee capacity.' },
      { level: 4, label: '10+ unresolved', detail: 'Inspect the queue and ownership before deciding to add staff.' },
      { level: 'unknown', label: 'Unknown / stale', detail: 'No job records, unsupported data or an explicitly stale snapshot.' },
    ],
    budget: [
      { level: 0, label: '0% committed', detail: 'Known positive job allowances and no recorded commitment.' },
      { level: 1, label: 'Under 50%', detail: 'Recorded commitment divided by the sum of individual job allowances.' },
      { level: 2, label: '50–79%', detail: 'This comparison is not a company budget or shared spending allocation.' },
      { level: 3, label: '80–99%', detail: 'Observed, reserved and estimated cost remain identified separately.' },
      { level: 4, label: '100%+ / zero-allowance spend', detail: 'At or above recorded job allowances, or spending against an explicit zero allowance.' },
      { level: 'unknown', label: 'Unknown / stale', detail: 'Missing cost, missing/zero allowance without spend, no jobs or an explicitly stale snapshot.' },
    ],
    attention: [
      { level: 0, label: '0 flagged jobs', detail: 'No listed condition in the available records; this is not a security or health assessment.' },
      { level: 1, label: '1 flagged job', detail: 'Review, failure, exhausted/waiting budget, expired lease or a terminal dependency.' },
      { level: 2, label: '2–3 flagged jobs', detail: 'A job with several conditions is counted once.' },
      { level: 3, label: '4–5 flagged jobs', detail: 'Historical failed/review jobs remain visible until their actual state changes.' },
      { level: 4, label: '6+ flagged jobs', detail: 'Inspect the recorded reasons; intensity does not imply urgency or threat severity.' },
      { level: 'unknown', label: 'Unknown / stale', detail: 'Missing dependency/lease evidence, no records, unsupported data or stale sample.' },
    ],
  };
  // Callers may render these values but cannot silently modify future legends.
  for (const items of Object.values(LEGEND)) { for (const item of items) Object.freeze(item); Object.freeze(items); }
  Object.freeze(LEGEND);

  function countMetric(value: number, thresholds: readonly number[], noun: string, detail: string): Metric {
    const level = (value === 0 ? 0 : value < thresholds[0]! ? 1 : value < thresholds[1]! ? 2 : value < thresholds[2]! ? 3 : 4) as Level;
    return { level, value, numerator: value, denominator: null, ratio: null, unknown: false, label: plural(value, noun), detail };
  }
  function budgetMetric(committed: number, allowance: number, detail: string, zeroAllowanceSpend = false): Metric {
    if (zeroAllowanceSpend || allowance === 0 && committed > 0) return { level: 4, value: committed, numerator: committed, denominator: allowance, ratio: allowance > 0 ? committed / allowance : null, unknown: false, label: 'Spend with zero allowance', detail };
    if (allowance === 0) return unknown('The recorded allowance is zero; no budget percentage is available. ' + detail, committed, allowance);
    const ratio = committed / allowance;
    return { level: ratio === 0 ? 0 : ratio < 0.5 ? 1 : ratio < 0.8 ? 2 : ratio < 1 ? 3 : 4, value: committed, numerator: committed, denominator: allowance, ratio, unknown: false, label: `${percent(ratio)} job allowance`, detail };
  }
  function finish(a: Accumulator, stale: boolean, fallback?: string): Group {
    const jobDetail = `${a.queued} queued · ${a.running} recorded running · ${a.waitingBudget} waiting for budget · ${a.paused} paused. Counts describe saved work, not worker capacity or CPU use.`;
    const attentionDetail = `${a.review} need review · ${a.failed} failed · ${a.exhausted} budget exhausted · ${a.waitingBudget} waiting for budget · ${a.expired} expired leases · ${a.dependencyBlocked} blocked by terminal dependencies. Distinct jobs are counted once; conditions may overlap. A dispatch due time is not a deadline.`;
    const budgetDetail = `${money(a.observed)} observed + ${money(a.reserved)} reserved + ${money(a.estimated)} estimated = ${money(a.committed)} committed / ${money(a.allowance)} summed job allowances. Reservations already included in usage are not added again; pending admission is not spend. This is not a scope spending allocation.`;
    const reason = fallback || (stale ? 'The supplied snapshot is stale; values below are historical, not current signals.' : a.jobs === 0 ? 'No job records in this scope. An empty record is not evidence of idle capacity or healthy execution.' : '');
    const withAttribution = (detail: string) => detail + (a.attribution ? ' ' + a.attribution : '');
    return {
      id: a.id, name: a.name, jobs: a.jobs, employees: a.people.size,
      workload: reason || a.unknownStatus ? unknown(reason || 'One or more job statuses are unsupported.', a.unresolved) : countMetric(a.unresolved, [3, 6, 10], 'unresolved job', withAttribution(jobDetail)),
      budget: reason || a.unknownBudget ? unknown(reason || 'One or more jobs have missing/invalid cost or allowance data. Known costs are retained, but a complete ratio is unavailable.', a.committed, a.allowance) : budgetMetric(a.committed, a.allowance, withAttribution(budgetDetail), a.zeroAllowanceSpend),
      attention: reason || a.unknownStatus || a.unknownAttention ? unknown(reason || 'A running lease, dependency or job status could not be verified from the supplied record. Known flagged jobs are retained.', a.attention) : countMetric(a.attention, [2, 4, 6], 'flagged job', withAttribution(attentionDetail)),
    };
  }

  export function build(input: unknown, options: Options): Result {
    const source = record(input);
    const now = date(options?.now);
    const sampledAt = date(options?.sampledAt);
    const threshold = number(options?.staleAfterMs) ?? 5 * 60_000;
    const age = now !== null && sampledAt !== null && sampledAt <= now ? now - sampledAt : null;
    const stale = age !== null && age > threshold;
    const sample: Result['sample'] = { at: sampledAt === null ? null : new Date(sampledAt).toISOString(), now: now === null ? null : new Date(now).toISOString(), ageMs: age, stale, status: age === null ? 'unknown' : stale ? 'stale' : 'fresh', detail: age === null ? 'Snapshot receipt time is unavailable or invalid; this view describes saved records, not live telemetry.' : stale ? 'Snapshot age exceeds the configured freshness window; current-intensity colors are suppressed.' : 'Age measures the caller-supplied bridge receipt time, not provider telemetry.' };
    const scope: Result['scope'] = { companyId: str(options?.companyId) || null, officeId: str(options?.officeId) || null, departmentId: str(options?.departmentId) || null, employeeId: str(options?.employeeId) || null };
    const diagnostics: Result['diagnostics'] = { duplicateRecords: 0, ambiguousPlacements: 0, unplacedJobs: 0, unknownStatusJobs: 0, warnings: [] };
    const empty = (reason: string): Result => ({ version: 1, scopeValid: false, scope, sample, summary: finish(accumulator('scope', 'Selected scope'), stale, reason), perEmployee: own(), perDepartment: own(), perRoom: own(), globalBudget: unknown(reason), legend: LEGEND, diagnostics: { ...diagnostics, warnings: [...diagnostics.warnings, reason] } });
    if (!source || now === null) return empty('A valid office snapshot and explicit ISO clock are required.');
    let items = 0; let links = 0;
    function collection(value: unknown, required = false): Row[] | null {
      if (value === undefined && !required) return [];
      if (!Array.isArray(value) || (items += value.length) > MAX_ITEMS) return null;
      const result: Row[] = []; const seen = new Set<string>();
      for (const item of value) {
        const row = record(item); const id = str(row?.id);
        if (!row || !id || id.length > 100) return null;
        if (seen.has(id)) { diagnostics.duplicateRecords++; continue; }
        seen.add(id); result.push(row);
      }
      return result;
    }
    const companies = collection(source.companies, true), offices = collection(source.offices, true), departments = collection(source.departments, true), employees = collection(source.employees, true), jobs = collection(source.jobs, true), blueprints = collection(source.blueprints);
    const portfolio = record(source.portfolio); const contracts = collection(portfolio?.contracts);
    if (!companies || !offices || !departments || !employees || !jobs || !blueprints || !contracts) return empty('Office collections are invalid or exceed the 60,000-record projection limit. No partial heatmap is shown.');
    const byId = (rows: Row[]): Map<string, Row> => new Map(rows.map(row => [str(row.id), row]));
    const companyMap = byId(companies), officeMap = byId(offices), departmentMap = byId(departments), employeeMap = byId(employees), jobMap = byId(jobs);
    if (scope.departmentId) {
      const department = departmentMap.get(scope.departmentId);
      if (!department || scope.companyId && department.companyId !== scope.companyId || scope.officeId && department.officeId !== scope.officeId) return empty('The selected department does not belong to the selected company/office.');
      scope.companyId = str(department.companyId); scope.officeId = str(department.officeId);
    }
    if (scope.officeId) {
      const office = officeMap.get(scope.officeId);
      if (!office || scope.companyId && office.companyId !== scope.companyId) return empty('The selected office does not belong to the selected company.');
      scope.companyId = str(office.companyId);
    }
    if (scope.companyId && !companyMap.has(scope.companyId)) return empty('The selected company is unavailable.');
    if (scope.employeeId && !employeeMap.has(scope.employeeId)) return empty('The selected employee is unavailable.');
    const locationMatches = (row: Row): boolean => (!scope.companyId || row.companyId === scope.companyId) && (!scope.officeId || row.officeId === scope.officeId) && (!scope.departmentId || row.departmentId === scope.departmentId);
    const selectedJobs = jobs.filter(job => locationMatches(job) && (!scope.employeeId || job.employeeId === scope.employeeId));
    const eligibleEmployees = new Set(employees.filter(e => locationMatches(e) && (!scope.employeeId || e.id === scope.employeeId)).map(e => str(e.id)));
    for (const job of selectedJobs) if (employeeMap.has(str(job.employeeId))) eligibleEmployees.add(str(job.employeeId));
    for (const contract of contracts) {
      const employeeIds = contract.employeeIds;
      if (!Array.isArray(employeeIds) || (links += employeeIds.length) > MAX_LINKS) return empty('Contract/blueprint/dependency links exceed the bounded projection limit or are invalid.');
      const recipientMatches = (!scope.companyId || contract.recipientCompanyId === scope.companyId)
        && (!scope.officeId || !contract.recipientOfficeId || contract.recipientOfficeId === scope.officeId)
        && (!scope.departmentId || !contract.recipientDepartmentId || contract.recipientDepartmentId === scope.departmentId);
      if (contract.status !== 'active' || !recipientMatches) continue;
      for (const id of employeeIds) if (typeof id === 'string' && employeeMap.has(id) && (!scope.employeeId || id === scope.employeeId)) eligibleEmployees.add(id);
    }
    // A borrowed employee may be included through an actual scoped job/contract,
    // but selecting a foreign employee never expands the selected job scope.
    if (scope.employeeId && !eligibleEmployees.has(scope.employeeId)) return empty('The employee has no assignment, active exact-scope contract or recorded job in this scope.');
    const summary = accumulator('scope', scope.employeeId ? str(employeeMap.get(scope.employeeId)?.name) : scope.departmentId ? str(departmentMap.get(scope.departmentId)?.name) : scope.officeId ? str(officeMap.get(scope.officeId)?.name) : scope.companyId ? str(companyMap.get(scope.companyId)?.name) : 'All companies');
    const employeeGroups = new Map<string, Accumulator>();
    for (const id of eligibleEmployees) { employeeGroups.set(id, accumulator(id, str(employeeMap.get(id)?.name) || id)); summary.people.add(id); employeeGroups.get(id)!.people.add(id); }
    const departmentGroups = new Map<string, Accumulator>();
    for (const department of departments) {
      if ((!scope.companyId || department.companyId === scope.companyId) && (!scope.officeId || department.officeId === scope.officeId) && (!scope.departmentId || department.id === scope.departmentId)) departmentGroups.set(str(department.id), accumulator(str(department.id), str(department.name) || str(department.id)));
    }
    for (const id of eligibleEmployees) { const department = departmentGroups.get(str(employeeMap.get(id)?.departmentId)); if (department) department.people.add(id); }
    const roomGroups = new Map<string, Accumulator>();
    const roomOwners = new Map<string, string>();
    const roomOffice = new Map<string, string>();
    const ambiguousRoomIds = new Set<string>();
    const officeOwnerKey = (officeId: string, employeeId: string): string => JSON.stringify([officeId, employeeId]);
    for (const blueprint of blueprints) {
      const rooms = blueprint.rooms, desks = blueprint.desks;
      if (!Array.isArray(rooms) || !Array.isArray(desks) || (links += rooms.length + desks.length) > MAX_LINKS) return empty('Contract/blueprint/dependency links exceed the bounded projection limit or are invalid.');
      if (scope.companyId && blueprint.companyId !== scope.companyId || scope.officeId && blueprint.officeId !== scope.officeId) continue;
      const localRooms = new Set<string>();
      for (const candidate of rooms) {
        const room = record(candidate); const id = str(room?.id);
        if (!room || !id || id.length > 100) return empty('A room identifier is invalid; no partial heatmap is shown.');
        if (scope.departmentId && room.departmentId !== scope.departmentId) continue;
        if (localRooms.has(id)) { diagnostics.duplicateRecords++; continue; }
        localRooms.add(id);
        if (roomGroups.has(id)) { ambiguousRoomIds.add(id); continue; }
        const group = accumulator(id, str(room.name) || id); group.attribution = 'Room jobs follow one saved desk placement per employee in the job execution office; unplaced jobs remain in scope totals.';
        roomGroups.set(id, group); roomOffice.set(id, str(blueprint.officeId));
      }
      for (const candidate of desks) {
        const desk = record(candidate); const roomId = str(desk?.roomId), employeeId = str(desk?.employeeId);
        if (!desk || !localRooms.has(roomId) || !eligibleEmployees.has(employeeId)) continue;
        const key = officeOwnerKey(str(blueprint.officeId), employeeId);
        const previous = roomOwners.get(key);
        if (previous) { diagnostics.ambiguousPlacements++; if (roomId < previous) roomOwners.set(key, roomId); }
        else roomOwners.set(key, roomId);
      }
    }
    for (const [key, roomId] of roomOwners) {
      if (ambiguousRoomIds.has(roomId)) continue;
      const [, employeeId] = JSON.parse(key) as [string, string]; roomGroups.get(roomId)?.people.add(employeeId);
    }
    for (const job of jobs) {
      if (!Array.isArray(job.dependencies) || (links += job.dependencies.length) > MAX_LINKS) return empty('Contract/blueprint/dependency links exceed the bounded projection limit or are invalid.');
    }
    for (const job of selectedJobs) {
      const status = str(job.status), employeeId = str(job.employeeId);
      const knownStatus = NORMAL_STATUSES.has(status);
      if (!knownStatus) diagnostics.unknownStatusJobs++;
      const expired = status === 'running' && date(job.leaseExpiresAt) !== null && date(job.leaseExpiresAt)! <= now;
      let unknownAttention = status === 'running' && date(job.leaseExpiresAt) === null;
      let dependencyBlocked = false;
      if (UNRESOLVED.has(status)) for (const id of job.dependencies as unknown[]) {
        const dependency = jobMap.get(str(id));
        if (!dependency || !NORMAL_STATUSES.has(str(dependency.status))) unknownAttention = true;
        else if (BLOCKING_DEPENDENCIES.has(str(dependency.status))) dependencyBlocked = true;
      }
      const flagged = ['needs-review', 'failed', 'budget-exhausted', 'waiting-budget'].includes(status) || expired || dependencyBlocked;
      const costStatus = str(job.costStatus), cost = number(record(job.usage)?.costUsd), allowance = number(record(job.limits)?.maxUsd);
      const knownCost = ['none', 'observed', 'reserved', 'estimated'].includes(costStatus) && cost !== null && (costStatus !== 'none' || cost === 0);
      const commitment = knownCost && costStatus !== 'none' ? cost! : 0;
      const targets = new Set<Accumulator>([summary]);
      const employee = employeeGroups.get(employeeId); if (employee) targets.add(employee);
      const department = departmentGroups.get(str(job.departmentId)); if (department) targets.add(department);
      const roomId = roomOwners.get(officeOwnerKey(str(job.officeId), employeeId));
      const room = roomId && !ambiguousRoomIds.has(roomId) && roomOffice.get(roomId) === job.officeId ? roomGroups.get(roomId) : undefined;
      if (room) targets.add(room); else diagnostics.unplacedJobs++;
      for (const target of targets) {
        target.jobs++; if (employeeMap.has(employeeId)) target.people.add(employeeId);
        if (!knownStatus) target.unknownStatus++;
        if (UNRESOLVED.has(status)) target.unresolved++;
        if (status === 'queued') target.queued++; if (status === 'running') target.running++; if (status === 'paused') target.paused++; if (status === 'waiting-budget') target.waitingBudget++;
        if (flagged) target.attention++; if (status === 'needs-review') target.review++; if (status === 'failed') target.failed++; if (status === 'budget-exhausted') target.exhausted++; if (expired) target.expired++; if (dependencyBlocked) target.dependencyBlocked++;
        if (unknownAttention) target.unknownAttention++;
        if (!knownCost || allowance === null) target.unknownBudget++;
        target.committed += commitment; target.allowance += allowance ?? 0;
        if (knownCost && costStatus === 'observed') target.observed += commitment; if (knownCost && costStatus === 'reserved') target.reserved += commitment; if (knownCost && costStatus === 'estimated') target.estimated += commitment;
        if (allowance === 0 && commitment > 0) target.zeroAllowanceSpend = true;
      }
    }
    if (diagnostics.duplicateRecords) diagnostics.warnings.push('Duplicate record identifiers were counted once.');
    if (diagnostics.ambiguousPlacements) diagnostics.warnings.push('Multiple saved placements were resolved to the lexicographically first room ID per employee/office, preventing duplicate job totals.');
    if (ambiguousRoomIds.size) diagnostics.warnings.push('Room IDs reused across offices have unknown room signals; select one office for unambiguous room attribution.');
    const groups = (map: Map<string, Accumulator>, rooms = false): Record<string, Group> => {
      const result = own<Group>();
      for (const [id, value] of map) result[id] = finish(value, stale, rooms && ambiguousRoomIds.has(id) ? 'This room ID is reused across multiple offices. Select one office to resolve its signals.' : undefined);
      return result;
    };
    const policy = record(record(source.policy)?.budget), nativeBudget = record(source.budget);
    const globalCost = number(nativeBudget?.committedUsd), globalLimit = number(policy?.hardCapUsd);
    let globalBudget = globalCost === null || globalLimit === null || stale ? unknown(stale ? 'The supplied global budget snapshot is stale.' : 'The native global budget summary or ceiling is unavailable.', globalCost, globalLimit) : budgetMetric(globalCost, globalLimit, `${money(globalCost)} native global commitment / ${money(globalLimit)} global ceiling. This separate native summary includes external allocations; it is not assigned to employees or rooms.`);
    if (!globalBudget.unknown && globalBudget.ratio !== null) globalBudget = { ...globalBudget, label: `${percent(globalBudget.ratio)} global ceiling` };
    return { version: 1, scopeValid: true, scope, sample, summary: finish(summary, stale), perEmployee: groups(employeeGroups), perDepartment: groups(departmentGroups), perRoom: groups(roomGroups, true), globalBudget, legend: LEGEND, diagnostics };
  }
}

const DaftarSignals = Object.freeze({ version: 1 as const, build: DaftarSignalModel.build });
(globalThis as typeof globalThis & { DaftarSignals: typeof DaftarSignals }).DaftarSignals = DaftarSignals;
