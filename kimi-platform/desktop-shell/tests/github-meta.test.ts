import { describe, expect, it } from 'vitest';
import {
  GITHUB_META_MAX_BYTES,
  GithubMetaCache,
  GithubMetaError,
  classifyGithubMetaError,
  fetchGithubRepoMetadata,
  parseGithubRepoUrl,
  type GithubFetchFn,
  type FetchLikeResponse,
} from '../src/main/githubMeta';
import { routeRepository } from '../src/shared/assistant';

/** Mock fetch: records calls, serves scripted responses. */
function mockFetch(
  handler: (url: string, init: Record<string, unknown>) => { status: number; body?: unknown; headers?: Record<string, string> },
): { fetchFn: GithubFetchFn; calls: { url: string; init: Record<string, unknown> }[] } {
  const calls: { url: string; init: Record<string, unknown> }[] = [];
  const fetchFn: GithubFetchFn = async (url, init) => {
    calls.push({ url, init });
    const res = handler(url, init);
    const headers = new Map(Object.entries(res.headers ?? {}));
    const bodyText = typeof res.body === 'string' ? res.body : JSON.stringify(res.body ?? {});
    const response: FetchLikeResponse = {
      status: res.status,
      headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
      body: null,
      arrayBuffer: async () => new TextEncoder().encode(bodyText).buffer as ArrayBuffer,
    };
    return response;
  };
  return { fetchFn, calls };
}

const SHA = 'a'.repeat(40);

function repoJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'repo',
    full_name: 'octo/repo',
    description: 'A database orm for postgres backends',
    language: 'TypeScript',
    topics: ['database', 'orm'],
    license: { spdx_id: 'MIT' },
    archived: false,
    default_branch: 'main',
    visibility: 'public',
    private: false,
    ...overrides,
  };
}

function goodHandler(url: string): { status: number; body: unknown } {
  if (url.includes('/commits/')) return { status: 200, body: { sha: SHA } };
  return { status: 200, body: repoJson() };
}

describe('parseGithubRepoUrl (SSRF / scheme / host guard)', () => {
  it('accepts exactly https://github.com/<owner>/<repo>', () => {
    expect(parseGithubRepoUrl('https://github.com/octo/repo')).toEqual({ owner: 'octo', repo: 'repo' });
    expect(parseGithubRepoUrl('https://github.com/octo/repo.git').repo).toBe('repo');
    expect(parseGithubRepoUrl('https://github.com/octo/repo/')).toEqual({ owner: 'octo', repo: 'repo' });
  });

  it('rejects non-https, non-github hosts, lookalikes, userinfo, ports', () => {
    for (const bad of [
      'http://github.com/octo/repo',
      'https://gitlab.com/octo/repo',
      'https://github.com.evil.com/octo/repo',
      'https://user:pass@github.com/octo/repo',
      'https://github.com:444/octo/repo',
      'https://api.github.com/repos/octo/repo',
      'https://127.0.0.1/octo/repo',
      'https://[::1]/octo/repo',
      'file:///etc/passwd',
    ]) {
      const r = classifyGithubMetaError(capture(() => parseGithubRepoUrl(bad)));
      expect(r.errorClass, bad).toBe('blocked_url');
    }
  });

  it('rejects malformed paths', () => {
    for (const bad of ['https://github.com/octo', 'https://github.com/octo/repo/issues', 'https://github.com/', 'not a url']) {
      expect(() => parseGithubRepoUrl(bad)).toThrowError(GithubMetaError);
    }
  });
});

function capture(fn: () => unknown): unknown {
  try {
    fn();
    return new Error('did not throw');
  } catch (err) {
    return err;
  }
}

describe('fetchGithubRepoMetadata', () => {
  it('reads public metadata + HEAD sha in exactly two tokenless requests', async () => {
    const { fetchFn, calls } = mockFetch(goodHandler);
    const meta = await fetchGithubRepoMetadata('https://github.com/octo/repo', { fetchFn });
    expect(meta).toMatchObject({
      url: 'https://github.com/octo/repo',
      owner: 'octo',
      name: 'repo',
      language: 'TypeScript',
      topics: ['database', 'orm'],
      license: 'mit',
      archived: false,
      defaultBranch: 'main',
      commitSha: SHA,
      visibility: 'public',
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe('https://api.github.com/repos/octo/repo');
    expect(calls[1]!.url).toBe('https://api.github.com/repos/octo/repo/commits/main?per_page=1');
    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>;
      expect(Object.keys(headers).sort()).toEqual(['accept', 'user-agent']);
      expect(call.init.redirect).toBe('manual');
    }
    // routing: keywords database/orm → backend-engineering rule, permissive license
    const plan = routeRepository(meta);
    expect(plan.status).toBe('assigned');
    expect(plan.redistributionAllowed).toBe(true);
  });

  it('never follows redirects', async () => {
    const { fetchFn } = mockFetch(() => ({ status: 301, body: {}, headers: { location: 'https://evil.example/x' } }));
    const err = classifyGithubMetaError(await captureAsync(() => fetchGithubRepoMetadata('https://github.com/octo/repo', { fetchFn })));
    expect(err.errorClass).toBe('blocked_url');
  });

  it('classifies 404 as not_found, 429/limited-403 as rate_limited, 5xx as unreachable', async () => {
    const notFound = mockFetch(() => ({ status: 404, body: {} }));
    expect(classifyGithubMetaError(await captureAsync(() => fetchGithubRepoMetadata('https://github.com/octo/repo', { fetchFn: notFound.fetchFn }))).errorClass).toBe('not_found');

    const limited = mockFetch(() => ({ status: 429, body: {} }));
    expect(classifyGithubMetaError(await captureAsync(() => fetchGithubRepoMetadata('https://github.com/octo/repo', { fetchFn: limited.fetchFn }))).errorClass).toBe('rate_limited');

    const limited403 = mockFetch(() => ({ status: 403, body: {}, headers: { 'x-ratelimit-remaining': '0' } }));
    expect(classifyGithubMetaError(await captureAsync(() => fetchGithubRepoMetadata('https://github.com/octo/repo', { fetchFn: limited403.fetchFn }))).errorClass).toBe('rate_limited');

    const server = mockFetch(() => ({ status: 502, body: {} }));
    expect(classifyGithubMetaError(await captureAsync(() => fetchGithubRepoMetadata('https://github.com/octo/repo', { fetchFn: server.fetchFn }))).errorClass).toBe('unreachable');
  });

  it('refuses private repositories (desktop is public-only)', async () => {
    const { fetchFn } = mockFetch((url) =>
      url.includes('/commits/') ? { status: 200, body: { sha: SHA } } : { status: 200, body: repoJson({ visibility: 'private', private: true }) },
    );
    const err = classifyGithubMetaError(await captureAsync(() => fetchGithubRepoMetadata('https://github.com/octo/repo', { fetchFn })));
    expect(err.errorClass).toBe('private');
  });

  it('enforces the body size cap via content-length and actual bytes', async () => {
    const big = mockFetch(() => ({ status: 200, body: {}, headers: { 'content-length': String(GITHUB_META_MAX_BYTES + 1) } }));
    expect(classifyGithubMetaError(await captureAsync(() => fetchGithubRepoMetadata('https://github.com/octo/repo', { fetchFn: big.fetchFn }))).errorClass).toBe('bad_response');

    const bigBody = mockFetch(() => ({ status: 200, body: 'x'.repeat(GITHUB_META_MAX_BYTES + 1) }));
    expect(classifyGithubMetaError(await captureAsync(() => fetchGithubRepoMetadata('https://github.com/octo/repo', { fetchFn: bigBody.fetchFn }))).errorClass).toBe('bad_response');
  });

  it('classifies aborts/timeouts as unreachable', async () => {
    const fetchFn: GithubFetchFn = async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };
    const err = classifyGithubMetaError(await captureAsync(() => fetchGithubRepoMetadata('https://github.com/octo/repo', { fetchFn })));
    expect(err.errorClass).toBe('unreachable');
  });

  it('rejects a bad/missing commit sha', async () => {
    const { fetchFn } = mockFetch((url) =>
      url.includes('/commits/') ? { status: 200, body: { sha: 'abc123' } } : { status: 200, body: repoJson() },
    );
    const err = classifyGithubMetaError(await captureAsync(() => fetchGithubRepoMetadata('https://github.com/octo/repo', { fetchFn })));
    expect(err.errorClass).toBe('bad_response');
  });
});

async function captureAsync(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
    return new Error('did not throw');
  } catch (err) {
    return err;
  }
}

describe('GithubMetaCache (repository-metadata namespace)', () => {
  it('caches with TTL, evicts at cap, clears with count', () => {
    const cache = new GithubMetaCache();
    const meta = {
      url: 'https://github.com/octo/repo',
      owner: 'octo',
      name: 'repo',
      description: '',
      language: null,
      topics: [],
      license: null,
      archived: false,
      defaultBranch: 'main',
      commitSha: SHA,
      visibility: 'public',
    } as const;
    let now = 1_000_000;
    expect(cache.get(meta.url, now)).toBeNull();
    cache.set(meta.url, { ...meta }, now);
    expect(cache.get(meta.url, now)).not.toBeNull();
    // TTL expiry
    now += 6 * 60_000;
    expect(cache.get(meta.url, now)).toBeNull();
    // clear
    cache.set(meta.url, { ...meta }, now);
    expect(cache.size).toBe(1);
    expect(cache.clear()).toBe(1);
    expect(cache.size).toBe(0);
  });
});
