# Block 052 — Independent live-process coordination proof

## Pass

**Pass 6 only — integration-agent. PASS; READY for Pass 7 independent adversarial work. Not a release, production-promotion or publication gate.** Protected repository `/home/d/Workspace/other-projects/chord`, base HEAD `08728e48772db14a247add9143669a8e0eab01fa`. No Pass 7/8/9, Block 053, source/dependency/version/manifest change, staging, commit, push, tag or publication was performed.

## Agent

**integration-agent.** JavaScript ESM public example plus shared Node/Bun integration tests. Loaded `repository-documentation-verification` and its ownership/process reference; added reusable semantic-ordering, public-proof, hostile-wire and outcome-visibility lessons to that existing default-profile reference outside the repository.

## Files inspected

- `docs/internal/052-{ownership-audit,coordination-protocol,fencing-implementation,actor-ingress,dispatch-takeover-safety}.md`: audit, normative protocol and accepted P3/P4/P5 handoffs; historical unsupported-branch claims are superseded by the later implementation reports, not silently rewritten.
- `packages/core/src/index.js`, `package.json`, `src/sdk/coordinated-chord.js`, `src/runtime/{actor-ingress,actor-client}.js`, `src/coordination/{commands,command-authorization}.js`, `src/execution/task-packets.js`.
- Existing `tests/{actor-ingress-worker,coordinated-dispatch.test,process-recovery.test}.js`, `tests/fixtures/coordinated-actors.js`, and `examples/process-recovery.mjs`, for interface/process comparison only. The new example imports no fixture or private source module.
- Entry/final SHA-256 inventories, actual full/shared/safety/verifier/example logs, CLI SQLite and effect files, complete replay/reopen projections, actor transcripts and process exit evidence.

## Files changed

Created only:

1. `packages/core/examples/two-process-coordination.mjs` — reusable public-export-only, self-spawning CLI and exported `runProof`/`resolveRuntime` orchestration helpers.
2. `packages/core/tests/two-process-coordination.test.js` — four shared semantic integration tests, one for each owner/actor runtime pair.
3. `docs/internal/052-process-coordination-proof.md` — this report.

**All 658 entry files remain byte-identical; nothing was deleted.** Prior dirty 050/051/052 work, every earlier test/report/example, product source, manifest, lockfile and dependency/version value were preserved. `git diff --cached --stat` remains empty. No product bug or product source correction was needed.

Scratch root **`S=/home/d/.hermes/cache/scratch/chord-052-pass6`** retains `entry.json`, `preservation.json`, `commands.json`, `run-gates.py`, `proof-summary.json`, full named command logs, and the four named `cli-<owner>-<actor>/` proof directories. Scratch is regenerable and subject to pruning, not a release artifact.

## Implementation decisions

### Independent roles and transport

The CLI orchestrator resolves each requested executable using `runtime -p process.execPath` **before** spawning measured workers. It then starts owner **A**, which starts narrow actor **B** and a separate trusted standby contender. Owner and actor report their own runtime/version/executable/PID; assertions match self-reported PIDs to actual spawned PIDs and resolved executable paths. All three remain alive through B's final committed-outcome observation; B is not merely a SQLite observer.

A explicitly creates pristine v2 storage, inspects its identity, acknowledges owner acquisition at expected revision 0, installs exact authority, and creates fresh host services and a fresh private channel/session map. No old registry or mutable snapshot is transferred to B or the standby. Standby receives only privileged existing-store launch configuration, opens its own connection and independently attempts acquisition.

B receives only `--role actor` in argv, with no database path, owner credential, authority binding, SDK object or store object. Its role dynamically imports only `createActorClient` from the public root and exposes exactly `close`/`sendCommand`. The shared script is not an OS sandbox: privileged exports available to arbitrary same-user code are outside this JSON-capability boundary. The host enrolls the exact inherited child/channel object as Bob out of band before attaching ingress, and resolves that map afresh on every request. Neither claimed actor identity nor owner/generation metadata authenticates a message.

Actor commands travel over the dedicated inherited child IPC channel. Separate stdin/stdout control/response framing drives deterministic orchestration without sleeps, public mailboxes or shared mutable registries. Normal commands use the narrow public client. The five deliberately malformed authority-injection frames use direct JSON IPC because the client correctly rejects malformed envelopes before transmission; this tests actual host ingress rather than mistaking client-side validation for a host rejection. No raw SQL, production test hook, monkeypatch or fixture import is used in the example.

### Meaningful collaboration and actual work

1. A's fresh host-bound Alice service submits exact scoped work, installs a specific handoff/human-approval policy, and proposes a review handoff to Bob.
2. Independent B projects its authorized coordination context, discovers the proposal, accepts it, and submits its own authorized task. Acceptance does not transfer execution ownership or rewrite task authority.
3. Exact repeats of B's acceptance and submission return the original durable responses, with full inspected state unchanged. Repetition after completed execution also returns the original historical submission receipt with no new effect.
4. B's stale expected revision, unauthorized task scope, foreign run/incarnation, attempted principal/grants/SDK/database/credential fields, unbound session, and service-as-human response are rejected with exact codes and complete snapshot nonmutation.
5. Alice requests approval; a separate explicitly host-attested **local human channel** approves the exact reserved attempt. This illustrates trusted human enrollment, not a real login service or a separate human process. Approval triggers zero adapter calls.
6. A runs the actual public coordinated owner cycles. Each operation gets one durable protected dispatch/attempt, frozen opt-in v2 context, and successful committed Outcome. The adapter writes a distinct real business artifact with exclusive file creation, records effect/context evidence, checks generation and stable operation key, and refuses duplicate operation entry. A third cycle skips; duplicate command delivery after execution does not invoke the adapter again.
7. B observes its committed task result, then observes both completed results only after the host explicitly installs the additional exact task-scope grant. Final combined replay equals the full envelope; the orchestrator independently reopens SQLite without acquiring, services or recovery and compares the entire snapshot/replay again.

The example models a deterministic shared trusted clock fixed at 100 ms; all leases remain valid during this collaboration proof. It does not use real elapsed sleep as a lease/expiry claim. Random run/commit/queue/attempt IDs are intentionally retained. Exact semantic results are deterministic: revision **14**, **6** command receipts, **2** completed attempts, **2** protected callable entries, **2** actual effect files and **2** committed execution results. Relative task execution order is not asserted: tied priority/time may be broken by random queue IDs. Each actual run's complete ordering is preserved and replayed exactly.

### Outcome authority is independently scoped

Before adding Bob's work-scope grant on Alice's task, Bob may see Alice's permitted handoff status but **not** `last_result` or task execution state. Bob can already see his own task's actual successful result. After the explicit scoped grant, `observe_outcomes` returns both committed successful results. Foreign/nonexistent task IDs remain omitted. The read evaluator uses the task's work capability and exact current scope grant; no separate read-only capability or ownership transfer is invented. The additional work grant is therefore broader than a hypothetical dedicated read-only permission, within the accepted API's semantics.

### Owner competition and cleanup

While the incumbent and meaningful actor are alive, the separate standby's real `owner.acquire` rejects **OWNER_HELD** and its actual `owner.runCycle` rejects **NOT_OWNER**, leaving the complete envelope unchanged and invoking no adapter. This is an attempted takeover of a still-valid incumbent, not a successful takeover, race-to-genesis or expiry-recovery claim. Existing unchanged P3/P5 suites separately rerun real competing acquisition, expiry takeover and stale callback cases.

Each normal proof run closes B and standby before reporting owner completion, verifies both PIDs no longer exist, independently reopens storage, then closes A and verifies its PID no longer exists. Actual per-role exit records are all code 0/signal null. Watchdogs and kill escalation exist only as failure cleanup, not synchronization evidence. Final process inspection found no remaining workers from this example.

## Tests executed

Actual resolved runtimes: **Node v24.22.1**, `N=/home/d/.volta/tools/image/node/24.22.1/bin/node`; **Bun 1.4.3**, `B=/home/d/.bun/bin/bun`. Package cwd is `/home/d/Workspace/other-projects/chord/packages/core`, root cwd for safety/git. `S/commands.json` records exact expanded argv/cwd/exits; `S/run-gates.py` regenerates the command sequence into a fresh evidence location if its fixed output directories are changed. Test-generated proof directories are retained, not deleted. Shared test runtime paths may be overridden with `CHORD_PROOF_NODE` and `CHORD_PROOF_BUN`.

| Exact command using N/B substitutions above | Exit | Observed result |
|---|---:|---|
| `$N --test tests/two-process-coordination.test.js` | 0 | **4 pass**, no failures/skips/cancellations/todo; all four owner/actor pairs |
| `$B test tests/two-process-coordination.test.js` | 0 | **4 pass**, 0 fail; all four pairs |
| `$N --test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js` | 0 | Unchanged P3/P4/P5 **70 pass**, no failures/skips/cancellations/todo |
| `$B test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js` | 0 | Unchanged **70 pass**, 0 fail |
| `$N --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | Original 051 shared **82 pass**, no failures/skips/cancellations/todo; four legacy recovery runtime pairs included |
| `$B test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | Original **82 pass**, 0 fail, including four legacy recovery pairs |
| `$N --test docs/internal/046-state-probes.mjs` (root) | 0 | Original safety **21 pass**, no failures/skips/cancellations/todo |
| `$B test ./docs/internal/046-state-probes.mjs` (root) | 0 | Original safety **21 pass**, 0 fail |
| `$N src/verify-runtime.js`; `$B src/verify-runtime.js` | 0 each | **ALL RUNTIME VALIDATIONS PASSED!** |
| `$N examples/quickstart.mjs`; `$B examples/quickstart.mjs` | 0 each | completed true; adapterCalls 1 |
| `$N examples/cross-actor-workflow.mjs`; `$B examples/cross-actor-workflow.mjs` | 0 each | accepted handoff, validated/consumed approval, completed result, effect count 1, replay verified |
| `$B test` | 0 | **349 pass**, 0 fail, 1715 Bun expect calls, 25 files: all prior 345 plus 4 P6 |
| `$N examples/two-process-coordination.mjs $S/cli-node-node $N $N` | 0 | Full live proof, retained artifacts, all three children exit 0 |
| `$N examples/two-process-coordination.mjs $S/cli-node-bun $N $B` | 0 | Same semantics |
| `$B examples/two-process-coordination.mjs $S/cli-bun-node $B $N` | 0 | Same semantics |
| `$B examples/two-process-coordination.mjs $S/cli-bun-bun $B $B` | 0 | Same semantics |
| `git diff --cached --stat` | 0 | Empty; nothing staged |
| `git diff --check` | 2 | Only protected pre-existing whitespace: `049-final-report.md:7,99`, `release-notes-and-limitations.md:4` |
| `python3 $S/verify-final.py` (root) | 0 | All 658 prior files unchanged; only the three declared files added; new-file whitespace/import/report, raw read-only SQLite/artifact equality and no-worker checks pass |
| `$N --check packages/core/examples/two-process-coordination.mjs`; `$N --check packages/core/tests/two-process-coordination.test.js` (root) | 0 each | Both new JavaScript files parse |

The full historical suite imports `bun:test`; no full-suite Node claim is made. Shared strict Node assertions are not Bun expect calls. Overlapping runs are not added as unique coverage. No new P7 mutation/crash campaign was run.

Initial proof iteration exposed two example/test issues, not product defects: hostile malformed input was correctly rejected locally by the client before reaching ingress, so a separate raw negative-frame route was used; a test incorrectly assumed task execution order despite random queue-ID tie-breaking, so it now compares the exact task set while retaining each run's actual ordered evidence. Neither change weakened production authorization or effect-count assertions. Final gates above passed after these corrections.

## Observed results

Final named CLI evidence (`S/proof-summary.json` is the programmatic aggregate):

| Owner / actor | Owner A PID | Actor B PID | Standby PID | Final evidence |
|---|---:|---:|---:|---|
| Node / Node | 82357 | 82369 | 82376 | revision 14; receipts 6; effects/results/attempts 2; full replay/reopen equal; all exit 0 |
| Node / Bun | 82501 | 82508 | 82529 | same |
| Bun / Node | 82624 | 82663 | 82670 | same |
| Bun / Bun | 82783 | 82812 | 82843 | same |

These are current P6 executions, not P4/P5 historical PID claims. The corresponding directories retain:

- `run.sqlite` — authoritative real v2 SQLite database, suitable for read-only inspection; no test-only table or schema.
- `alice.effect.txt`, `bob.effect.txt` — actual protected work products; `effects.ndjson` — two actual callable/effect records with operation/attempt/generation/idempotency context.
- `evidence.json`, `processes.json`, `{owner,actor,standby}.exit.json` — matched runtime/PID evidence, live-role checks, independent reopen/cleanup facts and actual exit codes.
- `actor-transcript.json` — original wire requests/responses, full historical duplicate receipts, exact denial codes and zero-state-change checks.
- `final.json`, `replay.json`, `reopened.json` — complete store snapshot, combined replay and independent process reopen equality.
- Role stderr logs if warnings/errors were emitted. Whole CLI stdout/stderr is in the sibling named command log.

Regenerate one pair without deleting prior evidence:

```sh
# From packages/core. OUT must not already exist; use a fresh absolute directory.
/home/d/.volta/tools/image/node/24.22.1/bin/node \
  examples/two-process-coordination.mjs \
  /home/d/.hermes/cache/scratch/chord-052-proof-fresh \
  /home/d/.volta/tools/image/node/24.22.1/bin/node \
  /home/d/.bun/bin/bun
```

This same CLI accepts other supported Node/Bun executable paths and resolves launchers before measuring PIDs. The example is intentionally **not added to the package files allowlist in P6**; current manifest does not ship it. P8 owns authorized package/docs allowlist integration. Repository self-reference import resolution was executed successfully; no packed/install consumer claim is made.

## Invariants demonstrated

- **ACT:** real independent B discovers and accepts A's authorized handoff, commits its own work and observes actual committed execution outcomes through only the bound client channel. Fresh enrollment is required; identity/authority/generic-SDK/database/token JSON cannot elevate it. Human approval remains a distinct host attestation.
- **OWN:** an acknowledged owner, independent live actor and independent standby coexist; the standby cannot acquire or dispatch while the incumbent lease is valid. Read/replay/reopen never adopt credentials or recover work.
- **STA/EFF:** exact original acceptance/submission receipts repeat without revision/receipt/dispatch/effect duplication, including after completed execution. Stale/unauthorized/foreign/malformed/unbound/nonhuman requests leave the complete inspected state unchanged. Six command receipts accompany exactly two distinct logical operations and two successful protected effects/results.
- **Dispatch/approval linkage:** actual factory calls persist matching completed sidecars, operation identities and successful results; the required approval is consumed by the exact dispatched attempt. Opt-in context is frozen and carries generation 1 plus the stable run/incarnation/operation key. No arbitrary result creates authority.
- **REP/REC:** complete combined reconstruction equals the persisted envelope and independently reopened snapshot; replay/reopen invoke zero adapters. No mutable registry crosses the actor boundary.
- **Compatibility/preservation:** prior 345 full tests, shared 82 on each runtime, safety 21 on each, unchanged P3/P4/P5 70 on each, verifiers and existing examples remain green and byte-preserved.

## Known limitations

Trusted single-machine host/filesystem/SQLite/VFS/device and shared clock assumptions remain; this is not hostile-OS-user isolation, remote authentication, cryptographically signed history, multi-machine leadership, backup/clone fencing, migration or exactly-once effects. The process script illustrates **host-configured actor/human attestation**, not a deployable login service. The accepted owner lease is fixed at 30,000 ms with explicit renewal; this proof freezes its shared clock and does not add automatic renewal or make elapsed-time/expiry claims.

The adapter's cooperating generation/key checks and exclusive file writes are a local proof service, not a real remote provider. **The final database check and a remote effect are not atomic.** A request delayed after the final check can still reach a downstream service; downstream generation fencing/idempotency and explicit uncertainty/reconciliation remain necessary. This pass demonstrates successful checked invocation and actual effect/result linkage, not a new takeover-at-final-check or delayed-network race experiment. Those unchanged P5 tests were rerun; broader adversarial mutation/ack/crash coverage remains P7. No ambiguity is automatically reconciled or redispatched by the example.

Whole-envelope replay is synchronous, bounded and expensive; evidence/renewals consume existing budgets. IDs/fresh-run bytes and tied task scheduling order are not deterministic, only the asserted semantics and exact per-run replay are. Scratch evidence may be pruned. Current package files allowlist excludes the new example until the authorized later packaging pass. Existing publication/legal/identity blockers remain unchanged.

## Blockers

**None to Pass 7 within the accepted bounded protocol.** All P6 semantic runtime-pair, actual CLI/artifact, full/shared/safety/verifier and preservation gates pass. Pre-existing whitespace is preserved, not repaired. No source bug required a narrow product regression fix. Production promotion/publication remain blocked on the authorized later review/packaging/legal gates; P6 is not permission to publish or enter Block 053.

## Next pass: READY or BLOCKED

**READY — Pass 7 independent adversarial-agent only, under the parent's authorization.** Entry points are the public example and its four shared tests above, accepted P5 runtime/SQLite interfaces, and retained `S/cli-*/` evidence. P7 should retain these nonempty collaboration/effect/outcome assertions while independently challenging supported failure boundaries: before/after claim and result acknowledgement, pre-final-check takeover versus post-check delayed delivery, stale success and throw after a newer attempt, current authority/lifecycle loss, exact nonmutation, no blind retry, replay/evidence tampering, and existing reachable capacity/counter boundaries. Distinguish actual supported API failures from excluded raw-host/OS powers; do not invent a high-counter genesis or relax exact records to manufacture a fixture. P8 owns package allowlist/docs integration; P9 owns final review. No later pass was executed here.
