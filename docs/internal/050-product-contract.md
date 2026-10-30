# CHORD — Block 050: Product Contract
> **A1 reading note:** original pass measurements are historical; see “Pass A1 clarification / supersession” below and `docs/internal/050-citation-closeout.md` for current verification.
**Pass:** 2 — `product-architect`
**Repository:** `/home/d/Workspace/other-projects/chord`
**Branch / HEAD:** `base` / `08728e48772db14a247add9143669a8e0eab01fa`
**Package identity under contract:** `@antistructured/chord@0.4.0-preview.1` (`packages/core/package.json`)
**Kernel dependency:** `@weipertda/sigiljs@0.18.0` (`packages/core/src/contracts/sigils.js:1`)
**Baseline of record:** `docs/internal/050-baseline-lock.md`
**Status:** DEFINITIVE — this document is the product contract for Block 050 and the normative input to the release blocks that follow.
**Files changed by this pass:** this document only. No source, test, manifest, example, README or lockfile was modified. No commit, push, tag, publish, merge, reset, checkout, restore, stash or clean was performed.

---

## 0. How to read this document

### 0.1 Evidence labels

Every substantive statement about what Chord does carries one of three labels. The labels are load-bearing: a later block may quote a claim from this document into public material, and the label travels with it.

| Label | Meaning | Obligation on the author |
|---|---|---|
| **Verified** | Demonstrated directly by the cited `file_path:line_number` and, where a behaviour exists, by a named test that was executed during this pass (see §8.1). | Must carry a citation. Behavioural claims should also carry a named test. |
| **Inferred** | Reasoned from cited evidence but not directly demonstrated by an executed test. | Must carry a citation and be worded as a conclusion, not an observation. |
| **Not verified** | Recorded in repository documentation or prior block reports but **not** re-verified in this pass; or entirely outside the repository (market claims, legal facts, registry state). | Must be named as such. Must never be restated as a Chord capability. |

### 0.2 Scope of authority

This document defines product intent, persona, positioning, capability boundaries and release levels. It does **not**:

- change any behaviour in `packages/core/src/**` or `packages/core/tests/**`;
- designate any API stable (no API is stable — `docs/internal/047-public-api-compatibility.md:6`);
- authorize publication, tagging, or any npm/GitHub action;
- assert anything about competitor products beyond what §4 explicitly marks as market characterization.

### 0.3 Citation convention

Current SDK citations use repository-relative `module#symbol` references (search for the named function/member); retained line citations are historical locators, e.g. `packages/core/src/platform/authorization.js:32`. Test citations name the test file and the test title as it appears in the source, e.g. `packages/core/tests/adversarial.test.js:42` — `"role strings never substitute for capabilities"`. The recorded HEAD excludes pre-existing dirty Block 050 changes; see `docs/internal/050-citation-closeout.md` for A1 working-tree verification.

---

## 1. Product definition

### 1.1 Thesis

> **Chord turns intent into governed execution across independent human and machine actors.**

This sentence is the product. Everything else in this document is either a consequence of it or a constraint on it.

Three words in the thesis carry the whole product argument, and each maps to a mechanism that exists today:

| Thesis term | What it means in Chord | Mechanism (Verified) |
|---|---|---|
| **intent** | A versioned, structured description of requested work that is explicitly *not* permission to execute. | `packages/core/src/sdk/chord.js#parseText`, `packages/core/src/sdk/chord.js#createTaskPackets` (`parseText`); `packages/core/src/contracts/sigils.js:148` (`Intent`); `packages/core/src/sdk/chord.js` (`createTaskPackets`) |
| **governed** | Every admission and every dispatch is decided by a deterministic evaluator against host-attested authority, exact scope, temporal validity and — where required — an exact, consumed, human approval. | `packages/core/src/platform/authorization.js:32` (`evaluateAuthority`); `packages/core/src/platform/authorization.js:128` (dispatch approval gate); `packages/core/src/platform/authorization.js:146` (commit-stage approval consumption) |
| **independent** | Human and machine actors are separate, separately-attested identities with separate capabilities; neither can mint authority for the other, and a role string is not authority. | `packages/core/src/platform/authorization.js:81` (actor↔principal binding); `packages/core/src/platform/authorization.js:82` (capability, not role); `packages/core/src/contracts/sigils.js:108` (`Actor` carries `capabilities`) |

The word **execution** is deliberate and equally constrained: Chord governs the *admission, authorization, dispatch, commit, uncertainty and reconciliation* of an execution. It does not own the effect. See §1.5.

### 1.2 Positioning statement

> **Chord — Governed coordination for humans, AI agents, and services.**
>
> **Turn intent into governed execution.**

These two lines are the public positioning and are reproduced verbatim in §4.5 and in any downstream public documentation.

### 1.3 One-paragraph definition

Chord is an embeddable coordination kernel, distributed as a single JavaScript ES-module package, that sits between an embedding host and the actors that act on the host's behalf. A host installs an authoritative snapshot describing principals, actors, capabilities, grants and approvals (`packages/core/src/sdk/chord.js#setAuthoritySnapshot`), submits intent as structured specs, and then lets Chord decide — deterministically and without ambient trust — which actor may perform which exact task, at which moment, under whose approval, and which externally-visible effects may be treated as committed. Chord records every accepted transition as a versioned committed fact, so the run can be reconstructed, diffed and audited without re-running any provider. **Verified** (`packages/core/src/registry/owner.js:11`, `packages/core/src/registry/owner.js:15`, `packages/core/src/platform/trace-reducer.js:8`, `packages/core/src/platform/trace-reducer.js:46`).

### 1.4 What the product does, mechanically

The following six steps are the entire product. Everything else is surface area.

1. **Host establishes truth.** The embedding host — not the model, not the actor, not any request payload — supplies the clock and the authority snapshot. The clock is monotonic and fails closed on rollback (`packages/core/src/sdk/chord.js#hostNow`, `packages/core/src/sdk/chord.js#setAuthoritySnapshot`); the authority snapshot is validated, run-matched, revision-matched and monotonic (`packages/core/src/sdk/chord.js`). **Verified** — test `"authority snapshot revisions are monotonic and clock rollback fails closed"` (`packages/core/tests/authorization.test.js:277`).
2. **Intent becomes a task.** Structured text or a structured spec is parsed into a spec (`packages/core/src/sdk/chord.js#parseText`, `packages/core/src/sdk/chord.js#createTaskPackets`) and converted into immutable task packets (`packages/core/src/sdk/chord.js`, `packages/core/src/execution/task-packets.js:4`, `packages/core/src/execution/task-packets.js:33`).
3. **Admission is authorized.** Admission evaluates the `admit` stage of the authority evaluator and binds an immutable authority binding to the task (`packages/core/src/sdk/chord.js#queueTaskPackets`, `packages/core/src/sdk/chord.js#mutate`); a denied member aborts the whole batch with nothing written (`packages/core/src/sdk/chord.js`). **Verified** — test `"batch admission is atomic: one denial registers no member"` (`packages/core/tests/adversarial.test.js:286`).
4. **Dispatch is authorized and leased.** The runtime cycle selects a ready task, respects per-entity and global lease caps, prepares an attempt, re-evaluates authority at the `dispatch` stage, and only then invokes the adapter (`packages/core/src/platform/runtime-loop.js:27`, `:42`, `:48-52`, `:70`). **Verified** — tests `"per-entity and global lease caps defer dispatch before any effect"` (`packages/core/tests/transitions.test.js:486`) and `"unauthorized dispatch invokes zero adapters and leaves the task queued"` (`packages/core/tests/authorization.test.js:246`).
5. **Commit is re-authorized, or the effect becomes unknown.** After the adapter returns, authority is re-evaluated at the `commit` stage against the attempt's captured grants, approval and lease; any failure marks the task `uncertain` rather than guessing (`packages/core/src/platform/runtime-loop.js:82-88`). **Verified** — test `"expired lease at commit marks uncertain"` (`packages/core/tests/transitions.test.js:242`).
6. **Everything is recorded as a committed fact.** Each accepted mutation appends a versioned commit with a computed state delta (`packages/core/src/registry/owner.js:15-19`), and the recorded history can be reduced back into full canonical state with zero effects invoked (`packages/core/src/platform/trace-reducer.js:30`, `:47`). **Verified** — test `"REPLAY: committed admission/dispatch/result projection equals original with zero effects"` (`packages/core/tests/replay-integrity.test.js:7`).

### 1.5 What the product is not

Chord is not, and must not be described as:

- an **agent framework** — it defines no model, no planning strategy, no tool-calling loop, and no provider integration. The kernel's only runtime dependency is a contract library (`packages/core/tests/architecture-integrity.test.js:6`, test `"ARCH-18: first-party JS/ESM kernel has only SigilJS runtime dependency and no provider/framework imports"`). **Verified**.
- a **workflow DSL** — the spec grammar is a deliberately small `@`-directive form (`packages/core/src/sdk/chord.js#parseText`); there is no conditionals, loops, parallelism or arbitrary control flow. **Verified**.
- a **durable execution engine** — canonical state is an in-memory object owned by a private single-process owner (`packages/core/src/registry/owner.js:9`, `:23`). There is no storage adapter, no WAL, no cross-process compare-and-swap. **Verified** (absence demonstrated by exhaustive import scan: the only filesystem access in the package is an unused text I/O helper at `packages/core/src/runtime/adapter.js:2-14`; there is no socket, server, worker, database client or HTTP client anywhere in `packages/core/src/**`).
- an **identity provider** — principals are attested by the host (`packages/core/src/platform/authorization.js:79`); Chord verifies the attestation it is given, it does not authenticate. **Verified**.
- an **approval product** — a human approval is a host-attested record; Chord binds and consumes it, but cannot prove a human pressed a button. **Verified** (`packages/core/src/platform/reconciliation.js:35` requires a host-attested human principal; the truth of that attestation is the host's).
- a **sandbox** — adapters are trusted in-process host code. Chord prevents a misbehaving *adapter result* from being normalized into success (`packages/core/tests/adversarial.test.js:389`), but it does not contain a hostile adapter. **Verified** for the first clause; the second is an explicit scope limit (`docs/internal/047-public-api-compatibility.md:11`).
- a **security product** — evidence is unsigned and structurally tamper-evident only within the process that produced it (`docs/internal/047-public-api-compatibility.md:11` lists cryptographic evidence signing as deferred).

### 1.6 Vocabulary boundary

Chord uses precise terms, and the distinctions are load-bearing for the public copy. Definitions follow the "Developer concepts" table in `README.md:119-133` (Not verified in this pass — read from the working-tree README, not re-derived from a spec file).

| Term | Definition | Common misuse to avoid |
|---|---|---|
| Intent | A versioned description of requested work; **not** permission to execute. | Treating a parsed intent as authorization. |
| Principal | Identity authenticated by the embedding host. | Treating a principal as an actor. |
| Actor | A host-registered execution identity bound to a principal. | Treating an actor's role label as a capability. |
| Capability | The exact action identifier an actor may perform. | Treating a capability as sufficient without a matching grant. |
| Grant | Host-issued allow/deny bound to an exact task scope, with validity and revocation. | Treating a grant as transferable between tasks. |
| Attempt | One execution reservation/dispatch, carrying lease and approval binding. | Treating an attempt as reusable. |
| Approval | A host-attested human decision for an exact task/attempt, **consumed** by dispatch. | Treating an approval as a reusable boolean. |
| Effect | A requested or attempted external operation whose outcome may need separate evidence. | Treating a dispatched effect as undone by cancellation. |
| Replay | A **pure projection** from recorded facts. | Describing replay as re-execution or as reproducing a model response. |

---

## 2. Primary persona

### 2.1 The persona

> **The governed-operator integrator** — the engineer who is putting AI agents and human colleagues into the same workflow and has to answer the question *"who was allowed to do that, and who said yes?"* after the fact.

The persona is defined by the **obligation**, not by the job title. It is held by platform engineers, agent-platform leads, automation engineers, and increasingly by the governance or security reviewer who signs off on the system. The persona owns a workflow where an agent's action and a human's action are interleaved in the same run, and where being wrong is expensive: publishing, spending money, changing production data, sending external messages, or touching anything a customer will notice.

**Inferred** — derived from the enforced boundary model: the authority evaluator separates principal, actor, capability and scope (`packages/core/src/platform/authorization.js:76-93`) and treats a human approval as a distinct, consumed, attempt-bound artifact (`packages/core/src/platform/authorization.js:107-118`, `:153`), which is only necessary if both human and machine actors act on the same run.

### 2.2 Profile

| Dimension | Description |
|---|---|
| **Environment** | An existing application or platform with a real user base and real side effects. Not a research notebook. |
| **Team** | A small team that already uses at least one model provider and at least one workflow tool; it has outgrown ad-hoc `if (agentSaysOk)` guards. |
| **Authority reality** | The team *cannot* let a model authorize itself. A human, a service, or a policy must. This is a hard organizational constraint, not a preference. |
| **Technical fluency** | Comfortable with typed data, explicit state machines, and separating "the thing that decides" from "the thing that runs". |
| **Failure tolerance** | Low for silent side effects; moderate for failures that are *recorded and quarantined*. |
| **What they already tried** | Prompt-based guardrails, retry wrappers, approval chat-bots, ad-hoc audit tables, a workflow engine plus a side-channel permissions service. |

### 2.3 Job to be done

> **When I let a model and a colleague act on the same work, help me make the boundary between them explicit and enforceable, and give me a record I can defend afterwards — without me writing a distributed system to get there.**

The "without me writing a distributed system" clause is the commercially decisive one and is directly evidenced: Chord's whole scope is deliberately single-process and in-memory (`packages/core/src/registry/owner.js:9`, `:23`). The persona wants governance *semantics* far more than they want *scale*.

### 2.4 Pains this persona has today

| # | Pain | Why it hurts | Evidence that Chord addresses it |
|---|---|---|---|
| P1 | "The agent did it, but I can't prove what it was allowed to do." | Model output and request payloads can be forged; a role label is not authority. | `packages/core/src/platform/authorization.js:81-82`; test `"request-authored authority fields, roles, and decisions confer nothing"` (`packages/core/tests/adversarial.test.js:27`). **Verified** |
| P2 | "The human approved *a* request; the system ran *a* different one." | Approval must bind to an exact attempt, not to a task in the abstract. | `packages/core/src/platform/authorization.js:132`, `:153`; test `"an approval for a different attempt does not authorize dispatch"` (`packages/core/tests/adversarial.test.js:476`). **Verified** |
| P3 | "The job crashed after the side effect. Now what?" | Post-dispatch ambiguity must not be blind-retried. | `packages/core/src/platform/recovery-policy.js:12-19`; test `"adapter throw after dispatch marks uncertain, never retries or dead-letters"` (`packages/core/tests/transitions.test.js:167`). **Verified** |
| P4 | "The retry created a second charge." | Operation identity must survive ID churn. | `packages/core/src/platform/reconciliation.js:11-25`; test `"RECOVERY: uncertainty cannot replay or evade quarantine with a new task ID"` (`packages/core/tests/recovery-integrity.test.js:11`). **Verified** |
| P5 | "I can't tell what the system actually did." | Reconstruction from a journal view is not reconstruction. | `packages/core/src/platform/trace-reducer.js:8-45`; test `"REPLAY: changed content/order, missing middle/tail, duplicate/mixed-run/version records reject"` (`packages/core/tests/replay-integrity.test.js:21`). **Verified** |
| P6 | "Adding governance means rewriting everything and adding a service." | A kernel with one dependency and no infrastructure is adoptable. | `packages/core/tests/architecture-integrity.test.js:6`; `packages/core/src/registry/owner.js:9`. **Verified** |

### 2.5 Buying triggers

1. A near-miss: an agent performed an action nobody authorized, or an approval was reused.
2. A compliance or internal-audit request that asks for authority, scope and approval evidence per action.
3. A migration from ad-hoc guardrails to a workflow engine that cannot express "human and agent in the same run, with a hard boundary".
4. A support or operations escalation that needs a defensible timeline of who did what.

### 2.6 Day-one workflow for this persona

1. `createChord()` and install a host-attested authority snapshot (`packages/core/src/sdk/chord.js#createChord`, `packages/core/src/sdk/chord.js#setAuthoritySnapshot`).
2. Express the work as intent — a spec or parsed text (`packages/core/src/sdk/chord.js#parseText`).
3. Admit work with an explicit capability and a grant issued by the host (`packages/core/src/sdk/chord.js#queueTaskPackets`).
4. Route an adapter per target entity (`packages/core/src/platform/adapter-routing.js:1-12`).
5. Run cycles; require human approval where the work is protected (`packages/core/src/sdk/chord.js#runCycle`, `packages/core/src/sdk/chord.js#resumeRun`).
6. Reconcile any uncertainty with explicit evidence rather than a retry (`packages/core/src/sdk/chord.js#reconcileTask`).
7. Export, audit or replay (`packages/core/src/sdk/chord.js#inspectAudit`, `packages/core/src/sdk/chord.js#replayJournal`, `packages/core/src/sdk/chord.js#exportRegistry`).

The shipped example that exercises exactly this sequence — accept a handoff, require approval, block dispatch until a human approves, restore a snapshot, replay with zero effects — is `packages/core/examples/cross-actor-workflow.mjs:8-54`, and is asserted by test `"cross-session workflow with approval and replay"` (`packages/core/tests/canonical-example.test.js:5`). **Verified**.

### 2.7 Secondary personas (brief, non-primary)

| Persona | Need | Chord's fit today |
|---|---|---|
| **Governance / security reviewer** | Per-action authority and approval evidence; a reconstruction that is not a screenshot of a log. | Strong fit — `packages/core/src/platform/trace-reducer.js:8`, `packages/core/src/platform/journal-audit.js:15`. Note: unsigned evidence only. |
| **Platform engineer providing agent infrastructure** | A stable seam between agents and side effects that they can enforce centrally. | Strong fit — the router + evaluator split (`packages/core/src/platform/adapter-routing.js:5`, `packages/core/src/platform/authorization.js:32`). Note: no network API; the host must expose one if it wants remote actors. |
| **Support-operations lead** | A queue of work with escalation and a bounded retry policy. | Partial fit — queue, retry, dead-letter exist (`packages/core/src/platform/task-queue.js:72-96`); there is no operator UI, and `chord.queryDeadLetters()` is a data API, not a workflow tool. |

### 2.8 Explicitly not the persona

- **Not** the "LLM app hobbyist" — Chord provides no model, no prompt surface and no output quality improvement. Adopting Chord without a governance obligation is wasted effort.
- **Not** the "workflow-platform buyer" — Temporal/Airflow-class buyers are solving durable distributed execution; Chord explicitly does not do that (see §4.3, §5.3).
- **Not** the "enterprise IAM buyer" — Chord consumes host-attested identity; it does not connect to a directory, an IdP or a policy-as-code service.

---

## 3. Capability inventory

### 3.1 Classification scheme

| Class | Meaning |
|---|---|
| **A — Implemented & verified** | Exists in the source, is exercised by a named test, and the test passed in this pass (§8.1). This is the Level A capability set. |
| **B — Implemented but experimental / privileged** | Exists and works, but is explicitly experimental, or is trusted-host plumbing rather than an actor-facing surface (`docs/internal/047-public-api-compatibility.md:7-10`). Must not be marketed as a product capability without the qualifier. |
| **C — Not implemented** | Does not exist in this repository. Belongs to Level B or Level C (§5). Must never be described as current. |

Every row below carries a source citation. Behavioural rows also carry a named test.

### 3.2 Class A — implemented and verified (the Level A capability set)

| # | Capability | Enforcement location | Named test (passed this pass) |
|---|---|---|---|
| A1 | Deterministic pure authority evaluator — no mutation, no I/O, no implicit clock | `packages/core/src/platform/authorization.js:3-8`, `:32` | `"determinism: identical inputs give identical decisions"` (`packages/core/tests/authorization.test.js:78`); `"fixed failure order, first failure wins"` (`packages/core/tests/authorization.test.js:83`) |
| A2 | Host owns the clock and the authority snapshot; clock rollback fails closed | `packages/core/src/sdk/chord.js#hostNow`, `packages/core/src/sdk/chord.js#setAuthoritySnapshot` | `"authority snapshot revisions are monotonic and clock rollback fails closed"` (`packages/core/tests/authorization.test.js:277`) |
| A3 | Actor↔principal binding enforced; roles confer nothing | `packages/core/src/platform/authorization.js:81-82` | `"cross-principal actor binding is rejected"` (`packages/core/tests/adversarial.test.js:71`); `"role strings never substitute for capabilities"` (`packages/core/tests/adversarial.test.js:42`) |
| A4 | Capability alone is insufficient; a matching allow grant is required | `packages/core/src/platform/authorization.js:82`, `:104` | `"capability alone without a grant is denied"` (`packages/core/tests/adversarial.test.js:58`) |
| A5 | Exact scope equality against immutable stored task fields | `packages/core/src/platform/authorization.js:85-93` | `"exact scope mismatch across every field is denied"` (`packages/core/tests/adversarial.test.js:101`) |
| A6 | Active deny always beats allow, independent of array order | `packages/core/src/platform/authorization.js:102` | `"an active matching deny beats every allow regardless of array order"` (`packages/core/tests/adversarial.test.js:162`) |
| A7 | Temporal validity at exact boundaries; immediate revocation | `packages/core/src/platform/authorization.js:16`, `:79`, `:101` | `"grant expiry uses issued_at <= now < expires_at at exact boundaries"` (`packages/core/tests/adversarial.test.js:136`); `"principal and actor revocation disable access immediately"` (`packages/core/tests/adversarial.test.js:147`) |
| A8 | Human approval bound to exact task revision, attempt and scope; consumed on dispatch | `packages/core/src/platform/authorization.js:107-118`, `:132`, `:153` | `"approval_required dispatch needs an exact, unconsumed, matching approval"` (`packages/core/tests/adversarial.test.js:198`); `"commit requires the dispatch-selected approval consumed by this attempt"` (`packages/core/tests/adversarial.test.js:234`) |
| A9 | Explicit rejection beats a present approval; self-approval structurally impossible | `packages/core/src/platform/authorization.js:115`, `:129` | `"explicit rejection wins over a present approval and blocks dispatch"` (`packages/core/tests/adversarial.test.js:214`); `"self-approval is structurally impossible"` (`packages/core/tests/adversarial.test.js:219`) |
| A10 | Authorization decisions are frozen data, never transferable tokens | `packages/core/src/platform/authorization.js:13-14` | `"evaluator decisions are sanitized fixed data, never transferable tokens"` (`packages/core/tests/adversarial.test.js:86`) |
| A11 | Guarded task / queue / artifact / domain state machines | `packages/core/src/platform/transitions.js:19`, `:34`, `:45`, `:60`, `:78`, `:95`, `:105` | `"task graph: every allowed edge commits, every forbidden edge rejects"` (`packages/core/tests/transitions.test.js:70`); `"queue graph: ..."` (`:94`); `"artifact graph: ..."` (`:107`); `"domain guard: ..."` (`:125`) |
| A12 | Atomic batch admission — one denial registers no member; no residue | `packages/core/src/sdk/chord.js#queueTaskPackets`, `packages/core/src/sdk/chord.js#mutate` | `"batch admission is atomic: one denial registers no member"` (`packages/core/tests/adversarial.test.js:286`); `"ADMIT: invalid queue fields and reentrant callback cannot partially commit"` (`packages/core/tests/admission-integrity.test.js:21`) |
| A13 | Duplicate task/operation admission rejected | `packages/core/src/sdk/chord.js#queueTaskPackets`; `packages/core/src/platform/reconciliation.js:21` | `"duplicate admission and re-registration of an existing id reject"` (`packages/core/tests/adversarial.test.js:299`) |
| A14 | Per-entity and global lease caps defer dispatch before any effect | `packages/core/src/platform/runtime-loop.js:27`, `:38-41` | `"per-entity and global lease caps defer dispatch before any effect"` (`packages/core/tests/transitions.test.js:486`) |
| A15 | Deterministic queue selection (priority, availability, stable tiebreak) | `packages/core/src/platform/task-queue.js:27-36` | `"TARGET 5: Deterministic Dequeue"` (`packages/core/tests/hardening.test.js:89`) |
| A16 | Attempt reservation is kernel-owned and single-use per task | `packages/core/src/platform/attempts.js:8-26`, `:38-44` | `"commit requires the dispatch-selected approval consumed by this attempt"` (`packages/core/tests/adversarial.test.js:234`) |
| A17 | Commit-time re-authorization: stale revision, expired lease or replaced authority ⇒ `uncertain`, not a guess | `packages/core/src/platform/runtime-loop.js:82-88` | `"intervening revision bump during await makes the commit stale"` (`packages/core/tests/transitions.test.js:203`); `"expired lease at commit marks uncertain"` (`:242`); `"authority replacement during await invalidates the in-flight attempt"` (`:222`) |
| A18 | Cancellation wins over a late adapter result | `packages/core/src/platform/transitions.js:135-142`; `packages/core/src/sdk/chord.js#cancelTask` | `"cancelTask wins over an in-flight success and drops the late result"` (`packages/core/tests/transitions.test.js:314`); `"LIFECYCLE: cancellation wins against late adapter result"` (`packages/core/tests/lifecycle-integrity.test.js:20`) |
| A19 | Malformed or fabricated adapter results never normalize to success | `packages/core/src/platform/runtime-loop.js:78-92`; `packages/core/src/execution/results.js:11` | `"malformed adapter results never normalize to success or dead-letter"` (`packages/core/tests/adversarial.test.js:389`); `"safery: adapter cannot fabricate correlation or a passing result"` (`:375`); `"invalid adapter result marks uncertain without committing anything"` (`packages/core/tests/transitions.test.js:189`) |
| A20 | Bounded **pre-dispatch** retry with backoff, then dead-letter | `packages/core/src/platform/task-queue.js:72-96`; `packages/core/src/platform/policy.js:16-21` | `"TARGET 2: Dead-Letter Consistency (pre-dispatch exhaustion and fresh-admission replay)"` (`packages/core/tests/hardening.test.js:40`) |
| A21 | Post-dispatch ambiguity ⇒ `uncertain`; never blind-retried, never dead-lettered | `packages/core/src/platform/recovery-policy.js:12-19`, `:21-24`; `packages/core/src/platform/transitions.js:135-153` | `"adapter throw after dispatch marks uncertain, never retries or dead-letters"` (`packages/core/tests/transitions.test.js:167`); `"markTaskUncertain clears attempts, bumps revision, skips terminal states"` (`:141`) |
| A22 | Structural operation quarantine — ID churn cannot evade it | `packages/core/src/platform/reconciliation.js:11-25` | `"RECOVERY: uncertainty cannot replay or evade quarantine with a new task ID"` (`packages/core/tests/recovery-integrity.test.js:11`) |
| A23 | Evidence-gated human reconciliation of an unknown effect | `packages/core/src/platform/reconciliation.js:29-54` (required evidence kinds at `:39-40`) | `"RECOVERY: missing authority/evidence rejected unchanged"` (`packages/core/tests/recovery-integrity.test.js:15`); `"RECOVERY: still unknown stays quarantined"` (`:21`); `"RECOVERY: confirmed completion is never executed again"` (`:24`); `"RECOVERY: no-effect evidence enables explicit fresh authorized attempt"` (`:27`) |
| A24 | Competing/duplicate reconciliation cannot both commit | `packages/core/src/platform/reconciliation.js:31` | `"RECOVERY: competing/duplicate reconciliation cannot both commit"` (`packages/core/tests/recovery-integrity.test.js:32`) |
| A25 | Run lifecycle gates dispatch: paused / failed / cancelled / completed runs dispatch nothing | `packages/core/src/platform/runtime-loop.js:22-24` | `"LIFECYCLE: resume requires an active host-authenticated human"` (`packages/core/tests/lifecycle-integrity.test.js:14`); `"pause/resume/cancel flow with CAS"` (`packages/core/tests/continuity.test.js:17`) |
| A26 | Approval pause / resume / reject / cancel, all revision-guarded | `packages/core/src/platform/approval-flow.js:7`, `:22`, `:39`, `:54` | `"approval rejection fails run"` (`packages/core/tests/continuity.test.js:44`); `"cancelRun cancels tasks and clears attempts"` (`:34`) |
| A27 | Handoff between actors with CAS, correlation and causation, and wrong-actor rejection | `packages/core/src/platform/handoff.js:43-98` | `"handoff proposal/accept with CAS and causation/correlation"` (`packages/core/tests/continuity.test.js:65`); `"handoff reject and wrong actor"` (`:77`) |
| A28 | Grant-scoped, bounded context projection; grantless actors see nothing | `packages/core/src/platform/handoff.js:12-40` (bound at `:20`, grant filter at `:22`) | `"READ: grantless/expired/revoked/denied projections disclose no tasks or queue"` (`packages/core/tests/admission-integrity.test.js:5`); `"READ: authorized projection detached including nested scope, bounded to permitted tasks"` (`:11`) |
| A29 | Private single-process owner; clone → validate → atomic install; rejected candidates change nothing | `packages/core/src/registry/owner.js:9`, `:22-42`; `packages/core/src/registry/registry.js:32-46` | `"STATE-01/02: installed owner and revision-exclusive commits"` (`packages/core/tests/integrity.test.js:10`); `"STATE-03/05: rejected compound candidate changes no collection or event"` (`:19`) |
| A30 | Returned reads and retained inputs cannot mutate canonical state | `packages/core/src/sdk/chord.js#read` | `"STATE-04: reads and retained inputs cannot change canonical state"` (`packages/core/tests/integrity.test.js:27`) |
| A31 | Canonical transition invariants shared by installation and reconstruction | `packages/core/src/platform/state-invariants.js:6-27` | `"STATE: host commit cannot validate one operation while recording another"` (`packages/core/tests/integrity.test.js:42`); `"STATE: host candidates cannot append fabricated kernel history"` (`:54`) |
| A32 | Versioned committed-fact history; pure reconstruction with zero effects | `packages/core/src/platform/history.js:4`, `:15`, `:28`; `packages/core/src/platform/trace-reducer.js:8`, `:46` | `"REPLAY: committed admission/dispatch/result projection equals original with zero effects"` (`packages/core/tests/replay-integrity.test.js:7`); `"REPLAY: uncertainty, reconciliation, handoff, pause and cancellation are recorded"` (`:14`) |
| A33 | Incomplete / foreign / duplicate / mixed-run / wrong-version history rejected | `packages/core/src/platform/trace-reducer.js:9`, `:14`, `:16`, `:21`, `:24`, `:29`, `:43` | `"REPLAY: changed content/order, missing middle/tail, duplicate/mixed-run/version records reject"` (`packages/core/tests/replay-integrity.test.js:21`); `"replay without genesis explicitly rejects insufficient history"` (`packages/core/tests/fault-injection.test.js:8`) |
| A34 | Ordered trace diff | `packages/core/src/platform/trace-reducer.js:49-52` | `"diff traces detects divergence"` (`packages/core/tests/fault-injection.test.js:23`) |
| A35 | Contract hardening: closed schemas, size/depth/key limits, prototype-key ban, accessor non-evaluation | `packages/core/src/contracts/sigils.js:4-5`, `:19`, `:39` | `"dangerous values and keys are rejected recursively"` (`packages/core/tests/contracts.test.js:82`); `"plain own-data rejects accessors without evaluating them"` (`:73`); `"depth, array, string, byte and node limits"` (`:91`) |
| A36 | Closed input surface: no discarded unknown fields; no silent field coercion | `packages/core/src/contracts/sigils.js:85` | `"strict specs, real/literal newline parsing and no discarded unknown fields"` (`packages/core/tests/contracts.test.js:133`) |
| A37 | Snapshot export/serialize/import with validation; imported in-flight work is quarantined, never executable | `packages/core/src/registry/snapshot.js:4`, `:22`, `:26-47` | `"snapshot validates version, counts, nested records, clones and reconciles in-flight import"` (`packages/core/tests/contracts.test.js:202`); `"REPLAY: dead-letter cancellation and imported running quarantine reconstruct"` (`packages/core/tests/replay-integrity.test.js:30`) |
| A38 | Deterministic structured audit report and journal view | `packages/core/src/platform/journal-audit.js:1-33`; `packages/core/src/platform/event-journal.js:3-31` | `"event journal includes extended fields"` (`packages/core/tests/fault-injection.test.js:32`) |
| A39 | Provider-neutral adapter routing (exact → prefix → default → fallback) | `packages/core/src/platform/adapter-routing.js:1-12` | `"ARCH-18: ..."` (`packages/core/tests/architecture-integrity.test.js:6`) |
| A40 | Configurable runtime policy: lease caps and retry strategy with bounded backoff | `packages/core/src/platform/policy.js:3-21` | `"policy validates before defaults and bounds after defaults"` (`packages/core/tests/contracts.test.js:144`) |
| A41 | Replay and dead-letter recovery go through **fresh admission**, re-evaluated against current authority | `packages/core/src/sdk/chord.js#replayTask`; `packages/core/src/platform/task-queue.js:107-133` | `"uncertain task reconciles only through fresh-admission replay"` (`packages/core/tests/transitions.test.js:350`); `"replay denial after revocation leaves the task untouched"` (`:372`) |
| A42 | No registry or authority write handle leaks to adapters | `packages/core/src/platform/runtime-loop.js:66` (the packet handed to the adapter strips `status`, `created_at`, `retry_count`, `last_result`, `authority_binding`, `operation_id`) | `"no registry or authority write handle leaks to adapters"` (`packages/core/tests/adversarial.test.js:352`) |
| A43 | Reentrant host callbacks fail before install or effect | `packages/core/src/registry/owner.js:23` | `"ADMIT: invalid queue fields and reentrant callback cannot partially commit"` (`packages/core/tests/admission-integrity.test.js:21`); `"LIFECYCLE: executable accessor cannot cancel after claim then execute anyway"` (`packages/core/tests/lifecycle-integrity.test.js:26`) |
| A44 | A single demonstrated end-to-end governed workflow with approval, restore and replay | `packages/core/examples/cross-actor-workflow.mjs:8-54` | `"cross-session workflow with approval and replay"` (`packages/core/tests/canonical-example.test.js:5`) |
| A45 | Minimal, auditable dependency surface: one runtime dependency, no framework or provider imports | `packages/core/src/contracts/sigils.js:1` | `"ARCH-18: ..."` (`packages/core/tests/architecture-integrity.test.js:6`) |

### 3.3 Class B — implemented, but experimental or trusted-host plumbing

These exist and work. They are **not** product capabilities to be marketed without the qualifier.

| # | Item | What it is | Qualifier that must accompany it |
|---|---|---|---|
| B1 | Entire public API surface | All three import paths are experimental; **no** API is stable. | `docs/internal/047-public-api-compatibility.md:6`; `README.md` ("All are **experimental**"). |
| B2 | `commitRun` — generic host CAS | Trusted-host administration. | `packages/core/src/sdk/chord.js#commitRun`; `docs/internal/047-public-api-compatibility.md:8`. |
| B3 | `setAuthoritySnapshot` / `installGrants` / `prepareAttempt` | Host administration, not an actor authentication endpoint. | `packages/core/src/sdk/chord.js#setAuthoritySnapshot`, `packages/core/src/sdk/chord.js#installGrants`, `packages/core/src/sdk/chord.js#prepareAttempt`; `docs/internal/047-public-api-compatibility.md:8`. |
| B4 | `queryArtifacts` / `queryDomains` / `queryDeadLetters` / `inspectAudit` / `inspectEvents` / `exportRegistry` | Full inspection is **not** scope-filtered and must stay host-only. | `docs/internal/047-public-api-compatibility.md:19`; `packages/core/src/registry/query.js:1`, `:10`, `:18`. |
| B5 | `projectContext` | A *scoped view*, not an authentication service. | `packages/core/src/sdk/chord.js#projectContext`; `docs/internal/047-public-api-compatibility.md:8`. |
| B6 | Low-level `platform` exports (queue, journal, routing, policy, runtime loop, reducer) | Publicly exported trusted-host plumbing; must not be forwarded as an actor surface. | `packages/core/src/platform/index.js:1-8`; `docs/internal/047-public-api-compatibility.md:9`. |
| B7 | Context filtering | Filters *by authorization*, not by content redaction. Related authorized data and full host snapshots/traces can contain supplied inputs, outputs and authority metadata. | `README.md` ("Context filtering is **not** automatic content redaction"). |
| B8 | `replayRegistryJournal` / `createDeterministicAuditReport` | Diagnostic views. The reducer (`reduceTrace`) is the authoritative reconstruction; the journal view is not. | `packages/core/src/platform/journal-audit.js:1`; `packages/core/src/platform/trace-reducer.js:8`. |
| B9 | `runRuntimeCycle` on a caller-owned plain registry | Uses a detached simulation owner; it **cannot** update an SDK's private state. | `packages/core/src/platform/runtime-loop.js:20`; `docs/internal/047-public-api-compatibility.md:9`. |
| B10 | CLI scripts (`chord:run`, `chord:replay`, `chord:audit`) and the `demo:via` script | Experimental developer surface; not an installed bin command. | `packages/core/package.json` scripts; `docs/internal/040-preview-scope-lock.md` (CLI classification). |
| B11 | `src/runtime/adapter.js` text I/O helpers | Read/write local text or URLs. **Not wired into the kernel** — no state persistence. | `packages/core/src/runtime/adapter.js:2-14`. |

### 3.4 Class C — not implemented (must never be presented as current)

| # | Not implemented | Where it belongs |
|---|---|---|
| C1 | Durable storage adapter / write-ahead log / crash recovery | Level B (§5.3) |
| C2 | Cross-process or distributed compare-and-swap | Level B (§5.3) |
| C3 | Multi-process / multi-host coordination protocol | Level B (§5.3) |
| C4 | Federation of trust across organizational boundaries | Level C (§5.4) |
| C5 | Cryptographically signed or independently verified evidence | Level C (§5.4) |
| C6 | Hostile-adapter sandboxing or capability-secure execution | Level C (§5.4) |
| C7 | A network/API surface for remote actors | Level C (§5.4) |
| C8 | Multi-tenant hosted service | Level C (§5.4) |
| C9 | Provider SDK breadth (first-party connectors for model/tool vendors) | Out of scope — `docs/internal/040-preview-scope-lock.md` (D3) |
| C10 | Autonomous agent swarms without human approval | Out of scope — see §7 |
| C11 | Deterministic model generation or reproducible model responses | Explicitly excluded — `README.md` ("No deterministic model generation…") |
| C12 | Universal exactly-once external effects | Explicitly excluded — `README.md` ("No universal exactly-once external effects") |
| C13 | Automatic secret removal from host data | Explicitly excluded — `README.md` |
| C14 | Simulation / fork of a run (Level C in the historical sense) | Deferred — `docs/internal/047-public-api-compatibility.md:11` |
| C15 | A GUI, operator console or dashboard | Out of scope — §7 |

### 3.5 Claims Chord must never make

These are pre-emptive prohibitions for downstream copy, derived from the evidence above:

1. Never say "secure", "tamper-proof", "cryptographically verified", or "audit-grade" without qualification — evidence is unsigned (`docs/internal/047-public-api-compatibility.md:11`).
2. Never say "distributed", "durable", "persistent", or "resilient across restarts" — state is in-memory and single-process (`packages/core/src/registry/owner.js:9`).
3. Never say "exactly-once" — Chord distinguishes requested / dispatched / confirmed, and a dispatched effect cannot be undone (`packages/core/src/platform/runtime-loop.js:91`).
4. Never say "authenticated" about Chord itself — the host authenticates; Chord verifies the attestation it is handed (`packages/core/src/platform/authorization.js:79`).
5. Never say "sandboxed" or "isolated" about adapters — adapters are trusted in-process code (`docs/internal/047-public-api-compatibility.md:11`).
6. Never say "redacts secrets" — context filtering is authorization-scoped, not content-scrubbing (`README.md`).
7. Never present Levels B or C capabilities as current (§5.6, §6.2).

---

## 4. Competitor comparison

### 4.1 Method and caveats

**The competitor characterizations in this section are general market descriptions. They are labeled Not verified with respect to this repository, because no competitor product was inspected, installed or benchmarked during this pass.** They are included to position Chord, not to make comparative performance claims. Any downstream public use of §4 must be re-checked against the named products at the time of publication, or rewritten to describe *categories* rather than products.

Chord's own capabilities in the comparison tables are cited to source exactly as in §3.

### 4.2 Category map

| Category | Representative products | Their center of gravity | Gap Chord occupies |
|---|---|---|---|
| **1. Model-provider agent frameworks** | LangChain / LangGraph, LlamaIndex, CrewAI, AutoGen / AG2, Semantic Kernel | Building the agent: prompting, tool-calling, memory, provider plumbing | Governance of the *effect*: who may act, on what exact scope, under whose approval, with what recorded outcome |
| **2. Durable workflow orchestrators** | Temporal, Airflow, Dagster, Prefect, Netflix Conductor | Surviving failure at scale: durable timers, retries, distributed workers | The *authority and approval* boundary between humans and machines inside one run |
| **3. Actor / supervision runtimes** | Akka, Orleans, Erlang/OTP | Actor isolation, supervision trees, message passing | Cross-actor *authorization* with host-attested identity, scope and human approval |
| **4. Interop protocols for agents** | MCP, A2A and similar | Transports and schemas so agents can talk | A decision kernel — the protocol says how to ask, not whether you may |
| **5. Policy / authorization engines** | OPA / Rego, Cedar, Zanzibar | Evaluating "is this allowed?" as a decision point | Execution lifecycle, attempt binding, effect truth, replay |
| **6. Observability / eval / tracing** | LangSmith, Langfuse, OpenTelemetry, event-sourcing libraries | Seeing and measuring what happened | Enforcing anything, and reconstructing *canonical state* rather than a span log |
| **7. Approval tooling** | Chat-ops approval bots, ticketing/change-management suites | Getting a human to say yes in a workflow | Making that "yes" exact, attempt-bound, single-use and machine-enforced |
| **8. The status quo** | Python scripts + cron + a queue + a form | Getting something done at all | Everything above, at the cost of an ad-hoc trust boundary |

### 4.3 Category detail

#### Category 1 — Model-provider agent frameworks

- **What they do well:** the largest share of mindshare and of working integration code. Provider breadth, tool-calling loops, retrieval, structured outputs. Building an agent is fast.
- **Where they fall short for this persona:** the boundary between "the model may suggest" and "the system may act" is usually a prompt, a tool allowlist, or a hand-written `if`. A model can author a tool call; it cannot, in most of these stacks, mint an authority record that the framework will later honour as *evidence*.
- **Chord's answer:** authority is a separate, host-installed, revisioned artifact (`packages/core/src/sdk/chord.js#setAuthoritySnapshot`), evaluated by a pure deterministic function (`packages/core/src/platform/authorization.js:32`), with approvals bound to exact attempts (`packages/core/src/platform/authorization.js:132`) and consumed exactly once (`:153`).
- **What Chord still lacks:** none of the provider breadth, tool-calling ergonomics, retrieval, memory or evaluation tooling. If the persona's need is *agent capability*, Chord is the wrong tool.
- **Not verified** (market characterization).

#### Category 2 — Durable workflow orchestrators

- **What they do well:** durability, retries, timers, visibility, and — critically — the ability to survive a process restart or a machine loss. This is a solved, mature problem.
- **Where they fall short for this persona:** their authorization model is usually "the workflow says who runs this node". A human approval is often a wait-state with a human task attached, not an attempt-bound capability check that the executor itself enforces at dispatch and again at commit.
- **Chord's answer:** a three-stage authority evaluator — admit, dispatch, commit (`packages/core/src/platform/authorization.js:10`, `:60`, `:62`, `:64`) — plus explicit post-dispatch uncertainty handling (`packages/core/src/platform/runtime-loop.js:82-88`).
- **What Chord still lacks:** **all** of the durability. Chord has no storage adapter, no cross-process CAS, no crash recovery. A Temporal-class buyer is buying something Chord does not have at all. This is Chord's largest competitive gap and it is why Level B exists (§5.3).
- **Not verified** (market characterization).

#### Category 3 — Actor / supervision runtimes

- **What they do well:** proven structure for "many independent things that talk to each other", including supervision restarts and typed messages.
- **Where they fall short for this persona:** actors are usually trusted components of the system. Their isolation is process-level reliability, not a *policy* boundary, and they do not natively express "this specific human must approve this specific attempt of this specific task".
- **Chord's answer:** explicit identity/actor separation with capability checks and scope equality (`packages/core/src/platform/authorization.js:76-93`), plus an explicit cross-actor handoff record with CAS (`packages/core/src/platform/handoff.js:43-98`).
- **What Chord still lacks:** supervision, distribution, back-pressure, real concurrency. Chord's concurrency story is a single-process `busy` flag (`packages/core/src/registry/owner.js:21`, `:23`).
- **Not verified** (market characterization).

#### Category 4 — Interop protocols for agents

- **What they do well:** getting two independently-built systems to agree on how to ask and how to answer.
- **Where they fall short for this persona:** a protocol defines a message format; it does not define an admission rule. "I am allowed to run this" and "I am allowed to publish this" remain the application's problem.
- **Chord's answer:** Chord is deliberately not a protocol. It is a decision kernel that a host can expose however it likes — including over a protocol. `docs/internal/047-public-api-compatibility.md:8` records the rule: handoff, authority installation, reconciliation and generic CAS are host administration, **not** public actor authentication endpoints.
- **What Chord still lacks:** any network surface at all. A remote actor needs the host to build one.
- **Not verified** (market characterization).

#### Category 5 — Policy / authorization engines

- **What they do well:** expressing and evaluating rich policy, often with fast evaluation and good audit. OPA/Rego is a serious answer to "is this allowed?".
- **Where they fall short for this persona:** the decision is only one part of the problem. Policy engines do not know what an *attempt* is, do not consume approvals, do not know whether an effect happened, and do not reconstruct state afterwards.
- **Chord's answer:** the decision *is* the product, but the decision is inseparable from the lifecycle — the attempt carries the grant ids and the approval id that authorized it (`packages/core/src/contracts/sigils.js:131`; `packages/core/src/platform/runtime-loop.js:60-61`), and the commit stage re-checks exactly those (`packages/core/src/platform/authorization.js:139-157`).
- **What Chord still lacks:** policy expressiveness. Chord's grant model is allow/deny over an exact scope with temporal validity — not a general policy language. A Rego power user will find this narrow. **This is a deliberate design choice, not an oversight** (exactness over expressiveness).
- **Not verified** (market characterization).

#### Category 6 — Observability / tracing / eval

- **What they do well:** visibility into what a model did, at low cost, with dashboards.
- **Where they fall short for this persona:** a trace is a record of *observations*. It does not prove authorization, and it cannot reconstruct canonical state — the 046 audit found precisely this gap and 047 had to build a real committed-fact reducer to close it (`packages/core/src/platform/trace-reducer.js:8-45`; `docs/internal/048-final-report.md:19`).
- **Chord's answer:** every accepted transition is a versioned commit with a computed state delta (`packages/core/src/registry/owner.js:15-19`), reducible back to full canonical state with zero effects (`packages/core/src/platform/trace-reducer.js:30`, `:47`).
- **What Chord still lacks:** any observability experience. No UI, no dashboards, no log shipping, no trace sampling.
- **Not verified** (market characterization).
#### Category 7 — Approval tooling

- **What they do well:** getting a human's attention and capturing a decision in a form people understand.
- **Where they fall short for this persona:** the approval is usually a *message*. It is not bound to an attempt, not consumed, and not re-checked at commit. And it is not connected to the enforcement point — the thing that actually fires the side effect.
- **Chord's answer:** approval is a first-class record (`packages/core/src/contracts/sigils.js:112`), bound to task revision, attempt id and exact scope (`packages/core/src/platform/authorization.js:107-114`), consumed at dispatch (`packages/core/src/platform/runtime-loop.js:63`) and re-verified at commit (`packages/core/src/platform/authorization.js:151-153`).
- **What Chord still lacks:** Chord has no UI, no notifications, no email or chat integration. The host must build the human-facing surface and translate it into an approval record. This is a real adoption cost and must be stated plainly.
- **Not verified** (market characterization).

#### Category 8 — The status quo

- **What they do well:** zero migration cost, total flexibility, and it works until the first incident.
- **Where they fall short:** the trust boundary is implicit, the audit trail is a log file, and "who approved that" has no answer.
- **Chord's answer:** adopt one kernel, keep the scripts; route their side effects through Chord as adapters (`packages/core/src/platform/adapter-routing.js:5-12`) so the existing work becomes governed without being rewritten.
- **What Chord still lacks:** it is a library, not a tool. There is no UI to click and no dashboard to look at.
- **Not verified** (market characterization).

### 4.4 Where Chord loses — the honest list

These must appear in any competitive material, not be buried:

1. **Durability.** Chord state is in-memory and dies with the process (`packages/core/src/registry/owner.js:9`). Every durable-orchestrator class wins outright.
2. **Distribution and scale.** One process, one owner, one `busy` flag (`packages/core/src/registry/owner.js:21-23`). No clustering, no sharding, no back-pressure.
3. **Ecosystem and onboarding.** No provider connectors, no tool catalogue, no hosted UI, no community, no tutorials. A LangChain or Temporal user has a far shorter path to first value.
4. **Policy expressiveness.** Allow/deny over an exact scope (`packages/core/src/platform/authorization.js:96-104`) is deliberately narrow.
5. **Human-facing workflow.** No approval UI, no notification, no dashboard, no operator console.
6. **Stability.** Nothing is stable, the version is a preview, and the package has never been published (`docs/internal/050-baseline-lock.md` (“7.1 Verified from the repository”)).
7. **Evidence strength.** Unsigned, single-process, structurally tamper-evident only.

### 4.5 Positioning summary

| | **Chord** |
|---|---|
| **Category** | Coordination **kernel** — a library embedded by a host, not a platform you log into. |
| **Positioning** | **Chord — Governed coordination for humans, AI agents, and services.** |
| **Value proposition** | **Turn intent into governed execution.** |
| **Owns** | Admission, authorization, approval binding, attempt lifecycle, effect-truth uncertainty, committed-fact history, replay. |
| **Does not own** | The model, the effect, the identity provider, the storage, the UI, the network. |
| **Buyer** | The engineer accountable for the boundary between what agents may do and what humans must approve — not the team buying an agent framework. |
| **Wins against** | Ad-hoc guardrails; chat-op approval flows; "prompt and hope"; policy engines used as the *whole* answer. |
| **Loses to** | Durable orchestrators (on durability), agent frameworks (on ecosystem and speed to value). |

**The one-sentence test for any candidate copy:** *"Does this sentence tell a reader exactly what Chord will refuse to do for them?"* If not, it is too vague to be useful and too risky to publish.

---

## 5. Release levels: A, B, C

### 5.1 A naming collision that must be recorded

Earlier blocks (040–047) used "Level A / Level B / Level C" to describe **evidence and replay maturity** — e.g. "Level B state reconstruction" (`docs/internal/046-release-go-no-go.md:17`), "Level C simulation/fork" (`docs/internal/047-public-api-compatibility.md:11`). Those usages are historical and describe *history-reconstruction* tiers, not release tiers.

**The A/B/C defined in this section are release/product levels and are normative from this document forward.** Where an earlier document says "Level B", read it as the historical evidence tier unless it is explicitly restated as a release level. This collision is called out here so that Block 051+ documents do not inherit the ambiguity.

### 5.2 Level A — Governed single-process preview

**Definition.** Level A is the capability set that exists in this repository today: a **trusted-host, single-process, in-memory** coordination kernel that turns intent into governed execution across human and machine actors, with authority, approval, attempt, effect-truth and committed-fact guarantees enforced in-process.

**Level A is legitimate as a *public preview* only if every acceptance gate in §6 is satisfied.** A partial gate set does not entitle the product to preview positioning; it entitles it to preview *engineering* positioning only.

**Level A characteristics:**
- One process, one private owner, one revision counter (`packages/core/src/registry/owner.js:9`, `:24`).
- Authority is host-installed, revisioned and monotonic (`packages/core/src/sdk/chord.js#setAuthoritySnapshot`).
- Three-stage authority evaluation: admit / dispatch / commit (`packages/core/src/platform/authorization.js:10`).
- Human approvals are attempt-bound and consumed (`packages/core/src/platform/authorization.js:132`, `:153`).
- Unknown effects are quarantined and require evidence-backed human reconciliation (`packages/core/src/platform/reconciliation.js:29-54`).
- History is a versioned sequence of committed facts, reducible to canonical state with zero effects (`packages/core/src/platform/trace-reducer.js:8`, `:47`).
- One runtime dependency; no framework, provider or service (`packages/core/tests/architecture-integrity.test.js:6`).
- **No** durability, **no** distribution, **no** federation, **no** sandboxing, **no** signed evidence, **no** network API, **no** UI.

### 5.3 Level B — Durable, cross-process coordination

**Definition.** Level B is Level A plus **state that outlives the process and can be shared by more than one process**: a pluggable durable storage adapter, cross-process compare-and-swap, crash recovery, and a coordinator protocol that allows multiple hosts to work the same run.

**Level B is not implemented.** Nothing in §5.3 exists in this repository — verified by exhaustive inspection of `packages/core/src/**`: there is no storage adapter, no write-ahead log, no transaction coordinator, no lock service, no network listener and no second process. The only filesystem access anywhere in the package is an unused text I/O helper (`packages/core/src/runtime/adapter.js:2-14`).

**Level B is deferred to Blocks 051–052.** Until implemented and verified, it may appear only as explicitly proposed/deferred work, never as a current capability.

**Level B promotion criteria (all required):**
1. A storage adapter interface with at least one durable implementation, and a crash-recovery test that restarts the process and reconstructs the same canonical state.
2. A cross-process CAS protocol with a demonstrated concurrent-writer test showing exactly one winner per revision.
3. A migration story for the existing snapshot format (`packages/core/src/registry/snapshot.js:9` declares `snapshot_version: "0.3.0"`) with a versioned, tested upgrade path.
4. A reconciliation rule for the case where two processes observe the same uncertain effect.
5. A documented statement of what durability does **not** buy — no universal exactly-once external effect.

### 5.4 Level C — Federated, trust-bearing coordination

**Definition.** Level C is Level B plus **independently verifiable trust across organizational boundaries**: cryptographic evidence signing and verification, federation of principals across independently administered hosts, a hosted or self-hosted multi-tenant service, and hardened execution of untrusted adapters.

**Level C is not implemented and is not a near-term plan.** It is stated here so that Level A and Level B claims are not inflated by implication, and so that the vocabulary is stable if it is ever pursued.

**Level C characteristics (none of which exist today):**
- Signed, verifiable evidence artifacts a third party could check without trusting the producing host.
- Cross-organization trust federation with independent principal verification.
- Multi-tenant deployment, isolation and billing.
- Sandboxed or capability-secure execution of untrusted adapters.
- A network/API surface for actors that are not in the host's process.

**Level C promotion criteria:** each Level C element requires its own design, threat model, implementation and independent verification pass, at the standard already applied to Blocks 046–047.

### 5.5 Level comparison

| Dimension | **Level A** (current) | **Level B** (deferred, 051–052) | **Level C** (deferred, later) |
|---|---|---|---|
| Process model | Single process, private owner | Multi-process, coordinated | Multi-organization, federated |
| State lifetime | In-memory, dies with process | Durable, survives restart | Durable + replicated |
| Concurrency | Revision CAS inside one process (`packages/core/src/registry/owner.js:24`) | Cross-process CAS | Consensus / federation semantics |
| Authority source | One host's snapshot (`packages/core/src/sdk/chord.js#setAuthoritySnapshot`) | Shared, versioned authority store | Federated, cross-org principal verification |
| Evidence | Unsigned committed facts (`packages/core/src/platform/history.js:4`) | Durable committed facts | Signed, independently verifiable |
| Approval | Host-attested, attempt-bound (`packages/core/src/platform/authorization.js:107-118`) | Same + durable approval ledger | Same + cross-org attestation |
| Adapter trust | Trusted in-process code | Trusted in-process code | Sandboxed / capability-secure |
| Deployment | Embedded library | Embedded library + storage | Service or distributed deployment |
| UI | None | None | Operator console |
| Status | **Implemented and verified** | **Not implemented** | **Not implemented** |

### 5.6 Representation rules

1. Level A may be described as: *"a governed single-process coordination kernel in preview."*
2. Level B and Level C may be described **only** as: *"planned"*, *"deferred"*, *"not implemented"*, or as a roadmap direction — never as a capability, benefit, or comparison row implying present capability (`docs/internal/047-public-api-compatibility.md:11`).
3. Any competitive comparison that includes a durability, federation or signing row must mark the Chord cell as "not implemented".
4. A Level A claim is invalidated if it is stated at the process level. "Chord coordinates work across your whole platform" is a Level B claim. "Chord governs the boundary between agents and humans inside one host process" is a Level A claim.

---

## 6. Level A gate mapping

### 6.1 Status legend

| Status | Meaning |
|---|---|
| **MET** | Gate is satisfied by cited evidence, and — where behavioural — by a named test that passed in this pass. |
| **PARTIAL** | The substance is satisfied but a named acceptance condition is not. |
| **NOT MET** | The gate is not satisfied. The blocking condition is stated with its owner. |

### 6.2 Gate table

Gates G1–G8 are the **product-contract gates** (does the product do what this document claims?). Gates G9–G12 are the **preview-distribution gates** (may it be published as a public preview?).

| # | Acceptance gate | Status | Evidence | Blocking condition |
|---|---|---|---|---|
| **G1** | The kernel behaves exactly as this contract claims: every Class A capability is enforced and observable in code. | **MET** | 45 Class A rows (§3.2), each cited to `file_path:line_number` and to a named test; `bun test` → 160 pass / 0 fail / 1371 expect / 14 files (§8.1). | — |
| **G2** | The authority boundary is genuinely closed: no request-authored, role-derived, cross-run or time-bypass path grants authority. | **MET** | `packages/core/src/platform/authorization.js:32-159`; tests `"request-authored authority fields, roles, and decisions confer nothing"` (`packages/core/tests/adversarial.test.js:27`), `"cross-principal actor binding is rejected"` (`:71`), `"version mismatch and foreign run reject before any grant evaluation"` (`:127`), `"grant expiry uses issued_at <= now < expires_at at exact boundaries"` (`:136`). | — |
| **G3** | The effect boundary is honest: a dispatched effect is never silently repeated, and uncertainty is quarantined rather than retried. | **MET** | `packages/core/src/platform/runtime-loop.js:82-88`, `:96-104`; `packages/core/src/platform/recovery-policy.js:12-19`; `packages/core/src/platform/reconciliation.js:11-25`; tests `"adapter throw after dispatch marks uncertain, never retries or dead-letters"` (`packages/core/tests/transitions.test.js:167`), `"RECOVERY: uncertainty cannot replay or evade quarantine with a new task ID"` (`packages/core/tests/recovery-integrity.test.js:11`). | — |
| **G4** | The record is reconstructible: state can be rebuilt from committed facts with zero side effects, and incomplete history is refused. | **MET** | `packages/core/src/platform/trace-reducer.js:8-45`; tests `"REPLAY: committed admission/dispatch/result projection equals original with zero effects"` (`packages/core/tests/replay-integrity.test.js:7`), `"REPLAY: changed content/order, missing middle/tail, duplicate/mixed-run/version records reject"` (`:21`), `"replay without genesis explicitly rejects insufficient history"` (`packages/core/tests/fault-injection.test.js:8`). | — |
| **G5** | The public surface is coherent, documented and honestly labelled: import paths work, exports are enumerable, and nothing is described as stable. | **MET** | `packages/core/src/index.js:1-6`; `packages/core/src/sdk/index.js:1`; `packages/core/src/platform/index.js:1-8`; `docs/internal/047-public-api-compatibility.md:6-11`; 30 root exports, 1 SDK export, 22 platform exports enumerated in §8.2. | — |
| **G6** | The limits are disclosed in the product material, not only in internal audits. | **MET** | `README.md` ("What Chord does not yet guarantee"); `packages/core/README.md`; `release-notes-and-limitations.md`; `packages/core/INTEGRITY.md`; §7 of this document. | — |
| **G7** | The architecture constraint holds: minimal dependency surface, no provider/framework coupling, no hidden infrastructure. | **MET** | `packages/core/tests/architecture-integrity.test.js:6` — `"ARCH-18: first-party JS/ESM kernel has only SigilJS runtime dependency and no provider/framework imports"`; `packages/core/src/contracts/sigils.js:1`. | — |
| **G8** | The release evidence describes artifacts that actually exist (provenance integrity). | **MET** | `docs/internal/050-baseline-lock.md` (“13.1 Corrections applied”) (correction C2 reverted scope substitution inside the evidence directories); `:975` (digest verified against the on-disk artifact). | — |
| **G9** | The package installs and imports from a **published or publish-ready** artifact under a resolvable identity. | **NOT MET** | `packages/core/package.json` (`name: @antistructured/chord`, `version: 0.4.0-preview.1`); `docs/internal/050-baseline-lock.md` (“7.1 Verified from the repository”) (`@antistructured/chord` → npm E404); `:864` (`@weipertda/chord` → also E404). | **B4** — npm scope control is *attested*, not verified; no authenticated publish path exists. Owner: maintainer. |
| **G10** | The manifest's repository coordinates resolve to the real repository. | **NOT MET** | `packages/core/package.json` (`repository.url`, `homepage`, `bugs.url` → `github.com/antistructured/chord`); actual `origin` is `github.com/weipertda/chord` (`docs/internal/050-baseline-lock.md` (“10.5 Release-identity blocker (**not** a code defect)”)). | **B2** — GitHub repository transfer/mirror decision. Owner: maintainer. |
| **G11** | Redistribution rights are established for the shipped payload. | **NOT MET** | `docs/internal/050-baseline-lock.md` (“11. Blockers & risks”) (B5); `docs/internal/049-final-report.md:20` ("Applied/approved for redistribution: NO"); `docs/internal/049-continuation/independent-gate/decision.json` (`"legal_clearance": false`). | **B5** — attestation only; no CLA/DCO/assignment, chain of title not independently established. Owner: maintainer / legal. |
| **G12** | A release candidate exists **under the final chosen identity**, and consumer + independent gates have been re-run against it. | **NOT MET** | `docs/internal/050-baseline-lock.md` (“11. Blockers & risks”) (B6); the existing candidate tarball is `weipertda-chord-0.4.0-preview.1.tgz`, SHA-256 `538987e9…` (`docs/internal/050-baseline-lock.md` (“8.4 A separate, real evidence-integrity regression introduced by the working-tree rename”)), i.e. built under the superseded identity. | **B6** — re-pack + re-run consumer and independent gates. Owner: maintainer-gated. |

### 6.3 Narrative for the unmet gates

G1–G8 are the gates that decide whether *the product as described* is real. They are all met, and met by executed tests rather than by assertion.

G9–G12 are gates that decide whether *the product may be published as a public preview*. They are **not** met. None of them is a kernel defect; each is an identity, legal or distribution decision that only the maintainer can make. They are recorded verbatim from `docs/internal/050-baseline-lock.md` (“11. Blockers & risks”) and are carried forward unchanged.

Because **Level A is legitimate as a public preview only if every acceptance gate is satisfied** (§5.2), and G9–G12 are unmet, the current status is:

> **Level A capability: COMPLETE and VERIFIED.**
> **Level A as a *public preview*: BLOCKED on G9–G12** — four maintainer-owned identity/legal/distribution gates, none of which is a code defect.

This is a deliberate, documented split. It permits the product contract, the positioning and the technical story to be finalized now, while preventing any public preview claim from being made before the artifact is genuinely publishable.

### 6.4 Level A verdict

| Question | Answer |
|---|---|
| Does the code do what this document says? | **Yes** — 45 Class A capabilities, each cited and test-backed; suite green. |
| Is the product contract internally consistent and evidence-backed? | **Yes** — this document. |
| May Chord be published as a public preview today? | **No** — G9–G12 unmet. |
| May the positioning in §1.2 be used in internal and engineering material? | **Yes.** |
| May the positioning be used in public launch material? | **Only after G9–G12 are satisfied**, and only within the Level A boundary of §5.2. |
| Are Levels B and C presentable as current capabilities? | **No — never** (§5.6). |

---

## 7. Non-goals

These are contractual. Any proposal, roadmap item or copy that contradicts them is out of scope for Block 050 and later blocks unless this document is amended.

1. **No distributed execution.** Chord coordinates inside one host process. Multi-process and cross-host coordination is Level B.
2. **No durable or multi-process state until Blocks 051–052.** No storage adapter, no WAL, no crash recovery, no cross-process CAS in Level A.
3. **No general workflow DSL.** The intent grammar is a small fixed directive set (`packages/core/src/sdk/chord.js#parseText`); no conditionals, loops, parallelism or user-defined control flow.
4. **No sandboxing of hostile in-process adapters.** Adapters are trusted host code (`docs/internal/047-public-api-compatibility.md:11`).
5. **No cryptographic or signed evidence.** Records are structurally checkable in-process only.
6. **No GUI.** No dashboard, no operator console, no approval UI. The host builds any human-facing surface.
7. **No multi-tenant cloud service.** Chord is an embeddable library.
8. **No provider SDK breadth.** No first-party connectors to model or tool vendors (`docs/internal/040-preview-scope-lock.md`, D3).
9. **No autonomous agent swarms without human approval.** Chord's value proposition is the governed boundary; removing the human from it removes the product.
10. **No distributed consensus.** Not a blockchain, not a quorum system, not a replicated log.
11. **No automatic secret removal from host data.** Context filtering is authorization-scoped, not content-scrubbing (`README.md`).
12. **No exactly-once external effects.** Chord distinguishes *requested*, *dispatched* and *confirmed*; a dispatched effect cannot be undone by cancellation.
13. **No stable API designation.** Nothing in Chord is stable (`docs/internal/047-public-api-compatibility.md:6`).

---

## 8. Evidence index

### 8.1 Verification performed by this pass

| Command | Working directory | Exit code | Result |
|---|---|---|---|
| `timeout 300 bun test` | `packages/core` | **0** | **160 pass / 0 fail / 1371 `expect()` calls / 14 files** |
| `timeout 300 bun run src/verify-runtime.js` | `packages/core` | **0** | `🎉 ALL RUNTIME VALIDATIONS PASSED!` — 9 validation sections including post-dispatch ambiguity → `uncertain`, pre-dispatch exhaustion → `dead_letter`, dead-letter replay, uncertain reconciliation with no-effect evidence, and the SigilJS negative-shape test (`packages/core/src/verify-runtime.js:113-224`) |
| Import-surface enumeration (`bun` self-import of the three manifest paths) | `packages/core` | **0** | Root: 30 exports; `./sdk`: 1 (`createChord`); `./platform`: 22 |
| Exhaustive filesystem/network scan of `packages/core/src/**` | `packages/core` | **0** | Only `packages/core/src/runtime/adapter.js:2-14` touches the filesystem; no socket, server, worker, database or HTTP client exists in the kernel |

Not run in this pass, and therefore **Not verified** here: `npm pack`, a fresh out-of-repo consumer install, the 046 state probes (`node --test docs/internal/046-state-probes.mjs`), and the demo script. Prior reports record these as passing (`docs/internal/050-baseline-lock.md` (“5.2 At HEAD (throwaway worktree `/tmp/opencode/chord-baseline-head`)”)); this pass did not re-execute them.

### 8.2 Public surface at a glance

| Import path | Exports | Classification |
|---|---|---|
| `@antistructured/chord` (root) | 30 — `SCHEMA_VERSION`, `appendRegistryEvent`, `canonicalProjection`, `computeBackoffDelayMs`, `createAdapterRouter`, `createChord`, `createDeterministicAuditReport`, `createRuntimePolicy`, `createTaskQueue`, `dequeueReadyTask`, `diffTraces`, `enqueueTask`, `exportRegistry`, `importRegistry`, `leaseTaskEntry`, `listDeadLetterTasks`, `listQueuedTasks`, `listRegistryEvents`, `markQueueEntryStatus`, `queryArtifacts`, `queryDomains`, `reduceTrace`, `replayDeadLetterTask`, `replayNoSideEffects`, `replayRegistryJournal`, `resolveAdapter`, `runRuntimeCycle`, `scheduleTaskRetry`, `selectReadyTask`, `serializeRegistry` | All experimental (`packages/core/src/index.js:1-6`) |
| `@antistructured/chord/sdk` | `createChord` | Experimental public (`packages/core/src/sdk/index.js:1`) |
| `@antistructured/chord/platform` | 22 — the queue, journal, routing, policy, audit, runtime-loop, reducer and projection exports | Experimental trusted-host plumbing (`packages/core/src/platform/index.js:1-8`) |

No subpath is stable. The SDK instance surface is enumerated in `packages/core/src/sdk/chord.js#createChord`.

### 8.3 Source-to-capability index

| Area | Files |
|---|---|
| Authority / policy | `packages/core/src/platform/authorization.js`, `packages/core/src/platform/policy.js`, `packages/core/src/platform/approval-flow.js` |
| Lifecycle | `packages/core/src/platform/transitions.js`, `packages/core/src/platform/state-invariants.js`, `packages/core/src/platform/task-queue.js`, `packages/core/src/platform/attempts.js` |
| Execution | `packages/core/src/platform/runtime-loop.js`, `packages/core/src/platform/adapter-routing.js`, `packages/core/src/execution/task-packets.js`, `packages/core/src/execution/results.js` |
| Effect truth | `packages/core/src/platform/reconciliation.js`, `packages/core/src/platform/recovery-policy.js` |
| History | `packages/core/src/platform/history.js`, `packages/core/src/platform/trace-reducer.js`, `packages/core/src/platform/event-journal.js`, `packages/core/src/platform/journal-audit.js` |
| Ownership / persistence | `packages/core/src/registry/owner.js`, `packages/core/src/registry/registry.js`, `packages/core/src/registry/snapshot.js`, `packages/core/src/registry/query.js` |
| Contracts | `packages/core/src/contracts/sigils.js` |
| Coordination | `packages/core/src/platform/handoff.js` |
| Public surface | `packages/core/src/sdk/chord.js`, `packages/core/src/sdk/index.js`, `packages/core/src/platform/index.js`, `packages/core/src/index.js` |

### 8.4 Test-to-capability index

All 14 test files passed in this pass (§8.1). Capability coverage by file:

| Test file | Primary capabilities covered |
|---|---|
| `packages/core/tests/adversarial.test.js` | A1, A3–A10, A12, A13, A19, A42 — the authority boundary under forgery, permutation and concurrency attack |
| `packages/core/tests/authorization.test.js` | A1, A2, A8, A16, A19 — the pure evaluator and the trusted-host seam |
| `packages/core/tests/transitions.test.js` | A11, A14, A17–A21, A41 — guarded state machines and ambiguity handling |
| `packages/core/tests/replay-integrity.test.js` | A32, A33, A37 — committed-fact reconstruction and its refusals |
| `packages/core/tests/recovery-integrity.test.js` | A22, A23, A24 — unknown-effect quarantine and evidence-gated reconciliation |
| `packages/core/tests/integrity.test.js` | A29, A30, A31 — private ownership, atomic install, canonical invariants |
| `packages/core/tests/lifecycle-integrity.test.js` | A18, A25, A43 — cancellation vs. late results, run-state gates, reentrancy |
| `packages/core/tests/continuity.test.js` | A25, A26, A27 — pause/resume/cancel, handoff CAS |
| `packages/core/tests/admission-integrity.test.js` | A12, A28 — atomic admission and scoped projection |
| `packages/core/tests/contracts.test.js` | A35, A36, A37, A40 — contract hardening and input strictness |
| `packages/core/tests/hardening.test.js` | A15, A20 — deterministic dequeue and dead-letter consistency |
| `packages/core/tests/fault-injection.test.js` | A33, A34, A38 — history refusals, trace diff, journal completeness |
| `packages/core/tests/canonical-example.test.js` | A44 — the end-to-end governed workflow |
| `packages/core/tests/architecture-integrity.test.js` | A39, A45 — dependency and import discipline |

---

## 9. Risks and open questions

| # | Risk / question | Impact | Owner | Disposition |
|---|---|---|---|---|
| R1 | G9–G12 remain unmet, so Level A cannot be published as a public preview | Blocks any external positioning | Maintainer | Carried forward from `docs/internal/050-baseline-lock.md` (“11. Blockers & risks”) |
| R2 | The persona is defined by obligation, not job title; adoption may stall where no governance obligation exists | Slower adoption than a framework | Product | Accepted. §2.8 is explicit about who should *not* adopt. |
| R3 | The "no human-facing surface" gap (§4.3, category 7) is the most likely adoption blocker | High | Product | Requires a host-side story; a first-party approval UI would be a Level B/C-adjacent investment, not a Level A feature. |
| R4 | The exact-scope grant model is deliberately narrow (§4.3, category 5) | Limits expressiveness for policy-heavy buyers | Product | Accepted by design — exactness over expressiveness. Revisit only with evidence. |
| R5 | Level A's single-process limit makes Chord unusable as a standalone service across hosts | High for platform teams | Product | This is precisely what Block 051–052 (Level B) must address. |
| R6 | The historical "Level A/B/C" collision (§5.1) will confuse readers of 040–047 alongside this document | Medium | Documentation | Mitigation: the naming note in §5.1 and the normative statement "from this document forward". |
| R7 | Competitor characterizations in §4 were not re-verified against the named products | Medium for external copy | Product | §4 is marked Not verified; must be re-checked or rewritten to categories before any external use. |
| R8 | README rewrite was pending at Pass 2 and completed by Pass 4 | Historical / superseded | Documentation | See `docs/internal/050-docs-verification.md`, “Files changed by this pass”. |
| R9 | Nothing in the public API is stable, and the package has never been published | Medium | Maintainer | Preview labelling is correct until G9–G12 are satisfied. |

---

## 10. Inputs this contract hands to later blocks

| Later work | What it must take from this document |
|---|---|
| Block 051–052 engineering (Level B) | §5.3 promotion criteria; the C1–C3 inventory of what must be built; the constraint that Level A semantics must not be weakened to reach Level B. |
| Public README / documentation rewrite (Pass 4) | §1.2 positioning, §2.1 persona, §3.5 prohibited claims, §5.6 representation rules, §7 non-goals. |
| Public release notes | §3.2 Class A as the released capability set; §5.2 for the honest framing ("single-process, in-memory"); §7 for limitations. |
| Marketing / launch material | §4.4 (where Chord loses) must appear; §4.3 competitor rows must be re-verified first; §5.6 rule 2 governs Level B/C mentions. |
| Release gate (Block 055) | §6.2 gate table, with G9–G12 as the outstanding maintainer-owned gates. |
| Any future competitive response | §4.2 category map and §4.5 positioning summary. |

---

## Appendix A — Glossary

- **Attempt** — one execution reservation/dispatch carrying lease, grant ids and approval id (`packages/core/src/contracts/sigils.js:131`).
- **Authority snapshot** — the host-installed, revisioned record of principals, actors, grants and approvals (`packages/core/src/sdk/chord.js#setAuthoritySnapshot`).
- **Committed fact** — a versioned journal record plus a computed state delta, the unit of reconstruction (`packages/core/src/registry/owner.js:15-19`).
- **Effect** — a requested or attempted external operation; its truth may need separate evidence (`packages/core/src/platform/reconciliation.js:39-40`).
- **Grant** — host-issued allow/deny bound to an exact task scope (`packages/core/src/platform/authorization.js:96-101`).
- **Level A / B / C** — release levels as defined in §5; *not* the historical evidence tiers of 040–047.
- **Quarantine** — the `uncertain` state for a dispatched effect whose outcome is unknown; exit requires evidence-backed reconciliation (`packages/core/src/platform/transitions.js:135-153`).
- **Revision** — the monotonically advancing run counter that every mutation is conditioned on (`packages/core/src/registry/owner.js:24`, `:31`).
- **Trusted host** — the embedding application that owns identity, the clock, credentials and persistence (`packages/core/src/sdk/chord.js#hostNow`).

## Appendix B — Verification commands for this document

```bash
REPO=/home/d/Workspace/other-projects/chord
cd "$REPO/packages/core"

# Gate G1–G8 behavioural evidence
bun test                                   # expect: 160 pass / 0 fail / 1371 expect() / 14 files
bun run src/verify-runtime.js              # expect: exit 0, "ALL RUNTIME VALIDATIONS PASSED!"

# Public surface (§8.2)
bun -e 'import("./src/index.js").then(m=>console.log(Object.keys(m).sort().join(", ")))'
bun -e 'import("./src/sdk/index.js").then(m=>console.log(Object.keys(m).sort().join(", ")))'
bun -e 'import("./src/platform/index.js").then(m=>console.log(Object.keys(m).sort().join(", ")))'

# Level A boundary checks (§5.2, §6.2 G9–G12 are NOT verifiable from the repo)
grep -rn "node:fs\|createServer\|child_process\|Worker(" src/ \
  || echo "no kernel persistence/network primitive outside src/runtime/adapter.js"
```

---

*End of Block 050 product contract. This document defines product intent and boundaries; it does not modify the kernel, does not designate any API stable, and does not authorize publication. The only file created by Pass 2 is `docs/internal/050-product-contract.md`.*


## Pass A1 clarification / supersession

Pass 2 test totals and file-change claims remain historical; current engineering checks are in `050-citation-closeout.md`. Release/publication gates are not granted by A1. B2 is a local-origin/canonical-identity decision, not proof the target repository is missing (baseline §13.6). Dedicated snapshot installation enforces authority monotonicity; privileged `commitRun` may bypass it. Audit reproducibility (A38) requires identical state and explicit `options.now`; default timestamps use the wall clock. Level B/C descriptions are future proposals, not current capabilities.
