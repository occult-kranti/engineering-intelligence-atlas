import { validateCatalog, localPath, externalUrl, formatInteger, formatBytes, assertEmbeddedGlb } from './catalog-core.mjs';
import { boundedBytes, MODEL_DOWNLOAD_TIMEOUT_MS } from './download-core.mjs';
const $ = selector => document.querySelector(selector);
const node = (tag, text, className) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; };
const localUrl = file => new URL(localPath(file), import.meta.url).href;
const link = (label, url, external = false) => { const a = node('a', label); a.href = external ? externalUrl(url) : localUrl(url); if (external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } return a; };
let catalog, selected, viewer, activeRequest, requestId = 0;
const status = text => { $('#viewer-status').textContent = text; };
const setControls = enabled => { document.querySelectorAll('[data-action], #surface-mode').forEach(el => { el.disabled = !enabled; }); };
function metric(label, value) { const group = node('div'); group.append(node('dt', label), node('dd', value)); return group; }
function selectAsset(asset, updateHash = true) {
  unload(); selected = asset;
  if (updateHash) history.replaceState(null, '', `#${asset.id}`);
  $('#viewer-preview').src = localUrl(asset.preview);
  $('#viewer-preview').alt = `Blender inspection render of ${asset.name}. ${asset.previewNote}`;
  $('#viewer-preview').hidden = false;
  $('#preview-description').textContent = asset.previewNote;
  $('#viewer-kind').textContent = asset.kind.toUpperCase();
  $('#load-note').textContent = `${formatBytes(asset.bytes)} download · ${formatInteger(asset.triangles)} triangles · requires WebGL 2`;
  $('#load-model').disabled = false;
  $('#load-model').textContent = 'Load 3D model';
  $('#viewer-overlay').hidden = false;
  status('Preview only. Load the model to inspect the actual geometry. Physical measurements are unavailable.');
  document.querySelectorAll('[data-asset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.asset === asset.id)));
  const record = $('#record'); record.replaceChildren();
  record.append(node('span', asset.qualityLabel, `badge ${asset.detailClass === 'context' ? 'context' : ''}`));
  const title = node('h2', asset.name); title.id = 'record-title'; record.append(title, node('p', asset.location, 'location'), node('p', asset.summary));
  const metrics = node('dl', null, 'metrics');
  metrics.append(metric('Triangles in this file', formatInteger(asset.triangles)), metric('Position entries', formatInteger(asset.vertices)), metric('Physical scale / accuracy', 'Unverified'), metric('Appearance', asset.appearance));
  record.append(metrics);
  const limitations = node('ul', null, 'limitations'); asset.limitations.forEach(text => limitations.append(node('li', text))); record.append(limitations);
  const credit = node('p', asset.attribution, 'credit'); credit.append(document.createTextNode(' '), link('License ↗', asset.license.url, true)); record.append(credit);
  const details = node('details'); details.append(node('summary', 'Source, changes & evidence'));
  details.append(node('p', asset.changes.join(' ')), node('p', `SHA256: ${asset.sha256}`, 'credit'), link('Source record ↗', asset.sourceUrl, true), document.createTextNode(' · '), link('Inspection evidence', asset.evidence)); record.append(details);
  if (asset.license.sourceRightsNote) record.append(node('p', asset.license.sourceRightsNote, 'credit'));
  const downloads = node('div', null, 'download-links');
  const download = link(`Download GLB · ${formatBytes(asset.bytes)}`, asset.file); download.download = `${asset.id}.glb`;
  downloads.append(download, link('Blender / Godot instructions', 'README.md')); record.append(downloads);
}
function unload() {
  requestId++;
  if (activeRequest) { clearTimeout(activeRequest.deadline); activeRequest.controller.abort(); activeRequest = undefined; }
  viewer?.dispose(); viewer = undefined;
  $('#viewport').classList.remove('live');
  $('#viewport').dataset.loadedAsset = '';
  $('#viewer-preview').hidden = false;
  $('#viewer-overlay').hidden = false;
  $('#load-model').disabled = !selected;
  $('#load-model').textContent = 'Load 3D model';
  $('#surface-mode').value = 'source'; setControls(false);
  $('#unload-model').disabled = true; $('#unload-model').textContent = 'Unload';
}
async function loadSelected() {
  if (!selected) return;
  unload(); const asset = selected, id = requestId;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(new DOMException('Model download timed out after 120 seconds', 'TimeoutError')), MODEL_DOWNLOAD_TIMEOUT_MS);
  activeRequest = { controller, deadline };
  const report = message => { if (id === requestId && !controller.signal.aborted) status(message); };
  $('#load-model').disabled = true; $('#load-model').textContent = 'Loading…';
  $('#unload-model').disabled = false; $('#unload-model').textContent = 'Cancel loading';
  status(`Downloading and verifying ${asset.shortName}…`);
  let candidate;
  try {
    const response = await fetch(localUrl(asset.file), { signal: controller.signal });
    const buffer = await boundedBytes(response, asset.bytes, controller.signal, percent => report(`Downloading ${asset.shortName}: ${percent}%`));
    clearTimeout(deadline);
    if (id !== requestId) return;
    controller.signal.throwIfAborted();
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (id !== requestId) return;
    controller.signal.throwIfAborted();
    if (digest !== asset.sha256) throw new Error('Model integrity check failed');
    assertEmbeddedGlb(buffer);
    report(`Verified download. Preparing ${formatInteger(asset.triangles)} triangles…`);
    const { createViewer } = await import('./viewer.mjs');
    if (id !== requestId) return;
    controller.signal.throwIfAborted();
    candidate = await createViewer($('#viewport'), buffer, asset, report, controller.signal);
    if (id !== requestId) { candidate.dispose(); return; }
    viewer = candidate; activeRequest = undefined;
    $('#viewer-preview').hidden = true; $('#viewer-overlay').hidden = true;
    $('#viewport').classList.add('live'); $('#viewport').dataset.loadedAsset = asset.id;
    setControls(true);
    status(`${asset.shortName} loaded · ${formatInteger(viewer.triangles)} triangles · source hash verified. View only; physical scale is unverified.`);
  } catch (error) {
    candidate?.dispose();
    if (id !== requestId) return;
    const cause = controller.signal.aborted ? controller.signal.reason : error;
    if (!controller.signal.aborted) controller.abort();
    $('#load-model').disabled = false; $('#load-model').textContent = 'Retry 3D model';
    status(`${cause.message}. The preview and source downloads remain available.`);
  } finally {
    clearTimeout(deadline);
    if (id === requestId) {
      activeRequest = undefined;
      $('#unload-model').disabled = !viewer; $('#unload-model').textContent = 'Unload';
    }
  }
}
$('#load-model').addEventListener('click', loadSelected);
$('#unload-model').addEventListener('click', () => {
  const loading = Boolean(activeRequest);
  unload();
  status(loading ? 'Loading cancelled. The preview remains available; load a model to try again.' : 'Model unloaded and graphics resources released. Preview and source records remain available.');
});
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => viewer?.action(button.dataset.action)));
$('#surface-mode').addEventListener('change', event => viewer?.surface(event.target.value));
$('#viewport').addEventListener('keydown', event => {
  if (event.target !== $('#viewport')) return;
  const action = { ArrowLeft: 'left', ArrowRight: 'right', '+': 'in', '=': 'in', '-': 'out', Home: 'reset' }[event.key];
  if (action && viewer) { event.preventDefault(); viewer.action(action); }
});
window.addEventListener('pagehide', unload);
window.addEventListener('hashchange', () => { const asset = catalog?.assets.find(item => `#${item.id}` === location.hash); if (asset && asset !== selected) selectAsset(asset, false); });
try {
  const response = await fetch(new URL('./catalog.json', import.meta.url));
  if (!response.ok) throw new Error('Capture records did not load');
  catalog = validateCatalog(await response.json());
  $('#counts').replaceChildren();
  for (const [count, label] of [[catalog.assets.length, 'LOCAL 3D MODELS'], [catalog.references.length, 'DETAIL SOURCES'], [0, 'VERIFIED METRIC CLAIMS']]) {
    const item = node('span'); item.append(node('strong', String(count)), document.createTextNode(label)); $('#counts').append(item);
  }
  for (const asset of catalog.assets) {
    const card = node('button', null, 'asset-card'); card.type = 'button'; card.dataset.asset = asset.id; card.setAttribute('aria-pressed', 'false');
    const img = node('img'); img.src = localUrl(asset.preview); img.alt = ''; img.loading = 'lazy'; img.width = 512; img.height = 384;
    const body = node('span', null, 'card-body'); body.append(node('span', asset.qualityLabel, `badge ${asset.detailClass === 'context' ? 'context' : ''}`), node('h3', asset.shortName), node('p', asset.location), node('p', `${formatInteger(asset.triangles)} triangles · ${formatBytes(asset.bytes)}`, 'card-meta'));
    card.append(img, body); card.addEventListener('click', () => { selectAsset(asset); $('#workspace').scrollIntoView({ behavior: 'instant', block: 'start' }); }); $('#asset-list').append(card);
  }
  for (const ref of catalog.references) {
    const article = node('article', null, 'reference-card'); article.append(node('span', ref.label, 'badge'), node('h3', ref.name), node('p', ref.description), node('p', ref.limitation), link('Open original source ↗', ref.url, true)); $('#reference-list').append(article);
  }
  selectAsset(catalog.assets.find(asset => `#${asset.id}` === location.hash) || catalog.assets[0], false);
  document.documentElement.dataset.ready = 'true';
} catch (error) {
  const alert = node('p', `${error.message}. Reload the page or open the capture guide and source catalog directly.`, 'notice'); alert.setAttribute('role', 'alert'); $('#record').replaceChildren(alert);
}
