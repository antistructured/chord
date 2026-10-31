# Block 054 — bounded Pass 6 reliability followup

## Pass

Pass 6 reliability followup only; **UNRESOLVED P2**, not RESOLVED or CLASSIFIED. The predeclared fresh campaign passed, including default-mode final gates, but did not reproduce the historical startup exception. No production/test correction is justified by this evidence. No Pass 7 or Block 055 execution occurred. Prior reports and their failed-gate conclusions remain intact.

## Agent

Focused reliability subagent. Repository R = `/home/d/Workspace/other-projects/chord`; package P = `R/packages/core`. Independently observed HEAD `72f96ab6cdc9d6948ffb7eacba527cc27a32a8be`, Node **24.22.1**, Bun **1.4.3**. Extensive inherited 052A/053/054 dirty work preserved.

Evidence S = `/home/d/.hermes/cache/scratch/054-reliability-followup-1793473063259058152`. Scratch campaign driver D = `/home/d/.hermes/cache/scratch/054-reliability-followup.py`; controlled-contention driver E = `/home/d/.hermes/cache/scratch/054-followup-contention.py`. D SHA-256 `80e184dfe967de60a330b643808ea53102ab1fa7584f06ac75b047366b61bb68`; E SHA-256 `b10a3637c245a12a2012afe83a072a641f4df6176ad5ae2be2e5850bb5f8d6a1`.

## Files inspected

Read all of `054-errors-and-diagnostics.md`, the parent `054-reliability-disposition.md`, both P6 default shared-Bun failure stacks, current diagnostic wrapper and both store startup paths, `coordinated-adversarial.test.js` and its worker, both timed test bodies in adversarial/dispatch tests, actor fixture, process-recovery and two-process tests, and relevant child-launch code in their examples. Read P6 tested-source map and cleanup evidence. Historical evidence H = `/home/d/.hermes/cache/scratch/054-pass6-1793471525983911034` remains untouched.

## Files changed

- Added this report only inside R. No production source, tests, dependencies, manifests, timeouts, assertions or previous reports changed.
- Scratch only: D, E, S logs/ledgers/hash inventories; isolated `S/early-timeout-variant/src` containing a proposed v2 early-busy-timeout comparison. That variant is **not** installed into R and is **not** the source of final gate results.
- Recorded the reusable investigation procedure in the existing profile skill `owner-cas-mutation-testing`, outside R.

## Exact first-failure facts and harness assessment

1. `H/shared-bun.log:141–150` and `H/final/shared-bun.log:141–150` show the first application exception: `CoordinationError: STORAGE_UNAVAILABLE`, `path:'$'`, `commitStatus:'not_committed'`, from `sanitize` → `openCoordinatedSqliteStore:131` → `createCoordinatedChord:23` → `coordinated-adversarial-worker.js:11`. It is the **crash worker's constructor**, before owner acquisition or the requested seam, not the restorer's assertion. The later `seam timeout` is secondary. Neither historical run enabled native diagnostics; **first native operation/errcode/errno are unknown**. The stack cannot distinguish native open/read/PRAGMA failures or a pure startup verification rejection.
2. Both logs show successful Bun→Bun `renew` evidence immediately before the failure. The fixed loop order is `renew,intent,effect,result`; consequently the next crash-worker startup was for **intent**. The failed worker PID was not printed. Each point uses a new `actorFixture()` database, with the fixture's store explicitly closed before fork. Thus the failing first startup was not reopening the *same fixture* after its own SIGKILL; attributing it to same-database crash recovery is unsupported.
3. Worker fork uses `stdio:['ignore','pipe','pipe','ipc']`; a stderr data listener drains the pipe into a string, which the readiness error includes. Child diagnostics inherit the launch environment (fork does not replace `env`). This campaign enabled `CHORD_STORAGE_DIAGNOSTICS=1` **at parent launch**, including actual workers from their first storage call, in every on-row. No trace was enabled only after a failure.
4. A real harness limitation exists: the readiness promise listens to `message` and `error`, but not early `exit`. A constructor crash therefore waits the full 20 seconds before reporting captured stderr. This explains the **delay in reporting**, not the native storage exception. Normal SIGKILL paths await child exit; the exceptional `finally` kills without awaiting exit before fixture removal. That failure-path cleanup could race with a still-exiting worker, but the next point uses a unique directory. No evidence connects it to the observed startup. No harness patch was landed without a targeted red/green regression.
5. Both five-second failures are in-process, deferred-promise authority/replay tests, not child-readiness waits. The consumed-approval case performs approval admission, dispatch, transfer, reconciliation/readmission, denied dispatch, stale callback and full-row/replay comparisons. The same-generation case repeats a full old/fresh-attempt sequence for both success and throw. Neither declares an integration timeout; Bun applies its 5000 ms default. Historical times were **5464.39 ms** and **5173.77 ms**. Current four focused Bun rows measure the former **1724.74–1772.39 ms**, the latter **1597.10–1654.87 ms**. Final full/shared Bun measure **1670.40/1678.07 ms** and **1509.14/1591.27 ms**, respectively. These establish variable observed completion times, not the cause of the old overruns. Synchronous validation/replay dominates the inspected control flow; no forgotten child wait is present in these two bodies. A future *test-specific* integration budget may be reasonable, but increasing it now would not diagnose the historical failures. No blanket timeout increase, assertion relaxation or timer suppression occurred.

## Test commands

D predetermined **two rounds**, each Node off/on then Bun off/on, of these four process-heavy files F: `coordinated-adversarial`, `coordinated-dispatch`, `process-recovery`, `two-process-coordination` (`./tests/<name>.test.js`). There were no success-dependent retries. Node commands use `N --test F`; Bun commands use `B test F`. Diagnostics-off rows explicitly remove the environment variable; on rows explicitly set it to `1`. N = `/home/d/.volta/tools/image/node/24.22.1/bin/node`; B = `/home/d/.bun/bin/bun`.

Then D ran these final commands **sequentially**, with diagnostics disabled, on unchanged source:

| Command, cwd P unless specified | Exit | Observed result / wall time |
|---|---:|---|
| Eight focused off/on rows, four files each | 0 each | **45/0 each**, 360 aggregate test executions; 31.443–55.279 s per row |
| `B test` | 0 | **459 pass / 0 fail**, 1781 expect calls, 33 files; 97.471 s |
| `N --test C` | 0 | **266 pass**, zero failures/cancellations/skips; 63.608 s |
| `B test C` | 0 | **266 pass / 0 fail**, 17 files; 96.717 s |
| `N --test ./docs/internal/046-state-probes.mjs`, cwd R | 0 | **21 pass**, zero failures/cancellations/skips |
| `B test ./docs/internal/046-state-probes.mjs`, cwd R | 0 | **21 pass / 0 fail** |
| `N src/verify-runtime.js`; `B src/verify-runtime.js` | 0 each | All runtime validations passed |
| `git diff --check`, cwd R | 0 | No whitespace errors |
| `python3 E`, cwd R | 0 | Eight asserted native contention controls, detailed below |

C is exactly: `actor-ingress`, `adapter-conformance-fixture`, `adapter-conformance`, `adapter-protocol`, `authority-continuity`, `coordinated-adversarial`, `coordinated-dispatch`, `coordinated-storage`, `crash-recovery`, `durable-adversarial`, `error-boundaries`, `identifier-integrity`, `ipc-correlation`, `process-recovery`, `storage-adapter`, `storage-diagnostics`, `two-process-coordination`, each as `./tests/<name>.test.js`. Exact argv/cwd/diagnostics/exit/seconds and full logs are in `S/commands.json` (17 commands, including entry status and diff check); controls are in `S/contention-controls.json`. The brief E control process overlapped the first diagnostic Node focused row; no load-isolation claim is made for that row. E finished before the remaining focused rows and all final gates.

## Exit codes

**No suite, verifier, safety or control command failed in this followup.** All failed historical commands remain failures, including P6 default shared Bun's 265/1 plus outer 124 and frozen-source 263/3 exit 1; this campaign does not replace them. One read-only inspection Python one-liner failed with `SyntaxError: unexpected character after line continuation character` (exit 1), then was corrected; it did not run or modify product code. Background `wait` polling windows elapsed while the campaign remained active; those are not command exits or test failures. The campaign itself completed exit 0 without reaching its 600-second per-command outer budget.

## Controlled startup-order comparison

E uses a **valid nonempty v2 fixture**, including accepted work, closes the product handle, and independently holds SQLite locks with Python. Every scenario compares the entire `SELECT * FROM chord_coordination` row before and after. All eight row comparisons passed. This is a privileged external-lock mechanism control, not a claim that supported product traffic takes an exclusive read-blocking lock.

| Lock / source | Node observed open ms | Bun observed open ms | Outcome |
|---|---:|---:|---|
| Ordinary WAL `BEGIN IMMEDIATE`, current source, release after 150 ms | 48.34 | 151.04 | Startup succeeds, unchanged row |
| WAL `locking_mode=EXCLUSIVE` + `BEGIN EXCLUSIVE`, current source, release after 150 ms | 5.04 | 3.81 | Immediate sanitized `STORAGE_UNAVAILABLE`; **first native `sqlite.quick_check`, errcode 5, errno null** |
| Same exclusive lock, scratch early-timeout variant, release after 150 ms | 255.73 | 253.13 | Startup succeeds, unchanged row |
| Same exclusive lock, scratch variant, release after 1400 ms | 1004.73 | 1004.57 | Bounded sanitized failure; **first native `sqlite.quick_check`, errcode 5, errno null** |

The scratch variant moves only `PRAGMA busy_timeout=1000` immediately after native open, ahead of first SQL; it removes the later duplicate. It leaves identity/layout checks before journal/synchronous changes and preserves transaction statements, schema and the 1000 ms native wait bound. No application retry is added. The current-source row is a red behavioral control for the proposed transient-exclusive-lock improvement; both runtimes turn green for the released-lock variant and retain failure for the over-budget lock. Later `sqlite.rollback`/errcode 1 is retirement noise, not the first failure.

**Decision: do not land this candidate.** Ordinary supported WAL writer startup succeeds in the control. The external exclusive-lock scenario does not establish a supported concurrent-startup defect, and none of the actual child matrix runs reproduced the exception. Installing it as a historical fix would exceed the evidence. If a future actual-child recurrence identifies startup `sqlite.quick_check`/BUSY, this tested narrow candidate and its bounded negative control are available for review; fresh product regressions and all gates would then be required. V1 startup has the same late-timeout ordering by inspection, but this new early-timeout experiment is **v2-only**, not a claimed v1 regression result.

## Observed outcomes

- The eight focused rows execute all four runtime crash/restore pairs at all four seam points: **128 successful actual SIGKILL point scenarios**, plus independent recovery, live child coordination and callback/effect tests. No actual constructor startup exception recurred. These finite passes do not establish a failure rate or causal closure.
- Opt-in focused logs contain **532** parsed native records: 484 cleanup ROLLBACK/errcode 1, and 16 each COMMIT/ROLLBACK/close with numeric fields null from existing injected-error cases. No native startup failure was observed. `S/focused-analysis.json` retains records and named-test timings. Native trace labels intentionally omit raw messages, paths and SQL; no untrusted wire shape was changed.
- Final full/default shared gates now pass on the same source as P6. This is fresh acceptance evidence, not a diagnosis of the earlier failed commands and not permission to retry failures away.
- Initial independently observed resources: disk **99%**, **3.8 GB** available; memory **793 MB** available with swap used. Postcampaign observation: disk still **99%**, **3.8 GB** available; memory **1177 MB** available. Each command's resource/process snapshot is retained. These are context only, not causal attribution or a resource-pressure exception to supported behavior.

## Invariants verified

- `S/entry-hashes.json`, `exit-hashes.json` and `preservation.json` show **no existing repository file changed and no file added during execution**. The report is added after those gates. Independently compared all **110** entries from P6's tested-source map: zero mismatches (`S/pass6-source-correspondence.json`). Final gates therefore test the actual P6 production/test bytes, not the scratch variant.
- Existing safety probe SHA-256 remains `95b72cd7189bb2d54685bdd3f08561ef0740f3e8399bbc04cb10a269228248eb`. Current Node/Bun assertions cover full-row stale/auth/receipt rejection, replay equality, owner fencing, once-only/no-redispatch behavior, COMMIT uncertainty and adapter protocol safety. This is executed coverage, not a remote-effect atomicity claim.
- Successful crash paths await termination; live coordination tests explicitly assert all child PIDs gone, zero exit statuses and independent reopen equality. Postcampaign `S/worker-cleanup.json` finds no matching adversarial/dispatch/process-recovery/two-process runtime worker. No unrelated processes were killed, and no broad scratch cleanup occurred. The temporary control fixture alone was removed after row checks.
- No production timeout, retry, lease, SQL/schema, authority, receipt, canonical/wire, transaction/effect semantics changed. No reset/clean/stash/stage/commit/push/tag/version/dependency/publication operation occurred.

## Remaining risks

**Root-cause status: UNRESOLVED P2.** Both historical default shared-Bun constructor failures still lack native provenance. The reporting delay is explained by a harness limitation, not the failure itself. The exclusive-lock experiment proves one different mechanism only. Five-second overruns did not recur; their cause remains unproved. No P0/P1 canonical-state, authority, stale-overwrite or duplicate-effect violation was established, so there is no new P0/P1 safety stop. Any recurrence establishing one must stop progression immediately.

Scratch evidence is not a permanent release archive. Preserve its existing logs, commands, resource snapshots and hashes before cache expiry; package/install correspondence still requires the designated later gates. No conformance certification or Block 054 COMPLETE claim follows from this report.

## Next gate

**Parent decision required; Pass 7 is not automatically unblocked.** Recommendation: the parent may explicitly renew a *development-only* bounded P2 deferral and permit Pass 7 using these passing fresh gates, while retaining UNRESOLVED P2 and withholding Block 054 COMPLETE/release authorization. Without that new disposition, the P6 BLOCKED gate remains in force. This does not silently extend the older Pass 1→2 disposition.

Release-critical gate proposal: on frozen final supported source/artifact, retain a new immutable evidence directory, runtime versions, entry/exit source hashes and all first-failure logs; run the same fixed two-round off/on F matrix followed by **default full Bun, default shared Node, default shared Bun, both safety probes and both verifiers sequentially**. No diagnostic-on run may substitute for a failed default row. The already exercised exact campaign command is:

```sh
cd /home/d/Workspace/other-projects/chord
python3 /home/d/.hermes/cache/scratch/054-reliability-followup.py
python3 -c "import json,pathlib; s=pathlib.Path(pathlib.Path('/home/d/.hermes/cache/scratch/054-reliability-followup-location').read_text()); rows=json.loads((s/'commands.json').read_text()); assert len(rows)==17 and all(r['exit']==0 for r in rows), rows; print('ALL 17 LEDGER ROWS ZERO:',s)"
```

The explicit ledger assertion was executed against this completed campaign and exited 0. D deliberately records all rows even after a failure; **D's process exit alone is not the gate verdict**. The ledger assertion is required to reject any failed/partial campaign.

D makes a new nanosecond-named evidence directory on every execution, never overwrites an earlier campaign, records every exit and uses bounded 600-second command budgets without changing product/test timeouts. Its exact argv are also preserved in this report's F/C definitions and `S/commands.json` if the scratch driver is no longer available. Preserve this driver with the evidence before cache expiry; do not treat a missing driver as a reason to skip a gate. For release use, accept only a complete all-zero ledger with unchanged final bytes and explicit remaining-risk disposition; a failure reopens diagnosis, not another success-seeking retry. Final installed-package proof must independently bind the later artifact to the tested source. **No Pass 7/055 performed here.**
