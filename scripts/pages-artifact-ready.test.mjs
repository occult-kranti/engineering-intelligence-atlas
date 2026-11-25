import test from 'node:test';
import assert from 'node:assert/strict';
import { inputFromEnvironment, waitForPagesArtifact } from './pages-artifact-ready.mjs';

const input = {
  repository: 'fixture/atlas',
  runId: '45585031999',
  artifactId: '15009590718',
  artifactName: 'github-pages-45585031999-2',
  headSha: '855c89ebcbc394fea7063dbd67f3114200ff0d33',
  token: 'synthetic-token-never-log',
};
const artifact = (patch = {}) => ({
  id: Number(input.artifactId), name: input.artifactName, expired: false,
  size_in_bytes: 141597691,
  workflow_run: { id: Number(input.runId), head_sha: input.headSha },
  ...patch,
});
const listing = (...artifacts) => ({ status: 200, body: { total_count: artifacts.length, artifacts } });

function harness(replies, options = {}) {
  let time = 0;
  const requests = [];
  const messages = [];
  const waits = [];
  const deps = {
    now: () => time,
    wait: async (ms) => { time += ms; waits.push(ms); },
    maxWaitMs: 50, pollIntervalMs: 5, requestTimeoutMs: 10, maxAttempts: 10,
    log: (message) => messages.push(message),
    fetchImpl: async (url, init) => {
      requests.push({ url: new URL(url), init });
      const reply = replies[Math.min(requests.length - 1, replies.length - 1)];
      if (reply instanceof Error) throw reply;
      time += reply.elapsed || 0;
      return { status: reply.status, json: async () => reply.body };
    },
    ...options,
  };
  return { deps, requests, messages, waits };
}

test('the observed missing-then-visible upload requires two exact observations before approval', async () => {
  const h = harness([listing(), listing(artifact()), listing(artifact())]);
  const result = await waitForPagesArtifact(input, h.deps);
  assert.equal(result.status, 'ready');
  assert.equal(result.artifactId, input.artifactId);
  assert.equal(result.attempts, 3);
  assert.equal(result.consecutiveObservations, 2);
  assert.deepEqual(h.waits, [5, 5]);
  for (const { url, init } of h.requests) {
    assert.equal(url.searchParams.get('name'), input.artifactName);
    assert.equal(url.pathname, `/repos/fixture/atlas/actions/runs/${input.runId}/artifacts`);
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, `Bearer ${input.token}`);
    assert.ok(init.signal instanceof AbortSignal);
  }
  assert.ok(!JSON.stringify([result, h.messages]).includes(input.token));
});

test('the observed duplicate-name rerun fails immediately instead of selecting the latest ID', async () => {
  const h = harness([listing(artifact({ id: 15008322409 }), artifact())]);
  await assert.rejects(waitForPagesArtifact(input, h.deps), { code: 'AMBIGUOUS' });
  assert.equal(h.requests.length, 1);
  assert.equal(h.waits.length, 0);
});

test('deploy-only rerun keeps the build name and ID even when the current attempt advances', async () => {
  const fromEnv = inputFromEnvironment({
    GITHUB_REPOSITORY: input.repository, GITHUB_RUN_ID: input.runId,
    GITHUB_RUN_ATTEMPT: '3', PAGES_ARTIFACT_ID: input.artifactId,
    PAGES_ARTIFACT_NAME: input.artifactName, PAGES_SOURCE_SHA: input.headSha,
    GITHUB_TOKEN: input.token,
  });
  // Exact-name REST filtering excludes the older build's differently named artifact.
  const records = [artifact({ id: 15008322409, name: 'github-pages-45585031999-1' }), artifact()];
  const h = harness([listing()]);
  h.deps.fetchImpl = async (url) => ({ status: 200, json: async () => {
    const matches = records.filter((record) => record.name === new URL(url).searchParams.get('name'));
    return { total_count: matches.length, artifacts: matches };
  } });
  const result = await waitForPagesArtifact(fromEnv, h.deps);
  assert.equal(result.artifactName, 'github-pages-45585031999-2');
  assert.equal(result.artifactId, '15009590718');
});

for (const [label, patch, code] of [
  ['wrong uploaded ID', { id: 15008322409 }, 'ID_MISMATCH'],
  ['wrong name', { name: 'github-pages-45585031999-1' }, 'NAME_MISMATCH'],
  ['expired artifact', { expired: true }, 'EXPIRED'],
  ['unknown expiry', { expired: undefined }, 'EXPIRED'],
  ['different run', { workflow_run: { id: 45585031998, head_sha: input.headSha } }, 'RUN_MISMATCH'],
  ['different commit', { workflow_run: { id: Number(input.runId), head_sha: 'a'.repeat(40) } }, 'HEAD_MISMATCH'],
  ['missing provenance', { workflow_run: undefined }, 'SCHEMA'],
]) {
  test(`${label} fails closed without retry`, async () => {
    const h = harness([listing(artifact(patch))]);
    await assert.rejects(waitForPagesArtifact(input, h.deps), { code });
    assert.equal(h.requests.length, 1);
    assert.equal(h.waits.length, 0);
  });
}

for (const status of [401, 403]) {
  test(`HTTP ${status} authorization failure is terminal and response bodies are not logged`, async () => {
    const h = harness([{ status, body: { error: input.token } }]);
    await assert.rejects(waitForPagesArtifact(input, h.deps), { code: 'AUTHORIZATION' });
    assert.equal(h.requests.length, 1);
    assert.equal(h.waits.length, 0);
    assert.ok(!JSON.stringify(h.messages).includes(input.token));
  });
}

test('transient backend and network failures recover without disclosing their details', async () => {
  const h = harness([new Error(input.token), { status: 503 }, listing(artifact()), listing(artifact())]);
  const result = await waitForPagesArtifact(input, h.deps);
  assert.equal(result.attempts, 4);
  assert.ok(!JSON.stringify(h.messages).includes(input.token));
});

test('a disappearing observation resets readiness instead of combining stale observations', async () => {
  const h = harness([listing(artifact()), listing(), listing(artifact()), listing(artifact())]);
  assert.equal((await waitForPagesArtifact(input, h.deps)).attempts, 4);
});

test('missing metadata stops at the attempt bound', async () => {
  const h = harness([listing()], { maxAttempts: 3 });
  await assert.rejects(waitForPagesArtifact(input, h.deps), { code: 'TIMEOUT' });
  assert.equal(h.requests.length, 3);
  assert.equal(h.waits.length, 2);
});

test('a late valid response cannot approve after the elapsed-time deadline', async () => {
  const h = harness([listing(artifact()), { ...listing(artifact()), elapsed: 60 }]);
  await assert.rejects(waitForPagesArtifact(input, h.deps), { code: 'TIMEOUT' });
  assert.equal(h.requests.length, 2);
});

test('incomplete listings cannot establish uniqueness', async () => {
  const h = harness([{ status: 200, body: { total_count: 1, artifacts: [] } }]);
  await assert.rejects(waitForPagesArtifact(input, h.deps), { code: 'SCHEMA' });
});

test('missing build output fails before any request', async () => {
  const h = harness([listing(artifact())]);
  await assert.rejects(waitForPagesArtifact({ ...input, artifactId: '' }, h.deps), { code: 'INPUT' });
  assert.equal(h.requests.length, 0);
});
