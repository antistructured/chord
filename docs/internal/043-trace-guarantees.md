# 043 — Guarantee boundary docs (Block 4, Pass 7)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e`

## Guarantees vs boundaries
- **Reconstructed state vs real-world effect:** Replay reconstructs state from captured events only. Adapter reports are evidence, not proof of real-world completion.
- **No side effects in replay:** `replayNoSideEffects` uses pure reducer; `effects_invoked = 0`. No adapters invoked.
- **Missing/invalid/corrupt traces:** Explicit failures (no guessing). Duplicate IDs, backwards revisions rejected.
- **Effect taxonomy:** Distinguish requested/dispatched/acknowledged/confirmed/unknown/failed.
- **Retry/ambiguity:** Post-dispatch ambiguity → uncertain, no blind retry. Pre-dispatch bounded retry only.
- **Exactly-once:** Not guaranteed for external effects. Kernel enforces delivery/idempotency boundaries where possible but external side effects may not be idempotent.
- **Tamper-proofing:** No cryptographic signatures/hashes implemented in this block; events are append-only in structure but not tamper-evident cryptographically.
- **Durability:** In-memory append-only journal; export/import via snapshots (trusted-host). No persistent log storage added.
- **Redaction:** Extended event schema supports metadata; no secrets logged by policy.
- **Trace export:** Available via `event_journal` and `inspectEvents`/audit utilities.

## Pass report
Pass 7 — Guarantee boundary docs  
Files: trace-guarantees.md (new)  
Tests: 125/0/1019  
Next pass readiness: READY
