import { describe, expect, it } from 'vitest';
import { buildDecision, describeApproval, isValidPayloadHash } from '../src/approvals/decide.js';
import type { ApprovalRecord } from '../src/bridge/types.js';

const hash = '0123456789abcdef'.repeat(4);

function record(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    id: 'ap1',
    kind: 'node',
    projectId: 'p1',
    runId: 'r1',
    nodeId: 'n1',
    payloadHash: hash,
    payload: { note: 'x' },
    status: 'pending',
    createdAt: '2026-01-01T00:00:00Z',
    decidedAt: null,
    ...overrides,
  };
}

describe('approval payloadHash handling', () => {
  it('validates sha256 hex shape', () => {
    expect(isValidPayloadHash(hash)).toBe(true);
    expect(isValidPayloadHash(hash.toUpperCase())).toBe(false);
    expect(isValidPayloadHash('short')).toBe(false);
    expect(isValidPayloadHash('')).toBe(false);
    expect(isValidPayloadHash(42)).toBe(false);
  });

  it('sends the record payloadHash verbatim — never recomputed, never altered', () => {
    const payload = buildDecision(record(), 'approved');
    expect(payload).toEqual({
      projectId: 'p1',
      runId: 'r1',
      approvalId: 'ap1',
      decision: 'approved',
      payloadHash: hash,
    });
  });

  it('refuses to decide non-pending approvals', () => {
    expect(() => buildDecision(record({ status: 'approved' }), 'approved')).toThrow(/already/);
    expect(() => buildDecision(record({ status: 'rejected' }), 'rejected')).toThrow(/already/);
  });

  it('refuses malformed payloadHash locally', () => {
    expect(() => buildDecision(record({ payloadHash: 'not-a-hash' }), 'approved')).toThrow(/malformed/);
  });

  it('omits runId for design-time hire approvals', () => {
    const payload = buildDecision(record({ kind: 'hire', runId: null, nodeId: null }), 'rejected');
    expect(payload.runId).toBeUndefined();
    expect(payload.decision).toBe('rejected');
  });

  it('describes approvals without payload internals', () => {
    const text = describeApproval(record());
    expect(text).toContain(hash.slice(0, 12));
    expect(text).not.toContain('note');
  });
});
