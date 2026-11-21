/** Private application index and non-secret design connection references. */
type Row = Record<string, any>;
type Env = { DB?: D1Database };
type Principal = { kind: 'browser' | 'device' | 'admin'; id: string };
const encode = new TextEncoder();
const now = () => new Date().toISOString();
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
class InputError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
function check(value: unknown, message: string, status = 400): asserts value { if (!value) throw new InputError(message, status); }
function string(value: unknown, label: string, limit = 200): string { check(typeof value === 'string' && value.trim() && value.length <= limit, `${label} is required (up to ${limit} characters).`); return value.trim(); }
function url(value: unknown, label: string): string {
  const raw = string(value, label, 2048); let u: URL;
  try { u = new URL(raw); } catch { throw new InputError(`${label} must be an HTTPS URL.`); }
  check(u.protocol === 'https:' && !u.username && !u.password && !/[\r\n]/.test(raw), `${label} must be an HTTPS URL without credentials.`);
  check(![...u.searchParams.keys(), ...new URLSearchParams(u.hash.slice(1)).keys()].some(k => /token|secret|password|api[-_]?key/i.test(k)), `${label} cannot contain credentials.`);
  return u.href;
}
function date(value: unknown, label: string): string | undefined { if (value === undefined || value === null || value === '') return undefined; check(typeof value === 'string' && Number.isFinite(Date.parse(value)), `${label} must be a date.`); return new Date(value).toISOString(); }
async function body(request: Request): Promise<Row> {
  check(request.headers.get('content-type')?.startsWith('application/json'), 'JSON is required.', 415);
  check(Number(request.headers.get('content-length') || 0) <= 2 * 1024 * 1024, 'Index is too large.', 413);
  const reader=request.body?.getReader(), chunks:Uint8Array[]=[];let size=0;
  if(reader){while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>2*1024*1024){await reader.cancel();throw new InputError('Index is too large.',413);}chunks.push(next.value);}}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}const raw=new TextDecoder().decode(bytes);
  check(!/(?:sk-ant-|sk-proj-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{12,}/.test(raw), 'Credentials cannot be saved in the application index.');
  let data: unknown; try { data = JSON.parse(raw); } catch { throw new InputError('Invalid JSON.'); }
  check(data && typeof data === 'object' && !Array.isArray(data), 'Object body required.'); return data as Row;
}
function owner(p: Principal) { check(p.kind !== 'device', 'Open the signed-in owner website for this operation.', 403); }
export function validateApplications(value: unknown, snapshot: Row | null): Row[] {
  check(Array.isArray(value) && value.length <= 500, 'Provide up to 500 application records.');
  const companyIds = new Set((snapshot?.companies || []).map((c: Row) => c.id)); const ids = new Set<string>();
  return value.map((v: Row) => {
    check(v && typeof v === 'object', 'Application record required.'); const id = string(v.id, 'Application ID', 150);
    check(!ids.has(id), 'Application IDs must be unique.'); ids.add(id);
    const companyId = string(v.companyId, 'Company ID', 150); check(companyIds.has(companyId), 'Application company must exist in the saved office.');
    check(['website', 'dashboard', 'desktop', 'extension', 'mobile', 'repository', 'service'].includes(v.kind), 'Choose an application kind.');
    check(['live', 'preview', 'release', 'unverified', 'archived'].includes(v.status), 'Choose a publication status.');
    check(Array.isArray(v.links) && v.links.length <= 30, 'Provide up to 30 source links.');
    const links = v.links.map((l: Row) => {
      check(l && typeof l === 'object' && !Array.isArray(l), 'Link record required.');
      check(['application', 'dashboard', 'download', 'repository', 'documentation', 'design'].includes(l.kind), 'Choose a link kind.');
      check(['verified', 'reported'].includes(l.verification), 'Record whether a link is verified or reported.');
      const verifiedAt = date(l.verifiedAt, 'Verification date'); check(l.verification !== 'verified' || verifiedAt, 'Verified links need a verification date.');
      return { label: string(l.label, 'Link label', 120), url: url(l.url, 'Link'), kind: l.kind, verification: l.verification, ...(verifiedAt ? { verifiedAt } : {}), ...(l.sourceUrl ? { sourceUrl: url(l.sourceUrl, 'Link source') } : {}) };
    });
    check(v.status !== 'live' || links.some((l: Row) => ['application', 'dashboard'].includes(l.kind) && l.verification === 'verified'), 'Live status requires a verified application or dashboard link.');
    const related = v.relatedCompanyIds || []; check(Array.isArray(related) && related.length <= 100 && related.every((id: unknown) => typeof id === 'string' && companyIds.has(id)), 'Related companies must exist.');
    return { id, companyId, name: string(v.name, 'Application name', 200), description: string(v.description || 'Description not supplied by the repository.', 'Description', 2000), kind: v.kind, status: v.status, links, relatedCompanyIds: [...new Set(related)], repositoryCreatedAt: date(v.repositoryCreatedAt, 'Repository creation date'), websiteCreatedAt: date(v.websiteCreatedAt, 'Website record creation date'), firstPublishedAt: date(v.firstPublishedAt, 'First publication date'), updatedAt: date(v.updatedAt, 'Source update date'), ...(v.dateSourceUrl ? { dateSourceUrl: url(v.dateSourceUrl, 'Date source') } : {}) };
  });
}
export async function handleDirectoryApi(request: Request, env: Env, p: Principal, snapshot: Row | null): Promise<Response> {
  try {
    const route = new URL(request.url).pathname, method = request.method, db = env.DB!;
    if (route === '/api/applications' && method === 'GET') { const row = await db.prepare("SELECT * FROM daftar_applications WHERE id='owner'").first<Row>(); return response({ revision: row?.revision || 0, entries: row ? JSON.parse(row.entries) : [], updatedAt: row?.updated_at || null }); }
    if (route === '/api/applications' && method === 'PUT') {
      owner(p); const input = await body(request); check(Number.isSafeInteger(input.expectedRevision) && input.expectedRevision >= 0, 'Expected index revision required.'); const entries = validateApplications(input.entries, snapshot), stamp = now();
      const mutation = input.expectedRevision === 0
        ? db.prepare("INSERT OR IGNORE INTO daftar_applications(id,revision,entries,updated_at) VALUES('owner',1,?,?)").bind(JSON.stringify(entries), stamp)
        : db.prepare("UPDATE daftar_applications SET entries=?,updated_at=?,revision=revision+1 WHERE id='owner' AND revision=?").bind(JSON.stringify(entries), stamp, input.expectedRevision);
      const results = await db.batch([mutation, db.prepare('INSERT INTO daftar_integration_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(), p.id, 'update_application_index', 'owner', `${entries.length} application records saved at revision ${input.expectedRevision + 1}.`, stamp)]);
      const result = results[0];
      check(result.meta.changes === 1, 'Application index changed. Refresh before saving.', 409);
      return response({ ok: true, revision: input.expectedRevision + 1, entries, updatedAt: stamp });
    }
    if (route === '/api/integrations/figma' && method === 'GET') { const rows = (await db.prepare("SELECT * FROM daftar_integrations WHERE provider='figma' ORDER BY company_id").all<Row>()).results; return response({ integrations: rows.map(r => ({ ...JSON.parse(r.config), updatedAt: r.updated_at })) }); }
    if (route === '/api/integrations/figma' && method === 'POST') {
      owner(p); const input = await body(request), companyId = string(input.companyId, 'Company ID', 150); check(snapshot?.companies?.some((c: Row) => c.id === companyId), 'Choose an existing company.');
      const fileUrl = url(input.fileUrl, 'Figma file URL'), parsed = new URL(fileUrl); check(['figma.com', 'www.figma.com'].includes(parsed.hostname) && /^\/(design|file|board|slides|make)\/[a-zA-Z0-9]+(?:\/|$)/.test(parsed.pathname), 'Use a Figma design, file, board, slides or Make URL.');
      const integration = { companyId, fileUrl, endpoint: 'https://mcp.figma.com/mcp', connectionStatus: 'client-authorization-required' }, stamp = now();
      await db.batch([db.prepare("INSERT INTO daftar_integrations(id,company_id,provider,config,updated_at) VALUES(?,?,'figma',?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at").bind('figma:' + companyId, companyId, JSON.stringify(integration), stamp), db.prepare('INSERT INTO daftar_integration_events VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), p.id, 'link_figma_file', companyId, 'Saved a design reference. OAuth remains in the selected MCP client.', stamp)]);
      return response({ ok: true, integration: { ...integration, updatedAt: stamp } });
    }
    if (route === '/api/integration-ledger' && method === 'GET') return response({ events: (await db.prepare('SELECT id,actor_id AS actorId,action,scope_id AS scopeId,summary,created_at AS createdAt FROM daftar_integration_events ORDER BY created_at DESC,id DESC LIMIT 200').all()).results });
    return response({ ok: false, error: 'Directory endpoint not found.' }, 404);
  } catch (error) { return response({ ok: false, error: error instanceof InputError ? error.message : 'Directory request could not be completed.' }, error instanceof InputError ? error.status : 500); }
}
