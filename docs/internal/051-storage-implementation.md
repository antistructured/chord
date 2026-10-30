# 051 — Storage implementation

## Pass

**B2 — storage-agent: PASS for the raw local persistence adapter; READY FOR B3 integration/recovery.** This is not durable SDK integration, crash-recovery proof, Level B promotion, or exactly-once execution. The accepted input is `051-storage-contract.md`, read in full. No B3 coordinator, owner port, SDK storage option or scheduling change was implemented.

The smallest real implementation uses built-in `node:sqlite#DatabaseSync`, loaded synchronously and lazily through `node:module#createRequire`. No dependency, manifest, lockfile, snapshot version, history version or contracts version changed.

## Interface and usable persistence gate

Trusted hosts can import `openSqliteStore` from `@antistructured/chord` (the existing root export). The returned frozen object exposes only:

```js
openSqliteStore({ path, mode: 'create' /* or 'existing' */, busyTimeoutMs: 1000 });
store.init({ initialRegistry, logicalNow });
store.load();
store.compareAndCommit({ expectedRevision, nextRegistry, operation, logicalNow });
store.readHistory({ afterOrdinal: 0, limit: 1024 });
store.close();
```

All methods are synchronous. `busyTimeoutMs` can be omitted; another value rejects. Paths must be absolute regular-file paths with a host-provisioned parent, not symlinks, `:memory:`, or URI/provider selectors. The host remains responsible for using a local filesystem, not mounting network storage behind a local-looking path. Fresh files are exclusively created with mode `0600` (subject to umask); existing permissions are not rewritten.

Initialization accepts complete owner-generated history, not a bare `createRegistry()` with no genesis. Existing `createStateOwner(...).read()` and `createChord().getRegistry()` outputs are usable inputs. A commit accepts exactly one owner-generated next revision with its complete closing capture, using the capture's operation. It does not accept a naked edited projection, arbitrary history replacement, multiple batched revisions, caller evidence list, or an authentication token.

`init`/commit acknowledge `{ok:true, revision, commitId}` only after COMMIT returns. Stale CAS returns `{ok:false, code:'STALE_REVISION', revision}`. `load` returns detached `{registry, revision, commitId, logicalNow, storageVersion}`; history returns `{revision, commitId, entries:[{journalOrdinal,event}], hasMore}`. Errors are sanitized TypeErrors with `code` and `path:'$'`; mutation errors additionally distinguish `not_committed` from `unknown`. Unknown outcomes retire the handle; later reads and mutations fail `STORE_CLOSED`.

**Usable gate:** real disk initialization, one-revision owner-generated commits, CAS, detached inspection/history, and new-process reopen work under both measured runtimes. Tests also initialize from real SDK execution state, preserve completed outcomes/authority, and persist a real SDK reconciliation next revision. These are explicit copies through the raw adapter, **not** evidence that the SDK's own commit point is durable. Do not use a memory SDK plus occasional snapshot copies as a durable scheduler.

## Files inspected

- Entire accepted `docs/internal/051-storage-contract.md`; baseline status and entry hashes; relevant safety-command/provenance sections of `docs/internal/050-final-report.md`.
- `packages/core/src/registry/{owner,registry,snapshot}.js`.
- `packages/core/src/platform/{history,trace-reducer,state-invariants,event-journal}.js`.
- `packages/core/src/contracts/sigils.js`, `src/index.js`, `package.json`, and `tests/architecture-integrity.test.js`.
- SDK constructor/mutation/authority seams in `packages/core/src/sdk/chord.js`; `tests/fixtures/host.js` and `tests/recovery-integrity.test.js` for real owner-produced evidence fixtures.
- New adapter, pure validation and shared tests; final logs and preservation comparison.

## Files changed

New:

1. `packages/core/src/storage/contract.js` — pure request/error/reducible-state/next-transition/header decoder checks.
2. `packages/core/src/runtime/storage/sqlite.js` — narrow SQLite shell and lifecycle.
3. `packages/core/tests/storage-adapter.test.js` — shared Node/Bun assertions, including isolated lazy-load and fault-injection children.
4. `packages/core/tests/storage-process-worker.js` — independent-process CAS barrier worker, no scheduler/adapters.
5. `docs/internal/051-storage-implementation.md` — this report.

Modified:

- `packages/core/src/index.js` — explicit host-only factory export and comment, with all previous exports preserved.

Pre-existing dirty changes were captured in `/home/d/.hermes/cache/scratch/chord-b2-entry.json`. Final byte comparison identifies only the intended root entrypoint among pre-existing files as changed. No staging, commit, push, tag, publication, destructive Git operation, dependency installation, or edits to the existing owner/SDK occurred. Temporary databases, proposal/barrier files and logs live under configured scratch, not the repository or system temporary directory.

## Test commands

Runtime versions: `node --version` → `v24.22.1`; `/home/d/.bun/bin/bun --version` → `1.4.3`, exit 0 each. Both shared suites use **node:sqlite**, not Bun's alternative provider.

From `packages/core`:

| Exact behavioral command | Exit | Final output |
|---|---:|---|
| `node --test tests/storage-adapter.test.js` | 0 | `tests 11`, `pass 11`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0` |
| `/home/d/.bun/bin/bun test tests/storage-adapter.test.js` | 0 | `11 pass`, `0 fail`, `Ran 11 tests across 1 file. [1324.00ms]` |
| `/home/d/.bun/bin/bun test` | 0 | `204 pass`, `0 fail`, `1629 expect() calls`, `Ran 204 tests across 17 files. [2.02s]` |
| `/home/d/.bun/bin/bun run src/verify-runtime.js` | 0 | `🎉 ALL RUNTIME VALIDATIONS PASSED!` |

Complete final stdout/stderr is retained respectively as scratch `chord-b2-node.log`, `chord-b2-bun.log`, `chord-b2-suite.log`, and `chord-b2-verify.log`. Actual logged invocations redirect `> /home/d/.hermes/cache/scratch/<log> 2>&1`, save `$?`, print the log or its footer using Python, and `exit $code`; no pipeline masks the behavioral command's exit. Bun's expect count excludes Node assert calls in the new shared tests; it is not a total assertion count.

From repository root:

| Exact command | Exit | Final output |
|---|---:|---|
| `node --test docs/internal/046-state-probes.mjs` | 0 | `tests 21`, `pass 21`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0` (full log: scratch `chord-b2-safety.log`) |
| `node /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs` | 0 | JSON below |
| `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs` | 0 | Identical JSON below |
| `git diff --check` | 2, pre-existing | Three existing trailing-whitespace diagnostics: `049-final-report.md:7`, `049-final-report.md:99`, `release-notes-and-limitations.md:4`. None introduced by B2. |

Both boundary probes returned exactly:

```json
{"actorFieldsRejected":3,"recursiveDataOnly":true,"forgedResultRejected":true,"canonicalAuthorityUnchanged":true,"unknownRedispatchRejected":true,"adapterCalls":1,"allowDecisionFrozen":false}
```

The shared suite executes architecture/lazy binding; lifecycle/disk/new-process reopen/pagination; candidate predicate negatives; independent header/JSON/history/version corruption; precommit failure/rollback/COMMIT acknowledgement fault injection; real SDK reconciliation persistence; two-independent-process CAS and pending-write read isolation; initialization contention/incomplete genesis/overflow/illegal terminal transition; real SDK completed outcome persistence; physical-layout/foreign-file/lock-timeout negatives. A real one-second writer lock timeout is typed `STORAGE_UNAVAILABLE`, never stale. The independent workers wait at a filesystem barrier and both start at expected revision zero: exactly one succeeds and one reports stored revision one. Workers have no adapter access; this is store-only contention, not concurrent scheduler support.

## Exit codes and results

All final behavioral checks exited 0. The original suite remains green with the 11 new tests included. ARCH-18 still runs unchanged; added architecture assertions constrain the new pure layer and common lazy binding. The memory-only child constructs the SDK with SQLite loading denied, then verifies explicitly opening durable storage produces `UNSUPPORTED_RUNTIME` rather than memory fallback.

Initial test iterations failed honestly before corrections: a negative incorrectly assumed a trusted-host transition from `created` to `completed` was illegal; the final negative uses an actually forbidden terminal-to-active transition with coherent history. Bun bypasses Node's `Module._load` hook for built-ins, so its isolated lazy-load test now mocks `node:module#createRequire` instead. A failed rollback injection exposed Bun's connection cleanup difference; retirement now makes a best-effort rollback before native close while preserving the unknown classification. Failed stale-conflict rollback is separately exercised. No test-only failure hook is exposed by the production API.

## Invariants verified

- One authoritative singleton row includes complete state, ordered journal, execution/reconciliation evidence and matching headers. No second evidence table/cache exists.
- Writer `BEGIN IMMEDIATE` precedes authoritative read, full validation and stored-revision comparison. Stale candidates write nothing. UPDATE also predicates on the stored revision and checks one changed row.
- Validation asserts RegistryData, complete reducer equality, immutable prefix, exactly one final new commit, matching operation and computed canonical delta. Existing reducer rules additionally bind history version, sequence, preceding id/revision, supported diagnostics, diagnostic order/revision and unique event ids. Illegal canonical transitions still reject.
- Open checks physical integrity and exact generated layout. Unsupported metadata is checked before pinned JSON assertions. Load checks row count, byte budget, safe numeric headers (including SQLite integers too large for JavaScript), JSON, metadata identity and reducer/state equality. Corruption is never silently initialized, repaired or imported.
- Every handle establishes and queries back WAL, FULL and 1000ms timeout. Initialization and data updates are transactional; no INSERT OR REPLACE or overwrite path exists.
- Confirmed precommit rollback yields `not_committed`. COMMIT exceptions, rollback failure and lost post-COMMIT acknowledgement yield `unknown` and retire the handle. Reopening after injected lost acknowledgement finds the exact proposed commit id at revision one; it is not incorrectly inferred absent. No compensating write or retry occurs.
- Detached outputs/inputs cannot mutate stored state. Logical clock floor takes the maximum within the same row update. Dense array-order history ordinals and pagination do not depend on timestamps.
- Existing memory behavior and governed actor-data isolation remain passing. The new factory is a host capability, not an actor packet/projection API.

## Known limitations

- **No owner/SDK persistence integration or startup recovery.** No crash kill-window, recovery-sweep, clock-restart/expiry, in-flight owner dispatch, unknown-result catch-path, or full Proof 2/3 claim is made. Post-COMMIT acknowledgement loss is injected synchronously against real SQLite; it is not a process-kill or power-cut experiment.
- Only measured Linux Node v24.22.1 and Bun 1.4.3 are supported by this evidence. SQLite/VFS/filesystem/device sync assumptions remain; a local-looking path does not prove local hardware.
- One active scheduler per run, host-assured sequential restart only. Independent raw-store CAS handles/processes do not establish safe live-peer recovery or exactly-once effects.
- O(full registry/history) validation/reduction/serialization per commit and synchronous one-second lock waits block the event loop. Existing 1 MiB/16384-node/1024-array limits remain; no compaction or migration exists. Request envelopes do not consume the embedded registry's own validation budget.
- Exact generated schema SQL (whitespace normalized) is deliberately checked; manually reauthored alternative layouts are unsupported, not adopted. No cryptographic tamper protection, encryption, migration, secret scrubber or network-filesystem detection is provided.
- Persistent metadata can contain declarative authority facts; executable host services, credentials, routers and callbacks are not adapter inputs. Application payloads can still contain secrets. Retirement attempts native cleanup but cannot guarantee an irreparably failing native connection closes; it never returns the retired object to service.

## Blockers

**No blocker to B3 within the accepted bounded design.** The raw adapter gate is met. Durable scheduling/recovery remains blocked until the next pass actually replaces the owner commit point and audits SDK/runtime behavior; do not imply the root export alone makes `createChord` durable. Full product promotion and larger proof/deployment/legal gates are unchanged.

## Next-pass readiness

**B2 COMPLETE; B3 READY.** Integrate the private optional owner store port and host SDK storage construction; refresh authoritative reads and avoid stale SDK aliases; reject conflicting registry/storage options; keep callbacks synchronous/reentrancy guarded and never auto-replay them. Publish mutation success/prepared dispatch only after acknowledged store CAS; freeze on unknown outcomes/unavailable authority; distinguish storage failures from adapter failures. Implement effect-free exclusive-restart in-flight quarantine and logical-clock-floor initialization before returning a durable SDK. Exercise crash windows/recovery without adapter resolution or invocation. None of those integration tasks was silently performed in B2.
