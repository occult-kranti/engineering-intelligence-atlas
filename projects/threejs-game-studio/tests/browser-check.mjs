/** Real-browser checks for the original studio; no model or provider calls.
 * Use an existing Playwright installation through PLAYWRIGHT_MODULE.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile, mkdir, stat, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phase = process.env.STUDIO_TEST_PHASE || 'first-sweep';
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('Use a simple test phase name.');
const output = path.join(root, 'test-results', phase);
await mkdir(output, {recursive: true});
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const mime = {'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.md':'text/plain'};
const server = createServer(async (request, response) => {
  try {
    const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (route === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    const file = path.resolve(root, '.' + (route === '/' ? '/index.html' : route));
    if (!file.startsWith(root + path.sep)) throw new Error('Outside test fixture');
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    response.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const receipt = {phase,started_at:new Date().toISOString(),browser:null,model_inference:'not_run',network:'loopback static files only; external requests aborted',results:[],screenshots:[],errors:[]};
let browser;
try {
  browser = await chromium.launch({headless:true, executablePath, args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
} catch(error) {
  receipt.status = 'blocked_before_browser_checks';
  receipt.errors.push(String(error?.message || error).slice(0,2000));
  receipt.finished_at = new Date().toISOString();
  receipt.passed = 0;
  receipt.failed = 0;
  receipt.checks_executed = 0;
  await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  await new Promise(resolve=>server.close(resolve));
  console.log(JSON.stringify({status:receipt.status,checks_executed:0,receipt:path.join(output,'receipt.json')}));
  process.exit(2);
}
receipt.browser = await browser.version();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const layoutKey = 'daftar.3d-studio.layout.v1';

async function check(label, action) {
  const started = performance.now();
  try {
    const evidence = await action();
    receipt.results.push({label,status:'passed',milliseconds:Math.round(performance.now()-started),evidence:evidence??null});
    process.stdout.write(`PASS ${label}\n`);
  } catch(error) {
    const message = String(error?.message || error).slice(0,2000);
    receipt.results.push({label,status:'failed',milliseconds:Math.round(performance.now()-started),error:message});
    process.stdout.write(`FAIL ${label}: ${message.split('\n')[0]}\n`);
  }
}

async function screenshot(page, name) {
  const file = path.join(output, `${name}.png`);
  await page.screenshot({path:file,fullPage:false});
  receipt.screenshots.push(file);
  return file;
}

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function focusPanel(page, id) {
  const dock = page.locator(`.canvas-dock [data-focus-panel="${id}"]`);
  if (await dock.count()) await dock.click();
  else if (id === 'donna') await page.locator('#donna-launcher').click();
  else throw new Error(`No tested launcher for ${id}`);
  await settle(page);
  assert.equal(await page.locator(`#${id}`).isVisible(), true);
}

async function newPage(viewport, init) {
  const context = await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:'reduce',acceptDownloads:true});
  if (init) await context.addInitScript(init);
  const external = [], errors = [], requests = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    external.push(url);
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto(origin, {waitUntil:'networkidle',timeout:15000});
  return {context,page,external,errors,requests};
}

const importedHTML = '<!doctype html><html lang="en"><head><title>Import verification fixture</title></head><body><p id="import-marker">Before execution</p><script>document.getElementById("import-marker").textContent="EXECUTED AFTER PREVIEW";</script></body></html>';

try {
  for (const viewport of [{width:1365,height:900},{width:430,height:860}]) {
    const label = viewport.width > 700 ? 'desktop' : 'narrow';
    const {context,page,external,errors,requests} = await newPage(viewport);
    const scene = () => page.frameLocator('#scene-frame');
    try {
      await check(`${label}: original reference renders using local assets`, async () => {
        await scene().locator('canvas').waitFor({state:'visible',timeout:10000});
        await page.waitForFunction(() => /[1-9][\d,]* draws/.test(document.getElementById('render-stats').textContent),null,{timeout:10000});
        assert.match(await page.locator('#scene-origin').innerText(), /Original reference.*not model output/);
        assert.equal(await page.locator('#scene-frame').getAttribute('sandbox'), 'allow-scripts');
        assert.equal(await scene().locator('canvas').evaluate(element => element.width > 0 && element.height > 0), true);
        assert.equal(await page.locator('#play-toggle').getAttribute('aria-pressed'), 'true', 'Reduced-motion mode initially pauses motion');
        assert.equal(external.length, 0, 'The scene requested no external assets');
        return {renderStats:await page.locator('#render-stats').innerText(),status:await page.locator('#preview-status').innerText(),screenshot:await screenshot(page, `${label}-table`)};
      });

      await check(`${label}: chrome stays within viewport`, async () => {
        const dimensions = await page.evaluate(() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,topbar:document.querySelector('.topbar').getBoundingClientRect().toJSON(),dock:document.querySelector('.canvas-dock').getBoundingClientRect().toJSON(),donna:document.querySelector('#donna-launcher').getBoundingClientRect().toJSON()}));
        assert.equal(dimensions.scrollWidth, dimensions.width);
        for (const name of ['topbar','dock','donna']) {
          assert.ok(dimensions[name].left >= -1 && dimensions[name].right <= dimensions.width + 1, `${name} is in horizontal view`);
          assert.ok(dimensions[name].top >= 0 && dimensions[name].bottom <= viewport.height + 1, `${name} is in vertical view`);
        }
        return dimensions;
      });

      await check(`${label}: reference reopens while browser is offline`, async () => {
        await context.setOffline(true);
        await focusPanel(page, 'source');
        await page.locator('#restore-reference').click();
        await scene().locator('canvas').waitFor({state:'visible',timeout:10000});
        await page.waitForFunction(() => /reference running/.test(document.getElementById('preview-status').textContent));
        return {offline:true};
      });

      await check(`${label}: camera, wireframe and motion controls affect the reference`, async () => {
        await focusPanel(page, 'scene');
        const canvas = scene().locator('canvas');
        await canvas.focus();
        await settle(page);
        const original = digest(await canvas.screenshot());
        await canvas.press('ArrowLeft');
        await settle(page);
        const rotated = digest(await canvas.screenshot());
        assert.notEqual(rotated, original, 'Keyboard orbit changes the rendered pixels');
        await page.locator('#camera-reset').click();
        await canvas.focus();
        await settle(page);
        assert.equal(digest(await canvas.screenshot()), original, 'Reset restores the paused reference camera');
        await page.locator('#wire-toggle').click();
        await settle(page);
        assert.equal(await page.locator('#wire-toggle').getAttribute('aria-pressed'),'true');
        const wire = digest(await canvas.screenshot());
        await page.locator('#wire-toggle').click();
        await settle(page);
        assert.equal(await page.locator('#wire-toggle').getAttribute('aria-pressed'),'false');
        const solid = digest(await canvas.screenshot());
        assert.notEqual(wire, solid, 'Wireframe changes the rendered pixels');
        await page.locator('#play-toggle').click();
        assert.equal(await page.locator('#play-toggle').getAttribute('aria-pressed'),'false');
        const motion1 = digest(await canvas.screenshot());
        await page.waitForTimeout(200);
        const motion2 = digest(await canvas.screenshot());
        assert.notEqual(motion1,motion2,'Resuming causes visible animation');
        await page.locator('#play-toggle').click();
        assert.equal(await page.locator('#play-toggle').getAttribute('aria-pressed'),'true');
        await settle(page);
        const paused1 = digest(await canvas.screenshot());
        await page.waitForTimeout(150);
        assert.equal(digest(await canvas.screenshot()),paused1,'Pausing stops visible animation');
        return {orbit:true,reset:true,wireframe:true,motion:true,screenshot:await screenshot(page,`${label}-scene`)};
      });

      await check(`${label}: keyboard movement, pointer cancellation and Home recover`, async () => {
        await focusPanel(page,'brief');
        const grip = page.locator('[data-drag="brief"]');
        const position = () => page.locator('#brief').evaluate(element => ({x:parseFloat(element.style.getPropertyValue('--x')),y:parseFloat(element.style.getPropertyValue('--y'))}));
        const before = await position();
        await grip.focus(); await grip.press('ArrowRight');
        assert.equal((await position()).x, before.x + 20);
        const moved = await position();
        const box = await grip.boundingBox();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
        await page.mouse.down(); await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2+30,{steps:3});
        assert.notDeepEqual(await position(), moved);
        await page.keyboard.press('Escape'); await page.mouse.up();
        assert.deepEqual(await position(), moved, 'Escape rolls back a pointer gesture');
        await page.locator('#viewport').focus();
        const transform = await page.locator('#world').evaluate(element=>element.style.transform);
        await page.keyboard.press('ArrowRight');
        assert.notEqual(await page.locator('#world').evaluate(element=>element.style.transform),transform);
        await page.keyboard.press('Home');
        const recovered = await page.locator('#world').evaluate(element=>element.style.transform);
        assert.ok(!/NaN|Infinity/.test(recovered));
        await focusPanel(page,'scene');
        const sceneBox = await page.locator('#scene').boundingBox();
        assert.ok(sceneBox.x>=0 && sceneBox.x+sceneBox.width<=viewport.width+1,'Scene is recoverable at a readable focus');
        return {keyboardMove:true,escapeCancels:true,home:true};
      });

      const briefDraft = `Unsent studio verification draft for ${label}.`;
      let sourceDraft = '';
      await check(`${label}: brief and source drafts survive panel navigation`, async () => {
        await focusPanel(page,'brief'); await page.locator('#brief-text').fill(briefDraft);
        await focusPanel(page,'source');
        sourceDraft = (await page.locator('#scene-source').inputValue()) + `\n<!-- ${label} draft -->`;
        await page.locator('#scene-source').fill(sourceDraft);
        await page.locator('[data-close-panel="source"]').click();
        await focusPanel(page,'review'); await focusPanel(page,'source');
        assert.equal(await page.locator('#scene-source').inputValue(),sourceDraft);
        await focusPanel(page,'brief');
        assert.equal(await page.locator('#brief-text').inputValue(),briefDraft);
        const saved = await page.evaluate(key=>localStorage.getItem(key),layoutKey);
        assert.ok(!saved.includes(briefDraft) && !saved.includes(`${label} draft`),'Layout persistence contains no content drafts');
        return {brief:true,source:true,layoutContainsNoDrafts:true};
      });

      await check(`${label}: imported code remains unexecuted until Preview`, async () => {
        await page.locator('#file-input').setInputFiles({name:'review-fixture.html',mimeType:'text/html',buffer:Buffer.from(importedHTML)});
        await page.waitForFunction(() => document.getElementById('scene-source').value.includes('import-marker'));
        assert.equal(await page.locator('#scene-frame').getAttribute('srcdoc'),null);
        assert.equal(await page.locator('#scene-frame').getAttribute('src'),'about:blank');
        assert.match(await page.locator('#toast').innerText(), /has not been executed/);
        assert.equal(await page.locator('#play-toggle').isDisabled(),true);
        await page.locator('#preview-source').click();
        await scene().locator('#import-marker').waitFor({state:'visible'});
        assert.equal(await scene().locator('#import-marker').innerText(),'EXECUTED AFTER PREVIEW');
        assert.match(await page.locator('#preview-status').innerText(), /manual review required/);
        return {deferredExecution:true,explicitPreview:true};
      });

      await check(`${label}: workspace export and import preserve content without execution`, async () => {
        await focusPanel(page,'brief');
        await page.locator('#scene-owner').selectOption('Game designer');
        const downloadPromise = page.waitForEvent('download');
        await page.locator('#export-workspace').click();
        const download = await downloadPromise;
        const file = path.join(output,`${label}-workspace.json`);
        await download.saveAs(file);
        const exported = JSON.parse(await readFile(file,'utf8'));
        assert.equal(exported.schema,'daftar.3d-studio.v1');
        assert.equal(exported.source,importedHTML);
        assert.equal(exported.brief,briefDraft);
        assert.equal(exported.owner,'Game designer');
        assert.equal(exported.model_execution,'not_performed_by_this_browser');
        await page.locator('#brief-text').fill('Changed after export');
        await page.locator('#file-input').setInputFiles(file);
        await page.waitForFunction(expected=>document.getElementById('brief-text').value===expected,briefDraft);
        assert.equal(await page.locator('#scene-source').inputValue(),importedHTML);
        assert.equal(await page.locator('#scene-owner').inputValue(),'Game designer');
        assert.equal(await page.locator('#scene-frame').getAttribute('srcdoc'),null);
        return {roundTrip:true,importDidNotExecute:true};
      });

      await check(`${label}: malformed import remains a source error`, async () => {
        await page.locator('#file-input').setInputFiles({name:'incomplete.html',mimeType:'text/html',buffer:Buffer.from('<html><body><script>document.body.textContent="BAD";')});
        await page.waitForFunction(() => document.getElementById('source-message').classList.contains('error'));
        await page.locator('#preview-source').click();
        assert.equal(await page.locator('#scene-frame').getAttribute('srcdoc'),null);
        assert.match(await page.locator('#source-message').innerText(),/complete|incomplete/i);
        return {blocked:true};
      });

      await check(`${label}: Donna is an honest local brief helper`, async () => {
        await focusPanel(page,'donna');
        assert.match(await page.locator('#donna').innerText(),/Local brief helper/);
        await page.locator('#chat-input').fill('Add a clearly marked walking route.');
        await page.locator('#chat-form button[type="submit"]').click();
        assert.match(await page.locator('#chat-log').innerText(),/No model request has been sent/);
        assert.match(await page.locator('#brief-text').inputValue(),/clearly marked walking route/);
        assert.equal(requests.some(url=>/\/api\//.test(url)),false);
        return {noModelRequests:true,screenshot:await screenshot(page,`${label}-donna`)};
      });

      await check(`${label}: no page errors or external network requests`, async () => {
        assert.deepEqual(errors,[]);
        assert.deepEqual(external,[]);
        return {pageErrors:errors,externalRequests:external,requestedFiles:requests.filter(url=>url.startsWith(origin)).map(url=>new URL(url).pathname)};
      });
    } finally { await context.close(); }
  }

  for (const [name,init] of [
    ['storage denied',()=>{Object.defineProperty(Storage.prototype,'getItem',{value(){throw new DOMException('Denied for test','SecurityError');}});Object.defineProperty(Storage.prototype,'setItem',{value(){throw new DOMException('Denied for test','SecurityError');}});}],
    ['malformed saved layout',()=>localStorage.setItem('daftar.3d-studio.layout.v1','{invalid')],
  ]) {
    await check(`${name}: reference and camera remain usable`, async () => {
      const {context,page,errors,external} = await newPage({width:1365,height:900},init);
      try {
        await page.frameLocator('#scene-frame').locator('canvas').waitFor({state:'visible',timeout:10000});
        await page.locator('#home-camera').click();
        await focusPanel(page,'source');
        assert.equal(await page.locator('#source').isVisible(),true);
        assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
        return {usable:true};
      } finally { await context.close(); }
    });
  }
} catch(error) {
  receipt.errors.push(String(error?.stack||error).slice(0,3000));
} finally {
  receipt.finished_at = new Date().toISOString();
  receipt.passed = receipt.results.filter(result=>result.status==='passed').length;
  receipt.failed = receipt.results.filter(result=>result.status==='failed').length + receipt.errors.length;
  await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
console.log(JSON.stringify({phase,passed:receipt.passed,failed:receipt.failed,receipt:path.join(output,'receipt.json'),screenshots:receipt.screenshots},null,2));
process.exitCode = receipt.failed ? 1 : 0;
