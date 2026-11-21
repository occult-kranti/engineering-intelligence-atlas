/**
 * Shared fixtures for renderer tests: a programmable mock bridge matching the
 * v3 contract in src/shared/contract.ts (v2-only mode omits v3 methods), and
 * a DOM fixture loaded from the real chrome.html so markup and controller
 * never drift apart.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { RawBridge } from '../../src/renderer/office/bridge';
import type {
  ApprovalRecord,
  ApplyHiresRequest,
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
  CompanionEnableResult,
  CompanionStatus,
  DecideApprovalRequest,
  HirePlanPreview,
  OfficeSnapshot,
  Project,
  ProjectRun,
  ReassignNodeRequest,
  RunEventRecord,
  SkillSummary,
} from '../../src/renderer/office/types';

export function sampleProject(): Project {
  return {
    id: 'proj-1',
    name: 'Atlas Study',
    goal: 'Map the offline atlas coverage',
    provider: 'openai',
    model: 'gpt-5.2',
    version: 3,
    template: 'office',
    successCriteria: ['Report covers all catalog families'],
    loopPolicy: { maxIterations: 3, noProgressLimit: 2 },
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
    nodes: [
      {
        id: 'n-director',
        role: 'director',
        title: 'Director',
        instructions: 'Plan the work',
        dependsOn: [],
        status: 'pending',
        budget: { maxTokens: 4096, maxMinutes: 5, maxUsd: 0.25 },
        kind: 'director',
        depth: 0,
      },
      {
        id: 'n-research-lead',
        role: 'research',
        title: 'Research Lead',
        instructions: 'Lead research',
        dependsOn: ['n-director'],
        status: 'pending',
        budget: { maxTokens: 4096, maxMinutes: 5, maxUsd: 0.25 },
        parentId: 'n-director',
        kind: 'subdirector',
        depth: 1,
        skillRef: 'skill:web-research',
      },
      {
        id: 'n-researcher',
        role: 'research',
        title: 'Researcher A',
        instructions: 'Research',
        dependsOn: ['n-research-lead'],
        status: 'pending',
        budget: { maxTokens: 4096, maxMinutes: 5, maxUsd: 0.25 },
        parentId: 'n-research-lead',
        roomId: 'room:fieldwork',
        kind: 'worker',
        depth: 2,
      },
      {
        id: 'n-builder',
        role: 'build',
        title: 'Builder',
        instructions: 'Build the deliverable',
        dependsOn: ['n-director'],
        status: 'pending',
        budget: { maxTokens: 8192, maxMinutes: 5, maxUsd: 0.5 },
        kind: 'worker',
        depth: 1,
      },
      {
        id: 'n-reviewer',
        role: 'review',
        title: 'Reviewer',
        instructions: 'Review',
        dependsOn: ['n-builder'],
        status: 'pending',
        budget: { maxTokens: 4096, maxMinutes: 5, maxUsd: 0.25 },
        kind: 'worker',
        depth: 1,
        approvalBefore: true,
      },
    ],
  };
}

export function sampleRun(overrides: Partial<ProjectRun> = {}): ProjectRun {
  return {
    id: 'run-1',
    projectId: 'proj-1',
    status: 'running',
    terminationReason: null,
    error: null,
    runBudget: { maxTokens: 20000, maxMinutes: 10, maxUsd: 1 },
    priceRates: { inputUsdPerMillion: 0, outputUsdPerMillion: 0 },
    usage: { inputTokens: 1200, outputTokens: 800, costUsd: 0.0042, elapsedSeconds: 61 },
    nodeStates: {
      'n-director': {
        status: 'succeeded',
        usage: { inputTokens: 500, outputTokens: 300, costUsd: 0.002 },
        artifactId: 'art-director',
        error: null,
        startedAt: '2026-02-01T10:00:00.000Z',
        finishedAt: '2026-02-01T10:00:30.000Z',
        attempt: 1,
        artifactIds: ['art-director'],
      },
      'n-research-lead': {
        status: 'running',
        usage: { inputTokens: 700, outputTokens: 500, costUsd: 0.0022 },
        artifactId: null,
        error: null,
        startedAt: '2026-02-01T10:00:31.000Z',
        finishedAt: null,
        attempt: 2,
      },
    },
    loops: {
      'n-reviewer': { iterations: 1, noProgress: 0, targetHashes: { 'n-builder': 'abc' } },
    },
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:01:00.000Z',
    finishedAt: null,
    ...overrides,
  };
}

export function sampleEvents(): RunEventRecord[] {
  return [
    { ts: '2026-02-01T10:00:01.000Z', runId: 'run-1', event: 'run-started' },
    { ts: '2026-02-01T10:00:30.000Z', runId: 'run-1', event: 'node-succeeded', nodeId: 'n-director' },
    { ts: '2026-02-01T10:05:00.000Z', runId: 'run-1', event: 'loop-requeued', nodeId: 'n-builder', detail: 'revision requested by Reviewer' },
    { ts: '2026-02-01T10:05:10.000Z', runId: 'run-1', event: 'node-started', nodeId: 'n-builder', status: 'running' },
  ];
}

export function sampleApprovals(): ApprovalRecord[] {
  return [
    {
      id: 'ap-1',
      kind: 'hire',
      projectId: 'proj-1',
      runId: null,
      nodeId: null,
      payloadHash: 'f'.repeat(64),
      payload: { plan: [{ nodeId: 'n-researcher', skillId: 'skill:web-research' }] },
      status: 'pending',
      createdAt: '2026-02-01T10:02:00.000Z',
      decidedAt: null,
    },
    {
      id: 'ap-2',
      kind: 'node',
      projectId: 'proj-1',
      runId: 'run-1',
      nodeId: 'n-reviewer',
      payloadHash: 'e'.repeat(64),
      payload: { nodeTitle: 'Reviewer', reason: 'approvalBefore gate' },
      status: 'approved',
      createdAt: '2026-02-01T10:01:00.000Z',
      decidedAt: '2026-02-01T10:01:30.000Z',
    },
  ];
}

export function sampleSkills(): SkillSummary[] {
  return [
    {
      id: 'skill:web-research',
      name: 'Web Research',
      description: 'Structured web research with citations.',
      role: 'research',
      keywords: ['research', 'citations'],
      sha256: 'a'.repeat(64),
      path: 'research/web-research/SKILL.md',
      verified: true,
    },
    {
      id: 'skill:doc-review',
      name: 'Document Review',
      description: 'Adversarial review of long documents.',
      role: 'review',
      keywords: ['review'],
      sha256: 'b'.repeat(64),
      path: 'review/doc-review/SKILL.md',
      verified: false,
    },
  ];
}

export function sampleHirePreview(): HirePlanPreview {
  return {
    projectId: 'proj-1',
    projectVersion: 3,
    planHash: '9'.repeat(64),
    assignments: [
      {
        nodeId: 'n-researcher',
        nodeTitle: 'Researcher A',
        skillId: 'skill:web-research',
        skillName: 'Web Research',
        skillSha256: 'a'.repeat(64),
        matchedKeywords: ['research'],
        score: 7,
      },
    ],
  };
}

export function sampleOfficeSnapshot(project: Project, runId: string | null): OfficeSnapshot {
  const rooms = new Map<string, { id: string; label: string; order: number; members: OfficeSnapshot['rooms'][number]['members'] }>();
  project.nodes.forEach((node, index) => {
    const roomId = node.roomId ?? `room:${node.role}`;
    let room = rooms.get(roomId);
    if (!room) {
      const label = roomId.replace(/^room:/, '');
      room = { id: roomId, label: label.charAt(0).toUpperCase() + label.slice(1), order: rooms.size, members: [] };
      rooms.set(roomId, room);
    }
    room.members.push({
      nodeId: node.id,
      title: node.title,
      kind: node.kind ?? null,
      role: node.role,
      depth: node.depth ?? null,
      parentId: node.parentId ?? null,
      roomId,
      skillRef: node.skillRef ?? null,
      status: node.status,
    });
    void index;
  });
  return {
    projectId: project.id,
    version: project.version,
    template: project.template ?? 'standard',
    runId,
    rooms: [...rooms.values()],
    nodeCount: project.nodes.length,
  };
}

export interface MockBridgeOptions {
  project?: Project | null;
  run?: ProjectRun | null;
  events?: RunEventRecord[];
  approvals?: ApprovalRecord[];
  skills?: SkillSummary[];
  hirePreview?: HirePlanPreview;
  /** When true, all v3 methods are installed (default false = v2-only bridge). */
  v3?: boolean;
  /** When true, v4 chat + companion methods are installed (implies v3). */
  v4?: boolean;
  /** Pre-seeded chat sessions (v4). */
  chatSessions?: ChatSession[];
  companion?: Partial<CompanionStatus>;
  /** Programmable second project for rapid-switch tests. */
  projects?: Project[];
}

export interface MockBridge {
  bridge: RawBridge;
  calls: {
    decideApproval: DecideApprovalRequest[];
    recoverRun: string[];
    applyHires: ApplyHiresRequest[];
    reassignNode: ReassignNodeRequest[];
    hirePreview: string[];
    chatSend: Array<{ sessionId: string; text: string; confirmed: boolean }>;
    readRunEvents: Array<{ projectId: string; runId: string; afterIndex?: number }>;
    getProject: string[];
    companionEnable: number;
    companionDisable: number;
    companionRegenerate: number;
  };
  projectEvents: Array<(run: ProjectRun) => void>;
  /** Test control: append events to the run log (incremental reads see them). */
  pushEvents(events: RunEventRecord[]): void;
  /** Test control: complete the pending assistant reply in a session. */
  completeChat(sessionId: string, text: string): void;
  chatSessions: ChatSession[];
}

export function sampleChatSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 'chat-1',
    title: 'Atlas Study Director',
    projectId: 'proj-1',
    provider: 'openai',
    model: 'gpt-5.2',
    skillIds: ['skill:web-research'],
    priceRates: { inputUsdPerMillion: 5, outputUsdPerMillion: 15 },
    budget: { maxTokens: 50000, maxMinutes: 30, maxUsd: 2 },
    usage: { inputTokens: 800, outputTokens: 400, costUsd: 0.01, elapsedSeconds: 12 },
    messages: [],
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
    ...overrides,
  };
}

export function sampleChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    status: 'completed',
    text: 'Director reply text',
    error: null,
    usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.001 },
    provenance: {
      provider: 'openai',
      model: 'gpt-5.2',
      skillIds: ['skill:web-research'],
      skillSha256: { 'skill:web-research': 'a'.repeat(64) },
      promptSha256: 'c'.repeat(64),
      textSha256: 'd'.repeat(64),
    },
    actions: [],
    createdAt: '2026-02-01T10:00:05.000Z',
    finishedAt: '2026-02-01T10:00:07.000Z',
    ...overrides,
  };
}

export function makeMockBridge(opts: MockBridgeOptions = {}): MockBridge {
  const project = opts.project === undefined ? sampleProject() : opts.project;
  const run = opts.run === undefined ? sampleRun() : opts.run;
  const v3 = opts.v3 || opts.v4;
  const calls: MockBridge['calls'] = {
    decideApproval: [],
    recoverRun: [],
    applyHires: [],
    reassignNode: [],
    hirePreview: [],
    chatSend: [],
    readRunEvents: [],
    getProject: [],
    companionEnable: 0,
    companionDisable: 0,
    companionRegenerate: 0,
  };
  const projectEvents: Array<(run: ProjectRun) => void> = [];

  let currentRun = run;
  let approvals = [...(opts.approvals ?? [])];
  let eventLog = [...(opts.events ?? sampleEvents())];
  const allProjects = opts.projects ?? (project ? [project] : []);
  const chatSessions: ChatSession[] = (opts.chatSessions ?? []).map((s) => ({
    ...s,
    messages: [...s.messages],
  }));
  const companionState: CompanionStatus = {
    enabled: false,
    running: false,
    port: null,
    encryptionAvailable: true,
    paired: false,
    ...opts.companion,
  };

  const chatSummary = (s: ChatSession): ChatSessionSummary => {
    const { messages, ...rest } = s;
    return { ...rest, messageCount: messages.length };
  };

  const bridge: RawBridge = {
    version: opts.v4 ? 4 : v3 ? 3 : 2,
    getVaultStatus: async () => ({
      encryptionAvailable: true,
      providers: {
        openai: { configured: true, readable: true, updatedAt: '2026-01-01T00:00:00.000Z' },
        anthropic: { configured: false, readable: false, updatedAt: null },
      },
    }),
    setApiKey: async () => ({ ok: true }),
    revokeApiKey: async () => ({ ok: true }),
    listProviderModels: async () => ({ ok: true, models: [{ id: 'gpt-5.2', label: 'GPT 5.2' }] }),
    detectOllama: async () => ({ available: false, baseUrl: 'http://127.0.0.1:11434', models: [], error: 'not running' }),
    listProjects: async () => allProjects,
    createProject: async (req) => ({
      ok: true,
      project: {
        ...(project ?? sampleProject()),
        id: 'proj-new',
        name: req.name,
        goal: req.goal,
        template: req.template,
        successCriteria: req.successCriteria,
        loopPolicy: req.loopPolicy,
      },
    }),
    getProject: async (projectId) => {
      calls.getProject.push(projectId);
      return allProjects.find((p) => p.id === projectId) ?? null;
    },
    startRun: async () => ({ ok: true, runId: 'run-2' }),
    pauseRun: async () => ({ ok: true }),
    resumeRun: async () => ({ ok: true }),
    cancelRun: async () => ({ ok: true }),
    listRuns: async () => (currentRun ? [currentRun] : []),
    readArtifact: async () => ({
      ok: true,
      text: 'Artifact body text',
      meta: {
        artifactId: 'art-director',
        projectId: 'proj-1',
        runId: 'run-1',
        nodeId: 'n-director',
        role: 'director',
        provider: 'openai',
        model: 'gpt-5.2',
        createdAt: '2026-02-01T10:00:30.000Z',
        inputTokens: 500,
        outputTokens: 300,
        costUsd: 0.002,
        promptSha256: 'c'.repeat(64),
        textSha256: 'd'.repeat(64),
      },
    }),
    getSettings: async () => ({ runtimeUrl: null }),
    connectRuntime: async () => ({ ok: true, url: 'https://director.example.com' }),
    openExternal: async () => ({ ok: true }),
    onProjectEvent: (listener) => {
      projectEvents.push(listener);
      return () => {
        const idx = projectEvents.indexOf(listener);
        if (idx >= 0) projectEvents.splice(idx, 1);
      };
    },
  };

  if (v3) {
    bridge.listSkills = async () => opts.skills ?? sampleSkills();
    bridge.hirePreview = async (projectId) => {
      calls.hirePreview.push(projectId);
      return { ok: true, preview: opts.hirePreview ?? sampleHirePreview() };
    };
    bridge.applyHires = async (req) => {
      calls.applyHires.push(req);
      const approval: ApprovalRecord = {
        id: 'ap-hire-1',
        kind: 'hire',
        projectId: req.projectId,
        runId: null,
        nodeId: null,
        payloadHash: '9'.repeat(64),
        payload: { assignments: req.assignments },
        status: 'pending',
        createdAt: '2026-02-01T10:04:00.000Z',
        decidedAt: null,
      };
      approvals = [...approvals, approval];
      return { ok: true, approval };
    };
    bridge.updateOfficeProject = async () => ({ ok: true, project: project ?? undefined });
    bridge.reassignNode = async (req) => {
      calls.reassignNode.push(req);
      return { ok: true, project: project ?? undefined };
    };
    bridge.getOfficeSnapshot = async (projectId, runId) => {
      const found = allProjects.find((p) => p.id === projectId);
      return found ? sampleOfficeSnapshot(found, runId ?? null) : null;
    };
    bridge.listApprovals = async () => approvals;
    bridge.decideApproval = async (req) => {
      calls.decideApproval.push(req);
      const record = approvals.find((a) => a.id === req.approvalId);
      if (!record || record.payloadHash !== req.payloadHash) {
        return { ok: false, error: 'approval not found or payload mismatch' };
      }
      approvals = approvals.map((a) =>
        a.id === req.approvalId ? { ...a, status: req.decision, decidedAt: '2026-02-01T10:03:00.000Z' } : a,
      );
      return { ok: true, approval: approvals.find((a) => a.id === req.approvalId) };
    };
    bridge.readRunEvents = async (projectId, runId, afterIndex) => {
      calls.readRunEvents.push({ projectId, runId, afterIndex });
      const from = afterIndex ?? 0;
      return { ok: true, events: eventLog.slice(from), nextIndex: eventLog.length };
    };
    bridge.recoverRun = async (runId) => {
      calls.recoverRun.push(runId);
      currentRun = currentRun ? { ...currentRun, status: 'paused' } : null;
      return { ok: true };
    };
  }

  if (opts.v4) {
    bridge.chatListSessions = async () => chatSessions.map(chatSummary);
    bridge.chatGetSession = async (sessionId) =>
      chatSessions.find((s) => s.id === sessionId) ?? null;
    bridge.chatCreateSession = async (req) => {
      const session: ChatSession = {
        id: `chat-${chatSessions.length + 1}`,
        title: req.title ?? 'Director chat',
        projectId: req.projectId ?? null,
        provider: req.provider,
        model: req.model,
        skillIds: req.skillIds ?? [],
        priceRates: req.priceRates,
        budget: { maxTokens: 50000, maxMinutes: 30, maxUsd: 2, ...req.budget },
        usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, elapsedSeconds: 0 },
        messages: [],
        createdAt: '2026-02-01T10:06:00.000Z',
        updatedAt: '2026-02-01T10:06:00.000Z',
      };
      chatSessions.push(session);
      return { ok: true, session };
    };
    bridge.chatSendMessage = async (req) => {
      calls.chatSend.push(req);
      const session = chatSessions.find((s) => s.id === req.sessionId);
      if (!session) return { ok: false, error: 'session not found' };
      const userMsg: ChatMessage = sampleChatMessage({
        id: `msg-u-${session.messages.length}`,
        role: 'user',
        text: req.text,
        usage: null,
        provenance: null,
      });
      const assistantMsg: ChatMessage = sampleChatMessage({
        id: `msg-a-${session.messages.length}`,
        status: 'pending',
        text: '',
        usage: null,
        provenance: null,
        finishedAt: null,
      });
      session.messages.push(userMsg, assistantMsg);
      return { ok: true, userMessageId: userMsg.id, assistantMessageId: assistantMsg.id };
    };
    bridge.chatStop = async (sessionId) => {
      const session = chatSessions.find((s) => s.id === sessionId);
      for (const m of session?.messages ?? []) {
        if (m.status === 'pending') m.status = 'cancelled';
      }
      return { ok: true };
    };
    bridge.chatDeleteSession = async (sessionId) => {
      const idx = chatSessions.findIndex((s) => s.id === sessionId);
      if (idx >= 0) chatSessions.splice(idx, 1);
      return { ok: true };
    };
    bridge.companionStatus = async () => ({ ...companionState });
    bridge.companionEnable = async () => {
      calls.companionEnable += 1;
      companionState.enabled = true;
      companionState.running = true;
      companionState.port = 47120;
      companionState.paired = true;
      const result: CompanionEnableResult = { ok: true, token: 'pair-token-shown-once', port: 47120 };
      return result;
    };
    bridge.companionDisable = async () => {
      calls.companionDisable += 1;
      companionState.enabled = false;
      companionState.running = false;
      companionState.port = null;
      return { ok: true };
    };
    bridge.companionRegenerateToken = async () => {
      calls.companionRegenerate += 1;
      return { ok: true, token: 'pair-token-regenerated', port: 47120 };
    };
  }

  return {
    bridge,
    calls,
    projectEvents,
    chatSessions,
    pushEvents: (events) => {
      eventLog = [...eventLog, ...events];
    },
    completeChat: (sessionId, text) => {
      const session = chatSessions.find((s) => s.id === sessionId);
      for (const m of session?.messages ?? []) {
        if (m.role === 'assistant' && m.status === 'pending') {
          m.status = 'completed';
          m.text = text;
          m.finishedAt = '2026-02-01T10:00:09.000Z';
          m.usage = { inputTokens: 120, outputTokens: 60, costUsd: 0.0015 };
        }
      }
    },
  };
}

/** Load the real chrome.html body into the jsdom document. */
export function mountChromeDom(): HTMLElement {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'renderer', 'chrome.html'), 'utf8');
  const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
  if (!bodyMatch || !bodyMatch[1]) throw new Error('chrome.html body not found');
  document.body.innerHTML = bodyMatch[1];
  const root = document.getElementById('projects-view');
  if (!root) throw new Error('projects-view missing');
  return root;
}

export interface FakePanzoom {
  transform: { x: number; y: number; scale: number };
  zoomAbsCalls: number;
  smoothZoomCalls: number;
  moveToCalls: number;
  moveByCalls: number;
  showRectangleCalls: number;
  disposeCount: number;
  handlers: Map<string, Array<(...args: unknown[]) => void>>;
  fire(event: string): void;
}

/** Fake implementing the vendored panzoom 9.x API surface the canvas uses. */
export function makeFakePanzoom(): { factory: (elem: HTMLElement) => object; tracker: FakePanzoom } {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const tracker: FakePanzoom = {
    transform: { x: 0, y: 0, scale: 1 },
    zoomAbsCalls: 0,
    smoothZoomCalls: 0,
    moveToCalls: 0,
    moveByCalls: 0,
    showRectangleCalls: 0,
    disposeCount: 0,
    handlers,
    fire: (event) => {
      for (const cb of handlers.get(event) ?? []) cb();
    },
  };
  return {
    tracker,
    factory: () => ({
      getTransform: () => ({ ...tracker.transform }),
      getScale: () => tracker.transform.scale,
      zoomAbs: (_x: number, _y: number, scale: number) => {
        tracker.transform.scale = scale;
        tracker.zoomAbsCalls += 1;
      },
      smoothZoom: (_x: number, _y: number, factor: number) => {
        tracker.transform.scale *= factor;
        tracker.smoothZoomCalls += 1;
      },
      smoothZoomAbs: (_x: number, _y: number, scale: number) => {
        tracker.transform.scale = scale;
        tracker.smoothZoomCalls += 1;
      },
      moveTo: (x: number, y: number) => {
        tracker.transform.x = x;
        tracker.transform.y = y;
        tracker.moveToCalls += 1;
      },
      moveBy: (dx: number, dy: number) => {
        tracker.transform.x += dx;
        tracker.transform.y += dy;
        tracker.moveByCalls += 1;
      },
      showRectangle: () => {
        tracker.showRectangleCalls += 1;
      },
      on: (name: string, cb: (...args: unknown[]) => void) => {
        const list = handlers.get(name) ?? [];
        list.push(cb);
        handlers.set(name, list);
      },
      dispose: () => {
        tracker.disposeCount += 1;
      },
    }),
  };
}

/** Flush pending microtasks so fire-and-forget async render chains settle. */
export async function flush(times = 10): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}
