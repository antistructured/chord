# Block 052 — Independent adversarial concurrency tests

## Pass

**Pass 7 only — RELEASECRITICAL bounded local-protocol gate: PASS. Next pass: READY for separately authorized Pass 8.** This is not a publication, universal stale-effect exclusion, or exactly-once gate. No Pass 8/9, Block 053, staging, commit, push, tag, version/dependency/manifest change or publication was performed.

Repository `/home/d/Workspace/other-projects/chord`; protected dirty base HEAD `08728e48772db14a247add9143669a8e0eab01fa`. All **661 entry files** remain byte-identical. Nothing was removed. Only the three files listed below were added. The hash inventory includes the live dirty artifact, not just HEAD.

## Agent

**adversarial-agent.** Independently inspected the installed protocol and actual code paths; preceding reports were inputs, not test evidence. Loaded `owner-cas-mutation-testing`; recorded two reusable lessons there outside the repository (direct reducer probes for masked identity guards; unexpired consumed-approval transfer fixtures).

## Files inspected

Abbreviated `src/`, `tests/`, `examples/` below are relative to `packages/core`.

- `docs/internal/052-{ownership-audit,coordination-protocol,fencing-implementation,actor-ingress,dispatch-takeover-safety,process-coordination-proof}.md`; especially normative protocol §§3–12 and accepted implementation clarifications. Legacy 051 suites were read through their executed test names/results, not assumed from historical counts.
- Complete new `src/coordination/{contracts,state,history,command-authorization,commands,runtime}.js`, `src/runtime/storage/coordinated-sqlite.js`, `src/registry/coordinated-owner.js`, `src/sdk/coordinated-chord.js`, `src/runtime/actor-ingress.js`, `src/execution/task-packets.js`; root exports and package manifest. Traced ownership checks, claim/attempt installation, final check, captured callable, success/error result persistence, receipts/current visibility, and full linked replay.
- Existing `tests/{coordinated-storage,actor-ingress,coordinated-dispatch}.test.js`, owner/storage/dispatch/actor workers, actor fixture; public two-process example/test and retained actual proof artifacts. Original full, 051 shared, safety, verifier and example logs.

## Files changed

Created only:

1. `packages/core/tests/coordinated-adversarial.test.js` — **7 shared tests**, including four runtime-pair tests containing sixteen actual SIGKILL/restart scenarios, a post-final-check independent takeover race, independent pure outcome guard coverage, and unexpired consumed-approval generation transfer.
2. `packages/core/tests/coordinated-adversarial-worker.js` — fresh owner/restorer processes and precise test-only interruption seams. No production hooks.
3. `docs/internal/052-concurrency-tests.md` — this report.

**No product source fix was necessary or installed.** No prior test, report, fixture, example, source, lockfile or manifest was edited. All mutation writes were in fresh scratch copies. No authority assertion was weakened.

Scratch root **`S=/home/d/.hermes/cache/scratch/chord-052-pass7`** retains `entry-hashes.json` (also original `../052-p7-entry-hashes.json`), `preservation.json`, `verify.py`, `run-gates.py`, `mutate.py`, `mutate-pure.py`, `mutations.json`, `callback-pure.json`, isolated `mut-*` trees and full control/mutation logs. Final gate logs and CLI artifacts are in **`S/final`**, with expanded `commands.json` and `last-commands.json`. Earlier iteration logs are not substituted for the final results. Scratch is regenerable and subject to pruning; tests remove their temporary databases after assertions, while public CLI proof databases/artifacts are retained.

## Implementation decisions

### Independent inspection conclusions

- Every exposed coordinated canonical write reaches one store transaction. `BEGIN IMMEDIATE` precedes the authoritative read and clock sample. Non-acquire mutations check the original owner identity before revision/payload processing; final time/authority checks precede the atomic row update. Captured raw-handle credentials cannot be adopted by reopening/reading. Separate observer and actor reads do not recover or acquire.
- Claim state, approval consumption, operation, active attempt, immutable dispatch sidecar and linked histories are committed together. Final dispatch reloads the row, validates ownership/attempt/lifecycle/authority and then enters the previously captured callable. Result persistence is outside adapter catch, so an unknown result commit cannot trigger a compensating uncertainty commit.
- Stale-generation outcomes fail ownership first. Same-generation outcomes fail exact active-attempt identity before constructing uncertainty. Later full replay/cross-invariants provide additional protection, but are not an excuse to omit the early pure guard.
- Actor JSON has no SDK/admin dispatch route. Host enrollment is trusted out-of-band input. Every duplicate is freshly authenticated and currently authorized; receipts are historical responses, not current ownership credentials. Replay reconstructs persisted authorization transitions, not historical external login proofs.
- Trusted host admin/raw SQL/filesystem/adapter code remains privileged. Deliberate host misuse is not an actor-data exploit. No local canonical bypass was reproduced within the accepted supported interface/threat model.

### Actual kill seams, not event-loop-only simulation

Each of Node→Node, Node→Bun, Bun→Node and Bun→Bun runs all four seams. A new owner acquires generation 2 at shared logical time 101, **actually renews at 102**, then stops at the selected boundary. Parent asserts reported PID equals spawned PID, reads raw durable row while child remains alive, sends **SIGKILL**, waits for `{code:null,signal:'SIGKILL'}`, and verifies the complete row is unchanged by death. A separately spawned fresh process at exact renewal expiry 30102 acquires generation 3, reconstructs and executes only eligible queued work. These are trusted shared logical clock tests, not independent clock synchronization or real-time 30-second sleeps.

| Seam | Exact interruption | Before kill | Fresh generation-3 behavior |
|---|---|---|---|
| `renew` | After acknowledged renewal, before any claim | queued; zero callable entries/effect file | queued work remains eligible; one effect/result, not an uncertainty retry |
| `intent` | Test intercepts `Reflect.apply` only for captured adapter; after final DB check, before forwarding | durable running/dispatched intent; **zero actual callable entries**, no effect file | uncertain/unknown; zero adapter calls and no blind dispatch |
| `effect` | Actual adapter entered, wrote real effect file, has not returned | one actual file effect; running/dispatched | uncertain/unknown; zero recovery calls; original effect preserved once |
| `result` | Adapter returned; actual result COMMIT completed; wrapper blocked before returning acknowledgement to owner | completed result and sidecar durable; one file effect | completed preserved; zero adapter calls; no uncertainty compensation |

Each restorer compares full replay with final envelope; parent independently compares raw reopened JSON. Final lease generation is 3 in every scenario. Explicit timeout exceeds Bun's default. IPC barriers/Atomics blocking are confined to worker code. The `result` seam is a genuinely completed SQLite COMMIT before acknowledgement, not merely a returned adapter value. The `intent` seam is before actual callable entry, not an adapter-entry crash mislabeled pre-invocation. This is process-death testing, not device power-loss testing.

### Meaningful added gaps and fault isolation

Existing P3–P6 tests already cover most required matrix cells and were rerun unchanged. New coverage is not a renamed copy: v2 real killed/renewed owner restoration at four distinct boundaries; OS takeover *after* final check; pure reducer identity enforcement independent of storage/replay masking; and consumed approval transfer while **still unexpired and unrevoked**. The latter uses graceful release/fresh acquisition at time 101 so expiry cannot mask exact consumed-attempt protection. New attempt dispatch rejects `APPROVAL_REQUIRED`, with the original approval and complete row unchanged. Old callback then rejects `OWNER_LOST` without writes.

No fail-before/fix-after product claim is made: the unmodified product passed the new regressions. Mutation failure/restoration is separately measured below.

## Tests executed

Actual runtimes: `N=/home/d/.volta/tools/image/node/24.22.1/bin/node` (**v24.22.1**), `B=/home/d/.bun/bin/bun` (**1.4.3**). Package cwd `/home/d/Workspace/other-projects/chord/packages/core`; safety/git cwd repository root. Exact expanded argv/cwd/exits and complete logs are retained, not reconstructed from this table.

| Command | Exit | Observed final evidence |
|---|---:|---|
| `$N --test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js` | 0 | **81 pass**, 0 fail/skipped/cancelled/todo |
| `$B test` with the same five explicit paths | 0 | **81 pass**, 0 fail |
| `$N --test tests/coordinated-adversarial.test.js`; `$B test tests/coordinated-adversarial.test.js` | 0 each | **7 pass each** on final test content, including unexpired transfer refinement; `*-p7-final.log` |
| `$N --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | **82 pass**, 0 fail/skipped/cancelled/todo; original 051 four recovery runtime pairs |
| `$B test` with those same five 051 paths | 0 | **82 pass**, 0 fail |
| `$N --test ./docs/internal/046-state-probes.mjs`; `$B test ./docs/internal/046-state-probes.mjs` | 0 each | Original safety **21 pass each**, 0 fail |
| `$N src/verify-runtime.js`; `$B src/verify-runtime.js` | 0 each | `ALL RUNTIME VALIDATIONS PASSED!` |
| `$N examples/quickstart.mjs`; `$B examples/quickstart.mjs` | 0 each | actual example execution |
| `$N examples/cross-actor-workflow.mjs`; `$B examples/cross-actor-workflow.mjs` | 0 each | actual handoff/approval/effect/replay example execution |
| `$B test` | 0 | **356 pass**, 0 fail, **26 files** on final content; `full-bun-final.log` |
| `$N examples/two-process-coordination.mjs $S/final/proof-node-node $N $N` | 0 | owner/actor/standby PIDs 117570/117577/117584 |
| `$N examples/two-process-coordination.mjs $S/final/proof-node-bun $N $B` | 0 | PIDs 117697/117704/117725 |
| `$B examples/two-process-coordination.mjs $S/final/proof-bun-node $B $N` | 0 | PIDs 117857/117885/117892 |
| `$B examples/two-process-coordination.mjs $S/final/proof-bun-bun $B $B` | 0 | PIDs 117982/118010/118031 |
| `python3 $S/verify.py` | 0 | entry hashes unchanged, parsed exact test totals, raw artifact/replay/reopen equality, empty staged diff |
| `git diff --cached --stat` | 0 | empty |
| `git diff --check` | 2 | only protected pre-existing whitespace: `049-final-report.md:7,99`, `release-notes-and-limitations.md:4` |

The five-suite 81 count is unchanged P3/P4/P5 **70**, P6 **4**, new P7 **7**; the full count includes all original 349 plus 7. Overlapping commands are **not summed as unique tests**. Historical tests depend on `bun:test`, so no full-suite Node compatibility claim is made. Both the refined seven-test suite and full Bun suite were rerun after the last test edit. Unchanged old suites were already measured on both runtimes.

Each public CLI proof again yields revision **14**, **6** command receipts, **2** attempts/effects/results, simultaneous independent owner/actor/standby, denied standby acquisition/dispatch, and full combined replay/raw independent reopen equality. `verify.py` parses each retained CLI log and exact `final.json`, `replay.json`, `reopened.json` rather than trusting reported booleans alone.

## Observed results

### Isolated mutation campaign

All probes copy the live package into scratch and link its unchanged installed dependencies. Tests, imports and fixture routing are otherwise unchanged. `mutations.json` stores exact replacement strings, commands, control/mutant exits and failing names. **All eight initial controls exited 0.** There were no syntax/import-error kills.

Command shape: `$N --test --test-name-pattern '<pattern>' tests/<suite>.test.js`, cwd `S/mut-<label>`. The supplementary pure guard probe also explicitly restores the original production source in its isolated copy and reruns the same command.

| Probe / exact mutation intent | Pattern / suite | Control → mutant | Interpretation |
|---|---|---|---|
| `owner-early`: remove `assertOwner`'s owner-ID/generation equality | `expiry takeover fences` / coordinated-storage | 0 → **1** | Behavioral assertion failure: wrong owner precedence despite later captured-token/CAS defenses; stale invalid payload never becomes authoritative |
| `final-dispatch`: remove `port.guarded(() => port.checkDispatch(credential,dispatch))` | `actual process takeover between claim` / coordinated-dispatch | 0 → **1** | Both real Node/Bun takeover cases fail: callable incorrectly entered, expected zero |
| `callback-store-only`: remove store's pre-revision runtime-outcome `assertAttempt` | `same owner generation: reconcile` / coordinated-dispatch | 0 → 0 | Redundant for this supported current-revision path; reducer still rejects |
| `callback-reducer-only`: replace outcome reducer's `const {d}=assertAttempt(...)` with `DispatchRecord.assert(...)` | same pattern/suite | 0 → 0 | Store's early guard masks missing pure guarantee |
| `callback-both`: combine those two omissions | same pattern/suite | 0 → 0 | Later dispatch/cross-invariant/replay guards still reject before SQL update with stale code; **not** proof early guard is unnecessary |
| `receipt-auth`: remove duplicate's `assertReceiptVisible(...)` | `duplicate reauthorization rejects revoked` / actor-ingress | 0 → **1** | Revoked work grant wrongly permits historical receipt access |
| `replay-final`: remove final coordination-projection equality, retain domain equality | `combined replay rejects forged response` / actor-ingress | 0 → **1** | A detached forged receipt projection becomes accepted |
| `sql-owner-predicate`: remove generation/owner/lease WHERE predicates and matching bind arguments, retain revision/identity and semantic checks | `expiry takeover fences` / coordinated-storage | 0 → 0 | Observationally redundant under trusted SQLite `BEGIN IMMEDIATE` plus authoritative read and semantic fence; **not permission to remove normative independent SQL predicates** |
| Supplementary `callback-pure`: remove reducer identity check as above | `pure outcome candidate` / coordinated-adversarial | **0 → 1 → 0 restored** | Direct candidate contract killed: **both success and error produced `ACCEPTED` instead of `STALE_ATTEMPT`**; new regression closes guard-isolation gap |

The supplementary probe's complete diff/output is `callback-pure.json` and `callback-pure-{control,mutation,restored}.log`; it evaluates both branches before the assertion, so a first success failure cannot hide an untested error path. Integrated survivors are classified as defense-in-depth/transaction equivalence for the exercised states, not counted as killed mutants or silently waved through as full equivalence under arbitrary fault models. SQL predicate-change rollback, real lock contention, before/after actual COMMIT acknowledgement loss and failed rollback are separately exercised by existing unchanged tests.

### Full required invariant/coverage matrix

Pointers are stable test names plus current source line ranges, not historical counts. `CS=tests/coordinated-storage.test.js`, `AI=tests/actor-ingress.test.js`, `CD=tests/coordinated-dispatch.test.js`, `CA=tests/coordinated-adversarial.test.js`, `TP=tests/two-process-coordination.test.js`. All were actually rerun on both runtimes; TP/CS/AI/CD themselves exercise independently spawned Node/Bun peers.

| Requirement / protocol IDs | Exact coverage pointers | Observable / result |
|---|---|---|
| Concurrent acquisition; OWN-01/04, O1 | CS `independent simultaneous process acquisitions…` lines 298–317; live owner four pairs 259–284 | exactly one acknowledged generation and one held rejection; independent alive processes, no losing effect |
| Expiry/takeover, generation monotonicity; O4/O5/C1 | CS 53–100, 259–284; CD old callback/live workers 88–103,149–174; CA kill matrix | same owner UUID cannot reuse generation; expiry equality fences old owner; quarantine and unknown, not nonexecution |
| Stale renew/canonical commit, O2 | CS `expiry takeover fences…` 68–82 and live old peer 272–279 | renew/release/admin/actor/runtime claim/outcome malformed stale writes reject OWNER_LOST before validation/revision; exact row unchanged |
| Old adapter success **and** throw after takeover, O6 | CD 88–109,149–163,233–238; CA pure candidate test | fresh attempt and all new state byte-identical after old completion; same-generation missing/replaced attempt also zero-write |
| Ownership changes before callable, O3 | CD 124–129,164–180, route/kind matrix 182–192 | real independent takeover after claim/before final check: zero actual entries; expiry/final authority deny also zero-write/no-call |
| Ownership changes during effect; residual check-to-call, O3/O4/EFF | CD 199–213; CA `actual takeover AFTER final check…` | delayed service fencing/dedupe plus actual OS takeover before forwarding; uncooperating adapter **does enter once after takeover**, but cannot commit; exact newer row unchanged |
| Duplicate commands/mismatch/ack loss; E1 | AI 32–51,140–171,211–225; TP four pairs | historical exact receipt after intervening commits and generation transfer; auth/current visibility mandatory; changed envelope mismatch; before/after COMMIT differentiated |
| Conflicting actor updates; S1/A1 | AI `actual concurrently alive actor children…` 251–279 | two distinct alive children same expected revision: one accepted/one STALE_REVISION; loser explicitly replans new ID; original duplicate read-only |
| Unauthorized handoff; A2 | AI 66–108 plus child test, TP | both parties/current policy/grants required; wrong target/service/foreign/stale/deny/revoke/expiry/policy fail zero-write; acceptance does not transfer task authority |
| Invalid/foreign bindings; A1 | AI 18–51,174–184,228–237; TP malicious wire frames | exact schema, foreign run/incarnation/issuer, expiry/unbound/restart, injected identity/owner/path/SDK fields rejected; no actor-chosen binding |
| Approval reuse after generation transfer; A3/REC | CA `consumed exact approval survives transfer…`; CD approval execution 44–59; AI 110–138,187–225 | unexpired/unrevoked consumed exact approval preserved, cannot dispatch new attempt; fresh human approval distinct from service/self; multiple human tasks supported |
| Cancellation/pause/authority loss during active call; K1/O6 | CD 74–86,105–109,233–244 | removed attempt terminal/cancelled is stale zero-write; still-exact attempt denied authority/pause/lease becomes uncertain only for itself |
| Crash after renew before/after intent; REC/R1 | CA four `real SIGKILL renew/intent/effect/result` tests + worker | sixteen actual killed owner/restorer scenarios per suite invocation across all runtime pairs; precise raw/effect/callable/ack boundaries above |
| Unknown restoration and result acknowledgement; REC/E1 | CA intent/effect/result seams; CD 112–122; CS 162–193 | unknown is never blindly retried; completed acknowledged-on-disk result never compensated; reopened owner cannot adopt credential |
| Corrupt ownership/replay; P1/REP | CS 132–159; AI 149–157; CD 193–198; CA raw reopening | wrong headers/layout/versions/JSON/large integer/history/receipt/dispatch/evidence fail closed; zero recovery invocation |
| Replay across generations; P1 | CS live owner generation 1→2→3; CD 132–136,149–163; CA all restorers/transfer | complete linked envelopes reconstruct at each corresponding revision, raw reopen equality, no replay adapter calls |
| Atomicity/SQL/unknown errors; S1 | CS 162–198,211–213; AI 159–171; CD 112–122 | old entire envelope visible until commit, rollback on predicate/write failure; attempted COMMIT/failed rollback retire; no compensating write |
| Clock/overflow/capacity; C1/O5 | CS 84–106,196–213,286–295; CD 176–180,215–219; AI 203–208 | sticky clock loss, after-lock sampling, final reauthorization, checked allocator limits, reachable deadline overflow/budget rollback |
| Observer/recovery/compatibility; R1/K1 | CS 31–50,156–159; AI174–184; CD33–42,62–71,229–230; original 051/full/safety | no observer adoption/recovery; explicit v2 no migration; legacy exact context preserved; harmless renewal/receipt doesn't poison pending work |

Counter-overflow coverage distinguishes independent pure allocator MAX_SAFE_INTEGER checks from reachable stored histories. Dense bounded genesis-to-revision history cannot legitimately contain that many commits; forged huge SQL revisions reject as corruption. Reachable clock deadline overflow and envelope budget faults prove actual transaction rollback. No replay constraint was relaxed to manufacture impossible high-generation state.

## Invariants demonstrated

**OWN, ACT, STA, EFF, REC and REP pass for the accepted bounded protocol**, with the explicit remote-race qualification. One acknowledged local owner; no stale canonical writes or old-attempt diagnostics; atomic acquisition/quarantine and durable receipts; current actor authorization and narrow authenticated ingress; no blind retry of unknown effects; independent-process crash continuation; complete cross-generation replay and legacy regression preservation. The release-critical gate requires every applicable matrix cell above; no essential failed test is excluded by relabeling it optional.

## Known limitations and remaining P0/P1/P2

- **P0 (release-critical supported local protocol): none reproduced; all required gates above pass.** This is not an exhaustive formal proof, hostile-OS isolation, or permission to publish.
- **P1 deployment safety boundary — still present and actually reproduced:** DB check and remote effect are not atomic. A fresh process can take over after the final read and an old unfenced callable can still execute. Canonical old result is rejected, but physical effect cannot be recalled. Cooperating downstream generation fencing and stable-operation-key idempotency/mismatch checks are mandatory where stale external effects are unacceptable. Even a downstream fence only revokes lower tokens after observing a higher token. No exactly-once, remote fence-advance or staged-ack recovery claim.
- **P1 trust/operations boundary:** fixed 30,000 ms leases require one trusted shared local wall clock; trusted host authentication/session enrollment, human reconciliation attestation, database identity provisioning and SQLite/filesystem/VFS/device semantics remain assumptions. Clock faults/clone/backup rollback/rename may defeat deployment assumptions. No multi-machine/independent-clock guarantee, backup migration or remote login service.
- **P2 capacity/availability:** synchronous full-envelope replay is bounded and increasingly expensive; renewal/receipt/history growth consumes budgets. No compaction, automatic renewal, dead-letter/retry daemon or automatic reconciliation. Busy/storage/unknown failures conservatively retire and may delay work until expiry. Process SIGKILL is not hardware power-cut validation.
- **P2 test/probe scope:** mutation survivors described above are guarded/transaction-equivalent in measured paths, not a broad arbitrary-host proof. Public proof service is local deterministic cooperation, not arbitrary provider behavior. Full historical tests are Bun-native; shared suites are the Node compatibility gate. Scratch evidence can be pruned.
- **Remaining later-pass/release work:** docs/package allowlist integration and final review remain for separately authorized Pass 8/9. Existing legal/identity/publication blockers remain unchanged. No Block 053 work.

## Blockers

**No blocker to the next authorized documentation pass under the accepted local protocol. RELEASECRITICAL P7: PASS.** Universal stale-physical-effect prevention remains impossible with the current downstream-free boundary and must never be advertised. If the requested deployment requires that stronger guarantee, independent untrusted clocks/hosts, migration, or remote authentication, it remains **BLOCKED pending separate design**, not covered by this pass. Pre-existing whitespace was preserved rather than silently repaired.

## Next pass: READY or BLOCKED

**READY — Pass 8 only when the parent resumes its authorized sequence.** Handoff: new seven-test suite/worker, this full matrix, exact logs under `S/final`, isolated mutation evidence and unchanged 661-file baseline. No P8/P9/publication action was executed here.
