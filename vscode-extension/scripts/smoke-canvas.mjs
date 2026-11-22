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
import { assertEndlessShell, openCanvasSurface, settleCanvas, canvasPanelState, checkEndlessPanelInteractions } from '../../scripts/endless-canvas-browser-checks.mjs';
import { checkBoardWorkflows } from '../../scripts/board-workflow-browser-checks.mjs';
import { checkImprovementWorkflows } from '../../scripts/improvement-browser-checks.mjs';

const extension=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repository=path.resolve(extension,'..');
const require=createRequire(path.join(extension,'package.json'));
const requireSite=createRequire(path.join(repository,'site-source/package.json'));
const {createOfficePanel,readAssets}=require('./src/workbench-panel.js');
const {RuntimeClient}=require('./src/runtime-client.js');
const output=path.join(extension,'.work/canvas-smoke');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'daftar-canvas-native-'));
const receipt={schemaVersion:2,status:'running',startedAt:new Date().toISOString(),
  scope:'Actual bundled shared renderer and workbench bridge in Chromium, connected through an emulated VS Code parent to a real temporary native headless runtime',
  installedVsCodeVerified:false,productionConnectionVerified:false,ownerDataUsed:false,
  viewport:{width:1440,height:900},viewports:[{width:1440,height:900},{width:1366,height:768}],browserSandbox:true,providerCalls:0,externalRequests:[],backendNetworkAttempts:[],
  pageErrors:[],consoleErrors:[],cspErrors:[],rpcFailures:[],checks:[],screenshots:[],rpcMethods:[],
  graphics:[],webglVerified:false,hardwareAccelerationVerified:false,
  targetMeasurements:[],panelFrames:[],targetMeasurementScope:'Rendered CSS-pixel bounding boxes; no WCAG conformance assessment',
  controlCredentialInBrowser:false,controlCredentialLocation:'Node harness memory only',
};
let browser,page,service,uiServer,controller,client,stage='preflight',token='',html='',uiOrigin='',boardConflictExpected=false;
let noteAcknowledgementLossExpected=false,noteAcknowledgementLossArmed=false;
const improvementNoteRequests=[];
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
async function cameraState(label){
  const camera=await page.locator('#freeflow-host .ff-world').evaluate(node=>{
    const transform=node.style.transform;
    // The shared camera omits identity rotations from its CSS transform.
    return {transform,pitch:Number(transform.match(/rotateX\(([-+\d.e]+)deg\)/)?.[1]??0),yaw:Number(transform.match(/rotate\(([-+\d.e]+)deg\)/)?.[1]??0)};
  });
  assert.ok(Number.isFinite(camera.pitch)&&Number.isFinite(camera.yaw),`${label}: shared camera has finite pitch and yaw`);
  return camera;
}
async function assertTopView(label){
  const camera=await cameraState(label);
  assert.equal(Math.abs(camera.pitch),0,`${label}: the plan starts directly overhead`);
  assert.equal(Math.abs(camera.yaw),0,`${label}: the plan starts unrotated`);
  return camera;
}
async function assertBlueprintPlane(label){
  const plane=await page.evaluate(()=>{
    const visible=node=>{
      const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
      return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&rect.width>0&&rect.height>0;
    };
    return{tables:[...document.querySelectorAll('#freeflow-host .ff-world-table')].filter(visible).length,
      chairs:document.querySelectorAll('#freeflow-host .ff-chair-svg').length,
      worlds:document.querySelectorAll('#freeflow-host .ff-world').length};
  });
  assert.equal(plane.tables,0,`${label}: the infinite blueprint plane has no visible conference-table backdrop`);
  assert.equal(plane.chairs,0,`${label}: company markers do not introduce chair illustrations`);
  assert.equal(plane.worlds,1,`${label}: all offices remain on one continuous canvas`);
}
async function captureGraphics(label,{requireGeometry=false}={}){
  await page.waitForFunction(()=>{
    const data=document.querySelector('#freeflow-host .ff-scene')?.dataset;
    return data?.graphics==='webgl'||(data?.graphics==='fallback'&&data.graphicsReason&&data.graphicsReason!=='init'&&['false','0'].includes(data.graphicsPending));
  });
  const graphics=await page.evaluate(()=>{
    const root=document.querySelector('#freeflow-host .ff-scene');
    const canvases=[...document.querySelectorAll('#freeflow-host canvas.ff-relief3d')];
    const canvas=canvases[0];
    const number=key=>root?.dataset[key]===undefined?null:Number(root.dataset[key]);
    const result={state:root.dataset.graphics,reason:root.dataset.graphicsReason||null,
      frames:number('graphicsFrames'),geometries:number('graphicsGeometries'),materials:number('graphicsMaterials'),
      instances:number('graphicsInstances'),pending:root.dataset.graphicsPending,
      drawCalls:number('graphicsDrawCalls'),triangles:number('graphicsTriangles'),contextLosses:number('graphicsContextLosses'),
      scene:{width:root.getBoundingClientRect().width,height:root.getBoundingClientRect().height},
      canvasCount:canvases.length,canvas:canvas?{width:canvas.width,height:canvas.height,
        cssWidth:canvas.getBoundingClientRect().width,cssHeight:canvas.getBoundingClientRect().height,
        inTransformedWorld:!!canvas.closest('.ff-world'),pointerEvents:getComputedStyle(canvas).pointerEvents,
        display:getComputedStyle(canvas).display,visibility:getComputedStyle(canvas).visibility,opacity:Number(getComputedStyle(canvas).opacity)}:null,
      viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},context:null};
    // Query only the renderer's existing successful context. Do not try a new
    // context, change browser flags, or turn a fallback into a graphics pass.
    if(result.state==='webgl'&&canvas){
      const gl=canvas.getContext('webgl2');
      if(gl){
        const debug=gl.getExtension('WEBGL_debug_renderer_info');
        const text=value=>String(value??'').slice(0,240);
        result.context={version:text(gl.getParameter(gl.VERSION)),shadingLanguage:text(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
          vendor:text(gl.getParameter(gl.VENDOR)),renderer:text(gl.getParameter(gl.RENDERER)),
          unmaskedVendor:debug?text(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)):null,
          unmaskedRenderer:debug?text(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):null,
          lost:gl.isContextLost(),drawingBufferWidth:gl.drawingBufferWidth,drawingBufferHeight:gl.drawingBufferHeight};
      }
    }
    return result;
  });
  graphics.label=label;
  graphics.geometryRequired=requireGeometry;
  receipt.graphics.push(graphics);
  assert.equal(graphics.canvasCount,1,`${label}: one relief drawing layer shares the world`);
  assert.ok(graphics.canvas&&graphics.canvas.width>0&&graphics.canvas.height>0,`${label}: drawing buffer has a finite size`);
  assert.equal(graphics.canvas.inTransformedWorld,false,`${label}: the relief layer does not receive the CSS camera a second time`);
  assert.equal(graphics.canvas.pointerEvents,'none',`${label}: semantic native controls retain picking and keyboard ownership`);
  for(const key of ['frames','geometries','materials','instances','drawCalls','triangles','contextLosses']){
    assert.ok(Number.isSafeInteger(graphics[key])&&graphics[key]>=0,`${label}: ${key} is a bounded nonnegative counter`);
  }
  assert.ok(['true','false','0','1'].includes(graphics.pending),`${label}: pending rendering is reported explicitly`);
  if(graphics.state==='webgl'){
    assert.ok(graphics.context&&!graphics.context.lost,`${label}: reported WebGL has an actual live WebGL2 context`);
    assert.match(graphics.context.version,/WebGL 2/i,`${label}: graphics are WebGL2`);
    assert.ok(graphics.canvas.cssWidth>0&&graphics.canvas.cssHeight>0&&graphics.canvas.display!=='none'&&graphics.canvas.visibility!=='hidden'&&graphics.canvas.opacity>0,`${label}: the successful drawing layer is visible`);
    assert.ok(Math.abs(graphics.canvas.cssWidth-graphics.scene.width)<=1&&Math.abs(graphics.canvas.cssHeight-graphics.scene.height)<=1,`${label}: the drawing layer covers the same viewport as its semantic world`);
    assert.ok(graphics.frames>0,`${label}: the live context has completed a successful frame`);
    if(graphics.instances===0){
      assert.equal(graphics.drawCalls,0,`${label}: an empty visible region has no geometry draw calls`);
      assert.equal(graphics.triangles,0,`${label}: an empty visible region has no rendered triangles`);
      assert.equal(requireGeometry,false,`${label}: the explicitly framed company must contain visible geometry`);
    }else{
      assert.ok(graphics.drawCalls>0&&graphics.triangles>0,`${label}: admitted visible instances produce real draw calls and triangles`);
    }
    assert.equal(graphics.geometries,1,`${label}: relief reuses one box geometry`);
    assert.equal(graphics.materials,3,`${label}: relief retains three fixed material batches`);
    assert.ok(graphics.instances<=2048&&graphics.drawCalls<=3&&graphics.triangles<=2048*12,`${label}: visible geometry stays within the renderer's admitted resource bounds`);
    const renderer=graphics.context.unmaskedRenderer||graphics.context.renderer;
    graphics.reportedRendererKind=/swiftshader|llvmpipe|softpipe|software|microsoft basic render|warp/i.test(renderer)?'software':'unclassified';
    // A software WebGL result proves rendering, not laptop hardware performance.
    receipt.webglVerified=true;
  }else{
    assert.equal(typeof graphics.reason,'string',`${label}: unavailable graphics have a visible reason`);
    assert.ok(graphics.reason.length>0,`${label}: fallback is explicit`);
    assert.equal(graphics.reason,'webgl2 unavailable',`${label}: shader, initialization, render or unexpected context-loss failures cannot pass as missing browser capability`);
    assert.equal(receipt.webglVerified,false,`${label}: a successful graphics context must not silently disappear during ordinary camera and popup input`);
    assert.equal(graphics.context,null,`${label}: fallback did not start a second graphics attempt`);
  }
  return graphics;
}
async function measureTargets(label,selector){
  const measurement=await page.evaluate(selector=>{
    const targets=[...document.querySelectorAll(selector)].slice(0,100).map(node=>{
      const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
      return {id:node.id||null,label:node.getAttribute('aria-label')||node.textContent.trim().slice(0,100),
        x:rect.x,y:rect.y,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom,
        insideViewport:rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight,
        disabled:node.disabled===true,display:style.display,visibility:style.visibility};
    }).filter(target=>target.width>0&&target.height>0&&target.display!=='none'&&target.visibility!=='hidden');
    return {viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},targets};
  },selector);
  receipt.targetMeasurements.push({label,...measurement});
  return measurement;
}
async function panelFrameEvidence(id){
  return page.evaluate(id=>{
    const panel=document.querySelector(`.canvas-panel[data-panel-id="${CSS.escape(id)}"]`),title=panel?.querySelector('.canvas-panel-titlebar');
    const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const ancestors=[];
    for(let node=panel;node&&ancestors.length<14;node=node.parentElement){
      const style=getComputedStyle(node);
      ancestors.push({tag:node.tagName,id:node.id||null,className:node.className,
        scrollTop:node.scrollTop,scrollLeft:node.scrollLeft,clientWidth:node.clientWidth,clientHeight:node.clientHeight,
        scrollWidth:node.scrollWidth,scrollHeight:node.scrollHeight,overflowX:style.overflowX,overflowY:style.overflowY,rect:rect(node)});
    }
    return{id,viewport:{width:innerWidth,height:innerHeight},panel:rect(panel),title:rect(title),
      controls:rect(document.getElementById('workbench-controls')),documentScroll:{x:scrollX,y:scrollY},ancestors};
  },id);
}
async function assertPanelTitleInView(id,label){
  const evidence=await panelFrameEvidence(id);receipt.panelFrames.push({label,...evidence});
  const title=evidence.title;
  assert.ok(title&&title.width>0&&title.height>0,`${label}: the live panel has a measurable titlebar`);
  const safeTop=Math.max(150,(evidence.controls?.bottom||0)+8);
  assert.ok(title.x>=-1&&title.right<=evidence.viewport.width+1,`${label}: titlebar fits horizontally in the laptop viewport`);
  assert.ok(title.y>=safeTop-1&&title.bottom<=evidence.viewport.height-1,`${label}: titlebar remains below the top HUD and inside the viewport (${JSON.stringify(title)})`);
  assert.deepEqual(evidence.documentScroll,{x:0,y:0},`${label}: the document does not scroll behind the camera`);
  for(const ancestor of evidence.ancestors.slice(1)){
    assert.equal(ancestor.scrollLeft,0,`${label}: ${ancestor.id||ancestor.className||ancestor.tag} has no hidden horizontal scroll offset`);
    assert.equal(ancestor.scrollTop,0,`${label}: ${ancestor.id||ancestor.className||ancestor.tag} has no hidden vertical scroll offset`);
  }
}
async function captureCompanyViews(label,topFilename,perspectiveFilename){
  const draft=await page.locator('#chat-message').inputValue();
  const openIds=await page.locator('.canvas-panel[data-open="true"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.panelId));
  assert.ok(openIds.length<=8,'Company-shot setup closes only the bounded existing fixture surfaces');
  // Use the public surface finder to bring each existing header into reach,
  // then its real Close control. Never force-click or change camera state in JS.
  for(const id of openIds){const panel=await openCanvasSurface(page,id);await panel.locator('.canvas-panel-close').click();}
  assert.equal(await page.locator('.canvas-panel[data-open="true"]').count(),0,'Company geometry is captured without popup overlays');
  await page.getByRole('button',{name:'Top view',exact:true}).click();
  await page.getByRole('button',{name:'Fit scene to view',exact:true}).click();await settleCanvas(page);
  await assertTopView(`${label} explicit company plan`);
  const top=await captureGraphics(`${label} explicit company top view`,{requireGeometry:true});
  await assertEndlessShell(page,`${label} company plan`);await assertBlueprintPlane(`${label} company plan`);
  if(topFilename)await screenshot(topFilename);
  await measureTargets(`${label} main HUD`,'#workbench-controls button,.ff-controls button,.canvas-launcher button,.workspace-topbar button');
  await page.getByRole('button',{name:'Perspective view',exact:true}).click();
  await page.getByRole('button',{name:'Fit scene to view',exact:true}).click();await settleCanvas(page);
  const camera=await cameraState(`${label} explicit company relief`);
  assert.ok(Math.abs(camera.pitch)>0&&Math.abs(camera.pitch)<=55,`${label}: the company itself is framed with actual tilt`);
  const relief=await captureGraphics(`${label} explicit company relief`,{requireGeometry:true});
  const visibleRooms=await page.locator('#freeflow-host .ff-node--room').evaluateAll(nodes=>nodes.filter(node=>{
    const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;
  }).map(node=>({id:node.dataset.nodeId,label:node.getAttribute('aria-label')})));
  assert.ok(visibleRooms.length>0,`${label}: the framed company contains real room partitions, not just a floating popup`);
  await screenshot(perspectiveFilename);
  receipt.companyViews??=[];
  receipt.companyViews.push({label,topGraphics:top.state,reliefGraphics:relief.state,reliefInstances:relief.instances,
    tiltDegrees:Math.abs(camera.pitch),visibleRooms,closedSurfaces:openIds,webglVerified:top.state==='webgl'&&relief.state==='webgl'});
  await page.getByRole('button',{name:'Top view',exact:true}).click();
  await page.getByRole('button',{name:'Fit scene to view',exact:true}).click();await settleCanvas(page);
  assert.equal(await page.locator('#chat-message').inputValue(),draft,'Public navigation for company images preserves the existing draft');
  receipt.checks.push(`${label} company floorplan and raised partitions captured before popup framing through public Top/Fit/3D controls`);
}
async function checkGraphicsRecovery(){
  const before=await captureGraphics('1366×768 final plan before lifecycle checks');
  if(before.state!=='webgl'){
    receipt.graphicsRecovery={status:'not-run',reason:'WebGL unavailable; no graphics lifecycle result is claimed'};
    return;
  }
  await page.waitForFunction(()=>['false','0'].includes(document.querySelector('#freeflow-host .ff-scene')?.dataset.graphicsPending));
  const framesBefore=await page.locator('#freeflow-host .ff-scene').getAttribute('data-graphics-frames');
  await page.waitForTimeout(300);
  const framesAfter=await page.locator('#freeflow-host .ff-scene').getAttribute('data-graphics-frames');
  receipt.idleGraphics={milliseconds:300,frames:Number(framesAfter)-Number(framesBefore)};
  // Permit up to two coalesced asynchronous snapshot updates, but reject a
  // continuously running 60 Hz drawing loop when there is no user input.
  assert.ok(receipt.idleGraphics.frames>=0&&receipt.idleGraphics.frames<=2,'Idle relief does not spin a continuous animation loop');
  const extension=await page.locator('#freeflow-host canvas.ff-relief3d').evaluateHandle(canvas=>canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')||null);
  try{
    if(!await extension.evaluate(value=>!!value)){
      receipt.graphicsRecovery={status:'unavailable',reason:'This WebGL context does not expose WEBGL_lose_context'};
      return;
    }
    const draft=await page.locator('#chat-message').inputValue();
    const canonicalBefore=JSON.stringify((await client.snapshot()).snapshot);
    const lossCount=before.contextLosses;
    await extension.evaluate(value=>value.loseContext());
    await page.waitForFunction(expected=>{
      const root=document.querySelector('#freeflow-host .ff-scene');
      return root?.dataset.graphics==='fallback'&&Number(root.dataset.graphicsContextLosses)===expected;
    },lossCount+1);
    assert.equal(await page.locator('#chat-message').inputValue(),draft,'Context loss leaves the semantic popup and its draft intact');
    // Restoration is one explicit standard WebGL lifecycle request, never a
    // new browser/context, renderer substitute, flag change or automatic retry.
    await page.waitForTimeout(100);
    await extension.evaluate(value=>value.restoreContext());
    await page.waitForFunction(previous=>{
      const root=document.querySelector('#freeflow-host .ff-scene');
      return root?.dataset.graphics==='webgl'&&Number(root.dataset.graphicsFrames)>previous;
    },before.frames);
    // A cleared empty frame is insufficient evidence that restored material
    // programs can draw. Public Fit brings actual company geometry back in view.
    await page.getByRole('button',{name:'Fit scene to view',exact:true}).click();await settleCanvas(page);
    const restored=await captureGraphics('1366×768 actual WebGL context restored',{requireGeometry:true});
    assert.equal(restored.contextLosses,lossCount+1,'One real context loss was observed and recovered');
    assert.equal(restored.geometries,before.geometries,'Restoration does not accumulate geometry objects');
    assert.equal(restored.materials,before.materials,'Restoration does not accumulate materials');
    assert.equal(await page.locator('#chat-message').inputValue(),draft,'Restoration preserves the live popup draft');
    assert.equal(JSON.stringify((await client.snapshot()).snapshot),canonicalBefore,'A graphics context lifecycle cannot mutate canonical office state');
    await assertEndlessShell(page,'After real WebGL context restoration');await assertBlueprintPlane('After context restoration');
    await screenshot('07-webgl-restored-1366x768');
    receipt.graphicsRecovery={status:'passed',contextLosses:restored.contextLosses,framesBefore:before.frames,framesAfter:restored.frames,nativeStateUnchanged:true,draftRetained:true};
    receipt.checks.push('Actual WebGL context loss/restoration preserves native state, live drafts and fixed graphics resource bounds');
  }finally{await extension.dispose();}
}
async function checkArrangeControls(){
  const donna=page.locator('.canvas-panel[data-panel-id="donna"]');
  const trigger=donna.locator('.canvas-panel-arrange'),popup=donna.locator('.canvas-arrange-popup');
  const draft=await page.locator('#chat-message').inputValue();
  const roomDraft=await page.locator('#room-name').inputValue();
  const original=await canvasPanelState(page,'donna');
  const world=page.locator('#freeflow-host .ff-world'),camera=await world.evaluate(node=>node.style.transform);
  const input=await page.locator('#chat-message').elementHandle();assert.ok(input,'Arrange starts with the existing live chat form');
  try{
    assert.equal(await trigger.isEnabled(),true,'An expanded unlocked surface can be arranged');
    await trigger.click();await popup.waitFor({state:'visible'});
    assert.equal(await trigger.getAttribute('aria-expanded'),'true');
    assert.equal(await popup.getAttribute('role'),'group','Arrange is a local control group, not a new screen');
    assert.equal(await popup.evaluate(node=>!!node.closest('.ff-world')),true,'Arrange belongs to the same world as its surface');
    assert.equal(await page.locator('.canvas-arrange-popup:not([hidden])').count(),1,'Only one Arrange popup is active');
    assert.equal(await popup.locator('[data-arrange-action]').count(),8,'Arrange exposes all eight movement and sizing actions');
    for(const [name,axis,delta] of [['left','x',-20],['right','x',20],['up','y',-20],['down','y',20],['narrower','width',-20],['wider','width',20],['shorter','height',-20],['taller','height',20]]){
      const before=await canvasPanelState(page,'donna');
      await popup.locator(`[data-arrange-action="${name}"]`).click();
      const after=await canvasPanelState(page,'donna');
      assert.deepEqual(after.rect,{...before.rect,[axis]:before.rect[axis]+delta},`${name}: an actual click changes only the requested dimension by 20 world units`);
      assert.equal(await world.evaluate(node=>node.style.transform),camera,`${name}: popup arrangement does not move the camera`);
      assert.equal(await page.locator('#chat-message').inputValue(),draft,`${name}: the exact unsent chat draft survives`);
      assert.equal(await page.locator('#room-name').inputValue(),roomDraft,`${name}: the other live surface retains its draft`);
    }
    assert.deepEqual((await canvasPanelState(page,'donna')).rect,original.rect,'Inverse Arrange actions restore the exact starting geometry');
    assert.equal(await input.evaluate(node=>node===document.getElementById('chat-message')),true,'Arrange preserves the original input element');
    assert.match(await popup.locator('[role="status"]').innerText(),/Position .*Size /,'Arrange reports the resulting geometry');
    await measureTargets('1366×768 Arrange popup','.canvas-panel[data-panel-id="donna"] .canvas-arrange-popup button,.canvas-panel[data-panel-id="donna"] .canvas-panel-controls button');
    await screenshot('08-arrange-1366x768');
    await page.keyboard.press('Escape');
    assert.equal(await popup.isHidden(),true,'Escape dismisses Arrange');
    assert.equal(await trigger.evaluate(node=>node===document.activeElement),true,'Escape returns focus to Arrange');
    assert.equal(await donna.getAttribute('data-open'),'true','Dismissing Arrange keeps the work surface open');
    await donna.locator('.canvas-panel-pin').click();
    assert.equal(await trigger.isDisabled(),true,'Pinned surfaces disable click arrangement');
    assert.deepEqual((await canvasPanelState(page,'donna')).rect,original.rect,'Pinning changes no geometry');
    await donna.locator('.canvas-panel-pin').click();
    await trigger.click();await popup.locator('.canvas-arrange-close').click();
    assert.equal(await popup.isHidden(),true,'The explicit close control dismisses Arrange');
    assert.equal(await trigger.evaluate(node=>node===document.activeElement),true,'The close control restores focus to Arrange');
    assert.equal(await page.locator('#chat-message').inputValue(),draft);
    assert.equal(receipt.providerCalls,0);assert.deepEqual(receipt.backendNetworkAttempts,[]);
    receipt.arrangeControls={actions:8,stepWorldUnits:20,inverseGeometryRestored:true,liveInputRetained:true,exactDraftsRetained:true,cameraUnchanged:true,pinnedDisabled:true,focusRestored:true};
    receipt.checks.push('Arrange click controls move/resize in exact steps, preserve live drafts, keep the camera fixed and restore focus');
  }finally{await input.dispose();}
}
async function checkCompanyOwnership(company){
  const draft=await page.locator('#chat-message').inputValue();
  const input=await page.locator('#chat-message').elementHandle();
  const world=await page.locator('#freeflow-host .ff-world').elementHandle();
  assert.ok(input&&world,'Ownership starts with the existing canvas and live Donna form');
  try{
    const before=await client.snapshot();
    assert.notEqual(before.snapshot.activeCompanyId,company.id,'Ownership exercises a different company scope');
    await page.locator('.canvas-panel[data-panel-id="donna"] .canvas-panel-close').click();
    assert.equal(await page.locator('#chat-message').inputValue(),draft,'Closing the chat surface keeps its exact draft');
    await page.getByRole('button',{name:'Fit scene to view',exact:true}).click();await settleCanvas(page);
    const footer=page.getByRole('button',{name:`Ownership · ${company.name}`,exact:true});
    assert.equal(await footer.count(),1,'The selected company has one Ownership footer action');
    assert.equal(await footer.evaluate(node=>node.closest('.ff-node')?.dataset.companyFootprint),'true','Ownership is attached to its company floorplan');
    // Fit deliberately frames one readable company. Reach another company's
    // action through real camera input, without browser scrolling, forced
    // clicks, JS camera writes, or selecting its native scope in advance.
    const viewport=page.locator('.ff-canvas-host');await viewport.focus();
    const size=page.viewportSize();assert.ok(size);const navigation=[];
    for(let step=0;step<64;step++){
      const box=await footer.boundingBox();assert.ok(box&&Object.values(box).every(Number.isFinite),'The company footer retains finite geometry');
      const dx=box.x+box.width/2-size.width/2,dy=box.y+box.height/2-size.height/2;
      if(Math.abs(dx)<=100&&Math.abs(dy)<=80)break;
      const key=Math.abs(dx)>100?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp');
      const transform=await page.locator('#freeflow-host .ff-world').evaluate(node=>node.style.transform);
      await page.keyboard.press(key);await settleCanvas(page);navigation.push(key);
      assert.notEqual(await page.locator('#freeflow-host .ff-world').evaluate(node=>node.style.transform),transform,'Public keyboard navigation makes camera progress');
    }
    const targetBox=await footer.boundingBox();assert.ok(targetBox);
    assert.ok(targetBox.x>=24&&targetBox.x+targetBox.width<=size.width-24&&targetBox.y>=150&&targetBox.y+targetBox.height<=size.height-150,'The other company footer is inside the unobstructed canvas before its real pointer click');
    const navigated=await client.snapshot();assert.equal(navigated.snapshot.activeCompanyId,before.snapshot.activeCompanyId,'Camera navigation does not select the other native company');
    receipt.ownershipNavigation={method:'public camera arrow keys',keys:navigation,activeCompanyUnchanged:true,footer:targetBox};
    await footer.click();
    const ownership=page.locator('.canvas-panel[data-panel-id="workspace-softboard"]');
    await ownership.waitFor({state:'visible'});
    await page.waitForFunction(expected=>document.getElementById('office-company-select')?.value===expected.id&&document.querySelector('#workspace-softboard .org-company')?.textContent===expected.name,{id:company.id,name:company.name});
    await settleCanvas(page);
    assert.equal(await ownership.getAttribute('aria-label'),'People & ownership','Ownership reuses the registered people surface');
    assert.equal(await ownership.getAttribute('data-open'),'true');
    assert.equal(await ownership.evaluate(node=>!!node.closest('.ff-world')),true,'People and ownership stays on the infinite canvas');
    await assertPanelTitleInView('workspace-softboard','People & ownership after company footer');
    const confirmed=await client.snapshot();
    assert.equal(confirmed.snapshot.activeCompanyId,company.id,'The footer waits for canonical native company selection');
    const officeId=await page.locator('#office-office-select').inputValue();
    const office=confirmed.snapshot.offices.find(item=>item.id===officeId&&item.companyId===company.id);
    assert.ok(office,'The ownership popup uses an office of the selected company');
    assert.equal(await ownership.locator('.org-company').innerText(),company.name);
    assert.equal(await ownership.locator('.org-office').innerText(),office.name);
    const visibleEmployees=await ownership.locator('.org-person').evaluateAll(nodes=>nodes.map(node=>node.dataset.employeeId));
    assert.ok(visibleEmployees.length>0,'The ownership popup shows canonical assigned people');
    for(const id of visibleEmployees){
      const employee=confirmed.snapshot.employees.find(item=>item.id===id);
      assert.ok(employee&&(employee.companyId===null||employee.companyId===company.id),`Ownership excludes employees of unrelated companies: ${id}`);
    }
    assert.equal(await input.evaluate(node=>node===document.getElementById('chat-message')),true,'Company ownership preserves the same live chat input');
    assert.equal(await page.locator('#chat-message').inputValue(),draft,'Company ownership preserves the exact unsent draft');
    assert.equal(await world.evaluate(node=>node===document.querySelector('#freeflow-host .ff-world')),true,'Ownership does not replace the world');
    await assertEndlessShell(page,'Company Ownership popup');await assertBlueprintPlane('Company Ownership popup');
    assert.equal(await page.locator('iframe').count(),0,'Ownership does not open another screen or iframe');
    await screenshot('09-company-ownership-1440x900');
    await ownership.locator('.canvas-panel-close').click();await openCanvasSurface(page,'donna');
    assert.equal(await page.locator('#chat-message').inputValue(),draft,'Returning to Donna retains the exact draft');
    assert.equal(receipt.providerCalls,0);assert.deepEqual(receipt.backendNetworkAttempts,[]);
    receipt.companyOwnership={companyId:company.id,officeId,visibleEmployees:visibleEmployees.length,nativeScopeConfirmed:true,sameWorld:true,exactDraftRetained:true};
    receipt.checks.push('Company Ownership footer opens the existing People & ownership popup in confirmed native company scope without replacing the canvas or draft');
  }finally{await input.dispose();await world.dispose();}
}
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
  const beforeBlueprints=await client.snapshot();
  const fixtureCompanyIds=new Set(beforeBlueprints.snapshot.companies.filter(company=>['Canvas Smoke Office','Canvas Smoke Studio'].includes(company.name)).map(company=>company.id));
  assert.equal(fixtureCompanyIds.size,2,'Both synthetic companies were created in native state');
  const fixtureOffices=beforeBlueprints.snapshot.offices.filter(office=>fixtureCompanyIds.has(office.companyId));
  assert.ok(fixtureOffices.length>=2&&fixtureOffices.length<=8,'The native fixture has a bounded set of real company offices');
  for(const [index,office] of fixtureOffices.entries())await client.command({action:'ensure_blueprint',officeId:office.id},{id:`canvas-smoke-blueprint-${index}`});
  const initial=await client.snapshot();const companies=initial.snapshot.companies;
  receipt.nativeBlueprints=fixtureOffices.map(office=>{
    const plan=initial.snapshot.blueprints.find(blueprint=>blueprint.officeId===office.id&&blueprint.companyId===office.companyId);
    assert.ok(plan&&plan.rooms.length>0,'Each fixture floorplan is a saved canonical office blueprint');
    return{companyId:office.companyId,officeId:office.id,blueprintId:plan.id,rooms:plan.rooms.length,desks:plan.desks.length};
  });
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
    if(method==='officeCommand')assert.ok(['create_company','select_company','ensure_blueprint','upsert_whiteboard','upsert_sticky_note','register_improvement_allowance','create_improvement_session'].includes(args[0]?.action),'Only the tested company, board and paused improvement state mutations are permitted');
    if(method==='officeCommand'&&args[0]?.action==='upsert_sticky_note')improvementNoteRequests.push(structuredClone(args[0]));
    if(method==='openComputeCenter'){computeObserved.resolve();return{ok:true,harness:'native-command-entry-observed'};}
    try{
      const result=await client.call(method,args,context);
      if(method==='officeCommand'&&args[0]?.action==='create_company'&&args[0]?.name==='Canvas Created Through UI')uiCompanyCommitted.resolve(result);
      if(noteAcknowledgementLossArmed&&method==='officeCommand'&&args[0]?.action==='upsert_sticky_note'){
        noteAcknowledgementLossArmed=false;
        assert.ok(result?.ok&&result.snapshot?.stickyNotes?.some(note=>note.id===args[0].id&&note.text===args[0].text),'Acknowledgement loss is injected only after the actual native write is visible');
        const error=new Error('Fixture acknowledgement lost after native persistence');error.code='IO_ERROR';throw error;
      }
      return result;
    }catch(error){
      const expected=boardConflictExpected&&['STALE_REVISION','CONFLICT'].includes(error.code)||noteAcknowledgementLossExpected&&error.code==='IO_ERROR';
      if(expected){receipt.expectedRpcFailures??=[];receipt.expectedRpcFailures.push({method,code:error.code,error:cleanError(error)});}
      else receipt.rpcFailures.push({method,error:cleanError(error)});throw error;}
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
  await page.waitForFunction(names=>[...document.querySelectorAll('.ff-node-title,.ff-table-plan-title')].some(node=>names.includes(node.textContent)),companies.map(company=>company.name));
  await settleCanvas(page);await assertEndlessShell(page,'VS Code canvas browser harness');
  assert.equal(await page.locator('iframe').count(),0,'No iframe or remote screen hosts the office');
  assert.equal(await page.locator('#workbench-controls').count(),1,'One editor connection control overlay');
  await assertTopView('Fresh 1440×900 session');
  await assertBlueprintPlane('Fresh 1440×900 session');
  await captureGraphics('1440×900 default top view',{requireGeometry:true});
  receipt.checks.push('Canonical companies and saved native blueprints share one default top-view world at 1440×900');
  await screenshot('01-native-office');
  stage='company-geometry-1440';await captureCompanyViews('1440×900',null,'10-company-relief-1440x900');
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
  stage='perspective-1440';
  await page.getByRole('button',{name:'Perspective view',exact:true}).click();await settleCanvas(page);
  const perspective=await cameraState('1440×900 perspective');
  assert.ok(Math.abs(perspective.pitch)>0&&Math.abs(perspective.pitch)<=55,'Optional 3D mode tilts the same bounded camera');
  await captureGraphics('1440×900 perspective with live Donna');
  assert.equal(await page.locator('#chat-message').inputValue(),'Unsent smoke-test draft','Tilting does not replace the live chat form');
  await assertEndlessShell(page,'1440×900 perspective');await assertBlueprintPlane('1440×900 perspective');await screenshot('04-perspective-1440x900');
  await page.getByRole('button',{name:'Top view',exact:true}).click();await settleCanvas(page);await assertTopView('Return from perspective');
  receipt.checks.push('Optional 3D camera shares the native canvas and preserves the live Donna draft');
  stage='company-ownership-popup';
  const ownershipCompany=companies.find(company=>company.name==='Canvas Smoke Studio');assert.ok(ownershipCompany);
  await checkCompanyOwnership(ownershipCompany);
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
  stage='laptop-1366';
  await page.setViewportSize(receipt.viewports[1]);await settleCanvas(page);
  await page.getByRole('button',{name:'Top view',exact:true}).click();await settleCanvas(page);
  await assertTopView('1366×768 top view');await assertEndlessShell(page,'1366×768 laptop');
  await assertBlueprintPlane('1366×768 laptop');
  await assertPanelTitleInView('donna','Donna after 1366×768 viewport resize');
  await captureGraphics('1366×768 existing popup framing after resize');
  stage='company-geometry-1366';await captureCompanyViews('1366×768','05-native-office-1366x768','11-company-relief-1366x768');
  stage='laptop-1366-interactions';
  receipt.panelInteractions=await checkEndlessPanelInteractions(page,'1366×768 laptop');
  receipt.checks.push('1366×768 laptop retains live popup drafts, keyboard move/resize, pinning, pointer Escape rollback and reduced motion');
  stage='arrange-popup';await checkArrangeControls();
  stage='perspective-1366';
  await page.getByRole('button',{name:'Perspective view',exact:true}).click();await settleCanvas(page);
  const beforeRotation=await cameraState('1366×768 before rotation');
  await page.getByRole('button',{name:'Rotate right 15 degrees',exact:true}).click();await settleCanvas(page);
  const rotated=await cameraState('1366×768 rotated perspective');
  assert.ok(Math.abs(rotated.pitch)>0&&Math.abs(rotated.pitch)<=55,'Laptop relief keeps a bounded tilt');
  assert.equal(rotated.yaw,beforeRotation.yaw+15,'Rotation changes the one shared camera');
  const tiltedPanel=await canvasPanelState(page,'donna'),draft=await page.locator('#chat-message').inputValue();
  const worldBeforeTiltedMove=await world.evaluate(node=>node.style.transform);
  await donna.locator('.canvas-panel-grip').focus();await page.keyboard.press('ArrowRight');
  assert.equal((await canvasPanelState(page,'donna')).rect.x,tiltedPanel.rect.x+20,'Keyboard popup movement remains in world coordinates under tilt');
  assert.equal(await world.evaluate(node=>node.style.transform),worldBeforeTiltedMove,'Moving a tilted popup does not pan the world');
  assert.equal(await page.locator('#chat-message').inputValue(),draft,'Tilted movement preserves the unsent draft');
  await captureGraphics('1366×768 rotated perspective with live popups');
  await assertEndlessShell(page,'1366×768 rotated perspective');await assertBlueprintPlane('1366×768 rotated perspective');await screenshot('06-perspective-1366x768');
  await page.getByRole('button',{name:'Top view',exact:true}).click();await settleCanvas(page);await assertTopView('1366×768 return to plan');
  receipt.checks.push('Tilted and rotated laptop view keeps popup keyboard input isolated from the shared camera');
  stage='graphics-lifecycle';await checkGraphicsRecovery();
  stage='board-workflows';await checkBoardWorkflows({page,client,companyId:seeded.id,receipt,screenshot,expectConflict:value=>{boardConflictExpected=value;}});
  stage='improvement-workflows';await checkImprovementWorkflows({page,client,companyId:seeded.id,receipt,screenshot,
    expectConflict:value=>{boardConflictExpected=value;},expectNoteAcknowledgementLoss:value=>{noteAcknowledgementLossExpected=value;noteAcknowledgementLossArmed=value;},noteRequests:()=>improvementNoteRequests});
  persistedView=await page.evaluate(()=>window.__DAFTAR_VIEW_STATE||null);
  assert.ok(!JSON.stringify(persistedView).includes('Unsent'),'Only view preferences persist');
  const rendered=await page.content();receipt.controlCredentialInBrowser=rendered.includes(token)||JSON.stringify(persistedView).includes(token);
  assert.equal(receipt.controlCredentialInBrowser,false,'The runtime control token never enters browser content or persisted state');
  assert.equal(receipt.providerCalls,0);assert.deepEqual(receipt.externalRequests,[]);assert.deepEqual(receipt.backendNetworkAttempts,[]);
  assert.deepEqual(receipt.pageErrors,[]);assert.deepEqual(receipt.cspErrors,[]);assert.deepEqual(receipt.consoleErrors,[]);assert.deepEqual(receipt.rpcFailures,[]);
  receipt.checks.push('No page/CSP/console/RPC errors, external requests, provider calls or credential exposure');
  receipt.graphicsOutcome=receipt.webglVerified?'Actual sandboxed WebGL2 frames observed; hardware acceleration and GPU frame-time performance are not asserted':'Explicit WebGL fallback observed; native canvas acceptance passed but 3D rendering remains unverified on this browser';
  receipt.status='passed';
}catch(error){
  receipt.status=stage==='browser-launch'?'blocked':'failed';receipt.failedStage=stage;receipt.error=cleanError(error);
  if(receipt.status==='blocked')receipt.blocker='The configured browser could not launch with its sandbox enabled. No sandbox exception, policy change or automatic fallback was attempted.';
  try{
    const ids=await page.locator('.canvas-panel[data-open="true"]').evaluateAll(nodes=>nodes.slice(0,8).map(node=>node.dataset.panelId));
    receipt.failurePanelFrames=[];for(const id of ids)receipt.failurePanelFrames.push(await panelFrameEvidence(id));
  }catch{}
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
