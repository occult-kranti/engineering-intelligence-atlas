/** Read a reviewed payload without trusting Content-Length or retaining a cancelled stream. */
export const MODEL_DOWNLOAD_TIMEOUT_MS = 120_000;

export async function boundedBytes(response, expected, signal, onProgress = () => {}) {
  signal.throwIfAborted();
  if (!response.ok) throw new Error(`Model download failed (${response.status})`);
  if (!response.body) throw new Error('Model response has no readable data');
  const stated = response.headers.get('content-length');
  if (stated && Number(stated) > expected) throw new Error('Model exceeds its reviewed size');
  const reader = response.body.getReader(); let total = 0; const chunks = [];
  const cancel = () => { void reader.cancel(signal.reason).catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      total += value.length;
      if (total > expected) throw new Error('Model exceeds its reviewed size');
      chunks.push(value); onProgress(Math.round(total / expected * 100));
    }
    if (total !== expected) throw new Error('Incomplete model download');
    const output = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output.buffer;
  } catch (error) { cancel(); throw error; }
  finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
}
