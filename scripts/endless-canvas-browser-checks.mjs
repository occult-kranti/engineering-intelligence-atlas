/** Shared real-browser assertions. These functions never run on import. */
import assert from 'node:assert/strict';

export const PANEL_LAYOUT_KEY = 'daftar.endless-workspace.layout.v1';
export async function settleCanvas(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
export async function openCanvasSurface(page, id) {
  const finder = page.getByRole('button', {name: 'Find a surface', exact: true});
  if (await finder.getAttribute('aria-expanded') !== 'true') await finder.click();
  const palette = page.locator('.canvas-palette:not([hidden])');
  await palette.getByRole('searchbox', {name: 'Find a surface', exact: true}).fill(id);
  await palette.locator(`button[data-canvas-open="${id}"]`).click();
  const panel = page.locator(`.canvas-panel[data-panel-id="${id}"]`);
  await panel.waitFor({state: 'visible'});
  // Normal focus uses a bounded 380 ms camera flight. Reduced-motion contexts
  // must settle immediately; native runners can retain their chosen media mode.
  if (!await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) await page.waitForTimeout(450);
  await settleCanvas(page);
  assert.equal(await panel.getAttribute('data-open'), 'true', `${id}: requested surface is open`);
  assert.equal(await panel.evaluate(element => !!element.closest('.ff-world')), true, `${id}: live surface belongs to the same canvas world`);
  return panel;
}
export async function canvasPanelState(page, id) {
  return page.evaluate(([key, panelId]) => {
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    return state.panels?.find(panel => panel.id === panelId) || null;
  }, [PANEL_LAYOUT_KEY, id]);
}
export async function assertEndlessShell(page, label) {
  const state = await page.evaluate(() => {
    const visible = element => !!element && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0;
    const canvas = document.querySelector('#freeflow-host .ff-canvas-host');
    const rect = canvas?.getBoundingClientRect();
    const controls = [...document.querySelectorAll('.canvas-launcher,.ff-controls')].map(element => {
      const b = element.getBoundingClientRect(); return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};
    });
    return {endless:document.body.classList.contains('endless-canvas'),sidebars:[...document.querySelectorAll('.sidebar')].filter(visible).length,
      canvas:rect ? {width:rect.width,height:rect.height} : null, hidden:!visible(canvas), controls,
      width:innerWidth,height:innerHeight, worlds:document.querySelectorAll('#freeflow-host .ff-world').length,
      overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+1};
  });
  assert.equal(state.endless,true,`${label}: endless canvas mode`);
  assert.equal(state.sidebars,0,`${label}: old sidebar is not a competing screen`);
  assert.equal(state.worlds,1,`${label}: one world`);
  assert.equal(state.hidden,false,`${label}: canvas remains visible at every viewport`);
  assert.ok(state.canvas && state.canvas.width>0 && state.canvas.height>0,`${label}: finite visible viewport`);
  assert.equal(state.overflow,false,`${label}: world does not overflow the browser document`);
  assert.equal(state.controls.length,2,`${label}: camera controls and surface launcher remain available`);
  for(const box of state.controls) assert.ok(Object.values(box).every(Number.isFinite)&&box.width>0&&box.height>0&&box.x>=-1&&box.y>=-1&&box.right<=state.width+1&&box.bottom<=state.height+1,`${label}: controls inside viewport ${JSON.stringify(box)}`);
}

/** Uses actual keyboard/pointer input on the persistent live forms; no mutations are submitted. */
export async function checkEndlessPanelInteractions(page, label) {
  await assertEndlessShell(page,label);
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true, `${label}: gesture fixture uses reduced motion`);
  const donna=await openCanvasSurface(page,'donna');
  const conversation=await page.locator('#donna-conversation').elementHandle();
  assert.ok(conversation, 'Donna has one live conversation element');
  const draft=`Unsent canvas draft · ${label}`;
  const briefTab=donna.locator('#donna-tab-brief');
  // Sending a brief moves the real studio to Conversation. Open the composer
  // through its public tab rather than assuming an already-open Brief view.
  if(await briefTab.getAttribute('aria-selected')!=='true')await briefTab.click();
  await donna.locator('#chat-message').fill(draft);
  const blueprint=await openCanvasSurface(page,'workspace-blueprint');
  const roomDraft=`Unsent room · ${label}`;
  await page.locator('#room-name').fill(roomDraft);
  assert.equal(await donna.getAttribute('data-open'),'true','Opening a second surface retains Donna');
  await openCanvasSurface(page,'workspace-timeline');
  assert.equal(await blueprint.getAttribute('data-open'),'true','Opening the roadmap retains blueprint');
  assert.equal(await page.locator('#chat-message').inputValue(),draft);
  assert.equal(await page.locator('#room-name').inputValue(),roomDraft);
  assert.equal(await page.locator('.canvas-panel[data-open="true"]').count()>=3,true,'At least three live surfaces coexist');

  await openCanvasSurface(page,'donna');
  const grip=donna.locator('.canvas-panel-grip');
  if (await donna.locator('.canvas-panel-pin').getAttribute('aria-pressed') === 'true') await donna.locator('.canvas-panel-pin').click();
  const before=await canvasPanelState(page,'donna');
  assert.ok(before?.rect, 'Geometry preferences exist before input tests');
  await grip.focus();await page.keyboard.press('ArrowRight');
  const moved=await canvasPanelState(page,'donna');
  assert.equal(moved.rect.x,before.rect.x+20,'Keyboard drag uses world coordinates');
  await donna.locator('.canvas-panel-pin').click();
  await grip.focus();await page.keyboard.press('Shift+ArrowRight');
  assert.deepEqual((await canvasPanelState(page,'donna')).rect,moved.rect,'Pinned panel cannot be moved');
  assert.equal(await donna.locator('.canvas-panel-resize').isDisabled(),true,'Pinned resize is disabled');
  await donna.locator('.canvas-panel-pin').click();
  await donna.locator('.canvas-panel-resize').focus();await page.keyboard.press('ArrowRight');
  const resized=await canvasPanelState(page,'donna');
  assert.equal(resized.rect.width,moved.rect.width+20,'Keyboard resizing changes only geometry');
  assert.equal(await page.locator('#chat-message').inputValue(),draft);

  await openCanvasSurface(page,'donna');
  const originalTransform=await donna.evaluate(element=>element.style.transform);
  const box=await grip.boundingBox();assert.ok(box&&box.width>0&&box.height>0,'Drag handle has a real browser box');
  await page.mouse.move(box.x+Math.min(box.width/2,60),box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+Math.min(box.width/2,60)+38,box.y+box.height/2+24,{steps:4});
  assert.notEqual(await donna.evaluate(element=>element.style.transform),originalTransform,'Pointer drag moves the live panel');
  await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await donna.evaluate(element=>element.style.transform),originalTransform,'Escape rolls back a pointer gesture');
  assert.equal(await donna.evaluate(element=>element.classList.contains('is-moving')),false);

  await donna.locator('.canvas-panel-collapse').click();
  assert.equal(await donna.locator('.canvas-panel-body').isHidden(),true);
  assert.equal(await page.locator('#chat-message').inputValue(),draft);
  await donna.locator('.canvas-panel-collapse').click();
  await donna.locator('.canvas-panel-close').click();
  await openCanvasSurface(page,'donna');
  assert.equal(await conversation.evaluate(node=>node===document.getElementById('donna-conversation')),true,'Same conversation DOM survives close/reopen');
  assert.equal(await page.locator('#chat-message').inputValue(),draft);
  assert.equal(await page.locator('#donna-conversation').count(),1);
  assert.equal(await page.locator('#workspace-chat-form').count(),1);
  const saved=await page.evaluate(key=>localStorage.getItem(key),PANEL_LAYOUT_KEY);
  assert.equal(typeof saved, 'string', 'Layout preferences are stored');
  assert.ok(!saved.includes(draft)&&!saved.includes(roomDraft),'Layout preferences never serialize private form drafts');

  const world=page.locator('#freeflow-host .ff-world');
  const settled=await world.evaluate(element=>element.style.transform);
  await page.waitForTimeout(450);
  assert.equal(await world.evaluate(element=>element.style.transform),settled,'Reduced motion applies focus immediately without a delayed camera flight');
  await conversation.dispose();
  return {simultaneousPanels:true,draftsRetained:true,keyboardMove:true,pinned:true,keyboardResize:true,escapeCancelsPointer:true,reducedMotion:true};
}
