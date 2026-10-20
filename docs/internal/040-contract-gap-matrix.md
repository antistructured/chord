# 040 — Contracts and SigilJS gap matrix

Pass 2 COMPLETE (audit evidence, not contract compliance). Consulted pass 1 reality audit.

## Critical dependency identity mismatch
Installed `sigiljs@0.0.21` is Richard Anaya's web-component view library (repository github.com/richardanaya/sigil), not a schema validator. `node_modules/sigiljs/src/sigil.js:161-319` exports CommonJS `sigil(name, props, options)` / `sigil(name, options)` and `sigil.use(defaultOptions)`, using DOMParser, HTMLElement and document.registerElement. No validation API is supplied. Chord runtime imports no external SigilJS at all. `src/contracts/sigils.js:1-4` explicitly says “Mimics SigilJS-style validation”. Do not invent a schema import or silently upgrade; Block 2 must identify the intended package and inspect that exact installed version before changing dependency/lockfile. This audit verifies the installed API, not a latest upstream release.

## All declared runtime contracts and enforcement
Paths below relative to packages/core.

| Contract/boundary | Existing enforcement | Missing / preview risk |
|---|---|---|
| TaskPacketValidator (`src/contracts/sigils.js:27-31`) | object; string task_id/target_entity; array of string requested_action | nonempty IDs/actions, closed keys, nested inputs/constraints, project/phase/kind, bounds, dangerous keys and authority absent |
| ExecutionResultValidator (`:33-37`) | object; task_id/status/outcome strings | enums, status/outcome consistency, payload schemas, receipt/provenance and completion evidence absent |
| assertObject (`:39-44`) | rejects null, arrays and nonobjects | not plain-object/closed-shape enforcement |
| assertAdapter (`:54-57`) | object with execute function | not identity, trust, capabilities or isolated effects |
| Packet creation (`src/execution/task-packets.js:4-53`) | packet validators on generated output | specs not validated; defaults hide missing fields; authority merely copied |
| SDK queue (`src/sdk/chord.js:101-119`) | validates packet array before registration | duplicate IDs, immutable capture, options, idempotency, grant checks absent; spec registration precedes packet validation |
| Adapter output (`src/execution/task-packets.js:56-72`) | validate AFTER normalization | absent/null output defaults to completed/succeeded; arbitrary nonempty status strings accepted; outputs unvalidated |
| Text ingest (`src/sdk/chord.js:20-87,145-178`) | scalar/array/map normalization; malformed map string throws | no input schema or authenticated identity; unknown fields discarded; no size/length bounds |
| Register spec / injected registry (`src/sdk/chord.js:14-18,89-93`) | none | untrusted spec/state can enter before validation |
| Policy (`src/platform/policy.js`) | defaults only | no finite/nonnegative ranges, strategy enum or limits enforcement contract |
| Snapshot (`src/registry/snapshot.js:23-25`) | returns snapshot.registry directly | no version, integrity, state schema or clone |
| CLI (`src/cli/_shared.js`, run.js) | ad hoc parsing and Number conversion | argument/config validation absent; config is not loaded |
| Public platform helpers | direct mutable state operations | SDK checks are not a universal boundary; inspect runtime/security passes |

JSDoc `src/types/index.js:1-38` describes more packet fields and result enums than actual validators enforce; exports no runtime values. No declared grant/approval/cancellation/journal schema exists in the contract module.

## Tests (existing command only)
`bun test tests/hardening.test.js -t 'Contract Enforcement|Parsing'` in packages/core, Bun 1.3.14: exit 0, 2 pass, 2 filtered out, 0 fail, 9 expect calls. Negative assertions cover malformed map, missing requested_action, numeric target_entity. No existing negative coverage for adapter results, snapshots, grants, policy or correlation. Passing these tests does not validate SigilJS integration.

## Inspection / changes / handoff
Inspected: pass 1 report; `src/contracts/sigils.js`, `src/execution/{task-packets,results}.js`, `src/sdk/chord.js`, `src/types/index.js`, `src/registry/snapshot.js`, `src/platform/policy.js`, `tests/hardening.test.js`; installed `node_modules/sigiljs/{package.json,README.md,src/sigil.js}` and package file inventory; source import search and CLI from pass 1.
Changed: this report only. P0 blockers: wrong dependency identity/no real SigilJS enforcement; incomplete boundaries; optimistic adapter normalization. No code changes, dependency changes or new tests. Next pass READY for runtime investigation; implementation readiness BLOCKED.
