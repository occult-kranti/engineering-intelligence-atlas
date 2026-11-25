import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedBytes } from '../download-core.mjs';

const signal = () => new AbortController().signal;
const bytes = (...chunks) => new Response(new ReadableStream({
  start(controller) { chunks.forEach(chunk => controller.enqueue(new Uint8Array(chunk))); controller.close(); },
}));

test('streamed payload preserves bytes, reports bounded progress and releases its reader', async () => {
  const response = bytes([1, 2], [3], [4, 5]); const progress = [];
  const result = await boundedBytes(response, 5, signal(), value => progress.push(value));
  assert.deepEqual([...new Uint8Array(result)], [1, 2, 3, 4, 5]);
  assert.deepEqual(progress, [40, 60, 100]);
  assert.equal(response.body.locked, false);
});

test('HTTP failure, absent body and excessive declared sizes are rejected before streaming', async () => {
  await assert.rejects(boundedBytes(new Response('no', { status: 503 }), 2, signal()), /download failed \(503\)/);
  await assert.rejects(boundedBytes(new Response(null), 2, signal()), /no readable data/);
  await assert.rejects(boundedBytes(new Response('no', { headers: { 'content-length': '12' } }), 2, signal()), /exceeds/);
});

test('actual byte limit rejects chunked overflow and cancels the response', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); },
    cancel() { cancelled = true; },
  }));
  await assert.rejects(boundedBytes(response, 2, signal()), /exceeds/);
  assert.equal(cancelled, true); assert.equal(response.body.locked, false);
});

test('short streams are rejected even when their declared length matches the reviewed file', async () => {
  const response = new Response('a', { headers: { 'content-length': '2' } });
  await assert.rejects(boundedBytes(response, 2, signal()), /Incomplete/);
  assert.equal(response.body.locked, false);
});

test('cancelling a stalled read promptly cancels its reader without stale progress', async () => {
  const controller = new AbortController(); let cancelled = false; const progress = [];
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  const read = boundedBytes(response, 10, controller.signal, value => progress.push(value));
  const reason = new DOMException('Stopped by the user', 'AbortError'); controller.abort(reason);
  await assert.rejects(read, error => error === reason);
  assert.equal(cancelled, true); assert.equal(response.body.locked, false); assert.deepEqual(progress, []);
});

test('timeout abortion releases a partially read stream and retains its readable cause', async () => {
  const controller = new AbortController(); let cancelled = false;
  let reportFirst; const firstChunk = new Promise(resolve => { reportFirst = resolve; });
  const response = new Response(new ReadableStream({
    start(stream) { stream.enqueue(new Uint8Array([1, 2])); },
    cancel() { cancelled = true; },
  }));
  const read = boundedBytes(response, 10, controller.signal, reportFirst);
  await firstChunk;
  const reason = new DOMException('Model download timed out', 'TimeoutError'); controller.abort(reason);
  await assert.rejects(read, error => error === reason);
  assert.equal(cancelled, true); assert.equal(response.body.locked, false);
});

test('cleanup errors do not replace the original stream failure', async () => {
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); },
    cancel() { throw new Error('cleanup failed'); },
  }));
  await assert.rejects(boundedBytes(response, 1, signal()), /exceeds/);
  assert.equal(response.body.locked, false);
});
