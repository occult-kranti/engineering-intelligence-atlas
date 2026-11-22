# Daftar board workflows — paired design and delivery

Run: `boards-flow-20261122`. Baseline: `9c4f84934762b6f9e2bccac3f9ca9e3986025e00`.
User-facing planning date: 21 November 2026 (America/New_York).

## Product decision

Keep the single endless blueprint world. Whiteboard, People & ownership (Greenboard), company roadmap, Donna and configuration remain live elements of that world. Employee markers remain flat circles; the existing optional architectural relief and shared camera remain. No second task database or new application screen is introduced.

Whiteboard cards are links to canonical work. The card's **steward** maintains its organization; the primary employee produces the deliverable; a distinct helper/reviewer critiques that deliverable; native evidence determines acceptance. Moving a card or changing its steward never changes execution grants. Greenboard is a visible alias of the existing `softboard` surface, retaining its saved identity and accessible People & ownership name.

## Three rounds and independent helpers

| Round | Producer responsibilities | Independent helper and exit gate |
| --- | --- | --- |
| 1 — trace and challenge | UX agent traces whiteboard, ownership and roadmap interactions; native agent audits queue, ownership, migration and review; integration agent audits VS Code/MCP metadata, CAS and lifecycle. | Root cross-checks their findings against source; shared findings are reconciled before assigning exclusive files. No audit is presented as an executed test. |
| 2 — build coherent contracts | Native agent owns paired job DAGs, review receipts and revision rules. UX agent owns forms, board geometry, motion and navigation. Integration agent owns bounded MCP reads and production legacy-executor gates. Sonnet authors the pure ETA planner; root owns worker review handling and VS Code request lifecycle. | Each implementation has another agent or root as its reviewer. Root reviews Sonnet's arithmetic and input semantics; integration independently reviews the planner, adapter and lifecycle. Review findings return to the responsible producer. |
| 3 — exercise and accept | Run meaningful native, worker, geometry, planning, renderer, MCP, runtime and VS Code suites. Exercise the shipped shared renderer against a temporary native backend with sandboxed Chrome. | Inspect real screenshots and receipts. Keep failed attempts and corrections visible. Accept only observed outcomes, then push source and evidence. Physical-GPU performance and indefinite absence of leaks remain outside this bounded test claim. |

The project skills used are Agent Research Director, Engineering Organization Architect, Computational Geometry Engineering and Spatial 3D Production Engineering, with the project's skill collaboration protocol. The existing product/design decisions are retained. Agent work has explicit file ownership, budgets, typed reports and bounded replans; no peer may silently expand permissions or dispatch a paid provider.

## Defects that drove the change

1. Editing a whiteboard selected only the first linked goal/job/outcome, then overwrote all arrays with singletons. Add explicit link chips/removals and preserve untouched references.
2. Board dragging interpreted screen deltas as unscaled local coordinates. Convert both pointer positions through the existing inverse camera and use one normalized card mapping for render, preview and save. Freeze the original office and record revision during a gesture.
3. Card rendering used inconsistent clamps and heights. Derive usable geometry from the actual board/card dimensions; retain normalized persisted coordinates.
4. Capped board rendering made later records unreachable. Keep bounded rendering and add search and pagination.
5. A background snapshot could replace the global state hash while a form retained an older draft. Preserve immutable entity revision and explicit edit baseline; never rebase stale intent automatically.
6. Polling reads consumed the VS Code panel's lifetime mutation identity allowance. Retain a bounded history for completed reads, keep pending requests bounded, and preserve mutation deduplication separately.
7. Native work could execute without an independent helper, and execution completion could imply acceptance. Compile each logical step into actual primary and review jobs, then gate downstream work on a recorded review.
8. A failed iteration's terminal jobs were retained as success dependencies of its repair. Preserve attempt lineage and evidence without requiring failed work to become successful.
9. Reusing an inner job idempotency key with changed work returned an older job. Compare the semantic request digest and reject changed-body reuse.
10. MCP board/goal summaries omitted the IDs needed to edit the records, while text sanitization corrupted valid credential-like IDs. Add bounded, exact-scope metadata reads with identity-preserving projections and explicit omissions.

## Work and acceptance contract

A logical step keeps its canonical ID and primary employee, adds a distinct reviewer and optional reviewer service contract, and compiles to primary → review jobs. Dependencies between logical steps target accepted predecessor review gates. Review is the second phase of that same pair, so there is no infinite chain of reviewers reviewing reviewers.

Each settled artifact carries a digest. A managed reviewer returns bounded JSON containing `verdict`, `summary` and `evidenceRefs`. Actor IDs, leases, hashes and actual reading coverage come from the trusted worker, not from model output. A partial or redacted producer artifact cannot support accepted review. Missing or malformed review output preserves billed execution and artifacts, records a worker-only nonaccepting failure, blocks undispatched dependents and exposes an explicit bounded repair. Execution completion remains unaccepted until a native review verdict or nonaccepting failure receipt is confirmed. Interrupted or uncertain recording can require reconciliation; it never authorizes a repeated provider call. The failure path reconciles uncertain acknowledgements and cannot overwrite an already recorded verdict. Reviews have no write tools and cannot grant permissions. Native checks still control scopes, current employment, contracts and dispatch authority.

Pairing divides the existing logical-step token and dollar allowance; adding a reviewer does not double that allowance. Historical work remains historical and is never assigned a fabricated reviewer. A schema fence prevents older native software from silently dispatching the upgraded state as solo work. The separate legacy project executor retains records and artifact access, but production execution must move through an explicitly scoped paired office workflow.

Whiteboard, blueprint and roadmap revisions protect concurrent edits. A full blueprint save cannot delete a board added since the original draft. Donna's workflow creation is one atomic idempotent native transaction, with the complete source brief preserved in the durable goal and stable request identity retained until acknowledgement. An uncertain response is never permission to invent a new request identity or replay a provider call.

## ETA mathematics and presentation

Each phase may have optimistic, likely and pessimistic **duration estimates**, in minutes. These are separate from runtime limits, eligibility dates, budgets and owner targets. Missing estimates stay unknown. Values are finite and ordered, with the native contract's 0.01–1440 minute bound per phase.

For each duration scenario, a topological traversal computes the dependency-only finish of a logical item as the maximum predecessor review finish plus its production and review durations. The weighted scenario uses `(optimistic + 4 × likely + pessimistic) / 6` per phase and then traverses the DAG independently. Weighting aggregated extrema would produce a different result when the critical path changes and is not used.

The dependency result is a lower-bound scenario. The staffing result uses deterministic greedy scheduling with one active assignment per employee, including employees who produce one item and review another. It can be conservative and is not an optimized schedule. All employees are assumed available at the start; provider capacity, GPUs, working calendars, interruptions and unknown remaining effort are not inferred. These ranges are planning scenarios, not confidence intervals, promises or live progress measurements. No finish timestamp is fabricated without an explicit start/calendar model.

Forecasts use a bounded dependency closure in the accessible company projection. Filtering one department must not silently drop an otherwise accessible predecessor. Existing accepted work is excluded from remaining duration only when matching native review evidence establishes acceptance; a visual Done label alone is insufficient.

## Geometry, psychology and motion

Keep control labels literal: steward, primary, independent helper, awaiting review, changes requested, accepted, estimate unavailable. Preserve context while people edit: drafts survive refresh, stale edits explain the conflict, and focus returns to a meaningful control. Search, keyboard movement and explicit click controls complement dragging. Panel layout responds to its own available width rather than only the browser window.

Motion should explain a state change: short hover/focus/selection feedback, a visible pending save, and reversible drag previews. No looping animation implies progress. Respect reduced motion and stop gesture listeners, observers and animation work on cancellation, hiding, refresh or disposal. The existing renderer remains demand-driven.

Design references consulted:

- [Nielsen Norman Group — Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/): timely feedback and visible results of actions.
- [W3C — Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html): suppress nonessential interaction motion.
- [W3C — Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html): provide alternatives to dragging.
- [W3C — CSS Transforms Level 2, 3D rendering contexts](https://www.w3.org/TR/css-transforms-2/#3d-rendering-contexts): retain architectural depth while composing coplanar live forms in a predictable local stacking context.
- [GAO Schedule Assessment Guide](https://www.gao.gov/assets/gao-16-89g.pdf): distinguish dependency structure, resource constraints and schedule uncertainty. The implementation's weighted formula and greedy staffing scenario are declared modeling choices, not claims of GAO certification.

## Verification boundaries

Test real failure paths: same employee as reviewer, inactive or out-of-scope helpers, revoked contracts, stale drafts after refresh, duplicate request IDs with changed content, malformed review JSON, changed artifact bytes, partial reading, cycle/dangling dependencies, missing estimates, long labels, records beyond the render cap, zoom/tilt drag cancellation and long polling sessions. Include rejected writes and retained drafts in UI tests.

Use temporary native state, synthetic provider adapters and loopback-only runtime wiring. The user's stopped Vast instance stays stopped. No downloaded model, live ChatGPT MCP connection, billing reconciliation, trained MoE or physical GPU soak is implied by this acceptance. Screenshot/browser tests run in the supported CI browser with sandboxing enabled; local policy limitations are not bypassed.

Actual test counts, failures/corrections, source commits, screenshots and remaining gaps belong in `VALIDATION.md` after execution. This plan is not itself verification evidence.
