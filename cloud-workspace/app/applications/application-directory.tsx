'use client';
import { useEffect, useMemo, useState } from 'react';
import OfficeHeader from '../office-header';
import { officeApi, OfficeApiError, type ApiRecord } from '../office-api';
import { buildDirectory, displayDate, filterDirectory, officeLink, reviewIsDue, type DirectoryCompany, type DirectoryEntry } from './directory-model';
import FigmaConnection from './figma-connection';
import './directory.css';

const statuses = {live: 'Reachability checked', preview: 'Preview', release: 'Release available', unverified: 'Link not verified', archived: 'Archived'};
const kindLabels: Record<string, string> = {website: 'Website', dashboard: 'Dashboard', desktop: 'Desktop app', extension: 'Extension', mobile: 'Mobile app', repository: 'Repository', service: 'Shared service'};

function Application({entry}: {entry: DirectoryEntry}) {
  return <section className="application-record" aria-label={entry.name}>
    <div className="application-title"><div><span className="application-kind">{kindLabels[entry.kind] ?? entry.kind}</span><h3>{entry.name}</h3></div><span className={'directory-badge status-' + entry.status}>{statuses[entry.status]}</span></div>
    <p className="application-description">{entry.description || 'A description has not been recorded for this application yet.'}</p>
    <dl className="application-dates"><div><dt>Repository created</dt><dd>{displayDate(entry.repositoryCreatedAt)}</dd></div>{entry.websiteCreatedAt && <div><dt>Website record created</dt><dd>{displayDate(entry.websiteCreatedAt)}</dd></div>}<div><dt>First published</dt><dd>{displayDate(entry.firstPublishedAt)}</dd></div>{entry.updatedAt && <div><dt>Record updated</dt><dd>{displayDate(entry.updatedAt)}</dd></div>}</dl>
    {entry.dateSourceUrl && <a className="record-source" href={entry.dateSourceUrl} target="_blank" rel="noreferrer">Date source ↗</a>}
    {entry.links.length ? <ul className="application-links">{entry.links.map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer"><span>{link.label}<span aria-hidden="true"> ↗</span></span><small>{link.verification === 'verified' ? `Checked ${displayDate(link.verifiedAt)}${reviewIsDue(link.verifiedAt) ? ' · Review due' : ''}` : 'Recorded link · availability not checked'}</small></a>{link.sourceUrl && <a className="verification-source" href={link.sourceUrl} target="_blank" rel="noreferrer" aria-label={'Verification source for ' + link.label}>Source ↗</a>}</li>)}</ul> : <p className="missing-link">No application or download link has been recorded.</p>}
  </section>;
}

function CompanyCard({company, companies, onGroup}: {company: DirectoryCompany; companies: DirectoryCompany[]; onGroup: (id: string) => void}) {
  const related = [...new Set(company.applications.flatMap(entry => entry.relatedCompanyIds))].map(id => companies.find(item => item.id === id)).filter((c): c is DirectoryCompany => !!c);
  return <article className="directory-company" id={'company-' + company.id}>
    <header className="company-card-heading"><div><p className="company-kind">{company.repoUrl ? (company.visibility === 'private' ? 'PRIVATE REPOSITORY' : company.visibility === 'public' ? 'PUBLIC REPOSITORY' : 'REPOSITORY COMPANY') : 'SHARED OFFICE'}{company.status === 'paused' ? ' · PAUSED' : ''}</p><h2>{company.name}</h2></div><a className="company-open" href={officeLink(company.id)} aria-label={'Open ' + company.name + ' with Donna'}>Open office <span aria-hidden="true">↗</span></a></header>
    {!!company.groups.length && <div className="company-groups" aria-label="Company groups">{company.groups.map(group => <button key={group.id} onClick={() => onGroup(group.id)}>{group.name}</button>)}</div>}
    {company.applications.length ? <div className="company-applications">{company.applications.map(entry => <Application key={entry.id} entry={entry}/>)}</div> : <div className="uncatalogued-company"><h3>Ready to be catalogued.</h3><p>This company is saved in your office. An application link and publication date have not been recorded yet.</p><dl className="application-dates"><div><dt>Added to Daftar</dt><dd>{displayDate(company.officeCreatedAt)}</dd></div></dl></div>}
    {!!related.length && <div className="related-projects"><span>Related projects</span>{related.map(item => <a key={item.id} href={'/applications?company=' + encodeURIComponent(item.id)}>{item.name}</a>)}</div>}
    <footer className="company-card-footer"><div className="company-view-links" aria-label={'Workspace views for ' + company.name}><a href={officeLink(company.id, 'chat')}>Donna</a><a href={officeLink(company.id, 'blueprint')}>Blueprint</a><a href={officeLink(company.id, 'whiteboard')}>Roadmap & whiteboard</a><a href={officeLink(company.id, 'decisions')}>Expert panels</a></div>{company.repoUrl && <a className="repository-link" href={company.repoUrl} target="_blank" rel="noreferrer">Repository ↗</a>}</footer>
  </article>;
}

export default function ApplicationDirectory() {
  const [session, setSession] = useState<ApiRecord | null>(null), [workspace, setWorkspace] = useState<ApiRecord | null>(null), [catalog, setCatalog] = useState<ApiRecord | null>(null);
  const [ledger, setLedger] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [query, setQuery] = useState(''), [group, setGroup] = useState('all'), [status, setStatus] = useState('all'), [sort, setSort] = useState('name'), [companyFocus, setCompanyFocus] = useState('');
  async function refresh() {
    setLoading(true); setError('');
    try {
      const signedIn = await officeApi('/api/session');
      if (signedIn.signedIn !== true) throw new OfficeApiError('Sign in with ChatGPT to open your private directory.', 401);
      setSession(signedIn);
      const [savedWorkspace, savedCatalog, savedLedger] = await Promise.all([officeApi('/api/workspace'), officeApi('/api/applications'), officeApi('/api/integration-ledger')]);
      setLedger(Array.isArray(savedLedger.events) ? savedLedger.events : []);
      setWorkspace(savedWorkspace); setCatalog(savedCatalog);
    } catch (e) { if (e instanceof OfficeApiError && [401, 403].includes(e.status)) setSession(null); setWorkspace(null); setCatalog(null); setLedger([]); setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { setCompanyFocus(new URLSearchParams(window.location.search).get('company') ?? ''); void refresh(); }, []);
  const companies = useMemo(() => buildDirectory(workspace?.snapshot, catalog?.entries), [workspace, catalog]);
  const visible = useMemo(() => filterDirectory(companies, {query, group, status, company: companyFocus, sort}), [companies, query, group, status, companyFocus, sort]);
  const groups = [...new Map(companies.flatMap(company => company.groups).map(item => [item.id, item])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const applications = companies.flatMap(company => company.applications);
  const verified = new Set(applications.flatMap(entry => entry.links).filter(link => link.verification === 'verified' && ['application', 'dashboard', 'download'].includes(link.kind)).map(link => link.url)).size;
  const focused = companies.find(company => company.id === companyFocus);
  async function refreshLedger() { try { const data = await officeApi('/api/integration-ledger'); setLedger(Array.isArray(data.events) ? data.events : []); } catch { /* Next explicit directory refresh will show any request error. */ } }
  function clearFilters() { setQuery(''); setGroup('all'); setStatus('all'); setCompanyFocus(''); setSort('name'); window.history.replaceState(null, '', '/applications'); }
  function chooseGroup(id: string) { setGroup(id); setCompanyFocus(''); window.history.replaceState(null, '', '/applications'); }
  return <main className="office-home directory-home">
    <OfficeHeader signedIn={!!session} current="directory"/>
    <section className="directory-intro"><div><p className="eyebrow">YOUR PRIVATE APPLICATION DIRECTORY</p><h1>Everything you’re building.<br/><em>One place to find it.</em></h1><p>Apps, dashboards, repositories, and the people behind them. Open the work, check its history, or bring the next decision to Donna.</p></div><div className="directory-index" aria-label="Directory summary"><div><strong>{workspace ? companies.length : '—'}</strong><span>Companies</span></div><div><strong>{catalog ? applications.length : '—'}</strong><span>App records</span></div><div><strong>{catalog ? verified : '—'}</strong><span>Checked links</span></div></div></section>
    <div className={'status-banner' + (error ? ' is-error' : '')} role="status" aria-live="polite"><span>{loading ? 'Loading your saved project directory…' : error || `Directory revision ${catalog?.revision ?? 0} · ${catalog?.updatedAt ? 'Updated ' + displayDate(catalog.updatedAt) : 'No catalog update recorded'}${reviewIsDue(catalog?.updatedAt) ? ' · Review due: index is over 7 days old' : ''} · Dates shown in UTC`}</span><button type="button" onClick={() => void refresh()} disabled={loading}>Refresh directory</button></div>
    <section className="directory-toolbar" aria-label="Find an application"><label className="directory-search" htmlFor="directory-search"><span>Search your work</span><input id="directory-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, description, repository, or related project" autoComplete="off"/></label><label htmlFor="directory-group"><span>Group</span><select id="directory-group" value={group} onChange={event => chooseGroup(event.target.value)}><option value="all">All groups</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label htmlFor="directory-status"><span>Status</span><select id="directory-status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All records</option><option value="live">Reachability checked</option><option value="preview">Preview</option><option value="release">Release available</option><option value="unverified">Link not verified</option><option value="no-links">No app link yet</option><option value="archived">Archived</option></select></label><label htmlFor="directory-sort"><span>Sort by</span><select id="directory-sort" value={sort} onChange={event => setSort(event.target.value)}><option value="name">Company name</option><option value="published">Recently published</option><option value="repository-created">Newest repository</option></select></label></section>
    <div className="directory-results-heading"><p>{loading ? 'Loading companies…' : `${visible.length} of ${companies.length} companies`}{focused && <span> · {focused.name}</span>}</p>{(query || group !== 'all' || status !== 'all' || companyFocus) && <button type="button" onClick={clearFilters}>Clear filters</button>}<a href="#design-connections">Design connections ↓</a></div>
    {visible.length ? <section className="directory-grid" aria-label="Companies and applications">{visible.map(company => <CompanyCard key={company.id} company={company} companies={companies} onGroup={chooseGroup}/>)}</section> : <section className="directory-empty"><span className="directory-empty-mark" aria-hidden="true">D</span><h2>{loading ? 'Your directory is on its way.' : error ? (session ? 'The directory could not be loaded.' : 'Your directory stays private.') : companies.length ? 'No companies match these filters.' : 'Your projects belong here.'}</h2><p>{loading ? 'Reading the saved company map and sourced application records.' : error ? (session ? 'Your saved project records are unchanged. Refresh the directory to try again.' : 'Sign in with your owner account, then refresh to load saved project links.') : companies.length ? 'Try a broader search or show every group.' : 'Import repositories into the office and sync your workspace. Their companies will appear here, with missing application links clearly marked.'}</p>{error ? (session ? <button type="button" onClick={() => void refresh()}>Try again</button> : <a className="primary-link" href="/signin-with-chatgpt?return_to=%2Fapplications" target="_top">Sign in with ChatGPT</a>) : companies.length ? <button type="button" onClick={clearFilters}>Show all companies</button> : !loading && <a className="primary-link" href="/workspace/chrome.html#office">Open Daftar office</a>}</section>}
    <aside className="directory-provenance"><strong>Dates and links keep their meaning.</strong><p>Repository creation and website record creation describe their source records; first publication is a separately recorded deployment or release. “Checked” records link reachability at that time; it does not certify that an application works. Checks over seven days old are marked for review. Missing dates and links remain unknown until there is evidence.</p></aside>
    <FigmaConnection companies={companies} signedIn={!!session} activeCompanyId={workspace?.snapshot?.activeCompanyId} onSaved={() => void refreshLedger()}/>
    {session && <details className="directory-ledger"><summary>Directory & design history <span>{ledger.length} saved events</span></summary>{ledger.length ? <ol>{ledger.slice(0,20).map(event => <li key={event.id}><div><strong>{String(event.action ?? 'Saved update').replaceAll('_', ' ')}</strong><span>{companies.find(company => company.id === event.scopeId)?.name ?? 'Whole directory'} · {displayDate(event.createdAt)}</span></div><p>{event.summary}</p></li>)}</ol> : <p>No directory or design connection events have been recorded yet.</p>}</details>}
    <footer className="home-footer"><span>Daftar / Application directory</span><span>Private company records · Shared ownership · One Office</span><a href="/">Back to One Office</a></footer>
  </main>;
}
