// Pure planning module: no Node/DOM/time/network APIs, no globals, caches or timers.
// Heuristic ranges only: NOT probabilities, percentiles, confidence intervals or promises.
export const MAX_ITEMS = 1000;
export const MAX_EDGES = 20000;
const MAX_ID = 160;
const MIN_MIN = 0.01;
const MAX_MIN = 1440;
const ASSUMPTIONS = [
    'Dependency minutes are a lower bound: dependencies and the primary-then-review pair only, unlimited staff.',
    'Staffed minutes assume one slot per employee, all staff available at start, via a greedy serial schedule (feasible, possibly conservative, not optimal).',
    'No working calendar, provider, GPU or model capacity limits are modelled.',
    'Weighted = (optimistic + 4*likely + pessimistic)/6 per phase: a planning heuristic, not a confidence level or promise.',
    'Work already started is estimated at its full remaining duration because the actual remainder is unknown.',
];
const isRec = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const okNum = (n) => typeof n === 'number' && Number.isFinite(n) && n >= MIN_MIN && n <= MAX_MIN;
const okId = (s) => typeof s === 'string' && s.length > 0 && s.length <= MAX_ID;
function parseTriple(value) {
    if (!isRec(value))
        return null;
    const o = value['optimisticMinutes'], m = value['likelyMinutes'], p = value['pessimisticMinutes'];
    if (!okNum(o) || !okNum(m) || !okNum(p) || o > m || m > p)
        return null;
    return [o, m, p];
}
function toRange(o, m, p, w) {
    return { optimistic: o, likely: m, pessimistic: p, weighted: w };
}
/** Validates a native estimate; returns its range (weighted via PERT heuristic) or null if invalid. */
export function estimateMinutes(value) {
    const t = parseTriple(value);
    return t ? toRange(t[0], t[1], t[2], (t[0] + 4 * t[1] + t[2]) / 6) : null;
}
const weightedOf = (t) => (t[0] + 4 * t[1] + t[2]) / 6;
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
export function buildBoardForecast(items) {
    const issues = [];
    let invalid = false;
    const add = (code, message, itemId, structural = true) => {
        invalid ||= structural;
        if (issues.length < 100)
            issues.push(itemId === undefined ? { code, message } : { code, itemId, message });
        else if (issues.length === 100)
            issues.push({ code: 'further-issues-omitted', message: 'Further issues are omitted from this bounded summary.' });
    };
    const result = (valid, complete, known, total, dep, staffed, order) => ({
        methodVersion: 'paired-dag-v1', valid, complete, estimateCoverage: { known, total },
        dependencyMinutes: dep, staffedMinutes: staffed, issues, assumptions: ASSUMPTIONS.slice(), order,
    });
    if (!Array.isArray(items)) {
        add('invalid-input', 'Items must be an array.');
        return result(false, false, 0, 0, null, null, []);
    }
    if (items.length > MAX_ITEMS) {
        add('too-many-items', `Graph exceeds ${MAX_ITEMS} items.`);
        return result(false, false, 0, 0, null, null, []);
    }
    const nodes = new Map();
    const list = [];
    let edges = 0;
    let known = 0, total = 0;
    let incomplete = false;
    for (const raw of items) {
        if (!isRec(raw)) {
            add('invalid-item', 'Item is not an object.');
            continue;
        }
        const id = raw['id'];
        if (!okId(id)) {
            add('invalid-id', 'Item id must be a nonempty string of at most 160 chars.');
            continue;
        }
        if (nodes.has(id)) {
            add('duplicate-id', 'Duplicate item id.', id);
            continue;
        }
        const accepted = raw['accepted'] === true;
        const blocked = raw['blocked'] === true;
        for (const flag of ['accepted', 'blocked'])
            if (raw[flag] !== undefined && typeof raw[flag] !== 'boolean')
                add('invalid-state', `${flag} must be boolean.`, id);
        const emp = raw['employeeId'];
        const revRaw = raw['reviewerEmployeeId'];
        const depsRaw = raw['dependsOn'];
        const deps = [];
        if (!Array.isArray(depsRaw))
            add('invalid-dependencies', 'dependsOn must be an array.', id);
        else {
            const seen = new Set();
            for (const d of depsRaw) {
                edges++;
                if (edges > MAX_EDGES)
                    break;
                if (!okId(d)) {
                    add('invalid-dependency-id', 'Dependency id invalid.', id);
                    continue;
                }
                if (d === id) {
                    add('self-dependency', 'Item depends on itself.', id);
                    continue;
                }
                if (seen.has(d)) {
                    add('duplicate-edge', 'Duplicate dependency edge.', id);
                    continue;
                }
                seen.add(d);
                deps.push(d);
            }
        }
        if (edges > MAX_EDGES) {
            add('too-many-edges', `Graph exceeds ${MAX_EDGES} edges.`);
            return result(false, false, 0, 0, null, null, []);
        }
        let empId = '', revId = '';
        let prod = null, review = null;
        if (!accepted) {
            if (!okId(emp))
                add('invalid-employee', 'employeeId must be a nonempty string of at most 160 chars.', id);
            else
                empId = emp;
            if (revRaw === undefined || revRaw === null)
                add('missing-reviewer', 'Unaccepted work needs a reviewer.', id);
            else if (!okId(revRaw))
                add('invalid-reviewer', 'reviewerEmployeeId must be a nonempty string of at most 160 chars.', id);
            else if (revRaw === empId)
                add('self-review', 'Reviewer must differ from primary employee.', id);
            else
                revId = revRaw;
            total += 2;
            for (const [key, phase] of [['estimate', 0], ['reviewEstimate', 1]]) {
                const v = raw[key];
                if (v === undefined || v === null) {
                    incomplete = true;
                    add('estimate-missing', `${key} is not recorded.`, id, false);
                    continue;
                }
                const t = parseTriple(v);
                if (!t) {
                    add('invalid-estimate', `Invalid ${key}.`, id);
                    continue;
                }
                known++;
                if (phase === 0)
                    prod = t;
                else
                    review = t;
            }
            if (blocked) {
                incomplete = true;
                add('work-blocked', 'Work is blocked; no completion range can be forecast.', id, false);
            }
        }
        const node = { id, emp: empId, rev: revId, deps, accepted, blocked, prod, review };
        nodes.set(id, node);
        list.push(node);
    }
    for (const n of list) {
        for (const d of n.deps) {
            if (!nodes.has(d))
                add('unknown-dependency', `Dependency ${d} does not exist.`, n.id);
        }
    }
    // Kahn's algorithm with lexicographic tie-breaking; stable and permutation invariant.
    const indeg = new Map();
    const succ = new Map();
    for (const n of list) {
        indeg.set(n.id, 0);
        succ.set(n.id, []);
    }
    for (const n of list) {
        for (const d of n.deps) {
            if (!nodes.has(d))
                continue;
            indeg.set(n.id, (indeg.get(n.id) ?? 0) + 1);
            succ.get(d)?.push(n.id);
        }
    }
    let ready = list.filter((n) => indeg.get(n.id) === 0).map((n) => n.id).sort(cmp);
    const order = [];
    while (ready.length > 0) {
        const id = ready.shift();
        order.push(id);
        const freed = [];
        for (const s of succ.get(id) ?? []) {
            const v = (indeg.get(s) ?? 0) - 1;
            indeg.set(s, v);
            if (v === 0)
                freed.push(s);
        }
        if (freed.length > 0)
            ready = ready.concat(freed).sort(cmp);
    }
    if (order.length !== list.length) {
        const stuck = list.filter((n) => !order.includes(n.id)).map((n) => n.id).sort(cmp);
        add('cycle', `Dependency cycle involves: ${stuck.slice(0, 5).join(', ')}.`, stuck[0]);
    }
    const valid = !invalid;
    if (!valid)
        return result(false, false, known, total, null, null, order);
    if (list.length === 0) {
        const z = toRange(0, 0, 0, 0);
        return result(true, true, 0, 0, z, { ...z }, order);
    }
    if (incomplete)
        return result(true, false, known, total, null, null, order);
    const scenario = (pick, staffed) => {
        const finish = new Map();
        const free = new Map();
        let makespan = 0;
        for (const id of order) {
            const n = nodes.get(id);
            let ready0 = 0;
            for (const d of n.deps)
                ready0 = Math.max(ready0, finish.get(d) ?? 0);
            if (n.accepted) {
                finish.set(id, ready0);
                continue;
            }
            const pd = pick(n.prod), rd = pick(n.review);
            const ps = staffed ? Math.max(ready0, free.get(n.emp) ?? 0) : ready0;
            const pe = ps + pd;
            if (staffed)
                free.set(n.emp, pe);
            const rs = staffed ? Math.max(pe, free.get(n.rev) ?? 0) : pe;
            const re = rs + rd;
            if (staffed)
                free.set(n.rev, re);
            finish.set(id, re);
            makespan = Math.max(makespan, re);
        }
        return makespan;
    };
    const build = (staffed) => toRange(scenario((t) => t[0], staffed), scenario((t) => t[1], staffed), scenario((t) => t[2], staffed), scenario(weightedOf, staffed));
    return result(true, true, known, total, build(false), build(true), order);
}
function fmtDur(min) {
    if (min > 0 && min < 1)
        return '<1 min';
    const m = Number.isFinite(min) ? Math.max(0, Math.round(min)) : 0;
    if (m < 60)
        return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r === 0 ? `${h} h` : `${h} h ${r} min`;
}
export function formatMinuteRange(range) {
    if (!range || ![range.optimistic, range.likely, range.pessimistic, range.weighted].every(n => Number.isFinite(n) && n >= 0)
        || range.optimistic > range.likely || range.likely > range.pessimistic)
        return 'Estimate not available';
    return `Lower ${fmtDur(range.optimistic)}, likely ${fmtDur(range.likely)}, upper ${fmtDur(range.pessimistic)} (rounded planning range, not a promised finish)`;
}
