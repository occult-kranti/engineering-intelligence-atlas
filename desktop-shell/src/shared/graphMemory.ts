/** Source-linked retrieval over an explicitly scoped graph. No I/O, model calls,
 * permissions, or automatic execution. Scores are rankings, never probabilities.
 * The caller must derive allowedScopes from its authenticated authority context.
 */
export const GRAPH_VERSION = 'daftar-graph-memory-2';
export const GRAPH_LIMITS = Object.freeze({ nodes: 12000, edges: 60000, sources: 8000, results: 12, bytes: 12288, iterations: 160 });
export interface GraphSource { id: string; title: string; url: string; access_depth?: string; year?: number | string; [key: string]: unknown }
export interface GraphNode {
  id: string; label: string; type: string; domain: string; summary: string;
  scope?: string; status?: string; classification?: string; source_ids: string[];
  valid_from?: string | null; valid_until?: string | null; taxonomy_path?: string[];
  [key: string]: unknown;
}
export interface GraphEdge {
  source: string; target: string; type: string; label?: string; weight?: number;
  source_ids?: string[]; scope?: string; valid_from?: string | null; valid_until?: string | null;
  [key: string]: unknown;
}
export interface KnowledgeGraph { schemaVersion: 1; revision: string; nodes: GraphNode[]; edges: GraphEdge[]; sources: GraphSource[]; [key: string]: unknown }
export interface GraphQuery {
  query: string; scopes?: string[]; maxResults?: number; maxBytes?: number;
  asOf?: string; alpha?: number; relations?: string[]; seedLimit?: number;
}
export interface GraphGrant { allowedScopes: readonly string[]; policyVersion: string }
export interface GraphResult {
  id: string; scope: string; label: string; type: string; domain: string;
  summary: string; status: string; score: number; lexicalRank: number | null;
  graphRank: number | null; matchedTerms: string[];
  sources: Array<{ id: string; title: string; url: string; accessDepth: string }>;
  connections: Array<{ id: string; relation: string; direction: 'outgoing' | 'incoming' }>;
}
export interface GraphPacket {
  schemaVersion: 1; algorithm: string; status: 'ready' | 'no-match' | 'bounded-empty';
  revision: string; scopes: string[]; policyVersion: string; query: string;
  asOf: string; temporalSignature: string; results: GraphResult[];
  eligibleNodes: number; omittedCount: number; iterations: number; residual: number;
  byteLimit: number; policy: string;
}
const encoder = new TextEncoder();
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/;
const SOURCE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,299}$/;
const SCOPE = /^[a-z][a-z0-9-]{0,79}$/;
const STOP = new Set('a an the of for and or to in on with how what why is are does do this that our from using use can as at by be been it into their these which'.split(' '));
const ROUTABLE = new Set(['requires', 'prerequisite_of', 'derived_from', 'related', 'related_to', 'implements', 'applies_to', 'uses', 'supports', 'specializes', 'generalizes', 'member_of', 'part_of', 'connects', 'analogy', 'contradicts', 'tests', 'explains']);
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const string = (v: unknown, limit = 50000): v is string => typeof v === 'string' && v.length <= limit;
const scope = (n: { scope?: string }): string => n.scope ?? 'public';
const key = (n: { id: string; scope?: string }): string => scope(n) + '/' + n.id;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
function validTime(v: unknown): boolean {
  return v === null || v === undefined || typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,19) === v.slice(0,19);
}
function active(v: { valid_from?: string | null; valid_until?: string | null }, at: number): boolean {
  return (!v.valid_from || Date.parse(v.valid_from) <= at) && (!v.valid_until || at < Date.parse(v.valid_until));
}
function safeUrl(value: unknown): boolean {
  if (!string(value, 3000)) return false;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
/** Validate joins and time intervals before ingestion. Unknown annotations remain
 * inert data. Duplicate IDs within a scope and dangling source references fail. */
export function validateGraph(value: unknown): asserts value is KnowledgeGraph {
  if (!object(value) || value.schemaVersion !== 1 || !string(value.revision, 200)
    || !Array.isArray(value.nodes) || value.nodes.length > GRAPH_LIMITS.nodes
    || !Array.isArray(value.edges) || value.edges.length > GRAPH_LIMITS.edges
    || !Array.isArray(value.sources) || value.sources.length > GRAPH_LIMITS.sources) throw new Error('Invalid or oversized graph');
  const sources = new Set<string>();
  for (const s of value.sources) {
    if (!object(s) || !string(s.id, 300) || !SOURCE_ID.test(s.id) || sources.has(s.id)
      || !string(s.title, 2000) || !safeUrl(s.url)
      || s.access_depth !== undefined && !string(s.access_depth, 300)) throw new Error('Invalid or duplicate source');
    sources.add(s.id);
  }
  const ids = new Set<string>();
  const refs = (v: unknown): boolean => Array.isArray(v) && v.length <= 80 && v.every(x => typeof x === 'string' && sources.has(x));
  const interval = (v: Record<string, unknown>): boolean => validTime(v.valid_from) && validTime(v.valid_until)
    && (!v.valid_from || !v.valid_until || Date.parse(String(v.valid_from)) < Date.parse(String(v.valid_until)));
  for (const n of value.nodes) {
    if (!object(n) || !string(n.id, 160) || !ID.test(n.id) || !string(n.label, 1000)
      || !string(n.summary) || !string(n.type, 80) || !string(n.domain, 80)
      || n.status !== undefined && !string(n.status, 160)
      || n.classification !== undefined && !['public','internal','private'].includes(String(n.classification))
      || n.taxonomy_path !== undefined && (!Array.isArray(n.taxonomy_path) || n.taxonomy_path.length > 12 || n.taxonomy_path.some(p => !string(p, 500)))
      || n.scope !== undefined && (typeof n.scope !== 'string' || !SCOPE.test(n.scope))
      || !refs(n.source_ids) || !interval(n)) throw new Error('Invalid graph node');
    const k = key(n as unknown as GraphNode);
    if (ids.has(k)) throw new Error('Duplicate node within scope');
    if ((n.scope ?? 'public') === 'public' && n.classification !== undefined && n.classification !== 'public') throw new Error('Private classification in public scope');
    ids.add(k);
  }
  for (const e of value.edges) {
    if (!object(e) || !string(e.source, 160) || !string(e.target, 160) || !string(e.type, 80)
      || e.scope !== undefined && (typeof e.scope !== 'string' || !SCOPE.test(e.scope))
      || e.weight !== undefined && (!finite(e.weight) || e.weight < 0 || e.weight > 100)
      || e.source_ids !== undefined && !refs(e.source_ids) || !interval(e)
      || !ids.has((e.scope ?? 'public') + '/' + e.source) || !ids.has((e.scope ?? 'public') + '/' + e.target)) throw new Error('Invalid edge or unresolved endpoint');
  }
}
export function tokenize(text: string): string[] {
  return (text.normalize('NFKC').toLocaleLowerCase('en-US').match(/[\p{L}\p{N}][\p{L}\p{N}_+-]*/gu) ?? [])
    .filter(t => t.length <= 80 && !STOP.has(t));
}
function request(q: GraphQuery, grant: GraphGrant): { scopes: string[]; asOf: string; at: number; maxResults: number; maxBytes: number; alpha: number; seedLimit: number } {
  if (!object(q) || !string(q.query, 4000) || !object(grant) || !Array.isArray(grant.allowedScopes)
    || !grant.allowedScopes.every(s => typeof s === 'string' && SCOPE.test(s)) || !string(grant.policyVersion, 200)) throw new Error('Invalid query or scope grant');
  if (q.scopes !== undefined && (!Array.isArray(q.scopes) || q.scopes.some(s => typeof s !== 'string'))) throw new Error('Invalid query scopes');
  const scopes = [...new Set(q.scopes ?? ['public'])].sort(compare);
  if (!scopes.length || scopes.length > 16 || scopes.some(s => !SCOPE.test(s) || !grant.allowedScopes.includes(s))) throw new Error('Scope is not authorized by caller');
  const maxResults = q.maxResults ?? 6, maxBytes = q.maxBytes ?? 8192, alpha = q.alpha ?? 0.85, seedLimit = q.seedLimit ?? 8;
  if (!Number.isInteger(maxResults) || maxResults < 0 || maxResults > GRAPH_LIMITS.results
    || !Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > GRAPH_LIMITS.bytes
    || !finite(alpha) || alpha < 0 || alpha >= 1
    || !Number.isInteger(seedLimit) || seedLimit < 1 || seedLimit > 32
    || q.relations !== undefined && (!Array.isArray(q.relations) || q.relations.length > 32 || q.relations.some(r => !ROUTABLE.has(r)))) throw new Error('Invalid retrieval bounds');
  const asOf = q.asOf ?? new Date().toISOString();
  if (!validTime(asOf)) throw new Error('asOf requires an explicit UTC instant');
  return { scopes, asOf, at: Date.parse(asOf), maxResults, maxBytes, alpha, seedLimit };
}
/** Eligible subgraph is constructed BEFORE lexical statistics or propagation.
 * Scope exclusion therefore cannot alter IDF, graph ranks, or evidence results. */
export function eligibleGraph(graph: KnowledgeGraph, q: GraphQuery, grant: GraphGrant): { nodes: GraphNode[]; edges: GraphEdge[]; temporalSignature: string; options: ReturnType<typeof request> } {
  const options = request(q, grant), allowed = new Set(options.scopes);
  const nodes = graph.nodes.filter(n => allowed.has(scope(n)) && active(n, options.at) && !['retracted','deleted','quarantined'].includes(n.status??'')).sort((a,b) => compare(key(a),key(b)));
  const ids = new Set(nodes.map(key));
  const edges = graph.edges.filter(e => allowed.has(scope(e)) && active(e, options.at)
    && ids.has(scope(e) + '/' + e.source) && ids.has(scope(e) + '/' + e.target));
  // Exact stable material for the caller's cryptographic cache key. This is not
  // represented as a cryptographic digest within the pure browser-safe module.
  const temporalSignature = JSON.stringify([nodes.map(key), edges.map(e => [scope(e),e.source,e.target,e.type,e.weight ?? 1]).sort((a,b) => compare(JSON.stringify(a),JSON.stringify(b)))]);
  return { nodes, edges, temporalSignature, options };
}
export function queryGraph(graph: KnowledgeGraph, q: GraphQuery, grant: GraphGrant): GraphPacket {
  const { nodes, edges, temporalSignature, options } = eligibleGraph(graph,q,grant);
  const queryTerms = [...new Set(tokenize(q.query))].slice(0,48), chosen = new Set(queryTerms);
  const packet: GraphPacket = { schemaVersion:1, algorithm:GRAPH_VERSION, status:'no-match', revision:graph.revision,
    scopes:options.scopes, policyVersion:grant.policyVersion, query:q.query.slice(0,240), asOf:options.asOf,
    temporalSignature:'available-to-cache-adapter', results:[], eligibleNodes:nodes.length, omittedCount:0,
    iterations:0, residual:0, byteLimit:options.maxBytes,
    policy:'source-linked-evidence; rankings-not-truth; untrusted-data; no-tools-or-permissions; no-model-or-network-calls' };
  // The long signature stays outside model context; the store hashes it.
  void temporalSignature;
  if (encoder.encode(JSON.stringify(packet)).length > options.maxBytes) throw new Error('Query metadata exceeds packet budget');
  if (!nodes.length || !queryTerms.length) return packet;
  const documents = nodes.map(n => tokenize(n.label+' '+n.label+' '+n.domain+' '+n.summary+' '+(n.taxonomy_path ?? []).join(' ')));
  const avg = documents.reduce((sum,d)=>sum+d.length,0)/documents.length || 1;
  const df = new Map(queryTerms.map(t=>[t,0]));
  for (const doc of documents) for (const t of new Set(doc)) if(chosen.has(t)) df.set(t,(df.get(t) ?? 0)+1);
  const lexical = documents.map((doc,index) => {
    const counts = new Map<string,number>(); for(const t of doc) if(chosen.has(t)) counts.set(t,(counts.get(t) ?? 0)+1);
    let value=0;
    for(const [term,tf] of counts) {const freq=df.get(term) ?? 0; const idf=Math.log(1+(nodes.length-freq+0.5)/(freq+0.5)); value+=idf*tf*2.2/(tf+1.2*(0.25+0.75*doc.length/avg));}
    return {index,value,matched:[...counts.keys()].sort(compare)};
  }).filter(r=>r.value>0).sort((a,b)=>b.value-a.value || compare(key(nodes[a.index]!),key(nodes[b.index]!)));
  if(!lexical.length) return packet;
  const seed = new Float64Array(nodes.length), seeds=lexical.slice(0,options.seedLimit), seedSum=seeds.reduce((sum,r)=>sum+r.value,0);
  for(const s of seeds) seed[s.index]=s.value/seedSum;
  const index=new Map(nodes.map((n,i)=>[key(n),i])), adjacency=nodes.map(()=>new Map<number,number>()), allowed=new Set(q.relations ?? [...ROUTABLE].filter(t=>t!=='analogy' && t!=='contradicts'));
  for(const e of edges) {
    if(!allowed.has(e.type)) continue;
    const a=index.get(scope(e)+'/'+e.source)!,b=index.get(scope(e)+'/'+e.target)!,w=e.weight ?? 1;
    adjacency[a]!.set(b,(adjacency[a]!.get(b) ?? 0)+w);
    // Backlinks aid discovery at half strength; this does not reverse the
    // logical meaning of the edge exposed in the returned evidence packet.
    adjacency[b]!.set(a,(adjacency[b]!.get(a) ?? 0)+w*0.5);
  }
  const degree=adjacency.map(row=>[...row.values()].reduce((a,b)=>a+b,0));
  let rank=Float64Array.from(seed);
  for(let iteration=0;iteration<GRAPH_LIMITS.iterations;iteration++) {
    const next=Float64Array.from(seed,x=>(1-options.alpha)*x); let dangling=0;
    for(let a=0;a<nodes.length;a++) {
      if(degree[a]===0) {dangling+=rank[a]!;continue;}
      for(const [b,w] of adjacency[a]!) next[b]=next[b]!+options.alpha*rank[a]!*w/degree[a]!;
    }
    for(let a=0;a<nodes.length;a++) next[a]=next[a]!+options.alpha*dangling*seed[a]!;
    packet.residual=next.reduce((sum,v,i)=>sum+Math.abs(v-rank[i]!),0); rank=next;packet.iterations=iteration+1;
    if(packet.residual<1e-10) break;
  }
  const graphRanks=[...rank].map((value,index)=>({value,index})).filter(r=>r.value>1e-14)
    .sort((a,b)=>b.value-a.value || compare(key(nodes[a.index]!),key(nodes[b.index]!)));
  const lr=new Map(lexical.map((r,i)=>[r.index,i+1])), gr=new Map(graphRanks.map((r,i)=>[r.index,i+1])), matches=new Map(lexical.map(r=>[r.index,r.matched]));
  const candidates=[...new Set([...lr.keys(),...gr.keys()])].map(index=>({index,score:(lr.has(index)?1/(60+lr.get(index)!):0)+(gr.has(index)?0.7/(60+gr.get(index)!):0)}))
    .sort((a,b)=>b.score-a.score || compare(key(nodes[a.index]!),key(nodes[b.index]!)));
  const sourceMap=new Map(graph.sources.map(s=>[s.id,s]));
  const size=():number=>encoder.encode(JSON.stringify(packet)).length;
  packet.omittedCount=candidates.length;
  for(const candidate of candidates) {
    if(packet.results.length>=options.maxResults) break;
    const n=nodes[candidate.index]!;
    const result:GraphResult={id:n.id,scope:scope(n),label:n.label,type:n.type,domain:n.domain,summary:n.summary.slice(0,1000),status:n.status ?? 'not-specified',score:Number(candidate.score.toPrecision(8)),lexicalRank:lr.get(candidate.index) ?? null,graphRank:gr.get(candidate.index) ?? null,matchedTerms:matches.get(candidate.index) ?? [],sources:n.source_ids.slice(0,4).map(id=>{const s=sourceMap.get(id)!;return{id,title:s.title.slice(0,220),url:s.url,accessDepth:s.access_depth ?? 'not-specified'};}),connections:edges.filter(e=>scope(e)===scope(n)&&(e.source===n.id||e.target===n.id)).slice(0,6).map(e=>({id:e.source===n.id?e.target:e.source,relation:e.type,direction:e.source===n.id?'outgoing':'incoming'}))};
    packet.results.push(result);packet.omittedCount--;
    if(size()>options.maxBytes) {packet.results.pop();packet.omittedCount++;}
  }
  packet.status=packet.results.length?'ready':'bounded-empty';
  // Metadata (iteration count, residual, status, omitted count) has now settled.
  // Enforce the final serialized budget, including multibyte query characters.
  while(size()>options.maxBytes && packet.results.length){packet.results.pop();packet.omittedCount++;packet.status=packet.results.length?'ready':'bounded-empty';}
  while(size()>options.maxBytes && packet.query.length){packet.query=Array.from(packet.query).slice(0,Math.floor(Array.from(packet.query).length/2)).join('');}
  if(size()>options.maxBytes)throw new Error('Final retrieval metadata exceeds packet budget');
  return packet;
}
/** Bounded breadth-first exploration with visited IDs: cycles terminate. */
export function exploreGraph(graph:KnowledgeGraph,start:string,q:GraphQuery,grant:GraphGrant,depth=2,maxNodes=120):{nodes:GraphNode[];edges:GraphEdge[];truncated:boolean} {
  if(!Number.isInteger(depth)||depth<0||depth>6||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>500) throw new Error('Invalid exploration bounds');
  const eligible=eligibleGraph(graph,q,grant), map=new Map(eligible.nodes.map(n=>[key(n),n]));
  if(!map.has(start)) return{nodes:[],edges:[],truncated:false};
  const seen=new Set([start]),queue:Array<[string,number]>=[[start,0]];let truncated=false;
  const neighbors=new Map<string,Set<string>>();
  for(const e of eligible.edges){const a=scope(e)+'/'+e.source,b=scope(e)+'/'+e.target;for(const [x,y]of[[a,b],[b,a]]){if(!neighbors.has(x!))neighbors.set(x!,new Set());neighbors.get(x!)!.add(y!);}}
  for(let pos=0;pos<queue.length;pos++){const [current,d]=queue[pos]!;if(d>=depth)continue;for(const next of [...(neighbors.get(current) ?? [])].sort(compare)){if(seen.has(next))continue;if(seen.size>=maxNodes){truncated=true;continue;}seen.add(next);queue.push([next,d+1]);}}
  return{nodes:[...seen].map(k=>map.get(k)!),edges:eligible.edges.filter(e=>seen.has(scope(e)+'/'+e.source)&&seen.has(scope(e)+'/'+e.target)),truncated};
}
/** Kahn's algorithm reports blocked prerequisites without looping. Remaining
 * vertices include cycle descendants; do not mislabel them all cycle members. */
export function prerequisitePlan(graph:KnowledgeGraph,q:GraphQuery,grant:GraphGrant):{order:string[];blocked:string[];acyclic:boolean} {
  const eligible=eligibleGraph(graph,q,grant), ids=eligible.nodes.map(key), next=new Map(ids.map(id=>[id,new Set<string>()])),degree=new Map(ids.map(id=>[id,0]));
  for(const e of eligible.edges){if(!['requires','prerequisite_of'].includes(e.type))continue;const from=scope(e)+'/'+(e.type==='requires'?e.target:e.source),to=scope(e)+'/'+(e.type==='requires'?e.source:e.target);if(!next.get(from)!.has(to)){next.get(from)!.add(to);degree.set(to,degree.get(to)!+1);}}
  const ready=ids.filter(id=>degree.get(id)===0).sort(compare), order:string[]=[];
  while(ready.length){const id=ready.shift()!;order.push(id);for(const target of [...next.get(id)!].sort(compare)){degree.set(target,degree.get(target)!-1);if(degree.get(target)===0){ready.push(target);ready.sort(compare);}}}
  const done=new Set(order),blocked=ids.filter(id=>!done.has(id));return{order,blocked,acyclic:blocked.length===0};
}
