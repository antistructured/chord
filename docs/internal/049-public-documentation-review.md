# 049 — Pass 4: Public documentation and product accuracy

Gate: DRAFT PREPARED; public candidate documentation approval BLOCKED with licensing/identity. Current public README/INTEGRITY inspected, existing commands tested; no kernel/source/package-document edit made that would invalidate sealed evidence. Proposed public-facing wording below is an internal draft, not a publication claim.

## Approved product direction to use after clearance
**Chord — A JavaScript coordination kernel for governed execution across humans, AI agents, and services.**

**Turn intent into governed execution with explicit authority, coordinated state, safe handoffs, and replayable evidence.**

Demonstrated integration: contract-validated intent; host-delegated exact scoped actor grants (not arbitrary actor redelegation chains); explicit allow/deny/approval and freshness gates; private coordinated canonical state; handoffs; human approval; uncertainty quarantine/reconciliation; reconstructable modern recorded history. No world's-first or competitor-absence claim.

## Verified quickstart for existing internal checkout
From packages/core with installed dependencies:
```sh
bun test
bun run src/verify-runtime.js
node examples/cross-actor-workflow.mjs
bun examples/cross-actor-workflow.mjs
```
From repository root:
```sh
node --test docs/internal/046-state-probes.mjs
```
All executed with exit0. No npm install @chord/core@0.4.0-preview.1 command is presented as working: identity/rights/version/candidate are not approved or built.

Public API draft: import createChord, importRegistry, replayNoSideEffects and canonicalProjection from documented @chord/core exports after package identity is confirmed. Use host-installed authority, not actor-authored maps; examples must never reset registry statuses. Current canonical example follows public imports and exact human approval/consumption/restore/replay with negative effects0. Full host SDK is privileged; projectContext is filtered, not an authentication service.

Required limitations retained: single-process/in-memory authoritative model; trusted host authenticates identities/verifies receipt references and controls adapters; snapshots are trusted-host restore, imported in-flight effects quarantined, not distributed durability; in-process adapters not sandboxed; rich histories may contain host data, not universal redaction; modern baseline+commits replay only, legacy insufficient history rejects, no provider/model effects during replay; no global exactly-once/cryptographic completeness/federation; all APIs experimental.

Root/public documentation to merge only after decisions: concise positioning above, actual confirmed package/install/version, verified source/example commands, current trust/migration guide link, license/contributor policy, release notes. Contribution instructions must not imply an unapproved CLA/DCO or rights transfer. Internal release-notes draft retained separately; no hypothetical public release announced.
