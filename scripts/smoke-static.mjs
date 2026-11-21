#!/usr/bin/env node
/** Real-browser regression for Pages subpaths and the portable offline atlas. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { repoRoot, webRoot } from './static-build-lib.mjs';

const require = createRequire(join(webRoot, 'package.json'));
const { chromium } = require('playwright');
const root = join(repoRoot, 'docs');
const screenshotRoot = join(webRoot, '.work', 'ui-screenshots');
mkdirSync(screenshotRoot, { recursive: true });
const screenshots = [];
const mount = '/engineering-intelligence-atlas/';
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
};
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (!pathname.startsWith(mount)) { response.writeHead(404).end(); return; }
  const file = resolve(root, decodeURIComponent(pathname.slice(mount.length)) || 'index.html');
  if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end(); return;
  }
  response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
  response.end(readFileSync(file));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}${mount}`;
let browser;
try {
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  const routes = ['workspace', 'roadmap', 'overview', 'roles', 'library', 'jobs', 'reverse', 'research', 'science', 'methodology', 'director'];
  let checked = 0;
  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().startsWith(base) && response.status() >= 400) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });
    for (const route of routes) {
      await page.goto(`${base}#/${route}`, { waitUntil: 'networkidle' });
      await page.locator('main h1, main h2').first().waitFor({ state: 'visible' });
      const dimensions = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, expected: innerWidth }));
      assert(dimensions.actual <= dimensions.expected + 1, `${route}/${viewport.width}: horizontal overflow ${dimensions.actual}`);
      assert.deepEqual(errors, [], `${route}/${viewport.width}: browser errors`);
      const filename = `web-${route}-${viewport.width}.png`;
      await page.screenshot({ path: join(screenshotRoot, filename), fullPage: false });
      screenshots.push({ file: filename, surface: 'web', route, width: viewport.width });
      checked += 1;
    }
    // Wait for the worker, then an online controlled navigation populates the
    // document cache. The offline reload tests that HTML and assets really load.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'networkidle' });
    await context.setOffline(true);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('main h1, main h2').first().waitFor({ state: 'visible' });
    assert.deepEqual(errors, [], `offline/${viewport.width}: browser errors`);
    checked += 1;
    await context.close();
  }
  // Same renderer as the packaged app, using an isolated, explicitly labeled
  // public starter snapshot. No private portfolio or credentials enter captures.
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}desktop-preview/chrome.html`, { waitUntil: 'networkidle' });
    await page.locator('#office-native-status').filter({ hasNotText: 'Checking' }).waitFor({ state: 'visible' });
    const capture = async (route, surface = 'desktop', fullPage = false) => {
      const dimensions = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, expected: innerWidth }));
      const filename = `${surface}-${route}-${viewport.width}.png`;
      await page.screenshot({ path: join(screenshotRoot, filename), fullPage });
      screenshots.push({ file: filename, surface, route, width: viewport.width });
      if (dimensions.actual > dimensions.expected + 1) {
        const outside = await page.locator('body *').evaluateAll(nodes => nodes.filter(node => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.right > innerWidth + 1 && getComputedStyle(node).visibility !== 'hidden';
        }).slice(-12).map(node => ({tag: node.tagName, id: node.id, className: node.getAttribute('class'), right: Math.round(node.getBoundingClientRect().right), width: Math.round(node.getBoundingClientRect().width)})));
        assert.fail(`${surface}/${route}/${viewport.width}: horizontal overflow ${dimensions.actual}; ${JSON.stringify(outside)}`);
      }
      assert.deepEqual(errors, [], `${surface}/${route}/${viewport.width}: page errors`);
      checked++;
    };
    const views = await page.locator('.sidebar .nav-item[data-view]').evaluateAll(nodes => nodes.map(node => node.dataset.view));
    for (const view of [...new Set(views)]) {
      await page.locator(`.sidebar .nav-item[data-view="${view}"]`).first().click();
      await page.locator('#workspace-main > .view:not(.hidden) h1').first().waitFor({ state: 'visible' });
      await capture(view);
    }
    await page.locator('.sidebar .nav-item[data-view="office"]').click();
    const tabs = await page.locator('[data-workspace-tab]').evaluateAll(nodes => nodes.map(node => node.dataset.workspaceTab));
    for (const tab of tabs) {
      await page.locator(`[data-workspace-tab="${tab}"]`).click();
      await capture(tab, 'workspace', true);
    }
    // Inspect every operating surface, including the disclosures below the
    // primary workspace and the portfolio view above company scope.
    await page.locator('#ceo-toggle').click();
    await page.locator('#ceo-panel').waitFor({ state: 'visible' });
    await capture('portfolio', 'ceo', true);
    await page.locator('#ceo-toggle').click();
    await page.locator('#workspace-policy > summary').click();
    await capture('budget-autonomy', 'workspace', true);
    await page.locator('#workspace-policy > summary').click();
    await page.locator('#office-tools > summary').click();
    const officeTabs = await page.locator('[data-office-tab]').evaluateAll(nodes => nodes.map(node => node.dataset.officeTab));
    for (const tab of officeTabs) {
      await page.locator(`[data-office-tab="${tab}"]`).click();
      await page.locator(`#office-panel-${tab}`).waitFor({ state: 'visible' });
      await capture(tab, 'office-tools', true);
    }
    await context.close();
  }
  writeFileSync(join(screenshotRoot, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), screenshots, checks: checked, data: 'Public isolated starter only; no private user data', limitations: 'Browser-rendered shell; native OS keychain and desktop window controls are not exercised.' }, null, 2) + '\n');
  console.log(`Static browser smoke passed: ${checked} route/reload checks, desktop + mobile, real Pages subpath, offline reload.`);
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
