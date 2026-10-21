# Chord — Unreleased public preview notes (internal draft)

Not a release announcement; licensing, namespace, version and publication approval pending.

Chord is a JavaScript coordination kernel for governed execution across humans, AI agents, and services. Turn intent into governed execution with explicit authority, coordinated state, safe handoffs, and replayable evidence.

This preview integrates SigilJS-validated intent, host-issued exact scoped actor authority, allow/deny/approval and freshness enforcement, private single-process canonical ownership, atomic logical state/evidence commits, detached context/inspection, cross-actor handoffs, attempt-bound human approval, snapshot continuation, unknown-effect quarantine/evidence-backed reconciliation and pure authoritative modern recorded-state reconstruction.

Safety migration: direct registry edits no longer mutate canonical state; use SDK operations. Resume requires host-attested human authority and protected pending-attempt approval. Unknown work requires verified no-effect evidence before fresh admission; new task/spec IDs do not evade run-local structural quarantine. Host CAS cannot inject operation labels or journal events. Empty/legacy insufficient history rejects rather than pretending reconstruction.

Boundaries: trusted embedding host, in-memory/single-process, experimental APIs, no hostile-adapter sandbox, distributed CAS/durability, global semantic idempotency, universal exactly-once or signed/tamper-proof completeness. Host must authenticate identities, protect credentials and verify evidence truth. Distinct mock actor identities do not imply independently deployed multi-process coordination.

Current internal evidence:160 core tests,21 unchanged safety probes and public mock workflow pass. Prior sealed0.3.0 consumer proof is not a0.4 release artifact. License selected Apache2.0 but not applied/approved pending rights; no publication occurred. Move approved notes into the project changelog only after legal/package/version decisions; retain this draft as preparation evidence.
