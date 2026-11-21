/**
 * Declarative enterprise action registry + availability derivation.
 *
 * ENTERPRISE_ACTIONS is a structural copy of the closed registry in
 * src/shared/enterprise.ts (pinned by tests). Every CEO control is gated by
 * it: a control renders only when its action can run in the current state,
 * otherwise it is omitted or disabled with the exact reason — never a dead
 * button.
 */

import type { EnterpriseContractDto, EnterpriseRecordDto } from '../office/entTypes.js';

export interface EnterpriseAction {
  id: string;
  operation: string;
  capability: 'read' | 'propose' | 'apply' | 'decide' | 'operate' | 'reassign' | 'promote';
  approval: 'blueprint-activation' | 'plan' | 'budget-increase' | 'memory-promote' | null;
  description: string;
}

/** Structural copy of shared/enterprise.ts ENTERPRISE_ACTIONS (test-pinned). */
export const ENTERPRISE_ACTIONS: readonly EnterpriseAction[] = [
  {
    id: 'blueprint.apply',
    operation: 'apply-blueprint',
    capability: 'apply',
    approval: 'blueprint-activation',
    description: 'Materialize an approved blueprint (companies/departments/contracts) into platform state.',
  },
  {
    id: 'contract.decide',
    operation: 'decide-contract',
    capability: 'decide',
    approval: null,
    description: 'Approve or reject a proposed worker contract (the decision IS the gate).',
  },
  {
    id: 'contract.release',
    operation: 'release-contract',
    capability: 'operate',
    approval: null,
    description: 'Release an active/draining contract back to the pool.',
  },
  {
    id: 'program.start',
    operation: 'start-program',
    capability: 'operate',
    approval: 'plan',
    description: 'Start dispatching company runs for an approved program.',
  },
  {
    id: 'program.pause',
    operation: 'pause-program',
    capability: 'operate',
    approval: null,
    description: 'Pause a running program (leases keep draining).',
  },
  {
    id: 'program.resume',
    operation: 'resume-program',
    capability: 'operate',
    approval: null,
    description: 'Resume a paused program.',
  },
  {
    id: 'program.cancel',
    operation: 'cancel-program',
    capability: 'operate',
    approval: null,
    description: 'Cancel a program and stop all company runs.',
  },
  {
    id: 'worker.reassign',
    operation: 'reassign-worker',
    capability: 'reassign',
    approval: null,
    description: 'Reassign a worker to a different node/room/department.',
  },
  {
    id: 'worker.capacity',
    operation: 'adjust-worker-capacity',
    capability: 'operate',
    approval: null,
    description: 'Adjust a worker contract capacity share.',
  },
  {
    id: 'worker.suspend',
    operation: 'suspend-worker',
    capability: 'operate',
    approval: null,
    description: 'Suspend a worker contract (no new claims).',
  },
  {
    id: 'memory.promote',
    operation: 'promote-memory',
    capability: 'promote',
    approval: 'memory-promote',
    description: 'Promote an artifact reference into a wider memory scope (by ref only).',
  },
  {
    id: 'memory.revoke',
    operation: 'revoke-memory',
    capability: 'promote',
    approval: null,
    description: 'Revoke a promoted memory entry.',
  },
] as const;

export function actionById(id: string): EnterpriseAction | null {
  return ENTERPRISE_ACTIONS.find((a) => a.id === id) ?? null;
}

export interface ActionAvailability {
  id: string;
  available: boolean;
  /** Exact reason the action cannot run right now (for tooltips/notes). */
  reason: string | null;
}

const PROGRAM_ACTIVE = new Set(['dispatching', 'running', 'reconciling']);

/**
 * Derive per-action availability from the record + contracts. Pure: same
 * inputs, same answer. The control plane re-validates everything; this is
 * the honest client mirror so unavailable controls explain themselves.
 */
export function deriveActionAvailability(
  record: EnterpriseRecordDto | null,
  contracts: readonly EnterpriseContractDto[],
): Map<string, ActionAvailability> {
  const out = new Map<string, ActionAvailability>();
  const set = (id: string, available: boolean, reason: string | null): void => {
    out.set(id, { id, available, reason: available ? null : reason });
  };
  if (!record) {
    for (const a of ENTERPRISE_ACTIONS) set(a.id, false, 'Select an enterprise first.');
    return out;
  }
  const program = record.program;
  const planApproval =
    program === null
      ? null
      : (record.approvals.find((a) => a.kind === 'plan' && a.blueprintHash === program.blueprintHash) ?? null);

  const activation = record.approvals.find((a) => a.kind === 'blueprint-activation' && a.status === 'approved');
  set(
    'blueprint.apply',
    activation !== undefined,
    activation === undefined
      ? 'Requires an approved blueprint-activation approval (preview, then approve).'
      : null,
  );
  set(
    'contract.decide',
    record.blueprint !== null && contracts.some((c) => c.status === 'proposed'),
    record.blueprint === null ? 'Apply a blueprint first.' : 'No proposed contracts to decide.',
  );
  set(
    'contract.release',
    contracts.some((c) => c.status === 'active' || c.status === 'draining'),
    'No active or draining contracts to release.',
  );
  set(
    'program.start',
    program !== null && program.state === 'awaiting_plan_approval' && planApproval?.status === 'approved',
    program === null
      ? 'Apply a blueprint to create the program.'
      : program.state !== 'awaiting_plan_approval'
        ? `Program is "${program.state}"; only awaiting_plan_approval programs can start.`
        : 'Requires an approved plan approval for the current blueprint.',
  );
  set(
    'program.pause',
    program !== null && !record.programPaused && PROGRAM_ACTIVE.has(program.state),
    program === null
      ? 'No program yet.'
      : record.programPaused
        ? 'Program is already paused.'
        : `Program is "${program.state}"; pause needs an active program.`,
  );
  set(
    'program.resume',
    program !== null && record.programPaused,
    program === null ? 'No program yet.' : 'Program is not paused.',
  );
  set(
    'program.cancel',
    program !== null && PROGRAM_ACTIVE.has(program.state),
    program === null ? 'No program yet.' : `Program is "${program.state}"; nothing active to stop.`,
  );
  set(
    'worker.reassign',
    record.state === 'materialized',
    'Materialize a blueprint first (companies become real offices).',
  );
  set(
    'worker.capacity',
    contracts.length > 0,
    'No contract seats exist yet (apply a blueprint or propose a contract).',
  );
  set(
    'worker.suspend',
    contracts.some((c) => c.status === 'active' || c.status === 'draining'),
    'No active/draining contract seats to suspend or resume.',
  );
  set(
    'memory.promote',
    record.state === 'materialized',
    'Materialize a blueprint first; promotion references run artifacts.',
  );
  set(
    'memory.revoke',
    record.memory.some((m) => m.status === 'promoted'),
    'No promoted memory entries to revoke.',
  );
  return out;
}

/** Kebab-case validation mirroring the shared EnterpriseKeySchema. */
export function isEnterpriseKey(value: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(value) && value.length >= 1 && value.length <= 64;
}

/** Discipline → declared skill ids (structural copy of DISCIPLINE_SKILLS). */
export const DISCIPLINE_SKILLS: Record<string, readonly string[]> = {
  mathematics: ['mathematics-research'],
  'computational-geometry': ['computational-geometry-engineering'],
  'backend-engineering': ['architecture-database-backend-engineering'],
  cybersecurity: ['defensive-reverse-engineering'],
  'ai-research': ['ai-research-frontier', 'ai-open-model-research'],
  design: ['civilization-art-design-research', 'ui-ux-research-design-engineering', 'spatial-3d-production-engineering'],
  'music-production': ['music-theory-production-engineering'],
};

export const DISCIPLINES = Object.keys(DISCIPLINE_SKILLS);
