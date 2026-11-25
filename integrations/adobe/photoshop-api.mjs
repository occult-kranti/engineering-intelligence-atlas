/** Fixed Photoshop v2 operations. No SDK shell, arbitrary action JSON or caller URLs. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

const ADOBE = 'https://photoshop-api.adobe.io';
const TOKEN = 'https://ims-na1.adobelogin.com/ims/token/v3';
const MAX_FILE = 32 * 1024 * 1024;
const MAX_JSON = 4 * 1024 * 1024;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hmac = (key, value) => crypto.createHmac('sha256', key).update(value).digest();
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export class PhotoshopAdapterError extends Error {
  constructor(code, message) { super(message); this.name = 'PhotoshopAdapterError'; this.code = code; }
}
const fail = (code, message) => { throw new PhotoshopAdapterError(code, message); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);

function readRegular(file, maxBytes, privateFile = false) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) fail('ADOBE_CONFIG', 'A private absolute credential or asset path is required.');
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const before = fs.fstatSync(fd);
    if (!before.isFile() || before.size < 1 || before.size > maxBytes || (privateFile && process.platform !== 'win32' && (before.mode & 0o077))) throw Error('invalid file');
    const bytes = Buffer.alloc(before.size);
    let count = 0;
    while (count < bytes.length) { const n = fs.readSync(fd, bytes, count, bytes.length - count, count); if (!n) break; count += n; }
    const after = fs.fstatSync(fd);
    if (count !== bytes.length || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw Error('changed file');
    return bytes;
  } catch (error) {
    if (error instanceof PhotoshopAdapterError) throw error;
    fail('ADOBE_FILE_UNAVAILABLE', 'A required bounded regular file is unavailable, changed, or has unsafe permissions.');
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

function storageConfig(file) {
  let value;
  try { value = JSON.parse(readRegular(file, 16384, true).toString('utf8')); } catch (error) { if (error instanceof PhotoshopAdapterError) throw error; fail('ADOBE_STORAGE_CONFIG', 'The asset storage credential file is invalid.'); }
  const keys = ['endpoint', 'region', 'bucket', 'accessKeyId', 'secretAccessKey', 'sessionToken', 'prefix', 'virtualHosted'];
  if (!plain(value) || Object.keys(value).some(key => !keys.includes(key))) fail('ADOBE_STORAGE_CONFIG', 'Unsupported asset storage configuration.');
  let endpoint;
  try { endpoint = new URL(value.endpoint); } catch { fail('ADOBE_STORAGE_CONFIG', 'Configure the HTTPS endpoint for the existing private asset bucket.'); }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.port
    || endpoint.pathname !== '/' || net.isIP(endpoint.hostname) || !/^[a-z0-9.-]+$/.test(endpoint.hostname)
    || !endpoint.hostname.includes('.') || endpoint.hostname.endsWith('.localhost') || endpoint.hostname.endsWith('.local')) {
    fail('ADOBE_STORAGE_CONFIG', 'Asset storage requires a public HTTPS DNS origin without a path, port or embedded credentials.');
  }
  if (!/^[a-z0-9-]{1,64}$/.test(value.region ?? '') || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value.bucket ?? '')
    || net.isIP(value.bucket) || value.bucket.includes('..') || !/^[A-Za-z0-9_-]{3,256}$/.test(value.accessKeyId ?? '')
    || typeof value.secretAccessKey !== 'string' || value.secretAccessKey.length < 16 || value.secretAccessKey.length > 2048
    || /[\x00-\x20\x7f]/.test(value.secretAccessKey) || (value.virtualHosted !== undefined && typeof value.virtualHosted !== 'boolean')
    || (value.sessionToken !== undefined && (typeof value.sessionToken !== 'string' || value.sessionToken.length > 8192 || /[\r\n\0]/.test(value.sessionToken)))) {
    fail('ADOBE_STORAGE_CONFIG', 'Asset storage credentials or bucket settings are invalid.');
  }
  const prefix = value.prefix ?? 'daftar-creative';
  if (!/^[A-Za-z0-9_/-]{1,120}$/.test(prefix) || prefix.startsWith('/') || prefix.endsWith('/') || prefix.includes('//')) fail('ADOBE_STORAGE_CONFIG', 'Use a dedicated bounded asset prefix.');
  return { ...value, prefix, endpoint: endpoint.origin };
}

/** AWS SigV4 query signing, checked against AWS's published reference vector. */
export function presignS3({ endpoint, bucket, region, accessKeyId, secretAccessKey, sessionToken, virtualHosted = false }, method, key, { now = new Date(), expires = 1800 } = {}) {
  if (!['GET', 'PUT', 'DELETE'].includes(method) || !Number.isInteger(expires) || expires < 1 || expires > 604800
    || typeof key !== 'string' || key.split('/').some(p => !p || p === '.' || p === '..')) fail('ADOBE_STORAGE_CONFIG', 'Invalid bounded storage operation.');
  const origin = new URL(endpoint);
  if (virtualHosted) origin.hostname = `${bucket}.${origin.hostname}`;
  const uri = '/' + (virtualHosted ? [] : [bucket]).concat(key.split('/')).map(encode).join('/');
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = date.slice(0, 8), scope = `${day}/${region}/s3/aws4_request`;
  const values = { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': date, 'X-Amz-Expires': String(expires), 'X-Amz-SignedHeaders': 'host',
    ...(sessionToken ? { 'X-Amz-Security-Token': sessionToken } : {}) };
  const query = Object.entries(values).map(([k, v]) => [encode(k), encode(v)]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(pair => pair.join('=')).join('&');
  const canonical = `${method}\n${uri}\n${query}\nhost:${origin.host}\n\nhost\nUNSIGNED-PAYLOAD`;
  const keyDate = hmac(`AWS4${secretAccessKey}`, day), keyRegion = hmac(keyDate, region), keyService = hmac(keyRegion, 's3');
  const signature = hmac(hmac(keyService, 'aws4_request'), `AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`).toString('hex');
  return `${origin.origin}${uri}?${query}&X-Amz-Signature=${signature}`;
}

async function boundedBytes(response, limit) {
  if (Number(response.headers.get('content-length') ?? 0) > limit) { await response.body?.cancel().catch(() => undefined); fail('ADOBE_RESPONSE_LIMIT', 'A remote response exceeded its size limit.'); }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) fail('ADOBE_RESPONSE_LIMIT', 'A remote response exceeded its size limit.'); chunks.push(Buffer.from(value)); }
    return Buffer.concat(chunks, size);
  } finally { await reader.cancel().catch(() => undefined); }
}

function safeManifest(value, budget = { count: 0 }, depth = 0) {
  if (++budget.count > 100000 || depth > 32) fail('ADOBE_RESPONSE_LIMIT', 'The document manifest exceeds its structural limit.');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return /https?:\/\/|X-Amz-(?:Credential|Signature|Security-Token)/i.test(value) ? '[external reference omitted]' : value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('ADOBE_RESPONSE_INVALID', 'The manifest contains an invalid numeric value.'); return value; }
  if (Array.isArray(value)) return value.map(item => safeManifest(item, budget, depth + 1));
  if (!plain(value)) fail('ADOBE_RESPONSE_INVALID', 'The document manifest is invalid.');
  const clean = Object.create(null);
  for (const [key, item] of Object.entries(value)) {
    // Download URLs and credentials are capabilities, not portable PSD metadata.
    if (/url|href|uri|token|secret|authorization|credential/i.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    clean[key] = safeManifest(item, budget, depth + 1);
  }
  return clean;
}

function writeNew(directory, name, bytes) {
  const file = path.join(directory, name);
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  syncDirectory(directory);
}

function syncDirectory(directory) {
  if (process.platform === 'win32') return;
  const fd = fs.openSync(directory, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

/** Injection is a module-level test seam, never an HTTP/configuration setting. */
export function createPhotoshopExecutor({ fetchImpl = globalThis.fetch, wait = sleep, now = () => new Date(), uuid = () => crypto.randomUUID() } = {}) {
  return async function execute({ config, operation, inputPath, outputDir, input, signal, authorize }) {
    const deadline = AbortSignal.timeout(20 * 60 * 1000);
    signal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    if (!plain(config) || config.enabled !== true || config.allowPaidRequests !== true) fail('ADOBE_NOT_CONFIGURED', 'A licensed Photoshop API configuration and explicit paid-request setting are required.');
    if (!['adobe.manifest', 'adobe.render'].includes(operation) || !plain(input)
      || Object.keys(input).some(key => !(operation === 'adobe.manifest' ? ['path'] : ['path', 'format', 'width', 'height']).includes(key))) fail('ADOBE_INPUT', 'Unsupported Photoshop operation or fields.');
    for (const dimension of ['width', 'height']) if (input[dimension] !== undefined && (!Number.isInteger(input[dimension]) || input[dimension] < 16 || input[dimension] > 2048)) fail('ADOBE_INPUT', 'Output dimensions must be between 16 and 2048 pixels.');
    if (input.format !== undefined && !['png', 'jpeg'].includes(input.format)) fail('ADOBE_INPUT', 'Use PNG or JPEG output.');
    let outStat;
    try { outStat = fs.lstatSync(outputDir); } catch { fail('ADOBE_OUTPUT', 'The managed output directory is unavailable.'); }
    if (!path.isAbsolute(outputDir) || !outStat.isDirectory() || outStat.isSymbolicLink()) fail('ADOBE_OUTPUT', 'Use the existing managed output directory.');
    const bytes = readRegular(inputPath, MAX_FILE);
    const extension = path.extname(inputPath).toLowerCase();
    const signatureValid = extension === '.psd' ? bytes.subarray(0, 4).toString() === '8BPS'
      : extension === '.png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : ['.jpg', '.jpeg'].includes(extension) ? bytes[0] === 255 && bytes[1] === 216 : false;
    if (!signatureValid || (operation === 'adobe.manifest' && extension !== '.psd')) fail('ADOBE_INPUT', 'Use a bounded PSD document, or a PNG/JPEG for rendering.');
    const clientId = readRegular(config.clientIdFile, 2048, true).toString('utf8').trim();
    const secret = readRegular(config.clientSecretFile, 8192, true).toString('utf8').trim();
    if (!/^[A-Za-z0-9_-]{3,1024}$/.test(clientId) || !secret || /[\r\n\0]/.test(secret)) fail('ADOBE_CONFIG', 'The Photoshop API credentials have invalid formatting.');
    const storage = storageConfig(config.assetStorageFile);
    const transferId = uuid();
    if (!/^[a-f0-9-]{16,64}$/.test(transferId)) fail('ADOBE_CONFIG', 'Invalid transfer identity.');
    const inputKey = `${storage.prefix}/${transferId}/source${extension}`;
    const format = input.format ?? 'png';
    const outputName = operation === 'adobe.manifest' ? 'manifest.json' : format === 'jpeg' ? 'render.jpg' : 'render.png';
    const outputKey = `${storage.prefix}/${transferId}/${outputName}`;
    const receipt = { schemaVersion: 1, provider: 'adobe-photoshop-v2', operation, inputSha256: hash(bytes), transferId,
      createdAt: now().toISOString(), state: 'prepared', cleanup: 'pending' };
    const receiptFile = path.join(outputDir, 'adobe-receipt.json');
    writeNew(outputDir, 'adobe-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
    const persistReceipt = () => {
      const temporary = receiptFile + '.tmp';
      const fd = fs.openSync(temporary, 'wx', 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(receipt, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temporary, receiptFile); syncDirectory(outputDir);
    };
    const check = async () => { signal?.throwIfAborted(); if (await authorize?.() === false) fail('ADOBE_AUTHORITY', 'Creative execution authority was withdrawn.'); };
    const request = async (url, init, limit, cleanup = false) => {
      if (!cleanup) await check();
      const timeout = AbortSignal.timeout(cleanup ? 5000 : 30000);
      const combined = signal && !cleanup ? AbortSignal.any([signal, timeout]) : timeout;
      let response;
      try { response = await fetchImpl(url, { ...init, redirect: 'error', signal: combined }); }
      catch { fail('ADOBE_TRANSPORT', 'A remote request could not be confirmed. Inspect the saved Adobe receipt before another request.'); }
      if (!response.ok) { await response.body?.cancel().catch(() => undefined); fail('ADOBE_REMOTE_REJECTED', 'The configured Adobe or asset-storage service rejected the operation. Remote error details are withheld.'); }
      return boundedBytes(response, limit);
    };
    const jsonRequest = async (url, init) => {
      const content = await request(url, init, MAX_JSON);
      try { const value = JSON.parse(content.toString('utf8')); if (!plain(value)) throw Error('not object'); return value; }
      catch (error) { if (error instanceof PhotoshopAdapterError) throw error; fail('ADOBE_RESPONSE_INVALID', 'The service returned an invalid JSON response.'); }
    };
    let uploadAttempted = false, uploadConfirmed = false, submissionAttempted = false, remoteTerminal = false, result;
    try {
      await check();
      const token = await jsonRequest(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: secret, scope: 'openid,AdobeID,read_organizations' }).toString() });
      if (typeof token.access_token !== 'string' || token.access_token.length < 8 || token.access_token.length > 8192 || /[\r\n\0]/.test(token.access_token)) fail('ADOBE_RESPONSE_INVALID', 'Adobe returned an invalid access-token response.');
      const headers = { Authorization: `Bearer ${token.access_token}`, 'x-api-key': clientId, 'Content-Type': 'application/json' };
      // No Adobe authentication headers are sent to object storage.
      uploadAttempted = true;
      receipt.uploadState = 'dispatching'; persistReceipt();
      await request(presignS3(storage, 'PUT', inputKey, { now: now() }), { method: 'PUT', body: bytes }, 16384);
      uploadConfirmed = true; receipt.uploadState = 'confirmed'; receipt.state = 'asset_uploaded'; persistReceipt();
      const body = { image: { source: { url: presignS3(storage, 'GET', inputKey, { now: now() }) } },
        outputs: [{ destination: { url: presignS3(storage, 'PUT', outputKey, { now: now() }) }, mediaType: operation === 'adobe.manifest' ? 'application/json' : `image/${format}` }] };
      if (operation === 'adobe.manifest') { body.includeLayerThumbnails = false; body.includeXmp = false; }
      else body.edits = { document: { imageSize: { width: { unit: 'pixels_unit', value: input.width ?? 1024 }, height: { unit: 'pixels_unit', value: input.height ?? 1024 }, constrainProportions: false, resample: 'bicubic' } } };
      await check();
      receipt.state = 'dispatching'; persistReceipt(); submissionAttempted = true;
      const started = await jsonRequest(`${ADOBE}/v2/${operation === 'adobe.manifest' ? 'generate-manifest' : 'create-composite'}`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (typeof started.jobId !== 'string' || !/^[A-Za-z0-9:_-]{1,240}$/.test(started.jobId)) fail('ADOBE_RESPONSE_INVALID', 'Adobe accepted a request without a recognized job identity. Inspect account history before retrying.');
      receipt.adobeJobId = started.jobId; receipt.state = 'submitted'; persistReceipt();
      let completed;
      for (let poll = 0; poll < 600; poll++) {
        await check();
        const current = await jsonRequest(`${ADOBE}/v2/status/${encode(started.jobId)}`, { method: 'GET', headers });
        if (current.jobId !== undefined && current.jobId !== started.jobId) fail('ADOBE_RESPONSE_INVALID', 'Adobe returned a mismatched status receipt.');
        if (current.status === 'succeeded') { completed = current; remoteTerminal = true; break; }
        if (current.status === 'failed') { remoteTerminal = true; fail('ADOBE_JOB_FAILED', 'The Adobe job failed. Its identifier is retained in the private receipt.'); }
        if (!['pending', 'running'].includes(current.status)) fail('ADOBE_RESPONSE_INVALID', 'Adobe returned an unrecognized job state.');
        await wait(2000, undefined, { signal });
      }
      if (!completed) fail('ADOBE_OUTCOME_UNCONFIRMED', 'The bounded polling period ended. The remote job may continue; inspect the retained receipt.');
      let output = await request(presignS3(storage, 'GET', outputKey, { now: now() }), { method: 'GET' }, operation === 'adobe.manifest' ? MAX_JSON : MAX_FILE);
      if (operation === 'adobe.manifest') {
        let manifest;
        try { manifest = JSON.parse(output.toString('utf8')); } catch { fail('ADOBE_RESPONSE_INVALID', 'Adobe produced an invalid document manifest.'); }
        output = Buffer.from(JSON.stringify(safeManifest(manifest), null, 2) + '\n');
        if (output.length > MAX_JSON) fail('ADOBE_RESPONSE_LIMIT', 'The normalized manifest exceeds its size limit.');
      } else {
        const valid = format === 'png' ? output.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : output[0] === 255 && output[1] === 216;
        if (!valid) fail('ADOBE_RESPONSE_INVALID', 'Adobe produced an unexpected image format.');
      }
      await check(); writeNew(outputDir, outputName, output);
      receipt.state = 'succeeded'; persistReceipt();
      result = { provider: receipt.provider, operation, remoteAuthVerified: true, adobeJobId: receipt.adobeJobId,
        inputSha256: receipt.inputSha256, cleanup: 'pending', ...(operation === 'adobe.render' ? { format, width: input.width ?? 1024, height: input.height ?? 1024 } : {}) };
      return { result };
    } catch (error) {
      if (uploadAttempted && !uploadConfirmed) receipt.uploadState = 'outcome_unconfirmed';
      receipt.state = submissionAttempted && !remoteTerminal ? 'outcome_unconfirmed' : 'failed';
      persistReceipt();
      if (error instanceof PhotoshopAdapterError) throw error;
      fail(submissionAttempted && !remoteTerminal ? 'ADOBE_OUTCOME_UNCONFIRMED' : 'ADOBE_OPERATION_FAILED',
        submissionAttempted && !remoteTerminal ? 'Local waiting stopped after an Adobe submission. The remote job may continue; inspect the retained receipt before another request.' : 'The bounded Adobe operation did not complete. Inspect its private receipt.');
    } finally {
      const deletes = uploadAttempted ? await Promise.allSettled([inputKey, outputKey].map(key => request(presignS3(storage, 'DELETE', key, { now: now() }), { method: 'DELETE' }, 16384, true))) : [];
      receipt.cleanup = (!uploadAttempted || uploadConfirmed) && (!submissionAttempted || remoteTerminal)
        && deletes.every(item => item.status === 'fulfilled') ? 'complete' : 'pending';
      if (result) result.cleanup = receipt.cleanup;
      persistReceipt();
    }
  };
}

export const executePhotoshopOperation = createPhotoshopExecutor();
