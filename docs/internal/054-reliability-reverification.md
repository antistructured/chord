# Block 054 — Pass 1 reliability reverification

## Pass

**Current Pass1 gate: UNRESOLVEDP2.** Fresh exact-source acceptance commands pass, including controlled two-runner parallel process tests. No critical canonical-state/effect defect reproduced. The historical intermittent startup failure's **first native operation and cause remain unknown**; neither a later green rerun nor a separately forced SQLITE_BUSY identifies its cause. Consequently this report does not promote the old environmental inference to a proven classification or authorize Pass2 entry.

This is a new reverification, not an edit to [the historical canonical Pass1 report](054-reliability-audit.md). That report's original **CLASSIFIED** conclusion and measurements remain intact as historical evidence. Current Pass1 disposition is stricter because the retained original failure lacks native causal evidence.

Repository R=`/home/d/Workspace/other-projects/chord`; package P=`R/packages/core`; evidence S=`/home/d/.hermes/cache/scratch/054-pass1-1793466913668812293`. B=`/home/d/.bun/bin/bun`; N=`/home/d/.volta/tools/image/node/24.22.1/bin/node`. Scratch evidence is local and prunable.

## Agent

**reliability-agent**, delegated Block054 Pass1 only. Loaded and updated the existing repository-documentation-verification skill with the first-native-failure versus readiness-timeout distinction. No Pass2 work, publication, version change, staging, commit, push, tag, reset, clean, checkout or stash.

## Files inspected

- All nine present `docs/internal/053-*.md` reports; complete `052a-final-report.md`, historical `052-committed-independent-audit.md`, inherited `054-reliability-audit.md` and `054-adapter-conformance.md`. The aggregate prior reports are retained verbatim in S/prior-reports.txt; merely aggregating older 052 documents is not claimed as a new exhaustive review of them.
- Complete current `src/interop/{adapter-protocol,adapter-bridge,adapter-server,reference-adapters,memory-transport,index}.js`, the inherited conformance implementation/inventory and test; `examples/adapter-interop.mjs`, protocol test and real IPC worker; current coordinated SDK dispatch and actor client; both complete SQLite shells and their complete inherited diffs. Paths here are package-relative.
- Storage/coordination acceptance contracts and the actual process-heavy harnesses: explicit child readiness, PID assertions, exit/SIGKILL handling, raw-row/replay/effect assertions, cleanup. All 14 runtime-neutral test files were executed on both runtimes, including identifier integrity, actor delivery correlation and current adapter conformance.
- Actual surviving historical failure log and proof artifacts, not report flags alone. See historical/fresh proof sections below.

### Before-modification inventory and versions

Captured before any repository write: **branch `base`, full HEAD `72f96ab6cdc9d6948ffb7eacba527cc27a32a8be`; 29 modified tracked paths, zero staged paths, 38 untracked paths.** There are 563 tracked paths and 601 tracked-plus-untracked regular files in the captured inventory. Universe: `git ls-files --cached --others --exclude-standard`; expanded status uses `git status --porcelain=v1 --untracked-files=all`. Ignored dependencies/evidence are excluded, not assumed absent.

- **S/entry.json**: full tracked and untracked path lists, expanded changed-path inventory, staged/tracked diff inventory, SHA-256 for every one of the 601 entry files, branch and full HEAD.
- **S/entry.diff**: complete inherited tracked diff.
- **S/implementation-inventory.json**: exact code paths and hashes; all 20 implementation/documentation paths listed by 053's final report exist. Current package inventory is **62 source JS, 42 test/worker/fixture JS, six example MJS**, zero source TypeScript in that inventory. The six original interop modules, tests/worker/example, additive exports and manifest entries are present; the later conformance module is additional inherited 054 work, not missing 053 work.
- Live version commands: `B --version` → **1.4.3**, `N --version` → **v24.22.1**, both exit 0. Package remains `@antistructured/chord@0.4.0-preview.1`, ESM, sole runtime dependency `@weipertda/sigiljs` exactly `0.18.0`.
- Source literals remain `chord.contracts.v1`, `chord.local-store.v1`, `chord.local-store.v2`, `chord.coordination.v1`, `chord.adapter-protocol.v1`, `chord.adapter-descriptor.v1`, `chord.execution-context.v2`.

Historical committed audit SHA-256 is still **`0b7609b61e593bcb546ce0cacb838b986cf7a90949393a8e8fe69a6b17cddc60`**. Its PARTIAL verdict describes its original committed artifact; 052A final acceptance describes the later dirty corrections. Neither is rewritten.

## Files changed

**Created only `docs/internal/054-reliability-reverification.md` in the repository.** No production, test, example, README, manifest, lockfile, prior report or conformance edit. No reliability correction was justified by a newly reproduced supported product defect. Scratch runners/probes/logs/inventories are all under S. An existing default-profile skill was updated outside the repository; no other profile was modified.

All 601 entry files are preserved byte-for-byte. Final expanded inventory and full preservation verification: **S/final-status.txt**, **S/preservation.json**. Entry status remains inherited; the only newly added repository path is this report. No staged changes.

## Test commands

Every measured runtime command has exact argv, cwd, PID, start/end resource snapshots, exit and elapsed seconds in **S/commands.json** and individual `S/<label>.json`; complete stdout and stderr are separate `S/<label>.stdout` / `.stderr`. **S/command-summary.json** is the machine-aggregated result index. Counts overlap and are not summed as unique coverage.

Executors: `python3 S/run.py full`, then `python3 S/run.py shared`, then `python3 S/run.py repeat`, each from R. The orchestrator writes child exits and itself returning 0 is not substituted for those exits. Tests retain their repository timeout settings; no blanket timeout override or harness/assertion weakening was used. All measured children use `TMPDIR=S` and `CHORD_STORAGE_DIAGNOSTICS=1` so native code/syscall evidence is retained if an actual failure occurs. No injected native wrappers run inside acceptance suites; wrappers are confined to separate trusted scratch controls.

Define C as the following exact 14 paths, cwd P:

```text
tests/actor-ingress.test.js tests/adapter-conformance.test.js tests/adapter-protocol.test.js tests/authority-continuity.test.js tests/coordinated-adversarial.test.js tests/coordinated-dispatch.test.js tests/coordinated-storage.test.js tests/crash-recovery.test.js tests/durable-adversarial.test.js tests/identifier-integrity.test.js tests/ipc-correlation.test.js tests/process-recovery.test.js tests/storage-adapter.test.js tests/two-process-coordination.test.js
```

Define H as these exact seven process-heavy/current-interop paths, cwd P:

```text
tests/actor-ingress.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js tests/process-recovery.test.js tests/ipc-correlation.test.js tests/adapter-protocol.test.js tests/adapter-conformance.test.js
```

## Exit codes

| Actual command / label | Outcome | Exit | Elapsed |
|---|---|---:|---:|
| `B test`, full-bun-isolated, cwd P | **427 pass, 0 fail, 1770 expect calls, 30 files** | 0 | 103.160 s |
| `N --test C`, shared-node | **234 pass, 0 fail/cancelled/skipped** | 0 | 75.211 s |
| `B test C`, shared-bun | **234 pass, 0 fail, 14 files** | 0 | 95.150 s |
| `N --test ./docs/internal/046-state-probes.mjs`, cwd R | **21 pass, 0 fail/cancelled/skipped** | 0 | 0.222 s |
| `B test ./docs/internal/046-state-probes.mjs`, cwd R | **21 pass, 0 fail** | 0 | 0.110 s |
| `N src/verify-runtime.js`, cwd P | ALL RUNTIME VALIDATIONS PASSED | 0 | 0.180 s |
| `B src/verify-runtime.js`, cwd P | ALL RUNTIME VALIDATIONS PASSED | 0 | 0.123 s |
| `B test H`, repeat-isolated-1 | **78 pass, 0 fail** | 0 | 47.454 s |
| `B test H`, repeat-isolated-2 | **78 pass, 0 fail** | 0 | 47.751 s |
| Concurrent pair: `N --test H`, parallel-node | **78 pass, 0 fail/cancelled/skipped** | 0 | 38.001 s |
| Concurrent pair: `B test H`, parallel-bun | **78 pass, 0 fail** | 0 | 70.135 s |
| `N S/bridge-errors.mjs`; `B S/bridge-errors.mjs` | Four focused bridge error/lifecycle assertions each | 0 each | 0.189 / 0.122 s |
| `N examples/adapter-interop.mjs`; `B examples/adapter-interop.mjs`, cwd P | Completed once, replay equal, `server_executions:1` | 0 each | 0.381 / 0.254 s |
| `N S/native-controls.mjs` (native-controls-final-node) | Normal WAL contention, exclusive startup lock, local lifecycle | 0 | 1.211 s |
| `B S/native-controls.mjs --without-exclusive` | Normal WAL contention and local lifecycle | 0 | 1.071 s |
| N/B `S/open-control.mjs <explicit control JSON>` | Independent Python-held exclusive lock; permission denial | 0 all four | Per-command records |
| N/B `--input-type=module -e <recorded v1 existing-open probe>` | Public STORAGE_UNAVAILABLE; no diagnostic line | 0 each | Per-command records |
| `python3 S/inspect.py`, cwd R | 28 fresh live proofs/raw rows/effect files/exits/PIDs; preservation | 0 | Tool evidence |
| `git diff --check`, cwd R | Empty | 0 | Tool evidence |

Original safety harness bytes equal `git show 1efafd1:docs/internal/046-state-probes.mjs`, SHA-256 **`95b72cd7189bb2d54685bdd3f08561ef0740f3e8399bbc04cb10a269228248eb`**. Full-suite Node is not claimed: historical Bun-only files still import `bun:test`.

### Disclosed scratch iterations, not suppressed failures

- Initial `native-controls-node` and `native-controls-bun` exit **1**: scratch assertion inspected the first event from fixture teardown (`ROLLBACK` outside a transaction), not the operation under test. Reset the event list after fixture creation; original logs remain. This changed no product/test assertion.
- `native-controls-final-bun` exits **1** when the scratch blocker itself attempts `BEGIN EXCLUSIVE`, before opening the source store under test. Normal WAL BEGIN contention had already behaved as expected. Replaced that blocker setup with an independent Python SQLite connection; **exclusive-python-node/bun both pass** with the source's first failing native call captured. Bun normal-WAL/lifecycle controls separately pass. No claim that this blocker-setup difference identifies the historical failure.
- Initial read-only historical restart inspector compared the raw registry to the entire process metadata wrapper and exited 1. Correct comparison is `final.json.registry`; all eight retained restart databases then verified. Earlier report fields were not changed to fit the scratch mistake.
- A preliminary repository-root `package.json` read exited 1; the package manifest is at P/package.json. None of these tooling iterations is a failed canonical acceptance suite.

## Observed outcomes

### Exact-source comparison and current bridge boundary

Historical 053/054 totals **422/29 files** are not the current source. Current source has **17 adapter-protocol tests**, including the inherited describe regression, and **four** conformance tests: 422 + 1 + 4 = **427/30 files**. A prior informal five-conformance-test claim is not used. The current shared total is 234, not historical 229. Historical reports remain historical; no old measured output was rewritten.

The actual bridge final handling is:

1. `send()` serialization failure settles `ADAPTER_PROTOCOL_ERROR/rejected`. Synchronous transport throw and asynchronous send-callback error both settle **`ADAPTER_CHANNEL_CLOSED/unknown`**, retaining the trusted underlying cause object. It does not copy that raw cause into canonical state.
2. Input/attributable response contract errors go through `protocolFailure`: preserve an `ADAPTER_*` code, otherwise normalize to **`ADAPTER_PROTOCOL_ERROR`**, normally rejected. A valid participant error response preserves its validated code/classification, including non-ADAPTER codes such as `UNSUPPORTED_OPERATION`.
3. Unknown request IDs and stale sessions are ignored. Matching execute replies validate run/incarnation/task/attempt/operation. `entry.done`, fresh request IDs and per-entry timer removal prevent a late A callback/reply from deleting or settling B. Focused scratch assertions exercise both send-error paths and the late callback on both runtimes.
4. **Describe has no session field**: current control handling exempts describe from the session prefilter, then validates adapter/request identity. Cancel and shutdown retain session checks. This inherited correction is exercised by the new describe regression/conformance checks, not attributed to this pass.
5. SDK `runCycle` retains claim acknowledgement → fresh authoritative check → captured invocation. Any adapter/bridge throw becomes the existing post-dispatch `ADAPTER_ERROR` outcome path; result persistence stays outside the adapter catch. Timeout/close/cancel do not prove remote nonexecution and never cause automatic retry.

### First native operations: positive controls versus the original unknown

**Historical actual failure:** surviving `S_old=/home/d/.hermes/cache/scratch/052a-a4/full-bun.log`, lines 125–157, shows the Node crash worker throwing at the coordinated store's open catch, then the harness reporting its 20-second readiness seam timeout. It has **no native errno/SQLite code/first-call trace**. S/historical-failure-verbatim.txt and S/historical-failure-provenance.json retain the actual excerpt and hash. The seam timeout is a later symptom, not proof the child was merely slow. That original first native operation remains **unknown**.

Separate trusted controls deliberately produce the same public error without untrusted payloads, SQL data, paths or raw error messages in diagnostic records:

| Controlled condition | First failed native operation / cause | Observed timing and integrity |
|---|---|---|
| Ordinary WAL writer holds `BEGIN IMMEDIATE` | Second source store **opens and reads successfully**. Its acquire fails at native **`exec('BEGIN IMMEDIATE')`**, `ERR_SQLITE_ERROR`, **errcode 5 / SQLITE_BUSY** | Node 1001.856 ms; Bun 1001.553 ms for failed BEGIN. Complete row unchanged; no acquired owner/effect. This is expected bounded contention, not proof of startup cause. |
| Independent Python connection holds WAL exclusive lock | Source open fails at native **`prepare('PRAGMA quick_check')`**, errcode **5** | Node 0.071 ms; Bun 0.066 ms for failed prepare. Open fails before busy_timeout is installed; complete control row unchanged after blocker rollback. This external exclusive-lock control is not an ordinary Chord writer and does not reproduce the historical schedule. |
| Existing source store path renamed away | **`lstat`**, **ENOENT** | Opt-in v2 diagnostic identifies syscall; existing-mode open does not recreate the missing path. Rename back and reopen preserve revision 0. |
| Existing regular file chmod 000 under actual uid 1000 | Native **DatabaseSync construction**, **errcode 14 / SQLITE_CANTOPEN**; no statement failure | Both source opens reject; separate direct constructor confirms the native cause. File permissions restored to 0600; no claim this occurred historically. |

The source startup ordering matters: exclusive create/lstat → DatabaseSync → quick_check → layout/identity read → busy_timeout/WAL/FULL setup → create layout transaction. An open-catch stack alone does not distinguish any of these. Normal WAL writer contention and an exclusive-lock startup failure have the same sanitized public code but different first operations/timing.

**Inherited diagnostics are narrower than the old report can imply.** V2 calls `sanitize` in its open catch and logs native code/errcode/syscall only when opted in; it does not label the operation. V1 has a diagnostic helper, but its open-time catch manually maps errors instead of calling `sanitized`. Actual missing-existing v1 probes under diagnostics=1 return STORAGE_UNAVAILABLE with **empty stderr** on both runtimes. Already-typed errors and COMMIT/ROLLBACK uncertainty paths can also bypass native diagnostic detail. The hook's presence in both files is not comprehensive first-operation coverage. No production diagnostics edit was made here.

### Resource, readiness and cleanup observations

- Actual host: **8 logical CPUs**, uid 1000, RLIMIT_NOFILE **4096 soft / 1048576 hard**. S/resource-summary.json has per-command before/after load, memory, swap and disk observations; S/controlled-parallel-resources.json is an additional live parallel sample. These are observations, not causal attribution or an exhaustive peak monitor.
- Full isolated run: load averages **1.541/0.734/0.398** before, **2.212/1.231/0.617** after; MemAvailable **469624 → 725268 kB**; available disk **4248182784 → 4240572416 bytes**. Memory/swap remained constrained despite a green run. Shared Node ended at load1 **7.358** and still passed. Parallel pair began at load1 **1.664**, ended at **3.712/3.482** for Node/Bun. No deliberate descriptor exhaustion, disk filling, permission loosening or unbounded stress was used.
- The two H repeats are sequential, separate from other acceptance suites. Short scratch controls/read-only evidence work occurred during the wider shared/repeat campaign; no other full/shared suite was started alongside the isolated full run. The final controlled stress is exactly **two** H runners concurrently, not an unbounded process fanout. No test timeout was raised.
- Readiness is genuine child IPC, not a fixed sleep or parent-only success flag. Suites assert spawned/self PID, four Node/Bun pairs, actual SIGKILL seams, stale owner success/throw zero-write behavior, actor identity/correlation, real adapter IPC, release fencing and replay.
- Independently read **28 fresh retained live proof databases** from these seven suite runs: complete authoritative envelope equals final/replay/reopened data; each has two exact physical effect files and two effects, revision 14, clean exit code 0/signal null for owner/actor/standby. All **84 recorded child PIDs** are absent after completion, and cleanup/reopen flags agree. **S/fresh-live-inspection.json** retains exact paths and exits. Final process scan found no remaining repository test-worker command. Temporary killed-seam/restart fixtures are cleaned by their original harnesses, not falsely described as retained proof databases.
- Product-created native-control database mode is **0600**, mkdtemp parent **0700**. S itself is 0700. Missing-file and permission controls touch only newly created scratch files. Existing `/tmp/opencode` artifacts were read/discovered only; none was modified/deleted.

### Surviving earlier evidence

S/prior-proof-handles.json records actual existence. Four `/home/d/.hermes/cache/scratch/052a-a4/live-*` directories survive: independently reopened read-only, raw envelope equals final/replay, both physical files match effect records and all role exit records are clean. Eight retained `restart-*/{approval,ambiguous}` databases equal `final.json.registry`; approval has revision 11/one continuation, ambiguous revision 7/zero continuation, distinct processes and recorded SIGKILL for the ambiguous first process. Results are **S/prior-live-inspection.json**, **S/prior-restart-inspection.json**. These are fresh inspections of historical artifacts, not newly executed historical CLIs.

The old consumer tarball `/tmp/opencode/chord-054-consumer/antistructured-chord-0.4.0-preview.1.tgz` and consumer directory also actually exist. This pass does not claim a fresh external consumer/package proof or current-source equivalence for that tarball; that belongs to its authorized later gate.

## Invariants verified

- No observed canonical corruption, unauthorized effect, duplicated effect or stale-outcome overwrite in current acceptance suites or independently inspected fresh live artifacts. This is bounded execution evidence, not formal absence of defects.
- Ordinary contention and startup/lifecycle/permission controls fail closed; control raw rows are unchanged. Local failure/timeout never establishes external effect absence or permits blind redispatch.
- Original authority, approval/attempt binding, owner-first and attempt-first fencing, generation/lease handling, historical receipts and semantic replay remain exercised by shared suites. Identifier integrity and framed session **and per-send** actor correlation regressions pass on both runtimes.
- 053 execution adapters remain separate from actor authentication, privileged host administration and canonical commits; descriptor compatibility is not a grant. The 052A and inherited 054 conformance work is preserved.
- Full tracked/untracked entry bytes, historical audit hash, branch/full HEAD and empty staged diff are preserved. JS ESM, sole pinned dependency, package/storage/protocol versions and existing safety harness bytes are unchanged.

## Remaining risks

1. **UNRESOLVEDP2: original intermittent startup native cause.** No current acceptance failure recurred; that is not enough to identify original SQLite contention versus file lifecycle, permission, resource exhaustion or another native open failure. The historical report's load-consistent classification lacks causal proof. Do not call the new exclusive-lock control the historical root cause.
2. V1 startup diagnostics omit the open catch, and current generic native fields do not identify first operation. A recurrence should capture the first native failure before cleanup and the child's actual exit alongside readiness timing, using bounded trusted instrumentation and no payload/raw-secret logging. Do not merely increase the 5-second/20-second limits.
3. Startup quick_check/layout/identity reads precede busy_timeout. The exclusive-lock control positively demonstrates immediate SQLITE_BUSY there; changing initialization order/retry policy is a separate deliberate design/regression decision, not justified as an automatic correction to an unproven historical event.
4. Host memory/swap/disk are still constrained. These measurements do not certify deterministic CI timing, worst-case resource capacity, all operating systems/runtimes or absence of future readiness failures. Existing trusted local-file/clock/host and non-atomic remote-effect limitations remain.
5. Historical/scratch evidence can be pruned; the source inventory, exact commands, outcomes and causal limitations are retained here and indexed under S. No external packaging, publication or independent final-review gate was performed.

## Next gate

**Pass1 execution complete; current gate UNRESOLVEDP2, not RESOLVED or a proven environmental CLASSIFIED.** Parent should read this artifact and S/command-summary.json. No critical state/effect reproduction requires a BLOCKED safety stop, but causal closure of the historical reliability observation is not established. Next readiness is a Pass1 reliability disposition/capture decision, **not automatic Pass2 entry**. Only Pass1 was executed. If the parent accepts the retained P2 as a documented limitation rather than requiring first-operation closure, that must be an explicit gate decision; it is not inferred from the 427 green tests or the older historical report.
