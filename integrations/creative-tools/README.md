# Connect a creative team to an existing VPS

The installer, native employee setup, job service, AI worker, MCP adapter and VS Code client share one workflow. Start with [host installation](../../deploy/creative/README.md), then bind an **existing company** to its reviewed local Git checkout. [The runtime contract](RUNTIME_CONTRACT.md) defines supported operations, authority and resource limits.

## Persistent departments and roles

Setup uses the existing additive company-kit importer. It preserves company identity, Donna, permanent scope assistants, existing employees, budgets, jobs, schedules and owner changes.

| Department | Added specialist definitions | Intended work |
| --- | --- | --- |
| Graphics production | Graphics production lead; Blender technical artist; Asset interoperability engineer | Scene inspection, bounded CPU renders, GLB export, SVG rasterization and authorized format interchange |
| Game engineering | Unreal gameplay engineer | Review a licensed Unreal project and run fixed DataValidation; inspect related assets |
| Creative QA | Creative QA engineer | Inspect media/project metadata, validate engine content and retain delivery evidence |

The native core also supplies each new department's permanent assistant. The five specialist definitions remain saved after a process restart. They do not start five paid agents.

Each specialist receives department-scoped `creative.execute` and `provider.run` grants on first setup, with a default **24-hour** lifetime (`--grant-hours 1..168`). Existing creative grants are retained, including expired or revoked grants. Setup never renews them implicitly. Native job approval, provider credentials, budgets and worker enablement remain separate existing controls.

## Prepare the actual host

Build the Rust core and portable runtime using [the base VPS guide](../../deploy/README.md). Install the chosen tools using [the creative installer](../../deploy/creative/README.md). Restore or initialize the intended native workspace first. A cloud-only queued company must first be accepted by the native owner runtime; this command will not create a substitute company ID.

Use a reviewed existing Git checkout owned by the runtime user, with an `origin` identifying the same GitHub repository as the company. A company without a repository can receive an explicit project-level repository binding; a conflicting company repository is rejected. The Git check does not contact GitHub, execute a hook, clone, fetch or push.

For the documented systemd layout, run from the repository root:

```bash
sudo systemctl stop daftar-runtime
sudo install -d -o daftar -g daftar -m 0700 /etc/daftar/creative
sudo install -o daftar -g daftar -m 0600 \
  integrations/creative-tools/config.example.json /etc/daftar/creative/tools.json
sudoedit /etc/daftar/creative/tools.json
```

The separate directory lets the offline runtime user atomically replace its config during setup. The running systemd service's `ProtectSystem=strict` keeps `/etc` read-only. Keep credential files in the separate secret directory. Do not replace an existing reviewed config with the example on a rerun.

Replace `OWNER_VERSION` with the imported engine version and verify the executable path. If Unreal is deferred, its missing executable stays unavailable while definitions and project bindings can be prepared. The example's empty `projects` array is filled with real native department IDs. Configured paths must have no symlink components.

Set this entry in `/etc/daftar/runtime.env` to match the config below:

```dotenv
DAFTAR_CREATIVE_CONFIG_FILE=/etc/daftar/creative/tools.json
```

The user data path is `DAFTAR_DATA_DIR` (normally `/var/lib/daftar`), **not** its `company` subdirectory. Replace the example identifiers and path in both invocations with actual reviewed values:

```bash
sudo -u daftar node /opt/daftar/integrations/creative-tools/setup-company.mjs \
  --user-data-path /var/lib/daftar \
  --company-id EXISTING_COMPANY_ID \
  --project-root /var/lib/daftar-creative/projects/REVIEWED_REPOSITORY \
  --repository OWNER/REPOSITORY \
  --config /etc/daftar/creative/tools.json

sudo -u daftar node /opt/daftar/integrations/creative-tools/setup-company.mjs \
  --user-data-path /var/lib/daftar \
  --company-id EXISTING_COMPANY_ID \
  --project-root /var/lib/daftar-creative/projects/REVIEWED_REPOSITORY \
  --repository OWNER/REPOSITORY \
  --config /etc/daftar/creative/tools.json \
  --apply

sudo systemctl start daftar-runtime
```

Preview reads initialized state/config without writing, probing tools or calling the native core. Apply holds the runtime's exclusive creative registry lock; a running runtime blocks setup before employee mutation. Native mutations retain additive identity bindings, and configuration publication is atomic. After an interruption, inspect the error and current state, then rerun the same setup. It reuses saved identities and grants, retains existing tool assignments including removals, and does not replay a tool job. A changed project binding or fired bound employee requires explicit review.

Three project bindings can point to the same checkout while retaining department operations and grants. Later configuration changes, enabled tools, grant renewals and role edits use the existing owner controls. Setup is not an overwrite/reset operation.

## Control from VS Code and MCP

Open a private SSH forward from your computer to the active host:

```bash
ssh -N -L 8788:127.0.0.1:8788 VPS_USER@VPS_HOST
```

Run the extension's **Connect to Headless Runtime** command, enter `http://127.0.0.1:8788`, and enter the owner control token in its masked prompt. The token is stored in VS Code SecretStorage. One runtime connection becomes the active backend and uses the real native company projection and expected-state command receipts. HTTPS is also supported for a properly configured private endpoint.

Run **Creative Tools** to discover adapters, choose company/employee/project, assign or remove tools, submit one fixed operation, inspect its receipt or cancel it. Inventory distinguishes missing executables, verified local versions and unverified Adobe configuration.

The [private runtime MCP adapter](../../tools/DAFTAR_RUNTIME_MCP.md) exposes `creative_inventory`, `creative_assign`, `creative_run`, `creative_job` and `creative_cancel`, bringing the adapter to **14 tools**. Mutation IDs are durable: reuse the same ID and body after an uncertain acknowledgement; inspect a saved job before starting a distinct request.

## AI-driven creative jobs

An approved native job can include `creative.execute` in `allowedTools`. Before a provider is called, the worker requires current scoped authority, a ready adapter and an assigned project. The model receives bounded metadata and returns only:

```json
{"projectId":"ACTUAL_PROJECT_ID","operation":"blender.render","input":{"path":"assets/scene.blend","width":1024,"height":1024,"samples":16}}
```

The host attaches company, employee and a stable native-job-derived request ID. It validates project/operation against the current native job scope, rechecks leased worker authority during execution, and accepts only a matching successful `creative://jobs/...` receipt. A retry cannot create another side effect with a model-chosen identity. One provider job cannot combine GitHub publication and creative execution; use a separate reviewed publication job for finished outputs.

Local operations use fixed arguments/helpers. Blender disables file auto-execution and uses bounded CPU rendering. Unreal plugins can execute trusted engine code, so configure only reviewed repositories. Account separation, process limits and container/systemd controls do not make hostile project code safe.

## Adobe and interoperability

[The optional Photoshop adapter](../adobe/README.md) supports PSD manifest inspection and bounded PNG/JPEG rendering through Adobe's official API v2. Prepare licensed credentials and the existing private asset store before enabling it. Initial setup only includes these operations when `--allow-adobe-upload` is supplied and `adobe-photoshop` is configured. Enabling Adobe later requires explicit review of project operations and assignments; setup does not silently widen them.

Krita, GIMP and Inkscape provide local editing and documented format interchange. The Asset interoperability engineer uses existing authorized reverse-engineering guidance; there is no license bypass or arbitrary remote script runner.

## Verification and host acceptance

Run `node --test headless-runtime/test/creative-setup.test.mjs` after the native build. Tests use real native state to check preview, idempotence, repository identity, hook isolation, runtime locking, paused/retired staff, revoked grants, removed assignments and owner-edited config.

This change was exercised with real official Blender CPU rendering/export and disposable native employees. The chosen VPS must pass its own inventory and bounded job; Unreal needs its licensed engine and Adobe its entitled account. [The validation record](../../project/CREATIVE_VPS_VALIDATION_2026-11-24.md) records exact evidence and remaining acceptance.
