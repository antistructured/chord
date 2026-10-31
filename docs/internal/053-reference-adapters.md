# Block 053 — B5 Reference Adapters and Memory Transport

## Pass

**B5 COMPLETE — two reference participants and one in-memory transport are installed for conformance tests, examples and local embedding.** They are deliberately small and deterministic. They are not production provider integrations.

## Reference Adapter A — local tool

```js
import { createLocalToolAdapter } from '@antistructured/chord/interop';

const adapter = createLocalToolAdapter({
  adapter_id: 'chord.local-tool',
  operations: {
    'local.echo': ({ packet, context, request }) => ({
      summary: `echo:${packet.task_id}`,
      outputs: { task_id: packet.task_id }
    })
  }
});
```

Properties:

- Requires a non-empty own operation map whose values are functions.
- Publishes exactly those operation names in its advertisement.
- Rejects any requested action outside the allowlist with `UNSUPPORTED_OPERATION` / `rejected` before invoking a handler.
- Has no shell, dynamic import, `eval`, network or filesystem helper. Hosts may of course write handlers that do those things, but the reference adapter itself does not.
- Returns a validated `AdapterResult`; the handler may return the `{ status, outcome, ... }` shape directly.

The operation allowlist is an adapter-level guard, not a grant. The kernel still decides whether the task may run.

## Reference Adapter B — mock agent

```js
import { createMockAgentAdapter } from '@antistructured/chord/interop';

const agent = createMockAgentAdapter();
```

Behavior is deterministic:

| Requested action | Result |
|---|---|
| `work` (or any other non-prefixed action) | `completed` / `succeeded` |
| `fail.*` | `failed` / `failed` |
| `block.*` | `blocked` / `blocked` |

The summary is `mock-agent:<task_id>` for completed work. The adapter publishes an empty operation list, meaning it does not narrow operations at the advertisement layer. It accepts an optional `responder(request)` for tests that need a custom result.

Neither reference adapter inspects authority, ownership, leases or canonical storage. Neither writes an external business effect. They exist to prove protocol shape, correlation and lifecycle behavior.

## Memory transport

```js
import { createMemoryTransportPair } from '@antistructured/chord/interop';

const pair = createMemoryTransportPair();          // asynchronous, zero-delay
const slow = createMemoryTransportPair({ delayMs: 50 });
```

Each endpoint has `connected`, `on`, `off`, `send` and `close`. Delivery is asynchronous through `queueMicrotask` (or `setTimeout` when `delayMs > 0`). Closing one endpoint emits `close`/`disconnect` on both and causes later sends to fail with `ADAPTER_CHANNEL_CLOSED`.

The pair is for tests, examples and local embedding only. It provides no authentication, framing beyond the protocol JSON string, process isolation or network transport.

## Minimal wiring

```js
import {
  ADAPTER_CONTEXT_VERSION,
  createAdapterBridge,
  createAdapterServer,
  createMockAgentAdapter,
  createMemoryTransportPair
} from '@antistructured/chord/interop';

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
```

Register `bridge` as the existing opt-in adapter:

```js
adapterRouter: {
  fallback: {
    adapter: bridge,
    execution_context: ADAPTER_CONTEXT_VERSION
  }
}
```

## Trust notes

- The server trusts the participant handler. A hostile in-process handler can do anything the host process allows.
- The bridge does not sandbox the participant.
- The memory transport does not authenticate the peer.
- The reference adapters are not a model runtime, agent framework, tool sandbox or durable effect store.
- Do not expose `createAdapterServer` directly to untrusted network input without an authenticated, bounded transport and a separately reviewed handler.

## Verification

`tests/adapter-protocol.test.js` exercises both adapters, the memory transport, a real child process using the mock agent, and a coordinated kernel round trip. `examples/adapter-interop.mjs` uses the same public exports.
