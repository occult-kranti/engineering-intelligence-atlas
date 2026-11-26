// Claude Sonnet partial request 2e4f95d6-8579-424a-95c1-c69c480076f7 and bounded completion 1c332aa7-d34d-4d9c-b9ee-346f9b04bbc9. Root normalized flat commands and repaired integration invariants.
// blueprint-world-studio-edits.js -- local actor simulation (not authentication).
import * as core from './blueprint-world-core.js';

export const EDIT_CAPABILITIES = Object.freeze(["department.rename", "department.color", "department.reorder", "company.move", "assignment.place", "policy.manage", "history.undoAny"]);
export const STUDIO_LIMITS = Object.freeze({ actors: 256, grants: 1024, journalEvents: 128, retainedReceipts: 64, commandCanonicalBytes: 8192, storageBytes: 2097152, nameLength: 60, revisionMax: Number.MAX_SAFE_INTEGER - 1, companyGutterWorldUnits: 160, seatRadiusWorldUnits: 18, minimumSeatSeparation: 2, maxDepth: 6, maxNodes: 20000, historyLimit: 128 });
export class StudioError extends Error {
  constructor(code, message) { super(String(message || code).replace(/[^\x20-\x7e]/g, "?").slice(0, 200)); this.name = "StudioError"; this.code = String(code); }
}
const L = STUDIO_LIMITS, ROLES = ["owner", "director", "donna", "sub_donna", "visitor"];
const CMDS = ["department.rename", "department.color", "department.reorder", "company.move", "assignment.place", "policy.actor.put", "policy.grant", "policy.revoke", "history.undo"];
const FLOOR = CMDS.slice(0, 5), ACT_RE = /^act_[a-z0-9_-]{1,80}$/, GR_RE = /^gr_[a-z0-9_-]{1,80}$/;
const fail = (c, m) => { throw new StudioError(c, m); };
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const isInt = (v) => Number.isSafeInteger(v) && v >= 0 && v <= L.revisionMax;
const pid = (v, p) => typeof v === "string" && v.length <= 80 && new RegExp("^" + p + "-[A-Za-z0-9-]{1,76}$").test(v);

function dataCheck(v, depth, budget, path) {
  if (++budget.n > L.maxNodes || depth > L.maxDepth + 4) fail("bad_input", "Input too large or deep");
  if (v === null || typeof v === "string" || typeof v === "boolean") return;
  if (typeof v === "number") { if (!Number.isFinite(v)) fail("bad_input", "Nonfinite number"); return; }
  if (Array.isArray(v)) {
    if (Object.getPrototypeOf(v) !== Array.prototype) fail("bad_input", "Nonplain array");
    for (let i = 0; i < v.length; i++) { const d = Object.getOwnPropertyDescriptor(v, i); if (!d || !("value" in d)) fail("bad_input", "Bad array"); dataCheck(d.value, depth + 1, budget); }
    return;
  }
  if (!isObj(v)) fail("bad_input", "Nonplain value");
  for (const k of Reflect.ownKeys(v)) {
    if (typeof k !== "string" || k === "__proto__" || k === "constructor" || k === "prototype") fail("bad_input", "Forbidden key");
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (!("value" in d) || !d.enumerable) fail("bad_input", "Accessor or hidden property");
    dataCheck(d.value, depth + 1, budget);
  }
}
const safeTree = (v) => dataCheck(v, 0, { n: 0 });
const exact = (o, keys, label) => {
  if (!isObj(o)) fail("bad_shape", label + " must be an object");
  for (const k of Object.keys(o)) if (!keys.includes(k)) fail("bad_shape", label + " has unknown field");
  for (const k of keys) if (!(k in o)) fail("bad_shape", label + " missing field " + k);
};
function canon(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}
const clone = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b) => canon(a) === canon(b);
function utf8(s){
  if(typeof TextEncoder!=="undefined")return new TextEncoder().encode(s);
  const out=[];for(const ch of s){let c=ch.codePointAt(0);if(c>=0xd800&&c<=0xdfff)c=0xfffd;if(c<128)out.push(c);else if(c<2048)out.push(192|(c>>6),128|(c&63));else if(c<65536)out.push(224|(c>>12),128|((c>>6)&63),128|(c&63));else out.push(240|(c>>18),128|((c>>12)&63),128|((c>>6)&63),128|(c&63));}return out;
}
const byteLen=s=>utf8(s).length;

function fnv64(s) {
  let h = 0xcbf29ce484222325n; const P = 0x100000001b3n, M = (1n << 64n) - 1n;
  const bytes = utf8(s);
  for (const b of bytes) { h ^= BigInt(b); h = (h * P) & M; }
  return h.toString(16).padStart(16, "0");
}
function cleanModel(model) {
  try { return core.validateState(model); } catch (e) { fail("invalid_model", "Invalid model: " + String((e && e.message) || e).slice(0, 120)); }
}
const fingerprint = (m) => fnv64(JSON.stringify(m));

// ---- policy validation ----
function normScope(s) {
  if (!isObj(s)) fail("bad_scope", "Scope must be an object");
  for (const k of Object.keys(s)) if (!["kind", "companyId", "departmentId", "includeDescendants"].includes(k)) fail("bad_scope", "Unknown scope field");
  const kind = s.kind, inc = s.includeDescendants === undefined ? false : s.includeDescendants;
  if (typeof inc !== "boolean") fail("bad_scope", "includeDescendants must be boolean");
  const cid = s.companyId === undefined ? null : s.companyId, did = s.departmentId === undefined ? null : s.departmentId;
  if (kind === "workspace") { if (cid !== null || did !== null || inc) fail("bad_scope", "Workspace scope takes no ids"); }
  else if (kind === "company") { if (!pid(cid, "co") || did !== null || inc) fail("bad_scope", "Bad company scope"); }
  else if (kind === "department") { if (!pid(cid, "co") || !pid(did, "dp")) fail("bad_scope", "Bad department scope"); }
  else fail("bad_scope", "Unknown scope kind");
  return { kind, companyId: cid, departmentId: did, includeDescendants: kind === "department" ? inc : false };
}
function normActor(a, model) {
  exact(a, ["id", "label", "role", "employeeId", "active"], "Actor");
  if (typeof a.id !== "string" || !ACT_RE.test(a.id)) fail("bad_actor", "Bad actor id");
  if (typeof a.label !== "string") fail("bad_actor", "Bad label");
  const label = a.label.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!label || label.length > L.nameLength || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(label)) fail("bad_actor", "Bad actor label");
  if (!ROLES.includes(a.role)) fail("bad_actor", "Bad actor role");
  if (typeof a.active !== "boolean") fail("bad_actor", "Bad active flag");
  if (a.employeeId === null) { if (a.role !== "owner" && a.role !== "visitor") fail("bad_actor", "Employee binding required"); }
  else if (!pid(a.employeeId, "em") || !model.employees.some((e) => e.id === a.employeeId)) fail("bad_actor", "Unknown employee");
  return { id: a.id, label, role: a.role, employeeId: a.employeeId, active: a.active };
}
function normGrant(g, model, actorIds, ownerId, rev) {
  exact(g, ["id", "actorId", "capabilities", "scope", "issuedBy", "issuedAtRevision", "revokedAtRevision"], "Grant");
  if (typeof g.id !== "string" || !GR_RE.test(g.id)) fail("bad_grant", "Bad grant id");
  if (!actorIds.has(g.actorId)) fail("bad_grant", "Grant actor unknown");
  if (g.issuedBy !== ownerId) fail("bad_grant", "Grant issuer must be owner");
  if (!isInt(g.issuedAtRevision) || (g.revokedAtRevision !== null && (!isInt(g.revokedAtRevision) || g.revokedAtRevision < g.issuedAtRevision))) fail("bad_grant", "Bad grant revisions");
  if (rev !== undefined && (g.issuedAtRevision > rev || (g.revokedAtRevision !== null && g.revokedAtRevision > rev))) fail("bad_grant", "Grant revision beyond studio");
  const caps = g.capabilities;
  if (!Array.isArray(caps) || !caps.length || caps.length > EDIT_CAPABILITIES.length || new Set(caps).size !== caps.length || caps.some((c) => !EDIT_CAPABILITIES.includes(c))) fail("bad_grant", "Bad capabilities");
  const scope = normScope(g.scope);
  if (scope.kind === "department" && caps.includes("company.move")) fail("bad_grant", "Company movement needs company or workspace scope");
  if (caps.some((c) => c === "policy.manage" || c === "history.undoAny") && (g.actorId !== ownerId || scope.kind !== "workspace")) fail("bad_grant", "Owner-only capability");
  if (scope.kind !== "workspace") {
    const co = model.companies.find((c) => c.id === scope.companyId);
    if (!co) fail("bad_grant", "Scope company unknown");
    if (scope.kind === "department") { const d = model.departments.find((x) => x.id === scope.departmentId); if (!d || d.companyId !== co.id) fail("bad_grant", "Scope department mismatch"); }
  }
  return { id: g.id, actorId: g.actorId, capabilities: EDIT_CAPABILITIES.filter((c) => caps.includes(c)), scope, issuedBy: g.issuedBy, issuedAtRevision: g.issuedAtRevision, revokedAtRevision: g.revokedAtRevision };
}
function normPolicy(p, model, rev) {
  exact(p, ["ownerActorId", "actors", "grants"], "Policy");
  if (!Array.isArray(p.actors) || p.actors.length > L.actors || !Array.isArray(p.grants) || p.grants.length > L.grants) fail("bad_policy", "Policy arrays exceed limits");
  const actors = p.actors.map((a) => normActor(a, model)), ids = new Set();
  for (const a of actors) { if (ids.has(a.id)) fail("bad_policy", "Duplicate actor"); ids.add(a.id); }
  const owner = actors.find((a) => a.id === p.ownerActorId);
  if (!owner || owner.role !== "owner" || !owner.active) fail("bad_policy", "Owner actor must be an active owner");
  const gids = new Set(), grants = p.grants.map((g) => normGrant(g, model, ids, p.ownerActorId, rev));
  for (const g of grants) { if (gids.has(g.id)) fail("bad_policy", "Duplicate grant"); gids.add(g.id); }
  if (!grants.some((g) => !g.revokedAtRevision && g.revokedAtRevision !== 0 && g.actorId === p.ownerActorId && g.scope.kind === "workspace" && g.capabilities.includes("policy.manage"))) fail("bad_policy", "An active owner policy.manage grant is required");
  return { ownerActorId: p.ownerActorId, actors, grants };
}

// ---- geometry ----
function companyBox(model, c) { const l = core.companyLayout(model, c.id); return { x0: c.x, x1: c.x + c.width, z0: c.z, z1: c.z + l.height }; }
function geoCheck(model, ids) {
  const boxes = model.companies.map((c) => ({ id: c.id, b: companyBox(model, c) })), g = L.companyGutterWorldUnits;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (ids && !ids.includes(boxes[i].id) && !ids.includes(boxes[j].id)) continue;
    const a = boxes[i].b, b = boxes[j].b;
    if (a.x0 < b.x1 + g && b.x0 < a.x1 + g && a.z0 < b.z1 + g && b.z0 < a.z1 + g) fail("layout_overlap", "Company territories overlap or violate the 160-unit gutter");
  }
}
function seatsOf(model, companyId) { return core.companyLayout(model, companyId).seats; }
const geometryOf = (model, ids, seatId) => {
  const out = { companies: ids.map((id) => { const c = model.companies.find((x) => x.id === id); return c ? Object.assign({ id }, companyBox(model, c)) : { id }; }), seat: null };
  if (seatId) { const a = model.assignments.find((x) => x.id === seatId); if (a) { const s = seatsOf(model, a.companyId).find((x) => x.assignmentId === seatId); if (s) out.seat = { assignmentId: seatId, x: s.x, y: s.y, r: s.r }; } }
  return out;
};

// ---- metadata validation ----
const PATCH_FIELDS = { companies: ["x", "z"], departments: ["name", "color", "order"], assignments: ["x", "y"] };
const PFX = { companies: "co", departments: "dp", assignments: "as" };
function normPatch(p, model) {
  exact(p, ["collection", "recordId", "field", "before", "after"], "Patch");
  if (!PATCH_FIELDS[p.collection] || !PATCH_FIELDS[p.collection].includes(p.field) || !pid(p.recordId, PFX[p.collection])) fail("bad_history", "Bad patch");
  if(!model[p.collection].some(r=>r.id===p.recordId))fail("bad_history","Historical patch target is missing");
  for(const v of [p.before,p.after]) {
    let valid=false;
    if(p.field==="name")valid=typeof v==="string"&&v.length>0&&v.length<=core.LIMITS.nameLength&&v===v.normalize("NFC").replace(/\s+/g," ").trim()&&!/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(v);
    else if(p.field==="color")valid=typeof v==="string"&&/^#[0-9a-fA-F]{6}$/.test(v);
    else if(p.field==="order")valid=Number.isInteger(v)&&v>=0&&v<=1e6;
    else valid=(p.collection==="assignments"&&v===null)||(typeof v==="number"&&Number.isFinite(v)&&Math.abs(v)<=core.LIMITS.coordinateLimit);
    if(!valid)fail("bad_history","Historical patch value has the wrong field type");
  }
  return { collection: p.collection, recordId: p.recordId, field: p.field, before: p.before, after: p.after };
}
function normResultIds(a) { if (!Array.isArray(a) || a.length > 64 || a.some((x) => typeof x !== "string" || x.length > 84)) fail("bad_history", "Bad resultIds"); return a.slice(); }
function normEntry(e, actorIds, rev, model) {
  exact(e, ["id", "opId", "actorId", "kind", "revisionBefore", "revisionAfter", "modelRevisionBefore", "modelRevisionAfter", "scopes", "patches", "undoable", "undoOf", "resultIds"], "HistoryEntry");
  for (const k of ["revisionBefore", "revisionAfter", "modelRevisionBefore", "modelRevisionAfter"]) if (!isInt(e[k])) fail("bad_history", "Bad revision");
  if (e.id !== "evt_" + e.revisionAfter || e.revisionAfter > rev || e.revisionAfter <= e.revisionBefore || e.modelRevisionAfter < e.modelRevisionBefore) fail("bad_history", "Bad history identity");
  if (typeof e.opId !== "string" || e.opId.length > 200 || !actorIds.has(e.actorId)) fail("bad_history", "Bad history actor");
  if (!(CMDS.includes(e.kind) || e.kind === "owner.change")) fail("bad_history", "Bad history kind");
  if (!Array.isArray(e.scopes) || e.scopes.length > 64 || !Array.isArray(e.patches) || e.patches.length > 2200 || typeof e.undoable !== "boolean") fail("bad_history", "Bad history arrays");
  if (e.undoOf !== null && !/^evt_\d+$/.test(e.undoOf)) fail("bad_history", "Bad undoOf");
  if (e.undoable && (!FLOOR.includes(e.kind) || e.undoOf !== null)) fail("bad_history", "Bad undoable flag");
  const patchShape={"department.rename":["departments","name"],"department.color":["departments","color"],"department.reorder":["departments","order"],"company.move":["companies","x","z"],"assignment.place":["assignments","x","y"]}[e.kind];
  if(patchShape&&e.patches.some(p=>p.collection!==patchShape[0]||!patchShape.slice(1).includes(p.field)))fail("bad_history","History patches do not match the operation");
  if(!patchShape&&e.kind!=="history.undo"&&e.patches.length)fail("bad_history","This history event cannot contain model patches");
  return { id: e.id, opId: e.opId, actorId: e.actorId, kind: e.kind, revisionBefore: e.revisionBefore, revisionAfter: e.revisionAfter, modelRevisionBefore: e.modelRevisionBefore, modelRevisionAfter: e.modelRevisionAfter, scopes: e.scopes.map(normScope), patches: e.patches.map(p=>normPatch(p,model)), undoable: e.undoable, undoOf: e.undoOf, resultIds: normResultIds(e.resultIds) };
}
function normReceipt(r, actorIds, rev) {
  exact(r, ["opId", "actorId", "sequence", "requestCanonical", "revision", "modelRevision", "eventId", "resultIds", "changed"], "Receipt");
  if (!actorIds.has(r.actorId) || !Number.isSafeInteger(r.sequence) || r.sequence < 1 || r.opId !== r.actorId + ":" + r.sequence) fail("bad_receipt", "Bad receipt identity");
  if (typeof r.requestCanonical !== "string" || r.requestCanonical.length > L.commandCanonicalBytes) fail("bad_receipt", "Bad receipt request");
  if (!isInt(r.revision) || r.revision > rev || !isInt(r.modelRevision) || r.eventId !== "evt_" + r.revision || typeof r.changed !== "boolean") fail("bad_receipt", "Bad receipt");
  return { opId: r.opId, actorId: r.actorId, sequence: r.sequence, requestCanonical: r.requestCanonical, revision: r.revision, modelRevision: r.modelRevision, eventId: r.eventId, resultIds: normResultIds(r.resultIds), changed: r.changed };
}
export function validateStudio(model, raw) {
  const m = cleanModel(model);
  try { safeTree(raw); } catch (e) { fail("bad_metadata", "Studio metadata rejected: " + e.message); }
  exact(raw, ["format", "version", "revision", "modelRevision", "modelFingerprint", "policy", "journal", "cursors", "receipts"], "StudioMetadata");
  if (raw.format !== "daftar-blueprint-studio" || raw.version !== 1 || !isInt(raw.revision) || !isInt(raw.modelRevision)) fail("bad_metadata", "Bad studio header");
  if (typeof raw.modelFingerprint !== "string" || !/^[0-9a-f]{16}$/.test(raw.modelFingerprint)) fail("bad_metadata", "Bad fingerprint");
  if (raw.modelFingerprint !== fingerprint(m)) fail("fingerprint_mismatch", "Model changed outside Studio; owner-change reconciliation required");
  const policy = normPolicy(raw.policy, m, raw.revision), ids = new Set(policy.actors.map((a) => a.id));
  if (!Array.isArray(raw.journal) || raw.journal.length > L.journalEvents || !Array.isArray(raw.receipts) || raw.receipts.length > L.retainedReceipts) fail("bad_metadata", "Journal/receipts exceed limits");
  const journal = raw.journal.map((e) => normEntry(e, ids, raw.revision, m)), receipts = raw.receipts.map((r) => normReceipt(r, ids, raw.revision));
  for (let i = 1; i < journal.length; i++) if (journal[i].revisionAfter <= journal[i - 1].revisionAfter) fail("bad_history", "Journal not ordered");
  if (!isObj(raw.cursors)) fail("bad_metadata", "Bad cursors");
  const cursors = {};
  for (const k of Object.keys(raw.cursors)) { if (!ids.has(k) || !isInt(raw.cursors[k])) fail("bad_metadata", "Bad cursor"); cursors[k] = raw.cursors[k]; }
  for (const r of receipts) if ((cursors[r.actorId] || 0) < r.sequence) fail("bad_receipt", "Receipt beyond cursor");
  return { format: raw.format, version: 1, revision: raw.revision, modelRevision: raw.modelRevision, modelFingerprint: raw.modelFingerprint, policy, journal, cursors, receipts };
}
export function createStudio(model, boot) {
  const m = cleanModel(model);
  if (!isObj(boot)) fail("bad_bootstrap", "Bootstrap must be an object");
  exact(boot, ["ownerActorId", "actors", "grants"], "Bootstrap");
  try { safeTree(boot); } catch (e) { fail("bad_bootstrap", e.message); }
  const grants = (Array.isArray(boot.grants) ? boot.grants : fail("bad_bootstrap", "grants required")).map((g) => {
    if(!isObj(g))fail("bad_bootstrap","Bootstrap grant must be an object");
    const allowed=["id","actorId","capabilities","scope","issuedBy","issuedAtRevision","revokedAtRevision"];
    if(Object.keys(g).some(k=>!allowed.includes(k))||["id","actorId","capabilities","scope"].some(k=>!Object.hasOwn(g,k)))fail("bad_bootstrap","Malformed bootstrap grant");
    if((Object.hasOwn(g,"issuedBy")&&g.issuedBy!==boot.ownerActorId)||(Object.hasOwn(g,"issuedAtRevision")&&g.issuedAtRevision!==0)||(Object.hasOwn(g,"revokedAtRevision")&&g.revokedAtRevision!==null))fail("bad_bootstrap","Bootstrap grant issuance must match owner and revision zero");
    return Object.assign({}, g, { issuedBy: boot.ownerActorId, issuedAtRevision: 0, revokedAtRevision: null });
  });
  if (!Array.isArray(boot.actors)) fail("bad_bootstrap", "actors required");
  const policy = normPolicy({ ownerActorId: boot.ownerActorId, actors: boot.actors, grants }, m, 0);
  geoCheck(m);
  return validateStudio(m, { format: "daftar-blueprint-studio", version: 1, revision: 0, modelRevision: 0, modelFingerprint: fingerprint(m), policy, journal: [], cursors: {}, receipts: [] });
}

// ---- authorization ----
function deptSubtree(m, id) { const out = new Set([id]); let grow = true; while (grow) { grow = false; for (const d of m.departments) if (d.parentId && out.has(d.parentId) && !out.has(d.id)) { out.add(d.id); grow = true; } } return out; }
function covers(grant, m, target) {
  const s = grant.scope;
  if (s.kind === "workspace") return true;
  if (s.companyId !== target.companyId) return false;
  if (s.kind === "company") return true;
  if (!target.departmentId) return false;
  return s.departmentId === target.departmentId || (s.includeDescendants && deptSubtree(m, s.departmentId).has(target.departmentId));
}
function actorCan(m, studio, actorId, cap, target) {
  const a = studio.policy.actors.find((x) => x.id === actorId);
  if (!a || !a.active) return false;
  return studio.policy.grants.some((g) => g.actorId === actorId && g.revokedAtRevision === null && g.capabilities.includes(cap) && (target === null ? g.scope.kind === "workspace" : covers(g, m, target)));
}
const findDept = (m, id) => m.departments.find((d) => d.id === id);
const scopeOf = (companyId, departmentId) => ({ kind: departmentId ? "department" : "company", companyId, departmentId: departmentId || null, includeDescendants: false });
// Returns {cap, targets[]} or throws StudioError (command shape).
function resolveCommand(m, cmd) {
  if (!isObj(cmd) || typeof cmd.type !== "string" || !CMDS.includes(cmd.type)) fail("bad_command", "Unknown or malformed command");
  const p = cmd, t = cmd.type;
  const keys = { "department.rename": ["departmentId", "name"], "department.color": ["departmentId", "color"], "department.reorder": ["companyId", "officeId", "parentId", "orderedIds"], "company.move": ["companyId", "x", "z"], "assignment.place": ["assignmentId", "x", "y"], "policy.actor.put": ["actor"], "policy.grant": ["grantId", "actorId", "capabilities", "scope"], "policy.revoke": ["grantId"], "history.undo": ["eventId"] }[t];
  exact(cmd, ["type", ...keys], "Command");
  if (t === "department.rename" || t === "department.color") {
    const d = pid(p.departmentId, "dp") && findDept(m, p.departmentId);
    if (!d) fail("unknown_record", "Unknown department");
    if (t === "department.color" && !(typeof p.color === "string" && /^#[0-9a-fA-F]{6}$/.test(p.color))) fail("bad_command", "Bad color");
    if (t === "department.rename" && typeof p.name !== "string") fail("bad_command", "Bad name");
    return { cap: t, targets: [{ companyId: d.companyId, departmentId: d.id }], companyIds: [d.companyId] };
  }
  if (t === "department.reorder") {
    const sibs = m.departments.filter((d) => d.companyId === p.companyId && d.officeId === p.officeId && d.parentId === p.parentId);
    if (!sibs.length || !Array.isArray(p.orderedIds)) fail("bad_command", "Unknown sibling group");
    const cur = sibs.slice().sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map((d) => d.id);
    if (p.orderedIds.length !== cur.length || new Set(p.orderedIds).size !== cur.length || p.orderedIds.some((i) => !cur.includes(i))) fail("bad_command", "orderedIds must be a complete unique permutation");
    const targets = [];
    p.orderedIds.forEach((id, i) => { const d = sibs.find((x) => x.id === id); if (d.order !== i) targets.push({ companyId: d.companyId, departmentId: d.id }); });
    if (!targets.length) fail("no_change", "Order is unchanged");
    return { cap: t, targets, companyIds: [p.companyId] };
  }
  if (t === "company.move") {
    const c = pid(p.companyId, "co") && m.companies.find((x) => x.id === p.companyId);
    if (!c) fail("unknown_record", "Unknown company");
    for (const k of ["x", "z"]) if (typeof p[k] !== "number" || !Number.isFinite(p[k]) || Math.abs(p[k]) > core.LIMITS.coordinateLimit) fail("bad_command", "Bad coordinate");
    return { cap: t, targets: [{ companyId: c.id, departmentId: null }], companyIds: [c.id] };
  }
  if (t === "assignment.place") {
    const a = pid(p.assignmentId, "as") && m.assignments.find((x) => x.id === p.assignmentId);
    if (!a) fail("unknown_record", "Unknown assignment");
    for (const k of ["x", "y"]) if (typeof p[k] !== "number" || !Number.isFinite(p[k]) || Math.abs(p[k]) > core.LIMITS.coordinateLimit) fail("bad_command", "Bad coordinate");
    return { cap: t, targets: [{ companyId: a.companyId, departmentId: a.departmentId }], companyIds: [a.companyId] };
  }
  if (t === "history.undo") { if (!/^evt_\d+$/.test(String(p.eventId))) fail("bad_command", "Bad event id"); return { cap: "history.undo", targets: [], companyIds: [] }; }
  return { cap: "policy.manage", targets: null, companyIds: [] };
}
const decision = (allowed, code, message, req, scopes) => ({ allowed, code, message: String(message).slice(0, 200), requiredCapabilities: req || [], affectedScopes: scopes || [] });
function authorizeInner(m, studio, actorId, cmd) {
  const actor = studio.policy.actors.find((a) => a.id === actorId);
  if (!actor || !actor.active) return decision(false, "actor_inactive", "Actor unknown or inactive");
  let r; try { r = resolveCommand(m, cmd); } catch (e) { return decision(false, e.code || "bad_command", e.message); }
  if (r.targets === null) {
    const ok = actorCan(m, studio, actorId, "policy.manage", null) && actorId === studio.policy.ownerActorId;
    return decision(ok, ok ? "allowed" : "denied", ok ? "Allowed" : "Policy changes need the owner policy.manage grant", ["policy.manage"], [{ kind: "workspace", companyId: null, departmentId: null, includeDescendants: false }]);
  }
  if (r.cap === "history.undo") return decision(true, "deferred", "Undo is checked against the original edit", [], []);
  const scopes = r.targets.map((t) => scopeOf(t.companyId, t.departmentId));
  for (const t of r.targets) if (!actorCan(m, studio, actorId, r.cap, t)) return decision(false, "denied", "No active grant covers this scope", [r.cap], scopes);
  return decision(true, "allowed", "Allowed", [r.cap], scopes);
}
export function authorize(model, studio, actorId, command) {
  const m = cleanModel(model), s = validateStudio(m, studio);
  try { safeTree(command); } catch (e) { return decision(false, "bad_command", e.message); }
  if(command?.type==="history.undo") {
    try{return stage(m,s,{actorId,sequence:(s.cursors[actorId]||0)+1,expectedRevision:s.revision,command},false).decision;}catch(e){return decision(false,e.code||"denied",e.message);}
  }
  return authorizeInner(m, s, actorId, command);
}

// ---- staging ----
function patchesFor(before, after, kind) {
  const out = [], spec = [["companies", ["x", "z"]], ["departments", ["name", "color", "order"]], ["assignments", ["x", "y"]]];
  for (const [col, fields] of spec) for (const rec of after[col]) {
    const old = before[col].find((r) => r.id === rec.id);
    for (const f of fields) if (old && !same(old[f], rec[f])) out.push({ collection: col, recordId: rec.id, field: f, before: old[f], after: rec[f] });
  }
  return out;
}
function stageFloor(m, cmd) {
  const p = cmd, d = core.validateState(m); let seat = null;
  if (cmd.type === "department.rename") findDept(d, p.departmentId).name = p.name;
  else if (cmd.type === "department.color") findDept(d, p.departmentId).color = p.color;
  else if (cmd.type === "department.reorder") p.orderedIds.forEach((id, i) => { findDept(d, id).order = i; });
  else if (cmd.type === "company.move") { const c = d.companies.find((x) => x.id === p.companyId); c.x = p.x; c.z = p.z; }
  else { // assignment.place
    const r = core.moveAssignment(d, p.assignmentId, { x: p.x, y: p.y });
    const a = d.assignments.find((x) => x.id === p.assignmentId), placed = seatsOf(d, a.companyId).find((s2) => s2.assignmentId === a.id);
    for (const other of seatsOf(d, a.companyId)) if (other.assignmentId !== a.id) {
      const dx = other.x - placed.x, dy = other.y - placed.y;
      if (Math.sqrt(dx * dx + dy * dy) < other.r + placed.r + L.minimumSeatSeparation) fail("seat_occupied", "Seat overlaps another seat");
    }
    seat = { x: placed.x, y: placed.y, record: r && r.id };
  }
  return { next: core.validateState(d), seat };
}
function resolvedOf(m, cmd, seat) {
  const c = clone(cmd);
  if (cmd.type === "assignment.place" && seat) { c.x = seat.x; c.y = seat.y; }
  return c;
}
function checkEnvelope(env) {
  safeTree(env);
  exact(env, ["actorId", "sequence", "expectedRevision", "command"], "CommandEnvelope");
  if (typeof env.actorId !== "string" || !ACT_RE.test(env.actorId) || !Number.isSafeInteger(env.sequence) || env.sequence < 1 || !isInt(env.expectedRevision)) fail("bad_envelope", "Bad command envelope");
  const rc = canon(env);
  if (rc.length > L.commandCanonicalBytes) fail("too_large", "Command too large");
  return rc;
}
function findUndoTarget(studio, eventId) {
  const e = studio.journal.find((x) => x.id === eventId);
  if (!e) fail("not_retained", "Event is not retained");
  let latest = null; for (const x of studio.journal) if (x.modelRevisionAfter > x.modelRevisionBefore) latest = x;
  if (!latest || latest.id !== eventId) fail("not_latest", "Only the latest model-changing event can be undone");
  if (!e.undoable || !FLOOR.includes(e.kind)) fail("not_undoable", "Event is not undoable");
  if (studio.journal.some((x) => x.undoOf === eventId)) fail("already_undone", "Event already undone");
  if (e.modelRevisionAfter !== studio.modelRevision) fail("not_latest", "Model changed since this event");
  return e;
}
const CAP_OF = { companies: "company.move", departments: null, assignments: "assignment.place" };
function undoCaps(e) { return e.kind === "history.undo" ? [] : [e.kind]; }

// Common staging. Returns {nextModel,nextStudio,receipt,preview} or throws StudioError.
function stageUnsafe(model, studio, env, commit) {
  const m = cleanModel(model), s = validateStudio(m, studio);
  let rc;
  try { rc = checkEnvelope(env); } catch (e) { if (e instanceof StudioError) throw e; fail("bad_envelope", e.message); }
  const actor = s.policy.actors.find((a) => a.id === env.actorId);
  if (!actor) fail("unknown_actor", "Unknown actor");
  const opId = env.actorId + ":" + env.sequence, cursor = s.cursors[env.actorId] || 0;
  const prior = s.receipts.find((r) => r.opId === opId);
  if (prior) {
    if (prior.requestCanonical !== rc) fail("sequence_conflict", "Sequence reused with a different request");
    return { replay: true, model: m, studio: s, receipt: prior };
  }
  if (env.sequence <= cursor) fail("replay_evicted", "Sequence already consumed and receipt evicted");
  if (!actor.active) fail("actor_inactive", "Actor is not active");
  if (env.sequence !== cursor + 1) fail("bad_sequence", "Sequence must be exactly cursor+1");
  if (env.expectedRevision !== s.revision) fail("stale_revision", "Expected revision is stale");
  const cmd = env.command;
  const d0 = authorizeInner(m, s, env.actorId, cmd);
  if (!d0.allowed) throw Object.assign(new StudioError(d0.code, d0.message), { decision: d0 });
  const t=cmd.type;
  let next = m, patches = [], undoable = false, undoOf = null, resultIds = [], seat = null, dec = d0, resolved = clone(cmd);
  const pol = clone(s.policy), rev = s.revision + 1;
  if (FLOOR.includes(t)) {
    const r = resolveCommand(m, cmd), st = stageFloor(m, cmd);
    next = st.next; seat = st.seat; patches = patchesFor(m, next, t);
    if (!patches.length) fail("no_change", "Command changes nothing");
    geoCheck(next, r.companyIds); undoable = true; resolved = resolvedOf(m, cmd, seat);
    resultIds = [...new Set(patches.map((p) => p.recordId))];
  } else if (t === "history.undo") {
    const e = findUndoTarget(s, cmd.eventId);
    if (e.actorId !== env.actorId && !actorCan(m, s, env.actorId, "history.undoAny", null)) fail("denied", "Undoing another actor's edit needs history.undoAny");
    const d = core.validateState(m);
    for (const p of e.patches) {
      const rec = d[p.collection].find((x) => x.id === p.recordId);
      if (!rec) fail("undo_conflict", "Record no longer exists");
      if (!same(rec[p.field], p.after)) fail("undo_conflict", "Current values differ from the edit's after-values");
    }
    const recs = e.patches.map((p) => m[p.collection].find((x) => x.id === p.recordId));
    for (const p of e.patches) {
      const rec = m[p.collection].find((x) => x.id === p.recordId);
      let target;
      if (p.collection === "companies") target = { companyId: rec.id, departmentId: null };
      else if (p.collection === "departments") target = { companyId: rec.companyId, departmentId: rec.id };
      else target = { companyId: rec.companyId, departmentId: rec.departmentId };
      const cap = CAP_OF[p.collection] || (e.kind === "department.reorder" ? "department.reorder" : e.kind);
      if (!actorCan(m, s, env.actorId, cap, target)) fail("denied", "No current grant covers the original edit");
    }
    if (recs.some((r) => !r)) fail("undo_conflict", "Record missing");
    for (const p of e.patches) d[p.collection].find((x) => x.id === p.recordId)[p.field] = p.before;
    next = core.validateState(d);
    const cids = [...new Set(next.companies.map((c) => c.id))];
    geoCheck(next, cids);
    for (const c of next.companies) {
      const ss = seatsOf(next, c.id);
      for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length; j++) {
        const dx = ss[i].x - ss[j].x, dy = ss[i].y - ss[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < ss[i].r + ss[j].r + L.minimumSeatSeparation) fail("seat_occupied", "Undo would overlap seats");
      }
    }
    patches = e.patches.map((p) => ({ collection: p.collection, recordId: p.recordId, field: p.field, before: p.after, after: p.before })).reverse();
    undoOf = e.id; resultIds = e.resultIds.slice();
    const affected=e.patches.map(p=>{const r=m[p.collection].find(x=>x.id===p.recordId);return p.collection==="companies"?scopeOf(r.id,null):scopeOf(r.companyId,p.collection==="departments"?r.id:r.departmentId);});
    dec=decision(true,"allowed","Allowed",[e.kind,...(e.actorId!==env.actorId?["history.undoAny"]:[])],affected.filter((sc,i,all)=>all.findIndex(x=>same(x,sc))===i));
  } else if (t === "policy.actor.put") {
    const a = normActor(cmd.actor, m), i = pol.actors.findIndex((x) => x.id === a.id);
    if (i >= 0) pol.actors[i] = a; else pol.actors.push(a);
    if (pol.actors.length > L.actors) fail("limit", "Too many actors");
    if (a.id === pol.ownerActorId && (a.role !== "owner" || !a.active)) fail("final_owner", "Final active owner is protected");
    resultIds = [a.id];
  } else if (t === "policy.grant") {
    if (pol.grants.some((g) => g.id === cmd.grantId)) fail("grant_exists", "Grant ID already used");
    if (!pol.actors.some((a) => a.id === cmd.actorId)) fail("unknown_actor", "Unknown grant actor");
    const ids = new Set(pol.actors.map((a) => a.id));
    pol.grants.push(normGrant({ id: cmd.grantId, actorId: cmd.actorId, capabilities: cmd.capabilities, scope: cmd.scope, issuedBy: pol.ownerActorId, issuedAtRevision: rev, revokedAtRevision: null }, m, ids, pol.ownerActorId, rev));
    if (pol.grants.length > L.grants) fail("limit", "Too many grants");
    resultIds = [cmd.grantId];
  } else {
    const g = pol.grants.find((x) => x.id === cmd.grantId);
    if (!g) fail("unknown_grant", "Unknown grant");
    if (g.revokedAtRevision !== null) fail("no_change", "Grant already revoked");
    g.revokedAtRevision = rev; resultIds = [g.id];
  }
  const policyChanged = t.startsWith("policy.");
  if (policyChanged) {
    const p2 = normPolicy(pol, m, rev);
    if (same(p2, s.policy)) fail("no_change", "Policy unchanged");
    pol.actors = p2.actors; pol.grants = p2.grants;
  }
  const modelRev = s.modelRevision + (patches.length ? 1 : 0);
  const entry = { id: "evt_" + rev, opId, actorId: env.actorId, kind: t, revisionBefore: s.revision, revisionAfter: rev, modelRevisionBefore: s.modelRevision, modelRevisionAfter: modelRev, scopes: dec.affectedScopes.map(normScope), patches, undoable, undoOf, resultIds };
  const receipt = { opId, actorId: env.actorId, sequence: env.sequence, requestCanonical: rc, revision: rev, modelRevision: modelRev, eventId: entry.id, resultIds, changed: true };
  const raw = { format: s.format, version: 1, revision: rev, modelRevision: modelRev, modelFingerprint: fingerprint(next), policy: pol, journal: s.journal.concat([entry]).slice(-L.journalEvents), cursors: Object.assign({}, s.cursors, { [env.actorId]: env.sequence }), receipts: s.receipts.concat([receipt]).slice(-L.retainedReceipts) };
  const nextStudio = validateStudio(next, raw);
  if(byteLen(JSON.stringify({...next,studio:nextStudio}))>L.storageBytes)fail("too_large","Snapshot exceeds 2 MiB");
  return { replay: false, model: clone(next), studio: nextStudio, receipt: clone(receipt), patches, resolved, seat, decision: dec, base: m, companyIds: [...new Set(patches.filter((p) => p.collection === "companies").map((p) => p.recordId))] };
}

function stage(model,studio,envelope,commit){
  try{return stageUnsafe(model,studio,envelope,commit);}catch(e){if(e instanceof StudioError)throw e;throw new StudioError("invalid_edit",e?.message||String(e));}
}

export function applyEdit(model, studio, envelope) {
  const r = stage(model, studio, envelope);
  if (r.replay) return { model, studio, receipt: clone(r.receipt), replayed: true };
  return { model: r.model, studio: r.studio, receipt: r.receipt, replayed: false };
}

export function previewEdit(model, studio, envelope) {
  let baseRevision = null;
  try { baseRevision = isObj(envelope) && isInt(envelope.expectedRevision) ? envelope.expectedRevision : null; } catch (e) { baseRevision = null; }
  try {
    const r = stage(model, studio, envelope);
    if (r.replay) return { baseRevision, decision: decision(true, "replay", "Exact retry of an accepted command", [], []), changes: [], resolvedCommand: clone(envelope.command), geometry: { companies: [], seat: null } };
    const cids = [...new Set(r.patches.map((p) => p.collection === "assignments" ? r.model.assignments.find((a) => a.id === p.recordId).companyId : p.collection === "departments" ? r.model.departments.find((d) => d.id === p.recordId).companyId : p.recordId))];
    return { baseRevision, decision: r.decision, changes: r.patches.map((p) => ({ collection: p.collection, recordId: p.recordId, field: p.field, before: p.before, after: p.after })), resolvedCommand: r.resolved, geometry: geometryOf(r.model, cids, envelope.command.type === "assignment.place" ? envelope.command.assignmentId : null) };
  } catch (e) {
    if (e instanceof StudioError) {
      const d = e.decision || decision(false, e.code, e.message);
      return { baseRevision, decision: Object.assign({}, d, { allowed: false, code: e.code, message: e.message }), changes: [], resolvedCommand: null, geometry: { companies: [], seat: null } };
    }
    return { baseRevision, decision: decision(false, "error", String((e && e.message) || e)), changes: [], resolvedCommand: null, geometry: { companies: [], seat: null } };
  }
}

export function observeOwnerChange(previousModel, nextModel, studio, opts) {
  const prev = cleanModel(previousModel), s = validateStudio(prev, studio), next = cleanModel(nextModel);
  if (!isObj(opts) || typeof opts.source !== "string" || !/^[A-Za-z0-9_.:-]{1,60}$/.test(opts.source)) fail("bad_source", "Bad source label");
  geoCheck(next);
  const fp = fingerprint(next);
  if (fp === s.modelFingerprint) return s;
  const rev = s.revision + 1, mrev = s.modelRevision + 1;
  const entry = { id: "evt_" + rev, opId: "owner:" + opts.source, actorId: s.policy.ownerActorId, kind: "owner.change", revisionBefore: s.revision, revisionAfter: rev, modelRevisionBefore: s.modelRevision, modelRevisionAfter: mrev, scopes: [{ kind: "workspace", companyId: null, departmentId: null, includeDescendants: false }], patches: [], undoable: false, undoOf: null, resultIds: [] };
  return validateStudio(next, { format: s.format, version: 1, revision: rev, modelRevision: mrev, modelFingerprint: fp, policy: clone(s.policy), journal: s.journal.concat([entry]).slice(-L.journalEvents), cursors: clone(s.cursors), receipts: clone(s.receipts) });
}

export function readHistory(model, studio, opts) {
  const m = cleanModel(model), s = validateStudio(m, studio);
  if (!isObj(opts) || typeof opts.actorId !== "string") fail("bad_input", "actorId required");
  const a = s.policy.actors.find((x) => x.id === opts.actorId);
  if (!a || !a.active) return [];
  let limit = opts.limit === undefined ? L.historyLimit : opts.limit;
  if (!Number.isSafeInteger(limit) || limit < 1) fail("bad_input", "Bad limit");
  limit = Math.min(limit, L.historyLimit);
  if (opts.companyId !== undefined && !pid(opts.companyId, "co")) fail("bad_input", "Bad companyId");
  const admin = a.id === s.policy.ownerActorId && actorCan(m, s, a.id, "policy.manage", null);
  const caps = EDIT_CAPABILITIES.filter((c) => c !== "policy.manage" && c !== "history.undoAny");
  const out = s.journal.filter((e) => {
    if (opts.companyId !== undefined && !e.scopes.some((sc) => sc.companyId === opts.companyId) && !(e.scopes.some((sc) => sc.kind === "workspace") && admin)) return false;
    if (admin) return true;
    if (!FLOOR.includes(e.kind) && e.kind !== "history.undo") return false;
    return e.scopes.length > 0 && e.scopes.every((sc) => caps.some((c) => actorCan(m, s, a.id, c, sc.kind === "workspace" ? null : { companyId: sc.companyId, departmentId: sc.departmentId })));
  });
  return clone(out.slice(-limit));
}

export function encodeSnapshot(model, studio) {
  const m = cleanModel(model), s = validateStudio(m, studio);
  const text = JSON.stringify(Object.assign({}, m, { studio: s }));
  if (byteLen(text) > L.storageBytes) fail("too_large", "Snapshot exceeds 2 MiB");
  return text;
}

export function decodeSnapshot(jsonText) {
  if (typeof jsonText !== "string" || byteLen(jsonText) > L.storageBytes) fail("bad_snapshot", "Snapshot missing or too large");
  let raw;
  try { raw = JSON.parse(jsonText); } catch (e) { fail("bad_snapshot", "Snapshot is not valid JSON"); }
  if (!isObj(raw)) fail("bad_snapshot", "Snapshot must be an object");
  const hasStudio = Object.prototype.hasOwnProperty.call(raw, "studio");
  const coreRaw = Object.assign({}, raw); delete coreRaw.studio;
  const m = cleanModel(coreRaw);
  if (!hasStudio) return { model: m, studio: null, needsBootstrap: true };
  let s;
  try { s = validateStudio(m, raw.studio); } catch (e) { fail("corrupt_studio", "Studio metadata corrupt; explicit recovery required: " + e.message); }
  return { model: m, studio: s, needsBootstrap: false };
}