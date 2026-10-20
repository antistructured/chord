# 040 — Evidence and replay audit

Pass 4 COMPLETE as source audit; block remains PARTIAL after runtime verification failure. Consulted passes 1–3. Paths below relative to packages/core.

## What the log is
**Diagnostic, not authoritative.** `src/platform/event-journal.js:3-11` appends caller payload by reference with wall-clock timestamp and random/time-based ID (`src/utils/id.js`). No schema, immutable payload, persisted sequence, checksum, transaction or durable storage. SDK spec/queue events retain summaries, not full reconstructible inputs; adapter results and transition deltas are not fully recorded. State changes can occur without events (exported helpers, direct registry mutation, dead-letter requeue).

`src/platform/journal-audit.js:1-12` replay sorts a shallow copy of existing events by timestamp and adds display sequence numbers. It **does not reconstruct registry state**, validate completeness or invoke adapters/providers. It is a listing, not event sourcing. Equal timestamps retain existing array order under JS stable sort, not a verified causal order. `limit:0` is treated as default through `||`; sequence numbers are synthesized after sorting.

`createDeterministicAuditReport` (:15-32) includes current wall-clock created_at and live references to records/queue. Its name does not establish deterministic state reconstruction or immutable audit evidence. No deterministic model generation claim is warranted.

## Replay vs re-execution
- SDK `replayJournal` -> diagnostic read/sort only; no provider call in this function's call graph.
- SDK `replayTask` -> `src/platform/task-queue.js:74-89`: mutates dead-letter task to queued, resets attempts; a later runtime cycle invokes adapter again. **This is retry/re-execution, not safe historical replay.** No approval, dedupe token or new attempt authorization is checked.
- CLI `src/cli/replay.js` creates a fresh empty registry. `--journal` prints `[]`; `--task` cannot recover a persisted task. No snapshot loading occurs.

## Missing/corrupt entries and partial failure (source-derived, not fault-injection tested)
- Missing events silently disappear; no expected sequence/count/hash continuity checks. Duplicate events retained.
- Malformed event fields are not rejected; null entries can throw in sort/map, invalid timestamps can produce nonmeaningful ordering. No typed corruption result or recovery protocol.
- Missing event_journal makes `.slice()` fail; importRegistry returns raw `.registry` without shape/version checks.
- Snapshot contains a JSON clone and version 0.3.0 (`src/registry/snapshot.js`), not validated durable history. JSON cloning may drop unsupported values or throw on cyclic data (`src/utils/clone.js`).
- Adapter execution may finish before ingestion fails (pass 3). Catch schedules retry without recording a confirmed effect receipt. Ingest source also updates collections sequentially, without rollback if a later step throws.
- Missing registry task in runtime is dereferenced before try/catch; lease can be left stranded. Expired lease recovery absent.

## Existing checks and evidence
`bun run chord:replay --journal`: exit 0, `[]`. `bun run chord:audit`: exit 0; audit_version 0.3.0, all five counts zero, empty artifacts/domains/tasks/queue/replay. These check empty-state CLI wiring ONLY. Existing dead-letter test passed in pass 3 but verifies requeue, not historical reconstruction. No corrupt/missing journal, side-effect-free reconstruction or partial-commit tests exist in the inspected hardening suite.

Inspected: previous reports; `src/platform/{event-journal,journal-audit,task-queue,runtime-loop}.js`, `src/registry/{snapshot,query,registry}.js`, `src/sdk/chord.js`, `src/cli/{replay,inspect-audit}.js`, `src/utils/{id,clone}.js`, tests/hardening.test.js; example READMEs and dev_flow.md for claim comparison.
Changed: this report only. Decisions: label journal view experimental diagnostic; historical reducer deferred unless implemented and tested in a separately scoped later block. Gate/relabel re-execution distinctly. P0: misleading replay/completion semantics and unsafe repeat-effect risk. Next audit pass READY; release BLOCKED.
