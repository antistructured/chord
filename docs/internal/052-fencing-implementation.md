# Block 052 — Coordinated SQLite storage fencing

## Pass

**Pass 3 only — storage-fencing-agent. Storage foundation implemented; READY for Pass 4 ingress implementation. Not a live coordinated-runtime release gate.** No ingress, public coordinated runtime factory, adapter invocation branch, Block 053, staging, commit, push, tag, version bump or publication performed.

Repository: `/home/d/Workspace/other-projects/chord`, protected dirty 050/051/052 entry tree. SHA-256 filesystem inventory at `/home/d/.hermes/cache/scratch/chord-052-pass3/entry.json` covers 636 non-`.git`/non-`node_modules` files (a wider filesystem inventory than the parent's repository-only inventory). Only the explicitly listed root-export addition changes a pre-existing file. Prior source, exact contracts, tests, reports, manifests, lockfile and versions otherwise remain byte-identical.

## Agent

**storage-fencing-agent.** Loaded `owner-cas-mutation-testing`; recorded bounded-counter reachability and pure-quarantine equivalence lessons in that existing default-profile skill. Skills are outside the repository and not product code.

## Files inspected

- Complete `docs/internal/052-coordination-protocol.md` (530 lines) and `052-ownership-audit.md` (163 lines).
- Current `packages/core/src/runtime/storage/sqlite.js`, `src/storage/contract.js`, `src/registry/{owner,registry}.js`, `src/contracts/sigils.js`, `src/platform/{history,trace-reducer,state-invariants,transitions,event-journal,runtime-loop}.js`, `src/runtime/recovery.js`, `src/index.js`, package manifest.
- Shared `tests/storage-adapter.test.js`, relevant `tests/authority-continuity.test.js` approval fixtures and `tests/fixtures/host.js`.
- Final full/shared/new/safety/verifier logs, real worker PID diagnostics, raw SQLite rows and entry-hash preservation evidence.

`src/` and `tests/` abbreviations in this report are relative to `packages/core/`.

## Files changed

Created:

- `packages/core/src/coordination/contracts.js` — new exact SigilJS data contracts, protocol/storage constants, sanitized `CoordinationError`, checked counters/deadlines.
- `packages/core/src/coordination/state.js` — pure lease lifecycle, quarantine, owned administrative candidates, domain closing commit and dispatch cross-invariants.
- `packages/core/src/coordination/history.js` — pure complete linked replay, intermediate revision validation and projection equality.
- `packages/core/src/runtime/storage/coordinated-sqlite.js` — narrow lazy common `node:sqlite` shell.
- `packages/core/tests/coordinated-storage.test.js` — 22 shared tests.
- `packages/core/tests/coordinated-storage-worker.js` — barrier-start competing-acquisition process.
- `packages/core/tests/coordinated-owner-worker.js` — persistent independent owner/standby and independent writer-lock process.
- `docs/internal/052-fencing-implementation.md` — this report and precise handoff.

Modified only `packages/core/src/index.js`: appended the explicit experimental privileged `openCoordinatedSqliteStore` export; retained both pre-existing 051 export lines exactly. No new private reducer, credential, SQL handle or factory is root-exported. The existing package `src/**/*.js` allowlist already includes the new source; no manifest edit was necessary.

Scratch root **`S=/home/d/.hermes/cache/scratch/chord-052-pass3`** contains regenerable command logs/JSON, preservation hashes and smoke databases. It is subject to pruning, not release evidence.

## Implementation decisions

### Installed surface and isolation

```js
openCoordinatedSqliteStore({path, mode:'create'|'existing', expectedIdentity, clock?})
// Default trusted clock: Date.now; explicit dependency: synchronous clock.now().
// create requires expectedIdentity:null; existing requires exact run/incarnation.
store.init()
store.load()
store.commit({expectedRevision, credential, change})
store.checkDispatch({credential, dispatch})
store.readHistory({afterOrdinal:null, limit:1024})
store.close()
```

Successful result shapes are the accepted protocol's shapes. `load()` returns `{identity,revision,commitId,envelope}` detached from authority. The raw store remains privileged host plumbing, not an actor endpoint. The shell additionally binds supplied non-acquire credentials to the credential actually acknowledged by that handle: reading a token from disk or passing another handle's token cannot adopt ownership. Release permanently loses mutation authority on its handle; close never implicitly releases. A stale revision alone does not retire the generation or silently refresh/retry anything.

Supported `change.kind`: `acquire`, `renew`, `release`, and `admin` with the explicit existing-domain allowlist in `contracts.js`. Admin requests require `{kind,operation,nextRegistry,nextPolicy:null,audit_label}`; the next domain registry has exact-next revision, immutable committed journal prefix, optional supported unclosed diagnostics, and no newly invented/retokened active attempt. Storage appends the closing commit and linked coordination evidence. The host-maintenance allowlist is not an implemented SDK method dispatcher or actor permission claim.

**Explicit unsupported branches:** valid-owner `actor_command`, `runtime_claim`, `runtime_outcome`, `checkDispatch`, nonnull policy installation and unknown tags throw `UNSUPPORTED_OPERATION`, without writes. They do not return success or release any callable. Non-acquire writes still check owner/lease before expected revision and before unsupported-operation/payload processing. `coordination_policy` is not yet in the implemented admin allowlist. There is no `createCoordinatedChord` export.

The foundation validates exact empty policy and empty command/handoff/approval-request dictionaries. Those records cannot be fabricated as arbitrary `object` values and installed now. P4 must add their exact contracts and legal replay transitions together; P5 must add runtime transitions together. `DispatchRecord` and per-domain active-attempt cross-checks exist, but no supported Pass 3 operation can invent an active dispatch.

### Transaction and clock rules

- Exact v2 singleton layout from protocol §3; one table, no additional objects/rows. One envelope contains unchanged v1 registry/history plus coordination state/history. Both directions of v1/v2 cross-open reject; no silent migration, snapshot import or memory fallback.
- Create exclusively creates a new regular file, then `init()` builds only pristine v1/v2 genesis. Existing open pins the host-supplied run/incarnation before changing journal PRAGMAs. Initialization generates a random UUID incarnation once; owner UUIDs are nonsecret diagnostics, never authentication.
- `BEGIN IMMEDIATE`, WAL, FULL and 1000 ms busy timeout. Locked read validates full layout, headers, linked evidence and identity before decisions. Observer open/load has no clock sample, acquisition, quarantine, adapter or recovery effect.
- Trusted clock is sampled after acquiring the writer lock and loading the row, then again before candidate authorization/update. Samples are safe nonnegative integers, at least persisted floor and last local observation; no clamping. Backward samples are sticky local loss. Invalid clock values also lose the local handle's authority. Reentrancy is blocked before clock callbacks.
- Every non-acquire change validates captured run/incarnation/owner/generation and exclusive-expiry lease before revision/diagnostics. Acquire checks vacancy/expiry before revision, then checked generation allocation. Renew strictly extends expiry with fixed 30,000 ms; tied-time renewal is a zero-write `LEASE_NOT_EXTENDED`. Release retains generation and vacates nullable fields.
- All accepted mutations increment unchanged v1 run revision once, append exactly one v1 closing commit and one paired coordination commit, persist final checked clock floor and update one complete row. SQL independently predicates singleton, run, incarnation, revision, generation, null-safe owner and null-safe expiry. A zero-row update fails/rolls back.
- Acquire/release execute pure old-work quarantine in the same candidate and same singleton transaction as the lease transition. Old running/leased tasks become uncertain, operation becomes unknown, active/pending reservations of that work clear, queue expiry clears, dispatched sidecars close as quarantined. No callable/router service is involved.
- Attempted-COMMIT exceptions and failed rollback, including denial rollback, return `COMMIT_OUTCOME_UNKNOWN`/`unknown` and retire. Corrupt/unavailable storage also retires. No compensation, retry, cached authoritative state or token adoption follows unknown acknowledgement.

### Combined replay

`reduceCoordinationTrace(envelope)` is private pure plumbing. It validates whole-envelope budgets, exact genesis, complete v1 reduction, dense coordination ordinals, one-to-one closing commit IDs, operations, before/after delta preconditions, legal lifecycle/admin state and evidence, and dispatch cross-invariants at every paired domain revision; projections must equal stored state. Missing/reordered/detached/forged histories reject. Replay samples no clock and invokes no adapter. Domain-only `reduceTrace` is unchanged and still insufficient to reconstruct ownership. `readHistory` includes genesis by default, uses exclusive `afterOrdinal`, and pairs all diagnostics plus the closing event from the same validated snapshot.

### Explicit narrow implementation addenda

1. **Pure quarantine versus literal reuse of the effectful helper.** Protocol §5 asks to quarantine through the existing helper, while §4/5/12 require pure transitions under SQL and clock/UUID effects confined to the shell. Existing `markTaskUncertain` appends UUID-bearing events, reads ambient `Date.now` through `appendRegistryEvent`, and increments revision per task. Calling it literally would violate those requirements. The new pure equivalent implements its domain projection, leaving the once-per-transaction revision and closing evidence to the outer reducer. Lifecycle quarantine is evidenced by complete domain delta plus exact lease quarantine IDs, rather than extra ambient-clock diagnostics. The shared test compares nonempty running/completed/consumed-approval projections against the legacy helper, normalizing only journal and per-task revision effects. No legacy helper was modified.
2. **Counter-boundary test reachability.** Pristine revision 0, dense history, generation increment per acquire, and 1024-entry history budgets make a legitimately replayable MAX_SAFE_INTEGER generation/revision database unreachable. Accepting a fabricated high-counter genesis would violate the design. Checked generation/revision allocators are tested directly; forged unsafe/high header rows reject; actual deadline overflow and capacity errors are exercised through real SQL and leave the whole row unchanged. No valid-store MAX_SAFE_INTEGER generation/revision claim is made. Deadline addition exhaustion uses the existing `REVISION_EXHAUSTED` vocabulary rather than adding a new code. Policy counters are unsupported until P4.
3. **Foundation-stage replay is intentionally closed.** Future command/runtime records and policy payloads fail closed until their exact contracts and reducers are installed in P4/P5. This is the explicit staged permission in protocol §12, not a permissive placeholder. Full active-v2-dispatch acquisition/quarantine/result integration cannot be proved through a supported public runtime in Pass 3.

## Tests executed

Actual runtimes: Node **v24.22.1**, Bun **1.4.3**. Exact expanded command/cwd/exit records: `S/commands.json`, with final-source reruns in `S/final-source-commands.json`; full stdout/stderr in named `.log` files. `N=node` resolves to `/home/d/.volta/tools/image/node/24.22.1/bin/node`; `B=/home/d/.bun/bin/bun`. Package cwd: `/home/d/Workspace/other-projects/chord/packages/core`; root cwd for safety tests.

| Command | Exit | Observed result |
|---|---:|---|
| `$N --test tests/coordinated-storage.test.js` | 0 | 22 pass, 0 fail/skipped/cancelled/todo |
| `$B test tests/coordinated-storage.test.js` | 0 | 22 pass, 0 fail |
| `$B test` | 0 | **297 pass, 0 fail, 1661 expect calls, 22 files**: original 275 plus 22 new, not 297 new tests |
| `$N --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | Original shared 82 pass, 0 fail/skipped/cancelled/todo |
| `$B test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | Original shared 82 pass, 0 fail; includes four legacy process-restart pairs |
| `$N --test docs/internal/046-state-probes.mjs` | 0 | Original safety 21 pass, 0 fail |
| `$B test ./docs/internal/046-state-probes.mjs` | 0 | Original safety 21 pass, 0 fail |
| `$N src/verify-runtime.js` | 0 | ALL RUNTIME VALIDATIONS PASSED! |
| `$B src/verify-runtime.js` | 0 | ALL RUNTIME VALIDATIONS PASSED! |
| `git diff --check` | 2 | Only protected pre-existing whitespace at `049-final-report.md:7,99`, `release-notes-and-limitations.md:4` |
| Scoped diff/new-file whitespace and entry SHA-256 checks | 0 | Only authorized index append plus new files; no prior implementation/report/test changed |

The initial new Node run found one genuine classification defect: native SQLite unsafe-integer decoding threw `ERR_OUT_OF_RANGE` before JSON validation and was sanitized as unavailable. The shell now classifies that decoding failure as `STORAGE_CORRUPT`; final Node/Bun tests include this path and pass. No failing tests were weakened.

## Observed results

New shared tests actually exercise: identity-pinned reopen; no token adoption; observer zero-write behavior; acquire/renew/release; expiry equality; reused owner UUID with increasing generation; stale-owner precedence across all tags; stale-revision replan without generation refresh; tied/local/persisted/final-sample clock behavior; actual independent writer lock wait; reentrancy; exact contracts and descriptor safety; admin domain+diagnostic+ownership evidence; unsupported branches; complete replay tampering; layout/trigger/version/header/JSON corruption; cross-version rejection; actual UPDATE failure/zero-row predicate failure; pre/post-COMMIT exception; failed ordinary and denial rollback; unknown renew/release acknowledgements; writer timeout; deadline/capacity rollback; independent uncommitted-row isolation; pure quarantine preserving nonempty completed results and two consumed approvals; real independent owner lifecycle and acquisition races.

Each new suite executes all four Node→Node, Node→Bun, Bun→Node, Bun→Bun owner pairs. Independent contenders are barrier-ready simultaneously; exactly one generation-1 acquisition acknowledges and the other returns OWNER_HELD. Persistent owner peers both stay alive across renew/release/reused-owner acquisition and expiry takeover; stale peers leave the exact raw row unchanged. Worker-reported PID equals spawned PID. Final lifecycle state is revision 5, generation 3, complete replay/history matching. These are **storage owner processes**, not authenticated actor contributors or adapter-effect proofs.

Final Node suite persistent peer PIDs: N→N **232325/232326**, N→B **232340/232341**, B→N **232368/232369**, B→B **232398/232399**. Final Bun suite: N→N **232618/232619**, N→B **232640/232642**, B→N **232673/232674**, B→B **232701/232702**. Exact diagnostics remain in `S/new-node.log` and `S/new-bun.log`.

## Invariants demonstrated

- **OWN-01/02/04/06 storage subset:** independently competing processes have one valid acknowledged owner, generations do not reuse across release/expiry/owner-ID reuse, old captured owners cannot perform supported lifecycle/admin writes or get through future-tag fencing, and readback cannot refresh authority.
- **STA:** canonical registry, lease, logical floor and complete linked evidence are one conditional atomic row; stale/error/confirmed rollback paths leave exact authoritative bytes unchanged. Unknown acknowledgement retires rather than guesses.
- **REP:** combined replay exactly matches projections, checks intermediate lifecycle/admin revisions and rejects forged evidence; legacy replay and exact schemas remain unchanged.
- **REC foundation:** observers do not recover; lifecycle candidate quarantine is pure/effect-free and coupled to ownership in one SQL write. Pure quarantine semantics are independently compared against nonempty legacy fixtures. **No public active-v2-runtime recovery integration claim.**
- **Compatibility:** all 275 original tests, shared 82 on each runtime, safety 21 on each runtime, runtime verifier and original process-restart tests pass. No legacy owner/storage/runtime branch was modified.

## Known limitations

Trusted single-host clock/filesystem/OS/SQLite/host-code assumptions remain. Raw SQL/filesystem/host SDK possession is outside an actor JSON sandbox. Backup rollback/clones/live path replacement are unsupported; identity pinning does not make generations global across restores. No authentication endpoint, actor commands/receipts, coordination policy installation, public coordinated factory, dispatch/outcome reducer, final authority check, downstream context, external fence/idempotency enforcement or exactly-once effect guarantee exists in this pass.

The combined reducer currently revalidates v1 prefixes for each paired revision (bounded but quadratic replay work) and the whole row is synchronously checked multiple times per write. Existing budgets cap state/history; no pruning/compaction occurs. Renewals consume that capacity. Full active-sidecar quarantine and old-success/old-throw callback protection require P5 integration and later process/adversarial proofs. Pure fixture projection and empty-work SQL lifecycle proofs must not be advertised as those missing proofs.

## Blockers

**None to Pass 4 within the accepted staged foundation. Live coordinated scheduling remains BLOCKED.** Unsupported tags and exact empty future dictionaries are intentional fail-closed gates. All publication/legal/identity/artifact blockers from 050/051 remain separate and unchanged. Counter-reachability and effectful-helper contradictions are resolved narrowly above, without changing identity, authority, atomicity, evidence or legacy contracts.

## Next pass: READY or BLOCKED

**READY — Pass 4 ingress-agent only under the parent's sequence.**

P4 must:

1. Extend `src/coordination/contracts.js` with exact policy, trusted binding, command, response/receipt, handoff and approval-request records; retain existing whole-envelope budgets and safe own-key access. Empty placeholders are not authorization.
2. Add pure command/authorization reducers and extend `src/coordination/history.js` with legal per-revision actor/policy transitions and evidence checks, not just accept opaque receipt/policy deltas.
3. Add `actor_command` and `coordination_policy` branches in `src/runtime/storage/coordinated-sqlite.js` **inside the existing fenced transaction**, preserving owner-before-revision/diagnostics and duplicate receipt-before-command-revision ordering. Return original exact receipt without writing on an authorized duplicate; response commit identity must be preallocated and persisted atomically.
4. Build host-bound dedicated-channel ingress with fresh authentication, bounded JSON allowlist, current authority/scope/policy and zero-write filtered reads. Do not pass raw store, credentials, database path, SDK or generic dispatcher to children. Actual distinct actor-channel proofs remain required.

P5 then must:

1. Add private coordinated owner/admin facade and explicit `createCoordinatedChord` composition; never instantiate the legacy durable constructor first. Acquire acknowledgement must precede usable scheduler/router recovery exposure.
2. Add runtime claim/outcome reducers and matching replay variants together; capture immutable DispatchRecord and credential per attempt; allow unrelated run revision advancement without weakening authority/task/attempt checks.
3. Replace the current explicit unsupported `checkDispatch` with complete authoritative owner, lease, exact active attempt/sidecar, run/task lease and commit-stage authority checks. Do not simply remove the unsupported error.
4. Fence both success and throw before any diagnostic/uncertainty mutation, rejecting missing/replaced attempt too. Runtime/result persistence errors stay outside adapter catch. Wire every mutation in the Pass 1 checklist or omit it from the facade.
5. Prove **actual populated v2** acquire/release quarantine, same-generation renewal during pending effect, stale success and throw after takeover/reconciliation/new attempt, no callable on failed claim/final check, and honest downstream fencing/idempotency race. Existing pure quarantine equivalence is not a substitute.

Passes 6–9 retain independent multiprocess actor/effect, adversarial, documentation and final-review gates. No later pass has been executed by this agent.
