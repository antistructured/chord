# 046 — Pass 2: State and atomicity audit

**Gate: BLOCKED. Stop corrective/release advancement.** This is a confirmed foundational state/evidence defect, not permission to rewrite Chord or to lower Block 6A criteria.

## Files inspected / changed
Inspected registry/registry.js, snapshot.js, query.js, sdk/chord.js; runtime-loop, transitions, task-queue, attempts, handoff, approval-flow, event-journal, journal-audit, trace-reducer, authorization, policy; result/packet helpers, contracts, public barrels, existing security/continuity/fault/canonical fixtures. Paths are under packages/core/src and tests.

Changed only new `docs/internal/046-*` audit reports, acceptance probe and raw evidence. No existing source, test, metadata, lockfile or prior report modified. New probe assertions are deliberately expected-safe requirements, not expectations changed to bless current unsafe behavior.

## Actual execution
From repository root: `node --test --test-reporter=tap docs/internal/046-state-probes.mjs` → **exit 1; 21 tests, 3 pass, 18 fail**. Repeated after excluding snapshot observation timestamp from compound-state comparison; same failures. Raw TAP: `046-evidence/state-probes-node.log`.

| Probe | Expected safety | Observed violation |
|---|---|---|
| 1 | successful whole-run CAS changes SDK state | returns ok but state stays created, not candidate active |
| 2 | one winner from same revision | both SDK commits return success |
| 3–4 | zero effects while paused or failed after rejection | adapter invoked once in each case; task grant valid, run gate absent |
| 5 | denied registration leaves state+events unchanged | spec and spec_registered event persist |
| 6 | denied admission does not install grants | authority/grants/revision/event change before actor denial |
| 7 | context is detached | context.scope mutation changes canonical grant without revision |
| 8 | unknown/no-grant projection denies data | task data exposed; queue unfiltered |
| 9 | event inspection is detached | edit mutates canonical journal payload |
| 10 | reservation participates in revision/history | pending attempt created with no revision increment/event |
| 11 | unknown cannot be re-admitted from permission alone | replayTask accepts uncertain with only existing grant and fresh revision |
| 12 | replay rebuilds committed tasks/queue | tasks empty in reducer |
| 13–14 | trace equality includes ordered content | changed payload and reversed IDs reported equal |
| 15–17 | mixed-run/version/incomplete histories reject | no exception for each malformed history |
| 18 | advertised replay public API exists | root export replayNoSideEffects undefined |
| 19–21 controls | detached export; stale cancellation no mutation; malformed snapshot schema rejected | PASS |

The pause probes do NOT establish bypass of the task-level human approval evaluator. They prove a separate missing run suspension/failure boundary despite valid task grants. Likewise trusted-host raw registry mutability is not an untrusted-plugin sandbox exploit. Projection/getter aliasing breaks the promised read-only consumer boundary.

## Root cause and correction boundary
1. `sdk/chord.js:270` calls `commitRun({ registry }, args)` with a disposable holder. `registry` is a captured const; other methods and `.registry` still reference it. Updating only that call or only `.registry` cannot fix all closures/runtime awaits.
2. Most canonical writers use progressive in-place changes, not validated candidates. Register+grant+admission is demonstrably partial on rejection. Event writes and revision increments are separate, sometimes absent, sometimes events record pre-increment revisions.
3. Read APIs retain aliases into the same objects. A superficially correct CAS helper cannot provide isolation or invalidate concurrent readers while these remain.
4. Reducer inputs omit authoritative state deltas, genesis and commit completeness. A reducer-only patch cannot reconstruct lost payloads; guessing or copying final snapshots into an alleged historical replay would violate the request.
5. Uncertain recovery is permission-checked requeue, not reconciliation evidence. The effect taxonomy constants do not implement an effect ledger.

**Why stop rather than patch around these:** a coherent canonical owner/candidate-commit migration touches admission, authority, lifecycle, runtime claim/result/uncertainty, event capture and query ownership together. Safe Level B also needs a versioned complete event protocol and explicitly unsupported legacy history. This exceeds a local helper/example correction and cannot be declared repaired by switching the example to replayTask, adding only a paused guard, or exporting the current reducer. Under the directive to stop on unresolved release-blocking failures, no piecemeal implementation or dependent pass is advanced. These are P0 follow-up tasks, not deferred passing invariants.

## Regression preservation
- Existing core: 126 pass / 0 fail (exit 0).
- Authority + adversarial: 49 pass / 0 fail (exit 0).
- Continuity: 7 pass / 0 fail (exit 0); pause test does not await effect-count assertions.
- Existing fault/replay: 5 pass / 0 fail (exit 0); no reconstruction equality assertion.
- Runtime/demo/canonical commands exit 0 with limitations in Pass 1. New acceptance probe exits 1; no overall green claim.

## Supported atomicity / evidence
Single-process synchronous execution with selected revision/authority guards, not consistent whole-run atomic commits, crash durability or distributed CAS. Export is a detached validated snapshot. Runtime late result protection and no automatic retry after ambiguity have direct existing evidence; unknown replay remains unsafe. Current reducer is diagnostic metadata accumulation, not Level B.

## Exact bounded follow-up (no new feature phase)
1. Canonical ownership: one owner consulted by all getters/methods/runtime stages; detached consumer reads; retained input clones; explicit trusted-host plumbing. Tests 1–2,7,9,10 and full aliases.
2. Candidate commits: validate all compound changes and corresponding events before a single in-process CAS; mandatory captured revision, exact +1; no callback during commit. Cover denied grants/admission, failed prepared candidate, queue validation, duplicate delivery, event/state rollback.
3. Lifecycle gates: honor paused/failed/cancelled runs before adapter work, fresh checks after awaits; test approval racing cancel and stale handoffs with zero protected effects.
4. Reconciliation: explicit run/task/attempt-bound operator evidence/decision; no-effect confirmation or documented idempotency protocol before re-admission; never infer no effect from timeout.
5. Evidence protocol: versioned genesis/committed state deltas sufficient for the declared projection, sequence/completeness checks, run/version/type/legal-transition validation, content/order diff and explicit legacy unsupported. Pure reducer equality tests plus real adapter counter.
6. Rebuild canonical workflow using host-authenticated builder/reviewer/human, attempt-bound approval, public exports and safe continuation. No direct mutation.
7. Actual npm pack artifact in scratch, content/license review, fresh Bun+Node public-only full workflow; record digest/source manifest and seek maintainer-controlled committed source without assuming audit commit authority.
8. Resume Passes 6–9 independently after preceding gates pass. Retain existing 126 tests and all new failing acceptance probes. No publication/version/tag.
