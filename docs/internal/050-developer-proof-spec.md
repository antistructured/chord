# 050 — Developer Proof Specification
> **A1 reading note:** original pass measurements are historical; see “Pass A1 clarification / supersession” below and `docs/internal/050-citation-closeout.md` for current verification.
**Status:** spec complete, implementation not started.
**Baseline:** branch `base`, HEAD `08728e4`. Package `@antistructured/chord@0.4.0-preview.1`, `SCHEMA_VERSION = "chord.contracts.v1"` (`packages/core/src/contracts/sigils.js:3`).
**Audience:** the engineer who will write the proof harnesses, and the reviewer who will decide whether each proof has actually been earned.

---

## 0. Scope, method, and how to read this document

### 0.1 What this document is

This document specifies **three proofs**. A proof is not a claim and not a test file — it is a
**falsifiable contract** consisting of:

1. a **statement** of what is being claimed, in one sentence;
2. the **exact inputs** (a named fixture, a named state, a named time);
3. the **exact API calls**, in order, with their arguments;
4. the **observables** a consumer can actually read, and the **assertions** over them;
5. the **negative cases** with the **exact error codes** the kernel must return;
6. the **smallest implementation** that makes the proof executable, and an explicit statement of
   what already exists so that no work is invented;
7. **falsifiable pass criteria** — the conditions under which the proof *fails*, stated before the
   work starts;
8. **what the proof does NOT prove**, so it cannot be re-labelled as a stronger claim later.

A proof that cannot fail is not a proof. Every pass criterion in this document is written so that a
specific, observable defect makes it fail.

### 0.2 The three proofs at a glance

| Proof | Statement | Status | Blocks required | New production code |
|---|---|---|---|---|
| **Proof 1** | One governed task, in one process, under one host: admitted only with a matching grant, dispatched only with a consumed human approval, one effect, and a record reconstructible from committed facts alone. | **PROVABLE TODAY** | none (Block 050) | **zero** |
| **Proof 2** | The same task, interrupted by a crash at each of the four effect windows, resumes in a **new process** from durable state without repeating, losing, or silently guessing an effect. | **REQUIRES BLOCK 051** | Block 051 (durable store, lease/fencing, deterministic ids) | substantial |
| **Proof 3** | Two **independent processes** work the same run against one store; exactly one wins each contended claim, neither repeats the other's effect, and both converge on the same committed facts. | **REQUIRES BLOCK 051 + 052** | Block 051 + Block 052 (multi-process coordination) | substantial |

**Proof 1 is provable today.** This is not an estimate — it is a verified finding. Every API call in
§3.3 exists as an exported symbol today (enumerated mechanically in §3.6), and the whole positive
path has already been demonstrated end-to-end by the canonical example
(`packages/core/tests/canonical-example.test.js:5`;
`packages/core/examples/cross-actor-workflow.mjs:65-104`).

**Proofs 2 and 3 are not provable today and must never be described as if they were.** The kernel
has no persistence, no cross-process coordination, and no second process. The normative design for
both is `docs/internal/050-durable-coordination-design.md`; this document only specifies the
*proofs* that design must eventually satisfy.

### 0.3 Evidence labels

| Label | Meaning |
|---|---|
| **[Verified]** | Read directly from the cited source in this pass. |
| **[Inferred]** | Follows from cited source plus one explicit reasoning step. |
| **[Proposed]** | A decision this document makes for the implementer. Not yet implemented. |
| **[Blocked]** | Cannot exist until a named Block lands. |

### 0.4 Method

Every source citation in this document is `path:line` against the working tree at the stated
baseline. Every test citation names an existing test that **passed** in this pass
(`bun test` → 166 pass / 0 fail / 1418 expect / 166 tests across 15 files; `bun run
src/verify-runtime.js` → exit 0). No claim in this document rests on a citation that was not
opened.

**Baseline.** Branch `base`, HEAD `08728e4`, plus the uncommitted working-tree changes that were
already present in the repository when this pass began — 27 tracked files modified and 7 untracked
files, including the sibling `docs/internal/050-*.md` documents this one consumes. The package is
`@antistructured/chord@0.4.0-preview.1` and the contract version is
`"chord.contracts.v1"` (`packages/core/src/contracts/sigils.js:3`). Citations point at the
**working tree**, not at HEAD, because the working tree is what the suite ran against and what any
implementer will read. This pass created exactly one file — this document — and modified nothing
else.

### 0.5 Non-goals

- This document does **not** implement any proof. It specifies them.
- It does **not** re-argue the product contract (`docs/internal/050-product-contract.md`) or the
  durable design (`docs/internal/050-durable-coordination-design.md`); it consumes both.
- It does **not** propose a public API change, a dependency, or a contract version change.
- It does **not** claim any Level B or Level C capability exists. It never uses the words
  "durable", "distributed", or "crash-safe" about the current repository.

---

## 1. The boundary this specification has to respect

### 1.1 What exists today [Verified]

| Fact | Citation |
|---|---|
| The kernel is a **private, single-process owner** holding one in-memory registry object. | `packages/core/src/registry/owner.js:8-10` |
| Every mutation is a **clone → validate → atomic swap** inside `transact`, with a revision CAS. | `packages/core/src/registry/owner.js:22-42` |
| A revision mismatch throws `STALE_REVISION`; a reentrant mutation throws `REENTRANT_MUTATION`. | `packages/core/src/registry/owner.js:23-24`, `packages/core/src/registry/owner.js:44` |
| There is **no storage adapter, no write-ahead log, no lock service, no network listener, no second process**. | `docs/internal/050-product-contract.md` (“5.3 Level B — Durable, cross-process coordination”) (exhaustive inspection of `packages/core/src/**`) |
| The only filesystem access in the package is an **unused** text I/O helper. | `docs/internal/050-product-contract.md` (“3.3 Class B — implemented, but experimental or trusted-host plumbing”); `packages/core/src/runtime/adapter.js:2-14` |
| Identifiers are **nondeterministic**: `stableId` is `Date.now()` + `Math.random()`. | `packages/core/src/utils/id.js:1-4` |
| The host owns the clock via `trustedHost.now()`; a backwards clock throws `INVALID_CONTEXT`. | `packages/core/src/sdk/chord.js#hostNow` |
| Authority is evaluated **three times** per task: at admit, at dispatch, at commit. | `packages/core/src/sdk/chord.js#queueTaskPackets`, `packages/core/src/platform/runtime-loop.js:49`, `packages/core/src/platform/runtime-loop.js:82` |
| A post-dispatch failure becomes `uncertain` and is **never** blind-retried. | `packages/core/src/platform/runtime-loop.js:96-104`; `packages/core/src/platform/recovery-policy.js:12-19` |
| A dispatched effect is recorded as `dispatched` before the adapter is invoked, and as `confirmed` only after the result is committed. | `packages/core/src/platform/runtime-loop.js:56`, `packages/core/src/platform/runtime-loop.js:91` |
| The reducer reconstructs state from committed facts with **zero** effects, and refuses incomplete history. | `packages/core/src/platform/trace-reducer.js:8-45`, `packages/core/src/platform/trace-reducer.js:46-48` |
| Importing a snapshot quarantines in-flight (`leased`/`running`) work as `uncertain`. | `packages/core/src/registry/snapshot.js:31-45` |

### 1.2 What does not exist today [Verified]

`docs/internal/050-product-contract.md` (“3.4 Class C — not implemented (must never be presented as current)”) classifies these as Class C (not implemented):

- C1 durable storage adapter / write-ahead log / crash recovery — Level B;
- C2 cross-process or distributed compare-and-swap — Level B;
- C3 multi-process / multi-host coordination protocol — Level B.

Level B "is not implemented" and "is deferred to Blocks 051–052"
(`docs/internal/050-product-contract.md` (“5.3 Level B — Durable, cross-process coordination”)). It must not appear as a **current capability** in any product statement,
README or release note (`docs/internal/050-product-contract.md` (“5.3 Level B — Durable, cross-process coordination”)).

### 1.3 What that means for the three proofs

| | Proof 1 | Proof 2 | Proof 3 |
|---|---|---|---|
| Process count | 1 | 2 (before/after crash) | ≥ 2 (concurrent) |
| State lifetime | process lifetime | outlives the process | shared between processes |
| Effect count | exactly 1 | at most 1 per attempt, possibly 0 | at most 1 across all processes |
| Block | — | 051 | 051 + 052 |

**The single most important sentence in this document:** Proof 1 cannot be scaled up into Proof 2
by writing more tests. The difference between them is not test volume; it is that Proof 2 requires
state to survive process death (`docs/internal/050-durable-coordination-design.md` (“2. The canonical state storage interface”), §2),
and Proof 3 requires two processes to contend on one store
(`docs/internal/050-durable-coordination-design.md` (“12. Multi-process access expectations”), §12).

---

## 2. Common harness

### 2.1 Purpose

All three proofs share one harness so that Proof 1's fixtures are not thrown away when Proof 2
lands, and so that the three proofs are measured by the same rules.

**Location (proposed):** `packages/core/tests/fixtures/proof-harness.js`.

### 2.2 Required harness exports [Proposed]

```js
// packages/core/tests/fixtures/proof-harness.js

export function createProofClock(start = 1_000) {
  // Monotonic, host-owned, advanceable. Matches the kernel's contract:
  // the clock must never move backwards (`packages/core/src/sdk/chord.js#hostNow`).
  let t = start;
  return { now: () => t, advance: ms => { t += ms; return t; }, set: v => { t = v; return t; } };
}

export function createProofHost(chord, { clock, approvalRequired = true } = {}) { /* ... */ }

export function createCountingAdapter({ result, throws, delay } = {}) {
  // Returns { adapter, calls, packets, contexts, reset() }.
  // `calls` counts invocations. `packets`/`contexts` record exactly what
  // the kernel handed the adapter, so "no effect occurred" is observable
  // and not merely inferred from a status field.
}

export function canonicalState(registry) {
  // Strips event_journal for state comparison. Matches the existing
  // projection helper used by packages/core/tests/replay-integrity.test.js:6.
  const { event_journal, ...state } = registry;
  return state;
}

export function expectCode(fn, code) {
  // Asserts that fn throws (or returns a denial) carrying exactly `code`.
  // Used for every negative case so that no negative case can pass on a
  // wrong code.
}
```

### 2.3 Harness rules

| # | Rule | Why |
|---|---|---|
| H1 | **No assertion may read a private field of the kernel.** Assertions read the public SDK surface (`getRegistry`, `getAuthority`, `getRunRevision`, `queryQueue`, `queryDeadLetters`, `inspectEvents`, `inspectAudit`, `exportRegistry`, `projectContext`) and the root exports (`reduceTrace`, `replayNoSideEffects`, `diffTraces`, `canonicalProjection`). | A proof that asserts on internals proves the implementation, not the contract. The public surface is enumerated in `docs/internal/050-developer-api-review.md` (“2.4 SDK instance surface — all 38 members”). |
| H2 | **Every negative case asserts the exact code, not "an error".** | The kernel's error vocabulary is machine-readable and 36 codes wide (`docs/internal/050-developer-api-review.md` (“5.1 The observable error vocabulary”)). A proof that accepts any error proves nothing about which error. |
| H3 | **Every effect assertion counts adapter invocations.** No proof may infer "no effect occurred" from a task status alone. | The task status is kernel state; the invocation count is the fact. `packages/core/tests/transitions.test.js:322-332` proves the two can differ. |
| H4 | **The clock is injected, never `Date.now()`.** | The kernel's own clock seam exists for this (`packages/core/src/sdk/chord.js#hostNow`); the identifier source does not yet (see §2.4). |
| H5 | **Assertions are on the *returned* value and the *public* projection, never on a mutated reference.** | `chord.registry` and `chord.getRegistry()` return detached clones (`packages/core/src/sdk/chord.js#read`, `packages/core/src/sdk/chord.js`); asserting on them is asserting on a copy. |

### 2.4 The one harness gap that must be recorded, not hidden

`stableId` is **not injectable today**: it is `Date.now()` + `Math.random()`
(`packages/core/src/utils/id.js:1-4`). Block 051 proposes to make it injectable
(`docs/internal/050-durable-coordination-design.md` (“11.3 Complete enumeration of identifier sites”)).

**Consequence for Proof 1:** identifiers are nondeterministic across runs. Proof 1 must therefore
**never assert on an identifier's value**. It asserts on identifier *relationships* — equality
between two returned identifiers, inequality between two distinct ones, and the presence of a
prefix. Proof 1 is fully executable without an id source; it simply cannot make byte-identical
journal comparisons across two runs.

**Consequence for Proofs 2 and 3:** an injectable id source is a **precondition**, not a
nice-to-have. Two processes that mint colliding attempt ids cannot be distinguished, and a
crash-recovery test that reopens a store must be able to assert "this attempt is the one that was
in flight", which requires the id to be reconstructible from durable state.

### 2.5 Proof file layout (proposed)

```
packages/core/tests/fixtures/proof-harness.js                  shared harness (§2.2)
packages/core/tests/proof-1-governed-workflow.test.js          Proof 1  (Block 050)
packages/core/tests/proof-2-crash-recovery.test.js             Proof 2  (Block 051)
packages/core/tests/proof-3-cross-process.test.js               Proof 3  (Block 051 + 052)
```

Proof 2 and Proof 3 files are **not** created by this document. Creating them before their blocks
land would produce tests that either fail or assert nothing.

---

## 3. Proof 1 — Local governed workflow

> **Status: PROVABLE TODAY.**
> **Statement.** In one process, under one host, a task is admitted only with a matching allow
> grant, dispatched only with an exact and consumed human approval bound to that attempt, produces
> **exactly one** adapter invocation, and leaves behind a record from which the entire run state
> can be reconstructed with **zero** further effects.
> **Block:** none. **New production code:** zero. See §3.6.

### 3.1 Preconditions

| # | Precondition | Status |
|---|---|---|
| P1.1 | One `createChord()` instance, with an injected monotonic clock. | exists — `packages/core/src/sdk/chord.js#createChord`, `packages/core/src/sdk/chord.js#hostNow`, `packages/core/src/sdk/chord.js` |
| P1.2 | An authority snapshot with one `service` principal, one `human` principal, one `agent` actor. | exists — `packages/core/src/contracts/sigils.js:101-102`, `packages/core/src/contracts/sigils.js:117-130` |
| P1.3 | One `IntentSpec` with at least one `do` entry. | exists — `packages/core/src/contracts/sigils.js:148` |
| P1.4 | One adapter that returns `{status:"completed", outcome:"succeeded"}`. | exists — `packages/core/src/contracts/sigils.js:179`; routed at `packages/core/src/platform/adapter-routing.js:5-12` |
| P1.5 | A counting wrapper around that adapter (harness H3). | harness §2.2 |
| P1.6 | No `evaluateAuthority` import. Proof 1 uses the **public** surface only. | rule H1 |

### 3.2 The reference sequence

The sequence below is the canonical form of Proof 1. It is written as executable pseudocode; every
call is a real exported member, and every value it reads is public.

```js
// ---- S1: the host establishes authority (no grants yet) -----------------
const clock = createProofClock();
const chord = createChord({ trustedHost: { now: clock.now } });

chord.setAuthoritySnapshot({
  schema_version: SCHEMA_VERSION,
  run_id: chord.registry.run.run_id,
  authority_revision: 0,
  principals: [
    { principal_id: "host-principal", issuer: "proof-host", kind: "service", authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER },
    { principal_id: "human-approver", issuer: "proof-host", kind: "human",  authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER }
  ],
  actors: [
    { actor_id: "worker-actor", principal_id: "host-principal", kind: "agent", roles: ["implementer"], capabilities: ["execute"], revoked_at: null }
  ],
  grants: [],
  approvals: []
});

// ---- S2: register the spec and admit it under a host-issued grant -------
const { packets } = chord.registerSpecAndQueue(spec, {
  principal_id: "host-principal",
  actor_id: "worker-actor",
  capability: "execute",
  issueGrants: ps => ps.map(p => chord.createTaskGrant(p, {
    principal_id: "host-principal",
    actor_id: "worker-actor",
    capability: "execute",
    requires_approval: true          // the approval gate is armed by the grant
  }))
});
const taskId = packets[0].task_id;

// ---- S3: dispatch is DENIED; no effect occurs ---------------------------
const { adapter, calls } = createCountingAdapter();
chord.setAdapterRouter({ fallback: adapter });

const denied = await chord.runCycle();

// ---- S4: the host prepares the attempt and installs a human approval ----
const prepared = chord.prepareAttempt(taskId);
const snapshot = chord.getAuthority();
snapshot.authority_revision += 1;                    // setAuthoritySnapshot demands exactly +1
snapshot.approvals = [...snapshot.approvals, chord.createApproval({
  task_id: taskId,
  approver_principal_id: "human-approver",
  attempt_id: prepared.attempt_id
})];
chord.setAuthoritySnapshot(snapshot);

// ---- S5: dispatch succeeds; exactly one effect --------------------------
const ok = await chord.runCycle();

// ---- S6: the record reconstructs itself with zero effects ---------------
const replayed = replayNoSideEffects(chord.inspectEvents());
```

**Why the approval is armed by the grant and not by the queue option.** The dispatch gate fires
when *either* the task binding carries `approval_required` **or** a matching allow grant carries
`requires_approval` (`packages/core/src/platform/authorization.js:120-121`). Using the grant flag
keeps the approval requirement attached to the *permission*, which is what the host actually
issued, and leaves the queue option free for hosts that want a task-level gate instead.

**Why `prepareAttempt` is called before the approval is installed.** The approval is bound to an
`attempt_id` (`packages/core/src/contracts/sigils.js:104`), and the attempt id is only knowable
after the attempt is reserved (`packages/core/src/platform/attempts.js:8-26`). The reservation is
kernel-owned and single-use: a repeated preparation returns the same pending attempt
(`packages/core/src/platform/attempts.js:9-10`), and the runtime reuses that same reservation at
dispatch (`packages/core/src/platform/runtime-loop.js:48`).

**Why the denied cycle in S3 does not discard the reservation.** The runtime reserves the attempt
*before* it evaluates dispatch (`packages/core/src/platform/runtime-loop.js:48`), and the owner's
`transact` **commits the draft even when the callback returns a denial**
(`packages/core/src/registry/owner.js:29-40`): the denial is a return value, not a rollback. So
S3 leaves a pending attempt behind, and the host's S4 `prepareAttempt` returns that same attempt
rather than minting a second one. Proof 1 must therefore assert that S3 and S4 yield **the same**
`attempt_id` — if they did not, the approval installed in S4 would bind to an attempt the runtime
never uses, and dispatch would deny with `APPROVAL_REQUIRED` forever
(`packages/core/src/platform/authorization.js:132-133`).

**Why installing the approval before dispatch is safe.** The commit-stage guard compares the
attempt's `authority_revision` to the live snapshot's
(`packages/core/src/platform/authorization.js:138`), but the runtime stamps the attempt's
authority_revision at dispatch, after the approval is installed
(`packages/core/src/platform/runtime-loop.js:59`). Installing the approval first therefore does
not invalidate the commit.

**Note on `setAuthoritySnapshot` options.** `setAuthoritySnapshot` enforces **two** CAS mechanisms (both can raise `STALE_REVISION`):
- **Run revision (via `mutate`):** the SDK instance method passes `opts.expectedRevision` to `owner.transact` (`packages/core/src/sdk/chord.js#mutate`, `packages/core/src/sdk/chord.js#setAuthoritySnapshot`), so a stale `expectedRevision` throws `STALE_REVISION` (run-revision CAS).
- **Authority revision:** the snapshot must have `authority_revision === (authority===null?0 : authority.authority_revision + 1)` (`packages/core/src/sdk/chord.js#setAuthoritySnapshot`), and `snapshotOptions.expectedAuthorityRevision` is checked separately against the **incoming/next** revision, not the previous installed revision. A mismatch raises `STALE_REVISION`.
Unknown option keys are ignored. Proof 1 should test both mechanisms where relevant; the canonical example passes `{ expectedRevision }` (`packages/core/examples/cross-actor-workflow.mjs#runCanonicalWorkflow`, approval installation) as a run-revision CAS (not inert).

### 3.2.1 The existing anchor for this sequence

Proof 1 is not speculative. The canonical example already performs this sequence end to end:

| Step | Canonical example | What it shows |
|---|---|---|
| Denied dispatch | `packages/core/examples/cross-actor-workflow.mjs:65-72` | A granted task with `requires_approval` yields `code === "APPROVAL_REQUIRED"` and `protectedEffects === 0`. |
| Attempt preparation | `packages/core/examples/cross-actor-workflow.mjs:77` | `prepareAttempt(taskId)` before any approval exists. |
| Approval install | `packages/core/examples/cross-actor-workflow.mjs:84-91` | `createApproval` bound to `attempt.attempt_id`, installed with `authority_revision += 1`. |
| Approved dispatch | `packages/core/examples/cross-actor-workflow.mjs:93-96` | The protected effect runs and the task commits. |
| Zero-effect replay | `packages/core/examples/cross-actor-workflow.mjs:98-104` | `replayNoSideEffects(inspectEvents())` reproduces the projection with `effects_invoked === 0`, and the approval's `consumed_by_attempt_id` equals the attempt id. |

**What the example does not do, and therefore what Proof 1 adds.** The example asserts with bare
`throw new Error("...")` sentinels, inside a demonstration script also invoked by `packages/core/tests/canonical-example.test.js`; it asserts `APPROVAL_REQUIRED` and `RUN_NOT_ACTIVE`, but not the full negative matrix; it does not count adapter invocations
separately from the effect counter; it does not attempt to reproduce a *rejected* approval; and it
does not cover scope, expiry, revocation, replay-of-consumed-approval, or stale-revision
negatives. Proof 1's contribution is precisely to convert that demonstration into a falsifiable
test with exact-code negative assertions and independent effect counting (§3.3, §3.4).


### 3.3 Assertions

Every assertion below reads a **public** observable. `calls` is the adapter invocation count from
the harness (rule H3).

| # | After | Assertion | Why it must hold |
|---|---|---|---|
| A1.1 | S1 | `chord.getAuthority().authority_revision === 0` | A snapshot with no grants installs at revision 0 (`packages/core/src/sdk/chord.js#setAuthoritySnapshot`). |
| A1.2 | S1 | `Object.keys(chord.getRegistry().tasks).length === 0` | Installing authority must not create work. |
| A1.3 | S2 | `packets.length === 1` | One `IntentSpec` produces one packet (`packages/core/src/sdk/chord.js#createTaskPackets`). |
| A1.4 | S2 | `chord.getRegistry().tasks[taskId].status === "queued"` | Admission registers the task as queued (`packages/core/src/sdk/chord.js#queueTaskPackets`, `packages/core/src/sdk/chord.js`). |
| A1.5 | S2 | `chord.queryQueue({ status: "queued" }).length === 1` | Exactly one queue entry exists (`packages/core/src/sdk/chord.js#queueTaskPackets`). |
| A1.6 | S2 | `chord.getAuthority().authority_revision === 1` | Issuing grants installs them and advances the authority revision (`packages/core/src/sdk/chord.js#installGrants`). |
| A1.7 | S2 | `chord.getAuthority().grants.length === 1` and `grants[0].scope.task_id === taskId` | The grant is scoped to the exact task (`packages/core/src/sdk/chord.js#createTaskGrant`). |
| A1.8 | S3 | `denied.ok === false` | The cycle did not succeed. |
| A1.9 | S3 | `denied.denied === true` | The failure was an authority denial, not an effect error (`packages/core/src/platform/runtime-loop.js:52`). |
| A1.10 | S3 | `denied.code === "APPROVAL_REQUIRED"` | The dispatch stage found no exact unconsumed approval for this attempt (`packages/core/src/platform/authorization.js:133`). |
| A1.11 | S3 | `calls === 0` | **No effect occurred.** The denial happens inside the claim transaction, before the adapter is resolved and invoked (`packages/core/src/platform/runtime-loop.js:42-53`). |
| A1.12 | S3 | `chord.getRegistry().tasks[taskId].status === "queued"` | A denial leaves the task where it was (`packages/core/src/platform/runtime-loop.js:51-52`). |
| A1.13 | S3 | `chord.getRegistry().execution_results.length === 0` | Nothing was committed. |
| A1.14 | S4 | `typeof prepared.attempt_id === "string"` and `prepared.attempt_id.startsWith("attempt_")` | An attempt was reserved (`packages/core/src/platform/attempts.js:18`). |
| A1.15 | S4 | `chord.getAuthority().authority_revision === 2` | Installing the approval snapshot advances the revision by exactly one (`packages/core/src/sdk/chord.js#setAuthoritySnapshot`). |
| A1.16 | S4 | `chord.getAuthority().approvals[0].attempt_id === prepared.attempt_id` | The approval is bound to the exact attempt (`packages/core/src/contracts/sigils.js:104`). |
| A1.17 | S4 | `chord.getAuthority().approvals[0].consumed_by_attempt_id === null` | Installation does not consume the approval; dispatch does (`packages/core/src/platform/runtime-loop.js:63`). |
| A1.18 | S4 | `chord.getRegistry().pending_attempts[taskId].attempt_id === prepared.attempt_id` | The host's preparation reused the attempt the runtime reserved in S3, rather than minting a second one. `pending_attempts` is part of the public `RegistryData` contract (`packages/core/src/contracts/sigils.js:189`), so this does not breach rule H1. If the ids differed, the approval would bind to an attempt the runtime never dispatches, and S5 would deny with `APPROVAL_REQUIRED` (`packages/core/src/platform/authorization.js:132-133`). |
| A1.19 | S5 | `ok.ok === true` | The dispatch was authorised and the result committed. |
| A1.20 | S5 | `calls === 1` | **Exactly one effect.** Not zero (the work did not happen), not two. |
| A1.21 | S5 | `chord.getRegistry().tasks[taskId].status === "completed"` | The committed result moved the task to completed (`packages/core/src/platform/runtime-loop.js:89`). |
| A1.22 | S5 | `chord.getRegistry().execution_results.length === 1` | Exactly one committed result (`packages/core/src/registry/registry.js:157`). |
| A1.23 | S5 | `chord.getAuthority().approvals[0].consumed_by_attempt_id === prepared.attempt_id` | The approval was consumed by this attempt and is not reusable (`packages/core/src/platform/runtime-loop.js:63`). |
| A1.24 | S5 | `Object.values(chord.getRegistry().operations).find(o => o.task_id === taskId).state === "confirmed"` | The effect is confirmed, not merely dispatched (`packages/core/src/platform/runtime-loop.js:91`). |
| A1.25 | S6 | `canonicalProjection(replayed.projected)` deep-equals `canonicalProjection(chord.getRegistry())` | The committed facts reconstruct the state exactly (`packages/core/src/platform/trace-reducer.js:8-45`). |
| A1.26 | S6 | `replayed.effects_invoked === 0` | Reconstruction has no side effects (`packages/core/src/platform/trace-reducer.js:47`). |
| A1.27 | S6 | `calls === 1` (unchanged) | Replaying the trace did **not** re-run the adapter. |

### 3.4 Negative cases

Each negative case is an independent test. Each asserts an exact code and an exact observable.

| # | Setup | Call | Expected | Citation |
|---|---|---|---|---|
| N1 | Fresh chord, authority with **no grants**; `issueGrants: () => []` | `chord.queueTaskPackets([packet], opts)` | throws `NO_ALLOW_GRANT`; `Object.keys(chord.getRegistry().tasks).length === 0`; `chord.queryQueue().length === 0` | `packages/core/src/sdk/chord.js#queueTaskPackets`; `packages/core/src/platform/authorization.js:104`; existing test `packages/core/tests/adversarial.test.js:259` |
| N2 | Batch of two packets; `issueGrants` issues for the first only | `chord.queueTaskPackets([p1, p2], opts)` | throws `NO_ALLOW_GRANT`; **neither** task registered; queue empty | `packages/core/src/sdk/chord.js#queueTaskPackets`; existing test `packages/core/tests/adversarial.test.js:286` |
| N3 | Admission succeeds, then the host **revokes** the grant before dispatch | `await chord.runCycle()` | `denied === true`, `code === "NO_ALLOW_GRANT"`, `calls === 0`, task still `"queued"` | `packages/core/src/platform/authorization.js:102-104` (no active allow → `NO_ALLOW_GRANT`); existing test `packages/core/tests/adversarial.test.js:259` |
| N4 | As S2, but the host also installs an **active `deny` grant** with the same scope | `await chord.runCycle()` | `denied === true`, `code === "EXPLICIT_DENY"`, `calls === 0` | `packages/core/src/platform/authorization.js:102`; existing test `packages/core/tests/adversarial.test.js:162` |
| N5 | As S4, but the approval carries `decision: "rejected"` | `await chord.runCycle()` | `denied === true`, `code === "APPROVAL_REJECTED"`, `calls === 0`, task still `"queued"` | `packages/core/src/platform/authorization.js:115`, `packages/core/src/platform/authorization.js:129`; existing test `packages/core/tests/adversarial.test.js:460` |
| N6 | As S4, but the approval's `attempt_id` names a **different** attempt | `await chord.runCycle()` | `denied === true`, `code === "APPROVAL_REQUIRED"`, `calls === 0` | `packages/core/src/platform/authorization.js:132-133`; existing test `packages/core/tests/adversarial.test.js:476` |
| N7 | As S4, but the approval was already consumed by a prior attempt | `await chord.runCycle()` | `denied === true`, `code === "APPROVAL_REQUIRED"`, `calls === 0` | `packages/core/src/platform/authorization.js:116-118`, `packages/core/src/platform/authorization.js:133`; existing test `packages/core/tests/authorization.test.js:203` |
| N8 | As S2, then a host mutation advances the run revision | `chord.cancelTask(taskId, { expectedRevision: stale })` | throws `STALE_REVISION`; task still `"queued"` | `packages/core/src/sdk/chord.js#cancelTask`; existing test `packages/core/tests/adversarial.test.js:313` |
| N9 | Adapter throws after dispatch | `await chord.runCycle()` | `result.uncertain === true`, `result.code === "ADAPTER_ERROR"`; task `"uncertain"`; `execution_results.length === 0`; **not** retried, **not** dead-lettered | `packages/core/src/platform/runtime-loop.js:96-104`; `packages/core/src/platform/recovery-policy.js:12-19`; existing test `packages/core/tests/transitions.test.js:167` |
| N10 | Adapter returns a malformed result (`{}`) | `await chord.runCycle()` | `result.uncertain === true`, `result.code === "INVALID_RESULT"`; task `"uncertain"`; `chord.queryDeadLetters().length === 0`; `execution_results.length === 0` | `packages/core/src/platform/runtime-loop.js:78-92`, `packages/core/src/platform/runtime-loop.js:96-104`; `packages/core/src/registry/registry.js:132-135`; existing test `packages/core/tests/adversarial.test.js:389` |
| N11 | Adapter returns a result whose `task_id` is foreign | `await chord.runCycle()` | `result.uncertain === true`, `result.code === "INVALID_RESULT"`; task `"uncertain"`; `execution_results.length === 0` | `packages/core/src/platform/runtime-loop.js:78-92`, `packages/core/src/platform/runtime-loop.js:96-104`; `packages/core/src/registry/registry.js:135`; existing test `packages/core/tests/adversarial.test.js:375` |
| N12 | Task dispatched; host cancels it while the adapter is in flight | `await chord.runCycle()` | `result.ok === false`, `result.code === "TASK_CANCELLED"`; task `"cancelled"`; `execution_results.length === 0` | `packages/core/src/platform/authorization.js:59`; existing test `packages/core/tests/transitions.test.js:314` |
| N13 | Task dispatched; host commits a **new revision** mid-flight via `chord.commitRun` | `await chord.runCycle()` | `result.ok === false`, `result.code === "STALE_REVISION"`; task `"uncertain"`; `execution_results.length === 0` | `packages/core/src/platform/runtime-loop.js:83-88`; existing test `packages/core/tests/transitions.test.js:203` |
| N14 | Task is `uncertain` (after N9) | `chord.replayTask(taskId)` | throws `RECONCILIATION_REQUIRED` — permission is not evidence that the effect did not happen | `packages/core/src/sdk/chord.js#replayTask`; existing test `packages/core/tests/transitions.test.js:350` |
| N15 | Task is `uncertain`; reconcile with the **wrong evidence kind** | `chord.reconcileTask({ ..., decision: "confirmed_not_executed", evidence: { kind: "operator_review", ... } })` | throws `INSUFFICIENT_EVIDENCE`; task remains `"uncertain"` | `packages/core/src/platform/reconciliation.js:39-40`; existing test `packages/core/tests/recovery-integrity.test.js:15` |
| N16 | Task is `uncertain`; reconcile with the **wrong principal kind** | `chord.reconcileTask({ principal_id: "host-principal", ... })` | throws `PRINCIPAL_INVALID` — reconciliation requires an attested human | `packages/core/src/platform/reconciliation.js:35-36`; existing test `packages/core/tests/recovery-integrity.test.js:15` |
| N17 | Task is `uncertain`; reconcile with `confirmed_not_executed` + `no_effect_confirmation`; then replay | `chord.reconcileTask(...)` then `chord.replayTask(taskId)` | task returns to `"queued"`, `retry_count === 0`; a subsequent `runCycle()` completes it with `calls === 2` **in total** (one failed dispatch, one successful) | `packages/core/src/sdk/chord.js#replayTask`; `packages/core/src/platform/reconciliation.js:39-48`; existing test `packages/core/tests/transitions.test.js:350` |
| N18 | Task dispatched and completed; host attempts to replay it | `chord.replayTask(taskId)` | throws `INVALID_TRANSITION` — terminal states are not replayable | `packages/core/src/sdk/chord.js#replayTask`; existing test `packages/core/tests/transitions.test.js:392` |
| N19 | A duplicate packet with an existing `task_id` | `chord.queueTaskPackets([packet], opts)` | throws `INVALID_SEMANTICS`; registry unchanged | `packages/core/src/sdk/chord.js#queueTaskPackets`; existing test `packages/core/tests/adversarial.test.js:299` |
| N20 | The journal is truncated (missing the tail) | `reduceTrace(truncatedEvents)` | throws `INCOMPLETE_HISTORY` | `packages/core/src/platform/trace-reducer.js:43`; existing test `packages/core/tests/replay-integrity.test.js:21` |
| N21 | The journal is reordered | `reduceTrace(reversedEvents)` | throws — order is part of the contract | `packages/core/src/platform/trace-reducer.js:29`; existing test `packages/core/tests/replay-integrity.test.js:21` |
| N22 | The journal contains a foreign `run_id` | `reduceTrace(foreignEvents)` | throws `RUN_MISMATCH` | `packages/core/src/platform/trace-reducer.js:24`; existing test `packages/core/tests/replay-integrity.test.js:21` |
| N23 | The journal contains a duplicate event | `reduceTrace(duplicatedEvents)` | throws `INVALID_SEMANTICS` | `packages/core/src/platform/trace-reducer.js:14`; existing test `packages/core/tests/replay-integrity.test.js:21` |

### 3.5 Two codes the SDK's decision surface cannot produce directly

Two decision codes in the frozen vocabulary
(`packages/core/src/contracts/sigils.js:132`) are **not reachable through the public SDK's
admit/dispatch decision surface**:

| Code | Only producer | Why the SDK cannot produce it | Where it is asserted today |
|---|---|---|---|
| `SCOPE_MISMATCH` | `packages/core/src/platform/authorization.js:93` | The evaluator only compares `task.authority_binding.scope` against the task's own immutable fields. The kernel derives the binding from the packet at admission (`packages/core/src/sdk/chord.js#queueTaskPackets`), so the two can never disagree — and the binding is immutable afterwards (`packages/core/src/platform/state-invariants.js:11`). | `packages/core/tests/authorization.test.js:117-118`, which imports the **internal** module directly. |
| `TASK_CANCELLED` | `packages/core/src/platform/authorization.js:59` | Reachable only when the evaluator is handed a task whose status is `cancelled`. Every SDK call site that evaluates a decision overrides the status to `"queued"` (`packages/core/src/sdk/chord.js#replayTask`, `packages/core/src/platform/handoff.js:18`) or refuses the task earlier. | `packages/core/tests/authorization.test.js:92` (internal import) and `packages/core/tests/transitions.test.js:330` — reachable there through the **commit** stage after `cancelTask`, not through the evaluator directly. |

**The distinction matters.** `SCOPE_MISMATCH` is unreachable through the SDK **at all**;
`TASK_CANCELLED` is unreachable through the SDK's *decision* surface but **is** observable through
the SDK at the *commit* stage, because `cancelTask` moves the task to `cancelled` and the
commit-stage evaluation then sees that status.

**Rule for Proof 1:** Proof 1 asserts these two codes **only** if it is willing to import the
internal module `packages/core/src/platform/authorization.js`, which violates rule H1. They are
therefore **excluded from the Proof 1 negative set**, and the exclusion is recorded here rather
than papered over. N12 is retained because `TASK_CANCELLED` *is* observable through the SDK, at
the commit stage.

### 3.6 Smallest implementation

**Production code changes required: zero.** [Verified]

Every symbol Proof 1 calls is a live export of the package. This was enumerated mechanically
against the live export list, not read off a document:

| Surface | Count | Proof 1 uses |
|---|---|---|
| Root exports (`packages/core/src/index.js`) | 30 | `createChord`, `SCHEMA_VERSION`, `replayNoSideEffects`, `reduceTrace`, `canonicalProjection`, `diffTraces` |
| SDK instance members | 38 | `setAuthoritySnapshot`, `registerSpecAndQueue`, `createTaskGrant`, `createApproval`, `prepareAttempt`, `setAdapterRouter`, `runCycle`, `getRegistry`, `getAuthority`, `getRunRevision`, `queryQueue`, `queryDeadLetters`, `inspectEvents` |

The enumeration checked a **superset** of what Proof 1 uses — 32 SDK members and 12 root exports,
44 symbols in total — and found **zero missing**. Proof 1 itself calls 6 root exports and 13 SDK
members; the remaining checked symbols are the ones Proofs 2 and 3 will need, verified early so that
§5's "requires Block 051" findings are not about missing API but about missing *machinery*.

**Artifacts that must be created:**

| Artifact | Estimate | Content |
|---|---|---|
| `packages/core/tests/fixtures/proof-harness.js` | ~140 lines | §2.2, verbatim |
| `packages/core/tests/proof-1-governed-workflow.test.js` | ~380 lines | 27 positive assertions across S1–S6, 23 negative cases |

**One optional, one-line production change worth making [Proposed]:**

`chord.createApproval` hardcodes `decision: "approved"`
(`packages/core/src/sdk/chord.js#createApproval`). Negative case **N5** therefore has to hand-build the
15-field approval contract — exactly the deep shape
`docs/internal/050-developer-api-review.md` (“7.2 Measured cost of the canonical two-actor workflow”) identifies as the thing consumers get wrong
first. Accepting `approvalOptions.decision === "rejected"` would remove the deep shape from the
negative path too. This is **not required** for Proof 1 to pass; it is recorded because N5 is the
only negative case in Proof 1 that needs internal contract knowledge.

### 3.7 Falsifiable pass criteria

Proof 1 **passes** if and only if:

1. every assertion in §3.3 holds, in order, in one execution of the §3.2 sequence;
2. every negative case N1–N23 produces exactly the code and exactly the observable stated;
3. `calls === 1` at the end of the positive path and `calls === 0` at every denial point;
4. `canonicalProjection(replayed.projected)` deep-equals `canonicalProjection(chord.getRegistry())`;
5. the whole file runs under `bun test` with the rest of the suite, adding **no** failures to the
   existing 166-pass baseline.

Proof 1 **fails** — and the defect is located in the named step — if any of the following occurs:

| Observed | Defect located in |
|---|---|
| `denied.code` is not `"APPROVAL_REQUIRED"` at S3 | the dispatch-stage approval gate (`packages/core/src/platform/authorization.js:128-135`) |
| `calls !== 0` at S3 | the claim/effect ordering (`packages/core/src/platform/runtime-loop.js:42-77`) |
| `calls === 2` at S5 | the dispatch state guard — the task leaves `queued` at dispatch (`packages/core/src/platform/runtime-loop.js:62`), so a second dispatch denies with `INVALID_TRANSITION` (`packages/core/src/platform/authorization.js:62-63`) — together with approval consumption (`packages/core/src/platform/runtime-loop.js:63`) |
| `consumed_by_attempt_id` is not the attempt id at S5 | approval consumption (`packages/core/src/platform/runtime-loop.js:63`) |
| the replay projection differs from the live registry | the commit/capture path (`packages/core/src/registry/owner.js:15-19`) |
| a negative case throws a *different* code | the evaluator's failure ordering (`packages/core/src/platform/authorization.js:34-53`) |

### 3.8 What Proof 1 does NOT prove

1. **Not durability.** Every byte of Proof 1's state dies with the process. Proof 1 says nothing
   about a restart.
2. **Not crash safety.** Proof 1 kills nothing. A crash between S4 and S5 is exactly Proof 2.
3. **Not multi-process safety.** One process, one owner, one registry object
   (`packages/core/src/registry/owner.js:8-10`).
4. **Not exactly-once.** Proof 1 proves *one invocation in one run of one process*. It does not
   prove that a dispatched-but-unconfirmed effect is not repeated elsewhere — that is the W2
   problem (`docs/internal/050-durable-coordination-design.md` (“8.1 The four windows”), `docs/internal/050-durable-coordination-design.md` (“8.1 The four windows”)), which is irreducible.
5. **Not that the approval is meaningful.** The approval proves a *human principal was recorded as
   approving*. It does not prove the approved effect is the one that happened
   (`docs/internal/050-durable-coordination-design.md` (“14. Guarantees a storage adapter cannot establish”)).
6. **Not signed evidence.** Approvals are unsigned records
   (`docs/internal/050-product-contract.md` (“3.5 Claims Chord must never make”)).
7. **Not adversarial-sandboxed.** The adapter is trusted in-process code
   (`packages/core/src/platform/runtime-loop.js:70`; `docs/internal/050-product-contract.md` (“3.5 Claims Chord must never make”)).
8. **Not the whole Class A set.** Proof 1 covers the governance path; contract hardening, snapshot
   import, and audit reporting are covered by the existing suite (see §6.2) and are **not** re-proved
   here.
9. **Not a public API.** Every import path is experimental; no API is stable
   (`docs/internal/050-product-contract.md` (“3.3 Class B — implemented, but experimental or trusted-host plumbing”)).

---

## 4. Proof 2 — Crash recovery

> **Status: REQUIRES BLOCK 051.**
> **Statement.** A task dispatched by a process that is killed at any point of the effect sequence
> is, after restart, in a state that is **consistent with the durable record**, that **does not
> silently repeat** the effect, and that **does not silently guess** whether the effect occurred.
> **Blocks required:** Block 051 (durable store, lease/fencing, deterministic ids).
> **This proof cannot be written today.** Everything below is a specification for Block 051.

### 4.1 What is missing, precisely

| Capability | Required by Proof 2 | Exists? | Citation |
|---|---|---|---|
| State that outlives the process | yes | **no** | `docs/internal/050-product-contract.md` (“5.3 Level B — Durable, cross-process coordination”) |
| A commit whose success is only reported after the bytes are durable | yes | **no** | `docs/internal/050-durable-coordination-design.md` (“4.3 Crash between state and evidence”) |
| A durable journal with a dense ordinal | yes | **no** | `docs/internal/050-durable-coordination-design.md` (“5.2 Ordering: the missing ordinal”) |
| A startup recovery procedure | yes | **no** | `docs/internal/050-durable-coordination-design.md` (“6.2 Startup reconstruction”) |
| A durable lease and a fencing token | yes | **no** | `docs/internal/050-durable-coordination-design.md` (“7.1 What exists today”) |
| A staged effect acknowledgement written **before** the result commit | yes | **no** | `docs/internal/050-durable-coordination-design.md` (“8.4 The staged effect acknowledgement”) |
| An injectable id source | yes (to identify the in-flight attempt after restart) | **no** | `packages/core/src/utils/id.js:1-4` |

### 4.2 The four windows

Proof 2 is defined over the four windows between "intent to act" and "knowledge of the outcome"
(`docs/internal/050-durable-coordination-design.md` (“8.1 The four windows”)):

| Window | Between | Durable record at its end | Required recovery |
|---|---|---|---|
| **W1** | intent → dispatch decision | claim commit: task `running`, attempt active, lease held, operation `dispatched`, revision bumped | nothing to do; an expired lease sweeps the task to `uncertain` |
| **W2** | dispatch decision → adapter invoked | W1, plus the fact that the adapter **may** have been entered | **unknown** → `uncertain`; never guessed |
| **W3** | adapter invoked → outcome known | W1, plus a staged effect acknowledgement | the outcome is known and can be committed |
| **W4** | outcome known → outcome committed | W3, plus the committed result | nothing; the commit is atomic |

**W2 is irreducible.** Any system that dispatches an external effect and then dies cannot know
whether the effect happened. Proof 2 does **not** claim to resolve W2; it claims that W2 is
**detected** and **quarantined**, and that resolution requires external evidence
(`docs/internal/050-durable-coordination-design.md` (“8.1 The four windows”)).

### 4.3 Scenarios

Proof 2 is four scenarios, one per window. Each scenario:

1. opens a store in a **separate process**;
2. drives the run to the named window;
3. **kills that process** with `SIGKILL` — not `process.exit()`, not an exception, not a graceful
   close, because a graceful close is not a crash;
4. **reopens** the store in a new process;
5. asserts the recovered state.

| # | Kill point | Adapter must have been invoked? | Post-restart expectation |
|---|---|---|---|
| **P2-W1** | after the claim commit, before the adapter is invoked | **no** (`calls === 0`) | after lease expiry the task is `uncertain`, with **0** adapter invocations; recovery must not infer non-execution from the test’s known kill point. A later evidence-backed reconciliation and explicit fresh admission may permit one invocation |
| **P2-W2** | after the adapter was entered, before it returned | **yes** (`calls === 1`) | the task is `uncertain`; `execution_results` is empty; the effect is **not** retried automatically; `replayTask` throws `RECONCILIATION_REQUIRED` |
| **P2-W3** | after the adapter returned and the ack was staged, before the result commit | **yes** (`calls === 1`) | the staged ack is visible; the recovery path can commit the outcome; the total adapter invocations is **1** |
| **P2-W4** | after the result commit | **yes** (`calls === 1`) | the task is `completed`; the result is in `execution_results`; the operation is `confirmed`; **no** re-dispatch |

### 4.4 Assertions

| # | Assertion | Citation |
|---|---|---|
| A2.1 | After any restart, `reduceTrace(storeJournal)` reproduces the stored state exactly. | `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”) (L5) |
| A2.2 | After any restart, **no adapter was invoked** by the recovery path itself. | `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”) |
| A2.3 | During crash recovery, total invocations are **0** for W1 and **1** for W2/W3/W4; recovery itself invokes no adapter. Any later W1 dispatch requires evidence-backed reconciliation and explicit fresh admission. | `docs/internal/050-durable-coordination-design.md` (“8.1 The four windows”) |
| A2.4 | In W2, the task is `uncertain`, the operation state is `unknown`, and `execution_results` is empty. | `packages/core/src/platform/transitions.js:143-147`; `docs/internal/050-durable-coordination-design.md` (“8.1 The four windows”) |
| A2.5 | In W2, `replayTask` throws `RECONCILIATION_REQUIRED` until a human reconciles with the required evidence kind. | `packages/core/src/sdk/chord.js#replayTask`; `packages/core/src/platform/reconciliation.js:39-40` |
| A2.6 | A commit that reports `ok` is present after reopening the store. | `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”) |
| A2.7 | A commit that throws mid-transaction leaves **zero** state rows and **zero** journal rows. | `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”) |
| A2.8 | A corrupt store **fails closed**: it does not start a run. | `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”) |
| A2.9 | Two runs with an injected clock and id source produce **byte-identical** stored bytes. | `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”), `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”) |
| A2.10 | The persisted logical clock floor survives a restart and prevents a backwards clock from throwing `INVALID_CONTEXT`. | `packages/core/src/sdk/chord.js#hostNow`; `docs/internal/050-durable-coordination-design.md` (“11.5 The persisted logical clock floor”) |

### 4.5 Negative cases

| # | Scenario | Expected code |
|---|---|---|
| N2.1 | A stale writer presents an old fencing token | `FENCE_LOST` (`docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”)) |
| N2.2 | A second writer attempts to take a **live** lease | `LEASE_LOST` (`docs/internal/050-durable-coordination-design.md` (“12.3 The contention failure mode”)) |
| N2.3 | A writer commits against a revision the store has already advanced past | `STALE_REVISION` — the check happens **inside** the transaction (`packages/core/src/registry/owner.js:24`; `docs/internal/050-durable-coordination-design.md` (“12.2 What breaks if two processes write today”)) |
| N2.4 | A store with a newer `storage_version` is opened | `UNSUPPORTED_STORAGE_VERSION` (`docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”)) |
| N2.5 | A store with a different `schema_version` is opened | `SCHEMA_MISMATCH` (`packages/core/src/contracts/sigils.js:6`; `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”)) |
| N2.6 | A store lock cannot be acquired within the timeout | `STORAGE_UNAVAILABLE`, and it must **not** be conflated with `STALE_REVISION` (`docs/internal/050-durable-coordination-design.md` (“12.3 The contention failure mode”)) |
| N2.7 | The journal is missing its genesis record | `UNSUPPORTED_HISTORY` (`packages/core/src/platform/trace-reducer.js:18`) |
| N2.8 | The journal's commit chain has a gap | `INCOMPLETE_HISTORY` (`packages/core/src/platform/trace-reducer.js:29`) |

### 4.6 Smallest implementation (Block 051)

Per `docs/internal/050-durable-coordination-design.md` (“15.1 Proposed module layout”):

| Item | Location | Size |
|---|---|---|
| Pure store contract: precondition evaluator, error codes, types | `packages/core/src/storage/contract.js` | new file, ~300 lines |
| In-memory reference adapter (explicitly labelled as such) | `packages/core/src/storage/memory.js` | new file, ~120 lines |
| SQLite adapter | `packages/core/src/runtime/storage/sqlite.js` | new file, ~450 lines |
| Provider selection from host options | `packages/core/src/runtime/storage/select.js` | new file, ~60 lines |
| Startup recovery procedure | `packages/core/src/runtime/recovery.js` | new file, ~220 lines |
| `owner.js` → transact/install write through the store | `packages/core/src/registry/owner.js:22`, `packages/core/src/registry/owner.js:43` | modified |
| `registry.js` → `commitRun` becomes a **pure** precondition evaluation | `packages/core/src/registry/registry.js:32-46` | modified |
| `event-journal.js` → `appendRegistryEvent` accepts `meta.at` | `packages/core/src/platform/event-journal.js:3-21` | modified |
| `runtime-loop.js` → context gains `idempotency_key` and `lease_token`; writes the staged ack | `packages/core/src/platform/runtime-loop.js:67`, `packages/core/src/platform/runtime-loop.js:96-104` | modified |
| `sdk/chord.js` → the host supplies a store, an id source and the clock | `packages/core/src/sdk/chord.js#hostNow` | modified |
| `utils/id.js` → injectable id source | `packages/core/src/utils/id.js:1-4` | modified |
| architecture test → allow `bun:` built-ins, add a runtime-resolved import test | `packages/core/tests/architecture-integrity.test.js:6-14` | modified |

**No contract change.** `SCHEMA_VERSION` stays `"chord.contracts.v1"`
(`docs/internal/050-durable-coordination-design.md` (“15.2 Proposed kernel changes (described, not applied)”)).

### 4.7 Falsifiable pass criteria

Proof 2 passes if and only if **all four** of P2-W1…P2-W4 hold, every assertion in §4.4 holds,
every negative case N2.1…N2.8 produces its exact code, and — critically:

- **the total adapter invocation count across the crash boundary is never 2**; and
- **a committed claim alone does not require an invocation after restart**: W1 remains at 0 and quarantined until evidence-backed reconciliation permits fresh admission.

Proof 2 fails if any of the following is observed:

| Observed | Meaning |
|---|---|
| A task is `completed` after a W2 kill | the kernel guessed. It must be `uncertain`. |
| `calls === 2` across the crash | the effect was repeated without evidence |
| `calls === 0` after a W3/W4 kill | a confirmed effect was lost |
| The recovery path invoked an adapter | recovery must be effect-free (`docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”)) |
| A commit reported `ok` but the data was absent after reopen | the durability barrier was not respected (`docs/internal/050-durable-coordination-design.md` (“4.3 Crash between state and evidence”)) |

### 4.8 What Proof 2 does NOT prove

1. **Not multi-process contention.** One writer at a time; the store serialises.
2. **Not exactly-once.** W2 is irreducible (`docs/internal/050-durable-coordination-design.md` (“8.1 The four windows”)).
3. **Not distributed consensus.** Explicitly out of scope for Block 051
   (`docs/internal/050-durable-coordination-design.md` (“15.4 Explicit non-goals for Block 051”)).
4. **Not that the effect did or did not happen.** Proof 2 proves Chord *detects* the ambiguity and
   *requires evidence*, not that it resolves it.
5. **Not trust across organisational boundaries.** That is Level C
   (`docs/internal/050-product-contract.md` (“5.4 Level C — Federated, trust-bearing coordination”)).
6. **Not that the adapter is safe.** Adapters remain trusted in-process code.
7. **Not a schema migration story.** Journal-version migration is explicitly deferred
   (`docs/internal/050-durable-coordination-design.md` (“10.3 What a `SCHEMA_VERSION` v2 would require”)).

---

## 5. Proof 3 — Independent-process collaboration

> **Status: REQUIRES BLOCK 051 + 052.**
> **Statement.** Two **independent operating-system processes** work the same run against one
> store. For every contended claim exactly one process wins; the loser's work is not performed;
> neither process repeats the other's effect; and both converge on the same committed facts.
> **Blocks required:** Block 051 (store, lease, fencing) **and** Block 052 (multi-process
> coordination protocol).
> **This proof cannot be written today.**

### 5.1 What is missing, precisely

| Capability | Required by Proof 3 | Exists? | Citation |
|---|---|---|---|
| Two processes sharing one logical store | yes | **no** — each process holds its own `owner.registry` object with its own `busy` flag | `docs/internal/050-durable-coordination-design.md` (“12.2 What breaks if two processes write today”) |
| A revision CAS checked **inside** the store transaction | yes | **no** — the check is in-process only | `packages/core/src/registry/owner.js:24`; `docs/internal/050-durable-coordination-design.md` (“12.2 What breaks if two processes write today”) |
| A durable lease with a fencing token | yes | **no** | `docs/internal/050-durable-coordination-design.md` (“7.1 What exists today”) |
| An idempotency key that survives re-admission | yes | **no** — the kernel does not invent one | `packages/core/src/platform/recovery-policy.js:26-29`; `docs/internal/050-durable-coordination-design.md` (“9.4 Idempotency key”) |
| A protocol by which two processes discover and exclude one another | yes | **no** | `docs/internal/050-product-contract.md` (“3.4 Class C — not implemented (must never be presented as current)”) (C3) |

### 5.2 The failure mode Proof 3 exists to exclude

The dangerous variant is checking the revision **outside** the transaction
(`docs/internal/050-durable-coordination-design.md` (“12.2 What breaks if two processes write today”)):

```
Process A reads revision 7.
Process B reads revision 7.
A commits candidate → revision 8.
B commits candidate → the store's revision is now 8, B's expectedRevision is 7 → STALE_REVISION.   ← correct
```

The **wrong** variant:

```
B reads revision 7 → decides to commit → A commits (8) → B commits → revision 9, A's write lost.     ← forbidden
```

Proof 3 must show that the first behaviour is what actually happens.

### 5.3 Scenarios

| # | Scenario | Shape |
|---|---|---|
| **P3-X1** | Two processes race for the **same task** | both open the store; both select the same ready task; both attempt to claim it; **exactly one** claim succeeds; the other receives `STALE_REVISION` or `LEASE_LOST` and performs **no** adapter invocation |
| **P3-X2** | Two processes claim **different** tasks | both claims succeed; both effects happen; both results commit; the final state contains both committed results |
| **P3-X3** | Process A claims a task and dies before invoking the adapter; process B continues | A's lease expires; B's sweep marks the task `uncertain`; B does **not** dispatch it |
| **P3-X4** | Process A is killed mid-effect; process B recovers the store | as Proof 2's W2, plus: B's recovery path invokes no adapter, and A's effect is not repeated |
| **P3-X5** | Two processes commit concurrently against the same revision | exactly one commit succeeds; the other gets `STALE_REVISION`; **no** lost update; the store's revision advances by exactly one per successful commit |
| **P3-X6** | Both processes read the journal and reduce it | both reconstruct the **same** state; the projections are deep-equal |

### 5.4 Assertions

| # | Assertion | Citation |
|---|---|---|
| A3.1 | In P3-X1, exactly one process observes `ok === true` from its claim. | `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”) |
| A3.2 | In P3-X1, the losing process invokes the adapter **zero** times. | `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”), `docs/internal/050-durable-coordination-design.md` (“8.1 The four windows”) |
| A3.3 | In P3-X1, the winning process invokes the adapter **exactly one** time. | `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”), `docs/internal/050-durable-coordination-design.md` (“8.1 The four windows”) |
| A3.4 | In P3-X2, the final state contains **two** committed results and the total adapter invocation count is **2**. | `docs/internal/050-durable-coordination-design.md` (“8.1 The four windows”) |
| A3.5 | In P3-X3 and P3-X4, the surviving process marks the task `uncertain` and does not dispatch it. | `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”) |
| A3.6 | In P3-X5, the store's revision advanced by exactly the number of successful commits, and no update was lost. | `docs/internal/050-durable-coordination-design.md` (“12.2 What breaks if two processes write today”) |
| A3.7 | In P3-X6, both reductions are deep-equal. | `packages/core/src/platform/trace-reducer.js:8-45` |
| A3.8 | Every fenced write uses a token strictly greater than the token it supersedes. | `docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”) |

### 5.5 Negative cases

| # | Scenario | Expected code |
|---|---|---|
| N3.1 | A writer presents an expired fencing token | `FENCE_LOST` (`docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”)) |
| N3.2 | A writer attempts to take a lease held by a live process | `LEASE_LOST` (`docs/internal/050-durable-coordination-design.md` (“12.3 The contention failure mode”)) |
| N3.3 | A writer commits against a superseded revision | `STALE_REVISION` |
| N3.4 | A writer cannot acquire the store lock within the timeout | `STORAGE_UNAVAILABLE` — retryable, and **never** conflated with `STALE_REVISION` (`docs/internal/050-durable-coordination-design.md` (“12.3 The contention failure mode”)) |
| N3.5 | A process reads the journal while another is mid-commit | the reader never observes a partially-applied commit (`docs/internal/050-durable-coordination-design.md` (“12.4 Reader isolation”)) |
| N3.6 | Two processes reconcile the same unknown effect | exactly one reconciliation commits (`packages/core/src/platform/reconciliation.js:31`) |

### 5.6 Smallest implementation (Block 051 + 052)

Everything in §4.6, **plus** Block 052's coordination surface. The normative design for the
multi-process mode is `docs/internal/050-durable-coordination-design.md` (“12. Multi-process access expectations”), which targets
**single-writer, multi-reader** as the primary mode and **multi-writer with store-enforced
serialisation** as the secondary mode
(`docs/internal/050-durable-coordination-design.md` (“12.1 What the design assumes”)).

The Block 051 blast radius (§4.6) is assumed complete; Block 052 adds the cross-process lease
manager, the fencing-token allocator, the sweep for expired leases, and the cross-process test
harness (two child processes, a shared store, a barrier for deterministic interleavings).

### 5.7 Falsifiable pass criteria

Proof 3 passes if and only if, across every scenario:

- the **total** adapter invocation count equals the number of tasks that should have executed —
  never more, never less;
- every contended claim has **exactly one** winner;
- no update is ever lost;
- both processes reconstruct identical state from the journal.

Proof 3 fails if any of the following is observed:

| Observed | Meaning |
|---|---|
| `calls === 2` in P3-X1 | both processes claimed the same task |
| `calls === 0` in P3-X1 | neither process claimed the task |
| The store's revision advanced by more than the number of successful commits | a double bump — the revision is the CAS token (`packages/core/src/registry/owner.js:31`) |
| The two reductions differ | the journal is not a faithful record |
| A stale writer's commit succeeded | the fencing token did not fence |

### 5.8 What Proof 3 does NOT prove

1. **Not multi-host.** Multiple hosts, one logical store, is explicitly unsupported
   (`docs/internal/050-durable-coordination-design.md` (“12.1 What the design assumes”)).
2. **Not distributed consensus.** Out of scope
   (`docs/internal/050-durable-coordination-design.md` (“15.4 Explicit non-goals for Block 051”)).
3. **Not trust federation.** Level C (`docs/internal/050-product-contract.md` (“5.4 Level C — Federated, trust-bearing coordination”)).
4. **Not a network actor surface.** C7 is Class C
   (`docs/internal/050-product-contract.md` (“3.4 Class C — not implemented (must never be presented as current)”)).
5. **Not exactly-once.** Even with leases and fencing, W2 is irreducible
   (`docs/internal/050-durable-coordination-design.md` (“8.1 The four windows”)).
6. **Not a hosted multi-tenant service.** C8 is Class C
   (`docs/internal/050-product-contract.md` (“3.4 Class C — not implemented (must never be presented as current)”)).

---

## 6. Level A traceability

### 6.1 Proof 1 → Class A capabilities

Class A is defined at `docs/internal/050-product-contract.md` (“3.2 Class A — implemented and verified (the Level A capability set)”) (45 rows). Proof 1 exercises
the governance path end to end; the column below gives the Proof 1 step or negative case that
exercises each row.

| Class A | Capability (abbreviated) | Proof 1 coverage | Existing named test (already passing) |
|---|---|---|---|
| A1 | Pure deterministic authority evaluator | S3, N1, N3 | `packages/core/tests/authorization.test.js:78` |
| A2 | Host owns clock and snapshot; clock rollback fails closed | S1, A1.1 | `packages/core/tests/authorization.test.js:277` |
| A3 | Actor↔principal binding; roles confer nothing | S1 | `packages/core/tests/adversarial.test.js:42`, `packages/core/tests/adversarial.test.js:71` |
| A4 | Capability alone insufficient | N1 | `packages/core/tests/adversarial.test.js:58` |
| A5 | Exact scope equality | N1, N2 | `packages/core/tests/adversarial.test.js:101` |
| A6 | Active deny beats allow | N4 | `packages/core/tests/adversarial.test.js:162` |
| A7 | Temporal validity; immediate revocation | N3 | `packages/core/tests/adversarial.test.js:136`, `packages/core/tests/adversarial.test.js:147` |
| A8 | Approval bound to revision/attempt/scope; consumed | S4, S5, N6, N7 | `packages/core/tests/adversarial.test.js:198`, `packages/core/tests/adversarial.test.js:234` |
| A9 | Rejection beats approval; self-approval impossible | N5 | `packages/core/tests/adversarial.test.js:214`, `packages/core/tests/adversarial.test.js:219` |
| A10 | Decisions are data, never tokens | S3, N1 | `packages/core/tests/adversarial.test.js:86` |
| A11 | Guarded state machines | N18, N22 | `packages/core/tests/transitions.test.js:70`, `packages/core/tests/transitions.test.js:94`, `packages/core/tests/transitions.test.js:107`, `packages/core/tests/transitions.test.js:125` |
| A12 | Atomic batch admission | N2 | `packages/core/tests/adversarial.test.js:286` |
| A13 | Duplicate admission rejected | N19 | `packages/core/tests/adversarial.test.js:299` |
| A14 | Lease caps defer before any effect | (S3 sibling) | `packages/core/tests/transitions.test.js:486` |
| A15 | Deterministic queue selection | A1.5 | `packages/core/tests/hardening.test.js:89` |
| A16 | Attempt reservation single-use | S4, A1.14 | `packages/core/tests/adversarial.test.js:234` |
| A17 | Commit-time re-authorization | N12, N13 | `packages/core/tests/transitions.test.js:203`, `packages/core/tests/transitions.test.js:222`, `packages/core/tests/transitions.test.js:242` |
| A18 | Cancellation beats a late result | N12 | `packages/core/tests/transitions.test.js:314` |
| A19 | Malformed results never normalise | N10, N11 | `packages/core/tests/adversarial.test.js:389`, `packages/core/tests/adversarial.test.js:375` |
| A20 | Bounded pre-dispatch retry → dead-letter | (S3 sibling) | `packages/core/tests/hardening.test.js:40` |
| A21 | Post-dispatch ambiguity → `uncertain` | N9 | `packages/core/tests/transitions.test.js:167` |
| A22 | Structural operation quarantine | N14 | `packages/core/tests/recovery-integrity.test.js:11` |
| A23 | Evidence-gated human reconciliation | N15, N16, N17 | `packages/core/tests/recovery-integrity.test.js:15`, `packages/core/tests/recovery-integrity.test.js:21`, `packages/core/tests/recovery-integrity.test.js:24`, `packages/core/tests/recovery-integrity.test.js:27` |
| A24 | Competing reconciliation cannot both commit | N16 | `packages/core/tests/recovery-integrity.test.js:32` |
| A25 | Run lifecycle gates dispatch | (S3 sibling) | `packages/core/tests/lifecycle-integrity.test.js:14` |
| A26 | Approval pause/resume/reject/cancel | N5 | `packages/core/tests/continuity.test.js:44` |
| A27 | Handoff with CAS, correlation, wrong-actor rejection | (out of Proof 1's scope) | `packages/core/tests/continuity.test.js:65`, `packages/core/tests/continuity.test.js:77` |
| A28 | Grant-scoped bounded projection | (A1.7 sibling) | `packages/core/tests/admission-integrity.test.js:5`, `packages/core/tests/admission-integrity.test.js:11` |
| A29 | Private owner; clone → validate → install | S1 | `packages/core/tests/integrity.test.js:10`, `packages/core/tests/integrity.test.js:19` |
| A30 | Reads and retained inputs cannot mutate state | A1.5, A1.13 | `packages/core/tests/integrity.test.js:27` |
| A31 | Shared canonical transition invariants | N20–N22 | `packages/core/tests/integrity.test.js:42`, `packages/core/tests/integrity.test.js:54` |
| A32 | Versioned committed-fact history; zero-effect replay | S6 | `packages/core/tests/replay-integrity.test.js:7`, `packages/core/tests/replay-integrity.test.js:14` |
| A33 | Incomplete/foreign/duplicate/mixed history rejected | N20, N21, N22, N23 | `packages/core/tests/replay-integrity.test.js:21` |
| A34 | Ordered trace diff | (out of Proof 1's scope) | `packages/core/tests/fault-injection.test.js:23` |
| A35 | Contract hardening | (out of Proof 1's scope) | `packages/core/tests/contracts.test.js:73`, `packages/core/tests/contracts.test.js:82`, `packages/core/tests/contracts.test.js:91` |
| A36 | Closed input surface | (out of Proof 1's scope) | `packages/core/tests/contracts.test.js:133` |
| A37 | Snapshot export/serialize/import quarantine | (out of Proof 1's scope) | `packages/core/tests/contracts.test.js:202` |
| A38 | Deterministic audit report and journal view | (out of Proof 1's scope) | `packages/core/tests/fault-injection.test.js:32` |
| A39 | Provider-neutral adapter routing | S3, A1.11 | `packages/core/tests/architecture-integrity.test.js:6` |
| A40 | Configurable runtime policy | (out of Proof 1's scope) | `packages/core/tests/contracts.test.js:144` |
| A41 | Replay via fresh admission | N14, N17, N18 | `packages/core/tests/transitions.test.js:350`, `packages/core/tests/transitions.test.js:372` |
| A42 | No write handle leaks to adapters | (S3 sibling) | `packages/core/tests/adversarial.test.js:352` |
| A43 | Reentrant callbacks fail before install or effect | (out of Proof 1's scope) | `packages/core/tests/admission-integrity.test.js:21` |
| A44 | One demonstrated end-to-end governed workflow | **S1–S6 in full** | `packages/core/tests/canonical-example.test.js:5` |
| A45 | Minimal auditable dependency surface | (out of Proof 1's scope) | `packages/core/tests/architecture-integrity.test.js:6` |

### 6.2 Class A rows Proof 1 deliberately does not re-prove

Rows A14, A20, A25, A27, A28, A34, A35, A36, A37, A38, A40, A42, A43, A45 are covered by the
existing suite and cited above. Proof 1 does **not** re-implement them: re-proving an existing
guarantee inside a proof adds maintenance surface and produces no new evidence. They are listed so
the omission is deliberate and visible rather than accidental.

### 6.3 Level A gates → proofs

The Level A gate table is `docs/internal/050-product-contract.md` (“6.2 Gate table”).

| Gate | Subject | Proof 1 | Proof 2 | Proof 3 |
|---|---|---|---|---|
| **G1** | The kernel behaves as the contract claims | **Supports** — the governance path is re-proved end to end with citations | Supports the durability subset | Supports the contention subset |
| **G2** | The authority boundary is genuinely closed | **Supports** — N1–N8, N19 | inherits | inherits |
| **G3** | The effect boundary is honest | **Supports** — N9–N13 | **Directly addresses** the W2 ambiguity | **Directly addresses** cross-process repetition |
| **G4** | The record is reconstructible | **Supports** — S6, N20–N23 | Extends it to durable journals | Extends it to concurrent readers |
| **G5** | The public surface is coherent | **Supports** — §3.6 enumerates the live exports | — | — |
| **G6** | The limits are disclosed | **Supports** — §3.8 of every proof | — | — |
| **G7** | The architecture constraint holds | Neutral — unchanged by Proof 1 | Constrains the storage adapter (D2) | — |
| **G8** | Release evidence describes real artifacts | Neutral | — | — |
| **G9–G12** | Preview-distribution gates | **Not addressed** — these are maintainer-owned identity/legal/distribution gates (`docs/internal/050-product-contract.md` (“6.2 Gate table”)), not code defects | — | — |

**Proof 1 does not move the release gate.** Level A capability is complete and verified; Level A
*as a public preview* is blocked on G9–G12
(`docs/internal/050-product-contract.md` (“6.3 Narrative for the unmet gates”)). Proof 1 changes neither fact.

---

## 7. Current status

| Proof | Status | Blocking condition | Owner | Block |
|---|---|---|---|---|
| **Proof 1** | **PROVABLE TODAY** — specified, not yet written | One test file and one harness fixture must be written and pass | implementing engineer | 050 |
| **Proof 2** | **BLOCKED** | No durable store, no recovery procedure, no fencing, no injectable id source | Block 051 implementer | 051 |
| **Proof 3** | **BLOCKED** | Block 051 incomplete, and no cross-process coordination protocol exists | Block 051 + 052 implementers | 051 + 052 |

**Nothing in this document claims Proof 2 or Proof 3 exists, is close to existing, or is partially
working.** Level B is "not implemented" and "deferred to Blocks 051–052"
(`docs/internal/050-product-contract.md` (“5.3 Level B — Durable, cross-process coordination”)).

---

## 8. Effort and dependency order

### 8.1 Estimates

| Proof | Item | Estimate | Notes |
|---|---|---|---|
| **Proof 1** | Harness fixture | 0.5 day | §2.2 verbatim |
| | Test file (27 assertions + 23 negatives) | 1.5 days | The negatives are the bulk; each is 5–10 lines |
| | Review + citation re-verification | 0.5 day | Every `file:line` must be re-opened against the merged tree |
| | **Proof 1 total** | **2.5 days** | **Zero production code** |
| **Proof 2** | Pure store contract + precondition evaluator | 3 days | `docs/internal/050-durable-coordination-design.md` (“15.1 Proposed module layout”) |
| | SQLite adapter (D1) | 5 days | Includes D2's `bun:` allowlist and the Node/Bun dual-runtime suite (D3) |
| | Atomic state + journal commit (`synchronous=FULL`, D4) | 4 days | `docs/internal/050-durable-coordination-design.md` (“4.1 The atomic unit”) |
| | Startup recovery + uncertainty sweep (D6) | 3 days | `docs/internal/050-durable-coordination-design.md` (“6.2 Startup reconstruction”) |
| | Durable lease + fencing token | 3 days | `docs/internal/050-durable-coordination-design.md` (“7. Attempt leasing and fencing”) |
| | Staged effect acknowledgement | 2 days | `docs/internal/050-durable-coordination-design.md` (“8.4 The staged effect acknowledgement”) |
| | Injectable clock floor + id source | 2 days | `docs/internal/050-durable-coordination-design.md` (“11. Deterministic time and ID injection”) |
| | Proof 2 test file (W1–W4, kill harness) | 4 days | Includes the byte-identical-commit test, which should be written first (`docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”)) |
| | Independent verification pass | 3 days | The standard applied to Blocks 046–047 |
| | **Proof 2 total** | **~29 days** | Plus the maintainer decisions D1–D6, which are not the implementer's to make (`docs/internal/050-durable-coordination-design.md` (“16. Decisions required from the maintainer”)) |
| **Proof 3** | Cross-process lease manager + sweep | 4 days | Block 052 |
| | Fencing-token allocator | 3 days | Block 052 |
| | Cross-process test harness (child processes, barriers) | 3 days | Block 052 |
| | Proof 3 test file (X1–X6) | 4 days | |
| | Independent verification pass | 3 days | |
| | **Proof 3 total** | **~17 days** | On top of Proof 2 |

### 8.2 Dependency order

```
Block 050 (this document)
    │
    ├─► Proof 1 implementation           [no dependencies]
    │      2.5 days, zero production code
    │
    └─► Block 051                        [durable store]
           │  D1 storage provider · D2 bun:sqlite · D3 runtime parity
           │  D4 synchronous=FULL · D5 write amplification · D6 automatic recovery
           │
           ├─► pure store contract        [reviewable, no I/O]
           ├─► injectable clock + id source
           ├─► atomic commit + journal
           ├─► startup recovery + sweep
           ├─► lease + fencing token
           └─► staged effect acknowledgement
                  │
                  └─► Proof 2 implementation + verification
                          │
                          └─► Block 052  [multi-process coordination]
                                  └─► Proof 3 implementation + verification
```

**Ordering constraints [Verified from the design]:**

- The injectable id source must land **before** Proof 2's test file — otherwise "this attempt is
  the one that was in flight" cannot be asserted after a restart
  (`packages/core/src/utils/id.js:1-4`; `docs/internal/050-durable-coordination-design.md` (“11.3 Complete enumeration of identifier sites”)).
- The pure store contract must be **pure** — no I/O — so it can be tested exhaustively and reused
  by the reducer path (`docs/internal/050-durable-coordination-design.md` (“15.1 Proposed module layout”)).
- The byte-identical-commit test should be written **first** in Proof 2, because it forces every
  timestamp and id in the commit unit to be deterministic
  (`docs/internal/050-durable-coordination-design.md` (“15.3 Proposed test list”)).
- Block 051 must not change `SCHEMA_VERSION`
  (`docs/internal/050-durable-coordination-design.md` (“15.2 Proposed kernel changes (described, not applied)”), `docs/internal/050-durable-coordination-design.md` (“9.4 Idempotency key”)).
- `importRegistry` must **not** become the recovery path
  (`docs/internal/050-durable-coordination-design.md` (“15.4 Explicit non-goals for Block 051”); §6.5 of the design).

### 8.3 Maintainer decisions that block Proof 2 and Proof 3

None of these is the implementer's to make
(`docs/internal/050-durable-coordination-design.md` (“16. Decisions required from the maintainer”)):

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Which storage provider? | SQLite (`docs/internal/050-durable-coordination-design.md` (“16. Decisions required from the maintainer”)) |
| D2 | How to satisfy the dependency policy for `bun:sqlite`? | (a) extend the architecture test with a `bun:` allowlist plus a runtime-resolved import test (`docs/internal/050-durable-coordination-design.md` (“16. Decisions required from the maintainer”)) |
| D3 | Accept `bun:sqlite` maturity? | Accept, but run the adapter's suite under **both** runtimes (`docs/internal/050-durable-coordination-design.md` (“16. Decisions required from the maintainer”)) |
| D4 | `synchronous` level? | `FULL` (`docs/internal/050-durable-coordination-design.md` (“16. Decisions required from the maintainer”)) |
| D5 | Accept O(run size) write amplification? | Accept and record the cost (`docs/internal/050-durable-coordination-design.md` (“16. Decisions required from the maintainer”)) |
| D6 | Automatic or host-driven recovery? | Automatic at `open()` (`docs/internal/050-durable-coordination-design.md` (“16. Decisions required from the maintainer”)) |

---

## 9. Risks

| # | Risk | Consequence | Mitigation |
|---|---|---|---|
| R1 | **Proof 1 is mistaken for Proof 2.** A reader sees "governed workflow proven" and infers crash safety. | A false durability claim — prohibited (`docs/internal/050-product-contract.md` (“5.3 Level B — Durable, cross-process coordination”)). | Every proof states its block requirement in its header, and §3.8/§4.8/§5.8 enumerate what is *not* proven. |
| R2 | **The two codes the SDK's decision surface cannot produce are "fixed" by relaxing the scope check.** | Weakens the authority boundary to make a proof pass. | §3.5 records the gap explicitly. The right fix is to *export* the evaluator, not to loosen it. |
| R3 | **Nondeterministic ids make Proof 1 flaky.** | A red test that gets "fixed" by weakening an assertion. | Proof 1 asserts identifier *relationships*, never identifier *values* (§2.4). |
| R4 | **Proof 2's W2 is "resolved" by auto-retrying.** | The kernel guesses about an effect it cannot observe. | §4.7 makes `calls === 2` across the crash an explicit failure. |
| R5 | **Block 051 changes `SCHEMA_VERSION` alongside the storage layer.** | Two hard-to-review changes at once; migration apparatus activated prematurely. | `docs/internal/050-durable-coordination-design.md` (“9.4 Idempotency key”), `docs/internal/050-durable-coordination-design.md` (“15.2 Proposed kernel changes (described, not applied)”). |
| R6 | **The revision check is placed outside the store transaction.** | Lost updates — the exact failure Proof 3 exists to exclude. | `docs/internal/050-durable-coordination-design.md` (“12.2 What breaks if two processes write today”); §5.2 of this document. |
| R7 | **Proof 1's harness is written differently from Proof 2's.** | Proof 2 discards Proof 1's fixtures; duplicated effort; inconsistent measurement. | §2 defines one harness, used by all three. |
| R8 | **The proof files are created for Proofs 2/3 before their blocks land.** | Failing tests or vacuous tests in the tree. | §2.5: only Proof 1's file is created by this block. |
| R9 | **The error vocabulary is hardcoded in proofs and drifts.** | Proofs assert codes the kernel no longer produces. | The codes are quoted verbatim from source in §3.4; they are re-verified at review (§8.1). |

---

## Appendix A — Citation index

Every `file:line` reference in this document (body and appendices), grouped by file. The list is
mechanical: it was produced by extracting every `path:line` reference and merging the ranges.
All cited files were opened directly in this pass.

| File | Lines cited | What is there |
|---|---|---|
| `packages/core/src/index.js` | 1-6 | The root barrel: 30 exports |
| `packages/core/src/sdk/index.js` | 1 | The SDK barrel |
| `packages/core/src/platform/index.js` | 1-8 | The platform barrel: 22 exports; `evaluateAuthority` is **not** among them |
| `packages/core/src/sdk/chord.js` | Stable `module#symbol` references in the body; search named functions/members | `createChord`, `hostNow`, `setAuthoritySnapshot`, `installGrants`, `createTaskGrant`, `createApproval`, `parseText`, `createTaskPackets`, `queueTaskPackets`, `registerSpecAndQueue`, `prepareAttempt`, `cancelTask`, `replayTask` |
| `packages/core/src/platform/authorization.js` | 34-53, 59, 62-63, 93, 102-104, 115-118, 120-121, 128-135, 138 | `evaluateAuthority` — the pure evaluator, and every decision code in the vocabulary |
| `packages/core/src/contracts/sigils.js` | 3, 6, 101-102, 104, 117-130, 132, 148, 179, 189 | `SCHEMA_VERSION`, the contract error list, the `Principal`/`Actor`/`Approval` shapes, `DECISION_CODES`, `Intent`, `AdapterResult`, `RegistryData` |
| `packages/core/src/platform/runtime-loop.js` | 42-92, 96-104 | `runRuntimeCycle` — claim, dispatch evaluation, adapter invocation, commit re-authorization, the uncertainty path |
| `packages/core/src/platform/attempts.js` | 8-26 | `prepareAttemptRecord` (single-use reservation) |
| `packages/core/src/platform/reconciliation.js` | 31, 35-36, 39-48 | `reconcileTask` — the revision guard, the human-principal rule, the evidence rules |
| `packages/core/src/platform/recovery-policy.js` | 12-19, 26-29 | `isRetryEligible` (no blind retry), `getIdempotencyKey` |
| `packages/core/src/platform/transitions.js` | 143-147 | `markTaskUncertain` — the quarantine path |
| `packages/core/src/platform/state-invariants.js` | 11 | The immutable-task field list |
| `packages/core/src/platform/trace-reducer.js` | 8-48 | `reduceTrace`, `replayNoSideEffects` |
| `packages/core/src/platform/handoff.js` | 18 | `projectContext` — the status override that keeps `TASK_CANCELLED` unreachable |
| `packages/core/src/platform/adapter-routing.js` | 5-12 | `resolveAdapter` |
| `packages/core/src/platform/event-journal.js` | 3-21 | `appendRegistryEvent` — the `meta.at` seam Block 051 would use |
| `packages/core/src/registry/owner.js` | 8-10, 15-19, 22-44 | The private owner: `transact`, the revision CAS, the journal capture |
| `packages/core/src/registry/registry.js` | 32-46, 132-135, 157 | `commitRun`, the committed-result append, and the `INVALID_RESULT` guard |
| `packages/core/src/registry/snapshot.js` | 31-45 | `importRegistry` and its in-flight quarantine |
| `packages/core/src/utils/id.js` | 1-4 | `stableId` — nondeterministic today |
| `packages/core/src/runtime/adapter.js` | 2-14 | The unused text I/O helper — the only filesystem access in the package |
| `packages/core/tests/authorization.test.js` | 78, 92, 117-118, 203, 277 | Determinism, `SCOPE_MISMATCH`, approval reuse, snapshot monotonicity |
| `packages/core/tests/adversarial.test.js` | 42, 58, 71, 86, 101, 136, 147, 162, 198, 214, 219, 234, 259, 286, 299, 313, 352, 375, 389, 460, 476 | Role/capability, deny precedence, approval misuse, atomic admission, duplicate admission, stale revision, write-handle leakage, malformed results, the approval gate |
| `packages/core/tests/transitions.test.js` | 70, 94, 107, 125, 167, 203, 222, 242, 314, 322-332, 350, 372, 392, 486 | The state machine, the uncertainty path, the commit guards, cancellation, replay, lease caps |
| `packages/core/tests/continuity.test.js` | 44, 65, 77 | Approval rejection, handoff |
| `packages/core/tests/replay-integrity.test.js` | 6-7, 14, 21 | The `projection` helper, replay equivalence, history rejection |
| `packages/core/tests/recovery-integrity.test.js` | 11, 15, 21, 24, 27, 32 | Quarantine, evidence rules, competing reconciliation |
| `packages/core/tests/fault-injection.test.js` | 23, 32 | Trace diff, journal audit |
| `packages/core/tests/contracts.test.js` | 73, 82, 91, 133, 144, 202 | Contract hardening, closed input, policy, snapshot validation |
| `packages/core/tests/integrity.test.js` | 10, 19, 27, 42, 54 | Owner atomicity, read isolation, canonical transitions |
| `packages/core/tests/admission-integrity.test.js` | 5, 11, 21 | Scoped projection, reentrant callbacks |
| `packages/core/tests/lifecycle-integrity.test.js` | 14 | Run lifecycle gates |
| `packages/core/tests/hardening.test.js` | 40, 89 | Dead-letter consistency, deterministic dequeue |
| `packages/core/tests/architecture-integrity.test.js` | 6-14 | The architecture constraint test |
| `packages/core/tests/canonical-example.test.js` | 5 | The existing end-to-end workflow assertion |
| `packages/core/examples/cross-actor-workflow.mjs` | 65-104 | The canonical governed workflow: denial, attempt preparation, approval install, approved dispatch, zero-effect replay |
| `docs/internal/050-product-contract.md` | 197-245, 253, 263, 269-276, 289, 293, 442-444, 453-457, 506-519, 527-530 | Class A/B/C classification, Level A/B/C definitions, the gate table |
| `docs/internal/050-durable-coordination-design.md` | 104-180, 328-403, 416-432, 473-536, 549-643, 648-655, 657, 688-718, 784, 809, 884, 896-1005, 1007-1075, 1191, 1206-1235, 1243, 1245-1249, 1251, 1255, 1261, 1265-1270 | The store interface, the four crash windows, recovery, leasing and fencing, idempotency, deterministic time and ids, multi-process expectations, Block 051's bounded scope and test list, decisions D1–D6 |
| `docs/internal/050-developer-api-review.md` | 189-234, 529-548, 711-715 | The SDK member table, the error vocabulary, the deep contract shapes |

---

## Appendix B — Verification record

**Suite (run in `packages/core`):**

```
$ bun test
166 pass
0 fail
1418 expect() calls
166 tests across 15 files
```

**Runtime validation:**

```
$ bun run src/verify-runtime.js
(exit 0)
ALL RUNTIME VALIDATIONS PASSED!
```

**Export enumeration (mechanical, against the live module graph):**

```
ROOT EXPORTS (30): SCHEMA_VERSION, appendRegistryEvent, canonicalProjection,
computeBackoffDelayMs, createAdapterRouter, createChord, createDeterministicAuditReport,
createRuntimePolicy, createTaskQueue, dequeueReadyTask, diffTraces, enqueueTask, exportRegistry,
importRegistry, leaseTaskEntry, listDeadLetterTasks, listQueuedTasks, listRegistryEvents,
markQueueEntryStatus, queryArtifacts, queryDomains, reduceTrace, replayDeadLetterTask,
replayNoSideEffects, replayRegistryJournal, resolveAdapter, runRuntimeCycle, scheduleTaskRetry,
selectReadyTask, serializeRegistry

SDK MEMBERS (38): _invalidatePendingAttempt, cancelRun, cancelTask, commitRun, createApproval,
createTaskGrant, createTaskPackets, exportRegistry, getAuthority, getRegistry, getRunRevision,
getRunState, inspectAudit, inspectEvents, parseText, pauseForApproval, prepareAttempt,
projectContext, proposeHandoff, queryArtifacts, queryDeadLetters, queryDomains, queryQueue,
queueTaskPackets, reconcileTask, registerSpec, registerSpecAndQueue, registry, rejectApproval,
replayJournal, replayTask, respondToHandoff, resumeRun, runCycle, serializeRegistry,
setAdapterRouter, setAuthoritySnapshot, setRuntimePolicy

REQUIRED SDK MEMBERS MISSING: []
REQUIRED ROOT EXPORTS MISSING: []
```

**Reachability scan for the decision vocabulary:**

```
$ grep -rn "SCOPE_MISMATCH" src/ tests/ examples/
src/platform/authorization.js:93
src/contracts/sigils.js:132
tests/authorization.test.js:117
tests/authorization.test.js:118

$ grep -rn "TASK_CANCELLED" src/ tests/
src/platform/authorization.js:59
src/contracts/sigils.js:132
tests/authorization.test.js:92
tests/transitions.test.js:330
```

`evaluateAuthority` is exported by `packages/core/src/platform/authorization.js` but **not** by any
barrel (`packages/core/src/index.js:1-6`, `packages/core/src/sdk/index.js:1`,
`packages/core/src/platform/index.js:1-8`). The two `SCOPE_MISMATCH` assertions therefore reach
an internal module — the basis for §3.5.

**Citation verification (every `file:line` reference in this document, body and code fences):**

```
citation occurrences: 351
distinct reference strings (file:line or file:a-b): 261
distinct file:line pairs: 1313
distinct files referenced: 39

problems: 0    (every cited file exists; every cited line is in range)
appendix table rows: 39
appendix over-claims: 0    (no table row claims a line the document does not cite)
appendix gaps: 0           (every cited line appears in its file's appendix row)
```

**No file other than this document was created, modified, or deleted by this pass.**


## Pass A1 clarification / supersession

Proof files/harness and storage/fencing codes in Proofs 2–3 remain proposed, not created or executed. Appendix B’s numeric citation inventory is a historical measurement, superseded by the stable SDK refs and A1 checks in `050-citation-closeout.md`. Dedicated admission derives/validates immutable scope; privileged `commitRun` is not an actor-security boundary. N12 remains a public commit-stage `TASK_CANCELLED` case despite §3.5’s broader exclusion wording. The canonical example is exercised by the existing test suite. W1 expectations now quarantine without automatic dispatch, consistent with design §6.4 and P3-X3. `expectedAuthorityRevision` expects the incoming/next revision, not the old one.
