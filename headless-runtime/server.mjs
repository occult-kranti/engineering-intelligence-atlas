#!/usr/bin/env node
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { API_VERSION, BODY_LIMIT, OUTPUT_LIMIT, TOKEN_PATTERN, RuntimeError, assertObject } from './contract.mjs';
import { createRuntime } from './runtime.mjs';
import { providerSecretFiles, readSecretFile } from './secrets.mjs';

const digest = value => crypto.createHash('sha256').update(value).digest();

function writeJson(res, status, value) {
  const body = JSON.stringify(value);
  if (Buffer.byteLength(body) > OUTPUT_LIMIT) {
    // RuntimeController produces bounded projections; this is a final transport
    // guard for injected adapters. A saved mutation still keeps its success id.
    const receipt = value?.ok === true && typeof value.id === 'string'
      ? { ok: true, id: value.id, replayed: value.replayed === true, snapshotOmitted: true,
          notice: 'Command saved; response projection exceeded its limit. Do not replay with a new id.' }
      : { ok: false, code: 'RESPONSE_TOO_LARGE', error: 'Response exceeds its transport limit.' };
    return writeJson(res, receipt.ok ? 200 : 503, receipt);
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

async function readJson(req) {
  if (req.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    throw new RuntimeError('JSON_REQUIRED', 'Content-Type application/json is required.', 415);
  }
  if (Number(req.headers['content-length'] ?? 0) > BODY_LIMIT) {
    throw new RuntimeError('REQUEST_TOO_LARGE', 'Request exceeds 256 KiB.', 413);
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new RuntimeError('REQUEST_TOO_LARGE', 'Request exceeds 256 KiB.', 413);
    chunks.push(chunk);
  }
  try { return assertObject(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
  catch (error) {
    if (error instanceof RuntimeError) throw error;
    throw new RuntimeError('INVALID_JSON', 'A valid JSON object is required.');
  }
}

/** Service-to-service HTTP API. Browser origins are denied unless explicitly listed. */
export function createServer({ runtime, token, allowedHosts = [], allowedOrigins = [], maxConcurrent = 32 }) {
  if (!TOKEN_PATTERN.test(token ?? '')) throw new RuntimeError('INVALID_CONFIG', 'A valid control token is required.', 503);
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 256) {
    throw new RuntimeError('INVALID_CONFIG', 'Invalid concurrency limit.', 503);
  }
  const tokenHash = digest(token);
  const hosts = new Set(allowedHosts);
  const origins = new Set(allowedOrigins);
  let active = 0;
  const server = http.createServer((req, res) => {
    void (async () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const localHosts = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`];
      if (!localHosts.includes(req.headers.host) && !hosts.has(req.headers.host)) {
        throw new RuntimeError('INVALID_HOST', 'Host is not configured for this runtime.', 403);
      }
      if (req.headers.origin && !origins.has(req.headers.origin)) {
        throw new RuntimeError('ORIGIN_DENIED', 'Browser access requires an explicitly configured origin.', 403);
      }
      if (req.url === '/healthz' && req.method === 'GET') {
        return writeJson(res, 200, { ok: true, service: 'daftar-headless', apiVersion: API_VERSION });
      }
      const presented = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/)?.[1];
      if (!presented || !crypto.timingSafeEqual(digest(presented), tokenHash)) {
        res.setHeader('WWW-Authenticate', 'Bearer');
        throw new RuntimeError('UNAUTHORIZED', 'A runtime control credential is required.', 401);
      }
      if (active >= maxConcurrent) throw new RuntimeError('BUSY', 'Runtime request capacity reached. Retry reads later.', 429);
      active += 1;
      try {
        if (req.url === '/v1/status' && req.method === 'GET') return writeJson(res, 200, await runtime.status());
        if (req.url === '/v1/workbench' && req.method === 'GET') {
          if (!runtime.workbench) throw new RuntimeError('WORKBENCH_UNAVAILABLE', 'This runtime has no portable workbench.', 503);
          return writeJson(res, 200, { ok: true, workbench: runtime.workbench.capabilities() });
        }
        if (req.url === '/v1/workbench/call' && req.method === 'POST') {
          if (!runtime.workbench) throw new RuntimeError('WORKBENCH_UNAVAILABLE', 'This runtime has no portable workbench.', 503);
          const { id, method, args, spec } = runtime.workbench.validateEnvelope(await readJson(req));
          const result = await runtime.workbench.call(method, args, { id });
          const response = { ok: true, ...(id ? { id } : {}), result };
          if (Buffer.byteLength(JSON.stringify(response)) > OUTPUT_LIMIT) {
            if (!spec.mutates) throw new RuntimeError('RESPONSE_TOO_LARGE', 'Workbench read exceeds its transport limit.', 503);
            return writeJson(res, 200, { ok: true, id, result: { ok: result?.ok !== false, id, snapshotOmitted: true,
              notice: 'The request receipt was saved. Inspect current state; do not repeat this operation with a new id.' } });
          }
          return writeJson(res, 200, response);
        }
        if (req.url === '/v1/office' && req.method === 'GET') return writeJson(res, 200, await runtime.snapshot());
        if (req.url === '/v1/host' && req.method === 'GET') return writeJson(res, 200, await runtime.hostOperation('status', {}));
        if (req.url === '/v1/activity' && req.method === 'GET') return writeJson(res, 200, await runtime.activityOperation('status', {}));
        if (['/v1/activity/query', '/v1/activity/summarize'].includes(req.url) && req.method === 'POST') {
          return writeJson(res, 200, await runtime.activityOperation(req.url.split('/').at(-1), await readJson(req)));
        }
        if (req.url === '/v1/environments' && req.method === 'GET') return writeJson(res, 200, await runtime.environmentOperation('status', {}));
        if (req.url === '/v1/resources' && req.method === 'GET') return writeJson(res, 200, await runtime.resourceOperation('status', {}));
        if (req.url === '/v1/design' && req.method === 'GET') return writeJson(res, 200, await runtime.designOperation('catalog', {}));
        const managedRoutes = {
          '/v1/design/plan': ['designOperation','plan'], '/v1/design/install': ['designOperation','install'], '/v1/design/inspect': ['designOperation','inspect'],
          '/v1/environments/prepare': ['environmentOperation', 'prepare'], '/v1/environments/run': ['environmentOperation', 'run'], '/v1/environments/inspect': ['environmentOperation', 'inspect'],
          '/v1/resources/status': ['resourceOperation', 'status'], '/v1/resources/configure': ['resourceOperation', 'configure'], '/v1/resources/resolve': ['resourceOperation', 'resolve'],
          '/v1/resources/plan': ['resourceOperation', 'plan'], '/v1/resources/start': ['resourceOperation', 'start'], '/v1/resources/inspect': ['resourceOperation', 'inspect'], '/v1/resources/cancel': ['resourceOperation', 'cancel'],
        };
        if (Object.hasOwn(managedRoutes, req.url) && req.method === 'POST') {
          const [method, operation] = managedRoutes[req.url];
          return writeJson(res, 200, await runtime[method](operation, await readJson(req)));
        }
        const hostRoutes = { '/v1/host/configure': 'configure', '/v1/host/god-mode': 'godMode', '/v1/host/submit': 'submit',
          '/v1/host/approve': 'approve', '/v1/host/cancel': 'cancel', '/v1/host/inspect': 'inspect', '/v1/host/stop-all': 'stopAll' };
        if (Object.hasOwn(hostRoutes, req.url) && req.method === 'POST') {
          return writeJson(res, 200, await runtime.hostOperation(hostRoutes[req.url], await readJson(req)));
        }
        if ((req.url === '/v1/models' || req.url.startsWith('/v1/models?')) && req.method === 'GET') {
          const query = new URL(req.url, 'http://127.0.0.1').searchParams;
          if ([...query.keys()].some(key => !['companyId', 'employeeId'].includes(key)) || query.getAll('companyId').length !== 1 || query.getAll('employeeId').length > 1) {
            throw new RuntimeError('INVALID_REQUEST', 'Provide companyId and an optional employeeId.');
          }
          return writeJson(res, 200, await runtime.modelOperation('snapshot', Object.fromEntries(query)));
        }
        if (['/v1/models/pull', '/v1/models/cancel', '/v1/models/select'].includes(req.url) && req.method === 'POST') {
          return writeJson(res, 200, await runtime.modelOperation(req.url.endsWith('/pull') ? 'request' : req.url.split('/').at(-1), await readJson(req)));
        }
        if (req.url === '/v1/commands' && req.method === 'POST') return writeJson(res, 200, await runtime.command(await readJson(req)));
        if (req.url === '/v1/workers' && req.method === 'POST') {
          const body = await readJson(req);
          if (Object.keys(body).length !== 1 || typeof body.enabled !== 'boolean') {
            throw new RuntimeError('INVALID_REQUEST', 'Provide only the boolean enabled property.');
          }
          return writeJson(res, 200, await runtime.setEnabled(body.enabled));
        }
        if (req.url === '/v1/workers/run-once' && req.method === 'POST') {
          if (Object.keys(await readJson(req)).length) throw new RuntimeError('INVALID_REQUEST', 'Provide an empty object.');
          return writeJson(res, 202, await runtime.runOnce());
        }
        throw new RuntimeError('NOT_FOUND', 'Runtime endpoint not found.', 404);
      } finally { active -= 1; }
    })().catch(error => {
      if (res.headersSent || res.destroyed) return;
      const known = error instanceof RuntimeError;
      writeJson(res, known ? error.status : 500, { ok: false,
        code: known ? error.code : 'RUNTIME_ERROR',
        error: known ? error.message : 'Runtime request could not be completed. Inspect state before retrying a mutation.' });
    });
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 32;
  return server;
}

export async function startServer(config = {}) {
  const host = config.host ?? '127.0.0.1';
  if (!['127.0.0.1', '::1'].includes(host) && !(host === '0.0.0.0' && config.allowContainerBind === true)) {
    throw new RuntimeError('INVALID_CONFIG', 'Non-loopback binding requires the explicit container-bind setting.', 503);
  }
  const port = config.port ?? 8788;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RuntimeError('INVALID_CONFIG', 'Invalid port.', 503);
  const token = config.token ?? readSecretFile(config.tokenFile, { controlToken: true });
  const runtime = config.runtime ?? createRuntime(config);
  // Fail startup rather than advertising readiness with a missing native binary.
  try { await runtime.snapshot(); } catch (error) { await runtime.close(); throw error; }
  const server = createServer({ runtime, token, allowedHosts: config.allowedHosts,
    allowedOrigins: config.allowedOrigins, maxConcurrent: config.maxConcurrent });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.off('error', reject); resolve(); });
    });
  } catch (error) { await runtime.close(); throw error; }
  return { server, runtime, async close() {
    const closing = new Promise(resolve => server.close(resolve));
    server.closeIdleConnections();
    await runtime.close();
    server.closeAllConnections();
    await closing;
  } };
}

export function configurationFromEnv(env = process.env) {
  return { repoRoot: env.DAFTAR_REPO_ROOT || undefined, dataDir: env.DAFTAR_DATA_DIR || undefined,
    binaryPath: env.DAFTAR_CORE_BINARY || undefined, host: env.DAFTAR_HOST || '127.0.0.1',
    port: Number(env.DAFTAR_PORT || 8788), concurrency: Number(env.DAFTAR_CONCURRENCY || 2),
    allowContainerBind: env.DAFTAR_ALLOW_CONTAINER_BIND === '1',
    hostControlEnabled: env.DAFTAR_HOST_CONTROL === '1',
    tokenFile: env.DAFTAR_CONTROL_TOKEN_FILE,
    allowedHosts: (env.DAFTAR_ALLOWED_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean),
    secretFiles: providerSecretFiles(env), ollamaBaseUrl: env.DAFTAR_OLLAMA_BASE_URL || undefined,
    ollamaLocalOnly: env.DAFTAR_OLLAMA_LOCAL_ONLY === '1',
    cloudSyncEnabled: env.DAFTAR_CLOUD_SYNC === '1', cloudUrl: env.DAFTAR_CLOUD_URL || undefined,
    cloudPairingFile: env.DAFTAR_CLOUD_PAIRING_FILE || undefined, cloudEncryptionKeyFile: env.DAFTAR_CLOUD_ENCRYPTION_KEY_FILE || undefined,
    cloudAllowKnownSchemaDefaults: env.DAFTAR_CLOUD_ALLOW_KNOWN_SCHEMA_DEFAULTS === '1',
    cloudSyncIntervalSeconds: Number(env.DAFTAR_CLOUD_SYNC_INTERVAL_SECONDS || 60) };
}

async function main() {
  try {
    const service = await startServer(configurationFromEnv());
    const address = service.server.address();
    process.stdout.write(`Daftar headless runtime listening on ${address.address}:${address.port}; workers paused.\n`);
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      void service.close().finally(() => process.exit(0));
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    process.stderr.write(`${error instanceof RuntimeError ? error.message : 'Runtime startup failed. Verify configuration and build.'}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) void main();
