// Generates dist/renderer/chrome.ceo-harness.html: a v5 mock bridge with a
// fully materialized creative_technology_group enterprise (5 companies, 7
// departments, 9 contract seats — the golden fixture blueprint, hash-pinned),
// a running program, ledger/memory/stewards, and 20 verified skills.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist', 'renderer');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'src', 'shared', 'enterprise-blueprint.fixture.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'resources', 'skills', 'skills.catalog.json'), 'utf8'));

const blueprint = JSON.parse(fixture.canonicalBlueprint);
const blueprintHash = fixture.blueprintHash;
const sha = (ch) => ch.repeat(64);
const NOW = Date.parse('2026-03-02T14:00:00Z');
const ts = (min) => new Date(NOW + min * 60000).toISOString();

// ---- 20 verified skills: real catalog + the two creative packs (installed) ----
const creative = [
  { id: 'civilization-art-design-research', name: 'Civilization Art & Design Research' },
  { id: 'music-theory-production-engineering', name: 'Music Theory & Production Engineering' },
];
const skills = [
  ...catalog.skills.map((s, i) => ({
    id: s.id,
    name: s.name,
    description: s.description.split('.')[0] + '.',
    role: 'research',
    keywords: [s.id.split('-')[0], 'bundled'],
    sha256: sha(String((i % 9) + 1)),
    path: `bundled/${s.id}/SKILL.md`,
    verified: true,
  })),
  ...creative
    .filter((c) => !catalog.skills.some((s) => s.id === c.id))
    .map((c, i) => ({
      id: c.id,
      name: c.name,
      description: `${c.name} pack.`,
      role: 'research',
      keywords: [c.id.split('-')[0], 'creative'],
      sha256: sha(i === 0 ? 'c' : 'd'),
      path: `creative/${c.id}/SKILL.md`,
      verified: true,
    })),
];
if (skills.length !== 20) throw new Error(`expected 20 skills, got ${skills.length}`);

// ---- runtime contracts: staffed seats active; one suspended (draining); one proposed ----
const contracts = blueprint.contracts.map((c, i) => {
  const staffed = true; // all packs installed in this registry
  const running = c.companyKey === 'software' || c.companyKey === 'ai-cyber';
  const suspended = c.key === 'music--svc-music-production';
  return {
    key: c.key,
    companyKey: c.companyKey,
    departmentKey: c.departmentKey,
    discipline: c.discipline,
    status: suspended ? 'draining' : 'active',
    staffed,
    skillId: c.skillPin.skillId,
    capacityShare: c.capacityShare,
    version: 2 + (i % 3),
    fenceCounter: 3 + i,
    lease:
      running && !suspended
        ? { runId: `run-${c.companyKey}-0001`, fence: 3 + i, acquiredAt: ts(-25), expiresAt: ts(5), ttlMs: 1800000, status: 'active' }
        : null,
  };
});

const companies = Object.fromEntries(blueprint.companies.map((c) => [c.key, { projectId: `proj-${c.key}`, createdAt: ts(-600) }]));
const departments = Object.fromEntries(blueprint.departments.map((d) => [d.key, { projectId: 'proj-shared-services', nodeId: `node-${d.key}` }]));
const contractWorkers = Object.fromEntries(contracts.map((c) => [c.key, { projectId: 'proj-shared-services', nodeId: `node-${c.key}` }]));

// ---- view (mirrors shared deriveEnterpriseView) ----
const depCount = new Map();
const conCountCo = new Map();
const conCountDep = new Map();
for (const d of blueprint.departments) depCount.set(d.companyKey, (depCount.get(d.companyKey) ?? 0) + 1);
for (const w of blueprint.contracts) {
  conCountCo.set(w.companyKey, (conCountCo.get(w.companyKey) ?? 0) + 1);
  conCountDep.set(w.departmentKey, (conCountDep.get(w.departmentKey) ?? 0) + 1);
}
const listCompanies = blueprint.companies.map((c) => ({
  key: c.key, name: c.name, kind: c.kind, capacityShare: c.capacityShare,
  disciplines: [...c.disciplines].sort(),
  departmentCount: depCount.get(c.key) ?? 0, contractCount: conCountCo.get(c.key) ?? 0,
}));
const listDepartments = blueprint.departments.map((d) => ({
  key: d.key, companyKey: d.companyKey, name: d.name, discipline: d.discipline,
  contractCount: conCountDep.get(d.key) ?? 0,
}));
const listContracts = contracts.map((c) => ({
  key: c.key, companyKey: c.companyKey, departmentKey: c.departmentKey, discipline: c.discipline,
  status: c.status, staffed: c.staffed, skillId: c.skillId,
}));
const view = {
  graph: {
    nodes: [
      ...listCompanies.map((c) => ({ key: c.key, kind: 'company', label: c.name, parentKey: null, status: null })),
      ...listDepartments.map((d) => ({ key: d.key, kind: 'department', label: d.name, parentKey: d.companyKey, status: null })),
      ...listContracts.map((w) => ({ key: w.key, kind: 'contract', label: w.key, parentKey: w.departmentKey, status: w.status })),
    ],
    edges: [
      ...listDepartments.map((d) => ({ key: `contains:${d.companyKey}->${d.key}`, from: d.companyKey, to: d.key, kind: 'contains' })),
      ...listContracts.flatMap((w) => {
        const out = [{ key: `contains:${w.departmentKey}->${w.key}`, from: w.departmentKey, to: w.key, kind: 'contains' }];
        const owner = blueprint.departments.find((d) => d.key === w.departmentKey)?.companyKey ?? null;
        if (owner !== null && owner !== w.companyKey) out.push({ key: `serves:${w.key}->${w.companyKey}`, from: w.key, to: w.companyKey, kind: 'serves' });
        return out;
      }),
    ],
  },
  lists: { companies: listCompanies, departments: listDepartments, contracts: listContracts },
};

// ---- ledger (token-free), memory, stewards ----
const ledgerRows = [
  ['software', 'svc-backend-engineering', 'worker-0002', 'returned', 'Implement the geometry service endpoint', 'Endpoint scaffolded; property tests green on 3 engines.', 5200, 2600, 18400],
  ['software', 'svc-computational-geometry', 'worker-0003', 'prompt_started', 'Verify convex-hull invariants on the benchmark corpus', '', 0, 0, 0],
  ['ai-cyber', 'svc-ai-research', 'worker-0005', 'returned', 'Survey 2026 open-weight reasoning models for the frontier track', 'Returned survey matrix across 11 open-weight models with licensing flags.', 7400, 3100, 22100],
  ['ai-cyber', 'svc-cybersecurity', 'worker-0006', 'assignment', 'Triage the firmware sample queue (defensive only)', '', 0, 0, 0],
  ['civilization-design', 'svc-design', 'worker-0007', 'returned', 'Draft the civilization design brief', 'Brief drafted with three narrative arcs and an artifact index.', 6100, 2800, 15900],
  ['civilization-design', 'svc-mathematics', 'worker-0008', 'artifact', 'Formalize the resource-flow proof sketch', 'Proof sketch stored; 2 lemmas flagged for review.', 4800, 1500, 9800],
  ['music', 'svc-music-production', 'worker-0010', 'waiting', 'Compose the theme variations (suspended seat — waiting on resume)', '', 0, 0, 0],
  ['music', 'svc-design', 'worker-0009', 'returned', 'Storyboard the album visual system', 'Storyboard v2 returned; palette locked to the civilization arc.', 3900, 1200, 7600],
];
const ledger = ledgerRows.map(([companyKey, nodeKey, workerId, kind, ask, summary, inTok, outTok, micros], i) => ({
  seq: i + 1,
  ts: NOW - (ledgerRows.length - i) * 420000,
  enterpriseId: 'ent-ctg',
  companyKey,
  projectId: `proj-${companyKey}`,
  officeId: null,
  roomId: null,
  workerId,
  nodeKey,
  runId: `run-${companyKey}-0001`,
  attempt: 1,
  kind,
  status: kind === 'waiting' ? 'pending' : 'succeeded',
  intendedAsk: ask,
  promptSha256: kind === 'assignment' || kind === 'waiting' ? null : sha(String.fromCharCode(97 + i)),
  returnedSummary: summary,
  artifactRef:
    kind === 'returned' && i % 2 === 0
      ? {
          artifactId: `art-${companyKey}-${i}`,
          runId: `run-${companyKey}-0001`,
          nodeKey,
          attempt: 1,
          kind: 'text',
          title: ask.length > 48 ? `${ask.slice(0, 47)}…` : ask,
          summary,
          contentSha256: sha(String.fromCharCode(101 + i)),
        }
      : null,
  usage: inTok > 0 ? { inputTokens: inTok, outputTokens: outTok, costUsdMicros: micros } : null,
  skillRef: null,
}));

const memory = [
  {
    entry: {
      scope: 'enterprise',
      scopeKey: 'ctg-2026',
      artifact: {
        artifactId: 'art-software-0', runId: 'run-software-0001', nodeKey: 'svc-backend-engineering', attempt: 1,
        kind: 'text', title: 'Geometry service endpoint', summary: 'Endpoint scaffolded; property tests green on 3 engines.',
        contentSha256: sha('1'),
      },
    },
    status: 'promoted', promotedAt: ts(-300), revokedAt: null,
  },
  {
    entry: {
      scope: 'company',
      scopeKey: 'civilization-design',
      artifact: {
        artifactId: 'art-civilization-4', runId: 'run-civilization-design-0001', nodeKey: 'svc-design', attempt: 1,
        kind: 'text', title: 'Civilization design brief', summary: 'Brief drafted with three narrative arcs and an artifact index.',
        contentSha256: sha('2'),
      },
    },
    status: 'promoted', promotedAt: ts(-200), revokedAt: null,
  },
  {
    entry: {
      scope: 'department',
      scopeKey: 'svc-ai-research',
      artifact: {
        artifactId: 'art-ai-cyber-2', runId: 'run-ai-cyber-0001', nodeKey: 'svc-ai-research', attempt: 1,
        kind: 'text', title: 'Open-weight survey (superseded)', summary: 'Earlier survey pass, superseded by the March matrix.',
        contentSha256: sha('3'),
      },
    },
    status: 'revoked', promotedAt: ts(-400), revokedAt: ts(-100),
  },
];

const stewards = [
  {
    steward: 'Budget Steward', kind: 'budget', derivedBy: 'system', providerCalls: false,
    summary: 'music has used $0.00 of its $37.50 reservation while its production seat is suspended; consider resuming the seat or rebalancing capacity shares.',
    refs: [], ledgerSeq: 7, actionId: 'worker.suspend',
  },
  {
    steward: 'Cache Steward', kind: 'cache', derivedBy: 'system', providerCalls: false,
    summary: 'Prompt sha 61…recurs in 2 settled runs; a content-hash derivation cache hit is available for the next dispatch.',
    refs: [], ledgerSeq: 3, actionId: null,
  },
];

const program = {
  contractVersion: 1,
  programId: 'ctg-2026',
  state: 'running',
  version: 14,
  blueprintHash,
  companyRuns: [
    { companyKey: 'ai-cyber', runId: 'run-ai-cyber-0001', status: 'running' },
    { companyKey: 'civilization-design', runId: null, status: 'pending' },
    { companyKey: 'music', runId: null, status: 'pending' },
    { companyKey: 'shared-services', runId: null, status: 'pending' },
    { companyKey: 'software', runId: 'run-software-0001', status: 'running' },
  ],
  maxReplans: 2,
  maxConcurrentRuns: 2,
  budget: blueprint.budget,
};

const approvals = [
  {
    id: 'ap-activation-1', kind: 'blueprint-activation', blueprintHash, payloadHash: sha('8'),
    payload: { kind: 'blueprint-activation' }, status: 'approved', createdAt: ts(-620), decidedAt: ts(-615),
  },
  {
    id: 'ap-plan-1', kind: 'plan', blueprintHash, payloadHash: sha('9'),
    payload: { kind: 'plan' }, status: 'approved', createdAt: ts(-610), decidedAt: ts(-605),
  },
  {
    id: 'ap-memory-1', kind: 'memory-promote', blueprintHash, payloadHash: sha('7'),
    payload: { artifact: memory[1].entry.artifact, scope: 'company', scopeKey: 'civilization-design' },
    status: 'pending', createdAt: ts(-30), decidedAt: null,
  },
];

const record = {
  contractVersion: 1,
  id: 'ent-ctg',
  programId: 'ctg-2026',
  preset: 'creative_technology_group',
  name: 'Creative Technology Group',
  mission: blueprint.mission,
  provider: 'openai',
  model: 'gpt-5.2',
  priceRates: { inputUsdPerMillion: 5, outputUsdPerMillion: 15 },
  version: 42,
  state: 'materialized',
  blueprint,
  blueprintHash,
  program,
  programPaused: false,
  companies,
  departments,
  contractWorkers,
  contracts: Object.fromEntries(contracts.map((c) => [c.key, { status: c.status, staffed: c.staffed, skillId: c.skillId, capacityShare: c.capacityShare, version: c.version, fenceCounter: c.fenceCounter, lease: c.lease }])),
  approvals,
  memory,
  workerOverrides: { 'software/worker-0002': { instructions: 'Prioritize the property-test corpus before new endpoints.', budget: { maxUsd: 0.5, maxMinutes: 20 } } },
  ledgerKeys: ['ent-ctg'],
  ledgerSeq: ledger.length,
  eventSeq: 64,
  createdAt: ts(-620),
  updatedAt: ts(-2),
};

const summary = {
  id: record.id, programId: record.programId, name: record.name, state: 'materialized', version: 42,
  blueprintHash, programState: 'running', programPaused: false,
  companyCount: 5, departmentCount: 7, contractCount: 9, createdAt: record.createdAt, updatedAt: record.updatedAt,
};

// ---- a company office project for the employee inspector + office tab ----
const mkProject = (key, name) => ({
  id: `proj-${key}`,
  name,
  goal: `Line company mission for ${name}.`,
  provider: 'openai',
  model: 'gpt-5.2',
  template: 'office',
  successCriteria: ['Milestones met'],
  loopPolicy: { maxIterations: 3, noProgressLimit: 2 },
  version: 6,
  createdAt: ts(-600),
  updatedAt: ts(-20),
  nodes: [
    { id: 'worker-0001', title: 'Director', role: 'director', kind: 'director', depth: 0, parentId: null, roomId: 'executive', dependsOn: [], status: 'succeeded', budget: { maxTokens: 20000, maxMinutes: 20, maxUsd: 1 }, instructions: 'Coordinate.' },
    { id: 'worker-0002', title: 'Research Sub-Director', role: 'research', kind: 'subdirector', depth: 1, parentId: 'worker-0001', roomId: 'research', dependsOn: ['worker-0001'], status: 'succeeded', budget: { maxTokens: 15000, maxMinutes: 15, maxUsd: 0.6 }, instructions: 'Lead research.' },
    { id: 'worker-0003', title: 'Builder', role: 'build', kind: 'worker', depth: 2, parentId: 'worker-0002', roomId: 'engineering', dependsOn: ['worker-0002'], status: 'running', budget: { maxTokens: 15000, maxMinutes: 15, maxUsd: 0.6 }, instructions: 'Build.' },
    { id: 'worker-0004', title: 'Reviewer', role: 'review', kind: 'worker', depth: 2, parentId: 'worker-0001', roomId: 'qa', dependsOn: ['worker-0003'], status: 'pending', budget: { maxTokens: 12000, maxMinutes: 12, maxUsd: 0.4 }, instructions: 'Review.' },
  ],
});
const projects = blueprint.companies.map((c) => mkProject(c.key, c.name));

// All enterprise/office data goes out as ONE JSON blob (single JSON.stringify,
// no per-value interpolation into the script text — immune to quote/backtick/
// `${` hazards in fixture content). The bridge functions below are static text.
const data = { skills, projects, summary, record, view, stewards, contracts, memory, program, ledger };
const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, ' ');

const bridgeBody = `
window.desktopBridge = {
  version: 5,
  getVaultStatus: async () => ({ encryptionAvailable: true, providers: {
    openai: { configured: true, readable: true, updatedAt: '2026-01-28T09:00:00.000Z' },
    anthropic: { configured: false, readable: false, updatedAt: null } } }),
  setApiKey: async () => ({ ok: true }),
  revokeApiKey: async () => ({ ok: true }),
  listProviderModels: async () => ({ ok: true, models: [{ id: 'gpt-5.2', label: 'GPT 5.2' }] }),
  detectOllama: async () => ({ available: false, baseUrl: 'http://127.0.0.1:11434', models: [], error: 'not running' }),
  listProjects: async () => D.projects,
  createProject: async () => ({ ok: false, error: 'harness is read-only' }),
  getProject: async (id) => D.projects.find((p) => p.id === id) ?? null,
  startRun: async () => ({ ok: false, error: 'harness is read-only' }),
  pauseRun: async () => ({ ok: true }),
  resumeRun: async () => ({ ok: true }),
  cancelRun: async () => ({ ok: true }),
  listRuns: async () => [],
  readArtifact: async () => ({ ok: false, error: 'harness is read-only' }),
  getSettings: async () => ({ runtimeUrl: null }),
  connectRuntime: async () => ({ ok: true, url: 'https://director.example.com' }),
  openExternal: async () => ({ ok: true }),
  onProjectEvent: () => () => undefined,
  listSkills: async () => D.skills,
  hirePreview: async () => ({ ok: false, error: 'harness is read-only' }),
  applyHires: async () => ({ ok: false, error: 'harness is read-only' }),
  updateOfficeProject: async () => ({ ok: false, error: 'harness is read-only' }),
  reassignNode: async () => ({ ok: false, error: 'harness is read-only' }),
  getOfficeSnapshot: async () => null,
  listApprovals: async () => [],
  decideApproval: async () => ({ ok: false, error: 'harness is read-only' }),
  readRunEvents: async () => ({ ok: true, events: [], nextIndex: 0 }),
  recoverRun: async () => ({ ok: false, error: 'harness is read-only' }),
  chatCreateSession: async () => ({ ok: false, error: 'harness is read-only' }),
  chatListSessions: async () => [],
  chatGetSession: async () => null,
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
  onEnterpriseEvent: () => () => undefined,
  entList: async () => [D.summary],
  entGet: async () => D.record,
  entCreate: async () => ({ ok: false, error: 'harness is read-only' }),
  entUpdate: async () => ({ ok: false, error: 'harness is read-only' }),
  entSnapshot: async () => ({ record: D.record, view: D.view, stewards: D.stewards }),
  entContracts: async () => D.contracts,
  entContractPropose: async () => ({ ok: false, error: 'harness is read-only' }),
  entContractDecide: async () => ({ ok: false, error: 'harness is read-only' }),
  entContractRelease: async () => ({ ok: false, error: 'harness is read-only' }),
  entMemory: async (id, includeRevoked) => D.memory.filter((m) => includeRevoked || m.status === 'promoted'),
  entMemoryPromote: async () => ({ ok: false, error: 'harness is read-only' }),
  entMemoryRevoke: async () => ({ ok: false, error: 'harness is read-only' }),
  entMemorySearch: async (id, q) => D.memory.filter((m) => m.status === 'promoted' && (m.entry.artifact.title.toLowerCase().includes(String(q).toLowerCase()) || m.entry.artifact.summary.toLowerCase().includes(String(q).toLowerCase()))),
  entProgramStart: async () => ({ ok: false, error: 'harness is read-only' }),
  entProgramPause: async () => ({ ok: true }),
  entProgramResume: async () => ({ ok: true }),
  entProgramCancel: async () => ({ ok: false, error: 'harness is read-only' }),
  entProgramGet: async () => ({ ok: true, program: D.program }),
  entProgramPump: async () => ({ ok: true, dispatched: 0 }),
  entWorkerUpdate: async () => ({ ok: false, error: 'harness is read-only' }),
  entLedger: async (req) => {
    let rows = D.ledger;
    if (req.companyKey) rows = rows.filter((e) => e.companyKey === req.companyKey);
    if (req.workerId) rows = rows.filter((e) => e.workerId === req.workerId);
    if (req.departmentKey) rows = rows.filter((e) => e.nodeKey === req.departmentKey);
    return rows;
  },
  entTimeline: async (req) => {
    const rows = D.ledger.filter((e) => e.seq > (req.afterIndex ?? 0));
    return { entries: rows.map((e) => ({ seq: e.seq, ts: e.ts, kind: e.kind, enterpriseId: e.enterpriseId, companyKey: e.companyKey, workerId: e.workerId, nodeKey: e.nodeKey, runId: e.runId, ledgerSeq: e.seq, artifactRef: e.artifactRef })), nextIndex: rows.length ? rows[rows.length - 1].seq : (req.afterIndex ?? 0) };
  },
  entEvents: async (req) => ({ events: [], nextIndex: req.afterIndex ?? 0 }),
  entExport: async () => ({ ok: true, dir: '/tmp/exports/ent-ctg', files: ['HANDOFFS.md', 'timeline-index.json', 'ledger.json', 'ledger.md'] }),
  entStewards: async () => D.stewards,
  entBlueprintPreview: async () => ({ ok: false, error: 'harness is read-only' }),
  entBlueprintApply: async () => ({ ok: false, error: 'harness is read-only' }),
  entApprovalDecide: async () => ({ ok: false, error: 'harness is read-only' }),
};
`;

const mock = `const D = ${json};\n${bridgeBody}`;

fs.writeFileSync(path.join(dist, 'ceo-mock.js'), mock);
const html = fs.readFileSync(path.join(dist, 'chrome.html'), 'utf8');
const harness = html.replace(
  '<script src="./vendor/panzoom/panzoom.min.js"></script>',
  '<script src="./ceo-mock.js"></script>\n    <script src="./vendor/panzoom/panzoom.min.js"></script>',
);
if (harness === html) throw new Error('injection point not found');
fs.writeFileSync(path.join(dist, 'chrome.ceo-harness.html'), harness);
console.log('CEO harness written:', path.join(dist, 'chrome.ceo-harness.html'));
