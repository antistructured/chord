# 051 — Local durability developer guide and B7 verification

## Pass

**B7 — developer-experience-agent: PASS for bounded local durability documentation and runnable developer experience.** Accepted B1–B6 inputs were read and checked against live code. Default memory mode and experimental SQLite mode are documented without promoting the product to distributed Level B or claiming full Proof 2/3. **B8 final verification is not executed.** No publication, staging, commit, tag, dependency, version or scope change.

Base remains `08728e48772db14a247add9143669a8e0eab01fa`, branch `base`; all preexisting 050/B1–B6 working-tree implementation and evidence is preserved. This is working-tree evidence, not a release attestation.

## Clear guide: choose, open, recover, operate

The shipped reference is [package README — Memory and durable modes](../../packages/core/README.md#memory-and-durable-modes). It includes an executed minimal lifecycle block, exact raw-store signatures/outcomes and the separate-process proof commands; the root README links directly to it without replacing its long capability tables or inline canonical examples.

1. **Choose memory** with `createChord()` for disposable live state. Host snapshot export/import remains a separate session boundary, not crash recovery. SQLite is not loaded on memory-only construction.
2. **Choose local durability** with `createChord({ storage: { path, mode: 'create' }, trustedHost: { now }, adapterRouter })`. Provision a private absolute regular local-file path and its parent directory. `create` initializes a new run and never overwrites an initialized one. No network filesystem, URI or `:memory:` deployment is supported. The path/ancestors, storage files and backups must be protected by the host; this is not a filesystem sandbox or network-filesystem detector.
3. **Stop and join the old runtime first.** One active scheduler runtime per run is mandatory. The store serializes raw CAS writes but does not exclude another scheduler or fence an old effect. B6's live-peer experiment demonstrates that absence, not safe takeover. An external effect already running can continue even if its later completion is rejected.
4. **Restart** with `storage: { path, mode: 'existing' }`. Do not pass `registry` with durable mode or rebootstrap `trustedHost.authoritySnapshot` on existing mode. Construction validates and performs effect-free recovery before returning; failure aborts, never degrades to memory or repairs/overwrites the file. Recreate routers, runtime policy, executable services and authenticated embedding-host ingress. Policy time is clamped to the persisted logical floor, not a substitute for a trustworthy elapsed-time clock.
5. **Interpret recovery conservatively.** Committed results/history survive; completed work is not redispatched. Interrupted running/leased work becomes `uncertain` with operation `unknown`; active/pending attempt records for that work are removed. Recovery resolves/invokes zero adapters. Missing committed acknowledgement is unknown even when an adapter returned, or even when it never actually began. Do not blind retry. Explicit evidence-backed human reconciliation and, where allowed, fresh readmission are required. Queued work, paused state and exact pending approval bindings survive; current policy checks still apply. Host authentication must be re-established outside Chord, not inferred from persisted principal IDs or approval data.
6. **Close deliberately.** Await cycles, then call synchronous/idempotent `close()`. It has no implicit commit/drain/cancellation. Closing during an external effect cannot undo it; a later result write rejects `STORE_CLOSED`, and restart quarantines the durable claim.

### Raw adapter responsibilities and failures

Root `openSqliteStore({ path, mode, busyTimeoutMs: 1000 })` is privileged plumbing, not actor admission or a scheduler. The optional timeout, if supplied, must be exactly 1000. Use `try/finally` and `store.close()`.

- Raw `create` open can create an empty schema; `init({ initialRegistry, logicalNow })` must explicitly install complete validated registry/genesis history. SDK creation performs this for you. `existing` does not initialize a missing/empty store.
- `load()` returns detached `{ registry, revision, commitId, logicalNow, storageVersion }`.
- `compareAndCommit({ expectedRevision, nextRegistry, operation, logicalNow })` requires exactly the next safe revision, immutable history prefix, matching closing commit/delta, supported canonical transition and complete reduction equality. Caller-authored success/evidence flags are not accepted. Prefer SDK operations rather than hand-building candidate history.
- `readHistory({ afterOrdinal = 0, limit = 1024 })` returns `{ revision, commitId, entries, hasMore }`. Entries have dense 1-based journal ordinals in immutable array order, not timestamp order. Each page is one validated snapshot, not a multi-call frozen cursor.
- Success `{ ok: true, revision, commitId }` acknowledges **local** COMMIT only. Raw stale conflict returns `{ ok: false, code: 'STALE_REVISION', revision }` without writing; SDK transaction paths throw. Reload and explicitly re-plan, never auto-replay callbacks or dispatch.
- Sanitized storage `TypeError`s have `code` and `path: '$'`; mutations report `commitStatus` where applicable. Validation or `STORAGE_UNAVAILABLE/not_committed` means no write with confirmed rollback or failed acquisition. It is not permission to repeat a remote effect. Open/load failures need not carry commit status.
- `COMMIT_OUTCOME_UNKNOWN/unknown` means COMMIT attempted or rollback uncertain. Retire/stop mutation and dispatch; reopen and compare the proposed run ID, revision, commit ID and exact suffix/delta, including a historical commit if newer commits exist. A valid store still at the base or with a different commit at the proposed revision and absent proposal establishes noncommit; read failure/conflicting identity remains unknown. Exception/no acknowledgement is not rollback. Local commit truth does not resolve remote effect truth.
- `STORAGE_CORRUPT`, `UNSUPPORTED_STORAGE_VERSION`, `SCHEMA_MISMATCH`, `UNSUPPORTED_RUNTIME` abort without repair, migration or fallback. Preserve evidence for operator review. `STORE_NOT_INITIALIZED`, `STORE_ALREADY_INITIALIZED`, `STORE_CLOSED` require explicit lifecycle correction. A missing existing file is `STORAGE_UNAVAILABLE`.

### Forbidden persistence and application-secret caveat

Do not persist credentials, bearer tokens, passwords, private sessions, callbacks, routers, executables or host service handles. Constructor services/options are not serialized; contracts reject functions/accessors/cycles/exotic objects/dangerous keys. Persisted authority is declarative policy, not login. Application-authored strings/JSON in task inputs, outputs or evidence **can still contain secrets and will be stored**: remove them before admission. There is no content scrubber, encryption, credential vault or cryptographic tamper proof. Keep SDK/store handles and full inspection APIs host-private; a generic administrative dispatcher exposed to actors defeats the boundary.

### Runtime requirements and limits

Measured on **Linux, Node v24.22.1 and Bun 1.4.3**, using lazy `node:module#createRequire` → `node:sqlite#DatabaseSync`. These are tested versions, not a minimum-version or all-platform claim. Missing binding rejects durable requests with `UNSUPPORTED_RUNTIME`, never memory fallback. The provided Bun executable is `/home/d/.bun/bin/bun`; prior passes found the default launcher unusable. Node launcher was resolved with `node -p process.execPath` to `/home/d/.volta/tools/image/node/24.22.1/bin/node` before measuring child PIDs.

One local SQLite singleton row stores complete validated state, ordered history and embedded execution/reconciliation evidence together, with WAL, FULL and a checked 1000 ms busy timeout. Whole-registry/history read/validation/encoding/writing is synchronous O(entire state/history). Limits from `CONTRACT_LIMITS`: 1 MiB encoded bytes, depth 32, string length 16384, array length 1024 including history, 256 object keys, 16384 nodes, ID length 256. Reaching any budget can stop further growth; no migration, pruning or compaction is implemented. The lock wait is bounded; total operation time also includes validation/I/O.

FULL relies on SQLite/VFS/OS/filesystem/device honoring sync. SIGKILL is not hardware power loss. No concurrent schedulers, distributed leases/fencing, exactly-once external effects, staged acknowledgement recovery, remote idempotency or automatic reconciliation is claimed. IDs/diagnostic timestamps are nondeterministic; proof comparisons are semantic. Local durability is a bounded implemented subset; multi-host Level B and full Proof 2/3 remain unimplemented/deferred.

## Files inspected

- Accepted `docs/internal/051-{storage-contract,storage-implementation,crash-recovery,authority-continuity,process-recovery-proof,durable-adversarial-tests}.md`, including B1 integration and B6 single-active-host caveats.
- Root/package READMEs and package manifest; unchanged quickstart/canonical/restart examples.
- `packages/core/src/sdk/chord.js#createChord` and its host clock/read/mutation/close routes; `src/registry/owner.js#createStateOwner` read/transact/install/capture/retire paths.
- `src/runtime/storage/sqlite.js#openSqliteStore` request/path/runtime validation, transactions, initialization/load/CAS/history and retirement; `src/storage/contract.js#validateNext`, `#decodeRow`; `src/runtime/recovery.js#recoverOwner`.
- `src/platform/runtime-loop.js#runRuntimeCycle` claim/invoke/result/uncertainty; exported functions in changed approval-flow/transitions/journal-audit modules; `src/contracts/sigils.js#clonePlainData` and `CONTRACT_LIMITS`; root/SDK/platform exports.
- Actual pack dry-run file list, consumer-like copied payload, executed README blocks and existing safety/full/shared outputs.

Symbol references are module/function search locators, not HTML anchors. Updated citations only for modules demonstrably changed by integration; unrelated historical evidence/locators remain, not globally re-certified.

## Files changed

1. `README.md` — remove current in-memory-only/no-storage claims, add bounded local durability guide links/classification, retain Level B/C deferral, historical counts, long cited tables and both inline executable examples. Fix low-severity false “frozen decisions” wording to sanitized data. Replace stale changed-module source line references with stable function locators.
2. `packages/core/README.md` — usable storage/lifecycle/recovery/error/security/limits/runtime guide; root exports 31 (SDK 1, platform 22), current counts, restart proof invocation and installed payload path. Existing inline quickstart retained.
3. `packages/core/package.json` — **only** add `examples/process-recovery.mjs` to `files`. Necessary because the prior explicit allowlist excluded this now-documented installed example. No version/scope/dependency/exports/scripts changes.
4. `docs/internal/051-durability-guide.md` — this B7 guide and gate report.

No source/test/example/lockfile or B1–B6 report edits. Entry inventory `/home/d/.hermes/cache/scratch/b7-entry.json`; hash comparison found only the three intended preexisting files above changed. All source and safety bytes remain unchanged. Scratch verification harness/logs/consumer payload/evidence are outside the repository. One procedural lesson added to the existing active-profile documentation-verification skill, not product code or another profile.

## Test commands

Commands below ran from `packages/core` unless marked root/consumer. `N=/home/d/.volta/tools/image/node/24.22.1/bin/node`, `B=/home/d/.bun/bin/bun`, `S=/home/d/.hermes/cache/scratch`. Actual argv/cwd/exit/log per command is retained in `$S/chord-b7-logs/results.json`; extracted root-block commands in `root-blocks.json`. No install or publish command ran.

| Exact command / invocation | Exit | Actual result |
|---|---:|---|
| `npm pack --dry-run --ignore-scripts --json` | 0 | Restart example included; development verifier excluded. No tarball created. |
| `$B test` | 0 | 275 pass, 0 fail, 1635 Bun expect calls, 21 files. |
| `$N --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | 82 pass, 0 fail/cancelled/skipped/todo. |
| `$B test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | 82 pass, 0 fail, 5 files. |
| `$N --test docs/internal/046-state-probes.mjs` (root) | 0 | 21 pass, 0 fail, no skips. |
| `$B test ./docs/internal/046-state-probes.mjs` (root) | 0 | 21 pass, 0 fail. |
| `$N packages/core/src/verify-runtime.js`; `$B packages/core/src/verify-runtime.js` (root) | 0 each | Both report `ALL RUNTIME VALIDATIONS PASSED!`. |
| `$N examples/quickstart.mjs`; `$B examples/quickstart.mjs` | 0 each | completed true, adapterCalls 1. |
| `$N examples/cross-actor-workflow.mjs`; `$B examples/cross-actor-workflow.mjs` | 0 each | completed; revision 14, events 34, dispatches 1, negative effects 0, replay verified. |
| `$N examples/process-recovery.mjs "$S/chord-b7-node-evidence"` | 0 | Both scenarios B5 PASS. |
| `$B examples/process-recovery.mjs "$S/chord-b7-bun-evidence"` | 0 | Same. |
| `$N examples/process-recovery.mjs "$S/chord-b7-node-bun-evidence" "$B"` | 0 | Same. |
| `$B examples/process-recovery.mjs "$S/chord-b7-bun-node-evidence" "$N"` | 0 | Same. |
| `$N $S/chord-b7-consumer/readme-0.mjs`; `$B` same file (consumer) | 0 each | Package inline quickstart verbatim: completed true, calls 1. |
| `$N $S/chord-b7-consumer/readme-1.mjs`; `$B` same file (consumer) | 0 each | New storage lifecycle block verbatim: sameRun true, entries 2. |
| `$N $S/chord-b7-consumer/root-readme-0.mjs`; `$B` same file (consumer) | 0 each | Root inline quickstart verbatim: completed true, calls 1. |
| `$N $S/chord-b7-consumer/root-readme-1.mjs`; `$B` same file (consumer) | 0 each | Root complete inline canonical workflow verbatim: same assertions/counts as shipped example. |
| `$N $S/chord-b7-consumer/exports.mjs`; `$B` same file (consumer) | 0 each | Actual bare imports assert root/SDK/platform counts 31/1/22. |
| `$N $S/chord-b7-consumer/node_modules/@antistructured/chord/examples/process-recovery.mjs "$S/chord-b7-consumer-node-evidence"` (consumer) | 0 | Pack-listed example self-spawns correctly; both scenarios PASS. |
| `$B $S/chord-b7-consumer/node_modules/@antistructured/chord/examples/process-recovery.mjs "$S/chord-b7-consumer-bun-evidence"` (consumer) | 0 | Same. |
| `git diff --check` (root) | 2 | Only preexisting whitespace at `049-final-report.md:7,99`, `release-notes-and-limitations.md:4`. |
| `git diff --check -- README.md packages/core/README.md packages/core/package.json docs/internal/051-durability-guide.md` (root) | 0 | B7 targets introduce no whitespace diagnostics. |

Final dry-run readback (`$S/chord-b7-logs/final-pack-dry-run.json`) confirms 51 payload files and the restart example. Final checks resolve all 46 root / 10 package source-symbol references, confirm both READMEs' executable blocks exactly equal their successfully executed scratch copies, and confirm the unchanged original safety SHA-256 `95b72cd7189bb2d54685bdd3f08561ef0740f3e8399bbc04cb10a269228248eb`. Entry comparison confirms exactly the three intended preexisting edits and only this new report.

Consumer-like check copied **exactly the dry-run file list** into scratch `node_modules/@antistructured/chord`, linked the already installed SigilJS dependency, then ran bare imports, README blocks and the self-spawning restart example. This tests curated payload/resolution without npm installation side effects. It is not an actual install, tarball extraction or clean dependency-download test. Shipped README's internal repository-report link is explicitly labeled repository-only.

Reproducible scratch harness: `$S/chord-b7-verify.py` (requires new evidence directory names to rerun). All proof summaries were read back and aggregated in `$S/chord-b7-logs/proofs.json`, not inferred from exit alone. Every scenario has `journalMatches:true`, one preserved previously committed effect and zero ambiguous redispatches. Approval continuation has calls 1 and three rejected sessions; ambiguous has calls 0 and actual first signal SIGKILL. Evidence remains under the six roots above, subject to scratch cleanup.

## Exit codes and results

All final behavioral checks pass. Initial scratch runner failed because this npm returns a package-name-keyed JSON object rather than the assumed array; parsing now accepts both and reran successfully. An auxiliary shell inspection used backticks inside a double-quoted Python command, causing shell substitution and an invalid empty regex; no repository files changed, and the actual README extraction/execution was rerun through Python without shell interpolation. These were harness/inspection errors, not product test failures. No fabricated substitute output was used. Existing whitespace is preserved, not repaired in this scoped pass.

## Invariants verified

- Default memory behavior and both executable root/package canonical blocks still work; new durable configuration block opens actual SQLite and preserves identity/history.
- Documentation matches constructor/raw-store validation, clock floor, close, commit statuses, effect-free recovery and single-active-host obligations; no full Proof 2/3, distributed or exactly-once claim introduced.
- Four Node/Bun runtime-pair separate-process proofs actually pass, and installed-layout proof works under both runtimes with no source-relative dependency on repository tests.
- Raw/store/SDK/history agreement, uncertain-work nonredispatch, exact approval continuity, host reattestation boundaries and ambiguous commits remain green in unchanged full/shared/safety suites.
- Curated file inclusion is explicit, with root export count checked dynamically; original dependencies/version/scope and source/test bytes are preserved.

## Known limitations

This pass is documentation and packaging allowlist only, not an implementation review replacement or B8 final verification. Only the measured Linux runtimes are covered. No actual npm install, tarball generation/publication, power-cut test, remote service proof or new mutation campaign was performed. B1–B6 limitations remain binding, especially host-enforced runtime exclusivity, whole-history capacity, secret handling and unknown remote effect truth. Long prior audit reports remain historical, not globally rewritten or newly certified. Distribution identity/legal/release gates remain maintainer-owned and unresolved; no product-level promotion implied.

## Blockers

**None for bounded B7.** Hosts needing live-peer recovery/fencing or concurrent schedulers remain blocked on separate design/implementation. Nonblocking preexisting whitespace remains. No supported-contract defect requiring a source change was found during the documentation/API checks.

## Next-pass readiness

**B7 COMPLETE/PASS.** Gate paths: `docs/internal/051-durability-guide.md`, `packages/core/README.md#memory-and-durable-modes`, root `README.md`, `packages/core/package.json`. B8 may independently verify this handoff under its own scope; **B8 is not performed here**. Publication remains unauthorized.
