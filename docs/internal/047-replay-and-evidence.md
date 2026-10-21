# 047 — Pass 6: Authoritative replay and evidence correction

Gate: COMPLETE for declared modern single-process history projection; pending independent Pass 7 review may reopen defects.

## Reconstructed projection
Every serialized canonical collection is reconstructed: run, tasks, task_queue, pending/active attempts, authority including approval consumption, artifacts/domains and histories, specs/results/trigger state, handoffs/pause, operations and reconciliations. canonicalProjection excludes only event_journal to avoid recursive history; reducer separately returns the validated complete consumed journal. Executable adapters/router/policy closures and host identity mechanisms are not canonical serializable state and are not reconstructed. Observation timestamps already recorded are preserved, never regenerated.

## Protocol
New owners without history record state_initialized genesis of their exact initial state (including a trusted snapshot baseline where supplied). Every installed transaction captures versioned chord.history.v1 before/after path deltas, operation, consecutive sequence/revision, previous commit ID/revision and ordered diagnostic event IDs. Event/state installation is the same validated candidate CAS; no fabricated reducer events. Array appends/per-field changes avoid nested full-history snapshots. Patch containers are plain-data envelopes; their resulting canonical state is fully SigilJS-validated after each commit. History size/depth/node limits still fail closed; no unbounded durability claim.

Reducer validates contract/version/run identity, order, duplicate IDs, prior values, sequence/commit links, diagnostic membership, transition legality and complete canonical schema. Installation and replay share state transition invariants, including explicit import quarantine, cancellation and reconciliation cases. Missing genesis/middle/diagnostic/unfinished commit fails. Legacy diagnostics without sufficient committed history are explicitly UNSUPPORTED_HISTORY; no migration invents missing state. A truncation exactly at a valid earlier commit cannot be detected without an external expected endpoint; this is not tamper-proof evidence. No cryptographic signature/hash authentication promised.

Diff compares ordered full event data, not ID sets. Diagnostic replayJournal remains a separate event-view utility. reduceTrace/replayNoSideEffects/diffTraces/canonicalProjection and SCHEMA_VERSION now available through public exports. Replay contains no adapter/model/I/O execution path.

## Verification and compatibility
New replay-integrity tests: baseline 0/3; corrected original 3/3; import-quarantine/dead-letter-cancel edge test added, total 4/4. Equality checks cover admission, result, uncertainty, reconciliation, handoff, pause, cancellation and imported in-flight state. Canonical workflow adds real human approval/consumption across snapshot restoration and compares the entire reconstructed projection with adapter count unchanged.

All immutable 046 safety probes now 21/0. Core run before final extra edge test: 149/0; runtime validator and public-only Node canonical example exit 0. Logs retained. No release/artifact claim.

Old tests used unversioned fake records and empty input as successful reconstruction: empty input now explicitly rejects insufficient history; duplicate/backwards-revision assertions retained with actual valid versioned fixtures so they reach the intended protection. Plain snapshot import without in-flight changes remains a detached equal clone; import with in-flight work now commits quarantine and evidence/revision together. Canonical test no longer edits internal state and now asserts 11 meaningful workflow outcomes. Runtime fixture provides explicit mocked no-effect receipt instead of blind replay, and its self-catching negative-test sentinel was corrected (not suppressed).
