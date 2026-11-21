import { ArrowDownToLine, ArrowLeft, ArrowRight, GitBranch, Layers3, ShieldCheck, Workflow } from 'lucide-react';

const repo='https://github.com/occult-kranti/engineering-intelligence-atlas';
export default function StaticDirector() {
  return <main className="workspace-page director-entry">
    <a className="workspace-back" href="#/workspace"><ArrowLeft size={16}/> Back to workspace</a>
    <header className="workspace-heading"><p className="kicker">Research Director</p><h1>A team for your next idea.</h1><p>Plan specialist work, keep it within budget, and review the evidence in one place. Choose the desktop app for local projects or configure the server for a shared runtime.</p></header>
    <div className="director-entry-grid"><section className="workspace-section"><span className="path-icon"><Layers3 size={24}/></span><h2>Work on your desktop</h2><p>Register a GitHub repository as a company, organize its team and roadmap, and run text-based projects using your configured provider or local Ollama.</p><a className="workspace-primary" href={`${repo}/releases/latest`} target="_blank" rel="noreferrer"><ArrowDownToLine size={16}/> Desktop releases</a><a className="workspace-doc-link" href={`${repo}/blob/main/desktop-shell/README.md`} target="_blank" rel="noreferrer">Build from source <ArrowRight size={15}/></a></section>
    <section className="workspace-section"><span className="path-icon"><Workflow size={24}/></span><h2>Run the full Director</h2><p>The authenticated graph editor, approvals, and shared artifacts require the application server, database, and object storage. This published atlas provides the research library.</p><a className="workspace-secondary" href={`${repo}/blob/main/site-source/README.md`} target="_blank" rel="noreferrer"><GitBranch size={16}/> Runtime setup</a><a className="workspace-doc-link" href="#/roadmap">See what’s next <ArrowRight size={15}/></a></section></div>
    <div className="workspace-evidence-note"><ShieldCheck size={21}/><div><strong>Clear usage. Explicit control.</strong><p>Provider calls use your credentials and may incur charges. Local project controls set token, time, and cost budgets. The public atlas requires no account.</p></div></div>
  </main>
}
