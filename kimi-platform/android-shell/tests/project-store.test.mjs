import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProjectStore,
  normalizeSettings,
  normalizeProjectDoc,
  StoreValidationError,
  LIMITS,
  PROJECTS_INDEX_KEY,
  PROJECT_KEY_PREFIX,
  SETTINGS_KEY,
} from '../www/js/project-store.js';

function memoryStorage() {
  const map = new Map();
  return {
    map,
    async getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async setItem(key, value) {
      map.set(key, String(value));
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}

function sampleProject(overrides = {}) {
  return {
    id: 'p-abc123',
    goal: 'Map the embedded-Linux build-system landscape',
    squad: [
      { name: 'Director', brief: 'Plan', enabled: true },
      { name: 'Research', brief: 'Gather', enabled: true },
    ],
    provider: 'openai',
    model: 'gpt-4o-mini',
    budget: { maxTokens: 5000, maxMinutes: 5, maxUsd: 0.5, priceInPerMillion: 0.15, priceOutPerMillion: 0.6 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    runs: [],
    ...overrides,
  };
}

test('saves and loads a project document through the storage facade', async () => {
  const backing = memoryStorage();
  const store = createProjectStore(backing);
  await store.saveProject(sampleProject());
  assert.ok(backing.map.get(PROJECTS_INDEX_KEY).includes('p-abc123'));
  assert.ok(backing.map.get(PROJECT_KEY_PREFIX + 'p-abc123'));
  const loaded = await store.loadProject('p-abc123');
  assert.equal(loaded.goal, 'Map the embedded-Linux build-system landscape');
  assert.equal(loaded.squad.length, 2);
});

test('listProjects returns summaries only', async () => {
  const store = createProjectStore(memoryStorage());
  await store.saveProject(sampleProject());
  await store.saveProject(sampleProject({ id: 'p-def456', goal: 'Second goal' }));
  const list = await store.listProjects();
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'p-abc123');
  assert.equal(list[0].runs, undefined);
  assert.equal(list[1].lastRunStatus, null);
});

test('deleteProject removes document and index entry', async () => {
  const backing = memoryStorage();
  const store = createProjectStore(backing);
  await store.saveProject(sampleProject());
  await store.deleteProject('p-abc123');
  assert.equal(await store.loadProject('p-abc123'), null);
  assert.deepEqual(JSON.parse(backing.map.get(PROJECTS_INDEX_KEY)), []);
});

test('settings normalize to safe defaults and clamp ranges', async () => {
  const store = createProjectStore(memoryStorage());
  const defaults = await store.loadSettings();
  assert.equal(defaults.provider, '');
  assert.equal(defaults.priceInPerMillion, 0);
  const saved = await store.saveSettings({
    provider: 'anthropic',
    model: 'claude-sonnet-x',
    priceInPerMillion: 3,
    priceOutPerMillion: 15,
    maxTokensPerRun: 999_999_999,
    maxOutputTokensPerCall: 999_999,
  });
  assert.equal(saved.provider, 'anthropic');
  assert.equal(saved.maxTokensPerRun, 1_000_000); // clamped
  assert.equal(saved.maxOutputTokensPerCall, 4096); // hard cap mirrors native
});

test('corrupt JSON in storage is treated as absent, not fatal', async () => {
  const backing = memoryStorage();
  backing.map.set(PROJECT_KEY_PREFIX + 'p-abc123', '{not json');
  backing.map.set(SETTINGS_KEY, '###');
  const store = createProjectStore(backing);
  assert.equal(await store.loadProject('p-abc123'), null);
  assert.equal((await store.loadSettings()).provider, '');
});

test('secret-shaped fields are rejected anywhere in a project document', async () => {
  const store = createProjectStore(memoryStorage());
  const evil = sampleProject();
  evil.squad[0].apiKey = 'sk-should-never-be-stored';
  await assert.rejects(() => store.saveProject(evil), StoreValidationError);
  const evil2 = sampleProject();
  evil2.nested = { deep: { password: 'x' } };
  await assert.rejects(() => store.saveProject(evil2), StoreValidationError);
});

test('validation rejects bad ids, goals, squads, providers, and models', () => {
  assert.throws(() => normalizeProjectDoc(sampleProject({ id: '!!' })), StoreValidationError);
  assert.throws(() => normalizeProjectDoc(sampleProject({ goal: '' })), StoreValidationError);
  assert.throws(() => normalizeProjectDoc(sampleProject({ goal: 'x'.repeat(LIMITS.maxGoalChars + 1) })), StoreValidationError);
  assert.throws(() => normalizeProjectDoc(sampleProject({ squad: [] })), StoreValidationError);
  assert.throws(() => normalizeProjectDoc(sampleProject({ provider: 'azure' })), StoreValidationError);
  assert.throws(() => normalizeProjectDoc(sampleProject({ model: 'bad model!' })), StoreValidationError);
});

test('oversized artifacts and event logs are truncated on save', async () => {
  const store = createProjectStore(memoryStorage());
  const doc = sampleProject();
  doc.runs = [
    {
      id: 'r-1',
      status: 'completed',
      events: Array.from({ length: LIMITS.maxEventsPerRun + 50 }, (_, i) => ({ ts: 't', type: 'e', i })),
      artifacts: [{ nodeName: 'Build', text: 'y'.repeat(LIMITS.maxArtifactChars + 10) }],
    },
  ];
  const saved = await store.saveProject(doc);
  assert.equal(saved.runs[0].events.length, LIMITS.maxEventsPerRun);
  assert.equal(saved.runs[0].artifacts[0].text.length, LIMITS.maxArtifactChars);
});

test('normalizeSettings drops unknown providers and non-finite numbers', () => {
  const s = normalizeSettings({ provider: 'evil', priceInPerMillion: NaN, maxUsdPerRun: -5 });
  assert.equal(s.provider, '');
  assert.equal(s.priceInPerMillion, 0);
  assert.equal(s.maxUsdPerRun, 0);
});
