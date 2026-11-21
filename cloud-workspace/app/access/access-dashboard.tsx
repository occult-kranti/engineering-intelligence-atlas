'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import OfficeHeader from '../office-header';
import { CollaborationError, collaborationRequest, companyEndpoint, errorMessage, formatTime, isoDateInput, localDateInput, nextWeek, roleLabel, signInPath } from '../collaboration/client';
import type { AccessDashboard as Dashboard, Membership, NewInvitation, Session } from '../collaboration/types';
import './access.css';

export default function AccessDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'contributor'>('viewer');
  const [inviteExpiry, setInviteExpiry] = useState(nextWeek);
  const [created, setCreated] = useState<(NewInvitation & { url: string }) | null>(null);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [editRole, setEditRole] = useState<'viewer' | 'contributor'>('viewer');
  const [editExpiry, setEditExpiry] = useState('');
  const [noExpiry, setNoExpiry] = useState(false);
  const selectedRef = useRef(companyId);
  const loadSequence = useRef(0);
  selectedRef.current = companyId;

  useEffect(() => {
    const controller = new AbortController();
    collaborationRequest<Session>('/api/collaboration/session', 'GET', undefined, controller.signal).then(value => {
      setSession(value);
      const requested = new URLSearchParams(window.location.search).get('company');
      setCompanyId(value.companies.find(c => c.id === requested)?.id ?? value.companies[0]?.id ?? '');
    }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setInitializing(false); });
    return () => controller.abort();
  }, []);

  const refresh = useCallback(async (id: string, signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const result = await collaborationRequest<Dashboard>(companyEndpoint(id, '/access'), 'GET', undefined, signal);
      if (selectedRef.current === id && sequence === loadSequence.current && !signal?.aborted) { setData(result); setRefreshedAt(new Date().toISOString()); }
    } catch (e) {
      if (selectedRef.current === id && sequence === loadSequence.current && !signal?.aborted) { setData(null); setError(errorMessage(e)); }
    } finally { if (selectedRef.current === id && sequence === loadSequence.current && !signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    setData(null); setCreated(null); setEditing(null); setError(''); setNotice('');
    if (!companyId || !session?.user.isOwner) return;
    const controller = new AbortController();
    void refresh(companyId, controller.signal);
    return () => controller.abort();
  }, [companyId, session?.user.isOwner, refresh]);

  async function perform(label: string, task: () => Promise<string>) {
    const id = companyId;
    setBusy(label); setError(''); setNotice('');
    try {
      const message = await task();
      setNotice(message);
      await refresh(id);
    } catch (e) { setError(errorMessage(e)); if (e instanceof CollaborationError && [401, 403, 404, 409].includes(e.status)) { setEditing(null); await refresh(id); } }
    finally { setBusy(''); }
  }
  function edit(member: Membership) {
    setEditing(member); setEditRole(member.role); setNoExpiry(member.expiresAt === null);
    setEditExpiry(member.expiresAt && Date.parse(member.expiresAt) > Date.now() ? localDateInput(member.expiresAt) : nextWeek());
  }
  const companies = session?.companies.filter(c => c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) ?? [];
  const selected = session?.companies.find(c => c.id === companyId);
  const active = data?.memberships.filter(m => m.status === 'active').length ?? 0;
  const pending = data?.invitations.filter(i => i.status === 'pending').length ?? 0;

  return <main className="office-home collaboration-page">
    <OfficeHeader signedIn={!!session} current="access" />
    <header className="collab-heading"><div><p className="eyebrow">OWNER WORKSPACE</p><h1>People & access</h1><p>Give each person a clear place to work, with a role and an expiry you control.</p></div><a className="collab-secondary-link" href="/visit">Open visiting office <span aria-hidden="true">↗</span></a></header>
    {initializing && <div className="collab-empty" role="status">Checking your workspace access…</div>}
    {!initializing && !session && <section className="collab-panel collab-entry"><h2>Sign in to manage access</h2><p>{error || 'Use the ChatGPT account that owns this workspace.'}</p><a className="primary-link" href={signInPath('/access')} target="_top">Sign in with ChatGPT</a><p className="collab-muted">Company membership also requires access to this private Site.</p></section>}
    {session && !session.user.isOwner && <section className="collab-panel collab-entry"><h2>Your companies are in the visiting office</h2><p>The workspace owner manages invitations, roles, and membership expiry.</p><a className="primary-link" href="/visit">Open my company workspace</a></section>}
    {session?.user.isOwner && <div className="collab-access-layout">
      <aside className="collab-company-picker" aria-label="Select access scope"><p className="collab-kicker">COMPANY SCOPE</p><label htmlFor="access-company-search">Find a company</label><input id="access-company-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your companies" />
        <div className="collab-company-list">{companies.slice(0, 150).map(c => <button key={c.id} type="button" aria-current={c.id === companyId ? 'true' : undefined} disabled={!!busy} onClick={() => setCompanyId(c.id)}><span>{c.name}</span><small>{c.id === companyId ? 'Selected company' : 'Manage access'}</small></button>)}</div>
        {companies.length === 0 && <p className="collab-muted">No matching companies.</p>}
        {companies.length > 150 && <p className="collab-muted">Showing 150 matches. Narrow your search to find another company.</p>}
        {session.companyListTruncated && <p className="collab-muted">The company list reached its limit. Some saved companies are not shown.</p>}
        <p className="collab-scope-note">A company membership applies to that company. Parent and child companies keep separate access.</p>
      </aside>
      <div className="collab-access-content">
        {!companyId && <section className="collab-panel"><h2>Your company directory is empty</h2><p>Sync a company from Daftar before inviting people to it.</p><a href="/">Open workspace</a></section>}
        {selected && <section className="collab-scope-heading"><div><p className="collab-kicker">MANAGING ACCESS FOR</p><h2>{selected.name}</h2></div><button type="button" onClick={() => { setError(''); void refresh(companyId); }} disabled={loading || !!busy}>{loading ? 'Refreshing…' : 'Refresh'}</button></section>}
        {error && <div className="collab-alert is-error" role="alert">{error}</div>}
        {notice && <div className="collab-alert" role="status">{notice}</div>}
        {!data && loading && <p role="status" className="collab-empty">Loading saved people, invitations, and access history…</p>}
        {data && <>
          <div className="collab-access-summary"><div><strong>{active}</strong><span>active memberships shown</span></div><div><strong>{pending}</strong><span>pending invitations shown</span></div><div><strong>Private</strong><span>Site audience is unchanged</span></div></div>
          <section className="collab-panel"><div className="collab-panel-heading"><div><p className="collab-kicker">INVITE A PERSON</p><h2>A seat in {data.company.name}</h2></div><span className="collab-badge">Company access</span></div>
            <p className="collab-muted">Create an invitation for a specific account. Share its link after reviewing the company, role, and expiry below.</p>
            <form className="collab-form" onSubmit={e => { e.preventDefault(); void perform('invite', async () => {
              const result = await collaborationRequest<NewInvitation>(companyEndpoint(companyId, '/invitations'), 'POST', { intendedEmail: inviteEmail.trim(), role: inviteRole, expiresAt: isoDateInput(inviteExpiry) });
              setCreated({ ...result, url: window.location.origin + result.joinPath });
              return `Invitation created for ${inviteEmail.trim()} in ${data.company.name}. No message was sent.`;
            }); }}>
              <label className="collab-wide" htmlFor="invite-email">Account email<input id="invite-email" type="email" autoComplete="off" required maxLength={320} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="person@example.com" disabled={!!busy} /></label>
              <label htmlFor="invite-role">Role<select id="invite-role" value={inviteRole} onChange={e => setInviteRole(e.target.value as 'viewer' | 'contributor')} disabled={!!busy}><option value="viewer">Viewer — read the shared company view</option><option value="contributor">Contributor — also post, propose, and claim tasks</option></select></label>
              <label htmlFor="invite-expiry">Access expires at <span className="collab-muted">Your local time</span><input id="invite-expiry" type="datetime-local" required value={inviteExpiry} onChange={e => setInviteExpiry(e.target.value)} disabled={!!busy} /></label>
              <p className="collab-review collab-wide"><strong>{data.company.name}</strong> · {roleLabel(inviteRole)} · until {formatTime(inviteExpiry)}. The invitation and resulting membership share this expiry.</p>
              <button className="primary-button" type="submit" disabled={!!busy}>{busy === 'invite' ? 'Creating invitation…' : 'Create invitation'}</button>
            </form>
            <p className="collab-scope-note">The invitee also needs permission to open this private Site. Creating a company invitation does not change the Site audience or share its access credential.</p>
            {created && <div className="collab-invitation-ready" role="status"><h3>Your invitation link is ready</h3><p>{created.invitation.intendedEmail} · {roleLabel(created.invitation.role)} · expires {formatTime(created.invitation.expiresAt)}</p><label htmlFor="created-invitation-link">Private invitation link<input id="created-invitation-link" readOnly value={created.url} onFocus={e => e.target.select()} /></label><div className="collab-actions"><button type="button" onClick={() => { if (!navigator.clipboard?.writeText) { setError('Select the invitation link and copy it manually.'); return; } void navigator.clipboard.writeText(created.url).then(() => setNotice('Invitation link copied.')).catch(() => setError('Copy is unavailable in this browser. Select the invitation link and copy it manually.')); }}>Copy invitation link</button><button type="button" onClick={() => setCreated(null)}>Hide link</button></div><small>The link is shown only now. If it is lost, revoke this invitation and create another.</small></div>}
          </section>

          <section className="collab-panel"><div className="collab-panel-heading"><div><p className="collab-kicker">HUMAN MEMBERSHIPS</p><h2>People in this company</h2></div><span className="collab-badge">Owner retains control</span></div>
            <p className="collab-muted">These are authenticated people. AI employees and shared specialists keep their own work permissions.</p>
            {data.memberships.length === 0 ? <p className="collab-empty">No invited members yet. You retain owner access.</p> : <ul className="collab-record-list">{data.memberships.map(member => <li key={member.id}><div className="collab-record-main"><strong>{member.displayName === 'Member' ? member.email ?? 'Member' : member.displayName}</strong>{member.displayName !== 'Member' && member.email && <span>{member.email}</span>}<small>{roleLabel(member.role)} · {member.status} · {member.expiresAt ? `expires ${formatTime(member.expiresAt)}` : 'no expiry'}</small></div><div className="collab-actions">{(member.status === 'active' || member.status === 'expired') && <><button type="button" disabled={!!busy} onClick={() => edit(member)}>Edit access</button><button className="collab-danger-button" type="button" disabled={!!busy} onClick={() => { void perform('revoke-' + member.id, async () => { const result = await collaborationRequest<{ revoked: boolean }>(`/api/collaboration/memberships/${encodeURIComponent(member.id)}`, 'DELETE'); if (editing?.id === member.id) setEditing(null); return result.revoked ? `Access revoked for ${member.email ?? member.displayName} in ${data.company.name}.` : 'No access change was applied. The saved memberships have been refreshed.'; }); }}>Revoke</button></>}</div></li>)}</ul>}
            {data.truncation.memberships && <p className="collab-muted">Showing the 200 most recently updated memberships.</p>}
            {editing && <section className="collab-edit-panel" aria-labelledby="edit-access-title"><h3 id="edit-access-title">Edit {editing.email ?? editing.displayName}</h3><p>Company: <strong>{data.company.name}</strong></p><form className="collab-form" onSubmit={e => { e.preventDefault(); void perform('edit', async () => { await collaborationRequest(`/api/collaboration/memberships/${encodeURIComponent(editing.id)}`, 'PATCH', { role: editRole, expiresAt: noExpiry ? null : isoDateInput(editExpiry), expectedAclRevision: editing.aclRevision }); setEditing(null); return `Access saved for ${editing.email ?? editing.displayName} in ${data.company.name}.`; }); }}><label htmlFor="edit-member-role">Role<select id="edit-member-role" value={editRole} onChange={e => setEditRole(e.target.value as 'viewer' | 'contributor')} disabled={!!busy}><option value="viewer">Viewer</option><option value="contributor">Contributor</option></select></label><label htmlFor="edit-member-expiry">Access expires at<input id="edit-member-expiry" type="datetime-local" required={!noExpiry} disabled={noExpiry || !!busy} value={editExpiry} onChange={e => setEditExpiry(e.target.value)} /></label><label className="collab-check collab-wide"><input type="checkbox" checked={noExpiry} onChange={e => setNoExpiry(e.target.checked)} disabled={!!busy} />Keep this membership until I revoke it</label><p className="collab-review collab-wide">{roleLabel(editRole)} access to {data.company.name}, {noExpiry ? 'with no expiry' : `until ${formatTime(editExpiry)}`}.</p><div className="collab-actions collab-wide"><button className="primary-button" type="submit" disabled={!!busy}>Save access</button><button type="button" disabled={!!busy} onClick={() => setEditing(null)}>Cancel edit</button></div></form></section>}
          </section>

          <section className="collab-panel"><p className="collab-kicker">INVITATION HISTORY</p><h2>Links and their status</h2>{data.invitations.length === 0 ? <p className="collab-empty">No invitations have been created for this company.</p> : <ul className="collab-record-list">{data.invitations.map(inv => <li key={inv.id}><div className="collab-record-main"><strong>{inv.intendedEmail ?? 'Account holding the invitation'}</strong><small>{roleLabel(inv.role)} · {inv.status} · expires {formatTime(inv.expiresAt)}</small></div>{inv.status === 'pending' && <button className="collab-danger-button" disabled={!!busy} type="button" onClick={() => { void perform('invite-revoke-' + inv.id, async () => { const result = await collaborationRequest<{ revoked: boolean }>(`/api/collaboration/invitations/${encodeURIComponent(inv.id)}`, 'DELETE'); if (created?.invitation.id === inv.id) setCreated(null); return result.revoked ? `Invitation revoked for ${inv.intendedEmail ?? 'the invited account'} in ${data.company.name}.` : 'No pending invitation was revoked. Its saved status has been refreshed.'; }); }}>Revoke invitation</button>}</li>)}</ul>}{data.truncation.invitations && <p className="collab-muted">Showing the 200 latest invitations.</p>}</section>

          <section className="collab-panel"><p className="collab-kicker">ATTRIBUTED HISTORY</p><h2>Access activity</h2>{data.audit.length === 0 ? <p className="collab-empty">Access changes will appear here when they are saved.</p> : <ol className="collab-audit">{data.audit.map(event => <li key={event.id}><span className="collab-audit-dot" aria-hidden="true" /><div><strong>{event.summary}</strong><small>{event.actorUserId === session.user.id ? session.user.displayName ?? 'Owner' : event.actorName} · <time dateTime={event.createdAt}>{formatTime(event.createdAt)}</time></small></div></li>)}</ol>}<p className="collab-muted">Latest 100 recorded actions for this company.</p></section>
        </>}
        {refreshedAt && <p className="collab-refresh-time">Last refreshed {formatTime(refreshedAt)}</p>}
      </div>
    </div>}
  </main>;
}
