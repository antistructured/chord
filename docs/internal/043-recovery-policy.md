# 043 — Failure and reconciliation behavior (Block 4, Pass 5)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e`

## 1) Policy
- Retry eligibility: only pre-dispatch transient failures under bounded policy. Post-dispatch (dispatched/acknowledged) → no blind retry.
- Unknown outcomes quarantined to `uncertain`; require explicit operator/host reconciliation.
- Idempotency keys are adapter/host responsibility (kernel does not fabricate).
- Compensation hooks are host-defined (not implemented in kernel).
- No universal exactly-once guarantee for external effects.

## 2) Implementation
- `packages/core/src/platform/recovery-policy.js` codifies boundaries.

## 3) Tests
- `bun test`: 120/0/1008

## Pass report
Pass 5 — Failure and reconciliation behavior  
Files: recovery-policy.js (new)  
Tests: 120/0/1008  
Next pass readiness: READY
