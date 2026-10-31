# Block 053 — B8 Developer Guide: Adapter Interoperability

## Status

Experimental, additive, provider-neutral. Import from `@antistructured/chord/interop` or from the root package. Publication is not authorized. No API stability is claimed.

## Quick reference

```js
import {
  ADAPTER_CONTEXT_VERSION,
  createAdapterBridge,
  createAdapterServer,
  createLocalToolAdapter,
  createMockAgentAdapter,
  createMemoryTransportPair
} from '@antistructured/chord/interop';
```

| Factory | Use |
|---|---|
| `createAdapterBridge({ advertisement, transport, timeoutMs? })` | Host-side client registered with the coordinated kernel |
| `createAdapterServer({ advertisement, handle, channel?, idempotency?, onCancel?, onShutdown? })` | Participant-side server around a local handler |
| `createLocalToolAdapter({ adapter_id?, operations })` | Reference allowlisted local tool |
| `createMockAgentAdapter({ adapter_id?, responder? })` | Reference deterministic agent |
| `createMemoryTransportPair({ delayMs? })` | Local duplex transport for tests/examples |

## Host integration

```js
const adapter = createMockAgentAdapter();
const pair = createMemoryTransportPair();
const server = createAdapterServer({
  advertisement: adapter.advertisement,
  handle: adapter.handle,
  channel: pair.right
});
const bridge = createAdapterBridge({
  advertisement: adapter.advertisement,
  transport: pair.left,
  timeoutMs: 5000
});

const chord = createCoordinatedChord({
  storage: { path, mode: 'create', expectedIdentity: null },
  trustedHost: { clock },
  adapterRouter: {
    fallback: { adapter: bridge, execution_context: ADAPTER_CONTEXT_VERSION }
  }
});
```

Install authority and submit work through the normal host/actor paths. Then:

```js
chord.owner.acquire({ expectedRevision: 0 });
const cycle = await chord.owner.runCycle();
const envelope = chord.observer.exportEnvelope();
```

Close explicitly:

```js
bridge.close();
server.close();
pair.close();
chord.owner.close();
```

## Participant integration

```js
import { createAdapterServer } from '@antistructured/chord/interop';

const server = createAdapterServer({
  advertisement,
  channel: process,              // any { connected?, on, off, send }
  async handle(request) {
    // request.packet, request.context, request.idempotency_key
    return { status: 'completed', outcome: 'succeeded', summary: 'done' };
  },
  onShutdown: () => process.exit(0)
});
```

The handler receives the validated request envelope. It must return an `AdapterResult` shape. The server owns correlation, error wrapping and the local idempotency cache.

## Adapter contract

Required:

```text
{
  protocol_version: 'chord.adapter-descriptor.v1',
  adapter_id: string,
  adapter_kind: 'tool' | 'agent' | 'service',
  supported_protocol_versions: string[],
  operations: string[],
  capabilities: string[],
  execution_context: 'chord.execution-context.v2' | null,
  limits: { max_concurrent: number, timeout_ms: number | null }
}
```

Use `AdapterAdvertisement.assert(value)` for validation. The bridge and server reject advertisements that do not support `chord.adapter-protocol.v1` and `chord.execution-context.v2`.

## Error codes

| Code | Source | Meaning |
|---|---|---|
| `UNSUPPORTED_PROTOCOL` | compatibility/server | Adapter does not support the wire protocol |
| `UNSUPPORTED_EXECUTION_CONTEXT` | compatibility | Adapter does not opt in to v2 context |
| `UNSUPPORTED_OPERATION` | reference tool | Action not in the allowlist |
| `ADAPTER_ID_MISMATCH` | bridge/server | Reply/request adapter identity differs |
| `ADAPTER_SESSION_MISMATCH` | bridge | Reply belongs to another bridge session |
| `ADAPTER_REQUEST_MISMATCH` | bridge | Reply belongs to another request |
| `ADAPTER_IDENTITY_MISMATCH` | bridge | Run/incarnation/task/attempt/operation differs |
| `ADAPTER_PROTOCOL_ERROR` | bridge | Malformed or invalid protocol frame |
| `ADAPTER_COMMAND_TIMEOUT` | bridge | Local wait expired; classification `unknown` |
| `ADAPTER_CHANNEL_CLOSED` | bridge | Transport closed/disconnected; classification `unknown` |
| `ADAPTER_CONCURRENCY_LIMIT` | bridge | Local pending limit reached |

Adapter-authored error codes are normalized to `[A-Z0-9_]{1,64}` and preserved when valid. Classification is `rejected` only when the participant explicitly rejected; otherwise `unknown`.

## Timeouts

`timeoutMs` bounds the local wait only. It does not cancel the participant, prove non-execution or authorize a retry. A late reply cannot settle a newer request. Default is no timeout (`null`); `shutdown()` uses a bounded default of 5 seconds when no timeout is configured.

## Cancellation

```js
const acknowledgement = await bridge.cancel({ attempt_id });
// or { request_id } / { operation_id } / { task_id }
```

If a matching pending execution exists, the bridge sends a cancel envelope and resolves with the participant's acknowledgement. If not, it resolves `{ acknowledged: false, reason: 'NO_PENDING_REQUEST' }`. Cancellation does not remove the pending execution or assert that no effect occurred.

## Shutdown

```js
await bridge.shutdown();
```

Sends one shutdown envelope, waits up to the configured/default bound, then closes locally. It does not guarantee the participant process exited; the host must join/kill it.

## Transport requirements

```text
connected?: boolean
on(event, listener)
off(event, listener)
send(string, callback?)
```

Events: `message`, `disconnect`, `close`. Node/Bun inherited IPC works. The memory pair works. A network transport must add authentication, framing and lifecycle management outside this protocol.

## Security boundaries

- Adapter advertisement is descriptive, never a grant.
- The bridge receives no SDK, storage, owner credential, grants or arbitrary host methods.
- The protocol does not authenticate principals or peers.
- In-process handlers are not sandboxed.
- Adapter result identity is correlation data; the kernel stamps canonical identity.
- Timeout/close/cancel are local lifecycle events, not effect truth.

## Testing your adapter

Use the memory pair and the reference worker as a template:

```bash
bun test tests/adapter-protocol.test.js
node --test tests/adapter-protocol.test.js
bun run examples/adapter-interop.mjs
```

Assert at minimum: exact advertisement validation, unsupported operation rejection, identity-correct result, duplicate/reordered reply handling, timeout/close behavior and one kernel round trip.

## Related

- [Protocol design](053-adapter-protocol.md)
- [Runtime implementation](053-adapter-runtime.md)
- [Effect safety](053-effect-safety.md)
- [Reference adapters](053-reference-adapters.md)
- [Consumer integration](053-consumer-integration.md)
- [Conformance](053-protocol-conformance.md)
