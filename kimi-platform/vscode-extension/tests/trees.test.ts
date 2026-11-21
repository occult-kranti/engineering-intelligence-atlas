import { describe, expect, it } from 'vitest';
import type { ApprovalRecord, OfficeSnapshot, Project, ProjectRun } from '../src/bridge/types.js';
import {
  buildProjectChildren,
  buildProjectNodes,
  buildRoomChildren,
  buildRunChildren,
  buildRunNodes,
  runDescription,
  runStatusContextValue,
  runStatusIcon,
} from '../src/views/model.js';

const project: Project = {
  id: 'p1',
  name: 'Alpha',
  goal: 'g',
  provider: 'ollama',
  model: 'm',
  nodes: [
    {
      id: 'n1',
      role: 'director',
      title: 'Director',
      instructions: '',
      dependsOn: [],
      status: 'pending',
      budget: { maxTokens: 1, maxMinutes: 1, maxUsd: 1 },
    },
  ],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  version: 1,
  template: 'office',
};

const snapshot: OfficeSnapshot = {
  projectId: 'p1',
  version: 1,
  template: 'office',
  runId: null,
  rooms: [
    {
      id: 'direction',
      label: 'Direction',
      order: 0,
      members: [
        {
          nodeId: 'n1',
          title: 'Director',
          kind: 'director',
          role: 'director',
          depth: 0,
          parentId: null,
          roomId: 'direction',
          skillRef: null,
          status: 'running',
        },
      ],
    },
  ],
  nodeCount: 1,
};

const run: ProjectRun = {
  id: 'r1',
  projectId: 'p1',
  status: 'waiting-approval',
  terminationReason: null,
  error: null,
  runBudget: { maxTokens: 1, maxMinutes: 1, maxUsd: 1 },
  priceRates: { inputUsdPerMillion: 1, outputUsdPerMillion: 1 },
  usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.0001, elapsedSeconds: 3 },
  nodeStates: {
    n1: {
      status: 'succeeded',
      usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.0001 },
      artifactId: 'a1',
      error: null,
      startedAt: null,
      finishedAt: null,
      artifactIds: ['a0', 'a1'],
    },
    n2: {
      status: 'pending',
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      artifactId: null,
      error: null,
      startedAt: null,
      finishedAt: null,
    },
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:01:00Z',
  finishedAt: null,
};

const approval: ApprovalRecord = {
  id: 'ap1',
  kind: 'node',
  projectId: 'p1',
  runId: 'r1',
  nodeId: 'n2',
  payloadHash: 'b'.repeat(64),
  payload: {},
  status: 'pending',
  createdAt: '2026-01-01T00:00:30Z',
  decidedAt: null,
};

describe('projects tree model', () => {
  it('lists projects sorted by updatedAt, or an info row when empty', () => {
    expect(buildProjectNodes([], new Map())[0]).toMatchObject({ kind: 'info' });
    const nodes = buildProjectNodes([project], new Map());
    expect(nodes[0]).toMatchObject({ kind: 'project', project: { id: 'p1' } });
  });

  it('expands office projects into rooms, then members', () => {
    const children = buildProjectChildren(project, snapshot);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ kind: 'room', roomId: 'direction', memberCount: 1 });
    const members = buildRoomChildren(snapshot, 'direction');
    expect(members[0]).toMatchObject({ kind: 'member', nodeId: 'n1', status: 'running' });
  });

  it('falls back to flat node list without a snapshot', () => {
    const children = buildProjectChildren(project, null);
    expect(children[0]).toMatchObject({ kind: 'member', nodeId: 'n1' });
  });
});

describe('runs tree model', () => {
  it('lists runs with project names, or an info row when empty', () => {
    expect(buildRunNodes([], [])[0]).toMatchObject({ kind: 'info' });
    const nodes = buildRunNodes([run], [project]);
    expect(nodes[0]).toMatchObject({ kind: 'run', projectName: 'Alpha' });
  });

  it('shows pending approvals first, then nodes that produced artifacts', () => {
    const children = buildRunChildren(run, [approval]);
    expect(children[0]).toMatchObject({ kind: 'approval', approval: { id: 'ap1' } });
    const artifacts = children.filter((c) => c.kind === 'artifact');
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({ nodeId: 'n1', attemptCount: 2 });
  });

  it('maps run statuses to icons and context values', () => {
    expect(runStatusIcon('running')).toBe('sync~spin');
    expect(runStatusIcon('waiting-approval')).toBe('warning');
    expect(runStatusContextValue('interrupted')).toBe('run-interrupted');
  });

  it('describes usage without leaking anything sensitive', () => {
    expect(runDescription(run)).toContain('waiting-approval');
    expect(runDescription(run)).toContain('15 tok');
  });
});
