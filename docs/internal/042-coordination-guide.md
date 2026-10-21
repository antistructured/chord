# 042 — Usage and semantics (Block 3, Pass 7)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e` (Block 2 Pass 6)  
**Dependency:** Pass 6 complete (`042-continuity-tests.md`)

## 1) How two independent actors coordinate
1. **Shared execution context**: Both actors work against the same in-process `Chord` instance (or imported snapshot) representing a single run.
2. **Read projected context**: Actor A calls `chord.projectContext({ actor_id, principal_id })` to get a bounded, filtered view (tasks, artifacts, domains, approvals, recent events). No secrets or mutable registry handles exposed.
3. **Propose handoff**: Actor A proposes work/handoff via `chord.proposeHandoff({ from_actor_id: 'A', to_actor_id: 'B', payload: {...}, expectedRevision: chord.getRunRevision(), correlation_id, causation_id })`. Proposal is CAS-protected.
4. **Accept/reject**: Actor B inspects context, calls `chord.respondToHandoff({ handoff_id, actor_id: 'B', action: 'accept'|'reject', expectedRevision: chord.getRunRevision() })`. Stale proposals rejected with `STALE_REVISION`; wrong actor rejected with `FORBIDDEN`; expired rejected with `EXPIRED`.
5. **State updates**: All mutations bump `run.revision` and are logged. Conflicting operations are rejected by CAS.

## 2) Pause/resume/cancel
- **Pause**: `chord.pauseForApproval({ expectedRevision, correlation_id, causation_id })` suspends run; while paused, no new normal execution is coordinated. State becomes `paused`.
- **Resume**: `chord.resumeRun({ expectedRevision, ... })` continues from paused state (fails if expired).
- **Reject**: `chord.rejectApproval({ expectedRevision, reason })` moves run to `failed`.
- **Cancel**: `chord.cancelRun({ expectedRevision, reason })` cancels run and all non-terminal tasks/queue entries, clears attempts.

All support `expectedRevision` preconditions and causation/correlation tracking.

## 3) Durability limitations (in-memory)
- **Same-process continuity**: State lives in memory for the lifetime of the process. Pause/resume works within the same process invocation context.
- **Process restart**: All in-memory state is lost unless explicitly exported/imported via `exportRegistry`/`importRegistry` (trusted-host operation). Imported in-flight work becomes `uncertain` per Block 2 design.
- **No persistent storage**: Block 3 does not add a database or durable storage. This is explicitly deferred (no hosted service).
- **No distributed coordination**: Single-process owner model. Multi-process coordination requires external persistence/CAS (out of scope).
- **Adapter effects**: Cannot be rolled back; uncertainty requires explicit host reconciliation.

## 4) Best practices
- Always pass `expectedRevision` for mutating operations in concurrent scenarios
- Use `correlation_id`/`causation_id` to trace cross-actor flows
- Filter sensitive data at projection time (already done by `projectContext`)
- Treat adapter results as evidence of reports, not proof of real-world outcomes
- Block 2 authority guarantees (grants, approvals, revocation, denial-by-default) remain in effect

## Pass report
Pass 7 — Usage and semantics  
Files inspected: handoff.js, approval-flow.js, sdk/chord.js, continuity tests  
Files changed: `docs/internal/042-coordination-guide.md` (new)  
Findings/decisions: Documented two-actor coordination flow, approval lifecycle, and honest in-memory vs cross-process durability distinctions.  
Tests executed and result: `bun test` → 120/0/1008 (documentation pass, no code changes)  
Blockers: None  
Next pass readiness: READY
