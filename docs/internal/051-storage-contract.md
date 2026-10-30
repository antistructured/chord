# 051 — Accepted local storage contract

## Pass

**B1 — durability-design-agent. Gate: PASS / READY FOR B2 within the bounded contract below. Design only; no B2 implementation.** The user's authorization to choose the smallest compatible local durable implementation resolves the proposed decisions in 050; it does not authorize a dependency, contract-version change, distributed claim or publication. This document is the implementation input, not a claim that storage already exists.

Repository: `/home/d/Workspace/other-projects/chord`, branch `base`, HEAD `08728e48772db14a247add9143669a8e0eab01fa`, including its pre-existing dirty 050 changes. `050-final-report.md` A3 explicitly authorizes 051. Existing privileged host administration remains privileged: possession of the SDK reference is the capability, not a credential in a commit request.

## 1. Accepted scope and decisions

Implement **one local SQLite file, one run, whole validated registry JSON per revision, synchronous reads and transactional CAS**. The JSON contains canonical state, execution/reconciliation evidence and the complete ordered journal. There is **one authoritative row**, not separate independently writable state/history/evidence copies. Inspection derives from that row. A durable JSON array preserves journal position; a separate journal table is unnecessary at this scale.

Supported execution is **one active embedding runtime per run**, including sequential process restart. Storage handles may concurrently inspect or contend on CAS; their transactions must serialize and reject stale revisions. This is not authorization for two active schedulers, live-peer recovery, distributed leases, automatic ownership takeover, or Proof 3. The embedding host must ensure the old runtime is stopped before restart recovery; a second live runtime is an unsupported deployment, not something inferred safe from a timestamp or a CAS test. A store-only CAS winner is not proof of an exactly-once effect.

| 050 decision | Accepted B1 choice / rationale |
|---|---|
| D1 provider | SQLite built-in; no added dependency. JSON rename requires separate locking/fsync discipline without reducing the hard parts. |
| D2 import policy | **Use only `node:sqlite` through `node:module#createRequire`**, loaded lazily when durable storage is requested. Both measured runtimes support it. No computed `bun:` import, architecture-test loophole or new package is needed. Add a positive binding-selection test later, retaining ARCH-18. |
| D3 runtimes | Local Linux **Node v24.22.1 and Bun 1.4.3**, using `node:sqlite#DatabaseSync`. These are measured versions, not a minimum-version or all-platform claim. Older runtimes without this API return `UNSUPPORTED_RUNTIME`; no fallback to memory or another provider. Bun's `process.version` reports v26.3.0; identify Bun by `Bun.version`, not that compatibility string. |
| D4 sync | File-backed WAL, `synchronous=FULL`, bounded `busy_timeout=1000` milliseconds; query back all three settings. Failure to establish them aborts opening. FULL relies on SQLite/OS/filesystem/device honoring sync; no power-cut guarantee was experimentally established. |
| D5 amplification | Accept O(entire registry including history) read/validate/encode/write per commit. This is deliberately smaller than 050's normalized multi-table proposal. |
| D6 recovery | Storage `open/load` only validates, never invokes adapters or changes domain state. Durable SDK construction automatically completes effect-free recovery **before returning a usable SDK**. Keep recovery above the raw store to avoid a storage/owner import cycle. |

**Explicit bounded supersession of 050 proposals:** no extra evidence table, journal table, lease/fence allocator, staged effect-ack table, idempotency plumbing, migration chain, JSON-file alternative, generic provider selector or deterministic-ID refactor is necessary for this first local store. Committed results and reconciliations already are evidence inside `RegistryData`. Missing result commits remain unknown and quarantined, including an adapter return lost before its result commit. These choices intentionally do **not** satisfy full Proof 2 W3 acknowledgement recovery, fencing negatives, deterministic fresh-run bytes or Proof 3. Keep those proof gates deferred; do not relabel a subset as a passing proof or promote the product to Level B. Product-contract §5.3's entire promotion gate remains outstanding.

The snapshot format stays `0.3.0`, contracts `chord.contracts.v1`, history `chord.history.v1`. Storage format is independently `chord.local-store.v1`. No contract field is added. Full snapshots remain host-only exports/imports, not live store recovery.

## 2. Exact synchronous interface (JSDoc in JS ESM, not TypeScript source)

Recommended new modules: `src/storage/contract.js` (pure validation / error vocabulary / JSDoc), `src/runtime/storage/sqlite.js` (narrow SQLite shell), `src/runtime/recovery.js` (effect-free startup coordinator). Paths here are relative to `packages/core/`. Add an in-memory adapter only if sharing the existing owner path actually requires it; no extra abstraction for its own sake.

```js
// Trusted host only; path is an absolute regular local-file path, not a URI,
// network share or :memory:. Parent directory provisioned by the host.
openSqliteStore({ path, mode: 'existing' | 'create', busyTimeoutMs: 1000 })
  // -> Store synchronously; throws typed error on failure

// create creates ONLY a new/empty Chord database, never overwrites a run.
// existing never creates a missing file or initializes an empty one.
store.init({ initialRegistry, logicalNow })
  // -> { ok: true, revision, commitId } (genesis event id)
  // Explicit init, permitted only for an uninitialized create-mode handle.
store.load()
  // -> { registry, revision, commitId, logicalNow, storageVersion }
store.compareAndCommit({ expectedRevision, nextRegistry, operation, logicalNow })
  // -> { ok: true, revision, commitId }
  //  | { ok: false, code: 'STALE_REVISION', revision: storedRevision }
store.readHistory({ afterOrdinal = 0, limit = 1024 } = {})
  // -> { revision, commitId, entries: [{ journalOrdinal, event }], hasMore }
store.close()
  // -> undefined; idempotent, never implicitly commits
```

All methods synchronous: no promise, async callback or await in an owner's critical section. `init`, `load` and `compareAndCommit` return detached validated data; nothing exposes the database, statements, mutable stored references, owner or SDK. `compareAndCommit` request has exactly the stated fields; there is no caller-authored evidence array or success flag. `logicalNow` and revisions must be nonnegative safe integers; increment overflow rejects. `operation` is a nonempty bounded string matching the final history capture. `commitId` is the final `state_committed.event_id` (genesis id at initialization), **not a new caller credential or token**. Journal event uniqueness plus immutable prefix prevents reusing it for another commit.

`open` creates/checks the physical layout; `init` durably publishes the initial run. Neither starts scheduling. `create` encountering any initialized store fails `STORE_ALREADY_INITIALIZED`, even for the same run; reopening requires `existing`. Empty physical schema left by a failed creation is distinguishable from an initialized run; only explicit create/init can complete it. `load` on it fails `STORE_NOT_INITIALIZED`. Never interpret a parse/check/version error as an empty database. `init` accepts a validated registry with a complete reducible journal, including genesis; it must not invent genesis from a nonempty incomplete history. Construct genesis with the existing owner history helper before init if starting a fresh run. An explicitly imported/quarantined snapshot may initialize a **new** store only after full history validation; there is no implicit migration/repair of an existing store.

`readHistory` reads the same authoritative row once, validates it exactly as `load`, then slices journal **array order**. `journalOrdinal = array index + 1`, dense and stable because existing entries cannot change. Validate `afterOrdinal` as a nonnegative safe integer and `limit` as 1..1024; no timestamps, audit sort order or `payload.sequence` substituted for ordinals. `revision/commitId/hasMore` describe that single read snapshot. Separate history calls can observe later appended commits, but cannot see rewritten prefixes.

### Error and acknowledgement outcomes

Except the explicitly returned revision conflict, failures throw a sanitized `TypeError` with `code`, `path: '$'` and (for mutating operations) `commitStatus: 'not_committed' | 'unknown'`. Do not add storage errors to authorization `Decision`/`DECISION_CODES`, or pass them through `contractError` which maps unknown codes to `INVALID_DATA`. Use a small storage error constructor; never expose SQL, filesystem paths, inputs or credentials in messages.

| Outcome / code | Exact meaning and permitted response |
|---|---|
| `{ok:true, revision, commitId}` | `COMMIT` returned successfully with required settings. State, journal and matching embedded evidence committed together. Only now may owner return a successful mutation or invoke its prepared dispatch. |
| `STALE_REVISION` returned | Valid expected revision does not equal the transaction's stored revision. This request wrote nothing. Owner discards its candidate and prepared invocation; caller may reload and explicitly re-plan. No auto-replay of callback or adapter. |
| Validation codes (`INVALID_CONTEXT`, contract codes, `RUN_MISMATCH`, `SCHEMA_MISMATCH`, `INVALID_HISTORY`, `INVALID_TRANSITION`, `IMMUTABLE_TASK`) | Request rejected before COMMIT, confirmed rollback if a transaction began: `not_committed`. Caller bug/domain rejection; not an I/O retry instruction. |
| `STORAGE_UNAVAILABLE`, `not_committed` | Cannot acquire writer transaction (including busy/locked), or pre-COMMIT I/O failure with positively confirmed rollback. No write from this request. Explicit later retry is allowed after reload, not automatic redispatch. Busy timeout is bounded blocking, not `STALE_REVISION`. |
| `COMMIT_OUTCOME_UNKNOWN`, `unknown` | COMMIT was attempted and threw, rollback/connection state is uncertain, or acknowledgement was lost. **Never equate exception/no acknowledgement with rollback.** Retire handle and owner from mutation/dispatch; resolve by reopening and reading durable identity. No compensating commit or automatic retry. |
| `STORAGE_CORRUPT` | Physical check, decoding, metadata/history/registry consistency failed. Fail closed. Request has not committed if failure occurred before COMMIT. Isolate database for operator examination; no repair, truncation, empty-state fallback or overwrite. |
| `UNSUPPORTED_STORAGE_VERSION`, `SCHEMA_MISMATCH`, `UNSUPPORTED_RUNTIME` | Unsupported format/contracts/runtime; abort, never migrate or fall back silently. Versioned-store decoder inspects metadata before asserting version-pinned registry shapes. |
| `STORE_NOT_INITIALIZED`, `STORE_ALREADY_INITIALIZED`, `STORE_CLOSED` | Explicit lifecycle failures; no implicit init, replace or reopen. |

A conservative implementation may classify **every COMMIT exception as unknown**, even when SQLite likely rolled back; it must not falsely classify a possible success as failure. A cleanly caught pre-COMMIT error with successful ROLLBACK is known absent. Failed rollback is unknown. Disk-full/I/O errors are not generically safe-to-retry merely because a lock timeout is. Unexpected programming errors must still release/retire transaction/handle safely, not be swallowed as stale conflicts.

**Resolve ambiguous commit acknowledgement:** retain proposed run id, expected/next revision and final commit id outside the transaction. Reopen and fully validate the store. If the journal includes that commit id at the proposed revision with the exact proposed suffix/delta (and therefore the same candidate at that revision), the write committed even if later commits followed. If the same run's valid current journal is still at the base revision, or a different commit occupies the proposed revision and the proposal id is absent, this proposal did not commit. If read fails, store identity changed, or facts conflict, outcome remains unknown; stop. No history pruning is allowed, so identity remains inspectable. This resolves **local commit truth**, not whether an external effect occurred. A process killed before returning cannot deliver a typed result at all; its replacement uses the same rule, never absence of a return value.

## 3. Physical layout and authoritative transaction

Smallest layout: one singleton table (illustrative SQL, to be implemented/tested in B2):

```sql
CREATE TABLE chord_store (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  storage_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  run_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 0),
  logical_now INTEGER NOT NULL CHECK(logical_now >= 0),
  commit_id TEXT NOT NULL,
  registry_json TEXT NOT NULL
);
```

Header columns are consistency/index fields in the **same authoritative row**, never a second source of registry truth. No separate copy of authority, execution evidence or history. Check row count, schema/table shape and all header-to-JSON relationships. A pre-existing nonempty foreign database, missing expected schema, malformed row or unsupported storage version fails closed; `CREATE TABLE IF NOT EXISTS` must not silently adopt one. SQL layout checks are not a substitute for domain validation. New layout creation/init are transactional; do not stamp a known version over unknown bytes. No v0 migration exists; unknown older or newer versions both reject.

On each handle set/check WAL, FULL and timeout. Run `PRAGMA quick_check` on open; require `ok`. On load, one SELECT fetches the whole row from a committed SQLite snapshot, so there is no multi-table torn read. Before parsing enforce the existing byte budget; reject oversized stored JSON as corrupt, not a reason to bypass limits. Parse JSON as data, then use Sigil-backed `RegistryData.assert`; compare row run id/schema/revision and last history id with decoded content. Validate `logical_now` as safe integer. `reduceTrace(registry.event_journal)` must succeed and its full registry equal the stored registry via `sameData`. Never reconstruct and silently replace a disagreeing stored projection. Preserve reducer cause codes in tests/internal diagnostics; public store corruption remains `STORAGE_CORRUPT` (raw reducer tests retain `UNSUPPORTED_HISTORY`/`INCOMPLETE_HISTORY`). Physical integrity is not protection against a trusted writer coherently rewriting bytes; no cryptographic tamper claim.

`init`: BEGIN IMMEDIATE; confirm supported layout and zero initialized rows; validate complete candidate/history/run metadata; INSERT singleton with matching commit id and logical floor; COMMIT; only then return success. Competing init has one winner, never INSERT OR REPLACE. Rejected initialization does not create partial canonical/evidence content.

`compareAndCommit`, with its input detached/shape-checked before acquiring lock:

1. BEGIN IMMEDIATE. No write precondition relies on a prior SELECT or owner cache.
2. Read and fully validate the current authoritative row **inside this transaction**.
3. Compare expected revision to stored revision; rollback/return stale conflict if unequal.
4. Validate candidate with RegistryData, same run/schema, exact safe `stored + 1` revision, immutable journal prefix (`sameData`, including array order), and `assertCanonicalTransition(stored, candidate, operation)`.
5. Require exactly **one** new closing `state_committed`, last in suffix, matching operation/history version, next sequence, previous event id/revision. All preceding new diagnostics must be supported, stamped with candidate revision and listed in order in `diagnostic_ids`. Re-run reducer over full candidate journal and require complete equality. Also require recorded `changes` equal `stateChanges(canonicalProjection(stored), canonicalProjection(candidate))`. This binds the commit evidence to the actual candidate, rather than accepting plausible unrelated history.
6. Encode the asserted candidate. UPDATE singleton payload, revision, commit id and `logical_now = max(stored.logical_now, request.logicalNow)` together, using `WHERE singleton=1 AND revision=?`; assert exactly one changed row as defense in depth. Preserve run/storage/schema identity. No other independently acknowledged write exists.
7. COMMIT. Return success only afterward. On precommit failure rollback; apply the acknowledgement rules above. No await or host callback runs inside SQLite transaction.

The existing pure transition/history rules stay in pure modules. Validation runs in a pure shared function called **inside** this transaction, not by invoking the mutating legacy `registry.js#commitRun` on a throwaway owner. Authoritative validation is mandatory even if owner fast-fails the same candidate first. Large-run performance can be revisited after correctness; no delta index/cache/checkpoint now.

## 4. Owner and SDK integration recommendations

Add a private optional store port to `createStateOwner` and host-only `createChord({ storage: ... })`; do not change synchronous `createChord` into a promise. Export a factory only if needed by the final supported host API; keep SQLite handle and constructors out of actor packets/projections. Lazy synchronous `createRequire(import.meta.url)('node:sqlite')` in the shell was probed on both runtimes. Catch only binding load errors as unsupported runtime; do not mask open/validation failures that happen afterward.

For existing in-memory calls preserve the current behavior and tests. For durable calls, the store is authoritative:

- SDK startup opens/loads or explicitly creates/initializes **before** exposing an owner. Never instantiate an independent new run and later overwrite the store with it. If durable storage and `options.registry` conflict, reject rather than choosing one. Persisted authority is canonical policy data, not rebootstrap input.
- Every durable owner `read` loads a fresh validated detached registry. Any optional local last-read object is disposable working data, never an independently mutable authority. On each transaction load before selecting/building draft; expected revision defaults to this loaded revision, not a stale default argument evaluated against a cached field. Retain local `busy` guard before running user callbacks.
- Keep clone/apply, reject async callbacks, stamp revision/dispatch revisions/diagnostic revisions and capture history as today. Then call `store.compareAndCommit`; **remove the durable path's in-memory `commitRun` swap as its commit point**. Only store success publishes the result. Discard draft and detached callback result on conflict/failure. Never call apply twice automatically: host callbacks can have side effects.
- Host `install` still accepts exactly HostCommitRequest, rejects altered journal and wrong next revision, and creates its own `host_commit` capture. Pass it through the same authoritative store CAS; do not trust caller-supplied operation/history. Maintain the documented trusted-host maintenance powers; storage is not a new admission/sandbox layer.
- `sdk/chord.js` currently keeps a second `registry` alias and swaps it around callbacks. Refresh it from the current transaction draft only while executing the action, and from authoritative owner state at the next operation boundary; use `finally` on failure. Audit **all** reads, especially setters' early revision checks, `createApproval`, `createTaskGrant`, export, runtime and inspection. A stale closure alias must not precompute authority or admissions. Existing direct defaults after owner creation (`task_queue ||=`, etc.) must not mutate a store-loaded live reference outside a commit.
- `runtime-loop.js` claims synchronously **before** `await invoke()`. Keep adapter getter validation in the owner busy section, but do not invoke on failed/conflicted/unknown claim. Resolve no new host properties between acknowledged claim and invocation. The current broad `try/catch` includes result storage: distinguish storage/commit-unknown errors from adapter errors **before** attempting `runtime_uncertain`; an unknown durable result commit must not trigger a second write over possible success. If a known result write failed after an effect, stop and leave the durable claim recoverable, never schedule a retry of the effect.
- On a storage-unknown result or unavailable authoritative read, freeze further SDK mutation/dispatch and require explicit reopen/recovery. Inspection failure is not permission to return an old successful cached view. A rejected known mutation leaves canonical state unchanged; a stale conflict may mean a peer changed it, so refresh rather than claiming global unchanged state.
- Persist only validated RegistryData plus storage metadata/floor. Do **not** serialize `trustedHost`, authentication credentials/tokens, adapters, router, callbacks, id source, functions, API handles or options bags. Persisted AuthoritySnapshot contains declarative principal/grant/approval facts already in the contract; those are not bearer login credentials. Host executable/authentication services must be supplied anew. Application-authored spec/result payloads can contain secrets; there is no automatic content scrubber or database encryption claim.

### Restart recovery (supported local model)

Raw load returns exactly the durable registry, not a quarantined projection disguised as stored state. The durable SDK startup then, under host-assured exclusive runtime use, detects `leased`/`running` tasks. Do not infer that they are safe because a wall-clock lease is still live: in this supported restart model the old process is dead, not a live peer. Mark all such tasks uncertain through one ordinary owner transaction using `markTaskUncertain`, preserving operation unknown state, consuming no new approval, clearing attempts and recording supported diagnostic/history events. Commit the sweep before returning a usable SDK. Failure/conflict/unknown sweep aborts construction; no degraded scheduler or memory-only fallback. A completed result already durably committed stays completed. Reopening a swept store is idempotent (no second sweep revision without in-flight work).

No adapters/router resolution in recovery, no importRegistry call, no rerun of a cycle, no reuse of pending dispatch after quarantine. `replayTask` keeps requiring evidence-backed human reconciliation, explicit fresh admission and current authority. This conservative local recovery loses a returned-but-uncommitted adapter result; it does not invent success or nonexecution. A live-peer lease-aware recovery protocol is deferred, not approximated by testing local timestamps.

Store `logicalNow` is a host policy-clock floor, not event ordering or permission renewal. On restart initialize the host clock as `max(persistedFloor, firstValidRawTime)`; subsequently require nondecreasing effective readings. Each commit receives the owner's observed effective policy time, persisting its maximum. Ambient journal timestamps and fresh IDs remain nondeterministic and cannot be advertised as fully injected or byte-identical fresh executions. Ordinals/CAS/history do not depend on clock ordering. Expired credentials/grants/approvals do not become valid merely because their records survived restart.

## B3 integration addendum (explicit, bounded)

- The host API is synchronous `createChord({ storage: { path, mode: 'create' | 'existing', busyTimeoutMs?: 1000 }, trustedHost?, adapterRouter?, runtimePolicy? })`. Omit storage for memory. Combining storage with `registry` rejects; existing storage also rejects a non-null constructor `trustedHost.authoritySnapshot`, rather than rebootstrap persisted authority. Use explicit `setAuthoritySnapshot` after reopen if the host intends an administrative change. No generic injected-store/provider host option is added.
- `sdk.close()` is synchronous/idempotent and releases its owner/store; it does not drain, cancel, compensate, implicitly commit or revoke effects. Hosts should await cycles before close. Closing an in-flight cycle leaves its acknowledged claim durable; its eventual result write rejects and later restart quarantines it. Data-only shaping/parser helpers and router/policy configuration are not a reopened owner. Reads/mutations/dispatch fail closed after retirement.
- Any unavailable/corrupt authoritative read retires the owner. An unknown write or I/O-unavailable write retires it as well (the latter is stricter than raw-store retry permission); explicit close/reopen is required. Domain/validation rejection and stale conflicts do not replay callbacks. No post-success authoritative read can replace an acknowledged mutation result with a new storage error.
- Recovery uses an ordinary `restart_recovery` owner commit and the shared `markTaskUncertain`. Add the conservative `leased -> uncertain` task edge so a durable leased reservation can be quarantined using the same helper and validated reducer, rather than special-case installing an illegal transition. Quarantine clears pending/active attempts and queue lease expiration; completed facts and queued approval reservations are untouched. This is a quarantine edge, not new authority to redispatch.
- Durable effective time is `max(latest observed persisted floor, valid raw host time)`, required nondecreasing against previous effective observations. Every owner commit records it. A backward raw reading below the floor may be clamped (never renews authority); an effective regression above that floor still rejects. Memory retains its previous raw-clock rejection behavior. The floor is observed from each authoritative read, not a separately writable policy record.

## 5. Tests required of the implementation (not B1 results)

- Same contract suite under Node v24.22.1 and Bun 1.4.3 with **node:sqlite**, including lazy construction retaining memory-only use when SQLite is unavailable. Reject async callbacks and reentrant host execution as before.
- New/empty/existing lifecycle; no accidental overwrite/reset/memory fallback; competing init one winner; close idempotent and operations-after-close reject; restart nonempty run, authority, reconciliation, snapshots and journal remain equal before recovery changes.
- Every transaction predicate independently rejected with no partial canonical/evidence change: wrong run/schema/revision, bad prefix/order/diagnostic linkage/delta/operation, invalid transition, malformed registry, duplicate ids, foreign metadata, overflow, size limits. Preserve existing privileged-host and actor-data isolation tests.
- Atomic embedded state plus matching history/evidence; injected failures before COMMIT roll back; successful acknowledgement survives new-process reopen; kill a child **mid-transaction** and **after COMMIT before acknowledgement**. Unknown latter acknowledgement resolved by commit identity, never assumed absent. Do not claim power-loss testing from SIGKILL.
- Two independent OS processes race store-only CAS at a barrier: exactly one +1 revision, loser stale, loser invokes no adapter. Independent read during uncommitted update sees old whole row, after commit sees new whole row. Lock timeout typed distinctly. Two handles in one process is only an initial probe, not this proof.
- Alter bytes/layout/version/header/payload/journal/state independently; quick_check or semantic load fails closed with no rewriting. Valid JSON alone is insufficient. Missing version/schema rejects; unknown version is not migrated.
- Full ordered history with tied/backward timestamps; ordinal pagination and hasMore count correct; reducer equality. No compaction. Raw reducer missing genesis/gap retains existing codes; load maps invalid stored history to corrupt.
- Startup recovery kills before/inside/after invocation and result commit; zero recovery adapter resolutions/invocations; uncommitted effect becomes uncertain, committed completion stays completed; unknown cannot readmit without existing reconciliation. Storage errors must not be swallowed by runtime's adapter-error catch or invoke a second effect.
- Logical-floor restart with a backward raw clock; no expiry-window relaxation. Credentials/options/callbacks absent from stored payload and adapter args; detached mutation cannot modify durable state.

## Files inspected

Read `050-durable-coordination-design.md` **in full (1–1345)**, the product/API/proof documents (with special attention to release levels, trusted-host boundary, Proofs 2/3 and deferred decisions), and `050-final-report.md`. Live source inspected: `packages/core/src/registry/{owner,registry,snapshot}.js`, `src/sdk/chord.js`, `src/contracts/sigils.js`, `src/platform/{history,trace-reducer,state-invariants,event-journal,runtime-loop,transitions}.js`, `src/execution/task-packets.js`; package manifest and `tests/architecture-integrity.test.js`. Abbreviated `src/` paths in this paragraph are package-relative. Symbol locators elsewhere mean search named functions/members, not generated anchors.

Key verified discrepancies from old proposals: Bun 1.4.3 now exposes `node:sqlite`; the registry array contract limits journal to 1024 entries and the **whole registry** to 1 MiB/16384 nodes (other per-field limits also apply); storing outside the registry does not authorize bypassing them. Historical 050 assertions of unbounded history growth and a mandatory runtime-binding split must not be carried forward as current facts. Current source has no durable store; design/module names above are recommendations only.

## Files changed

Created only **`docs/internal/051-storage-contract.md`**. Scratch probe and SQLite files created outside the repo under `/home/d/.hermes/cache/scratch/` (`chord-b1-probe.mjs`, `chord-b1-node/`, `chord-b1-bun/`). Entry file hashes captured in `chord-b1-entry.json` for preservation comparison. No production code/test/manifest/lock changes, dependency installs, commits, push, tags, publication or destructive Git actions.

## Test commands

All version/probe commands ran from repository root; suite/runtime validation from `packages/core`. Probe uses assert-backed real file SQLite transactions, not fabricated responses. Source is retained in scratch, subject to scratch pruning.

| Command | Exit | Result |
|---|---:|---|
| `node --version`; `/home/d/.bun/bin/bun --version` | 0 each | v24.22.1; 1.4.3 |
| `node /home/d/.hermes/cache/scratch/chord-b1-probe.mjs` | 0 | node:sqlite import/require work; bun:sqlite unavailable (`ERR_UNSUPPORTED_ESM_URL_SCHEME` / `MODULE_NOT_FOUND`); file transactions pass. |
| `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-b1-probe.mjs` | 0 | **Both bindings import/require work**; bun:sqlite file transactions pass. |
| `CHORD_PROBE_SQLITE=node:sqlite /home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-b1-probe.mjs` | 0 | Selected common node:sqlite binding also passes file transactions under Bun. |
| `/home/d/.bun/bin/bun test` | 0 | **193 pass, 0 fail, 1617 expect calls, 16 files.** |
| `/home/d/.bun/bin/bun run src/verify-runtime.js` | 0 | `ALL RUNTIME VALIDATIONS PASSED!` |
| `git diff --check` | 2, pre-existing | Three trailing-whitespace lines in `049-final-report.md` and `release-notes-and-limitations.md`; preserved. |

Every SQLite transaction probe verified WAL=`wal`, FULL=`2`, busy timeout=`25` ms (shorter **probe-only** value), old-row reader isolation while writer transaction pending, contender lock rejection, rollback retaining only base state/evidence, first CAS success/second stale, reopen revision 1 plus both expected evidence rows, and quick_check=`ok`. Node/common binding reports busy as `ERR_SQLITE_ERROR` with SQLite errcode 5; Bun's native binding reports `SQLITE_BUSY` with code 5. Normalize numeric SQLite cause internally instead of assuming `.code` string parity. The probe's extra evidence table tests the engine's cross-table rollback capability; the accepted application layout intentionally needs only one table/row.

## Exit codes and results

All final behavioral commands exited 0; expected cross-binding unavailability on Node was caught and reported, not a failed test. Whole-tree whitespace check exits 2 only on preserved existing lines. Probes establish available synchronous APIs and local transaction behavior, **not a Chord storage implementation, independent-process contention, crash recovery, power-failure safety, or proof promotion**. Final Python entry/exit comparison exited 0: all **614 pre-existing files unchanged**, exactly this report added, required report headings present and no trailing whitespace in the report.

## Invariants verified

- Existing suite/runtime still pass against the dirty reviewed tree; no pre-existing production behavior changed in B1.
- Synchronous embedded SQLite transaction boundary is available without new dependencies in both explicitly measured runtimes, including a shared node:sqlite binding.
- Accepted design has one authoritative durable row, in-transaction stored-revision CAS, matching history/evidence validation and no independently installable cache.
- Failed, conflicted and unknown acknowledgement outcomes are distinct; no blind redispatch, cache fallback or false rollback inference is permitted.
- FCIS preserved: pure Sigil/data/history/transition checks and a narrow synchronous I/O shell. Full SDK and store handles remain host capabilities; credentials and executables are not persisted.

## Known limitations

Only tested Linux/runtime versions are in scope. SQLite sync correctness relies on its actual VFS and storage medium; local probes do not prove power-loss durability. FULL and a one-second lock wait block the event loop; whole-run validation/replay and serialization are O(state including journal). Current Sigil limits bound run length (including **1024 journal events**); reaching a limit must fail before effect dispatch, not truncate evidence. No compaction, cryptographic integrity, database encryption, schema migration, automatic secret scrubber, credential persistence, distributed consensus, lease takeover, staged effect acknowledgement, exactly-once claim or Level B promotion. A trusted host can still make legal but unwise administrative commits; exposing the host SDK to actors remains a deployment boundary failure.

## Blockers

**No genuine blocker to B2 implementing this bounded local storage contract.** Full 050 Proof 2 and Proof 3 remain blocked/deferred on their additional capabilities and execution evidence, not silently waived. A requirement to support concurrent live schedulers or complete staged-ack recovery would require a separately authorized extension to this accepted scope. Distribution/legal/identity/artifact gates from 050 remain unchanged and do not block this local engineering design.

## Next-pass readiness

**B1 COMPLETE; B2 READY for implementation only when separately invoked.** Implement pure contract + lazy synchronous node:sqlite shell with the singleton full-registry row, lifecycle rules, in-transaction CAS and unambiguous error/status behavior first; exercise the shared adapter suite under both measured runtimes. Then integrate owner/SDK/recovery exactly as §4 in the later authorized passes. Do not implement leases or a competing cache/evidence authority opportunistically. No B2 code was written in this pass.
