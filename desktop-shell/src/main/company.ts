import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import type {
  CompanySnapshot,
  CompanyUsage,
  ProjectRun,
  RegisterCompanyRequest,
  UpdateCompanyTaskRequest,
} from '../shared/contract';

type NativeSnapshot = Omit<CompanySnapshot, 'available' | 'backend' | 'error' | 'usage'> & { schemaVersion: number };
type NativeCommand = 'snapshot' | 'register_company' | 'record_github_check' | 'update_task' | 'index_repository' | 'office_snapshot' | 'office_command';
export interface NativeRequest {
  command: NativeCommand;
  stateDir: string;
  seedDir: string;
  repositoryRoot?: string;
  payload?: unknown;
}
type NativeExecutor = (binary: string, request: NativeRequest) => Promise<NativeSnapshot>;
export type GitHubFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface CompanyServiceOptions {
  userDataPath: string;
  seedDir: string;
  binaryPath: string | null;
  repositoryRoot?: string | null;
  /** User-chosen folder from Electron's native dialog, never a renderer path. */
  pickRepository?: () => Promise<string | null>;
  listRuns: () => ProjectRun[];
  fetch?: GitHubFetch;
  execute?: NativeExecutor;
}

export class CompanyError extends Error {
  constructor(message: string, readonly code = 'COMPANY_ERROR') { super(message); this.name = 'CompanyError'; }
}

export function normalizeGitHubRepository(raw: unknown): { owner: string; repo: string; repoUrl: string } {
  if (typeof raw !== 'string' || raw.length > 300) throw new CompanyError('Enter a public GitHub repository URL.');
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new CompanyError('Enter a full https://github.com/owner/repository URL.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) {
    throw new CompanyError('Use a GitHub HTTPS repository URL without credentials, query or fragment.');
  }
  const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean);
  if (parts.length !== 2) throw new CompanyError('Choose the repository itself, not a file, branch or profile URL.');
  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/, '');
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) || repo === '.' || repo === '..') {
    throw new CompanyError('Invalid GitHub owner or repository name.');
  }
  return { owner, repo, repoUrl: `https://github.com/${owner}/${repo}` };
}

/** Public, read-only GitHub API. Fixed origin, no token, no redirects, bounded body. */
async function githubJson(apiPath: string, fetcher: GitHubFetch): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetcher(`https://api.github.com${apiPath}`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(8_000),
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'Engineering-Intelligence-Atlas', 'x-github-api-version': '2022-11-28' },
    });
  } catch { throw new CompanyError('GitHub could not be reached within the request limit. Retry when connected.', 'GITHUB_UNAVAILABLE'); }
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 404) throw new CompanyError('GitHub repository was not found or is private. This connection reads public repositories.', 'GITHUB_NOT_FOUND');
    if (response.status === 403 || response.status === 429) throw new CompanyError('GitHub refused or rate-limited the public request. Retry later.', 'GITHUB_RATE_LIMIT');
    throw new CompanyError(`GitHub returned HTTP ${response.status}.`, 'GITHUB_UNAVAILABLE');
  }
  if (!response.body) throw new CompanyError('GitHub returned an empty response.', 'GITHUB_INVALID');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1_048_576) { await reader.cancel(); throw new CompanyError('GitHub metadata exceeded the 1 MiB limit.', 'GITHUB_INVALID'); }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof CompanyError) throw error;
    throw new CompanyError('GitHub response could not be read.', 'GITHUB_UNAVAILABLE');
  } finally { reader.releaseLock(); }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
    return value as Record<string, unknown>;
  } catch { throw new CompanyError('GitHub returned invalid metadata.', 'GITHUB_INVALID'); }
}

export async function inspectGitHubRepository(repoUrl: string, fetcher: GitHubFetch = globalThis.fetch): Promise<Record<string, unknown>> {
  const target = normalizeGitHubRepository(repoUrl);
  const base = `/repos/${target.owner}/${target.repo}`;
  const repository = await githubJson(base, fetcher);
  if (typeof repository.full_name !== 'string' || repository.full_name.toLowerCase() !== `${target.owner}/${target.repo}`.toLowerCase()
    || typeof repository.default_branch !== 'string' || !repository.default_branch || repository.default_branch.length > 255
    || !Number.isSafeInteger(repository.stargazers_count) || Number(repository.stargazers_count) < 0
    || !Number.isSafeInteger(repository.open_issues_count) || Number(repository.open_issues_count) < 0
    || (repository.description !== null && typeof repository.description !== 'string')
    || (repository.pushed_at !== null && typeof repository.pushed_at !== 'string')) {
    throw new CompanyError('GitHub repository metadata did not match the requested repository.', 'GITHUB_INVALID');
  }
  // The commits endpoint includes file patches and can exceed the bounded body
  // on a large import. A Git ref gives only the branch identity and object SHA.
  const reference = await githubJson(`${base}/git/ref/heads/${encodeURIComponent(repository.default_branch)}`, fetcher);
  const commit = reference.object as { sha?: unknown } | undefined;
  if (!commit || typeof commit.sha !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commit.sha)) {
    throw new CompanyError('GitHub did not provide a valid default-branch commit.', 'GITHUB_INVALID');
  }
  return {
    ...target,
    defaultBranch: repository.default_branch,
    description: typeof repository.description === 'string' ? repository.description.slice(0, 2000) : null,
    stars: repository.stargazers_count,
    openIssues: repository.open_issues_count,
    pushedAt: repository.pushed_at,
    headSha: commit.sha,
    checkedAt: new Date().toISOString(),
  };
}

/** Fixed compiled binary + JSON stdin. No PATH search, command string or shell. */
export function executeNativeCore<T = NativeSnapshot>(binary: string, request: NativeRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    let metadata: fs.Stats;
    try { metadata = fs.lstatSync(binary); } catch { reject(new CompanyError('Rust core is not built. Run npm run build:native or use a complete desktop package.', 'CORE_UNAVAILABLE')); return; }
    if (!path.isAbsolute(binary) || !metadata.isFile() || metadata.isSymbolicLink()) { reject(new CompanyError('Rust core must be a regular compiled executable.', 'CORE_UNAVAILABLE')); return; }
    const input = JSON.stringify(request);
    if (Buffer.byteLength(input) > 1_048_576) { reject(new CompanyError('Native request is too large.')); return; }
    // Do not pass provider keys or the host environment to the metadata process.
    const environment: NodeJS.ProcessEnv = {};
    if (process.platform === 'win32' && process.env.SystemRoot) environment.SystemRoot = process.env.SystemRoot;
    const child = execFile(binary, [], { cwd: path.dirname(binary), env: environment, windowsHide: true, timeout: 12_000, maxBuffer: 64 * 1_048_576, encoding: 'utf8' }, (error, stdout) => {
      if (error) { reject(new CompanyError('Rust core did not complete within its process limits.', 'CORE_FAILED')); return; }
      try {
        const result = JSON.parse(stdout) as { ok?: boolean; snapshot?: NativeSnapshot & { companies?: unknown[]; jobs?: unknown[] }; error?: string; code?: string };
        if (result.ok !== true) throw new CompanyError(typeof result.error === 'string' ? result.error.slice(0, 500) : 'Rust core refused the request.', result.code);
        const state = result.snapshot;
        const office = request.command.startsWith('office_');
        if (!state || state.schemaVersion !== 1 || !Array.isArray(state.employees)
          || (office ? !Array.isArray(state.companies) || !Array.isArray(state.jobs)
            : !state.company || !Array.isArray(state.tasks) || !Array.isArray(state.milestones) || !Array.isArray(state.activity))) {
          throw new CompanyError('Rust core returned an incompatible state.', 'CORE_INVALID');
        }
        resolve(state as T);
      } catch (failure) { reject(failure instanceof CompanyError ? failure : new CompanyError('Rust core returned invalid JSON.', 'CORE_INVALID')); }
    });
    child.stdin?.on('error', () => { /* Process callback reports failure without an unhandled EPIPE. */ });
    child.stdin?.end(input);
  });
}

export function summarizeCompanyUsage(runs: ProjectRun[]): CompanyUsage {
  const usage: CompanyUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0, runCount: runs.length, completedRuns: 0, failedRuns: 0, source: 'local-project-runs' };
  for (const run of runs) {
    for (const key of ['inputTokens', 'outputTokens', 'costUsd'] as const) {
      const value = run.usage?.[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) usage[key] += value;
    }
    if (run.status === 'completed') usage.completedRuns += 1;
    if (run.status === 'failed') usage.failedRuns += 1;
  }
  return usage;
}

export function findNativeCore(appPath: string, resourcesPath?: string): string | null {
  const executable = process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core';
  const candidates = [
    ...(resourcesPath ? [path.join(resourcesPath, 'native', executable)] : []),
    path.join(appPath, 'native', executable),
    path.resolve(appPath, '..', 'native-core', 'target', 'release', executable),
  ];
  return candidates.find((candidate) => {
    try { const stat = fs.lstatSync(candidate); return stat.isFile() && !stat.isSymbolicLink(); } catch { return false; }
  }) ?? null;
}

export class CompanyService {
  private queue: Promise<unknown> = Promise.resolve();
  private cached: NativeSnapshot | null = null;
  private readonly execute: NativeExecutor;
  constructor(private readonly options: CompanyServiceOptions) { this.execute = options.execute ?? executeNativeCore; }

  private usage(): CompanyUsage { return summarizeCompanyUsage(this.options.listRuns()); }
  private decorate(snapshot: NativeSnapshot, error: string | null = null): CompanySnapshot {
    this.cached = snapshot;
    return { ...snapshot, available: true, backend: 'rust', error, usage: this.usage() };
  }
  private failure(error: unknown): CompanySnapshot {
    const message = error instanceof CompanyError ? error.message : 'Company operation failed. Existing state was preserved.';
    return {
      company: this.cached?.company ?? null, employees: this.cached?.employees ?? [], tasks: this.cached?.tasks ?? [],
      milestones: this.cached?.milestones ?? [], activity: this.cached?.activity ?? [], index: this.cached?.index ?? null,
      available: !!this.options.binaryPath && !(error instanceof CompanyError && error.code === 'CORE_UNAVAILABLE'),
      backend: this.options.binaryPath ? 'rust' : 'unavailable', error: message, usage: this.usage(),
    };
  }
  private async native(command: NativeCommand, payload?: unknown, repositoryRoot?: string): Promise<NativeSnapshot> {
    if (!this.options.binaryPath) throw new CompanyError('Rust core is not built. Run npm run build:native or use a complete desktop package.', 'CORE_UNAVAILABLE');
    return this.execute(this.options.binaryPath, {
      command, payload, stateDir: path.join(this.options.userDataPath, 'company'), seedDir: this.options.seedDir,
      ...(repositoryRoot ? { repositoryRoot } : {}),
    });
  }
  private serial(action: () => Promise<CompanySnapshot>): Promise<CompanySnapshot> {
    const next = this.queue.then(action, action).catch((error: unknown) => this.failure(error));
    this.queue = next;
    return next;
  }
  companySnapshot(): Promise<CompanySnapshot> { return this.serial(async () => this.decorate(await this.native('snapshot'))); }

  private async register(repoUrl: string, current: NativeSnapshot): Promise<CompanySnapshot> {
    const target = normalizeGitHubRepository(repoUrl);
    if (!current.company || target.owner.toLowerCase() !== current.company.owner.toLowerCase() || target.repo.toLowerCase() !== current.company.repo.toLowerCase()) {
      throw new CompanyError('Choose the repository assigned to this company workspace.');
    }
    let metadata: Record<string, unknown>;
    try { metadata = await inspectGitHubRepository(target.repoUrl, this.options.fetch); }
    catch (error) {
      const message = error instanceof CompanyError ? error.message : 'GitHub repository check failed.';
      return this.decorate(await this.native('record_github_check', { ok: false, error: message, checkedAt: new Date().toISOString() }), message);
    }
    return this.decorate(await this.native('register_company', metadata));
  }
  registerCompany(request: RegisterCompanyRequest): Promise<CompanySnapshot> {
    return this.serial(async () => {
      const current = await this.native('snapshot'); this.cached = current;
      return this.register(normalizeGitHubRepository(request?.repoUrl).repoUrl, current);
    });
  }
  refreshCompany(): Promise<CompanySnapshot> {
    return this.serial(async () => {
      const current = await this.native('snapshot'); this.cached = current;
      if (!current.company) throw new CompanyError('No company workspace is configured.');
      return this.register(current.company.repoUrl, current);
    });
  }
  updateCompanyTask(request: UpdateCompanyTaskRequest): Promise<CompanySnapshot> {
    return this.serial(async () => {
      if (!request || typeof request.id !== 'string' || !['todo', 'in-progress', 'blocked', 'done'].includes(request.status)
        || (request.evidence !== undefined && typeof request.evidence !== 'string')) throw new CompanyError('Invalid roadmap task update.');
      // Only these fields cross into Rust; never spread untrusted renderer objects.
      return this.decorate(await this.native('update_task', { id: request.id, status: request.status, ...(request.evidence === undefined ? {} : { evidence: request.evidence }) }));
    });
  }
  indexCompanyRepository(): Promise<CompanySnapshot> {
    return this.serial(async () => {
      const current = await this.native('snapshot'); this.cached = current;
      const root = this.options.repositoryRoot ?? current.index?.root ?? await this.options.pickRepository?.();
      if (!root) throw new CompanyError('Choose a local checkout to index. The public GitHub connection does not download source files.', 'NO_REPOSITORY');
      return this.decorate(await this.native('index_repository', undefined, root));
    });
  }
}
