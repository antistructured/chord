# Block 054 — Pass 3: Adapter Conformance Suite

**Agent:** conformance-agent  
**Status:** COMPLETE  
**Date:** 2026-10-30  
**Publication:** NOT AUTHORIZED

## Deliverable

The additive public export `runAdapterConformance` is available from both `@antistructured/chord` and
`@antistructured/chord/interop`. It runs a framework-neutral conformance report against an adapter
fixture shaped as `{ advertisement, handle }`. It does not grant authority, create a scheduler, persist
state or make a provider effect canonical.

```js
import { runAdapterConformance } from '@antistructured/chord/interop';

const report = await runAdapterConformance({
  adapter: { advertisement, handle },
  action: 'local.echo',
  timeoutMs: 1000
});

if (!report.ok) {
  for (const check of report.checks.filter(item => item.status === 'fail')) {
    console.error(check.id, check.code, check.detail);
  }
}
```

`action` is optional. The runner uses the first advertised operation, or `work` when the advertisement
has no operations. `timeoutMs` defaults to 1000 and must be a positive safe integer no greater than
`2_147_483_647`.

## Report shape

```js
{
  ok: boolean,
  adapter_id: string | null,
  protocol_version: "chord.adapter-protocol.v1",
  checks: [
    {
      id: string,
      category: "adapter" | "protocol" | "safety",
      name: string,
      status: "pass" | "fail" | "skip",
      detail?: string,
      code?: string,
      reason?: string
    }
  ],
  summary: { total: number, passed: number, failed: number, skipped: number }
}
```

The report is frozen. A skip is not a pass: it records a check that this generic runner cannot force
without a deliberately defective or long-running participant. Failures never throw out of the runner;
they are reported with a stable `code` and a bounded `detail`.

## Adapter checks

| Check | Assertion |
|---|---|
| `adapter.interface` | Advertisement validates and `handle` is a function |
| `adapter.supported_version` | Advertisement includes the current protocol version |
| `adapter.execution_context` | Advertisement declares the current execution context |
| `adapter.capabilities_descriptive` | Compatibility reports only `compatible` and `code`; no grant or authority |
| `adapter.describe` | Describe round-trip returns the advertised descriptor |
| `adapter.valid_outcome` | Advertised action returns a valid completed/failed/blocked `AdapterResult` |
| `adapter.request_identity` | Handler receives exact run, incarnation, task, attempt, operation and idempotency identity |
| `adapter.stable_effect_key` | Effect key is `["chord.effect.v1", incarnation_id, run_id, operation_id]` |
| `adapter.input_isolation` | Handler receives detached packet/context copies |
| `adapter.no_authority_fields` | Packet/context carry no authority, grant or credential field |
| `adapter.shutdown` | Shutdown is acknowledged and recorded by the participant server |
| `adapter.cancellation` | Skipped: requires a deliberately long-running adapter; protocol cancellation is covered |
| `adapter.timeout` | Skipped: requires a deliberately non-responsive adapter; protocol timeout is covered |
| `adapter.invalid_response` | Skipped: requires a deliberately malformed participant; protocol rejection is covered |

## Protocol and safety checks

| Check | Assertion |
|---|---|
| `protocol.reference_outcomes` | Reference adapter returns completed, failed and blocked outcomes |
| `protocol.describe` | Describe request/response correlation |
| `protocol.unsupported_version` | Unsupported version rejects before the handler runs |
| `protocol.adapter_id_mismatch` | Foreign adapter identity rejects before the handler runs |
| `protocol.invalid_result` | Malformed matching result is rejected locally |
| `protocol.identity_mismatch` | Wrong task identity rejects instead of settling |
| `protocol.reordered_duplicate` | Reordered replies settle their own request; duplicate old replies settle nothing |
| `protocol.stale_replacement` | Old-session reply cannot settle a replacement bridge |
| `protocol.timeout` | Local timeout rejects with `unknown` classification |
| `protocol.close_disconnect` | Close/disconnect reject outstanding work and detach listeners |
| `protocol.cancel` | Active cancellation is acknowledged; late result remains delivery-only |
| `protocol.idempotency` | Stable effect key deduplicates without re-executing |
| `protocol.bounded_concurrency` | Bridge enforces `max_concurrent` |
| `protocol.no_retry_after_error` | Adapter error rejects once without automatic retry |
| `protocol.shutdown` | Shutdown is acknowledged and recorded |
| `protocol.no_authority_from_advertisement` | Advertisement capability is not authority |
| `safety.no_effect_on_replay` | Skipped: kernel replay is covered by the 052/053 kernel suites; the adapter protocol has no replay path |
| `safety.stale_owner_result` | Skipped: kernel fencing is covered by the 052/053 kernel suites; stale protocol replies are covered |

## Defect found and corrected

The conformance suite exposed a real bridge defect: `describe_result` has no `session_id`, but the
bridge applied the session check to every control response. `bridge.describe()` therefore timed out
even against the reference participant. The bridge now applies the session check to cancel and
shutdown controls only; describe is validated by adapter ID and request ID. A direct regression test
was added to `tests/adapter-protocol.test.js`.

## Verification

Run from `packages/core`:

```bash
bun test tests/adapter-conformance.test.js tests/adapter-protocol.test.js
node --test tests/adapter-conformance.test.js tests/adapter-protocol.test.js
bun run examples/adapter-conformance.mjs
node examples/adapter-conformance.mjs
```

Expected example result: `ok: true` for both the mock agent and local tool adapter, with zero failures.

## Not claimed

- No proof that a consumer adapter performs the physical effect exactly once.
- No durable participant idempotency cache, network transport, remote authentication or consensus.
- No conformance claim for an adapter that requires a specific long-running, crashing or malformed
  participant fixture; those cases are protocol-tested with built-in probes.
- No authority grant from a passing report. The kernel still schedules, fences and commits.

## Gate

The conformance utility is public, documented, tested against passing and deliberately defective
adapters, and detects a real lifecycle defect. Proceed to Pass 4.
