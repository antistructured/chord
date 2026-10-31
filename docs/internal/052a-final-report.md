# Block 052A — A4 independent final reverification

## Pass

**A4 COMPLETE. Block 052A COMPLETE. Final Block 052 engineering acceptance: COMPLETE within the existing bounded local threat model. F1 and F2 are corrected, independently reproduced red on controlled unfixed source, and green on the preserved correction tree. 053 ENTRY is explicitly authorized; no B1 implementation is performed here.** Publication remains separately unauthorized.

Repository R=`/home/d/Workspace/other-projects/chord`, branch `base`, HEAD `72f96ab6cdc9d6948ffb7eacba527cc27a32a8be`. This is acceptance of the **dirty A2+A3 working artifact**, not a claim that those changes are committed. Entry contained 28 changed/untracked paths. All 572 entry files in `git ls-files --cached --others --exclude-standard` were SHA-256 captured before work and remain byte-identical. A4 adds only this report. No source/test correction was needed or made.

P=`R/packages/core`; S=`/home/d/.hermes/cache/scratch/052a-a4`; N=`/home/d/.volta/tools/image/node/24.22.1/bin/node`; B=`/home/d/.bun/bin/bun`. Actual runtime version commands returned v24.22.1 and 1.4.3, exit 0. Scratch evidence is inspectable but prunable. The first full-suite run had one real failure; the unchanged isolated final rerun passed. The failure and its uncertain cause are retained below, not erased by the acceptance verdict.

## Agent

**independent-review-agent**, delegated A4 only. Loaded `repository-documentation-verification`. Read the full historical committed independent audit and full A1/A2/A3 reports; independently reviewed the actual working diff and complete changed source/new test files, then reconstructed red controls and ran current gates. Earlier pass reports remain historical evidence, not overwritten final verdicts. Recorded a reusable same-wrapper/per-send identity and expanded inherited-ID verification lesson in that existing default-profile skill outside the repository.

## Files inspected

- Entire `docs/internal/{052-committed-independent-audit,052a-root-cause-report,052a-identifier-integrity,052a-ipc-correlation}.md`.
- Every A2/A3 source and test path in the full inventory below, package README diff, complete new `actor-transport.js`, both regression suites and the actual IPC worker. Also traced unchanged coordination contracts, command authorization, combined replay, own-aware history patching, contract cloning/reference validation and coordinated SQLite open/owner/transaction/outcome boundaries. Reviewed the actual SIGKILL worker/test when the first full run failed.
- Regenerated and reviewed all 308 bracket-access candidate lines across current source: S/indexed-lookups.txt. This includes assignments, deletes, arrays, fixed enums and own-enumerated fields, not just suspect reads. Remaining domain indexed writes follow installation or exact identity validation; contract/replay reads are dominated by own-reference checks. Authorization collections use arrays/Map. No universal arbitrary-host-object hardening claim is made.
- Actual emitted test logs, original-source control bytes, final command records, standalone proof SQLite rows, linked results/attempts/receipts, replay/reopen snapshots, process records and physical artifacts. Inventory universe has 55 source JS, 39 test/worker/fixture JS, four example MJS, zero TypeScript. Manifest remains JS ESM, version 0.4.0-preview.1, sole runtime dependency `@weipertda/sigiljs` exactly 0.18.0. Entry hashing preserves manifests, lockfiles, original tests/examples and all unrelated source.

## Files changed

**A4 created only `docs/internal/052a-final-report.md`.** No production, test, README, manifest, lock or historical evidence edit. No dependency installation, reset/clean/stash/stage/commit/push/tag/publish, no 053 implementation.

Full final changed-path inventory relative to HEAD (including pre-existing untracked historical evidence, not attributed to A4):

```text
 M packages/core/README.md
 M packages/core/src/coordination/commands.js
 M packages/core/src/coordination/runtime.js
 M packages/core/src/coordination/state.js
 M packages/core/src/platform/adapter-routing.js
 M packages/core/src/platform/attempts.js
 M packages/core/src/platform/handoff.js
 M packages/core/src/platform/reconciliation.js
 M packages/core/src/platform/runtime-loop.js
 M packages/core/src/platform/state-invariants.js
 M packages/core/src/platform/task-queue.js
 M packages/core/src/platform/transitions.js
 M packages/core/src/registry/owner.js
 M packages/core/src/registry/registry.js
 M packages/core/src/registry/snapshot.js
 M packages/core/src/runtime/actor-client.js
 M packages/core/src/runtime/actor-ingress.js
 M packages/core/src/sdk/chord.js
 M packages/core/src/sdk/coordinated-chord.js
?? docs/internal/052-committed-independent-audit.md
?? docs/internal/052a-identifier-integrity.md
?? docs/internal/052a-ipc-correlation.md
?? docs/internal/052a-root-cause-report.md
?? packages/core/src/runtime/actor-transport.js
?? packages/core/src/utils/own.js
?? packages/core/tests/identifier-integrity.test.js
?? packages/core/tests/ipc-correlation-worker.js
?? packages/core/tests/ipc-correlation.test.js
?? docs/internal/052a-final-report.md
```

There are 29 final changed/untracked paths: 19 modified existing paths and ten untracked paths, including this report. S/entry-hashes.json and S/preservation.json retain entry and same-byte red-control hashes; S/final-preservation.json records the final whole-tree comparison. S contains the independent runners, isolated original/unfixed-client trees, logs, commands, expanded-ID and actual-IPC challenges, framed historical-receipt probe, raw SQLite rows and artifact inspections. These are not repository edits.

## Design decisions

### F1: original root cause, exact correction and supported-ID integrity

**Original defect: P2 availability/accepted-input bug.** Ordinary dictionaries survive cloning and JSON restore. Absent `pending_attempts[taskId]` for valid inherited-member IDs therefore yielded Object.prototype functions. The coordinated shell/planner and shared legacy helper truthiness checks mistook those functions for installed reservations. `Attempt.assert`/cloning failed before dispatch; ready ordering repeatedly selected the same task and starved later runnable work. Real own approval reservations masked the defect. This was not an authorization bypass and was not an accepted ID restriction.

**Correct fix:** dependency-free pure `own(object,key)` in `src/utils/own.js`, using `Object.hasOwn` with null as absence. Both coordinated shell reservation selection and pure `planClaim` now use it; the planner reads the reservation once. Shared pending/active/task/operation lookups, legacy SDK/owner/result/reconciliation/import boundaries, artifact/domain initialization/results and router presence use the same policy. Remaining bare mutations operate only after own installation/exact referential validation. Own null/false/zero/undefined values are not made into valid records; no new generic-map presence semantics are claimed.

There is no new reserved-ID rule, null-prototype storage representation, queue skip, automatic retry or journal change. `toString`, `valueOf`, `hasOwnProperty` remain accepted; `constructor`, `__proto__`, `prototype` remain rejected with original INVALID_COMMAND/not_committed and unchanged full rows. The historical legacy missing-handoff incidental error normalization (INVALID_TRANSITION to INVALID_CONTEXT) is documented in A2; it is not hidden as byte-identical error behavior.

Permanent 26-test suite independently passes on both runtimes. Its eight coordinated ordinary/three-member × absent/present approval cases submit through authenticated production ingress, preserve exact receipt duplicates, reopen persisted state, execute the selected task and a later unrelated queued task once each, verify exact reserved approval consumption, perform no-write repeated cycles, combined replay, JSON round trip and reopen. It additionally checks missing/duplicate task IDs, repeated outcomes-ID rejection, operation-signature uniqueness, legacy helper/approval/dispatch, nested operations, router precedence and absent/present artifact/domain references.

**Independent extension:** S/expanded-identifiers.test.mjs mechanically expands the same behavior assertions to every allowed own name of the runtime's Object.prototype: `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toString`, `valueOf`, `toLocaleString`; plus ordinary control, `undefined`, `null`, `0`, `é`, and a 128-character identifier. **86 pass on each runtime**, including 32 coordinated two-task cases and 32 legacy public cases. This tests the complete default inherited-member family, not every possible accepted string or every optional helper-derived ID length. Source-level own access preserves the full accepted-ID domain without narrowing; finite tests are not an exhaustive proof of every ID string.

### F2: original root cause, exact correction and response/error contracts

**Original defect: P2 delivery association/lifecycle bug.** One anonymous pending slot accepted any parseable actor-response protocol message. Closing a wrapper left genuine old replies in flight. Replacement B, including an identical repeated read, could resolve with A's response. A delayed A send-error callback also cleared B's slot. Canonical authentication/receipt storage was not bypassed; the caller's promise association was wrong.

**Correct fix:** the client emits exact versioned ephemeral request frames carrying fresh UUIDv4 `session_id` per wrapper and `request_id` per send. The host `attachChild` unwraps only validated request frames and echoes these identities around the unchanged canonical response. The direct canonical `handleAuthenticated(context, commandJSON)` API remains unchanged. Neither nonce enters authority, adapters, receipts or persistent history.

Response validation is actually shared and exact via Sigil: bounded wire strings before parse, recursive/plain-data budgets including the frame, exact UUID frame shape, existing SuccessResponse plus type-specific `validateCommandResult`, and new exact RejectionResponse. Success matches operation/run/incarnation/correlation/causation to detached pending command. Rejections intentionally have no run/incarnation fields; non-null operation/correlation/causation must match, while all-null prevalidation/authentication failures are attributable only by matching outer delivery. Extra/missing fields, wrong result/type and mixed null identity reject locally when attributable. No fabricated canonical status or success is returned. Unattributable/oversize/invalid JSON is ignored; a matching malformed frame yields ACTOR_PROTOCOL_ERROR.

A module-private WeakMap enforces exclusive wrapper use of the exact channel object. Settlement compares the exact captured pending object, clears only its timer/slot, and is once-only. Close/disconnect/close-event retires wrapper, releases ownership and removes all listeners; old callbacks cannot clear a replacement/new request. Optional timeout validates integer 1..2147483647, defaults null, abandons only acknowledgement and never retries. Local error/timeout/disconnect is not evidence of canonical non-commit.

**Actual IPC and lifecycle evidence:** permanent 24-test suite passes on both. Two actual separate-child cases hold genuine production-ingress reply A, close A's wrapper, create B on the same inherited channel, admit an intervening task, then release A twice before B. Distinct result types with otherwise same identities and the exact identical repeated read both return B's genuine snapshot. PIDs equal spawned PIDs; post-setup full authoritative rows remain unchanged through delivery. Unit transport controls cover reordered duplicates/unknown requests, five canonical identity mismatches, malformed success/rejection/frame, null-ID errors, exclusivity, pending rejection, detached caller input, late A send callback, synchronous send throw, disconnect/close/replacement, timeout/no retry and timeout after a genuinely committed write with original receipt recovery.

**Novel independent actual-IPC challenge:** S/independent-ipc.mjs uses a separate real child on the **same wrapper/session**, lets A time out locally, admits a task, then sends the identical read B. Genuine A is delivered twice before B; only fresh request identity distinguishes them. A snapshot has zero tasks, B has one; no retry and exactly two sent requests; full rows before/after delivery equal. Pass Node child PID 182586 and Bun child PID 184105; full frames/notices/raw rows retained in S/independent-ipc-{node,bun}.json. This rules out a session-only fix that replacement tests alone could miss.

**Novel historical receipt challenge:** S/historical-frame.mjs actually commits under generation 1, releases/closes, opens a fresh store handle and acquires generation 2, replaces the wrapper, rejects a de-enrolled channel, then freshly reattests it. Framed exact retry returns the complete original generation-1 success unchanged, without rewriting the full row. Additional rejection correlation/causation mismatches and extra-field/invalid-UUID frame negatives reject. Both runtimes exit 0; S/historical-frame-{node,bun}.json retains frames/full rows. No current-generation/revision refresh was invented.

### Compatibility decision verified, not implied

The package README explicitly states **default IPC wire bytes intentionally change**. New framed clients cannot transparently talk to old raw-only hosts or injected mocks that do not echo frames. There is no silent downgrade. Host `attachChild` explicitly retains raw `chord.actor-command.v1` peers and raw canonical responses; their correlation/retirement remains the peer/host's responsibility and is outside the corrected guarantee. Actual four runtime-pair live proofs exercise new default framing and existing raw negative peers. Whole-frame budgets can reject near-limit canonical documents that direct canonical ingress accepts. JS facade/canonical objects, authentication/authorization, durable receipt identity and semantic replay remain unchanged. This is a documented transport compatibility change, not an invisible storage migration or new authentication guarantee.

## Tests run

Exact expanded argv/cwd/exits/logs are retained in **S/commands.json**, **S/full-bun-isolated.json**, **S/process-commands.json**, **S/independent-commands.json**, **S/extra-final-commands.json**. All command records are fresh A4 execution, not historical totals. Runners: `python3 S/run-gates.py`, `python3 S/run-process-proofs.py`, `python3 S/run-independent.py`, and `python3 S/deep-inspect.py`. The gate runner's own exit 0 only means records were written: it did not conceal the first full-suite exit 1. Counts overlap and are not summed.

| Gate | Final observed result | Exit |
|---|---|---:|
| `B test`, cwd P, isolated final rerun | **406 pass / 0 fail / 1738 expect calls / 28 files** | 0 |
| Original 052 five shared suites, N/B | **81 pass each** | 0 each |
| Original 051 five shared suites, N/B | **82 pass each** | 0 each |
| F1 `tests/identifier-integrity.test.js`, N/B | **26 pass each** | 0 each |
| F2 `tests/ipc-correlation.test.js`, N/B | **24 pass each** | 0 each |
| Original unchanged 6A safety, N/B | **21 pass each** | 0 each |
| `N src/verify-runtime.js`; `B src/verify-runtime.js`, cwd P | ALL RUNTIME VALIDATIONS PASSED | 0 each |
| Expanded inherited-ID challenge, N/B | **86 pass each** | 0 each |
| Independent same-wrapper timeout/identical-read actual IPC, N/B | Snapshot/request identity/full-row/PID assertions pass | 0 each |
| Historical receipt generation-transfer framing challenge, N/B | original response and full row unchanged | 0 each |
| Four live + four sequential restart standalone commands | Eight actual CLIs pass | 0 all |
| Read-only SQLite/artifact inspection | 12 actual databases plus full v2 header/process checks | 0 |
| Original F1 source control, N/B | **8 pass / 18 behavioral fail each** | **1 each, expected red** |
| Unfixed-client selected F2 control, N/B | **0 pass / 16 behavioral fail each** | **1 each, expected red** |
| `git diff --check`; `git diff --cached --stat` | empty, no staged changes | 0 each |

Full historical suite imports bun:test; no full-suite Node claim. Safety bytes independently equal `git show 1efafd1:docs/internal/046-state-probes.mjs`, SHA-256 `95b72cd7189bb2d54685bdd3f08561ef0740f3e8399bbc04cb10a269228248eb`.

### Same-byte controlled red evidence

S/original was newly reconstructed from `git archive HEAD`, not copied from a prior review run; every original source file was byte-compared with `git show HEAD:<path>`. Only the new identifier test was copied, dependencies symlinked. Final regression SHA-256 on both trees is `ac9f2a96ee980eed4a1a2d85a3c95bcc59606767b7e7998a7111ed860844458e`. Both runtimes give 8 pass/18 fail, not parse/import/fixture failures or timeouts. The three unreserved inherited-member tasks fail production Attempt cloning, ordinary/approval controls pass; related helpers/router/result-reference failures are behavioral assertions.

S/unfixed-client was newly copied from the current tree with **only** actor-client.js restored byte-for-byte from HEAD. New host framing and A2 remain. Exact same IPC test bytes SHA-256 `94ead7aa6199e9241e8f2f0c4936b0dae895a7d9512d74bcfdeff822af10d58d` use their explicit legacy-wire test adapter, so old-client failure is not just frame incompatibility. Pattern `exclusive wrapper|A gets A|matched invalid|matched malformed|unframed/|rejection identity|actual child late` selects terminating behavior cases. Both runtimes produce 0 pass/16 fail; Bun filters eight others, Node has no selected cancellation/skips. Actual child cases fail B's outcomes/snapshot assertions; old client does accept genuine stale A. No checkout mutation and no test weakening.

### Initial failures and rerun disposition

1. First `B test` ran alongside other gates, then additional independent proof load: **405 pass / 1 fail**, exit 1. One existing SIGKILL Node→Bun case's Node worker exited at store construction with sanitized STORAGE_UNAVAILABLE; harness subsequently reported its 20-second seam timeout. The underlying SQLite/OS reason was not exposed by the sanitizer and is **not proven**. No false claim of a definite CPU/lock cause. Both independent 052 shared suites passed, and the exact unchanged full suite rerun in isolation gave 406/0, exit 0. This is a retained intermittent process-startup/test-reliability observation, not evidence of F1/F2 returning or a waived assertion. No source/test timeout was changed by A4. Investigate if recurrent; acceptance does not promise every environmental open succeeds.
2. Initial scratch historical-generation probe tried reacquiring a deliberately retired released store handle and correctly got OWNER_LOST on both runtimes. Corrected **only the probe composition** to close/reopen a new handle/ingress, preserving the product's fixed-handle rule; final probe passes. S/extra-commands.json preserves both failed runs separately from final commands.
3. One optional artifact lookup asked for nonexistent restart `processes.json`; actual files are `first-process.json` / `second-process.json`. Discovery and final deep inspection use actual files. No production failure or missing required evidence was hidden.

### Standalone proofs, raw SQLite, replay and physical artifacts

For every ordered `(X,Y)` in `(N,N),(N,B),(B,N),(B,B)`, cwd P:

```text
X examples/two-process-coordination.mjs S/live-<x>-<y> X Y
X examples/process-recovery.mjs S/restart-<x>-<y> Y
```

All eight exit 0, with distinct actual processes and PID checks, not in-memory reopened copies. Exact expanded commands below and S/process-commands.json. Read-only Python sqlite3 opened actual files and retained `independent-raw-row.json` in each of four live and eight restart scenarios. S/process-inspections.json and S/deep-process-inspections.json retain inspection results.

| Live pair | Owner PID | Actor PID | Standby PID |
|---|---:|---:|---:|
| Node/Node | 176300 | 176334 | 176367 |
| Node/Bun | 176306 | 176341 | 176360 |
| Bun/Node | 176831 | 176898 | 176959 |
| Bun/Bun | 176932 | 176979 | 177021 |

Every live full header equals parsed authoritative envelope identity/revision/floor/lease/generation/commit; envelope equals final, replay and independent reopen. Revision 14, generation 1, six receipts, two completed exact attempts/results, matching task/operation linkage, consumed approval tied to an actual attempt. Two ledger effects have owner PID and exact physical effect-file contents. Owner/actor/standby clean exit PID/code/signal records match; standby denial leaves row unchanged and simultaneous liveness is asserted. These fixed-clock 100 examples are not elapsed-time expiry evidence.

Each restart pair has approval final revision 11 / one continuation call / 28 events / three rejected stale or absent sessions, and ambiguous final revision 7 / zero continuation calls / 20 events. Actual first process in ambiguous scenario was SIGKILL; second process differs and exits 0. Parsed SQLite matches final registry, reopened state has same run identity and is correctly intermediate before continuation, committed effects persist; ambiguous work is not redispatched. SIGKILL does not certify hardware power-loss durability.

### Exact expanded command ledger

The following literal argv entries are generated from this pass's retained records. Cwd P unless marked R or an explicit control directory. Deliberate red exits are expected evidence, not green acceptance commands; first failed full command remains separate from final isolated result.

| Label | Cwd | Literal command | Exit |
|---|---|---|---:|
| `full-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun test` | 1 |
| `052-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js` | 0 |
| `051-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 |
| `identifier-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test tests/identifier-integrity.test.js` | 0 |
| `ipc-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test tests/ipc-correlation.test.js` | 0 |
| `original-identifier-node` | `/home/d/.hermes/cache/scratch/052a-a4/original/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test tests/identifier-integrity.test.js` | 1 |
| `safety-node` | `/home/d/Workspace/other-projects/chord` | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test ./docs/internal/046-state-probes.mjs` | 0 |
| `verifier-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node src/verify-runtime.js` | 0 |
| `unfixed-client-node` | `/home/d/.hermes/cache/scratch/052a-a4/unfixed-client/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test --test-name-pattern 'exclusive wrapper|A gets A|matched invalid|matched malformed|unframed/|rejection identity|actual child late' tests/ipc-correlation.test.js` | 1 |
| `052-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js` | 0 |
| `051-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 |
| `identifier-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun test tests/identifier-integrity.test.js` | 0 |
| `ipc-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun test tests/ipc-correlation.test.js` | 0 |
| `original-identifier-bun` | `/home/d/.hermes/cache/scratch/052a-a4/original/packages/core` | `/home/d/.bun/bin/bun test tests/identifier-integrity.test.js` | 1 |
| `safety-bun` | `/home/d/Workspace/other-projects/chord` | `/home/d/.bun/bin/bun test ./docs/internal/046-state-probes.mjs` | 0 |
| `verifier-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun src/verify-runtime.js` | 0 |
| `unfixed-client-bun` | `/home/d/.hermes/cache/scratch/052a-a4/unfixed-client/packages/core` | `/home/d/.bun/bin/bun test --test-name-pattern 'exclusive wrapper|A gets A|matched invalid|matched malformed|unframed/|rejection identity|actual child late' tests/ipc-correlation.test.js` | 1 |
| `full-bun-isolated` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun test` | 0 |
| `live-node-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/052a-a4/live-node-node /home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `live-node-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/052a-a4/live-node-bun /home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.bun/bin/bun` | 0 |
| `live-bun-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/052a-a4/live-bun-node /home/d/.bun/bin/bun /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `live-bun-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/052a-a4/live-bun-bun /home/d/.bun/bin/bun /home/d/.bun/bin/bun` | 0 |
| `restart-node-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/process-recovery.mjs /home/d/.hermes/cache/scratch/052a-a4/restart-node-node /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `restart-node-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/process-recovery.mjs /home/d/.hermes/cache/scratch/052a-a4/restart-node-bun /home/d/.bun/bin/bun` | 0 |
| `restart-bun-node` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun examples/process-recovery.mjs /home/d/.hermes/cache/scratch/052a-a4/restart-bun-node /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `restart-bun-bun` | `/home/d/Workspace/other-projects/chord/packages/core` | `/home/d/.bun/bin/bun examples/process-recovery.mjs /home/d/.hermes/cache/scratch/052a-a4/restart-bun-bun /home/d/.bun/bin/bun` | 0 |
| `expanded-identifiers-node` | `/home/d/Workspace/other-projects/chord` | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test /home/d/.hermes/cache/scratch/052a-a4/expanded-identifiers.test.mjs` | 0 |
| `independent-ipc-node` | `/home/d/Workspace/other-projects/chord` | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/052a-a4/independent-ipc.mjs` | 0 |
| `expanded-identifiers-bun` | `/home/d/Workspace/other-projects/chord` | `/home/d/.bun/bin/bun test /home/d/.hermes/cache/scratch/052a-a4/expanded-identifiers.test.mjs` | 0 |
| `independent-ipc-bun` | `/home/d/Workspace/other-projects/chord` | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/052a-a4/independent-ipc.mjs` | 0 |
| `historical-frame` | `/home/d/Workspace/other-projects/chord` | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/052a-a4/historical-frame.mjs` | 0 |
| `historical-frame` | `/home/d/Workspace/other-projects/chord` | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/052a-a4/historical-frame.mjs` | 0 |

## Results

| Severity / finding | Independent disposition |
|---|---|
| P0 implementation | None reproduced; no formal/exhaustive absence claim. |
| P1 implementation | None reproduced within accepted local host/clock/file/actor threat model. |
| P2 F1 | **CLOSED**: valid inherited IDs execute; later queued work completes once; exact approval/replay/receipt semantics preserved; old source fails same tests. |
| P2 F2 | **CLOSED** for corrected framed client: genuine late A cannot acknowledge B across wrapper replacement or same-wrapper timeout, including identical reads; shape/identity/cleanup corrected; old client fails same behavioral assertions. |
| Remaining observed reliability issue | One first-run fail-closed STORAGE_UNAVAILABLE worker startup/seam timeout, final unchanged isolated rerun green; underlying cause unclassified, retained above. No supported F1/F2 correctness defect remains established. |
| Accepted deployment/effect risks | Trusted host/clock/file incarnation, semantic not cryptographic replay, and final-check→physical-effect race remain; not newly solved or promoted. |
| Release/publication | Still separately unauthorized; no registry/legal/maintainer certification. |

The historical audit's PARTIAL verdict remains correct **for its original HEAD artifact**. This report supersedes only its outstanding F1/F2 correction acceptance for the exact reviewed dirty working artifact; it does not rewrite historical results or certify an unmeasured future commit. All essential requested final gates passed after the disclosed unchanged rerun; no fundamental product correction was required during A4.

## Invariants verified

Original invariant meanings are preserved; IDs are not swapped. CS/AI/CD/CA/TP denote coordinated-storage / actor-ingress / coordinated-dispatch / coordinated-adversarial / two-process-coordination, all freshly run on both runtimes.

| ID | Current executable/source evidence | Verdict |
|---|---|---|
| OWN-01 | CS simultaneous acquire and TP denied standby; one acknowledged generation, exact raw header | PASS |
| OWN-02 | captured owner check precedes revision/diagnostics; stale full-row controls in CS/CD | PASS |
| OWN-03 | claim→fresh checkDispatch→captured callable; precheck takeover zero calls; postcheck race remains explicit | PASS at stated boundary only |
| OWN-04 | BEGIN IMMEDIATE/read/fence/CAS, atomic acquire+quarantine; CS races/rollback | PASS |
| OWN-05 | quarantine unknown/uncertain, CA killed intent/effect; no blind ambiguous replay | PASS |
| OWN-06 | monotonic checked generation/release/expiry and CS overflow controls | PASS scoped incarnation |
| OWN-07 | exact active sidecar/attempt first for success/throw, including missing/replaced attempts; CD/CA full-row preservation | PASS |
| ACT-01 | actual-channel fresh host attestation, exact canonical allowlist; AI/TP plus framed identity/shape negatives | PASS; corrected delivery qualification |
| ACT-02 | scope/current grants/deny/issuer/policy/filtered reads, no receipt-read writes; AI and F1 missing-ID controls | PASS |
| ACT-03 | distinct-human/exact-attempt durable approval/handoff; AI/CD/CA plus valid inherited-ID actual dispatch | PASS; F1 exception closed |
| STA-01 | fenced locked row revision/identity/CAS, independent processes and failures | PASS |
| STA-02 | single complete row, linked journals/receipts/domain/lease; independent raw final/header equality | PASS |
| EFF-01 | unknown quarantines, no rollback inference/compensation or automatic retry; CA/CD and timeout-after-commit case | PASS within effect boundary |
| EFF-02 | full normalized command/subject historical receipt, authorization renewed, old metadata unchanged through framed generation-transfer retry | PASS local dedupe, not remote exactly-once |
| REC-01 | fresh sessions/reauthentication, no owner adoption, four restart pairs; actual late-response replacement and same-wrapper request isolation | PASS; F2 exception closed |
| REC-02 | observer construction effect-free, acquire quarantines; legacy exclusive restart and ambiguous continuation zero calls | PASS |
| REP-01 | own-aware history, legal per-revision combined reconstruction and exact projection; raw DB/replay/reopen plus inherited-ID replay | PASS semantic replay only |

Preservation: all 572 entry paths unchanged. Historical audit SHA-256 remains `0b7609b61e593bcb546ce0cacb838b986cf7a90949393a8e8fe69a6b17cddc60`; A1 `eb7ebca64244c547017955da91ae29ac07a70c122f057ad6afb0b6b990094bf4`; A2 `2024ec7da5765989963ffe14485da05c8aabb091ce1a12826bfc60b993c338cc`; A3 `b3ec0133e341d9a506e0ef653fa33272ee11481d5b1745f48ddd2f0e7bd44627`. HEAD unchanged; staged diff empty. Pure own/reducer changes retain FCIS; randomness/timers/IPC remain shell effects. No new dependencies, TypeScript, versions, authority/storage schema, canonical receipt inputs or exported facade changes beyond documented optional timeout and framed wire semantics.

## Known limitations

- Module-local WeakMap exclusivity is keyed by exact channel object, not independent duplicated module instances/raw competing handlers. Host remains responsible for channel enrollment/revocation/reconnection, isolation, child cleanup and resource limits. Nonces are correlation, not credentials.
- Raw legacy peers deliberately remain outside the framed replacement/delivery guarantee. Near-limit whole-frame budgets are stricter than bare canonical payloads. Malformed unattributable replies with default null timeout may remain pending until valid reply/close/disconnect. No auto-retry/cancel/multiplex/fragment protocol was introduced.
- Local protocol errors, timeout and delivery failure can follow a committed write. Recover only exact original authenticated receipts; do not infer rollback or fresh ownership from historical response metadata.
- Original accepted trusted local regular-file incarnation, shared monotonic policy clock, SQLite/VFS/device assumptions and trusted human/host attestation remain. Same-user hostile code is not sandboxed. Clock jumps/stops, file replacement/backup rollback, multi-machine election and malicious host privileges are outside guarantees.
- Final store check is not atomic with a remote effect; old already-running/in-transit effects may occur. No downstream exactly-once, atomic remote fencing/deduplication or automatic unknown reconciliation claim. Genesis timestamp characterization remains semantic replay, not signed provenance.
- Expanded-ID tests cover every default Object.prototype member plus selected legal strings, not all possible host mutations/ID strings/process schedules. Original behavioral red control selects 16 terminating IPC tests; lifecycle hangs in the old client are not mislabeled as tested green. No new mutation campaign score or publication certification.
- The initial worker startup failure's underlying cause remains unclassified despite final green full/shared gates. Retain logs and investigate recurrence before relying on deterministic CI timing; it is not silently called a proven load-only flake. Scratch evidence is subject to pruning.

## Next-pass readiness

**A1 COMPLETE; A2 COMPLETE; A3 COMPLETE; A4 COMPLETE; 052A COMPLETE. Final bounded Block 052 engineering acceptance COMPLETE. Explicitly authorize 053 ENTRY under the user's pre-existing gated scope; do not implement B1 here.** Parent may now enter the separately specified 053 work after reading this exact report and preserving the current artifact. No implied authorization to stage/commit/push/tag/publish, change versions, erase historical evidence, widen the threat model, add automatic unknown retries or claim remote exactly-once. Publication/legal/final-release checks remain separate. There is no outstanding supported F1/F2 implementation blocker identified by this review.
