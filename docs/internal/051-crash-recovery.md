# 051 — Durable owner integration and crash recovery

## Pass

**B3 — recovery-agent: PASS within the accepted single-active-runtime, host-assured sequential-restart contract. READY FOR B4.** The SDK now uses SQLite as its actual owner commit boundary, not periodic snapshot copying. This is not Level B promotion, a staged acknowledgement protocol, exactly-once execution, concurrent scheduler support, full Proof 2, Proof 3, or the separately scheduled B5 continuation proof.

Inputs read in full: `051-storage-contract.md` and `051-storage-implementation.md`. Existing 050/B1/B2 dirty work was preserved; the explicit integration addendum in B1 records the small API/policy details chosen here.

## Supported host API

```js
const chord = createChord({
  storage: { path: '/absolute/host-provisioned/run.sqlite', mode: 'create' },
  trustedHost: { now: () => Date.now() },
  adapterRouter: { fallback: hostAdapter }
});
// Install authority explicitly, admit work and await cycles as before.
await chord.runCycle();
chord.close();

// Only after the old runtime is stopped; executable services supplied anew.
const reopened = createChord({
  storage: { path: '/absolute/host-provisioned/run.sqlite', mode: 'existing' },
  adapterRouter: { fallback: hostAdapter }
});
reopened.close();
```

Construction remains synchronous. Omit `storage` for the preserved memory path. There is no generic injected store/provider option. Storage plus `registry` rejects `INVALID_CONTEXT`; existing storage plus a non-null constructor `trustedHost.authoritySnapshot` also rejects, rather than replacing persisted authority. Explicit administrative `setAuthoritySnapshot` remains supported after reopen. The SDK reference remains the trusted-host capability, not an actor API or authentication token.

`close()` is synchronous/idempotent and closes its owner/resources without implicit commits. Hosts should await cycles first. Closing during an outstanding effect does **not** cancel or undo the effect: its result write rejects `STORE_CLOSED`, its prior claim remains durable and restart quarantines it. Reads, canonical mutations and dispatch cannot resume on that owner. Pure parsers/packet shaping and host router/policy configuration do not reopen it. Construction failure closes an acquired store and never returns a degraded SDK.

## Integration and recovery behavior

- Durable owner retains **no registry authority cache**. Every read and transaction base loads/validates from the raw store; the SDK alias is bound only during a transaction callback and restored in `finally`. Approval/grant helpers, setters, inspections, exports, runtime and administrative installation use authoritative operation boundaries. Removed constructor writes to a previously read alias.
- Candidates retain existing synchronous clone/apply/history/revision discipline, reject reentrant/async callbacks, and commit through the raw transactional CAS. Durable commits never use the in-memory `commitRun` swap. Callback results and prepared invocations are released only after acknowledged store success. Conflicts discard them without replay. No extra post-success read can turn an acknowledged write into a misleading failure response.
- Unknown writes and unavailable/corrupt authoritative reads retire the owner. I/O-unavailable writes also retire it, a deliberately stricter SDK policy than the raw store's known-rollback retry permission. Domain/validation rejection and stale conflicts do not invent write success or automatically replay callbacks.
- Runtime's adapter catch now surrounds only the invocation/normalization. The result transaction is outside that catch. A failed or ambiguously acknowledged result commit cannot trigger a compensating `runtime_uncertain` write over a possibly completed result. A known failed result write leaves its durable claim available for restart quarantine, not effect retry.
- Startup validates and loads first, then performs one ordinary `restart_recovery` owner transaction for `running`/`leased` tasks, before even constructing the router. Shared `markTaskUncertain` preserves unknown operation state, removes active/pending attempts for those tasks, clears queue lease expiration and records supported diagnostic/history evidence. Added the conservative `leased -> uncertain` edge so leased reservations use the same validated transition/reducer path. Completed facts, reconciliation evidence and queued approval reservations are preserved. No sweep commit occurs without in-flight tasks; second reopen is byte-for-data identical to the first recovered registry.
- Logical policy time is `max(latest observed durable floor, valid raw host time)`, checked against prior effective observations. Every commit records that time in the same singleton row. Backward raw time below the floor can be clamped, but cannot revive an expired grant; an effective regression still rejects. Memory retains its prior raw-clock behavior. This is not journal ordering or permission renewal.
- Only validated registry/history/evidence and existing storage metadata/floor are written. No constructor options, host credential, adapter, callback, router, executable or service handle is serialized. The secret sentinel test establishes host-options isolation, not application-payload scrubbing or database encryption.

## Actual interruption windows and exact scope

Each row runs a real SDK child using the current test runtime and a real WAL/FULL SQLite file. The child terminates itself with **SIGKILL** at an instrumented boundary; the parent asserts the kill signal, reads raw durable state before SDK recovery, then reopens. Native SQLite prototype hooks exist only in tests, not in the production API. The replacement SDK runs in the test parent, **not** a second continuation child: B5 remains separate.

| User window / worker name | Exact interruption seam | Raw stored task | External effect marker | Recovery |
|---|---|---|---:|---|
| 1 / `before_commit` | Claim UPDATE staged; immediately before SQLite claim COMMIT | queued | 0 | unchanged; no claim/effect to quarantine |
| 2 / `after_commit` | SQLite claim COMMIT returned internally; killed before its JS acknowledgement returns to store/owner | running | 0 | uncertain; no assumption that missing acknowledgement meant rollback |
| 3 / `before_dispatch` | Claim acknowledged; adapter callable entered and killed immediately **before external-effect marker** | running | 0 | uncertain, despite actual nonexecution in this test |
| 4 / `dispatch_before_ack` | External-effect marker written; killed before adapter return | running | 1 | uncertain; no blind redispatch |
| 5 / `ack_before_result_commit` | Adapter returned and normalized; result UPDATE staged, killed before result COMMIT | running | 1 | uncertain; returned outcome was not durable evidence |
| 6 / `confirmed_committed` | SQLite result COMMIT completed; killed before returning acknowledgement | completed | 1 | exact committed completion preserved |
| 7 / `approval_suspension` | Prepared pending attempt and paused run both committed; killed before approval installation | queued / paused run | 0 | reservation and suspension preserved; cycle denied |
| 8 / `reconciliation` | Adapter ambiguity committed; human no-effect reconciliation committed; killed before explicit readmission | uncertain / operation not_executed | 1 | reconciliation/evidence preserved; no implicit replay |

Window 3 is an honest **pre-external-dispatch** boundary at adapter entry, not a claim that the process was interrupted before the JavaScript invocation instruction. Window 5's “ack” means only an adapter return: there is **no staged durable effect-ack protocol**. Returned but uncommitted external outcomes remain unknown. The effect marker is an independent local file simulating a visible side effect, not a production external service receipt, hardware power-cut experiment or proof of remote atomicity. Window 8's no-effect evidence is host-authored test evidence; the marker deliberately is not automatically treated as an authoritative business receipt.

Additional real-storage fault tests exercise claim and result UPDATE failures, COMMIT throws before native commit, and lost acknowledgement after actual native commit. They assert exact `not_committed` versus `unknown`, no adapter invocation after a failed claim, exactly one invocation after a successful claim, no second uncertainty UPDATE, retired-owner failure, and exact raw queued/running/completed state after reopening. A real competing store commit during adapter getter preparation wins CAS; the losing callback/getter runs once and its prepared callable is never invoked. Leased-reservation recovery tests fail the sweep before commit and after successful COMMIT with lost acknowledgement: constructor aborts before router access, then a clean reopen completes or recognizes the already committed sweep. Corrupt authoritative reads retire instead of serving stale views. Close during an in-flight effect neither commits completion nor hides uncertainty.

## Files inspected

- Entire B1/B2 reports; entry Git status and byte hashes.
- `packages/core/src/registry/{owner,registry,snapshot}.js`.
- `packages/core/src/sdk/chord.js`, `src/platform/{runtime-loop,transitions,state-invariants,adapter-routing}.js`.
- `packages/core/src/storage/contract.js`, `src/runtime/storage/sqlite.js` (complete raw adapter).
- `packages/core/tests/{storage-adapter,recovery-integrity}.test.js`, `tests/fixtures/host.js`; targeted existing adversarial, transition, admission, lifecycle and contract test assertions.
- `packages/core/package.json`; changed source diff, new recovery coordinator/worker/tests, all final execution logs and preservation comparison.

## Files changed

Modified:

1. `packages/core/src/registry/owner.js` — optional private synchronous store port, authoritative loads/CAS, retirement and close.
2. `packages/core/src/sdk/chord.js` — synchronous storage lifecycle/clock setup/recovery, transaction-only alias, fresh helpers, no post-commit read, host close API. Preserved its pre-existing helper additions.
3. `packages/core/src/platform/runtime-loop.js` — separate invocation catch from result persistence; preserved pre-existing response code additions.
4. `packages/core/src/platform/transitions.js` — leased quarantine edge and cleared uncertain queue lease expiration.
5. `docs/internal/051-storage-contract.md` — explicit B3 integration addendum; B1's historical report retained.

Created:

6. `packages/core/src/runtime/recovery.js` — effect-free ordinary owner startup sweep.
7. `packages/core/tests/crash-recovery.test.js` — shared Node/Bun integration, eight interruption windows and storage-failure/lifecycle tests.
8. `packages/core/tests/crash-recovery-worker.js` — real child SIGKILL boundary worker.
9. `docs/internal/051-crash-recovery.md` — this report.

No manifest, lockfile, dependency, snapshot/contracts/history/storage version change. No staging, commit, push, tag, publication or destructive Git operation. B2 raw adapter/contract/tests and all other pre-existing files remain unchanged. Temporary databases, marker files, entry hashes and logs are under `/home/d/.hermes/cache/scratch`, via configured TMPDIR.

## Test commands

Measured versions: `node --version` → `v24.22.1`; `/home/d/.bun/bin/bun --version` → `1.4.3`, each exit 0. Both runtimes use the accepted lazy **node:sqlite** binding.

From `packages/core`:

| Exact command | Exit | Actual final result |
|---|---:|---|
| `node --test tests/storage-adapter.test.js tests/crash-recovery.test.js` | 0 | **33 tests, 33 pass, 0 fail**, no cancelled/skipped/todo: 11 original shared adapter + 22 B3 tests |
| `/home/d/.bun/bin/bun test tests/storage-adapter.test.js tests/crash-recovery.test.js` | 0 | **33 pass, 0 fail**, 2 files |
| `/home/d/.bun/bin/bun test` | 0 | **226 pass, 0 fail, 1635 expect() calls**, 18 files |

The full repository suite contains `bun:test` imports and is run with Bun; it is not claimed to run under Node. The new shared suites use `node:test`/Node assertions and really run under both. Bun's expect count excludes the shared suites' Node assertions. Final full/shared logs: scratch `chord-b3-full-suite.log`, `chord-b3-node-shared.log`, `chord-b3-bun-shared.log`.

From repository root:

| Exact command | Exit | Actual result |
|---|---:|---|
| `node --test docs/internal/046-state-probes.mjs` | 0 | **21 pass, 0 fail**, none cancelled/skipped/todo |
| `/home/d/.bun/bin/bun run packages/core/src/verify-runtime.js` | 0 | `ALL RUNTIME VALIDATIONS PASSED!` |
| `node packages/core/examples/quickstart.mjs` | 0 | `completed: true`, `adapterCalls: 1` |
| `node packages/core/examples/cross-actor-workflow.mjs` | 0 | completion, handoff/approval/consumption, snapshot restore and replay verified; revision 14, 34 events, one dispatch, zero negative effects |
| `/home/d/.bun/bin/bun packages/core/examples/quickstart.mjs` | 0 | `completed: true`, `adapterCalls: 1` |
| `/home/d/.bun/bin/bun packages/core/examples/cross-actor-workflow.mjs` | 0 | same semantic assertions/counts as Node; nondeterministic run id differs |
| `node /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs` | 0 | actorFieldsRejected=3, recursiveDataOnly/forgedResultRejected/canonicalAuthorityUnchanged/unknownRedispatchRejected=true, adapterCalls=1, allowDecisionFrozen=false |
| `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs` | 0 | identical boundary JSON values |

Root checks' full logs are scratch `chord-b3-check-0.log` through `chord-b3-check-7.log`, with exact commands/exits also saved in `chord-b3-checks.json`. Shell commands preserve the behavioral exit code after logging; no pipeline masks failures.

## Exit codes and results

All final behavioral commands exited **0**. Earlier development iterations honestly failed two test assumptions: authority revision had also advanced during grant installation, and a backward raw reading clamped by an already persisted floor is not an effective-time regression. Assertions were corrected to the actual authority/floor contract and additional effective-regression coverage was added. No production storage failure was reclassified as adapter failure to make tests pass.

`git diff --check` retains exit **2** solely for three pre-existing trailing-whitespace diagnostics in `049-final-report.md` and `release-notes-and-limitations.md`; none added by B3. Final entry-hash preservation comparison confirms exactly the five intended pre-existing paths changed plus the four new paths above; no other entry file changed or disappeared.

## Invariants verified

- Real durable owner authority, whole-row state/journal/evidence commit, stored-revision CAS and synchronous callback discipline; memory regression suite remains passing.
- Prepared dispatch is invoked only after acknowledged claim; stale/error/unknown claims invoke nothing; callbacks are never automatically replayed.
- Unknown or known failed result persistence never causes a second uncertainty write over possible completion. Owner retirement prevents further reads/mutations/dispatch until explicit reopening.
- Effect-free startup quarantine precedes usable SDK and router construction; no lease-clock takeover inference, approval consumption or external invocation during recovery.
- Completed facts, suspension and reconciliations survive actual SIGKILL; uncertain effects cannot automatically replay; second recovery is idempotent.
- Durable floor survives backward-clock restart and prevents expired-grant revival; effective regressions fail closed.
- Host credentials/options/executables are not serialized; full SDK remains trusted-host capability, not actor admission or sandboxing.

## Known limitations

Single active scheduler and host-assured sequential restart only. Eight child interruptions are process crashes, **not power loss**; SQLite/OS/filesystem/device sync guarantees remain assumptions. Window 3 is adapter-entry pre-effect as detailed above. Replacement SDK recovery is in the test parent; B5's independent continuation process is not supplied here. No staged acknowledgement, idempotency/fencing, distributed recovery, exactly-once promise, cryptographic tamper protection, encryption, secret scrubber, migration or compaction. Application-authored payloads can still contain secrets. Existing whole-registry size/node/1024-event limits remain; O(full state/history) synchronous validation and one-second lock waits remain blocking. Tested Linux Node/Bun versions only. No full Proof 2/3 or release/product-level promotion.

## Blockers

**No B3 blocker within the bounded accepted contract.** Larger proof/release/deployment gates remain unchanged. Hosts must supply exclusivity and resupply executable/authentication services after restart. Unknown external outcomes still require evidence-backed human reconciliation and explicit fresh authority/readmission; an adapter return alone is not such durable evidence.

## Next-pass readiness

**B3 COMPLETE; B4 READY when separately authorized.** Extend authority/revocation/expiry/consumed-approval and stale-result negatives against the durable boundary without changing the trusted-host capability model. B5 remains the distinct independent-process continuation proof; B6 and later adversarial/reporting work remain separate. No B4–B8 implementation or proof promotion was performed.
