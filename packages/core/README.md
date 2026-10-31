# @antistructured/chord

**Governed coordination for humans, AI agents, and services.**
*Turn intent into governed execution.*

Chord is an embeddable JavaScript coordination kernel. It sits between an embedding **host** and the
**actors** that act on the host's behalf: the host installs authority, submits intent as structured
specs, and Chord decides — deterministically — which actor may perform which exact task, under
whose approval, and which external effects may be treated as committed. Every accepted transition
is recorded as a versioned committed fact, so a run can be reconstructed and audited without
re-running any provider.

| | |
|---|---|
| **Package** | `@antistructured/chord@0.4.0-preview.1` |
| **Status** | Local public-preview candidate. **Never published to npm.** |
| **Level** | Level A preview; experimental 051 sequential durability and separate 052 local fenced-owner/actor mode. Neither promotes the full Level B contract. |
| **Runtime** | JavaScript ES modules. One runtime dependency: `@weipertda/sigiljs@0.18.0`. |
| **License** | Apache-2.0 (first-party). SigilJS is MIT and separately installed. |
| **API stability** | None. Every exported surface is experimental. |

This is the **package** README. For the project's value proposition, the capability classification,
the architecture discussion and the roadmap, see the [repository README](../../README.md).
For six concise public-API workflows, see the [repository developer guides](../../docs/guides/README.md).
Those repository links are not shipped in the tarball; the six runnable `examples/` scripts are.

---

## Install

Use the local preview candidate; there is no supported registry installation. Follow the
[repository setup and local tarball install guide](../../docs/guides/README.md#local-consumer-installation).
For an installed tarball this repository-only link is not included: from another private project,
install the absolute local `.tgz` path with `npm install --ignore-scripts --no-audit --no-fund PATH_TO_TARBALL`.

That installs the single runtime dependency, `@weipertda/sigiljs@0.18.0`, from cache or the registry according to npm options.
There is no global CLI binary and no registry install.

---

## Entry points

Four import paths are declared in the local candidate’s `exports` map. All four are experimental; the `/platform` entry point is
trusted-host plumbing, not a public product surface, and `/interop` is a provider-neutral experimental adapter protocol.

| Specifier | Resolves to | Exports | Use it for |
|---|---|---|---|
| `@antistructured/chord` | `src/index.js` | 64 | Legacy SDK/helpers plus explicit experimental coordinated host, storage, IPC and adapter-interop factories. |
| `@antistructured/chord/sdk` | `src/sdk/index.js` | 1 | `createChord` only. |
| `@antistructured/chord/platform` | `src/platform/index.js` | 22 | Low-level queue, routing, journal and reducer primitives. Trusted-host plumbing. |
| `@antistructured/chord/interop` | `src/interop/index.js` | 29 | Versioned adapter protocol contracts, bridge/server, reference adapters and memory transport. |

### `@antistructured/chord` — 64 exports

| Group | Exports |
|---|---|
| SDK / local storage | `createChord`, `openSqliteStore` (trusted-host raw store) |
| Coordinated v2 / IPC | `createCoordinatedChord`, `openCoordinatedSqliteStore`, `createActorIngress`, `createActorClient` (root only; not `/sdk` or `/platform`) |
| Adapter interop | `ADAPTER_PROTOCOL_VERSION`, `ADAPTER_DESCRIPTOR_VERSION`, `ADAPTER_CONTEXT_VERSION`, `ADAPTER_KINDS`, `ADAPTER_MESSAGE_TYPES`, `AdapterAdvertisement`, `AdapterExecutionContext`, `AdapterContext`, `AdapterExecuteRequest`, `AdapterResultResponse`, `AdapterErrorResponse`, `AdapterDescribeRequest`, `AdapterDescribeResponse`, `AdapterCancelRequest`, `AdapterCancelResponse`, `AdapterShutdownRequest`, `AdapterShutdownResponse`, `adapterCompatibility`, `assertAdapterCompatibility`, `adapterError`, `parseAdapterWire`, `validateAdapterExecuteRequest`, `validateAdapterResponse`, `createAdapterBridge`, `createAdapterServer`, `createLocalToolAdapter`, `createMockAgentAdapter`, `createMemoryTransportPair`, `runAdapterConformance` |
| Contracts | `SCHEMA_VERSION` |
| Queue | `createTaskQueue`, `enqueueTask`, `selectReadyTask`, `dequeueReadyTask`, `leaseTaskEntry`, `markQueueEntryStatus`, `scheduleTaskRetry`, `listQueuedTasks`, `listDeadLetterTasks`, `replayDeadLetterTask` |
| Routing / policy | `createAdapterRouter`, `resolveAdapter`, `createRuntimePolicy`, `computeBackoffDelayMs` |
| Runtime | `runRuntimeCycle` |
| Journal / audit | `appendRegistryEvent`, `listRegistryEvents`, `createDeterministicAuditReport`, `replayRegistryJournal` |
| History / replay | `canonicalProjection`, `reduceTrace`, `replayNoSideEffects`, `diffTraces` |
| Snapshots | `exportRegistry`, `importRegistry`, `serializeRegistry` |
| Queries | `queryArtifacts`, `queryDomains` |

### `@antistructured/chord/platform` — 22 exports

`appendRegistryEvent`, `canonicalProjection`, `computeBackoffDelayMs`, `createAdapterRouter`,
`createDeterministicAuditReport`, `createRuntimePolicy`, `createTaskQueue`, `dequeueReadyTask`,
`diffTraces`, `enqueueTask`, `leaseTaskEntry`, `listQueuedTasks`, `listRegistryEvents`,
`markQueueEntryStatus`, `reduceTrace`, `replayDeadLetterTask`, `replayNoSideEffects`,
`replayRegistryJournal`, `resolveAdapter`, `runRuntimeCycle`, `scheduleTaskRetry`,
`selectReadyTask`.

> The `/platform` entry point exposes the same unguarded data API as the root export. It is
> **not** scope-filtered. Do not forward it, or `chord.queryArtifacts`, `chord.queryDomains`,
> `chord.inspectAudit`, `chord.inspectEvents`, `chord.exportRegistry` or
> `chord.serializeRegistry`, to an untrusted caller.

The legacy `createChord()` object has **39 enumerable members** (38 methods plus detached
`registry` getter), not 39 module exports: `_invalidatePendingAttempt`, `cancelRun`, `cancelTask`,
`close`, `commitRun`, `createApproval`, `createTaskGrant`, `createTaskPackets`, `exportRegistry`,
`getAuthority`, `getRegistry`, `getRunRevision`, `getRunState`, `inspectAudit`, `inspectEvents`,
`parseText`, `pauseForApproval`, `prepareAttempt`, `projectContext`, `proposeHandoff`,
`queryArtifacts`, `queryDeadLetters`, `queryDomains`, `queryQueue`, `queueTaskPackets`,
`reconcileTask`, `registerSpec`, `registerSpecAndQueue`, `registry`, `rejectApproval`,
`replayJournal`, `replayTask`, `respondToHandoff`, `resumeRun`, `runCycle`, `serializeRegistry`,
`setAdapterRouter`, `setAuthoritySnapshot`, `setRuntimePolicy`. Underscore/maintenance members
are not actor APIs. The separate coordinated factory has **4** members, **5** owner, **5** observer,
**5** admin methods, **2** ingress methods and **2** actor-client methods; its raw v2 store has
**7** methods, enumerated in [the v2 guide](#052-local-fenced-owner-and-actor-mode).

---

## Quickstart

The shipped example is `examples/quickstart.mjs`. It grants one mock actor permission to
*draft* a support response — not to send it — and completes one governed cycle.

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

Run it from the package directory, where the bare specifier resolves through this package's `exports` map:

```bash
cd packages/core
bun run examples/quickstart.mjs
```

Expected output:

```text
{ completed: true, adapterCalls: 1 }
```

`examples/cross-actor-workflow.mjs` is the full governed path — two mock actors, a revision-aware
handoff, missing-approval denial, human approval consumption, a paused snapshot restored into a
second SDK instance, safe continuation and a zero-effect replay. All six shipped examples, including the separate-process
`examples/process-recovery.mjs` and `examples/two-process-coordination.mjs` described below, are included in the candidate payload under `examples/`.

---

## Memory and durable modes

`createChord()` is memory-only: closing or losing the process loses its live state. Snapshot
export/import is a separate host-controlled session boundary, not live-store crash recovery.
Opt in to **051 legacy local SQLite durability** with the host-only `storage` option below.
This section describes `createChord`, not the separate [052 coordinated factory](#052-local-fenced-owner-and-actor-mode).

```js
import { createChord, openSqliteStore } from '@antistructured/chord';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';

// Example scratch only; production must provision and retain a private local directory.
const base = process.env.TMPDIR;
if (!base) throw new Error('Set TMPDIR to a private absolute local scratch directory');
mkdirSync(base, { recursive: true });
const path = join(mkdtempSync(join(base, 'chord-guide-')), 'run.sqlite');
const host = { now: () => Date.now() }; // trusted host clock, never actor input
const first = createChord({ storage: { path, mode: 'create' }, trustedHost: host });
const runId = first.getRegistry().run.run_id;
first.pauseForApproval({ reason: 'operator review' });
first.close(); // await any runCycle() calls before closing; does not drain/cancel an effect
const second = createChord({ storage: { path, mode: 'existing' }, trustedHost: host });
if (second.getRegistry().run.run_id !== runId) throw new Error('Run identity changed');
second.close();
const store = openSqliteStore({ path, mode: 'existing' });
try {
  const page = store.readHistory({ afterOrdinal: 0, limit: 2 });
  console.log({ sameRun: store.load().registry.run.run_id === runId, entries: page.entries.length });
} finally { store.close(); }
```

Expected: `{ sameRun: true, entries: 2 }`. This short block checks lifecycle only, not
separate-process recovery. No adapter or authority is installed by this block.

- Use an **absolute regular local-file path** with a host-provisioned parent directory; no
  `:memory:`, URI or network filesystem. Only `{ path, mode, busyTimeoutMs? }` is accepted;
  optional `busyTimeoutMs` must be exactly `1000`. Do not supply `registry` with storage.
- `create` initializes a fresh run and refuses an initialized store (`STORE_ALREADY_INITIALIZED`);
  it never overwrites. Raw create-mode open may establish an empty layout, which requires
  explicit `store.init({ initialRegistry, logicalNow })` with a complete reducible genesis journal.
  Prefer the SDK for creation. `existing` requires an initialized valid file; missing is
  `STORAGE_UNAVAILABLE`, an empty Chord layout is `STORE_NOT_INITIALIZED`; corruption or
  unsupported versions never initialize, repair or fall back to memory.
- Existing construction validates and completes **effect-free** recovery before returning the SDK.
  Its declarative authority is loaded from storage, not rebootstrap input: do not pass
  `trustedHost.authoritySnapshot` when opening `existing`. Recreate `adapterRouter`, runtime
  policy, executable services and authenticated host ingress on every invocation. The durable
  policy clock uses `max(persisted logical floor, host time)`; effective rollback within a session
  fails closed. The floor does not discover real elapsed time: provide a trustworthy clock.
- **The embedding host MUST ensure one active scheduler runtime per run and stop/join the old
  process before recovery.** SQLite serializes raw CAS writes, not runtime ownership. No runtime lock,
  live-peer exclusion, fencing, automatic takeover or distributed scheduler is provided.
- Acknowledged state, results and journal commit together in one validated SQLite row (WAL,
  `synchronous=FULL`). A committed result survives and is not executed again. A durable
  `running`/`leased` task without committed result becomes `uncertain`, its operation `unknown`,
  and active/pending attempt records are removed. Even if the adapter returned or the effect
  never began, missing committed evidence is **not** safe-to-retry evidence. Recovery invokes
  zero adapters. Queued work, exact pending approvals and paused state survive; continuation
  still needs current policy checks, exact approval and fresh embedding-host authentication.
- Leaving uncertainty requires explicit evidence-backed human reconciliation; readmission is
  explicit where permitted, never blind redispatch. `close()` is synchronous/idempotent without
  implicit commits. Closing during an effect does not undo it; its later result write fails
  `STORE_CLOSED`, leaving the durable claim for quarantine on restart.

### Raw store and failure handling (trusted host only)

`openSqliteStore` is exported from the root, not `/sdk` or `/platform`. Raw open/load has no
scheduler or recovery. All methods are synchronous; use `try/finally` to close. `load()` returns
`{ registry, revision, commitId, logicalNow, storageVersion }`, detached and fully validated.
`compareAndCommit({ expectedRevision, nextRegistry, operation, logicalNow })` requires an exact
next revision, immutable journal prefix, one matching closing commit and a valid canonical
transition/reduction. The raw caller must build that evidence; it is not an admission API.
Prefer dedicated SDK operations. `readHistory({ afterOrdinal = 0, limit = 1024 })` returns
`{ revision, commitId, entries, hasMore }`; dense 1-based `journalOrdinal` follows array order,
not timestamps. Each page describes one read; later pages may observe later commits.

| Outcome | Required response |
|---|---|
| `{ ok: true, revision, commitId }` | Local COMMIT acknowledged, not proof of a remote effect. |
| `{ ok: false, code: 'STALE_REVISION', revision }` | Raw CAS wrote nothing; reload and explicitly re-plan. SDK transactions throw `STALE_REVISION`; callbacks/adapters are not auto-replayed. |
| Validation error / `STORAGE_UNAVAILABLE`, `commitStatus: 'not_committed'` | Rejected before COMMIT with confirmed rollback (or writer acquisition failed); reload before any explicit later retry, never infer permission to repeat an effect. |
| `COMMIT_OUTCOME_UNKNOWN`, `commitStatus: 'unknown'` | COMMIT attempted or rollback uncertain; retired handle/owner. Stop mutation/dispatch. Reopen and validate run ID plus proposed revision/commit ID and exact journal suffix/delta, including historical commits if later revisions exist. Exception is not rollback. Unresolved identity stays unknown. |
| `STORAGE_CORRUPT`, `UNSUPPORTED_STORAGE_VERSION`, `SCHEMA_MISMATCH`, `UNSUPPORTED_RUNTIME` | Abort; preserve evidence for operator review, no migration/repair/fallback. |
| `STORE_NOT_INITIALIZED`, `STORE_ALREADY_INITIALIZED`, `STORE_CLOSED` | Correct the explicit lifecycle; no implicit init, replacement or reopening. |

Storage exceptions are sanitized `TypeError`s with `code` and `path: '$'`; mutating operations
include `commitStatus` where applicable. Open/load failures need not have it. Storage codes are
not authorization `Decision` codes. Local acknowledgement resolution cannot resolve remote
effect truth. Protect SDK/store handles, database/WAL files, backups and full inspections as
privileged host capabilities; never expose a generic host-method dispatcher to actors.

### Data boundaries and limits

Credentials, tokens, passwords, private sessions, routers, callbacks, executable values and host
service handles **must not be persisted**. Constructor services/options are not serialized;
contracts reject functions, accessors, cycles, exotic objects and dangerous keys. That is **not a
secret detector**: application-authored strings/JSON in inputs, outputs or evidence can contain
secrets and will be persisted. Redact/avoid them before admission; scoped context is not content
redaction. There is no encryption, credential vault or cryptographic tamper protection.

Writes/reads synchronously validate the whole state/history: O(entire registry/history), with
1 MiB encoded bytes, depth 32, string length 16384, array length 1024 (including journal),
256 object keys, 16384 nodes and ID length 256; these are bounds, not capacity promises.
Writer lock waiting blocks for up to the configured 1000 ms. No compaction/migration exists.
FULL depends on SQLite/VFS/OS/filesystem/device sync behavior; Linux process SIGKILL tests are
not hardware power-cut tests. No exactly-once, staged effect acknowledgement, remote idempotency,
full Proof 2/3 or Level B promotion is claimed.

### Actual separate-process restart example

From `packages/core`, use a **new** absolute evidence directory on each invocation (the parent
must exist). Node/Bun executables must support `node:sqlite`; substitute your paths as needed:

```bash
B="$(command -v bun)"
node examples/process-recovery.mjs "$TMPDIR/chord-b7-node-evidence"
"$B" examples/process-recovery.mjs "$TMPDIR/chord-b7-bun-evidence"
node examples/process-recovery.mjs "$TMPDIR/chord-b7-node-bun-evidence" "$B"
"$B" examples/process-recovery.mjs "$TMPDIR/chord-b7-bun-node-evidence" "$(node -p process.execPath)"
```

The proof prints JSON with `gate: "B5 PASS"` (the proof's identifier, not a new product level).
Separate writer/reader PIDs are asserted, the old process exits/is joined before opening the next,
and the reader receives only the SQLite path, never a registry/snapshot. Approval continuation
uses the exact prepared attempt once after fresh host attestation; stale/missing sessions reject
three times. A second scenario SIGKILLs after a fsynced simulated external effect but before
acknowledgement: recovery makes it uncertain and subsequent cycles call zero adapters.
`summary.json`, per-scenario `first-process.json`/`second-process.json`, registry evidence,
SQLite files and `effects.ndjson` remain in the directory. Inspect them or regenerate; the ledger
is a local mock, not a remote business receipt. The example's trusted `attest` is not a login service.
Installed payload: run `node node_modules/@antistructured/chord/examples/process-recovery.mjs`
with the same new-directory argument. No CLI binary is installed.

Repository evidence and exact B7 verification commands are in
[`docs/internal/051-durability-guide.md`](../../docs/internal/051-durability-guide.md)
(repository-only, not shipped); implementation locators are `src/sdk/chord.js#createChord`,
`src/registry/owner.js#createStateOwner`, `src/runtime/recovery.js#recoverOwner`,
`src/runtime/storage/sqlite.js#openSqliteStore`, `src/storage/contract.js#validateNext`.
`#function` references are searchable source symbols, not generated HTML anchors.

---

## 052 local fenced-owner and actor mode

This is a **separate experimental opt-in**, not a changed `createChord` mode or a full Level B
promotion. Choose deliberately:

| Mode | Factory / format | Supported concurrency |
|---|---|---|
| Memory | `createChord()`; optional validated snapshot import | One host's live state; no crash persistence or cross-process ownership. |
| 051 legacy durable | `createChord({storage})` / `openSqliteStore`; `chord.local-store.v1`, table `chord_store` | **Exclusive sequential restart only**: host stops/joins the old scheduler before opening recovery. |
| 052 coordinated | `createCoordinatedChord` / `openCoordinatedSqliteStore`; `chord.local-store.v2`, table `chord_coordination`, protocol `chord.coordination.v1` | One fenced execution owner, authenticated actor processes and trusted standby/observers on **one machine**. |

**V1 and v2 layouts are incompatible; both cross-open directions reject. No migration, automatic
upgrade, snapshot-as-v2-recovery, clone/restore protocol or memory fallback exists.** V2 contains
unchanged v1 domain contracts/history plus separate linked coordination evidence; this does not
make its physical storage v1-compatible. `reduceTrace` alone reconstructs domain facts, not ownership.
Use the combined observer replay for v2. Exact task/attempt/outcome schemas remain unchanged.

### Host integration: acquire explicitly, pin identity, close explicitly

All imports below are public root exports. From the package directory, save this JavaScript block
as an `.mjs` file and run with Node or Bun (bare imports outside the package require local package
resolution). It demonstrates lifecycle and freshly host-attested **empty scoped reads**, not work
admission or a login service. The CLI below demonstrates actual IPC collaboration and effects.

```js
import { createCoordinatedChord, SCHEMA_VERSION } from '@antistructured/chord';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

if (!process.env.TMPDIR) throw new Error('Set TMPDIR to a private absolute local directory');
const dir = mkdtempSync(join(process.env.TMPDIR, 'chord-v2-guide-'));
const path = join(dir, 'run.sqlite');
const clock = { now: () => Date.now() }; // shared trusted local wall milliseconds
const c = createCoordinatedChord({
  storage: { path, mode: 'create', expectedIdentity: null },
  trustedHost: { clock }
}); // unacquired; no adapter lookup, recovery sweep or authority installation
let released = false;
try {
  const identity = c.observer.inspect().identity;
  // Provision this identity into trusted launch configuration, not actor request data.
  const identityFile = join(dir, 'identity.json');
  writeFileSync(identityFile, JSON.stringify(identity), { flag: 'wx', mode: 0o600 });
  const lease = c.owner.acquire({ expectedRevision: 0 });
  assert.equal(lease.lease.generation, 1);
  const expires_at = clock.now() + 60_000;
  c.admin.setAuthoritySnapshot({
    schema_version: SCHEMA_VERSION, run_id: identity.run_id, authority_revision: 0,
    principals: [{ principal_id: 'host-user', issuer: 'guide-host', kind: 'service',
      authenticated_at: 0, expires_at }],
    actors: [{ actor_id: 'reader', principal_id: 'host-user', kind: 'agent',
      roles: [], capabilities: ['work'], revoked_at: null }],
    grants: [], approvals: []
  }, { expectedRevision: c.observer.inspect().revision });
  const channel = {}; // local host-enrolled channel for this lifecycle example only
  const sessions = new Map([[channel, { binding_id: 'guide-reader', issuer: 'guide-host',
    principal_id: 'host-user', actor_id: 'reader', ...identity,
    authenticated_at: 0, expires_at, work_capability: 'work', work_requires_approval: false }]]);
  const ingress = c.createActorIngress({ authenticate: ch => sessions.get(ch) ?? null });
  const response = ingress.handleAuthenticated(channel, JSON.stringify({
    protocol_version: 'chord.actor-command.v1', operation_id: 'read-context', ...identity,
    expected_revision: null, correlation_id: null, causation_id: null,
    type: 'project_context', payload: {}
  }));
  assert.equal(response.ok, true);
  assert.equal(response.result.context.tasks.length, 0); // no grants means no task disclosure
  sessions.clear(); // revoke local enrollment; next request must authenticate afresh
  assert.deepEqual(c.observer.replayEnvelope(), c.observer.exportEnvelope());
  c.owner.release({ expectedRevision: c.observer.inspect().revision });
  released = true;
  c.owner.close(); // closing any port closes this factory, not an independent observer
  const pinned = JSON.parse(readFileSync(identityFile, 'utf8'));
  const reopened = createCoordinatedChord({
    storage: { path, mode: 'existing', expectedIdentity: pinned }, trustedHost: { clock }
  }); // observer/standby only: does NOT inherit the previous credential or recover work
  try {
    assert.equal(reopened.observer.inspect().envelope.coordination.lease.owner_id, null);
    assert.deepEqual(reopened.observer.replayEnvelope(), reopened.observer.exportEnvelope());
  } finally { reopened.observer.close(); }
  console.log({ acquired: true, released, emptyScopedRead: response.ok, replayMatches: true });
} finally { c.owner.close(); }
```

Expected: `{ acquired: true, released: true, emptyScopedRead: true, replayMatches: true }`.
The directory/evidence is retained. Do not delete a live database to reset ownership.

### Actual factories, ports and supported operations

`createCoordinatedChord({storage:{path,mode,expectedIdentity}, trustedHost:{clock}?, owner_id?,
adapterRouter?, runtimePolicy?})` returns **only** `{observer,owner,admin,createActorIngress}`.
`owner_id` defaults to a fresh launch UUID; it is nonsecret diagnostic identity, not authority.
There are no constructor authority/bootstrap grants. Resupply routers/policy/services and freshly
enrolled sessions at each construction. All canonical writes require an acknowledged current owner.

| Port | Exact members / usage |
|---|---|
| `owner` | `acquire({expectedRevision})`, `renew({expectedRevision})`, `release({expectedRevision})`, async `runCycle()`, `close()` |
| `observer` | `inspect()` → `{identity,revision,commitId,envelope}`, `exportEnvelope()`, `replayEnvelope()`, `readHistory({afterOrdinal,limit})`, `close()`; no acquisition/recovery/writes |
| `admin` (host-only) | `commitRun({expectedRevision,nextRegistry,audit_label?})`, `setAuthoritySnapshot(snapshot,{expectedRevision})`, `setCoordinationPolicy(policy,{expectedRevision,audit_label?})`, `reconcileTask(request)`, `readmitTask(taskId,{expectedRevision})` |
| factory `createActorIngress({authenticate})` | Uses private load/owner closures; returns `handleAuthenticated(channelContext,commandJSON)` and `attachChild(child)`; attachment returns `detach()` |
| root `createActorIngress({authenticate,load,commitCommand,clock?})` | Privileged low-level composition, not an actor constructor; prefer the factory-bound method |
| root `createActorClient(channel = process, {timeoutMs = null} = {})` | Actor-side inherited IPC facade: `sendCommand(command)` → Promise of canonical response, `close()`; one outstanding request and exclusive wrapper per channel, no database/SDK/admin/owner handle |

Root-only `openCoordinatedSqliteStore({path,mode,expectedIdentity,clock?})` has synchronous
`init()`, `load()`, `commit({expectedRevision,credential,change})`, `checkOwner({credential})`,
`checkDispatch({credential,dispatch})`, `readHistory({afterOrdinal,limit})`, `close()`.
Create requires explicit `expectedIdentity:null`; raw create needs `init()`. Existing requires
exact externally pinned `{run_id,incarnation_id}`. Raw `commit` tags are `acquire`, `renew`,
`release`, `admin`, `actor_command`, `runtime_claim`, `runtime_outcome`; these are validated
host plumbing, **not** actor RPC methods. A raw credential is bound to that handle's acknowledged
acquisition, never adoptable from disk. Use the factory rather than building raw candidates.
History defaults to `afterOrdinal:null` (includes genesis), `limit:1024`; nonnull ordinal is
exclusive. One page is a validated snapshot with paired domain/coordination records and `hasMore`.
No cross-page consistent-snapshot promise. Neither close method implicitly commits/releases.
The **entire v2 envelope** shares the existing 1 MiB / 16384-node / depth-32 / 1024-array /
256-object-key budgets; strings are at most 16384 characters, ordinary IDs 256, receipt/effect
keys 2048. Renewals, receipts and both histories consume capacity; none are pruned. Combined
replay revalidates domain prefixes and can be quadratic in history length, with synchronous
blocking and 1000 ms SQLite writer wait. No compaction/capacity guarantee or power-cut proof.

**Intentionally absent from the coordinated facade:** `registerSpec`, `registerSpecAndQueue`,
`queueTaskPackets`, `prepareAttempt`, `cancelTask`, legacy host handoff methods, pause/resume/
rejectApproval/cancelRun, `_invalidatePendingAttempt`, grant/approval shaping helpers, router/policy
setters, snapshot import and legacy owner.install. Do not call guessed SDK conveniences or fall
back to the legacy constructor. Use exact actor commands and explicit host authority/policy
installation as shown by the public CLI; `admin.commitRun` is privileged legal maintenance, not
an actor dispatcher or an admission replacement recommended for routine work. Current runtime
policy supports concurrency caps, **not** legacy automatic retry/dead-letter behavior: no-work,
deferred and no-adapter responses do not commit diagnostics or silently schedule retries.
`runCycle` result commit returns `{ok:true,revision,commitId,result:{task_id,attempt_id,
classification:'result'|'uncertain'}}`, not the legacy SDK shape. Read actual results through
observer or authorized outcome commands; `classification:'result'` means persisted result, not
necessarily successful real-world work.

### Leases, takeover and unknown outcomes

- Use an absolute regular local file in a trusted private parent directory; no network filesystem,
  live rename/replacement, concurrent backup clone or restore. Pin identity outside the database.
  Restored/cloned generations are not globally monotone; stop all old processes and retire downstream
  namespaces before any separately designed restore. No supported identity-edit/migration procedure exists.
- One trusted **shared local wall-millisecond clock** (normally Date.now) supplies all owners and ingress.
  `trustedHost.clock.now()` must be synchronous/nonreentrant/nonmutating and return a nonnegative safe
  integer. Sampling occurs after SQLite writer-lock acquisition and again before authorization/update;
  rollback below persisted floor or local observation fails `CLOCK_ROLLBACK` without clamping and
  permanently loses this owner's authority. Clock stop/jumps affect availability and do not prove
  nonexecution. Halt/review after clock faults; independent machine clocks are unsupported.
- The owner lease is fixed **30,000 ms**, valid only for `now < expires_at`. Acquire increments the
  stored safe-integer generation and atomically quarantines prior dispatched work. Release also
  atomically quarantines active work before vacating; it is not effect cancellation. A live valid owner
  makes standby acquisition fail `OWNER_HELD`. There is no PID/death shortcut or force-acquire.
- Renew explicitly **before expiry**, using the current inspected run revision; host schedules reminders
  with margin for blocking work. No automatic renewal timer. Renewal must strictly extend expiry:
  tied-time renewal can return `LEASE_NOT_EXTENDED`. A stale revision requires explicit replanning,
  not automatic callback replay. Renewals/unrelated actor commits do not poison a valid pending
  attempt merely by advancing the run revision; current authority/attempt/lease/lifecycle still apply.
- One acknowledged credential lasts for that closure/handle's lifetime. Loss/expiry, clock fault,
  unknown acknowledgement, unavailable/corrupt storage or close cannot be cured by read/reopen/token
  adoption. After release/loss construct a **fresh handle** and acquire a fresh generation. Graceful
  owner transfer is explicit release then fresh acquire, with no promised successor. Actor handoff is
  an authorized context exchange, not execution-owner transfer or a grant.
- Drain/join cycles where possible before release/close; close neither drains nor cancels effects.
  Acquisition/release quarantine leaves dispatched operations `unknown`, tasks `uncertain`, and old
  callbacks unable to mutate canonical state. Expiry is never evidence the effect did not execute.
  Only explicit evidence-backed human reconciliation can resolve uncertainty; eligible readmission
  requires `confirmed_not_executed`, current grants and an explicit host call. Consumed approvals stay consumed.
- Confirmed pre-COMMIT rollback is `not_committed`. Attempted-COMMIT exceptions or failed rollback
  are `COMMIT_OUTCOME_UNKNOWN` / `unknown`: retire, stop dispatch, inspect exact committed history
  with a separate observer; **do not blindly retry acquire/renew/release or an effect**. Knowing a
  lifecycle commit happened does not revive its lost closure. Never compensate an unknown result
  commit with an uncertainty write. Local receipt resolution cannot resolve remote effect truth.

### Actor protocol and host authentication responsibilities

The host chooses trusted child launch configuration and enrolls the **exact dedicated inherited IPC
channel object** in a private session map before accepting messages. `authenticate(channelContext)`
is synchronous and resolves fresh enrollment on **every** read/write/duplicate; reject disconnected,
expired, revoked, foreign and old-restart sessions. Return a host-constructed binding with exactly
`{binding_id,issuer,principal_id,actor_id,run_id,incarnation_id,authenticated_at,expires_at,
work_capability,work_requires_approval}`. Never accept it from actor JSON or reassign the stable
binding ID to another subject. Principal.kind human is not login: authenticate the human out of
band before attesting approval/reconciliation. Stored principals/receipts are not sessions.

`attachChild` accepts string messages containing one bounded JSON document, checks the **1 MiB
application byte limit before JSON.parse**, then validates exact shapes/recursive budgets. Node/Bun
IPC still deserialize transport data first; this is not hostile-OS memory isolation or a network
framing/rate-limiting service. Host must enforce launch/enrollment, disconnect/revoke/cleanup,
message-volume/resource limits and dedicated channel routing. Client has one pending command per
channel and rejects a second wrapper with `ACTOR_CHANNEL_IN_USE`. There is no automatic retry.
`createActorClient(channel, {timeoutMs: 5000})` explicitly opts into local acknowledgement timeout;
`ACTOR_COMMAND_TIMEOUT`, send failures, close/disconnect and `ACTOR_PROTOCOL_ERROR` do **not** prove
non-commit. Recover original write receipts only with fresh authentication and the unchanged command.
Default timeout is null (unbounded); non-null values must be integer milliseconds in `1..2147483647`.
Close/disconnect retires that wrapper and removes its listeners;
a replacement uses a fresh session generation. `detach()` removes only the host listener; close/disconnect/
join the child separately. Do not attach a generic `sdk[method](payload)` handler or send database
paths, admin/store/owner references, credentials, callbacks or grants as capabilities to actors.
Same-OS-user arbitrary hostile code can open files or import privileged host APIs; dedicated
JSON IPC is **not** a filesystem/OS sandbox.

### IPC wire compatibility (052A correction)

The JS facade and `handleAuthenticated(context, canonicalCommandJSON)` remain canonical. The
**default client IPC bytes intentionally change**: exact Sigil-validated request frame
`{protocol_version:'chord.actor-ipc-request.v1',session_id,request_id,command}` and response frame
`{protocol_version:'chord.actor-ipc-response.v1',session_id,request_id,response}` wrap unchanged
canonical objects. IDs are fresh UUIDv4s: session per wrapper, request per send (including retries
and repeated reads). They are delivery metadata, not credentials or durable receipt inputs.
Injected transports/mocks must echo both; there is **no silent unframed fallback**. The 1 MiB and
recursive budgets include the wrapper, so near-limit canonical objects may not fit framed IPC.

`attachChild` also retains an explicit legacy raw host edge for documents whose protocol is
`chord.actor-command.v1`; those peers receive raw canonical responses and must manage their own
correlation/retirement. This does not make legacy raw peers safe for wrapper replacement. Malformed
or unsupported transport frames are dropped without dispatch; they cannot authenticate or acknowledge.
Framed clients ignore raw, missing/unknown delivery identities, duplicates and stale generations.
A matching delivery with invalid frame/response/result/command identity rejects locally with
`ACTOR_PROTOCOL_ERROR`; it is not a canonical denial or a non-commit claim. Success results are
validated against the pending command type and all five canonical identity fields. Rejections have
no run/incarnation fields; null operation identity requires null correlation/causation and is accepted
only inside the matching delivery frame.

Every command has exactly `{protocol_version:'chord.actor-command.v1',operation_id,run_id,
incarnation_id,expected_revision,correlation_id,causation_id,type,payload}`, including explicit nulls.
Writes require integer `expected_revision`; reads permit null/latest or exact revision. Actor JSON
cannot choose principal/grants/capability/owner/generation/host clock or arbitrary host methods.

| `type` | Exact payload | Semantics |
|---|---|---|
| `submit_work` | `{packets:TaskPacket[]}` | Nonempty all-or-nothing batch under preinstalled exact grants and host binding's fixed work capability/approval requirement; mints no grant. |
| `project_context` | `{}` | Current-authorized scoped context plus visible handoffs/approval requests; no raw registry. |
| `propose_handoff` | `{task_id,to_actor_id,payload,expires_at}` | Sender derived from binding; stored task scope, both parties' exact fixed grants, one current policy rule and bounded TTL. |
| `respond_handoff` | `{handoff_id,action:'accept'|'reject',reason:string|null}` | Exact authenticated target, unresolved/unexpired proposal, same task/policy revision and both parties currently authorized. |
| `request_approval` | `{task_id,reason,expires_at}` | Own task, exact request grant and policy; reserve/reuse pending attempt, pause durably; no approval/effect issued. |
| `respond_approval` | `{approval_request_id,decision:'approve'|'reject',reason:string|null}` | Fresh distinct human, current exact grants/policy, unchanged unexpired reservation; kernel constructs approval; no adapter call. |
| `observe_outcomes` | `{task_ids:Id[]}` | At most 100 requested IDs, currently authorized results/coordination statuses; unauthorized and absent IDs omitted identically. |

Policy genesis is deny-by-absence: revision 0, empty rules. Host installs exact-next policy revision
with `handoffs:[{rule_id,from_actor_id,to_actor_id,scope,actions,max_ttl_ms}]` and
`approvals:[{rule_id,requesting_actor_id,approver_actor_id,scope,max_ttl_ms}]`.
Scopes match stored task fields exactly; TTL is 1..30,000 ms; ambiguous rules reject. Fixed grants
are `chord.handoff.propose/respond` and `chord.approval.request/respond`. Policy change invalidates
old pending responses; no automatic grant/ownership transfer. Handoff visibility is not task-result
visibility. Approval is consumed only at exact attempt dispatch, not on request/response.

Success responses include identity, original revision/commit ID, owner summary and result.
Failures are sanitized `{protocol_version,operation_id,correlation_id,causation_id,ok:false,code,
commit_status:'not_committed'|'unknown'}`. For a lost write acknowledgement, retain the **entire
original envelope** and retry only through a fresh authenticated/current-owner path. After current
owner/auth/visibility checks, exact duplicates return the **original historical success response**
before rejecting the command's now-stale revision, with no new revision/receipt/effect. Its old owner
summary is not present authority. Changed payload/revision/correlation under the same subject's ID
is `OPERATION_ID_MISMATCH`. Known denial can be explicitly replanned with a new ID; unknown
acceptance must not silently become a new command. Reads write no receipts/floors/diagnostics.

### Opt-in downstream context and the remaining unsafe window

A trusted router registration `{adapter,execution_context:'chord.execution-context.v2'}` adds frozen
`context.coordination` containing `{protocol_version,run_id,incarnation_id,owner_id,generation,
owner_lease_expires_at,dispatch_revision,operation_id,attempt_id,idempotency_key}`. Unwrapped
adapters retain the legacy exact packet/shallow context; no default fence enforcement is supplied.
The stable key is `JSON.stringify(['chord.effect.v1',incarnation_id,run_id,operation_id])`, not the
actor-command ID or a new per-attempt key. Downstream must atomically reject lower generations in
namespace `(incarnation_id,run_id)` and deduplicate the stable operation key with **semantic business
payload** mismatch detection, not attempt/time metadata. Context propagation alone does neither.

**The fresh final database check and external callable/effect are not atomic.** Another process
can take over after the check; an old unfenced adapter can still enter and physically act. This was
actually reproduced by P7, while its canonical completion was rejected without writes. A cooperating
service rejects lower tokens only **after it has observed a higher token**; delayed old requests can
still be accepted before that. Downstream fencing/idempotency are required where stale physical
effects are unacceptable, and do not remove every distributed uncertainty. No universal stale-dispatch
prevention, exactly-once effect, automatic remote fence advancement or staged-ack recovery is claimed.

### Public multiprocess CLI

From `packages/core`, use a **fresh absolute** evidence directory (parent must exist). Node/Bun must
support `node:sqlite`; resolve your real Node executable rather than a PID-changing launcher:

```bash
N="$(node -p process.execPath)"
B="$(command -v bun)"
"$N" examples/two-process-coordination.mjs "$TMPDIR/chord-p8-node-node" "$N" "$N"
"$N" examples/two-process-coordination.mjs "$TMPDIR/chord-p8-node-bun" "$N" "$B"
"$B" examples/two-process-coordination.mjs "$TMPDIR/chord-p8-bun-node" "$B" "$N"
"$B" examples/two-process-coordination.mjs "$TMPDIR/chord-p8-bun-bun" "$B" "$B"
```

The public-export-only example asserts simultaneously live owner, meaningful independent actor and
trusted standby; standby gets `OWNER_HELD`/`NOT_OWNER`. It commits authorized handoff, Bob's work,
a separately host-attested local human approval, two actual file effects and two results. Each pair
finishes at revision **14**, **6 receipts**, **2 attempts/effects/results**, complete combined replay
and independent reopen equality, and joined child exits. Inspect `evidence.json`, `processes.json`,
`actor-transcript.json`, `final.json`, `replay.json`, `reopened.json`, `effects.ndjson` and
`alice.effect.txt` / `bob.effect.txt`. The proof clock is deliberately fixed at 100; it demonstrates
collaboration, not real-time lease expiry, a real human login or an arbitrary remote provider.
Run a locally resolved payload at `node_modules/@antistructured/chord/examples/two-process-coordination.mjs`
with the same arguments; there is no installed binary. P8 verified dry-run-listed payload copies,
**not an npm install or tarball extraction**. No publication is authorized.

Repository-only API/commands/evidence and P9 handoff:
[`052 developer guide`](../../docs/internal/052-developer-guide.md). Current search locators:
`src/sdk/coordinated-chord.js#createCoordinatedChord` / `runCycle`,
`src/registry/coordinated-owner.js#createCoordinatedOwner`,
`src/runtime/storage/coordinated-sqlite.js#openCoordinatedSqliteStore` / `commit` / `checkDispatch`,
`src/coordination/runtime.js#assertAttempt` / `outcomeCandidate`,
`src/coordination/history.js#reduceCoordinationTrace`,
`src/runtime/actor-ingress.js#createActorIngress`, `src/runtime/actor-client.js#createActorClient`.
These are function/member search locators, not generated HTML anchors. Earlier 052 reports are
stage-specific history: P2 is normative design plus P3–P5 implementation addenda, P6/P7 measured
proofs; their then-unsupported branches/package exclusions are not current API claims.

## Experimental adapter interoperability (053)

The additive `./interop` entry point provides a small, versioned, provider-neutral execution protocol
for independent tools, agents and services. It does not add a scheduler, authority evaluator,
provider registry or second canonical store. This standalone block checks bridge registration and
resource lifecycle through the existing 052 opt-in, not work execution. Set `TMPDIR` to a private
existing absolute scratch directory, save as `.mjs` with local package resolution, and run on Node/Bun.
For the full authority/admission/result path run `examples/adapter-interop.mjs` below.

```js
import { createCoordinatedChord } from '@antistructured/chord';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADAPTER_CONTEXT_VERSION,
  createAdapterBridge,
  createAdapterServer,
  createMemoryTransportPair,
  createMockAgentAdapter
} from '@antistructured/chord/interop';

// Scratch demonstration only. Provision and retain a private directory in production.
if (!process.env.TMPDIR) throw new Error('Set TMPDIR to a private absolute local directory');
const path = join(mkdtempSync(join(process.env.TMPDIR, 'chord-adapter-guide-')), 'run.sqlite');
const clock = { now: Date.now };

const adapter = createMockAgentAdapter();
const pair = createMemoryTransportPair();
const server = createAdapterServer({
  advertisement: adapter.advertisement,
  handle: adapter.handle,
  channel: pair.right
});
const bridge = createAdapterBridge({
  advertisement: adapter.advertisement,
  transport: pair.left,
  timeoutMs: 5000
});

const chord = createCoordinatedChord({
  storage: { path, mode: 'create', expectedIdentity: null },
  trustedHost: { clock },
  adapterRouter: {
    fallback: { adapter: bridge, execution_context: ADAPTER_CONTEXT_VERSION }
  }
});
try {
  chord.owner.acquire({ expectedRevision: 0 });
  const noWork = await chord.owner.runCycle(); // no authority or work was installed
  if (!noWork.skipped) throw new Error('Expected no work');
  chord.owner.release({ expectedRevision: chord.observer.inspect().revision });
  console.log({ registered: true, dispatched: false });
} finally {
  bridge.close();
  server.close();
  pair.close();
  chord.owner.close();
}
```

The bridge carries the kernel-captured task/attempt/operation identity and stable effect key, matches
replies by fresh session/request identity, ignores stale/duplicate/reordered replies and rejects
malformed frames locally. Timeout, close and cancel are local lifecycle events, not proof of effect
absence. The participant-side server validates envelopes and optionally deduplicates by the stable
effect key; its cache is not durable and does not create exactly-once semantics. Advertisement is
descriptive, never an authority grant. The existing kernel still schedules, fences and commits.

`bridge.cancel({ target_request_id })` selects the exact pending wire request; alternatively use
`{ attempt_id }`, `{ operation_id }` or `{ task_id }`. The selector is **not** `{ request_id }`.
Cancellation acknowledges delivery to an active handler, not effect cancellation. `bridge.close()`
retires the local bridge and pending waits without closing the transport or stopping the handler.
`await bridge.shutdown()` attempts a bounded protocol handshake and then closes locally; its `true`
return does not prove acknowledgement, effect completion or participant process exit. Close the
server/channel separately and join any child process. Drain/join work before kernel close/release
where possible; neither action cancels physical effects.

Run the public-export-only example from `packages/core`:

```bash
bun run examples/adapter-interop.mjs
```

Expected output:

```text
{"ok":true,"adapter":"chord.mock-agent","protocol":"chord.adapter-protocol.v1","task_status":"completed","summary":"mock-agent:task-interop","replay_matches":true,"server_executions":1}
```

### Adapter conformance

`runAdapterConformance({ adapter?, fixture?, action?, timeoutMs? })` is framework-neutral preview
verification tooling. The existing `{ advertisement, handle }` adapter API is preserved. Handler checks
use the supplied handler behind Chord's server; they **do not** certify a third-party wire endpoint.
Each check includes `id`, `category`, `scope`, `status`, `expected`, `actual`, and a stable failure
`code` or skip `reason`. Errors omit participant messages, stacks, causes and payloads.

`ok` remains zero observed failures for compatibility. Always inspect `verdict`: `FAIL` on any failure,
`INCOMPLETE` on any skip, and `PASS` only with no skips/failures. `complete` is false with skips;
`certification` is always false. Built-in checks are labeled `chord-harness`, never supplied-participant
coverage. Kernel historical replay/stale-owner fencing and portable registration are not inferred
from wire replies and remain explicit skips. This is not independent certification or an authority grant.

To test your actual participant, supply a **fixture**:

- `advertisement`: its public descriptor.
- `connect({ channel, timeoutMs })`: synchronously attach your real participant/server to this
  EventEmitter-like transport (`on/off('message', listener)`, `send(JSON string, callback)`,
  `connected`), returning `{ close(), release?() }`. Use public `createAdapterServer` or your own wire
  implementation. Each scenario gets a fresh endpoint. `close()` must synchronously retire listeners,
  timers, held effects and connections, including failure paths; allocation failure must self-clean.
- `actions: { completed?, failed?, blocked?, pending? }`: names of **predefined safe, in-memory**
  operations producing those outcomes. Missing actions skip their scenarios; there is no reference
  adapter substitution. `pending` must wait until session `release()` or cleanup.
- `capabilities: { cancel: true }` opts into active cancel acknowledgement plus release/late-result
  checking. It does not mean cancellation prevents an effect. Unsupported cancellation is skipped.
- Optional `createBridge({ advertisement, transport, timeoutMs })`: your bridge factory with Chord's
  public bridge interface. Synthetic response identity/version/shape, correlation/reordering/duplicates,
  old-session replacement, concurrency, timeout, close/disconnect, cancel/late-result and no-retry checks
  then say `supplied-bridge`. Without it these checks say `chord-harness`. A bridge-only fixture
  `{ createBridge }` is also supported; no participant descriptor/endpoint is invented and those
  participant checks remain skipped.

Participant checks send real describe, completed/failed/blocked, malformed/incoherent execute,
shutdown and optional held/cancel/timeout requests through that supplied endpoint. Response polling
and bridge waits are bounded; the runner does not retry. In-process synchronous hangs cannot be
preempted: run untrusted fixtures in an externally supervised disposable process. Never use production
credentials/effects: adversarial requests could trigger a defective participant. The runner passes
no SDK/admin/store/registry/grant handle to fixtures. Descriptor compatibility installs no grants.
Neither the in-memory sequential server cache nor a successful result proves durable semantic
idempotency, concurrent effect coalescing, physical nonexecution, or exactly-once execution.

```js
import { createMockAgentAdapter, runAdapterConformance } from '@antistructured/chord';

const report = await runAdapterConformance({ adapter: createMockAgentAdapter(), timeoutMs: 1000 });
if (!report.ok || report.verdict !== 'INCOMPLETE' || report.certification !== false) {
  throw new Error('Unexpected conformance report');
}
console.log({ ok: report.ok, verdict: report.verdict, certification: report.certification });
```

Run the public-export-only conformance example:

```bash
bun run examples/adapter-conformance.mjs
```

Expected output: `{"ok":true,"certification":false,...}` with zero observed failures for the mock
agent, local tool and consumer fixture; their verdicts remain **INCOMPLETE**. The complete public-only
fixture example prints every check. See current [conformance reverification](../../docs/internal/054-adapter-conformance-reverification.md)
and the preserved [historical conformance report](../../docs/internal/054-adapter-conformance.md).

See [protocol design](../../docs/internal/053-adapter-protocol.md),
[runtime](../../docs/internal/053-adapter-runtime.md),
[effect safety](../../docs/internal/053-effect-safety.md),
[reference adapters](../../docs/internal/053-reference-adapters.md),
[consumer integration](../../docs/internal/053-consumer-integration.md),
[conformance](../../docs/internal/053-protocol-conformance.md) and
[developer guide](../../docs/internal/053-developer-guide.md).

---

## What the SDK guarantees

The guarantees below describe the **legacy `createChord` SDK**, exercised by the retained canonical
workflow. They do not turn a v2 stale-owner/attempt rejection into an uncertainty write or require
v2 global run-revision equality during an in-flight call; see the separate 052 guide above.

Each item below is enforced in code and pinned by a named test in the repository suite
(Block 054 Pass 3 reverification recorded `448 pass / 0 fail / 1777 expect() calls / 31 files`; Block 052 P8 historically measured `356 pass / 0 fail / 26 files`; Block 051 historically measured `275 pass / 0 fail / 21 files`; Block 050 historically measured
`166 pass / 0 fail / 1418 expect() calls / 15 files`).

- **Deterministic, fail-closed authority evaluation.** Three stages — `admit`, `dispatch`,
  `commit` — no mutation, no I/O, no implicit clock.
  (`packages/core/src/platform/authorization.js#evaluateAuthority`)
- **Exact scope equality.** A grant must match the stored task field-by-field: run, project, phase,
  task, target entity and resource. An active deny always beats an allow.
  (`packages/core/src/platform/authorization.js#evaluateAuthority`)
- **Attempt-bound, consumed approval.** An approval must match the task revision, attempt and
  scope, must be unconsumed, and is consumed at dispatch and re-checked at commit. Self-approval is
  structurally impossible. (`packages/core/src/platform/authorization.js#evaluateAuthority`)
- **Atomic admission.** A batch of packets is admitted or it is not; one denial registers no
  member. (`packages/core/src/sdk/chord.js#queueTaskPackets`, `packages/core/src/sdk/chord.js#mutate`)
- **Commit-time re-authorization.** After the adapter returns, authority is re-evaluated against
  the attempt's captured grants, approval and lease. Staleness yields `uncertain`, never a guess.
  (`packages/core/src/platform/runtime-loop.js#runRuntimeCycle`)
- **Post-dispatch ambiguity is quarantined.** An ambiguous outcome is never blind-retried and
  never dead-lettered; it exits only through evidence-backed human reconciliation.
  (`packages/core/src/platform/recovery-policy.js#isRetryEligible`, `packages/core/src/platform/reconciliation.js#reconcileTask`)
- **Committed-fact history and zero-effect replay.** Every accepted mutation appends a versioned
  commit with a computed state delta; the history reduces back to canonical state invoking no
  adapter. Incomplete, foreign or duplicate history is refused.
  (`packages/core/src/registry/owner.js#createStateOwner`, `packages/core/src/platform/trace-reducer.js#reduceTrace`)
- **Detached reads and private state.** Returned state is a deep clone; a rejected candidate changes
  no collection and no event. (`packages/core/src/registry/owner.js#createStateOwner`)

The host remains responsible for authentication, authority and approval truth, credential custody,
receipt verification, adapter correctness and filesystem/backup operations. Legacy v1 runtime exclusivity
is host-enforced; separate v2 uses explicit owner acquisition under the restrictions above.

---

## What Chord does not guarantee

- No multi-machine coordination, distributed consensus or automatic takeover/renewal daemon.
  Legacy v1 SQLite CAS/restart has no scheduler exclusion; v2 adds one local fenced owner with
  authenticated multiprocess actor commands, not two simultaneously valid execution owners.
- No exactly-once external effects. Chord distinguishes *requested*, *dispatched* and
  *confirmed*; cancellation cannot undo a dispatched effect.
- No cryptographic evidence. Records are structurally checkable in-process and unsigned.
- No sandboxing of hostile in-process adapters, and no authentication of principals or proof
  that a human approved a request — Chord verifies the attestation the host hands it.
- No automatic secret removal. Context filtering is authorization-scoped, not content
  redaction — related authorized data and full host snapshots can contain supplied inputs,
  outputs and authority metadata.
- No deterministic model generation, no recovery of missing history, no operator console or
  approval UI, no network surface, no multi-tenant service, and no stable 1.0 API.

---

## Curated payload

`packages/core/package.json` ships a curated subset. The npm payload contains:

| Path | Contents |
|---|---|
| `src/**/*.js` | The runtime source, minus `src/verify-runtime.js`. |
| `examples/quickstart.mjs` | The quickstart above, verbatim. |
| `examples/cross-actor-workflow.mjs` | The canonical governed workflow. |
| `examples/process-recovery.mjs` | Separate-process approval continuation and SIGKILL quarantine proof. |
| `examples/two-process-coordination.mjs` | Public-export-only simultaneous owner/actor/standby proof with scoped handoff, human approval and two file effects. |
| `examples/adapter-conformance.mjs` | Public conformance report for the mock agent and local tool adapter. |
| `examples/adapter-interop.mjs` | Kernel → adapter bridge → memory transport → adapter server → mock agent, with canonical result and replay equality. |
| `README.md`, `INTEGRITY.md`, `CHANGELOG.md` | This file, technical boundary notes and migration guidance, candidate release notes. |
| `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.md` | Legal notices. |
| `package.json` | The manifest (always included). |

Not shipped: the test suite, the development verifier (`src/verify-runtime.js`), internal audits and
block reports, and editor files. They are repository-only.

---

## Development

From the repository root:

```bash
cd packages/core
bun install --frozen-lockfile
bun test                                        # full Bun suite; counts belong to a measured run
bun run src/verify-runtime.js                   # exit 0
bun run examples/quickstart.mjs
bun run examples/cross-actor-workflow.mjs
bun run examples/adapter-conformance.mjs
npm pack --dry-run --ignore-scripts
```

`npm test` invokes the same Bun suite; it is not a separate Node test suite. There is no lint script.
Current local durability, examples and consumer-like payload checks are measured on Linux
Node.js v24.22.1 and Bun 1.4.3, both using lazily loaded `node:sqlite#DatabaseSync`. These
are measured versions, not minimum versions or all-platform certification. Memory-only use
does not load SQLite. Durable requests without that binding fail `UNSUPPORTED_RUNTIME`,
never fall back to memory. Earlier preview checks used Node 24.18.1/Bun 1.3.14.
Use `command -v bun` to resolve the Bun executable in the examples above.

---

## License and third-party notices

- **Apache License 2.0** for the first-party code — see [LICENSE](LICENSE). Copyright 2026 Antistructured Labs LLC.
- **SigilJS** (`@weipertda/sigiljs@0.18.0`) is the only runtime dependency. It is MIT-licensed,
  separately installed and not bundled; Apache-2.0 does not apply to it. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- These describe the checked-in license and notices, not independent legal clearance or publication permission.
- The configured origin and manifest repository identify `https://github.com/antistructured/chord`; matching metadata is not registry ownership verification.
