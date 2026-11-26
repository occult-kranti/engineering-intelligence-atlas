import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface DashboardOptions { rendererRoot: string; dispatch: (method: string, args: unknown[]) => Promise<unknown> | unknown }
const STATIC_ASSETS = ['chrome.html','chrome.css','chrome.js','browser-bridge.js','studio-tokens.css','office-signals.js','freeflow.css','model-pool.js',
  'canvas-craft.css','resource-library.css','hardware-workbench.css','hardware-workbench.js','donna-studio.css','donna-studio.js',
  ...['camera','layout','model','threads','scene','controls','a11y-list','inspector','studio','intake','staffing-plan','manage','canvas-workspace','donna-team','member','universe','workspace'].map(n=>`freeflow/${n}.js`),
  ...['core','graphMemory','model','office-types','panel'].map(n=>`brain/${n}.js`), 'brain/panel.css',
  ...['budget','catalog','model','panel'].map(n=>`resource-library/${n}.js`),
  ...['donna-studio.webp','donna-studio.blend','donna-studio.glb','provenance.json'].map(n=>`assets/donna-studio/${n}`),
  ...['index.html','studio.css','core.mjs','studio.mjs','vendor/three.module.min.js','assets/reference-observatory.html'].map(n=>`studios/threejs/${n}`)];
/** Explicit manifest: only these compiled renderer files are ever served. */
const ALLOWED_FILES: Record<string,string> = Object.freeze({'/':'chrome.html',...Object.fromEntries(STATIC_ASSETS.map(f=>['/'+f,f]))});
const has = (o:object,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
const digest = (s:string) => crypto.createHash('sha256').update(s).digest('hex');
/** Same private workspace in the owner's browser; never binds to a public interface. */
export class PersonalDashboardServer {
  private server: http.Server | null = null;
  private starting: Promise<void> | null = null;
  private origin = '';
  private readonly launches = new Map<string,number>();
  private readonly sessions = new Map<string,number>();
  constructor(private readonly options: DashboardOptions) {}
  async start(): Promise<void> {
    if (this.server) return;
    if (this.starting) return this.starting;
    this.starting = this.open();
    try { await this.starting; } finally { this.starting = null; }
  }
  private async open(): Promise<void> {
    const server = http.createServer((req,res)=>{void this.handle(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end('Dashboard operation failed.');});});
    server.requestTimeout = 30000; server.headersTimeout = 10000;
    await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
    this.server = server; const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Personal dashboard did not bind.');
    this.origin = `http://127.0.0.1:${address.port}`;
  }
  async launchUrl(): Promise<string> {
    await this.start(); this.expire();
    const token=crypto.randomBytes(32).toString('hex'); this.launches.set(digest(token),Date.now()+5*60000);
    while(this.launches.size>8)this.launches.delete(this.launches.keys().next().value!);
    return `${this.origin}/#session=${token}`;
  }
  async close(): Promise<void> {
    await this.starting?.catch(() => undefined);
    const server=this.server; this.server=null;this.sessions.clear();this.launches.clear();
    if(server){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  }
  private expire(): void { for(const entries of [this.launches,this.sessions])for(const [key,expires]of entries)if(expires<Date.now())entries.delete(key); }
  private async body(req:http.IncomingMessage):Promise<any>{let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>750000)throw new Error('Request exceeds limit');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  private async handle(req:http.IncomingMessage,res:http.ServerResponse):Promise<void>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
    if(req.headers.host!==new URL(this.origin).host){res.writeHead(403);res.end('Invalid host');return;}
    const rawTarget=req.url||'/';
    const rawPath=rawTarget.split(/[?#]/,1)[0]!;
    const unsafeRawPath=(()=>{
      if(rawPath.includes('\\'))return true;
      let decoded=rawPath;
      for(let i=0;i<3;i++){
        if(/%5c/i.test(decoded)||decoded.includes('\\'))return true;
        try{const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next;}catch{return true;}
      }
      if(decoded.includes('\\'))return true;
      return rawPath.split('/').some(seg=>{
        let s=seg;
        for(let i=0;i<3;i++){try{const n=decodeURIComponent(s);if(n===s)break;s=n;}catch{return true;}}
        return s==='.'||s==='..';
      });
    })();
    if(unsafeRawPath){res.writeHead(400);res.end('Invalid path');return;}
    const url=new URL(rawTarget,this.origin);this.expire();
    if(req.method==='GET'&&has(ALLOWED_FILES,url.pathname)){
      const file=ALLOWED_FILES[url.pathname]!;
      const mime: Record<string,string> = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.webp':'image/webp', '.glb':'model/gltf-binary', '.blend':'application/octet-stream' };
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      if(file.endsWith('.blend')) res.setHeader('Content-Disposition','attachment; filename="donna-studio.blend"');
      let bytes:Buffer;
      try{
        const base=await fs.promises.realpath(this.options.rendererRoot);
        const real=await fs.promises.realpath(path.join(this.options.rendererRoot,file));
        if(real!==base&&!real.startsWith(base+path.sep)){res.removeHeader('Content-Type');res.writeHead(404);res.end('Not found');return;}
        bytes=await fs.promises.readFile(real);
      }catch(e){if((e as NodeJS.ErrnoException)?.code==='ENOENT'||(e as NodeJS.ErrnoException)?.code==='ENOTDIR'||(e as NodeJS.ErrnoException)?.code==='EISDIR'){res.removeHeader('Content-Type');res.writeHead(404);res.end('Not found');return;}throw e;}
      res.end(file.endsWith('.html') ? bytes.toString('utf8').replace('</head>', '<meta name="atlas-personal-dashboard" content="1"></head>') : bytes);return;
    }
    if(req.method!=='POST'||req.headers.origin!==this.origin||!req.headers['content-type']?.startsWith('application/json')){res.writeHead(403);res.end('Origin and JSON request required');return;}
    let data:any;try{data=await this.body(req);}catch{res.writeHead(400);res.end('Invalid request');return;}
    res.setHeader('Content-Type','application/json; charset=utf-8');
    if(url.pathname==='/api/session'){
      const token=typeof data?.token==='string'?data.token:'';const key=digest(token);
      if(!this.launches.has(key)){res.writeHead(401);res.end(JSON.stringify({ok:false,error:'Open a fresh personal dashboard link from the desktop app.'}));return;}
      this.launches.delete(key);const session=crypto.randomBytes(32).toString('hex');this.sessions.set(digest(session),Date.now()+12*60*60000);
      while(this.sessions.size>8)this.sessions.delete(this.sessions.keys().next().value!);
      res.setHeader('Set-Cookie',`atlas_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);res.end('{"ok":true}');return;
    }
    const session=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('atlas_session='))?.slice(14)||'';
    if(!this.sessions.has(digest(session))){res.writeHead(401);res.end(JSON.stringify({ok:false,error:'This browser session is locked. Open a new link from the desktop app.'}));return;}
    if(url.pathname!=='/api/call'||typeof data?.method!=='string'||!Array.isArray(data.args)||data.args.length>8){res.writeHead(400);res.end('{"ok":false,"error":"Invalid dashboard request"}');return;}
    try{const result=await this.options.dispatch(data.method,data.args);res.end(JSON.stringify({result}));}
    catch{res.writeHead(400);res.end(JSON.stringify({error:'This operation is unavailable or could not be completed. Check its settings in the desktop app.'}));}
  }
}
