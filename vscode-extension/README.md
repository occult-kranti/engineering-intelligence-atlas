# Daftar Office for VS Code

Keep Donna, permanent teams, company roadmaps, goals and the work queue beside your code. This extension connects to one active backend: a headless Daftar runtime, the installed desktop, or the private Daftar website. The Rust core remains the execution authority.

## Install

Download the versioned `atlas-office` VSIX from the [Daftar release](https://github.com/occult-kranti/engineering-intelligence-atlas/releases). In VS Code, choose **Extensions → … → Install from VSIX**, select the file, then open **Daftar** in the activity bar. VS Code 1.95 or newer is required. Marketplace publication is not part of this release.

When paired to the private website, the Studio controls open Blueprint, Ownership, Roadmap and Whiteboard with the selected company retained. URLs are restricted to the connected HTTPS origin and supported views; no device secret is added to a navigation URL. The editor keeps its own theme and high-contrast behavior, with restrained green/gold accents in normal light and dark modes.

## Connect the desktop

1. Start the Daftar desktop app on the same computer.
2. Open its Settings and choose **Pair VS Code**. This copies a fresh connection link to the clipboard.
3. In VS Code, run **Daftar: Connect to Desktop** and paste that link into the masked input.

The link expires after five minutes and can be used once. The resulting session lasts up to 12 hours and ends when the desktop closes. The extension stores the session in VS Code SecretStorage. It does not store a provider API key. A normal browser dashboard link already consumed by a browser cannot be reused for editor pairing.

Local Donna briefs are saved to the selected company's conversation. To start billed work, open Donna in the desktop, create a bounded provider goal, review it, and run its queue. The editor does not fabricate a provider answer for a saved brief.

## Connect a headless runtime

1. Start your configured Daftar runtime, or forward its loopback port through your existing SSH connection.
2. Run **Daftar: Connect to Headless Runtime**, or choose **Connect runtime** in the Office view. Enter its canonical HTTPS origin or an HTTP loopback origin, such as `http://127.0.0.1:8788`.
3. Paste its owner control token into the masked input. The extension verifies the service and native office snapshot before storing the connection in VS Code SecretStorage.

The runtime becomes this editor's active backend. Provider credentials and executable paths remain on that runtime. The editor does not provision hardware, install creative software, or start workers during connection. Visible office state and selected-company creative inventory refresh automatically. Team commands apply directly through the runtime's native command boundary, using a current state hash and a unique receipt ID. Runtime Donna briefs are saved messages; saving a brief does not claim that a model has answered or started work.

The runtime owner configures `DAFTAR_CREATIVE_CONFIG_FILE` with private, reviewed executable paths and project roots. Discovery checks configured local tools with bounded version probes. Missing software remains **Unavailable** or **Not configured**. The editor cannot supply a different executable, shell command, project root, or arbitrary argument list.

### Creative tools

Use **Creative tools · assignments and tasks** below the company selector or run **Daftar: Creative Tools**. The workflow offers:

- **Review detected tools and project readiness:** read the tool inventory, approved projects, assignments, and runtime limits in a temporary document.
- **Assign tools to an employee:** choose an approved project, an eligible active employee and configured tools. **Remove a tool assignment** remains available when a former employee is no longer eligible for new work. Assignments are metadata; the runtime still requires current scoped `creative.execute` authority at task execution.
- **Start a bounded creative task:** choose an assignment, an advertised operation allowed by the project, and a project-relative input file. Render dimensions are 16–2048 pixels, Blender samples 1–64, and frames 0–100000. Blank optional values use the runtime's bounded defaults. The private runtime can impose stricter resource limits.
- **Check a task result or cancel:** read current status, safe inspection metadata, and relative output names with byte counts and SHA-256 digests. The editor does not open a server path as a local file or download artifacts. Cancellation is a request; a job may already have finished.

Reviewed operations cover Blender inspection, one-frame rendering and GLB export; Unreal project inspection and validation; Inkscape PNG export; FFmpeg/ffprobe media inspection; and licensed Adobe Photoshop manifest/render operations. Adobe manifest accepts `.psd`; Adobe render accepts `.psd`, `.png`, `.jpg` and `.jpeg`. PSB is not supported by these adapters. The operation picker uses the runtime's advertised readiness and project allowlist. **Queued**, **running**, **failed**, **cancelled**, **interrupted**, and **succeeded** remain distinct states.

Adobe inventory can show **Configured — Adobe authentication unverified**. That means the local adapter configuration is present; discovery does not call Adobe or establish remote authentication. Adobe tasks require the owner's private paid-request opt-in, an upload-enabled project, and an explicit editor review of the selected asset upload. Already-dispatched Adobe usage may remain billable after cancellation. Blender, Inkscape and FFmpeg are separate open-source tools; their availability does not imply Adobe compatibility or licensing. Unreal is separately licensed software.

The editor never automatically retries a creative start. An ambiguous failure retains the original request ID in its error message; inspect the company task list before another request. A saved receipt whose detailed response was omitted remains a successful saved receipt. Company or connection changes during prompts cancel preparation, and late replies cannot replace the new company's view.

## Connect the private website

1. Sign in on your Daftar private website.
2. Create an editor device in its connection settings and copy the complete pairing JSON.
3. Run **Daftar: Connect to Signed-in Website**, enter its HTTPS origin, and paste the pairing JSON into the masked input.

Cloud Donna chat calls the server-backed provider and records usage against the website's reserved budget. Team changes and decision-panel requests are **waiting for desktop** until the installed app explicitly synchronizes them. A disconnected desktop is not shown as having completed the work. Refresh the website after a conflict and resubmit against the new revision.

## Workspace controls

| View | Function |
| --- | --- |
| Donna | Scoped conversation, server-backed cloud replies or saved desktop briefs, draft decision panels |
| Team | Office and department grouping, permanent employee definitions, name/role/skill edits, specialist retirement, department creation/naming/hierarchy/pause/resume, office naming, and actual job lifecycle |
| Roadmap | Global, group and company milestones with ownership/evidence, plus company goals |
| Creative tools | Runtime discovery, approved project and employee assignments, bounded starts, task results and cancellation |

Use **Manage team** in the Team view or **Daftar: Manage Team and Departments** in the command palette. The editor selects records from a fresh snapshot and submits the scoped native command. Hiring creates a durable definition; it does not start a model. Editing a role or skill bindings does not grant permissions. **Retire specialist** retains history and cancels its work; this is terminal. Shared assistants retain ownership and can be paused instead. Department pauses retain the department and its history.

**Review Donna ownership** (also available in the command palette) reads the global Donna coordinator plus company, office and department assistant assignments into a temporary editor document. It flags missing or mismatched ownership records and counts current direct grants for the displayed scope (the selected company for Donna). This count is informational: the native backend checks the full delegation chain and effective authority before applying operations. Company-scoped management cannot edit global Donna or an assistant belonging to another company.

The extension refreshes visible state every 30 seconds. Refresh reads state and may probe configured local creative executables; it never starts a creative job or provider request. Your explicit Send action creates one request and is not automatically retried after an ambiguous failure. A cloud chat waits up to 210 seconds for the server's bounded provider call and accounting; other requests retain a 45-second timeout. Office commands preserve the cloud revision or runtime state hash they were based on. Concurrent mutation clicks are blocked, and responses from a previous company or disconnected session cannot replace the current view.

Unsent briefs are retained in local VS Code webview state, separately for each connected origin and company (at most 50 drafts, 12,000 characters each). They are restored after refresh or view recreation. A completed send clears only the brief it submitted, preserving text typed while a reply was pending. Device credentials remain in SecretStorage; do not put credentials in a brief.

## Build and verify

```sh
npm ci
npm run check
npm test
npm run package
```

The package script runs checks and tests before creating the VSIX. Runtime code uses Node and VS Code APIs without additional bundled dependencies. Tests cover endpoint restrictions, one-use pairing, stored credential validation, revision conflicts, offline queue labels, response bounds, management scope/ownership invariants, concurrent actions, stale responses, local draft preservation, and no automatic billed retries. Host tests use a synthetic VS Code API; the separate installed gate below remains necessary for installed-extension acceptance.

### Verify the installed VSIX

On Linux with a graphical display (or `xvfb`), run this after packaging:

```sh
xvfb-run -a npm run test:installed
```

The harness uses Microsoft's [`@vscode/test-electron`](https://code.visualstudio.com/api/working-with-extensions/testing-extension) and pins VS Code **1.147.0**. To test another exact release, set `ATLAS_VSCODE_TEST_VERSION`. It installs the built VSIX into an empty temporary extensions directory, then launches a separate test-host extension. Daftar must activate from its installed path; loading the source extension as a development extension fails the test. The gate checks the installed version and runtime file hashes, all **11** contributed command registrations, Open Office, disconnected refresh/disconnect, credential redaction, and absence of development files or credential-shaped material in the installed archive. It also loads the installed creative contract and checks company scoping, render bounds, path rejection, and the unverified Adobe label. These produce seven receipt check groups; they do not establish a real runtime connection or execute creative software.

The empty test profile has no pairing credentials. Daftar fetches are blocked during activation and command checks, and the receipt must record zero network dispatches. Setup downloads VS Code; it does not call an AI provider. The official test runner uses its standard Chromium sandbox exception for the isolated test process; it does not change the shipped extension or desktop security settings.

The receipt is `.work/installed-smoke/receipt.json`, accompanied by the VSIX installation log and VS Code logs. CI publishes these as the `vscode-installed-smoke` artifact. A passing receipt verifies installed activation and offline command wiring. Signing in, pairing an owner's laptop, and visually checking that laptop's VS Code theme remain separate acceptance steps.

See [the editor and cloud handoff](../project/EDITOR_AND_CLOUD.md) for the protocol, restoration, conflict handling and MCP setup.
