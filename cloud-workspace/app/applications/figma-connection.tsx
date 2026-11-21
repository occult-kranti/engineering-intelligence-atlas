'use client';
import { useEffect, useState } from 'react';
import { officeApi } from '../office-api';
import { safeHttpsUrl, type DirectoryCompany } from './directory-model';

const endpoint = 'https://mcp.figma.com/mcp';
const setupUrl = 'https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/';
const vscodeInstall = 'vscode:mcp/install?' + encodeURIComponent(JSON.stringify({name: 'figma', type: 'http', url: endpoint}));
type Integration = {companyId: string; fileUrl: string; endpoint: string; connectionStatus: string; updatedAt?: string};

export default function FigmaConnection({companies, signedIn, activeCompanyId, onSaved}: {companies: DirectoryCompany[]; signedIn: boolean; activeCompanyId?: string; onSaved?: () => void}) {
  const [companyId, setCompanyId] = useState(''), [fileUrl, setFileUrl] = useState(''), [records, setRecords] = useState<Integration[]>([]);
  const [message, setMessage] = useState('Save a design reference for the team, then authorize Figma in your chosen client.'), [error, setError] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!signedIn) { setRecords([]); return; }
    let active = true;
    void officeApi('/api/integrations/figma').then(data => { if (active) setRecords(Array.isArray(data.integrations) ? data.integrations : []); }).catch(e => { if (active) { setError(true); setMessage((e as Error).message); } });
    return () => { active = false; };
  }, [signedIn]);
  useEffect(() => {
    if (!companies.some(company => company.id === companyId)) setCompanyId(companies.find(company => company.id === activeCompanyId)?.id ?? companies[0]?.id ?? '');
  }, [companies, companyId, activeCompanyId]);
  useEffect(() => { setFileUrl(records.find(record => record.companyId === companyId)?.fileUrl ?? ''); }, [records, companyId]);
  const saved = records.find(record => record.companyId === companyId);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(false);
    try {
      const url = safeHttpsUrl(fileUrl.trim());
      if (!url || !['www.figma.com', 'figma.com'].includes(new URL(url).hostname) || !/^\/(design|file|board|slides|make)\/[a-zA-Z0-9]+(?:\/|$)/.test(new URL(url).pathname)) throw new Error('Use a Figma design, file, board, slides or Make link without credentials.');
      const data = await officeApi('/api/integrations/figma', {method: 'POST', body: JSON.stringify({companyId, fileUrl: url})});
      if (!data.integration || data.integration.companyId !== companyId) throw new Error('The saved design reference could not be confirmed. Refresh before trying again.');
      setRecords(previous => [...previous.filter(record => record.companyId !== companyId), data.integration]);
      setMessage('Design reference saved for this company. Finish Figma sign-in in VS Code or another supported client.');
      onSaved?.();
    } catch (e) { setError(true); setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="home-panel figma-panel" aria-labelledby="figma-heading" id="design-connections">
    <div className="figma-intro"><p className="eyebrow">DESIGN DEPARTMENT</p><div className="figma-title-row"><h2 id="figma-heading">A shared place to design.</h2><span className="directory-badge">Client sign-in required</span></div><p>Give the team a Figma reference for design context and handoffs. Save it with its company so the next specialist starts in the right place.</p><div className="integration-actions"><a className="primary-link" href={vscodeInstall}>Set up Figma in VS Code</a><a className="quiet-link" href="https://www.figma.com/" target="_blank" rel="noreferrer">Open Figma ↗</a><a className="text-link" href={setupUrl} target="_blank" rel="noreferrer">Official setup guide ↗</a></div><p className="integration-boundary">The setup link opens VS Code for review. Figma authorization happens in that client. Saving a file here does not connect this website to your Figma account or transfer another app’s sign-in.</p><details className="manual-connection"><summary>Manual MCP setup</summary><p>Use Figma’s remote server in a supported MCP client, then follow its sign-in prompt.</p><code>{endpoint}</code><a href="https://code.visualstudio.com/api/extension-guides/ai/mcp" target="_blank" rel="noreferrer">About VS Code MCP installation links ↗</a></details></div>
    <div className="figma-reference"><form onSubmit={save}><label htmlFor="figma-company">Company<select id="figma-company" value={companyId} onChange={event => setCompanyId(event.target.value)} disabled={!signedIn || !companies.length || busy}>{!companies.length && <option value="">Load your companies first</option>}{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label htmlFor="figma-file-url">Figma file URL<input id="figma-file-url" type="url" value={fileUrl} onChange={event => setFileUrl(event.target.value)} placeholder="https://www.figma.com/design/…" maxLength={2048} required disabled={!signedIn || busy} autoComplete="off"/></label><button className="primary-button" type="submit" disabled={busy || !signedIn || !companyId}>{busy ? 'Saving reference…' : 'Save design reference'}</button></form><p className={'integration-message' + (error ? ' is-error' : '')} role="status" aria-live="polite">{message}</p>{saved && safeHttpsUrl(saved.fileUrl) && <a className="text-link" href={safeHttpsUrl(saved.fileUrl)!} target="_blank" rel="noreferrer">Open saved Figma reference ↗</a>}</div>
  </section>;
}
