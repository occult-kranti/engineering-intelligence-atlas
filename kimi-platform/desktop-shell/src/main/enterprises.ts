import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import {
  ENTERPRISE_CONTRACT_VERSION,
  EnterpriseBlueprintSchema,
  EnterpriseKeySchema,
  EnterpriseBudgetSchema,
  EnterpriseProgramSchema,
  MemoryEntrySchema,
  WorkLedgerEntrySchema,
  deriveEnterpriseView,
  deriveTimelineIndex,
  generateEnterpriseBlueprint,
  partitionBudget,
  blueprintHash as hashBlueprint,
  enterpriseApprovalPayloadHash,
  sharedServiceDepartmentKey,
  canonicalJson,
  sha256Hex,
  type EnterpriseBlueprint,
  type EnterpriseBudget,
  type EnterpriseProgram,
  type EnterpriseApprovalKind,
  type CompanyRun,
  type MemoryEntry,
  type MemoryScope,
  type ArtifactRef,
  type WorkLedgerEntry,
  type HandoffManifest,
  type StewardRecommendation,
  type WorkerContractStatus,
  type GenerateBlueprintInput,
  type Sha256Hex,
  type EnterpriseView,
} from '../shared/enterprise';
import type {
  BudgetLimits,
  PriceRates,
  Project,
  ProjectProvider,
  ProjectRun,
} from '../shared/contract';
import { ProjectStore, ProjectRunner } from './projects';
import type { SkillRegistry } from './skills';
import { capUtf8, truncationMarker } from './textCap';

/**
 * v0.5 CEO mode: EnterpriseStore + EnterpriseProgramRunner.
 *
 * Persistence under `userData/enterprises/<enterpriseId>/`:
 *   enterprise.json    — the whole record (atomic write, OCC `version`)
 *   events.jsonl       — append-only enterprise events (seq, ts, event, detail)
 *   ledger.jsonl       — append-only WorkLedgerEntry rows (token-free DTOs)
 *   cache/             — content-hash skill-excerpt + blueprint caches
 *   exports/           — HANDOFFS.md, timeline-index.json, ledger.json/.md
 *
 * Hard guarantees:
 *  - Atomic/OCC/idempotent: every mutation re-reads, validates, bumps
 *    `version`, and writes atomically (tmp + rename). createEnterprise is
 *    idempotent per programId; blueprint apply is idempotent per company.
 *  - Companies are 1:1 existing Projects (created through ProjectStore, run
 *    through the EXISTING ProjectRunner — no second agent runtime).
 *  - Contracts are seat identities with capacity leases (fencing + TTL +
 *    drain); a lease can never be double-booked.
 *  - Memory entries are REFERENCE-ONLY (ArtifactRef + bounded extractive
 *    summary); promote is approval-gated, revoke is direct.
 *  - Ledger/handoff/timeline/steward outputs are deterministic system
 *    derivations: NO provider calls, no cached provider responses.
 *  - No code execution, no tool use, no external writes — only JSON/Markdown
 *    under userData/enterprises plus the existing ProjectStore writes.
 *  - No secrets: prompts/API keys never enter this module.
 */

const MAX_NAME = 255;
const MAX_MISSION = 2000;
const MAX_MEMORY_ENTRIES = 500;
const MAX_LEDGER_ENTRIES = 20_000;
const DEFAULT_LEASE_TTL_MS = 30 * 60_000;
const MAX_LEASE_TTL_MS = 24 * 60 * 60_000;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 4;

const TERMINAL_RUN_STATUSES = new Set(['completed', 'failed', 'cancelled', 'terminated']);
const PROGRAM_ACTIVE_STATES = new Set(['dispatching', 'running', 'reconciling']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
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

// ---------------------------------------------------------------------------
// Record shapes (persisted in enterprise.json)
// ---------------------------------------------------------------------------

export interface EnterpriseCompanyMaterialization {
  projectId: string;
  createdAt: string;
}

/** Capacity lease on a contract seat: fenced, TTL-bounded, drainable. */
export interface SeatLease {
  runId: string;
  fence: number;
  acquiredAt: string;
  expiresAt: string;
  ttlMs: number;
  status: 'active' | 'draining' | 'released';
}

export interface ContractRuntime {
  status: WorkerContractStatus;
  staffed: boolean;
  skillId: string;
  capacityShare: number;
  /** Contract revision; bumped on every renegotiation (capacity/decision). */
  version: number;
  /** Monotonic fencing counter; every new lease takes the next token. */
  fenceCounter: number;
  lease: SeatLease | null;
}

export interface EnterpriseApprovalRecord {
  /** Deterministic id: same kind+scope+payload hash -> same approval. */
  id: string;
  kind: EnterpriseApprovalKind;
  blueprintHash: Sha256Hex;
  payloadHash: Sha256Hex;
  payload: unknown;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt: string | null;
}

export interface MemoryRecord {
  entry: MemoryEntry;
  status: 'promoted' | 'revoked';
  promotedAt: string;
  revokedAt: string | null;
}

/** Per-worker edit applied to the NEXT run (instructions/budget). */
export interface WorkerOverride {
  instructions?: string;
  budget?: Partial<BudgetLimits>;
}

export interface EnterpriseRecord {
  contractVersion: typeof ENTERPRISE_CONTRACT_VERSION;
  id: string;
  programId: string;
  preset: 'creative_technology_group';
  name: string;
  mission: string;
  provider: ProjectProvider;
  model: string;
  priceRates: PriceRates;
  /** OCC version; bumped on EVERY mutation. */
  version: number;
  state: 'draft' | 'materialized';
  blueprint: EnterpriseBlueprint | null;
  blueprintHash: Sha256Hex | null;
  program: EnterpriseProgram | null;
  /** Runtime-only pause flag (the shared state machine has no 'paused'). */
  programPaused: boolean;
  companies: Record<string, EnterpriseCompanyMaterialization>;
  /** departmentKey -> worker-node location in the shared-services project. */
  departments: Record<string, { projectId: string; nodeId: string }>;
  /** contractKey -> worker-node seat location (shared-services project). */
  contractWorkers: Record<string, { projectId: string; nodeId: string }>;
  contracts: Record<string, ContractRuntime>;
  approvals: EnterpriseApprovalRecord[];
  memory: MemoryRecord[];
  workerOverrides: Record<string, WorkerOverride>;
  /** Dedupe keys for ledger derivation (runId:nodeId:kind:attempt). */
  ledgerKeys: string[];
  ledgerSeq: number;
  eventSeq: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseEventRecord {
  seq: number;
  ts: string;
  event: string;
  detail?: string;
}

export interface EnterpriseSummary {
  id: string;
  programId: string;
  name: string;
  state: EnterpriseRecord['state'];
  version: number;
  blueprintHash: Sha256Hex | null;
  programState: EnterpriseProgram['state'] | null;
  programPaused: boolean;
  companyCount: number;
  departmentCount: number;
  contractCount: number;
  createdAt: string;
  updatedAt: string;
}

function summarize(record: EnterpriseRecord): EnterpriseSummary {
  return {
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
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertKey(value: unknown, label: string): string {
  const parsed = EnterpriseKeySchema.safeParse(value);
  if (!parsed.success) throw new Error(`invalid ${label}: must be lowercase kebab-case (1..64 chars)`);
  return parsed.data;
}

function assertBudget(budget: unknown): EnterpriseBudget {
  const parsed = EnterpriseBudgetSchema.safeParse(budget);
  if (!parsed.success) throw new Error('invalid enterprise budget (positive maxTokens/maxCalls/maxMinutes/maxCostUsdMicros required)');
  return parsed.data;
}

function assertVersion(record: EnterpriseRecord, expectedVersion: unknown): void {
  if (!Number.isInteger(expectedVersion)) throw new Error('expectedVersion must be an integer');
  if (record.version !== expectedVersion) {
    throw new Error(`version conflict: enterprise is at version ${record.version}, you sent ${String(expectedVersion)}`);
  }
}

/** Deterministic approval id: identical re-requests map to the same record. */
function approvalIdFor(kind: EnterpriseApprovalKind, blueprintHash: string, payloadHash: string): string {
  return `ent-appr-${sha256Hex(canonicalJson({ kind, blueprintHash, payloadHash })).slice(0, 24)}`;
}

// ---------------------------------------------------------------------------
// EnterpriseStore
// ---------------------------------------------------------------------------

export interface EnterpriseStoreDeps {
  projects: ProjectStore;
  skills?: { registry: SkillRegistry; root: string } | null;
  /** Wall-clock ms; injectable for deterministic tests. */
  now?: () => number;
}

export class EnterpriseStore {
  private readonly root: string;
  private readonly projects: ProjectStore;
  private readonly skills: { registry: SkillRegistry; root: string } | null;
  private readonly now: () => number;

  constructor(userDataPath: string, deps: EnterpriseStoreDeps) {
    this.root = path.join(userDataPath, 'enterprises');
    fs.mkdirSync(this.root, { recursive: true });
    this.projects = deps.projects;
    this.skills = deps.skills ?? null;
    this.now = deps.now ?? Date.now;
  }

  // ------------------------------------------------------------- persistence

  private dir(id: string): string {
    const safe = assertKey(id.replace(/^ent-/, ''), 'enterprise id');
    const resolved = path.resolve(this.root, `ent-${safe}`);
    if (!resolved.startsWith(path.resolve(this.root) + path.sep)) throw new Error('invalid enterprise id');
    return resolved;
  }

  private recordPath(id: string): string {
    return path.join(this.dir(id), 'enterprise.json');
  }

  private load(id: string): EnterpriseRecord | null {
    try {
      const raw = JSON.parse(fs.readFileSync(this.recordPath(id), 'utf8')) as EnterpriseRecord;
      if (!isRecord(raw) || typeof raw.id !== 'string' || !Number.isInteger(raw.version)) return null;
      return raw;
    } catch {
      return null;
    }
  }

  private loadOrThrow(id: string): EnterpriseRecord {
    const record = this.load(id);
    if (!record) throw new Error('unknown enterprise id');
    return record;
  }

  private save(record: EnterpriseRecord): EnterpriseRecord {
    record.version += 1;
    record.updatedAt = nowIso();
    atomicWrite(this.recordPath(record.id), JSON.stringify(record, null, 2));
    return record;
  }

  /** Append-only enterprise event log (seq assigned from the record). */
  private appendEvent(record: EnterpriseRecord, event: string, detail?: string): void {
    record.eventSeq += 1;
    const entry: EnterpriseEventRecord = {
      seq: record.eventSeq,
      ts: nowIso(),
      event,
      ...(detail !== undefined ? { detail: detail.slice(0, 300) } : {}),
    };
    appendLine(path.join(this.dir(record.id), 'events.jsonl'), JSON.stringify(entry));
  }

  readEvents(id: string, afterIndex = 0, limit = 1000): { events: EnterpriseEventRecord[]; nextIndex: number } {
    let raw: string;
    try {
      raw = fs.readFileSync(path.join(this.dir(id), 'events.jsonl'), 'utf8');
    } catch {
      return { events: [], nextIndex: 0 };
    }
    const parsed: EnterpriseEventRecord[] = [];
    for (const line of raw.split('\n')) {
      if (line.trim().length === 0) continue;
      try {
        const rec = JSON.parse(line) as EnterpriseEventRecord;
        if (isRecord(rec) && Number.isInteger(rec.seq) && typeof rec.event === 'string') parsed.push(rec);
      } catch {
        // skip corrupt line — never throw on read
      }
    }
    const start = Math.max(0, Math.min(afterIndex, parsed.length));
    const events = parsed.slice(start, start + Math.min(Math.max(limit, 1), 5000));
    return { events, nextIndex: start + events.length };
  }

  // ------------------------------------------------------------------ CRUD

  list(): EnterpriseSummary[] {
    let dirs: fs.Dirent[];
    try {
      dirs = fs.readdirSync(this.root, { withFileTypes: true });
    } catch {
      return [];
    }
    const out: EnterpriseSummary[] = [];
    for (const dir of dirs) {
      if (!dir.isDirectory() || !dir.name.startsWith('ent-')) continue;
      const record = this.load(dir.name);
      if (record) out.push(summarize(record));
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): EnterpriseRecord | null {
    const record = this.load(id);
    return record ? clone(record) : null;
  }

  summary(id: string): EnterpriseSummary | null {
    const record = this.load(id);
    return record ? summarize(record) : null;
  }

  /**
   * Idempotent create: the same programId always maps to `ent-<programId>`;
   * re-creating returns the existing record with created=false.
   */
  create(req: {
    preset: unknown;
    programId: unknown;
    name: unknown;
    mission: unknown;
    budget: unknown;
    maxReplans?: unknown;
    maxConcurrentRuns?: unknown;
    provider: unknown;
    model: unknown;
    priceRates?: unknown;
  }): { record: EnterpriseRecord; created: boolean } {
    if (!isRecord(req)) throw new Error('request must be an object');
    if (req.preset !== 'creative_technology_group') throw new Error('unknown enterprise preset');
    const programId = assertKey(req.programId, 'program id');
    const name = String(req.name ?? '').trim();
    if (name.length === 0 || name.length > MAX_NAME) throw new Error(`name must be 1..${MAX_NAME} characters`);
    const mission = String(req.mission ?? '').trim();
    if (mission.length === 0 || mission.length > MAX_MISSION) throw new Error(`mission must be 1..${MAX_MISSION} characters`);
    const budget = assertBudget(req.budget);
    if (req.provider !== 'openai' && req.provider !== 'anthropic' && req.provider !== 'ollama') {
      throw new Error('provider must be one of: openai, anthropic, ollama');
    }
    const model = String(req.model ?? '').trim();
    if (model.length === 0 || model.length > 200) throw new Error('model must be selected or entered explicitly');
    const maxReplans = req.maxReplans === undefined ? 2 : Number(req.maxReplans);
    if (!Number.isInteger(maxReplans) || maxReplans < 0 || maxReplans > 10) throw new Error('maxReplans must be an integer 0..10');
    const maxConcurrentRuns = req.maxConcurrentRuns === undefined ? DEFAULT_CONCURRENCY : Number(req.maxConcurrentRuns);
    if (!Number.isInteger(maxConcurrentRuns) || maxConcurrentRuns < 1 || maxConcurrentRuns > 64) {
      throw new Error('maxConcurrentRuns must be an integer 1..64');
    }
    const priceRatesRaw = isRecord(req.priceRates) ? req.priceRates : {};
    const priceRates: PriceRates = {
      inputUsdPerMillion: Number(priceRatesRaw.inputUsdPerMillion ?? 0),
      outputUsdPerMillion: Number(priceRatesRaw.outputUsdPerMillion ?? 0),
    };
    for (const [k, v] of Object.entries(priceRates)) {
      if (!Number.isFinite(v) || v < 0 || v > 100_000) throw new Error(`priceRates.${k} must be a finite number 0..100000`);
    }

    const id = `ent-${programId}`;
    const existing = this.load(id);
    if (existing) return { record: clone(existing), created: false };

    const now = nowIso();
    const record: EnterpriseRecord = {
      contractVersion: ENTERPRISE_CONTRACT_VERSION,
      id,
      programId,
      preset: 'creative_technology_group',
      name,
      mission,
      provider: req.provider,
      model,
      priceRates,
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
      createdAt: now,
      updatedAt: now,
    };
    atomicWrite(this.recordPath(id), JSON.stringify(record, null, 2));
    // Generator params sidecar: previews/applies regenerate the exact
    // blueprint deterministically, even across process restarts.
    atomicWrite(
      path.join(this.dir(id), 'generator.json'),
      JSON.stringify({ budget, maxReplans, maxConcurrentRuns }, null, 2),
    );
    this.appendEvent(record, 'enterprise-created', name);
    atomicWrite(this.recordPath(id), JSON.stringify(record, null, 2));
    return { record: clone(record), created: true };
  }

  /** OCC update of editable metadata (name/mission). */
  update(req: { id: unknown; expectedVersion: unknown; name?: unknown; mission?: unknown }): EnterpriseRecord {
    if (!isRecord(req)) throw new Error('request must be an object');
    const record = this.loadOrThrow(String(req.id ?? ''));
    assertVersion(record, req.expectedVersion);
    if (req.name !== undefined) {
      const name = String(req.name).trim();
      if (name.length === 0 || name.length > MAX_NAME) throw new Error(`name must be 1..${MAX_NAME} characters`);
      record.name = name;
    }
    if (req.mission !== undefined) {
      const mission = String(req.mission).trim();
      if (mission.length === 0 || mission.length > MAX_MISSION) throw new Error(`mission must be 1..${MAX_MISSION} characters`);
      record.mission = mission;
    }
    this.appendEvent(record, 'enterprise-updated');
    return clone(this.save(record));
  }

  // -------------------------------------------------------- blueprint flow

  /** Verified bundled skills = the only ids that may mark contracts staffed. */
  availableSkillIds(): string[] {
    if (!this.skills) return [];
    return this.skills.registry.list().filter((s) => s.verified).map((s) => s.id);
  }

  /** Blueprints carry the generator budget; drafts use the sidecar file. */
  private generatorParams(record: EnterpriseRecord): { budget: EnterpriseBudget; maxReplans: number; maxConcurrentRuns: number } {
    if (record.blueprint) {
      return {
        budget: record.blueprint.budget,
        maxReplans: record.blueprint.maxReplans,
        maxConcurrentRuns: record.blueprint.maxConcurrentRuns,
      };
    }
    // Drafts persist generator params in a sidecar so restarts keep the
    // exact generator input (deterministic preview/apply across processes).
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(this.dir(record.id), 'generator.json'), 'utf8')) as {
        budget: EnterpriseBudget;
        maxReplans: number;
        maxConcurrentRuns: number;
      };
      return { budget: assertBudget(raw.budget), maxReplans: raw.maxReplans, maxConcurrentRuns: raw.maxConcurrentRuns };
    } catch {
      throw new Error('generator parameters missing for draft enterprise');
    }
  }

  /**
   * Deterministic preview. Generates the blueprint, computes the
   * materialization payload + its hash, and get-or-creates the pinned
   * blueprint-activation approval (pending). Nothing is materialized here.
   */
  previewBlueprint(req: { enterpriseId: unknown; expectedVersion: unknown; availableSkillIds?: unknown }): {
    blueprint: EnterpriseBlueprint;
    blueprintHash: Sha256Hex;
    payload: unknown;
    payloadHash: Sha256Hex;
    expectedVersion: number;
    approval: EnterpriseApprovalRecord;
  } {
    if (!isRecord(req)) throw new Error('request must be an object');
    const record = this.loadOrThrow(String(req.enterpriseId ?? ''));
    assertVersion(record, req.expectedVersion);
    const available = Array.isArray(req.availableSkillIds)
      ? req.availableSkillIds.map((s) => String(s)).filter((s) => s.length > 0)
      : this.availableSkillIds();
    const params = this.generatorParams(record);
    const input: GenerateBlueprintInput = {
      preset: record.preset,
      programId: record.programId,
      name: record.name,
      mission: record.mission,
      budget: params.budget,
      availableSkillIds: available,
      maxReplans: params.maxReplans,
      maxConcurrentRuns: params.maxConcurrentRuns,
    };
    const blueprint = generateEnterpriseBlueprint(input);
    const hash = hashBlueprint(blueprint);
    const payload = {
      blueprintHash: hash,
      companies: blueprint.companies.map((c) => ({ key: c.key, name: c.name, kind: c.kind, disciplines: c.disciplines })),
      departments: blueprint.departments.map((d) => ({ key: d.key, companyKey: d.companyKey, discipline: d.discipline })),
      contracts: blueprint.contracts.map((w) => ({
        key: w.key,
        companyKey: w.companyKey,
        departmentKey: w.departmentKey,
        skillId: w.skillPin.skillId,
        staffed: w.staffed,
        capacityShare: w.capacityShare,
      })),
    };
    const payloadHash = enterpriseApprovalPayloadHash(payload);
    const { approval, created } = this.getOrCreateApproval(record, 'blueprint-activation', hash, payload);
    if (created) this.save(record); // no save (no OCC churn) on repeat previews
    return { blueprint, blueprintHash: hash, payload, payloadHash, expectedVersion: record.version, approval };
  }

  private getOrCreateApproval(
    record: EnterpriseRecord,
    kind: EnterpriseApprovalKind,
    blueprintHash: Sha256Hex,
    payload: unknown,
  ): { approval: EnterpriseApprovalRecord; created: boolean } {
    const payloadHash = enterpriseApprovalPayloadHash(payload);
    const id = approvalIdFor(kind, blueprintHash, payloadHash);
    const existing = record.approvals.find((a) => a.id === id);
    if (existing) return { approval: existing, created: false };
    const approval: EnterpriseApprovalRecord = {
      id,
      kind,
      blueprintHash,
      payloadHash,
      payload,
      status: 'pending',
      createdAt: nowIso(),
      decidedAt: null,
    };
    record.approvals.push(approval);
    this.appendEvent(record, 'approval-requested', `${kind} ${id}`);
    return { approval, created: true };
  }

  listApprovals(id: string): EnterpriseApprovalRecord[] {
    return clone(this.loadOrThrow(id).approvals);
  }

  /**
   * Decide an enterprise approval exactly once, pinned by payloadHash.
   * Approving a memory-promote approval performs the (ref-only) promotion as
   * the side effect of the decision — mirroring decideHireApproval.
   */
  decideApproval(req: { enterpriseId: unknown; approvalId: unknown; decision: unknown; payloadHash: unknown }): {
    ok: boolean;
    approval?: EnterpriseApprovalRecord;
    error?: string;
  } {
    try {
      if (!isRecord(req)) return { ok: false, error: 'request must be an object' };
      const record = this.loadOrThrow(String(req.enterpriseId ?? ''));
      if (typeof req.approvalId !== 'string') return { ok: false, error: 'approvalId must be a string' };
      if (req.decision !== 'approved' && req.decision !== 'rejected') return { ok: false, error: 'decision must be approved or rejected' };
      if (typeof req.payloadHash !== 'string') return { ok: false, error: 'payloadHash must be a string' };
      const approval = record.approvals.find((a) => a.id === req.approvalId);
      if (!approval) return { ok: false, error: 'unknown approval id' };
      if (approval.payloadHash !== req.payloadHash) {
        return { ok: false, error: 'payload hash mismatch: refusing to decide a different payload than was requested' };
      }
      if (approval.status !== 'pending') {
        return { ok: false, error: `approval was already ${approval.status}; decisions are exactly-once` };
      }
      approval.status = req.decision;
      approval.decidedAt = nowIso();
      this.appendEvent(record, `approval-${req.decision}`, `${approval.kind} ${approval.id}`);
      if (req.decision === 'approved' && approval.kind === 'memory-promote') {
        this.applyMemoryPromotion(record, approval);
      }
      this.save(record);
      return { ok: true, approval: clone(approval) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Materialize an approved blueprint. Pins: blueprintHash + payloadHash +
   * expectedVersion + confirmed. Idempotent per company: existing company
   * projects are reused, never recreated; a second apply of the same
   * blueprint is a no-op that returns the same materialization.
   */
  applyBlueprint(req: {
    enterpriseId: unknown;
    blueprintHash: unknown;
    payloadHash: unknown;
    expectedVersion: unknown;
    confirmed: unknown;
  }): { ok: boolean; record?: EnterpriseRecord; error?: string } {
    try {
      if (!isRecord(req)) return { ok: false, error: 'request must be an object' };
      if (req.confirmed !== true) return { ok: false, error: 'blueprint apply requires explicit user confirmation (confirmed: true)' };
      const record = this.loadOrThrow(String(req.enterpriseId ?? ''));
      assertVersion(record, req.expectedVersion);
      if (typeof req.blueprintHash !== 'string' || typeof req.payloadHash !== 'string') {
        return { ok: false, error: 'blueprintHash and payloadHash must be strings' };
      }
      const params = this.generatorParams(record);
      const blueprint = generateEnterpriseBlueprint({
        preset: record.preset,
        programId: record.programId,
        name: record.name,
        mission: record.mission,
        budget: params.budget,
        availableSkillIds: this.blueprintSkillIds(record, req.blueprintHash),
        maxReplans: params.maxReplans,
        maxConcurrentRuns: params.maxConcurrentRuns,
      });
      const hash = hashBlueprint(blueprint);
      if (hash !== req.blueprintHash) {
        return { ok: false, error: 'blueprint hash mismatch: the blueprint changed since preview; re-preview' };
      }
      const approval = record.approvals.find(
        (a) => a.kind === 'blueprint-activation' && a.blueprintHash === hash && a.payloadHash === req.payloadHash,
      );
      if (!approval) return { ok: false, error: 'no blueprint-activation approval exists for this payload; preview first' };
      if (approval.status !== 'approved') {
        return { ok: false, error: `blueprint-activation approval is ${approval.status}; approve it before applying` };
      }

      EnterpriseBlueprintSchema.parse(blueprint);
      record.blueprint = blueprint;
      record.blueprintHash = hash;

      // Materialize companies 1:1 as office projects (idempotent per company).
      for (const company of blueprint.companies) {
        const existingLink = record.companies[company.key];
        if (existingLink && this.projects.getProject(existingLink.projectId)) continue;
        const project = this.projects.createProject({
          name: `${record.name} — ${company.name}`.slice(0, 120),
          goal: `${record.mission}\n\nCompany mission: ${company.mission || company.name}\nDisciplines: ${company.disciplines.join(', ')}`.slice(0, 8000),
          provider: record.provider,
          model: record.model,
          template: 'office',
        });
        record.companies[company.key] = { projectId: project.id, createdAt: nowIso() };
        this.appendEvent(record, 'company-materialized', `${company.key} -> project ${project.id}`);
      }

      // Materialize shared-service departments + contract seats as worker
      // nodes inside the shared-services company project (owner path).
      this.materializeNodes(record, blueprint);

      // Contract runtime seats.
      for (const contract of blueprint.contracts) {
        if (!record.contracts[contract.key]) {
          record.contracts[contract.key] = {
            status: 'proposed',
            staffed: contract.staffed,
            skillId: contract.skillPin.skillId,
            capacityShare: contract.capacityShare,
            version: 1,
            fenceCounter: 0,
            lease: null,
          };
        }
      }

      // Program state machine: draft -> blueprint_ready -> awaiting approval.
      // Idempotent re-apply: an existing program is never clobbered.
      if (record.program === null) {
        const companyRuns: CompanyRun[] = blueprint.companies
          .filter((c) => c.kind === 'line')
          .map((c) => ({ companyKey: c.key, runId: null, status: 'pending' as const }));
        record.program = {
        contractVersion: ENTERPRISE_CONTRACT_VERSION,
        programId: record.programId,
        state: 'awaiting_plan_approval',
        version: 1,
        blueprintHash: hash,
        companyRuns,
        maxReplans: blueprint.maxReplans,
        maxConcurrentRuns: Math.min(blueprint.maxConcurrentRuns, MAX_CONCURRENCY),
        budget: blueprint.budget,
      };
        record.programPaused = false;
        const planPayload = {
          blueprintHash: hash,
          programVersion: record.program.version,
          companyRuns: companyRuns.map((r) => r.companyKey),
          budget: blueprint.budget,
          maxConcurrentRuns: record.program.maxConcurrentRuns,
        };
        this.getOrCreateApproval(record, 'plan', hash, planPayload);
      }
      record.state = 'materialized';
      this.appendEvent(record, 'blueprint-applied', hash.slice(0, 16));
      this.save(record);
      return { ok: true, record: clone(record) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Skill ids pinned by the approved preview for this blueprint hash. */
  private blueprintSkillIds(record: EnterpriseRecord, hash: string): string[] {
    const approval = record.approvals.find((a) => a.kind === 'blueprint-activation' && a.blueprintHash === hash);
    const payload = approval?.payload;
    if (isRecord(payload) && Array.isArray(payload.contracts)) {
      const ids = payload.contracts
        .map((c) => (isRecord(c) && c.staffed === true ? String(c.skillId ?? '') : ''))
        .filter((s) => s.length > 0);
      // Only ids declared for their discipline pass generateEnterpriseBlueprint;
      // unknown ids are ignored there by construction.
      return ids;
    }
    return this.availableSkillIds();
  }

  /**
   * Add department/seat nodes to the shared-services project via ProjectStore
   * (validated, OCC-safe). Runs AFTER company materialization.
   */
  private materializeNodes(record: EnterpriseRecord, blueprint: EnterpriseBlueprint): void {
    const shared = blueprint.companies.find((c) => c.kind === 'shared-services');
    if (!shared) return;
    const link = record.companies[shared.key];
    if (!link) return;
    const project = this.projects.getProject(link.projectId);
    if (!project) return;
    const director = project.nodes.find((n) => n.kind === 'director') ?? project.nodes.find((n) => n.parentId == null);
    if (!director) return;
    const verified = new Set(this.availableSkillIds());

    // Departments first (depth 1, parented to the Director).
    const deptAdditions = blueprint.departments.filter((d) => !record.departments[d.key]);
    if (deptAdditions.length > 0) {
      const placed = this.projects.appendHierarchyNodes(
        link.projectId,
        deptAdditions.map((d) => ({
          role: 'research' as const,
          title: `Department: ${d.key}`.slice(0, 80),
          instructions: `Shared-service department "${d.key}" (${d.discipline}). Coordinate the contracted seats for the line companies.`,
          parentId: director.id,
          roomId: 'research',
          skillRef: null,
        })),
      );
      deptAdditions.forEach((d, i) => {
        const nodeId = placed[i];
        if (nodeId) record.departments[d.key] = { projectId: link.projectId, nodeId };
      });
    }

    // Contract seats (depth 2, parented to their department).
    const seatAdditions = blueprint.contracts.filter((w) => !record.contractWorkers[w.key]);
    const seatsPlaced: string[] = [];
    for (const w of seatAdditions) {
      const deptNode = record.departments[w.departmentKey]?.nodeId;
      if (!deptNode) continue; // department missing: seat is honestly unplaced
      const attachSkill = w.staffed && (this.skills === null || verified.has(w.skillPin.skillId));
      const placed = this.projects.appendHierarchyNodes(link.projectId, [
        {
          role: 'custom' as const,
          title: `Seat: ${w.key}`.slice(0, 80),
          instructions:
            `Contracted seat "${w.key}" (${w.discipline}) serving line company "${w.companyKey}" under a capacity lease.` +
            (w.staffed ? '' : ' Skill pack not yet vetted: unstaffed.'),
          parentId: deptNode,
          roomId: 'research',
          skillRef: attachSkill ? w.skillPin.skillId : null,
        },
      ]);
      seatsPlaced.push(...placed);
      const nodeId = placed[0];
      if (nodeId) record.contractWorkers[w.key] = { projectId: link.projectId, nodeId };
    }
    const total = deptAdditions.length + seatsPlaced.length;
    if (total > 0) this.appendEvent(record, 'departments-materialized', `${deptAdditions.length} department(s), ${seatsPlaced.length} seat(s)`);
  }

  // ------------------------------------------------------------- contracts

  listContracts(id: string): Array<{ key: string; companyKey: string; departmentKey: string; discipline: string } & ContractRuntime> {
    const record = this.loadOrThrow(id);
    this.expireLeases(record);
    const bp = record.blueprint;
    return Object.entries(record.contracts).map(([key, rt]) => {
      const spec = bp?.contracts.find((w) => w.key === key);
      return {
        key,
        companyKey: spec?.companyKey ?? key.split('--')[0] ?? '',
        departmentKey: spec?.departmentKey ?? '',
        discipline: spec?.discipline ?? ('ai-research' as const),
        ...clone(rt),
      };
    });
  }

  /** Propose a new cross-office contract (never auto-active). */
  proposeContract(id: string, req: { key: unknown; companyKey: unknown; departmentKey: unknown; discipline: unknown; capacityShare: unknown; skillId: unknown; expectedVersion: unknown }): EnterpriseRecord {
    const record = this.loadOrThrow(id);
    assertVersion(record, req.expectedVersion);
    const bp = record.blueprint;
    if (!bp) throw new Error('apply a blueprint before proposing contracts');
    const key = assertKey(req.key, 'contract key');
    if (record.contracts[key]) throw new Error(`contract "${key}" already exists`);
    const companyKey = assertKey(req.companyKey, 'company key');
    const departmentKey = assertKey(req.departmentKey, 'department key');
    if (!bp.companies.some((c) => c.key === companyKey)) throw new Error(`unknown company "${companyKey}"`);
    if (!bp.departments.some((d) => d.key === departmentKey)) throw new Error(`unknown department "${departmentKey}"`);
    const capacityShare = Number(req.capacityShare);
    if (!Number.isFinite(capacityShare) || capacityShare <= 0 || capacityShare > 1) throw new Error('capacityShare must be in (0, 1]');
    const skillId = String(req.skillId ?? '');
    const staffed = this.availableSkillIds().includes(skillId);
    record.contracts[key] = {
      status: 'proposed',
      staffed,
      skillId,
      capacityShare,
      version: 1,
      fenceCounter: 0,
      lease: null,
    };
    this.appendEvent(record, 'contract-proposed', key);
    return clone(this.save(record));
  }

  /** Approve (activate) or reject (revoke) a proposed contract. */
  decideContract(id: string, req: { contractKey: unknown; decision: unknown; expectedVersion: unknown }): EnterpriseRecord {
    const record = this.loadOrThrow(id);
    assertVersion(record, req.expectedVersion);
    const key = String(req.contractKey ?? '');
    const contract = record.contracts[key];
    if (!contract) throw new Error(`unknown contract "${key}"`);
    if (contract.status !== 'proposed') throw new Error(`contract "${key}" is ${contract.status}; only proposed contracts can be decided`);
    if (req.decision === 'approved') {
      contract.status = 'active';
    } else if (req.decision === 'rejected') {
      contract.status = 'revoked';
    } else {
      throw new Error('decision must be approved or rejected');
    }
    contract.version += 1;
    this.appendEvent(record, `contract-${req.decision === 'approved' ? 'activated' : 'revoked'}`, key);
    return clone(this.save(record));
  }

  /** Release an active/draining contract; an active lease drains first. */
  releaseContract(id: string, req: { contractKey: unknown; expectedVersion: unknown }): EnterpriseRecord {
    const record = this.loadOrThrow(id);
    assertVersion(record, req.expectedVersion);
    const key = String(req.contractKey ?? '');
    const contract = record.contracts[key];
    if (!contract) throw new Error(`unknown contract "${key}"`);
    if (contract.status !== 'active' && contract.status !== 'draining') {
      throw new Error(`contract "${key}" is ${contract.status}; only active/draining contracts can be released`);
    }
    if (contract.lease && contract.lease.status === 'active' && !this.leaseExpired(contract.lease)) {
      contract.lease.status = 'draining';
      contract.status = 'draining';
      this.appendEvent(record, 'contract-draining', key);
    } else {
      contract.lease = null;
      contract.status = 'released';
      this.appendEvent(record, 'contract-released', key);
    }
    contract.version += 1;
    return clone(this.save(record));
  }

  // ---------------------------------------------------------------- leases

  private leaseExpired(lease: SeatLease): boolean {
    return Date.parse(lease.expiresAt) <= this.now();
  }

  /** Lazily expire leases (TTL) and finish drains. */
  private expireLeases(record: EnterpriseRecord): boolean {
    let changed = false;
    for (const [key, contract] of Object.entries(record.contracts)) {
      const lease = contract.lease;
      if (!lease) continue;
      if (lease.status === 'released') {
        contract.lease = null;
        changed = true;
        continue;
      }
      if (this.leaseExpired(lease)) {
        contract.lease = null;
        if (contract.status === 'draining') contract.status = 'released';
        this.appendEvent(record, 'lease-expired', key);
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Acquire the capacity lease for a contract seat before a dependent run.
   * Fencing: every acquisition takes fenceCounter+1; a live lease held by a
   * DIFFERENT runId is a double-booking error; re-acquiring with the same
   * runId is idempotent (returns the existing lease).
   */
  acquireLease(id: string, req: { contractKey: unknown; runId: unknown; ttlMs?: unknown }): { ok: boolean; lease?: SeatLease; error?: string } {
    try {
      const record = this.loadOrThrow(id);
      const key = String(req.contractKey ?? '');
      const contract = record.contracts[key];
      if (!contract) return { ok: false, error: `unknown contract "${key}"` };
      if (contract.status !== 'active') return { ok: false, error: `contract "${key}" is ${contract.status}; only active contracts lease seats` };
      const runId = String(req.runId ?? '');
      if (runId.length === 0 || runId.length > 128) return { ok: false, error: 'runId must be a non-empty string' };
      this.expireLeases(record);
      const existing = contract.lease;
      if (existing && existing.status !== 'released') {
        if (existing.runId === runId) {
          this.save(record);
          return { ok: true, lease: clone(existing) }; // idempotent re-acquire
        }
        return { ok: false, error: `seat double-booking refused: contract "${key}" is leased to run ${existing.runId} (fence ${existing.fence})` };
      }
      const ttlMs = Math.min(Math.max(Number(req.ttlMs ?? DEFAULT_LEASE_TTL_MS) || DEFAULT_LEASE_TTL_MS, 1000), MAX_LEASE_TTL_MS);
      contract.fenceCounter += 1;
      const lease: SeatLease = {
        runId,
        fence: contract.fenceCounter,
        acquiredAt: nowIso(),
        expiresAt: new Date(this.now() + ttlMs).toISOString(),
        ttlMs,
        status: 'active',
      };
      contract.lease = lease;
      this.appendEvent(record, 'lease-acquired', `${key} run ${runId} fence ${lease.fence}`);
      this.save(record);
      return { ok: true, lease: clone(lease) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Release a lease; requires the exact fencing token. Drains the contract. */
  releaseLease(id: string, req: { contractKey: unknown; runId: unknown; fence: unknown }): { ok: boolean; error?: string } {
    try {
      const record = this.loadOrThrow(id);
      const key = String(req.contractKey ?? '');
      const contract = record.contracts[key];
      if (!contract) return { ok: false, error: `unknown contract "${key}"` };
      const lease = contract.lease;
      if (!lease) return { ok: true }; // already released: idempotent
      if (lease.runId !== req.runId || lease.fence !== req.fence) {
        return { ok: false, error: `fence mismatch: lease is held by run ${lease.runId} at fence ${lease.fence}` };
      }
      lease.status = 'released';
      contract.lease = null;
      if (contract.status === 'draining') {
        contract.status = 'released';
        this.appendEvent(record, 'contract-released', key);
      }
      this.appendEvent(record, 'lease-released', `${key} run ${String(req.runId)} fence ${String(req.fence)}`);
      this.save(record);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ----------------------------------------------------------------- memory
  // Ref-only: memory entries carry an ArtifactRef + bounded extractive
  // summary, never artifact bodies. Promote is approval-gated; revoke is not.

  listMemory(id: string, opts?: { includeRevoked?: boolean }): MemoryRecord[] {
    const record = this.loadOrThrow(id);
    const all = clone(record.memory);
    return opts?.includeRevoked ? all : all.filter((m) => m.status === 'promoted');
  }

  /**
   * Request a memory promotion. Validates the artifact reference against the
   * actual ProjectStore artifact (ref integrity), then creates a pinned
   * memory-promote approval. The promotion lands only when that approval is
   * decided 'approved' (see decideApproval).
   */
  promoteMemory(id: string, req: { artifact: unknown; scope: unknown; scopeKey: unknown; expectedVersion: unknown }): {
    ok: boolean;
    approval?: EnterpriseApprovalRecord;
    error?: string;
  } {
    try {
      const record = this.loadOrThrow(id);
      assertVersion(record, req.expectedVersion);
      if (!isRecord(req.artifact)) return { ok: false, error: 'artifact must be an ArtifactRef object' };
      const scope = req.scope;
      if (scope !== 'enterprise' && scope !== 'company' && scope !== 'department' && scope !== 'office') {
        return { ok: false, error: 'scope must be enterprise|company|department|office' };
      }
      const scopeKey = assertKey(req.scopeKey, 'scope key');
      const artifact = req.artifact as Partial<ArtifactRef>;
      if (typeof artifact.runId !== 'string' || typeof artifact.nodeKey !== 'string') {
        return { ok: false, error: 'artifact ref must carry a desktop runId (string) and nodeKey' };
      }
      const projectId = this.projectIdForRun(record, artifact.runId);
      if (!projectId) return { ok: false, error: 'no company project owns that runId' };
      // Ref integrity: the pointed-at artifact must actually exist and its
      // content hash must match the ref — memory never promotes ghosts.
      const nodeLookup = this.nodeIdForSeat(record, artifact.nodeKey) ?? artifact.nodeKey;
      const stored = this.projects.readArtifact(projectId, artifact.runId, nodeLookup);
      if (!stored) return { ok: false, error: 'artifact not found in the project store (ref integrity check failed)' };
      if (artifact.contentSha256 !== stored.meta.textSha256) {
        return { ok: false, error: 'artifact content hash mismatch: refusing to promote a stale or forged ref' };
      }
      const run = this.projects.getRun(projectId, artifact.runId);
      const entry: MemoryEntry = MemoryEntrySchema.parse({
        scope,
        scopeKey,
        artifact: {
          artifactId: stored.meta.artifactId,
          runId: artifact.runId,
          nodeKey: artifact.nodeKey,
          attempt: Math.max(1, run?.nodeStates[nodeLookup]?.attempt ?? 1),
          kind: 'markdown',
          title: String(artifact.title ?? artifact.nodeKey).slice(0, 500),
          summary: String(artifact.summary ?? '').slice(0, 2000),
          contentSha256: stored.meta.textSha256,
        },
      });
      const companyKey = Object.entries(record.companies).find(([, c]) => c.projectId === projectId)?.[0] ?? null;
      const { approval, created } = this.getOrCreateApproval(record, 'memory-promote', record.blueprintHash ?? sha256Hex('draft'), {
        entry,
        companyKey,
      });
      if (created) this.save(record);
      return { ok: true, approval: clone(approval) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private applyMemoryPromotion(record: EnterpriseRecord, approval: EnterpriseApprovalRecord): void {
    const payload = approval.payload;
    if (!isRecord(payload) || !isRecord(payload.entry)) return;
    const parsed = MemoryEntrySchema.safeParse(payload.entry);
    if (!parsed.success) return;
    const key = `${parsed.data.scope}:${parsed.data.scopeKey}:${parsed.data.artifact.artifactId}`;
    const existing = record.memory.find(
      (m) => `${m.entry.scope}:${m.entry.scopeKey}:${m.entry.artifact.artifactId}` === key,
    );
    if (existing) {
      existing.status = 'promoted'; // idempotent re-promote
      existing.revokedAt = null;
    } else {
      if (record.memory.length >= MAX_MEMORY_ENTRIES) {
        throw new Error(`memory cap reached (${MAX_MEMORY_ENTRIES} entries)`);
      }
      record.memory.push({ entry: parsed.data, status: 'promoted', promotedAt: nowIso(), revokedAt: null });
    }
    this.appendEvent(record, 'memory-promoted', key);
  }

  /** Revoke a promoted memory entry (direct; the gate is the promote side). */
  revokeMemory(id: string, req: { scope: unknown; scopeKey: unknown; artifactId: unknown; expectedVersion: unknown }): {
    ok: boolean;
    error?: string;
  } {
    try {
      const record = this.loadOrThrow(id);
      assertVersion(record, req.expectedVersion);
      const key = `${String(req.scope ?? '')}:${String(req.scopeKey ?? '')}:${String(req.artifactId ?? '')}`;
      const entry = record.memory.find(
        (m) => `${m.entry.scope}:${m.entry.scopeKey}:${m.entry.artifact.artifactId}` === key,
      );
      if (!entry || entry.status === 'revoked') return { ok: false, error: 'no promoted memory entry with that scope/artifact' };
      entry.status = 'revoked';
      entry.revokedAt = nowIso();
      this.appendEvent(record, 'memory-revoked', key);
      this.save(record);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Bounded case-insensitive search over ref titles/summaries (no bodies). */
  searchMemory(id: string, query: unknown): MemoryRecord[] {
    const q = String(query ?? '').trim().toLowerCase();
    const all = this.listMemory(id);
    if (q.length === 0) return all;
    return all.filter(
      (m) =>
        m.entry.artifact.title.toLowerCase().includes(q) ||
        m.entry.artifact.summary.toLowerCase().includes(q) ||
        m.entry.artifact.nodeKey.toLowerCase().includes(q),
    );
  }

  private projectIdForRun(record: EnterpriseRecord, runId: string): string | null {
    for (const link of Object.values(record.companies)) {
      if (this.projects.getRun(link.projectId, runId)) return link.projectId;
    }
    return null;
  }

  /** Map a seat/contract key to its concrete worker node id, when known. */
  private nodeIdForSeat(record: EnterpriseRecord, key: string): string | null {
    return record.contractWorkers[key]?.nodeId ?? record.departments[key]?.nodeId ?? null;
  }

  // ----------------------------------------------------------------- ledger
  // Append-only token-free work ledger, derived from ACTUAL project runs,
  // events, and artifact metadata. No provider calls, ever.

  private ledgerPath(id: string): string {
    return path.join(this.dir(id), 'ledger.jsonl');
  }

  readLedger(
    id: string,
    filters?: { companyKey?: unknown; workerId?: unknown; departmentKey?: unknown },
  ): WorkLedgerEntry[] {
    this.loadOrThrow(id); // existence check
    let raw: string;
    try {
      raw = fs.readFileSync(this.ledgerPath(id), 'utf8');
    } catch {
      return [];
    }
    const out: WorkLedgerEntry[] = [];
    for (const line of raw.split('\n')) {
      if (line.trim().length === 0) continue;
      try {
        const parsed = WorkLedgerEntrySchema.safeParse(JSON.parse(line));
        if (parsed.success) out.push(parsed.data);
      } catch {
        // skip corrupt line — ledger reads never throw
      }
    }
    const companyKey = typeof filters?.companyKey === 'string' ? filters.companyKey : null;
    const workerId = typeof filters?.workerId === 'string' ? filters.workerId : null;
    const departmentKey = typeof filters?.departmentKey === 'string' ? filters.departmentKey : null;
    return out.filter(
      (e) =>
        (companyKey === null || e.companyKey === companyKey) &&
        (workerId === null || String(e.workerId ?? '') === workerId) &&
        (departmentKey === null || e.nodeKey === departmentKey || e.officeId === departmentKey),
    );
  }

  private appendLedgerEntries(record: EnterpriseRecord, entries: Array<Omit<WorkLedgerEntry, 'seq' | 'enterpriseId'>>): number {
    let appended = 0;
    for (const draft of entries) {
      if (record.ledgerSeq + 1 > MAX_LEDGER_ENTRIES) break;
      record.ledgerSeq += 1;
      const entry = { ...draft, seq: record.ledgerSeq, enterpriseId: record.programId };
      const parsed = WorkLedgerEntrySchema.safeParse(entry);
      if (!parsed.success) {
        record.ledgerSeq -= 1; // never persist an invalid entry
        continue;
      }
      appendLine(this.ledgerPath(record.id), JSON.stringify(parsed.data));
      appended += 1;
    }
    return appended;
  }

  /**
   * Derive ledger rows for one company's run from the ProjectStore truth
   * (run.json nodeStates + artifact meta). Idempotent: dedupe keys make
   * re-syncs append nothing. Extractive summaries only.
   */
  syncLedgerFromRun(id: string, companyKey: string, runId: string): number {
    const record = this.loadOrThrow(id);
    const link = record.companies[companyKey];
    if (!link) throw new Error(`unknown company "${companyKey}"`);
    const project = this.projects.getProject(link.projectId);
    const run = this.projects.getRun(link.projectId, runId);
    if (!project || !run) throw new Error('unknown run for company');
    const drafts: Array<Omit<WorkLedgerEntry, 'seq' | 'enterpriseId'>> = [];
    const push = (dedupe: string, entry: Omit<WorkLedgerEntry, 'seq' | 'enterpriseId'>): void => {
      if (record.ledgerKeys.includes(dedupe)) return;
      record.ledgerKeys.push(dedupe);
      drafts.push(entry);
    };
    const seatKeyByNodeId = new Map<string, string>();
    for (const [seatKey, loc] of Object.entries(record.contractWorkers)) seatKeyByNodeId.set(loc.nodeId, seatKey);
    for (const [deptKey, loc] of Object.entries(record.departments)) seatKeyByNodeId.set(loc.nodeId, deptKey);

    for (const node of project.nodes) {
      const state = run.nodeStates[node.id];
      if (!state) continue;
      const base = {
        companyKey,
        projectId: project.id,
        officeId: null,
        roomId: (node.roomId ?? null) as WorkLedgerEntry['roomId'],
        workerId: node.id,
        nodeKey: seatKeyByNodeId.get(node.id) ?? null,
        runId: run.id,
        skillRef: node.skillRef ?? null,
      };
      const ask = capUtf8(node.instructions, 1000).text;
      push(`${run.id}:${node.id}:assignment`, {
        ...base,
        ts: Date.parse(run.createdAt),
        attempt: null,
        kind: 'assignment',
        status: 'assigned',
        intendedAsk: ask,
        promptSha256: null,
        returnedSummary: '',
        artifactRef: null,
        usage: null,
      });
      const attempt = Math.max(1, state.attempt ?? 0);
      if (state.status === 'running' && state.startedAt) {
        push(`${run.id}:${node.id}:prompt_started:${attempt}`, {
          ...base,
          ts: Date.parse(state.startedAt),
          attempt,
          kind: 'prompt_started',
          status: 'running',
          intendedAsk: ask,
          promptSha256: null,
          returnedSummary: '',
          artifactRef: null,
          usage: null,
        });
      }
      if (state.status === 'succeeded' || state.status === 'failed') {
        const artifact = this.projects.readArtifact(project.id, run.id, node.id);
        if (artifact) {
          const capped = capUtf8(artifact.text, 2000);
          const summary = capped.truncated ? `${capped.text}\n${truncationMarker(capped)}` : capped.text;
          const ref: ArtifactRef = {
            artifactId: artifact.meta.artifactId,
            runId: run.id,
            nodeKey: seatKeyByNodeId.get(node.id) ?? node.id,
            attempt,
            kind: 'markdown',
            title: node.title,
            summary: capUtf8(summary, 2000).text,
            contentSha256: artifact.meta.textSha256,
          };
          push(`${run.id}:${node.id}:returned:${attempt}`, {
            ...base,
            ts: Date.parse(state.finishedAt ?? run.updatedAt),
            attempt,
            kind: state.status === 'succeeded' ? 'returned' : 'error',
            status: state.status,
            intendedAsk: ask,
            promptSha256: artifact.meta.promptSha256,
            returnedSummary: capUtf8(summary, 2000).text,
            artifactRef: ref,
            usage: {
              inputTokens: artifact.meta.inputTokens,
              outputTokens: artifact.meta.outputTokens,
              costUsdMicros: Math.round(artifact.meta.costUsd * 1_000_000),
            },
          });
        }
        if (state.status === 'failed') {
          push(`${run.id}:${node.id}:error:${attempt}`, {
            ...base,
            ts: Date.parse(state.finishedAt ?? run.updatedAt),
            attempt,
            kind: 'error',
            status: 'failed',
            intendedAsk: ask,
            promptSha256: null,
            returnedSummary: capUtf8(state.error ?? 'node failed', 2000).text,
            artifactRef: null,
            usage: null,
          });
        }
      }
    }
    const appended = this.appendLedgerEntries(record, drafts);
    if (appended > 0) this.appendEvent(record, 'ledger-synced', `${companyKey} run ${runId}: +${appended}`);
    this.save(record);
    return appended;
  }

  /** Timeline index derived from the ledger (system derivation), paged. */
  timelineIndex(id: string, afterIndex = 0, limit = 1000): { entries: ReturnType<typeof deriveTimelineIndex>; nextIndex: number } {
    const timeline = deriveTimelineIndex(this.readLedger(id));
    const start = Math.max(0, Math.min(afterIndex, timeline.length));
    const entries = timeline.slice(start, start + Math.min(Math.max(limit, 1), 5000));
    return { entries, nextIndex: start + entries.length };
  }

  /**
   * Handoff manifests between nodes of each company run: derived from ledger
   * 'returned' entries + the project dependency graph. Reference + hash +
   * bounded extractive summary only — full bodies never cross offices.
   */
  deriveHandoffs(id: string): HandoffManifest[] {
    const record = this.loadOrThrow(id);
    const ledger = this.readLedger(id);
    const manifests: HandoffManifest[] = [];
    for (const [companyKey, link] of Object.entries(record.companies)) {
      const project = this.projects.getProject(link.projectId);
      if (!project) continue;
      const returned = ledger.filter((e) => e.companyKey === companyKey && e.kind === 'returned' && e.artifactRef !== null);
      for (const entry of returned) {
        const sourceNodeId = entry.workerId;
        if (typeof sourceNodeId !== 'string') continue;
        const dependents = project.nodes.filter((n) => n.dependsOn.includes(sourceNodeId));
        for (const dep of dependents) {
          const ref = entry.artifactRef as ArtifactRef;
          const capped = capUtf8(entry.returnedSummary, 2000);
          manifests.push({
            from: { workerId: sourceNodeId, nodeKey: entry.nodeKey, companyKey, departmentKey: null },
            to: { workerId: dep.id, nodeKey: null, companyKey, departmentKey: null },
            summary: capped.text,
            contentSha256: ref.contentSha256,
            truncation: {
              truncated: capped.truncated,
              originalLength: entry.returnedSummary.length,
              keptLength: capped.text.length,
            },
            provenance: { sourceLedgerSeq: entry.seq, sourceArtifactRef: ref, derivedBy: 'system' },
          });
        }
      }
    }
    return manifests;
  }

  /**
   * The ONLY text a cross-office handoff may add to a prompt: bounded
   * title + extractive summary + integrity hash per manifest. Full artifact
   * bodies are never included (no cross-office body leakage).
   */
  handoffPromptSection(manifests: readonly HandoffManifest[], titles?: Map<string, string>): string {
    const lines: string[] = ['--- Cross-office handoff manifests (references only — no artifact bodies) ---'];
    for (const m of manifests.slice(0, 16)) {
      const from = m.from.workerId ?? m.from.nodeKey ?? 'unknown';
      const to = m.to.workerId ?? m.to.nodeKey ?? 'unknown';
      const title = titles?.get(String(from)) ?? String(from);
      lines.push(
        `- ${title} → ${String(to)}: ${m.summary.slice(0, 280)} [sha256 ${m.contentSha256.slice(0, 16)}…` +
          `${m.truncation.truncated ? ` · truncated ${m.truncation.keptLength}/${m.truncation.originalLength}` : ''}]`,
      );
    }
    return lines.join('\n');
  }

  // --------------------------------------------------------------- stewards
  // Deterministic, propose-only derivations. providerCalls: false always.

  deriveStewardRecommendations(id: string): StewardRecommendation[] {
    const record = this.loadOrThrow(id);
    const out: StewardRecommendation[] = [];
    const ledger = this.readLedger(id);

    // budget steward: company usage vs reservation
    if (record.blueprint && record.program) {
      const activeCompanies = record.blueprint.companies.filter((c) => c.kind === 'line');
      const partition = partitionBudget(
        record.program.budget,
        activeCompanies.map((c) => ({ companyKey: c.key, capacityShare: c.capacityShare, active: true })),
      );
      for (const p of partition.partitions) {
        const usedMicros = ledger
          .filter((e) => e.companyKey === p.companyKey && e.usage)
          .reduce((acc, e) => acc + (e.usage?.costUsdMicros ?? 0), 0);
        if (p.reservation.maxCostUsdMicros > 0 && usedMicros > p.reservation.maxCostUsdMicros * 0.8) {
          out.push({
            steward: 'cache-budget-steward',
            kind: 'budget',
            derivedBy: 'system',
            providerCalls: false,
            summary: `Company "${p.companyKey}" used ${usedMicros} of ${p.reservation.maxCostUsdMicros} cost micros (>80% of its reservation). Consider rebalancing capacity shares before the next dispatch.`,
            refs: [],
            ledgerSeq: null,
            actionId: 'worker.capacity',
          });
        }
      }
    }

    // cache steward: identical prompt hashes executed more than once
    const promptCounts = new Map<string, number>();
    for (const e of ledger) {
      if (e.promptSha256) promptCounts.set(e.promptSha256, (promptCounts.get(e.promptSha256) ?? 0) + 1);
    }
    const duplicates = [...promptCounts.entries()].filter(([, n]) => n > 1);
    if (duplicates.length > 0) {
      out.push({
        steward: 'cache-budget-steward',
        kind: 'cache',
        derivedBy: 'system',
        providerCalls: false,
        summary: `${duplicates.length} prompt hash(es) executed more than once; deterministic replays could reuse the persisted artifact instead of a new provider call.`,
        refs: [],
        ledgerSeq: null,
        actionId: null,
      });
    }

    // ledger steward: artifacts not yet promoted to enterprise memory
    const promoted = new Set(record.memory.filter((m) => m.status === 'promoted').map((m) => m.entry.artifact.artifactId));
    const candidates = ledger.filter((e) => e.kind === 'returned' && e.artifactRef && !promoted.has(e.artifactRef.artifactId));
    if (candidates.length > 0) {
      const first = candidates[0] as WorkLedgerEntry;
      out.push({
        steward: 'evidence-ledger-steward',
        kind: 'ledger',
        derivedBy: 'system',
        providerCalls: false,
        summary: `${candidates.length} returned artifact(s) are not promoted to shared memory. Promotion is ref-only and approval-gated.`,
        refs: candidates.slice(0, 16).map((e) => e.artifactRef as ArtifactRef),
        ledgerSeq: first.seq,
        actionId: 'memory.promote',
      });
    }

    // blueprint-ops steward: cross-office handoff availability
    const handoffs = this.deriveHandoffs(id);
    if (handoffs.length > 0) {
      const firstRef = handoffs[0]?.provenance.sourceArtifactRef ?? null;
      out.push({
        steward: 'blueprint-ops',
        kind: 'handoff',
        derivedBy: 'system',
        providerCalls: false,
        summary: `${handoffs.length} handoff manifest(s) derivable from returned artifacts (title + extractive summary + sha only; bodies stay in the artifact store).`,
        refs: handoffs.slice(0, 16).map((h) => h.provenance.sourceArtifactRef).filter((r): r is ArtifactRef => r !== null),
        ledgerSeq: handoffs[0]?.provenance.sourceLedgerSeq ?? null,
        actionId: null,
      });
      void firstRef;
    }
    return out;
  }

  // ----------------------------------------------------------------- caches
  // Content-hash caches with version/event-seq invalidation. Provider
  // responses are NEVER cached here.

  private cacheDir(id: string): string {
    return path.join(this.dir(id), 'cache');
  }

  /**
   * Skill-excerpt cache keyed by the skill content hash, invalidated whenever
   * the enterprise version or event seq moved (any mutation) or the skill
   * body hash changed.
   */
  skillExcerpt(id: string, skillId: string): { text: string; cached: boolean; source: 'cache' | 'registry' } | null {
    const record = this.loadOrThrow(id);
    if (!this.skills) return null;
    const summary = this.skills.registry.list().find((s) => s.id === skillId);
    if (!summary || !summary.verified) return null;
    const file = path.join(this.cacheDir(record.id), `skill-${summary.sha256}.json`);
    try {
      const cached = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        skillId: string;
        text: string;
        version: number;
        eventSeq: number;
      };
      if (cached.skillId === skillId && cached.version === record.version && cached.eventSeq === record.eventSeq) {
        return { text: cached.text, cached: true, source: 'cache' };
      }
    } catch {
      // miss — recompute
    }
    const excerpt = this.skills.registry.excerpt(this.skills.root, skillId);
    if (!excerpt) return null;
    atomicWrite(
      file,
      JSON.stringify({ skillId, text: excerpt.text, version: record.version, eventSeq: record.eventSeq }, null, 2),
    );
    return { text: excerpt.text, cached: false, source: 'registry' };
  }

  /**
   * Blueprint cache: the deterministic generator output for the current
   * generator params, invalidated by version/event-seq movement.
   */
  cachedBlueprint(id: string): { blueprint: EnterpriseBlueprint; blueprintHash: Sha256Hex; cached: boolean } {
    const record = this.loadOrThrow(id);
    const params = this.generatorParams(record);
    const input: GenerateBlueprintInput = {
      preset: record.preset,
      programId: record.programId,
      name: record.name,
      mission: record.mission,
      budget: params.budget,
      availableSkillIds: this.availableSkillIds(),
      maxReplans: params.maxReplans,
      maxConcurrentRuns: params.maxConcurrentRuns,
    };
    const inputHash = sha256Hex(canonicalJson({ input, version: record.version, eventSeq: record.eventSeq }));
    const file = path.join(this.cacheDir(record.id), `blueprint-${sha256Hex(canonicalJson(input))}.json`);
    try {
      const cached = JSON.parse(fs.readFileSync(file, 'utf8')) as { inputHash: string; blueprint: EnterpriseBlueprint; blueprintHash: Sha256Hex };
      if (cached.inputHash === inputHash) {
        return { blueprint: cached.blueprint, blueprintHash: cached.blueprintHash, cached: true };
      }
    } catch {
      // miss
    }
    const blueprint = generateEnterpriseBlueprint(input);
    const hash = hashBlueprint(blueprint);
    atomicWrite(file, JSON.stringify({ inputHash, blueprint, blueprintHash: hash }, null, 2));
    return { blueprint, blueprintHash: hash, cached: false };
  }

  // ---------------------------------------------------------------- exports

  /** Write HANDOFFS.md, timeline-index.json, ledger.json and ledger.md. */
  exportArtifacts(id: string): { ok: boolean; dir?: string; files?: string[]; error?: string } {
    try {
      const record = this.loadOrThrow(id);
      const outDir = path.join(this.dir(record.id), 'exports');
      const ledger = this.readLedger(record.id);
      const timeline = deriveTimelineIndex(ledger);
      const handoffs = this.deriveHandoffs(record.id);

      const handoffsMd = [
        `# ${record.name} — Cross-office handoffs`,
        '',
        'Derived deterministically from the work ledger (references only; artifact bodies stay in the project store).',
        '',
        ...handoffs.map(
          (h, i) =>
            `${i + 1}. **${String(h.from.workerId ?? h.from.nodeKey ?? '?')} → ${String(h.to.workerId ?? h.to.nodeKey ?? '?')}**` +
            ` — sha256 ${h.contentSha256}` +
            `${h.truncation.truncated ? ` (extractive summary truncated ${h.truncation.keptLength}/${h.truncation.originalLength})` : ''}\n\n   ${h.summary}`,
        ),
        '',
      ].join('\n');
      const ledgerMd = [
        `# ${record.name} — Work ledger`,
        '',
        '| seq | ts | company | worker | kind | status | intended ask | sha |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |',
        ...ledger.map(
          (e) =>
            `| ${e.seq} | ${new Date(e.ts).toISOString()} | ${e.companyKey ?? ''} | ${String(e.workerId ?? '')} | ${e.kind} | ${e.status} | ` +
            `${e.intendedAsk.replace(/\|/g, '\\|').slice(0, 120)} | ${e.promptSha256 ? e.promptSha256.slice(0, 12) + '…' : ''} |`,
        ),
        '',
      ].join('\n');

      atomicWrite(path.join(outDir, 'HANDOFFS.md'), handoffsMd);
      atomicWrite(path.join(outDir, 'timeline-index.json'), JSON.stringify(timeline, null, 2));
      atomicWrite(path.join(outDir, 'ledger.json'), JSON.stringify(ledger, null, 2));
      atomicWrite(path.join(outDir, 'ledger.md'), ledgerMd);
      this.appendEvent(record, 'exports-written', outDir);
      this.save(record);
      return { ok: true, dir: outDir, files: ['HANDOFFS.md', 'timeline-index.json', 'ledger.json', 'ledger.md'] };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // -------------------------------------------------------- worker controls

  private companyProject(record: EnterpriseRecord, companyKey: string): Project {
    const link = record.companies[companyKey];
    if (!link) throw new Error(`unknown company "${companyKey}"`);
    const project = this.projects.getProject(link.projectId);
    if (!project) throw new Error(`company "${companyKey}" project is missing`);
    return project;
  }

  /** Reassign a worker's room and/or parent with OCC on BOTH stores. */
  reassignWorker(id: string, req: {
    companyKey: unknown;
    workerId: unknown;
    roomId?: unknown;
    parentId?: unknown;
    expectedVersion: unknown;
  }): { ok: boolean; error?: string } {
    try {
      const record = this.loadOrThrow(id);
      assertVersion(record, req.expectedVersion);
      const companyKey = String(req.companyKey ?? '');
      const project = this.companyProject(record, companyKey);
      const workerId = String(req.workerId ?? '');
      this.projects.reassignNode({
        projectId: project.id,
        nodeId: workerId,
        expectedVersion: project.version,
        ...(req.roomId !== undefined ? { roomId: req.roomId as string | null } : {}),
        ...(req.parentId !== undefined ? { parentId: req.parentId as string | null } : {}),
      });
      this.appendEvent(record, 'worker-reassigned', `${companyKey}/${workerId}`);
      this.save(record);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Adjust a contract's capacity share (OCC, bumps contract revision). */
  adjustWorkerCapacity(id: string, req: { contractKey: unknown; capacityShare: unknown; expectedVersion: unknown }): {
    ok: boolean;
    error?: string;
  } {
    try {
      const record = this.loadOrThrow(id);
      assertVersion(record, req.expectedVersion);
      const key = String(req.contractKey ?? '');
      const contract = record.contracts[key];
      if (!contract) return { ok: false, error: `unknown contract "${key}"` };
      const share = Number(req.capacityShare);
      if (!Number.isFinite(share) || share <= 0 || share > 1) return { ok: false, error: 'capacityShare must be in (0, 1]' };
      contract.capacityShare = share;
      contract.version += 1;
      this.appendEvent(record, 'worker-capacity', `${key} -> ${share}`);
      this.save(record);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Suspend (no new claims, live lease drains) or resume a worker contract. */
  setWorkerSuspended(id: string, req: { contractKey: unknown; suspended: unknown; expectedVersion: unknown }): {
    ok: boolean;
    error?: string;
  } {
    try {
      const record = this.loadOrThrow(id);
      assertVersion(record, req.expectedVersion);
      const key = String(req.contractKey ?? '');
      const contract = record.contracts[key];
      if (!contract) return { ok: false, error: `unknown contract "${key}"` };
      if (req.suspended === true) {
        if (contract.status !== 'active') return { ok: false, error: `contract "${key}" is ${contract.status}; only active contracts suspend` };
        if (contract.lease && contract.lease.status === 'active' && !this.leaseExpired(contract.lease)) {
          contract.lease.status = 'draining';
        }
        contract.status = 'draining';
      } else {
        if (contract.status !== 'draining') return { ok: false, error: `contract "${key}" is ${contract.status}; only draining contracts resume` };
        if (contract.lease) return { ok: false, error: 'contract still has a live lease; release it before resuming' };
        contract.status = 'active';
      }
      contract.version += 1;
      this.appendEvent(record, req.suspended === true ? 'worker-suspended' : 'worker-resumed', key);
      this.save(record);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Edit a worker's instructions/budget for the NEXT run. Validates through
   * ProjectStore.updateNode with project-level OCC, then records the override.
   */
  editWorker(id: string, req: {
    companyKey: unknown;
    workerId: unknown;
    instructions?: unknown;
    budget?: unknown;
    expectedVersion: unknown;
  }): { ok: boolean; error?: string } {
    try {
      const record = this.loadOrThrow(id);
      assertVersion(record, req.expectedVersion);
      const companyKey = String(req.companyKey ?? '');
      const project = this.companyProject(record, companyKey);
      const workerId = String(req.workerId ?? '');
      this.projects.updateNode({
        projectId: project.id,
        expectedVersion: project.version,
        nodeId: workerId,
        ...(req.instructions !== undefined ? { instructions: String(req.instructions) } : {}),
        ...(req.budget !== undefined ? { budget: req.budget } : {}),
      });
      const key = `${companyKey}/${workerId}`;
      const override: WorkerOverride = record.workerOverrides[key] ?? {};
      if (req.instructions !== undefined) override.instructions = String(req.instructions).slice(0, 4000);
      if (req.budget !== undefined && isRecord(req.budget)) override.budget = req.budget as Partial<BudgetLimits>;
      record.workerOverrides[key] = override;
      this.appendEvent(record, 'worker-edited', key);
      this.save(record);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Program-loop merge path (used by EnterpriseProgramRunner only): loads a
   * fresh record, applies the program-state patch, appends the event, and
   * saves with a version bump. The runner is the single writer for these
   * fields; every commit re-reads so IPC mutations are never clobbered.
   */
  /**
   * Program-loop merge path (used by EnterpriseProgramRunner only): loads a
   * fresh record, applies the program patch, appends the event, and saves
   * with a version bump. Contract/lease state is deliberately NOT patched
   * here — leases change only through acquire/release/rebind, which each
   * load fresh and save atomically, so a stale runner copy can never
   * clobber a live seat.
   */
  mergeProgramState(
    id: string,
    patch: { program: EnterpriseProgram | null; programPaused: boolean },
    event: string,
    detail?: string,
  ): EnterpriseRecord {
    const record = this.loadOrThrow(id);
    record.program = patch.program;
    record.programPaused = patch.programPaused;
    this.appendEvent(record, event, detail);
    return this.save(record);
  }

  /**
   * Rebind a held lease to a new holder (dispatch placeholder -> real runId)
   * without releasing the seat: the fencing token is preserved, so no other
   * run can claim the seat in between.
   */
  rebindLease(id: string, req: { contractKey: unknown; fence: unknown; runId: unknown }): { ok: boolean; error?: string } {
    try {
      const record = this.loadOrThrow(id);
      const key = String(req.contractKey ?? '');
      const contract = record.contracts[key];
      const lease = contract?.lease;
      if (!contract || !lease) return { ok: false, error: `no lease held on "${key}"` };
      if (lease.fence !== req.fence) return { ok: false, error: 'fence mismatch on lease rebind' };
      const runId = String(req.runId ?? '');
      if (runId.length === 0 || runId.length > 128) return { ok: false, error: 'runId must be a non-empty string' };
      lease.runId = runId;
      this.appendEvent(record, 'lease-rebound', `${key} -> run ${runId} fence ${lease.fence}`);
      this.save(record);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // --------------------------------------------------------------- snapshot

  /** Full read model for the renderer: record + derived graph/list parity. */
  snapshot(id: string): {
    record: EnterpriseRecord;
    view: EnterpriseView | null;
    stewards: StewardRecommendation[];
  } {
    const record = this.loadOrThrow(id);
    if (this.expireLeases(record)) this.save(record);
    const fresh = this.loadOrThrow(id);
    const view =
      fresh.blueprint !== null ? deriveEnterpriseView({ blueprint: fresh.blueprint, program: fresh.program }) : null;
    return { record: clone(fresh), view, stewards: this.deriveStewardRecommendations(id) };
  }
}

// ---------------------------------------------------------------------------
// EnterpriseProgramRunner — drives the EXISTING ProjectRunner with a global
// semaphore. Not a second agent runtime: dispatch = ProjectRunner.start on
// the company's own project, with seat leases acquired beforehand.
// ---------------------------------------------------------------------------

export interface ProgramRunnerDeps {
  /** Wall-clock ms; injectable for deterministic tests. */
  now?: () => number;
}

interface DispatchResult {
  ok: boolean;
  dispatched: number;
  error?: string;
}

export class EnterpriseProgramRunner extends EventEmitter {
  private readonly now: () => number;

  constructor(
    private readonly store: EnterpriseStore,
    private readonly runner: ProjectRunner,
    deps: ProgramRunnerDeps = {},
  ) {
    super();
    this.now = deps.now ?? Date.now;
    // Reattach to runs orphaned by a previous process: programs whose
    // company runs went 'interrupted' are recovered (never re-dispatched).
    this.runner.on('run', (run: ProjectRun) => this.onRunEvent(run));
    this.recoverInterrupted();
  }

  private emitChange(enterpriseId: string): void {
    const record = this.store.get(enterpriseId);
    if (record) this.emit('enterprise', clone(record));
  }

  private companyKeyForProject(record: EnterpriseRecord, projectId: string): string | null {
    for (const [key, link] of Object.entries(record.companies)) {
      if (link.projectId === projectId) return key;
    }
    return null;
  }

  private enterprisesWithActivePrograms(): EnterpriseRecord[] {
    const out: EnterpriseRecord[] = [];
    for (const summary of this.store.list()) {
      const record = this.store.get(summary.id);
      if (record?.program && PROGRAM_ACTIVE_STATES.has(record.program.state)) out.push(record);
    }
    return out;
  }

  /**
   * Crash recovery / reattach. A company run whose runId was recorded is
   * NEVER re-dispatched: 'interrupted' runs are recovered in place via
   * ProjectRunner.recover; live runs are simply reattached through the
   * runner's event stream. No duplicate runs, no double seat booking
   * (leases are checked against the persisted record).
   */
  recoverInterrupted(): void {
    for (const record of this.enterprisesWithActivePrograms()) {
      const program = record.program;
      if (!program) continue;
      let changed = false;
      for (const cr of program.companyRuns) {
        if (cr.status !== 'running' || cr.runId === null) continue;
        const link = record.companies[cr.companyKey];
        const run = link ? this.storeProjectRun(link.projectId, String(cr.runId)) : null;
        if (!run) {
          cr.status = 'failed';
          this.releaseLeasesForRun(record, String(cr.runId));
          changed = true;
          continue;
        }
        if (run.status === 'interrupted') {
          const recovered = this.runner.recover(run.id);
          if (!recovered.ok) {
            cr.status = 'failed';
            this.releaseLeasesForRun(record, run.id);
          }
          changed = true;
        } else if (TERMINAL_RUN_STATUSES.has(run.status)) {
          this.settleCompanyRun(record, cr.companyKey, run);
          changed = true;
        }
        // 'running'/'paused'/'waiting-approval': live in this process via the
        // runner's controls — nothing to do, no re-dispatch.
      }
      if (changed) this.commit(record, 'program-recovered');
    }
  }

  private storeProjectRun(projectId: string, runId: string): ProjectRun | null {
    return this.runner.getRun(projectId, runId);
  }

  /** Persist program-loop mutations through the store's merge path. */
  private commit(record: EnterpriseRecord, event: string, detail?: string): void {
    this.store.mergeProgramState(record.id, { program: record.program, programPaused: record.programPaused }, event, detail);
    this.emitChange(record.id);
  }

  /**
   * Release every seat held by a run. Goes through the store's fenced
   * release (fresh load + atomic save per seat) so leases are never
   * clobbered by a stale working copy.
   */
  private releaseLeasesForRun(record: EnterpriseRecord, runId: string): void {
    // Read the freshest contract state: the working copy may be stale.
    const fresh = this.store.get(record.id);
    for (const [key, contract] of Object.entries(fresh?.contracts ?? {})) {
      const lease = contract.lease;
      if (lease && lease.runId === runId) {
        this.store.releaseLease(record.id, { contractKey: key, runId: lease.runId, fence: lease.fence });
      }
      // keep the working copy consistent for downstream reads this tick
      if (record.contracts[key]) record.contracts[key]!.lease = null;
    }
  }

  /** Contracts a company run must hold seats for (active + staffed only). */
  private requiredContracts(record: EnterpriseRecord, companyKey: string): string[] {
    const bp = record.blueprint;
    if (!bp) return [];
    return bp.contracts
      .filter((w) => w.companyKey === companyKey)
      .map((w) => w.key)
      .filter((key) => {
        const rt = record.contracts[key];
        return rt !== undefined && rt.status === 'active' && rt.staffed;
      });
  }

  private runBudgetFor(reservation: { maxTokens: number; maxMinutes: number; maxCostUsdMicros: number }): BudgetLimits {
    return {
      maxTokens: Math.max(1, reservation.maxTokens),
      maxMinutes: Math.max(0.001, reservation.maxMinutes),
      maxUsd: Math.max(0.000001, reservation.maxCostUsdMicros / 1_000_000),
    };
  }

  /**
   * Start the program: requires the plan approval for the CURRENT program
   * version to be approved, then partitions the budget envelope and begins
   * semaphore-bounded dispatch.
   */
  start(enterpriseId: string, expectedVersion: unknown): { ok: boolean; error?: string } {
    const record = this.store.get(enterpriseId);
    if (!record) return { ok: false, error: 'unknown enterprise id' };
    if (!record.blueprint || !record.program) return { ok: false, error: 'apply a blueprint before starting the program' };
    const program = record.program;
    if (program.state !== 'awaiting_plan_approval') {
      return { ok: false, error: `program is "${program.state}"; only awaiting_plan_approval programs can start` };
    }
    if (record.version !== expectedVersion) {
      return { ok: false, error: `version conflict: enterprise is at version ${record.version}, you sent ${String(expectedVersion)}` };
    }
    const approval = record.approvals.find(
      (a) => a.kind === 'plan' && a.blueprintHash === program.blueprintHash && a.status === 'approved',
    );
    if (!approval) return { ok: false, error: 'program start requires an approved plan approval for the current blueprint' };
    // The approval payload must pin THIS program version + blueprint hash.
    const payload = approval.payload as { programVersion?: unknown } | null;
    if (!isRecord(payload) || payload.programVersion !== program.version) {
      return { ok: false, error: 'plan approval pins a different program version; re-approve the current plan' };
    }

    // Partition the envelope across active line companies (shared function;
    // allocations provably sum <= envelope in every dimension).
    const bp = record.blueprint;
    const requests = bp.companies
      .filter((c) => c.kind === 'line')
      .map((c) => {
        const active = this.requiredContracts(record, c.key).length > 0;
        return { companyKey: c.key, capacityShare: c.capacityShare, active };
      });
    const partition = partitionBudget(program.budget, requests);
    for (const cr of program.companyRuns) {
      const p = partition.partitions.find((x) => x.companyKey === cr.companyKey);
      if (!p || !p.active) {
        cr.status = 'stopped'; // zero reservation: honestly inactive
        cr.runId = null;
      } else if (cr.status !== 'running') {
        cr.status = 'pending';
        cr.runId = null;
      }
    }
    program.state = 'dispatching';
    program.version += 1;
    record.programPaused = false;
    this.commit(record, 'program-started', `semaphore ${this.semaphore(program)}`);
    this.pump(enterpriseId);
    return { ok: true };
  }

  private semaphore(program: EnterpriseProgram): number {
    return Math.min(Math.max(1, program.maxConcurrentRuns || DEFAULT_CONCURRENCY), MAX_CONCURRENCY);
  }

  /**
   * Dispatch step: while the semaphore has capacity and pending companies
   * remain, acquire seat leases for the company's active contracts and start
   * its run on the existing ProjectRunner. The runId is recorded in the
   * enterprise record BEFORE the async execution loop can progress
   * (ProjectRunner.start persists + returns synchronously).
   */
  pump(enterpriseId: string): DispatchResult {
    const record = this.store.get(enterpriseId);
    if (!record?.program) return { ok: false, dispatched: 0, error: 'no program' };
    const program = record.program;
    if (!PROGRAM_ACTIVE_STATES.has(program.state)) return { ok: true, dispatched: 0 };
    if (record.programPaused) return { ok: true, dispatched: 0 };
    const bp = record.blueprint;
    if (!bp) return { ok: false, dispatched: 0, error: 'no blueprint' };

    const runningCount = program.companyRuns.filter((cr) => cr.status === 'running').length;
    let capacity = this.semaphore(program) - runningCount;
    let dispatched = 0;
    const partition = partitionBudget(
      program.budget,
      bp.companies
        .filter((c) => c.kind === 'line')
        .map((c) => ({ companyKey: c.key, capacityShare: c.capacityShare, active: this.requiredContracts(record, c.key).length > 0 })),
    );

    for (const cr of program.companyRuns) {
      if (capacity <= 0) break;
      if (cr.status !== 'pending' || cr.runId !== null) continue; // never re-dispatch a recorded runId
      const link = record.companies[cr.companyKey];
      if (!link) {
        cr.status = 'failed';
        continue;
      }
      // Seat leases BEFORE the dependent run.
      const required = this.requiredContracts(record, cr.companyKey);
      const acquired: string[] = [];
      let blocked = false;
      for (const key of required) {
        const lease = this.store.acquireLease(enterpriseId, { contractKey: key, runId: `pending:${cr.companyKey}` });
        if (!lease.ok) {
          blocked = true;
          break;
        }
        acquired.push(key);
      }
      if (blocked) {
        // Roll back partial acquisitions; the company stays pending.
        for (const key of acquired) {
          const lease = this.store.get(enterpriseId)?.contracts[key]?.lease;
          if (lease) this.store.releaseLease(enterpriseId, { contractKey: key, runId: lease.runId, fence: lease.fence });
        }
        this.commit(record, 'dispatch-blocked', `${cr.companyKey}: seat lease unavailable`);
        continue;
      }
      const reservation = partition.partitions.find((p) => p.companyKey === cr.companyKey)?.reservation;
      if (!reservation) {
        cr.status = 'failed';
        continue;
      }
      const started = this.runner.start(link.projectId, this.runBudgetFor(reservation), record.priceRates);
      if (!started.ok || !started.runId) {
        for (const key of acquired) {
          const lease = this.store.get(enterpriseId)?.contracts[key]?.lease;
          if (lease) this.store.releaseLease(enterpriseId, { contractKey: key, runId: lease.runId, fence: lease.fence });
        }
        cr.status = 'failed';
        this.commit(record, 'dispatch-failed', `${cr.companyKey}: ${started.error ?? 'start failed'}`);
        continue;
      }
      // runId recorded before dispatch progresses; rebind leases to the run
      // (fence preserved — the seat never becomes claimable in between).
      cr.runId = started.runId;
      cr.status = 'running';
      for (const key of acquired) {
        const freshLease = this.store.get(enterpriseId)?.contracts[key]?.lease;
        if (freshLease) {
          this.store.rebindLease(enterpriseId, { contractKey: key, fence: freshLease.fence, runId: started.runId });
        }
      }
      dispatched += 1;
      capacity -= 1;
      this.commit(record, 'company-run-dispatched', `${cr.companyKey} -> ${started.runId}`);
    }
    if (program.state === 'dispatching') {
      program.state = 'running';
      this.commit(record, 'program-running');
    }
    this.reconcile(record);
    return { ok: true, dispatched };
  }

  /** Settle a finished company run and release its seats. */
  private settleCompanyRun(record: EnterpriseRecord, companyKey: string, run: ProjectRun): void {
    const program = record.program;
    if (!program) return;
    const cr = program.companyRuns.find((x) => x.companyKey === companyKey);
    if (!cr || cr.runId !== run.id) return;
    cr.status =
      run.status === 'completed'
        ? 'completed'
        : run.status === 'cancelled'
          ? 'stopped'
          : run.status === 'terminated'
            ? 'stopped'
            : 'failed';
    this.releaseLeasesForRun(record, run.id);
    try {
      this.store.syncLedgerFromRun(record.id, companyKey, run.id);
    } catch {
      // ledger sync failures never block the program loop
    }
  }

  private onRunEvent(run: ProjectRun): void {
    if (!TERMINAL_RUN_STATUSES.has(run.status)) return;
    for (const record of this.enterprisesWithActivePrograms()) {
      const companyKey = this.companyKeyForProject(record, run.projectId);
      if (!companyKey) continue;
      const cr = record.program?.companyRuns.find((x) => x.companyKey === companyKey && x.runId === run.id);
      if (!cr || cr.status !== 'running') continue;
      this.settleCompanyRun(record, companyKey, run);
      this.commit(record, 'company-run-settled', `${companyKey}: ${run.status}`);
      this.reconcile(record);
      if (!record.programPaused) this.pump(record.id);
    }
  }

  /** Compute the terminal program state once no company runs remain active. */
  private reconcile(record: EnterpriseRecord): void {
    const program = record.program;
    if (!program || !PROGRAM_ACTIVE_STATES.has(program.state)) return;
    const anyRunning = program.companyRuns.some((cr) => cr.status === 'running');
    const anyPending = program.companyRuns.some((cr) => cr.status === 'pending');
    if (anyRunning || (anyPending && !record.programPaused)) return;
    if (anyPending && record.programPaused) return;
    program.state = 'reconciling';
    const runs = program.companyRuns;
    const anyFailed = runs.some((cr) => cr.status === 'failed');
    const allStopped = runs.every((cr) => cr.status === 'stopped');
    let finalState: EnterpriseProgram['state'];
    if (anyFailed) finalState = 'failed';
    else if (allStopped && runs.some((cr) => cr.runId !== null)) {
      // Distinguish budget stops from human stops via run records.
      const budgetStopped = runs.some((cr) => {
        if (cr.runId === null) return false;
        const link = record.companies[cr.companyKey];
        const run = link ? this.storeProjectRun(link.projectId, String(cr.runId)) : null;
        return run?.status === 'terminated';
      });
      finalState = budgetStopped ? 'stopped_budget' : 'stopped_human';
    } else if (allStopped) finalState = 'stopped_human';
    else finalState = 'completed';
    program.state = finalState;
    program.version += 1;
    this.commit(record, 'program-finished', finalState);
  }

  pause(enterpriseId: string): { ok: boolean; error?: string } {
    const record = this.store.get(enterpriseId);
    if (!record?.program) return { ok: false, error: 'no program' };
    if (!PROGRAM_ACTIVE_STATES.has(record.program.state)) return { ok: false, error: `program is "${record.program.state}"` };
    record.programPaused = true;
    for (const cr of record.program.companyRuns) {
      if (cr.status === 'running' && cr.runId !== null) this.runner.pause(String(cr.runId));
    }
    this.commit(record, 'program-paused');
    return { ok: true };
  }

  resume(enterpriseId: string): { ok: boolean; error?: string } {
    const record = this.store.get(enterpriseId);
    if (!record?.program) return { ok: false, error: 'no program' };
    if (!record.programPaused) return { ok: false, error: 'program is not paused' };
    record.programPaused = false;
    for (const cr of record.program.companyRuns) {
      if (cr.status === 'running' && cr.runId !== null) this.runner.resume(String(cr.runId));
    }
    this.commit(record, 'program-resumed');
    this.pump(enterpriseId);
    return { ok: true };
  }

  /** Cancel: stop all company runs; the program settles as stopped_human. */
  cancel(enterpriseId: string): { ok: boolean; error?: string } {
    const record = this.store.get(enterpriseId);
    if (!record?.program) return { ok: false, error: 'no program' };
    if (!PROGRAM_ACTIVE_STATES.has(record.program.state)) return { ok: false, error: `program is "${record.program.state}"` };
    for (const cr of record.program.companyRuns) {
      if (cr.status === 'running' && cr.runId !== null) this.runner.cancel(String(cr.runId));
      if (cr.status === 'pending') cr.status = 'stopped';
    }
    record.programPaused = false;
    this.commit(record, 'program-cancelled');
    // If nothing was running, reconcile immediately (cancel events settle
    // the rest asynchronously through the runner event stream).
    this.reconcile(record);
    return { ok: true };
  }

  /** Stop = graceful alias of cancel for the UI (drain then settle). */
  stop(enterpriseId: string): { ok: boolean; error?: string } {
    return this.cancel(enterpriseId);
  }

  getProgram(enterpriseId: string): EnterpriseProgram | null {
    return this.store.get(enterpriseId)?.program ?? null;
  }
}
