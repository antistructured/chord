# Chord

**Governed coordination for humans, AI agents, and services.**

*Turn intent into governed execution.*

Chord is a standalone JavaScript coordination kernel for applications where different actors work toward a shared outcome without losing context, authority, or execution history. It integrates with your application, models, agents and tools rather than replacing them.

The current implementation combines contract-validated intent, host-issued scoped execution grants, revision-aware shared state, handoffs, human approval gates, uncertain-effect reconciliation and reconstructable execution evidence. Its boundary is an **experimental, trusted-host, single-process, in-memory kernel**—not a distributed execution service.

**Status:** `@weipertda/chord@0.4.0-preview.1` is a local public-preview candidate, **not an announced npm release**. All public APIs are experimental; there is no stable 1.0 API promise. The product name is Chord.

## Why Chord exists

Executing a task is only part of coordinating work. Across actors and sessions, an application must answer:

- Who requested this action, and who may perform it?
- Which state is authoritative? Has another actor changed it?
- Is human approval required?
- Did an external effect actually complete—or is its outcome unknown?
- Can work continue safely after interruption?
- Can the outcome be reconstructed and inspected?

Chord makes those questions explicit. The goal is not to run more agents; it is to help independent actors work together safely and coherently within a defined trust boundary.

## Core capabilities

| Area | Implemented scope |
|---|---|
| Contracts and intent | SigilJS 0.18.0 validates structured kernel inputs, with additional plain-data, size and semantic checks. Run contract versions are explicit. Validation is not authentication. |
| Authority and governance | Host-authenticated principals bind to actors. Exact task-scope grants, explicit denials, capabilities, expiry/revocation and attempt-bound approvals gate governed execution. Actors cannot grant themselves authority through task metadata. Arbitrary actor redelegation chains are not implemented. |
| Coordination and handoffs | Host-mediated proposal/response operations support revision preconditions. Bounded actor context is filtered by active task grants; identity parameters must come from the host, not an unauthenticated request. |
| Canonical state | The SDK privately owns state. Validated changes and corresponding evidence install through a single-process revision commit; reads are detached. |
| Execution safety | Adapters perform effects outside state commits. Ambiguous post-dispatch outcomes remain quarantined until host-attested reconciliation; recording a request or adapter result is not independent real-world verification. |
| Continuity | Approval pause/resume/reject, cancellation and validated snapshot export/import support host-managed session boundaries. Restoring in-flight work records uncertainty; storage and writer coordination remain host responsibilities. |
| Evidence and replay | Supported, complete modern baseline-plus-commit histories reconstruct declared replayable state without invoking adapters or models. Missing or unsupported history rejects rather than inventing execution. |

## Architecture

```text
                        CHORD
               Intent / Coordination
                        |
                 SigilJS Contracts
                        |
                 Authority & Policy
                        |
                  Run / Task State
                        |
             Coordination & Handoffs
                        |
               Execution / Adapters
                        |
               Evidence & Replay
```

This diagram groups responsibilities, not a guaranteed call sequence. Pure policy evaluation, data validation and recorded-state reduction form the functional core. The imperative shell supplies clocks, IDs, adapter calls and state installation. The embedding host authenticates users, manages credentials, verifies receipts and persists snapshots when needed.

## Quickstart

### Install the local candidate

Registry publication is not authorized or claimed. Obtain the reviewed tarball and compare its SHA-256 with the accompanying release handoff, then install it in an ESM consumer project:

```bash
npm install ./weipertda-chord-0.4.0-preview.1.tgz
```

This is a local-file install, not evidence that a registry install is available. The accepted package identity is `@weipertda/chord`; authenticated npm publication authority still needs revalidation. No global CLI binary is installed.

Save the following as `quickstart.mjs`, then run `node quickstart.mjs` (or `bun quickstart.mjs`). It grants one mock actor permission to draft a support response—not to send it. The authority setup is trusted host code; real applications must derive identities and grants from their authenticated session and policy.

```js
import { createChord, SCHEMA_VERSION } from '@weipertda/chord';

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
  issueGrants: packets => packets.map(p => ({
    grant_id: `grant_${p.task_id}`, principal_id: 'host-user', actor_id: 'writer',
    capability: 'draft', effect: 'allow', issued_at: 0, expires_at,
    revoked_at: null, requires_approval: false,
    scope: { run_id, project: p.project, phase: p.phase, task_id: p.task_id,
      target_entity: p.target_entity, resource: { kind: 'task', id: p.task_id } }
  }))
});
const result = await chord.runCycle();
if (!result.ok || calls !== 1 || chord.getRegistry().tasks[packets[0].task_id].status !== 'completed') {
  throw new Error('Governed draft did not complete');
}
console.log({ completed: result.ok, adapterCalls: calls });
// This mock drafts data only. It does not send a message or prove an external effect.
```

The [full canonical example](packages/core/examples/cross-actor-workflow.mjs) demonstrates two mock actors, a revision-aware handoff, missing-approval denial, human approval consumption, a paused snapshot restored into a new SDK instance, safe continuation and trace reconstruction. It is one host process with separate actor identities, not independently deployed distributed workers. Both examples are included in the candidate under `examples/`.

## Developer concepts

| Concept | Meaning in this preview |
|---|---|
| Intent | Versioned structured description of requested work; not permission to execute. |
| Principal | Identity authenticated by the embedding host and supplied through its trusted authority configuration. |
| Actor | Host-registered execution identity bound to a principal. A model name or role is not authority. |
| Capability | Exact action identifier the actor is eligible to perform; a matching grant is still required. |
| Grant | Host-issued allow/deny for a principal, actor, capability and exact task scope, with validity/revocation fields. |
| Run | Canonical coordination state with a contract version and monotonically advancing revision. |
| Task | Immutable admitted work payload plus its governed lifecycle and authority binding. |
| Attempt | A particular execution reservation/dispatch, with correlation, lease and approval binding. |
| Handoff | Host-mediated proposal and accept/reject record between actor identities, with optional revision preconditions. |
| Approval | Host-attested human decision for an exact task/attempt; consumed by dispatch, not a reusable Boolean. |
| Effect | Requested or attempted external operation whose actual outcome may require separate evidence. |
| Event | Recorded diagnostic or committed-state fact. Diagnostic views alone are not reconstructable history. |
| Replay | Pure projection from supported captured facts—not rerunning a provider or generating the same model response. |

## What Chord guarantees today

The regression suite and installed-consumer workflow exercise the governed SDK boundary: denied admission/dispatch, exact-scope authority, stale revisions, atomic state/evidence installation, detached reads, lifecycle barriers, approval consumption, unknown-effect quarantine and pure recorded-state reconstruction. These guarantees apply to the tested single-process host model—not arbitrary code with access to the process.

The host remains responsible for authentication, authority and human-approval truth, credential custody, receipt verification, adapter correctness, persistence and cross-process coordination. Handoff, authority installation, reconciliation and generic CAS APIs are host administration, not public actor authentication endpoints. Use explicit revisions when an actor's proposal depends on a prior read.

Context filtering is **not automatic content redaction**. Related authorized data and full host snapshots/traces can contain supplied inputs, outputs and authority metadata. Do not put secrets in task payloads, and do not expose full host inspection or restore APIs to untrusted callers.

Replay reconstructs from the recorded baseline, not from omitted earlier activity. A trace cut exactly at an earlier valid commit requires an external expected endpoint to detect truncation. Full technical boundaries and migration notes are in [INTEGRITY.md](packages/core/INTEGRITY.md).

## What Chord does not yet guarantee

- No built-in durable distributed execution or cross-process distributed CAS.
- No universal exactly-once external effects; cancellation cannot undo a dispatched effect.
- No cryptographic tamper-proof evidence or independently verified receipt truth.
- No sandboxing of arbitrary hostile in-process adapters.
- No automatic independent authentication of principals or proof that a human approved a request.
- No automatic secret removal from arbitrary host data.
- No deterministic model generation, recovery of missing history, or stable 1.0 API guarantee.

## Design principles

JavaScript ES modules and a minimal dependency surface keep the kernel provider-neutral and framework-independent. SigilJS contracts make data boundaries explicit. A functional core with an imperative shell separates policy and state reasoning from effects. Data-oriented state, explicit authority and versioned evidence favor inspectable transitions over hidden workflow behavior. Where supported history is complete, reconstruction is deterministic; external generation need not be.

Chord does not require PotentiaJS, Via, Runvia, a particular LLM or hosted infrastructure.

## Vision and direction

**Roadmap, not released features:** Chord aims to become a reusable foundation for coordination across independent human and machine actors, applications, tools, execution hosts and eventually organizational boundaries. Possible directions include durable storage adapters, wider execution interoperability, richer policy integration and trusted cross-boundary coordination. These require additional design and verification; this preview does not provide federation or distributed durability.

## Development and compatibility

From the repository root:

```bash
cd packages/core
bun install --frozen-lockfile
bun test
npm test
bun run src/verify-runtime.js
node examples/quickstart.mjs
node examples/cross-actor-workflow.mjs
npm pack --dry-run --ignore-scripts
```

`npm test` invokes the Bun suite; it is not a separate Node test suite. No lint script is currently available. Installed-consumer tests and examples are verified separately on Node.js 24.18.1 and Bun 1.3.14 for this candidate; other runtime versions are not certified by this preparation. Tests and the development verifier are repository-only, not in the npm payload.

Public import paths are `@weipertda/chord`, `@weipertda/chord/sdk` and `@weipertda/chord/platform`. All are **experimental**. Low-level platform exports are trusted-host plumbing. Unexported implementation helpers are **internal**; distributed storage/federation/sandboxing are **deferred**. No surface is labeled stable.

Migration from `@chord/core` changes the npm/import identity, not task IDs, internal paths or persisted schema versions. Package version `0.4.0-preview.1` is independent of `chord.contracts.v1`, snapshot/audit versions and history version. See [candidate release notes](packages/core/CHANGELOG.md).

## Project, contributions and license

- Repository and issues: https://github.com/weipertda/chord
- Candidate npm identity: `@weipertda/chord` (not yet published by this preparation).
- Contributions: open an issue to discuss a bounded change, keep source JavaScript ES modules and include focused tests. Submit only work you have the right to contribute; identify copied material and its license. No CLA or DCO process is currently established.
- License: [Apache License 2.0](packages/core/LICENSE). Copyright 2026 Antistructured Labs LLC, as confirmed by the maintainer. The separately installed SigilJS dependency remains MIT; see [third-party notices](packages/core/THIRD_PARTY_NOTICES.md).
