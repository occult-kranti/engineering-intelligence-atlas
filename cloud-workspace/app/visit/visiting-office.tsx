'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import OfficeHeader from '../office-header';
import { CollaborationError, collaborationRequest, companyEndpoint, errorMessage, formatTime, roleLabel, signInPath } from '../collaboration/client';
import type { CompanyMessage, Human, MemberView, Proposal, Session } from '../collaboration/types';
import '../access/access.css';

type MemberStudio = { update(value: unknown): void; destroy(): void };
function CompanyCanvas({ view }: { view: MemberView }) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<MemberStudio | null>(null);
  const latest = useRef(view); latest.current = view;
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const style = document.createElement('link');
    style.rel = 'stylesheet'; style.href = '/workspace/member-studio.css';
    document.head.appendChild(style);
    const asset = '/workspace/member-studio.js';
    void import(/* @vite-ignore */ asset).then(module => {
      if (!active || !host.current) return;
      if (typeof module.mountMemberStudio !== 'function') throw new Error('The office canvas is unavailable in this build.');
      instance.current = module.mountMemberStudio(host.current, latest.current) as MemberStudio;
    }).catch(() => { if (active) setError('The office canvas could not be loaded. Your authorized team and work records remain available below.'); });
    return () => { active = false; instance.current?.destroy(); instance.current = null; style.remove(); };
  }, []);
  useEffect(() => {
    if (!instance.current) return;
    try { instance.current.update(view); } catch { instance.current?.destroy(); instance.current = null; setError('The company view changed. Refresh to load your current access.'); }
  }, [view]);
  return <section className="collab-canvas-panel" aria-label="Authorized company office"><div className="collab-panel-heading"><div><p className="collab-kicker">COMPANY CANVAS</p><h2>Explore your shared office</h2></div><span className="collab-badge">View only</span></div>{error && <p className="collab-alert" role="status">{error}</p>}<div className="collab-member-canvas" ref={host} /></section>;
}

export default function VisitingOffice() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [view, setView] = useState<MemberView | null>(null);
  const [humans, setHumans] = useState<Human[]>([]);
  const [messages, setMessages] = useState<CompanyMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [brief, setBrief] = useState('');
  const [evidence, setEvidence] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [proposalKey, setProposalKey] = useState('');
  const selected = useRef(companyId); selected.current = companyId;
  const loadSequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    collaborationRequest<Session>('/api/collaboration/session', 'GET', undefined, controller.signal).then(result => {
      setSession(result); setDisplayName(result.user.displayName ?? '');
      const requested = new URLSearchParams(window.location.search).get('company');
      if (requested && !result.companies.some(c => c.id === requested)) setError('That company is unavailable or your access has expired. Choose one of your current companies.');
      else setCompanyId(requested ?? result.companies[0]?.id ?? '');
    }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setInitializing(false); });
    return () => controller.abort();
  }, []);

  const refresh = useCallback(async (id: string, signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const [company, people, notes, work] = await Promise.all([
        collaborationRequest<MemberView>(companyEndpoint(id), 'GET', undefined, signal),
        collaborationRequest<{ humans: Human[] }>(companyEndpoint(id, '/members'), 'GET', undefined, signal),
        collaborationRequest<{ messages: CompanyMessage[]; nextCursor: string | null }>(companyEndpoint(id, '/messages?latest=1'), 'GET', undefined, signal),
        collaborationRequest<{ proposals: Proposal[] }>(companyEndpoint(id, '/proposals'), 'GET', undefined, signal),
      ]);
      if (selected.current !== id || sequence !== loadSequence.current || signal?.aborted) return;
      if (company.company.id !== id || company.access?.mode !== 'member') throw new Error('The authorized company view could not be confirmed.');
      setView(company); setHumans(people.humans); setMessages(notes.messages); setNextCursor(notes.nextCursor); setProposals(work.proposals); setRefreshedAt(new Date().toISOString());
    } catch (e) {
      if (selected.current !== id || sequence !== loadSequence.current || signal?.aborted) return;
      setView(null); setHumans([]); setMessages([]); setProposals([]); setNextCursor(null); setError(errorMessage(e));
    } finally { if (selected.current === id && sequence === loadSequence.current && !signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    setView(null); setHumans([]); setMessages([]); setProposals([]); setNextCursor(null); setNotice(''); setNote(''); setBrief(''); setEvidence(''); setProposalKey('');
    if (!companyId) return;
    setError('');
    const controller = new AbortController();
    void refresh(companyId, controller.signal);
    const check = () => { if (document.visibilityState === 'visible') void refresh(companyId, controller.signal); };
    const timer = window.setInterval(check, 60000);
    window.addEventListener('focus', check);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', check); };
  }, [companyId, refresh]);

  useEffect(() => {
    if (!view?.membership.expiresAt) return;
    const expires = Date.parse(view.membership.expiresAt);
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = expires - Date.now();
      if (remaining <= 0) { loadSequence.current++; setView(null); setHumans([]); setMessages([]); setProposals([]); setNextCursor(null); setError('Your company access has expired. Ask the owner to renew it.'); }
      else timer = setTimeout(check, Math.min(remaining, 86400000));
    };
    check();
    return () => clearTimeout(timer);
  }, [view?.membership.expiresAt]);

  async function perform(label: string, task: () => Promise<string>) {
    const id = companyId; setBusy(label); setError(''); setNotice('');
    try { const result = await task(); setNotice(result); await refresh(id); }
    catch (e) { setError(errorMessage(e)); if (e instanceof CollaborationError && [401, 403, 404, 409].includes(e.status)) await refresh(id); }
    finally { setBusy(''); }
  }
  const writable = view?.membership.role === 'contributor' || view?.membership.role === 'owner';
  const owner = view?.membership.role === 'owner';
  const personName = (id: string | null) => id === session?.user.id ? 'You' : humans.find(h => h.userId === id)?.displayName ?? (id ? 'Company member' : 'Unassigned');

  return <main className="office-home collaboration-page">
    <OfficeHeader signedIn={!!session} current="visit" />
    <header className="collab-heading"><div><p className="eyebrow">YOUR AUTHORIZED WORKSPACE</p><h1>Visiting office</h1><p>Work alongside people and shared specialists in the companies you can access.</p></div>{session?.user.isOwner && <a className="collab-secondary-link" href="/access">Manage people & access <span aria-hidden="true">↗</span></a>}</header>
    {initializing && <p className="collab-empty" role="status">Checking your company memberships…</p>}
    {!initializing && !session && <section className="collab-panel collab-entry"><h2>Sign in to your visiting office</h2><p>{error || 'Use the ChatGPT account that accepted your company invitation.'}</p><a className="primary-link" href={signInPath('/visit')} target="_top">Sign in with ChatGPT</a><p className="collab-muted">This workspace remains a private Site. A company invitation does not bypass Site access.</p></section>}
    {session && <>
      <section className="collab-visit-toolbar"><label htmlFor="visit-company">Company<select id="visit-company" value={companyId} disabled={!!busy} onChange={e => setCompanyId(e.target.value)}><option value="">Choose an authorized company</option>{session.companies.map(c => <option key={c.id} value={c.id}>{c.name} · {roleLabel(c.role)}</option>)}</select></label><button type="button" disabled={!companyId || loading || !!busy} onClick={() => { setError(''); void refresh(companyId); }}>{loading ? 'Refreshing…' : 'Refresh company'}</button><span className="collab-account-name">{session.user.displayName || 'Your account'}</span></section>
      {error && <div className="collab-alert is-error" role="alert">{error}</div>}{notice && <div className="collab-alert" role="status">{notice}</div>}
      {session.companies.length === 0 && <section className="collab-panel collab-entry"><h2>No current company memberships</h2><p>Open an invitation from the workspace owner to review its company, role, and expiry.</p><a href="/join" className="collab-secondary-link">Review an invitation</a></section>}
      {loading && !view && <p className="collab-empty" role="status">Loading your company’s permitted records…</p>}
      {view && <>
        <section className="collab-visit-scope"><div><p className="collab-kicker">{roleLabel(view.membership.role).toUpperCase()} ACCESS</p><h2>{view.company.name}</h2><p>{view.membership.expiresAt ? <>Access expires <time dateTime={view.membership.expiresAt}>{formatTime(view.membership.expiresAt)}</time>.</> : 'Access remains until the owner revokes it.'}</p></div><span className="collab-badge">{writable ? 'Read · post · propose · claim' : 'Read company records'}</span></section>
        <CompanyCanvas view={view} />
        <section className="collab-restricted" aria-label="Private workspace boundary"><span aria-hidden="true">◈</span><div><strong>Private workspace</strong><p>A separate company membership is required for other areas. Your view contains only this company’s permitted records.</p></div></section>
        <div className="collab-two-columns">
          <section className="collab-panel"><p className="collab-kicker">PEOPLE</p><h2>Human teammates</h2><ul className="collab-record-list">{humans.map(h => <li key={h.membershipId}><div className="collab-record-main"><strong>{h.userId === session.user.id ? `${h.displayName} (you)` : h.displayName}</strong><small>{roleLabel(h.role)}{h.expiresAt ? ` · until ${formatTime(h.expiresAt)}` : ''}</small></div><span className="collab-badge">Person</span></li>)}</ul></section>
          <section className="collab-panel"><p className="collab-kicker">AI TEAM</p><h2>Employees & shared specialists</h2><p className="collab-muted">Saved roles show ownership and availability. A role card does not start a model or grant tool access.</p>{view.roleCards.length ? <ul className="collab-role-list">{view.roleCards.map(role => <li key={role.id}><div className="collab-role-initial" aria-hidden="true">{(role.name || 'A').slice(0, 1)}</div><div><strong>{role.name || 'AI employee'}</strong><span>{role.role || 'Saved role'}</span><small>{role.shared ? 'Shared specialist' : 'Company employee'} · {role.availability}</small></div></li>)}</ul> : <p className="collab-empty">No AI role cards are shared in this company.</p>}</section>
        </div>
        <div className="collab-two-columns">
          <section className="collab-panel"><p className="collab-kicker">COMPANY NOTES</p><h2>A shared conversation</h2><p className="collab-muted">Notes are visible to current members of {view.company.name}.</p>{nextCursor && <button type="button" disabled={!!busy} onClick={() => { setBusy('older-notes'); const id = companyId; void collaborationRequest<{ messages: CompanyMessage[]; nextCursor: string | null }>(companyEndpoint(id, '/messages?latest=1&cursor=' + encodeURIComponent(nextCursor))).then(result => { if (selected.current !== id) return; setMessages(current => [...result.messages, ...current.filter(item => !result.messages.some(m => m.id === item.id))]); setNextCursor(result.nextCursor); }).catch(e => setError(errorMessage(e))).finally(() => setBusy('')); }}>Load earlier notes</button>}
            <ol className="collab-messages">{messages.map(message => <li key={message.id}><div><strong>{message.authorUserId === session.user.id ? 'You' : message.authorName}</strong><time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time></div><p>{message.content}</p></li>)}</ol>{messages.length === 0 && <p className="collab-empty">No shared notes yet.</p>}
            {writable ? <form className="collab-stacked-form" onSubmit={e => { e.preventDefault(); void perform('note', async () => { await collaborationRequest(companyEndpoint(companyId, '/messages'), 'POST', { content: note }); setNote(''); return `Note posted to ${view.company.name}.`; }); }}><label htmlFor="company-note">Post a company note<textarea id="company-note" rows={4} required maxLength={4000} value={note} onChange={e => setNote(e.target.value)} disabled={!!busy} placeholder="Share a concise update or handoff." /></label><button type="submit" className="primary-button" disabled={!!busy}>{busy === 'note' ? 'Posting…' : 'Post note'}</button></form> : <p className="collab-permission-note">Viewer access includes reading. Ask the owner for Contributor access to post notes.</p>}
          </section>
          <section className="collab-panel"><p className="collab-kicker">TASK PROPOSALS</p><h2>Make the next step clear</h2><p className="collab-muted">Contributors propose and claim work. The owner reviews proposals before a plan is queued.</p>
            {writable && <form className="collab-stacked-form" onSubmit={e => { e.preventDefault(); const key = proposalKey || crypto.randomUUID(); setProposalKey(key); void perform('proposal', async () => { await collaborationRequest(companyEndpoint(companyId, '/proposals'), 'POST', { brief, evidenceLinks: evidence.split('\n').map(x => x.trim()).filter(Boolean), idempotencyKey: key }); setBrief(''); setEvidence(''); setProposalKey(''); return 'Proposal saved for owner review. No model job was started.'; }); }}><label htmlFor="proposal-brief">Proposal brief<textarea id="proposal-brief" required maxLength={4000} rows={4} value={brief} onChange={e => { setBrief(e.target.value); setProposalKey(''); }} disabled={!!busy} placeholder="Outcome, evidence, and what needs to happen next." /></label><label htmlFor="proposal-evidence">Evidence links <span className="collab-muted">Optional · up to 5 HTTPS links, one per line</span><textarea id="proposal-evidence" rows={2} maxLength={2500} value={evidence} onChange={e => { setEvidence(e.target.value); setProposalKey(''); }} disabled={!!busy} /></label><button className="primary-button" type="submit" disabled={!!busy}>{busy === 'proposal' ? 'Saving…' : 'Submit proposal'}</button></form>}
            <ol className="collab-proposals">{proposals.map(proposal => <li key={proposal.id}><div className="collab-panel-heading"><span className="collab-badge">{proposal.status === 'queued' ? 'Plan queued' : proposal.status}</span><small>{personName(proposal.requesterUserId)}</small></div><p>{proposal.brief}</p>{proposal.evidenceLinks.length > 0 && <ul className="collab-evidence">{proposal.evidenceLinks.map(link => <li key={link}><a href={link} target="_blank" rel="noreferrer noopener">{new URL(link).hostname}<span className="sr-only">: {link}</span> ↗</a></li>)}</ul>}<small>Assigned to: {personName(proposal.assignedUserId)}</small>
              {proposal.status === 'proposed' && writable && <div className="collab-actions">{!proposal.assignedUserId && <button type="button" disabled={!!busy} onClick={() => { void perform('claim', async () => { await collaborationRequest(`/api/collaboration/proposals/${encodeURIComponent(proposal.id)}/claim`, 'POST', {}); return 'You claimed this proposal.'; }); }}>Claim task</button>}{(proposal.assignedUserId === session.user.id || owner && proposal.assignedUserId) && <button type="button" disabled={!!busy} onClick={() => { void perform('unclaim', async () => { await collaborationRequest(`/api/collaboration/proposals/${encodeURIComponent(proposal.id)}/claim`, 'POST', { unclaim: true }); return 'Proposal unassigned.'; }); }}>Unassign</button>}{owner && <><button type="button" disabled={!!busy || !Number.isSafeInteger(view.revision)} onClick={() => { void perform('accept', async () => { await collaborationRequest(`/api/collaboration/proposals/${encodeURIComponent(proposal.id)}/decision`, 'POST', { decision: 'accept', expectedRevision: view.revision }); return 'A plan-only command is queued for the connected native workspace. Its execution has not been confirmed yet.'; }); }}>Accept as plan</button><button type="button" disabled={!!busy} onClick={() => { void perform('reject', async () => { await collaborationRequest(`/api/collaboration/proposals/${encodeURIComponent(proposal.id)}/decision`, 'POST', { decision: 'reject' }); return 'Proposal rejected; its history is preserved.'; }); }}>Reject</button></>}</div>}
              {proposal.status === 'queued' && <p className="collab-muted">{proposal.nativeRef ? `Native reference: ${proposal.nativeRef}` : 'Awaiting the connected native workspace. No completed work is implied.'}</p>}
            </li>)}</ol>{proposals.length === 0 && <p className="collab-empty">No proposals in this company yet.</p>}
          </section>
        </div>
        <section className="collab-panel"><p className="collab-kicker">SAVED WORK</p><h2>Goals & roadmap</h2><div className="collab-two-columns"><div><h3>Company goals</h3><ul className="collab-compact-list">{view.goals.map(goal => <li key={goal.id}><strong>{goal.title || 'Goal'}</strong><span>{goal.status || 'Status unavailable'}</span></li>)}</ul>{view.goals.length === 0 && <p className="collab-empty">No shared goal records.</p>}</div><div><h3>Roadmap</h3><ul className="collab-compact-list">{view.roadmap.map(item => <li key={item.id}><strong>{item.title || 'Roadmap item'}</strong><span>{item.status || 'Status unavailable'}</span></li>)}</ul>{view.roadmap.length === 0 && <p className="collab-empty">No shared roadmap records.</p>}</div></div></section>
        {refreshedAt && <p className="collab-refresh-time">Last refreshed {formatTime(refreshedAt)} · Visible records are checked again while this page is open.</p>}
      </>}
      <details className="collab-profile"><summary>Your display name</summary><form className="collab-stacked-form" onSubmit={e => { e.preventDefault(); setBusy('profile'); void collaborationRequest<{ displayName: string }>('/api/collaboration/me', 'PATCH', { displayName }).then(result => { setSession(current => current ? { ...current, user: { ...current.user, displayName: result.displayName } } : null); setNotice('Display name updated.'); }).catch(e => setError(errorMessage(e))).finally(() => setBusy('')); }}><label htmlFor="member-display-name">Name shown to company teammates<input id="member-display-name" value={displayName} maxLength={100} required onChange={e => setDisplayName(e.target.value)} disabled={!!busy} /></label><button type="submit" disabled={!!busy}>Save display name</button></form></details>
    </>}
  </main>;
}
