export const STICKY_COLORS = { yellow: '#f6e5a9', blue: '#c9e0f1', green: '#cce6ce', pink: '#f1ccda', purple: '#dfd4ee', gray: '#dce1e4' };
/** Read-only normalized placement inside real company/department geometry.
 * No invented room, company, permission or world-space saved coordinates. */
export function projectStickyNotes(notes, nodes, member = false) {
    if (!Array.isArray(notes) || notes.length > 2000)
        return { nodes: [], omitted: Array.isArray(notes) ? notes.length : 0 };
    const plans = new Map(nodes.filter(n => member ? n.kind === 'office' : n.metadata.companyFootprint === true && n.metadata.blueprintDetail === 'full').map(n => [n.companyId, n]));
    const candidates = notes.filter(n => n && n.status !== 'archived' && plans.has(n.companyId)).sort((a, b) => a.id.localeCompare(b.id));
    const result = [], seen = new Set(), perCompany = new Map();
    let omitted = 0;
    for (const note of candidates) {
        if (!note.id || seen.has(note.id) || typeof note.text !== 'string' || !Object.hasOwn(STICKY_COLORS, note.color)
            || !['comment', 'todo'].includes(note.kind) || !['open', 'done'].includes(note.status)
            || ![note.x, note.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) {
            omitted++;
            continue;
        }
        seen.add(note.id);
        if (result.length >= 256 || (perCompany.get(note.companyId) ?? 0) >= (member ? 200 : 32)) {
            omitted++;
            continue;
        }
        const company = plans.get(note.companyId);
        const office = nodes.find(n => n.kind === 'office' && n.companyId === note.companyId && n.officeId === note.officeId);
        // A missing saved office/department cannot be repaired by drawing elsewhere.
        if (!office) {
            omitted++;
            continue;
        }
        const target = note.departmentId ? nodes.find(n => (n.kind === 'room' || n.kind === 'department') && n.companyId === note.companyId && n.officeId === note.officeId && n.departmentId === note.departmentId) : member ? office : company;
        if (!target) {
            omitted++;
            continue;
        }
        const r = target.rect, companyScope = !member && target === company;
        const padding = companyScope ? { left: 32, top: 92, right: 32, bottom: 76 } : { left: 8, top: 34, right: 8, bottom: 8 };
        const aw = Math.max(1, r.width - padding.left - padding.right), ah = Math.max(1, r.height - padding.top - padding.bottom);
        const w = Math.min(148, aw), h = Math.min(88, ah);
        const x = r.x + Math.min(r.width - w, padding.left) + Math.max(0, aw - w) * note.x;
        const y = r.y + Math.min(r.height - h, padding.top) + Math.max(0, ah - h) * note.y;
        if (![x, y, w, h].every(Number.isFinite) || x < r.x || y < r.y || x + w > r.x + r.width + 1e-6 || y + h > r.y + r.height + 1e-6) {
            omitted++;
            continue;
        }
        result.push({ id: `sticky:${note.id}`, kind: 'reference', entityId: note.id, companyId: note.companyId, officeId: note.officeId,
            ...(note.departmentId ? { departmentId: note.departmentId } : {}), parentId: target.id,
            label: note.text.slice(0, 160), subtitle: `${note.kind === 'todo' ? 'To-do' : 'Comment'} · ${note.status}`,
            status: note.status, rect: { x, y, width: w, height: h }, counts: {},
            metadata: { stickyNote: true, stickyNoteId: note.id, stickyKind: note.kind, stickyColor: note.color, stickyRevision: note.revision, stickyText: note.text.slice(0, 4000), annotationReadOnly: member,
                ownerEmployeeId: note.ownerEmployeeId, annotationOnly: true } });
        perCompany.set(note.companyId, (perCompany.get(note.companyId) ?? 0) + 1);
    }
    return { nodes: result, omitted };
}
