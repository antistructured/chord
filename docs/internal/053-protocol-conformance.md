# Block 053 — B7 Protocol Conformance and Adversarial Tests

## Pass

**B7 COMPLETE — 16 new tests pass on Bun and on the new file under Node, including a real child-process participant and two coordinated-kernel integrations.** The full Bun suite is green at **422 pass / 0 fail / 29 files**.

## Test file

`packages/core/tests/adapter-protocol.test.js`

Helpers construct exact 052-style packets/contexts. A `FakeChannel` gives deterministic manual replies for adversarial correlation cases. A memory transport pair drives normal round trips. A forked worker (`tests/adapter-protocol-worker.js`) drives real inherited IPC.

## Conformance matrix

| # | Case | Assertion |
|---|---|---|
| 1 | Advertisement/compatibility | Descriptor is descriptive; unsupported protocol, context and operation are rejected explicitly |
| 2 | Local tool adapter | Only allowlisted operations execute; a non-allowlisted action rejects before the handler |
| 3 | Mock agent | Deterministic completed/failed/blocked results; three server executions |
| 4 | Wrong reply identity | Wrong run/incarnation/task/attempt/operation rejects, never settles |
| 5 | Duplicate/reordered replies | B then A resolve their own promises; duplicate A cannot settle C |
| 6 | Old session/replacement bridge | Old-session reply ignored; new request settles only with new reply |
| 7 | Timeout + late reply | Local timeout rejects as unknown; late A cannot settle B |
| 8 | Malformed frames | Malformed JSON/unattributable frames ignored; matching malformed frame rejects locally |
| 9 | Close/disconnect | Pending work rejects, listeners detach, close is idempotent |
| 10 | Cancel | Active request acknowledged; late result still delivers; no pending returns `NO_PENDING_REQUEST` |
| 11 | Server idempotency | Same stable effect key returns cached result; handler called once |
| 12 | Unsupported protocol/adapter ID | Handler called zero times; explicit error response |
| 13 | Crash/disconnect | Pending bridge rejects with `ADAPTER_CHANNEL_CLOSED` |
| 14 | Real child process | `fork()` worker advertises, executes, returns identity-correct result and exits cleanly after shutdown |
| 15 | Coordinated kernel round trip | One bridge/server call; canonical task completed; one execution result; replay equals export; second cycle skipped |
| 16 | Delayed result after owner release | No execution result and no completion after release; stale fence wins |

## Commands and results

Run from `packages/core`:

```bash
# New file, Bun
/home/d/.bun/bin/bun test tests/adapter-protocol.test.js
# 16 pass / 0 fail

# New file, Node
/home/d/.volta/tools/image/node/24.22.1/bin/node --test tests/adapter-protocol.test.js
# 16 pass / 0 fail

# Full suite, Bun (canonical)
/home/d/.bun/bin/bun test
# 422 pass / 0 fail / 1759 expect() calls / 29 files / ~106s

# Consumer example
/home/d/.bun/bin/bun run examples/adapter-interop.mjs
/home/d/.volta/tools/image/node/24.22.1/bin/node examples/adapter-interop.mjs
# Both print the same successful JSON
```

The repository historically imports `bun:test` in many test files. A full Node `--test tests/*.test.js` run therefore cannot execute those files; the new file itself is runtime-neutral and passes under Node. This is the same limitation recorded in B1.

**Environment note:** a later full-suite rerun under heavy host load (load average ~13 on 8 cores) hit the pre-existing 5s per-test timeouts in `actor-ingress.test.js` and the 20s child seam timeout in `coordinated-adversarial.test.js`, with worker `STORAGE_UNAVAILABLE`. Isolated `actor-ingress.test.js` with `--timeout 30000` passed **18/18**, and the new interop file passed again. This matches B1's open P2 test/process reliability observation; it is not a change to the interop code path.

## Adversarial coverage details

### Identity and ordering

The bridge looks up pending work by the exact fresh `request_id`, checks the bridge `session_id`, then validates all kernel identity fields. A reply with a valid shape but foreign identity rejects only the matching pending entry. Unknown request IDs are ignored. This prevents cross-talk between concurrent executions and between a retired and a replacement bridge.

### Duplicate delivery

The server's idempotency cache is keyed by the stable effect key, not by request ID. A repeated execute with the same key and a fresh request ID returns the cached result without re-invoking the handler. The bridge's pending map is keyed by request ID, so a duplicate response to an already-settled request is ignored.

### Timeout and lifecycle

Timeout is local only. The bridge does not send a compensating write, retry or auto-cancel. A late reply is ignored unless its request ID is still pending. Close/disconnect rejects all pending and control work and detaches listeners. Shutdown is bounded and then local-close even without a participant response.

### Kernel integration

The round-trip test submits work through the public actor ingress, releases the setup store, reopens as a coordinated owner with the bridge registered, runs one cycle and inspects canonical state. It verifies the idempotency key, one execution result, completed task and replay equality. The delayed-release test verifies the adapter reply cannot commit after the owner is released.

## Not claimed

- No network transport, hostile-network proof or authentication of remote peers.
- No real external provider/model effect.
- No durable participant idempotency cache across restarts.
- No exactly-once effect or distributed consensus.
- No Node full-suite claim for files that import `bun:test`.
