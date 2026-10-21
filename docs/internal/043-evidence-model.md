# 043 — Evidence and effect taxonomy (Block 4, Pass 2)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e`

## 1) Event schema (canonical)
```js
{
  event_id: string,           // stable id
  type: string,               // event type
  at: number,                 // timestamp
  schema_version: "chord.contracts.v1",
  run_id: string,
  run_revision: number,
  actor_id?: string,
  principal_id?: string,
  correlation_id?: string,
  causation_id?: string,
  authority_revision?: number,
  policy_decision?: { allowed: boolean, code?: string, reasons?: string[] },
  payload: object             // event-specific, redacted
}
```
Backward compatible (new fields optional).

## 2) Effect states
| State | Meaning |
|---|---|
| `requested` | Effect requested via task packet/spec |
| `dispatched` | Sent to adapter with frozen packet + correlation-only context |
| `acknowledged` | Adapter acknowledged receipt/dispatch (optional) |
| `confirmed` | Confirmed outcome committed via correlated result |
| `unknown` | Effect status unknown (timeout/ambiguity/lease expiry) |
| `failed` | Effect failed (adapter error/pre-dispatch failure) |

**Rule:** Requested ≠ confirmed. Adapter reports are evidence, not proof of real-world completion.

## 3) Required event fields by transition
- Admission: run_id, actor/principal (from authority binding), correlation/causation if provided, run_revision, decision
- Dispatch: attempt_id, task_id, queue_id, run_revision
- Result commit: outcome/status, artifact/domain changes, run_revision
- Ambiguity: reason (sanitized), run_revision
- Handoff/approval: handoff_id/approval context, correlation/causation, run_revision

## 4) Redaction rules
- Never log secrets/tokens/credentials
- Truncate long strings in payloads
- Sanitize error messages to codes/reasons
- No raw adapter outputs containing sensitive data

## Pass report
Pass 2 — Evidence and effect taxonomy  
Files inspected: event-journal.js, journal-audit.js, runtime-loop.js  
Files changed: none (design only)  
Findings/decisions: Canonical schema and effect taxonomy defined.  
Tests: 120/0/1008  
Next pass readiness: READY
