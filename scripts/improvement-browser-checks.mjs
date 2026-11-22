/** Real sandboxed-browser improvement checks against temporary native state.
 * Source records are synthetic. No provider output, acceptance, cost, or live
 * execution evidence is simulated. A deliberate transport loss occurs only
 * after a real native note write, to exercise its original receipt on retry. */
import assert from 'node:assert/strict';
import { openCanvasSurface, settleCanvas, assertEndlessShell } from './endless-canvas-browser-checks.mjs';

async function eventually(read, predicate, label) {
  const end = Date.now() + 10000;
  do { const value = await read(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 80)); } while (Date.now() < end);
  throw new Error(label);
}
const money = value => `$${value.toFixed(2)}`;
const noteEdit = row => ({ id:row.id, expectedRevision:row.revision, companyId:row.companyId, officeId:row.officeId,
  departmentId:row.departmentId, kind:row.kind, color:row.color, text:row.text, status:row.status,
  ownerEmployeeId:row.ownerEmployeeId, goalIds:row.goalIds, x:row.x, y:row.y });

export async function checkImprovementWorkflows({ page, client, companyId, receipt, screenshot, expectConflict,
  expectNoteAcknowledgementLoss, noteRequests }) {
  receipt.improvementStage='paused native fixture';
  const seed=(command,id)=>client.command(command,{id:`improvement-browser-${id}`});
  await seed({action:'configure_policy',dispatchPaused:true},'global-pause');
  await seed({action:'select_company',companyId},'select');
  const native=async()=>(await client.snapshot()).snapshot;
  let snapshot=await native();
  assert.equal(snapshot.policy.dispatchPaused,true,'Every fixture session remains under a global dispatch pause');
  const office=snapshot.offices.find(row=>row.companyId===companyId);
  assert.ok(office,'Use an existing native office');
  const primary='donna',reviewer=office.assistantId;
  assert.notEqual(primary,reviewer,'The native employees are distinct');
  assert.ok(snapshot.employees.some(row=>row.id===primary)&&snapshot.employees.some(row=>row.id===reviewer));
  const jobsBefore=snapshot.jobs.length;
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#workspace-refresh').click();
  await page.waitForFunction(id=>document.getElementById('office-company-select')?.value===id,companyId);
  let panel=await openCanvasSurface(page,'improvement');
  await page.locator('#improvement-tab-notes').click();
  await page.locator('#improvement-note-scope').selectOption(office.id);
  await panel.getByRole('button',{name:'+ Note',exact:true}).click();
  const literal='Browser comment <img src=x onerror=alert(1)> is literal';
  await page.locator('#improvement-note-text').fill(literal);
  await page.locator('#improvement-note-color').selectOption('pink');
  await page.locator('#improvement-note-x').fill('25');
  await page.locator('#improvement-note-y').fill('20');
  await page.locator('#improvement-note-save').click();
  const created=await eventually(async()=>(await native()).stickyNotes.find(row=>row.text===literal),Boolean,'Comment was not saved natively');
  await page.waitForFunction(()=>document.getElementById('improvement-status')?.textContent==='Native change acknowledged.');
  assert.equal(created.kind,'comment');assert.equal(created.color,'pink');assert.equal(created.companyId,companyId);assert.equal(created.officeId,office.id);
  assert.equal(await panel.locator('.improvement-note-preview img').count(),0,'Source text never creates HTML');
  const note=async()=>(await native()).stickyNotes.find(row=>row.id===created.id);

  receipt.improvementStage='persisted note exact retry';
  const editedText='Browser comment edited through a lost acknowledgement';
  expectNoteAcknowledgementLoss(true);
  try {
    await page.locator('#improvement-note-text').fill(editedText);
    await page.locator('#improvement-note-color').selectOption('purple');
    await page.locator('#improvement-note-save').click();
    await page.waitForFunction(()=>document.getElementById('improvement-status')?.textContent.includes('acknowledgement lost after native persistence'));
    assert.equal(await page.locator('#improvement-note-text').isDisabled(),true,'An uncertain operation keeps its original form frozen');
    assert.equal(await page.locator('#improvement-pending').isVisible(),true);
    const committed=await note();assert.equal(committed.text,editedText);assert.equal(committed.revision,created.revision+1);
    await page.locator('#improvement-retry').click();
    await page.waitForFunction(()=>document.getElementById('improvement-status')?.textContent==='Native change acknowledged.');
    const retried=await note();assert.equal(retried.revision,committed.revision,'Retry replays the real native receipt instead of incrementing again');
    const calls=noteRequests().filter(command=>command.id===created.id&&command.text===editedText);
    assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1],'Both requests have identical payload, revision and identity');
    assert.equal(retried.color,'purple');assert.equal((await native()).stickyNotes.filter(row=>row.id===created.id).length,1);
  } finally { expectNoteAcknowledgementLoss(false); }
  receipt.checks.push('A real native note write with a lost transport acknowledgement retries identical bytes and yields one revision');

  receipt.improvementStage='stale note draft';
  const current=await note();
  await page.locator('#improvement-note-text').fill('Unsent stale note draft');
  await seed({action:'upsert_sticky_note',requestId:'improvement-browser-other-editor',...noteEdit(current),text:'External saved comment'},'other-editor');
  await page.locator('#workspace-refresh').click();
  await page.waitForFunction(()=>document.getElementById('improvement-note-form')?.classList.contains('board-stale'));
  assert.equal(await page.locator('#improvement-note-text').inputValue(),'Unsent stale note draft');
  const rejectedBefore=receipt.expectedRpcFailures?.length||0;
  expectConflict(true);
  try {
    await page.locator('#improvement-note-save').click();
    await eventually(async()=>receipt.expectedRpcFailures?.length||0,value=>value>rejectedBefore,'Native stale-note rejection was not observed');
    await eventually(()=>page.locator('#improvement-note-save').isEnabled(),Boolean,'Rejected note save did not release its control');
  } finally { expectConflict(false); }
  assert.equal((await note()).text,'External saved comment');assert.equal(await page.locator('#improvement-note-text').inputValue(),'Unsent stale note draft');
  await page.locator('#improvement-note-reload').click();
  assert.equal(await page.locator('#improvement-note-text').inputValue(),'External saved comment');
  assert.equal(await page.locator('#improvement-note-form').evaluate(element=>element.classList.contains('board-stale')),false);
  receipt.checks.push('A second native editor cannot be overwritten by a stale note form; its draft survives until explicit reload');

  await panel.getByRole('button',{name:'+ Note',exact:true}).click();
  await page.locator('#improvement-note-kind').selectOption('todo');
  await page.locator('#improvement-note-color').selectOption('green');
  await page.locator('#improvement-note-text').fill('Review keyboard ownership with a helper');
  await page.locator('#improvement-note-x').fill('45');await page.locator('#improvement-note-y').fill('25');
  await page.locator('#improvement-note-save').click();
  const todo=await eventually(async()=>(await native()).stickyNotes.find(row=>row.kind==='todo'&&row.text==='Review keyboard ownership with a helper'),Boolean,'To-do was not saved');
  await page.waitForFunction(()=>document.getElementById('improvement-status')?.textContent==='Native change acknowledged.');
  assert.equal(todo.color,'green');assert.equal(todo.status,'open');

  // Public directory selection reveals the native note in the world without
  // writing camera state or forcing an offscreen pointer click.
  const directory=await openCanvasSurface(page,'company-directory');
  await directory.locator('.ff-list-search').fill('External saved comment');
  await directory.locator(`.ff-list-button[data-node-id="sticky:${created.id}"]`).click();
  await settleCanvas(page);
  // Prior board checks deliberately retain their live panels. Close them via
  // the normal finder/header controls so the world evidence is not a picture
  // of an unrelated popup in front of otherwise valid node geometry.
  const openIds=await page.locator('.canvas-panel[data-open="true"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.panelId));
  assert.ok(openIds.length<=12,'World capture closes only the bounded existing fixture surfaces');
  for(const id of openIds){const surface=await openCanvasSurface(page,id);await surface.locator('.canvas-panel-close').click();}
  assert.equal(await page.locator('.canvas-panel[data-open="true"]').count(),0,'World note and caption evidence has no floating panel overlays');
  await page.getByRole('button',{name:'Top view',exact:true}).click();
  await page.getByRole('button',{name:'Fit scene to view',exact:true}).click();await settleCanvas(page);
  const footprint=page.locator(`.ff-node[data-node-id="universe:table-plan:${companyId}"]`),size=page.viewportSize();
  assert.ok(size);const safe={left:80,right:size.width-80,top:150,bottom:size.height-110};
  const frameLimit={width:safe.right-safe.left-80,height:safe.bottom-safe.top-80};
  const frameFill=box=>Math.max(box.width/frameLimit.width,box.height/frameLimit.height);
  let zoomOutSteps=0;
  for(;zoomOutSteps<8;zoomOutSteps++){
    const box=await footprint.boundingBox();assert.ok(box&&Object.values(box).every(Number.isFinite));
    if(frameFill(box)<=1)break;
    await page.getByRole('button',{name:'Zoom out',exact:true}).click();await settleCanvas(page);
  }
  // Fit may include other companies or retained panel positions. Use the real
  // 1.25x camera control until this company fills 80–100% of the limiting frame
  // dimension. At 1440×900 this bounds the 760-unit plan to 448–560 screen px
  // high: a note is at least 85×50 px and its work-caption strip at least 11 px.
  let zoomInSteps=0;
  for(;zoomInSteps<12;zoomInSteps++){
    const box=await footprint.boundingBox();assert.ok(box&&Object.values(box).every(Number.isFinite));
    if(frameFill(box)>=.8)break;
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();await settleCanvas(page);
    const next=await footprint.boundingBox();assert.ok(next&&next.width>box.width,'Public zoom makes the target company more readable');
  }
  const sizedFrame=await footprint.boundingBox();assert.ok(sizedFrame&&frameFill(sizedFrame)>=.8-1e-6&&frameFill(sizedFrame)<=1+1e-6,'Target company is neither a miniature overview nor larger than the safe capture frame');
  const viewport=page.locator('.ff-canvas-host'),panKeys=[];await viewport.focus();
  for(let step=0;step<64;step++){
    const box=await footprint.boundingBox();assert.ok(box&&Object.values(box).every(Number.isFinite));
    const dx=box.x+box.width/2-(safe.left+safe.right)/2,dy=box.y+box.height/2-(safe.top+safe.bottom)/2;
    if(Math.abs(dx)<=40&&Math.abs(dy)<=40)break;
    const key=Math.abs(dx)>40?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp');
    const before=await page.locator('#freeflow-host .ff-world').evaluate(node=>node.style.transform);
    await page.keyboard.press(key);await settleCanvas(page);panKeys.push(key);
    assert.notEqual(await page.locator('#freeflow-host .ff-world').evaluate(node=>node.style.transform),before,'Normal camera navigation makes progress');
  }
  const frame=await footprint.boundingBox();assert.ok(frame&&frame.x>=safe.left-.5&&frame.y>=safe.top-.5&&frame.x+frame.width<=safe.right+.5&&frame.y+frame.height<=safe.bottom+.5,'The native company fits between the persistent laptop controls');
  receipt.improvementWorldCapture={closedPanels:openIds,zoomOutSteps,zoomInSteps,panKeys,frameLimit,minimumFrameFill:.8,footprint:frame};
  const marker=page.locator(`.ff-node[data-node-id="sticky:${created.id}"]`);
  await marker.waitFor({state:'visible'});
  const markerBox=await marker.boundingBox();assert.ok(markerBox&&markerBox.width>=85&&markerBox.height>=50,'World note retains a measurable preview at the capture scale');
  receipt.improvementWorldCapture.notePreview=markerBox;
  const containment=await marker.evaluate((element,company)=>{
    const plan=document.querySelector(`.ff-node[data-node-id="universe:table-plan:${company}"]`);
    const rect=node=>{const transform=new DOMMatrixReadOnly(getComputedStyle(node).transform);return{x:transform.m41,y:transform.m42,width:parseFloat(node.style.width),height:parseFloat(node.style.height)};};
    return{note:rect(element),company:plan?rect(plan):null,color:element.style.getPropertyValue('--sticky-color'),sameWorld:!!element.closest('.ff-world')};
  },companyId);
  assert.ok(containment.company&&containment.sameWorld);assert.equal(containment.color,'#dfd4ee');
  for(const box of [containment.note,containment.company])assert.ok(Object.values(box).every(Number.isFinite));
  assert.ok(Math.abs(containment.note.x-containment.company.x)>1&&Math.abs(containment.note.y-containment.company.y)>1,'Read actual node translations, not the zero left/top anchors shared by every world node');
  assert.ok(containment.note.x>=containment.company.x&&containment.note.y>=containment.company.y&&containment.note.x+containment.note.width<=containment.company.x+containment.company.width&&containment.note.y+containment.note.height<=containment.company.y+containment.company.height,'The rendered native note stays inside its company footprint');
  const workCaptions=await page.evaluate(company=>{
    const rect=node=>{const b=node.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
    const visible=node=>{const b=rect(node),style=getComputedStyle(node);return b.width>0&&b.height>0&&style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0';};
    const nodes=[...document.querySelectorAll('.ff-node')].filter(node=>node.dataset.nodeId?.includes(company));
    const protectedElements=nodes.flatMap(node=>[...node.querySelectorAll('.ff-node-title,.ff-node-monogram')]).filter(visible);
    const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;
    return nodes.flatMap(node=>[...node.querySelectorAll('.ff-node-heat')]).filter(visible).map(badge=>{
      const box=rect(badge),parent=rect(badge.closest('.ff-node'));
      return{nodeId:badge.closest('.ff-node').dataset.nodeId,label:badge.textContent,details:badge.title,box,parent,
        collisions:protectedElements.filter(element=>overlaps(box,rect(element))).map(element=>({nodeId:element.closest('.ff-node').dataset.nodeId,className:element.className,label:element.textContent}))};
    });
  },companyId);
  assert.ok(workCaptions.length>=2,'The actual native queued work exercises both office and room captions');
  for(const caption of workCaptions){
    assert.match(caption.label,/unresolved jobs?/);assert.match(caption.details,/Counts describe saved work/);
    assert.ok(caption.box.width>=60&&caption.box.height>=11,'Work caption retains measurable text-strip geometry at the capture scale');
    assert.ok(caption.box.x>=caption.parent.x-.5&&caption.box.y>=caption.parent.y-.5&&caption.box.right<=caption.parent.right+.5&&caption.box.bottom<=caption.parent.bottom+.5,'Work captions stay inside their own saved boundary');
    assert.deepEqual(caption.collisions,[],`Work caption does not cover room labels or people: ${caption.nodeId}`);
  }
  receipt.improvementWorkCaptions=workCaptions;
  const visibility=await page.evaluate(({company,noteId})=>{
    const note=document.querySelector(`.ff-node[data-node-id="sticky:${noteId}"]`);
    const captions=[...document.querySelectorAll('.ff-node')].filter(node=>node.dataset.nodeId?.includes(company)).flatMap(node=>[...node.querySelectorAll('.ff-node-heat')]).filter(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0;});
    return[note,...captions].map(node=>{const r=node.getBoundingClientRect(),owner=node.closest('.ff-node').dataset.nodeId;
      return{nodeId:owner,label:node.textContent,samples:[.1,.5,.9].map(fraction=>{const x=r.x+r.width*fraction,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return{x,y,hitNodeId:hit?.closest('.ff-node')?.dataset.nodeId??null,reachable:hit?.closest('.ff-node')?.dataset.nodeId===owner};})};});
  },{company:companyId,noteId:created.id});
  assert.equal(visibility.length,workCaptions.length+1);
  for(const target of visibility)assert.ok(target.samples.every(sample=>sample.reachable),`World note/caption is actually unobscured: ${target.nodeId}`);
  receipt.improvementWorldCapture.visibility=visibility;
  await screenshot('17-improvement-note-world-1440x900');
  receipt.checks.push('Literal comment and colored to-do are canonical notes; the actual world preview stays inside its company footprint');

  receipt.improvementStage='immutable parent allowance and paused session';
  panel=await openCanvasSurface(page,'improvement');await page.locator('#improvement-tab-sessions').click();
  const allowanceDetails=panel.locator('details').filter({has:page.locator('#improvement-allowance-form')});
  await allowanceDetails.locator('summary').click();
  await page.locator('#improvement-carry-observed').fill('1.1316496');
  await page.locator('#improvement-carry-estimated').fill('0');
  await page.locator('#improvement-carry-source').fill('Synthetic acceptance checkpoint; exact fractional input');
  await page.locator('#improvement-carry-reviewed').check();
  assert.equal(await page.locator('#improvement-allowance-form').evaluate(form=>form.checkValidity()),true);
  await page.locator('#improvement-allowance-form button[type="submit"]').click();
  const allowance=await eventually(async()=>(await native()).improvementAllowance,Boolean,'Parent allowance was not registered');
  assert.equal(allowance.capUsd,20);assert.equal(allowance.carriedObservedUsd,1.1316496);
  await page.waitForFunction(()=>document.querySelector('#improvement-create-session')?.hidden===false);
  await page.locator('#improvement-create-session > summary').click();
  await page.locator('#improvement-session-title').fill('Browser paused improvement');
  await page.locator('#improvement-objective').fill('Inspect scoped keyboard work; this fixture never dispatches provider calls.');
  await page.locator('#improvement-primary').selectOption(JSON.stringify([primary,null]));
  await page.locator('#improvement-reviewer').selectOption(JSON.stringify([reviewer,null]));
  await page.locator('#improvement-routes').fill('ollama synthetic-browser-route-not-installed');
  await page.locator('#improvement-todos').selectOption(todo.id);
  assert.equal(await page.locator('#improvement-max-tokens').inputValue(),'32000');
  await page.locator('#improvement-authorized').check();
  await page.locator('#improvement-session-save').click();
  const session=await eventually(async()=>(await native()).improvementSessions.find(row=>row.title==='Browser paused improvement'),Boolean,'Paused session was not persisted');
  assert.equal(session.status,'paused');assert.equal(session.cycle,0);assert.equal(session.runSettings.maxTokens,32000);
  assert.equal(session.primaryEmployeeId,primary);assert.equal(session.reviewerEmployeeId,reviewer);assert.deepEqual(session.runSettings.allowedTools,[]);
  assert.equal(session.continuation,'until-budget');assert.equal(session.maxCycles,null);assert.deepEqual(session.taskNoteIds,[todo.id]);
  const sessionCard=panel.locator(`.improvement-session[data-session-id="${session.id}"]`);
  await sessionCard.waitFor({state:'visible'});
  assert.equal(await sessionCard.getByRole('button',{name:'Start',exact:true}).isEnabled(),true,'Creation exposes a separate explicit Start; it does not execute');
  snapshot=await native();assert.equal(snapshot.policy.dispatchPaused,true);assert.equal(snapshot.jobs.length,jobsBefore,'No improvement job is queued by create/inspect');
  const totals=snapshot.improvementBudget;
  assert.ok(totals&&totals.capUsd===20);assert.equal(totals.effectiveRemainingUsd,Math.min(totals.remainingUsd,snapshot.budget.remainingUsd));
  const budgetText=await panel.locator('.improvement-budget').innerText();
  assert.ok(budgetText.includes(`${money(totals.effectiveRemainingUsd)} available under both ceilings`));
  assert.ok(budgetText.includes(`parent remaining ${money(totals.remainingUsd)}`));
  receipt.checks.push('Fractional carry remains exact; session creation is paused with distinct employees, 32000 tokens and the stricter native parent/global meter');

  const controls=[];
  for(const [width,height] of [[1440,900],[1366,768]]) {
    receipt.improvementStage=`laptop improvement surface ${width}x${height}`;
    await page.setViewportSize({width,height});panel=await openCanvasSurface(page,'improvement');
    for(const [tab,filename] of [['notes','18-improvement-notes'],['sessions','19-improvement-session'],['evidence','20-improvement-evidence']]) {
      const target=page.locator(`#improvement-tab-${tab}`);await target.click();await settleCanvas(page);
      const box=await panel.boundingBox(),button=await target.boundingBox();
      for(const rect of [box,button])assert.ok(rect&&Object.values(rect).every(Number.isFinite)&&rect.width>0&&rect.height>0&&rect.x>=-1&&rect.y>=-1&&rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1,'Improvement surface and its controls fit the laptop');
      controls.push({viewport:{width,height},tab,panel:box,control:button});
      if(tab==='evidence') {
        const text=await page.locator('#improvement-evidence').innerText();
        assert.match(text,/saved employee definitions/);assert.match(text,/not active inference/);assert.match(text,/0 recorded outputs/);assert.match(text,/0 accepted paired outputs/);assert.match(text,/incomplete history/);
        assert.doesNotMatch(text,/NaN|Infinity|[1-9]\d* active provider calls/);
        assert.equal(await panel.locator('.improvement-chart-bin').count(),24);
        assert.equal(await page.locator('.ff-node--employee[data-activity="running"]').count(),0,'Loaded and queued employees do not glow as running');
      }
      await screenshot(`${filename}-${width}x${height}`);
    }
    await assertEndlessShell(page,`${width}x${height} improvement flow`);
  }
  snapshot=await native();assert.equal(snapshot.jobs.length,jobsBefore);assert.equal(snapshot.policy.dispatchPaused,true);assert.equal(receipt.providerCalls,0);
  receipt.improvementWorkflows={companyId,officeId:office.id,noteId:created.id,todoId:todo.id,sessionId:session.id,
    exactRetry:true,staleDraftProtected:true,containedWorldNote:containment,carryObservedUsd:allowance.carriedObservedUsd,
    createdPaused:true,dispatched:false,providerExecution:false,liveExecutionSimulated:false,globalDispatchPaused:true,controls};
  receipt.improvementStage='complete';
}
