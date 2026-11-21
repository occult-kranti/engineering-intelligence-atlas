import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowRight, Check, ChevronRight, Circle, Code2, ExternalLink, GitBranch, Layers3, Search, ShieldCheck, Users } from 'lucide-react';
import { WORKSPACE } from '@/data/company';
import { ROLES } from '@/data/roles';
import { SKILL_PACKAGES } from '@/data/skills';

const REPO = 'https://github.com/occult-kranti/engineering-intelligence-atlas';
const statusLabel: Record<string, string> = { todo: 'Planned', 'in-progress': 'In progress', blocked: 'Blocked', done: 'Complete' };

function Constellation() {
  const points = [[156,80],[79,147],[230,147],[66,244],[156,280],[246,244],[156,188]];
  return <svg className="workspace-art" viewBox="0 0 320 360" aria-hidden="true">
    <defs><pattern id="atlas-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="currentColor" opacity=".18" /></pattern></defs>
    <rect width="320" height="360" fill="url(#atlas-grid)" />
    <ellipse cx="156" cy="182" rx="128" ry="144" fill="none" stroke="currentColor" opacity=".12" />
    <ellipse cx="156" cy="182" rx="104" ry="118" fill="none" stroke="currentColor" opacity=".18" />
    {points.slice(0,6).map(([x,y],i)=><path key={i} d={`M156 188 Q${x} 188 ${x} ${y}`} fill="none" stroke="currentColor" opacity=".36" />)}
    {points.map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r={i===6?22:12} fill={i===6?'#22674b':'#f6f7f4'} stroke="currentColor" strokeWidth="1.5" /><circle cx={x} cy={y} r={i===6?5:3} fill={i===6?'#ffffff':'currentColor'} /></g>)}
    <text x="156" y="332" textAnchor="middle" fill="currentColor" fontSize="10" letterSpacing="3">ONE COMPANY · SEVEN ROLES</text>
  </svg>;
}

export default function Workspace({ roadmapOnly = false }: { roadmapOnly?: boolean }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const tasks = WORKSPACE.tasks;
  const complete = tasks.filter(t => (t.status as string) === 'done').length;
  const visibleTasks = useMemo(() => tasks.filter(t => (filter === 'all' || t.milestone === filter) && `${t.title} ${t.ownerId} ${t.priority}`.toLowerCase().includes(query.toLowerCase())), [tasks, filter, query]);
  return <div className="workspace-page">
    <div className="workspace-topline"><span><span className="status-dot" /> Public workspace · release snapshot</span><a href={REPO} target="_blank" rel="noreferrer"><GitBranch size={14} /> View repository <ExternalLink size={12} /></a></div>
    {roadmapOnly ? <header className="workspace-heading"><p className="kicker">Delivery / roadmap</p><h1>A clear path to what’s next.</h1><p>Current release work and the next milestones, with owners and evidence. Update tasks in the desktop company workspace.</p></header> : <>
      <header className="workspace-hero">
        <div><div className="workspace-eyebrow"><span className="workspace-monogram">A</span> ENGINEERING INTELLIGENCE ATLAS</div><h1>Good work starts<br />with a clear view.</h1><p>Your research, specialist team, and delivery plan. A company workspace built around evidence, with the tools to turn an idea into reviewed work.</p><div className="workspace-actions"><a className="workspace-primary" href={`${REPO}/releases/latest`} target="_blank" rel="noreferrer"><ArrowDownToLine size={16} /> Get the desktop build</a><a className="workspace-secondary" href="#/overview">Explore the atlas <ArrowRight size={16} /></a></div><div className="workspace-caption"><Code2 size={13} /> Rust company core <span>·</span> Local-first desktop <span>·</span> Source-linked research</div></div>
        <Constellation />
      </header>
      <section className="workspace-metrics" aria-label="Workspace summary">
        {[{value:'01',label:'Company workspace',note:WORKSPACE.company.owner},{value:String(WORKSPACE.employees.length).padStart(2,'0'),label:'Assigned specialist roles',note:'From the existing role library'},{value:SKILL_PACKAGES.length,label:'Research skills',note:`${ROLES.length} reference role charters`},{value:`${complete}/${tasks.length}`,label:'Roadmap tasks complete',note:'Recorded release status'}].map(x=><div key={x.label}><span className="metric-label">{x.label}</span><strong>{x.value}</strong><span className="metric-note">{x.note}</span></div>)}
      </section>
      <section className="workspace-paths" aria-label="Start working">
        <a href="#/science"><span className="path-icon"><Layers3 size={21}/></span><div><h2>Find the right expertise</h2><p>Science, models, sources, and research briefs.</p></div><ArrowRight size={18}/></a>
        <a href="#/director"><span className="path-icon"><Users size={21}/></span><div><h2>Plan a research project</h2><p>Explore the Director workflow and runtime options.</p></div><ArrowRight size={18}/></a>
      </section>
    </>}
    <div className={`workspace-columns ${roadmapOnly?'roadmap-wide':''}`}>
      <section className="workspace-section">
        <div className="workspace-section-heading"><div><p className="kicker">The delivery plan</p><h2>{roadmapOnly?'Milestones & tasks':'Build with intention.'}</h2></div>{!roadmapOnly&&<a href="#/roadmap">Full roadmap <ArrowRight size={14}/></a>}</div>
        <div className="milestone-chart" aria-label="Milestone completion">
          {WORKSPACE.milestones.map(m=>{const group=tasks.filter(t=>t.milestone===m.id);const done=group.filter(t=>(t.status as string)==='done').length;return <button className={`milestone-row ${filter===m.id?'selected':''}`} key={m.id} onClick={()=>setFilter(filter===m.id?'all':m.id)} aria-pressed={filter===m.id}><span>{m.title}</span><progress max={Math.max(group.length,1)} value={done} aria-label={`${m.title}: ${done} of ${group.length} tasks complete`} /><span className="mono">{done}/{group.length}</span></button>})}
        </div>
        <label className="workspace-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a task or owner…" aria-label="Search roadmap tasks" />{filter!=='all'&&<button onClick={()=>setFilter('all')}>Clear filter</button>}</label>
        <div className="workspace-task-list">
          {visibleTasks.slice(0,roadmapOnly?100:6).map(t=><div className="workspace-task" key={t.id}><span className={`task-symbol ${t.status}`} aria-label={statusLabel[t.status]}>{(t.status as string)==='done'?<Check size={15}/>:<Circle size={13}/>}</span><div><strong>{t.title}</strong><span>{WORKSPACE.employees.find(e=>e.id===t.ownerId)?.name??t.ownerId} <span aria-hidden="true">·</span> {statusLabel[t.status]}</span>{roadmapOnly&&t.evidence&&<small className="task-evidence">{t.evidence}</small>}</div><span className="priority-label">{t.priority}</span></div>)}
          {!visibleTasks.length&&<p className="workspace-empty">No tasks match your search. Try a different owner or clear the milestone filter.</p>}
        </div>
        <p className="workspace-footnote">This public view shows the committed roadmap. Desktop task changes are stored on your device.</p>
      </section>
      <aside className="workspace-section workspace-team">
        <div className="workspace-section-heading"><div><p className="kicker">People & capabilities</p><h2>Your specialist team.</h2></div><span className="subtle-badge">{WORKSPACE.employees.length} roles</span></div>
        {WORKSPACE.employees.map((e,i)=><a className="employee-row" href={`${REPO}/blob/main/${e.skillPath}`} target="_blank" rel="noreferrer" key={e.id}><span className="employee-avatar">{String(i+1).padStart(2,'0')}</span><div><strong>{e.name}</strong><span>{e.role}</span></div><ChevronRight size={15}/></a>)}
        <div className="workspace-evidence-note"><ShieldCheck size={19}/><div><strong>Evidence belongs with the work.</strong><p>Roles define responsibilities. A completed task needs an evidence note. Usage comes from recorded runs.</p></div></div>
        <a className="workspace-doc-link" href={`${REPO}/blob/main/ROADMAP.md`} target="_blank" rel="noreferrer">Read the delivery roadmap <ExternalLink size={14}/></a>
      </aside>
    </div>
  </div>;
}
