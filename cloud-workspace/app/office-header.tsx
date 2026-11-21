'use client';
import { useEffect, useState } from 'react';
import { useCanvasSurface } from './canvas-route';

export default function OfficeHeader({signedIn, current = 'office'}: {signedIn: boolean; current?: 'office' | 'directory' | 'access' | 'visit'}) {
  const { embedded } = useCanvasSurface();
  const [theme, setTheme] = useState<'blueprint' | 'drafting'>('blueprint');
  function applyTheme(value: 'blueprint' | 'drafting', persist = true) {
    setTheme(value);
    document.documentElement.dataset.theme = value;
    if (persist) { try { localStorage.setItem('daftar-studio-theme', value); } catch { /* This tab still keeps the chosen appearance. */ } }
  }
  useEffect(() => {
    try { applyTheme(localStorage.getItem('daftar-studio-theme') === 'drafting' ? 'drafting' : 'blueprint', false); } catch { applyTheme('blueprint', false); }
    const changed = (event: StorageEvent) => { if (event.key === 'daftar-studio-theme') applyTheme(event.newValue === 'drafting' ? 'drafting' : 'blueprint', false); };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  return <header className={embedded ? 'canvas-session-bar' : 'home-header'}>
    {embedded ? <span>{signedIn ? 'Private workspace · signed in' : 'Sign in to open your workspace'}</span> : <a className="brand" href="/" aria-label="Daftar home"><span className="brand-mark" aria-hidden="true">D</span><span>daftar<span className="brand-dot">.</span><small>COMMAND STUDIO</small></span></a>}
    {!embedded && <nav aria-label="Daftar workspace">
      <a href="/" aria-current={current === 'office' ? 'page' : undefined}>One Office</a>
      <a href="/applications" aria-current={current === 'directory' ? 'page' : undefined}>Directory</a>
      <a href="/access" aria-current={current === 'access' ? 'page' : undefined}>People & access</a>
      <a href="/visit" aria-current={current === 'visit' ? 'page' : undefined}>Visiting office</a>
      <a href="/workspace/chrome.html?workspace=blueprint#office">Blueprint</a>
      <a href="/workspace/chrome.html?workspace=softboard#office">Ownership</a>
      <a href="/workspace/chrome.html?workspace=timeline#office">Roadmap</a>
      <a href="/workspace/chrome.html?workspace=whiteboard#office">Whiteboard</a>
    </nav>}
    <div className="header-tools"><label className="theme-choice" htmlFor="cloud-studio-theme"><span>Canvas</span><select id="cloud-studio-theme" value={theme} onChange={event => applyTheme(event.target.value === 'drafting' ? 'drafting' : 'blueprint')}><option value="blueprint">Night office</option><option value="drafting">Drafting paper</option></select></label>{signedIn ? <a className="session-link" href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a> : <a className="session-link" href={'/signin-with-chatgpt?return_to=' + encodeURIComponent(current === 'directory' ? '/applications' : current === 'access' ? '/access' : current === 'visit' ? '/visit' : '/')} target="_top">Sign in</a>}</div>
  </header>;
}
