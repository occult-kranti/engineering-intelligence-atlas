import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { JobKind, JobRecord, JobStatus } from '../shared/contract';

/**
 * Job manager with an append-only JSONL event log.
 *
 * The log is written from an explicit whitelist of fields only, so tokens,
 * URLs with credentials, or any other caller-supplied payload can never leak
 * into it.
 */
export class JobManager extends EventEmitter {
  private jobs = new Map<string, JobRecord>();
  private controllers = new Map<string, AbortController>();
  private readonly logPath: string | null;

  constructor(logDir?: string) {
    super();
    if (logDir) {
      fs.mkdirSync(logDir, { recursive: true });
      this.logPath = path.join(logDir, 'jobs.jsonl');
    } else {
      this.logPath = null;
    }
  }

  createJob(kind: JobKind, detail: string): { job: JobRecord; signal: AbortSignal } {
    const now = new Date().toISOString();
    const job: JobRecord = {
      id: crypto.randomUUID(),
      kind,
      status: 'pending',
      progress: null,
      detail,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    this.appendLog({ ts: now, jobId: job.id, kind, event: 'created', detail });
    this.emitChanged(job);
    return { job, signal: controller.signal };
  }

  update(jobId: string, patch: { status?: JobStatus; progress?: number | null; detail?: string }): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (patch.status !== undefined) job.status = patch.status;
    if (patch.progress !== undefined) job.progress = patch.progress;
    if (patch.detail !== undefined) job.detail = patch.detail;
    job.updatedAt = new Date().toISOString();
    this.appendLog({
      ts: job.updatedAt,
      jobId: job.id,
      kind: job.kind,
      event: 'updated',
      status: job.status,
      progress: job.progress,
      detail: job.detail,
    });
    this.emitChanged(job);
  }

  finish(jobId: string, status: 'succeeded' | 'failed' | 'cancelled', error?: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = status;
    job.error = error ?? null;
    job.updatedAt = new Date().toISOString();
    this.appendLog({
      ts: job.updatedAt,
      jobId: job.id,
      kind: job.kind,
      event: 'finished',
      status,
      error: job.error,
    });
    this.controllers.delete(jobId);
    this.emitChanged(job);
  }

  cancel(jobId: string): { ok: boolean; error?: string } {
    const job = this.jobs.get(jobId);
    if (!job) return { ok: false, error: 'unknown job id' };
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      return { ok: false, error: `job already ${job.status}` };
    }
    const controller = this.controllers.get(jobId);
    if (controller) {
      controller.abort(new Error('cancelled by user'));
      return { ok: true };
    }
    // Job exists but has no live controller (e.g. pending bookkeeping):
    this.finish(jobId, 'cancelled');
    return { ok: true };
  }

  list(jobId?: string): JobRecord[] {
    if (jobId) {
      const job = this.jobs.get(jobId);
      return job ? [{ ...job }] : [];
    }
    return [...this.jobs.values()].map((j) => ({ ...j }));
  }

  private emitChanged(job: JobRecord): void {
    this.emit('job', { ...job });
  }

  private appendLog(entry: Record<string, unknown>): void {
    if (!this.logPath) return;
    // Whitelisted fields only — no secrets, ever.
    const safe = {
      ts: String(entry.ts ?? ''),
      jobId: String(entry.jobId ?? ''),
      kind: String(entry.kind ?? ''),
      event: String(entry.event ?? ''),
      ...(entry.status !== undefined ? { status: String(entry.status) } : {}),
      ...(entry.progress !== undefined && entry.progress !== null
        ? { progress: Number(entry.progress) }
        : {}),
      ...(entry.detail !== undefined ? { detail: String(entry.detail).slice(0, 500) } : {}),
      ...(entry.error !== undefined && entry.error !== null
        ? { error: String(entry.error).slice(0, 500) }
        : {}),
    };
    try {
      fs.appendFileSync(this.logPath, JSON.stringify(safe) + '\n', 'utf8');
    } catch {
      // Logging must never crash the job pipeline.
    }
  }
}
