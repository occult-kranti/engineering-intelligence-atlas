// Behavioral DOM checks using real projection/retrieval functions and an
// isolated command adapter. These are not native persistence or provider tests.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { mountDonnaBrain, type DonnaBrainContext, type DonnaBrainPanel } from '../src/renderer/brain/panel.js';
import { makeBrainNote } from '../src/renderer/brain/core.js';
import { recordLifetime, safeBrainSourceUrl } from '../src/renderer/brain/model.js';
import type { OfficeSnapshot, OfficeCommand } from '../src/renderer/brain/office-types.js';

const AT='2026-11-25T12:00:00.000Z';
let dom:FreeflowDom, panel:DonnaBrainPanel|null, host:HTMLElement;
beforeEach(()=>{dom=installDom();panel=null;host=document.createElement('section');document.body.append(host);});
afterEach(()=>{panel?.destroy();dom.restore();});
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(size=2):OfficeSnapshot {
  return {
    schemaVersion:1,activeCompanyId:'alpha',
    companies:['alpha','beta'].map(id=>({id,name:id==='alpha'?'Alpha Studio':'Private Beta',repoUrl:`https://example.invalid/${id}`,status:'active',assistantId:id+'-donna',createdAt:'2026-11-01T00:00:00Z',source:'fixture',importedAt:null,githubStatus:'unchecked'})),
    offices:[{id:'office-a',companyId:'alpha',name:'Alpha office',status:'active',assistantId:'alpha-donna',createdAt:'2026-11-01T00:00:00Z'}],
    departments:[],employees:[{id:'alpha-donna',companyId:'alpha',officeId:'office-a',departmentId:null,name:'Alpha assistant',role:'Coordinator',kind:'assistant',status:'active',skillPaths:['skills/review/SKILL.md'],createdAt:AT,updatedAt:AT}],
    knowledge:[...Array.from({length:size},(_,i)=>({id:`note-${i}`,companyId:'alpha',title:`Evidence ${String(i).padStart(3,'0')}`,summary:i===0?makeBrainNote({type:'decision',body:'Use a finite cache budget. Review retention every release.',tags:['cache']}):`Verified fixture observation ${i}`,artifactUri:'https://example.invalid/evidence',createdAt:'2026-11-02T00:00:00Z'})),
      {id:'beta-secret',companyId:'beta',title:'BETA-PRIVATE-CANARY',summary:'Never belongs in the alpha projection.',artifactUri:'private://beta',createdAt:AT}],
    jobs:[],goals:[],schedules:[],cache:{enabled:true,maxEntries:100,ttlMinutes:60,entries:[],hits:0,misses:0},events:[],lastAction:null,
  } as OfficeSnapshot;
}
function mount(snapshot=fixture(),writable=true,custom?:(c:OfficeCommand)=>Promise<OfficeSnapshot>) {
  let state=snapshot, companyId=state.activeCompanyId, seq=0;
  const calls:OfficeCommand[]=[];
  const context=():DonnaBrainContext=>({snapshot:state,companyId,writable,modeLabel:writable?'Saved company records':'Example company · read only',unavailableReason:'Read-only sample.'});
  const command=async(c:OfficeCommand):Promise<OfficeSnapshot>=>{
    calls.push(structuredClone(c));if(custom)return custom(c);
    const at=`2026-11-25T11:00:${String(++seq).padStart(2,'0')}.000Z`, id='saved-'+seq;
    if(c.action==='add_knowledge')state={...state,knowledge:[...state.knowledge,{id,companyId:String(c.companyId),title:String(c.title),summary:String(c.summary),artifactUri:String(c.artifactUri),createdAt:at}]};
    if(c.action==='create_goal')state={...state,goals:[...(state.goals??[]),{id,companyId:(c.scope as {id:string}).id,scope:c.scope,title:c.title,description:c.description,mode:c.mode,status:'draft',maxIterations:c.maxIterations,iteration:0,jobIds:[],steps:[],runSettings:c.runSettings,createdAt:at,updatedAt:at} as NonNullable<OfficeSnapshot['goals']>[number]]};
    panel?.refresh();return state;
  };
  panel=mountDonnaBrain(host,{context,command,now:()=>AT});
  return {calls,state:()=>state,setState:(next:OfficeSnapshot)=>{state=next;panel!.refresh();},switchCompany:(id:string)=>{companyId=id;state={...state,activeCompanyId:id};panel!.refresh();}};
}
function input(suffix:string,value:string){const node=host.querySelector<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>(`[id$="-${suffix}"]`)!;node.value=value;node.dispatchEvent(new dom.window.Event('input',{bubbles:true}));return node;}
function action(name:string){const node=host.querySelector<HTMLButtonElement>(`[data-brain-action="${name}"]`)!;expect(node).toBeTruthy();node.click();return node;}
function submit(){host.querySelector('.brain-note-form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));}
function fillNote(){input('title','Cache decision');input('body','Cache validity ends when source evidence changes.');input('tags','memory, evidence');}

describe('native Donna Brain pane',()=>{
  it('scopes before search, bounds graph and list, and finds late records before pagination',()=>{
    const m=mount(fixture(125));
    expect(host.textContent).not.toContain('BETA-PRIVATE-CANARY');
    expect(host.querySelectorAll('[data-brain-node]').length).toBeLessThanOrEqual(60);
    expect(host.querySelectorAll('[data-brain-record]')).toHaveLength(24);
    input('search','Evidence 124');expect(host.querySelectorAll('[data-brain-record]')).toHaveLength(1);
    expect(host.querySelector('[data-brain-record]')!.textContent).toContain('Evidence 124');
    action('recall');expect(host.querySelector('.brain-recall')!.textContent).not.toContain('BETA-PRIVATE-CANARY');
    expect(m.calls).toHaveLength(0);
  });

  it('uses the existing add_knowledge command, confirms the saved record and clears only its draft',async()=>{
    const m=mount();fillNote();input('source','https://example.invalid/commit/abc123');submit();await flush();
    expect(m.calls).toHaveLength(1);expect(m.calls[0]).toMatchObject({action:'add_knowledge',companyId:'alpha',title:'Cache decision',artifactUri:'https://example.invalid/commit/abc123'});
    expect(JSON.parse(String(m.calls[0]!.summary))).toMatchObject({kind:'daftar-brain-note',type:'fact',body:'Cache validity ends when source evidence changes.',tags:['evidence','memory'],supersedes:null});
    expect((host.querySelector('[id$="-body"]') as HTMLTextAreaElement).value).toBe('');
    expect(host.querySelector('.brain-message')!.textContent).toContain('Saved memory · saved-1');
    expect(host.querySelector('.brain-inspector')!.textContent).toContain('knowledge:saved-1');
    expect(m.state().knowledge.some(k=>k.id==='saved-1')).toBe(true);
  });

  it('appends corrections and retains earlier evidence outside current recall',async()=>{
    const m=mount();host.querySelector<HTMLButtonElement>('[data-brain-record="knowledge:note-0"]')!.click();action('correct');
    input('body','Use a 64 MiB cache budget, replacing the earlier unspecified budget.');submit();await flush();
    expect(JSON.parse(String(m.calls[0]!.summary)).supersedes).toBe('note-0');
    expect(m.state().knowledge.find(k=>k.id==='note-0')!.summary).toContain('finite cache budget');
    input('search','Evidence 000');expect(host.querySelectorAll('[data-brain-record]')).toHaveLength(1); // New correction title matches.
    expect(host.querySelector('[data-brain-record="knowledge:note-0"]')).toBeNull();
    const box=host.querySelector<HTMLInputElement>('.brain-history input')!;box.checked=true;box.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
    expect(host.querySelector('[data-brain-record="knowledge:note-0"]')).not.toBeNull();
  });

  it('keeps separate drafts across company changes and refreshes without browser storage',()=>{
    const m=mount();fillNote();panel!.refresh();expect((host.querySelector('[id$="-body"]') as HTMLTextAreaElement).value).toContain('source evidence');
    m.switchCompany('beta');expect((host.querySelector('[id$="-body"]') as HTMLTextAreaElement).value).toBe('');
    expect(host.textContent).not.toContain('Alpha assistant');input('title','Beta draft');input('body','Only in beta.');
    m.switchCompany('alpha');expect((host.querySelector('[id$="-title"]') as HTMLInputElement).value).toBe('Cache decision');
    expect((host.querySelector('[id$="-body"]') as HTMLTextAreaElement).value).toContain('source evidence');
    expect(dom.window.localStorage.length).toBe(0);expect(m.calls).toHaveLength(0);
  });

  it('retains queued and rejected note drafts and never manufactures a save receipt',async()=>{
    const m=mount(fixture(),true,async()=>{throw new Error('Queued for desktop confirmation · queued-1. This change has not been applied yet.');});
    fillNote();submit();await flush();expect(m.calls).toHaveLength(1);
    expect((host.querySelector('[id$="-body"]') as HTMLTextAreaElement).value).toContain('source evidence');
    expect(host.querySelector('.brain-message')!.textContent).toContain('not been applied');
    expect(host.querySelector('.brain-message')!.textContent).not.toContain('Saved memory');
  });

  it('requires a matching new record in the command receipt before clearing a note',async()=>{
    mount(fixture(),true,async()=>fixture());fillNote();submit();await flush();
    expect((host.querySelector('[id$="-body"]') as HTMLTextAreaElement).value).toContain('source evidence');
    expect(host.querySelector('.brain-message')!.textContent).toContain('without a confirmed saved note');
  });

  it('prepares a reviewable manual zero-dollar setup goal and saves only on explicit action',async()=>{
    const m=mount();action('prepare-setup');expect(m.calls).toHaveLength(0);
    expect(host.querySelector('.brain-setup-preview')!.textContent).toContain('manual · $0 provider allowance');
    action('save-setup');await flush();expect(m.calls.map(c=>c.action)).toEqual(['create_goal']);
    expect(m.calls[0]).toMatchObject({scope:{kind:'company',id:'alpha'},mode:'plan',runSettings:{mode:'manual',authorized:false,maxUsd:0,allowedTools:[]}});
    expect(host.querySelector('.brain-save-receipt')!.textContent).toContain('saved-1');
    action('prepare-setup');expect(host.querySelector('[data-brain-action="save-setup"]')).toBeNull();
    expect(host.querySelector('.brain-message')!.textContent).toContain('already exists');expect(m.calls).toHaveLength(1);
  });

  it('invalidates a reviewed setup draft after saved company evidence changes',()=>{
    const m=mount();action('prepare-setup');const state=m.state();m.setState({...state,knowledge:[...state.knowledge,{id:'new-evidence',companyId:'alpha',title:'Fresh fact',summary:'Different state',artifactUri:'',createdAt:AT}]});
    expect(host.querySelector<HTMLButtonElement>('[data-brain-action="save-setup"]')!.disabled).toBe(true);
    expect(host.querySelector('.brain-stale')!.textContent).toContain('records changed');expect(m.calls).toHaveLength(0);
  });

  it('keeps public samples read-only even when a submit event is dispatched directly',async()=>{
    const m=mount(fixture(),false);expect(host.querySelector<HTMLButtonElement>('[data-brain-action="save-note"]')!.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[data-brain-action="prepare-setup"]')!.disabled).toBe(true);
    fillNote();submit();await flush();expect(m.calls).toHaveLength(0);expect(host.querySelector('.brain-message')!.textContent).toContain('Read-only sample');
  });

  it('renders adversarial note text as text and does not activate artifact URLs',()=>{
    const s=fixture();s.knowledge[0]!.title='<img src=x onerror=alert(1)>';s.knowledge[0]!.summary='<script>untrusted()</script>';s.knowledge[0]!.artifactUri='javascript:alert(1)';
    mount(s);host.querySelector<HTMLButtonElement>('[data-brain-record="knowledge:note-0"]')!.click();
    expect(host.querySelector('.brain-inspector')!.textContent).toContain('javascript:alert(1)');expect(host.querySelectorAll('img,script')).toHaveLength(0);
    expect(host.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it('uses half-open expiry and labels quarantined records as excluded',()=>{
    const node={id:'x',label:'x',type:'knowledge',domain:'company',summary:'x',source_ids:[],valid_from:'2026-11-25T11:00:00Z',valid_until:AT};
    expect(recordLifetime(node,'2026-11-25T11:59:59.999Z')).toBe('current');expect(recordLifetime(node,AT)).toBe('historical');
    expect(recordLifetime({...node,valid_until:null,status:'quarantined'},AT)).toBe('excluded');
    for(const url of ['javascript:alert(1)','https://user:secret@example.invalid','https://example.invalid/?token=secret','https://example.invalid/\nunsafe'])expect(safeBrainSourceUrl(url)).toBeNull();
  });

  it('supports keyboard selection from the graph and destroys its owned DOM',()=>{
    mount();const node=host.querySelector<SVGElement>('[data-brain-node="knowledge:note-0"]')!;
    node.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    expect(host.querySelector('.brain-inspector')!.textContent).toContain('knowledge:note-0');expect(document.activeElement).toBe(host.querySelector('.brain-inspector'));panel!.destroy();expect(host.children).toHaveLength(0);
  });
});
