# Block 052 — Developer guide and documentation verification

## Pass

**Pass 8 only — documentation-agent. PASS; next Pass 9 independent review: READY.** This is documentation/payload verification of the protected working tree, not publication approval, a Level B promotion or a claim that Pass 9 ran. No Block 053 work.

Repository `/home/d/Workspace/other-projects/chord`, branch `base`, HEAD `08728e48772db14a247add9143669a8e0eab01fa`. Scratch **`S=/home/d/.hermes/cache/scratch/chord-052-pass8`** retains entry SHA-256 hashes/status, exact command records/logs, executable verification scripts, consumer-like payload and real SQLite/process/effect artifacts. Scratch may be pruned; examples regenerate evidence in a fresh directory.

## Agent

**documentation-agent.** Loaded `repository-documentation-verification`. Read complete 052 protocol/reports and 050/051 final reports, then inspected live wrappers, storage predicates, fixed-credential owner, actor ingress/client and public proof. Prior reports are stage-specific history, not a substitute for current tests. No functioning implementation was restarted or rewritten.

## Files inspected

- Complete `docs/internal/052-{ownership-audit,coordination-protocol,fencing-implementation,actor-ingress,dispatch-takeover-safety,process-coordination-proof,concurrency-tests}.md`; `050-final-report.md`, `051-final-report.md`.
- Root/package READMEs, package manifest and root/SDK/platform export modules; legacy safety harness and its original Git bytes.
- `packages/core/src/sdk/coordinated-chord.js#createCoordinatedChord` / `runCycle`, `src/registry/coordinated-owner.js#createCoordinatedOwner`, `src/runtime/storage/coordinated-sqlite.js#openCoordinatedSqliteStore` / `commit` / `checkOwner` / `checkDispatch` / `readHistory`.
- `src/coordination/state.js#assertOwner` / `lifecycle` / `quarantine` / `adminCandidate`, `src/coordination/runtime.js#assertAttempt` / `planClaim` / `outcomeCandidate`, `src/coordination/history.js#reduceCoordinationTrace`, `src/runtime/actor-ingress.js#createActorIngress`, `src/runtime/actor-client.js#createActorClient`.
- Complete `examples/two-process-coordination.mjs`, README JavaScript blocks, four shipped examples, all fresh gate outputs and independently read-back proof artifacts. Abbreviated source/example locators here are package-relative and searchable symbols, not generated HTML anchors.

## Files changed

1. **`README.md`** — narrowly clarify that retained guarantee tables/canonical workflow describe the legacy SDK, not v2 global-revision/stale-attempt semantics.
2. **`packages/core/README.md`** — corresponding explicit scope note before legacy SDK guarantees.
3. **`docs/internal/052-developer-guide.md`** — this new report, current API guide pointers, gates and exact commands.

**Entry already contained the substantial 052 README sections, updated export/test counts and `examples/two-process-coordination.mjs` manifest allowlist entry.** Those bytes were protected and verified, not falsely attributed to this resumed pass or replaced with a fresh draft. The manifest needed **no further edit**. No source/test/example/manifest/lockfile/version/dependency/scope or earlier-report change occurred. All **664** entry files except the two narrowly allowed READMEs remain byte-identical; no deletion. `S/entry-hashes.json`, `S/preservation.json` and final hashes make this comparison independent of HEAD and earlier reviewers' inventories. All pre-existing dirty 050/051/052 implementation is retained. Nothing staged, committed, pushed, tagged or published.

## Implementation decisions

### Reading order and actual prerequisite gates

The maintained technical integration guide is [package README: 052 local fenced-owner and actor mode](../../packages/core/README.md#052-local-fenced-owner-and-actor-mode). It contains the complete executable lifecycle/scoped-read block, exact port methods and seven command payloads, explicit omissions, lease/authentication/unknown-outcome handling, downstream context and public multiprocess commands. Root identity, vision, staged roadmap, canonical examples and historical evidence were retained.

| Prior pass | Verified live gate, not assumed from its report |
|---|---|
| 1 audit | Seven reports exist; complete mutation inventory distinguishes legacy, coordinated and privileged bypasses. Live facade explicitly omits unsupported legacy convenience operations. |
| 2 protocol | Separate v2 format/identity, fixed credential, exact bounded actor protocol and linked replay are implemented; P3–P5 pure-helper/planning-time addenda remain explicit. |
| 3 storage | Real owner lease/CAS/identity/clock/acknowledgement and replay tests pass in coordinated shared gate; both v1/v2 cross-open directions reject. |
| 4 ingress | Real dedicated-channel actor tests, current authorization, receipt/approval/handoff and fresh enrollment tests pass unchanged. |
| 5 dispatch | Real pre-final-check takeover and stale success/throw/new-attempt regressions pass unchanged; runtime checks owner and attempt before outcome mutation. |
| 6 live proof | Public-export-only owner/actor/standby proof freshly executed in all four pairs, with actual work artifacts and independently reopened complete envelopes. |
| 7 adversarial | Seven added tests freshly rerun on Node/Bun as part of 81 coordinated shared tests and full 356 Bun suite: actual SIGKILL windows, post-check takeover race, pure outcome guards and consumed-approval transfer. P7's isolated mutation campaign is historical evidence; not independently rerun or counted as new P8 kills. |

### Three intentionally incompatible deployment choices

- **Memory:** `createChord()`; no live persistence. Snapshot import is not a durable restart or ownership protocol.
- **Legacy v1:** `createChord({storage})` / `openSqliteStore`; `chord.local-store.v1`, table `chord_store`. Host must stop/join the previous scheduler before recovery. Revision CAS is not scheduler election. Existing contracts and semantics unchanged.
- **Coordinated v2:** root-only `createCoordinatedChord` / `openCoordinatedSqliteStore`; `chord.local-store.v2`, table `chord_coordination`, protocol `chord.coordination.v1`. One acknowledged owner, host-enrolled actor IPC, trusted standby/read observers on one machine. No v1 migration, implicit acquire, snapshot recovery or fallback. Domain schemas/history remain v1, but ownership needs combined envelope replay.

### Acquisition, renewal, release and clock operations

Explicit creation initializes pristine genesis; existing opens require externally pinned `{run_id,incarnation_id}`. Construction is unacquired and does not resolve adapters or run legacy recovery. Acquire requires expected revision and a vacant/expired lease; allocation increments safe generation and quarantines old dispatched work in the same row transaction. A live owner yields `OWNER_HELD`. Default owner UUID is launch identity, not a principal or secret.

One acknowledged acquisition fixes the credential for the owner/raw handle lifetime. Renew explicitly before exclusive expiry (`now < expires_at`) with current expected revision. The fixed duration is **30,000 ms** from the first locked sample; renewal must strictly extend expiry, otherwise `LEASE_NOT_EXTENDED`. No timer/automatic retry. Release atomically quarantines active work, retains generation and vacates lease; close does not release, drain, cancel or undo an effect. Fresh construction/acquisition, not reading the newest token, is required after release/loss. Owner transfer is release then fresh acquire, not actor handoff.

V2 requires one trusted shared local wall-millisecond clock, normally Date.now. Transactions sample after writer-lock acquisition/load and again before authorization/update. Backward observations below persisted/local floor fail closed without clamping and cause sticky loss. Clock stop/jumps can delay takeover or prematurely expire live work; expiry is never proof of nonexecution. No independently skewed machine clocks, PID/death shortcut or force takeover. Clock callbacks must be synchronous/nonreentrant/nonmutating. Legacy floor/clamping behavior is not silently changed.

Loss/expiry, close, clock fault, corrupt/unavailable storage and unknown acknowledgement cannot be cured by observation. Stale revision alone permits explicit replanning, not credential refresh or automatic callback replay. Attempted COMMIT exceptions and failed rollback retire the handle as unknown; no compensating uncertainty write after an unknown result commit. Use a separate observer and exact historical commit identity to resolve local commit truth, never infer remote effect truth.

### Authentication and external-effect boundaries

The trusted host enrolls an exact dedicated inherited child/channel object out of band, supplies fresh services and a new private session map on each construction, authenticates on every command/read/duplicate and owns human authentication. Persisted principals, receipt subjects and approvals **are not restored sessions**. Actors get only `sendCommand`/`close`, not SDK/admin/store/database/credential access or JSON method dispatch. Same-user hostile code is not sandboxed. String IPC is bounded before application JSON parsing, but transport deserialization/resource limits remain host responsibilities.

Receipt duplicates require fresh auth/current visibility/current owner and return the exact original historical response without a new commit. Reuse the complete original envelope after unknown delivery; changing payload/revision/correlation under the same subject/ID is a mismatch. Read operations make no canonical writes. Handoff is scoped context exchange, not a grant or execution-owner transfer. Human approval is exact-attempt-bound and consumed at dispatch.

Final dispatch checks authoritative owner/generation/lease and active attempt immediately before the captured callable. Both old success and throw reject stale owner/attempt without diagnostics or canonical changes. Harmless renewal/unrelated receipt revision changes do not invalidate an otherwise valid in-flight v2 attempt; authority/task/attempt/lifecycle checks still apply.

**Final database check and external effect remain non-atomic.** P7's post-check takeover test freshly ran: an old unfenced callable can still physically act after takeover, while its canonical completion rejects. Opt-in `{adapter,execution_context:'chord.execution-context.v2'}` adds frozen generation/operation context only. A cooperating downstream must atomically fence lower generations in `(incarnation_id,run_id)` and deduplicate `JSON.stringify(['chord.effect.v1',incarnation_id,run_id,operation_id])` with semantic business-payload mismatch detection. It can accept an old request until observing a higher generation. Context propagation is not enforcement, exactly-once or automatic remote fence advancement.

Takeover/release quarantine leaves task uncertain/operation unknown, clears its reservations/lease expiry, closes dispatched sidecars and retains completed/consumed facts. No blind replay. Freshly authenticated evidence-backed human reconciliation and explicit eligible readmission are required; only confirmed-not-executed allows that path under current grants. Drain/join calls when possible before release/close and detach/disconnect/join actor children separately.

### Capacity, runtime and surface accuracy

The whole v2 envelope, receipts and linked histories share existing 1 MiB/16384-node/depth-32/1024-array/256-object-key limits; strings 16384, ordinary IDs 256, receipt/effect keys 2048. Renewal consumes capacity. No pruning/compaction. Synchronous complete replay/validation can be quadratic in history and blocks the event loop, plus 1000 ms SQLite writer wait. Bounds are not capacity or throughput promises.

Actual ESM enumeration on **Linux Node v24.22.1 and Bun 1.4.3**, in checkout and copied payload, confirms:

| Object | Enumerable count |
|---|---:|
| Root module / SDK module / platform module | **35 / 1 / 22** |
| Legacy SDK instance | **39** |
| Coordinated factory | **4** |
| Owner / observer / admin | **5 / 5 / 5** |
| Ingress / actor client | **2 / 2** |
| Raw coordinated store | **7** (`init`, `load`, `commit`, `checkOwner`, `checkDispatch`, `readHistory`, `close`) |

`S/surface-{node,bun}.log` records every exact name; payload counterparts match. These are enumerable members, not all module exports or guarantees that the full SDK exists on v2. `/sdk` still exports only `createChord`. Lazy common `node:sqlite#DatabaseSync` works on the measured runtimes; unsupported durable runtime fails closed, memory import is not a SQLite load. These are measured versions, not minimum/all-platform claims. Default Bun shim was unusable; absolute Bun was used. Full historical suite imports `bun:test`; only the shared suites are a full Node compatibility claim.

## Tests executed

Exact executed argv/cwd/exits and full logs: **`S/commands.json`** (52 child commands) plus the executable orchestrators **`S/run-gates.py`**, **`S/check-payload.py`**, **`S/verify.py`**. Top-level commands, repository cwd:

```text
python /home/d/.hermes/cache/scratch/chord-052-pass8/run-gates.py       # exit 0
python /home/d/.hermes/cache/scratch/chord-052-pass8/check-payload.py  # exit 0
python /home/d/.hermes/cache/scratch/chord-052-pass8/verify.py         # exit 0
```

Expanded child commands/exits are listed in the appendix below. No install was run: README install commands contain deployment-specific paths and are setup instructions, not claimed execution. Existing installed dependency was retained/linked. All **five JavaScript blocks** across both READMEs were extracted without alteration and executed on Node/Bun; shipped canonical examples remain byte-identical to their blocks. Payload's three package blocks and all four shipped examples were also executed. Development `bun` commands used the absolute working Bun executable.

| Gate | Fresh result |
|---|---|
| Full Bun suite | **356 pass, 0 fail, 1715 expect() calls, 26 files** |
| Coordinated five shared files, Node and Bun | **81 pass each**, 0 fail; Node 0 skipped/cancelled/todo |
| Original 051 five shared files, Node and Bun | **82 pass each**, 0 fail; includes all four recovery runtime pairs |
| Original safety harness, Node and Bun | **21 pass each**, 0 fail; original bytes equal `git show 1efafd1:docs/internal/046-state-probes.mjs` |
| Runtime verifier, Node and Bun | `ALL RUNTIME VALIDATIONS PASSED!` |
| README JS / examples | All exit 0; memory draft once, canonical approval/handoff/replay, legacy lifecycle and v2 acquire/release/scoped-read/reopen results match docs |
| Checkout public proof, four runtime pairs | All exit 0; actual file effects and independently reopened replay equality |
| Copied payload public proof, four pairs | All exit 0 with same semantic assertions |
| `npm pack --dry-run --ignore-scripts --json` | Exit 0; **63 files**, including both process examples, no new allowlist change needed |
| Payload root/SDK/platform import/member enumeration | Node/Bun exit 0, counts above |
| Preservation/symbol/block/harness/dependency checks | Exit 0; **68** source-symbol occurrences resolve, canonical blocks match, dependency set unchanged |
| `git diff --cached --stat` | Exit 0, empty |
| `git diff --check` | **2**, only protected pre-existing trailing whitespace at `049-final-report.md:7,99`, `release-notes-and-limitations.md:4` |

Counts overlap and are not summed as unique coverage. Node strict assertions are not Bun expect calls. Historical measurements are preserved, not rewritten as new results. No new mutation campaign/formal verification is claimed.

## Observed results

The public example uses **public exports only**, no fixtures/private source/test hooks. Owner and independent actor plus standby remain simultaneously alive through outcome observation; standby acquisition/dispatch reject OWNER_HELD/NOT_OWNER. Alice's channel and human approval are separately host-attested local channels, not a second human process or login service. Actor Bob contributes accepted handoff and its own work through inherited IPC. Two real exclusive-created work files and two results persist, not fabricated provider responses.

Every retained fresh checkout/payload pair has revision **14**, **6 command receipts**, **2 attempts/callable entries/effects/results**, complete replay equality and independent reopen equality. `S/proof-checks.json` compares raw `final.json`, `replay.json`, `reopened.json`, actual file contents, two ledger records and all three child code-0 exits rather than trusting only success flags.

| Checkout owner / actor | Owner PID | Actor PID | Standby PID |
|---|---:|---:|---:|
| Node / Node | 209533 | 209540 | 209550 |
| Node / Bun | 209679 | 209691 | 209712 |
| Bun / Node | 209823 | 209852 | 209859 |
| Bun / Bun | 209966 | 209994 | 210015 |

Inspectable evidence under `S/proof-<owner>-<actor>` and `S/payload-proof-<owner>-<actor>`: SQLite, `evidence.json`, `processes.json`, actor transcript, exact final/replay/reopened envelopes, role exits, effect ledger and Alice/Bob effect files. Fixed proof clock 100 demonstrates collaboration, not elapsed lease expiry; shared adversarial/storage suites separately cover expiry/clock/kill/takeover.

For payload validation, parsed this npm version's package-name-keyed dry-run JSON, copied **exactly its 63 listed files** into scratch `consumer/node_modules/@antistructured/chord`, linked only the existing SigilJS dependency and executed consumer-resolved blocks/self-spawning examples. This is payload/resolution validation, **not an npm install, tarball extraction or publication artifact certification**. Both same-runtime copied legacy restart examples also report `B5 PASS`; shared suites cover cross-runtime legacy restart.

## Invariants demonstrated

- Publicly documented methods/counts resolve on actual runtimes; all executable JS blocks work without private APIs or invented methods. Canonical identity/vision/workflow and historical reports remain intact.
- Fresh independent tests support the live bounded ownership, actor authentication/authorization, receipt, attempt, uncertainty, crash and combined replay claims; reports alone are not acceptance evidence.
- V1 remains exclusive sequential-restart only; v2 is explicit incompatible opt-in with fixed owner generation and host-enrolled actor IPC; neither is multi-machine consensus or the full Level B/Proof 2/3 contract.
- Actual artifacts demonstrate meaningful actor collaboration, scoped outcome disclosure, consumed approval, no duplicate effect on command replay and zero-effect replay/reopen.
- Protected non-doc entry bytes, sole pinned dependency, source language, manifest/version/scope and unstaged state are preserved.

## Known limitations

The final-check/remote-effect race is **unresolved and documented**, not downgraded to a test-only concern. Cooperating downstream fencing/deduplication remains required where stale physical effects are unacceptable and does not abolish distributed uncertainty. Shared trusted wall clock, host authentication/human attestations, filesystem identity/no live replacement/clone/restore, OS/SQLite/VFS/device sync and privileged host-code boundaries remain deployment assumptions. No encryption/secret detection, remote login, hostile-user sandbox, backup migration, compaction, auto-renew/takeover/retry daemon, staged-ack recovery, exactly-once or multi-machine claim. Process SIGKILL is not hardware power-cut proof. Example downstream is local cooperative behavior, not an arbitrary provider certification.

No new minimum runtime, install/network registry status, legal clearance or scope-control finding is inferred. Existing README publication/identity/legal assertions remain historical/maintainer-owned; no fresh registry certification was performed. Legal/identity/final-identity installed-artifact/provenance blockers from 050/051 remain. Existing whitespace is preserved. P9 final independent review remains unperformed.

## Blockers

**No blocker to Pass 9 within the accepted bounded local protocol. Pass 8 documentation/payload gate: PASS.** Stronger requirements (universal stale physical-effect exclusion, hostile hosts/independent clocks, multi-machine, migration or remote authentication) remain outside scope and require separate design. Publication remains unauthorized and blocked on existing maintainer/legal/artifact gates. No source fix was needed or hidden by a docs change.

## Next pass: READY or BLOCKED

**READY — Pass 9 independent final review only, under the parent's already-authorized sequence.** Review this guide with protocol/P3–P5 addenda, P6/P7 proofs, final preservation and exact command records. Independently challenge bounded claims and verify the final artifact rather than assuming docs/test totals are sufficient. Do not enter Block 053 or stage/commit/push/tag/publish. No Pass 9 action was performed here.

### Exact executed child-command appendix

Cwd aliases: `P=/home/d/Workspace/other-projects/chord/packages/core`, `R=/home/d/Workspace/other-projects/chord`, `C=/home/d/.hermes/cache/scratch/chord-052-pass8/consumer`. Commands below are literal expanded argv rendered with shell quoting; each label identifies its full `.log` in S.

| Log label | Cwd | Exact command | Exit |
|---|---|---|---:|
| `versions-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node --version` | 0 |
| `versions-bun` | P | `/home/d/.bun/bin/bun --version` | 0 |
| `shared052-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js` | 0 |
| `shared051-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 |
| `safety-node` | R | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test ./docs/internal/046-state-probes.mjs` | 0 |
| `verifier-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node src/verify-runtime.js` | 0 |
| `quickstart-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/quickstart.mjs` | 0 |
| `cross-actor-workflow-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/cross-actor-workflow.mjs` | 0 |
| `shared052-bun` | P | `/home/d/.bun/bin/bun test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js` | 0 |
| `shared051-bun` | P | `/home/d/.bun/bin/bun test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 |
| `safety-bun` | R | `/home/d/.bun/bin/bun test ./docs/internal/046-state-probes.mjs` | 0 |
| `verifier-bun` | P | `/home/d/.bun/bin/bun src/verify-runtime.js` | 0 |
| `quickstart-bun` | P | `/home/d/.bun/bin/bun examples/quickstart.mjs` | 0 |
| `cross-actor-workflow-bun` | P | `/home/d/.bun/bin/bun examples/cross-actor-workflow.mjs` | 0 |
| `full-bun` | P | `/home/d/.bun/bin/bun test` | 0 |
| `proof-node-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/chord-052-pass8/proof-node-node /home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `proof-node-bun` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/chord-052-pass8/proof-node-bun /home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.bun/bin/bun` | 0 |
| `proof-bun-node` | P | `/home/d/.bun/bin/bun examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/chord-052-pass8/proof-bun-node /home/d/.bun/bin/bun /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `proof-bun-bun` | P | `/home/d/.bun/bin/bun examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/chord-052-pass8/proof-bun-bun /home/d/.bun/bin/bun /home/d/.bun/bin/bun` | 0 |
| `root-block-0-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/root-block-0.mjs` | 0 |
| `root-block-0-bun` | P | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/root-block-0.mjs` | 0 |
| `root-block-1-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/root-block-1.mjs` | 0 |
| `root-block-1-bun` | P | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/root-block-1.mjs` | 0 |
| `package-block-0-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/package-block-0.mjs` | 0 |
| `package-block-0-bun` | P | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/package-block-0.mjs` | 0 |
| `package-block-1-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/package-block-1.mjs` | 0 |
| `package-block-1-bun` | P | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/package-block-1.mjs` | 0 |
| `package-block-2-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/package-block-2.mjs` | 0 |
| `package-block-2-bun` | P | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/package-block-2.mjs` | 0 |
| `pack-dry` | P | `npm pack --dry-run --ignore-scripts --json` | 0 |
| `diff-check` | R | `git diff --check` | 2 |
| `staged` | R | `git diff --cached --stat` | 0 |
| `surface-node` | P | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/surface.mjs` | 0 |
| `surface-bun` | P | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/surface.mjs` | 0 |
| `payload-surface-node` | C | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/surface.mjs` | 0 |
| `payload-block-0-node` | C | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/block-0.mjs` | 0 |
| `payload-block-1-node` | C | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/block-1.mjs` | 0 |
| `payload-block-2-node` | C | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/block-2.mjs` | 0 |
| `payload-quickstart-node` | C | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/node_modules/@antistructured/chord/examples/quickstart.mjs` | 0 |
| `payload-cross-actor-workflow-node` | C | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/node_modules/@antistructured/chord/examples/cross-actor-workflow.mjs` | 0 |
| `payload-process-recovery-node` | C | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/node_modules/@antistructured/chord/examples/process-recovery.mjs /home/d/.hermes/cache/scratch/chord-052-pass8/payload-recovery-node /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `payload-proof-node-node` | C | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/node_modules/@antistructured/chord/examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/chord-052-pass8/payload-proof-node-node /home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `payload-proof-node-bun` | C | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/node_modules/@antistructured/chord/examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/chord-052-pass8/payload-proof-node-bun /home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.bun/bin/bun` | 0 |
| `payload-surface-bun` | C | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/surface.mjs` | 0 |
| `payload-block-0-bun` | C | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/block-0.mjs` | 0 |
| `payload-block-1-bun` | C | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/block-1.mjs` | 0 |
| `payload-block-2-bun` | C | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/block-2.mjs` | 0 |
| `payload-quickstart-bun` | C | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/node_modules/@antistructured/chord/examples/quickstart.mjs` | 0 |
| `payload-cross-actor-workflow-bun` | C | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/node_modules/@antistructured/chord/examples/cross-actor-workflow.mjs` | 0 |
| `payload-process-recovery-bun` | C | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/node_modules/@antistructured/chord/examples/process-recovery.mjs /home/d/.hermes/cache/scratch/chord-052-pass8/payload-recovery-bun /home/d/.bun/bin/bun` | 0 |
| `payload-proof-bun-node` | C | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/node_modules/@antistructured/chord/examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/chord-052-pass8/payload-proof-bun-node /home/d/.bun/bin/bun /home/d/.volta/tools/image/node/24.22.1/bin/node` | 0 |
| `payload-proof-bun-bun` | C | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-052-pass8/consumer/node_modules/@antistructured/chord/examples/two-process-coordination.mjs /home/d/.hermes/cache/scratch/chord-052-pass8/payload-proof-bun-bun /home/d/.bun/bin/bun /home/d/.bun/bin/bun` | 0 |

