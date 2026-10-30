# CHORD — Block 050: Durable Coordination Design
> **A1 reading note:** original pass measurements are historical; see “Pass A1 clarification / supersession” below and `docs/internal/050-citation-closeout.md` for current verification.
**Status:** Design only. No implementation, no dependency change, no source modification.
**Scope:** the storage boundary Chord needs before it can claim coordination across process restarts.
**Audience:** the engineer who will implement Block 051, and the maintainer who will approve it.

---

## 0. Method and evidence labels

### 0.1 Labels

Every non-trivial claim carries one of three labels. The label is part of the claim.

| Label | Meaning | How to challenge it |
|---|---|---|
| **Verified** | Reproduced by reading the cited source lines, or by running a command whose output is quoted. | Open the cited `file:line`. |
| **Inferred** | A conclusion drawn from verified facts, but not itself stated in the code. The reasoning chain is given. | Attack the reasoning, not the citation. |
| **Proposed** | A design choice made by this document. Not in the code. Maintainer decision required. | Disagree; nothing depends on it being right. |

Citations are `path:line` relative to the repository root; ranges are `path:12-20`.

### 0.2 What this document is and is not

Not an implementation plan and not a migration script. It specifies the **contract** a storage adapter must satisfy; the **preconditions** that must be enforced inside the durable transaction rather than in memory; the **crash windows** and the durable evidence each leaves behind; the **migration and version rules**; the **bounded scope** of the next block; and the **decisions** a maintainer must make first.

### 0.3 Vocabulary

**Owner** — the private single-process holder of canonical state (`packages/core/src/registry/owner.js:8-9`). **Canonical state** — `RegistryData` minus the event journal (`packages/core/src/platform/history.js:5-8`). **Projection** — `canonicalProjection(registry)`. **Revision** — `registry.run.revision`, the optimistic-concurrency counter. **Journal** — `registry.event_journal`. **History commit** — a `state_committed` event carrying a delta (`packages/core/src/contracts/sigils.js:255`). **Journal ordinal** — *(proposed)* the store-assigned dense ordering key of a journal entry, distinct from `payload.sequence` (§5.2). **Transaction** — one atomic durable write of the unit in §4.1.

### 0.4 Baseline

**Verified.** `cd packages/core && bun test` → 166 pass / 0 fail across 15 files, exit 0. `bun run src/verify-runtime.js` → `ALL RUNTIME VALIDATIONS PASSED`, exit 0. The tree already contains uncommitted modifications to source, tests, docs and manifests; this document does not depend on them being reverted and does not modify them.

---

## 1. Current state: what exists, and what does not

### 1.1 The current atomic unit

**Verified.** The unit of atomicity today is a whole-run clone-swap held in a JavaScript object reference.

- `packages/core/src/registry/owner.js:9-10` — `createStateOwner` creates `{ registry: RegistryData.assert(initial) }`. A plain in-memory object.
- `packages/core/src/registry/owner.js:22-26` — `transact(operation, apply, expectedRevision)` checks reentrancy and revision, then `deepClone`s the current registry into a `draft`.
- `packages/core/src/registry/owner.js:29-36` — the `apply` callback mutates only the draft; then the revision is bumped (`:31`), new attempts are stamped with a dispatch revision (`:32-34`), new journal events are stamped with `run_revision` (`:35`), and the `state_committed` capture is appended (`:36`).
- `packages/core/src/registry/registry.js:44` — `owner.registry = next`: one assignment in one synchronous section.

**Verified.** `packages/core/src/registry/owner.js:21` — `let busy = false`; `:23` throws `REENTRANT_MUTATION` if a mutation is attempted while another is in flight. This is a *per-object* flag, not a per-run lock.

**Inferred.** The current guarantee is exactly: *within one JavaScript turn, either the whole candidate registry becomes visible or none of it does*. That is correct for a single process and worthless across a restart, because the object graph is not on disk.

### 1.2 The current durability story

**Verified.** There is no durable store. A full-text search for disk-touching code in `packages/core/src/**` finds exactly one module: `packages/core/src/runtime/adapter.js:1-15` — `readText` / `writeText`, a Bun-first, Node-fallback text helper, referenced by neither the registry, the owner, the runtime loop, nor the platform.

**Verified.** The only disk-shaped concept is the *snapshot*, and it is a serialization format, not a store:

- `packages/core/src/registry/snapshot.js:4-20` — `exportRegistry` produces a `Snapshot` with `snapshot_version: "0.3.0"` (`:9`), a wall-clock `created_at` (`:10`), `counts` (`:11-17`), and the full `registry` (`:18`). `:22-24` — `serializeRegistry` is `JSON.stringify(exportRegistry(registry), null, 2)`.
- `packages/core/src/registry/snapshot.js:26-46` — `importRegistry` **quarantines** in-flight work: a snapshot containing a `leased` or `running` task drives the task to `uncertain` and the operation to `unknown` (`:33-45`).

**Inferred.** `importRegistry` is the *import* path, not the *recovery* path. It exists for a foreign or untrusted snapshot. Treating it as "restore after a crash" would be a category error (§6.5).

### 1.3 Four counters a reader must keep straight

**Verified.**

| Counter | Where | What it orders | Source |
|---|---|---|---|
| `run.revision` | `run.revision` | Optimistic concurrency over the whole run | `packages/core/src/registry/registry.js:35-40` |
| `payload.sequence` | `state_committed` payload | History-commit chain depth | `packages/core/src/registry/owner.js:16` |
| audit `sequence` | audit report rows | Diagnostic row index | `packages/core/src/platform/journal-audit.js:7` |
| `authority_revision` | authority snapshot | Permission freshness | `packages/core/src/platform/authorization.js:138` |

**Verified.** `packages/core/src/platform/journal-audit.js:7` emits `sequence: index + 1`, restarting at 1 for the report. That number is unrelated to the `state_committed` chain sequence, which starts at 1 for the first commit (`packages/core/src/registry/owner.js:16`).

**Inferred.** A durable journal needs a fourth, unambiguous ordering key that survives restarts. Introducing one is a naming problem first: it must not be called `sequence`. §5.2 proposes `journal_ordinal`.

### 1.4 Where the boundary must be cut

**Inferred.** The cut must satisfy three constraints at once.

1. **The kernel stays pure.** `packages/core/src/platform/state-invariants.js:5` — *"Shared by installation and historical reconstruction. No effects or clocks."* `packages/core/src/platform/trace-reducer.js:7` — *"Reducer consumes committed facts only; no clocks, adapters or executables."* An adapter that performs I/O cannot live in either module.
2. **The decision rules stay pure.** `packages/core/src/platform/authorization.js:3-8` documents the evaluator as deterministic with no I/O. Commit preconditions are a *decision* and must be testable without a disk.
3. **The effect is atomic.** Whatever writes the bytes writes the whole unit or none of it.

**Proposed.** Cut the boundary as:

```
  pure core (no I/O)              │  impure shell (I/O)
  ────────────────────────────────┼────────────────────────────────
  src/storage/contract.js         │  src/runtime/storage/<provider>.js
   ├ evaluateCommitPreconditions() │   ├ open() / close() / describe()
   ├ evaluateLoadPreconditions()   │   ├ load()
   ├ storage error codes           │   ├ commit()
   └ type documentation            │   ├ readJournal()
                                   │   ├ readLease()
                                   │   └ recordEffectAck() / readEffectAck()
```

The pure module holds the *rules*; the adapter holds the *bytes*. The adapter calls the pure module **inside its transaction** (§3.3). That is what makes the rules authoritative rather than advisory.

---

## 2. The canonical state storage interface

### 2.1 Design constraints

**Proposed.**

| # | Constraint | Reason |
|---|---|---|
| C1 | Provider-neutral. No SQL, no file paths, no `fs` in the contract. | §13 compares four providers; the core must not know which is in use. |
| C2 | Every write is a *transaction over the whole unit*, not field patches. | The current unit is a whole-registry clone-swap (§1.1). Partial writes would weaken the atomicity the kernel already has. |
| C3 | Every read returns a fully consistent snapshot or a typed failure. | A partially-applied read lets the kernel build a draft on top of a fiction. |
| C4 | Errors are typed and enumerated, never thrown strings. | `packages/core/src/platform/authorization.js:25-30` already sets this pattern. |
| C5 | Reads and commits are synchronous; async only where the provider demands it. | `packages/core/src/registry/owner.js:30` rejects a promise returned from `apply` (`ASYNC_COMMIT`). The commit path must stay synchronous inside the critical section. |
| C6 | The interface never exposes a mutable reference to stored state. | `packages/core/src/registry/owner.js:8` says the owner must never be exposed; same rule, one layer down. |
| C7 | No "repair", "fix", or "overwrite" primitive. | A repair primitive is a hole in the audit trail. Recovery is expressed as normal, journalled commits. |

### 2.2 The interface

**Proposed.**

```ts
// src/storage/contract.js — pure, no I/O.

export const StorageErrorCode = Object.freeze([
  "STALE_REVISION",              // optimistic concurrency check failed
  "RUN_MISMATCH",                // candidate belongs to a different run
  "SCHEMA_MISMATCH",             // candidate schema_version != stored
  "UNSUPPORTED_STORAGE_VERSION", // stored format is newer than this code
  "INVALID_HISTORY",             // journal prefix, chain, or delta is invalid
  "LEASE_LOST",                  // another holder owns the task's lease
  "FENCE_LOST",                  // presented fence token is older than stored
  "STORAGE_UNAVAILABLE",         // I/O error, disk full, lock timeout
  "STORAGE_CORRUPT",             // stored bytes unreadable or self-inconsistent
  "INVALID_CONTEXT"              // malformed request
]);

export interface StorageDescriptor {
  provider: string;              // "memory" | "sqlite" | "json-file" | ...
  storage_version: string;       // this store's on-disk format version
  schema_version: string;        // SCHEMA_VERSION of the data it holds
  capabilities: { transactions: boolean; leases: boolean; multi_process: boolean };
}

export interface CanonicalStore {
  open(): void; close(): void; describe(): StorageDescriptor;
  load(): LoadResult;
  commit(request: CommitRequest): CommitResult;
  readJournal(options?: { since?: number; limit?: number }): JournalEntry[];
  readLease(task_id: string): LeaseRecord | null;
  recordEffectAck(ack: EffectAck): AckResult;
  readEffectAck(attempt_id: string): EffectAck | null;
}

export type LoadResult =
  | { ok: true; registry: RegistryData; revision: number; schema_version: string;
      storage_version: string; logical_now: number; leases: LeaseRecord[];
      pending_acks: EffectAck[] }
  | { ok: false; code: StorageErrorCode; detail?: string };
export type CommitResult =
  | { ok: true; revision: number;
      lease?: { task_id: string; token: number; expires_at: number } | null }
  | { ok: false; code: StorageErrorCode; detail?: string };

export interface CommitRequest {
  expectedRevision: number;       // CAS token: the caller's view of the revision
  nextRegistry: RegistryData;      // candidate, including its new journal entries
  operation: string;               // "runtime_claim" | "runtime_result" | "host_commit" | ...
  lease_grant?: LeaseGrant | null; // requested atomically with the commit
  lease_present?: LeasePresent | null; // the fence the caller believes it holds
  evidence?: CommitEvidence[];     // queryable copies of committed evidence
}
// JournalEntry = JournalRecord + { ordinal: number }
// LeaseGrant = { task_id, attempt_id, holder_id, duration_ms }
// LeasePresent = { task_id, attempt_id, token }
// CommitEvidence = { kind, operation_id?, attempt_id?, task_id?, idempotency_key?, reference?, payload }
```

### 2.3 Method semantics

**Proposed.** "Precondition" means *evaluated by the store, against the stored bytes, inside the transaction*.

#### `load()`

| # | Precondition | On violation |
|---|---|---|
| L1 | The store header names a `storage_version` this code understands (§10.2). | `UNSUPPORTED_STORAGE_VERSION` |
| L2 | The header `schema_version` equals `SCHEMA_VERSION`. | `SCHEMA_MISMATCH` |
| L3 | The stored state payload satisfies `RegistryData.assert`. | `STORAGE_CORRUPT` |
| L4 | Reassembled `registry.event_journal` is byte-identical to the stored journal rows, in stored order. | `STORAGE_CORRUPT` |
| L5 | `reduceTrace(journal)` succeeds and its projection equals the stored projection. | `STORAGE_CORRUPT` |
| L6 | The stored `run_id` is stable for the life of the store. | `RUN_MISMATCH` |

L5 deserves emphasis. `packages/core/src/platform/trace-reducer.js:8-45` rebuilds the registry from the journal alone and independently re-checks every delta against the reconstructed state (`packages/core/src/platform/history.js:40` throws `CONFLICTING_HISTORY` when the recorded `before` does not match). It also re-validates every transition (`packages/core/src/platform/trace-reducer.js:32`). **Verified.** The kernel therefore already contains a complete, side-effect-free integrity checker for a journal. Using it as a load-time verifier costs one pure function call and converts "the file looks plausible" into "the journal provably reproduces the stored state". It is the highest-value check in this design.

#### `commit(request)`

The store performs, in this order, **inside one transaction**:

| Step | Action |
|---|---|
| 1 | `BEGIN IMMEDIATE` (or the provider's equivalent exclusive write transaction). |
| 2 | Read the stored state row and journal length. |
| 3 | Evaluate every precondition in §3.2 against the *stored* copy. Any failure → rollback, return the typed error. |
| 4 | Write the new state row. |
| 5 | Append the new journal rows with store-assigned ordinals. |
| 6 | Insert the evidence rows (§4.2). |
| 7 | Apply the lease grant, if requested, allocating a store-side fencing token. |
| 8 | Update the clock floor to `max(stored_floor, request.now ?? stored_floor)`. |
| 9 | `COMMIT`. |

**Verified** (measured): on SQLite, `BEGIN IMMEDIATE` … `ROLLBACK` leaves **0** rows in both the state and journal tables after a mid-transaction failure, and `COMMIT` leaves 1 and 1 respectively. The transaction is genuinely all-or-nothing across multiple tables.

#### `readJournal(options)`

Returns entries in **stored ordinal order**, not timestamp order. `packages/core/src/platform/event-journal.js:19` appends to the end of the array and `packages/core/src/platform/trace-reducer.js:12` consumes in array order; the chain check at `packages/core/src/platform/trace-reducer.js:29` requires `commit.previous_commit_id === previous.event_id`, an *insertion-order* chain. A store that sorted by `at` could reorder two events written in the same millisecond and break the chain.

**Verified.** `packages/core/src/platform/journal-audit.js:4` sorts by `a.at - b.at`. That is safe for the audit *report* (a projection, not a source of truth) but must **not** become the store's read order.

#### Leases and effect acks

See §7 and §8.4.

### 2.4 Error vocabulary

**Proposed.** The storage layer reuses Chord's existing error style rather than inventing a parallel one.

| Storage code | Nearest existing code | Where it is used today |
|---|---|---|
| `STALE_REVISION` | `STALE_REVISION` | `packages/core/src/registry/registry.js:36`, `:40`; `packages/core/src/registry/owner.js:24` |
| `RUN_MISMATCH` | `RUN_MISMATCH` | `packages/core/src/registry/registry.js:38` |
| `SCHEMA_MISMATCH` | `SCHEMA_MISMATCH` | `packages/core/src/registry/registry.js:39`; `packages/core/src/platform/authorization.js:37` |
| `INVALID_HISTORY` | `INVALID_HISTORY` | `packages/core/src/registry/registry.js:42`; `packages/core/src/registry/owner.js:49` |
| `INVALID_CONTEXT` | `INVALID_CONTEXT` | `packages/core/src/registry/registry.js:35`; `packages/core/src/platform/authorization.js:34` |
| `LEASE_LOST` | `STALE_ATTEMPT` | `packages/core/src/platform/authorization.js:66` |
| `FENCE_LOST` | `STALE_ATTEMPT` | `packages/core/src/platform/authorization.js:69-70` |
| `STORAGE_UNAVAILABLE` | `ADAPTER_ERROR` | `packages/core/src/platform/runtime-loop.js:97` |
| `STORAGE_CORRUPT` | *new* | — |

**Proposed.** `STORAGE_CORRUPT` and `STORAGE_UNAVAILABLE` are genuinely new and must not be folded into existing codes. `STORAGE_CORRUPT` means "the bytes are internally inconsistent" and is always terminal for that store (fail closed). `STORAGE_UNAVAILABLE` means "the store could not be reached right now" and is transient. Collapsing them would make a corrupt store look like a busy one, which is the wrong recovery decision.

**Proposed.** The storage codes live in `src/storage/contract.js`; `src/platform/authorization.js` gains a thin re-export so a caller can catch one family. `DECISION_CODES` (`packages/core/src/contracts/sigils.js:132`) is about *authorization decisions* and must not be widened to include storage codes — mixing them would let a storage failure be reported as a permission decision.

---

## 3. Transaction and revision preconditions

### 3.1 What is enforced today

**Verified.** The complete check set in `commitRun` (`packages/core/src/registry/registry.js:32-45`):

| # | Check | Line | Failure |
|---|---|---|---|
| 1 | owner shape | `:33` | throw `INVALID_CONTEXT` |
| 2 | `expectedRevision` is a safe integer | `:35` | throw `INVALID_CONTEXT` |
| 3 | `expectedRevision === current.run.revision` | `:36` | return `STALE_REVISION` |
| 4 | `RegistryData.assert(nextRegistry)` | `:37` | throw contract error |
| 5 | `next.run.run_id === current.run.run_id` | `:38` | throw `RUN_MISMATCH` |
| 6 | `next.run.schema_version === current.run.schema_version` | `:39` | throw `SCHEMA_MISMATCH` |
| 7 | `next.run.revision === current.run.revision + 1` | `:40` | throw `STALE_REVISION` |
| 8 | committed journal is a prefix of the candidate journal | `:42` | throw `INVALID_HISTORY` |
| 9 | `assertCanonicalTransition(current, next, operation)` | `:43` | throw `INVALID_TRANSITION` / `IMMUTABLE_TASK` |

**Verified.** `packages/core/src/registry/owner.js:43-53` (`install`, the trusted-host path) enforces the same invariants differently: `HostCommitRequest.assert` (`:45`), a revision check returning `{ok:false}` (`:46`), `RegistryData.assert` (`:48`), a journal-equality check via `sameData` (`:49`), and a revision-increment check (`:50`).

**Inferred.** The two paths enforce the same invariants with different code and different failure shapes (throw vs. return), and they compare the journal differently — `sameData` (structural, `packages/core/src/registry/owner.js:49`) versus `JSON.stringify` (`packages/core/src/registry/registry.js:42`). These agree for objects with identical key insertion order and can disagree in principle. Unifying them behind one pure function is a prerequisite for putting them in a transaction.

### 3.2 The precondition set that must move into the durable transaction

**Proposed.** Each precondition names the code that states it today and whether it is already pure.

| ID | Precondition | Origin | Pure? | Enforced today |
|---|---|---|---|---|
| **P1** | `expectedRevision` is a safe integer ≥ 0 | `registry.js:35` | yes | in memory |
| **P2** | `expectedRevision === stored.revision` | `registry.js:36` | yes | in memory |
| **P3** | `candidate.run.run_id === stored.run.run_id` | `registry.js:38` | yes | in memory |
| **P4** | `candidate.run.schema_version === stored.run.schema_version` | `registry.js:39` | yes | in memory |
| **P5** | `stored.run.schema_version === SCHEMA_VERSION` | `authorization.js:37` | yes | in memory |
| **P6** | `candidate.run.revision === stored.revision + 1` | `registry.js:40` | yes | in memory |
| **P7** | candidate journal's first *N* entries are identical to the stored journal's *N* entries, *N* = stored journal length | `registry.js:42` | yes | in memory |
| **P8** | candidate journal length ≥ stored journal length | implied by P7 | yes | in memory |
| **P9** | the new `state_committed` continues the chain: `sequence === prev.sequence + 1`, `previous_commit_id === prev.event_id`, `previous_revision === stored.revision` | `owner.js:16-17`; validated at `trace-reducer.js:29` | yes | **only at replay time** |
| **P10** | the new `state_committed` carries `history_version === HISTORY_VERSION` | `owner.js:15`; `history.js:4` | yes | **only at replay time** |
| **P11** | `assertCanonicalTransition(stored, candidate, operation)` passes | `registry.js:43` | yes (`state-invariants.js:5`) | in memory |
| **P12** | every appended event carries `run_revision === candidate.run.revision` | `owner.js:35`; required by `trace-reducer.js:37` | yes | in memory (stamped, not checked) |
| **P13** | `RegistryData.assert(candidate)` passes | `registry.js:37` | yes | in memory |
| **P14** | every appended non-commit event's `event_id` appears in the new `state_committed`'s `diagnostic_ids`, in order | `owner.js:14,18`; required by `trace-reducer.js:29` | yes | **only at replay time** |
| **P15** | *(new)* lease fence: the stored lease for the task is held by the presented `attempt_id` at the presented `token` | §7 | yes | **does not exist** |
| **P16** | *(new)* lease grant: no live lease exists for the task, or the existing one is expired | §7 | yes | **does not exist** |
| **P17** | *(new, recommended)* the recorded delta matches the delta re-derived from the stored state | `history.js:15` | yes | **only at replay time** |

**Inferred.** The critical column is the last one. The table separates in-memory checks/stamping from replay-only validation (P9, P10, P14, P17) and new lease checks (P15, P16), in a function that is not called on the write path. If the write path does not enforce them, a store can durably record a history that its own reducer will later reject — a self-inflicted `INVALID_HISTORY` on restart, with no way to tell corruption from a bad writer.

**Proposed.** The store must evaluate P1–P17 against the **stored** bytes, inside the transaction, before it writes anything.

### 3.3 Why the pure evaluator is called twice

**Proposed.** `evaluateCommitPreconditions(stored, request, now)` in `src/storage/contract.js` is invoked at two moments, for two reasons.

| Moment | Called by | Purpose | Failure handling |
|---|---|---|---|
| Before the transaction | The core, against its in-memory copy | **Fast fail** — avoid a disk round-trip for an already-invalid request. | Return the typed error immediately. |
| Inside the transaction | The adapter, against the stored bytes | **Authoritative** — the in-memory copy may be stale, tampered with, or simply not the copy the store holds. | Roll back; return the typed error. |

**Inferred.** The second call is not redundant. P2 guarantees the *revision* matches, not that the *contents* match. A caller could load at revision 7, mutate its copy in place without committing, then commit with `expectedRevision: 7` — the revision check passes, the contents do not. Only P11, P13 and P17, evaluated against the stored copy, catch that.

**Proposed.** P11 must be re-evaluated against the stored copy inside the transaction: `packages/core/src/platform/state-invariants.js:6` takes `(before, after, operation)` and touches no clock and no I/O, so it is safe to call from inside an adapter.

**Proposed.** P17 is the strongest of the seventeen and is marked *recommended* rather than required. `packages/core/src/platform/history.js:15-27` (`stateChanges`) is pure; recomputing it inside the transaction and comparing with the candidate's recorded `changes` proves the candidate's delta is exactly the difference between the stored state and the candidate state. **Verified.** `packages/core/src/platform/history.js:40` already performs the inverse check at replay time, so P17 is a *proactive* strengthening that moves detection from "at restart" to "at write". The cost is O(state size) per commit; the benefit is that a corrupted or rewritten history is refused at the moment it is offered.

### 3.4 What stays in memory

**Proposed.** The following remain in-process and must not move into the store:

- **`busy` / reentrancy** (`packages/core/src/registry/owner.js:21,23`) — a per-object guard against a reentrant host callback during `apply`. It has no meaning across processes.
- **The lease cap check** (`packages/core/src/platform/runtime-loop.js:27,38`) — a policy limit on concurrency, not a consistency invariant.
- **The `attempt.dispatch_revision` guard** (`packages/core/src/platform/runtime-loop.js:83`) — not a storage concern; it becomes strictly stronger once a durable lease exists (§7.5).
- **The adapter's frozen context** (`packages/core/src/execution/task-packets.js:66`) — built during the claim, consumed by the adapter.

**Inferred.** The rule that decides all four: *if the check protects against a caller in this process, it stays in memory; if it protects against a state that outlives this process, it must be in the store.*

---

## 4. Atomic persistence of state and evidence

### 4.1 The atomic unit

**Proposed.** One durable transaction carries exactly this:

```
ATOMIC_UNIT
├── state      canonicalProjection(candidate)      — the registry without its journal
├── journal    candidate.event_journal[N .. end]  — the newly appended entries only
├── history    the final appended entry (state_committed), already inside `journal`
├── evidence   CommitEvidence[]                   — queryable copies (§4.2)
└── lease?     LeaseRecord                        — optional grant, token allocated by the store
```

**Verified.** The `state_committed` capture is not a separate structure: `packages/core/src/registry/owner.js:36` calls `capture`, which appends a `state_committed` event to the draft's journal (`:15-19`). "History capture" and "journal append" are the same append; they are separated here only to make the unit legible.

**Inferred.** The unit deliberately does **not** contain the whole journal. Re-writing the entire journal per commit would be O(history) per write. Appending only the delta keeps writes proportional to the change. The "journal is a prefix" rule (P7) is what makes the delta append safe: the store never has to trust the caller's copy of history, only its extension.

### 4.2 Two kinds of evidence, kept apart

**Verified.** Committed execution evidence already lives *inside* the canonical state:

- `packages/core/src/registry/registry.js:157` — `registry.execution_results.push(deepClone(result))`.
- `packages/core/src/registry/registry.js:156` — `task.last_result = deepClone(result)`.
- `packages/core/src/registry/registry.js:171-172` — the active and pending attempts are deleted once the result is ingested.

**Verified.** The `Outcome` contract is validated at `packages/core/src/registry/registry.js:133`; `StoredTask.last_result` at `packages/core/src/contracts/sigils.js:235`.

**Inferred.** "The execution evidence" is already part of the canonical state and is therefore already covered by the atomic unit. A store needs nothing extra to make it durable.

**Proposed.** The store *additionally* records a queryable copy of each committed result in an `evidence` table, in the same transaction. The duplication must be justified: the canonical copy answers *"what does Chord believe happened?"*; the evidence copy answers *"what did Chord durably assert, and when?"*. The evidence copy is what a human reads during reconciliation (§9.5). It is derived, never authoritative.

**Proposed.** A second, *different* kind of evidence sits outside the canonical state: the **staged effect acknowledgement** (§8.4). It records that an external effect was dispatched and what was heard back. It must not be in the canonical state, for three reasons.

| Reason | Detail |
|---|---|
| It would bump the revision. | `packages/core/src/registry/owner.js:31` bumps `run.revision` on every transaction. A revision bump would invalidate `active.dispatch_revision` (`packages/core/src/platform/runtime-loop.js:83`), causing a legitimate in-flight result to be rejected as `STALE_REVISION`. |
| It is not part of the domain state. | `canonicalProjection` (`packages/core/src/platform/history.js:5-8`) strips only the journal. Anything else added to `RegistryData` becomes part of every history delta and every reducer comparison. |
| It is not idempotent. | It is written once per attempt, but a crash-and-retry may write it twice. Canonical state is compared structurally (`sameData`, `packages/core/src/platform/history.js:9-14`); a duplicate would change the projection and break L5. |

### 4.3 Crash between state and evidence

**Proposed.** This crash is **impossible by construction**, and the design says so precisely rather than implying a general "atomicity" claim.

| Property | Statement | How it is achieved |
|---|---|---|
| **CS1** | No reader ever observes a partially-written registry. | The state row is replaced in one transaction; a reader sees the old row or the new one. |
| **CS2** | A transaction the store reported `ok` is durable and survives restart. | The store must not report `ok` before the transaction is committed *and* synced. |
| **CS3** | A transaction known to have rolled back leaves no partial trace; a crash after durable commit but before reporting `ok` has an unknown acknowledgement outcome. | Reopen and inspect committed identity; missing acknowledgement alone does not imply absence. |
| **CS4** | The journal and the state are always mutually consistent. | Same transaction; L5 re-verifies on load. |

**Verified** (measured): on SQLite with `PRAGMA journal_mode=WAL` and `PRAGMA synchronous=FULL`, a `BEGIN IMMEDIATE` transaction that writes a state row and a journal row and then throws leaves **0** and **0** rows after `ROLLBACK`; without the throw it leaves **1** and **1** after `COMMIT`.

**Inferred.** CS2 is where most "durable" implementations quietly fail: reporting success before the data is on stable storage. For a WAL-mode SQLite file that means `synchronous=FULL` (or `NORMAL`, faster and durable only against application crashes, not power loss). The choice is a maintainer decision (§16, D4).

### 4.4 The write-ahead requirement for external effects

**Verified.** Today the order is: `packages/core/src/platform/runtime-loop.js:29` — the claim transaction; `:70` — the adapter's `execute` is resolved and frozen inside the claim; `:77` — `await invoke()`; `:79` — the result transaction.

**Inferred.** The claim and the invocation are separated only by the `await` at `:77`. If the process dies between `:72` (claim committed) and `:77`, the state says the task is `running` with an active attempt, and nothing says whether the effect happened. Today that is unrecoverable because nothing is durable at all. With a store, the claim is durable before `:77` — the dispatch is durable before the effect — which is exactly the write-ahead property required.

**Proposed.** The durable dispatch record must contain everything needed to decide "did this happen?" after a crash:

| Field | Source | Purpose |
|---|---|---|
| `attempt_id` | `packages/core/src/platform/attempts.js:18` | Identifies the dispatch instance. |
| `operation_id` | `packages/core/src/platform/reconciliation.js:22` | Identifies the logical operation across re-admissions. |
| `idempotency_key` | *proposed*, §9.4 | Lets the adapter recognise a replay. |
| `lease_token` | *proposed*, §7 | Lets the store fence a stale writer. |
| `dispatch_revision` | `packages/core/src/platform/attempts.js:42` | Lets the kernel reject a late result. |

**Verified.** `packages/core/src/platform/runtime-loop.js:56` sets `operation.state = 'dispatched'` and `operation.attempt_id`; `:57-63` sets the lease expiry, the authority revision, the grant ids and the approval id, and consumes the approval — all inside the claim transaction.

**Inferred.** All of that is already in the candidate registry before the commit. With a durable store it becomes durable at that point. **No new kernel state is required to obtain the write-ahead property** — that is a significant finding, and it means §8 mostly constrains *ordering* rather than demanding new state.

---

## 5. Durable event journal requirements

### 5.1 What the journal is today

**Verified.**

- `packages/core/src/platform/event-journal.js:3-21` — `appendRegistryEvent` builds an event with `event_id` (`:5`, from `stableId`), `type`, `at: Date.now()` (`:7`), `schema_version` (`:8`), `run_id` (`:9`), `run_revision` (`:10`), actor/principal/correlation/causation ids (`:11-14`), `authority_revision` (`:15`), `policy_decision` (`:16`), `payload` (`:17`), then pushes it onto `registry.event_journal` (`:19`).
- `packages/core/src/contracts/sigils.js:238` — the `JournalRecord` contract; `at` must be an integer, `type` must look like an id.
- `packages/core/src/platform/trace-reducer.js:36` — the set of event types the reducer accepts. Anything outside it makes the journal unreducible.

**Verified.** `packages/core/src/registry/owner.js:11` appends the genesis `state_initialized` event when the owner is created with an empty journal; `:15-19` appends a `state_committed` event after every transaction.

### 5.2 Ordering: the missing ordinal

**Verified.** The journal has **no** per-event sequence number of its own. Ordering is implied by array position plus two indirect markers: `run_revision` (`packages/core/src/registry/owner.js:35`, stamped on every new event) and `payload.sequence` (`packages/core/src/registry/owner.js:16`, present only on `state_committed` events).

**Inferred.** Array position is not durable. Once the journal is rows in a table, "position" becomes whatever the store's query returns, and the store must reproduce it exactly, including for events written in the same millisecond.

**Proposed.** The store assigns a dense, monotone, per-run **journal ordinal** to every appended entry, starting at 1, incremented by 1 per entry. It is a store-internal column, not a field added to `JournalRecord` — adding a field to a Sigil contract would change `SCHEMA_VERSION`.

| Property | Requirement |
|---|---|
| Dense | No gaps. Ordinal *n+1* follows ordinal *n*. |
| Monotone | Never decreases, never reused, never reassigned. |
| Per-run | A store holds one run; multi-run stores get a per-run sequence. |
| Stable | An ordinal never changes once assigned. |
| Distinct from `payload.sequence` | `payload.sequence` counts *commits*; the ordinal counts *entries*. They are different numbers and must never be compared. |

**Inferred.** The naming hazard is real and has already bitten the project once: `packages/core/src/platform/journal-audit.js:7` uses `sequence` for a third, unrelated meaning. The durable ordinal is therefore called `journal_ordinal` everywhere, and §10.1 adds a rule that the three never share a column, field, or variable name.

### 5.3 Retention

**Proposed.**

| ID | Rule | Rationale |
|---|---|---|
| **R1** | The store never modifies or deletes an existing journal entry. | `packages/core/src/registry/registry.js:42` treats the existing journal as immutable committed evidence. |
| **R2** | The adapter issues no `UPDATE` or `DELETE` against the journal table. | Enforceable in the adapter's code and testable by inspecting the statements it runs. |
| **R3** | The genesis `state_initialized` entry is never removed. | `packages/core/src/platform/trace-reducer.js:18` rejects any trace whose first event is not `state_initialized`. |
| **R4** | No middle commit is ever removed. | `packages/core/src/platform/trace-reducer.js:29` requires `previous_commit_id` to chain to the immediately preceding commit. |
| **R5** | **No compaction in Block 051.** | Every rule above is a compaction prohibition. Any compaction must keep genesis plus a contiguous commit chain, so it cannot be a simple "keep the last N". |
| **R6** | Unbounded growth is an accepted, stated limitation of this block. | A compacted journal needs snapshot-and-anchor semantics the reducer does not support: `reduceTrace` accepts `initialState === null` only (`packages/core/src/platform/trace-reducer.js:9`). |

**Inferred.** R5 and R6 are the honest conclusion. The reducer's signature accepts only a full event list and explicitly rejects a pre-seeded `initialState`. Supporting snapshots would mean changing the reducer's contract and the `HistoryGenesis` shape (`packages/core/src/contracts/sigils.js:256`) — a schema-version event, not a storage event. It belongs in a later block, scoped as its own design.

### 5.4 Journal durability versus state durability

**Proposed.** These must be **the same transaction**, always.

**Inferred.** A journal that is durable but whose state is not (or the reverse) is strictly worse than having neither. If the journal survives and the state does not, the reducer will happily reconstruct a state the store never committed — the audit trail would describe history that never happened. If the state survives and the journal does not, `load()` cannot satisfy L4/L5 and the store is unusable. One transaction gives both or neither, and there is no third state to reason about.

**Verified.** This is already true in memory: the journal lives inside `RegistryData` (`packages/core/src/registry/registry.js:17`) and is swapped with the state in the same assignment (`packages/core/src/registry/registry.js:44`).

---

## 6. Snapshot and recovery semantics

### 6.1 What "crash-safe" means here

**Proposed.** A store is crash-safe when, after an abrupt process death at any instruction boundary, the store can be opened and yields exactly one of:

| Outcome | Meaning |
|---|---|
| **S1** | The last transaction that reported `ok` is fully present. |
| **S2** | A transaction known to have rolled back is fully absent; one interrupted before commit acknowledgement may be fully present or fully absent, never partial. |
| **S3** | The state and the journal are mutually consistent. |

There is no fourth outcome. "Some of it is there" is not on the list, and its absence is the whole point.

### 6.2 Startup reconstruction

**Proposed.** The procedure, in order.

| Step | Action | Failure |
|---|---|---|
| 1 | `open()` the store; read the header. | `STORAGE_UNAVAILABLE` → abort; do not run in memory. |
| 2 | Version gate (§10.2). | `UNSUPPORTED_STORAGE_VERSION` → **fail closed**. |
| 3 | Read the state row and the journal rows. | `STORAGE_UNAVAILABLE` → abort. |
| 4 | Reassemble `registry = { ...state, event_journal: journalRows }`. | — |
| 5 | `RegistryData.assert(registry)`. | `STORAGE_CORRUPT` → **fail closed**. |
| 6 | **Verify L5**: `canonicalProjection(reduceTrace(journalRows))` equals `canonicalProjection(registry)`. | `STORAGE_CORRUPT` → **fail closed**. |
| 7 | Verify the chain invariants P9, P10, P14 on the last commit. | `INVALID_HISTORY` → **fail closed**. |
| 8 | Restore the clock floor (§11.5). | — |
| 9 | Load leases and pending effect acknowledgements. | — |
| 10 | Apply the **uncertainty sweep** (§6.4). | — |
| 11 | Hand the owner a fresh `RegistryData` whose journal equals the stored journal. | — |

**Inferred.** Step 6 is the crux. It is possible to construct a store whose state row and journal row are each internally well-formed and mutually inconsistent — for example if the adapter wrote the state but the journal write was skipped by a bug. L5 catches that at startup instead of letting the run proceed on a state the history does not support. The cost is one pure reducer pass at startup, not per commit.

**Proposed.** Steps 2 and 5–7 all **fail closed**: the process must not start a run against a store it cannot vouch for. A degraded in-memory mode ("start anyway, warn loudly") is explicitly rejected — it turns a detectable corruption into an undetectable divergence.

### 6.3 Replay and recovery are different operations

**Proposed.** The codebase already keeps these apart; conflating them is the most likely way to introduce a bug in this block.

| | **Replay** | **Recovery** |
|---|---|---|
| Purpose | Analyse history; verify; audit; compare traces. | Restore a live, writable run. |
| Input | *Any* journal — including one from another system. | The store's own durable bytes. |
| Function | `reduceTrace` / `replayNoSideEffects` (`packages/core/src/platform/trace-reducer.js:8,46`). | `store.load()` + §6.2. |
| Side effects | **None, by construction.** `packages/core/src/platform/trace-reducer.js:7` — *"Reducer consumes committed facts only; no clocks, adapters or executables."* | May write — but only through guarded, journalled commits. |
| Result | A projected registry. | A live owner. |
| Invariant | `effects_invoked: 0` (`packages/core/src/platform/trace-reducer.js:47`). | **No external effect may be invoked during recovery.** |
| Failure | Throws `UNSUPPORTED_HISTORY` / `INVALID_HISTORY`. | Fails closed, or quarantines. |

**Inferred.** The `replayNoSideEffects` name is load-bearing. It exists because the obvious implementation of "replay the journal" is "run the journal's events through the runtime again", which would invoke adapters. Recovery needs the same guarantee, and it needs it *stated*, because recovery is exactly where someone would be tempted to "re-run the last cycle to find out what happened".

**Proposed.** Recovery must be expressible without any adapter reference in scope: the recovery module must not import `adapter-routing`, and the recovery test must assert that no adapter was resolved during recovery.

### 6.4 Recovery and in-flight work

**Proposed.** After a crash the store may contain tasks in `leased` or `running` state with an active attempt. Recovery must decide what to do with them.

**Verified.** The kernel already has exactly the right machinery. `packages/core/src/platform/transitions.js:135-153` — `markTaskUncertain(registry, taskId, { reason, now })` refuses to overwrite a terminal state (`:139-142`, journaling `task_result_ignored`), sets the task to `uncertain` (`:143`), sets the operation to `unknown` (`:144-145`), sets the queue entry to `uncertain` (`:146-147`), and deletes both attempt reservations (`:148-149`). `packages/core/src/platform/recovery-policy.js:13-16` — `isRetryEligible` returns `false` for `dispatched` and `acknowledged`: post-dispatch ambiguity is never blindly retried. `:21-24` — `shouldQuarantineUnknown()` returns `true`.

**Proposed.** The startup uncertainty sweep is:

```
for each task in registry.tasks:
  if task.status is 'leased' or 'running':
    if the task has a durable lease that is still live (now < lease.expires_at):
        leave it alone   — a live lease means another holder owns it (§7)
    else:
        markTaskUncertain(task, { reason: 'LEASE_EXPIRED', now })   — journalled, revision-bumping
```

**Inferred.** Two properties make this safe.

1. **It reuses the kernel's existing uncertainty path.** No new state machine, no new transition, no new contract field. `markTaskUncertain` is already reachable from `packages/core/src/platform/runtime-loop.js:85` and `:101`.
2. **The transition is legal.** `packages/core/src/platform/state-invariants.js:15` allows `running → uncertain` through `canTaskTransition`. The `imported` escape hatch at `:13` is for the import path and is *not* needed here.

**Inferred.** A task left `running` because its lease is live is a task another process is working on. Under the current single-process model that cannot happen. Under a multi-process model it is the normal case, and it is exactly why the lease must be in the store rather than in memory.

### 6.5 Recovery is not import

**Proposed.** `importRegistry` (`packages/core/src/registry/snapshot.js:26-46`) must **not** be used as the recovery path.

**Verified.** Its quarantine exists because an imported snapshot is untrusted: it may have been produced by another system, an older version, or hand-edited. The comment at `packages/core/src/registry/snapshot.js:28-30` says so — *"imported in-flight work is uncertain, never silently executable. Attempt state does not survive import; the host reconciles through explicit replay (fresh admission)."*

**Inferred.** The recovery path has a strictly stronger trust position: the bytes were written by this store, under this store's transaction discipline, and the chain is verified at L5. Using the import quarantine for recovery would discard the durable lease and attempt records that §7 depends on; reset `active_attempts` wholesale (`packages/core/src/registry/snapshot.js:34`) instead of fencing per-task; and treat a live lease held by a peer process as expired.

**Proposed.** The two paths must be separate code with separate tests. They may share *one* helper — "mark this task uncertain" — but must not share a code path that decides *which* tasks to mark. Import marks everything in flight; recovery marks only what its leases say is unowned.

---

## 7. Attempt leasing and fencing

### 7.1 What exists today

**Verified.**

`packages/core/src/platform/runtime-loop.js:13` — `const LEASE_MS = 30_000;`. `:57-58` — `leaseTaskEntry(entry, at, LEASE_MS); attempt.lease_expires_at = at + LEASE_MS;`. `packages/core/src/platform/task-queue.js:38-42` — `leaseTaskEntry` sets the queue entry status to `leased` and `lease_expires_at = now + durationMs`. `packages/core/src/contracts/sigils.js:237` — `QueueRecord` carries `lease_expires_at: number | null`; `:131` — `Attempt` carries `lease_expires_at: number`. `packages/core/src/platform/authorization.js:66` — the commit stage requires `attempt.lease_expires_at > now`, else `STALE_ATTEMPT`. `packages/core/src/platform/task-queue.js:79,127` — the lease is cleared when a task completes or is cancelled.

**Verified.** `packages/core/src/platform/runtime-loop.js:64` — `activatePendingAttempt(registry, task.task_id, registry.run.revision + 1)`; `packages/core/src/platform/attempts.js:38-44` stores `{ attempt, dispatch_revision }` in `active_attempts`. `packages/core/src/platform/runtime-loop.js:83` — the commit guard requires `active.dispatch_revision === registry.run.revision`.

**Inferred.** The lease today is a **timestamp stored in shared state**. It has no owner. Nothing records *who* holds the lease, and nothing records a *generation* of the lease. Consequently the lease cannot prevent two writers from acting on the same task: whoever writes last wins, and the loser's write is either silently overwritten or rejected as `STALE_REVISION` for the wrong reason.

### 7.2 Why `attempt_id` and `authority_revision` are not fencing

**Verified.** `packages/core/src/platform/attempts.js:18` — `attempt_id: stableId("attempt")`. `packages/core/src/utils/id.js:1-4` — `stableId` is `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`.

**Inferred.** `attempt_id` is a *label*, not a fence.

1. It is not monotone. Two attempts can be created in the same millisecond, and the random suffix provides no ordering.
2. It is not issued by an authority. The kernel mints it locally; there is no allocator that could say "attempt 7 supersedes attempt 6".
3. Nothing requires a writer to *present* it at commit time in a way the store can compare against a stored value.

**Verified.** `packages/core/src/platform/authorization.js:138` — `attempt.authority_revision !== authority.authority_revision` → `STALE_ATTEMPT`. **Inferred.** `authority_revision` fences *authority*, not *writes*. It answers "was the permission still valid when the result came back?" (`packages/core/src/platform/authorization.js:71-72` makes this explicit). It says nothing about "is this process still the one that owns the task?".

**Inferred.** The practical consequence: a stale writer cannot be *identified* by the store. It can only be *out-competed* by the revision counter, and only if it is unlucky enough to notice. If the stale writer's commit is rejected, the run learns a revision conflict — it does not learn "another process took this task".

### 7.3 The durable lease

**Proposed.** A lease row in the store:

```
LeaseRecord = {
  task_id:     string,
  attempt_id:  string,        // the holder's attempt
  holder_id:   string,        // the identity of the writer
  token:       number,        // store-allocated, strictly monotone per task
  granted_at:  number,
  expires_at:  number
}
```

**Proposed.** `holder_id` is an opaque, host-supplied identity string. It is not a Chord contract and carries no authority meaning — it exists so a human reading the store can tell *which* worker holds a task, and so a stale writer can be named. `"anonymous"` is an acceptable default.

**Proposed.** The lease is granted **atomically with the dispatch commit**, in the same transaction as the state and journal (§4.1). It is never granted separately: a lease without the dispatch state, or a dispatch state without its lease, is exactly the torn state this design exists to prevent.

**Proposed.** The lease is released when the attempt completes or is cancelled — again in the same transaction as the state change. `packages/core/src/platform/task-queue.js:79` and `:127` already clear `lease_expires_at` at exactly those points.

### 7.4 The fencing token

**Proposed.** The token is the store's contribution: allocated by the store, inside the transaction, from a per-task counter, `token(task) = previous_token(task) + 1`.

**Inferred.** Why a store-allocated number rather than the `attempt_id`:

- It is **monotone**, so "greater than" is meaningful — `attempt_id` is not.
- It is **unforgeable** by a stale writer, because a stale writer cannot increment the store's counter. It can only present the number it was given.
- It is **decoupled from wall-clock time**, so it does not inherit the clock-skew problem of §11.6.

**Proposed.** The fence is checked at commit time:

| Condition | Result |
|---|---|
| Stored lease for the task is absent | `LEASE_LOST` |
| Stored lease's `attempt_id` ≠ presented `attempt_id` | `LEASE_LOST` |
| Stored lease's `token` > presented `token` | `FENCE_LOST` |
| Stored lease's `token` < presented `token` | `FENCE_LOST` (the store's token went backwards — corruption) |
| Stored lease's `token` === presented `token` and `attempt_id` matches | accepted |
| Lease expired but no other holder has taken it | accepted, **and** the store re-grants a fresh token |

**Inferred.** The expired-but-uncontested case is the interesting one. A writer whose lease expired is not automatically wrong — nobody else took the task. Only the store can know that, because only it has seen every grant. So the fence check must compare against the *stored lease*, never against the local clock.

### 7.5 Interaction with the commit-stage guard

**Verified.** The kernel already has a commit guard at `packages/core/src/platform/runtime-loop.js:83`, checking three things: the run is executable, the authority allows the commit, and `active.dispatch_revision === registry.run.revision` with a matching `attempt_id`.

**Inferred.** With a durable lease, this guard becomes strictly stronger:

| Guard | Guards against | Works across processes? |
|---|---|---|
| `dispatch_revision === run.revision` | A result arriving after any other mutation | **No** — it is run-local, and two processes do not share a revision |
| `attempt_id` match | A result for a superseded attempt | Partially — the ids differ, so it catches the common case |
| `authority_revision` (`packages/core/src/platform/authorization.js:138`) | A permission that changed under the attempt | Yes, if the authority snapshot is shared |
| **durable lease token** | **Any writer that did not hold the lease at grant time** | **Yes** |

**Proposed.** The durable fence is checked in the store, inside the transaction (P15), *in addition to* the in-run guard. The in-run guard stays: it is cheap, it produces a better error message, and it protects the single-process case where the store adds nothing.

### 7.6 What fencing cannot do

**Proposed.** "Fencing" is routinely oversold, so the limit must be explicit.

**A fence inside Chord's store prevents a stale writer from corrupting Chord's state. It does not prevent a stale writer from performing an external effect.** The external system sees only what Chord sends it; to fence the external effect, the external system must itself enforce a token — a conditional write, an idempotency key, or a compare-and-set on the provider's side.

**Proposed.** Chord should therefore pass its `lease_token` (or the derived `idempotency_key`, §9.4) to the adapter in the context, and the adapter contract should document that a provider which supports fencing should be given it. This is advisory — Chord cannot enforce it. §14 repeats this.

---

## 8. Crash windows around external effects

### 8.1 The four windows

**Proposed.** Between "the intent to act" and "the knowledge of the outcome" there are four intervals. Each must have a defined durable record and a defined recovery action.

| # | Window | What is durable at the end of it | Recovery action |
|---|---|---|---|
| **W1** | Intent → dispatch decision | The claim commit: task `running`, attempt active, lease held, operation `dispatched`, revision bumped, journal entries appended. | Nothing to do. The effect has not been attempted. A lease expiry triggers the sweep (§6.4) → `uncertain`. |
| **W2** | Dispatch decision → adapter invoked | Same as W1, plus the fact that the adapter *may* have been entered. | **Unknown.** The store cannot distinguish "not entered" from "entered and lost". → `uncertain`. |
| **W3** | Adapter invoked → outcome known | Same as W1, plus a **staged effect acknowledgement** (§8.4). | The outcome is known and can be committed. |
| **W4** | Outcome known → outcome committed | Same as W3, plus the committed result inside `registry.execution_results`. | Nothing. The commit is atomic. |

**Inferred.** W2 is the hard one, and it is irreducible. Any system that dispatches an external effect and then dies cannot know whether the effect happened. This is not a Chord limitation; it is a property of distributed systems. Chord's job is to *detect* W2, *not guess*, and *require external evidence* to resolve it.

**Verified.** The kernel already treats W2 as the dangerous case. `packages/core/src/platform/runtime-loop.js:96-104` catches any adapter failure and drives the task to `uncertain` via `markTaskUncertain` (`:101`); `packages/core/src/platform/recovery-policy.js:13-16` refuses to retry a `dispatched` effect.

### 8.2 What the store must record at each window

**Proposed.**

| Window | Store obligation |
|---|---|
| W1 | The claim transaction commits state + journal + lease + operation `dispatched` + attempt records, all in one unit. |
| W2 | **Nothing more is possible.** The store must not claim otherwise. The presence of a `dispatched` operation with no acknowledgement *is* the W2 signal. |
| W3 | A staged effect acknowledgement is written (outside the revision, §4.2). |
| W4 | The result transaction commits state + journal + evidence, atomically. The staged ack may then be marked consumed — as a separate, non-revision-bumping operation. |

### 8.3 The durable W2 signal

**Proposed.** W2 is detected by the *absence* of a record, which is a weak signal. The design must make it as strong as possible.

| Signal | Strength |
|---|---|
| `operation.state === 'dispatched'` | **Weak.** It means "we asked", not "we don't know". A `dispatched` operation with a committed result becomes `confirmed` (`packages/core/src/platform/runtime-loop.js:91`), so `dispatched` surviving into a new process is the real signal. |
| No `execution_results` entry for the attempt | **Strong.** `packages/core/src/registry/registry.js:157` appends the result at commit time, so its absence means the result was never committed. |
| No staged effect acknowledgement for the attempt | **Strong.** Same argument. |
| The lease is expired | **Supporting.** An expired lease means no live owner. |
| `active_attempts` still holds the attempt | **Supporting.** `packages/core/src/platform/runtime-loop.js:83` shows the attempt is still pending commit. |

**Inferred.** The combination "operation `dispatched` ∧ no committed result ∧ no staged ack ∧ lease expired" is a reliable W2 detector, computable entirely from the durable state. It is the trigger for the uncertainty sweep.

**Proposed.** This is deliberately *not* the same as marking every `running` task uncertain. §6.4 distinguishes "lease expired and nobody else took it" (→ uncertain) from "lease still live" (→ a peer is working on it).

### 8.4 The staged effect acknowledgement

**Proposed.** A separate, non-revision-bumping record:

```
EffectAck = {
  attempt_id:   string,
  operation_id: string | null,
  task_id:      string,
  state:        "acknowledged" | "failed" | "unknown",
  reference:    string | null,     // provider receipt, correlation id
  detail:       object | null,
  at:           number
}
```

**Proposed.** The write path is:

```
1. adapter returns or throws
2. adapter (or the runtime) calls recordEffectAck({ attempt_id, state, reference, ... })
3. the runtime commits the result through store.commit(...)   ← the revision bump
```

**Inferred.** The order matters: the ack is written **before** the result commit. If the process dies between 2 and 3, the ack survives and the recovery sweep can see "the adapter said `acknowledged`, but the result was never committed" — a *different* and much cheaper recovery than "we know nothing". The ack is a write-ahead record for the commit, not a substitute for it.

**Inferred.** The ack must be written **outside** the revision-bumping transaction for the reason given in §4.2: a revision bump would invalidate `active.dispatch_revision` and cause a legitimate in-flight result to be rejected.

**Proposed.** `recordEffectAck` must be idempotent: writing the same ack twice is a no-op, not an error. A crash between the ack write and the process noticing will cause a retry.

**Proposed.** `recordEffectAck` is a write outside the main transaction and therefore outside the strict atomicity of §4.3. That is acceptable **because** the ack is not authoritative: it is a hint that makes W2 recoverable, and the authoritative outcome is the committed result. If the ack is lost, the system degrades to "we know nothing" — the current behaviour, not a regression.

---

## 9. Idempotency and reconciliation contracts

### 9.1 "Unknown effect", defined precisely

**Proposed.** An **external effect** is an action requested of an adapter that leaves Chord's boundary: an HTTP request, a file write, a message send, a payment.

**Unknown effect** is the state in which: *Chord has durably recorded that an effect was **dispatched**, and has durably recorded **no** acknowledgement of its outcome.*

**Inferred.** The critical word is *distinguish*. An unknown effect means Chord cannot tell which of two mutually exclusive worlds it is in:

- **W-A:** the adapter was never entered; the effect did not happen.
- **W-B:** the adapter was entered; the effect happened; the acknowledgement was lost.

Chord's durable state is identical in both worlds. No store, no journal, and no amount of local computation can separate them.

### 9.2 Durable representation

**Verified.**

| Element | Contract | Where set |
|---|---|---|
| Operation state | `requested \| dispatched \| confirmed \| unknown \| not_executed \| compensated` | `packages/core/src/contracts/sigils.js:257` |
| Operation record | `{ operation_id, signature, task_id, state, attempt_id, reconciliation_id }` | `packages/core/src/contracts/sigils.js:257` |
| Task status | `... \| uncertain \| ...` | `packages/core/src/contracts/sigils.js:230` |
| Reconciliation record | `{ reconciliation_id, operation_id, task_id, attempt_id, principal_id, decision, evidence, at }` | `packages/core/src/contracts/sigils.js:259` |

**Verified.** `packages/core/src/platform/reconciliation.js:23` — the operation is created with `state: "requested"` and `attempt_id: null`. `packages/core/src/platform/runtime-loop.js:56` — dispatch sets `state = 'dispatched'` and records the attempt id. `packages/core/src/platform/runtime-loop.js:91` — the result sets `state = 'confirmed'` on completion, `unknown` otherwise. `packages/core/src/platform/transitions.js:145` — `markTaskUncertain` sets `state = 'unknown'`.

**Verified.** `packages/core/src/contracts/sigils.js:257` — `OperationRecord` has **no** `idempotency_key` field. `:230` — `StoredTask` has none. `:157` — `TaskPacket` has none.

### 9.3 What Chord can and cannot verify

**Proposed.** This table is the honest boundary of the whole design.

| Question | Chord's answer | Mechanism |
|---|---|---|
| Was an effect dispatched? | **Yes.** | `operation.state === 'dispatched'` with an `attempt_id`. |
| Was a result ever committed for it? | **Yes.** | `execution_results` (`packages/core/src/registry/registry.js:157`). |
| Did an adapter return an outcome? | **Yes, if the ack was written.** | The staged effect ack (§8.4). |
| Is the permission that authorised it still valid? | **Yes.** | `attempt.authority_revision`, `grant_ids`, `approval_id` (`packages/core/src/platform/authorization.js:138-157`). |
| Is a reconciliation already on record? | **Yes.** | `operation.reconciliation_id` (`packages/core/src/contracts/sigils.js:257`). |
| **Did the external system actually perform the effect?** | **No.** | No protocol for it exists. |
| **Would the external system suppress a replay?** | **No.** | Only the external system knows. |
| **Was the acknowledgement lost, or never produced?** | **No.** | Indistinguishable. |
| **Was the idempotency key honoured?** | **No.** | The provider decides. |
| **Is the external system's state consistent with ours?** | **No.** | We cannot read it. |

### 9.4 Idempotency key

**Verified.** `packages/core/src/platform/recovery-policy.js:26-28`:

```js
/** Idempotency keys must be explicit (adapter responsibility) - kernel does not invent */
export function getIdempotencyKey(task) {
  return task?.idempotency_key || null;
}
```

**Verified by source inspection.** `getIdempotencyKey` and its comment are the only source lines containing `idempotency`; no caller or contract field wires it to execution. And **verified**: `packages/core/src/platform/recovery-policy.js` is imported by nothing in `packages/core/src/`, `packages/core/tests/`, or `packages/core/examples/`.

**Inferred.** `getIdempotencyKey` is **dead code today**, and it is dead in a way that is itself informative: `task.idempotency_key` does not exist on any contract (`packages/core/src/contracts/sigils.js:157,230`), so contract-valid task packets yield `null`; arbitrary plain objects passed directly to this internal helper can supply that property. The comment is correct as a *policy* — the kernel does not invent keys — but the plumbing is missing.

**Proposed.** Block 051 should close that gap. The key is derived from identifiers that are already durable and already survive re-admission:

```
idempotency_key = `${operation_id}:${attempt_id}`
```

| Property | Why it holds |
|---|---|
| Deterministic | Pure function of two strings. |
| Stable across restart | Both ids are written to the journal before the effect is dispatched. |
| Unique per dispatch attempt | `attempt_id` is freshly minted per attempt (`packages/core/src/platform/attempts.js:18`). |
| Distinct across re-admission | `operation_id` binds the logical operation; `attempt_id` differs per attempt. A *new* attempt after a `confirmed_not_executed` reconciliation therefore gets a **new** key — correct, because the effect is known not to have happened and a new attempt is a genuinely new effect. |
| Not derived from `task_id` | `task_id` can change across re-admission. A `task_id`-derived key would let a re-admitted task evade the provider's dedupe — exactly the evasion `packages/core/src/platform/reconciliation.js:11-25` exists to prevent. |

**Inferred.** When there is no `operation_id` — for example a task that entered through `commitRun` without passing through `admitOperation` (`packages/core/src/platform/reconciliation.js:18`) — there is no stable operation identity. The key must then be `null`, and the adapter must be told no idempotency guarantee is available. Inventing a `task_id`-based key there would create a false promise.

**Proposed (transport).** The key reaches the adapter in the execution context. **Verified.** `packages/core/src/platform/runtime-loop.js:67` builds the context as a plain object literal, and `packages/core/src/execution/task-packets.js:66` freezes a shallow copy. **Verified.** This context is **not** a Sigil contract — no `define(...)` covers it. Adding a field is therefore **additive and contract-neutral**: it does not change `SCHEMA_VERSION` and does not affect any consumer that destructures the known fields.

**Proposed.** The same key must be recorded durably so a recovery process can find it. This is the one place where the design would touch a contract:

| Option | Change | Cost |
|---|---|---|
| **A** | Add `idempotency_key?: string \| null` to `OperationRecord` (`packages/core/src/contracts/sigils.js:257`). | Changes `SCHEMA_VERSION`. Triggers the whole §10 apparatus. |
| **B** *(recommended)* | Store the key in the store's own `evidence`/`attempt` row, not in the Chord contract. The contract stays unchanged; the store records it alongside the attempt id. | No schema change. The kernel reads it from the store. |

**Proposed.** Option B. Block 051 should not change `SCHEMA_VERSION`; it should add a storage layer. Changing the contract version and adding a storage layer in the same block makes both harder to review and harder to roll back.

**Proposed.** `getIdempotencyKey` should be repointed at the durable attempt/operation record rather than at `task.idempotency_key`. Since the module is imported nowhere, this is not a public API change.

### 9.5 Resolution paths

**Verified.** `packages/core/src/platform/reconciliation.js:29-54` is the resolution path, and it is strict.

| Line | Requirement |
|---|---|
| `:31` | The request's `expectedRevision` must match the run revision. |
| `:34` | The task must be `uncertain`, `blocked` or `cancelled`, and the operation must be `unknown`. |
| `:35-36` | The principal must be a **human** (`p.kind === "human"`) whose authentication window covers `now`. |
| `:37-38` | The principal must still hold admit-stage permission. |
| `:39-40` | The evidence kind must match the decision exactly: `confirmed_completed` → `receipt`; `confirmed_not_executed` → `no_effect_confirmation`; `authorized_compensated` → `compensation_receipt`; `still_unknown` → `operator_review`. |
| `:42` | The record is validated by `ReconciliationRecord.assert`. |
| `:46` | The operation state moves to `confirmed` / `not_executed` / `compensated` / `unknown`. |
| `:47-51` | A confirmed or compensated operation closes the task. |
| `:52` | An `effect_reconciled` event is appended. |

**Inferred.** This is a well-built resolution path and it should not be redesigned. The durable layer's job is narrower: **make the reconciliation record durable, and make the evidence that feeds it durable and queryable.** The evidence table described in §4.2 is exactly that.

**Verified.** `packages/core/src/platform/reconciliation.js:11-17` — `operationSignature` strips `task_id`, `source_spec_id`, `operation_id`, `authority_binding`, `status`, `created_at`, `retry_count`, `last_result` and `inputs.spec.id`, then canonicalises the key order. `:21` refuses a second operation with the same signature. **Inferred.** This is the structural quarantine that stops the same logical operation being re-admitted under a new `task_id` — and it is why §9.4 refuses to derive the idempotency key from `task_id`.

---

## 10. Schema compatibility and migrations

### 10.1 Four version axes

**Proposed.** Chord already has three independent version numbers; the design adds a fourth. They must not be conflated.

| Axis | Value today | Meaning | Changes when |
|---|---|---|---|
| `SCHEMA_VERSION` | `"chord.contracts.v1"` (`packages/core/src/contracts/sigils.js:3`) | The shape and semantics of the Chord contracts. | A contract's fields or semantics change. |
| `HISTORY_VERSION` | `"chord.history.v1"` (`packages/core/src/platform/history.js:4`) | The shape of the `state_committed` delta. | `HistoryCommit` / `HistoryGenesis` change. |
| `snapshot_version` | `"0.3.0"` (`packages/core/src/registry/snapshot.js:9`; `packages/core/src/contracts/sigils.js:244`) | The serialization format of an exported snapshot. | The snapshot envelope changes. |
| **`storage_version`** | *new* — e.g. `"chord.store.v1"` | The on-disk layout of the store. | The table layout, column set, or encoding changes. |

**Inferred.** The distinction between `SCHEMA_VERSION` and `storage_version` matters most. A store can be upgraded (rows migrated, columns added) without the contract changing, and the contract can change without the store changing. Keeping them separate means a store upgrade does not force a contract version bump, and vice versa.

**Inferred.** `HISTORY_VERSION` is checked on *replay* (`packages/core/src/registry/owner.js:13` selects the previous commit by `history_version`; `packages/core/src/contracts/sigils.js:255` pins the literal `"chord.history.v1"`). It must remain independent of `storage_version`: a store migration that re-encodes rows does not change the meaning of a delta.

### 10.2 Migration rules

**Proposed.**

| ID | Rule | Failure |
|---|---|---|
| **M1** | The store's `storage_version` is written in a header record, read at `open()`. | — |
| **M2** | Stored `storage_version` **newer** than the code understands → **fail closed**. Never open, never migrate, never downgrade. | `UNSUPPORTED_STORAGE_VERSION` |
| **M3** | Stored `storage_version` **older** → run the migration chain, then write the new version. | migration error → abort |
| **M4** | Stored `schema_version` ≠ `SCHEMA_VERSION` → **fail closed**. A store cannot hold two contract versions at once without a per-record discriminator, which does not exist. | `SCHEMA_MISMATCH` |
| **M5** | Migrations run **inside a transaction** and are idempotent. | abort |
| **M6** | Migrations never rewrite the journal's *meaning*. They may re-encode rows; they may not drop, reorder, or re-sequence entries. | abort |
| **M7** | A migration is verified by re-running the §6.2 startup check (steps 5–7) after it completes. | `STORAGE_CORRUPT` |
| **M8** | There is no destructive in-place migration of an unknown version. If the migration path is unknown, fail closed and require an explicit operator action. | `UNSUPPORTED_STORAGE_VERSION` |

**Inferred.** M2 and M4 together mean: **Chord refuses to run against state it cannot fully interpret.** This matches the existing posture at `packages/core/src/platform/authorization.js:37` (`run.schema_version !== SCHEMA_VERSION` → `SCHEMA_MISMATCH`) and `packages/core/src/platform/trace-reducer.js:16` (a journal event whose schema differs → `UNSUPPORTED_HISTORY`).

**Inferred.** M4 deserves a note. The alternative — a store holding records of mixed contract versions, discriminated per record — is technically possible but is a large amount of machinery for contracts still at `v1`, and it would make every read path version-aware, violating the simplicity goal of §2. The recommendation is to fail closed and require an explicit export/import migration via the existing snapshot path.

**Verified.** The snapshot path already exists for exactly this: `packages/core/src/registry/snapshot.js:4-24` exports, `:26-46` imports (with quarantine). "Fail closed, export from the old store, import into the new one" is a viable operator procedure with existing machinery.

### 10.3 What a `SCHEMA_VERSION` v2 would require

**Proposed.** If a future block changes the contracts, these are the consequences, listed so the cost is visible before it is paid.

| Change | Consequence |
|---|---|
| A new field on `StoredTask`, `Attempt`, `OperationRecord`, etc. | `SCHEMA_VERSION` → `chord.contracts.v2`. |
| Every stored registry is now `SCHEMA_MISMATCH` under v1 code. | M4 → fail closed. |
| Journal events carry the old `schema_version` (`packages/core/src/platform/event-journal.js:8`). | `packages/core/src/platform/trace-reducer.js:16` rejects them → the journal is unreducible under v2. |
| Therefore a v2 store must **either** migrate the journal's schema stamps **or** keep v1 journals readable. | The second option requires the reducer to accept mixed schema versions — a reducer change. |

**Inferred.** The journal's schema stamp is the sharp edge. A v1 journal is not v2-reducible as written. This is a real constraint on any future contract change, and it argues for keeping `SCHEMA_VERSION` stable across Block 051 (Option B in §9.4) and for a separate, later block that solves journal-version migration deliberately.

### 10.4 Journal survival across migrations

**Proposed.** Migrations may: add columns to the state table; add tables (evidence, leases, effect acks); re-encode a payload; backfill a new column with a derived value.

Migrations may **not**: drop a journal row; reorder journal rows; change a journal row's `payload.sequence`; change a journal row's `run_revision`; change a `state_committed` row's `changes`; change a `state_committed` row's `previous_commit_id`.

**Inferred.** The last four are what make the chain verifiable. `packages/core/src/platform/trace-reducer.js:29` checks `sequence`, `previous_commit_id`, `previous_revision` and `diagnostic_ids` in one expression; `packages/core/src/platform/history.js:40` checks the recorded `before` values against the reconstructed state. Change any of them and the journal stops reducing — which L5 would catch, at startup, as `STORAGE_CORRUPT`.

---

## 11. Deterministic time and ID injection

### 11.1 The problem

**Verified.** Chord's state contains wall-clock timestamps in 28 places and non-deterministic identifiers in 9 more. A durable store turns this from a stylistic annoyance into a correctness problem: the store must reproduce the exact bytes it wrote, and a recovering process must reason about expiry.

### 11.2 Complete enumeration of wall-clock sites

**Verified** by exhaustive search of `packages/core/src/**`.

| File | Lines | What the clock stamps |
|---|---|---|
| `packages/core/src/platform/event-journal.js` | 7 | `event.at` — every journal event |
| `packages/core/src/registry/registry.js` | 62, 73, 90, 105, 119, 168 | domain `state_history`, artifact `history` (×2), task `created_at`, domain `state_history` on result, queue entry `available_at` |
| `packages/core/src/registry/snapshot.js` | 10 | `snapshot.created_at` (ISO string) |
| `packages/core/src/platform/task-queue.js` | 17, 27, 38, 44, 78, 112 | `available_at` default, `selectReadyTask` default, `leaseTaskEntry` default, `dequeueReadyTask` default, `scheduleTaskRetry` backoff base, `replayDeadLetterTask` default |
| `packages/core/src/platform/transitions.js` | 122 | domain `state_history` |
| `packages/core/src/platform/approval-flow.js` | 15, 28 | approval/pause timestamps |
| `packages/core/src/platform/handoff.js` | 64, 87 | handoff proposal/response timestamps |
| `packages/core/src/platform/journal-audit.js` | 19, 23 | audit `created_at` |
| `packages/core/src/sdk/chord.js` | Stable `module#symbol` references in the body; search named functions/members | the host clock read (monotonic guard at `:45-49`) |
| `packages/core/src/platform/runtime-loop.js` | 21 | `options.now` fallback |
| `packages/core/src/utils/id.js` | 3 | `stableId` timestamp component |

**Inferred.** Two distinct kinds are mixed here.

1. **Recorded timestamps** — `event.at`, `created_at`, `history[].at`. These are *data*: part of the canonical state, compared by `sameData` (`packages/core/src/platform/history.js:9-14`). They must be deterministic for tests and for byte-reproducible commits.
2. **Clock reads used as defaults** — `options.now ?? Date.now()` in `packages/core/src/platform/task-queue.js:17,78,112`. These are *policy inputs*, not recorded values. They need not be persisted, but must be injectable for tests and replay.

### 11.3 Complete enumeration of identifier sites

**Verified.**

| File | Line | Prefix |
|---|---|---|
| `packages/core/src/registry/registry.js` | 12 | `run` |
| `packages/core/src/platform/task-queue.js` | 12 | `queue` |
| `packages/core/src/platform/attempts.js` | 18 | `attempt` |
| `packages/core/src/platform/event-journal.js` | 5 | `evt` |
| `packages/core/src/platform/reconciliation.js` | 22, 41 | `operation`, `reconciliation` |
| `packages/core/src/execution/task-packets.js` | 8, 38 | `task`, and a second site in the packet builder |

**Verified.** `packages/core/src/utils/id.js:1-4`:

```js
export function stableId(prefix = "id") {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}
```

**Inferred.** `stableId` is both non-deterministic *and* clock-derived. Under a durable store this creates two problems: **non-reproducibility** (two commits from the same logical state produce different bytes, breaking byte-level store comparison and golden-file tests) and **ordering ambiguity** (the millisecond component is coarse; ids minted in the same millisecond are ordered only by their random suffix).

**Proposed.** Block 051 introduces an injectable id source alongside the injectable clock: `stableId(prefix)` → `ids.next(prefix)`, where `ids` is host-supplied and defaults to the current behaviour so nothing changes for existing callers.

### 11.4 The seams that exist today

**Verified.**

| Seam | Where | What it covers |
|---|---|---|
| Runtime cycle clock | `packages/core/src/platform/runtime-loop.js:21` — `typeof options.now === 'function' ? options.now : Date.now` | The runtime loop's `now()` |
| Host clock | `packages/core/src/sdk/chord.js#hostNow` — `lastNow` monotonic guard, `trustedHost.now()` | The SDK's clock, with a monotonicity check that throws `INVALID_CONTEXT` on a backwards step |
| Queue clock | `packages/core/src/platform/task-queue.js:17,27,38,44,78,112` — `options.now` | Queue defaults |
| Audit clock | `packages/core/src/platform/journal-audit.js:19` — `options.now` | Audit report |
| Attempt clock | `packages/core/src/platform/attempts.js` — none; `lease_expires_at` is written by the caller | — |

**Verified.** `packages/core/src/sdk/chord.js#hostNow` is a genuinely strong seam:

```js
const raw = trustedHost && typeof trustedHost.now === "function" ? trustedHost.now() : Date.now();
if (!Number.isSafeInteger(raw) || raw < 0 || raw < lastNow) throw authorityError("INVALID_CONTEXT");
lastNow = raw;
```

**Inferred.** The SDK's clock is *monotonic within a process* but *not durable*. `lastNow` is a local variable (`packages/core/src/sdk/chord.js#hostNow`); it dies with the process. After a restart the clock jumps back to wall-clock time, and any `lease_expires_at` computed before the restart is compared against a clock that may be behind it.

### 11.5 The persisted logical clock floor

**Proposed.** The store persists a `logical_now` floor, updated on every commit to `max(stored_floor, request_now)`. On load, the host's clock is raised to at least the stored floor.

**Inferred.** This makes the existing monotonic guard survive a restart.

| Situation | Without a floor | With a floor |
|---|---|---|
| Process restarts 1 ms after a commit | `lastNow` resets to -1; the guard does **not** compare against persisted `event.at`, so a lower nonnegative first read is accepted and prior expiry observations may be lost | The floor is restored first; `now` never goes backwards |
| Wall clock is corrected backwards by NTP | Same failure | The floor holds at the last observed value, so the correction is absorbed |
| Two processes on the same store | They can disagree on `now` | The floor is store-wide and monotone; each process raises its own clock to it |

**Inferred.** The floor makes Chord's time *monotone*, not *accurate*. It prevents backward regression but does not prevent early expiry after a forward clock jump. It does **not** solve a legitimate forward jump — §11.6.

**Proposed.** The floor is updated inside the commit transaction (step 8 of §2.3) and is therefore exactly as durable as the state.

### 11.6 Clock skew, and why leases must not use the wall clock

**Proposed.** Two processes on one store may have different wall clocks. If lease expiry is decided by a *local* comparison (`now < lease.expires_at`), then a process whose clock is fast will steal a live lease, and a process whose clock is slow will keep a lease alive after another process took it.

**Proposed.** Therefore the **store** must decide lease liveness, not the client. The lease row's `expires_at` is compared against a store-side notion of time, and the *token* — not the clock — is what actually prevents a stale writer. This is the same reason §7.4 says the fence check compares against the stored lease rather than the local clock.

**Inferred.** A single-node store still has one clock (the host's), so this is a constraint for the multi-process case (§12), not an immediate bug. But building the store so that the *token* is the real guard means the clock only decides when a lease is *eligible* for takeover, not who is *allowed* to write — the correct ordering of concerns.

### 11.7 Deterministic time and the journal

**Proposed.** The journal's `event.at` (`packages/core/src/platform/event-journal.js:7`) is a recorded timestamp and therefore part of the canonical state and of every delta. It must be injectable so that a commit is reproducible.

**Proposed.** `appendRegistryEvent` gains an optional `meta.at`: `appendRegistryEvent(registry, type, payload, meta = {})`, where `meta.at` may be an integer. If absent, the clock is read. This is purely additive to an internal function and does not touch a contract.

**Inferred.** This matters for the store: a deterministic clock means the same logical sequence of commits produces the same bytes, which makes store-level golden tests possible and makes "did this commit change anything?" cheap to answer.

---

## 12. Multi-process access expectations

### 12.1 What the design assumes

**Proposed.** The design targets **single-writer, multi-reader** as the primary mode, and **multi-writer with store-enforced serialization** as the secondary mode. It does **not** target a distributed consensus model.

| Mode | Supported? | Mechanism |
|---|---|---|
| One process, one store | **Yes.** The baseline. | Everything. |
| One process, multiple stores | Yes. Independent runs. | Nothing special. |
| Multiple processes, one store, one writer | Yes. | Store-level locking; readers see committed snapshots. |
| Multiple processes, one store, multiple writers | **Conditionally.** | The store serializes writes; the revision CAS and the lease fence resolve conflicts. |
| Multiple processes, one store, multiple writers, no shared filesystem | No. | — |
| Multiple hosts, one logical store | **No.** | Out of scope; would need consensus. §14. |

### 12.2 What breaks if two processes write today

**Verified.** Today two processes each hold their own `owner.registry` object, each with its own `busy` flag (`packages/core/src/registry/owner.js:21`). There is no shared state at all.

**Inferred.** The failure mode if the store is bolted on naively is a **lost update**:

```
Process A reads revision 7.
Process B reads revision 7.
A commits candidate → revision 8.
B commits candidate → the store's revision is now 8, B's expectedRevision is 7 → STALE_REVISION.
```

That is correct behaviour, provided the store checks the revision *inside* the transaction. The dangerous variant is checking *outside*:

```
B reads the revision (7) → decides to commit → A commits (8) → B commits → revision 9, A's write lost.
```

**Proposed.** This is the single most important implementation detail of the whole block: **the revision check happens inside the transaction, against the bytes the store is about to write over.** Not before it, not after it.

### 12.3 The contention failure mode

**Verified.** `packages/core/src/registry/owner.js:23` throws `REENTRANT_MUTATION` when `transact` is called reentrantly on one owner.

**Inferred.** Across processes the analogous failure is a **lock timeout** or a **write conflict**. The design must define what happens:

| Situation | Behaviour |
|---|---|
| A store-level lock cannot be acquired within the timeout | `STORAGE_UNAVAILABLE`; the caller retries. |
| The revision CAS fails because another process committed first | `STALE_REVISION`; the caller re-reads and re-plans. |
| A lease is held by another process | `LEASE_LOST`; the caller does not retry the task. |

**Proposed.** `STORAGE_UNAVAILABLE` must be **retryable** and must never be confused with `STALE_REVISION`. A caller that treats a busy store as a stale revision will re-plan rather than wait, turning transient contention into duplicated work. The error vocabulary must keep these apart, which is why §2.4 lists them separately.

### 12.4 Reader isolation

**Proposed.** A reader must never observe a partially-applied commit.

| Option | Mechanism | Cost |
|---|---|---|
| **R-A** | Single-row state, replaced wholesale per commit. A reader reads one row. | The state row grows with the run; every commit rewrites it. |
| **R-B** | Normalised tables (one row per task, per artifact, …) updated per commit. A reader reads a consistent snapshot via a read transaction. | More complex; the atomic unit spans many rows. |

**Inferred.** R-A is right for this block, for three reasons.

1. It matches the current atomic unit exactly (§1.1): the whole registry is swapped in one step, so a whole-state row is a faithful representation.
2. `CONTRACT_LIMITS` (`packages/core/src/contracts/sigils.js:4`) caps a registry at 1 MiB and 16 384 nodes. Rewriting ≤1 MiB per commit is acceptable at the current scale.
3. R-B would require re-implementing the "candidate registry" as a set of row diffs, reintroducing exactly the partial-write hazard the design is trying to eliminate.

**Proposed.** The cost of R-A is stated honestly: write amplification is O(run size) per commit, not O(change). For a long run with thousands of commits this becomes the dominant cost. §16, D5 asks the maintainer whether that is acceptable for the first durable block.

**Inferred.** R-A's write amplification applies to the *state* row only. The journal is append-only (§5.3, R1/R2), so each commit appends only the new entries. The expensive part of a long run is the state row, not the journal.

---

## 13. SQLite-backed adapter as the first candidate

### 13.1 The four candidates compared

**Proposed.** This is a trade-off presentation, not a decision (§16, D1).

| Criterion | **JSON file + atomic rename** | **SQLite (embedded)** | **LMDB-style embedded KV** | **Client/server SQL** |
|---|---|---|---|---|
| Atomic multi-unit write | **Only if the journal is inside the same blob.** Two files = two writes = torn state (§5.4). | **Yes.** `BEGIN IMMEDIATE` … `COMMIT` (§4.3, measured). | Yes (single write transaction). | Yes. |
| Crash safety | `rename(2)` is atomic on POSIX; `fsync` of file and directory is required for power-loss safety. | Depends on `journal_mode` and `synchronous`. WAL + `FULL` is durable against power loss. | Depends on the library's sync discipline. | Server-dependent. |
| Concurrent writers | None. Last writer wins; needs an external lock file. | Yes. `BEGIN IMMEDIATE` serialises writers; `busy_timeout` handles contention. | Yes. One writer at a time. | Yes. |
| Concurrent readers | Yes, but they see whichever rename landed last. | Yes. WAL readers do not block the writer. | Yes. | Yes. |
| Store-allocated fencing tokens | Possible (a counter in the blob) but needs its own locking. | Yes — a sequence column, allocated in the transaction. | Yes. | Yes. |
| Queryability of evidence | Poor — requires re-parsing the blob. | Good — SQL over an `evidence` table. | Poor. | Good. |
| Dependency cost | **Zero.** | Zero *if* a runtime built-in is used (§13.2). | **A native dependency** (`lmdb`, `lmdb-store`, …). | **A server + a driver.** |
| Platform support | Universal. | Requires a runtime with a SQLite binding (§13.2). | Native builds per platform. | Requires a server. |
| Operational burden | None. | One file (+ WAL files). | One directory. | A service. |
| Failure modes to handle | Rename not durable; partial file on disk-full. | `SQLITE_BUSY`, `SQLITE_CORRUPT`, `SQLITE_FULL`. | Native crashes, platform-specific. | Network partitions, server outages. |

### 13.2 Runtime availability — measured, not assumed

**Verified** (measured in this environment, Node `v24.18.1`, Bun `1.3.14`):

| Runtime | `node:sqlite` | `bun:sqlite` |
|---|---|---|
| Node v24.18.1 | **Works.** Exports `DatabaseSync`, `StatementSync`, `backup`, `constants`. | **Fails.** `Received protocol 'bun:'` — Node's ESM loader rejects the scheme. |
| Bun 1.3.14 | **Fails.** `No such built-in module: node:sqlite`. | **Works.** Exports `Database`, `Statement`, `SQLiteError`, `constants`. |

**Inferred.** Neither runtime implements the other's module name. An adapter that hard-codes one specifier works on exactly one runtime, so the adapter must **probe** at runtime.

**Verified** (measured). A dynamic import with a **non-literal** specifier works in both runtimes and resolves to the right module:

```js
const spec = ["node", "sqlite"].join(":");   // "node:sqlite"
const mod = await import(spec);
```

**Verified.** The two APIs are close enough to normalise behind one thin layer. Both expose `exec`, `prepare`, and statements with `run` / `get` / `all`. Differences: Node's class is `DatabaseSync`, Bun's is `Database`; Node's statement is `StatementSync`, Bun's is `Statement`. Both support `PRAGMA journal_mode=WAL`, `PRAGMA synchronous=FULL`, `PRAGMA busy_timeout`, `BEGIN IMMEDIATE`, `COMMIT` and `ROLLBACK` — **verified by measurement in both runtimes**.

**Verified.** The test suite runs under Bun (`packages/core/package.json` `test` script is `bun test`). The adapter's own tests therefore run under Bun and must use `bun:sqlite` there, while the SDK may also be used under Node.

### 13.3 The dependency-policy collision — a real constraint

**Verified.** `packages/core/tests/architecture-integrity.test.js:8` asserts that the package's dependencies are exactly SigilJS and nothing else. `:12-13` allows import literals starting with `.`, `node:`, or the SigilJS package name.

**Inferred.** Three consequences:

1. `better-sqlite3` is **ruled out** without changing the architecture test. It would be a native dependency requiring per-platform builds — a poor trade for an embedded store.
2. A **literal** `import "bun:sqlite"` would **fail** the architecture test, because the literal starts with neither `.`, `node:`, nor the SigilJS name.
3. A **non-literal** dynamic import is invisible to the test's regex, and therefore passes.

**Proposed.** Point 3 is a loophole, and the design should not simply walk through it. The honest resolution has two parts:

| Part | Action |
|---|---|
| **1** | The adapter loads SQLite through a **runtime capability probe** with a non-literal specifier, because the specifier genuinely depends on the runtime and therefore *cannot* be a literal. This is the only correct implementation, not an evasion. |
| **2** | **Extend the architecture test** so the loophole is closed deliberately: allow the documented `bun:` prefix for an explicit allowlist of runtime built-ins, and add a test asserting the adapter's dynamic import resolves *only* to `node:sqlite` or `bun:sqlite` — checking the actually-resolved module at runtime rather than the source text. |

**Inferred.** Part 2 is strictly better than the status quo. The current test's blind spot — a dynamic import with a computed specifier is not matched by the regex — is a genuine hole that exists today; the SQLite adapter would be the first code to walk through it. Closing it as part of this block is much cheaper than closing it after it has been depended upon.

**Proposed.** If the maintainer prefers not to touch the architecture test, the alternative is a **separate package** (`packages/storage`) whose own architecture test can permit the `bun:` prefix — keeping `packages/core` untouched but adding a workspace package (§16, D2).

### 13.4 The adapter's responsibilities

**Proposed.** The SQLite adapter must:

| # | Responsibility | Detail |
|---|---|---|
| 1 | Own the schema DDL and the `storage_version` header. | One `CREATE TABLE IF NOT EXISTS` set, applied at `open()`. |
| 2 | Implement the §2.3 procedure exactly, in one transaction. | `BEGIN IMMEDIATE` … `COMMIT`. |
| 3 | Allocate journal ordinals densely from the stored maximum. | Explicit ordinal on insert, or `AUTOINCREMENT` with a gap check. |
| 4 | Allocate fencing tokens per task from a stored counter. | A `lease` row per task, or a `counters` table. |
| 5 | Never issue `UPDATE` or `DELETE` against the journal table. | §5.3 R2. Testable by inspecting the statements it runs. |
| 6 | Set `PRAGMA journal_mode=WAL`, `PRAGMA synchronous=FULL`, `PRAGMA busy_timeout`. | §4.3 CS2. |
| 7 | Perform the L5 verification on load. | §6.2 step 6. |
| 8 | Normalise the Node/Bun API differences behind one internal interface. | §13.2. |

**Proposed.** The store's schema, in outline:

```
meta(key TEXT PRIMARY KEY, value TEXT)         -- storage_version, schema_version, logical_now, run_id
state(id INTEGER PRIMARY KEY CHECK (id = 1), run_id TEXT, revision INTEGER, payload TEXT)
journal(ordinal INTEGER PRIMARY KEY, event_id TEXT UNIQUE, run_revision INTEGER, payload TEXT)
evidence(id INTEGER PRIMARY KEY, kind TEXT, operation_id TEXT, attempt_id TEXT, task_id TEXT, payload TEXT)
leases(task_id TEXT PRIMARY KEY, attempt_id TEXT, holder_id TEXT, token INTEGER, granted_at INTEGER, expires_at INTEGER)
effect_acks(attempt_id TEXT PRIMARY KEY, operation_id TEXT, task_id TEXT, state TEXT, payload TEXT)
counters(name TEXT PRIMARY KEY, value INTEGER)  -- lease token counters
```

**Inferred.** `event_id TEXT UNIQUE` gives a second, independent defence against a duplicated journal entry: the store's constraint mirrors the reducer's own duplicate check at `packages/core/src/platform/trace-reducer.js:14`.

### 13.5 The trade-off, stated plainly

**Proposed.** SQLite is the recommended first candidate because it is the only option that provides a genuine multi-table atomic transaction with **zero third-party dependencies** in both supported runtimes, and because the alternative with the same transactional properties (an embedded KV) requires a native dependency the architecture test forbids.

**Inferred.** The costs are real and must not be hidden:

- The runtime split (`node:sqlite` vs `bun:sqlite`) forces a non-literal dynamic import and a test change (§13.3).
- SQLite's durability depends on three pragmas that must be set correctly; getting them wrong is silent and catastrophic.
- Write amplification from the single-row state (§12.4).
- `SQLITE_BUSY` under contention needs an explicit retry policy.
- The relative maturity of `bun:sqlite` and `node:sqlite` was not established by local API probes. **Compatibility and durability require independent validation; no comparative maturity claim is made** (§16, D3).

---

## 14. Guarantees a storage adapter cannot establish

**Proposed.** This section exists because most "durable coordination" designs fail by promising things no store can deliver. Chord will not make these promises.

| # | Guarantee | Why it is impossible | What Chord does instead |
|---|---|---|---|
| **G1** | **Exactly-once external effects.** | The adapter's call and the store's write are two different systems. A crash between them leaves no evidence either way (§9.1). | At-most-once dispatch per attempt, plus an idempotency key (§9.4), plus explicit reconciliation for the ambiguous case (§9.5). |
| **G2** | **Verification of unknown outcomes.** | Only the external system knows what it did. | Chord detects the unknown and requires external evidence plus a human principal (`packages/core/src/platform/reconciliation.js:35-40`). |
| **G3** | **Meaningful approvals.** | An approval is a durable record of a human decision (`packages/core/src/contracts/sigils.js:129` requires a human approver). It is not proof that the approved effect is the one that happens. | The approval binds to an `attempt_id` (`packages/core/src/platform/authorization.js:132,152-153`), so a different attempt cannot use it. |
| **G4** | **Sandboxing of hostile adapters.** | An adapter runs in the host process. A malicious adapter can do anything the process can do. | Adapters are trusted code. The kernel limits what it can be *tricked* into (`packages/core/src/execution/task-packets.js:65` freezes the packet; `:70` converts any throw into `ADAPTER_ERROR`), not what it can be *attacked* with. |
| **G5** | **Protection against a malicious trusted host.** | The host owns the clock (`packages/core/src/sdk/chord.js#hostNow`) and can call `install` (`packages/core/src/registry/owner.js:43`). | `install` is validated: journal immutability (`packages/core/src/registry/owner.js:49`), revision increment (`:50`), canonical transitions (`packages/core/src/registry/registry.js:43`). The host can still commit *legal but unwise* changes. |
| **G6** | **Distributed consensus.** | A file-backed store is one node. Two hosts on different filesystems do not share a log. | Single-node durability. Multi-host is out of scope. |
| **G7** | **Exactly-once *within* the store under arbitrary crashes.** | A store can be atomic, but only if the underlying medium is. `fsync` discipline is the platform's job. | The store reports `ok` only after commit; provider guarantees are stated per-provider (§13.1). |
| **G8** | **Prevention of all duplicate external effects.** | Two processes may both believe they hold the task if the lease is expired and the store's token check is not atomic with the grant. | The token check is inside the transaction (§7.4), so grant and check cannot interleave. Effects can still duplicate if the *external system* ignores the idempotency key. |
| **G9** | **Rollback of external effects.** | Chord did not perform them. | `authorized_compensated` reconciliation with a `compensation_receipt` (`packages/core/src/platform/reconciliation.js:39`) — a *new* effect, deliberately authorised. |
| **G10** | **Proof that a message was delivered.** | Delivery is the transport's property. | Chord commits what the adapter reported, with the adapter's own receipt as the reference. |

**Inferred.** The one-line summary: **a storage adapter can make Chord's *internal* state durable, consistent, and recoverable. It cannot make Chord's *external* effects exactly-once, verifiable, or reversible.** Every guarantee in §8, §9 and §13 is bounded by that sentence.

---

## 15. Bounded scope for Block 051

### 15.1 Proposed module layout

**Proposed.**

```
packages/core/src/storage/contract.js          pure: precondition evaluator, error codes, JSDoc types
packages/core/src/storage/memory.js             in-memory reference adapter (current behaviour, explicit)
packages/core/src/runtime/storage/sqlite.js     SQLite adapter (the proposed default)
packages/core/src/runtime/storage/json-file.js  JSON-file adapter (fallback, if SQLite is rejected)
packages/core/src/runtime/storage/select.js     provider selection from host options
packages/core/src/runtime/recovery.js           startup recovery procedure (§6.2)
```

**Inferred.** The split is deliberate. `src/storage/contract.js` is **pure** and joins the core: it holds no I/O, so it can be tested exhaustively and used by the reducer path. `src/runtime/storage/*` is the **shell**: it performs I/O and calls the pure evaluator inside its transaction. `src/runtime/recovery.js` sits in the shell because it performs I/O, but it must be *effect-free* in the sense of §6.3 — it must not import `adapter-routing`.

### 15.2 Proposed kernel changes (described, not applied)

**Proposed.** These are the changes Block 051 would make to existing files, listed so the reviewer can see the blast radius.

| File | Change | Contract impact |
|---|---|---|
| `packages/core/src/registry/owner.js` | `transact` and `install` write through the store instead of swapping an object reference. The in-memory registry becomes a cache of the last committed state. | None |
| `packages/core/src/registry/registry.js` | `commitRun` becomes a **pure** precondition evaluation over `(stored, candidate, operation)`, callable by the adapter inside its transaction. The swap moves to the adapter. | None |
| `packages/core/src/platform/event-journal.js` | `appendRegistryEvent` accepts `meta.at` for a deterministic clock (§11.7). | None |
| `packages/core/src/platform/runtime-loop.js` | The context gains `idempotency_key` (§9.4) and `lease_token` (§7.6); the runtime writes the staged effect ack (§8.4). | None — the context is not a contract |
| `packages/core/src/sdk/chord.js` | Stable `module#symbol` references in the body; search named functions/members | None |
| `packages/core/src/utils/id.js` | `stableId` gains an injectable variant. | None |
| `packages/core/tests/architecture-integrity.test.js` | Allow the documented `bun:` runtime built-ins; add a runtime-resolved import test (§13.3). | None |

**Inferred.** **No contract changes.** `SCHEMA_VERSION` stays `"chord.contracts.v1"` (`packages/core/src/contracts/sigils.js:3`). This keeps §10's migration apparatus dormant for this block and keeps the diff reviewable.

### 15.3 Proposed test list

**Proposed.** Block 051 should ship with tests that prove the properties this document claims, not just that the code runs.

| Area | Tests |
|---|---|
| Atomicity | A commit that throws mid-transaction leaves **zero** state rows and **zero** journal rows. A commit writes state + journal + evidence + lease **together** — kill the process between any two of them and assert all four are present or none are. A commit that reports `ok` is present after reopening the store. |
| Preconditions | Each of P1–P17 fails when it should, with the right error code. The evaluator is a pure function (same inputs, same output, no I/O). A candidate whose journal prefix differs is rejected with `INVALID_HISTORY`. A candidate whose recorded delta does not match the re-derived delta is rejected (P17). |
| Journal | Ordinals are dense and monotone across a hundred commits. Two events written in the same millisecond keep insertion order through a store round-trip. The reducer applied to the stored journal reproduces the stored state exactly (L5). |
| Recovery | A store killed at each of W1–W4 (§8.1) recovers to a state consistent with the durable records. Recovery never invokes an adapter (assert none was resolved). An expired lease marks the task uncertain via the existing `markTaskUncertain` path; a *live* lease leaves the task alone. A corrupt store fails closed and does not start a run. |
| Leases / fencing | A stale writer presenting an old token is rejected with `FENCE_LOST`. A second writer cannot take a live lease. An expired lease can be taken and the new token is strictly greater. Two processes racing for one task produce exactly one winner. |
| Clock and ids | A commit with an injected clock produces byte-identical bytes across two runs. The persisted logical floor survives a restart and prevents a backwards clock from throwing `INVALID_CONTEXT` (`packages/core/src/sdk/chord.js#hostNow`). |
| Compatibility | A store with a newer `storage_version` fails closed with `UNSUPPORTED_STORAGE_VERSION`. A store with a different `schema_version` fails closed with `SCHEMA_MISMATCH`. A migration from the previous `storage_version` preserves the journal's meaning and passes L5 afterwards. |

**Inferred.** The byte-identical commit test is the one that will catch the most integration bugs, because it forces every timestamp and id in the unit to be deterministic. It is worth writing first.

### 15.4 Explicit non-goals for Block 051

**Proposed.** Block 051 does **not**: change `SCHEMA_VERSION` or any contract; implement journal compaction or snapshot-and-anchor replay (§5.3 R5); support multi-host / distributed consensus (§14 G6); guarantee exactly-once external effects (§14 G1); change the reconciliation policy (§9.5); make `importRegistry` the recovery path (§6.5); add a native dependency (§13.3); provide a UI, CLI, or migration tooling beyond what the store needs.

---

## 16. Decisions required from the maintainer

**Proposed.** Six decisions. Each has a recommendation and a cost, and none should be made implicitly by an implementer.

| ID | Decision | Options | Recommendation | Cost of the alternative |
|---|---|---|---|---|
| **D1** | Which storage provider? | SQLite / JSON file / embedded KV / client-server SQL | **SQLite** (§13.5): real multi-table transactions, zero third-party dependencies, queryable evidence. | JSON file forces the journal into the same blob and gives no queryable evidence. Embedded KV needs a forbidden native dependency. Client-server SQL needs a server. |
| **D2** | How to satisfy the dependency policy for `bun:sqlite`? | (a) Extend the architecture test with an explicit `bun:` allowlist and add a runtime-resolved import test; (b) put the adapter in a new `packages/storage`; (c) use `node:sqlite` only and drop Bun support for the adapter. | **(a)** — it closes the existing regex blind spot deliberately rather than relying on it. | (b) adds a workspace package for one adapter. (c) breaks the Bun-first test story and the SDK's Node/Bun duality. |
| **D3** | Accept `bun:sqlite` maturity? | Accept / pin Node-only / wait | **Accept**, but run the adapter's test suite under **both** runtimes so the divergence is caught. | A Node-only pin means the adapter is unavailable under Bun, and Bun is the primary runtime (`packages/core/package.json` `test` script). |
| **D4** | `synchronous` level? | `FULL` (durable against power loss) / `NORMAL` (durable against process crash only) / `EXTRA` | **`FULL`**, matching §4.3 CS2. `NORMAL` is a legitimate performance choice and must be an explicit decision, not a default. | `NORMAL` risks losing the last commits on power loss — a silent failure. |
| **D5** | Accept O(run size) write amplification? | Accept / normalise the schema into many tables now | **Accept** for the first durable block, and record the cost. | Normalising now multiplies the implementation surface and the risk of a partial-write bug, before the store has ever proven itself. |
| **D6** | Automatic or host-driven recovery? | Recover automatically at `open()` / expose an explicit `recover()` the host calls | **Automatic at `open()`**, with the uncertainty sweep (§6.4) and fail-closed corruption handling. A host-driven mode can be added later. | Host-driven recovery means a host that forgets to call it runs against a stale in-memory state — a worse failure than a slow start. |

**Proposed.** D2, D4 and D6 change the shape of the code; D1, D3 and D5 are mostly about accepting costs that are already understood.

---

## Appendix A — Citation index

Every `file:line` used above, grouped by file. All were read directly.

| File | Lines cited | What is there |
|---|---|---|
| `packages/core/src/contracts/sigils.js` | 3, 4, 6, 129, 131, 132, 133, 157, 230, 235, 237, 238, 244, 254, 255, 256, 257, 258, 259 | `SCHEMA_VERSION`, `CONTRACT_LIMITS`, `Attempt`, `Decision`, `TaskPacket`, `StoredTask`, `QueueRecord`, `JournalRecord`, `Snapshot`, `HostCommitRequest`, `HistoryCommit`, `HistoryGenesis`, `OperationRecord`, `ReconciliationRequest`, `ReconciliationRecord` |
| `packages/core/src/registry/owner.js` | 8-9, 10, 11, 12-19, 21, 22-26, 29, 30, 31, 32-34, 35, 36, 37, 38, 40, 41, 43, 44, 45, 46, 48, 49, 50, 51, 52, 54 | The private owner, `transact`, `install`, the busy flag, the revision bump, journal stamping, the history capture |
| `packages/core/src/registry/registry.js` | 10-24, 32, 33, 35-40, 42, 43, 44, 45, 62, 73, 90, 105, 119, 133, 156, 157, 168, 171, 172, 173 | `createRegistry`, `commitRun` and its nine checks, `registerExecutionResult` and its evidence writes |
| `packages/core/src/registry/snapshot.js` | 4, 9, 10, 11-18, 22, 24, 26, 28-30, 31, 32, 33-45, 46 | `exportRegistry`, `serializeRegistry`, `importRegistry` and its quarantine |
| `packages/core/src/registry/query.js` | 1, 10, 18 | Read-only query helpers |
| `packages/core/src/platform/state-invariants.js` | 5, 6, 7, 11, 12, 13, 14, 15, 17, 25, 26 | `assertCanonicalTransition` and the immutable-task list |
| `packages/core/src/platform/history.js` | 4, 5-8, 9-14, 15-27, 28-45, 40 | `HISTORY_VERSION`, `canonicalProjection`, `sameData`, `stateChanges`, `applyChanges` |
| `packages/core/src/platform/event-journal.js` | 3-21, 5, 7, 19, 23 | `appendRegistryEvent`, `listRegistryEvents` |
| `packages/core/src/platform/attempts.js` | 8, 12, 18, 28, 38-44, 46 | `prepareAttemptRecord`, `activatePendingAttempt`, `clearActiveAttempt` |
| `packages/core/src/platform/authorization.js` | 3-8, 10, 16, 25-30, 32, 34, 37, 48-54, 59-67, 68-73, 96-104, 106-121, 123-135, 138, 139-144, 145, 146-158 | The pure evaluator and its commit-stage guards |
| `packages/core/src/platform/reconciliation.js` | 11-17, 18, 21, 22, 23, 24, 26, 29, 31, 34, 35, 39, 40, 41, 42, 46, 47-51, 52 | `operationSignature`, `admitOperation`, `reconcileTask` and its evidence rules |
| `packages/core/src/platform/recovery-policy.js` | 3-10, 12, 13-16, 17, 21, 26, 27, 28 | `EffectStates`, `isRetryEligible`, `shouldQuarantineUnknown`, `getIdempotencyKey` |
| `packages/core/src/platform/runtime-loop.js` | 13, 19, 20, 21, 25, 27, 29, 34, 38, 39, 44, 45, 48, 49, 51, 54, 55, 56, 57, 58, 59-63, 64, 65, 66, 67, 70, 72, 77, 79, 82, 83, 84, 85, 86, 89, 91, 92, 93, 94, 96, 97, 98, 100, 101, 102 | The claim → invoke → commit cycle in full |
| `packages/core/src/platform/task-queue.js` | 10, 12, 17, 27, 38-42, 44, 47, 50, 58, 72, 78, 79, 93, 107, 112, 127, 131 | Enqueue, select, lease, retry, dead-letter replay |
| `packages/core/src/platform/transitions.js` | 116, 122, 126, 128-134, 135-153, 139-142, 143, 144-145, 146-147, 148-149, 150, 151 | `markTaskUncertain` in full |
| `packages/core/src/platform/trace-reducer.js` | 7, 8-45, 9, 13, 14, 16, 18, 21, 24, 25, 26, 27, 29, 30, 31, 32, 33, 36, 37, 43, 44, 46, 47, 49 | `reduceTrace`, `replayNoSideEffects`, `diffTraces` |
| `packages/core/src/platform/journal-audit.js` | 1, 4, 7, 15, 19, 23 | The audit projection and its clock seam |
| `packages/core/src/execution/task-packets.js` | 8, 38, 62, 65, 66, 67-72, 70 | `prepareTaskExecution`, the frozen packet and context |
| `packages/core/src/sdk/chord.js` | Stable `module#symbol` references in the body; search named functions/members | The host clock seam, the monotonic guard, the owner ports |
| `packages/core/src/utils/id.js` | 1-4 | `stableId` |
| `packages/core/src/runtime/adapter.js` | 1-15 | The only disk-touching module today |
| `packages/core/src/index.js` | 1-6 | The package's export surface |
| `packages/core/tests/architecture-integrity.test.js` | 8, 12-13 | The dependency policy and the import-literal allowlist |

## Appendix B — Measurements performed for this design

**Verified** (all run in this environment; Node `v24.18.1`, Bun `1.3.14`):

| # | Measurement | Result |
|---|---|---|
| M1 | `node:sqlite` under Node | Loads; exports `DatabaseSync`, `StatementSync`, `backup`, `constants`. |
| M2 | `node:sqlite` under Bun | `No such built-in module: node:sqlite`. |
| M3 | `bun:sqlite` under Bun | Loads; exports `Database`, `Statement`, `SQLiteError`, `constants`. |
| M4 | `bun:sqlite` under Node | `Received protocol 'bun:'`. |
| M5 | Non-literal dynamic import of both | Resolves correctly in both runtimes. |
| M6 | `PRAGMA journal_mode=WAL` on a file, both runtimes | `wal`. |
| M7 | `BEGIN IMMEDIATE` → write state row + journal row → throw → `ROLLBACK` | 0 state rows, 0 journal rows. |
| M8 | `BEGIN IMMEDIATE` → write both → `COMMIT` | 1 state row, 1 journal row. |
| M9 | `PRAGMA synchronous=FULL`, `PRAGMA busy_timeout` | Accepted by both runtimes. |
| M10 | `exec` / `prepare` / `run` / `get` / `all` parity | Present in both. |
| M11 | `cd packages/core && bun test` | 166 pass / 0 fail, 15 files; exit 0. |
| M12 | `cd packages/core && bun run src/verify-runtime.js` | `ALL RUNTIME VALIDATIONS PASSED`; exit 0. |
| M13 | Exhaustive search for `Date.now` / `new Date(` / `Math.random` under `packages/core/src/**` | 28 wall-clock sites and 9 `stableId` call sites (§11.2, §11.3). |

**Inferred.** M7 and M8 are the measurements that make §4.3 a claim rather than a hope: the transaction really is all-or-nothing across two tables, in both runtimes, on a file.

## Appendix C — Open questions this design does not answer

**Proposed.** Recorded so a later block does not mistake them for oversights.

| # | Question | Why it is out of scope here |
|---|---|---|
| Q1 | How does a run survive a store being replaced by a different run? | The store holds one run (`run_id` stable, L6). Multi-run stores need a run-indexed namespace. |
| Q2 | How is the journal compacted without breaking the reducer? | §5.3 R5 — the reducer's contract (`packages/core/src/platform/trace-reducer.js:9`) does not accept a seeded `initialState`. |
| Q3 | What is the retention policy for evidence rows and effect acks? | Needs a policy decision about reconciliation history volume. |
| Q4 | Does the host clock need to be a monotonic *source* (a hardware counter) rather than a floor? | §11.5's floor handles restarts and backward corrections; it does not handle a forward jump. |
| Q5 | How are store-level locks surfaced to the SDK? | `STORAGE_UNAVAILABLE` is defined; the SDK's retry/backoff policy for it is not. |
| Q6 | What happens if the host supplies a store whose `run_id` differs from a loaded run? | L6 says `RUN_MISMATCH`; whether the SDK should offer "start a new run in this store" is a product decision. |
| Q7 | Should `attempt_id` remain a `stableId`, or become store-allocated? | §7.4 makes the *token* store-allocated; the id could stay as-is. Making the id itself store-allocated would simplify traceability but couples ids to the store. |


## Pass A1 clarification / supersession

All store modules, durable transactions, fencing tokens, effect acknowledgements and recovery procedures remain future work. SQLite results in Appendix B describe the original runtime versions, not an implemented durable Chord store. Missing commit acknowledgement does not prove rollback; a transaction may have fully committed. The logical-floor proposal prevents cross-restart regression; today `lastNow` resets and checks only process-local readings. Appendix A’s numeric SDK inventory is superseded by stable body refs. Current checks are in `050-citation-closeout.md`.
