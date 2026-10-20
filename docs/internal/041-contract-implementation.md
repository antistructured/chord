# 041 — SigilJS contract implementation (Block 2, Pass 3)

Status: **complete**. Branch `main`, base commit `ab1bab4` (Block 2 WIP baseline). Package remains `@chord/core@0.3.0`; no dependency, export-layout, or version change in this pass. Passes 1–2 artifacts (`041-contract-scope.md`, `041-authority-design.md`) stand unchanged.

## 1. Files inspected

- `packages/core/src/contracts/sigils.js` (full), `packages/core/src/registry/snapshot.js`, `packages/core/src/sdk/chord.js` (`parseText`), `packages/core/src/execution/task-packets.js`, `packages/core/src/verify-runtime.js`, `packages/core/src/demo/callaback-demo.js`, `packages/core/src/registry/query.js`, `packages/core/tests/{hardening,contracts}.test.js`, `packages/core/package.json`.

## 2. Findings and fixes

### F1 — `Snapshot.created_at` vs generic `_at` walk rule (test-suite blocker)

`semanticWalk` requires every `*_at` key to be a nonnegative safe integer. The `Snapshot` contract legitimately carries `created_at` as an ISO string (validated by `Number.isFinite(Date.parse(...))`). Result: `Snapshot.assert`/`exportRegistry` always failed with `INVALID_SEMANTICS`, aborting `tests/contracts.test.js` at fixture load (observed pre-fix: `bun test` → 0 pass, 5 fail, 1 error).

Fix: `define(shape, semantics, options)` gained a per-contract `{ walk: false }` opt-out, used **only** for `Snapshot` (`sigils.js`). Snapshot semantics fully validate the skipped ground themselves (`Date.parse`, `RegistryData.assert` of every nested record, run/counts cross-checks). The generic walk remains active for every other contract — identifier, `_revision`/`revision`, and id-suffix integer rules are not weakened anywhere. Prototype/cycle/limit/accessor rejection in `clonePlainData` is untouched.

### F2 — Legacy hardening fixtures invalid under closed contracts (intentional breaks, assertions preserved)

`tests/hardening.test.js` (Block 1 baseline evidence) targeted pre-contract behavior. All behavioral assertions kept; fixtures/messages updated to the contract-mandated forms:

| Old expectation | New form | Justification |
|---|---|---|
| CoordSpec without `@phase` accepted | `@phase` added | `Coord` contract requires `project` and `phase` (041-authority-design.md §3, closed versioned records) |
| absent `spec.do` normalized to `[]` | `toBeUndefined()` | Parser must not fabricate fields on closed records; absent optional data stays absent |
| `/Malformed map entry/`, `/requested_action is required/`, `/target_entity is required and must be string/` prose | `/INVALID_SHAPE/` | 041-authority-design.md §2: ingress errors are fixed `{code, path}` codes; raw input/library diagnostics are never exposed |
| minimal packets `{task_id, requested_action, target_entity}` | full packets via `createIntentTaskPacket` | `TaskPacket` is closed: `schema_version`, `task_kind`, `source_type`, `project`, `phase`, `role`, `stance`, `inputs`, `constraints` required |
| — | new: `expect(chord.registry.tasks["1"]).toBeUndefined()` | proves failed batch validation registers nothing (no partial writes) |

### F3 — `verify-runtime.js` fail-fixture missing `@phase`

Parse now correctly rejects it (`INVALID_SHAPE`, exit 1 observed). Added `@phase v0.1` to the failure spec. Success-path steps unchanged.

### F4 — `demo:via` script target nonexistent

`package.json` `demo:via` pointed at `src/demo/via-demo.js` (absent). Repointed to the existing `src/demo/callaback-demo.js` (Block 1 defect C6). Demo exercises `parseText`/`registerSpecAndQueue`/audit only; its direct `smsAdapter.execute` calls are host-fake demo content, not Via kernel coupling.

## 3. Contract inventory verified present (all `chord.contracts.v1`, Sigil.exact, closed, clone-on-assert)

Run, Principal, Scope, Actor, Grant, TaskAuthority, Approval, AuthoritySnapshot, Attempt, Decision (with `DECISION_CODES`), ErrorContract, Intent, Coord, Handoff, TaskPacket, ExecutionResult, AdapterResult, Outcome, RuntimePolicy, RuntimePolicyInput, RegistryData, Snapshot. Request contracts (`Intent`/`Coord`/`Handoff`/packet `inputs`) remain explicitly non-authoritative descriptive data (041-authority-design.md §1); grants/approvals are host-snapshot-only records.

## 4. Test and command evidence (actual output)

```text
$ bun test                       (packages/core)
 39 pass / 0 fail / 294 expect() calls   [hardening.test.js + contracts.test.js]

$ bun run src/verify-runtime.js  (packages/core)
 ... ✅ SigilJS caught invalid packet: INVALID_SHAPE
 🎉 ALL RUNTIME VALIDATIONS PASSED!   exit 0

$ bun run src/demo/callaback-demo.js
 === DEMO COMPLETE ===                exit 0
```

No Chord test claims beyond this transcript. `npm run lint` remains NOT AVAILABLE (no script). No publish/tag/version action taken.

## 5. Decisions and compatibility record

- Schema version stays `chord.contracts.v1`, frozen per run, independent of npm `0.3.0`.
- Preview-incompatible-by-design changes (documented for the guide pass): fixed error codes instead of prose; required `project`/`phase` on every spec; closed contracts reject unknown fields instead of dropping them; absent optional arrays no longer normalized to `[]`; malformed inputs that previously passed are now rejected. These are the C1/C5 scope-locked corrections, not regressions.
- `Sigil.exact` inherited-field caveat remains defended by Chord-owned `clonePlainData` before schema checking (evidence: `contracts.test.js` "Sigil inherited-field caveat" test).

## 6. Blockers / next readiness

None. Blockers carried from Block 1 that remain for later Block 2 passes: evaluator + trusted-host seam (Pass 4), transition/ambiguity guards (Pass 5), adversarial matrix (Pass 6). Stale-write CAS remains deferred to Block 3 per scope lock. Next pass: READY.
