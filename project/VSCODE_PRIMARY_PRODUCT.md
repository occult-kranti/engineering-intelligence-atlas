# Daftar 0.9 — primary VS Code workspace

The VS Code extension now owns the full desktop office canvas and can launch its portable backend without Electron as a desktop application. Companies, departments, staff, blueprints, Donna, projects, models and management forms use the same compiled renderer and native core. The activity-bar view is an entry point; it opens the office in a full editor tab.

## Current blueprint design branch

The later `design/infinite-blueprint-canvas` source removes the physical table presentation and uses one continuous blueprint plane. Canonical company floorplans, flat employee circles, optional 3D partitions and live popups use the same packaged renderer. The [three-round design/build plan](../design/endless-blueprint/PLAN.md) and [verification record](../design/endless-blueprint/VALIDATION.md) describe this newer source. The published preview and its receipts below remain tied to their original commit.

The subsequent [board workflow plan](../design/board-workflows/PLAN.md) adds Whiteboard multi-links, the Greenboard people/ownership view, duration forecasts and native primary/helper review gates. Its [validation record](../design/board-workflows/VALIDATION.md) identifies the exact tested source, platform packages, browser receipts and remaining boundaries. These changes require the matching schema2 native core; the older `v0.9.0-preview.1` packages do not contain them. Use the matching platform artifact from that validation record when continuing this branch in VS Code.

## Choose where the workspace runs

| Entry | Runtime location | Editor closes | Prerequisites |
| --- | --- | --- | --- |
| Start Workspace on This Host | Current extension host | Owned backend shuts down cleanly | Matching platform VSIX; Node 22+ bundled with the editor or `atlas.nodePath` |
| Start Persistent Workspace in tmux | Current Linux extension host | Editor detaches; daemon continues | Linux, tmux, private application data, available runtime port |
| Connect Private Runtime | Existing private runtime | Runtime remains independent | HTTPS or loopback URL and owner control token |
| Connect Vast.ai / SSH Compute | Existing owner instance through SSH forwarding | Editor closes its own tunnel | Running instance/runtime, existing key or agent, verified known_hosts |
| Connect Desktop / Website | Existing compatible desktop or private website | Existing service lifecycle | Fresh pairing credential |

The extension prefers `workspace` execution. In a Remote-SSH window its backend runs on the remote host. It does not infer remote access from an unrelated terminal, move ChatGPT onto the GPU, or claim GPU readiness from an SSH banner. A stopped Vast instance is saved as stopped and is not started, rented, destroyed or billed by the connection flow. Account listing does not alter instance lifecycle.

`atlas.hostControlEnabled` permits exposing host-control capabilities when the extension starts a Linux backend. The initial policy is **off**. Turning the policy to manual or auto is an owner action in the compute controls. This setting does not modify VS Code, ChatGPT, operating-system or platform approval settings.

## Resume the existing Vast instance

The user explicitly stopped the instance after successfully connecting from their laptop. Leave it stopped while reviewing/installing the extension.

When compute is wanted:

1. Resume that existing instance in Vast and verify its current connection details.
2. Connect VS Code using the already working Remote-SSH host, then open `/workspace` or the intended checked-out project. Install the Linux VSIX into the SSH extension host.
3. Run **Daftar: Start Persistent Workspace in tmux** for a service that survives closing the editor. Use **Start Workspace on This Host** for an editor-owned session instead.
4. Open **Daftar: Donna Compute and Ownership**. Complete the workload intake and inspect actual system/GPU information.
5. Select the company, reuse or hire its Cloud Compute Operator, and assign host-control grants. Manual mode queues host jobs for approval; auto mode dispatches admitted jobs within the recorded limits.
6. Prepare the company's maintained Python environment, inspect its readiness proof, and register/share installed model resources before assigning work.
7. Copy the runtime MCP configuration if another supported client should control the same service.

The explicit SSH profile workflow uses `ssh -N -T`, strict host-key checking, loopback-only forwarding, keepalive and bounded authenticated readiness. Keys are referenced by an existing file path or agent; private key bytes are not collected. A failed readiness check never causes another SSH process or rental to be started automatically.

## Donna, employees and ownership

**Cloud Compute Operator** is a permanent native employee role. Hiring reuses an active matching employee where possible. Its charter references the existing Agent Research Director and Local Model Runtime Engineering skills. Requirements capture is deterministic and saves a company conversation brief; it does not spend model tokens merely to fill a form or inspect hardware.

Host jobs are attributed to a canonical active company and employee. Company assistants and shared employees must still satisfy current scope and native service-contract checks. The host-control policy is a complete revision-checked set of explicit grants. Jobs have stable IDs, bounded timeout/output, durable receipts and inspection/cancellation operations. Lost acknowledgements are not retried automatically. `stopAll` disables managed host dispatch and requests cancellation of managed jobs; it does not kill unrelated processes or roll back completed external changes.

An owner credential controls a trusted operating-system account. An auto grant can authorize arbitrary commands as that account. This is not independent tenant authentication or a hostile-root sandbox; root inside a rented container is also not ownership of Vast's underlying physical host. Model sharing policies govern managed application paths, while explicitly granted host administration remains broad OS authority.

## Operations control and permanent roles

The current source adds an explicit **God mode — owner host control** preset,
connector-readiness stages, activity metadata and native hiring/reuse of
**Runtime Observer**, **Knowledge Steward** and **Connector Steward**. Permanent
role definitions do not create execution authority or recurring provider work.
God mode atomically checks the policy revision and exact current active company
set before granting company-wide auto host control. Future companies need an
explicit refresh. Enabling the preset starts no job or instance, changes no
budget and bypasses no platform approval setting. Off prevents new dispatch;
Stop managed host work requests cancellation of existing managed jobs.

Worker idle/error polling backs off by default at 15/30/60/120 seconds; a direct
one-shot remains immediate. The rolling private activity journal is bounded to
1,000 events/1 MiB, with deterministic summaries and a 64-entry cache invalidated
by new events. The native job/authority/budget ledger remains authoritative.
Readiness reports do not prove a successful GPU workload. See the
[operations control guide](OPERATIONS_CONTROL.md) for the control-flow diagram,
staged setup, provenance, cleanup and degraded-logging behavior. Installed
Linux/Windows acceptance and the shared-canvas browser gate passed at `7766c91`;
[product CI](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44974716262)
preserves exact results. Both platform VSIXs, verification evidence and checksums
are publicly available in the
[v0.9.0-preview.1 prerelease](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.9.0-preview.1).
All four assets were independently downloaded without authentication and hashed;
the [publication receipt](release-0.9.0-preview.1.json) records matching local/API
digests and the tag's exact verified source.
The [preview notes](RELEASE_0_9_PREVIEW.md) describe the matching package, and
[product validation](VSCODE_PRODUCT_VALIDATION.md) retains the exact evidence.
These controls do not establish a real Vast workload, application installation or
ChatGPT connection.

## Model ownership and sharing

The resource registry provides company, office, department and employee ownership, exact installed model digests, explicit sharing permissions, and immutable plan/run receipts. Company hierarchy and department hierarchy are native. Office parent grouping is a resource-view sidecar; the application does not claim native suboffice execution semantics.

The first explicit resource configuration enables enforcement. From that point:

- Model assignment and worker dispatch validate current grants, current native membership/service contracts, and the installed digest.
- The older HTTP model endpoints, workbench methods and stdio MCP paths use the same gate.
- Legacy unscoped Ollama projects cannot start/resume, and an already active project rechecks before another generation. Use a scoped resource workflow instead.
- Owner-directed downloads can stage reviewed weights before registration. Staging bytes does not create assignment or execution authority.
- Descendant grants capture membership. Adding or reparenting a company/department does not silently enlarge a grant; deliberate membership revision is required. Revoked membership loses access.
- An uncertain first policy write fences the enforcement check. Failure cannot silently revert to an unrestricted initial policy.

The current reviewed local model pool supports its pinned catalog and one loopback Ollama service. Sharing reuses that host's installed cache. It does not transfer weights automatically between unrelated VPSs.

Expert workflows support one to four experts, optional synthesis, explicit employee/resource provenance, token/time/parallel bounds and native job dependencies. They enqueue actual native jobs and retain artifact receipts. **These are request-routing or ensemble workflows, not newly trained MoE weights.** New MoE training needs a separate architecture/data/evaluation implementation and an observed compute budget.

## Maintained environments and design software

Managed Python jobs create private copied virtual environments through durable host jobs. Readiness requires verifying the actual interpreter identity and prefix; run uses that interpreter with scrubbed variables and Python source, not arbitrary shell text. New Python work never requires global pip or `--break-system-packages`. Interpreter tampering blocks further execution.

Design applications use their own recorded application runtimes. Blender, GIMP, Krita and Inkscape have exact signed Debian/Ubuntu package plans; Godot 4 uses an official artifact URL and reviewed SHA-256. Installation is an explicit durable host job with proof inspection. Penpot is catalogued but blocked until its pinned container deployment is implemented and prerequisites are reviewed. A normal-user runtime cannot pretend it can install root-required packages; it reports the blocker and never invokes interactive sudo.

See [Design toolchain](../deploy/DESIGN_TOOLCHAIN.md) for package, checksum, dependency, download and extraction limits. These paths do not install Figma or Photoshop or promise complete file-format compatibility. The existing [OpenPencil adapter](../design-tools/README.md) remains available in the repository for its already verified `.fig` inspection/import/conversion/SVG handoff workflow. Software installation, a graphical desktop, GPU rendering and successful model loading are distinct checks.

## MCP control

**Daftar: Copy Runtime MCP Configuration** produces a VS Code stdio server configuration. It references a private token file, not a token in the clipboard JSON. The packaged adapter exposes office, worker, host, environment, model-resource and design-toolchain operations. Long operations return job IDs for inspection.

The headless `8788` service is authenticated REST. It is not an HTTP MCP endpoint. The packaged stdio bridge connects to it. To control it from ChatGPT, register that bridge through a supported MCP transport such as an account-authorized Secure MCP Tunnel. See [runtime MCP setup](../tools/DAFTAR_RUNTIME_MCP.md). A working laptop SSH connection and a copied MCP configuration do not automatically attach tools to this chat.

## Interface and compatibility

The webview packages the transitive desktop renderer asset graph with hashes and a strict content-security policy. It cannot make network requests. Correlated messages call an explicit parent method allowlist; owner tokens, provider credentials and SSH material remain outside webview state. Provider/cloud credentials use native password prompts. Only bounded camera/layout/theme preferences persist.

Connection epochs reject stale results, including the same URL reconnected under different credentials. Switching/disconnecting while a prompt is open cannot send a key to a different runtime or revive an old connection. Client deadlines and disposal settle even when an adapter ignores cancellation. Pending requests, receipts, jobs and output have explicit caps; reaching a persistent receipt cap requires deliberate archival, not silent eviction.

The private website compatibility mode retains queued command receipts and confirmed cloud chat. It does not claim that a queued command has changed native state. VS Code cloud mode uses the local shared canvas rather than website iframe portals.

## Build and verification

Use the checked-in lockfiles and a native build for the target platform:

```sh
npm ci --prefix desktop-shell --ignore-scripts
npm ci --prefix vscode-extension --ignore-scripts
npm --prefix desktop-shell run build:native
node desktop-shell/node_modules/typescript/bin/tsc -p headless-runtime/tsconfig.json
node desktop-shell/node_modules/typescript/bin/tsc -p desktop-shell/tsconfig.renderer.json
node desktop-shell/scripts/copy-renderer-assets.mjs
npm --prefix vscode-extension run build
npm --prefix vscode-extension run check
npm --prefix vscode-extension test
npm --prefix vscode-extension run package
```

The runtime package is platform-specific, contains the matching Rust binary and bundled pure Node modules, and does not ship Electron or npm dependencies as a runtime requirement. The preview provides Linux x64 and Windows x64 packages. The Linux native core requires glibc 2.34 or newer and `libgcc_s.so.1`; tmux persistence additionally requires tmux on that host. The installed smoke gate uses a fresh VS Code profile, verifies package manifests, starts the actual packaged backend through Electron's Node mode, checks authenticated readiness and paused workers, and proves owned shutdown. Linux additionally verifies the persistent tmux and actual host-command path. The successful product CI retains the separate canvas receipt and screenshots.

The headless workflow covers actual Rust/HTTP/stdio MCP and required real tmux acceptance. Synthetic provider adapters keep these checks independent of API billing. Fault tests cover stale CAS, duplicate IDs, revocation, digest changes, unknown launch outcomes, before/after-rename persistence failure, hung readers, cancellation and repeated open/close cycles.

No finite test can prove the absence of every memory leak. Validation reports measured cleanup of owned processes, request slots, timers, listeners, readers and locks, along with explicit caps. Actual target GPU, driver/display behavior, long-running model memory and package installation acceptance remain separate after the intended instance resumes.

## Primary integration references

- [VS Code remote extension placement](https://code.visualstudio.com/api/advanced-topics/remote-extensions)
- [VS Code webview API and lifecycle](https://code.visualstudio.com/api/extension-guides/webview)
- [Vast existing-instance listing](https://docs.vast.ai/api-reference/instances/show-instances)
- [OpenAI Secure MCP Tunnels](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
