/**
 * Bridge to the native SecureProvider Capacitor plugin.
 *
 * Security contract:
 *  - API keys are passed ONCE, straight from a password input, to the native
 *    setSecret() method. This module never stores, logs, or returns them; the
 *    caller clears the input immediately after the awaited call.
 *  - All read APIs return booleans / counts / model IDs only — never secrets.
 *  - In a plain browser (no native bridge) every method throws UNAVAILABLE so
 *    the UI can show an honest "native app required" state instead of faking
 *    key storage in WebView storage.
 */

let plugin = null;
let resolved = false;

async function resolvePlugin() {
  if (resolved) return plugin;
  resolved = true;
  try {
    const core = await import('@capacitor/core');
    if (core.Capacitor?.isNativePlatform?.()) {
      plugin = core.registerPlugin('SecureProvider');
    }
  } catch {
    plugin = null;
  }
  return plugin;
}

function unavailable() {
  const err = new Error(
    'Secure provider storage is only available inside the Android app (native bridge missing).',
  );
  err.code = 'UNAVAILABLE';
  return err;
}

export async function isSecureProviderAvailable() {
  return (await resolvePlugin()) != null;
}

export async function setSecret(provider, secret) {
  const p = await resolvePlugin();
  if (!p) throw unavailable();
  if (typeof secret !== 'string' || !secret.trim()) {
    throw new Error('Enter the API key first.');
  }
  return p.setSecret({ provider, secret });
}

export async function hasSecret(provider) {
  const p = await resolvePlugin();
  if (!p) throw unavailable();
  return p.hasSecret({ provider });
}

export async function deleteSecret(provider) {
  const p = await resolvePlugin();
  if (!p) throw unavailable();
  return p.deleteSecret({ provider });
}

export async function testConnection(provider) {
  const p = await resolvePlugin();
  if (!p) throw unavailable();
  return p.testConnection({ provider });
}

export async function listModels(provider) {
  const p = await resolvePlugin();
  if (!p) throw unavailable();
  return p.listModels({ provider });
}

export async function generate({ provider, model, prompt, maxTokens }) {
  const p = await resolvePlugin();
  if (!p) throw unavailable();
  return p.generate({ provider, model, prompt, maxTokens });
}
