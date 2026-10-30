# 051 — Durable adversarial tests

## Pass

**B6 — adversarial-tests-agent: PASS within the accepted B1 single-active-runtime, host-assured sequential-restart contract.** Added 12 shared Node/Bun adversarial tests covering actual independent-process claim and recovery conflicts, an exact pre-adapter-call SIGKILL, spilled uncommitted WAL pages, duplicate admission/results, stale attempts, cancellation, journal order, ambiguous commit identity and corrupt evidence. Reused and reran B2–B5 evidence rather than duplicating their approval, authority and crash matrices merely to increase counts.

Full suite: **275 pass, 0 fail**. All five shared suites: **82 pass, 0 fail under both Node and Bun**, no Node skips/cancellations/todos. Original safety harness: **21 pass under each runtime**. Runtime verifier, boundary probes, examples and all four independent-process restart runtime pairs pass. Six isolated source mutations were behaviorally killed; unmodified scratch control passes all 12 B6 tests.

Base HEAD remains `08728e48772db14a247add9143669a8e0eab01fa`. No preexisting file was modified, including dirty 050/B1–B5 implementation/tests/reports. No production defect requiring a correction was reproduced within the accepted contract. No dependency, manifest, version, staging, commit, push, tag, publication, B7 or B8 work.

## Independent implementation review and severity

Inspected the implementation independently of the preceding passes' conclusions: transaction acquisition/read/CAS/validation/UPDATE/COMMIT/rollback and retirement; pure metadata/history/state decoder; durable owner callback/publication and reentrancy boundaries; SDK construction, alias lifetime and clock floor; runtime claim/invocation/result/error paths; attempt matching, canonical transitions and complete journal reduction. Then exercised the new assertions against real SQLite and destructive mutations in isolated copies.

| Finding | Severity and disposition |
|---|---|
| No critical/high implementation defect reproduced in the supported local contract | No production patch warranted. This is the result of this bounded review, not a proof of absence of defects. |
| Startup recovery does **not** exclude a live scheduler or fence its adapter | **High-impact deployment hazard if the host violates B1**, not a new supported feature or an unreported guarantee. Actual two-process live-peer characterization below confirms it. Host MUST prevent recovery until the old runtime has stopped. No lock/lease coordinator added. |
| Missing result acknowledgement remains unknown even if the adapter returned, or the local COMMIT actually succeeded | Expected safety behavior; false rollback/retry would be high severity. Tested before/after native commit and after a later revision. Reopen and inspect identity, never compensate or automatically redispatch. |
| Trusted writer can coherently rewrite state plus its entire history | Existing trust boundary/limitation, not cryptographic tamper detection. Corruption tests alter independent evidence or linkage and require explicit failure, not protection from the trusted administrative capability. |
| Root `git diff --check` reports existing whitespace | Low/nonblocking, preserved: `049-final-report.md:7,99`, `release-notes-and-limitations.md:4`. |

### Backend guarantees versus host obligations

**Backend:** one authoritative singleton row includes matching state, ordered journal, results/reconciliation evidence, revision/commit identity and policy-time floor. Each write obtains `BEGIN IMMEDIATE`, validates the authoritative current row, checks expected revision, validates the exact candidate/history/transition and updates together. SQLite WAL/FULL and its bounded writer lock wait serialize raw-store commits. Stale CAS does not acknowledge or release a prepared invocation. Failed validation/confirmed rollback writes nothing; attempted COMMIT or failed rollback with uncertain acknowledgement retires the handle as unknown. Complete raw registry, store-loaded registry and journal reduction agree in the positive assertions. Invalid durable evidence fails explicitly before SDK/router exposure.

**Host:** guarantee one active runtime per run, stop/join the previous process before startup recovery, provision a regular local-file path and trusted filesystem, protect SDK/store/database access as host capabilities, recreate executable services and authentication/reattestations, and explicitly reconcile unknown external effects using evidence before fresh readmission. Persisted principal/grant/approval data is declarative policy, not a login/session/credential or transferable authorization decision. Hosts must not expose the administrative SDK or a generic host-method dispatcher to actors.

**Not provided:** live scheduler coordination, process exclusion, distributed leasing, fencing, remote idempotency, transactional external effects, automatic takeover or exactly-once execution. A store CAS winner is not proof of remote effect uniqueness. Sync depends on SQLite/VFS/OS/filesystem/device behavior; SIGKILL is not a power-cut experiment.

## New fault and concurrency matrix

All rows refer to `packages/core/tests/durable-adversarial.test.js`; private worker seams are in `packages/core/tests/durable-adversarial-worker.js`. “High if broken” describes the safety invariant's impact, not an observed unfixed defect. These are 12 meaningful tests, not a synthetic count of every loop/assertion.

| Scenario / exact seam | Observed assertion | Severity if broken |
|---|---|---|
| Independent processes prepare competing claims at the same revision; each waits in its captured execute getter before store CAS | Distinct OS PIDs, one completed claim/result, one `STALE_REVISION`; winner calls once, losing prepared callable calls **zero** times. Total external markers one, one stored result, original history prefix intact. | High |
| SIGKILL **before the actual adapter callable is invoked** | Test-only `Reflect.apply` interception matches only the captured execute function. It independently reads the already acknowledged durable claim, records callable-entry counter **0**, and kills before forwarding. Raw task is running with active attempt and no effect marker; recovery makes uncertain/unknown, removes attempts and three cycles invoke nothing. | High |
| Competing recovery-only processes after the old process is dead | Each barriers immediately before its recovery transaction's `BEGIN IMMEDIATE`, after preparing its candidate. Exactly one sweep revision; stale loser aborts constructor. **Both resolve/invoke zero adapters**. One `restart_recovery` commit, uncertain/unknown, exact second-open idempotence. | High |
| Deliberately **unsupported live-peer recovery** | One real process remains blocked inside its adapter after writing an effect marker. A separate process opens/recover-quarantines while it is still alive; recovery has zero resolutions/calls. Release the original process: its completion is rejected, no success result is stored, task remains uncertain/operation unknown. This demonstrates **absence of runtime exclusion/fencing**, not a safe takeover protocol. | High deployment hazard, host obligation |
| Process killed with partially written uncommitted WAL pages | Private raw SQLite transaction sets a deliberately inconsistent header and >2 MiB payload, cache size 1 forces dirty-page spill; assert WAL >32 bytes and transaction-local revision 999, then SIGKILL before COMMIT. Reopened **entire** loaded state/headers/floor/commit/evidence equals pre-write state and reduces correctly. These staged raw bytes are physical fault injection, never an accepted domain candidate. | High |
| Duplicate task submission | Existing task ID, duplicate fresh ID in one batch and repeat existing ID after actual close/reopen each throw `INVALID_SEMANTICS`; exact durable state unchanged. Original executes once, completed work skips after reopen. New task IDs remain distinct operations; no content-level deduplication claim. | High |
| Duplicate result delivery | Adapter thenable resolves twice with conflicting outcomes; runtime stores one success and calls adapter once. After reopen, repeat the exact stored result through the **private durable owner + ingestion seam**: `INVALID_RESULT`, no revision/journal/result change. There is intentionally no public SDK result-delivery endpoint. | High |
| Stale attempt completion with a newer active attempt | Real ambiguous first attempt; replay denies until human evidence-backed `confirmed_not_executed` reconciliation and explicit readmission. Hold second adapter in flight; inject old result through the private durable ingestion seam. `INVALID_RESULT`, **entire durable row unchanged**, new active attempt preserved. Correct new result then commits once. | High |
| Late public-runtime completion after cancellation | Cancel during outstanding adapter promise, then return success. Runtime rejects completion without marking terminal cancellation uncertain; task/queue remain cancelled, zero stored execution results. | High |
| Journal ordering with tied and backward timestamps | Actual commits at 9000, 9000, 1000; page in chunks of 2. Dense ordinals and all events equal immutable array order, explicitly differ from timestamp sorting. Reducer/raw/store equality remains valid. | Medium/high |
| Fault after actual UPDATE, then lost native COMMIT acknowledgement | Throw **after** actual UPDATE: confirmed rollback, `STORAGE_UNAVAILABLE/not_committed`, exact state unchanged, one write and no retry. Separate attempt actually COMMITs then throws: `COMMIT_OUTCOME_UNKNOWN/unknown`, handle closed, exact proposal found on reopen. Append a later valid revision and recover proposal truth by commit ID plus exact reduced journal prefix; never infer rollback from exception or only compare latest commit ID. | High |
| Corrupt result evidence or reordered diagnostic linkage | Independently forge stored receipt or reverse diagnostic IDs. SDK construction and raw reopen throw `STORAGE_CORRUPT`, **zero router access**, corrupted raw row remains byte-for-data as written (no silent repair/initialization). | High |

The exact-before-invocation seam enters the private invocation wrapper but **not** the actual adapter callable; it improves on B3's honestly labeled adapter-entry-before-external-effect window. No public fault hook or production instrumentation was introduced. Acknowledged claim truth is observed through another store handle before the kill, not inferred from a marker alone.

The isolated claim race intentionally adversarially creates two one-shot runtime contenders. Its result applies to **that single same-revision claim**, not ongoing multi-scheduler correctness. Recovery-race workers never run cycles. The separate live-peer test is an unsupported-deployment characterization: quarantine cannot stop an already executing external effect. There is no “safe live recovery” claim hidden in any passing test.

## Reused evidence, actually rerun

- **B2 `tests/storage-adapter.test.js`:** raw independent-process CAS and uncommitted-reader isolation; lock timeout; initialization contention; candidate run/schema/revision/history-prefix/delta/operation negatives; header/JSON/version/layout corruption; rollback failure, stale rollback failure and lost COMMIT acknowledgement; detached outputs; complete result/reconciliation evidence persistence. Original assertions unchanged.
- **B3 `tests/crash-recovery.test.js`:** all eight actual SIGKILL windows; claim/result UPDATE and pre/post-COMMIT exceptions; no compensating uncertainty overwrite; retired owners; failed/unknown recovery constructor; unavailable authoritative reads; in-flight close; policy-time floor. New B6 seam supplements rather than mislabels B3 window 3.
- **B4 `tests/authority-continuity.test.js`:** exact approval continuation after real reopen and consumed-approval preservation; missing/foreign/stale/consumed/expired/revoked approval negatives; host reattestation ingress; restored principal/actor/grant denial and post-effect commit reevaluation; policy-time pause deadline regression. No additional “approval test” merely to inflate B6 counts.
- **B5 `tests/process-recovery.test.js` and CLI proof:** Node→Node, Bun→Bun, Node→Bun, Bun→Node, each with genuine separate-PID approval continuation and effect-before-ack SIGKILL quarantine. Continuation opens only SQLite; no registry passed between stages. Exact approved attempt continues once; ambiguous task redispatches zero times. Recreated host sessions/services are not recovered credentials.

## Mutation matrix

Mutated **fresh isolated scratch copies only**, sharing the same installed dependencies through a node_modules symlink. Unmodified control: `node --test tests/durable-adversarial.test.js`, exit **0**, 12 pass, 0 fail. No live repository source was edited for mutation testing.

For each row the exact command from its copy was `node --test --test-name-pattern='<pattern>' tests/durable-adversarial.test.js`. Each mutant exits **1**, one behavioral test fails; none is a syntax/import/dependency failure. Full replacement text, exact commands/cwd, exits and complete logs are retained in `/home/d/.hermes/cache/scratch/chord-b6-mutants-final/results.json` and `<name>.log`. Reproducible harness: `/home/d/.hermes/cache/scratch/chord-b6-mutations.py`.

| Name / production predicate changed in scratch | Pattern | Actual failure | Severity if undetected |
|---|---|---|---|
| `cas`: replace `if (expectedRevision !== current.revision)` with `if (false)` before stale return | `independent process claim conflict` | Missing expected stale loser (`assert.ok(loser)`). Lower candidate-revision validation still rejects, so this mutation proves the early stale contract, **not** loss of every CAS defense or double effects. | High API/concurrency boundary |
| `recovery`: `['running', 'leased'].includes(task.status)` → `['leased'].includes(task.status)` | `SIGKILL exact before adapter callable` | Actual `running`, expected `uncertain`. | High |
| `evidence`: reducer/state-equality `if (!sameData(reduceTrace(registry.event_journal), registry))` → `if (false)` | `corrupt execution evidence` | Corrupt evidence reaches router binding; wrong error instead of required `STORAGE_CORRUPT`. | High |
| `attempt`: `result.attempt_id !== attempt.attempt_id ||` → `false ||` | `stale attempt result` | Missing expected `INVALID_RESULT`; stale internal ingestion is accepted. | High |
| `ordinals`: raw history array → `[...state.registry.event_journal].sort((a, b) => a.at - b.at)` | `journal pagination` | Actual returned event order differs from durable array order. | Medium/high |
| `unknown`: attempted COMMIT/rollback branch throws `STORAGE_UNAVAILABLE/not_committed` instead of `COMMIT_OUTCOME_UNKNOWN/unknown` | `post-UPDATE exception` | Actual false rollback classification rejected by exact error/status assertion after real COMMIT. | High |

**Six killed, zero survivors in this targeted set.** No broad mutation-score or exhaustive predicate-coverage claim. B2/B3 tests continue to exercise additional error and rollback guards, but were not all independently mutated in B6.

## Files inspected

- Complete `docs/internal/051-{storage-contract,storage-implementation,crash-recovery,authority-continuity,process-recovery-proof}.md` reports, including B1 integration addendum and host/scope limitations.
- `packages/core/src/runtime/storage/sqlite.js`, `src/storage/contract.js`, `src/runtime/recovery.js`.
- `packages/core/src/registry/owner.js`; task/result registration in `src/registry/registry.js`.
- SDK durable constructor, transaction alias, authority/readmission/admission/resume and runtime/public host methods in `packages/core/src/sdk/chord.js`.
- `packages/core/src/platform/{runtime-loop,transitions,attempts,authorization,state-invariants,trace-reducer,adapter-routing}.js`; `src/execution/{results,task-packets}.js`.
- Existing storage/crash/authority/process suites/workers and host fixtures; package manifest; entry Git status, preserved entry hashes, full run/mutation outputs and proof summaries.

## Files changed

Created only:

1. `packages/core/tests/durable-adversarial.test.js` — 12 shared actual-storage tests.
2. `packages/core/tests/durable-adversarial-worker.js` — isolated claim/recovery barriers, exact pre-call SIGKILL, live-peer characterization and partial-WAL writer.
3. `docs/internal/051-durable-adversarial-tests.md` — this report.

**No preexisting repository file changed.** Entry inventory `/home/d/.hermes/cache/scratch/chord-b6-entry.json`; byte/hash comparison returned `ENTRY_FILES_CHANGED []`. Original safety SHA-256 remains `95b72cd7189bb2d54685bdd3f08561ef0740f3e8399bbc04cb10a269228248eb`. Runtime/test databases are in configured scratch and cleaned by fixtures; CLI proof evidence remains inspectable. Added procedural seam/recovery lessons to the active profile's existing testing skill outside the repository, not a product change. No other profile modified.

## Test commands

Measured Linux Node **v24.22.1** and Bun **1.4.3**, both using `node:sqlite`. Bun executable is `/home/d/.bun/bin/bun`. Unless marked root, commands ran in `/home/d/Workspace/other-projects/chord/packages/core`. The original complete suite imports `bun:test`, so only the five explicitly shared suites are claimed runnable under Node.

| Exact command | Exit | Actual result |
|---|---:|---|
| `node --test tests/durable-adversarial.test.js` | 0 | Final focused rerun: 12 pass, 0 fail/cancelled/skipped/todo |
| `/home/d/.bun/bin/bun test tests/durable-adversarial.test.js` | 0 | Final focused rerun: 12 pass, 0 fail |
| `node --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | 82 tests, 82 pass, 0 fail/cancelled/skipped/todo |
| `/home/d/.bun/bin/bun test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | 82 pass, 0 fail, 5 files |
| `/home/d/.bun/bin/bun test` | 0 | 275 pass, 0 fail, 1635 Bun expect calls, 21 files |
| `node --test docs/internal/046-state-probes.mjs` (root) | 0 | 21 pass, 0 fail/cancelled/skipped/todo |
| `/home/d/.bun/bin/bun test ./docs/internal/046-state-probes.mjs` (root) | 0 | 21 pass, 0 fail, 1 file |
| `node packages/core/src/verify-runtime.js` (root) | 0 | `ALL RUNTIME VALIDATIONS PASSED!` |
| `/home/d/.bun/bin/bun run packages/core/src/verify-runtime.js` (root) | 0 | Same runtime verifier success |
| `node /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs` (root) | 0 | Boundary JSON below |
| `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs` (root) | 0 | Identical boundary JSON |
| `node packages/core/examples/quickstart.mjs` (root) | 0 | completed true, adapterCalls 1 |
| `/home/d/.bun/bin/bun packages/core/examples/quickstart.mjs` (root) | 0 | completed true, adapterCalls 1 |
| `node packages/core/examples/cross-actor-workflow.mjs` (root) | 0 | completed; handoff/approval/consumption/snapshot/replay verified, revision 14, events 34, dispatches 1, negative effects 0 |
| `/home/d/.bun/bin/bun packages/core/examples/cross-actor-workflow.mjs` (root) | 0 | Same semantic assertions/counts; generated IDs differ |
| `node examples/process-recovery.mjs /home/d/.hermes/cache/scratch/chord-b6-node-evidence` | 0 | B5 PASS, approval and ambiguous scenarios |
| `/home/d/.bun/bin/bun examples/process-recovery.mjs /home/d/.hermes/cache/scratch/chord-b6-bun-evidence` | 0 | Same |
| `node examples/process-recovery.mjs /home/d/.hermes/cache/scratch/chord-b6-node-bun-evidence /home/d/.bun/bin/bun` | 0 | Same |
| `/home/d/.bun/bin/bun examples/process-recovery.mjs /home/d/.hermes/cache/scratch/chord-b6-bun-node-evidence /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 | Same |
| `python3 /home/d/.hermes/cache/scratch/chord-b6-mutations.py` (root) | 0 | Control exit 0/12 pass; six mutants each exit 1 on intended behavioral assertion |
| `git diff --check` (root) | 2 | Only the three preexisting whitespace diagnostics listed above |

Boundary output, both runtimes:

```json
{"actorFieldsRejected":3,"recursiveDataOnly":true,"forgedResultRejected":true,"canonicalAuthorityUnchanged":true,"unknownRedispatchRejected":true,"adapterCalls":1,"allowDecisionFrozen":false}
```

Final suite metadata is `/home/d/.hermes/cache/scratch/chord-b6-final-suites.json` (12 focused/82 shared/275 full, all exit 0, including the final raw-row byte equality assertion). Earlier focused metadata/logs are `chord-b6-final-focused.json` and `chord-b6-{node-focused,bun-focused}.log`. Command metadata and logs: `/home/d/.hermes/cache/scratch/chord-b6-checks.json`, `chord-b6-{node-shared,bun-shared,full,safety-node,safety-bun-explicit,verify-node,verify-bun,boundary-node,boundary-bun,quick-node,quick-bun,cross-node,cross-bun,proof-node,proof-bun,proof-node-bun,proof-bun-node,diff-check}.log`. Shared commands save and propagate the actual exit code, not a pipeline footer status. Multi-check runner uses subprocess return codes; logs retain complete output. Bun expect counts exclude Node strict assertions and are not a total assertion count.

### Retained independent-process restart artifacts

Each evidence root in the commands table contains B5's unchanged `summary.json`, per-scenario SQLite files, effect ledger, pre-/post-recovery registry evidence, process exit/signal/executable/PID artifacts and final reduction assertions. These were read back, not inferred from CLI exit alone:

| Pair | Approval writer → reader PIDs | SIGKILL writer → recovery PIDs | Final assertions |
|---|---|---|---|
| Node→Node | 45894 → 46026 | 46180 → 46238 | approval calls 1, rejected sessions 3; ambiguous calls 0; both journalMatches true |
| Bun→Bun | 45880 → 45985 | 46099 → 46117 | Same |
| Node→Bun | 45964 → 46058 | 46135 → 46203 | Same |
| Bun→Node | 46168 → 46222 | 46269 → 46298 | Same |

All four roots report `gate: "B5 PASS"`, both scenarios retain one previously committed effect and zero ambiguous redispatches; ambiguous first signal is `SIGKILL`. Approval final journals contain 28 events; ambiguous journals 20. This reruns B5, not a newly expanded full Proof 2/3.

## Exit codes and results

All final requested behavioral checks pass. Two **additional Bun safety invocation attempts** failed honestly before using the correct explicit-file invocation: `bun test docs/internal/046-state-probes.mjs` exit 1 treated the argument as a filename filter and found no tests; direct `bun docs/internal/046-state-probes.mjs` exit 1 rejected node:test outside the runner. Correct `bun test ./docs/internal/046-state-probes.mjs` exit 0 runs and passes all 21 unchanged tests. Initial logs are `chord-b6-safety-bun.log` and `chord-b6-safety-bun-direct.log`. The initial multi-check harness itself exits 1 solely because it records the first extra Bun invocation failure; every other command in its metadata passed (apart from expected preexisting diff-check 2). The corrected explicit command is independently logged; no failed result is overwritten or presented as a pass.

Mutation exits 1 are expected behavioral detections, not product failures. There were no failing new product regressions requiring source changes. Full/shared/proof results above are actual measured output, not extrapolated from a prior pass.

## Invariants verified

- Failed/conflicted/unacknowledged claims do not release prepared adapter execution; the losing independent claimant invokes zero effects.
- Separate recovery contenders produce one canonical sweep and a stale loser, not duplicate recovery state/evidence or dispatch. Explicit second reopen is idempotent.
- Exact pre-call crash leaves an acknowledged running claim, zero actual callable entries and no external marker; conservative recovery still quarantines it, never assumes nonexecution.
- SIGKILL after dirty-page WAL spill leaves no partial committed header/registry/history/evidence. This establishes process-crash rollback, not power-loss safety.
- Duplicate task IDs and consumed result attempts do not duplicate work/evidence; stale results cannot consume the newer active attempt; cancelled terminal facts remain terminal.
- Ambiguous local acknowledgement is resolved by exact durable identity/history, even after later revisions; no false rollback, automatic retry or compensating uncertainty write.
- Full state, evidence, immutable history order and dense pagination agree; independent corruption fails explicitly with no initialization/repair/router exposure.
- Approval and declarative authority continuity, clock-floor expiry/revocation, host reattestation and separate-process continuation remain passing in original B4/B5 tests and examples.
- Preexisting source/test/report bytes, safety harness and all shared/full/runtime regressions are preserved.

## Known limitations

One active runtime per run and exclusive sequential restart remain mandatory. The live-peer test explicitly proves those obligations are **not enforced by a database-backed process lock**; rejection of the old completion cannot undo its effect. Same-revision CAS tests are not distributed scheduling guarantees. Only measured local Linux Node/Bun versions are covered. No hardware power cut, network filesystem, live lease takeover, fencing, remote idempotency, exactly-once, staged durable effect acknowledgement, cryptographic integrity, encryption, secret scrubber, schema migration or compaction proof. Internal ingestion seam coverage is not an invented public actor result API. SDK/store handles remain privileged host capabilities; actor authentication belongs to the embedding host.

Whole-state/history validation remains synchronous O(state/history), with existing 1 MiB/16384-node/1024-array limits and one-second SQLite writer wait. IDs and diagnostic timestamps remain nondeterministic. The test ledger simulates external effects rather than a remote business service. Scratch artifacts are inspectable execution evidence subject to normal scratch cleanup, not permanent release attestations. Full Proof 2/3 and product/release promotion gates remain deferred.

## Blockers

**None for bounded B6.** Live scheduler coordination is intentionally unsupported, experimentally characterized, and not smuggled into a passing gate. Applications requiring that guarantee remain blocked on a separately authorized design/implementation; hosts using this local contract must enforce runtime exclusivity. Existing root whitespace remains nonblocking/preexisting. No newly reproduced critical/high supported-contract defect remains open.

## Next-pass readiness

**B6 COMPLETE/PASS.** Gate paths: `docs/internal/051-durable-adversarial-tests.md`, `packages/core/tests/durable-adversarial.test.js`, `packages/core/tests/durable-adversarial-worker.js`. B7/B8 are not executed or authorized by this report. No release/product-level promotion or publication is implied.
