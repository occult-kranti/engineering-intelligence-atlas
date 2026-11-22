I reviewed the supplied source read-only. I did not execute the code, and I only report defects I can trace through the given functions.

**Confirmed findings**

1. **`mountRelief3D` / `fail()` → `disposeGpu(true)` → `renderer.forceContextLoss` path, and `onRestored()`**
   Sequence: `webglcontextlost` fires → `onLost` sets `lost = true`, calls `fail('context lost', true)`. `fail` with `retainForRestore = true` does not dispose. On restore, `onRestored` calls `disposeGpu()` (no releaseContext) and then `buildGpu()`. `buildGpu` re-creates `canvas` only if missing, but `canvas.getContext('webgl2', …)` returns the same canvas context and `new THREE.WebGLRenderer({ canvas, context: gl })` is built again. The `restoredOnce` guard means a second loss only reaches `fail(...)` with no restore path, which is intended. However, `onLost` checks `if (destroyed || (failed && !lost)) return;` and `fail()` sets `failed = true` before the handler's `lost` assignment is consumed, so a context lost while `failed` is already true from a prior init failure is ignored, leaving stale `lost` state. Repair: in `onLost`, drop the `(failed && !lost)` guard and always set `lost = true` when `!destroyed`; test by simulating `buildGpu` failing then dispatching `webglcontextlost`.

2. **`mountRelief3D` / `setCamera` movement threshold**
   `selectionDirty` is set only when `moved || scene`, and `scene` is non-null whenever content exists, so every `setCamera` marks selection dirty; the `moved` heuristic is therefore dead for rendering but also means `origin` changes are compared against `nextOrigin` before `camera` is updated. Behavior is correct but wasteful; it is not a user-visible defect. No repair required beyond removing the redundant condition.

3. **`mountImprovementPanel` / `noteScope.onchange`**
   Sequence: user edits draft (`noteDirty = true`) → changes scope select → handler checks `noteDirty || sessionDirty || controller.pending()`, shows error and calls `renderScope()`. `renderScope` calls `choices(noteScope, …, previous = node.value)`, which restores the previously selected value only if it is still in `entries`. Because `scope` has not changed, the select reverts correctly. No defect confirmed here.

4. **`mountImprovementPanel` / `save()` with `sent = command ?? controller.pending()?.command`**
   When `save()` is called with no argument from the retry button after an *uncertain* outcome, `controller.dispatch(undefined)` resends the original pending body, which is correct. But after success, `sent` is taken from the pending command captured *before* dispatch; for a successful `upsert_sticky_note` the code calls `editNote(saved, true)`, which replaces `base` and `noteId`, while the retried request's `expectedRevision` was the old value. This is consistent with the stored body. No defect.

5. **`mountImprovementPanel` / `resetNote()` → `saveNote()` create path**
   `resetNote` sets `noteId = newOwnerId('note')` on every reset. If a save for a *new* note is uncertain and the user then clicks "+ Note", `resetNote` checks `controller.pending()` and refuses, so the request identity is preserved. Confirmed correct.

6. **`projectStickyNotes` (`notes.ts`) / office-level notes in member mode**
   Notes with `departmentId` resolve `target` via `nodes.find(...)` where `n.kind === 'room' || n.kind === 'department'`. In member mode `plans` is keyed by `n.kind === 'office'` nodes; the `nodes.find` for a department note still requires a matching `companyId`, `officeId` and `departmentId` but does not verify the node belongs to the same member scope. A department note whose department room is absent falls back to `omitted++` correctly. No cross-scope leak confirmed.

7. **`verifiedAcceptance` (`telemetry.ts`)**
   Checks `review.primaryArtifactComplete === true`, both hashes, paired identities and timestamps not before finish. The `p.reviewFailure` check is on the primary only; a completed review with `r.reviewFailure` is rejected. Acceptance requires `review.verdict === 'accepted'`. No stale acceptance path confirmed.

8. **`buildImprovementTelemetry`, activity vs. loaded counts**
   `summary.leasedRunning` is `fresh ? 0 : null` and `executing` is `executionFresh ? 0 : null`. `running` counts only jobs with a callback-confirmed `started` time ≥ job `startedAt`. Loaded employees are not counted as running. Confirmed the metrics separate loaded, recorded, leased and executing.

**Limitations.** I did not read `freeflow/scene` builder, `camera.ts`, `relief-math.ts`, `studio` wiring or the native command handlers; any defect depending on them is out of scope. The office/company blueprint placement math in `notes.ts` depends on the `SceneNode` rect contract that was not supplied, so I make no claim about it beyond the in-file checks.

**Summary:** One confirmed defect (finding 1, context-loss guard ordering in `relief3d.ts`). The remaining items were examined and either behave correctly from the supplied source or are only inefficiencies (finding 2). Nothing else is confirmed.