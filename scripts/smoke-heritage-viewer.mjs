#!/usr/bin/env node
/** Real Chromium/WebGL acceptance. Run in the GitHub CI browser environment. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'site-source/package.json'));
const { chromium } = require('playwright');
const source = process.env.HERITAGE_LIBRARY_SOURCE ? path.resolve(process.env.HERITAGE_LIBRARY_SOURCE) : path.join(root, 'docs/architecture-library');
const catalog = JSON.parse(fs.readFileSync(path.join(source, 'site-models/catalog.json'), 'utf8'));
const out = path.join(root, 'site-source/.work/heritage-ui'); fs.mkdirSync(out, { recursive: true });
const mount = '/engineering-intelligence-atlas/architecture-library/';
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' };
let modelFault;
const stalledResponses = new Set();
const server = createServer((request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith(mount)) { response.writeHead(404).end(); return; }
    const file = path.resolve(source, decodeURIComponent(pathname.slice(mount.length)) || 'index.html');
    if (!file.startsWith(source + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
    if (modelFault?.file === file) {
      const fault = modelFault; modelFault = undefined;
      stalledResponses.add(response);
      const closed = new Promise(resolve => response.once('close', () => { stalledResponses.delete(response); resolve(); }));
      if (fault.mode === 'body') {
        response.writeHead(200, { 'content-type': 'model/gltf-binary', 'content-length': fs.statSync(file).size });
        response.write(fs.readFileSync(file).subarray(0, 64));
      }
      fault.started({ response, closed }); return;
    }
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'content-length': fs.statSync(file).size });
    fs.createReadStream(file).pipe(response);
  } catch { response.writeHead(400).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${mount}`;
let browser, currentPage; const checks = [], screenshots = [], modelRuns = [];
try {
  browser = await chromium.launch({ headless: true, ...(process.env.HERITAGE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.HERITAGE_CHROMIUM_EXECUTABLE } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 }, reducedMotion: 'reduce', acceptDownloads: true });
    const page = await context.newPage(); currentPage = page;
    const errors = [], remote = [], downloads = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (!request.url().startsWith(base) && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) remote.push(request.url());
      if (request.url().endsWith('.glb')) downloads.push(request.url());
    });
    await page.goto(`${base}site-models/index.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    assert.equal(await page.locator('[data-asset]').count(), catalog.assets.length);
    assert.equal(downloads.length, 0, 'Initial page must not fetch heavy geometry');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.locator('#viewer-preview').evaluate(img => img.decode());
    await page.screenshot({ path: path.join(out, `collection-${width}.png`), fullPage: false }); screenshots.push(`collection-${width}.png`);
    checks.push(`${width}: populated catalog, actual preview, no automatic GLB fetch, no horizontal overflow`);
    const assets = width === 1440 ? catalog.assets : [catalog.assets.find(asset => asset.id === 'khufu')];
    for (const asset of assets) {
      await page.locator(`[data-asset="${asset.id}"]`).click();
      assert.equal(await page.locator('#record-title').textContent(), asset.name);
      assert.match(await page.locator('#record').textContent(), /Unverified/);
      const start = Date.now(); await page.locator('#load-model').click();
      await page.waitForFunction(id => document.querySelector('#viewport').dataset.loadedAsset === id, asset.id, { timeout: 120000 });
      assert.equal(await page.locator('#viewport canvas').count(), 1);
      assert.match(await page.locator('#viewer-status').textContent(), /source hash verified/);
      modelRuns.push({ id: asset.id, width, downloadVerifyDecodeRenderWallMs: Date.now() - start, renderer: 'Chromium SwiftShader; functional rendering, not target-device FPS' });
      await page.locator('[data-action="left"]').click(); await page.locator('[data-action="in"]').click();
      await page.locator('#surface-mode').selectOption('neutral');
      if (width === 1440 || asset.id === 'khufu') {
        const filename = `${asset.id}-geometry-${width}.png`;
        await page.screenshot({ path: path.join(out, filename) }); screenshots.push(filename);
      }
      await page.locator('#surface-mode').selectOption('source');
      await page.locator('#viewport').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Home');
      const filename = `${asset.id}-source-${width}.png`;
      await page.screenshot({ path: path.join(out, filename) }); screenshots.push(filename);
      await page.locator('#unload-model').click();
      assert.equal(await page.locator('#viewport canvas').count(), 0);
      assert.equal(await page.locator('#viewer-preview').isVisible(), true);
      checks.push(`${width}/${asset.id}: SHA, decoded triangle count, WebGL render, neutral mode, orbit/zoom/keyboard, disposal`);
    }
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await context.close();
  }
  const context = await browser.newContext(); const page = await context.newPage(); currentPage = page;
  const first = catalog.assets[0];
  await page.route('**/assets/*.glb', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto(`${base}site-models/index.html#${first.id}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  await page.locator('#load-model').click();
  await page.getByRole('button', { name: 'Retry 3D model' }).waitFor();
  assert.match(await page.locator('#viewer-status').textContent(), /download failed/);
  assert.equal(await page.locator('#viewer-preview').isVisible(), true);
  checks.push('Failed model fetch keeps source record and preview, and offers retry');
  await page.unroute('**/assets/*.glb');
  const original = fs.readFileSync(path.join(source, 'site-models', first.file)), corrupted = Buffer.from(original); corrupted[corrupted.length - 1] ^= 1;
  await page.route('**/assets/*.glb', route => route.fulfill({ status: 200, body: corrupted, contentType: 'model/gltf-binary' }));
  await page.locator('#load-model').click(); await page.getByRole('button', { name: 'Retry 3D model' }).waitFor();
  assert.match(await page.locator('#viewer-status').textContent(), /integrity check failed/);
  assert.equal(await page.locator('#viewport canvas').count(), 0);
  checks.push('Same-size corrupted model rejected before WebGL import');
  await context.close();
  const recovery = await browser.newContext(); const recoveryPage = await recovery.newPage(); currentPage = recoveryPage;
  await recoveryPage.clock.install();
  const retryAsset = catalog.assets.find(asset => asset.id === 'khufu');
  await recoveryPage.goto(`${base}site-models/index.html#${retryAsset.id}`);
  await recoveryPage.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  const stallNext = mode => new Promise(started => { modelFault = { file: path.join(source, 'site-models', retryAsset.file), mode, started }; });
  for (const mode of ['headers', 'body']) {
    const stalled = stallNext(mode);
    const aborted = recoveryPage.waitForEvent('requestfailed', { predicate: request => request.url().endsWith(retryAsset.file) });
    await recoveryPage.locator('#load-model').click(); const pending = await stalled;
    assert.equal(await recoveryPage.getByRole('button', { name: 'Cancel loading' }).isEnabled(), true);
    await recoveryPage.clock.fastForward(120001);
    await recoveryPage.getByRole('button', { name: 'Retry 3D model' }).waitFor();
    await aborted; await pending.closed;
    assert.match(await recoveryPage.locator('#viewer-status').textContent(), /download timed out after 120 seconds/);
    assert.equal(await recoveryPage.locator('#viewer-preview').isVisible(), true);
    assert.equal(await recoveryPage.locator('#viewport canvas').count(), 0);
    assert.equal(await recoveryPage.locator('#unload-model').isEnabled(), false);
    checks.push(`Stalled ${mode} request aborts at the 120-second download deadline and offers retry`);
  }
  const stalled = stallNext('body');
  const aborted = recoveryPage.waitForEvent('requestfailed', { predicate: request => request.url().endsWith(retryAsset.file) });
  await recoveryPage.locator('#load-model').click(); const pending = await stalled;
  await recoveryPage.getByRole('button', { name: 'Cancel loading' }).click();
  await aborted; await pending.closed;
  assert.match(await recoveryPage.locator('#viewer-status').textContent(), /Loading cancelled/);
  assert.equal(await recoveryPage.locator('#viewer-preview').isVisible(), true);
  assert.equal(await recoveryPage.locator('#load-model').isEnabled(), true);
  assert.equal(await recoveryPage.locator('#viewport canvas').count(), 0);
  // Loading a different model after cancellation must not be affected by the old request.
  await recoveryPage.locator('[data-asset="khafre"]').click();
  await recoveryPage.locator('#load-model').click();
  await recoveryPage.waitForFunction(() => document.querySelector('#viewport').dataset.loadedAsset === 'khafre', null, { timeout: 120000 });
  assert.match(await recoveryPage.locator('#viewer-status').textContent(), /Khafre.*source hash verified/);
  assert.equal(await recoveryPage.locator('#viewport canvas').count(), 1);
  await recoveryPage.locator('#unload-model').click();
  checks.push('Cancel during a stalled body aborts immediately; a different model then loads successfully without stale state');
  const decoderCancellation = await recoveryPage.evaluate(async ({ asset, base }) => {
    const { createViewer } = await import(`${base}site-models/viewer.mjs`);
    const { MeshoptDecoder } = await import(`${base}site-models/vendor/meshopt_decoder.mjs`);
    await MeshoptDecoder.ready;
    const buffer = await (await fetch(`${base}site-models/${asset.file}`)).arrayBuffer();
    const controller = new AbortController(); const messages = [];
    const pending = createViewer(document.querySelector('#viewport'), buffer, asset, message => messages.push(message), controller.signal);
    queueMicrotask(() => controller.abort());
    let error;
    try { const result = await pending; result.dispose(); } catch (cause) { error = cause.name; }
    return { error, canvases: document.querySelectorAll('#viewport canvas').length, messages };
  }, { asset: retryAsset, base });
  assert.equal(decoderCancellation.error, 'AbortError'); assert.equal(decoderCancellation.canvases, 0);
  checks.push('Cancellation during asynchronous viewer creation disposes resources before any canvas is attached');
  await recovery.close();
  const failure = await browser.newContext(); const failedPage = await failure.newPage(); currentPage = failedPage;
  await failedPage.route('**/catalog.json', route => route.fulfill({ status: 503, body: '{}' }));
  await failedPage.goto(`${base}site-models/index.html`); await failedPage.getByRole('alert').waitFor();
  checks.push('Catalog failure produces readable recovery instructions'); await failure.close();
  const receipt = { schemaVersion: 1, status: 'passed', checkedAtUtc: new Date().toISOString(), browserVersion: browser.version(), source, checks, screenshots, modelRuns,
    limits: 'Functional CI rendering and import only. No measured physical accuracy, GPU target-device performance, Unreal or live VPS claim.' };
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ message: error.message, state: await currentPage.evaluate(() => ({ ready: document.documentElement.dataset.ready, status: document.querySelector('#viewer-status')?.textContent, title: document.querySelector('#record-title')?.textContent })) }, null, 2));
    await currentPage.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  for (const response of stalledResponses) response.destroy();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
