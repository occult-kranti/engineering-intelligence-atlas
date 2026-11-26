#!/usr/bin/env node
/** Browser acceptance for the shipped canvas + postMessage bridge + native runtime.
 * This is not an installed VS Code/Electron webview or production connection test.
 * Run after compiling the desktop/runtime and building the studio asset graph. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../headless-runtime/server.mjs';
import { assertEndlessShell, openCanvasSurface, settleCanvas, canvasPanelState } from '../../scripts/endless-canvas-browser-checks.mjs';

const extension=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repository=path.resolve(extension,'..');
const require=createRequire(path.join(extension,'package.json'));
const requireSite=createRequire(path.join(repository,'site-source/package.json'));
const {createOfficePanel,readAssets}=require('./src/workbench-panel.js');
const {RuntimeClient}=require('./src/runtime-client.js');
const output=path.join(extension,'.work/canvas-smoke');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'daftar-canvas-native-'));
const receipt={schemaVersion:1,status:'running',startedAt:new Date().toISOString(),
  scope:'Actual bundled shared renderer and workbench bridge in Chromium, connected through an emulated VS Code parent to a real temporary native headless runtime',
  installedVsCodeVerified:false,productionConnectionVerified:false,ownerDataUsed:false,
  viewport:{width:1440,height:900},browserSandbox:true,providerCalls:0,externalRequests:[],backendNetworkAttempts:[],
  pageErrors:[],consoleErrors:[],cspErrors:[],rpcFailures:[],checks:[],screenshots:[],rpcMethods:[],
  controlCredentialInBrowser:false,controlCredentialLocation:'Node harness memory only',
};
let browser,page,service,uiServer,controller,client,stage='preflight',token='',html='',uiOrigin='';
const subscription={};const methods=new Set();let persistedView=null;
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const uiCompanyCommitted=deferred(),computeObserved=deferred();
async function within(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error(label)),ms);})]);}finally{clearTimeout(timer);}}
const cleanError=error=>String(error?.message||error).replaceAll(token||'__no_token__','[control credential omitted]').slice(0,2400);
const checksum=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
await fs.mkdir(output,{recursive:true});
try{await fs.copyFile(path.join(output,'receipt.json'),path.join(output,`receipt-prior-${Date.now()}.json`));}catch(error){if(error.code!=='ENOENT')throw error;}
function cleanEnvironment(){const environment={};for(const key of ['PATH','HOME','LANG','LC_ALL','TMPDIR','LD_LIBRARY_PATH'])if(process.env[key])environment[key]=process.env[key];return environment;}
async function screenshot(name){if(!page||page.isClosed())return;const filename=`${name}.png`;await page.screenshot({path:path.join(output,filename),fullPage:false,timeout:10000});receipt.screenshots.push(filename);}
function blockedFetch(kind){return async()=>{receipt.backendNetworkAttempts.push(kind);throw new Error('The canvas acceptance harness does not permit provider, cloud or model-server network work.');};}
function fakeVsCode(){
  const panel={visible:true,webview:{cspSource:uiOrigin,asWebviewUri(uri){const relative=path.relative(extension,uri.fsPath).split(path.sep).map(encodeURIComponent).join('/');return{toString:()=>`${uiOrigin}/${relative}`};},
    postMessage:message=>page&&!page.isClosed()?page.evaluate(data=>window.dispatchEvent(new MessageEvent('message',{data})),message).then(()=>true).catch(()=>false):Promise.resolve(false),
    onDidReceiveMessage(listener){subscription.message=listener;return{dispose(){delete subscription.message;}};},set html(value){html=value;},get html(){return html;}},
    onDidDispose(listener){subscription.dispose=listener;return{dispose(){delete subscription.dispose;}};},reveal(){},dispose(){this.visible=false;subscription.dispose?.();}};
  return{ViewColumn:{Active:1},Uri:{joinPath:(uri,...parts)=>({fsPath:path.join(uri.fsPath,...parts)})},window:{createWebviewPanel:()=>panel}};
}
async function serveAssets(manifest){
  const allowed=new Set(['media/workbench-bridge.js','media/workbench.css',...Object.keys(manifest.files).map(name=>`media/studio/${name}`)]);
  uiServer=http.createServer(async(req,res)=>{
    try{
      if(req.method!=='GET'){res.writeHead(405);res.end();return;}
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;}
      if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
      const relative=decodeURIComponent(url.pathname.slice(1));
      if(!allowed.has(relative)){res.writeHead(404);res.end();return;}
      const bytes=await fs.readFile(path.join(extension,relative));
      const type=relative.endsWith('.js')?'text/javascript; charset=utf-8':relative.endsWith('.css')?'text/css; charset=utf-8':'application/octet-stream';
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);
    }catch{res.writeHead(500);res.end('Asset read failed');}
  });
  await new Promise((resolve,reject)=>{uiServer.once('error',reject);uiServer.listen(0,'127.0.0.1',resolve);});
  uiOrigin=`http://127.0.0.1:${uiServer.address().port}`;
}
try{
  const assets=readAssets(extension);
  receipt.assetCount=Object.keys(assets.manifest.files).length;
  receipt.studioManifestSha256=checksum(await fs.readFile(path.join(extension,'media/studio/manifest.json')));
  receipt.bridgeSha256=checksum(await fs.readFile(path.join(extension,'media/workbench-bridge.js')));
  receipt.nativeCoreSha256=checksum(await fs.readFile(path.join(repository,'native-core/target/release/atlas-core')));
  const {chromium}=requireSite('playwright');
  const browserChannel=process.env.DAFTAR_CANVAS_BROWSER_CHANNEL;
  assert.ok(browserChannel===undefined||browserChannel==='chrome','Only the explicit installed Chrome channel is supported');
  assert.ok(!browserChannel||!process.env.CHROMIUM_PATH,'Choose a browser channel or a Chromium executable, not both');
  stage='browser-launch';
  let executablePath;
  if(!browserChannel){
    for(const candidate of [process.env.CHROMIUM_PATH,chromium.executablePath(),'/usr/bin/chromium'].filter(Boolean)){
      if(!path.isAbsolute(candidate))continue;
      try{await fs.access(candidate);executablePath=candidate;break;}catch{}
    }
  }
  receipt.browserChannel=browserChannel||'playwright-chromium';
  receipt.browserExecutable=executablePath||(browserChannel?'channel:chrome':'playwright-default');
  // CI explicitly uses the runner's installed Chrome and its existing OS profile.
  // Keep sandboxing enabled; never change policy or retry with an unsandboxed browser.
  browser=await chromium.launch({headless:true,chromiumSandbox:true,
    ...(browserChannel?{channel:browserChannel}:{executablePath}),env:cleanEnvironment(),timeout:30000});
  receipt.browserVersion=browser.version();
  stage='native-runtime';
  token=crypto.randomBytes(48).toString('base64url');
  service=await startServer({repoRoot:repository,dataDir:path.join(temporary,'state'),port:0,host:'127.0.0.1',token,
    secretFiles:{},hostControlEnabled:false,ollamaLocalOnly:false,cloudSyncEnabled:false,
    modelFetch:blockedFetch('model-server'),cloudFetch:blockedFetch('cloud-sync'),
    generate:async()=>{receipt.providerCalls++;throw new Error('Provider execution is disabled in this acceptance harness.');}});
  const runtimeOrigin=`http://127.0.0.1:${service.server.address().port}`;
  client=new RuntimeClient({kind:'runtime',url:runtimeOrigin,controlToken:token},async(url,options)=>{
    assert.equal(new URL(url).origin,runtimeOrigin,'Parent HTTP calls stay on the temporary runtime');return fetch(url,options);
  });
  await client.command({action:'create_company',name:'Canvas Smoke Office'},{id:'canvas-smoke-seed-1'});
  await client.command({action:'create_company',name:'Canvas Smoke Studio'},{id:'canvas-smoke-seed-2'});
  const initial=await client.snapshot();const companies=initial.snapshot.companies;
  const seeded=companies.find(company=>company.name==='Canvas Smoke Office');assert.ok(seeded,'Native company creation returned canonical state');
  await client.command({action:'select_company',companyId:seeded.id},{id:'canvas-smoke-select'});
  receipt.initialCompanyCount=companies.length;receipt.initialCompanyIds=companies.map(company=>company.id);
  const capabilities=await client.capabilities();
  await serveAssets(assets.manifest);
  const connectionInfo=()=>({connected:true,configured:true,kind:'runtime',url:runtimeOrigin,location:'Temporary native acceptance runtime',connectionEpoch:1,
    capabilities:Object.fromEntries(Object.entries(capabilities.methods).map(([name,value])=>[name,value.available===true||value.platformDelegated===true]))});
  controller=createOfficePanel(fakeVsCode(),{extensionUri:{fsPath:extension}},{connectionInfo,call:async(method,args,context)=>{
    methods.add(method);
    // Scope this acceptance to reads and the tested native company transaction.
    const denied=new Set(['setOfficeWorker','runOfficeQueue','startRun','createVenv','downloadModel','modelPoolRequest','hostSubmit','hostApprove','environmentPrepare','environmentRun','resourceStart','designInstall','setApiKey','configureCloud']);
    if(denied.has(method))throw new Error('This browser acceptance does not dispatch runtime jobs or credential operations.');
    if(method==='officeCommand')assert.ok(['create_company','select_company','ensure_blueprint'].includes(args[0]?.action),'Only company/blueprint state mutations are permitted');
    if(method==='openComputeCenter'){computeObserved.resolve();return{ok:true,harness:'native-command-entry-observed'};}
    try{const result=await client.call(method,args,context);if(method==='officeCommand'&&args[0]?.action==='create_company'&&args[0]?.name==='Canvas Created Through UI')uiCompanyCommitted.resolve(result);return result;}catch(error){receipt.rpcFailures.push({method,error:cleanError(error)});throw error;}
  }});
  const context=await browser.newContext({viewport:receipt.viewport,colorScheme:'dark',reducedMotion:'reduce'});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==uiOrigin){receipt.externalRequests.push({method:request.method(),origin:url.origin,path:url.pathname});return route.abort('blockedbyclient');}
    assert.ok(!JSON.stringify(request.headers()).includes(token),'No browser request contains the control token');
    return route.continue();
  });
  page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>{if(receipt.pageErrors.length<100)receipt.pageErrors.push(cleanError(error));});
  page.on('console',message=>{if(message.type()==='error'&&receipt.consoleErrors.length<100)receipt.consoleErrors.push(message.text().slice(0,800));});
  await page.exposeFunction('__DAFTAR_POST',message=>{subscription.message?.(message);});
  await page.exposeFunction('__DAFTAR_CSP',violation=>{if(receipt.cspErrors.length<100)receipt.cspErrors.push(violation);});
  await page.addInitScript(()=>{
    let state;
    window.acquireVsCodeApi=()=>({postMessage:message=>{void window.__DAFTAR_POST(message);},getState:()=>state,setState:value=>{state=value;window.__DAFTAR_VIEW_STATE=value;return value;}});
    document.addEventListener('securitypolicyviolation',event=>{void window.__DAFTAR_CSP({directive:event.violatedDirective,blocked:event.blockedURI});});
  });
  stage='initial-render';
  await page.goto(uiOrigin,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.body.classList.contains('endless-canvas')&&document.querySelectorAll('.ff-node').length>0);
  await page.waitForFunction(names=>[...document.querySelectorAll('.ff-node-title')].some(node=>names.includes(node.textContent)),companies.map(company=>company.name));
  await settleCanvas(page);await assertEndlessShell(page,'VS Code canvas browser harness');
  assert.equal(await page.locator('iframe').count(),0,'No iframe or remote screen hosts the office');
  assert.equal(await page.locator('#workbench-controls').count(),1,'One editor connection control overlay');
  receipt.checks.push('Native canonical companies rendered in one full-size freeflow world at 1440×900');
  await screenshot('01-native-office');
  stage='camera-and-overlay';
  const world=page.locator('#freeflow-host .ff-world');const beforeZoom=await world.evaluate(node=>node.style.transform);
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await settleCanvas(page);
  assert.notEqual(await world.evaluate(node=>node.style.transform),beforeZoom,'Zoom changes the actual canvas transform');
  const beforePan=await world.evaluate(node=>node.style.transform);await page.locator('.ff-canvas-host').focus();await page.keyboard.press('ArrowRight');await settleCanvas(page);
  assert.notEqual(await world.evaluate(node=>node.style.transform),beforePan,'Keyboard pan changes the actual canvas transform');
  const donna=await openCanvasSurface(page,'donna');await page.locator('#chat-message').fill('Unsent smoke-test draft');
  const prior=await canvasPanelState(page,'donna');await donna.locator('.canvas-panel-grip').focus();await page.keyboard.press('ArrowRight');
  const moved=await canvasPanelState(page,'donna');assert.equal(moved.rect.x,prior.rect.x+20,'Movable chat surface uses the shared canvas geometry');
  receipt.checks.push('Real camera zoom/pan and keyboard movement of the live Donna surface');
  stage='native-company-popup';
  const overview=await openCanvasSurface(page,'office-overview');
  const creation=overview.locator('details').filter({has:page.locator('#office-create-company')});
  assert.equal(await creation.count(),1,'The company form belongs to one disclosure in its canvas surface');
  if(await creation.getAttribute('open')===null)await creation.locator(':scope > summary').click();
  await page.locator('#office-new-company-name').fill('Canvas Created Through UI');
  await page.locator('#office-create-company button[type="submit"]').click();
  await within(uiCompanyCommitted.promise,15000,'The canvas company form did not commit a native result.');await settleCanvas(page);
  const after=await client.snapshot();const created=after.snapshot.companies.find(company=>company.name==='Canvas Created Through UI');assert.ok(created,'The canvas form committed through the real native core');
  receipt.createdCompanyId=created.id;receipt.checks.push('Company creation from its in-canvas form persisted in the temporary native office');
  await page.locator('#workbench-compute').click();await within(computeObserved.promise,5000,'Compute did not reach the parent command boundary.');assert.ok(methods.has('openComputeCenter'),'Compute overlay reaches the parent command boundary');
  await openCanvasSurface(page,'donna');await assertEndlessShell(page,'After native mutation');
  await screenshot('02-live-surfaces');
  stage='setup-flow-popup';
  await page.locator('#workbench-setup').click();
  const setup=page.locator('#workbench-setup-panel');await setup.waitFor({state:'visible'});
  assert.equal(await setup.getAttribute('aria-modal'),'false','Setup remains a movable overlay on the office');
  assert.equal(await setup.locator('.workbench-setup-steps>li').count(),6,'The setup flow exposes all six stages');
  assert.match(await page.locator('#workbench-setup-status').innerText(),/Connection reported/);
  const setupBefore=await setup.boundingBox(),worldBeforeSetup=await world.evaluate(node=>node.style.transform);
  assert.ok(setupBefore&&setupBefore.x>26,'The laptop viewport has room to move the setup overlay');
  await page.locator('#workbench-setup-move').focus();await page.keyboard.press('ArrowLeft');
  const setupAfter=await setup.boundingBox();assert.equal(setupAfter.x,setupBefore.x-16,'Keyboard input moves the setup overlay');
  assert.equal(await world.evaluate(node=>node.style.transform),worldBeforeSetup,'Moving the setup overlay does not pan the office');
  await screenshot('03-setup-flow');await page.keyboard.press('Escape');
  assert.equal(await setup.isVisible(),false,'Escape closes setup');
  assert.equal(await page.locator('#workbench-setup').evaluate(node=>node===document.activeElement),true,'Escape returns focus to the setup trigger');
  receipt.checks.push('Six-step setup remains an accessible movable popup with keyboard movement, isolated input and focus restoration');
  persistedView=await page.evaluate(()=>window.__DAFTAR_VIEW_STATE||null);
  assert.ok(!JSON.stringify(persistedView).includes('Unsent smoke-test draft'),'Only view preferences persist');
  const rendered=await page.content();receipt.controlCredentialInBrowser=rendered.includes(token)||JSON.stringify(persistedView).includes(token);
  assert.equal(receipt.controlCredentialInBrowser,false,'The runtime control token never enters browser content or persisted state');
  assert.equal(receipt.providerCalls,0);assert.deepEqual(receipt.externalRequests,[]);assert.deepEqual(receipt.backendNetworkAttempts,[]);
  assert.deepEqual(receipt.pageErrors,[]);assert.deepEqual(receipt.cspErrors,[]);assert.deepEqual(receipt.consoleErrors,[]);assert.deepEqual(receipt.rpcFailures,[]);
  receipt.checks.push('No page/CSP/console/RPC errors, external requests, provider calls or credential exposure');
  receipt.status='passed';
}catch(error){
  receipt.status=stage==='browser-launch'?'blocked':'failed';receipt.failedStage=stage;receipt.error=cleanError(error);
  if(receipt.status==='blocked')receipt.blocker='The configured browser could not launch with its sandbox enabled. No sandbox exception, policy change or automatic fallback was attempted.';
  try{await screenshot('failure');}catch{}
  process.exitCode=1;
}finally{
  controller?.dispose();client?.close();
  try{await browser?.close();}catch{}
  try{await service?.close();}catch(error){receipt.cleanupError=cleanError(error);process.exitCode=1;}
  if(uiServer){uiServer.closeAllConnections?.();await new Promise(resolve=>uiServer.close(resolve));}
  await fs.rm(temporary,{recursive:true,force:true});token='';
  receipt.rpcMethods=[...methods].sort();receipt.finishedAt=new Date().toISOString();
  await fs.writeFile(path.join(output,'receipt.json'),`${JSON.stringify(receipt,null,2)}\n`);
  console.log(JSON.stringify({status:receipt.status,stage:receipt.failedStage||'complete',checks:receipt.checks.length,screenshots:receipt.screenshots,receipt:path.join(output,'receipt.json')}));
}
