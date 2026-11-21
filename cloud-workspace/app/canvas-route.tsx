'use client';
import { createContext, useContext, useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { officeApi } from './office-api';
import { canvasSurface, embeddedLink, embeddedPresentation, ownerCanvasTarget, type CanvasSurface } from './canvas-route-model';
import './canvas-route.css';

const CanvasContext = createContext({ embedded: false });
export const useCanvasSurface = () => useContext(CanvasContext);

/** Owner entry routes lead to the shared canvas; existing forms remain intact inside it. */
export default function CanvasRoute({ surface, ownerEntry = false, children }: {
  surface: CanvasSurface; ownerEntry?: boolean; children: ReactNode;
}) {
  const [mode, setMode] = useState<'checking' | 'standalone' | 'embedded'>(ownerEntry ? 'checking' : 'standalone');
  const info = canvasSurface(surface);
  useEffect(() => {
    // A frame always remains a panel, even when an existing form changes its
    // query string. Query presentation is not an access grant.
    let framed = true;
    try { framed = window.self !== window.top; } catch { /* Cross-origin parent: never attempt to redirect it. */ }
    if (embeddedPresentation(window.location.search, framed)) { setMode('embedded'); return; }
    if (!ownerEntry) { setMode('standalone'); return; }
    let live = true, redirected = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    void officeApi('/api/session', { signal: controller.signal }).then(session => {
      if (!live) return;
      const target = ownerCanvasTarget({ pathname: window.location.pathname, search: window.location.search,
        hash: window.location.hash, framed, owner: session.signedIn === true && session.capabilities?.pairDevices === true });
      if (target) { window.location.replace(target); redirected = true; }
    }).catch(() => {
      // Signed-out, non-owner, unavailable API: keep the existing entry and
      // sign-in controls usable instead of creating a login/redirect loop.
    }).finally(() => { clearTimeout(timeout); if (live && !redirected) setMode('standalone'); });
    return () => { live = false; clearTimeout(timeout); controller.abort(); };
  }, [ownerEntry, surface]);

  function navigate(event: MouseEvent<HTMLDivElement>) {
    if (mode !== 'embedded' || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!anchor || anchor.hasAttribute('download') || anchor.target === '_blank') return;
    const link = embeddedLink(anchor.getAttribute('href') ?? '', window.location.href);
    if (!link) return;
    // Let the browser perform this user-activated navigation. Auth and full
    // canvas links escape the iframe; no postMessage or parent DOM access.
    anchor.href = link.href; anchor.target = link.target;
  }

  if (mode === 'checking') return <main className="canvas-entry"><p role="status">Opening your canvas…</p><a href={`${info.path}?canvas=1`}>Open {info.title.toLowerCase()} directly</a></main>;
  return <CanvasContext.Provider value={{ embedded: mode === 'embedded' }}>
    <div className={mode === 'embedded' ? 'canvas-surface' : 'canvas-standalone'} data-canvas-surface={surface} onClickCapture={navigate}>
      <header className="canvas-surface-heading" hidden={mode !== 'embedded'}><h1>{info.title}</h1><p>{info.description}</p></header>
      <div className="canvas-surface-content">{children}</div>
    </div>
  </CanvasContext.Provider>;
}
