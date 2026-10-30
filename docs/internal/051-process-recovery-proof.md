# 051 — Independent-process recovery proof

## Pass

**B5 — integration-agent: PASS.** Two deterministic semantic scenarios execute real work in one operating-system process and continue by independently opening the same SQLite store in a second invocation. Measured Node→Node, Bun→Bun, Node→Bun and Bun→Node all pass. The parent orchestrates processes and asserts artifacts; it never initializes a Chord registry, transfers a registry to a child, imports a snapshot, or continues work itself. B6–B8 are not implemented or claimed.

Baseline HEAD: `08728e48772db14a247add9143669a8e0eab01fa`. All preexisting dirty 050/B1–B4 files are preserved byte-for-byte. No production code changes were necessary.

## Proof and evidence

Public runnable example: `packages/core/examples/process-recovery.mjs`. It imports only public package exports and Node built-ins; no test fixture, dependency, manifest, lockfile or new authentication API is needed. From `packages/core`, use:

```sh
node examples/process-recovery.mjs /absolute/new-evidence-directory
# Optional second runtime (first runtime is the invoking runtime):
node examples/process-recovery.mjs /absolute/another-new-directory /path/to/bun
```

The output directory must not already exist; its parent must exist. The exported `runProcessRecoveryProof(directory, { writer, reader })` provides the same reusable synchronous orchestration. Child arguments contain only script path, worker marker, scenario, stage and evidence directory. The continuation stage reads **only SQLite**, never `first.json`, to discover run, task and attempt identity. Evidence files are observations, not recovery input.

### Approval suspension

1. Process 1 creates the durable run and host-attested declarative authority, dispatches and commits ordinary work, queues approval-required work, prepares its attempt, and durably pauses for human approval. A paused cycle cannot dispatch. It writes inspectable evidence and closes/exits normally.
2. Process 2 reads that same store, then constructs a fresh SDK with fresh host clock/router and a new private embedding ingress. Full registry equality before and after open proves unchanged identity, authority, pending attempt and committed work. A paused cycle still cannot dispatch.
3. Missing session, prior-process session and principal ID masquerading as session each reject `HOST_UNAUTHENTICATED` without changing SQLite. Only explicit **new embedding-host attestation** enables the example ingress. The host installs a fresh exact approval, derives the human principal from the private session (ignoring a forged request principal), resumes with current revision, and commits the original prepared attempt once. The approval is consumed by that exact attempt. Three further cycles dispatch nothing.
4. External ledger: exactly `committed` by process 1 and `continued` by process 2; committed task data is unchanged. Complete final journal reduction equals final SQLite/SDK registry. Approval scenario has 28 events in the measured executions.

### Effect before acknowledgement / SIGKILL

1. Process 1 commits ordinary work, then dispatches another task. Its adapter appends and fsyncs a simulated external effect receipt, writes evidence while the durable claim is `running`, and SIGKILLs itself **before returning an acknowledgement**. No production fault-injection seam is installed.
2. Process 2 independently observes the exact pre-recovery persisted registry, including the active attempt, then opens the SDK. Startup recovery makes the task `uncertain`, its operation `unknown`, and removes its active attempt. This does not infer that the external effect failed.
3. Fresh router sees **zero invocations** through three continuation cycles. Ledger is exactly `committed`, `ambiguous`, both from process 1. There is no reconciliation guess and no blind retry. Committed task data remains unchanged. Full final journal reduction equals the persisted final registry, with original history as an exact prefix. Ambiguous scenario has 20 events in measured executions.

IDs and diagnostic timestamps remain generated/ambient. Assertions compare durable identity, task data, attempt binding, history prefixes, state transitions, effect order/count and reducer equality, **not byte equality between different runs**. The effect ledger is a simulated external system, not Chord's journal and not a remote business receipt.

### Authentication boundary

Chord does not implement login. Persisted principal records are policy, not credentials or sessions. The tiny example ingress is an embedding-host illustration: its `attest` operation is trusted and must be replaced by the application's real authentication service. It is not an actor endpoint or production authenticator. SDK possession remains host capability; direct SDK calls do not authenticate a requester. The SDK remains private to the worker/ingress closure and is never returned to a client. No credentials are used. Session markers, router and trusted-host keys are asserted absent from initial/final registry evidence and the closed SQLite file. No encryption, content scrubber or general secret-detection claim is made.

### Retained measured artifacts

Each root below contains `summary.json` plus `approval/` and `ambiguous/`. Each scenario contains `run.sqlite`, `effects.ndjson`, `first.json`, `reopened.json`, `final.json`, `summary.json`, `first-process.json`, and `second-process.json`. Process artifacts include actual resolved runtime executable, spawned PID, exit/signal, stdout and stderr. Worker self-reported PID must equal spawned PID, differ from the parent, and differ across stages.

| Runtime pair | Retained evidence root | Approval PIDs | SIGKILL/recovery PIDs |
|---|---|---|---|
| Node→Node | `/home/d/.hermes/cache/scratch/chord-b5-final-node-evidence` | 30776 → 30794 | 30802 → 30809 |
| Bun→Bun | `/home/d/.hermes/cache/scratch/chord-b5-final-bun-evidence` | 30387 → 30407 | 30447 → 30467 |
| Node→Bun | `/home/d/.hermes/cache/scratch/chord-b5-final-node-bun-evidence` | 30527 → 30545 | 30566 → 30573 |
| Bun→Node | `/home/d/.hermes/cache/scratch/chord-b5-final-bun-node-evidence` | 30648 → 30669 | 30698 → 30718 |

Every root summary reports `gate: "B5 PASS"`. Every scenario reports one committed effect and zero ambiguous redispatches; approval has `calls:1`, three rejected sessions, `journalMatches:true`; ambiguous has `calls:0`, first signal `SIGKILL`, `journalMatches:true`. Scratch evidence is inspectable local execution evidence, not a permanent checked-in fixture; rerun the example to regenerate it.

## Files inspected

- `packages/core/package.json`, public `src/index.js` and `src/platform/index.js`.
- `packages/core/src/sdk/chord.js`: constructor, fresh service binding, durable recovery order, grant/approval helpers.
- `packages/core/src/runtime/recovery.js`, `src/platform/trace-reducer.js`.
- `packages/core/tests/authority-continuity.test.js`, `tests/crash-recovery-worker.js`, `tests/fixtures/host.js`.
- `packages/core/examples/cross-actor-workflow.mjs` host authority/example conventions.
- `docs/internal/051-authority-continuity.md`, entry Git status, execution logs, entry file hash inventory and final comparison.

## Files changed

Created only:

1. `packages/core/examples/process-recovery.mjs` — reusable public-export-only example, worker stages, independent invocations and evidence assertions.
2. `packages/core/tests/process-recovery.test.js` — four runtime-pair tests; each exercises both scenarios and verifies written summary/runtime/attempt artifacts. Temporary test evidence is removed after tests; CLI evidence remains inspectable.
3. `docs/internal/051-process-recovery-proof.md` — this report.

No previously existing repository file changed during B5. Entry inventory: `/home/d/.hermes/cache/scratch/chord-b5-entry.json`; final comparison found `ENTRY_FILES_CHANGED []`. No staging, commit, push, tag, destructive Git operation, dependency/manifest change or publication. Existing example allowlist in the manifest was intentionally not expanded: this example is runnable from the repository; packaging/publication review remains a later gate. A runtime-launcher/PID lesson was appended to the existing profile verification skill outside the repository.

## Test commands

Measured runtime versions: `node --version` → `v24.22.1`; `/home/d/.bun/bin/bun --version` → `1.4.3`, both exit 0. Tests run from `/home/d/Workspace/other-projects/chord/packages/core` unless marked root.

| Exact command | Exit | Result |
|---|---:|---|
| `node --test tests/process-recovery.test.js` | 0 | Final focused rerun: 4 tests, 4 pass, 0 fail/cancelled/skipped/todo |
| `/home/d/.bun/bin/bun test tests/process-recovery.test.js` | 0 | Final focused rerun: 4 pass, 0 fail, 1 file |
| `node --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js` | 0 | 70 tests, 70 pass, 0 fail/cancelled/skipped/todo |
| `/home/d/.bun/bin/bun test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js` | 0 | 70 pass, 0 fail, 4 files |
| `/home/d/.bun/bin/bun test` | 0 | 263 pass, 0 fail, 1635 Bun expect calls, 20 files |
| `node --test docs/internal/046-state-probes.mjs` (root) | 0 | Original safety harness: 21 pass, 0 fail/cancelled/skipped/todo |
| `/home/d/.bun/bin/bun run packages/core/src/verify-runtime.js` (root) | 0 | `ALL RUNTIME VALIDATIONS PASSED!` |
| `node examples/process-recovery.mjs /home/d/.hermes/cache/scratch/chord-b5-final-node-evidence` | 0 | `B5 PASS`, both scenarios |
| `/home/d/.bun/bin/bun examples/process-recovery.mjs /home/d/.hermes/cache/scratch/chord-b5-final-bun-evidence` | 0 | `B5 PASS`, both scenarios |
| `node examples/process-recovery.mjs /home/d/.hermes/cache/scratch/chord-b5-final-node-bun-evidence /home/d/.bun/bin/bun` | 0 | `B5 PASS`, both scenarios |
| `/home/d/.bun/bin/bun examples/process-recovery.mjs /home/d/.hermes/cache/scratch/chord-b5-final-bun-node-evidence /home/d/.volta/bin/node` | 0 | `B5 PASS`, both scenarios |
| `git diff --check` (root) | 2 | Preexisting whitespace only: `049-final-report.md:7,99`, `release-notes-and-limitations.md:4` |

Complete final command/exit metadata: `/home/d/.hermes/cache/scratch/chord-b5-final-checks.json`. Full logs: `/home/d/.hermes/cache/scratch/chord-b5-{node-shared,bun-shared,full,safety,verify,node-example,bun-example,node-bun-example,bun-node-example}.log`. Each log is the actual redirected execution output; command metadata records its exit code independently.

Original safety file SHA-256: `95b72cd7189bb2d54685bdd3f08561ef0740f3e8399bbc04cb10a269228248eb`, unchanged from B5 entry. Full suite uses Bun because original suites import `bun:test`. The four shared suites are actually exercised under both runtimes; no claim that the complete suite runs under Node. Bun's expect count excludes Node strict assertions.

## Exit codes and results

All final behavioral commands exit **0**. Initial Bun/shared/full iterations exposed the Node version-manager shim: `node` spawned a different actual Node PID than the launcher's PID. The proof correctly rejected those mismatches; assertions were not weakened. The reusable runner now resolves each runtime using `runtime -p process.execPath` and spawns the real executable, retaining strict child PID equality. A separate initial Bun→Node CLI invocation used nonexistent `/usr/bin/node` and failed honestly; it was rerun with the actual installed `/home/d/.volta/bin/node` launcher, resolved before execution. Initial command metadata/logs remain `chord-b5-checks.json` and `chord-b5-initial-*.log` in scratch. No production defect or core change was required.

## Invariants verified

- Independent OS invocations with distinct measured PIDs; same SQLite store is the sole canonical recovery source.
- Same run ID, durable task identities, committed work and complete history prefix; exact pending or active attempt identities persist.
- Committed work is not repeated in either scenario or runtime direction.
- Paused approval work remains non-executable until fresh host attestation and exact approval; one eligible original-attempt continuation commits and consumes its approval.
- An acknowledged claim with an unacknowledged simulated external effect becomes uncertain/unknown and receives zero redispatches, not a fabricated success or inferred failure.
- Complete event-journal reduction, SDK final registry and raw SQLite final registry agree in both processes/scenarios.
- Fresh executable host services and private session ingress are reconstructed, not deserialized. Declarative authority is not login and no credential appears in the proof artifacts/database.
- Preexisting working-tree bytes, historical safety harness, shared storage/crash/authority gates and full regression suite are preserved/passing.

## Known limitations

Single active host runtime, host-assured sequential restart only; the first process has terminated before the second opens. Linux with Node v24.22.1/Bun 1.4.3 is measured. SIGKILL needs POSIX; no hardware power-loss, distributed worker, concurrent scheduler, cross-machine or remote authentication proof. Approval uses a graceful close/exit; ambiguous dispatch uses actual SIGKILL. Local fsynced receipts simulate external effects; no real network service is called. No exactly-once, transactional remote effect, fencing, remote idempotency, cryptographic tamper resistance, credential storage, encryption, secret scrubber, or automatic reconciliation claim. Unknown work deliberately remains quarantined; approved independent work continues in the separate approval scenario. Tests skip Bun-dependent pairs explicitly if Bun is unavailable; all four pairs ran with no skip here. Runtime selection supports `BUN_EXECUTABLE`/`NODE_EXECUTABLE` in tests. Generated IDs and diagnostic timestamps are nondeterministic; semantics are deterministic. Whole-history limits and existing local SQLite contract remain unchanged.

## Blockers

**None for bounded B5.** Existing root whitespace diagnostics are preserved, not introduced by this pass. Authentication must be supplied by the embedding host; the example's trusted explicit attestation is not a production authentication service. Manifest packaging intentionally remains unchanged.

## Next-pass readiness

**B5 COMPLETE/PASS; B6 may be reviewed next only under its own authorized scope.** Public runnable B7 input is ready at `packages/core/examples/process-recovery.mjs`, with machine-inspectable regenerated evidence and four runtime-pair tests. No B6–B8 work, release promotion, manifest expansion or publication was performed.
