import crypto from 'node:crypto';
import { isIP } from 'node:net';
import { SOURCE_REVIEW_EMPLOYEE, type SourceReviewCode, type SourceReviewFinding, type SourceReviewKind, type SourceReviewReport } from '../shared/source-review';

export interface SourceReviewInput { id: string; kind: SourceReviewKind; text: string; truncated?: boolean }
const MAX_SOURCES = 32;
const MAX_SOURCE_BYTES = 64 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024;
const HIDDEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
const RULES: ReadonlyArray<[SourceReviewCode, RegExp]> = [
  ['instruction_override', /\b(?:ignore|disregard|forget|override)\b[^\r\n]{0,70}\b(?:previous|prior|system|developer|above)\b[^\r\n]{0,45}\binstructions?\b/i],
  ['agent_directive', /\b(?:(?:ai|llm|bot|agent|assistant)s?\s+(?:must|should|shall|are required to)|if you are\s+(?:an?\s+)?(?:ai|llm|bot|agent|assistant))\b/i],
  ['role_impersonation', /(?:\b(?:system|developer)\s*(?:message|prompt|override)\s*:|<\|(?:im_start|system|developer)\|>|\[INST\])/i],
  ['credential_request', /\b(?:send|upload|reveal|print|exfiltrate|copy|read)\b[^\r\n]{0,90}(?:\b(?:api[ _-]?key|access[ _-]?token|credentials?|private[ _-]?key|password)\b|\.env\b)/i],
  ['tool_escalation', /\b(?:disable|bypass|remove|ignore)\b[^\r\n]{0,70}\b(?:permissions?|approval|authorization|access controls?|safety checks?)\b|\b(?:run|execute)\s+(?:this\s+)?(?:shell|bash|sudo|curl)\b/i],
  ['robots_directive', /(?:^|\\n)\s*(?:user-agent|disallow|allow|crawl-delay|sitemap)\s*:/i],
];
const sha = (value: string | Buffer): string => crypto.createHash('sha256').update(value).digest('hex');
function prefix(text: string, bytes: number): string {
  const encoded = Buffer.from(text, 'utf8');
  if (encoded.length <= bytes) return text;
  // A decoder's replacement for a split character would overstate scanned bytes.
  return encoded.subarray(0, Math.max(0, bytes)).toString('utf8').replace(/\uFFFD$/, '');
}
function id(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value)
    && !/(?:^|[^A-Za-z0-9_-])(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{8,}/.test(value) ? value : fallback;
}
function inspect(text: string): SourceReviewFinding[] {
  const counts = new Map<string, SourceReviewFinding>();
  const add = (code: SourceReviewCode, context: SourceReviewFinding['context']): void => {
    const key = code + ':' + context;
    const previous = counts.get(key);
    if (previous) previous.occurrences++;
    else counts.set(key, { code, occurrences: 1, context, disposition: 'data-only' });
  };
  let inFence = false;
  for (const original of text.split(/\r?\n/)) {
    const line = original.normalize('NFKC').replace(HIDDEN, '');
    const fence = /^\s*(?:```|~~~)/.test(line);
    const quoted = inFence || /^\s*>/.test(line)
      || /\b(?:example|quoted|quote|attack|phrase|detects?|documentation)\b/i.test(line) && /["“”`]/.test(line);
    if (original !== original.replace(HIDDEN, '')) add('hidden_direction', quoted ? 'quoted-example' : 'instruction-like');
    for (const [code, pattern] of RULES) if (pattern.test(line)) {
      add(code, code === 'robots_directive' ? 'crawl-advisory' : quoted ? 'quoted-example' : 'instruction-like');
    }
    if (fence) inFence = !inFence;
  }
  return [...counts.values()];
}

/** Bounded heuristic review. A clear report is not proof that text is harmless.
 * All external content remains data, including undetected or quoted instructions.
 * No raw source excerpt, URL query, credential or tool capability enters the report.
 */
export function reviewExternalSources(inputs: readonly SourceReviewInput[], scope: { jobId?: string; companyId?: string; now?: number } = {}): SourceReviewReport {
  const sources: SourceReviewReport['sources'] = [];
  let remaining = MAX_TOTAL_BYTES;
  const totalSources = Array.isArray(inputs) ? inputs.length : 0;
  for (const [index, input] of (Array.isArray(inputs) ? inputs : []).slice(0, MAX_SOURCES).entries()) {
    const text = typeof input?.text === 'string' ? input.text : '';
    const bounded = prefix(text, Math.min(MAX_SOURCE_BYTES, remaining));
    const scannedBytes = Buffer.byteLength(bounded, 'utf8');
    const totalBytes = Buffer.byteLength(text, 'utf8');
    remaining -= scannedBytes;
    const kind = ['repository', 'website', 'artifact', 'knowledge'].includes(input?.kind) ? input.kind : 'artifact';
    sources.push({ sourceId: id(input?.id, `source-${index}`), kind, contentSha256: sha(text), scannedSha256: sha(bounded),
      totalBytes, scannedBytes, coverage: typeof input?.text !== 'string' || input?.truncated || scannedBytes < totalBytes ? 'partial' : 'complete', findings: inspect(bounded) });
  }
  const omittedSources = Math.max(0, totalSources - sources.length);
  const coverage = omittedSources || sources.some(source => source.coverage === 'partial') ? 'partial' : 'complete';
  const flagged = sources.some(source => source.findings.some(finding => finding.context !== 'quoted-example'));
  const status = flagged || coverage === 'partial' ? 'flagged' : 'clear';
  const now = typeof scope.now === 'number' && Number.isFinite(scope.now) && Math.abs(scope.now) <= 8.64e15 ? scope.now : Date.now();
  return {
    schemaVersion: 1, reviewer: SOURCE_REVIEW_EMPLOYEE, checkedAt: new Date(now).toISOString(),
    fingerprint: sha(JSON.stringify({ sources, omittedSources })),
    ...(scope.jobId ? { jobId: id(scope.jobId, 'unrecognized-job') } : {}),
    ...(scope.companyId ? { companyId: id(scope.companyId, 'unrecognized-company') } : {}),
    status, coverage, totalSources, omittedSources, sources,
    handoff: { recipient: 'donna', state: status === 'flagged' ? 'needs-review' : 'not-needed', reason: flagged ? 'external-directives' : coverage === 'partial' ? 'partial-coverage' : 'none' },
    policy: { externalInstructions: 'never-authority', robots: 'separate-advisory-policy', modelCalls: 0, networkCalls: 0 },
  };
}

/** Stable prompt metadata excludes timestamps, job identity and local artifact paths,
 * so deterministic review does not invalidate exact-content cache reuse. */
export function sourceReviewPrompt(report: SourceReviewReport): string {
  return JSON.stringify({ reviewer: report.reviewer.id, fingerprint: report.fingerprint, status: report.status,
    coverage: report.coverage, omittedSources: report.omittedSources,
    findings: report.sources.flatMap(source => source.findings.map(finding => ({ sourceId: source.sourceId, ...finding }))),
    policy: report.policy });
}

export interface PublicSourceReadPolicyInput {
  requestedUrl: string; finalUrl?: string; redirects?: string[]; httpStatus: number;
  robots: 'allow' | 'disallow' | 'unknown';
  /** Must come from the owner's configuration, never from downloaded source text. */
  ownerOverride?: { authorizedBy: 'owner'; exactUrl: string; authorizationId: string };
}
export interface PublicSourceReadDecision {
  allowed: boolean; reason: 'allowed' | 'owner-advisory-override' | 'invalid-public-url' | 'redirect-scope-changed'
    | 'access-denied' | 'robots-review-required' | 'invalid-owner-override';
  sourceFingerprint: string | null; authorizationId?: string; advisoryRobotsIgnored: boolean; networkDispatched: false;
}
function publicUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 8192 || /[\x00-\x20\\]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443' || isIP(host.replace(/^\[|\]$/g, ''))
      || !host.includes('.') || host === 'localhost' || /\.(?:localhost|local|internal|invalid|test)$/.test(host)) return null;
    url.hash = '';
    return url;
  } catch { return null; }
}

/** Policy-only gate for a future/explicit public reader. Does not fetch, follow a
 * redirect, read robots.txt, resolve DNS, bypass authentication, or grant tools.
 * A transport must separately reject private/reserved resolved IPs and enforce
 * its allowed destination. GitHub's fixed API reader does not use this gate.
 */
export function evaluatePublicSourceReadPolicy(input: PublicSourceReadPolicyInput): PublicSourceReadDecision {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { allowed: false, reason: 'invalid-public-url', sourceFingerprint: null, advisoryRobotsIgnored: false, networkDispatched: false };
  const requested = publicUrl(input.requestedUrl);
  const result = (allowed: boolean, reason: PublicSourceReadDecision['reason'], override = false): PublicSourceReadDecision => ({
    allowed, reason, sourceFingerprint: requested ? sha(requested.href) : null, advisoryRobotsIgnored: override, networkDispatched: false,
    ...(override && input.ownerOverride ? { authorizationId: input.ownerOverride.authorizationId } : {}),
  });
  if (!requested) return result(false, 'invalid-public-url');
  if (input.redirects !== undefined && (!Array.isArray(input.redirects) || input.redirects.length > 10)) return result(false, 'redirect-scope-changed');
  const urls = [...(input.redirects ?? []), input.finalUrl ?? requested.href];
  for (const raw of urls) {
    const next = publicUrl(raw);
    if (!next) return result(false, 'invalid-public-url');
    if (next.origin !== requested.origin) return result(false, 'redirect-scope-changed');
  }
  if (!Number.isInteger(input.httpStatus) || input.httpStatus < 200 || input.httpStatus >= 300) return result(false, 'access-denied');
  if (input.robots === 'allow') return result(true, 'allowed');
  if (input.robots !== 'disallow' && input.robots !== 'unknown') return result(false, 'robots-review-required');
  const override = input.ownerOverride;
  if (!override) return result(false, 'robots-review-required');
  const authorized = publicUrl(override.exactUrl);
  if (override.authorizedBy !== 'owner' || !authorized || authorized.href !== requested.href
    || id(override.authorizationId, '') !== override.authorizationId || !override.authorizationId
    || urls.some(raw => publicUrl(raw)?.href !== authorized.href)) return result(false, 'invalid-owner-override');
  return result(true, 'owner-advisory-override', true);
}
