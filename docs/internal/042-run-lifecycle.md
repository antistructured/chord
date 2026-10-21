# 042 — Canonical run lifecycle (Block 3, Pass 2)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e` (Block 2 Pass 6)  
**Dependency:** Pass 1 complete (`042-continuity-gap-audit.md`)

## 1) Files inspected
- `packages/core/src/registry/registry.js`, `packages/core/src/registry/snapshot.js`
- `packages/core/src/platform/runtime-loop.js`, `packages/core/src/platform/task-queue.js`, `packages/core/src/platform/transitions.js`, `packages/core/src/platform/authorization.js`
- `packages/core/src/sdk/chord.js`, `packages/core/src/contracts/sigils.js`
- `docs/internal/041-authority-design.md`, `041-block2-final-report.md`, `042-continuity-gap-audit.md`

## 2) Canonical identifiers (explicit)
| ID | Scope | Purpose |
|---|---|---|
| `run_id` | Run | Stable per run (created at run creation). Frozen in contracts. |
| `schema_version` | Run/attempts/results | `chord.contracts.v1` (frozen at run creation). |
| `project`, `phase` | Spec/task | Coordination scope. |
| `task_id` | Task | Stable task identifier. |
| `task_revision` | Task packet | Content revision of task packet (validated on results). |
| `queue_id` | Queue entry | Stable queue entry identifier. |
| `attempt_id` | Attempt | Per-attempt identifier (pending/active). |
| `authority_revision` | Authority snapshot | Host-owned authority version (incremented on snapshot/grant changes). |
| `run.revision` | Run | **Monotonic global revision** of canonical registry state. Incremented on every authoritative mutation committed via CAS. |
| `correlation_id` | Event/result context | Correlates related operations across actors/invocations (optional but explicit when used). |
| `causation_id` | Event/context | Identifies the operation/event that caused this action (explicit). |
| `handoff_id` | Handoff proposal | Stable identifier for a handoff proposal between actors. |
| `actor_id`, `principal_id` | Actor/principal | Host-authenticated identity (separate from schema). |

**Rule:** All authoritative mutations must carry/validate appropriate IDs and revision preconditions.

## 3) Run states (canonical)
The run is the root coordination unit. Run-level states (kernel-owned):

| State | Meaning | Transitions |
|---|---|---|
| `created` | Run initialized, no work started | -> `active` (on first admission/explicit start) |
| `active` | Normal operation, work may be queued/running | -> `paused` (on approval pause or explicit host pause), -> `cancelling` (on cancellation request), -> `completed` (all terminal with success criteria met), -> `failed` (terminal failure) |
| `paused` | Suspended awaiting approval/resolution; **no execution** dispatches while paused | -> `active` (on authorized resume), -> `cancelling` (on cancellation), -> `failed` (on expiry/rejection leading to terminal failure per policy) |
| `cancelling` | Cancellation in progress / cancellation requested | -> `cancelled` (on completion of cancellation) |
| `cancelled` | Run cancelled by authorized host; terminal | (terminal) |
| `completed` | Run completed successfully per policy; terminal | (terminal) |
| `failed` | Run failed; terminal | (terminal) |

**Note:** Current implementation has `run` object with `{run_id, schema_version, revision}` but no explicit `state` field. Block 3 will add it with migration/compatibility (preserve existing behavior where possible).

## 4) Step/task states (canonical, aligned with Block 2)
Block 2 already defines guarded task/queue graphs. Canonical task states (preserved/enforced):

| State | Meaning | Allowed exits |
|---|---|---|
| `queued` | Admitted and queued, ready for dispatch (subject to lease/authority) | `leased`, `running` (dispatch), `blocked`, `cancelled`, `dead_letter` (pre-dispatch retry exhaustion) |
| `leased` | Reserved for dispatch/attempt | `running`, `queued` (re-queue), `cancelled`, `dead_letter`, `uncertain` |
| `running` | Adapter executing (mid-await), attempt active | `completed`, `failed`, `blocked`, `uncertain` (post-dispatch ambiguity), `cancelled` |
| `blocked` | Blocked, requires explicit host re-evaluation/replay | `queued`, `cancelled` |
| `uncertain` | Post-dispatch ambiguity; **explicit host reconciliation only** (no blind retry) | `queued` (fresh admission replay), `completed`, `failed`, `cancelled` |
| `dead_letter` | Pre-dispatch routing failure exhausted retries; **fresh admission replay only** | `queued` (fresh admission replay) |
| `completed` | Terminal success | (terminal) |
| `failed` | Terminal failure | (terminal) |
| `cancelled` | Terminal cancellation | (terminal) |

**Invariants:** `completed|failed|cancelled` terminal per task. `uncertain` never entered by normal result ingestion (only ambiguity/explicit). `dead_letter` only via pre-dispatch bounded retry.

## 5) Effect states
Effects are represented by adapter results and execution outcomes:

| State | Meaning | Notes |
|---|---|---|
| `requested` | Effect requested via task packet (implicit) | Before dispatch |
| `dispatched` | Sent to adapter with frozen packet + correlation-only context | No registry/authority write handles passed |
| `in_flight` | Awaiting adapter result (attempt active) | Lease timer applies |
| `reported` | Adapter returned result (correlated) | Must be validated before normalization/commit |
| `committed` | Result committed to canonical state via CAS | State transitions applied atomically |
| `rejected_commit` | Commit rejected (stale/invalid/duplicate/foreign) | No state mutation; logged as ignored/rejected |
| `uncertain` | Effect status unknown due to ambiguity (timeout/error/lease expiry/stale commit) | **No automatic retry**; requires explicit host reconciliation. External effects cannot be rolled back by denying commit. |
| `confirmed_terminal` | Effect resulted in terminal task/domain/artifact state | Evidence of adapter report, not independent proof of real-world outcome. |

**Rule:** "An explicit valid adapter result is evidence of an adapter report, not independent proof of a real-world outcome." (design §5)

## 6) Parent/child intent relationships
- **Spec hierarchy:** `IntentSpec` may be related to `CoordSpec`/`HandoffSpec` via project/phase/parent references (implicit in current model).
- **Task graph:** Tasks belong to run; may have dependencies via spec fields (not strictly enforced as DAG in current code). 
- **Handoffs:** `HandoffSpec` creates review tasks for consumers; artifacts link producers/consumers.
- **Block 3 addition:** Explicit `parent_run_id`, `parent_task_id`, `child_run_ids[]` where applicable, stored in run/task metadata with CAS protection.

## 7) Expected revisions & causation/correlation
- **Expected revision (precondition):** Every mutating operation must be able to specify `expectedRevision` (run.revision). Operations without explicit precondition use "read-modify-commit with CAS" pattern.
- **Causation:** `causation_id` = ID of the event/operation that caused this action (e.g., approval granted -> resume action).
- **Correlation:** `correlation_id` groups related operations across actors/invocations (e.g., handoff proposal/accept/reject cycle).
- **Versioning:** Run revision increments on every committed authoritative mutation. Stale revisions rejected with `STALE_REVISION`.

## 8) Context projection contract (for cross-actor handoff)
Bounded, policy-filtered projection for external/independent actors:

```js
{
  schema_version: "chord.contracts.v1",
  projection_version: "1.0",
  run_id: "...",
  run_state: "active|paused|...",
  run_revision: N,
  actor_id: "...",
  principal_id: "...",
  authorized_scopes: [...], // from grants
  tasks: [                // filtered by scope
    { task_id, status, target_entity, project, phase, task_revision, queue_id, attempt_id?, lease_expires_at? }
  ],
  queue_summary: [...],
  artifacts: [...],       // filtered
  domains: [...],         // filtered
  pending_approvals: [...], // only if authorized to see/act
  recent_events: [...],   // bounded, filtered
  handoff_expectations: [...], // what this actor is expected to do
  constraints: [...],
  trusted_decisions: [...], // decisions made by authorized actors
  provenance: { generated_at, authority_revision, projection_hash? }
}
```

**Rules:**
- **No raw secret dumps.** Filter sensitive fields.
- **Scope-based filtering:** Only include data the actor is authorized to see/act on.
- **Immutable view:** Projection is a snapshot view; mutations go through proposal + CAS.
- **Provenance required:** Include generation time, authority revision, run revision.
- **No registry object:** Projection is plain data, not a mutable registry handle.

## 9) Handoff contract
Explicit proposal/accept/reject mechanism:

```js
// Proposal
{
  handoff_id: "...",
  run_id: "...",
  from_actor_id: "...",
  to_actor_id: "...",
  correlation_id: "...",
  causation_id: "...",
  expected_revision: N,  // run revision at proposal time
  payload: { task_ids?, context_delta?, requested_action?, constraints? },
  expires_at: timestamp,
  signature/context: {} // host-attested
}

// Response (accept/reject)
{
  handoff_id: "...",
  run_id: "...",
  actor_id: "...",
  action: "accept|reject",
  expected_revision: N,
  correlation_id: "...",
  causation_id: "...",
  reason?: "..." // sanitized
}
```

**Invariants:** Accept/reject must pass CAS against current run revision; stale proposals rejected. Only authorized actors may accept/reject. State changes from handoff go through whole-run CAS.

## 10) Implementation notes for Pass 3
- Add `commitRun(registryOwner, {expectedRevision, nextRegistry})` with clone-swap in one synchronous section
- Introduce registry owner/holder pattern so `getState()` returns current committed reference
- Route all authoritative mutations through `commitRun` or ensure atomicity
- Add `run.state`, `run.causation_id`, `run.correlation_id` (with defaults for compatibility)
- Add revision preconditions to public mutating APIs where appropriate
- Preserve Block 2 behavior exactly

## Pass report
Pass 2 — Canonical run lifecycle  
Files inspected: registry/*, platform/*, sdk/chord.js, contracts/sigils.js, docs/internal/041-*, 042-continuity-gap-audit.md  
Files changed: none  
Findings/decisions: Defined canonical run/task/effect states, explicit IDs (including causation/correlation/handoff), context projection contract (bounded, filtered, no secrets), handoff proposal/accept/reject contract, and CAS/commitRun requirements for Pass 3. All aligned with Block 2 semantics.  
Tests executed and result: `bun test` in packages/core → 113 pass / 0 fail / 983 expect() (baseline)  
Blockers: None  
Next pass readiness: READY
