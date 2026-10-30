# Block 052 — Local ownership and authenticated actor-command protocol

## Pass

**Pass 2 only — protocol-design-agent. DESIGN COMPLETE; Pass 3 storage implementation: READY.** This is a normative implementation design for the authorized local Block 052 passes, not an implemented capability, a release-level promotion, or permission to enter Block 053 or publish. No Pass 3 implementation is included.

Repository `/home/d/Workspace/other-projects/chord`, branch `base`, HEAD `08728e48772db14a247add9143669a8e0eab01fa`, plus protected dirty 050/051 work and the Pass 1 report. Entry SHA-256 inventory: **532 files**, retained at `/home/d/.hermes/cache/scratch/chord-052-pass2/entry-hashes.json`. Scratch evidence is regenerable and may be pruned. Symbol references below are repository-relative search locators; abbreviated `src/` paths are relative to `packages/core`.

## Agent

**protocol-design-agent.** Read `052-ownership-audit.md` completely and traced its storage, owner, runtime, authentication, handoff, exact-contract and recovery findings into live code. Loaded repository-documentation-verification. Historical 050 proposals are inputs, not current implementation claims; the narrower 051 accepted contract and final review supersede their baseline descriptions.

## Files inspected

- `docs/internal/052-ownership-audit.md`, `050-final-report.md`, `051-final-report.md`, `051-storage-contract.md`, `051-authority-continuity.md`.
- Relevant product/release and proof obligations in `050-product-contract.md`, `050-developer-proof-spec.md`; transaction, recovery, lease, compatibility, idempotency and multiprocess portions of `050-durable-coordination-design.md`. In particular, its proposed expired-uncontested regrant, task-token allocation, staged acknowledgements and unversioned context-extension suggestions are **not** silently inherited here.
- Complete live `src/registry/owner.js`, `src/runtime/storage/sqlite.js`, `src/storage/contract.js`, `src/sdk/chord.js`, `src/runtime/recovery.js`, `src/platform/{runtime-loop,handoff,authorization,approval-flow,attempts,history,state-invariants,trace-reducer}.js`, `src/contracts/sigils.js`, `src/execution/task-packets.js`.
- Git entry inventory and full HEAD, plus actual Node/Bun SQLite/IPC probe output. Pass 1's complete mutation inventory is incorporated as a mandatory checklist, not a claim that new fences already exist.

## Files changed

Created only **`docs/internal/052-coordination-protocol.md`** in the repository. No source, tests, old reports, dependencies, manifests, lockfile, versions or examples changed. Scratch contains `runtime-probe.mjs`, `probe-results.json`, SQLite probe files, entry hashes and final preservation evidence. A general ownership-design verification lesson was recorded in the existing default-profile repository-documentation-verification skill outside the repository; it is not a product change. Nothing staged, committed, pushed, tagged, published, reset, cleaned, stashed or overwritten.

## Implementation decisions

### 1. One coherent bounded model

Use **one elected execution owner per local run/database incarnation**, plus any number of authenticated actor processes and read-only observers. Only that owner writes canonical state. Actors issue narrow data commands through host-bound channels; they neither contend for scheduling ownership nor directly open the database. A separate trusted standby process may contend for ownership, but receives no usable scheduler until acquisition and quarantine commit atomically. No multi-machine leader election, remote authentication service, consensus, untrusted-host isolation or exactly-once external effect is claimed.

Three deliberately different ports:

| Port | Holder and exposed operations | Never exposed |
|---|---|---|
| Execution-owner port | Trusted scheduler closure: acquire, renew, release, runCycle, fenced transaction, finalDispatchCheck, close. Credential fixed to one acquisition. | Actor session or authority-grant minting power inferred from ownership. |
| Host-admin port | Trusted embedding application: install authority/policy, prepare/cancel/pause/resume/reconcile/readmit, restricted maintenance of domain state, create actor channels. All canonical writes in coordinated mode require current ownership. | Generic actor method dispatcher. |
| Actor-client port | A prebound authenticated endpoint exposing only §7 commands and filtered reads. Host derives the binding. | SDK, store, owner credential, database path, authority setter, grant callback, arbitrary function, router/policy setter, raw registry/export/history. |
| Observer port | Trusted read-only `inspect`, combined replay/export, close; host can provide filtered actor views through the actor port. | Ownership acquisition, startup recovery, writes, adapters. |

Raw store handles and existing exported memory/direct execution functions remain **privileged host plumbing**, not sandboxed actor APIs. Possession of SQLite/filesystem access or host code can bypass application rules; restricting an actor's JSON commands does not restrict arbitrary code running under the database owner's OS account. The proof must state this threat boundary.

### 2. Compatibility and identities: explicit opt-in v2, no migration

Keep the existing `createChord()`, 051 `createChord({storage:...})`, `openSqliteStore`, `RegistryData`, `Attempt`, `TaskPacket`, `Outcome`, HandoffRecord, `chord.contracts.v1`, `chord.history.v1` and snapshot `0.3.0` unchanged in shape and existing semantics. These remain memory/single-active-runtime legacy modes; they acquire **no new cross-process claims**. Existing exact-schema tests must continue rejecting additional packet/result fields.

Add a distinct experimental host factory **`createCoordinatedChord(options)`** and low-level **`openCoordinatedSqliteStore(options)`**. They accept **only** a new layout/version `chord.local-store.v2`, protocol `chord.coordination.v1`. No v1 auto-upgrade, additional v1 table, hidden optional ownership field, memory fallback, import-as-recovery, or v2-through-legacy-open. Both directions fail closed; classify a recognized incompatible version as `UNSUPPORTED_STORAGE_VERSION` before ordinary payload validation where possible. A legacy binary may instead reject the unknown layout as `STORAGE_CORRUPT`; that is rejection, not interoperability. Do not rewrite 051's measured expectations.

V2 creation initializes a **new, empty run** with complete v1 genesis and coordination genesis; it does not accept an old arbitrary registry/snapshot. Existing mode requires host-supplied expected identity. No migration tool is part of 052. A separately authorized future migration must quiesce v1, preserve uncertainty/evidence and issue a new incarnation; it cannot pretend old tokens continue.

Identity is the exact tuple `(run_id, incarnation_id)`. `incarnation_id` is an OS-random UUID generated once at explicit v2 initialization, persisted and returned for host provisioning. Existing opens must supply both values; neither a path nor a request's identity authenticates a caller. `owner_id` is a fresh host-generated process-launch UUID, diagnostic and nonsecret, never a principal or bearer secret. Even deliberate reuse of owner_id cannot reuse an ownership generation.

Host obligations: one local regular file, trusted parent directory, no live rename/replacement, writable aliases used only for the same database, no concurrent clone/restore. Copying a live database or restoring an old backup can roll back generations. Stop all old processes and retire downstream namespaces before a restore; a restored/branched run needs a **new incarnation through a future explicit administrative procedure**, not an edited UUID column. No global monotonicity across arbitrary backups/clones is claimed. Pin identity outside the database in trusted launch configuration.

### 3. Authoritative v2 schema and complete evidence

One singleton row still gives atomic state/history/ownership/receipts. Use this exact new layout (SQL normalization may ignore whitespace, not semantic differences):

```sql
CREATE TABLE chord_coordination (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  storage_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  run_id TEXT NOT NULL,
  incarnation_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 0),
  logical_now INTEGER NOT NULL CHECK(logical_now >= 0),
  generation INTEGER NOT NULL CHECK(generation >= 0),
  owner_id TEXT,
  lease_expires_at INTEGER,
  commit_id TEXT NOT NULL,
  envelope_json TEXT NOT NULL
);
```

Exactly one table, no triggers/views/extra indexes or additional rows. Use lazy common `node:sqlite`, `BEGIN IMMEDIATE`, WAL/FULL/1000 ms and the same commit-unknown/rollback-retirement discipline as 051. Header columns duplicate **validated fields of the same row's envelope**, not separately writable truth. Validate every correspondence at load and before update.

The envelope's exact top-level shape:

```js
{
  registry: RegistryData,                 // unchanged complete v1 registry+journal
  coordination: CoordinationState,
  coordination_history: CoordinationHistoryRecord[]
}
CoordinationState = {
  protocol_version: 'chord.coordination.v1',
  run_id: Id, incarnation_id: UUID,
  logical_now: UInt,
  lease: LeaseRecord,
  policy: CoordinationPolicy,
  attempts: { [attempt_id]: DispatchRecord },
  commands: { [receipt_key]: CommandReceipt },
  handoffs: { [handoff_id]: HandoffAuthorization },
  approval_requests: { [approval_request_id]: ApprovalRequest }
}
LeaseRecord = {
  generation: UInt,
  owner_id: UUID | null,
  acquired_at: UInt | null,
  renewed_at: UInt | null,
  expires_at: UInt | null
}
```

`UInt` means nonnegative JS safe integer, **not** an arbitrary SQLite signed-64-bit value; validate before numeric conversion/acceptance. IDs obey existing bounded data-only ID rules; UUIDs are canonical UUID strings generated by trusted host OS randomness. All named shapes in this report are exact: unknown keys, accessors, executable/nonplain/prototype-bearing inputs, invalid enum values and excess budgets reject. Use SigilJS for the new shapes with explicit semantic checks, rather than bypassing the v1 validator. Do not add fields to old exact records. Use safe own-property access for dictionaries. `receipt_key` is an internally canonical JSON tuple string, not a user-authored object key.

At genesis generation is 0 and all four nullable lease fields are null. A held lease has generation >=1 and all fields present with `acquired_at <= renewed_at < expires_at`. Release retains the generation and makes the four nullable fields null. All subsequent acquisitions increment the previous generation, including the same owner_id. Renew/release never decrement/reset generation. Reject `GENERATION_EXHAUSTED` before increment at MAX_SAFE_INTEGER; revision/policy counter exhaustion rejects `REVISION_EXHAUSTED`. Overflow checks occur **before** addition and before any claim can release an invocation. Never wrap, stringify an overflowing number, reset, or borrow timestamps as generations.

#### Linked replay without modifying old contracts

Every v2 transaction increments `registry.run.revision` **once**, appends one ordinary v1 closing `state_committed` (possibly only a run-revision change), and appends exactly one linked coordination history record. Owner lifecycle diagnostics live in coordination history, **not** unrecognized v1 journal event types. Existing domain helpers emit only the existing supported v1 diagnostics. No non-revision-bumping ownership, policy, receipt or evidence writes.

```js
// Genesis; revision is zero, domain_commit_id identifies v1 state_initialized.
{ kind:'genesis', protocol_version:'chord.coordination.v1',
  ordinal:0, revision:0, domain_commit_id:Id, state:CoordinationState }
// Every following record, ordinal == revision for new v2 runs:
{ kind:'commit', protocol_version:'chord.coordination.v1',
  ordinal:UInt, revision:UInt, previous_domain_commit_id:Id,
  domain_commit_id:Id, operation:OperationTag, at:UInt,
  changes:StateChange[], evidence:CoordinationEvidence }
```

`StateChange` has the existing before/after delta shape, applied only to CoordinationState with exact before preconditions. `OperationTag` is `acquire | renew | release | actor_command | runtime_claim | runtime_outcome` or an `AdminOperation` from §5. The v1 closing commit operation equals the coordination record operation; admin operations use their named domain operation (not a generic `admin` label), preserving existing cancel/reconcile transition checks. `CoordinationEvidence` has these exact variants:

```js
{kind:'lease', action:'acquire'|'renew'|'release',
 before:LeaseRecord, after:LeaseRecord, quarantined_attempt_ids:Id[]}
| {kind:'command', receipt_key:IdString, subject:BindingSubject,
 command_type:CommandType, authority_revision:UInt, policy_revision:UInt,
 rule_id:Id|null, grant_ids:Id[]}
| {kind:'claim', attempt_id:Id|null, generation:UInt}
| {kind:'outcome', attempt_id:Id, generation:UInt,
 classification:'result'|'uncertain'}
| {kind:'admin', operation:AdminOperation, audit_label:Id}
```

The evidence kind/action must match operation and changed state; command evidence exists only for an accepted write, never a filtered read. `grant_ids` is the sorted unique union of the exact grants checked for all command parties/batch members; `rule_id` is null for submit_work. `policy_revision` records the current policy even for submit_work. `audit_label` is host-supplied audit context, **not** a new authentication credential; admin capability is possession of the private host port. No secrets or raw session objects. The full state changes already contain persisted request/response/attempt facts; evidence references those IDs rather than introducing an independently installable copy.

Implement pure `reduceCoordinationTrace(envelope)` that reduces v1 domain trace, reduces the coordination sequence in ordinal order, checks one-to-one domain commit linkage, identity, revisions, exact operation pairing, legal ownership/command/attempt transitions, and combined cross-invariants **at each corresponding domain revision**, then equals the stored projections. A forged coordination delta with a plausible final lease is insufficient. Genesis and every commit must have consistent logical floor, monotone generation, valid receipts and dispatch/task linkage. No missing/tied-order sorting, truncation, detached receipt replacement or partial-tail acceptance. `reduceTrace(registry.event_journal)` remains a domain-only replay and must not be advertised as ownership reconstruction. Combined replay invokes zero adapters and reads no clock.

Keep the current data budgets; validate the **whole encoded v2 envelope** against the existing 1 MiB/16384-node/depth/string/array/key budgets in addition to inner contracts. This deliberately reduces usable run capacity. Dictionaries hit the current 256-key bound; histories hit 1024 array entries, often earlier due to bytes/nodes. Reject `LIMIT_EXCEEDED`, never prune receipts or ownership history. Renewals consume budget. Hosts must size/stop runs, not compact or truncate under this design.

### 4. Clock authority and lease validity

A generation is clock-independent **ordering**, not a clock-independent lease. Ownership validity is `stored.owner_id == captured.owner_id && stored.generation == captured.generation && now < stored.expires_at`, with matching run/incarnation and an open, nonlost local credential. The interval is exclusive at expiry. There is no grace, PID/death inference, or expired-but-uncontested result/renewal acceptance.

For v2 choose a **trusted shared local wall-millisecond clock**, normally Date.now on the one OS host. Store construction accepts a trusted narrow `clock.now()` for deterministic tests or a host-provisioned authority; actor messages cannot supply it. Each authoritative transaction samples it **after acquiring BEGIN IMMEDIATE and loading current state**, not before the busy wait; validate a safe nonnegative integer >= persisted logical floor and >= that handle's last observation. Sample again before UPDATE/COMMIT authorization; reject/roll back if time-sensitive preconditions ceased to hold. Clock reads are the one explicit trusted shell effect inside the transaction; they must be synchronous, nonreentrant, nonmutating and not arbitrary grant/domain callbacks. Guard reentrancy before calling them. All domain transitions/permission decisions there are pure.

Persist the last checked sample as `coordination.logical_now` and matching row `logical_now`. The lease granted/renewed deadline is derived from the first transaction sample plus **fixed OWNER_LEASE_MS = 30_000**, with checked addition; the final sample must still be before the proposed deadline. Tied samples are legal. **Backward time below the floor or last local sample fails `CLOCK_ROLLBACK` without writes**; do not silently clamp/extend a v2 lease. The different existing 051 floor/clamping behavior stays in legacy mode. A clock that stops advancing can prevent takeover indefinitely; a forward jump can prematurely expire an owner and quarantine live work. Both are availability/external-effect hazards, not proof of nonexecution. Local monotonic time may schedule renewal reminders but is not persisted or compared across processes; it cannot grant authority on restart.

This is a trusted-clock deployment restriction: no hostile clock control, no independently skewed machine clocks, no claim that local checks detect all suspend/jump/skew faults or malicious future timestamps. The host must halt/reset the deployment after clock faults and must never use a slow private clock to prolong an old lease. Final dispatch and mutation checks resample. SQLite's lock serializes ownership decisions; it does not serialize an external service. A clock rollback detected by an owner is sticky local loss; restoring the clock cannot resurrect that handle.

### 5. Exact host/store interfaces and lifecycle

Proposed JS ESM/JSDoc interface; these are new APIs, not claims about current exports:

```js
openCoordinatedSqliteStore({ path, mode:'create'|'existing',
  expectedIdentity: null | {run_id, incarnation_id}, clock })
// create requires null expectedIdentity; existing requires exact identity.
store.init() // create only: builds pristine run+incarnation+both genesis records
// -> {ok:true, identity:{run_id,incarnation_id}, revision:0, commitId}
store.load() // -> {identity, revision, commitId, envelope} detached and validated
store.commit({ expectedRevision, credential:null|OwnerCredential, change })
// -> {ok:true, revision, commitId, result}
// failures throw sanitized CoordinationError; no arbitrary callback argument
store.checkDispatch({credential, dispatch}) // read-only fresh check; §9
store.readHistory({afterOrdinal:null, limit:1024}) // combined linked committed records
store.close() // idempotent; no implicit release/commit

OwnerCredential = {run_id, incarnation_id, owner_id, generation}
change =
  {kind:'acquire', owner_id:UUID}
| {kind:'renew'}
| {kind:'release'}
| {kind:'actor_command', binding:TrustedBinding, command:ActorCommand}
| {kind:'admin', operation:AdminOperation, nextRegistry:RegistryData,
   nextPolicy:CoordinationPolicy|null, audit_label:Id}
| {kind:'runtime_claim', nextRegistry:RegistryData,
   dispatch:DispatchRecord|null}
| {kind:'runtime_outcome', dispatch:DispatchRecord,
   adapter_result:AdapterResult|null, error_code:Id|null}
```

Store lifecycle success results are exact: acquire `result:{credential:OwnerCredential,lease:LeaseRecord}`, renew/release `result:{lease:LeaseRecord}`, admin `result:{operation:AdminOperation}`, claim `result:{dispatch:DispatchRecord|null}`, outcome `result:{task_id:Id,attempt_id:Id,classification:'result'|'uncertain'}`. The private host owner wrapper captures acquire's credential and may return only lease metadata; it never hands that credential to an actor. Actor-command result is its exact SuccessResponse; duplicate processing returns that original response without a new commit. `checkDispatch` returns `{ok:true,revision:UInt,commitId:Id}` or throws a sanitized zero-write error. `readHistory` returns `{identity,revision,commitId,entries:[{ordinal,domain_events:JournalRecord[],coordination_record:CoordinationHistoryRecord}],hasMore:boolean}` from one validated row snapshot; ordinal 0 pairs genesis, later ordinals pair all domain diagnostics plus their closing commit with the corresponding coordination record. Validate afterOrdinal as UInt and limit 1..1024; **afterOrdinal is exclusive**, with null accepted explicitly to include genesis (default null, not 0). Dense ordinals and array order, not timestamps, determine pagination.

`clock` is a trusted executable constructor dependency, not serialized data. All other requests are descriptor-checked, detached data. `expectedRevision` is required UInt; acquire has null credential, all other writes require the captured credential. `AdapterResult` is the existing narrow result shape; outcome requires exactly one of adapter_result/error_code. Store-side pure reducers construct domain+coordination candidates for lifecycle, commands and outcomes. Runtime/admin candidates are built once outside SQL under the local busy guard, **then** checked/re-authorized in SQL against loaded state/time. No arbitrary apply callback or adapter executes in SQL, and no callback is automatically replayed. Shell mints UUID event/record IDs before the transaction; uniqueness is verified against complete history and dictionaries. Failed candidates/unknown claims release no prepared callable.

`AdminOperation` allowlist: `register_spec`, `admit_spec`, `admit_tasks`, `authority_snapshot`, `prepare_attempt`, `cancel_task`, `propose_handoff`, `respond_handoff`, `pause_run`, `resume_run`, `reject_approval`, `cancel_run`, `reconcile_effect`, `readmit_task`, `invalidate_attempt`, `host_commit`, `coordination_policy`. Host paths retain their explicit privileged meaning; expose only operations actually implemented, not a string-to-SDK dispatcher. Generic `host_commit` may replace legal domain state under its existing maintenance powers, but may not write lease, receipts, coordination history, attempt fence identity or handoff authorization directly. Storage validates the coordination delta induced by domain changes (e.g. closing/cancelling an attempt closes its DispatchRecord). Ordinary coordinated handoffs use §8. Legacy low-level unfenced handoff helpers must not be accidentally republished as actor commands.

All successful writes use this transaction order:

1. Enter local nonreentrant guard, detach/validate input, mint needed nonsecret IDs, prepare pure candidate/captured callable where applicable.
2. BEGIN IMMEDIATE; read/fully validate authoritative row/envelope and exact expected identity. Sample clock as §4.
3. For **every non-acquire write**, compare the supplied credential to stored owner/generation and check unexpired lease **before revision, command processing or any diagnostic mutation**. An owner cannot use a refreshed read to replace its credential. Acquire instead checks vacancy/expiry and safe generation allocation.
4. Compare expectedRevision to the transaction-loaded revision. No implicit expected-revision refresh, automatic callback retry, or automatic redispatch. For actor commands apply the receipt ordering exception in §7 before rejecting the command's old expected revision, but still require valid owner and fresh host authentication.
5. Run the operation's pure transition/authorization rules against loaded data and authoritative time. Validate candidate, safe +1 revision, immutable domain journal prefix, one closing domain commit, complete linked coordination history, all cross-invariants and budgets. Recheck time-sensitive guards using final clock sample; include that logical floor in the closing coordination delta.
6. UPDATE with **independent SQL predicates**: singleton, run_id, incarnation_id, revision, generation, owner_id using null-safe `IS`, and lease_expires_at using `IS` against the transaction-loaded values. Require exactly one changed row. These predicates supplement, not replace, semantic checks. No independently acknowledged side write exists.
7. COMMIT then acknowledge. Preserve 051's unknown classification for attempted-COMMIT exceptions and **any failed rollback**, including stale/denial rollback. Retire handle on unknown/corrupt/unavailable authoritative state; never compensate with an uncertainty write.

Lifecycle semantics:

| Operation | Preconditions and atomic result |
|---|---|
| Open observer/actor gateway | Validate only. Never acquire, quarantine or load adapters. An actor-client is a host channel, not a database handle. |
| Acquire | Null credential, exact expected revision; lease vacant or `now >= expires_at`; allocate generation +1. In the **same commit**, quarantine all old `running`/`leased` domain tasks, clear their active/pending reservations and queue expiry through the existing helper, retain consumed approvals/completed facts, set operation unknown, and close old DispatchRecords as quarantined. Install new lease. Return credential only after acknowledgement. No recovery-before-ownership gap. |
| Concurrent acquire | One committed generation/revision wins. Loser reports `OWNER_HELD` if the transaction sees a valid lease (ownership precedence), otherwise `STALE_REVISION`. Both are zero-write denials; no losing invocation. |
| Renew | Exact captured credential, unexpired lease, exact expected revision. Set `renewed_at=now`, `expires_at=now+30_000`; require strictly later expiry, else `LEASE_NOT_EXTENDED`. Same generation, ordinary linked commit. Explicit host renewal, no concealed timer. |
| Loss | Owner mismatch/expiry, clock fault, close, unknown acknowledgement or unavailable/corrupt storage makes this owner closure permanently lost for mutation/dispatch. A stale revision **alone** does not refresh or lose its generation, but requires explicit replanning. Read-only inspection may use a separate observer; no fallback cache. |
| Release | Exact current credential, unexpired lease, expected revision. Quarantine any still-dispatched work in the **same release commit** before vacating lease; no cancellation inference or next-owner continuation of active calls. Retain generation. Local handle immediately lost after acknowledgement, or on unknown acknowledgement. |
| Takeover | Exactly acquire after expiry/vacancy, not renew by the old owner. Old effect may still run; quarantine is mandatory even if the task's own lease is unexpired. Only the run-owner lease determines eligibility. No force-takeover admin shortcut in 052. |
| Crash around acquire | Before COMMIT: no partial new owner/recovery. After COMMIT before ack: new generation+quarantine may exist, but no callable was released; original handle retires. New construction cannot adopt an observed credential and must wait for expiry/release and acquire another generation. |
| Reopen/current owner | Read never adopts a credential from disk. New host construction is observer/standby until explicit acquire; even same owner_id does not resume a lease. An uninterrupted old closure can renew only its captured generation. |
| Close | Does not release implicitly and cannot assert external effects stopped. Hosts can explicitly release first; otherwise lease expires. |

No standalone `recoverOwner` call in new constructor. Acquisition's atomic quarantine **is** coordinated restart recovery. Router construction/owner service exposure occurs after acknowledged acquisition; actor/observer open while a valid peer runs changes nothing. There is no transfer-to-peer shortcut: graceful execution-owner transfer is **release then fresh acquire**, with a possible vacant interval and no promised successor. Actor handoff (§8) is a separate concept.

### 6. Factory composition and mutation coverage

```js
createCoordinatedChord({ storage:{path,mode,expectedIdentity}, trustedHost:{clock},
                         owner_id, adapterRouter, runtimePolicy })
// returns trusted {observer, owner, admin, createActorIngress}; starts unacquired
owner.acquire({expectedRevision})
owner.renew({expectedRevision})
owner.release({expectedRevision})
owner.runCycle()
owner.close()
// admin mutation wrappers require expectedRevision in coordinated mode
// observer.inspect()/exportEnvelope()/replayEnvelope()/close() never recover
createActorIngress({ authenticate, bindingPolicy })
// returns host-only handleAuthenticated(channelContext, commandJSON)
```

New factory may internally share pure SDK helpers, but must not instantiate the legacy durable constructor and then acquire: that would already have executed unsafe recovery. Keep all credentials private to the owner closure and capture them per attempt. The admin closure uses that same captured acquisition, not the newest disk owner. An unacquired/lost object cannot obtain admin writes by calling `getRegistry`.

Pass 1's complete mutation checklist is mandatory: registerSpec/registerSpecAndQueue/queueTaskPackets, authority initialization/setter/grant installation, prepareAttempt, cancelTask, both handoff helpers, pause/resume/rejectApproval/cancelRun, reconcileTask/readmit, pending invalidation, commitRun/install, runtime claim/no-adapter retry/denial/deferred/skipped diagnostics, runtime success/error/commit-denied uncertainty, recovery and all policy/receipt updates. Each must reach v2 fenced store.commit or be absent from the coordinated facade. No error-handling `appendRegistryEvent`, ignored outcome, read-triggered recovery or legacy owner.install fallback may bypass it. Owner permission does not itself authorize task execution, human approval or grant minting.

### 7. Trusted cross-process ingress and exact command protocol

#### Authentication route selected for 052

Implement transport-neutral `handleAuthenticated(channelContext, commandJSON)`. The concrete local proof transport is **host-spawned, dedicated inherited JSON IPC channels**, one actor session per channel, using `node:child_process#fork`/IPC. The trusted host chooses executable/launch configuration and binds the exact child/channel object to a private session entry **before** receiving any actor message. Actor requests cannot register their own channel identity, select a binding or authenticate by supplying a PID/name. Do not use a public mailbox file whose claimed sender is trusted. Channel identity and trusted host enrollment are the authentication mechanism in this local model; no shared secret in the database, command, argv or task context is needed.

`authenticate(channelContext)` is a trusted host callback using the private session map; absence, disconnected/expired/revoked session, stale host generation, or unrecognized channel returns `HOST_UNAUTHENTICATED`. Resolve every command afresh, including duplicates and reads. Authentication is distinct from command validation and canonical authorization. It returns the following **host-constructed** immutable object, never accepted from actor JSON:

```js
TrustedBinding = {
  binding_id:Id, issuer:Id, principal_id:Id, actor_id:Id,
  run_id:Id, incarnation_id:UUID,
  authenticated_at:UInt, expires_at:UInt,
  work_capability:Id, work_requires_approval:boolean
}
```

Use `(issuer,binding_id,principal_id,actor_id,run_id,incarnation_id)` as stable authorization identity, not a session secret. Host provisioning must not reassign a binding_id to a different subject. Session material/channel objects stay only in host memory. The storage-bound copy above is declarative attestation, not a future login credential. Both ingress and transaction verify binding window and persisted principal issuer/window, actor-to-principal binding, current revocation/capability/grants. After host restart the private map is empty; child channels/sessions require fresh enrollment. Reusing the stable subject/binding permits receipt lookup only **after** fresh authentication. A persisted principal, receipt or old IPC message is not login.

The actor receives a facade with only `sendCommand`/read operations; the host has no generic `sdk[method](payload)` route. IPC framing must enforce byte limits before JSON parsing, reject multiple/malformed frames and ignore transport metadata inside payload; one child cannot obtain another child's endpoint. Explicit trusted enrollment is the local authentication root, not OS-user sandboxing or proof of a remote human's identity. For a real human UI the embedding host must authenticate that human before enrolling the human-bound channel; the test fixture may explicitly attest that action and must label it.

#### Exact envelope and allowlist

```js
ActorCommand = {
  protocol_version:'chord.actor-command.v1',
  operation_id:Id, run_id:Id, incarnation_id:UUID,
  expected_revision:UInt|null,
  correlation_id:Id|null, causation_id:Id|null,
  type:CommandType, payload:CommandPayload
}
```

All keys required, including explicit nulls. Identity must match channel binding and open run; it is not authority. Writes require an integer expected_revision; reads allow null (latest validated snapshot) or require exact revision when supplied. `operation_id` is a **command idempotency ID**, distinct from `OperationRecord.operation_id` for external work. Clients retain and reuse the same complete envelope when an acknowledgement is lost. Changing expected_revision/correlation/causation/payload under that ID is a mismatch, not a retry. There are no command-authored owner_id/generation/principal_id/actor_id/grants/capability/approval token/host time/route/path/options keys. Unknown keys reject, not ignore.

| type | Exact payload | Permission and result |
|---|---|---|
| `submit_work` | `{packets:TaskPacket[]}` nonempty bounded batch | Use binding's fixed work_capability and work_requires_approval to build authority bindings; exact stored grants must already authorize every packet. No issueGrants callback or actor-selected grant/capability. Validate full batch before registering any member. Return `{task_ids:Id[]}`. Existing operation-signature duplicate/unknown quarantine remains mandatory. |
| `project_context` | `{}` | Filter using current authenticated subject and current authority, never raw registry. Return `{context:ContextProjection,handoffs:VisibleHandoff[],approval_requests:VisibleApprovalRequest[]}` inside the new response envelope; the inner v1 projection stays unchanged, and host time replaces all external time. |
| `propose_handoff` | `{task_id:Id,to_actor_id:Id,payload:object,expires_at:UInt}` | §8 exact scope/policy. Sender is binding actor; recipient is requested data constrained by policy, not a newly trusted identity. Return `{handoff_id:Id}`. |
| `respond_handoff` | `{handoff_id:Id,action:'accept'|'reject',reason:string|null}` | §8, only authenticated target/current policy. Return `{handoff_id,status:'accepted'|'rejected'}`. |
| `request_approval` | `{task_id:Id,reason:string,expires_at:UInt}` | Own task subject, current exact `chord.approval.request` capability/grant; prepare/reuse queued pending attempt and durably pause as below. Return `{approval_request_id,attempt_id}`. |
| `respond_approval` | `{approval_request_id:Id,decision:'approve'|'reject',reason:string|null}` | Fresh authenticated human, distinct requesting principal; exact current `chord.approval.respond` capability/grant and host policy. Kernel builds actual exact Approval; caller cannot supply Approval or choose approver identity. Return `{approval_request_id,status:'approved'|'rejected',approval_id:Id|null,run_state:Id}`. |
| `observe_outcomes` | `{task_ids:Id[]}` max 100 | Filter IDs by current task-scope visibility; unauthorized/nonexistent IDs omitted identically. Return `{outcomes:object[]}` containing only visible task_id/status, last committed result if visible, operation state, and visible handoff/approval-request statuses; no raw history, other subjects' records or credentials. |

Coordination read views are deliberately separate from the old task projection:

```js
VisibleHandoff = {handoff_id:Id, task_id:Id, from_actor_id:Id,
 to_actor_id:Id, status:'proposed'|'accepted'|'rejected', payload:object,
 expires_at:UInt}
VisibleApprovalRequest = {approval_request_id:Id, task_id:Id,
 attempt_id:Id, requesting_actor_id:Id,
 status:'pending'|'approved'|'rejected', reason:string, expires_at:UInt}
```

Return at most 100 of each in stable creation/history order. A handoff is visible only to its sender with current `chord.handoff.propose` scope permission or its exact recipient with current `chord.handoff.respond` scope permission, plus the applicable current policy relation; an approval request only to its requester with `chord.approval.request` permission or policy-selected human approver with `chord.approval.respond` permission. Recheck principal/actor validity and deny rules. This lets recipient B discover its handoff/request without granting B execution permission or leaking the full original task/spec; do not require the legacy execute-capability projection to make coordination records visible. Expired/resolved records may be visible history if these current visibility checks pass, but are not actionable. `observe_outcomes` uses the same rule for coordination statuses and legacy task-scope visibility for task results; neither kind of visibility implies the other. Unknown IDs and unauthorized IDs are indistinguishable omissions.

Read operations do not write receipts, logical floors, denial diagnostics or history and need no execution owner. They use a single validated snapshot and fresh authenticated binding/time; stale/expired auth denies without writes. A read receipt is not durable: repeat reads may return newer authorized data. Reads exposing outcomes of older commands must still filter under **current** authority. Actor writes are handled by the current owner service; an ingress attached to a standby/lost process returns `NOT_OWNER`, not a forwarded implicit acquisition or an unfenced local SDK call.

A committed write response has exact shape:

```js
{ protocol_version:'chord.actor-response.v1', operation_id:Id,
  correlation_id:Id|null, causation_id:Id|null,
  run_id:Id, incarnation_id:UUID,
  ok:true, revision:UInt, commit_id:Id,
  owner:{owner_id:UUID,generation:UInt,lease_expires_at:UInt},
  result:object }
// A read uses the same shape with the observed commit/owner summary;
// owner is null when vacant. It does not claim a new commit.
// Rejections:
{ protocol_version:'chord.actor-response.v1', operation_id:Id|null,
  correlation_id:Id|null, causation_id:Id|null,
  ok:false, code:CoordinationCode,
  commit_status:'not_committed'|'unknown' }
```

Do not return host paths, input diagnostics, database handles or another binding's receipt on errors. A duplicate returns the **exact originally committed success response**, including old revision/owner/lease metadata, not a fresh success at the current revision; document it as historical receipt, not present ownership proof. Filter/reject receipt access if the current subject no longer has scope visibility (`FORBIDDEN`). The persisted receipt remains unchanged.

#### Idempotency ordering and committed responses

`CommandReceipt = {receipt_key:IdString,binding_subject:BindingSubject,command:ActorCommand,response:SuccessResponse}`; `BindingSubject` is the six-field stable authorization identity above. `receipt_key = canonicalJSON([issuer,binding_id,principal_id,actor_id,run_id,incarnation_id,operation_id])`. Its key string has a separately specified bounded maximum **2048 characters** in the new contract; it is not forced through the v1 256-character Id validator. Child ID strings still keep v1 limits. No hash algorithm or delimiter ambiguity: canonical object keys sorted, arrays ordered, numbers safe, strings exact; store complete normalized command for equality/mismatch checks. No transport credential is included.

For actor writes: authenticate and validate envelope/identity first; validate current owner; check existing receipt for this exact subject+operation **before** the command's expected revision check. Same normalized envelope: after current visibility authorization, return stored response read-only (no revision, receipt or lease change). Different envelope: `OPERATION_ID_MISMATCH`, zero writes. A foreign binding never sees another binding's receipt; different subjects may use the same client operation_id without collision. No receipt: require expected revision then current permissions and execute transition, append receipt with preallocated domain commit ID and success response in the **same singleton transaction**. A current owner may check a duplicate despite intervening revisions; an old owner may not write or process a mutation retry just because a receipt exists.

Only accepted writes get receipts; denial/stale/unauthenticated/validation responses are not persisted and cause no canonical diagnostic mutation. Clients may explicitly read/re-plan after a known denial and use a **new** operation ID/envelope; they must not silently retry an unknown accepted request under a new ID. On ack loss, retire the writing owner; a fresh authenticated request to the next valid owner can recover the old receipt. If no receipt exists in an authoritative full history, that command did not commit locally; external dispatch truth remains separate. A durable command queue/automatic resend daemon is not introduced.

### 8. Durable authorized handoff and approval policy

Store the coordination policy under fenced admin installation with required expected run revision and exact-next policy revision. Genesis policy revision 0 has empty rule arrays; initial installation is revision 1. No implicit permissive default, role-derived rule, arbitrary policy callback persisted in the database, or wildcard grant.

```js
CoordinationPolicy = {
  policy_revision:UInt,
  handoffs:HandoffRule[], approvals:ApprovalRule[]
}
HandoffRule = {rule_id:Id, from_actor_id:Id, to_actor_id:Id,
  scope:Scope, actions:('accept'|'reject')[], max_ttl_ms:UInt}
ApprovalRule = {rule_id:Id, requesting_actor_id:Id, approver_actor_id:Id,
  scope:Scope, max_ttl_ms:UInt}
HandoffAuthorization = {
  handoff_id:Id, scope:Scope, task_revision:UInt,
  rule_id:Id, policy_revision:UInt,
  sender:BindingSubject, recipient_actor_id:Id,
  proposal_operation_id:Id, response_operation_id:Id|null,
  response_subject:BindingSubject|null,
  proposal_authority_revision:UInt, response_authority_revision:UInt|null
}
ApprovalRequest = {
  approval_request_id:Id, task_id:Id, task_revision:UInt, attempt_id:Id,
  requester:BindingSubject, rule_id:Id, policy_revision:UInt,
  created_at:UInt, expires_at:UInt, reason:string,
  status:'pending'|'approved'|'rejected', approval_id:Id|null,
  response_operation_id:Id|null, response_subject:BindingSubject|null
}
```

Unique rule IDs, distinct source/target as appropriate, exact scopes, TTL 1..30_000 ms, nonempty duplicate-free actions. Policy installation validates referenced actors/tasks/scopes against current authority/domain; ambiguous multiple matching rules reject `POLICY_CONFLICT`, rather than choosing by arrival order. `nextPolicy` is null on unrelated admin operations; nonnull only on `coordination_policy`. Policy changes invalidate pending handoff/approval responses with old policy_revision; no retroactive transfer or automatic cancellation/fact rewrite. Host must explicitly re-propose/request under current policy, fresh ID and current revision. Existing completed facts stay facts.

**Proposal:** derive sender from authenticated binding; locate exact current task and derive Scope from immutable stored run/project/phase/task/target/resource fields, never from proposal prose. Check sender and recipient current principal/actor validity, nonrevocation; exactly one policy rule for this ordered pair/exact scope; current exact grants for fixed capabilities **`chord.handoff.propose`** for sender and **`chord.handoff.respond`** for recipient, with active deny winning. Use a pure command authority evaluator with the same principal/actor/window/scope/grant semantics as task admission; do not fake execution approval consumption. Require `now < expires_at <= now+rule.max_ttl_ms` and live task scope. Store v1 HandoffRecord in registry and HandoffAuthorization sidecar atomically with receipt. Use explicit passed host time in the coordinated helper, not ambient Date.now. Store proposal authority revision for evidence, not permission on later response.

**Response:** mandatory expected revision; proposed status; same run/incarnation; current binding actor is exact stored recipient and its current principal; current task_revision/scope match sidecar; `now < handoff.expires_at` (exclusive); exact same policy_revision/rule remains installed and permits selected action. Re-evaluate **both** parties' current validity and fixed handoff grants; revocation/deny/expiry blocks. The responder's fresh channel authentication is mandatory; sender's live channel is not, but its stored policy identity must still be valid. Persist response subject, current authority revision, response operation, status/reason and receipt in one commit. Same operation duplicate follows receipt semantics; new response operation after resolution rejects `HANDOFF_RESOLVED`; changed payload under old ID rejects mismatch. Missing/foreign/unauthorized handoff all use `FORBIDDEN` at actor boundary to avoid enumeration.

Handoff is an artifact/context/decision exchange, **not** execution ownership transfer, a grant, task authority-binding replacement or an automatic new effect. Acceptance does not rewrite immutable task.authority_binding or dispatch anything. The target may separately submit work under its own exact host-installed grant. Host admin cannot manufacture an actor-authenticated response through a raw HandoffProposal JSON object. Trusted maintenance remains labeled host evidence.

**Approval request:** fixed `chord.approval.request` exact grant; task's requester principal+actor equal fresh binding, task queued, current scope, and exactly one current ApprovalRule. Validate expiry against TTL; prepare/reuse exact pending attempt. Atomically persist ApprovalRequest, reserve attempt, pause created/active run using existing pause transition, and receipt. If already paused, retain pause and tighten its finite deadline to the earliest pending request expiry rather than rejecting or extending it; never override terminal/cancelling run states. Existing approved/queued attempt-bound approvals remain domain facts. No approval is issued by requesting it. Multiple requests for the same task/attempt under new operation IDs reject `APPROVAL_REQUEST_EXISTS`; exact replay returns receipt.

**Approval response:** fresh binding principal kind human, distinct from requester, exact policy rule's approver actor and current policy revision; exact current `chord.approval.respond` grant on that task; requesting subject still valid/authorized; pending unexpired request, unchanged queued pending attempt/task_revision/scope. On approve kernel builds Approval using that attempt and task binding, fresh human principal, current time, deadline no later than request/rule, consumes nothing yet, and increments AuthoritySnapshot.authority_revision exactly once. Record request approved + receipt. Resume only when every queued task requiring approval passes the existing exact dispatch-approval checks for that human/approval policy; otherwise leave paused with success indicating run_state paused. On reject build the matching rejected Approval, mark request rejected and use existing run rejection transition, leaving dispatched external effects unknown as necessary. Other pending requests may remain historical pending but cannot authorize a failed run. No runtime call from either command.

Do not reuse legacy SDK `resumeRun`'s single-human requirement blindly for a batch of approvals from different permitted humans: coordinated resume checks each required queued task's exact installed approval and its independently authorized approver; it does not require one human to have approved every task. This is an explicit new coordinated orchestration rule, not a changed legacy API. The attempt-bound Approval schema/dispatch evaluator and anti-self-approval rule remain unchanged. Human authentication is the trusted channel-enrollment obligation, not inferred from principal.kind alone.

### 9. Dispatch capture, final check and callback fencing

Persist a DispatchRecord with **immutable dispatch identity fields** (only its closing `state` changes) in the same claim transaction as v1 operation dispatched/task running/active attempt/consumed approval/queue lease and closing history:

```js
DispatchRecord = {
  run_id:Id, incarnation_id:UUID, owner_id:UUID, generation:UInt,
  task_id:Id, task_revision:UInt, queue_id:Id, attempt_id:Id,
  operation_id:Id, authority_revision:UInt,
  dispatch_revision:UInt, task_lease_expires_at:UInt,
  owner_lease_expires_at:UInt,
  idempotency_key:string,
  state:'dispatched'|'completed'|'quarantined'|'closed'
}
```

Cross-invariants: every domain active attempt has exactly one matching `state:'dispatched'` sidecar record, same task/queue/attempt/task revision/dispatch revision/authority revision, and the current held owner generation. Every dispatched sidecar record has that active counterpart and a matching OperationRecord whose state is dispatched. Completed/quarantined/closed records remain append-only historical identities and cannot become dispatched again. Result ingestion closes the captured record as completed (meaning **local result persisted**, not proof of a successful remote effect); uncertainty closes it as quarantined; cancellation/invalidation closes it as closed and preserves operation unknown where appropriate. Administrative candidates may reserve pending attempts, but cannot invent active dispatches or reopen/retoken historical sidecar records. Acquisition/release closes every old dispatched record while quarantining its domain counterpart. The semantic validator rejects mismatches rather than manufacturing a fence from a raw domain record.

`owner_lease_expires_at` is captured dispatch-time evidence; renewal may extend the **same generation's** current lease without changing this evidence. It is not a substitute for checking the current owner lease. Coordinated dispatch requires a registered OperationRecord; trusted maintenance-created tasks without operation identity reject `OPERATION_REQUIRED` before any adapter call (legacy behavior unchanged). `idempotency_key = canonicalJSON(['chord.effect.v1',incarnation_id,run_id,operation_id])`, stable across retries/readmission/owner generations for the same logical external operation; it is **not** the command operation_id or a new key per attempt. New intended repeat business effects need a distinct, explicitly authorized logical operation, not an evasion of existing signature quarantine. Combined key max 2048 chars. Downstream adapters must implement mismatch detection against semantic operation payload, not attempt/time metadata, if they advertise idempotency support.

Resolve route and capture `adapter.execute`/validated frozen packet under local busy guard before claim; all exact/prefix/default/fallback routes and intent/handoff packet kinds converge. Store validates task authority again at its actual transaction time. Claim failures, overflow, capacity limit, storage unknown or owner loss release zero callable entries.

**Immediately after acknowledged claim, before Reflect.apply**, call `store.checkDispatch({credential:capturedCredential,dispatch:capturedDispatch})`. This performs a new authoritative validated read (no cache), samples the trusted clock, checks current run/incarnation/owner/generation/unexpired owner lease, exact current active task/queue/attempt/task revision/DispatchRecord, run executable, current task lease and **commit-stage authority evaluation** on the already-running attempt (including consumed exact approval). It requires no new write and no revision equality with the old dispatch_revision. No await, adapter getter, actor hook, new routing resolution or application callback between this check and the captured callable entry. Clock access in this check is trusted shell I/O, not actor-controlled. Failure discards callable; an ownership failure causes sticky loss and **zero canonical writes**. A current owner may later explicitly quarantine that exact still-active attempt; no automatic retry or fabricated proof that it was never invoked.

**Generation plus attempt before any outcome mutation:** both successful returns and throws capture the original OwnerCredential and full DispatchRecord in the per-invocation closure. Before constructing a diagnostic, uncertainty, ignored-result event or result candidate, store transaction checks current ownership; then exact current active attempt + task revision + queue + stored DispatchRecord generation/identity and state dispatched. **Missing active attempt is stale too.** Mismatch returns `STALE_ATTEMPT` with zero writes, including zero revision/receipt/logical-floor/diagnostic changes. Do not call markTaskUncertain(task_id) first. This directly fixes the Pass 1 old-success/new-attempt hazard and strengthens the existing error branch's missing-active case.

If same current owner/generation and exact attempt remain, run cancellation/pause/authority/lease denial may mark **only that captured attempt** uncertain/operation unknown under a fresh exact revision CAS; terminal tasks are not rewritten. If another transition removed the active attempt, reject without diagnostic mutation instead. Result normalization uses unchanged AdapterResult/Outcome shapes and kernel-stamped correlation; adapters cannot author fence/attempt/principal/grant data. Persistence failures remain outside adapter catch; no compensating write after unknown result commit.

#### Run revisions while a call is in flight

In **coordinated mode only**, replace `active.dispatch_revision === registry.run.revision` as the acceptance guard with exact stable dispatch identity + current ownership + current authority/run/task/attempt checks above, and an expected-revision CAS against the **current transaction revision**. Keep dispatch_revision immutable as evidence. Otherwise every harmless renewal/actor submission would invalidate in-flight work and make this design unusable. Authority revision still must equal dispatch-selected authority revision; grants/approval/windows are re-evaluated. Any cancellation/invalidation removes active attempt; pause blocks executable state. Unrelated tasks/receipts/renewals may advance global revision without poisoning this attempt. The 051 legacy guard and its tests remain unchanged; new tests must positively demonstrate renewal and unrelated actor command during a pending adapter can still complete, while authority changes cannot.

#### Adapter opt-in fencing/idempotency context

Default adapters keep the current packet and shallow context shape exactly. Opt in via **trusted router registration metadata**, resolved/captured before claim: execution context protocol `'chord.execution-context.v2'`. Do not trust AdapterResult to enable it. Opted-in context adds a deeply frozen `coordination` object:

```js
{ protocol_version:'chord.execution-context.v2',
  run_id, incarnation_id, owner_id, generation,
  owner_lease_expires_at, dispatch_revision,
  operation_id, attempt_id, idempotency_key }
```

This nested object is context only, not an extra TaskPacket/Attempt/Outcome field. Capture callable and context once. V2 evidence is recorded regardless of adapter opt-in; unmodified adapters receive no new guarantee. Downstream fencing namespace is exact `(incarnation_id,run_id)`; a cooperating service atomically tracks highest accepted generation and rejects lower generations before effects. Idempotency namespace/key must atomically reject mismatched semantic payload and return a previously committed response on duplicates. Equal-generation repeated distinct operations remain possible and need operation-key dedupe. A request that reaches downstream before the service has observed the newer generation may still be accepted; generation transport alone does not revoke an old remote request instantly.

The final DB check and external invocation **cannot be atomic**. Another process can take over after the check or a request can be delayed in transit. Local contract is a checked invocation boundary and fenced canonical commits, not universal prevention of stale physical effects. Tests must distinguish (a) final DB check passed, (b) actual adapter callable entered, (c) downstream simulated service accepted/rejected an effect. Show a barrier race where (a) precedes takeover and demonstrate downstream enforcement separately; do not turn it into an exactly-once claim. No automatic downstream fence-advance protocol or staged effect acknowledgement table is added in 052.

### 10. Crash and acknowledgement semantics

| Window | Required behavior |
|---|---|
| Actor command before transaction/failed confirmed rollback | No receipt/domain change; explicit re-plan allowed after fresh read/auth. |
| Command committed before response delivered | Exact receipt+domain/history is durable; retry original envelope under fresh authenticated subject obtains original response. Never execute mutation twice. |
| Acquire/renew/release commit acknowledgement unknown | Retire owner; inspect combined committed identity through a separate observer. Knowing it committed does not revive the lost closure or inherit its token. |
| Claim commit unknown or process dies before/after final check | No invocation released by a locally unacknowledged claim; recovery cannot infer whether an effect occurred from missing acknowledgement. Next acquired owner quarantines surviving claim. |
| Adapter invoked/returned/threw but no acknowledged result commit | Unknown external effect; preserve dispatched evidence until current-owner quarantine/takeover. No retry, auto-resume, success inference or staged-ack promotion. |
| Result commit acknowledgement unknown | May already be completed. Retire; no uncertainty compensation. Resolve exact historical commit identity and combined replay before further action. |
| Old callback after takeover and later reconciliation/readmission/new attempt | Reject original credential first; reject original attempt if same owner generation but different/missing active attempt. Success and error paths both leave newer task, active attempt, evidence, revision and floor unchanged. |

Expiry **never proves nonexecution**. Human evidence-backed reconciliation under fresh host authentication and exact expected revision remains required to resolve unknown; only confirmed_not_executed permits eligible fresh readmission under current grants. Both operations themselves require current owner fencing. Prior approvals remain consumed. A downstream idempotency key is additional evidence/control, not authorization to bypass reconciliation automatically.

### 11. Error vocabulary and precedence

New sanitized `CoordinationError` has `code`, `path:'$'`, and for mutation failure `commitStatus:'not_committed'|'unknown'`. Do not route new codes through v1 contractError's small allowlist. Store conflicts throw consistently in the new API; legacy raw-store returned stale objects remain unchanged. At actor boundary map to the §7 error response, never expose storage internals.

| Code | Meaning; canonical effect |
|---|---|
| `HOST_UNAUTHENTICATED` | No fresh host-bound session; none. |
| `INVALID_COMMAND`, `UNSUPPORTED_PROTOCOL`, `LIMIT_EXCEEDED` | Exact shape/version/budget invalid; none. |
| `RUN_MISMATCH`, `INCARNATION_MISMATCH`, `UNSUPPORTED_STORAGE_VERSION`, `SCHEMA_MISMATCH` | Wrong pinned identity/format; none. |
| `NOT_OWNER` | Gateway/owner never acquired; none. |
| `OWNER_HELD` | Acquire saw a live lease; none. |
| `OWNER_LOST` | Credential owner/generation no longer matches, or closure sticky-lost; none. |
| `LEASE_EXPIRED` | Exact matching credential but `now >= expires_at`; sticky loss, none. |
| `LEASE_NOT_EXTENDED` | Renewal at tied time would not advance expiry; none, not sticky loss by itself. |
| `CLOCK_ROLLBACK` | Invalid/backward clock observation (noninteger/negative uses `INVALID_CONTEXT`); sticky loss, none. |
| `GENERATION_EXHAUSTED`, `REVISION_EXHAUSTED` | Checked safe-integer allocation unavailable; none. |
| `STALE_REVISION` | Valid owner but expected revision differs; none, no callback replay. |
| `OPERATION_ID_MISMATCH` | Existing command ID for subject has different normalized envelope; none. |
| `FORBIDDEN` | Authenticated but no current subject/scope visibility, wrong handoff/request party, or missing/foreign private record; none. |
| `POLICY_DENIED`, `POLICY_CONFLICT`, `POLICY_STALE` | No exact allowed rule, ambiguous rule, or proposal/request uses older policy revision; none. |
| `HANDOFF_EXPIRED`, `HANDOFF_RESOLVED`, `APPROVAL_REQUEST_EXPIRED`, `APPROVAL_REQUEST_RESOLVED`, `APPROVAL_REQUEST_EXISTS` | Current authorized record cannot undergo requested transition; none. |
| `STALE_ATTEMPT` | Captured task/queue/attempt/generation absent or changed; **no diagnostic/uncertainty write**. |
| `OPERATION_REQUIRED` | Coordinated dispatch lacks durable logical operation identity; none, no invocation. |
| Existing authority codes | Principal/actor/capability/scope/deny/allow/approval failures remain distinct for visible authorized tasks; admission denial is zero-write. Dispatch-denial diagnostics only under valid owner. |
| Existing transition/reconciliation codes | Illegal state, immutable task, unknown operation needing reconciliation; none unless an explicitly permitted same-attempt uncertainty transition commits. |
| `STORAGE_UNAVAILABLE`, `STORAGE_CORRUPT`, `STORE_CLOSED`, `COMMIT_OUTCOME_UNKNOWN`, `UNSUPPORTED_RUNTIME`, init lifecycle codes | Preserve 051 failure distinctions; attempted commit/failed rollback unknown retires. Never a permission to retry effects. |

Precedence: frame/JSON/budget and authentication (do not evaluate untrusted request accessors); exact shape/version; pinned run/incarnation; host binding validity; valid owner for writes; receipt match/mismatch and visibility; expected revision; policy/permission/record state; candidate/replay/budget; final clock/time checks; SQL/acknowledgement outcome. Store internal identity checks precede all owner predicates. Owner mismatch precedes expiry when credential generation differs. A stale owner's denial may not append evidence merely to record its rejection; host may log outside canonical storage. Denials are not globally deterministic across genuinely concurrent changes, but every chosen branch and its zero-write property must be testable.

### 12. Practical implementation handoff and invariant/test mapping

Keep JS ESM/FCIS, explicit effects and only existing SigilJS plus Node built-ins. No dependency installation, framework, generic RPC library or network server is necessary. Reuse existing pure domain/reducer primitives without altering their legacy public schemas. Separate private owner from SQLite shell and pure coordination rules; do not make sdk/chord.js a second durable authority.

| Pass / proposed modules | Concrete implementation responsibility and exit gate |
|---|---|
| **3 storage** — `src/coordination/{contracts,state,history}.js`, `src/runtime/storage/coordinated-sqlite.js` | Exact v2 layout/open/init, identity, pure linked reduction, lease allocation/renew/release+atomic recovery, mandatory ownership/revision predicates, error/ack semantics, safe integer/capacity failure, observer load. Implement explicit tagged store.commit surface; command/outcome reducers may be attached in their later passes, but unimplemented tags must reject rather than bypass validation. Shared Node/Bun storage tests must prove atomicity/stale zero writes before ingress work. No need to finish actor transport in storage pass. |
| **4 ingress** — `src/coordination/{commands,command-authorization}.js`, `src/runtime/actor-ingress.js`, host facade composition | Exact allowlist, host-auth binding, current policy/exact scope grants, receipt ordering/mismatch/response atomicity, durable handoff/approval request+response; observer/actor no recovery. Shared tests through actual IPC and fresh authentication. No passing full SDK through actor port to save implementation time. |
| **5 dispatch** — `src/registry/coordinated-owner.js`, `src/sdk/coordinated-chord.js`, narrow opt-in branch in runtime/context helper | All canonical mutation inventory fenced, acquire-before-services, per-attempt immutable capture, final check, separate result/error persistence, new-mode revision semantics, opt-in context, same-generation/stale-generation callback regressions. Legacy runtime path unchanged. Root exports/allowlist only for explicit experimental host factories; no version bump or publication. |
| **6–9 proof/adversarial/docs/final**, per parent's sequence | Real simultaneous independent processes/actors, all runtime pairs, forced crash/ack windows, downstream race evidence, complete invariant+preservation+regression gates. Do not skip later passes because unit storage tests pass. |

Essential acceptance matrix (test IDs are requirements to implement, not tests executed by this design pass):

| ID | Invariant | Falsifiable cases and exact observables |
|---|---|---|
| O1 | OWN-01 one valid owner; OWN-04 atomic/revision aware | Barrier-start independent OS processes acquire same revision; exactly one success/new generation, other OWNER_HELD/STALE_REVISION and zero effects; incumbent's live tasks unchanged by observer/actor open. Store/read/replay identity and full row snapshots. |
| O2 | OWN-02 stale owner cannot make **any** canonical commit | After takeover old process reloads latest state, tries every mutation checklist item plus renew/release, denial/no-adapter/ignored-result diagnostics and admin install; OWNER_LOST, exact newer row unchanged. Reused owner_id remains rejected by generation. |
| O3 | OWN-03 final invocation boundary | Suspend after acknowledged claim, transfer/expire/takeover before final check; zero actual callable entries. All route kinds and task kinds. Barrier after final check demonstrates residual race honestly; downstream mock separately rejects lower token after seeing higher token. |
| O4 | OWN-05 lease expiry is not nonexecution; EFF | Keep first adapter alive across owner expiry/takeover; new owner quarantine unknown, zero redispatch, completed facts retained; explicit human reconciliation/readmission only. Task lease still-live cannot preserve old owner privilege. |
| O5 | OWN-06 monotone token | Acquire/release/reacquire, expiry/reuse owner ID, concurrent allocator; increasing safe generation. Independent overflow fixtures at MAX_SAFE_INTEGER for generation/revision/policy; exact zero writes/zero invocations. Identity mismatch/clone scope stated. |
| O6 | OWN-07 old callback no commit | Public runtime deferred success **and** throw: takeover, evidence-backed reconcile, new admission/new active attempt, then settle old promise. Snapshot new row/revision/attempt/floor/receipt/history before/after: byte-equivalent. Also missing-active, terminal/cancelled, same-generation replacement. Do not substitute private ingestExecutionResult tests. |
| A1 | ACT authenticated binding cannot self-assert | Two simultaneous child actor channels, own principals/actors; forged sender/principal/capability/grant/time/owner/path or generic method fields rejected; message from other channel never changes derived identity. Credentials/channel objects absent from DB/adapter args; auth failure after host restart despite persisted principal. |
| A2 | ACT durable authorized revision-checked handoff | Process A proposes, distinct process B observes and accepts; explicit scope+grant+policy. Both contribute committed facts. Wrong target/run/incarnation/scope, missing grants, deny, revoke, expiry equality, policy stale, stale expected revision, repeated/changed operation IDs and resolved handoff: exact denial, no clobber. Accept never transfers execution authority. |
| A3 | ACT approval/human continuity; REC | Actor A requests exact pending attempt/pause; fresh human B approves through its authenticated channel, owner resumes and dispatches once. Self/service human forgery/old channel/expired request/attempt mismatch/revocation reject; two authorized humans across tasks work without requiring one to approve all. Paused/consumed approvals survive takeover. |
| S1 | STA atomic no-clobber | Separate reader during transaction sees old whole envelope; after commit new whole envelope, no torn receipt/lease/history/domain. SQL predicate mismatch, busy timeout, malformed linked evidence, forced rollback failures; all authority conditions tested independently. |
| E1 | EFF duplicate/unknown | Same subject same full command returns exact old response without new revision after intervening commits; changed payload/expected revision mismatches. Ack lost after commit vs before commit; no second admission/handoff/approval or external effect. Unknown signature blocks new task-ID evasion; downstream same key payload mismatch rejects. |
| R1 | REC fresh host authentication/effect-free recovery | Observer and unauthenticated actor open valid live owner without changes; newly acquired owner atomically quarantines only old dispatched work before router lookup. Kill before/inside/after acquire COMMIT; no partly recovered owner or adapter resolution. Lost credential never adopted by read/reopen. |
| P1 | REP evidence reconstruction | Combined replay equals complete envelope projections at each revision with zero adapters; tied/backward diagnostic timestamps do not reorder. Missing/reordered/duplicated/foreign domain or coordination record, forged lease/receipt/fence delta, inconsistent header fail closed. Domain-only replay explicitly insufficient for ownership. |
| C1 | Clock contract | Tied now permits validity, no-op renewal rejects LEASE_NOT_EXTENDED; exact owner expiry takeover; backward floor/local sample CLOCK_ROLLBACK sticky no writes; lock wait samples after BEGIN; final clock sample expired lease rejects; forward jump quarantines without nonexecution claim. |
| K1 | Compatibility | 051/memory baseline remains green; v1/v2 cross-open and unknown schema reject without modification; no silent migration or exact-schema relaxation; legacy context unchanged and opt-in nested context frozen. New-mode renewal/unrelated submission while adapter pending succeeds, authority/pause/cancel still prevents invalid result. |

Run new shared suites and real actor/owner workers in **Node→Node, Bun→Bun, Node→Bun, Bun→Node**, resolving process.execPath and asserting worker-reported PID equals spawned PID. Both actors must stay alive concurrently and make meaningful commands, not just race raw CAS or observe a sequential restart. Owner contenders and actor contributors are different roles; proof artifacts must show both exclusion and collaboration, not imply two execution owners are valid simultaneously. Preserve/re-run all 051 full/shared/safety/restart baselines; do not weaken existing tests to force ownership success.

The full historical Proof 2/3 or product Level B gate is **not automatically passed** by this local subset: staged remote acknowledgement recovery, deterministic fresh-run bytes, tested snapshot migration and multi-machine behavior are not implemented here. Report exactly the new bounded independent-process ownership/actor evidence when later passes produce it.

## Tests executed

These are actual design-prerequisite probes, **not** implementation/coordination acceptance tests. `S=/home/d/.hermes/cache/scratch/chord-052-pass2`; repository cwd as above. Exact argv/exit/stdout/stderr retained in `S/probe-results.json`; assert-backed source is `S/runtime-probe.mjs`.

| Command | Exit | Observed result |
|---|---:|---|
| `/home/d/.volta/tools/image/node/24.22.1/bin/node S/runtime-probe.mjs S/node-probe` | 0 | v24.22.1; lazy node:sqlite; WAL=wal, FULL=2, busy_timeout=1000; conditional whole-row domain/evidence update rolled back together; MAX_SAFE_INTEGER round-trip and overflow rejection premise; inherited JSON IPC child exited 0. Parent PID 193702, child/spawn PID 193747. |
| `/home/d/.bun/bin/bun S/runtime-probe.mjs S/bun-probe` | 0 | Bun 1.4.3; same common node:sqlite/PRAGMAs/rollback/safe-integer and JSON IPC assertions; parent PID 193703, child/spawn PID 193724, child exit 0. |
| `git status --porcelain=v1`; `git rev-parse HEAD` | 0 | Protected dirty entry, nothing staged, expected full HEAD. |
| Python SHA-256 entry/final comparison, report structure/scope check | 0 | All 532 entry files unchanged; only this report added. |

The probe uses a scratch **engine probe table**, not an installed v2 Chord schema, authenticated production ingress or real ownership election. JSON IPC transport works on both measured runtimes; the host binding/policy/protocol remains to implement/test. No new baseline/full suite rerun is claimed here; Pass 1 freshly measured 275 Bun tests, 82 shared tests on each runtime and 21 safety tests on each runtime plus restart pairs. Those remain preceding-pass evidence, not this pass's measurements.

## Observed results

The common dependency-free SQLite shell and inherited JSON IPC choices were actually exercised on the pinned runtimes and need no extra library. Source inspection confirms a separate v2 envelope can preserve all v1 exact domain schemas and history while adding linked ownership/command evidence; **the proposed reducer and new APIs have not been executed or implemented**. The design closes the unsafe recovery-before-acquire and old-callback/new-attempt decisions explicitly. Renewals and unrelated command commits cannot self-invalidate every pending result in the selected new-mode model.

## Invariants demonstrated

**This pass demonstrates design consistency/prerequisite availability, not operational OWN/ACT satisfaction.** Real probes demonstrate atomic engine rollback for a conditional whole-row update and distinct-process inherited JSON IPC on Node/Bun. Source tracing establishes where every owner/command/result/error/recovery check must be installed. §12 binds OWN-01..07, ACT, STA, EFF, REC and REP to concrete failure cases and visible observables; all new product invariants remain pending implementation/proofs. Existing domain-only exact schemas and legacy modes are explicitly preserved.

## Known limitations

Trusted single-machine clock/host/filesystem/SQLite/VFS/device assumptions; no authentication server, hostile-host sandbox, public network transport, database encryption, signed evidence, remote fence advancement, compaction/migration, staged acknowledgement recovery, automatic unknown retry or exactly-once external guarantee. Same-user hostile code can access host capabilities outside actor JSON. IPC enrollment attests a host-configured identity, not a remote human login by itself. Whole-envelope synchronous O(state/history) validation and bounded lock blocking remain; linked evidence and renewals consume limited capacity. All new protocol behavior is design-only at this gate. Distribution/legal/publication blockers from 050/051 are unchanged.

## Blockers

**No genuine blocker to Pass 3 within this explicitly bounded design.** Required choices are resolved: independent v2 layout/identity; safe monotone run-owner generation; one-row domain+coordination atomicity and linked replay; strict trusted wall-clock lease; acquire+quarantine in one commit; sticky credential loss; all mutation/error fences; actor channel enrollment and narrow command types; exact idempotent response receipts; scoped policy-backed handoff/approval; generation+attempt-first callback rejection; revised coordinated in-flight revision semantics; final dispatch check and honest downstream race; legacy compatibility. Availability/clock trust/capacity/remote-effect constraints are accepted limits, not hidden deferred protocol decisions.

**Live multiprocess use remains blocked** until storage, ingress, dispatch and independent proofs pass. If later work requires migrating existing v1 runs, untrusted actor code isolation, remote human login, multi-machine leadership, staged-ack automatic completion or universal stale-effect exclusion, stop and report a scope blocker rather than patching those assumptions invisibly.

## Next pass: READY or BLOCKED

**READY — Pass 3 storage implementation only, under the parent's already-authorized sequence.** Implement §3–5 with shared runtime tests, ownership-before-recovery and zero-write stale failures first. Then Pass 4 implements §7–8 and Pass 5 §6/9–10; neither may simplify away a prerequisite. This report is the handoff artifact, not a claim that any subsequent pass ran. No Pass 3 source, Block 053, staging/commit or publication performed.
