import type { ApprovalRecord } from '../shared/contract';
import type { ProjectStore } from './projects';
import { validateHirePlan, type SkillRegistry } from './skills';

/**
 * Design-time hiring flow: validated plans become persisted, keyed approval
 * records; approving applies the EXACT hashed payload to the project (OCC
 * checked), rejecting is terminal. No provider involvement and no re-request
 * loops: an identical payload always maps to the same approval record.
 */

export interface HireRequestInput {
  projectId: string;
  expectedVersion: number;
  assignments: unknown;
  confirmed: boolean;
}

export interface HireDecisionInput {
  projectId: string;
  approvalId: string;
  decision: 'approved' | 'rejected';
  payloadHash: string;
}

export function requestHireApproval(
  store: ProjectStore,
  registry: SkillRegistry,
  req: HireRequestInput,
): { ok: boolean; approval?: ApprovalRecord; error?: string } {
  try {
    if (req.confirmed !== true) return { ok: false, error: 'Hiring requires explicit user confirmation.' };
    if (!Number.isInteger(req.expectedVersion)) return { ok: false, error: 'expectedVersion must be an integer' };
    const project = store.getProject(req.projectId);
    if (!project) return { ok: false, error: 'unknown project id' };
    if (project.version !== req.expectedVersion) {
      return { ok: false, error: `version conflict: project is at version ${project.version}, you sent ${req.expectedVersion}` };
    }
    const assignments = validateHirePlan(project, registry, req.assignments);
    const { record, created } = store.getOrCreateApproval({
      projectId: project.id,
      runId: null,
      kind: 'hire',
      nodeId: null,
      payload: { projectId: project.id, projectVersion: project.version, assignments },
    });
    if (!created && record.status === 'rejected') {
      return {
        ok: false,
        error: 'this exact hire plan was already rejected; edit the plan to request a new approval',
        approval: record,
      };
    }
    return { ok: true, approval: record };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function decideHireApproval(
  store: ProjectStore,
  registry: SkillRegistry,
  req: HireDecisionInput,
): { ok: boolean; approval?: ApprovalRecord; error?: string } {
  try {
    const existing = store.getApproval(req.projectId, null, req.approvalId);
    if (!existing) return { ok: false, error: 'unknown approval id' };
    if (existing.kind !== 'hire') return { ok: false, error: 'approval is not a hire request' };
    if (req.decision === 'approved') {
      // Validate applicability BEFORE recording the decision so a stale plan
      // fails cleanly and the approval stays pending.
      const project = store.getProject(req.projectId);
      if (!project) return { ok: false, error: 'unknown project id' };
      const payload = existing.payload as { projectVersion?: unknown; assignments?: unknown };
      if (payload.projectVersion !== project.version) {
        return {
          ok: false,
          error: `project changed since this hire plan was requested (v${String(payload.projectVersion)} -> v${project.version}); reject it and run hirePreview again`,
        };
      }
      const assignments = validateHirePlan(project, registry, payload.assignments);
      const decided = store.decideApproval({
        projectId: req.projectId,
        runId: null,
        approvalId: req.approvalId,
        decision: req.decision,
        payloadHash: req.payloadHash,
      });
      if (!decided.ok) return decided;
      store.applyHires(project.id, project.version, assignments);
      return { ok: true, approval: decided.approval };
    }
    return store.decideApproval({
      projectId: req.projectId,
      runId: null,
      approvalId: req.approvalId,
      decision: req.decision,
      payloadHash: req.payloadHash,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
