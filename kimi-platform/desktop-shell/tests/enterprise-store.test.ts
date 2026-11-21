import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProjectStore, ProjectRunner, type GenerateFn } from '../src/main/projects';
import { EnterpriseStore, EnterpriseProgramRunner } from '../src/main/enterprises';
import { SkillRegistry } from '../src/main/skills';
import { deriveEnterpriseView, generateEnterpriseBlueprint, blueprintHash } from '../src/shared/enterprise';
import type { GenerateBlueprintInput } from '../src/shared/enterprise';

const SKILLS_ROOT = path.join(__dirname, '..', 'resources', 'skills');

const BUDGET = { maxTokens: 100_000, maxCalls: 50, maxMinutes: 60, maxCostUsdMicros: 5_000_000 };
const CREATE_REQ = {
  preset: 'creative_technology_group',
  programId: 'ctg-001',
  name: 'Creative Tech Group',
  mission: 'Build and publish creative technology products.',
  budget: BUDGET,
  maxConcurrentRuns: 2,
  provider: 'openai',
  model: 'test-model',
  priceRates: { inputUsdPerMillion: 1, outputUsdPerMillion: 2 },
};

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ent-store-test-'));
}

async function waitFor(cond: () => boolean, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

interface World {
  dir: string;
  projects: ProjectStore;
  ents: EnterpriseStore;
  generateCalls: number;
  makeRunner: (generate?: GenerateFn) => { runner: ProjectRunner; programs: EnterpriseProgramRunner };
}

function makeWorld(now?: () => number, withSkills = true): World {
  const dir = tmpdir();
  const projects = new ProjectStore(dir);
  const ents = new EnterpriseStore(dir, {
    projects,
    skills: withSkills ? { registry: new SkillRegistry(SKILLS_ROOT), root: SKILLS_ROOT } : null,
    ...(now ? { now } : {}),
  });
  const world: World = {
    dir,
    projects,
    ents,
    generateCalls: 0,
    makeRunner: (generate?: GenerateFn) => {
      const gen: GenerateFn =
        generate ??
        (async () => {
          world.generateCalls += 1;
          return { text: 'deliverable body: alpha findings and sources.', inputTokens: 10, outputTokens: 20 };
        });
      const runner = new ProjectRunner(projects, gen);
      const programs = new EnterpriseProgramRunner(ents, runner, now ? { now } : {});
      return { runner, programs };
    },
  };
  return world;
}

function cleanup(world: World): void {
  fs.rmSync(world.dir, { recursive: true, force: true });
}

/** Verified skill ids from the REAL bundled registry (source of truth). */
function verifiedSkillIds(): string[] {
  return new SkillRegistry(SKILLS_ROOT).list().filter((s) => s.verified).map((s) => s.id);
}

/** The blueprint the generator produces for the test registry right now. */
function expectedBlueprint() {
  return generateEnterpriseBlueprint({
    preset: 'creative_technology_group',
    programId: CREATE_REQ.programId,
    name: CREATE_REQ.name,
    mission: CREATE_REQ.mission,
    budget: CREATE_REQ.budget,
    availableSkillIds: verifiedSkillIds(),
    maxReplans: 2,
    maxConcurrentRuns: CREATE_REQ.maxConcurrentRuns,
  });
}

/** Line companies with at least one staffed contract under the current registry. */
function activeLineCompanies(): string[] {
  const bp = expectedBlueprint();
  return bp.companies
    .filter((c) => c.kind === 'line' && bp.contracts.some((w) => w.companyKey === c.key && w.staffed))
    .map((c) => c.key)
    .sort();
}

/** create -> preview -> approve blueprint -> apply -> approve plan. */
function materialize(world: World): { id: string; version: number } {
  const { record } = world.ents.create(CREATE_REQ);
  const id = record.id;
  const preview = world.ents.previewBlueprint({ enterpriseId: id, expectedVersion: record.version });
  expect(preview.blueprint.companies).toHaveLength(5);
  expect(preview.blueprint.departments).toHaveLength(7);
  const decided = world.ents.decideApproval({
    enterpriseId: id,
    approvalId: preview.approval.id,
    decision: 'approved',
    payloadHash: preview.payloadHash,
  });
  expect(decided.ok).toBe(true);
  const postDecide = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
  const applied = world.ents.applyBlueprint({
    enterpriseId: id,
    blueprintHash: preview.blueprintHash,
    payloadHash: preview.payloadHash,
    expectedVersion: postDecide.version,
    confirmed: true,
  });
  expect(applied.ok).toBe(true);
  const after = world.ents.get(id);
  expect(after).not.toBeNull();
  return { id, version: (after as NonNullable<typeof after>).version };
}

function approveAllContracts(world: World, id: string): void {
  for (const c of world.ents.listContracts(id)) {
    if (c.status !== 'proposed') continue;
    const rec = world.ents.get(id);
    world.ents.decideContract(id, { contractKey: c.key, decision: 'approved', expectedVersion: (rec as NonNullable<typeof rec>).version });
  }
}

function approvePlan(world: World, id: string): void {
  const rec = world.ents.get(id);
  const plan = (rec as NonNullable<typeof rec>).approvals.find((a) => a.kind === 'plan');
  expect(plan).toBeDefined();
  const res = world.ents.decideApproval({
    enterpriseId: id,
    approvalId: (plan as NonNullable<typeof plan>).id,
    decision: 'approved',
    payloadHash: (plan as NonNullable<typeof plan>).payloadHash,
  });
  expect(res.ok).toBe(true);
}

describe('EnterpriseStore persistence + blueprint materialization', () => {
  let world: World;
  beforeEach(() => {
    world = makeWorld();
  });
  afterEach(() => cleanup(world));

  it('create is idempotent per programId and OCC-guards updates', () => {
    const first = world.ents.create(CREATE_REQ);
    expect(first.created).toBe(true);
    const again = world.ents.create(CREATE_REQ);
    expect(again.created).toBe(false);
    expect(again.record.id).toBe(first.record.id);

    const renamed = world.ents.update({ id: first.record.id, expectedVersion: first.record.version, name: 'Renamed' });
    expect(renamed.name).toBe('Renamed');
    expect(() => world.ents.update({ id: first.record.id, expectedVersion: 999, name: 'x' })).toThrow(/version conflict/);
    expect(() => world.ents.create({ ...CREATE_REQ, programId: 'Bad Id' })).toThrow(/kebab/);
  });

  it('previews deterministically and requires confirmed+approved+pinned apply', () => {
    const { record } = world.ents.create(CREATE_REQ);
    const p1 = world.ents.previewBlueprint({ enterpriseId: record.id, expectedVersion: record.version });
    const rec2 = world.ents.get(record.id);
    const p2 = world.ents.previewBlueprint({
      enterpriseId: record.id,
      expectedVersion: (rec2 as NonNullable<typeof rec2>).version,
    });
    expect(p1.blueprintHash).toBe(p2.blueprintHash);
    expect(p1.payloadHash).toBe(p2.payloadHash);
    expect(p1.approval.id).toBe(p2.approval.id); // get-or-create, exactly one

    // pins: confirmed, approval, hash, version
    const badConfirm = world.ents.applyBlueprint({
      enterpriseId: record.id,
      blueprintHash: p1.blueprintHash,
      payloadHash: p1.payloadHash,
      expectedVersion: p1.expectedVersion,
      confirmed: false,
    });
    expect(badConfirm.ok).toBe(false);
    expect(badConfirm.error).toMatch(/confirmation/);

    const unapproved = world.ents.applyBlueprint({
      enterpriseId: record.id,
      blueprintHash: p1.blueprintHash,
      payloadHash: p1.payloadHash,
      expectedVersion: p1.expectedVersion,
      confirmed: true,
    });
    expect(unapproved.ok).toBe(false);
    expect(unapproved.error).toMatch(/pending/);

    const decided = world.ents.decideApproval({
      enterpriseId: record.id,
      approvalId: p1.approval.id,
      decision: 'approved',
      payloadHash: p1.payloadHash,
    });
    expect(decided.ok).toBe(true);
    // exactly-once decision
    const twice = world.ents.decideApproval({
      enterpriseId: record.id,
      approvalId: p1.approval.id,
      decision: 'approved',
      payloadHash: p1.payloadHash,
    });
    expect(twice.ok).toBe(false);
    expect(twice.error).toMatch(/exactly-once/);
    // payload-hash pinning
    const p3 = world.ents.previewBlueprint({
      enterpriseId: record.id,
      expectedVersion: (world.ents.get(record.id) as NonNullable<ReturnType<typeof world.ents.get>>).version,
    });
    const forged = world.ents.decideApproval({
      enterpriseId: record.id,
      approvalId: p3.approval.id,
      decision: 'approved',
      payloadHash: 'f'.repeat(64),
    });
    expect(forged.ok).toBe(false);
    expect(forged.error).toMatch(/payload hash mismatch/);
  });

  it('materializes 5 company projects + 7 departments + 9 seats, idempotently, with no secrets', () => {
    const { id } = materialize(world);
    const rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    expect(rec.state).toBe('materialized');
    expect(Object.keys(rec.companies)).toHaveLength(5);
    expect(Object.keys(rec.departments)).toHaveLength(7);
    expect(Object.keys(rec.contractWorkers)).toHaveLength(9);
    expect(Object.keys(rec.contracts)).toHaveLength(9);
    expect(rec.program?.state).toBe('awaiting_plan_approval');

    // 1:1 companies are real office projects owned by ProjectStore
    for (const link of Object.values(rec.companies)) {
      const project = world.projects.getProject(link.projectId);
      expect(project).not.toBeNull();
      expect(project?.template).toBe('office');
    }
    // departments + seats live in the shared-services project (owner path)
    const sharedProjectId = rec.companies['shared-services']?.projectId;
    expect(sharedProjectId).toBeDefined();
    for (const loc of Object.values(rec.departments)) expect(loc.projectId).toBe(sharedProjectId);
    for (const loc of Object.values(rec.contractWorkers)) expect(loc.projectId).toBe(sharedProjectId);

    // Staffing parity with the REAL registry: a seat is staffed exactly when
    // its pinned pack is present + sha-verified (creative packs included once
    // they land); otherwise honestly unstaffed with no skillRef attached.
    const expected = expectedBlueprint();
    const shared = world.projects.getProject(sharedProjectId as string);
    for (const w of expected.contracts) {
      const runtime = rec.contracts[w.key];
      expect(runtime?.status).toBe('proposed');
      expect(runtime?.staffed).toBe(w.staffed);
      const node = shared?.nodes.find((n) => n.id === rec.contractWorkers[w.key]?.nodeId);
      expect(node?.skillRef ?? null).toBe(w.staffed ? w.skillPin.skillId : null);
      if (!w.staffed) expect(node?.instructions).toContain('unstaffed');
    }
    // Creative seats specifically track their packs (civilization-art-design /
    // music-theory-production): staffed iff the registry verifies the pack.
    const verified = verifiedSkillIds();
    expect(rec.contracts['music--svc-music-production']?.staffed).toBe(verified.includes('music-theory-production-engineering'));
    expect(rec.contracts['civilization-design--svc-design']?.staffed).toBe(verified.includes('civilization-art-design-research'));
    expect(rec.contracts['software--svc-backend-engineering']?.staffed).toBe(verified.includes('architecture-database-backend-engineering'));

    // No secrets anywhere under the enterprise dir (defense in depth scan)
    const entDir = path.join(world.dir, 'enterprises', id);
    const all = readAll(entDir);
    expect(all).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(all).not.toMatch(/api[_-]?key/i);

    // Idempotent re-apply: same hash, no new projects, no duplicate nodes
    const before = world.projects.listProjects().length;
    const preview = world.ents.previewBlueprint({ enterpriseId: id, expectedVersion: rec.version });
    world.ents.decideApproval({ enterpriseId: id, approvalId: preview.approval.id, decision: 'approved', payloadHash: preview.payloadHash });
    const recNow = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    const reapplied = world.ents.applyBlueprint({
      enterpriseId: id,
      blueprintHash: preview.blueprintHash,
      payloadHash: preview.payloadHash,
      expectedVersion: recNow.version,
      confirmed: true,
    });
    expect(reapplied.ok).toBe(true);
    expect(world.projects.listProjects().length).toBe(before);
    const sharedAfter = world.projects.getProject(sharedProjectId as string);
    expect(sharedAfter?.nodes.length).toBe(shared?.nodes.length);
  });

  it('honest fallback: with no skill registry every seat is unstaffed and nothing runs', () => {
    const bare = makeWorld(undefined, false); // skills: null (missing/tampered packs)
    try {
      const { record } = bare.ents.create(CREATE_REQ);
      const preview = bare.ents.previewBlueprint({ enterpriseId: record.id, expectedVersion: record.version });
      // every contract honestly unstaffed; the blueprint itself still derives
      expect(preview.blueprint.contracts.every((w) => !w.staffed)).toBe(true);
      bare.ents.decideApproval({ enterpriseId: record.id, approvalId: preview.approval.id, decision: 'approved', payloadHash: preview.payloadHash });
      const fresh = bare.ents.get(record.id) as NonNullable<ReturnType<typeof bare.ents.get>>;
      const applied = bare.ents.applyBlueprint({
        enterpriseId: record.id,
        blueprintHash: preview.blueprintHash,
        payloadHash: preview.payloadHash,
        expectedVersion: fresh.version,
        confirmed: true,
      });
      expect(applied.ok).toBe(true);
      const rec = bare.ents.get(record.id) as NonNullable<ReturnType<typeof bare.ents.get>>;
      expect(Object.values(rec.contracts).every((c) => !c.staffed)).toBe(true);
      // seats exist but carry NO skillRef and say so in their instructions
      const sharedProject = bare.projects.getProject(rec.companies['shared-services']?.projectId as string);
      for (const loc of Object.values(rec.contractWorkers)) {
        const node = sharedProject?.nodes.find((n) => n.id === loc.nodeId);
        expect(node?.skillRef ?? null).toBeNull();
        expect(node?.instructions).toContain('unstaffed');
      }
      // program start is permitted after plan approval, but every company is
      // inactive (zero reservation): no runs, no provider calls, honest stop.
      const plan = rec.approvals.find((a) => a.kind === 'plan') as NonNullable<typeof rec.approvals[number]>;
      bare.ents.decideApproval({ enterpriseId: record.id, approvalId: plan.id, decision: 'approved', payloadHash: plan.payloadHash });
      let calls = 0;
      const runner = new ProjectRunner(bare.projects, async () => {
        calls += 1;
        return { text: 'x', inputTokens: 1, outputTokens: 1 };
      });
      const programs = new EnterpriseProgramRunner(bare.ents, runner);
      const rec2 = bare.ents.get(record.id) as NonNullable<ReturnType<typeof bare.ents.get>>;
      expect(programs.start(record.id, rec2.version).ok).toBe(true);
      expect(bare.projects.listRuns()).toHaveLength(0);
      expect(calls).toBe(0);
      expect(programs.getProgram(record.id)?.state).toBe('stopped_human');
    } finally {
      cleanup(bare);
    }
  });

  it('snapshot graph derives list parity via the shared derive function', () => {
    const { id } = materialize(world);
    const snapshot = world.ents.snapshot(id);
    expect(snapshot.view).not.toBeNull();
    const view = snapshot.view as NonNullable<typeof snapshot.view>;
    const direct = deriveEnterpriseView({ blueprint: snapshot.record.blueprint, program: snapshot.record.program });
    expect(JSON.stringify(view)).toBe(JSON.stringify(direct));
    // 5 companies + 7 departments + 9 contracts in both graph and lists
    expect(view.lists.companies).toHaveLength(5);
    expect(view.lists.departments).toHaveLength(7);
    expect(view.lists.contracts).toHaveLength(9);
    // graph/list parity by construction: node keys == list row keys
    const companyNodes = view.graph.nodes.filter((n) => n.kind === 'company').map((n) => n.key);
    expect(companyNodes.sort()).toEqual(view.lists.companies.map((c) => c.key).sort());
    const deptNodes = view.graph.nodes.filter((n) => n.kind === 'department').map((n) => n.key);
    expect(deptNodes.sort()).toEqual(view.lists.departments.map((d) => d.key).sort());
  });

  it('appends and pages enterprise events without mutation', () => {
    const { id } = materialize(world);
    const page1 = world.ents.readEvents(id, 0, 3);
    expect(page1.events.length).toBe(3);
    expect(page1.nextIndex).toBe(3);
    const page2 = world.ents.readEvents(id, 3, 100);
    expect(page2.events.length).toBeGreaterThan(0);
    const seqs = [...page1.events, ...page2.events].map((e) => e.seq);
    expect(new Set(seqs).size).toBe(seqs.length); // append-only, unique seqs
  });
});

function readAll(dir: string): string {
  let out = '';
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out += readAll(p);
    else out += fs.readFileSync(p, 'utf8');
  }
  return out;
}

describe('contracts and capacity leases', () => {
  let world: World;
  let id: string;
  beforeEach(() => {
    world = makeWorld();
    id = materialize(world).id;
    approveAllContracts(world, id);
  });
  afterEach(() => cleanup(world));

  it('decides proposed contracts exactly once and activates seats', () => {
    const contracts = world.ents.listContracts(id);
    expect(contracts.every((c) => c.status === 'active')).toBe(true);
    const rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    expect(() =>
      world.ents.decideContract(id, { contractKey: contracts[0]?.key, decision: 'approved', expectedVersion: rec.version }),
    ).toThrow(/only proposed/);
  });

  it('refuses seat double-booking, fences leases, drains on release', () => {
    const key = 'software--svc-backend-engineering';
    const first = world.ents.acquireLease(id, { contractKey: key, runId: 'run-a' });
    expect(first.ok).toBe(true);
    expect(first.lease?.fence).toBe(1);
    // idempotent re-acquire by the same run
    const same = world.ents.acquireLease(id, { contractKey: key, runId: 'run-a' });
    expect(same.ok).toBe(true);
    expect(same.lease?.fence).toBe(1);
    // double-booking refused for a different run
    const conflict = world.ents.acquireLease(id, { contractKey: key, runId: 'run-b' });
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toMatch(/double-booking/);
    // wrong fence cannot release
    const badRelease = world.ents.releaseLease(id, { contractKey: key, runId: 'run-a', fence: 99 });
    expect(badRelease.ok).toBe(false);
    expect(badRelease.error).toMatch(/fence mismatch/);
    // correct fence releases; next lease takes the next fencing token
    expect(world.ents.releaseLease(id, { contractKey: key, runId: 'run-a', fence: 1 }).ok).toBe(true);
    const second = world.ents.acquireLease(id, { contractKey: key, runId: 'run-b' });
    expect(second.ok).toBe(true);
    expect(second.lease?.fence).toBe(2);

    // releaseContract with a live lease drains instead of dropping the seat
    const rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    world.ents.releaseContract(id, { contractKey: key, expectedVersion: rec.version });
    let after = world.ents.listContracts(id).find((c) => c.key === key);
    expect(after?.status).toBe('draining');
    expect(after?.lease?.status).toBe('draining');
    // no new leases while draining
    expect(world.ents.acquireLease(id, { contractKey: key, runId: 'run-c' }).ok).toBe(false);
    // drain completes when the lease is released
    expect(world.ents.releaseLease(id, { contractKey: key, runId: 'run-b', fence: 2 }).ok).toBe(true);
    after = world.ents.listContracts(id).find((c) => c.key === key);
    expect(after?.status).toBe('released');
  });

  it('expires leases at TTL and frees the seat', () => {
    let clock = 1_000_000;
    const timed = makeWorld(() => clock);
    try {
      const tid = materialize(timed).id;
      approveAllContracts(timed, tid);
      const key = 'software--svc-backend-engineering';
      expect(timed.ents.acquireLease(tid, { contractKey: key, runId: 'run-a', ttlMs: 1000 }).ok).toBe(true);
      clock += 2000; // past TTL
      const reacquire = timed.ents.acquireLease(tid, { contractKey: key, runId: 'run-b' });
      expect(reacquire.ok).toBe(true);
      expect(reacquire.lease?.fence).toBe(2);
    } finally {
      cleanup(timed);
    }
  });
});

describe('EnterpriseProgramRunner orchestration', () => {
  let world: World;
  let id: string;
  beforeEach(() => {
    world = makeWorld();
    id = materialize(world).id;
    approveAllContracts(world, id);
  });
  afterEach(() => cleanup(world));

  function gatedGenerate() {
    const gates: Array<{ resolve: (v: { text: string; inputTokens: number; outputTokens: number }) => void; reject: (e: Error) => void }> = [];
    const generate: GenerateFn = (req) => {
      world.generateCalls += 1;
      return new Promise((resolve, reject) => {
        gates.push({ resolve, reject });
        req.abortSignal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    };
    const releaseAll = (): void => {
      while (gates.length > 0) gates.shift()?.resolve({ text: 'deliverable body: alpha findings.', inputTokens: 10, outputTokens: 20 });
    };
    // Office runs execute nodes sequentially: keep resolving new gates until
    // cond() holds (bounded), so sequential node calls never deadlock the test.
    const drainUntil = async (cond: () => boolean, rounds = 400): Promise<void> => {
      for (let i = 0; i < rounds && !cond(); i++) {
        releaseAll();
        await new Promise((r) => setTimeout(r, 20));
      }
    };
    return { generate, releaseAll, drainUntil, pending: () => gates.length };
  }

  it('requires an approved plan and partitions budgets within the envelope', () => {
    const { generate } = gatedGenerate();
    const { programs } = world.makeRunner(generate);
    const rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    // no plan approval yet
    const denied = programs.start(id, rec.version);
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/plan approval/);
    // OCC on program start
    approvePlan(world, id);
    const stale = programs.start(id, 1);
    expect(stale.ok).toBe(false);
    expect(stale.error).toMatch(/version conflict/);

    const fresh = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    const started = programs.start(id, fresh.version);
    expect(started.ok).toBe(true);
    const program = programs.getProgram(id);
    expect(program).not.toBeNull();
    // Companies with staffed contracts under the CURRENT registry are active
    // (creative packs flip music/design seats active the moment they verify).
    const active = activeLineCompanies();
    expect(active).toEqual(expect.arrayContaining(['software', 'ai-cyber', 'civilization-design']));
    const byKey = new Map((program as NonNullable<typeof program>).companyRuns.map((cr) => [cr.companyKey, cr]));
    for (const cr of (program as NonNullable<typeof program>).companyRuns) {
      if (!active.includes(cr.companyKey)) {
        expect(cr.status).toBe('stopped'); // honestly inactive, zero reservation
        expect(cr.runId).toBeNull();
      }
    }
    // semaphore default 2 (maxConcurrentRuns=2): at most 2 dispatched at once
    const running = [...byKey.values()].filter((cr) => cr.status === 'running');
    expect(running).toHaveLength(Math.min(2, active.length));
    const pending = [...byKey.values()].filter((cr) => cr.status === 'pending');
    expect(pending).toHaveLength(Math.max(0, active.length - 2));

    // per-company run budgets are partitioned within the envelope
    let sumUsd = 0;
    for (const cr of running) {
      const project = world.ents.get(id)?.companies[cr.companyKey]?.projectId;
      const run = world.projects.listRuns(project as string).find((r) => r.id === cr.runId);
      expect(run).toBeDefined();
      sumUsd += (run as NonNullable<typeof run>).runBudget.maxUsd;
    }
    expect(sumUsd).toBeLessThanOrEqual(BUDGET.maxCostUsdMicros / 1e6 + 1e-9);
  });

  it('records the runId in the enterprise record BEFORE the first provider call resolves', async () => {
    const seen: boolean[] = [];
    const generate: GenerateFn = async () => {
      world.generateCalls += 1;
      const rec = world.ents.get(id);
      // at the moment the provider is called, the dispatching company run
      // must already carry a persisted runId (no orphaned executions)
      seen.push(
        rec !== null && rec.program !== null && rec.program.companyRuns.some((cr) => cr.status === 'running' && cr.runId !== null),
      );
      return { text: 'ok', inputTokens: 5, outputTokens: 5 };
    };
    const { programs } = world.makeRunner(generate);
    approvePlan(world, id);
    const rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    expect(programs.start(id, rec.version).ok).toBe(true);
    await waitFor(() => world.generateCalls > 0);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(Boolean)).toBe(true);
  });

  it('acquires seat leases before dependent runs and releases them on settle', async () => {
    const { generate, drainUntil } = gatedGenerate();
    const { programs } = world.makeRunner(generate);
    approvePlan(world, id);
    const rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    expect(programs.start(id, rec.version).ok).toBe(true);
    await waitFor(() => world.generateCalls >= 2);
    // active leases match the running company runs
    const contracts = world.ents.listContracts(id);
    const leased = contracts.filter((c) => c.lease !== null);
    expect(leased.length).toBeGreaterThan(0);
    const program = programs.getProgram(id);
    const runIds = new Set((program as NonNullable<typeof program>).companyRuns.filter((cr) => cr.runId).map((cr) => String(cr.runId)));
    for (const c of leased) expect(runIds.has(String(c.lease?.runId))).toBe(true);
    // a second holder cannot book a leased seat (no double booking mid-run)
    const one = leased[0];
    expect(world.ents.acquireLease(id, { contractKey: (one as NonNullable<typeof one>).key, runId: 'intruder' }).ok).toBe(false);

    // finish everything; leases drain to null and the program completes
    await drainUntil(() => programs.getProgram(id)?.state === 'completed');
    expect(programs.getProgram(id)?.state).toBe('completed');
    const after = world.ents.listContracts(id);
    expect(after.every((c) => c.lease === null)).toBe(true);
    const finalProgram = programs.getProgram(id);
    expect((finalProgram as NonNullable<typeof finalProgram>).companyRuns.filter((cr) => cr.status === 'completed')).toHaveLength(
      activeLineCompanies().length,
    );
  }, 20000);

  it('pauses, resumes, and cancels via the existing ProjectRunner controls', async () => {
    const { generate, releaseAll, drainUntil } = gatedGenerate();
    const { runner, programs } = world.makeRunner(generate);
    approvePlan(world, id);
    const rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    expect(programs.start(id, rec.version).ok).toBe(true);
    await waitFor(() => world.generateCalls >= 1);

    expect(programs.pause(id).ok).toBe(true);
    const pausedRun = world.projects.listRuns().find((r) => r.status === 'paused');
    expect(pausedRun).toBeDefined();
    expect(programs.getProgram(id)?.state).toBe('running'); // state machine has no 'paused'; flag does
    expect(world.ents.get(id)?.programPaused).toBe(true);

    expect(programs.resume(id).ok).toBe(true);
    await waitFor(() => world.projects.listRuns().some((r) => r.status === 'running'));
    expect(world.ents.get(id)?.programPaused).toBe(false);

    expect(programs.cancel(id).ok).toBe(true);
    releaseAll(); // let aborted generate settle
    await drainUntil(() => programs.getProgram(id)?.state === 'stopped_human');
    expect(programs.getProgram(id)?.state).toBe('stopped_human');
    void runner;
  }, 20000);

  it('recovers interrupted runs after a crash without duplicate dispatch or double seat booking', async () => {
    const first = gatedGenerate();
    const world1 = world.makeRunner(first.generate);
    approvePlan(world, id);
    const rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    expect(world1.programs.start(id, rec.version).ok).toBe(true);
    await waitFor(() => world.generateCalls >= 2);
    const before = world.projects.listRuns().length;
    const beforeRunIds = (programs2RunIds(world.ents.get(id)?.program.companyRuns ?? []) as string[]).sort();
    const leasesBefore = world.ents.listContracts(id).filter((c) => c.lease !== null).length;
    expect(leasesBefore).toBeGreaterThan(0);

    // simulate a process crash: a NEW runner over the same store reconciles
    // orphans to 'interrupted'; a NEW program runner must reattach/recover.
    const second = gatedGenerate();
    const world2 = world.makeRunner(second.generate);
    void world2; // constructor recovers
    await waitFor(() => second.pending() > 0 || world.projects.listRuns().some((r) => r.status === 'running'));
    expect(world.projects.listRuns().length).toBe(before); // NO duplicate runs
    const afterProgram = programs2RunIds(world.ents.get(id)?.program.companyRuns ?? []).sort();
    expect(afterProgram).toEqual(beforeRunIds); // same runIds reattached
    // seats stayed booked to the same runs (fencing intact)
    const leasedAfter = world.ents.listContracts(id).filter((c) => c.lease !== null);
    expect(leasedAfter.length).toBe(leasesBefore);
    for (const c of leasedAfter) expect(beforeRunIds).toContain(String(c.lease?.runId));

    // let recovery finish; program still completes with no new dispatches
    await second.drainUntil(() => world.ents.get(id)?.program?.state === 'completed');
    expect(world.ents.get(id)?.program?.state).toBe('completed');
    // exactly one run per ACTIVE company, no duplicates, ever
    expect(world.projects.listRuns().length).toBe(activeLineCompanies().length);
  }, 25000);
});

function programs2RunIds(companyRuns: Array<{ runId: string | null }>): Array<string | null> {
  return companyRuns.filter((cr) => cr.runId !== null).map((cr) => cr.runId);
}

describe('ledger, handoffs, memory, stewards, caches, exports (token-free)', () => {
  let world: World;
  let id: string;
  beforeEach(async () => {
    world = makeWorld();
    id = materialize(world).id;
    approveAllContracts(world, id);
    approvePlan(world, id);
    const { programs } = world.makeRunner();
    const rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    expect(programs.start(id, rec.version).ok).toBe(true);
    await waitFor(() => programs.getProgram(id)?.state === 'completed', 20000);
  }, 30000);
  afterEach(() => cleanup(world));

  it('derives an exact bullet ledger: ask, prompt hash, extractive summary, usage; filters work', () => {
    const ledger = world.ents.readLedger(id);
    expect(ledger.length).toBeGreaterThan(0);
    const returned = ledger.filter((e) => e.kind === 'returned');
    expect(returned.length).toBeGreaterThan(0);
    for (const e of returned) {
      expect(e.promptSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(e.returnedSummary.length).toBeGreaterThan(0);
      expect(e.returnedSummary.length).toBeLessThanOrEqual(2100);
      // extractive: the summary is a span copied from the artifact itself
      expect(e.returnedSummary).toContain('deliverable body');
      // exact usage: 10 in @ $1/M + 20 out @ $2/M = $0.00005 = 50 micros
      expect(e.usage?.costUsdMicros).toBe(50);
      expect(e.usage?.inputTokens).toBe(10);
      expect(e.usage?.outputTokens).toBe(20);
      expect(e.artifactRef?.contentSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(e.seq).toBeGreaterThan(0);
    }
    // assignments carry the intended ask (the persisted node instructions)
    const assignments = ledger.filter((e) => e.kind === 'assignment');
    expect(assignments.length).toBeGreaterThan(0);
    for (const e of assignments) expect(e.intendedAsk.length).toBeGreaterThan(0);

    // filters: by company and by worker
    const software = world.ents.readLedger(id, { companyKey: 'software' });
    expect(software.length).toBeGreaterThan(0);
    expect(software.every((e) => e.companyKey === 'software')).toBe(true);
    const workerId = software[0]?.workerId;
    const byWorker = world.ents.readLedger(id, { workerId: String(workerId) });
    expect(byWorker.every((e) => String(e.workerId) === String(workerId))).toBe(true);

    // idempotent re-sync appends nothing
    const count = ledger.length;
    const runs = world.projects.listRuns();
    for (const run of runs) {
      const rec = world.ents.get(id);
      const companyKey = Object.entries(rec?.companies ?? {}).find(([, c]) => c.projectId === run.projectId)?.[0];
      if (companyKey) world.ents.syncLedgerFromRun(id, companyKey, run.id);
    }
    expect(world.ents.readLedger(id).length).toBe(count);
  });

  it('runs every derivation with ZERO provider calls', () => {
    const before = world.generateCalls;
    world.ents.readLedger(id);
    world.ents.timelineIndex(id);
    world.ents.deriveHandoffs(id);
    world.ents.deriveStewardRecommendations(id);
    world.ents.skillExcerpt(id, 'mathematics-research');
    world.ents.cachedBlueprint(id);
    world.ents.exportArtifacts(id);
    expect(world.generateCalls).toBe(before);
  });

  it('builds handoff manifests; prompt sections carry title+summary+sha only, never bodies', () => {
    const handoffs = world.ents.deriveHandoffs(id);
    expect(handoffs.length).toBeGreaterThan(0);
    for (const h of handoffs) {
      expect(h.contentSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(h.summary.length).toBeLessThanOrEqual(2100);
      expect(h.provenance.derivedBy).toBe('system');
    }
    const section = world.ents.handoffPromptSection(handoffs);
    expect(section).toContain('sha256');
    // The section must not contain full artifact bodies: every included
    // summary is capped at 280 chars per manifest line.
    for (const line of section.split('\n').slice(1)) {
      expect(line.length).toBeLessThan(400);
    }
  });

  it('gates memory promotion on approval, enforces ref integrity, supports revoke+search', () => {
    const returned = world.ents.readLedger(id).find((e) => e.kind === 'returned' && e.artifactRef);
    expect(returned).toBeDefined();
    const ref = (returned as NonNullable<typeof returned>).artifactRef;
    const rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;

    // forged hash: refused
    const forged = world.ents.promoteMemory(id, {
      artifact: { ...(ref as object), contentSha256: '0'.repeat(64) },
      scope: 'enterprise',
      scopeKey: 'ctg-001',
      expectedVersion: rec.version,
    });
    expect(forged.ok).toBe(false);
    expect(forged.error).toMatch(/hash mismatch/);

    // real ref: creates a PENDING approval; nothing promoted yet
    const rec2 = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    const promoted = world.ents.promoteMemory(id, {
      artifact: ref,
      scope: 'enterprise',
      scopeKey: 'ctg-001',
      expectedVersion: rec2.version,
    });
    expect(promoted.ok).toBe(true);
    expect(world.ents.listMemory(id)).toHaveLength(0);

    const approved = world.ents.decideApproval({
      enterpriseId: id,
      approvalId: (promoted.approval as NonNullable<typeof promoted.approval>).id,
      decision: 'approved',
      payloadHash: (promoted.approval as NonNullable<typeof promoted.approval>).payloadHash,
    });
    expect(approved.ok).toBe(true);
    const memory = world.ents.listMemory(id);
    expect(memory).toHaveLength(1);
    // ref-only: the entry stores title + bounded summary + hashes, no body field
    const entry = memory[0];
    expect(JSON.stringify(entry)).not.toContain('deliverable body: alpha findings and sources.'.repeat(2));

    // search over titles/summaries
    expect(world.ents.searchMemory(id, 'deliverable').length).toBe(1);
    expect(world.ents.searchMemory(id, 'no-such-term')).toHaveLength(0);

    // revoke
    const rec3 = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    const revoked = world.ents.revokeMemory(id, {
      scope: 'enterprise',
      scopeKey: 'ctg-001',
      artifactId: entry?.entry.artifact.artifactId,
      expectedVersion: rec3.version,
    });
    expect(revoked.ok).toBe(true);
    expect(world.ents.listMemory(id)).toHaveLength(0);
    expect(world.ents.listMemory(id, { includeRevoked: true })).toHaveLength(1);
  });

  it('steward recommendations are deterministic metadata with providerCalls:false', () => {
    const recs = world.ents.deriveStewardRecommendations(id);
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.providerCalls).toBe(false);
      expect(r.derivedBy).toBe('system');
    }
    // returned artifacts not yet promoted -> ledger steward speaks
    expect(recs.some((r) => r.kind === 'ledger')).toBe(true);
    // deterministic: identical call, identical output
    expect(JSON.stringify(world.ents.deriveStewardRecommendations(id))).toBe(JSON.stringify(recs));
  });

  it('caches skill excerpts + blueprints by content hash and invalidates on version/event movement', () => {
    // blueprint cache: deterministic generator output for the CURRENT params
    const bp1 = world.ents.cachedBlueprint(id);
    const bp2 = world.ents.cachedBlueprint(id);
    expect(bp1.cached).toBe(false);
    expect(bp2.cached).toBe(true);
    expect(bp1.blueprintHash).toBe(bp2.blueprintHash);
    expect(bp1.blueprintHash).toBe(world.ents.get(id)?.blueprintHash);

    const first = world.ents.skillExcerpt(id, 'mathematics-research');
    expect(first?.source).toBe('registry');
    expect(first?.cached).toBe(false);
    const second = world.ents.skillExcerpt(id, 'mathematics-research');
    expect(second?.cached).toBe(true);
    expect(second?.text).toBe(first?.text);

    // any enterprise mutation bumps version + eventSeq -> caches invalidated
    const rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    world.ents.update({ id, expectedVersion: rec.version, mission: 'Cache-busting mission change.' });
    const third = world.ents.skillExcerpt(id, 'mathematics-research');
    expect(third?.cached).toBe(false);
    expect(world.ents.cachedBlueprint(id).cached).toBe(false);
  });

  it('exports HANDOFFS.md, timeline-index.json and ledger JSON/Markdown', () => {
    const out = world.ents.exportArtifacts(id);
    expect(out.ok).toBe(true);
    for (const file of out.files ?? []) {
      expect(fs.existsSync(path.join(out.dir as string, file))).toBe(true);
    }
    const timeline = JSON.parse(fs.readFileSync(path.join(out.dir as string, 'timeline-index.json'), 'utf8')) as unknown[];
    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline.length).toBeGreaterThan(0);
    const ledgerJson = JSON.parse(fs.readFileSync(path.join(out.dir as string, 'ledger.json'), 'utf8')) as unknown[];
    expect(ledgerJson.length).toBe(world.ents.readLedger(id).length);
    const handoffsMd = fs.readFileSync(path.join(out.dir as string, 'HANDOFFS.md'), 'utf8');
    expect(handoffsMd).toContain('handoff');
  });

  it('per-employee controls: reassign/capacity/suspend/resume/edit with OCC', () => {
    let rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    const softwareProject = rec.companies['software']?.projectId as string;
    const project = world.projects.getProject(softwareProject);
    const worker = project?.nodes.find((n) => n.kind === 'worker');
    expect(worker).toBeDefined();

    // reassign with OCC
    const moved = world.ents.reassignWorker(id, {
      companyKey: 'software',
      workerId: (worker as NonNullable<typeof worker>).id,
      roomId: 'engineering',
      expectedVersion: rec.version,
    });
    expect(moved.ok).toBe(true);
    const after = world.projects.getProject(softwareProject);
    expect(after?.nodes.find((n) => n.id === (worker as NonNullable<typeof worker>).id)?.roomId).toBe('engineering');
    // stale enterprise version is refused
    const stale = world.ents.reassignWorker(id, {
      companyKey: 'software',
      workerId: (worker as NonNullable<typeof worker>).id,
      roomId: 'qa',
      expectedVersion: rec.version,
    });
    expect(stale.ok).toBe(false);
    expect(stale.error).toMatch(/version conflict/);

    // capacity adjust + contract revision bump
    rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    const key = 'software--svc-backend-engineering';
    const beforeRev = rec.contracts[key]?.version;
    expect(world.ents.adjustWorkerCapacity(id, { contractKey: key, capacityShare: 0.5, expectedVersion: rec.version }).ok).toBe(true);
    rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    expect(rec.contracts[key]?.capacityShare).toBe(0.5);
    expect(rec.contracts[key]?.version).toBe((beforeRev as number) + 1);

    // suspend/resume
    expect(world.ents.setWorkerSuspended(id, { contractKey: key, suspended: true, expectedVersion: rec.version }).ok).toBe(true);
    let contract = world.ents.listContracts(id).find((c) => c.key === key);
    expect(contract?.status).toBe('draining');
    rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    expect(world.ents.setWorkerSuspended(id, { contractKey: key, suspended: false, expectedVersion: rec.version }).ok).toBe(true);
    contract = world.ents.listContracts(id).find((c) => c.key === key);
    expect(contract?.status).toBe('active');

    // instruction/budget edit lands on the project node for the next run
    rec = world.ents.get(id) as NonNullable<ReturnType<typeof world.ents.get>>;
    const edited = world.ents.editWorker(id, {
      companyKey: 'software',
      workerId: (worker as NonNullable<typeof worker>).id,
      instructions: 'Produce a shorter, sharper deliverable next run.',
      budget: { maxTokens: 12345 },
      expectedVersion: rec.version,
    });
    expect(edited.ok).toBe(true);
    const editedProject = world.projects.getProject(softwareProject);
    const editedNode = editedProject?.nodes.find((n) => n.id === (worker as NonNullable<typeof worker>).id);
    expect(editedNode?.instructions).toBe('Produce a shorter, sharper deliverable next run.');
    expect(editedNode?.budget.maxTokens).toBe(12345);
  });
});
