# Kimi branch audit — 21 November 2026

## Exact provenance and diff

The supplied commit is [`3832c5d50ef28f7e873660a623cd35fdfa2c7999`](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/3832c5d50ef28f7e873660a623cd35fdfa2c7999), referenced by branch `kimi/research-director-platform` and tag `kimi-research-director-v0.6.0`. Its sole parent is the reviewed main baseline, `bc24dde4ec3032d16e39b7a3b2e1cdf7daf3fafd`.

The claim is **2,053 added files**, not 2,053 added lines. The diff contains **810,510 added text lines, 338 binary files, and zero modifications or deletions to main-branch files**. It adds `KIMI_HANDOFF.md` and 2,052 files under `kimi-platform/`; that directory contains 83,890,001 bytes. The major trees are app, desktop, Android, MCP, VS Code, research, charters and skill packages. The branch was inspected without checking it out over main or executing its binaries.

## Selective integration

The archive contains an older React/MySQL product and TypeScript-authority desktop alongside repeated generated atlas assets. The current Rust authority, durable command receipts, budgets, membership restrictions and device sync remain the product foundation.

| Reviewed source inside `kimi-platform/` | Useful idea | Current decision |
| --- | --- | --- |
| `desktop-shell/src/shared/assistant.ts` | Donna, company assistant, department coordinator and repository steward hierarchy | Adapted in original `desktop-shell/src/renderer/freeflow/donna-team.ts`, using current employee IDs, contracts and grants. No old assistant store or runtime copied. |
| `desktop-shell/src/renderer/office/canvas.ts` and `motion.ts` | Interruptible camera focus, content fit and local/OS reduced-motion preference | Interaction references for the continuous canvas; the old fixed-world, separate Office implementation is not imported. |
| `app/api/prompting/compiler.ts` | Source trust labels, untrusted text boundaries and redaction metadata | Reviewed as a concept; the old document-producer system prompt is not a replacement for current Donna authority. Current source review has its own explicit integration. |
| Six additional skill packages | AI research, backend/database, civilization/art, executive assistance, music and UI/UX references | Not installed by this work; require their own content and license review. |
| `vscode-extension/src` and `mcp-server/src` | Capability discovery, explicit unavailable errors and artifact containment | Reference only. They target the old companion at port 4319; the current runtime uses 8788. Old CEO/Donna routes are candidate-only. |

The new crew module records its source provenance in a comment. It resolves actual saved identities and typed proposals, reports missing configuration honestly and does not execute commands or create model hires. The manifests mark the old desktop `UNLICENSED`; this review does not relicense the archive or import its binaries.

## Prerelease packages

The [Kimi prerelease](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/kimi-research-director-v0.6.0), release ID 453978422, points to the supplied commit. The final metadata check, updated `2026-11-21T21:05:08Z`, confirmed all three packages and the checksum manifest were uploaded.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `research-director-companion-0.4.0.vsix` | 28,574 | `3f7a6c2134de5e49d0398ee0eb17829766ddbb9b93a953c4810fdadae89a7503` |
| `research-director-mcp-0.1.0.tgz` | 34,512 | `b3ecd48ed7e5899d67484162bada6ac727d895b675a58e1e6b91edb4c8c198c0` |
| `research-director-desktop-0.6.0-x86_64.AppImage` | 133,148,648 | `f7917febfadae42291b8bdf7d4f761b63d3c92ae77977146c4edfc5ddcbac74d` |
| `research-director-0.6.0-SHA256SUMS.txt` | 317 | `4e0e3044abee9b6c53bc32fef7fc06a14e149073b08db7c17bf0de739e384dde` |

VSIX and MCP Git blob bytes match their release metadata and the downloaded manifest. The downloaded manifest's own hash matches release metadata. The AppImage's metadata digest matches the manifest; **its binary was not downloaded or executed** in this review. The VSIX has 11 archive entries and the MCP archive 37, with no absolute/traversal paths or `.env`/private-key filenames observed. Package integrity does not establish runtime compatibility with current Daftar.

## Review limits

A targeted scan of tracked text found no common real GitHub PAT, Anthropic key or private-key header matches. No uploaded token files, local vault or dependency/build-cache directories were found in the added paths. This is not an exhaustive secret audit; no credentials were read or tested.

The old GitHub URL parser comments promise query/hash rejection but the inspected implementation does not check those fields. Its response-size check occurs after full buffering. These findings support keeping the current connector rather than porting the old one unchanged; they are not a complete security assessment.

The handoff's historical test counts—web 340, desktop 511, VS Code 82, MCP 61 and Android 53—were not rerun or independently certified. The separate current Donna projection passed 25 focused tests and strict TypeScript, including malformed authority, scoped sharing, member confidentiality and large hierarchy cases. Full 0.8.0 integration and release acceptance belong in [the candidate validation record](ENDLESS_CANVAS_VALIDATION.md).
