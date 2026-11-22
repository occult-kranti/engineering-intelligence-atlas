# Native improvement mode contract

Run `improvement-mode-20261122`; node `host_core`; attempt 2. Parent/root is termination owner and independent reviewer. Baseline `249a719`. This records the implemented native interface. Test evidence is recorded separately in native-handoff.json and native-full.log.

## Versions and common mutations

Outer workspace schema remains 1. Office schema is 3; existing 1/2 records migrate without fabricating sessions, permissions or spending. Old office-2 binaries reject office-3 state. New fields have empty/null defaults on legacy load.

Every owner mutation below requires a stable `requestId` (safe canonical ID, maximum100 ASCII bytes). Receipts retain the canonical command hash and result. Metadata-only improvementReceipts are included in both native and TypeScript cloud projections for exact website acknowledgement and CAS hashing. Same ID/body replays its receipt; changed body conflicts. Entity updates require `expectedRevision`; new entities require0. No silent receipt eviction; maximum 4,096 owner mutation receipts. Internal ticks are not owner mutations and are idempotent through the persisted active goal/cycle identity.

## Sticky notes

```ts
type StickyColor = 'yellow'|'blue'|'green'|'pink'|'purple'|'gray';
interface OfficeStickyNote {
  id:string; revision:number; companyId:string; officeId:string;
  departmentId:string|null; kind:'comment'|'todo'; color:StickyColor;
  text:string; status:'open'|'done'|'archived'; ownerEmployeeId:string|null;
  goalIds:string[]; x:number; y:number; createdAt:string; updatedAt:string;
}
```

`upsert_sticky_note` takes `{requestId,id,expectedRevision,companyId,officeId,departmentId,kind,color,text,status,ownerEmployeeId,goalIds,x,y}`. Text is1..4000 UTF-8 bytes, x/y are finite normalized0..1, and at most100 linked native goals must match the note company and selected scope. Company/office/department identity is immutable after creation. Owner is stewardship, never an execution grant. Comments and checklist state are annotations, not review acceptance.

`archive_sticky_note` takes `{requestId,noteId,expectedRevision}`. Archived records remain for historical links. A todo referenced by a frozen session backlog cannot change kind (NOTE_KIND_IMMUTABLE); a separate comment can be created. Office note goal links must resolve inside that office; department notes additionally require that exact department. Maximum2000 notes. Editing/archiving an in-flight source does not mutate its frozen goal; automatic completion changes a note only if its revision still matches that cycle's captured revision.

## Immutable parent allowance

```ts
interface ImprovementAllowance {
  id:string; capUsd:number; carriedObservedUsd:number;
  carriedEstimatedUsd:number; sourceReference:string; createdAt:string;
}
```

`register_improvement_allowance` takes `{requestId,id,capUsd,carriedObservedUsd,carriedEstimatedUsd,sourceReference}`. It creates one immutable singleton; no replacement, raise, reset or deletion operation. `0<capUsd<=20`, nonnegative finite carried amounts, sum<=cap. A repeated request has normal receipt semantics. The development ledger is separate: no application import/spend is inferred automatically. An owner may supply a reviewed, nonduplicated carry checkpoint.

This allowance is an additional ceiling. Existing global policy and all its historical accounting remain unchanged and can be stricter (default global cap is10). Paused/cancelled/new sessions reference the same parent forever. Parent committed totals include all its sessions' observed, estimated, reserved and held costs plus carried commitments. Any uncertain parent cost blocks automatic new cycles; it is not silently released or called actual billing. This version has no owner cost-reconciliation command: it deliberately stops and retains the estimate. Explicit reconciliation is a remaining capability, not an automated recovery claim.

## Derived native budget view

Snapshot `improvementBudget` is null before allowance registration and otherwise exposes `{capUsd,carriedObservedUsd,carriedEstimatedUsd,observedUsd,estimatedUsd,reservedUsd,heldUsd,committedUsd,remainingUsd,effectiveRemainingUsd}`. The carried fields are separate from retained job totals. Committed sums both carries plus observed, estimated, reserved, and held amounts. Remaining is the parent remainder; effective remaining is the smaller parent/global remainder. Native records recompute these fields; renderer sums are not authoritative.

## Sessions and route selection

```ts
interface AllowedImprovementRoute {
  provider:'anthropic'|'openai'|'ollama'; model:string;
}
interface ImprovementRoute extends AllowedImprovementRoute {
  priceRates:{inputUsdPerMillion:number;outputUsdPerMillion:number};
  source:string; observedAt:string; expiresAt:string;
  maxInputTokens:number; catalogSha256:string;
  costBasis:'standard-token-rates';
}
interface OfficeImprovementSession {
  id:string; revision:number; companyId:string; officeId:string;
  departmentId:string|null; allowanceId:string; title:string; objective:string;
  primaryEmployeeId:string; reviewerEmployeeId:string;
  serviceContractId:string|null; reviewerServiceContractId:string|null;
  runSettings:OfficeGoalRunSettings; allowedRoutes:AllowedImprovementRoute[];
  continuation:'until-budget'|'backlog'; maxCycles:number|null;
  taskNoteIds:string[]; cycle:number; activeGoalId:string|null; goalIds:string[];
  activeNoteId:string|null; activeNoteRevision:number|null;
  status:'paused'|'active'|'waiting-work'|'waiting-budget'|'needs-review'|'completed'|'cancelled';
  stopReason:string|null; recentArtifactSha256s:string[];
  createdAt:string; updatedAt:string;
}
```

`create_improvement_session` takes `{requestId,id,expectedRevision:0,companyId,officeId,departmentId,allowanceId,title,objective,primaryEmployeeId,reviewerEmployeeId,serviceContractId,reviewerServiceContractId,runSettings,allowedRoutes,continuation,maxCycles,taskNoteIds}`. Creation is paused. All scope/pair/run settings and allowed routes freeze at creation. At most16 allowed routes,128 todo IDs,256 sessions. `maxCycles` is null by default; if explicitly supplied it is1..1000 and reaching it pauses with `cycle-limit`, not budget exhaustion. Existing native job/goal/receipt capacity remains a hard independent stop. Objective and backlog may both be empty when saving a session; until-budget then waits visibly for scoped work without dispatching a dummy call.

Provider mode and the explicit existing authorization/runSettings contract are required. Initial runSettings rates may be null and its provider/model names the first allowed route as a placeholder only; native tick freezes a current validated quote before any cycle. Distinct primary/reviewer must be currently authorized for the exact office/department and applicable service contracts. This operation never creates grants, hires staff, selects a model, configures policy or starts the worker. `allowedRoutes` fixes permitted provider/model identities; runtime discovery and configured credentials do not enlarge it.

`control_improvement_session` takes `{requestId,sessionId,expectedRevision,operation:'start'|'pause'|'resume'|'cancel',reason?:string}`. Cancel is terminal and marks its active goal needs-review/owner-cancelled; later checkpoint sync preserves that owner cause. Pause prevents new dispatch and retains unspent holds; dispatched calls may settle. Restart resumes durable state, never repeats an uncertain call. Resuming does not repair failed work or change scope/budget; deliberate replacement work needs an explicit new session/attempt with the same parent.

`tick_improvements` is worker-only: `{sessionId,selectedRoute:ImprovementRoute}`. At most one active paired cycle per session. Selection must match an allowed route. Quote fields are persisted on both jobs as `improvementRoute`; quotes must be current when creating/reserving/dispatching. Hosted rates must be positive; local Ollama rates are zero. `maxInputTokens` bounds the whole logical pair's maxTokens conservatively, including the100000-token price-tier threshold where applicable. No hardcoded or guessed model selection or pricing. Expired/invalid quote blocks dispatch without substituting a model or changing a prior job.

Each tick first reconciles the current native pair. Only an accepted exact-artifact review can advance. Failed/revised/blocked/uncertain work stops visibly in `needs-review`; no automatic retry. Identical recent complete delivered-body digests (bounded last32) stop as repeated output, even when cycle/context headers make the artifact file hashes different. The legacy-named recentArtifactSha256s field holds these deliverable digests. A settled accepted improvement producer without a deliverable digest stops in needs-review/missing-deliverable-digest; its billing and review evidence are retained. This is a deterministic repetition guard, not proof of semantic novelty.

Then choose the next open, matching-scope todo from frozen taskNoteIds. If no todo is available and continuation is until-budget with an objective, create a scoped study rotating deterministically through research/company/UX/graphics/setup and include the previous accepted review as a dependency. Prior accepted producer evidence travels through the existing native worker handoff. New context is a changed focus/cycle and actual prior evidence, not a new authority grant. Backlog mode completes only its finite backlog. Until-budget waits when there is no scoped objective/work; capacity/global admission/uncertainty are identified as their actual stop reasons. It never marks a capacity limit as spent budget or spends dummy requests merely to reach20.

## Jobs, holds and claims

Jobs add nullable `improvementSessionId`, nullable `improvementRoute`, nullable `deliverableSha256`, and nonnegative `budgetHoldUsd` default0. Trusted finish_job accepts deliverableSha256 as an optional exact SHA-256 of the complete delivered model text, excluding bookkeeping headers. The separate artifactSha256 still binds the full artifact file for paired-review integrity. Legacy ordinary work may omit the new digest. Goals add nullable `improvementSessionId`. These identifiers are assigned only by native tick; public enqueue cannot manufacture them. Ordinary goal-edit/advance APIs cannot mutate or spawn untagged work under a session-owned goal. Direct approve/resume of an owned job is also denied; session controls preserve the immutable contract.

Creating a cycle is one cloned atomic native transaction: goal + logical step + primary/review jobs + both phase holds + session pointers + note link. Use the existing60/40 token/USD split. Pair maxUsd is bounded by the frozen requested limit and the selected quote's conservative full-token upper bound. Hold both phases before either can run, counted in global and parent commitment totals. A reservation replaces only that job's hold; its reviewer hold remains. Failed preflight and undispatched cancellation release only unspent holds. Unknown/dispatched reservations retain conservative accounting. Existing global and session admission both apply before reserve and before worker capability dispatch. At an exactly funded cap, an existing hold/reservation can proceed while another admission cannot. A positive managed settlement without reservation or above its reservation is recorded truthfully, pauses global new dispatch, and puts noncancelled work in needs-review; cancelled work remains terminal. `OfficeBudget.heldUsd` exposes held commitments separately from actual cost.

`claim_job` accepts optional `improvementSessionId`. Without it, session-owned jobs are excluded. With it, only that session's active, currently authorized jobs can be claimed. The session worker ID is `improvement:<sessionId>`; a session tag without that matching identity is denied. The parent owner credential still operates the trusted runtime; this is policy separation, not independent tenant authentication.

## Runtime activity versus loaded state

Add optional worker status:

```ts
execution?: { sampledAt:string; activeCalls:Array<{
  jobId:string; phase:'provider'|'model'; startedAt:string
}> };
```

Runtime populates this only around the actual generation callback; UI additionally checks the current native lease. Native running/lease alone means claimed/preparing, not proof of inference. A loaded model is separately observed inventory. Neither state asserts real hardware utilization. Session artifacts are text/review evidence; repository edits require existing explicit tool/publish capability and observed results.

## Counterreview and tests

Mandatory coverage: schema1/2 migration and old-version fence; note creation/update/archive CAS and receipt collisions; same-scope links and roles; singleton budget immutability; concurrent session holds at the last available dollars; global stricter cap; uncertain commitments; default/wrong/session claim filtering; pause/cancel/restart with in-flight settlement; pair creation rollback on capacity/scope/quote failure; quote expiry and frozen candidates; accepted review advancement only; prior evidence dependency; repeated output and explicit capacity waits; optional bounded-cycle pause; no implicit spending/permission/policy changes.

## Implementation limits

No provider, model, GPU, repository, or infrastructure execution occurred in these native tests. Provider fixtures settle synthetic usage; the 101-cycle local-route test proves native control continuity, not real model quality or hardware endurance. Actual outputs are reviewed text artifacts. An accepted matching source note may be marked done and linked to its goal; no generic worker-authored note-content application API or automatic repository editing is added here. The repetition guard compares exact delivered-model-body SHA-256 digests in the last 32 producer results, not full wrapper-file hashes or semantic novelty. Runtime must compute the body digest from delivered text; native does not independently read artifact files. Goals/jobs/checkpoints/owner receipts remain bounded, and a capacity stop is not budget exhaustion. The trusted owner/native adapter supplies quotes; native validates bounds, immutable candidates, and expiration but does not independently fetch provider pricing or authenticate a second tenant.
