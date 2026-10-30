# Block 051 — Independent final verification and handoff

## Pass

**B8 — independent final review: COMPLETE within the bounded local durability contract.** Block 050 engineering remains COMPLETE as recorded in `050-final-report.md`. Block 051 now has an implemented durable commit boundary and independently exercised restart recovery; completion is not inferred from its design. **Block 052 has not begun. Publication is not authorized.**

The first B8 reviewer stopped on provider HTTP 429 before producing a final report. The parent completed this review directly, reread the implementation, and freshly executed every acceptance command listed below. No conclusion below relies on treating the interrupted review as successful.

Repository: `/home/d/Workspace/other-projects/chord`; branch **base**; HEAD **08728e48772db14a247add9143669a8e0eab01fa**. The tested artifact is the dirty working tree, not HEAD alone. Measured Linux runtimes: Node **v24.22.1**, Bun **1.4.3** at `/home/d/.bun/bin/bun`. The default Bun launcher remains unusable; no environment or dependency install was needed.

## Files inspected

- All preceding `docs/internal/051-*.md` reports and the Block 050 final report/closeout findings, with their historical results distinguished from this fresh execution.
- Full `packages/core/src/runtime/storage/sqlite.js`, `src/storage/contract.js`, `src/registry/owner.js`, `src/runtime/recovery.js`, `src/platform/runtime-loop.js`, and `src/sdk/chord.js`.
- `src/platform/approval-flow.js`, `src/platform/transitions.js`; shared process/adversarial test code, fixtures and the fresh complete test outputs. Abbreviated `src/` paths here are package-relative.
- Root/package READMEs, manifest dependency/allowlist changes, export surfaces, original safety harness bytes against its introducing commit, Git status and preservation hashes.
- Actual independent-process proof summaries, PIDs, committed/uncertain outcomes and evidence artifacts from all four runtime pairs.

## Files changed

1. Created `docs/internal/051-final-report.md`, this report.
2. One-line clarification in `packages/core/README.md`: root exports include the imperative trusted-host SQLite factory as well as the SDK and functional-core helpers. No source, test, example, manifest, lockfile or preceding report was changed during the resumed B8 review.

All 530 entry-inventory files were initially verified unchanged after fresh tests. The final preservation check allows only the exact one-line README clarification above and this new report. Pre-existing 050 and B1–B7 edits remain intact. No staging, commit, push, tag, publication or destructive Git operation occurred.

## Implementation and public API summary

- Default `createChord()` remains in-memory. Opt-in synchronous `createChord({ storage: { path, mode: 'create' | 'existing' }, trustedHost, adapterRouter })` uses local SQLite as the owner's authoritative commit point. `close()` is synchronous/idempotent and does not drain, cancel or implicitly commit effects.
- Root host-only `openSqliteStore` exposes `init`, `load`, `compareAndCommit`, `readHistory`, `close`. Root/SDK/platform exports are **31 / 1 / 22**; SDK instance members are **39**. The restart example is explicitly included in the package allowlist.
- Lazy built-in `node:sqlite#DatabaseSync`; no new runtime dependency. The sole dependency remains exact `@weipertda/sigiljs: 0.18.0`, equal to HEAD's dependency set. No TypeScript source/tests/examples were found. Contracts/history/snapshot versions are unchanged; independent storage format is `chord.local-store.v1`.
- One singleton row contains full validated registry, ordered journal and execution/reconciliation evidence plus matching metadata. `BEGIN IMMEDIATE` precedes authoritative read and revision comparison; candidate validation and UPDATE are inside the transaction; success follows COMMIT only. UPDATE independently predicates on revision. WAL/FULL and 1000 ms timeout are checked.
- Validation checks exact layout/metadata, budgets, RegistryData, complete reducer equality, immutable journal prefix, one closing commit, operation/delta linkage and canonical transition. Corrupt or incompatible state never silently initializes, repairs or falls back to memory.
- Durable owner reads reload authority rather than maintaining a competing canonical cache. Callbacks are synchronous and never automatically replayed. A stale/failed/unknown claim releases no prepared invocation. Attempted-COMMIT exceptions or failed rollback are unknown, not proof of rollback; the owner/handle retires.
- Adapter invocation errors and result persistence are separate. A failed/unknown result commit cannot trigger a compensating uncertainty write over possibly committed completion. Reopen/history identity resolves local commit truth, not remote effect truth.
- Startup recovery validates then commits running/leased quarantine before router construction. Recovery invokes no effects; completed facts survive; interrupted work becomes uncertain/unknown and cannot blindly replay. Paused state and queued attempt-bound approvals survive, subject to current authority. The persisted policy-clock floor and corrected resume-deadline clock prevent backward restart-time permission revival.

## Test commands

All commands below were freshly executed in the resumed B8 review. Package commands ran from `packages/core`; root paths are noted. Logs and exact command/exit JSON are at `/home/d/.hermes/cache/scratch/chord-b8-resume/`.

| Command | Exit | Actual result |
|---|---:|---|
| `/home/d/.bun/bin/bun test` | 0 | **275 pass, 0 fail, 1635 expect() calls, 21 files** |
| `node --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | **82 pass, 0 fail**, no cancelled/skipped/todo |
| `/home/d/.bun/bin/bun test` with the same five explicit shared files | 0 | **82 pass, 0 fail**, five files |
| `node --test ../../docs/internal/046-state-probes.mjs` | 0 | **21 pass, 0 fail**, no cancelled/skipped/todo |
| `/home/d/.bun/bin/bun test ../../docs/internal/046-state-probes.mjs` | 0 | **21 pass, 0 fail** |
| `/home/d/.bun/bin/bun src/verify-runtime.js` | 0 | `ALL RUNTIME VALIDATIONS PASSED!` |
| `node examples/quickstart.mjs`; `node examples/cross-actor-workflow.mjs` | 0 each | Completion; governed approval/handoff; zero negative effects and verified no-effect replay |
| `/home/d/.bun/bin/bun examples/quickstart.mjs`; `/home/d/.bun/bin/bun examples/cross-actor-workflow.mjs` | 0 each | Same semantic success |
| `node /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs` and the same probe with absolute Bun | 0 each | 3 actor-field injections rejected; recursive data-only arguments; forged result rejected; authority unchanged; unknown redispatch rejected; adapterCalls=1 |
| Export enumeration through actual ESM modules | 0 | root=31, sdk=1, platform=22, sdkMembers=39 |
| Python dependency/extension/original-harness/hash inventory | 0 | Unchanged dependency set; zero TS files; original harness identical to `git show 1efafd1:docs/internal/046-state-probes.mjs`; entry files preserved |
| `git diff --check` (root) | 2, pre-existing | Exactly three trailing-whitespace diagnostics in `049-final-report.md:7,99` and `release-notes-and-limitations.md:4`; preserved |

The 1635 count is Bun `expect()` calls, not total assertions: the shared suites use Node strict assertions. Overlapping commands are not summed as independent test coverage. The historical 050 baseline remains 193 tests at A3; these 275 are the current 051 result, not a retroactive rewrite.

### Actual independent-process recovery proof

Fresh commands used absolute Node `/home/d/.volta/tools/image/node/24.22.1/bin/node` and Bun `/home/d/.bun/bin/bun`:

```text
<writer> examples/process-recovery.mjs <evidence-directory> <reader>
```

Each of Node→Node, Bun→Bun, Node→Bun and Bun→Node exited **0**, with `gate: "B5 PASS"`. Exact expanded commands are in `proof-checks.json`. The parent orchestrates artifacts only; process 2 recovers from the same SQLite file, not a copied registry.

| Pair | Approval PIDs | SIGKILL/recovery PIDs | Continued approval calls / ambiguous calls | Journal matches |
|---|---|---|---|---|
| node-node | 157109 → 157117 | 157139 → 157146 | 1 / 0 | true |
| bun-bun | 157186 → 157208 | 157240 → 157261 | 1 / 0 | true |
| node-bun | 157322 → 157339 | 157368 → 157389 | 1 / 0 | true |
| bun-node | 157449 → 157469 | 157488 → 157509 | 1 / 0 | true |

Each approval scenario retains committed work, rejects three unauthenticated/stale session forms at the example embedding ingress, continues the original exact attempt once, and has 28 events. Each ambiguous scenario kills process 1 after its local simulated effect before return, preserves committed work, then recovers uncertain/unknown with zero redispatches and 20 events. Distinct spawned/self-reported process identities are asserted by the executable proof. Runtime services and host sessions are supplied anew, not authenticated by persisted principal records.

Evidence roots are `chord-b8-resume/proof-node-node`, `proof-bun-bun`, `proof-node-bun`, `proof-bun-node` under configured scratch. Each contains summary JSON, process metadata, SQLite stores, full registry observations and effect ledgers. Scratch can be pruned; rerun `examples/process-recovery.mjs` to regenerate inspectable evidence.

## Exit codes and results

All fresh behavioral acceptance commands exited **0**. The original safety harness was byte-compared to its introducing commit, not assumed unchanged from its name. The five shared suites rerun real fault injection, process contention, corrupt-state tests, approval continuity and process restart; they do not use synthesized SQLite responses. B8 did not independently replay the six isolated B6 source mutations: their measured kills remain prior-pass evidence, not newly claimed B8 mutation measurements.

## Invariants verified

- Atomic committed state, history and evidence: the inspected transaction has one authoritative update, and fresh tests exercise rollback, lost acknowledgement, process-killed partial WAL writes, matching reducer/state and independently corrupted evidence.
- Revision conflicts are evaluated against transaction-loaded state. Actual separate-process losing claims and conflicting recovery candidates release zero adapter invocations. No callback is implicitly replayed.
- Recovery is effect-free and uncertain external effects are quarantined. The fresh suite includes all eight crash windows plus the exact-before-actual-adapter-call SIGKILL seam; committed completion remains completed.
- Approval/authority continuity preserves run and attempt identity, rechecks expiry/revocation, rejects stale inputs, retains consumed approval and enforces paused execution. Host credentials/options/executables are not serialized.
- Duplicate tasks/results and stale attempts reject without corrupting a newer active attempt; corrupt records abort before router access rather than repairing themselves.
- Journal order is immutable array order, not timestamp sorting. Post-COMMIT acknowledgement loss remains resolvable by historical commit identity after later revisions.
- FCIS remains bounded: pure data/history/transition validation is separate from synchronous SQLite I/O and owner/runtime effects. The root export is not represented as entirely pure.

## Known limitations and severity-classified findings

| ID | Severity / status | Disposition |
|---|---|---|
| 051-HOST-1 | High impact if deployment contract violated; explicit host obligation | **No runtime exclusion or fencing.** Stop/join the old runtime before recovery. Fresh adversarial tests explicitly demonstrate that live-peer recovery cannot undo an old external effect. Single-claim CAS tests do not certify ongoing concurrent schedulers. |
| 051-EFFECT-1 | Accepted external-effect limitation | Missing committed result is unknown even if adapter returned or never entered. No staged acknowledgement/idempotency/remote transaction/exactly-once protocol. Explicit evidence-backed human reconciliation is required before eligible fresh readmission. |
| 051-AUTH-1 | Accepted trusted-host boundary | SDK/store references and database access are privileged. Full SDK exposure to actors defeats governance. Persisted principal/approval records are not login credentials. Example attestation is illustrative embedding code, not core authentication. |
| 051-LIMIT-1 | Nonblocking bounded-capacity/performance limitation | Synchronous O(full registry/history) validation/encoding and 1000 ms lock wait; existing 1 MiB/16384-node/1024-array limits can stop run growth. No migration, compaction or pruning. |
| 051-ENV-1 | Validation scope | Measured Linux Node/Bun versions only; SIGKILL and simulated local receipts are not hardware power-loss or remote-service atomicity proof. SQLite/VFS/filesystem/device sync assumptions remain. No encryption, secret scrubber or cryptographic tamper guarantee. Application payloads can contain secrets. |
| 051-DOC-1 | Low, corrected in B8 | Clarified root export table to name the imperative SQLite factory. No production change. |
| 051-WS-1 | Low, pre-existing | Three unrelated trailing-whitespace diagnostics preserved. |
| RELEASE | Separate publication/distribution blockers | Maintainer identity/scope/repository decisions, legal clearance and fresh final-identity installed-artifact/provenance gates from 050 remain. B7 checked copied dry-run payload, not an actual installation; B8 does not promote that to release certification. |

No release-critical defect was demonstrated **within the accepted local, single-active-runtime contract**. This is bounded evidence, not proof of defect absence or distributed readiness.

## Blockers

**No essential Block 051 engineering blocker remains in this supported scope.** Publication remains unauthorized and separately blocked; nothing was committed, pushed, tagged or published. An environment unable to guarantee exclusive sequential restart must not deploy this recovery mode as safe live takeover.

## Next-pass readiness

**Block 051: COMPLETE. Block 052: ready for a separately scoped design/entry decision, not implemented or begun.** Independent-Process Actor Coordination must explicitly design actor ingress/authentication, host-versus-actor ports, scheduler ownership/exclusion/fencing and concurrency/effect semantics before claiming live multi-process coordination. Existing local durability and restart evidence are foundations, not a substitute for those requirements. Full proposed Proofs 2/3 and distributed product-level promotion remain deferred.

Final handoff artifacts: `050-final-report.md`, this report, `051-storage-contract.md`, `051-storage-implementation.md`, `051-crash-recovery.md`, `051-authority-continuity.md`, `051-process-recovery-proof.md`, `051-durable-adversarial-tests.md`, and `051-durability-guide.md`, all under `docs/internal/`.

## Exact repository state

Branch and HEAD are given above. At final handoff there are **31 tracked modified paths and 32 untracked files**, including this report. No staged paths. The following pre-report status lists all 31 existing untracked files; append `?? docs/internal/051-final-report.md` for the final state. The only tracked content change during resumed B8 is the one-line package README clarification recorded above.

```text
 M .gitignore
 M 049-final-report.md
 M README.md
 M docs/internal/040-audit-final-report.md
 M docs/internal/040-reality-audit.md
 M docs/internal/041-authority-design.md
 M docs/internal/041-contract-scope.md
 M docs/internal/044-developer-surface-audit.md
 M docs/internal/045-release-prerequisites.md
 M docs/internal/046-repository-reality-audit.md
 M docs/internal/049-final-report.md
 M docs/internal/049-license-provenance-report.md
 M docs/internal/049-license-provenance.md
 M docs/internal/049-maintainer-handoff.md
 M docs/internal/049-release-baseline.md
 M packages/core/CHANGELOG.md
 M packages/core/INTEGRITY.md
 M packages/core/README.md
 M packages/core/THIRD_PARTY_NOTICES.md
 M packages/core/bun.lock
 M packages/core/examples/cross-actor-workflow.mjs
 M packages/core/examples/quickstart.mjs
 M packages/core/package.json
 M packages/core/src/index.js
 M packages/core/src/platform/approval-flow.js
 M packages/core/src/platform/journal-audit.js
 M packages/core/src/platform/runtime-loop.js
 M packages/core/src/platform/transitions.js
 M packages/core/src/registry/owner.js
 M packages/core/src/sdk/chord.js
 M release-notes-and-limitations.md
?? docs/internal/050-baseline-lock.md
?? docs/internal/050-citation-closeout.md
?? docs/internal/050-developer-api-review.md
?? docs/internal/050-developer-proof-spec.md
?? docs/internal/050-docs-verification.md
?? docs/internal/050-durable-coordination-design.md
?? docs/internal/050-final-report.md
?? docs/internal/050-mutation-regression-closeout.md
?? docs/internal/050-product-contract.md
?? docs/internal/050-review.md
?? docs/internal/051-authority-continuity.md
?? docs/internal/051-crash-recovery.md
?? docs/internal/051-durability-guide.md
?? docs/internal/051-durable-adversarial-tests.md
?? docs/internal/051-process-recovery-proof.md
?? docs/internal/051-storage-contract.md
?? docs/internal/051-storage-implementation.md
?? packages/core/examples/process-recovery.mjs
?? packages/core/src/runtime/recovery.js
?? packages/core/src/runtime/storage/sqlite.js
?? packages/core/src/storage/contract.js
?? packages/core/tests/authority-continuity.test.js
?? packages/core/tests/crash-recovery-worker.js
?? packages/core/tests/crash-recovery.test.js
?? packages/core/tests/developer-api-review.test.js
?? packages/core/tests/durable-adversarial-worker.js
?? packages/core/tests/durable-adversarial.test.js
?? packages/core/tests/mutation-regression-closeout.test.js
?? packages/core/tests/process-recovery.test.js
?? packages/core/tests/storage-adapter.test.js
?? packages/core/tests/storage-process-worker.js
?? docs/internal/051-final-report.md
```

The full expanded status and final preservation verification are retained in the B8 scratch evidence. Dirty state is intentional and includes protected work from before this mission; no implication that every listed change originated in Block 051 is made.
