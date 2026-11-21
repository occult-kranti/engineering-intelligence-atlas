'use client';
import { useEffect, useState } from 'react';

export default function OfficeHeader({signedIn, current = 'office'}: {signedIn: boolean; current?: 'office' | 'directory'}) {
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
  return <header className="home-header">
    <a className="brand" href="/" aria-label="Daftar home"><span className="brand-mark" aria-hidden="true">D</span><span>daftar<span className="brand-dot">.</span><small>COMMAND STUDIO</small></span></a>
    <nav aria-label="Daftar workspace">
      <a href="/" aria-current={current === 'office' ? 'page' : undefined}>One Office</a>
      <a href="/applications" aria-current={current === 'directory' ? 'page' : undefined}>Directory</a>
      <a href="/workspace/chrome.html?workspace=blueprint#office">Blueprint</a>
      <a href="/workspace/chrome.html?workspace=softboard#office">Ownership</a>
      <a href="/workspace/chrome.html?workspace=timeline#office">Roadmap</a>
      <a href="/workspace/chrome.html?workspace=whiteboard#office">Whiteboard</a>
    </nav>
    <div className="header-tools"><label className="theme-choice" htmlFor="cloud-studio-theme"><span>Canvas</span><select id="cloud-studio-theme" value={theme} onChange={event => applyTheme(event.target.value === 'drafting' ? 'drafting' : 'blueprint')}><option value="blueprint">Violet studio</option><option value="drafting">Golden drafting</option></select></label>{signedIn ? <a className="session-link" href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a> : <a className="session-link" href={'/signin-with-chatgpt?return_to=' + encodeURIComponent(current === 'directory' ? '/applications' : '/')} target="_top">Sign in</a>}</div>
  </header>;
}
