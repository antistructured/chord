# 041-transition-guards.md — Pass 5 report

## Scope

Guarded task/queue/artifact/domain state transitions, post-dispatch ambiguity handling (`uncertain` instead of blind retry), commit-stage re-evaluation with a dispatch-saved run-revision guard, attempt lifecycle ownership (`pending_attempts` → `active_attempts`), fresh-admission replay, explicit host `cancelTask`, lease-cap preflight, and in-flight snapshot import reconciliation. Design reference: `041-authority-design.md` §5 (state commit), §4 (host methods), §6 (import). CAS `expectedRevision` parameters remain scoped to Block 3 per `040-preview-scope-lock.md`; the `expectedRevision` arguments added here to `cancelTask`/`replayTask` are optional pass-throughs, not the full per-operation CAS.

## What changed

### Transition module (`src/platform/transitions.js` — new)

Single source of truth for every kernel state edge. Violations throw `authorityError("INVALID_TRANSITION")` (authority error space, not the fixed contract-error codes).

- **Task graph** — design-minimal edges (`queued -> running | blocked | cancelled`, `blocked -> queued | cancelled`, `running -> completed | failed | uncertain | cancelled`) plus the two contract statuses the kernel owns: `leased` (dispatch reservation, `queued -> leased -> running`) and `dead_letter` (bounded pre-dispatch retry sink, exit only via replay). `running -> blocked` was added because a valid adapter result may report `blocked` and the design graph already grants `blocked -> queued` as an exit — without the entry edge that exit is unreachable. Terminal: `completed`, `failed`, `cancelled`. `uncertain` exits only through explicit host reconciliation (`queued | completed | failed | cancelled`); `dead_letter` exits only `queued`.
- **Queue-entry graph** — entries sit `leased` while the task runs; post-dispatch outcomes land directly on `completed | failed | blocked | cancelled | uncertain`.
- **Artifact graph** — unchanged shape (`declared -> produced|accepted|rejected|superseded`, `produced -> accepted|rejected|superseded`, three terminals), now enforced at every mutation site.
- **Domain guard** — domain states are open strings (declared per-spec), so only result-derived transitions are guarded: next must be `complete | blocked`, `complete` is terminal, same-state is an idempotent no-op.
- `markTaskUncertain(registry, taskId, { reason })` — the single ambiguity entry point: guarded `running -> uncertain`, queue sync, clears both attempt maps, bumps `run.revision`, journals `task_uncertain`. If the task already reached a terminal state mid-await (cancellation won), nothing is mutated; the late result is journaled as `task_result_ignored`. Reasons are sanitized to `[A-Z0-9_]{1,64}` — raw error text never reaches the journal.

### Contracts (`src/contracts/sigils.js`)

- `RegistryData` extended with `active_attempts: object`: keys are task IDs, values `{ attempt: Attempt, dispatch_revision: Revision }`; invariants — the key task exists and is `running`, the attempt's `task_id` matches, `dispatch_revision <= run.revision`.
- Stored results are now fully correlated `Outcome` records (both `execution_results` entries and `task.last_result`), replacing the Pass 3 "transitional" bare-`ExecutionResult` storage. The comment at the old transitional marker is updated accordingly.

### Attempt lifecycle (`src/platform/attempts.js`, `src/platform/registry` call sites)

- Dispatch moves the reservation: `activatePendingAttempt` deletes from `pending_attempts` and installs `active_attempts[taskId] = { attempt, dispatch_revision }`. This fixes the pre-Pass-5 probe bug where a completed task's pending attempt survived dispatch and made `exportRegistry` throw `INVALID_SEMANTICS`.
- Result ingestion, uncertainty, cancellation, dead-letter sinking, and replay all clear both maps (`clearActiveAttempt` / `invalidatePendingAttempt`). Exported registries now have empty attempt maps once nothing is mid-await.

### Runtime loop (`src/platform/runtime-loop.js`)

Full design-§5 sequence:

1. **Preflight before any effect**: lease caps (`globalMaxLeased`, `perEntityMaxLeased`) — over-cap cycles return `{ ok: true, deferred: true }` and journal `dispatch_deferred`; adapter existence — missing adapter stays the only bounded-retry path (`no_adapter` under `scheduleTaskRetry`, which is now transition-guarded, bumps `run.revision`, and invalidates reservations at the dead-letter sink).
2. **Dispatch gate**: unchanged Pass 4 evaluate-before-lease; denial leaves the task queued and never touches the adapter.
3. **Invocation**: adapter receives a **deep-frozen cloned packet and correlation context only** (`run_id`, `schema_version`, `task_id`, `task_revision`, `queue_id`, `attempt_id`, `lease_expires_at`) — the previous `{ registry }` context (a design §5 step-3 violation) is gone. The dispatch commit bumps `run.revision`; that value is saved as the attempt's commit guard.
4. **Correlation**: adapter results stay closed `AdapterResult` (any adapter-authored correlation identifier is rejected by the contract); the runtime stamps the kernel-owned `Outcome` fields from dispatch state.
5. **Commit re-evaluation**: fresh `evaluateAuthority({ stage: "commit" })` on live state **and** `registry.run.revision === active.dispatch_revision`. Denial or drift marks `uncertain` with the decision code (`TASK_CANCELLED`, `STALE_ATTEMPT`, `NO_ALLOW_GRANT`, ...) or `STALE_REVISION` when only the revision moved. A previously returned allow is never reused.
6. **Ambiguity**: every post-dispatch failure — thrown adapter, invalid/unnormalizable result, contract violation, expired lease, stale commit — reaches one catch that calls `markTaskUncertain`. `scheduleTaskRetry` is unreachable post-dispatch. Explicit `failed`/`blocked` results remain valid committed outcomes (task `failed`/`blocked`, not ambiguous).

### Registry commit path (`src/registry/registry.js`)

- `registerExecutionResult` now requires a correlated `Outcome` matching the run, the task's content revision, and the **active attempt's** `attempt_id`/`queue_id`. No active attempt ⇒ `INVALID_RESULT` (this is also the duplicate-result defense: the first commit consumes the attempt, so a second result cannot append a record or repeat terminal transitions). All referenced transitions (task, queue, artifact, domain) are validated **before** any mutation; mutations then run in one synchronous section, and the operation bumps `run.revision` once. (Full clone-swap candidate commit (`commitRun`) is Block 3 with the CAS work; validate-then-mutate in one synchronous section is the scoped step.)
- `transitionArtifact` is guard-enforced with history.
- **Spec registration no longer derives artifact status** (`mapHandoffStatus` deleted): design §4/§5 — spec text is descriptive and "cannot accept/complete artifacts or domains based on spec text". Handoff specs declare artifacts, producers, and consumers only; status moves exclusively through a committed result.

### Host methods (`src/sdk/chord.js`)

- `cancelTask(taskId, { expectedRevision? })` — explicit host cancellation from any non-terminal state; `dead_letter` and terminal states reject (`INVALID_TRANSITION`). Bumps the revision (an in-flight attempt's commit guard goes stale; a late result is ignored, never committed over the cancel), clears attempt reservations, syncs the queue entry through the queue guard.
- `replayTask(taskId, { expectedRevision? })` — replaces the old status-reset `replayDeadLetterTask`. Legal only from `dead_letter | uncertain | blocked`, and only through **fresh admission**: `evaluateAuthority({ stage: "admit" })` runs first and a denial (`NO_ALLOW_GRANT` after revocation, etc.) leaves the task exactly where it was. Success is a fresh queued attempt: retry counters reset, reservations invalidated; consumed approvals stay consumed (kernel-owned, never reset by replay). This covers design §5's dead-letter rule, `uncertain` reconciliation, and `blocked -> queued` explicit re-evaluation in one host method.

### Snapshot import (`src/registry/snapshot.js`)

Design §6: in-flight (`leased | running`) tasks and queue entries are **transformed to `uncertain`** on import instead of rejecting the whole snapshot; `active_attempts` is cleared. Imported in-flight work is never silently executable and reconciles through the same `replayTask` path.

## Design decisions and deviations (recorded, not silent)

1. **`running -> blocked` task edge** (and `leased -> blocked` queue edge) — implied by the design's own `blocked -> queued` exit and the `blocked` adapter-result status; documented in the transition module header.
2. **`leased` task status** — kept legal in the contract/graph for host use, but the kernel dispatches `queued -> running` directly (queue entries carry `leased`), matching Pass 4 behavior.
3. **Validate-then-mutate instead of full `commitRun` clone-swap** — scoped to Block 3 with the whole-run CAS; within `registerExecutionResult` every throw path precedes the first mutation, and the mutation section contains no awaits.
4. **`STALE_REVISION`** is a journal/result code only, not a `Decision` contract code (the evaluator never emits it; the runtime compares the saved revision itself).
5. **Result storage upgraded to `Outcome`** — pre-Pass-5 snapshots holding bare `ExecutionResult` records fail `RegistryData` validation on import. Accepted: the preview makes no legacy-snapshot migration claim (`041-authority-design.md` §6: "no silent migration").
6. **`registerExecutionResult` is still exported** as a trusted-host/low-level API, but the governed path (runtime loop) is what performs authority re-evaluation; direct registry callers get correlation + transition guards, per the standing trusted-host-experimental caveat.

## Tests and evidence

- `packages/core && bun test`: **79 pass, 0 fail** (was 54). New `tests/transitions.test.js` (25 tests): full allowed/forbidden matrices for task/queue/artifact/domain; `markTaskUncertain` terminal-skip, attempt clearing, revision bump, reason sanitization; adapter throw / invalid result / mid-await revision bump / mid-await authority replacement / expired lease all → `uncertain` with zero committed results; cancel-during-await (cancellation wins, late result dropped, journaled `TASK_CANCELLED`); cancel/replay precondition and `expectedRevision` rejections; uncertain → replay → completed; replay denial after grant revocation leaves `dead_letter` untouched; blocked → re-evaluate → completed; spec-status no longer accepts artifacts; artifact acceptance/rejection and domain completion derived only from committed results; lease-cap deferral with per-entity/global caps and cap release; export-after-run regression (the original probe bug).
- Updated: `contracts.test.js` (correlated ingestion with running attempt, duplicate/foreign/stale rejection without mutation, in-flight import reconciles to `uncertain`); `hardening.test.js` TARGET 2 (dead-letter only via pre-dispatch exhaustion; post-dispatch throw is `uncertain`, never dead-lettered).
- `bun run src/verify-runtime.js`: all sections pass — §6 ambiguity → uncertain, §6b pre-dispatch exhaustion → dead letter, §7/7b fresh-admission replay of both dead-letter and uncertain tasks to completion.
- `bun run src/demo/callaback-demo.js`: runs clean.

## Known gaps / next pass

- **Pass 6**: adversarial matrix from design §7 (forged authority, approval misuse permutations, concurrent revision losers, zero-adapter-call denial proofs, etc.).
- **Block 3**: whole-run `commitRun` clone-swap CAS and per-operation `expectedRevision` enforcement (`cancelTask`/`replayTask` already accept the argument but only compare, they do not participate in a broader CAS protocol).
- Domain guard covers result-derived edges only; declared domain state strings remain host-authored free text by design.
