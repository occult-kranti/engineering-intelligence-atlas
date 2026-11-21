'use client';
import { useEffect, useState } from 'react';
import OfficeHeader from '../office-header';
import { collaborationRequest, errorMessage, formatTime, roleLabel, signInPath } from '../collaboration/client';
import type { InvitationReview, Session } from '../collaboration/types';
import '../access/access.css';

function invitationToken(value: string): string {
  const trimmed = value.trim();
  if (/^[a-f0-9]{64}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const token = new URLSearchParams(url.hash.slice(1)).get('invite');
    if (url.origin === window.location.origin && url.pathname === '/join' && token && /^[a-f0-9]{64}$/.test(token)) return token;
  } catch { /* The form reports a fixed message without repeating the secret. */ }
  throw new Error('Paste a complete invitation link for this workspace, or its invitation code.');
}

export default function JoinInvitation() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [token, setToken] = useState('');
  const [review, setReview] = useState<InvitationReview | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [joined, setJoined] = useState<{ companyId: string; role: string; expiresAt: string | null } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const initialToken = new URLSearchParams(window.location.hash.slice(1)).get('invite') ?? '';
    if (initialToken) {
      setToken(initialToken);
      // The invitation stays only in this component's memory, never in storage,
      // query strings, analytics, or subsequent navigation/history entries.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    void (async () => {
      try {
        const current = await collaborationRequest<Session>('/api/collaboration/session', 'GET', undefined, controller.signal);
        if (controller.signal.aborted) return;
        setSession(current);
        if (initialToken) {
          setBusy('review');
          const result = await collaborationRequest<InvitationReview>('/api/collaboration/invitations/inspect', 'POST', { token: invitationToken(initialToken) }, controller.signal);
          if (!controller.signal.aborted) setReview(result);
        }
      } catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); }
      finally { if (!controller.signal.aborted) { setInitializing(false); setBusy(''); } }
    })();
    return () => controller.abort();
  }, []);

  async function inspect() {
    setError(''); setReview(null); setBusy('review');
    try { const clean = invitationToken(token); setToken(clean); setReview(await collaborationRequest<InvitationReview>('/api/collaboration/invitations/inspect', 'POST', { token: clean })); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(''); }
  }
  async function accept() {
    setError(''); setBusy('accept');
    try {
      const result = await collaborationRequest<{ membership: { companyId: string; role: string; expiresAt: string | null } }>('/api/collaboration/invitations/accept', 'POST', { token: invitationToken(token) });
      setJoined(result.membership); setToken('');
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(''); }
  }

  return <main className="office-home collaboration-page">
    <OfficeHeader signedIn={!!session} current="visit" />
    <header className="collab-heading"><div><p className="eyebrow">COMPANY INVITATION</p><h1>Your next shared workspace</h1><p>Review who you are joining, the account receiving access, and when that access ends.</p></div></header>
    <section className="collab-panel collab-join-panel">
      {error && <div className="collab-alert is-error" role="alert">{error}</div>}
      {initializing && <p className="collab-empty" role="status">Checking your account and invitation…</p>}
      {!initializing && !session && <><h2>Sign in before joining</h2><p>Use the account named in your invitation. After signing in, reopen the invitation link or paste it below.</p><a className="primary-link" href={signInPath('/join')} target="_top">Sign in with ChatGPT</a></>}
      {session && !joined && <>
        {!review && <form className="collab-stacked-form" onSubmit={e => { e.preventDefault(); void inspect(); }}><label htmlFor="join-token">Private invitation link or code<input id="join-token" type="password" autoComplete="off" spellCheck={false} value={token} onChange={e => setToken(e.target.value)} maxLength={2500} required disabled={!!busy} /></label><button type="submit" className="primary-button" disabled={!!busy}>{busy === 'review' ? 'Reviewing…' : 'Review invitation'}</button></form>}
        {review && <><p className="collab-kicker">REVIEW YOUR ACCESS</p><h2>{review.invitation.company.name}</h2><dl className="collab-grant-review"><div><dt>Account receiving access</dt><dd>{review.invitation.accountEmail ?? session.user.displayName ?? 'Your signed-in account'}</dd></div><div><dt>Company</dt><dd>{review.invitation.company.name}</dd></div><div><dt>Role</dt><dd>{roleLabel(review.invitation.role)}</dd></div><div><dt>Access ends</dt><dd><time dateTime={review.invitation.expiresAt}>{formatTime(review.invitation.expiresAt)}</time></dd></div></dl><p>{review.invitation.role === 'contributor' ? 'You can read this company’s shared office, post company notes, submit proposals, and claim tasks. The owner reviews proposed plans.' : 'You can read this company’s shared office, team, notes, and proposals.'}</p><div className="collab-actions"><button className="primary-button" type="button" disabled={!!busy} onClick={() => void accept()}>{busy === 'accept' ? 'Joining…' : review.invitation.status === 'accepted' ? 'Confirm existing membership' : `Join as ${roleLabel(review.invitation.role)}`}</button><button type="button" disabled={!!busy} onClick={() => { setReview(null); setToken(''); }}>Use another invitation</button></div></>}
      </>}
      {joined && <div role="status"><p className="collab-kicker">MEMBERSHIP SAVED</p><h2>You have access to {review?.invitation.company.name ?? 'the company'}</h2><p>{roleLabel(joined.role)} access {joined.expiresAt ? `until ${formatTime(joined.expiresAt)}` : 'until the owner revokes it'}.</p><a className="primary-link" href={'/visit?company=' + encodeURIComponent(joined.companyId)}>Open company workspace</a></div>}
      <p className="collab-scope-note">This is a company invitation inside a private Site. The owner manages Site audience separately. Joining does not grant access to other companies, provider credentials, or private owner conversations.</p>
    </section>
  </main>;
}
