# Donna, MoE and ANDOLAN / YUGA creative development

## Candidate identity

This 0.9.1 development candidate reconciles canonical main
`239331a481a727ad48ffb35499a7f6bff12e448a` with the released
`v0.9.0-preview.1` product at
`7766c91c6d6c3481b419623f1149a291d2da439d`, then adds the Donna studio,
reviewed coding MoE profile, explicit Blender device selection and Yuga company
workflow. Main alone was not a sufficient base for an installed-editor update:
the released branch contained the embedded runtime, compute connection and full
canvas features. Those features are retained.

This record describes source and measured local acceptance. It is not evidence
that the owner's computer, live company, Vast account or GPU was modified.

## Delivered behavior

### Donna and desktop

- One conversation and composer remain shared by the endless canvas and dock.
- Brief, Conversation and Creative tools views preserve drafts, scope, provider
  budgets and existing authority. Keyboard tab navigation and reduced motion are
  retained.
- The studio shows scoped saved crew/goals and observed runtime status. Missing
  runtime data remains unavailable; role definitions are not labelled as active
  processes.
- Original Blender artwork, editable scene and portable GLB are included in the
  desktop, hosted renderer and VS Code asset graph. The desktop browser manifest
  explicitly serves these assets with their correct media types.
- The model library explains total/active parameters, quantization, runtime
  context, approximate download size, license and original source links without
  treating these facts as hardware readiness.

### Model and creative runtime

- The reviewed coding model is exactly `qwen3-coder:30b-a3b-q4_K_M`.
  Its short alias is not accepted as the reviewed artifact.
- Daftar enforces an 8,192-token request context limit using a conservative UTF-8
  byte admission bound, wrapper reserve and bounded output allowance. Oversized
  inputs fail before reservation/dispatch; they are not silently truncated.
- The shared model pool retains verified installed digests, company/employee
  assignments, resource-policy enforcement and separate infrastructure costs.
- Blender uses an operator-configured `CPU`, `CUDA` or `OPTIX` device and one
  enumerated GPU index. Requested GPU execution does not silently fall back to CPU.
- GPU execution requires a verified finite cgroup-v2 memory limit no larger than
  the creative job's memory bound. CPU execution retains its process limit.
- Creative receipts retain actual engine, device/backend, device count/index/name
  and measured render duration. Configured device choice is not proof of a usable
  GPU.
- Unreal descriptor inspection and `-NullRHI` data validation remain distinct from
  editor import, rendered frames and interactive streaming.

### VS Code

The 0.9.1 candidate preserves all 14 released commands and adds four scoped
management/creative commands, for 18 commands. It retains the shared canvas,
embedded native runtime, private-runtime connection, persistent tmux entry,
Vast/SSH connection, model resources, design toolchain and activity journal.

Creative development reads real readiness, requests or selects the reviewed
model, and prepares an explicitly reviewed, digest-bound coding job. It rechecks
scope and digest after the review. It does not enable workers. Blender and Unreal
shortcuts use the existing assigned-project creative service and its native
authority checks. Default host policy remains off.

The packaged runtime includes the fixed Blender/process helpers and the Adobe
adapter required by the current source. Donna static assets and runtime payloads
have integrity manifests. See the final
[VS Code package receipt](../vscode-extension/VALIDATION_0.9.1.md) for its exact
archive size, digest and installed-editor limitations.

## ANDOLAN / YUGA source and company setup

The inspected active source is `occult-kranti/ANDOLAN`, branch
`game/yuga-hanuman-trial`, baseline
`9e59880f31452ce0df8d326cd4f1291b700dc228`. It uses Rust/WASM authority and
PlayCanvas rendering, retains a Godot comparison, and has Blender map tooling.
Unreal is an additional experiment; no pre-existing Unreal project was observed.

The additive [company kit](../projects/andolan-yuga-development/README.md)
binds ten reviewed responsibilities and seven development gates. It resolves the
exact repository-bound company, reuses bootstrap specialists, preserves owner
renames and paused staff, and rejects foreign or ambiguous company identity.
Its actual native setup tests use disposable synthetic state. No live owner
workspace was initialized or reconstructed. Returned model selections remain
pending until a connected runtime verifies the installed digest.

The separate ANDOLAN branch adds nine explicit editor process tasks and an
original [Route Lab](../projects/andolan-yuga-development/map-blockout/README.md).
The lab is a 48 × 56 m scale prototype with ten spawn markers, three route
corridors, cover and a central objective. It preserves the four authored maps.
It does not provide engine collision, navigation or authoritative gameplay merely
by being present in the repository.

## Actual verification

| Gate | Observed result |
| --- | --- |
| Desktop TypeScript and renderer build | Passed |
| Desktop unit/DOM suites | 694 tests passed across 44 files |
| Renderer interaction runner | 361 pure-DOM checks; no provider or network calls |
| Merged headless, MCP and deployment JS suites | 260 passed, zero failed; three real-tmux checks skipped because the required executable/session was unavailable in that run |
| Focused lifecycle failure checks | Six passed; every constructed service receives cleanup, including after failures |
| Workbench suite | 13 passed, including actual async `createRuntime` worker controls and durable replay |
| VS Code packaging gate | 197 passed, zero skipped, including packaged native runtime start/authenticated command/shutdown |
| ANDOLAN company kit | Six tests passed against the actual merged native helper; disposable state only |
| New ANDOLAN package checks | Five passed, including negative corruption/scale/spawn/path cases |
| Existing ANDOLAN map balance tests | Two passed; authored route/balance audits also passed |
| Native HTTP contention | 128 test employees added, 425 HTTP requests, 64 duplicate deliveries; all ten invariants passed; zero provider calls |
| Donna browser review | Both visual themes, tabs, draft preservation, single composer and unavailable-runtime state reviewed in the isolated hosted preview |

The stress result is a bounded functional test on this host. It is not production
capacity sizing or a multi-hour soak. Its fixture adds no real employees to the
owner's workspace. The native helper used by company and runtime acceptance has
SHA-256 `8e67644f9deede39cbc87f8a704e52731deac9afe52245b2ca6eca65c98239e8`.

### Actual Blender evidence

The original Donna scene was created and rendered with Blender 4.3.2 on CPU.
The fixed creative service subsequently inspected its 26 objects / 21 meshes and
produced an actual 128 × 128, four-sample CPU PNG. Its receipt recorded 0.432828 s
render duration and 2.074271 s job wall time. A requested OPTIX run failed at
`GPU_MEMORY_PREREQUISITE` before Blender started, with no output artifact or CPU
fallback. This does not prove GPU discovery or performance. The
[portable acceptance runner and evidence](../projects/donna-creative-studio/acceptance/README.md)
are retained.

The Route Lab preview completed all 64 Cycles CPU samples at 1024 × 832 in
45.613703 s. Reopening the blend and reimporting the GLB verified 73 mesh objects,
11,602 position samples, all ten spawn locations and the 48 × 56 m extent. Its
GLB SHA-256 is
`3f73be3a96600498387288489e4d5a222900c110b116c94f4686a543cc4691d4`.

## Merge corrections

The integration retains main's classification of uncertain native failures and
same-command-id guidance. Runtime status and observed worker controls are now
awaited where the released activity wrapper makes them asynchronous. A regression
test reproduced the prior undefined-worker receipt before verifying its fix.
Startup/shutdown attempts every service cleanup even if one adapter fails.

MCP exposes the combined 40 tools. Its reviewed model filter and storage ceiling
now admit the exact coding MoE while retaining per-model limits. Its creative
projection preserves observed GPU device metadata instead of discarding it.

## Remaining acceptance

1. Connect the intended owner runtime and apply the reviewed company kit there.
2. Verify an actual Vast offer, allocated CPU/RAM/disk, GPU, driver, graphics/video
   stack, networking and rental budget. No instance was rented or started here.
3. Install the exact reviewed model, verify its digest and measure a bounded coding
   task, memory use, time to first token and output quality on the selected GPU.
4. Run a creative render on that same intended execution host. Creative adapters
   invoke local binaries; forwarding Ollama alone is not remote render dispatch.
5. Import the exact asset into a separately installed Unreal project, verify units,
   collisions and navigation, and capture a real rendered frame and gameplay test.
6. Complete visual installed-editor and persistent-tmux acceptance on a host that
   permits the required display/Unix sockets. This environment's isolated CLI can
   install the VSIX; that does not certify GUI activation.

The [Unreal handoff](../projects/donna-creative-studio/unreal/README.md) has source
validation and a pinned GLB, but no Unreal engine was executed during this work.
Linux package evidence does not certify a Windows or macOS package.
