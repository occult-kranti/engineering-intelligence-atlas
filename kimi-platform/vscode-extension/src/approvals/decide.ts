/**
 * Approval decision payload construction. The desktop requires the exact
 * payloadHash of the reviewed record — we never recompute it client-side and
 * never send a hash that does not match the record being decided.
 *
 * Pure module — no 'vscode' / 'node:*' imports.
 */

import type { ApprovalRecord, DecideApprovalPayload } from '../bridge/types.js';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function isValidPayloadHash(hash: unknown): hash is string {
  return typeof hash === 'string' && SHA256_HEX.test(hash);
}

/**
 * Build the decide payload for a record. Throws when the record is not
 * pending or its payloadHash is malformed — better to block locally than to
 * let the desktop reject a malformed decision.
 */
export function buildDecision(
  record: ApprovalRecord,
  decision: 'approved' | 'rejected',
): DecideApprovalPayload {
  if (record.status !== 'pending') {
    throw new Error(`Approval ${record.id} is already ${record.status}.`);
  }
  if (!isValidPayloadHash(record.payloadHash)) {
    throw new Error(`Approval ${record.id} has a malformed payloadHash; refusing to decide.`);
  }
  return {
    projectId: record.projectId,
    runId: record.runId ?? undefined,
    approvalId: record.id,
    decision,
    payloadHash: record.payloadHash,
  };
}

/** One-line human summary of what is being approved (never secret material). */
export function describeApproval(record: ApprovalRecord): string {
  const scope = record.kind === 'hire' ? 'skill hiring plan' : `node ${record.nodeId ?? '(unknown)'}`;
  return `${record.kind === 'hire' ? 'Approve' : 'Approve execution of'} ${scope} (hash ${record.payloadHash.slice(0, 12)}…)`;
}
