#!/usr/bin/env node
/** Fixed authored evaluation. Never changes the atlas, labels or retrieval core. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {queryGraph,GRAPH_VERSION} from '../runtime/graph-core.mjs';
import {readGraph,MemoryStore} from '../runtime/store.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const atlasPath=path.resolve(here,'../atlas.json');
const sha=value=>createHash('sha256').update(value).digest('hex');
const questionBytes=fs.readFileSync(path.join(here,'questions.json'));
const set=JSON.parse(questionBytes);
const graphBytes=fs.readFileSync(atlasPath);
const graph=readGraph(atlasPath);
const ids=new Set(graph.nodes.map(n=>n.id));
assert.equal(set.questions.length,14);
assert.equal(set.questions.filter(q=>q.category==='absent-answer').length,2);
for(const q of set.questions)for(const id of q.acceptableIds)assert(ids.has(id),`Unknown predeclared acceptable ID ${id}`);
assert(!graph.nodes.some(n=>/aster quay/i.test(n.label+' '+n.summary)),'Invented-company absent control unexpectedly exists in corpus');
const grant={allowedScopes:['public'],policyVersion:'fixed-public-evaluation-v1'};
const options={...set.limits,scopes:['public'],asOf:set.asOf};
const variants=[{id:'lexical_only_alpha_0',alpha:0},{id:'default_alpha_085',alpha:.85}];

function score(question,packet){
  const returnedIds=packet.results.map(r=>r.id);
  const matched=returnedIds.filter(id=>question.acceptableIds.includes(id));
  const first=returnedIds.findIndex(id=>question.acceptableIds.includes(id));
  return {status:packet.status,returnedIds,returnedLabels:packet.results.map(r=>r.label),resultCount:returnedIds.length,success:question.acceptableIds.length?matched.length>0:returnedIds.length===0,matchedAcceptableIds:matched,firstAcceptableRank:first<0?null:first+1,reciprocalRank:first<0?0:1/(first+1),iterations:packet.iterations,residual:packet.residual,packetBytes:Buffer.byteLength(JSON.stringify(packet)),rankDetails:packet.results.map(r=>({id:r.id,lexicalRank:r.lexicalRank,graphRank:r.graphRank,score:r.score}))};
}

const outcomes=set.questions.map(question=>({id:question.id,category:question.category,question:question.question,acceptableIds:question.acceptableIds,variants:Object.fromEntries(variants.map(variant=>[variant.id,score(question,queryGraph(graph,{...options,query:question.question,alpha:variant.alpha},grant))]))}));
const summary=Object.fromEntries(variants.map(variant=>{
  const answerable=outcomes.filter(q=>q.category!=='absent-answer');
  const absent=outcomes.filter(q=>q.category==='absent-answer');
  return [variant.id,{alpha:variant.alpha,answerableSuccesses:answerable.filter(q=>q.variants[variant.id].success).length,answerableTotal:answerable.length,answerableMRR:answerable.reduce((n,q)=>n+q.variants[variant.id].reciprocalRank,0)/answerable.length,absentControlsAbstained:absent.filter(q=>q.variants[variant.id].success).length,absentControlsTotal:absent.length,failedQuestionIds:outcomes.filter(q=>!q.variants[variant.id].success).map(q=>q.id)}];
}));
const emptyQuery=Object.fromEntries(variants.map(v=>{const p=queryGraph(graph,{...options,query:set.additionalEmptyQueryCheck.question,alpha:v.alpha},grant);return [v.id,{status:p.status,resultCount:p.results.length,passed:p.status==='no-match'&&p.results.length===0}];}));

const temporaryStore=fs.mkdtempSync(path.join(os.tmpdir(),'daftar-retrieval-evaluation-'));
let timing;
try{
  const store=new MemoryStore(temporaryStore,grant);
  const ingested=store.ingest(graph);
  const fixedQuestion=set.questions.find(q=>q.id===set.timingQuestionId);
  const query={...options,query:fixedQuestion.question,alpha:.85};
  const fixedNow=Date.parse(set.asOf);
  const runs=(ttlMs,expectHit)=>Array.from({length:5},(_,i)=>{
    const start=performance.now();const packet=store.query(query,{ttlMs,now:fixedNow});const duration=performance.now()-start;
    assert.equal(packet.cache.hit,expectHit);
    return {run:i+1,durationMs:Number(duration.toFixed(6)),cacheHit:packet.cache.hit,status:packet.status,resultIds:packet.results.map(r=>r.id),resultRevision:packet.revision};
  });
  const noCache=runs(0,false);
  const primed=store.query(query,{ttlMs:3600000,now:fixedNow});
  assert.equal(primed.cache.hit,false,'Prime must begin with an unused result cache');
  const warm=runs(3600000,true);
  for(const record of [...noCache,...warm])assert.deepEqual(record.resultIds,noCache[0].resultIds);
  const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
  const noCacheMedianMs=median(noCache.map(r=>r.durationMs)),warmMedianMs=median(warm.map(r=>r.durationMs));
  timing={queryId:set.timingQuestionId,query:fixedQuestion.question,alpha:.85,options,cacheKind:'local-result-cache',snapshotSha256:ingested.sha256,storeCompositeRevision:noCache[0].resultRevision,sequence:'Five TTL=0 runs, one untimed cache-populating query, five TTL=3600000 warm runs',noCache,warm,noCacheMedianMs,warmMedianMs,medianRatioNoCacheOverWarm:noCacheMedianMs/warmMedianMs,providerCalls:0,limits:'No-result-cache cold only: filesystem and process/JIT caches were not cleared. Each measured store query reloads, verifies and filters the snapshot. Five samples in one process are noisy and order-dependent; no provider token, billable-money or inference-cache saving follows.'};
}finally{fs.rmSync(temporaryStore,{recursive:true,force:true});}

const gain=summary.default_alpha_085.answerableSuccesses-summary.lexical_only_alpha_0.answerableSuccesses;
const results={schemaVersion:1,evaluatedAtUtc:new Date().toISOString(),setName:set.name,scope:'Small authored sanity set; labels selected from this corpus before running comparisons. Not a held-out benchmark, SOTA assessment, or general retrieval-quality estimate.',graph:{revision:graph.revision,sha256:sha(graphBytes),nodes:graph.nodes.length,edges:graph.edges.length,sources:graph.sources.length},questionsSha256:sha(questionBytes),software:{node:process.version,v8:process.versions.v8,platform:process.platform,architecture:process.arch,cpuModel:os.cpus()[0]?.model??'unreported',graphVersion:GRAPH_VERSION,graphCoreSha256:sha(fs.readFileSync(path.resolve(here,'../runtime/graph-core.mjs'))),storeSha256:sha(fs.readFileSync(path.resolve(here,'../runtime/store.mjs')))},grant,options,method:{lexicalBaseline:'Same production queryGraph implementation with alpha=0. Graph mass stays at lexical seeds; the unchanged reciprocal-rank fusion still executes. This is not a separately implemented pure BM25 scorer.',default:'Same queryGraph with alpha=0.85 and default relation allowlist; no core or parameter changes were made to improve outcomes.',success:'At least one predeclared acceptable ID among returned records, with an identical maximum of six results and 12288 bytes.',mrr:'Mean reciprocal rank of first acceptable ID over 12 answerable questions. Acceptable sets are intentionally bounded, not exhaustive relevance labels.',abstention:'Zero records is required for an absent-answer control. Returning topically related records fails this conservative check; the retriever does not synthesize an answer.'},summary,answerableSuccessDelta:gain,comparisonConclusion:gain>0?'Default graph propagation improves Success@6 on this small authored set.':gain<0?'Default graph propagation decreases Success@6 on this small authored set.':'Default graph propagation does not improve Success@6 on this small authored set.',outcomes,emptyQuery,timing};
fs.writeFileSync(path.join(here,'results.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({summary,answerableSuccessDelta:gain,emptyQuery,timing:{noCacheMedianMs:timing.noCacheMedianMs,warmMedianMs:timing.warmMedianMs,medianRatioNoCacheOverWarm:timing.medianRatioNoCacheOverWarm},revision:graph.revision},null,2));
