import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as catalogCore from '../catalog-core.mjs';
import * as downloadCore from '../download-core.mjs';

const base = new URL('../', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(new URL('catalog.json', base)));
const asset = id => catalog.assets.find(item => item.id === id);
const modelResponse = id => new Response(fs.readFileSync(new URL(asset(id).file, base)));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

// Execute the actual page controller with only its module linking and browser surfaces supplied.
// This checks request races; it is not a substitute for the real Chromium/WebGL release gate.
async function pageHarness(fetchModel, createViewer) {
  const elements = new Map(), timers = new Map(); let nextTimer = 1;
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.dataset = {}; this.listeners = {}; this.attributes = {}; this.classList = { add() {}, remove() {} }; this.hidden = false; this.disabled = false; this.textContent = ''; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    scrollIntoView() {}
    click() { if (this.disabled) throw new Error('Attempted to click a disabled control'); return this.listeners.click?.({ target: this }); }
  }
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const document = {
    documentElement: new Element('html'),
    querySelector: selector => get(selector.slice(1)),
    querySelectorAll(selector) {
      if (selector === '[data-asset]') return get('asset-list').children;
      if (selector === '[data-action], #surface-mode') return [get('surface-mode')];
      if (selector === '[data-action]') return [];
      throw new Error(`Unmodelled DOM query: ${selector}`);
    },
    createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }),
  };
  const source = fs.readFileSync(new URL('site-models.mjs', base), 'utf8')
    .replace(/^import .+;\n/gm, '')
    .replaceAll('import.meta.url', JSON.stringify(new URL('site-models.mjs', base).href))
    .replace("await import('./viewer.mjs')", '({ createViewer: injectedCreateViewer })');
  const environment = {
    ...catalogCore, ...downloadCore, document, injectedCreateViewer: createViewer, URL, AbortController, DOMException,
    Uint8Array, crypto: webcrypto, location: { hash: '#khufu' }, history: { replaceState() {} },
    window: { addEventListener() {} },
    fetch: (url, options) => String(url).endsWith('catalog.json') ? Promise.resolve(Response.json(catalog)) : fetchModel(String(url), options),
    setTimeout(callback, ms) { const id = nextTimer++; timers.set(id, { callback, ms }); return id; },
    clearTimeout: id => timers.delete(id),
  };
  await vm.runInNewContext(`(async () => { ${source}\n })()`, environment, { filename: 'site-models.mjs' });
  const select = id => get('asset-list').children.find(button => button.dataset.asset === id).click();
  return { get, timers, select };
}

test('a timed-out header request offers retry and clears its timer and active cancel control', { timeout: 5000 }, async () => {
  const requested = deferred();
  const page = await pageHarness((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true }); requested.resolve();
  }), () => { throw new Error('Timed-out download must not enter the renderer'); });
  const loading = page.get('load-model').click(); await requested.promise;
  assert.equal(page.get('unload-model').disabled, false);
  assert.equal(page.get('unload-model').textContent, 'Cancel loading');
  const [timer] = page.timers.values(); assert.equal(timer.ms, 120000); timer.callback();
  await loading;
  assert.match(page.get('viewer-status').textContent, /timed out after 120 seconds/);
  assert.equal(page.get('load-model').textContent, 'Retry 3D model');
  assert.equal(page.get('load-model').disabled, false);
  assert.equal(page.get('unload-model').disabled, true); assert.equal(page.timers.size, 0);
});

test('cancelling an active body keeps the preview and permits a different model to load', { timeout: 5000 }, async () => {
  const requested = deferred(); let cancelled = false, first = true;
  const page = await pageHarness(url => {
    if (first) {
      first = false; requested.resolve();
      return Promise.resolve(new Response(new ReadableStream({ cancel() { cancelled = true; } })));
    }
    return Promise.resolve(modelResponse(url.includes('khafre') ? 'khafre' : 'khufu'));
  }, async (_host, _buffer, selected) => ({ triangles: selected.triangles, dispose() {} }));
  const loading = page.get('load-model').click(); await requested.promise;
  // Let the fulfilled fetch hand its stalled reader to the page controller.
  await Promise.resolve(); await Promise.resolve();
  page.get('unload-model').click(); await loading;
  assert.equal(cancelled, true); assert.equal(page.get('viewer-preview').hidden, false);
  assert.match(page.get('viewer-status').textContent, /Loading cancelled/);
  assert.equal(page.timers.size, 0);
  page.select('khafre'); await page.get('load-model').click();
  assert.equal(page.get('viewport').dataset.loadedAsset, 'khafre', page.get('viewer-status').textContent);
  assert.match(page.get('viewer-status').textContent, /Khafre.*source hash verified/);
  assert.equal(page.get('unload-model').disabled, false);
});

test('late renderer completion and status callbacks cannot replace a newer selection', { timeout: 5000 }, async () => {
  const entered = deferred(), oldResult = deferred(); let oldStatus, oldSignal, oldDisposed = 0, newDisposed = 0;
  const page = await pageHarness(url => Promise.resolve(modelResponse(url.includes('khafre') ? 'khafre' : 'khufu')),
    async (_host, _buffer, selected, report, signal) => {
      if (selected.id === 'khufu') { oldStatus = report; oldSignal = signal; entered.resolve(); return oldResult.promise; }
      return { triangles: selected.triangles, dispose() { newDisposed++; } };
    });
  const loading = page.get('load-model').click(); await entered.promise;
  page.select('khafre'); assert.equal(oldSignal.aborted, true);
  await page.get('load-model').click();
  const currentStatus = page.get('viewer-status').textContent;
  oldStatus('Stale renderer error'); oldResult.resolve({ triangles: asset('khufu').triangles, dispose() { oldDisposed++; } });
  await loading;
  assert.equal(page.get('viewer-status').textContent, currentStatus);
  assert.equal(page.get('viewport').dataset.loadedAsset, 'khafre');
  assert.equal(page.get('unload-model').disabled, false);
  assert.equal(oldDisposed, 1); assert.equal(newDisposed, 0); assert.equal(page.timers.size, 0);
});
