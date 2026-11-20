import { Menu, X } from 'lucide-react';
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
      <rect width="28" height="28" fill="hsl(40 14% 9%)" />
      <circle cx="8" cy="8" r="3" fill="hsl(42 78% 45%)" />
      <circle cx="20" cy="9" r="2.2" fill="hsl(82 22% 50%)" />
      <circle cx="14" cy="20" r="2.6" fill="hsl(219 46% 52%)" />
      <path d="M8 8 L20 9 M8 8 L14 20 M20 9 L14 20" stroke="hsl(48 14% 80%)" strokeWidth="1" />
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
      {ROUTES.map((r, i) => {
        const active = route === r.id;
        return (
          <li key={r.id}>
            <a
              href={r.hash}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
              className={`flex min-h-[44px] items-baseline gap-3 border-l-2 px-4 py-2 text-sm transition-colors ${
                active
                  ? 'border-[hsl(var(--ink))] font-bold text-[hsl(var(--ink))]'
                  : 'border-transparent font-medium text-[hsl(var(--ink-soft))] hover:text-[hsl(var(--ink))]'
              }`}
            >
              <span className="mono text-xs text-[hsl(var(--ink-soft))]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{r.label}</span>
            </a>
          </li>
        );
      })}
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
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col overflow-y-auto border-r border-[hsl(var(--line))] bg-[hsl(var(--paper))] lg:flex">
      <a href="#/overview" className="flex items-center gap-3 px-4 py-5" aria-label="Engineering Intelligence Atlas — overview">
        <BrandMark />
        <span className="leading-tight">
          <span className="block text-sm font-extrabold tracking-tight">Engineering</span>
          <span className="block text-sm font-extrabold tracking-tight">Intelligence Atlas</span>
        </span>
      </a>
      <p className="px-4 pb-4 text-xs text-[hsl(var(--ink-soft))]">
        Verified evidence on roles, resources, agents, and hiring.
      </p>
      <nav aria-label="Chapters" className="rule pt-2">
        <ChapterList route={route} />
      </nav>
      <div className="mt-auto pb-6">
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
        <a href="#/overview" className="flex min-h-[44px] items-center gap-2" aria-label="Engineering Intelligence Atlas — overview">
          <BrandMark size={24} />
          <span className="text-sm font-extrabold tracking-tight">Intelligence Atlas</span>
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
