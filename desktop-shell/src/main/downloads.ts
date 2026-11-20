import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { CatalogModel } from '../shared/contract';
import { isSafeRepoFilePath, resolveContainedPath } from './paths';

/**
 * Hugging Face downloads over fixed official URLs.
 *
 * - File content: https://huggingface.co/<repo>/resolve/<revision>/<path>
 * - The revision is always the pinned commit SHA from the reviewed catalog.
 * - The file set is the exact reviewed set declared in the catalog (no live
 *   tree listing is trusted at download time).
 * - Every downloaded file's byte size is verified against the catalog; when
 *   the catalog carries the HF-published LFS SHA-256, content is verified.
 * - Redirects are followed manually and every redirect host must be in
 *   ALLOWED_REDIRECT_HOSTS. No downloaded artifact is ever executed.
 */

export class DownloadCancelledError extends Error {
  constructor() {
    super('Download cancelled');
    this.name = 'DownloadCancelledError';
  }
}

export class DownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DownloadError';
  }
}

const ALLOWED_REDIRECT_HOSTS = new Set([
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.huggingface.co',
  'cdn-lfs-eu-1.huggingface.co',
  'cdn-lfs.hf.co',
  'cas-bridge.xethub.hf.co',
  'cas-bridge-us-1.xethub.hf.co',
  'cas-bridge-eu-1.xethub.hf.co',
  'transfer.xethub.hf.co',
]);

/** Only these hosts may serve model bytes (directly or via redirect). */
export function isAllowedDownloadHost(hostname: string): boolean {
  return ALLOWED_REDIRECT_HOSTS.has(hostname.toLowerCase());
}

/** Minimal structural type so tests can inject a fake fetch. */
export interface FetchResponseLike {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  body: unknown;
  json(): Promise<unknown>;
}
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; redirect?: 'manual' | 'follow'; signal?: AbortSignal },
) => Promise<FetchResponseLike>;

function encodePathSegments(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}

export function buildResolveUrl(repoId: string, revision: string, filePath: string): string {
  if (!isSafeRepoFilePath(filePath)) {
    throw new DownloadError(`Refusing unsafe repo file path: ${JSON.stringify(filePath)}`);
  }
  return `https://huggingface.co/${encodePathSegments(repoId)}/resolve/${encodeURIComponent(
    revision,
  )}/${encodePathSegments(filePath)}`;
}

/**
 * Follow up to `maxRedirects` redirects manually, validating that every hop
 * stays on https: and on an allow-listed host.
 */
export async function fetchFollowingRedirects(
  fetchFn: FetchLike,
  url: string,
  init: { headers?: Record<string, string>; signal?: AbortSignal } = {},
  maxRedirects = 5,
): Promise<FetchResponseLike> {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetchFn(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new DownloadError(`Redirect without Location header (HTTP ${res.status})`);
      const next = new URL(location, current);
      if (next.protocol !== 'https:') {
        throw new DownloadError(`Refusing non-HTTPS redirect to ${next.origin}`);
      }
      if (!isAllowedDownloadHost(next.hostname)) {
        throw new DownloadError(`Refusing redirect to non-allow-listed host ${next.hostname}`);
      }
      current = next.toString();
      continue;
    }
    return res;
  }
  throw new DownloadError(`Too many redirects (>${maxRedirects})`);
}

export interface DownloadFileOptions {
  fetchFn: FetchLike;
  url: string;
  destPath: string;
  signal?: AbortSignal;
  /** Expected byte size from the reviewed catalog; verified after download. */
  expectedSizeBytes?: number;
  /** HF-published LFS SHA-256; verified when present (null = not published). */
  expectedSha256?: string | null;
  onProgress?: (bytesDone: number, bytesTotal: number | null) => void;
}

export interface DownloadFileResult {
  bytes: number;
  sha256: string;
  /** True when the catalog published a hash and content matched it. */
  hashVerified: boolean;
}

async function bodyToNodeStream(body: unknown): Promise<NodeJS.ReadableStream> {
  if (body == null) throw new DownloadError('Empty response body');
  if (typeof (body as { getReader?: unknown }).getReader === 'function') {
    return Readable.fromWeb(body as import('node:stream/web').ReadableStream);
  }
  if (typeof (body as { pipe?: unknown }).pipe === 'function') {
    return body as NodeJS.ReadableStream;
  }
  if (Symbol.asyncIterator in Object(body)) {
    return Readable.from(body as AsyncIterable<Uint8Array>);
  }
  throw new DownloadError('Unsupported response body type');
}

async function hashFile(filePath: string, hash: crypto.Hash): Promise<void> {
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
}

/**
 * Download one file with resume support. A `<dest>.part` file holds partial
 * content; an existing .part is resumed with a Range request. On completion
 * the size (always) and SHA-256 (when published) are verified, then the
 * .part file is atomically renamed to the final path.
 */
export async function downloadFile(options: DownloadFileOptions): Promise<DownloadFileResult> {
  const { fetchFn, url, destPath, signal, onProgress } = options;
  const partPath = `${destPath}.part`;
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  // A finished file is never re-downloaded.
  if (fs.existsSync(destPath)) {
    const existing = fs.statSync(destPath).size;
    if (options.expectedSizeBytes !== undefined && existing === options.expectedSizeBytes) {
      const hash = crypto.createHash('sha256');
      await hashFile(destPath, hash);
      const digest = hash.digest('hex');
      if (options.expectedSha256 && digest !== options.expectedSha256) {
        fs.rmSync(destPath);
        throw new DownloadError(`SHA-256 mismatch on existing file ${path.basename(destPath)}; removed.`);
      }
      onProgress?.(existing, existing);
      return { bytes: existing, sha256: digest, hashVerified: options.expectedSha256 != null };
    }
    fs.rmSync(destPath); // stale/incomplete final file: restart cleanly
  }

  let resumed = 0;
  if (fs.existsSync(partPath)) {
    resumed = fs.statSync(partPath).size;
    // A .part that already exceeds the expected size is corrupt: restart.
    if (options.expectedSizeBytes !== undefined && resumed > options.expectedSizeBytes) {
      fs.rmSync(partPath);
      resumed = 0;
    }
  }

  const headers: Record<string, string> = {};
  if (resumed > 0) headers.Range = `bytes=${resumed}-`;

  const res = await fetchFollowingRedirects(fetchFn, url, { headers, signal });
  if (res.status === 416 && resumed > 0) {
    // Range not satisfiable: the .part is at least complete; finalize below.
  } else if (!res.ok && res.status !== 206) {
    throw new DownloadError(`Download failed (HTTP ${res.status}) for ${url}`);
  }

  const hash = crypto.createHash('sha256');
  let written = resumed;
  if (res.status !== 416) {
    // If the server ignored our Range request, restart from scratch.
    let append = resumed > 0 && res.status === 206;
    if (resumed > 0 && res.status === 200) {
      resumed = 0;
      written = 0;
      append = false;
    }
    if (append) {
      // Seed the hash with the previously downloaded prefix.
      await hashFile(partPath, hash);
    }

    const contentLength = Number(res.headers.get('content-length') ?? '');
    const bytesTotal =
      Number.isFinite(contentLength) && contentLength > 0 ? contentLength + resumed : null;

    const reader = await bodyToNodeStream(res.body);
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        if (signal?.aborted) {
          cb(new DownloadCancelledError());
          return;
        }
        written += chunk.length;
        hash.update(chunk);
        onProgress?.(written, bytesTotal);
        cb(null, chunk);
      },
    });

    try {
      await pipeline(reader, counter, fs.createWriteStream(partPath, { flags: append ? 'a' : 'w' }));
    } catch (err) {
      if (signal?.aborted || err instanceof DownloadCancelledError) {
        throw new DownloadCancelledError();
      }
      throw err;
    }
  } else {
    await hashFile(partPath, hash);
  }

  // Verify before finalizing.
  if (options.expectedSizeBytes !== undefined && written !== options.expectedSizeBytes) {
    throw new DownloadError(
      `Size mismatch for ${path.basename(destPath)}: got ${written}, expected ${options.expectedSizeBytes}. Partial file kept as .part.`,
    );
  }
  const digest = hash.digest('hex');
  if (options.expectedSha256 && digest !== options.expectedSha256) {
    fs.rmSync(partPath, { force: true });
    throw new DownloadError(`SHA-256 mismatch for ${path.basename(destPath)}; downloaded data discarded.`);
  }
  fs.renameSync(partPath, destPath);
  return { bytes: written, sha256: digest, hashVerified: options.expectedSha256 != null };
}

export interface DownloadModelOptions {
  fetchFn: FetchLike;
  model: CatalogModel;
  /** Directory under userData/models; containment is enforced. */
  modelsRoot: string;
  signal?: AbortSignal;
  onProgress?: (fraction: number | null, detail: string) => void;
}

/**
 * Download the exact reviewed file set of the pinned revision into
 * `<modelsRoot>/<repoId>/<revision>/...`. Returns the local directory and a
 * per-file verification record.
 */
export async function downloadModelFiles(options: DownloadModelOptions): Promise<{
  dir: string;
  bytes: number;
  files: { path: string; bytes: number; hashVerified: boolean }[];
}> {
  const { fetchFn, model, modelsRoot, signal, onProgress } = options;
  if (model.files.length === 0) {
    throw new DownloadError('Model has no reviewed file set; refusing to enumerate the repository live.');
  }
  const modelDir = resolveContainedPath(modelsRoot, path.join(model.repoId, model.revision));
  const totalBytes = model.sizeBytes;
  let completedBytes = 0;
  let fileIndex = 0;
  const results: { path: string; bytes: number; hashVerified: boolean }[] = [];

  for (const file of model.files) {
    if (signal?.aborted) throw new DownloadCancelledError();
    fileIndex += 1;
    const dest = resolveContainedPath(modelDir, file.path);
    const url = buildResolveUrl(model.repoId, model.revision, file.path);
    const result = await downloadFile({
      fetchFn,
      url,
      destPath: dest,
      signal,
      expectedSizeBytes: file.sizeBytes,
      expectedSha256: file.sha256,
      onProgress: (fileBytes) => {
        const done = completedBytes + fileBytes;
        onProgress?.(
          totalBytes > 0 ? Math.min(1, done / totalBytes) : null,
          `file ${fileIndex}/${model.files.length}: ${file.path}`,
        );
      },
    });
    completedBytes += result.bytes;
    results.push({ path: file.path, bytes: result.bytes, hashVerified: result.hashVerified });
  }
  onProgress?.(1, 'complete');
  return { dir: modelDir, bytes: completedBytes, files: results };
}
