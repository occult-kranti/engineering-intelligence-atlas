#!/usr/bin/env node
/** Real-browser regression for Pages subpaths and the portable offline atlas. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { repoRoot, webRoot } from './static-build-lib.mjs';
import { openCanvasSurface, assertEndlessShell, checkEndlessPanelInteractions, settleCanvas } from './endless-canvas-browser-checks.mjs';

const require = createRequire(join(webRoot, 'package.json'));
const { chromium } = require('playwright');
const root = join(repoRoot, 'docs');
const screenshotRoot = join(webRoot, '.work', 'ui-screenshots');
mkdirSync(screenshotRoot, { recursive: true });
const screenshots = [];
const interactionChecks = [];
const contrastChecks = [];
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
async function assertStudioContrast(page, viewport, theme) {
  // Measure actual canvas controls and the active surface. The legacy sidebar
  // is hidden by design and must not be made visible to satisfy this gate.
  await openCanvasSurface(page, 'workspace-blueprint');
  await page.locator('#workspace-panel-blueprint .canvas-toolbar > div > p:last-child').scrollIntoViewIfNeeded();
  const targets = [
    {name: 'surface finder', selector: '.canvas-launcher .canvas-find'},
    {name: 'active canvas title', selector: '.canvas-panel[data-panel-id="workspace-blueprint"] .canvas-panel-grip'},
    {name: 'save status', selector: '#workspace-save-status #workspace-save-label'},
    {name: 'blueprint description', selector: '#workspace-panel-blueprint .canvas-toolbar > div > p:last-child'},
  ];
  for (const target of targets) await page.locator(target.selector).waitFor({state: 'visible'});
  await page.mouse.move(0, 0); // Measure the resting state, without a prior hover.
  const results = await page.evaluate(targets => {
    const parse = value => {
      const match = value.match(/^rgba?\((.*)\)$/i);
      if (!match) throw new Error(`Unsupported computed color ${value}; this check expects flat sRGB colors.`);
      const parts = match[1].trim().split(/[\s,/]+/);
      if (parts.length < 3 || parts.length > 4) throw new Error(`Invalid computed color ${value}`);
      const channels = parts.slice(0, 3).map(part => parseFloat(part) / (part.endsWith('%') ? 100 : 255));
      const alpha = parts.length === 4 ? parseFloat(parts[3]) / (parts[3].endsWith('%') ? 100 : 1) : 1;
      const color = [...channels, alpha];
      if (!color.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 1)) throw new Error(`Invalid computed color ${value}`);
      return color;
    };
    const over = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return alpha === 0 ? [0, 0, 0, 0] : [0, 1, 2].map(index => (front[index] * front[3] + back[index] * back[3] * (1 - front[3])) / alpha).concat(alpha);
    };
    const luminance = color => color.slice(0, 3).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    return targets.map(target => {
      const element = document.querySelector(target.selector);
      if (!element || !element.textContent.trim() || !element.getClientRects().length || element.closest(':disabled,[aria-disabled="true"]')) throw new Error(`${target.name}: expected visible enabled text`);
      const ancestors = [];
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.visibility !== 'visible' || style.display === 'none' || Number(style.opacity) !== 1 || style.filter !== 'none' || style.mixBlendMode !== 'normal') throw new Error(`${target.name}: hidden text or unsupported group compositing`);
        ancestors.push(style);
      }
      let background = [0, 0, 0, 0];
      for (const style of ancestors) {
        if (style.backgroundImage !== 'none') throw new Error(`${target.name}: background imagery needs visual inspection, not a guessed flat contrast ratio`);
        background = over(background, parse(style.backgroundColor));
        if (background[3] >= 1) break;
      }
      if (background[3] < 1) throw new Error(`${target.name}: no opaque ancestor background was found`);
      const foreground = over(parse(ancestors[0].color), background);
      const light = luminance(foreground), dark = luminance(background);
      return {name: target.name, selector: target.selector, foreground, background, ratio: (Math.max(light, dark) + .05) / (Math.min(light, dark) + .05)};
    });
  }, targets);
  for (const result of results) {
    assert(result.ratio >= 4.5, `${theme}/${viewport.width}/${result.name}: enabled text contrast ${result.ratio.toFixed(3)} is below 4.5:1; ${JSON.stringify(result)}`);
    contrastChecks.push({theme, width: viewport.width, ...result});
  }
}
let browser;
try {
  // CI installs the Playwright-managed browser matched to this driver.
  const executablePath = process.env.CHROMIUM_PATH || undefined;
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
    page.on('request', request => {
      if (!['GET', 'HEAD'].includes(request.method())) errors.push(`Read-only preview attempted ${request.method()} ${request.url()}`);
    });
    await page.goto(`${base}desktop-preview/chrome.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(document.querySelector('#office-company-select')?.value));
    await assertEndlessShell(page, `Public starter ${viewport.width}`);
    assert.equal(await page.locator('#freeflow-host').count(), 1, 'Freeflow host must be mounted exactly once.');
    assert(await page.locator('#office-native-status').isHidden(), 'Legacy status must be hidden while Freeflow is the default surface.');
    interactionChecks.push(`Freeflow ${viewport.width}: one visible world on the default URL with a surface finder and no competing sidebar`);
    await openCanvasSurface(page, 'scope');
    await page.locator('#office-native-status').filter({ hasNotText: 'Checking' }).waitFor({ state: 'visible' });
    const capture = async (route, surface = 'desktop') => {
      // Let the application's transient status finish naturally; do not hide
      // notices or focused accessibility controls just to produce a capture.
      await page.locator('#global-status').waitFor({ state: 'hidden', timeout: 10000 });
      const dimensions = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, expected: innerWidth }));
      const filename = `${surface}-${route}-${viewport.width}.png`;
      await page.screenshot({ path: join(screenshotRoot, filename), fullPage: false });
      screenshots.push({ file: filename, surface, route, width: viewport.width });
      if (dimensions.actual > dimensions.expected + 1) {
        const outside = await page.locator('body *').evaluateAll(nodes => nodes.filter(node => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.right > innerWidth + 1 && getComputedStyle(node).visibility !== 'hidden';
        }).slice(-12).map(node => ({tag: node.tagName, id: node.id, className: node.getAttribute('class'), right: Math.round(node.getBoundingClientRect().right), width: Math.round(node.getBoundingClientRect().width)})));
        assert.fail(`${surface}/${route}/${viewport.width}: horizontal overflow ${dimensions.actual}; ${JSON.stringify(outside)}`);
      }
      assert.deepEqual(errors, [], `${surface}/${route}/${viewport.width}: page errors`);
      await assertEndlessShell(page, `${surface}/${route}/${viewport.width}`);
      checked++;
    };
    const panels = await page.locator('.canvas-panel[data-panel-id]').evaluateAll(nodes => nodes.map(node => node.dataset.panelId));
    assert.equal(new Set(panels).size, panels.length, 'Every canvas surface must have one identity.');
    for (const required of ['donna', 'crew', 'scope', 'policy', 'portfolio', 'workspace-blueprint', 'office-people', 'office-queue', 'office-ledger', 'models', 'settings', 'source-review']) {
      assert(panels.includes(required), `Canvas is missing the ${required} surface.`);
    }
    for (const id of panels) {
      await openCanvasSurface(page, id);
      await capture(id, 'canvas');
      if (id === 'workspace-blueprint' && viewport.width < 650) {
        const layout = await page.locator('#office-blueprint').evaluate(canvas => {
          const style = getComputedStyle(canvas);
          const scale = canvas.getBoundingClientRect().width / canvas.offsetWidth;
          return {list: canvas.classList.contains('list-mode'), scale, track: (canvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) * scale, rooms: [...canvas.querySelectorAll('.blueprint-room')].map(room => ({width: room.getBoundingClientRect().width, height: room.getBoundingClientRect().height}))};
        });
        assert(layout.list && layout.rooms.length > 0 && Number.isFinite(layout.scale) && layout.scale > 0, 'Narrow blueprint must expose a populated list alternative at a finite canvas scale.');
        for (const room of layout.rooms) {
          assert(room.width >= layout.track - 2, `Narrow blueprint room must fill its list track: ${JSON.stringify(layout)}`);
          assert(room.height < 400 * layout.scale, `Starter list room retains excessive spatial height: ${JSON.stringify(layout)}`);
        }
      }
    }
    // Appearance and heat are local viewing preferences. A scoped deep link
    // must survive reload without changing the company or granting writes.
    await openCanvasSurface(page, 'workspace-blueprint');
    const companyId = await page.locator('#office-company-select').inputValue();
    assert.ok(companyId, 'The public starter must expose its selected company.');
    await page.waitForFunction(() => typeof window.DaftarSignals?.build === 'function');
    const darkCanvas = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim());
    assert.ok(darkCanvas, 'The built preview must load studio palette tokens.');
    if (viewport.width === 1440) await assertStudioContrast(page, viewport, 'blueprint');
    await openCanvasSurface(page, 'scope');
    await page.locator('#workspace-theme').selectOption('drafting');
    const lightCanvas = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim());
    assert.notEqual(lightCanvas, darkCanvas, 'The appearance switch must change the rendered canvas.');
    await page.locator('#workspace-heat-mode').selectOption('budget');
    const scopedUrl = new URL(page.url());
    scopedUrl.searchParams.set('company', companyId);
    scopedUrl.searchParams.set('workspace', 'blueprint');
    scopedUrl.hash = '#office';
    await page.goto(scopedUrl.href, {waitUntil: 'networkidle'});
    await page.reload({waitUntil: 'networkidle'});
    await page.waitForFunction(id => document.querySelector('#office-company-select')?.value === id && document.querySelectorAll('#office-blueprint .blueprint-room').length > 0, companyId);
    assert.equal(await page.locator('#workspace-theme').inputValue(), 'drafting');
    assert.equal(await page.locator('#workspace-heat-mode').inputValue(), 'budget');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'drafting');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim()), lightCanvas);
    assert.equal(new URL(page.url()).searchParams.get('company'), companyId);
    if (viewport.width === 1440) await assertStudioContrast(page, viewport, 'drafting');
    interactionChecks.push(`Theme ${viewport.width}: distinct rendered palettes, persisted theme/heat and scoped company after navigation and reload`);

    await openCanvasSurface(page, 'scope');
    await page.locator('.heat-key > summary').click();
    for (const mode of ['workload', 'budget', 'attention']) {
      await page.locator('#workspace-heat-mode').selectOption(mode);
      assert.deepEqual(await page.locator('#workspace-heat-legend .heat-legend-row').evaluateAll(rows => rows.map(row => row.dataset.heatLevel)), ['0', '1', '2', '3', '4', 'unknown']);
      await page.locator('#workspace-heat-legend').getByText('Unknown / stale', {exact: true}).waitFor({state: 'visible'});
      const rooms = await page.locator('#office-blueprint .blueprint-room').evaluateAll(nodes => nodes.map(node => ({level: node.dataset.heatLevel, label: node.querySelector('.heat-reading')?.textContent})));
      assert(rooms.length > 0 && rooms.every(room => room.level === 'unknown' && room.label === 'No comparable data'), 'The public starter has no jobs: every room must state unknown, not zero activity.');
    }
    if (viewport.width === 1440) await capture('heat-legend-drafting', 'workspace');
    await page.locator('#workspace-heat-mode').selectOption('off');
    assert.match(await page.locator('#workspace-signal-summary').innerText(), /Heat map off/);
    assert.match(await page.locator('#workspace-heat-legend').innerText(), /Color overlay is off/);
    assert.equal(await page.locator('#office-blueprint .heat-reading').count(), 0);
    assert(await page.locator('#office-blueprint .blueprint-room').evaluateAll(nodes => nodes.every(node => node.dataset.heatLevel === 'off')));
    await page.locator('#workspace-heat-mode').selectOption('workload');
    await page.locator('.heat-key > summary').click();
    interactionChecks.push(`Heat ${viewport.width}: all three legends, no-record unknown labels and an explicit off state`);

    await openCanvasSurface(page, 'workspace-softboard');
    await page.getByRole('heading', {name: 'See the people behind the work.', exact: true}).waitFor({state: 'visible'});
    const peopleCount = await page.locator('#workspace-softboard .org-person').count();
    assert(peopleCount > 0, 'Ownership must show the saved public starter assignments.');
    await page.locator('#softboard-search').fill('no-matching-example-person');
    assert.equal(await page.locator('#workspace-softboard .org-person').count(), 0);
    await page.locator('#softboard-search').fill('');
    assert.equal(await page.locator('#workspace-softboard .org-person').count(), peopleCount);
    await page.locator('.org-person[data-employee-id="donna"]').click();
    assert.equal(await page.locator('#softboard-person-title').innerText(), 'Donna');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'softboard-person-title');
    assert.equal(await page.locator('#softboard-person-detail .inspector-signal[data-heat-level="unknown"]').count(), 3);
    await capture('ownership-drafting', 'workspace');
    await page.locator('#softboard-person-chat').click();
    assert.equal(await page.locator('#chat-scope').inputValue(), 'employee');
    assert.equal(await page.locator('#chat-employee').inputValue(), 'donna');
    assert.equal(await page.locator('#office-company-select').inputValue(), companyId);
    assert(await page.locator('#chat-send').isDisabled(), 'A viewing preference or employee selection must not enable writes in the public starter.');
    interactionChecks.push(`Ownership ${viewport.width}: saved people, search/clear, focused inspector and employee conversation handoff remain read only`);

    const panelInteractions = await checkEndlessPanelInteractions(page, `Public starter ${viewport.width}`);
    assert(await page.locator('#chat-send').isDisabled(), 'Canvas interactions must not enable public preview writes.');
    if (viewport.width === 1440) await capture('donna-canvas-drafting', 'workspace');
    interactionChecks.push(`Canvas ${viewport.width}: ${JSON.stringify(panelInteractions)}; no drafts submitted`);

    await openCanvasSurface(page, 'workspace-timeline');
    await page.getByRole('heading', {name: 'From intention to evidence.', exact: true}).waitFor({state: 'visible'});
    assert.deepEqual(await page.locator('#workspace-timeline .roadmap-lane').evaluateAll(nodes => nodes.map(node => node.dataset.stage)), ['planned', 'in-progress', 'blocked', 'done']);
    const outcomeCount = await page.locator('#workspace-timeline .studio-outcome').count();
    assert(outcomeCount > 0, 'The public roadmap must display its example outcomes.');
    assert(await page.locator('#workspace-timeline .outcome-person strong').evaluateAll(nodes => nodes.every(node => node.textContent.trim().length > 0)), 'Each saved outcome must expose its owner or the explicit owner-unavailable label.');
    await page.locator('#studio-roadmap-status').selectOption('blocked');
    assert.equal(await page.locator('#workspace-timeline .studio-outcome').count(), 0);
    await page.getByText('No saved outcomes in this stage.', {exact: true}).waitFor({state: 'visible'});
    await page.locator('#studio-roadmap-status').selectOption('all');
    assert.equal(await page.locator('#workspace-timeline .studio-outcome').count(), outcomeCount);
    assert.equal(await page.locator('#office-company-select').inputValue(), companyId);
    assert.equal(new URL(page.url()).searchParams.get('company'), companyId);
    interactionChecks.push(`Roadmap ${viewport.width}: four delivery lanes, recorded ownership, filtered empty state and unchanged company scope`);
    await openCanvasSurface(page, 'scope');
    await page.locator('#workspace-theme').selectOption('blueprint');
    // Management and budget disclosures remain real forms inside their panels.
    await openCanvasSurface(page, 'portfolio');
    await page.locator('#ceo-panel').waitFor({ state: 'visible' });
    await capture('portfolio', 'ceo');
    await page.locator('#ceo-authority-editor > summary').click();
    await page.locator('#authority-grant-form').waitFor({ state: 'visible' });
    assert(await page.locator('#authority-grant-submit').isDisabled(), 'Public management preview must remain read only.');
    assert(await page.locator('#authority-grants .authority-grant').count() > 0, 'Management preview should expose the synthetic timed grant history.');
    await capture('management', 'ceo');
    await page.locator('#authority-search').fill('Donna');
    assert(await page.locator('#authority-index .authority-index-row').count() > 0, 'Management directory should search saved employee names.');
    await page.locator('#authority-search').fill('no-matching-example-record');
    assert.equal(await page.locator('#authority-index .authority-index-row').count(), 0, 'Management search must not leave unrelated records visible.');
    await page.locator('#authority-search').fill('');
    await page.locator('#ceo-authority-editor > summary').click();
    await openCanvasSurface(page, 'policy');
    await page.locator('#workspace-policy > summary').click();
    await capture('budget-autonomy', 'workspace');
    await page.locator('#workspace-policy > summary').click();
    await context.close();
  }
  // A chat deep link must frame the actual composer in the first laptop viewport,
  // without a test-induced scroll or a second surface-opening action.
  for (const viewport of [{width:1280,height:720},{width:1024,height:768}]) for (const presentation of ['blueprint','drafting']) {
    const context=await browser.newContext({viewport,reducedMotion:'reduce'});
    await context.addInitScript(p=>{try{localStorage.setItem('daftar-studio-theme',p);}catch{}},presentation);
    const page=await context.newPage();
    await page.goto(`${base}desktop-preview/chrome.html?workspace=chat#office`,{waitUntil:'networkidle'});
    await page.waitForFunction(() => Boolean(document.querySelector('#office-company-select')?.value));
    await page.locator('.canvas-panel[data-panel-id="donna"][data-open="true"]').waitFor({state:'visible'});
    await page.locator('#chat-send').waitFor({state:'visible'});
    const actualTheme=await page.evaluate(()=>document.documentElement.getAttribute('data-theme'));
    assert(actualTheme===presentation,`Requested ${presentation} theme but DOM data-theme is ${actualTheme} at ${viewport.width}x${viewport.height}`);
    await page.evaluate(()=>document.fonts&&document.fonts.ready);
    await settleCanvas(page);
    await assertEndlessShell(page, `First brief ${presentation}/${viewport.width}`);
    const box=await page.locator('#chat-send').boundingBox();
    const filename=`workspace-first-brief-${presentation}-${viewport.width}.png`;
    // Retain the actual first viewport even when its acceptance check fails.
    // Reading geometry does not scroll, focus, or change the rendered layout.
    await page.screenshot({path:join(screenshotRoot,filename)});
    const layout=await page.evaluate(()=>({scroll:{x:scrollX,y:scrollY},elements:Object.fromEntries([
      ['topbar','.workspace-topbar'],['panel','.canvas-panel[data-panel-id="donna"]'],['titlebar','.canvas-panel[data-panel-id="donna"] .canvas-panel-titlebar'],
      ['panelBody','.canvas-panel[data-panel-id="donna"] .canvas-panel-body'],['launcher','.canvas-launcher'],['cameraControls','.ff-controls'],
      ['conversation','#donna-conversation'],['composer','#workspace-chat-form'],['composerContext','#workspace-chat-form .composer-context'],
      ['message','#chat-message'],['composerFooter','#workspace-chat-form .composer-footer'],
      ['send','#chat-send'],['freeflowSurface','#freeflow-surface'],['surfaceBar','.ff-surface-bar'],['heatControls','#ff-heat-controls'],
    ].map(([name,selector])=>{const node=document.querySelector(selector);if(!node)return[name,null];const rect=node.getBoundingClientRect(),style=getComputedStyle(node);return[name,{x:rect.x,y:rect.y,width:rect.width,height:rect.height,bottom:rect.bottom,display:style.display,visibility:style.visibility,opacity:style.opacity,overflow:style.overflow,gridColumns:style.gridTemplateColumns,rowGap:style.rowGap,padding:style.padding,margin:style.margin}];})),overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth,theme:document.documentElement.getAttribute('data-theme'),bodyClass:document.body.className}));
    writeFileSync(join(screenshotRoot,`workspace-first-brief-${presentation}-${viewport.width}.json`),JSON.stringify({presentation,viewport,sendButton:box,layout,completedContrastChecks:contrastChecks},null,2)+'\n');
    screenshots.push({file:filename,surface:'workspace',route:'first-brief',width:viewport.width,presentation});
    assert(layout.scroll.x===0&&layout.scroll.y===0&&!layout.overflowX,`No scroll or horizontal overflow expected at ${presentation}/${viewport.width}: ${JSON.stringify({scroll:layout.scroll,overflowX:layout.overflowX})}`);
    assert(box&&box.y>=0&&box.y+box.height<=viewport.height,`Donna composer must fit first laptop viewport ${viewport.width}: ${JSON.stringify(box)}`);
    assert(box&&box.width>=24&&box.height>=24,`Donna send target must remain at least 24px in each screen dimension at ${presentation}/${viewport.width}: ${JSON.stringify(box)}`);
    checked++;
    await context.close();
  }
  writeFileSync(join(screenshotRoot, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), screenshots, checks: checked, interactionChecks, contrastChecks, data: 'Public isolated starter only; no private user data', limitations: 'Browser-rendered shell; native OS keychain and desktop window controls are not exercised.' }, null, 2) + '\n');
  console.log(`Static browser smoke passed: ${checked} route/reload checks, ${interactionChecks.length} studio interaction groups, ${contrastChecks.length} rendered contrast checks, desktop + mobile, real Pages subpath, offline reload.`);
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
