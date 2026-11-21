import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface DashboardOptions { rendererRoot: string; dispatch: (method: string, args: unknown[]) => Promise<unknown> | unknown }
const ALLOWED_FILES: Record<string,string> = {'/':'chrome.html','/chrome.html':'chrome.html','/chrome.css':'chrome.css','/chrome.js':'chrome.js','/browser-bridge.js':'browser-bridge.js'};
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
    const url=new URL(req.url||'/',this.origin);this.expire();
    if(req.method==='GET'&&ALLOWED_FILES[url.pathname]){
      const file=ALLOWED_FILES[url.pathname]!;res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
      const bytes = await fs.promises.readFile(path.join(this.options.rendererRoot,file));
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
