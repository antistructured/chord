# Block 053 — B6 Consumer Integration

## Pass

**B6 COMPLETE — public-export-only consumer example installed and verified on Node and Bun.** `examples/adapter-interop.mjs` shows the complete path: coordinated kernel → adapter bridge → memory transport → adapter server → reference mock agent → canonical result.

## Run it

From `packages/core`:

```bash
bun run examples/adapter-interop.mjs
# or
node examples/adapter-interop.mjs
```

Both print:

```json
{"ok":true,"adapter":"chord.mock-agent","protocol":"chord.adapter-protocol.v1","task_status":"completed","summary":"mock-agent:task-interop","replay_matches":true,"server_executions":1}
```

## What the example proves

1. A coordinated v2 kernel is created with `adapterRouter.fallback = { adapter: bridge, execution_context: 'chord.execution-context.v2' }`.
2. The host installs exact-scope authority and submits one work packet through an authenticated actor ingress.
3. `owner.runCycle()` claims the task and invokes the bridge.
4. The bridge sends one bounded execute envelope over the memory transport.
5. The server validates the envelope, calls the mock agent once and returns a correlated result.
6. The kernel commits one canonical execution result.
7. `observer.replayEnvelope()` equals the exported envelope.
8. A second cycle would be skipped; the example does not re-execute.

## Integration steps

### 1. Create the participant and channel

```js
const adapter = createMockAgentAdapter();
const pair = createMemoryTransportPair();
const server = createAdapterServer({
  advertisement: adapter.advertisement,
  handle: adapter.handle,
  channel: pair.right
});
```

### 2. Create the host bridge

```js
const bridge = createAdapterBridge({
  advertisement: adapter.advertisement,
  transport: pair.left,
  timeoutMs: 5000
});
```

### 3. Register it with the existing kernel seam

```js
const chord = createCoordinatedChord({
  storage: { path, mode: 'create', expectedIdentity: null },
  trustedHost: { clock },
  adapterRouter: {
    fallback: { adapter: bridge, execution_context: ADAPTER_CONTEXT_VERSION }
  }
});
```

No new kernel option, export or storage mode is required.

### 4. Install authority and submit work normally

The example uses the public `createActorIngress` and a host-attested binding. The adapter does not receive the binding, credential, grant or storage path.

### 5. Run cycles and inspect canonical state

```js
const cycle = await chord.owner.runCycle();
const envelope = chord.observer.exportEnvelope();
```

The canonical result is the normalized `AdapterResult`; protocol correlation fields are not copied into canonical task identity.

### 6. Close resources explicitly

```js
bridge.close();
server.close();
pair.close();
chord.owner.close();
```

Close is local retirement. It does not prove remote cancellation or effect absence.

## Production transport

Replace the memory pair with a real duplex transport that satisfies:

```text
connected?: boolean
on(event, listener)
off(event, listener)
send(string, callback?)
```

For Node/Bun child processes, the inherited IPC channel already satisfies this shape; see `tests/adapter-protocol-worker.js` for a real `fork()` participant. For network transports, the host must add authentication, framing limits, reconnection policy and participant lifecycle management outside this protocol layer.

## What this example does not claim

- No npm install or tarball extraction was performed.
- No network service, cloud provider or model API is contacted.
- No real external business effect is written.
- No exactly-once or distributed consensus is provided.
- The memory transport does not authenticate peers.

## Related docs

- [Protocol design](053-adapter-protocol.md)
- [Runtime implementation](053-adapter-runtime.md)
- [Effect and fence safety](053-effect-safety.md)
- [Reference adapters](053-reference-adapters.md)
- [Conformance](053-protocol-conformance.md)
- [Developer guide](053-developer-guide.md)
