// @vitest-environment jsdom
/**
 * Donna / shared-assistant (v0.6) renderer tests.
 *
 * UI flows run against a stateful fake v6 bridge whose ast* methods mirror
 * main-process semantics (closed action set, OCC, policy gates recorded at
 * decide time, drain+preserve payloads, deterministic zero-budget schedules,
 * public-anonymous repo routing, strict Donna reply parsing) by reusing the
 * REAL pure functions from src/shared/assistant.ts plus the main-process
 * extractJsonCandidates. A v5-shaped raw bridge must degrade the drawer to
 * the honest "requires desktop 0.6 runtime" panel.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  blueprintHash as sharedBlueprintHash,
  canonicalJson,
  generateEnterpriseBlueprint,
  sha256Hex,
  type EnterpriseBlueprint,
} from '../../src/shared/enterprise';
import {
  ASSISTANT_ACTION_POLICIES,
  ASSISTANT_DEFINITIONS,
  ASSISTANT_GATES,
  buildDonnaPrompt,
  buildStudyQueue,
  createAssistantJob,
  createAssistantProposal,
  routeRepository,
  scheduleNextRun,
  validateAssistantAction,
} from '../../src/shared/assistant';
import { extractJsonCandidates } from '../../src/main/assistant';
import { BridgeAdapter, UNAVAILABLE_V6, type RawBridge } from '../../src/renderer/office/bridge';
import { createOverlayHost } from '../../src/renderer/office/overlay';
import { createEnterpriseApp, type EnterpriseApp } from '../../src/renderer/enterprise/app';
import type { EnterpriseRecordDto } from '../../src/renderer/office/entTypes';
import type { ChatMessage, ChatSession, CreateChatSessionRequest, SkillSummary } from '../../src/renderer/office/types';
import type {
  AssistantAction,
  AssistantActionProposal,
  AssistantCacheStatusDto,
  AssistantDefinitionsDto,
  AssistantEventDto,
  AssistantGate,
  AssistantJob,
  AssistantQueueItem,
  AssistantRepositoryDto,
  AssistantScope,
  AssistantStateDto,
  CacheNamespace,
  KnowledgeTransferRecord,
  RepoAssignmentPlan,
  RepositoryMetadata,
  StudyQueueItem,
} from '../../src/renderer/office/astTypes';
import { flush, makeFakePanzoom, mountChromeDom } from './helpers';

const NOW = '2026-03-01T12:00:00.000Z';
const NOW_MS = Date.parse(NOW);
const ENT_ID = 'ent-1';
const FULL_SHA = '0123456789abcdef0123456789abcdef01234567';

// Actions whose OCC token is the ENTERPRISE record version (mirrors
// ENTERPRISE_VERSIONED_ACTIONS in src/shared/enterprise.ts).
const ENT_VERSIONED = new Set<AssistantAction>([
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

function fakeSkills(): SkillSummary[] {
  const ids = [
    'mathematics-research',
    'computational-geometry-engineering',
    'architecture-database-backend-engineering',
    'defensive-reverse-engineering',
    'ai-research-frontier',
    'ai-open-model-research',
    'civilization-art-design-research',
    'ui-ux-research-design-engineering',
    'spatial-3d-production-engineering',
    'music-theory-production-engineering',
    ...Array.from({ length: 10 }, (_, i) => `general-pack-${i + 1}`),
  ];
  return ids.map((id, i) => ({
    id,
    name: id,
    description: `${id} pack`,
    role: 'research',
    keywords: [id],
    sha256: String(i).repeat(64).slice(0, 64),
    path: `${id}/SKILL.md`,
    verified: true,
  }));
}

function makeRecord(): EnterpriseRecordDto {
  const contract = (skillId: string): EnterpriseRecordDto['contracts'][string] => ({
    status: 'active',
    staffed: true,
    skillId,
    capacityShare: 1,
    version: 1,
    fenceCounter: 1,
    lease: null,
  });
  return {
    contractVersion: 1,
    id: ENT_ID,
    programId: 'ctg-2026',
    preset: 'creative_technology_group',
    name: 'Creative Technology Group',
    mission: 'Operate a creative technology group.',
    provider: 'openai',
    model: 'gpt-5.2',
    priceRates: { inputUsdPerMillion: 0, outputUsdPerMillion: 0 },
    version: 3,
    state: 'materialized',
    blueprint: generateEnterpriseBlueprint({
      preset: 'creative_technology_group',
      programId: 'ctg-2026',
      name: 'Creative Technology Group',
      mission: 'Operate a creative technology group.',
      budget: { maxTokens: 4_000_000, maxCalls: 300, maxMinutes: 360, maxCostUsdMicros: 250_000_000 },
      availableSkillIds: fakeSkills().map((s) => s.id),
      maxReplans: 2,
      maxConcurrentRuns: 2,
    }) as unknown as EnterpriseRecordDto['blueprint'],
    blueprintHash: 'b'.repeat(64),
    program: {
      contractVersion: 1,
      programId: 'ctg-2026',
      state: 'running',
      version: 1,
      blueprintHash: 'b'.repeat(64),
      companyRuns: [],
      maxReplans: 2,
      maxConcurrentRuns: 2,
      budget: { maxTokens: 4_000_000, maxCalls: 300, maxMinutes: 360, maxCostUsdMicros: 250_000_000 },
    },
    programPaused: false,
    companies: { software: { projectId: 'proj-software', createdAt: NOW }, music: { projectId: 'proj-music', createdAt: NOW } },
    departments: {
      'svc-backend-engineering': { projectId: 'proj-shared', nodeId: 'node-be' },
      'svc-music-production': { projectId: 'proj-shared', nodeId: 'node-mp' },
    },
    contractWorkers: {},
    contracts: {
      'software--svc-backend-engineering': contract('architecture-database-backend-engineering'),
      'music--svc-music-production': contract('music-theory-production-engineering'),
    },
    approvals: [],
    memory: [],
    workerOverrides: {},
    ledgerKeys: [],
    ledgerSeq: 0,
    eventSeq: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

interface AstState {
  version: number;
  proposals: AssistantActionProposal[];
  gateConfirmations: Record<string, AssistantGate[]>;
  queues: Map<string, { queue: { contractVersion: 1; id: string; scope: AssistantScope; scopeKey: string; version: number }; items: AssistantQueueItem[] }>;
  jobs: Map<string, AssistantJob>;
  studyItems: StudyQueueItem[];
  repositories: Map<string, AssistantRepositoryDto>;
  transfers: KnowledgeTransferRecord[];
  lifecycle: { companies: Record<string, string>; departments: Record<string, string> };
  events: AssistantEventDto[];
  cache: Record<CacheNamespace, number>;
}

/**
 * Stateful fake v6 assistant backend. Mirrors AssistantStore semantics using
 * the real shared pure functions; executor effects are small, explicit, and
 * deterministic. Tracks everything the tests assert on (pump count, provider
 * calls, applied repos, cancelled programs).
 */
class FakeAstBackend {
  record: EnterpriseRecordDto;
  state: AstState;
  previewCache = new Map<string, { metadata: RepositoryMetadata; plan: RepoAssignmentPlan }>();
  pumpCalls = 0;
  programCancelCalls = 0;
  chatStopCalls = 0;
  providerSendCalls = 0;
  exportCalls = 0;
  listeners: Array<(e: unknown) => void> = [];
  private eventSeq = 0;
  private queueItemSeq = 0;

  constructor(record: EnterpriseRecordDto) {
    this.record = record;
    this.state = {
      version: 1,
      proposals: [],
      gateConfirmations: {},
      queues: new Map(),
      jobs: new Map(),
      studyItems: [],
      repositories: new Map(),
      transfers: [],
      lifecycle: { companies: {}, departments: {} },
      events: [],
      cache: { 'skill-excerpts': 4, blueprint: 1, snapshot: 0, 'repository-metadata': 2 },
    };
  }

  private clone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
  }

  /** Ledger event only (mirrors main appendEvent: eventSeq, NOT version). */
  private event(event: string, detail?: string): void {
    this.eventSeq += 1;
    this.state.events.push({ seq: this.eventSeq, ts: NOW, event, ...(detail ? { detail } : {}) });
  }

  /** State mutation: version bump + ledger event (executor effects only). */
  private bump(event: string, detail?: string): void {
    this.state.version += 1;
    this.event(event, detail);
  }

  private assertOcc(action: AssistantAction, expectedVersion: unknown): void {
    const current = ENT_VERSIONED.has(action) ? this.record.version : this.state.version;
    if (current !== expectedVersion) {
      throw new Error(`version conflict: target state is at version ${current}, proposal expects ${String(expectedVersion)}`);
    }
  }

  // --------------------------------------------------------- proposal core

  private proposeInternal(input: {
    scope: AssistantScope;
    actor: keyof typeof ASSISTANT_DEFINITIONS;
    action: AssistantAction;
    payload: Record<string, unknown>;
  }): { ok: boolean; proposal?: AssistantActionProposal; created?: boolean; error?: string } {
    try {
      const payloadHash = sha256Hex(canonicalJson(input.payload));
      const id = `prop-${sha256Hex(canonicalJson({ e: this.record.id, s: input.scope, a: input.actor, act: input.action, h: payloadHash })).slice(0, 20)}`;
      const existing = this.state.proposals.find((p) => p.id === id);
      if (existing) return { ok: true, proposal: this.clone(existing), created: false };
      const proposal = createAssistantProposal({
        id,
        scope: input.scope,
        actor: input.actor,
        action: input.action,
        payload: this.clone(input.payload),
        expectedVersion: ENT_VERSIONED.has(input.action) ? this.record.version : this.state.version,
        proposedAt: NOW_MS,
      });
      try {
        validateAssistantAction(proposal, null);
      } catch (err) {
        if (!(err instanceof Error && err.message.includes('approval'))) throw err;
      }
      this.state.proposals.push(proposal);
      this.event('assistant-proposed', `${proposal.actor}:${proposal.action} (${proposal.id})`);
      return { ok: true, proposal: this.clone(proposal), created: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private executeAction(action: AssistantAction, payload: Record<string, unknown>): { ok: boolean; summary: string } {
    const st = this.state;
    switch (action) {
      case 'queue.add': {
        const scope = payload.scope as AssistantScope;
        const scopeKey = String(payload.scopeKey);
        const queueId = typeof payload.queueId === 'string' ? payload.queueId : `${scope}:${scopeKey}`;
        let entry = st.queues.get(queueId);
        if (!entry) {
          entry = { queue: { contractVersion: 1, id: queueId, scope, scopeKey, version: 1 }, items: [] };
          st.queues.set(queueId, entry);
        }
        const item = payload.item as { id?: string; itemKind: AssistantQueueItem['itemKind']; refId: string; title?: string; payload?: Record<string, unknown> };
        this.queueItemSeq += 1;
        entry.items.push({
          contractVersion: 1,
          id: item.id ?? `qi-${this.queueItemSeq}`,
          queueId,
          itemKind: item.itemKind,
          refId: item.refId,
          title: item.title ?? item.refId,
          position: entry.items.length + 1,
          status: 'queued',
          payloadHash: sha256Hex(canonicalJson(item.payload ?? {})),
          version: 1,
        });
        return { ok: true, summary: `queued ${item.refId} in ${queueId}` };
      }
      case 'queue.reorder': {
        const entry = st.queues.get(String(payload.queueId));
        if (!entry) return { ok: false, summary: 'unknown queue' };
        const ordered = payload.orderedIds as string[];
        const current = entry.items.map((i) => i.id).sort();
        if (JSON.stringify([...ordered].sort()) !== JSON.stringify(current)) return { ok: false, summary: 'orderedIds must match queue items' };
        const pos = new Map(ordered.map((id, i) => [id, i + 1]));
        for (const item of entry.items) item.position = pos.get(item.id)!;
        entry.queue.version += 1;
        return { ok: true, summary: `reordered ${ordered.length} item(s)` };
      }
      case 'worker.hire': {
        const key = String(payload.contractKey);
        this.record.contracts[key] = {
          status: 'active',
          staffed: true,
          skillId: String(payload.skillId),
          capacityShare: Number(payload.capacityShare ?? 1),
          version: 1,
          fenceCounter: 1,
          lease: null,
        };
        this.record.version += 1;
        return { ok: true, summary: `hired ${key}` };
      }
      case 'worker.pause':
      case 'worker.resume':
      case 'worker.fire': {
        const key = String(payload.contractKey);
        const seat = this.record.contracts[key];
        if (!seat) return { ok: false, summary: `unknown contract ${key}` };
        if (action === 'worker.fire' && (payload.drain !== true || payload.preserveArtifacts !== true)) {
          return { ok: false, summary: 'fire requires drain+preserveArtifacts' };
        }
        seat.status = action === 'worker.pause' ? 'draining' : action === 'worker.resume' ? 'active' : 'released';
        this.record.version += 1;
        return { ok: true, summary: `${action} ${key} (drained, artifacts preserved)` };
      }
      case 'company.pause':
      case 'company.resume':
      case 'company.archive': {
        const key = String(payload.companyKey);
        if (action.endsWith('archive') && (payload.drain !== true || payload.preserveArtifacts !== true)) {
          return { ok: false, summary: 'archive requires drain+preserveArtifacts' };
        }
        st.lifecycle.companies[key] = action.endsWith('pause') ? 'paused' : action.endsWith('resume') ? 'active' : 'archived';
        this.record.version += 1;
        return { ok: true, summary: `${action} ${key}` };
      }
      case 'department.pause':
      case 'department.resume':
      case 'department.archive': {
        const key = String(payload.departmentKey);
        if (action.endsWith('archive') && (payload.drain !== true || payload.preserveArtifacts !== true)) {
          return { ok: false, summary: 'archive requires drain+preserveArtifacts' };
        }
        st.lifecycle.departments[key] = action.endsWith('pause') ? 'paused' : action.endsWith('resume') ? 'active' : 'archived';
        this.record.version += 1;
        return { ok: true, summary: `${action} ${key}` };
      }
      case 'cache.invalidate': {
        const ns = String(payload.namespace) as CacheNamespace;
        const removed = st.cache[ns] ?? 0;
        st.cache[ns] = 0;
        this.record.version += 1;
        return { ok: true, summary: `invalidated ${removed} key(s) in ${ns}` };
      }
      case 'schedule.upsert': {
        const job = createAssistantJob(payload.job as Parameters<typeof createAssistantJob>[0]);
        const existing = st.jobs.get(job.id);
        st.jobs.set(job.id, { ...job, version: (existing?.version ?? 0) + 1 });
        return { ok: true, summary: `${existing ? 'updated' : 'created'} schedule ${job.id} (zero budget, deterministic)` };
      }
      case 'schedule.pause':
      case 'schedule.resume':
      case 'schedule.delete':
      case 'schedule.run_now': {
        const job = st.jobs.get(String(payload.jobId));
        if (!job) return { ok: false, summary: 'unknown job' };
        if (action === 'schedule.delete') {
          st.jobs.delete(job.id);
          return { ok: true, summary: `deleted schedule ${job.id}` };
        }
        if (action === 'schedule.pause') {
          job.enabled = false;
          job.nextRunAt = null;
          return { ok: true, summary: `paused ${job.id}` };
        }
        if (action === 'schedule.resume') {
          job.enabled = true;
          job.nextRunAt = scheduleNextRun(job, NOW_MS);
          return { ok: true, summary: `resumed ${job.id}` };
        }
        if (!job.enabled) return { ok: false, summary: 'cannot run a paused schedule' };
        if (job.maxRuns !== null && job.runCount >= job.maxRuns) return { ok: false, summary: 'maxRuns reached' };
        job.runCount += 1;
        job.lastRunAt = NOW_MS;
        job.nextRunAt = scheduleNextRun(job, NOW_MS);
        if (job.nextRunAt === null) job.enabled = false;
        job.version += 1;
        return { ok: true, summary: `ran ${job.kind} once (deterministic, $0, no provider calls)` };
      }
      case 'study.enqueue': {
        const resources = (payload.resources as Array<{ ref: string; topic?: string }>).filter(
          (r) => !st.studyItems.some((i) => i.skillId === payload.skillId && i.resourceRef === r.ref),
        );
        const items = buildStudyQueue({
          skillId: String(payload.skillId),
          goal: String(payload.goal),
          resources,
          ...(typeof payload.evaluation === 'string' ? { evaluation: payload.evaluation } : {}),
        });
        st.studyItems.push(...items);
        return { ok: true, summary: `enqueued ${items.length} draft study item(s) (deduped, zero provider calls)` };
      }
      case 'repository.import': {
        const url = String(payload.url);
        const previewed = this.previewCache.get(url);
        if (!previewed) return { ok: false, summary: 'no confirmed preview for this url' };
        if (previewed.metadata.visibility !== 'public') return { ok: false, summary: 'private repositories require web credentialed mode' };
        if (st.repositories.size >= 50) return { ok: false, summary: 'repository cap reached (50)' };
        st.repositories.set(url, {
          metadata: previewed.metadata,
          plan: previewed.plan,
          intakeMode: 'public-anonymous',
          appliedAt: null,
          appliedBy: null,
        });
        return { ok: true, summary: `imported public metadata for ${url} (read-only, anonymous)` };
      }
      case 'repository.assign': {
        const repo = st.repositories.get(String(payload.url));
        if (!repo) return { ok: false, summary: 'unknown repository' };
        if (repo.plan.status !== 'assigned') return { ok: false, summary: `plan is "${repo.plan.status}" — only routing-confirmed assignments can be applied` };
        if (repo.appliedAt !== null) return { ok: true, summary: 'already applied (idempotent)' };
        repo.appliedAt = NOW_MS;
        repo.appliedBy = 'ceo';
        return { ok: true, summary: `applied assignment ${repo.plan.companyKey}/${repo.plan.departmentKey}` };
      }
      case 'repository.propose_structure': {
        return { ok: true, summary: 'recorded structural proposal — no companies, departments, or roles were created' };
      }
      case 'knowledge.transfer': {
        return { ok: true, summary: 'recorded knowledge transfer (refs only)' };
      }
      case 'program.pump': {
        this.pumpCalls += 1;
        this.record.version += 1;
        return { ok: true, summary: 'pumped one dispatch round (approved, live provider confirmed)' };
      }
      default:
        return { ok: false, summary: `no executor for ${String(action)}` };
    }
  }

  /** Shared validate+execute used by both the proposal pipeline and direct actions. */
  private decideInternal(req: { proposalId: string; decision: 'approved' | 'rejected'; confirmedGates?: AssistantGate[] }) {
    try {
      const proposal = this.state.proposals.find((p) => p.id === req.proposalId);
      if (!proposal) throw new Error('unknown proposal id');
      if (proposal.status !== 'proposed') throw new Error(`proposal is "${proposal.status}"`);
      const gates = req.confirmedGates ?? [];
      this.assertOcc(proposal.action, proposal.expectedVersion);
      validateAssistantAction(proposal, { approved: req.decision === 'approved', confirmedGates: gates });
      proposal.status = req.decision;
      proposal.decidedAt = NOW_MS;
      if (req.decision === 'approved') this.state.gateConfirmations[proposal.id] = gates;
      this.event(`assistant-${req.decision}`, `${proposal.action} (${proposal.id})`);
      return { ok: true, proposal: this.clone(proposal) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private executeInternal(proposalId: string) {
    try {
      const proposal = this.state.proposals.find((p) => p.id === proposalId);
      if (!proposal) throw new Error('unknown proposal id');
      const policy = ASSISTANT_ACTION_POLICIES[proposal.action];
      if (policy.requiresApproval && proposal.status !== 'approved') throw new Error('proposal requires human approval before execution');
      if (proposal.status !== 'approved' && proposal.status !== 'proposed') throw new Error(`proposal is "${proposal.status}"`);
      this.assertOcc(proposal.action, proposal.expectedVersion);
      const recordedGates = policy.requiresApproval ? (this.state.gateConfirmations[proposal.id] ?? null) : [];
      if (policy.requiresApproval && recordedGates === null) throw new Error('no recorded gate confirmations');
      validateAssistantAction(proposal, { approved: true, confirmedGates: recordedGates ?? [] });
      const result = this.executeAction(proposal.action, proposal.payload);
      proposal.executedAt = NOW_MS;
      proposal.status = result.ok ? 'executed' : 'failed';
      proposal.resultSummary = result.summary;
      this.bump(result.ok ? 'assistant-executed' : 'assistant-failed', `${proposal.action}: ${result.summary.slice(0, 120)}`);
      return { ok: result.ok, proposal: this.clone(proposal), ...(result.ok ? {} : { error: result.summary }) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  lastError = '';
  private directInternal(req: {
    scope: AssistantScope;
    action: AssistantAction;
    payload: Record<string, unknown>;
    expectedVersion: unknown;
    confirmed: boolean;
    confirmedGates?: AssistantGate[];
  }): { ok: boolean; summary?: string; error?: string } {
    try {
      const proposal = createAssistantProposal({
        id: 'direct',
        scope: req.scope,
        actor: 'donna',
        action: req.action,
        payload: req.payload,
        expectedVersion: Number(req.expectedVersion),
        proposedAt: NOW_MS,
      });
      validateAssistantAction(proposal, { approved: req.confirmed === true, confirmedGates: req.confirmedGates ?? [] });
      this.assertOcc(req.action, req.expectedVersion);
      const result = this.executeAction(req.action, req.payload);
      if (!result.ok) return { ok: false, error: result.summary };
      this.bump('assistant-direct', `${req.action}: ${result.summary.slice(0, 120)}`);
      return { ok: true, summary: result.summary };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      return { ok: false, error: this.lastError };
    }
  }

  dto(): AssistantStateDto {
    const st = this.state;
    return this.clone({
      enterpriseId: this.record.id,
      version: st.version,
      eventSeq: this.eventSeq,
      proposals: st.proposals,
      queues: [...st.queues.values()],
      jobs: [...st.jobs.values()],
      studyItems: st.studyItems,
      repositories: [...st.repositories.values()],
      transfers: st.transfers,
      lifecycle: st.lifecycle,
    });
  }

  seedTransfer(): void {
    this.state.transfers.push({
      contractVersion: 1,
      id: 'kt-1',
      refs: [
        {
          artifactId: 'art-1',
          runId: 'run-1',
          nodeKey: 'svc-backend-engineering',
          attempt: 1,
          kind: 'text',
          title: 'Backend brief',
          summary: 'Extractive summary.',
          contentSha256: 'c'.repeat(64),
        },
      ],
      handoff: { from: 'software/svc-backend-engineering', to: 'department-coordinator', summary: 'Handoff summary.' },
      contentSha256: 'd'.repeat(64),
    });
    this.bump('assistant-knowledge', 'seeded transfer');
  }

  raw(): Partial<RawBridge> {
    const self = this;
    const dto = (): AssistantDefinitionsDto => ({
      definitions: Object.values(ASSISTANT_DEFINITIONS) as AssistantDefinitionsDto['definitions'],
      gates: ASSISTANT_GATES,
      actions: ASSISTANT_ACTION_POLICIES as unknown as AssistantDefinitionsDto['actions'],
    });
    return {
      astDefinitions: async () => self.clone(dto()),
      astGet: async () => self.clone(self.dto()),
      astPropose: async (req) => self.proposeInternal(req as never),
      astDecide: async (req) => self.decideInternal(req as never),
      astExecute: async (req) => self.executeInternal(req.proposalId),
      astCancel: async (req) => {
        const p = self.state.proposals.find((x) => x.id === req.proposalId);
        if (!p) return { ok: false, error: 'unknown proposal id' };
        if (p.status === 'executed') return { ok: false, error: 'executed proposals cannot be cancelled' };
        p.status = 'cancelled';
        p.decidedAt = NOW_MS;
        self.event('assistant-cancelled', `${p.action} (${p.id})`);
        return { ok: true, proposal: self.clone(p) };
      },
      astQueueAdd: async (req) =>
        self.directInternal({
          scope: 'enterprise',
          action: 'queue.add',
          payload: { scope: req.scope, scopeKey: req.scopeKey, ...(req.queueId ? { queueId: req.queueId } : {}), item: req.item },
          expectedVersion: req.expectedVersion,
          confirmed: true,
        }),
      astQueueReorder: async (req) =>
        self.directInternal({
          scope: 'enterprise',
          action: 'queue.reorder',
          payload: { queueId: req.queueId, orderedIds: req.orderedIds },
          expectedVersion: req.expectedVersion,
          confirmed: true,
        }),
      astWorkerAction: async (req) => {
        const payload = { ...req.payload };
        if (req.action === 'worker.fire') {
          payload.drain = true;
          payload.preserveArtifacts = true;
        }
        return self.directInternal({
          scope: 'company',
          action: req.action,
          payload,
          expectedVersion: req.expectedVersion,
          confirmed: req.confirmed,
          confirmedGates: req.confirmedGates,
        });
      },
      astLifecycleSet: async (req) => {
        const action = `${req.target}.${req.status === 'active' ? 'resume' : req.status === 'paused' ? 'pause' : 'archive'}` as AssistantAction;
        const payload: Record<string, unknown> = req.target === 'company' ? { companyKey: req.key } : { departmentKey: req.key };
        if (req.status === 'archived') {
          payload.drain = true;
          payload.preserveArtifacts = true;
        }
        return self.directInternal({
          scope: req.target,
          action,
          payload,
          expectedVersion: req.expectedVersion,
          confirmed: req.confirmed,
          confirmedGates: req.confirmedGates,
        });
      },
      astJobUpsert: async (req) =>
        self.directInternal({
          scope: 'enterprise',
          action: 'schedule.upsert',
          payload: { job: req.job },
          expectedVersion: req.expectedVersion,
          confirmed: req.confirmed,
          confirmedGates: req.confirmedGates,
        }),
      astJobPause: async (req) =>
        self.directInternal({ scope: 'enterprise', action: 'schedule.pause', payload: { jobId: req.jobId }, expectedVersion: req.expectedVersion, confirmed: true }),
      astJobResume: async (req) =>
        self.directInternal({ scope: 'enterprise', action: 'schedule.resume', payload: { jobId: req.jobId }, expectedVersion: req.expectedVersion, confirmed: true }),
      astJobDelete: async (req) =>
        self.directInternal({ scope: 'enterprise', action: 'schedule.delete', payload: { jobId: req.jobId }, expectedVersion: req.expectedVersion, confirmed: req.confirmed === true }),
      astJobRunNow: async (req) =>
        self.directInternal({
          scope: 'enterprise',
          action: 'schedule.run_now',
          payload: { jobId: req.jobId },
          expectedVersion: req.expectedVersion,
          confirmed: req.confirmed === true,
          confirmedGates: req.confirmedGates,
        }),
      astStudyEnqueue: async (req) =>
        self.directInternal({
          scope: 'department',
          action: 'study.enqueue',
          payload: { skillId: req.skillId, goal: req.goal, resources: req.resources, ...(req.evaluation ? { evaluation: req.evaluation } : {}) },
          expectedVersion: req.expectedVersion,
          confirmed: true,
        }),
      astStudyList: async () => self.clone(self.state.studyItems),
      astRepoPreview: async (req) => {
        const url = req.url;
        if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(url)) return { ok: false, error: 'unsupported repository url' };
        if (/private/i.test(url)) return { ok: false, error: 'HTTP 404 (anonymous): repository is private or does not exist' };
        const archived = /archived/i.test(url);
        const name = url.split('/').pop()!;
        const topics = /quantum/i.test(url) ? ['quantum', 'photonics'] : ['backend', 'api', 'database', 'rest'];
        const metadata: RepositoryMetadata = {
          url,
          owner: url.split('/')[3]!,
          name,
          description: `${name} repository`,
          language: 'TypeScript',
          topics,
          license: 'MIT',
          archived,
          defaultBranch: 'main',
          commitSha: FULL_SHA,
          visibility: 'public',
        };
        const plan = routeRepository(metadata) as RepoAssignmentPlan;
        self.previewCache.set(url, { metadata, plan });
        return { ok: true, metadata: self.clone(metadata), plan: self.clone(plan) };
      },
      astRepoFetch: async (req) =>
        ((): { ok: boolean; repository?: AssistantRepositoryDto; error?: string } => {
          const res = self.directInternal({
            scope: 'enterprise',
            action: 'repository.import',
            payload: { url: req.url, intakeMode: req.intakeMode },
            expectedVersion: req.expectedVersion,
            confirmed: req.confirmed,
            confirmedGates: req.confirmedGates,
          });
          if (!res.ok) return { ok: false, error: res.error };
          const repo = self.state.repositories.get(req.url);
          return repo ? { ok: true, repository: self.clone(repo) } : { ok: false, error: 'import failed' };
        })(),
      astRepoApply: async (req) =>
        self.directInternal({
          scope: 'enterprise',
          action: 'repository.assign',
          payload: { url: req.url },
          expectedVersion: req.expectedVersion,
          confirmed: req.confirmed,
          confirmedGates: req.confirmedGates,
        }),
      astKnowledgeList: async () => self.clone(self.state.transfers),
      astKnowledgeExport: async () => {
        self.exportCalls += 1;
        return { ok: true, dir: `/tmp/exports/${ENT_ID}/knowledge`, files: self.state.transfers.map((t) => `${t.id}.json`) };
      },
      astCacheInvalidate: async (req) =>
        self.directInternal({
          scope: 'enterprise',
          action: 'cache.invalidate',
          payload: { namespace: req.namespace },
          expectedVersion: req.expectedVersion,
          confirmed: true,
        }),
      astCacheStatus: async (): Promise<AssistantCacheStatusDto[]> =>
        (Object.entries(self.state.cache) as Array<[CacheNamespace, number]>).map(([namespace, keys]) => ({ namespace, keys })),
      astEvents: async (req) => {
        const events = self.state.events.slice(req.afterIndex ?? 0, (req.afterIndex ?? 0) + (req.limit ?? 200));
        return { events: self.clone(events), nextIndex: (req.afterIndex ?? 0) + events.length };
      },
      astDonnaPrompt: async (req) => {
        if (!req.objective.trim()) return { ok: false, error: 'objective must be non-empty' };
        return { ok: true, prompt: buildDonnaPrompt({ objective: req.objective, ledgerContext: '#1 demo ledger line' }) };
      },
      astDonnaParse: async (req) => {
        const candidates = extractJsonCandidates(req.text);
        const proposals: AssistantActionProposal[] = [];
        let dropped = 0;
        for (const candidate of candidates) {
          const c = candidate as { action?: unknown; payload?: unknown; scope?: unknown; actor?: unknown };
          if (typeof c.action !== 'string' || !(c.action in ASSISTANT_ACTION_POLICIES) || typeof c.payload !== 'object' || c.payload === null) {
            dropped += 1;
            continue;
          }
          const res = self.proposeInternal({
            scope: (typeof c.scope === 'string' ? c.scope : req.scope ?? 'enterprise') as AssistantScope,
            actor: (typeof c.actor === 'string' ? c.actor : req.actor ?? 'donna') as keyof typeof ASSISTANT_DEFINITIONS,
            action: c.action as AssistantAction,
            payload: c.payload as Record<string, unknown>,
          });
          if (res.ok && res.proposal) proposals.push(res.proposal);
          else dropped += 1;
        }
        return { ok: true, proposals: self.clone(proposals), dropped };
      },
      onAssistantEvent: (listener) => {
        self.listeners.push(listener as (e: unknown) => void);
        return () => undefined;
      },
    };
  }
}

// ----------------------------------------------------------------- chat fake

interface ChatMsgInit {
  role: 'user' | 'assistant';
  status: ChatMessage['status'];
  text: string;
}

function makeChatMessage(init: ChatMsgInit, n: number): ChatMessage {
  return {
    id: `msg-${n}`,
    role: init.role,
    status: init.status,
    text: init.text,
    error: null,
    usage: init.status === 'completed' && init.role === 'assistant' ? { inputTokens: 100, outputTokens: 50, costUsd: 0.001 } : null,
    provenance:
      init.status === 'completed' && init.role === 'assistant'
        ? { provider: 'openai', model: 'gpt-5.2', skillIds: [], skillSha256: {}, promptSha256: 'p'.repeat(64), textSha256: sha256Hex(init.text) }
        : null,
    actions: [],
    createdAt: NOW,
    finishedAt: init.status === 'completed' ? NOW : null,
  };
}

class FakeChat {
  sessions = new Map<string, ChatSession>();
  private seq = 0;

  constructor(private readonly ast: FakeAstBackend) {}

  completePending(sessionId: string, text: string): void {
    const s = this.sessions.get(sessionId);
    const pending = s?.messages.find((m) => m.role === 'assistant' && m.status === 'pending');
    if (!s || !pending) throw new Error('no pending assistant message');
    this.seq += 1;
    const done = makeChatMessage({ role: 'assistant', status: 'completed', text }, this.seq);
    Object.assign(pending, done, { id: pending.id });
    s.updatedAt = NOW;
  }

  raw(): Partial<RawBridge> {
    const self = this;
    return {
      chatCreateSession: async (req: CreateChatSessionRequest) => {
        self.seq += 1;
        const session: ChatSession = {
          id: `chat-${self.seq}`,
          title: req.title ?? 'Chat',
          ...(req.mode ? { mode: req.mode } : {}),
          projectId: req.projectId ?? null,
          provider: req.provider,
          model: req.model,
          skillIds: req.skillIds ?? [],
          priceRates: req.priceRates,
          budget: {
            maxTokens: req.budget?.maxTokens ?? 100_000,
            maxMinutes: req.budget?.maxMinutes ?? 30,
            maxUsd: req.budget?.maxUsd ?? 5,
          },
          usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, elapsedSeconds: 0 },
          messages: [],
          createdAt: NOW,
          updatedAt: NOW,
        };
        self.sessions.set(session.id, session);
        return { ok: true, session: JSON.parse(JSON.stringify(session)) as ChatSession };
      },
      chatListSessions: async () =>
        [...self.sessions.values()].map((s) => {
          const { messages, ...rest } = s;
          return JSON.parse(JSON.stringify({ ...rest, messageCount: messages.length })) as never;
        }),
      chatGetSession: async (id: string) => {
        const s = self.sessions.get(id);
        return s ? (JSON.parse(JSON.stringify(s)) as ChatSession) : null;
      },
      chatSendMessage: async (req) => {
        const s = self.sessions.get(req.sessionId);
        if (!s) return { ok: false, error: 'unknown session' };
        if (req.confirmed !== true) return { ok: false, error: 'send requires confirmed:true' };
        self.ast.providerSendCalls += 1;
        self.seq += 1;
        const user = makeChatMessage({ role: 'user', status: 'completed', text: req.text }, self.seq);
        self.seq += 1;
        const assistant = makeChatMessage({ role: 'assistant', status: 'pending', text: '' }, self.seq);
        s.messages.push(user, assistant);
        s.updatedAt = NOW;
        return { ok: true, userMessageId: user.id, assistantMessageId: assistant.id };
      },
      chatStop: async (id: string) => {
        self.ast.chatStopCalls += 1;
        const s = self.sessions.get(id);
        const pending = s?.messages.find((m) => m.role === 'assistant' && m.status === 'pending');
        if (s && pending) {
          pending.status = 'cancelled';
          pending.finishedAt = NOW;
        }
        return { ok: true };
      },
    };
  }
}

// ---------------------------------------------------------------------- boot

interface Booted {
  app: EnterpriseApp;
  root: HTMLElement;
  ast: FakeAstBackend;
  chat: FakeChat;
  adapter: BridgeAdapter;
}

function boot(opts: { v6?: boolean } = {}): Booted {
  mountChromeDom();
  const root = document.createElement('div');
  document.body.append(root);
  const overlay = createOverlayHost(document.getElementById('overlay-root')!);
  overlay.confirm = () => Promise.resolve(true);
  const ast = new FakeAstBackend(makeRecord());
  const chat = new FakeChat(ast);
  const record = ast.record;
  const raw: Partial<RawBridge> = {
    version: opts.v6 === false ? 5 : 6,
    listSkills: async () => fakeSkills(),
    listProviderModels: async () => ({ ok: true, models: [] }),
    getProject: async () => null,
    listProjects: async () => [],
    entList: async () => [
      {
        id: record.id,
        programId: record.programId,
        name: record.name,
        state: record.state,
        version: record.version,
        blueprintHash: record.blueprintHash,
        programState: record.program?.state ?? null,
        programPaused: record.programPaused,
        companyCount: Object.keys(record.companies).length,
        departmentCount: Object.keys(record.departments).length,
        contractCount: Object.keys(record.contracts).length,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    ],
    entSnapshot: async () => ({ record: JSON.parse(JSON.stringify(record)) as EnterpriseRecordDto, view: null, stewards: [] }),
    entContracts: async () =>
      Object.entries(record.contracts).map(([key, c]) => ({
        key,
        companyKey: key.split('--')[0]!,
        departmentKey: key.split('--')[1]!,
        discipline: 'backend-engineering',
        ...(JSON.parse(JSON.stringify(c)) as object),
      })) as never,
    entLedger: async () => [],
    entCreate: async () => ({ ok: true, record: JSON.parse(JSON.stringify(record)) as EnterpriseRecordDto, created: false }),
    entProgramStart: async () => ({ ok: true, record: JSON.parse(JSON.stringify(record)) as EnterpriseRecordDto }),
    entProgramCancel: async () => {
      ast.programCancelCalls += 1;
      if (record.program) record.program.state = 'cancelled';
      record.version += 1;
      return { ok: true, record: JSON.parse(JSON.stringify(record)) as EnterpriseRecordDto };
    },
    ...chat.raw(),
    ...(opts.v6 === false ? {} : ast.raw()),
  };
  const adapter = new BridgeAdapter(raw as RawBridge);
  const { factory } = makeFakePanzoom();
  const app = createEnterpriseApp({ root, adapter, overlay, panzoomFactory: factory as never, openProject: () => undefined });
  const booted = { app, root, ast, chat, adapter };
  bootedByRoot.set(root, booted);
  return booted;
}

async function bootOpen(opts: { v6?: boolean } = {}): Promise<Booted> {
  const b = boot(opts);
  await b.app.show();
  await flush(30);
  await b.app.donna.open();
  await flush(30);
  return b;
}

function tab(root: HTMLElement, name: string): void {
  const btn = [...root.querySelectorAll<HTMLButtonElement>('.donna-tab')].find((b) => b.textContent?.trim() === name);
  if (!btn) throw new Error(`tab "${name}" not found`);
  btn.click();
}

/** Check every gate checkbox under a focus-key prefix and fire change events. */
function confirmGates(root: HTMLElement, prefix: string): void {
  const boxes = [...root.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][data-focus-key^="${prefix}"]`)];
  if (boxes.length === 0) throw new Error(`no gate checkboxes for "${prefix}"`);
  for (const box of boxes) {
    box.checked = true;
    box.dispatchEvent(new Event('change'));
  }
}

function submitForm(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { cancelable: true }));
}

const BACKEND_URL = 'https://github.com/acme/backend-services';

async function importBackendRepo(root: HTMLElement): Promise<void> {
  tab(root, 'Repositories');
  const urlInput = root.querySelector<HTMLInputElement>('[data-focus-key="donna-repo-url"]')!;
  urlInput.value = BACKEND_URL;
  submitForm(urlInput.closest('form')!);
  await flush(30);
  const card = root.querySelector('.donna-repo-preview');
  expect(card?.textContent).toContain(FULL_SHA);
  confirmGates(root, 'gate-repo-fetch-');
  root.querySelector<HTMLButtonElement>('[data-focus-key="donna-repo-import"]')!.click();
  await flush(30);
}

beforeEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------- tests

describe('bridge adapter: v6 capability gating', () => {
  it('reports UNAVAILABLE_V6 for every ast* method against a v5 raw bridge', async () => {
    const adapter = new BridgeAdapter({ version: 5 } as RawBridge);
    expect(adapter.capabilities.assistant).toBe(false);
    for (const res of [
      await adapter.astDefinitions(),
      await adapter.astGet('ent-1'),
      await adapter.astPropose({ enterpriseId: 'ent-1', scope: 'enterprise', actor: 'donna', action: 'program.pump', payload: {} }),
      await adapter.astQueueAdd({
        enterpriseId: 'ent-1',
        scope: 'enterprise',
        scopeKey: 'ctg-2026',
        item: { itemKind: 'custom', refId: 'x' },
        expectedVersion: 1,
      }),
      await adapter.astEvents({ enterpriseId: 'ent-1' }),
    ]) {
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe(UNAVAILABLE_V6);
        expect(res.unavailable).toBe(true);
      }
    }
    expect(adapter.onAssistantEvent(() => undefined)).toBeNull();
  });
});

describe('Donna drawer: open + degraded modes', () => {
  it('v5 bridge: drawer opens with the honest unavailable panel, no fabricated state', async () => {
    const { root } = await bootOpen({ v6: false });
    const drawer = root.querySelector('.donna-drawer')!;
    expect(drawer.classList.contains('hidden')).toBe(false);
    expect(drawer.textContent).toContain('requires desktop 0.6 runtime');
    expect(drawer.querySelector('.donna-tabs')).toBeNull();
    expect(drawer.textContent).not.toContain('Proposal inbox');
  });

  it('v6 bridge: tabs, scope metadata, and permanent agents under Donna (steward mapped to existing roles)', async () => {
    const { root } = await bootOpen();
    const drawer = root.querySelector('.donna-drawer')!;
    for (const name of ['Queue', 'Hiring', 'Schedules', 'Cache', 'Repositories', 'Knowledge', 'Donna Chat']) {
      expect([...drawer.querySelectorAll('.donna-tab')].some((t) => t.textContent === name), `tab ${name}`).toBe(true);
    }
    expect(drawer.textContent).toContain('Acting assistant: Donna');
    expect(drawer.textContent).toContain('non-bypassable gates');
    const agents = drawer.querySelector('.donna-agents')!;
    expect(agents.textContent).toContain('Permanent agents under Donna');
    expect(agents.textContent).toContain('Company Operations Assistant');
    expect(agents.textContent).toContain('Department Coordinator');
    expect(agents.textContent).toContain('Repository Integration Steward');
    expect(agents.textContent).toContain('deterministic · no provider calls');
    expect(agents.textContent).toContain('digital employee · mapped existing roles: api-integration-engineer, knowledge-transfer-learning-systems-manager');
  });

  it('scope selector switches scope and the acting-assistant metadata follows', async () => {
    const { root } = await bootOpen();
    const sel = root.querySelector<HTMLSelectElement>('[data-focus-key="donna-scope"]')!;
    sel.value = 'company';
    sel.dispatchEvent(new Event('change'));
    await flush(30);
    expect(root.querySelector('.donna-scope-meta')!.textContent).toContain('Company Operations Assistant');
    sel.value = 'department';
    sel.dispatchEvent(new Event('change'));
    await flush(30);
    expect(root.querySelector('.donna-scope-meta')!.textContent).toContain('Department Coordinator');
  });
});

describe('Queue tab', () => {
  it('add → status → reorder; queue pump is a gated proposal, never direct', async () => {
    const { root, ast } = await bootOpen();
    const form = root.querySelector<HTMLFormElement>('.donna-section form')!;
    const [kindSel, refInput, titleInput] = [...form.querySelectorAll<HTMLElement>('select, input')];
    (kindSel as HTMLSelectElement).value = 'custom';
    (refInput as HTMLInputElement).value = 'run-civilization-1';
    (titleInput as HTMLInputElement).value = 'Civilization run';
    submitForm(form);
    await flush(30);
    expect(root.textContent).toContain('Civilization run');
    expect(root.querySelector('.donna-queue-items')!.textContent).toContain('queued');

    // second item, then reorder the first one down
    (refInput as HTMLInputElement).value = 'run-software-1';
    (titleInput as HTMLInputElement).value = 'Software run';
    submitForm(form);
    await flush(30);
    const downBtn = root.querySelector<HTMLButtonElement>('[aria-label="Move qi-1 down"]')!;
    downBtn.click();
    await flush(30);
    const ids = [...root.querySelectorAll('.donna-queue-items li')].map((li) => li.textContent);
    expect(ids[0]).toContain('Software run');
    expect(ids[1]).toContain('Civilization run');

    // approved mock pump: propose → inbox → gates → approve → execute
    root.querySelector<HTMLButtonElement>('[data-focus-key="donna-propose-pump"]')!.click();
    await flush(30);
    const proposal = ast.state.proposals.find((p) => p.action === 'program.pump');
    expect(proposal, 'pump proposal in inbox').toBeTruthy();
    expect(proposal!.status).toBe('proposed');
    expect(ast.pumpCalls).toBe(0);

    const approve = root.querySelector<HTMLButtonElement>(`[data-focus-key="approve-${proposal!.id}"]`)!;
    expect(approve.disabled, 'approve disabled until gates confirmed').toBe(true);
    confirmGates(root, `gate-${proposal!.id}-`);
    expect(approve.disabled).toBe(false);
    approve.click();
    await flush(30);
    expect(ast.state.proposals.find((p) => p.id === proposal!.id)!.status).toBe('approved');
    expect(ast.pumpCalls).toBe(0);

    root.querySelector<HTMLButtonElement>(`[data-focus-key="execute-${proposal!.id}"]`)!.click();
    await flush(30);
    expect(ast.state.proposals.find((p) => p.id === proposal!.id)!.status).toBe('executed');
    expect(ast.pumpCalls).toBe(1);
    expect(root.textContent).toContain('no mock program mode');

    // idempotent re-propose returns the same proposal, no duplicate
    root.querySelector<HTMLButtonElement>('[data-focus-key="donna-propose-pump"]')!.click();
    await flush(30);
    expect(ast.state.proposals.filter((p) => p.action === 'program.pump').length).toBe(1);

    // ledger events recorded
    const events = ast.state.events.map((e) => e.event);
    expect(events).toContain('assistant-proposed');
    expect(events).toContain('assistant-approved');
    expect(events).toContain('assistant-executed');
    expect(root.querySelector('.donna-events')!.textContent).toContain('assistant-executed');
  });

  it('study enqueue dedupes resource refs and stays draft with zero provider calls', async () => {
    const { root, ast } = await bootOpen();
    const studyForm = root.querySelector<HTMLFormElement>('.donna-study form')!;
    const inputs = studyForm.querySelectorAll('input');
    (inputs[0] as HTMLInputElement).value = 'Learn spatial indexing';
    (inputs[1] as HTMLInputElement).value = 'res://geo-1, res://geo-1, res://geo-2';
    submitForm(studyForm);
    await flush(30);
    expect(ast.state.studyItems.length).toBe(2);
    expect(ast.state.studyItems.every((i) => i.status === 'draft' && i.providerCalls === false)).toBe(true);
    expect(root.querySelector('.donna-study')!.textContent).toContain('res://geo-1');
    expect(ast.providerSendCalls).toBe(0);
  });
});

describe('Hiring tab', () => {
  it('hire requires the plan-approval gate and lands a new seat', async () => {
    const { root, ast } = await bootOpen();
    tab(root, 'Hiring');
    const form = root.querySelector<HTMLFormElement>('.donna-section form')!;
    const keyInput = form.querySelector<HTMLInputElement>('input[aria-label="Contract key"]')!;
    keyInput.value = 'software--svc-backend-engineering--senior';
    const hireBtn = form.querySelector<HTMLButtonElement>('[data-focus-key="donna-hire-submit"]')!;
    expect(hireBtn.disabled).toBe(true);
    confirmGates(root, 'gate-hire-');
    expect(hireBtn.disabled).toBe(false);
    submitForm(form);
    await flush(30);
    expect(ast.record.contracts['software--svc-backend-engineering--senior']?.status).toBe('active');
  });

  it('fire drains and preserves (gated), pause/resume flip seat status', async () => {
    const { root, ast } = await bootOpen();
    tab(root, 'Hiring');
    const key = 'music--svc-music-production';
    const fireBtn = root.querySelector<HTMLButtonElement>(`[data-focus-key="fire-${key}"]`)!;
    expect(fireBtn.disabled, 'fire disabled until high-risk + plan-approval confirmed').toBe(true);
    confirmGates(root, `gate-fire-${key}-`);
    expect(fireBtn.disabled).toBe(false);
    fireBtn.click(); // overlay.confirm auto-accepts
    await flush(30);
    expect(ast.record.contracts[key]!.status).toBe('released');

    const other = 'software--svc-backend-engineering';
    const seat = [...root.querySelectorAll('.donna-seat')].find((s) => s.textContent!.includes(other))!;
    const [pauseBtn] = [...seat.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent === 'Pause');
    pauseBtn!.click();
    await flush(30);
    expect(ast.record.contracts[other]!.status).toBe('draining');
    await flush(30);
    const seat2 = [...root.querySelectorAll('.donna-seat')].find((s) => s.textContent!.includes(other))!;
    const [resumeBtn] = [...seat2.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent === 'Resume');
    resumeBtn!.click();
    await flush(30);
    expect(ast.record.contracts[other]!.status).toBe('active');
  });

  it('company archive is gated, drain+preserve, and reflected in lifecycle state', async () => {
    const { root, ast } = await bootOpen();
    tab(root, 'Hiring');
    const archiveBtn = root.querySelector<HTMLButtonElement>('[data-focus-key="lc-company-music-archived"]')!;
    expect(archiveBtn.disabled).toBe(true);
    confirmGates(root, 'gate-lc-company-music-');
    expect(archiveBtn.disabled).toBe(false);
    archiveBtn.click();
    await flush(30);
    expect(ast.state.lifecycle.companies['music']).toBe('archived');
  });
});

describe('Schedules tab', () => {
  it('CRUD + gated run-now; zero budget, nextRun, maxRuns terminator; no provider calls', async () => {
    const { root, ast } = await bootOpen();
    tab(root, 'Schedules');
    expect(root.textContent).toContain('no paid calls');
    expect(root.textContent).toContain('no catch-up storm');

    const form = root.querySelector<HTMLFormElement>('.donna-section form')!;
    const idInput = form.querySelector<HTMLInputElement>('input[aria-label="Job id"]')!;
    idInput.value = 'nightly-ledger';
    const maxRunsInput = form.querySelector<HTMLInputElement>('input[aria-label="Maximum runs"]')!;
    maxRunsInput.value = '1';
    const saveBtn = form.querySelector<HTMLButtonElement>('[data-focus-key="donna-job-upsert"]')!;
    expect(saveBtn.disabled).toBe(true);
    confirmGates(root, 'gate-job-upsert-');
    expect(saveBtn.disabled).toBe(false);
    submitForm(form);
    await flush(30);

    const job = ast.state.jobs.get('nightly-ledger')!;
    expect(job.budget).toEqual({ maxTokens: 0, maxCalls: 0, maxMinutes: 0, maxCostUsdMicros: 0 });
    expect(job.nextRunAt).not.toBeNull();
    expect(job.maxRuns).toBe(1);
    expect(root.textContent).toContain('zero reservation');

    // run now is gated
    const runNow = root.querySelector<HTMLButtonElement>('[data-focus-key="runnow-nightly-ledger"]')!;
    expect(runNow.disabled).toBe(true);
    confirmGates(root, 'gate-runnow-nightly-ledger-');
    expect(runNow.disabled).toBe(false);
    runNow.click();
    await flush(30);
    const ran = ast.state.jobs.get('nightly-ledger')!;
    expect(ran.runCount).toBe(1);
    expect(ran.enabled, 'maxRuns=1 hard terminator disables the job').toBe(false);
    expect(ran.nextRunAt).toBeNull();

    // pause/resume/delete on a fresh job
    idInput.value = 'cache-sweeper';
    submitForm(form);
    await flush(30);
    const card = [...root.querySelectorAll('.donna-job')].find((c) => c.textContent!.includes('cache-sweeper'))!;
    const [pauseBtn] = [...card.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent === 'Pause');
    pauseBtn!.click();
    await flush(30);
    expect(ast.state.jobs.get('cache-sweeper')!.enabled).toBe(false);
    const card2 = [...root.querySelectorAll('.donna-job')].find((c) => c.textContent!.includes('cache-sweeper'))!;
    const [resumeBtn] = [...card2.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent === 'Resume');
    resumeBtn!.click();
    await flush(30);
    expect(ast.state.jobs.get('cache-sweeper')!.enabled).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-focus-key="deletejob-cache-sweeper"]')!.click();
    await flush(30);
    expect(ast.state.jobs.has('cache-sweeper')).toBe(false);

    expect(ast.providerSendCalls, 'schedules never trigger provider calls').toBe(0);
  });
});

describe('Cache tab', () => {
  it('namespace status + invalidate; provider responses are never cached', async () => {
    const { root, ast } = await bootOpen();
    tab(root, 'Cache');
    expect(root.textContent).toContain('provider responses are never cached');
    expect(root.querySelector('.donna-cache-row')!.textContent).toContain('skill-excerpts');
    root.querySelector<HTMLButtonElement>('[data-focus-key="cache-invalidate-skill-excerpts"]')!.click();
    await flush(30);
    expect(ast.state.cache['skill-excerpts']).toBe(0);
    expect(ast.state.cache['blueprint']).toBe(1);
  });
});

describe('Repositories tab', () => {
  it('preview shows full SHA/license/archived/confidence; import + gated apply of the selected route', async () => {
    const { root, ast } = await bootOpen();
    await importBackendRepo(root);
    const repo = ast.state.repositories.get(BACKEND_URL)!;
    expect(repo.metadata.commitSha).toBe(FULL_SHA);
    expect(repo.plan.status).toBe('assigned');
    expect(repo.plan.companyKey).toBe('software');
    expect(repo.intakeMode).toBe('public-anonymous');
    expect(root.textContent).toContain('cap 50');

    // apply approved assignment (plan-approval gate)
    const applyBtn = root.querySelector<HTMLButtonElement>('[data-focus-key="apply-backend-services"]')!;
    expect(applyBtn.disabled).toBe(true);
    confirmGates(root, 'gate-apply-backend-services-');
    expect(applyBtn.disabled).toBe(false);
    applyBtn.click();
    await flush(30);
    expect(ast.state.repositories.get(BACKEND_URL)!.appliedAt).not.toBeNull();
    expect(ast.providerSendCalls, 'repo intake never calls a provider').toBe(0);
  });

  it('archived repo previews as quarantined with no import control', async () => {
    const { root, ast } = await bootOpen();
    tab(root, 'Repositories');
    const urlInput = root.querySelector<HTMLInputElement>('[data-focus-key="donna-repo-url"]')!;
    urlInput.value = 'https://github.com/acme/archived-lib';
    submitForm(urlInput.closest('form')!);
    await flush(30);
    const card = root.querySelector('.donna-repo-preview')!;
    expect(card.textContent).toContain('quarantined');
    expect(card.textContent).toContain('archived YES');
    expect(card.querySelector('[data-focus-key="donna-repo-import"]')).toBeNull();
    expect(ast.state.repositories.size).toBe(0);
  });

  it('private repo directs to web credentialed mode and stores nothing', async () => {
    const { root, ast } = await bootOpen();
    tab(root, 'Repositories');
    const urlInput = root.querySelector<HTMLInputElement>('[data-focus-key="donna-repo-url"]')!;
    urlInput.value = 'https://github.com/acme/private-repo';
    submitForm(urlInput.closest('form')!);
    await flush(30);
    expect(root.querySelector('.donna-repo-preview')).toBeNull();
    expect(document.body.textContent).toContain('web app credentialed mode');
    expect(ast.state.repositories.size).toBe(0);
  });

  it('new-domain repo routes to proposed_new_structure; structural proposal is explicit and creates nothing', async () => {
    const { root, ast } = await bootOpen();
    await importBackendRepo(root); // stored repo needed? no — structure proposal works from preview only
    tab(root, 'Repositories');
    const urlInput = root.querySelector<HTMLInputElement>('[data-focus-key="donna-repo-url"]')!;
    urlInput.value = 'https://github.com/acme/quantum-photonics';
    submitForm(urlInput.closest('form')!);
    await flush(30);
    const card = root.querySelector('.donna-repo-preview')!;
    expect(card.textContent).toContain('proposed_new_structure');
    expect(card.textContent).toContain('never auto-creates');
  });

  it('stored proposed_new_structure repo offers an explicit structural inbox proposal (gated, creates nothing)', async () => {
    const { root, ast } = await bootOpen();
    // Seed a stored new-structure repository directly (the UI only imports
    // routing-confirmed "assigned" plans, so this covers the stored-row path).
    const url = 'https://github.com/acme/quantum-photonics';
    const metadata: RepositoryMetadata = {
      url,
      owner: 'acme',
      name: 'quantum-photonics',
      description: 'quantum photonics research',
      language: 'Python',
      topics: ['quantum', 'photonics'],
      license: 'MIT',
      archived: false,
      defaultBranch: 'main',
      commitSha: FULL_SHA,
      visibility: 'public',
    };
    ast.state.repositories.set(url, {
      metadata,
      plan: routeRepository(metadata) as RepoAssignmentPlan,
      intakeMode: 'public-anonymous',
      appliedAt: null,
      appliedBy: null,
    });
    const { app } = { app: rootApp(root) };
    void app;
    await refreshDrawer(root);
    tab(root, 'Repositories');
    const proposeBtn = root.querySelector<HTMLButtonElement>('[data-focus-key="propose-structure-quantum-photonics"]')!;
    proposeBtn.click();
    await flush(30);
    const proposal = ast.state.proposals.find((p) => p.action === 'repository.propose_structure')!;
    expect(proposal.status).toBe('proposed');
    expect(proposal.actor).toBe('repository-integration-steward');
    const card = root.querySelector(`.donna-proposal[data-proposal-id="${proposal.id}"]`)!;
    expect(card.textContent).toContain('Structural: explicit proposal only');
    const approve = card.querySelector<HTMLButtonElement>(`[data-focus-key="approve-${proposal.id}"]`)!;
    expect(approve.disabled).toBe(true);
    confirmGates(root, `gate-${proposal.id}-`);
    approve.click();
    await flush(30);
    root.querySelector<HTMLButtonElement>(`[data-focus-key="execute-${proposal.id}"]`)!.click();
    await flush(30);
    const done = ast.state.proposals.find((p) => p.id === proposal.id)!;
    expect(done.status).toBe('executed');
    expect(done.resultSummary).toContain('no companies, departments, or roles');
    expect(Object.keys(ast.record.companies).length, 'no structures auto-created').toBe(2);
  });
});

describe('Knowledge tab', () => {
  it('lists transfers (refs + handoff + hash) and exports the bundle', async () => {
    const { root, ast, app } = await bootOpen();
    ast.seedTransfer();
    await app.donna.refresh();
    tab(root, 'Knowledge');
    expect(root.textContent).toContain('software/svc-backend-engineering → department-coordinator');
    expect(root.textContent).toContain('1 ref(s)');
    const exportBtn = root.querySelector<HTMLButtonElement>('[data-focus-key="donna-knowledge-export"]')!;
    expect(exportBtn.disabled).toBe(false);
    exportBtn.click();
    await flush(30);
    expect(ast.exportCalls).toBe(1);
    expect(document.body.textContent).toContain('/tmp/exports/ent-1/knowledge');
  });
});

describe('Donna Chat tab', () => {
  it('creates a mode:donna budgeted session; send → pending → stop', async () => {
    const { root, ast, chat } = await bootOpen();
    tab(root, 'Donna Chat');
    root.querySelector<HTMLButtonElement>('[data-focus-key="donna-chat-start"]')!.click();
    await flush(30);
    const session = [...chat.sessions.values()][0]!;
    expect(session.mode).toBe('donna');
    expect(session.provider).toBe('openai');
    expect(session.budget.maxUsd).toBe(5);

    const input = root.querySelector<HTMLTextAreaElement>('[data-focus-key="donna-chat-input"]')!;
    input.value = 'Draft next steps for the software company';
    submitForm(input.closest('form')!);
    await flush(30);
    expect(ast.providerSendCalls).toBe(1);
    expect(root.textContent).toContain('pending — waiting for the provider');

    const stopBtn = root.querySelector<HTMLButtonElement>('[data-focus-key="donna-chat-stop"]')!;
    expect(stopBtn.disabled).toBe(false);
    stopBtn.click();
    await flush(30);
    expect(ast.chatStopCalls).toBe(1);
    expect(root.textContent).toContain('stopped before the paid call completed');
  });

  it('completed reply parses into DRAFT inbox proposals only — nothing executes without gates', async () => {
    const { root, ast, chat, app } = await bootOpen();
    tab(root, 'Donna Chat');
    root.querySelector<HTMLButtonElement>('[data-focus-key="donna-chat-start"]')!.click();
    await flush(30);
    const session = [...chat.sessions.values()][0]!;
    const input = root.querySelector<HTMLTextAreaElement>('[data-focus-key="donna-chat-input"]')!;
    input.value = 'Propose a queue item';
    submitForm(input.closest('form')!);
    await flush(30);
    chat.completePending(
      session.id,
      'Here is my advice:\n```json\n[{"action":"queue.add","payload":{"scope":"enterprise","scopeKey":"ctg-2026","item":{"itemKind":"custom","refId":"run-9"}}},{"action":"magic.destroy","payload":{}},42]\n```',
    );
    await app.donna.chatPollOnce();
    await flush(30);

    expect(ast.state.proposals.length).toBe(1);
    const draft = ast.state.proposals[0]!;
    expect(draft.action).toBe('queue.add');
    expect(draft.status).toBe('proposed');
    expect(ast.state.queues.size, 'nothing executed by the parse').toBe(0);
    expect(ast.providerSendCalls).toBe(1);
    expect(root.textContent).toContain('1 draft proposal(s) into the inbox');
    expect(root.textContent).toContain('2 untrusted block(s) dropped');
    // typed inbox card
    const cardEl = root.querySelector(`.donna-proposal[data-proposal-id="${draft.id}"]`)!;
    expect(cardEl.textContent).toContain('payload sha256');
    expect(cardEl.textContent).toContain('OCC v');
    expect(cardEl.textContent).toContain('donna → enterprise');
    // queue.add is approval-free: execute straight from proposed via the inbox
    cardEl.querySelector<HTMLButtonElement>(`[data-focus-key="execute-${draft.id}"]`)!.click();
    await flush(30);
    expect(ast.state.queues.size).toBe(1);
  });
});

describe('Emergency stop', () => {
  it('is a direct existing cancel (program + chat), never a proposal', async () => {
    const { root, ast } = await bootOpen();
    tab(root, 'Donna Chat');
    root.querySelector<HTMLButtonElement>('[data-focus-key="donna-chat-start"]')!.click();
    await flush(30);
    const input = root.querySelector<HTMLTextAreaElement>('[data-focus-key="donna-chat-input"]')!;
    input.value = 'objective';
    submitForm(input.closest('form')!);
    await flush(30);
    expect(ast.providerSendCalls).toBe(1);

    const proposalsBefore = ast.state.proposals.length;
    root.querySelector<HTMLButtonElement>('[data-focus-key="donna-emergency-stop"]')!.click();
    await flush(30);
    expect(ast.programCancelCalls).toBe(1);
    expect(ast.chatStopCalls).toBe(1);
    expect(ast.record.program!.state).toBe('cancelled');
    expect(ast.state.proposals.length, 'emergency stop never travels the proposal pipeline').toBe(proposalsBefore);
    expect(ast.state.proposals.some((p) => (p.action as string).includes('emergency'))).toBe(false);
  });
});

// Small helpers used by individual edge-case tests.

/** Find the Booted app for a mounted root (roots are registered at boot). */
const bootedByRoot = new Map<HTMLElement, Booted>();
function rootApp(root: HTMLElement): EnterpriseApp {
  const b = bootedByRoot.get(root);
  if (!b) throw new Error('root not registered');
  return b.app;
}

async function refreshDrawer(root: HTMLElement): Promise<void> {
  await rootApp(root).donna.refresh();
  await flush(30);
}
