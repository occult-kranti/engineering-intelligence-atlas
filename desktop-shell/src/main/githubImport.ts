/** GitHub metadata import. Credentials stay in main and requests use a fixed API host. */
export interface PublicRepository {
  name: string; repoUrl: string; source: 'github-public-api' | 'github-authenticated-api'; importedAt: string;
  visibility?: 'public' | 'private'; defaultBranch?: string;
}
function ownerName(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(value.trim())) throw new Error('Enter a GitHub account name, without a URL or credentials.');
  return value.trim();
}
export async function githubJson(endpoint: string, token: string | null, fetcher: typeof fetch = fetch, method = 'GET', body?: unknown): Promise<unknown> {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//') || /[\r\n]/.test(endpoint)) throw new Error('Invalid GitHub API path.');
  let response: Response;
  try {
    response = await fetcher(`https://api.github.com${endpoint}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'Atlas-Research-Director/0.4.0', 'x-github-api-version': '2022-11-28', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new Error('GitHub request failed before a verified response. Check the connection and retry deliberately.'); }
  if (!response.ok) { await response.body?.cancel(); throw new Error(`GitHub API returned HTTP ${response.status}. Catalog imports remain unchanged; inspect a branch before retrying a write.`); }
  if (!response.body) throw new Error('GitHub returned no repository catalog.');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const item = await reader.read(); if (item.done) break; size += item.value.byteLength; if (size > 2_000_000) { await reader.cancel(); throw new Error('GitHub catalog exceeds the response limit.'); } chunks.push(item.value); } }
  finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('GitHub returned invalid JSON metadata.'); }
}
async function discover(owner: string, token: string | null, fetcher: typeof fetch): Promise<PublicRepository[]> {
  const repositories: PublicRepository[] = []; const seen = new Set<string>();
  for (let page = 1; page <= 21; page += 1) {
    const endpoint = token ? `/user/repos?affiliation=owner&visibility=all&sort=full_name&per_page=100&page=${page}` : `/users/${owner}/repos?type=owner&sort=full_name&per_page=100&page=${page}`;
    let data: unknown;
    try { data = await githubJson(endpoint, token, fetcher); }
    catch (error) { throw new Error(`${error instanceof Error ? error.message : 'GitHub catalog request failed.'} No partial catalog was imported.`); }
    if (!Array.isArray(data) || data.length > 100) throw new Error('GitHub returned an invalid repository catalog.');
    if (page === 21 && data.length > 0) throw new Error('Account exceeds the 2,000 repository discovery limit. No partial catalog was imported.');
    for (const raw of data) {
      if (!raw || typeof raw !== 'object' || typeof raw.private !== 'boolean' || (!token && raw.private) || typeof raw.name !== 'string' || !raw.owner || typeof raw.owner.login !== 'string') throw new Error('GitHub repository metadata is incomplete.');
      if (raw.owner.login.toLowerCase() !== owner.toLowerCase() || !/^[A-Za-z0-9_.-]{1,100}$/.test(raw.name) || ['.','..'].includes(raw.name)) throw new Error('GitHub repository identity does not match the requested account.');
      const repoUrl = `https://github.com/${raw.owner.login}/${raw.name}`;
      if (raw.html_url !== repoUrl) throw new Error('GitHub repository URL did not match its identity.');
      if (!seen.has(repoUrl.toLowerCase())) {
        repositories.push({ name: raw.name, repoUrl, source: token ? 'github-authenticated-api' : 'github-public-api', importedAt: new Date().toISOString(), visibility: raw.private ? 'private' : 'public', ...(typeof raw.default_branch === 'string' ? { defaultBranch: raw.default_branch } : {}) });
        seen.add(repoUrl.toLowerCase());
      }
    }
    if (data.length < 100) return repositories;
  }
  return repositories;
}
export async function discoverPublicRepositories(ownerRaw: unknown, fetcher: typeof fetch = fetch): Promise<PublicRepository[]> {
  return discover(ownerName(ownerRaw), null, fetcher);
}
/** Owner-only private import: authenticates identity before discovering any catalog. */
export async function discoverOwnedRepositories(ownerRaw: unknown, token: string, fetcher: typeof fetch = fetch): Promise<PublicRepository[]> {
  const owner = ownerName(ownerRaw);
  if (!token || /[\r\n\0]/.test(token)) throw new Error('A usable GitHub credential is required for private repositories.');
  const identity = await githubJson('/user', token, fetcher) as { login?: unknown };
  if (typeof identity?.login !== 'string' || identity.login.toLowerCase() !== owner.toLowerCase()) throw new Error('The GitHub credential belongs to a different account.');
  return discover(owner, token, fetcher);
}
