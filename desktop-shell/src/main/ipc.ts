import { ipcMain, dialog, type IpcMainInvokeEvent } from 'electron';
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
import { CredentialVault, isApiProvider, isCredentialProvider } from './vault';
import { importCredentialFromFile } from './credentialImport';
import { listProviderModels } from './providers';
import { detectOllama } from './ollama';
import { ProjectRunner, ProjectStore } from './projects';
import { isTrustedLocalSender, UntrustedSenderError } from './senderGuard';
import { CompanyService } from './company';
import { OfficeService } from './office';
import type { OfficeWorkerController } from './officeWorker';

export interface IpcContext {
  windowManager: WindowManager;
  jobManager: JobManager;
  settings: SettingsStore;
  vault: CredentialVault;
  projectStore: ProjectStore;
  projectRunner: ProjectRunner;
  companyService: CompanyService;
  officeService: OfficeService;
  officeWorker: OfficeWorkerController;
  catalogPath: string;
  userDataPath: string;
  openPersonalDashboard?: () => Promise<{ ok: boolean; url?: string; error?: string }>;
}

type Handler = (event: IpcMainInvokeEvent, ...args: any[]) => unknown;

/**
 * Register all desktopBridge IPC handlers. Every handler validates its
 * inputs again in the main process — the renderer is never trusted.
 */
export function registerIpc(ctx: IpcContext): Map<string, (...args: unknown[]) => unknown> {
  const browserHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const originalHandlers = new WeakMap<Handler, Handler>();
  function register(channel: string, handler: Handler): void {
    ipcMain.handle(channel, handler);
    const name = Object.entries(CHANNELS).find(([, value]) => value === channel)?.[0];
    const original = originalHandlers.get(handler);
    if (name && original) browserHandlers.set(name, (...args) => original(undefined as never, ...args));
  }
  const { windowManager, jobManager, settings, vault, projectStore, projectRunner, companyService, officeService, officeWorker, catalogPath, userDataPath } = ctx;
  const modelsRoot = path.join(userDataPath, 'models');

  /**
   * Strict sender validation: only the shell window's own local file://
   * chrome page may invoke ANY bridge method. Remote pages have no preload;
   * this is defense in depth on top of that.
   */
  function guard(handler: Handler): Handler {
    const protectedHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      const wc = windowManager.window.isDestroyed() ? null : windowManager.window.webContents;
      if (!isTrustedLocalSender(event, wc)) throw new UntrustedSenderError();
      return handler(event, ...args);
    };
    originalHandlers.set(protectedHandler, handler);
    return protectedHandler;
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

  register(CHANNELS.getSystemInfo, guard(() => getSystemInfo(userDataPath)));

  register(CHANNELS.companySnapshot, guard(() => companyService.companySnapshot()));
  register(CHANNELS.registerCompany, guard((_event, request) => companyService.registerCompany(request)));
  register(CHANNELS.refreshCompany, guard(() => companyService.refreshCompany()));
  register(CHANNELS.updateCompanyTask, guard((_event, request) => companyService.updateCompanyTask(request)));
  register(CHANNELS.indexCompanyRepository, guard(() => companyService.indexCompanyRepository()));
  register(CHANNELS.officeSnapshot, guard(() => officeService.officeSnapshot()));
  register(CHANNELS.officeCommand, guard((_event, request) => officeService.officeCommand(request)));
  register(CHANNELS.officeWorkerStatus, guard(() => officeWorker.status()));
  register(CHANNELS.setOfficeWorker, guard((_event, request: unknown) => {
    if (!request || typeof request !== 'object' || typeof (request as { enabled?: unknown }).enabled !== 'boolean') {
      throw new Error('Worker enabled must be a boolean');
    }
    return officeWorker.setEnabled((request as { enabled: boolean }).enabled);
  }));
  register(CHANNELS.runOfficeQueue, guard(() => officeWorker.runOnce()));

  register(CHANNELS.getModelCatalog, guard(() => loadCatalog(catalogPath)));

  register(CHANNELS.checkModelRequirements, guard(async (_event, modelId: unknown) => {
    if (typeof modelId !== 'string') throw new Error('modelId must be a string');
    const catalog = loadCatalog(catalogPath);
    const model = findModel(catalog, modelId);
    if (!model) throw new Error(`Unknown or rejected model id: ${modelId}`);
    const sys = await getSystemInfo(userDataPath);
    return checkModelRequirements(model, sys);
  }));

  register(CHANNELS.createVenv, guard(async (_event, req: CreateVenvRequest): Promise<CreateVenvResult> => {
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

  register(CHANNELS.downloadModel, guard(async (_event, req: DownloadModelRequest) => {
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

  register(CHANNELS.getJobStatus, guard((_event, jobId?: unknown) => {
    return jobManager.list(typeof jobId === 'string' ? jobId : undefined);
  }));

  register(CHANNELS.cancelJob, guard((_event, jobId: unknown) => {
    if (typeof jobId !== 'string') return { ok: false, error: 'jobId must be a string' };
    return jobManager.cancel(jobId);
  }));

  register(CHANNELS.openOfflineAtlas, guard(() => windowManager.openOfflineAtlas()));

  register(CHANNELS.connectRuntime, guard(async (_event, rawUrl: unknown): Promise<ConnectRuntimeResult> => {
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

  register(CHANNELS.backToLauncher, guard(() => {
    windowManager.backToLauncher();
    return { ok: true };
  }));

  register(CHANNELS.getSettings, guard(() => settings.get()));

  register(CHANNELS.openExternal, guard((_event, rawUrl: unknown) => {
    if (typeof rawUrl !== 'string') return { ok: false, error: 'url must be a string' };
    return openExternalUrl(rawUrl);
  }));

  // ------------------------------------------------------------------ vault
  // Key material enters via setApiKey and is NEVER returned by any handler:
  // status exposes configured/readable booleans + timestamps only.

  register(CHANNELS.getVaultStatus, guard(() => vault.status()));

  register(CHANNELS.setApiKey, guard((_event, provider: unknown, key: unknown) => {
    if (!isCredentialProvider(provider)) return { ok: false, error: 'unknown provider' };
    if (typeof key !== 'string') return { ok: false, error: 'key must be a string' };
    return vault.setKey(provider, key);
  }));

  register(CHANNELS.revokeApiKey, guard((_event, provider: unknown) => {
    if (!isCredentialProvider(provider)) return { ok: false, error: 'unknown provider' };
    return vault.revoke(provider);
  }));

  register(CHANNELS.importCredentialFile, guard(async (_event, provider: unknown) => {
    if (!isCredentialProvider(provider)) return { ok: false, error: 'Unknown credential provider.' };
    if (!vault.encryptionAvailable()) return { ok: false, error: 'Unlock an OS-backed keychain before importing a credential.' };
    const selection = await dialog.showOpenDialog(windowManager.window, {
      title: `Import ${provider} credential`, properties: ['openFile', 'dontAddToRecent'],
      filters: [{ name: 'Credential file', extensions: ['txt', 'json', 'env', 'key'] }, { name: 'All files', extensions: ['*'] }],
    });
    if (selection.canceled || selection.filePaths.length !== 1) return { ok: false, cancelled: true };
    return importCredentialFromFile(selection.filePaths[0]!, provider, vault);
  }));

  // -------------------------------------------------------------- providers

  register(CHANNELS.listProviderModels, guard(async (_event, provider: unknown) => {
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

  register(CHANNELS.detectOllama, guard(() => detectOllama()));

  // --------------------------------------------------------------- projects

  register(CHANNELS.listProjects, guard(() => projectStore.listProjects()));

  register(CHANNELS.createProject, guard((_event, req: unknown) => {
    try {
      return { ok: true, project: projectStore.createProject(req as never) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  register(CHANNELS.getProject, guard((_event, projectId: unknown) => {
    if (typeof projectId !== 'string') return null;
    try {
      return projectStore.getProject(projectId);
    } catch {
      return null;
    }
  }));

  register(CHANNELS.startRun, guard((_event, req: unknown) => {
    if (typeof req !== 'object' || req === null) return { ok: false, error: 'request must be an object' };
    const r = req as { projectId?: unknown; runBudget?: unknown; priceRates?: unknown };
    if (typeof r.projectId !== 'string') return { ok: false, error: 'projectId must be a string' };
    return projectRunner.start(r.projectId, r.runBudget, r.priceRates);
  }));

  register(CHANNELS.pauseRun, guard((_event, runId: unknown) => {
    if (typeof runId !== 'string') return { ok: false, error: 'runId must be a string' };
    return projectRunner.pause(runId);
  }));

  register(CHANNELS.resumeRun, guard((_event, runId: unknown) => {
    if (typeof runId !== 'string') return { ok: false, error: 'runId must be a string' };
    return projectRunner.resume(runId);
  }));

  register(CHANNELS.cancelRun, guard((_event, runId: unknown) => {
    if (typeof runId !== 'string') return { ok: false, error: 'runId must be a string' };
    return projectRunner.cancel(runId);
  }));

  register(CHANNELS.listRuns, guard((_event, projectId: unknown) => {
    return projectStore.listRuns(typeof projectId === 'string' ? projectId : undefined);
  }));

  register(CHANNELS.readArtifact, guard((_event, projectId: unknown, runId: unknown, nodeId: unknown) => {
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
  register(CHANNELS.openPersonalDashboard, guard(() => ctx.openPersonalDashboard?.() ?? {ok:false,error:'Personal dashboard unavailable.'}));
  return browserHandlers;
}
