#!/usr/bin/env node
/** Real browser acceptance of the generated public research atlas.
 * No browser fallback, mock-DOM substitution, or silent skip counts as a pass. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(process.env.RESEARCH_MEMORY_SOURCE || path.join(root, 'docs/research-memory'));
const out = path.join(root, 'site-source/.work/research-memory-ui');
fs.mkdirSync(out, { recursive: true });
const require = createRequire(path.join(root, 'site-source/package.json'));
const { chromium } = require('playwright');
const atlasBytes = fs.readFileSync(path.join(source, 'atlas.json'));
const atlas = JSON.parse(atlasBytes);
const catalogue = node => node.type?.startsWith('catalogue-') || node.type !== 'concept' && /catalogu|metadata|unreviewed|not[ _-]individually[ _-]reviewed/.test([node.status, node.audit_status, node.review_status].join(' ').toLowerCase());
const catalogueCount = atlas.nodes.filter(catalogue).length;
const manuscriptCount = atlas.nodes.filter(node => node.type === 'catalogue-paper').length;
const catalogueMarker = manuscriptCount ? manuscriptCount + ' catalogue-only manuscripts' : catalogueCount + ' catalogue-only records';
const checks = [], screenshots = [];
const mount = '/engineering-intelligence-atlas/research-memory/';
const mime = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.zip': 'application/zip', '.graphml': 'application/xml', '.woff2': 'font/woff2' };
const server = createServer((request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith(mount)) { response.writeHead(404).end(); return; }
    const file = path.resolve(source, decodeURIComponent(pathname.slice(mount.length)) || 'index.html');
    if (!file.startsWith(source + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'content-length': fs.statSync(file).size, 'cache-control': 'no-store' });
    if (request.method === 'HEAD') response.end(); else fs.createReadStream(file).pipe(response);
  } catch { response.writeHead(400).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${mount}`;
let browser, page;
async function ready(target) { await target.waitForFunction(() => document.documentElement.dataset.ready === 'true'); }
async function settleSearch(target, value) {
  await target.locator('#search').fill(value);
  // Exercise the explicit form action to avoid a timing-dependent debounce assertion.
  if (!value) { await target.locator('#linked-search').click(); await target.waitForFunction(() => document.querySelector('#retrieval-note').hidden); }
}
try {
  for (const file of ['index.html', 'atlas.css', 'app.mjs', 'graph-core.mjs', 'atlas.json', 'study-guide.html', 'formula-notebook.html', 'ai-mathematics.html']) assert.ok(fs.statSync(path.join(source, file)).isFile(), `Missing linked output: ${file}`);
  browser = await chromium.launch({ headless: true, ...(process.env.RESEARCH_MEMORY_CHROMIUM_EXECUTABLE ? { executablePath: process.env.RESEARCH_MEMORY_CHROMIUM_EXECUTABLE } : {}) });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1040 : 844 }, reducedMotion: 'reduce' });
    page = await context.newPage(); const errors = [], externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(base) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) externalRequests.push(request.url()); });
    await page.goto(base, { waitUntil: 'networkidle' }); await ready(page);
    assert.equal(await page.locator('#domain-select').inputValue(), 'memory');
    const initial = await page.locator('.graph-node').count(); assert.ok(initial > 0 && initial <= 80);
    const initialEdges = await page.locator('.graph-edge').count();
    const skip = page.locator('.skip-link');
    assert.equal(await skip.evaluate(node => getComputedStyle(node).opacity), '0');
    await skip.focus(); assert.equal(await skip.evaluate(node => getComputedStyle(node).opacity), '1');
    await page.locator('#search').focus(); assert.equal(await skip.evaluate(node => getComputedStyle(node).opacity), '0');
    assert.equal(await page.locator('.graph-node.catalogue').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    if (catalogueCount) { assert.ok((await page.locator('#results-count').textContent()).includes(catalogueMarker)); assert.match(await page.locator('#results-count').textContent(), /excluded/); }
    const target = page.locator('.graph-node').nth(Math.min(1, initial - 1));
    const id = await target.getAttribute('data-node'); await target.locator('.node-dot').click();
    assert.equal(await page.locator('#selection-label').textContent(), atlas.nodes.find(node => node.id === id).label);
    await page.mouse.move(0, 0);
    const labels = await page.evaluate(() => {
      const frame = document.querySelector('#graph-svg').getBoundingClientRect();
      const selected = document.querySelector('.graph-node.selected .node-label'), rect = selected.getBoundingClientRect(), matrix = selected.getScreenCTM();
      return { visible: [...document.querySelectorAll('.node-label')].filter(node => Number(getComputedStyle(node).opacity) > 0).length,
        fontPixels: parseFloat(getComputedStyle(selected).fontSize) * Math.hypot(matrix.a, matrix.b),
        left: rect.left - frame.left, right: frame.right - rect.right, top: rect.top - frame.top };
    });
    assert.equal(labels.visible, 1, `${width}: dense labels must not overlap at rest`);
    assert.ok(labels.fontPixels >= 13.5, `${width}: selected label must remain readable on screen`);
    assert.ok(labels.left >= -1 && labels.right >= -1 && labels.top >= -1, `${width}: selected label must remain within the graph frame`);
    assert.equal(await page.locator('.graph-node').count(), initial); assert.equal(await page.locator('.graph-edge').count(), initialEdges);
    await page.screenshot({ path: path.join(out, `memory-${width}.png`), fullPage: width !== 1440 }); screenshots.push(`memory-${width}.png`);
    checks.push(`${width}: local dataset, bounded graph, catalogue separation, real node selection, readable inspector and no horizontal overflow`);
    checks.push(`${width}: decluttered active label at readable screen size; all nodes/edges retained; skip link appears only on focus`);
    if (width === 1440) {
      await page.locator('#zoom-in').click(); assert.notEqual(await page.locator('#zoom-value').textContent(), '100%');
      await page.locator('#fit-view').click(); assert.equal(await page.locator('#zoom-value').textContent(), '100%');
      await page.locator('#graph-svg').focus(); await page.keyboard.press('ArrowRight');
      assert.notEqual(await page.locator('#graph-world').getAttribute('transform'), 'translate(0 0) scale(1)');
      await page.keyboard.press('0'); assert.equal(await page.locator('#graph-world').getAttribute('transform'), 'translate(0 0) scale(1)');
      await page.locator('#search').fill('PageRank'); await page.locator('#linked-search').click();
      await page.locator('#retrieval-note').waitFor(); assert.match(await page.locator('#retrieval-note').textContent(), /score is not confidence/);
      assert.ok(await page.locator('.graph-node').count() > 0);
      await settleSearch(page, ''); await page.locator('#domain-select').selectOption('all'); await page.locator('#node-cap').selectOption('40');
      assert.ok(await page.locator('.graph-node').count() <= 40); assert.match(await page.locator('#results-count').textContent(), /Showing 1–40/);
      await page.locator('#tab-list').click(); assert.equal(await page.locator('#node-list .node-choice').count(), 40);
      const choice = page.locator('#node-list .node-choice').nth(1), choiceId = await choice.getAttribute('data-node');
      await choice.focus(); await page.keyboard.press('Enter'); assert.equal(await page.locator('#selection-label').textContent(), atlas.nodes.find(node => node.id === choiceId).label);
      if (catalogueCount) {
        await page.locator('#domain-select').selectOption('ai-mathematics'); await page.locator('#catalogue-toggle').check();
        assert.ok((await page.locator('#results-count').textContent()).includes(catalogueMarker)); assert.match(await page.locator('#results-count').textContent(), /in full atlas; view cap 40/);
        const paper = page.locator('.node-choice').filter({ has: page.locator('.status-badge.catalogue') }).first(); await paper.click();
        assert.match(await page.locator('#details-content').textContent(), /does not mean the proof was read/);
        await page.screenshot({ path: path.join(out, 'catalogue-status-1440.png') }); screenshots.push('catalogue-status-1440.png');
        if (catalogueCount > 40) { await page.locator('#next-page').click(); assert.match(await page.locator('#page-description').textContent(), /Page 2 of/); }
      }
      await page.locator('#reset-filters').click(); await page.locator('#tab-graph').click();
      await page.locator('#explore-neighborhood').click(); assert.equal(await page.locator('#view-kicker').textContent(), 'Two-hop neighborhood');
      await page.locator('#clear-focus').click(); await page.locator('#reset-filters').click();
      await page.locator('#tab-formulas').click(); assert.ok(await page.locator('.formula-card').count() > 0);
      assert.match(await page.locator('#formula-list').textContent(), /Assumptions/); assert.match(await page.locator('#formula-list').textContent(), /Worked example/);
      assert.ok(await page.locator('#formula-list .source-link').count() > 0);
      if (atlas.formulas.some(formula => formula.domain === 'memory' && formula.mathml)) assert.ok(await page.locator('#formula-list math').count() > 0, 'Native MathML should render safe local formula markup');
      await page.screenshot({ path: path.join(out, 'formula-evidence-1440.png') }); screenshots.push('formula-evidence-1440.png');
      await page.locator('#tab-sources').click(); assert.ok(await page.locator('.source-card').count() > 0);
      assert.equal(await page.locator('#source-list a').evaluateAll(links => links.every(link => link.protocol === 'https:' && link.rel.includes('noopener'))), true);
      await page.locator('#tab-graph').click(); await context.setOffline(true); await page.locator('#domain-select').selectOption('electrostatics');
      assert.ok(await page.locator('.graph-node').count() > 0); await context.setOffline(false);
      checks.push('Actual controls: graph zoom/pan/fit, linked retrieval, field/type-independent views, 40-node cap, keyboard list, catalogue pagination, neighborhood, formula provenance, safe source links and offline interaction after load');
      for (const href of ['./study-guide.html', './formula-notebook.html', './ai-mathematics.html', './graphs/memory.graphml', './atlas.json']) {
        const response = await context.request.head(new URL(href, base).href); assert.ok(response.ok(), `Broken document/export link: ${href}`);
      }
      checks.push('Published study documents, typed field GraphML and native JSON brain snapshot are downloadable');
    }
    assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
    await context.close(); page = undefined;
  }

  const malicious = structuredClone(atlas), memory = malicious.nodes.find(node => node.domain === 'memory' && !catalogue(node));
  memory.label = 'A literal <img src=x onerror=window.__atlasInjected=1>'; memory.summary = '<script>window.__atlasInjected=1</script> is inert source text.';
  const formula = malicious.formulas.find(item => item.domain === 'memory');
  formula.label = 'A unsafe markup fallback'; formula.mathml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><annotation-xml encoding="text/html"><script>window.__atlasInjected=1</script></annotation-xml></math>';
  const hostile = await browser.newContext(); page = await hostile.newPage();
  await page.route('**/atlas.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(malicious) }));
  await page.goto(base + '#node=' + encodeURIComponent(memory.id)); await ready(page); assert.equal(await page.locator('#selection-label').textContent(), memory.label);
  assert.equal(await page.locator('img').count(), 0); assert.equal(await page.evaluate(() => window.__atlasInjected), undefined);
  await page.locator('#tab-formulas').click(); const unsafe = page.locator('.formula-card').filter({ hasText: 'A unsafe markup fallback' });
  assert.equal(await unsafe.locator('math').count(), 0); assert.ok(await unsafe.locator('pre.equation').count() > 0); assert.equal(await page.evaluate(() => window.__atlasInjected), undefined);
  checks.push('HTML-looking source text remains literal; unsupported MathML falls back to selectable TeX without script execution');
  await hostile.close(); page = undefined;

  const recovery = await browser.newContext(); page = await recovery.newPage();
  await page.route('**/atlas.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto(base); await page.locator('#load-error').waitFor(); assert.equal(await page.locator('.graph-node').count(), 0);
  await page.unroute('**/atlas.json'); await page.locator('#retry-load').click(); await ready(page);
  checks.push('Dataset failure is visible and retry loads the actual dataset');
  await recovery.close(); page = undefined;

  const privateContext = await browser.newContext(); page = await privateContext.newPage();
  const privateGraph = { schemaVersion: 1, revision: 'synthetic-private', nodes: [{ id: 'private', label: 'PRIVATE FIXTURE', type: 'concept', domain: 'memory', scope: 'client-private', summary: 'Synthetic private-scope fixture', source_ids: [] }], edges: [], sources: [], formulas: [] };
  await page.route('**/atlas.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(privateGraph) }));
  await page.goto(base); await page.locator('#load-error').waitFor(); assert.equal(await page.locator('.graph-node').count(), 0); assert.ok(!(await page.locator('#details-content').textContent()).includes('PRIVATE FIXTURE'));
  checks.push('Public explorer rejects a nonpublic scope before rendering its records');
  await privateContext.close(); page = undefined;
  const receipt = { schemaVersion: 1, status: 'passed', checkedAtUtc: new Date().toISOString(), browserVersion: browser.version(), source, datasetSha256: createHash('sha256').update(atlasBytes).digest('hex'), revision: atlas.revision, checks, screenshots, limits: 'Real local Chromium functional acceptance. Offline interaction after load is covered; offline installation/reload, target-device performance and independent proof verification are separate.' };
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ status: 'failed-or-environment-blocked', message: error.message, source, checksCompleted: checks }, null, 2) + '\n');
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
