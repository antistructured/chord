# Block 053 — B1 InteroperabilitySurfaceAudit

## Pass

**B1 COMPLETE — integration audit only. B2 READY for the minimum additive protocol design described below. No Block 053 implementation or public API has been installed.** This gate is not completion of Block 053, a provider integration, a second runtime, full historical Level B promotion, or publication permission.

Repository R=`/home/d/Workspace/other-projects/chord`; package P=`R/packages/core`; branch `base`; HEAD `72f96ab6cdc9d6948ffb7eacba527cc27a32a8be`. Entry was the protected dirty 052A correction artifact: 19 modified and ten untracked paths, including A4. Entry SHA-256 inventory contains **573 files** in `git ls-files --cached --others --exclude-standard`; this excludes ignored dependencies/evidence. B1 adds only this report and preserves every entry file. Historical independent audit SHA-256 remains **`0b7609b61e593bcb546ce0cacb838b986cf7a90949393a8e8fe69a6b17cddc60`**.

**Prerequisite:** `docs/internal/052a-final-report.md#Pass` and `#Next-pass readiness` explicitly say A1–A4/052A and bounded 052 engineering acceptance COMPLETE and authorize 053 ENTRY. That acceptance covers the corrected dirty tree, not HEAD alone. The historical committed independent audit remains PARTIAL for its original artifact; its F1/F2 findings were corrected and independently accepted by A4, not erased. Earlier A1/A2/A3 “053 blocked” statements describe earlier gates, not a present contradiction. The user's 053 target is **Adapter Protocol Interoperability**, not the historical audit's narrower downstream-only suggestion.

Evidence S=`/home/d/.hermes/cache/scratch/053-b1`; entry manifest `/home/d/.hermes/cache/scratch/053-b1-entry.json`. Scratch is inspectable, regenerable and prunable. N=`/home/d/.volta/tools/image/node/24.22.1/bin/node`; B=`/home/d/.bun/bin/bun`. Measured versions: Node v24.22.1, Bun 1.4.3. No network access or installation was necessary.

## Agent

**integration-audit-agent**, delegated B1 only. Loaded `repository-documentation-verification`. Inspected current source and actual contract behavior rather than interpreting historical future proposals or green totals as an existing general interoperability protocol. No B2 implementation, source/test/example/README/export edit, staging, commit, push, tag, publish, version/dependency change, reset, clean or stash.

## Files inspected

### Accepted contracts, evidence and precedence

- `docs/internal/050-product-contract.md`: product definition, host authority versus descriptive intent, experimental public/privileged API classification, non-goals and later-block inputs; `050-final-report.md`: accepted host boundary and engineering/publication distinction. Historical absence-of-durability and absence-of-IPC statements describe 050, not today's checkout.
- `docs/internal/051-storage-contract.md`: synchronous singleton storage, lazy built-in binding, transaction/acknowledgement truth, exclusive sequential restart, B3 close/recovery addendum; `051-final-report.md`: bounded acceptance, authority continuity, unknown effects and deployment limits.
- `docs/internal/052-coordination-protocol.md`: distinct v2 identity/layout, owner lifetime, actor authentication/allowlist/receipts, dispatch capture/final check/outcome fences, opt-in context and remote race, crash/ack semantics. Relevant implementation/final/guide evidence: `052-actor-ingress.md`, `052-dispatch-takeover-safety.md`, `052-developer-guide.md`, `052-final-report.md`; independent historical challenge `052-committed-independent-audit.md`.
- `docs/internal/052a-{root-cause-report,identifier-integrity,ipc-correlation,final-report}.md`: own-record lookup correction, exact transport identity/validation/cleanup and intentional wire change, final acceptance and retained reliability issue. Actual source takes precedence over earlier implementation-stage “not yet present” descriptions. Normative acceptance restrictions are not replaced by a broader claim here.
- Package manifest, current package README actor/framing/ownership/context sections, installed SigilJS `package.json` and `src/sigil.js`; current examples, relevant fixture setup, shared suite commands/results and runtime verifier. No claim of an unrelated full security audit, full dependency review or line-by-line re-review of all historical tests.

### Full current source inventory and boundary mapping

All paths below are relative to P. The inventory universe is **55 first-party `src/**/*.js` files**, JS ESM, zero source TypeScript; `S/source-inventory.json` records exact paths, line counts and static import candidates. Boundary-bearing modules were inspected at the named implementations; peripheral CLI/demo/utilities were inventoried and checked as consumers, not certified as alternative runtimes. Group lists below enumerate every source file exactly once.

| Source paths | Actual surface / audit relevance |
|---|---|
| `src/index.js`; `src/sdk/index.js`; `src/platform/index.js`; `src/types/index.js` | Root/SDK/platform exports and non-executable JSDoc typedefs. No public adapter-protocol factory, negotiated descriptor, execution-session client or generic method dispatcher. |
| `src/sdk/chord.js` | Legacy memory and optional v1 durable owner; trusted authority/grant/approval helpers, admission, local router/policy setters, cancellation/reconciliation/readmission, cycle/close. |
| `src/sdk/coordinated-chord.js` | Opt-in v2 factory, separate observer/owner/admin/ingress ports, captured routing/callable/context, acknowledged claim, fresh final check, fenced outcome. |
| `src/contracts/sigils.js` | Exact data contracts, recursive descriptor-first cloning/budgets, TaskPacket, AdapterResult/ExecutionResult/Outcome, Attempt, authority, operation/reconciliation/history/snapshot definitions. |
| `src/execution/task-packets.js`; `src/execution/results.js` | Intent/handoff packet creation, `prepareTaskExecution`, `executeTask`, normalization and result-registration bridge. Actual adapter contract is host `execute(packet, context)`, not serialized executable data. |
| `src/platform/adapter-routing.js`; `src/platform/runtime-loop.js`; `src/platform/policy.js` | Own exact route, ordered prefix/default/fallback; legacy claim/dispatch/commit shell and caps/backoff policy. |
| `src/platform/authorization.js`; `src/platform/attempts.js`; `src/platform/transitions.js`; `src/platform/state-invariants.js` | Pure admit/dispatch/commit decisions, pending/active reservations, guarded task/queue/artifact/domain transitions and immutable task checks. |
| `src/platform/task-queue.js`; `src/platform/reconciliation.js`; `src/platform/recovery-policy.js` | Readiness/leases/pre-dispatch retries, logical-effect signature identity, human evidence reconciliation. The older generic EffectStates/getIdempotencyKey helpers are not the installed coordinated protocol. |
| `src/platform/handoff.js`; `src/platform/approval-flow.js` | Legacy host projections, handoff and lifecycle helpers; not authenticated actor endpoints by themselves. |
| `src/platform/event-journal.js`; `src/platform/history.js`; `src/platform/trace-reducer.js`; `src/platform/journal-audit.js` | Diagnostics versus canonical commits, own-aware deltas and semantic no-effect replay; sorted diagnostic audit is not authoritative replay order. |
| `src/registry/registry.js`; `src/registry/owner.js`; `src/registry/coordinated-owner.js` | Legacy registration/ingestion, private clone/CAS or durable owner, fixed acknowledged v2 credential and synchronous local guard. |
| `src/registry/query.js`; `src/registry/snapshot.js` | Full host inspection/export/import; no authenticated cross-process execution service or continuation by snapshot in v2. |
| `src/coordination/contracts.js`; `src/coordination/command-authorization.js`; `src/coordination/commands.js` | Exact coordinated contracts, host-bound subject/scope/policy checks, seven actor commands, read filtering, original durable receipts and pure reconstruction. |
| `src/coordination/runtime.js`; `src/coordination/state.js`; `src/coordination/history.js` | Pure claim/outcome, full installed attempt identity, generation/lease lifecycle and quarantine, paired domain/coordination replay. |
| `src/runtime/actor-client.js`; `src/runtime/actor-ingress.js`; `src/runtime/actor-transport.js` | Existing authenticated-command transport composition and corrected ephemeral framed delivery. These do not implement remote execution adapters. |
| `src/runtime/storage/sqlite.js`; `src/runtime/storage/coordinated-sqlite.js`; `src/storage/contract.js`; `src/runtime/recovery.js` | Lazy built-in SQLite, authoritative v1/v2 commit/identity/acknowledgement, v1 exclusive-restart recovery; no generic provider registry or alternate scheduler. |
| `src/runtime/adapter.js` | Bun/Node text-file I/O helpers; despite filename, not the governed execution-adapter interface and not storage authority. |
| `src/utils/clone.js`; `src/utils/id.js`; `src/utils/own.js` | Structured cloning, shell-generated IDs, corrected own-record lookup. Preserve accepted inherited-member identifiers and serialization behavior. |
| `src/cli/_shared.js`; `src/cli/run.js`; `src/cli/replay.js`; `src/cli/inspect-audit.js` | Developer consumers/configuration and replay/audit scripts, not an actor-command or arbitrary-shell protocol. |
| `src/demo/callaback-demo.js`; `src/demo/fake-sms-adapter.js`; `src/demo/fake-user.js`; `src/verify-runtime.js` | Mock execution consumers and actual runtime validation. Demo adapter `name` is incidental metadata, not registered authority/discovery. |

Examples inspected: `examples/quickstart.mjs`, `examples/cross-actor-workflow.mjs`, execution/authentication/shutdown paths of `examples/process-recovery.mjs` and `examples/two-process-coordination.mjs`. The first two use ordinary trusted local adapters; the restart example re-supplies services and quarantines ambiguous effects; the live example uses the v2 registration wrapper, a restricted actor child and a local simulated downstream/file effect. It is not a generic remote protocol implementation. Shared tests freshly exercise the process examples across all four runtime pairings; B1 does not claim a separate new standalone artifact/12-database inspection campaign beyond A4.

Relevant executed tests: all 28 full-suite files under Bun; seven coordinated/correction shared files and five legacy durability shared files under Node/Bun; original safety harness; both runtime verifiers. Inspected callable/storage/fixture contracts and architecture/lazy-binding tests when composing independent probes.

## Files changed

**Created only `docs/internal/053-interoperability-audit.md`.** All 573 entry files retain their original bytes and presence, including all 29 pre-existing dirty paths, package manifest/lock, original tests, 052A corrections and historical evidence. New runners, interface/lazy probes, manifests and logs exist only under configured scratch S, not in source/tests/public exports. No B2 code or installed candidate protocol exists.

## Design decisions

### 1. Boundary table: four different powers, not one “adapter”

| Boundary | Who supplies/owns it | Permitted input/output | Does NOT confer |
|---|---|---|---|
| **Actor client / authenticated command ingress** | Host enrolls actual inherited channel out of band; client sends narrow JSON | Seven canonical command types; bounded exact responses; filtered context/outcomes; durable receipts for accepted writes | SDK/admin access, host grant issuance, owner acquisition, arbitrary method dispatch, effect execution or direct canonical result installation |
| **Execution adapter under kernel scheduling** | Trusted host registers executable object; kernel selects authorized work | Frozen validated TaskPacket and frozen shallow execution context; adapter returns narrow AdapterResult normalized by kernel | Principal authentication, authority installation, approval minting, ownership adoption, trusted result correlation or canonical commit |
| **Host authentication / authority administration** | Trusted embedding application with private enrollment/SDK/admin/store capabilities | Attested bindings, declarative principals/actors/capabilities, exact scoped grants/approvals/policy, privileged maintenance | A schema or advertisement is not authentication; possession/exposure of these capabilities is privileged and must never become actor JSON dispatch |
| **Kernel canonical commit / owner fence** | Private owner plus authoritative storage transaction | Expected revision, fixed acknowledged credential, exact claim/attempt, current authority, validated candidate and linked evidence | Physical rollback/cancellation of external effects, remote exactly-once, proof that a missing acknowledgement means nonexecution |
| **External service enforcement** | Cooperating downstream reached by host execution adapter | Optional generation namespace, stable operation key and semantic payload/receipt | Authority to grant work, autonomous reconciliation, immediate knowledge of an unseen higher generation, permission to bypass kernel commit |

An actor can request authorized work or exchange an authorized handoff; neither handoff acceptance nor approval response invokes an adapter. The owner explicitly schedules later. A privileged adapter can capture host capabilities in its closure: frozen data arguments do not sandbox hostile JS. Giving an actor the host SDK/raw SQL/owner port or a `sdk[method](payload)` endpoint defeats the documented boundary. A generic interop port must not recreate that exposure.

**Capability advertisement is NOT a host grant.** Current Actor.capabilities is a host-installed authority prerequisite but still insufficient without an active exact-scope allow and no matching deny, plus required approval. A future adapter's advertised supported actions/protocols/context/limits is merely descriptive compatibility/routing information. It must never install Actor.capabilities, grants, policy or approvals; synthesize permission; replace `evaluateAuthority`; or turn an advertised downstream fence into local ownership. The independent advertisement/no-grant probe rejects admission with NO_ALLOW_GRANT and unchanged full registry despite an execution-capability-advertising fallback adapter.

### 2. Actual legacy and coordinated invocation contracts

`platform/adapter-routing.js#resolveAdapter`: own exact entity registration first; then first matching own-enumerated prefix in insertion/enumeration order (not longest-prefix sort); own exact `default`; finally fallback. An absent inherited-member name is not a registration. No capability negotiation, protocol/version selection, registration schema, remote endpoint resolution or descriptor validation occurs here. Routing identifies a service; it does not authorize work.

`execution/task-packets.js#prepareTaskExecution` reads `adapter.execute` once while the SDK synchronous guard is held, validates and deeply freezes a detached packet, shallow-freezes a copied context, captures callable and receiver, then invokes via `Reflect.apply`. There is no second execute getter lookup after acknowledged claim. Adapter throws become sanitized ADAPTER_ERROR; normalization rejects wrong task IDs, extra correlation/fence fields or inconsistent status/outcome. Context is constructed internally, not an exported exact Sigil execution-context contract. The generic helper shallow-freezes context, not arbitrary nested host-provided objects; the supported v2 coordination child object is itself explicitly frozen.

Current packet: exact `chord.contracts.v1`, `task_id`, task/source kind, nullable source spec ID, project/phase/target, role/stance, requested_action, inputs and constraints. Role/spec authority prose is descriptive. Supported kinds are `intent_execution`/`handoff_review`; nested input/constraint contracts are separately asserted. No callable, SDK, login credential, owner credential or installed authority snapshot is passed as packet authority.

Current base context: `run_id,schema_version,task_id,task_revision,queue_id,attempt_id,lease_expires_at`. The runtime stamps Outcome run/schema/task revision/queue/attempt from captured state, not returned adapter data. AdapterResult permits optional task_id, paired status/outcome (`completed/succeeded`, `failed/failed`, `blocked/blocked`), optional summary/outputs/artifact/domain only. A returned failed/blocked result is a committed local result, not a general assertion of no physical effect. Unknown is represented in kernel task/operation state, not a new success-shaped AdapterResult.

Legacy `runRuntimeCycle` commits the claim before invoking, honors concurrency caps, and only pre-dispatch missing routing uses bounded retry/dead-letter behavior. Commit re-evaluates authority and additionally requires the captured dispatch revision to equal current run revision. Memory is single-process; v1 durable mode requires exclusive host-assured sequential restart. Do not import v2 revision rules or negotiated context into this path by default.

Coordinated `owner.runCycle` first checks eligibility, plans exact operation/attempt, captures route/callable/packet/context under guard, commits claim with fixed credential, then reloads authoritative storage through `checkDispatch` immediately before entering captured callable. No await/router/getter/application hook lies between final check and entry. Success and error persistence occur only after owner then full active dispatch/attempt checks; missing/replaced attempts are stale before any diagnostic mutation. Same-generation renewals/unrelated actor commits may advance global revision without invalidating that exact active attempt; current authority revision, selected grants/approval, task lease/lifecycle and owner fence still apply. Result persistence is outside adapter catch; unknown persistence cannot trigger a compensating uncertainty write.

Coordinated registration recognizes an own `adapter` member as opt-in and requires `execution_context:'chord.execution-context.v2'`; a raw adapter remains supported. Only the wrapper adds frozen `context.coordination` with protocol/run/incarnation/owner/generation, dispatch-time owner expiry/revision, operation/attempt and idempotency key. Legacy exact packet/Attempt/Outcome shapes remain unchanged. **Keep this optional legacy-compatible registration**, not mandatory new fields or silent downgrade. The wrapper is context opt-in, not verified remote enforcement or general capability advertisement. Its context captures evidence, not a transferable OwnerCredential.

Downstream namespace is `(incarnation_id,run_id)`. Stable effect key is exactly `JSON.stringify(['chord.effect.v1',incarnation_id,run_id,operation_id])`, stable over attempts/readmission/generations of the same logical effect. It is distinct from actor-command operation ID. The generic older `recovery-policy.js#getIdempotencyKey(task)` returns a task property/null and is not how coordinated dispatch derives its key; its comment about the kernel never inventing keys must not overwrite the later opt-in v2 contract. A downstream must atomically fence observed generations and deduplicate semantic payload, not lease/attempt metadata. Transporting context alone does neither. Final DB check and remote effect remain non-atomic; an old request may act before the downstream has observed a newer generation.

### 3. Actor IPC is reusable command plumbing, not an execution protocol

Current client is `createActorClient(channel = process,{timeoutMs = null} = {}) -> {sendCommand,close}`. Ingress is trusted host composition `{handleAuthenticated,attachChild}`, with attachment `{detach}`. Exact child identity is freshly authenticated for every command/read/duplicate. Seven command types remain `submit_work,project_context,propose_handoff,respond_handoff,request_approval,respond_approval,observe_outcomes`; there is no adapter execute/cancel/shutdown/capability-registration command.

052A framing already provides exact `chord.actor-ipc-request.v1`/`chord.actor-ipc-response.v1`, fresh UUIDv4 session per wrapper and request per send, bounded string parse and exact shared response validation. Sessions/requests are ephemeral delivery identity, neither host authentication nor durable idempotency. Every success must match operation/run/incarnation/correlation/causation and result type. Rejections lack run/incarnation; null command identity is attributable only through the matching outer frame. Module-private WeakMap enforces one wrapper per exact channel; settlement compares the exact pending object, protecting new sends from stale callbacks/timers. Default unbounded wait, explicit optional timeout, close/disconnect retirement and no retries remain current behavior.

Canonical direct `handleAuthenticated(context, canonicalCommandJSON)` is unchanged. Default framed wire deliberately differs from pre-052A raw clients; `attachChild` retains explicit raw canonical peers, but framed clients do not downgrade or accept raw replies. Legacy raw peers remain outside the corrected delivery guarantee. Whole-frame budgets can reject near-limit canonical commands that the direct API accepts. Do not repeat the historical defect by using only command operation/correlation IDs or a wrapper-reset counter for future remote execution replies.

Durable write receipt key uses stable authenticated subject plus canonical command operation ID; exact retry retains the complete original envelope including expected revision/correlation/causation. Current auth/visibility/owner checks precede receipt return; original response may carry old generation/revision and must remain byte/semantically unchanged. Reads do not persist receipts and identical reads may legitimately observe different snapshots. None of the transport nonces is an authority input, adapter argument or persisted receipt field.

For a later execution transport, reuse these **concepts** (versioned bounded envelope, per-session/per-send identity, exact matching and lifecycle cleanup), not the actor command allowlist as an arbitrary executor. Keep remote reply identity separate from kernel-generated task/attempt/operation identity and authenticated actor receipt identity. B2 must specify separate protocol role/version and compatibility failure semantics before implementation; B1 does not select wire field names or introduce another client/runtime.

### 4. Failure, timeout, cancellation, shutdown and recovery ownership

| Event / boundary | Current truth | Interoperability requirement for B2 |
|---|---|---|
| Before acknowledged claim | Callable not released on failed/conflicting/unknown claim | Compatibility/capability checks that can be pure should fail before dispatch; no hidden provider fallback or automatic callback replay. |
| Claim acknowledged, no result commit | Durable dispatch exists, not evidence of physical execution or nonexecution | Preserve conservative ambiguity even if a bridge believes it never sent. No new effect under a fresh operation key to evade quarantine. |
| Execution adapter throws / malformed normalized result | Post-dispatch ambiguity; exact current attempt may become uncertain/operation unknown | Malformed/unsupported/late replies cannot manufacture success or “not executed”; sanitize without exposing provider data. |
| Actor client timeout/send failure/protocol error | Local acknowledgement abandonment; command may already have committed | Preserve original command for explicit authenticated receipt recovery; no auto-resend or changed operation ID. |
| Execution timeout | No kernel execute timer/AbortSignal/cancel port currently; awaiting adapter can remain pending | If introduced later, it abandons waiting, not remote effect truth or automatic retry. A bridge rejection remains post-dispatch unknown under current kernel rules. |
| Task/authority/lease/run changes in flight | Same exact active attempt may quarantine under current authority denial; removed/replaced attempt or stale owner rejects zero-write | Late success AND error must pass captured kernel fences. A cancellation acknowledgement alone cannot assert effect absence or commit authority. |
| Legacy cancelTask/cancelRun | Host canonical lifecycle change; dispatched operation remains unknown; no adapter cancel callback | Preserve canonical cancellation versus best-effort remote interruption distinction. Coordinated facade has no corresponding convenience cancel methods; trusted legal maintenance is not an actor cancel endpoint. |
| Actor client close / ingress detach | Retires local wrapper / removes host listener only | Neither undoes commands nor terminates the child/effect. Host separately owns revoke/disconnect/join and resources. |
| SDK/owner close | Synchronous resource retirement, no drain/release/cancel/compensation | Host must await/join calls where possible. Later callback cannot revive retired owner; do not advertise close as successful execution shutdown. |
| Owner release or later acquire | Atomic populated quarantine and retained generation / fresh generation; old acknowledged credential cannot be adopted from reads | No automatic remote retry. Fresh host services/attestation required; capture remains per invocation. |
| Result COMMIT acknowledgement unknown | May already be canonically completed; retire owner/store | Read exact historical commit/replay via separate observer; do not compensate, retry adapter, reset approval or infer remote truth. |
| Restart/replay/reconciliation | v1 exclusive restart or v2 acquire quarantines; reducers invoke zero effects; evidence-backed human reconciliation is host administration | Retain confirmed_completed / confirmed_not_executed / authorized_compensated / still_unknown evidence kinds. Only confirmed_not_executed permits eligible readmission under current grants; downstream dedupe alone is not automatic permission. |

The kernel owns canonical state/attempts/unknown classification; host owns enrollment, adapter lifetimes and shutdown orchestration; adapter/bridge owns transport and external cancellation attempts; downstream owns physical-effect acceptance and receipts. No layer may infer another layer's completion merely from local timeout, disconnect, process exit or lease expiry.

### 5. Reuse inventory, missing protocol surfaces and minimum additive proposal

| Concept | Reuse from current artifact | Actual gap | Minimum B2 recommendation (design only) |
|---|---|---|---|
| Governed task execution | TaskPacket/AdapterResult normalization, captured `execute`, route and kernel cycle | No common protocol descriptor or execution-wire contract | Add a small protocol-neutral execution bridge contract around the existing host adapter seam, not a scheduler/authority evaluator. Keep current packet/result exact shapes. |
| Compatibility discovery | Explicit v2 context opt-in; fixed contract/protocol literals | No exact adapter identity/version/capability advertisement or explicit supported/unsupported selection rules | Specify bounded descriptive advertisement and exact compatibility rejection; distinguish advertised ability from trusted host route selection and grants. No dynamic plugin discovery/network registry. |
| Request/session matching | Corrected actor framed delivery and exact pending cleanup concepts | Only actor commands have this installed; execution remains an ordinary JS promise | Define execution-role version/session/request identity, task/attempt matching and stale reply handling. Do not extend canonical actor command or durable receipt keys. Keep initial concurrency bounded rather than invent multiplexing. |
| Fenced execution context | Existing optional `chord.execution-context.v2` and stable logical effect key | No bridge contract proving propagation/enforcement; no mandatory downstream service | Specify optional propagation preserving raw legacy adapters; reject unsupported explicitly selected context. Advertising support is not proof of atomic downstream enforcement. |
| Outcome/error mapping | Existing kernel Outcome stamp, uncertainty/reconciliation, commit-unknown handling | No transport error/timeout/cancel lifecycle vocabulary for execution adapters | Classify pre-dispatch rejection vs post-dispatch unknown; state who may stop waiting and who may cancel/join. No new adapter-authored canonical status/correlation. |
| Lifecycle/host composition | Separate owner/admin/observer/actor ports, current sync close and host cleanup | No uniform bridge lifecycle/disposal/drain guarantee | State minimal creation/close ownership and late-response retirement. Treat cancel/drain as unsupported unless deliberately specified/tested; do not silently turn current close into async drain. |
| Evidence/replay | Canonical domain commits plus v2 linked sidecars/history, historical command receipts | No protocol capability negotiation history or raw remote receipt semantics | Do not invent a parallel journal/authority/effect ledger. Decide only necessary bounded protocol diagnostics later; canonical replay stays pure and remote evidence stays separately qualified. |
| Packaging/runtime | Three ESM entry points, pinned SigilJS, lazy node:sqlite, inherited IPC proven Node/Bun | No exported interoperability contract/bridge or consumer example | Later additive exports/example only after B2 design; preserve all existing names and import-without-SQLite behavior. No new package/dependency/provider framework. |

**Minimum additive scope:** one protocol-neutral compatibility/advertisement vocabulary, a bounded execution request/result/error/session/lifecycle contract, and a thin host adapter bridge that still runs under the existing kernel. This is a recommendation for B2 to specify, not an installed API or an obligation to implement every optional method. Actor client authorized commands remain a distinct role; host attestation/grants and kernel commits remain outside the execution protocol. General LLM APIs, cloud connectors, framework integration, arbitrary shell execution, a second runtime/tool loop, generic provider selection, automatic unknown retries, migration/compaction and remote exactly-once are excluded. A downstream-enforcement-only proposal would miss the requested interoperability surface; an agent framework would exceed it.

B2 must decide exact advertisement/role/version data, selection/rejection rules, minimal lifecycle and error states, and optional context compatibility. These are the next design pass's work, not an audit blocker requiring B1 to design an implementation. Require clear acceptance cases: old raw adapter unchanged; descriptor not a grant; unsupported protocol before effect; captured callable semantics retained; genuine stale/duplicate execution replies across wrapper/session replacement and identical sends ignored; timeout/close followed by late success/throw cannot touch a new attempt; kernel-stamped results only; unknown/reconciliation preserved; dual-runtime/lazy-import tests and zero source/provider dependency growth. No numeric test-total commitment for unimplemented tests.

### 6. SigilJS, JavaScript/FCIS and runtime feasibility

Current manifest/installed dependency is exactly `@weipertda/sigiljs@0.18.0`; package version remains `0.4.0-preview.1`. Installed `Sigil.exact` supports nested exact record shapes, required/optional fields, literal/union/array contracts, `.check`, `.version` metadata, `.describe` and `.toJSONSchema` in the measured runtime probes. Metadata version is descriptive: a wire protocol literal/semantic version check is still required. JSON Schema projection is available but does not reproduce Chord's handwritten identifier/safe-integer/scope/cross-record semantics and is not authentication or a reason to add tooling now.

An `object` slot is opaque to exact field validation: the probe accepts arbitrary nested keys inside that slot. Existing Chord correctly asserts nested payload/result variants separately and puts descriptor-first `clonePlainData` ahead of Sigil. Keep that pattern for advertisements/envelopes: explicit bounded keys, literal versions, identifier/counter validation, separate nested variant assertion and own-record access. Current data guard rejects accessors without invoking them, executable values, bigint/nonfinite values and forbidden keys. Supported inherited-member IDs must not be banned as a convenience. No dependency upgrade or TypeScript conversion is necessary for B2's bounded design.

Pure schema/compatibility/correlation classification belongs in pure JS modules; IDs, timers, process IPC, resources and remote calls belong in narrow shells. Existing pure reducers must not execute user adapters/auth callbacks or sample ambient time. Reuse current owner/store boundaries rather than constructing a second state cache or scheduler. First-party import inventory and freshly executed ARCH-18 remain constrained to relative modules, node built-ins and SigilJS; no provider/framework import is added.

Both runtime storage shells use lazy synchronous `createRequire(import.meta.url)('node:sqlite')` only on explicit store construction. Fresh isolated probes deny SQLite loading: root import and memory SDK succeed with zero loads; explicit v1 and v2 factories each attempt one load and fail UNSUPPORTED_RUNTIME without creating a file. Node uses Module._load interception; Bun uses a node:module createRequire mock, not the ineffective Node interception path. Existing real storage suites exercise actual built-in SQLite transactions on both runtimes. Existing production inherited child IPC is freshly exercised by actor/correction/live suites on Node/Bun; no new transport dependency or public network service is needed or implied. These are measured Linux versions, not a minimum-version/all-platform claim.

Public entry points remain `.`, `./sdk`, `./platform`. Actual enumerations on both runtimes are **35 / 1 / 22**; `/sdk` still only exports `createChord`. No general adapter protocol exists under another export name. Internal contract/helper availability does not mean it is consumer-exported API. Exact names and Sigil descriptions/projections are retained in `S/interfaces-{node,bun}.log`.

## Tests run

Fresh sequential baseline runner: `python3 /home/d/.hermes/cache/scratch/053-b1/run-baseline.py`, cwd R, exit **0**. Expanded argv/cwd/exits/durations/log paths: `S/commands.json`. Independent probe commands/cwd/exits: `S/probe-commands.json`. Full suite was run in isolation before the shared commands, not concurrently with them. Counts overlap and are not summed.

Define C exactly as:

```text
tests/coordinated-storage.test.js tests/actor-ingress.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/two-process-coordination.test.js tests/identifier-integrity.test.js tests/ipc-correlation.test.js
```

Define D exactly as:

```text
tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js tests/process-recovery.test.js tests/durable-adversarial.test.js
```

| Actual command (N/B/P/R/S expand above) | Cwd | Observed result | Exit |
|---|---|---|---:|
| `N --version`; `B --version` | P | v24.22.1; 1.4.3 | 0 each |
| `B test` | P | **406 pass / 0 fail / 1738 expect calls / 28 files** | 0 |
| `N --test C` (the seven literal paths above) | P | **131 pass / 0 fail / 0 cancelled/skipped/todo** | 0 |
| `B test C` | P | **131 pass / 0 fail / 7 files** | 0 |
| `N --test D` | P | **82 pass / 0 fail / 0 cancelled/skipped/todo** | 0 |
| `B test D` | P | **82 pass / 0 fail / 5 files** | 0 |
| `N --test docs/internal/046-state-probes.mjs` | R | **21 pass / 0 fail / 0 cancelled/skipped/todo** | 0 |
| `B test ./docs/internal/046-state-probes.mjs` | R | **21 pass / 0 fail** | 0 |
| `N src/verify-runtime.js`; `B src/verify-runtime.js` | P | ALL RUNTIME VALIDATIONS PASSED on each | 0 each |
| `N S/interfaces.mjs`; `B S/interfaces.mjs` | R | Exact/nested/literal/optional/union/array contract checks; schema metadata/projection; data guard; callable captured once/invoked once after property replacement; advertised ability with no grant denied/unchanged; route precedence; existing schemas reject extra protocol/fence fields; exports 35/1/22 | 0 each |
| `N S/lazy.mjs`; `B S/lazy.mjs` | R | Import/memory zero SQLite loads; explicit v1/v2 each reject denied load with UNSUPPORTED_RUNTIME, two total attempts | 0 each |
| `git diff --check`; `git diff --cached --stat` | R | Empty; no staged changes | 0 each |
| Entry/final SHA-256 and inventory comparison | R | Every entry path preserved; only this report added; historical audit hash matches | 0 |

The 131 shared tests include the original 81 coordinated plus 26 identifier and 24 IPC regressions. Full historical tests import bun:test; no full-suite Node claim is made. Real process/IPC/kill/recovery test paths run through existing suites; new interface probes are in-process contract/composition checks, not fabricated remote provider responses, a deployed bridge or a new hostile-network proof. No failed command in this B1 test/probe matrix was hidden or replaced with invented output.

## Results

1. Existing artifact is a usable governed local adapter seam plus a separate corrected authenticated-command IPC seam, **not** an installed general adapter interoperability protocol. A thin additive protocol layer can reuse it without new dependencies or another execution runtime.
2. Baselines and independent interface/lazy probes pass on the actual measured runtimes. The report identifies concrete missing advertisement/version/session/lifecycle/outcome surfaces without claiming implementation or forcing canonical schema changes.
3. No new P0/P1 supported local bypass or B1 engineering blocker was reproduced. Protocol gaps are absence of the requested next-layer contract, not regressions in accepted legacy/v2 behavior. B2 must make its explicit bounded choices before implementation.
4. The earlier A4 reliability observation remains **open/unclassified P2 test/process reliability**: initial concurrent full suite 405 pass / 1 fail, worker store construction STORAGE_UNAVAILABLE then seam timeout; unchanged isolated rerun 406/0. B1's isolated full suite also gives 406/0, but does not prove the root cause, establish a load-only diagnosis, or close the observation. No timeout/test was changed or assertion waived.

## Invariants verified

- All protected entry bytes, historical evidence and dirty corrections are preserved; B1 is new-report-only. HEAD, branch, dependencies, package/contract/storage versions and public exports unchanged.
- Host attestation/grants, actor authorized commands, execution adapter effects and kernel canonical commit remain separate. Descriptor/schema/route/correlation data is not permission.
- Callable capture before claim and fresh v2 final check remain intact. Adapter-normalized results cannot author canonical correlation or install owner/authority. Existing success and throw stale-outcome fences remain exercised in shared suites.
- Legacy revision semantics/exclusive restart, opt-in coordinated generation/attempt semantics and optional v2 context are not merged or silently upgraded. Accepted inherited-member IDs remain supported.
- Actor framed delivery retains session AND per-send identity, full result/identity validation, exact pending-object cleanup, historical receipt semantics and explicit raw-wire compatibility limitation. No automatic retry/downgrade/multiplexing was introduced.
- Timeout/cancel/close/release/restart do not prove nonexecution; unknown effects require explicit human evidence reconciliation and eligible readmission. Result commit uncertainty causes retirement, not compensation. Pure replay invokes no adapter and remains semantic, not cryptographic remote-effect proof.
- JS ESM/FCIS and lazy built-in SQLite behavior remain compatible with the existing sole SigilJS dependency. No LLM/cloud/framework/arbitrary-shell surface or second state authority/runtime was added.

These are source traces plus the fresh bounded tests above, not a new formal proof or a redefinition of A4's OWN/ACT/STA/EFF/REC/REP identifiers. A4's original invariant meanings and acceptance limitations remain authoritative.

## Known limitations

- B1 installs no protocol, bridge, conformance suite, remote service, lifecycle timer/cancel/drain method or capability advertisement. Suggested behavior requires B2 specification and later implementation/testing gates.
- Trusted host/enrollment/human authentication, shared local clock, pinned regular-file database incarnation, SQLite/VFS/OS/device durability and no hostile same-user isolation remain accepted assumptions. Full host/admin/raw APIs remain privileged.
- External final-check/effect race, unseen higher downstream generation, unknown acknowledgement, no automatic remote fence advancement/staged-ack recovery/exactly-once remain. Optional context or advertised support cannot strengthen those claims by itself.
- Raw legacy actor peers lack corrected replacement correlation; module-local exact-channel WeakMap is not global exclusion across duplicated module instances or raw competing handlers. Framed budgets include wrapper overhead; unbounded timeout can remain pending on unattributable malformed responses.
- Whole-envelope synchronous validation/replay and bounded history/receipt growth remain; no performance, compaction, migration, power-cut, minimum-runtime or production deployment certification. B1 did not independently reopen every A4 proof database or rerun A4's controlled red/mutation extensions; historical evidence is preserved, not relabeled as fresh B1 work.
- A4's one unclassified startup/seam failure remains a reliability risk despite this green baseline. Scratch evidence may be pruned. Publication/legal/maintainer/final-artifact gates remain separate and unauthorized.

## Next-pass readiness

**Exact gate path: `docs/internal/053-interoperability-audit.md`. B1 COMPLETE; B2 READY for protocol design only.** No genuine blocker to that bounded design was encountered. Parent should read this report and preserve entry hashes before B2. Required B2 outputs are the minimal additive role/version/capability/request/session/outcome/lifecycle contract and compatibility/trust/error decisions identified above, not an alternate runtime or provider framework. Later implementation must remain kernel-owned, preserve legacy and optional fenced-context behavior, and test unknown-after-dispatch, timeout/cancel/shutdown and stale callbacks honestly. This B1 task stops here: no B2 implementation or automatic downstream pass was performed.
