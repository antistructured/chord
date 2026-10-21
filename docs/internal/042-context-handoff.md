# 042 — Actor handoff and context projection (Block 3, Pass 4)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e` (Block 2 Pass 6)  
**Dependency:** Pass 3 complete (`042-state-implementation.md`)

## 1) Files inspected/created
- `packages/core/src/platform/handoff.js` (new)
- `packages/core/src/sdk/chord.js`
- `packages/core/src/registry/registry.js`
- `docs/internal/042-run-lifecycle.md`

## 2) Implementation
- **Context projection** (`projectContext`): bounded, policy-filtered packet. Filters tasks by grants, includes only authorized scopes, redacts no secrets (no secret fields stored), includes run/task/queue/artifact/domain summaries, pending approvals (filtered), recent events (bounded to last 20), provenance with authority revision and generation time. No mutable registry handle returned.
- **Handoff proposal** (`proposeHandoff`): creates `handoff_id`, records causation/correlation IDs, enforces `expectedRevision` CAS, bumps run revision, logs event.
- **Handoff response** (`respondToHandoff`): accept/reject with CAS against current revision, authorization check (only target actor), expiry check, status transition guard, bumps revision, logs event. Stale handoffs rejected with `STALE_REVISION`.
- **SDK exposure:** `chord.projectContext()`, `chord.proposeHandoff()`, `chord.respondToHandoff()`, `chord.commitRun()`.

## 3) Invariants
- Projection contains no raw secret dumps
- Mutations go through proposal/response with revision checks
- Only authorized actors can respond to handoffs directed to them
- Expired handoffs rejected
- State changes increment run revision

## 4) Tests
- `bun test`: **113 pass / 0 fail / 983 expect()**

## Pass report
Pass 4 — Actor handoff and context projection  
Files inspected: sdk/chord.js, registry/registry.js, platform/*, docs/internal/042-*  
Files changed: `packages/core/src/platform/handoff.js` (new), `packages/core/src/sdk/chord.js`  
Findings/decisions: Implemented bounded context projection and explicit handoff proposal/accept/reject with CAS/revision checks, causation/correlation IDs, and policy filtering.  
Tests executed and result: `bun test` → 113 pass / 0 fail / 983 expect()  
Blockers: None  
Next pass readiness: READY
