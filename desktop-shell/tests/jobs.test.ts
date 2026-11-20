import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JobManager } from '../src/main/jobs';

function tmpLogDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dshell-jobs-'));
}

describe('JobManager', () => {
  it('tracks lifecycle: pending -> running -> succeeded', () => {
    const jm = new JobManager();
    const { job } = jm.createJob('download-model', 'org/model@rev');
    jm.update(job.id, { status: 'running', progress: 0.5 });
    jm.finish(job.id, 'succeeded');
    const [final] = jm.list(job.id);
    expect(final?.status).toBe('succeeded');
    expect(final?.progress).toBe(0.5);
  });

  it('cancels a running job via its abort signal', () => {
    const jm = new JobManager();
    const { job, signal } = jm.createJob('download-model', 'x');
    jm.update(job.id, { status: 'running' });
    expect(jm.cancel(job.id).ok).toBe(true);
    expect(signal.aborted).toBe(true);
    jm.finish(job.id, 'cancelled');
    expect(jm.list(job.id)[0]?.status).toBe('cancelled');
  });

  it('refuses to cancel finished jobs', () => {
    const jm = new JobManager();
    const { job } = jm.createJob('create-venv', 'v');
    jm.finish(job.id, 'failed', 'boom');
    expect(jm.cancel(job.id).ok).toBe(false);
  });

  it('emits job events', () => {
    const jm = new JobManager();
    const seen: string[] = [];
    jm.on('job', (j) => seen.push(j.status));
    const { job } = jm.createJob('create-venv', 'v');
    jm.update(job.id, { status: 'running' });
    jm.finish(job.id, 'succeeded');
    expect(seen).toEqual(['pending', 'running', 'succeeded']);
  });

  it('writes an append-only JSONL log with whitelisted fields only', () => {
    const dir = tmpLogDir();
    const jm = new JobManager(dir);
    const { job } = jm.createJob('download-model', 'detail text');
    jm.update(job.id, { status: 'running', progress: 0.25 });
    jm.finish(job.id, 'failed', 'some error');
    const lines = fs
      .readFileSync(path.join(dir, 'jobs.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(lines.length).toBe(3);
    const allowed = new Set(['ts', 'jobId', 'kind', 'event', 'status', 'progress', 'detail', 'error']);
    for (const line of lines) {
      for (const key of Object.keys(line)) {
        expect(allowed.has(key)).toBe(true);
      }
    }
    expect(lines[2]?.status).toBe('failed');
    expect(lines[2]?.error).toBe('some error');
  });
});
