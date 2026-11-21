// Generates a self-contained UX screenshot harness: dist/renderer/chrome.harness.html
// with a realistic v4 mock bridge (7-node office, live run, approvals, 18 bundled
// skills, Director chat, companion) injected before chrome.js.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist', 'renderer');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'resources', 'skills', 'skills.catalog.json'), 'utf8'));

const sha = (ch) => ch.repeat(64);
const roleFor = (id) =>
  id.includes('engineering') || id.includes('runtime') || id.includes('geometry') || id.includes('game')
    ? 'build'
    : id.includes('director') || id.includes('organization')
      ? 'director'
      : 'research';

const skills = catalog.skills.map((s, i) => ({
  id: s.id,
  name: s.name,
  description: s.description.split('.')[0] + '.',
  role: roleFor(s.id),
  keywords: [s.id.split('-')[0], 'bundled'],
  sha256: sha(String((i % 9) + 1)),
  path: `${roleFor(s.id)}/${s.id}/SKILL.md`,
  verified: i !== 7, // one honest mismatch for visual variety
}));

const now = Date.parse('2026-02-04T14:00:00Z');
const ts = (min) => new Date(now + min * 60000).toISOString();

const project = {
  id: 'proj-atlas',
  name: 'Atlas Research Study',
  goal: 'Survey local open-model runtimes for a bounded research office and publish a comparison report.',
  provider: 'openai',
  model: 'gpt-5.2',
  template: 'office',
  successCriteria: ['Runtime comparison matrix published', 'All claims cited'],
  loopPolicy: { maxIterations: 3, noProgressLimit: 2 },
  version: 4,
  createdAt: ts(-400),
  nodes: [
    { id: 'n-director', title: 'Director', role: 'director', kind: 'director', parentId: null, dependsOn: [], approvalBefore: false, budget: { maxTokens: 20000, maxMinutes: 20, maxUsd: 1 }, instructions: 'Coordinate the study.' },
    { id: 'n-research-lead', title: 'Research Sub-Director', role: 'research', kind: 'worker', parentId: 'n-director', dependsOn: ['n-director'], approvalBefore: false, budget: { maxTokens: 15000, maxMinutes: 15, maxUsd: 0.6 } },
    { id: 'n-researcher', title: 'Researcher', role: 'research', kind: 'worker', parentId: 'n-research-lead', dependsOn: ['n-research-lead'], approvalBefore: false, skillRef: 'skill:web-research', budget: { maxTokens: 15000, maxMinutes: 15, maxUsd: 0.6 } },
    { id: 'n-eng-lead', title: 'Engineering Sub-Director', role: 'build', kind: 'worker', parentId: 'n-director', dependsOn: ['n-director'], approvalBefore: false, budget: { maxTokens: 15000, maxMinutes: 15, maxUsd: 0.6 } },
    { id: 'n-builder', title: 'Builder', role: 'build', kind: 'worker', parentId: 'n-eng-lead', dependsOn: ['n-researcher'], approvalBefore: false, skillRef: 'skill:report-builder', budget: { maxTokens: 15000, maxMinutes: 15, maxUsd: 0.6 } },
    { id: 'n-review-lead', title: 'Review Sub-Director', role: 'review', kind: 'worker', parentId: 'n-director', dependsOn: ['n-director'], approvalBefore: false, budget: { maxTokens: 12000, maxMinutes: 12, maxUsd: 0.4 } },
    { id: 'n-reviewer', title: 'Reviewer', role: 'review', kind: 'worker', parentId: 'n-review-lead', dependsOn: ['n-builder'], approvalBefore: true, skillRef: 'skill:doc-review', budget: { maxTokens: 12000, maxMinutes: 12, maxUsd: 0.4 } },
  ],
};

const run = {
  id: 'run-2026-02-04-atlas',
  projectId: project.id,
  status: 'waiting-approval',
  terminationReason: null,
  error: null,
  createdAt: ts(-38),
  usage: { inputTokens: 18450, outputTokens: 7320, costUsd: 0.2012, elapsedSeconds: 2275 },
  loops: { 'n-reviewer': { iterations: 1, noProgress: 0 } },
  nodeStates: {
    'n-director': { status: 'completed', error: null, usage: { inputTokens: 3200, outputTokens: 1400, costUsd: 0.037 }, artifactId: 'art-dir-01', artifactIds: ['art-dir-01'], attempt: 1 },
    'n-research-lead': { status: 'completed', error: null, usage: { inputTokens: 4100, outputTokens: 1900, costUsd: 0.049 }, artifactId: 'art-rl-01', artifactIds: ['art-rl-01'], attempt: 1 },
    'n-researcher': { status: 'completed', error: null, usage: { inputTokens: 6200, outputTokens: 2800, costUsd: 0.073 }, artifactId: 'art-res-02', artifactIds: ['art-res-01', 'art-res-02'], attempt: 2 },
    'n-eng-lead': { status: 'running', error: null, usage: { inputTokens: 2100, outputTokens: 620, costUsd: 0.019 }, artifactId: null, artifactIds: [], attempt: 1 },
    'n-builder': { status: 'running', error: null, usage: { inputTokens: 1850, outputTokens: 400, costUsd: 0.015 }, artifactId: null, artifactIds: [], attempt: 1 },
    'n-review-lead': { status: 'pending', error: null, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 }, artifactId: null, artifactIds: [], attempt: 0 },
    'n-reviewer': { status: 'waiting-approval', error: null, usage: { inputTokens: 1000, outputTokens: 200, costUsd: 0.0082 }, artifactId: null, artifactIds: [], attempt: 1 },
  },
};

const eventKinds = ['run-started', 'node-started', 'node-output', 'node-completed', 'loop-requeued', 'approval-requested'];
const events = [];
let evN = 0;
for (let i = 0; i < 26; i += 1) {
  const kind = eventKinds[Math.min(eventKinds.length - 1, Math.floor(i / 5))];
  evN += kind === 'loop-requeued' ? 0 : 1;
  events.push({
    id: `ev-${i}`,
    runId: run.id,
    projectId: project.id,
    nodeId: ['n-director', 'n-researcher', 'n-builder', 'n-reviewer'][i % 4],
    event: kind,
    status: kind === 'node-completed' ? 'completed' : 'running',
    detail: `${kind.replaceAll('-', ' ')} — step ${i + 1} of the study run`,
    tokens: 120 * (i + 1),
    costUsd: 0.004 * (i + 1),
    ts: ts(-38 + i),
  });
}

const approvals = [
  {
    id: 'ap-hire-1',
    kind: 'hire',
    projectId: project.id,
    runId: null,
    nodeId: null,
    payloadHash: sha('f'),
    payload: {
      plan: [
        { nodeId: 'n-researcher', nodeTitle: 'Researcher', skillId: 'skill:web-research', skillName: 'Web Research' },
        { nodeId: 'n-reviewer', nodeTitle: 'Reviewer', skillId: 'skill:doc-review', skillName: 'Document Review' },
      ],
    },
    status: 'pending',
    createdAt: ts(-12),
    decidedAt: null,
  },
  {
    id: 'ap-node-1',
    kind: 'node',
    projectId: project.id,
    runId: run.id,
    nodeId: 'n-reviewer',
    payloadHash: sha('e'),
    payload: { nodeTitle: 'Reviewer', reason: 'approvalBefore gate', instructions: 'Verify every claim in the report draft against its citation.' },
    status: 'pending',
    createdAt: ts(-4),
    decidedAt: null,
  },
  {
    id: 'ap-node-0',
    kind: 'node',
    projectId: project.id,
    runId: run.id,
    nodeId: 'n-researcher',
    payloadHash: sha('d'),
    payload: { nodeTitle: 'Researcher', reason: 'second attempt after loop revision' },
    status: 'approved',
    createdAt: ts(-20),
    decidedAt: ts(-18),
  },
];

const chatSession = {
  id: 'chat-atlas',
  title: 'Atlas Research Study Director',
  projectId: project.id,
  provider: 'openai',
  model: 'gpt-5.2',
  skillIds: ['skill:web-research', 'skill:doc-review'],
  priceRates: { inputUsdPerMillion: 5, outputUsdPerMillion: 15 },
  budget: { maxTokens: 50000, maxMinutes: 30, maxUsd: 2 },
  usage: { inputTokens: 4200, outputTokens: 1900, costUsd: 0.0495, elapsedSeconds: 96 },
  createdAt: ts(-60),
  updatedAt: ts(-2),
  messages: [
    { id: 'cm-1', role: 'user', status: 'completed', text: 'What is the current status of the atlas study?', error: null, usage: null, provenance: null, actions: [], createdAt: ts(-10), finishedAt: ts(-10) },
    {
      id: 'cm-2', role: 'assistant', status: 'completed',
      text: 'The run is waiting on the Reviewer gate. Research and both sub-director passes are complete; Engineering is assembling the comparison matrix now. One hire approval (Web Research + Document Review bindings) is also pending your decision.',
      error: null,
      usage: { inputTokens: 1800, outputTokens: 320, costUsd: 0.0138 },
      provenance: { provider: 'openai', model: 'gpt-5.2', skillIds: ['skill:web-research'], skillSha256: { 'skill:web-research': sha('a') }, promptSha256: sha('c'), textSha256: sha('d') },
      actions: [],
      createdAt: ts(-10), finishedAt: ts(-9),
    },
    { id: 'cm-3', role: 'user', status: 'completed', text: 'Propose hires for the remaining gaps.', error: null, usage: null, provenance: null, actions: [], createdAt: ts(-3), finishedAt: ts(-3) },
    {
      id: 'cm-4', role: 'assistant', status: 'completed',
      text: 'I recommend keeping the current two bindings and adding one local-model runtime specialist (local-model-runtime-engineering) for the benchmark harness. That keeps the office within your $2 session budget with ~$1.95 headroom.',
      error: null,
      usage: { inputTokens: 2400, outputTokens: 410, costUsd: 0.0182 },
      provenance: { provider: 'openai', model: 'gpt-5.2', skillIds: ['skill:web-research', 'skill:doc-review'], skillSha256: { 'skill:web-research': sha('a'), 'skill:doc-review': sha('b') }, promptSha256: sha('c'), textSha256: sha('d') },
      actions: [
        { kind: 'open-roadmap', label: 'Open roadmap for Atlas Research Study', projectId: project.id },
      ],
      createdAt: ts(-3), finishedAt: ts(-2),
    },
  ],
};

const mock = `
window.desktopBridge = {
  version: 4,
  getVaultStatus: async () => ({ encryptionAvailable: true, providers: {
    openai: { configured: true, readable: true, updatedAt: '2026-01-28T09:00:00.000Z' },
    anthropic: { configured: false, readable: false, updatedAt: null } } }),
  setApiKey: async () => ({ ok: true }),
  revokeApiKey: async () => ({ ok: true }),
  listProviderModels: async () => ({ ok: true, models: [{ id: 'gpt-5.2', label: 'GPT 5.2' }, { id: 'gpt-5.2-mini', label: 'GPT 5.2 mini' }] }),
  detectOllama: async () => ({ available: true, baseUrl: 'http://127.0.0.1:11434', models: [{ id: 'qwen3:8b', label: 'qwen3:8b' }] }),
  listProjects: async () => [${JSON.stringify(project)}],
  createProject: async () => ({ ok: false, error: 'harness is read-only' }),
  getProject: async (id) => (id === '${project.id}' ? ${JSON.stringify(project)} : null),
  startRun: async () => ({ ok: false, error: 'harness is read-only' }),
  pauseRun: async () => ({ ok: true }),
  resumeRun: async () => ({ ok: true }),
  cancelRun: async () => ({ ok: true }),
  listRuns: async () => [${JSON.stringify(run)}],
  readArtifact: async () => ({ ok: true, text: '# Runtime comparison (draft)\\n\\n| Runtime | Tokens/s | Notes |\\n|---|---|---|\\n| llama.cpp | 42 | broad support |\\n| vLLM | 61 | batching |', meta: { artifactId: 'art-res-02', projectId: '${project.id}', runId: '${run.id}', nodeId: 'n-researcher', role: 'research', provider: 'openai', model: 'gpt-5.2', createdAt: '${ts(-15)}', inputTokens: 6200, outputTokens: 2800, costUsd: 0.073, promptSha256: '${sha('c')}', textSha256: '${sha('d')}' } }),
  getSettings: async () => ({ runtimeUrl: null }),
  connectRuntime: async () => ({ ok: true, url: 'https://director.example.com' }),
  openExternal: async () => ({ ok: true }),
  onProjectEvent: () => () => undefined,
  listSkills: async () => ${JSON.stringify(skills)},
  hirePreview: async () => ({ ok: true, preview: { projectId: '${project.id}', projectVersion: 4, planHash: '${sha('9')}', assignments: [{ nodeId: 'n-researcher', nodeTitle: 'Researcher', skillId: 'skill:web-research', skillName: 'Web Research', score: 12, matchedKeywords: ['research', 'citations'] }] } }),
  applyHires: async () => ({ ok: false, error: 'harness is read-only' }),
  updateOfficeProject: async () => ({ ok: false, error: 'harness is read-only' }),
  reassignNode: async () => ({ ok: false, error: 'harness is read-only' }),
  getOfficeSnapshot: async () => null,
  listApprovals: async () => ${JSON.stringify(approvals)},
  decideApproval: async () => ({ ok: false, error: 'harness is read-only' }),
  readRunEvents: async (projectId, runId, afterIndex) => { const all = ${JSON.stringify(events)}; const from = afterIndex ?? 0; return { ok: true, events: all.slice(from), nextIndex: all.length }; },
  recoverRun: async () => ({ ok: false, error: 'harness is read-only' }),
  chatCreateSession: async () => ({ ok: false, error: 'harness is read-only' }),
  chatListSessions: async () => [{ ...${JSON.stringify({ ...chatSession, messages: undefined })}, messages: undefined, messageCount: 4 }],
  chatGetSession: async (id) => (id === 'chat-atlas' ? ${JSON.stringify(chatSession)} : null),
  chatSendMessage: async () => ({ ok: false, error: 'harness is read-only' }),
  chatStop: async () => ({ ok: true }),
  chatDeleteSession: async () => ({ ok: false, error: 'harness is read-only' }),
  companionStatus: async () => ({ enabled: false, running: false, port: null, encryptionAvailable: true, paired: false }),
  companionEnable: async () => ({ ok: false, error: 'harness is read-only' }),
  companionDisable: async () => ({ ok: true }),
  companionRegenerateToken: async () => ({ ok: false, error: 'harness is read-only' }),
  backToLauncher: async () => undefined,
  openOfflineAtlas: async () => ({ ok: false, error: 'harness' }),
  getSystemInfo: async () => ({ cpuModel: 'Harness CPU', logicalCores: 16, totalRamBytes: 68719476736, freeRamBytes: 34359738368, os: { platform: 'linux', release: '6.8', arch: 'x64' }, disk: { totalBytes: 1099511627776, freeBytes: 549755813888, path: '/data' }, gpus: [], notes: [] }),
  getModelCatalog: async () => ({ models: [], rejected: [] }),
  checkModelRequirements: async () => ({ modelId: '', checks: {}, canDownload: false, summary: 'harness' }),
  downloadModel: async () => ({ ok: false, error: 'harness' }),
  onDownloadProgress: () => () => undefined,
  createVenv: async () => ({ ok: false, error: 'harness' }),
  getJobStatus: async () => ({ running: false }),
  onJobEvent: () => () => undefined,
  onModeChanged: () => () => undefined,
};
`;

fs.writeFileSync(path.join(dist, 'ux-mock.js'), mock);
const html = fs.readFileSync(path.join(dist, 'chrome.html'), 'utf8');
const harness = html.replace('<script src="./vendor/panzoom/panzoom.min.js"></script>', '<script src="./ux-mock.js"></script>\n    <script src="./vendor/panzoom/panzoom.min.js"></script>');
if (harness === html) throw new Error('injection point not found');
fs.writeFileSync(path.join(dist, 'chrome.harness.html'), harness);
console.log('harness written:', path.join(dist, 'chrome.harness.html'));
