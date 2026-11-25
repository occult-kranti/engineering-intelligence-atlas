#!/usr/bin/env node
// Read-only readiness gate. REST visibility does not prove deploy-pages' separate
// Twirp listing is ready; a deploy-only retry reuses the verified build outputs.
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export class ArtifactReadinessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ArtifactReadinessError';
    this.code = code;
  }
}

const fail = (code, message) => { throw new ArtifactReadinessError(code, message); };
const positiveId = (value) => typeof value === 'string' && /^[1-9]\d*$/.test(value)
  && Number.isSafeInteger(Number(value));

function validateInput(input) {
  const { repository, runId, artifactId, artifactName, headSha, token } = input;
  if (typeof repository !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repository)) {
    fail('INPUT', 'A valid owner/repository is required.');
  }
  if (!positiveId(runId) || !positiveId(artifactId)) fail('INPUT', 'Positive run and uploaded artifact IDs are required.');
  if (typeof artifactName !== 'string' || !new RegExp(`^github-pages-${runId}-[1-9]\\d*$`).test(artifactName)) {
    fail('INPUT', 'The artifact name must be the unique name produced by this run\'s build job.');
  }
  if (typeof headSha !== 'string' || !/^[a-f0-9]{40}$/i.test(headSha)) fail('INPUT', 'The exact build commit SHA is required.');
  if (typeof token !== 'string' || !token.trim()) fail('INPUT', 'A GitHub token with actions:read is required.');
  let api;
  try { api = new URL(input.apiUrl || 'https://api.github.com'); }
  catch { fail('INPUT', 'A valid GitHub API URL is required.'); }
  if (api.protocol !== 'https:' || api.username || api.password || api.search || api.hash) {
    fail('INPUT', 'The GitHub API URL must use HTTPS without credentials, a query or a fragment.');
  }
  const base = api.href.replace(/\/$/, '');
  const url = new URL(`${base}/repos/${repository}/actions/runs/${runId}/artifacts`);
  url.searchParams.set('name', artifactName);
  url.searchParams.set('per_page', '100');
  return { ...input, headSha: headSha.toLowerCase(), url };
}

function validateMetadata(payload, expected) {
  if (!payload || !Number.isSafeInteger(payload.total_count) || payload.total_count < 0 || !Array.isArray(payload.artifacts)) {
    fail('SCHEMA', 'The artifact listing is missing its count or records.');
  }
  // The REST query filters by exact name. Never choose the newest of duplicates,
  // or approve an incomplete/paginated response that cannot establish uniqueness.
  if (payload.total_count > 1 || payload.artifacts.length > 1) {
    fail('AMBIGUOUS', 'Multiple artifacts matched the exact build artifact name.');
  }
  if (payload.total_count !== payload.artifacts.length) fail('SCHEMA', 'The artifact listing is incomplete.');
  if (payload.total_count === 0) return null;
  const artifact = payload.artifacts[0];
  if (!artifact || artifact.name !== expected.artifactName) fail('NAME_MISMATCH', 'The returned artifact name does not match the build output.');
  if (!Number.isSafeInteger(artifact.id) || String(artifact.id) !== expected.artifactId) {
    fail('ID_MISMATCH', 'The returned artifact ID does not match the uploaded build artifact.');
  }
  if (artifact.expired !== false) fail('EXPIRED', 'The uploaded artifact is expired or lacks an explicit nonexpired state.');
  if (!Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes <= 0) fail('SCHEMA', 'The uploaded artifact must have a positive byte size.');
  const run = artifact.workflow_run;
  if (!run || !Number.isSafeInteger(run.id) || typeof run.head_sha !== 'string') {
    fail('SCHEMA', 'The uploaded artifact lacks workflow-run and commit identity.');
  }
  if (String(run.id) !== expected.runId) fail('RUN_MISMATCH', 'The uploaded artifact belongs to another workflow run.');
  if (run.head_sha.toLowerCase() !== expected.headSha) fail('HEAD_MISMATCH', 'The uploaded artifact belongs to another commit.');
  return artifact;
}

export async function waitForPagesArtifact(input, {
  fetchImpl = globalThis.fetch,
  wait = sleep,
  now = Date.now,
  log = () => {},
  maxWaitMs = 60_000,
  pollIntervalMs = 3_000,
  requestTimeoutMs = 10_000,
  maxAttempts = 20,
} = {}) {
  const expected = validateInput(input);
  for (const value of [maxWaitMs, pollIntervalMs, requestTimeoutMs, maxAttempts]) {
    if (!Number.isSafeInteger(value) || value <= 0) fail('INPUT', 'Polling bounds must be positive integers.');
  }
  const deadline = now() + maxWaitMs;
  let confirmations = 0;
  for (let attempt = 1; attempt <= maxAttempts && now() < deadline; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(expected.url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(Math.max(1, Math.min(requestTimeoutMs, deadline - now()))),
        headers: {
          Authorization: `Bearer ${expected.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
    } catch {
      // Do not echo request objects, response bodies or underlying errors: they
      // can contain the token. Network and timeout failures are bounded retries.
      log(`Artifact metadata request ${attempt} did not complete; retrying within the deadline.`);
    }
    let artifact = null;
    if (response) {
      if (response.status === 401 || response.status === 403) {
        fail('AUTHORIZATION', `Artifact metadata access was denied (HTTP ${response.status}); check actions:read permission.`);
      }
      if (response.status >= 500 && response.status <= 599) {
        log(`Artifact metadata request ${attempt} returned HTTP ${response.status}; retrying within the deadline.`);
      } else if (response.status !== 200) {
        fail('HTTP', `Artifact metadata request failed (HTTP ${response.status}).`);
      } else {
        let payload;
        try { payload = await response.json(); }
        catch { fail('SCHEMA', 'The artifact metadata response was not valid JSON.'); }
        artifact = validateMetadata(payload, expected);
      }
    }
    if (now() >= deadline) break;
    confirmations = artifact ? confirmations + 1 : 0;
    if (confirmations === 2) {
      return {
        status: 'ready',
        repository: expected.repository,
        runId: expected.runId,
        artifactId: expected.artifactId,
        artifactName: expected.artifactName,
        headSha: expected.headSha,
        bytes: artifact.size_in_bytes,
        attempts: attempt,
        consecutiveObservations: confirmations,
        metadataBackend: 'GitHub REST',
      };
    }
    log(artifact ? 'Exact artifact identity is visible; confirming it on the next observation.'
      : `Expected artifact is not yet visible (observation ${attempt}).`);
    const remaining = deadline - now();
    if (attempt < maxAttempts && remaining > 0) await wait(Math.min(pollIntervalMs, remaining));
  }
  fail('TIMEOUT', 'The exact uploaded artifact did not become stably visible within the bounded metadata wait.');
}

export function inputFromEnvironment(env = process.env) {
  return {
    repository: env.GITHUB_REPOSITORY,
    runId: env.GITHUB_RUN_ID,
    artifactId: env.PAGES_ARTIFACT_ID,
    artifactName: env.PAGES_ARTIFACT_NAME,
    headSha: env.PAGES_SOURCE_SHA,
    token: env.GITHUB_TOKEN,
    apiUrl: env.GITHUB_API_URL,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await waitForPagesArtifact(inputFromEnvironment(), { log: console.log });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const known = error instanceof ArtifactReadinessError;
    console.error(`Pages artifact readiness failed [${known ? error.code : 'INTERNAL'}]: ${known ? error.message : 'Unexpected readiness failure.'}`);
    process.exitCode = 1;
  }
}
