# Block 052A — A2 IdentifierIntegrityCorrection

## Pass

**A2 COMPLETE — F1 corrected and regression-gated. A3 READY. 052A remains NOT COMPLETE; 053 remains blocked.** No F2/client/transport correction, A3 implementation, A4 acceptance or 053 work occurred.

Repository `/home/d/Workspace/other-projects/chord`, HEAD `72f96ab6cdc9d6948ffb7eacba527cc27a32a8be`, branch `base`. Entry tracked/staged diffs were empty; exactly the historical independent audit and A1 report were untracked. Captured SHA-256 of all **565 entry files** before editing in `/home/d/.hermes/cache/scratch/052a-a2/entry.json`. Hereafter R is that repository, P is `R/packages/core`, S is `/home/d/.hermes/cache/scratch/052a-a2`, N is `/home/d/.volta/tools/image/node/24.22.1/bin/node`, B is `/home/d/.bun/bin/bun`. Versions actually executed: Node v24.22.1, Bun 1.4.3.

Protected entry hashes, verified unchanged:

- `docs/internal/052-committed-independent-audit.md`: `0b7609b61e593bcb546ce0cacb838b986cf7a90949393a8e8fe69a6b17cddc60`
- `docs/internal/052a-root-cause-report.md`: `eb7ebca64244c547017955da91ae29ac07a70c122f057ad6afb0b6b990094bf4`
- `docs/internal/046-state-probes.mjs`: `95b72cd7189bb2d54685bdd3f08561ef0740f3e8399bbc04cb10a269228248eb`

## Agent

**state-agent**, delegated A2 only. Loaded `owner-cas-mutation-testing`; read the full A1 report before editing. Kept the correction dependency-free, JS ESM and FCIS: the accessor and reducer changes are pure; random allocation remains in the shell. Updated one reusable own-ID regression lesson in that existing default-profile skill outside this repository.

## Files inspected

- Full `docs/internal/052a-root-cause-report.md`, including every row of its all-source lookup matrix and F2/A3 constraints.
- Relevant implementation in all changed source files listed below; coordinated planner/dispatch, command receipts/read/replay, owner and cross-invariant boundaries, shared legacy helpers and SDK caller-authored identifiers. Also inspected `coordination/command-authorization.js`, `contracts/sigils.js` dictionary/record/reference validation, `platform/approval-flow.js`, `platform/history.js` own-aware diff/application primitives, `registry/query.js`, `utils/clone.js`, and snapshot reconstruction.
- `tests/fixtures/{coordinated-actors,host}.js`, `coordinated-dispatch.test.js`, `two-process-coordination.test.js`, related authorization/helper tests; full standalone `examples/{two-process-coordination,process-recovery}.mjs` implementations. Read actual test logs and separately read final SQLite rows/artifacts.
- Regenerated an all-source bracket-access inventory: `S/indexed-lookups.txt`, including writes/deletes, fixed enums and arrays. This is a classification of the named identifier families, not a blanket certification of every source expression or arbitrary host object.

## Files changed

Exactly **19 A2 repository paths**: 16 existing source files modified, one utility and one shared test file added, and this report added. Package-relative paths below have prefix `packages/core/`:

```text
src/coordination/commands.js
src/coordination/runtime.js
src/coordination/state.js
src/platform/adapter-routing.js
src/platform/attempts.js
src/platform/handoff.js
src/platform/reconciliation.js
src/platform/runtime-loop.js
src/platform/state-invariants.js
src/platform/task-queue.js
src/platform/transitions.js
src/registry/owner.js
src/registry/registry.js
src/registry/snapshot.js
src/sdk/chord.js
src/sdk/coordinated-chord.js
src/utils/own.js                         (new)
tests/identifier-integrity.test.js       (new)
```

Plus `docs/internal/052a-identifier-integrity.md` (new). No manifest, lockfile, dependency/version, contract schema, historical report, original safety test, actor client/ingress, example or export surface changed. No staging, commit, reset, clean, stash, push, tag or publication. Scratch contains the HEAD archive/control, gate/proof scripts, command records, logs, preserved first-run logs, inventories, raw rows and proof artifacts; existing A1 scratch was not rewritten.

## Design decisions

### One own-property policy, no representation or identifier-domain change

`src/utils/own.js` exports `own(object,key)`: nullish map or no own property returns **null**; own values are returned unchanged. It uses `Object.hasOwn`, never `object.hasOwnProperty`. Record dictionaries validate non-null records, so existing truthy record-presence branches remain equivalent for supported states. This helper must not be mistaken for a separate presence bit in arbitrary maps that permit null/undefined/false/zero; none of those values were newly admitted as task/attempt records.

Both coordinated shell reservation selection and pure `planClaim` use this policy. The planner reads its reservation once, applies the existing global collision check only when absent, validates the exact attempt, then retains the same queue/revision/approval/authority logic. The storage reconstruction and combined replay use the same pure planner. No skip/retry workaround was added: the formerly blocking valid task now completes, then later unrelated work completes once.

Ordinary dictionaries, clone behavior, JSON serialization, registry/snapshot versions, canonical commands/responses/receipts and journal representation are unchanged. Initializing maps with null prototypes would not survive existing cloning/JSON restore and was not used. Accepted `toString`, `valueOf`, `hasOwnProperty` remain accepted; already forbidden `constructor`, `__proto__`, `prototype` remain forbidden. Nothing narrows accepted IDs.

### Disposition of every named lookup family

| Family | A2 disposition / remaining reasoned boundary |
|---|---|
| Coordinated shell and pure claims | Own task/operation/pending reads; reservation read once in planner; all collision and exact identity checks retained. |
| Shared attempt prepare/invalidate/activate/clear | Own pending/active reads; idempotent preparation returns the installed record; absent invalidation/activation/clear returns null rather than a prototype function. |
| Legacy SDK approval/prepare/resume/cancel/replay | Own task/pending reads; explicit attempt override still works; absent preparation does not manufacture approval authority. Missing task errors remain fail-closed. |
| Legacy runtime/result registration/owner stamping | Own task/active reads and own absence for dispatch-revision stamping. No v2 concurrency semantics introduced into v1. |
| Queue/dead-letter/transitions | Task lookup own-safe; queue remains array find/filter/sort with unchanged ordering, equality and lifecycle. |
| Handoff/approval | Legacy handoff presence now own-safe; coordinated handoff/approval/receipt lookups reuse the common policy. Genuine missing legacy handoff is INVALID_CONTEXT; the formerly inherited absent member no longer produces incidental INVALID_TRANSITION from a function's missing status. No success contract, recipient/CAS/status guard or coordinated visibility changes. Authority approvals/principals/actors/grants remain arrays with exact comparisons, not ID-keyed objects. |
| Coordinated exact attempt, outcomes and replay | Own task/active/operation/dispatch reads where absence matters. Existing owner fence and full exact attempt predicate still precede diagnostics/result candidate construction. Writes to operation/dispatch members remain bracket expressions only after exact installed identity has been established. |
| Coordinated commands/admin/cross-invariants | Common accessor replaces local equivalent; derived task/handoff/operation reads own-safe. Existing explicit Object.hasOwn+read guards remain guards, not unguarded presence claims. |
| Legacy reconciliation/import | Nested task-to-operation lookup uses own at both levels; caller-selected reconciliation task and imported operation lookups normalized. Allocation/serialization/recovery lifecycle unchanged. |
| Artifact/domain registration and outcomes | Own presence replaces inherited-inclusive ||= initialization; missing authority/state domain entries no longer inherit functions. Both legacy and coordinated result updates distinguish absent references from own records. Existing lifecycle and descriptive registration semantics unchanged. Later bare reads in legacy result transitions are dominated by explicit own checks on validated plain data. |
| Router | Own exact and own default reads; own entries, prefix enumeration order, default then fallback precedence retained. An inherited Object.prototype function is no longer an adapter. This intentionally does not promise routing from inherited host-prototype registrations. |
| Contracts | Existing own-reference guards for queue/results/pending/active/operation task references retained unchanged. Bare reads after those guards are referential, not intrinsically own-safe. |
| History and correlation | History keeps explicit own-presence flags and own path checks unchanged; equality only enumerates own keys. Correlation/causation IDs are compared fields or canonical receipt-tuple components, not free-key dictionaries. No new correlation map needed. |
| Trigger/query/fixed enum/array paths | Trigger data enumerated and validated, queries enumerate own values; no indexed trigger execution lookup identified. Fixed validated enum reads and array accesses are outside the accepted-ID absent-record bug. No arbitrary enum/API hardening was smuggled into A2. |

## Tests run

Exact expanded argv, cwd, exit, duration and log paths: **`S/commands.json`**, **`S/process-commands.json`**. Gate runner `python3 S/run-gates.py` from R; TMPDIR `/home/d/.hermes/cache/scratch`, maximum three concurrent jobs. The runner records deliberate red controls without treating them as passing production tests.

| Command | Cwd | Final exit / result |
|---|---|---|
| `B test` | P | **0: 382 pass, 0 fail, 1732 expect calls, 27 files** |
| `N --test tests/identifier-integrity.test.js` | P | **0: 26 pass, 0 fail/skipped/cancelled** |
| `B test tests/identifier-integrity.test.js` | P | **0: 26 pass, 0 fail** |
| `N --test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js` | P | **0: 81 pass, 0 fail** |
| Same five paths with `B test` | P | **0: 81 pass, 0 fail** |
| `N --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | P | **0: 82 pass, 0 fail** |
| Same five paths with `B test` | P | **0: 82 pass, 0 fail** |
| `N --test ./docs/internal/046-state-probes.mjs`; `B test ./docs/internal/046-state-probes.mjs` | R | **0 each: 21 pass, 0 fail** |
| `N src/verify-runtime.js`; `B src/verify-runtime.js` | P | **0 each: ALL RUNTIME VALIDATIONS PASSED** |
| `N --test tests/identifier-integrity.test.js`; `B test tests/identifier-integrity.test.js` | `S/precorrection/packages/core` | **1 each: 8 pass, 18 fail** (required red control) |
| `git diff --check`; `git diff --cached` | R | **0; no whitespace errors; staged diff empty** |

Full historical suite imports bun:test: no full-suite Node claim. Counts overlap and must not be summed.

### Genuine pre-correction failures, same final test bytes

Created `S/precorrection` from `git archive HEAD` (no mutation checkout), copied only the new test into its corresponding test directory, symlinked existing dependencies; production code remained the exact original HEAD. Final test SHA-256 on both trees is `ac9f2a96ee980eed4a1a2d85a3c95bcc59606767b7e7998a7111ed860844458e`.

Final red logs on **both runtimes** show ordinary unreserved and all four approval-reserved coordinated cases passing, but all three unreserved inherited-member cases failing at production `planClaim` with INVALID_DATA. Shared helper assertions receive prototype functions instead of null; nested operation resolution and router presence fail behavioral assertions; own artifact/domain initialization assertions fail; coordinated result references fail INVALID_TRANSITION. Legacy public preparation also reproduces the actual production `deepClone` attempt to JSON-parse undefined after the helper returns an inherited function. That is a runtime product failure, **not a fixture/source parse/import failure**. All tests load and execute. Final red controls have no timeout, skip or cancellation; fixed tree passes all 26.

During test development, initially mixed artifact-reference output into the primary F1 case, then separated it into its own regression so the ordinary/approval controls isolate F1. A duplicate outcomes ID list was corrected to assert the existing INVALID_COMMAND contract, with a separate singleton missing-ID visibility control. Neither fixture adjustment changed product acceptance rules.

First full gate run hit Bun's default five-second limit in some replay-heavy approval tests under concurrent load; `S/first-gates/` retains those real failures. Added explicit 60-second bounds to these integration cases and reran the entire gate. Final full/shared results above are after that change, not a claim that the first run passed.

### Standalone real-process proofs and independent inspection

Executed **eight standalone commands**, all exit **0**: four live owner/actor runtime pairs and four sequential writer/reader runtime pairs. These are additional to the shared suites' real IPC, takeover, restart, SQL failure and SIGKILL tests.

For each ordered pair `(X,Y)` in `(N,N),(N,B),(B,N),(B,B)`, from P:

```text
X examples/two-process-coordination.mjs S/live-<x>-<y> X Y
X examples/process-recovery.mjs S/restart-<x>-<y> Y
```

`<x>/<y>` are literal `node` or `bun`. Exact expanded commands and directories are in `S/process-commands.json`; execution script is `S/run-process-proofs.py`. The live proof uses production public exports and authenticated actual inherited actor IPC. Owner/actor/standby PIDs:

| Pair | Owner | Actor | Standby |
|---|---:|---:|---:|
| Node/Node | 135395 | 135409 | 135442 |
| Node/Bun | 135394 | 135408 | 135435 |
| Bun/Node | 135542 | 135607 | 135654 |
| Bun/Bun | 135579 | 135614 | 135634 |

Every live proof establishes simultaneous liveness, checks actual spawn PIDs, two physical effect files with matching NDJSON entries, six canonical receipts, two completed exact attempts, human approval consumption, final revision 14, full replay and independent reopen equality, clean child exits, eleven denied command cases and unchanged duplicate/read behavior.

Separately opened actual SQLite files using Python sqlite3 read-only, retained full `independent-raw-row.json` in each proof directory and matched parsed authoritative registry/envelope to final JSON. Inspected effects/PIDs/physical file contents, receipts, consumed attempt, replay/reopen files. All **12 database inspections** passed: four live v2 rows at revision 14, four v1 approval continuations at revision 11, four v1 ambiguous quarantines at revision 7. Each restart has two recorded physical effects: committed+continued for approved work, committed+ambiguous for the killed case; ambiguous continuation adapter calls remain zero. `S/process-inspections.json` records results; `S/full-envelope-inspections.json` additionally records complete v2 envelope/header equality and matching clean exit PIDs for all four live proofs. Initial inspector used an incorrect legacy table name `chord_state` and exited 1 after the eight successful CLI executions; discovered actual schema `chord_store`, corrected inspector only, and reran inspection against the same evidence without overwriting proof runs. Corrected inspection exited 0.

## Results

- Accepted ordinary and inherited-member IDs now pass actual authenticated public ingress → persistence/reopen → public dispatch → result → serialization/combined replay → reopen. All eight cases complete both the older selected task and later unrelated queued work exactly once, then repeat cycles are no-write skipped. Exact approval reservation is used and consumed by the dispatched attempt when present.
- Original receipt retries return identical historical responses without writes; task-ID duplicate admission, repeated batch IDs, duplicate canonical-operation admission and repeated outcomes-ID rejection retain their prior codes. Missing identifier reads disclose no fabricated task/outcome. Already forbidden identifier values and JSON own keys retain INVALID_COMMAND/not_committed and complete authoritative-row equality.
- Related pure shared lifecycle, public legacy approval/prepare/resume/dispatch, artifact/domain own initialization and absent/present result references, nested operation resolution and router precedence are permanently exercised on both runtimes.
- All final requested production gates pass; the exact same new tests fail on original HEAD for behavioral causes. No source mutation checkout or dependency installation was needed.

## Invariants verified

- Storage/wire/exact Sigil shapes, serialization formats, replay density/linking, authority installation and canonical command receipt semantics unchanged. No accepted-ID narrowing or global representation/prototype changes.
- Coordinated lease/owner fence and full exact active-attempt predicate remain ahead of result/uncertainty diagnostics. Existing stale/old callback tests retain complete-row equality and no effects; both success and throw paths pass on both runtimes.
- Queue ordering, reservation identity, collision checking, once-only completed outcomes, immutable history, legacy CAS/revision behavior, human distinction and exact-attempt approval consumption retained.
- All 565 entry paths accounted for: only the 16 declared source edits differ; every other entry file matches its entry hash and remains present. Protected audit/A1/safety hashes above match exactly; staged diff empty and HEAD unchanged. `S/preservation.json` records the full declared tracked-change list and zero unexpected differences.

## Known limitations

- **F2 remains unfixed by design.** Actor-client pending response shape/delivery identity, replacement wrappers and stale send callback bugs remain A3 work; green current actor tests do not certify those paths. Neither runtime actor client nor ingress was edited.
- Remaining bracket member mutations/reads explicitly described above depend on preceding own/identity validation or immediate own installation. They are not certified as universally safe bare lookups. Contracts and enum graphs were not globally rewritten. A null/undefined-valued generic dictionary needs separate presence semantics; this accessor does not imply such maps contain valid records.
- Unknown artifact/domain result references retain the existing policy of no update rather than becoming new records. Own existing records still use existing lifecycle checks. Legacy helper error cleanup is not a new actor endpoint or new authentication implementation.
- Standalone proofs use supported ordinary generated IDs; the dedicated new accepted-ID regressions cover the inherited-name domain through real storage in-process. Multiprocess combination coverage is not an exhaustive cross-product of every accepted identifier.
- Trusted-host authority/session attestation remains an embedding boundary, not a login protocol. Sequential legacy restart requires exclusive host assurance; no downstream exactly-once, live legacy multi-scheduler safety, global host-object sanitization, hardware power-cut or deployment claim is made.
- Scratch evidence may be pruned. No blocker remains for A3; no claim of final independent A4 acceptance is made.

## Next-pass readiness

**A2: COMPLETE. A3: READY. A4: PENDING. 052A: NOT COMPLETE. 053: BLOCKED.** Parent should read this report and the unchanged A1 report, then implement only the separately authorized F2 delivery-identity pass. Preserve this A2 test/correction gate while resolving A1's explicit framed session+request identity and legacy-wire compatibility decision. Do not conflate canonical idempotency operation IDs with per-send transport identity; do not change durable receipts/authentication to solve delivery matching.
