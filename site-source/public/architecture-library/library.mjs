import { DATA_FILES, ERAS, filterRecords, groupChronology, intervalPosition, normalize, prepareData, yearLabel } from './core.mjs';

const $ = selector => document.querySelector(selector);
function node(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name.startsWith('on')) element.addEventListener(name.slice(2).toLowerCase(), value);
    else if (value !== undefined) element.setAttribute(name, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child !== undefined && child !== null) element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}
const text = (tag, value, className) => node(tag, className ? { class: className } : {}, value);
const tags = values => node('div', { class: 'tags' }, values.map(value => text('span', value.replaceAll('_', ' ').replaceAll('-', ' '), 'tag')));
const list = (values, className = 'small-list') => node('ul', { class: className }, values.map(value => text('li', value)));
const heading = (title, description) => node('div', { class: 'section-heading' }, node('div', {}, text('h2', title), text('p', description, 'section-lede')));
const views = ['timeline', 'buildings', 'elements', 'samples', 'tools'];
let data, view = 'timeline', rendered = false;
const filters = { query: '', region: '', category: '', era: 'all' };

function sources(ids) {
  return node('ol', { class: 'source-list' }, ids.map(id => {
    const source = data.sources.get(id);
    return node('li', {}, node('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, source.title),
      text('small', `${source.publisher} · checked ${source.accessed}`));
  }));
}
function sourceDisclosure(ids) { return node('details', {}, text('summary', `${ids.length} source${ids.length === 1 ? '' : 's'} & provenance`), sources(ids)); }
function openLink(record) { return node('a', { class: 'record-open', href: `#monument/${record.id}` }, 'Read record ↗'); }
function empty(message = 'Try a broader query, a different period, or reset the filters.') {
  return node('div', { class: 'empty' }, text('h2', 'No records match this selection.'), text('p', message), node('button', { type: 'button', onclick: reset }, 'Reset filters'));
}
function matches(record) {
  const tokens = normalize(filters.query).trim().split(/\s+/).filter(Boolean);
  const searchable = normalize(JSON.stringify(record));
  return tokens.every(token => searchable.includes(token));
}
function recordCard(record) {
  return node('article', { class: 'card', 'data-record': record.id }, text('span', record.dateLabel, 'date'),
    text('h3', record.name), text('span', `${record.country} · ${record.region}`, 'record-meta'),
    text('p', record.description), tags(record.categories), openLink(record));
}
function chronology(records) {
  const era = ERAS.find(item => item.id === filters.era) ?? ERAS[0];
  const graphic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  graphic.setAttribute('viewBox', '0 0 1000 50');
  graphic.setAttribute('preserveAspectRatio', 'none');
  graphic.setAttribute('aria-hidden', 'true');
  graphic.setAttribute('class', 'axis-track');
  for (const record of records) {
    const position = intervalPosition(record, era);
    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bar.setAttribute('x', String(Math.min(998, position.left * 10)));
    bar.setAttribute('y', '6'); bar.setAttribute('height', '38');
    bar.setAttribute('width', String(Math.min(1000 - position.left * 10, Math.max(2, position.width * 10))));
    bar.setAttribute('class', 'axis-mark');
    graphic.append(bar);
  }
  return [heading('A chronology of making.', 'Read each date as an evidence-based construction interval or documented phase. Overlapping phases can appear in more than one period filter.'),
    node('div', { class: 'timeline-axis' }, node('div', { class: 'axis-labels' }, text('span', yearLabel(era.start)), text('span', yearLabel(era.end))), graphic,
      text('p', 'Linear time axis · intervals overlap; very short phases use a minimum visible width. The ordered records below provide exact labels. Select a period to inspect recent centuries.', 'axis-help')),
    ...groupChronology(records).map(group => node('section', { class: 'chronology-group', 'aria-label': group.label },
      node('div', { class: 'chronology-period' }, text('h2', group.label), text('p', `${group.records.length} record${group.records.length === 1 ? '' : 's'} · grouped by first documented phase`)),
      node('div', { class: 'chronology-items' }, group.records.map(record => node('article', { class: 'timeline-record', 'data-record': record.id },
        text('span', record.dateLabel, 'date'), node('div', {}, text('span', `${record.country} · ${record.period}`, 'record-meta'),
          text('h3', record.name), text('p', record.description)), openLink(record))))))];
}
function elementCard(element) {
  const related = data.samples.samples.filter(sample => sample.elementIds.includes(element.id));
  return node('article', { class: 'card element-card', 'data-element': element.id }, text('span', element.family, 'record-meta'),
    text('h3', element.name), text('p', element.definition), text('span', 'Load path / behavior', 'field-label'), text('p', element.loadPath),
    tags(element.materials), text('span', 'Applications', 'field-label'), list(element.uses), text('span', 'Limits of this explanation', 'field-label'),
    list(element.limitations), related.length ? node('p', {}, 'Study this geometry: ', node('a', { href: '#samples' }, related.map(sample => sample.name).join('; '))) : null,
    sourceDisclosure(element.sourceIds));
}
function sampleCard(sample) {
  return node('article', { class: 'card sample-card', 'data-sample': sample.id },
    node('img', { src: `./${sample.files.preview}`, alt: `${sample.name}: original schematic geometry`, loading: 'lazy', width: '384', height: '384' }),
    node('div', { class: 'sample-body' }, text('span', sample.studyType, 'record-meta'), text('h3', sample.name), text('p', sample.summary),
      tags(sample.elementIds), node('div', { class: 'downloads' },
        ['blend', 'glb', 'metadata'].map(format => node('a', { href: `./${sample.files[format]}`, download: '' }, format === 'blend' ? 'Blender .blend ↓' : format === 'glb' ? 'glTF .glb ↓' : 'Metadata ↓'))),
      list(sample.limitations), sourceDisclosure(sample.sourceIds)));
}
function toolCard(tool) {
  return node('article', { class: 'card', 'data-tool': tool.id }, text('span', `${tool.kind} · ${tool.automationStatus.replaceAll('_', ' ')}`, 'record-meta'),
    text('h3', tool.name), tags(tool.platforms), text('span', 'Good for', 'field-label'), list(tool.useCases),
    text('span', 'Input data', 'field-label'), text('p', tool.inputData.join(' · ')), text('span', 'Rights & export', 'field-label'),
    text('p', tool.licenseSummary), text('p', tool.exportGuidance), list(tool.limitations), sourceDisclosure(tool.sourceIds));
}
function render() {
  if (!data) return;
  const buildingView = view === 'timeline' || view === 'buildings';
  $('#catalog-filters').classList.toggle('general-filters', !buildingView);
  for (const id of ['region', 'category', 'era']) $(`#${id}`).closest('label').hidden = !buildingView;
  for (const link of document.querySelectorAll('[data-view]')) {
    if (link.dataset.view === view) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  }
  let content = [], count, total;
  if (buildingView) {
    const records = filterRecords(data.monuments.records, filters);
    count = records.length; total = data.monuments.records.length;
    if (!count) content = [empty()];
    else if (view === 'timeline') content = chronology(records);
    else content = [heading('Buildings, places and structural ideas.', 'Open a record for its construction phases, engineering explanation, cultural context, uncertainties and primary sources.'), node('div', { class: 'grid' }, records.map(recordCard))];
  } else if (view === 'elements') {
    const records = data.elements.elements.filter(matches); count = records.length; total = data.elements.elements.length;
    content = [heading('How the pieces carry the whole.', 'Read load paths as qualitative teaching explanations. Real stability also depends on dimensions, joints, foundations, materials, site conditions and verified engineering analysis.'), records.length ? node('div', { class: 'grid' }, records.map(elementCard)) : empty()];
  } else if (view === 'samples') {
    const records = data.samples.samples.filter(matches); count = records.length; total = data.samples.samples.length;
    content = [heading('Open the study. Inspect the geometry.', 'Original procedural models of structural ideas, with metres, bounded geometry and documented limits. These are not surveyed monuments, certified structures or complete historical reconstructions.'),
      node('div', { class: 'notebook' }, text('h3', 'From a local sample to your creative worker'),
        text('p', 'Download a .blend for editing, a .glb for a game-engine import, and its metadata to keep units and provenance together. The reviewed Blender generator is included in the repository. Use the existing creative.execute permission and project assignment when sending it through Donna, MCP or the headless runtime.'),
        node('a', { href: './docs/WORKFLOWS.md' }, 'Read generation, VPS and Unreal workflows ↗'), text('p', 'For footprint extrusion, try the separate original synthetic city-block example: '),
        node('a', { href: './geospatial/README.md' }, 'Offline GeoJSON study ↗')),
      records.length ? node('div', { class: 'grid' }, records.map(sampleCard)) : empty()];
  } else {
    const records = data.tools.tools.filter(matches); count = records.length; total = data.tools.tools.length;
    const claims = data.tools.claims.filter(matches);
    content = [heading('Choose the data rights before the importer.', 'Tools, source data and output artifacts have separate permissions. “Supported” below means an upstream documented CLI or API; it does not mean that tool has been installed or connected to your VPS.'),
      node('div', { class: 'notebook' }, text('h3', 'Two distinct routes'), text('p', 'For distributable game assets, start with original geometry or data whose license permits your intended export, and retain its attribution. For Google photorealistic tiles, use a permitted licensed visualization workflow and review its current policies before recording, extracting, storing or distributing content.'), node('a', { href: './docs/GEOSPATIAL_TOOLS.md' }, 'Read the source-backed tool and licensing audit ↗')),
      node('section', { class: 'claim-list', 'aria-label': 'Marketing claim audit' }, text('h2', 'Claims checked against sources'), claims.map(claim => node('article', { class: 'claim' }, text('span', claim.verdict.replaceAll('_', ' '), 'verdict'),
        node('div', {}, text('h3', claim.claim), text('p', claim.assessment), sourceDisclosure(claim.sourceIds))))),
      records.length ? node('div', { class: 'grid tool-grid' }, records.map(toolCard)) : empty()];
  }
  $('#result-summary').textContent = `${count} of ${total} ${buildingView ? 'building and place records' : view === 'samples' ? 'original model studies' : view === 'elements' ? 'element records' : 'tool and data records'}${filters.query ? ` · search: ${filters.query}` : ''}`;
  $('#content').replaceChildren(...content);
  rendered = true;
}
function showRecord(id) {
  const record = data.monuments.records.find(item => item.id === id);
  if (!record) {
    $('#record-content').replaceChildren(text('h2', 'Record not found'), text('p', 'That record ID is not in this edition. Close this panel and search the collection.'));
    $('#record-content h2').id = 'record-title';
  } else {
    $('#record-content').replaceChildren(text('span', `${record.country} · ${record.region} · ${record.status.replaceAll('_', ' ')}`, 'record-meta'),
      node('h2', { id: 'record-title' }, record.name), text('p', `${record.dateLabel} · ${record.datePrecision.replaceAll('_', ' ')} dating`, 'date'),
      text('p', record.description), tags(record.categories),
      node('div', { class: 'detail-grid' }, node('div', {}, text('span', 'Period / tradition', 'field-label'), text('p', record.period)),
        node('div', {}, text('span', 'Materials', 'field-label'), text('p', record.materials.join(' · '))),
        node('div', {}, text('span', 'Structural systems', 'field-label'), text('p', record.structuralSystems.join(' · '))),
        node('div', {}, text('span', 'Elements to study', 'field-label'), text('p', record.elements.map(item => item.replaceAll('-', ' ')).join(' · ')))),
      text('span', 'Engineering explanation', 'field-label'), text('p', record.engineering),
      text('span', 'Cultural / historical significance', 'field-label'), text('p', record.significance),
      node('div', { class: 'caveat' }, text('strong', 'What remains uncertain or phase-specific'), list(record.uncertainties)),
      text('span', 'Primary sources', 'field-label'), sources(record.sourceIds),
      node('p', {}, node('a', { href: './docs/METHODOLOGY.md' }, 'How dates, reconstruction and source rights are handled')));
  }
  if (!$('#record-dialog').open) $('#record-dialog').showModal();
}
function route() {
  const hash = location.hash.slice(1);
  if (hash === 'content') { if (!rendered) render(); return; } // Preserve the section on skip; also support direct/reloaded anchors.
  if (hash.startsWith('monument/')) {
    if (!rendered) render();
    showRecord(hash.slice('monument/'.length)); return;
  }
  if ($('#record-dialog').open) $('#record-dialog').close();
  view = views.includes(hash) ? hash : 'timeline';
  render();
}
function reset() {
  Object.assign(filters, { query: '', region: '', category: '', era: 'all' });
  for (const [id, key] of [['search', 'query'], ['region', 'region'], ['category', 'category'], ['era', 'era']]) $(`#${id}`).value = filters[key];
  render();
}
async function start() {
  const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key, file]) => {
    const response = await fetch(new URL(file, import.meta.url), { credentials: 'omit', cache: 'no-cache' });
    if (!response.ok) throw new Error(`Unable to load ${file} (${response.status}).`);
    return [key, await response.json()];
  }));
  data = prepareData(Object.fromEntries(entries));
  $('#stats').replaceChildren(...[[data.monuments.records.length, 'Places'], [data.elements.elements.length, 'Elements'], [data.samples.samples.length, 'Model studies'], [data.sources.size, 'Sources']].map(([value, label]) => node('div', {}, text('span', value, 'stat-value'), text('span', label, 'stat-label'))));
  for (const [id, values] of [['region', [...new Set(data.monuments.records.map(record => record.region))].sort()], ['category', [...new Set(data.monuments.records.flatMap(record => record.categories))].sort()]]) {
    for (const value of values) $(`#${id}`).append(node('option', { value }, value.replaceAll('-', ' ')));
  }
  $('#era').replaceChildren(...ERAS.map(era => node('option', { value: era.id }, era.label)));
  for (const [id, key] of [['search', 'query'], ['region', 'region'], ['category', 'category'], ['era', 'era']]) {
    $(`#${id}`).addEventListener(id === 'search' ? 'input' : 'change', event => { filters[key] = event.target.value; render(); });
  }
  $('#reset').addEventListener('click', reset);
  $('#close-dialog').addEventListener('click', () => $('#record-dialog').close());
  $('#record-dialog').addEventListener('close', () => {
    if (location.hash.startsWith('#monument/')) history.replaceState(null, '', `#${view}`);
  });
  window.addEventListener('hashchange', route);
  document.documentElement.dataset.ready = 'true';
  route();
}
start().catch(error => {
  console.error(error);
  $('#stats').replaceChildren(text('span', 'Collection unavailable'));
  $('#result-summary').textContent = 'The catalog could not be loaded.';
  $('#content').replaceChildren(node('div', { class: 'error', role: 'alert' }, text('h2', 'The reference files did not load.'),
    text('p', 'Serve this folder over HTTP, or use the published library. Opening index.html directly with file:// may block local JSON requests.'),
    text('p', error.message), node('a', { href: './README.md' }, 'Open the reading and setup guide')));
});
