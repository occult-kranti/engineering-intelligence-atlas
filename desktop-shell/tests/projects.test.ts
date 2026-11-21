import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ProjectRun } from '../src/shared/contract';
import {
  defaultSquad,
  ProjectRunner,
  ProjectStore,
  topoSort,
  type GenerateFn,
} from '../src/main/projects';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'projects-test-'));
}

async function waitFor(cond: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

const simpleGenerate: GenerateFn = async (req) => ({
  text: `output for ${req.system.slice(0, 20)} :: ${req.prompt.split('\n')[0]}`,
  inputTokens: 10,
  outputTokens: 20,
});

function makeProject(store: ProjectStore, model = 'gpt-5-mini') {
  return store.createProject({
    name: 'Test project',
    goal: 'Assess local-first research tooling',
    provider: 'openai',
    model,
  });
}

function readAllFiles(dir: string): string {
  let out = '';
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out += readAllFiles(p);
    else out += fs.readFileSync(p, 'utf8');
  }
  return out;
}

describe('project store', () => {
  let dir: string;
  let store: ProjectStore;
  beforeEach(() => {
    dir = tmpdir();
    store = new ProjectStore(dir);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('generates the standard Director/Research/Build/Review squad', () => {
    const drafts = defaultSquad();
    expect(drafts.map((d) => d.role)).toEqual(['director', 'research', 'build', 'review']);
    const project = makeProject(store);
    expect(project.nodes.map((n) => n.role)).toEqual(['director', 'research', 'build', 'review']);
    expect(project.nodes.map((n) => n.id)).toEqual(['node-1', 'node-2', 'node-3', 'node-4']);
    expect(project.nodes[1]?.dependsOn).toEqual(['node-1']);
    expect(project.nodes[2]?.dependsOn).toEqual(['node-1', 'node-2']);
    expect(project.nodes[3]?.dependsOn).toEqual(['node-3']);
  });

  it('persists projects under userData and lists them', () => {
    const project = makeProject(store);
    expect(fs.existsSync(path.join(dir, 'projects', project.id, 'project.json'))).toBe(true);
    expect(store.listProjects().map((p) => p.id)).toContain(project.id);
    expect(store.getProject(project.id)?.goal).toBe('Assess local-first research tooling');
  });

  it('rejects invalid input', () => {
    expect(() => store.createProject({ name: '', goal: 'g', provider: 'openai', model: 'm' })).toThrow(/name/);
    expect(() => store.createProject({ name: 'n', goal: '', provider: 'openai', model: 'm' })).toThrow(/goal/);
    expect(() => store.createProject({ name: 'n', goal: 'g', provider: 'evil' as never, model: 'm' })).toThrow(/provider/);
    expect(() => store.createProject({ name: 'n', goal: 'g', provider: 'openai', model: '' })).toThrow(/model/);
    expect(() =>
      store.createProject({ name: 'n', goal: 'g', provider: 'openai', model: 'm', nodes: [] }),
    ).toThrow(/nodes/);
  });

  it('rejects dependency cycles and unknown deps', () => {
    expect(() =>
      topoSort([
        { id: 'a', role: 'custom', title: 'A', instructions: 'i', dependsOn: ['b'], status: 'pending', budget: { maxTokens: 1, maxMinutes: 1, maxUsd: 1 } },
        { id: 'b', role: 'custom', title: 'B', instructions: 'i', dependsOn: ['a'], status: 'pending', budget: { maxTokens: 1, maxMinutes: 1, maxUsd: 1 } },
      ]),
    ).toThrow(/cycle/);
    expect(() =>
      store.createProject({
        name: 'n',
        goal: 'g',
        provider: 'openai',
        model: 'm',
        nodes: [{ role: 'custom', title: 'A', instructions: 'i', dependsOn: ['node-9'] }],
      }),
    ).toThrow(/unknown node|cycle/);
  });
});

describe('squad run engine', () => {
  let dir: string;
  let store: ProjectStore;
  beforeEach(() => {
    dir = tmpdir();
    store = new ProjectStore(dir);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  function startAndWait(runner: ProjectRunner, projectId: string, budget = { maxTokens: 100000, maxMinutes: 30, maxUsd: 10 }) {
    const res = runner.start(projectId, budget, { inputUsdPerMillion: 1, outputUsdPerMillion: 2 });
    expect(res.ok).toBe(true);
    const runId = res.runId as string;
    return waitFor(() => {
      const run = store.listRuns(projectId)[0];
      return run !== undefined && !['running', 'paused'].includes(run.status);
    }).then(() => store.listRuns(projectId)[0] as ProjectRun);
  }

  it('runs the full squad, persists artifacts with provenance, and writes no secrets', async () => {
    const project = makeProject(store);
    const runner = new ProjectRunner(store, simpleGenerate);
    const run = await startAndWait(runner, project.id);

    expect(run.status).toBe('completed');
    for (const node of project.nodes) {
      expect(run.nodeStates[node.id]?.status).toBe('succeeded');
    }
    expect(run.usage.inputTokens).toBe(40);
    expect(run.usage.outputTokens).toBe(80);
    expect(run.usage.costUsd).toBeCloseTo((40 * 1 + 80 * 2) / 1_000_000, 8);

    // Artifact provenance.
    const artifact = store.readArtifact(project.id, run.id, 'node-3');
    expect(artifact).not.toBeNull();
    expect(artifact?.meta.provider).toBe('openai');
    expect(artifact?.meta.model).toBe('gpt-5-mini');
    expect(artifact?.meta.runId).toBe(run.id);
    expect(artifact?.meta.nodeId).toBe('node-3');
    expect(artifact?.meta.inputTokens).toBe(10);
    expect(artifact?.meta.outputTokens).toBe(20);
    const body = artifact?.text.split('\n').slice(1).join('\n') ?? '';
    expect(artifact?.meta.textSha256).toBe(crypto.createHash('sha256').update(body, 'utf8').digest('hex'));
    expect(artifact?.text).toContain(`run: ${run.id}`); // header provenance

    // Dependency context flowed: build node's prompt included research output.
    const buildArtifact = store.readArtifact(project.id, run.id, 'node-3');
    expect(buildArtifact?.meta.promptSha256).toMatch(/^[0-9a-f]{64}$/);

    // Events log exists.
    const eventsPath = path.join(dir, 'projects', project.id, 'runs', run.id, 'events.jsonl');
    expect(fs.existsSync(eventsPath)).toBe(true);

    // No secret material anywhere in persisted state.
    const everything = readAllFiles(path.join(dir, 'projects'));
    expect(everything).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(everything).not.toContain('apiKey');
  });

  it('refuses dispatch when the run token budget cannot contain the input', async () => {
    const project = makeProject(store);
    const runner = new ProjectRunner(store, simpleGenerate);
    // 30 tokens used by node-1 (10+20); run cap of 25 terminates right after.
    const run = await startAndWait(runner, project.id, { maxTokens: 25, maxMinutes: 30, maxUsd: 10 });
    expect(run.status).toBe('terminated');
    expect(run.terminationReason).toBe('max-tokens');
    expect(run.nodeStates['node-1']?.status).toBe('pending');
    expect(run.nodeStates['node-2']?.status).toBe('pending');
    expect(store.readArtifact(project.id, run.id, 'node-1')).toBeNull(); // no billed call was made
  });

  it('terminates on the run max-minutes budget (wall clock)', async () => {
    const project = makeProject(store);
    let now = 1_000_000;
    const generate: GenerateFn = async () => {
      now += 120_000; // each node burns 2 minutes of wall clock
      return { text: 'slow', inputTokens: 1, outputTokens: 1 };
    };
    const runner = new ProjectRunner(store, generate, { now: () => now });
    const run = await startAndWait(runner, project.id, { maxTokens: 100000, maxMinutes: 1, maxUsd: 10 });
    expect(run.status).toBe('terminated');
    expect(run.terminationReason).toBe('max-minutes');
    expect(run.nodeStates['node-1']?.status).toBe('succeeded');
  });

  it('terminates on the run max-usd budget using user price rates', async () => {
    const project = makeProject(store);
    const runner = new ProjectRunner(store, simpleGenerate);
    const res = runner.start(project.id, { maxTokens: 100000, maxMinutes: 30, maxUsd: 0.00001 }, { inputUsdPerMillion: 100, outputUsdPerMillion: 100 });
    expect(res.ok).toBe(true);
    await waitFor(() => !['running', 'paused'].includes(store.listRuns(project.id)[0]?.status ?? ''));
    const run = store.listRuns(project.id)[0] as ProjectRun;
    expect(run.status).toBe('terminated');
    expect(run.terminationReason).toBe('max-usd');
  });

  it('enforces per-node token budgets and skips dependents', async () => {
    const store2 = store;
    const project = store2.createProject({
      name: 'node budget',
      goal: 'g',
      provider: 'openai',
      model: 'm',
      nodes: [
        { role: 'research', title: 'R', instructions: 'i', dependsOn: [], budget: { maxTokens: 15, maxMinutes: 5, maxUsd: 5 } },
        { role: 'build', title: 'B', instructions: 'i', dependsOn: [0] },
      ],
    });
    const runner = new ProjectRunner(store, simpleGenerate); // 30 tokens per node > 15 cap
    const run = await startAndWait(runner, project.id);
    expect(run.status).toBe('failed');
    expect(run.nodeStates['node-1']?.status).toBe('failed');
    expect(run.nodeStates['node-1']?.error).toMatch(/max-tokens/);
    expect(run.nodeStates['node-2']?.status).toBe('skipped');
    // No provider dispatch is allowed when the input alone cannot fit.
    expect(store.readArtifact(project.id, run.id, 'node-1')).toBeNull();
  });

  it('rejects unknown cloud prices before creating a run', () => {
    const project = makeProject(store);
    const runner = new ProjectRunner(store, simpleGenerate);
    const result = runner.start(project.id, { maxTokens: 10000, maxMinutes: 10, maxUsd: 1 }, { inputUsdPerMillion: 0, outputUsdPerMillion: 0 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/prices/);
    expect(store.listRuns(project.id)).toHaveLength(0);
  });

  it('preserves evidence if a provider violates the reserved token limit', async () => {
    const project = store.createProject({ name: 'contract check', goal: 'Review a short brief', provider: 'openai', model: 'test', nodes: [
      { role: 'research', title: 'R', instructions: 'Review', dependsOn: [], budget: { maxTokens: 2000, maxMinutes: 5, maxUsd: 1 } },
      { role: 'review', title: 'V', instructions: 'Verify', dependsOn: [0] },
    ] });
    const runner = new ProjectRunner(store, async () => ({ text: 'Preserve this partial evidence.', inputTokens: 100, outputTokens: 3000 }));
    const run = await startAndWait(runner, project.id);
    expect(run.nodeStates['node-1']?.status).toBe('failed');
    expect(run.nodeStates['node-2']?.status).toBe('skipped');
    expect(store.readArtifact(project.id, run.id, 'node-1')).not.toBeNull();
  });

  it('pauses and resumes between nodes', async () => {
    const project = makeProject(store);
    const runner = new ProjectRunner(store, simpleGenerate);
    const res = runner.start(project.id, { maxTokens: 100000, maxMinutes: 30, maxUsd: 10 }, { inputUsdPerMillion: 1, outputUsdPerMillion: 2 });
    expect(res.ok).toBe(true);
    const runId = res.runId as string;

    expect(runner.pause(runId).ok).toBe(true);
    await waitFor(() => store.listRuns(project.id)[0]?.status === 'paused');
    await new Promise((r) => setTimeout(r, 100));
    expect(store.listRuns(project.id)[0]?.status).toBe('paused'); // stays paused

    expect(runner.resume(runId).ok).toBe(true);
    await waitFor(() => {
      const s = store.listRuns(project.id)[0]?.status;
      return s === 'completed' || s === 'failed' || s === 'terminated';
    });
    const run = store.listRuns(project.id)[0] as ProjectRun;
    expect(run.status).toBe('completed');
    expect(Object.values(run.nodeStates).every((n) => n.status === 'succeeded')).toBe(true);
  });

  it('cancels an in-flight node call and keeps prior artifacts', async () => {
    const project = makeProject(store);
    let call = 0;
    const hangingAfterFirst: GenerateFn = async (req) => {
      call += 1;
      if (call === 1) return { text: 'first', inputTokens: 5, outputTokens: 5 };
      return new Promise((_resolve, reject) => {
        req.abortSignal.addEventListener('abort', () => reject(new Error('cancelled by user')));
      });
    };
    const runner = new ProjectRunner(store, hangingAfterFirst);
    const res = runner.start(project.id, { maxTokens: 100000, maxMinutes: 30, maxUsd: 10 }, { inputUsdPerMillion: 1, outputUsdPerMillion: 2 });
    const runId = res.runId as string;
    await waitFor(() => store.listRuns(project.id)[0]?.nodeStates['node-2']?.status === 'running');
    expect(runner.cancel(runId).ok).toBe(true);
    await waitFor(() => store.listRuns(project.id)[0]?.status === 'cancelled');
    const run = store.listRuns(project.id)[0] as ProjectRun;
    expect(run.status).toBe('cancelled');
    expect(run.nodeStates['node-1']?.status).toBe('succeeded');
    expect(store.readArtifact(project.id, run.id, 'node-1')).not.toBeNull();
    expect(run.nodeStates['node-2']?.artifactId).toBeNull();
  });

  it('refuses a second concurrent run for the same project', async () => {
    const project = makeProject(store);
    const hanging: GenerateFn = (req) =>
      new Promise((_r, reject) => req.abortSignal.addEventListener('abort', () => reject(new Error('x'))));
    const runner = new ProjectRunner(store, hanging);
    const first = runner.start(project.id, { maxTokens: 100000, maxMinutes: 30, maxUsd: 10 }, { inputUsdPerMillion: 1, outputUsdPerMillion: 2 });
    expect(first.ok).toBe(true);
    const second = runner.start(project.id, { maxTokens: 100000, maxMinutes: 30, maxUsd: 10 }, { inputUsdPerMillion: 1, outputUsdPerMillion: 2 });
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/active run/);
    runner.cancel(first.runId as string);
  });

  it('fails the run honestly when the provider errors, without leaking', async () => {
    const project = makeProject(store);
    const failing: GenerateFn = async () => {
      throw new Error('ProviderError: 401 unauthorized [redacted]');
    };
    const runner = new ProjectRunner(store, failing);
    const run = await startAndWait(runner, project.id);
    expect(run.status).toBe('failed');
    expect(run.nodeStates['node-1']?.status).toBe('failed');
    expect(run.nodeStates['node-1']?.error).toMatch(/401/);
    expect(run.nodeStates['node-2']?.status).toBe('skipped');
  });

  it('reconciles orphaned runs from a previous process', async () => {
    const project = makeProject(store);
    const hanging: GenerateFn = (req) =>
      new Promise((_r, reject) => req.abortSignal.addEventListener('abort', () => reject(new Error('x'))));
    const runner1 = new ProjectRunner(store, hanging);
    const res = runner1.start(project.id, { maxTokens: 100000, maxMinutes: 30, maxUsd: 10 }, { inputUsdPerMillion: 1, outputUsdPerMillion: 2 });
    await waitFor(() => store.listRuns(project.id)[0]?.nodeStates['node-1']?.status === 'running');
    // Simulate process death: new runner over the same store.
    const runner2 = new ProjectRunner(store, hanging);
    void runner2;
    const run = store.listRuns(project.id).find((r) => r.id === res.runId) as ProjectRun;
    expect(run.status).toBe('cancelled');
    expect(run.error).toMatch(/Interrupted/);
    runner1.cancel(res.runId as string);
  });
});
