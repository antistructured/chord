# Chord

> **Chord — Governed coordination for humans, AI agents, and services.**
> **Turn intent into governed execution.**

Chord is a JavaScript library for applications where a tool call is not enough: work needs
an accountable actor, exact permission, human approval when required, and a record of what
actually committed. Embed it in your application; keep your models, tools and UI.

**Start:** [one governed task](#6-runnable-quickstart) · [choose a workflow](docs/guides/README.md) ·
[public API reference](packages/core/README.md#entry-points).

**Status:** `@antistructured/chord@0.4.0-preview.1`, local preview candidate, not published to npm.
All APIs are experimental. Memory is the default; local SQLite restart, one-machine fenced-owner
coordination and provider-neutral adapter interop are opt-in. No multi-machine coordination,
sandboxing or exactly-once external effects. **License: [Apache-2.0](LICENSE).**

## Table of contents

1. [Chord: identity and value proposition](#1-chord-identity-and-value-proposition)
2. [Why coordination is harder than executing tasks](#2-why-coordination-is-harder-than-executing-tasks)
3. [What Chord does today](#3-what-chord-does-today)
4. [Core conceptual model](#4-core-conceptual-model)
5. [Architecture and responsibility boundaries](#5-architecture-and-responsibility-boundaries)
6. [Runnable quickstart](#6-runnable-quickstart)
7. [Complete canonical workflow](#7-complete-canonical-workflow)
8. [Supported guarantees](#8-supported-guarantees)
9. [Known limitations](#9-known-limitations)
10. [Project vision and staged roadmap](#10-project-vision-and-staged-roadmap)
11. [Project status, license, and contributions](#11-project-status-license-and-contributions)
12. [Installation and runtime setup](#12-installation-and-runtime-setup)
13. [Choosing a storage and coordination mode](#13-choosing-a-storage-and-coordination-mode)
14. [Actors and cross-process collaboration](#14-actors-and-cross-process-collaboration)
15. [Adapters and framework integration](#15-adapters-and-framework-integration)
16. [Conformance and verification](#16-conformance-and-verification)
17. [Developer workflow guides](#17-developer-workflow-guides)
18. [Public API and documentation map](#18-public-api-and-documentation-map)

---

## 1. Chord: identity and value proposition

Chord is an embeddable coordination kernel, distributed as a single JavaScript ES-module
package, that sits between an embedding host and the actors that act on the host's behalf.
A host installs an authoritative snapshot describing principals, actors, capabilities, grants
and approvals, submits intent as structured specs, and then lets Chord decide — deterministically
and without ambient trust — which actor may perform which exact task, at which moment, under
whose approval, and which externally-visible effects may be treated as committed. Every accepted
transition is recorded as a versioned committed fact, so a run can be reconstructed, diffed and
audited without re-running any provider.

| | |
|---|---|
| **Owns** | Admission, authorization, approval binding, attempt lifecycle, effect-truth uncertainty, committed-fact history, replay. |
| **Does not own** | The model, the effect, the identity provider, filesystem operations, the UI, the network. |
| **Is** | A library you embed — not a platform you log into, and not an agent framework. |
| **Is not** | Multi-machine/distributed consensus, federated, sandboxed, signed-evidence, or an identity provider. Local SQLite modes are opt-in; v2 actor channels require fresh host authentication. See [§9](#9-known-limitations). |

The three words in the positioning line each map to something that exists in the code:

| Word | What it means here | Where it lives |
|---|---|---|
| **intent** | A versioned, structured description of requested work. It is explicitly *not* permission to execute. | `packages/core/src/contracts/sigils.js#Intent`, `packages/core/src/sdk/chord.js#parseText` |
| **governed** | Every admission and every dispatch is decided by a deterministic evaluator against host-attested authority, exact scope, temporal validity and — where required — an exact, consumed, human approval. | `packages/core/src/platform/authorization.js#evaluateAuthority` |
| **execution** | Chord governs the admission, authorization, dispatch, commit, uncertainty and reconciliation of an execution. It does not own the effect. | `packages/core/src/platform/runtime-loop.js#runRuntimeCycle` |

---

## 2. Why coordination is harder than executing tasks

Making the call is the easy part. An agent can invoke a tool. What remains are four separate
questions, and none of them is answered by "the model produced a tool call":

1. **Who is allowed?** Not "which model" and not "which role string" — which *principal*, bound
   to which *actor*, holding which *capability*, under a currently valid grant. A role label is
   not authority, and a capability without a matching grant is not permission.
   (`packages/core/src/platform/authorization.js#evaluateAuthority`)
2. **Under which scope?** Not "roughly this task" — the *exact* stored scope: run, project,
   phase, task, target entity, and resource, compared field-by-field against immutable task
   fields. (`packages/core/src/platform/authorization.js#evaluateAuthority`)
3. **With whose approval?** Not "a human said yes somewhere" — an approval bound to an exact
   task revision, an exact attempt, and an exact scope, issued by an attested human principal
   who is not the requester, and consumed exactly once.
   (`packages/core/src/platform/authorization.js#evaluateAuthority`)
4. **What happens when the effect's outcome is unknown?** Not "retry until it works" — a
   dispatched effect whose outcome cannot be confirmed is quarantined, never blind-retried, and
   exits only through evidence-backed human reconciliation.
   (`packages/core/src/platform/recovery-policy.js#isRetryEligible`, `packages/core/src/platform/reconciliation.js#reconcileTask`)

| Pain | Mechanism | Evidence |
|---|---|---|
| "The agent did it, but I can't prove what it was allowed to do." | Authority is host-installed, revisioned and separate from the request payload. | `packages/core/src/platform/authorization.js#evaluateAuthority`; test *"request-authored authority fields, roles, and decisions confer nothing"* (`packages/core/tests/adversarial.test.js`) |
| "The human approved *a* request; the system ran *a different one*." | Approval binds to an exact attempt and is consumed. | `packages/core/src/platform/authorization.js#evaluateAuthority`; test *"an approval for a different attempt does not authorize dispatch"* (`packages/core/tests/adversarial.test.js`) |
| "The job crashed after the side effect. Now what?" | Post-dispatch ambiguity becomes `uncertain`, never a retry. | `packages/core/src/platform/recovery-policy.js#isRetryEligible`; test *"adapter throw after dispatch marks uncertain, never retries or dead-letters"* (`packages/core/tests/transitions.test.js`) |
| "The retry created a second charge." | Operation identity is structural; a new task ID cannot evade quarantine. | `packages/core/src/platform/reconciliation.js#operationSignature`; test *"RECOVERY: uncertainty cannot replay or evade quarantine with a new task ID"* (`packages/core/tests/recovery-integrity.test.js`) |
| "I can't tell what the system actually did." | History is committed facts, reducible back to canonical state with zero effects. | `packages/core/src/platform/trace-reducer.js#reduceTrace`; test *"REPLAY: committed admission/dispatch/result projection equals original with zero effects"* (`packages/core/tests/replay-integrity.test.js`) |
| "Adding governance means rewriting everything and adding a service." | One package, one runtime dependency, no infrastructure to run. | `packages/core/tests/architecture-integrity.test.js`; `packages/core/src/registry/owner.js#createStateOwner` |

The last row matters as much as the first five: governance that requires a service to adopt
does not get adopted inside an existing application.

---

## 3. What Chord does today

Maturity labels follow the product contract's classification: **Class A** — implemented and
verified by a named test; **Class B** — implemented, but experimental or trusted-host plumbing,
which must not be presented as a product capability; **Class C** — not implemented.

### 3.1 Class A — the implemented capability set

The product contract enumerates **45 Class A capabilities**
(`docs/internal/050-product-contract.md` (“3.2 Class A — implemented and verified (the Level A capability set)”)). The rows below group them into the areas
a reader needs; each cites the source and the named test that proves it.

| Area | What exists | Where | Proved by |
|---|---|---|---|
| Contracts and intent | Closed schemas for principals, actors, grants, approvals, specs, packets and results; size, depth and key limits; unknown fields are rejected, never discarded. | `packages/core/src/contracts/sigils.js#CONTRACT_LIMITS` | *"dangerous values and keys are rejected recursively"* (`tests/contracts.test.js`); *"strict specs, real/literal newline parsing and no discarded unknown fields"* (`tests/contracts.test.js`) |
| Deterministic authority evaluation | A pure evaluator with three stages — `admit`, `dispatch`, `commit`. No mutation, no I/O, no implicit clock. | `packages/core/src/platform/authorization.js#evaluateAuthority` | *"determinism: identical inputs give identical decisions"* (`tests/authorization.test.js`) |
| Host-owned authority and clock | The host installs a revisioned authority snapshot; revisions are monotonic; a backward clock fails closed. | `packages/core/src/sdk/chord.js#hostNow`, `packages/core/src/sdk/chord.js#setAuthoritySnapshot` | *"authority snapshot revisions are monotonic and clock rollback fails closed"* (`tests/authorization.test.js`) |
| Exact-scope grants | Capability alone is insufficient; scope is compared field-by-field against stored task fields; an active deny always beats an allow. | `packages/core/src/platform/authorization.js#evaluateAuthority` | *"exact scope mismatch across every field is denied"* (`tests/adversarial.test.js`); *"an active matching deny beats every allow regardless of array order"* (`tests/adversarial.test.js`) |
| Attempt-bound human approval | Approval must match the task revision, attempt and scope, must be unconsumed, and is consumed at dispatch and re-checked at commit. Self-approval is structurally impossible. | `packages/core/src/platform/authorization.js#evaluateAuthority` | *"approval_required dispatch needs an exact, unconsumed, matching approval"* (`tests/adversarial.test.js`); *"self-approval is structurally impossible"* (`tests/adversarial.test.js`) |
| Atomic admission | A batch is admitted or it is not; one denial registers no member and leaves no residue. | `packages/core/src/sdk/chord.js#queueTaskPackets`, `packages/core/src/sdk/chord.js#mutate` | *"batch admission is atomic: one denial registers no member"* (`tests/adversarial.test.js`) |
| Leased dispatch | Per-entity and global lease caps defer dispatch before any effect; queue selection is deterministic. | `packages/core/src/platform/runtime-loop.js#runRuntimeCycle`; `packages/core/src/platform/task-queue.js#selectReadyTask` | *"per-entity and global lease caps defer dispatch before any effect"* (`tests/transitions.test.js`); *"TARGET 5: Deterministic Dequeue"* (`tests/hardening.test.js`) |
| Commit-time re-authorization | After the adapter returns, authority is re-evaluated against the attempt's captured grants, approval and lease. A stale revision, an expired lease or replaced authority yields `uncertain` — never a guess. | `packages/core/src/platform/runtime-loop.js#runRuntimeCycle` | *"expired lease at commit marks uncertain"* (`tests/transitions.test.js`); *"authority replacement during await invalidates the in-flight attempt"* (`tests/transitions.test.js`) |
| Effect truth and quarantine | A malformed or fabricated adapter result never normalizes to success. Post-dispatch ambiguity quarantines the operation; ID churn cannot evade it. | `packages/core/src/platform/runtime-loop.js#runRuntimeCycle`; `packages/core/src/platform/reconciliation.js#operationSignature` | *"malformed adapter results never normalize to success or dead-letter"* (`tests/adversarial.test.js`); *"RECOVERY: uncertainty cannot replay or evade quarantine with a new task ID"* (`tests/recovery-integrity.test.js`) |
| Evidence-gated reconciliation | Leaving `uncertain` requires an attested human principal, current authority, and the evidence kind that matches the decision. | `packages/core/src/platform/reconciliation.js#reconcileTask` | *"RECOVERY: missing authority/evidence rejected unchanged"* (`tests/recovery-integrity.test.js`); *"RECOVERY: confirmed completion is never executed again"* (`tests/recovery-integrity.test.js`) |
| Bounded pre-dispatch retry | Transient routing failures retry under bounded backoff, then dead-letter. Dead-letter exits only through fresh admission. | `packages/core/src/platform/task-queue.js#scheduleTaskRetry` | *"TARGET 2: Dead-Letter Consistency (pre-dispatch exhaustion and fresh-admission replay)"* (`tests/hardening.test.js`) |
| Handoff and scoped context | Revision-guarded proposal/accept/reject between actors with correlation and causation; a bounded context projection discloses nothing to a grantless, expired, revoked or denied actor. | `packages/core/src/platform/handoff.js#proposeHandoff` | *"handoff proposal/accept with CAS and causation/correlation"* (`tests/continuity.test.js`); *"READ: grantless/expired/revoked/denied projections disclose no tasks or queue"* (`tests/admission-integrity.test.js`) |
| Run lifecycle | Pause, resume, reject and cancel, each revision-guarded; resume requires an attested human principal; a paused, failed or cancelled run dispatches nothing. | `packages/core/src/platform/approval-flow.js#pauseForApproval`; `packages/core/src/sdk/chord.js#resumeRun` | *"LIFECYCLE: resume requires an active host-authenticated human"* (`tests/lifecycle-integrity.test.js`); *"pause/resume/cancel flow with CAS"* (`tests/continuity.test.js`) |
| Private canonical state | One private owner; clone → validate → atomic install; a rejected candidate changes no collection and no event; reads are detached clones. | `packages/core/src/registry/owner.js#createStateOwner`; `packages/core/src/sdk/chord.js#read` | *"STATE-03/05: rejected compound candidate changes no collection or event"* (`tests/integrity.test.js`); *"STATE-04: reads and retained inputs cannot change canonical state"* (`tests/integrity.test.js`) |
| Committed-fact history and replay | Every accepted mutation appends a versioned commit with a computed state delta; the history reduces back to canonical state with zero effects; incomplete, foreign or duplicate history is refused. | `packages/core/src/registry/owner.js#createStateOwner`; `packages/core/src/platform/trace-reducer.js#reduceTrace` | *"REPLAY: committed admission/dispatch/result projection equals original with zero effects"* (`tests/replay-integrity.test.js`); *"REPLAY: changed content/order, missing middle/tail, duplicate/mixed-run/version records reject"* (`tests/replay-integrity.test.js`) |
| Snapshot, restore and quarantine | A validated snapshot export/import; imported in-flight work is quarantined, never executable. | `packages/core/src/registry/snapshot.js#exportRegistry` | *"snapshot validates version, counts, nested records, clones and reconciles in-flight import"* (`tests/contracts.test.js`) |
| Journal, audit and provider-neutral adapters | A structured audit report, a journal view with extended correlation fields, and exact → prefix → default → fallback adapter routing. | `packages/core/src/platform/journal-audit.js#createDeterministicAuditReport`; `packages/core/src/platform/event-journal.js#appendRegistryEvent`; `packages/core/src/platform/adapter-routing.js#resolveAdapter`; `packages/core/src/contracts/sigils.js#AdapterResult` | *"event journal includes extended fields"* (`tests/fault-injection.test.js`); *"ARCH-18: first-party JS/ESM kernel has only SigilJS runtime dependency and no provider/framework imports"* (`tests/architecture-integrity.test.js`) |
| Host shaping helpers | `chord.createTaskGrant(packet, opts)` and `chord.createApproval(opts)` derive the run id, the exact scope and the attempt binding, and validate the result against the contract. | `packages/core/src/sdk/chord.js#createTaskGrant`, `packages/core/src/sdk/chord.js#createApproval` | *"API-REVIEW: createTaskGrant installs nothing and never authorizes on its own"* (`tests/developer-api-review.test.js`); *"API-REVIEW: createApproval cannot mint an approval for the requesting principal or a non-human approver"* (`tests/developer-api-review.test.js`) |

### 3.2 Class B — implemented, experimental, or trusted-host plumbing

These exist and work. They are **not** product capabilities and are not marketed as such.

| Item | Qualifier |
|---|---|
| `chord.commitRun(args)` | Generic trusted-host compare-and-swap. It **replaces** admission; use the dedicated SDK operations for admission and lifecycle instead. |
| `chord.setAuthoritySnapshot(...)`, `chord.prepareAttempt(...)` | Host administration, not an actor authentication endpoint. |
| `chord.queryArtifacts`, `queryDomains`, `queryDeadLetters`, `inspectAudit`, `inspectEvents`, `exportRegistry`, `serializeRegistry` | Full inspection is **not** scope-filtered. Host-only; never forward to an untrusted caller. |
| `chord.projectContext(...)` | A scoped, grant-filtered **view** — not an authentication service, and not content redaction. |
| The `/platform` entry point | The same unguarded data API, importable separately. Trusted-host plumbing. |
| `chord.replayJournal(...)`, `createDeterministicAuditReport(...)` | Diagnostic views. The authoritative reconstruction is `reduceTrace` / `replayNoSideEffects`. |
| The CLI scripts (`chord:run`, `chord:replay`, `chord:audit`) and `demo:via` | Experimental developer surface. Not installed binaries. |
| `src/runtime/adapter.js` text I/O helpers | Present in the shipped payload but **not** wired into the kernel. Not persistence. |
| Local SQLite storage and sequential restart | Experimental host-only `createChord({ storage: { path, mode } })` and root `openSqliteStore`; WAL/FULL, authoritative CAS and effect-free recovery. One active runtime, host-enforced stop/join before recovery; no distributed coordinator. See [the guide](packages/core/README.md#memory-and-durable-modes). |
| Local fenced owner and multiprocess actor commands (052) | Separate root `createCoordinatedChord`, `openCoordinatedSqliteStore`, `createActorIngress`, `createActorClient`; explicit acquire/renew/release, one fixed-generation owner, atomic quarantine/receipts and linked replay. Host-enrolled dedicated JSON IPC, seven scoped commands. Single machine/trusted shared clock only; downstream fencing/idempotency still required for stale external effects. See [the API/proof guide](packages/core/README.md#052-local-fenced-owner-and-actor-mode). |

### 3.3 Class C — not implemented

Multiple simultaneously valid execution owners, multi-machine distributed CAS/coordinator protocols, multi-host coordination, cross-organization trust federation, signed evidence, a hostile-adapter
sandbox, a network surface for remote actors, a multi-tenant service, provider SDK breadth,
autonomous agent swarms without human approval, and an operator console **do not exist in this
repository**. See [§10](#10-project-vision-and-staged-roadmap).

---

## 4. Core conceptual model

These are the terms the code actually uses. Each is defined by the cited source, not by a
marketing vocabulary.

| Term | Definition as the code defines it | Defined at |
|---|---|---|
| **Run** | The canonical coordination scope: a `run_id`, a contract `schema_version` and a monotonically advancing `revision`. | `packages/core/src/contracts/sigils.js#Run`; owned at `packages/core/src/registry/owner.js#createStateOwner` |
| **Intent spec** | A versioned, structured description of requested work (`IntentSpec`, `CoordSpec`, `HandoffSpec`). Parsed from text or supplied as an object. It is not permission. | `packages/core/src/contracts/sigils.js#assertSpec`; parsed at `packages/core/src/sdk/chord.js#parseText` |
| **Task packet** | The immutable unit of admitted work derived from a spec: `task_id`, `task_kind`, source spec, project, phase, target entity, role, stance, requested actions, inputs and constraints. | `packages/core/src/contracts/sigils.js#TaskPacket`; built at `packages/core/src/execution/task-packets.js#createIntentTaskPacket` |
| **Authority snapshot** | The host-installed, revisioned record of principals, actors, grants and approvals for one run. | `packages/core/src/sdk/chord.js#setAuthoritySnapshot`; contract at `packages/core/src/contracts/sigils.js#AuthoritySnapshot` |
| **Principal** | An identity authenticated by the embedding host: `principal_id`, `issuer`, `kind` (`human` or `service`), and an authentication window. | `packages/core/src/contracts/sigils.js#Principal` |
| **Actor** | A host-registered execution identity bound to a principal, carrying `capabilities` and optional `roles`. Roles confer nothing. | `packages/core/src/contracts/sigils.js#Actor`; enforced at `packages/core/src/platform/authorization.js#evaluateAuthority` |
| **Grant** | A host-issued `allow`/`deny` for a principal, actor and capability, bound to an exact scope, with `issued_at`/`expires_at`/`revoked_at` and a `requires_approval` flag. | `packages/core/src/contracts/sigils.js#Grant`; matched at `packages/core/src/platform/authorization.js#evaluateAuthority` |
| **Grant scope** | The exact tuple `run_id`, `project`, `phase`, `task_id`, `target_entity`, `resource{kind,id}`. Equality is field-by-field against the stored task. | `packages/core/src/contracts/sigils.js#Scope`; compared at `packages/core/src/platform/authorization.js#evaluateAuthority` |
| **Approval** | A host-attested human decision for an exact task, task revision, attempt, principal, actor, capability and scope, with a `consumed_by_attempt_id` field. | `packages/core/src/contracts/sigils.js#Approval` |
| **Approval binding** | The rule that an approval only counts if it matches the task revision, principal, actor, capability and scope, is currently active, is unconsumed, and names the dispatch attempt. It is consumed at dispatch and re-verified at commit. | `packages/core/src/platform/authorization.js#evaluateAuthority`; consumed at `packages/core/src/platform/runtime-loop.js#runRuntimeCycle` |
| **Attempt** | A kernel-owned execution reservation: `attempt_id`, `queue_id`, task revision, lease expiry, the authority revision captured at dispatch, the selected `grant_ids` and the selected `approval_id`. Single-use. | `packages/core/src/contracts/sigils.js#Attempt`; reserved at `packages/core/src/platform/attempts.js#prepareAttemptRecord` |
| **Dispatch / Commit** | Dispatch selects a ready task, respects lease caps, prepares the attempt, evaluates authority at the `dispatch` stage, and only then invokes the adapter. Commit re-evaluates authority at the `commit` stage against the attempt's captured grants, approval and lease, then ingests the result; failure marks the task `uncertain` instead of guessing. | `packages/core/src/platform/runtime-loop.js#runRuntimeCycle` |
| **Task lifecycle** | A guarded state machine: `queued → leased → running → completed \| failed \| blocked \| uncertain \| cancelled`, plus `dead_letter` as the bounded pre-dispatch retry sink. `uncertain` is only left through explicit host reconciliation. | `packages/core/src/platform/transitions.js#markTaskUncertain` |
| **Operation** | The structural identity of the external effect a task represents, keyed by a signature computed from the packet with volatile fields removed. It is what quarantine is anchored to. | `packages/core/src/platform/reconciliation.js#operationSignature`; record at `packages/core/src/contracts/sigils.js#OperationRecord` |
| **Event journal** | The append-only record of every accepted transition, plus committed-fact commits carrying a computed state delta. | `packages/core/src/platform/event-journal.js#appendRegistryEvent`; commit capture at `packages/core/src/registry/owner.js#createStateOwner` |
| **Reconciliation** | The evidence-backed, human-attested exit from `uncertain`: `confirmed_completed`, `confirmed_not_executed`, `authorized_compensated` or `still_unknown`, each requiring a specific evidence kind. | `packages/core/src/platform/reconciliation.js#reconcileTask`; evidence shape at `packages/core/src/contracts/sigils.js#ReconciliationRequest` |
| **Replay** | A **pure projection** from committed facts back into canonical state, invoking no adapter. It is not re-execution and does not reproduce a model response. | `packages/core/src/platform/trace-reducer.js#reduceTrace` |
| **Trust boundary** | The line between the **trusted host** — which owns identity, the clock, credentials and persistence — and the **actors**, which are identities in the authority snapshot. One structural mitigation exists: an adapter receives only the frozen task packet and a correlation context, never a registry or authority handle. | seam at `packages/core/src/sdk/chord.js#hostNow`; adapter boundary at `packages/core/src/platform/runtime-loop.js#runRuntimeCycle`; test *"no registry or authority write handle leaks to adapters"* (`packages/core/tests/adversarial.test.js`) |

---

## 5. Architecture and responsibility boundaries

### 5.1 Functional core / imperative shell

| Layer | Modules | Property |
|---|---|---|
| Contracts (pure) | `src/contracts/sigils.js` | Asserts and validates plain data. Clones inputs, never mutates the caller's objects, never evaluates accessors. |
| Authority evaluation (pure) | `src/platform/authorization.js` | Deterministic. No mutation, no logging, no I/O, no randomness, no implicit time. Decisions are sanitized plain data, not transferable tokens (not necessarily frozen). |
| History and projection (pure) | `src/platform/history.js`, `src/platform/trace-reducer.js` | Pure functions over committed facts. `reduceTrace` consumes committed facts only — no clocks, no adapters, no executables. |
| Guarded state machines | `src/platform/transitions.js` | The edge tables are pure; the setters mutate the registry and reject illegal edges. |
| Task and result shaping | `src/execution/task-packets.js`, `src/execution/results.js` | Builds and validates task packets, then freezes the packet before invocation (`src/execution/task-packets.js#prepareTaskExecution`); `results.js` registers admitted packets and ingested results into the registry. |
| **State ownership (mutating)** | `src/registry/owner.js` | The private single-process owner. Clone → validate → atomic install. A rejected candidate changes nothing. |
| **SDK shell (mutating)** | `src/sdk/chord.js` | The host API. Canonical-state mutations are revision-guarded and journaled; router/policy setters change host configuration only. |
| **Legacy runtime loop (mutating + effect)** | `src/platform/runtime-loop.js#runRuntimeCycle` | Legacy governed dispatch, commit, and `uncertain` marking; direct trusted-host adapter calls are not governed by it. |
| **Coordinated v2 shell / pure protocol** | `src/sdk/coordinated-chord.js#createCoordinatedChord`, `src/coordination/`, `src/runtime/storage/coordinated-sqlite.js#openCoordinatedSqliteStore` | Separate owner/admin/observer/actor ports, fenced transactions, final pre-call read, immutable per-attempt capture and combined replay. No legacy recovery-before-acquire. |

The rule the code enforces: **the pure layers decide, the shell commits.** An authority decision
is never carried as a token from one stage to another; the runtime recomputes it from live
state at every stage (`packages/core/src/platform/authorization.js#evaluateAuthority`).

### 5.2 The trust boundary

The **trusted host** is the embedding application. It owns identity, the clock, credentials and
persistence. For the legacy factory, the host supplies authority and the `trustedHost.now` clock seam
(`packages/core/src/sdk/chord.js#hostNow`). The **actors** are identities inside that snapshot;
an actor is a string id bound to a principal, and its authority comes from grants, not from the
actor's own request.

**What the boundary is, concretely:**

- A request payload cannot confer authority. Fields in a request are not read as principals,
  actors, grants or decisions (`packages/core/tests/adversarial.test.js`).
- An adapter cannot self-grant. It receives a frozen packet and a correlation context — no
  registry handle, no authority handle (`packages/core/src/platform/runtime-loop.js#runRuntimeCycle`).
- The authority snapshot is revisioned and monotonic; a snapshot swap cannot roll the
  authority revision back through this dedicated API (`packages/core/src/sdk/chord.js#setAuthoritySnapshot`); privileged `commitRun` can bypass that guard and must remain host-only.
- A host cannot rewrite history. `commitRun` requires the candidate journal to be identical to
  the committed journal (`packages/core/src/registry/owner.js#createStateOwner`).

**What the boundary is not:** Chord does not sandbox adapters (they are trusted in-process host
code), does not authenticate principals (it verifies the attestation the host hands it —
`packages/core/src/platform/authorization.js#evaluateAuthority`), does not provide exactly-once effects (it
distinguishes *requested*, *dispatched* and *confirmed*; a dispatched effect cannot be undone by
cancellation — `packages/core/src/platform/recovery-policy.js#isRetryEligible`), and does not
authenticate the handoff protocol (`proposeHandoff`/`respondToHandoff` correlate; the `actor_id`
on a response is asserted by the caller — `packages/core/src/platform/handoff.js#respondToHandoff`).
That last restriction describes the **legacy host helper**: separate v2 actor handoff commands
derive identity from freshly host-enrolled channels and recheck current grants/policy. They are
not a remote login service or a sandbox. V2 uses `trustedHost.clock.now()` and a pinned
`(run_id,incarnation_id)`, not legacy `trustedHost.now`; never expose admin/store handles to actors.

### 5.3 Non-negotiable standards the codebase upholds

Each of these is enforced in code and pinned by a named test:

1. **Fail closed.** No authority, no permission — every stage denies.
   (`packages/core/src/platform/authorization.js#evaluateAuthority`; *"missing host authority denies every stage"*, `packages/core/tests/adversarial.test.js`)
2. **Pure, deterministic evaluation.** Identical inputs and `now` give identical decisions.
   (`packages/core/src/platform/authorization.js#evaluateAuthority`; *"determinism: identical inputs give identical decisions"*, `packages/core/tests/authorization.test.js`)
3. **Atomic state installation.** A rejected candidate changes no collection and no event.
   (`packages/core/src/registry/owner.js#createStateOwner`; *"STATE-03/05: rejected compound candidate changes no collection or event"*, `packages/core/tests/integrity.test.js`)
4. **Detached reads.** Returned state is a deep clone; retained inputs cannot mutate canonical state.
   (`packages/core/src/sdk/chord.js#read`; *"STATE-04: reads and retained inputs cannot change canonical state"*, `packages/core/tests/integrity.test.js`)
5. **History is append-only.** A host cannot append fabricated kernel history.
   (`packages/core/src/registry/owner.js#createStateOwner`; *"STATE: host candidates cannot append fabricated kernel history"*, `packages/core/tests/integrity.test.js`)
6. **No reentrancy.** A host callback that re-enters the kernel fails before install or effect.
   (`packages/core/src/registry/owner.js#createStateOwner`; *"LIFECYCLE: executable accessor cannot cancel after claim then execute anyway"*, `packages/core/tests/lifecycle-integrity.test.js`)
7. **One runtime dependency, no provider coupling.**
   (`packages/core/src/contracts/sigils.js#SCHEMA_VERSION`; *"ARCH-18: ..."*, `packages/core/tests/architecture-integrity.test.js`)

---

## 6. Runnable quickstart

> **Use the local candidate.** There is no supported registry install or release date.
> These commands assume Bun is installed; [setup and local consumer installation](docs/guides/README.md)
> also cover Node and fresh private projects.

```bash
cd packages/core
bun install --frozen-lockfile
bun run examples/quickstart.mjs
```

For another project, follow the [local tarball installation commands](docs/guides/README.md#local-consumer-installation).
The only runtime dependency is `@weipertda/sigiljs@0.18.0`; it is installed separately, not bundled.

The quickstart below is the shipped example, verbatim — `packages/core/examples/quickstart.mjs`.
It grants one mock actor permission to *draft* a support response, not to send it.

```js
import { createChord, SCHEMA_VERSION } from '@antistructured/chord';

// Trusted host setup, not actor/model-provided credentials or grants.
const chord = createChord();
const run_id = chord.getRegistry().run.run_id;
const expires_at = Date.now() + 60_000;
chord.setAuthoritySnapshot({
  schema_version: SCHEMA_VERSION, run_id, authority_revision: 0,
  principals: [{ principal_id: 'host-user', issuer: 'example-host', kind: 'service',
    authenticated_at: 0, expires_at }],
  actors: [{ actor_id: 'writer', principal_id: 'host-user', kind: 'agent',
    roles: [], capabilities: ['draft'], revoked_at: null }],
  grants: [], approvals: []
});
let calls = 0;
chord.setAdapterRouter({ fallback: { execute() {
  calls++;
  return { status: 'completed', outcome: 'succeeded',
    outputs: { draft: 'Your support request is ready for review.' } };
} } });
const { packets } = chord.registerSpecAndQueue({
  schema_version: SCHEMA_VERSION, spec_type: 'IntentSpec',
  project: 'support', phase: 'draft', do: ['draft-response']
}, {
  principal_id: 'host-user', actor_id: 'writer', capability: 'draft',
  // createTaskGrant derives the exact task scope from the packet. It shapes a
  // grant only: nothing is installed and nothing is authorized by shaping one.
  issueGrants: packets => packets.map(packet => chord.createTaskGrant(packet, {
    principal_id: 'host-user', actor_id: 'writer', capability: 'draft', expires_at
  }))
});
const result = await chord.runCycle();
if (!result.ok || calls !== 1 || chord.getRegistry().tasks[packets[0].task_id].status !== 'completed') {
  throw new Error('Governed draft did not complete');
}
console.log({ completed: result.ok, adapterCalls: calls });
// This mock drafts data only. It does not send a message or prove an external effect.
```

Expected output:

```text
{ completed: true, adapterCalls: 1 }
```

Inside `packages/core`, the bare specifier `@antistructured/chord` resolves through the package's
own `exports` map. If you copy the file elsewhere, keep the package installed under that name
as shown in the local consumer guide. Do not rely on private source subpaths.

---

## 7. Complete canonical workflow

The full governed path — human intent → actor execution → handoff → protected action →
approval → safe completion → replay — is shipped as
`packages/core/examples/cross-actor-workflow.mjs` and is asserted end to end by
`packages/core/tests/canonical-example.test.js` (*"cross-session workflow with approval and
replay"*).

| # | Step | API call | What it guarantees | Evidence |
|---|---|---|---|---|
| 1 | Host installs identity | `chord.setAuthoritySnapshot(snapshot)` | The dedicated snapshot API requires monotonic authority revisions; callers must be trusted host code (there is no host-authentication guard). | `packages/core/src/sdk/chord.js#setAuthoritySnapshot` |
| 2 | Human intent becomes work | `chord.registerSpecAndQueue(spec, opts)` | The spec is validated, converted to task packets, and admitted atomically — or not at all. | `packages/core/src/sdk/chord.js#registerSpecAndQueue`, `packages/core/src/sdk/chord.js#queueTaskPackets`; `packages/core/src/execution/task-packets.js#createIntentTaskPacket` |
| 3 | Host issues the grant | `issueGrants: packets => packets.map(p => chord.createTaskGrant(p, {...}))` | The grant is scoped to the exact task. Shaping a grant grants nothing; it still has to be installed. | `packages/core/src/sdk/chord.js#createTaskGrant`; `packages/core/tests/developer-api-review.test.js` |
| 4 | Actor executes | `await chord.runCycle()` | Dispatch re-evaluates authority at the `dispatch` stage, consumes the lease, and invokes the adapter only if allowed. | `packages/core/src/platform/runtime-loop.js#runRuntimeCycle` |
| 5 | Work is handed over | `chord.proposeHandoff(...)` / `chord.respondToHandoff(...)` | Revision-guarded proposal and accept, with correlation and causation recorded. | `packages/core/src/platform/handoff.js#proposeHandoff` |
| 6 | Protected action is queued | `chord.registerSpecAndQueue(spec, {approval_required: true})` | Admission still succeeds — permission to queue is not permission to act. | `packages/core/src/platform/authorization.js#evaluateAuthority` |
| 7 | Dispatch is refused | `await chord.runCycle()` → `{ ok: false, code: 'APPROVAL_REQUIRED' }` | Zero adapter calls. The approval gate is enforced by the runtime, not by the caller. | `packages/core/src/platform/authorization.js#evaluateAuthority`; `packages/core/tests/authorization.test.js` |
| 8 | Actor sees its scope | `chord.projectContext({actor_id, principal_id})` | The projection contains only what active grants cover; a grantless actor sees nothing. | `packages/core/src/platform/handoff.js#projectContext`; `packages/core/tests/admission-integrity.test.js` |
| 9 | Run is paused and snapshotted | `chord.prepareAttempt(taskId)`, `chord.pauseForApproval(...)`, `chord.exportRegistry()` | A paused run dispatches nothing. The snapshot validates and clones. | `packages/core/src/platform/approval-flow.js#pauseForApproval`; `packages/core/src/registry/snapshot.js#exportRegistry` |
| 10 | State is restored | `createChord({ registry: importRegistry(snapshot) })` | Import quarantines in-flight work as `uncertain`; it is never silently executable. | `packages/core/src/registry/snapshot.js#importRegistry` |
| 11 | Human approves | `chord.createApproval({task_id, attempt_id, approver_principal_id})` then `chord.setAuthoritySnapshot(...)` | The approval is bound to the exact attempt and scope. `createApproval` refuses to mint an approval for the requesting principal. | `packages/core/src/sdk/chord.js#createApproval`; `packages/core/tests/developer-api-review.test.js` |
| 12 | Run resumes, effect runs | `chord.resumeRun({principal_id: 'human', approval_id})` then `await chord.runCycle()` | Resume requires an attested human principal who differs from the requester; the approval is then consumed exactly once, at dispatch. | `packages/core/src/sdk/chord.js#resumeRun`; `packages/core/src/platform/runtime-loop.js#runRuntimeCycle`; `packages/core/tests/lifecycle-integrity.test.js`; `packages/core/tests/adversarial.test.js` |
| 13 | Result commits | commit-stage re-authorization | A stale revision, an expired lease or replaced authority would mark the task `uncertain` instead of committing. | `packages/core/src/platform/runtime-loop.js#runRuntimeCycle` |
| 14 | Run is replayed | `replayNoSideEffects(chord.inspectEvents())` | A pure projection of committed facts: `effects_invoked: 0`, and the projected state equals the live state. | `packages/core/src/platform/trace-reducer.js#replayNoSideEffects`; `packages/core/tests/replay-integrity.test.js` |

The complete script — this is `packages/core/examples/cross-actor-workflow.mjs`, verbatim:

```js
#!/usr/bin/env node
// Canonical governed workflow: two mock actors, one human approver, one
// protected effect, a snapshot/restore boundary, and a zero-effect replay.
//
// This is ONE host process with SEPARATE ACTOR IDENTITIES. It is not a
// demonstration of distributed workers. Every identity below is attested by
// the embedding host; neither model output nor actor request data installs
// authority.
import { createChord, importRegistry, replayNoSideEffects, canonicalProjection, SCHEMA_VERSION } from '@antistructured/chord';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export async function runCanonicalWorkflow() {
  let builderEffects = 0;
  let protectedEffects = 0;
  const chord = createChord();
  const run_id = chord.getRegistry().run.run_id;

  // 1. Host installs identity. Chord verifies the attestation it is handed;
  //    it does not authenticate anyone.
  const principal = (id, kind) => ({
    principal_id: id, issuer: 'example-host', kind,
    authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER
  });
  const actor = id => ({
    actor_id: id, principal_id: id, kind: 'agent',
    roles: [], capabilities: ['execute'], revoked_at: null
  });
  chord.setAuthoritySnapshot({
    schema_version: SCHEMA_VERSION, run_id, authority_revision: 0,
    principals: [principal('builder', 'service'), principal('reviewer', 'service'), principal('human', 'human')],
    actors: [actor('builder'), actor('reviewer')], grants: [], approvals: []
  });

  // 2. Host helpers shape grants and approvals. They shape data only: a grant
  //    still has to be installed, and an approval still has to be installed.
  const queueFor = (actor_id, requires_approval) => ({
    principal_id: actor_id, actor_id, capability: 'execute',
    approval_required: requires_approval,
    issueGrants: packets => packets.map(packet => chord.createTaskGrant(packet, {
      principal_id: actor_id, actor_id, capability: 'execute', requires_approval
    }))
  });
  const spec = action => ({
    schema_version: SCHEMA_VERSION, spec_type: 'IntentSpec',
    project: 'canonical', phase: 'review', do: [action]
  });
  const completed = () => ({ status: 'completed', outcome: 'succeeded' });

  // 3. Builder performs ordinary work. One cycle, one adapter invocation.
  chord.setAdapterRouter({ fallback: { execute() { builderEffects++; return completed(); } } });
  chord.registerSpecAndQueue(spec('build-review-material'), queueFor('builder', false));
  if (!(await chord.runCycle()).ok) throw new Error('BUILDER_DID_NOT_COMMIT');

  // 4. Handoff: revision-guarded proposal, then an accept by the target actor.
  const handoff = chord.proposeHandoff({
    from_actor_id: 'builder', to_actor_id: 'reviewer',
    expectedRevision: chord.getRunRevision(), correlation_id: 'canonical-review'
  });
  chord.respondToHandoff({
    handoff_id: handoff.handoff_id, actor_id: 'reviewer', action: 'accept',
    expectedRevision: chord.getRunRevision()
  });

  // 5. Protected action: admitted, but dispatch is denied without an approval.
  const { packets } = chord.registerSpecAndQueue(spec('publish-protected'), queueFor('reviewer', true));
  const taskId = packets[0].task_id;
  chord.setAdapterRouter({ fallback: { execute() { protectedEffects++; return completed(); } } });
  const missing = await chord.runCycle();
  if (missing.code !== 'APPROVAL_REQUIRED' || protectedEffects !== 0) throw new Error('MISSING_APPROVAL_EXECUTED');

  // 6. Scoped context: the reviewer sees only what its active grants cover.
  const context = chord.projectContext({ principal_id: 'reviewer', actor_id: 'reviewer' });
  if (!context.tasks.some(t => t.task_id === taskId)) throw new Error('REVIEW_CONTEXT_MISSING');

  // 7. Pause the run, snapshot it, restore it into a second SDK instance.
  const attempt = chord.prepareAttempt(taskId);
  chord.pauseForApproval({ reason: 'protected-publish', expectedRevision: chord.getRunRevision() });
  if ((await chord.runCycle()).code !== 'RUN_NOT_ACTIVE' || protectedEffects !== 0) throw new Error('PAUSE_BYPASSED');
  const snapshot = chord.exportRegistry();
  const restored = createChord({ registry: importRegistry(snapshot) });

  // 8. Human approval: bound to the exact attempt, installed by the host.
  const approval = restored.createApproval({
    task_id: taskId, attempt_id: attempt.attempt_id, approver_principal_id: 'human'
  });
  const authority = restored.getAuthority();
  authority.authority_revision += 1;
  authority.approvals.push(approval);
  restored.setAuthoritySnapshot(authority, { expectedRevision: restored.getRunRevision() });
  restored.resumeRun({ principal_id: 'human', approval_id: approval.approval_id, expectedRevision: restored.getRunRevision() });

  // 9. Dispatch the protected effect: approved, then consumed exactly once.
  restored.setAdapterRouter({ fallback: { execute() { protectedEffects++; return completed(); } } });
  const result = await restored.runCycle();
  if (!result.ok) throw new Error('PROTECTED_RESULT_NOT_COMMITTED');

  // 10. Replay: a pure projection of committed facts, with zero effects.
  const state = restored.getRegistry();
  const beforeReplay = protectedEffects;
  const replay = replayNoSideEffects(restored.inspectEvents());
  const same = isDeepStrictEqual(canonicalProjection(replay.projected), canonicalProjection(state));
  const consumed = restored.getAuthority().approvals
    .find(a => a.approval_id === approval.approval_id)?.consumed_by_attempt_id === attempt.attempt_id;

  const summary = {
    run_id,
    actors: ['builder', 'reviewer', 'human'],
    accepted_handoff: state.handoffs[handoff.handoff_id].status === 'accepted',
    approval_required: missing.code === 'APPROVAL_REQUIRED',
    approval_validated: result.ok && consumed,
    approval_consumed: consumed,
    snapshot_restored: snapshot.registry.run.run_id === state.run.run_id && snapshot.registry.run.state === 'paused',
    final_task_status: state.tasks[taskId].status,
    final_run_revision: state.run.revision,
    effect_dispatch_count: protectedEffects,
    builder_effect_count: builderEffects,
    trace_event_count: state.event_journal.length,
    negative_effect_count: 0,
    replay_verified: same && beforeReplay === protectedEffects && replay.effects_invoked === 0
  };
  if (!summary.accepted_handoff || !summary.approval_consumed || !summary.snapshot_restored ||
      summary.final_task_status !== 'completed' || protectedEffects !== 1 || !summary.replay_verified) {
    throw new Error('WORKFLOW_INVARIANT_FAILED');
  }
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCanonicalWorkflow()
    .then(summary => console.log(JSON.stringify(summary)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
```

Run it with `bun run examples/cross-actor-workflow.mjs` from `packages/core`.

---

## 8. Supported guarantees

Source references using `#function` are searchable module/function locators, not generated HTML anchors.
The long capability tables and inline canonical examples are retained; historical 050 reports
remain historical evidence, superseded for bounded local durability by 051 and for the separate
local fenced-owner/actor mode by 052 P2 plus P3–P5 addenda and P6/P7 proofs. Earlier 052 reports
describe their stage, not current unsupported branches. Current evidence is indexed in
[§16](#16-conformance-and-verification); final Pass 9 remains pending.
The tables and canonical workflow below retain the legacy SDK contract; v2's narrower facade, stable in-flight attempt checks and
zero-write stale-owner/attempt rejection are documented separately in the local coordination guide.

Every guarantee below is enforced in code and pinned by a named test in `packages/core/tests/`.
Block 054 Pass 3 reverification recorded **448 pass / 0 fail / 1777 `expect()` calls / 31 files**
([measured report](docs/internal/054-adapter-conformance-reverification.md), not committed HEAD or a release certification).
Block 052 P8 historically measured **356 pass / 0 fail / 26 files**,
plus coordinated shared **81**, legacy durable shared **82** and safety **21** on each of Node/Bun.
The full historical suite is Bun-native, not a full Node suite. Block 051 historically measured **275 pass / 0 fail / 21 files**.
Block 050 historically measured **166 pass / 0 fail / 1418 `expect()` calls / 15 files**;
`bun run src/verify-runtime.js` exits 0.

| Guarantee | Test that proves it |
|---|---|
| The authority evaluator is deterministic and fails closed | *"determinism: identical inputs give identical decisions"* (`authorization.test.js`); *"fixed failure order, first failure wins"* |
| Request-authored authority, roles and decisions confer nothing | *"request-authored authority fields, roles, and decisions confer nothing"* (`adversarial.test.js`); *"role strings never substitute for capabilities"* |
| Capability alone is denied; a matching allow grant is required | *"capability alone without a grant is denied"* (`adversarial.test.js`) |
| Actor↔principal binding is enforced | *"cross-principal actor binding is rejected"* (`adversarial.test.js`) |
| Grant scope must equal the stored task fields exactly | *"exact scope mismatch across every field is denied"* (`adversarial.test.js`) |
| An active deny always beats an allow, whatever the array order | *"an active matching deny beats every allow regardless of array order"* (`adversarial.test.js`) |
| Validity windows are exact; revocation takes effect immediately | *"grant expiry uses issued_at <= now < expires_at at exact boundaries"* (`adversarial.test.js`); *"principal and actor revocation disable access immediately"* |
| Dispatch requires an exact, unconsumed, matching approval | *"approval_required dispatch needs an exact, unconsumed, matching approval"* (`adversarial.test.js`); *"approval-required task never reaches the adapter without a human approval"* (`authorization.test.js`) |
| Commit requires the dispatch-selected approval, consumed by that attempt | *"commit requires the dispatch-selected approval consumed by this attempt"* (`adversarial.test.js`) |
| An explicit rejection beats a present approval; self-approval is impossible | *"explicit rejection wins over a present approval and blocks dispatch"* (`adversarial.test.js`); *"self-approval is structurally impossible"* |
| Authorization decisions are sanitized data, not transferable tokens | *"evaluator decisions are sanitized fixed data, never transferable tokens"* (`adversarial.test.js`) |
| The host owns the clock; rollback fails closed; revisions are monotonic | *"authority snapshot revisions are monotonic and clock rollback fails closed"* (`authorization.test.js`) |
| Unauthorized dispatch invokes zero adapters | *"unauthorized dispatch invokes zero adapters and leaves the task queued"* (`authorization.test.js`) |
| Admission is atomic; lease caps defer dispatch before any effect | *"batch admission is atomic: one denial registers no member"* (`adversarial.test.js`); *"per-entity and global lease caps defer dispatch before any effect"* (`transitions.test.js`) |
| Commit-time re-authorization turns staleness into `uncertain`, not a guess | *"expired lease at commit marks uncertain"* (`transitions.test.js`); *"authority replacement during await invalidates the in-flight attempt"* |
| Post-dispatch ambiguity is never retried or dead-lettered | *"adapter throw after dispatch marks uncertain, never retries or dead-letters"* (`transitions.test.js`) |
| Malformed adapter results never normalize to success | *"malformed adapter results never normalize to success or dead-letter"* (`adversarial.test.js`) |
| Cancellation wins over a late adapter result | *"cancelTask wins over an in-flight success and drops the late result"* (`packages/core/tests/transitions.test.js`) |
| Quarantine cannot be evaded with a new task ID | *"RECOVERY: uncertainty cannot replay or evade quarantine with a new task ID"* (`recovery-integrity.test.js`) |
| Reconciliation needs authority and matching evidence | *"RECOVERY: missing authority/evidence rejected unchanged"* (`recovery-integrity.test.js`); *"RECOVERY: confirmed completion is never executed again"* |
| Replay reconstructs canonical state with zero effects | *"REPLAY: committed admission/dispatch/result projection equals original with zero effects"* (`replay-integrity.test.js`) |
| Incomplete, reordered, foreign or duplicate history is refused | *"REPLAY: changed content/order, missing middle/tail, duplicate/mixed-run/version records reject"* (`replay-integrity.test.js`) |
| Reads are detached and a rejected candidate changes nothing | *"STATE-04: reads and retained inputs cannot change canonical state"* (`integrity.test.js`); *"STATE-03/05: rejected compound candidate changes no collection or event"* |
| A host cannot append fabricated kernel history | *"STATE: host candidates cannot append fabricated kernel history"* (`integrity.test.js`) |
| Grantless, expired, revoked and denied actors see no tasks and no queue | *"READ: grantless/expired/revoked/denied projections disclose no tasks or queue"* (`admission-integrity.test.js`) |
| Handoffs are revision-guarded and reject the wrong actor | *"handoff proposal/accept with CAS and causation/correlation"* (`continuity.test.js`); *"handoff reject and wrong actor"* |
| Resume requires an attested human principal | *"LIFECYCLE: resume requires an active host-authenticated human"* (`lifecycle-integrity.test.js`) |
| Reentrant host callbacks fail before install or effect | *"LIFECYCLE: executable accessor cannot cancel after claim then execute anyway"* (`lifecycle-integrity.test.js`) |
| Adapters receive no registry or authority write handle | *"no registry or authority write handle leaks to adapters"* (`adversarial.test.js`) |
| Contract inputs are closed and hardened | *"dangerous values and keys are rejected recursively"* (`contracts.test.js`); *"strict specs, real/literal newline parsing and no discarded unknown fields"* |
| One runtime dependency; no provider or framework imports | *"ARCH-18: first-party JS/ESM kernel has only SigilJS runtime dependency and no provider/framework imports"* (`architecture-integrity.test.js`) |
| One demonstrated end-to-end governed workflow | *"cross-session workflow with approval and replay"* (`canonical-example.test.js`) |

### 8.1 Explicit non-guarantees

These are **not** provided, and no claim in this repository should be read as providing them:
no exactly-once external effects (Chord distinguishes *requested*, *dispatched* and *confirmed*,
and a dispatched effect cannot be undone by cancellation —
`packages/core/src/platform/recovery-policy.js#isRetryEligible`); no multi-machine/distributed consensus.
Legacy v1 has no runtime exclusion/fencing: the host must stop/join the old runtime before recovery
(`packages/core/src/runtime/recovery.js#recoverOwner`). Separate v2 fences canonical owner commits,
but its final DB check is not atomic with external invocation: takeover after that check can still
allow an old unfenced callable/effect. Downstream generation fencing and stable-operation-key
idempotency/mismatch checks are required where stale effects are unacceptable, and a service can
accept an old request until it observes a higher generation. No universal stale-dispatch exclusion.
Default mode is memory-only; opt-in local SQLite recovery is not snapshot import. No sandbox (adapters are trusted in-process
host code); no authentication (the host authenticates; Chord verifies the attestation it is
handed); no cryptographic evidence (records are structurally checkable in-process only, and are
unsigned); no content redaction (context filtering is authorization-scoped, not
content-scrubbing); no deterministic model generation (replay reconstructs recorded facts; it
does not reproduce a model response); and no stable API.

---

## 9. Known limitations

| Limitation | Detail |
|---|---|
| **Three distinct local modes** | Memory `createChord()` has no persistence; 051 `createChord({storage})` is exclusive sequential restart with host stop/join; 052 `createCoordinatedChord` supports one explicitly acquired fenced owner plus concurrent authenticated actor processes/standby/observers. V1/v2 cross-open rejects; no migration or implicit promotion. |
| **Bounded local persistence** | Synchronous O(entire state/history), 1 MiB/16384-node/1024-array budgets, 1000 ms writer wait; no migrations, compaction, power-cut proof, encryption or secret scrubber. Application-authored data can contain secrets. See [storage guide](packages/core/README.md#memory-and-durable-modes). Snapshot restore remains distinct from durable recovery. |
| **One valid v2 execution owner, not multiple machines** | Linux Node v24.22.1/Bun 1.4.3 with lazy `node:sqlite`; fixed 30,000 ms lease, explicit renew/release/fresh acquire, shared trusted wall clock, identity pinning. Atomic acquire/release quarantine cannot undo old effects. No automatic renewal/takeover daemon, remote consensus, backup/clone fencing or exactly-once effects. |
| **No approval UI** | There is no notification, dashboard, operator console or human-facing surface. The host must build one and translate it into an approval record. `chord.projectContext` is a data projection, not a workflow tool. |
| **Experimental API surface** | All four import paths are experimental (64 root, 1 `/sdk`, 22 `/platform`, 29 `/interop` exports). Coordinated factory is root-only and deliberately omits legacy convenience methods. `commitRun` is privileged maintenance, never actor RPC. Legacy handoff helpers do not authenticate; v2 actor commands require fresh host channel attestation and current scoped grants/policy. |
| **Local candidate, not a release** | Use a local checkout/tarball. Registry ownership and publication are outside this documentation gate; no registry status probe or publication authorization is implied. |
| **Narrow policy expressiveness** | The grant model is allow/deny over an exact scope, not a general policy language. This is a deliberate choice — exactness over expressiveness. |
| **Unverifiable claims are unavailable** | Chord cannot prove an effect happened, only record what the host attested. A recorded result is not independent real-world verification. |

These reflect the product contract's non-goals with bounded 051 storage and separate 052 local coordination supersessions
(not a one-to-one row mapping): no distributed execution, no general workflow DSL, no sandboxing of hostile adapters, no cryptographic evidence,
no GUI, no multi-tenant service, no provider SDK breadth, no autonomous swarms without human
approval, no distributed consensus, no automatic secret removal, no exactly-once effects, and no
stable API designation.

---

## 10. Project vision and staged roadmap

| Level | Shape | Status |
|---|---|---|
| **Level A** — governed single-process preview | Trusted-host, single-active-runtime kernel (memory default, experimental local SQLite option): host-installed authority, three-stage evaluation, attempt-bound approvals, quarantine with evidence-backed reconciliation, committed-fact history with zero-effect replay. | **Implemented and verified.** This is what exists today. |
| **Level B** — durable, cross-process coordination | Level A plus a pluggable durable storage adapter, cross-process compare-and-swap, crash recovery, and a coordinator protocol allowing multiple hosts to work the same run. | **Not implemented as a level.** 051 local SQLite restart and 052 one-machine fenced-owner/multiprocess-actor protocol are bounded subsets; multi-machine coordination and full Proof 2/3 remain deferred. |
| **Level C** — federated, trust-bearing coordination | Level B plus cryptographic evidence signing and verification, principal federation across independently administered hosts, a multi-tenant deployment, and hardened execution of untrusted adapters. | **Not implemented. Not a near-term plan.** |

Levels B and C are **not** current capabilities and are **not** implied by anything in this
README. They are stated so that the Level A boundary stays honest and the vocabulary stays
stable. The full contract, including the Level A acceptance gates and the promotion criteria
for Levels B and C, is in `docs/internal/050-product-contract.md`.

---

## 11. Project status, license, and contributions

### Status

- **Level A capability: complete and verified.** The product contract enumerates 45 Class A
  capabilities, each cited to source and to a named test; the suite is green.
- **Local engineering candidate, not release approval.** Final exact-artifact verification and maintainer release decisions remain separate gates. The historical startup **UNRESOLVED P2** remains carried under the [parent disposition](docs/internal/054-reliability-disposition.md).
- **Not published.** The package has never been published to npm. **Not stable.** No API is
  designated stable.

### License and third-party position

- **Apache License 2.0** — see [`LICENSE`](LICENSE). Copyright 2026 Antistructured Labs LLC.
- **SigilJS** (`@weipertda/sigiljs@0.18.0`) is the **only** runtime dependency. It is MIT-licensed,
  **separately installed and not bundled**; Apache-2.0 does not apply to it. See
  [`packages/core/THIRD_PARTY_NOTICES.md`](packages/core/THIRD_PARTY_NOTICES.md).
- These describe the checked-in license and notices, not an independent legal opinion or publication permission.

### Contributing

- The configured origin and manifest repository both identify `https://github.com/antistructured/chord`. Release ownership is not verified by matching those strings.
- Open an issue first to discuss a bounded change before writing code.
- Keep source as JavaScript ES modules. Do not add runtime dependencies: the kernel's single
  dependency is asserted by a test (`packages/core/tests/architecture-integrity.test.js`).
- Include focused tests. The suite must stay at zero failures, and the runtime verifier
  (`bun run src/verify-runtime.js`) must keep exiting 0.
- Do not modify `packages/core/src/**` or `packages/core/tests/**` without reading
  `docs/internal/050-developer-api-review.md` first — it documents the current public surface and
  the corrections applied to it.
- Submit only work you have the right to contribute, and identify copied material and its
  license.

### Development commands

From the repository root:

```bash
cd packages/core
bun install --frozen-lockfile
bun test                                        # full Bun suite; counts belong to a measured run
bun run src/verify-runtime.js                   # exit 0
bun run examples/quickstart.mjs
bun run examples/cross-actor-workflow.mjs
bun run examples/adapter-conformance.mjs
```

`npm test` invokes the same Bun suite; it is not a separate Node test suite. There is no lint
script. Tests and the development verifier are repository-only — they are not part of the
published payload. See [`packages/core/INTEGRITY.md`](packages/core/INTEGRITY.md) for the
technical boundary notes and migration details.

## 12. Installation and runtime setup

Use the [setup guide](docs/guides/README.md#setup) for repository commands and a fresh local
consumer install. Verification uses Linux Node v24.22.1 and Bun 1.4.3, not a minimum-version
or all-platform guarantee. Durable modes require `node:sqlite`; unsupported runtimes fail closed.
There is no installed CLI binary. Keep proof output in a private scratch directory, not a live store.

## 13. Choosing a storage and coordination mode

| Need | Choose | Operational boundary |
|---|---|---|
| One application's governed tasks | `createChord()` | Memory only; snapshot export is not crash recovery. |
| Stop one runtime, restart later | `createChord({storage})` | Local v1 SQLite; host must stop/join the old scheduler first. |
| Concurrent actor processes on one machine | `createCoordinatedChord(...)` | Separate v2 SQLite; one explicitly acquired execution owner, pinned run/incarnation and shared trusted clock. |

V1 and v2 cannot cross-open; there is no migration or automatic promotion. See
[restart](docs/guides/durable-restart.md) and [cross-process](docs/guides/cross-process.md).

## 14. Actors and cross-process collaboration

Actors request work; they do not schedule it or install authority. The host authenticates each
dedicated local channel afresh, installs exact grants and policy, and retains admin/store handles.
`createActorClient` carries seven bounded command types through host ingress; actor handoff is
context exchange, not a grant or execution-owner transfer. The
[single-process two-actor guide](docs/guides/two-actor.md) and
[multiprocess guide](docs/guides/cross-process.md) demonstrate different boundaries.

The 052A framed client uses fresh session/request IDs around unchanged canonical commands.
Custom IPC peers must echo both; there is no silent unframed client fallback. The explicit raw
host edge is compatibility plumbing, not equivalent delivery isolation. See
[wire compatibility](packages/core/README.md#ipc-wire-compatibility-052a-correction).

## 15. Adapters and framework integration

Chord is framework-neutral: an adapter connects existing tools, agents or services; no model
provider or agent framework is required. An **actor IPC command** asks the host to admit or
observe work. An **adapter bridge** carries an already kernel-scheduled execution to a participant
server. Neither authenticates humans, grants permission or owns canonical commits.

The experimental descriptor advertises operations/capabilities for compatibility only — never
authority. The kernel owner authorizes, captures the attempt and commits; the downstream effect
service must enforce generation fencing and durable semantic idempotency when needed. Kernel
fencing does not physically fence an external service, and the final DB check is not atomic with
invocation. See [adapter integration and lifecycle](docs/guides/adapter.md).

## 16. Conformance and verification

`runAdapterConformance` reports check scope, failures and skips. `ok:true` means zero observed
failures, **not** full coverage: any skip makes `verdict:INCOMPLETE`; any failure makes `FAIL`.
`certification` is always false. Supplied-handler checks, supplied-participant/bridge checks and
Chord harness controls are distinct; kernel replay/stale-owner and portable registration checks
remain explicit skips in the utility. A bad fixture must fail, not be replaced by a reference adapter.
See [testing an adapter](docs/guides/conformance.md).

Current evidence: [API reverification](docs/internal/054-public-api-reverification.md),
[conformance reverification](docs/internal/054-adapter-conformance-reverification.md),
[actual installed-consumer proof](docs/internal/054-external-consumer-proof.md), and
[documentation verification](docs/internal/054-documentation-verification.md).
These are measured local gates, not certification or publication permission. The earlier reports
remain historical. The Pass 4 tarball identifies its then-tested bytes; this package README edit
requires a fresh artifact for subsequent final verification. The historical startup
[UNRESOLVED P2 disposition](docs/internal/054-reliability-disposition.md) is unchanged.

## 17. Developer workflow guides

Begin with [setup, mode selection and trust roles](docs/guides/README.md), then choose:

1. [First local governed task](docs/guides/first-task.md)
2. [Two actors, handoff and human approval](docs/guides/two-actor.md)
3. [Durable restart and unknown-outcome recovery](docs/guides/durable-restart.md)
4. [Cross-process collaboration](docs/guides/cross-process.md)
5. [Execution adapter integration](docs/guides/adapter.md)
6. [Conformance testing](docs/guides/conformance.md)

Each uses public exports and links a runnable shipped example rather than copying kernel internals.

## 18. Public API and documentation map

| Reference | Purpose |
|---|---|
| [Package entry points](packages/core/README.md#entry-points) | Exact exports and privileged versus actor-facing surfaces; root, `/sdk`, `/platform`, `/interop`. |
| [Legacy durable API](packages/core/README.md#memory-and-durable-modes) | Configuration, recovery, errors, data limits and lifecycle. |
| [Coordinated ports](packages/core/README.md#actual-factories-ports-and-supported-operations) | Actual owner/admin/observer/ingress/client members, not guessed legacy conveniences. |
| [Experimental adapter protocol](packages/core/README.md#experimental-adapter-interoperability-053) | Bridge/server, exact cancellation selector, shutdown and fixture API. |
| [Technical integrity notes](packages/core/INTEGRITY.md) | Source boundaries and migration notes. |
| [Vision](#10-project-vision-and-staged-roadmap) | Future levels explicitly separated from current guarantees. |

Internal numbered reports describe their stage, not an evergreen tutorial. Prefer the guides and
live package reference for integration; source `#symbol` locators are searchable names, not HTML anchors.
