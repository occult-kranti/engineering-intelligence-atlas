# Security Model — Research Director Desktop

This document describes how the desktop shell handles your API credentials and
what remains **your responsibility**. Read it before saving keys.

## How keys are stored

- Keys you paste into **Local Projects → API keys** travel once, over local
  Electron IPC, from the password field to the main process. The field is
  cleared immediately after the call.
- The main process encrypts the key with Electron's `safeStorage`, which uses
  your **operating system's keychain**:
  - **Windows:** DPAPI (bound to your Windows user account)
  - **macOS:** Keychain
  - **Linux:** libsecret / GNOME Keyring or KWallet
- Only the **encrypted blob** is written to disk, under
  `userData/vault/<provider>.bin` (file mode `0600`). The plaintext key is
  never written anywhere: not to settings, not to logs, not to the job or
  project event logs, not into artifacts, and not into the packaged app.
- The shell's APIs expose only **metadata**: whether a key is configured,
  whether the stored blob is still decryptable, and when it was saved.
  There is intentionally **no API that returns a key, or even its last 4
  characters**, to any renderer page.
- Decryption happens in the main process, per provider call, only when you
  start a run or refresh a model list. Keys are sent only to the provider they
  belong to (`api.openai.com` / `api.anthropic.com`), over TLS. Provider error
  messages are sanitized to strip key material before they are shown or logged.
- **Revoke** deletes the encrypted blob. It does not deactivate the key at the
  provider — do that in the provider's dashboard.

## Fail-closed behavior

If the OS reports that secure encryption is unavailable (typical on Linux when
no keyring is installed or the keyring is locked), the shell **refuses to save
keys at all** and reports the vault as unavailable. It will never fall back to
plaintext or "obfuscated" storage.

If a stored blob cannot be decrypted (tampered with, or the OS keychain
changed), it is treated as unusable: runs fail with a clear error and the UI
shows the credential as "stored but unreadable". Re-enter the key to recover.

## Threat model: what this does NOT protect against

`safeStorage` protects keys against **offline** theft of the files (disk
image, stolen laptop that is powered off or locked). It does **not** protect
against an attacker who can act as your logged-in user while the device is
unlocked:

- **Rooted / jailbroken devices:** on a rooted device an attacker can typically
  ask the OS keystore to decrypt anything it protects, or read the main
  process's memory while a key is decrypted for a call. Do not store
  high-value keys on rooted devices.
- **Unlocked, unattended sessions:** any process running as your user can call
  the same OS keychain APIs this app uses. Lock your screen; do not leave an
  unlocked session accessible to people or software you do not trust.
- **Malware on your machine:** infostealers specifically target OS keychains
  and app data directories. The vault raises the bar (keys are not plaintext
  at rest) but cannot defeat a compromised OS.
- **Screen sharing / remote desktop:** the UI never displays stored keys, but
  anything you paste into a field can be observed while you paste it.

## Your responsibilities

1. Keep your OS updated and your user account protected by a strong password.
2. Keep your screen locked when away; avoid rooted/jailbroken machines for
   key storage.
3. Use provider keys with the smallest useful permissions and set **usage
   limits / budgets in the provider dashboard** as a second layer of defense
   (the in-app token/minute/USD budgets are hard stops for shell runs, but a
   leaked key is not bounded by them).
4. If you lose the device or suspect compromise: revoke the keys in the
   OpenAI/Anthropic consoles, then revoke them locally in the app.
5. Treat artifacts and project files (under `userData/projects/`) as sensitive:
   they contain your prompts and the model outputs. They are never uploaded by
   the shell, but they are stored unencrypted.

## Local runtimes (Ollama)

The shell only talks to Ollama at `http://127.0.0.1:11434` (loopback). It
refuses remote Ollama hosts, never installs or starts Ollama, and never pulls
models. Models you use via Ollama execute under the Ollama server you run —
its security posture is yours to manage.

## Renderer / IPC isolation

- The bridge is exposed only to the local `file://` chrome page; remote pages
  (online runtime) run in a separate view with **no preload**.
- Every IPC handler re-validates that the sender is exactly the shell window's
  webContents on a `file://` top-level frame, and re-validates all inputs.
- `contextIsolation`, `sandbox`, `webSecurity` are on everywhere; there is no
  TLS certificate bypass anywhere in the codebase.
