/** Donna's own operating memory. This is a projection of the authorized native
 * workspace, not a second authority store. No files, network, models or commands
 * are executed here. Callers must supply an already authorized snapshot. */
import type { OfficeSnapshot, OfficeKnowledge, OfficeCommand } from './office';
import { queryGraph, validateGraph, type GraphNode, type GraphEdge, type GraphSource, type KnowledgeGraph } from './graphMemory';

export const BRAIN_VERSION = 'donna-brain-1';
export type BrainNoteType = 'fact' | 'decision' | 'question' | 'procedure';
export interface BrainNote { kind:'daftar-brain-note'; version:1; type:BrainNoteType; body:string; tags:string[]; supersedes:string|null; expiresAt:string|null }
export interface BrainGap { id:string; title:string; detail:string; action:string }
export interface DonnaBrain {
  companyId:string; companyName:string; graph:KnowledgeGraph;
  counts:{nodes:number;edges:number;knowledge:number;questions:number;corrections:number;omitted:number};
  gaps:BrainGap[];
  policy:'company-scoped projection; native authority remains authoritative';
}
const types=new Set(['fact','decision','question','procedure']);
const idPattern=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const enc=new TextEncoder();
const order=(a:{id:string},b:{id:string})=>a.id<b.id?-1:a.id>b.id?1:0;
const text=(v:unknown,max=2000)=>String(v??'').replace(/(^|[^A-Za-z0-9_-])(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{8,}/g,'$1[redacted]').slice(0,max);
function instant(value:unknown):string|null {
  if(typeof value!=='string')return null;
  const m=/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);if(!m)return null;
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]),days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  if(month<1||month>12||day<1||day>days[month-1]!)return null;
  const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toISOString():null;
}
/** A deterministic display fingerprint. This is not a cryptographic integrity
 * certificate; persistent native state and the store's SHA-256 receipts are. */
function fingerprint(value:string):string {let a=0x811c9dc5,b=0x9e3779b9;for(let i=0;i<value.length;i++){a=Math.imul(a^value.charCodeAt(i),16777619);b=Math.imul(b^value.charCodeAt(i),2246822519);}return(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
function ordinary(record:OfficeKnowledge):boolean {
  return !/^daftar-kit:/i.test(record.artifactUri??'')&&!record.title.startsWith('Company kit identity:')&&!/"kind"\s*:\s*"daftar-company-kit-binding"/.test(record.summary);
}
export function makeBrainNote(input:{type:BrainNoteType;body:string;tags?:string[];supersedes?:string|null;expiresAt?:string|null}):string {
  if(!input||!types.has(input.type)||typeof input.body!=='string'||!input.body.trim()||input.body.length>3000)throw new Error('Write a note of 1–3000 characters and choose its kind.');
  if(input.tags!==undefined&&(!Array.isArray(input.tags)||input.tags.length>12||input.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>60)))throw new Error('Use at most twelve short tags.');
  if(input.supersedes!==undefined&&input.supersedes!==null&&(typeof input.supersedes!=='string'||!idPattern.test(input.supersedes)))throw new Error('Choose a valid existing note to correct.');
  if(input.expiresAt!==undefined&&input.expiresAt!==null&&!instant(input.expiresAt))throw new Error('Use an ISO timestamp for note expiry.');
  const note:BrainNote={kind:'daftar-brain-note',version:1,type:input.type,body:input.body.trim(),tags:[...new Set((input.tags??[]).map(t=>t.trim()))].sort(),supersedes:input.supersedes??null,expiresAt:instant(input.expiresAt)};
  const result=JSON.stringify(note);if(enc.encode(result).length>3900)throw new Error('This note exceeds the saved knowledge byte limit; shorten it.');return result;
}
export function readBrainNote(summary:string):BrainNote|null {
  try{const v=JSON.parse(summary);if(v?.kind!=='daftar-brain-note'||v.version!==1)return null;return JSON.parse(makeBrainNote(v)) as BrainNote;}catch{return null;}
}
function recognizedEnvelope(summary:string):boolean {
  try{const parsed:unknown=JSON.parse(summary);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&(parsed as {kind?:unknown}).kind==='daftar-brain-note')return true;}catch{/* Preserve a conservative marker for malformed envelopes. */}
  return /^\s*\{/.test(summary)&&/"kind"\s*:\s*"daftar-brain-note"/.test(summary);
}
/** Shared freshness filter for legacy prompt sections as well as the graph.
 * Internal kit bindings remain available to their dedicated identity selector. */
export function filterBrainKnowledge(knowledge:OfficeKnowledge[],companyId:string,asOf=new Date().toISOString()):OfficeKnowledge[] {
  const at=instant(asOf);if(!at)throw new Error('Invalid memory clock');
  const scoped=knowledge.filter(k=>k.companyId===companyId);
  // Legacy hosted projections can contain ordinary summaries without IDs.
  // They cannot participate in corrections; identified records stay unique.
  const identified=scoped.filter(k=>typeof k.id==='string'&&idPattern.test(k.id)),records=new Map(identified.map(k=>[k.id,k]));
  if(records.size!==identified.length)throw new Error('Ambiguous company knowledge identity');
  const retired=new Set<string>();
  for(const k of scoped){const n=readBrainNote(k.summary),created=instant(k.createdAt);if(!n?.supersedes||!created||created>at||n.expiresAt&&n.expiresAt<=created)continue;
    const old=records.get(n.supersedes),oldCreated=old&&instant(old.createdAt);if(old&&old.id!==k.id&&oldCreated&&created>oldCreated)retired.add(old.id);}
  return scoped.filter(k=>{const n=readBrainNote(k.summary),created=instant(k.createdAt);if(recognizedEnvelope(k.summary)&&(!n||!records.has(k.id)))return false;
    return !retired.has(k.id)&&(!created||created<=at)&&(!n||(!n.expiresAt||at<n.expiresAt)&&(!created||!n.expiresAt||created<n.expiresAt));});
}
function unique<T extends {id:string}>(values:readonly T[]):T[] {
  const seen=new Set<string>();for(const v of values){if(!idPattern.test(v.id)||seen.has(v.id))throw new Error('Ambiguous or invalid company record identity');seen.add(v.id);}return [...values].sort(order);
}

/** One company is selected before any indexing, matching or graph propagation.
 * Parent companies and service contracts do not import their private records.
 * Historical corrections remain inspectable while eligibility uses time bounds. */
export function buildDonnaBrain(snapshot:OfficeSnapshot,companyId:string):DonnaBrain {
  const candidates=(snapshot.companies??[]).filter(c=>c.id===companyId);
  if(candidates.length!==1||!idPattern.test(companyId))throw new Error('Choose one available company.');
  const company=candidates[0]!,nodes:GraphNode[]=[],edges:GraphEdge[]=[],sources:GraphSource[]=[];
  const index=new Map<string,GraphNode>();let omitted=0;
  const cap=<T>(values:T[],max:number):T[]=>{omitted+=Math.max(0,values.length-max);return values.slice(-max);};
  const offices=cap(unique((snapshot.offices??[]).filter(x=>x.companyId===companyId)),200);
  const departments=cap(unique((snapshot.departments??[]).filter(x=>x.companyId===companyId)),500);
  const employees=cap(unique((snapshot.employees??[]).filter(x=>x.companyId===companyId)),1000);
  const knowledge=cap(unique((snapshot.knowledge??[]).filter(x=>x.companyId===companyId&&ordinary(x))),5000);
  const goals=cap(unique((snapshot.goals??[]).filter(x=>x.companyId===companyId)),500);
  const jobs=cap(unique((snapshot.jobs??[]).filter(x=>x.companyId===companyId)),500);
  function add(kind:string,id:string,label:string,summary:string,status:string,updatedAt?:string,extra:Record<string,unknown>={}):GraphNode {
    const n:GraphNode={id:kind+':'+id,label:text(label,500),summary:text(summary),type:kind,domain:'company-operations',scope:'company',classification:'private',status:text(status,100),source_ids:[],recordRef:kind+':'+id,companyId,updatedAt:instant(updatedAt),...extra};
    if(index.has(n.id))throw new Error('Duplicate brain node');nodes.push(n);index.set(n.id,n);return n;
  }
  function link(source:string,target:string,type:string,label:string){if(index.has(source)&&index.has(target))edges.push({source,target,type,label,scope:'company',source_ids:[]});}
  const root=add('company',company.id,company.name,'Company operating memory. '+(company.repoUrl?'Repository configured.':'Repository not yet linked.'),company.status,company.createdAt);
  if(company.repoUrl){try{const u=new URL(company.repoUrl);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.search){const repo=add('repository',company.id,company.repoUrl,'Repository connection metadata. Source files have not been opened by this projection.',company.githubStatus,company.importedAt??company.createdAt);sources.push({id:'repository-source',title:company.repoUrl,url:u.href,access_depth:'connection-metadata; repository-files-not-read'});repo.source_ids=['repository-source'];link(repo.id,root.id,'part_of','Repository belongs to this company');}}catch{/* Invalid link is a setup gap, never an automatic fetch. */}}
  for(const o of offices)add('office',o.id,o.name,'Office definition; saved assistants are not running processes.',o.status,o.createdAt);
  for(const d of departments)add('department',d.id,d.name,'Department definition in the current company.',d.status,d.createdAt);
  for(const e of employees){const paths=e.skillPaths??[];const n=add('employee',e.id,e.name,e.role+'; '+e.kind+' definition. Skills: '+paths.join(', '),e.status,e.updatedAt);
    for(const skill of [...new Set(paths)].slice(0,16)){const id='skill:'+fingerprint(skill);if(!index.has(id))add('skill',fingerprint(skill),skill.split('/').filter(Boolean).at(-2)??skill,'Assigned skill reference: '+text(skill,500)+'. The projection does not execute skill instructions.','assigned-reference',undefined,{skillPath:skill});link(n.id,id,'uses','Employee is assigned this skill reference');}}
  for(const o of offices)link('office:'+o.id,root.id,'part_of','Office in company');
  for(const d of departments){link('department:'+d.id,'office:'+d.officeId,'part_of','Department in office');if(d.parentDepartmentId)link('department:'+d.id,'department:'+d.parentDepartmentId,'part_of','Nested department');}
  for(const e of employees)link('employee:'+e.id,e.departmentId?'department:'+e.departmentId:e.officeId?'office:'+e.officeId:root.id,'part_of','Saved assignment');
  const noteRecords=new Map(knowledge.map(k=>[k.id,k]));let questions=0,corrections=0;
  for(const k of knowledge){const note=readBrainNote(k.summary),created=instant(k.createdAt);const n=add('knowledge',k.id,k.title,note?note.body+'\nTags: '+note.tags.join(', '):k.summary,note?.type==='question'?'open-question':note?'recorded-'+note.type:'recorded-knowledge',k.createdAt,{noteType:note?.type??'knowledge',tags:note?.tags??[],artifactRef:text(k.artifactUri,500),...(created?{valid_from:created}:{}),...(note?.expiresAt&&(!created||note.expiresAt>created)?{valid_until:note.expiresAt}:{})});
    if(recognizedEnvelope(k.summary)&&!note){n.status='quarantined';n.summary='Saved brain note has invalid or unsupported metadata. Inspect the original native record before using it as evidence.';}
    if(note?.expiresAt&&created&&note.expiresAt<=created){n.status='retracted';n.expiredAt=note.expiresAt;}
    if(note?.type==='question')questions++;link(n.id,root.id,'part_of','Recorded company knowledge');}
  for(const k of knowledge){const note=readBrainNote(k.summary);if(!note?.supersedes)continue;const old=noteRecords.get(note.supersedes),stamp=instant(k.createdAt),oldStamp=old&&instant(old.createdAt);
    if(!old||old.id===k.id||!stamp||!oldStamp||stamp<=oldStamp||note.expiresAt&&note.expiresAt<=stamp)continue;
    const prior=index.get('knowledge:'+old.id)!;if(!prior.valid_until||stamp<prior.valid_until)prior.valid_until=stamp;
    prior.supersededBy=k.id;corrections++;link('knowledge:'+k.id,prior.id,'supersedes','Correction preserves the earlier record in history');}
  for(const g of goals)add('goal',g.id,g.title,g.description,g.status,g.updatedAt,{goalMode:g.mode});
  for(const j of jobs)add('job',j.id,j.goal.slice(0,160),(j.summary??j.error??'No result summary recorded.')+'\nExecution: '+j.status,j.status,j.updatedAt,{artifactRef:text(j.artifactUri,500)});
  for(const g of goals){link('goal:'+g.id,root.id,'part_of','Company goal');for(const id of g.jobIds)link('job:'+id,'goal:'+g.id,'part_of','Job belongs to goal');}
  for(const j of jobs){link('job:'+j.id,'employee:'+j.employeeId,'related','Recorded assigned worker');for(const id of j.dependencies)link('job:'+id,'job:'+j.id,'prerequisite_of','Native job dependency');}
  const roadmap=cap(unique((snapshot.portfolio?.roadmap??[]).filter(x=>x.scope.kind==='company'&&x.scope.id===companyId)),500);
  for(const r of roadmap)add('roadmap',r.id,r.title,r.description+'\nEvidence: '+text(r.evidence,500),r.status,r.updatedAt);
  for(const r of roadmap){link('roadmap:'+r.id,root.id,'part_of','Company roadmap');for(const id of r.goalIds)link('goal:'+id,'roadmap:'+r.id,'part_of','Goal supports roadmap item');for(const id of r.dependencies)link('roadmap:'+id,'roadmap:'+r.id,'prerequisite_of','Roadmap dependency');}
  if(nodes.length>11000)throw new Error('Company brain exceeds its bounded projection; narrow the workspace before indexing.');
  nodes.sort(order);edges.sort((a,b)=>(a.source+a.type+a.target).localeCompare(b.source+b.type+b.target));
  const graph:KnowledgeGraph={schemaVersion:1,revision:BRAIN_VERSION+'-'+fingerprint(JSON.stringify([companyId,nodes,edges,sources])),nodes,edges,sources};validateGraph(graph);
  const gaps:BrainGap[]=[];
  if(!index.has('repository:'+companyId))gaps.push({id:'repository',title:'Connect a repository',detail:'No usable HTTPS repository connection is saved.',action:'Review the company repository connection.'});
  if(!offices.length)gaps.push({id:'office',title:'Organize the company workspace',detail:'No office is defined for this company.',action:'Create a company office using existing native commands.'});
  if(!employees.some(e=>e.id===company.assistantId&&e.status==='active'))gaps.push({id:'assistant',title:'Resolve the company assistant',detail:'The saved company assistant is missing or inactive.',action:'Reuse or configure the company assistant; preserve existing identities.'});
  if(!employees.some(e=>(e.skillPaths??[]).length))gaps.push({id:'skills',title:'Assign relevant skills',detail:'No company employee has a saved skill reference.',action:'Match the existing role and skill library to this company’s goals.'});
  if(!knowledge.length)gaps.push({id:'knowledge',title:'Capture the first evidence',detail:'No ordinary company knowledge is recorded.',action:'Record repository findings, decisions and open questions with provenance.'});
  if(!goals.some(g=>!['completed'].includes(g.status)))gaps.push({id:'goals',title:'Build an accountable plan',detail:'No unfinished company goal is saved.',action:'Create a goal with owners, dependencies, evidence and acceptance checks.'});
  if(questions)gaps.push({id:'questions',title:'Resolve open questions',detail:questions+' question records are available for review, including historical records.',action:'Check active questions and append corrections or resolved decisions.'});
  if(omitted)gaps.push({id:'coverage',title:'Review bounded coverage',detail:omitted+' records were omitted by explicit per-kind limits.',action:'Narrow the workspace or inspect omitted records before assuming completeness.'});
  return{companyId,companyName:company.name,graph,counts:{nodes:nodes.length,edges:edges.length,knowledge:knowledge.length,questions,corrections,omitted},gaps,policy:'company-scoped projection; native authority remains authoritative'};
}

/** Relevant current facts replace the old last-six-only recall. Public science
 * is retrieved independently and never copied into the private durable store. */
export function brainEvidence(snapshot:OfficeSnapshot,companyId:string,query:string,asOf=new Date().toISOString()) {
  const brain=buildDonnaBrain(snapshot,companyId),packet=queryGraph(brain.graph,{query:query.slice(0,4000),scopes:['company'],maxResults:4,maxBytes:4600,asOf},{allowedScopes:['company'],policyVersion:'native-company-projection-v1'});
  const map=new Map(brain.graph.nodes.map(n=>[n.id,n]));
  const result={version:BRAIN_VERSION,companyId,revision:brain.graph.revision,status:packet.status,algorithm:packet.algorithm,
    readingStatus:'saved native record summaries; referenced artifacts not opened',results:packet.results.map(r=>({...r,recordRef:map.get(r.id)?.recordRef,updatedAt:map.get(r.id)?.updatedAt})),omittedCount:packet.omittedCount,
    setupGaps:brain.gaps.slice(0,6),policy:brain.policy};
  // Entire returned model context has a separate byte ceiling, including gaps.
  while(enc.encode(JSON.stringify(result)).length>6200&&result.setupGaps.length)result.setupGaps.pop();
  while(enc.encode(JSON.stringify(result)).length>6200&&result.results.length){result.results.pop();result.omittedCount++;}
  return result;
}

/** A concrete, zero-provider-cost setup draft. The native command path saves it;
 * it does not execute the plan, grant tools, hire duplicates, or publish files. */
export function makeDonnaSetupDraft(snapshot:OfficeSnapshot,companyId:string):OfficeCommand {
  const brain=buildDonnaBrain(snapshot,companyId);
  const description=['Donna Brain setup for '+brain.companyName+'.','Evidence projection: '+brain.graph.revision+'.',
    'Use the existing company, repository, employees and skills. Reuse identities and obey current native authority.',
    'Inspect the saved repository connection and record a commit-pinned review before claiming source coverage.',
    'Map departments, skills, outstanding goals, decisions and questions. Attach sources, units and assumptions to research.',
    ...brain.gaps.map(g=>g.title+': '+g.detail+' Next: '+g.action),
    'Build a dependency plan with an owner, finite budget, expected artifact and acceptance check for each step.',
    'Append corrections with supersedes links; retain earlier evidence. Refresh retrieval when company state or source evidence changes.',
    'Acceptance: no duplicate employees, no cross-company knowledge without an explicit grant, no unsupported completion claims, and a saved evidence-backed next step.',
    'This is a saved planning goal. Provider execution and external changes use their existing configured controls.'].join('\n');
  return{action:'create_goal',scope:{kind:'company',id:companyId},title:('Donna Brain · Set up '+brain.companyName).slice(0,200),description,mode:'plan',maxIterations:1,runSettings:{mode:'manual',provider:'anthropic',model:'',authorized:false,maxTokens:4000,maxUsd:0,maxMinutes:15,priceRates:{inputUsdPerMillion:null,outputUsdPerMillion:null},allowedTools:[]}};
}
