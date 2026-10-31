# Test an adapter without claiming certification

[Setup](README.md#setup) first. From the repository root:

```bash
"$N" packages/core/examples/adapter-conformance.mjs
"$B" packages/core/examples/adapter-conformance.mjs
```

The [complete public fixture example](../../packages/core/examples/adapter-conformance.mjs) prints
reports for a mock agent, allowlisted local tool and consumer-supplied participant/bridge fixture.
Expected: `ok:true`, `certification:false`, zero failures, and **INCOMPLETE**, not certified PASS.
The reports expose verdict and scope; the script exit checks only `ok`. Inspect every check, not just `ok`.

Use public `runAdapterConformance({adapter?,fixture?,action?,timeoutMs?})`. A handler-only
`{advertisement,handle}` adapter is run behind Chord's server and does not test your own wire endpoint.
For a real participant follow the shipped fixture: `advertisement`, synchronous `connect({channel,timeoutMs})`
returning `{close(),release?()}`, predefined safe `actions:{completed,failed,blocked,pending}`, optional
`capabilities:{cancel:true}` and your `createBridge` factory. Missing scenarios stay skipped; a reference
participant is not silently substituted. `close()` must retire resources even on failed checks, and
pending work needs explicit release/cleanup. The [full fixture contract](../../packages/core/README.md#adapter-conformance)
explains partial/bridge-only fixtures.

| Report field | Interpretation |
|---|---|
| `scope` on each check | `supplied-handler/chord-server`, `supplied-participant`, `supplied-bridge` or `chord-harness`; do not pool these into participant certification. |
| `ok` | Compatibility field: zero observed failures only. |
| `verdict` | Any failure → `FAIL`; any skip without failure → `INCOMPLETE`; no failures/skips → `PASS`. |
| `complete` / `certification` | Complete requires zero failures/skips; certification is always false. |

Kernel replay/stale-owner and portable registration remain **SKIP** in this utility. Separate kernel
proofs do not turn them into runner passes. A defective fixture (for example always returning success
for failed/blocked actions) must produce failed checks and `verdict:FAIL`; an `ok:true` reference control
is not a substitute. Current [adversarial fixture evidence](../internal/054-adapter-conformance-reverification.md)
and [installed-consumer negative proof](../internal/054-external-consumer-proof.md) preserve actual failures
as expected-negative assertions, not conforming participants.

Run only predefined **safe in-memory** effects, never production credentials or real business actions.
Async waits are bounded, but in-process synchronous hangs/malicious fixture code cannot be preempted:
use externally supervised disposable processes. No remote cancellation, physical nonexecution,
production transport, durable idempotency or exactly-once certification is implied.
