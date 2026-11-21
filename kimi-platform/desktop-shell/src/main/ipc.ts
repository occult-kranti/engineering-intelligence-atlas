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
import { computeHirePreview, type SkillRegistry } from './skills';
import { decideHireApproval, requestHireApproval } from './hiring';
import { deriveOfficeSnapshot } from '../shared/office';
import { isTrustedLocalSender, UntrustedSenderError } from './senderGuard';
import type { ChatManager } from './chat';
import type { CompanionServer } from './companion';
import type { EnterpriseProgramRunner, EnterpriseRecord, EnterpriseStore } from './enterprises';
import type { AssistantScheduler, AssistantState, AssistantStore } from './assistant';
import type { AssistantStateDto } from '../shared/contract';

export interface IpcContext {
  windowManager: WindowManager;
  jobManager: JobManager;
  settings: SettingsStore;
  vault: CredentialVault;
  projectStore: ProjectStore;
  projectRunner: ProjectRunner;
  skills: { registry: SkillRegistry; root: string };
  chat: ChatManager;
  companion: CompanionServer;
  enterpriseStore: EnterpriseStore;
  enterpriseRunner: EnterpriseProgramRunner;
  assistantStore: AssistantStore;
  assistantScheduler: AssistantScheduler;
  catalogPath: string;
  userDataPath: string;
}

type Handler = (event: IpcMainInvokeEvent, ...args: any[]) => unknown;

/**
 * Register all desktopBridge IPC handlers. Every handler validates its
 * inputs again in the main process — the renderer is never trusted.
 */
export function registerIpc(ctx: IpcContext): void {
  const { windowManager, jobManager, settings, vault, projectStore, projectRunner, skills, chat, companion, enterpriseStore, enterpriseRunner, assistantStore, assistantScheduler, catalogPath, userDataPath } = ctx;
  void assistantScheduler; // started in main; sweep logic is exercised via astJobRunNow
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

  ipcMain.handle(CHANNELS.readArtifact, guard((_event, projectId: unknown, runId: unknown, nodeId: unknown, attempt: unknown) => {
    try {
      if (typeof projectId !== 'string' || typeof runId !== 'string' || typeof nodeId !== 'string') {
        return { ok: false, error: 'projectId, runId and nodeId must be strings' };
      }
      if (attempt !== undefined && (!Number.isInteger(attempt) || (attempt as number) < 1)) {
        return { ok: false, error: 'attempt must be a positive integer' };
      }
      const artifact = projectStore.readArtifact(projectId, runId, nodeId, attempt as number | undefined);
      if (!artifact) return { ok: false, error: 'artifact not found' };
      return { ok: true, text: artifact.text, meta: artifact.meta };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  // ------------------------------------------------------------------ skills

  ipcMain.handle(CHANNELS.listSkills, guard(() => skills.registry.list()));

  // ------------------------------------------------------------------ hiring
  // Deterministic preview, explicit confirmation, persisted keyed approval,
  // exactly-once decide, validated application. No provider involvement.

  ipcMain.handle(CHANNELS.hirePreview, guard((_event, projectId: unknown) => {
    try {
      if (typeof projectId !== 'string') return { ok: false, error: 'projectId must be a string' };
      const project = projectStore.getProject(projectId);
      if (!project) return { ok: false, error: 'unknown project id' };
      return { ok: true, preview: computeHirePreview(project, skills.registry) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.applyHires, guard((_event, req: unknown) => {
    if (typeof req !== 'object' || req === null) return { ok: false, error: 'request must be an object' };
    const r = req as { projectId?: unknown; expectedVersion?: unknown; assignments?: unknown; confirmed?: unknown };
    if (typeof r.projectId !== 'string') return { ok: false, error: 'projectId must be a string' };
    return requestHireApproval(projectStore, skills.registry, {
      projectId: r.projectId,
      expectedVersion: r.expectedVersion as number,
      assignments: r.assignments,
      confirmed: r.confirmed === true,
    });
  }));

  // ------------------------------------------------------------------ office

  ipcMain.handle(CHANNELS.updateOfficeProject, guard((_event, req: unknown) => {
    try {
      return { ok: true, project: projectStore.updateProject(req as never) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.reassignNode, guard((_event, req: unknown) => {
    try {
      return { ok: true, project: projectStore.reassignNode(req as never) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.getOfficeSnapshot, guard((_event, projectId: unknown, runId: unknown) => {
    try {
      if (typeof projectId !== 'string') return null;
      const project = projectStore.getProject(projectId);
      if (!project) return null;
      const run = typeof runId === 'string' ? projectStore.getRun(projectId, runId) : null;
      return deriveOfficeSnapshot(project, run, skills.registry.skillRoles());
    } catch {
      return null;
    }
  }));

  // ------------------------------------------------------------------ approvals

  ipcMain.handle(CHANNELS.decideApproval, guard((_event, req: unknown) => {
    try {
      if (typeof req !== 'object' || req === null) return { ok: false, error: 'request must be an object' };
      const r = req as { projectId?: unknown; runId?: unknown; approvalId?: unknown; decision?: unknown; payloadHash?: unknown };
      if (typeof r.projectId !== 'string' || typeof r.approvalId !== 'string') {
        return { ok: false, error: 'projectId and approvalId must be strings' };
      }
      if (r.decision !== 'approved' && r.decision !== 'rejected') return { ok: false, error: 'decision must be approved or rejected' };
      if (typeof r.payloadHash !== 'string') return { ok: false, error: 'payloadHash must be a string' };
      const runId = typeof r.runId === 'string' ? r.runId : null;

      if (runId === null) {
        // Design-time hire approvals: approving applies the exact hashed payload.
        return decideHireApproval(projectStore, skills.registry, {
          projectId: r.projectId,
          approvalId: r.approvalId,
          decision: r.decision,
          payloadHash: r.payloadHash,
        });
      }
      const decided = projectStore.decideApproval({ projectId: r.projectId, runId, approvalId: r.approvalId, decision: r.decision, payloadHash: r.payloadHash });
      if (decided.ok) projectRunner.wakeApprovals(runId);
      return decided;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.listApprovals, guard((_event, projectId: unknown, runId: unknown) => {
    try {
      const all = projectStore.listApprovals(typeof projectId === 'string' ? projectId : undefined);
      return typeof runId === 'string' ? all.filter((a) => a.runId === runId) : all;
    } catch {
      return [];
    }
  }));

  // ------------------------------------------------------------------ events

  ipcMain.handle(CHANNELS.readRunEvents, guard((_event, projectId: unknown, runId: unknown, afterIndex: unknown) => {
    try {
      if (typeof projectId !== 'string' || typeof runId !== 'string') {
        return { ok: false, error: 'projectId and runId must be strings' };
      }
      const start = typeof afterIndex === 'number' && Number.isInteger(afterIndex) && afterIndex >= 0 ? afterIndex : 0;
      const { events, nextIndex } = projectStore.readEvents(projectId, runId, start);
      return { ok: true, events, nextIndex };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  // ------------------------------------------------------------------ recovery

  ipcMain.handle(CHANNELS.recoverRun, guard((_event, runId: unknown) => {
    if (typeof runId !== 'string') return { ok: false, error: 'runId must be a string' };
    return projectRunner.recover(runId);
  }));

  // ------------------------------------------------------------------ chat
  // Provider-backed Director chat. sendMessage requires confirmed:true and
  // returns after persisting the pending state; clients poll chatGetSession.

  ipcMain.handle(CHANNELS.chatCreateSession, guard((_event, req: unknown) => chat.createSession(req)));

  ipcMain.handle(CHANNELS.chatListSessions, guard(() => chat.listSessions()));

  ipcMain.handle(CHANNELS.chatGetSession, guard((_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string') return null;
    return chat.getSession(sessionId);
  }));

  ipcMain.handle(CHANNELS.chatSendMessage, guard((_event, req: unknown) => chat.sendMessage(req)));

  ipcMain.handle(CHANNELS.chatStop, guard((_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string') return { ok: false, error: 'sessionId must be a string' };
    return chat.stop(sessionId);
  }));

  ipcMain.handle(CHANNELS.chatDeleteSession, guard((_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string') return { ok: false, error: 'sessionId must be a string' };
    return chat.deleteSession(sessionId);
  }));

  // --------------------------------------------------------------- companion
  // The pairing token is returned ONLY by enable/regenerate (exactly once).
  // Status never contains token material — fingerprint/metadata only.

  ipcMain.handle(CHANNELS.companionStatus, guard(() => companion.status()));

  ipcMain.handle(CHANNELS.companionEnable, guard(async (_event, req: unknown) => {
    const port = typeof req === 'object' && req !== null && 'port' in req ? (req as { port?: unknown }).port : undefined;
    if (port !== undefined && (typeof port !== 'number' || !Number.isInteger(port))) {
      return { ok: false, error: 'port must be an integer' };
    }
    return companion.enable(port as number | undefined);
  }));

  ipcMain.handle(CHANNELS.companionDisable, guard(() => companion.disable()));

  ipcMain.handle(CHANNELS.companionRegenerateToken, guard(() => companion.regenerateToken()));

  // --------------------------------------------------------------- v5: CEO
  // Enterprise commands re-validate everything in the store layer; handlers
  // here only narrow types. No provider keys or artifact bodies cross IPC:
  // snapshots/ledger/memory carry hashes + bounded extractive text only.

  enterpriseRunner.on('enterprise', (record: EnterpriseRecord) => {
    const win = windowManager.window;
    if (!win.isDestroyed()) {
      win.webContents.send(CHANNELS.enterpriseEvent, record);
    }
  });

  const entId = (value: unknown): string => {
    if (typeof value !== 'string' || value.length === 0 || value.length > 80) throw new Error('enterprise id must be a string');
    return value;
  };

  ipcMain.handle(CHANNELS.entList, guard(() => enterpriseStore.list()));

  ipcMain.handle(CHANNELS.entGet, guard((_event, id: unknown) => enterpriseStore.get(entId(id))));

  ipcMain.handle(CHANNELS.entCreate, guard((_event, req: unknown) => {
    try {
      const { record, created } = enterpriseStore.create(req as Parameters<EnterpriseStore['create']>[0]);
      return { ok: true, record, created };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entUpdate, guard((_event, req: unknown) => {
    try {
      return { ok: true, record: enterpriseStore.update(req as Parameters<EnterpriseStore['update']>[0]) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entBlueprintPreview, guard((_event, req: unknown) => {
    try {
      return { ok: true, preview: enterpriseStore.previewBlueprint(req as Parameters<EnterpriseStore['previewBlueprint']>[0]) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entBlueprintApply, guard((_event, req: unknown) =>
    enterpriseStore.applyBlueprint(req as Parameters<EnterpriseStore['applyBlueprint']>[0])));

  ipcMain.handle(CHANNELS.entApprovalDecide, guard((_event, req: unknown) =>
    enterpriseStore.decideApproval(req as Parameters<EnterpriseStore['decideApproval']>[0])));

  ipcMain.handle(CHANNELS.entContracts, guard((_event, id: unknown) => {
    try {
      return enterpriseStore.listContracts(entId(id));
    } catch {
      return [];
    }
  }));

  ipcMain.handle(CHANNELS.entContractPropose, guard((_event, req: unknown) => {
    try {
      if (typeof req !== 'object' || req === null) throw new Error('request must be an object');
      const { enterpriseId, ...rest } = req as { enterpriseId: unknown } & Parameters<EnterpriseStore['proposeContract']>[1];
      return { ok: true, record: enterpriseStore.proposeContract(entId(enterpriseId), rest) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entContractDecide, guard((_event, req: unknown) => {
    try {
      if (typeof req !== 'object' || req === null) throw new Error('request must be an object');
      const { enterpriseId, ...rest } = req as { enterpriseId: unknown } & Parameters<EnterpriseStore['decideContract']>[1];
      return { ok: true, record: enterpriseStore.decideContract(entId(enterpriseId), rest) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entContractRelease, guard((_event, req: unknown) => {
    try {
      if (typeof req !== 'object' || req === null) throw new Error('request must be an object');
      const { enterpriseId, ...rest } = req as { enterpriseId: unknown } & Parameters<EnterpriseStore['releaseContract']>[1];
      return { ok: true, record: enterpriseStore.releaseContract(entId(enterpriseId), rest) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entMemory, guard((_event, id: unknown, includeRevoked: unknown) => {
    try {
      return enterpriseStore.listMemory(entId(id), { includeRevoked: includeRevoked === true });
    } catch {
      return [];
    }
  }));

  ipcMain.handle(CHANNELS.entMemoryPromote, guard((_event, req: unknown) => {
    if (typeof req !== 'object' || req === null) return { ok: false, error: 'request must be an object' };
    const { enterpriseId, ...rest } = req as { enterpriseId: unknown } & Parameters<EnterpriseStore['promoteMemory']>[1];
    try {
      return enterpriseStore.promoteMemory(entId(enterpriseId), rest);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entMemoryRevoke, guard((_event, req: unknown) => {
    if (typeof req !== 'object' || req === null) return { ok: false, error: 'request must be an object' };
    const { enterpriseId, ...rest } = req as { enterpriseId: unknown } & Parameters<EnterpriseStore['revokeMemory']>[1];
    try {
      return enterpriseStore.revokeMemory(entId(enterpriseId), rest);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entMemorySearch, guard((_event, id: unknown, query: unknown) => {
    try {
      return enterpriseStore.searchMemory(entId(id), typeof query === 'string' ? query : '');
    } catch {
      return [];
    }
  }));

  ipcMain.handle(CHANNELS.entProgramStart, guard((_event, req: unknown) => {
    if (typeof req !== 'object' || req === null) return { ok: false, error: 'request must be an object' };
    const { enterpriseId, expectedVersion } = req as { enterpriseId: unknown; expectedVersion: unknown };
    try {
      return enterpriseRunner.start(entId(enterpriseId), expectedVersion);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entProgramPause, guard((_event, id: unknown) => {
    try {
      return enterpriseRunner.pause(entId(id));
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entProgramResume, guard((_event, id: unknown) => {
    try {
      return enterpriseRunner.resume(entId(id));
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entProgramCancel, guard((_event, id: unknown) => {
    try {
      return enterpriseRunner.cancel(entId(id));
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entProgramGet, guard((_event, id: unknown) => {
    try {
      return enterpriseRunner.getProgram(entId(id));
    } catch {
      return null;
    }
  }));

  ipcMain.handle(CHANNELS.entProgramPump, guard((_event, id: unknown) => {
    try {
      return enterpriseRunner.pump(entId(id));
    } catch (err) {
      return { ok: false, dispatched: 0, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entSnapshot, guard((_event, id: unknown) => {
    try {
      return enterpriseStore.snapshot(entId(id));
    } catch {
      return null;
    }
  }));

  ipcMain.handle(CHANNELS.entLedger, guard((_event, req: unknown) => {
    try {
      if (typeof req !== 'object' || req === null) return [];
      const { enterpriseId, ...filters } = req as { enterpriseId: unknown } & Record<string, unknown>;
      return enterpriseStore.readLedger(entId(enterpriseId), filters);
    } catch {
      return [];
    }
  }));

  ipcMain.handle(CHANNELS.entTimeline, guard((_event, req: unknown) => {
    try {
      if (typeof req !== 'object' || req === null) return { entries: [], nextIndex: 0 };
      const { enterpriseId, afterIndex, limit } = req as { enterpriseId: unknown; afterIndex?: unknown; limit?: unknown };
      return enterpriseStore.timelineIndex(
        entId(enterpriseId),
        typeof afterIndex === 'number' ? afterIndex : 0,
        typeof limit === 'number' ? limit : 1000,
      );
    } catch {
      return { entries: [], nextIndex: 0 };
    }
  }));

  ipcMain.handle(CHANNELS.entEvents, guard((_event, req: unknown) => {
    try {
      if (typeof req !== 'object' || req === null) return { events: [], nextIndex: 0 };
      const { enterpriseId, afterIndex, limit } = req as { enterpriseId: unknown; afterIndex?: unknown; limit?: unknown };
      return enterpriseStore.readEvents(
        entId(enterpriseId),
        typeof afterIndex === 'number' ? afterIndex : 0,
        typeof limit === 'number' ? limit : 1000,
      );
    } catch {
      return { events: [], nextIndex: 0 };
    }
  }));

  ipcMain.handle(CHANNELS.entWorkerUpdate, guard((_event, req: unknown) => {
    if (typeof req !== 'object' || req === null) return { ok: false, error: 'request must be an object' };
    const { enterpriseId, op, ...rest } = req as { enterpriseId: unknown; op: unknown } & Record<string, unknown>;
    try {
      const id = entId(enterpriseId);
      switch (op) {
        case 'reassign':
          return enterpriseStore.reassignWorker(id, rest as Parameters<EnterpriseStore['reassignWorker']>[1]);
        case 'capacity':
          return enterpriseStore.adjustWorkerCapacity(id, rest as Parameters<EnterpriseStore['adjustWorkerCapacity']>[1]);
        case 'suspend':
          return enterpriseStore.setWorkerSuspended(id, { ...(rest as object), suspended: true } as Parameters<EnterpriseStore['setWorkerSuspended']>[1]);
        case 'resume':
          return enterpriseStore.setWorkerSuspended(id, { ...(rest as object), suspended: false } as Parameters<EnterpriseStore['setWorkerSuspended']>[1]);
        case 'edit':
          return enterpriseStore.editWorker(id, rest as Parameters<EnterpriseStore['editWorker']>[1]);
        default:
          return { ok: false, error: `unknown worker op "${String(op)}"` };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entExport, guard((_event, id: unknown) => {
    try {
      return enterpriseStore.exportArtifacts(entId(id));
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.entStewards, guard((_event, id: unknown) => {
    try {
      return enterpriseStore.deriveStewardRecommendations(entId(id));
    } catch {
      return [];
    }
  }));

  // --------------------------------------------------------------- v6: assistants
  // Donna / shared assistants. Every handler re-validates in the store layer;
  // gated actions require confirmed:true + explicit confirmedGates, enforced
  // by validateAssistantAction (never by prompt text). Emergency stop is
  // intentionally ABSENT here — it stays on entProgramCancel/cancelRun/
  // chatStop, ungated, and never travels the proposal pipeline.

  assistantStore.on('assistant', (payload: { enterpriseId: string; version: number; eventSeq: number; event: string; detail?: string }) => {
    const win = windowManager.window;
    if (!win.isDestroyed()) {
      win.webContents.send(CHANNELS.assistantEvent, payload);
    }
  });

  const astEntId = (value: unknown): string => {
    if (typeof value !== 'string' || !/^ent-[a-z0-9][a-z0-9-]{0,62}$/.test(value)) {
      throw new Error('invalid enterprise id');
    }
    return value;
  };

  const toAssistantDto = (state: AssistantState): AssistantStateDto => ({
    enterpriseId: state.enterpriseId,
    version: state.version,
    eventSeq: state.eventSeq,
    proposals: state.proposals,
    queues: Object.values(state.queues).map((q) => ({ queue: q.queue, items: q.items })),
    jobs: Object.values(state.jobs),
    studyItems: Object.values(state.studyItems),
    repositories: Object.values(state.repositories),
    transfers: Object.values(state.transfers),
    lifecycle: state.lifecycle,
  });

  function isRecordShape(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }

  type AstDirectInput = {
    scope: 'enterprise' | 'company' | 'department' | 'office';
    action:
      | 'queue.add' | 'queue.reorder'
      | 'worker.hire' | 'worker.pause' | 'worker.resume' | 'worker.fire'
      | 'department.pause' | 'department.resume' | 'department.archive'
      | 'company.pause' | 'company.resume' | 'company.archive'
      | 'cache.invalidate'
      | 'schedule.upsert' | 'schedule.pause' | 'schedule.resume' | 'schedule.delete' | 'schedule.run_now'
      | 'study.enqueue' | 'repository.assign';
    payload: Record<string, unknown>;
    expectedVersion: unknown;
    confirmed: unknown;
    confirmedGates?: unknown;
  };

  const astDirect = (req: unknown, build: (r: Record<string, unknown>) => AstDirectInput & { enterpriseId: unknown }): { ok: boolean; summary?: string; error?: string } => {
    try {
      if (!isRecordShape(req)) throw new Error('request must be an object');
      const { enterpriseId, ...rest } = build(req);
      return assistantStore.direct(astEntId(enterpriseId), rest);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  ipcMain.handle(CHANNELS.astDefinitions, guard(() => assistantStore.definitions()));

  ipcMain.handle(CHANNELS.astGet, guard((_event, id: unknown) => {
    try {
      return toAssistantDto(assistantStore.getState(astEntId(id)));
    } catch {
      return null;
    }
  }));

  ipcMain.handle(CHANNELS.astPropose, guard((_event, req: unknown) => {
    if (!isRecordShape(req)) return { ok: false, error: 'request must be an object' };
    try {
      return assistantStore.propose(astEntId(req.enterpriseId), req as { scope: unknown; actor: unknown; action: unknown; payload: unknown });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.astDecide, guard((_event, req: unknown) => {
    if (!isRecordShape(req)) return { ok: false, error: 'request must be an object' };
    try {
      return assistantStore.decide(astEntId(req.enterpriseId), req as { proposalId: unknown; decision: unknown; confirmedGates?: unknown });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.astExecute, guard((_event, req: unknown) => {
    if (!isRecordShape(req)) return { ok: false, error: 'request must be an object' };
    try {
      return assistantStore.execute(astEntId(req.enterpriseId), req.proposalId);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.astCancel, guard((_event, req: unknown) => {
    if (!isRecordShape(req)) return { ok: false, error: 'request must be an object' };
    try {
      return assistantStore.cancel(astEntId(req.enterpriseId), req.proposalId);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.astQueueAdd, guard((_event, req: unknown) =>
    astDirect(req, (r) => ({
      enterpriseId: r.enterpriseId,
      scope: r.scope as 'enterprise',
      action: 'queue.add',
      payload: { scope: r.scope, scopeKey: r.scopeKey, ...(typeof r.queueId === 'string' ? { queueId: r.queueId } : {}), item: r.item },
      expectedVersion: r.expectedVersion,
      confirmed: true,
    }))));

  ipcMain.handle(CHANNELS.astQueueReorder, guard((_event, req: unknown) =>
    astDirect(req, (r) => ({
      enterpriseId: r.enterpriseId,
      scope: 'enterprise',
      action: 'queue.reorder',
      payload: { queueId: r.queueId, orderedIds: r.orderedIds },
      expectedVersion: r.expectedVersion,
      confirmed: true,
    }))));

  ipcMain.handle(CHANNELS.astWorkerAction, guard((_event, req: unknown) =>
    astDirect(req, (r) => {
      const action = r.action;
      if (action !== 'worker.hire' && action !== 'worker.pause' && action !== 'worker.resume' && action !== 'worker.fire') {
        throw new Error('action must be worker.hire|worker.pause|worker.resume|worker.fire');
      }
      const payload = isRecordShape(r.payload) ? { ...r.payload } : {};
      if (action === 'worker.fire') {
        // The direct human fire IS the drain+preserve instruction.
        payload.drain = true;
        payload.preserveArtifacts = true;
      }
      return {
        enterpriseId: r.enterpriseId,
        scope: 'company',
        action,
        payload,
        expectedVersion: r.expectedVersion,
        confirmed: r.confirmed === true,
        confirmedGates: r.confirmedGates,
      };
    })));

  ipcMain.handle(CHANNELS.astLifecycleSet, guard((_event, req: unknown) =>
    astDirect(req, (r) => {
      const target = r.target === 'company' ? 'company' : r.target === 'department' ? 'department' : null;
      if (target === null) throw new Error('target must be company|department');
      const status = r.status;
      if (status !== 'active' && status !== 'paused' && status !== 'archived') throw new Error('status must be active|paused|archived');
      const action = `${target}.${status === 'active' ? 'resume' : status === 'paused' ? 'pause' : 'archive'}` as
        | 'company.pause' | 'company.resume' | 'company.archive'
        | 'department.pause' | 'department.resume' | 'department.archive';
      const payload: Record<string, unknown> = target === 'company' ? { companyKey: r.key } : { departmentKey: r.key };
      if (status === 'archived') {
        payload.drain = true;
        payload.preserveArtifacts = true;
      }
      return {
        enterpriseId: r.enterpriseId,
        scope: target === 'company' ? 'company' : 'department',
        action,
        payload,
        expectedVersion: r.expectedVersion,
        confirmed: r.confirmed === true,
        confirmedGates: r.confirmedGates,
      };
    })));

  ipcMain.handle(CHANNELS.astJobUpsert, guard((_event, req: unknown) =>
    astDirect(req, (r) => ({
      enterpriseId: r.enterpriseId,
      scope: 'enterprise',
      action: 'schedule.upsert',
      payload: { job: r.job },
      expectedVersion: r.expectedVersion,
      confirmed: r.confirmed === true,
      confirmedGates: r.confirmedGates,
    }))));

  const astJobMutation = (action: 'schedule.pause' | 'schedule.resume' | 'schedule.delete' | 'schedule.run_now', req: unknown) =>
    astDirect(req, (r) => ({
      enterpriseId: r.enterpriseId,
      scope: 'enterprise',
      action,
      payload: { jobId: r.jobId },
      expectedVersion: r.expectedVersion,
      confirmed: r.confirmed === true,
      confirmedGates: r.confirmedGates,
    }));

  ipcMain.handle(CHANNELS.astJobPause, guard((_event, req: unknown) => astJobMutation('schedule.pause', req)));
  ipcMain.handle(CHANNELS.astJobResume, guard((_event, req: unknown) => astJobMutation('schedule.resume', req)));
  ipcMain.handle(CHANNELS.astJobDelete, guard((_event, req: unknown) => astJobMutation('schedule.delete', req)));
  ipcMain.handle(CHANNELS.astJobRunNow, guard((_event, req: unknown) => astJobMutation('schedule.run_now', req)));

  ipcMain.handle(CHANNELS.astStudyEnqueue, guard((_event, req: unknown) =>
    astDirect(req, (r) => ({
      enterpriseId: r.enterpriseId,
      scope: 'department',
      action: 'study.enqueue',
      payload: { skillId: r.skillId, goal: r.goal, resources: r.resources, ...(typeof r.evaluation === 'string' ? { evaluation: r.evaluation } : {}) },
      expectedVersion: r.expectedVersion,
      confirmed: true,
    }))));

  ipcMain.handle(CHANNELS.astStudyList, guard((_event, id: unknown) => {
    try {
      return assistantStore.studyList(astEntId(id));
    } catch {
      return [];
    }
  }));

  ipcMain.handle(CHANNELS.astRepoPreview, guard(async (_event, req: unknown) => {
    if (!isRecordShape(req)) return { ok: false, error: 'request must be an object' };
    return assistantStore.repoPreview(req.url);
  }));

  ipcMain.handle(CHANNELS.astRepoFetch, guard(async (_event, req: unknown) => {
    if (!isRecordShape(req)) return { ok: false, error: 'request must be an object' };
    try {
      return await assistantStore.repoFetch(astEntId(req.enterpriseId), req as { url: unknown; intakeMode: unknown; expectedVersion: unknown; confirmed: unknown; confirmedGates?: unknown });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.astRepoApply, guard((_event, req: unknown) =>
    astDirect(req, (r) => ({
      enterpriseId: r.enterpriseId,
      scope: 'enterprise',
      action: 'repository.assign',
      payload: { url: r.url },
      expectedVersion: r.expectedVersion,
      confirmed: r.confirmed === true,
      confirmedGates: r.confirmedGates,
    }))));

  ipcMain.handle(CHANNELS.astKnowledgeList, guard((_event, id: unknown) => {
    try {
      return assistantStore.knowledgeList(astEntId(id));
    } catch {
      return [];
    }
  }));

  ipcMain.handle(CHANNELS.astKnowledgeExport, guard((_event, id: unknown) => {
    try {
      return assistantStore.knowledgeExport(astEntId(id));
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.astCacheInvalidate, guard((_event, req: unknown) =>
    astDirect(req, (r) => ({
      enterpriseId: r.enterpriseId,
      scope: 'enterprise',
      action: 'cache.invalidate',
      payload: { namespace: r.namespace },
      expectedVersion: r.expectedVersion,
      confirmed: true,
    }))));

  ipcMain.handle(CHANNELS.astCacheStatus, guard((_event, id: unknown) => {
    try {
      return assistantStore.cacheStatus(astEntId(id));
    } catch {
      return [];
    }
  }));

  ipcMain.handle(CHANNELS.astEvents, guard((_event, req: unknown) => {
    try {
      if (!isRecordShape(req)) return { events: [], nextIndex: 0 };
      return assistantStore.readEvents(
        astEntId(req.enterpriseId),
        typeof req.afterIndex === 'number' ? req.afterIndex : 0,
        typeof req.limit === 'number' ? req.limit : 1000,
      );
    } catch {
      return { events: [], nextIndex: 0 };
    }
  }));

  ipcMain.handle(CHANNELS.astDonnaPrompt, guard((_event, req: unknown) => {
    if (!isRecordShape(req)) return { ok: false, error: 'request must be an object' };
    try {
      return assistantStore.donnaPrompt(astEntId(req.enterpriseId), req as { objective: unknown; includeLedger?: unknown; includeRepositories?: unknown });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));

  ipcMain.handle(CHANNELS.astDonnaParse, guard((_event, req: unknown) => {
    if (!isRecordShape(req)) return { ok: false, error: 'request must be an object' };
    try {
      return assistantStore.donnaParse(astEntId(req.enterpriseId), req as { text: unknown; scope?: unknown; actor?: unknown; persist?: unknown });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));
}
