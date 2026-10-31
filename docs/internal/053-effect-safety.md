# Block 053 — B4 Effect and Fence Safety

## Pass

**B4 COMPLETE — protocol does not widen the accepted 052 effect boundary.** The bridge is an adapter callable, not a scheduler, authority evaluator or canonical writer. All canonical acceptance still passes the existing coordinated owner/attempt/authority/lease fences.

## Safety properties

### 1. Compatibility is not authority

Advertisement, compatibility and routing answer only "can this participant speak the protocol and handle this operation?" They do not install actors, capabilities, grants, approvals or policy. An adapter cannot admit work by advertising a capability. The kernel evaluates exact-scope authority before a claim exists.

### 2. The kernel captures the callable and context

`runCycle()` captures the adapter callable, packet and context under the synchronous guard before committing the claim. The bridge does not receive SDK, storage, owner credentials, grants or arbitrary host methods. Its closure contains only the advertisement, transport and local bookkeeping.

### 3. The stable effect key is preserved

The bridge transports the kernel-derived key:

```text
JSON.stringify(['chord.effect.v1', incarnation_id, run_id, operation_id])
```

It does not invent a per-attempt key. A participant can use this key for local deduplication, but that does not create a canonical receipt or authorize automatic replay.

### 4. Reply identity is exact

A result/error can settle only the pending entry with the same fresh `request_id` and the same bridge `session_id`. The response must also echo the captured run/incarnation/task/attempt/operation identity. Duplicate, reordered, stale-session and unknown replies are ignored. A malformed matching reply rejects locally as `ADAPTER_PROTOCOL_ERROR`.

This protects against the historical 052A failure mode where unrelated or stale delivery identity was allowed to settle a newer command.

### 5. Timeout, close and disconnect are local truth only

- Timeout rejects the local wait as `unknown`.
- Close/disconnect rejects all pending work as `ADAPTER_CHANNEL_CLOSED` / `unknown`.
- A late success or throw cannot settle a newer request because the old request ID no longer belongs to the new pending entry.
- None of these events proves the participant did not act, and none triggers retry or compensation.

### 6. Adapter errors remain post-dispatch ambiguity

The coordinated runtime still catches any adapter throw and records `ADAPTER_ERROR`. A protocol rejection, participant crash or malformed reply does not become "not executed" and does not authorize a fresh operation key. Existing reconciliation/readmission rules remain the only path out of uncertainty.

### 7. Late results cannot commit after release

Integration test `a delayed adapter result after owner release cannot commit canonical state` dispatches through the bridge, releases the owner while the adapter reply is delayed, then lets the result arrive. The canonical envelope contains zero execution results and the task is not completed. The stale owner/attempt fence rejects the outcome exactly as it does for a raw adapter.

### 8. Adapter data cannot stamp canonical identity

The kernel normalizes `AdapterResult` and stamps run/schema/task revision/queue/attempt from captured state. The protocol response echoes identity for correlation, but the kernel does not accept adapter-authored task/run/attempt identity as canonical data.

### 9. Server idempotency is not exactly-once

The adapter server caches successful results by stable effect key for its own lifetime. This avoids invoking the same handler twice on a repeated execute during one session. It is not durable, not canonical, and does not make the external effect atomic with the kernel commit. A restarted participant has no cache.

## Residual distributed race

The final authoritative database check and the external callable are still not atomic. Another owner can take over after the check; an old participant can physically act before observing a newer generation. The protocol reduces ambiguity and rejects stale replies locally, but it does not create distributed consensus, universal stale-effect prevention or exactly-once effects.

A cooperating downstream that needs stronger guarantees must atomically:

1. reject observed lower generations in namespace `(incarnation_id, run_id)`, and
2. deduplicate the stable effect key while detecting semantic payload mismatch.

The protocol transports the evidence; it does not enforce those downstream rules.

## Test evidence

Covered in `tests/adapter-protocol.test.js`:

- wrong run/incarnation/task/attempt/operation reply identity rejects;
- duplicate and reordered responses settle only their exact request;
- replacement bridge ignores old-session replies;
- timeout followed by a late reply cannot settle a newer request;
- close and disconnect reject pending work and detach listeners;
- adapter crash/disconnect leaves no canonical claim;
- unsupported protocol/adapter identity fails before handler execution;
- delayed result after owner release cannot commit;
- real child-process adapter preserves identity and shuts down cleanly.
