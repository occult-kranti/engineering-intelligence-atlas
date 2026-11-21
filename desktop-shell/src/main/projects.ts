import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type {
  ArtifactMeta,
  BudgetLimits,
  CreateProjectRequest,
  PriceRates,
  Project,
  ProjectNode,
  ProjectNodeDraft,
  ProjectProvider,
  ProjectRun,
  RunNodeState,
  TerminationReason,
  UsageTotals,
} from '../shared/contract';
import { resolveContainedPath } from './paths';

/**
 * Local Projects: text-only specialist squads (Director/Research/Build/Review
 * or user-edited nodes) executed against a user-selected provider/model.
 *
 *  - No code execution, no tool use, no external writes: the only side
 *    effects are provider generation calls and JSON/Markdown persistence
 *    under `userData/projects/`.
 *  - Hard budgets: per-run AND per-node max tokens / max minutes / max USD,
 *    computed with user-provided price rates. Termination preserves all
 *    partial artifacts.
 *  - No secrets are ever written here: prompts, outputs, usage, and metadata
 *    only. API keys are resolved per call by the IPC layer and never stored
 *    in projects, runs, events, or artifacts.
 */

export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const MAX_NAME = 120;
const MAX_GOAL = 8000;
const MAX_INSTRUCTIONS = 4000;
const MAX_NODES = 12;
const MAX_MODEL_ID = 200;

const DEFAULT_NODE_BUDGET: BudgetLimits = { maxTokens: 8192, maxMinutes: 5, maxUsd: 0.5 };
const MAX_RUN_BUDGET: BudgetLimits = { maxTokens: 20_000_000, maxMinutes: 24 * 60, maxUsd: 1000 };

const ROLE_PROMPTS: Record<string, string> = {
  director:
    'You are the Director of a small specialist squad. Break the goal into a clear plan with concrete deliverables and acceptance criteria. Be concise and specific. Plain text only.',
  research:
    'You are the Research specialist. Investigate the goal using only the context provided. Produce factual, well-organized findings with explicit uncertainties. Plain text only.',
  build:
    'You are the Build specialist. Produce the concrete deliverable (text only: outlines, specs, drafts, plans — never code to execute) based on the plan and research provided.',
  review:
    'You are the Review specialist. Critically evaluate the deliverables from the other squad members against the goal. List strengths, gaps, and a final verdict. Plain text only.',
  custom: 'You are a specialist on a small squad. Complete your task based on the goal and context provided. Plain text only.',
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function validateBudget(budget: unknown, label: string, ceiling: BudgetLimits = MAX_RUN_BUDGET): BudgetLimits {
  if (!isRecord(budget)) throw new Error(`${label} budget must be an object`);
  const b = budget as Record<string, unknown>;
  const out: BudgetLimits = {
    maxTokens: Number(b.maxTokens),
    maxMinutes: Number(b.maxMinutes),
    maxUsd: Number(b.maxUsd),
  };
  for (const [key, value] of Object.entries(out) as [keyof BudgetLimits, number][]) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}.${key} must be a positive finite number`);
    if (value > ceiling[key]) throw new Error(`${label}.${key} exceeds the hard ceiling of ${ceiling[key]}`);
  }
  return out;
}

export function validatePriceRates(rates: unknown): PriceRates {
  if (!isRecord(rates)) throw new Error('priceRates must be an object');
  const r = rates as Record<string, unknown>;
  const out: PriceRates = {
    inputUsdPerMillion: Number(r.inputUsdPerMillion),
    outputUsdPerMillion: Number(r.outputUsdPerMillion),
  };
  for (const [key, value] of Object.entries(out)) {
    if (!Number.isFinite(value) || value < 0 || value > 100_000) {
      throw new Error(`priceRates.${key} must be a finite number between 0 and 100000`);
    }
  }
  return out;
}

function validateProvider(provider: unknown): ProjectProvider {
  if (provider === 'openai' || provider === 'anthropic' || provider === 'ollama') return provider;
  throw new Error('provider must be one of: openai, anthropic, ollama');
}

/** Default Director → Research → Build → Review squad for a goal. */
export function defaultSquad(): ProjectNodeDraft[] {
  return [
    { role: 'director', title: 'Director', instructions: 'Turn the goal into a concrete plan: 3-6 deliverables with acceptance criteria, assigned to the squad roles.', dependsOn: [] },
    { role: 'research', title: 'Research', instructions: 'Research the goal and the Director plan. Produce organized findings and flag uncertainties.', dependsOn: [0] },
    { role: 'build', title: 'Build', instructions: 'Using the plan and research, produce the main text deliverable for the goal.', dependsOn: [0, 1] },
    { role: 'review', title: 'Review', instructions: 'Review the deliverable against the goal. List strengths, gaps, and give a final verdict.', dependsOn: [2] },
  ];
}

/** Topological order (Kahn). Throws on cycles or unknown dependencies. */
export function topoSort(nodes: ProjectNode[]): ProjectNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indegree = new Map<string, number>();
  for (const n of nodes) {
    let deg = 0;
    for (const dep of n.dependsOn) {
      if (!byId.has(dep)) throw new Error(`node "${n.id}" depends on unknown node "${dep}"`);
      if (dep === n.id) throw new Error(`node "${n.id}" depends on itself`);
      deg += 1;
    }
    indegree.set(n.id, deg);
  }
  const ready = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const order: ProjectNode[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as string;
    const node = byId.get(id) as ProjectNode;
    order.push(node);
    for (const n of nodes) {
      if (n.dependsOn.includes(id)) {
        const d = (indegree.get(n.id) as number) - 1;
        indegree.set(n.id, d);
        if (d === 0) ready.push(n.id);
      }
    }
  }
  if (order.length !== nodes.length) throw new Error('node dependency graph has a cycle');
  return order;
}

function zeroUsage(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, costUsd: 0 };
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function atomicWrite(filePath: string, contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filePath);
}

/** Persistence for non-secret projects/runs/events/artifacts under userData. */
export class ProjectStore {
  private readonly root: string;

  constructor(userDataPath: string) {
    this.root = path.join(userDataPath, 'projects');
    fs.mkdirSync(this.root, { recursive: true });
  }

  private assertId(id: unknown, label: string): string {
    if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new Error(`invalid ${label}`);
    return id;
  }

  projectDir(projectId: string): string {
    return resolveContainedPath(this.root, this.assertId(projectId, 'project id'));
  }

  private runDir(projectId: string, runId: string): string {
    return resolveContainedPath(path.join(this.projectDir(projectId), 'runs'), this.assertId(runId, 'run id'));
  }

  createProject(req: CreateProjectRequest): Project {
    if (!isRecord(req)) throw new Error('request must be an object');
    const name = String(req.name ?? '').trim();
    if (name.length === 0 || name.length > MAX_NAME) throw new Error(`name must be 1..${MAX_NAME} characters`);
    const goal = String(req.goal ?? '').trim();
    if (goal.length === 0 || goal.length > MAX_GOAL) throw new Error(`goal must be 1..${MAX_GOAL} characters`);
    const provider = validateProvider(req.provider);
    const model = String(req.model ?? '').trim();
    if (model.length === 0 || model.length > MAX_MODEL_ID) throw new Error('model must be selected or entered explicitly');

    const drafts = req.nodes === undefined ? defaultSquad() : req.nodes;
    if (!Array.isArray(drafts) || drafts.length === 0 || drafts.length > MAX_NODES) {
      throw new Error(`nodes must be an array of 1..${MAX_NODES} entries`);
    }
    const roles = new Set(['director', 'research', 'build', 'review', 'custom']);
    const nodes: ProjectNode[] = drafts.map((draft, i) => {
      if (!isRecord(draft)) throw new Error(`node ${i + 1} must be an object`);
      const role = String(draft.role ?? 'custom');
      if (!roles.has(role)) throw new Error(`node ${i + 1} has invalid role "${role}"`);
      const title = String(draft.title ?? '').trim();
      if (title.length === 0 || title.length > 80) throw new Error(`node ${i + 1} title must be 1..80 characters`);
      const instructions = String(draft.instructions ?? '').trim();
      if (instructions.length === 0 || instructions.length > MAX_INSTRUCTIONS) {
        throw new Error(`node ${i + 1} instructions must be 1..${MAX_INSTRUCTIONS} characters`);
      }
      const id = `node-${i + 1}`;
      if (!Array.isArray(draft.dependsOn)) throw new Error(`node ${i + 1} dependsOn must be an array`);
      // Drafts reference dependencies by draft index (number) or role title
      // equality is not required; indices are unambiguous.
      const dependsOn = draft.dependsOn.map((d) => {
        if (typeof d === 'number' && Number.isInteger(d) && d >= 0 && d < drafts.length && d !== i) return `node-${d + 1}`;
        if (typeof d === 'string' && SAFE_ID.test(d)) return d;
        throw new Error(`node ${i + 1} has an invalid dependency reference`);
      });
      const budget =
        draft.budget === undefined
          ? { ...DEFAULT_NODE_BUDGET }
          : { ...DEFAULT_NODE_BUDGET, ...validateBudget({ ...DEFAULT_NODE_BUDGET, ...draft.budget }, `node ${i + 1}`) };
      return {
        id,
        role: role as ProjectNode['role'],
        title,
        instructions,
        dependsOn,
        status: 'pending' as const,
        budget,
      };
    });
    topoSort(nodes); // validate graph eagerly

    const now = new Date().toISOString();
    const project: Project = {
      id: `proj-${crypto.randomUUID()}`,
      name,
      goal,
      provider,
      model,
      nodes,
      createdAt: now,
      updatedAt: now,
    };
    // Project ids are UUIDs, always SAFE_ID-compatible.
    atomicWrite(path.join(this.projectDir(project.id), 'project.json'), JSON.stringify(project, null, 2));
    return project;
  }

  listProjects(): Project[] {
    let dirs: fs.Dirent[];
    try {
      dirs = fs.readdirSync(this.root, { withFileTypes: true });
    } catch {
      return [];
    }
    const projects: Project[] = [];
    for (const dir of dirs) {
      if (!dir.isDirectory() || !SAFE_ID.test(dir.name)) continue;
      const project = this.getProject(dir.name);
      if (project) projects.push(project);
    }
    return projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getProject(projectId: string): Project | null {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(this.projectDir(projectId), 'project.json'), 'utf8')) as Project;
      if (!isRecord(raw) || typeof raw.id !== 'string' || !Array.isArray(raw.nodes)) return null;
      return raw;
    } catch {
      return null;
    }
  }

  saveRun(run: ProjectRun): void {
    atomicWrite(path.join(this.runDir(run.projectId, run.id), 'run.json'), JSON.stringify(run, null, 2));
  }

  getRun(projectId: string, runId: string): ProjectRun | null {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(this.runDir(projectId, runId), 'run.json'), 'utf8')) as ProjectRun;
      if (!isRecord(raw) || typeof raw.id !== 'string') return null;
      return raw;
    } catch {
      return null;
    }
  }

  listRuns(projectId?: string): ProjectRun[] {
    const projectIds = projectId !== undefined ? [this.assertId(projectId, 'project id')] : this.listProjects().map((p) => p.id);
    const runs: ProjectRun[] = [];
    for (const pid of projectIds) {
      let dirs: fs.Dirent[];
      try {
        dirs = fs.readdirSync(path.join(this.projectDir(pid), 'runs'), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const dir of dirs) {
        if (!dir.isDirectory() || !SAFE_ID.test(dir.name)) continue;
        const run = this.getRun(pid, dir.name);
        if (run) runs.push(run);
      }
    }
    return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Append an event to the run log. Whitelisted fields only — no secrets. */
  appendEvent(projectId: string, runId: string, event: { event: string; nodeId?: string; status?: string; detail?: string }): void {
    try {
      const safe = {
        ts: new Date().toISOString(),
        runId,
        event: String(event.event),
        ...(event.nodeId !== undefined ? { nodeId: String(event.nodeId) } : {}),
        ...(event.status !== undefined ? { status: String(event.status) } : {}),
        ...(event.detail !== undefined ? { detail: String(event.detail).slice(0, 300) } : {}),
      };
      const file = path.join(this.runDir(projectId, runId), 'events.jsonl');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, JSON.stringify(safe) + '\n', 'utf8');
    } catch {
      // Event logging must never crash a run.
    }
  }

  writeArtifact(input: {
    projectId: string;
    runId: string;
    node: ProjectNode;
    provider: ProjectProvider;
    model: string;
    prompt: string;
    text: string;
    usage: UsageTotals;
  }): ArtifactMeta {
    const meta: ArtifactMeta = {
      artifactId: `${input.node.id}.md`,
      projectId: input.projectId,
      runId: input.runId,
      nodeId: input.node.id,
      role: input.node.role,
      provider: input.provider,
      model: input.model,
      createdAt: new Date().toISOString(),
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      costUsd: input.usage.costUsd,
      promptSha256: sha256(input.prompt),
      textSha256: sha256(input.text),
    };
    const dir = path.join(this.runDir(input.projectId, input.runId), 'artifacts');
    const header = `<!-- artifact: ${meta.artifactId} run: ${meta.runId} node: ${meta.nodeId} provider: ${meta.provider} model: ${meta.model} sha256: ${meta.textSha256} -->\n`;
    atomicWrite(path.join(dir, `${input.node.id}.md`), header + input.text);
    atomicWrite(path.join(dir, `${input.node.id}.meta.json`), JSON.stringify(meta, null, 2));
    return meta;
  }

  readArtifact(projectId: string, runId: string, nodeId: string): { text: string; meta: ArtifactMeta } | null {
    const safeNode = this.assertId(nodeId, 'node id');
    const dir = path.join(this.runDir(projectId, runId), 'artifacts');
    try {
      const text = fs.readFileSync(path.join(dir, `${safeNode}.md`), 'utf8');
      const meta = JSON.parse(fs.readFileSync(path.join(dir, `${safeNode}.meta.json`), 'utf8')) as ArtifactMeta;
      return { text, meta };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Run engine
// ---------------------------------------------------------------------------

export interface RunnerGenerateRequest {
  provider: ProjectProvider;
  model: string;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  abortSignal: AbortSignal;
  billing?: { inputUsdPerMillion: number; outputUsdPerMillion: number; source: string };
}

export interface RunnerGenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  usageObserved?: boolean;
}

export type GenerateFn = (req: RunnerGenerateRequest) => Promise<RunnerGenerateResult>;

interface RunControl {
  controller: AbortController;
  paused: boolean;
  pauseWaiters: Array<() => void>;
  /** The live run object mutated by the execution loop (single writer). */
  run: ProjectRun | null;
}

export interface RunnerDeps {
  /** Wall-clock milliseconds; injectable for deterministic tests. */
  now?: () => number;
}

export class ProjectRunner extends EventEmitter {
  private controls = new Map<string, RunControl>();
  private readonly now: () => number;

  constructor(
    private readonly store: ProjectStore,
    private readonly generateFn: GenerateFn,
    deps: RunnerDeps = {},
  ) {
    super();
    this.now = deps.now ?? Date.now;
    this.reconcileOrphans();
  }

  /** Runs left 'running'/'paused' by a previous process are cancelled; artifacts remain. */
  private reconcileOrphans(): void {
    for (const run of this.store.listRuns()) {
      if (run.status === 'running' || run.status === 'paused') {
        run.status = 'cancelled';
        run.error = 'Interrupted: the app was closed while this run was active.';
        run.finishedAt = new Date().toISOString();
        run.updatedAt = run.finishedAt;
        this.store.saveRun(run);
        this.store.appendEvent(run.projectId, run.id, { event: 'run-cancelled', detail: 'orphaned run reconciled' });
      }
    }
  }

  getRun(projectId: string, runId: string): ProjectRun | null {
    return this.store.getRun(projectId, runId);
  }

  private emitRun(run: ProjectRun): void {
    this.emit('run', JSON.parse(JSON.stringify(run)) as ProjectRun);
  }

  private saveAndEmit(run: ProjectRun): void {
    run.updatedAt = new Date().toISOString();
    this.store.saveRun(run);
    this.emitRun(run);
  }

  start(projectId: string, runBudgetRaw: unknown, priceRatesRaw: unknown): { ok: boolean; runId?: string; error?: string } {
    try {
      const runBudget = validateBudget(runBudgetRaw, 'run');
      const priceRates = validatePriceRates(priceRatesRaw);
      const project = this.store.getProject(projectId);
      if (!project) return { ok: false, error: 'unknown project id' };
      if (project.provider !== 'ollama' && (priceRates.inputUsdPerMillion <= 0 || priceRates.outputUsdPerMillion <= 0)) {
        return { ok: false, error: 'Cloud runs require positive input and output prices to enforce the USD budget.' };
      }
      const active = this.store
        .listRuns(project.id)
        .find((r) => r.status === 'running' || r.status === 'paused');
      if (active) return { ok: false, error: `project already has an active run (${active.id})` };

      const now = new Date().toISOString();
      const nodeStates: Record<string, RunNodeState> = {};
      for (const node of project.nodes) {
        nodeStates[node.id] = {
          status: 'pending',
          usage: zeroUsage(),
          artifactId: null,
          error: null,
          startedAt: null,
          finishedAt: null,
        };
      }
      const run: ProjectRun = {
        id: `run-${crypto.randomUUID()}`,
        projectId: project.id,
        status: 'running',
        terminationReason: null,
        error: null,
        runBudget,
        priceRates,
        usage: { ...zeroUsage(), elapsedSeconds: 0 },
        nodeStates,
        createdAt: now,
        updatedAt: now,
        finishedAt: null,
      };
      const control: RunControl = { controller: new AbortController(), paused: false, pauseWaiters: [], run };
      this.controls.set(run.id, control);
      this.store.saveRun(run);
      this.store.appendEvent(run.projectId, run.id, { event: 'run-started' });
      this.emitRun(run);
      // Fire-and-forget; all state is observable via persisted run + events.
      void this.execute(run, control).finally(() => this.controls.delete(run.id));
      return { ok: true, runId: run.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  pause(runId: string): { ok: boolean; error?: string } {
    const control = this.controls.get(runId);
    if (!control) return { ok: false, error: 'no active run with that id' };
    control.paused = true;
    // Mutate the live run object (the execution loop's single copy).
    const run = control.run ?? this.findActiveRun(runId);
    if (run && (run.status === 'running' || run.status === 'paused')) {
      run.status = 'paused';
      this.store.appendEvent(run.projectId, run.id, { event: 'run-paused' });
      this.saveAndEmit(run);
    }
    return { ok: true };
  }

  resume(runId: string): { ok: boolean; error?: string } {
    const control = this.controls.get(runId);
    if (!control) return { ok: false, error: 'no active run with that id' };
    control.paused = false;
    for (const wake of control.pauseWaiters.splice(0)) wake();
    const run = control.run ?? this.findActiveRun(runId);
    if (run && run.status === 'paused') {
      run.status = 'running';
      this.store.appendEvent(run.projectId, run.id, { event: 'run-resumed' });
      this.saveAndEmit(run);
    }
    return { ok: true };
  }

  cancel(runId: string): { ok: boolean; error?: string } {
    const control = this.controls.get(runId);
    if (!control) return { ok: false, error: 'no active run with that id' };
    control.paused = false;
    for (const wake of control.pauseWaiters.splice(0)) wake();
    control.controller.abort(new Error('cancelled by user'));
    return { ok: true };
  }

  private findActiveRun(runId: string): ProjectRun | null {
    for (const project of this.store.listProjects()) {
      const run = this.store.getRun(project.id, runId);
      if (run) return run;
    }
    return null;
  }

  private async waitIfPaused(control: RunControl): Promise<void> {
    while (control.paused && !control.controller.signal.aborted) {
      await new Promise<void>((resolve) => control.pauseWaiters.push(resolve));
    }
  }

  private async execute(run: ProjectRun, control: RunControl): Promise<void> {
    const project = this.store.getProject(run.projectId);
    if (!project) {
      run.status = 'failed';
      run.error = 'project disappeared';
      this.finish(run);
      return;
    }
    const startedMs = this.now();
    let ordered: ProjectNode[];
    try {
      ordered = topoSort(project.nodes);
    } catch (err) {
      run.status = 'failed';
      run.error = err instanceof Error ? err.message : String(err);
      this.finish(run);
      return;
    }

    let terminated: TerminationReason = null;
    let cancelled = false;
    let anyFailed = false;

    let pausedMs = 0;
    const waitForResume = async () => { const began = this.now(); await this.waitIfPaused(control); pausedMs += this.now() - began; };
    const elapsedMinutes = () => (this.now() - startedMs - pausedMs) / 60000;
    const usedTokens = () => run.usage.inputTokens + run.usage.outputTokens;
    const costOf = (u: UsageTotals) =>
      (u.inputTokens * run.priceRates.inputUsdPerMillion + u.outputTokens * run.priceRates.outputUsdPerMillion) / 1_000_000;

    for (let nodeIndex = 0; nodeIndex < ordered.length; nodeIndex++) {
      const node = ordered[nodeIndex]!;
      const state = run.nodeStates[node.id] as RunNodeState;
      if (cancelled || terminated !== null) break;
      if (state.status !== 'pending') continue;

      // Dependency gate: skip nodes whose dependencies did not succeed.
      const depsOk = node.dependsOn.every((dep) => run.nodeStates[dep]?.status === 'succeeded');
      if (!depsOk) {
        state.status = 'skipped';
        this.store.appendEvent(run.projectId, run.id, { event: 'node-skipped', nodeId: node.id, detail: 'dependency did not succeed' });
        this.saveAndEmit(run);
        continue;
      }

      // Pause gate (checked between nodes; cancel wins).
      await waitForResume();
      if (control.controller.signal.aborted) {
        cancelled = true;
        break;
      }

      // Pre-node budget checks (run-level).
      if (usedTokens() >= run.runBudget.maxTokens) { terminated = 'max-tokens'; break; }
      if (elapsedMinutes() >= run.runBudget.maxMinutes) { terminated = 'max-minutes'; break; }
      if (run.usage.costUsd >= run.runBudget.maxUsd) { terminated = 'max-usd'; break; }

      const tokenAllowance = Math.min(node.budget.maxTokens, run.runBudget.maxTokens - usedTokens());
      if (tokenAllowance <= 0) { terminated = 'max-tokens'; break; }
      const minuteAllowance = Math.min(node.budget.maxMinutes, run.runBudget.maxMinutes - elapsedMinutes());
      if (minuteAllowance <= 0) { terminated = 'max-minutes'; break; }

      const prompt = this.buildPrompt(project, node, run);
      const system = ROLE_PROMPTS[node.role] ?? (ROLE_PROMPTS.custom as string);
      const reservedInputTokens = Buffer.byteLength(system + prompt, 'utf8') + 256;
      if (reservedInputTokens >= node.budget.maxTokens) {
        state.status = 'failed';
        state.error = 'node max-tokens budget cannot contain the input context';
        state.finishedAt = new Date().toISOString();
        anyFailed = true;
        this.store.appendEvent(run.projectId, run.id, { event: 'node-failed', nodeId: node.id, detail: state.error });
        this.saveAndEmit(run);
        continue;
      }
      let outputAllowance = Math.floor(tokenAllowance - reservedInputTokens);
      if (outputAllowance < 1) { terminated = 'max-tokens'; break; }
      if (project.provider !== 'ollama') {
        const usdAllowance = Math.min(node.budget.maxUsd, run.runBudget.maxUsd - run.usage.costUsd);
        const inputReservation = reservedInputTokens * run.priceRates.inputUsdPerMillion / 1_000_000;
        const affordableOutput = Math.floor((usdAllowance - inputReservation) * 1_000_000 / run.priceRates.outputUsdPerMillion);
        if (affordableOutput < 1) { terminated = 'max-usd'; break; }
        outputAllowance = Math.min(outputAllowance, affordableOutput);
      }

      state.status = 'running';
      state.startedAt = new Date().toISOString();
      this.store.appendEvent(run.projectId, run.id, { event: 'node-started', nodeId: node.id });
      this.saveAndEmit(run);

      // Input and maximum output are reserved before any billable dispatch.

      const nodeController = new AbortController();
      const onRunAbort = () => nodeController.abort(control.controller.signal.reason ?? new Error('cancelled'));
      control.controller.signal.addEventListener('abort', onRunAbort, { once: true });
      const timer = setTimeout(() => nodeController.abort(new Error('node exceeded max-minutes')), minuteAllowance * 60_000);

      try {
        const result = await this.generateFn({
          provider: project.provider,
          model: project.model,
          system,
          prompt,
          maxOutputTokens: outputAllowance,
          abortSignal: nodeController.signal,
          billing: { ...run.priceRates, source: `project:${project.id}` },
        });
        clearTimeout(timer);
        control.controller.signal.removeEventListener('abort', onRunAbort);

        const usageObserved = result.usageObserved !== false && [result.inputTokens, result.outputTokens].every(n => Number.isSafeInteger(n) && n >= 0);
        const usage: UsageTotals = {
          inputTokens: usageObserved ? result.inputTokens : reservedInputTokens,
          outputTokens: usageObserved ? result.outputTokens : outputAllowance,
          costUsd: 0,
        };
        usage.costUsd = costOf(usage);
        state.usage = usage;

        // Persist the artifact FIRST so partial progress survives termination.
        const meta = this.store.writeArtifact({
          projectId: project.id,
          runId: run.id,
          node,
          provider: project.provider,
          model: project.model,
          prompt,
          text: result.text,
          usage,
        });
        state.artifactId = meta.artifactId;

        run.usage.inputTokens += usage.inputTokens;
        run.usage.outputTokens += usage.outputTokens;
        run.usage.costUsd = costOf(run.usage);
        run.usage.elapsedSeconds = Math.round(this.now() - startedMs) / 1000;

        if (!usageObserved) {
          state.status = 'failed';
          state.error = 'Provider usage is unavailable. Deliverable preserved; conservative reservation retained for reconciliation.';
          state.finishedAt = new Date().toISOString();
          anyFailed = true;
          this.store.appendEvent(run.projectId, run.id, { event: 'node-failed', nodeId: node.id, detail: state.error });
          this.saveAndEmit(run);
          // Do not spend again while the cost of the previous request is unknown.
          break;
        }

        // Per-node budget enforcement (post-call: token/cost truth arrives with usage).
        const nodeTokens = usage.inputTokens + usage.outputTokens;
        if (nodeTokens > node.budget.maxTokens) {
          state.status = 'failed';
          state.error = `node exceeded its max-tokens budget (${nodeTokens} > ${node.budget.maxTokens})`;
          state.finishedAt = new Date().toISOString();
          anyFailed = true;
          this.store.appendEvent(run.projectId, run.id, { event: 'node-failed', nodeId: node.id, detail: state.error });
          this.saveAndEmit(run);
          continue;
        }
        if (usage.costUsd > node.budget.maxUsd) {
          state.status = 'failed';
          state.error = `node exceeded its max-usd budget ($${usage.costUsd.toFixed(4)} > $${node.budget.maxUsd})`;
          state.finishedAt = new Date().toISOString();
          anyFailed = true;
          this.store.appendEvent(run.projectId, run.id, { event: 'node-failed', nodeId: node.id, detail: state.error });
          this.saveAndEmit(run);
          continue;
        }

        state.status = 'succeeded';
        state.finishedAt = new Date().toISOString();
        this.store.appendEvent(run.projectId, run.id, { event: 'node-succeeded', nodeId: node.id });
        this.saveAndEmit(run);

        // Post-node run-level budget enforcement (terminate after preserving artifacts).
        if (usedTokens() >= run.runBudget.maxTokens) { terminated = 'max-tokens'; break; }
        if (run.usage.costUsd >= run.runBudget.maxUsd) { terminated = 'max-usd'; break; }
        if (elapsedMinutes() >= run.runBudget.maxMinutes) { terminated = 'max-minutes'; break; }
      } catch (err) {
        clearTimeout(timer);
        control.controller.signal.removeEventListener('abort', onRunAbort);
        if (control.controller.signal.aborted) {
          state.status = 'pending';
          state.startedAt = null;
          cancelled = true;
          this.saveAndEmit(run);
          break;
        }
        if (err && typeof err === 'object' && 'code' in err && err.code === 'GLOBAL_BUDGET_PAUSED') {
          state.status = 'pending'; state.startedAt = null; state.error = 'Waiting for global budget; no request was sent.';
          control.paused = true; run.status = 'paused';
          this.store.appendEvent(run.projectId, run.id, { event: 'run-paused', detail: state.error });
          this.saveAndEmit(run);
          await waitForResume();
          nodeIndex -= 1;
          continue;
        }
        const reason = err instanceof Error ? err.message : String(err);
        if (nodeController.signal.aborted && /max-minutes/.test(reason)) {
          state.status = 'failed';
          state.error = 'node exceeded its max-minutes budget';
          state.finishedAt = new Date().toISOString();
          this.store.appendEvent(run.projectId, run.id, { event: 'node-failed', nodeId: node.id, detail: state.error });
          this.saveAndEmit(run);
          terminated = 'max-minutes';
          break;
        }
        state.status = 'failed';
        state.error = reason.slice(0, 300);
        state.finishedAt = new Date().toISOString();
        anyFailed = true;
        this.store.appendEvent(run.projectId, run.id, { event: 'node-failed', nodeId: node.id, detail: state.error });
        this.saveAndEmit(run);
      }
    }

    if (cancelled || control.controller.signal.aborted) {
      run.status = 'cancelled';
      run.error = null;
      this.store.appendEvent(run.projectId, run.id, { event: 'run-cancelled' });
    } else if (terminated !== null) {
      run.status = 'terminated';
      run.terminationReason = terminated;
      this.store.appendEvent(run.projectId, run.id, { event: 'run-terminated', detail: terminated });
    } else if (anyFailed) {
      run.status = 'failed';
      this.store.appendEvent(run.projectId, run.id, { event: 'run-failed' });
    } else {
      run.status = 'completed';
      this.store.appendEvent(run.projectId, run.id, { event: 'run-completed' });
    }
    run.usage.elapsedSeconds = Math.round((this.now() - startedMs) / 10) / 100;
    this.finish(run);
  }

  private finish(run: ProjectRun): void {
    run.finishedAt = new Date().toISOString();
    this.saveAndEmit(run);
  }

  private buildPrompt(project: Project, node: ProjectNode, run: ProjectRun): string {
    const parts: string[] = [
      `Project: ${project.name}`,
      ``,
      `Goal:`,
      project.goal,
      ``,
      `Your task (${node.title}):`,
      node.instructions,
    ];
    for (const depId of node.dependsOn) {
      const depNode = project.nodes.find((n) => n.id === depId);
      const depState = run.nodeStates[depId];
      if (!depNode || depState?.artifactId === null || depState === undefined) continue;
      const artifact = this.store.readArtifact(project.id, run.id, depId);
      if (artifact) {
        parts.push(``, `--- Output from ${depNode.title} (${depId}) ---`, artifact.text);
      }
    }
    return parts.join('\n');
  }
}
