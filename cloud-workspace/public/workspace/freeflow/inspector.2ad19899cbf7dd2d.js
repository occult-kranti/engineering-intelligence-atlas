// Freeflow ownership inspector. Presentation-only: builds a DOM panel from a scene node or thread
// plus host capability data. No bridge calls. All text via textContent.
function ctxOf(n) {
    const c = { companyId: n.companyId, nodeId: n.id };
    if (n.officeId)
        c.officeId = n.officeId;
    if (n.departmentId)
        c.departmentId = n.departmentId;
    if (n.employeeId)
        c.employeeId = n.employeeId;
    if (n.boardId)
        c.boardId = n.boardId;
    if (n.roomId)
        c.roomId = n.roomId;
    if (n.contractId)
        c.contractId = n.contractId;
    return c;
}
function str(v) {
    if (typeof v === 'string')
        return v;
    if (typeof v === 'number' || typeof v === 'boolean')
        return String(v);
    if (Array.isArray(v))
        return v.length ? v.join(', ') : null;
    return null;
}
function refSubtype(n) {
    const m = n.metadata;
    if (m['portal'] === true)
        return 'portal';
    if (m['globalAssistant'] === true)
        return 'global';
    if (m['serviceHost'] === true || m['serviceHostRetired'] === true || m['layoutOnly'] === true)
        return 'host';
    if (n.contractId)
        return 'contract';
    return 'other';
}
function isHistorical(n) {
    const m = n.metadata;
    return m['serviceHostRetired'] === true || m['unavailable'] === true || m['current'] === false
        || n.status === 'service-host-historical' || n.status === 'retired';
}
function nameOf(scene, id) {
    if (!id || !scene)
        return null;
    const hit = scene.nodes.find((x) => x.entityId === id || x.companyId === id && x.kind === 'folio' || x.employeeId === id
        || x.officeId === id && x.kind === 'office' || x.departmentId === id && x.kind === 'department');
    return hit ? hit.label : null;
}
function companyName(scene, id) {
    const f = scene?.nodes.find((x) => x.kind === 'folio' && x.companyId === id);
    if (f)
        return f.label;
    const p = scene?.nodes.find((x) => x.metadata['portal'] === true && x.entityId === id);
    return p ? p.label : id;
}
export function rowsForNode(n, scene = null) {
    const m = n.metadata;
    if (n.kind === 'restricted')
        return [['Access', 'Restricted'], ['Reason', String(m['reason'] ?? 'A separate company membership is required.')]];
    const sub = n.kind === 'reference' ? refSubtype(n) : 'other';
    const kindLabel = {
        portal: 'Company navigation reference',
        global: 'Shared global identity',
        host: 'Service-host layout reference',
        contract: 'Contracted staff reference',
        other: 'Reference',
    };
    const rows = [['Kind', n.kind === 'reference' ? kindLabel[sub] : n.kind], ['Status', n.status]];
    if (n.subtitle)
        rows.push(['Role / note', n.subtitle]);
    if (n.kind === 'employee' || n.kind === 'reference') {
        if (sub === 'portal') {
            rows.push(['Navigation', 'Points to another company; it is not staff and grants nothing.']);
            const r = str(m['role']);
            if (r === 'parent' || r === 'child') {
                rows[0] = ['Kind', 'Organizational company link'];
                rows.push(['Direction', r === 'parent' ? 'Parent company' : 'Direct subcompany']);
                rows.push(['Authority', 'Organizational relationship only; not legal ownership, staffing or a service contract.']);
            }
            else if (r)
                rows.push(['Direction', r === 'service' ? 'Service provider' : 'Employment home']);
        }
        else {
            const kind = str(m['employeeKind']);
            if (kind)
                rows.push(['Employee kind', kind]);
            const home = m['homeCompanyId'];
            rows.push(['Employment home', home === null ? 'Shared global identity (no company)' : home === undefined ? 'unknown' : companyName(scene, String(home))]);
            const svc = str(m['serviceCompanyId']);
            if (svc)
                rows.push(['Service provider company', companyName(scene, svc)]);
            if (sub === 'global')
                rows.push(['Ownership', 'Shared across companies; not employed by this one']);
            if (sub === 'host') {
                rows.push(['Layout membership', 'Seat shown from the service host layout; no execution grant']);
                rows.push(['Availability', isHistorical(n) ? 'Historical or unavailable' : 'Current host member']);
            }
            if (sub === 'contract') {
                const tools = str(m['allowedTools']);
                if (tools)
                    rows.push(['Contract capabilities', tools]);
                rows.push(['Contract', 'Contracted staff (exact id in action context)']);
            }
            if (n.kind === 'reference' && sub !== 'global')
                rows.push(['Ownership', 'Reference only; staff are not owned by this company']);
        }
    }
    if (n.kind === 'whiteboard' && n.employeeId)
        rows.push(['Board owner', nameOf(scene, n.employeeId) ?? 'Unresolved owner']);
    if (m['fallback'] === true)
        rows.push(['Placement', 'Not saved in a room; shown in the fallback area']);
    if (m['sharedServices'] === true)
        rows.push(['Portfolio role', 'Shared services company']);
    if (n.kind === 'folio') {
        const pn = str(m['parentCompanyName']);
        rows.push(['Organization', pn ? `Subcompany of ${pn} (organizational relationship; not legal ownership)` : 'Root company']);
        const kn = str(m['childCompanyNames']);
        if (kn)
            rows.push(['Direct subcompanies', kn]);
        rows.push(['Scope', 'Counts below are this company only; descendants are not included.']);
    }
    const c = n.counts;
    const parts = [];
    const add = (k, one, many) => { const v = c[k] ?? 0; if (v > 0)
        parts.push(`${v} ${v === 1 ? one : many}`); };
    add('employees', 'hired employee', 'hired employees');
    add('offices', 'office', 'offices');
    add('departments', 'department', 'departments');
    add('desks', 'desk', 'desks');
    add('whiteboards', 'whiteboard', 'whiteboards');
    add('goals', 'goal', 'goals');
    add('roadmapItems', 'roadmap item', 'roadmap items');
    add('jobs', 'stored job definition', 'stored job definitions');
    add('running', 'running job', 'running jobs');
    add('queued', 'queued job', 'queued jobs');
    add('globalAssistants', 'shared global assistant', 'shared global assistants');
    if (parts.length)
        rows.push(['Counts', parts.join(' · ')]);
    if ((n.kind === 'employee' || n.kind === 'reference') && sub !== 'portal') {
        rows.push(['Stored job definitions', String(c['jobs'] ?? 0)]);
        rows.push(['Running jobs', String(c['running'] ?? 0)]);
    }
    const heatLabel = str(m['heatLabel']);
    rows.push(['Heat', heatLabel ?? 'No metric supplied']);
    const heatMetric = str(m['heatMetric']);
    if (heatMetric)
        rows.push(['Heat metric', heatMetric]);
    return rows;
}
export function actionsForNode(n) {
    const c = ctxOf(n);
    const a = (action, label, context = c) => ({ action, label, context });
    switch (n.kind) {
        case 'restricted': return [];
        case 'folio': return [a('chat', 'Open company chat'), a('jobs', 'Jobs'), a('roadmap', 'Roadmap'), a('manage', 'Manage company'), a('new-office', 'Add office'), a('hire', 'Hire')];
        case 'office': return [a('chat', 'Chat in office'), a('jobs', 'Jobs'), a('new-department', 'Add department'), a('manage', 'Manage office'), a('hire', 'Hire')];
        case 'department': return [a('chat', 'Chat in department'), a('jobs', 'Jobs'), a('new-job', 'New job'), a('manage', 'Manage department'), a('hire', 'Hire')];
        case 'room': return [a('chat', 'Chat in room scope'), a('new-job', 'New job'), a('manage', 'Manage department'), a('hire', 'Hire')];
        case 'employee': return [a('chat', 'Ask this employee'), a('jobs', 'Linked jobs'), a('new-job', 'Assign job'), a('ownership', 'Ownership'), a('manage', 'Manage employee')];
        case 'reference': {
            const sub = refSubtype(n);
            if (sub === 'portal') {
                if (n.metadata['organizational'] === true)
                    return [a('manage', n.metadata['role'] === 'parent' ? 'Open parent company' : 'Open subcompany')];
                return [a('services', 'Service contracts'), a('manage', 'Open company')];
            }
            if (sub === 'global')
                return [a('chat', 'Ask this assistant'), a('manage', 'Manage identity')];
            if (sub === 'host') {
                if (isHistorical(n))
                    return [a('services', 'Service contracts')];
                return [a('services', 'Service contracts'), a('jobs', 'Linked jobs')];
            }
            if (sub === 'contract') {
                if (isHistorical(n))
                    return [a('services', 'Service contracts')];
                return [a('chat', 'Ask contracted staff'), a('new-job', 'Assign job'), a('jobs', 'Linked jobs'), a('services', 'Service contracts')];
            }
            return [a('services', 'Service contracts')];
        }
        case 'whiteboard': return [a('whiteboard', 'Open board'), a('ownership', 'Board ownership'), a('roadmap', 'Roadmap')];
        default: return [a('manage', 'Manage')];
    }
}
export function overviewActions(scene) {
    if (!scene)
        return [];
    const f = scene.focus;
    const a = (action, label, context = {}) => ({ action, label, context });
    switch (f.kind) {
        case 'portfolio': return [a('new-company', 'New company'), a('services', 'Services'), a('settings', 'Settings')];
        case 'company': {
            const c = { companyId: f.companyId };
            return [a('chat', 'Chat', c), a('new-office', 'New office', c), a('hire', 'Hire', c), a('manage', 'Manage', c), a('roadmap', 'Roadmap', c)];
        }
        case 'office': {
            const c = { companyId: f.companyId, officeId: f.officeId };
            return [a('chat', 'Chat', c), a('new-department', 'New department', c), a('hire', 'Hire', c), a('new-job', 'New job', c)];
        }
        case 'department': {
            const c = { companyId: f.companyId, officeId: f.officeId, departmentId: f.departmentId };
            return [a('chat', 'Chat', c), a('new-job', 'New job', c), a('hire', 'Hire', c), a('manage', 'Manage', c)];
        }
        default: return [];
    }
}
export function overviewRows(scene) {
    const c = scene.counts;
    const rows = [['Scope', scene.title]];
    const add = (label, key) => { if (typeof c[key] === 'number')
        rows.push([label, String(c[key])]); };
    add('Companies', 'companies');
    add('Offices', 'offices');
    add('Rooms', 'rooms');
    add('Whiteboards', 'whiteboards');
    add('Hired employees', 'hiredEmployees');
    add('Employees shown', 'employees');
    add('Contracted staff references', 'references');
    add('Service-host layout references', 'serviceHostReferences');
    add('Direct subcompanies', 'subcompanies');
    add('Running jobs', 'runningJobs');
    add('Relationship lines', 'threads');
    rows.push(['Hint', 'Select a card, room, employee, board or line to inspect it. Selecting alone changes nothing.']);
    if (scene.warnings.length)
        rows.push(['Notes', `${scene.warnings.length} scope note${scene.warnings.length === 1 ? '' : 's'}`]);
    return rows;
}
export function rowsForThread(t, scene) {
    const name = (id) => scene?.nodes.find((x) => x.id === id)?.label ?? 'Unresolved item';
    const kind = t.kind === 'service-contract' ? 'Service contract'
        : t.kind === 'shared-staff' ? 'Shared staff (home company)'
            : t.kind === 'ownership' ? 'Board ownership'
                : 'Relationship';
    const rows = [['Relationship', kind], ['From', name(t.fromId)], ['To', name(t.toId)], ['Label', t.label]];
    if (t.contractId)
        rows.push(['Contract', 'Recorded (exact id in action context)']);
    if (t.homeCompanyId)
        rows.push(['Home company', scene ? companyName(scene, t.homeCompanyId) : t.homeCompanyId]);
    rows.push(['Authority', 'This line describes a recorded relationship; it grants nothing by itself.']);
    return rows;
}
export function actionsForThread(t, scene) {
    const node = (id) => scene?.nodes.find((x) => x.id === id) ?? null;
    const base = (n) => {
        const c = n ? ctxOf(n) : {};
        c.threadId = t.id;
        if (t.contractId)
            c.contractId = t.contractId;
        return c;
    };
    if (t.kind === 'ownership') {
        const board = node(t.toId);
        const c = base(board);
        if (board?.boardId)
            c.boardId = board.boardId;
        const owner = node(t.fromId);
        if (owner?.employeeId)
            c.employeeId = owner.employeeId;
        return [
            { action: 'ownership', label: 'Board ownership', context: c },
            { action: 'whiteboard', label: 'Open board', context: c },
        ];
    }
    if (t.kind === 'service-contract' || t.kind === 'shared-staff') {
        const target = node(t.toId);
        return [{ action: 'services', label: t.kind === 'service-contract' ? 'Service contracts' : 'Shared staff & contracts', context: base(target) }];
    }
    // Other (e.g. later hierarchy) kinds: received, not assumed to be board ownership.
    const target = node(t.toId);
    return [{ action: 'manage', label: 'Manage', context: base(target) }];
}
export function mountInspector(host, cb) {
    const root = document.createElement('aside');
    root.className = 'ff-inspector';
    root.setAttribute('aria-label', 'Ownership inspector');
    const head = document.createElement('h2');
    head.className = 'ff-inspector-header';
    const rows = document.createElement('dl');
    rows.className = 'ff-inspector-rows';
    const actions = document.createElement('div');
    actions.className = 'ff-inspector-actions';
    const note = document.createElement('p');
    note.className = 'ff-notice';
    note.hidden = true;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close inspector';
    const onClose = () => cb.onClose?.();
    close.addEventListener('click', onClose);
    root.append(head, rows, note, actions, close);
    host.appendChild(root);
    let caps = null;
    let cur = { node: null, thread: null, scene: null };
    let destroyed = false;
    function render() {
        if (destroyed)
            return;
        rows.replaceChildren();
        actions.replaceChildren();
        note.hidden = true;
        let pairs = [];
        let specs = [];
        if (cur.thread) {
            head.textContent = 'Relationship';
            pairs = rowsForThread(cur.thread, cur.scene);
            specs = actionsForThread(cur.thread, cur.scene);
        }
        else if (cur.node) {
            head.textContent = cur.node.label;
            pairs = rowsForNode(cur.node, cur.scene);
            specs = actionsForNode(cur.node);
        }
        else if (cur.scene) {
            head.textContent = 'Scope overview';
            pairs = overviewRows(cur.scene);
            specs = overviewActions(cur.scene);
        }
        else {
            head.textContent = 'Nothing selected';
            pairs = [['Hint', 'Select a card, room, employee or board to inspect it. Selecting alone changes nothing.']];
        }
        for (const [k, v] of pairs) {
            const dt = document.createElement('dt');
            dt.textContent = k;
            const dd = document.createElement('dd');
            dd.textContent = v;
            rows.append(dt, dd);
        }
        const reasons = [];
        for (const spec of specs) {
            const st = caps ? caps(spec) : { enabled: true };
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = spec.label;
            if (!st.enabled) {
                b.disabled = true;
                b.setAttribute('aria-disabled', 'true');
                const why = st.reason ?? 'Unavailable right now.';
                b.title = why;
                reasons.push(`${spec.label}: ${why}`);
            }
            else {
                b.addEventListener('click', () => cb.onAction(spec));
            }
            actions.appendChild(b);
        }
        if (reasons.length) {
            note.hidden = false;
            note.textContent = reasons.join(' · ');
        }
    }
    render();
    return {
        elements: { root, actions },
        setSelection(node, thread, scene) { cur = { node, thread, scene }; render(); },
        setCapabilities(fn) { caps = fn; render(); },
        destroy() {
            if (destroyed)
                return;
            destroyed = true;
            close.removeEventListener('click', onClose);
            root.remove();
        },
    };
}
