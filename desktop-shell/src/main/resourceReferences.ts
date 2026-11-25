import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

/** Public metadata only. Selection never reads a referenced file, fetches a URL,
 * installs software, spends money, or grants a capability. The same implementation
 * is used by the offline CLI and the native worker. */
import { RESOURCE_LIMITS, RESOURCE_LEGACY_FIELDS, selectResourceReferences, validResourceQuery, emptyResourcePacket, type ResourceCatalog, type ResourceQuery, type ResourcePacket, type ResourceRecord, type LegacyResource } from './resourceRouting';
export type { ResourceCatalog, ResourceQuery, ResourcePacket, ResourceRecord } from './resourceRouting';
export { RESOURCE_LIMITS, RESOURCE_LEGACY_FIELDS } from './resourceRouting';
const KEY = /^[a-z][a-z0-9-]{0,79}$/;
const HASH = /^[a-f0-9]{64}$/;
const RECORD_ID = /^resource-[a-f0-9]{16}$/;
const KINDS = new Set(['book', 'paper', 'repository', 'tool', 'model', 'documentation', 'standard', 'course', 'collection']);
const MODES = new Set(['study', 'apply-guidance', 'evaluate', 'discover']);
const REVIEW_STATUSES = new Set(['reference-only', 'metadata-reviewed', 'source-excerpt-reviewed']);
const READING_DEPTHS = new Set(['not-read', 'metadata-only', 'metadata-and-abstract', 'selected-sections', 'package-source-and-offline-tests']);
const HIDDEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;
const SECRET = /(?:^|[^A-Za-z0-9_-])(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{8,}/;
const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function keys(v: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(v).length === expected.length && expected.every(k => Object.hasOwn(v, k));
}
function text(v: unknown, max = 1000): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max && !HIDDEN.test(v) && !SECRET.test(v);
}
function strings(v: unknown, max: number, valid: (s: string) => boolean): v is string[] {
  return Array.isArray(v) && v.length <= max && v.every(s => typeof s === 'string' && valid(s)) && new Set(v).size === v.length;
}
function date(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const parsed = new Date(v + 'T00:00:00.000Z');
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === v;
}
function publicPath(v: unknown): v is string {
  return text(v, 240) && /^(?:company\/role-library|reports|data|skills|projects|scientific-research-library|site-source\/src\/data)\//.test(v)
    && !v.includes('\\') && v.split('/').every(s => s !== '' && s !== '.' && s !== '..')
    && !/[?#:%]/.test(v);
}
/** HTTP is retained for the four original legacy records, but never selected.
 * Literal/local hosts, credentials, query strings and fragments are rejected.
 * This is a metadata check, not DNS validation or permission to fetch. */
function publicUrl(v: unknown): v is string {
  if (!text(v, 2048) || /\s/.test(v)) return false;
  try {
    const u = new URL(v);
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password && !u.search && !u.hash && !u.port
      && u.hostname.includes('.') && !isIP(u.hostname.replace(/^\[|\]$/g, ''))
      && !/(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(u.hostname)
      && !u.hostname.endsWith('.') && !u.hostname.includes('%');
  } catch { return false; }
}
export function resourceId(url: string): string { return `resource-${sha(url).slice(0, 16)}`; }
export function legacyResource(record: LegacyResource): LegacyResource {
  return Object.fromEntries(RESOURCE_LEGACY_FIELDS.map(key => [key, record[key]])) as LegacyResource;
}
export function resourceSourceHash(record: LegacyResource): string {
  return sha(JSON.stringify(RESOURCE_LEGACY_FIELDS.map(key => [key, record[key]])));
}

/** Reject the whole invalid catalog rather than silently dropping bad records or
 * allowing a broken route to look complete. Unknown fields cannot smuggle grants
 * or private content into this public schema. */
export function validateResourceCatalog(value: unknown): ResourceCatalog | null {
  try {
    if (!object(value) || Buffer.byteLength(JSON.stringify(value)) > RESOURCE_LIMITS.catalogBytes
      || !keys(value, ['schemaVersion', 'catalogVersion', 'source', 'policy', 'collections', 'resources', 'routes'])
      || value.schemaVersion !== 1 || !text(value.catalogVersion, 80)) return null;
    const source = value.source, policy = value.policy;
    if (!object(source) || !keys(source, ['path', 'fileSha256', 'importedAt', 'recordCount'])
      || !publicPath(source.path) || typeof source.fileSha256 !== 'string' || !HASH.test(source.fileSha256)
      || !date(source.importedAt) || !Number.isInteger(source.recordCount) || Number(source.recordCount) < 1
      || Number(source.recordCount) > RESOURCE_LIMITS.records) return null;
    if (!object(policy) || !keys(policy, ['publicMetadataOnly', 'fullTextIncluded', 'automaticFetch', 'capabilityGrants', 'costStatus'])
      || policy.publicMetadataOnly !== true || policy.fullTextIncluded !== false || policy.automaticFetch !== false
      || policy.capabilityGrants !== false || policy.costStatus !== 'not-estimated') return null;
    if (!Array.isArray(value.collections) || value.collections.length > 20 || value.collections.some(c => !object(c)
      || !keys(c, ['name', 'path', 'compiledAt', 'coverage', 'evidenceNote']) || !text(c.name, 160)
      || !publicPath(c.path) || !date(c.compiledAt) || !text(c.coverage, 300) || !text(c.evidenceNote, 500))) return null;
    if (!Array.isArray(value.resources) || !value.resources.length || value.resources.length > RESOURCE_LIMITS.records
      || value.resources.length < Number(source.recordCount) || !Array.isArray(value.routes)
      || !value.routes.length || value.routes.length > RESOURCE_LIMITS.routes) return null;
    const ids = new Set<string>(), urls = new Set<string>();
    for (const r of value.resources) {
      if (!object(r) || !keys(r, [...RESOURCE_LEGACY_FIELDS, 'id', 'kind', 'skillIds', 'review', 'provenance', 'use'])
        || !RESOURCE_LEGACY_FIELDS.every(k => text(r[k], k === 'url' ? 2048 : 500))
        || !publicUrl(r.url) || typeof r.id !== 'string' || !RECORD_ID.test(r.id)
        || r.id !== resourceId(r.url) || ids.has(r.id) || urls.has(r.url)
        || typeof r.kind !== 'string' || !KINDS.has(r.kind)
        || !strings(r.skillIds, 16, s => KEY.test(s)) || !r.skillIds.length) return null;
      const provenance = r.provenance, review = r.review, use = r.use;
      if (!object(provenance) || !keys(provenance, ['version', 'sourcePath', 'sourceRecordSha256'])
        || !publicPath(provenance.sourcePath) || (provenance.version !== null && !text(provenance.version, 160))
        || provenance.sourceRecordSha256 !== resourceSourceHash(r as unknown as LegacyResource)) return null;
      if (!object(review) || !keys(review, ['status', 'verifiedAt', 'readingDepth', 'evidenceBasis'])
        || typeof review.status !== 'string' || !REVIEW_STATUSES.has(review.status)
        || typeof review.readingDepth !== 'string' || !READING_DEPTHS.has(review.readingDepth)
        || !text(review.evidenceBasis, 700)) return null;
      if (review.status === 'reference-only'
        ? review.verifiedAt !== null || review.readingDepth !== 'not-read'
        : !date(review.verifiedAt) || review.readingDepth === 'not-read') return null;
      if (!object(use) || !keys(use, ['mode', 'software', 'capabilityHints'])
        || typeof use.mode !== 'string' || !MODES.has(use.mode)
        || !strings(use.software, 8, s => text(s, 100))
        || !strings(use.capabilityHints, 8, s => /^[a-z][a-z0-9_.-]{0,79}$/.test(s))) return null;
      ids.add(r.id); urls.add(r.url);
    }
    const skills = new Set<string>();
    for (const r of value.routes) {
      if (!object(r) || !keys(r, ['skill', 'roleKeys', 'purpose', 'resourceIds', 'localReferences'])
        || typeof r.skill !== 'string' || !KEY.test(r.skill) || skills.has(r.skill) || !text(r.purpose, 300)
        || !strings(r.roleKeys, 16, s => KEY.test(s))
        || !strings(r.resourceIds, 24, s => ids.has(s)) || !r.resourceIds.length
        || !strings(r.localReferences, 4, s => publicPath(s))) return null;
      skills.add(r.skill);
    }
    const rows = value.resources as ResourceRecord[];
    if (rows.some(r => r.skillIds.some(s => !skills.has(s)))) return null;
    if (value.routes.some(route => route.resourceIds.some((id: string) =>
      !rows.find(r => r.id === id)?.skillIds.includes(route.skill)))) return null;
    return value as unknown as ResourceCatalog;
  } catch { return null; }
}

export function catalogHash(catalog: ResourceCatalog): string {
  // Input JSON formatting and unrelated record order are not model context.
  const records = [...catalog.resources].sort((a, b) => compare(a.id, b.id)).map(r => ({ ...legacyResource(r), id: r.id, kind: r.kind,
    skillIds: [...r.skillIds].sort(compare),
    review: [r.review.status, r.review.verifiedAt, r.review.readingDepth, r.review.evidenceBasis],
    provenance: [r.provenance.version, r.provenance.sourcePath, r.provenance.sourceRecordSha256],
    use: { mode: r.use.mode, software: r.use.software, capabilityHints: r.use.capabilityHints } }));
  const routes = [...catalog.routes].sort((a, b) => compare(a.skill, b.skill)).map(r => [r.skill, [...r.roleKeys].sort(compare), r.purpose, r.resourceIds, r.localReferences]);
  return sha(JSON.stringify([catalog.schemaVersion, catalog.catalogVersion, catalog.source.path, catalog.source.fileSha256,
    catalog.source.importedAt, catalog.source.recordCount, catalog.collections.map(c => [c.name, c.path, c.compiledAt, c.coverage, c.evidenceNote]), records, routes]));
}
/** Validate an untrusted catalog before using the shared pure selector. */
export function routeResources(rawCatalog: unknown, query: ResourceQuery = {}): ResourcePacket {
  if (!validResourceQuery(query)) return emptyResourcePacket('invalid-query');
  const catalog = validateResourceCatalog(rawCatalog);
  return catalog ? selectResourceReferences(catalog, catalogHash(catalog), query)
    : emptyResourcePacket('catalog-unavailable', query.maxBytes);
}

/** Reads only the packaged public catalog, with a fixed size cap and no symlink
 * traversal. A missing/damaged catalog produces explicit empty context, so existing
 * jobs do not acquire access or silently use an unrelated fallback. */
export function readResourceCatalog(seedDir: string): ResourceCatalog | null {
  let fd: number | null = null;
  try {
    if (!text(seedDir, 4096)) return null;
    const realSeed = fs.realpathSync(seedDir), folder = path.join(realSeed, 'role-library');
    const folderStat = fs.lstatSync(folder);
    if (!folderStat.isDirectory() || folderStat.isSymbolicLink()) return null;
    const file = path.join(folder, 'resource-catalog.json'), stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > RESOURCE_LIMITS.catalogBytes) return null;
    const relative = path.relative(realSeed, fs.realpathSync(file));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size > RESOURCE_LIMITS.catalogBytes) return null;
    const buffer = Buffer.alloc(RESOURCE_LIMITS.catalogBytes + 1);
    let size = 0, read = 0;
    do { read = fs.readSync(fd, buffer, size, buffer.length - size, null); size += read; } while (read && size < buffer.length);
    if (size > RESOURCE_LIMITS.catalogBytes) return null;
    return validateResourceCatalog(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size))));
  } catch { return null; }
  finally { if (fd !== null) fs.closeSync(fd); }
}
export function loadResourceReferences(seedDir: string, query: ResourceQuery = {}): ResourcePacket {
  if (!validResourceQuery(query)) return emptyResourcePacket('invalid-query');
  return routeResources(readResourceCatalog(seedDir), query);
}
