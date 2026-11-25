# Native backend and ownership review — 2026-11-24

## Outcome

The native backend now supports editing employee names, role definitions and skill references, and renaming offices and departments, with the existing scoped authority, audit, receipt and persistence controls. Donna and scope-assistant ownership are validated on restored state as well as protected during lifecycle commands. No private company state or provider account was changed during this review.

## Defects repaired

1. **Missing definition-management commands.** Hiring, firing and pausing existed, but changing a saved employee role or renaming an office/department did not. Added `update_employee`, `rename_office` and `rename_department`; all are available through the native remote-command protocol and require scoped `team.manage` when delegated.
2. **Incomplete restored ownership validation.** Previously, an assistant pointer only needed to reference an existing employee. A malformed restored snapshot could substitute a specialist, a foreign company assistant or a fired/scoped Donna. It now requires global permanent Donna and exact company/office/department assistant ownership. Paused assistants and all valid existing schema-version-1 data remain supported; corrupt ownership fails explicitly without resetting stored state.
3. **Stranded employee work.** Firing cancelled only queued/running jobs; budget-waiting and already-paused work could remain nonterminal. Firing now cancels all unfinished dispatch states, and pausing also parks budget-waiting work. Completed evidence and in-flight cost settlement remain intact.
4. **Repeated hierarchy scans.** Identity checks now reuse employee, office and department lookup maps during validation, avoiding a full office/department scan per employee or job. The maximum staff registry is covered by a synthetic 30,000-employee test.
5. **Admission checks applied to paid in-flight work.** Independent review of the worker's new live-authority polling found that `check_worker_authority` reapplied global admission checks to already reserved calls. A reservation filling the global cap, or a later global dispatch pause, could incorrectly stop its own request. A valid running, unsettled reservation now skips only the global admission checks. It still checks current grants, hierarchy, employee state, service contracts, explicit knowledge grants and the current lease. New/unreserved work still obeys global pause and budget admission.

## Contracts

`update_employee` accepts only `action`, `employeeId` and one or more of `name`, `role`, `skillPaths`. It validates the complete edit before mutation and rejects scope, kind, status, assignment-key and other unknown fields. A role/skill change does not change grants or tool access. It permits active or paused definitions and keeps fired definitions immutable. Empty skill arrays explicitly clear references.

Renaming preserves IDs, ownership, child relations, grants and work references. Direct repeat edits report `changed: false`; remote replay also retains exactly one authority-ledger effect. Department removal continues to use a retained pause, and permanent assistants cannot be fired. Reparenting, grants and employee lifecycle remain explicit commands.

## Validation

The unmodified checkout passed 95 native tests. The updated checkout passed **107 native tests, zero failures**, including twelve additional tests covering:

- Metadata changes preserving scope, identity, grants, assignment keys and lifecycle.
- Invalid/unknown field rejection without partial employee changes, plus terminal fired definitions.
- Editable permanent assistant definitions without loss of ownership.
- Restored Donna corruption, cross-scope assistant pointers and specialist substitution.
- Department-scoped delegation, denied out-of-scope edits and revocation.
- Office/department renaming preserving ownership, references and derived index names.
- Durable remote replay after JSON roundtrip and mismatched payload rejection.
- Firing of queued, budget-waiting and paused work while retaining completed history.
- Validation/indexing at **30,000 saved employees**, capacity rejection and duplicate Donna rejection.
- A reservation that exactly fills the global USD and token caps remaining authorized before its first dispatch while subsequent claims are blocked.
- A reserved call surviving a later global cap decrease/dispatch pause while grant expiry, revocation and actual scope/employee pauses still stop authority.
- An unreserved running claim remaining blocked by a later global dispatch pause.

The existing **16,000-level department hierarchy** test, native lock/persistence tests, expiry/revocation tests, budget-settlement tests and remote conflict tests also passed.

Executed with Rust 1.97.0 and the repository's unchanged Cargo lockfile:

```bash
cargo test --locked --offline --manifest-path native-core/Cargo.toml
cargo build --release --locked --offline --manifest-path native-core/Cargo.toml
npm --prefix desktop-shell run build:native
```

The task used a separate Cargo cache after downloading the locked dependencies. Tests use synthetic or repository preview state. This report does not claim a private owner-device migration, paid model call, production load test or cross-platform package acceptance. The integration review records separate desktop, MCP, cloud, editor and transport results.

## Sources changed

- [Staff management implementation and regressions](../native-core/src/staff_management.rs)
- [Office lifecycle, indexed validation and routing](../native-core/src/office.rs)
- [Scoped authority mapping](../native-core/src/authority.rs)
- [Remote command allowlist](../native-core/src/remote_commands.rs)
- [Native API and lifecycle documentation](../native-core/README.md)
