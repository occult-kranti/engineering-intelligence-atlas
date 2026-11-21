import { describe, expect, it, vi } from 'vitest';
import { GitHubService, repositoryIdentity, validateChangeSet, type GitHubOperation } from '../src/main/githubService';

const repository = 'https://github.com/fixture/repository';
const head = 'a'.repeat(40);
const tree = 'b'.repeat(40);
const createdTree = 'c'.repeat(40);
const commit = 'd'.repeat(40);
const changedHead = 'e'.repeat(40);
const token = 'fixture-credential-not-real';
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const publish = (): GitHubOperation => ({ operation: 'publish_changes', branch: 'feature/review', expectedHead: head, message: 'Add reviewed evidence', files: [{ path: 'evidence/report.md', content: 'Reviewed findings.' }] });
function fetchSequence(values: unknown[]) {
  return vi.fn<typeof fetch>(async () => {
    if (!values.length) throw new Error('Unexpected fixture network request');
    const value = values.shift();
    if (value instanceof Error) throw value;
    return value instanceof Response ? value : response(value);
  });
}

describe('GitHub employee authorization and path boundaries', () => {
  it.each([null, '', 'http://github.com/fixture/repo', 'https://github.com.evil.test/fixture/repo', 'https://github.com/fixture/repo?token=secret', 'https://github.com/fixture/..', 'https://github.com/fixture/repo/tree/main', 'https://user:pass@github.com/fixture/repo'])('rejects a noncanonical repository identity: %s', value => {
    expect(() => repositoryIdentity(value)).toThrow();
  });
  it('requires a main-process credential before making requests', async () => {
    const fetcher = fetchSequence([]);
    await expect(new GitHubService(() => null, fetcher).run(repository, { operation: 'branches' })).rejects.toThrow(/credential/i);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['../escape', '/absolute', 'dir\\file', '.git/config', 'dir/../escape', 'dir//file', 'bad\0name'])('rejects unsafe changeset path %s', path => {
    expect(() => validateChangeSet([{ path, content: 'text' }])).toThrow(/relative/);
  });
  it.each(['.env', '.env.production', 'nested/.env.local', '.aws/credentials', 'id_rsa', 'nested/id_ed25519', 'private.pem', 'certificate.p12', 'secret.key'])('blocks credential path %s', path => {
    expect(() => validateChangeSet([{ path, content: 'fixture' }])).toThrow(/Credential/);
  });
  it('allows a blank environment template but blocks a credential inside it', () => {
    expect(validateChangeSet([{ path: '.env.example', content: 'OPENAI_API_KEY=\n' }])).toHaveLength(1);
    expect(() => validateChangeSet([{ path: '.env.example', content: `OPENAI_API_KEY=sk-proj-${'x'.repeat(32)}` }])).toThrow(/credential/);
  });
  it.each([`github_pat_${'x'.repeat(32)}`, `ghp_${'x'.repeat(32)}`, `sk-ant-api${'x'.repeat(32)}`, `sk-proj-${'x'.repeat(32)}`])('rejects known token content without echoing the token', secret => {
    try { validateChangeSet([{ path: 'notes.md', content: secret }]); expect.fail('Credential was accepted'); }
    catch (error) { expect(String(error)).toMatch(/credential/); expect(String(error)).not.toContain(secret); }
  });
  it('rejects an embedded private key even when its file name looks harmless', () => {
    expect(() => validateChangeSet([{ path: 'notes.md', content: '-----BEGIN PRIVATE KEY-----\nfixture-only\n-----END PRIVATE KEY-----' }])).toThrow(/credential/i);
  });
  it('rejects duplicates and counts UTF-8 bytes for the changeset limit', () => {
    expect(() => validateChangeSet([{ path: 'a', content: '' }, { path: 'a', content: '' }])).toThrow(/Duplicate/);
    expect(() => validateChangeSet([{ path: 'a', content: '猫'.repeat(166_667) }])).toThrow(/500 KB/);
    expect(() => validateChangeSet([])).toThrow();
    expect(() => validateChangeSet(Array.from({ length: 101 }, (_, i) => ({ path: `f${i}`, content: '' })))).toThrow();
  });
});

describe('fixed GitHub reads and compare-and-swap publication', () => {
  it('pins the README to the verified default-branch head for a source snapshot', async () => {
    const fetcher = fetchSequence([{ full_name: 'fixture/repository', default_branch: 'main', description: 'Fixture' }, { object: { sha: head } }, [{ name: 'main', commit: { sha: head } }], { path: 'README.md', encoding: 'base64', sha: tree, content: Buffer.from('Source claims, not executed validation.').toString('base64') }]);
    const result = await new GitHubService(() => token, fetcher).run(repository, { operation: 'snapshot' });
    expect(result).toMatchObject({ headSha: head, branch: 'main', readme: { sha: tree, content: 'Source claims, not executed validation.' } });
    expect(fetcher.mock.calls[3]?.[0]).toBe(`https://api.github.com/repos/fixture/repository/readme?ref=${head}`);
    expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
    expect(JSON.stringify(result)).not.toContain(token);
  });
  it('records a missing README but refuses invalid repository metadata', async () => {
    const fetcher = fetchSequence([{ full_name: 'fixture/repository', default_branch: 'main' }, { object: { sha: head } }, [], response({}, 404)]);
    expect((await new GitHubService(() => token, fetcher).run(repository, { operation: 'snapshot' })).readme).toBeNull();
    await expect(new GitHubService(() => token, fetchSequence([{ full_name: 'other/repository' }])).run(repository, { operation: 'snapshot' })).rejects.toThrow(/identity/);
  });
  it('keeps source-read permission failures visible and never retries or writes', async () => {
    const fetcher = fetchSequence([{ full_name: 'fixture/repository', default_branch: 'main' }, { object: { sha: head } }, [], response({}, 403)]);
    await expect(new GitHubService(() => token, fetcher).run(repository, { operation: 'snapshot' })).rejects.toThrow(/HTTP 403/);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });
  it('inspects branches using only the fixed API host and never returns the credential', async () => {
    const fetcher = fetchSequence([[{ name: 'main', commit: { sha: head }, protected: true }]]);
    const result = await new GitHubService(() => token, fetcher).run(repository, { operation: 'branches' });
    expect(result).toMatchObject({ repository: 'fixture/repository', branches: [{ name: 'main', sha: head, protected: true }] });
    expect(fetcher).toHaveBeenCalledWith('https://api.github.com/repos/fixture/repository/branches?per_page=100&page=1', expect.objectContaining({ method: 'GET', redirect: 'error', headers: expect.objectContaining({ authorization: `Bearer ${token}` }) }));
    expect(JSON.stringify(result)).not.toContain(token);
  });
  it('encodes branch references for compare and returns only reviewed metadata', async () => {
    const fetcher = fetchSequence([{ status: 'ahead', ahead_by: 2, behind_by: 0, total_commits: 2, files: [{ filename: 'a.md', status: 'modified', additions: 2, deletions: 1, patch: 'private patch omitted' }] }]);
    const result = await new GitHubService(() => token, fetcher).run(repository, { operation: 'compare', base: 'main', head: 'feature/review' });
    expect(fetcher.mock.calls[0]![0]).toBe('https://api.github.com/repos/fixture/repository/compare/main...feature%2Freview');
    expect(result.files).toEqual([{ path: 'a.md', status: 'modified', additions: 2, deletions: 1 }]);
  });
  it('rejects stale expected heads before creating any object or moving a branch', async () => {
    const fetcher = fetchSequence([{ object: { sha: changedHead } }]);
    await expect(new GitHubService(() => token, fetcher).run(repository, publish())).rejects.toThrow(/Branch changed/);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![1]!.method).toBe('GET');
  });
  it('rechecks after preparation and does not PATCH when another commit appeared', async () => {
    const fetcher = fetchSequence([{ object: { sha: head } }, { tree: { sha: tree } }, { sha: createdTree }, { sha: commit }, { object: { sha: changedHead } }]);
    await expect(new GitHubService(() => token, fetcher).run(repository, publish())).rejects.toThrow(/not moved/);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });
  it('creates a parented text commit and moves the reviewed branch without force', async () => {
    const fetcher = fetchSequence([{ object: { sha: head } }, { tree: { sha: tree } }, { sha: createdTree }, { sha: commit }, { object: { sha: head } }, { object: { sha: commit } }]);
    const result = await new GitHubService(() => token, fetcher).run(repository, publish());
    expect(JSON.parse(String(fetcher.mock.calls[2]![1]!.body))).toEqual({ base_tree: tree, tree: [{ path: 'evidence/report.md', mode: '100644', type: 'blob', content: 'Reviewed findings.' }] });
    expect(JSON.parse(String(fetcher.mock.calls[3]![1]!.body))).toMatchObject({ parents: [head], tree: createdTree });
    expect(fetcher.mock.calls[5]![0]).toBe('https://api.github.com/repos/fixture/repository/git/refs/heads/feature%2Freview');
    expect(JSON.parse(String(fetcher.mock.calls[5]![1]!.body))).toEqual({ sha: commit, force: false });
    expect(result).toMatchObject({ commit, previousHead: head, branch: 'feature/review' });
  });
  it('does not retry an ambiguous branch write', async () => {
    const fetcher = fetchSequence([{ object: { sha: head } }, { tree: { sha: tree } }, { sha: createdTree }, { sha: commit }, { object: { sha: head } }, new Error(`network error ${token}`)]);
    await expect(new GitHubService(() => token, fetcher).run(repository, publish())).rejects.toThrow(/retry deliberately/);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1);
  });
  it('does not publish malformed changes or branch names', async () => {
    const fetcher = fetchSequence([]);
    const service = new GitHubService(() => token, fetcher);
    for (const branch of ['../main', 'main?x=y', 'main\nInjected', 'feature.lock']) await expect(service.run(repository, { ...publish(), branch })).rejects.toThrow();
    await expect(service.run(repository, { ...publish(), files: [{ path: '.env', content: 'SECRET=value' }] })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
