import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Project, ProjectNode } from '../src/shared/contract';
import { deriveOfficeRooms, deriveOfficeSnapshot, OFFICE_ROOMS } from '../src/shared/office';
import { officeSquad, ProjectStore, validateHierarchy } from '../src/main/projects';

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'office-test-'));
}

function node(partial: Partial<ProjectNode> & { id: string }): ProjectNode {
  return {
    role: 'custom',
    title: partial.id,
    instructions: 'i',
    dependsOn: [],
    status: 'pending',
    budget: { maxTokens: 1, maxMinutes: 1, maxUsd: 1 },
    ...partial,
  };
}

describe('office default hierarchy', () => {
  let dir: string;
  let store: ProjectStore;
  beforeEach(() => {
    dir = tmpdir();
    store = new ProjectStore(dir);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('generates Director -> 3 Sub-Directors -> workers, depth-capped at 2', () => {
    const project = store.createProject({ name: 'Office', goal: 'g', provider: 'openai', model: 'm', template: 'office' });
    expect(project.template).toBe('office');
    expect(project.version).toBe(1);
    expect(project.loopPolicy).toEqual({ maxIterations: 3, noProgressLimit: 1 });
    const root = project.nodes.filter((n) => n.depth === 0);
    expect(root).toHaveLength(1);
    expect(root[0]?.kind).toBe('director');
    const subs = project.nodes.filter((n) => n.depth === 1);
    expect(subs.map((s) => s.kind)).toEqual(['subdirector', 'subdirector', 'subdirector']);
    expect(subs.map((s) => s.title)).toEqual(['Research Director', 'Delivery Director', 'Assurance Director']);
    const workers = project.nodes.filter((n) => n.depth === 2);
    expect(workers.length).toBeGreaterThanOrEqual(3);
    expect(workers.every((w) => w.kind === 'worker')).toBe(true);
    expect(project.nodes.every((n) => (n.depth ?? 0) <= 2)).toBe(true);
    expect(officeSquad().length).toBeLessThanOrEqual(24);
  });

  it('keeps standard projects free of hierarchy fields (legacy behavior)', () => {
    const project = store.createProject({ name: 'Std', goal: 'g', provider: 'openai', model: 'm' });
    expect(project.template).toBe('standard');
    expect(project.loopPolicy).toBeNull();
    expect(project.nodes.every((n) => n.kind === undefined && n.parentId === undefined && n.depth === undefined)).toBe(true);
  });

  it('accepts goal successCriteria and a bounded loopPolicy', () => {
    const project = store.createProject({
      name: 'Office',
      goal: 'g',
      provider: 'openai',
      model: 'm',
      template: 'office',
      successCriteria: ['Criterion A', 'Criterion B'],
      loopPolicy: { maxIterations: 5, noProgressLimit: 2 },
    });
    expect(project.successCriteria).toEqual(['Criterion A', 'Criterion B']);
    expect(project.loopPolicy).toEqual({ maxIterations: 5, noProgressLimit: 2 });
    expect(() =>
      store.createProject({ name: 'x', goal: 'g', provider: 'openai', model: 'm', loopPolicy: { maxIterations: 6, noProgressLimit: 1 } }),
    ).toThrow(/maxIterations/);
    expect(() =>
      store.createProject({ name: 'x', goal: 'g', provider: 'openai', model: 'm', loopPolicy: { maxIterations: 2, noProgressLimit: 0 } }),
    ).toThrow(/noProgressLimit/);
  });
});

describe('hierarchy validation', () => {
  it('enforces exactly one root', () => {
    expect(() => validateHierarchy([node({ id: 'a', parentId: null }), node({ id: 'b', parentId: null })])).toThrow(/exactly one root/);
  });

  it('rejects parent cycles and unknown parents', () => {
    expect(() =>
      validateHierarchy([
        node({ id: 'a', parentId: 'b' }),
        node({ id: 'b', parentId: 'a' }),
      ]),
    ).toThrow(/cycle|exactly one root/);
    expect(() => validateHierarchy([node({ id: 'a', parentId: null }), node({ id: 'b', parentId: 'zz' })])).toThrow(/unknown parent/);
  });

  it('rejects depth beyond MAX_DEPTH 2 and depth/kind inconsistencies', () => {
    expect(() =>
      validateHierarchy([
        node({ id: 'a', parentId: null }),
        node({ id: 'b', parentId: 'a' }),
        node({ id: 'c', parentId: 'b' }),
        node({ id: 'd', parentId: 'c' }),
      ]),
    ).toThrow(/maximum hierarchy depth/);
    expect(() =>
      validateHierarchy([node({ id: 'a', parentId: null, depth: 1 })]),
    ).toThrow(/declares depth 1 but computes to 0/);
    expect(() =>
      validateHierarchy([node({ id: 'a', parentId: null }), node({ id: 'b', parentId: 'a', kind: 'worker' })]),
    ).toThrow(/depth 1 requires subdirector/);
  });

  it('rejects unknown roomIds', () => {
    expect(() => validateHierarchy([node({ id: 'a', parentId: null, roomId: 'dungeon' })])).toThrow(/roomId/);
  });

  it('rejects hierarchies over 24 nodes', () => {
    const nodes: ProjectNode[] = [node({ id: 'node-1', parentId: null })];
    for (let i = 2; i <= 25; i += 1) nodes.push(node({ id: `node-${i}`, parentId: 'node-1' }));
    expect(() => validateHierarchy(nodes)).toThrow(/24-node bound/);
  });
});

describe('office room projection', () => {
  let dir: string;
  let store: ProjectStore;
  beforeEach(() => {
    dir = tmpdir();
    store = new ProjectStore(dir);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  function makeOffice(): Project {
    return store.createProject({ name: 'Office', goal: 'g', provider: 'openai', model: 'm', template: 'office' });
  }

  it('room/list parity: every node appears in exactly one room', () => {
    const project = makeOffice();
    const rooms = deriveOfficeRooms(project);
    const memberIds = rooms.flatMap((r) => r.members.map((m) => m.nodeId));
    expect(memberIds.sort()).toEqual(project.nodes.map((n) => n.id).sort());
    expect(new Set(memberIds).size).toBe(memberIds.length);
    const snapshot = deriveOfficeSnapshot(project, null);
    expect(snapshot.nodeCount).toBe(project.nodes.length);
    expect(snapshot.rooms.reduce((acc, r) => acc + r.members.length, 0)).toBe(project.nodes.length);
    // Executive room exists and holds the Director.
    expect(rooms.find((r) => r.id === 'executive')?.members.map((m) => m.kind)).toEqual(['director']);
  });

  it('derives live member status from the run, not a second source of truth', () => {
    const project = makeOffice();
    const run = {
      id: 'run-1',
      projectId: project.id,
      nodeStates: { 'node-1': { status: 'succeeded' }, 'node-5': { status: 'running' } },
    } as never;
    const rooms = deriveOfficeRooms(project, { run });
    const all = rooms.flatMap((r) => r.members);
    expect(all.find((m) => m.nodeId === 'node-1')?.status).toBe('succeeded');
    expect(all.find((m) => m.nodeId === 'node-5')?.status).toBe('running');
    expect(all.find((m) => m.nodeId === 'node-2')?.status).toBe('pending');
  });

  it('maps skill-backed workers to the skill role room and applies layout overrides', () => {
    const project = makeOffice();
    // Attach a design skill to the delivery worker and clear its explicit room.
    const updated = store.updateProject({
      projectId: project.id,
      expectedVersion: 1,
      office: { roomOrder: ['qa', 'executive', 'research', 'architecture', 'engineering', 'design', 'data', 'operations'], roomLabels: { qa: 'Quality' } },
    });
    const worker = updated.nodes.find((n) => n.title === 'Delivery Specialist') as ProjectNode;
    worker.skillRef = 'ui-ux-research-design-engineering';
    worker.roomId = null;
    const skillRoles = new Map([['ui-ux-research-design-engineering', 'design']]);
    const rooms = deriveOfficeRooms(updated, { skillRoles });
    const member = rooms.flatMap((r) => r.members).find((m) => m.nodeId === worker.id);
    expect(member?.roomId).toBe('design');
    // Layout metadata is honored: qa first, custom label.
    expect(rooms[0]?.id).toBe('qa');
    expect(rooms.find((r) => r.id === 'qa')?.label).toBe('Quality');
  });

  it('standard projects still project into rooms by role (parity holds)', () => {
    const project = store.createProject({ name: 'Std', goal: 'g', provider: 'openai', model: 'm' });
    const rooms = deriveOfficeRooms(project);
    const memberIds = rooms.flatMap((r) => r.members.map((m) => m.nodeId)).sort();
    expect(memberIds).toEqual(project.nodes.map((n) => n.id).sort());
    expect(rooms.find((r) => r.id === 'executive')?.members).toHaveLength(1);
    expect(rooms.find((r) => r.id === 'qa')?.members[0]?.role).toBe('review');
  });
});

describe('validated updates and reassignment (OCC)', () => {
  let dir: string;
  let store: ProjectStore;
  beforeEach(() => {
    dir = tmpdir();
    store = new ProjectStore(dir);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('updateProject enforces optimistic concurrency and validation before save', () => {
    const project = store.createProject({ name: 'Office', goal: 'g', provider: 'openai', model: 'm', template: 'office' });
    expect(() => store.updateProject({ projectId: project.id, expectedVersion: 7, name: 'x' })).toThrow(/version conflict/);
    expect(() => store.updateProject({ projectId: project.id, expectedVersion: 1, name: '' })).toThrow(/name/);
    expect(() => store.updateProject({ projectId: project.id, expectedVersion: 1, loopPolicy: { maxIterations: 9, noProgressLimit: 1 } })).toThrow(/maxIterations/);
    expect(() => store.updateProject({ projectId: project.id, expectedVersion: 1, office: { roomOrder: ['nope'] } })).toThrow(/unknown room/);
    // Failed validations did not persist anything.
    expect(store.getProject(project.id)?.version).toBe(1);
    const updated = store.updateProject({ projectId: project.id, expectedVersion: 1, name: 'Renamed', loopPolicy: { maxIterations: 2, noProgressLimit: 2 } });
    expect(updated.version).toBe(2);
    expect(updated.name).toBe('Renamed');
    expect(store.getProject(project.id)?.loopPolicy).toEqual({ maxIterations: 2, noProgressLimit: 2 });
  });

  it('reassignNode validates room ids and persists reassignment metadata', () => {
    const project = store.createProject({ name: 'Office', goal: 'g', provider: 'openai', model: 'm', template: 'office' });
    expect(() => store.reassignNode({ projectId: project.id, nodeId: 'node-5', expectedVersion: 1, roomId: 'basement' })).toThrow(/unknown roomId/);
    expect(() => store.reassignNode({ projectId: project.id, nodeId: 'node-5', expectedVersion: 2, roomId: 'data' })).toThrow(/version conflict/);
    const updated = store.reassignNode({ projectId: project.id, nodeId: 'node-5', expectedVersion: 1, roomId: 'data' });
    expect(updated.version).toBe(2);
    expect(updated.nodes.find((n) => n.id === 'node-5')?.roomId).toBe('data');
    const rooms = deriveOfficeRooms(store.getProject(project.id) as Project);
    expect(rooms.flatMap((r) => r.members).find((m) => m.nodeId === 'node-5')?.roomId).toBe('data');
  });

  it('parent moves recompute depth/kind and reject cycles and depth blowouts', () => {
    const project = store.createProject({ name: 'Office', goal: 'g', provider: 'openai', model: 'm', template: 'office' });
    // Move worker node-5 (Research Analyst) under Delivery Director (node-3): still depth 2.
    const moved = store.reassignNode({ projectId: project.id, nodeId: 'node-5', expectedVersion: 1, parentId: 'node-3' });
    const n5 = moved.nodes.find((n) => n.id === 'node-5');
    expect(n5?.parentId).toBe('node-3');
    expect(n5?.depth).toBe(2);
    expect(n5?.kind).toBe('worker');

    // Cycle: move Research Director (node-2) under its own worker (node-5 now under node-3; use node-6).
    expect(() => store.reassignNode({ projectId: project.id, nodeId: 'node-3', expectedVersion: 2, parentId: 'node-6' })).toThrow(/cycle/);
    // Depth blowout: node-5 is depth 2; nothing may parent to it.
    expect(() => store.reassignNode({ projectId: project.id, nodeId: 'node-7', expectedVersion: 2, parentId: 'node-5' })).toThrow(/maximum hierarchy depth/);
    // Root may not be re-parented into the tree... but a sub-director may not become a second root either.
    expect(() => store.reassignNode({ projectId: project.id, nodeId: 'node-2', expectedVersion: 2, parentId: null })).toThrow(/root/);
    // Unknown parent / self-parent.
    expect(() => store.reassignNode({ projectId: project.id, nodeId: 'node-2', expectedVersion: 2, parentId: 'node-42' })).toThrow(/unknown parent/);
    expect(() => store.reassignNode({ projectId: project.id, nodeId: 'node-2', expectedVersion: 2, parentId: 'node-2' })).toThrow(/own parent/);
    // Nothing was saved by the failed attempts.
    expect(store.getProject(project.id)?.version).toBe(2);
  });

  it('parent reassignment requires the office template', () => {
    const project = store.createProject({ name: 'Std', goal: 'g', provider: 'openai', model: 'm' });
    expect(() => store.reassignNode({ projectId: project.id, nodeId: 'node-2', expectedVersion: 1, parentId: 'node-1' })).toThrow(/office-template/);
  });

  it('corrupt persisted state is tolerated, never trusted', () => {
    const project = store.createProject({ name: 'Office', goal: 'g', provider: 'openai', model: 'm', template: 'office' });
    const projectFile = path.join(store.projectDir(project.id), 'project.json');
    fs.writeFileSync(projectFile, '{{{{ not json', 'utf8');
    expect(store.getProject(project.id)).toBeNull();
    expect(store.listProjects().find((p) => p.id === project.id)).toBeUndefined();
    // Corrupt approval files are skipped by listApprovals.
    fs.writeFileSync(projectFile, JSON.stringify(project), 'utf8');
    const approvalsDir = path.join(store.projectDir(project.id), 'approvals');
    fs.mkdirSync(approvalsDir, { recursive: true });
    fs.writeFileSync(path.join(approvalsDir, 'appr-bad.json'), 'garbage', 'utf8');
    expect(store.listApprovals(project.id)).toEqual([]);
  });

  it('canonical room catalog is stable', () => {
    expect(OFFICE_ROOMS.map((r) => r.id)).toEqual(['executive', 'research', 'architecture', 'engineering', 'design', 'data', 'qa', 'operations']);
  });
});
