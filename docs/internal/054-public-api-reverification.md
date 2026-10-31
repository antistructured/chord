# Block 054 — Public API reverification

## Pass

**054 Pass 2 — COMPLETE; Next Pass 3 READY.** This is current API verification, not Pass 3 implementation or release approval. Parent [Pass 1 disposition](054-reliability-disposition.md) explicitly permits bounded **UNRESOLVED P2** deferral. No historical reliability cause is inferred here.

Historical canonical audit: [054-public-api-audit.md](054-public-api-audit.md). Its original 63/28 export measurements and subsequent 64/29 addendum remain intact. This separate report is the current-pass evidence; historical COMPLETE labels do not execute or close the new sequential passes.

## Agent

`api-review-agent` (delegated subagent), only Pass 2.

## Files inspected

- `packages/core/package.json`; root, SDK, platform and interop entry modules; `src/types/index.js` (JSDoc only, no runtime exports).
- `src/sdk/{chord,coordinated-chord}.js`; `src/runtime/{actor-client,actor-ingress,actor-transport}.js`; v1/v2 SQLite stores.
- `src/interop/{adapter-protocol,adapter-bridge,adapter-server,conformance,reference-adapters,memory-transport}.js` (conformance interface and representative adapter/protocol/lifecycle checks; not an independent Pass 3 safety certification).
- Platform queue, router, policy, authorization, journal/audit and trace reducer; snapshot/query wrappers and actual grant installation path in `chord.js`.
- Package README, historical 054 public audit, 053 consumer/developer guides; public quickstart, cross-actor, adapter examples via execution in fresh consumer-like payload.
- Existing developer-API, architecture, canonical, adapter, actor/IPC, coordinated storage/dispatch/adversarial and storage test gates listed below.

## Files changed

- Added `docs/internal/054-public-api-reverification.md` (this report).
- Additive correction to `packages/core/README.md`: exact cancellation selector, shutdown/transport ownership semantics, and explicit limits of the inherited conformance runner. No runtime/test implementation, manifest, version, dependency or historical report changed.
- Scratch-only entry hashes, copied dry-run payload, probes, execution logs and command ledger: `/home/d/.hermes/cache/scratch/054-p2-api/`. No old external consumer or `/tmp/opencode` artifact touched.

Entry HEAD: `72f96ab6cdc9d6948ffb7eacba527cc27a32a8be`. Entry inventory: 603 files from `git ls-files --cached --others --exclude-standard`; SHA-256 values in `entry-hashes.json`. Historical API report hash: `c8839e37a0003ae98952086814b5dfcf3d35869b3a28030a4920b5d01b2d5ed4`. Final preservation comparison is against these entry bytes, not HEAD.

## Observed outcomes

### Live export enumeration and classification

Node **v24.22.1** (`/home/d/.volta/tools/image/node/24.22.1/bin/node`) and Bun **1.4.3** (`/home/d/.bun/bin/bun`) independently import the same bare package paths and enumerate identical symbols and factory members. Actual counts: root **64**, SDK **1**, platform **22**, interop **29**. These are experimental public-preview surfaces, not stable APIs. “Supported preview” below means the documented ordinary workflow is usable within stated preview limits; it is not a stability or full Level B promotion.

The following groups partition the root exports; SDK is its `createChord` subset, platform is the privileged group of 22 below, and interop is the 29-member experimental group below.

| Classification | Actual exports |
|---|---|
| Public supported preview (trusted embedding host) | `createChord`, `SCHEMA_VERSION` |
| Public experimental preview (coordinated factories / actor IPC; trust overlay below) | `createCoordinatedChord`, `createActorIngress`, `createActorClient`, `openSqliteStore`, `openCoordinatedSqliteStore` |
| Trusted-host privileged plumbing (root and /platform) | `appendRegistryEvent`, `canonicalProjection`, `computeBackoffDelayMs`, `createAdapterRouter`, `createDeterministicAuditReport`, `createRuntimePolicy`, `createTaskQueue`, `dequeueReadyTask`, `diffTraces`, `enqueueTask`, `leaseTaskEntry`, `listQueuedTasks`, `listRegistryEvents`, `markQueueEntryStatus`, `reduceTrace`, `replayDeadLetterTask`, `replayNoSideEffects`, `replayRegistryJournal`, `resolveAdapter`, `runRuntimeCycle`, `scheduleTaskRetry`, `selectReadyTask` |
| Trusted-host snapshots / unscoped queries (root) | `exportRegistry`, `importRegistry`, `listDeadLetterTasks`, `queryArtifacts`, `queryDomains`, `serializeRegistry` |
| Public experimental preview (/interop and root) | `ADAPTER_CONTEXT_VERSION`, `ADAPTER_DESCRIPTOR_VERSION`, `ADAPTER_KINDS`, `ADAPTER_MESSAGE_TYPES`, `ADAPTER_PROTOCOL_VERSION`, `AdapterAdvertisement`, `AdapterCancelRequest`, `AdapterCancelResponse`, `AdapterContext`, `AdapterDescribeRequest`, `AdapterDescribeResponse`, `AdapterErrorResponse`, `AdapterExecuteRequest`, `AdapterExecutionContext`, `AdapterResultResponse`, `AdapterShutdownRequest`, `AdapterShutdownResponse`, `adapterCompatibility`, `adapterError`, `assertAdapterCompatibility`, `createAdapterBridge`, `createAdapterServer`, `createLocalToolAdapter`, `createMemoryTransportPair`, `createMockAgentAdapter`, `parseAdapterWire`, `runAdapterConformance`, `validateAdapterExecuteRequest`, `validateAdapterResponse` |

Trust is an overlay, not an alternative import permission: `createCoordinatedChord`, both stores and root/factory `createActorIngress` are privileged host construction. `createActorClient` is the bounded actor-facing client; bridge/server are transport plumbing and **not** authentication. All `createChord()` services operate inside the trusted host, including grant/approval shaping, context projection and lifecycle. Passing JSON to host admin does not turn it into an authenticated actor API. Never expose the SDK object or a generic method dispatcher.

**Internal:** owners, `evaluateAuthority`, canonical `ActorCommand`, IPC frame contracts, `TrustedBinding`, registry construction, execution preparation, coordination reducer and storage version constant are absent from root. Six negative bare subpaths (`src/index.js`, `src/registry/owner.js`, `src/runtime/actor-transport.js`, `src/contracts/sigils.js`, `src/interop/conformance.js`, `coordination`) reject on both runtimes. Node reports `ERR_PACKAGE_PATH_NOT_EXPORTED`; Bun reports `ERR_MODULE_NOT_FOUND`. Bun permits importing `package.json` despite its absence from exports; Node rejects it. This is a runtime metadata-resolution difference, not source leakage or a supported fifth entry point. Source files are shipped and can be accessed by absolute/relative filesystem paths: exports are not a security sandbox.

**Deprecated/deferred:** no live export is marked deprecated; v1 remains documented for exclusive sequential restart. V1/v2 migration, unframed fallback in the framed client, automatic owner renewal/takeover, hosted provider integration and stable ABI are deferred/unsupported, not silently emulated.

### Factory member enumeration

- **legacy (39):** `_invalidatePendingAttempt`, `cancelRun`, `cancelTask`, `close`, `commitRun`, `createApproval`, `createTaskGrant`, `createTaskPackets`, `exportRegistry`, `getAuthority`, `getRegistry`, `getRunRevision`, `getRunState`, `inspectAudit`, `inspectEvents`, `parseText`, `pauseForApproval`, `prepareAttempt`, `projectContext`, `proposeHandoff`, `queryArtifacts`, `queryDeadLetters`, `queryDomains`, `queryQueue`, `queueTaskPackets`, `reconcileTask`, `registerSpec`, `registerSpecAndQueue`, `registry`, `rejectApproval`, `replayJournal`, `replayTask`, `respondToHandoff`, `resumeRun`, `runCycle`, `serializeRegistry`, `setAdapterRouter`, `setAuthoritySnapshot`, `setRuntimePolicy`.
- **v1 (5):** `close`, `compareAndCommit`, `init`, `load`, `readHistory`.
- **coordinated (4):** `admin`, `createActorIngress`, `observer`, `owner`.
- **owner (5):** `acquire`, `close`, `release`, `renew`, `runCycle`.
- **observer (5):** `close`, `exportEnvelope`, `inspect`, `readHistory`, `replayEnvelope`.
- **admin (5):** `commitRun`, `readmitTask`, `reconcileTask`, `setAuthoritySnapshot`, `setCoordinationPolicy`.
- **ingress (2):** `attachChild`, `handleAuthenticated`.
- **client (2):** `close`, `sendCommand`.
- **v2 (7):** `checkDispatch`, `checkOwner`, `close`, `commit`, `init`, `load`, `readHistory`.
- **bridge (8):** `advertisement`, `cancel`, `close`, `describe`, `execute`, `pending_count`, `session_id`, `shutdown`.
- **server (4):** `active_count`, `advertisement`, `close`, `stats`.

`_invalidatePendingAttempt` is an exported-object maintenance escape hatch, not an actor API. `admin` has no close method; **owner.close or observer.close** closes the shared factory. There are not three independently owned store handles. The v1 raw port has five methods, the v2 raw port seven.

### Required developer questions

1. **Can a novice choose the factory?** Yes: README quickstart uses `createChord`; its mode table explicitly distinguishes memory, v1 exclusive restart and v2 single-machine fenced ownership. `/sdk` exports only `createChord`; the coordinated factory is root-only.
2. **Host versus actor?** Explicit trusted-host labels, bounded authenticated canonical commands and root/port tables identify the distinction. Root mixes groups, so imports alone confer no isolation; retain that warning.
3. **Useful workflow using public APIs only?** Yes. Fresh consumer-like payload runs quickstart and full two-actor/human approval/snapshot/replay workflow on both runtimes, plus a coordinated adapter round trip with one execution and matching replay. No consumer internal imports were needed.
4. **Memory, v1 and v2?** Public README lifecycle blocks run unchanged on both. V1 persists/reopens with the same run; v2 starts unacquired, pins identity, acquires/releases and reopens without adopting credentials. Layouts and clock interfaces differ (`trustedHost.now` for v1; `trustedHost.clock.now` for v2). Cross-open rejection is covered by existing coordinated/storage gates. No migration or fallback claimed.
5. **Adapter knowledge burden?** Normal integration needs advertisement + `{advertisement,handle}`, channel shape and `{adapter:bridge,execution_context:ADAPTER_CONTEXT_VERSION}` registration, not private ownership algorithms. Exact grants are installed by the host separately. Transport identity, durable receipts and effect keys remain different concepts.
6. **Documented functions exported?** All four bare entry modules, README import groups and complete runnable README JS blocks resolve. Actual port signatures match the live table; interop functions/contracts are root and `/interop`, not `/sdk`. The host-path interop fragment is schematic (`/path/to/run.sqlite`) and was not executed as a complete application; the shipped adapter example executes that full path instead. Historical guide cancellation selector needed correction (below).
7. **Privileged misuse?** Still possible if an embedding host leaks SDK/admin/store/owner or forwards methods. This is a documented host trust obligation, not demonstrated actor escalation. Fresh unauthenticated/revoked actor read rejects without changing the complete store snapshot; installed actor with no grants sees zero tasks. Grant shaping alone installs nothing (existing regression gate).
8. **Protocol versions discoverable?** Public adapter version/descriptor/context constants and compatibility API reject unsupported protocol, context and operation with stable codes. Actor canonical protocol and 052A frame versions are documented literals; their internal Sigil contracts are deliberately not exported. Unsupported actor canonical version rejects. This is explicit version discovery/documentation, not dynamic protocol negotiation or semver compatibility promise.
9. **Lifecycle/ownership/shutdown?** Fresh probes verify release/reopen, shared store closure, client listener retirement without channel closure, exact cancellation acknowledgement with execution still pending, and separate bridge/server/channel ownership. Shutdown returning true can follow timeout, so it is not proof of remote acknowledgement/exit. Hosts drain/join and explicitly close resources.
10. **Wire compatibility?** README 052A compatibility section distinguishes unchanged canonical command objects from changed framed IPC bytes with session + per-send UUIDs, no silent client downgrade, and explicit host legacy raw edge. Existing IPC tests exercise repeated reads, stale deliveries, wrapper replacement and cleanup on both runtimes. Adapter wire version is separate from coordination/storage versions.

### Findings, severity and disposition

- **P2 documentation precision, corrected:** `docs/internal/053-developer-guide.md#Cancellation` lists `{ request_id }`, but `src/interop/adapter-bridge.js#cancel` selects `target_request_id`. Unknown selectors can fall through to the first pending request; they must not be recommended. Historical guide retained; current shipped README now states the exact selector. Fresh public-only regression verifies `target_request_id` selects the captured request, acknowledgement does not settle execution, and late completion remains possible. No change to cancel behavior or wire shape.
- **P2 lifecycle interpretation, corrected:** `src/interop/adapter-bridge.js#shutdown` catches handshake failures, closes locally and returns true. Current README now explicitly says true is not acknowledgement/effect completion/process exit. Both runtimes reproduce true with an unresponsive peer and a 10 ms local bound. No runtime redesign.
- **P2 conformance coverage/claim risk, handed to Pass 3:** `src/interop/conformance.js` uses supplied adapter checks plus independent built-in reference/probe checks, skips supplied-adapter cancellation/timeout/invalid-response and kernel replay/stale-owner coverage; `ok` is `failed===0` despite skips. Fresh examples show **32 total, 27 pass, 0 fail, 5 skip per reference adapter**, not full supplied-adapter certification. README now labels these limits. Existing four inherited runner tests are green, but this does not independently validate the runner's adequacy. Pass 3 must challenge report meaning, deliberately bad adapters, lifecycle/identity coverage and kernel evidence; no runner implementation or certification is done here.
- **P3 runtime difference, documented here:** Bun manifest import and missing-module error differ from Node. All tested private source subpaths still reject; no package/runtime workaround warranted.
- **Carry UNRESOLVED P2 reliability:** parent Pass 1 disposition remains binding. No reclassification or historical root-cause claim.

No new P0/P1 or source-level developer-facing defect was established in this pass. API safety does not imply durable idempotency of arbitrary remote effects. In particular `adapter-server.js` has an in-memory successful-result cache, not a durable semantic-payload-checked/coalescing effect system; independent Pass 3 must not certify stronger concurrency/retry guarantees from its sequential cache test.

## Test commands

All exact argv, cwd, exits and full logs are in `commands.json` in the scratch evidence directory. Commands below are actual executions; repeated probe labels distinguish exploratory assertion corrections from acceptance.

| Label | Exact command | Exit |
|---|---|---:|
| pack-dry-run | `npm pack --dry-run --ignore-scripts --json` | 0 |
| node-probe | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/054-p2-api/consumer/probe.mjs` | 1 |
| node-readme-0 | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/054-p2-api/consumer/readme-0.mjs` | 0 |
| node-readme-1 | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/054-p2-api/consumer/readme-1.mjs` | 0 |
| node-readme-2 | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/054-p2-api/consumer/readme-2.mjs` | 0 |
| node-readme-4 | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/054-p2-api/consumer/readme-4.mjs` | 0 |
| node-example-quickstart | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/054-p2-api/consumer/node_modules/@antistructured/chord/examples/quickstart.mjs` | 0 |
| node-example-cross-actor-workflow | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/054-p2-api/consumer/node_modules/@antistructured/chord/examples/cross-actor-workflow.mjs` | 0 |
| node-example-adapter-interop | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/054-p2-api/consumer/node_modules/@antistructured/chord/examples/adapter-interop.mjs` | 0 |
| node-example-adapter-conformance | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/054-p2-api/consumer/node_modules/@antistructured/chord/examples/adapter-conformance.mjs` | 0 |
| node-shared-tests | `/home/d/.volta/tools/image/node/24.22.1/bin/node --test tests/adapter-protocol.test.js tests/adapter-conformance.test.js tests/actor-ingress.test.js tests/ipc-correlation.test.js tests/coordinated-storage.test.js tests/coordinated-dispatch.test.js tests/coordinated-adversarial.test.js tests/storage-adapter.test.js` | 0 |
| bun-probe | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/054-p2-api/consumer/probe.mjs` | 1 |
| bun-readme-0 | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/054-p2-api/consumer/readme-0.mjs` | 0 |
| bun-readme-1 | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/054-p2-api/consumer/readme-1.mjs` | 0 |
| bun-readme-2 | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/054-p2-api/consumer/readme-2.mjs` | 0 |
| bun-readme-4 | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/054-p2-api/consumer/readme-4.mjs` | 0 |
| bun-example-quickstart | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/054-p2-api/consumer/node_modules/@antistructured/chord/examples/quickstart.mjs` | 0 |
| bun-example-cross-actor-workflow | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/054-p2-api/consumer/node_modules/@antistructured/chord/examples/cross-actor-workflow.mjs` | 0 |
| bun-example-adapter-interop | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/054-p2-api/consumer/node_modules/@antistructured/chord/examples/adapter-interop.mjs` | 0 |
| bun-example-adapter-conformance | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/054-p2-api/consumer/node_modules/@antistructured/chord/examples/adapter-conformance.mjs` | 0 |
| bun-shared-tests | `/home/d/.bun/bin/bun test ./tests/adapter-protocol.test.js ./tests/adapter-conformance.test.js ./tests/actor-ingress.test.js ./tests/ipc-correlation.test.js ./tests/coordinated-storage.test.js ./tests/coordinated-dispatch.test.js ./tests/coordinated-adversarial.test.js ./tests/storage-adapter.test.js` | 0 |
| bun-developer-api | `/home/d/.bun/bin/bun test ./tests/developer-api-review.test.js ./tests/canonical-example.test.js ./tests/architecture-integrity.test.js` | 0 |
| node-probe-final | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/054-p2-api/consumer/probe.mjs` | 0 |
| bun-probe-final | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/054-p2-api/consumer/probe.mjs` | 1 |
| node-probe-accepted | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/054-p2-api/consumer/probe.mjs` | 0 |
| bun-probe-accepted | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/054-p2-api/consumer/probe.mjs` | 0 |
| node-lifecycle-regression | `/home/d/.volta/tools/image/node/24.22.1/bin/node /home/d/.hermes/cache/scratch/054-p2-api/consumer/lifecycle-regression.mjs` | 0 |
| bun-lifecycle-regression | `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/054-p2-api/consumer/lifecycle-regression.mjs` | 0 |

All commands run from `packages/core` unless the command ledger gives the fresh scratch consumer cwd. `TMPDIR` was set to the scratch evidence directory. `npm pack --dry-run --ignore-scripts --json` listed **74 files** copied exactly into fresh scratch `consumer/node_modules/@antistructured/chord`; only the already-installed SigilJS dependency was linked. This is payload/resolution validation, **not** an npm install or tarball extraction. README JS block indices 0/1/2/4 are quickstart, v1 lifecycle, v2 lifecycle and conformance; index 3 is the explicit host-path schematic.

## Exit codes

Acceptance: Node/Bun final probes **0** each; new Node/Bun lifecycle regression **0** each; eight existing shared test files **133 pass / 0 fail** on each runtime; Bun developer API/canonical/architecture gate **8 pass / 0 fail / 364 expect**; four complete README blocks and four shipped examples **0 each** on each runtime; pack dry-run **0**. No full-suite rerun required: no runtime or test source changed; parent Pass 1 full-suite result is inherited evidence only, not claimed as this pass execution.

Exploratory probe exits are retained: first Node probe **1** incorrectly expected STORE_CLOSED from reacquisition after release (actual OWNER_LOST; observer does report STORE_CLOSED); first Bun probe **1** assumed Node's exact error code; intermediate Bun probe **1** assumed manifest imports were denied. These were probe-assumption corrections, not hidden product fixes. Final accepted probe explicitly records the manifest exception and asserts both closure surfaces accurately. Harness `run.py` itself returns 0 even with individual failures, so acceptance is taken from its command ledger, not the harness process code.

## Invariants verified

- API enumeration and member sets match across actual Node/Bun, against a fresh copied current payload, not an old tarball.
- No consumer private imports; ordinary governed execution commits once and replay matches; no grants inferred from advertisement or shaping helper.
- Authenticated actor reads preserve complete stored state; revocation is freshly consulted; no authority/admin handle is serialized into the actor response.
- Client close and bridge shutdown do not claim transport/process/effect termination; cancellation does not imply nonexecution.
- No second facade, kernel rewrite, dependencies, version changes or weakening of fencing/validation/retry semantics.
- Historical numbers and conclusions retained, all inherited dirty implementation files preserved against entry hashes.

## Remaining risks

Conformance coverage is not certified and awaits independent Pass 3. Host secrets/session enrollment/filesystem and downstream effect guarantees remain host responsibilities; preview root mixes trust classes. Fresh payload-copy resolution is not installed-package lifecycle validation. This pass does not repeat every heavy process matrix, test unsupported OSes or close the startup reliability P2. Documentation prose amendments do not themselves prove all adapter adversarial semantics.

## Next gate

**Next Pass 3 READY**, with the explicit conformance scope/skip risks above as inputs, and Pass 1 bounded reliability P2 still unresolved. Ready means no newly established P0/P1 blocks starting independent conformance review; it does not mean the inherited runner passes the new Pass 3 acceptance criteria. No Pass 3 implementation performed. No Block 055, commit, push, tag, version bump, publication or release authorized.
