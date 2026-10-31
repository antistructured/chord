# Block 053 — B3 Adapter Runtime Implementation

## Pass

**B3 COMPLETE — pure protocol contracts, imperative bridge, trusted adapter server, memory transport and public `./interop` export installed.** The existing coordinated `runCycle` path is unchanged except that a registered bridge is a normal adapter object behind `{ adapter, execution_context: 'chord.execution-context.v2' }`.

## Modules

| Path | Kind | Responsibility |
|---|---|---|
| `src/interop/adapter-protocol.js` | pure | Versions, SigilJS contracts, compatibility, wire parsing, response validation, error construction |
| `src/interop/adapter-bridge.js` | shell | Host-side request/reply matching, pending/control maps, timeout, close, cancel, shutdown |
| `src/interop/adapter-server.js` | shell | Participant-side validation, handler invocation, idempotency cache, cancel/describe/shutdown |
| `src/interop/reference-adapters.js` | shell | Local allowlisted tool adapter and deterministic mock agent |
| `src/interop/memory-transport.js` | shell | In-memory transport pair for tests/examples/local embedding |
| `src/interop/index.js` | public | `./interop` entry point |

The protocol module has no timers, I/O, process access, random IDs or ambient clock. IDs and timers live in the shells.

## Bridge

`createAdapterBridge({ advertisement, transport, timeoutMs = null })`

- Validates and freezes the advertisement.
- Creates one fresh `session_id` per bridge instance.
- Holds `pending` executions and `controls` for describe/cancel/shutdown.
- Sends one `execute` request with a fresh `request_id` and the kernel-captured context.
- Settles only the exact pending entry whose `request_id` matches. A stale session, duplicate response, reordered response or unknown request ID is ignored.
- Rejects a matching malformed frame locally as `ADAPTER_PROTOCOL_ERROR`.
- Maps contract validation failures to `ADAPTER_PROTOCOL_ERROR`; preserves explicit `ADAPTER_*` codes.
- Enforces `max_concurrent` before sending.
- Optional `timeoutMs` rejects the local wait with `ADAPTER_COMMAND_TIMEOUT` / `unknown`. A late reply cannot settle a newer request because request IDs are per send.
- `close()` is idempotent, detaches `message`/`disconnect`/`close` listeners and rejects all pending/control work with `ADAPTER_CHANNEL_CLOSED`.
- `shutdown()` attempts one bounded shutdown envelope, then closes locally even if the participant never answers.

The bridge does not retry, re-route, re-authorize, inspect canonical storage or choose a provider.

## Server

`createAdapterServer({ advertisement, handle, channel = process, idempotency = true, onCancel = null, onShutdown = null })`

- Validates every incoming execute envelope against the advertised protocol, adapter identity and context.
- Requires the advertisement to support the current protocol and `chord.execution-context.v2`.
- Calls the participant handler only after validation.
- Wraps the handler result in the exact result envelope and echoes the request identity.
- Converts handler failures to bounded error envelopes.
- Keeps an in-memory idempotency cache keyed by the kernel-supplied stable effect key. A duplicate execute with the same key returns the cached result without invoking the handler again.
- Answers cancel only for an active request; acknowledgement is not evidence of effect absence.
- Answers describe from the advertisement.
- Answers shutdown, then closes its listener.
- `close()` is idempotent and does not terminate the participant process.

The cache is participant-local convenience, not a durable effect ledger. A restarted participant starts with an empty cache.

## Kernel registration

No new registration shape is required. Use the existing 052 opt-in:

```js
const bridge = createAdapterBridge({ advertisement, transport });
const chord = createCoordinatedChord({
  storage,
  trustedHost,
  adapterRouter: {
    fallback: { adapter: bridge, execution_context: 'chord.execution-context.v2' }
  }
});
```

`runCycle()` still selects ready work, plans the exact operation/attempt, captures the callable/context, commits the claim, performs the fresh final dispatch check, invokes the captured callable, then commits the outcome through the existing owner fences. The bridge is only the callable.

Legacy registrations remain plain `{ execute(packet, context) }` and receive the legacy shallow context with no `context.coordination`.

## Public exports

`./interop` exports 28 names:

- Constants: `ADAPTER_PROTOCOL_VERSION`, `ADAPTER_DESCRIPTOR_VERSION`, `ADAPTER_CONTEXT_VERSION`, `ADAPTER_KINDS`, `ADAPTER_MESSAGE_TYPES`.
- Contracts: `AdapterAdvertisement`, `AdapterExecutionContext`, `AdapterContext`, `AdapterExecuteRequest`, `AdapterResultResponse`, `AdapterErrorResponse`, `AdapterDescribeRequest`, `AdapterDescribeResponse`, `AdapterCancelRequest`, `AdapterCancelResponse`, `AdapterShutdownRequest`, `AdapterShutdownResponse`.
- Functions: `adapterCompatibility`, `assertAdapterCompatibility`, `adapterError`, `parseAdapterWire`, `validateAdapterExecuteRequest`, `validateAdapterResponse`, `createAdapterBridge`, `createAdapterServer`, `createLocalToolAdapter`, `createMockAgentAdapter`, `createMemoryTransportPair`.

The root entry point re-exports these names additively; existing exports are unchanged.

## Transport contract

A transport is any object with:

```text
connected?: boolean
on(event, listener)
off(event, listener)
send(string, callback?)
```

Events used: `message`, `disconnect`, `close`. Node/Bun inherited IPC satisfies this shape. The memory pair provides the same shape for local tests/examples.

## Failure and resource ownership

| Event | Bridge | Kernel |
|---|---|---|
| Unsupported protocol/context | Rejects before sending | No effect |
| Adapter error response | Rejects with adapter code/classification | Post-dispatch outcome rules apply |
| Timeout/disconnect/close | Rejects local wait as unknown | No compensation or retry |
| Duplicate/reordered reply | Ignored or settled only by exact request ID | Unaffected |
| Shutdown | Sends bounded request, then local close | Host orchestrates process lifetime |

The bridge never mutates canonical data and never claims remote cancellation. The kernel never trusts adapter-supplied task/run/attempt identity.

## Verification

- `tests/adapter-protocol.test.js`: 16 tests, including a real child-process adapter and two coordinated-kernel integrations.
- `examples/adapter-interop.mjs`: kernel → bridge → memory transport → server → mock agent, verified on Node 24.22.1 and Bun 1.4.3.
- Full Bun suite: 422 pass / 0 fail / 29 files.
- New test file under Node `--test`: 16 pass / 0 fail.
