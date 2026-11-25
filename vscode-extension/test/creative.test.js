'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {creativeSnapshot,creativeJob,readiness,askCreativeAction,validateCreativeInput,inventoryText}=require('../src/creative');
function inventory(){return creativeSnapshot({companyId:'a',configured:true,tools:[{id:'blender',configured:true,available:true,version:'4.4',operations:['blender.inspect','blender.render']},{id:'adobe-photoshop',configured:true,available:true,readiness:'configured_unverified',remoteAuthVerified:false,operations:['adobe.render']},{id:'inkscape',configured:true,available:false,operations:['inkscape.export_png']}],projects:[{id:'p',companyId:'a',allowExternalUpload:true,allowedOperations:['blender.inspect','blender.render','adobe.render','inkscape.export_png']}],eligibleEmployees:[{id:'e',name:'Artist',status:'active'},{id:'foreign',companyId:'b',name:'Other',status:'active'}],assignments:[{companyId:'a',employeeId:'e',projectId:'p',toolIds:['blender','adobe-photoshop']}],jobs:[],limits:{maxDurationMs:30000}},'a');}
test('creative availability distinguishes configured Adobe from detected local software',()=>{
  const data=inventory();assert.equal(data.eligibleEmployees.length,1);
  assert.equal(readiness(data.tools[0]),'Detected · 4.4');
  assert.equal(readiness(data.tools[1]),'Configured — Adobe authentication unverified');
  assert.equal(readiness(data.tools[2]),'Unavailable');
  assert.match(inventoryText(data),/licensed external service/);
  assert.match(inventoryText(data),/separate open-source tools/);
});
test('render bounds mirror runtime limits, allow frame zero and reject execution-shaped input',()=>{
  assert.deepEqual(validateCreativeInput('blender.render',{path:'scenes/file.blend',frame:0,width:16,height:2048,samples:64}),{path:'scenes/file.blend',frame:0,width:16,height:2048,samples:64});
  for(const input of [{path:'scenes/file.blend',samples:65},{path:'scenes/file.blend',width:15},{path:'scenes/file.blend',height:2049},{path:'a%2f.blend'},{path:'//host/file.blend'},{path:'a/./b.blend'},{path:'a.blend',binary:'x'}])assert.throws(()=>validateCreativeInput('blender.render',input));
  assert.throws(()=>validateCreativeInput('__proto__',{path:'a'}));
  assert.throws(()=>validateCreativeInput('adobe.manifest',{path:'a.psd',format:'png'}));
});
test('assignment removal remains reachable when the employee is no longer eligible for new work',async()=>{
  const data=inventory();data.eligibleEmployees=[];let picks=0;
  const plan=await askCreativeAction({showQuickPick:async rows=>++picks===1?rows.find(row=>row.id==='revoke'):rows[0]},data,'A');
  assert.deepEqual(plan,{kind:'assign',employeeId:'e',projectId:'p',toolIds:[]});
});
test('only available assigned project operations can be selected and Adobe requires explicit upload review',async()=>{
  const data=inventory();data.assignments[0].toolIds=['adobe-photoshop','inkscape'];let picks=0,warnings=0,inputs=0;
  const plan=await askCreativeAction({showQuickPick:async rows=>{picks++;if(picks===1)return rows.find(row=>row.id==='run');if(picks===2){assert.deepEqual(rows[0].operations,['adobe.render']);return rows[0];}return rows[0];},showInputBox:async()=>++inputs===1?'design.psd':'',showWarningMessage:async(message,options,action)=>{warnings++;assert.match(message,/Upload design.psd.*Adobe charges/);assert.equal(options.modal,true);return action;}},data,'A');
  assert.equal(warnings,1);assert.equal(plan.operation,'adobe.render');assert.deepEqual(plan.input,{path:'design.psd',format:'png'});
  assert.equal(plan.employeeId,'e');assert.equal(plan.projectId,'p');
});
test('cancelling a prompt or upload review never produces an execution request',async()=>{
  const data=inventory();data.assignments[0].toolIds=['adobe-photoshop'];let picks=0,inputs=0;
  const plan=await askCreativeAction({showQuickPick:async rows=>++picks===1?rows.find(row=>row.id==='run'):rows[0],showInputBox:async()=>++inputs===1?'design.psd':'',showWarningMessage:async()=>undefined},data,'A');
  assert.equal(plan,undefined);
  assert.equal(await askCreativeAction({showQuickPick:async()=>undefined},data,'A'),undefined);
});
test('Adobe tasks are not offered when the project has not approved external uploads',async()=>{
  const data=inventory();data.projects[0].allowExternalUpload=false;data.assignments[0].toolIds=['adobe-photoshop'];
  await assert.rejects(askCreativeAction({showQuickPick:async rows=>rows.find(row=>row.id==='run'),showInputBox:async()=>assert.fail('No asset may be requested')},data,'A'),/Assign an available tool/);
});
test('Adobe uncertain outcomes retain distinct remote identity and cleanup evidence without signed URLs',()=>{
  const remoteId='urn:adobe:'+ 'a'.repeat(220);
  const job=creativeJob({id:'local-request',companyId:'a',employeeId:'e',projectId:'p',operation:'adobe.render',status:'cancelled',evidenceUri:'creative://jobs/local-request',outputs:[],result:{provider:'adobe-photoshop-v2',adobeJobId:remoteId,inputSha256:'a'.repeat(64),cleanup:'pending',state:'outcome_unconfirmed',signedUrl:'https://PRIVATE/?secret=yes'}},'a','local-request');
  assert.equal(job.result.adobeJobId,remoteId);assert.equal(job.result.cleanup,'pending');assert.equal(job.result.state,'outcome_unconfirmed');assert.equal(job.evidenceUri,'creative://jobs/local-request');assert.equal(JSON.stringify(job).includes('PRIVATE'),false);
  assert.throws(()=>validateCreativeInput('adobe.manifest',{path:'design.psb'}));
  assert.throws(()=>validateCreativeInput('adobe.manifest',{path:'image.png'}));
  assert.equal(validateCreativeInput('adobe.render',{path:'image.jpeg'}).path,'image.jpeg');
});
