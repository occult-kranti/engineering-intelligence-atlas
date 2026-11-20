import { contextBridge, ipcRenderer } from 'electron';
import type {
  ApiProvider,
  CreateProjectRequest,
  CreateVenvRequest,
  DesktopBridge,
  DownloadModelRequest,
  JobRecord,
  ProjectProvider,
  ProjectRun,
  ShellMode,
  StartRunRequest,
} from '../shared/contract';

/**
 * Preload for the LOCAL chrome/launcher page only.
 *
 * This file is attached exclusively to the main shell window (file://).
 * Content views (offline atlas, online runtime) are created without any
 * preload, so remote pages cannot reach this bridge. As defense in depth we
 * additionally refuse to expose the bridge on non-file: pages.
 *
 * API keys pass through exactly one channel (setApiKey) from password-field
 * inputs; no method ever returns key material.
 *
 * NOTE: sandboxed preloads cannot require local modules, so the channel
 * strings below are duplicated from src/shared/contract.ts by hand.
 * tests/contract-sync.test.ts verifies they stay in sync.
 */

const CHANNELS = {
  getSystemInfo: 'desktop:get-system-info',
  getModelCatalog: 'desktop:get-model-catalog',
  checkModelRequirements: 'desktop:check-model-requirements',
  createVenv: 'desktop:create-venv',
  downloadModel: 'desktop:download-model',
  getJobStatus: 'desktop:get-job-status',
  cancelJob: 'desktop:cancel-job',
  openOfflineAtlas: 'desktop:open-offline-atlas',
  connectRuntime: 'desktop:connect-runtime',
  backToLauncher: 'desktop:back-to-launcher',
  getSettings: 'desktop:get-settings',
  openExternal: 'desktop:open-external',
  getVaultStatus: 'desktop:vault:get-status',
  setApiKey: 'desktop:vault:set-key',
  revokeApiKey: 'desktop:vault:revoke-key',
  listProviderModels: 'desktop:provider:list-models',
  detectOllama: 'desktop:ollama:detect',
  listProjects: 'desktop:projects:list',
  createProject: 'desktop:projects:create',
  getProject: 'desktop:projects:get',
  startRun: 'desktop:projects:run-start',
  pauseRun: 'desktop:projects:run-pause',
  resumeRun: 'desktop:projects:run-resume',
  cancelRun: 'desktop:projects:run-cancel',
  listRuns: 'desktop:projects:runs',
  readArtifact: 'desktop:projects:read-artifact',
  jobEvent: 'desktop:event:job',
  modeChanged: 'desktop:event:mode',
  projectEvent: 'desktop:event:project',
} as const;

if (window.location.protocol === 'file:') {
  const bridge: DesktopBridge = {
    version: 2,
    getSystemInfo: () => ipcRenderer.invoke(CHANNELS.getSystemInfo),
    getModelCatalog: () => ipcRenderer.invoke(CHANNELS.getModelCatalog),
    checkModelRequirements: (modelId: string) =>
      ipcRenderer.invoke(CHANNELS.checkModelRequirements, modelId),
    createVenv: (req: CreateVenvRequest) => ipcRenderer.invoke(CHANNELS.createVenv, req),
    downloadModel: (req: DownloadModelRequest) => ipcRenderer.invoke(CHANNELS.downloadModel, req),
    getJobStatus: (jobId?: string) => ipcRenderer.invoke(CHANNELS.getJobStatus, jobId),
    cancelJob: (jobId: string) => ipcRenderer.invoke(CHANNELS.cancelJob, jobId),
    openOfflineAtlas: () => ipcRenderer.invoke(CHANNELS.openOfflineAtlas),
    connectRuntime: (url: string) => ipcRenderer.invoke(CHANNELS.connectRuntime, url),
    backToLauncher: () => ipcRenderer.invoke(CHANNELS.backToLauncher),
    getSettings: () => ipcRenderer.invoke(CHANNELS.getSettings),
    openExternal: (url: string) => ipcRenderer.invoke(CHANNELS.openExternal, url),
    getVaultStatus: () => ipcRenderer.invoke(CHANNELS.getVaultStatus),
    setApiKey: (provider: ApiProvider, key: string) => ipcRenderer.invoke(CHANNELS.setApiKey, provider, key),
    revokeApiKey: (provider: ApiProvider) => ipcRenderer.invoke(CHANNELS.revokeApiKey, provider),
    listProviderModels: (provider: ProjectProvider) => ipcRenderer.invoke(CHANNELS.listProviderModels, provider),
    detectOllama: () => ipcRenderer.invoke(CHANNELS.detectOllama),
    listProjects: () => ipcRenderer.invoke(CHANNELS.listProjects),
    createProject: (req: CreateProjectRequest) => ipcRenderer.invoke(CHANNELS.createProject, req),
    getProject: (projectId: string) => ipcRenderer.invoke(CHANNELS.getProject, projectId),
    startRun: (req: StartRunRequest) => ipcRenderer.invoke(CHANNELS.startRun, req),
    pauseRun: (runId: string) => ipcRenderer.invoke(CHANNELS.pauseRun, runId),
    resumeRun: (runId: string) => ipcRenderer.invoke(CHANNELS.resumeRun, runId),
    cancelRun: (runId: string) => ipcRenderer.invoke(CHANNELS.cancelRun, runId),
    listRuns: (projectId?: string) => ipcRenderer.invoke(CHANNELS.listRuns, projectId),
    readArtifact: (projectId: string, runId: string, nodeId: string) =>
      ipcRenderer.invoke(CHANNELS.readArtifact, projectId, runId, nodeId),
    onJobEvent: (listener: (job: JobRecord) => void) => {
      const handler = (_event: unknown, job: JobRecord) => listener(job);
      ipcRenderer.on(CHANNELS.jobEvent, handler);
      return () => {
        ipcRenderer.removeListener(CHANNELS.jobEvent, handler);
      };
    },
    onModeChanged: (listener: (mode: ShellMode, url: string | null) => void) => {
      const handler = (_event: unknown, mode: ShellMode, url: string | null) => listener(mode, url);
      ipcRenderer.on(CHANNELS.modeChanged, handler);
      return () => {
        ipcRenderer.removeListener(CHANNELS.modeChanged, handler);
      };
    },
    onProjectEvent: (listener: (run: ProjectRun) => void) => {
      const handler = (_event: unknown, run: ProjectRun) => listener(run);
      ipcRenderer.on(CHANNELS.projectEvent, handler);
      return () => {
        ipcRenderer.removeListener(CHANNELS.projectEvent, handler);
      };
    },
  };

  contextBridge.exposeInMainWorld('desktopBridge', bridge);
}
