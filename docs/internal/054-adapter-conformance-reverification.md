# Block 054 — Adapter conformance reverification

## Pass

**054 Pass 3 implementation and verification COMPLETE; public utility usable; adapter certification INCOMPLETE by design.** This is the current independent review and bounded correction, not a rewrite of historical Pass 3 results. Parent review may open Pass 4; no Pass 4 work was performed.

Historical [054-adapter-conformance.md](054-adapter-conformance.md) remains byte-identical. Its original describe defect, COMPLETE conclusion and old measurements are historical, not newly discovered here. Current evidence supersedes its coverage interpretation without modifying it. Parent [Pass 1 disposition](054-reliability-disposition.md) still carries **UNRESOLVED P2**; green execution here does not classify that historical startup failure as environmental.

## Agent

`conformance-agent`, delegated 054 Pass 3 only.

Repository R=`/home/d/Workspace/other-projects/chord`; package P=`R/packages/core`; scratch S=`/home/d/.hermes/cache/scratch/054-p3-conformance`. HEAD remains `72f96ab6cdc9d6948ffb7eacba527cc27a32a8be`, branch `base`. Actual runtimes: N=`/home/d/.volta/tools/image/node/24.22.1/bin/node` (**v24.22.1**), B=`/home/d/.bun/bin/bun` (**1.4.3**). All subprocess temporary directories use S.

## Files inspected

- `packages/core/src/interop/{conformance,adapter-protocol,adapter-bridge,adapter-server,reference-adapters}.js`; new participant runner implementation; memory transport interface through the runner and public fixture execution.
- `packages/core/tests/adapter-conformance.test.js`, full `adapter-protocol.test.js`, new public-consumer fixture tests; `src/contracts/sigils.js` AdapterResult/ExecutionResult declarations and result semantics.
- `packages/core/package.json`, shipped conformance example and relevant README API/coverage claims.
- Historical `054-adapter-conformance.md`, current `054-public-api-reverification.md`, parent `054-reliability-disposition.md`, reliability reverification command/safety provenance; public conformance review procedure.
- Actual outputs of the full suite, all 15 shared test files, original safety probes and both runtime verifiers listed below. Running these gates is separate from claiming a full new line-by-line audit of their implementations.

## Files changed

Only these repository files were created or modified in this pass:

1. Modified `packages/core/src/interop/conformance.js`: preserve public entry/API, classify check targets, explicit incomplete verdict, sanitized structured diagnostics, actual bridge factory injection, expanded shape/version/identity/correlation controls, independent promise bounds and bridge cleanup.
2. Added `packages/core/src/interop/conformance-participant.js`: actual supplied-endpoint scenarios, public protocol validators, bounded response polling, optional safe action/cancellation hooks, cleanup and explicit unsupported registration.
3. Added `packages/core/tests/adapter-conformance-fixture.test.js`: **21 public-import-only tests** covering passing, defective, unsupported, bridge-only, unresponsive and secret-bearing participants/bridges.
4. Modified `packages/core/examples/adapter-conformance.mjs`: runnable public-export-only consumer fixture plus retained mock/local reference runs; full inspectable check reports.
5. Modified `packages/core/README.md`: actual fixture API, target labels, report semantics, safe-fixture obligations, limitations and current report link.
6. Added this report, `docs/internal/054-adapter-conformance-reverification.md`.

No bridge/server/protocol, kernel, storage, scheduler, export entry, manifest, dependency, version, lockfile or historical report was changed. The inherited original conformance tests are unchanged. No staging, commit, reset, stash, clean, push, tag, publication or Block 055 work. Default-profile procedural skill reference was extended outside the repository with bounded-fixture and error-code sanitization lessons.

Initial selected-file hashes and inherited runner source are in `S/entry-hashes.json` and `S/inherited-conformance.js`. This was not a complete initial hash inventory of every inherited dirty file; no whole-tree byte-preservation claim is made from that limited snapshot. Final source inventory and dry-run payload correspondence are in `S/final-source-hashes.json` and `S/artifact-verification.json`. The historical conformance SHA-256 remains **`088cde13855803ead02af6959b405930b1da8a927ca75d77f79310709aab2012`**. Original safety harness remains **`95b72cd7189bb2d54685bdd3f08561ef0740f3e8399bbc04cb10a269228248eb`**.

## Observed outcomes

### Inherited coverage gaps independently challenged

The inherited runner mixed supplied handlers behind Chord's own server with unrelated reference/probe checks. Supplied cancellation/timeout/invalid-response and kernel replay/stale-owner checks were skipped; `ok` still meant only zero failures. Its identity-rejection scenario altered only task identity, its malformed-result scenario only an extra field, and its result-cache check was sequential and in-memory. Handler describe/shutdown checks primarily tested Chord's wrapper, not a consumer wire server. The old describe correction already existed and was not rediscovered or reimplemented here.

An experimentally reproduced coverage false positive: a participant handler returning contract-valid `completed/succeeded` for **every** action passed the inherited runner (**32 total / 27 pass / 0 fail / 5 skip**, `ok:true`). With explicit failed/blocked scenario actions through the same participant, the corrected utility produces **52 total / 42 pass / 2 fail / 8 skip**, `verdict:FAIL`; both failures are `WRONG_OUTCOME`. This is an expected-scenario coverage gap in the old API, not proof that its generic single-action result validator violated its old contract. The comparison ran on both runtimes against the saved inherited source and current copied public payload.

### Actual public API and trust boundary

```js
import { runAdapterConformance } from '@antistructured/chord/interop';
const report = await runAdapterConformance({
  adapter,          // optional existing { advertisement, handle }
  fixture,          // optional actual participant and/or consumer bridge fixture
  action: 'work',   // existing single-handler action; optional
  timeoutMs: 1000
});
```

No new package entry point or export was necessary. Both original exports still resolve to the same runner; existing tests verify root/interop identity.

Participant fixture:

- `advertisement`: public descriptor.
- `connect({ channel, timeoutMs })`: synchronously attaches the consumer's actual participant to a fresh EventEmitter-like channel, returns `{ close(), release?() }`. Public `createAdapterServer` is usable, but not required. Channel operations are `on`, `off`, `send(JSON string, callback)`, `connected`; incoming requests arrive as `message` events. The runner exercises this supplied endpoint, not a replacement reference participant.
- `actions: { completed?, failed?, blocked?, pending? }`: caller-defined **predefined safe in-memory** actions. Absent actions explicitly skip rather than guessing consumer behavior.
- `capabilities: { cancel: true }`: opts into active cancel acknowledgement plus released late-result validation. `pending` must remain held until session `release()`/cleanup. This tests acknowledgement plus a late-delivery scenario, not physical effect cancellation.
- Optional `createBridge({ advertisement, transport, timeoutMs })`: consumer bridge implementing the public Chord bridge interface, exercised against synthetic peer frames. A bridge-only `{ createBridge }` fixture needs no invented endpoint/advertisement; participant coverage is skipped.

Every check reports `id/category/name/scope/status/expected/actual` and a failure code or skip reason. Successful actual values are deliberately terse; failure actual values are stable sanitized codes, never raw messages/stacks/causes/payloads. Unknown error codes are replaced with `CONFORMANCE_FAILURE` using a fixed known-code allowlist, because uppercase participant code text can itself contain a secret. Report/check containers remain frozen.

`ok` preserves zero-fail compatibility; it must not be used as coverage certification. `verdict` is `FAIL` on any failure, `INCOMPLETE` with any skip, otherwise `PASS`; `complete` requires no failures/skips. `certification` is always false. Scope is `supplied-handler/chord-server`, `supplied-participant`, `supplied-bridge` or `chord-harness`. No host SDK/store/owner/admin/grant/canonical object crosses the fixture boundary. No scheduler or second runtime was added.

### Coverage matrix: what actually participates

| Requirement | Supplied fixture exercised | Independent control / limitation |
|---|---|---|
| Protocol/context versions, descriptor shape and identity | `participant.interface/compatibility/describe`; `participant.reject.version/adapter_id` send to actual endpoint | Original handler advertisement/compatibility checks retained; no capability implies grants |
| Session/request/task/attempt/operation/run/incarnation correlation | Completed/failed/blocked endpoint responses validated against exact requests; wrong response UUID is directly observed, not hidden as silence | Supplied bridge factory runs expanded `protocol.identity_mismatch` and new `protocol.correlation`; absent factory labeled Chord harness |
| Completed, failed, blocked and no false business success | Explicit caller action mapping through supplied endpoint; always-completed defective handler fails failed/blocked expectations | Missing mapped action skips; no reference outcome substituted |
| Invalid/missing/extra result and unsupported response version | Deliberately malformed participant results fail actual endpoint outcome checks | Supplied bridge factory runs four expanded invalid-result variants; otherwise harness only |
| Invalid/missing/extra/incoherent requests | Nine request variants sent to actual participant: version, adapter, extra, missing packet and five identity inconsistencies; require rejected error response | No optional participant-side effect counter exists: rejection alone does not prove a malicious participant performed zero hidden effects |
| Reorder, duplicate, foreign correlation and old-session replacement | Consumer bridge factory receives adversarial frames in ten bridge control checks | Participant server does not receive response frames; without bridge hook this remains harness evidence, not supplied-participant coverage |
| Lifecycle open, bounded concurrency, timeout, disconnect/close | Bridge factory constructed afresh; inherited concurrency/close/disconnect checks target it; supplied held action is actually sent through endpoint for timeout with exactly one execute | No remote process exit/drain or participant-side concurrency certification; server is not a scheduler |
| Cancellation and late results | Optional real endpoint active cancel + release + correlated late result; supplied bridge cancel/late response control | Missing support explicitly skipped. Cancellation acknowledgement is not nonexecution; ordinary bridge shutdown true is not remote acknowledgement |
| Shutdown acknowledgement | Actual endpoint must emit matching valid `shutdown_result` | Existing Chord wrapper stats checks retained and accurately named; process exit not inferred |
| No authority grant / no mutable canonical access | Compatibility only reports code/boolean; fixtures receive transport and synthetic detached task/context, never administrative state | Handler input-isolation checks remain wrapper-scoped; actual kernel authority/mutation controls are separate acceptance suites |
| No automatic retry | Actual held endpoint timeout counts exactly one execute; bridge error scenario verifies one outbound request | Local timeout is unknown; this does not implement durable retry/effect deduplication |
| Replay zero effects / stale canonical result rejection | **Explicit safety skips in utility**; no generic portable host-governance fixture was added | Actual coordinated kernel tests, full safety suites and verifiers ran on both runtimes; no third-party canonical certification inferred from them |
| Registration | **Explicit unsupported skip** | No portable registration protocol; trusted host grants remain separate |
| Durable/semantic/in-flight idempotency and exactly-once | **Not certified** | Existing sequential in-memory result cache scenario is labeled narrowly; it proves neither payload-mismatch rejection, concurrent coalescing nor durable physical-effect deduplication |

Representative example results are identical on Node/Bun:

| Run | Total | Pass | Fail | Skip | Verdict |
|---|---:|---:|---:|---:|---|
| Mock agent handler | 52 | 28 | 0 | 24 | INCOMPLETE |
| Local allowlisted tool handler | 52 | 28 | 0 | 24 | INCOMPLETE |
| Public consumer participant + bridge fixture | 52 | 35 | 0 | 17 | INCOMPLETE |

The consumer fixture's actual scope partition is **18 supplied-participant passes + 1 registration skip; 10 supplied-bridge passes; 7 Chord-harness passes + 2 kernel safety skips; 14 absent-handler skips**. Skips remain visible even when another scope provides related evidence. No headline total conflates all 35 passes with participant certification.

### Defective fixtures and cleanup

The new public-only test file verifies wrong adapter/session/request/run/incarnation/task/attempt/operation response identity; invalid outcome/version/extra/missing result; always-completed false success; false cancel acknowledgement; a supposedly held action that immediately succeeds; missing capabilities/actions; participant exceptions; a bridge fabricating success after timeout; bridge-only operation; and a bridge whose execute promise never settles. Identity controls now fail on the actual offending response rather than a harness response timeout. Explicit open/close counters match after failures. Secret-bearing exception messages **and codes** do not appear in reports.

Bridge promises are bounded independently of the consumer's timeout (`timeoutMs + 50` cleanup allowance); response polling is bounded by `timeoutMs`, and the held-endpoint timeout uses at most 30 ms. All opened consumer bridges are retired when a scenario finishes early. Rejection handlers are attached immediately, including expectation promises, so early malformed-fixture failures do not become orphaned rejections. Endpoint allocation must self-clean if `connect` throws; successful sessions must provide synchronous cleanup. No automatic retry is introduced.

## Test commands

All actual argv/cwd/exit values and full logs: `S/commands.json`, `S/consumer-commands.json`, their named `.log` files. Repro harnesses are `S/run.py`, `S/consumer-proof.py`, `S/consumer-run.py`; the harnesses' own exit is not substituted for the individual recorded command exits.

The shared set H is exactly these 15 package-relative files (Node uses `tests/`; Bun uses `./tests/`): `actor-ingress`, `adapter-conformance-fixture`, `adapter-conformance`, `adapter-protocol`, `authority-continuity`, `coordinated-adversarial`, `coordinated-dispatch`, `coordinated-storage`, `crash-recovery`, `durable-adversarial`, `identifier-integrity`, `ipc-correlation`, `process-recovery`, `storage-adapter`, `two-process-coordination`, each with suffix `.test.js`. This covers adapter, identifier, IPC, coordination, durability and process integration. Full Node is not claimed because other files statically import `bun:test`.

| Command (N/B as defined above) | Cwd | Observed final result | Exit |
|---|---|---|---:|
| `B test` | P | **448 pass / 0 fail**, 31 files, 1777 expect calls | 0 |
| `N --test H` | P | **255 pass / 0 fail**, no cancelled/skipped | 0 |
| `B test H` | P | **255 pass / 0 fail**, 15 files | 0 |
| `N --test ./docs/internal/046-state-probes.mjs` | R | **21 pass / 0 fail** | 0 |
| `B test ./docs/internal/046-state-probes.mjs` | R | **21 pass / 0 fail** | 0 |
| `N src/verify-runtime.js` | P | ALL RUNTIME VALIDATIONS PASSED | 0 |
| `B src/verify-runtime.js` | P | ALL RUNTIME VALIDATIONS PASSED | 0 |
| `N --test tests/adapter-conformance.test.js tests/adapter-conformance-fixture.test.js` | P | **25 pass / 0 fail** | 0 |
| `N examples/adapter-conformance.mjs`; `B examples/adapter-conformance.mjs` | P | Structured reports above | 0 each |
| `npm pack --dry-run --ignore-scripts --json` | P | 75-file public payload enumerated and copied | 0 |
| `N --test consumer-fixture.test.mjs`; `B test ./consumer-fixture.test.mjs` | S/consumer | **21 pass / 0 fail each**, using copied package bare imports | 0 each |
| `N false-pass.mjs`; `B false-pass.mjs` | S/consumer | Saved inherited ok:true; corrected wrong outcomes FAIL as asserted | 0 each |
| `N node_modules/@antistructured/chord/examples/adapter-conformance.mjs`; B equivalent | S/consumer | Same complete structured public usage output | 0 each |
| `git diff --check` | R | Empty | 0 |

The dry-run payload was copied exactly into fresh scratch `node_modules/@antistructured/chord`; only installed SigilJS was linked. All **75 source/payload file hashes match** after the last shipped-file change. This is consumer-like public resolution/payload verification, **not** an actual tarball install or publication. The independent consumer tests themselves import only the public bare root plus Node standard library, not private helper modules.

## Exit codes

All final acceptance commands above returned **0** on the final shipped source. Earlier acceptance before the last three controls was also green (**445 full / 252 shared per runtime**); its logs/ledger are preserved separately under `S/initial-acceptance/`, not used as the final counts.

Disclosed iterations:

- Initial scratch payload copier exited **1** because it assumed array-shaped npm JSON; this environment returns a package-name-keyed object. The copier now handles both; npm itself returned 0. No product failure was hidden.
- While adding the never-settling bridge control, targeted Node tests exited **1**, **24 pass / 1 fail**, with an orphaned rejection from an expectation promise created before the scenario's send-shape failure. Attaching a handler to the bridge's underlying promise alone was insufficient. The runner now retires bridges and handles both underlying and expectation promises immediately. The exact same control now passes, as do the final **25 targeted**, **448 full**, **255 shared each**, and fresh **21 consumer each** gates. This was a runner robustness defect, not a canonical/effect-safety defect; no P0/P1 kernel failure was established.
- An exploratory relative `search_files` lookup ran after the terminal cwd moved to P and returned path-not-found; absolute repository paths corrected the lookup. No source conclusion was drawn from that empty result.

## Invariants verified

- Actual consumer endpoint/bridge participation is distinguishable from Chord controls and unsupported coverage. Missing scenarios remain skips and force INCOMPLETE, never an inferred certification.
- Wrong identity/version/result/outcome behavior fails the public runner; outcome expectations detect a realistic inherited false-positive case.
- Fixtures use public APIs only, predefined in-memory effects, no private helper copies and no administrative authority handles. Compatibility remains descriptive.
- Local timeout/cancel/close/shutdown is never converted into a claim of physical nonexecution, durable idempotency or canonical rollback. No auto retry or replay effect path was added.
- Actual kernel governance, zero-effect replay, fencing and durable behavior remain exercised separately by the real unchanged acceptance suites. Their green results do not reclassify skipped third-party governance coverage as passed.
- Historical conformance and original safety-harness bytes remain identical. Existing dirty implementation is not overwritten by reset/stash/clean or publication machinery.

## Remaining risks

This utility is deliberately **not a certification service**. Kernel replay/stale-owner and registration scenarios remain incomplete; handler-only calls do not certify an external wire server. There is no universal fixture effect counter, process join, remote authentication, durable semantic dedupe, in-flight effect coalescing, production transport or exactly-once proof. Optional scenario hooks attest only the consumer's supplied safe test behavior. A participant returning an error after a hidden effect is not detectable without external effect evidence.

In-process JavaScript cannot preempt synchronous hangs or contain malicious fixture code. Consumers must use disposable externally supervised processes for untrusted integrations and must never supply production credentials/effects. Async waits are bounded; fixture-created resources remain the fixture's cleanup responsibility. The current copied-payload proof does not replace later installed-package validation. Carry forward the separate historical startup **UNRESOLVED P2** without causal claims.

## Next gate

**Public conformance utility gate: usable and verified; no newly established P0/P1 blocks parent review.** Passing examples correctly say **INCOMPLETE**, not certified. Parent can mark Pass 3 engineering COMPLETE and open the already-sequenced Pass 4 review after reading this report, while carrying the documented safety/registration coverage limits and Pass 1 P2. **No Pass 4 executed; no Block 055, commit, version change, push, tag, install publication or release authorized.**
