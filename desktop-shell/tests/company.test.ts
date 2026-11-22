import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CompanyService, executeNativeCore, inspectGitHubRepository, normalizeGitHubRepository, summarizeCompanyUsage, type GitHubFetch } from '../src/main/company';
import { OfficeService } from '../src/main/office';
import type { OfficeSnapshot } from '../src/shared/office';
import type { ProjectRun } from '../src/shared/contract';

const repoRoot = path.resolve(__dirname, '..', '..');
const binary = path.join(repoRoot, 'desktop-shell', 'native', process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core');
const seedDir = path.join(repoRoot, 'company');
const temporary: string[] = [];
function userData(): string { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-company-test-')); temporary.push(dir); return dir; }
afterEach(() => { for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

const repositoryUrl = 'https://github.com/occult-kranti/engineering-intelligence-atlas';
const metadata = { full_name: 'occult-kranti/engineering-intelligence-atlas', default_branch: 'main', description: 'Repository fixture', stargazers_count: 2, open_issues_count: 1, pushed_at: '2026-11-20T00:00:00Z' };
const commit = { sha: '0123456789012345678901234567890123456789' };
const goodFetch: GitHubFetch = async (url) => Response.json(url.includes('/git/ref/') ? { object: commit } : metadata);

describe('public GitHub company inspection', () => {
  it('normalizes repository URLs and refuses credentials, foreign hosts and nested paths', () => {
    expect(normalizeGitHubRepository(repositoryUrl + '.git/').repoUrl).toBe(repositoryUrl);
    for (const value of ['http://github.com/a/b', 'https://github.com.evil/a/b', 'https://secret@github.com/a/b', `${repositoryUrl}/tree/main`, `${repositoryUrl}?token=secret`, 'https://github.com/a/%2e%2e', 'file:///tmp/repo']) {
      expect(() => normalizeGitHubRepository(value)).toThrow();
    }
  });
  it('reads real-shaped metadata and the default-branch commit via a fixed API origin', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const result = await inspectGitHubRepository(repositoryUrl, async (url, init) => { requests.push({ url, init }); return goodFetch(url, init); });
    expect(result.headSha).toBe(commit.sha);
    expect(requests.map(r => r.url)).toEqual([
      'https://api.github.com/repos/occult-kranti/engineering-intelligence-atlas',
      'https://api.github.com/repos/occult-kranti/engineering-intelligence-atlas/git/ref/heads/main',
    ]);
    for (const request of requests) { expect(request.init.method).toBe('GET'); expect(request.init.redirect).toBe('error'); expect(JSON.stringify(request.init.headers)).not.toMatch(/authorization/i); }
  });
  it('does not accept another repository, an invalid commit, or a rate-limited response', async () => {
    await expect(inspectGitHubRepository(repositoryUrl, async () => Response.json({ ...metadata, full_name: 'somebody/else' }))).rejects.toThrow(/match/);
    await expect(inspectGitHubRepository(repositoryUrl, async (url) => Response.json(url.includes('/git/ref/') ? { object: { sha: 'wrong' } } : metadata))).rejects.toThrow(/commit/);
    await expect(inspectGitHubRepository(repositoryUrl, async () => new Response('hidden response', { status: 429 }))).rejects.toThrow(/rate-limited/);
  });
  it('caps metadata body size', async () => {
    await expect(inspectGitHubRepository(repositoryUrl, async () => new Response('x'.repeat(1_048_577)))).rejects.toThrow(/1 MiB/);
  });
});

describe('company usage and unavailable states', () => {
  it('reports only actual local run records and does not count invalid numbers', () => {
    const usage = summarizeCompanyUsage([
      { status: 'completed', usage: { inputTokens: 20, outputTokens: 10, costUsd: 0.02 } },
      { status: 'failed', usage: { inputTokens: 5, outputTokens: Number.NaN, costUsd: -1 } },
    ] as ProjectRun[]);
    expect(usage).toEqual({ inputTokens: 25, outputTokens: 10, costUsd: 0.02, runCount: 2, completedRuns: 1, failedRuns: 1, source: 'local-project-runs' });
  });
  it('never fakes a connected company if the binary is missing', async () => {
    const service = new CompanyService({ userDataPath: userData(), seedDir, binaryPath: null, listRuns: () => [] });
    const result = await service.companySnapshot();
    expect(result.available).toBe(false); expect(result.backend).toBe('unavailable'); expect(result.company).toBeNull(); expect(result.error).toMatch(/not built/);
  });
});

describe('compiled Rust / desktop bridge integration', () => {
  it('requires the release core in the desktop package input', () => {
    expect(fs.existsSync(binary), 'Run npm run build:native before desktop tests').toBe(true);
  });
  it('registers verified metadata, persists the company, and protects the automated task', async () => {
    const dir = userData();
    const service = new CompanyService({ userDataPath: dir, seedDir, binaryPath: binary, listRuns: () => [], fetch: goodFetch });
    expect((await service.companySnapshot()).company?.githubStatus).toBe('unchecked');
    const registered = await service.registerCompany({ repoUrl: repositoryUrl });
    expect(registered.error).toBeNull(); expect(registered.company?.githubStatus).toBe('verified'); expect(registered.company?.headSha).toBe(commit.sha);
    expect(registered.tasks.find(t => t.id === 'github-register')?.status).toBe('done');
    const afterRestart = new CompanyService({ userDataPath: dir, seedDir, binaryPath: binary, listRuns: () => [] });
    expect((await afterRestart.companySnapshot()).company?.headSha).toBe(commit.sha);
    expect((await service.updateCompanyTask({ id: 'github-register', status: 'done', evidence: 'pretend' })).error).toMatch(/verified GitHub/);
  });
  it('records failed connection checks without claiming registration succeeded', async () => {
    const service = new CompanyService({ userDataPath: userData(), seedDir, binaryPath: binary, listRuns: () => [], fetch: async () => new Response('private', { status: 404 }) });
    const failed = await service.registerCompany({ repoUrl: repositoryUrl });
    expect(failed.company?.githubStatus).toBe('error'); expect(failed.company?.registeredAt).toBeNull(); expect(failed.error).toMatch(/not found/);
    expect(failed.tasks.find(t => t.id === 'github-register')?.status).toBe('todo');
  });
  it('preserves corrupt state and does not silently reset it', async () => {
    const dir = userData(); const service = new CompanyService({ userDataPath: dir, seedDir, binaryPath: binary, listRuns: () => [] });
    await service.companySnapshot(); const file = path.join(dir, 'company', 'company-state.json'); fs.writeFileSync(file, 'broken');
    expect((await service.companySnapshot()).error).toMatch(/invalid|preserved/); expect(fs.readFileSync(file, 'utf8')).toBe('broken');
  });
  it('shares office state across service instances, fences renderer worker commands, and claims once', async () => {
    const dir = userData(); const first = new OfficeService({ userDataPath: dir, seedDir, binaryPath: binary });
    const initial = await first.officeSnapshot(); expect(initial.ok).toBe(true);
    const state = initial.snapshot!;
    expect(state.employees.some(e => e.id === 'donna')).toBe(true);
    const office = state.offices.find(o => o.companyId === state.activeCompanyId)!;
    const queued = await first.officeCommand({ action: 'enqueue_job', companyId: state.activeCompanyId, officeId: office.id, employeeId: 'donna', goal: 'Inspect a result', mode: 'manual', maxTokens: 1000, maxUsd: 0, maxMinutes: 1, idempotencyKey: 'first-test-job' });
    expect(queued.ok).toBe(true);
    expect((await first.officeCommand({ action: 'claim_job', workerId: 'renderer' })).code).toBe('WORKER_ONLY');
    const second = new OfficeService({ userDataPath: dir, seedDir, binaryPath: binary });
    expect((await second.officeSnapshot()).snapshot?.jobs).toHaveLength(2);
    expect((await second.officeSnapshot()).snapshot?.schemaVersion).toBe(2);
    expect((await first.officeCommand({action:'record_step_review',jobId:'forged',leaseToken:'forged'})).code).toBe('WORKER_ONLY');
    expect((await first.officeCommand({action:'record_review_failure',jobId:'forged',leaseToken:'forged',reason:'malformed-output'})).code).toBe('WORKER_ONLY');
    const claims = await Promise.all([first.workerCommand({ action: 'claim_job', workerId: 'one' }), second.workerCommand({ action: 'claim_job', workerId: 'two' })]);
    const claimed = claims.filter(c => c.ok && c.snapshot?.lastAction?.jobId);
    expect(claimed).toHaveLength(1);
    const current = await second.officeSnapshot(); expect(current.snapshot?.jobs.filter(j => j.status === 'running')).toHaveLength(1);
  });
  it('writes office changes under the same locked state file used by headless commands', async () => {
    const dir = userData(); const service = new OfficeService({ userDataPath: dir, seedDir, binaryPath: binary });
    await service.officeCommand({ action: 'create_company', name: 'Local test company', repoUrl: 'https://github.com/example/project' });
    const native = await executeNativeCore<OfficeSnapshot>(binary, { command: 'office_snapshot', stateDir: path.join(dir, 'company'), seedDir });
    expect(native.companies.some(c => c.name === 'Local test company')).toBe(true);
    expect(native.offices).toHaveLength(2); expect(native.departments).toHaveLength(4);
  });
});
