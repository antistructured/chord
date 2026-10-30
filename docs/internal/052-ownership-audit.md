# Block 052 — Ownership and execution-boundary audit

## Pass

**Pass 1 only — audit complete. Next pass: READY for ownership/ingress/fencing design, not implementation or deployment.** No Block 052 ownership mechanism is implemented by this report. No later pass, Block 053, publication, staging, commit, push, tag, dependency installation or version change was performed.

Reviewed repository `/home/d/Workspace/other-projects/chord`, branch `base`, HEAD `08728e48772db14a247add9143669a8e0eab01fa`. The artifact is the protected dirty working tree, not HEAD alone. Entry: 31 tracked modified paths, 32 untracked files, nothing staged; SHA-256 inventory covers 531 files. Evidence root **`/home/d/.hermes/cache/scratch/chord-052-pass1`** (below, `S`). `entry-hashes.json` and `entry-status.txt` preserve this pass's baseline independently of the parent's `chord-052-entry` evidence. Scratch is regenerable and subject to pruning.

## Agent

**ownership-audit-agent.** Audit/report only. Historical 050/051 measurements are not substituted for the fresh commands below. Loaded the repository-documentation-verification skill. Read 050 final and all eight 051 reports; B2's statement that SDK integration is absent is historical and superseded by B3/B8. B8's single-active-runtime limitation is the current baseline, not permission to claim live coordination.

## Files inspected

Paths below are repository-relative; abbreviated `src/` and `tests/` are relative to `packages/core`. Function/member references are search locators, not HTML anchors.

- Prior contracts and gates: `docs/internal/050-final-report.md`; all `docs/internal/051-{storage-contract,storage-implementation,crash-recovery,authority-continuity,process-recovery-proof,durable-adversarial-tests,durability-guide,final-report}.md`; authentication/execution-boundary portions of `041-authority-design.md`.
- Owner/storage/startup: `src/registry/{owner,registry,snapshot}.js`, `src/runtime/storage/sqlite.js`, `src/storage/contract.js`, `src/runtime/recovery.js`, complete `src/sdk/chord.js` public member table and inner functions.
- Dispatch/authority: `src/platform/{runtime-loop,adapter-routing,attempts,authorization,approval-flow,handoff,reconciliation,task-queue,transitions,state-invariants,recovery-policy}.js`, `src/execution/{task-packets,results}.js`, `src/contracts/sigils.js`.
- Evidence/replay/exports: `src/platform/{event-journal,history,trace-reducer,journal-audit,index}.js`, `src/index.js`, package manifest; `src/runtime/adapter.js`, CLI runner and demo fake SMS adapter. Source-wide execution/owner/call-site search, complete Git dirty inventory and tracked kernel diffs.
- Baseline execution paths: original `docs/internal/046-state-probes.mjs`; five shared suites listed below and adversarial live-peer/attempt seams; `examples/process-recovery.mjs` and its generated summaries/process artifacts. Runtime verifier, original boundary probe, full-suite logs and shared-suite logs. An attempted `src/adapters/index.js` inventory lookup found no such file; actual adapter routing/execution is in the paths above, not an invented adapter directory.

### Dirty corrected kernel versus other protected work

| Entry category | Paths / provenance and disposition |
|---|---|
| 051 tracked kernel integration | `src/index.js` adds raw SQLite export (B2); `src/registry/owner.js` adds authoritative storage port/retirement (B3); `src/platform/transitions.js` adds leased quarantine and clears queue expiry (B3); `src/platform/approval-flow.js` uses supplied resume clock (B4). These are live corrected code, not disposable differences from HEAD. |
| Mixed 050/051 tracked kernel | `src/sdk/chord.js`: 050 grant/approval helpers plus 051 storage lifecycle/fresh reads/recovery/clock/close; `src/platform/runtime-loop.js`: 050 response codes plus 051 separation of invocation errors from result persistence. Preserve both layers. |
| 050 tracked kernel | `src/platform/journal-audit.js` explicit audit time. Timestamp-sorted display replay remains distinct from canonical trace reduction. |
| 051 untracked implementation | `src/runtime/recovery.js`, `src/runtime/storage/sqlite.js`, `src/storage/contract.js`; five shared suites, three workers, restart example and eight 051 reports. Untracked does not mean expendable. |
| Other protected prior work | 050 tests/reports; root/package READMEs, examples, manifest/lock, identity/license/changelog/integrity/notices changes, `.gitignore`, older 040/041/044–049 reports, root `049-final-report.md` and `release-notes-and-limitations.md`. Some documentation/allowlist changes are 051; other older changes are not ownership implementation. Exact path inventory is `S/entry-status.txt`; no ownership-pass provenance is assigned to them. |

The sole dependency is still `@weipertda/sigiljs: 0.18.0`; source is JavaScript ESM. No source, test, dependency, lock, manifest or version edit is made here.

## Files changed

Created only **`docs/internal/052-ownership-audit.md`**. Scratch contains the baseline runner, full command logs, JSON command/exit records, entry hashes and real SQLite/process proof evidence. Every pre-existing entry file remained byte-identical after tests; final preservation verification is retained as `S/preservation.json`. No unrelated cleanup, reset, clean, stash, overwrite or staging.

## Implementation decisions

**No implementation choices were installed.** The following are observed constraints and explicit questions/recommendations for Pass 2.

### 1. Atomic storage exists; atomic execution ownership does not

`sqlite.js#transaction` obtains **BEGIN IMMEDIATE**, then `compareAndCommit` reads/decodes the current row, compares expected revision, validates the candidate, updates, and acknowledges only after COMMIT. UPDATE additionally uses `WHERE singleton=1 AND revision=?` and requires one changed row. Whole state, ordered journal, embedded results/reconciliations, commit identity and logical floor are one atomic row. The owner callback/draft construction happens **before** this SQL transaction; it runs once and is never automatically retried. The authoritative validation and CAS happen inside SQL.

Physical layout: one `chord_store` row, `singleton=1`, columns `storage_version`, `schema_version`, `run_id`, `revision`, `logical_now`, `commit_id`, `registry_json`. Format is `chord.local-store.v1`; contracts/history remain `chord.contracts.v1` / `chord.history.v1`, snapshots `0.3.0`. WAL/FULL and 1000 ms busy wait are checked. Exact layout checking rejects additional/changed schema; no migration exists.

There is **no execution-owner ID, owner principal, ownership lease, epoch/fencing allocator, acquire/renew/release/transfer API, owner predicate on UPDATE, or persistent owner-loss state**. SQLite's writer lock ends at COMMIT; it is not a process-lifetime scheduler lock. `createStateOwner` is a private state-management closure, not proof of elected execution ownership. Task leases and authority revisions are not fencing tokens. `stableId` attempt/event IDs are not monotone ownership generations.

**Run/database identity:** one local regular absolute path is host-provisioned; create uses exclusive file creation and never replaces an initialized run. Open validates exact layout and self-consistent row/registry/history identity. `validateNext` binds a write to the current run ID/schema. There is no separately supplied expected-run identity on existing open and no independent database incarnation token. File path is not authentication; aliases, copying/replacing files and rollback to backups need a clear host obligation/identity policy. Do not claim tokens remain globally monotone across arbitrary database restore/clone.

**Pass 2:** specify one authoritative ownership record and atomic compare predicates with the registry/evidence transition, a non-reused monotone generation, safe-integer overflow rejection, database/run binding and explicit compatibility/version behavior. Built-in SQLite already supplies the necessary local transaction primitive; no observed dependency blocker justifies another library. Decide whether ownership lives inside canonical registry/replay or separately; if separate, define how its evidence and domain changes are atomically linked. Do not silently adopt a changed schema under v1 or silently migrate old databases. Decide whether raw-store administration is exempt (trusted maintenance only) or also requires ownership; it cannot accidentally become an actor bypass.

### 2. Authoritative reads are fresh, but freshness is not owner exclusion

`owner.js#read` reloads and validates every durable read, observing the persisted floor; no competing durable registry cache exists. SDK `registry` is bound only to a transaction-local draft, restored in `finally`; helpers/inspection/exports use owner reads. Router/policy and captured adapter callable are intentionally process-local host configuration. Local owner `busy` rejects reentrancy/async callbacks, not other processes. `closed` retires on unknown/unavailable/corrupt storage or explicit close. A stale revision does **not** permanently retire the owner. An old process can read a newer revision and submit a new mutation or cycle; no revoked owner credential is remembered or checked.

The current result guard conservatively requires exact dispatch revision, active attempt, authority revision and current policy. It protects an old completion from being accepted after intervening state changes, but does not establish owner loss or prevent later work by that same process. Rejected runtime outcomes may still commit `commit_rejected`/ignored/uncertainty evidence with a fresh revision. Under the stronger OWN-02 rule, stale-owner rejection must occur before **any** write, including these diagnostics and error paths.

**Additional source-observed stale-outcome hazard to carry forward:** the adapter-error branch checks a different active attempt before calling `markTaskUncertain`, but the success/result branch combines mismatched/missing active attempt with other denials and then calls `markTaskUncertain` on the task ID. If an old live adapter returns after recovery, evidence-backed readmission and a newer attempt starts, that branch could quarantine/clear the newer attempt rather than reject the old outcome without writes. The existing B6 stale-result test uses private `ingestExecutionResult`, which independently rejects mismatched correlation; it is not coverage of this older outstanding public-runtime promise. This sequence was not newly executed here and is not claimed as a reproduced supported-051 defect (live-peer recovery is unsupported). It is an explicit high-impact Pass 2/5/7 design and regression obligation under the new ownership scope.

**Pass 2:** define the owner credential captured by each process/attempt and the authoritative comparison at every mutation; never refresh a lost credential merely by reloading state. Define sticky fail-closed behavior and renewal failure/unknown outcomes. Specify whether read-only observers can open while an owner is active without recovery or ownership acquisition. Reject an old generation/attempt before either success-path or error-path uncertainty handling can touch a newer task attempt.

### 3. Startup is currently unsafe with a live peer

`createChord` opens/validates storage, creates its private owner, then calls `recoverOwner` **before router construction**. Recovery scans `running`/`leased` tasks and commits `restart_recovery` at the observed run revision. It does not check task lease expiry, old PID death or ownership; all interrupted work is conservatively uncertain/operation unknown. Completed results and queued approval reservations survive; active/pending records of quarantined work are cleared. No adapters are resolved or invoked.

B6's freshly rerun live-peer characterization deliberately leaves the first process alive inside its adapter, opens/recover-quarantines in another process, then releases the first. Its effect already happened; its completion is rejected. This confirms absent exclusion, not safe takeover. Competing recovery candidates have one CAS winner, but that alone does not license ongoing concurrent schedulers.

**Pass 2:** acquire/validate exclusive ownership before any recovery sweep or usable scheduler exposure; an unexpired valid peer must not be quarantined. Define explicit transfer/release/expiry behavior, crash-after-acquire recovery, current owner reopens, observer opens and legacy sequential recovery compatibility. Expired ownership/task lease must never be interpreted as proof the effect failed or permission for blind readmission.

### 4. Complete mutation and protected-dispatch inventory

| Boundary | Live methods and required Pass 2 coverage |
|---|---|
| Canonical SDK mutations through `mutate` → `owner.transact` | `registerSpec`, `registerSpecAndQueue`, `queueTaskPackets`, `setAuthoritySnapshot`, `prepareAttempt`, `cancelTask`, `proposeHandoff`, `respondToHandoff`, `pauseForApproval`, `resumeRun`, `rejectApproval`, `cancelRun`, `reconcileTask`, `replayTask`, `_invalidatePendingAttempt`; constructor authority installation also uses this path. Fence every applicable authoritative write, not only task claim. |
| Privileged alternate install | `commitRun` → `owner.install` → store CAS; validated but host-powerful, including authority replacement that need not obey the dedicated setter's exact-next authority rule. Do not infer actor permission from JSON validity. |
| Runtime | `runCycle` → public `runRuntimeCycle` → owner port: `runtime_claim`, then invocation, then `runtime_result` or `runtime_uncertain`. No-adapter retry, denied/deferred/skipped diagnostic commits also traverse claim. All need appropriate ownership handling, including no-work/denial paths. |
| Recovery | Durable constructor → `recoverOwner` → `restart_recovery`; snapshot `importRegistry` uses independent memory `import_quarantine`, not durable takeover. |
| Actual protected effect | `runtime-loop.js` resolves exact/prefix/default/fallback route, prepares attempt, recomputes authority, marks operation dispatched, consumes exact approval, leases task, activates attempt and records dispatch. `prepareTaskExecution` captures `adapter.execute` and freezes validated packet/context while owner is busy. After acknowledged claim it immediately calls captured `invoke`; actual callable entry is `Reflect.apply(execute, adapter, [packet, frozenContext])`. All route kinds converge here; task kinds intent/handoff converge here. |
| Low-level / direct host bypasses | Exported `runRuntimeCycle` also accepts caller-owned plain registry, creating an independent memory owner, or a host-supplied port. Internal `executeTask` directly calls `prepareTaskExecution(...)()` without governance. Raw `openSqliteStore` exposes init/CAS; low-level queue/result/registry helpers mutate caller data. Demo SMS direct `.execute` calls bypass governed runtime intentionally. These are host-code/simulation APIs, not actor ports or proof of fenced external effects. Pass 2 must explicitly scope or separate them rather than claim every arbitrary host call is fenced. |
| Other host I/O/configuration | `runtime/adapter.js#readText/writeText` are generic file I/O, not task dispatch; router/policy setters change local configuration, not canonical authority, and do not reopen a retired owner. CLI runner calls private SDK `runCycle`, no actor server. |

Current adapter context has only run/schema/task/content revision/queue/attempt/lease-expiry correlation; **no owner generation or idempotency key**. The final claim-to-call path contains no await/new host-property lookup, but another OS process can change durable state between COMMIT and actual callable entry. There is **no final ownership check** today. Even a future check leaves a check-to-remote-effect race: downstream fencing and/or idempotency enforcement remains necessary. Never claim exactly-once from synchronous JavaScript adjacency or a database lease.

**Pass 2:** define final authoritative pre-invocation validation, dispatch credential/context propagation and behavior after failed/lost ownership. Bind result and uncertainty writes to the dispatched owner generation, not just a fresh read/current run revision. Keep storage/result persistence errors outside adapter catch; no compensating write on unknown commit. Specify adapter opt-in remote token semantics and expose the residual race honestly.

### 5. Execution owner is not an actor and grants no inherited host power

There is **no production authenticated actor network/IPC endpoint or restricted actor-client facade** in this checkout. Supported actor-facing data seams are specs/packets, `projectContext` output, handoff data, and adapter result input. SDK administrative references remain host-only. `queueTaskPackets` derives stored binding from trusted host options; `issueGrants` is a host callback. `evaluateAuthority` checks run/schema, principal window, actor-to-principal binding/revocation, capability, exact scope, deny/allow, approval and dispatch-selected commit authority. Role names, route target, actor kind and spec authority prose confer nothing. Runtime normalizes exact AdapterResult then stamps correlation; arbitrary administrative result fields do not invoke SDK methods.

`projectContext` filters data by supplied IDs/current authority but does not authenticate those IDs. SDK overrides requested projection time with host time. `proposeHandoff` and `respondToHandoff` are **trusted-host** operations: they CAS state, with response checking target actor/action/expiry, but do not authenticate a caller or re-evaluate a dedicated handoff grant. Expected revision is optional in their contracts. Proposal has no independently authenticated sender. They cannot be republished as actor ingress unchanged. Resume/reconciliation check declarative human records; persisted principal records still are not sessions. Fresh host authentication remains an embedding obligation demonstrated by the restart example's private, newly attested session map.

**Pass 2:** define separate execution-owner port, host-admin port and allowlisted actor-client port. Authenticate out of band, derive run/principal/actor from that context, reject request-authored authority/owner credentials and bind requests to expected revisions. Define authorized durable revision-checked handoff semantics for both parties, including expiry clock and stale/foreign/replay rejection, before exposing it. Ownership authorizes scheduling/writing only within its contract: it does not mint grants, elevate roles, install policy, authenticate humans or give actors admin handles. Do not expose a generic method-name dispatcher, raw store, SDK, authority installer, callbacks or filesystem path selection. Host-supplied malicious code/SDK/database possession remains outside an actor-data sandbox claim.

### 6. Evidence, replay and duplicate protection

`owner.capture` closes each state change with computed canonical delta and diagnostic IDs; storage validates full reducer equality, prefix, exact next revision and legal transitions. `trace-reducer.js#reduceTrace` preserves immutable array order and validates history linkage; new ownership fields/events need corresponding contract/reducer/transition rules. `replayNoSideEffects` invokes zero effects. `journal-audit.js#replayRegistryJournal` is a timestamp-sorted display, **not** canonical reconstruction or an ownership oracle; raw `readHistory` uses dense array ordinals.

Duplicate task IDs, correlated attempts/results and operation signatures prevent supported repeat admissions/commits; unknown operations require explicit evidence-backed reconciliation then fresh readmission. These are not remote-service deduplication guarantees. Current schema is exact and rejects new fields, so fencing data cannot merely be attached to existing packets/attempts/outcomes without an explicit compatibility decision.

**Pass 2 proof requirements:** independent simultaneous contenders and one valid owner; stale renew/release/transfer/write/dispatch/result (including adapter-error diagnostics) after takeover; owner ID reuse and generation overflow; pauses, approvals, revocations and handoff across distinct processes; acquire/claim/result acknowledgement-loss windows; expiry with a still-live old adapter and zero blind redispatch; tied/backward clocks; canonical replay matches state/ownership evidence; all four Node/Bun writer/reader pairs. Distinguish database acceptance, actual callable entry and remote effect acceptance. Retain 051 crash/uncertainty safety tests rather than weakening them to force takeover.

## Tests executed

Fresh execution, not prior totals. `N=/home/d/.volta/tools/image/node/24.22.1/bin/node`, resolved by `node -p process.execPath`; `B=/home/d/.bun/bin/bun`; `S=/home/d/.hermes/cache/scratch/chord-052-pass1`. Exact expanded argv/cwd/exit and full logs: `S/commands.json`, `S/extra-commands.json`; reproducible baseline runner `S/run-baseline.py`. Variables below are exact substitutions, not guessed launchers. Package cwd is `/home/d/Workspace/other-projects/chord/packages/core`; root is its repository root.

| Exact command (with substitutions above) | Cwd | Exit | Observed result |
|---|---|---:|---|
| `$N --version`; `$B --version` | package | 0 each | v24.22.1; 1.4.3 |
| `$B test` | package | 0 | **275 pass, 0 fail, 1635 expect calls, 21 files** |
| `$N --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | package | 0 | **82 pass, 0 fail**, zero skipped/cancelled/todo |
| `$B test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | package | 0 | **82 pass, 0 fail, 5 files** |
| `$N --test docs/internal/046-state-probes.mjs` | root | 0 | **21 pass, 0 fail**, zero skipped/cancelled/todo |
| `$B test ./docs/internal/046-state-probes.mjs` | root | 0 | **21 pass, 0 fail** |
| `$N src/verify-runtime.js`; `$B src/verify-runtime.js` | package | 0 each | ALL RUNTIME VALIDATIONS PASSED! |
| `$N /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs`; `$B /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs` | root | 0 each | 3 injected actor fields rejected; recursive data only; forged result rejected; canonical authority unchanged; unknown redispatch rejected; adapter calls 1; allowDecisionFrozen false |
| `$N examples/process-recovery.mjs $S/proof-node-node $N` | package | 0 | B5 PASS, both scenarios |
| `$B examples/process-recovery.mjs $S/proof-bun-bun $B` | package | 0 | B5 PASS, both scenarios |
| `$N examples/process-recovery.mjs $S/proof-node-bun $B` | package | 0 | B5 PASS, both scenarios |
| `$B examples/process-recovery.mjs $S/proof-bun-node $N` | package | 0 | B5 PASS, both scenarios |
| `git diff --check` | root | 2 | Only pre-existing whitespace: root `049-final-report.md:7,99`, `release-notes-and-limitations.md:4` |
| Python SHA-256/byte comparison of safety file against `git show 1efafd1:docs/internal/046-state-probes.mjs` | root | 0 | Byte-identical original; SHA-256 `95b72cd7189bb2d54685bdd3f08561ef0740f3e8399bbc04cb10a269228248eb` |
| Python entry-hash, report heading/whitespace and new-file-scope verification | root | 0 | All 531 entry files preserved; only this report added |

The full suite imports bun:test; no full-suite Node compatibility claim. Shared Node strict assertions are not counted in Bun's expect total. Overlapping runs are not summed as unique coverage. B6 source mutations were not rerun and no new mutation score is claimed.

## Observed results

All behavioral baseline commands exited zero. No product source correction was needed or permitted. Read-back proof summaries are aggregated in `S/proof-readback.json`; each root retains SQLite, full registry evidence, effect ledger and process metadata.

| Pair | Approval writer → reader PID | SIGKILL writer → recovery PID |
|---|---|---|
| Node → Node | 181903 → 181951 | 182079 → 182151 |
| Bun → Bun | 182233 → 182275 | 182392 → 182451 |
| Node → Bun | 182521 → 182558 | 182627 → 182642 |
| Bun → Node | 182719 → 182747 | 182844 → 182887 |

All four report `B5 PASS`. Each approval case has one continuation invocation, three rejected unauthenticated/stale sessions, 28 events and journalMatches true. Each ambiguous case reports first signal SIGKILL, zero recovery invocations, 20 events and journalMatches true. Every scenario preserves one previously committed effect and reports zero ambiguous redispatches. These are real independent-process restart proofs, not live ownership/fencing proofs. Fresh shared/full tests also re-executed B6's explicit unsupported-live-peer characterization.

## Invariants demonstrated

- **STA / OWN-04 foundation:** current whole-row revision CAS atomically couples canonical state/history/evidence and rejects stale candidates; not yet an ownership transition protocol.
- **EFF / OWN-05 foundation:** lease/ack ambiguity does not prove effect failure; recovered work is uncertain/unknown, no blind redispatch. Existing duplicate/result attempt protections remain green.
- **REC:** actual fresh process reopens storage, resupplies services and freshly attests host ingress; persisted principal/approval policy is not login. Recovery is effect-free.
- **REP:** canonical reducer/store equality remains passing across restart and fault tests; display timestamp sorting is not used to reconstruct committed truth.
- **ACT-01/02 existing bounded data path:** role/spec/result data gains no administrative capability; run/principal/actor/scope checks are exercised. This is not a newly authenticated actor endpoint.
- **OWN-01/02/03/06/07 and ACT-03 for the proposed multi-process scope are NOT demonstrated.** There is no elected owner, ownership rejection, final owner dispatch check, monotone fencing generation or authenticated actor handoff ingress. Current stale-attempt rejection is narrower than stale-owner exclusion. Audit completeness is the gate, not satisfaction of future implementation invariants.

## Known limitations

Single-active-runtime/exclusive sequential restart remains mandatory today. A refreshed old process is not fenced. A live old effect cannot be undone by rejecting its result. Final local ownership check cannot atomically constrain an independent remote service; downstream fencing/idempotency remains necessary, and **no exactly-once external-effect guarantee** is made.

Local Linux Node/Bun versions only; local SQLite/OS/filesystem/device sync assumptions, no network-filesystem or hardware power-loss proof. Full-state/history synchronous O(state/history) work, 1000 ms writer wait, 1 MiB/16384-node/1024-array budgets persist. No migration, compaction, secret scrubber, encryption, cryptographic tamper guarantee, login service or hostile-host sandbox. Publication/distribution identity/legal/artifact gates remain separate and unresolved. Scratch artifacts are not release attestations.

## Blockers

**None to Pass 2 design.** All relevant ownership/state-mutation/recovery/dispatch/actor-data/evidence paths identified and baseline independently green. **Live multi-process operation is still blocked** until Pass 2 resolves the explicit ownership schema/compatibility, clock/lease, acquisition/recovery, stale-write/dispatch, ingress authorization and residual remote-effect semantics above, followed by implementation and independent proofs. Existing nonblocking whitespace is preserved.

## Next pass: READY or BLOCKED

**READY — Pass 2 design only.** Input: this report and preserved 050/051 working tree. Require explicit decisions for (1) authoritative owner/generation identity and monotonicity scope, (2) atomic acquire/renew/release/transfer with revision/evidence, (3) ownership before recovery and observer-open semantics, (4) complete write/result/error fencing and final dispatch check, (5) separate authenticated actor-client ingress/handoff without inherited host powers, (6) storage/contract/history compatibility, (7) independent-process test matrix and honest downstream race contract. No Pass 2 or later work is performed here; no publication or Block 053 authorization is inferred.
