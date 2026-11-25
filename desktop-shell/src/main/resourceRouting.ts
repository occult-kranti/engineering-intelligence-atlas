/** Dependency-free selector shared by native and hosted Donna. The catalog and
 * its SHA-256 MUST come from the build-validated snapshot or the native loader.
 * No network/filesystem/model calls, no permissions and no source-content reads.
 * recordSha256 identifies the original source metadata; catalogSha256 also covers
 * review annotations, routing and the full catalog revision. */
export const RESOURCE_LIMITS = Object.freeze({ catalogBytes: 1024 * 1024, records: 800, routes: 64, assignedSkills: 20, references: 6, packetBytes: 8192 });
export const RESOURCE_LEGACY_FIELDS = ['domain', 'name', 'type', 'level', 'url', 'purpose', 'prereqs', 'access', 'license', 'caveat', 'verified'] as const;
type LegacyField = typeof RESOURCE_LEGACY_FIELDS[number];
export type LegacyResource = Record<LegacyField, string>;
type ResourceKind = 'book' | 'paper' | 'repository' | 'tool' | 'model' | 'documentation' | 'standard' | 'course' | 'collection';
type UseMode = 'study' | 'apply-guidance' | 'evaluate' | 'discover';
interface ResourceReview {
  status: 'reference-only' | 'metadata-reviewed' | 'source-excerpt-reviewed';
  verifiedAt: string | null;
  readingDepth: 'not-read' | 'metadata-only' | 'metadata-and-abstract' | 'selected-sections' | 'package-source-and-offline-tests';
  evidenceBasis: string;
}
export interface ResourceRecord extends LegacyResource {
  id: string;
  kind: ResourceKind;
  skillIds: string[];
  review: ResourceReview;
  provenance: { version: string | null; sourcePath: string; sourceRecordSha256: string };
  use: { mode: UseMode; software: string[]; capabilityHints: string[] };
}
export interface ResourceRoute {
  skill: string; roleKeys: string[]; purpose: string; resourceIds: string[];
  localReferences: string[];
}
export interface ResourceCatalog {
  schemaVersion: 1;
  catalogVersion: string;
  source: { path: string; fileSha256: string; importedAt: string; recordCount: number };
  policy: { publicMetadataOnly: true; fullTextIncluded: false; automaticFetch: false; capabilityGrants: false; costStatus: 'not-estimated' };
  collections: Array<{ name: string; path: string; compiledAt: string; coverage: string; evidenceNote: string }>;
  resources: ResourceRecord[];
  routes: ResourceRoute[];
}
export interface ResourceQuery {
  /** Exact skill names or repository skills/<name>/SKILL.md paths. */
  skills?: string[];
  roleKey?: string;
  query?: string;
  maxReferences?: number;
  maxBytes?: number;
}
export interface SelectedResource {
  id: string; title: string; kind: ResourceKind; url: string; purpose: string;
  useMode: UseMode; access: string; license: string; caveat: string;
  version: string | null; verifiedAt: string | null; legacyVerifiedLabel: string;
  review: ResourceReview; readingStatus: 'not-read-by-router';
  recordSha256: string; reasons: string[];
  software: string[]; capabilityHints: string[];
}
export interface ResourcePacket {
  schemaVersion: 1;
  status: 'ready' | 'no-match' | 'bounded-empty' | 'catalog-unavailable' | 'invalid-query';
  catalogVersion: string | null;
  catalogSha256: string | null;
  matchedSkillCount: number;
  omittedCount: number;
  excludedCount: number;
  byteLimit: number;
  localReferences: string[];
  references: SelectedResource[];
  policy: 'public-reference-metadata; sources-not-read; no-full-text; no-permissions; no-fetch; no-spend';
}
const KEY = /^[a-z][a-z0-9-]{0,79}$/;
const STOP = new Set('a an and are as at be by can create for from how in into is it make of on or our the this to use using with your build improve project task review please'.split(' '));
const encoder = new TextEncoder();
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function strings(v: unknown, max: number, valid: (s: string) => boolean): v is string[] {
  return Array.isArray(v) && v.length <= max && v.every(s => typeof s === 'string' && valid(s)) && new Set(v).size === v.length;
}
export function emptyResourcePacket(status: ResourcePacket['status'], byteLimit: number = RESOURCE_LIMITS.packetBytes): ResourcePacket {
  return { schemaVersion: 1, status, catalogVersion: null, catalogSha256: null, matchedSkillCount: 0, omittedCount: 0,
    excludedCount: 0, byteLimit, localReferences: [], references: [],
    policy: 'public-reference-metadata; sources-not-read; no-full-text; no-permissions; no-fetch; no-spend' };
}
function skillName(v: string): string | null {
  if (KEY.test(v)) return v;
  const match = /^skills\/([a-z][a-z0-9-]{0,79})(?:\/SKILL\.md|\/)?$/.exec(v);
  return match?.[1] ?? null;
}
export function validResourceQuery(q: unknown): q is ResourceQuery {
  if (!object(q) || Object.keys(q).some(k => !['skills', 'roleKey', 'query', 'maxReferences', 'maxBytes'].includes(k))) return false;
  return (q.skills === undefined || strings(q.skills, RESOURCE_LIMITS.assignedSkills, s => skillName(s) !== null))
    && (q.roleKey === undefined || typeof q.roleKey === 'string' && KEY.test(q.roleKey))
    && (q.query === undefined || typeof q.query === 'string' && q.query.length <= 4000)
    && (q.maxReferences === undefined || Number.isInteger(q.maxReferences) && Number(q.maxReferences) >= 0 && Number(q.maxReferences) <= RESOURCE_LIMITS.references)
    && (q.maxBytes === undefined || Number.isInteger(q.maxBytes) && Number(q.maxBytes) >= 1024 && Number(q.maxBytes) <= RESOURCE_LIMITS.packetBytes);
}
function terms(text: string): string[] {
  return [...new Set((text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_.+-]*/gu) ?? [])
    .filter(t => t.length >= 2 && t.length <= 48 && !STOP.has(t)))].slice(0, 32);
}
const bytes = (packet: ResourcePacket): number => encoder.encode(JSON.stringify(packet)).byteLength;

/** Pure deterministic selection. Rights, capabilities and software are advisory
 * labels. All selected text stays data; no referenced content has been read. */
export function selectResourceReferences(catalog: ResourceCatalog, catalogSha256: string, query: ResourceQuery = {}): ResourcePacket {
  if (!validResourceQuery(query)) return emptyResourcePacket('invalid-query');
  if (!catalog || !Array.isArray(catalog.resources) || !Array.isArray(catalog.routes)
    || !/^[a-f0-9]{64}$/.test(catalogSha256)) return emptyResourcePacket('catalog-unavailable', query.maxBytes);
  const packet = emptyResourcePacket('no-match', query.maxBytes);
  packet.catalogVersion = catalog.catalogVersion; packet.catalogSha256 = catalogSha256;
  const skills = new Set((query.skills ?? []).map(s => skillName(s)!));
  const selectedRoutes = catalog.routes.filter(r => skills.has(r.skill) || !!query.roleKey && r.roleKeys.includes(query.roleKey))
    .sort((a, b) => compare(a.skill, b.skill));
  packet.matchedSkillCount = selectedRoutes.length;
  for (const ref of [...new Set(selectedRoutes.flatMap(r => r.localReferences))].sort(compare).slice(0, 2)) {
    packet.localReferences.push(ref);
    if (bytes(packet) > packet.byteLimit) packet.localReferences.pop();
  }
  const tokens = terms(query.query ?? '');
  const candidates = catalog.resources.flatMap(r => {
    const mapped = selectedRoutes.filter(route => r.skillIds.includes(route.skill));
    const title = new Set(terms(r.name)), domain = new Set(terms(r.domain)), purpose = new Set(terms(r.purpose));
    const matched = tokens.filter(t => title.has(t) || domain.has(t) || purpose.has(t));
    if (!mapped.length && !matched.length) return [];
    if (!r.url.startsWith('https://')) { packet.excludedCount++; return []; }
    const score = mapped.reduce((max, route) => Math.max(max, route.resourceIds.includes(r.id)
      ? 24 + route.resourceIds.length - route.resourceIds.indexOf(r.id) : 8), 0)
      + matched.reduce((n, token) => n + (title.has(token) ? 12 : 0) + (domain.has(token) ? 8 : 0) + (purpose.has(token) ? 4 : 0), 0);
    const reasons = mapped.slice(0, 2).map(route => `mapped:${route.skill}`);
    if (matched.length) reasons.push(`task:${matched.slice(0, 4).join(',')}`);
    return [{ record: r, score, reasons }];
  }).sort((a, b) => b.score - a.score || compare(a.record.id, b.record.id));
  const limit = query.maxReferences ?? RESOURCE_LIMITS.references;
  packet.omittedCount = candidates.length;
  for (const candidate of candidates) {
    if (packet.references.length >= limit) break;
    const r = candidate.record;
    const item: SelectedResource = { id: r.id, title: r.name, kind: r.kind, url: r.url, purpose: r.purpose, useMode: r.use.mode,
      access: r.access, license: r.license, caveat: r.caveat, version: r.provenance.version, verifiedAt: r.review.verifiedAt,
      legacyVerifiedLabel: r.verified, review: r.review, readingStatus: 'not-read-by-router',
      recordSha256: r.provenance.sourceRecordSha256, reasons: candidate.reasons,
      software: r.use.software, capabilityHints: r.use.capabilityHints };
    packet.references.push(item); packet.omittedCount--;
    if (bytes(packet) > packet.byteLimit) { packet.references.pop(); packet.omittedCount++; }
  }
  packet.status = packet.references.length ? 'ready' : candidates.length ? 'bounded-empty' : 'no-match';
  return packet;
}

