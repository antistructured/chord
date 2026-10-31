# Block 052A — A1 root-cause confirmation

## Pass

**A1 COMPLETE — both reported P2 defects independently reconfirmed; A2 READY. Block 052A is not yet COMPLETE.** This is an audit/design handoff, not a correction or acceptance of defective behavior. No A2/A3/A4 or Block 053 implementation occurred.

Repository `/home/d/Workspace/other-projects/chord`, branch `base`, full HEAD `72f96ab6cdc9d6948ffb7eacba527cc27a32a8be`. Actual entry status was exactly `?? docs/internal/052-committed-independent-audit.md`; tracked and staged diffs were empty. The historical untracked audit is protected evidence, not disposable output. Its entry SHA-256 is **`0b7609b61e593bcb546ce0cacb838b986cf7a90949393a8e8fe69a6b17cddc60`**.

Before any repository edit, captured Git state and SHA-256 of all **564** entry files in the universe `git ls-files --cached --others --exclude-standard` (563 tracked plus that audit). Entry inventory: `/home/d/.hermes/cache/scratch/052a/entry.json`. This universe intentionally excludes ignored dependencies/evidence. Code inventory is **53 source JS, 36 test/worker/fixture JS, four example MJS, zero TypeScript**, recorded as exact paths in `S/code-inventory.json`. Hereafter `S=/home/d/.hermes/cache/scratch/052a`, `R=/home/d/Workspace/other-projects/chord`, `P=R/packages/core`; source/test paths below are package-relative. Scratch is regenerable and may be pruned.

## Agent

**audit-agent**, focused delegated A1 only. Loaded `repository-documentation-verification`. Read the entire independent audit and normative 052 coordination protocol, then checked the live contracts, ingress/client, public coordinated dispatch, pure reducers, storage and related legacy lookups rather than treating old green counts as coverage of F1/F2.

## Files inspected

- Complete `docs/internal/052-committed-independent-audit.md`, `052-coordination-protocol.md`, `052-actor-ingress.md`, `052-concurrency-tests.md`. Their historical dirty baselines and old “no product correction” claims are not this pass's baseline or verdict.
- Complete `src/coordination/{contracts,commands,command-authorization,runtime,state,history}.js`, `src/runtime/{actor-client,actor-ingress}.js`, `src/runtime/storage/coordinated-sqlite.js`, `src/sdk/coordinated-chord.js`, `src/registry/{coordinated-owner,owner,registry,query,snapshot}.js`.
- Contract cloning/dictionary/reference/result definitions in `src/contracts/sigils.js`; relevant SDK construction, approval/admission/cancel/replay/resume wrappers in `src/sdk/chord.js`; complete `src/platform/{attempts,runtime-loop,task-queue,handoff,approval-flow,reconciliation,transitions,state-invariants,history,adapter-routing}.js`, `src/utils/clone.js`; manifest/export references and the all-source indexed-access inventory. No claim of an unrelated full source security review.
- Complete `tests/actor-ingress.test.js`, `tests/fixtures/coordinated-actors.js`, `tests/two-process-coordination.test.js`; existing storage/dispatch/adversarial regression names, assertions and execution output. All five 052 and five 051 shared suites were actually executed unchanged. Existing tests' ordinary generated IDs, serial client use and generic prototype/accessor rejection do not cover accepted inherited-member dictionary IDs or late responses across replacement wrappers.
- Original scratch `052-independent/{probes,edge-probes,client-ipc-probe}.mjs`, copied byte-for-byte to the new scratch root before rerunning, not run in place over prior evidence. Added scratch confirmation/client-detail/same-operation IPC probes and read their real JSON outputs.

## Files changed

Created **only `docs/internal/052a-root-cause-report.md`** in the repository. Every entry file, especially the historical untracked audit, is preserved byte-for-byte. No production/test/example/manifest/lock/version edit, dependency installation, staging, commit, reset, clean, stash, push, tag, publication or Block 053 work.

New scratch-only files: `entry.json`, `code-inventory.json`, `indexed-lookups.txt`, `run-gates.py`, copied original probes, `confirmation.mjs`, `client-details.mjs`, `same-operation-ipc.mjs`, command records/logs, full raw-row captures and result JSON. Final preservation evidence is `S/preservation.json`. A reusable delivery-identity lesson was added to the existing default-profile verification skill outside the repository; no other profile was modified.

## Design decisions

### F1 — root cause and minimal correction boundary

**Confirmed P2 availability/accepted-input defect, not privilege escalation.** Existing ID contracts accept `toString`, `valueOf`, `hasOwnProperty`; the exact forbidden strings are `__proto__`, `prototype`, `constructor`. Rejecting those three does not exclude other inherited members, and must not become a reason to narrow the accepted ID domain.

`clonePlainData` (`src/contracts/sigils.js#clonePlainData`) accepts ordinary or null-prototype input but always creates ordinary `{}` objects. `deepClone` and SQLite JSON round trips also reconstruct ordinary objects. In `src/coordination/runtime.js#planClaim`, both the new-ID check and `Attempt.assert(pending_attempts[taskId] || freshAttempt)` use inherited-inclusive truthiness. With no own reservation, the read returns an Object.prototype function; functions fail data cloning as `INVALID_DATA`. The public shell `src/sdk/coordinated-chord.js#runCycle` also reads `pending_attempts[task.task_id]?.attempt_id` without an own-property check. That optional-chain read happens to choose a fresh UUID for these functions, but is the same unsound lookup policy and must be corrected together with the pure planner. Shell-only repair is insufficient: SQL reconstruction and replay call the planner again.

Ready selection is priority descending, then `available_at` ascending, then queue-ID comparison (`src/platform/task-queue.js#selectReadyTask`). A failed plan commits no denial/retry state, so repeated cycles select the same oldest offending task and block otherwise runnable unrelated work. Skipping it would mask the valid-task execution defect.

**Recommended A2 implementation:** introduce/reuse one small pure own-property accessor with explicit absent sentinel, e.g. `o != null && Object.hasOwn(o,k) ? o[k] : null`, in a dependency-free utility or the smallest shared appropriate module. Read the reservation once per planning boundary. Preserve existing validation, collision detection, exact attempt identity and current accepted IDs. For dictionaries of validated records, null is unambiguously absent; for any map permitting false/zero/null values, preserve presence separately instead of reintroducing a truthiness test. Never use `o.hasOwnProperty(k)` because an admitted key can shadow that method. Do not change global prototypes.

**Null-prototype alternative rejected as the minimal fix.** Scratch actually proves null-prototype maps are accepted by RegistryData/Sigil validation and semantically serialize/replay, but both contract cloning and JSON restore Object.prototype. Changing only initial maps therefore does not fix loaded/replayed state. Making null prototypes persistent would require coordinated changes across cloning, JSON restoration, reducer construction and snapshots, with wider compatibility/representation risk. The own accessor changes neither wire/storage shape nor serialization, history deltas, equality, dependencies or SigilJS 0.18.0. It also works on existing ordinary dictionaries.

### All-source identifier-indexed lookup audit

Universe: every live `src/**/*.js` file, including legacy paths, not `.history` copies or dependencies. `S/indexed-lookups.txt` retains file/line/source for every bracket-access candidate (including fixed-enum/array accesses, assignments and deletes so they are not silently excluded). The following classification covers task, attempt, queue, handoff, approval, operation/receipt and correlation access families. “Referential” means safety depends on prior validated data, **not** that bare bracket access is intrinsically own-safe. No blanket own-property safety claim is made.

| Family / source symbols | Current lookup policy and consequence | A2 disposition |
|---|---|---|
| Coordinated `runCycle`; pure `planClaim` | Bare pending map reads / truthy fallback; **F1 reproduced** | Required own reservation lookup in both shell and pure reconstruction |
| `platform/attempts.js#prepareAttemptRecord,invalidatePendingAttempt,activatePendingAttempt,clearActiveAttempt` | Bare pending/active reads; preparation may mistake inherited function for existing record; invalidation/clear may return it; activation may manufacture a candidate from it | Audit/fix the shared record-presence policy; preserve reservation/idempotence and legacy revision semantics; add helper controls, not just v2 shell patch |
| `sdk/chord.js#createApproval,prepareAttempt,resumeRun` | Bare task/pending reads. Task helpers additionally check string task_id; pending approval/resume assumes existing record shape | Use own reads at caller-authored lookup boundaries; absent must remain absent, never invent approval/attempt. Keep explicit attempt override and historical helper contract |
| `sdk/chord.js#cancelTask,replayTask`; `platform/transitions.js#transitionTaskStatus,markTaskUncertain` | Bare task reads with task_id type checks; inherited functions fail those checks under ordinary prototypes | Fail-closed today for these missing IDs, but standardize own record lookup without changing errors or lifecycle |
| `platform/runtime-loop.js`; `registry/registry.js#registerExecutionResult` | Task from validated queue; bare active map reads, truthiness and later exact identity/status checks | Shared pending helper is a real sibling risk; own active lookup should not weaken missing/stale attempt rejection. Do not import v2 concurrency semantics into legacy mode |
| `coordination/runtime.js#assertAttempt,uncertain,outcomeCandidate,replayRuntime` | Installed sidecar explicitly Object.hasOwn; task/active/operation/result artifact/domain and historical sidecar reads otherwise bare. Full dispatch/queue/task identity and linked replay provide referential guards | Normalize direct dictionary reads where absence is meaningful; keep ownership first, then exact full active identity before diagnostics. Artifact/domain reads also have inherited-name hazards; separate from the reproduced task-ID failure |
| `coordination/commands.js#commandCandidate,duplicateReceipt,assertReceiptVisible,readCommand` | Existing local `own` helper guards admission duplicate tasks, receipt keys, response handoffs/approval requests and pending approvals; outcome task filtering uses own. Some reads derived from sidecar/task/receipt are bare (read handoff, operation state, replay first task) | Reuse the policy, do not weaken current authenticated visibility. Derived IDs are validated/replayed, but bare derived references are not a general safe accessor |
| `coordination/command-authorization.js#liveTask,validatePolicy` | Object.hasOwn before task use; principals/actors/rules use array find/filter | Already own-safe or non-dictionary; retain exact scope/policy semantics |
| `coordination/state.js#quarantine,adminCandidate,crossInvariants` | Own checks for new reconciliations, active additions/removals and required active presence; bare task/operation/dispatch references for validated entries/sidecars | Retain referential validation plus own-safe access; do not conflate inherited values with installed active state |
| `registry/owner.js#transact` | `!current.active_attempts[id]` determines whether to stamp dispatch revision | Truthiness-based absent-record decision; same own-presence cleanup candidate, no change to legacy CAS protocol |
| `platform/task-queue.js` | Queue itself is an array, addressed by find/filter/sort, not a task-key dictionary. Retry/dead-letter helpers also read tasks by bracket | Preserve equality searches/order. Task access should be own-safe; queue reference validation currently guarantees stored task presence |
| `platform/handoff.js#respondToHandoff`; coordination handoff code | Legacy handoff map uses truthiness then proposed-status/recipient checks; coordinated response uses `own` for domain+sidecar | Missing inherited legacy member fails status checks, not demonstrated authorization bypass. Normalize legacy presence only if in scope; do not expose it as actor endpoint |
| Approval/grant/principal/actor collections | Authority records are arrays/Map/find/filter, not raw ID dictionaries. `coordination.approval_requests` uses own for caller-selected request; visibility enumerates own values | No absent inherited lookup in the coordinated request/response path; preserve distinct-human/exact-attempt approval checks |
| `platform/reconciliation.js#operationFor,reconcileTask`; `registry/snapshot.js#importRegistry` | Nested task→operation reads use bracket/truthiness; operations normally allocated generated IDs, guarded by stored references/status. Reconciliations enumerated/validated | Normalize absence policy; no new canonical bypass inferred from host maintenance or malformed raw state |
| `contracts/sigils.js#RegistryData`; `platform/state-invariants.js` | Own-reference checks for queue/results/pending/active/operations; some subsequent bare reads depend on those checks. Transition checker reads after.tasks[id], artifact/domain records by truthiness | Keep exact records and referential invariants. Truthy transition reads alone are not own checks; missing legitimate immutable task fails later equality/status guards |
| `platform/history.js#sameData,stateChanges,applyChanges`; coordination replay | Equality enumerates own keys; diff carries explicit Object.hasOwn flags; patch traversal and leaf preconditions use Object.hasOwn; reserved path segments rejected | Already own-aware replay primitives; preserve semantic equality/dense linked history, do not change journal bytes |
| Correlation/causation and command operations | IDs are fields compared directly or part of a canonical tuple receipt key, not free correlation-key objects. Receipt map own lookup is safe; actor client has a single anonymous pending slot, not an ID map | F2 is delivery identity absence, not receipt dictionary pollution |
| Adjacent router/artifact/domain/trigger maps | `adapter-routing.js#resolveAdapter` uses truthy exact[entity]; registry artifact/domain initialization uses ||= and result updates use bare truthiness. Trigger state contract enumerates own keys; no indexed execution lookup found | Record adjacent inherited-member hazards, not falsely certify them safe or claim fresh exploit proof. A2 should assess related own-lookup cleanup with focused controls; do not rewrite routing precedence or artifact lifecycle |

Generated IDs and prior checks reduce reachable cases but do not justify the protocol's universal safe-own-property claim. The proven minimal defect is absent pending reservations. This table identifies sibling cleanup/review targets without claiming every bare read is independently exploitable or silently broadening this audit into fixes.

### F2 — root cause, response contracts and identity decision

**Confirmed P2 client delivery/correlation defect, not a bypass of canonical authentication/receipts.** `src/runtime/actor-client.js` stores only `{resolve,reject}`. Any string parsing to an object with `protocol_version:'chord.actor-response.v1'` resolves the current slot. There is no response shape/result validation or match to operation/run/incarnation/correlation/causation, no channel-session or per-send request identity, and no per-channel exclusive-client guard.

The stable host binding `(issuer,binding_id,principal_id,actor_id,run_id,incarnation_id)` authenticates a dedicated inherited channel through a private live map on every command; none of those identity fields are secrets. `attachChild` computes responses synchronously through `handleAuthenticated(child,wire)` and sends them asynchronously; delivery ordering/abandonment is not a canonical transaction. `close()` detaches this wrapper's listeners and rejects its local promise but leaves the transport connected and its already-sent response in flight. A new wrapper can receive that genuine old reply. One pending request per **instance** is not one pending request per persistent channel (the older ingress report's stronger wording is inaccurate).

**Actual live contracts** (`src/coordination/contracts.js`, `src/runtime/actor-ingress.js`):

| Boundary | Exact keys / semantics |
|---|---|
| ActorCommand | `protocol_version, operation_id, run_id, incarnation_id, expected_revision, correlation_id, causation_id, type, payload`; all required, explicit nulls. Seven allowlisted types. Writes require UInt expected_revision; reads allow null |
| SuccessResponse | `protocol_version, operation_id, correlation_id, causation_id, run_id, incarnation_id, ok:true, revision, commit_id, owner, result`; owner nullable for reads, otherwise owner_id/generation/lease_expires_at. SigilJS exact schema + identifier/numeric semantics |
| Result validation | `validateCommandResult(type,result)` checks seven exact variants: submit task_ids; handoff ID/status; approval request/attempt; approval response status/approval/run_state; context + visible handoffs/requests; bounded outcomes |
| Rejection response | `protocol_version, operation_id, correlation_id, causation_id, ok:false, code, commit_status`; NO run_id/incarnation_id. The three command IDs are all null until the command fully validates (including authentication/JSON/shape failures). commit_status is not_committed or unknown. Currently constructed ad hoc, **no shared exported rejection/ActorResponse contract** |
| Durable CommandReceipt | `receipt_key,binding_subject,command,response`; exact success only, not reads/denials. Verifies all five response identity fields equal command, result variant, revision = original expected_revision+1, owner nonnull, stable binding tuple |

Command operation_id is a **durable command idempotency identity**, distinct from the generated external-work OperationRecord.operation_id/idempotency key. Retry of a write must retain the complete original command, including expected revision/correlation/causation/payload. A currently authenticated, authorized duplicate gets the original historical response unchanged, even after a new owner generation; it is not evidence of current lease/revision. Reads have no durable receipt and can repeat or change results. Neither correlation nor causation is a unique delivery ID (both can be null). A transport identity must not become an authentication credential or be injected into exact canonical commands/receipts.

**Request/session identity recommendation selected for reusable channels:** separate delivery identity from operation identity. A3 should use a bounded, exact, explicitly versioned transport frame carrying a fresh wrapper/session nonce plus a fresh per-send request nonce and the unchanged canonical command; echo both around the unchanged canonical response. The host must authenticate the actual child/channel before dispatch; framing does not select identity or bypass validation. Transport metadata is not persisted, hashed into receipt keys, used as authority, or exposed to adapters. Keep `handleAuthenticated(context, canonicalCommandJSON)` and durable contracts intact; frame/unwrap only at the concrete client/attachChild transport boundary. Client `sendCommand(raw)` still accepts the same canonical command and resolves the same canonical response.

Why not just compare operation_id? The additional actual IPC probe reuses a read operation ID for a different valid read, with identical run/incarnation/correlation/causation. All five response identity fields match B, yet the old A context result settles B's outcomes request. Type-specific result validation catches that particular pair, but repeating the **same** read would be indistinguishable even after shape validation. Fresh delivery identity handles both repeats and historical write-receipt retries without banning legal command reuse. Per-channel counters reset on wrapper replacement are insufficient without a fresh session nonce.

**Compatibility decision required in A3 before implementation:** retain the current JS facade and canonical `handleAuthenticated` route; specify versioned framed IPC and intentional support for existing raw canonical-command peers at the host edge. Existing `createActorClient(channel)` injected-channel consumers/worker mocks may expect bare command strings, so changing default wire bytes is an explicit transport compatibility change, not “internal only.” Do not silently auto-downgrade a framed request and regain the bug. If a backward-compatible persistent-channel framing mode cannot be provided within scope, the sound alternative is an **enforced channel retirement policy** after abandonment (including shared per-channel ownership, not a comment), while retaining a clearly bounded legacy path. Merely matching some response fields or forbidding new IDs is not the complete reusable-channel solution. This report selects separate request/session identity as the correction recommendation, but installs no new protocol or API option.

**A3 cleanup/validation requirements:**

- Retain a detached pending command plus exact pending-request object. Validate bounded plain data and exact success/rejection shape; successful result must match pending type, all identity fields must match; framed error matches its delivery identity even if operation_id is null. Never blindly attach a null-ID error to whichever request happens to be pending.
- Ignore unrelated/stale-session/request replies without clearing current pending. Define matched malformed-frame handling as a deterministic local protocol error, no canonical retry or fabricated commit status. Malformed/unattributable frames cannot acknowledge an operation.
- Send-error callback, synchronous send throw, disconnect and close must act on the captured pending object (`pending === captured`), settle once, clear exactly that request, and never clear/reject a newer one. Disconnect/close lifecycle must be explicit and listener cleanup verifiable.
- Enforce exclusive wrapper ownership or one channel-level dispatcher; current multiple wrappers each receive the same response. Preserve second-send rejection (`ACTOR_COMMAND_PENDING`) unless separately designing multiplexing.
- There are currently **no timers/timeouts/abort/resend**. Do not add automatic retry. A future explicit timeout means local delivery abandonment/unknown command acknowledgement, NOT proof a command did not commit; original receipt recovery still requires fresh auth. Identity hardening need not add a timer.

## Tests run

Actual runtimes: `/home/d/.volta/tools/image/node/24.22.1/bin/node --version` → **v24.22.1**, `/home/d/.bun/bin/bun --version` → **1.4.3**, both exit 0. Used absolute binaries rather than the broken default Node shim. TMPDIR explicitly `/home/d/.hermes/cache/scratch` for the gate runner.

Exact expanded argv, cwd, exit, duration and log path are retained in `S/commands.json`, `S/extra-commands.json`, `S/identity-commands.json`. All commands below exited **0**. Symbols N/B/R/P/S expand to the literal absolute paths specified above; no shell-version ambiguity. Executed orchestrator: `python3 /home/d/.hermes/cache/scratch/052a/run-gates.py` from R, exit 0 (three independent jobs maximum). The confirmation commands were also initially run directly before the separately recorded final rerun; both initial exits were 0.

| Exact command (with declared path symbols) | Cwd | Actual observed output / log |
|---|---|---|
| `/home/d/.bun/bin/bun test` | P | 356 pass, 0 fail, 1715 expect calls, 26 files; `S/full-bun.log` |
| `N --test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js` | P | 81 pass, 0 fail/skipped/cancelled; `S/052-node.log` |
| `B test tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js` | P | 81 pass, 0 fail; `S/052-bun.log` |
| `N --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | P | 82 pass, 0 fail/skipped/cancelled; `S/051-node.log` |
| `B test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | P | 82 pass, 0 fail; `S/051-bun.log` |
| `N --test ./docs/internal/046-state-probes.mjs` | R | 21 pass, 0 fail; `S/safety-node.log` |
| `B test ./docs/internal/046-state-probes.mjs` | R | 21 pass, 0 fail; `S/safety-bun.log` |
| `N src/verify-runtime.js`; `B src/verify-runtime.js` | P | ALL RUNTIME VALIDATIONS PASSED on each; `S/verifier-{node,bun}.log` |
| `N S/probes.mjs`; `B S/probes.mjs` | R | Original F1 ordinary/three-ID controls and EventEmitter F2 diagnostic; `S/probes-{node,bun}.log` |
| `N S/edge-probes.mjs`; `B S/edge-probes.mjs` | R | Original head-blocking full-row/long-receipt/order/replay characterization; `S/edge-probes-{node,bun}.log` |
| `N S/client-ipc-probe.mjs`; `B S/client-ipc-probe.mjs` | R | Genuine late-A IPC settles B on both; `S/client-ipc-probe-{node,bun}.log` |
| `N S/confirmation.mjs`; `B S/confirmation.mjs` | R | 15 assertion-backed result rows each: eight dispatch cases, six exact forbidden-ID/key denials, one prototype/serialization/replay characterization; `S/confirmation-{node,bun}.log` |
| `N S/client-details.mjs`; `B S/client-details.mjs` | R | Four lifecycle/concurrency/shape diagnostic cases each; `S/client-details-{node,bun}.log` |
| `N S/same-operation-ipc.mjs`; `B S/same-operation-ipc.mjs` | R | Same operation/run/incarnation/correlation/causation cannot distinguish deliveries; `S/same-operation-ipc-{node,bun}.log` |
| `git diff --check`; `git diff --cached --stat` | R | Both empty, exit 0 |

The original safety harness was compared byte-for-byte to `git show 1efafd1:docs/internal/046-state-probes.mjs`; unchanged SHA-256 **`95b72cd7189bb2d54685bdd3f08561ef0740f3e8399bbc04cb10a269228248eb`**. Hash/check assertions exited 0. Full historical suite imports bun:test, so no full-suite Node claim. Counts overlap and are not summed. Shared suites include actual four runtime-pair restart/live proofs and SIGKILL cases; A1 did not separately rerun standalone quickstart/cross-actor CLIs or undertake a new independent raw inspector of every live proof DB. That broader final proof gate belongs after correction.

## Results

### F1 actual public-ingress → public-dispatch outcomes

`S/confirmation.mjs` grants each exact renamed scope through trusted host setup, submits through authenticated production ingress, submits a later foreign actor's ordinary task at time 101 after the first at 100, then releases/reopens/acquires the public `createCoordinatedChord` factory. The fallback adapter records every task entry. Each case runs three cycles and captures `SELECT * FROM chord_coordination` before and after **each** cycle. No production hook or source mutation.

| Input/reservation | Expected supported behavior | Observed on Node AND Bun |
|---|---|---|
| ordinary-a1-task, no pending attempt | Both authorized tasks complete once | result/result/SKIPPED; exactly one call per task, both completed, two results, combined replay equal |
| toString, no pending attempt | Same as ordinary control | INVALID_DATA three times; zero calls for either task; both queued; entire singleton row identical after each failure; combined replay equal |
| valueOf, no pending attempt | Same as ordinary control | Identical three failures/zero calls/full-row equality/head blocking |
| hasOwnProperty, no pending attempt | Same as ordinary control | Identical three failures/zero calls/full-row equality/head blocking |
| ordinary and each of the three inherited-member IDs, real approval-created own pending attempt | Exact human approval, reserved attempt executes once; second task completes | All four pass: result/result/SKIPPED, once per task, two results, approval consumed by exact attempt, combined replay equal |

The positive approval cases show an own reservation masks the defect; they are not a general fix. Evidence: `S/confirmation-{node,bun}.json`, `S/rows-{plain,approval}-<literal-task-ID>-{node,bun}.json` (before and all three complete rows), plus copied original probe results and head-blocking rows. For each of `constructor`, `__proto__`, `prototype`, actual ingress rejects both its use as task_id value and as a literal JSON own key in payload with **INVALID_COMMAND**, all command identity fields null, not_committed, and exact row preservation. The value denial comes from ID semantics; own-key denial precedes schema semantics in clonePlainData. No ID rule changed.

### F2 actual child IPC and lifecycle outcomes

Copied original child probe: A is valid `project_context` operation `late-a`; old wrapper sends then closes; replacement sends B `observe_outcomes` operation `new-b`; trusted parent computes **both genuine responses via production ingress**, holds A until B has been sent, delivers A then B. Expected: A cannot settle B. Observed: B resolves **late-a**; actual B is ignored. Node self/spawn PID **94308**, Bun **97800**; child exits 0/no signal and complete raw SQLite row is unchanged. Evidence `S/client-ipc-{node,bun}.json`. These are real inherited fork IPC channels, not synthesized API replies.

Additional same-operation child probe: both commands have operation_id `same-read-operation` and identical run/incarnation/correlation/causation. Replacement B still resolves A's context object rather than its requested outcomes. Node self/spawn PID **103889**, Bun **103928**, complete row unchanged and exit 0 on both. This independently demonstrates the delivery-versus-idempotency identity decision is necessary for robust reusable-channel handling; storing only operation_id is insufficient.

Scratch EventEmitter detail probes on both runtimes additionally assert:

1. Two simultaneous wrappers on one channel both accept response A despite sending distinct A/B.
2. A protocol-version-only object lacking all response fields resolves the promise.
3. A second send on one wrapper rejects ACTOR_COMMAND_PENDING; no automatic settlement occurs during the explicit 15 ms observation; disconnect rejects pending but retains listeners until close. Source confirms no timer exists; 15 ms is not an exhaustive timeout proof.
4. After A response settles A and B is installed, A's delayed send-error callback clears **B's** pending slot while rejecting the already-settled A promise. Genuine B response is ignored; even close cannot settle the orphaned B promise. This is a deterministic transport-unit lifecycle defect within F2's identity family, not a claim about observed OS callback scheduling. Source also leaves pending installed after a synchronous send throw; A3 must guard that cleanup even though this pass did not separately execute that branch.

Diagnostic scripts intentionally assert present defective behavior, hence their exit 0 means **reproduction succeeded**, not product acceptance. No new P0/P1 canonical auth/receipt exploit was established. Existing inherited audit genesis timestamp characterization remains semantic replay behavior, not a new security requirement or correction target.

## Invariants verified

- All fresh original baseline gates pass unchanged: Bun356/1715 expectations; shared05281 and shared05182 on each runtime; original safety21 on each; both verifiers. These do not cover the reproduced F1/F2 paths.
- F1 rejects before any callable or canonical mutation: complete header/envelope/lease/floor/receipt/history singleton rows remain equal after every rejected cycle, including later unrelated work. The intended availability invariant nevertheless fails.
- Valid own reservations retain exact human approval, attempt linkage, once-only calls and semantic combined replay. No acceptance-contract narrowing, replay weakening or automatic skip/retry was used.
- F2 reads produce zero canonical writes; late responses come from trusted ingress, not forged authority. Client delivery correctness fails while canonical authorization/receipt semantics remain intact in the tested paths.
- Raw response envelopes contain no host credential/channel object; transport identity is not proposed as authority. Original historical receipt bytes/metadata must remain unchanged in A3.
- All 564 entry files match their original SHA-256/presence; HEAD/branch and empty staged diff preserved. Final changed-path scope is the historical untracked audit plus the new A1 report only.

## Known limitations

- A1 implements no fix; both P2s remain outstanding. All-source indexed-access audit is a source classification, not exhaustive exploit proof for every sibling access. Adjacent router/artifact/domain hazards require focused acceptance checks if included in A2.
- New F1 fixtures reuse the installed trusted-host actor fixture but exercise actual public ingress, persisted state and public dispatch. F2 fork probes use that production ingress with explicit test enrollment, not a remote human login or hostile-OS isolation claim.
- No new mutation campaign, install/package publication, downstream fencing protocol or deployment certification. Trusted host/shared clock/local regular-file identity/SQLite durability assumptions remain. Final-check/physical-effect race, no exactly-once remote guarantee and no automatic unknown retry remain unchanged.
- The robust reusable-channel recommendation requires an explicit framed-wire compatibility choice before A3; the current exact raw-command API cannot invisibly gain fields. Null-operation failures and legacy peers must be handled deliberately, not acknowledged by guesswork. No engineering/runtime blocker was encountered; all final commands passed.
- Scratch evidence is outside the repository and subject to pruning. The report retains commands, root causes and paths rather than embedding multi-megabyte rows. Existing shared tests retain/run their own bounded process proofs; final correction acceptance should re-inspect named standalone proof artifacts as previously required.

## Next-pass readiness

**A1 gate: COMPLETE. A2: READY. 052A: NOT COMPLETE. 053: BLOCKED pending complete 052A/A4 acceptance.** Parent should read this exact artifact before advancing: `docs/internal/052a-root-cause-report.md`.

**Minimal A2 handoff:** fix own reservation reads coherently in public shell and pure planner/reconstruction; audit sibling pending/active record helpers from the table. Preserve all accepted IDs, existing exact shapes, null/absent semantics, collision detection, approval consumption, legacy revision/CAS behavior, ownership/attempt-first rejection, receipts/auth and replay. Add permanent shared regressions from scratch confirmation: all three IDs plus ordinary control, absent/present pending attempt, later unrelated task; require both valid tasks to complete exactly once and replay equal after correction. Preserve forbidden-ID ingress negatives and full-row/call assertions on failed stale paths. A negative-only exploit diagnostic cannot be counted as fixed behavior.

**Minimal A3 handoff:** fix response shape/match and pending-object cleanup together; resolve the selected session+request delivery framing and legacy transport compatibility before coding. Preserve `sendCommand`/`close`, canonical command/response shapes and current receipt recovery semantics; no transport identity in durable commands, auth, receipts or adapters. Permanent actual IPC tests must cover late A after replacement (distinct and reused operations), wrong run/incarnation/correlation/causation, null-ID protocol errors, malformed responses, close/disconnect/send errors, two wrappers/concurrency, stale callback A while B pending, and genuine historical duplicate write success after fresh authentication. Zero incorrect settlement, zero canonical write for read negatives, no retries/receipt metadata refresh.

**A4/final gate remains pending:** rerun full/shared051/shared052/safety/verifiers and new regressions on Node/Bun, all four standalone live/restart runtime pairs with independent raw-row/artifact checks, preservation and independent review; then and only then decide 052A COMPLETE and subsequent authorized 053 readiness. Nothing staged/committed/published, and no new permission inferred from this A1 audit gate.
