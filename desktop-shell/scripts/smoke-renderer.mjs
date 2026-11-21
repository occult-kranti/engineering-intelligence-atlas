#!/usr/bin/env node
/**
 * Real-browser renderer smoke. A test-only bridge supplies deterministic state;
 * no native operations, GitHub requests, model calls, or user credentials occur.
 * Start a server for dist/renderer, then set ATLAS_UI_BASE_URL if not using :8752.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {installRendererFixture} from '../tests/fixtures/renderer-bridge.mjs';
let playwright;
try { playwright=await import('playwright'); }
catch(error) {
  if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) throw new Error('Install Playwright in the development environment before running this optional browser suite.',{cause:error});
  playwright=await import(pathToFileURL(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright','index.mjs')).href);
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.env.ATLAS_UI_OUTPUT || path.join(root,'test-results','renderer');
const base=process.env.ATLAS_UI_BASE_URL || 'http://127.0.0.1:8752/chrome.html';
await mkdir(output,{recursive:true});
const browser=await playwright.chromium.launch({headless:true,...(process.env.ATLAS_CHROMIUM_EXECUTABLE?{executablePath:process.env.ATLAS_CHROMIUM_EXECUTABLE}:{}),args:process.env.ATLAS_BROWSER_NO_SANDBOX==='1'?['--no-sandbox']:[]});
const errors=[];const checks=[];const screenshots=[];
try {
  for(const viewport of [{width:1440,height:1000},{width:800,height:1000},{width:390,height:844}]) {
    const page=await browser.newPage({viewport,reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push({viewport,message:error.message}));
    await page.addInitScript(`(${installRendererFixture.toString()})(window)`);
    await page.goto(base,{waitUntil:'networkidle'});
    for(const view of ['overview','office','projects','team','roadmap','usage','library','models','settings']) {
      await page.locator(`.nav-item[data-view="${view}"]`).click();
      await page.waitForFunction(()=>document.querySelectorAll('.view:not(.hidden)').length===1);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
      assert.equal(overflow,false,`${view} has document-level horizontal overflow at ${viewport.width}`);
      assert.equal(await page.locator(`.nav-item[data-view="${view}"]`).getAttribute('aria-current'),'page');
      checks.push({view,viewport:viewport.width,overflow:false});
      if(viewport.width===1440||viewport.width===390&&['overview','office','projects'].includes(view)) {
        const screenshot=`${view}-${viewport.width}.png`;await page.screenshot({path:path.join(output,screenshot),fullPage:true});screenshots.push(screenshot);
      }
    }
    await page.locator('.nav-item[data-view="office"]').click();
    await page.locator('#ceo-toggle').click();
    await page.locator('#ceo-optimize').click();
    assert.equal(await page.locator('#ceo-panel').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,`CEO portfolio overflows at ${viewport.width}`);
    checks.push({workspaceView:'ceo-portfolio',viewport:viewport.width});
    const portfolioScreenshot=`ceo-portfolio-${viewport.width}.png`;await page.screenshot({path:path.join(output,portfolioScreenshot),fullPage:true});screenshots.push(portfolioScreenshot);
    await page.locator('#ceo-toggle').click();
    for(const workspaceTab of ['chat','blueprint','whiteboard']) {
      await page.locator(`[data-workspace-tab="${workspaceTab}"]`).click();
      assert.equal(await page.locator(`#workspace-panel-${workspaceTab}`).isVisible(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,`Workspace ${workspaceTab} overflows at ${viewport.width}`);
      checks.push({workspaceTab,viewport:viewport.width});
      if(viewport.width===1440||viewport.width===390){const screenshot=`workspace-${workspaceTab}-${viewport.width}.png`;await page.screenshot({path:path.join(output,screenshot),fullPage:true});screenshots.push(screenshot);}
    }
    await page.locator('#office-tools > summary').click();
    for(const tab of ['overview','people','queue','memory','ledger']) {
      await page.locator(`[data-office-tab="${tab}"]`).click();
      assert.equal(await page.locator(`#office-panel-${tab}`).isVisible(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,`Office ${tab} overflows at ${viewport.width}`);
      checks.push({officeTab:tab,viewport:viewport.width});
    }
    await page.locator('.nav-item[data-view="projects"]').click();
    await page.locator('#new-project-details > summary').click();
    assert.equal(await page.locator('#new-project-details').evaluate(element=>element.open),true);
    await page.locator('#proj-name').fill('Browser fixture project');await page.locator('#proj-goal').fill('Verify the project flow without a provider call.');await page.locator('#proj-model').fill('fixture-model');
    await page.locator('#project-form button[type="submit"]').click();await page.waitForFunction(()=>window.__atlasFixture.calls.some(c=>c.name==='createProject'));
    await page.locator('#run-start').click();assert.match(await page.locator('#run-status').innerText(),/positive provider pricing/);
    checks.push({flow:'project creation and unpriced cloud-run rejection',viewport:viewport.width});
    await page.close();
  }
  const starter=await browser.newPage({viewport:{width:1440,height:1000}});await starter.addInitScript(`(${installRendererFixture.toString()})(window);window.desktopBridge.transport='public-preview';`);await starter.goto(base,{waitUntil:'networkidle'});assert.match(await starter.locator('#bridge-notice').innerText(),/data is an example workspace/);assert.equal(await starter.locator('#chat-send').isDisabled(),true);await starter.close();
  const preview=await browser.newPage({viewport:{width:1440,height:1000}});preview.on('pageerror',error=>errors.push({surface:'unconnected-preview',message:error.message}));await preview.goto(base,{waitUntil:'networkidle'});assert.equal(await preview.locator('#bridge-notice').isVisible(),true);await preview.screenshot({path:path.join(output,'preview-unconnected-1440.png'),fullPage:true});await preview.close();
  assert.deepEqual(errors,[],'No uncaught renderer errors');
  const report={suite:'real-browser renderer smoke',passed:true,fixtureOnly:true,nativeValidation:false,providerCalls:0,checks,screenshots,errors};
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks:checks.length,screenshots:screenshots.length,output,fixtureOnly:true}));
} finally { await browser.close(); }
