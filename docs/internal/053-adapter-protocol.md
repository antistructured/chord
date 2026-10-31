# Block 053 — B2 Adapter Protocol Design

## Pass

**B2 COMPLETE — bounded, versioned, provider-neutral execution-adapter protocol design.** The protocol is additive to the accepted 052 kernel seam. It does not authenticate principals, grant authority, schedule work, own canonical state, or replace the existing adapter routing/commit path. Publication remains unauthorized.

## Scope

The protocol carries one already-authorized execution attempt from the Chord host to an independent adapter participant and returns one narrow `AdapterResult` (or a bounded error). The kernel remains the only scheduler, fence and canonical committer.

Four roles are deliberately separate:

| Role | Responsibility | Not responsible for |
|---|---|---|
| Trusted host | Enrollment, authority installation, route selection, owner acquisition, adapter lifetime | Adapter-authored authority or canonical truth |
| Kernel / owner | Eligibility, claim, final fence check, result normalization, canonical commit | Physical-effect rollback or remote exactly-once |
| Bridge (host side) | Encode one request, match one reply by fresh session/request identity, local timeout/close | Retrying, choosing providers, granting permissions |
| Adapter server / participant | Validate the envelope, execute a local handler, return a correlated result | Scheduling, leases, authority, canonical state |

## Versions and compatibility

- Wire protocol: `chord.adapter-protocol.v1`
- Advertisement descriptor: `chord.adapter-descriptor.v1`
- Execution context: `chord.execution-context.v2` (the existing 052 opt-in context)

Compatibility is descriptive only. `adapterCompatibility()` returns:

| Code | Meaning |
|---|---|
| `COMPATIBLE` | Protocol, required context and requested operations are acceptable |
| `UNSUPPORTED_PROTOCOL` | Adapter does not list the current wire protocol |
| `UNSUPPORTED_EXECUTION_CONTEXT` | Adapter does not opt in to `chord.execution-context.v2` |
| `UNSUPPORTED_OPERATION` | Adapter publishes a non-empty operation allowlist and the requested operation is absent |

An empty adapter operation list means "the adapter does not narrow operations at the advertisement layer"; the reference agent uses this. A non-empty list is an allowlist for the reference local-tool adapter. Neither form grants work. Host route selection and exact-scope authority evaluation still decide whether an attempt exists at all.

## Advertisement

An advertisement contains only descriptive, bounded fields:

```text
{
  protocol_version: 'chord.adapter-descriptor.v1',
  adapter_id, adapter_kind: 'tool' | 'agent' | 'service',
  supported_protocol_versions: string[],
  operations: string[],
  capabilities: string[],
  execution_context: 'chord.execution-context.v2' | null,
  limits: { max_concurrent: 1..1024, timeout_ms: 1..2147483647 | null }
}
```

`adapter_id`, operation names, capability names and versions are validated identifiers/strings. Duplicate versions reject. Limits are advisory; the bridge enforces its own concurrency and timeout bounds.

**An advertisement is not an authority grant.** It cannot install actors, capabilities, grants, approvals or policy, and it cannot replace `evaluateAuthority`.

## Envelopes

Every message is a single JSON string with a bounded parser. The protocol defines:

- `describe` / `describe_result` — optional descriptor lookup.
- `execute` — one kernel-captured execution request.
- `result` — successful normalized adapter result.
- `error` — rejected or unknown adapter failure.
- `cancel` / `cancel_result` — best-effort interruption request, not proof of no effect.
- `shutdown` / `shutdown_result` — orderly bridge-to-participant teardown.

The execute request binds all of the following into one exact envelope:

```text
adapter_id, session_id, request_id,
run_id, incarnation_id,
task_id, task_revision, queue_id,
attempt_id, operation_id, idempotency_key, deadline,
packet, context
```

`session_id` and `request_id` are fresh UUIDv4 delivery identities. They are not authority, durable receipts or kernel task identity. The kernel-supplied task/attempt/operation identity remains authoritative.

The result response must echo `adapter_id`, `session_id`, `request_id`, `run_id`, `incarnation_id`, `task_id`, `attempt_id` and `operation_id`. Any mismatch rejects locally and cannot settle a different pending request. The error response may use `null` for task/attempt/operation only when the request could not be attributed; matching non-null identity must still agree.

## Execution context

The existing 052 context is unchanged:

```text
context = {
  run_id, schema_version, task_id, task_revision, queue_id,
  attempt_id, lease_expires_at,
  coordination: {
    protocol_version: 'chord.execution-context.v2',
    run_id, incarnation_id, owner_id, generation,
    owner_lease_expires_at, dispatch_revision,
    operation_id, attempt_id, idempotency_key
  }
}
```

The stable effect key is exactly:

```text
JSON.stringify(['chord.effect.v1', incarnation_id, run_id, operation_id])
```

It is stable across attempts, readmission and owner generations of the same logical effect. It is not the actor-command operation ID and must not be re-derived from a per-attempt UUID.

The context proves what the kernel captured; it does not prove that a downstream participant atomically enforces the generation or deduplicates the effect. A cooperating service must do both itself.

## Failure classification

- **Rejected** (`classification: 'rejected'`): the participant explicitly refused before producing a result. Examples: unsupported operation, malformed request, adapter identity mismatch, protocol version mismatch.
- **Unknown** (`classification: 'unknown'`): the bridge cannot know whether the participant acted. Examples: local timeout, disconnect, close, transport send failure.

At the kernel boundary, any adapter throw or bridge rejection remains post-dispatch ambiguity under current 052 rules. The bridge's local classification does not rewrite canonical state and does not assert physical non-execution.

## Lifecycle

- `execute(packet, context)` — one request, one eventual result/rejection. The bridge enforces `max_concurrent`.
- `describe()` — optional descriptor refresh.
- `cancel({request_id|attempt_id|operation_id|task_id})` — best-effort cancel of a matching pending request. Returns an acknowledgement or `NO_PENDING_REQUEST`. It does not remove the pending execution.
- `shutdown()` — best-effort orderly shutdown, then local close.
- `close()` — idempotent local retirement; rejects all pending work and detaches listeners. It does not terminate the participant or undo an effect.

## Exclusions

The protocol does not provide: principal authentication, grants, approvals, ownership, scheduling, generic method dispatch, arbitrary shell execution, provider discovery, network registry, retry/replay, remote exactly-once, a second journal, or a second canonical state. Those remain outside this layer by design.

## Acceptance cases carried forward

- Legacy raw `{ execute }` adapters remain unchanged.
- Descriptor compatibility is never a grant.
- Unsupported protocol/context fails before effect.
- Captured callable semantics are preserved.
- Stale, duplicate, reordered and replacement-session replies are ignored or rejected locally.
- Timeout/close followed by late success/throw cannot touch a new attempt.
- The kernel stamps canonical results; adapter data cannot supply task/attempt/run identity.
- Unknown/reconciliation behavior remains conservative.
- Dual-runtime import and lazy SQLite behavior are unchanged.
