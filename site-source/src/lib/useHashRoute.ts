import { useCallback, useEffect, useState } from 'react';

export const ROUTES = [
  { id: 'workspace', label: 'Company workspace', hash: '#/workspace' },
  { id: 'roadmap', label: 'Delivery roadmap', hash: '#/roadmap' },
  { id: 'overview', label: 'Overview', hash: '#/overview' },
  { id: 'roles', label: 'Role Directory', hash: '#/roles' },
  { id: 'library', label: 'Resource & Agent Library', hash: '#/library' },
  { id: 'jobs', label: 'Jobs Evidence', hash: '#/jobs' },
  { id: 'reverse', label: 'Reverse Engineering', hash: '#/reverse' },
  { id: 'research', label: 'Research & Governance', hash: '#/research' },
  { id: 'science', label: 'Science & Models', hash: '#/science' },
  { id: 'methodology', label: 'Methodology', hash: '#/methodology' },
  { id: 'director', label: 'Director', hash: '#/director' },
] as const;

export type RouteId = (typeof ROUTES)[number]['id'];

const VALID = new Set<string>(ROUTES.map((r) => r.id));

function readHash(): RouteId {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return (VALID.has(raw) ? raw : 'workspace') as RouteId;
}

export function useHashRoute(): [RouteId, (id: RouteId) => void] {
  const [route, setRoute] = useState<RouteId>(readHash);

  useEffect(() => {
    const onChange = () => {
      setRoute(readHash);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((id: RouteId) => {
    window.location.hash = `/${id}`;
  }, []);

  return [route, navigate];
}
