# Integrate an execution adapter

[Setup](README.md#setup) first. From the repository root:

```bash
"$N" packages/core/examples/adapter-interop.mjs
"$B" packages/core/examples/adapter-interop.mjs
```

The [public-export-only example](../../packages/core/examples/adapter-interop.mjs) prints `ok:true`,
`task_status:"completed"`, `replay_matches:true` and `server_executions:1`. It uses the real coordinated
kernel with a mock agent and **memory transport**, not a network or independent participant process.
It creates a fresh local store, installs exact authority, submits via authenticated host ingress,
executes through the bridge/server, commits and checks combined zero-effect replay.

Follow that script rather than constructing guessed private fixtures:

1. Build a reference `createMockAgentAdapter` / allowlisted `createLocalToolAdapter`, or an independent
   handler and exact advertisement. Use root or `@antistructured/chord/interop` public exports.
2. Create `createAdapterServer({advertisement,handle,channel})` on the participant transport and
   `createAdapterBridge({advertisement,transport,timeoutMs})` on the host transport.
3. Register `{adapter:bridge,execution_context:ADAPTER_CONTEXT_VERSION}` in the coordinated router.
   Acquire the kernel owner, install authority/policy and submit work through normal actor paths.
4. The kernel captures task/attempt/operation identity and stable effect key. The bridge correlates
   delivery; the participant invokes the handler. Only the kernel accepts canonical results.
5. In `finally`, close bridge, server and transport, then kernel handle after work drains. For child
   transports also disconnect/join the actual process. The example owns and removes its scratch store.

An adapter is **not actor IPC**: it receives scheduled execution, not permission to install grants,
authenticate humans or dispatch arbitrary host calls. Advertisement/capability compatibility is not
authority. Chord is framework-neutral; integrate your provider outside the kernel and keep secrets
out of persisted packet/output data. Network authentication/framing/resource supervision are host work.

`bridge.cancel({target_request_id})` selects a pending request; alternative selectors are `attempt_id`,
`operation_id` or `task_id`, **not `request_id`**. Acknowledgement does not settle the execution or
prove cancellation. `bridge.close()` retires local waits, not the remote handler/transport.
`await bridge.shutdown()` returns a local lifecycle result even when the bounded handshake fails;
`true` is not remote acknowledgement or process exit. A timeout is unknown, never safe-to-retry evidence.
See [the exact API](../../packages/core/README.md#experimental-adapter-interoperability-053).

The server's sequential validated-result cache is in-memory, not durable semantic dedupe or
concurrent effect coalescing. Downstream services must enforce generation fencing and stable-key
semantic idempotency where required; propagation of context alone enforces neither. The final DB
check and physical invocation are not atomic. See [unknown outcomes](README.md#unknown-means-reconcile-not-retry)
and [conformance testing](conformance.md) before extending beyond safe mock effects.
