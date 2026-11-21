# Changelog

## 0.4.0

- Initial release of the Research Director Companion.
- Loopback pairing with Secret Storage-only token and health check.
- Activity bar container: chat webview (strict CSP, validated messages, no
  fake streaming), Office Projects tree, Runs tree.
- Commands: Pair / Disconnect / Refresh / New Goal / run Start, Pause, Resume,
  Recover, Cancel / Approve, Reject (exact payloadHash) / Open, Diff, Apply
  Artifact (workspace-confined writes) / Ask Director about Selection
  (selection-only context with path privacy).
- All HTTP endpoints isolated in `src/bridge/routes.ts` pending the desktop
  companion server (`desktop-shell src/main/companion.ts`).
