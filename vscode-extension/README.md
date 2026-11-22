# Daftar Office for VS Code

## Version 0.9: primary workspace

Open the full infinite office canvas inside VS Code, run its packaged backend on this host or in Remote-SSH, and manage Donna’s compute ownership, environments and model resources. See the [complete product and setup guide](../project/VSCODE_PRIMARY_PRODUCT.md). The activity view is a launcher; all office tools live on the shared canvas. Earlier companion connection details are retained below for compatibility.

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

The companion view refreshes visible state every 30 seconds. Refresh reads state; it never starts a provider request. Your explicit Send action creates one request and is not automatically retried after an ambiguous failure. A cloud chat waits up to 210 seconds for the server's bounded provider call and accounting; other companion requests retain a 45-second timeout. Office commands preserve the cloud revision they were based on. The private runtime's adaptive worker polling is separate from this view refresh.

## Build and verify

First complete the [native and shared-renderer build prerequisites](../project/VSCODE_PRIMARY_PRODUCT.md#build-and-verification) from the repository root. Then, from `vscode-extension`:

```sh
npm ci
npm run build
npm run check
npm test
npm run package
```

The package script runs checks and tests before creating the VSIX, verifies that the runtime manifest matches the build host, and marks the VSIX with its target platform. Build on the intended target platform with its matching Rust binary. The package includes that binary, the shared canvas assets, bundled Node modules and integrity manifests; it does not require a separate desktop Electron installation or an npm install at runtime. Tests cover lifecycle cleanup, runtime integrity, connection boundaries, host policy, ownership, response limits and uncertain requests without automatic mutation retries.

### Verify the installed VSIX

On Linux with a graphical display (or `xvfb`), run this after packaging:

```sh
xvfb-run -a npm run test:installed
```

On Windows, run `npm run test:installed` after packaging; persistent tmux host control remains Linux-only.

The harness uses Microsoft's [`@vscode/test-electron`](https://code.visualstudio.com/api/working-with-extensions/testing-extension) and pins VS Code **1.147.0**. To test another exact release, set `ATLAS_VSCODE_TEST_VERSION`. It installs the matching VSIX into an empty temporary extensions directory, then launches a separate test-host extension. Daftar must activate from its installed path; loading the source extension as a development extension fails the test. The gate checks the installed version, runtime and canvas manifests, all **14 contributed command registrations**, Open Office, disconnected refresh/disconnect, credential redaction, and absence of development files or credential-shaped material in the archive. It starts the actual packaged native backend through the editor's Node mode, verifies authenticated loopback readiness with provider workers paused, and confirms owned-runtime shutdown.

The empty profile has no pairing or provider credentials. Initial activation and disconnected commands must make zero requests. Later phases allow bounded authenticated requests to the test's own loopback runtime. Linux additionally exercises the installed editor → dedicated tmux → native daemon path, verifies detach/reconnect, runs one fixed bounded host-command fixture under a canonical company assistant, checks idempotent replay, returns host policy to off, and confirms cleanup. The receipt distinguishes loopback traffic from external dispatch; it must record no provider, Vast.ai, SSH or cloud requests. Setup downloads the pinned VS Code archive. The upstream test runner's isolated Chromium test settings do not change the shipped extension or desktop security settings.

The receipt is `.work/installed-smoke/receipt.json`, accompanied by the VSIX installation log and VS Code logs. CI publishes each platform's VSIX and receipts under `daftar-vscode-<runner OS>-<runner architecture>`. Shared-canvas browser acceptance has its own `.work/canvas-smoke/` evidence. A Linux receipt does not certify Windows installation or the separate canvas gate; consult the [current handoff](../HANDOFF.md) and the matching source revision's CI receipts for release status. Signing in on an owner's laptop, checking its display/theme, and executing a workload on the intended GPU remain separate acceptance steps. No installed-smoke result claims that the stopped Vast instance was resumed, design software was installed there, or ChatGPT was connected.

See [the editor and cloud handoff](../project/EDITOR_AND_CLOUD.md) for the protocol, restoration, conflict handling and MCP setup.
