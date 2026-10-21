# 043 — Append-only capture and reconstruction (Block 4, Pass 3)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e`

## 1) Files added/modified
- `packages/core/src/platform/event-journal.js` — extended schema (actor/principal/correlation/causation/run_revision/authority_revision/schema_version/policy_decision)
- `packages/core/src/platform/trace-reducer.js` (new) — pure reducer, replayNoSideEffects, diffTraces

## 2) Behavior
- Append-only capture enforced (events pushed, never mutated in reducer)
- Pure reducer reconstructs projected state without invoking adapters
- Duplicate event_id rejected; revision going backwards rejected as `STALE_REVISION` (divergence)
- Original schema versions preserved in events

## 3) Tests
- `bun test`: 120/0/1008

## Pass report
Pass 3 — Append-only capture and reconstruction  
Files: event-journal.js (modified), trace-reducer.js (new)  
Tests: 120/0/1008  
Next pass readiness: READY
