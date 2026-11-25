# Managed creative runtime

`headless-runtime/creative-tools.mjs` provides durable, bounded creative jobs for
the headless Linux runtime. Its HTTP/MCP/editor adapters use the same service.
An accepted request is a saved job, not evidence that software executed.

## Configuration and authority

Set `DAFTAR_CREATIVE_CONFIG_FILE` to an owner-authored absolute JSON filename.
The file and credential files must be regular files with mode `0400` or `0600`.
Project roots, inputs, state directories and configured executables reject
symlinked path components. The configuration has this shape:

```json
{
  "schemaVersion": 1,
  "tools": {
    "blender": { "executable": "/opt/daftar-tools/blender/4.5.17/blender" },
    "unreal": { "executable": "/opt/reviewed-unreal/Engine/Binaries/Linux/UnrealEditor-Cmd" },
    "inkscape": { "executable": "/usr/bin/inkscape" },
    "ffmpeg": { "executable": "/usr/bin/ffprobe" }
  },
  "projects": [{
    "id": "product-scenes",
    "companyId": "example-company",
    "departmentId": "design-department",
    "root": "/srv/daftar/reviewed/product-scenes",
    "repository": "example/product-scenes",
    "trusted": true,
    "allowedOperations": ["blender.inspect", "blender.render", "blender.export_glb"]
  }],
  "limits": {
    "maxConcurrentJobs": 1,
    "maxQueuedJobs": 8,
    "maxDurationMs": 120000,
    "maxOutputBytes": 262144,
    "maxArtifactBytes": 33554432,
    "maxInputBytes": 536870912,
    "maxMemoryBytes": 4294967296
  }
}
```

Include only tools actually configured on the host. Local inventory uses a
bounded version probe; a configured executable path alone is not a successful
probe. Inventory never installs software. `ffmpeg` is the catalog identifier for
the fixed **ffprobe** operation, not a general FFmpeg command interface.

The optional `adobe-photoshop` entry uses `enabled`, `allowPaidRequests`,
`clientIdFile`, `clientSecretFile` and `assetStorageFile`; it has no executable
field. Remote operations also require `allowExternalUpload: true` on the specific
project. Inventory checks local prerequisites and reports
`readiness: "configured_unverified"`, `remoteAuthVerified: false`; it does not
send an Adobe request. The official API adapter handles licensed credentials,
reviewed asset transfer, paid-request consent configuration and durable remote
receipts. See `integrations/adobe/` for that adapter's configuration.

An assignment is metadata. Every run additionally requires an explicit current
native `creative.execute` grant covering the employee and project scope. Owner
grants and Donna's recorded delegation parents are checked for scope, capability,
expiry and revocation. Donna keeps her global permanent assistant identity; a
foreign employee or substituted company pointer cannot impersonate her. Company,
employee, office, department and department ancestors must be active. Paused or
retired employees can have existing assignments removed with `toolIds: []`.

Native workers also pass an internal lease-authority callback. The service
rechecks that callback and scope before execution, during execution and before
completion. `prepareWorker(job)` checks the configured tools, assignments,
projects and explicit grants before a provider request is admitted.

## Fixed operations

All inputs contain a project-relative `path` of at most 512 characters. Absolute
paths, traversal, empty segments, backslashes, URL punctuation and controls are
rejected. There are no caller-supplied executable, argument, shell, Python or
output-path fields.

| Operation | Additional input | Output |
| --- | --- | --- |
| `blender.inspect` | None; `.blend` | `inspection.json`, numeric scene inventory |
| `blender.render` | `frame` 0–100000, `width`/`height` 16–2048, `samples` 1–64 | One CPU Cycles frame, `render.png` |
| `blender.export_glb` | None; `.blend` | `scene.glb`, animations disabled |
| `unreal.inspect` | None; `.uproject` | `project.json`; descriptor inspection explicitly reports `engineExecuted: false` |
| `unreal.validate` | None; `.uproject` | Fixed DataValidation commandlet with NullRHI, `validation.json` |
| `inkscape.export_png` | `width`/`height` 16–2048; self-contained `.svg` | `render.png` |
| `ffmpeg.probe` | None; supported local media file | Allowlisted codec/container metadata in `media.json` |
| `adobe.manifest` | None; `.psd` | `manifest.json` and `adobe-receipt.json` |
| `adobe.render` | `format` `png` or `jpeg`, dimensions 16–2048; `.psd`, `.png`, `.jpg`, `.jpeg` | `render.png` or `render.jpg`, plus `adobe-receipt.json` |

Default render settings are frame 1, 1024 × 1024 and 16 samples. Blender starts
with `--background`, `--factory-startup`, `--disable-autoexec` and only the fixed
`blender_worker.py` helper. Scene scripts are not enabled. Inputs must pack image
and font resources, make linked libraries local and remove external media or
caches. Compositing and sequencer output are disabled. Geometry is bounded to
10000 objects and 2000000 mesh vertices. SVG inputs reject scripts, external
references, entities, imports and foreign objects. ffprobe receives a local-file
protocol allowlist and a bounded container/metadata query.

## Receipts and execution limits

Mutations require an `id`. The same ID and canonical JSON body return the same
saved result; a changed body or mutation kind receives HTTP 409. A creative run's
job ID equals its request ID. Assignment and cancellation receipts share this
namespace. State writes use an exclusive controller lock, atomic replacement and
fsync. History is capped at 10000 records per collection and 16 MiB; reaching that
limit stops new mutations instead of evicting replay evidence.

Jobs are `queued`, `running`, `succeeded`, `failed`, `cancelled` or `interrupted`.
Shutdown or restart marks unfinished jobs interrupted and never automatically
replays them. Input identity and tool/project configuration are bound at admission;
changed queued inputs or changed configuration stop execution. An explicit new
request after review needs a new ID. Completed receipts remain inspectable after
grant revocation.

Job projections contain scope identifiers, timestamps, fixed relative output
filenames, SHA-256 hashes, byte sizes, bounded result metadata and safe errors.
Terminal jobs expose `creative://jobs/<job-id>` as a receipt reference. They do
not expose executable paths, project roots, raw process logs or credentials.
Remote failure/restart preserves the hash and size of any Adobe receipt already
written. Local cancellation does not establish that Adobe cancelled a remote job;
an uncertain paid submission must be reviewed before any new request.

The Linux `process_guard.py` launcher uses standard Python 3, a parent-death
signal, CPU/address-space/file-size/file-descriptor limits and `execve` without a
shell. The service also enforces wall time, combined stdout/stderr bounds,
artifact totals and process-group cleanup. Limits permit 1–4 concurrent jobs,
0–32 queued jobs, up to 20 minutes per job, 1 MiB console output, 100 MiB output
artifacts, 1 GiB input and 16 GiB address space per process. SVG and Unreal
descriptors additionally cap input at 8 MiB and 1 MiB. The supplied deployment
must apply aggregate host/container CPU, memory, process, filesystem and network
controls.

These controls are not an OS sandbox for hostile project files or engine plugins.
Unreal projects can run their reviewed native/custom validators. Use a dedicated
unprivileged runtime, read-only installed tools, reviewed project roots and host
isolation. Unreal can maintain its own project caches; the application artifact
quota does not replace a filesystem quota. Large real projects may require an
explicitly larger host and per-process memory budget. No GPU benchmark, licensed
Unreal installation, live Adobe authentication or VPS deployment is implied by
the local fixture tests.

## Verification and official references

Run the real child-process regression suite with:

```bash
node --test headless-runtime/test/creative-tools.test.mjs
cargo test --manifest-path native-core/Cargo.toml creative_
```

For actual engine acceptance, first create the disposable default scene with
`deploy/creative/smoke_blender.py`, then run the complete service path:

```bash
node integrations/creative-tools/smoke-service.mjs \
  --blender /opt/daftar-tools/blender/4.5.17/blender \
  --scene /tmp/creative-smoke/scene.blend \
  --output /tmp/creative-service-evidence
```

The output directory must be new. This preserves three format-checked artifacts
and a seven-check receipt, verifies repeated request identity, and removes its
disposable service state before declaring success. Native scope in this smoke is
an explicit synthetic fixture; native authority tests exercise the Rust boundary
separately. It never connects to an owner workspace or provider.

The suite covers concurrent replay, queue capacity, cross-company and Donna
scope, expired/revoked/delegated grants, changing configuration, input replacement,
mid-process revocation, live worker callbacks, hostile paths and symlinks,
resource limits, cancellation, process-parent death and interrupted restart.

Actual local service acceptance on 2026-11-25 used the official pinned Blender
4.5.17 LTS binary and a disposable three-object fixture. Version probing,
inspection, a 64 × 64 CPU Cycles frame at two samples and GLB export succeeded.
Outputs were respectively 149, 3733 and 1936 bytes, each recorded with a SHA-256
hash. Eighteen internal authority callback checks completed; no model/provider
request or private company workspace was used. This verifies the Blender service
path, not an installed Unreal/Adobe/VPS environment.

Separate disposable service acceptance also verified the locally detected
Inkscape 1.4 and ffprobe 7.1.5 builds. Inkscape produced a format-checked 64 × 64
PNG (977 bytes); ffprobe reported the expected 0.1-second, 48000 Hz mono PCM WAV
and saved 128 bytes of allowlisted metadata. Both produced successful hashed
receipts without provider requests. Unreal and Adobe execution remain fixture
tested until an owner supplies the licensed engine/API and completes a live check.

The separate `smoke-native-runtime.mjs` acceptance closes the native integration
boundary: it creates disposable records through the real Rust core, applies the
company setup helper, starts the actual HTTP runtime and a stdio MCP subprocess,
renders with the native employee's scoped grant, replays across daemon restart,
then revokes the real grant and verifies a fresh render is denied. Its six checks
passed with Blender 4.5.17, a hashed 3737-byte CPU PNG and zero provider calls.
The safe receipt is `project/creative-native-runtime-smoke.json`. Run it with the
same `--blender`, `--scene` and new `--output` arguments as `smoke-service.mjs`;
it additionally requires the built native and portable runtime modules. All native
records and the local Git fixture are removed before reporting success.

Implementation references:

- [Blender command-line options](https://docs.blender.org/manual/en/4.4/advanced/command_line/arguments.html)
- [Unreal Data Validation commandlet and custom validators](https://dev.epicgames.com/documentation/en-us/unreal-engine/data-validation-in-unreal-engine)
- [Inkscape command-line exports](https://wiki.inkscape.org/wiki/index.php/Using_the_Command_Line)
- [ffprobe structured metadata options](https://ffmpeg.org/ffprobe.html)
