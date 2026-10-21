# 042 — Suspend/resume/cancel (Block 3, Pass 5)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e` (Block 2 Pass 6)  
**Dependency:** Pass 4 complete (`042-context-handoff.md`)

## 1) Files inspected/created
- `packages/core/src/platform/approval-flow.js` (new)
- `packages/core/src/sdk/chord.js`
- `docs/internal/042-run-lifecycle.md`

## 2) Implementation
- **pauseForApproval()**: suspends run (active→paused). Records pause metadata (reason, expires_at), bumps revision, logs event. Rejects if already paused/terminal.
- **resumeRun()**: resumes paused run (paused→active). Checks expiry, clears pause state, bumps revision, logs event. Only from paused state.
- **rejectApproval()**: rejects pending approval (paused→failed), clears pause, bumps revision, logs event.
- **cancelRun()**: cancels run (→cancelled). Cancels all non-terminal tasks/queue entries, clears attempt reservations (pending/active), bumps revision, logs event. Works from active/paused/cancelling states; rejects if already terminal.

## 3) Invariants
- While paused, run state blocks execution dispatch logic (runtime loop respects task states; paused run state is explicit for coordination). No new dispatches occur when run is paused.
- All operations support `expectedRevision` CAS and bump `run.revision`.
- Expired pause prevents resume (throws `EXPIRED`).
- Causation/correlation IDs propagated when provided.

## 4) Tests
- `bun test`: **113 pass / 0 fail / 983 expect()**

## Pass report
Pass 5 — Suspend/resume/cancel  
Files inspected: sdk/chord.js, platform/handoff.js, registry/*  
Files changed: `packages/core/src/platform/approval-flow.js` (new), `packages/core/src/sdk/chord.js`  
Findings/decisions: Implemented pause/resume/reject/cancel with state guards, expiry checks, attempt cleanup, and revision CAS. Aligns with run lifecycle.  
Tests executed and result: `bun test` → 113 pass / 0 fail / 983 expect()  
Blockers: None  
Next pass readiness: READY
