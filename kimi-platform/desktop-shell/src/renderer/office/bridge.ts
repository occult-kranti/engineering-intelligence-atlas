/**
 * Impure bridge adapter: the ONLY place the renderer touches the raw
 * window.desktopBridge object. It feature-detects the v3 methods and reports
 * missing ones as honest "requires desktop 0.3 runtime" unavailable states —
 * it never fabricates success or fake data.
 *
 * v3/v4 signatures mirror src/shared/contract.ts (BRIDGE_VERSION 4).
 */

import type {
  ApiProvider,
  ApplyHiresRequest,
  ApprovalRecord,
  ArtifactMeta,
  BudgetLimits,
  ChatSession,
  ChatSessionSummary,
  CompanionEnableResult,
  CompanionStatus,
  CreateChatSessionRequest,
  CreateProjectRequest,
  DecideApprovalRequest,
  HirePlanPreview,
  ListModelsResult,
  ModelInfo,
  OfficeSnapshot,
  OllamaStatus,
  PriceRates,
  Project,
  ProjectProvider,
  ProjectRun,
  ReassignNodeRequest,
  RunEventRecord,
  SendChatMessageRequest,
  SendChatMessageResult,
  SkillSummary,
  StartRunRequest,
  UpdateOfficeProjectRequest,
  VaultStatus,
} from './types.js';
import type {
  CreateEnterpriseRequest,
  EnterpriseApprovalDto,
  EnterpriseBlueprintPreviewDto,
  EnterpriseContractDto,
  EnterpriseEventDto,
  EnterpriseMemoryDto,
  EnterpriseProgram,
  EnterpriseRecordDto,
  EnterpriseSnapshotDto,
  EnterpriseSummaryDto,
  ArtifactRef,
  StewardRecommendation,
  TimelineIndexEntry,
  WorkLedgerEntry,
} from './entTypes.js';
import type {
  AssistantActionProposal,
  AssistantCacheInvalidateRequest,
  AssistantCacheStatusDto,
  AssistantDecideRequest,
  AssistantDefinitionsDto,
  AssistantEventDto,
  AssistantEventPushDto,
  AssistantEventsRequest,
  AssistantDonnaParseRequest,
  AssistantDonnaPromptRequest,
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
  AssistantRepositoryDto,
  AssistantStateDto,
  AssistantStudyEnqueueRequest,
  AssistantWorkerActionRequest,
  DonnaPrompt,
  KnowledgeTransferRecord,
  RepoAssignmentPlan,
  RepositoryMetadata,
  StudyQueueItem,
} from './astTypes.js';

export const UNAVAILABLE_V3 = 'requires desktop 0.3 runtime';
export const UNAVAILABLE_V4 = 'requires desktop 0.4 runtime';
export const UNAVAILABLE_V5 = 'requires desktop 0.5 runtime';
export const UNAVAILABLE_V6 = 'requires desktop 0.6 runtime';

export interface BridgeCapabilities {
  skills: boolean;
  hires: boolean;
  approvals: boolean;
  runEvents: boolean;
  officeUpdate: boolean;
  officeSnapshot: boolean;
  recovery: boolean;
  /** v4: provider-backed Director chat (fire-and-poll; no streaming). */
  chat: boolean;
  /** v4: companion loopback bridge status/enable/disable/regenerate. */
  companion: boolean;
  /** v5: CEO mode (enterprise portfolio, contracts, ledger, program). */
  ceo: boolean;
  /** v5: cross-office contract proposals (may lag the rest of CEO mode). */
  ceoPropose: boolean;
  /** v6: Donna / shared assistants (proposals, queues, schedules, repos, chat). */
  assistant: boolean;
}

/** Result wrapper for optional v3 calls. `unavailable` means the runtime is too old. */
export type BridgeResult<T> =
  | { ok: true; value: T; unavailable?: false }
  | { ok: false; error: string; unavailable: boolean };

/** Structural view of the raw preload bridge (v2 + v3, detected at runtime). */
export interface RawBridge {
  version: number;
  // v2 — guaranteed
  getVaultStatus(): Promise<VaultStatus>;
  setApiKey(provider: ApiProvider, key: string): Promise<{ ok: boolean; error?: string }>;
  revokeApiKey(provider: ApiProvider): Promise<{ ok: boolean; error?: string }>;
  listProviderModels(provider: ProjectProvider): Promise<ListModelsResult>;
  detectOllama(): Promise<OllamaStatus>;
  listProjects(): Promise<Project[]>;
  createProject(req: CreateProjectRequest): Promise<{ ok: boolean; project?: Project; error?: string }>;
  getProject(projectId: string): Promise<Project | null>;
  startRun(req: StartRunRequest): Promise<{ ok: boolean; runId?: string; error?: string }>;
  pauseRun(runId: string): Promise<{ ok: boolean; error?: string }>;
  resumeRun(runId: string): Promise<{ ok: boolean; error?: string }>;
  cancelRun(runId: string): Promise<{ ok: boolean; error?: string }>;
  listRuns(projectId?: string): Promise<ProjectRun[]>;
  readArtifact(
    projectId: string,
    runId: string,
    nodeId: string,
    attempt?: number,
  ): Promise<{ ok: boolean; text?: string; meta?: ArtifactMeta; error?: string }>;
  getSettings(): Promise<{ runtimeUrl: string | null }>;
  connectRuntime(url: string): Promise<{ ok: boolean; url?: string; error?: string }>;
  openExternal(url: string): Promise<{ ok: boolean; error?: string }>;
  onProjectEvent(listener: (run: ProjectRun) => void): () => void;
  // v3 — optional, detected at runtime
  listSkills?(): Promise<SkillSummary[]>;
  hirePreview?(projectId: string): Promise<{ ok: boolean; preview?: HirePlanPreview; error?: string }>;
  applyHires?(req: ApplyHiresRequest): Promise<{ ok: boolean; approval?: ApprovalRecord; error?: string }>;
  updateOfficeProject?(req: UpdateOfficeProjectRequest): Promise<{ ok: boolean; project?: Project; error?: string }>;
  reassignNode?(req: ReassignNodeRequest): Promise<{ ok: boolean; project?: Project; error?: string }>;
  getOfficeSnapshot?(projectId: string, runId?: string): Promise<OfficeSnapshot | null>;
  decideApproval?(req: DecideApprovalRequest): Promise<{ ok: boolean; approval?: ApprovalRecord; error?: string }>;
  listApprovals?(projectId?: string, runId?: string): Promise<ApprovalRecord[]>;
  readRunEvents?(
    projectId: string,
    runId: string,
    afterIndex?: number,
  ): Promise<{ ok: boolean; events?: RunEventRecord[]; nextIndex?: number; error?: string }>;
  recoverRun?(runId: string): Promise<{ ok: boolean; error?: string }>;
  // v4 — optional, detected at runtime
  chatCreateSession?(req: CreateChatSessionRequest): Promise<{ ok: boolean; session?: ChatSession; error?: string }>;
  chatListSessions?(): Promise<ChatSessionSummary[]>;
  chatGetSession?(sessionId: string): Promise<ChatSession | null>;
  chatSendMessage?(req: SendChatMessageRequest): Promise<SendChatMessageResult>;
  chatStop?(sessionId: string): Promise<{ ok: boolean; error?: string }>;
  chatDeleteSession?(sessionId: string): Promise<{ ok: boolean; error?: string }>;
  companionStatus?(): Promise<CompanionStatus>;
  companionEnable?(req?: { port?: number }): Promise<CompanionEnableResult>;
  companionDisable?(): Promise<{ ok: boolean; error?: string }>;
  companionRegenerateToken?(): Promise<CompanionEnableResult>;
  // v5 — optional, detected at runtime
  entList?(): Promise<EnterpriseSummaryDto[]>;
  entGet?(id: string): Promise<EnterpriseRecordDto | null>;
  entCreate?(req: CreateEnterpriseRequest): Promise<{ ok: boolean; record?: EnterpriseRecordDto; created?: boolean; error?: string }>;
  entUpdate?(req: { id: string; expectedVersion: number; name?: string; mission?: string }): Promise<{ ok: boolean; record?: EnterpriseRecordDto; error?: string }>;
  entBlueprintPreview?(req: { enterpriseId: string; expectedVersion: number }): Promise<{ ok: boolean; preview?: EnterpriseBlueprintPreviewDto; error?: string }>;
  entBlueprintApply?(req: { enterpriseId: string; blueprintHash: string; payloadHash: string; expectedVersion: number; confirmed: boolean }): Promise<{ ok: boolean; record?: EnterpriseRecordDto; error?: string }>;
  entApprovalDecide?(req: { enterpriseId: string; approvalId: string; decision: 'approved' | 'rejected'; payloadHash: string }): Promise<{ ok: boolean; approval?: EnterpriseApprovalDto; error?: string }>;
  entContracts?(id: string): Promise<EnterpriseContractDto[]>;
  entContractPropose?(req: {
    enterpriseId: string;
    key: string;
    companyKey: string;
    departmentKey: string;
    discipline: string;
    capacityShare: number;
    skillId: string;
    expectedVersion: number;
  }): Promise<{ ok: boolean; record?: EnterpriseRecordDto; error?: string }>;
  entContractDecide?(req: { enterpriseId: string; contractKey: string; decision: 'approved' | 'rejected'; expectedVersion: number }): Promise<{ ok: boolean; record?: EnterpriseRecordDto; error?: string }>;
  entContractRelease?(req: { enterpriseId: string; contractKey: string; expectedVersion: number }): Promise<{ ok: boolean; record?: EnterpriseRecordDto; error?: string }>;
  entMemory?(id: string, includeRevoked?: boolean): Promise<EnterpriseMemoryDto[]>;
  entMemoryPromote?(req: { enterpriseId: string; artifact: ArtifactRef; scope: string; scopeKey: string; expectedVersion: number }): Promise<{ ok: boolean; approval?: EnterpriseApprovalDto; error?: string }>;
  entMemoryRevoke?(req: { enterpriseId: string; scope: string; scopeKey: string; artifactId: string; expectedVersion: number }): Promise<{ ok: boolean; error?: string }>;
  entMemorySearch?(id: string, query: string): Promise<EnterpriseMemoryDto[]>;
  entProgramStart?(req: { enterpriseId: string; expectedVersion: number }): Promise<{ ok: boolean; error?: string }>;
  entProgramPause?(id: string): Promise<{ ok: boolean; error?: string }>;
  entProgramResume?(id: string): Promise<{ ok: boolean; error?: string }>;
  entProgramCancel?(id: string): Promise<{ ok: boolean; error?: string }>;
  entProgramGet?(id: string): Promise<EnterpriseProgram | null>;
  entProgramPump?(id: string): Promise<{ ok: boolean; dispatched?: number; error?: string }>;
  entSnapshot?(id: string): Promise<EnterpriseSnapshotDto | null>;
  entLedger?(req: { enterpriseId: string; companyKey?: string; workerId?: string; departmentKey?: string }): Promise<WorkLedgerEntry[]>;
  entTimeline?(req: { enterpriseId: string; afterIndex?: number; limit?: number }): Promise<{ entries: TimelineIndexEntry[]; nextIndex: number }>;
  entEvents?(req: { enterpriseId: string; afterIndex?: number; limit?: number }): Promise<{ events: EnterpriseEventDto[]; nextIndex: number }>;
  entWorkerUpdate?(req: {
    enterpriseId: string;
    expectedVersion: number;
    op: 'reassign' | 'capacity' | 'suspend' | 'resume' | 'edit';
    companyKey?: string;
    workerId?: string;
    roomId?: string | null;
    parentId?: string | null;
    contractKey?: string;
    capacityShare?: number;
    instructions?: string;
    budget?: Partial<BudgetLimits>;
  }): Promise<{ ok: boolean; error?: string }>;
  entExport?(id: string): Promise<{ ok: boolean; dir?: string; files?: string[]; error?: string }>;
  entStewards?(id: string): Promise<StewardRecommendation[]>;
  onEnterpriseEvent?(listener: (record: EnterpriseRecordDto) => void): () => void;
  // v6 — optional, detected at runtime (Donna / shared assistants)
  astDefinitions?(): Promise<AssistantDefinitionsDto>;
  astGet?(enterpriseId: string): Promise<AssistantStateDto | null>;
  astPropose?(req: AssistantProposeRequest): Promise<{ ok: boolean; proposal?: AssistantActionProposal; created?: boolean; error?: string }>;
  astDecide?(req: AssistantDecideRequest): Promise<{ ok: boolean; proposal?: AssistantActionProposal; error?: string }>;
  astExecute?(req: AssistantIdRequest): Promise<{ ok: boolean; proposal?: AssistantActionProposal; error?: string }>;
  astCancel?(req: AssistantIdRequest): Promise<{ ok: boolean; proposal?: AssistantActionProposal; error?: string }>;
  astQueueAdd?(req: AssistantQueueAddRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astQueueReorder?(req: AssistantQueueReorderRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astWorkerAction?(req: AssistantWorkerActionRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astLifecycleSet?(req: AssistantLifecycleSetRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astJobUpsert?(req: AssistantJobUpsertRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astJobPause?(req: AssistantJobMutationRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astJobResume?(req: AssistantJobMutationRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astJobDelete?(req: AssistantJobMutationRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astJobRunNow?(req: AssistantJobMutationRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astStudyEnqueue?(req: AssistantStudyEnqueueRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astStudyList?(enterpriseId: string): Promise<StudyQueueItem[]>;
  astRepoPreview?(req: AssistantRepoPreviewRequest): Promise<{ ok: boolean; metadata?: RepositoryMetadata; plan?: RepoAssignmentPlan; error?: string }>;
  astRepoFetch?(req: AssistantRepoFetchRequest): Promise<{ ok: boolean; repository?: AssistantRepositoryDto; error?: string }>;
  astRepoApply?(req: AssistantRepoApplyRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astKnowledgeList?(enterpriseId: string): Promise<KnowledgeTransferRecord[]>;
  astKnowledgeExport?(enterpriseId: string): Promise<{ ok: boolean; dir?: string; files?: string[]; error?: string }>;
  astCacheInvalidate?(req: AssistantCacheInvalidateRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astCacheStatus?(enterpriseId: string): Promise<AssistantCacheStatusDto[]>;
  astEvents?(req: AssistantEventsRequest): Promise<{ events: AssistantEventDto[]; nextIndex: number }>;
  astDonnaPrompt?(req: AssistantDonnaPromptRequest): Promise<{ ok: boolean; prompt?: DonnaPrompt; error?: string }>;
  astDonnaParse?(req: AssistantDonnaParseRequest): Promise<{ ok: boolean; proposals?: AssistantActionProposal[]; dropped?: number; error?: string }>;
  onAssistantEvent?(listener: (event: AssistantEventPushDto) => void): () => void;
}

function unavailable<T>(): BridgeResult<T> {
  return { ok: false, error: UNAVAILABLE_V3, unavailable: true };
}

async function wrap<T>(call: () => Promise<T>): Promise<BridgeResult<T>> {
  try {
    return { ok: true, value: await call() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), unavailable: false };
  }
}

export class BridgeAdapter {
  readonly capabilities: BridgeCapabilities;

  constructor(private readonly raw: RawBridge) {
    this.capabilities = {
      skills: typeof raw.listSkills === 'function',
      hires: typeof raw.hirePreview === 'function' && typeof raw.applyHires === 'function',
      approvals: typeof raw.listApprovals === 'function' && typeof raw.decideApproval === 'function',
      runEvents: typeof raw.readRunEvents === 'function',
      officeUpdate: typeof raw.updateOfficeProject === 'function' && typeof raw.reassignNode === 'function',
      officeSnapshot: typeof raw.getOfficeSnapshot === 'function',
      recovery: typeof raw.recoverRun === 'function',
      chat:
        typeof raw.chatCreateSession === 'function' &&
        typeof raw.chatListSessions === 'function' &&
        typeof raw.chatGetSession === 'function' &&
        typeof raw.chatSendMessage === 'function',
      companion:
        typeof raw.companionStatus === 'function' &&
        typeof raw.companionEnable === 'function' &&
        typeof raw.companionDisable === 'function' &&
        typeof raw.companionRegenerateToken === 'function',
      ceo:
        typeof raw.entList === 'function' &&
        typeof raw.entCreate === 'function' &&
        typeof raw.entSnapshot === 'function' &&
        typeof raw.entProgramStart === 'function' &&
        typeof raw.entLedger === 'function',
      ceoPropose: typeof raw.entContractPropose === 'function',
      assistant:
        typeof raw.astDefinitions === 'function' &&
        typeof raw.astGet === 'function' &&
        typeof raw.astPropose === 'function' &&
        typeof raw.astDecide === 'function' &&
        typeof raw.astExecute === 'function' &&
        typeof raw.astEvents === 'function',
    };
  }

  get bridgeVersion(): number {
    return this.raw.version;
  }

  // ---- v2 pass-throughs ----
  getVaultStatus(): Promise<VaultStatus> {
    return this.raw.getVaultStatus();
  }
  setApiKey(provider: ApiProvider, key: string): Promise<{ ok: boolean; error?: string }> {
    return this.raw.setApiKey(provider, key);
  }
  revokeApiKey(provider: ApiProvider): Promise<{ ok: boolean; error?: string }> {
    return this.raw.revokeApiKey(provider);
  }
  listProviderModels(provider: ProjectProvider): Promise<ListModelsResult> {
    return this.raw.listProviderModels(provider);
  }
  detectOllama(): Promise<OllamaStatus> {
    return this.raw.detectOllama();
  }
  listProjects(): Promise<Project[]> {
    return this.raw.listProjects();
  }
  createProject(req: CreateProjectRequest): Promise<{ ok: boolean; project?: Project; error?: string }> {
    return this.raw.createProject(req);
  }
  getProject(projectId: string): Promise<Project | null> {
    return this.raw.getProject(projectId);
  }
  startRun(req: StartRunRequest): Promise<{ ok: boolean; runId?: string; error?: string }> {
    return this.raw.startRun(req);
  }
  pauseRun(runId: string): Promise<{ ok: boolean; error?: string }> {
    return this.raw.pauseRun(runId);
  }
  resumeRun(runId: string): Promise<{ ok: boolean; error?: string }> {
    return this.raw.resumeRun(runId);
  }
  cancelRun(runId: string): Promise<{ ok: boolean; error?: string }> {
    return this.raw.cancelRun(runId);
  }
  listRuns(projectId?: string): Promise<ProjectRun[]> {
    return this.raw.listRuns(projectId);
  }
  readArtifact(
    projectId: string,
    runId: string,
    nodeId: string,
    attempt?: number,
  ): Promise<{ ok: boolean; text?: string; meta?: ArtifactMeta; error?: string }> {
    return this.raw.readArtifact(projectId, runId, nodeId, attempt);
  }
  getSettings(): Promise<{ runtimeUrl: string | null }> {
    return this.raw.getSettings();
  }
  connectRuntime(url: string): Promise<{ ok: boolean; url?: string; error?: string }> {
    return this.raw.connectRuntime(url);
  }
  onProjectEvent(listener: (run: ProjectRun) => void): () => void {
    return this.raw.onProjectEvent(listener);
  }

  // ---- v3 capability-gated calls ----
  listSkills(): Promise<BridgeResult<SkillSummary[]>> {
    if (!this.capabilities.skills || !this.raw.listSkills) return Promise.resolve(unavailable());
    return wrap(() => this.raw.listSkills!());
  }

  async hirePreview(projectId: string): Promise<BridgeResult<HirePlanPreview>> {
    if (!this.capabilities.hires || !this.raw.hirePreview) return unavailable();
    const res = await wrap(() => this.raw.hirePreview!(projectId));
    if (!res.ok) return res;
    if (!res.value.ok || !res.value.preview) {
      return { ok: false, error: res.value.error ?? 'Hire preview failed.', unavailable: false };
    }
    return { ok: true, value: res.value.preview };
  }

  async applyHires(req: ApplyHiresRequest): Promise<BridgeResult<{ approval?: ApprovalRecord }>> {
    if (!this.capabilities.hires || !this.raw.applyHires) return unavailable();
    const res = await wrap(() => this.raw.applyHires!(req));
    if (!res.ok) return res;
    if (!res.value.ok) return { ok: false, error: res.value.error ?? 'Applying hires failed.', unavailable: false };
    return { ok: true, value: { approval: res.value.approval } };
  }

  async updateOfficeProject(req: UpdateOfficeProjectRequest): Promise<BridgeResult<{ project?: Project }>> {
    if (!this.capabilities.officeUpdate || !this.raw.updateOfficeProject) return unavailable();
    const res = await wrap(() => this.raw.updateOfficeProject!(req));
    if (!res.ok) return res;
    if (!res.value.ok) return { ok: false, error: res.value.error ?? 'Update failed.', unavailable: false };
    return { ok: true, value: { project: res.value.project } };
  }

  async reassignNode(req: ReassignNodeRequest): Promise<BridgeResult<{ project?: Project }>> {
    if (!this.capabilities.officeUpdate || !this.raw.reassignNode) return unavailable();
    const res = await wrap(() => this.raw.reassignNode!(req));
    if (!res.ok) return res;
    if (!res.value.ok) return { ok: false, error: res.value.error ?? 'Reassignment failed.', unavailable: false };
    return { ok: true, value: { project: res.value.project } };
  }

  getOfficeSnapshot(projectId: string, runId?: string): Promise<BridgeResult<OfficeSnapshot | null>> {
    if (!this.capabilities.officeSnapshot || !this.raw.getOfficeSnapshot) return Promise.resolve(unavailable());
    return wrap(() => this.raw.getOfficeSnapshot!(projectId, runId));
  }

  listApprovals(projectId?: string, runId?: string): Promise<BridgeResult<ApprovalRecord[]>> {
    if (!this.capabilities.approvals || !this.raw.listApprovals) return Promise.resolve(unavailable());
    return wrap(() => this.raw.listApprovals!(projectId, runId));
  }

  async decideApproval(req: DecideApprovalRequest): Promise<BridgeResult<{ approval?: ApprovalRecord }>> {
    if (!this.capabilities.approvals || !this.raw.decideApproval) return unavailable();
    const res = await wrap(() => this.raw.decideApproval!(req));
    if (!res.ok) return res;
    if (!res.value.ok) return { ok: false, error: res.value.error ?? 'Decision failed.', unavailable: false };
    return { ok: true, value: { approval: res.value.approval } };
  }

  /**
   * Incremental event page. `afterIndex` (the previous page's nextIndex)
   * returns only newer events; omit it for the full log.
   */
  async readRunEvents(
    projectId: string,
    runId: string,
    afterIndex?: number,
  ): Promise<BridgeResult<{ events: RunEventRecord[]; nextIndex: number }>> {
    if (!this.capabilities.runEvents || !this.raw.readRunEvents) return unavailable();
    const res = await wrap(() => this.raw.readRunEvents!(projectId, runId, afterIndex));
    if (!res.ok) return res;
    if (!res.value.ok) return { ok: false, error: res.value.error ?? 'Reading events failed.', unavailable: false };
    const events = res.value.events ?? [];
    return { ok: true, value: { events, nextIndex: res.value.nextIndex ?? events.length } };
  }

  async recoverRun(runId: string): Promise<BridgeResult<Record<string, never>>> {
    if (!this.capabilities.recovery || !this.raw.recoverRun) return unavailable();
    const res = await wrap(() => this.raw.recoverRun!(runId));
    if (!res.ok) return res;
    if (!res.value.ok) return { ok: false, error: res.value.error ?? 'Recovery failed.', unavailable: false };
    return { ok: true, value: {} };
  }

  // ---- v4 capability-gated calls ----

  chatListSessions(): Promise<BridgeResult<ChatSessionSummary[]>> {
    if (!this.capabilities.chat || !this.raw.chatListSessions) return Promise.resolve(unavailableV4());
    return wrap(() => this.raw.chatListSessions!());
  }

  chatGetSession(sessionId: string): Promise<BridgeResult<ChatSession | null>> {
    if (!this.capabilities.chat || !this.raw.chatGetSession) return Promise.resolve(unavailableV4());
    return wrap(() => this.raw.chatGetSession!(sessionId));
  }

  async chatCreateSession(req: CreateChatSessionRequest): Promise<BridgeResult<ChatSession>> {
    if (!this.capabilities.chat || !this.raw.chatCreateSession) return unavailableV4();
    const res = await wrap(() => this.raw.chatCreateSession!(req));
    if (!res.ok) return res;
    if (!res.value.ok || !res.value.session) {
      return { ok: false, error: res.value.error ?? 'Creating the chat session failed.', unavailable: false };
    }
    return { ok: true, value: res.value.session };
  }

  async chatSendMessage(req: SendChatMessageRequest): Promise<BridgeResult<SendChatMessageResult>> {
    if (!this.capabilities.chat || !this.raw.chatSendMessage) return unavailableV4();
    const res = await wrap(() => this.raw.chatSendMessage!(req));
    if (!res.ok) return res;
    if (!res.value.ok) {
      return { ok: false, error: res.value.error ?? 'Sending the message failed.', unavailable: false };
    }
    return { ok: true, value: res.value };
  }

  async chatStop(sessionId: string): Promise<BridgeResult<Record<string, never>>> {
    if (!this.capabilities.chat || !this.raw.chatStop) return unavailableV4();
    const res = await wrap(() => this.raw.chatStop!(sessionId));
    if (!res.ok) return res;
    if (!res.value.ok) return { ok: false, error: res.value.error ?? 'Stop failed.', unavailable: false };
    return { ok: true, value: {} };
  }

  async chatDeleteSession(sessionId: string): Promise<BridgeResult<Record<string, never>>> {
    if (!this.capabilities.chat || !this.raw.chatDeleteSession) return unavailableV4();
    const res = await wrap(() => this.raw.chatDeleteSession!(sessionId));
    if (!res.ok) return res;
    if (!res.value.ok) return { ok: false, error: res.value.error ?? 'Delete failed.', unavailable: false };
    return { ok: true, value: {} };
  }

  companionStatus(): Promise<BridgeResult<CompanionStatus>> {
    if (!this.capabilities.companion || !this.raw.companionStatus) return Promise.resolve(unavailableV4());
    return wrap(() => this.raw.companionStatus!());
  }

  companionEnable(req?: { port?: number }): Promise<BridgeResult<CompanionEnableResult>> {
    if (!this.capabilities.companion || !this.raw.companionEnable) return Promise.resolve(unavailableV4());
    return wrap(() => this.raw.companionEnable!(req));
  }

  companionDisable(): Promise<BridgeResult<{ ok: boolean; error?: string }>> {
    if (!this.capabilities.companion || !this.raw.companionDisable) return Promise.resolve(unavailableV4());
    return wrap(() => this.raw.companionDisable!());
  }

  companionRegenerateToken(): Promise<BridgeResult<CompanionEnableResult>> {
    if (!this.capabilities.companion || !this.raw.companionRegenerateToken) {
      return Promise.resolve(unavailableV4());
    }
    return wrap(() => this.raw.companionRegenerateToken!());
  }

  // ---- v5 capability-gated calls (CEO mode) ----

  entList(): Promise<BridgeResult<EnterpriseSummaryDto[]>> {
    if (!this.capabilities.ceo || !this.raw.entList) return Promise.resolve(unavailableV5());
    return wrap(() => this.raw.entList!());
  }

  entGet(id: string): Promise<BridgeResult<EnterpriseRecordDto | null>> {
    if (!this.capabilities.ceo || !this.raw.entGet) return Promise.resolve(unavailableV5());
    return wrap(() => this.raw.entGet!(id));
  }

  async entCreate(req: CreateEnterpriseRequest): Promise<BridgeResult<{ record: EnterpriseRecordDto; created: boolean }>> {
    if (!this.capabilities.ceo || !this.raw.entCreate) return unavailableV5();
    const res = await wrap(() => this.raw.entCreate!(req));
    if (!res.ok) return res;
    if (!res.value.ok || !res.value.record) return { ok: false, error: res.value.error ?? 'Create failed.', unavailable: false };
    return { ok: true, value: { record: res.value.record, created: res.value.created === true } };
  }

  entBlueprintPreview(req: { enterpriseId: string; expectedVersion: number }): Promise<BridgeResult<EnterpriseBlueprintPreviewDto>> {
    if (!this.capabilities.ceo || !this.raw.entBlueprintPreview) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await this.raw.entBlueprintPreview!(req);
      if (!res.ok || !res.preview) throw new Error(res.error ?? 'Preview failed.');
      return res.preview;
    });
  }

  entBlueprintApply(req: { enterpriseId: string; blueprintHash: string; payloadHash: string; expectedVersion: number; confirmed: boolean }): Promise<BridgeResult<EnterpriseRecordDto>> {
    if (!this.capabilities.ceo || !this.raw.entBlueprintApply) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await this.raw.entBlueprintApply!(req);
      if (!res.ok || !res.record) throw new Error(res.error ?? 'Apply failed.');
      return res.record;
    });
  }

  entApprovalDecide(req: { enterpriseId: string; approvalId: string; decision: 'approved' | 'rejected'; payloadHash: string }): Promise<BridgeResult<EnterpriseApprovalDto>> {
    if (!this.capabilities.ceo || !this.raw.entApprovalDecide) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await this.raw.entApprovalDecide!(req);
      if (!res.ok || !res.approval) throw new Error(res.error ?? 'Decision failed.');
      return res.approval;
    });
  }

  entContracts(id: string): Promise<BridgeResult<EnterpriseContractDto[]>> {
    if (!this.capabilities.ceo || !this.raw.entContracts) return Promise.resolve(unavailableV5());
    return wrap(() => this.raw.entContracts!(id));
  }

  /** Optional even within v5: older 0.5 bridges may predate contract proposals. */
  entContractPropose(req: {
    enterpriseId: string;
    key: string;
    companyKey: string;
    departmentKey: string;
    discipline: string;
    capacityShare: number;
    skillId: string;
    expectedVersion: number;
  }): Promise<BridgeResult<EnterpriseRecordDto>> {
    if (!this.capabilities.ceo || !this.raw.entContractPropose) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await this.raw.entContractPropose!(req);
      if (!res.ok || !res.record) throw new Error(res.error ?? 'Contract proposal failed.');
      return res.record;
    });
  }

  entContractDecide(req: { enterpriseId: string; contractKey: string; decision: 'approved' | 'rejected'; expectedVersion: number }): Promise<BridgeResult<EnterpriseRecordDto>> {
    if (!this.capabilities.ceo || !this.raw.entContractDecide) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await this.raw.entContractDecide!(req);
      if (!res.ok || !res.record) throw new Error(res.error ?? 'Contract decision failed.');
      return res.record;
    });
  }

  entContractRelease(req: { enterpriseId: string; contractKey: string; expectedVersion: number }): Promise<BridgeResult<EnterpriseRecordDto>> {
    if (!this.capabilities.ceo || !this.raw.entContractRelease) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await this.raw.entContractRelease!(req);
      if (!res.ok || !res.record) throw new Error(res.error ?? 'Contract release failed.');
      return res.record;
    });
  }

  entMemory(id: string, includeRevoked?: boolean): Promise<BridgeResult<EnterpriseMemoryDto[]>> {
    if (!this.capabilities.ceo || !this.raw.entMemory) return Promise.resolve(unavailableV5());
    return wrap(() => this.raw.entMemory!(id, includeRevoked));
  }

  entMemoryPromote(req: { enterpriseId: string; artifact: ArtifactRef; scope: string; scopeKey: string; expectedVersion: number }): Promise<BridgeResult<EnterpriseApprovalDto>> {
    if (!this.capabilities.ceo || !this.raw.entMemoryPromote) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await this.raw.entMemoryPromote!(req);
      if (!res.ok || !res.approval) throw new Error(res.error ?? 'Promotion request failed.');
      return res.approval;
    });
  }

  entMemoryRevoke(req: { enterpriseId: string; scope: string; scopeKey: string; artifactId: string; expectedVersion: number }): Promise<BridgeResult<Record<string, never>>> {
    if (!this.capabilities.ceo || !this.raw.entMemoryRevoke) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await this.raw.entMemoryRevoke!(req);
      if (!res.ok) throw new Error(res.error ?? 'Revoke failed.');
      return {};
    });
  }

  entMemorySearch(id: string, query: string): Promise<BridgeResult<EnterpriseMemoryDto[]>> {
    if (!this.capabilities.ceo || !this.raw.entMemorySearch) return Promise.resolve(unavailableV5());
    return wrap(() => this.raw.entMemorySearch!(id, query));
  }

  entProgramStart(req: { enterpriseId: string; expectedVersion: number }): Promise<BridgeResult<Record<string, never>>> {
    if (!this.capabilities.ceo || !this.raw.entProgramStart) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await this.raw.entProgramStart!(req);
      if (!res.ok) throw new Error(res.error ?? 'Program start failed.');
      return {};
    });
  }

  private entProgramControl(call: (() => Promise<{ ok: boolean; error?: string }>) | undefined, label: string): Promise<BridgeResult<Record<string, never>>> {
    if (!this.capabilities.ceo || !call) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await call();
      if (!res.ok) throw new Error(res.error ?? `${label} failed.`);
      return {};
    });
  }

  entProgramPause(id: string): Promise<BridgeResult<Record<string, never>>> {
    return this.entProgramControl(this.raw.entProgramPause ? () => this.raw.entProgramPause!(id) : undefined, 'Pause');
  }

  entProgramResume(id: string): Promise<BridgeResult<Record<string, never>>> {
    return this.entProgramControl(this.raw.entProgramResume ? () => this.raw.entProgramResume!(id) : undefined, 'Resume');
  }

  entProgramCancel(id: string): Promise<BridgeResult<Record<string, never>>> {
    return this.entProgramControl(this.raw.entProgramCancel ? () => this.raw.entProgramCancel!(id) : undefined, 'Stop');
  }

  entProgramPump(id: string): Promise<BridgeResult<{ dispatched: number }>> {
    if (!this.capabilities.ceo || !this.raw.entProgramPump) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await this.raw.entProgramPump!(id);
      if (!res.ok) throw new Error(res.error ?? 'Pump failed.');
      return { dispatched: res.dispatched ?? 0 };
    });
  }

  entSnapshot(id: string): Promise<BridgeResult<EnterpriseSnapshotDto | null>> {
    if (!this.capabilities.ceo || !this.raw.entSnapshot) return Promise.resolve(unavailableV5());
    return wrap(() => this.raw.entSnapshot!(id));
  }

  entLedger(req: { enterpriseId: string; companyKey?: string; workerId?: string; departmentKey?: string }): Promise<BridgeResult<WorkLedgerEntry[]>> {
    if (!this.capabilities.ceo || !this.raw.entLedger) return Promise.resolve(unavailableV5());
    return wrap(() => this.raw.entLedger!(req));
  }

  entTimeline(req: { enterpriseId: string; afterIndex?: number; limit?: number }): Promise<BridgeResult<{ entries: TimelineIndexEntry[]; nextIndex: number }>> {
    if (!this.capabilities.ceo || !this.raw.entTimeline) return Promise.resolve(unavailableV5());
    return wrap(() => this.raw.entTimeline!(req));
  }

  entEvents(req: { enterpriseId: string; afterIndex?: number; limit?: number }): Promise<BridgeResult<{ events: EnterpriseEventDto[]; nextIndex: number }>> {
    if (!this.capabilities.ceo || !this.raw.entEvents) return Promise.resolve(unavailableV5());
    return wrap(() => this.raw.entEvents!(req));
  }

  entWorkerUpdate(req: {
    enterpriseId: string;
    expectedVersion: number;
    op: 'reassign' | 'capacity' | 'suspend' | 'resume' | 'edit';
    companyKey?: string;
    workerId?: string;
    roomId?: string | null;
    parentId?: string | null;
    contractKey?: string;
    capacityShare?: number;
    instructions?: string;
    budget?: Partial<BudgetLimits>;
  }): Promise<BridgeResult<Record<string, never>>> {
    if (!this.capabilities.ceo || !this.raw.entWorkerUpdate) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await this.raw.entWorkerUpdate!(req);
      if (!res.ok) throw new Error(res.error ?? 'Worker update failed.');
      return {};
    });
  }

  entExport(id: string): Promise<BridgeResult<{ dir: string; files: string[] }>> {
    if (!this.capabilities.ceo || !this.raw.entExport) return Promise.resolve(unavailableV5());
    return wrap(async () => {
      const res = await this.raw.entExport!(id);
      if (!res.ok || !res.dir) throw new Error(res.error ?? 'Export failed.');
      return { dir: res.dir, files: res.files ?? [] };
    });
  }

  entStewards(id: string): Promise<BridgeResult<StewardRecommendation[]>> {
    if (!this.capabilities.ceo || !this.raw.entStewards) return Promise.resolve(unavailableV5());
    return wrap(() => this.raw.entStewards!(id));
  }

  onEnterpriseEvent(listener: (record: EnterpriseRecordDto) => void): (() => void) | null {
    if (!this.capabilities.ceo || !this.raw.onEnterpriseEvent) return null;
    return this.raw.onEnterpriseEvent(listener);
  }

  // ---- v6 capability-gated calls (Donna / shared assistants) ----
  // Real guarded bridge only: every method returns UNAVAILABLE_V6 against a
  // v5 runtime; nothing is fabricated renderer-side. Emergency stop is
  // deliberately absent here — it stays on entProgramCancel / chatStop.

  astDefinitions(): Promise<BridgeResult<AssistantDefinitionsDto>> {
    if (!this.capabilities.assistant || !this.raw.astDefinitions) return Promise.resolve(unavailableV6());
    return wrap(() => this.raw.astDefinitions!());
  }

  astGet(enterpriseId: string): Promise<BridgeResult<AssistantStateDto | null>> {
    if (!this.capabilities.assistant || !this.raw.astGet) return Promise.resolve(unavailableV6());
    return wrap(() => this.raw.astGet!(enterpriseId));
  }

  astPropose(req: AssistantProposeRequest): Promise<BridgeResult<{ proposal: AssistantActionProposal; created: boolean }>> {
    if (!this.capabilities.assistant || !this.raw.astPropose) return Promise.resolve(unavailableV6());
    return wrap(async () => {
      const res = await this.raw.astPropose!(req);
      if (!res.ok || !res.proposal) throw new Error(res.error ?? 'Proposal failed.');
      return { proposal: res.proposal, created: res.created === true };
    });
  }

  astDecide(req: AssistantDecideRequest): Promise<BridgeResult<AssistantActionProposal>> {
    if (!this.capabilities.assistant || !this.raw.astDecide) return Promise.resolve(unavailableV6());
    return wrap(async () => {
      const res = await this.raw.astDecide!(req);
      if (!res.ok || !res.proposal) throw new Error(res.error ?? 'Decision failed.');
      return res.proposal;
    });
  }

  astExecute(req: AssistantIdRequest): Promise<BridgeResult<AssistantActionProposal>> {
    if (!this.capabilities.assistant || !this.raw.astExecute) return Promise.resolve(unavailableV6());
    return wrap(async () => {
      const res = await this.raw.astExecute!(req);
      if (!res.ok || !res.proposal) throw new Error(res.error ?? 'Execution failed.');
      return res.proposal;
    });
  }

  astCancel(req: AssistantIdRequest): Promise<BridgeResult<AssistantActionProposal>> {
    if (!this.capabilities.assistant || !this.raw.astCancel) return Promise.resolve(unavailableV6());
    return wrap(async () => {
      const res = await this.raw.astCancel!(req);
      if (!res.ok || !res.proposal) throw new Error(res.error ?? 'Cancel failed.');
      return res.proposal;
    });
  }

  /** Shared wrapper for the summary-returning direct mutation channels. */
  private astDirect(
    call: (() => Promise<{ ok: boolean; summary?: string; error?: string }>) | undefined,
  ): Promise<BridgeResult<{ summary: string }>> {
    if (!this.capabilities.assistant || !call) return Promise.resolve(unavailableV6());
    return wrap(async () => {
      const res = await call();
      if (!res.ok) throw new Error(res.error ?? 'Assistant action failed.');
      return { summary: res.summary ?? 'done' };
    });
  }

  astQueueAdd(req: AssistantQueueAddRequest): Promise<BridgeResult<{ summary: string }>> {
    return this.astDirect(this.raw.astQueueAdd ? () => this.raw.astQueueAdd!(req) : undefined);
  }

  astQueueReorder(req: AssistantQueueReorderRequest): Promise<BridgeResult<{ summary: string }>> {
    return this.astDirect(this.raw.astQueueReorder ? () => this.raw.astQueueReorder!(req) : undefined);
  }

  astWorkerAction(req: AssistantWorkerActionRequest): Promise<BridgeResult<{ summary: string }>> {
    return this.astDirect(this.raw.astWorkerAction ? () => this.raw.astWorkerAction!(req) : undefined);
  }

  astLifecycleSet(req: AssistantLifecycleSetRequest): Promise<BridgeResult<{ summary: string }>> {
    return this.astDirect(this.raw.astLifecycleSet ? () => this.raw.astLifecycleSet!(req) : undefined);
  }

  astJobUpsert(req: AssistantJobUpsertRequest): Promise<BridgeResult<{ summary: string }>> {
    return this.astDirect(this.raw.astJobUpsert ? () => this.raw.astJobUpsert!(req) : undefined);
  }

  astJobPause(req: AssistantJobMutationRequest): Promise<BridgeResult<{ summary: string }>> {
    return this.astDirect(this.raw.astJobPause ? () => this.raw.astJobPause!(req) : undefined);
  }

  astJobResume(req: AssistantJobMutationRequest): Promise<BridgeResult<{ summary: string }>> {
    return this.astDirect(this.raw.astJobResume ? () => this.raw.astJobResume!(req) : undefined);
  }

  astJobDelete(req: AssistantJobMutationRequest): Promise<BridgeResult<{ summary: string }>> {
    return this.astDirect(this.raw.astJobDelete ? () => this.raw.astJobDelete!(req) : undefined);
  }

  astJobRunNow(req: AssistantJobMutationRequest): Promise<BridgeResult<{ summary: string }>> {
    return this.astDirect(this.raw.astJobRunNow ? () => this.raw.astJobRunNow!(req) : undefined);
  }

  astStudyEnqueue(req: AssistantStudyEnqueueRequest): Promise<BridgeResult<{ summary: string }>> {
    return this.astDirect(this.raw.astStudyEnqueue ? () => this.raw.astStudyEnqueue!(req) : undefined);
  }

  astStudyList(enterpriseId: string): Promise<BridgeResult<StudyQueueItem[]>> {
    if (!this.capabilities.assistant || !this.raw.astStudyList) return Promise.resolve(unavailableV6());
    return wrap(() => this.raw.astStudyList!(enterpriseId));
  }

  astRepoPreview(req: AssistantRepoPreviewRequest): Promise<BridgeResult<{ metadata: RepositoryMetadata; plan: RepoAssignmentPlan }>> {
    if (!this.capabilities.assistant || !this.raw.astRepoPreview) return Promise.resolve(unavailableV6());
    return wrap(async () => {
      const res = await this.raw.astRepoPreview!(req);
      if (!res.ok || !res.metadata || !res.plan) throw new Error(res.error ?? 'Preview failed.');
      return { metadata: res.metadata, plan: res.plan };
    });
  }

  astRepoFetch(req: AssistantRepoFetchRequest): Promise<BridgeResult<AssistantRepositoryDto>> {
    if (!this.capabilities.assistant || !this.raw.astRepoFetch) return Promise.resolve(unavailableV6());
    return wrap(async () => {
      const res = await this.raw.astRepoFetch!(req);
      if (!res.ok || !res.repository) throw new Error(res.error ?? 'Repository fetch failed.');
      return res.repository;
    });
  }

  astRepoApply(req: AssistantRepoApplyRequest): Promise<BridgeResult<{ summary: string }>> {
    return this.astDirect(this.raw.astRepoApply ? () => this.raw.astRepoApply!(req) : undefined);
  }

  astKnowledgeList(enterpriseId: string): Promise<BridgeResult<KnowledgeTransferRecord[]>> {
    if (!this.capabilities.assistant || !this.raw.astKnowledgeList) return Promise.resolve(unavailableV6());
    return wrap(() => this.raw.astKnowledgeList!(enterpriseId));
  }

  astKnowledgeExport(enterpriseId: string): Promise<BridgeResult<{ dir: string; files: string[] }>> {
    if (!this.capabilities.assistant || !this.raw.astKnowledgeExport) return Promise.resolve(unavailableV6());
    return wrap(async () => {
      const res = await this.raw.astKnowledgeExport!(enterpriseId);
      if (!res.ok || !res.dir) throw new Error(res.error ?? 'Export failed.');
      return { dir: res.dir, files: res.files ?? [] };
    });
  }

  astCacheInvalidate(req: AssistantCacheInvalidateRequest): Promise<BridgeResult<{ summary: string }>> {
    return this.astDirect(this.raw.astCacheInvalidate ? () => this.raw.astCacheInvalidate!(req) : undefined);
  }

  astCacheStatus(enterpriseId: string): Promise<BridgeResult<AssistantCacheStatusDto[]>> {
    if (!this.capabilities.assistant || !this.raw.astCacheStatus) return Promise.resolve(unavailableV6());
    return wrap(() => this.raw.astCacheStatus!(enterpriseId));
  }

  astEvents(req: AssistantEventsRequest): Promise<BridgeResult<{ events: AssistantEventDto[]; nextIndex: number }>> {
    if (!this.capabilities.assistant || !this.raw.astEvents) return Promise.resolve(unavailableV6());
    return wrap(() => this.raw.astEvents!(req));
  }

  astDonnaPrompt(req: AssistantDonnaPromptRequest): Promise<BridgeResult<DonnaPrompt>> {
    if (!this.capabilities.assistant || !this.raw.astDonnaPrompt) return Promise.resolve(unavailableV6());
    return wrap(async () => {
      const res = await this.raw.astDonnaPrompt!(req);
      if (!res.ok || !res.prompt) throw new Error(res.error ?? 'Donna prompt failed.');
      return res.prompt;
    });
  }

  /** Parses untrusted Donna reply text into DRAFT proposals only — never executes. */
  astDonnaParse(req: AssistantDonnaParseRequest): Promise<BridgeResult<{ proposals: AssistantActionProposal[]; dropped: number }>> {
    if (!this.capabilities.assistant || !this.raw.astDonnaParse) return Promise.resolve(unavailableV6());
    return wrap(async () => {
      const res = await this.raw.astDonnaParse!(req);
      if (!res.ok) throw new Error(res.error ?? 'Donna parse failed.');
      return { proposals: res.proposals ?? [], dropped: res.dropped ?? 0 };
    });
  }

  onAssistantEvent(listener: (event: AssistantEventPushDto) => void): (() => void) | null {
    if (!this.capabilities.assistant || !this.raw.onAssistantEvent) return null;
    return this.raw.onAssistantEvent(listener);
  }
}

function unavailableV4<T>(): BridgeResult<T> {
  return { ok: false, error: UNAVAILABLE_V4, unavailable: true };
}

function unavailableV5<T>(): BridgeResult<T> {
  return { ok: false, error: UNAVAILABLE_V5, unavailable: true };
}

function unavailableV6<T>(): BridgeResult<T> {
  return { ok: false, error: UNAVAILABLE_V6, unavailable: true };
}

export type { ModelInfo, PriceRates, BudgetLimits };
