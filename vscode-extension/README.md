# Daftar Office for VS Code

Keep Donna, permanent teams, company roadmaps, goals and the work queue beside your code. This extension is a client of the installed Daftar desktop or the private Daftar website. The Rust core remains the execution authority.

## Install

Download the versioned `atlas-office` VSIX from the [Daftar release](https://github.com/occult-kranti/engineering-intelligence-atlas/releases). In VS Code, choose **Extensions → … → Install from VSIX**, select the file, then open **Daftar** in the activity bar. VS Code 1.95 or newer is required. Marketplace publication is not part of this release.

When paired to the private website, the Studio controls open Blueprint, Ownership, Roadmap and Whiteboard with the selected company retained. URLs are restricted to the connected HTTPS origin and supported views; no device secret is added to a navigation URL. The editor keeps its own theme and high-contrast behavior, with restrained green/gold accents in normal light and dark modes.

## Connect the desktop

1. Start the Daftar desktop app on the same computer.
2. Open its Settings and choose **Pair VS Code**. This copies a fresh connection link to the clipboard.
3. In VS Code, run **Daftar: Connect to Desktop** and paste that link into the masked input.

The link expires after five minutes and can be used once. The resulting session lasts up to 12 hours and ends when the desktop closes. The extension stores the session in VS Code SecretStorage. It does not store a provider API key. A normal browser dashboard link already consumed by a browser cannot be reused for editor pairing.

Local Donna briefs are saved to the selected company's conversation. To start billed work, open Donna in the desktop, create a bounded provider goal, review it, and run its queue. The editor does not fabricate a provider answer for a saved brief.

## Connect the private website

1. Sign in on your Daftar private website.
2. Create an editor device in its connection settings and copy the complete pairing JSON.
3. Run **Daftar: Connect to Signed-in Website**, enter its HTTPS origin, and paste the pairing JSON into the masked input.

Cloud Donna chat calls the server-backed provider and records usage against the website's reserved budget. Team changes and decision-panel requests are **waiting for desktop** until the installed app explicitly synchronizes them. A disconnected desktop is not shown as having completed the work. Refresh the website after a conflict and resubmit against the new revision.

## Workspace controls

| View | Function |
| --- | --- |
| Donna | Scoped conversation, server-backed cloud replies or saved desktop briefs, draft decision panels |
| Team | Office and department grouping, employee pause/resume, actual job lifecycle and queue pause/resume |
| Roadmap | Global, group and company milestones with ownership/evidence, plus company goals |

The extension refreshes visible state every 30 seconds. Refresh reads state; it never starts a provider request. Your explicit Send action creates one request and is not automatically retried after an ambiguous failure. A cloud chat waits up to 210 seconds for the server's bounded provider call and accounting; other requests retain a 45-second timeout. Office commands preserve the cloud revision they were based on.

## Build and verify

```sh
npm ci
npm run check
npm test
npm run package
```

The package script runs checks and tests before creating the VSIX. Runtime code uses Node and VS Code APIs without additional bundled dependencies. Tests cover endpoint restrictions, one-use pairing, credential placement, revision conflicts, offline queue labels, response bounds and no automatic billed retries.

### Verify the installed VSIX

On Linux with a graphical display (or `xvfb`), run this after packaging:

```sh
xvfb-run -a npm run test:installed
```

The harness uses Microsoft's [`@vscode/test-electron`](https://code.visualstudio.com/api/working-with-extensions/testing-extension) and pins VS Code **1.147.0**. To test another exact release, set `ATLAS_VSCODE_TEST_VERSION`. It installs the built VSIX into an empty temporary extensions directory, then launches a separate test-host extension. Daftar must activate from its installed path; loading the source extension as a development extension fails the test. The gate checks the installed version and runtime file hashes, all seven command registrations, Open Office, disconnected refresh/disconnect, credential redaction, and absence of development files or credential-shaped material in the installed archive.

The empty test profile has no pairing credentials. Daftar fetches are blocked during activation and command checks, and the receipt must record zero network dispatches. Setup downloads VS Code; it does not call an AI provider. The official test runner uses its standard Chromium sandbox exception for the isolated test process; it does not change the shipped extension or desktop security settings.

The receipt is `.work/installed-smoke/receipt.json`, accompanied by the VSIX installation log and VS Code logs. CI publishes these as the `vscode-installed-smoke` artifact. A passing receipt verifies installed activation and offline command wiring. Signing in, pairing an owner's laptop, and visually checking that laptop's VS Code theme remain separate acceptance steps.

See [the editor and cloud handoff](../project/EDITOR_AND_CLOUD.md) for the protocol, restoration, conflict handling and MCP setup.
