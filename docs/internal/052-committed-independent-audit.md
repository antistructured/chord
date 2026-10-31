# Block 052 — NEW independent audit of the committed artifact

## Pass and acceptance verdict

**Audit complete; acceptance verdict: PARTIAL.** The committed regression/proof gates pass, and no P0/P1 supported canonical-fencing or actor-authorization bypass was reproduced. **Two new P2 implementation defects were reproduced on Node and Bun**, including a contract-valid task ID that stops dispatch and blocks later work. Thus the prior “no product correction needed / all engineering complete” conclusion must not be used as an unconditional planning premise. This audit does not implement corrections or enter Block 053.

Audited repository `/home/d/Workspace/other-projects/chord`, branch **`base`**, full commit **`72f96ab6cdc9d6948ffb7eacba527cc27a32a8be`**. Entry verified **2026-10-30T10:43:27-07:00** by `date -Iseconds`; runtime measurements **Node v24.22.1** (`/home/d/.volta/tools/image/node/24.22.1/bin/node`) and **Bun 1.4.3** (`/home/d/.bun/bin/bun`), Linux. Entry `git status --porcelain=v1 --untracked-files=all` was empty; branch/HEAD and clean status were rechecked before writing this report. This is a review of **committed HEAD**, not the old dirty artifact described by earlier reports at `08728e48772db14a247add9143669a8e0eab01fa`.

Evidence root **`S=/home/d/.hermes/cache/scratch/052-independent`**. Scratch scripts/logs/JSON/SQLite are inspectable, regenerable and may be pruned. All reproduction files were outside the repository. Findings below distinguish actual implementation failures from accepted clock/host/physical-effect restrictions.

## Files inspected and scope

Package-relative `src/`, `tests/`, `examples/` in this report mean `packages/core/`; `#function` is a searchable source locator, not an HTML anchor.

Read complete 050/051 final reports and all nine preceding 052 reports: ownership audit, coordination protocol (all sections), fencing implementation, actor ingress, dispatch/takeover safety, process proof, concurrency tests, developer guide and final report. The P3 pure-quarantine/counter-reachability, P4 pure-command/replay-attestation, and P5 planning-time/fixed-handle/uncertainty addenda were read alongside their actual code, not accepted as proof by assertion.

Read complete `src/coordination/{contracts,state,history,command-authorization,commands,runtime}.js`, `src/runtime/storage/coordinated-sqlite.js`, `src/registry/coordinated-owner.js`, `src/sdk/coordinated-chord.js`, `src/runtime/{actor-ingress,actor-client}.js`; all five coordinated shared suites, all five owner/storage/actor/dispatch/adversarial worker files and actor fixture; complete public live proof and its shared tests. Also read complete legacy `src/sdk/chord.js`, `src/registry/owner.js`, `src/runtime/storage/sqlite.js`, `src/storage/contract.js`, `src/runtime/recovery.js`, `src/contracts/sigils.js`, `src/platform/{authorization,handoff,history,state-invariants,trace-reducer,runtime-loop}.js`, and actual callable capture/normalization in `src/execution/task-packets.js`. Inspected manifest/root exports and actual generated evidence. The entire 051 suite was executed, not claimed as a new line-by-line review of every legacy test.

Inventory universe is Git-tracked package source/test/example `.js`/`.mjs`/`.ts`/`.tsx` paths, excluding dependencies and ignored scratch: **53 source `.js`, 36 test/worker/fixture `.js`, 4 example `.mjs`; zero TypeScript**. Exact paths appear in Appendix B and `S/artifact-checks.json`. This counts files, not test cases. The sole runtime dependency remains **`@weipertda/sigiljs: 0.18.0`**, package version **`0.4.0-preview.1`**, JS ESM. No dependency installation, manifest/lock/version change, provider/framework addition or production/test edit occurred. Live root/SDK/platform export enumeration was **35 / 1 / 22**, with `/sdk` still only `createChord`.

## Independently traced implementation facts

- `coordinated-sqlite.js#commit/transaction/read/write`: `BEGIN IMMEDIATE` precedes authoritative load and clock sampling; every non-acquire write checks captured run/incarnation/owner/generation and exclusive owner expiry before revision/diagnostics. The raw handle must itself have acknowledged that acquisition. UPDATE independently predicates identity, revision, generation, null-safe owner and expiry. Every accepted write couples domain, coordination, receipts and linked histories in one row. Attempted-COMMIT/failed-rollback uncertainty retires rather than compensates.
- `state.js#lifecycle/quarantine/assertOwner`: acquisition increments safe generation and quarantines old active work atomically; release quarantines then vacates without resetting generation. Same UUID does not reuse generation. Renew must extend its fixed 30,000 ms deadline. Tied renewal, exact expiry, backward/local/persisted clock, after-lock sampling, final authorization, reachable budget/deadline overflow and corrupt headers are exercised by the freshly rerun storage suite. MAX_SAFE_INTEGER allocator tests are not a fabricated reachable high-counter database.
- `coordinated-owner.js` and `coordinated-chord.js`: fixed private acquisition; no read-based adoption; no legacy recovery in construction. All exposed admin/owner/actor/runtime writes go through the fenced store; unsupported legacy convenience methods are absent rather than unfenced aliases. Powerful `admin.commitRun`, raw stores, exported legacy simulation helpers, adapter/host code and SQL/filesystem possession remain trusted-host capabilities, not actor endpoints.
- `commands.js`/`command-authorization.js`: host attestation and current persisted issuer/principal/actor/window, exact scope/grants/deny, policy parties/revision/action/TTL and expected revision govern commands. Handoff does not transfer execution ownership or task grants. Approval is distinct-human/exact-attempt-bound, consumed at dispatch; multiple humans are independently checked. Receipt identity is an unambiguous subject tuple plus full normalized command; current authentication/visibility and current owner are required before returning an original historical response. Reads/denials do not write canonical floors/receipts/history.
- `runtime.js#assertAttempt/outcomeCandidate` and SDK `runCycle`: ownership then exact active attempt/full sidecar identity precede outcome/uncertainty construction, including missing active attempts and throws. Harmless global revision advancement does not invalidate an otherwise valid v2 call. Captured callable/packet/context are prepared before claim, followed by a fresh `checkDispatch` immediately before invocation, without an intervening await/router/getter. Result persistence is outside adapter catch; invalid adapter normalization is caught as adapter error, not accidentally persisted as success.
- `history.js#reduceCoordinationTrace`: dense ordered domain/coordination linkage, operation pairing, per-revision legal reconstruction and complete projection equality; zero clock/adapter use. Domain-only `reduceTrace` is not ownership replay. Legacy v1 remains exclusive sequential restart; both cross-open directions reject; no hidden migration.

## New severity-classified findings

### F1 — P2: accepted prototype-member task IDs stop the scheduler and head-block later work

**Status: reproduced, high confidence, supported data path; not a hostile-host or remote-effect limitation.**

Locators: `src/sdk/coordinated-chord.js#runCycle` line 81; `src/coordination/runtime.js#planClaim` lines 37–38. Both use truthiness-based `pending_attempts[task_id]`, not own-property lookup. `clonePlainData` produces ordinary `{}` dictionaries. `TaskPacket`/ID contracts legitimately accept `toString`, `valueOf`, `hasOwnProperty` (only `__proto__`, `constructor`, `prototype` are excluded). An absent reservation under those valid IDs resolves to an inherited Object.prototype function, which `Attempt.assert` rejects as `INVALID_DATA`.

Minimal reproduction (`S/probes.mjs` and stronger `S/edge-probes.mjs`):

1. Provision the same explicit exact work grant as the ordinary control, with task/scope/resource ID `toString`; submit through authenticated actor ingress. Submission succeeds and is durably receipted. No grant bypass or generic maintenance endpoint is exposed to actors.
2. Leave no pending approval reservation (ordinary non-approval work); open/acquire the public coordinated factory with a successful fallback adapter.
3. Call `owner.runCycle()`. **Expected:** one protected call and completion for this valid authorized task, just as control `ordinary-audit-task`. **Observed:** `INVALID_DATA`, zero protected calls, task remains queued, complete raw singleton row unchanged. `valueOf` and `hasOwnProperty` reproduce identically; ordinary control completes once.
4. Stronger probe admits a later ordinary foreign actor task at shared time 101 after the bad-ID task at 100, then runs three cycles. **Observed:** three `INVALID_DATA`, **zero calls for either task**, both queued, byte-equivalent complete row after every rejection. Ready-task selection repeatedly chooses the oldest problematic entry; no automatic skip exists.

Evidence: `S/probe-results-{node,bun}.json`, `S/edge-results-{node,bun}.json`, `S/head-blocking-rows-{node,bun}.json` (full raw rows before/after), named final logs and scripts. Both runtimes exit **0** because these diagnostic probes assert the demonstrated failure; exit zero is **not** the intended product behavior passing. No production source was mutated.

Effect: a supported authorized input can stall that run, including later unrelated runnable work, until trusted host intervention. Safety fails closed (no unauthorized call/write); availability/valid-input support and protocol §3's safe-own-property requirement do not hold universally. Severity P2, not a demonstrated privilege escalation/data corruption. There is no evidence this defect is an accepted restriction on caller-authored IDs.

Recommendation/acceptance: use a consistent own-property dictionary accessor for pending reservations in both shell and pure planner (and audit similar dictionary reads); preserve the existing accepted ID contract rather than silently banning more strings. Add shared Node/Bun public-ingress→dispatch controls for ordinary and inherited-member IDs, with and without pending approvals, plus a second independent queued task. Both tasks must complete once with replay equality; failed stale paths must still have zero writes/calls. A skip-only workaround does not make the admitted task executable.

### F2 — P2: actor client accepts an older command's response as the current command's result

**Status: reproduced in actual inherited IPC and a small transport unit probe; high confidence, client delivery/correlation defect, not a canonical auth/receipt bypass.**

Locator: `src/runtime/actor-client.js#createActorClient/listener/sendCommand`, lines 8–12 and 20–22. Pending state stores only resolve/reject. Any parseable message with actor-response protocol resolves it; no operation/run/incarnation/correlation matching or response shape validation occurs. `close()` rejects local pending work and detaches listeners but does not close/drain the transport.

Minimal reproduction (`S/client-ipc-probe.mjs`, no product hooks): child sends valid read A with public client; closes that client before delivery (local promise rejects); creates another client on the still-connected inherited channel and sends valid distinct read B. Trusted parent computes both genuine responses through production ingress, delaying delivery of A until B is pending, then delivers A followed by B. **Expected:** A cannot settle B. **Observed on both runtimes:** B resolves with `operation_id: late-a`, although it requested `new-b`; later actual B reply is ignored. Spawn/self PID equality and complete SQLite-row nonmutation are asserted. Final evidence PIDs: Node **71185**, Bun **71283**, in `S/client-ipc-{node,bun}.json`.

This does not require forged identity, a compromised host or duplicate delivery; local wrapper replacement plus ordinary late delivery suffices. One pending request per *client instance* is insufficient to correlate a persistent channel. It does not prove a write was acknowledged under the wrong operation in SQLite: the defect is the caller's promise/result association. The concrete diagnostic uses reads, so makes **zero adapter calls and zero canonical writes**.

Recommendation/acceptance: retain pending command identity, validate/match responses before settling, and define a deterministic treatment for protocol/shape errors with null operation IDs; alternatively explicitly retire/disconnect the channel when abandoning a request, with an enforceable one-lifetime policy. Test actual IPC late A after replacement, unrelated/foreign responses, malformed response and normal/duplicate historical receipt responses. Do not “fix” this by refreshing historical receipt revision/owner metadata. This belongs in delivery hardening, not a redesigned authentication promise.

### Severity/gate summary

| Class | Disposition |
|---|---|
| P0 implementation | None reproduced. No exhaustive/formal absence claim. |
| P1 implementation | None reproduced in accepted bounded local threat model. |
| P2 implementation | **F1** valid-ID scheduler head blocking; **F2** client response misassociation. Both outstanding; neither fixed here. |
| P1 deployment/effect restrictions | Non-atomic final-check/effect race, trusted shared clock/host/file identity/human enrollment; accepted restrictions, not new implementation defects. |
| Separate publication | Still blocked/unauthorized on maintainer identity/legal/final-artifact gates; no fresh legal/registry certification. |

## Independent challenges that did not establish an additional bug

`edge-probes.mjs` exercises a **613-character receipt key** using maximum-length binding/operation IDs, recursively reordered JSON keys, exact original receipt replay and an authenticated context read. The original response is returned unchanged and complete raw row remains equal. This checks more than the common short-ID receipt examples and does not require relaxing the 2048-character key contract.

The same scratch probe changes only v1 genesis event timestamp 100→99 while keeping the coordination genesis floor 100; combined replay accepts it. This is retained as an **evidence-semantics characterization, not a security finding**: it does not reorder records, reduce ownership generation, alter a permission, produce a new effect or claim signed/byte-authentic history. The current exact genesis record has no duplicate `at` field, and replay is semantic reconstruction, not cryptographic integrity. If planning requires genesis-time equality/stronger historical timestamp provenance, make that a deliberate contract decision and add a test; do not retroactively describe semantic replay as a tamper signature.

## Test commands, exits and baseline/final totals

Fresh executions against committed HEAD; no historical totals substituted. `P=/home/d/Workspace/other-projects/chord/packages/core`, `R=/home/d/Workspace/other-projects/chord`; N/B are the absolute runtimes above. Complete expanded argv/cwd/exits/logs: `S/commands.json`, `S/extra-final-commands.json`; Appendix A reproduces the exact command list. `run-gates.py` ran independent commands with up to three workers; all full/shared/proof commands passed within their explicit timeouts. Counts overlap and must not be summed as unique coverage.

| Gate | Baseline/provenance | Fresh final observed | Exit |
|---|---|---|---:|
| Full Bun suite | Parent entry measurement: 356/0, 1715 expects, 26 files | **356 pass, 0 fail, 1715 expect calls, 26 files** | 0 |
| Five original 051 shared suites | Historical accepted 82 each | **82 pass each Node/Bun**, no fail | 0 each |
| Five 052 shared suites | Committed prior gate 81 each | **81 pass each Node/Bun**, no fail | 0 each |
| Original Block 6A safety | Original bytes preserved | **21 pass each Node/Bun**, no fail | 0 each, corrected Bun argv |
| Runtime verifier | Not inferred from old report | `ALL RUNTIME VALIDATIONS PASSED!` on both | 0 each |
| Quickstart / cross-actor public examples | Prior expected behavior | completion once; accepted handoff, consumed approval, zero negative effects, replay verified on both | 0 all |
| Legacy public restart proof | Historical sequential restart only | Four fresh runtime pairs, **B5 PASS** each | 0 all |
| Public live proof | Historical bounded collaboration | Four fresh owner/actor pairs, raw SQLite/artifact checks below | 0 all |
| New scratch regressions/challenges | Not in committed suites | F1/F2 reproduced on both; positive long-ID/order/read controls pass | 0 all diagnostic commands |
| Independent evidence inspector | Actual files, not reported flags only | Four live DBs and eight legacy scenario DBs checked | 0 final |
| `git diff --check`; staged diff | Entry clean committed tree | Both empty/success (old whitespace is committed, not a current diff) | 0 |

Full historical suite imports `bun:test`; no full-suite Node claim. Original safety bytes were compared to `git show 1efafd1:docs/internal/046-state-probes.mjs`, SHA-256 **`95b72cd7189bb2d54685bdd3f08561ef0740f3e8399bbc04cb10a269228248eb`**. Full/shared green results do not cover F1/F2; there were no source/test repairs to make these totals pass.

Tooling iterations are not hidden: first Bun safety invocation lacked `./` and exited **1** because Bun treated the path as a filter and matched no tests; corrected exact argv ran 21 tests. Scratch inspector initially compared exit JSON to an exact two-key shape despite its legitimate PID, then incorrectly treated legacy `reopened.json` as final rather than pre-continuation state. Those scratch expectations were corrected after inspecting artifacts; final inspector compares raw legacy SQLite to actual `final.json`, verifies reopened identity/revision ordering, and validates the summary's continuation/recovery facts. No production behavior/assertion was weakened. Initial `extra-commands.json` and `inspect-evidence.log` retain the failed scratch run; final records are separately named. A preliminary repository-root `package.json` lookup also failed; actual package is `packages/core/package.json`.

## Actual retained SQLite/process/artifact evidence

`inspect-evidence.py` uses independent Python read-only SQLite connections, not merely the API's success flags. For each live pair, singleton envelope equals `final.json.envelope`, `replay.json` and `reopened.json.envelope`, with entire final/reopened snapshots equal; revision **14**, generation **1**, **6 receipts, 2 attempts, 2 results**, two ledger records and exact actual effect-file contents. Sidecar/operation/task linkage is checked. All three role exits are code 0/signal null; transcript has **11 zero-write denials** and three unchanged duplicate checks. Example host fixed shared clock 100 is not elapsed-time expiry evidence; actor/human enrollment is a host attestation, not a remote login service. Live storage/actor/dispatch/crash suites separately exercise races/expiry.

| Pair | Owner PID | Actor PID | Standby PID | Evidence directory |
|---|---:|---:|---:|---|
| bun-bun | 61102 | 61129 | 61160 | `S/proof-bun-bun` |
| bun-node | 60611 | 60645 | 60659 | `S/proof-bun-node` |
| node-bun | 58096 | 58120 | 58140 | `S/proof-node-bun` |
| node-node | 57074 | 57099 | 57106 | `S/proof-node-node` |

Each `S/restart-<writer>-<reader>` retains approval and ambiguous scenario SQLite, first/reopened/final registries, processes, summaries and effects. Raw SQLite equals each final registry; approval continuation calls **1**, rejects **3** absent/stale sessions and has **28** events; ambiguous SIGKILL continuation calls **0**, has **20** events and no ambiguous redispatch. A previously committed effect is preserved. These are separate fresh processes reopening the same database, not memory snapshots passed as continuation. Legacy reopened state is intentionally intermediate before approved continuation; it is not falsely claimed equal to final state.

The rerun coordinated adversarial suite includes actual takeover **after final check before captured callable**: old callable enters **once**, old result is `OWNER_LOST`, complete newer row unchanged. Pre-final-check actual takeover invokes **zero** callables. Old public-runtime success **and throw** after a newer attempt reject before any newer-row change. All four SIGKILL runtime-pair cases contain renew/intent/effect/result boundaries. Tests clean those ephemeral seam databases; public named proof DBs and F1 full raw rows remain retained. No new mutation campaign score is claimed; new probes target unmodified committed code.

## Evidence matrix — all 17 required invariants

CS/AI/CD/CA/TP are the five shared suite basenames: coordinated-storage, actor-ingress, coordinated-dispatch, coordinated-adversarial, two-process-coordination. Every cited suite was freshly run on both runtimes. PASS is bounded observed evidence, not formal proof or promotion of the full historical Level B proposal.

| ID | Independent source trace / executable evidence | Verdict |
|---|---|---|
| OWN-01 | `assertOwner`, captured handle; CS simultaneous four-pair acquire, TP live denied standby; one acknowledged generation | PASS |
| OWN-02 | Store owner check before revision/payload/diagnostics; CS stale tags/refreshed reads, CD stale callback entire-row equality | PASS |
| OWN-03 | SDK claim→fresh `checkDispatch`→captured callable; CD actual claim-ack takeover/expiry/authority checks zero calls; CA post-check race one call explicitly retained | PASS for checked boundary, not atomic effect exclusion |
| OWN-04 | BEGIN/read/owner/revision/independent SQL predicates; CS actual races and rollback/isolation; atomic acquire+quarantine | PASS |
| OWN-05 | `quarantine` marks uncertain/unknown; CA intent/effect death; CD takeover no blind replay | PASS |
| OWN-06 | Lifecycle safe increment, retained release generation; CS same UUID 1→2→3/expiry/checked overflow; scoped incarnation only | PASS |
| OWN-07 | Store and pure runtime identity-first outcome; CD old success/throw, missing and replaced active attempts, new generation and same-generation replacement; exact row preserved | PASS |
| ACT-01 | Fresh ingress attestation + binding validation, exact wire allowlist; AI actual bound children/foreign/unbound/forged fields; TP hostile wire | PASS host-enrolled identity boundary; F2 response association qualification |
| ACT-02 | Current permission/scope/deny/issuer/party/policy; AI filtered nonempty context/outcomes/revocation/TTL, TP explicit outcome grant; long-ID/read zero-write probe | PASS canonical authorization/filtering |
| ACT-03 | Pure durable handoff/approval, exact distinct human/attempt; AI two humans/target-only/revision/expiry, CD approval→actual effect, CA consumed transfer denial | PASS canonical workflow; F1 valid-ID dispatch coverage exception |
| STA-01 | Store authoritative locked owner/revision/CAS; actual owner/actor same-revision races; zero-row/predicate/lock/unknown paths | PASS |
| STA-02 | One complete row for domain/lease/receipts/both histories; CS independent uncommitted reader/rollback, retained raw final equality | PASS |
| EFF-01 | Unknown external outcome quarantined, no compensation after unknown result COMMIT; CD ack loss, CA kill/restorer, legacy ambiguous calls zero | PASS within stated effect boundary |
| EFF-02 | Exact same-subject full-envelope historical receipt and operation-signature quarantine; AI revoked duplicate/mismatch/ack loss, TP two ledger effects only; new key-order control | PASS local duplicate prevention; F2 client result association not durable receipt corruption |
| REC-01 | New session map/fresh attestation, owner not adopted; AI post-ack restart, four legacy pairs reject old/absent sessions; F2 late-reply recovery case | PASS canonical reauthorization; PARTIAL client delivery continuity |
| REC-02 | No observer recovery/router construction; acknowledged acquire atomically quarantines; CA/legacy no ambiguous redispatch | PASS |
| REP-01 | Combined reducer per-revision linkage/transition/projection checks; CS/AI/CD tampering, all retained raw DB/replay/reopen comparisons | PASS semantic reconstruction, not signed login/remote completion/timestamp authenticity |

No new invariant was silently broadened to demand hostile same-user isolation, multi-machine clocks or universal stale-effect prevention. Conversely F1 is **not** excused by those restrictions: it is ordinary authenticated, granted data already accepted by the exact public contract. Matrix safety passes do not erase the overall PARTIAL verdict for valid-input execution and delivery defects.

## Known limitations and accepted deployment assumptions

One trusted local regular-file database incarnation, no live replacement/rename/clone/backup rollback, pinned run/incarnation outside DB; trusted shared wall clock and synchronous nonreentrant clock callback; SQLite/VFS/OS/device durability; trusted host/channel and human enrollment; private admin/raw handles. Same-user actor code is not sandboxed. Clock stop/jump/suspend/skew can cause availability or external-effect hazards; expiry is not evidence of nonexecution. Whole-envelope bounded replay is synchronous/expensive; receipt/history/renewal growth consumes finite budgets, no compaction/migration/automatic timer/retry/reconciliation daemon.

Final DB check cannot atomically revoke an in-transit or already-running effect. Opt-in v2 context transports fixed owner generation and stable logical-operation key, but cooperative downstream must atomically fence and dedupe with semantic payload mismatch detection. A downstream that has not observed the higher generation may accept an older request. No exactly-once, automatic fence advance, staged-ack recovery, multi-machine leadership or real remote-human login claim. Actual tested effects are local files; SIGKILL is not hardware power-cut certification. These are accepted restrictions, not F1/F2 fixes.

## Planning-agent-ready handoff and 053 readiness

**Verified facts:** current committed artifact and clean baseline, green fresh regressions/proofs, fixed-generation local canonical fencing, owner/attempt-first stale outcome rejection, transactional receipts and linked replay, narrow host-attested actor authorization, legacy/v2 separation. Preserve those facts and the raw evidence rather than restarting completed 050–052 work. Earlier reports' dirty-tree SHA/status/totals are historical; this report identifies the committed artifact.

**Claims needing a decision:** do not carry an unconditional “no product defects / COMPLETE” claim into a new plan. Decide how F1/F2 are closed or explicitly recorded as known supported limitations; F1 contradicts safe dictionary access/valid-ID execution and merits correction rather than an undocumented ID restriction. Decide whether client replacement retains a channel or must retire it, and what null-operation protocol failures mean. Genesis timestamp equality is an optional evidence-contract clarification, not an established ownership exploit. Separately decide actual deployment tolerance for stale physical effects, and release identity/legal/artifact gates.

**Prioritized actions / acceptance criteria (recommendations only):**

1. **P2 F1, first:** own-property reservation reads throughout shell/planner; public-ingress inherited-ID controls, two runnable task proof, both runtimes; once-only calls, successful result, combined replay, no stale write regression. Do not merely skip the offending accepted task.
2. **P2 F2:** response identity validation or enforceable channel retirement on abandonment; actual IPC late reply/replacement proof, foreign/malformed response negatives and historical duplicate-response positives. No wrong command may resolve another command's promise; no canonical writes on read tests.
3. Re-run full356/shared05182/shared05281/safety21 and both verifiers/examples, plus new regressions (totals then necessarily change). Repeat all four live/restart pairs with raw DB inspection. Require explicit before/after failure then success evidence in any authorized correction pass; no correction was installed here.
4. Only after disposition, separately scope downstream fencing/delivery hardening: atomic highest-generation acceptance and stable-key semantic dedupe, delayed requests, ack loss, inspectable receipts and evidence-backed reconciliation. Preserve the remote-race limitation unless a separately justified stronger protocol closes it. Do not mix in automatic unknown retry, multi-machine consensus, migration, UI or publishing by implication.

**053 readiness:** READY for planning/scoping with this PARTIAL audit and explicit defect actions; **not automatic authorization to implement 053**, publish or declare defect-free 052 acceptance. No engineering tool blocker prevents a subsequent authorized correction. No P0/P1 canonical safety exploit was found that requires inventing a new threat model, but outstanding P2s must not be hidden behind suite totals.

Reproduction: from R run `python3 S/run-gates.py` only after choosing a fresh evidence root (public CLI output directories must not exist), and `python3 S/run-extra.py` for scratch challenges. Individual exact commands/exits are in Appendix A. Diagnostic exploit scripts intentionally assert current defective behavior; turn their expected outcomes into positive regression assertions when correcting production.

## Files changed and preservation

Created **only `docs/internal/052-committed-independent-audit.md`** in the repository. Entry SHA-256 inventory `S/entry-hashes.json` contains **563 tracked files**; every entry file was rehashed before report creation and was byte-identical. Final `S/final-preservation.json` verifies every entry hash/presence again, branch/full HEAD, empty staged diff, exact new-report-only expanded status and no source/test/manifest/lock changes. Final status must be exactly `?? docs/internal/052-committed-independent-audit.md`; no tracked diff. Existing committed whitespace is not an uncommitted error. No commit, staging, push, tag, publication, version/dependency change, reset, clean, stash or Block 053 work occurred.

A reusable adversarial own-property/contract-valid-ID lesson was recorded in the existing default-profile documentation-verification skill outside the repository; it is not product implementation. No other profile was changed.

## Appendix A — exact executed gate and final probe commands

The initial Bun safety no-match exit is retained; the corrected invocation follows in the final-probe rows. Cwd is literal, not implied by shell state. Logs are `S/<label>.log` for primary gates and the explicit paths in final probe JSON.

| Label | Cwd | Exact argv | Exit |
|---|---|---|---:|
| `full-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun test` | 0 |
| `052-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js` | 0 |
| `051-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 |
| `safety-node` | `/home/d/Workspace/other-projects/chord` | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test docs/internal/046-state-probes.mjs` | 0 |
| `verifier-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node src/verify-runtime.js` | 0 |
| `quickstart-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/quickstart.mjs` | 0 |
| `cross-actor-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/cross-actor-workflow.mjs` | 0 |
| `restart-node-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/process-recovery.mjs /home/d/.hermes/cache/scratch/052-independent/restart-node-node /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `proof-node-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/052-independent/proof-node-node /home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `restart-node-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/process-recovery.mjs /home/d/.hermes/cache/scratch/052-independent/restart-node-bun /home/d/.bun/bin/bun` | 0 |
| `proof-node-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/052-independent/proof-node-bun /home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.bun/bin/bun` | 0 |
| `052-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js` | 0 |
| `051-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 |
| `safety-bun` | `/home/d/Workspace/other-projects/chord` | `/home/d/.bun/bin/bun test docs/internal/046-state-probes.mjs` | 1 |
| `verifier-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun src/verify-runtime.js` | 0 |
| `quickstart-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun examples/quickstart.mjs` | 0 |
| `cross-actor-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun examples/cross-actor-workflow.mjs` | 0 |
| `restart-bun-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun examples/process-recovery.mjs /home/d/.hermes/cache/scratch/052-independent/restart-bun-node /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `proof-bun-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/052-independent/proof-bun-node /home/d/.bun/bin/bun /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `restart-bun-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun examples/process-recovery.mjs /home/d/.hermes/cache/scratch/052-independent/restart-bun-bun /home/d/.bun/bin/bun` | 0 |
| `proof-bun-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/052-independent/proof-bun-bun /home/d/.bun/bin/bun /home/d/.bun/bin/bun` | 0 |
| `safety-bun-corrected` | `/home/d/Workspace/other-projects/chord` | `/home/d/.bun/bin/bun test ./docs/internal/046-state-probes.mjs` | 0 |
| `inspect-evidence` | `/home/d/Workspace/other-projects/chord` | `python3 /home/d/.hermes/cache/scratch/052-independent/inspect-evidence.py` | 0 |
| `probes-node` | `/home/d/Workspace/other-projects/chord` | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/052-independent/probes.mjs` | 0 |
| `edge-probes-node` | `/home/d/Workspace/other-projects/chord` | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/052-independent/edge-probes.mjs` | 0 |
| `client-ipc-probe-node` | `/home/d/Workspace/other-projects/chord` | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/052-independent/client-ipc-probe.mjs` | 0 |
| `probes-bun` | `/home/d/Workspace/other-projects/chord` | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/052-independent/probes.mjs` | 0 |
| `edge-probes-bun` | `/home/d/Workspace/other-projects/chord` | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/052-independent/edge-probes.mjs` | 0 |
| `client-ipc-probe-bun` | `/home/d/Workspace/other-projects/chord` | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/052-independent/client-ipc-probe.mjs` | 0 |

## Appendix B — exact committed code inventory

### src (53 files)

- `packages/core/src/cli/_shared.js`
- `packages/core/src/cli/inspect-audit.js`
- `packages/core/src/cli/replay.js`
- `packages/core/src/cli/run.js`
- `packages/core/src/contracts/sigils.js`
- `packages/core/src/coordination/command-authorization.js`
- `packages/core/src/coordination/commands.js`
- `packages/core/src/coordination/contracts.js`
- `packages/core/src/coordination/history.js`
- `packages/core/src/coordination/runtime.js`
- `packages/core/src/coordination/state.js`
- `packages/core/src/demo/callaback-demo.js`
- `packages/core/src/demo/fake-sms-adapter.js`
- `packages/core/src/demo/fake-user.js`
- `packages/core/src/execution/results.js`
- `packages/core/src/execution/task-packets.js`
- `packages/core/src/index.js`
- `packages/core/src/platform/adapter-routing.js`
- `packages/core/src/platform/approval-flow.js`
- `packages/core/src/platform/attempts.js`
- `packages/core/src/platform/authorization.js`
- `packages/core/src/platform/event-journal.js`
- `packages/core/src/platform/handoff.js`
- `packages/core/src/platform/history.js`
- `packages/core/src/platform/index.js`
- `packages/core/src/platform/journal-audit.js`
- `packages/core/src/platform/policy.js`
- `packages/core/src/platform/reconciliation.js`
- `packages/core/src/platform/recovery-policy.js`
- `packages/core/src/platform/runtime-loop.js`
- `packages/core/src/platform/state-invariants.js`
- `packages/core/src/platform/task-queue.js`
- `packages/core/src/platform/trace-reducer.js`
- `packages/core/src/platform/transitions.js`
- `packages/core/src/registry/coordinated-owner.js`
- `packages/core/src/registry/owner.js`
- `packages/core/src/registry/query.js`
- `packages/core/src/registry/registry.js`
- `packages/core/src/registry/snapshot.js`
- `packages/core/src/runtime/actor-client.js`
- `packages/core/src/runtime/actor-ingress.js`
- `packages/core/src/runtime/adapter.js`
- `packages/core/src/runtime/recovery.js`
- `packages/core/src/runtime/storage/coordinated-sqlite.js`
- `packages/core/src/runtime/storage/sqlite.js`
- `packages/core/src/sdk/chord.js`
- `packages/core/src/sdk/coordinated-chord.js`
- `packages/core/src/sdk/index.js`
- `packages/core/src/storage/contract.js`
- `packages/core/src/types/index.js`
- `packages/core/src/utils/clone.js`
- `packages/core/src/utils/id.js`
- `packages/core/src/verify-runtime.js`

### tests (36 files)

- `packages/core/tests/actor-ingress-worker.js`
- `packages/core/tests/actor-ingress.test.js`
- `packages/core/tests/admission-integrity.test.js`
- `packages/core/tests/adversarial.test.js`
- `packages/core/tests/architecture-integrity.test.js`
- `packages/core/tests/authority-continuity.test.js`
- `packages/core/tests/authorization.test.js`
- `packages/core/tests/canonical-example.test.js`
- `packages/core/tests/continuity.test.js`
- `packages/core/tests/contracts.test.js`
- `packages/core/tests/coordinated-adversarial-worker.js`
- `packages/core/tests/coordinated-adversarial.test.js`
- `packages/core/tests/coordinated-dispatch-worker.js`
- `packages/core/tests/coordinated-dispatch.test.js`
- `packages/core/tests/coordinated-owner-worker.js`
- `packages/core/tests/coordinated-storage-worker.js`
- `packages/core/tests/coordinated-storage.test.js`
- `packages/core/tests/crash-recovery-worker.js`
- `packages/core/tests/crash-recovery.test.js`
- `packages/core/tests/developer-api-review.test.js`
- `packages/core/tests/durable-adversarial-worker.js`
- `packages/core/tests/durable-adversarial.test.js`
- `packages/core/tests/fault-injection.test.js`
- `packages/core/tests/fixtures/coordinated-actors.js`
- `packages/core/tests/fixtures/host.js`
- `packages/core/tests/hardening.test.js`
- `packages/core/tests/integrity.test.js`
- `packages/core/tests/lifecycle-integrity.test.js`
- `packages/core/tests/mutation-regression-closeout.test.js`
- `packages/core/tests/process-recovery.test.js`
- `packages/core/tests/recovery-integrity.test.js`
- `packages/core/tests/replay-integrity.test.js`
- `packages/core/tests/storage-adapter.test.js`
- `packages/core/tests/storage-process-worker.js`
- `packages/core/tests/transitions.test.js`
- `packages/core/tests/two-process-coordination.test.js`

### examples (4 files)

- `packages/core/examples/cross-actor-workflow.mjs`
- `packages/core/examples/process-recovery.mjs`
- `packages/core/examples/quickstart.mjs`
- `packages/core/examples/two-process-coordination.mjs`

