const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const nodeId = (role, id) => `crew:${role}:${encodeURIComponent(id)}`;
/** Ambiguous IDs fail closed rather than silently choosing a different employee. */
function unique(items) {
    const result = new Map(), duplicates = new Set();
    for (const item of items ?? []) {
        if (!item.id || item.id.length > 512 || duplicates.has(item.id))
            continue;
        if (result.has(item.id)) {
            result.delete(item.id);
            duplicates.add(item.id);
        }
        else
            result.set(item.id, item);
    }
    return result;
}
function instant(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!m)
        return NaN;
    const y = +m[1], month = +m[2], day = +m[3];
    const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || +m[4] > 23 || +m[5] > 59 || +m[6] > 59)
        return NaN;
    return Date.parse(value);
}
function activeGrant(grant, now) {
    return Number.isFinite(now) && grant.revokedAt === null && instant(grant.grantedAt) <= now && instant(grant.expiresAt) > now;
}
function validGrant(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const g = value, scope = g.scope;
    return ['id', 'employeeId', 'issuer', 'grantedAt', 'expiresAt'].every(k => typeof g[k] === 'string')
        && !!scope && typeof scope === 'object' && typeof scope.kind === 'string' && typeof scope.id === 'string'
        && (g.revokedAt === null || typeof g.revokedAt === 'string')
        && Array.isArray(g.parentGrantIds) && g.parentGrantIds.every(id => typeof id === 'string')
        && Array.isArray(g.capabilities) && g.capabilities.every(capability => typeof capability === 'string');
}
function location(scope, context) {
    if (scope.kind === 'company')
        return context.companies.has(scope.id) ? { companyId: scope.id } : null;
    if (scope.kind === 'office') {
        const o = context.offices.get(scope.id);
        return o && context.companies.has(o.companyId) ? { companyId: o.companyId, officeId: o.id } : null;
    }
    const d = context.departments.get(scope.id), o = d && context.offices.get(d.officeId);
    return d && o && o.companyId === d.companyId && context.companies.has(d.companyId)
        ? { companyId: d.companyId, officeId: d.officeId, departmentId: d.id } : null;
}
function covers(grant, scope, context) {
    const at = location(scope, context);
    return !!at && (grant.scope.kind === 'company' && grant.scope.id === at.companyId
        || grant.scope.kind === 'office' && grant.scope.id === at.officeId
        || grant.scope.kind === 'department' && grant.scope.id === at.departmentId);
}
function authorityFor(employeeId, scope, c) {
    if (!c.hasAuthority || !scope || !employeeId)
        return { state: 'unknown', grantIds: [], capabilities: [] };
    const grants = (c.grantsByEmployee.get(employeeId) ?? []).filter(g => activeGrant(g, c.now) && covers(g, scope, c)
        && (g.issuer === 'owner' && g.parentGrantIds.length === 0 || g.issuer === 'donna' && g.parentGrantIds.length > 0
            && g.parentGrantIds.every(id => {
                const p = c.grants.get(id);
                return !!p && p.issuer === 'owner' && p.employeeId === 'donna' && p.parentGrantIds.length === 0 && activeGrant(p, c.now);
            })));
    return { state: grants.length ? 'recorded' : 'none', grantIds: grants.map(g => g.id).sort(cmp),
        capabilities: [...new Set(grants.flatMap(g => [...g.capabilities]))].sort(cmp) };
}
function projectSlot(slot, c) {
    const e = slot.employee, at = slot.scope && location(slot.scope, c);
    const paused = !!at && (c.companies.get(at.companyId)?.status !== 'active'
        || !!at.officeId && c.offices.get(at.officeId)?.status !== 'active'
        || !!at.departmentId && c.departments.get(at.departmentId)?.status !== 'active');
    const ownJobs = e ? (c.jobsByEmployee.get(e.id) ?? []).filter(j => !at || j.companyId === at.companyId
        && (!at.officeId || j.officeId === at.officeId) && (!at.departmentId || j.departmentId === at.departmentId)) : [];
    const status = slot.runtime ? 'runtime-service' : !e ? 'unconfigured' : e.status === 'fired' ? 'fired'
        : e.status !== 'active' || paused ? 'paused' : 'configured';
    const actions = [];
    if (e?.status === 'active' && slot.scope) {
        if (!paused)
            actions.push('plan-work');
        if (['company-assistant', 'office-assistant', 'department-coordinator', 'donna'].includes(slot.role)) {
            const entity = slot.scope.kind === 'company' ? c.companies.get(slot.scope.id)
                : slot.scope.kind === 'office' ? c.offices.get(slot.scope.id) : c.departments.get(slot.scope.id);
            if (!paused)
                actions.push('pause-scope');
            else if (entity?.status === 'paused')
                actions.push('resume-scope');
        }
    }
    return {
        id: slot.id, role: slot.role, label: slot.title, subtitle: slot.runtime ? 'Deterministic runtime service · no model calls'
            : e ? `${e.name} · ${e.role}` : 'No matching employee definition or active shared contract',
        parentId: slot.parentId, employeeId: e?.id ?? null, employeeStatus: e?.status ?? null,
        companyId: slot.companyId, scope: slot.scope ? { ...slot.scope } : null, scopeStatus: paused ? 'paused' : 'active',
        status, execution: slot.runtime ? 'deterministic-service' : e ? 'employee-definition' : 'unconfigured',
        serviceContractId: slot.contractId ?? null,
        reportedRunningJobs: ownJobs.filter(j => j.status === 'running').length,
        queuedJobs: ownJobs.filter(j => j.status === 'queued' || j.status === 'waiting-budget').length,
        authority: authorityFor(e?.id ?? null, slot.scope, c),
        inspectTarget: slot.runtime ? slot.role === 'source-reviewer' ? 'source-review' : 'ledger-observer' : e ? 'chat' : 'employee',
        actions,
    };
}
function specialistScore(e, role) {
    if (e.kind !== 'specialist' || e.status === 'fired')
        return Infinity;
    const key = e.assignmentKey?.toLowerCase() ?? '', text = `${e.role} ${(e.skillPaths ?? []).join(' ')}`.toLowerCase();
    if (key === role)
        return e.status === 'active' ? 0 : 10;
    const matches = role === 'repository-steward' ? /repository|github|api.integration/.test(text)
        : role === 'source-reviewer' ? /source.review|external.source|prompt.injection|defensive.security/.test(text)
            : /ledger|index.observer|ledger.observer/.test(text);
    return matches ? e.status === 'active' ? 1 : 11 : Infinity;
}
function validEmployeeLocation(e, c) {
    if (!e.companyId || !c.companies.has(e.companyId))
        return false;
    if (e.officeId !== null && c.offices.get(e.officeId)?.companyId !== e.companyId)
        return false;
    if (e.departmentId !== null) {
        const department = c.departments.get(e.departmentId);
        if (!department || department.companyId !== e.companyId || department.officeId !== e.officeId)
            return false;
    }
    return true;
}
/** Read-only projection. Definitions and reported job records never imply live agents. */
export function buildDonnaTeam(snapshot, focus, options) {
    const result = { focus: { ...focus }, nodes: [], edges: [], omittedCount: 0, warnings: [], restricted: false };
    if (snapshot.access?.mode === 'member') {
        result.restricted = true;
        result.warnings.push('Employee controls belong to the workspace owner.');
        return result;
    }
    const grants = Array.isArray(snapshot.authority?.grants) ? snapshot.authority.grants.filter(validGrant) : [];
    const c = { companies: unique(snapshot.companies), offices: unique(snapshot.offices), departments: unique(snapshot.departments),
        employees: unique(snapshot.employees), grants: unique(grants), grantsByEmployee: new Map(), jobsByEmployee: new Map(),
        now: options.now, hasAuthority: !!snapshot.authority };
    for (const g of c.grants.values()) {
        const a = c.grantsByEmployee.get(g.employeeId) ?? [];
        a.push(g);
        c.grantsByEmployee.set(g.employeeId, a);
    }
    for (const j of snapshot.jobs ?? []) {
        const a = c.jobsByEmployee.get(j.employeeId) ?? [];
        a.push(j);
        c.jobsByEmployee.set(j.employeeId, a);
    }
    const scope = focus.kind === 'portfolio' ? null : focus.kind === 'company' ? { kind: 'company', id: focus.companyId }
        : focus.kind === 'office' ? { kind: 'office', id: focus.officeId } : { kind: 'department', id: focus.departmentId };
    const at = scope && location(scope, c);
    if (scope && (!at || at.companyId !== focus.companyId
        || focus.kind === 'department' && at.officeId !== focus.officeId)) {
        result.warnings.push('The selected scope is missing or inconsistent.');
        return result;
    }
    const max = Number.isFinite(options.maxNodes) ? Math.max(4, Math.min(500, Math.floor(options.maxNodes))) : 100;
    const add = (slot) => {
        if (result.nodes.length >= max) {
            result.omittedCount++;
            return;
        }
        result.nodes.push(projectSlot(slot, c));
    };
    const donna = c.employees.get('donna');
    const donnaId = nodeId('donna', 'donna');
    add({ id: donnaId, role: 'donna', title: 'Donna', parentId: null, companyId: at?.companyId ?? null, scope,
        employee: donna?.kind === 'assistant' && donna.companyId === null && donna.officeId === null && donna.departmentId === null ? donna : undefined });
    const companies = [...c.companies.values()].filter(co => focus.kind === 'portfolio' || co.id === focus.companyId).sort((a, b) => cmp(a.id, b.id));
    for (const co of companies) {
        const companyNode = nodeId('company-assistant', co.id), e = co.assistantId && c.employees.get(co.assistantId);
        add({ id: companyNode, role: 'company-assistant', title: `${co.name} · Sub-Donna`, parentId: donnaId, companyId: co.id,
            scope: { kind: 'company', id: co.id }, employee: e && e.kind === 'assistant' && e.companyId === co.id && e.officeId === null && e.departmentId === null ? e : undefined });
        if (focus.kind === 'portfolio')
            continue;
        const services = unique(snapshot.portfolio?.services), contracts = unique(snapshot.portfolio?.contracts);
        const candidates = [];
        for (const employee of c.employees.values()) {
            if (employee.companyId === co.id && validEmployeeLocation(employee, c) && (!at?.officeId || employee.officeId === at.officeId || employee.officeId === null)
                && (!at?.departmentId || employee.departmentId === at.departmentId || employee.departmentId === null))
                candidates.push({ employee });
        }
        for (const contract of contracts.values()) {
            const service = services.get(contract.serviceId);
            if (contract.status !== 'active' || contract.recipientCompanyId !== co.id || !service || service.status !== 'active'
                || contract.recipientOfficeId !== null && contract.recipientOfficeId !== at?.officeId
                || contract.recipientDepartmentId !== null && contract.recipientDepartmentId !== at?.departmentId)
                continue;
            const so = c.offices.get(service.officeId), sd = c.departments.get(service.departmentId);
            if (c.companies.get(service.companyId)?.status !== 'active' || so?.status !== 'active' || sd?.status !== 'active'
                || so.companyId !== service.companyId || sd.companyId !== service.companyId || sd.officeId !== service.officeId)
                continue;
            for (const id of new Set(contract.employeeIds)) {
                const employee = c.employees.get(id);
                if (employee && service.employeeIds.includes(id) && employee.companyId === service.companyId && employee.officeId === service.officeId
                    && employee.departmentId === service.departmentId)
                    candidates.push({ employee, contractId: contract.id });
            }
        }
        for (const [role, title] of [['repository-steward', 'Repository steward'], ['source-reviewer', 'Source review'], ['ledger-observer', 'Ledger observer']]) {
            const runtime = role === 'source-reviewer' ? options.runtimeServices?.sourceReviewer : role === 'ledger-observer' ? options.runtimeServices?.ledgerObserver : false;
            const choice = runtime ? undefined : candidates.filter(x => Number.isFinite(specialistScore(x.employee, role)))
                .sort((a, b) => specialistScore(a.employee, role) - specialistScore(b.employee, role) || cmp(a.employee.id, b.employee.id)
                || cmp(a.contractId ?? '', b.contractId ?? ''))[0];
            add({ id: nodeId(role, co.id), role, title, parentId: companyNode, companyId: co.id, scope,
                employee: choice?.employee, contractId: choice?.contractId, runtime: !!runtime });
        }
        const offices = [...c.offices.values()].filter(o => o.companyId === co.id && (!at?.officeId || o.id === at.officeId)).sort((a, b) => cmp(a.id, b.id));
        const includedOffices = new Set(offices.map(o => o.id));
        for (const o of offices) {
            const e = o.assistantId && c.employees.get(o.assistantId);
            add({ id: nodeId('office-assistant', o.id), role: 'office-assistant', title: `${o.name} · Office assistant`, parentId: companyNode, companyId: co.id,
                scope: { kind: 'office', id: o.id }, employee: e && e.kind === 'assistant' && e.companyId === co.id && e.officeId === o.id && e.departmentId === null ? e : undefined });
        }
        for (const d of [...c.departments.values()].filter(d => d.companyId === co.id && includedOffices.has(d.officeId)
            && (!at?.departmentId || d.id === at.departmentId)).sort((a, b) => cmp(a.id, b.id))) {
            const e = d.assistantId && c.employees.get(d.assistantId);
            add({ id: nodeId('department-coordinator', d.id), role: 'department-coordinator', title: `${d.name} · Coordinator`,
                parentId: nodeId('office-assistant', d.officeId), companyId: co.id, scope: { kind: 'department', id: d.id },
                employee: e && e.kind === 'assistant' && e.companyId === co.id && e.officeId === d.officeId && e.departmentId === d.id ? e : undefined });
        }
    }
    const ids = new Set(result.nodes.map(n => n.id));
    result.edges = result.nodes.filter(n => n.parentId && ids.has(n.parentId)).map(n => ({ from: n.parentId, to: n.id }));
    if (result.omittedCount)
        result.warnings.push(`${result.omittedCount} crew entries are outside this bounded view. Focus a company or department to inspect them.`);
    return result;
}
/** Produces a proposal only. The current native bridge rechecks identity, scope and expiry at commit. */
export function proposeDonnaAction(snapshot, focus, request, options) {
    const team = buildDonnaTeam(snapshot, focus, options), node = team.nodes.find(n => n.id === request.nodeId);
    if (team.restricted || !node || !node.employeeId || !node.scope || !node.actions.includes(request.intent)) {
        return { ok: false, reason: 'This employee has no supported action in the selected scope.' };
    }
    let command;
    const planning = request.intent === 'plan-work';
    if (planning) {
        const title = request.title?.trim() ?? '', description = request.description?.trim() ?? '';
        if (!title || new TextEncoder().encode(title).length > 200 || new TextEncoder().encode(description).length > 16000) {
            return { ok: false, reason: 'A plan needs a title of at most 200 UTF-8 bytes and a description of at most 16,000 bytes.' };
        }
        command = { action: 'create_goal', scope: { ...node.scope }, title, description, mode: 'plan', maxIterations: 1 };
    }
    else {
        const resume = request.intent === 'resume-scope';
        command = node.scope.kind === 'company' ? { action: resume ? 'resume_company' : 'pause_company', companyId: node.scope.id }
            : node.scope.kind === 'office' ? { action: resume ? 'resume_office' : 'pause_office', officeId: node.scope.id }
                : { action: resume ? 'resume_department' : 'pause_department', departmentId: node.scope.id };
    }
    const capability = planning ? 'work.manage' : 'team.manage';
    return { ok: true, proposal: { actorEmployeeId: node.employeeId, label: planning ? 'Draft a scoped goal' : request.intent === 'pause-scope' ? 'Pause this scope' : 'Resume this scope',
            requiredCapability: capability, readiness: node.authority.capabilities.includes(capability) ? 'recorded-grant' : 'needs-authority',
            requiresNativeCheck: true, createsProviderJob: false, mayAdmitQueuedWork: request.intent === 'resume-scope',
            command: { action: 'apply_employee_command', employeeId: node.employeeId, command } } };
}
