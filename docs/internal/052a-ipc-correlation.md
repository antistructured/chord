# Block 052A — A3 IPCCommandResponseIdentityCorrection

## Pass

**A3 COMPLETE — F2 corrected and regression-gated. A4 READY, not executed. 052A is NOT COMPLETE; 053 remains blocked.** This is an implementation/evidence report, not independent final acceptance.

Repository `/home/d/Workspace/other-projects/chord`, entry HEAD `72f96ab6cdc9d6948ffb7eacba527cc27a32a8be`. Entry was the existing dirty A2 correction plus historical audit/A1/A2 reports. Captured SHA-256 of all **568 entry paths** from `git ls-files --cached --others --exclude-standard` before edits, in `/home/d/.hermes/cache/scratch/052a-a3/entry.json`. No reset/clean/stash/stage/commit/push/tag/publication or 053 work.

Path notation for exact commands below: R is the repository above; P is `R/packages/core`; S is `/home/d/.hermes/cache/scratch/052a-a3`; N is `/home/d/.volta/tools/image/node/24.22.1/bin/node`; B is `/home/d/.bun/bin/bun`. Actual version commands returned **v24.22.1** and **1.4.3**, exit 0. Scratch evidence can be pruned; permanent tests and this report preserve the correction and reproduction.

## Agent

**ipc-agent**, delegated A3 only. Loaded `owner-cas-mutation-testing`, read both complete `052a-root-cause-report.md` and `052a-identifier-integrity.md`, and preserved the A2 implementation/tests and all historical reports byte-for-byte. Added a reusable actual-IPC/control-tree lesson to that existing default-profile skill outside the repository.

## Files inspected

- Full A1 recommendations, especially F2 canonical response/rejection contracts, repeated-read delivery identity, cleanup and explicit wire compatibility decision; full A2 preservation/gates/handoff.
- Complete `src/runtime/{actor-client,actor-ingress}.js`, `src/coordination/contracts.js`, `tests/actor-ingress.test.js`, `tests/actor-ingress-worker.js`; plain-data recursive/byte limits in `src/contracts/sigils.js`, command response construction references, public root exports and actor fixture use.
- Relevant public README actor API, authentication/IPC/receipt documentation; public `examples/two-process-coordination.mjs` client/host composition and raw negative-request path. Existing raw worker/example paths needed no edits because the explicit legacy host edge remains supported. Public live and sequential restart examples were actually run, not merely reviewed.
- Existing A2 gate/proof orchestration, final logs, all new test code, isolated unfixed-client control logs, actual standalone SQLite rows and physical artifacts.

## Files changed

Exactly seven A3 repository paths (package paths have prefix `packages/core/`):

```text
README.md                                  modified: public API/wire/failure semantics
src/runtime/actor-client.js                 modified: framed matching + lifecycle
src/runtime/actor-ingress.js                modified: frame boundary + shared rejection validation
src/runtime/actor-transport.js              new: exact shared Sigil transport/response validation
tests/ipc-correlation.test.js               new: 24 shared Node/Bun tests
tests/ipc-correlation-worker.js             new: actual inherited-IPC replacement reproduction
```

Plus this new `docs/internal/052a-ipc-correlation.md`. No canonical command/success/receipt/authority schema, persistence/replay/reducer, adapter, dependency, manifest, lock, version, existing example/worker/test or A2 file changed. Existing SDK facade still exposes `sendCommand` and `close`; timeout is an optional second constructor argument.

## Design decisions

### Separate identities and boundaries

| Identity | Meaning / correction |
|---|---|
| Canonical `ActorCommand.operation_id` | Durable write idempotency identity, not delivery identity. Exact historical write retry retains the entire command. Reads may repeat the identical command/operation ID and return a later snapshot. Distinct from external-effect operation/idempotency identity. |
| Frame `request_id` | Fresh UUIDv4 on every send, including identical reads and explicit write receipt recovery. Not stored, authorized or exposed to adapters. |
| Frame `session_id` | Fresh UUIDv4 on every wrapper creation; independent of host enrollment and owner generation. A replacement cannot accept an old wrapper's in-flight reply. |
| Canonical run/incarnation | Existing run identity; all successful response identity fields must equal the detached pending command. Not a substitute for per-send identity. |
| Principal/actor/binding | Derived afresh by the host from the exact inherited channel object, never from transport IDs or actor-authored identity. Existing authentication/authorization stays authoritative. |
| Response / promise | Canonical response is unchanged. Only the matching fresh delivery frame may settle the exact captured pending-request object once. Receipt success can describe an older owner generation; it is not current ownership evidence. |

### Explicit wire compatibility decision

The default client **intentionally changes IPC bytes**, while retaining the canonical JS facade and direct `handleAuthenticated(context, canonicalCommandJSON)` API. Request is exactly:

```js
{protocol_version:'chord.actor-ipc-request.v1', session_id, request_id, command}
```

Response is exactly:

```js
{protocol_version:'chord.actor-ipc-response.v1', session_id, request_id, response}
```

Both use shared exact Sigil contracts and UUIDv4 delivery identities. The unchanged canonical command/response is nested, never extended. Framing lives only in `sendCommand` and concrete `attachChild`. No new authentication protocol, credential, persistence representation or receipt key input was introduced. Wire JSON is checked against 1 MiB **before parsing**, then exact schemas/plain-data recursive budgets; budgets include the wrapper. Near-limit canonical objects may therefore fit the direct API but not framed IPC.

`attachChild` explicitly retains a raw legacy host edge only for documents declaring `chord.actor-command.v1`; those peers receive raw canonical replies. Their own retirement/correlation remains their responsibility. This supports existing raw negative tests/workers/examples; it does not certify raw wrapper replacement. Other malformed/unsupported transport frames are dropped before authentication/dispatch, rather than treated as canonical commands. Framed clients never accept raw responses and **never silently downgrade**. Injected custom transports/mocks expecting bare commands must implement/echo the new frame or remain on their separately managed raw host route.

### Shared response validation and exact pending match

- A bounded parsed reply must first match current `session_id` **and** `request_id`. Stale/unknown/duplicate/raw/missing delivery identity or unparsable replies do not clear pending state.
- Matching frames must validate the exact response frame, then exact success or rejection contract. Success validates all five operation/run/incarnation/correlation/causation fields against the detached canonical command and `validateCommandResult(command.type, result)`.
- Shared `RejectionResponse` preserves the existing no-run/incarnation shape. Null operation identity requires null correlation/causation. Non-null operation/correlation/causation must match pending. A null-ID host authentication/validation rejection is attributable only because the fresh outer delivery matches, not because null identifies an arbitrary outstanding command.
- Matched malformed frame/response/type/identity fails the local promise with `ACTOR_PROTOCOL_ERROR`. It fabricates no canonical rejection, success, revision or commit status. Unattributable malformed data cannot acknowledge any command.

### Minimal channel ownership and captured cleanup

A module-private WeakMap gives one active wrapper per exact channel (`ACTOR_CHANNEL_IN_USE`); the existing one-command guard remains `ACTOR_COMMAND_PENDING`. This is not a multiplexing pipeline or global protocol framework. Close/disconnect/close-event retires the wrapper, detaches all three listeners, clears its timer, rejects its pending promise and releases channel ownership. Close is idempotent. A replacement obtains a fresh session. A retired wrapper cannot send again, including after the transport reconnects; construct a replacement after host-managed reconnection/reattestation.

All settlements pass through `pending === capturedRequest`. Delayed send-error callbacks, synchronous send throws, duplicate replies, old timers and retired wrappers cannot clear/reject a later request. Input command assertion already creates detached plain data, so later caller mutation cannot alter expected identity/result type.

### Failure/timeout semantics

`createActorClient(channel, {timeoutMs})` explicitly opts into local acknowledgement abandonment; default is null/unbounded. Non-null is integer milliseconds `1..2147483647` (reject invalid/overflow values as `INVALID_ACTOR_TIMEOUT`, avoiding native timer overflow). Timeout rejects `ACTOR_COMMAND_TIMEOUT`, clears only that captured request, and allows an explicit later send with a fresh delivery ID. There is **no auto-retry, resend, rollback or compensation**.

`ACTOR_CHANNEL_CLOSED`, timeout, local protocol error, synchronous send throw and asynchronous send error all leave command commit knowledge unknown to the client. Send errors preserve their original error. Canonical host `commit_status:'not_committed'|'unknown'` is delivered unchanged when valid; only the trusted ingress can state it. Recovery of a write requires fresh authentication and the exact original command/receipt rules, not a changed operation ID or inferred non-commit. Tests actually commit a write before its local timeout and then recover its identical original receipt without any additional canonical write.

## Tests run

Exact expanded argv/cwd/exit/duration/log records: **S/commands.json** and **S/process-commands.json**. Gate runner was `python3 /home/d/.hermes/cache/scratch/052a-a3/run-gates.py` from R, with TMPDIR `/home/d/.hermes/cache/scratch` and at most two concurrent jobs. Final runner exit 0; explicit assertions verified every production exit 0 and both deliberate red exits 1. First completed gate logs remain in `S/first-gates`; the final rerun includes the final timer-bound check/test bytes. Full historical suite uses bun:test, so no full-suite Node claim. Overlapping counts are not summed.

| Exact command (symbols expand as defined above) | Cwd | Final output / exit |
|---|---|---|
| `B test` | P | **406 pass, 0 fail, 1738 expect calls, 28 files; exit 0** |
| `N --test tests/ipc-correlation.test.js` | P | **24 pass, 0 fail/cancelled/skipped; exit 0** |
| `B test tests/ipc-correlation.test.js` | P | **24 pass, 0 fail; exit 0** |
| `N --test tests/identifier-integrity.test.js`; `B test tests/identifier-integrity.test.js` | P | **26 pass each; exit 0 each** |
| `N --test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js` | P | **81 pass; exit 0** |
| Same five paths with `B test` | P | **81 pass; exit 0** |
| `N --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | P | **82 pass; exit 0** |
| Same five paths with `B test` | P | **82 pass; exit 0** |
| `N --test ./docs/internal/046-state-probes.mjs`; `B test ./docs/internal/046-state-probes.mjs` | R | **21 pass each; exit 0 each** |
| `N src/verify-runtime.js`; `B src/verify-runtime.js` | P | **ALL RUNTIME VALIDATIONS PASSED each; exit 0 each** |
| `git diff --check`; `git diff --cached --stat` | R | **exit 0; empty outputs** |

### Behavioral red control, not parse or wire incompatibility

Created `S/unfixed-client` by copying the current tracked/untracked source tree, linking the existing dependencies, then restoring **only** `src/runtime/actor-client.js` byte-for-byte from `git show HEAD:packages/core/src/runtime/actor-client.js`. A2 own-lookup fixes and the framed/legacy-compatible host stay in this isolated control. No source checkout or mutation in the working repository. The helper's legacy-wire adapter allows the exact same tests to exercise the original client's bad behavior, rather than failing because the host expects frames.

Final test SHA-256 is **`94ead7aa6199e9241e8f2f0c4936b0dae895a7d9512d74bcfdeff822af10d58d`** on both trees. Selected the independently terminating identity/misdelivery cases for the red control; did not wait for deliberately orphaned promises from old lifecycle code. Literal pattern:

```text
exclusive wrapper|A gets A|matched invalid|matched malformed|unframed/|rejection identity|actual child late
```

Exact commands from `S/unfixed-client/packages/core`:

```text
N --test --test-name-pattern 'exclusive wrapper|A gets A|matched invalid|matched malformed|unframed/|rejection identity|actual child late' tests/ipc-correlation.test.js
B test --test-name-pattern 'exclusive wrapper|A gets A|matched invalid|matched malformed|unframed/|rejection identity|actual child late' tests/ipc-correlation.test.js
```

**Both exit 1: 0 pass, 16 fail.** Bun additionally reports eight filtered tests; Node reports no cancellation or skipped tests among the selected 16. Actual assertions fail: second wrapper does not throw, duplicate A settles B, invalid canonical identity/response resolves rather than rejects, raw response acknowledges pending, and genuine late IPC A incorrectly supplies B's result. No parse/import/fixture setup failure or red timeout is used as proof. All 24 final tests pass on both corrected runtimes.

### Genuine separate-child late response reproduction

`ipc-correlation-worker.js` creates A's wrapper, sends A, then on the next stdin command closes A and constructs B on the same still-connected inherited IPC channel. The parent enrolls the exact child in the production fixture's private live session map and attaches **production ingress**. A's real response is held by intercepting only outgoing child.send. After A's empty scoped context was computed, the parent admits Alice's task canonically, then B sends. Parent releases genuine A twice before genuine B. Spawn PID is checked against child-reported PID; clean child exit is required.

Two permanent cases run on Node and Bun:

1. Different read types, with identical operation/run/incarnation/correlation/causation: A context must not settle B outcomes.
2. The **exact identical read command**, not merely identical operation ID: A's snapshot has zero tasks, B's genuine later snapshot has one. Only session/request identity distinguishes these valid responses.

Unfixed control fails the explicit outcomes-shape assertion and `0 !== 1` snapshot assertion respectively. Corrected code returns B's genuine one-task response in both cases, A rejects locally on close, duplicates are ignored, and complete authoritative rows remain identical across response delivery. Canonical row changes are only the deliberate intervening trusted task admission; this is not a claim that that write-free read test has no setup writes.

### Standalone public examples / raw durable evidence

Executed `python3 S/run-process-proofs.py` from R, exit 0: **eight standalone CLIs**, four live owner/actor pairs and four sequential writer/reader pairs. For each ordered pair `(X,Y)` in `(N,N),(N,B),(B,N),(B,B)`, from P:

```text
X examples/two-process-coordination.mjs S/live-<x>-<y> X Y
X examples/process-recovery.mjs S/restart-<x>-<y> Y
```

Here `<x>/<y>` are literal node/bun labels. Exact expanded commands are in S/process-commands.json. All eight exit 0. Live owner PIDs: Node/Node **155306**, Node/Bun **155298**, Bun/Node **155479**, Bun/Bun **155522**. The existing examples need no transport edits and prove default framed client interoperability in all four runtime pairs while retaining raw negative cases.

Independently opened **12 actual SQLite databases** read-only via Python sqlite3 and saved full `independent-raw-row.json`: four v2 live rows at revision 14, four legacy approved continuations at revision 11, four ambiguous quarantines at revision 7. Inspector verifies authoritative registry/final equality, full v2 envelope equality, v2 replay and independent reopen equality, two physical effects and matching file contents/PIDs, six receipts, consumed exact-attempt approval and clean child exit records. Sequential ambiguous continuation has zero continuation callable entries. All 12 pass; records are S/process-inspections.json. Standalone runs preceded the final timeout-range-only guard; the final full/shared suites rerun the same four live/restart pairs against final production code, and the changed option is not used by the standalone examples.

## Results

- F2 is corrected at delivery and cleanup boundaries: A's late/duplicate response cannot settle B, even for an identical repeated read; stale session/request replies never clear current pending.
- Exact bounded shared response validation now checks success result type, canonical identity, rejection shape/null rules and delivery attribution. Matched malformed responses fail locally rather than masquerading as canonical acknowledgements.
- Exclusive wrappers, captured pending object settlements, sync/async send failures, close/disconnect/replacement and opt-in timeout are exercised. A late send callback cannot orphan a newer request. No retries or rollback inference were introduced.
- Genuine trusted-ingress rejections and identical historical durable receipts survive framing unchanged; host authentication still runs on each dispatched canonical request. Actual timeout after committed write proves local abandonment is not non-commit.
- Full/current gates and all standalone example/proof inspections pass; the final same-byte selected tests fail behaviorally on the old client. A2 work remains unchanged.
- One initial test-development failure used a single EventEmitter for both transport directions; the client correctly rejected its own echoed request as a malformed response. Corrected the fixture to separate directional endpoints, then ran the production gates. This was a test harness issue, not a waived product failure. No install/network/runtime blocker remains.

## Invariants verified

- Canonical commands, success objects, durable receipts, auth identity/authority, direct canonical context API, replay and adapters retain their original shapes/semantics. Framing is ephemeral shell data, never authority.
- Both success and canonical error settlement require current delivery identity; successful results also require exact canonical identities/type. Null-ID rejections cannot acknowledge unrelated delivery.
- One wrapper/one pending per channel within this module, no stale reply/callback/timer clears a newer pending object, close/disconnect removes listeners, explicit timeout does not retry or claim rollback.
- All A2 entry bytes, including its 16 existing source changes, own helper and 26-test regression, remain preserved. Historical protected hashes remain:
  - `052-committed-independent-audit.md`: `0b7609b61e593bcb546ce0cacb838b986cf7a90949393a8e8fe69a6b17cddc60`
  - `052a-root-cause-report.md`: `eb7ebca64244c547017955da91ae29ac07a70c122f057ad6afb0b6b990094bf4`
  - `052a-identifier-integrity.md`: `2024ec7da5765989963ffe14485da05c8aabb091ce1a12826bfc60b993c338cc`
- Entry preservation permits only three changed existing paths (README/client/ingress); four new A3 paths are transport/test/worker/this report. Final preservation record S/preservation.json accounts for every entry path and new path. HEAD unchanged; staged diff empty; original safety harness preserved.

## Known limitations

- This is not new authentication, an OS/filesystem sandbox, resource-rate limiter, remote effect exactly-once or cancellation protocol. Host must manage channel reconnection/reattestation/enrollment/revocation and child lifecycle; transport IDs are not secrets or proof of authority.
- Exclusive ownership is module-local and keyed by the exact channel object. Hosts must not load independent duplicate client module instances or competing raw handlers and treat them as a shared channel dispatcher. No new multiplexing framework was added.
- Legacy raw host peers intentionally remain outside the corrected framed-client delivery guarantee. New framed clients cannot transparently communicate with old raw-only hosts; upgrade the host or injected transport explicitly. No downgrade option exists.
- Malformed/unattributable/oversize data is ignored/dropped; with default null timeout a pending promise can remain unbounded until close/disconnect or a valid reply. Opt into a timeout where bounded abandonment is required. Whole-frame budgets reduce the largest canonical payload that can be delivered over IPC. No automatic response fragmentation/retry is provided.
- Local promise rejection never establishes canonical non-commit. A genuine write may have committed before send failure, protocol rejection, disconnect or timeout; recovery stays under original authenticated receipt semantics. Read requests have no durable historical receipt.
- The red control selects 16 terminating behavior regressions, not every old-client lifecycle hang. All 24 final tests, existing ingress receipt/auth suites and full gates run on corrected code. No arbitrary process scheduler race coverage or exhaustive accepted-input cross-product is claimed.

## Next-pass readiness

**A3 COMPLETE; A4 READY and PENDING. 052A NOT COMPLETE; 053 BLOCKED.** Parent should read this report with unchanged A1/A2 evidence, perform independent A4 review/acceptance, and preserve the intentional wire compatibility decision. No A4, 053, publication or repository history operation was performed by this agent.
