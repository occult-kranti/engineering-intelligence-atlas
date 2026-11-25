/** Full mounted renderer smoke in Chromium, with an explicitly synthetic bridge.
 * No native store, user records, provider calls or production credentials. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {installRendererFixture} from './fixtures/renderer-bridge.mjs';

const shell=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const renderer=path.join(shell,'dist/renderer');
const out=path.resolve(process.env.DONNA_BRAIN_SMOKE_OUT||path.join(shell,'.work/donna-brain-ui'));
const require=createRequire(path.resolve(shell,'../site-source/package.json'));
const {chromium}=require('playwright');
fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],visualChecks=[];
async function assertRecordContrast(pane){
  const result=await pane.evaluate(root=>{
    // Same flat-sRGB luminance method as smoke-static.mjs; these cards use opaque theme surfaces.
    const parse=value=>{
      const match=value.match(/^rgba?\((.*)\)$/i),parts=match?.[1].trim().split(/[\s,/]+/);
      if(!parts||parts.length<3||parts.length>4)throw new Error(`Unsupported computed card color: ${value}`);
      const channels=parts.slice(0,3).map(v=>parseFloat(v)/(v.endsWith('%')?100:255));
      const alpha=parts.length===4?parseFloat(parts[3])/(parts[3].endsWith('%')?100:1):1;
      if(alpha!==1||!channels.every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw new Error(`Expected opaque sRGB card color: ${value}`);
      return channels;
    };
    const luminance=color=>color.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const samples=[...root.querySelectorAll('.brain-record')].flatMap(card=>{
      const style=getComputedStyle(card),background=style.backgroundColor;
      if(style.backgroundImage!=='none'||Number(style.opacity)!==1)throw new Error('Card contrast requires a flat opaque surface.');
      const back=luminance(parse(background));
      return [...card.querySelectorAll('.brain-record-copy strong,.brain-record-copy>span,.brain-record-meta>span')].filter(el=>el.textContent.trim()).map(el=>{
        const foreground=getComputedStyle(el).color,front=luminance(parse(foreground));
        return {record:card.dataset.brainRecord,text:el.textContent.slice(0,60),foreground,background,ratio:(Math.max(front,back)+.05)/(Math.min(front,back)+.05)};
      });
    });
    return {theme:document.documentElement.dataset.theme,samples};
  });
  assert.ok(result.samples.length>=8,'Expected record title, summary, kind and state contrast samples.');
  for(const sample of result.samples)assert.ok(sample.ratio>=4.5,`${result.theme} card text below 4.5:1: ${JSON.stringify(sample)}`);
  visualChecks.push({kind:'record-card-contrast',...result});
}
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(renderer,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(renderer+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  const executablePath=process.env.DONNA_BRAIN_CHROMIUM_EXECUTABLE||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce'});
  await context.addInitScript({content:`(${installRendererFixture.toString()})(window);
    window.__atlasFixture.office.knowledge.push(
      {id:'smoke-decision',companyId:'fixture-company',title:'Cache invalidation follows evidence',summary:JSON.stringify({kind:'daftar-brain-note',version:1,type:'decision',body:'Invalidate recall when a source or company grant changes. Retain the earlier record for review.',tags:['cache','evidence'],supersedes:null,expiresAt:null}),artifactUri:'https://example.invalid/review/commit-abc',createdAt:'2026-11-19T12:00:00Z'},
      {id:'smoke-question',companyId:'fixture-company',title:'Which repository needs a pinned review?',summary:JSON.stringify({kind:'daftar-brain-note',version:1,type:'question',body:'Record the commit and acceptance evidence before marking repository coverage complete.',tags:['repository'],supersedes:null,expiresAt:null}),artifactUri:'',createdAt:'2026-11-19T12:00:00Z'},
      {id:'foreign-canary',companyId:'other-company',title:'OTHER-COMPANY-PRIVATE-CANARY',summary:'Synthetic isolation check.',artifactUri:'',createdAt:'2026-11-19T12:00:00Z'}
    );`});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/chrome.html');
  // The status lives inside the initially closed Company & department canvas
  // panel. Wait for the loaded state without requiring that unrelated panel to
  // be visible; the Brain surface is explicitly opened immediately afterward.
  await page.waitForFunction(()=>document.getElementById('office-native-status')?.textContent?.includes('Local state loaded'));
  await page.locator('#header-open-brain').click();
  const pane=page.locator('.canvas-panel[data-panel-id="brain"]');await pane.waitFor({state:'visible'});
  await pane.locator('.brain-scope').filter({hasText:'Fixture Engineering'}).waitFor();
  assert.ok(!(await pane.innerText()).includes('OTHER-COMPANY-PRIVATE-CANARY'));checks.push('Built-in canvas surface uses only active-company records.');
  await pane.locator('[data-brain-record="knowledge:smoke-decision"]').click();
  assert.match(await pane.locator('.brain-inspector').innerText(),/saved record summary/);checks.push('Record inspection exposes source reference and honest reading depth.');
  const geometry=await pane.locator('.brain-graph svg').evaluate(drawing=>{
    const matrix=drawing.getScreenCTM(),box=drawing.viewBox.baseVal;
    if(!matrix)throw new Error('Expected mounted SVG transform matrix.');
    return {reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,viewBox:{x:box.x,y:box.y,width:box.width,height:box.height},nodes:[...drawing.querySelectorAll('.brain-graph-node')].map(group=>{
      const circle=group.querySelector('circle'),label=group.querySelector('text'),rect=circle.getBoundingClientRect();
      const authored={x:circle.cx.baseVal.value,y:circle.cy.baseVal.value};
      const expected=new DOMPoint(authored.x,authored.y).matrixTransform(matrix);
      const actual=new DOMPoint(rect.x+rect.width/2,rect.y+rect.height/2);
      const local=actual.matrixTransform(matrix.inverse()),labelMatrix=label.getScreenCTM();
      if(!labelMatrix||!label.textContent)throw new Error('Expected a positioned graph label.');
      const labelStart=label.getStartPositionOfChar(0),labelPoint=new DOMPoint(labelStart.x,labelStart.y).matrixTransform(labelMatrix),labelExpected=new DOMPoint(authored.x+14,authored.y+4).matrixTransform(matrix);
      return {id:group.dataset.brainNode,authored,center:{x:local.x,y:local.y},radius:rect.width/2,centerError:Math.hypot(actual.x-expected.x,actual.y-expected.y),labelError:Math.hypot(labelPoint.x-labelExpected.x,labelPoint.y-labelExpected.y)};
    })};
  });
  assert.ok(geometry.reducedMotion,'Geometry regression must run with reduced motion enabled.');
  assert.ok(geometry.nodes.length>=4,'Expected several graph nodes from the synthetic company.');
  assert.equal(new Set(geometry.nodes.map(n=>`${n.center.x.toFixed(1)},${n.center.y.toFixed(1)}`)).size,geometry.nodes.length,'Graph nodes must not collapse onto one another.');
  for(const node of geometry.nodes){
    assert.ok(node.radius>0&&node.centerError<.75&&node.labelError<.75,`Graph circle/label must match authored SVG geometry: ${JSON.stringify(node)}`);
    assert.ok(node.center.x>=geometry.viewBox.x+10&&node.center.y>=geometry.viewBox.y+30&&node.center.x<geometry.viewBox.x+geometry.viewBox.width-10&&node.center.y<geometry.viewBox.y+geometry.viewBox.height-10,`Graph node must remain inside the authored viewBox: ${JSON.stringify(node)}`);
  }
  visualChecks.push({kind:'reduced-motion-geometry',...geometry});checks.push('Reduced-motion graph circles and labels retain distinct, correctly positioned SVG geometry.');
  await assertRecordContrast(pane);
  await pane.screenshot({path:path.join(out,'brain-desktop.png')});
  await pane.locator('[id$="-search"]').fill('cache');await pane.locator('[data-brain-action="recall"]').click();
  assert.match(await pane.locator('.brain-recall').innerText(),/Cache invalidation follows evidence/);checks.push('Real bounded recall function finds the saved decision inside the mounted renderer.');
  await pane.locator('[id$="-search"]').fill('');
  await pane.locator('[id$="-title"]').fill('Browser smoke observation');await pane.locator('[id$="-body"]').fill('This is a synthetic adapter observation, not a native persistence receipt.');
  await pane.locator('[data-brain-action="save-note"]').click();await pane.locator('.brain-message').filter({hasText:'Saved memory'}).waitFor();
  const actions=await page.evaluate(()=>window.__atlasFixture.calls.filter(c=>c.name==='officeCommand').map(c=>c.args));
  assert.equal(actions.filter(c=>c.action==='add_knowledge'&&c.title==='Browser smoke observation').length,1);
  checks.push('Explicit save reaches the existing office command adapter once and renders its returned record.');
  await pane.locator('[data-brain-action="prepare-setup"]').click();
  assert.match(await pane.locator('.brain-setup-preview').innerText(),/manual · \$0 provider allowance/);
  await pane.locator('[data-brain-action="save-setup"]').click();await pane.locator('.brain-save-receipt').waitFor();
  const setup=await page.evaluate(()=>window.__atlasFixture.calls.filter(c=>c.name==='officeCommand'&&c.args.action==='create_goal').at(-1)?.args);
  assert.equal(setup.mode,'plan');assert.equal(setup.runSettings.maxUsd,0);assert.equal(setup.runSettings.authorized,false);
  checks.push('Explicit setup save creates a manual, unauthorized, zero-dollar planning goal; no execution command is sent.');
  await page.locator('html').evaluate(el=>el.dataset.theme='drafting');
  await assertRecordContrast(pane);checks.push('Record titles, summaries, kinds and states meet 4.5:1 flat-color contrast in both captured themes.');
  await pane.screenshot({path:path.join(out,'brain-drafting.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('#header-open-brain').click();
  assert.ok(await pane.isVisible());await page.screenshot({path:path.join(out,'brain-mobile-canvas.png'),fullPage:false});
  checks.push('Brain remains reachable through the native canvas after a narrow viewport resize.');
  assert.deepEqual(errors,[]);
  const report={at:new Date().toISOString(),passed:true,checks,visualChecks,scope:'Chromium mounted renderer with a synthetic in-memory bridge; not native persistence, authorization-server, provider, deployment or real-company evidence.',screenshots:['brain-desktop.png','brain-drafting.png','brain-mobile-canvas.png'],pageErrors:errors};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));await context.close();
}catch(error){
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({at:new Date().toISOString(),passed:false,checks,visualChecks,error:String(error),scope:'Attempted mounted Chromium smoke using a synthetic adapter; failed checks and screenshots are not claimed.',pageErrors:errors},null,2)+'\n');
  throw error;
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
