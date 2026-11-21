import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  canonicalJson,
  computeHirePreview,
  hashPayload,
  SkillRegistry,
  validateHirePlan,
  MAX_SKILL_EXCERPT_CHARS,
} from '../src/main/skills';
import { decideHireApproval, requestHireApproval } from '../src/main/hiring';
import { ProjectStore } from '../src/main/projects';

const SKILLS_ROOT = path.join(__dirname, '..', 'resources', 'skills');

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'skills-test-'));
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

describe('skill registry', () => {
  it('loads exactly the 21 bundled atlas skills, all hash-verified', () => {
    const registry = new SkillRegistry(SKILLS_ROOT);
    const skills = registry.list();
    expect(skills).toHaveLength(21);
    const ids = skills.map((s) => s.id);
    // The required new packages are present.
    expect(ids).toContain('ai-research-frontier');
    expect(ids).toContain('ui-ux-research-design-engineering');
    expect(ids).toContain('architecture-and-built-heritage-research');
    expect(ids).toContain('architecture-database-backend-engineering');
    expect(ids).toContain('civilization-art-design-research');
    expect(ids).toContain('music-theory-production-engineering');
    expect(ids).toContain('executive-operations-assistant');
    for (const skill of skills) {
      expect(skill.verified).toBe(true);
      expect(skill.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(skill.path).toBe(`${skill.id}/SKILL.md`);
      expect(skill.keywords.length).toBeGreaterThan(0);
      expect(skill.role.length).toBeGreaterThan(0);
      expect(skill.description.length).toBeGreaterThan(0);
    }
    // Deterministic ordering.
    expect(ids).toEqual([...ids].sort());
  });

  it('serves bounded, provenance-stamped excerpts with truncation metadata', () => {
    const registry = new SkillRegistry(SKILLS_ROOT);
    const excerpt = registry.excerpt(SKILLS_ROOT, 'ai-research-frontier', 500);
    expect(excerpt).not.toBeNull();
    expect(excerpt?.text).toContain('skill: ai-research-frontier');
    expect(excerpt?.text).toContain(`sha256: ${excerpt?.skill.sha256}`);
    expect(excerpt?.truncated).toBe(true);
    expect(excerpt?.text).toContain('[truncated: showing 500 of');
    expect(excerpt?.keptLength).toBeLessThanOrEqual(500);
    // Full-size excerpts are hard-bounded by MAX_SKILL_EXCERPT_CHARS.
    const full = registry.excerpt(SKILLS_ROOT, 'ai-research-frontier', 1_000_000);
    expect(full?.keptLength ?? 0).toBeLessThanOrEqual(MAX_SKILL_EXCERPT_CHARS);
  });

  it('marks tampered SKILL.md bodies unverified and refuses to excerpt them', () => {
    const dir = tmpdir();
    try {
      copyDir(SKILLS_ROOT, dir);
      fs.appendFileSync(path.join(dir, 'biology-research', 'SKILL.md'), '\ntampered\n', 'utf8');
      const registry = new SkillRegistry(dir);
      const tampered = registry.get('biology-research');
      expect(tampered?.verified).toBe(false);
      expect(registry.excerpt(dir, 'biology-research')).toBeNull();
      // Other skills are unaffected.
      expect(registry.get('physics-research')?.verified).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects corrupt catalogs loudly', () => {
    const dir = tmpdir();
    try {
      fs.writeFileSync(path.join(dir, 'skills.catalog.json'), '{"skills": [{"id": "BAD ID"}]}', 'utf8');
      expect(() => new SkillRegistry(dir)).toThrow(/invalid id/);
      fs.writeFileSync(path.join(dir, 'skills.catalog.json'), 'not json', 'utf8');
      expect(() => new SkillRegistry(dir)).toThrow(/cannot load skills catalog/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('canonicalJson/hashPayload are key-order independent', () => {
    const a = { x: 1, y: [2, { b: 'c', a: 'd' }] };
    const b = { y: [2, { a: 'd', b: 'c' }], x: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(hashPayload(a)).toBe(hashPayload(b));
    expect(hashPayload(a)).not.toBe(hashPayload({ x: 1, y: [2, { a: 'd', b: 'e' }] }));
  });
});

describe('hire preview and plan validation', () => {
  let dir: string;
  let store: ProjectStore;
  let registry: SkillRegistry;
  beforeEach(() => {
    dir = tmpdir();
    store = new ProjectStore(dir);
    registry = new SkillRegistry(SKILLS_ROOT);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  function makeOfficeProject(goal = 'Design an accessible UI for a research dashboard') {
    return store.createProject({ name: 'Office', goal, provider: 'openai', model: 'm', template: 'office' });
  }

  it('is deterministic and never hires the root director', () => {
    const project = makeOfficeProject();
    const a = computeHirePreview(project, registry);
    const b = computeHirePreview(project, registry);
    expect(a).toEqual(b);
    expect(a.planHash).toMatch(/^[0-9a-f]{64}$/);
    const director = project.nodes.find((n) => n.kind === 'director');
    expect(a.assignments.some((x) => x.nodeId === director?.id)).toBe(false);
    // The UI-flavored goal matches the ui-ux skill somewhere.
    expect(a.assignments.some((x) => x.skillId === 'ui-ux-research-design-engineering')).toBe(true);
    for (const assignment of a.assignments) {
      expect(assignment.score).toBeGreaterThan(0);
      expect(assignment.skillSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('validates manual plans: duplicates, unknown ids, root director, bounds', () => {
    const project = makeOfficeProject();
    const worker = project.nodes.find((n) => n.kind === 'worker')?.id as string;
    const director = project.nodes.find((n) => n.kind === 'director')?.id as string;
    expect(() => validateHirePlan(project, registry, [{ nodeId: worker, skillId: 'nope' }])).toThrow(/unknown skill/);
    expect(() => validateHirePlan(project, registry, [{ nodeId: 'node-99', skillId: 'biology-research' }])).toThrow(/unknown node/);
    expect(() =>
      validateHirePlan(project, registry, [
        { nodeId: worker, skillId: 'biology-research' },
        { nodeId: worker, skillId: 'physics-research' },
      ]),
    ).toThrow(/duplicate/);
    expect(() => validateHirePlan(project, registry, [{ nodeId: director, skillId: 'biology-research' }])).toThrow(/not hirable/);
    expect(() => validateHirePlan(project, registry, [])).toThrow(/non-empty/);
    const ok = validateHirePlan(project, registry, [{ nodeId: worker, skillId: 'biology-research' }]);
    expect(ok).toEqual([{ nodeId: worker, skillId: 'biology-research', skillSha256: registry.get('biology-research')?.sha256 }]);
  });

  it('runs the full approval-gated hire flow with exact-payload hashing', () => {
    const project = makeOfficeProject();
    const preview = computeHirePreview(project, registry);
    expect(preview.assignments.length).toBeGreaterThan(0);
    const assignments = preview.assignments.map((a) => ({ nodeId: a.nodeId, skillId: a.skillId }));

    // Explicit confirmation is mandatory.
    const refused = requestHireApproval(store, registry, { projectId: project.id, expectedVersion: project.version, assignments, confirmed: false });
    expect(refused.ok).toBe(false);
    // OCC is enforced.
    const stale = requestHireApproval(store, registry, { projectId: project.id, expectedVersion: 99, assignments, confirmed: true });
    expect(stale.ok).toBe(false);
    expect(stale.error).toMatch(/version conflict/);

    const requested = requestHireApproval(store, registry, { projectId: project.id, expectedVersion: project.version, assignments, confirmed: true });
    expect(requested.ok).toBe(true);
    const approval = requested.approval;
    expect(approval?.kind).toBe('hire');
    expect(approval?.status).toBe('pending');
    expect(approval?.payloadHash).toMatch(/^[0-9a-f]{64}$/);

    // Requesting the identical plan returns the SAME keyed record (no dupes).
    const again = requestHireApproval(store, registry, { projectId: project.id, expectedVersion: project.version, assignments, confirmed: true });
    expect(again.approval?.id).toBe(approval?.id);
    expect(store.listApprovals(project.id).filter((a) => a.kind === 'hire')).toHaveLength(1);

    // Wrong payload hash: refused, still pending.
    const wrongHash = decideHireApproval(store, registry, { projectId: project.id, approvalId: approval?.id as string, decision: 'approved', payloadHash: '0'.repeat(64) });
    expect(wrongHash.ok).toBe(false);
    expect(wrongHash.error).toMatch(/hash mismatch/);

    // Approve the exact payload: applied, version bumped.
    const decided = decideHireApproval(store, registry, { projectId: project.id, approvalId: approval?.id as string, decision: 'approved', payloadHash: approval?.payloadHash as string });
    expect(decided.ok).toBe(true);
    expect(decided.approval?.status).toBe('approved');
    const updated = store.getProject(project.id);
    expect(updated?.version).toBe(project.version + 1);
    for (const assignment of assignments) {
      expect(updated?.nodes.find((n) => n.id === assignment.nodeId)?.skillRef).toBe(assignment.skillId);
    }

    // Exactly once: a second decision fails.
    const second = decideHireApproval(store, registry, { projectId: project.id, approvalId: approval?.id as string, decision: 'rejected', payloadHash: approval?.payloadHash as string });
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/already/);
  });

  it('rejection is terminal and cannot be re-requested for the same payload', () => {
    const project = makeOfficeProject();
    const preview = computeHirePreview(project, registry);
    const assignments = preview.assignments.map((a) => ({ nodeId: a.nodeId, skillId: a.skillId }));
    const requested = requestHireApproval(store, registry, { projectId: project.id, expectedVersion: project.version, assignments, confirmed: true });
    const approval = requested.approval;
    const rejected = decideHireApproval(store, registry, { projectId: project.id, approvalId: approval?.id as string, decision: 'rejected', payloadHash: approval?.payloadHash as string });
    expect(rejected.ok).toBe(true);
    // Re-requesting the identical payload hits the rejected record.
    const rerequest = requestHireApproval(store, registry, { projectId: project.id, expectedVersion: project.version, assignments, confirmed: true });
    expect(rerequest.ok).toBe(false);
    expect(rerequest.error).toMatch(/already rejected/);
    // Approvals survive a store "restart" (fresh instance over same files).
    const store2 = new ProjectStore(dir);
    const persisted = store2.getApproval(project.id, null, approval?.id as string);
    expect(persisted?.status).toBe('rejected');
  });

  it('stale hire plans fail cleanly when the project moved on', () => {
    const project = makeOfficeProject();
    const preview = computeHirePreview(project, registry);
    const assignments = preview.assignments.map((a) => ({ nodeId: a.nodeId, skillId: a.skillId }));
    const requested = requestHireApproval(store, registry, { projectId: project.id, expectedVersion: project.version, assignments, confirmed: true });
    const approval = requested.approval;
    // Project changes after the request (version bump).
    store.updateProject({ projectId: project.id, expectedVersion: project.version, name: 'Renamed' });
    const decided = decideHireApproval(store, registry, { projectId: project.id, approvalId: approval?.id as string, decision: 'approved', payloadHash: approval?.payloadHash as string });
    expect(decided.ok).toBe(false);
    expect(decided.error).toMatch(/changed since/);
    // Still pending: the user can explicitly reject it.
    expect(store.getApproval(project.id, null, approval?.id as string)?.status).toBe('pending');
  });

  it('matches hyphenated catalog keywords with the shared tokenizer (peer-review)', () => {
    // The bundled ai-research-frontier skill declares the keyword
    // "peer-review"; the goal text uses the unhyphenated form.
    const project = store.createProject({
      name: 'Peer review study',
      goal: 'Assess peer review practices for AI venues',
      provider: 'openai',
      model: 'm',
      template: 'office',
    });
    const preview = computeHirePreview(project, registry);
    const frontier = preview.assignments.find((a) => a.skillId === 'ai-research-frontier');
    expect(frontier).toBeDefined();
    expect(frontier?.matchedKeywords).toContain('peer-review');
  });
});
