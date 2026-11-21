// Redaction-safe thread projection. Only identity-free typed edges survive.
const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;
export function safeId(v) {
    return typeof v === 'string' && SAFE_ID.test(v) ? v : null;
}
/** Project a thread keeping only validated ids, kind and a short plain label. */
export function projectThread(t) {
    const fromId = t.fromId ? String(t.fromId) : '';
    const toId = t.toId ? String(t.toId) : '';
    if (!fromId || !toId || fromId === toId)
        return null;
    return {
        id: String(t.id || `thread:${t.kind}:${fromId}>${toId}`),
        kind: t.kind,
        fromId,
        toId,
        contractId: safeId(t.contractId),
        homeCompanyId: safeId(t.homeCompanyId),
        label: String(t.label ?? t.kind).slice(0, 80),
    };
}
export function sortThreads(threads) {
    const seen = new Set();
    const out = [];
    for (const t of [...threads].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
        if (seen.has(t.id))
            continue;
        seen.add(t.id);
        out.push(t);
    }
    return out;
}
