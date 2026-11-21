/** Presentation routing only. Every embedded surface keeps its existing API authorization. */
export type CanvasSurface = 'connections' | 'access' | 'applications' | 'visit' | 'join';
const SURFACES: Record<CanvasSurface, { path: string; title: string; description: string }> = {
  connections: { path: '/', title: 'Connections', description: 'Your devices, saved workspace, and queued changes.' },
  access: { path: '/access', title: 'People & access', description: 'Company memberships, invitations, and access history.' },
  applications: { path: '/applications', title: 'Applications & integrations', description: 'Find your projects and their connected tools.' },
  visit: { path: '/visit', title: 'Visiting office', description: 'The companies and work shared with your account.' },
  join: { path: '/join', title: 'Review invitation', description: 'Check the company, role, and expiry before joining.' },
};
export const canvasSurface = (surface: CanvasSurface) => SURFACES[surface];

export function embeddedPresentation(search: string, framed: boolean): boolean {
  return framed || new URLSearchParams(search).get('canvas') === '1';
}

/** The only automatic redirect is an owner entering an existing owner route. */
export function ownerCanvasTarget(input: {
  pathname: string; search: string; hash: string; framed: boolean; owner: boolean;
}): string | null {
  if (!input.owner || embeddedPresentation(input.search, input.framed)) return null;
  const surface = input.pathname === '/access' ? 'access' : input.pathname === '/applications' ? 'applications'
    : input.pathname === '/' && input.hash === '#devices' ? 'connections' : null;
  if (!['/', '/access', '/applications'].includes(input.pathname)) return null;
  const original = new URLSearchParams(input.search), query = new URLSearchParams();
  // Copy supported navigation only. Invitation/auth tokens and arbitrary URLs
  // never move to the canvas URL or into another document's request.
  const company = original.get('company') ?? original.get('companyId');
  if (company && company.length <= 100) query.set('company', company);
  const workspace = original.get('workspace');
  if (workspace && ['chat', 'blueprint', 'softboard', 'timeline', 'whiteboard', 'decisions'].includes(workspace)) query.set('workspace', workspace);
  if (original.get('ceo') === 'true') query.set('ceo', 'true');
  if (surface) query.set('surface', surface);
  if (surface === 'connections' && input.hash === '#devices') query.set('surfaceAnchor', 'devices');
  if (surface === 'applications' && input.hash === '#design-connections') query.set('surfaceAnchor', 'design-connections');
  return `/workspace/chrome.html${query.size ? `?${query}` : ''}#office`;
}

export type EmbeddedLink = { href: string; target: '_top' | '_self' };
/** Preserve forms in the current panel, and keep a full canvas out of its iframe. */
export function embeddedLink(href: string, currentUrl: string): EmbeddedLink | null {
  if (!href || href.startsWith('#')) return null;
  let target: URL, current: URL;
  try { current = new URL(currentUrl); target = new URL(href, current); } catch { return null; }
  if (target.origin !== current.origin || !['http:', 'https:'].includes(target.protocol)) return null;
  if (['/workspace/chrome', '/workspace/chrome.html', '/signin-with-chatgpt', '/signout-with-chatgpt'].includes(target.pathname)) {
    return { href: target.pathname + target.search + target.hash, target: '_top' };
  }
  if (!Object.values(SURFACES).some(surface => surface.path === target.pathname)) return null;
  target.searchParams.set('canvas', '1');
  return { href: target.pathname + target.search + target.hash, target: '_self' };
}
