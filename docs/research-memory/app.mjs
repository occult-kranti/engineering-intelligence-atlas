import { validateGraph, queryGraph, exploreGraph, tokenize } from './graph-core.mjs';

const $ = id => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg', MATH = 'http://www.w3.org/1998/Math/MathML';
const grant = { allowedScopes: ['public'], policyVersion: 'public-atlas-view-v1' };
const domains = { memory: 'Memory & graphs', electrostatics: 'Electrostatics', magnetism: 'Magnetism', gravity: 'Gravity', frequency: 'Frequency & waves', mathematics: 'Mathematics', 'ai-mathematics': 'AI mathematics' };
const state = { graph: null, nodeMap: new Map(), sourceMap: new Map(), view: 'graph', domain: 'memory', type: 'all', query: '', catalogue: false, cap: 80, page: 0, selected: null, focus: null, retrieval: null, zoom: 1, x: 0, y: 0, visible: [], filtered: [], layoutKey: '', positions: new Map() };
let loadingController, searchTimer;
const text = value => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
const human = value => text(value).replaceAll('_', ' ').replaceAll('-', ' ');
const strings = value => Array.isArray(value) ? value.map(text).filter(Boolean) : text(value) ? [text(value)] : [];
const key = node => (node.scope ?? 'public') + '/' + node.id;
const isCatalogue = node => node.type?.startsWith('catalogue-') || node.type !== 'concept' && /catalogu|metadata|unreviewed|not[ _-]individually[ _-]reviewed/.test([node.status, node.audit_status, node.review_status].map(text).join(' ').toLowerCase());
function catalogueDescription() {
  const papers = state.graph.nodes.filter(node => node.type === 'catalogue-paper').length;
  const families = state.graph.nodes.filter(node => node.type === 'catalogue-family').length;
  return papers ? `${papers} catalogue-only manuscripts${families ? ' + ' + families + ' families' : ''}` : `${state.graph.nodes.filter(isCatalogue).length} catalogue-only records`;
}
const compare = (a, b) => a.label.localeCompare(b.label, 'en') || a.id.localeCompare(b.id, 'en');
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) if (value !== null && value !== undefined) node.setAttribute(name, String(value));
  for (const child of children.flat(4)) if (child !== null && child !== undefined) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
function svg(tag, attrs = {}, content) {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (content !== undefined) node.textContent = String(content);
  return node;
}
function safeLink(url, label, className = 'source-link') {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Unsupported source URL');
    return el('a', { href: parsed.href, target: '_blank', rel: 'noopener noreferrer', class: className }, label);
  } catch { return el('span', { class: 'muted' }, label + ' · source link unavailable'); }
}
function badge(node) {
  const catalogue = isCatalogue(node), status = catalogue ? 'Catalogue only · proof not reviewed' : human(node.status || node.audit_status || 'status not specified');
  const open = /open|unresolved|conjecture/.test(status);
  return el('span', { class: 'status-badge' + (catalogue ? ' catalogue' : open ? ' open' : '') }, status);
}
function section(title, ...children) { return el('section', { class: 'inspector-section' }, el('h3', {}, title), children); }
function empty(message) { return el('p', { class: 'empty-state' }, message); }

/** Accept only a small, inert MathML vocabulary. Unknown markup falls back to
 * the original selectable TeX; no summary or source text becomes HTML. */
function mathElement(markup) {
  if (typeof markup !== 'string' || markup.length > 100000 || /<!DOCTYPE|<\?/i.test(markup)) return null;
  const parsed = new DOMParser().parseFromString(markup, 'application/xml');
  if (parsed.querySelector('parsererror')) return null;
  const root = parsed.documentElement;
  if (root.localName !== 'math' || root.namespaceURI !== MATH) return null;
  const tags = new Set('math mrow mi mn mo mtext mspace msup msub msubsup mfrac msqrt mroot mfenced mtable mtr mtd mover munder munderover mmultiscripts mprescripts none semantics annotation mpadded mstyle'.split(' '));
  const attr = new Set('display mathvariant displaystyle scriptlevel stretchy fence separator form lspace rspace accent accentunder largeop movablelimits columnalign rowalign columnspacing rowspacing linethickness width height depth voffset mathsize open close separators encoding'.split(' '));
  const all = [root, ...root.querySelectorAll('*')];
  if (all.length > 2500) return null;
  for (const node of all) {
    if (node.namespaceURI !== MATH || !tags.has(node.localName)) return null;
    for (const attribute of node.attributes) {
      if (attribute.name === 'xmlns' && attribute.value === MATH) continue;
      if (attribute.namespaceURI || !attr.has(attribute.name) || attribute.value.length > 120 || /[<>"'\\]|(?:url|javascript|data):/i.test(attribute.value)) return null;
      if (attribute.name === 'encoding' && attribute.value !== 'application/x-tex') return null;
      if (/^(?:width|height|depth|voffset|mathsize|lspace|rspace|columnspacing|rowspacing|linethickness)$/.test(attribute.name)
        && !/^(?:[-+]?\d*(?:\.\d+)?(?:em|ex|px|pt|mu|%)?\s*)+$/.test(attribute.value)) return null;
      if (/^(?:width|height|depth|voffset|mathsize|lspace|rspace|columnspacing|rowspacing|linethickness|scriptlevel)$/.test(attribute.name)
        && [...attribute.value.matchAll(/[-+]?\d*\.?\d+/g)].some(match => !Number.isFinite(Number(match[0])) || Math.abs(Number(match[0])) > 100)) return null;
    }
  }
  return document.importNode(root, true);
}
function equation(formula) {
  const latex = text(formula.latex), pre = el('pre', { class: 'equation' }, latex || 'No equation supplied.'), copy = el('button', { type: 'button', 'aria-label': 'Copy LaTeX for ' + text(formula.label) }, 'Copy TeX');
  copy.addEventListener('click', async () => {
    try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(latex); copy.textContent = 'Copied'; }
    catch { const range = document.createRange(); range.selectNodeContents(pre); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); copy.textContent = 'Select the TeX'; }
  });
  const rendered = mathElement(formula.mathml), box = el('div', { class: 'equation-box' }, el('div', { class: 'equation-label' }, rendered ? 'Equation · local MathML' : 'Equation · LaTeX', copy));
  if (rendered) box.append(el('div', { class: 'mathml-equation' }, rendered), el('details', {}, el('summary', {}, 'LaTeX source'), pre));
  else box.append(pre);
  return box;
}
function sourceItem(id, compact = true) {
  const source = state.sourceMap.get(id);
  if (!source) return el('p', { class: 'source-limit' }, 'Source record unavailable: ' + id);
  const item = el('div', { class: compact ? 'source-item' : 'source-card' });
  item.append(safeLink(source.url, source.title), el('p', { class: 'source-reading' }, 'Reading depth: ' + human(source.access_depth || 'not specified')));
  if (strings(source.limitations).length) item.append(el('p', { class: 'source-limit' }, strings(source.limitations).join(' ')));
  return item;
}
function formulaCard(formula, compact = false) {
  const card = el('article', { class: 'formula-card' + (compact ? ' compact' : ''), 'data-formula': formula.id });
  card.append(el('h3', {}, formula.label || formula.id), equation(formula));
  const body = el('div');
  const vars = Array.isArray(formula.variables) ? formula.variables : [];
  if (vars.length) {
    const dl = el('dl', { class: 'variables' });
    for (const variable of vars) {
      if (typeof variable === 'string') { dl.append(el('dt', {}, variable), el('dd', {}, '')); continue; }
      const term = el('dt', {}, text(variable.symbol || variable.name));
      if (text(variable.unit || variable.units)) term.append(el('small', {}, text(variable.unit || variable.units)));
      dl.append(term, el('dd', {}, text(variable.meaning || variable.description)));
    }
    body.append(el('h4', {}, 'Variables'), dl);
  }
  for (const [field, label] of [['assumptions', 'Assumptions'], ['derivation', 'Derivation'], ['example', 'Worked example'], ['limitations', 'Limits and caveats']]) {
    const values = strings(formula[field]);
    if (!values.length) continue;
    body.append(el('h4', {}, label), Array.isArray(formula[field]) ? el('ul', {}, values.map(value => el('li', {}, value))) : el('p', {}, values[0]));
  }
  if (formula.source_ids?.length) body.append(el('h4', {}, 'Source reading'), ...formula.source_ids.map(id => sourceItem(id)));
  if (compact) card.append(el('details', {}, el('summary', {}, 'Assumptions, derivation and sources'), body)); else card.append(body);
  return card;
}
function connectedFormulas(node) {
  return (state.graph.formulas ?? []).filter(f => f.id === node.id || f.id === node.formula_id || node.formula_ids?.includes?.(f.id) || f.node_id === node.id || f.concept_ids?.includes?.(node.id) || f.prerequisite_ids?.includes?.(node.id));
}
function select(id, { focus = false } = {}) {
  const node = state.nodeMap.get(id); if (!node) return;
  const restoreListFocus = document.activeElement?.classList.contains('node-choice');
  state.selected = id;
  if (focus) {
    state.focus = id; state.query = ''; state.retrieval = null; state.domain = 'all'; state.type = 'all'; state.page = 0;
    if (isCatalogue(node)) state.catalogue = true;
    syncControls(); resetCamera();
  }
  const params = new URLSearchParams(); params.set('node', id);
  history.replaceState(null, '', '#' + params.toString());
  render();
  if (restoreListFocus) document.querySelector('.node-choice[data-node="' + CSS.escape(id) + '"]')?.focus({ preventScroll: true });
}
function inspector() {
  const container = $('details-content'), node = state.nodeMap.get(state.selected);
  container.replaceChildren(); $('selection-kind').textContent = node ? human(node.type) : '';
  if (!node) { container.append(el('h2', {}, 'Select an idea'), el('p', {}, 'Choose a graph node or list record to inspect its evidence.')); return; }
  container.append(el('h2', { id: 'selection-label', tabindex: '-1' }, node.label), badge(node), el('p', {}, node.summary));
  if (node.taxonomy_path?.length) container.append(el('ol', { class: 'taxonomy', 'aria-label': 'Study path' }, node.taxonomy_path.map(part => el('li', {}, part))));
  if (isCatalogue(node)) container.append(el('p', { class: 'catalogue-explanation' }, 'This catalogue entry records a manuscript or a source-defined family. Its presence here does not mean the proof was read, formally checked or independently accepted.'));
  const focus = el('button', { type: 'button', class: 'primary-button', id: 'explore-neighborhood' }, 'Explore this neighborhood', ' ↗');
  focus.addEventListener('click', () => select(node.id, { focus: true })); container.append(focus);
  const exports = el('p', { class: 'export-links' }, el('a', { href: './atlas.json', download: 'donna-brain-research.json' }, 'Brain snapshot · JSON'), ' · ', el('a', { href: './graphs/' + (Object.hasOwn(domains, node.domain) ? node.domain : 'all-fields') + '.graphml' }, 'Typed field graph · GraphML'));
  container.append(exports);
  const caveats = ['limitations', 'caveats', 'uncertainty'].flatMap(field => strings(node[field]));
  if (caveats.length) container.append(section('Limits of this record', el('ul', {}, [...new Set(caveats)].map(value => el('li', {}, value)))));
  container.append(section('Sources & reading depth', node.source_ids.length ? node.source_ids.map(id => sourceItem(id)) : el('p', {}, 'No direct source is attached. Treat this link or study-plan record as editorial organization, not independent evidence.')));
  const neighbors = state.graph.edges.filter(edge => edge.source === node.id || edge.target === node.id);
  const related = el('div', { id: 'related-list' });
  for (const edge of neighbors.slice(0, 40)) {
    const outgoing = edge.source === node.id, other = state.nodeMap.get(outgoing ? edge.target : edge.source); if (!other) continue;
    const button = el('button', { type: 'button', class: 'neighbor-button', 'data-neighbor': other.id }, el('span', {}, other.label), el('small', {}, (outgoing ? 'Outgoing · ' : 'Incoming · ') + human(edge.type) + (isCatalogue(other) ? ' · catalogue only' : '')));
    button.addEventListener('click', () => select(other.id, { focus: true })); related.append(button);
  }
  if (!neighbors.length) related.append(el('p', {}, 'No explicit connections are recorded yet.'));
  if (neighbors.length > 40) related.append(el('p', {}, `Showing 40 of ${neighbors.length} connections. Explore this neighborhood to inspect a bounded subgraph.`));
  container.append(section('Typed connections', related));
  const formulas = connectedFormulas(node);
  if (formulas.length) container.append(section('Related formulas', formulas.slice(0, 4).map(formula => formulaCard(formula, true)), el('p', {}, el('a', { href: './formula-notebook.html' }, `Read the complete formula notebook (${formulas.length} related records)`))));
  if (!neighbors.length && !formulas.length) container.append(el('p', {}, 'An isolated node is a visible gap in the current graph. It is not evidence that the subject has no connections.'));
}
function baseNodes() {
  return state.graph.nodes.filter(node => (state.catalogue || !isCatalogue(node)) && (state.domain === 'all' || node.domain === state.domain) && (state.type === 'all' || node.type === state.type));
}
function matches(value, query) {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return !query.trim() || value.toLocaleLowerCase('en-US').includes(query.toLocaleLowerCase('en-US'));
  const normalized = value.normalize('NFKC').toLocaleLowerCase('en-US');
  return terms.every(term => normalized.includes(term));
}
function nodeText(node) { return node.label + ' ' + node.summary + ' ' + node.domain + ' ' + (node.taxonomy_path ?? []).join(' '); }
function graphFor(nodes) {
  const ids = new Set(nodes.map(node => node.id));
  return { ...state.graph, nodes, edges: state.graph.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)) };
}
function filteredNodes() {
  let nodes = baseNodes();
  if (state.focus) {
    const all = state.graph.nodes.filter(node => state.catalogue || !isCatalogue(node));
    const result = exploreGraph(graphFor(all), 'public/' + state.focus, { query: '', scopes: ['public'] }, grant, 2, state.cap);
    nodes = result.nodes; state.focusTruncated = result.truncated;
  } else if (state.retrieval) {
    const order = new Map(state.retrieval.results.map((result, index) => [result.id, index]));
    return nodes.filter(node => order.has(node.id)).sort((a, b) => order.get(a.id) - order.get(b.id));
  } else nodes = nodes.filter(node => matches(nodeText(node), state.query));
  return nodes.sort(compare);
}
function positions(nodes, edges) {
  const layoutKey = nodes.map(n => n.id).join('|') + ':' + edges.map(e => e.source + ':' + e.target).join('|');
  if (state.layoutKey === layoutKey) return state.positions;
  const multipleDomains = new Set(nodes.map(n => n.domain)).size > 1;
  const groupOf = node => multipleDomains ? node.domain : node.taxonomy_path?.[1] || node.domain;
  const groups = [...new Set(nodes.map(groupOf))].sort(), center = new Map();
  groups.forEach((group, i) => {
    const angle = 2 * Math.PI * i / groups.length - Math.PI / 2;
    center.set(group, groups.length === 1 ? { x: 600, y: 420 } : { x: 600 + 300 * Math.cos(angle), y: 425 + 220 * Math.sin(angle) });
  });
  const points = nodes.map((node, i) => { const c = center.get(groupOf(node)), angle = i * 2.399963, radius = 38 + 130 * Math.sqrt((i + 1) / Math.max(nodes.length, 1)); return { id: node.id, x: c.x + radius * Math.cos(angle), y: c.y + radius * Math.sin(angle), cx: c.x, cy: c.y }; });
  const index = new Map(points.map((point, i) => [point.id, i]));
  // Finite spacing optimization for a readable drawing, not a physical simulation.
  for (let iteration = 0; iteration < 90; iteration++) {
    const delta = points.map(point => ({ x: (point.cx - point.x) * .008, y: (point.cy - point.y) * .008 }));
    for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) {
      let dx = points[a].x - points[b].x, dy = points[a].y - points[b].y;
      if (Math.abs(dx) + Math.abs(dy) < .001) dx = .1;
      const squared = dx * dx + dy * dy + 25, force = 3700 / squared, length = Math.sqrt(squared);
      const fx = dx / length * force, fy = dy / length * force;
      delta[a].x += fx; delta[a].y += fy; delta[b].x -= fx; delta[b].y -= fy;
    }
    for (const edge of edges) {
      const a = index.get(edge.source), b = index.get(edge.target); if (a === undefined || b === undefined || a === b) continue;
      const dx = points[b].x - points[a].x, dy = points[b].y - points[a].y, length = Math.hypot(dx, dy) || 1, force = (length - 100) * .009;
      delta[a].x += dx / length * force; delta[a].y += dy / length * force; delta[b].x -= dx / length * force; delta[b].y -= dy / length * force;
    }
    points.forEach((point, i) => { point.x = Math.max(90, Math.min(1100, point.x + Math.max(-5, Math.min(5, delta[i].x)))); point.y = Math.max(95, Math.min(750, point.y + Math.max(-5, Math.min(5, delta[i].y)))); });
  }
  state.layoutKey = layoutKey; state.positions = new Map(points.map(point => [point.id, point])); return state.positions;
}
function renderGraph() {
  const nodes = state.visible, ids = new Set(nodes.map(node => node.id));
  const allEdges = state.graph.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)), edges = allEdges.slice(0, 480), coords = positions(nodes, edges), world = $('graph-world');
  world.replaceChildren();
  for (const edge of edges) {
    const a = coords.get(edge.source), b = coords.get(edge.target), selected = edge.source === state.selected || edge.target === state.selected;
    const line = svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'graph-edge' + (edge.type === 'analogy' ? ' analogy' : edge.type === 'contradicts' ? ' contradiction' : '') + (selected ? ' selected-edge' : '') });
    line.append(svg('title', {}, human(edge.type))); world.append(line);
  }
  // Preserve every visible node and edge; labels appear on selection, hover or
  // focus instead of painting dozens of overlapping names across the topology.
  for (const node of [...nodes.filter(node => node.id !== state.selected), ...nodes.filter(node => node.id === state.selected)]) {
    const p = coords.get(node.id), selected = node.id === state.selected, catalogue = isCatalogue(node), domain = Object.hasOwn(domains, node.domain) ? node.domain : 'memory';
    const group = svg('g', { transform: `translate(${p.x} ${p.y})`, class: 'graph-node domain-' + domain + (selected ? ' selected' : '') + (catalogue ? ' catalogue' : ''), 'data-node': node.id, tabindex: selected ? '0' : '-1', role: 'button', 'aria-label': node.label + '. ' + (catalogue ? 'Catalogue only, proof not reviewed.' : human(node.status || 'status not specified')), 'aria-pressed': String(selected) });
    group.append(svg('title', {}, node.label + ' · ' + human(node.type)), svg('circle', { r: 27, fill: 'transparent' }), svg('circle', { r: selected ? 23 : 19, class: 'node-ring' }), svg('circle', { r: selected ? 12 : 9, class: 'node-dot' }));
    group.append(svg('text', { class: 'node-label', 'text-anchor': 'start', 'aria-hidden': 'true' }, node.label));
    group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); select(node.id); $('selection-label')?.focus?.(); } });
    world.append(group);
  }
  $('graph-count').textContent = `${nodes.length} nodes`;
  $('edge-count').textContent = `${edges.length} of ${allEdges.length} links` + (allEdges.length > edges.length ? ' · display cap 480' : '');
  $('graph-empty').hidden = nodes.length > 0;
  applyCamera();
}
function renderList() {
  const list = $('node-list'); list.replaceChildren();
  if (!state.visible.length) { list.append(empty('No records match this selection. Try a broader search or change the field.')); return; }
  for (const node of state.visible) {
    const button = el('button', { type: 'button', class: 'node-choice', 'data-node': node.id, 'aria-current': String(node.id === state.selected) }, el('span', { class: 'node-title' }, node.label), el('span', { class: 'node-description' }, node.summary), el('span', { class: 'record-meta' }, human(node.type), ' · ', domains[node.domain] || node.domain, badge(node)));
    button.addEventListener('click', () => select(node.id)); list.append(button);
  }
}
function renderSources(items) {
  const list = $('source-list'); list.replaceChildren();
  if (!items.length) { list.append(empty('No source records match the current field and search.')); return; }
  for (const source of items) {
    const article = el('article', { class: 'source-card', 'data-source': source.id }, el('h3', {}, source.title));
    article.append(el('div', { class: 'record-meta' }, human(source.source_type || source.kind || 'source'), source.year ? ' · ' + text(source.year) : '', el('span', { class: 'status-badge' }, 'Read: ' + human(source.access_depth || 'not specified'))), safeLink(source.url, source.url));
    if (text(source.summary)) article.append(el('p', {}, source.summary));
    const limits = strings(source.limitations);
    if (limits.length) article.append(el('p', { class: 'source-limit' }, limits.join(' ')));
    if (text(source.accessed_utc || source.retrieved_utc)) article.append(el('p', { class: 'source-reading' }, 'Recorded access: ' + text(source.accessed_utc || source.retrieved_utc)));
    list.append(article);
  }
}
function render() {
  if (!state.graph) return;
  $('workspace').dataset.view = state.view;
  for (const view of ['graph', 'list', 'formulas', 'sources']) {
    $('tab-' + view).setAttribute('aria-selected', String(view === state.view)); $('tab-' + view).tabIndex = view === state.view ? 0 : -1; $(view + '-panel').hidden = view !== state.view;
  }
  $('type-select').disabled = !['graph', 'list'].includes(state.view);
  let items;
  if (state.view === 'formulas') items = (state.graph.formulas ?? []).filter(formula => (state.domain === 'all' || formula.domain === state.domain) && matches(text(formula.label) + ' ' + text(formula.latex) + ' ' + strings(formula.derivation).join(' '), state.query)).sort(compare);
  else if (state.view === 'sources') {
    const ids = new Set(state.graph.nodes.filter(node => (state.catalogue || !isCatalogue(node)) && (state.domain === 'all' || node.domain === state.domain)).flatMap(node => node.source_ids));
    for (const formula of state.graph.formulas ?? []) if (state.domain === 'all' || formula.domain === state.domain) for (const id of formula.source_ids ?? []) ids.add(id);
    items = state.graph.sources.filter(source => ids.has(source.id) && matches(source.title + ' ' + text(source.summary) + ' ' + text(source.access_depth), state.query)).sort((a, b) => a.title.localeCompare(b.title));
  } else items = filteredNodes();
  const limit = ['formulas', 'sources'].includes(state.view) ? Math.min(20, state.cap) : state.cap;
  const pages = Math.max(1, Math.ceil(items.length / limit)); state.page = Math.min(state.page, pages - 1);
  state.filtered = items; state.visible = items.slice(state.page * limit, (state.page + 1) * limit);
  const start = items.length ? state.page * limit + 1 : 0, end = Math.min((state.page + 1) * limit, items.length);
  const catalogueCount = state.graph.nodes.filter(isCatalogue).length;
  $('results-count').textContent = `Showing ${start}–${end} of ${items.length} ${state.view === 'sources' ? 'sources' : state.view === 'formulas' ? 'formulas' : 'records'}` + (state.focusTruncated && state.focus ? ` · neighborhood capped at ${state.cap}` : '') + (!state.catalogue && catalogueCount && ['graph', 'list'].includes(state.view) ? ` · ${catalogueDescription()} excluded` : '') + (state.catalogue && ['graph', 'list'].includes(state.view) ? ` · ${catalogueDescription()} in full atlas; view cap ${state.cap}` : '');
  $('page-description').textContent = `Page ${state.page + 1} of ${pages}`;
  $('previous-page').disabled = state.page === 0; $('next-page').disabled = state.page + 1 >= pages;
  $('view-kicker').textContent = state.focus ? 'Two-hop neighborhood' : state.domain === 'all' ? 'Across the disciplines' : domains[state.domain];
  $('view-title').textContent = { graph: 'A map of ideas', list: 'Read the connections', formulas: 'The mathematical record', sources: 'Return to the source' }[state.view];
  $('clear-focus').hidden = !state.focus;
  $('retrieval-note').hidden = !state.retrieval;
  if (state.retrieval) $('retrieval-note').textContent = `Linked retrieval: ${state.retrieval.results.length} results returned, ${state.retrieval.omittedCount} further candidates omitted by the result/byte budget. Lexical ranking and a bounded graph walk guide discovery; the score is not confidence in a claim. ${state.retrieval.status === 'no-match' ? 'No query term matched this selection.' : ''}`;
  if (['graph', 'list'].includes(state.view)) {
    if (!state.visible.some(node => node.id === state.selected)) state.selected = state.visible[0]?.id ?? null;
    renderGraph(); renderList(); inspector();
  } else if (state.view === 'formulas') { $('formula-list').replaceChildren(...(state.visible.length ? state.visible.map(formula => formulaCard(formula)) : [empty('No formula records match this field and search.')])); }
  else renderSources(state.visible);
}
function syncControls() { $('search').value = state.query; $('domain-select').value = state.domain; $('type-select').value = state.type; $('catalogue-toggle').checked = state.catalogue; $('node-cap').value = String(state.cap); }
function filterChanged() { state.page = 0; state.focus = null; state.retrieval = null; state.focusTruncated = false; resetCamera(); render(); }
function resetCamera() { state.zoom = 1; state.x = state.y = 0; applyCamera(); }
function updateGraphLabels() {
  const frame = $('graph-svg').getBoundingClientRect();
  if (frame.width < 1 || frame.height < 1) return;
  for (const label of $('graph-world').querySelectorAll('.node-label')) {
    const group = label.parentElement, matrix = group.getScreenCTM();
    if (!matrix) continue;
    const scale = Math.hypot(matrix.a, matrix.b);
    if (!Number.isFinite(scale) || scale <= 0) continue;
    // Keep the active label readable in screen pixels, including the narrow
    // viewport and zoomed-out drawing. Full names remain in the list/inspector.
    label.style.fontSize = `${(group.classList.contains('selected') ? 15 : 14) / scale}px`;
    label.style.strokeWidth = `${4 / scale}px`;
    const title = state.nodeMap.get(group.dataset.node)?.label || '', chars = [...title];
    label.textContent = title;
    const maxWidth = Math.max(1, Math.min(300, frame.width - 28)) / scale;
    if (label.getComputedTextLength() > maxWidth) {
      let low = 0, high = chars.length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        label.textContent = chars.slice(0, mid).join('') + '…';
        if (label.getComputedTextLength() <= maxWidth) low = mid; else high = mid - 1;
      }
      label.textContent = chars.slice(0, low).join('') + '…';
    }
    const width = label.getComputedTextLength() * scale;
    const left = Math.max(frame.left + 12, Math.min(matrix.e + 15, frame.right - width - 12));
    label.setAttribute('x', String((left - matrix.e) / scale));
    label.setAttribute('y', String((matrix.f - 36 < frame.top + 40 ? 28 : -18) / scale));
  }
}
function applyCamera() { $('graph-world').setAttribute('transform', `translate(${state.x} ${state.y}) scale(${state.zoom})`); $('zoom-value').textContent = Math.round(state.zoom * 100) + '%'; updateGraphLabels(); }
function zoom(factor, cx = 600, cy = 430) { const next = Math.max(.45, Math.min(3.5, state.zoom * factor)); const ratio = next / state.zoom; state.x = cx - (cx - state.x) * ratio; state.y = cy - (cy - state.y) * ratio; state.zoom = next; applyCamera(); }
function pan(x, y) { state.x = Math.max(-3600, Math.min(3600, state.x + x)); state.y = Math.max(-2600, Math.min(2600, state.y + y)); applyCamera(); }

async function loadAtlas() {
  loadingController?.abort(); loadingController = new AbortController(); const controller = loadingController;
  $('load-error').hidden = true; $('workspace').setAttribute('aria-busy', 'true'); document.documentElement.dataset.ready = 'loading';
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('./atlas.json', { signal: controller.signal, cache: 'no-cache' });
    if (!response.ok || !response.body) throw new Error('The saved research dataset could not be downloaded.');
    const max = 16 * 1024 * 1024, declared = response.headers.get('content-length');
    if (declared && Number(declared) > max) throw new Error('The dataset exceeds the supported 16 MiB reading limit.');
    const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }); let body = '', size = 0;
    try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > max) { await reader.cancel(); throw new Error('The dataset exceeds the supported 16 MiB reading limit.'); } body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); }
    finally { reader.releaseLock(); }
    if (controller !== loadingController) return;
    const graph = JSON.parse(body); validateGraph(graph);
    if (graph.nodes.some(node => (node.scope ?? 'public') !== 'public') || graph.edges.some(edge => (edge.scope ?? 'public') !== 'public')) throw new Error('This public explorer cannot display a private-scope dataset.');
    if (graph.formulas !== undefined && (!Array.isArray(graph.formulas) || graph.formulas.length > 3000)) throw new Error('The formula collection is invalid.');
    state.graph = graph; state.nodeMap = new Map(graph.nodes.map(node => [node.id, node])); state.sourceMap = new Map(graph.sources.map(source => [source.id, source]));
    const catalogue = graph.nodes.filter(isCatalogue).length;
    const manuscripts = graph.nodes.filter(node => node.type === 'catalogue-paper').length;
    $('atlas-summary').replaceChildren(...[[graph.nodes.length - catalogue, 'study records'], [manuscripts || catalogue, manuscripts ? 'manuscripts catalogued' : 'catalogue only'], [graph.formulas?.length ?? 0, 'formulas'], [graph.sources.length, 'sources']].map(([count, label]) => el('span', {}, el('strong', {}, count.toLocaleString('en-US')), label)));
    $('type-select').replaceChildren(el('option', { value: 'all' }, 'All record types'), ...[...new Set(graph.nodes.map(node => node.type))].sort().map(type => el('option', { value: type }, human(type))));
    $('revision').textContent = 'Dataset revision ' + graph.revision.slice(0, 20) + '. Review status is attached to each record.';
    const requested = new URLSearchParams(location.hash.slice(1)).get('node');
    if (requested && state.nodeMap.has(requested)) { const node = state.nodeMap.get(requested); state.selected = requested; state.domain = Object.hasOwn(domains, node.domain) ? node.domain : 'all'; state.catalogue = isCatalogue(node); state.page = Math.max(0, Math.floor(filteredNodes().findIndex(item => item.id === requested) / state.cap)); }
    syncControls(); render(); $('workspace').setAttribute('aria-busy', 'false'); document.documentElement.dataset.ready = 'true';
  } catch (error) {
    if (controller !== loadingController) return;
    $('load-error').hidden = false; $('error-message').textContent = error.name === 'AbortError' ? 'The dataset did not arrive within 20 seconds. Try again when the connection is available.' : error.message;
    $('workspace').setAttribute('aria-busy', 'false'); document.documentElement.dataset.ready = 'error';
    $('load-state')?.replaceChildren(document.createTextNode('Dataset unavailable'));
  } finally { clearTimeout(timer); }
}

$('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.query = $('search').value.trim(); filterChanged(); }, 140); });
$('domain-select').addEventListener('change', () => { state.domain = $('domain-select').value; filterChanged(); });
$('type-select').addEventListener('change', () => { state.type = $('type-select').value; filterChanged(); });
$('catalogue-toggle').addEventListener('change', () => { state.catalogue = $('catalogue-toggle').checked; filterChanged(); });
$('node-cap').addEventListener('change', () => { const cap = Number($('node-cap').value); if ([40, 80, 160].includes(cap)) state.cap = cap; state.page = 0; resetCamera(); render(); });
$('reset-filters').addEventListener('click', () => { state.domain = 'memory'; state.type = 'all'; state.query = ''; state.catalogue = false; state.cap = 80; syncControls(); filterChanged(); });
$('clear-focus').addEventListener('click', () => { state.focus = null; state.focusTruncated = false; filterChanged(); });
$('filters').addEventListener('submit', event => {
  event.preventDefault(); if (!state.graph) return; clearTimeout(searchTimer); state.query = $('search').value.trim(); state.focus = null; state.page = 0; state.view = 'graph';
  if (!state.query) { state.retrieval = null; render(); $('search').focus(); return; }
  try { state.retrieval = queryGraph(graphFor(baseNodes()), { query: state.query, scopes: ['public'], maxResults: 12, maxBytes: 12288 }, grant); render(); }
  catch (error) { state.retrieval = null; $('retrieval-note').hidden = false; $('retrieval-note').textContent = 'The linked query could not run: ' + error.message; }
});
const tabs = [...document.querySelectorAll('[data-view]')];
for (const [index, tab] of tabs.entries()) {
  const activate = () => { state.view = tab.dataset.view; state.page = 0; render(); };
  tab.addEventListener('click', activate);
  tab.addEventListener('keydown', event => { let next; if (event.key === 'ArrowRight') next = (index + 1) % tabs.length; else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = tabs.length - 1; else return; event.preventDefault(); tabs[next].click(); tabs[next].focus(); });
}
$('previous-page').addEventListener('click', () => { if (state.page > 0) { state.page--; resetCamera(); render(); } });
$('next-page').addEventListener('click', () => { state.page++; resetCamera(); render(); });
$('retry-load').addEventListener('click', loadAtlas);
$('zoom-in').addEventListener('click', () => zoom(1.2)); $('zoom-out').addEventListener('click', () => zoom(1 / 1.2)); $('fit-view').addEventListener('click', resetCamera);
for (const button of document.querySelectorAll('[data-pan]')) button.addEventListener('click', () => { const direction = button.dataset.pan; pan(direction === 'left' ? 80 : direction === 'right' ? -80 : 0, direction === 'up' ? 80 : direction === 'down' ? -80 : 0); });
const surface = $('graph-svg'); let drag;
if ('ResizeObserver' in globalThis) new ResizeObserver(updateGraphLabels).observe(surface);
surface.addEventListener('pointerdown', event => { if (event.button !== 0) return; drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, node: event.target.closest?.('[data-node]')?.getAttribute('data-node') }; delete surface.dataset.dragged; surface.setPointerCapture(event.pointerId); });
surface.addEventListener('pointermove', event => { if (!drag || drag.id !== event.pointerId) return; const dx = event.clientX - drag.x, dy = event.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 2 || drag.moved) { drag.moved = true; surface.dataset.dragged = 'true'; surface.classList.add('dragging'); const box = surface.getBoundingClientRect(); pan(dx * 1200 / box.width, dy * 860 / box.height); drag.x = event.clientX; drag.y = event.clientY; } });
const stopDrag = event => { if (drag?.id === event.pointerId) { const selected = !drag.moved && event.type === 'pointerup' ? drag.node : null; if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId); drag = null; surface.classList.remove('dragging'); delete surface.dataset.dragged; if (selected) select(selected); } };
surface.addEventListener('pointerup', stopDrag); surface.addEventListener('pointercancel', stopDrag);
surface.addEventListener('wheel', event => { event.preventDefault(); const box = surface.getBoundingClientRect(); zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, (event.clientX - box.left) * 1200 / box.width, (event.clientY - box.top) * 860 / box.height); }, { passive: false });
surface.addEventListener('keydown', event => { const actions = { '+': () => zoom(1.2), '=': () => zoom(1.2), '-': () => zoom(1 / 1.2), '0': resetCamera, ArrowLeft: () => pan(80, 0), ArrowRight: () => pan(-80, 0), ArrowUp: () => pan(0, 80), ArrowDown: () => pan(0, -80) }; if (actions[event.key]) { event.preventDefault(); actions[event.key](); } });
loadAtlas();
