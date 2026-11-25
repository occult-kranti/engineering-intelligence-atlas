# Independent resource-system review

Review started 2026-11-24; follow-up verification completed 2026-11-25. Scope: public catalog/routing, native and hosted prompt integration, resource-library interaction, draft preservation and the global budget editor. No deployment, Git publication, provider call, hardware action or permission change was performed by this reviewer.

## Findings and resolutions

| Finding reproduced | Resolution and evidence |
| --- | --- |
| The frontend omitted `review.readingDepth` and `review.evidenceBasis`. Deep Learning's PDF restriction and exact partial-reading limits disappeared from its detail/draft. | The frontend owner added both fields to normalization, details and Donna's draft. Direct verification now finds the PDF restriction in the generated draft; frontend tests cover reading limits and rights. |
| A sendable 3,800-character CJK draft occupied 11,400 bytes. Appending a reference passed the old character-only guard but exceeded the 12,000-byte send limit. | `appendDonnaDraft` now checks both chat bounds before assignment. The prior reproduction returns `null`, preserving the existing draft. No message is sent by the library action. |
| URL normalization expanded 1,520 raw characters into a 13,520-character href. The draft fallback could emit 14,066 characters; quote-heavy metadata could also exceed the nominal 4,000 limit. | The frontend owner bounds the normalized URL and the final serialized UTF-8 draft. Oversized required metadata fails explicitly without truncating the source or rights. The expanded Unicode URL is now rejected; escaped/multibyte tests pass. |
| Unpinning the final item in Pinned-only removed the focused button and left keyboard focus on `BODY`. | The frontend owner added a next-item/search fallback. An independent JSDOM reproduction now restores focus to the search control. |
| Hosted Donna selected only lexical matches. “Continue” and “Use physics-research” returned no references, despite existing curated skill routes. | Hosted routing now recognizes complete known skill IDs/paths, deduplicates them, and uses Donna's director route when none is explicitly matched. All 15 exact IDs are tested. Matching affects public recommendations only; it does not assign a skill, employee or capability. |
| Generated cloud metadata used a raw-file hash while native used the canonical catalog hash. Equivalent packets had different provenance identities. | The projection script now consumes the strict checker's canonical hash receipt and refuses a source change during validation. Native and hosted packets compare exactly for the same inputs. |

Canonical catalog identity at this check: `1564141dda2f13b4df474676123b96997b5c62b8b22a460316cf7f6a23b0016a`.

## Gates completed

- `npm ci --ignore-scripts --no-audit --no-fund` in `desktop-shell`: installed locked dependencies without Electron/install scripts. Package manifests and lockfile were unchanged.
- `npm run typecheck` in `desktop-shell`: native and renderer TypeScript gates passed.
- Native OfficeWorker, role-reference, company-kit knowledge and Source Review suites: **121 tests passed**.
- `scripts/resource-router.test.mjs`: **13 tests passed**, including actual prompt construction, source-directive handling, private-company exclusion, and zero reservation/provider calls when the new context exceeds the job's token allowance.
- Frontend resource-library suite after fixes: **12 tests passed**.
- Hosted resource context, Atlas API and collaboration-budget suites: **39 tests passed**. Tests use synthetic state/provider stubs; they are not paid provider runs.
- `python scripts/sync-resource-projections.py`: generated snapshots and the exact pure selector match their canonical source.
- Direct independent reproductions confirmed preserved PDF restrictions, rejected Unicode overflow, rejected expanded URLs and restored keyboard focus.

## Boundaries confirmed

The 303-record catalog preserves all 296 original rows and their legacy fields. New review dates describe the stated reading depth; they do not upgrade a homepage or author claim into independently executed evidence. Four legacy HTTP sources remain recorded but are excluded from active HTTPS recommendations. Resource selection is capped at six entries and 8,192 UTF-8 bytes.

The global editor now accepts `$120`, consistently with the native policy's existing supported ceiling. This editor change does not itself set a budget, relax per-job limits, reserve funds or dispatch a model. Existing authority, scope, approval and admission checks remain in place.

Native and hosted resource context is public metadata, not fetched source contents. Company knowledge and granted transfers retain their original controls. The separate server-backed graph Director still supplies its explicitly configured `node.resourceUrls`; this increment does not add automatic resource routing to that independent executor. Do not describe that path as newly integrated without a separate implementation and gate.

JSDOM verifies interaction and focus behavior, not visual layout. Source Review is a heuristic, and structural tests do not establish improved agent task quality, current external availability, model compatibility or hardware correctness.
