#!/usr/bin/env node
/** Isolated DOM behavior only; visual, CSS and native dialog acceptance run separately in CI Chromium. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as core from '../projects/architecture-library/core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const library = path.join(root, 'projects/architecture-library');
const require = createRequire(path.join(root, 'desktop-shell/package.json'));
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(library, 'index.html'), 'utf8');
const code = fs.readFileSync(path.join(library, 'library.mjs'), 'utf8')
  .replace(/^import \{([^}]+)\} from '\.\/core\.mjs';/, 'const {$1} = window.__core;')
  .replaceAll('import.meta.url', '"https://library.test/library.mjs"');
const raw = Object.fromEntries(Object.entries(core.DATA_FILES).map(([key, file]) => [key, JSON.parse(fs.readFileSync(path.join(library, file), 'utf8'))]));
let checks = 0;
const check = (value, message) => { assert(value, message); checks++; };
async function create(fail = false, hash = '') {
  const dom = new JSDOM(html, { url: `https://library.test/index.html${hash}`, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; w.__core = core;
  w.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
  w.HTMLDialogElement.prototype.close = function() { this.open = false; this.dispatchEvent(new w.Event('close')); };
  let requests = 0;
  w.fetch = async url => {
    requests++; const parsed = new URL(url);
    const found = Object.entries(core.DATA_FILES).find(([, file]) => parsed.pathname === `/${file}`);
    assert.equal(parsed.origin, 'https://library.test'); assert(found, 'Only declared same-origin catalog files may load');
    return { ok: !fail, status: fail ? 503 : 200, json: async () => structuredClone(raw[found[0]]) };
  };
  const expectedErrors = [];
  w.console.error = error => expectedErrors.push(error.message);
  w.eval(code);
  await new Promise(resolve => setTimeout(resolve, 15));
  return { dom, w, d: w.document, requests, expectedErrors };
}
const fixture = await create();
const { w, d } = fixture;
check(d.documentElement.dataset.ready === 'true', 'Dataset loads');
check(d.querySelectorAll('[data-record]').length === raw.monuments.records.length, 'Chronology has all records');
check(fixture.requests === 7, 'Only seven declared JSON files are loaded');
async function navigate(hash) { w.location.hash = hash; await new Promise(resolve => setTimeout(resolve, 10)); }
await navigate('buildings');
const search = d.querySelector('#search');
search.value = 'gobekli'; search.dispatchEvent(new w.Event('input'));
check(d.querySelectorAll('[data-record]').length === 1, 'Accent-insensitive search');
await navigate('monument/gobekli-tepe');
check(d.querySelector('#record-dialog').open, 'Record opens');
check(d.querySelectorAll('#record-dialog .source-list li').length > 0, 'Sources shown');
d.querySelector('#close-dialog').click();
check(!d.querySelector('#record-dialog').open && w.location.hash === '#buildings', 'Close restores view hash');
search.value = '<img src=x onerror=alert(1)>'; search.dispatchEvent(new w.Event('input'));
check(d.querySelectorAll('#content img').length === 0 && d.querySelector('.empty'), 'Search is text and empty state is useful');
d.querySelector('#reset').click();
for (const [view, selector, count] of [['elements', '[data-element]', raw.elements.elements.length], ['samples', '[data-sample]', raw.samples.samples.length], ['tools', '[data-tool]', raw.tools.tools.length]]) {
  await navigate(view); check(d.querySelectorAll(selector).length === count, `Populated ${view} view`);
}
await navigate('samples');
await navigate('content');
check(d.querySelector('[data-view="samples"]').getAttribute('aria-current') === 'page', 'Skip anchor preserves the chosen section');
check(d.querySelectorAll('a[download]').length === raw.samples.samples.length * 3, 'All sample downloads are exposed');
check(d.querySelector('#region').closest('label').hidden, 'Building-only filters are hidden in model view');
await navigate('monument/missing-record');
check(d.querySelector('#record-title').textContent === 'Record not found', 'Invalid deep link is readable');
check(fixture.expectedErrors.length === 0, 'No startup errors');
fixture.dom.window.close();
const anchored = await create(false, '#content');
check(anchored.d.querySelectorAll('[data-record]').length === raw.monuments.records.length, 'Initial skip anchor still renders the catalog');
anchored.dom.window.close();
const failed = await create(true);
check(Boolean(failed.d.querySelector('[role="alert"]')) && failed.expectedErrors.length === 1, 'Failed catalog has a recovery message');
failed.dom.window.close();
console.log(JSON.stringify({ status: 'passed', checks, networkCalls: 0, providerCalls: 0, scope: 'Pure DOM fixture; no browser layout or native dialog claim' }, null, 2));
