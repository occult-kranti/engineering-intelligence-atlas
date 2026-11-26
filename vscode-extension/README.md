# Daftar Office for VS Code

## Version 0.9.2 development candidate

Open the full infinite office canvas inside VS Code, run its packaged backend on this host or in Remote-SSH, and manage Donna’s compute ownership, environments and model resources. See the [complete product and setup guide](../project/VSCODE_PRIMARY_PRODUCT.md). The full office remains the shared canvas. The activity view also provides company conversation, team controls and a scoped creative development workflow. Earlier companion connection details are retained below for compatibility.

Keep Donna, permanent teams, company roadmaps, goals and the work queue beside your code. The primary workspace includes a packaged private backend and the shared office canvas. Connections to an installed Daftar desktop or private Daftar website remain available for compatibility. The Rust core remains the office execution authority.

## Install

Choose the versioned `atlas-office` VSIX for the operating system and architecture of the **extension host** from the [Daftar release](https://github.com/occult-kranti/engineering-intelligence-atlas/releases). The build matrix produces separate Linux x64 and Windows x64 packages; they contain different native binaries and are not interchangeable. In Remote-SSH, install the package matching the remote host. In VS Code, choose **Extensions → … → Install from VSIX**, select the matching file, then open **Daftar** in the activity bar. Marketplace publication is not part of this release.

The extension declares VS Code **1.95 or newer**, while starting its packaged backend separately requires **Node.js 22 or newer on that extension host**. The launcher checks the actual executable before starting. If the editor's bundled Node is older, set the machine setting `atlas.nodePath` to an absolute path to a compatible Node executable. The declared editor range does not mean every supported editor bundles Node 22; the installed acceptance harness currently pins VS Code **1.147.0**. Open a trusted workspace before connecting or starting the runtime.

## Start the primary workspace

1. Run **Daftar: Start Workspace on This Host** to start the packaged backend on the current extension host. In a Remote-SSH window, this runs on the remote machine. The backend starts with provider workers paused and host policy off.
2. Run **Daftar: Open Office** to use the shared infinite canvas. **Daftar: Donna Compute and Ownership** opens its compute controls, including explicit host grants, managed Python environments, model resources, design plans and activity metadata.
3. For Linux persistence across editor disconnects, use **Daftar: Start Persistent Workspace in tmux** with `tmux` installed on that host. Ordinary owned-runtime shutdown and persistent-runtime detachment have different lifecycles; see the [setup and ownership guide](../project/VSCODE_PRIMARY_PRODUCT.md).

An already-running private backend can be connected with **Daftar: Connect Private Runtime**. **Daftar: Connect Vast.ai / SSH Compute** establishes the configured connection; it does not start a stopped rented instance or prove GPU readiness. **Daftar: Copy Runtime MCP Configuration** prepares configuration for an MCP client; copying it does not establish a ChatGPT connection.

`atlas.hostControlEnabled` exposes host-control capabilities on Linux, with policy initially off. God mode is an explicit owner policy for the recorded current company set and the runtime's OS account. It starts no job and changes no provider budget, instance lifecycle or platform approval setting. Company and employee selectors provide attribution and policy scope, not independent tenant authentication. See [operations, roles and logs](../project/OPERATIONS_CONTROL.md) for the setup sequence and limits.

## Python environments

Set the machine setting **`atlas.pythonPath`** to an absolute Python 3 executable on the extension host when a particular Python installation or venv is required. Examples are `/srv/daftar/.venv/bin/python` on Linux and `C:\Daftar\.venv\Scripts\python.exe` on Windows. An empty setting uses the host's default Python selection. An explicit path is validated and forwarded to newly started runtimes; an invalid configured interpreter fails instead of silently choosing another Python. In Remote-SSH, use a path that exists on the remote machine.

The configured Python creates the workbench's own isolated environments. The environment creation result supplies its exact interpreter path; run Python and install packages through that returned executable. A venv isolates Python dependencies, and [activation is optional when the interpreter is addressed directly](https://docs.python.org/3/library/venv.html#how-venvs-work). VS Code, the extension, and Daftar's Node/Rust backend keep their own runtimes. VS Code's separate **Python: Select Interpreter** command selects the interpreter for Python editing and debugging; it does not change `atlas.pythonPath`.

Portable workbench environment creation is supported on Linux and Windows. Donna's managed host-job environments use Linux and tmux, including through a Linux Remote-SSH host, and inherit the current host approval policy. Managed jobs verify their copied interpreter, exclude user and system site-packages, and bind the venv configuration before execution. Enabling system site-packages or changing a pinned configuration rejects the job before dispatch. These controls provide Python dependency isolation; the runtime reports `secureSandbox: false` because a venv is not an operating-system sandbox.

Changing the Python setting applies to a newly started runtime. Reconnecting to an existing persistent tmux runtime preserves that daemon's configuration. Inspect its current work and use its explicit shutdown procedure before starting it with a different interpreter.

## Compatibility connections

When paired to the private website, the Studio controls open Blueprint, Ownership, Roadmap and Whiteboard with the selected company retained. URLs are restricted to the connected HTTPS origin and supported views; no device secret is added to a navigation URL. The editor keeps its own theme and high-contrast behavior, with restrained green/gold accents in normal light and dark modes.

### Connect the desktop

1. Start the Daftar desktop app on the same computer.
2. Open its Settings and choose **Pair VS Code**. This copies a fresh connection link to the clipboard.
3. In VS Code, run **Daftar: Connect to Desktop** and paste that link into the masked input.

The link expires after five minutes and can be used once. The resulting session lasts up to 12 hours and ends when the desktop closes. The extension stores the session in VS Code SecretStorage. It does not store a provider API key. A normal browser dashboard link already consumed by a browser cannot be reused for editor pairing.

Local Donna briefs are saved to the selected company's conversation. To start billed work, open Donna in the desktop, create a bounded provider goal, review it, and run its queue. The editor does not fabricate a provider answer for a saved brief.

### Connect the private website

1. Sign in on your Daftar private website.
2. Create an editor device in its connection settings and copy the complete pairing JSON.
3. Run **Daftar: Connect to Signed-in Website**, enter its HTTPS origin, and paste the pairing JSON into the masked input.

Cloud Donna chat calls the server-backed provider and records usage against the website's reserved budget. Team changes and decision-panel requests are **waiting for desktop** until the installed app explicitly synchronizes them. A disconnected desktop is not shown as having completed the work. Refresh the website after a conflict and resubmit against the new revision.

### Companion workspace controls

| View | Function |
| --- | --- |
| Donna | Scoped conversation, server-backed cloud replies or saved desktop briefs, draft decision panels |
| Team | Office and department grouping, employee pause/resume, actual job lifecycle and queue pause/resume |
| Roadmap | Global, group and company milestones with ownership/evidence, plus company goals |

The sidebar reads the selected company when it opens, after an explicit action, and when refreshed. The visible full office polls job and run metadata independently. Refresh reads state; it never starts a provider request. Your explicit Send action creates one request and is not automatically retried after an ambiguous failure. A cloud chat waits up to 210 seconds for the server's bounded provider call and accounting; other companion requests retain a 45-second timeout. Office commands preserve the cloud revision they were based on. The private runtime's adaptive worker polling is separate from this view refresh.

## Creative development: MoE, Blender and Unreal

Open **Creative development** in the full office toolbar, **Model and development workflow** in the activity view, or **Daftar: Creative Development** in the command palette. The workflow uses the currently selected company and connected backend. The desktop and private runtime expose the model pool; creative execution requires a private runtime with an owner-configured creative worker. A website pairing offers a readiness report and runtime connection, not a claim that models or tools are available.

The workflow can inspect readiness, prepare a model download, assign an installed model digest, cancel a download subscription, prepare one bounded coding task, or run a supported Blender/Unreal operation on an assigned project. Model downloads, selections and provider tasks first produce a concrete JSON review and require the final **submit** choice. A company/connection change or changed model digest invalidates the prepared task. No action silently enables provider workers, changes grants, starts a rented instance, or installs a creative tool.

| Setting | Candidate profile |
| --- | --- |
| Primary model | `qwen3-coder:30b-a3b-q4_K_M` |
| Architecture | Text-only, non-thinking MoE; published 30.5B total / 3.3B active parameters |
| Published artifact | About 19 GB, Q4_K_M; this is not measured GPU memory |
| Request context | Explicit Ollama `num_ctx: 8192`; prompt byte bound, adapter overhead and output must fit |
| Reviewed task budget | 8,000 **total** reserved tokens, including prompt/overhead; output receives the remaining allowance |
| Model download ceiling | 24 GiB, scoped to the chosen employee and stable request key |
| Initial coding task | One authorized text task, two minutes, no tools, local token price $0; workers retain their current state |

The catalog entry is based on the [published Ollama artifact](https://ollama.com/library/qwen3-coder:30b-a3b-q4_K_M) and [upstream model card](https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct). Catalog support is separate from installation, current load state, digest assignment, and successful GPU inference. VPS/GPU rental, storage, transfer and energy charges are outside the provider-token governor.

Blender's private worker configuration chooses `CPU`, `CUDA` or `OPTIX` and one device index. GPU execution requires a verified cgroup-v2 memory ceiling before launch; an unavailable device or missing enforcement prerequisite fails clearly instead of falling back to CPU. Version detection alone is shown as **unverified** device readiness. Completed render receipts show the actual backend, selected device count/name/index, frame and duration. See [creative deployment](../deploy/creative/README.md).

Unreal operations remain capability-gated metadata/validation tasks using the configured engine and approved project operations. The existing headless adapter uses `-NullRHI`; it does not demonstrate an interactive editor, GPU rendering or a completed game build. **Blender** and **Unreal** choices reuse the existing assignment, native authority, relative-path, operation and receipt checks.

For Andolan/Yuga, use the repository-bound [development company kit](../projects/andolan-yuga-development/README.md) and select the resulting actual company. The current target is the Rust/WASM + PlayCanvas project on `game/yuga-hanuman-trial`; no existing Unreal project or live GPU deployment is assumed. The kit does not invent a company identity or enable provider work.

**Daftar: Manage Team**, **Daftar: Review Donna Ownership** and **Daftar: Creative Tools** remain available alongside all fourteen released native runtime, compute and canvas commands. Unsaved sidebar briefs remain separate by company and connected origin.

## Build and verify

First complete the [native and shared-renderer build prerequisites](../project/VSCODE_PRIMARY_PRODUCT.md#build-and-verification) from the repository root. Then, from `vscode-extension`:

```sh
npm ci
npm run build
npm run check
npm test
npm run package
```

The package script runs checks and tests before creating the VSIX, verifies that the runtime manifest matches the build host, and marks the VSIX with its target platform. Build on the intended target platform with its matching Rust binary. The package includes that binary, the shared canvas and Donna artwork/editable assets, creative helper scripts, bundled Node modules and integrity manifests; it does not require a separate desktop Electron installation or an npm install at runtime. Tests cover lifecycle cleanup, runtime integrity, connection boundaries, host policy, ownership, response limits and uncertain requests without automatic mutation retries.

### Verify the installed VSIX

After packaging, first run the bounded installation, runtime lifecycle and Python acceptance gate:

```sh
npm run test:installed-runtime
```

Set `DAFTAR_PYTHON_PATH` to an absolute host Python 3 interpreter if automatic test-host discovery is unsuitable. This gate installs the exact VSIX with the real VS Code CLI into a temporary profile. It executes the installed runtime modules with the downloaded editor’s Node runtime through six actual native start/read/stop cycles, with twelve concurrent starts and sixteen concurrent reads per cycle. It checks duplicate ownership, incorrect credentials, one native mutation under sixteen duplicate deliveries, persistent state, closed listeners and released child resources. It also creates an outer launch venv, starts the Node/native runtime with that explicitly selected Python, creates another venv through the installed workbench, verifies that the new venv records the explicitly configured bootstrap interpreter, and installs, executes and removes a generated local wheel using its returned interpreter. The base interpreter must be unable to import that package. The probe uses no package index or provider. Its receipt is `.work/installed-runtime/receipt.json` and explicitly leaves GUI activation and managed tmux verification to the next gate.

On Linux with a graphical display (or `xvfb`), run this after packaging:

```sh
xvfb-run -a npm run test:installed
```

On Windows, run `npm run test:installed` after packaging; persistent tmux host control remains Linux-only.

The harness uses Microsoft's [`@vscode/test-electron`](https://code.visualstudio.com/api/working-with-extensions/testing-extension) and pins VS Code **1.147.0**. To test another exact release, set `ATLAS_VSCODE_TEST_VERSION`. It installs the matching VSIX into an empty temporary extensions directory, then launches a separate test-host extension. Daftar must activate from its installed path; loading the source extension as a development extension fails the test. The gate checks the installed version, runtime and canvas manifests, all **18 contributed command registrations**, Open Office, disconnected refresh/disconnect, credential redaction, and absence of development files or credential-shaped material in the archive. It starts the actual packaged native backend through the editor's Node mode, verifies authenticated loopback readiness with provider workers paused, and confirms owned-runtime shutdown.

The empty profile has no pairing or provider credentials. Initial activation and disconnected commands must make zero requests. Later phases allow bounded authenticated requests to the test's own loopback runtime. Linux additionally exercises the installed editor → dedicated tmux → native daemon path, verifies detach/reconnect, runs one fixed bounded host-command fixture under a canonical company assistant, checks idempotent replay, returns host policy to off, and confirms cleanup. It prepares a real managed venv, installs a generated local wheel into its reported interpreter, executes that module through the managed tmux job path, checks stable prepare/run replay, and verifies that changed isolation or pinned configuration creates no new managed or host job. After restoring the original configuration, another managed run must succeed. The receipt distinguishes loopback traffic from external dispatch; it must record no provider, Vast.ai, SSH or cloud requests. Setup downloads the pinned VS Code archive. The upstream test runner's isolated Chromium test settings do not change the shipped extension or desktop security settings.

The receipt is `.work/installed-smoke/receipt.json`, accompanied by the VSIX installation log and VS Code logs. CI publishes each platform's VSIX and receipts under `daftar-vscode-<runner OS>-<runner architecture>`. Shared-canvas browser acceptance has its own `.work/canvas-smoke/` evidence. A Linux receipt does not certify Windows installation or the separate canvas gate; consult the [current handoff](../HANDOFF.md) and the matching source revision's CI receipts for release status. Signing in on an owner's laptop, checking its display/theme, and executing a workload on the intended GPU remain separate acceptance steps. No installed-smoke result claims that the stopped Vast instance was resumed, design software was installed there, or ChatGPT was connected.

See [the editor and cloud handoff](../project/EDITOR_AND_CLOUD.md) for the protocol, restoration, conflict handling and MCP setup.
