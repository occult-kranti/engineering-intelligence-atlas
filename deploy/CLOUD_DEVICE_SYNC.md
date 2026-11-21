# Connect a VPS runtime to the existing Daftar website

The headless runtime can now act as an **explicitly paired device writer** for the existing Sites/D1 website. The opt-in adapter reuses `CloudSyncService`: it transfers the office/chat projection, imports supported saved website conversations, consumes queued native commands, and publishes a revision-checked snapshot. The native Rust core remains the execution and budget authority. Starting synchronization leaves the runtime's workers paused.

This connection is off by default. It does not deploy the website, create a login/device, invent a company principal, copy a remote snapshot over a local workspace, or resolve a competing writer automatically. Create the pairing on the signed-in owner website first. The current website calls its execution-capable device kind **Daftar desktop**; a VPS can use a real pairing of that kind with a clear device name such as “Daftar VPS”. Its authenticated `clientId` must match the website session. No new device kind or identity is fabricated by the adapter.

## Migrate an existing workspace deliberately

1. Pause old desktop worker dispatch and wait for active jobs to settle or enter explicit review. Keep an independent private backup. Prefer upgrading the original writer to the same application version and completing its final explicit cloud sync before transferring ownership.
2. Export the idle private workspace with the repository's existing `scripts/export-personal-workspace.py`, including managed artifacts. Restore it with `scripts/restore-personal-workspace.py` into a **separate** server data directory. The native state file is `company/company-state.json` under user data. Use the scripts' `--help` for the selected source/destination paths; do not replace an active server state directory.
3. Read the restored local office before enabling sync. Compare company/job counts and the cloud projection hash against the last saved website snapshot. Artifact path relocation is excluded from the sync hash. Reconnect provider secrets separately; the private export does not include them. Preserve any model-pool registry separately if migrating its assignments.
4. On the owner website, revoke the old execution device and use the existing **Release writer assignment** operation with the current website revision. The website only releases a writer after its previous device is revoked or expired. Keep the old runtime stopped; do not run two writers.
5. Create a fresh **Daftar desktop** device pairing named for the VPS and store its complete pairing JSON privately on that server. Configure the adapter below and inspect its result while workers remain paused.

On a populated website, first sync requires a matching restored local projection even if someone reuses the same old device pairing. Another active writer, an unexpected revision, or a different populated cloud seed is a conflict. The adapter keeps those protections and never substitutes a blank local office. A genuinely empty website can receive the deliberately configured local workspace under the existing protocol. A small encrypted first-base proof preserves native receipt replay if the first matching sync commits a queued command but loses its acknowledgment; it is removed after successful sync.

These are operator migration steps. This implementation has not migrated a user's live workspace or changed a website's writer assignment.

### Explicit compatibility step for an unchanged 0.6.1 restore

An older website snapshot may omit `parentCompanyId` on companies and `parentDepartmentId` on departments. Native 0.7 materializes their defaults as `null`. **Missing fields and explicit nulls are not hash-equivalent.** The default first-sync guard intentionally rejects that mismatch instead of assuming it is harmless.

After restoring the **original unchanged workspace**, reviewing/cancelling or applying the website's queued commands deliberately, and revoking/releasing its old writer, the operator can temporarily enable:

```dotenv
DAFTAR_CLOUD_ALLOW_KNOWN_SCHEMA_DEFAULTS=1
```

The special first-pairing path accepts only those two absent fields becoming `null` on the exact same record IDs. It compares the rest of the complete projected snapshot, including content, status, jobs and usage. A nonnull parent change, new/missing company or department, reordered records, different conversation, or any other data edit still fails. An assigned writer—even this same device ID—or a nonempty remote command queue also fails. The queue is checked before writer claim and again before publication; a command arriving during those checks remains pending and prevents this migration pass from publishing. A command enqueued after the final check is still protected by the revision protocol and cannot execute as part of the migration pass.

This pass publishes only the reviewed null defaults. It executes no queued command and imports no conversation; normal synchronization can resume afterward. Once its new revision is visible, set the flag back to `0` and restart. **Apply a company/subdepartment hierarchy plan only after this unchanged-state pairing and compatibility pass succeed.** An already-edited working copy must first be reconciled deliberately with the website; this flag cannot approve its edits. Do not delete cloud state, strip parent fields, discard queued work, or alter local sync metadata to bypass the comparison.

If a connection is interrupted after claiming a released writer but before a confirmed migration upload, inspect both snapshots and the writer record. The adapter does not force another claim or weaken the comparison. An unresolved mismatch may require the owner to revoke/release that incomplete device and create a fresh pairing after reviewing the queue. The remote snapshot and pending actions remain preserved.

## Prepare the pairing and encryption key

From the checkout on the intended Docker host:

```bash
sudo python3 deploy/manage-secrets.py set cloud-pairing
sudo python3 deploy/manage-secrets.py init-cloud-key
```

The first command accepts the already-issued pairing through a hidden terminal prompt, compacts its JSON and saves it as `deploy/secrets/cloud-pairing`. The second generates **32 cryptographically random bytes**, encoded as 64 hexadecimal characters, in `deploy/secrets/cloud-encryption-key`. Neither command prints a credential, contacts a server, or creates a website pairing. Files are mode 0400, directory 0700, owned by the runtime's UID/GID 10001. Existing files require explicit `--replace` for intentional rotation. Directly managed secret files may also use mode 0600; symbolic links are rejected.

The adapter encrypts its persisted `cloud/device.bin` with AES-256-GCM, a fresh 96-bit nonce, and an authenticated origin/version label. The backend identifies itself as `aes-256-gcm-file-key`; it does not pretend that a Linux server has an unlocked Electron OS keychain. The 256-bit key and source pairing **must remain outside `DAFTAR_DATA_DIR`**, so a state-volume backup does not automatically contain the means to decrypt it. Keep their recovery copies in a separate protected secret store. Loss of the key requires deliberate reconfiguration using a valid owner-issued pairing; backup encryption does not replace host access controls.

For systemd, use `--directory /etc/daftar/secrets` and the existing `daftar` account's UID/GID with the same helper. Do not put secret values in environment variables, command arguments, Git, browser JavaScript, or `.env` files.

## Configure and start

Set only nonsecret values and secret **paths** in `deploy/.env`:

```dotenv
DAFTAR_CLOUD_SYNC=1
DAFTAR_CLOUD_URL=https://YOUR-EXISTING-WORKSPACE-ORIGIN
DAFTAR_CLOUD_PAIRING_FILE=/run/secrets/cloud-pairing
DAFTAR_CLOUD_ENCRYPTION_KEY_FILE=/run/secrets/cloud-encryption-key
DAFTAR_CLOUD_SYNC_INTERVAL_SECONDS=60
DAFTAR_CLOUD_ALLOW_KNOWN_SCHEMA_DEFAULTS=0
```

Replace the URL placeholder with the exact existing workspace origin. It must use HTTPS outside loopback, with no credentials, path, query or fragment. A pairing's bound origin must agree. The interval accepts integer values from 60 to 3600 seconds; there is no rapid polling mode. Compose already mounts the protected secret directory read-only.

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T runtime node /app/deploy/runtime-request.mjs status
```

If using the optional Ollama profiles, include the same overlay files in these lifecycle commands. For the native/systemd installation, put the same settings in `/etc/daftar/runtime.env`, use `/etc/daftar/secrets/...` file paths, then restart `daftar-runtime`.

Enabling the flag explicitly authorizes initial synchronization on service start, followed by a nonoverlapping interval after each completed pass. Status is available through `GET /v1/status` and MCP `runtime_status`:

```json
{
  "cloud": {
    "configured": true,
    "connected": true,
    "revision": 12,
    "error": null
  }
}
```

The revision above is illustrative. The actual status exposes only configured/connected flags, revision, and a generic error; it contains no pairing token, source URL, secret path or device identity. A healthy HTTP process is not proof of a successful cloud sync. Check the cloud revision and website state before intentionally enabling the native workers through the existing owner controls.

The pairing can expire or be revoked. Failed authentication disconnects sync without erasing local work. Rotate a pairing or encryption key deliberately, then restart. To disable the integration, set `DAFTAR_CLOUD_SYNC=0` and recreate/restart the service. Previously encrypted state remains available for recovery; disabling does not revoke the website device automatically.

## Queue, conflict, and shutdown behavior

Queued website actions enter the native `apply_remote_command` receipt transaction. A lost cloud acknowledgment leaves the queue item pending; a later pass reuses its native receipt so its effect is not duplicated. Commands against stale local/remote state become conflicts under the existing protocol. An ambiguous native process outcome remains queued for review. Authentication failure and a competing writer stop synchronization without silently switching owners.

A restored device's saved revision must agree with the fetched website revision. Reusing the same device ID does not authorize replacing newer cloud work with an older backup, or overwriting a rolled-back website. A revision mismatch stops **before** writer claims, native commands or queue acknowledgments. The sole normal retry exception is the same authenticated writer whose fetched cloud projection exactly equals the current local projection: this recovers a completed snapshot PUT whose response was lost. A differing snapshot requires deliberate restore/reconciliation; do not edit `connection.json` to clear the conflict.

On the first sync, the shared desktop protocol also rejects a different populated snapshot even when the pairing reuses its writer ID. Headless recovery has an additional internal proof: an encrypted first-sync base bound to the current device credential, exact remote revision and exact remote projection hash. That proof permits native receipt replay after an interrupted first command; it never exempts an established revision mismatch. The ordinary desktop has no headless proof. If its very first queued command commits but its acknowledgment is interrupted before any snapshot revision is saved, a subsequent mismatch stops for explicit recovery review while preserving the local receipt, both snapshots and the pending command. Established desktop syncs continue to recover lost command acknowledgments automatically at the unchanged revision.

Shutdown stops scheduling, aborts outstanding HTTP transport and awaits the active synchronization pass before destroying the in-memory encryption key. A native operation already committed before shutdown keeps its receipt even if its acknowledgment was interrupted. Revoking a device does not rewind an operation that already completed.

The default state snapshot includes full supported chats and enforces the existing 8 MiB projection limit. It omits live lease tokens and local artifact paths; artifact bodies stay in private runtime storage. The model-pool registry and model bytes are not part of this office projection. Model downloads and assignments remain available through their owner HTTP/MCP controls, while the Sites website receives the existing office command and snapshot protocol. This adapter is not a public OAuth MCP server or a generic remote desktop channel.

## Verification

```bash
node desktop-shell/node_modules/typescript/bin/tsc -p headless-runtime/tsconfig.json
node --test headless-runtime/test/cloud-sync.test.mjs
```

The tests use the real native core and a loopback fake website. They verify authenticated device pairing, encryption and origin/ciphertext tamper rejection, protected key files, native command receipt replay after a lost acknowledgment, same-device cold-start mismatch, older local metadata against newer or rolled-back same-writer snapshots without any queue acknowledgment, exact-state lost PUT response recovery across restart, bootstrap proof revision/hash binding, strict null-default compatibility with an empty queue/released writer, rejection of real hierarchy/content/usage changes, another writer, revoked access, shutdown drain, and paused worker startup. They make no live website pairing, external model request, infrastructure rental or user-workspace migration.

Implementation references: [headless supervisor](../headless-runtime/cloud-sync.mjs), [existing sync protocol](../desktop-shell/src/main/cloudSync.ts), [website writer/device enforcement](../cloud-workspace/lib/atlas-api.ts), and [native integration tests](../headless-runtime/test/cloud-sync.test.mjs).
