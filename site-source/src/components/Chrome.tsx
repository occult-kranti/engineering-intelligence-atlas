import { Menu, X, ArrowUpRight, Building2, Map, BookOpen, Users, LibraryBig, BriefcaseBusiness, Code2, FlaskConical, ShieldCheck, Workflow } from 'lucide-react';
import { useEffect, useState } from 'react';
import { JOBS } from '@/data/jobs';
import { ROLES } from '@/data/roles';
import { RESOURCES } from '@/data/resources';
import { SKILL_PACKAGES } from '@/data/skills';
import { fmt } from '@/lib/format';
import { ROUTES, type RouteId } from '@/lib/useHashRoute';

function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
      <rect width="28" height="28" rx="7" fill="#22674b" />
      <path d="M7 21 L14 7 L21 21 M10 16 H18" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function ChapterList({
  route,
  onNavigate,
}: {
  route: RouteId;
  onNavigate?: () => void;
}) {
  return (
    <ul>
      {ROUTES.map((r) => {
        const active = route === r.id;
        const icons = { workspace: Building2, roadmap: Map, overview: BookOpen, roles: Users, library: LibraryBig, jobs: BriefcaseBusiness, reverse: Code2, research: ShieldCheck, science: FlaskConical, methodology: BookOpen, director: Workflow };
        const Icon = icons[r.id];
        return (
          <li key={r.id}>
            <a
              href={r.hash}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
              className={`atlas-nav-link flex min-h-[44px] items-center gap-3 border-l-2 px-4 py-2 text-sm transition-colors ${
                active
                  ? 'border-[hsl(var(--ink))] font-bold text-[hsl(var(--ink))]'
                  : 'border-transparent font-medium text-[hsl(var(--ink-soft))] hover:text-[hsl(var(--ink))]'
              }`}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{r.label}</span>
            </a>
          </li>
        );
      })}
      <li>
        <a href="./architecture-library/index.html" onClick={onNavigate}
          className="atlas-nav-link flex min-h-[44px] items-center gap-3 border-l-2 border-transparent px-4 py-2 text-sm font-medium text-[hsl(var(--ink-soft))] hover:text-[hsl(var(--ink))]">
          <Building2 size={17} aria-hidden="true" /><span>Architecture library</span>
        </a>
      </li>
    </ul>
  );
}

function CorpusNote() {
  return (
    <div className="rule mt-6 px-4 pt-4">
      <p className="kicker mb-2">Corpus</p>
      <dl className="mono space-y-1 text-xs text-[hsl(var(--ink-soft))]">
        <div className="flex justify-between gap-2">
          <dt>roles</dt>
          <dd>{fmt(ROLES.length)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>resources</dt>
          <dd>{fmt(RESOURCES.length)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>skill packages</dt>
          <dd>{fmt(SKILL_PACKAGES.length)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>job records</dt>
          <dd>{fmt(JOBS.recordCount)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Strict left chapter rail — desktop. */
export function SideRail({ route }: { route: RouteId }) {
  return (
    <aside className="atlas-sidebar sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col overflow-y-auto border-r border-[hsl(var(--line))] bg-[hsl(var(--paper))] lg:flex">
      <a href="#/workspace" className="flex items-center gap-3 px-5 py-6" aria-label="Daftar — company workspace">
        <BrandMark />
        <span className="leading-tight">
          <span className="block text-xl font-extrabold tracking-tight">Daftar<span className="atlas-brand-dot">.</span></span>
          <span className="block text-[10px] font-medium uppercase tracking-[.14em] text-[hsl(var(--ink-soft))]">Personal agent office</span>
        </span>
      </a>
      <div className="atlas-company-chip"><span className="employee-avatar">EI</span><div><strong>Engineering Intelligence</strong><span>Company workspace</span></div></div>
      <p className="px-5 pt-6 pb-2 text-[10px] uppercase tracking-[.15em] text-[hsl(var(--ink-soft))]">Workspace & research</p>
      <nav aria-label="Chapters" className="px-2 pt-1">
        <ChapterList route={route} />
      </nav>
      <div className="mt-auto pb-6">
        <a className="atlas-release-link" href="https://atlas-command-office.whatswrong-inc.chatgpt.site" target="_blank" rel="noreferrer">Sign in to office</a>
        <a className="atlas-release-link" href="https://github.com/occult-kranti/engineering-intelligence-atlas/releases/latest" target="_blank" rel="noreferrer">Desktop releases <ArrowUpRight size={15}/></a>
        <CorpusNote />
      </div>
    </aside>
  );
}

/** Top bar with expandable chapter index — mobile & tablet. */
export function MobileTopbar({ route }: { route: RouteId }) {
  const [open, setOpen] = useState(false);

  // Menu closes via navigation click (ChapterList onNavigate) or Escape;
  // no state sync on route change.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const active = ROUTES.find((r) => r.id === route);

  return (
    <div className="sticky top-0 z-40 border-b border-[hsl(var(--line))] bg-[hsl(var(--paper))] lg:hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <a href="#/workspace" className="flex min-h-[44px] items-center gap-2" aria-label="Daftar — company workspace">
          <BrandMark size={24} />
          <span className="text-sm font-extrabold tracking-tight">Daftar · Agent office</span>
        </a>
        <button
          type="button"
          className="btn"
          aria-expanded={open}
          aria-controls="mobile-chapters"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
          <span className="mono text-xs">{active ? active.label : 'Index'}</span>
        </button>
      </div>
      <div className="expand-region border-t border-[hsl(var(--line))]" data-open={open} id="mobile-chapters-region">
        <div>
          <nav id="mobile-chapters" aria-label="Chapters" className="px-0 py-1">
            <ChapterList route={route} onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      </div>
    </div>
  );
}
