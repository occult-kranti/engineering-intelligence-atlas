import { lazy, Suspense } from 'react';
import { MobileTopbar, SideRail } from '@/components/Chrome';
import { useHashRoute } from '@/lib/useHashRoute';
import { useHashPath } from '@/lib/useHashPath';
import Workspace from '@/views/Workspace';
const Jobs = lazy(() => import('@/views/Jobs'));
const Library = lazy(() => import('@/views/Library'));
const Methodology = lazy(() => import('@/views/Methodology'));
const Overview = lazy(() => import('@/views/Overview'));
const Research = lazy(() => import('@/views/Research'));
const Reverse = lazy(() => import('@/views/Reverse'));
const Roles = lazy(() => import('@/views/Roles'));
const Science = lazy(() => import('@/views/Science'));
const StaticDirector = lazy(() => import('@/views/director/StaticDirector'));

// Director runtime is lazy-loaded: the public atlas renders even when the
// API or this chunk is unavailable.
const Director = lazy(() => import('@/views/director/DirectorShell'));

export default function App() {
  const [route] = useHashRoute();
  const path = useHashPath();

  if (path === 'login' || path.startsWith('director')) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm text-[hsl(var(--ink-soft))]">
            Loading Director runtime…
          </div>
        }
      >
        {import.meta.env.MODE === 'static' ? <StaticDirector /> : <Director path={path} />}
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-[hsl(var(--ink))] focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-[hsl(var(--paper))]"
      >
        Skip to main content
      </a>
      <SideRail route={route} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopbar route={route} />
        <main id="main" className="flex-1">
          <Suspense fallback={<div className="workspace-page" role="status">Opening the research chapter…</div>}>
          {route === 'workspace' && <Workspace />}
          {route === 'roadmap' && <Workspace roadmapOnly />}
          {route === 'overview' && <Overview />}
          {route === 'roles' && <Roles />}
          {route === 'library' && <Library />}
          {route === 'jobs' && <Jobs />}
          {route === 'reverse' && <Reverse />}
          {route === 'research' && <Research />}
          {route === 'science' && <Science />}
          {route === 'methodology' && <Methodology />}
          </Suspense>
        </main>
        <footer className="rule mt-12">
          <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
            <p className="text-sm font-bold">Engineering Intelligence Atlas</p>
            <p className="prose-evidence mt-2 max-w-3xl text-xs text-[hsl(var(--ink-soft))]">
              A static, content-first research atlas. All metrics are computed
              at build time from dated, verified source records; external links
              open the original sources. Snapshots describe what sources
              returned on their retrieval dates — not a census, and not live
              availability.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
