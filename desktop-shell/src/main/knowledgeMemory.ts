import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {eligibleGraph,queryGraph,validateGraph,GRAPH_VERSION,type KnowledgeGraph,type GraphPacket} from '../shared/graphMemory';

const MAX_FILE=16*1024*1024;
const grant={allowedScopes:['public'],policyVersion:'daftar-public-evidence-v1'};
const cache=new Map<string,GraphPacket>();
export interface MemoryContext {
  status:'ready'|'no-match'|'bounded-empty'|'unavailable';
  snapshotSha256:string|null;cacheHit:boolean;packet:GraphPacket|null;
  readingStatus:'curated-summaries-only; originals-not-opened-by-retriever';
}
/** The production worker imports PUBLIC study knowledge only. Company memories
 * retain the existing native permission boundary; no private store is scanned.
 * Validate and hash each read, so replacement and source revisions invalidate L1.
 */
export function loadKnowledgeContext(seedDir:string,query:string,asOf=new Date().toISOString()):MemoryContext {
  const out:MemoryContext={status:'unavailable',snapshotSha256:null,cacheHit:false,packet:null,readingStatus:'curated-summaries-only; originals-not-opened-by-retriever'};
  let fd:number|null=null;
  try {
    const seed=fs.realpathSync(seedDir),folder=path.join(seed,'knowledge-memory'),file=path.join(folder,'atlas.json');
    if(fs.lstatSync(folder).isSymbolicLink())return out;
    const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_FILE)return out;
    const resolved=fs.realpathSync(file);if(!resolved.startsWith(seed+path.sep))return out;
    fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));const opened=fs.fstatSync(fd);
    if(opened.dev!==stat.dev||opened.ino!==stat.ino||opened.size>MAX_FILE)return out;
    const buffer=Buffer.alloc(MAX_FILE+1);let size=0,read=0;
    do{read=fs.readSync(fd,buffer,size,buffer.length-size,null);size+=read;}while(read&&size<buffer.length);
    if(size>MAX_FILE)return out;
    const body=buffer.subarray(0,size),hash=createHash('sha256').update(body).digest('hex'),graph:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));
    validateGraph(graph);
    // Build-time policy is checked again at the runtime boundary.
    if(graph.nodes.some(n=>(n.scope??'public')!=='public')||graph.edges.some(e=>(e.scope??'public')!=='public'))return out;
    const request={query:query.slice(0,4000),scopes:['public'],maxResults:3,maxBytes:4096,asOf};
    const temporal=eligibleGraph(graph,request,grant).temporalSignature;
    const cacheKey=createHash('sha256').update(JSON.stringify([GRAPH_VERSION,hash,request.query,temporal,grant.policyVersion])).digest('hex');
    const previous=cache.get(cacheKey);
    const packet=previous?{...previous,asOf}:queryGraph(graph as KnowledgeGraph,request,grant);
    if(!previous){if(cache.size>=128)cache.delete(cache.keys().next().value!);cache.set(cacheKey,packet);}
    return{status:packet.status,snapshotSha256:hash,cacheHit:!!previous,packet,readingStatus:out.readingStatus};
  }catch{return out;}finally{if(fd!==null)fs.closeSync(fd);}
}
