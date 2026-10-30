# Block 052 — Authenticated actor ingress and atomic command transitions

## Pass

**Pass 4 only — actor-ingress-agent. Implemented; READY for Pass 5 dispatch integration, not live coordinated scheduling or publication.** Repository `/home/d/Workspace/other-projects/chord`, protected dirty 050/051/052 working tree. No Block 053, staging, commit, push, tag, version, dependency, manifest or lockfile change. No legacy runtime path was enabled or modified.

## Agent

**actor-ingress-agent.** Loaded `owner-cas-mutation-testing` and recorded reusable dedicated-channel/receipt-proof lessons there, outside the repository. An attempted auxiliary coding CLI failed authentication before editing anything; implementation and verification were completed directly. No credentials were solicited or modified.

## Files inspected

- Full accepted `docs/internal/052-coordination-protocol.md` (530 lines), `052-ownership-audit.md` and `052-fencing-implementation.md`, including the P3 addenda and staged handoff.
- Complete current `packages/core/src/coordination/{contracts,state,history}.js` and `src/runtime/storage/coordinated-sqlite.js` before changes.
- Actual `src/contracts/sigils.js`, `src/sdk/chord.js`, `src/platform/{authorization,handoff,approval-flow,attempts,reconciliation,transitions,state-invariants,policy}.js`, `src/execution/task-packets.js`, `src/index.js`, and the existing coordinated-storage suite/fixtures.
- Final test command records, raw singleton row assertions, combined replay assertions, real actor PID diagnostics and entry/final SHA-256 preservation inventory.

Abbreviated `src/` and `tests/` paths below are relative to `packages/core/`. Scratch root **`S=/home/d/.hermes/cache/scratch/chord-052-pass4`** retains regenerable logs, `commands.json`, `run-tests.py`, entry hashes and preservation evidence; it is not a release artifact and may be pruned.

## Files changed

Modified only these pre-existing P3 source files:

- `packages/core/src/coordination/contracts.js` — exact SigilJS actor, binding/subject, policy/rules, response/result, receipt, handoff authorization, approval request, visibility and command evidence contracts; bounded canonical receipt tuples; nonempty coordination dictionaries now require exact records.
- `packages/core/src/coordination/state.js` — exact-next fenced policy installation, pure policy validation and protection against host-maintenance rewriting actor-authenticated handoff records.
- `packages/core/src/coordination/history.js` — command reconstruction and authorized transition/evidence equality at every corresponding domain revision; policy replay.
- `packages/core/src/runtime/storage/coordinated-sqlite.js` — atomic actor command/policy branches inside the existing owner-fenced singleton transaction, including receipt-before-stale-revision ordering and final time checks.
- `packages/core/src/index.js` — explicit experimental `createActorIngress` and `createActorClient` exports; clarified the adjacent experimental storage comment. Original legacy exports remain intact.

Created:

- `packages/core/src/coordination/command-authorization.js`
- `packages/core/src/coordination/commands.js`
- `packages/core/src/runtime/actor-ingress.js`
- `packages/core/src/runtime/actor-client.js`
- `packages/core/tests/actor-ingress.test.js`
- `packages/core/tests/actor-ingress-worker.js`
- `packages/core/tests/fixtures/coordinated-actors.js`
- `docs/internal/052-actor-ingress.md` — this report.

All other entry files, including every prior test, report, legacy kernel change, manifest and lockfile, remain byte-identical. Nothing was deleted. The only changes to earlier implementation are the named P3 extension points and explicit root exports.

## Implementation decisions

### Ports and authentication boundary

Installed host composition API:

```js
createActorIngress({ authenticate, load, commitCommand, clock })
// -> frozen { handleAuthenticated(channelContext, commandJSON), attachChild(child) }
// attachChild -> frozen { detach() }; only transport delivery is attached.

createActorClient(channel = process)
// -> frozen { sendCommand(command): Promise<ActorResponse>, close() }
```

`authenticate` is synchronous trusted embedding code consulting a private, freshly populated host channel/session map. It must attest launch configuration/identity out of band, bind the exact dedicated inherited child/channel object before processing actor commands, and reject disconnected, revoked, expired or foreign sessions. The detached binding is frozen. Schema validation **does not authenticate a principal or a human**. There is no enrollment, binding selection, principal selection, capability selection, grant installation, SDK method dispatcher, store reference, owner credential or database path in the actor wire protocol.

The concrete transport adapter accepts a **string containing one bounded JSON document**, checks the byte bound before parsing, and rejects malformed/multiple frames, nonstring messages and unknown fields. The restricted client has one outstanding request per channel. Delivery failure after a command commit never compensates or re-executes it; the retained original command must recover its durable receipt. No network server or public mailbox was invented.

The minimal host composition deliberately injects two privileged closures rather than constructing P5's scheduler or legacy SDK:

```js
const ingress = createActorIngress({
  authenticate: child => child.connected ? sessions.get(child) ?? null : null,
  load: () => store.load(),
  commitCommand: (binding, command) => store.commit({
    expectedRevision: command.expected_revision,
    credential: capturedAcknowledgedCredential,
    change: { kind: 'actor_command', binding, command }
  }).result,
  clock
});
```

This code belongs only to the trusted host. `capturedAcknowledgedCredential` must be fixed to its actual acknowledged acquisition, never loaded/adopted from disk. The existing store independently enforces that handle capture. `load` and `commitCommand` are **not** actor callbacks or callable JSON values; they run outside the SQL reducer. Only the store's existing trusted synchronous clock is sampled inside SQL. P5 can compose these closures into `createCoordinatedChord`; this pass does not pretend that factory or a scheduler exists.

### Commands and atomic receipts

All seven accepted commands are implemented: `submit_work`, `project_context`, `propose_handoff`, `respond_handoff`, `request_approval`, `respond_approval`, and `observe_outcomes`. Exact envelope keys, pinned run/incarnation, mandatory expected revision for writes, fixed host-bound submission capability/approval requirement, and recursive data budgets are enforced. Submission validates the full batch before any installation, retains operation-signature duplicate/unknown quarantine, creates durable operation identity and uses only existing exact TaskPacket/domain records. It mints no grants. Its deterministic queue defaults are priority 0 and max_attempts 3 (existing default), with authoritative host time; actor JSON cannot choose queue policy.

A new command checks current owner/generation/lease, fresh attested binding, issuer/principal/actor validity, exact current scope/capability/grants/deny and installed policy **inside SQL**. The final authoritative clock sample rechecks time-dependent authorization and candidate validity before the singleton update. Receipt, original success response, registry transition, coordination transition, logical floor and both linked histories are one atomic row.

The stable key is the canonical JSON tuple `[issuer,binding_id,principal_id,actor_id,run_id,incarnation_id,operation_id]`, bounded at 2048 characters. Exact full normalized request equality includes expected revision and correlation/causation. After valid ownership and fresh authentication, duplicate lookup precedes stale command revision rejection. Exact duplicate returns the **original historical response**, including its old commit/revision/owner metadata, with no UPDATE, canonical commit or new receipt. Changed request under the same subject/operation rejects `OPERATION_ID_MISMATCH`. Different subjects have disjoint keys. Current permission/visibility is required even for a previously committed receipt. Rejections do not append canonical diagnostics.

Reads require no owner and use one fully validated snapshot plus fresh host clock/authentication. They do not write a floor, receipt, lease, recovery event or diagnostic. Task context/results are scoped independently of handoff/approval visibility: a recipient can discover and answer its authorized handoff without execution permission or disclosure of the original task result/spec. Unknown and unauthorized IDs are identical omissions. Outcomes evaluate each requested task scope directly, not just the first 100 context tasks. Coordination views are bounded and current-policy/current-grant filtered.

### Durable handoff and human approval

Policy installation uses `change:{kind:'admin',operation:'coordination_policy',nextRegistry,nextPolicy,audit_label}`, current owner and exact expected run revision. Only this operation permits nonnull `nextPolicy`. It requires exact-next policy revision, unique nonambiguous exact-scope rules, distinct parties, valid referenced actors/tasks and 1..30,000 ms TTL. Policy installation changes no other domain facts. Empty genesis policy grants nothing.

Handoff proposal derives immutable scope from the stored task, authenticates sender, checks current sender/recipient validity and both fixed exact handoff grants, selected ordered policy pair and expiry. It installs the unchanged v1 HandoffRecord plus exact sidecar and receipt atomically. Response is target-only, revision checked, exclusive-expiry checked, unresolved, current-policy and both-party reauthorized; it persists the authenticated response subject and authority revision. Acceptance never transfers execution ownership, task authority, capability, grant or effect dispatch. Legacy host handoff helpers are not exposed. Host maintenance cannot overwrite a sidecar-backed actor handoff response through raw domain JSON.

Approval request requires the task's actual subject and `chord.approval.request`, checks the selected human policy party and exact response grant, prepares/reuses a deterministic pending attempt, persists the request and pauses atomically. Already-paused runs retain/tighten their deadline rather than extending it. A request issues no approval. Response requires the current policy-selected freshly authenticated **human principal distinct from the requester**, both current exact grants, unexpired pending request and unchanged queued reservation. The kernel constructs the exact attempt-bound Approval, increments authority revision once and records response/receipt. Approval consumes nothing yet. Rejection records a rejected approval and fails the paused run. Approval resumes only when each queued task independently passes exact dispatch-approval evaluation and its installed human policy; different humans can approve different tasks. No runtime call follows either command.

### Pure reducers and replay addenda

As in the P3 addendum, legacy helpers that mint IDs, sample ambient Date.now or bump revision internally cannot literally run in the locked pure reducer. P4 uses pure equivalents of admission, handoff, pending attempt and pause/resume/rejection projections. The shell preallocates the one domain commit UUID; subordinate record IDs derive deterministically from it and batch index, with collision rejection. Exactly one outer revision/closing commit is installed. No arbitrary callback, ambient clock, random generator or adapter runs in these reducers.

Combined replay reconstructs each command from its exact durable receipt and the shell-preallocated commit ID, reevaluates canonical current-at-that-revision scope/grants/policy/parties/time, and compares the complete expected domain projection, coordination projection and evidence. Extra, replaced, detached or forged receipts/policy/handoff facts fail; lifecycle/admin steps cannot silently alter receipts. The accepted exact receipt stores a stable BindingSubject, **not a login session or full TrustedBinding**. Accordingly replay reconstructs the submission capability/approval requirement from the committed immutable task binding and verifies the authorized transition; it neither recreates nor claims to cryptographically prove historical out-of-band host authentication. That authentication is checked at live ingress/SQL acceptance and remains the stated trusted-host boundary. No new persisted session field or legacy schema extension was introduced.

## Tests executed

Runtimes: **Node v24.22.1**, **Bun 1.4.3**. `N=/home/d/.volta/tools/image/node/24.22.1/bin/node`, `B=/home/d/.bun/bin/bun`. Package cwd `/home/d/Workspace/other-projects/chord/packages/core`; safety cwd repository root. Exact expanded argv/cwd/exits and full logs are retained in `S/commands.json` and corresponding named `.log` files; `S/run-tests.py` executes the following matrix.

| Command | Exit | Observed result |
|---|---:|---|
| `$N --test tests/actor-ingress.test.js tests/coordinated-storage.test.js` | 0 | **40 pass**, 0 fail/skipped/cancelled/todo: 18 new ingress + 22 existing P3 |
| `$B test tests/actor-ingress.test.js tests/coordinated-storage.test.js` | 0 | **40 pass**, 0 fail |
| `$B test` | 0 | **315 pass**, 0 fail, 23 files; all prior 297 plus 18 new |
| `$N --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | Original **82 pass**, 0 fail/skipped/cancelled/todo |
| `$B test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js` | 0 | Original **82 pass**, 0 fail |
| `$N --test docs/internal/046-state-probes.mjs` | 0 | Original safety **21 pass**, 0 fail |
| `$B test ./docs/internal/046-state-probes.mjs` | 0 | Original safety **21 pass**, 0 fail |
| `$N src/verify-runtime.js`; `$B src/verify-runtime.js` | 0 each | **ALL RUNTIME VALIDATIONS PASSED!** |
| `git diff --check` | 2 | Only protected pre-existing whitespace: `049-final-report.md:7,99`, `release-notes-and-limitations.md:4` |
| Entry/final Python SHA-256 inventory and scoped whitespace/field checks | 0 | Only the five named source extensions and eight new files; no prior tests/reports/legacy source/manifests deleted or changed |

An initial concurrent full/shared Bun run correctly timed out the multi-pair IPC test at Bun's default 5 seconds and terminated workers. The test now declares a 60-second Node/Bun timeout; assertions were not removed or weakened. Final reruns above complete and clean up all actor children. The full legacy suite imports bun:test, so a full-suite Node claim is not made; all requested shared/new/safety/verifier Node commands were actually run. Overlapping totals are not summed as unique coverage.

## Observed results

The 18 new shared tests exercise exact contracts/accessor rejection; unknown authority/admin JSON fields; real singleton-row zero-write denials; full-batch authorization; duplicate/mismatched/foreign receipt identity; current reauthorization after revocation; filtered nonempty task/context views; narrow coordination-only recipient views; missing/ambiguous/wrong-scope policy; recipient-only handoff, stale revision, resolution, deny/revoke/expiry/policy/action failures; pending approval pause/reservation, human/self/service/foreign response denial, exact approval/rejection and multi-human partial resume; tightened deadlines; final-clock attestation/handoff expiry; observer/standby behavior and stale-owner receipt fencing; pure combined replay tampering; pre-COMMIT rollback and actual post-COMMIT acknowledgement loss followed by fresh next-owner receipt recovery; framing and reentrancy.

The IPC proof starts **two concurrently alive meaningful actor contributors plus a separate freshly attested human child**, using Node→Node, Node→Bun, Bun→Node and Bun→Bun executable pairs. The child-visible API is exactly `sendCommand`/`close`; no database/owner arguments are passed. Each child reports its PID and assertions match it to the actual spawned PID. Both actors race meaningful submissions at the same expected revision; exactly one commits and the other returns stale without an extra receipt/revision, then explicitly replans with a new operation ID. Both contribute work; A proposes, B discovers and accepts the handoff; A requests approval, B cannot self-elevate, the separate human channel approves; actor outcomes show committed coordination facts without foreign task results. Auth is revoked/re-enrolled out of band and original duplicates remain exact. Every pair finishes at revision 9 with six committed command receipts and complete matching combined replay. These are actor collaboration/authorization proofs, not two execution owners or downstream effect proofs.

## Invariants demonstrated

- **ACT P4 subset:** exact host-derived identity, dedicated channel routing, fresh host attestation on every read/write/retry, actor-authored authority rejected, current exact scope/grant/policy evaluation, no actor SDK/store/credential/dispatcher surface. Human enrollment is explicitly a host test attestation, not schema-based login.
- **STA/EFF command subset:** revision-exclusive atomic command/domain/receipt/history installation, original-response idempotency, mismatch rejection, zero-write stale/forbidden/expiry denials and no automatic retry. Actual committed-before-ack recovery returns the old receipt after a new owner acquisition without replaying the mutation.
- **Durable handoff/approval:** authenticated target-only revisions and both-party grant/policy checks; no ownership/grant transfer; exact queued pending reservation, anti-self human approval, separate-human batch approval continuity, durable rejection and current-filtered coordination observations.
- **REP P4 subset:** complete linked replay validates legal command and policy transitions at each domain revision, not merely a plausible final dictionary. It samples no clock and invokes no adapters.
- **OWN foundation retained:** current owner/lease is checked before command receipt or revision handling, stale handles cannot recover a mutation retry merely from disk receipt data, and observers do not acquire/recover. All 22 P3 storage tests remain unchanged and passing.
- **Compatibility:** all prior 297 tests, original shared 82 on both runtimes, original safety 21 on both and both runtime verifiers pass without changing legacy exact contracts/runtime behavior.

## Known limitations

This is **not P5**: `createCoordinatedChord`, coordinated owner/scheduler facade, runtime claim/outcome transitions, usable `checkDispatch`, final adapter invocation fencing, generation-bearing execution context, live adapter callbacks and downstream enforcement are absent/closed. The store still rejects `runtime_claim`, `runtime_outcome` and actual dispatch checks. No approval-response command invokes an adapter. The outcome read supports committed task results when present, but this pass's live IPC proof observes queued operation and committed coordination outcomes, not a newly executed coordinated external work result.

Raw store/host SDK/filesystem possession remains privileged and outside an actor JSON sandbox. Separate child processes under the same OS user are not hostile-host isolation. No real human login service, public/network transport, cryptographic authentication/replay attestation, secret vault, automatic resend daemon, database migration, compaction, downstream exactly-once effect or global backup/clone fencing exists. Host channel enrollment/revocation and non-reassignment of stable binding subjects are deployment obligations. The shared single-host trusted-clock/SQLite/filesystem assumptions and bounded whole-envelope capacity remain unchanged; exact replay is synchronous and bounded but expensive. Error classification for responses whose old policy relation has been removed can deny at current-policy selection before reporting a retained relation's `POLICY_STALE`; neither case permits mutation.

Policy/counter MAX_SAFE_INTEGER remains a pure checked allocator boundary, not an accepted high-counter genesis fixture. P3's bounded dense history makes such durable states unreachable. Existing consumed/completed effect continuity and live callback/runtime semantics remain P5/later proof obligations, not claims derived from these command-only tests. Publication/legal/identity gates from 050/051 remain unchanged.

## Blockers

**None to Pass 5 under the accepted bounded protocol. Live coordinated scheduling remains BLOCKED until P5 and the later proof/review gates.** The minimal host composition does not authenticate by schema, pass the full SDK to actors, run callbacks inside SQL or enable a placeholder runtime. No essential invariant was weakened to fit legacy helpers. Dedicated-channel authentication remains explicitly the embedding host's out-of-band responsibility.

## Next pass: READY or BLOCKED

**READY — Pass 5 dispatch integration only, under the parent's authorized sequence.**

P5 should use the private existing acknowledged credential in the ingress `commitCommand` closure, retain separate owner/admin/actor/observer ports, and compose the experimental factory without invoking legacy durable recovery first. Add complete runtime claim/outcome contracts, replay and per-attempt immutable DispatchRecord/credential capture together; implement authoritative `checkDispatch` and immediate captured callable entry; fence success and throw before any diagnostic/uncertainty write; preserve authority checks while allowing harmless renewal/unrelated actor commits to advance the global revision. Wire every supported canonical mutation to the fenced store or omit it from the facade. Do not expose legacy handoff/approval helpers or host admin callbacks through actor JSON.

Retain these actor tests unchanged while proving approval→actual coordinated dispatch/result, populated acquire/release quarantine, renewal and actor commands during pending effects, old success/throw after takeover/reconciliation/new attempt, no callable on failed claim/final check, and honest downstream fencing/idempotency races. P6–P9 retain independent/adversarial/docs/final gates. No P5 work, Block 053 or publishing was performed here.
