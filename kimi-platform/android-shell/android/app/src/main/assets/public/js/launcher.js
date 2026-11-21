/**
 * Launcher wiring for the Research Director Android shell.
 *
 * - Validates/normalizes the runtime URL (HTTPS by default; HTTP only on
 *   localhost/development hosts).
 * - Persists ONLY the non-secret URL via Capacitor Preferences
 *   (localStorage fallback when the native bridge is absent, e.g. dev browser).
 * - Opens the remote Director in this WebView. No extra bridge, shell, file,
 *   or secret-access API is exposed to the remote page.
 */
import { normalizeRuntimeUrl, isPersistableRuntimeUrl } from './runtime-url.js';
import {
  createRuntimeStore,
  createPreferencesStorage,
  createLocalStorageAdapter,
} from './runtime-store.js';

async function resolveStorage() {
  try {
    const core = await import('@capacitor/core');
    const { Preferences } = await import('@capacitor/preferences');
    if (core.Capacitor?.isNativePlatform?.()) {
      return { storage: createPreferencesStorage(Preferences), label: 'device preferences' };
    }
  } catch {
    /* fall through to localStorage */
  }
  return { storage: createLocalStorageAdapter(), label: 'browser storage' };
}

function setStatus(el, message, tone) {
  el.textContent = message;
  if (tone) el.dataset.tone = tone;
  else el.removeAttribute('data-tone');
}

async function main() {
  const form = document.getElementById('runtime-form');
  const input = document.getElementById('runtime-url');
  const status = document.getElementById('runtime-status');
  const forget = document.getElementById('runtime-forget');
  const connectButton = form.querySelector('button[type="submit"]');

  const { storage } = await resolveStorage();
  const store = createRuntimeStore(storage, { isPersistableRuntimeUrl });

  // Offer the previously saved URL (never auto-connect: the remote server may
  // be offline, and connecting has cost implications).
  const saved = await store.load();
  if (saved) {
    input.value = saved;
    setStatus(status, 'Saved runtime URL restored from local storage. Nothing has connected yet.', 'info');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = normalizeRuntimeUrl(input.value);
    if (!result.ok) {
      setStatus(status, result.error, 'error');
      input.focus();
      return;
    }
    connectButton.disabled = true;
    try {
      await store.save(result.url);
      if (result.usesCleartext) {
        setStatus(status, 'Connecting to a localhost development server over http:// …', 'info');
      } else {
        setStatus(
          status,
          'Connecting… Cloud/API usage on the remote server requires it to be running and may incur charges.',
          'info',
        );
      }
      // Navigate this WebView to the remote runtime. The system back button
      // returns here; nothing is embedded or proxied.
      window.location.assign(result.url);
    } catch (err) {
      setStatus(status, `Could not store the URL: ${err?.message ?? err}`, 'error');
      connectButton.disabled = false;
    }
  });

  forget.addEventListener('click', async () => {
    await store.clear();
    input.value = '';
    setStatus(status, 'Saved runtime URL removed from this device.', 'info');
    input.focus();
  });
}

main().catch((err) => {
  const status = document.getElementById('runtime-status');
  if (status) setStatus(status, `Launcher failed to initialize: ${err?.message ?? err}`, 'error');
});
