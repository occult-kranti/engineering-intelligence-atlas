#!/usr/bin/env node
/** Bounded DOM checks; --browser separately exercises real layout and CSS. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { STYLES, cssFor } from '../projects/design-backgrounds/effects.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'projects/design-backgrounds');
const mirror=path.join(root,'site-source/public/design-backgrounds');
const receiptDir=path.join(folder,'verification');
fs.mkdirSync(receiptDir,{recursive:true});
const require=createRequire(path.join(root,'desktop-shell/package.json'));
const {JSDOM}=require('jsdom');
const expected=['thermal-gradients','3d-particles','fluted-glass','persian-rugs','ascii-pixels','marbled-paper','crt-scanlines','crushed-velvet','pressed-flowers','damaged-film','water-ripples','wasp-nest','iridescent-shapes','foggy-windows','liquid-metal'];
const checks=[];
function check(condition,label){assert(condition,label);checks.push(label);}
check(JSON.stringify(STYLES.map(s=>s.id))===JSON.stringify(expected),'Exactly the fifteen requested studies in their declared order');
check(new Set(STYLES.map(s=>s.css)).size===15,'All fifteen effects have distinct authored CSS');
check(STYLES.every(s=>s.description&&s.technique&&s.limits),'Every study declares its technique and limitations');
check(STYLES.filter(s=>s.motion).length===6,'Only six explicitly declared studies can enable motion');
const html=fs.readFileSync(path.join(folder,'index.html'),'utf8');
const code=fs.readFileSync(path.join(folder,'studio.mjs'),'utf8').replace("import { STYLES, cssFor } from './effects.mjs';",'const { STYLES, cssFor } = window.__effects;');
const dom=new JSDOM(html,{url:'https://surfaces.test/#unknown-style',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,d=w.document;
w.__effects={STYLES,cssFor};
const motionListeners=new Set();
const media={matches:false,addEventListener(type,fn){motionListeners.add(fn);},removeEventListener(type,fn){motionListeners.delete(fn);}};
w.matchMedia=()=>media;
let copied='',downloadBlob=null,hidden=false;
Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text;}}});
Object.defineProperty(d,'hidden',{configurable:true,get:()=>hidden});
w.URL.createObjectURL=blob=>{downloadBlob=blob;return 'blob:https://surfaces.test/download';};
w.URL.revokeObjectURL=()=>{};
w.HTMLAnchorElement.prototype.click=function(){};
w.eval(code);
check(d.documentElement.dataset.ready==='true','Studio initializes without a data fetch');
check(d.querySelectorAll('[data-style]').length===15,'Fifteen real selection buttons render');
check(d.querySelector('#selected-title').textContent==='Thermal gradients','Unknown hash falls back to the first declared study');
check(d.querySelector('#preview').dataset.motion==='off','Default motion is off');
check(d.querySelector('#content-plate').hidden===false,'Opaque content plate is present by default');
for(const style of STYLES){
  d.querySelector(`[data-style="${style.id}"]`).click();
  check(d.querySelector('#selected-title').textContent===style.label&&d.querySelector('#css-code').value===cssFor(style),`${style.id}: selection updates exact CSS and description`);
}
check(d.querySelectorAll('[data-style][aria-pressed="true"]').length===1,'Exactly one selection is announced');
d.querySelector('#next').click();
check(d.querySelector('#selected-title').textContent==='Thermal gradients','Next wraps from the final study');
d.querySelector('#previous').click();
check(d.querySelector('#selected-title').textContent==='Liquid metal','Previous wraps from the first study');
d.querySelector('#motion-toggle').click();
check(d.querySelector('#preview').dataset.motion==='on','Explicit motion toggle works on an eligible effect');
w.dispatchEvent(new w.Event('blur'));
check(d.querySelector('#preview').dataset.motion==='off','Blur stops motion');
d.querySelector('#motion-toggle').click();hidden=true;d.dispatchEvent(new w.Event('visibilitychange'));hidden=false;
check(d.querySelector('#preview').dataset.motion==='off','Hidden tab stops motion');
media.matches=true;for(const listener of motionListeners)listener();
check(d.querySelector('#motion-toggle').disabled&&d.querySelector('#preview').dataset.motion==='off','Device reduced motion disables and stops animation');
media.matches=false;for(const listener of motionListeners)listener();
d.querySelector('[data-style="crt-scanlines"]').click();
check(d.querySelector('#motion-toggle').disabled,'Static CRT cannot enable flicker or motion');
d.querySelector('[data-style="persian-rugs"]').click();
check(d.querySelector('#selected-limits').textContent.includes('not an authentic traditional pattern'),'Persian-inspired approximation label follows selection');
d.querySelector('#copy-css').click();await new Promise(r=>setTimeout(r,0));
check(copied===cssFor(STYLES[3])&&d.querySelector('#copy-status').textContent.includes('Copied Persian rugs'),'Clipboard receives the selected study exactly');
w.navigator.clipboard.writeText=async()=>{throw new Error('denied');};
d.querySelector('#copy-css').click();await new Promise(r=>setTimeout(r,0));
check(d.querySelector('#code-details').open&&d.activeElement.id==='css-code'&&d.querySelector('#css-code').selectionEnd===d.querySelector('#css-code').value.length,'Clipboard failure exposes and selects a manual-copy fallback');
d.querySelector('#download-css').click();
check(downloadBlob?.type==='text/css;charset=utf-8','Download uses a CSS Blob');
const toggle=d.querySelector('#show-content');toggle.checked=false;toggle.dispatchEvent(new w.Event('change'));
check(d.querySelector('#content-plate').hidden,'Content plate can be hidden intentionally');
for(const file of ['index.html','studio.css','effects.css','studio.mjs','effects.mjs','README.md','style-briefs.md','sources.json','styles.json']){
  check(fs.readFileSync(path.join(folder,file)).equals(fs.readFileSync(path.join(mirror,file))),`Source/public parity: ${file}`);
}
const css=fs.readFileSync(path.join(folder,'studio.css'),'utf8');
check(css.includes('prefers-reduced-motion:reduce')&&css.includes('forced-colors:active'),'Styles contain reduced-motion and forced-color handling');
function luminance(hex){const v=hex.match(/[a-f\d]{2}/gi).map(h=>parseInt(h,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];}
const pairs=[['plate','#243329','#faf8f2'],['body','#243329','#f4f1e8'],['muted','#596356','#f4f1e8'],['action','#faf8ef','#394e3e']].map(([label,foreground,background])=>{const a=luminance(foreground),b=luminance(background);return {label,foreground,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
check(pairs.every(p=>p.ratio>=4.5),'Declared primary text pairs exceed 4.5:1 calculated sRGB contrast');
const hashes=Object.fromEntries(['index.html','studio.css','effects.css','studio.mjs','effects.mjs'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(folder,file))).digest('hex')]));
const domReceipt={status:'passed',scope:'Isolated DOM behavior, source/public parity and declared-color calculations; no layout claim',checks:checks.length,check_names:checks,contrast_pairs:pairs,source_sha256:hashes,provider_calls:0};
fs.writeFileSync(path.join(receiptDir,'dom-checks.json'),JSON.stringify(domReceipt,null,2)+'\n');
dom.window.close();

let browserReceipt=null;
if(process.argv.includes('--browser')){
  const serveFolder=path.resolve(process.env.DESIGN_BACKGROUNDS_SOURCE??path.join(root,'docs/design-backgrounds'));
  const siteRequire=createRequire(path.join(root,'site-source/package.json'));
  const {chromium}=siteRequire('playwright');
  const allowed=new Set(['index.html','studio.css','effects.css','studio.mjs','effects.mjs']);
  const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript'};
  const server=http.createServer((req,res)=>{const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';if(!allowed.has(requested)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(requested)]});res.end(fs.readFileSync(path.join(serveFolder,requested)));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
    const browserChecks=[];const bcheck=(c,m)=>{assert(c,m);browserChecks.push(m);};
    const page=await browser.newPage({viewport:{width:1440,height:1100}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForSelector('html[data-ready="true"]');
    bcheck(await page.locator('[data-style]').count()===15,'Browser renders all fifteen selectors');
    bcheck(await page.locator('#preview').getAttribute('data-motion')==='off','Browser initial motion is off');
    for(const id of expected){await page.locator(`[data-style="${id}"]`).click();const painted=await page.locator('#preview').evaluate(el=>{const a=getComputedStyle(el),b=getComputedStyle(el,'::before');return a.backgroundImage!=='none'||b.backgroundImage!=='none';});bcheck(painted,`${id}: browser paints a gradient or SVG background`);}
    await page.locator('[data-style="thermal-gradients"]').click();await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(receiptDir,'desktop.png'),fullPage:true});
    bcheck(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desktop has no horizontal overflow');
    await page.locator('#motion-toggle').click();
    bcheck(await page.locator('#preview').evaluate(el=>getComputedStyle(el,'::before').animationName)!=='none','Opt-in CSS motion exists in Chromium');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>document.querySelector('#motion-toggle').disabled);
    bcheck(await page.locator('#preview').evaluate(el=>getComputedStyle(el,'::before').animationName)==='none','Reduced motion actually removes CSS animation');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width:360,height:820});await page.evaluate(()=>window.scrollTo(0,0));
    bcheck(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'360px viewport has no horizontal overflow');
    const mainBox=await page.locator('#preview').boundingBox(),plateBox=await page.locator('#content-plate').boundingBox();
    bcheck(mainBox.width<=360&&plateBox.width<mainBox.width&&plateBox.height<mainBox.height,'Mobile preview and readable plate remain bounded');
    await page.screenshot({path:path.join(receiptDir,'mobile.png'),fullPage:true});
    await page.locator('[data-style="persian-rugs"]').click();
    bcheck((await page.locator('#selected-limits').innerText()).includes('not an authentic traditional pattern'),'Mobile selection keeps the cultural qualification visible');
    await page.locator('#copy-css').click();
    await page.waitForFunction(() => /Copied|Clipboard unavailable/.test(document.querySelector('#copy-status').textContent));
    bcheck((await page.locator('#copy-status').innerText()).match(/Copied|Clipboard unavailable/)!==null,'Browser copy action gives an actionable result');
    await page.emulateMedia({forcedColors:'active'});
    bcheck(await page.locator('#preview').evaluate(el=>getComputedStyle(el,'::before').display)==='none','Forced colors remove decorative pseudo-elements');
    bcheck(errors.length===0,'No browser script errors');
    browserReceipt={status:'passed',engine:'Playwright Chromium',checks:browserChecks.length,check_names:browserChecks,viewports:[{width:1440,height:1100},{width:360,height:820}],screenshots:['desktop.png','mobile.png'],limits:'No device performance benchmark, native integration or complete accessibility audit'};
    fs.writeFileSync(path.join(receiptDir,'browser-checks.json'),JSON.stringify(browserReceipt,null,2)+'\n');
  }catch(error){
    browserReceipt={status:browser?'failed':'blocked',scope:'Real browser mode',reason:browser?'An assertion or browser operation failed.':'Chromium could not launch in this environment.',detail:String(error.message).split('\n')[0],source_sha256:hashes};
    fs.writeFileSync(path.join(receiptDir,'browser-checks.json'),JSON.stringify(browserReceipt,null,2)+'\n');
    throw error;
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
console.log(JSON.stringify({dom:domReceipt.status,dom_checks:domReceipt.checks,browser:browserReceipt?.status??'not requested',browser_checks:browserReceipt?.checks??0},null,2));
