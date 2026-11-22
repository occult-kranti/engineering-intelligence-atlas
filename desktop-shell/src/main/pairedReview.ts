import type { OfficeJob, OfficeSnapshot } from '../shared/office';

export interface ReviewReply { verdict: 'accepted' | 'revise' | 'blocked'; summary: string; evidenceRefs: string[] }

/** The managed adapter interprets only this bounded data shape, never tool directives. */
export function parseReviewReply(text: string): ReviewReply {
  if (Buffer.byteLength(text, 'utf8') > 16_000) throw new Error('Review reply exceeds its bounded JSON contract. Work remains unaccepted.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('The helper must return a structured review verdict. Work remains unaccepted.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Review reply must be a JSON object.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 3 || Object.keys(record).some(key => !['verdict', 'summary', 'evidenceRefs'].includes(key))
    || typeof record.verdict !== 'string' || !['accepted', 'revise', 'blocked'].includes(record.verdict)
    || typeof record.summary !== 'string' || !record.summary.trim() || Buffer.byteLength(record.summary, 'utf8') > 2000
    || !Array.isArray(record.evidenceRefs) || record.evidenceRefs.length > 20 || (record.verdict === 'accepted' && record.evidenceRefs.length === 0)
    || record.evidenceRefs.some(ref => typeof ref !== 'string' || !ref.trim() || Buffer.byteLength(ref, 'utf8') > 300)) {
    throw new Error('Review reply has invalid fields. Work remains unaccepted; no tool instruction was executed.');
  }
  return { verdict: record.verdict as ReviewReply['verdict'], summary: record.summary.trim(), evidenceRefs: [...record.evidenceRefs] as string[] };
}

/** Defence in depth; the native core rechecks the full pair and current grants before dispatch. */
export function assertPairedAttempt(job: OfficeJob, snapshot: OfficeSnapshot): void {
  const p = job.pair;
  if (![2,3].includes(snapshot.schemaVersion) || !p || !p.stepId || !p.peerEmployeeId || p.peerEmployeeId === job.employeeId
    || !p.primaryJobId || !p.reviewJobId || p.primaryJobId === p.reviewJobId
    || !['primary', 'review'].includes(p.phase) || job.id !== (p.phase === 'primary' ? p.primaryJobId : p.reviewJobId)) {
    throw new Error('PAIR_REQUIRED: plan this work with a distinct helper in the current office before dispatch. Historical work is preserved.');
  }
  if (p.phase === 'review' && (job.allowedTools.length !== 0 || !job.dependencies.includes(p.primaryJobId))) {
    throw new Error('The review phase must depend on its producer and have no write tools. No request was dispatched.');
  }
}
