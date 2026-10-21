# 042 — Concurrency and continuity gap audit (Block 3, Pass 1)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e` (Block 2 Pass 6)  
**State:** Block 2 COMPLETE (113 tests pass). Block 3 NOT STARTED.

## 1) Files inspected (directly read)
- `packages/core/src/registry/registry.js` (createRegistry, registerSpec, registerTask, registerExecutionResult, transitionArtifact)
- `packages/core/src/registry/snapshot.js` (export/serialize/import)
- `packages/core/src/registry/query.js`
- `packages/core/src/platform/runtime-loop.js` (full cycle: preflight, dispatch, commit)
- `packages/core/src/platform/task-queue.js` (guarded operations, scheduleTaskRetry, replayDeadLetterTask)
- `packages/core/src/platform/attempts.js`
- `packages/core/src/platform/transitions.js`
- `packages/core/src/platform/authorization.js`
- `packages/core/src/sdk/chord.js` (all public methods, trusted-host seam)
- `packages/core/src/contracts/sigils.js` (RegistryData, Outcome, AuthoritySnapshot, Attempt, etc.)
- `docs/internal/041-authority-design.md` (§4–§7), `041-block2-final-report.md`, `040-preview-scope-lock.md`

## 2) Current behavior summary (evidence)
- **Registry ownership:** `createChord` creates/holds a mutable `registry` object (`this.registry` exposed via return value). Many modules mutate it directly (`registerTaskPackets`, `enqueueTask`, `registerExecutionResult`, `runRuntimeCycle`, etc.). No owner-held state indirection.
- **Revision:** `run.revision` exists and is incremented in places (admit/queue, authority snapshot/grants, cancel/replay, result commit, dead-letter in retry, runtime commit paths). No centralized `commitRun` CAS function.
- **Commit model:** `registerExecutionResult` does validate-before-mutate in one synchronous section (Pass 5) and increments revision at end. `runRuntimeCycle` mutates registry directly (lease, activate attempt, call adapter, re-evaluate, commit via `registerExecutionResult` or `markTaskUncertain`). Several mutation sites bypass a single atomic commit gate.
- **CAS / expectedRevision:** `cancelTask` and `replayTask` accept `expectedRevision` and throw `STALE_REVISION` if mismatched, but they do not use a whole-run clone-swap; they mutate directly and bump revision. `queueTaskPackets`/admission do not take `expectedRevision`. Design §5 requires `commitRun(registry, {expectedRevision, nextRegistry})` with whole-run clone-swap.
- **Concurrency model:** In-process single-threaded JS (Bun/Node) but the design explicitly requires protection against stale writes/repeated deliveries and defines ordering/revision checks/idempotency boundaries (Block 3 goals). "Atomic within supported store" means in-memory atomicity via clone-swap in one synchronous section.
- **Cross-actor coordination:** No explicit handoff projection API beyond raw registry access. No causation/correlation IDs beyond existing (run_id, schema_version, task_id, queue_id, attempt_id). No bounded context packet for external actors.
- **Approval/suspend/resume:** Approval structure exists in authority (grants/approvals). `approval_required` on task authority binding; evaluator handles approvals. No explicit "suspended/pending_approval" task state wired into runtime loop as a pause state that blocks execution across invocations in a coordinated way beyond what exists. Cancellation exists.
- **Handoff/replay across sessions:** `importRegistry` exists but imports a full snapshot (design says trusted-host only, in-flight -> uncertain). No explicit cross-actor handoff proposal/accept/reject with revision checks.

## 3) Runnable examples of contested scenarios (to map gaps)
I will create small scripts/tests to observe current behavior.

### 3a) Contested handoff (two actors racing to mutate same task)
Current: any code with access to registry can mutate directly. No CAS. Last write wins within same synchronous turn? Or interleaved across async awaits - but JS is single-threaded; "racing" in design sense means stale preconditions / interleaved logical operations. Also adapter await creates windows.

### 3b) Session resumption
`importRegistry` + re-importing snapshot; in-flight become uncertain. No explicit resume mechanism that preserves approval state across process boundary in a coordinated way.

### 3c) Cancellation
`cancelTask` works but does direct mutation + revision bump; in-flight attempt can be racing (tested in Pass 5).

### 3d) Duplicate delivery
`registerExecutionResult` rejects duplicates via missing active attempt. Queue admission checks duplicates. Some paths covered.

## 4) Gaps against Block 3 requirements (evidence-based)
| Requirement | Current | Gap |
|---|---|---|
| Whole-run `commitRun` clone-swap with `expectedRevision` | Missing. Mutations direct. | **P0** - Need `commitRun(registryRefOrOwner, {expectedRevision, nextRegistry})` returning `{ok, revision, code?}`. Need owner indirection so getters read current committed state. |
| All logical commits atomic together | Partial - `registerExecutionResult` validates-before-mutate atomically for that op, but runtime does multiple mutations across functions/awaits without whole-run CAS. | **P0** - Route authoritative mutations through commit gate or ensure atomicity. |
| Per-operation revision preconditions enforced consistently | Only `cancelTask`/`replayTask` check `expectedRevision`. Many operations have no revision precondition. | **P0** - Add consistent enforcement. |
| Cross-actor coordination via shared execution context with explicit IDs | No handoff projection API. No causation/correlation beyond existing IDs. | **P0** - Need bounded context projection + handoff proposal/accept/reject. |
| Pause/resume/cancel across invocations | `cancelTask` exists. No explicit suspended/pending_approval pause state that blocks execution across invocations in coordinated way. Approval flow exists but not wired as pause/resume lifecycle. | **P0** - Need to wire properly. |
| Stale handoffs cannot overwrite newer state | No CAS on handoffs. | **P0** - Enforce via revision/CAS. |
| Same-process vs cross-process durability distinction | Documented partially; not enforced/mechanized. | **P1** - Must be explicit. |
| State projection filters unauthorized/sensitive fields | No projection API. | **P0** - Need it. |

## 5) Blockers / risks
- **Architectural change:** Introducing owner indirection + clone-swap affects all mutation sites. Must be careful not to break Block 2 behavior (113 tests must stay green).
- **Scope creep:** Must not add DB/hosted service. Stay in-memory.
- **API compatibility:** "Preserve old read APIs if feasible" (Pass 3). `registry` is currently exposed directly on chord instance - need to be careful about ownership semantics.

## 6) Next pass readiness
**READY** for Pass 2 (Canonical run lifecycle) - need to design the model first, then implement in Pass 3. But Pass 3 says "Implement explicit compare-and-commit/revision guard..." so design must come in Pass 2.

## Pass report
Pass 1 — Concurrency and continuity gap assessment  
Files inspected: registry/*, platform/runtime-loop.js, platform/task-queue.js, platform/attempts.js, platform/transitions.js, platform/authorization.js, sdk/chord.js, contracts/sigils.js, docs/internal/041-* and 040-*  
Files changed: none  
Findings/decisions: Identified critical gaps - no `commitRun` clone-swap CAS, no owner indirection, revision preconditions only on cancel/replay, no cross-actor handoff projection/context API, approval pause/resume not fully wired as cross-invocation lifecycle. Architecture requires careful migration to preserve Block 2 guarantees and all 113 tests.  
Tests executed and result: `bun test` in packages/core → 113 pass / 0 fail / 983 expect() (baseline confirmed)  
Blockers: None (assessment only)  
Next pass readiness: READY
