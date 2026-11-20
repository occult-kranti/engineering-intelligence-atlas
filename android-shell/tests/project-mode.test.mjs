import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProjectEngine,
  DEFAULT_SQUAD,
  computeCostUsd,
  estimateTokens,
  redactError,
} from '../www/js/project-mode.js';
import { createProjectStore } from '../www/js/project-store.js';

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

/** Fake provider: deterministic, no network, no real keys. */
function fakeProvider(behavior = {}) {
  const calls = [];
  return {
    calls,
    async generate(args) {
      calls.push(args);
      if (behavior.onCall) await behavior.onCall(calls.length, args);
      if (behavior.failOnCall === calls.length) {
        throw new Error(behavior.failMessage ?? 'provider exploded');
      }
      return {
        text: `output-${calls.length} for ${args.prompt.includes('Project goal:') ? 'goal' : '?'}`,
        inputTokens: 100,
        outputTokens: 50,
        model: args.model,
      };
    },
  };
}

function makeEngine(provider, now) {
  const store = createProjectStore(memoryStorage());
  const engine = createProjectEngine({ store, provider, now });
  return { engine, store };
}

async function makeProject(engine, overrides = {}) {
  return engine.createProject({
    goal: 'Assess RISC-V toolchain maturity',
    provider: 'openai',
    model: 'gpt-4o-mini',
    budget: { maxTokens: 100_000, maxMinutes: 60, maxUsd: 0, priceInPerMillion: 0, priceOutPerMillion: 0 },
    ...overrides,
  });
}

test('default squad is Director/Research/Build/Review', () => {
  assert.deepEqual(
    DEFAULT_SQUAD.map((n) => n.name),
    ['Director', 'Research', 'Build', 'Review'],
  );
});

test('a full run executes enabled nodes in order and completes', async () => {
  const provider = fakeProvider();
  const { engine } = makeEngine(provider);
  const project = await makeProject(engine);
  const run = await engine.startRun(project.id);
  assert.equal(run.status, 'completed');
  assert.deepEqual(run.nodeStatuses, ['done', 'done', 'done', 'done']);
  assert.equal(run.artifacts.length, 4);
  assert.equal(provider.calls.length, 4);
  assert.equal(run.usage.inputTokens, 400);
  assert.equal(run.usage.outputTokens, 200);
  assert.equal(run.usage.totalTokens, 600);
  // Each later node received earlier work as context.
  assert.match(provider.calls[1].prompt, /output-1/);
  assert.match(provider.calls[3].prompt, /--- Build ---/);
  // Event log records the lifecycle.
  const types = run.events.map((e) => e.type);
  assert.ok(types.includes('run-started'));
  assert.ok(types.includes('run-completed'));
  assert.equal(types.filter((t) => t === 'node-done').length, 4);
});

test('disabled nodes are skipped, remaining nodes still run', async () => {
  const provider = fakeProvider();
  const { engine } = makeEngine(provider);
  const squad = DEFAULT_SQUAD.map((n, i) => ({ ...n, enabled: i !== 1 }));
  const project = await makeProject(engine, { squad });
  const run = await engine.startRun(project.id);
  assert.equal(run.status, 'completed');
  assert.deepEqual(run.nodeStatuses, ['done', 'skipped', 'done', 'done']);
  assert.equal(provider.calls.length, 3);
});

test('pause between nodes stops the run; resume continues it', async () => {
  let engine;
  const provider = fakeProvider({
    onCall: async (n) => {
      if (n === 2) await engine.pauseRun(projectId);
    },
  });
  ({ engine } = makeEngine(provider));
  const project = await makeProject(engine);
  const projectId = project.id;
  const run = await engine.startRun(projectId);
  assert.equal(run.status, 'paused');
  assert.deepEqual(run.nodeStatuses, ['done', 'done', 'pending', 'pending']);
  assert.equal(run.cursor, 2);
  // Partial results are persisted, not just in memory.
  const persisted = await engine.getProject(projectId);
  assert.equal(persisted.runs[0].artifacts.length, 2);

  const resumed = await engine.resumeRun(projectId);
  assert.equal(resumed.status, 'completed');
  assert.equal(resumed.artifacts.length, 4);
});

test('cancel stops the run and keeps completed artifacts', async () => {
  let engine;
  const provider = fakeProvider({
    onCall: async (n) => {
      if (n === 1) await engine.cancelRun(projectId);
    },
  });
  ({ engine } = makeEngine(provider));
  const project = await makeProject(engine);
  const projectId = project.id;
  const run = await engine.startRun(projectId);
  assert.equal(run.status, 'cancelled');
  assert.equal(run.artifacts.length, 1);
  assert.equal(run.nodeStatuses[0], 'done');
  assert.equal(run.nodeStatuses[1], 'pending');
  await assert.rejects(() => engine.resumeRun(projectId), /no paused run/);
});

test('token budget stops the run with budget-exhausted', async () => {
  const provider = fakeProvider();
  const { engine } = makeEngine(provider);
  // Each node uses 150 tokens; cap allows exactly one node (checked before each node).
  const project = await makeProject(engine, { budget: { maxTokens: 100, maxMinutes: 0, maxUsd: 0 } });
  const run = await engine.startRun(project.id);
  assert.equal(run.status, 'budget-exhausted');
  assert.equal(run.artifacts.length, 1);
  assert.ok(run.events.some((e) => e.type === 'budget-exhausted' && e.cap === 'tokens'));
});

test('USD budget uses user price rates and stops when exceeded', async () => {
  const provider = fakeProvider();
  const { engine } = makeEngine(provider);
  // 100 in + 50 out per call; rates 1000 USD/1M each -> 0.15 USD per node.
  // Cap of exactly 0.15 allows the first node and stops before the second.
  const project = await makeProject(engine, {
    budget: { maxTokens: 0, maxMinutes: 0, maxUsd: 0.15, priceInPerMillion: 1000, priceOutPerMillion: 1000 },
  });
  const run = await engine.startRun(project.id);
  assert.equal(run.status, 'budget-exhausted');
  assert.ok(run.events.some((e) => e.cap === 'usd'));
  assert.equal(run.artifacts.length, 1);
  assert.ok(Math.abs(run.usage.costUsd - 0.15) < 1e-9);
});

test('minutes budget uses the injected clock', async () => {
  let t = 0;
  const provider = fakeProvider({
    onCall: async () => {
      t += 120_000; // each call "takes" 2 minutes
    },
  });
  const store = createProjectStore(memoryStorage());
  const engine = createProjectEngine({ store, provider, now: () => t });
  const project = await makeProject(engine, { budget: { maxTokens: 0, maxMinutes: 3, maxUsd: 0 } });
  const run = await engine.startRun(project.id);
  assert.equal(run.status, 'budget-exhausted');
  assert.ok(run.events.some((e) => e.cap === 'minutes'));
  assert.ok(run.artifacts.length <= 2);
});

test('provider error marks the node, keeps partial results, redacts secrets', async () => {
  const provider = fakeProvider({
    failOnCall: 2,
    failMessage: 'HTTP 401: invalid key sk-live-ABCDEF123456 Bearer tok.en leaked',
  });
  const { engine } = makeEngine(provider);
  const project = await makeProject(engine);
  const run = await engine.startRun(project.id);
  assert.equal(run.status, 'error');
  assert.deepEqual(run.nodeStatuses, ['done', 'error', 'pending', 'pending']);
  assert.equal(run.artifacts.length, 1); // partial result preserved
  const errEvent = run.events.find((e) => e.type === 'node-error');
  assert.ok(errEvent);
  assert.ok(!errEvent.message.includes('sk-live-ABCDEF123456'));
  assert.ok(!errEvent.message.includes('tok.en'));
});

test('usage is estimated when the provider does not report tokens', async () => {
  const provider = {
    async generate() {
      return { text: 'a'.repeat(200) };
    },
  };
  const { engine } = makeEngine(provider);
  const project = await makeProject(engine);
  const run = await engine.startRun(project.id);
  assert.equal(run.status, 'completed');
  assert.ok(run.usage.totalTokens > 0);
  assert.equal(run.usage.outputTokens, 4 * estimateTokens('a'.repeat(200)));
});

test('only one active run per project', async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const provider = {
    async generate() {
      await gate;
      return { text: 'x', inputTokens: 1, outputTokens: 1 };
    },
  };
  const { engine } = makeEngine(provider);
  const project = await makeProject(engine);
  const running = engine.startRun(project.id);
  await new Promise((r) => setTimeout(r, 10));
  await assert.rejects(() => engine.startRun(project.id), /already active/);
  release();
  const run = await running;
  assert.equal(run.status, 'completed');
});

test('cost computation helper is exact', () => {
  assert.equal(computeCostUsd(1_000_000, 1_000_000, 3, 15), 18);
  assert.equal(computeCostUsd(0, 0, 3, 15), 0);
});

test('redactError strips key-shaped material and truncates', () => {
  const out = redactError(`failed sk-${'a'.repeat(20)} Bearer xyz123 ${'z'.repeat(500)}`);
  assert.ok(!out.includes('aaa'));
  assert.ok(!out.includes('xyz123'));
  assert.ok(out.length <= 241);
});
