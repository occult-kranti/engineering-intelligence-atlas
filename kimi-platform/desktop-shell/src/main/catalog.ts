import fs from 'node:fs';
import type {
  CatalogFile,
  CatalogModel,
  CatalogResult,
  RequirementReport,
  SystemInfo,
} from '../shared/contract';
import { isSafeRepoFilePath } from './paths';

/**
 * Hugging Face repo IDs: `owner/name`, conservative character set.
 * No spaces, no traversal, no scheme/host trickery.
 */
const REPO_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
/** Pinned git commit SHA-1 (full 40 hex chars). Moving refs are not accepted. */
const COMMIT_SHA_RE = /^[0-9a-f]{40}$/;
/** LFS SHA-256 published by the HF API. */
const SHA256_RE = /^[0-9a-f]{64}$/;

const AVAILABILITIES = new Set(['available', 'unavailable', 'quarantined']);

export function isValidRepoId(repoId: string): boolean {
  return REPO_ID_RE.test(repoId) && !repoId.includes('..');
}

export function isPinnedRevision(revision: string): boolean {
  return COMMIT_SHA_RE.test(revision);
}

function validateFiles(raw: unknown, errors: string[]): CatalogFile[] {
  if (!Array.isArray(raw)) {
    errors.push('files must be an array');
    return [];
  }
  const files: CatalogFile[] = [];
  for (const f of raw) {
    const file = f as Record<string, unknown>;
    const path = typeof file?.path === 'string' ? file.path : '';
    if (!isSafeRepoFilePath(path)) {
      errors.push(`files[]: unsafe or missing path ${JSON.stringify(file?.path)}`);
      continue;
    }
    if (!Number.isSafeInteger(file.sizeBytes) || (file.sizeBytes as number) < 0) {
      errors.push(`files[] ${path}: sizeBytes must be a non-negative integer`);
      continue;
    }
    if (file.sha256 !== null && (typeof file.sha256 !== 'string' || !SHA256_RE.test(file.sha256))) {
      errors.push(`files[] ${path}: sha256 must be 64 lowercase hex chars or null`);
      continue;
    }
    files.push({ path, sizeBytes: file.sizeBytes as number, sha256: file.sha256 as string | null });
  }
  return files;
}

/**
 * Validate a single catalog entry. Returns a list of problems; an empty list
 * means the entry is usable. Safety invariants enforced here:
 *  - revision is a pinned 40-hex commit SHA (no moving refs);
 *  - availability is explicit; anything not 'available' carries a note;
 *  - remoteCodeRequired models MUST be 'quarantined' (never downloadable);
 *  - 'available' models must declare remoteCodeRequired === false and an
 *    exact reviewed file set whose sizes sum to sizeBytes.
 */
export function validateCatalogEntry(raw: unknown): { model?: CatalogModel; errors: string[] } {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { errors: ['entry is not an object'] };
  }
  const m = raw as Record<string, unknown>;

  const id = typeof m.id === 'string' ? m.id : '';
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) errors.push('id missing or invalid');

  for (const field of ['family', 'task', 'format', 'license', 'runtime'] as const) {
    if (typeof m[field] !== 'string' || (m[field] as string).trim() === '') {
      errors.push(`${field} missing or invalid`);
    }
  }
  for (const field of ['name', 'licenseUrl', 'sizeScope', 'notes', 'availabilityNote'] as const) {
    if (m[field] !== undefined && typeof m[field] !== 'string') errors.push(`${field} must be a string`);
  }

  const repoId = typeof m.repoId === 'string' ? m.repoId : '';
  if (!isValidRepoId(repoId)) errors.push('repoId missing or not a valid Hugging Face repo id');

  const revision = typeof m.revision === 'string' ? m.revision : '';
  if (!isPinnedRevision(revision)) {
    errors.push('revision must be a pinned 40-hex commit SHA (moving refs are not allowed)');
  }

  if (typeof m.quantization !== 'string' && m.quantization !== null) {
    errors.push('quantization must be a string or null');
  }

  if (!Number.isSafeInteger(m.sizeBytes) || (m.sizeBytes as number) <= 0) {
    errors.push('sizeBytes must be a positive integer');
  }
  const minRamBytes =
    m.minRamBytes === null
      ? null
      : Number.isSafeInteger(m.minRamBytes) && (m.minRamBytes as number) >= 0
        ? (m.minRamBytes as number)
        : undefined;
  if (minRamBytes === undefined) errors.push('minRamBytes must be a non-negative integer or null');
  const minVramBytes =
    m.minVramBytes === null
      ? null
      : Number.isSafeInteger(m.minVramBytes) && (m.minVramBytes as number) >= 0
        ? (m.minVramBytes as number)
        : undefined;
  if (minVramBytes === undefined) errors.push('minVramBytes must be a non-negative integer or null');

  const sourceUrl = typeof m.sourceUrl === 'string' ? m.sourceUrl : '';
  try {
    const u = new URL(sourceUrl);
    if (u.protocol !== 'https:') errors.push('sourceUrl must use https:');
  } catch {
    errors.push('sourceUrl is not a valid URL');
  }
  if (typeof m.licenseUrl === 'string') {
    try {
      const u = new URL(m.licenseUrl);
      if (u.protocol !== 'https:') errors.push('licenseUrl must use https:');
    } catch {
      errors.push('licenseUrl is not a valid URL');
    }
  }

  if (typeof m.remoteCodeRequired !== 'boolean') {
    errors.push('remoteCodeRequired must be a boolean');
  }

  const availability = typeof m.availability === 'string' ? m.availability : '';
  if (!AVAILABILITIES.has(availability)) {
    errors.push('availability must be one of: available, unavailable, quarantined');
  }

  // Cross-field safety rules.
  if (m.remoteCodeRequired === true && availability !== 'quarantined') {
    errors.push('models with remoteCodeRequired=true MUST be quarantined (download/run disabled)');
  }
  if (availability === 'available' && m.remoteCodeRequired !== false) {
    errors.push('available models must declare remoteCodeRequired=false');
  }
  if ((availability === 'unavailable' || availability === 'quarantined') && !m.availabilityNote) {
    errors.push('availabilityNote is required when availability is not "available"');
  }

  const files = validateFiles(m.files, errors);
  if (availability === 'available') {
    if (files.length === 0) errors.push('available models must declare a non-empty reviewed files[] set');
    const sum = files.reduce((acc, f) => acc + f.sizeBytes, 0);
    if (files.length > 0 && Number.isSafeInteger(m.sizeBytes) && sum !== (m.sizeBytes as number)) {
      errors.push(`sizeBytes (${String(m.sizeBytes)}) does not equal the sum of files[] (${sum})`);
    }
  }

  if (errors.length > 0) return { errors };
  return {
    model: {
      id,
      family: m.family as string,
      task: m.task as string,
      ...(typeof m.name === 'string' ? { name: m.name } : {}),
      repoId,
      revision,
      format: m.format as string,
      quantization: (m.quantization as string | null) ?? null,
      sizeBytes: m.sizeBytes as number,
      ...(typeof m.sizeScope === 'string' ? { sizeScope: m.sizeScope } : {}),
      files,
      minRamBytes: minRamBytes ?? null,
      minVramBytes: minVramBytes ?? null,
      license: m.license as string,
      ...(typeof m.licenseUrl === 'string' ? { licenseUrl: m.licenseUrl } : {}),
      sourceUrl,
      runtime: m.runtime as string,
      remoteCodeRequired: m.remoteCodeRequired as boolean,
      availability: availability as CatalogModel['availability'],
      ...(typeof m.availabilityNote === 'string' ? { availabilityNote: m.availabilityNote } : {}),
      ...(typeof m.notes === 'string' ? { notes: m.notes } : {}),
    },
    errors: [],
  };
}

/**
 * Load and validate the reviewed model catalog. Invalid entries are excluded
 * and reported; a missing or malformed catalog yields an empty result rather
 * than a crash.
 */
export function loadCatalog(catalogPath: string): CatalogResult {
  const rejected: { id: string; errors: string[] }[] = [];
  const models: CatalogModel[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } catch (err) {
    rejected.push({
      id: '(catalog)',
      errors: [`catalog unreadable: ${err instanceof Error ? err.message : String(err)}`],
    });
    return { models, rejected, catalogPath };
  }
  const list = (parsed as { models?: unknown })?.models;
  if (!Array.isArray(list)) {
    rejected.push({ id: '(catalog)', errors: ['catalog has no "models" array'] });
    return { models, rejected, catalogPath };
  }
  const seen = new Set<string>();
  for (const entry of list) {
    const { model, errors } = validateCatalogEntry(entry);
    const entryId =
      typeof (entry as { id?: unknown })?.id === 'string'
        ? ((entry as { id: string }).id ?? '(unknown)')
        : '(unknown)';
    if (errors.length > 0 || !model) {
      rejected.push({ id: entryId, errors });
      continue;
    }
    if (seen.has(model.id)) {
      rejected.push({ id: model.id, errors: ['duplicate model id'] });
      continue;
    }
    seen.add(model.id);
    models.push(model);
  }
  return { models, rejected, catalogPath };
}

export function findModel(catalog: CatalogResult, modelId: string): CatalogModel | undefined {
  return catalog.models.find((m) => m.id === modelId);
}

/**
 * Download gate, applied in the main process even if the catalog file was
 * tampered with after validation. Only 'available', remote-code-free models
 * from the reviewed catalog may be downloaded.
 */
export function assertModelDownloadable(model: CatalogModel): void {
  if (model.availability !== 'available') {
    throw new Error(
      `Model "${model.id}" is ${model.availability}: ${model.availabilityNote ?? 'not downloadable'}`,
    );
  }
  if (model.remoteCodeRequired !== false) {
    throw new Error(`Model "${model.id}" requires remote code and is blocked.`);
  }
}

function check(
  requiredBytes: number | null,
  availableBytes: number | null,
  label: string,
): RequirementReport['checks']['ram'] {
  if (requiredBytes === null) {
    return {
      status: 'unknown',
      requiredBytes: null,
      availableBytes,
      message: `${label}: no declared requirement (not derivable); cannot verify.`,
    };
  }
  if (availableBytes === null) {
    return {
      status: 'unknown',
      requiredBytes,
      availableBytes: null,
      message: `${label}: requires ${requiredBytes} bytes, but available amount could not be measured.`,
    };
  }
  const ok = availableBytes >= requiredBytes;
  return {
    status: ok ? 'pass' : 'fail',
    requiredBytes,
    availableBytes,
    message: ok
      ? `${label}: ${availableBytes} bytes available (requires ${requiredBytes}).`
      : `${label}: only ${availableBytes} bytes available, requires ${requiredBytes}.`,
  };
}

/**
 * Compare declared model requirements against measured system state before a
 * download. Unknowns are reported as 'unknown', never silently passed.
 */
export function checkModelRequirements(model: CatalogModel, sys: SystemInfo): RequirementReport {
  const ram = check(model.minRamBytes, sys.freeRamBytes, 'RAM');
  const disk = check(model.sizeBytes, sys.disk.freeBytes, 'Disk');

  let vram: RequirementReport['checks']['vram'];
  if (model.minVramBytes === null) {
    vram = {
      status: 'unknown',
      requiredBytes: null,
      availableBytes: null,
      message: 'VRAM: no declared requirement (not derivable); cannot verify.',
    };
  } else {
    const best = sys.gpus.reduce<number | null>((acc, g) => {
      if (g.vramTotalBytes === null) return acc;
      return acc === null ? g.vramTotalBytes : Math.max(acc, g.vramTotalBytes);
    }, null);
    vram = check(model.minVramBytes, best, 'VRAM');
  }

  const checks = { ram, disk, vram };
  const failures = Object.values(checks).filter((c) => c.status === 'fail');
  const unknowns = Object.values(checks).filter((c) => c.status === 'unknown');
  const summary =
    failures.length > 0
      ? `Not eligible: ${failures.map((f) => f.message).join(' ')}`
      : unknowns.length > 0
        ? `Eligible with unknowns: ${unknowns.map((u) => u.message).join(' ')}`
        : 'All declared requirements are met.';
  return { modelId: model.id, checks, canDownload: failures.length === 0, summary };
}
