export const BRAIN_LIST_PAGE = 24;
export const BRAIN_GRAPH_LIMIT = 60;
export const BRAIN_KINDS = ['company', 'repository', 'office', 'department', 'employee', 'skill', 'knowledge', 'goal', 'job', 'roadmap'];
export function recordLifetime(node, asOf) {
    const at = Date.parse(asOf), from = node.valid_from ? Date.parse(node.valid_from) : -Infinity;
    const until = node.valid_until ? Date.parse(node.valid_until) : Infinity;
    if (['retracted', 'deleted', 'quarantined'].includes(node.status ?? ''))
        return 'excluded';
    if ((node.valid_until && !Number.isFinite(until)) || until <= at)
        return 'historical';
    if ((node.valid_from && !Number.isFinite(from)) || from > at)
        return 'future';
    return 'current';
}
/** Filter before bounding so a late record remains discoverable. The input is
 * already a company-scoped projection; this does not establish authorization. */
export function filterBrainRecords(nodes, query, kind, history, asOf) {
    const terms = query.toLocaleLowerCase().trim().slice(0, 200).split(/\s+/).filter(Boolean);
    return nodes.filter(n => (kind === 'all' || n.type === kind) && (history || recordLifetime(n, asOf) === 'current') &&
        terms.every(t => `${n.label} ${n.summary} ${n.type} ${n.noteType ?? ''} ${n.id}`.toLocaleLowerCase().includes(t)))
        .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}
export function layoutBrainRecords(nodes, edges, selected) {
    // Round-robin across record types keeps saved evidence visible among a large
    // roster. Layout is deterministic and conveys recorded links, not similarity.
    const bins = BRAIN_KINDS.map(kind => nodes.filter(n => n.type === kind));
    const chosen = [];
    const chosenIds = new Set();
    const selection = nodes.find(n => n.id === selected);
    if (selection) {
        chosen.push(selection);
        chosenIds.add(selection.id);
    }
    for (let row = 0; chosen.length < BRAIN_GRAPH_LIMIT && bins.some(bin => bin[row]); row++) {
        for (const bin of bins) {
            const node = bin[row];
            if (node && !chosenIds.has(node.id) && chosen.length < BRAIN_GRAPH_LIMIT) {
                chosen.push(node);
                chosenIds.add(node.id);
            }
        }
    }
    const columns = [0, 0, 0];
    const col = (kind) => ['company', 'repository', 'office', 'department'].includes(kind) ? 0 : ['employee', 'skill', 'knowledge'].includes(kind) ? 1 : 2;
    const points = chosen.map(node => { const c = col(node.type), r = columns[c]++; return { node, x: 38 + c * 280, y: 60 + r * 44 }; });
    return { points, edges: edges.filter(e => chosenIds.has(e.source) && chosenIds.has(e.target)).slice(0, 160),
        height: Math.max(260, 88 + Math.max(...columns) * 44), omitted: Math.max(0, nodes.length - chosen.length) };
}
export function safeBrainSourceUrl(value) {
    if (typeof value !== 'string' || value.length > 2000 || /[\u0000-\u0020\u007f]/.test(value))
        return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password && !/(?:token|key|secret|password|signature|authorization)=/i.test(url.search) ? url.href : null;
    }
    catch {
        return null;
    }
}
