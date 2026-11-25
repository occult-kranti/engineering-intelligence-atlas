import {PUBLIC_KNOWLEDGE_GRAPH, PUBLIC_KNOWLEDGE_SHA256} from './knowledge-graph.ts';
import {queryGraph, type KnowledgeGraph} from './graph-memory.ts';
import {brainEvidence} from './donna-brain.mjs';

/** Public evidence only. Private company data remains in scopedContext's existing
 * authorization path. Importing a concept cannot grant an employee or tool. */
export function hostedGraphContext(message:string) {
  const packet=queryGraph(PUBLIC_KNOWLEDGE_GRAPH as unknown as KnowledgeGraph,
    {query:message.slice(0,4000),scopes:['public'],maxResults:3,maxBytes:4096},
    {allowedScopes:['public'],policyVersion:'daftar-public-evidence-v1'});
  return {snapshotSha256:PUBLIC_KNOWLEDGE_SHA256,readingStatus:'curated-summaries-only; originals-not-opened-by-retriever',
    status:packet.status,algorithm:packet.algorithm,results:packet.results,omittedCount:packet.omittedCount};
}

/** IDs come from the existing server-side scopedContext selection. A bounded
 * portfolio chat searches at most three of those companies and reports coverage.
 * No browser-controlled list grants access to a company. */
export function hostedCompanyBrainContext(snapshot:Record<string,any>,allowedCompanyIds:string[],message:string) {
  const ids=[...new Set(allowedCompanyIds)];
  const selected=ids.slice(0,3);
  const companies=selected.map(id=>{try{return brainEvidence(snapshot,id,message);}catch{return{companyId:id,status:'unavailable',results:[]};}});
  const encoder=new TextEncoder();
  const output={version:'donna-brain-1',availableCompanyCount:ids.length,searchedCompanyCount:companies.length,omittedCompanyCount:ids.length-companies.length,companies};
  while(encoder.encode(JSON.stringify(output)).length>14000&&output.companies.length){output.companies.pop();output.searchedCompanyCount--;output.omittedCompanyCount++;}
  return output;
}
