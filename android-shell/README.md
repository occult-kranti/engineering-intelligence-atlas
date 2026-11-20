# Research Director — Android Shell

An independent Capacitor 8.6 Android shell for the Research Director product:

- **Offline Atlas** — the static Engineering Intelligence Atlas web build
  (`../app/dist`) is bundled into the APK and works fully offline.
- **Connect Runtime** — a local screen to enter the URL of a running,
  authenticated Research Director server and open it in the app WebView.
- **Project mode** — a local, text-only squad runner (Director → Research →
  Build → Review) that calls OpenAI/Anthropic directly from native code with
  the user's own API key, kept in Android Keystore-backed storage.

## Layout

| Path | Purpose |
| --- | --- |
| `www/index.html`, `www/launcher.css`, `www/js/launcher.js` | Launcher UI |
| `www/project.html`, `www/js/project-ui.js` | Project mode UI |
| `www/js/secure-provider.js` | Bridge to the native SecureProvider plugin (throws in plain browsers) |
| `www/js/project-store.js` | Non-secret project/settings persistence facade (pure module) |
| `www/js/project-mode.js` | Squad orchestration + budgets (pure module) |
| `www/js/runtime-url.js` | URL normalization/validation (pure module) |
| `www/js/runtime-store.js` | URL persistence facade (pure module) |
| `www/atlas/` | Synced copy of the atlas build (generated) |
| `www/vendor/`, `www/fonts/` | Vendored Capacitor ESM runtime + atlas fonts (generated) |
| `scripts/sync-atlas.mjs` | Copies `../app/dist` (or `../app/dist/public`) into `www/atlas` |
| `tests/` | Node test suite (URL/storage, project store/orchestration, static security) |
| `android/app/src/main/java/com/researchdirector/shell/SecureProviderPlugin.java` | Native Capacitor plugin surface |
| `android/app/src/main/java/com/researchdirector/shell/secure/` | Keystore store, endpoint allowlist, HTTPS client, JSON |
| `android/app/src/test/java/.../secure/` | JVM unit tests (no network, no real keys) |
| `android/` | Capacitor Android project (Gradle) |

## Commands

```bash
npm install
npm run sync:atlas     # copy the latest atlas build into www/atlas
npm test               # node --test tests/ (no device needed)
npx cap sync android   # requires Node >= 22 for the Capacitor CLI
cd android && ./gradlew assembleDebug
```

Environment used for the verified build: `JAVA_HOME=/tmp/jdk21` (Java 21),
`ANDROID_HOME=/tmp/android-sdk` (platform/build-tools 36), Gradle 8.14.3.
Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Security model

- HTTPS only for runtime URLs; plain HTTP is accepted solely for loopback /
  development hosts (`localhost`, `*.localhost`, `127.0.0.0/8`, `[::1]`,
  `10.0.2.2`). URLs with embedded credentials are rejected.
- Cleartext traffic is disabled app-wide
  (`android:usesCleartextTraffic="false"`). A narrow debug exception in
  `android/app/src/main/res/xml/network_security_config.xml` permits cleartext
  only to `localhost` / `127.0.0.1` / `10.0.2.2` so a developer can reach a
  local server; delete that `domain-config` for release builds.
- Only the non-secret runtime URL is persisted (Capacitor Preferences on
  device, localStorage fallback in a dev browser). No tokens, keys, model
  weights, or provider credentials are packaged or stored.
- The remote Director page receives no custom native bridge, shell, file, or
  secret-access API. The stock Capacitor runtime is present with exactly one
  plugin (Preferences). `allowNavigation: ["*"]` is host-only matching in
  Capacitor, so the remote page can load in the WebView; cleartext is still
  blocked at the network layer, and external links that leave the WebView are
  handed to the system browser via standard `ACTION_VIEW` intents.
- WebView content debugging is disabled (`webContentsDebuggingEnabled: false`).
- Back navigation returns from the remote runtime / offline atlas to the
  launcher (standard WebView history); nothing traps the user.
- Cloud/LLM usage happens only on the connected server, requires it to be
  running and authenticated, and can incur provider charges — the launcher
  states this before connecting and never shows fake connected states.

## Secure provider keys (Project mode)

The app-local `SecureProvider` Capacitor plugin
(`SecureProviderPlugin` + `secure/` package) stores and uses OpenAI/Anthropic
API keys:

- **Storage.** Password inputs pass straight to native `setSecret()` and are
  cleared immediately. Native code encrypts the key with AES-256/GCM using a
  non-exportable key in the Android Keystore; only the ciphertext
  (IV ‖ ciphertext ‖ tag, Base64) is written to an app-private
  SharedPreferences file. The store **fails closed**: any keystore/cipher
  error wipes the ciphertext and reports failure — there is no plaintext or
  weaker fallback. `hasSecret`/`deleteSecret` return booleans only; the key
  value is never returned to the WebView, logged, emitted in an event, or
  written to any artifact.
- **Network.** Provider calls run natively (`HttpURLConnection` + a minimal
  built-in JSON codec; no third-party network dependency). The only reachable
  hosts are `https://api.openai.com` and `https://api.anthropic.com` — URLs are
  built from constants, redirects are refused, and there are no automatic
  retries (a retry could double a billed call). Timeouts are fixed (10 s
  connect / 30 s read); `max_tokens` is hard-capped at 4096 and prompts at
  24 000 chars. Model IDs come from live `GET /v1/models` discovery or an ID
  the user types — the app ships no fake model list. Provider error bodies are
  redacted (key shapes, Bearer tokens, the key itself) and truncated before
  they can reach the UI.
- **Device-lock / root limitations.** The Keystore key is *not* bound to the
  lock screen (no `setUserAuthenticationRequired`), so no biometric/PIN prompt
  gates each use. Protection relies on device lock, full-disk encryption, and
  the keystore implementation: on a rooted device or a compromised OS, an
  attacker may be able to use the key or extract decrypted secrets. If you
  lose or wipe the device (or uninstall the app), the Keystore key and all
  stored ciphertexts are destroyed.

## Project mode behavior

- Goal → editable squad (default Director/Research/Build/Review; rename,
  re-brief, disable nodes) → run/pause/resume/cancel with per-node status
  (`pending/running/done/skipped/error`).
- Per-run budgets: max tokens, max minutes, max USD (computed from the user's
  own price rates per 1M input/output tokens; 0 disables a cap). Budgets are
  checked before every node; exceeding one stops the run as
  `budget-exhausted` and keeps everything produced so far.
- Projects, runs, event logs, and text artifacts are non-secret and stored
  locally (Capacitor Preferences on device; localStorage fallback in a dev
  browser). The storage facade rejects secret-shaped field names as defense
  in depth. Partial results are persisted after every node.
- Text only: no code execution, no repository writes, no MCP/tools. Provider
  calls use the saved key via the native plugin and are billed by the
  provider to the key owner.
