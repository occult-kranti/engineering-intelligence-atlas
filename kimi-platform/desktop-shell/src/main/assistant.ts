import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import {
  ASSISTANT_ACTION_POLICIES,
  ASSISTANT_ACTIONS,
  ASSISTANT_CONTRACT_VERSION,
  ASSISTANT_DEFINITIONS,
  ASSISTANT_GATES,
  ASSISTANT_JOB_POLICIES,
  ASSISTANT_SCHEDULE_BOUNDS,
  AssistantContractError,
  AssistantJobSchema,
  buildCacheInvalidationReport,
  buildDonnaPrompt,
  buildKnowledgeTransfer,
  buildStudyQueue,
  createAssistantJob,
  createAssistantProposal,
  createQueueItem,
  reorderQueueItems,
  routeRepository,
  scheduleNextRun,
  validateAssistantAction,
  validateRepositoryIntake,
  EMERGENCY_STOP_ACTION_ID,
  STUDY_QUEUE_CAP,
  type AssistantAction,
  type AssistantActionProposal,
  type AssistantDefinition,
  type AssistantGate,
  type AssistantJob,
  type AssistantQueueItem,
  type AssistantScope,
  type AssistantWorkQueue,
  type CacheInvalidationReport,
  type CacheNamespace,
  type CompanyLifecycleStatus,
  type DepartmentLifecycleStatus,
  type DonnaPrompt,
  type GithubIntakeMode,
  type KnowledgeTransferRecord,
  type RepoAssignmentPlan,
  type RepositoryMetadata,
  type StudyQueueItem,
} from '../shared/assistant';
import {
  canonicalJson,
  sha256Hex,
  EnterpriseKeySchema,
  type ArtifactRef,
} from '../shared/enterprise';
import type { EnterpriseProgramRunner, EnterpriseStore } from './enterprises';
import type { ProjectStore } from './projects';
import type { SkillRegistry } from './skills';
import {
  classifyGithubMetaError,
  fetchGithubRepoMetadata,
  GithubMetaCache,
  GithubMetaError,
  MAX_SELECTED_REPOSITORIES,
  type GithubFetchFn,
} from './githubMeta';

/**
 * v0.6 Donna / shared assistants — desktop backend (Slice C).
 *
 * AssistantStore persists per-enterprise assistant state under
 * `userData/enterprises/<enterpriseId>/assistant/`:
 *   state.json    — atomic (tmp+rename) snapshot with its own OCC `version`
 *                   and append `eventSeq`: proposals, generic work queues,
 *                   jobs/schedules, study queue, repository metadata +
 *                   assignment plans, knowledge transfers, lifecycle status.
 *   events.jsonl  — append-only audit ledger (seq, ts, event, detail).
 *   exports/      — knowledge transfer exports (json + markdown).
 *
 * Hard guarantees:
 *  - Proposals: typed, content-hash ids (idempotent re-propose), payloadHash
 *    integrity, policy-derived risk/approval, gate confirmations enforced in
 *    code by validateAssistantAction (never by prompt text). Donna chat text
 *    is parsed into DRAFT proposals only — model output is never executed.
 *  - OCC: enterprise-targeting actions carry the enterprise record version
 *    and pass it straight into existing EnterpriseStore methods; assistant-
 *    local actions check the assistant state version. Stale => conflict.
 *  - Executors map ONLY to existing methods: EnterpriseStore (contracts,
 *    suspension, release/drain, caches, exports), EnterpriseProgramRunner
 *    (pump), ProjectStore (artifact ref integrity), ChatManager (Donna chat
 *    sessions via the existing chat channels; emergency stop = existing
 *    program cancel / chat stop, ungated, NEVER a proposal).
 *  - Fire/archive: drain + preserveArtifacts required by policy; execution
 *    reuses existing suspend/release drain semantics. Artifacts, ledger and
 *    events are never deleted.
 *  - Scheduler: unref'd interval (>= 60s) + boot reconciliation; missed runs
 *    skipped forward (no storm, no replay); maxRuns terminator; zero budget;
 *    jobs never run while the program is cancelled; every job effect is
 *    deterministic, free, and provider-free (program_pump_mock is inert on
 *    desktop because the desktop has no mock program mode — an approved,
 *    gated program.pump proposal is the only pump path).
 *  - GitHub: tokenless public metadata only (githubMeta.ts); private reads
 *    stay web-only behind credential + approval. Repositories cap at 50.
 *  - No secrets, no artifact bodies (ArtifactRef only), no chain-of-thought
 *    anywhere: bounded outcome-level summaries only.
 */

const MAX_PROPOSALS = 500;
const MAX_QUEUES = 32;
const MAX_QUEUE_ITEMS = 200;
const MAX_JOBS = 64;
const MAX_STUDY_ITEMS = 256;
const MAX_TRANSFERS = 200;
const MAX_EVENT_DETAIL = 300;

/** Actions whose OCC token is the ENTERPRISE record version. */
const ENTERPRISE_VERSIONED_ACTIONS: ReadonlySet<AssistantAction> = new Set([
  'worker.hire',
  'worker.pause',
  'worker.resume',
  'worker.fire',
  'department.pause',
  'department.resume',
  'department.archive',
  'company.pause',
  'company.resume',
  'company.archive',
  'program.pump',
  'cache.invalidate',
]);

const REPO_ACTIONS: ReadonlySet<AssistantAction> = new Set([
  'repository.import',
  'repository.assign',
  'repository.propose_structure',
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function atomicWrite(filePath: string, contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filePath);
}

function appendLine(filePath: string, line: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, line + '\n', 'utf8');
}

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------
// Persisted shapes
// ---------------------------------------------------------------------------

export interface StoredRepository {
  metadata: RepositoryMetadata;
  plan: RepoAssignmentPlan;
  intakeMode: GithubIntakeMode;
  appliedAt: number | null;
  appliedBy: string | null;
}

export interface AssistantQueueState {
  queue: AssistantWorkQueue;
  items: AssistantQueueItem[];
}

export interface AssistantState {
  contractVersion: typeof ASSISTANT_CONTRACT_VERSION;
  enterpriseId: string;
  /** OCC token for assistant-local actions; bumped on content mutations. */
  version: number;
  eventSeq: number;
  proposals: AssistantActionProposal[];
  queues: Record<string, AssistantQueueState>;
  jobs: Record<string, AssistantJob>;
  studyItems: Record<string, StudyQueueItem>;
  repositories: Record<string, StoredRepository>;
  transfers: Record<string, KnowledgeTransferRecord>;
  lifecycle: {
    companies: Record<string, CompanyLifecycleStatus>;
    departments: Record<string, DepartmentLifecycleStatus>;
  };
  /**
   * proposalId -> gates the human explicitly confirmed at decide time.
   * Execution re-validates against THIS record (never fabricated).
   */
  gateConfirmations: Record<string, AssistantGate[]>;
}

export interface AssistantEventRecord {
  seq: number;
  ts: string;
  event: string;
  detail?: string;
}

export interface AssistantEventPush {
  enterpriseId: string;
  version: number;
  eventSeq: number;
  event: string;
  detail?: string;
}

function emptyState(enterpriseId: string): AssistantState {
  return {
    contractVersion: ASSISTANT_CONTRACT_VERSION,
    enterpriseId,
    version: 1,
    eventSeq: 0,
    proposals: [],
    queues: {},
    jobs: {},
    studyItems: {},
    repositories: {},
    transfers: {},
    lifecycle: { companies: {}, departments: {} },
    gateConfirmations: {},
  };
}

/** Deterministic, content-derived proposal id: identical re-proposes dedupe. */
export function assistantProposalId(input: {
  enterpriseId: string;
  scope: AssistantScope;
  actor: string;
  action: string;
  payloadHash: string;
}): string {
  return `ast-${sha256Hex(canonicalJson(input)).slice(0, 24)}`;
}

function repoKey(url: string): string {
  return sha256Hex(url).slice(0, 16);
}

// ---------------------------------------------------------------------------
// AssistantStore
// ---------------------------------------------------------------------------

export interface AssistantStoreDeps {
  enterprises: EnterpriseStore;
  runner: EnterpriseProgramRunner;
  projects: ProjectStore;
  skills?: { registry: SkillRegistry; root: string } | null;
  github?: { fetchFn?: GithubFetchFn; timeoutMs?: number };
  /** Wall-clock ms; injectable for deterministic tests. */
  now?: () => number;
}

export class AssistantStore extends EventEmitter {
  private readonly root: string;
  private readonly enterprises: EnterpriseStore;
  private readonly runner: EnterpriseProgramRunner;
  private readonly projects: ProjectStore;
  private readonly skills: { registry: SkillRegistry; root: string } | null;
  private readonly github: { fetchFn?: GithubFetchFn; timeoutMs?: number };
  private readonly now: () => number;
  /** Process-local "repository-metadata" cache namespace. */
  readonly repoMetaCache = new GithubMetaCache();

  constructor(userDataPath: string, deps: AssistantStoreDeps) {
    super();
    this.root = path.join(userDataPath, 'enterprises');
    fs.mkdirSync(this.root, { recursive: true });
    this.enterprises = deps.enterprises;
    this.runner = deps.runner;
    this.projects = deps.projects;
    this.skills = deps.skills ?? null;
    this.github = deps.github ?? {};
    this.now = deps.now ?? Date.now;
  }

  // ------------------------------------------------------------- persistence

  private safeEnterpriseId(id: unknown): string {
    if (typeof id !== 'string' || !/^ent-[a-z0-9][a-z0-9-]{0,62}$/.test(id)) {
      throw new Error('invalid enterprise id');
    }
    return id;
  }

  private dir(enterpriseId: string): string {
    const id = this.safeEnterpriseId(enterpriseId);
    const resolved = path.resolve(this.root, id, 'assistant');
    if (!resolved.startsWith(path.resolve(this.root) + path.sep)) throw new Error('invalid enterprise id');
    return resolved;
  }

  private statePath(enterpriseId: string): string {
    return path.join(this.dir(enterpriseId), 'state.json');
  }

  private eventsPath(enterpriseId: string): string {
    return path.join(this.dir(enterpriseId), 'events.jsonl');
  }

  /**
   * Load assistant state. A missing file yields null; a CORRUPT file is
   * quarantined aside (state.corrupt.json) and yields null — recovery starts
   * from a fresh empty state, never from partial data.
   */
  private load(enterpriseId: string): AssistantState | null {
    let raw: string;
    try {
      raw = fs.readFileSync(this.statePath(enterpriseId), 'utf8');
    } catch {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as AssistantState;
      if (
        !isRecord(parsed) ||
        parsed.enterpriseId !== enterpriseId ||
        !Number.isInteger(parsed.version) ||
        !Number.isInteger(parsed.eventSeq) ||
        !Array.isArray(parsed.proposals) ||
        !isRecord(parsed.queues) ||
        !isRecord(parsed.jobs) ||
        !isRecord(parsed.studyItems) ||
        !isRecord(parsed.repositories) ||
        !isRecord(parsed.transfers) ||
        !isRecord(parsed.lifecycle)
      ) {
        throw new Error('shape mismatch');
      }
      if (!isRecord(parsed.gateConfirmations)) parsed.gateConfirmations = {};
      return parsed;
    } catch {
      try {
        fs.renameSync(this.statePath(enterpriseId), path.join(this.dir(enterpriseId), 'state.corrupt.json'));
      } catch {
        // best-effort quarantine only
      }
      return null;
    }
  }

  private loadOrEmpty(enterpriseId: string): AssistantState {
    return this.load(enterpriseId) ?? emptyState(enterpriseId);
  }

  private save(state: AssistantState): void {
    atomicWrite(this.statePath(state.enterpriseId), JSON.stringify(state, null, 2));
  }

  private appendEvent(state: AssistantState, event: string, detail?: string): void {
    state.eventSeq += 1;
    const entry: AssistantEventRecord = {
      seq: state.eventSeq,
      ts: nowIso(),
      event,
      ...(detail !== undefined ? { detail: detail.slice(0, MAX_EVENT_DETAIL) } : {}),
    };
    appendLine(this.eventsPath(state.enterpriseId), JSON.stringify(entry));
    this.emit('assistant', {
      enterpriseId: state.enterpriseId,
      version: state.version,
      eventSeq: state.eventSeq,
      event,
      ...(detail !== undefined ? { detail: detail.slice(0, MAX_EVENT_DETAIL) } : {}),
    } satisfies AssistantEventPush);
  }

  readEvents(enterpriseId: string, afterIndex = 0, limit = 1000): { events: AssistantEventRecord[]; nextIndex: number } {
    this.safeEnterpriseId(enterpriseId);
    let raw: string;
    try {
      raw = fs.readFileSync(this.eventsPath(enterpriseId), 'utf8');
    } catch {
      return { events: [], nextIndex: 0 };
    }
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    const start = Math.max(0, Math.min(afterIndex, lines.length));
    const slice = lines.slice(start, start + Math.max(1, Math.min(limit, 1000)));
    const events: AssistantEventRecord[] = [];
    for (const line of slice) {
      try {
        const parsed = JSON.parse(line) as AssistantEventRecord;
        if (Number.isInteger(parsed.seq) && typeof parsed.event === 'string') events.push(parsed);
      } catch {
        // skip corrupt line — the audit log read never throws
      }
    }
    return { events, nextIndex: start + events.length };
  }

  /** All enterprise ids that have assistant state on disk (scheduler). */
  listEnterpriseIds(): string[] {
    let dirs: fs.Dirent[];
    try {
      dirs = fs.readdirSync(this.root, { withFileTypes: true });
    } catch {
      return [];
    }
    return dirs
      .filter((d) => d.isDirectory() && /^ent-[a-z0-9][a-z0-9-]{0,62}$/.test(d.name))
      .filter((d) => fs.existsSync(path.join(this.root, d.name, 'assistant', 'state.json')))
      .map((d) => d.name);
  }

  // ------------------------------------------------------------------ reads

  definitions(): { definitions: AssistantDefinition[]; gates: readonly AssistantGate[]; actions: typeof ASSISTANT_ACTION_POLICIES } {
    return {
      definitions: Object.values(ASSISTANT_DEFINITIONS).map((d) => clone(d)),
      gates: ASSISTANT_GATES,
      actions: clone(ASSISTANT_ACTION_POLICIES),
    };
  }

  getState(enterpriseId: string): AssistantState {
    return clone(this.loadOrEmpty(this.safeEnterpriseId(enterpriseId)));
  }

  // -------------------------------------------------------------- proposals

  private currentToken(enterpriseId: string, action: AssistantAction, state: AssistantState): number {
    if (ENTERPRISE_VERSIONED_ACTIONS.has(action)) {
      const record = this.enterprises.get(enterpriseId);
      if (!record) throw new Error('unknown enterprise id');
      return record.version;
    }
    return state.version;
  }

  private assertOcc(enterpriseId: string, proposal: AssistantActionProposal, state: AssistantState): void {
    const current = this.currentToken(enterpriseId, proposal.action, state);
    if (current !== proposal.expectedVersion) {
      throw new Error(
        `version conflict: target state is at version ${current}, proposal expects ${proposal.expectedVersion}`,
      );
    }
  }

  /**
   * Create (or return the identical existing) proposal. Content-derived id
   * makes re-proposes idempotent; the proposal records the CURRENT OCC token
   * of its target state.
   */
  /**
   * Create (or reuse/re-open the identical) proposal INSIDE an already-loaded
   * state. The caller saves. Used by propose() and by deterministic job
   * effects (repository_sync drift), so a job sweep never loses updates by
   * writing a stale copy over a concurrent proposal write.
   */
  private createProposalInState(state: AssistantState, input: {
    scope: unknown;
    actor: unknown;
    action: unknown;
    payload: unknown;
  }): { ok: boolean; proposal?: AssistantActionProposal; created?: boolean; error?: string } {
    const id = state.enterpriseId;
    const action = String(input.action ?? '') as AssistantAction;
    if (!ASSISTANT_ACTIONS.includes(action)) {
      if (String(input.action ?? '') === EMERGENCY_STOP_ACTION_ID) {
        throw new AssistantContractError(
          'unknown-action',
          'emergency stop is not an assistant action: use the direct program-cancel / chat-stop controls',
        );
      }
      throw new AssistantContractError('unknown-action', `action "${String(input.action)}" is not in the closed action set`);
    }
    if (!isRecord(input.payload)) throw new Error('payload must be an object');
    const scope = input.scope;
    const actor = input.actor;
    if (scope !== 'enterprise' && scope !== 'company' && scope !== 'department' && scope !== 'office') {
      throw new Error('scope must be enterprise|company|department|office');
    }
    if (typeof actor !== 'string' || !(actor in ASSISTANT_DEFINITIONS)) throw new Error('unknown assistant actor');
    const payloadHash = sha256Hex(canonicalJson(input.payload));
    const proposalId = assistantProposalId({
      enterpriseId: id,
      scope,
      actor: actor as string,
      action,
      payloadHash,
    });
    const existing = state.proposals.find((p) => p.id === proposalId);
    if (existing) {
      if (existing.status === 'failed') {
        // Idempotent retry: identical payload re-proposed after a failure
        // re-opens the same proposal at the CURRENT OCC token.
        existing.status = 'proposed';
        existing.expectedVersion = this.currentToken(id, action, state);
        existing.proposedAt = this.now();
        existing.decidedAt = null;
        existing.executedAt = null;
        existing.resultSummary = '';
        this.appendEvent(state, 'assistant-reproposed', `${existing.action} (${existing.id})`);
        return { ok: true, proposal: clone(existing), created: true };
      }
      return { ok: true, proposal: clone(existing), created: false };
    }
    if (state.proposals.length >= MAX_PROPOSALS) {
      const terminalIndex = state.proposals.findIndex((p) => p.status === 'executed' || p.status === 'failed' || p.status === 'rejected' || p.status === 'cancelled');
      if (terminalIndex === -1) throw new Error(`proposal cap reached (${MAX_PROPOSALS}); decide or cancel pending proposals first`);
      state.proposals.splice(terminalIndex, 1);
    }
    const proposal = createAssistantProposal({
      id: proposalId,
      scope,
      actor: actor as keyof typeof ASSISTANT_DEFINITIONS,
      action,
      payload: clone(input.payload),
      expectedVersion: this.currentToken(id, action, state),
      proposedAt: this.now(),
    });
    // Structural integrity at intake (hash/policy/scope/forbidden keys).
    // Approval-gated actions throw only 'approval-required' here, which is
    // expected: approval happens at decide time.
    try {
      validateAssistantAction(proposal, null);
    } catch (err) {
      if (!(err instanceof AssistantContractError && err.code === 'approval-required')) throw err;
    }
    state.proposals.push(proposal);
    this.appendEvent(state, 'assistant-proposed', `${proposal.actor}:${proposal.action} (${proposal.id})`);
    return { ok: true, proposal: clone(proposal), created: true };
  }

  propose(enterpriseId: string, input: {
    scope: unknown;
    actor: unknown;
    action: unknown;
    payload: unknown;
  }): { ok: boolean; proposal?: AssistantActionProposal; created?: boolean; error?: string } {
    try {
      const id = this.safeEnterpriseId(enterpriseId);
      const state = this.loadOrEmpty(id);
      const result = this.createProposalInState(state, input);
      this.save(state);
      return result;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Record a human decision. Approving validates the full policy in code —
   * payload hash, closed action set, scope coverage, forbidden keys, drain+
   * preserve, OCC, and explicit confirmation of every policy gate.
   */
  decide(enterpriseId: string, input: {
    proposalId: unknown;
    decision: unknown;
    confirmedGates?: unknown;
  }): { ok: boolean; proposal?: AssistantActionProposal; error?: string } {
    try {
      const id = this.safeEnterpriseId(enterpriseId);
      const state = this.loadOrEmpty(id);
      const proposal = state.proposals.find((p) => p.id === input.proposalId);
      if (!proposal) throw new Error('unknown proposal id');
      if (proposal.status !== 'proposed') throw new Error(`proposal is "${proposal.status}"; only proposed proposals can be decided`);
      if (input.decision !== 'approved' && input.decision !== 'rejected') throw new Error('decision must be approved or rejected');
      const gates = Array.isArray(input.confirmedGates) ? (input.confirmedGates as AssistantGate[]) : [];
      this.assertOcc(id, proposal, state);
      validateAssistantAction(proposal, { approved: input.decision === 'approved', confirmedGates: gates });
      proposal.status = input.decision === 'approved' ? 'approved' : 'rejected';
      proposal.decidedAt = this.now();
      if (proposal.status === 'approved') state.gateConfirmations[proposal.id] = gates.filter((g) => (ASSISTANT_GATES as readonly string[]).includes(g));
      else delete state.gateConfirmations[proposal.id];
      this.appendEvent(state, `assistant-${proposal.status}`, `${proposal.action} (${proposal.id})`);
      this.save(state);
      return { ok: true, proposal: clone(proposal) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Execute a proposal. Approval-gated actions must be approved first;
   * approval-free actions may execute directly from 'proposed'. Idempotent:
   * an already-executed proposal returns ok without re-running. The exact
   * approved payloadHash + OCC token are re-validated before anything runs.
   */
  execute(enterpriseId: string, proposalId: unknown): { ok: boolean; proposal?: AssistantActionProposal; error?: string } {
    try {
      const id = this.safeEnterpriseId(enterpriseId);
      const state = this.loadOrEmpty(id);
      const proposal = state.proposals.find((p) => p.id === proposalId);
      if (!proposal) throw new Error('unknown proposal id');
      if (proposal.status === 'executed') return { ok: true, proposal: clone(proposal) };
      if (proposal.status === 'rejected' || proposal.status === 'cancelled') {
        throw new Error(`proposal is "${proposal.status}" and cannot be executed`);
      }
      const policy = ASSISTANT_ACTION_POLICIES[proposal.action];
      if (policy.requiresApproval && proposal.status !== 'approved') {
        throw new Error('proposal requires human approval before execution');
      }
      this.assertOcc(id, proposal, state);
      // Re-validate the exact approved payload at execution time against the
      // gates the human ACTUALLY confirmed at decide time (recorded then).
      const recordedGates = policy.requiresApproval ? state.gateConfirmations[proposal.id] ?? null : [];
      if (policy.requiresApproval && recordedGates === null) {
        throw new Error('no recorded gate confirmations for this approval; re-decide the proposal');
      }
      validateAssistantAction(proposal, { approved: true, confirmedGates: recordedGates ?? [] });
      const result = this.runExecutor(id, proposal, state);
      proposal.executedAt = this.now();
      if (result.ok) {
        proposal.status = 'executed';
        proposal.resultSummary = result.summary.slice(0, 2000);
        this.appendEvent(state, 'assistant-executed', `${proposal.action}: ${proposal.resultSummary.slice(0, 120)}`);
        delete state.gateConfirmations[proposal.id];
      } else {
        proposal.status = 'failed';
        proposal.resultSummary = result.summary.slice(0, 2000);
        this.appendEvent(state, 'assistant-failed', `${proposal.action}: ${proposal.resultSummary.slice(0, 120)}`);
      }
      this.save(state);
      return { ok: result.ok, proposal: clone(proposal), ...(result.ok ? {} : { error: result.summary }) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Cancel a not-yet-executed proposal (never executes anything). */
  cancel(enterpriseId: string, proposalId: unknown): { ok: boolean; proposal?: AssistantActionProposal; error?: string } {
    try {
      const id = this.safeEnterpriseId(enterpriseId);
      const state = this.loadOrEmpty(id);
      const proposal = state.proposals.find((p) => p.id === proposalId);
      if (!proposal) throw new Error('unknown proposal id');
      if (proposal.status === 'executed') throw new Error('an executed proposal cannot be cancelled');
      if (proposal.status === 'rejected' || proposal.status === 'cancelled') {
        return { ok: true, proposal: clone(proposal) };
      }
      proposal.status = 'cancelled';
      proposal.decidedAt = this.now();
      this.appendEvent(state, 'assistant-cancelled', `${proposal.action} (${proposal.id})`);
      this.save(state);
      return { ok: true, proposal: clone(proposal) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ---------------------------------------------------- direct (human) actions
  // Human-initiated drawer actions reuse the SAME policy pipeline: an ad-hoc
  // proposal is built, validated (gates included), OCC-checked and executed;
  // the audit trail is the events ledger + version bump. Nothing bypasses
  // validateAssistantAction, and emergency stop is never an action here.

  /**
   * Build + validate an ad-hoc proposal for a human-direct action (policy,
   * gates, OCC). Throws on any violation; returns the validated proposal.
   */
  private validateDirect(id: string, state: AssistantState, input: {
    scope: AssistantScope;
    action: AssistantAction;
    payload: Record<string, unknown>;
    expectedVersion: unknown;
    confirmed: unknown;
    confirmedGates?: unknown;
  }): AssistantActionProposal {
    if (!Number.isInteger(input.expectedVersion)) throw new Error('expectedVersion must be an integer');
    const actor = REPO_ACTIONS.has(input.action) ? 'repository-integration-steward' : 'donna';
    const proposal = createAssistantProposal({
      id: `direct-${assistantProposalId({
        enterpriseId: id,
        scope: input.scope,
        actor,
        action: input.action,
        payloadHash: sha256Hex(canonicalJson(input.payload)),
      })}`,
      scope: input.scope,
      actor,
      action: input.action,
      payload: input.payload,
      expectedVersion: input.expectedVersion as number,
      proposedAt: this.now(),
    });
    const gates = Array.isArray(input.confirmedGates) ? (input.confirmedGates as AssistantGate[]) : [];
    validateAssistantAction(proposal, { approved: input.confirmed === true, confirmedGates: gates });
    this.assertOcc(id, proposal, state);
    return proposal;
  }

  /**
   * Public entry for human-direct drawer actions (IPC): builds an ad-hoc
   * proposal, validates policy + gates + OCC via validateAssistantAction,
   * executes, and appends to the audit ledger. Nothing bypasses the pipeline.
   */
  direct(enterpriseId: string, input: {
    scope: AssistantScope;
    action: AssistantAction;
    payload: Record<string, unknown>;
    expectedVersion: unknown;
    confirmed: unknown;
    confirmedGates?: unknown;
  }): { ok: boolean; summary?: string; error?: string } {
    return this.directExecute(enterpriseId, input);
  }

  private directExecute(enterpriseId: string, input: {
    scope: AssistantScope;
    action: AssistantAction;
    payload: Record<string, unknown>;
    expectedVersion: unknown;
    confirmed: unknown;
    confirmedGates?: unknown;
  }): { ok: boolean; summary?: string; error?: string } {
    try {
      const id = this.safeEnterpriseId(enterpriseId);
      const state = this.loadOrEmpty(id);
      const proposal = this.validateDirect(id, state, input);
      const result = this.runExecutor(id, proposal, state);
      this.appendEvent(
        state,
        result.ok ? 'assistant-direct-executed' : 'assistant-direct-failed',
        `human-direct ${input.action}: ${result.summary.slice(0, 140)}`,
      );
      this.save(state);
      return { ok: result.ok, summary: result.summary, ...(result.ok ? {} : { error: result.summary }) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ------------------------------------------------------------- executors
  // Every executor maps to EXISTING EnterpriseStore / ProgramRunner /
  // ProjectStore / contract functions only. No provider calls, ever.

  private runExecutor(
    enterpriseId: string,
    proposal: AssistantActionProposal,
    state: AssistantState,
  ): { ok: boolean; summary: string } {
    try {
      const p = proposal.payload;
      switch (proposal.action) {
        case 'queue.add':
          return this.execQueueAdd(state, p);
        case 'queue.reorder':
          return this.execQueueReorder(state, p);
        case 'worker.hire':
          return this.execWorkerHire(enterpriseId, proposal.expectedVersion, p);
        case 'worker.pause':
          return this.execWorkerSuspend(enterpriseId, proposal.expectedVersion, p, true);
        case 'worker.resume':
          return this.execWorkerSuspend(enterpriseId, proposal.expectedVersion, p, false);
        case 'worker.fire':
          return this.execWorkerFire(enterpriseId, proposal.expectedVersion, p);
        case 'department.pause':
        case 'department.resume':
        case 'department.archive':
          return this.execLifecycle(enterpriseId, state, proposal.expectedVersion, 'department', proposal.action, p);
        case 'company.pause':
        case 'company.resume':
        case 'company.archive':
          return this.execLifecycle(enterpriseId, state, proposal.expectedVersion, 'company', proposal.action, p);
        case 'cache.invalidate':
          return this.execCacheInvalidate(enterpriseId, state, proposal.expectedVersion, p);
        case 'schedule.upsert':
          return this.execScheduleUpsert(state, p);
        case 'schedule.pause':
          return this.execScheduleEnabled(state, p, false);
        case 'schedule.resume':
          return this.execScheduleEnabled(state, p, true);
        case 'schedule.delete':
          return this.execScheduleDelete(state, p);
        case 'schedule.run_now':
          return this.execScheduleRunNow(enterpriseId, state, p);
        case 'study.enqueue':
          return this.execStudyEnqueue(state, p);
        case 'repository.import':
          return { ok: false, summary: 'repository.import requires the async fetch path (astRepoFetch)' };
        case 'repository.assign':
          return this.execRepoAssign(state, p);
        case 'repository.propose_structure':
          return this.execRepoProposeStructure(state, p);
        case 'knowledge.transfer':
          return this.execKnowledgeTransfer(enterpriseId, state, p);
        case 'program.pump':
          return this.execProgramPump(enterpriseId, proposal.expectedVersion);
        default:
          return { ok: false, summary: `no executor for action "${proposal.action}"` };
      }
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : String(err) };
    }
  }

  private bumpVersion(state: AssistantState): void {
    state.version += 1;
  }

  // --- queues -------------------------------------------------------------

  private execQueueAdd(state: AssistantState, p: Record<string, unknown>): { ok: boolean; summary: string } {
    const scope = p.scope;
    if (scope !== 'enterprise' && scope !== 'company' && scope !== 'department' && scope !== 'office') {
      throw new Error('queue scope must be enterprise|company|department|office');
    }
    const scopeKey = EnterpriseKeySchema.parse(p.scopeKey);
    const queueId = typeof p.queueId === 'string' && p.queueId.length > 0 ? p.queueId : `q-${scope}-${scopeKey}`;
    if (queueId.length > 80) throw new Error('queueId too long');
    if (!isRecord(p.item)) throw new Error('payload.item must be an object');
    const item = p.item;
    let entry = state.queues[queueId];
    if (!entry) {
      if (Object.keys(state.queues).length >= MAX_QUEUES) throw new Error(`queue cap reached (${MAX_QUEUES})`);
      entry = {
        queue: {
          contractVersion: ASSISTANT_CONTRACT_VERSION,
          id: queueId,
          scope,
          scopeKey,
          version: 1,
        },
        items: [],
      };
      state.queues[queueId] = entry;
    }
    if (entry.items.length >= MAX_QUEUE_ITEMS) throw new Error(`queue "${queueId}" is full (${MAX_QUEUE_ITEMS})`);
    const itemPayload = isRecord(item.payload) ? item.payload : {};
    const itemId =
      typeof item.id === 'string' && item.id.length > 0
        ? item.id
        : `item-${sha256Hex(canonicalJson({ queueId, refId: item.refId, itemKind: item.itemKind, payload: itemPayload })).slice(0, 16)}`;
    if (entry.items.some((i) => i.id === itemId)) {
      return { ok: true, summary: `queue "${queueId}" already holds item ${itemId} (idempotent)` };
    }
    const kind = item.itemKind;
    if (kind !== 'company-run' && kind !== 'study' && kind !== 'repository-triage' && kind !== 'custom') {
      throw new Error('itemKind must be company-run|study|repository-triage|custom');
    }
    const created = createQueueItem({
      id: itemId,
      queueId,
      itemKind: kind,
      refId: String(item.refId ?? ''),
      title: typeof item.title === 'string' ? item.title : '',
      position: entry.items.length + 1,
      payload: itemPayload,
    });
    entry.items.push(created);
    entry.queue.version += 1;
    this.bumpVersion(state);
    return { ok: true, summary: `queued ${created.id} at position ${created.position} in "${queueId}"` };
  }

  private execQueueReorder(state: AssistantState, p: Record<string, unknown>): { ok: boolean; summary: string } {
    const queueId = String(p.queueId ?? '');
    const entry = state.queues[queueId];
    if (!entry) throw new Error(`unknown queue "${queueId}"`);
    if (!Array.isArray(p.orderedIds) || p.orderedIds.some((x) => typeof x !== 'string')) {
      throw new Error('orderedIds must be an array of item ids');
    }
    entry.items = reorderQueueItems(entry.items, p.orderedIds as string[]);
    entry.queue.version += 1;
    this.bumpVersion(state);
    return { ok: true, summary: `reordered ${entry.items.length} item(s) in "${queueId}"` };
  }

  // --- workers (contracts) -------------------------------------------------

  private execWorkerHire(enterpriseId: string, expectedVersion: number, p: Record<string, unknown>): { ok: boolean; summary: string } {
    const key = String(p.contractKey ?? '');
    const existing = this.enterprises.get(enterpriseId)?.contracts[key];
    if (existing && existing.status === 'active') {
      return { ok: true, summary: `contract "${key}" already active (idempotent hire)` };
    }
    const proposed = this.enterprises.proposeContract(enterpriseId, {
      key,
      companyKey: p.companyKey,
      departmentKey: p.departmentKey,
      discipline: p.discipline,
      capacityShare: p.capacityShare,
      skillId: p.skillId,
      expectedVersion,
    });
    const decided = this.enterprises.decideContract(enterpriseId, {
      contractKey: key,
      decision: 'approved',
      expectedVersion: proposed.version,
    });
    void decided;
    return { ok: true, summary: `hired worker on contract "${key}" (${String(p.skillId ?? '')})` };
  }

  private execWorkerSuspend(enterpriseId: string, expectedVersion: number, p: Record<string, unknown>, suspended: boolean): { ok: boolean; summary: string } {
    const key = String(p.contractKey ?? '');
    const result = this.enterprises.setWorkerSuspended(enterpriseId, { contractKey: key, suspended, expectedVersion });
    if (!result.ok) throw new Error(result.error ?? 'suspend/resume failed');
    return { ok: true, summary: suspended ? `worker "${key}" paused (lease drains)` : `worker "${key}" resumed` };
  }

  private execWorkerFire(enterpriseId: string, expectedVersion: number, p: Record<string, unknown>): { ok: boolean; summary: string } {
    const key = String(p.contractKey ?? '');
    const current = this.enterprises.get(enterpriseId)?.contracts[key];
    if (!current) throw new Error(`unknown contract "${key}"`);
    if (current.status === 'released') return { ok: true, summary: `contract "${key}" already released (idempotent fire)` };
    let version = expectedVersion;
    if (current.status === 'active') {
      const suspended = this.enterprises.setWorkerSuspended(enterpriseId, { contractKey: key, suspended: true, expectedVersion: version });
      if (!suspended.ok) throw new Error(suspended.error ?? 'suspend failed');
      version = this.enterprises.get(enterpriseId)?.version ?? version + 1;
    }
    const released = this.enterprises.releaseContract(enterpriseId, { contractKey: key, expectedVersion: version });
    if (!released) throw new Error('release failed');
    // Drain semantics come from releaseContract; artifacts/ledger/events in
    // the project store are deliberately untouched (preserved).
    return { ok: true, summary: `fired worker "${key}": seat drained, artifacts preserved` };
  }

  // --- company / department lifecycle ---------------------------------------

  private execLifecycle(
    enterpriseId: string,
    state: AssistantState,
    expectedVersion: number,
    target: 'company' | 'department',
    action: AssistantAction,
    p: Record<string, unknown>,
  ): { ok: boolean; summary: string } {
    const key = String(target === 'company' ? p.companyKey ?? '' : p.departmentKey ?? '');
    if (key.length === 0) throw new Error(`${target} key required`);
    const record = this.enterprises.get(enterpriseId);
    if (!record) throw new Error('unknown enterprise id');
    if (record.version !== expectedVersion) {
      throw new Error(`version conflict: enterprise is at version ${record.version}, proposal expects ${expectedVersion}`);
    }
    const contracts = this.enterprises
      .listContracts(enterpriseId)
      .filter((c) => (target === 'company' ? c.companyKey === key : c.departmentKey === key));
    const lifecycle = target === 'company' ? state.lifecycle.companies : state.lifecycle.departments;
    const current = lifecycle[key] ?? 'active';
    const verb = action.endsWith('.pause') ? 'pause' : action.endsWith('.resume') ? 'resume' : 'archive';
    if (verb === 'resume' && current !== 'paused') return { ok: true, summary: `${target} "${key}" is ${current} (idempotent resume)` };
    if (verb === 'archive' && current === 'archived') return { ok: true, summary: `${target} "${key}" already archived (idempotent)` };
    if (verb === 'pause' && current === 'paused') return { ok: true, summary: `${target} "${key}" already paused (idempotent)` };
    if (verb !== 'resume' && current === 'archived') throw new Error(`${target} "${key}" is archived`);

    let version = expectedVersion;
    let touched = 0;
    let skipped = 0;
    const freshVersion = (): number => {
      version = this.enterprises.get(enterpriseId)?.version ?? version + 1;
      return version;
    };
    if (verb === 'pause') {
      for (const c of contracts) {
        if (c.status !== 'active') { skipped += 1; continue; }
        const r = this.enterprises.setWorkerSuspended(enterpriseId, { contractKey: c.key, suspended: true, expectedVersion: freshVersion() });
        if (!r.ok) throw new Error(r.error ?? `failed to pause ${c.key}`);
        touched += 1;
      }
      lifecycle[key] = 'paused';
    } else if (verb === 'resume') {
      for (const c of contracts) {
        if (c.status !== 'draining') { skipped += 1; continue; }
        const r = this.enterprises.setWorkerSuspended(enterpriseId, { contractKey: c.key, suspended: false, expectedVersion: freshVersion() });
        if (!r.ok) { skipped += 1; continue; } // live lease: report honestly
        touched += 1;
      }
      lifecycle[key] = 'active';
    } else {
      for (const c of contracts) {
        if (c.status !== 'active' && c.status !== 'draining') { skipped += 1; continue; }
        const r = this.enterprises.releaseContract(enterpriseId, { contractKey: c.key, expectedVersion: freshVersion() });
        if (!r) throw new Error(`failed to release ${c.key}`);
        touched += 1;
      }
      lifecycle[key] = 'archived';
    }
    this.bumpVersion(state);
    const extra = skipped > 0 ? ` (${skipped} already in target/terminal state)` : '';
    return { ok: true, summary: `${target} "${key}" ${verb}d: ${touched} contract(s) ${verb === 'archive' ? 'drained+released' : 'updated'}${extra}` };
  }

  // --- cache invalidation ----------------------------------------------------

  private cacheDirFor(enterpriseId: string): string {
    return path.join(path.resolve(this.root, this.safeEnterpriseId(enterpriseId)), 'cache');
  }

  private execCacheInvalidate(
    enterpriseId: string,
    state: AssistantState,
    expectedVersion: number,
    p: Record<string, unknown>,
  ): { ok: boolean; summary: string } {
    const record = this.enterprises.get(enterpriseId);
    if (!record) throw new Error('unknown enterprise id');
    if (record.version !== expectedVersion) {
      throw new Error(`version conflict: enterprise is at version ${record.version}, proposal expects ${expectedVersion}`);
    }
    const namespace = String(p.namespace ?? '') as CacheNamespace;
    let removedKeys = 0;
    const cacheDir = this.cacheDirFor(enterpriseId);
    const removeMatching = (prefix: string): void => {
      let files: string[] = [];
      try {
        files = fs.readdirSync(cacheDir);
      } catch {
        return;
      }
      for (const file of files) {
        if (!file.startsWith(prefix) || !file.endsWith('.json')) continue;
        try {
          fs.rmSync(path.join(cacheDir, file));
          removedKeys += 1;
        } catch {
          // best effort per file
        }
      }
    };
    switch (namespace) {
      case 'skill-excerpts':
        removeMatching('skill-');
        break;
      case 'blueprint':
        removeMatching('blueprint-');
        break;
      case 'snapshot':
        // Snapshots are derived per call (deriveEnterpriseView); no cache exists.
        removedKeys = 0;
        break;
      case 'repository-metadata':
        removedKeys = this.repoMetaCache.clear();
        break;
      default:
        throw new Error(`unknown cache namespace "${namespace}"`);
    }
    this.bumpVersion(state);
    const report: CacheInvalidationReport = buildCacheInvalidationReport({
      namespace,
      scopeKey: enterpriseId,
      removedKeys,
      invalidatedAt: this.now(),
    });
    return { ok: true, summary: `cache invalidated: ${namespace} (${report.removedKeys} key(s) removed)` };
  }

  cacheStatus(enterpriseId: string): { namespace: CacheNamespace; keys: number }[] {
    const id = this.safeEnterpriseId(enterpriseId);
    const cacheDir = this.cacheDirFor(id);
    let files: string[] = [];
    try {
      files = fs.readdirSync(cacheDir);
    } catch {
      files = [];
    }
    return [
      { namespace: 'skill-excerpts', keys: files.filter((f) => f.startsWith('skill-') && f.endsWith('.json')).length },
      { namespace: 'blueprint', keys: files.filter((f) => f.startsWith('blueprint-') && f.endsWith('.json')).length },
      { namespace: 'snapshot', keys: 0 },
      { namespace: 'repository-metadata', keys: this.repoMetaCache.size },
    ];
  }

  // --- schedules -------------------------------------------------------------

  private execScheduleUpsert(state: AssistantState, p: Record<string, unknown>): { ok: boolean; summary: string } {
    if (!isRecord(p.job)) throw new Error('payload.job must be an object');
    const j = p.job;
    const existing = typeof j.id === 'string' ? state.jobs[j.id] : undefined;
    if (!existing && Object.keys(state.jobs).length >= MAX_JOBS) throw new Error(`job cap reached (${MAX_JOBS})`);
    const built = createAssistantJob({
      id: String(j.id ?? ''),
      scope: j.scope as AssistantJob['scope'],
      kind: j.kind as AssistantJob['kind'],
      schedule: j.schedule as AssistantJob['schedule'],
      ...(typeof j.enabled === 'boolean' ? { enabled: j.enabled } : {}),
      ...(j.maxRuns === null || typeof j.maxRuns === 'number' ? { maxRuns: j.maxRuns as number | null } : {}),
    });
    const policy = ASSISTANT_JOB_POLICIES[built.kind];
    if (policy.providerCalls !== false || policy.paidCalls !== false || policy.executesProposals !== false) {
      throw new Error('assistant jobs must never call providers, pay, or execute proposals');
    }
    const merged: AssistantJob = AssistantJobSchema.parse({
      ...built,
      enabled: existing ? existing.enabled : built.enabled,
      runCount: existing?.runCount ?? 0,
      lastRunAt: existing?.lastRunAt ?? null,
      version: (existing?.version ?? 0) + 1,
    });
    merged.nextRunAt = scheduleNextRun(merged, this.now());
    state.jobs[merged.id] = merged;
    this.bumpVersion(state);
    return { ok: true, summary: `schedule upserted: ${merged.kind} job "${merged.id}" (next run ${merged.nextRunAt ?? 'never'})` };
  }

  private execScheduleEnabled(state: AssistantState, p: Record<string, unknown>, enabled: boolean): { ok: boolean; summary: string } {
    const jobId = String(p.jobId ?? '');
    const job = state.jobs[jobId];
    if (!job) throw new Error(`unknown job "${jobId}"`);
    if (job.enabled === enabled) return { ok: true, summary: `job "${jobId}" already ${enabled ? 'enabled' : 'paused'} (idempotent)` };
    job.enabled = enabled;
    job.version += 1;
    job.nextRunAt = scheduleNextRun(job, this.now());
    this.bumpVersion(state);
    return { ok: true, summary: `job "${jobId}" ${enabled ? 'resumed' : 'paused'}` };
  }

  private execScheduleDelete(state: AssistantState, p: Record<string, unknown>): { ok: boolean; summary: string } {
    const jobId = String(p.jobId ?? '');
    if (!state.jobs[jobId]) return { ok: true, summary: `job "${jobId}" already absent (idempotent delete)` };
    delete state.jobs[jobId];
    this.bumpVersion(state);
    return { ok: true, summary: `job "${jobId}" deleted` };
  }

  private execScheduleRunNow(enterpriseId: string, state: AssistantState, p: Record<string, unknown>): { ok: boolean; summary: string } {
    const jobId = String(p.jobId ?? '');
    const job = state.jobs[jobId];
    if (!job) throw new Error(`unknown job "${jobId}"`);
    try {
      if (this.enterprises.get(enterpriseId)?.program?.state === 'stopped_human') {
        return { ok: true, summary: 'program is cancelled; job run skipped (no replay)' };
      }
    } catch {
      // unknown enterprise: proceed (job effects that need it will fail honestly)
    }
    return this.runJobOnce(enterpriseId, state, job, this.now());
  }

  // --- study queue -------------------------------------------------------------

  private mergeStudyItems(state: AssistantState, items: StudyQueueItem[]): number {
    let added = 0;
    for (const item of items) {
      if (state.studyItems[item.id]) continue; // content-derived ids: idempotent
      if (Object.keys(state.studyItems).length >= MAX_STUDY_ITEMS) break;
      state.studyItems[item.id] = item;
      added += 1;
    }
    return added;
  }

  private execStudyEnqueue(state: AssistantState, p: Record<string, unknown>): { ok: boolean; summary: string } {
    const skillId = String(p.skillId ?? '');
    if (skillId.length === 0) throw new Error('skillId required');
    const resources = Array.isArray(p.resources) ? p.resources : [];
    if (resources.length === 0) throw new Error('resources must be a non-empty array of {ref, topic?}');
    const items = buildStudyQueue({
      skillId,
      resources: resources.map((r) => {
        if (!isRecord(r) || typeof r.ref !== 'string') throw new Error('each resource needs a string ref');
        return { ref: r.ref, ...(typeof r.topic === 'string' ? { topic: r.topic } : {}) };
      }),
      goal: String(p.goal ?? ''),
      ...(typeof p.evaluation === 'string' ? { evaluation: p.evaluation } : {}),
    });
    const added = this.mergeStudyItems(state, items);
    this.bumpVersion(state);
    return { ok: true, summary: `study queue: ${added} draft item(s) enqueued (${items.length - added} already present); provider calls: never` };
  }

  studyList(enterpriseId: string): StudyQueueItem[] {
    return Object.values(this.loadOrEmpty(this.safeEnterpriseId(enterpriseId)).studyItems).map((i) => clone(i));
  }

  // --- repositories ------------------------------------------------------------

  /** Preview: fetch public metadata + route, WITHOUT persisting anything. */
  async repoPreview(url: unknown): Promise<{ ok: boolean; metadata?: RepositoryMetadata; plan?: RepoAssignmentPlan; error?: string }> {
    try {
      if (typeof url !== 'string') throw new Error('url must be a string');
      const metadata = await this.fetchRepoMetadata(url);
      return { ok: true, metadata, plan: routeRepository(metadata) };
    } catch (err) {
      const classified = classifyGithubMetaError(err);
      return { ok: false, error: `${classified.errorClass}: ${classified.detail}` };
    }
  }

  private async fetchRepoMetadata(url: string): Promise<RepositoryMetadata> {
    const cached = this.repoMetaCache.get(url, this.now());
    if (cached) return cached;
    const metadata = await fetchGithubRepoMetadata(url, {
      ...(this.github.fetchFn ? { fetchFn: this.github.fetchFn } : {}),
      ...(this.github.timeoutMs !== undefined ? { timeoutMs: this.github.timeoutMs } : {}),
      now: this.now,
    });
    this.repoMetaCache.set(url, metadata, this.now());
    return metadata;
  }

  /**
   * repository.import (desktop): public-anonymous intake only. Credentialed
   * private reads are refused — they remain a web-only flow behind a vault
   * credential + approved proposal. Routing is persisted as a PLAN; unknown
   * repos stay quarantined, assignment applies only via repository.assign.
   */
  async repoFetch(enterpriseId: string, input: {
    url: unknown;
    intakeMode: unknown;
    expectedVersion: unknown;
    confirmed: unknown;
    confirmedGates?: unknown;
  }): Promise<{ ok: boolean; repository?: StoredRepository; error?: string }> {
    try {
      const id = this.safeEnterpriseId(enterpriseId);
      if (typeof input.url !== 'string') throw new Error('url must be a string');
      const intake = validateRepositoryIntake({
        contractVersion: ASSISTANT_CONTRACT_VERSION,
        url: input.url,
        intakeMode: input.intakeMode as GithubIntakeMode,
        credentialRecordId: null,
      });
      if (intake.intakeMode !== 'public-anonymous') {
        throw new GithubMetaError('auth', 'credentialed repository reads are web-only; desktop intake is public-anonymous');
      }
      const state = this.loadOrEmpty(id);
      const key = repoKey(intake.url);
      const existing = state.repositories[key];
      if (existing && existing.metadata.visibility === 'public') {
        return { ok: true, repository: clone(existing) }; // idempotent re-import
      }
      // Policy gates + OCC enforced through the same validated pipeline
      // (validation only; the async fetch below is the execution).
      this.validateDirect(id, state, {
        scope: 'enterprise',
        action: 'repository.import',
        payload: { url: intake.url, intakeMode: intake.intakeMode },
        expectedVersion: input.expectedVersion,
        confirmed: input.confirmed,
        confirmedGates: input.confirmedGates,
      });
      if (Object.keys(state.repositories).length >= MAX_SELECTED_REPOSITORIES) {
        throw new Error(`repository cap reached (${MAX_SELECTED_REPOSITORIES} per enterprise)`);
      }
      // Confirmed public metadata only. Non-public repos fail here with a
      // 'private'/'not_found' error class; routing quarantine applies when a
      // confirmed read reports non-public visibility (routeRepository below).
      const metadata = await this.fetchRepoMetadata(intake.url);
      const plan = routeRepository(metadata);
      const stored: StoredRepository = {
        metadata,
        plan,
        intakeMode: intake.intakeMode,
        appliedAt: existing?.appliedAt ?? null,
        appliedBy: existing?.appliedBy ?? null,
      };
      state.repositories[key] = stored;
      this.bumpVersion(state);
      this.appendEvent(state, 'assistant-repo-imported', `${metadata.url} -> ${plan.status} (${plan.companyKey ?? 'quarantine'})`);
      this.save(state);
      return { ok: true, repository: clone(stored) };
    } catch (err) {
      const classified = classifyGithubMetaError(err);
      return { ok: false, error: err instanceof GithubMetaError ? `${classified.errorClass}: ${classified.detail}` : err instanceof Error ? err.message : String(err) };
    }
  }

  private execRepoAssign(state: AssistantState, p: Record<string, unknown>): { ok: boolean; summary: string } {
    const url = String(p.url ?? '');
    const key = repoKey(url);
    const stored = state.repositories[key];
    if (!stored) throw new Error('repository has not been imported (no metadata/plan)');
    if (stored.appliedAt !== null) return { ok: true, summary: `assignment for ${url} already applied (idempotent)` };
    if (stored.plan.status !== 'assigned') {
      throw new Error(`plan status is "${stored.plan.status}"; only routing-confirmed "assigned" plans can be applied (quarantine needs human triage)`);
    }
    stored.appliedAt = this.now();
    stored.appliedBy = 'human';
    this.bumpVersion(state);
    return { ok: true, summary: `assigned ${url} -> ${stored.plan.companyKey}/${stored.plan.departmentKey} (read-only metadata ref; never cloned)` };
  }

  private execRepoProposeStructure(state: AssistantState, p: Record<string, unknown>): { ok: boolean; summary: string } {
    const url = String(p.url ?? '');
    const stored = state.repositories[repoKey(url)];
    if (!stored) throw new Error('repository has not been imported (no metadata/plan)');
    if (stored.plan.status !== 'proposed_new_structure') {
      throw new Error(`plan status is "${stored.plan.status}"; structure proposals exist only for proposed_new_structure routings`);
    }
    // Deliberately a NO-OP beyond the audit event: the plan itself is the
    // proposal. Companies/departments/roles are never created here.
    this.bumpVersion(state);
    return { ok: true, summary: `structure proposal recorded for ${url} (confidence ${stored.plan.confidence}); no companies/departments created` };
  }

  // --- knowledge transfer ------------------------------------------------------

  private execKnowledgeTransfer(enterpriseId: string, state: AssistantState, p: Record<string, unknown>): { ok: boolean; summary: string } {
    if (!Array.isArray(p.refs)) throw new Error('payload.refs must be an array of ArtifactRef');
    if (!isRecord(p.handoff)) throw new Error('payload.handoff must be {from, to, summary?}');
    const refs = p.refs as ArtifactRef[];
    // Ref integrity: every referenced artifact must exist in a company
    // project with a matching content hash (no ghosts, no bodies).
    const record = this.enterprises.get(enterpriseId);
    if (!record) throw new Error('unknown enterprise id');
    for (const ref of refs) {
      const runId = String(ref.runId ?? '');
      let found: string | null = null;
      for (const link of Object.values(record.companies)) {
        if (this.projects.getRun(link.projectId, runId)) { found = link.projectId; break; }
      }
      if (!found) throw new Error(`no company project owns runId "${runId}" (ref integrity)`);
      const nodeId = record.contractWorkers[ref.nodeKey]?.nodeId ?? record.departments[ref.nodeKey]?.nodeId ?? ref.nodeKey;
      const stored = this.projects.readArtifact(found, runId, nodeId, ref.attempt);
      if (!stored) throw new Error(`artifact not found for ref "${ref.nodeKey}" (ref integrity)`);
      if (stored.meta.textSha256 !== ref.contentSha256) {
        throw new Error(`content hash mismatch for ref "${ref.nodeKey}" (ref integrity)`);
      }
    }
    const transferId =
      typeof p.id === 'string' && p.id.length > 0
        ? p.id
        : `kt-${sha256Hex(canonicalJson({ refs: p.refs, handoff: p.handoff })).slice(0, 16)}`;
    if (state.transfers[transferId]) {
      return { ok: true, summary: `knowledge transfer "${transferId}" already recorded (idempotent)` };
    }
    if (Object.keys(state.transfers).length >= MAX_TRANSFERS) throw new Error(`transfer cap reached (${MAX_TRANSFERS})`);
    const record2 = buildKnowledgeTransfer({
      id: transferId,
      refs,
      handoff: {
        from: String(p.handoff.from ?? ''),
        to: String(p.handoff.to ?? ''),
        ...(typeof p.handoff.summary === 'string' ? { summary: p.handoff.summary } : {}),
      },
    });
    state.transfers[record2.id] = record2;
    this.bumpVersion(state);
    return { ok: true, summary: `knowledge transfer "${record2.id}": ${record2.refs.length} ref(s), sha256 ${record2.contentSha256.slice(0, 12)}…` };
  }

  knowledgeList(enterpriseId: string): KnowledgeTransferRecord[] {
    return Object.values(this.loadOrEmpty(this.safeEnterpriseId(enterpriseId)).transfers).map((t) => clone(t));
  }

  /** Export knowledge transfers as json + markdown (HANDOFFS-style links). */
  knowledgeExport(enterpriseId: string): { ok: boolean; dir?: string; files?: string[]; error?: string } {
    try {
      const id = this.safeEnterpriseId(enterpriseId);
      const state = this.loadOrEmpty(id);
      const transfers = Object.values(state.transfers);
      const outDir = path.join(this.dir(id), 'exports');
      const md = [
        '# Knowledge transfers',
        '',
        'Reference-only handoffs (artifact bodies stay in the project store).',
        '',
        ...transfers.map(
          (t, i) =>
            `${i + 1}. **${t.handoff.from} → ${t.handoff.to}** — sha256 ${t.contentSha256}` +
            `\n\n   refs: ${t.refs.map((r) => `${r.nodeKey}@${String(r.runId)}#${r.attempt}`).join(', ')}` +
            `${t.handoff.summary.length > 0 ? `\n\n   ${t.handoff.summary}` : ''}`,
        ),
        '',
      ].join('\n');
      atomicWrite(path.join(outDir, 'knowledge-transfers.json'), JSON.stringify(transfers, null, 2));
      atomicWrite(path.join(outDir, 'knowledge-transfers.md'), md);
      this.appendEvent(state, 'assistant-knowledge-exported', `${transfers.length} transfer(s)`);
      this.save(state);
      return { ok: true, dir: outDir, files: ['knowledge-transfers.json', 'knowledge-transfers.md'] };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // --- program pump --------------------------------------------------------------

  private execProgramPump(enterpriseId: string, expectedVersion: number): { ok: boolean; summary: string } {
    const record = this.enterprises.get(enterpriseId);
    if (!record) throw new Error('unknown enterprise id');
    if (record.version !== expectedVersion) {
      throw new Error(`version conflict: enterprise is at version ${record.version}, proposal expects ${expectedVersion}`);
    }
    const program = record.program;
    if (!program) throw new Error('no program');
    // Live gate re-check in code: an approved plan approval for the CURRENT
    // blueprint must exist before any dispatch is pumped.
    const approved = record.approvals.some(
      (a) => a.kind === 'plan' && a.blueprintHash === program.blueprintHash && a.status === 'approved',
    );
    if (!approved) throw new Error('program pump requires an approved plan approval for the current blueprint');
    const result = this.runner.pump(enterpriseId);
    if (!result.ok) throw new Error(result.error ?? 'pump failed');
    return { ok: true, summary: `program pumped: ${result.dispatched} company run(s) dispatched` };
  }

  // ------------------------------------------------------------- job effects

  /**
   * Execute one deterministic job effect. NEVER provider calls, NEVER paid
   * calls, NEVER executes proposals. Returns the outcome summary.
   */
  private runJobOnce(enterpriseId: string, state: AssistantState, job: AssistantJob, now: number): { ok: boolean; summary: string } {
    const effect = ASSISTANT_JOB_POLICIES[job.kind].effect;
    let summary: string;
    try {
      switch (effect) {
        case 'refresh-ledger': {
          const exported = this.enterprises.exportArtifacts(enterpriseId);
          summary = exported.ok
            ? `ledger/timeline refreshed (${(exported.files ?? []).length} export files)`
            : `ledger refresh skipped: ${exported.error ?? 'unavailable'}`;
          break;
        }
        case 'refresh-cache': {
          const cached = this.enterprises.cachedBlueprint(enterpriseId);
          summary = `cache refreshed (blueprint ${cached.blueprintHash.slice(0, 12)}…, ${cached.cached ? 'cache hit' : 'recomputed'})`;
          break;
        }
        case 'pump-approved-mock': {
          // The desktop has no mock program mode: every program dispatch is a
          // real provider-backed company run, so this job is deliberately
          // inert (zero provider calls). Use a gated program.pump proposal.
          summary = 'no mock program mode on desktop; pump skipped (zero provider calls)';
          break;
        }
        case 'propose-repository-drift': {
          let drift = 0;
          for (const stored of Object.values(state.repositories)) {
            const rerouted = routeRepository(stored.metadata);
            const changed =
              rerouted.status !== stored.plan.status ||
              rerouted.companyKey !== stored.plan.companyKey ||
              rerouted.departmentKey !== stored.plan.departmentKey ||
              rerouted.skillId !== stored.plan.skillId;
            if (!changed) continue;
            const proposed = this.createProposalInState(state, {
              scope: 'enterprise',
              actor: 'repository-integration-steward',
              action: 'repository.assign',
              payload: { url: stored.metadata.url, observedStatus: rerouted.status, commitSha: stored.metadata.commitSha },
            });
            if (proposed.ok && proposed.created) drift += 1;
          }
          summary = `repository sync: ${drift} drift proposal(s), ${Object.keys(state.repositories).length} tracked`;
          break;
        }
        case 'create-study-drafts': {
          if (!this.skills) {
            summary = 'no skill registry; study drafts skipped';
            break;
          }
          let added = 0;
          for (const skill of this.skills.registry.list()) {
            if (!skill.verified || added >= STUDY_QUEUE_CAP) continue;
            const items = buildStudyQueue({
              skillId: skill.id,
              resources: [{ ref: `skill://${skill.id}`, topic: skill.name }],
              goal: `Review the bundled briefing for ${skill.name}.`,
            });
            added += this.mergeStudyItems(state, items);
          }
          summary = `study plan: ${added} new draft item(s) (provider calls: never)`;
          break;
        }
        default:
          summary = `unknown job effect "${String(effect)}"`;
      }
    } catch (err) {
      summary = `job effect failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    job.lastRunAt = now;
    job.runCount += 1;
    job.version += 1;
    job.nextRunAt = scheduleNextRun(job, now);
    this.bumpVersion(state);
    this.appendEvent(state, 'assistant-job-ran', `${job.kind} (${job.id}): ${summary.slice(0, 140)}`);
    return { ok: true, summary };
  }

  /**
   * Scheduler sweep entry point (also used by boot reconciliation and tests):
   * for every enterprise, run each due job at most once. Jobs never run while
   * the enterprise program is cancelled (stopped_human); their next run is
   * skipped forward so there is no catch-up storm and no replay.
   */
  sweepJobs(now?: number): { ran: number; skipped: number; errors: number } {
    const at = now ?? this.now();
    let ran = 0;
    let skipped = 0;
    let errors = 0;
    for (const enterpriseId of this.listEnterpriseIds()) {
      const state = this.load(enterpriseId);
      if (!state) continue;
      const cancelled = (() => {
        try {
          return this.enterprises.get(enterpriseId)?.program?.state === 'stopped_human';
        } catch {
          return false;
        }
      })();
      let dirty = false;
      for (const job of Object.values(state.jobs)) {
        if (!job.enabled || job.nextRunAt === null || job.nextRunAt > at) continue;
        if (cancelled) {
          job.nextRunAt = scheduleNextRun(job, at); // skip forward; never replay
          job.version += 1;
          dirty = true;
          skipped += 1;
          continue;
        }
        try {
          this.runJobOnce(enterpriseId, state, job, at);
          ran += 1;
        } catch {
          errors += 1;
        }
        dirty = true;
      }
      if (dirty) this.save(state);
    }
    return { ran, skipped, errors };
  }

  // ------------------------------------------------------------- Donna chat

  /**
   * Build Donna's advisory prompt for an enterprise: the stable system prompt
   * plus a user message fencing UNTRUSTED ledger/repository context. Send it
   * through a ChatManager session created with mode:'donna' (existing
   * confirmed:true + budget enforcement); the reply is untrusted display
   * text — proposals enter the pipeline only through donnaParse.
   */
  donnaPrompt(enterpriseId: string, input: { objective: unknown; includeLedger?: unknown; includeRepositories?: unknown }): {
    ok: boolean;
    prompt?: DonnaPrompt;
    error?: string;
  } {
    try {
      const id = this.safeEnterpriseId(enterpriseId);
      const objective = String(input.objective ?? '');
      if (objective.trim().length === 0) throw new Error('objective must be non-empty');
      let ledgerContext: string | undefined;
      if (input.includeLedger !== false) {
        try {
          const ledger = this.enterprises.readLedger(id).slice(0, 25);
          ledgerContext = ledger
            .map((e) => `#${e.seq} ${e.companyKey ?? '-'} ${String(e.workerId ?? '-')} ${e.kind}/${e.status} ${e.intendedAsk.slice(0, 80)}`)
            .join('\n');
        } catch {
          ledgerContext = '';
        }
      }
      let repositoryContext: string | undefined;
      if (input.includeRepositories !== false) {
        const state = this.loadOrEmpty(id);
        const repos = Object.values(state.repositories).map((r) => ({
          url: r.metadata.url,
          status: r.plan.status,
          companyKey: r.plan.companyKey,
          departmentKey: r.plan.departmentKey,
          commitSha: r.metadata.commitSha,
          applied: r.appliedAt !== null,
        }));
        repositoryContext = repos.length > 0 ? JSON.stringify(repos, null, 1) : '';
      }
      const prompt = buildDonnaPrompt({
        objective,
        ...(ledgerContext !== undefined && ledgerContext.length > 0 ? { ledgerContext } : {}),
        ...(repositoryContext !== undefined && repositoryContext.length > 0 ? { repositoryContext } : {}),
      });
      return { ok: true, prompt };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Parse Donna chat output into STRICT draft proposals. Only JSON objects
   * that survive schema + policy validation (payload hash re-derived, scope
   * coverage, forbidden keys, drain-preserve) become 'proposed' drafts;
   * everything else is dropped and counted. The parsed proposals are NEVER
   * executed here — execution only happens through decide + execute with
   * human gate confirmations.
   */
  donnaParse(enterpriseId: string, input: { text: unknown; scope?: unknown; actor?: unknown; persist?: unknown }): {
    ok: boolean;
    proposals?: AssistantActionProposal[];
    dropped?: number;
    error?: string;
  } {
    try {
      const id = this.safeEnterpriseId(enterpriseId);
      if (typeof input.text !== 'string' || input.text.length === 0) throw new Error('text must be a non-empty string');
      if (input.text.length > 64_000) throw new Error('text too large');
      const scope = input.scope === undefined ? 'enterprise' : input.scope;
      const actor = input.actor === undefined ? 'donna' : input.actor;
      const candidates = extractJsonCandidates(input.text);
      const proposals: AssistantActionProposal[] = [];
      let dropped = 0;
      for (const candidate of candidates) {
        if (!isRecord(candidate)) { dropped += 1; continue; }
        const action = candidate.action;
        if (typeof action !== 'string' || !(ASSISTANT_ACTIONS as readonly string[]).includes(action)) { dropped += 1; continue; }
        if (!isRecord(candidate.payload)) { dropped += 1; continue; }
        const result = this.propose(id, {
          scope: typeof candidate.scope === 'string' ? candidate.scope : scope,
          actor: typeof candidate.actor === 'string' ? candidate.actor : actor,
          action,
          payload: candidate.payload,
        });
        if (result.ok && result.proposal) proposals.push(result.proposal);
        else dropped += 1;
      }
      return { ok: true, proposals, dropped };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/**
 * Extract JSON object/array candidates from untrusted model text: fenced
 * ```json blocks first, then balanced top-level [...] arrays. Pure; bounded.
 */
export function extractJsonCandidates(text: string): unknown[] {
  const out: unknown[] = [];
  const fenceRe = /```(?:json)?\s*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(m[1]!.trim()) as unknown;
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      // not valid JSON — ignore
    }
  }
  if (out.length > 0) return out.slice(0, 32);
  // Bare balanced arrays (only when no fenced JSON was found).
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length && out.length < 32; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '[') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === ']') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          const parsed = JSON.parse(text.slice(start, i + 1)) as unknown;
          if (Array.isArray(parsed)) out.push(...parsed);
        } catch {
          // ignore
        }
        start = -1;
      }
      if (depth < 0) { depth = 0; start = -1; }
    }
  }
  return out.slice(0, 32);
}

// ---------------------------------------------------------------------------
// AssistantScheduler — unref'd interval + boot reconciliation
// ---------------------------------------------------------------------------

export interface AssistantSchedulerDeps {
  intervalMs?: number;
  now?: () => number;
}

export class AssistantScheduler {
  private readonly store: AssistantStore;
  private readonly intervalMs: number;
  private readonly now: () => number;
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(store: AssistantStore, deps: AssistantSchedulerDeps = {}) {
    this.store = store;
    this.intervalMs = Math.max(ASSISTANT_SCHEDULE_BOUNDS.minIntervalMs, deps.intervalMs ?? ASSISTANT_SCHEDULE_BOUNDS.minIntervalMs);
    this.now = deps.now ?? Date.now;
  }

  /**
   * Boot reconciliation (one immediate sweep; missed runs are skipped
   * forward, never replayed) + an unref'd interval that never keeps the
   * process alive.
   */
  start(): void {
    if (this.timer !== null) return;
    this.sweep();
    this.timer = setInterval(() => this.sweep(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get running(): boolean {
    return this.timer !== null;
  }

  sweep(): { ran: number; skipped: number; errors: number } {
    if (this.sweeping) return { ran: 0, skipped: 0, errors: 0 };
    this.sweeping = true;
    try {
      return this.store.sweepJobs(this.now());
    } finally {
      this.sweeping = false;
    }
  }
}
