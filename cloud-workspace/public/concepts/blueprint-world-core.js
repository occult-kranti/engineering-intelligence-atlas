/**
 * Blueprint world core — synthetic local demo data, no runtime/provider authority.
 * Run blueprint-world-20261121, node core, attempt 1.
 * Initial source partially authored by Claude Sonnet request
 * 227945a3-4af8-4287-a63b-8b81340656f3 (max_tokens, incomplete).
 * Remaining functions and concrete correctness repairs completed locally.
 * Acceptance evidence is recorded separately; this is not a live-agent runtime.
 */
export const LIMITS = Object.freeze({
  companies: 100, rootDepartmentsPerCompany: 32, departmentDepth: 2, childrenPerDepartment: 4,
  departments: 4096, employees: 1000, assignments: 2000, tasks: 500, notes: 500,
  companyWidth: 1100, nameLength: 60, textLength: 300, searchResults: 60,
  coordinateLimit: 1000000, storageBytes: 2097152
});
export const COLORS = Object.freeze({
  ceo: "#d3b570", director: "#d3b570", donna: "#78b6ad", leadership: "#d3b570",
  product: "#7ba8c5", engineering: "#7b9bc9", design: "#d79f91", research: "#ae9bc7",
  operations: "#91b69b", employee: "#a8b5c4", visiting: "#cca16b", shared: "#9b8bc7",
  restricted: "#424957", company: "#f2eddf", board: "#e8e1d3", note: "#e6cb7f"
});
const KEY = "daftar-blueprint-world-v1";
const KINDS = ["resident", "shared", "visiting"], STATUSES = ["todo", "doing", "done"], LANES = ["now", "next", "later"];
const DEPTS = ["Leadership", "Product", "Engineering", "Design", "Research", "Operations"];
const DCOL = [COLORS.leadership, COLORS.product, COLORS.engineering, COLORS.design, COLORS.research, COLORS.operations];
const BOARDS = ["roadmap", "ownership", "whiteboard", "hierarchy"];
const PFX = { company: "co", office: "of", department: "dp", employee: "em", assignment: "as", task: "tk", note: "nt" };
const ARR = ["companies", "offices", "departments", "employees", "assignments", "tasks", "notes"];
const SEAT_R = 18, SEAT_GAP = 64, NOTE_W = 80, NOTE_H = 48;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const fin = (n) => typeof n === "number" && Number.isFinite(n);
const isId = (v, p) => typeof v === "string" && v.length <= 80 && new RegExp("^" + p + "-[A-Za-z0-9-]{1,76}$").test(v);
const isColor = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const fail = (m) => { throw new Error(m); };

function text(v, max, label) {
  if (typeof v !== "string") fail(label + " must be a string");
  const s = v.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!s) fail(label + " must not be empty");
  if (s.length > max) fail(label + " is too long (max " + max + ")");
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(s)) fail(label + " contains control characters");
  return s;
}
const name = (v, l) => text(v, LIMITS.nameLength, l);
const lc = (s) => s.toLowerCase();
const num = (v, l) => { if (!fin(v) || Math.abs(v) > LIMITS.coordinateLimit) fail(l + " must be a finite bounded number"); return v; };

function uid(prefix, used, seed) {
  const base = (seed || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  let n = 0, id;
  do {
    id = prefix + "-" + (base ? base : "x") + (n ? "-" + n : (base ? "" : "1"));
    if (id.length > 80) id = id.slice(0, 80);
    n++;
  } while (used.has(id) && n < 100000);
  if (used.has(id)) fail("Unable to allocate ID");
  used.add(id);
  return id;
}
function idSet(state, key) { return new Set(state[key].map((r) => r.id)); }

function ref(value, prefix, label, nullable = false) {
  if (nullable && (value === null || value === undefined)) return null;
  if (!isId(value, prefix)) fail(label + " must be a valid " + prefix + " ID");
  return value;
}
function assertWritableState(state) {
  if (!isObj(state)) fail("State must be a mutable plain object");
  for (const key of ARR) {
    const d = Object.getOwnPropertyDescriptor(state, key);
    if (!d || !("value" in d) || !d.writable) fail("State arrays must be writable data properties");
  }
}

export function validateState(raw) {
  if (!isObj(raw)) fail("State must be an object");
  if (Object.values(Object.getOwnPropertyDescriptors(raw)).some((d) => !("value" in d))) fail("State contains accessor properties");
  if (raw.version !== 1) fail("Unsupported state version");
  const caps = { companies: LIMITS.companies, offices: LIMITS.companies, departments: LIMITS.departments, employees: LIMITS.employees, assignments: LIMITS.assignments, tasks: LIMITS.tasks, notes: LIMITS.notes };
  for (const k of ARR) {
    if (!Array.isArray(raw[k])) fail(k + " must be an array");
    if (raw[k].length > caps[k]) fail(k + " exceeds limit " + caps[k]);
    for (const r of raw[k]) {
      if (!isObj(r)) fail(k + " contains a non-object record");
      if (Object.values(Object.getOwnPropertyDescriptors(r)).some((d) => !("value" in d))) fail(k + " contains accessor properties");
    }
  }
  const out = { version: 1 };
  const ids = {};
  const uniq = (k, p, r) => {
    if (!isId(r.id, p)) fail("Invalid " + k + " ID");
    ids[k] = ids[k] || new Set();
    if (ids[k].has(r.id)) fail("Duplicate " + k + " ID " + r.id);
    ids[k].add(r.id);
  };
  out.companies = raw.companies.map((r) => {
    uniq("companies", "co", r);
    const o = { id: r.id, name: name(r.name, "Company name"), parentId: r.parentId === null || r.parentId === undefined ? null : r.parentId, x: num(r.x, "Company x"), z: num(r.z, "Company z"), width: LIMITS.companyWidth, officeId: r.officeId, directorId: r.directorId, assistantId: r.assistantId };
    if (r.width !== LIMITS.companyWidth) fail("Company width must be " + LIMITS.companyWidth);
    return o;
  });
  out.offices = raw.offices.map((r) => { uniq("offices", "of", r); return { id: r.id, companyId: r.companyId, name: name(r.name, "Office name") }; });
  out.departments = raw.departments.map((r) => {
    uniq("departments", "dp", r);
    if (!isColor(r.color)) fail("Invalid department color");
    if (!Number.isInteger(r.order) || r.order < 0 || r.order > 1e6) fail("Invalid department order");
    return { id: r.id, companyId: r.companyId, officeId: r.officeId, parentId: r.parentId === undefined ? null : r.parentId, name: name(r.name, "Department name"), color: r.color, order: r.order };
  });
  out.employees = raw.employees.map((r) => {
    uniq("employees", "em", r);
    return { id: r.id, homeCompanyId: r.homeCompanyId, name: name(r.name, "Employee name"), role: name(r.role, "Employee role"), reportsToId: r.reportsToId === undefined ? null : r.reportsToId };
  });
  out.assignments = raw.assignments.map((r) => {
    uniq("assignments", "as", r);
    if (!KINDS.includes(r.kind)) fail("Invalid assignment kind");
    const x = r.x === undefined ? null : r.x, y = r.y === undefined ? null : r.y;
    if ((x === null) !== (y === null)) fail("Assignment x/y must both be null or both finite");
    if (x !== null) { num(x, "Assignment x"); num(y, "Assignment y"); }
    return { id: r.id, employeeId: r.employeeId, companyId: r.companyId, departmentId: r.departmentId, kind: r.kind, x, y };
  });
  out.tasks = raw.tasks.map((r) => {
    uniq("tasks", "tk", r);
    if (!STATUSES.includes(r.status)) fail("Invalid task status");
    if (!LANES.includes(r.lane)) fail("Invalid task lane");
    return { id: r.id, companyId: r.companyId, departmentId: r.departmentId === undefined ? null : r.departmentId, title: text(r.title, LIMITS.textLength, "Task title"), ownerId: r.ownerId === undefined ? null : r.ownerId, status: r.status, lane: r.lane };
  });
  out.notes = raw.notes.map((r) => {
    uniq("notes", "nt", r);
    if (!isColor(r.color)) fail("Invalid note color");
    const x = r.x === undefined ? null : r.x, y = r.y === undefined ? null : r.y;
    if ((x === null) !== (y === null)) fail("Note x/y must both be null or both finite");
    if (x !== null) { num(x, "Note x"); num(y, "Note y"); }
    return { id: r.id, companyId: r.companyId, text: text(r.text, LIMITS.textLength, "Note text"), color: r.color, x, y };
  });
  for (const c of out.companies) {
    c.parentId = ref(c.parentId, "co", "Company parent", true);
    ref(c.officeId, "of", "Company office"); ref(c.directorId, "em", "Director"); ref(c.assistantId, "em", "Assistant");
    if (c.directorId === c.assistantId) fail("Director and Donna must be distinct employee definitions");
  }
  for (const o of out.offices) ref(o.companyId, "co", "Office company");
  for (const d of out.departments) {
    ref(d.companyId, "co", "Department company"); ref(d.officeId, "of", "Department office");
    d.parentId = ref(d.parentId, "dp", "Department parent", true);
  }
  for (const e of out.employees) {
    ref(e.homeCompanyId, "co", "Employee home company"); e.reportsToId = ref(e.reportsToId, "em", "Reporting employee", true);
  }
  for (const a of out.assignments) {
    ref(a.employeeId, "em", "Assignment employee"); ref(a.companyId, "co", "Assignment company"); ref(a.departmentId, "dp", "Assignment department");
  }
  for (const t of out.tasks) {
    ref(t.companyId, "co", "Task company"); t.departmentId = ref(t.departmentId, "dp", "Task department", true);
    t.ownerId = ref(t.ownerId, "em", "Task owner", true);
  }
  for (const n of out.notes) {
    ref(n.companyId, "co", "Note company");
    if (n.x !== null) Object.assign(n, notePoint(n));
  }
  checkRefs(out);
  return out;
}

function checkRefs(s) {
  const co = new Map(s.companies.map((c) => [c.id, c]));
  const of = new Map(s.offices.map((o) => [o.id, o]));
  const dp = new Map(s.departments.map((d) => [d.id, d]));
  const em = new Map(s.employees.map((e) => [e.id, e]));
  // companies
  const cnames = new Set();
  const officeCount = new Map();
  for (const o of s.offices) {
    if (!co.has(o.companyId)) fail("Office references unknown company");
    officeCount.set(o.companyId, (officeCount.get(o.companyId) || 0) + 1);
  }
  for (const c of s.companies) {
    const k = lc(c.name);
    if (cnames.has(k)) fail("Duplicate company name: " + c.name);
    cnames.add(k);
    if (c.parentId !== null && !co.has(c.parentId)) fail("Company parent not found");
    if (officeCount.get(c.id) !== 1) fail("Company must have exactly one office");
    const o = of.get(c.officeId);
    if (!o || o.companyId !== c.id) fail("Company office invalid");
    for (const f of ["directorId", "assistantId"]) {
      const e = em.get(c[f]);
      if (!e || e.homeCompanyId !== c.id) fail("Company " + f + " must be its own employee");
    }
  }
  cycleCheck(s.companies, (c) => c.parentId, "Company parent graph");
  // departments
  const rootCount = new Map(), kids = new Map(), sibNames = new Set();
  for (const d of s.departments) {
    const c = co.get(d.companyId);
    if (!c) fail("Department references unknown company");
    const o = of.get(d.officeId);
    if (!o || o.companyId !== d.companyId) fail("Department office mismatch");
    const key = d.companyId + "|" + d.officeId + "|" + (d.parentId || "") + "|" + lc(d.name);
    if (sibNames.has(key)) fail("Duplicate sibling department name: " + d.name);
    sibNames.add(key);
    if (d.parentId === null) rootCount.set(d.companyId, (rootCount.get(d.companyId) || 0) + 1);
    else {
      const p = dp.get(d.parentId);
      if (!p || p.companyId !== d.companyId || p.officeId !== d.officeId) fail("Department parent crosses company/office");
      kids.set(p.id, (kids.get(p.id) || 0) + 1);
    }
  }
  for (const [, n] of rootCount) if (n > LIMITS.rootDepartmentsPerCompany) fail("Too many root departments");
  for (const [, n] of kids) if (n > LIMITS.childrenPerDepartment) fail("Too many child departments");
  cycleCheck(s.departments, (d) => d.parentId, "Department parent graph");
  for (const d of s.departments) if (depth(d, dp) > LIMITS.departmentDepth) fail("Department nesting too deep");
  // employees
  const enames = new Set();
  for (const e of s.employees) {
    if (!co.has(e.homeCompanyId)) fail("Employee home company unknown");
    const k = e.homeCompanyId + "|" + lc(e.name);
    if (enames.has(k)) fail("Duplicate employee name in company: " + e.name);
    enames.add(k);
    if (e.reportsToId !== null) {
      const r = em.get(e.reportsToId);
      if (!r || r.homeCompanyId !== e.homeCompanyId) fail("reportsTo must be in the same home company");
    }
  }
  cycleCheck(s.employees, (e) => e.reportsToId, "Reporting graph");
  // assignments
  const pair = new Set();
  const elig = new Map();
  for (const a of s.assignments) {
    const e = em.get(a.employeeId), d = dp.get(a.departmentId);
    if (!e) fail("Assignment employee unknown");
    if (!d || d.companyId !== a.companyId) fail("Assignment department must be in host company");
    if (!co.has(a.companyId)) fail("Assignment company unknown");
    const k = a.employeeId + "|" + a.companyId;
    if (pair.has(k)) fail("Duplicate assignment for employee in company");
    pair.add(k);
    if (a.kind === "resident" && e.homeCompanyId !== a.companyId) fail("Resident assignment must be in home company");
    elig.set(k, a);
  }
  // tasks
  for (const t of s.tasks) {
    if (!co.has(t.companyId)) fail("Task company unknown");
    if (t.departmentId !== null) {
      const d = dp.get(t.departmentId);
      if (!d || d.companyId !== t.companyId) fail("Task department crosses company");
    }
    if (t.ownerId !== null) {
      const a = elig.get(t.ownerId + "|" + t.companyId);
      if (!a) fail("Task owner has no assignment in task company");
      if (t.departmentId !== null && !inSubtree(a.departmentId, t.departmentId, dp)) fail("Task owner outside task department");
    }
  }
  for (const n of s.notes) if (!co.has(n.companyId)) fail("Note company unknown");
}
function cycleCheck(list, parentOf, label) {
  const map = new Map(list.map((r) => [r.id, r])), colors = new Map();
  for (const r of list) {
    if (colors.get(r.id) === 2) continue;
    let cur = r; const path = [];
    while (cur && colors.get(cur.id) !== 2) {
      if (colors.get(cur.id) === 1) fail(label + " has a cycle");
      colors.set(cur.id, 1); path.push(cur.id);
      const p = parentOf(cur); cur = p === null || p === undefined ? null : map.get(p);
    }
    for (const id of path) colors.set(id, 2);
  }
}
function depth(d, dp) { let n = 0, c = d; while (c && c.parentId !== null && n < 100) { c = dp.get(c.parentId); n++; } return n; }
function inSubtree(deptId, rootId, dp) {
  let c = dp.get(deptId), n = 0;
  while (c && n++ < 100) { if (c.id === rootId) return true; c = c.parentId === null ? null : dp.get(c.parentId); }
  return false;
}

function buildCompany(state, used, nm, parentId, x, z, fixed) {
  const f = fixed || {};
  const cid = f.id || uid("co", used.co, nm), oid = uid("of", used.of, nm + "-office");
  state.companies.push({ id: cid, name: nm, parentId: parentId || null, x, z, width: LIMITS.companyWidth, officeId: oid, directorId: "", assistantId: "" });
  const company = state.companies[state.companies.length - 1];
  state.offices.push({ id: oid, companyId: cid, name: "Head office" });
  const depts = DEPTS.map((dn, i) => {
    const d = { id: uid("dp", used.dp, cid.slice(3) + "-" + dn), companyId: cid, officeId: oid, parentId: null, name: dn, color: DCOL[i], order: i };
    state.departments.push(d);
    return d;
  });
  const mk = (n, role, reportsToId) => {
    const e = { id: uid("em", used.em, cid.slice(3) + "-" + role), homeCompanyId: cid, name: n, role, reportsToId };
    state.employees.push(e);
    state.assignments.push({ id: uid("as", used.as, e.id), employeeId: e.id, companyId: cid, departmentId: depts[0].id, kind: "resident", x: null, y: null });
    return e;
  };
  const dir = mk(f.director || "Director", "Director", null);
  const don = mk(f.donna || "Donna", "Donna", dir.id);
  company.directorId = dir.id; company.assistantId = don.id;
  return { company, depts, dir };
}
function usedSets(state) {
  return { co: idSet(state, "companies"), of: idSet(state, "offices"), dp: idSet(state, "departments"), em: idSet(state, "employees"), as: idSet(state, "assignments"), tk: idSet(state, "tasks"), nt: idSet(state, "notes") };
}

export function seedState() {
  const s = { version: 1, companies: [], offices: [], departments: [], employees: [], assignments: [], tasks: [], notes: [] };
  const used = usedSets(s);
  const defs = [["co-studio-north", "Studio North", 0, null], ["co-orbit-works", "Orbit Works", -1260, null], ["co-research-lab", "Research Lab", 1260, "co-studio-north"]];
  const people = [["Avery", "Blake"], ["Casey", "Drew"], ["Emery", "Finley"], ["Gray", "Harper"], ["Indigo", "Jules"]];
  const roles = ["Product Lead", "Engineer", "Designer", "Researcher", "Operations Lead"];
  const res = {};
  for (const [id, nm, x, parent] of defs) {
    used.co.add(id);
    const { depts, dir } = buildCompany(s, used, nm, parent, x, 0, { id, director: nm.split(" ")[0] + " Director", donna: "Donna " + nm.split(" ")[0] });
    const tag = nm.split(" ")[0];
    const emps = [];
    for (let i = 1; i < 6; i++) for (let j = 0; j < 2; j++) {
      const e = { id: uid("em", used.em, id.slice(3) + "-" + people[i - 1][j]), homeCompanyId: id, name: people[i - 1][j] + " " + tag, role: roles[i - 1] + (j ? " II" : ""), reportsToId: dir.id };
      s.employees.push(e);
      s.assignments.push({ id: uid("as", used.as, e.id), employeeId: e.id, companyId: id, departmentId: depts[i].id, kind: "resident", x: null, y: null });
      emps.push(e);
    }
    res[id] = { depts, emps, dir };
    const T = [
      ["Draft quarterly roadmap", 1, 1, "doing", "now"], ["Review architecture notes", 2, 2, "todo", "next"],
      ["Refresh design tokens", 3, 3, "todo", "later"], ["Summarize research findings", 4, 4, "done", "now"],
      ["Audit office handbook", 5, 5, "todo", "next"], ["Unowned triage task", 0, null, "todo", "later"]];
    for (const [title, di, ei, status, lane] of T) {
      s.tasks.push({ id: uid("tk", used.tk, id.slice(3) + "-" + title), companyId: id, departmentId: depts[di].id, title, ownerId: ei === null ? null : emps[ei * 2 - 2].id, status, lane });
    }
    ["Sync with directors on priorities", "Whiteboard: ideas for next cycle"].forEach((t, i) =>
      s.notes.push({ id: uid("nt", used.nt, id.slice(3) + "-note-" + i), companyId: id, text: t, color: COLORS.note, x: null, y: null }));
  }
  s.assignments.push({ id: uid("as", used.as, "shared-orbit-in-studio"), employeeId: res["co-orbit-works"].emps[2].id, companyId: "co-studio-north", departmentId: res["co-studio-north"].depts[3].id, kind: "shared", x: null, y: null });
  s.assignments.push({ id: uid("as", used.as, "visiting-research-in-orbit"), employeeId: res["co-research-lab"].emps[4].id, companyId: "co-orbit-works", departmentId: res["co-orbit-works"].depts[4].id, kind: "visiting", x: null, y: null });
  return validateState(s);
}

export function loadState(storage) {
  try {
    if (!storage || typeof storage.getItem !== "function") return seedState();
    const raw = storage.getItem(KEY);
    if (typeof raw !== "string" || !raw || raw.length > LIMITS.storageBytes) return seedState();
    if (typeof TextEncoder !== "undefined" && new TextEncoder().encode(raw).length > LIMITS.storageBytes) return seedState();
    return validateState(JSON.parse(raw));
  } catch (e) { return seedState(); }
}
export function saveState(storage, state) {
  try {
    if (!storage || typeof storage.setItem !== "function") return { ok: false, error: "Storage unavailable" };
    const clean = validateState(state);
    const json = JSON.stringify(clean);
    if (typeof TextEncoder !== "undefined" ? new TextEncoder().encode(json).length > LIMITS.storageBytes : json.length > LIMITS.storageBytes) return { ok: false, error: "State exceeds storage budget" };
    storage.setItem(KEY, json);
    return { ok: true };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

// Staged transaction: draft is a validated deep copy; commit swaps arrays into live state.
function tx(state, fn) {
  assertWritableState(state);
  const draft = validateState(state);
  const result = fn(draft);
  const clean = validateState(draft);
  for (const k of ARR) state[k] = clean[k];
  const find = (arr, id) => state[arr].find((r) => r.id === id);
  const map = { company: "companies", office: "offices", department: "departments", employee: "employees", assignment: "assignments", task: "tasks", note: "notes" };
  return find(map[result.t], result.id);
}
const input = (o) => { if (!isObj(o)) fail("Input must be an object"); return o; };
const getCo = (s, id) => s.companies.find((c) => c.id === id) || fail("Unknown company: " + id);
const getDept = (s, id) => s.departments.find((d) => d.id === id) || fail("Unknown department: " + id);

export function createCompany(state, args) {
  input(args);
  return tx(state, (d) => {
    const nm = name(args.name, "Company name");
    if (d.companies.some((c) => lc(c.name) === lc(nm))) fail("Company name already exists");
    if (d.companies.length >= LIMITS.companies) fail("Company limit reached");
    const parentId = args.parentId === undefined ? null : args.parentId;
    if (parentId !== null) getCo(d, parentId);
    let slot = 0, found = false;
    for (let attempt = 0; attempt <= LIMITS.companies * 4 + 4; attempt++) {
      slot = attempt === 0 ? 0 : (attempt % 2 ? (attempt + 1) / 2 : -attempt / 2);
      if (!d.companies.some((c) => Math.abs(c.x - slot * 1260) < 1260)) { found = true; break; }
    }
    if (!found) fail("No free company position is available");
    const used = usedSets(d);
    const { company } = buildCompany(d, used, nm, parentId, slot * 1260, 0);
    return { t: "company", id: company.id };
  });
}
export function createDepartment(state, args) {
  input(args);
  return tx(state, (d) => {
    const c = getCo(d, args.companyId);
    const officeId = args.officeId === undefined || args.officeId === null ? c.officeId : args.officeId;
    const parentId = args.parentId === undefined ? null : args.parentId;
    if (d.departments.length >= LIMITS.departments) fail("Department limit reached");
    if (parentId !== null) {
      const p = getDept(d, parentId);
      if (p.companyId !== c.id || p.officeId !== officeId) fail("Parent department must be in same company and office");
    }
    const sibs = d.departments.filter((x) => x.companyId === c.id && x.officeId === officeId && x.parentId === parentId);
    const color = args.color === undefined ? COLORS.employee : args.color;
    const dep = { id: uid("dp", usedSets(d).dp, c.id.slice(3) + "-" + String(args.name || "dept")), companyId: c.id, officeId, parentId, name: name(args.name, "Department name"), color, order: sibs.reduce((m, x) => Math.max(m, x.order + 1), 0) };
    d.departments.push(dep);
    return { t: "department", id: dep.id };
  });
}
export function hireEmployee(state, args) {
  input(args);
  return tx(state, (d) => {
    const c = getCo(d, args.companyId);
    const dep = getDept(d, args.departmentId);
    if (dep.companyId !== c.id) fail("Department belongs to a different company");
    const kind = args.kind === undefined || args.kind === null ? "resident" : args.kind;
    if (!KINDS.includes(kind)) fail("Invalid assignment kind");
    const nm = name(args.name, "Employee name");
    if (d.employees.length >= LIMITS.employees) fail("Employee limit reached");
    if (d.assignments.length >= LIMITS.assignments) fail("Assignment limit reached");
    const used = usedSets(d);
    const employee = { id: uid("em", used.em, c.id.slice(3) + "-" + nm), homeCompanyId: c.id, name: nm, role: name(args.role, "Employee role"), reportsToId: c.directorId };
    const assignment = { id: uid("as", used.as, employee.id), employeeId: employee.id, companyId: c.id, departmentId: dep.id, kind, x: null, y: null };
    d.employees.push(employee); d.assignments.push(assignment);
    return { t: "employee", id: employee.id };
  });
}

function allowedPatch(patch, keys) {
  input(patch);
  for (const k of Reflect.ownKeys(patch)) if (!keys.includes(k)) fail("Unsupported update field: " + String(k));
  for (const d of Object.values(Object.getOwnPropertyDescriptors(patch))) if (!("value" in d)) fail("Update must contain data properties");
}
export function addTask(state, args) {
  input(args);
  return tx(state, (d) => {
    getCo(d, args.companyId);
    if (d.tasks.length >= LIMITS.tasks) fail("Task limit reached");
    const task = { id: uid("tk", idSet(d, "tasks")), companyId: args.companyId, departmentId: args.departmentId ?? null, title: text(args.title, LIMITS.textLength, "Task title"), ownerId: args.ownerId ?? null, status: "todo", lane: "now" };
    d.tasks.push(task); return { t: "task", id: task.id };
  });
}
export function updateTask(state, id, patch) {
  allowedPatch(patch, ["title", "departmentId", "ownerId", "status", "lane"]);
  return tx(state, (d) => {
    const task = d.tasks.find((t) => t.id === id); if (!task) fail("Unknown task");
    if (has(patch, "title")) task.title = text(patch.title, LIMITS.textLength, "Task title");
    for (const k of ["departmentId", "ownerId"]) if (has(patch, k)) task[k] = patch[k] ?? null;
    for (const k of ["status", "lane"]) if (has(patch, k)) task[k] = patch[k];
    return { t: "task", id };
  });
}
function notePoint(point) {
  num(point.x, "Note x"); num(point.y, "Note y");
  return clampPoint(point, { x: 8, y: 36, w: 238 - 16 - NOTE_W, h: 200 - 44 - NOTE_H });
}
export function addNote(state, args) {
  input(args);
  return tx(state, (d) => {
    getCo(d, args.companyId);
    if (d.notes.length >= LIMITS.notes) fail("Note limit reached");
    const note = { id: uid("nt", idSet(d, "notes")), companyId: args.companyId, text: text(args.text, LIMITS.textLength, "Note text"), color: COLORS.note, x: null, y: null };
    d.notes.push(note); return { t: "note", id: note.id };
  });
}
export function updateNote(state, id, patch) {
  allowedPatch(patch, ["text", "color", "x", "y"]);
  return tx(state, (d) => {
    const note = d.notes.find((n) => n.id === id); if (!note) fail("Unknown note");
    if (has(patch, "text")) note.text = text(patch.text, LIMITS.textLength, "Note text");
    if (has(patch, "color")) note.color = patch.color;
    if (has(patch, "x")) note.x = patch.x ?? null;
    if (has(patch, "y")) note.y = patch.y ?? null;
    if ((note.x === null) !== (note.y === null)) fail("Note x/y must both be null or finite");
    if (note.x !== null) Object.assign(note, notePoint(note));
    return { t: "note", id };
  });
}

function validRect(r) {
  return r !== null && typeof r === "object" && [r.x, r.y, r.w, r.h].every(fin) && r.w >= 0 && r.h >= 0 && fin(r.x + r.w) && fin(r.y + r.h);
}
export function containsRect(outer, inner, epsilon = 1e-7) {
  if (!validRect(outer) || !validRect(inner) || !fin(epsilon) || epsilon < 0) return false;
  return inner.x >= outer.x - epsilon && inner.y >= outer.y - epsilon && inner.x + inner.w <= outer.x + outer.w + epsilon && inner.y + inner.h <= outer.y + outer.h + epsilon;
}
export function containsCircle(outer, circle, epsilon = 1e-7) {
  if (!circle || ![circle.x, circle.y, circle.r].every(fin) || circle.r < 0) return false;
  return containsRect(outer, { x: circle.x - circle.r, y: circle.y - circle.r, w: circle.r * 2, h: circle.r * 2 }, epsilon);
}
export function clampPoint(point, rect, padding = 0) {
  if (!point || !fin(point.x) || !fin(point.y) || !validRect(rect) || !fin(padding) || padding < 0 || rect.w < 2 * padding || rect.h < 2 * padding) fail("Cannot clamp a point into invalid bounds");
  return { x: Math.max(rect.x + padding, Math.min(rect.x + rect.w - padding, point.x)), y: Math.max(rect.y + padding, Math.min(rect.y + rect.h - padding, point.y)) };
}
const orderBy = (a, b) => (a.order - b.order) || a.id.localeCompare(b.id);
const idBy = (a, b) => a.id.localeCompare(b.id);

// Private geometry builder consumes an already validated state.
function layoutFor(state, companyId) {
  const company = getCo(state, companyId);
  const departments = state.departments.filter((d) => d.companyId === companyId);
  const children = new Map(), assignments = new Map();
  for (const d of departments) {
    const key = d.parentId;
    if (!children.has(key)) children.set(key, []); children.get(key).push(d);
  }
  for (const list of children.values()) list.sort(orderBy);
  for (const a of state.assignments) if (a.companyId === companyId) {
    if (!assignments.has(a.departmentId)) assignments.set(a.departmentId, []);
    assignments.get(a.departmentId).push(a);
  }
  for (const list of assignments.values()) list.sort(idBy);
  const HEADER = 44, INSET = 16;
  function measure(d, width, level) {
    const people = assignments.get(d.id) || [];
    const cols = Math.max(1, Math.floor((width - INSET * 2 - SEAT_R * 2) / SEAT_GAP) + 1);
    const rows = Math.max(1, Math.ceil(people.length / cols));
    const ownHeight = HEADER + INSET * 2 + SEAT_R * 2 + (rows - 1) * SEAT_GAP;
    const kids = (children.get(d.id) || []).map((child) => measure(child, width - INSET * 2, level + 1));
    const childHeight = kids.length ? INSET * 2 + kids.reduce((sum, k) => sum + k.h, 0) + INSET * (kids.length - 1) : 0;
    const h = Math.max(level === 0 ? 200 : 128, ownHeight + childHeight);
    return { d, w: width, h, people, cols, ownHeight, kids };
  }
  const roots = (children.get(null) || []).map((d) => measure(d, 320, 0));
  const rooms = [], seats = [], areas = new Map();
  function place(node, x, y) {
    const room = { id: node.d.id, departmentId: node.d.id, name: node.d.name, color: node.d.color, x, y, w: node.w, h: node.h, restricted: false };
    rooms.push(room);
    const ownEnd = node.kids.length ? node.ownHeight : node.h - INSET;
    const seatRect = { x: x + INSET, y: y + HEADER, w: node.w - INSET * 2, h: ownEnd - HEADER };
    areas.set(node.d.id, { room, seatRect });
    const firstX = (node.w - (node.cols - 1) * SEAT_GAP) / 2;
    for (let i = 0; i < node.people.length; i++) {
      const a = node.people[i];
      const auto = { x: x + firstX + (i % node.cols) * SEAT_GAP, y: y + HEADER + INSET + SEAT_R + Math.floor(i / node.cols) * SEAT_GAP };
      const requested = a.x === null ? auto : { x: x + a.x, y: y + a.y };
      const p = clampPoint(requested, seatRect, SEAT_R);
      seats.push({ assignmentId: a.id, x: p.x, y: p.y, r: SEAT_R });
    }
    let childY = y + node.ownHeight + INSET;
    for (const kid of node.kids) { place(kid, x + INSET, childY); childY += kid.h + INSET; }
  }
  let rowY = 104, bottom = 104;
  for (let i = 0; i < roots.length; i += 3) {
    const row = roots.slice(i, i + 3), h = Math.max(...row.map((n) => n.h));
    row.forEach((node, j) => place(node, 50 + j * 340, rowY));
    bottom = rowY + h; rowY = bottom + 24;
  }
  rooms.push({ id: "restricted-" + companyId, departmentId: null, name: "Access required", color: COLORS.restricted, x: 850, y: 32, w: 200, h: 48, restricted: true });
  const boards = BOARDS.map((type, i) => ({ type, x: 50 + i * 254, y: bottom + 48, w: 238, h: 200 }));
  const layout = { width: 1100, height: bottom + 48 + 200 + 40, rooms, boards, seats, leadership: { directorId: company.directorId, assistantId: company.assistantId } };
  return { layout, areas };
}
export function companyLayout(state, companyId) {
  return layoutFor(validateState(state), companyId).layout;
}
export function moveAssignment(state, id, point) {
  input(point); num(point.x, "Assignment x"); num(point.y, "Assignment y");
  return tx(state, (d) => {
    const a = d.assignments.find((r) => r.id === id); if (!a) fail("Unknown assignment");
    const { areas } = layoutFor(d, a.companyId), area = areas.get(a.departmentId);
    if (!area) fail("Assignment department has no editable area");
    const p = clampPoint(point, area.seatRect, SEAT_R);
    a.x = p.x - area.room.x; a.y = p.y - area.room.y;
    return { t: "assignment", id };
  });
}

export function companyEmployees(state, companyId) {
  if (!state.companies.some((c) => c.id === companyId)) return [];
  const employees = new Map(state.employees.map((e) => [e.id, e]));
  return state.assignments.filter((a) => a.companyId === companyId).slice().sort(idBy).map((a) => {
    const e = employees.get(a.employeeId);
    return { id: e.id, name: e.name, role: e.role, homeCompanyId: e.homeCompanyId, reportsToId: e.reportsToId, assignmentId: a.id, companyId, departmentId: a.departmentId, kind: a.kind };
  });
}
export function companyTasks(state, companyId) {
  if (!state.companies.some((c) => c.id === companyId)) return [];
  return state.tasks.filter((t) => t.companyId === companyId).map((t) => ({ ...t }));
}
export function companyNotes(state, companyId) {
  if (!state.companies.some((c) => c.id === companyId)) return [];
  return state.notes.filter((n) => n.companyId === companyId).map((n) => ({ ...n }));
}
export function searchRecords(state, q) {
  if (typeof q !== "string") return [];
  const query = q.normalize("NFC").trim().toLowerCase().slice(0, LIMITS.textLength);
  if (!query) return [];
  const result = [], companies = new Map(state.companies.map((c) => [c.id, c]));
  const depts = new Map(state.departments.map((d) => [d.id, d]));
  function add(type, id, companyId, departmentId, assignmentId, label, subtitle) {
    if (result.length < LIMITS.searchResults && (label + " " + subtitle).toLowerCase().includes(query)) result.push({ type, id, companyId, departmentId, assignmentId, label, subtitle });
  }
  for (const c of state.companies) add("company", c.id, c.id, null, null, c.name, "Company");
  for (const o of state.offices) add("office", o.id, o.companyId, null, null, o.name, companies.get(o.companyId).name + " · Office");
  for (const d of state.departments) add("department", d.id, d.companyId, d.id, null, d.name, companies.get(d.companyId).name + " · Department");
  for (const c of state.companies) for (const e of companyEmployees(state, c.id)) add("employee", e.id, c.id, e.departmentId, e.assignmentId, e.name, c.name + " · " + depts.get(e.departmentId).name + " · " + e.role + " · " + e.kind);
  for (const t of state.tasks) add("task", t.id, t.companyId, t.departmentId, null, t.title, companies.get(t.companyId).name + " · Task · " + t.status);
  for (const n of state.notes) add("note", n.id, n.companyId, null, null, n.text, companies.get(n.companyId).name + " · Note");
  return result;
}
export function describeScope(state, companyId, departmentId = null) {
  const clean = validateState(state), c = getCo(clean, companyId), dp = new Map(clean.departments.map((d) => [d.id, d]));
  const dep = departmentId === null || departmentId === undefined ? null : getDept(clean, departmentId);
  if (dep && dep.companyId !== companyId) fail("Department belongs to a different company");
  const eligible = (id) => !dep || (id !== null && inSubtree(id, dep.id, dp));
  const employees = companyEmployees(clean, companyId).filter((e) => eligible(e.departmentId));
  const tasks = companyTasks(clean, companyId).filter((t) => eligible(t.departmentId));
  const open = tasks.filter((t) => t.status !== "done").length, unassigned = tasks.filter((t) => t.ownerId === null).length;
  const result = { companyId, companyName: c.name, departmentId: dep ? dep.id : null, departmentName: dep ? dep.name : null, employeeCount: employees.length, taskCount: tasks.length, openTaskCount: open, unassignedTaskCount: unassigned, doneTaskCount: tasks.length - open, noteCount: companyNotes(clean, companyId).length };
  result.summary = "Scripted demo: " + c.name + (dep ? " / " + dep.name : "") + " has " + result.employeeCount + " employee definitions, " + open + " open tasks and " + unassigned + " unassigned tasks. These are local records, not running workers.";
  return result;
}
