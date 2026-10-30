# Block 052 — Dispatch and takeover safety

## Pass

**Pass 5 only — dispatch-safety-agent. IMPLEMENTED; READY for Pass 6 independent proof work, not a production/publishing gate.** Repository `/home/d/Workspace/other-projects/chord`, protected dirty base HEAD `08728e48772db14a247add9143669a8e0eab01fa`. No Pass 6 public proof, Pass 7 adversarial campaign, Block 053, dependency/version change, staging, commit, push, tag or publication was performed.

## Agent

**dispatch-safety-agent.** Loaded `repository-documentation-verification` and recorded the reusable claim-ack/real-process takeover test technique there in the default profile, outside the repository. Implementation is JavaScript ESM, pure coordination transitions with narrow synchronous SQLite/clock shells. Legacy runtime and exact v1 schemas were not edited.

## Files inspected

- Complete accepted `docs/internal/052-coordination-protocol.md` (530 lines), `052-ownership-audit.md`, `052-fencing-implementation.md` and `052-actor-ingress.md`, including P3/P4 addenda and P5 handoffs.
- Complete current `packages/core/src/coordination/{contracts,state,history,commands}.js`, `src/runtime/storage/coordinated-sqlite.js`, `src/runtime/actor-ingress.js`, `src/sdk/chord.js`, `src/platform/{runtime-loop,attempts,authorization,reconciliation,task-queue,adapter-routing,policy,state-invariants,trace-reducer}.js`, `src/execution/{task-packets,results}.js`, `src/registry/registry.js`, and `src/storage/contract.js`.
- Exact relevant domain contracts, root exports, existing coordinated-storage and actor fixture/test seams, raw SQLite rows, final command logs and filesystem entry/final hashes.

Abbreviated `src/` and `tests/` paths below are relative to `packages/core/`. Scratch root **`S=/home/d/.hermes/cache/scratch/chord-052-pass5`** retains regenerable `entry.json`, `preservation.json`, `commands.json`, `final-commands.json` and full named logs. Scratch is not a release artifact and may be pruned.

## Files changed

Modified only these pre-existing files:

1. `packages/core/src/index.js` — explicit experimental `createCoordinatedChord` export; adjacent comments corrected. Existing legacy exports retained.
2. `packages/core/src/coordination/contracts.js` — exact SigilJS runtime claim/outcome requests and evidence, including exact existing AdapterResult validation.
3. `packages/core/src/coordination/state.js` — final-time readmission/reconciliation reauthorization, unknown-readmission protection even through host maintenance, and stronger task/queue/operation/sidecar cross-invariants.
4. `packages/core/src/coordination/history.js` — legal pure runtime reconstruction and complete per-revision domain/coordination/evidence equality.
5. `packages/core/src/runtime/storage/coordinated-sqlite.js` — fenced claim/outcome branches, authoritative dispatch checks, narrow read-only `checkOwner`, one acknowledged generation per raw handle.

Created:

- `packages/core/src/coordination/runtime.js` — pure claim planning/reconstruction, identity-first outcome reduction, current dispatch authority evaluation and runtime replay.
- `packages/core/src/registry/coordinated-owner.js` — private fixed-credential owner closure, synchronous busy guard and sticky loss.
- `packages/core/src/sdk/coordinated-chord.js` — separated experimental host ports and captured dispatch shell.
- `packages/core/tests/coordinated-dispatch.test.js` — **30 shared tests**, including independent Node/Bun processes.
- `packages/core/tests/coordinated-dispatch-worker.js` — fresh-service owner process and synchronous final-check takeover worker.
- `docs/internal/052-dispatch-takeover-safety.md` — this report.

The entry inventory covers **652 files** excluding `.git`/`node_modules`. All other entry files, including every previous test/report, legacy source change, manifest, lockfile and dependency/version value, remain byte-identical. Nothing was deleted. Prior dirty work was preserved rather than compared only with HEAD. Nothing is staged.

## Implementation decisions

### Installed experimental interface

Root export:

```js
createCoordinatedChord({
  storage: {path, mode: 'create' | 'existing', expectedIdentity},
  trustedHost: {clock}, // synchronous trusted clock.now(); defaults to Date.now
  owner_id,           // optional host launch UUID; default fresh random UUID
  adapterRouter,
  runtimePolicy
})
// -> frozen {observer, owner, admin, createActorIngress}
```

Construction creates only pristine genesis in explicit create mode, or validates the exact existing v2 identity. It does not call legacy `createChord`, legacy recovery, adapter resolution, `adapter.execute`, or automatic acquisition. Existing principal/approval/lease records are not sessions. Fresh host services must be supplied on each construction. Acquisition is the existing atomic generation allocation + populated-work quarantine commit; a usable cycle requires acknowledged acquisition.

Ports:

```js
owner.acquire({expectedRevision}) // returns revision/commitId/lease, NOT credential
owner.renew({expectedRevision})
owner.release({expectedRevision})
owner.runCycle()                 // Promise; result commit returns store success/result
owner.close()                   // no implicit release or effect cancellation

observer.inspect()              // {identity, revision, commitId, envelope}
observer.exportEnvelope()
observer.replayEnvelope()
observer.readHistory({afterOrdinal, limit})
observer.close()                 // closes this factory; no recovery/release

admin.commitRun({expectedRevision, nextRegistry, audit_label?})
admin.setAuthoritySnapshot(snapshot, {expectedRevision})
admin.setCoordinationPolicy(policy, {expectedRevision, audit_label?})
admin.reconcileTask(ReconciliationRequest)
admin.readmitTask(taskId, {expectedRevision})

createActorIngress({authenticate})
// -> existing frozen {handleAuthenticated(channelContext, commandJSON), attachChild(child)}
```

`owner.runCycle()` successful result persistence returns `{ok:true,revision,commitId,result:{task_id,attempt_id,classification:'result'|'uncertain'}}`. It does not return the legacy SDK result shape. The observer or authorized actor outcome command reads the persisted exact Outcome. No-work/deferred/no-adapter responses are noncommitting cycle responses, not fabricated receipts.

The owner captures exactly its acknowledged credential for its lifetime. Renewals never replace it. Each invocation captures a frozen copy and an immutable flat DispatchRecord; disk reads cannot refresh either. Reacquisition requires a fresh host/raw-store handle, including deliberate owner UUID reuse. `checkOwner({credential})` is an additional privileged read-only raw-store primitive used before any router/callable preparation; it validates the acknowledged handle credential and returns the authoritative snapshot plus sampled host time. It is not an actor API.

### Complete supported mutation coverage and explicit omissions

All exposed canonical administration, owner lifecycle, actor writes, runtime claims and runtime outcomes reach the same v2 fenced `store.commit`. There is no legacy owner.install, error-handler diagnostic write, read-triggered recovery, callback-based SQL reducer, automatic expected-revision retry, or cached state fallback.

| Surface | Coordinated disposition |
|---|---|
| Authority snapshot | `admin.setAuthoritySnapshot`; explicit expected revision, exact-next authority revision, no reset/removal of consumed approval facts. SQL owner/final-time fence. |
| Coordination policy | `admin.setCoordinationPolicy`; P4 exact-next policy/replay and owner fence retained. |
| Trusted maintenance | `admin.commitRun` is explicitly privileged `host_commit`, not an arbitrary operation selector, SDK dispatcher or actor endpoint. Exact-next domain candidate, immutable journal, legal transitions, no active-attempt invention/retokening and induced sidecar closure. It cannot queue unknown work without prior not-executed reconciliation. |
| Reconciliation/readmission | Narrow host methods; explicit expected revision, evidence-bearing human reconciliation, current permission reevaluated at final SQL time; readmission preserves logical operation identity and consumed approvals. Host must freshly authenticate/attest the human out of band. Port possession remains privileged. |
| Actor submission/handoff/approval/read | All seven existing P4 commands; private commit closure uses the captured credential. Fresh authentication on every command/duplicate remains required. Approval response itself invokes no adapter. |
| Acquire/renew/release/restart | Acknowledged fixed credential; acquire/release quarantine active work atomically. Observer construction does not recover. No separate restart-recovery mutation. |
| Runtime claim/result/error | Exact fenced requests, pure reconstruction, linked replay, identity-first outcome checks, no compensating diagnostic write. |
| No work / denied / deferred / no adapter | Owner eligibility checked before planning. No canonical diagnostics, automatic retry, dead-letter scheduling, reservation installation or callable on these paths. No-adapter leaves the queued task unchanged for explicit future host action. |
| Legacy SDK convenience mutations | **Absent** from the coordinated facade: registerSpec/registerSpecAndQueue/queueTaskPackets, prepareAttempt, cancelTask, legacy propose/respond handoff, pause/resume/rejectApproval/cancelRun, `_invalidatePendingAttempt`, grant/approval minting helpers, local router/policy setters, snapshot import and legacy owner.install. A trusted host may build a legal maintenance candidate, but no omitted method is secretly routed to the legacy SDK. |

The accepted runtimePolicy concurrency caps are used. Its legacy retry policy does not enable retries in this narrower coordinated shell. Actor submission and approval preparation use the P4 pure command protocol, not the omitted legacy convenience methods. Host SDK/raw store/filesystem possession remains outside the actor JSON threat boundary.

### Claim, invocation and result boundary

1. Under the local synchronous guard, `checkOwner` validates fresh owner eligibility before route resolution or `execute` getter capture. The shell plans a pure candidate and chooses one ready queued task with a durable requested OperationRecord. It captures the selected adapter callable and exact frozen packet/context once. Exact, prefix, default and fallback routes, intent and handoff packets all converge here.
2. SQL checks current identity, captured owner/generation, exclusive owner expiry and expected revision before the runtime transition. `claimCandidate` reconstructs the complete candidate from current state and the proposed dispatch identity, evaluates dispatch authority/approval and commit-stage authority at final SQL time, and compares the complete domain candidate. It consumes the exact approval and persists operation dispatched, running task, queue lease, active attempt, immutable sidecar and both histories atomically. Claim validation/failure/unknown acknowledgement releases no invocation.
3. Immediately after acknowledged claim, `checkDispatch` loads and validates authoritative storage anew, samples trusted time and checks owner/lease, full installed dispatch identity, active task/queue/attempt/task revision, executable run, task lease and commit-stage authority including consumed exact approval. It does **not** require global revision equality with dispatch_revision. The captured callable is entered synchronously afterwards with no await, adapter getter, new routing lookup or application hook in that gap.
4. Both successful and thrown calls retain the original credential and dispatch. The outcome transaction checks owner first, then **exact current active attempt and full sidecar identity before revision handling or constructing any uncertainty/result candidate**. Missing/replaced active attempt is stale. Old callbacks after takeover or same-generation reconciliation/readmission/new-attempt leave the entire newer singleton row unchanged, including revision/floor/history/receipts.
5. With the same valid owner and exact attempt, current authority/run/task-lease denial or adapter error quarantines only that attempt; operation becomes unknown. A valid normalized result persists an unchanged exact Outcome and closes the sidecar completed, meaning local result persisted, not necessarily successful remote work. Persistence is outside the adapter catch. Unknown result commit does not cause a second write or redispatch.

Renewals and unrelated actor submissions advance global revision without mutating dispatch identity or invalidating a still-authorized in-flight attempt. Current authority revision, dispatch-selected grants/approval, task revision, generation, attempt identity and lifecycle checks remain mandatory. Authority change/pause/cancel/expiry tests distinguish uncertainty of the same active attempt from zero-write rejection after its removal.

### Pure replay and narrow protocol addenda

The P3/P4 pure-versus-effectful-helper addenda remain in force; no existing legacy helper/contract was relaxed. Runtime reducers do not use ambient time, randomness, storage, adapters or callbacks. The shell allocates attempt/commit IDs; a new attempt ID is checked against complete current evidence. Combined replay reconstructs runtime transitions at each corresponding domain revision and compares full domain projection, full coordination projection and exact claim/outcome evidence. It rejects mutated immutable identities, resurrection, forged evidence and inconsistent active/queue/operation linkage. A null-dispatch claim is supported only as an exact no-domain-change closing commit (plus run revision/floor), and releases no callable.

**Explicit planning-time clarification:** the protocol requires a candidate/captured callable prepared outside SQL, but authoritative clock/authorization checks inside SQL. The task lease is therefore a checked 30,000 ms deadline planned from the trusted eligibility snapshot; SQL requires that planning time be at least the persisted floor and no later than its first locked sample, and that its final sample still precede the planned deadline. It reconstructs dispatch and final authority from current data rather than extending the task deadline or replaying host code inside SQL. This can conservatively reject a slow plan; it cannot lengthen an owner's/task's authority. Owner lifecycle deadlines retain the P3 first-locked-sample rule unchanged. Immutable owner-lease dispatch evidence is not substituted for current lease validity.

**Explicit identity/maintenance clarification:** the fixed-acquisition rule also applies to the raw store handle, not just the factory; a handle that already acknowledged one acquisition cannot acquire a replacement generation after expiry. Maintenance is powerful host administration but cannot manufacture running/leased work without a matching active dispatch or evade unknown-operation readmission through a different admin operation name. These strengthen the accepted invariants rather than weaken them.

**Replay evidence limit:** the accepted outcome evidence records classification, not raw rejected adapter data or an error message. Uncertainty replay reconstructs its exact deterministic quarantine projection; it does not invent an adapter response, historical login session or remote-effect fact. Successful result replay derives only the already committed narrow result. Reconciliation preparation uses the existing helper outside SQL, drops its ambient-clock diagnostic, and persists the exact reconciliation fact through the once-per-transaction v2 closing evidence with SQL final-time authorization.

No genuine unresolved protocol contradiction required a weakened authority, atomicity, identity, uncertainty or legacy compatibility invariant.

### Downstream opt-in and the residual race

Trusted route registration may opt in with:

```js
{adapter, execution_context: 'chord.execution-context.v2'}
```

Without this registration wrapper, packet and shallow context fields remain exactly legacy-shaped. With it, context gains the accepted frozen `coordination` object containing protocol version, run/incarnation, owner/generation, dispatch owner-expiry/revision evidence, operation/attempt and stable idempotency key. No packet/Attempt/Outcome field is extended. The key is exactly `JSON.stringify(['chord.effect.v1', incarnation_id, run_id, operation_id])`, stable across readmission, new attempts, owner generations and reopening the same run.

**The final database check and an external effect are not atomic.** Another process can take over after the check, or a checked request can arrive later. The test separates passed check/callable entry, delayed service delivery, generation acceptance and committed local outcome. Its cooperating service rejects lower generations after observing a newer one, deduplicates an equal operation key using semantic business payload, and rejects mismatched payload under that key. A separate service that has not seen the newer generation can still accept the old request. This is explicit residual risk, not exactly-once or automatic remote revocation. No automatic downstream fence-advance or acknowledgement-promotion protocol was added.

## Tests executed

Actual runtimes: **Node v24.22.1**, **Bun 1.4.3**. `N=/home/d/.volta/tools/image/node/24.22.1/bin/node`, `B=/home/d/.bun/bin/bun`. Package cwd `/home/d/Workspace/other-projects/chord/packages/core`; root cwd for safety/git. Exact expanded argv/cwd/exits are in `S/final-commands.json`; full final stdout/stderr is in `S/final-*.log`.

| Command | Exit | Actual final result |
|---|---:|---|
| `$N --test tests/coordinated-dispatch.test.js tests/coordinated-storage.test.js tests/actor-ingress.test.js` | 0 | **70 pass**, 0 fail/skipped/cancelled/todo: 30 new P5, unchanged P3 22 and P4 18 |
| `$B test tests/coordinated-dispatch.test.js tests/coordinated-storage.test.js tests/actor-ingress.test.js` | 0 | **70 pass**, 0 fail, 3 files |
| `$B test` | 0 | **345 pass**, 0 fail, 1715 expect calls, 24 files; all prior 315 retained plus 30 P5 |
| `$N --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | Original **82 pass**, 0 fail/skipped/cancelled/todo |
| `$B test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | Original **82 pass**, 0 fail |
| `$N --test docs/internal/046-state-probes.mjs` | 0 | Original **21 pass**, 0 fail/skipped/cancelled/todo |
| `$B test ./docs/internal/046-state-probes.mjs` | 0 | Original **21 pass**, 0 fail |
| `$N src/verify-runtime.js`; `$B src/verify-runtime.js` | 0 each | **ALL RUNTIME VALIDATIONS PASSED!** |
| `git diff --cached --stat` | 0 | Empty; nothing staged |
| `git diff --check` | 2 | Only protected pre-existing whitespace at `049-final-report.md:7,99`, `release-notes-and-limitations.md:4` |
| Entry/final SHA-256 inventory and scoped report/source checks | 0 | Only named five existing source files and six new files; no previous test/report/legacy source/manifest removed or changed |

The full legacy suite imports `bun:test`; no full-suite Node claim is made. New/shared/safety suites and verifier were executed on both actual runtimes. Overlapping command totals are not summed as unique coverage.

Initial execution exposed test-fixture mistakes, not grounds to weaken production checks: a reconciliation fixture supplied an extra unsupported `summary` key and was corrected to the existing exact evidence contract; independent process fixtures initially advanced the child's clock but not the parent's, correctly producing `CLOCK_ROLLBACK`, and were synchronized to the required shared local timeline before testing owner mismatch. Final tests retain the exact schemas and strict rollback behavior. Real before/after COMMIT fault injection remains explicit and uses no production test hook.

## Observed results

The new suite exercises actual factory approval→dispatch→result, exact legacy context and frozen opt-in context, all route/task kinds, captured execute getter once, fixed generation/no adoption, no startup recovery/service lookup, renewal/unrelated actor receipt during pending work, authority/pause/cancel/task-expiry/release effects, populated takeover/release quarantine, missing and replaced active attempts, same-generation and new-generation stale success/throw, stable operation key, malformed/null runtime requests, immutable evidence tampering, final SQL authority/time denials, final-check expiry and real independent takeover, no blind unknown redispatch, no-adapter nonmutation, maintenance bypass rejection, and claim/result acknowledgement loss with no callable/compensating write.

Independent callback workers use fresh factory/services in both Node and Bun, while the parent remains alive inside its old adapter. Each child acquires after expiry, atomically quarantines, uses explicitly host-attested human reconciliation, readmits and enters a new attempt. Only then does the parent settle its original success or throw; the complete new row remains byte-equivalent. Fresh child result persistence succeeds once. Final shared-run PID observations (each equals the actual spawned worker PID):

| Parent runtime / PID | Child runtime / old callback | Child PID | Observation |
|---|---|---:|---|
| Node / 53790 | Node / success | 54307 | old callback zero writes; fresh effect/result 1 |
| Node / 53790 | Node / throw | 54380 | same |
| Node / 53790 | Bun / success | 54456 | same |
| Node / 53790 | Bun / throw | 54520 | same |
| Bun / 54730 | Node / success | 55217 | same |
| Bun / 54730 | Node / throw | 55240 | same |
| Bun / 54730 | Bun / success | 55283 | same |
| Bun / 54730 | Bun / throw | 55313 | same |

Additional actual synchronous Node/Bun children acquire at the acknowledged-claim boundary before the parent final check. Parent callable entries are zero; takeover quarantine commits atomically. These tests monkeypatch the SQLite COMMIT seam only in test processes; no await/barrier hook was inserted in the production check-to-call path. The unchanged P3/P4 suites also re-execute their four-runtime-pair ownership and authenticated actor collaboration cases. This is meaningful P5 regression evidence, not the complete independent P6/P7 proof campaign.

## Invariants demonstrated

- **OWN:** one captured acknowledged generation per host/raw handle, no observer adoption/recovery, owner eligibility before callable preparation, authoritative checked invocation boundary, populated acquire/release quarantine, old generations rejected before any callback write.
- **Attempt safety:** success and throw both reject missing/replaced attempts with exact raw-row nonmutation, including after reconciliation/readmission/new active attempt within the same generation. No task-ID-only uncertainty rewrite reaches a newer attempt.
- **STA/EFF:** claim/approval consumption/operation/sidecar/history are atomic; unacknowledged claims release zero callable entries; result commit errors are outside adapter catch and cause no compensating write. Expiry/release/takeover preserve unknown, not evidence of nonexecution or automatic retry.
- **Authority/lifecycle:** current run, task lease, dispatch-selected authority revision/grants/consumed approval remain checked inside SQL and at final dispatch. Unrelated global revisions do not poison valid work.
- **ACT continuity:** P4 command receipts/human approval feed actual fenced execution and filtered persisted result observation without exposing the admin/owner/store object to actors.
- **REP:** complete linked runtime reconstruction compares projections/evidence at each corresponding revision and invokes zero adapters; immutable sidecars cannot be retokened or reopened through admin writes.
- **Compatibility:** prior full 315, P3/P4 40, legacy shared 82 on each runtime, original safety 21 on each and both runtime verifiers remain green without changing previous tests or legacy exact records/context.

## Known limitations

Trusted single-machine shared wall clock (fixed 30,000 ms ownership lease), trusted host/channel enrollment/filesystem/SQLite/VFS assumptions remain. This is not hostile-host/OS-user isolation, multi-machine election, remote human authentication, secret storage, signed historical authentication, migration, compaction, backup/clone fencing or exactly-once delivery. A host with raw SQL/SDK/filesystem/adapter capabilities can bypass application boundaries; the actor JSON port does not sandbox such code.

Whole-envelope linked replay is synchronous, bounded and expensive; histories/receipts/renewals consume the existing budgets. A long synchronous plan can lose eligibility and reject. Explicit concurrency caps are supported, but no hidden retry/dead-letter/renewal timer, automatic reconciliation, downstream fence advancement or staged acknowledgement promotion exists. The facade intentionally omits the legacy convenience methods listed above. Observer close closes this factory handle, not a separately allocated observer connection. New construction must acquire a fresh generation and resupply services/sessions; it never resumes the observed credential.

The P5 downstream service is a deterministic test implementation, not a shipped network service or proof about an arbitrary adapter/provider. The check-to-effect race and delayed-old-request case remain inherent. Full P6 proof artifacts/public walkthrough, P7 adversarial/mutation matrix, later docs/final review and publication/legal/identity gates remain unperformed here.

## Blockers

**No implementation blocker to Pass 6 within the accepted bounded protocol.** Strong P5 factory/SQL/runtime/process regression gates pass. **Production promotion, publishing and a complete live-coordination proof gate remain BLOCKED on the authorized later passes.** No unimplemented placeholder dispatch route is enabled, and no result/denial branch bypasses the captured owner/attempt fence.

## Next pass: READY or BLOCKED

**READY — Pass 6 independent proof work only, under the parent's authorized sequence.** Exact handoff entry points are the root `createCoordinatedChord` export and `src/sdk/coordinated-chord.js` ports above; private pure transitions are `src/coordination/runtime.js`, shared regression suite `tests/coordinated-dispatch.test.js`, fresh-process worker `tests/coordinated-dispatch-worker.js`.

P6 should build its separately inspectable real-process proof with fresh host services/authentication and actual actor collaboration→human approval→fenced dispatch/result. Preserve the P3/P4/P5 suites unchanged, independently distinguish the elected owner, authenticated actor and downstream service roles, show no blind redispatch after ambiguous execution, and state the explicit downstream/clock/host boundaries. Retain final-check/callable-entry/effect-acceptance observables separately; a passed database check is not atomic remote revocation. P7 still owns the broader crash/ack/overflow/capacity/authority/lifecycle mutation campaign. No later pass or Block 053 action was performed here.
