import * as core from './blueprint-world-core.js';
import { mountWorld } from './blueprint-world-renderer.js';
import * as edits from './blueprint-world-studio-edits.js';
import { createStudioUI } from './blueprint-world-studio-ui.js';

const $ = (id) => document.getElementById(id);
const canvas = $('world'), root = $('world-panels'), live = $('status-live'), tethers = $('tethers');
const MAXP = 5, MARGIN = 12;
let state = null, world = null, worldOk = false, storageOk = false, saveMsg = 'Session only', zTop = 10;
let selCompany = null, selection = null, mode = 'pan';
const panels = new Map();   // id -> panel record
const drafts = new Map();   // scope key -> values (survive close)
const chats = new Map();    // scope key -> messages
const offsets = new Map();  // panel id -> {dx,dy} world anchor override
const closedOrder = [];
let fieldSequence = 0;
const tuckedPanels = new Map(), pageNumbers = new Map();
let panelDrag = null;
let lastFocused = [];
let busy = false;
let sessionErr = '';
const STORAGE_KEY = 'daftar-blueprint-world-v1';
const STUDIO_CAPABILITIES = ['department.rename', 'department.color', 'department.reorder', 'company.move', 'assignment.place', 'policy.manage', 'history.undoAny'];
const DEPARTMENT_CAPABILITIES = ['department.rename', 'department.color', 'department.reorder', 'assignment.place'];
let studio = null, studioUI = null, studioActorId = '', studioIssue = '', writesFenced = false;
const studioNotices = new Map();

// ---------- storage ----------
function storage() {
  try { const s = window.localStorage; s.getItem('x'); return s; } catch (e) { return null; }
}
const adapter = {
  getItem(k) { const s = storage(); if (!s) throw new Error('storage blocked'); return s.getItem(k); },
  setItem(k, v) { const s = storage(); if (!s) throw new Error('storage blocked'); s.setItem(k, v); }
};
function setSaveLabel(t, warn) { const e = $('save-status'); e.textContent = t; e.classList.toggle('warn', !!warn); }
function persist() {
  try {
    if (writesFenced) throw new Error('Another tab changed this workspace. Reload before making changes.');
    if (studioIssue || !studio) throw new Error(studioIssue || 'Studio metadata is unavailable.');
    // One value retains both core records and Studio policy/history. core.saveState
    // intentionally ignores extension fields and must not run on this save path.
    adapter.setItem(STORAGE_KEY, edits.encodeSnapshot(state, studio));
    storageOk = true; setSaveLabel('Saved'); return true;
  } catch (e) {
    storageOk = false;
    setSaveLabel(writesFenced ? 'Another tab changed · reload' : 'Not saved: session only', true);
    announce('Save failed: ' + ((e && e.message) || String(e)) + '. Saved data was preserved.');
    return false;
  }
}
function announce(t) { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 20); }

// ---------- helpers ----------
const el = (tag, props, ...kids) => {
  const n = document.createElement(tag);
  if (props) for (const k in props) {
    if (k === 'class') n.className = props[k];
    else if (k === 'text') n.textContent = props[k];
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), props[k]);
    else if (props[k] !== undefined && props[k] !== null) n.setAttribute(k, props[k]);
  }
  for (const c of kids) if (c) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
};
const btn = (text, fn, cls, extra) => el('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), text, onclick: fn, 'data-focus-key': extra?.['data-focus-key'] || extra?.['aria-label'] || text }, extra || {}));
const co = (id) => state.companies.find((c) => c.id === id);
const dept = (id) => state.departments.find((d) => d.id === id);
const emp = (id) => state.employees.find((e) => e.id === id);
const coName = (id) => (co(id) ? co(id).name : 'Unknown company');
const errMsg = (e) => (e && e.message) || String(e);
function field(label, input, id) {
  const uniqueId = id + '-' + (++fieldSequence);
  input.id = uniqueId; input.dataset.focusKey = id; return el('div', { class: 'field' }, el('label', { for: uniqueId, text: label }), input);
}
function select(id, opts, val) {
  const s = el('select', { id });
  for (const o of opts) { const op = el('option', { value: o.value, text: o.label }); if (o.value === val) op.selected = true; s.append(op); }
  return s;
}
const companyOpts = () => state.companies.map((c) => ({ value: c.id, label: c.name }));
function deptPath(d) { const p = []; let x = d; let g = 0; while (x && g++ < 5) { p.unshift(x.name); x = x.parentId ? dept(x.parentId) : null; } return p.join(' / '); }
function deptOpts(companyId, none) {
  const l = state.departments.filter((d) => d.companyId === companyId).map((d) => ({ value: d.id, label: deptPath(d) }));
  return none ? [{ value: '', label: none }, ...l] : l;
}
function subtree(id) { const out = new Set([id]); let ch = true; while (ch) { ch = false; for (const d of state.departments) if (d.parentId && out.has(d.parentId) && !out.has(d.id)) { out.add(d.id); ch = true; } } return out; }
function eligibleOwners(companyId, deptId) {
  const set = deptId ? subtree(deptId) : null;
  const seen = new Set(), out = [];
  for (const a of state.assignments) {
    if (a.companyId !== companyId || seen.has(a.employeeId)) continue;
    if (set && !set.has(a.departmentId)) continue;
    const e = emp(a.employeeId); if (!e) continue;
    seen.add(e.id); out.push({ value: e.id, label: e.name + ' (' + e.role + ')' });
  }
  return out;
}
function initials(n) { const p = String(n).trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
const draftKey = (type, scope) => type + '|' + scope;
function getDraft(key) { if (!drafts.has(key)) drafts.set(key, {}); return drafts.get(key); }
function bindDraft(key, node, name) {
  const d = getDraft(key);
  if (d[name] !== undefined) node.value = d[name];
  node.addEventListener('input', () => { d[name] = node.value; });
  node.addEventListener('change', () => { d[name] = node.value; });
  return node;
}
function clearDraft(key) {
  // Retain the object held by mounted input listeners; discard its values only.
  const draft = drafts.get(key);
  if (draft) for (const name of Object.keys(draft)) delete draft[name];
}

// ---------- local Blueprint Studio integration ----------
function uniqueStudioId(prefix, source, used) {
  const base = (prefix + '_' + String(source).toLowerCase().replace(/[^a-z0-9_-]/g, '_')).slice(0, 74);
  let id = base, n = 1;
  while (used.has(id)) { if (++n > 2048) throw new Error('Local Studio identity limit reached.'); id = base + '_' + n; }
  used.add(id); return id;
}
function initialStudioPolicy(model) {
  const ownerActorId = 'act_ceo';
  const actors = [{ id: ownerActorId, label: 'CEO', role: 'owner', employeeId: null, active: true }];
  const grants = [{ id: 'gr_ceo_workspace', actorId: ownerActorId, capabilities: [...STUDIO_CAPABILITIES], scope: { kind: 'workspace', companyId: null, departmentId: null, includeDescendants: false }, issuedBy: ownerActorId, issuedAtRevision: 0, revokedAtRevision: null }];
  const actorIds = new Set([ownerActorId]), grantIds = new Set(['gr_ceo_workspace']);
  for (const company of model.companies) {
    for (const [role, employeeId, capabilities] of [
      ['director', company.directorId, STUDIO_CAPABILITIES.slice(0, 5)],
      ['donna', company.assistantId, DEPARTMENT_CAPABILITIES]
    ]) {
      const employee = model.employees.find(e => e.id === employeeId);
      if (!employee) throw new Error('A company leadership record is unavailable.');
      const id = uniqueStudioId('act_' + role, employeeId, actorIds);
      actors.push({ id, label: employee.name, role, employeeId, active: true });
      grants.push({ id: uniqueStudioId('gr', id, grantIds), actorId: id, capabilities: [...capabilities], scope: { kind: 'company', companyId: company.id, departmentId: null, includeDescendants: false }, issuedBy: ownerActorId, issuedAtRevision: 0, revokedAtRevision: null });
    }
  }
  actors.push({ id: 'act_visitor', label: 'Visiting employee', role: 'visitor', employeeId: null, active: true });
  return { ownerActorId, actors, grants };
}
function studioBlocked() {
  return writesFenced ? 'Another tab changed this workspace. Reload before making changes.' : studioIssue || (!studio ? 'Studio metadata is unavailable.' : '');
}
function requireOwnerWrite() {
  if (writesFenced) throw new Error(studioBlocked());
}
function requireStudioWrite() {
  const reason = studioBlocked(); if (reason) throw new Error(reason);
}
function ownerMutation(source, callback) {
  requireOwnerWrite();
  const previous = state, draft = core.validateState(previous);
  const result = callback(draft);
  const next = core.validateState(draft);
  // Corrupt Studio metadata remains untouched in storage. Ordinary owner work
  // can continue in session, but no replacement policy is invented.
  const nextStudio = studioIssue ? studio : edits.observeOwnerChange(previous, next, studio, { source });
  state = next; studio = nextStudio;
  return result;
}
function studioEnvelope(command, actorId = studioActorId, metadata = studio) {
  if (!metadata) throw new Error('Studio metadata is unavailable.');
  return { actorId, sequence: (metadata.cursors[actorId] || 0) + 1, expectedRevision: metadata.revision, command };
}
function updateStudioButton() {
  for (const companyId of studioNotices.keys()) {
    const assistantId = co(companyId)?.assistantId;
    if (studio?.policy.actors.some(a => a.employeeId === assistantId && a.role === 'donna' && a.active)) studioNotices.delete(companyId);
  }
  const button = $('btn-studio'); if (!button) return;
  const actor = studio?.policy.actors.find(a => a.id === studioActorId && a.active);
  const label = actor?.label || 'unavailable';
  button.textContent = 'Studio · ' + (label.length > 22 ? label.slice(0, 21) + '…' : label);
  button.setAttribute('aria-label', 'Open Blueprint Studio. Local editing actor: ' + label);
  button.title = studioBlocked() || 'Blueprint edits as ' + label + '. Create, hire, tasks and notes remain CEO owner actions.';
}
function setStudioActorId(actorId) {
  requireStudioWrite();
  if (!studio.policy.actors.some(a => a.id === actorId && a.active)) throw new Error('Choose an active registered Studio actor.');
  studioActorId = actorId;
  updateStudioButton();
  // Every open Studio panel must show the new actor before another action.
  // The UI owns actor-scoped draft keys and preserves the other actors' drafts.
  studioUI?.refresh();
}
function commitStudioEnvelope(envelope) {
  requireStudioWrite();
  if (!envelope || envelope.actorId !== studioActorId) throw new Error('The Studio actor changed. Prepare this edit again.');
  const result = edits.applyEdit(state, studio, envelope);
  state = result.model; studio = result.studio;
  if (!studio.policy.actors.some(a => a.id === studioActorId && a.active)) studioActorId = studio.policy.ownerActorId;
  afterMutation();
  return result;
}
function placeAssignment(assignmentId, point) {
  return commitStudioEnvelope(studioEnvelope({ type: 'assignment.place', assignmentId, x: point.x, y: point.y }));
}
function createSubDonna({ companyId, departmentId, name }) {
  requireStudioWrite();
  const ownerId = studio.policy.ownerActorId;
  if (studioActorId !== ownerId) throw new Error('Choose CEO in Studio to create a local sub-Donna.');
  const company = co(companyId), department = dept(departmentId);
  if (!company || !department || department.companyId !== companyId) throw new Error('Choose a department inside this company.');
  let model = core.validateState(state);
  const employee = core.hireEmployee(model, { companyId, departmentId, name, role: 'Sub-Donna', kind: 'resident' });
  employee.reportsToId = company.assistantId;
  model = core.validateState(model);
  let metadata = edits.observeOwnerChange(state, model, studio, { source: 'owner.create-sub-donna' });
  const actorId = uniqueStudioId('act_sub_donna', employee.id, new Set(metadata.policy.actors.map(a => a.id)));
  const actor = { id: actorId, label: employee.name, role: 'sub_donna', employeeId: employee.id, active: true };
  let staged = edits.applyEdit(model, metadata, studioEnvelope({ type: 'policy.actor.put', actor }, ownerId, metadata));
  model = staged.model; metadata = staged.studio;
  const grantId = uniqueStudioId('gr', actorId, new Set(metadata.policy.grants.map(g => g.id)));
  staged = edits.applyEdit(model, metadata, studioEnvelope({ type: 'policy.grant', grantId, actorId, capabilities: [...DEPARTMENT_CAPABILITIES], scope: { kind: 'department', companyId, departmentId, includeDescendants: true } }, ownerId, metadata));
  // Validate serialization before the one visible commit; rejection at any stage
  // leaves the original model, metadata and saved value unchanged.
  edits.encodeSnapshot(staged.model, staged.studio);
  state = staged.model; studio = staged.studio;
  afterMutation();
  announce('Local sub-Donna definition created with an explicit department grant. No worker was started.');
  return { employeeId: employee.id, actorId };
}
function studioOpenPanel(id, title, scopeLabel, selected, builder) {
  return openPanel(id, title, scopeLabel, selected, (body, panel) => {
    const notice = studioNotices.get(selected?.companyId);
    builder(body, panel);
    if (notice) body.prepend(el('p', { class: 'meta', text: notice }));
  });
}
function mountStudioUI() {
  if (!studio || studioIssue) return;
  studioUI = createStudioUI({
    getModel: () => state, getStudio: () => studio, getActorId: () => studioActorId,
    setActorId: setStudioActorId, blocked: studioBlocked, commit: commitStudioEnvelope,
    createSubDonna, openPanel: studioOpenPanel, refreshPanel: renderPanelById,
    openProfile, getWorld: () => world, announce, el, btn, field, select
  });
}
function openStudio(companyId = selCompany, departmentId) {
  if (!co(companyId)) return;
  const reason = studioBlocked();
  if (reason || !studioUI) {
    openPanel('studio-' + companyId, 'Blueprint Studio', coName(companyId), { kind: 'company', id: companyId, companyId }, body => {
      body.append(el('div', { class: 'err', text: reason || 'Studio interface is unavailable.' }), el('p', { class: 'meta', text: 'Local blueprint editing only. Saved data is preserved; reload to review the current stored workspace.' }));
    });
    return;
  }
  studioUI.open(companyId, departmentId);
}
function openDonnaBlueprint(companyId, departmentId) {
  const assistantId = co(companyId)?.assistantId;
  const actor = studio?.policy.actors.find(a => a.employeeId === assistantId && a.role === 'donna' && a.active);
  try {
    if (actor) { setStudioActorId(actor.id); studioNotices.delete(companyId); }
    else if (studio && !studioBlocked()) {
      setStudioActorId(studio.policy.ownerActorId);
      studioNotices.set(companyId, 'This company’s Donna has no registered Studio actor. CEO is selected; register Donna and issue an explicit grant before editing as her.');
    }
  } catch (e) { announce(errMsg(e)); }
  openStudio(companyId, departmentId);
}
function fenceExternalStorage(event) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  if (event.storageArea && event.storageArea !== storage()) return;
  writesFenced = true; storageOk = false;
  setSaveLabel('Another tab changed · reload', true);
  updateStudioButton();
  if (mode === 'arrange') setMode('pan');
  try { studioUI?.refresh(); } catch (e) { /* fence remains authoritative */ }
  announce(studioBlocked());
}

// ---------- panels ----------
function selForPanel(p) { return p.sel; }
function anchorOf(p) {
  let a = null;
  try { a = world && p.sel ? world.getAnchor(p.sel) : null; } catch (e) { a = null; }
  if (!a && p.lastAnchor) a = p.lastAnchor;
  if (a) p.lastAnchor = a;
  const o = offsets.get(p.id);
  if (a && o) return { x: a.x + o.dx, y: a.y, z: a.z + o.dz };
  return a;
}
function positionPanel(p) {
  const n = p.node;
  const w = n.offsetWidth || 380, h = n.offsetHeight || 200;
  const vw = window.innerWidth, vh = window.innerHeight;
  let x, y, clamped = false;
  const a = anchorOf(p);
  let pr = null;
  if (a && world) { try { pr = world.project(a); } catch (e) { pr = null; } }
  if (pr && Number.isFinite(pr.x) && Number.isFinite(pr.y)) { x = pr.x + 24; y = pr.y - h / 2; p.last = { x: pr.x, y: pr.y, vis: pr.visible }; }
  else { x = p.fx != null ? p.fx : 40 + p.idx * 30; y = p.fy != null ? p.fy : 90 + p.idx * 30; pr = null; }
  const minX = MARGIN, maxX = Math.max(MARGIN, vw - w - MARGIN), minY = 64, maxY = Math.max(64, vh - Math.min(h, vh - 150) - 76);
  const cx = Math.min(Math.max(x, minX), maxX), cy = Math.min(Math.max(y, minY), maxY);
  clamped = cx !== x || cy !== y || !(pr && pr.visible);
  p.fx = cx; p.fy = cy;
  n.style.transform = 'translate(' + Math.round(cx) + 'px,' + Math.round(cy) + 'px)';
  // tether
  if (p.tether) {
    if (pr && clamped) { p.tether.setAttribute('x1', pr.x); p.tether.setAttribute('y1', pr.y); p.tether.setAttribute('x2', Math.min(Math.max(pr.x, cx), cx + w)); p.tether.setAttribute('y2', Math.min(Math.max(pr.y, cy), cy + 40)); p.tether.style.display = ''; p.dot.setAttribute('cx', pr.x); p.dot.setAttribute('cy', pr.y); p.dot.style.display = ''; }
    else { p.tether.style.display = 'none'; p.dot.style.display = 'none'; }
  }
}
function positionAll() { for (const p of panels.values()) positionPanel(p); positionDonnaButton(); }
function frontPanel(p) {
  p.node.style.zIndex = ++zTop; p.zn = ++panelSeq;
  for (const q of panels.values()) q.node.classList.toggle('focused', q === p);
  lastFocused = lastFocused.filter((x) => x !== p.id); lastFocused.push(p.id);
}
function closePanel(id, returnFocus) {
  const p = panels.get(id); if (!p) return;
  if (panelDrag?.id === id) panelDrag.cancel();
  p.node.remove(); p.tether.remove(); p.dot.remove();
  panels.delete(id); lastFocused = lastFocused.filter((x) => x !== id);
  const i = closedOrder.indexOf(id); if (i >= 0) closedOrder.splice(i, 1);
  if (returnFocus) {
    const prev = panels.get(lastFocused[lastFocused.length - 1]);
    const t = prev ? prev.node.querySelector('.p-head button') : canvas;
    try { t.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
}
let panelSeq = 0;
// openPanel: id stable; builder(body, panel) fills the panel
function openPanel(id, title, scopeLabel, sel, build) {
  let p = panels.get(id);
  if (p) { frontPanel(p); positionPanel(p); return p; }
  while (panels.size >= MAXP) { const oldest = [...panels.keys()].sort((a, b) => panels.get(a).zn - panels.get(b).zn)[0]; const old = panels.get(oldest); tuckedPanels.set(oldest, {title:old.title,scopeLabel:old.scopeLabel,sel:old.sel,build:old.build}); while(tuckedPanels.size>30)tuckedPanels.delete(tuckedPanels.keys().next().value); closePanel(oldest, false); updateRecent(); announce(old.title + ' tucked away. Open Recent panels to restore it.'); }
  const node = el('section', { class: 'panel', role: 'group', 'aria-labelledby': id + '-h', 'data-panel': id });
  const tether = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  tether.setAttribute('stroke', '#bca269'); tether.setAttribute('stroke-width', '1.5'); tether.setAttribute('stroke-dasharray', '4 3'); tether.style.display = 'none';
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('r', '4'); dot.setAttribute('fill', '#bca269'); dot.style.display = 'none';
  tethers.append(tether, dot);
  p = { id, title, scopeLabel, sel, build, node, tether, dot, idx: panels.size, zn: ++panelSeq };
  panels.set(id, p);
  root.append(node);
  renderPanel(p);
  frontPanel(p); p.zn = ++panelSeq;
  node.addEventListener('pointerdown', () => { frontPanel(p); p.zn = ++panelSeq; });
  node.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closePanel(id, true); } });
  positionPanel(p);
  node.querySelector('h2')?.focus({preventScroll:true});
  return p;
}
function renderPanel(p) {
  const node = p.node;
  const active = node.contains(document.activeElement) ? document.activeElement : null;
  const oldControls = [...node.querySelectorAll('input,textarea,select,button')];
  const focus = active ? {key:active.dataset.focusKey,label:active.getAttribute('aria-label'),index:oldControls.indexOf(active),tag:active.tagName,start:active.selectionStart,end:active.selectionEnd} : null;
  const scrollTop = node.querySelector('.p-body') ? node.querySelector('.p-body').scrollTop : 0;
  node.textContent = '';
  const head = el('div', { class: 'p-head' },
    el('div', { class: 'p-title' }, el('h2', { id: p.id + '-h', text: p.title, tabindex:'-1' }), el('div', { class: 'scope', text: p.scopeLabel })),
    btn('Focus', () => focusPanelTarget(p), '', { 'aria-label': 'Focus ' + p.title + ' in the world' }),
    btn('Close', () => closePanel(p.id, true), '', { 'aria-label': 'Close ' + p.title }));
  const body = el('div', { class: 'p-body' });
  node.append(head, body);
  try { p.build(body, p); } catch (e) { body.append(el('div', { class: 'err', text: 'This panel is unavailable: ' + errMsg(e) })); }
  body.scrollTop = scrollTop;
  setupDrag(head, p);
  if(focus){const controls=[...node.querySelectorAll('input,textarea,select,button')];const target=(focus.tag==='H2'&&node.querySelector('h2'))||(focus.key&&controls.find(n=>n.dataset.focusKey===focus.key))||(focus.label&&controls.find(n=>n.getAttribute('aria-label')===focus.label))||controls[focus.index];if(target?.tagName===focus.tag){target.focus({preventScroll:true});try{if(Number.isInteger(focus.start))target.setSelectionRange(focus.start,focus.end);}catch{}}}
}
function focusPanelTarget(p) {
  if (!world || !p.sel) { announce('World canvas unavailable'); return; }
  try { focusSelection(p.sel); } catch (e) { announce('Cannot focus: ' + errMsg(e)); }
}
function setupDrag(head, p) {
  head.addEventListener('pointerdown', e=>{
    if(e.button!==0||e.isPrimary===false||e.target.closest('button')||!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return;
    panelDrag?.cancel();
    const rect=p.node.getBoundingClientRect(),dx=e.clientX-rect.left,dy=e.clientY-rect.top;
    const original=offsets.has(p.id)?{...offsets.get(p.id)}:null,fx=p.fx,fy=p.fy;
    let finished=false;
    const cleanup=cancel=>{
      if(finished)return;finished=true;
      head.removeEventListener('pointermove',move);head.removeEventListener('pointerup',up);head.removeEventListener('pointercancel',cancelled);head.removeEventListener('lostpointercapture',cancelled);
      window.removeEventListener('blur',cancelled);document.removeEventListener('visibilitychange',hidden);document.removeEventListener('keydown',escape,true);
      if(cancel){if(original)offsets.set(p.id,original);else offsets.delete(p.id);p.fx=fx;p.fy=fy;positionPanel(p);}
      head.classList.remove('dragging');panelDrag=null;try{if(head.hasPointerCapture(e.pointerId))head.releasePointerCapture(e.pointerId);}catch{}
    };
    const move=ev=>{
      if(ev.pointerId!==e.pointerId||!Number.isFinite(ev.clientX)||!Number.isFinite(ev.clientY))return;
      const nx=ev.clientX-dx,ny=ev.clientY-dy;
      const base=world&&p.sel?world.getAnchor(p.sel):null;
      if(base){const point=world.unproject(nx-24,ny+p.node.offsetHeight/2,base.y);if(point)offsets.set(p.id,{dx:point.x-base.x,dz:point.z-base.z});}
      p.fx=nx;p.fy=ny;positionPanel(p);ev.preventDefault();
    };
    const up=ev=>{if(ev.pointerId===e.pointerId)cleanup(false);};
    const cancelled=()=>cleanup(true),hidden=()=>{if(document.hidden)cleanup(true);};
    const escape=ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();cleanup(true);}};
    panelDrag={id:p.id,cancel:cancelled};head.classList.add('dragging');head.setPointerCapture(e.pointerId);
    head.addEventListener('pointermove',move);head.addEventListener('pointerup',up);head.addEventListener('pointercancel',cancelled);head.addEventListener('lostpointercapture',cancelled);
    window.addEventListener('blur',cancelled);document.addEventListener('visibilitychange',hidden);document.addEventListener('keydown',escape,true);e.preventDefault();
  });
}
function updateRecent(){const button=$('btn-recent');if(button){button.hidden=!tuckedPanels.size;button.textContent='Recent ('+tuckedPanels.size+')';}}
function openRecent(){
  openPanel('recent','Recent panels','Preserved work and drafts',{kind:'company',id:selCompany,companyId:selCompany},b=>{
    if(!tuckedPanels.size){b.append(el('p',{class:'meta',text:'All your panels are open.'}));return;}
    for(const [id,p] of [...tuckedPanels].reverse())b.append(el('div',{class:'item'},el('div',{class:'main'},el('strong',{text:p.title}),el('div',{class:'meta',text:p.scopeLabel})),btn('Restore',()=>{tuckedPanels.delete(id);closePanel('recent',false);openPanel(id,p.title,p.scopeLabel,p.sel,p.build);updateRecent();},'',{'aria-label':'Restore '+p.title})));
  });
}
function pagedRows(parent, records, key, makeRow, refresh) {
  const size=12,total=Math.max(1,Math.ceil(records.length/size));
  const page=Math.max(0,Math.min(pageNumbers.get(key)||0,total-1));pageNumbers.set(key,page);
  const list=el('ul',{class:'list'});records.slice(page*size,(page+1)*size).forEach(r=>list.append(makeRow(r)));parent.append(list);
  if(total>1){const previous=btn('Previous',()=>{pageNumbers.set(key,page-1);refresh();}),next=btn('Next',()=>{pageNumbers.set(key,page+1);refresh();});previous.disabled=page===0;next.disabled=page===total-1;previous.dataset.focusKey=key+'-previous';next.dataset.focusKey=key+'-next';parent.append(el('div',{class:'row'},previous,el('span',{class:'meta',text:'Page '+(page+1)+' of '+total}),next));}
}
// targeted rerender: only panels whose content is not being edited
function refreshPanels(force) {
  const act = document.activeElement;
  for (const p of panels.values()) {
    if (p.id.startsWith('studio-')) continue;
    if (p.sel?.kind === 'department') {
      const current = dept(p.sel.id);
      if (current) { p.title = current.name; p.scopeLabel = 'Company: ' + coName(current.companyId) + ' / Department: ' + current.name; }
    } else if (p.sel?.kind === 'employee') {
      const assignment = state.assignments.find(a => a.id === (p.sel.assignmentId || p.sel.id));
      if (assignment) p.scopeLabel = 'Company: ' + coName(assignment.companyId) + ' / Department: ' + (dept(assignment.departmentId)?.name || 'Unavailable');
    }
    const editing = act && p.node.contains(act) && /^(INPUT|TEXTAREA|SELECT)$/.test(act.tagName);
    if (editing && !force) continue;
    renderPanel(p);
  }
  for (const p of panels.values()) positionPanel(p);
}

// ---------- selection -> panels ----------
function selKey(s) { return s.kind + ':' + (s.id || ''); }
function openSelection(s) {
  selection = s;
  if (s.companyId && co(s.companyId)) selCompany = s.companyId;
  updateCrumb();
  if (s.kind === 'restricted') return openRestricted(s);
  if (s.kind === 'company') return openCompany(s.id);
  if (s.kind === 'department') return openDepartment(s.companyId, s.id);
  if (s.kind === 'employee') return openProfile(s.assignmentId || s.id);
  if (s.kind === 'board') return openBoard(s.companyId, s.boardType);
}
function openRestricted(s) {
  openPanel('restricted-' + (s.companyId || 'x'), 'Access required', 'Company: ' + coName(s.companyId), s, (b) => {
    b.append(el('p', { text: 'This placeholder marks a restricted area. No private records are loaded behind it.' }),
      el('p', { class: 'meta', text: 'Access controls will connect to the shared runtime in a separate integration step.' }));
  });
}
function updateCrumb() {
  const t = $('crumb-text');
  t.textContent = selCompany && co(selCompany) ? co(selCompany).name + (selection && selection.kind !== 'company' ? ' / ' + selection.kind : '') : 'None';
}
function focusSelection(s) {
  if (!world) return;
  if (s.kind === 'company') world.focusCompany(s.id);
  else if (s.kind === 'department') world.focusDepartment(s.id);
  else if (s.kind === 'employee') world.focusEmployee(s.assignmentId || s.id);
  else if (s.kind === 'board') world.focusBoard(s.companyId, s.boardType);
  else if (s.companyId) world.focusCompany(s.companyId);
}
function selectInWorld(s) { if (world) { try { world.select(s); } catch (e) { /* stale */ } } }
function go(s, open) { selectInWorld(s); if (open !== false) openSelection(s); try { focusSelection(s); } catch (e) { /* canvas unavailable */ } }

// ---------- company overview ----------
function openCompany(cid) {
  const c = co(cid); if (!c) return;
  openPanel('company-' + cid, c.name, 'Company: ' + c.name, { kind: 'company', id: cid, companyId: cid }, (b) => {
    const cc = co(cid); if (!cc) { b.append(el('div', { class: 'err', text: 'Record unavailable: company no longer exists.' })); return; }
    const sc = core.describeScope(state, cid);
    const depts = state.departments.filter((d) => d.companyId === cid);
    if (cc.parentId && co(cc.parentId)) b.append(el('div', { class: 'meta', text: 'Sub-company of ' + coName(cc.parentId) + ' (organisational link only; grants no authority)' }));
    b.append(el('div', { class: 'stat' }, stat(depts.length, 'Departments'), stat(sc.employeeCount, 'People'), stat(sc.taskCount, 'Tasks')));
    const dir = emp(cc.directorId), don = emp(cc.assistantId);
    b.append(el('div', { class: 'meta', text: 'Director: ' + (dir ? dir.name : 'none') + '. Donna: ' + (don ? don.name : 'none') + '.' }));
    b.append(el('div', { class: 'row' },
      btn('Open Donna', () => openDonna(cid, ''), 'primary'),
      btn('Roadmap', () => go({ kind: 'board', id: cid + ':roadmap', companyId: cid, boardType: 'roadmap' })),
      btn('Ownership', () => go({ kind: 'board', id: cid + ':ownership', companyId: cid, boardType: 'ownership' }))));
    b.append(el('div', { class: 'row' },
      btn('Whiteboard', () => go({ kind: 'board', id: cid + ':whiteboard', companyId: cid, boardType: 'whiteboard' })),
      btn('Hierarchy', () => go({ kind: 'board', id: cid + ':hierarchy', companyId: cid, boardType: 'hierarchy' })),
      btn('Connections', () => openConnections(cid)), btn('Edit blueprint', () => openStudio(cid))));
    b.append(el('div', { class: 'lbl', text: 'Departments' }));
    const ul = el('ul', { class: 'list' });
    for (const d of depts) {
      const n = state.assignments.filter((a) => a.companyId === cid && a.departmentId === d.id).length;
      ul.append(el('li', { class: 'item' }, el('span', { class: 'dot', style: 'background:' + d.color }),
        el('span', { class: 'main', text: deptPath(d) + ' (' + n + ')' }),
        btn('Open', () => go({ kind: 'department', id: d.id, companyId: cid, departmentId: d.id }), '', { 'aria-label': 'Open department ' + d.name })));
    }
    b.append(ul);
    b.append(el('div', { class: 'row' },
      btn('Add department', () => openCreate('department', cid)),
      btn('Hire', () => openCreate('hire', cid)),
      btn('Create sub-company', () => openCreate('subcompany', cid))));
  });
}
const stat = (n, l) => el('div', null, el('b', { text: String(n) }), l);

function openDepartment(cid, did) {
  const d = dept(did); if (!d) return;
  openPanel('dept-' + did, d.name, 'Company: ' + coName(cid) + ' / Department: ' + d.name, { kind: 'department', id: did, companyId: cid, departmentId: did }, (b) => {
    const dd = dept(did); if (!dd) { b.append(el('div', { class: 'err', text: 'Record unavailable: department no longer exists.' })); return; }
    let sc; try { sc = core.describeScope(state, cid, did); } catch (e) { b.append(el('div', { class: 'err', text: errMsg(e) })); return; }
    b.append(el('div', { class: 'stat' }, stat(sc.employeeCount, 'People'), stat(sc.taskCount, 'Tasks'), stat(sc.unassignedTaskCount, 'Unassigned')));
    b.append(el('div', { class: 'meta', text: sc.summary }));
    const set = subtree(did);
    const people = core.companyEmployees(state, cid).filter((e) => set.has(e.departmentId));
    if (!people.length) b.append(el('div', { class: 'empty', text: 'No people in this department yet. Use Hire here to add the first employee.' }));
    else { const ul = el('ul', { class: 'list' }); for (const e of people.slice(0, 40)) ul.append(personItem(e, cid)); b.append(ul); }
    b.append(el('div', { class: 'row' }, btn('Add sub-department', () => openCreate('department', cid, did)), btn('Hire here', () => openCreate('hire', cid, did)), btn('Add task', () => openCreate('task', cid, did)), btn('Ask Donna', () => openDonna(cid, did)), btn('Edit blueprint', () => openStudio(cid, did))));
  });
}
function personItem(e, cid) {
  const col = kindColor(e);
  return el('li', { class: 'item' }, el('span', { class: 'dot', style: 'background:' + col }),
    el('span', { class: 'main', text: e.name + ' - ' + e.role + (e.kind !== 'resident' ? ' (' + e.kind + ')' : '') }),
    btn('Profile', () => go({ kind: 'employee', id: e.assignmentId, companyId: cid, departmentId: e.departmentId, assignmentId: e.assignmentId }), '', { 'aria-label': 'Open profile of ' + e.name, 'data-focus-key':'profile-'+e.assignmentId }));
}
function kindColor(e) {
  const employee = emp(e.id), role = (employee?.role || e.role || '').toLowerCase();
  if (role.includes('donna')) return core.COLORS.donna;
  if (role.includes('director') || role.includes('ceo')) return core.COLORS.director;
  const assignment = state.assignments.find(a => a.employeeId === e.id && a.companyId === e.companyId);
  return dept(assignment?.departmentId)?.color || core.COLORS.employee;
}

// ---------- connections ----------
function openConnections(cid) {
  openPanel('conn-' + cid, 'Connections', 'Company: ' + coName(cid), { kind: 'company', id: cid, companyId: cid }, (b) => {
    const c = co(cid); if (!c) { b.append(el('div', { class: 'err', text: 'Record unavailable.' })); return; }
    b.append(el('div', { class: 'meta', text: 'Relationships derived from records. They show structure only and grant no authority.' }));
    const ul = el('ul', { class: 'list' });
    const add = (t, id) => ul.append(el('li', { class: 'item' }, el('span', { class: 'main', text: t }), btn('Open', () => go({ kind: 'company', id, companyId: id }), '', { 'aria-label': 'Open ' + coName(id) })));
    if (c.parentId && co(c.parentId)) add('Parent company: ' + coName(c.parentId), c.parentId);
    for (const s of state.companies.filter((x) => x.parentId === cid)) add('Sub-company: ' + s.name, s.id);
    const shared = new Map();
    for (const a of state.assignments) {
      const e = emp(a.employeeId); if (!e) continue;
      if (a.companyId === cid && e.homeCompanyId !== cid) shared.set(e.homeCompanyId, (shared.get(e.homeCompanyId) || 0) + 1);
      if (e.homeCompanyId === cid && a.companyId !== cid) shared.set(a.companyId, (shared.get(a.companyId) || 0) + 1);
    }
    for (const [id, n] of shared) if (co(id)) add('Shared employee links with ' + coName(id) + ': ' + n, id);
    if (!ul.children.length) b.append(el('div', { class: 'empty' }, 'No parent, sub-company or shared-employee links.', btn('Create sub-company', () => openCreate('subcompany', cid))));
    else b.append(ul);
  });
}

// ---------- profile ----------
function openProfile(aid) {
  const a = state.assignments.find((x) => x.id === aid); if (!a) return;
  const e = emp(a.employeeId); if (!e) return;
  openPanel('prof-' + aid, e.name, 'Company: ' + coName(a.companyId) + ' / Department: ' + (dept(a.departmentId) ? dept(a.departmentId).name : '?'),
    { kind: 'employee', id: aid, companyId: a.companyId, departmentId: a.departmentId, assignmentId: aid }, (b) => {
      const as = state.assignments.find((x) => x.id === aid), ee = as && emp(as.employeeId);
      if (!ee) { b.append(el('div', { class: 'err', text: 'Record unavailable: this assignment no longer exists.' })); return; }
      const d = dept(as.departmentId);
      b.append(el('div', { class: 'row' }, el('span', { class: 'dot', style: 'width:34px;height:34px;display:grid;place-items:center;font-size:13px;font-weight:700;background:' + kindColor({ id: ee.id, kind: as.kind, companyId: as.companyId }), text: initials(ee.name) }), el('div', null, el('strong', { text: ee.name }), el('div', { class: 'meta', text: ee.role }))));
      b.append(el('div', { class: 'meta', text: 'Home company: ' + coName(ee.homeCompanyId) }));
      if (ee.reportsToId) b.append(el('div', { class: 'meta', text: 'Reports to: ' + (emp(ee.reportsToId)?.name || 'Unavailable') }));
      b.append(el('div', { class: 'meta', text: 'Assigned to: ' + coName(as.companyId) + ' / ' + (d ? d.name : '?') + ' - ' + as.kind }));
      const others = state.assignments.filter((x) => x.employeeId === ee.id && x.id !== as.id);
      if (others.length) { b.append(el('div', { class: 'lbl', text: 'Other assignments' })); const ul = el('ul', { class: 'list' }); for (const o of others) ul.append(el('li', { class: 'item' }, el('span', { class: 'main', text: coName(o.companyId) + ' / ' + (dept(o.departmentId) ? dept(o.departmentId).name : '?') + ' (' + o.kind + ')' }), btn('Open', () => go({ kind: 'employee', id: o.id, companyId: o.companyId, departmentId: o.departmentId, assignmentId: o.id }))));  b.append(ul); }
      b.append(el('div', { class: 'lbl', text: 'Tasks owned in ' + coName(as.companyId) }));
      const tasks = core.companyTasks(state, as.companyId).filter((t) => t.ownerId === ee.id);
      if (!tasks.length) b.append(el('div', { class: 'empty', text: 'No tasks owned here. Use Assign task to prepare one.' }));
      else { const ul = el('ul', { class: 'list' }); for (const t of tasks.slice(0, 20)) ul.append(el('li', { class: 'item' }, el('span', { class: 'main', text: t.title }), el('span', { class: 'tag', text: t.status }), btn('Edit', () => openTask(t.id)))); b.append(ul); }
      b.append(el('div', { class: 'row' }, btn('Assign task', () => openCreate('task', as.companyId, as.departmentId, ee.id)), btn('Ask Donna', () => openDonna(as.companyId, as.departmentId)), btn('Edit blueprint', () => openStudio(as.companyId, as.departmentId)), btn('Focus', () => go({ kind: 'employee', id: as.id, companyId: as.companyId, departmentId: as.departmentId, assignmentId: as.id }, false))));
      b.append(el('div', { class: 'lbl', text: 'Nudge position within the room' }));
      const nudge = el('div', { class: 'row' });
      for (const [lab, dx, dy] of [['Left', -20, 0], ['Right', 20, 0], ['Up', 0, -20], ['Down', 0, 20]]) nudge.append(btn(lab, () => nudgeSeat(as.id, dx, dy), '', { 'aria-label': 'Move ' + ee.name + ' ' + lab.toLowerCase() }));
      b.append(nudge, el('div', { class: 'meta', text: 'Blueprint placement uses the current Studio actor and explicit grants. It changes no department or access.' }));
      const msg = el('div', { id: 'nudge-msg-' + aid, 'aria-live': 'polite' }); b.append(msg);
    });
}
function nudgeSeat(aid, dx, dy) {
  try {
    const a = state.assignments.find((x) => x.id === aid);
    const lay = core.companyLayout(state, a.companyId);
    const seat = lay.seats.find((s) => s.assignmentId === aid); if (!seat) throw new Error('No seat position available');
    placeAssignment(aid, { x: seat.x + dx, y: seat.y + dy });
    announce('Position updated by the current local Studio actor.');
  } catch (e) { const m = document.getElementById('nudge-msg-' + aid); if (m) { m.className = 'err'; m.textContent = errMsg(e); } announce('Move failed: ' + errMsg(e)); }
}

// ---------- boards ----------
function openBoard(cid, type) {
  if (!co(cid)) return;
  const titles = { roadmap: 'Roadmap', ownership: 'Ownership', whiteboard: 'Whiteboard', hierarchy: 'Hierarchy' };
  openPanel('board-' + cid + '-' + type, titles[type] || 'Board', 'Company: ' + coName(cid), { kind: 'board', id: cid + ':' + type, companyId: cid, boardType: type }, (b) => {
    if (!co(cid)) { b.append(el('div', { class: 'err', text: 'Record unavailable.' })); return; }
    if (type === 'roadmap') roadmapBody(b, cid);
    else if (type === 'ownership') ownershipBody(b, cid);
    else if (type === 'whiteboard') whiteboardBody(b, cid);
    else hierarchyBody(b, cid);
  });
}
const STATUS = ['todo', 'doing', 'done'], LANES = ['now', 'next', 'later'];
const boardFilter = {};
function taskRow(t) {
  const o = t.ownerId ? emp(t.ownerId) : null;
  return el('li', { class: 'item' }, el('span', { class: 'main' }, el('div', { text: t.title }), el('div', { class: 'meta', text: (o ? o.name : 'Unassigned') + ' - ' + t.status + ' - ' + t.lane })), btn('Edit', () => openTask(t.id), '', { 'aria-label': 'Edit task ' + t.title, 'data-focus-key':'edit-task-'+t.id }));
}
function roadmapBody(b, cid) {
  const key = 'rm' + cid; const f = boardFilter[key] || (boardFilter[key] = { status: '' });
  const fs = select('rm-f-' + cid, [{ value: '', label: 'All statuses' }, ...STATUS.map((s) => ({ value: s, label: s }))], f.status);
  fs.addEventListener('change', () => { f.status = fs.value; renderPanelById('board-' + cid + '-roadmap'); });
  b.append(field('Filter by status', fs, 'rm-fs-' + cid));
  const all = core.companyTasks(state, cid).filter((t) => !f.status || t.status === f.status);
  if (!all.length) b.append(el('div', { class: 'empty' }, 'No tasks match.', btn('Create task', () => openCreate('task', cid), 'primary')));
  for (const lane of LANES) {
    const ts = all.filter((t) => t.lane === lane);
    b.append(el('div', { class: 'lbl', text: 'Lane: ' + lane + ' (' + ts.length + ')' }));
    if (ts.length) pagedRows(b,ts,'roadmap-'+cid+'-'+lane,taskRow,()=>renderPanelById('board-'+cid+'-roadmap'));
  }
  b.append(btn('Create task', () => openCreate('task', cid), 'primary'));
}
function ownershipBody(b, cid) {
  const ts = core.companyTasks(state, cid);
  if (!ts.length) { b.append(el('div', { class: 'empty' }, 'No tasks yet.', btn('Create task', () => openCreate('task', cid), 'primary'))); return; }
  const groups = new Map();
  for (const t of ts) { const k = t.ownerId || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
  for (const [k, list] of groups) {
    const o = k ? emp(k) : null;
    b.append(el('div', { class: 'lbl', text: (o ? o.name : 'Unassigned') + ' (' + list.length + ')' }));
    pagedRows(b,list,'ownership-'+cid+'-'+k,taskRow,()=>renderPanelById('board-'+cid+'-ownership'));
  }
  b.append(btn('Create task', () => openCreate('task', cid), 'primary'));
}
function whiteboardBody(b, cid) {
  const notes = core.companyNotes(state, cid);
  b.append(el('p', { class: 'meta', text: 'Note changes are local CEO owner actions.' }));
  b.append(el('div', { class: 'lbl', text: 'Notes (' + notes.length + ')' }));
  if (!notes.length) b.append(el('div', { class: 'empty', text: 'No notes yet. Write the first note below.' }));
  const pageKey='notes-'+cid,page=Math.max(0,Math.min(pageNumbers.get(pageKey)||0,Math.max(0,Math.ceil(notes.length/12)-1)));
  for (const n of notes.slice(page*12,(page+1)*12)) {
    const k = draftKey('note-edit', n.id);
    const ta = bindDraft(k, el('textarea', { id: 'nt-' + n.id, maxlength: String(core.LIMITS.textLength), 'aria-label': 'Note text' }), 'text');
    if (getDraft(k).text === undefined) ta.value = n.text;
    const msg = el('div', { 'aria-live': 'polite' });
    b.append(el('div', { class: 'field' }, ta, msg, btn('Save note', () => {
      try { ownerMutation('owner.note.update', draft => core.updateNote(draft, n.id, { text: ta.value })); clearDraft(k); afterMutation(); announce('Note updated.'); } catch (e) { msg.className = 'err'; msg.textContent = errMsg(e); }
    }, '', {'data-focus-key':'save-note-'+n.id})));
  }
  if(notes.length>12){const prev=btn('Previous notes',()=>{pageNumbers.set(pageKey,page-1);renderPanelById('board-'+cid+'-whiteboard');}),next=btn('Next notes',()=>{pageNumbers.set(pageKey,page+1);renderPanelById('board-'+cid+'-whiteboard');});prev.disabled=page===0;next.disabled=(page+1)*12>=notes.length;b.append(el('div',{class:'row'},prev,el('span',{class:'meta',text:'Page '+(page+1)+' of '+Math.ceil(notes.length/12)}),next));}
  const nk = draftKey('note-new', cid);
  const nta = bindDraft(nk, el('textarea', { id: 'nt-new-' + cid, maxlength: String(core.LIMITS.textLength) }), 'text');
  const msg = el('div', { 'aria-live': 'polite' });
  const add = btn('Add note', () => { if (busy) return; busy = true; add.disabled = true; try { const n = ownerMutation('owner.note.create', draft => core.addNote(draft, { companyId: cid, text: nta.value })); clearDraft(nk); afterMutation(); announce('Note added'); } catch (e) { msg.className = 'err'; msg.textContent = errMsg(e); } finally { busy = false; add.disabled = false; } }, 'primary');
  b.append(field('New note', nta, 'nt-new-f-' + cid), msg, add);
}
function hierarchyBody(b, cid) {
  const c = co(cid);
  const counts = (did) => state.assignments.filter((a) => a.companyId === cid && a.departmentId === did).length;
  const node = (d, depth) => {
    const li = el('li', null, d.name + ' (' + counts(d.id) + ') ', btn('Focus', () => go({ kind: 'department', id: d.id, companyId: cid, departmentId: d.id }), 'ghost', { 'aria-label': 'Focus ' + d.name }));
    const kids = state.departments.filter((x) => x.parentId === d.id).sort((a, b2) => a.order - b2.order);
    if (kids.length && depth < 3) { const ul = el('ul', { class: 'tree' }); for (const k of kids) ul.append(node(k, depth + 1)); li.append(ul); }
    return li;
  };
  const top = el('ul', { class: 'tree' });
  for (const o of state.offices.filter((x) => x.companyId === cid)) {
    const li = el('li', { text: 'Office: ' + o.name }); const ul = el('ul', { class: 'tree' });
    for (const d of state.departments.filter((x) => x.officeId === o.id && !x.parentId).sort((a, b2) => a.order - b2.order)) ul.append(node(d, 0));
    li.append(ul); top.append(li);
  }
  b.append(el('div', { class: 'meta', text: 'Company: ' + c.name + (c.parentId ? ' (sub-company of ' + coName(c.parentId) + ')' : '') }), top);
}
function renderPanelById(id) { const p = panels.get(id); if (p) renderPanel(p); }

// ---------- task editor ----------
function openTask(tid) {
  const t = state.tasks.find((x) => x.id === tid); if (!t) return;
  openPanel('task-' + tid, 'Edit task', 'Company: ' + coName(t.companyId), { kind: 'company', id: t.companyId, companyId: t.companyId }, (b) => {
    const tt = state.tasks.find((x) => x.id === tid);
    if (!tt) { b.append(el('div', { class: 'err', text: 'Record unavailable: task no longer exists.' })); return; }
    b.append(el('p', { class: 'meta', text: 'Task changes are local CEO owner actions.' }));
    const k = draftKey('task-edit', tid), d = getDraft(k);
    const title = bindDraft(k, el('input', { type: 'text', maxlength: String(core.LIMITS.textLength) }), 'title'); if (d.title === undefined) title.value = tt.title;
    const dsel = bindDraft(k, select('te-dept-' + tid, deptOpts(tt.companyId, 'No department'), d.dept !== undefined ? d.dept : (tt.departmentId || '')), 'dept'); if (d.dept === undefined) dsel.value = tt.departmentId || '';
    const owner = bindDraft(k, select('te-own-' + tid, [{ value: '', label: 'Unassigned' }, ...eligibleOwners(tt.companyId, dsel.value || null)], tt.ownerId || ''), 'owner'); if (d.owner === undefined) owner.value = tt.ownerId || '';
    dsel.addEventListener('change', () => { const ops = [{ value: '', label: 'Unassigned' }, ...eligibleOwners(tt.companyId, dsel.value || null)]; owner.textContent = ''; for (const o of ops) owner.append(el('option', { value: o.value, text: o.label })); owner.value = ''; d.owner = ''; });
    const lane = bindDraft(k, select('te-lane-' + tid, LANES.map((x) => ({ value: x, label: x })), tt.lane), 'lane'); if (d.lane === undefined) lane.value = tt.lane;
    const status = bindDraft(k, select('te-st-' + tid, STATUS.map((x) => ({ value: x, label: x })), tt.status), 'status'); if (d.status === undefined) status.value = tt.status;
    const msg = el('div', { 'aria-live': 'polite' });
    b.append(field('Title', title, 'te-title-' + tid), field('Department', dsel, 'te-dsel-' + tid), field('Owner', owner, 'te-osel-' + tid));
    b.append(el('div', { class: 'row' }, field('Lane (roadmap placement)', lane, 'te-lsel-' + tid), field('Status (progress)', status, 'te-ssel-' + tid)));
    const save = btn('Save changes', () => {
      if (busy) return; busy = true; save.disabled = true;
      try { ownerMutation('owner.task.update', draft => core.updateTask(draft, tid, { title: title.value, departmentId: dsel.value || null, ownerId: owner.value || null, lane: lane.value, status: status.value })); clearDraft(k); closePanel('task-' + tid, true); afterMutation(); announce('Task updated.'); }
      catch (e) { msg.className = 'err'; msg.textContent = errMsg(e); }
      finally { busy = false; save.disabled = false; }
    }, 'primary');
    b.append(msg, save);
  });
}

// ---------- create forms ----------
function createPanelId(kind, cid, did, ownerId) { return 'create-' + kind + '-' + cid + (did ? '-' + did : '') + (ownerId ? '-' + ownerId : ''); }
function openCreate(kind, cid, did, ownerId) {
  const base = cid || selCompany || state.companies[0].id;
  const id = createPanelId(kind, base, did, ownerId);
  const titles = { company: 'Create company', subcompany: 'Create sub-company', department: 'Add department', hire: 'Hire employee', task: 'Create task', note: 'Create note' };
  const scopeLabel = kind === 'company' ? 'CEO owner · New company · on this table' : coName(base)+(did&&dept(did)?' › '+dept(did).name:'')+(ownerId&&emp(ownerId)?' › '+emp(ownerId).name:'');
  openPanel(id, titles[kind], kind === 'company' ? scopeLabel : 'CEO owner · ' + scopeLabel, { kind: 'company', id: base, companyId: base }, (b, p) => buildCreate(b, kind, base, did, ownerId, id));
  const p = panels.get(id); const f = p.node.querySelector('input,select,textarea'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
}
function buildCreate(b, kind, base, did, ownerId, pid) {
  const k = draftKey('create-' + kind, pid);
  const msg = el('div', { 'aria-live': 'polite', class: '' });
  const fail = (e) => { msg.className = 'err'; msg.textContent = errMsg(e); announce('Could not create: ' + errMsg(e)); };
  const d0 = getDraft(k);
  const text = (id, label, name, max, ph) => { const i = bindDraft(k, el('input', { type: 'text', maxlength: String(max || core.LIMITS.nameLength), placeholder: ph || '' }), name); b.append(field(label, i, id + '-' + base)); return i; };
  const sel = (id, label, name, opts, def) => { const s = el('select', { id: id + '-' + base }); for (const o of opts) s.append(el('option', { value: o.value, text: o.label })); s.value = d0[name] !== undefined ? d0[name] : (def !== undefined ? def : (opts[0] ? opts[0].value : '')); s.addEventListener('change', () => { d0[name] = s.value; }); b.append(field(label, s, id + '-f-' + base)); return s; };
  const finish = (created, label) => {
    clearDraft(k); closePanel(pid, false); afterMutation(); announce(label + ' created');
    if (created && created.sel) go(created.sel);
  };
  let submit;
  if (kind === 'company' || kind === 'subcompany') {
    const name = text('cc-name', kind === 'company' ? 'Company name' : 'Sub-company name', 'name');
    submit = () => { const c = ownerMutation('owner.company.create', draft => core.createCompany(draft, { name: name.value, parentId: kind === 'subcompany' ? base : null })); selCompany = c.id; finish({ sel: { kind: 'company', id: c.id, companyId: c.id } }, 'Company'); };
    if (kind === 'subcompany') b.append(el('div', { class: 'meta', text: 'Parent: ' + coName(base) + '. The link is organisational only.' }));
  } else if (kind === 'department') {
    const name = text('cd-name', 'Department name', 'name');
    const par = sel('cd-par', 'Parent department', 'parent', deptOpts(base, 'Top level'), did || '');
    submit = () => { const d = ownerMutation('owner.department.create', draft => core.createDepartment(draft, { companyId: base, parentId: par.value || null, name: name.value })); finish({ sel: { kind: 'department', id: d.id, companyId: base, departmentId: d.id } }, 'Department'); };
  } else if (kind === 'hire') {
    const name = text('ch-name', 'Name', 'name');
    const role = text('ch-role', 'Role', 'role');
    const dp = sel('ch-dept', 'Department', 'dept', deptOpts(base), did || undefined);
    const kd = sel('ch-kind', 'Assignment kind', 'kind', [{ value: 'resident', label: 'Resident' }, { value: 'shared', label: 'Shared' }, { value: 'visiting', label: 'Visiting' }], 'resident');
    b.append(el('div', { class: 'meta', text: 'Creates a new employee definition and one assignment. Grants no real access.' }));
    submit = () => {
      const before = new Set(state.assignments.map((a) => a.id));
      const e = ownerMutation('owner.employee.hire', draft => core.hireEmployee(draft, { companyId: base, departmentId: dp.value, name: name.value, role: role.value, kind: kd.value }));
      const a = state.assignments.find((x) => !before.has(x.id) && x.employeeId === e.id);
      finish(a ? { sel: { kind: 'employee', id: a.id, companyId: base, departmentId: a.departmentId, assignmentId: a.id } } : null, 'Employee');
    };
  } else if (kind === 'task') {
    const title = text('ct-title', 'Task title', 'title', core.LIMITS.textLength);
    const dp = sel('ct-dept', 'Department', 'dept', deptOpts(base, 'No department'), did || '');
    const ow = el('select', { id: 'ct-own-' + base });
    const fill = () => { ow.textContent = ''; for (const o of [{ value: '', label: 'Unassigned' }, ...eligibleOwners(base, dp.value || null)]) ow.append(el('option', { value: o.value, text: o.label })); };
    fill();
    ow.value = d0.owner !== undefined ? d0.owner : (ownerId || '');
    if (ow.value !== (d0.owner !== undefined ? d0.owner : (ownerId || ''))) ow.value = '';
    ow.addEventListener('change', () => { d0.owner = ow.value; });
    dp.addEventListener('change', () => { fill(); d0.owner = ''; });
    b.append(field('Owner (eligible people only)', ow, 'ct-ownf-' + base));
    submit = () => { const t = ownerMutation('owner.task.create', draft => core.addTask(draft, { companyId: base, departmentId: dp.value || null, title: title.value, ownerId: ow.value || null })); finish({ sel: { kind: 'board', id: base + ':roadmap', companyId: base, boardType: 'roadmap' } }, 'Task'); };
  } else {
    const ta = bindDraft(k, el('textarea', { maxlength: String(core.LIMITS.textLength) }), 'text');
    b.append(field('Note text', ta, 'cn-text-' + base));
    submit = () => { ownerMutation('owner.note.create', draft => core.addNote(draft, { companyId: base, text: ta.value })); finish({ sel: { kind: 'board', id: base + ':whiteboard', companyId: base, boardType: 'whiteboard' } }, 'Note'); };
  }
  const go1 = btn('Create', () => {
    if (busy) return; busy = true; go1.disabled = true; msg.textContent = '';
    try { submit(); } catch (e) { fail(e); } finally { busy = false; go1.disabled = false; }
  }, 'primary');
  b.append(msg, el('div', { class: 'row' }, go1, btn('Cancel', () => closePanel(pid, true))));
}

function afterMutation() {
  persist();
  if (world) { try { world.setState(state); } catch (e) { announce('Render update failed: ' + errMsg(e)); } }
  refreshPanels(false);
  drawMinimap();
  updateCrumb();
  updateStudioButton();
  try { studioUI?.refresh(); } catch (e) { announce('Studio refresh failed: ' + errMsg(e)); }
}

// ---------- Donna ----------
const donnaBtn = () => $('donna-btn');
function donnaScope(cid, did) { return cid + '|' + (did || ''); }
function donnaReply(cid, did, q) {
  const sc = core.describeScope(state, cid, did || undefined);
  const allowed = did ? subtree(did) : null;
  const tasks = core.companyTasks(state, cid).filter(t => !allowed || allowed.has(t.departmentId));
  const query = q.toLowerCase();
  if (/unassigned|without owner|need.*owner/.test(query)) {
    const unassigned = tasks.filter(t => !t.ownerId && t.status !== 'done');
    return unassigned.length ? unassigned.length + ' open tasks need an owner:\n' + unassigned.slice(0,8).map(t=>'• '+t.title).join('\n') : 'Every open task in this scope has an owner.';
  }
  if (/who|people|team|staff/.test(query)) {
    const people=core.companyEmployees(state,cid).filter(e=>!allowed || allowed.has(e.departmentId));
    return people.length+' employee definitions in this scope.\n'+people.slice(0,8).map(e=>e.name+' · '+e.role+(e.kind!=='resident'?' · '+e.kind:'')).join('\n');
  }
  if (/task|open|todo|work|summary|summari/.test(query)) return sc.taskCount + (sc.taskCount===1?' task: ':' tasks: ') + sc.openTaskCount + ' open, ' + sc.unassignedTaskCount + ' unassigned and ' + sc.doneTaskCount + ' done.\n' + tasks.filter(t=>t.status!=='done').slice(0,5).map(t=>'• '+t.title+' · '+(t.ownerId ? emp(t.ownerId)?.name || 'Owner unavailable' : 'Unassigned')).join('\n');
  return 'I can summarize work, show unassigned tasks and explain this team. Use Prepare task or Prepare hire to open a draft for you to review.';
}
function assistantSelection(cid, did) {
  if (did) return {kind:'department',id:did,companyId:cid,departmentId:did};
  const assignment = state.assignments.find(a=>a.companyId===cid && a.employeeId===co(cid)?.assistantId);
  return assignment ? {kind:'employee',id:assignment.id,assignmentId:assignment.id,companyId:cid,departmentId:assignment.departmentId} : {kind:'company',id:cid,companyId:cid};
}
function openDonna(cid, did) {
  if (!co(cid)) return;
  if (did && dept(did)?.companyId !== cid) { announce('That department is outside this company.'); return; }
  const key = donnaScope(cid, did), id = 'donna-' + key;
  const existing=panels.get(id);
  if(existing){frontPanel(existing);existing.node.querySelector('textarea')?.focus({preventScroll:true});return;}
  if (!chats.has(key)) chats.set(key,[{r:'a',t:'I can help you review this team’s work and prepare local task or hiring drafts.'}]);
  openPanel(id,'Donna','Company: '+coName(cid)+(did?' / '+dept(did).name:''),assistantSelection(cid,did),(b,p)=>{
    const scopeCompany=select('donna-company',companyOpts(),cid);
    const scopeDepartment=select('donna-department',deptOpts(cid,'Whole company'),did||'');
    scopeCompany.addEventListener('change',()=>{
      scopeDepartment.textContent='';for(const o of deptOpts(scopeCompany.value,'Whole company'))scopeDepartment.append(el('option',{value:o.value,text:o.label}));
    });
    const switchScope=()=>{const nextCid=scopeCompany.value,nextDid=scopeDepartment.value;if(donnaScope(nextCid,nextDid)!==key){closePanel(id,false);openDonna(nextCid,nextDid);}};
    b.append(el('span',{class:'tag',text:'Scripted demo'}),el('div',{class:'row'},field('Company',scopeCompany,'donna-company'),field('Department',scopeDepartment,'donna-department')),btn('Open scope',switchScope,'ghost'));
    const msgs=el('div',{class:'msgs',role:'log','aria-label':'Donna conversation','aria-live':'polite',tabindex:'0'});
    const append=m=>msgs.append(el('div',{class:'msg '+m.r,text:m.t}));
    for(const m of chats.get(key))append(m);
    const draft=draftKey('donna',key),ta=bindDraft(draft,el('textarea',{rows:'2',maxlength:String(core.LIMITS.textLength),'aria-label':'Message Donna',placeholder:'Ask about this company’s work…'}),'text');
    const send=(question)=>{
      const value=(question ?? ta.value).trim();if(!value)return;
      let reply;try{reply=donnaReply(cid,did,value);}catch(e){reply='Scope unavailable: '+errMsg(e);}
      const list=chats.get(key);for(const m of [{r:'u',t:value},{r:'a',t:reply}]){list.push(m);append(m);}
      while(list.length>40)list.shift();while(msgs.children.length>40)msgs.firstChild.remove();
      if(question===undefined){ta.value='';clearDraft(draft);}
      msgs.scrollTop=msgs.scrollHeight;positionPanel(p);ta.focus({preventScroll:true});
    };
    ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
    const prepareTask=()=>{
      const pid=createPanelId('task',cid,did);
      const taskDraft=getDraft(draftKey('create-task',pid));
      if(ta.value.trim() && !taskDraft.title)taskDraft.title=ta.value.trim();
      openCreate('task',cid,did);
    };
    b.append(el('div',{class:'row'},btn('Summarize work',()=>send('Summarize work')),btn('Unassigned tasks',()=>send('Unassigned tasks'))),msgs,field('Message',ta,'donna-message'),btn('Send',()=>send(),'primary'),el('div',{class:'row'},btn('Prepare task',prepareTask),btn('Prepare hire',()=>openCreate('hire',cid,did)),btn('Edit blueprint',()=>openDonnaBlueprint(cid,did))));
    msgs.scrollTop=msgs.scrollHeight;
  });
  panels.get(id)?.node.querySelector('textarea')?.focus({preventScroll:true});
}
function positionDonnaButton() {
  const layer=$('donna-anchor-layer');if(!layer)return;
  let button=donnaBtn();
  if(!button){button=el('button',{type:'button',id:'donna-btn',class:'donna-btn',text:'Ask Donna','aria-label':'Open Donna assistant',onclick:()=>openDonna(selCompany,selection?.companyId===selCompany ? selection?.departmentId || '' : '')});layer.append(button);}
  if(!world||!worldOk||!co(selCompany)){button.hidden=true;return;}
  const anchor=world.getAnchor(assistantSelection(selCompany));
  const pr=anchor&&world.project(anchor);
  if(!pr?.visible){button.hidden=true;return;}
  button.hidden=false;
  button.style.left=Math.max(65,Math.min(innerWidth-65,pr.x))+'px';
  button.style.top=Math.max(100,Math.min(innerHeight-100,pr.y-14))+'px';
  button.style.transform='translate(-50%,-100%)';
}

// ---------- search ----------
function openSearch() {
  const key = 'search';
  const qk = draftKey('search', 'q');
  openPanel('search', 'Search', 'Scope: all local records', { kind: 'company', id: selCompany, companyId: selCompany }, (b) => {
    const input = bindDraft(qk, el('input', { type: 'search', id: 'search-q', placeholder: 'Search companies, departments, people, tasks, notes' }), 'q');
    const out = el('div', { 'aria-live': 'polite' });
    const run = () => {
      out.textContent = '';
      let rs = []; try { rs = core.searchRecords(state, input.value); } catch (e) { out.append(el('div', { class: 'err', text: errMsg(e) })); return; }
      if (!input.value.trim()) { out.append(el('div', { class: 'empty', text: 'Type to search.' })); return; }
      if (!rs.length) { out.append(el('div', { class: 'empty', text: 'No results.' })); return; }
      const ul = el('ul', { class: 'list' });
      for (const r of rs) ul.append(el('li', { class: 'item' }, el('span', { class: 'main' }, el('div', { text: r.label }), el('div', { class: 'meta', text: r.type + ' - ' + r.subtitle })), btn('Open', () => openResult(r), '', { 'aria-label': 'Open ' + r.label })));
      out.append(ul);
    };
    input.addEventListener('input', run);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const f = out.querySelector('button'); if (f) f.click(); } });
    b.append(field('Query', input, 'search-f'), out); run();
  });
  const p = panels.get('search'); const i = p && p.node.querySelector('input'); if (i) try { i.focus({ preventScroll: true }); i.select(); } catch (e) { /* ignore */ }
}
function openResult(r) {
  let s;
  if (r.type === 'employee' && r.assignmentId) s = { kind: 'employee', id: r.assignmentId, companyId: r.companyId, departmentId: r.departmentId, assignmentId: r.assignmentId };
  else if (r.type === 'department' && r.departmentId) s = { kind: 'department', id: r.departmentId, companyId: r.companyId, departmentId: r.departmentId };
  else if (r.type === 'task') { go({ kind: 'board', id: r.companyId + ':roadmap', companyId: r.companyId, boardType: 'roadmap' }); openTask(r.id); return; }
  else if (r.type === 'note') { const notes=core.companyNotes(state,r.companyId),index=notes.findIndex(n=>n.id===r.id);pageNumbers.set('notes-'+r.companyId,Math.max(0,Math.floor(index/12)));s={kind:'board',id:r.companyId+':whiteboard',companyId:r.companyId,boardType:'whiteboard'};go(s);renderPanelById('board-'+r.companyId+'-whiteboard');const note=panels.get('board-'+r.companyId+'-whiteboard')?.node.querySelector('#nt-'+CSS.escape(r.id));note?.focus({preventScroll:true});return;}
  else s = { kind: 'company', id: r.companyId, companyId: r.companyId };
  go(s);
}

// ---------- directory ----------
function openDirectory() {
  const anchor = { kind: 'company', id: selCompany, companyId: selCompany };
  openPanel('directory', 'Directory', 'Companies, departments and people', anchor, (b) => {
    const key = draftKey('directory', 'company');
    const current = getDraft(key).companyId || selCompany;
    const choose = bindDraft(key, select('directory-company', companyOpts(), current), 'companyId');
    const lists = el('div');
    const render = () => {
      const cid = choose.value;
      lists.textContent = '';
      lists.append(btn('Open company', () => go({kind:'company',id:cid,companyId:cid}), 'primary'));
      const list = (title, items) => {
        lists.append(el('h3', {class:'lbl',text:title}));
        const ul = el('ul', {class:'list'});
        for (const item of items) ul.append(el('li',{class:'item'},el('span',{class:'main',text:item.label}),btn('Open',item.open,'',{'aria-label':'Open '+item.label})));
        if (items.length) lists.append(ul); else lists.append(el('p',{class:'meta',text:'No records yet.'}));
      };
      list('Departments', state.departments.filter(d=>d.companyId===cid).map(d=>({label:deptPath(d),open:()=>go({kind:'department',id:d.id,companyId:cid,departmentId:d.id})})));
      const people=core.companyEmployees(state,cid);
      list('People', people.slice(0,100).map(e=>({label:e.name+' · '+e.role+(e.kind!=='resident'?' · '+e.kind:''),open:()=>go({kind:'employee',id:e.assignmentId,companyId:cid,departmentId:e.departmentId,assignmentId:e.assignmentId})})));
      if(people.length>100) lists.append(btn('Search all '+people.length+' people',openSearch));
    };
    choose.addEventListener('change',render);
    b.append(field('Company',choose,'directory-company-field'),lists);render();
  });
}

// ---------- minimap ----------
function drawMinimap() {
  const svg = $('minimap-svg'), list = $('minimap-list'); if (!svg || !list || !state) return;
  svg.textContent = ''; list.textContent = '';
  const cs = state.companies; if (!cs.length) return;
  const sizes = new Map(cs.map(c => [c.id, core.companyLayout(state,c.id)]));
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of cs) { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x + c.width); minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z + sizes.get(c.id).height); }
  const sx = 180 / Math.max(1, maxX - minX), sz = 70 / Math.max(1, maxZ - minZ), s = Math.min(sx, sz);
  for (const c of cs) {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', 10 + (c.x - minX) * s); r.setAttribute('y', 10 + (c.z - minZ) * s);
    r.setAttribute('width', Math.max(4, c.width * s)); r.setAttribute('height', Math.max(4, sizes.get(c.id).height * s));
    r.setAttribute('fill', c.id === selCompany ? '#d3b570' : '#8a93a3'); r.setAttribute('fill-opacity', '0.6');
    r.addEventListener('click', () => go({ kind: 'company', id: c.id, companyId: c.id }));
    svg.append(r);
    list.append(el('div', null, btn(c.name + (c.id === selCompany ? ' (current)' : ''), () => go({ kind: 'company', id: c.id, companyId: c.id }), 'ghost')));
  }
}

// ---------- help / diagnostics ----------
function rectOf(n) { const r = n.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }
function openHelp() {
  openPanel('help', 'Help', 'Scope: this demo', { kind: 'company', id: selCompany, companyId: selCompany }, (b) => {
    b.append(el('p', { text: 'Pan, orbit and arrange modes change the camera or seat positions. Click a room, person or board to open its panel. Ctrl/Cmd+K searches. Escape closes the top panel. All changes stay in this browser; access is simulated.' }));
    b.append(el('div', { class: 'lbl', text: 'Diagnostics' }));
    const pre = el('pre', { class: 'meta', id: 'diag-out', style: 'white-space:pre-wrap;overflow:auto;max-height:240px' });
    const fill = () => {
      let m = null; try { m = world && worldOk ? world.getMetrics() : null; } catch (e) { m = { error: errMsg(e) }; }
      const de = document.documentElement, bd = document.body;
      const lines = ['World: ' + (m ? JSON.stringify(m) : 'not ready'),
        'Viewport: ' + window.innerWidth + 'x' + window.innerHeight + ' dpr ' + window.devicePixelRatio,
        'Scroll doc: ' + de.scrollLeft + ',' + de.scrollTop + ' size ' + de.scrollWidth + 'x' + de.scrollHeight,
        'Scroll body: ' + bd.scrollLeft + ',' + bd.scrollTop + ' size ' + bd.scrollWidth + 'x' + bd.scrollHeight,
        'Scroll window: ' + window.scrollX + ',' + window.scrollY,
        'Storage: ' + (storageOk ? 'saved' : 'session only'),
        'Panels: ' + panels.size];
      for (const p of panels.values()) lines.push('  ' + p.id + ' ' + rectOf(p.node));
      pre.textContent = lines.join('\n');
    };
    fill();
    b.append(pre, btn('Refresh', fill, 'primary'));
  });
}

// ---------- recovery ----------
function openRecovery(err) {
  const msg = typeof err === 'string' ? err : errMsg(err);
  sessionErr = msg;
  const sel = selCompany && co(selCompany) ? { kind: 'company', id: selCompany, companyId: selCompany } : null;
  openPanel('recovery', 'World unavailable', 'Scope: renderer', sel, (b) => {
    b.append(el('div', { class: 'err', text: 'The 3D world could not start: ' + msg }), el('p', { class: 'meta', text: 'Panels and search still work with local records. Your saved data was not changed.' }), btn('Reload', () => location.reload(), 'primary'));
  });
  $('loading').style.display = 'none';
}

// ---------- bootstrap ----------
function setMode(m) {
  mode = m;
  if (world && worldOk) { try { world.setMode(m); } catch (e) { announce('Mode failed: ' + errMsg(e)); } }
  for (const b of document.querySelectorAll('button[data-mode]')) { const on = b.dataset.mode === m; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('on', on); }
}
const cam = (fn) => () => { if (!world || !worldOk) { announce('World not ready'); return; } try { fn(); } catch (e) { announce('Camera failed: ' + errMsg(e)); } };
let rotAcc = 0;

function bootstrap() {
  let loaded = null, corrupt = '', raw = null, hasStudioMetadata = false;
  try {
    const local = storage();
    storageOk = !!local;
    raw = local ? local.getItem(STORAGE_KEY) : null;
    if (raw !== null) {
      // Bound parsing before inspecting optional metadata. Existing core-only
      // corruption keeps the prior sample-data recovery behavior.
      const rawBytes = typeof TextEncoder === 'function' ? new TextEncoder().encode(raw).length : raw.length;
      if (rawBytes > core.LIMITS.storageBytes) {
        hasStudioMetadata = true; // Unknown oversized content must not be replaced by a fresh policy.
        throw new Error('Stored workspace exceeds the storage limit.');
      }
      const parsed = JSON.parse(raw);
      hasStudioMetadata = !!parsed && typeof parsed === 'object' && Object.hasOwn(parsed, 'studio');
      loaded = core.validateState(parsed);
      const decoded = edits.decodeSnapshot(raw);
      loaded = decoded.model; studio = decoded.studio;
      if (decoded.needsBootstrap) studio = edits.createStudio(loaded, initialStudioPolicy(loaded));
      setSaveLabel('Saved');
    } else {
      loaded = core.seedState(); studio = edits.createStudio(loaded, initialStudioPolicy(loaded));
      setSaveLabel(local ? 'Not saved yet' : 'Session only', !local);
    }
  } catch (e) {
    storageOk = false;
    if (hasStudioMetadata) {
      studio = null;
      studioIssue = 'Stored Studio metadata is invalid. Blueprint edits are blocked and saved data is preserved. CEO record changes can continue in this session only.';
      corrupt = studioIssue; setSaveLabel('Studio blocked · session only', true);
    } else {
      loaded = core.seedState();
      try { studio = edits.createStudio(loaded, initialStudioPolicy(loaded)); }
      catch (policyError) { studio = null; studioIssue = 'Studio policy is unavailable: ' + errMsg(policyError); }
      corrupt = raw !== null ? 'Stored data was unreadable; showing sample data. It is not overwritten until you make a change.' : 'Storage is unavailable; changes stay in this session.';
      setSaveLabel(raw !== null ? 'Stored data unreadable' : 'Session only', true);
    }
  }
  state = loaded || core.seedState();
  studioActorId = studio?.policy.ownerActorId || '';
  selCompany = state.companies[0] && state.companies[0].id;
  selection = selCompany ? { kind: 'company', id: selCompany, companyId: selCompany } : null;
  mountStudioUI(); updateStudioButton();
  updateCrumb(); drawMinimap();
  if (corrupt) announce(corrupt);
  window.addEventListener('storage', fenceExternalStorage);
  $('btn-studio')?.addEventListener('click', () => openStudio(selCompany, selection?.companyId === selCompany ? selection.departmentId : undefined));

  for (const b of document.querySelectorAll('#create-menu button[data-create]')) b.addEventListener('click', () => { $('create-menu').hidden = true; $('btn-create').setAttribute('aria-expanded', 'false'); const kind=b.dataset.create;const did=selection?.companyId===selCompany?selection.departmentId:undefined;const owner=kind==='task'&&selection?.kind==='employee'?state.assignments.find(a=>a.id===(selection.assignmentId||selection.id))?.employeeId:undefined;openCreate(kind,selCompany,['department','hire','task'].includes(kind)?did:undefined,owner); });
  $('btn-create').addEventListener('click', () => { const m = $('create-menu'); m.hidden = !m.hidden; $('btn-create').setAttribute('aria-expanded', m.hidden ? 'false' : 'true'); });
  $('btn-search').addEventListener('click', openSearch);
  $('btn-help').addEventListener('click', openHelp);
  $('btn-directory').addEventListener('click', openDirectory);
  $('btn-recent').addEventListener('click', openRecent);
  $('btn-minimap').addEventListener('click', () => { const m = $('minimap'); m.hidden = !m.hidden; $('btn-minimap').setAttribute('aria-pressed', m.hidden ? 'false' : 'true'); drawMinimap(); });
  $('cam-home').addEventListener('click', cam(() => world.home()));
  $('cam-top').addEventListener('click', cam(() => { world.top(); }));
  $('cam-tilt').addEventListener('change', cam(() => world.tilt(Number($('cam-tilt').value))));
  $('cam-rot').addEventListener('click', cam(() => { rotAcc = (rotAcc + 45) % 360; world.rotate(45); }));
  $('cam-zout').addEventListener('click', cam(() => world.zoom(1 / 1.2)));
  $('cam-zin').addEventListener('click', cam(() => world.zoom(1.2)));
  $('cam-fit').addEventListener('click', cam(() => world.fit()));
  $('cam-overview')?.addEventListener('click', cam(() => world.overview(selCompany)));
  $('cam-style')?.addEventListener('change', cam(() => world.setStyle($('cam-style').value)));
  for (const b of document.querySelectorAll('button[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));
  setMode('pan');

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); return; }
    if (e.key === 'Escape') {
      const m = $('create-menu'); if (!m.hidden) { m.hidden = true; $('btn-create').setAttribute('aria-expanded', 'false'); return; }
      const id = lastFocused[lastFocused.length - 1]; if (id) closePanel(id, true);
    }
  });
  window.addEventListener('resize', () => { positionAll(); });

  try {
    world = mountWorld({
      canvas, state,
      onSelect: (s) => { if (!s) return; try { world.select(s); } catch (e) { /* stale */ } openSelection(s); drawMinimap(); },
      onPlace: (aid, pos) => { try { placeAssignment(aid, pos); announce('Position updated by the current local Studio actor.'); } catch (e) { announce('Move failed: ' + errMsg(e)); try { world.setState(state); } catch (x) { /* ignore */ } } },
      onCameraChange: pose => { const view=$('cam-tilt');if(document.activeElement!==view){let value=[0,25,45,55].find(n=>Math.abs(n-pose.tilt)<.25);let custom=$('cam-live-angle');if(value===undefined){if(!custom){custom=el('option',{id:'cam-live-angle',value:'current'});view.append(custom);}custom.textContent='Tilt '+Math.round(pose.tilt)+'°';value='current';}else custom?.remove();view.value=String(value);} },
      onReady: () => { worldOk = true; closePanel('recovery',false);for(const c of $('hud-cam').querySelectorAll('button,select'))c.disabled=false;if($('cam-overview'))$('cam-overview').disabled=typeof world?.overview!=='function';if($('cam-style'))$('cam-style').disabled=typeof world?.setStyle!=='function'; $('loading').style.display = 'none'; document.body.dataset.ready = 'true'; if (selection) { try { world.select(selection); } catch (e) { /* ignore */ } } setMode(mode); positionAll(); },
      onError: (err) => { worldOk = false;for(const c of $('hud-cam').querySelectorAll('button,select'))c.disabled=true;openRecovery(err); }
    });
    world.subscribeFrame(positionAll);
  } catch (e) { worldOk=false;for(const c of $('hud-cam').querySelectorAll('button,select'))c.disabled=true;openRecovery(e); }

  window.addEventListener('pagehide', () => { try { if (world) world.dispose(); } catch (e) { /* ignore */ } world = null; worldOk = false; });
}
bootstrap();
