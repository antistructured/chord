# Integrity, host boundaries and migration

All APIs are experimental. No stable surface, production certification, distributed durability or publication approval is implied.

## Host SDK versus actor input
`createChord()` returns an **embedding-host SDK**, not an authenticated network endpoint. The host authenticates principals, binds actor IDs to sessions, attests grants/human approvals, verifies evidence references, controls the clock and installs trusted adapters. Never forward actor/model request data as `trustedHost`, registry snapshots, authority snapshots, `issueGrants`, identity arguments or generic `commitRun` candidates. Schemas validate data, not identity or evidence truth.

- Scope-filtered actor view: `projectContext({ actor_id, principal_id })`, with IDs resolved by the host from its authenticated session. Active exact task grants, denies, actor/principal validity and expiry apply. No-grant identities receive no protected tasks/queue. Related records follow the immutable authorized task payload. Views are bounded and detached.
- Host administration: authority installation, admission, lifecycle/reconciliation, adapter/configuration, full registry/authority/event/query/audit/export inspection and generic CAS. Do not expose these methods directly to actors.
- Low-level root/`./platform` queue, event and runtime functions are trusted-host plumbing on caller-owned data. They do not provide an actor authentication layer and never receive an SDK's private canonical owner. A plain registry passed to `runRuntimeCycle` is a detached simulation owner, not a way to update an SDK registry.
- In-process adapters remain trusted executable code, not sandboxed plugins. SDK runtime passes a frozen cloned packet and frozen correlation context only. Executable accessors are resolved before claim installation under the reentry guard.

Rich snapshots/history can contain host-supplied inputs, outputs and authority metadata. Scope filtering is not automatic content redaction; do not put credentials in task data or expose full traces to untrusted users. Errors use sanitized codes, but arbitrary host payloads are not universally secret-scanned or redacted.

## Canonical state and revisions
The SDK owns one private registry. `registry`, `getRegistry`, full inspection/query/export and returned objects are detached data. Editing them does not change canonical state. Use explicit SDK transitions instead of editing status/queue/retry counters.

Synchronous logical operations prepare a detached candidate, validate the complete state and transition, couple evidence, and install by one exact +1 revision CAS. Handoff requests/responses and persisted handoff/pause metadata also use closed SigilJS contracts; malformed identity objects cannot enter canonical history. Failed operations leave canonical collections/history unchanged. Explicit caller revision preconditions are checked where supported; otherwise an operation captures its own current revision. No asynchronous callback runs inside a successful install. Reentrant mutations fail closed.

`commitRun({ expectedRevision, nextRegistry })` is trusted-host maintenance: both fields required, candidate must be exact +1, candidate journal must exactly match existing history (only the kernel appends new events) and established task payloads/terminal transitions cannot be reset. Unknown fields such as `operation` reject. Do not use generic CAS as an actor-authored workflow shortcut. Internal kernel operations have dedicated semantic transition labels.

This is single-process in-memory atomicity, not distributed CAS, crash durability, a database transaction or external-effect rollback. Full candidate/history validation and cloning has bounded-input limits and nontrivial cost; no unbounded throughput guarantee. Large histories can require host-managed archival/snapshot design; silent eviction is not implemented.

## Lifecycle and approval
Paused, failed, cancelled and completed runs dispatch no new effects. `resumeRun` requires an active host-attested human `principal_id`; queued protected tasks require a valid exact prepared-attempt approval by that human. Dispatch consumes approval and rechecks grants/approval at result commit. Pausing or cancelling cannot undo an effect already invoked; late results cannot overwrite terminal state.

Snapshot import is trusted-host restore, not authentication or globally fresh authority. Validate provenance/current authority at the host. Imported in-flight work is atomically quarantined as uncertain and recorded; queued pending attempts can survive the intentional approval pause/restore workflow. There is no cross-process writer coordination or proof that an older independent process stopped executing.

## Unknown effects and reconciliation
Permission to execute is not proof that an earlier effect did not happen. `replayTask` is explicit re-admission, **not historical replay**. Unknown/blocked post-dispatch work remains quarantined until a supported reconciliation decision. Changing only task/source-spec IDs cannot evade the run-local structural operation signature. This is not arbitrary natural-language equivalence or cross-run/global/provider idempotency. The host must preserve meaningful business-operation identity and enforce any wider deduplication boundary.

Example host-attested no-effect resolution:

```js
chord.reconcileTask({
  task_id,
  principal_id: authenticatedHumanId,
  decision: 'confirmed_not_executed',
  evidence: { kind: 'no_effect_confirmation', reference: verifiedReceiptId },
  expectedRevision: chord.getRunRevision()
});
chord.replayTask(task_id, { expectedRevision: chord.getRunRevision() });
```

The host must verify the referenced receipt; a model-generated string is not evidence. Available decisions: `confirmed_completed` with `receipt` (no repeated execution); `confirmed_not_executed` with `no_effect_confirmation` (eligible for explicit fresh admission); `still_unknown` with `operator_review` (quarantine retained); `authorized_compensated` with `compensation_receipt` (records host-verified compensation, does not execute compensation). Cancellation preserves unknown effect status and can be reconciled without restoring the cancelled task. New dispatch rechecks authority, revisions and fresh approval. No universal exactly-once guarantee.

## Authoritative replay versus diagnostics
Public root exports: `reduceTrace`, `replayNoSideEffects`, `diffTraces`, `canonicalProjection`, `importRegistry`, `SCHEMA_VERSION`.

`chord.history.v1` genesis and committed before/after deltas reconstruct all serializable canonical fields; `canonicalProjection` excludes only the recursive journal. Reducer separately returns the consumed validated journal. Reconstruction checks versions, run identity, sequence/commit linkage, before-values, ordered diagnostic IDs, transition legality and canonical contracts. It never calls adapters/models or reruns probabilistic decisions. Diff compares ordered full event content.

Legacy/empty/incomplete histories without sufficient committed facts reject explicitly. A trusted snapshot can initialize a new history baseline; this reconstructs from that baseline, not missing earlier execution. Missing middle/diagnostic/uncommitted-tail records are detectable. A trace truncated exactly at an earlier complete commit needs an external expected endpoint to detect; neither revision alone nor this unsigned journal proves global completeness or cryptographic authenticity. No tamper-proof/tamper-evident signing claim.

`replayJournal`/audit helpers remain diagnostic event views, not state reconstruction. Simulation/forked re-execution is deferred.

## Verified example and compatibility
From the package root: `node examples/cross-actor-workflow.mjs` or `bun examples/cross-actor-workflow.mjs`. It imports public APIs, uses separate builder/reviewer service principals and a host-attested human, exercises missing approval with zero protected effects, restores a paused snapshot, validates/consumes exact approval and compares reconstructed state with no extra effects. These are independent mock actor identities in one host process, not independently deployed multi-process actors. `demo:via` remains a direct fake-adapter illustration, not the governed acceptance proof.

Migration: replace live registry edits with SDK operations; supply authenticated human context on resume; provide verified reconciliation evidence before unknown re-admission; stop treating empty/legacy diagnostic logs as authoritative replay; use documented root exports instead of internal `src/*` imports. Reusing identical work under a new task ID now rejects rather than silently executing again. Candidate package is @weipertda/chord@0.4.0-preview.1 (formerly @chord/core). This is a local, unpublished candidate; publication is maintainer-only and separately gated. Contract, snapshot, audit and event schema versions are independent and unchanged.
