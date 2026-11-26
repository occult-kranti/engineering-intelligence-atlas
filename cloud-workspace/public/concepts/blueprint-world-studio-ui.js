// Claude Sonnet initial source request f6190f8a-dbe8-422e-886c-61efdba26a8e stopped at max_tokens. Tail, UX and correctness repairs completed locally.
import * as core from './blueprint-world-core.js';
import * as edits from './blueprint-world-studio-edits.js';

const CAPS = ['department.rename', 'department.color', 'department.reorder', 'company.move', 'assignment.place'];
const SUB_CAPS = ['department.rename', 'department.color', 'department.reorder', 'assignment.place'];

export function createStudioUI(ctx) {
  const state = new Map(); // companyId -> {departmentId, assignmentId}
  const drafts = new Map(); // key -> {value, base}
  const status = new Map(); // key -> {kind,text}
  const open = new Set();
  let grantSeq = 0;

  const pid = (c) => 'studio-' + c;
  const dk = (c, d, a, op) => [c, d || '-', a, op].join('|');
  const msg = (e) => String((e && e.message) || e || 'Unknown error').slice(0, 300);
  const num = (v) => (v === '' || v == null ? NaN : Number(v));
  const arr = (x) => (Array.isArray(x) ? x : []);

  function st(c) {
    if (!state.has(c)) state.set(c, { departmentId: null, assignmentId: null });
    return state.get(c);
  }
  function setStatus(key, kind, text) { status.set(key, { kind, text }); }
  function statusNode(key) {
    const s = status.get(key);
    return s ? ctx.el('div', { class: s.kind === 'ok' ? 'ok' : 'err', role: 'status', text: s.text }) : null;
  }
  function rerender(c) { try { ctx.refreshPanel(pid(c)); } catch (e) { /* host may not have panel */ } }

  function draft(key, baseRevision, initial) {
    if (!drafts.has(key)) drafts.set(key, { value: initial, base: baseRevision, dirty:false });
    const d=drafts.get(key);if(!d.dirty&&!d.stale){d.base=baseRevision;d.value=initial;}return d;
  }

  function touch(dr){if(!dr.dirty){dr.base=ctx.getStudio().revision;dr.dirty=true;}}

  function deptsOf(model, companyId) {
    const offices = arr(model.offices).filter((o) => o.companyId === companyId).map((o) => o.id);
    return arr(model.departments).filter((d) => d.companyId === companyId && offices.includes(d.officeId));
  }
  function siblingsOf(model, dept) {
    return deptsOf(model, dept.companyId).filter((d) => d.officeId === dept.officeId && (d.parentId || null) === (dept.parentId || null))
      .sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  function deptPath(model, d) {
    const all = arr(model.departments);
    const parts = [d.name];
    let p = d.parentId ? all.find((x) => x.id === d.parentId) : null;
    let guard = 0;
    while (p && guard++ < 20) { parts.unshift(p.name); p = p.parentId ? all.find((x) => x.id === p.parentId) : null; }
    return parts.join(' / ');
  }

  function envelope(studio, actorId, command, base) {
    const cur = (studio.cursors && studio.cursors[actorId]) || 0;
    return { actorId, sequence: cur + 1, expectedRevision: base, command };
  }

  function describePreview(p) {
    const ch = p && p.changes;
    if (!ch) return 'No visible changes.';
    if (typeof ch === 'string') return ch.slice(0, 300);
    if(Array.isArray(ch))return ch.map(p=>typeof p==='string'?p:patchText(p)).join('; ').slice(0,300);
    return 'Layout updated.';
  }

  function run(c, key, command, onDone) {
    const model = ctx.getModel(); const studio = ctx.getStudio(); const actorId = ctx.getActorId();
    const d = drafts.get(key);
    const base = d ? d.base : studio.revision;
    const b = ctx.blocked();
    if (b) { setStatus(key, 'err', b); rerender(c); return; }
    const env = envelope(studio, actorId, command, base);
    let prev;
    try { prev = edits.previewEdit(model, studio, env); }
    catch (e) { setStatus(key, 'err', 'Preview failed: ' + msg(e)); rerender(c); return; }
    if (!prev.decision || !prev.decision.allowed) {
      const message=msg(prev.decision&&prev.decision.message);const stale=/stale|revision/i.test(message+' '+(prev.decision?.code||''));if(stale&&d)d.stale=true;setStatus(key,'err',(stale?'This draft uses an earlier revision. Refresh its base, review, and submit again. ':'')+message);rerender(c);return;
    }
    const summary = describePreview(prev);
    try {
      ctx.commit(env);
    } catch (e) {
      const m = msg(e);
      const stale = /stale|revision/i.test(m);
      setStatus(key, 'err', (stale ? 'Stale draft base. Use Refresh draft base, then review and submit again. ' : 'Rejected: ') + m);
      if (stale && d) d.stale = true;
      rerender(c); return;
    }
    drafts.delete(key);
    setStatus(key, 'ok', 'Applied. ' + summary);
    try { ctx.announce('Blueprint edit applied'); } catch (e) { /* ignore */ }
    if (onDone) onDone();
    rerender(c);
  }

  function previewLine(c, key, commandFn) {
    // returns node showing preflight
    const model = ctx.getModel(); const studio = ctx.getStudio(); const actorId = ctx.getActorId();
    const d = drafts.get(key);
    let command;
    try { command = commandFn(); } catch (e) { return ctx.el('div', { class: 'meta', text: msg(e) }); }
    if (!command) return null;
    try {
      const prev = edits.previewEdit(model, studio, envelope(studio, actorId, command, d ? d.base : studio.revision));
      if (!prev.decision.allowed) return ctx.el('div', { class: 'err', text: 'Preflight denied: ' + msg(prev.decision.message) });
      return ctx.el('div', { class: 'meta', text: 'Preflight: ' + describePreview(prev) });
    } catch (e) { return ctx.el('div', { class: 'meta', text: 'Preflight: ' + msg(e) }); }
  }

  function staleBox(c, key, studio) {
    const d = drafts.get(key);
    if (!d || !d.stale) return null;
    return ctx.btn('Refresh draft base', () => { d.base = ctx.getStudio().revision; d.stale = false; setStatus(key, 'ok', 'Draft base refreshed to revision ' + d.base + '. Review before submitting.'); rerender(c); }, '', { 'data-focus-key': 'refresh-' + key });
  }

  function rightsLine(model, studio, actorId, command) {
    try {
      const dec = edits.authorize(model, studio, actorId, command);
      return dec.allowed ? 'Allowed' : 'Read-only: ' + msg(dec.message);
    } catch (e) { return 'Read-only: ' + msg(e); }
  }

  function simpleForm(c, dept, op, label, inputFactory, btnLabel, commandFn, extraRights) {
    const model = ctx.getModel(); const studio = ctx.getStudio(); const actorId = ctx.getActorId();
    const key = dk(c, dept.id, actorId, op);
    const dr = draft(key, studio.revision, null);
    const input = inputFactory(dr);
    const blk = ctx.blocked();
    const rights = rightsLine(model, studio, actorId, commandFn(dr.value == null ? '' : dr.value, true));
    const allowed = rights === 'Allowed' && !blk;
    const button = ctx.btn(btnLabel, () => run(c, key, commandFn(dr.value), null), 'primary', { 'data-focus-key': 'btn-' + key });
    if (!allowed) button.disabled = true;
    return ctx.el('div', { class: 'studio-section' },
      ctx.field(label, input, 'f-' + key),
      ctx.el('div', { class: 'studio-permissions meta', text: rights }),
      ctx.el('div', { class: 'row' }, button, staleBox(c, key, studio)),
      null,
      statusNode(key));
  }

  function renderBody(body, c) {
    const model = ctx.getModel(); const studio = ctx.getStudio(); const actorId = ctx.getActorId();
    const company = arr(model.companies).find((x) => x.id === c);
    body.textContent = '';
    if (!company) { body.appendChild(ctx.el('div', { class: 'empty', text: 'Company not found.' })); return; }
    const s = st(c);
    const depts = deptsOf(model, c).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (!depts.some((d) => d.id === s.departmentId)) s.departmentId = depts[0] ? depts[0].id : null;
    const dept = depts.find((d) => d.id === s.departmentId) || null;
    const actors = arr(studio.policy && studio.policy.actors);
    const isOwner = studio.policy && studio.policy.ownerActorId === actorId;
    const ownerActor = actors.find((a) => a.id === (studio.policy && studio.policy.ownerActorId));
    const director = arr(model.employees).find((e) => e.id === company.directorId);
    const blk = ctx.blocked();

    body.appendChild(ctx.el('div', { class: 'studio-banner' },
      ctx.el('div', { class: 'meta', text: 'Director: ' + (director ? director.name : company.directorId || 'none') + ' · Local blueprint owner: ' + (ownerActor ? ownerActor.label : (studio.policy && studio.policy.ownerActorId) || 'unknown') }),
      ctx.el('div', { class: 'meta studio-metric', text: 'Revision ' + studio.revision }),
      ctx.el('div', { class: 'meta', text: 'Company, hiring and task tools remain with CEO.' })));
    if (blk) body.appendChild(ctx.el('div', { class: 'err', role: 'alert', text: 'Editing blocked: ' + blk }));

    // Actor
    const active = actors.filter((a) => a.active);
    const actorSel = ctx.select('actor-' + c, active.map((a) => ({ value: a.id, label: a.label + ' (' + a.role + ')' })), actorId);
    actorSel.addEventListener('change', () => {
      try { ctx.setActorId(actorSel.value); setStatus('actor|' + c, 'ok', 'Editing as ' + (active.find(a=>a.id===actorSel.value)?.label||'selected actor')); }
      catch (e) { setStatus('actor|' + c, 'err', msg(e)); }
      rerender(c);
    });
    body.appendChild(ctx.el('div', { class: 'studio-section' },
      ctx.field('Simulated actor', actorSel, 'actor-' + c), status.get('actor|' + c)?.kind === 'err' ? statusNode('actor|' + c) : null));

    // Department selector
    if (!dept) { body.appendChild(ctx.el('div', { class: 'empty', text: 'This company has no departments yet.' })); }
    else {
      const dsel = ctx.select('dept-' + c, depts.map((d) => ({ value: d.id, label: deptPath(model, d) })), dept.id);
      dsel.addEventListener('change', () => { s.departmentId = dsel.value; rerender(c); });
      body.appendChild(ctx.el('div', { class: 'studio-section' },
        ctx.field('Target department', dsel, 'dept-' + c),
        ctx.el('div', { class: 'meta', text: 'Selecting a department changes the target only, not authorization.' }),
        renderRights(model, studio, actorId, c, dept)));

      // Layout
      body.appendChild(ctx.el('div', { class: 'studio-section' }, ctx.el('div', { class: 'lbl', text: 'Layout' }),
        simpleForm(c, dept, 'rename', 'Name', (dr) => {
          if (dr.value == null) dr.value = dept.name;
          const i = ctx.el('input', { type: 'text', maxlength: '60', value: dr.value });
          i.value = dr.value; i.addEventListener('input', () => { touch(dr);dr.value = i.value; }); return i;
        }, 'Save name', (v) => ({ type: 'department.rename', departmentId: dept.id, name: String(v).trim() })),
        simpleForm(c, dept, 'color', 'Color', (dr) => {
          if (dr.value == null) dr.value = /^#[0-9a-fA-F]{6}$/.test(dept.color || '') ? dept.color : '#888888';
          const i = ctx.el('input', { type: 'color', value: dr.value });
          i.value = dr.value; i.addEventListener('input', () => { touch(dr);dr.value = i.value; }); return i;
        }, 'Apply color', (v) => ({ type: 'department.color', departmentId: dept.id, color: String(v) })),
        reorderForm(c, dept, model)));
    }

    // Position
    body.appendChild(fold(c,'position','Company position',positionForm(c, company)));
    body.appendChild(fold(c,'placement','Employee placement',placementForm(c, model, studio)));

    // Access
    body.appendChild(accessSection(c, company, dept, model, studio, actorId, isOwner, actors));
    // History
    body.appendChild(historySection(c, model, studio, actorId));
  }

  function renderRights(model, studio, actorId, c, dept) {
    const list = ctx.el('div', { class: 'studio-permissions meta' });
    const siblings = siblingsOf(model, dept), index = siblings.findIndex(d => d.id === dept.id);
    const reorderProbes = [-1, 1].flatMap(delta => {
      const next = index + delta;
      if (next < 0 || next >= siblings.length) return [];
      const orderedIds = siblings.map(d => d.id);
      [orderedIds[index], orderedIds[next]] = [orderedIds[next], orderedIds[index]];
      return [{ type: 'department.reorder', companyId: c, officeId: dept.officeId, parentId: dept.parentId || null, orderedIds }];
    });
    const probes = [
      ['Rename', [{ type: 'department.rename', departmentId: dept.id, name: dept.name }]],
      ['Color', [{ type: 'department.color', departmentId: dept.id, color: '#123456' }]],
      ['Reorder', reorderProbes]
    ];
    probes.forEach(([label, commands]) => {
      const ok = commands.some(cmd => { try { return edits.authorize(model, studio, actorId, cmd).allowed; } catch (e) { return false; } });
      list.appendChild(ctx.el('span', { class: 'tag', text: label + ': ' + (!commands.length ? 'no adjacent room' : ok ? 'allowed' : 'read-only') }));
      list.appendChild(document.createTextNode(' '));
    });
    return list;
  }

  function reorderForm(c, dept, model) {
    const studio = ctx.getStudio(); const actorId = ctx.getActorId();
    const sibs = siblingsOf(model, dept);
    const idx = sibs.findIndex((d) => d.id === dept.id);
    const key = dk(c, dept.id, actorId, 'reorder');
    const dr = draft(key, studio.revision, null);
    const mk = (delta, label) => {
      const j = idx + delta;
      const ids = sibs.map((d) => d.id);
      let cmd = null;
      if (j >= 0 && j < ids.length) { const t = ids[idx]; ids[idx] = ids[j]; ids[j] = t; cmd = { type: 'department.reorder', companyId: c, officeId: dept.officeId, parentId: dept.parentId || null, orderedIds: ids }; }
      const b = ctx.btn(label, () => run(c, key, cmd, null), '', { 'data-focus-key': 'btn-' + key + delta });
      let ok = false;
      if (cmd && !ctx.blocked()) { try { ok = edits.authorize(model, studio, actorId, cmd).allowed; } catch (e) { ok = false; } }
      if (!ok) b.disabled = true;
      return b;
    };
    return ctx.el('div', { class: 'studio-section' },
      ctx.el('div', { class: 'lbl', text: 'Order: position ' + (idx + 1) + ' of ' + sibs.length }),
      ctx.el('div', { class: 'row' }, mk(-1, 'Move earlier'), mk(1, 'Move later'), staleBox(c, key, studio)),
      statusNode(key));
  }

  function numField(c, key, label, dr, prop) {
    const i = ctx.el('input', { type: 'number', step: 'any', value: String(dr.value[prop]) });
    i.value = String(dr.value[prop]);
    i.addEventListener('input', () => { touch(dr);dr.value[prop] = i.value; });
    return ctx.field(label, i, 'f-' + key + prop);
  }

  function positionForm(c, company) {
    const studio = ctx.getStudio(); const actorId = ctx.getActorId(); const model = ctx.getModel();
    const key = dk(c, '-', actorId, 'company.move');
    const cx = company.x != null ? company.x : (company.position && company.position.x) || 0;
    const cz = company.z != null ? company.z : (company.position && company.position.z) || 0;
    const dr = draft(key, studio.revision, { x: String(cx), z: String(cz) });
    const cmd = () => {
      const x = num(dr.value.x), z = num(dr.value.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('X and Z must be finite numbers.');
      return { type: 'company.move', companyId: c, x, z };
    };
    let rights = 'Read-only';
    try { const dec = edits.authorize(model, studio, actorId, { type: 'company.move', companyId: c, x: cx, z: cz }); rights = dec.allowed ? 'Allowed' : 'Read-only: ' + msg(dec.message); } catch (e) { rights = 'Read-only: ' + msg(e); }
    const go = ctx.btn('Move company', () => {
      let command;
      try { command = cmd(); } catch (e) { setStatus(key, 'err', msg(e)); rerender(c); return; }
      run(c, key, command, null);
    }, 'primary', { 'data-focus-key': 'btn-' + key });
    if (rights !== 'Allowed' || ctx.blocked()) go.disabled = true;
    return ctx.el('div', { class: 'studio-section' },
      ctx.el('div', { class: 'lbl', text: 'Company position' }),
      ctx.el('div', { class: 'meta', text: 'Companies keep a 160-unit gutter from each other.' }),
      ctx.el('div', { class: 'row' }, numField(c, key, 'X', dr, 'x'), numField(c, key, 'Z', dr, 'z')),
      ctx.el('div', { class: 'studio-permissions meta', text: rights }),
      ctx.el('div', { class: 'row' }, go, staleBox(c, key, studio)),
      null,
      statusNode(key));
  }

  function placementForm(c, model, studio) {
    const actorId = ctx.getActorId();
    const s = st(c);
    const assigns = arr(model.assignments).filter((a) => a.companyId === c);
    const emps = arr(model.employees);
    const label = (a) => { const e = emps.find((x) => x.id === a.employeeId); return (e ? e.name : 'Employee') + ' · ' + (model.departments.find(d=>d.id===a.departmentId)?.name||'Department') + (a.kind==='resident'?'':' · '+a.kind); };
    if (!assigns.length) return ctx.el('div', { class: 'studio-section' }, ctx.el('div', { class: 'lbl', text: 'Person placement' }), ctx.el('div', { class: 'empty', text: 'No assignments in this company yet.' }));
    if (!assigns.some((a) => a.id === s.assignmentId)) s.assignmentId = assigns[0].id;
    const asg = assigns.find((a) => a.id === s.assignmentId);
    const sel = ctx.select('asg-' + c, assigns.map((a) => ({ value: a.id, label: label(a) })), asg.id);
    sel.addEventListener('change', () => { s.assignmentId = sel.value; rerender(c); });
    let pos = { x: 0, y: 0 };
    try {
      const lay = core.companyLayout(model, c);
      const seats = (lay && (lay.seats || lay.assignments)) || [];
      const f = Array.isArray(seats) ? seats.find((p) => p.assignmentId === asg.id || p.id === asg.id) : (seats[asg.id] || null);
      if (f) pos = { x: f.x, y: f.y != null ? f.y : f.z };
    } catch (e) { /* fall back to 0,0 */ }
    const key = dk(c, asg.departmentId || '-', actorId, 'place:' + asg.id);
    const dr = draft(key, studio.revision, { x: String(Math.round(pos.x * 100) / 100), y: String(Math.round(pos.y * 100) / 100) });
    const cmd = () => {
      const x = num(dr.value.x), y = num(dr.value.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('X and Y must be finite numbers.');
      return { type: 'assignment.place', assignmentId: asg.id, x, y };
    };
    let rights;
    try { const dec = edits.authorize(model, studio, actorId, { type: 'assignment.place', assignmentId: asg.id, x: pos.x, y: pos.y }); rights = dec.allowed ? 'Allowed' : 'Read-only: ' + msg(dec.message); } catch (e) { rights = 'Read-only: ' + msg(e); }
    const go = ctx.btn('Move circle', () => {
      let command;
      try { command = cmd(); } catch (e) { setStatus(key, 'err', msg(e)); rerender(c); return; }
      run(c, key, command, null);
    }, 'primary', { 'data-focus-key': 'btn-' + key });
    if (rights !== 'Allowed' || ctx.blocked()) go.disabled = true;
    return ctx.el('div', { class: 'studio-section' },
      ctx.el('div', { class: 'lbl', text: 'Person placement' }),
      ctx.field('Assignment', sel, 'asg-' + c),
      ctx.el('div', { class: 'meta', text: 'Derived position: ' + pos.x + ', ' + pos.y + ' (company-local). Identity and department are unchanged.' }),
      ctx.el('div', { class: 'row' }, numField(c, key, 'X', dr, 'x'), numField(c, key, 'Y', dr, 'y')),
      ctx.el('div', { class: 'studio-permissions meta', text: rights }),
      ctx.el('div', { class: 'row' }, go, ctx.btn('Open profile', () => ctx.openProfile(asg.id), '', { 'data-focus-key': 'profile-' + asg.id }), staleBox(c, key, studio)),
      null,
      statusNode(key));
  }

  function genGrantId(studio) {
    const taken = new Set(arr(studio.policy.grants).map((g) => g.id));
    let id;
    for (let tries = 0; tries < 50; tries++) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID && tries > 0) id = 'gr_' + crypto.randomUUID().replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 24);
      else {
        let max = 0;
        taken.forEach((t) => { const m = /^gr_(\d+)$/.exec(t); if (m) max = Math.max(max, Number(m[1])); });
        grantSeq = Math.max(grantSeq, max);
        grantSeq = grantSeq < Number.MAX_SAFE_INTEGER - 1 ? grantSeq + 1 : 1;
        id = 'gr_' + grantSeq;
      }
      if (!taken.has(id)) return id;
    }
    throw new Error('Could not generate a unique grant id.');
  }

  function capLabel(c){return {'department.rename':'Rename rooms','department.color':'Change colors','department.reorder':'Reorder rooms','company.move':'Move company','assignment.place':'Place circles','policy.manage':'Manage local grants','history.undoAny':'Undo others’ edits'}[c]||c;}

  function scopeText(sc) {
    if (!sc) return 'unknown';
    if (sc.kind === 'workspace') return 'workspace';
    const m=ctx.getModel();if(sc.kind==='company')return m.companies.find(c=>c.id===sc.companyId)?.name||'company';
    return (m.departments.find(d=>d.id===sc.departmentId)?.name||'department')+(sc.includeDescendants?' + children':'');
  }

  function accessSection(c, company, dept, model, studio, actorId, isOwner, actors) {
    const det = ctx.el('details', { class: 'studio-section', 'data-focus-key': 'access-' + c });
    det.appendChild(ctx.el('summary', { text: 'Access' }));
    det.open=open.has(c+':access');det.addEventListener('toggle',()=>{if(det.open)open.add(c+':access');else open.delete(c+':access');});
    const grants = arr(studio.policy.grants).filter((g) => (isOwner || g.actorId === actorId) && g.revokedAtRevision == null &&
      (g.scope.kind === 'workspace' || g.scope.companyId === c));
    const lst = ctx.el('div', { class: 'list' });
    if (!grants.length) lst.appendChild(ctx.el('div', { class: 'empty', text: 'No explicit grants for this actor here. Roles alone grant nothing.' }));
    grants.forEach((g) => {
      const item = ctx.el('div', { class: 'item' },
        ctx.el('div', { class:'main',text: (actors.find(a=>a.id===g.actorId)?.label||'Actor')+' · '+scopeText(g.scope) }),
        ctx.el('div', { class: 'meta', text: arr(g.capabilities).map(capLabel).join(', ') }),
        ctx.el('span', {class:'tag',text:'Explicit grant'}));
      if (isOwner) {
        const rk = dk(c, '-', actorId, 'revoke:' + g.id);
        const b = ctx.btn('Revoke', () => run(c, rk, { type: 'policy.revoke', grantId: g.id }, null), '', { 'data-focus-key': 'btn-' + rk });
        if (ctx.blocked()) b.disabled = true;
        item.appendChild(b); const message=statusNode(rk);if(message)item.appendChild(message);
      }
      lst.appendChild(item);
    });
    det.appendChild(lst);
    const revoked = arr(studio.policy.grants).filter((g) => g.revokedAtRevision != null && (g.scope.kind === 'workspace' || g.scope.companyId === c));
    if (revoked.length) det.appendChild(ctx.el('div', { class: 'meta', text: 'Revoked grants retained in history: ' + revoked.length }));
    if (!isOwner) { det.appendChild(ctx.el('div', { class: 'meta', text: 'Only the policy owner can issue or revoke grants.' })); return det; }

    // Grant form
    const gk = dk(c, dept ? dept.id : '-', actorId, 'grant');
    const dr = draft(gk, studio.revision, { target: actors.find(a=>a.employeeId===company.assistantId)?.id || actors[0]?.id || '', scope: 'company', desc: false, caps: {} });
    const tsel = ctx.select('gtarget-' + c, actors.map((a) => ({ value: a.id, label: a.label + ' (' + a.role + ')' })), dr.value.target);
    tsel.addEventListener('change', () => { touch(dr);dr.value.target = tsel.value; });
    const ssel = ctx.select('gscope-' + c, [{ value: 'company', label: 'Entire company' }, { value: 'department', label: 'Selected department' }], dr.value.scope);
    ssel.addEventListener('change', () => { touch(dr);dr.value.scope = ssel.value; rerender(c); });
    const desc = ctx.el('input', { type: 'checkbox' }); desc.checked = !!dr.value.desc;
    desc.addEventListener('change', () => { touch(dr);dr.value.desc = desc.checked; });
    const capBoxes = ctx.el('div', {});
    CAPS.filter((cap) => !(dr.value.scope === 'department' && cap === 'company.move')).forEach((cap) => {
      const cb = ctx.el('input', { type: 'checkbox' }); cb.checked = !!dr.value.caps[cap];
      cb.addEventListener('change', () => { touch(dr);dr.value.caps[cap] = cb.checked; });
      capBoxes.appendChild(ctx.field(capLabel(cap), cb, 'cap-' + c + cap));
    });
    const addBtn = ctx.btn('Add grant', () => {
      try {
        const scope = dr.value.scope === 'department' && dept
          ? { kind: 'department', companyId: c, departmentId: dept.id, includeDescendants: !!dr.value.desc }
          : { kind: 'company', companyId: c, departmentId: null, includeDescendants: false };
        const capabilities = CAPS.filter((cap) => dr.value.caps[cap] && !(scope.kind === 'department' && cap === 'company.move'));
        if (!capabilities.length) throw new Error('Select at least one capability.');
        if (!dr.value.target) throw new Error('Select a target actor.');
        run(c, gk, { type: 'policy.grant', grantId: genGrantId(studio), actorId: dr.value.target, capabilities, scope }, null);
      } catch (e) { setStatus(gk, 'err', msg(e)); rerender(c); }
    }, 'primary', { 'data-focus-key': 'btn-' + gk });
    if (ctx.blocked()) addBtn.disabled = true;
    det.appendChild(ctx.el('div', { class: 'studio-section' },
      ctx.el('div', { class: 'lbl', text: 'Add grant' }),
      ctx.field('Target actor', tsel, 'gtarget-' + c),
      ctx.field('Scope', ssel, 'gscope-' + c),
      ctx.field('Include child departments', desc, 'gdesc-' + c),
      capBoxes, addBtn, staleBox(c,gk,studio), statusNode(gk)));

    // Existing employees can receive a local Studio identity; registration grants no rights.
    const ak=dk(c,'-',actorId,'register-actor');
    const candidates=model.employees.filter(e=>e.homeCompanyId===c);
    const ad=draft(ak,studio.revision,{employeeId:company.assistantId,role:'donna'});
    const employeeSelect=ctx.select('actor-employee-'+c,candidates.map(e=>({value:e.id,label:e.name+' · '+e.role})),ad.value.employeeId);
    employeeSelect.addEventListener('change',()=>{touch(ad);ad.value.employeeId=employeeSelect.value;});
    const roleSelect=ctx.select('actor-role-'+c,[{value:'donna',label:'Donna'},{value:'sub_donna',label:'Sub-Donna'},{value:'director',label:'Director'},{value:'visitor',label:'Visiting collaborator'}],ad.value.role);
    roleSelect.addEventListener('change',()=>{touch(ad);ad.value.role=roleSelect.value;});
    const register=ctx.btn('Register local actor',()=>{
      const employee=ctx.getModel().employees.find(e=>e.id===ad.value.employeeId&&e.homeCompanyId===c);
      if(!employee){setStatus(ak,'err','Choose an employee from this company.');rerender(c);return;}
      const current=ctx.getStudio();const existing=current.policy.actors.find(a=>a.employeeId===employee.id);
      if(existing){setStatus(ak,'ok',employee.name+' already has a local actor. Select them in Target actor to manage access.');rerender(c);return;}
      const base=('act_employee_'+employee.id.replace(/[^a-z0-9_-]/gi,'_').toLowerCase()).slice(0,74);let id=base,n=1;
      while(current.policy.actors.some(a=>a.id===id))id=base+'_'+(++n);
      run(c,ak,{type:'policy.actor.put',actor:{id,label:employee.name,role:ad.value.role,employeeId:employee.id,active:true}},()=>{
        const g=drafts.get(gk);if(g){g.value.target=id;g.base=ctx.getStudio().revision;g.dirty=true;}
      });
    },'',{'data-focus-key':'register-'+c});register.disabled=!!ctx.blocked();
    det.append(ctx.el('div',{class:'studio-section'},ctx.el('div',{class:'lbl',text:'Register an existing employee'}),
      ctx.field('Employee for local actor',employeeSelect,'actor-employee-'+c),ctx.field('Local actor role',roleSelect,'actor-role-'+c),
      ctx.el('div',{class:'meta',text:'Registration creates a local editing identity. Add an explicit grant to enable edits.'}),register,staleBox(c,ak,studio),statusNode(ak)));

    // Sub-Donna
    const sk = dk(c, dept ? dept.id : '-', actorId, 'subdonna');
    const sd = draft(sk, studio.revision, '');
    const ni = ctx.el('input', { type: 'text', maxlength: '60', value: sd.value });
    ni.value = sd.value; ni.addEventListener('input', () => { touch(sd);sd.value = ni.value; });
    const mkBtn = ctx.btn('Create local sub-Donna', () => {
      const name = String(sd.value).trim();
      if(ctx.blocked()){setStatus(sk,'err',ctx.blocked());rerender(c);return;}
      if(sd.dirty&&sd.base!==ctx.getStudio().revision){sd.stale=true;setStatus(sk,'err','This draft uses an earlier revision. Refresh its base before creating.');rerender(c);return;}
      if (!name || !dept) { setStatus(sk, 'err', 'Name and a target department are required.'); rerender(c); return; }
      try {
        const r = ctx.createSubDonna({ companyId: c, departmentId: dept.id, name });
        drafts.delete(sk);
        setStatus(sk, 'ok', 'Created '+name+' with editing access to this department and its children.');
        if (r && r.actorId) { try { ctx.setActorId(r.actorId); } catch (e) { setStatus(sk, 'err', 'Created, but could not select actor: ' + msg(e)); } }
      } catch (e) { setStatus(sk, 'err', 'Create failed: ' + msg(e)); }
      rerender(c);
    }, '', { 'data-focus-key': 'btn-' + sk });
    if (ctx.blocked() || !dept) mkBtn.disabled = true;
    det.appendChild(ctx.el('div', { class: 'studio-section' },
      ctx.el('div', { class: 'lbl', text: 'Local sub-Donna' }),
      ctx.el('div', { class: 'meta', text: 'Scope: ' + (dept ? deptPath(model, dept) : 'select a department') + ' and descendants; rename, color, reorder, place (' + SUB_CAPS.length + ' capabilities). Local definition only.' }),
      ctx.field('Sub-Donna name', ni, 'subname-' + c), mkBtn, staleBox(c,sk,studio), statusNode(sk)));
    return det;
  }

  function historySection(c, model, studio, actorId) {
    const det = ctx.el('details', {class:'studio-section'});
    det.append(ctx.el('summary',{text:'Change history'}));
    det.open = open.has(c + ':history');
    det.addEventListener('toggle',()=>{if(det.open)open.add(c+':history');else open.delete(c+':history');});
    let entries=[];
    try { entries=edits.readHistory(model,studio,{actorId,companyId:c,limit:12}); }
    catch(e) {det.append(ctx.el('div',{class:'err',text:msg(e)}));return det;}
    const latest=studio.journal.filter(e=>e.modelRevisionAfter>e.modelRevisionBefore).at(-1);
    const list=ctx.el('ol',{class:'list studio-history'});
    for(const e of entries.slice().sort((a,b)=>b.revisionAfter-a.revisionAfter)) {
      const author=studio.policy.actors.find(a=>a.id===e.actorId);
      const item=ctx.el('li',{class:'item'},ctx.el('div',{class:'main'},
        ctx.el('div',{text:'Revision '+e.revisionAfter+' · '+(author?.label||'Owner')}),
        ctx.el('div',{class:'meta',text:kindLabel(e.kind)}),
        ctx.el('div',{class:'meta',text:e.patches.map(p=>patchText(p)).join('; ').slice(0,240)})));
      if(e.undoable&&latest?.id===e.id) {
        const key=dk(c,'-',actorId,'undo:'+e.id), cmd={type:'history.undo',eventId:e.id};
        let allowed=false; try {allowed=edits.authorize(model,studio,actorId,cmd).allowed;}catch{}
        const undo=ctx.btn('Undo',()=>run(c,key,cmd),'',{'data-focus-key':'undo-'+e.id});
        undo.disabled=!allowed||!!ctx.blocked();item.append(undo,statusNode(key)||ctx.el('span'));
      }
      list.append(item);
    }
    det.append(list.children.length?list:ctx.el('div',{class:'empty',text:'Changes to this blueprint will appear here.'}),
      ctx.el('div',{class:'meta',text:'Undo is available for the latest eligible layout edit. Later owner changes create a new revision. History stays in this browser.'}));
    return det;
  }
  function kindLabel(kind){return {'department.rename':'Renamed a department','department.color':'Changed a department color','department.reorder':'Reordered departments','company.move':'Moved a company blueprint','assignment.place':'Moved an employee circle','policy.actor.put':'Registered or updated an editing actor','policy.grant':'Added an editing grant','policy.revoke':'Revoked an editing grant','history.undo':'Undid a layout change','owner.change':'Updated owner records'}[kind]||kind;}
  function patchText(p){const names={name:'Name',color:'Color',order:'Order',x:'X',y:'Y',z:'Z'};return (names[p.field]||p.field)+': '+String(p.before??'automatic').slice(0,70)+' → '+String(p.after??'automatic').slice(0,70);}
  function fold(c,key,title,child){
    const det=ctx.el('details',{class:'studio-section'});det.append(ctx.el('summary',{text:title}),child);
    const first=child.firstElementChild;if(first?.classList.contains('lbl'))first.remove();
    det.open=open.has(c+':'+key);det.addEventListener('toggle',()=>{if(det.open)open.add(c+':'+key);else open.delete(c+':'+key);});return det;
  }
  function openStudio(companyId,departmentId){
    const model=ctx.getModel(),company=model.companies.find(c=>c.id===companyId);if(!company)return;
    if(departmentId&&model.departments.some(d=>d.id===departmentId&&d.companyId===companyId))st(companyId).departmentId=departmentId;
    ctx.openPanel(pid(companyId),'Blueprint Studio','Company: '+company.name,{kind:'company',id:companyId,companyId},body=>renderBody(body,companyId));
    rerender(companyId);
  }
  return {open:openStudio,refresh(){for(const c of state.keys())rerender(c);}};
}
