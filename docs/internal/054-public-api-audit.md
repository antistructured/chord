# Block 054 — Pass 2: Public API & Developer Experience Audit

**Agent:** api-review-agent  
**Status:** COMPLETE  
**Date:** 2026-10-30  
**Publication:** NOT AUTHORIZED

## Export inventory

Verified by importing the actual package entry modules:

| Entry point | Exports | Classification |
|---|---:|---|
| `@antistructured/chord` | 63 | Public preview root; mixes SDK, trusted-host plumbing, coordinated v2 and interop |
| `@antistructured/chord/sdk` | 1 | Public preview SDK (`createChord` only) |
| `@antistructured/chord/platform` | 22 | Trusted-host plumbing; unguarded data primitives |
| `@antistructured/chord/interop` | 28 | Public experimental adapter protocol, bridge/server, references and memory transport |

The root export count and group membership match `packages/core/README.md`. The four entry points are declared in `package.json` and resolve to real files.

## API classification

### Public supported preview

- `createChord` from the root or `/sdk`.
- Memory-only governed workflow, authority installation, task admission, handoffs, approvals, lifecycle, replay and audit through the legacy SDK.
- Documented examples: `examples/quickstart.mjs`, `examples/cross-actor-workflow.mjs`.

### Public experimental preview

- `createCoordinatedChord` and its `observer`, `owner`, `admin` and factory-bound `createActorIngress`.
- `createActorClient` for actor-side inherited IPC.
- `createActorIngress` root composition.
- `openSqliteStore` and `openCoordinatedSqliteStore` for trusted-host raw storage.
- `/interop` protocol constants, contracts, validators, bridge, server, reference adapters and memory transport.
- `examples/adapter-interop.mjs`, `examples/process-recovery.mjs`, `examples/two-process-coordination.mjs`.

### Trusted-host privileged

- `createChord().commitRun`, `setAuthoritySnapshot`, `prepareAttempt`, `exportRegistry`, `serializeRegistry`, `inspectAudit`, `inspectEvents`, `queryArtifacts`, `queryDomains`, `queryDeadLetters`.
- `createCoordinatedChord().admin` (`commitRun`, `setAuthoritySnapshot`, `setCoordinationPolicy`, `reconcileTask`, `readmitTask`).
- `createCoordinatedChord().owner` (`acquire`, `renew`, `release`, `runCycle`).
- `openSqliteStore`, `openCoordinatedSqliteStore`, root `createActorIngress`.
- The entire `/platform` entry point.

### Internal implementation

- `src/contracts/`, `src/coordination/`, `src/execution/`, `src/registry/`, `src/runtime/` and `src/platform/` modules are not public subpaths. They remain reachable only through exported factories/functions or through relative source paths, which consumers must not use.
- Test fixtures, workers, verifiers and `src/verify-runtime.js` are not public.

### Deprecated / deferred

- No exported API is marked deprecated.
- Legacy v1 storage is retained but not the recommended path for new coordinated work.
- v1 and v2 storage layouts are explicitly incompatible; no migration is offered.

## Required questions

1. **Can a consumer identify the right factory?** Yes. `createChord` is the single-actor/legacy SDK; `createCoordinatedChord` is the separate local fenced-owner/actor mode. The package README states the choice in a mode table and warns that v1/v2 are incompatible.
2. **Can a developer distinguish trusted-host APIs from actor-facing APIs?** Yes, with one caveat. The README labels admin/owner/store/ingress APIs as trusted-host privileged and the actor wire as bounded JSON. The caveat is that the root entry point mixes all groups, so a consumer must read the grouping table rather than rely on import path alone.
3. **Can a developer create a useful workflow without internal imports?** Yes. `examples/quickstart.mjs`, `examples/cross-actor-workflow.mjs` and `examples/adapter-interop.mjs` import only documented package exports and pass on Node and Bun.
4. **Are memory, durable and coordinated modes explained clearly?** Yes. The package README has a mode table, separate sections, storage restrictions, ownership rules and explicit v1/v2 incompatibility.
5. **Does adapter integration require unnecessary implementation knowledge?** No for the normal path: `createAdapterBridge` + `createAdapterServer` + `createMemoryTransportPair` + reference adapter are exported from `/interop`, and the kernel registration is one documented `{adapter, execution_context}` object. Adapter authors do not need kernel internals. They do need to understand the protocol identity fields and that advertisement is not authority.
6. **Are all documented functions actually public?** Yes for the functions checked in this pass. The README’s legacy SDK member count (39) and coordinated factory/port counts (4/5/5/5/2/2, raw store 7) match runtime inspection.
7. **Are privileged operations easy to misuse?** They are powerful but documented as host-only. The main residual risk is that they share the root import with public APIs. No second facade was added because the existing grouping is understandable and a facade would hide the explicit privileged boundary rather than remove it.
8. **Can consumers discover supported and unsupported protocol versions?** Yes. `ADAPTER_PROTOCOL_VERSION`, `ADAPTER_DESCRIPTOR_VERSION`, `ADAPTER_CONTEXT_VERSION` and `ADAPTER_KINDS` are exported from `/interop` and the root. `adapterCompatibility` reports stable codes.
9. **Are resource ownership and shutdown responsibilities explicit?** Yes. The README states that closing any coordinated port closes the factory, that observer/owner/admin are not independent handles, and that bridge/server/actor-client each have explicit `close`/`shutdown`. Adapter `shutdown` and bridge `close` are distinct.
10. **Are breaking transport compatibility changes documented?** Yes. The 052A IPC framing change and the absence of a silent unframed fallback are documented in the package README. The adapter protocol is versioned separately.

## Findings and corrections

No genuine public-boundary defect required a code change in this pass.

Two documentation refinements are deferred to Pass 5 rather than changing API behavior:

- `createAdapterServer` is described in its source comment as “trusted host-side”; it is the participant-side server used by an adapter. The developer guide will use “participant-side adapter server”.
- The repository-level README still carries Block 052-era test counts and does not yet present Block 053/054 capabilities. Pass 5 will update it.

## Verification

```text
bun run examples/quickstart.mjs                 exit 0  { completed: true, adapterCalls: 1 }
node examples/quickstart.mjs                    exit 0  { completed: true, adapterCalls: 1 }
bun run examples/cross-actor-workflow.mjs       exit 0  governed workflow completed, replay_verified true
bun run examples/adapter-interop.mjs            exit 0  canonical result committed once, replay matches
```

Runtime inspection confirmed:

- `createChord` has 39 enumerable members.
- Coordinated factory keys: `observer`, `owner`, `admin`, `createActorIngress`.
- `owner`, `observer` and `admin` each have 5 methods.
- Factory and root ingress each expose `handleAuthenticated`, `attachChild`.
- Bridge exposes 8 keys; server exposes 4; actor client exposes `sendCommand`, `close`.

## Gate

Public boundaries are coherent, accurately documented for use, and usable without internal imports. Proceed to Pass 3.

## Pass 3 addendum

The additive Pass 3 export `runAdapterConformance` raises the current counts to root **64** and
`/interop` **29**. This does not change the Pass 2 classification: conformance is public experimental
preview tooling, and a passing report is not an authority grant.

Pass 5 completed both documentation refinements: the adapter server is now described as
participant-side, and the repository/package READMEs report the current 427-test working-tree total.
