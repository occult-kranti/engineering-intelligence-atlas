/** Original Daftar studio utilities. These checks never execute scene source. */
export const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';
export const MODEL = Object.freeze({id:'ccore/Qwen3.5-4B-3D-Coder',revision:'4b9f05f3a0382725b679c5e32a338b88acaf0064',quantization:'Q4_K_M',license:'Apache-2.0'});
export const MAX_SOURCE_BYTES = 524288;
export const WORLD_LIMIT = 5000;
export const STUDIO_VISIBILITY_CHANNEL = 'daftar.studio.visibility.v1';
export const finite = (value, low, high, fallback=low) => Number.isFinite(Number(value)) ? Math.min(high,Math.max(low,Number(value))) : fallback;
export const byteLength = value => new TextEncoder().encode(value).length;

/** Accept only the actual embedding host's narrow presentation-only message. */
export function readParentVisibility(event,{parentWindow,selfWindow,origin,protocol}) {
  if(!parentWindow||parentWindow===selfWindow||event.source!==parentWindow) return null;
  const originMatches=protocol==='file:' ? event.origin==='null' :
    (protocol==='http:'||protocol==='https:')&&origin!=='null'&&event.origin===origin;
  const data=event.data;
  if(!originMatches||!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==3||
    data.type!=='daftar:studio:visibility'||data.channel!==STUDIO_VISIBILITY_CHANNEL||typeof data.visible!=='boolean') return null;
  return data.visible;
}

export function inspectSource(source) {
  const errors=[],warnings=[];
  if(typeof source!=='string') return {ok:false,errors:['Scene source must be text.'],warnings,scriptCount:0};
  if(byteLength(source)>MAX_SOURCE_BYTES) errors.push('The scene exceeds the 512 KiB source limit.');
  if(!/<html(?:\s|>)/i.test(source)||!/<\/html\s*>/i.test(source)||!/<body(?:\s|>)/i.test(source)||!/<\/body\s*>/i.test(source)) errors.push('Import a complete HTML document, including closing body and html tags.');
  const scripts=[...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  if(!scripts.length) errors.push('The document does not contain an inline scene script.');
  if((source.match(/<script\b/gi)||[]).length!==scripts.length) errors.push('A script is incomplete. Preserve the original response and request a complete file.');
  if(scripts.some(m=>/\bsrc\s*=/i.test(m[1]))) errors.push('External script tags are unsupported. Use the pinned Three.js core module.');
  if(/<(?:iframe|object|embed|form|base)\b/i.test(source)||/<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i.test(source)) errors.push('Nested pages, forms, objects, base URLs and automatic navigation are unsupported in the preview.');
  if(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|Worker|SharedWorker|sendBeacon)\b|\bimport\s*\(|\b(?:location|cookie|localStorage|sessionStorage)\b|window\s*\.\s*open\b/i.test(scripts.map(m=>m[2]).join('\n'))) errors.push('The scene requests network, navigation, storage or worker capabilities outside this preview.');
  const imports=[...source.matchAll(/\b(?:from\s*|import\s*)["']([^"']+)["']/g)].map(m=>m[1]);
  if(imports.some(url=>url!==THREE_URL)) errors.push('Use only the pinned Three.js 0.160.0 core module; other imports require a separate review.');
  if(!imports.includes(THREE_URL)) warnings.push('No pinned Three.js core import was found. This may be a non-Three.js scene.');
  if(/https?:\/\//i.test(source.split(THREE_URL).join(''))) warnings.push('Other URLs appear in the source. Preview network access is restricted; review each URL before exporting.');
  warnings.push('This is a source-pattern check, not a JavaScript parser or a security certification. Use the CLI for syntax checking and review the rendered scene separately.');
  return {ok:errors.length===0,errors:[...new Set(errors)],warnings,scriptCount:scripts.length};
}

export function parseWorkspace(text) {
  if(byteLength(text)>MAX_SOURCE_BYTES+32768) throw new Error('Workspace file is too large.');
  const data=JSON.parse(text);
  if(!data||data.schema!=='daftar.3d-studio.v1'||typeof data.source!=='string') throw new Error('Choose a Daftar 3D Studio workspace export.');
  if(byteLength(data.source)>MAX_SOURCE_BYTES) throw new Error('The scene exceeds the 512 KiB source limit.');
  return {source:data.source,brief:String(data.brief||'').slice(0,4000),title:String(data.title||'Imported scene').slice(0,100),owner:['Technical artist','Game designer','QA reviewer'].includes(data.owner)?data.owner:'Technical artist',provenance:'Imported workspace; authorship and review must be checked'};
}

export function exportWorkspace(state) {
  return {schema:'daftar.3d-studio.v1',title:String(state.title).slice(0,100),brief:String(state.brief).slice(0,4000),owner:state.owner,source:state.source,model:MODEL,provenance:state.provenance,review:state.review,exported_at:new Date().toISOString(),model_execution:'not_performed_by_this_browser',dependency:{threejs:'0.160.0',url:THREE_URL},notice:'Review fields are user observations, not independent certification. Exported HTML uses the pinned CDN dependency.'};
}

export function restoreLayout(text) {
  try {
    if(typeof text!=='string'||text.length>16384) return null;
    const data=JSON.parse(text);
    if(!data||data.version!==1) return null;
    return {x:finite(data.x,-WORLD_LIMIT,WORLD_LIMIT,0),y:finite(data.y,-WORLD_LIMIT,WORLD_LIMIT,0),scale:finite(data.scale,.35,1.6,1),panels:Object.fromEntries(Object.entries(data.panels||{}).filter(([id,p])=>['brief','scene','team','review','source','run','donna'].includes(id)&&p&&Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(0,7).map(([id,p])=>[id,{x:finite(p.x,-1000,3000),y:finite(p.y,-1000,3000)}]))};
  } catch { return null; }
}

export function cameraForRect(rect,viewport) {
  const width=Math.max(320,viewport.width),height=Math.max(200,viewport.height);
  const scale=finite(Math.min((width-64)/Math.max(1,rect.width),(height-64)/Math.max(1,rect.height)),.35,1.2,1);
  return {x:(width-rect.width*scale)/2-rect.x*scale,y:(height-rect.height*scale)/2-rect.y*scale,scale};
}
