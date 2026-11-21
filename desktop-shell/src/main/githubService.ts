import { githubJson } from './githubImport';
import { reviewExternalSources } from './sourceReview';

export interface GitHubChange { path: string; content: string }
export interface GitHubOperation {
  operation: 'branches' | 'compare' | 'snapshot' | 'publish_changes';
  branch?: unknown; base?: unknown; head?: unknown; expectedHead?: unknown; message?: unknown; files?: unknown;
}
function branchName(value: unknown): string {
  if (typeof value !== 'string' || value.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(value) || value.includes('..') || value.includes('//') || value.endsWith('/') || value.endsWith('.lock')) throw new Error('Enter a valid branch name.');
  return value;
}
function record(value: unknown): Record<string, any> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('GitHub returned invalid metadata.'); return value as Record<string, any>; }
function sha(value: unknown): string { if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)) throw new Error('A verified Git commit SHA is required.'); return value; }
export function repositoryIdentity(url: unknown): string {
  if (typeof url !== 'string' || !/^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(url)) throw new Error('Select a registered GitHub company.');
  const identity = url.slice('https://github.com/'.length); if (['.','..'].includes(identity.split('/')[1]!)) throw new Error('Invalid repository identity.'); return identity;
}
export function validateChangeSet(value: unknown): GitHubChange[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new Error('A changeset must contain between 1 and 100 text files.');
  const seen = new Set<string>(); let bytes = 0;
  return value.map(raw => {
    const f = record(raw);
    if (typeof f.path !== 'string' || typeof f.content !== 'string' || f.path.length > 240 || /[\x00-\x1f\\]/.test(f.path) || f.path.startsWith('/') || f.path.split('/').some((s: string) => !s || s === '.' || s === '..' || s === '.git')) throw new Error('Changeset paths must be relative repository paths.');
    if (/(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519|credentials(?:\.json)?|.*\.(?:pem|p12|pfx|key))$/i.test(f.path) && !/(^|\/)\.env\.example$/.test(f.path)) throw new Error('Credential files cannot be published through the employee.');
    if (/(?:sk-ant-api|sk-proj-|github_pat_|gh[pousr]_)[A-Za-z0-9_-]{20,}/.test(f.content)) throw new Error('The changeset appears to contain a credential. Remove it before publishing.');
    if (/-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/.test(f.content)) throw new Error('The changeset contains private key credential material. Remove it before publishing.');
    if (seen.has(f.path)) throw new Error('Duplicate file in changeset.'); seen.add(f.path);
    bytes += Buffer.byteLength(f.content, 'utf8'); if (bytes > 500_000) throw new Error('Changeset exceeds the 500 KB text limit. Split it into reviewable commits.');
    return { path: f.path, content: f.content };
  });
}

/** Fixed GitHub operations; no shell, repository scripts, or token returned to callers. */
export class GitHubService {
  constructor(private readonly token: () => string | null, private readonly fetcher: typeof fetch = fetch) {}
  async run(repoUrl: string, request: GitHubOperation): Promise<Record<string, unknown>> {
    const identity = repositoryIdentity(repoUrl); const root = `/repos/${identity}`; const token = this.token();
    if (!token) throw new Error('Save a GitHub credential in Settings before accessing branches or publishing.');
    const api = async (endpoint: string, method = 'GET', body?: unknown) => githubJson(endpoint, token, this.fetcher, method, body);
    if (request.operation === 'snapshot') {
      const metadata = record(await api(root));
      if (metadata.full_name !== identity) throw new Error('Repository metadata identity changed.');
      const branch = branchName(metadata.default_branch);
      const head = record(await api(`${root}/git/ref/heads/${encodeURIComponent(branch)}`));
      const headSha = sha(head.object?.sha);
      const branches = await this.run(repoUrl, { operation: 'branches' });
      let readme: { path: string; sha: string; content: string; truncated: boolean } | null = null;
      try {
        // Pin documentation to the verified commit; repository text stays data.
        const value = record(await api(`${root}/readme?ref=${headSha}`));
        if (typeof value.content !== 'string' || value.encoding !== 'base64' || typeof value.path !== 'string') throw new Error('Invalid README response.');
        const body = Buffer.from(value.content, 'base64').toString('utf8');
        readme = { path: value.path.slice(0, 240), sha: sha(value.sha), content: body.slice(0, 16000), truncated: body.length > 16000 };
      } catch (error) {
        // A repository can have no README. Other failures must remain visible.
        if (!(error instanceof Error && error.message.includes('HTTP 404'))) throw error;
      }
      const description = typeof metadata.description === 'string' ? metadata.description.slice(0, 1000) : '';
      const contentReview = reviewExternalSources([
        { id: 'repository-description', kind: 'repository', text: description, truncated: typeof metadata.description === 'string' && metadata.description.length > 1000 },
        ...(readme ? [{ id: 'repository-readme', kind: 'repository' as const, text: readme.content, truncated: readme.truncated }] : []),
      ]);
      return { operation: 'snapshot', repository: identity, branch, headSha, description, branches: branches.branches, readme, contentReview, checkedAt: new Date().toISOString(), url: `${repoUrl}/tree/${headSha}` };
    }
    if (request.operation === 'branches') {
      const branches: Array<{ name: string; sha: string; protected: boolean }> = [];
      for (let page = 1; page <= 11; page++) {
        const data = await api(`${root}/branches?per_page=100&page=${page}`);
        if (!Array.isArray(data)) throw new Error('GitHub returned invalid branches.');
        if (page === 11 && data.length) throw new Error('Repository exceeds the 1,000 branch inspection limit.');
        for (const b of data) branches.push({ name: branchName(b.name), sha: sha(b.commit?.sha), protected: b.protected === true });
        if (data.length < 100) break;
      }
      return { operation: 'branches', branches, repository: identity, checkedAt: new Date().toISOString() };
    }
    if (request.operation === 'compare') {
      const base = branchName(request.base); const head = branchName(request.head);
      const data = record(await api(`${root}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`));
      return { operation: 'compare', status: data.status, aheadBy: data.ahead_by, behindBy: data.behind_by, totalCommits: data.total_commits, files: Array.isArray(data.files) ? data.files.map((f: any) => ({ path: f.filename, status: f.status, additions: f.additions, deletions: f.deletions })) : [], url: `https://github.com/${identity}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}` };
    }
    if (request.operation !== 'publish_changes') throw new Error('Unknown GitHub operation.');
    const branch = branchName(request.branch); const expected = sha(request.expectedHead); const files = validateChangeSet(request.files);
    if (typeof request.message !== 'string' || request.message.trim().length < 3 || request.message.length > 2000) throw new Error('A descriptive commit message is required.');
    const refPath = `${root}/git/ref/heads/${encodeURIComponent(branch)}`;
    const head = record(await api(refPath)); if (sha(head.object?.sha) !== expected) throw new Error('Branch changed. Refresh branches and review the new head before publishing.');
    const parent = record(await api(`${root}/git/commits/${expected}`));
    const tree = record(await api(`${root}/git/trees`, 'POST', { base_tree: sha(parent.tree?.sha), tree: files.map(f => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })) }));
    const commit = record(await api(`${root}/git/commits`, 'POST', { message: request.message.trim(), tree: sha(tree.sha), parents: [expected] }));
    const latest = record(await api(refPath)); if (sha(latest.object?.sha) !== expected) throw new Error('Branch changed during preparation. Your commit object is preserved but the branch was not moved.');
    // A concurrent competing commit is not an ancestor of this commit, so GitHub
    // rejects it with force:false. Never retry an ambiguous write automatically.
    await api(`${root}/git/refs/heads/${encodeURIComponent(branch)}`, 'PATCH', { sha: sha(commit.sha), force: false });
    return { operation: 'publish_changes', commit: sha(commit.sha), previousHead: expected, branch, files: files.map(f => f.path), url: `https://github.com/${identity}/commit/${sha(commit.sha)}` };
  }
}
