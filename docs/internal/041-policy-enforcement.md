# 041-policy-enforcement.md — Pass 4 report

## Scope

Pure authorization evaluator (`evaluateAuthority`), attempt-reservation helpers, the split queue select/lease seam, the trusted-host seam in `createChord`, the admit-gated `queueTaskPackets` flow, and the dispatch gate in the runtime loop. Design reference: `041-authority-design.md` §4 (evaluator) and §5 (dispatch/commit).

## What changed

### Contracts (`src/contracts/sigils.js`)

- `StoredTask` now nests `authority_binding: { ... }` (previously the authority fields were spread flat into the template, which mismatched the actual task records — this was the root cause of the `RegistryData`/`Snapshot` failures caught in this pass).
- `RegistryData` extended with `authority: object | null` and `pending_attempts: object`. Semantics: when non-null, `authority.run_id === run.run_id`; every pending attempt must map to a task in `status: "queued"`.
- `Attempt` contract already carried `authority_revision`; consumed at commit, not dispatch (see below).
- `Snapshot` unchanged (walk-disabled for `created_at` ISO vs `_at`-integer conflict, fixed in Pass 3).

### Pure evaluator (`src/platform/authorization.js` — new)

`evaluateAuthority({ stage, now, run, task, attempt, authority })` — deterministic, side-effect-free, no I/O/randomness/implicit time. Fixed failure order (first wins):

1. `INVALID_CONTEXT` (bad stage/now/run/task/authority shapes; null authority)
2. `SCHEMA_MISMATCH` (run/authority version incompatible)
3. `RUN_MISMATCH` (foreign run_id in authority or binding scope)
4. `TASK_CANCELLED` (cancelled beats everything after context validity)
5. `INVALID_TRANSITION` (stage-vs-status legality)
6. `STALE_ATTEMPT` (task_revision / lease / attempt_id mismatch)
7. `PRINCIPAL_INVALID` (missing or expired)
8. `ACTOR_INVALID` (missing, revoked, or principal mismatch)
9. `CAPABILITY_MISSING` (actor lacks binding capability; roles confer nothing)
10. `SCOPE_MISMATCH` (binding scope ≠ immutable stored task/run fields)
11. `EXPLICIT_DENY` (active matching deny grant beats allow)
12. `NO_ALLOW_GRANT` (no surviving allow grant)
13. `APPROVAL_REJECTED` / `APPROVAL_REQUIRED` (approval gates at dispatch/commit)
14. `ALLOW`

Stage-specific rules:

- **admit**: permission only; ignores approval requirement. Denial leaves task unqueued.
- **dispatch**: requires unexpired allow grant; approval-required tasks deny (`APPROVAL_REQUIRED`) unless an exact, unconsumed, approved approval for the prepared attempt exists. Denial returns `{ok:false, code, denied:true}` with no lease and no adapter call.
- **commit**: re-checks only the dispatch-selected grants and approval (nothing retroactively substitutes); `authority_revision` staleness is checked at commit, not dispatch (installing an approval legitimately advances authority between prepare and dispatch); lease must be unexpired; approval consumption is kernel-owned.

`authorityError(code)` helper for consistent error shape (`code`, `path: "$"`).

### Attempt reservation (`src/platform/attempts.js` — new)

- `prepareAttemptRecord(registry, task)`: idempotent per queued task; returns existing pending attempt or creates a new one (attempt_id, queue_id, task_revision, authority_revision snapshot, empty grant_ids/approval_id, lease_expires_at 0).
- `invalidatePendingAttempt(registry, taskId)`: deletes and returns the prior reservation (for cancel/dead-letter).
- `assertTaskAuthorityBinding(binding)`: contract assert wrapper.

### Queue select/lease split (`src/platform/task-queue.js`)

- `selectReadyTask(registry, now)` (pure selection, no mutation) + `leaseTaskEntry(entry, now, durationMs)` (mutation) extracted from `dequeueReadyTask`.
- `dequeueReadyTask` kept as select+lease for back-compat.
- `enqueueTask` and `scheduleTaskRetry` now accept `{ now }` so the trusted-host clock is used instead of `Date.now()` when a custom clock is installed (fixes a real bug where queue `available_at` was set from wall-clock while `runCycle` read from the host clock, causing spurious `no_ready_task` skips in the approval test).

### Trusted-host seam (`src/sdk/chord.js`)

- `createChord({ trustedHost: { now, authoritySnapshot } })`.
- `hostNow()`: samples the host clock; backward movement fails closed (`INVALID_CONTEXT`); monotonic `lastNow` guard.
- `setAuthoritySnapshot(snapshot, { expectedAuthorityRevision })`: monotonic `authority_revision` (first install is 0, subsequent must be `current + 1`, else `STALE_REVISION`); foreign run → `RUN_MISMATCH`; version → `SCHEMA_MISMATCH`; merges kernel-owned approval consumption (a snapshot swap may not reset `consumed_by_attempt_id`).
- `installGrants(grants)`: contract-asserts each grant, rejects duplicates, foreign-run scope, bumps authority revision.
- `queueTaskPackets(packets, { principal_id, actor_id, capability, issueGrants, approval_required, priority })`: validates host arguments, samples `hostNow()` before any mutation, installs grants via the trusted `issueGrants(packets)` callback (exact task-scoped grants created after packet IDs exist), builds `TaskAuthority` bindings (scope derived from immutable packet fields), evaluates admit for every packet before any registry mutation, then registers + enqueues.
- `registerSpecAndQueue(spec, queueOptions)` = register + create packets + queue.
- `prepareAttempt(taskId)`: validates task is queued, returns a deep clone of the pending reservation.
- `getAuthority()`, `getRunRevision()`, `_invalidatePendingAttempt(taskId)` exposed for tests/host.

### Dispatch gate (`src/platform/runtime-loop.js`)

- `runRuntimeCycle` order: `selectReadyTask` → adapter check → `prepareAttemptRecord` → `evaluateAuthority("dispatch")`.
- On denial: `dispatch_denied` event, `{ok:false, code, denied:true}`, no lease, no adapter, task stays queued, no revision bump.
- On allow: lease, attempt update (lease_expires_at, authority_revision, grant_ids, approval_id), `task.status = "running"`, `run.revision += 1`, approval consumption (kernel-owned), `task_dispatched` event, then adapter execution.
- `scheduleTaskRetry` calls pass `{ now }` so retry backoff uses the host clock.

### Test fixtures (`tests/fixtures/host.js` — new)

- `installHost(chord, { approvalRequired })`: installs a baseline authority snapshot (service principal + human approver + agent actor with `execute` capability), returns `{ principal_id, actor_id, human_id, capability, issueGrants }`.
- `grantFor(chord, packet, overrides)`: builds an exact task-scoped allow grant.
- `queueOptions(host, extra)`: spreads host arguments for `queueTaskPackets`.

### Tests

- `tests/authorization.test.js` (new): pure evaluator matrix (admit/dispatch/commit, failure-order first-wins, determinism, principal/actor/capability gates, roles-confer-nothing, scope equality, deny-beats-allow, expiry boundary, approval selection/consumption, commit re-check semantics) + trusted-host integration (missing authority denies admission, foreign-run grants never install, monotonic revisions, clock rollback fails closed, approval-required task never reaches the adapter, approval enables exactly one dispatch).
- `tests/hardening.test.js`, `tests/contracts.test.js`: updated for the binding/host flow and contract-valid fixtures; error-code assertions tightened to fixed codes (`INVALID_SHAPE`, etc.).

## Design decisions locked in code

- `attempt.authority_revision` staleness is checked at **commit**, not dispatch. Installing an approval advances authority between prepare and dispatch; that is legitimate and must not invalidate a prepared attempt.
- `hostNow()` is sampled **before any mutation** in `queueTaskPackets` (clock rollback fails closed with `INVALID_CONTEXT` before any registry write).
- The Approval contract constrains `consumed_by_attempt_id` to `null` or the approval's own `attempt_id`; therefore an approval consumed by a *different* attempt cannot pass `AuthoritySnapshot.check`. The `STALE_ATTEMPT` branch for consumed-by-other in the commit re-check is unreachable through contract-valid input and is treated as defense-in-depth, not a tested path.
- Expiry semantics: a grant/approval/principal is active iff `issued_at <= now < expires_at && revoked_at === null` (boundary equality at `expires_at` is inactive).

## Verification

- `bun test` (in `packages/core`): 54 pass, 0 fail, 370 expects.
- `npm test`: same suite.
- `bun run src/verify-runtime.js`: exit 0, all validations passed.
- `bun run src/demo/callaback-demo.js`: exit 0, full SMS → classification → notification flow with audit.
- `npm pack --dry-run`: clean, 40 files, no leakage.
- `npm run lint`: NOT AVAILABLE (no lint script defined).

## Files

- `src/contracts/sigils.js` — StoredTask nesting fix, RegistryData authority/pending_attempts.
- `src/platform/authorization.js` — new pure evaluator + authorityError.
- `src/platform/attempts.js` — new attempt reservation helpers.
- `src/platform/task-queue.js` — select/lease split, host-clock threading.
- `src/platform/runtime-loop.js` — dispatch gate, host-clock threading.
- `src/sdk/chord.js` — trusted-host seam, admit-gated queue, grant installation.
- `src/execution/results.js` — `registerTaskPacket(s)` take binding(s).
- `src/registry/registry.js` — `registerTask(registry, packet, binding)`.
- `src/verify-runtime.js`, `src/demo/callaback-demo.js` — host-fixture flows.
- `tests/fixtures/host.js` — new host/grant/queue fixtures.
- `tests/authorization.test.js` — new evaluator + integration tests.
- `tests/hardening.test.js`, `tests/contracts.test.js` — compatibility updates.
