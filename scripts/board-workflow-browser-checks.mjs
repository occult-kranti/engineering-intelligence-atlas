/** Real, sandboxed-browser board checks against temporary native state. No providers. */
import assert from 'node:assert/strict';
import { openCanvasSurface, settleCanvas, assertEndlessShell } from './endless-canvas-browser-checks.mjs';

const estimate = (optimisticMinutes, likelyMinutes, pessimisticMinutes) => ({ optimisticMinutes, likelyMinutes, pessimisticMinutes });
async function eventually(read, predicate, label) {
  const end = Date.now() + 10000;
  do { const value = await read(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 80)); } while (Date.now() < end);
  throw new Error(label);
}

export async function checkBoardWorkflows({ page, client, companyId, receipt, screenshot, expectConflict }) {
  const seed = (command, id) => client.command(command, { id: `board-browser-${id}` });
  await seed({ action:'select_company', companyId }, 'select');
  let snapshot = (await client.snapshot()).snapshot;
  const office = snapshot.offices.find(row => row.companyId === companyId);
  assert.ok(office, 'The board fixture uses a real company office');
  await seed({action:'ensure_blueprint',officeId:office.id}, 'blueprint');
  snapshot = (await client.snapshot()).snapshot;
  const blueprint = snapshot.blueprints.find(row => row.officeId === office.id);
  const room = blueprint.rooms.find(row => !row.departmentId) || blueprint.rooms[0];
  const primary = 'donna', reviewer = office.assistantId;
  assert.notEqual(primary, reviewer, 'Native fixture primary and helper are distinct employees');
  const goals = [], jobs = [], outcomes = [];
  for (const suffix of ['A','B']) {
    const goal = await seed({action:'create_goal',scope:{kind:'office',id:office.id},title:`Board goal ${suffix}`,description:'Synthetic board links; no execution.',mode:'plan'}, `goal-${suffix}`);
    const goalId = goal.snapshot.goals.find(row => row.title === `Board goal ${suffix}`).id;goals.push(goalId);
    await seed({action:'set_goal_plan',goalId,steps:[{id:`browser-step-${suffix}`,title:`Paired board step ${suffix}`,
      employeeId:primary,reviewerEmployeeId:reviewer,goal:'Prepare a bounded board deliverable with an independent helper.',dependsOn:[],
      estimate:estimate(10,20,30),reviewEstimate:estimate(2,5,8)}]},`plan-${suffix}`);
    const queued = await seed({action:'enqueue_job',companyId,officeId:office.id,employeeId:primary,reviewerEmployeeId:reviewer,
      goal:`Synthetic board job ${suffix}`,mode:'manual',provider:'ollama',model:'synthetic-not-running',authorized:false,
      allowedTools:[],dependencies:[],maxTokens:32000,maxUsd:0,maxMinutes:5,idempotencyKey:`board-browser-job-${suffix}`}, `job-${suffix}`);
    jobs.push(queued.snapshot.lastAction.jobId);
    const id = `board-browser-outcome-${suffix}`;
    await seed({action:'upsert_roadmap_item',id,scope:{kind:'company',id:companyId},title:`Reviewable outcome ${suffix}`,
      description:'A paired planning range with explicit ownership.',ownerEmployeeId:primary,reviewerEmployeeId:reviewer,
      departmentId:null,serviceContractId:null,reviewerServiceContractId:null,status:'planned',dependencies:suffix==='B'?[outcomes[0]]:[],
      goalIds:[goalId],jobIds:[jobs.at(-1)],estimate:estimate(10,20,30),reviewEstimate:estimate(2,5,8)}, `outcome-${suffix}`);
    outcomes.push(id);
  }
  const boardId = 'board-browser-linked-card';
  await seed({action:'upsert_whiteboard',id:boardId,officeId:office.id,roomId:room.id,ownerEmployeeId:primary,title:'Linked delivery card',
    goalIds:goals,jobIds:jobs,roadmapItemIds:outcomes,x:0.25,y:0.2}, 'card');
  const board = async () => (await client.snapshot()).snapshot.blueprints.find(row => row.officeId===office.id).whiteboards.find(row=>row.id===boardId);
  await page.locator('#workspace-refresh').click();
  await page.waitForFunction(id=>document.getElementById('office-company-select')?.value===id,companyId);
  await page.setViewportSize({width:1440,height:900});
  let panel = await openCanvasSurface(page,'workspace-whiteboard');
  await page.locator('#whiteboard-search').fill('Linked delivery card');
  const card = () => page.locator(`[data-board-id="${boardId}"]`);
  await card().locator('.card-title').click();
  assert.equal(await page.locator('#node-goal-links button').count(),2,'All goals appear as explicit removable links');
  assert.equal(await page.locator('#node-job-links button').count(),2,'All job links are preserved in the editor');
  assert.equal(await page.locator('#node-roadmap-links button').count(),2,'All outcomes are preserved in the editor');
  await page.locator('#node-title').fill('Linked delivery card · renamed');
  await page.locator('#node-save').click();
  const renamed = await eventually(board,row=>row.title==='Linked delivery card · renamed','Whiteboard title did not persist');
  await page.waitForFunction(()=>document.getElementById('node-save-status')?.textContent.startsWith('Card saved.'));
  assert.deepEqual(renamed.goalIds,goals);assert.deepEqual(renamed.jobIds,jobs);assert.deepEqual(renamed.roadmapItemIds,outcomes);
  assert.equal(renamed.revision,1,'The real native save increments the record revision');
  receipt.checks.push('Whiteboard title edit preserves all six native work links and increments the saved revision');
  await screenshot('12-whiteboard-links-1440x900');

  // Simulate another editor, then refresh this stale form. Its retained base revision must survive.
  await card().locator('.card-title').click();
  await page.locator('#node-title').fill('Unsent stale card draft');
  await seed({action:'upsert_whiteboard',...renamed,officeId:office.id,expectedRevision:renamed.revision,title:'Saved by the other editor'}, 'other-editor');
  await page.locator('#workspace-refresh').click();
  await page.waitForFunction(()=>document.getElementById('node-save-status')?.textContent.includes('changed after'));
  assert.equal(await page.locator('#node-title').inputValue(),'Unsent stale card draft','Refresh preserves the original draft');
  expectConflict(true);
  try {
    await page.locator('#node-save').click();
    await page.waitForFunction(()=>document.getElementById('node-save-status')?.textContent.includes('original edit revision'));
    await eventually(async()=>page.locator('#node-save').isEnabled(),Boolean,'Rejected save did not release its pending control');
  } finally { expectConflict(false); }
  assert.equal((await board()).title,'Saved by the other editor','A stale form cannot overwrite newer work');
  assert.equal(await page.locator('#node-title').inputValue(),'Unsent stale card draft','The rejected draft remains available to reconcile');
  await page.locator('#node-reload').click();
  assert.equal(await page.locator('#node-title').inputValue(),'Saved by the other editor','Explicit reload replaces the discarded draft');
  await page.locator('#whiteboard-search').fill('');
  receipt.checks.push('Concurrent native edit plus background refresh rejects stale save and preserves the draft until explicit reload');

  // Both movement methods operate on the saved card, not on a second frontend work record.
  panel = await openCanvasSurface(page,'workspace-whiteboard');
  const beforeKey = await board();
  await card().locator('.card-title').focus();await page.keyboard.press('ArrowRight');
  const afterKey = await eventually(board,row=>row.revision>beforeKey.revision,'Keyboard card move did not persist');
  await page.waitForFunction(x=>document.getElementById('node-x')?.value===String(Math.round(x*100)),afterKey.x);
  assert.ok(Math.abs(afterKey.x-Math.min(1,beforeKey.x+0.02))<1e-8,'Keyboard move advances two normalized percentage points');
  assert.equal(afterKey.y,beforeKey.y);assert.deepEqual(afterKey.goalIds,goals);
  await page.getByRole('button',{name:'Perspective view',exact:true}).click();
  await page.getByRole('button',{name:'Rotate right 15 degrees',exact:true}).click();
  await settleCanvas(page);
  const tiltedTransform = await page.locator('#freeflow-host .ff-world').evaluate(element=>element.style.transform);
  assert.match(tiltedTransform,/rotateX\((?!0(?:deg)?\))/,'The card drag is exercised with actual pitch');
  assert.match(tiltedTransform,/rotate\((?!0(?:deg)?\))/,'The card drag is exercised with actual rotation');
  const title = card().locator('.card-title');await title.scrollIntoViewIfNeeded();
  const bounds = await title.boundingBox();assert.ok(bounds&&bounds.width>0&&bounds.height>0);
  const saved = await board(), style = await card().getAttribute('style');
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();
  await page.mouse.move(bounds.x+bounds.width/2+28,bounds.y+bounds.height/2+16,{steps:4});
  assert.match(await card().getAttribute('class'),/\bis-moving\b/,'The transformed pointer actually starts a drag');
  assert.notEqual(await card().getAttribute('style'),style,'A nonzero drag preview precedes cancellation');
  await page.keyboard.press('Escape');await page.mouse.up();await settleCanvas(page);
  assert.equal(await card().getAttribute('style'),style,'Escape restores the original transformed board position');
  assert.equal((await board()).revision,saved.revision,'Cancelled tilted drag never mutates native state');
  await screenshot('13-whiteboard-tilted-1440x900');
  await page.getByRole('button',{name:'Top view',exact:true}).click();
  receipt.checks.push('Whiteboard keyboard placement persists canonical coordinates; tilted pointer Escape restores geometry with no write');

  const controlGeometry=[];
  async function reachable(panel,selector,label) {
    const control=page.locator(selector);await control.click();
    const panelBox=await panel.boundingBox(),controlBox=await control.boundingBox(),viewport=page.viewportSize();
    for(const [name,box] of [['panel',panelBox],['control',controlBox]]){
      assert.ok(box&&Object.values(box).every(Number.isFinite)&&box.width>0&&box.height>0,`${label}: finite ${name}`);
      assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,`${label}: ${name} inside the laptop viewport`);
    }
    controlGeometry.push({label,viewport,panel:panelBox,control:controlBox});
  }
  for (const [width,height] of [[1440,900],[1366,768]]) {
    await page.setViewportSize({width,height});
    const whiteboard=await openCanvasSurface(page,'workspace-whiteboard');
    await reachable(whiteboard,'#whiteboard-search',`Whiteboard ${width}x${height}`);
    await card().locator('.card-title').click();
    assert.equal(await page.locator('#node-title').inputValue(),'Saved by the other editor');
    await screenshot(`16-whiteboard-${width}x${height}`);
    const people=await openCanvasSurface(page,'workspace-softboard');
    assert.equal(await people.getAttribute('aria-label'),'People & ownership');
    assert.match(await people.innerText(),/greenboard/i,'Greenboard is a visible alias of the canonical ownership surface');
    assert.ok(await people.locator('.org-person').count()>0,'Ownership displays actual assigned people');
    await reachable(people,'#softboard-search',`Greenboard ${width}x${height}`);
    await people.locator(`.org-person[data-employee-id="${reviewer}"]`).click();
    assert.match(await page.locator('#softboard-person-detail').innerText(),/Primary: Donna/);
    assert.match(await page.locator('#softboard-person-detail').innerText(),/Independent helper\/reviewer:/);
    await screenshot(`14-greenboard-${width}x${height}`);
    const roadmap=await openCanvasSurface(page,'workspace-timeline');
    await reachable(roadmap,'#studio-roadmap-search',`Roadmap ${width}x${height}`);
    await page.locator('#studio-roadmap-search').fill('Reviewable outcome');
    assert.ok((await roadmap.innerText()).includes('Reviewable outcome A'));
    assert.ok((await roadmap.innerText()).includes('Reviewable outcome B'));
    const forecast=await page.locator('#studio-roadmap-forecast').innerText();
    assert.match(forecast,/Dependency lower bound/);assert.match(forecast,/staffing scenario/);
    assert.doesNotMatch(forecast,/NaN|Infinity/);
    assert.ok((await roadmap.innerText()).includes('reviewer'),'Roadmap exposes the actual paired role');
    await screenshot(`15-roadmap-${width}x${height}`);
    await assertEndlessShell(page,`${width}x${height} board workflows`);
  }
  receipt.boardWorkflows={companyId,officeId:office.id,boardId,linkedGoals:goals.length,linkedJobs:jobs.length,linkedOutcomes:outcomes.length,
    multiLinkEdit:true,staleDraftProtected:true,keyboardMove:true,tiltedCancel:true,viewports:[{width:1440,height:900},{width:1366,height:768}],
    controlGeometry,providerExecution:false,acceptedReviewSimulated:false};
  receipt.checks.push('Whiteboard, assigned Greenboard primary/helper roles and ETA roadmap render with reachable controls in the same world at both laptop viewports');
}
