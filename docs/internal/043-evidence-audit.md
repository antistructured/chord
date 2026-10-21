# 043 — Evidence audit (Block 4, Pass 1)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e`  
**Dependency:** Block 3 COMPLETE

## 1) Files inspected
- `packages/core/src/platform/event-journal.js` (appendRegistryEvent, listRegistryEvents)
- `packages/core/src/platform/journal-audit.js` (replayRegistryJournal, createDeterministicAuditReport)
- `packages/core/src/registry/snapshot.js`, `registry.js`
- `packages/core/src/platform/runtime-loop.js`, `task-queue.js`
- `packages/core/src/sdk/chord.js`
- `docs/internal/042-*`

## 2) Current event capture
- `appendRegistryEvent(registry, type, payload = {})` creates `{ event_id, type, at, payload }` (stableId). Events stored in `registry.event_journal[]`.
- Many mutation sites append events: authority_snapshot_set, grants_installed, spec_registered, task_enqueued, task_cancelled, task_replayed, task_uncertain, task_result_ignored.
- Result commit path logs via append calls from various sites (runtime loop appends on commit via success paths; `markTaskUncertain` appends). Handoff/approval-flow modules append events (proposed/accepted/rejected/paused/resumed/failed/cancelled).

## 3) Gaps
- Effect states (requested/dispatched/acknowledged/confirmed/unknown/failed) not consistently distinguished. Events mix states; effect lifecycle not explicit.
- No consistent actor/principal/correlation/causation on all events. Some events include task_id etc, but not standardized.
- Event schema not versioned at event level (only run/schema_version). No redaction rules applied.
- Decision outcomes (allow/deny, code) sometimes logged in payloads, but not uniformly.
- replayRegistryJournal reads events in order; no validation of missing/conflicting sequences.

## 4) Recommendations
- Extend JournalRecord/event to include optional: `actor_id`, `principal_id`, `correlation_id`, `causation_id`, `run_revision`, `authority_revision`, `schema_version`. Keep backward compatible.
- Add explicit effect event types (e.g., `effect_requested`, `effect_dispatched`, `effect_acknowledged`, `effect_confirmed`, `effect_unknown`, `effect_failed`).
- Redaction utility for event payloads (strip secrets; but no secrets currently stored).
- Add divergence detection in replay.

## Pass report
Pass 1 — Evidence audit  
Files inspected: event-journal.js, journal-audit.js, snapshot.js, registry.js, runtime-loop.js, task-queue.js, sdk/chord.js, 042-*  
Files changed: none  
Findings/decisions: Event model exists but effect taxonomy and consistent metadata fields needed. No cryptographic claims.  
Tests executed: `bun test` → 120/0/1008  
Next pass readiness: READY
