import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SECURE_DIR = join(ROOT, 'android/app/src/main/java/com/researchdirector/shell/secure');
const PLUGIN_FILE = join(ROOT, 'android/app/src/main/java/com/researchdirector/shell/SecureProviderPlugin.java');

function read(path) {
  return readFileSync(path, 'utf8');
}

function listFiles(dir, ext, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listFiles(full, ext, out);
    else if (full.endsWith(ext)) out.push(full);
  }
  return out;
}

const secureSources = Object.fromEntries(
  listFiles(join(ROOT, 'android/app/src/main/java/com/researchdirector/shell'), '.java').map((f) => [
    f,
    read(f),
  ]),
);
const allSecureJava = Object.values(secureSources).join('\n');

const jsSources = Object.fromEntries(
  listFiles(join(ROOT, 'www/js'), '.js').map((f) => [f, read(f)]),
);

test('native network code can only reach api.openai.com and api.anthropic.com', () => {
  const hosts = new Set();
  for (const src of Object.values(secureSources)) {
    for (const m of src.matchAll(/https:\/\/([A-Za-z0-9.-]+)/g)) hosts.add(m[1]);
  }
  assert.deepEqual([...hosts].sort(), ['api.anthropic.com', 'api.openai.com']);
});

test('redirects are disabled and 3xx responses are refused', () => {
  const client = secureSources[join(SECURE_DIR, 'ProviderClient.java')];
  assert.match(client, /setInstanceFollowRedirects\(false\)/);
  assert.match(client, /status >= 300 && status < 400/);
});

test('keystore store uses AndroidKeyStore AES/GCM and app-private preferences', () => {
  const store = secureSources[join(SECURE_DIR, 'SecretStore.java')];
  assert.match(store, /"AndroidKeyStore"/);
  assert.match(store, /"AES\/GCM\/NoPadding"/);
  assert.match(store, /Context\.MODE_PRIVATE/);
  assert.match(store, /setKeySize\(256\)/);
  // Fail closed: read/write failures wipe the entry and throw.
  assert.match(store, /prefs\.edit\(\)\s*\.remove\(prefKey\(provider\)\)\.commit\(\)/);
  // No EncryptedSharedPreferences / plaintext fallback dependency.
  assert.doesNotMatch(store, /EncryptedSharedPreferences/);
  assert.doesNotMatch(store, /putString\(prefKey\(provider\),\s*new String\(secret\)/);
});

test('no logging calls exist in the secure native sources', () => {
  for (const [file, src] of Object.entries(secureSources)) {
    assert.doesNotMatch(src, /android\.util\.Log|Log\.(d|i|w|e|v)\(|System\.out|System\.err|printStackTrace/, file);
  }
});

test('plugin secret APIs resolve with booleans only — never the secret', () => {
  const plugin = read(PLUGIN_FILE);
  // setSecret/hasSecret/deleteSecret resolve objects contain only these keys.
  const resolveBlocks = plugin.match(/JSObject ret = new JSObject\(\);[\s\S]*?call\.resolve\(ret\);/g) ?? [];
  assert.ok(resolveBlocks.length >= 3);
  const allowedKeys = /ret\.put\("(configured|deleted|ok|provider|modelCount|models|text|model|inputTokens|outputTokens)"/;
  for (const block of resolveBlocks) {
    for (const m of block.matchAll(/ret\.put\("([^"]+)"/g)) {
      assert.match(`ret.put("${m[1]}"`, allowedKeys, `unexpected result key: ${m[1]}`);
    }
    assert.doesNotMatch(block, /ret\.put\([^)]*\bsecret\b/);
  }
});

test('native generate enforces caps and provider validation before network', () => {
  const plugin = read(PLUGIN_FILE);
  assert.match(plugin, /EndpointPolicy\.requireProvider/);
  assert.match(plugin, /EndpointPolicy\.requireModelId/);
  assert.match(plugin, /EndpointPolicy\.requirePrompt/);
  assert.match(plugin, /EndpointPolicy\.clampMaxTokens/);
});

test('MainActivity registers the app-local plugin', () => {
  const main = read(join(ROOT, 'android/app/src/main/java/com/researchdirector/shell/MainActivity.java'));
  assert.match(main, /registerPlugin\(SecureProviderPlugin\.class\)/);
});

test('no API-key-shaped strings anywhere in shipped web/native sources', () => {
  const keyPattern = /sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{10,}/;
  for (const [file, src] of [...Object.entries(secureSources), ...Object.entries(jsSources)]) {
    assert.doesNotMatch(src, keyPattern, `key-shaped string in ${file}`);
  }
});

test('web code never writes secrets to WebView storage', () => {
  for (const [file, src] of Object.entries(jsSources)) {
    // No direct storage writes of anything named like a secret.
    assert.doesNotMatch(
      src,
      /(setItem|Preferences\.set)\s*\([^)]*\b(secret|apiKey|api_key|password)\b/,
      file,
    );
  }
  // The project store actively rejects secret-shaped fields.
  const store = jsSources[join(ROOT, 'www/js/project-store.js')];
  assert.match(store, /FORBIDDEN_FIELD_NAMES/);
  assert.match(store, /'apikey'/);
  assert.match(store, /'password'/);
});

test('project UI clears password inputs right after native setSecret', () => {
  const ui = jsSources[join(ROOT, 'www/js/project-ui.js')];
  // The value is captured, awaited natively, then the input is wiped.
  assert.match(ui, /\.value\s*=\s*''/);
  assert.match(ui, /setSecret\(provider,\s*key\)/);
});

test('project mode is text-only: no code execution or repository writes in JS', () => {
  for (const [file, src] of Object.entries(jsSources)) {
    assert.doesNotMatch(src, /\beval\s*\(|new Function\(|child_process|require\('fs'\)/, file);
  }
});

test('settings budget caps mirror native hard caps', () => {
  const store = jsSources[join(ROOT, 'www/js/project-store.js')];
  assert.match(store, /4096/); // maxOutputTokensPerCall hard cap
  const policy = secureSources[join(SECURE_DIR, 'EndpointPolicy.java')];
  assert.match(policy, /MAX_MAX_TOKENS = 4096/);
});
