# 041 — Authority design (Block 2, Pass 2)

Status: **design complete; implementation and security verification pending**. Baseline main SHA: `6b07802ba8639b29e7c48534612dbd60c946946d`. Block 1 remains PARTIAL. This pass changes documentation only, under the scoped exception recorded in `041-contract-scope.md`. No dependency, lockfile, package version, export layout, or runtime change is made.

## 1. Decisions and boundary

The minimal model is host-authenticated identity plus explicit, nondelegable grants. Authentication is an embedding-host responsibility, not something a schema, actor name, role, adapter route, model label, or request field proves. The host authenticates a caller using its own mechanism, then supplies a separate trusted context. Chord does not implement credential verification or claim that a structurally valid principal is authenticated.

- **Principal:** identity established by the host, identified by `principal_id` and `issuer`. No bearer credentials are stored.
- **Actor:** host-registered execution identity bound to exactly one principal. `target_entity` remains routing metadata, not identity. Actor kind (human/agent/service) is descriptive.
- **Role:** descriptive label only. Neither `role: "admin"` nor domain ownership implies permission. No role inheritance or implicit role-to-grant expansion.
- **Capability:** a host-declared exact action identifier the actor can perform. It is necessary, never sufficient authorization. Prose in `requested_action` is not a capability identifier.
- **Grant:** host-issued allow or deny for one principal, actor, capability, and exact scope. No wildcard, prefix matching, delegation, or request-authored grants in this preview.
- **Approval:** host-attested decision by a human principal for one immutable task and attempt, not a Boolean in a request. Approval never substitutes for a grant.

The trusted host is allowed to install authority, change policy, authenticate principals, and own adapters. Passing an untrusted request directly as `trustedHost`, or exposing the SDK host object to an actor, defeats the boundary. JavaScript branding, freezing, and schema checking are not authentication or isolation. In-process adapters and low-level exported platform helpers remain trusted-host experimental APIs; direct host calls can bypass the kernel. Guarantees cover only the governed runtime path, not arbitrary code in the process.

## 2. Inspected SigilJS API and contract implementation choice

Downloaded the exact npm tarball for `@weipertda/sigiljs@0.18.0`, without installing it. `package.json` declares ESM and a root default export target of `./src/index.js`; that file exports the named `Sigil`, lowercase `sigil`, helpers, and `SigilValidationError`. Use the public named import `import { Sigil } from "@weipertda/sigiljs"` in a later pass, not a guessed `createValidator` export.[1]

Verified source interfaces: `Sigil.exact` is a tagged-template constructor; its contract object has `.check(value, opts)` returning a Boolean, `.assert(value, opts)` returning the checked value or throwing, `.parse(value, opts)`, and `.safeParse(value, opts)` returning `{ success: true, data }` or `{ success: false, error }`. Exact mode applies to inline nested object expressions. `.version(string)` sets metadata; it does **not** enforce a run's version. `.assert()` does not clone input.[1]

A direct Node import of the extracted public entry point exercised this exact schema:

```js
Sigil.exact`{ id: string, scope: { action: string }, expires_at: number, effect: "allow" | "deny" }`
```

Observed output (API probe, not Chord tests):

```json
{"valid":true,"extra":false,"nestedExtra":false,"invalidEnum":false,"sameReference":true,"undefinedRequired":false,"inheritedRequired":true,"safeParseFailure":false}
```

The inherited-required-field probe passed: exact schemas alone are insufficient to establish own-property, plain-data boundaries. Source object diagnostics also use `in` and `for...in`. Avoid the unexported `src/core/validator.js`, whose imports differ from the public working entry path.[1]

**Later contract pass:** pin the intended package only after applying the approved dependency repair; replace the imitation validator with `Sigil.exact` contracts. Surround shape checking with Chord-owned recursive plain-data and semantic validation: own data properties only; no accessors, symbols, custom prototypes, cycles, undefined, functions, nonfinite numbers, or prototype-sensitive keys (`__proto__`, `prototype`, `constructor`) at any depth. Reject rather than silently remove unknown fields. Bound byte size, nesting, strings, arrays, and safe-integer numeric ranges. Clone validated values before retaining them. Never return or journal raw Sigil/provider messages containing submitted data; expose `{ code, path }` with fixed codes and sanitized schema paths. Identifiers are nonempty bounded strings, compared exactly, never trimmed or case-folded. Reject invalid tokens rather than repairing them.

## 3. Proposed data contracts (not existing exports)

All records below are closed, versioned plain data. All listed fields are required unless explicitly marked optional. `ID` means a validated identifier, `Time` a nonnegative safe-integer Unix millisecond value, `Revision` a nonnegative safe integer. Array IDs must be unique; duplicate record IDs reject the whole update. Nullable fields must be explicitly `null`, not omitted. These are interface specifications for JS/JSDoc, not a request to add TypeScript.

| Record | Exact fields |
|---|---|
| Run metadata | `run_id: ID`, `schema_version: "chord.contracts.v1"`, `revision: Revision` |
| Principal | `principal_id: ID`, `issuer: ID`, `kind: "human" | "service"`, `authenticated_at: Time`, `expires_at: Time` |
| Actor | `actor_id: ID`, `principal_id: ID`, `kind: "human" | "agent" | "service"`, `roles: ID[]`, `capabilities: ID[]`, `revoked_at: Time | null` |
| Scope | `run_id: ID`, `project: ID`, `phase: ID`, `task_id: ID`, `target_entity: ID`, `resource: { kind: "task" | "artifact" | "domain", id: ID }` |
| Grant | `grant_id: ID`, `principal_id: ID`, `actor_id: ID`, `capability: ID`, `effect: "allow" | "deny"`, `scope: Scope`, `issued_at: Time`, `expires_at: Time`, `revoked_at: Time | null`, `requires_approval: boolean` |
| Task authority binding | `principal_id: ID`, `actor_id: ID`, `capability: ID`, `scope: Scope`, `approval_required: boolean` |
| Approval | `approval_id: ID`, `approver_principal_id: ID`, `decision: "approved" | "rejected"`, `run_id: ID`, `schema_version: "chord.contracts.v1"`, `task_id: ID`, `task_revision: Revision`, `attempt_id: ID`, `principal_id: ID`, `actor_id: ID`, `capability: ID`, `scope: Scope`, `issued_at: Time`, `expires_at: Time`, `revoked_at: Time | null`, `consumed_by_attempt_id: ID | null` |
| Authority snapshot | `schema_version: "chord.contracts.v1"`, `run_id: ID`, `authority_revision: Revision`, `principals: Principal[]`, `actors: Actor[]`, `grants: Grant[]`, `approvals: Approval[]` |
| Attempt binding | `run_id: ID`, `schema_version: "chord.contracts.v1"`, `task_id: ID`, `task_revision: Revision`, `queue_id: ID`, `attempt_id: ID`, `lease_expires_at: Time`, `authority_revision: Revision`, `grant_ids: ID[]`, `approval_id: ID | null` |

`Task authority binding` is stamped from trusted admission context, never taken from the parsed spec. One capability and one resource per packet is deliberate; split multi-resource privileged operations into separate tasks. Existing `requested_action: string[]` remains the immutable descriptive payload of that one operation. It cannot widen its capability or resource. A `task` resource must name the task itself; artifact/domain resources must match the stored task's declared target. No implicit `unknown`, `default`, empty scope, or omitted resource permission. Exact task-scoped grants can be issued after the SDK creates packet IDs and before admission.

The complete immutable task payload (including actions, inputs, constraints, routing, and authority binding) is identified by `(run_id, task_id, task_revision)`. No payload edits are permitted under that tuple. `task_revision` is a content revision (initially zero), distinct from mutable run `revision`. Changing payload requires a new task ID in this minimal design. Status updates do not change the content revision. Thus approval binding covers payload without introducing a new hashing/canonicalization scheme.

Only an active human principal from the host snapshot can be an approver. The host attests that this human is permitted to approve this exact operation; Chord does not infer an approver role from request data. Reject approval by the executing principal. The host must never manufacture human approval from model output. Grants and approvals require `issued_at < expires_at`, and apply only when `issued_at <= now < expires_at`. Any non-null `revoked_at` disables the record immediately (no scheduled revocation semantics). Principal authentication requires `authenticated_at <= now < expires_at`; actor revocation disables all its grants. The host's synchronous authority installation is authoritative for revocation; no claim of globally instantaneous revocation across machines.

## 4. Exact proposed host and evaluator interfaces

Keep `createChord(options)` and current root/sdk/platform entry paths. Add `options.trustedHost` containing a run-bound validated initial authority snapshot and `now: () => Time`. It is a host-only configuration channel, not a serialized request option. Missing authority is permitted for parsing/inspection but every admission/dispatch is denied. Clock defaults may use `Date.now` at the host seam; the pure evaluator never reads a clock itself. Detect backward movement in the host seam and fail closed until corrected.

Proposed host-only SDK methods:

```js
setAuthoritySnapshot(snapshot, { expectedAuthorityRevision, expectedRevision })
queueTaskPackets(packets, { priority, expectedRevision, principal_id, actor_id, capability, approval_required })
registerSpecAndQueue(spec, { priority, expectedRevision, principal_id, actor_id, capability, approval_required })
prepareAttempt(taskId, { expectedRevision })
runCycle()
cancelTask(taskId, { expectedRevision })
```

These options are explicitly **trusted-host arguments**, even though IDs are plain strings. The embedding layer resolves principal/actor from its authenticated session; it must not forward client-supplied IDs. Scope derives from validated packet/run fields and must equal the selected grant scope. `approval_required` is host policy and can only add a requirement. Standalone spec registration is descriptive; it cannot accept/complete artifacts or domains based on spec text. A separate trusted state-management path must use the same guarded commit rules.

`setAuthoritySnapshot` requires the same run/schema, next consecutive authority revision, and the expected current run revision. It validates all references, clones, and swaps atomically; it also advances run revision. No partial merge, request-based grants, or rollback to older authority. Revoked records cannot be reactivated under the same ID; new grant/approval IDs are required. Approval consumption is kernel-owned state, cannot be reset by snapshot replacement, and is merged/validated against the run's consumed-approval records.

`prepareAttempt` reserves a unique `attempt_id` for a queued task and returns its frozen task/attempt binding for human review, without executing, consuming approval, or starting a lease. This resolves the approval-before-dispatch dependency. Repeating it returns the same pending attempt; a retry creates a new one. An approval is installed through the host authority snapshot for that prepared attempt. Dispatch starts the lease. Cancellation invalidates the reservation.

Pure proposed module `src/platform/authorization.js`:

```js
evaluateAuthority({ stage, now, run, task, attempt, authority })
// stage: "admit" | "dispatch" | "commit"
// Returns exactly:
// { allowed: boolean, code: string, grant_ids: ID[], approval_id: ID | null }
```

`run` is `{run_id, schema_version, revision}`; `task` is a validated stored task including content revision, authority binding and current status; `attempt` is null for admit and the validated binding otherwise; `authority` is a validated snapshot. The function validates its own inputs, returns `INVALID_CONTEXT` rather than throwing on invalid data, has no mutations, logging, I/O, randomness, or implicit time. Decisions are data, not transferable permission tokens. Runtime recomputes them on live immutable snapshots; it never accepts an actor-supplied `allowed: true` object.

Fixed decision order, first failure wins:

1. `INVALID_CONTEXT`: invalid shape/semantics, duplicate IDs, or inconsistent references; `SCHEMA_MISMATCH`: incompatible run/record version; `RUN_MISMATCH`: foreign run.
2. `TASK_CANCELLED`, then `INVALID_TRANSITION`: task/attempt state incompatible with stage; then `STALE_ATTEMPT` for content/attempt/lease mismatch (dispatch checks the prepared reservation; commit requires an unexpired running lease).
3. `PRINCIPAL_INVALID`: missing/expired/not-yet-valid principal; `ACTOR_INVALID`: missing, revoked, or bound to another principal; `CAPABILITY_MISSING`: actor lacks the exact action identifier.
4. `SCOPE_MISMATCH`: binding differs from immutable task/run/resource. Find grants matching principal, actor, capability and every scope field; ignore expired, future-issued or revoked grants.
5. `EXPLICIT_DENY`: any active matching deny wins over every allow, regardless of ordering or specificity. Otherwise `NO_ALLOW_GRANT` if no active matching allow.
6. Approval is required when the task requires it **or any active matching allow requires it**. Admit checks permission only and may queue awaiting approval. Dispatch requires an exact matching, active, unconsumed human approval; commit requires that same approval consumed by this attempt. An active exact rejection wins (`APPROVAL_REJECTED`); otherwise absence/invalidity yields `APPROVAL_REQUIRED`. An expired/revoked approval cannot authorize commit.
7. `ALLOW`: return all active matching allow IDs sorted by code-unit comparison (not locale), and lexically first eligible approval ID if required; otherwise null. At commit require the dispatch-selected grants and approval still valid; newly added replacements cannot retroactively authorize an attempt. Denials return empty grant IDs and null approval ID.

For identical input bytes and `now`, decisions are identical; grant/approval array order has no effect. Admission denial performs no mutation. Missing approval at dispatch leaves a prepared task queued with no lease or automatic retry consumption; an explicit rejection blocks it. Expiry/denial are not transport errors and must not trigger adapter execution or blind retries.

## 5. Revision guards, dispatch, and state commit

Use a single-process owner and whole-run revision CAS, conservatively rejecting concurrent changes rather than guessing they are unrelated. Every authoritative mutation (admission, authority replacement, lease, retry, cancel, result, domain/artifact transition, replay admission) increments `run.revision`. Each operation requires an expected revision captured at its read boundary. No mutation bypass through public untrusted endpoints. Exposed live registry access remains trusted-host-only; do not claim safety against callers modifying it directly.

Proposed internal interface:

```js
commitRun(registry, { expectedRevision, nextRegistry })
// { ok: true, revision } or { ok: false, code: "STALE_REVISION" }
```

Before this call, validate a fully cloned candidate, all cross-record invariants and all derived events/results. In one synchronous section with no await, compare revision, then swap the owner-held state reference with the validated candidate at revision + 1. SDK getters must read the owner's current state, not stale closure references. Never mutate current state progressively and hope to roll it back. Preserve external API entry paths, not unsafe live-object identity guarantees. Commit is in-memory atomicity only, not crash durability or a distributed transaction.

Runtime sequence:

1. Preflight all specs, packets, duplicate IDs and admission permissions before atomically registering/queueing any member of a batch. Existing IDs reject, including identical submissions; no overwrite-as-idempotency.
2. Select a prepared task, capture current revision and time, evaluate dispatch using current authority. Check lease caps and adapter existence before effects. Atomically record lease, attempt binding, selected grant/approval IDs, consume approval, and advance revision. Save the resulting revision as the attempt's commit guard.
3. Without an intervening await or host callback between final authorization/lease commit and invocation, call the trusted adapter with deep-frozen cloned packet and `{run_id, schema_version, task_id, task_revision, queue_id, attempt_id, lease_expires_at}` only. Never pass the registry or authority write handles. Adapters remain trusted code; freezing limits accidental mutation, not malicious execution.
4. After await, capture current time/state. Validate the raw result **before** normalization. Require exact run/schema/task/content-revision/queue/attempt correlation and an explicit consistent status/outcome; missing/null results are not success. The host adapter wrapper may stamp context it actually dispatched but must reject conflicting supplied identifiers. Result artifact/domain targets must match the stored authorized resource; no arbitrary named-target mutation.
5. Reevaluate commit permission and compare the saved run revision; any intervening cancellation, revocation, policy/state change, or other commit makes this candidate stale. Never reuse a previously returned allow. Precompute the complete task/queue/result/artifact/domain/event candidate and commit once. A duplicate result cannot append another record or repeat terminal transitions.
6. A post-dispatch invalid result, timeout, thrown adapter error with unknown effect status, expired lease, or stale commit goes to `uncertain`/reconciliation, never automatic success or blind redispatch. If another mutation won, mark uncertainty only through a fresh guarded operation on the still-current attempt, without overwriting cancellation or another terminal state. Sanitized rejected-result diagnostics must not mutate domain/artifact truth. External effects cannot be rolled back by denying a state commit.

Minimal task transitions: `queued -> running | blocked | cancelled`; `blocked -> queued | cancelled` only by explicit host re-evaluation; `running -> completed | failed | uncertain | cancelled`. `completed`, `failed`, and `cancelled` are terminal for the task ID. `uncertain` requires explicit host reconciliation, not normal result ingestion. Pre-dispatch transient routing failures may stay queued under bounded policy. Post-dispatch retry requires trusted confirmation of no effect and a fresh attempt/approval, or a separately specified adapter idempotency protocol; neither is inferred from a thrown exception. Dead-letter replay must go through fresh admission and attempt allocation, not reset a prior attempt/approval.

An explicit valid adapter result is evidence of an adapter report, not independent proof of a real-world outcome. Artifact/domain terminal transitions are derived only from an authorized, correlated, valid committed result and a legal transition, not `spec.status`, a fabricated default result, or journal replay. Later transition tests must cover allowed and forbidden edges for all affected records.

## 6. Run schema and persistence

The contract schema version is `chord.contracts.v1`, independent of the unchanged npm version `0.3.0`. Freeze it at run creation and carry it in tasks, attempts, results, authority and snapshots. Dispatch uses the run's contract set, never whichever schema happens to be latest. Unknown versions and legacy unversioned snapshots are rejected in this scope; no silent migration. Explicit migration is future work.

Snapshot validation does not authenticate its contents. Import is a trusted-host operation requiring validated entire state, same-version consistent references and fresh host authority. Do not restore executable authority or human approval from an untrusted JSON document. Imported in-flight attempts are uncertain, not silently executable. Journal replay remains diagnostic and invokes no adapters; it cannot recreate permission or consume approvals. No claim of cryptographic journal integrity, historical reconstruction, durable exactly-once delivery, or multi-process CAS.

## 7. Handoff and acceptance criteria

Later passes, in order: real closed contracts and safe ingress; pure evaluator wired into SDK/runtime; guarded transitions and atomic candidate commit; adversarial tests; truthful docs/examples. Retain JS ESM and functional package layout. Repair the known missing result-ingestion bindings and optimistic normalization as scoped prerequisites, not a broader refactor.

Required tests include forged request authority/identity/role, missing host context, cross-principal actor, capability-only access, exact scope mismatch, expiry boundary equality, actor/grant revocation, deny/allow ordering permutations, approval rejection/expiry/reuse/wrong attempt/wrong payload/self-approval, admission versus dispatch approval, version mismatch and legacy snapshot rejection, duplicate admission, no partial batch writes, concurrent revision losers, cancellation/revocation during await, stale/duplicate/foreign results, malformed adapter results, no leaked registry references, and no automatic retry after ambiguous effects. Assert zero adapter calls for pre-dispatch denials. No Chord tests were run or claimed passing in this design pass.

Open operational boundary, not an implementation blocker: the embedding host must authenticate identities, attest authorized human approval, persist revocations if needed, and constrain its adapters' external effects. The minimal model deliberately defers delegated authority, role policy languages, wildcards, distributed storage, sandboxing, cryptographic credentials, and provider-specific reconciliation.

## 8. Inspection and actual command evidence

Repository inspected: `docs/internal/{041-contract-scope,040-contract-gap-matrix,040-runtime-state-audit,040-trust-boundary-audit}.md`; `packages/core/package.json`; `packages/core/src/contracts/sigils.js`; `packages/core/src/sdk/chord.js`; `packages/core/src/platform/{runtime-loop,task-queue,policy}.js`; `packages/core/src/registry/{registry,snapshot}.js`; `packages/core/src/execution/{task-packets,results}.js`. Initial attempted `src/` inventory returned path-not-found; corrected to the actual `packages/core/src` layout.

Extracted package inspected under `/home/d/.hermes/cache/scratch/chord-041-authority/package/`: `package.json`, `src/index.js`, `src/sigil.js`, `src/core/{assert,validate,validator}.js`, `docs/exact-mode.md`. Public entry API exercised by direct Node import. No package install performed.

Actual shell commands (repository workdir unless absolute scratch target shown):

```sh
git status --short
git rev-parse HEAD
npm view @weipertda/sigiljs@0.18.0 dist --json
mkdir -p /home/d/.hermes/cache/scratch/chord-041-authority
npm pack @weipertda/sigiljs@0.18.0 --ignore-scripts --pack-destination /home/d/.hermes/cache/scratch/chord-041-authority
tar -xzf /home/d/.hermes/cache/scratch/chord-041-authority/weipertda-sigiljs-0.18.0.tgz -C /home/d/.hermes/cache/scratch/chord-041-authority
sha1sum /home/d/.hermes/cache/scratch/chord-041-authority/weipertda-sigiljs-0.18.0.tgz
```

All above succeeded. SHA-1 matched npm metadata: `82a40649bfb1ec5213b049b1080dbf9011707b23` (identity check, not a separate security audit). `node --input-type=module -e` imported the absolute extracted `src/index.js` and printed the probe object recorded in section 2, exit 0. Reads used file tools; long collected output was paged from `/home/d/.hermes/cache/exec/stdout-99c351289f57.txt`. Citation ledger is scratch-only at `/home/d/.hermes/cache/scratch/chord-041-authority/citations.json`.

Changed repository file: this document only. Preserved existing `.gitignore`, `.vscode/settings.json`, README and other docs. No runtime implementation, dependencies, releases, or version changes. Pass 3 is ready to implement against this proposed interface; runtime correctness remains unverified.

## Sources

[1] https://registry.npmjs.org/@weipertda/sigiljs/-/sigiljs-0.18.0.tgz — @weipertda/sigiljs 0.18.0 inspected npm source tarball
