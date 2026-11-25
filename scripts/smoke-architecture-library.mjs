#!/usr/bin/env node
/** Real-browser acceptance for the published library; CI installs its matched Chromium. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'site-source/package.json'));
const { chromium } = require('playwright');
const source = path.join(root, 'docs/architecture-library');
const evidence = path.join(root, 'site-source/.work/architecture-ui');
fs.mkdirSync(evidence, { recursive: true });
const read = file => JSON.parse(fs.readFileSync(path.join(source, file), 'utf8'));
const monuments = read('data/monuments.json').records;
const samples = read('data/samples.json').samples;
const countByView = { timeline: monuments.length, buildings: monuments.length, elements: read('data/elements.json').elements.length, samples: samples.length, tools: read('data/tools.json').tools.length };
const mount = '/engineering-intelligence-atlas/architecture-library/';
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = createServer((request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith(mount)) { response.writeHead(404).end(); return; }
    const file = path.resolve(source, decodeURIComponent(pathname.slice(mount.length)) || 'index.html');
    if (!file.startsWith(source + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' });
    response.end(fs.readFileSync(file));
  } catch { response.writeHead(400).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${mount}`;
const checks = [], screenshots = [];
let browser, activePage;
try {
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', acceptDownloads: true });
    const page = await context.newPage();
    activePage = page;
    const errors = [], failed = [], remote = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
    page.on('request', request => { if (!request.url().startsWith(base)) remote.push(request.url()); });
    await page.goto(`${base}index.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    for (const view of ['timeline', 'buildings', 'elements', 'samples', 'tools']) {
      await page.locator(`[data-view="${view}"]`).click();
      await page.locator(`[data-view="${view}"][aria-current="page"]`).waitFor();
      const selector = view === 'timeline' || view === 'buildings' ? '[data-record]' : view === 'elements' ? '[data-element]' : view === 'samples' ? '[data-sample]' : '[data-tool]';
      assert.equal(await page.locator(selector).count(), countByView[view]);
      const horizontal = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(horizontal, false, `${view}/${viewport.width}: horizontal overflow`);
      if (view === 'samples') {
        await page.locator('.sample-card img').first().scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('.sample-card img')?.naturalWidth === 384);
      }
      const file = `${view}-${viewport.width}.png`;
      await page.screenshot({ path: path.join(evidence, file), fullPage: view === 'samples' });
      screenshots.push(file); checks.push(`${view}/${viewport.width}: populated view and no horizontal overflow`);
    }
    await page.locator('[data-view="buildings"]').click();
    await page.locator('[data-view="buildings"][aria-current="page"]').waitFor();
    await page.locator('#search').fill('gobekli');
    assert.equal(await page.locator('[data-record]').count(), 1);
    await page.locator('.record-open').click();
    await page.locator('#record-dialog[open]').waitFor();
    assert.match(await page.locator('#record-title').textContent(), /bekli/);
    assert((await page.locator('#record-dialog a[href^="https://"]').count()) > 0);
    await page.keyboard.press('Escape');
    await page.locator('#record-dialog').waitFor({ state: 'hidden' });
    await page.waitForURL(url => url.hash === '#buildings');
    assert(!page.url().includes('#monument/'));
    await page.locator('#search').fill('<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('[data-record]').count(), 0);
    assert.equal(await page.locator('#content img').count(), 0);
    await page.locator('#reset').click();
    await page.locator('#region').selectOption('South Asia');
    const regionCount = monuments.filter(record => record.region === 'South Asia').length;
    assert.equal(await page.locator('[data-record]').count(), regionCount);
    await page.locator('#reset').click();
    await page.locator('#era').selectOption('contemporary');
    assert.equal(await page.locator('[data-record]').count(), monuments.filter(record => record.startYear <= 2026 && record.endYear >= 2001).length);
    await page.locator('#reset').click();
    checks.push(`${viewport.width}: accent-insensitive search, sources, Escape, empty state, region and overlapping period filters`);
    await page.goto(`${base}index.html#content`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' }); // Exercise an initial fragment, not only same-document hash navigation.
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    assert.equal(await page.locator('[data-record]').count(), monuments.length);
    checks.push(`${viewport.width}: initial skip-anchor URL renders the catalog`);
    await page.goto(`${base}index.html#monument/${monuments[0].id}`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#record-dialog[open]').waitFor();
    assert.equal(await page.locator('#record-title').textContent(), monuments[0].name);
    await page.locator('#close-dialog').click();
    await page.waitForURL(url => !url.hash.startsWith('#monument/'));
    await page.locator('[data-view="samples"]').click();
    await page.locator('[data-view="samples"][aria-current="page"]').waitFor();
    await page.locator('.skip').focus();
    await page.evaluate(() => {
      window.__architectureSkipRouteComplete = false;
      window.addEventListener('hashchange', () => { window.__architectureSkipRouteComplete = true; }, { once: true });
    });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__architectureSkipRouteComplete === true);
    assert.equal(await page.locator('[data-view="samples"]').getAttribute('aria-current'), 'page');
    checks.push(`${viewport.width}: keyboard skip link preserves the selected section`);
    for (const format of ['blend', 'glb']) {
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator(`.sample-card a[href$=".${format}"]`).first().click()]);
      const bytes = fs.readFileSync(await download.path());
      const expected = fs.readFileSync(path.join(source, samples[0].files[format]));
      const digest = data => createHash('sha256').update(data).digest('hex');
      assert.equal(digest(bytes), digest(expected));
    }
    checks.push(`${viewport.width}: direct record link and exact Blender/GLB download bytes`);
    assert.deepEqual(errors, []); assert.deepEqual(failed, []); assert.deepEqual(remote, []);
    await context.close();
  }
  const failedContext = await browser.newContext();
  const failedPage = await failedContext.newPage();
  activePage = failedPage;
  await failedPage.route('**/data/monuments.json', route => route.fulfill({ status: 503, body: '{}' }));
  await failedPage.goto(`${base}index.html`);
  await failedPage.getByRole('alert').waitFor();
  assert.match(await failedPage.getByRole('alert').textContent(), /reference files did not load/);
  checks.push('Failed catalog fetch presents a readable recovery state');
  await failedContext.close();
  const receipt = { schemaVersion: 1, status: 'passed', checks, screenshots, checkedAt: new Date().toISOString(),
    data: 'Public architecture library only; no private workspace, external service or paid provider calls.' };
  fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    const state = await activePage.evaluate(() => ({
      url: location.href, ready: document.documentElement.dataset.ready,
      selectedView: document.querySelector('[data-view][aria-current="page"]')?.getAttribute('data-view'),
      query: document.querySelector('#search')?.value,
      region: document.querySelector('#region')?.value,
      category: document.querySelector('#category')?.value,
      era: document.querySelector('#era')?.value,
      summary: document.querySelector('#result-summary')?.textContent,
      recordCount: document.querySelectorAll('[data-record]').length,
      sampleCount: document.querySelectorAll('[data-sample]').length,
      error: document.querySelector('[role="alert"]')?.textContent,
    })).catch(() => ({ unavailable: true }));
    await activePage.screenshot({ path: path.join(evidence, 'failure.png') }).catch(() => {});
    fs.writeFileSync(path.join(evidence, 'failure.json'), JSON.stringify({ message: error.message, checks, state }, null, 2) + '\n');
  }
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
