import { contextBridge, ipcRenderer } from 'electron';
import type {
  ApiProvider,
  ApplyHiresRequest,
  AssistantCacheInvalidateRequest,
  AssistantDecideRequest,
  AssistantDonnaParseRequest,
  AssistantDonnaPromptRequest,
  AssistantEventPushDto,
  AssistantEventsRequest,
  AssistantIdRequest,
  AssistantJobMutationRequest,
  AssistantJobUpsertRequest,
  AssistantLifecycleSetRequest,
  AssistantProposeRequest,
  AssistantQueueAddRequest,
  AssistantQueueReorderRequest,
  AssistantRepoApplyRequest,
  AssistantRepoFetchRequest,
  AssistantRepoPreviewRequest,
  AssistantStudyEnqueueRequest,
  AssistantWorkerActionRequest,
  CreateChatSessionRequest,
  CreateEnterpriseRequest,
  CreateProjectRequest,
  CreateVenvRequest,
  DecideApprovalRequest,
  DesktopBridge,
  DownloadModelRequest,
  EnterpriseApprovalDecideRequest,
  EnterpriseBlueprintApplyRequest,
  EnterpriseBlueprintPreviewRequest,
  EnterpriseContractDecideRequest,
  EnterpriseContractProposeRequest,
  EnterpriseContractReleaseRequest,
  EnterpriseLedgerRequest,
  EnterpriseMemoryPromoteRequest,
  EnterpriseMemoryRevokeRequest,
  EnterprisePagedRequest,
  EnterpriseRecordDto,
  EnterpriseWorkerUpdateRequest,
  JobRecord,
  ProjectProvider,
  ProjectRun,
  ReassignNodeRequest,
  SendChatMessageRequest,
  ShellMode,
  StartRunRequest,
  UpdateEnterpriseRequest,
  UpdateOfficeProjectRequest,
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
  listSkills: 'desktop:skills:list',
  hirePreview: 'desktop:projects:hire-preview',
  applyHires: 'desktop:projects:hire-apply',
  updateOfficeProject: 'desktop:projects:update-office',
  reassignNode: 'desktop:projects:reassign',
  getOfficeSnapshot: 'desktop:projects:office-snapshot',
  decideApproval: 'desktop:projects:approval-decide',
  listApprovals: 'desktop:projects:approvals',
  readRunEvents: 'desktop:projects:run-events',
  recoverRun: 'desktop:projects:run-recover',
  chatCreateSession: 'desktop:chat:create',
  chatListSessions: 'desktop:chat:list',
  chatGetSession: 'desktop:chat:get',
  chatSendMessage: 'desktop:chat:send',
  chatStop: 'desktop:chat:stop',
  chatDeleteSession: 'desktop:chat:delete',
  companionStatus: 'desktop:companion:status',
  companionEnable: 'desktop:companion:enable',
  companionDisable: 'desktop:companion:disable',
  companionRegenerateToken: 'desktop:companion:regenerate-token',
  entList: 'desktop:ent:list',
  entGet: 'desktop:ent:get',
  entCreate: 'desktop:ent:create',
  entUpdate: 'desktop:ent:update',
  entBlueprintPreview: 'desktop:ent:blueprint-preview',
  entBlueprintApply: 'desktop:ent:blueprint-apply',
  entApprovalDecide: 'desktop:ent:approval-decide',
  entContracts: 'desktop:ent:contracts',
  entContractPropose: 'desktop:ent:contract-propose',
  entContractDecide: 'desktop:ent:contract-decide',
  entContractRelease: 'desktop:ent:contract-release',
  entMemory: 'desktop:ent:memory',
  entMemoryPromote: 'desktop:ent:memory-promote',
  entMemoryRevoke: 'desktop:ent:memory-revoke',
  entMemorySearch: 'desktop:ent:memory-search',
  entProgramStart: 'desktop:ent:program-start',
  entProgramPause: 'desktop:ent:program-pause',
  entProgramResume: 'desktop:ent:program-resume',
  entProgramCancel: 'desktop:ent:program-cancel',
  entProgramGet: 'desktop:ent:program-get',
  entProgramPump: 'desktop:ent:program-pump',
  entSnapshot: 'desktop:ent:snapshot',
  entLedger: 'desktop:ent:ledger',
  entTimeline: 'desktop:ent:timeline',
  entEvents: 'desktop:ent:events',
  entWorkerUpdate: 'desktop:ent:worker-update',
  entExport: 'desktop:ent:export',
  entStewards: 'desktop:ent:stewards',
  astDefinitions: 'desktop:ast:definitions',
  astGet: 'desktop:ast:get',
  astPropose: 'desktop:ast:propose',
  astDecide: 'desktop:ast:decide',
  astExecute: 'desktop:ast:execute',
  astCancel: 'desktop:ast:cancel',
  astQueueAdd: 'desktop:ast:queue-add',
  astQueueReorder: 'desktop:ast:queue-reorder',
  astWorkerAction: 'desktop:ast:worker-action',
  astLifecycleSet: 'desktop:ast:lifecycle-set',
  astJobUpsert: 'desktop:ast:job-upsert',
  astJobPause: 'desktop:ast:job-pause',
  astJobResume: 'desktop:ast:job-resume',
  astJobDelete: 'desktop:ast:job-delete',
  astJobRunNow: 'desktop:ast:job-run-now',
  astStudyEnqueue: 'desktop:ast:study-enqueue',
  astStudyList: 'desktop:ast:study-list',
  astRepoPreview: 'desktop:ast:repo-preview',
  astRepoFetch: 'desktop:ast:repo-fetch',
  astRepoApply: 'desktop:ast:repo-apply',
  astKnowledgeList: 'desktop:ast:knowledge-list',
  astKnowledgeExport: 'desktop:ast:knowledge-export',
  astCacheInvalidate: 'desktop:ast:cache-invalidate',
  astCacheStatus: 'desktop:ast:cache-status',
  astEvents: 'desktop:ast:events',
  astDonnaPrompt: 'desktop:ast:donna-prompt',
  astDonnaParse: 'desktop:ast:donna-parse',
  jobEvent: 'desktop:event:job',
  modeChanged: 'desktop:event:mode',
  projectEvent: 'desktop:event:project',
  enterpriseEvent: 'desktop:event:enterprise',
  assistantEvent: 'desktop:event:assistant',
} as const;

if (window.location.protocol === 'file:') {
  const bridge: DesktopBridge = {
    version: 6,
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
    readArtifact: (projectId: string, runId: string, nodeId: string, attempt?: number) =>
      ipcRenderer.invoke(CHANNELS.readArtifact, projectId, runId, nodeId, attempt),
    listSkills: () => ipcRenderer.invoke(CHANNELS.listSkills),
    hirePreview: (projectId: string) => ipcRenderer.invoke(CHANNELS.hirePreview, projectId),
    applyHires: (req: ApplyHiresRequest) => ipcRenderer.invoke(CHANNELS.applyHires, req),
    updateOfficeProject: (req: UpdateOfficeProjectRequest) => ipcRenderer.invoke(CHANNELS.updateOfficeProject, req),
    reassignNode: (req: ReassignNodeRequest) => ipcRenderer.invoke(CHANNELS.reassignNode, req),
    getOfficeSnapshot: (projectId: string, runId?: string) =>
      ipcRenderer.invoke(CHANNELS.getOfficeSnapshot, projectId, runId),
    decideApproval: (req: DecideApprovalRequest) => ipcRenderer.invoke(CHANNELS.decideApproval, req),
    listApprovals: (projectId?: string, runId?: string) => ipcRenderer.invoke(CHANNELS.listApprovals, projectId, runId),
    readRunEvents: (projectId: string, runId: string, afterIndex?: number) =>
      ipcRenderer.invoke(CHANNELS.readRunEvents, projectId, runId, afterIndex),
    recoverRun: (runId: string) => ipcRenderer.invoke(CHANNELS.recoverRun, runId),
    // v4: Director chat (send is fire-and-poll; getSession returns state)
    chatCreateSession: (req: CreateChatSessionRequest) => ipcRenderer.invoke(CHANNELS.chatCreateSession, req),
    chatListSessions: () => ipcRenderer.invoke(CHANNELS.chatListSessions),
    chatGetSession: (sessionId: string) => ipcRenderer.invoke(CHANNELS.chatGetSession, sessionId),
    chatSendMessage: (req: SendChatMessageRequest) => ipcRenderer.invoke(CHANNELS.chatSendMessage, req),
    chatStop: (sessionId: string) => ipcRenderer.invoke(CHANNELS.chatStop, sessionId),
    chatDeleteSession: (sessionId: string) => ipcRenderer.invoke(CHANNELS.chatDeleteSession, sessionId),
    // v4: companion bridge control (token only from enable/regenerate)
    companionStatus: () => ipcRenderer.invoke(CHANNELS.companionStatus),
    companionEnable: (req?: { port?: number }) => ipcRenderer.invoke(CHANNELS.companionEnable, req),
    companionDisable: () => ipcRenderer.invoke(CHANNELS.companionDisable),
    companionRegenerateToken: () => ipcRenderer.invoke(CHANNELS.companionRegenerateToken),
    // v5: CEO mode (enterprises)
    entList: () => ipcRenderer.invoke(CHANNELS.entList),
    entGet: (id: string) => ipcRenderer.invoke(CHANNELS.entGet, id),
    entCreate: (req: CreateEnterpriseRequest) => ipcRenderer.invoke(CHANNELS.entCreate, req),
    entUpdate: (req: UpdateEnterpriseRequest) => ipcRenderer.invoke(CHANNELS.entUpdate, req),
    entBlueprintPreview: (req: EnterpriseBlueprintPreviewRequest) => ipcRenderer.invoke(CHANNELS.entBlueprintPreview, req),
    entBlueprintApply: (req: EnterpriseBlueprintApplyRequest) => ipcRenderer.invoke(CHANNELS.entBlueprintApply, req),
    entApprovalDecide: (req: EnterpriseApprovalDecideRequest) => ipcRenderer.invoke(CHANNELS.entApprovalDecide, req),
    entContracts: (id: string) => ipcRenderer.invoke(CHANNELS.entContracts, id),
    entContractPropose: (req: EnterpriseContractProposeRequest) => ipcRenderer.invoke(CHANNELS.entContractPropose, req),
    entContractDecide: (req: EnterpriseContractDecideRequest) => ipcRenderer.invoke(CHANNELS.entContractDecide, req),
    entContractRelease: (req: EnterpriseContractReleaseRequest) => ipcRenderer.invoke(CHANNELS.entContractRelease, req),
    entMemory: (id: string, includeRevoked?: boolean) => ipcRenderer.invoke(CHANNELS.entMemory, id, includeRevoked),
    entMemoryPromote: (req: EnterpriseMemoryPromoteRequest) => ipcRenderer.invoke(CHANNELS.entMemoryPromote, req),
    entMemoryRevoke: (req: EnterpriseMemoryRevokeRequest) => ipcRenderer.invoke(CHANNELS.entMemoryRevoke, req),
    entMemorySearch: (id: string, query: string) => ipcRenderer.invoke(CHANNELS.entMemorySearch, id, query),
    entProgramStart: (req: { enterpriseId: string; expectedVersion: number }) => ipcRenderer.invoke(CHANNELS.entProgramStart, req),
    entProgramPause: (id: string) => ipcRenderer.invoke(CHANNELS.entProgramPause, id),
    entProgramResume: (id: string) => ipcRenderer.invoke(CHANNELS.entProgramResume, id),
    entProgramCancel: (id: string) => ipcRenderer.invoke(CHANNELS.entProgramCancel, id),
    entProgramGet: (id: string) => ipcRenderer.invoke(CHANNELS.entProgramGet, id),
    entProgramPump: (id: string) => ipcRenderer.invoke(CHANNELS.entProgramPump, id),
    entSnapshot: (id: string) => ipcRenderer.invoke(CHANNELS.entSnapshot, id),
    entLedger: (req: EnterpriseLedgerRequest) => ipcRenderer.invoke(CHANNELS.entLedger, req),
    entTimeline: (req: EnterprisePagedRequest) => ipcRenderer.invoke(CHANNELS.entTimeline, req),
    entEvents: (req: EnterprisePagedRequest) => ipcRenderer.invoke(CHANNELS.entEvents, req),
    entWorkerUpdate: (req: EnterpriseWorkerUpdateRequest) => ipcRenderer.invoke(CHANNELS.entWorkerUpdate, req),
    entExport: (id: string) => ipcRenderer.invoke(CHANNELS.entExport, id),
    entStewards: (id: string) => ipcRenderer.invoke(CHANNELS.entStewards, id),
    // v6: Donna / shared assistants (emergency stop stays on entProgramCancel / chatStop)
    astDefinitions: () => ipcRenderer.invoke(CHANNELS.astDefinitions),
    astGet: (enterpriseId: string) => ipcRenderer.invoke(CHANNELS.astGet, enterpriseId),
    astPropose: (req: AssistantProposeRequest) => ipcRenderer.invoke(CHANNELS.astPropose, req),
    astDecide: (req: AssistantDecideRequest) => ipcRenderer.invoke(CHANNELS.astDecide, req),
    astExecute: (req: AssistantIdRequest) => ipcRenderer.invoke(CHANNELS.astExecute, req),
    astCancel: (req: AssistantIdRequest) => ipcRenderer.invoke(CHANNELS.astCancel, req),
    astQueueAdd: (req: AssistantQueueAddRequest) => ipcRenderer.invoke(CHANNELS.astQueueAdd, req),
    astQueueReorder: (req: AssistantQueueReorderRequest) => ipcRenderer.invoke(CHANNELS.astQueueReorder, req),
    astWorkerAction: (req: AssistantWorkerActionRequest) => ipcRenderer.invoke(CHANNELS.astWorkerAction, req),
    astLifecycleSet: (req: AssistantLifecycleSetRequest) => ipcRenderer.invoke(CHANNELS.astLifecycleSet, req),
    astJobUpsert: (req: AssistantJobUpsertRequest) => ipcRenderer.invoke(CHANNELS.astJobUpsert, req),
    astJobPause: (req: AssistantJobMutationRequest) => ipcRenderer.invoke(CHANNELS.astJobPause, req),
    astJobResume: (req: AssistantJobMutationRequest) => ipcRenderer.invoke(CHANNELS.astJobResume, req),
    astJobDelete: (req: AssistantJobMutationRequest) => ipcRenderer.invoke(CHANNELS.astJobDelete, req),
    astJobRunNow: (req: AssistantJobMutationRequest) => ipcRenderer.invoke(CHANNELS.astJobRunNow, req),
    astStudyEnqueue: (req: AssistantStudyEnqueueRequest) => ipcRenderer.invoke(CHANNELS.astStudyEnqueue, req),
    astStudyList: (enterpriseId: string) => ipcRenderer.invoke(CHANNELS.astStudyList, enterpriseId),
    astRepoPreview: (req: AssistantRepoPreviewRequest) => ipcRenderer.invoke(CHANNELS.astRepoPreview, req),
    astRepoFetch: (req: AssistantRepoFetchRequest) => ipcRenderer.invoke(CHANNELS.astRepoFetch, req),
    astRepoApply: (req: AssistantRepoApplyRequest) => ipcRenderer.invoke(CHANNELS.astRepoApply, req),
    astKnowledgeList: (enterpriseId: string) => ipcRenderer.invoke(CHANNELS.astKnowledgeList, enterpriseId),
    astKnowledgeExport: (enterpriseId: string) => ipcRenderer.invoke(CHANNELS.astKnowledgeExport, enterpriseId),
    astCacheInvalidate: (req: AssistantCacheInvalidateRequest) => ipcRenderer.invoke(CHANNELS.astCacheInvalidate, req),
    astCacheStatus: (enterpriseId: string) => ipcRenderer.invoke(CHANNELS.astCacheStatus, enterpriseId),
    astEvents: (req: AssistantEventsRequest) => ipcRenderer.invoke(CHANNELS.astEvents, req),
    astDonnaPrompt: (req: AssistantDonnaPromptRequest) => ipcRenderer.invoke(CHANNELS.astDonnaPrompt, req),
    astDonnaParse: (req: AssistantDonnaParseRequest) => ipcRenderer.invoke(CHANNELS.astDonnaParse, req),
    onAssistantEvent: (listener: (event: AssistantEventPushDto) => void) => {
      const handler = (_event: unknown, payload: AssistantEventPushDto) => listener(payload);
      ipcRenderer.on(CHANNELS.assistantEvent, handler);
      return () => {
        ipcRenderer.removeListener(CHANNELS.assistantEvent, handler);
      };
    },
    onEnterpriseEvent: (listener: (record: EnterpriseRecordDto) => void) => {
      const handler = (_event: unknown, record: EnterpriseRecordDto) => listener(record);
      ipcRenderer.on(CHANNELS.enterpriseEvent, handler);
      return () => {
        ipcRenderer.removeListener(CHANNELS.enterpriseEvent, handler);
      };
    },
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
