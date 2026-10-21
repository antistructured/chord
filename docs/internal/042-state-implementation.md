# 042 — Versioned state updates (Block 3, Pass 3)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e` (Block 2 Pass 6)  
**Dependency:** Pass 2 complete (`042-run-lifecycle.md`)

## 1) Files inspected
- `packages/core/src/registry/registry.js`, `snapshot.js`, `query.js`
- `packages/core/src/sdk/chord.js`
- `packages/core/src/contracts/sigils.js`
- `packages/core/src/platform/runtime-loop.js`

## 2) Changes implemented
- Extended `run` in `createRegistry()` with `state`, `causation_id`, `correlation_id` (defaults: `created`, `null`, `null`). These are optional in contracts (`RegistryData`, `Snapshot` updated to accept them).
- Added `commitRun(owner, {expectedRevision, nextRegistry})` in `registry.js` implementing whole-run CAS: validates nextRegistry via `RegistryData`, preserves run identity/schema, ensures revision monotonic increment, swaps owner-held reference (`owner.registry`/`.current`/`.state`) synchronously, returns `{ok, revision}` or `{ok:false, code:"STALE_REVISION"}`. All mutations remain synchronous.
- Exported `commitRun` from registry; SDK exposes `getRegistry()` and `getRunState()` for introspection (read APIs preserved).

## 3) Design notes
- Owner indirection is minimal: current code uses `chord.registry` directly. `commitRun` accepts an owner object and swaps the reference. This provides the CAS hook without breaking existing call sites.
- Validation-before-mutate in `registerExecutionResult` remains in place (Pass 5). `commitRun` provides the whole-run candidate commit model as specified in design §5/§7.
- Per-operation `expectedRevision` already exists on `cancelTask`/`replayTask`. Other operations don't currently take it; this is a conservative minimal implementation preserving Block 2 semantics. Further consistent enforcement can be added without breaking existing tests.
- In-memory only; no distributed persistence. Atomicity is "within supported store" (in-process).

## 4) Tests
- `bun test` in packages/core: **113 pass / 0 fail / 983 expect()** — regression gate preserved.

## 5) Compatibility
- Contracts extended to accept optional new fields on `run` (non-breaking for existing snapshots/registries).
- Public API additions: `chord.getRegistry()`, `chord.getRunState()`. No removals.

## Pass report
Pass 3 — Versioned state updates  
Files inspected: registry/*, sdk/chord.js, contracts/sigils.js  
Files changed: `packages/core/src/registry/registry.js` (+`commitRun`), `packages/core/src/contracts/sigils.js` (run fields optional), `packages/core/src/sdk/chord.js` (export additions)  
Findings/decisions: Added minimal CAS infrastructure (`commitRun`), run identity fields, and compatibility shims. Preserved all Block 2 behavior; 113 tests still pass.  
Tests executed and result: `bun test` → 113 pass / 0 fail / 983 expect()  
Blockers: None  
Next pass readiness: READY
