/**
 * Pure tree-model builders for the Office Projects and Runs trees.
 * VS Code TreeDataProvider glue lives in projectsTree.ts / runsTree.ts;
 * everything testable lives here.
 */

import type {
  ApprovalRecord,
  NodeStatus,
  OfficeSnapshot,
  Project,
  ProjectRun,
  RunStatus,
} from '../bridge/types.js';

export type ProjectsNode =
  | { kind: 'project'; project: Project }
  | { kind: 'room'; projectId: string; roomId: string; label: string; memberCount: number }
  | { kind: 'member'; projectId: string; nodeId: string; title: string; role: string; status: NodeStatus }
  | { kind: 'info'; label: string };

export type RunsNode =
  | { kind: 'run'; run: ProjectRun; projectName: string | undefined }
  | {
      kind: 'approval';
      approval: ApprovalRecord;
    }
  | {
      kind: 'artifact';
      projectId: string;
      runId: string;
      nodeId: string;
      title: string;
      status: NodeStatus;
      attemptCount: number;
    }
  | { kind: 'info'; label: string };

export function buildProjectNodes(projects: Project[], office: Map<string, OfficeSnapshot | null>): ProjectsNode[] {
  if (projects.length === 0) {
    return [{ kind: 'info', label: 'No projects yet — use "New Goal" to create one.' }];
  }
  return [...projects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((project) => ({ kind: 'project' as const, project }));
}

/** Children of a project node: office rooms when a snapshot exists, else flat node list. */
export function buildProjectChildren(project: Project, snapshot: OfficeSnapshot | null | undefined): ProjectsNode[] {
  if (snapshot && snapshot.rooms.length > 0) {
    return [...snapshot.rooms]
      .sort((a, b) => a.order - b.order)
      .map((room) => ({
        kind: 'room' as const,
        projectId: project.id,
        roomId: room.id,
        label: room.label,
        memberCount: room.members.length,
      }));
  }
  if (project.nodes.length === 0) return [{ kind: 'info', label: 'Empty project.' }];
  return project.nodes.map((n) => ({
    kind: 'member' as const,
    projectId: project.id,
    nodeId: n.id,
    title: n.title,
    role: n.role,
    status: n.status,
  }));
}

export function buildRoomChildren(snapshot: OfficeSnapshot, roomId: string): ProjectsNode[] {
  const room = snapshot.rooms.find((r) => r.id === roomId);
  if (!room) return [{ kind: 'info', label: 'Room not found.' }];
  return room.members.map((m) => ({
    kind: 'member' as const,
    projectId: snapshot.projectId,
    nodeId: m.nodeId,
    title: m.title,
    role: m.role,
    status: m.status,
  }));
}

const STATUS_ICON: Record<RunStatus, string> = {
  running: 'sync~spin',
  paused: 'debug-pause',
  'waiting-approval': 'warning',
  completed: 'pass',
  failed: 'error',
  cancelled: 'circle-slash',
  terminated: 'stop-circle',
  interrupted: 'debug-restart',
};

export function runStatusIcon(status: RunStatus): string {
  return STATUS_ICON[status];
}

export function runStatusContextValue(status: RunStatus): string {
  return `run-${status}`;
}

export function buildRunNodes(runs: ProjectRun[], projects: Project[]): RunsNode[] {
  if (runs.length === 0) return [{ kind: 'info', label: 'No runs yet.' }];
  const names = new Map(projects.map((p) => [p.id, p.name]));
  return [...runs]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((run) => ({ kind: 'run' as const, run, projectName: names.get(run.projectId) }));
}

/** Children of a run node: pending approvals first, then node artifacts. */
export function buildRunChildren(run: ProjectRun, approvals: ApprovalRecord[]): RunsNode[] {
  const out: RunsNode[] = [];
  for (const a of approvals
    .filter((x) => x.runId === run.id && x.status === 'pending')
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    out.push({ kind: 'approval', approval: a });
  }
  const entries = Object.entries(run.nodeStates);
  entries.sort(([a], [b]) => a.localeCompare(b));
  for (const [nodeId, st] of entries) {
    const attempts = st.artifactIds?.length ?? (st.artifactId ? 1 : 0);
    if (attempts > 0 || st.artifactId) {
      out.push({
        kind: 'artifact',
        projectId: run.projectId,
        runId: run.id,
        nodeId,
        title: nodeId,
        status: st.status,
        attemptCount: Math.max(attempts, 1),
      });
    }
  }
  if (out.length === 0) out.push({ kind: 'info', label: 'No approvals or artifacts yet.' });
  return out;
}

/** Run summary line shown in the tree description. */
export function runDescription(run: ProjectRun): string {
  const cost = run.usage.costUsd > 0 ? ` $${run.usage.costUsd.toFixed(4)}` : '';
  const tokens = run.usage.inputTokens + run.usage.outputTokens;
  const tok = tokens > 0 ? ` ${tokens} tok` : '';
  return `${run.status}${tok}${cost}`;
}
