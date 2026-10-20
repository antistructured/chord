# 041-adversarial-matrix.md — Pass 6 report

## Scope

Adversarial test matrix for the authority model (design reference: `041-authority-design.md` §7 "Required tests"). This pass adds tests and one product fix; it does not extend the design. No dependency, export-layout, or package-version change.

## What was verified

New `packages/core/tests/adversarial.test.js` (34 tests, 138 assertions) plus a small host fixture (`createAdaptiveAuthority` in `tests/fixtures/host.js`). Coverage maps directly to the design's required-test list:

### Authority boundary and identity forgery
- Request-authored `authority` maps, `role: "admin"`, and self-declared `requested_action` confer nothing; a structurally valid host context with no grant is denied at admission.
- Role names never substitute for capabilities; exact capability identifiers required (no prefix/case match); nonidentifier capability strings (`"build*"`, whitespace, control chars) are rejected at the contract layer before the evaluator sees them.
- Capability alone without a grant is `NO_ALLOW_GRANT`; missing host authority denies every stage.
- Cross-principal actor binding is `ACTOR_INVALID`; the snapshot contract independently rejects an actor whose principal is absent.
- A caller-supplied `{ allowed: true }` object is ignored; decisions are recomputed from live authority (no replayable token).

### Scope, version, run isolation
- Valid-but-non-matching scopes (`project`/`phase`/`target_entity`) and artifact-kind resources yield `NO_ALLOW_GRANT`.
- Scope shapes that violate the grant's own invariants (`run_id ≠` snapshot run, `task` resource id ≠ `task_id`) are rejected by the contract before evaluation.
- Version mismatch → `SCHEMA_MISMATCH` (run, task, authority); foreign run → `RUN_MISMATCH` (authority and binding scope).

### Temporal and revocation boundaries
- Grant window is `issued_at <= now < expires_at` at exact boundaries (`now == expires_at` denies); future-issued grants inactive until `issued_at`.
- Principal authentication/expiry and actor revocation disable access immediately; revoked grants drop out.
- Contract rejects nonpositive windows (`issued_at == expires_at`).

### Deny/allow ordering permutations
- An active matching deny beats every allow in all array orderings; a non-matching deny does not block a matching allow.
- `grant_ids` sorted deterministically regardless of array order; identical input bytes + time yield identical decisions.

### Approval misuse permutations
- `approval_required` dispatch needs an exact, unconsumed, active approval bound to the attempt; wrong attempt, consumed, wrong task revision, expired, and revoked approvals each deny.
- Explicit rejection wins over a present approval (`APPROVAL_REJECTED`).
- Self-approval is structurally impossible (approver ≠ executing principal; non-human approver rejected by snapshot semantics).
- Admit grants permission without approval; dispatch gates on it; commit requires the dispatch-selected approval consumed by this attempt.
- A newly added grant cannot retroactively authorize an attempt (`STALE_ATTEMPT` on authority-vector drift).

### Runtime boundary enforcement
- Admission denial writes nothing (no task, no queue entry); dispatch denial performs zero adapter calls and no lease, leaving the task queued.
- Batch admission is atomic: a single denial registers no member.
- Duplicate admission / re-registration of an existing id rejects (`INVALID_SEMANTICS`); duplicates within one batch reject.
- Stale `expectedRevision` is `STALE_REVISION`; an in-flight commit loses to a concurrent same-revision mutation and becomes `uncertain` without committing.
- No registry/authority write handle leaks to adapters: the context carries correlation fields only; the dispatched packet is deep-frozen and mutation attempts cannot alter state.
- An adapter-authored correlation id (`task_id`/`attempt_id`) is rejected → `uncertain`; malformed adapter results never normalize to success or dead-letter.

### Approval gate end to end
- Approval-required task is denied at dispatch (`APPROVAL_REQUIRED`, zero adapter calls) until the host installs a human approval for the prepared attempt, then completes and consumes it.
- Explicit host rejection blocks dispatch permanently.
- An approval for a different attempt does not authorize dispatch.

### Contract hardening regression
- Accessors are rejected without evaluation; cycles and inherited prototypes rejected; duplicate identifiers rejected.

## Product fix found by this pass

**F5 — adapter packet freeze defeated by re-validation.** `runRuntimeCycle` deep-froze the packet before calling `executeTask`, but `executeTask` re-asserts the packet (`assertTaskPacket` clones), so the adapter actually received an *unfrozen* clone. Design §5 step 3 requires the adapter to receive a deep-frozen cloned packet. Fixed by moving the freeze into `executeTask` immediately after its own validation (`src/execution/task-packets.js`), so the guarantee holds for every caller. The runtime's own pre-freeze is retained as defense-in-depth. Regression covered by the "no registry or authority write handle leaks to adapters" test.

## Design clarifications recorded (no code change)

1. Several "scope mismatch" and "capability" inputs are rejected at the **contract layer** (`INVALID_CONTEXT` from the evaluator, or a snapshot `check` failure) rather than reaching a `NO_ALLOW_GRANT`/`CAPABILITY_MISSING` decision, because they violate the record's own invariants (e.g. `*` in an identifier, `task` resource id ≠ `task_id`, actor principal absent, grant/actor principal mismatch). Tests assert the correct layer for each case.
2. An in-flight commit that races a mutation which also advances the **authority** revision surfaces the evaluator's `STALE_ATTEMPT` before the runtime's own `STALE_REVISION` guard. Both are correct staleness signals; the test accepts either.

## Test and command evidence (actual output)

```text
$ bun test                       (packages/core)
 113 pass / 0 fail / 983 expect() calls   [adversarial + contracts + hardening + transitions + host fixtures]

$ bun run src/verify-runtime.js  (packages/core)
 🎉 ALL RUNTIME VALIDATIONS PASSED!   exit 0

$ bun run src/demo/callaback-demo.js
 === DEMO COMPLETE ===                exit 0
```

Test files: `adversarial.test.js` (34), `transitions.test.js` (25), `contracts.test.js` (existing + edits), `hardening.test.js` (existing + edits) — 5 files total.

## Blockers / next readiness

None. Block 2 is functionally complete through Pass 6. Outstanding non-blocking items: whole-run `commitRun` clone-swap CAS and per-operation `expectedRevision` enforcement remain Block 3 per `040-preview-scope-lock.md`; the truthful-docs/examples pass is the remaining Block 2 item in the design's §7 pass order.
