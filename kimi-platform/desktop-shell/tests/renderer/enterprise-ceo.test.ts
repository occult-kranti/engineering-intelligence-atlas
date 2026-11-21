// @vitest-environment jsdom
/**
 * CEO Portfolio (v0.5) renderer tests.
 *
 *  - Byte-parity: the renderer's browser-safe ports (hash/partition/actions)
 *    are pinned against src/shared/enterprise.ts and the golden fixture.
 *  - UI flows run against a stateful fake v5 bridge that mirrors main
 *    semantics (OCC, approval gates, idempotent create/apply, contract
 *    lifecycle, memory promote/revoke, ledger filters, timeline afterIndex)
 *    using the REAL shared blueprint generator + deriveEnterpriseView.
 */

import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ENTERPRISE_ACTIONS as SHARED_ACTIONS,
  DISCIPLINES as SHARED_DISCIPLINES,
  blueprintHash as sharedBlueprintHash,
  canonicalJson as sharedCanonicalJson,
  deriveEnterpriseView,
  generateEnterpriseBlueprint,
  partitionBudget as sharedPartitionBudget,
  sha256Hex as sharedSha256Hex,
  type EnterpriseBlueprint,
  type PartitionRequest,
} from '../../src/shared/enterprise';
import { BridgeAdapter, type RawBridge } from '../../src/renderer/office/bridge';
import { createOverlayHost } from '../../src/renderer/office/overlay';
import { createEnterpriseApp, type EnterpriseApp } from '../../src/renderer/enterprise/app';
import { blueprintHash, canonicalJson, sha256Hex } from '../../src/renderer/enterprise/hash';
import { partitionBudget } from '../../src/renderer/enterprise/partition';
import { DISCIPLINES, ENTERPRISE_ACTIONS } from '../../src/renderer/enterprise/actions';
import type {
  EnterpriseApprovalDto,
  EnterpriseContractDto,
  EnterpriseMemoryDto,
  EnterpriseRecordDto,
  EnterpriseSnapshotDto,
  EnterpriseSummaryDto,
  TimelineIndexEntry,
  WorkLedgerEntry,
} from '../../src/renderer/office/entTypes';
import type { SkillSummary } from '../../src/renderer/office/types';
import { flush, makeFakePanzoom, mountChromeDom, sampleProject } from './helpers';

// ------------------------------------------------------------ golden fixture

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'shared', 'enterprise-blueprint.fixture.json'), 'utf8'),
) as {
  input: Parameters<typeof generateEnterpriseBlueprint>[0];
  canonicalBlueprint: string;
  blueprintHash: string;
  partition: { requests: PartitionRequest[] };
  view: { nodeCount: number; edgeCount: number };
  actions: { count: number; ids: string[] };
};

describe('renderer ports: byte parity with shared/enterprise', () => {
  it('sha256/canonicalJson/blueprintHash match the shared implementation and fixture', () => {
    expect(sha256Hex('hello world')).toBe(sharedSha256Hex('hello world'));
    expect(sha256Hex('hello world')).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    const blueprint = generateEnterpriseBlueprint(fixture.input);
    expect(canonicalJson(blueprint)).toBe(sharedCanonicalJson(blueprint));
    expect(canonicalJson(blueprint)).toBe(fixture.canonicalBlueprint);
    expect(blueprintHash(blueprint)).toBe(sharedBlueprintHash(blueprint));
    expect(blueprintHash(blueprint)).toBe(fixture.blueprintHash);
  });

  it('partitionBudget matches the shared largest-remainder apportionment', () => {
    const blueprint = generateEnterpriseBlueprint(fixture.input);
    for (const reqs of [
      fixture.partition.requests,
      blueprint.companies.map((c) => ({ companyKey: c.key, capacityShare: c.capacityShare, active: true })),
      [
        { companyKey: 'a', capacityShare: 1, active: true },
        { companyKey: 'b', capacityShare: 3, active: true },
        { companyKey: 'c', capacityShare: 6, active: false },
      ],
    ]) {
      const mine = partitionBudget(blueprint.budget, reqs);
      const shared = sharedPartitionBudget(blueprint.budget, reqs);
      expect(JSON.parse(JSON.stringify(mine))).toEqual(JSON.parse(JSON.stringify(shared)));
      expect(mine.withinEnvelope).toBe(true);
    }
  });

  it('ENTERPRISE_ACTIONS + disciplines match the closed shared registry', () => {
    expect(ENTERPRISE_ACTIONS.map((a) => a.id)).toEqual(SHARED_ACTIONS.map((a) => a.id));
    expect(ENTERPRISE_ACTIONS.map((a) => `${a.operation}|${a.capability}|${a.approval ?? ''}`)).toEqual(
      SHARED_ACTIONS.map((a) => `${a.operation}|${a.capability}|${a.approval ?? ''}`),
    );
    expect([...DISCIPLINES].sort()).toEqual([...SHARED_DISCIPLINES].sort());
  });
});

// ------------------------------------------------------------- fake backend

const NOW = '2026-03-01T12:00:00.000Z';

interface FakeContract extends EnterpriseContractDto {
  lease: EnterpriseContractDto['lease'];
}

function fakeSkills(): SkillSummary[] {
  // 20 verified skills: the 9 discipline packs (incl. the 2 creative packs
  // treated as installed) + 11 general packs.
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

function seedLedger(): WorkLedgerEntry[] {
  const base = {
    ts: Date.parse(NOW),
    enterpriseId: 'ent-1',
    projectId: 'proj-civilization-design',
    officeId: null,
    roomId: null,
    runId: 'run-civilization-1',
    attempt: 1,
    status: 'succeeded',
    skillRef: null,
  };
  const ask = (s: string): string => s;
  return [
    {
      ...base,
      seq: 1,
      companyKey: 'civilization-design',
      nodeKey: 'svc-design',
      workerId: 'worker-0007',
      kind: 'assignment',
      intendedAsk: ask('Draft the civilization design brief'),
      promptSha256: null,
      returnedSummary: '',
      artifactRef: null,
      usage: null,
    },
    {
      ...base,
      seq: 2,
      companyKey: 'civilization-design',
      nodeKey: 'svc-design',
      workerId: 'worker-0007',
      kind: 'prompt_started',
      intendedAsk: ask('Draft the civilization design brief'),
      promptSha256: 'a'.repeat(64),
      returnedSummary: '',
      artifactRef: null,
      usage: null,
    },
    {
      ...base,
      seq: 3,
      companyKey: 'civilization-design',
      nodeKey: 'svc-design',
      workerId: 'worker-0007',
      kind: 'returned',
      intendedAsk: ask('Draft the civilization design brief'),
      promptSha256: 'a'.repeat(64),
      returnedSummary: 'Returned: a bounded extractive summary of the design brief.',
      artifactRef: {
        artifactId: 'art-1',
        runId: 'run-civilization-1',
        nodeKey: 'svc-design',
        attempt: 1,
        kind: 'text',
        title: 'Civilization design brief',
        summary: 'Extractive summary only.',
        contentSha256: 'b'.repeat(64),
      },
      usage: { inputTokens: 1200, outputTokens: 800, costUsdMicros: 4200 },
    },
    {
      ...base,
      seq: 4,
      companyKey: 'software',
      projectId: 'proj-software',
      nodeKey: 'svc-backend-engineering',
      workerId: 'worker-0002',
      kind: 'returned',
      intendedAsk: ask('Implement the geometry service endpoint'),
      promptSha256: 'c'.repeat(64),
      returnedSummary: 'Returned: endpoint scaffolded with tests.',
      artifactRef: null,
      usage: { inputTokens: 2400, outputTokens: 900, costUsdMicros: 6100 },
    },
  ];
}

interface FakeBackendOptions {
  skills?: SkillSummary[];
}

class FakeEntBackend {
  records = new Map<string, EnterpriseRecordDto>();
  contractsByEnt = new Map<string, FakeContract[]>();
  ledgerByEnt = new Map<string, WorkLedgerEntry[]>();
  providerModelCalls = 0;
  pumpCalls = 0;
  exportCalls = 0;
  private listeners: Array<() => void> = [];
  private readonly skills: SkillSummary[];

  constructor(opts: FakeBackendOptions = {}) {
    this.skills = opts.skills ?? fakeSkills();
  }

  private bump(record: EnterpriseRecordDto): void {
    record.version += 1;
    record.updatedAt = NOW;
    // Listeners are registered but deliberately NOT fired here: the app
    // refreshes after its own mutations, and silently-fired timers would make
    // multi-step UI flows flaky. (The 200ms coalescing path is main-tested.)
    void this.listeners;
  }

  private clone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
  }

  raw(): RawBridge {
    const self = this;
    const get = (id: string): EnterpriseRecordDto => {
      const rec = self.records.get(id);
      if (!rec) throw new Error(`unknown enterprise "${id}"`);
      return rec;
    };
    const assertVersion = (rec: EnterpriseRecordDto, expected: unknown): void => {
      if (rec.version !== expected) throw new Error(`version conflict: expected ${String(expected)}, current ${rec.version}`);
    };
    const raw: Partial<RawBridge> = {
      version: 5,
      listSkills: async () => self.skills,
      listProviderModels: async () => {
        self.providerModelCalls += 1;
        return { ok: true, models: [] };
      },
      getProject: async (projectId: string) => ({ ...sampleProject(), id: projectId }),
      onEnterpriseEvent: (listener: () => void) => {
        self.listeners.push(listener);
        return () => {
          const i = self.listeners.indexOf(listener);
          if (i >= 0) self.listeners.splice(i, 1);
        };
      },
      entList: async (): Promise<EnterpriseSummaryDto[]> =>
        [...self.records.values()].map((r) => ({
          id: r.id,
          programId: r.programId,
          name: r.name,
          state: r.state,
          version: r.version,
          blueprintHash: r.blueprintHash,
          programState: r.program?.state ?? null,
          programPaused: r.programPaused,
          companyCount: Object.keys(r.companies).length,
          departmentCount: Object.keys(r.departments).length,
          contractCount: (self.contractsByEnt.get(r.id) ?? []).length,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      entCreate: async (req) => {
        const existing = [...self.records.values()].find((r) => r.programId === req.programId);
        if (existing) return { ok: true, record: self.clone(existing), created: false };
        const record: EnterpriseRecordDto = {
          contractVersion: 1,
          id: `ent-${self.records.size + 1}`,
          programId: req.programId,
          preset: req.preset,
          name: req.name,
          mission: req.mission,
          provider: req.provider,
          model: req.model,
          priceRates: req.priceRates ?? { inputUsdPerMillion: 0, outputUsdPerMillion: 0 },
          version: 1,
          state: 'draft',
          blueprint: null,
          blueprintHash: null,
          program: null,
          programPaused: false,
          companies: {},
          departments: {},
          contractWorkers: {},
          contracts: {},
          approvals: [],
          memory: [],
          workerOverrides: {},
          ledgerKeys: [],
          ledgerSeq: 0,
          eventSeq: 0,
          createdAt: NOW,
          updatedAt: NOW,
        };
        self.records.set(record.id, record);
        self.contractsByEnt.set(record.id, []);
        self.ledgerByEnt.set(record.id, []);
        return { ok: true, record: self.clone(record), created: true };
      },
      entSnapshot: async (id): Promise<EnterpriseSnapshotDto> => {
        const rec = get(id);
        const view = rec.blueprint
          ? deriveEnterpriseView({ blueprint: rec.blueprint as unknown as EnterpriseBlueprint, program: rec.program as never })
          : null;
        return {
          record: self.clone(rec),
          view: view as EnterpriseSnapshotDto['view'],
          stewards:
            rec.state === 'materialized'
              ? [
                  {
                    steward: 'Budget Steward',
                    kind: 'budget',
                    derivedBy: 'system',
                    providerCalls: false,
                    summary: 'music has used 0% of its reservation; consider rebalancing.',
                    refs: [],
                    ledgerSeq: 3,
                    actionId: 'worker.capacity',
                  },
                ]
              : [],
        };
      },
      entContracts: async (id) => self.clone(self.contractsByEnt.get(id) ?? []),
      entBlueprintPreview: async (req) => {
        const rec = get(req.enterpriseId);
        assertVersion(rec, req.expectedVersion);
        const blueprint = generateEnterpriseBlueprint({
          preset: 'creative_technology_group',
          programId: rec.programId,
          name: rec.name,
          mission: rec.mission,
          budget: rec.program?.budget ?? {
            maxTokens: 4_000_000,
            maxCalls: 300,
            maxMinutes: 360,
            maxCostUsdMicros: 250_000_000,
          },
          availableSkillIds: self.skills.map((s) => s.id),
          maxReplans: 2,
          maxConcurrentRuns: 2,
        });
        const hash = sharedBlueprintHash(blueprint);
        const payload = { blueprintHash: hash, programId: rec.programId };
        const payloadHash = sharedSha256Hex(sharedCanonicalJson(payload));
        let approval = rec.approvals.find((a) => a.kind === 'blueprint-activation' && a.blueprintHash === hash);
        if (!approval) {
          approval = {
            id: `ap-${rec.approvals.length + 1}`,
            kind: 'blueprint-activation',
            blueprintHash: hash,
            payloadHash,
            payload,
            status: 'pending',
            createdAt: NOW,
            decidedAt: null,
          };
          rec.approvals.push(approval);
          self.bump(rec);
        }
        return {
          ok: true,
          preview: {
            blueprint,
            blueprintHash: hash,
            payload,
            payloadHash,
            expectedVersion: rec.version,
            approval: self.clone(approval),
          },
        };
      },
      entApprovalDecide: async (req) => {
        const rec = get(req.enterpriseId);
        const approval = rec.approvals.find((a) => a.id === req.approvalId);
        if (!approval || approval.payloadHash !== req.payloadHash) throw new Error('approval not found or payload mismatch');
        approval.status = req.decision;
        approval.decidedAt = NOW;
        // memory-promote approval lands the entry when approved
        if (approval.kind === 'memory-promote' && req.decision === 'approved') {
          const p = approval.payload as { artifact: never; scope: string; scopeKey: string };
          rec.memory.push({ entry: { scope: p.scope, scopeKey: p.scopeKey, artifact: p.artifact }, status: 'promoted', promotedAt: NOW, revokedAt: null });
        }
        self.bump(rec);
        return { ok: true, approval: self.clone(approval) };
      },
      entBlueprintApply: async (req) => {
        const rec = get(req.enterpriseId);
        assertVersion(rec, req.expectedVersion);
        if (!req.confirmed) throw new Error('apply requires explicit confirmation');
        const approval = rec.approvals.find((a) => a.kind === 'blueprint-activation' && a.blueprintHash === req.blueprintHash);
        if (!approval || approval.status !== 'approved') throw new Error('blueprint-activation approval is not approved');
        if (rec.blueprintHash === req.blueprintHash) {
          // idempotent replay: reuse, never duplicate
          return { ok: true, record: self.clone(rec), replayed: true };
        }
        const blueprint = generateEnterpriseBlueprint({
          preset: 'creative_technology_group',
          programId: rec.programId,
          name: rec.name,
          mission: rec.mission,
          budget: {
            maxTokens: 4_000_000,
            maxCalls: 300,
            maxMinutes: 360,
            maxCostUsdMicros: 250_000_000,
          },
          availableSkillIds: self.skills.map((s) => s.id),
          maxReplans: 2,
          maxConcurrentRuns: 2,
        });
        if (sharedBlueprintHash(blueprint) !== req.blueprintHash) throw new Error('blueprint hash mismatch');
        rec.blueprint = blueprint as unknown as EnterpriseRecordDto['blueprint'];
        rec.blueprintHash = req.blueprintHash;
        rec.state = 'materialized';
        for (const c of blueprint.companies) {
          if (!rec.companies[c.key]) rec.companies[c.key] = { projectId: `proj-${c.key}`, createdAt: NOW };
        }
        for (const d of blueprint.departments) {
          if (!rec.departments[d.key]) rec.departments[d.key] = { projectId: 'proj-shared-services', nodeId: `node-${d.key}` };
        }
        const contracts: FakeContract[] = blueprint.contracts.map((c) => ({
          key: c.key,
          companyKey: c.companyKey,
          departmentKey: c.departmentKey,
          discipline: c.discipline,
          status: c.staffed ? 'active' : 'proposed',
          staffed: c.staffed,
          skillId: c.skillPin.skillId,
          capacityShare: c.capacityShare,
          version: 1,
          fenceCounter: 1,
          lease: c.staffed
            ? { runId: `run-${c.companyKey}-1`, fence: 1, acquiredAt: NOW, expiresAt: NOW, ttlMs: 1_800_000, status: 'active' }
            : null,
        }));
        self.contractsByEnt.set(rec.id, contracts);
        rec.contracts = Object.fromEntries(
          contracts.map((c) => [c.key, { status: c.status, staffed: c.staffed, skillId: c.skillId, capacityShare: c.capacityShare, version: c.version, fenceCounter: c.fenceCounter, lease: c.lease }]),
        );
        for (const c of contracts) rec.contractWorkers[c.key] = { projectId: `proj-${c.departmentKey}`, nodeId: `node-${c.key}` };
        rec.program = {
          contractVersion: 1,
          programId: rec.programId,
          state: 'awaiting_plan_approval',
          version: 1,
          blueprintHash: req.blueprintHash,
          companyRuns: blueprint.companies.map((c) => ({ companyKey: c.key, runId: null, status: 'pending' as const })),
          maxReplans: 2,
          maxReplans: 2,
          maxConcurrentRuns: 2,
          budget: blueprint.budget,
        };
        rec.approvals.push({
          id: `ap-${rec.approvals.length + 1}`,
          kind: 'plan',
          blueprintHash: req.blueprintHash,
          payloadHash: sharedSha256Hex(sharedCanonicalJson({ kind: 'plan', blueprintHash: req.blueprintHash })),
          payload: { kind: 'plan' },
          status: 'pending',
          createdAt: NOW,
          decidedAt: null,
        });
        self.ledgerByEnt.set(rec.id, seedLedger());
        self.bump(rec);
        return { ok: true, record: self.clone(rec) };
      },
      entProgramStart: async (req) => {
        const rec = get(req.enterpriseId);
        assertVersion(rec, req.expectedVersion);
        if (!rec.program) throw new Error('no program');
        const plan = rec.approvals.find((a) => a.kind === 'plan' && a.blueprintHash === rec.program?.blueprintHash);
        if (!plan || plan.status !== 'approved') throw new Error('plan approval is not approved');
        rec.program.state = 'running';
        rec.program.companyRuns[0]!.status = 'running';
        rec.program.companyRuns[0]!.runId = `run-${rec.program.companyRuns[0]!.companyKey}-1`;
        rec.program.companyRuns[1]!.status = 'running';
        rec.program.companyRuns[1]!.runId = `run-${rec.program.companyRuns[1]!.companyKey}-1`;
        self.bump(rec);
        return { ok: true, record: self.clone(rec) };
      },
      entProgramPause: async (id) => {
        const rec = get(id);
        rec.programPaused = true;
        self.bump(rec);
        return { ok: true, record: self.clone(rec) };
      },
      entProgramResume: async (id) => {
        const rec = get(id);
        rec.programPaused = false;
        self.bump(rec);
        return { ok: true, record: self.clone(rec) };
      },
      entProgramCancel: async (id) => {
        const rec = get(id);
        if (rec.program) {
          rec.program.state = 'stopped_human';
          for (const cr of rec.program.companyRuns) if (cr.status === 'running' || cr.status === 'pending') cr.status = 'stopped';
        }
        self.bump(rec);
        return { ok: true, record: self.clone(rec) };
      },
      entProgramGet: async (id) => ({ ok: true, program: self.clone(get(id).program) }),
      entProgramPump: async (id) => {
        self.pumpCalls += 1;
        const rec = get(id);
        let dispatched = 0;
        if (rec.program && !rec.programPaused) {
          const running = rec.program.companyRuns.filter((c) => c.status === 'running').length;
          for (const cr of rec.program.companyRuns) {
            if (running + dispatched >= rec.program.maxConcurrentRuns) break;
            if (cr.status === 'pending') {
              cr.status = 'running';
              cr.runId = `run-${cr.companyKey}-1`;
              dispatched += 1;
            }
          }
        }
        self.bump(rec);
        return { ok: true, dispatched };
      },
      entContractPropose: async (req) => {
        const rec = get(req.enterpriseId);
        assertVersion(rec, req.expectedVersion);
        const list = self.contractsByEnt.get(rec.id) ?? [];
        if (list.some((c) => c.key === req.key)) throw new Error(`contract "${req.key}" already exists`);
        list.push({
          key: req.key,
          companyKey: req.companyKey,
          departmentKey: req.departmentKey,
          discipline: req.discipline,
          status: 'proposed',
          staffed: self.skills.some((s) => s.id === req.skillId && s.verified),
          skillId: req.skillId,
          capacityShare: req.capacityShare,
          version: 1,
          fenceCounter: 0,
          lease: null,
        });
        self.contractsByEnt.set(rec.id, list);
        rec.contracts[req.key] = { status: 'proposed', staffed: true, skillId: req.skillId, capacityShare: req.capacityShare, version: 1, fenceCounter: 0, lease: null };
        self.bump(rec);
        return { ok: true, record: self.clone(rec) };
      },
      entContractDecide: async (req) => {
        const rec = get(req.enterpriseId);
        assertVersion(rec, req.expectedVersion);
        const contract = (self.contractsByEnt.get(rec.id) ?? []).find((c) => c.key === req.contractKey);
        if (!contract) throw new Error(`unknown contract "${req.contractKey}"`);
        if (contract.status !== 'proposed') throw new Error(`contract is ${contract.status}`);
        contract.status = req.decision === 'approved' ? 'active' : 'revoked';
        contract.version += 1;
        contract.fenceCounter += 1;
        self.bump(rec);
        return { ok: true, record: self.clone(rec) };
      },
      entContractRelease: async (req) => {
        const rec = get(req.enterpriseId);
        assertVersion(rec, req.expectedVersion);
        const contract = (self.contractsByEnt.get(rec.id) ?? []).find((c) => c.key === req.contractKey);
        if (!contract) throw new Error(`unknown contract "${req.contractKey}"`);
        if (contract.status !== 'active' && contract.status !== 'draining') throw new Error(`contract is ${contract.status}`);
        contract.status = 'released';
        contract.lease = null;
        contract.version += 1;
        self.bump(rec);
        return { ok: true, record: self.clone(rec) };
      },
      entWorkerUpdate: async (req) => {
        const rec = get(req.enterpriseId);
        assertVersion(rec, req.expectedVersion);
        if (req.op === 'capacity') {
          const contract = (self.contractsByEnt.get(rec.id) ?? []).find((c) => c.key === req.contractKey);
          if (!contract) throw new Error('unknown contract');
          contract.capacityShare = req.capacityShare ?? contract.capacityShare;
          contract.version += 1;
        } else if (req.op === 'suspend' || req.op === 'resume') {
          const contract = (self.contractsByEnt.get(rec.id) ?? []).find((c) => c.key === req.contractKey);
          if (!contract) throw new Error('unknown contract');
          contract.status = req.op === 'suspend' ? 'draining' : 'active';
          contract.version += 1;
        } else if (req.op === 'edit') {
          rec.workerOverrides[`${String(req.companyKey)}/${String(req.workerId)}`] = {
            ...(req.instructions !== undefined ? { instructions: String(req.instructions) } : {}),
            ...(req.budget !== undefined ? { budget: req.budget } : {}),
          };
        }
        self.bump(rec);
        return { ok: true };
      },
      entLedger: async (req) => {
        get(req.enterpriseId);
        let rows = self.ledgerByEnt.get(req.enterpriseId) ?? [];
        if (req.companyKey) rows = rows.filter((e) => e.companyKey === req.companyKey);
        if (req.workerId) rows = rows.filter((e) => e.workerId === req.workerId);
        if (req.departmentKey) rows = rows.filter((e) => e.nodeKey === req.departmentKey);
        return self.clone(rows);
      },
      entTimeline: async (req) => {
        const rows = (self.ledgerByEnt.get(req.enterpriseId) ?? []).filter((e) => e.seq > (req.afterIndex ?? 0));
        const limited = rows.slice(0, req.limit ?? 500);
        const entries: TimelineIndexEntry[] = limited.map((e) => ({
          seq: e.seq,
          ts: e.ts,
          kind: e.kind,
          enterpriseId: e.enterpriseId,
          companyKey: e.companyKey,
          workerId: e.workerId,
          nodeKey: e.nodeKey,
          runId: e.runId,
          ledgerSeq: e.seq,
          artifactRef: e.artifactRef,
        }));
        return { entries, nextIndex: entries.length > 0 ? entries[entries.length - 1]!.seq : (req.afterIndex ?? 0) };
      },
      entEvents: async (req) => ({ events: [], nextIndex: req.afterIndex ?? 0 }),
      entMemory: async (id, includeRevoked) => {
        const rec = get(id);
        return self.clone(includeRevoked ? rec.memory : rec.memory.filter((m) => m.status === 'promoted'));
      },
      entMemorySearch: async (id, query) => {
        const rec = get(id);
        const q = query.toLowerCase();
        return self.clone(
          rec.memory.filter(
            (m) =>
              m.status === 'promoted' &&
              (m.entry.artifact.title.toLowerCase().includes(q) || m.entry.artifact.summary.toLowerCase().includes(q)),
          ),
        );
      },
      entMemoryPromote: async (req) => {
        const rec = get(req.enterpriseId);
        assertVersion(rec, req.expectedVersion);
        const payload = { artifact: req.artifact, scope: req.scope, scopeKey: req.scopeKey };
        const approval = {
          id: `ap-${rec.approvals.length + 1}`,
          kind: 'memory-promote',
          blueprintHash: rec.blueprintHash ?? '0'.repeat(64),
          payloadHash: sharedSha256Hex(sharedCanonicalJson(payload)),
          payload,
          status: 'pending' as const,
          createdAt: NOW,
          decidedAt: null,
        };
        rec.approvals.push(approval);
        self.bump(rec);
        return { ok: true, approval: self.clone(approval) };
      },
      entMemoryRevoke: async (req) => {
        const rec = get(req.enterpriseId);
        assertVersion(rec, req.expectedVersion);
        const entry = rec.memory.find(
          (m) => m.entry.scope === req.scope && m.entry.scopeKey === req.scopeKey && m.entry.artifact.artifactId === req.artifactId,
        );
        if (!entry) throw new Error('memory entry not found');
        entry.status = 'revoked';
        entry.revokedAt = NOW;
        self.bump(rec);
        return { ok: true, record: self.clone(rec) };
      },
      entExport: async (id) => {
        self.exportCalls += 1;
        get(id);
        return { ok: true, dir: `/tmp/exports/${id}`, files: ['HANDOFFS.md', 'timeline-index.json', 'ledger.json', 'ledger.md'] };
      },
    };
    return raw as RawBridge;
  }
}

// ---------------------------------------------------------------- test boot

interface Booted {
  app: EnterpriseApp;
  root: HTMLElement;
  backend: FakeEntBackend;
  adapter: BridgeAdapter;
}

function boot(backend = new FakeEntBackend()): Booted {
  mountChromeDom();
  const root = document.createElement('div');
  document.body.append(root);
  const overlay = createOverlayHost(document.getElementById('overlay-root')!);
  overlay.confirm = () => Promise.resolve(true); // shared confirm dialog: auto-accept in tests
  const adapter = new BridgeAdapter(backend.raw());
  const { factory } = makeFakePanzoom();
  const app = createEnterpriseApp({
    root,
    adapter,
    overlay,
    panzoomFactory: factory as never,
    openProject: () => undefined,
  });
  return { app, root, backend, adapter };
}

async function bootWithEnterprise(): Promise<Booted & { entId: string }> {
  const b = boot();
  const created = await b.adapter.entCreate({
    preset: 'creative_technology_group',
    programId: 'ctg-2026',
    name: 'Creative Technology Group',
    mission: 'Operate a creative technology group.',
    budget: { maxTokens: 4_000_000, maxCalls: 300, maxMinutes: 360, maxCostUsdMicros: 250_000_000 },
    provider: 'openai',
    model: 'gpt-5.2',
  });
  if (!created.ok) throw new Error(created.error);
  await b.app.show();
  await flush();
  return { ...b, entId: created.value.record.id };
}

function clickText(root: HTMLElement, selector: string, text: string): HTMLElement {
  const el = [...root.querySelectorAll<HTMLElement>(selector)].find((n) => n.textContent?.trim().includes(text) && !(n as HTMLButtonElement).disabled);
  if (!el) throw new Error(`no enabled "${selector}" containing "${text}"`);
  el.click();
  return el;
}

/** Drive preview → approve → confirm → apply; returns when materialized. */
async function applyBlueprint(root: HTMLElement): Promise<void> {
  clickText(root, 'button', 'Preview blueprint');
  await flush();
  clickText(root, 'button', 'Approve activation');
  await flush();
  // preview card was cleared by approval refresh; preview again
  clickText(root, 'button', 'Preview blueprint');
  await flush();
  const confirmBox = root.querySelector<HTMLInputElement>('.ent-confirm input[type="checkbox"]');
  expect(confirmBox, 'confirmation checkbox present').toBeTruthy();
  confirmBox!.checked = true;
  confirmBox!.dispatchEvent(new Event('change'));
  const applyBtn = clickText(root, 'button', 'Apply blueprint');
  expect((applyBtn as HTMLButtonElement).disabled).toBe(false);
  await flush(20);
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('CEO portfolio: blueprint flow', () => {
  it('create → preview (renderer-verified hash) → approve → confirm+apply; replay is idempotent', async () => {
    const { app, root, adapter, entId } = await bootWithEnterprise();
    expect(adapter.capabilities.ceo).toBe(true);
    expect(root.textContent).toContain('CEO Portfolio');

    // idempotent create replay is reported honestly
    const again = await adapter.entCreate({
      preset: 'creative_technology_group',
      programId: 'ctg-2026',
      name: 'Duplicate name attempt',
      mission: 'other',
      budget: { maxTokens: 1, maxCalls: 1, maxMinutes: 1, maxCostUsdMicros: 1 },
      provider: 'openai',
      model: 'gpt-5.2',
    });
    expect(again.ok && again.value.created).toBe(false);

    clickText(root, 'button', 'Preview blueprint');
    await flush();
    expect(root.textContent).toContain('renderer-verified hash: match');
    expect(app.state().previewHashCheck).toBe('match');

    // Apply is gated until the activation approval is approved
    expect(root.textContent).toContain('Approve activation');
    clickText(root, 'button', 'Approve activation');
    await flush();
    clickText(root, 'button', 'Preview blueprint');
    await flush();
    const confirmBox = root.querySelector<HTMLInputElement>('.ent-confirm input[type="checkbox"]')!;
    confirmBox.checked = true;
    confirmBox.dispatchEvent(new Event('change'));
    clickText(root, 'button', 'Apply blueprint');
    await flush(20);

    const snap = await adapter.entSnapshot(entId);
    expect(snap.ok && snap.value.record.state).toBe('materialized');
    expect(Object.keys(snap.ok ? snap.value.record.companies : {})).toHaveLength(5);
    expect((await adapter.entContracts(entId))).toSatisfy((r) => r.ok && r.value.length === 9);
    expect(root.textContent).toContain('Replay apply (idempotent)');

    // replay: version-pinned preview + apply returns the same materialization
    const rec = snap.ok ? snap.value.record : null;
    const prev = await adapter.entBlueprintPreview({ enterpriseId: entId, expectedVersion: rec!.version });
    expect(prev.ok).toBe(true);
    const applied = await adapter.entBlueprintApply({
      enterpriseId: entId,
      blueprintHash: prev.ok ? prev.value.blueprintHash : '',
      payloadHash: prev.ok ? prev.value.payloadHash : '',
      expectedVersion: prev.ok ? prev.value.expectedVersion : 0,
      confirmed: true,
    });
    expect(applied.ok).toBe(true);
    const snap2 = await adapter.entSnapshot(entId);
    expect(Object.keys(snap2.ok ? snap2.value.record.companies : {})).toHaveLength(5);
    expect((await adapter.entContracts(entId))).toSatisfy((r) => r.ok && r.value.length === 9);
  });

  it('apply is rejected without the confirmation flag', async () => {
    const { adapter, entId } = await bootWithEnterprise();
    const rec = (await adapter.entSnapshot(entId));
    const prev = await adapter.entBlueprintPreview({ enterpriseId: entId, expectedVersion: rec.ok ? rec.value.record.version : 0 });
    expect(prev.ok).toBe(true);
    const res = await adapter.entBlueprintApply({
      enterpriseId: entId,
      blueprintHash: prev.ok ? prev.value.blueprintHash : '',
      payloadHash: prev.ok ? prev.value.payloadHash : '',
      expectedVersion: prev.ok ? prev.value.expectedVersion : 0,
      confirmed: false,
    });
    expect(res.ok).toBe(false);
  });
});

describe('CEO portfolio: graph ⇄ list parity', () => {
  it('renders 5 companies, 7 departments, 9 contracts in graph AND lists with identical keys', async () => {
    const { root, adapter, entId } = await bootWithEnterprise();
    await applyBlueprint(root);

    const graphKeys = [...root.querySelectorAll<SVGGElement>('.ent-node')].map((n) => n.dataset['key']);
    const listKeys = [...root.querySelectorAll<HTMLElement>('.ent-list-item')].map((n) => n.dataset['key']);
    expect(graphKeys).toHaveLength(21);
    expect(listKeys).toHaveLength(21);
    expect([...graphKeys].sort()).toEqual([...listKeys].sort());
    expect(root.querySelectorAll('.ent-node-company')).toHaveLength(5);
    expect(root.querySelectorAll('.ent-node-department')).toHaveLength(7);
    expect(root.querySelectorAll('.ent-node-contract')).toHaveLength(9);

    // parity with the shared deriveEnterpriseView (the snapshot the app renders)
    const snap = await adapter.entSnapshot(entId);
    const view = snap.ok ? snap.value.view : null;
    expect(view).toBeTruthy();
    const sharedKeys = view!.graph.nodes.map((n) => n.key).sort();
    expect([...graphKeys].sort()).toEqual(sharedKeys);

    // keyboard parity: a list row activation selects the same node in the graph
    const firstCompany = root.querySelector<HTMLElement>('.ent-list-item[data-kind="company"]')!;
    firstCompany.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    firstCompany.click();
    await flush();
    expect(root.querySelector('.ent-node.selected')?.getAttribute('data-key')).toBe(firstCompany.dataset['key']);
    expect(root.querySelector<HTMLElement>('.ent-list-item.selected')?.dataset['key']).toBe(firstCompany.dataset['key']);
    expect(root.querySelector('#ent-graph-detail')?.textContent).toContain('Open Project Office');
  });
});

describe('CEO portfolio: program controls', () => {
  it('start is gated on the plan approval; controls advance only via explicit actions', async () => {
    const { root, adapter, backend, entId } = await bootWithEnterprise();
    await applyBlueprint(root);

    // ENTERPRISE_ACTIONS-driven availability: start explains its gate
    const startBtn = [...root.querySelectorAll<HTMLButtonElement>('.ent-program-controls button')].find((b) =>
      b.textContent?.includes('Start'),
    )!;
    expect(startBtn.disabled).toBe(true);
    expect(startBtn.title).toContain('plan approval');

    // querying/refreshing never dispatches (no query-triggered advancement)
    const refreshBtn = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Refresh')!;
    refreshBtn.click();
    await flush();
    expect(backend.pumpCalls).toBe(0);

    // approve the plan, then start becomes available
    clickText(root, 'button', 'Approve plan');
    await flush();
    const startBtn2 = [...root.querySelectorAll<HTMLButtonElement>('.ent-program-controls button')].find((b) =>
      b.textContent?.includes('Start'),
    )!;
    expect(startBtn2.disabled).toBe(false);
    startBtn2.click();
    await flush();
    let snap = await adapter.entSnapshot(entId);
    expect(snap.ok && snap.value.record.program?.state).toBe('running');
    expect(root.textContent).toContain('concurrency 2 (default 2, max 4)');

    // pause/resume/cancel map to the same controls; budget partition meters render
    expect(root.querySelectorAll('.ent-partition-table tbody tr, .ent-partition-table tr').length).toBeGreaterThanOrEqual(5);
    expect(root.querySelector('.ent-meter')).toBeTruthy();
    expect(root.textContent).toContain('within the $250.00 envelope');

    clickText(root, 'button', 'Pump dispatch');
    await flush();
    expect(backend.pumpCalls).toBe(1);

    clickText(root, '.ent-program-controls button', 'Pause');
    await flush();
    snap = await adapter.entSnapshot(entId);
    expect(snap.ok && snap.value.record.programPaused).toBe(true);
    clickText(root, '.ent-program-controls button', 'Resume');
    await flush();
    clickText(root, '.ent-program-controls button', 'Stop');
    await flush();
    snap = await adapter.entSnapshot(entId);
    expect(snap.ok && snap.value.record.program?.state).toBe('stopped_human');
    // company runs carry open-office deep links
    expect(root.textContent).toContain('open office');
  });
});

describe('CEO portfolio: contracts', () => {
  it('propose → decide → release with exact contractKey/version; fence + lease shown', async () => {
    const { root, adapter, entId } = await bootWithEnterprise();
    await applyBlueprint(root);

    // creative packs are installed in this registry (20 verified skills), so
    // the music seat is honestly staffed; unstaffed packs would read "unstaffed"
    const musicRow = [...root.querySelectorAll('.ent-contracts-table tr')].find((r) => r.textContent?.includes('music--svc-music-production'));
    expect(musicRow?.textContent).toContain('active');
    expect(musicRow?.textContent).toContain('yes (verified)');
    expect(root.textContent).toContain('v / fence');
    expect(musicRow?.textContent).toMatch(/1 \/ #1/); // contract version 1, fence counter 1
    expect(musicRow?.textContent).toContain('run-music-1'); // live lease with holder + fence + ttl

    // propose a new cross-office contract
    const keyInput = root.querySelector<HTMLInputElement>('input[aria-label="New contract key"]')!;
    keyInput.value = 'software--svc-mathematics';
    const capInput = root.querySelector<HTMLInputElement>('input[aria-label="Capacity share (0-1]"]')!;
    capInput.value = '0.5';
    clickText(root, 'button', 'Propose contract');
    await flush();
    let contracts = await adapter.entContracts(entId);
    expect(contracts.ok && contracts.value.some((c) => c.key === 'software--svc-mathematics' && c.status === 'proposed')).toBe(true);

    // decide (activate) from the table — the decision IS the gate
    const row = [...root.querySelectorAll('.ent-contracts-table tr')].find((r) => r.textContent?.includes('software--svc-mathematics'))!;
    clickText(row as HTMLElement, 'button', 'Activate');
    await flush();
    contracts = await adapter.entContracts(entId);
    const decided = contracts.ok ? contracts.value.find((c) => c.key === 'software--svc-mathematics') : null;
    expect(decided?.status).toBe('active');
    expect(decided?.version).toBe(2);

    // release drains and frees the seat (confirm dialog auto-accepted)
    const row2 = [...root.querySelectorAll('.ent-contracts-table tr')].find((r) => r.textContent?.includes('software--svc-mathematics'))!;
    clickText(row2 as HTMLElement, 'button', 'Release');
    await flush();
    contracts = await adapter.entContracts(entId);
    expect(contracts.ok ? contracts.value.find((c) => c.key === 'software--svc-mathematics')?.status : null).toBe('released');
  });

  it('suspend/resume and capacity adjustments go through entWorkerUpdate with OCC', async () => {
    const { root, adapter, entId } = await bootWithEnterprise();
    await applyBlueprint(root);

    const row = [...root.querySelectorAll('.ent-contracts-table tr')].find((r) => r.textContent?.includes('software--svc-backend-engineering'))!;
    clickText(row as HTMLElement, 'button', 'Suspend');
    await flush();
    let contracts = await adapter.entContracts(entId);
    expect(contracts.ok ? contracts.value.find((c) => c.key === 'software--svc-backend-engineering')?.status : null).toBe('draining');

    const row2 = [...root.querySelectorAll('.ent-contracts-table tr')].find((r) => r.textContent?.includes('software--svc-backend-engineering'))!;
    const cap = row2.querySelector<HTMLInputElement>('input.ent-cap-input')!;
    cap.value = '0.75';
    clickText(row2 as HTMLElement, 'button', 'Set capacity');
    await flush();
    contracts = await adapter.entContracts(entId);
    expect(contracts.ok ? contracts.value.find((c) => c.key === 'software--svc-backend-engineering')?.capacityShare : null).toBe(0.75);
  });
});

describe('CEO portfolio: memory browser', () => {
  it('promote (approval-gated, ref-only) → approve → search → revoke', async () => {
    const { root, adapter, entId } = await bootWithEnterprise();
    await applyBlueprint(root);

    clickText(root, 'button', 'Promote ref to memory…');
    await flush();
    // dialog: default enterprise scope, request promotion
    const dialog = document.querySelector('.modal-backdrop:not(.hidden) .modal');
    expect(dialog?.textContent).toContain('Promote artifact ref');
    clickText(dialog as HTMLElement, 'button', 'Request promotion');
    await flush();
    let snap = await adapter.entSnapshot(entId);
    const promoteApproval = snap.ok ? snap.value.record.approvals.find((a) => a.kind === 'memory-promote') : null;
    expect(promoteApproval?.status).toBe('pending');
    // nothing lands before approval — reference-only, hash-pinned
    expect(snap.ok ? snap.value.record.memory.length : -1).toBe(0);

    // approve in the pending approvals section
    const row = [...root.querySelectorAll('.ent-approval-row')].find((r) => r.textContent?.includes('memory-promote'))!;
    clickText(row as HTMLElement, 'button', 'Approve');
    await flush();
    snap = await adapter.entSnapshot(entId);
    expect(snap.ok ? snap.value.record.memory.length : 0).toBe(1);
    expect(root.querySelector('.ent-memory-list')?.textContent).toContain('Civilization design brief');
    expect(root.querySelector('.ent-memory-list')?.textContent).toContain('promoted');
    // ref-only surface: title + sha + extractive summary, never a body
    expect(root.querySelector('.ent-memory-list')?.textContent).not.toContain('Artifact body text');

    // search narrows
    const searchInput = root.querySelector<HTMLInputElement>('input[aria-label="Search shared memory"]')!;
    searchInput.value = 'nonexistent-zzz';
    clickText(root, 'button', 'Search');
    await flush();
    expect(root.querySelector('.ent-memory-list')?.textContent).toContain('No memory entries');

    // revoke (re-query: the search re-rendered the section)
    const searchInput2 = root.querySelector<HTMLInputElement>('input[aria-label="Search shared memory"]')!;
    searchInput2.value = 'civilization';
    clickText(root, 'button', 'Search');
    await flush();
    clickText(root, '.ent-memory-list button', 'Revoke');
    await flush();
    snap = await adapter.entSnapshot(entId);
    expect(snap.ok ? snap.value.record.memory[0]?.status : null).toBe('revoked');
  });
});

describe('CEO portfolio: work ledger', () => {
  it('bullet view shows ask/prompt hash/summary/usage; company/department/worker filters hit the bridge', async () => {
    const { root, backend } = await bootWithEnterprise();
    await applyBlueprint(root);

    const ledger = root.querySelector('.ent-ledger-bullets')!;
    expect(ledger.textContent).toContain('Draft the civilization design brief');
    expect(ledger.textContent).toContain(`prompt sha256 ${'a'.repeat(12)}`);
    expect(ledger.textContent).toContain('bounded extractive summary');
    expect(ledger.textContent).toContain('1200+800 tok');
    expect(ledger.textContent).toContain('$0.00');

    const companySel = root.querySelector<HTMLSelectElement>('select[aria-label="Filter ledger by company"]')!;
    companySel.value = 'software';
    companySel.dispatchEvent(new Event('change'));
    await flush();
    const filtered = root.querySelector('.ent-ledger-bullets')!;
    expect(filtered.textContent).toContain('Implement the geometry service endpoint');
    expect(filtered.textContent).not.toContain('Draft the civilization design brief');

    // re-query: every filter application re-renders the section
    const companySel2 = root.querySelector<HTMLSelectElement>('select[aria-label="Filter ledger by company"]')!;
    companySel2.value = '';
    companySel2.dispatchEvent(new Event('change'));
    await flush();
    const deptSel = root.querySelector<HTMLSelectElement>('select[aria-label="Filter ledger by department"]')!;
    deptSel.value = 'svc-design';
    deptSel.dispatchEvent(new Event('change'));
    await flush();
    const filtered2 = root.querySelector('.ent-ledger-bullets')!;
    expect(filtered2.textContent).toContain('Draft the civilization design brief');
    expect(filtered2.textContent).not.toContain('Implement the geometry service endpoint');

    // worker filter is passed to the bridge (reset the department filter first)
    const deptSel2 = root.querySelector<HTMLSelectElement>('select[aria-label="Filter ledger by department"]')!;
    deptSel2.value = '';
    deptSel2.dispatchEvent(new Event('change'));
    await flush();
    const workerInput = root.querySelector<HTMLInputElement>('input[aria-label="Filter ledger by worker id"]')!;
    workerInput.value = 'worker-0002';
    clickText(root, 'button', 'Apply filters');
    await flush();
    const filtered3 = root.querySelector('.ent-ledger-bullets')!;
    expect(filtered3.textContent).toContain('Implement the geometry service endpoint');

    // timeline: incremental afterIndex paging
    clickText(root, 'button', 'Load timeline');
    await flush();
    expect(root.textContent).toContain('Load more (after #4)');

    // export writes HANDOFFS + timeline + ledger
    clickText(root, 'button', 'Export HANDOFFS + timeline + ledger');
    await flush();
    expect(backend.exportCalls).toBe(1);
  });
});

describe('CEO portfolio: employees (OCC)', () => {
  it('reassign room/parent, next-run instructions+budget override, seat suspend — all expectedVersion-pinned', async () => {
    const { root, backend, entId } = await bootWithEnterprise();
    await applyBlueprint(root);

    // inspector loads the first company's office project
    await flush(20);
    const workerTable = root.querySelector('.ent-worker-table');
    expect(workerTable, 'employee table renders').toBeTruthy();

    // next-run override dialog
    const editBtn = root.querySelector<HTMLButtonElement>('button[data-focus-key^="worker-edit-"]')!;
    editBtn.click();
    await flush();
    const dialogs = [...document.querySelectorAll<HTMLElement>('.modal-backdrop:not(.hidden)')];
    const dialog = dialogs[dialogs.length - 1]!;
    expect(dialog.textContent).toContain('Next-run override');
    const textarea = dialog.querySelector<HTMLTextAreaElement>('textarea')!;
    textarea.value = 'Focus on the geometry endpoint first.';
    const usdInput = dialog.querySelector<HTMLInputElement>('input[aria-label="Next-run max USD"]')!;
    usdInput.value = '0.50';
    clickText(dialog, 'button', 'Save override');
    await flush();
    const rec = backend.records.get(entId)!;
    const override = Object.values(rec.workerOverrides)[0];
    expect(override?.instructions).toContain('geometry endpoint');
    expect(override?.budget?.maxUsd).toBe(0.5);

    // reassign with room + parent (OCC: stale expectedVersion is rejected)
    const versionBefore = backend.records.get(entId)!.version;
    await expect(
      adapterLike(backend).entWorkerUpdate({
        enterpriseId: entId,
        expectedVersion: versionBefore + 99,
        op: 'reassign',
        companyKey: 'software',
        workerId: 'n-builder',
        roomId: 'engineering',
        parentId: null,
      }),
    ).resolves.toMatchObject({ ok: false });
  });
});

function adapterLike(backend: FakeEntBackend): BridgeAdapter {
  return new BridgeAdapter(backend.raw());
}

describe('CEO portfolio: stewards', () => {
  it('recommendations are labeled system-derived with zero provider calls; no provider traffic at all', async () => {
    const { root, backend } = await bootWithEnterprise();
    await applyBlueprint(root);
    expect(root.textContent).toContain('system-derived · zero provider calls');
    expect(root.textContent).toContain('Budget Steward');
    expect(root.textContent).toContain('worker.capacity');
    // the whole flow (create/preview/apply/program/contracts/memory/ledger/stewards) made zero provider calls
    expect(backend.providerModelCalls).toBe(0);
  });
});

describe('CEO portfolio: v4 fallback', () => {
  it('a v4 bridge without ent methods yields an honest unavailable surface, office unaffected', async () => {
    mountChromeDom();
    const root = document.createElement('div');
    document.body.append(root);
    const overlay = createOverlayHost(document.getElementById('overlay-root')!);
    const v4Raw = {
      version: 4,
      listSkills: async () => [],
      listProviderModels: async () => ({ ok: true, models: [] }),
    } as unknown as RawBridge;
    const adapter = new BridgeAdapter(v4Raw);
    expect(adapter.capabilities.ceo).toBe(false);
    const { factory } = makeFakePanzoom();
    const app = createEnterpriseApp({
      root,
      adapter,
      overlay,
      panzoomFactory: factory as never,
      openProject: () => undefined,
    });
    await app.show();
    await flush();
    expect(root.textContent).toContain('CEO mode is unavailable');
    expect(root.textContent).toContain('Office, chat, and connections are unaffected');
    // no enterprise controls leak through
    expect(root.querySelector('.ent-program-controls')).toBeNull();
    expect(root.querySelector('.ent-contracts-table')).toBeNull();
  });
});
