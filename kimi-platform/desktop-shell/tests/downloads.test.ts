import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  buildResolveUrl,
  downloadFile,
  downloadModelFiles,
  DownloadCancelledError,
  DownloadError,
  fetchFollowingRedirects,
  isAllowedDownloadHost,
  type FetchLike,
  type FetchResponseLike,
} from '../src/main/downloads';
import type { CatalogModel } from '../src/shared/contract';

const enc = (s: string) => new TextEncoder().encode(s);
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

function streamBody(content: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      c.enqueue(enc(content));
      c.close();
    },
  });
}

function slowBody(chunks: string[], signal?: AbortSignal): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(c) {
      for (const ch of chunks) {
        if (signal?.aborted) {
          c.error(new Error('aborted'));
          return;
        }
        c.enqueue(enc(ch));
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, 10);
          signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(t);
              reject(new Error('aborted'));
            },
            { once: true },
          );
        });
      }
      c.close();
    },
  });
}

function makeResponse(
  status: number,
  opts: { body?: unknown; headers?: Record<string, string> } = {},
): FetchResponseLike {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (n: string) => {
        const found = Object.entries(opts.headers ?? {}).find(
          ([k]) => k.toLowerCase() === n.toLowerCase(),
        );
        return found ? found[1] : null;
      },
    },
    body: opts.body ?? null,
    json: async () => JSON.parse('null'),
  };
}

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dshell-dl-'));
}

describe('buildResolveUrl', () => {
  it('builds fixed official HF resolve URLs with pinned revision', () => {
    expect(buildResolveUrl('Qwen/Qwen3-8B-GGUF', 'a'.repeat(40), 'Qwen3-8B-Q4_K_M.gguf')).toBe(
      `https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/${'a'.repeat(40)}/Qwen3-8B-Q4_K_M.gguf`,
    );
  });

  it('rejects path traversal in file paths', () => {
    for (const p of ['../x', 'a/../../x', '/abs', 'a\\b', '']) {
      expect(() => buildResolveUrl('org/model', 'a'.repeat(40), p)).toThrow(DownloadError);
    }
  });
});

describe('isAllowedDownloadHost', () => {
  it('allows HF hosts', () => {
    for (const h of ['huggingface.co', 'cdn-lfs.huggingface.co', 'cdn-lfs-us-1.huggingface.co', 'cas-bridge.xethub.hf.co']) {
      expect(isAllowedDownloadHost(h)).toBe(true);
    }
  });
  it('rejects everything else', () => {
    for (const h of ['evil.com', 'huggingface.co.evil.com', 'hf-mirror.com', 'notcdn-lfs.hf.co', '']) {
      expect(isAllowedDownloadHost(h)).toBe(false);
    }
  });
});

describe('fetchFollowingRedirects', () => {
  it('follows redirects to allow-listed CDN hosts', async () => {
    const fetchFn: FetchLike = async (url) => {
      if (url === 'https://huggingface.co/a') {
        return makeResponse(302, { headers: { location: 'https://cdn-lfs.huggingface.co/b' } });
      }
      return makeResponse(200, { body: streamBody('x') });
    };
    const res = await fetchFollowingRedirects(fetchFn, 'https://huggingface.co/a');
    expect(res.status).toBe(200);
  });

  it('refuses redirects to non-allow-listed hosts', async () => {
    const fetchFn: FetchLike = async () =>
      makeResponse(302, { headers: { location: 'https://evil.example.com/steal' } });
    await expect(fetchFollowingRedirects(fetchFn, 'https://huggingface.co/a')).rejects.toThrow(
      /non-allow-listed/,
    );
  });

  it('refuses http redirects', async () => {
    const fetchFn: FetchLike = async () =>
      makeResponse(302, { headers: { location: 'http://cdn-lfs.huggingface.co/b' } });
    await expect(fetchFollowingRedirects(fetchFn, 'https://huggingface.co/a')).rejects.toThrow(
      /non-HTTPS/,
    );
  });

  it('caps redirect chains', async () => {
    const fetchFn: FetchLike = async () =>
      makeResponse(302, { headers: { location: 'https://huggingface.co/loop' } });
    await expect(fetchFollowingRedirects(fetchFn, 'https://huggingface.co/a')).rejects.toThrow(
      /Too many redirects/,
    );
  });
});

describe('downloadFile', () => {
  it('downloads, verifies size and SHA-256, and renames .part', async () => {
    const dir = tmpdir();
    const dest = path.join(dir, 'm.bin');
    const fetchFn: FetchLike = async () =>
      makeResponse(200, { body: streamBody('hello world'), headers: { 'content-length': '11' } });
    const res = await downloadFile({
      fetchFn,
      url: 'https://huggingface.co/org/model/resolve/rev/m.bin',
      destPath: dest,
      expectedSizeBytes: 11,
      expectedSha256: sha256('hello world'),
    });
    expect(res.hashVerified).toBe(true);
    expect(fs.readFileSync(dest, 'utf8')).toBe('hello world');
    expect(fs.existsSync(`${dest}.part`)).toBe(false);
  });

  it('fails on size mismatch and keeps the partial for debugging', async () => {
    const dir = tmpdir();
    const dest = path.join(dir, 'm.bin');
    const fetchFn: FetchLike = async () => makeResponse(200, { body: streamBody('short') });
    await expect(
      downloadFile({ fetchFn, url: 'https://x', destPath: dest, expectedSizeBytes: 999 }),
    ).rejects.toThrow(/Size mismatch/);
    expect(fs.existsSync(dest)).toBe(false);
    expect(fs.existsSync(`${dest}.part`)).toBe(true);
  });

  it('fails on SHA-256 mismatch and discards the data', async () => {
    const dir = tmpdir();
    const dest = path.join(dir, 'm.bin');
    const fetchFn: FetchLike = async () => makeResponse(200, { body: streamBody('tampered!!') });
    await expect(
      downloadFile({
        fetchFn,
        url: 'https://x',
        destPath: dest,
        expectedSizeBytes: 10,
        expectedSha256: sha256('good bytes'),
      }),
    ).rejects.toThrow(/SHA-256 mismatch/);
    expect(fs.existsSync(dest)).toBe(false);
    expect(fs.existsSync(`${dest}.part`)).toBe(false);
  });

  it('resumes an existing .part with a Range request', async () => {
    const dir = tmpdir();
    const dest = path.join(dir, 'm.bin');
    fs.writeFileSync(`${dest}.part`, 'hel');
    let seenRange: string | null = null;
    const fetchFn: FetchLike = async (_url, init) => {
      seenRange = init?.headers?.Range ?? null;
      return makeResponse(206, { body: streamBody('lo') });
    };
    const res = await downloadFile({
      fetchFn,
      url: 'https://x',
      destPath: dest,
      expectedSizeBytes: 5,
      expectedSha256: sha256('hello'),
    });
    expect(seenRange).toBe('bytes=3-');
    expect(res.bytes).toBe(5);
    expect(fs.readFileSync(dest, 'utf8')).toBe('hello');
  });

  it('restarts when the server ignores Range (200 instead of 206)', async () => {
    const dir = tmpdir();
    const dest = path.join(dir, 'm.bin');
    fs.writeFileSync(`${dest}.part`, 'STALE');
    const fetchFn: FetchLike = async () => makeResponse(200, { body: streamBody('fresh') });
    const res = await downloadFile({
      fetchFn,
      url: 'https://x',
      destPath: dest,
      expectedSizeBytes: 5,
      expectedSha256: sha256('fresh'),
    });
    expect(res.bytes).toBe(5);
    expect(fs.readFileSync(dest, 'utf8')).toBe('fresh');
  });

  it('supports cancellation mid-stream and keeps .part for resume', async () => {
    const dir = tmpdir();
    const dest = path.join(dir, 'm.bin');
    const controller = new AbortController();
    const fetchFn: FetchLike = async (_url, init) =>
      makeResponse(200, {
        body: slowBody(['chunk1', 'chunk2', 'chunk3', 'chunk4'], init?.signal ?? controller.signal),
      });
    const promise = downloadFile({
      fetchFn,
      url: 'https://x',
      destPath: dest,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });
    await expect(promise).rejects.toThrow(DownloadCancelledError);
    expect(fs.existsSync(dest)).toBe(false);
    expect(fs.existsSync(`${dest}.part`)).toBe(true);
  });
});

describe('downloadModelFiles', () => {
  const rev = 'b'.repeat(40);
  const fileA = 'weights-a.bin';
  const contentA = 'AAAA';
  const contentB = 'BB';
  const model: CatalogModel = {
    id: 'two-file',
    family: 't',
    task: 'text-generation',
    repoId: 'org/model',
    revision: rev,
    format: 'GGUF',
    quantization: null,
    sizeBytes: contentA.length + contentB.length,
    files: [
      { path: fileA, sizeBytes: contentA.length, sha256: sha256(contentA) },
      { path: 'sub/dir/config.json', sizeBytes: contentB.length, sha256: null },
    ],
    minRamBytes: null,
    minVramBytes: null,
    license: 'mit',
    sourceUrl: 'https://huggingface.co/org/model',
    runtime: 'llama.cpp',
    remoteCodeRequired: false,
    availability: 'available',
  };

  it('downloads the exact reviewed file set via pinned resolve URLs', async () => {
    const root = tmpdir();
    const requested: string[] = [];
    const fetchFn: FetchLike = async (url) => {
      requested.push(url);
      if (url.endsWith(fileA)) return makeResponse(200, { body: streamBody(contentA) });
      if (url.endsWith('config.json')) return makeResponse(200, { body: streamBody(contentB) });
      return makeResponse(404);
    };
    const progress: (number | null)[] = [];
    const res = await downloadModelFiles({
      fetchFn,
      model,
      modelsRoot: root,
      onProgress: (f) => progress.push(f),
    });
    expect(requested).toEqual([
      `https://huggingface.co/org/model/resolve/${rev}/${fileA}`,
      `https://huggingface.co/org/model/resolve/${rev}/sub/dir/config.json`,
    ]);
    expect(res.bytes).toBe(6);
    expect(res.files).toEqual([
      { path: fileA, bytes: 4, hashVerified: true },
      { path: 'sub/dir/config.json', bytes: 2, hashVerified: false },
    ]);
    const base = path.join(root, 'org/model', rev);
    expect(fs.readFileSync(path.join(base, fileA), 'utf8')).toBe(contentA);
    expect(fs.readFileSync(path.join(base, 'sub/dir/config.json'), 'utf8')).toBe(contentB);
    expect(progress.at(-1)).toBe(1);
  });

  it('refuses models without a reviewed file set', async () => {
    const fetchFn: FetchLike = async () => makeResponse(404);
    await expect(
      downloadModelFiles({ fetchFn, model: { ...model, files: [] }, modelsRoot: tmpdir() }),
    ).rejects.toThrow(/no reviewed file set/);
  });

  it('cancels between files', async () => {
    const controller = new AbortController();
    const fetchFn: FetchLike = async (url) => {
      if (url.endsWith(fileA)) return makeResponse(200, { body: streamBody(contentA) });
      return makeResponse(200, { body: streamBody(contentB) });
    };
    await expect(
      downloadModelFiles({
        fetchFn,
        model,
        modelsRoot: tmpdir(),
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
    ).rejects.toThrow(DownloadCancelledError);
  });
});
