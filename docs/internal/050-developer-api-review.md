# 050 — Independent Developer-Facing Public API Audit
> **A1 reading note:** original pass measurements are historical; see “Pass A1 clarification / supersession” below and `docs/internal/050-citation-closeout.md` for current verification.
Role: **api-agent** (Block 050, independent consumer review)
Scope: `@antistructured/chord@0.4.0-preview.1` — the complete public API as an independent JavaScript consumer
Status: **audit complete; three additive corrections applied under `packages/core/src/`; one new test file added**

> This report is written from the consumer's position. Every claim marked **Verified** was
> reproduced mechanically in this pass (mechanical export enumeration, runtime probes, or the
> test suite). Every claim marked **Inferred** is a reading of the source that was not
> independently reproduced. Nothing in this report restates the design intent documents as
> fact; where a document asserts something the code does not enforce, that gap is the finding.

---

## 0. Scope, method, and evidence base

### 0.1 What was reviewed

| Item | Value |
|---|---|
| Package | `@antistructured/chord` |
| Version | `0.4.0-preview.1` (`packages/core/package.json:3`) |
| Module system | ESM only (`packages/core/package.json:5` — `"type": "module"`) |
| Entry points | `.` → `src/index.js`, `./sdk` → `src/sdk/index.js`, `./platform` → `src/platform/index.js` (`packages/core/package.json:6-10`) |
| Runtime dependency | `@weipertda/sigiljs@0.18.0` — the only one (`packages/core/package.json:18-20`) |
| Node/Bun engine | none declared; no `engines` field, no `bun.lock` entry in the published manifest |
| Public runtime exports | 30 at `.`, 1 at `./sdk`, 22 at `./platform` |
| SDK instance members | 36 before this pass, **38 after** |

### 0.2 Method

1. **Mechanical export enumeration** — every export of every entry point was enumerated by
   runtime `import` + `Object.keys`, not by reading source. `/sdk` and `/platform` were
   enumerated through their real package specifiers and resolved against
   `packages/core/package.json` `exports`.
2. **Source read in full** — every file under `packages/core/src/`, every file under
   `packages/core/tests/`, both examples, and the internal reports 044, 047, 048 and 050.
3. **Runtime probes** — a set of throwaway scripts under `/tmp/opencode/` exercised suspected
   defects against the real package. Every probe result quoted below is reproducible.
4. **Baseline first, then diff** — `bun test` was run before any edit (160 pass / 0 fail) and
   after every edit.
5. **No authority was weakened** — no guard was removed, relaxed or bypassed; no contract was
   loosened; no package manifest was touched.

### 0.3 Explicit non-goals

- No dependency, version, packaging, license or release change.
- No change to `packages/core/package.json`, `packages/core/bun.lock`, or any existing test file.
- No modification of `docs/internal/04*` (so the 047 evidence snapshot is left stale by design —
  see §9.4).
- No commit, push, tag, publish, branch, stash, reset or any other history-mutating Git action.

---

## 1. Executive summary

The package is **small, well-factored and unusually honest about its limits**, but it is not
what its marketing surface implies: it is **a single-process, in-memory, trusted-host
orchestration kernel**, not a governance service, not an actor-facing API, and not a durable
ledger. The safety properties that *are* implemented (authority re-evaluation at three stages,
fail-closed admission, exact-history replay, quarantine of unknown effects) are real and are
well tested. The properties that are *not* implemented are exactly the ones a consumer is most
likely to assume are implemented.

Five root findings dominate:

1. **The trusted-host boundary is documentation, not enforcement.** Every authority-creating
   operation (`setAuthoritySnapshot`, `commitRun`, `queueTaskPackets(...issueGrants)`) is
   reachable on the object returned by `createChord()`. There is no capability token, no
   restricted handle, and no runtime check that separates "host" from "actor" (§2).
2. **`commitRun` is a full-authority compare-and-swap that bypasses admission.** It can install
   grants that were never issued, add tasks that never passed admission, and rewind the
   authority revision — all verified by execution (§3.4).
3. **Half the public export surface is a raw, unguarded, thinly-tested data API.** The root mixes pure functions, inspection helpers and raw mutators of caller-owned registries; raw mutations do not update an SDK’s private owner (§4). Test-name coverage is distinct from mutation/authority behavior (see the A1 addendum).
4. **The observable error vocabulary is 36 codes spread over three disjoint, unexported
   lists**, and the single most-used result method reports failure reasons under three different
   field names (§5).
5. **The two-actor workflow requires the consumer to hand-construct six contract shapes**,
   two of which are deep (`Grant.scope`, a 15-field `Approval`), with no public constructor,
   validator or vocabulary — §6 measured this as the dominant setup cost (§7).

Three corrections were applied, all **purely additive**, all covered by one new test file
(`packages/core/tests/developer-api-review.test.js`, 6 tests). No existing behaviour changed for
existing callers; the root export list and the package `exports` map are unchanged.

**Gate: PASS for the documented trusted-host, single-process, in-memory preview scope.**
**Not a pass for any actor-facing, multi-process, durable or adversarial-plugin use case** —
those are out of scope by the project's own documents and this audit does not extend them.

---

## 2. The public API, exhaustively

### 2.1 Entry-point topology

```
@antistructured/chord          → packages/core/src/index.js      (30 exports)
  ├── export * from "./sdk/index.js"        → src/sdk/chord.js
  ├── export * from "./platform/index.js"   → 7 platform modules + 2 named re-exports
  ├── export * from "./registry/query.js"   → 3 query functions
  ├── export * from "./registry/snapshot.js"→ export/import/serialize
  ├── export * from "./types/index.js"      → 0 runtime exports (JSDoc only)
  └── export { SCHEMA_VERSION } from "./contracts/sigils.js"

@antistructured/chord/sdk      → packages/core/src/sdk/index.js      (1 export: createChord)
@antistructured/chord/platform → packages/core/src/platform/index.js (22 exports)
```

Source-path convention: abbreviated `src/`, `tests/`, `examples/` and bare module names in this report are relative to `packages/core/`; new A1 symbol references are repository-relative and mean “search this named function/member”, not a generated HTML anchor. Source: `packages/core/src/index.js:1-6`, `packages/core/src/sdk/index.js:1`,
`packages/core/src/platform/index.js:1-8`.

### 2.2 Root export table — all 30 symbols

`Kind`: `fn` = function, `const` = value.
`Authority class` is this audit's classification, aligned with 047's classification
(`docs/internal/047-public-api-compatibility.md:7-11`).

| # | Export | Kind | Purpose | Authority class | Directly referenced by a test? |
|---|---|---|---|---|---|
| 1 | `SCHEMA_VERSION` | const | `"chord.contracts.v1"` — the contract-schema version a consumer can compare against | public | yes (7 files) |
| 2 | `appendRegistryEvent` | fn | Append one journal event to a **plain registry object** | trusted-host low-level | `fault-injection` |
| 3 | `canonicalProjection` | fn | Strip `event_journal` from a registry for state comparison | public, pure | **no** (indirect only) |
| 4 | `computeBackoffDelayMs` | fn | Retry backoff from a runtime policy | public, pure | **no** (indirect only) |
| 5 | `createAdapterRouter` | fn | Build the exact/prefix/fallback adapter router | trusted-host low-level | **no** (indirect only) |
| 6 | `createChord` | fn | **The entry point.** Build a run-scoped SDK instance | public | yes (13 files) |
| 7 | `createDeterministicAuditReport` | fn | Whole-run audit report | trusted-host inspection | `developer-api-review` (new) |
| 8 | `createRuntimePolicy` | fn | Validate/normalize the runtime policy | trusted-host low-level | `contracts` |
| 9 | `createTaskQueue` | fn | Empty queue array factory | trusted-host low-level | **no** (indirect only) |
| 10 | `dequeueReadyTask` | fn | Lease-then-pop one ready queue entry on a plain registry | trusted-host low-level | `hardening` |
| 11 | `diffTraces` | fn | Ordered content diff of two event lists | public, pure | `fault-injection`, `replay-integrity` |
| 12 | `enqueueTask` | fn | Push a queue entry onto a plain registry | trusted-host low-level | `adversarial`, `transitions`, `contracts` |
| 13 | `exportRegistry` | fn | Snapshot the registry (includes the full authority snapshot) | trusted-host inspection | `integrity`, `transitions`, `contracts`, `replay-integrity`, `admission-integrity` |
| 14 | `importRegistry` | fn | Restore a snapshot; quarantines in-flight work | trusted-host administration | `contracts`, `replay-integrity` |
| 15 | `leaseTaskEntry` | fn | Mark one queue entry leased | trusted-host low-level | **no** (indirect only) |
| 16 | `listDeadLetterTasks` | fn | Queue entries whose status is `dead_letter` | trusted-host inspection | **no** (indirect via `queryDeadLetters`) |
| 17 | `listQueuedTasks` | fn | Queue entries filtered by status/priority | trusted-host inspection | **no** (indirect via `queryQueue`) |
| 18 | `listRegistryEvents` | fn | Journal events with optional filters | trusted-host inspection | **no** (indirect via `inspectEvents`) |
| 19 | `markQueueEntryStatus` | fn | Set one queue entry's status | trusted-host low-level | **no** (indirect only) |
| 20 | `queryArtifacts` | fn | Artifact records by name/project/phase/status | trusted-host inspection | **no — and never called at all** |
| 21 | `queryDomains` | fn | Domain records by name/project/phase/state | trusted-host inspection | **no — and never called at all** |
| 22 | `reduceTrace` | fn | Reconstruct state from a journal | public, pure | `fault-injection`, `replay-integrity` |
| 23 | `replayDeadLetterTask` | fn | Re-queue a dead-lettered task on a plain registry | trusted-host low-level | **no — zero callers anywhere** |
| 24 | `replayNoSideEffects` | fn | Replay a journal without invoking any adapter | public, pure | `fault-injection`, `replay-integrity` |
| 25 | `replayRegistryJournal` | fn | Diagnostic projection of the journal | trusted-host inspection | **no** (indirect via `replayJournal`) |
| 26 | `resolveAdapter` | fn | Exact → prefix → fallback adapter lookup | trusted-host low-level | **no** (indirect only) |
| 27 | `runRuntimeCycle` | fn | One runtime cycle against an owner **or a plain registry** | trusted-host low-level | **no** (indirect via `runCycle`) |
| 28 | `scheduleTaskRetry` | fn | Backoff + requeue a task | trusted-host low-level | **no** (indirect only) |
| 29 | `selectReadyTask` | fn | Pick the next runnable queue entry | trusted-host low-level | **no** (indirect only) |
| 30 | `serializeRegistry` | fn | JSON snapshot string | trusted-host inspection | **no — and never called at all** |

**Coverage summary (Verified):** 18 of 30 root exports are not named in any test file. Of those,
12 are exercised only indirectly through an SDK wrapper. Six are effectively dark:
`queryArtifacts`, `queryDomains`, `serializeRegistry`, `replayDeadLetterTask`,
`replayRegistryJournal` (via `chord.replayJournal`), and `chord.setRuntimePolicy`.

### 2.3 `/platform` export table — all 22 symbols

All 22 are re-exported at the root. The `/platform` subpath exists so a consumer can import
the data layer without the SDK; it is **not** a reduced-trust surface — it is the same
unguarded data API, just importable separately.

| Export | Source | Direct test reference |
|---|---|---|
| `appendRegistryEvent` | `src/platform/event-journal.js` | `fault-injection` |
| `canonicalProjection` | `src/platform/history.js` | no |
| `computeBackoffDelayMs` | `src/platform/policy.js` | no |
| `createAdapterRouter` | `src/platform/adapter-routing.js` | no |
| `createDeterministicAuditReport` | `src/platform/journal-audit.js` | `developer-api-review` |
| `createRuntimePolicy` | `src/platform/policy.js` | `contracts` |
| `createTaskQueue` | `src/platform/task-queue.js` | no |
| `dequeueReadyTask` | `src/platform/task-queue.js` | `hardening` |
| `diffTraces` | `src/platform/trace-reducer.js` | `fault-injection`, `replay-integrity` |
| `enqueueTask` | `src/platform/task-queue.js` | `adversarial`, `transitions`, `contracts` |
| `leaseTaskEntry` | `src/platform/task-queue.js` | no |
| `listQueuedTasks` | `src/platform/task-queue.js` | no |
| `listRegistryEvents` | `src/platform/event-journal.js` | no |
| `markQueueEntryStatus` | `src/platform/task-queue.js` | no |
| `reduceTrace` | `src/platform/trace-reducer.js` | `fault-injection`, `replay-integrity` |
| `replayDeadLetterTask` | `src/platform/task-queue.js` | no |
| `replayNoSideEffects` | `src/platform/trace-reducer.js` | `fault-injection`, `replay-integrity` |
| `replayRegistryJournal` | `src/platform/journal-audit.js` | no |
| `resolveAdapter` | `src/platform/adapter-routing.js` | no |
| `runRuntimeCycle` | `src/platform/runtime-loop.js` | no |
| `scheduleTaskRetry` | `src/platform/task-queue.js` | no |
| `selectReadyTask` | `src/platform/task-queue.js` | no |

### 2.4 SDK instance surface — all 38 members

`createChord()` returns a **single object that mixes four different privilege levels**. This
mixing is the central usability and safety finding of this audit (§3.6).

| # | Member | Privilege | Purpose | Directly tested? |
|---|---|---|---|---|
| 1 | `registry` (getter) | read | Detached deep clone of the whole registry | yes |
| 2 | `getRegistry()` | read | Detached deep clone (duplicate of #1) | yes |
| 3 | `getAuthority()` | read | Detached clone of the authority snapshot; `null` before install | yes |
| 4 | `getRunState()` | read | Run state string, or `"unknown"` | yes |
| 5 | `getRunRevision()` | read | Current run revision | yes |
| 6 | `parseText(text)` | read | Parse a line-oriented spec into a validated spec | yes |
| 7 | `registerSpec(spec)` | **write** | Register a spec; returns `{registry, spec}` | yes |
| 8 | `registerSpecAndQueue(spec, opts)` | **write** | Register + admit + enqueue in one transaction | yes |
| 9 | `createTaskPackets(spec)` | read | Spec → task packets (`[]` for `CoordSpec`) | yes |
| 10 | `queueTaskPackets(packets, opts)` | **write** | Admit + enqueue packets | yes |
| 11 | `setAuthoritySnapshot(snapshot, opts)` | **write, authority** | Install the entire authority snapshot | yes |
| 12 | `prepareAttempt(taskId)` | **write** | Reserve a pending attempt — **mutates despite reading like a query** | yes |
| 13 | `cancelTask(taskId, opts)` | **write** | Cancel one task | yes |
| 14 | `commitRun(args)` | **write, authority** | Whole-run host CAS | yes |
| 15 | `createTaskGrant(packet, opts)` | read | **New in this pass.** Shape a contract-valid grant | `developer-api-review` |
| 16 | `createApproval(opts)` | read | **New in this pass.** Shape a contract-valid approval | `developer-api-review` |
| 17 | `projectContext(opts)` | read | Scoped, grant-filtered projection for one actor | yes |
| 18 | `proposeHandoff(opts)` | **write** | Propose an actor-to-actor handoff | yes |
| 19 | `respondToHandoff(opts)` | **write** | Accept/reject a handoff | yes |
| 20 | `pauseForApproval(opts)` | **write** | Suspend the run | yes |
| 21 | `resumeRun(opts)` | **write, authority** | Resume, requiring an attested human principal | yes |
| 22 | `rejectApproval(opts)` | **write** | Fail the run | yes |
| 23 | `cancelRun(opts)` | **write** | Cancel the run and all work | yes |
| 24 | `runCycle()` | **write + effect** | One dispatch cycle; **invokes the adapter** | yes |
| 25 | `setAdapterRouter(value)` | **write** | Replace the adapter router | yes |
| 26 | `setRuntimePolicy(value)` | **write** | Replace the runtime policy | **no** |
| 27 | `queryArtifacts(criteria)` | read | Artifact records | **no** |
| 28 | `queryDomains(criteria)` | read | Domain records | **no** |
| 29 | `queryQueue(criteria)` | read | Queue entries | yes |
| 30 | `queryDeadLetters()` | read | Dead-lettered queue entries | yes |
| 31 | `reconcileTask(request)` | **write, authority** | Attest an unknown effect | yes |
| 32 | `replayTask(id, opts)` | **write** | Fresh admission of quarantined work | yes |
| 33 | `replayJournal(opts)` | read | Diagnostic journal projection | **no** |
| 34 | `inspectAudit(opts)` | read | Whole-run audit report | yes |
| 35 | `inspectEvents(opts)` | read | Full journal records with filters | yes |
| 36 | `exportRegistry()` | read | Snapshot (includes the authority snapshot) | yes |
| 37 | `serializeRegistry()` | read | JSON snapshot string | **no** |
| 38 | `_invalidatePendingAttempt(id)` | **write, internal** | **Underscore-prefixed internal escape hatch on the public object** | **no** |

### 2.5 Internal-but-shipped surface

`packages/core/package.json:30-41` ships `src/**/*.js` (minus `src/verify-runtime.js`) in the
tarball, but the `exports` map declares exactly three subpaths. **Verified:** subpath imports of
shipped internals are blocked by the exports map — `require.resolve("@antistructured/chord/src/runtime/adapter.js")`
and `.../src/contracts/sigils.js` are rejected by the exports map (Node: `ERR_PACKAGE_PATH_NOT_EXPORTED`; Bun: `MODULE_NOT_FOUND`), while
`@antistructured/chord/package.json` is blocked under Node 24.22.1 (`ERR_PACKAGE_PATH_NOT_EXPORTED`) but resolves under Bun 1.4.3 `createRequire().resolve` (A1 recheck). So `src/runtime/adapter.js` (Bun/Node file I/O),
`src/cli/*.js` (Node `process.argv`) and `src/demo/*.js` are present in
the candidate payload but are not declared import subpaths; `src/verify-runtime.js` is explicitly excluded. This matches 047's rule that "physical tarball src presence
does not create a documented import subpath"
(`docs/internal/047-public-api-compatibility.md:10`). It is correct, and worth stating explicitly
because the tarball's contents look far larger than the importable API.

---

## 3. Authority boundaries

### 3.1 What the boundary is, precisely

The project states the boundary in three places:

- 047:8 — "authority/grant configuration … generic commitRun … **must remain host-only** … do not
  expose this SDK directly as a client endpoint."
- 047:8 — "projectContext is the scoped view, **not an authentication service**."
- 048:21 — "Host administration remains distinguished from actor endpoints, **not treated as an
  untrusted-plugin sandbox**."

This audit's position: **the boundary is a documented convention enforced by the host's own
discipline, plus one genuine structural mitigation.** It is not a capability system.

**The genuine structural mitigation (Verified):** an adapter is invoked through
`prepareTaskExecution(adapter, packet, context)`
(`packages/core/src/platform/runtime-loop.js:70`) and receives only the *frozen task packet* and
a *correlation context* — `{run_id, schema_version, task_id, task_revision, queue_id, attempt_id,
lease_expires_at}` (`runtime-loop.js:67`). The adapter therefore **cannot reach the registry, the
owner, or the authority snapshot** through its arguments. An adapter cannot self-grant.

That is a real boundary, and it is the right place to draw one. It is also the **only** boundary
that exists.

### 3.2 The trusted-host seam, exactly

`packages/core/src/sdk/chord.js#hostNow` establishes the seam:

```js
// Trusted-host seam: the embedding host owns the clock and installs
// authority. JavaScript objects passed here are host-trusted arguments,
// never forwarded request data. Backward clock movement fails closed.
const trustedHost = options.trustedHost || null;
function hostNow() {
  const raw = trustedHost && typeof trustedHost.now === "function" ? trustedHost.now() : Date.now();
  if (!Number.isSafeInteger(raw) || raw < 0 || raw < lastNow) throw authorityError("INVALID_CONTEXT");
  lastNow = raw;
  return raw;
}
```

`trustedHost.now` is the **clock seam** and `trustedHost.authoritySnapshot` is the **authority
bootstrap** (`packages/core/src/sdk/chord.js#createChord`). Both are optional; both are advisory in the sense that the
consumer chooses whether to use them. **Neither is an authority boundary.**

Two consequences that a consumer will trip over:

- **The clock seam covers almost nothing.** `hostNow()` is consulted in six places
  (`packages/core/src/sdk/chord.js#hostNow`), but **twelve source files call `Date.now()`,
  `new Date()` or `Math.random()` directly**. The journal timestamp
  (`src/platform/event-journal.js:7`), task/artifact/domain history timestamps
  (`src/registry/registry.js:62, 73, 90, 105, 119, 168`), queue scheduling
  (`src/platform/task-queue.js:17, 78, 112`), handoff timestamps
  (`src/platform/handoff.js:64, 87`), approval timestamps
  (`src/platform/approval-flow.js:15, 28`), transition timestamps
  (`src/platform/transitions.js:122, 135`), the audit/snapshot wall clock
  (`src/platform/journal-audit.js:19`, `src/registry/snapshot.js:10`) and every identifier
  (`src/utils/id.js:3-4`) all bypass the seam. **A host that installs a deterministic clock does
  not get deterministic journal timestamps or deterministic identifiers.** (Verified by source
  scan; see §7.3 for the reproducibility consequence.)
- **The authority bootstrap is optional and silent.** If `trustedHost.authoritySnapshot` is
  absent, the SDK starts with `authority: null` and every admission fails closed with
  `INVALID_CONTEXT` — which is correct, but the failure is at the first `registerSpecAndQueue`,
  not at construction.

### 3.3 What an actor can actually reach

An actor in this system is a *string* (`actor_id`), not an object. The actor-facing surface is:

| Surface | Reachable by | Authority check |
|---|---|---|
| `projectContext({actor_id, principal_id})` | any caller who knows the ids | **Yes** — filters by exact active grants (`src/platform/handoff.js:16-22`) |
| Adapter `execute(packet, context)` | the runtime | **Yes** — dispatch-stage evaluation before invocation (`runtime-loop.js:49`) |
| `proposeHandoff({from_actor_id, to_actor_id, ...})` | any caller | **No** (`src/platform/handoff.js:43-73`) |
| `respondToHandoff({handoff_id, actor_id, action})` | any caller who knows `to_actor_id` | **No** — only a string comparison (`handoff.js:86`) |

**Finding A-1 (Medium) — the handoff protocol is unauthenticated.** `proposeHandoff` performs no
authority evaluation at all: any string may be used as `from_actor_id`, and the actor need not
exist in `authority.actors`. `respondToHandoff` checks only
`handoff.to_actor_id !== actor_id` (`handoff.js:86`) — the "actor" is asserted by the caller, not
authenticated. Both operations mutate canonical state (`handoff.js:68`, `handoff.js:96`) and bump
the run revision, so they are not read-only.

This is *consistent with the project's own scope* — 048:21 explicitly declines to treat host
administration as a sandbox — but it means **the handoff mechanism carries no governance weight
of its own**. It is a correlation/plumbing mechanism with actor-shaped names. A consumer who
reads `proposeHandoff`/`respondToHandoff` as an actor boundary is mistaken.

**Recommendation:** document the handoff API as "unauthenticated correlation", or add an
attested-principal check consistent with `resumeRun`'s human attestation
(`packages/core/src/sdk/chord.js#resumeRun`).

### 3.4 `commitRun` — a full-authority CAS that bypasses admission

`chord.commitRun(args)` (`packages/core/src/sdk/chord.js#commitRun`) delegates to `owner.install(args)`
(`src/registry/owner.js:43-53`):

```js
function install(args) {
  if (busy) throw authorityError("REENTRANT_MUTATION");
  args = HostCommitRequest.assert(args);
  if (args.expectedRevision !== owner.registry.run.revision) return { ok: false, code: "STALE_REVISION" };
  const candidate = RegistryData.assert(args.nextRegistry);
  if (!sameData(candidate.event_journal, owner.registry.event_journal)) throw authorityError("INVALID_HISTORY");
  if (candidate.run.revision !== owner.registry.run.revision + 1) throw authorityError("STALE_REVISION");
  capture(owner.registry, candidate, "host_commit");
  return commitRun(owner, { expectedRevision: args.expectedRevision, nextRegistry: candidate, operation: "host_commit" });
}
```

and then `commitRun` applies `assertCanonicalTransition(current, next, operation)`
(`src/registry/registry.js:43`).

**What it does enforce (Verified):** run-id match (`registry.js:38`), schema-version match
(`registry.js:39`), exactly `+1` revision (`registry.js:40`), and the journal prefix must be
byte-identical to the committed journal (`registry.js:42`, `owner.js:49`) — so a host cannot
rewrite history or fabricate events. Those are strong, correct guards.

**What it does not enforce (Verified by execution):** `assertCanonicalTransition`
(`src/platform/state-invariants.js:6-27`) iterates `before.tasks`, `before.task_queue`,
`before.artifacts` and `before.domains` — it validates *transitions of records that already
exist*. It never checks for **added** records. Three probes against the real SDK:

| Probe | What the host did | Result |
|---|---|---|
| A | rewound `authority.authority_revision` from 1 to 0 | `{"ok":true,"revision":3}` — **the monotonic authority guard at `packages/core/src/sdk/chord.js#setAuthoritySnapshot` was bypassed** |
| B | pushed a grant (`grant_id: "smuggled"`) that was never issued via `issueGrants` | `{"ok":true,"revision":3}` — grant ids afterwards: `["g_task_…", "smuggled"]` |
| C | added a whole new task **and** a new queue entry that never passed admission | `{"ok":true,"revision":3}` — task ids afterwards: `["task_…", "injected_task"]` |

**Finding A-2 (High, scoped) — `commitRun` is a second, weaker admission path.** It can install
grants that were never issued, admit tasks that never went through
`queueTaskPackets` → `evaluateAuthority(stage:"admit")` → `admitOperation`, and rewind the
authority revision past the monotonic guard. The dispatch-time authority check still applies
afterwards (`runtime-loop.js:49`), so a smuggled grant does not by itself authorise a *different*
actor's work — but the grant itself is now in canonical state and **will** authorise the actor
it names. The operation-quarantine ledger (`src/platform/reconciliation.js`) is likewise bypassed,
because `admitOperation` is only called on the sanctioned path
(`packages/core/src/sdk/chord.js#queueTaskPackets`).

**Scope note:** this is by design for a trusted host. 047:15 says "generic commitRun" is
experimental trusted-host administration, and 048:21 declines to sandbox it. The finding is
therefore **not** "the code is wrong" but **"the primitive is strictly more powerful than the
surrounding narrative suggests, and it is one line away from an actor boundary."** A consumer who
reads 047:15's "Use dedicated kernel operations for lifecycle/effect transitions" as guidance
will not use `commitRun` for admission; a consumer who reads `commitRun` as "the safe generic
write" will use it for everything.

**Recommendation (not applied — see §9.5):** either (a) document `commitRun` as
"replaces admission, do not use for admission", or (b) add an additive guard that rejects
*newly added* task/queue records unless the operation is an explicit import/quarantine
operation. Option (b) is a behaviour change to a documented privileged API and was therefore
**not** applied in this pass.

### 3.5 The rest of the privileged surface is unguarded, but inert

Six SDK operations mutate canonical state with **no authority check at all**:
`setAuthoritySnapshot`, `commitRun`, `pauseForApproval`, `rejectApproval`, `cancelRun`,
`cancelTask`. That is intentional for a host API.

Their practical risk is bounded by one design property that **is** implemented and verified:
**every SDK read returns a detached deep clone.** `chord.registry` and `chord.getRegistry()`
both return `deepClone(owner.read())` (`packages/core/src/sdk/chord.js#read`, `packages/core/src/sdk/chord.js`), and `getAuthority()`
returns a detached clone (`packages/core/src/sdk/chord.js#getAuthority`). `deepClone` is a JSON round-trip
(`src/utils/clone.js`). Consequently the raw, unguarded mutators (`appendRegistryEvent`,
`enqueueTask`, `markQueueEntryStatus`, `scheduleTaskRetry`, `leaseTaskEntry`,
`dequeueReadyTask`, `replayDeadLetterTask`) **cannot corrupt canonical state**, because a
consumer can never obtain a live reference to it. `tests/integrity.test.js` asserts exactly this
for `exportRegistry()`.

**Finding A-3 (Medium) — the public data API is a trap, not a breach.** The root helpers that
operate on plain registries look like the way to manage work, and they are not: applying them to
`chord.getRegistry()` mutates a throwaway copy that is silently discarded. `replayDeadLetterTask`
is the worst case: it has **zero internal callers and zero test references**, and it implements a
*second, weaker* replay path that omits the operation-quarantine guard that the kernel's
`chord.replayTask` enforces (`packages/core/src/sdk/chord.js#replayTask` vs `src/platform/task-queue.js:107-133`).

**Recommendation:** either remove `replayDeadLetterTask` from the public surface in a major
version, or align it with the kernel path and test it.

### 3.6 The core structural finding: one object, four privilege levels

`createChord()` returns a single object that simultaneously is:

1. the **host administration console** (`commitRun`, `setAuthoritySnapshot`, `commitRun`),
2. the **scheduler** (`runCycle`, `setAdapterRouter`, `setRuntimePolicy`),
3. the **actor context server** (`projectContext`),
4. and the **data inspection API** (`inspectAudit`, `inspectEvents`, `exportRegistry`).

A consumer must implement a restricted host wrapper to give an LLM agent only context and proposal operations; handing it the whole SDK would also expose `commitRun` and `setAuthoritySnapshot`.
**There is no restricted view.** `projectContext` is a data projection, not a capability: it
returns a plain object with no way to call back.

**Finding A-4 (High, design) — there is no actor-facing handle.** This is the single most
consequential gap for the stated use case ("Governed coordination for humans, AI agents, and
services", `packages/core/package.json:6`). The recommended shape is a small, separate
`createActorView(chord, {actor_id, principal_id})` object exposing only
`projectContext` + `proposeHandoff`/`respondToHandoff` + `createTaskPackets`, with no path to
`commitRun` or `setAuthoritySnapshot`. That is new API surface and is therefore **proposed in
§8, not implemented here**.

---

## 4. Defects and inconsistencies

Severity reflects consumer impact within the documented preview scope.

### 4.1 High

| ID | Finding | Evidence | Status |
|---|---|---|---|
| A-2 | `commitRun` bypasses admission, grant issuance and the monotonic authority guard | `src/registry/owner.js:43-53`, `src/platform/state-invariants.js:6-27`; probes A/B/C | **Not fixed** — privileged-by-design; documented in §3.4 |
| A-4 | No actor-facing handle; the privileged host object is the only handle that exists | `packages/core/src/sdk/chord.js#createChord` | **Not fixed** — proposed in §8 |

### 4.2 Medium

| ID | Finding | Evidence | Status |
|---|---|---|---|
| A-1 | Handoff protocol is unauthenticated; `actor_id` is asserted, not attested | `src/platform/handoff.js:43-73`, `:86` | **Not fixed** — out of declared scope |
| A-3 | Raw registry mutators are unguarded by SDK ownership; `replayDeadLetterTask` is dead, weaker, untested | `src/platform/task-queue.js:107-133`; §2.2 | **Not fixed** — removal is a breaking change |
| A-5 | `runRuntimeCycle` on a plain registry **invokes the adapter** while committing nothing | probe D: adapter invoked = 1, canonical task status still `queued` | **Not fixed** — behaviour is documented, but the *effect* divergence is not |
| A-6 | `diffTraces` is useless across two runs of the same workflow | probe E: `equal=false`, 7 missing in each direction | **Not fixed** — see §4.4 |
| A-7 | `prepareAttempt` mutates (run revision +1) despite reading like a query | probe F: revision 2 → 3; `packages/core/src/sdk/chord.js#prepareAttempt`, `packages/core/src/sdk/chord.js#mutate` | **Not fixed** — rename would break the surface |
| A-8 | `createTaskPackets` returns `[]` for a `CoordSpec`; `registerSpecAndQueue` registers descriptive state but queues no task | probe H; `packages/core/src/sdk/chord.js#createTaskPackets`, `packages/core/src/sdk/chord.js#registerSpecAndQueue` | **Not fixed** — would be a behaviour change |
| A-9 | Six root exports and six SDK members have no test coverage at all | §2.2, §2.4 | **Not fixed** — out of this pass's budget |
| A-10 | `Snapshot` pins `snapshot_version: "0.3.0"` while the package is `0.4.0-preview.1`; a `"0.4.0"` snapshot is rejected | `src/contracts/sigils.js:244`; probe L | **Not fixed** — the literal is the compatibility contract |
| A-11 | `_invalidatePendingAttempt` is an internal escape hatch on the public SDK object | `packages/core/src/sdk/chord.js#_invalidatePendingAttempt` | **Not fixed** — removal is a breaking change |

### 4.3 Low

| ID | Finding | Evidence |
|---|---|---|
| A-12 | `replayJournal` and `inspectEvents` return **different shapes for the same events** — 5 keys vs 13 | probe I; `src/platform/journal-audit.js:6-12` vs `src/platform/event-journal.js:23` |
| A-13 | `replayRegistryJournal` reports `sequence: index + 1` while the canonical sequence lives in `payload.sequence` — two conflicting sequence numbers in one object | probe J: index-seq 1..7 vs payload-sequence 0, undefined, 1, undefined, undefined, undefined, 2 |
| A-14 | `listDeadLetterTasks` / `chord.queryDeadLetters` return **queue entries**, not tasks, despite the name | `src/registry/query.js:18-20` |
| A-15 | `projectContext` always returns `handoff_expectations: []`, `constraints: []`, `trusted_decisions: []` — dead contract fields | `src/platform/handoff.js:36`; `src/contracts/sigils.js:261` |
| A-16 | `registerSpec` returns `{registry, spec}` — the entire registry inside a registration result | `packages/core/src/sdk/chord.js#register` |
| A-17 | `chord.registry` and `chord.getRegistry()` are exact duplicates | `packages/core/src/sdk/chord.js#read` |
| A-18 | `ContextRequest` advertises an optional `now` field that the SDK always overrides | `src/contracts/sigils.js:260`; `packages/core/src/sdk/chord.js#projectContext` |
| A-19 | `setAuthoritySnapshot` takes **two different revision CAS values** in one options bag: `expectedRevision` (run revision) and `expectedAuthorityRevision` (authority revision) | `packages/core/src/sdk/chord.js#setAuthoritySnapshot`, `packages/core/src/sdk/chord.js#mutate` |
| A-20 | `commitRun` reports staleness two different ways: `{ok:false, code}` (return) and a thrown `STALE_REVISION` (throw), same code | `src/registry/owner.js:46` vs `:50` |
| A-21 | `stableId` is a misnomer: `Date.now()` + 8 base-36 random chars, neither stable nor deterministic | `src/utils/id.js:3-4` |

### 4.4 A-6 in detail — replay is deterministic, comparison is not

The replay machinery is genuinely good: `reduceTrace` reconstructs state from a versioned
journal, `replayNoSideEffects` invokes no adapter (`effects_invoked: 0`), and
`tests/replay-integrity.test.js` asserts full projected-state equality. The defect is in the
*comparison* helper.

`diffTraces(a, b)` (`src/platform/trace-reducer.js:49`) computes `equal` from `sameData`, a
key-sorted deep comparison that includes `event_id` and `at`. Both are derived from
`Date.now()` and `Math.random()` (`src/utils/id.js:3-4`), so **two logically identical runs
produce different journals**. Probe E:

```
diffTraces(runA.events, runB.events).equal      === false
missingInA.length                               === 7
missingInB.length                               === 7
diffTraces(runA.events, runA.events).equal      === true
```

A consumer comparing independently executed runs gets identity/timestamp differences. Replay of the same recorded journal preserves those records; it is not a fresh run and does not inherently yield this false negative. The correct comparison for that use case is
`canonicalProjection(replayNoSideEffects(events).projected)` versus
`canonicalProjection(state)` — which is exactly what the canonical example does
(`packages/core/examples/cross-actor-workflow.mjs:49-50`).

**Recommendation:** `diffTraces` should compare on `(type, payload, run_revision,
authority_revision)` and treat `event_id`/`at` as identity, not content. Not applied here —
it changes the meaning of an existing public function.

---

## 5. Error and result consistency

### 5.1 The observable error vocabulary

**Verified by static literal source scan (not an exhaustive type of every possible thrown error).** The documented union has 36 codes, including `IMMUTABLE_TASK`; `UNKNOWN` is an uncertainty diagnostic fallback, not included in this error/decision/result union:

| Family | Count | Source | Publicly enumerable? |
|---|---|---|---|
| Contract codes | 7 | `src/contracts/sigils.js:6` | **No** |
| Literal `authorityError(...)` call-site codes | 20 (overlaps other families) | across `packages/core/src/` | **No** |
| Decision codes (returned in `Decision.code`) | 15; SDK denial paths can dynamically throw these codes | `src/contracts/sigils.js:132` | **No** (`DECISION_CODES` exists but is not re-exported by `src/index.js`) |
| Result-only codes | 2 (`RUN_NOT_ACTIVE`, `no_adapter`) | `src/platform/runtime-loop.js` | **No** |

Full union (36):

```
ACTOR_INVALID, ADAPTER_ERROR, ALLOW, APPROVAL_REJECTED, APPROVAL_REQUIRED, ASYNC_COMMIT,
CAPABILITY_MISSING, CONFLICTING_HISTORY, EXPIRED, EXPLICIT_DENY, FORBIDDEN, IMMUTABLE_TASK,
INCOMPLETE_HISTORY, INSUFFICIENT_EVIDENCE, INVALID_CONTEXT, INVALID_DATA, INVALID_HISTORY,
INVALID_RESULT, INVALID_SEMANTICS, INVALID_SHAPE, INVALID_TRANSITION, LIMIT_EXCEEDED,
NO_ALLOW_GRANT, OPERATION_EXISTS, PRINCIPAL_INVALID, RECONCILIATION_REQUIRED,
REENTRANT_MUTATION, RUN_MISMATCH, RUN_NOT_ACTIVE, SCHEMA_MISMATCH, SCOPE_MISMATCH,
STALE_ATTEMPT, STALE_REVISION, TASK_CANCELLED, UNSUPPORTED_HISTORY, no_adapter
```

**Finding E-1 (Medium) — the error vocabulary is not exported.** A consumer must hardcode
strings. Worse, the vocabulary is split across three lists with **no discriminator**: the code
`INVALID_SEMANTICS` is produced by the contract layer (malformed caller data) *and* by
`packages/core/src/sdk/chord.js#setAuthoritySnapshot` (an approval consumption problem), and `SCHEMA_MISMATCH` appears in both the
contract and decision lists. A consumer cannot tell "my input was malformed" from "the system's
state is inconsistent" from the code alone.

**Finding E-2 (Medium) — the error shape is uniform but the vocabulary is not.**
`contractError` (`src/contracts/sigils.js:7-12`) and `authorityError`
(`src/platform/authorization.js:25-30`) both produce a `TypeError` with `.code === .message` and
`.path === "$"`. That uniformity is good and worth keeping. But:

- `contractError` **sanitizes** an unknown code to `INVALID_DATA` (`sigils.js:8`);
  `authorityError` **does not** — `authorityError("ANYTHING")` yields `.code === "ANYTHING"`.
  Two constructors, two policies, for the same `.code` slot.
- `ErrorContract` (`sigils.js:137`) declares `{ code: string, path: "$" }` and validates the code
  against the 7-code contract list. **The `path` field is always the literal `"$"`** — it is
  decorative, never a real location. A consumer expecting a JSON-pointer path will get nothing.
- `DECISION_CODES` (`sigils.js:132`) is a frozen, complete list of authority decision codes and
  is **not exported from the root barrel** (`src/index.js:6` exports only `SCHEMA_VERSION`).

**Recommendation:** export a single frozen `CHORD_ERROR_CODES` (the union of §5.1) from the root
barrel. This is additive, capability-free, and would let consumers write exhaustive handling.
Not applied in this pass: guaranteeing the completeness of a hand-written list is itself a risk,
and the list would need a test that pins it against the source.

### 5.2 Result shapes are inconsistent

**Finding E-3 (Medium, partially fixed in this pass) — `runCycle` reported failure reasons under
three different field names.** The runtime returns six distinct failure shapes
(`src/platform/runtime-loop.js`):

| Line | Shape | Reason field |
|---|---|---|
| 24, 31 | `{ok:false, denied:true, code}` | `code` |
| 46 | `{ok:false, task_id, reason}` | `reason` |
| 52 | `{ok:false, task_id, code, denied:true}` | `code` |
| 87 | `{ok:false, task_id, uncertain, code}` | `code` |
| 100 | `{ok:false, uncertain:false, error}` | `error` |
| 102 | `{ok:false, task_id, uncertain, error}` | `error` |

A consumer had to write three branches (`result.code ?? result.reason ?? result.error`) to learn
why a cycle failed. **This was corrected in this pass**: every non-`ok` result now carries
`code`, with the pre-existing `reason`/`error`/`denied`/`uncertain` fields retained unchanged.
See §9.1.

**Finding E-4 (Low) — SDK methods mix three error conventions.**
Most SDK mutations **throw** (`TypeError` with `.code`); `commitRun` **returns**
`{ok:false, code:"STALE_REVISION"}` (`src/registry/owner.js:46`); `pauseForApproval`,
`resumeRun` and `rejectApproval` **return** `{ok:true, run_state, previous}` while still
throwing on failure (`src/platform/approval-flow.js:18, 35, 49`). The `{ok:true}` return of a
successful `pauseForApproval` is therefore nearly meaningless — the presence of `ok:true` is not
a reliable success signal across the SDK.

---

## 6. Provider and runtime assumptions

### 6.1 Model-provider coupling: none — verified

**Verified by exhaustive scan of `packages/core/src/`:** no occurrence of `openai`, `anthropic`,
`claude`, `gpt-`, `gemini`, `llama`, `mistral`, `azure`, `bedrock`, `cohere`, `ollama`. The
adapter interface is provider-neutral: `{execute(packet, context) → {status, outcome, summary?,
outputs?, artifact?, domain?}}` (`src/contracts/sigils.js:179`). The canonical example's
adapters are plain functions (`examples/cross-actor-workflow.mjs:20, 27`).

This is a genuine strength and it is correctly claimed.

### 6.2 Runtime coupling: real but bounded

| Coupling | Location | Reachable from the public API? |
|---|---|---|
| `Bun.file` / `Bun.write` with a `node:fs/promises` fallback | `src/runtime/adapter.js:2-13` | **No** — not exported; subpath import blocked (§2.5) |
| `process.argv` / `process.exitCode` | `src/cli/run.js:5`, `src/cli/replay.js:5, 14` | **No** — CLI only |
| `structuredClone` | `src/platform/reconciliation.js:12` | **Yes**, via `reconcileTask` |
| `TextEncoder` | `src/contracts/sigils.js:58`, `packages/core/src/sdk/chord.js#parseText` | **Yes** — every contract assert |
| `Date.now()` / `new Date()` / `Math.random()` | 12 source files | **Yes** |

`structuredClone` and `TextEncoder` are web-standard globals available in Node ≥ 17, Deno, Bun
and browsers, but these globals alone do not establish a supported runtime floor or browser compatibility; no such compatibility matrix was tested here. Neither is declared:
`packages/core/package.json` has **no `engines` field**, and `bun.lock` is not in the published
`files` list (`package.json:30-41`), so the published artifact carries no lockfile.

### 6.3 The architecture test does not prove what its name suggests

`tests/architecture-integrity.test.js:6-14` asserts:
1. `manifest.type === "module"`;
2. `manifest.dependencies` deep-equals exactly `{ "@weipertda/sigiljs": "0.18.0" }`;
3. every file under `src/` has a `.js` extension;
4. every **literal** import specifier in `src/` starts with `.`, `node:` or is `@weipertda/sigiljs`.

**What it does not cover (Verified by reading the test):**

- `devDependencies`, `peerDependencies`, `optionalDependencies`, `bin`, `scripts`, `publishConfig`;
- the `exports` map itself — an added subpath would not be caught;
- the `files` allowlist — a new shipped file would not be caught;
- **runtime API usage**: `Bun.file`, `Bun.write`, `process.argv`, `structuredClone`,
  `TextEncoder`, `Date.now`, `Math.random` — all present in `src/` and none detected, because the
  test only inspects *import specifiers*;
- `tests/`, `examples/` and any future top-level directory — the scan root is `src/` only
  (`architecture-integrity.test.js:9`);
- **non-literal** dynamic imports — the regex
  `/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g` (`architecture-integrity.test.js:12`) cannot
  see a specifier built at runtime;
- `bun.lock` consistency with the manifest.

**Finding P-1 (Medium) — the "no provider/framework imports" guarantee is import-syntax-only.**
The claim in the test name ("no provider/framework imports") is true as stated for `src/`, but a
provider SDK could be reached through a computed specifier, and the Bun/Node global usage in
`src/runtime/adapter.js` and `src/cli/` is entirely invisible to the check. The check is also
scoped to `src/`, so `examples/` — which is shipped in the tarball — is unchecked.

**Recommendation:** extend the test to (a) walk the whole package, (b) assert the `exports` map
and `files` allowlist, and (c) scan for a denylist of runtime globals (`Bun.`, `process.`,
`Deno.`). Not applied: that is a test-file change, and this pass may add only one new test file
(already spent on §9).

### 6.4 Clock and randomness are the dominant runtime assumption

See §3.2. The practical consequence: **Chord's own outputs are not reproducible run-to-run**
unless the host normalizes timestamps and identifiers itself. This is not merely cosmetic — it
breaks `diffTraces` (§4.4) and it means an audit report cannot be content-addressed
(§9.2 fixes the report half of this).

---

## 7. Consumer workflow cost

### 7.1 What a consumer must construct by hand

To run one governed task, a consumer must hand-build these six contract shapes:

| Shape | Fields | Where the shape lives | Public constructor? |
|---|---|---|---|
| `Principal` | 5 | `src/contracts/sigils.js:101` | **No** |
| `Actor` | 7 | `src/contracts/sigils.js:102` | **No** |
| `AuthoritySnapshot` | 7 | `src/contracts/sigils.js:117` | **No** |
| `Grant` | 10 + nested `scope` (6 fields + `resource{kind,id}`) | `src/contracts/sigils.js:103` | **No** |
| `IntentSpec` | ~20 optional | `src/contracts/sigils.js:140` | **No** |
| `Approval` | 18 + nested `scope` | `src/contracts/sigils.js:104` | **No** |

Not one of these shapes has a public constructor, validator or type. `evaluateAuthority`,
`contractError`, `authorityError`, `DECISION_CODES`, `Grant`, `Approval`, `AuthoritySnapshot`,
`Principal`, `Actor` are all internal (`src/index.js:6` re-exports only `SCHEMA_VERSION` from
`src/contracts/sigils.js`). **A consumer cannot validate its own authority objects before
submitting them** — it can only submit them and read the thrown `code`.

### 7.2 Measured cost of the canonical two-actor workflow

`packages/core/examples/cross-actor-workflow.mjs` is 56 lines, 5 package imports, and it
exercises: authority install → spec register → grant issue → queue → dispatch → handoff propose →
handoff accept → second queue → approval-required denial → context projection → attempt
preparation → pause → snapshot → restore → approval install → resume → dispatch → replay
verification.

**The measured cost is not the line count — it is the required contract knowledge.**

- Of the 56 lines, **16 are hand-rolled contract boilerplate**: the principal factory (line 12),
  the actor factory (line 13), the snapshot literal (line 14), the grant factory (line 17, one
  400-character line carrying an 11-field grant with a nested scope), the spec factory (line 19),
  and the 15-field approval literal (line 41).
- The two *deep* shapes — `Grant.scope` (6 fields plus a `resource` sub-object whose `kind`/`id`
  must match the task exactly, `src/platform/authorization.js:85-93`) and `Approval` (15 fields,
  of which `task_revision`, `attempt_id`, `principal_id`, `actor_id`, `capability` and `scope` must
  all line up with the prepared attempt, `src/platform/authorization.js:107-114`) — are the ones
  a consumer gets wrong first.
- A single wrong field produces a generic `INVALID_SEMANTICS` or `SCOPE_MISMATCH` at runtime,
  with the offending field never named (`ErrorContract.path` is always `"$"`, §5.1).

**Finding U-1 (Medium) — the workflow cost is dominated by unexported contract shapes, not by
API surface.** The API is small; the *knowledge* required to fill it is not.

### 7.3 The two corrections that address this

`chord.createTaskGrant` and `chord.createApproval` (new in this pass, §9.3) remove the two deep
shapes from the consumer's responsibility. After them:

- hand-built shapes per workflow: **6 → 4** (`Principal`, `Actor`, `AuthoritySnapshot`, `IntentSpec`);
- deep shapes requiring internal knowledge: **2 → 0**;
- the grant's nested `scope` and the approval's 15 fields are derived by the kernel from the
  run and the stored task.

A measured rewrite of the canonical two-actor flow using the helpers is **37 lines** and produces
an identical governed outcome (`ok:true, effects:1, status:"completed"`). The honest framing is
that **the win is in knowledge, not lines** — the two helpers remove the requirement to know the
`scope` sub-object and the approval field list, not the requirement to write a workflow.

### 7.4 Type support

`src/types/index.js` is 38 lines containing **three** JSDoc typedefs (`TaskPacket`,
`ExecutionResult`, `Registry`) and `export {}`. There is no `.d.ts`, no `types` field in
`package.json`, and no `tsconfig` in the package. A TypeScript consumer gets **no types at all**
and no `tsc` check on the public surface. The 30 root exports are untyped; the SDK's 38 members
are untyped.

**Finding U-2 (Medium) — the public surface has no machine-checkable type contract.** The
`SCHEMA_VERSION` constant is the only version signal for the *contract* layer, and it says
nothing about the *snapshot* or *audit* format versions (which are pinned to `0.3.0`, §4.2
A-10).

---

## 8. Proposed minimal governed two-actor surface

This is a **proposal**, not an implementation. It is the shape this audit believes the package
should offer a consumer who wants to wire an AI agent into a governed workflow.

**Actor-visible (safe to expose to an agent):**

```
chord.projectContext({actor_id, principal_id})     → scoped, grant-filtered projection
chord.createTaskPackets(spec)                      → packet proposals (no state change)
chord.proposeHandoff({from_actor_id, to_actor_id}) → correlation only
chord.respondToHandoff({handoff_id, actor_id, action})
```

**Host-only (never expose):**

```
chord.setAuthoritySnapshot / commitRun / queueTaskPackets / runCycle / prepareAttempt
chord.pauseForApproval / resumeRun / rejectApproval / cancelRun / cancelTask / replayTask
chord.reconcileTask / setAdapterRouter / setRuntimePolicy
chord.inspectAudit / inspectEvents / exportRegistry / serializeRegistry / getAuthority
```

**Recommendation:** add `createActorView(chord, {actor_id, principal_id})` returning an object
with exactly the four actor-visible members, and document the host-only list as a blocklist that
must never be forwarded. This is new API surface and is out of scope for an additive-correction
pass; it is recorded here so the next design block can decide.

**Governed two-actor flow the current API does support (already proven by the canonical
example):**

```
host:  createChord → install principals/actors → setAuthoritySnapshot (empty grants)
host:  registerSpecAndQueue(spec, {principal_id, actor_id, capability, issueGrants})
actor: projectContext(...) → scoped view only
host:  prepareAttempt(task_id)                    → reserves the attempt
host:  pauseForApproval()
host:  install the human approval via setAuthoritySnapshot
host:  resumeRun({principal_id: <human>, approval_id})
host:  runCycle()                                 → dispatch, one effect
host:  replayNoSideEffects(inspectEvents()) → canonicalProjection equality check
```

Every step is authority-checked except the host steps, which are host steps by definition.

---

## 9. Corrections applied in this pass

All three are **purely additive**. No existing behaviour changed for existing callers; the root
export list (30) and the package `exports` map are unchanged; no contract was loosened.

### 9.1 Correction 1 — uniform `code` on every non-`ok` runtime result

- **File:** `packages/core/src/platform/runtime-loop.js`
- **Lines:** 46, 100, 102
- **Change:** added `code` to the three failure shapes that lacked it. `reason` and `error` are
  retained unchanged, so every existing field is still present with the same value.
- **Before:** `code` \| `reason` \| `error` — three ways to learn the same thing.
- **After:** `code` is present on **every** non-`ok` result.
- **Not changed:** the `ok:true` shapes, the `denied`/`uncertain` flags, the reason values, or
  any authority behaviour.
- **Test:** `packages/core/tests/developer-api-review.test.js` — "every non-ok runCycle result
  exposes a uniform machine-readable code" asserts `code` on all four failure paths
  (`no_adapter`, `EXPLICIT_DENY`, `ADAPTER_ERROR`, `RUN_NOT_ACTIVE`).

### 9.2 Correction 2 — the "deterministic" audit report can actually be deterministic

- **File:** `packages/core/src/platform/journal-audit.js`
- **Change:** `createDeterministicAuditReport(registry, options)` now honours an optional
  `options.now` (epoch milliseconds) for `created_at`. Without it, behaviour is unchanged (wall
  clock).
- **Why:** the function is named `createDeterministicAuditReport` and its export description
  promises determinism, but it embedded `new Date().toISOString()` — so two calls against
  identical registry state produced different reports and the report could not be diffed or
  content-addressed.
- **Reachability:** `chord.inspectAudit(opts)` already forwarded `opts` to this function
  (`packages/core/src/sdk/chord.js#inspectAudit`), so `chord.inspectAudit({now})` now works with no further change.
- **Not changed:** the default (no `now`) path is byte-identical to before; `audit_version`
  remains `"0.3.0"` (see A-10).
- **Test:** "the audit report is reproducible when the host supplies a clock" asserts two calls
  with the same `now` are deeply equal, that `created_at` matches the supplied clock, that the
  exported `createDeterministicAuditReport` agrees, and that the default path still yields a
  parseable wall-clock timestamp.

### 9.3 Correction 3 — two host helpers that remove the deep contract shapes

- **File:** `packages/core/src/sdk/chord.js`
- **New SDK members:** `createTaskGrant(packet, grantOptions)` and
  `createApproval(approvalOptions)` (member count 36 → 38).
- **What they do:**
  - `createTaskGrant` derives `run_id` and the nested `scope` (including
    `resource:{kind:"task",id}`) from this run and the task packet, and validates the result
    against the `Grant` contract.
  - `createApproval` derives `run_id`, `schema_version`, `scope`, `task_revision`,
    `principal_id`, `actor_id` and `capability` from the **stored task**, and resolves the
    `attempt_id` from the prepared attempt when not supplied; it validates against the `Approval`
    contract.
- **They shape data only.** Neither installs anything or mutates the registry. `createTaskGrant` reads no authority state; `createApproval` reads the stored task’s authority binding and pending attempt, not the authority snapshot. The grant still has to be installed through `setAuthoritySnapshot` /
  `issueGrants`, and the approval still has to be installed through `setAuthoritySnapshot`.
  **No authority path was weakened** — verified by two dedicated tests:
  - a grant shaped by the helper installs nothing and does not authorize: queueing without
    installing it still fails closed with `NO_ALLOW_GRANT`;
  - `createApproval` refuses to mint an approval for the requesting principal
    (`INVALID_SEMANTICS`, from `Approval.assert`'s `approver_principal_id !== principal_id`
    rule, `src/contracts/sigils.js:114`), and an approval naming a **non-human** approver is
    still rejected at `setAuthoritySnapshot` time by the existing
    `principals.get(approver_principal_id)?.kind === "human"` rule
    (`src/contracts/sigils.js:129`).

### 9.4 Deliberately **not** changed

| Candidate | Why not |
|---|---|
| Guard `commitRun` against added tasks/grants (§3.4) | Behaviour change to a documented privileged API; could break legitimate host maintenance and the existing suite. Documented instead. |
| Export `CHORD_ERROR_CODES` / `DECISION_CODES` (§5.1) | Requires a list that is provably complete; an incomplete list is worse than none. |
| Rename `prepareAttempt` / `replayDeadLetterTask` / `listDeadLetterTasks` | Breaking renames on an experimental candidate surface (not published). |
| Change `replayRegistryJournal`'s output shape (§4.3 A-12/A-13) | 047:20 designates it as a *diagnostic* projection, deliberately distinct from the authoritative journal. |
| Remove `_invalidatePendingAttempt` from the SDK object | Breaking removal. |
| Extend `architecture-integrity.test.js` (§6.3) | Only one new test file is permitted in this pass, and it is spent on §9.1–9.3. |
| Change `snapshot_version` / `audit_version` from `"0.3.0"` | The literal is the compatibility contract; changing it invalidates every stored snapshot. |

### 9.5 Known drift created by this pass

`docs/internal/047-evidence/public-surface.json` records the SDK member inventory as it stood at
the 047 gate (36 members). This pass adds two SDK members, so that file is now **stale by two
entries**. It was **not** updated, because `docs/internal/04*` is out of bounds for this pass.
The authoritative inventory for this pass is §2.4 of this report. The root export list (30) is
unchanged and still matches that file exactly.

---

## 10. Verification evidence

All commands were run from `packages/core` unless stated. "Before" is the pre-change baseline.

| Command | Exit | Result |
|---|---|---|
| `bun test` (before) | 0 | **160 pass, 0 fail**, 1371 assertions, 14 files |
| `bun test` (after) | 0 | **166 pass, 0 fail**, 1418 assertions, 15 files |
| `bun test tests/developer-api-review.test.js` | 0 | 6 pass, 0 fail, 47 assertions |
| `bun run src/verify-runtime.js` | 0 | all 12 runtime validations passed |
| `bun run examples/quickstart.mjs` | 0 | `{ completed: true, adapterCalls: 1 }` |
| `bun run examples/cross-actor-workflow.mjs` | 0 | accepted handoff; approval required/validated/consumed; snapshot restored; task completed; 1 protected effect; 0 negative effects; replay verified |
| `git diff -- packages/core/src packages/core/tests` | 0 | 3 modified source files, 1 new test file, 0 other changes |

The +6 tests are exactly the six in the new file; no existing test was modified, and no
assertion was relaxed. The baseline was `160 pass / 0 fail` and it is now
`166 pass / 0 fail`.

### 10.1 Files changed

| File | Change |
|---|---|
| `packages/core/src/platform/runtime-loop.js` | +3 / −3 — added `code` to three failure shapes (§9.1) |
| `packages/core/src/platform/journal-audit.js` | +5 / −1 — `options.now` honoured for `created_at` (§9.2) |
| `packages/core/src/sdk/chord.js` | +71 / −1 — added `createTaskGrant`, `createApproval`, and the `Approval` import (§9.3) |
| `packages/core/tests/developer-api-review.test.js` | **new** — 6 tests covering all three corrections |

---

## 11. Residual risk and recommendations

### 11.1 Must be understood before any external release

1. **The SDK object is a host console.** Do not hand it to an agent, a plugin, or any code the
   host does not control. There is no restricted handle (§3.6).
2. **`runRuntimeCycle` on a plain registry fires real effects and commits nothing** (A-5). Use
   `replayNoSideEffects` for anything that must not touch the outside world.
3. **`commitRun` replaces admission.** Use the dedicated SDK operations for admission and
   lifecycle (§3.4).
4. **The handoff API is unauthenticated.** It correlates; it does not authorize (A-1).
5. **Outputs are not reproducible across runs** because of `Date.now()`/`Math.random()` in
   identifiers and timestamps (§6.4). Compare *projections*, not journals (§4.4).
6. **The authority vocabulary is not exported.** Hardcode carefully, or wait for §5.1's
   recommendation.

### 11.2 Recommended next block (in priority order)

| # | Recommendation | Class | Effort |
|---|---|---|---|
| 1 | `createActorView(chord, {actor_id, principal_id})` — an actor-safe handle (§8) | new API | M |
| 2 | Export a frozen `CHORD_ERROR_CODES` union, with a test pinning it to the source (§5.1) | additive | S |
| 3 | Document `commitRun` as *replacing* admission, or add the additive "no new tasks/grants" guard (§3.4) | doc or guard | S–M |
| 4 | Extend `architecture-integrity.test.js` to the whole package, the `exports` map, the `files` allowlist, and a runtime-global denylist (§6.3) | test | S |
| 5 | Give `diffTraces` a content identity that excludes `event_id`/`at` (§4.4) | behaviour | S |
| 6 | Thread the host clock through the journal, history and ID generator (§3.2, §6.4) | behaviour | L |
| 7 | Add `engines` to `package.json`; publish `bun.lock` or state the intended engine set (§6.2) | packaging | S |
| 8 | Cover the six dark exports and six untested SDK members (§2.2, §2.4) | test | M |
| 9 | Resolve the `"0.3.0"` snapshot/audit version skew (A-10) | packaging | M |
| 10 | Remove or align `replayDeadLetterTask`; de-underscore or hide `_invalidatePendingAttempt` (A-3, A-11) | breaking | M |

### 11.3 Explicitly out of scope (matching the project's own position)

Durable storage, multi-process or distributed CAS, actor federation, an authenticated network
API, a hostile-adapter sandbox, global semantic deduplication, simulation/fork, and cryptographic
evidence signing remain deferred (`docs/internal/047-public-api-compatibility.md:11`,
`docs/internal/048-final-report.md:101`). Nothing in this audit argues for or against them.

---

## 12. Conclusion

Chord's **implemented** safety properties are real and hold under this audit's independent
probing: authority is re-evaluated at admit, dispatch and commit against live state; admission
fails closed; the journal cannot be rewritten; unknown effects quarantine instead of retrying;
replay reconstructs exactly. The test suite is substantive and the failure paths are exercised.

Chord's **implied** safety properties do not hold, and they are the ones a consumer is most
likely to assume. The trusted-host seam is a naming convention; the SDK object mixes four
privilege levels with no restricted view; `commitRun` is a second admission path; and the
error vocabulary, the contract constructors and the type surface are all invisible to the
consumer who has to use them.

The three corrections applied here are deliberately small and deliberately additive. They fix
one real inconsistency (three field names for one failure reason), one self-contradicting
promise (a "deterministic" report that is not), and the single largest source of consumer
friction (two deep contract shapes that had to be reproduced by hand). They were chosen over
larger changes because the larger changes — a guarded `commitRun`, an exported error vocabulary,
an actor view — are the maintainer's decisions, not this audit's, and each deserves its own
tested block.

**Gate: PASS** for the documented trusted-host, single-process, in-memory preview scope.


## Pass A1 clarification / supersession

Sections 7.1–7.2 measure pre-helper setup; shipped examples now use both helpers (§9.3), so 56-line/boilerplate measurements are not current example measurements. The observable union already included `IMMUTABLE_TASK` at A1 entry; its producer is `packages/core/src/platform/state-invariants.js#assertCanonicalTransition`. Section 5.2’s reason/error-only table is pre-correction, not current. `expectedAuthorityRevision` compares with the incoming/next authority revision, while `expectedRevision` compares with the installed run revision. Test-name coverage counts are not evidence that all unreferenced exports mutate or lack indirect coverage. Current checks are in `050-citation-closeout.md`.
