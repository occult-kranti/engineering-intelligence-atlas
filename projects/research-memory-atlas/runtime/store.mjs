/** Local durable snapshot/cache adapter. All retrieval uses the shared core.
 * Access grants belong to the caller; this CLI store is not an auth server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { validateGraph, queryGraph, eligibleGraph, GRAPH_VERSION } from './graph-core.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value, (_key,v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);
const SCOPE = /^[a-z][a-z0-9-]{0,79}$/;
const MAX_BYTES = 16 * 1024 * 1024;
function readJson(file, limit = MAX_BYTES) {
  const before = fs.lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink() || before.size > limit) throw new Error('Expected a bounded regular JSON file');
  const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
  try {
    const stat=fs.fstatSync(fd);
    if(stat.ino!==before.ino||stat.dev!==before.dev||stat.size>limit)throw new Error('File changed while opening');
    const buffer=Buffer.alloc(limit+1);let size=0,read;
    do{read=fs.readSync(fd,buffer,size,buffer.length-size,null);size+=read;}while(read&&size<buffer.length);
    if(size>limit)throw new Error('Oversized JSON input');
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,size)));
  } finally {fs.closeSync(fd);}
}
function directory(folder) {
  fs.mkdirSync(folder,{recursive:true,mode:0o700});
  const stat=fs.lstatSync(folder);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Store directory must not be a symlink');
}
function atomicJson(file,value) {
  const dir=path.dirname(file);directory(dir);
  const temp=path.join(dir,'.write-'+randomUUID());
  try {fs.writeFileSync(temp,canonical(value)+'\n',{flag:'wx',mode:0o600});fs.renameSync(temp,file);} finally {if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
function assertScope(scope,grant) {
  if(!SCOPE.test(scope)||!grant.allowedScopes.includes(scope))throw new Error('Scope is not authorized by caller');
}
export function readGraph(file) {const value=readJson(file);validateGraph(value);return value;}

export class MemoryStore {
  constructor(root,grant={allowedScopes:['public'],policyVersion:'public-v1'}) {
    this.root=path.resolve(root);this.grant=grant;directory(this.root);
  }
  scopeFolder(scope) {assertScope(scope,this.grant);return path.join(this.root,'scopes',digest(scope));}
  /** Import an entire scope snapshot atomically. A repeated identical import is
   * idempotent. A busy writer returns a precise failure; no lock is stolen. */
  ingest(graph,scope='public') {
    assertScope(scope,this.grant);validateGraph(graph);
    if(graph.nodes.some(n=>(n.scope??'public')!==scope)||graph.edges.some(e=>(e.scope??'public')!==scope))throw new Error('Snapshot must belong entirely to its target scope');
    const dir=this.scopeFolder(scope);directory(dir);const lock=path.join(dir,'writer.lock');
    try{fs.mkdirSync(lock,{mode:0o700});}catch(e){if(e.code==='EEXIST')throw new Error('Store writer busy; retry after the current writer finishes');throw e;}
    try {
      const bytes=canonical(graph),sha=digest(bytes);if(Buffer.byteLength(bytes)>MAX_BYTES)throw new Error('Snapshot is too large');
      const snapshots=path.join(dir,'snapshots');directory(snapshots);const file=path.join(snapshots,sha+'.json');
      if(!fs.existsSync(file))atomicJson(file,graph);
      else if(digest(canonical(readGraph(file)))!==sha)throw new Error('Existing immutable snapshot has changed');
      const pointer=path.join(dir,'current.json'),previous=fs.existsSync(pointer)?readJson(pointer,4096):null;
      const unchanged=previous?.sha256===sha;
      if(!unchanged){atomicJson(pointer,{scope,sha256:sha,revision:graph.revision,recordedAt:new Date().toISOString()});
        fs.appendFileSync(path.join(dir,'events.jsonl'),canonical({event:'snapshot',scope,sha256:sha,previous:previous?.sha256??null,recordedAt:new Date().toISOString()})+'\n',{mode:0o600});}
      return{scope,sha256:sha,unchanged,nodes:graph.nodes.length,edges:graph.edges.length};
    } finally {fs.rmdirSync(lock);}
  }
  load(scopes=['public']) {
    const graphs=[],identities=[];
    for(const scope of [...new Set(scopes)].sort()) {
      const dir=this.scopeFolder(scope),pointer=readJson(path.join(dir,'current.json'),4096);
      if(pointer.scope!==scope||!/^([a-f0-9]{64})$/.test(pointer.sha256))throw new Error('Invalid snapshot pointer');
      const graph=readGraph(path.join(dir,'snapshots',pointer.sha256+'.json'));
      if(digest(canonical(graph))!==pointer.sha256)throw new Error('Snapshot integrity mismatch');
      if(graph.nodes.some(n=>(n.scope??'public')!==scope)||graph.edges.some(e=>(e.scope??'public')!==scope))throw new Error('Snapshot scope mismatch');
      identities.push([scope,pointer.sha256]);
      // Namespace source references across scope snapshots. Same local source ID
      // in two companies must never substitute one company's citation for another.
      graphs.push({nodes:graph.nodes.map(n=>({...n,source_ids:n.source_ids.map(id=>scope+'::'+id)})),
        edges:graph.edges.map(e=>({...e,source_ids:(e.source_ids??[]).map(id=>scope+'::'+id)})),
        sources:graph.sources.map(s=>({...s,id:scope+'::'+s.id}))});
    }
    const graph={schemaVersion:1,revision:digest(canonical(identities)),nodes:graphs.flatMap(g=>g.nodes),edges:graphs.flatMap(g=>g.edges),sources:graphs.flatMap(g=>g.sources)};
    validateGraph(graph);return graph;
  }
  query(query,{ttlMs=3600000,now=Date.now()}={}) {
    if(!Number.isFinite(ttlMs)||ttlMs<0||ttlMs>86400000||!Number.isFinite(now))throw new Error('Invalid cache clock or TTL');
    const graph=this.load(query.scopes??['public']),asOf=query.asOf??new Date(now).toISOString();
    const effective={...query,asOf},eligible=eligibleGraph(graph,effective,this.grant);
    const key=digest(canonical({algorithm:GRAPH_VERSION,revision:graph.revision,policy:this.grant.policyVersion,
      request:{...query,asOf:undefined},scopes:eligible.options.scopes,temporal:eligible.temporalSignature}));
    const cache=path.join(this.root,'cache'),file=path.join(cache,key+'.json');directory(cache);
    if(ttlMs>0&&fs.existsSync(file)) {
      try{
        const hit=readJson(file,64000),p=hit.packet;
        const nodes=new Map(eligible.nodes.map(n=>[(n.scope??'public')+'/'+n.id,n])),sources=new Map(graph.sources.map(s=>[s.id,s]));
        const safe=p&&typeof p==='object'&&p.schemaVersion===1&&p.algorithm===GRAPH_VERSION&&p.revision===graph.revision
          &&p.policyVersion===this.grant.policyVersion&&JSON.stringify(p.scopes)===JSON.stringify(eligible.options.scopes)
          &&p.byteLimit===eligible.options.maxBytes&&Buffer.byteLength(JSON.stringify(p))<=eligible.options.maxBytes
          &&['ready','no-match','bounded-empty'].includes(p.status)&&Array.isArray(p.results)&&p.results.length<=eligible.options.maxResults
          &&p.results.every(r=>{const n=nodes.get(r.scope+'/'+r.id);return n&&r.label===n.label&&r.summary===n.summary.slice(0,1000)
            &&r.domain===n.domain&&r.type===n.type&&r.status===(n.status??'not-specified')&&Number.isFinite(r.score)
            &&Array.isArray(r.sources)&&r.sources.every(s=>n.source_ids.includes(s.id)&&sources.get(s.id)?.url===s.url&&sources.get(s.id)?.title.slice(0,220)===s.title)
            &&Array.isArray(r.connections)&&r.connections.every(e=>nodes.has(r.scope+'/'+e.id));});
        if(safe&&hit.packetSha256===digest(canonical(p))&&hit.key===key&&Number.isFinite(hit.createdAt)&&hit.createdAt<=now&&now-hit.createdAt<ttlMs){return{...p,asOf,cache:{hit:true,key,kind:'local-result-cache',ageMs:now-hit.createdAt}};}
      }catch{/* A corrupt cache is disposable; immutable snapshots remain authoritative. */}
    }
    const packet=queryGraph(graph,effective,this.grant);
    if(ttlMs>0)atomicJson(file,{key,createdAt:now,packet,packetSha256:digest(canonical(packet))});
    // Bound persisted derived cache. This is FIFO by last write; it is not LRU.
    const entries=fs.readdirSync(cache).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).map(n=>({n,mtime:fs.lstatSync(path.join(cache,n)).mtimeMs})).sort((a,b)=>a.mtime-b.mtime||a.n.localeCompare(b.n));
    for(const old of entries.slice(0,Math.max(0,entries.length-128)))fs.unlinkSync(path.join(cache,old.n));
    return{...packet,cache:{hit:false,key,kind:'local-result-cache',ageMs:0}};
  }
}

/** Export only the selected grant's eligible graph. Filenames use stable IDs;
 * references are links, never downloaded publisher text or executed plugins. */
export function exportObsidian(graph,destination,query,grant) {
  validateGraph(graph);const {nodes,edges}=eligibleGraph(graph,query,grant),root=path.resolve(destination);directory(root);
  const sourceMap=new Map(graph.sources.map(s=>[s.id,s]));
  for(const n of nodes)if(fs.existsSync(path.join(root,(n.scope??'public')+'--'+n.id+'.md')))throw new Error('Export destination contains a note that would be overwritten');
  for(const n of nodes) {
    const filename=(n.scope??'public')+'--'+n.id+'.md',target=path.join(root,filename);
    if(fs.existsSync(target))throw new Error('Export destination contains a note that would be overwritten');
    const rel=edges.filter(e=>(e.scope??'public')===(n.scope??'public')&&(e.source===n.id||e.target===n.id));
    const front=['---','id: '+JSON.stringify(n.id),'domain: '+JSON.stringify(n.domain),'status: '+JSON.stringify(n.status??'not-specified'),'scope: '+JSON.stringify(n.scope??'public'),'tags: [daftar, research-memory]','---'];
    const outgoing=rel.map(e=>{const other=e.source===n.id?e.target:e.source;return'- '+e.type+' ('+(e.source===n.id?'outgoing':'incoming')+'): [['+(n.scope??'public')+'--'+other+']]';});
    const citations=n.source_ids.map(id=>{const s=sourceMap.get(id);return'- ['+s.title.replaceAll('[','(').replaceAll(']',')')+']('+s.url+') — '+(s.access_depth??'reading depth not specified');});
    const equation=typeof n.latex==='string'?'\n\n$$\n'+n.latex+'\n$$':'';
    const formulaDetails=n.type==='formula'?['','## Assumptions','',...(n.assumptions??[]).map(s=>'- '+s),'','## Worked check','',n.example??'','', '## Limits','',...(n.limitations??[]).map(s=>'- '+s)]:[];
    fs.writeFileSync(target,[...front,'','# '+n.label,'',n.summary+equation,...formulaDetails,'','## Connections','',...outgoing,'','## Sources','',...citations,'','Evidence links and mathematical analogies do not grant tool permissions.',''].join('\n'),{flag:'wx',mode:0o600});
  }
  return{notes:nodes.length,edges:edges.length,destination:root};
}
