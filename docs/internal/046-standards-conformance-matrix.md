# 046 — Pass 1: Implementation evidence and standards matrix

PASS below means the named observed behavior only; it is not blanket certification. GAP remains release blocking when required by Block 6A. Test paths are under `packages/core/tests`; implementation paths under `packages/core/src`.

| Requirement | Implementation | Direct existing test/command | Status |
|---|---|---|---|
| SigilJS validation | contracts/sigils.js:19–98,117–130,189–239 | contracts.test.js `plain own-data rejects accessors without evaluating them`, `dangerous values and keys are rejected recursively`; suite exit 0 | PASS tested ingress; GAP uncontracted handoff/pause/new fields |
| Admission authority | sdk/chord.js:139–183; platform/authorization.js:95–125 | adversarial.test.js:259,286 admission/batch denial | PASS gate, GAP compound register+grant atomicity |
| Dispatch authority | platform/runtime-loop.js:70–95 | adversarial.test.js:434 approval-required task zero calls until approved | PASS task gate; GAP run pause/failed guard |
| Commit authority | platform/runtime-loop.js:129–145 | transitions.test.js:203,220 stale/replaced authority | PASS tested late result gating |
| Canonical state isolation | sdk/chord.js:257,267; registry/query.js; platform/handoff.js:26–30,69–71 | adapters no-handle test adversarial.test.js:352 | GAP consumer getters/projection; adapter test does not cover these |
| Atomic commits | registry/registry.js:31–48; sdk/chord.js:270 | no direct commitRun test in 126-test baseline | GAP ephemeral owner; helper not general commit boundary |
| Revision guards | sdk/chord.js cancel/replay; platform/handoff.js:89,117 | adversarial.test.js:313; continuity.test.js:9 | PASS optional stale guards tested, GAP omitted/global paths |
| Handoff coordination | platform/handoff.js:82–135 | continuity.test.js:65,77 | PASS target-string check; GAP principal authentication, payload contracts, rollback |
| Approval enforcement | platform/authorization.js:106–158 | authorization.test.js `approval rules: required, rejected, exact attempt, consumed`; adversarial.test.js:198,434,460,476 | PASS tested Block 2 model; GAP canonical example |
| Cross-session continuity | registry/snapshot.js:25–38 | contracts.test.js `snapshot validates version, counts, nested records, clones and reconciles in-flight import` | PASS tested schema/clone/uncertain conversion; GAP safe governed complete workflow |
| Trace reconstruction | platform/trace-reducer.js:7–27 | fault-injection.test.js:7,13,18 | GAP tests assert only empty replay/duplicate/backwards revision, not state fidelity |
| Effect reconciliation | sdk/chord.js:226–249; platform/transitions.js:134–149 | transitions.test.js:167,348,368 | PASS no automatic retry; GAP replay permits unknown without no-effect proof |
| Consumer installation | package.json exports; platform/index.js | prior docs report import-only smoke; current npm pack --dry-run --json exit 0 | UNKNOWN current full consumer; GAP required reducer export |

## Architecture classification
- Plain JavaScript/ES modules and real runtime SigilJS: verified in first-party source and manifest. No new dependencies needed/added.
- Authorization evaluator is pure with explicit time, no adapter access. Imperative runtime isolates adapter invocation with frozen packet/correlation context; in-process plugins remain trusted, not sandboxed.
- Data-oriented records and small functions retained. Mutable canonical ownership and progressively applied writes conflict with immutable-first/FCIS commit requirements; helper presence is not compliance.
- Root README explicitly marks registry/platform as trusted host. Therefore raw registry mutability is **not** an exploit of an untrusted actor sandbox (no such sandbox exists). It is incompatible with the new consumer-isolation invariant when ordinary read/projection/query methods leak live references. Report this boundary, not fabricated authentication capability.
- Cross-process coordination/durability/distributed CAS/simulation/exactly-once are not established and must not be claimed. Mock actor names in a single program do not demonstrate independently deployed processes.
- Source imports/manifest inspected show no required Runvia/PotentiaJS/model-provider/database/cloud coupling. Fake Via demo strings are not runtime framework dependencies.
- Public stable APIs: none. Existing manifest exports and SDK methods: experimental; low-level runtime/queue/event mutators and authority installation are trusted-host experimental. Physically packed unexported reducer/contracts are internal; Level B reconstruction and distributed persistence are unavailable/deferred, not PASS for this block.

Gate: READY for Pass 2 audit; NOT release-ready. See 046-repository-reality-audit.md for locked scope, original findings and command evidence.
