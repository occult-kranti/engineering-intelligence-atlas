/** Browser-safe metadata for the deterministic employee that reviews external text.
 * Reports are observations, never authority grants or proof that a network read ran.
 */
export const SOURCE_REVIEW_EMPLOYEE = Object.freeze({
  id: 'source-reviewer', name: 'Source Review', managerId: 'donna',
  role: 'External-source instruction reviewer', execution: 'deterministic', modelCalls: 0,
} as const);

export type SourceReviewKind = 'repository' | 'website' | 'artifact' | 'knowledge';
export type SourceReviewCode = 'instruction_override' | 'agent_directive' | 'role_impersonation'
  | 'credential_request' | 'tool_escalation' | 'hidden_direction' | 'robots_directive';
export interface SourceReviewFinding {
  code: SourceReviewCode; occurrences: number; context: 'instruction-like' | 'quoted-example' | 'crawl-advisory';
  disposition: 'data-only';
}
export interface SourceReviewEvidence {
  sourceId: string; kind: SourceReviewKind; contentSha256: string; scannedSha256: string;
  totalBytes: number; scannedBytes: number; coverage: 'complete' | 'partial'; findings: SourceReviewFinding[];
}
export interface SourceReviewReport {
  schemaVersion: 1; reviewer: typeof SOURCE_REVIEW_EMPLOYEE; checkedAt: string; fingerprint: string;
  jobId?: string; companyId?: string; artifactUri?: string;
  status: 'clear' | 'flagged'; coverage: 'complete' | 'partial'; totalSources: number; omittedSources: number;
  sources: SourceReviewEvidence[];
  handoff: { recipient: 'donna'; state: 'not-needed' | 'needs-review'; reason: 'none' | 'external-directives' | 'partial-coverage' };
  policy: { externalInstructions: 'never-authority'; robots: 'separate-advisory-policy'; modelCalls: 0; networkCalls: 0 };
}
