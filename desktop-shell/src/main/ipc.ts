import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import {
  CHANNELS,
  type ConnectRuntimeResult,
  type CreateVenvRequest,
  type CreateVenvResult,
  type DownloadModelRequest,
  type JobRecord,
  type ProjectRun,
} from '../shared/contract';
import { normalizeRuntimeUrl } from './urlValidation';
import { getSystemInfo } from './systemInfo';
import { checkModelRequirements, findModel, loadCatalog, assertModelDownloadable } from './catalog';
import { downloadModelFiles, DownloadCancelledError, type FetchLike } from './downloads';
import { createVenv, VenvError } from './venv';
import { JobManager } from './jobs';
import { SettingsStore } from './settings';
import { openExternalUrl, WindowManager } from './windows';
import { CredentialVault, isApiProvider } from './vault';
import { listProviderModels } from './providers';
import { detectOllama } from './ollama';
import { ProjectRunner, ProjectStore } from './projects';
import { isTrustedLocalSender, UntrustedSenderError } from './senderGuard';

export interface IpcContext {
  windowManager: WindowManager;
  jobManager: JobManager;
  settings: SettingsStore;
  vault: CredentialVault;
  projectStore: ProjectStore;
  projectRunner: ProjectRunner;
  catalogPath: string;
  userDataPath: string;
}

type Handler = (event: IpcMainInvokeEvent, ...args: any[]) => unknown;

/**
 * Register all desktopBridge IPC handlers. Every handler validates its
 * inputs again in the main process — the renderer is never trusted.
 */
export function registerIpc(ctx: IpcContext): void {
  const { windowManager, jobManager, settings, vault, projectStore, projectRunner, catalogPath, userDataPath } = ctx;
  const modelsRoot = path.join(userDataPath, 'models');

  /**
   * Strict sender validation: only the shell window's own local file://
   * chrome page may invoke ANY bridge method. Remote pages have no preload;
   * this is defense in depth on top of that.
   */
  function guard(handler: Handler): Handler {
    return (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      const wc = windowManager.window.isDestroyed() ? null : windowManager.window.webContents;
      if (!isTrustedLocalSender(event, wc)) throw new UntrustedSenderError();
      return handler(event, ...args);
    };
  }

  jobManager.on('job', (job: JobRecord) => {
    const win = windowManager.window;
    if (!win.isDestroyed()) {
      win.webContents.send(CHANNELS.jobEvent, job);
    }
  });

  projectRunner.on('run', (run: ProjectRun) => {
    const win = windowManager.window;
    if (!win.isDestroyed()) {
      win.webContents.send(CHANNELS.projectEvent, run);
    }
  });

  ipcMain.handle(CHANNELS.getSystemInfo, guard(() => getSystemInfo(userDataPath)));

  ipcMain.handle(CHANNELS.getModelCatalog, guard(() => loadCatalog(catalogPath)));

  ipcMain.handle(CHANNELS.checkModelRequirements, guard(async (_event, modelId: unknown) => {
    if (typeof modelId !== 'string') throw new Error('modelId must be a string');
    const catalog = loadCatalog(catalogPath);
    const model = findModel(catalog, modelId);
    if (!model) throw new Error(`Unknown or rejected model id: ${modelId}`);
    const sys = await getSystemInfo(userDataPath);
    return checkModelRequirements(model, sys);
  }));

  ipcMain.handle(CHANNELS.createVenv, guard(async (_event, req: CreateVenvRequest): Promise<CreateVenvResult> => {
    try {
      if (req?.confirmed !== true) {
        throw new VenvError('Venv creation requires explicit user confirmation.');
      }
      const { job, signal } = jobManager.createJob('create-venv', `venv ${String(req?.name ?? '')}`);
      jobManager.update(job.id, { status: 'running' });
      try {
        const result = await createVenv(
          {
            userDataPath,
            onProgress: (detail) => jobManager.update(job.id, { detail }),
          },
          { name: String(req.name), confirmed: true, installHuggingFaceHub: req.installHuggingFaceHub === true },
        );
        if (signal.aborted) throw new Error('cancelled');
        jobManager.finish(job.id, 'succeeded');
        return { ok: true, path: result.path, pythonPath: result.pythonPath, jobId: job.id };
      } catch (err) {
        jobManager.finish(job.id, 'failed', err instanceof Error ? err.message : String(err));
        throw err;
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.downloadModel, guard(async (_event, req: DownloadModelRequest) => {
    try {
      if (req?.confirmed !== true) {
        return { ok: false, error: 'Download requires explicit user confirmation.' };
      }
      if (typeof req?.modelId !== 'string') {
        return { ok: false, error: 'modelId must be a string' };
      }
      const catalog = loadCatalog(catalogPath);
      const model = findModel(catalog, req.modelId);
      if (!model) return { ok: false, error: `Unknown or rejected model id: ${req.modelId}` };
      // Defense in depth: availability/remote-code rules are re-checked in the
      // main process even if the catalog file was tampered with after review.
      try {
        assertModelDownloadable(model);
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }

      const sys = await getSystemInfo(userDataPath);
      const report = checkModelRequirements(model, sys);
      if (!report.canDownload) {
        return { ok: false, error: `Requirements not met. ${report.summary}` };
      }

      const { job, signal } = jobManager.createJob('download-model', `${model.repoId}@${model.revision}`);
      jobManager.update(job.id, { status: 'running', progress: 0 });
      // Fire-and-forget: progress is reported through job events.
      void (async () => {
        try {
          const result = await downloadModelFiles({
            fetchFn: fetch as unknown as FetchLike,
            model,
            modelsRoot,
            signal,
            onProgress: (fraction, detail) => jobManager.update(job.id, { progress: fraction, detail }),
          });
          const unverified = result.files.filter((f) => !f.hashVerified).length;
          jobManager.update(job.id, {
            detail: `done: ${result.files.length} files, ${result.bytes} bytes -> ${result.dir}` +
              (unverified > 0 ? ` (${unverified} file(s) had no published SHA-256 to verify)` : ' (all files SHA-256 verified)'),
          });
          jobManager.finish(job.id, 'succeeded');
        } catch (err) {
          if (err instanceof DownloadCancelledError || signal.aborted) {
            jobManager.finish(job.id, 'cancelled');
          } else {
            jobManager.finish(job.id, 'failed', err instanceof Error ? err.message : String(err));
          }
        }
      })();
      return { ok: true, jobId: job.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.getJobStatus, guard((_event, jobId?: unknown) => {
    return jobManager.list(typeof jobId === 'string' ? jobId : undefined);
  }));

  ipcMain.handle(CHANNELS.cancelJob, guard((_event, jobId: unknown) => {
    if (typeof jobId !== 'string') return { ok: false, error: 'jobId must be a string' };
    return jobManager.cancel(jobId);
  }));

  ipcMain.handle(CHANNELS.openOfflineAtlas, guard(() => windowManager.openOfflineAtlas()));

  ipcMain.handle(CHANNELS.connectRuntime, guard(async (_event, rawUrl: unknown): Promise<ConnectRuntimeResult> => {
    if (typeof rawUrl !== 'string') return { ok: false, error: 'url must be a string' };
    try {
      const normalized = normalizeRuntimeUrl(rawUrl);
      const opened = await windowManager.openRuntime(normalized);
      if (!opened.ok) return opened;
      // Persist ONLY the non-secret URL after a successful connection.
      settings.setRuntimeUrl(normalized);
      return { ok: true, url: normalized };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.backToLauncher, guard(() => {
    windowManager.backToLauncher();
    return { ok: true };
  }));

  ipcMain.handle(CHANNELS.getSettings, guard(() => settings.get()));

  ipcMain.handle(CHANNELS.openExternal, guard((_event, rawUrl: unknown) => {
    if (typeof rawUrl !== 'string') return { ok: false, error: 'url must be a string' };
    return openExternalUrl(rawUrl);
  }));

  // ------------------------------------------------------------------ vault
  // Key material enters via setApiKey and is NEVER returned by any handler:
  // status exposes configured/readable booleans + timestamps only.

  ipcMain.handle(CHANNELS.getVaultStatus, guard(() => vault.status()));

  ipcMain.handle(CHANNELS.setApiKey, guard((_event, provider: unknown, key: unknown) => {
    if (!isApiProvider(provider)) return { ok: false, error: 'unknown provider' };
    if (typeof key !== 'string') return { ok: false, error: 'key must be a string' };
    return vault.setKey(provider, key);
  }));

  ipcMain.handle(CHANNELS.revokeApiKey, guard((_event, provider: unknown) => {
    if (!isApiProvider(provider)) return { ok: false, error: 'unknown provider' };
    return vault.revoke(provider);
  }));

  // -------------------------------------------------------------- providers

  ipcMain.handle(CHANNELS.listProviderModels, guard(async (_event, provider: unknown) => {
    try {
      if (provider === 'ollama') {
        const status = await detectOllama();
        return { ok: status.available, models: status.models, ...(status.error ? { error: status.error } : {}) };
      }
      if (!isApiProvider(provider)) return { ok: false, models: [], error: 'unknown provider' };
      const key = vault.getKey(provider);
      if (!key) {
        return { ok: false, models: [], error: `No usable ${provider} API key is configured.` };
      }
      const models = await listProviderModels(provider, key);
      return { ok: true, models };
    } catch (err) {
      return { ok: false, models: [], error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.detectOllama, guard(() => detectOllama()));

  // --------------------------------------------------------------- projects

  ipcMain.handle(CHANNELS.listProjects, guard(() => projectStore.listProjects()));

  ipcMain.handle(CHANNELS.createProject, guard((_event, req: unknown) => {
    try {
      return { ok: true, project: projectStore.createProject(req as never) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.getProject, guard((_event, projectId: unknown) => {
    if (typeof projectId !== 'string') return null;
    try {
      return projectStore.getProject(projectId);
    } catch {
      return null;
    }
  }));

  ipcMain.handle(CHANNELS.startRun, guard((_event, req: unknown) => {
    if (typeof req !== 'object' || req === null) return { ok: false, error: 'request must be an object' };
    const r = req as { projectId?: unknown; runBudget?: unknown; priceRates?: unknown };
    if (typeof r.projectId !== 'string') return { ok: false, error: 'projectId must be a string' };
    return projectRunner.start(r.projectId, r.runBudget, r.priceRates);
  }));

  ipcMain.handle(CHANNELS.pauseRun, guard((_event, runId: unknown) => {
    if (typeof runId !== 'string') return { ok: false, error: 'runId must be a string' };
    return projectRunner.pause(runId);
  }));

  ipcMain.handle(CHANNELS.resumeRun, guard((_event, runId: unknown) => {
    if (typeof runId !== 'string') return { ok: false, error: 'runId must be a string' };
    return projectRunner.resume(runId);
  }));

  ipcMain.handle(CHANNELS.cancelRun, guard((_event, runId: unknown) => {
    if (typeof runId !== 'string') return { ok: false, error: 'runId must be a string' };
    return projectRunner.cancel(runId);
  }));

  ipcMain.handle(CHANNELS.listRuns, guard((_event, projectId: unknown) => {
    return projectStore.listRuns(typeof projectId === 'string' ? projectId : undefined);
  }));

  ipcMain.handle(CHANNELS.readArtifact, guard((_event, projectId: unknown, runId: unknown, nodeId: unknown) => {
    try {
      if (typeof projectId !== 'string' || typeof runId !== 'string' || typeof nodeId !== 'string') {
        return { ok: false, error: 'projectId, runId and nodeId must be strings' };
      }
      const artifact = projectStore.readArtifact(projectId, runId, nodeId);
      if (!artifact) return { ok: false, error: 'artifact not found' };
      return { ok: true, text: artifact.text, meta: artifact.meta };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));
}
