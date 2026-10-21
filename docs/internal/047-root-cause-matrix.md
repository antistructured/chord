# 047 — Pass 1: Rebaseline and root-cause matrix

Gate: READY for Pass 2 implementation. Prior 046 reports/probes/evidence remain immutable. Authorization here explicitly permits the coordinated canonical-state correction that blocked 6A; it does not retroactively change that NO-GO.

Branch main; HEAD ba3e37ea035a2862e06766ed7f90513babf945b0. Required Git commands rerun before source edits; pre-existing tracked/untracked work preserved by baseline SHA-256 manifest in 047-evidence/. No staged work. No version/tag/publish/push/commit authorized.

Baseline execution: core bun test exit 0, 126 pass / 0 fail. Separate node --test docs/internal/046-state-probes.mjs exit 1, 3 pass / 18 fail. Exact output and exits in 047-evidence/{core-baseline,probes-baseline}.log and commands.json. All nine required documents exist and were read; source SDK/registry/runtime/evaluator and fixture/test boundaries inspected.

| Finding group | Reproduction | Files/functions | Root cause | Minimal coordinated repair | Dependencies / regression risk / verification |
|---|---|---|---|---|---|
| STATE-OWNER | 046 probes 1–2 | sdk/chord.js createChord/commitRun; registry/registry.js commitRun | temporary holder and captured mutable state | private persistent owner, validated cloned candidate, exact consecutive revision, synchronous install | first; async results must re-read owner; same-revision exclusivity and visible installation tests |
| STATE-ATOMIC | probes 5–6,10 | SDK register/admit/prepare; all canonical writers/runtime | progressive writes and unrelated revision/event updates | transact all synchronous logical operations on detached candidates; commit events with state; reject before install | depends owner; preserve security rejection behavior; compound failure and event rollback tests |
| LIFECYCLE | probes 3–4 | runtime-loop/approval-flow | run state not execution gate | guard central dispatch and fresh result commit; terminal preservation | depends owner; zero-effect paused/failed/cancelled and late callback tests |
| READ-ISOLATION | probes 7–9 | SDK getters, query, handoff, journal | aliases + no-grant fallback | detached reads, active exact grants with deny precedence, bounded filtered projections | depends owner; migration intentionally removes live references; mutation-after-read tests |
| RECOVERY | probe 11 + unknown-redispatch diagnostic | replayTask/runtime/import | new permission mistaken for no-effect evidence | quarantined stable semantic operation identity, host-attested explicit reconciliation records and fresh authorization | depends owner+authority; legacy unsafe replay tests require evidence, never weaker checks; duplicates/races tests |
| REPLAY | probes 12–18 | event producers/reducer/diff/barrels | missing committed state data, ID-set diff | versioned complete commit deltas/genesis, pure validated ordered reducer and content diff, explicit legacy unsupported | depends all writers; no guessed missing state; equality and zero-call tests |
| WORKFLOW/PACKAGE | F6A-01/03/04/06 | example/tests/exports/reports | direct state reset, no human approval, import-only consumer proof | repair example through public API after kernels; full package remains resumed 6A work | no packaging/release advancement while kernel P0 remains |

Pass 2 scope: private canonical owner, atomic candidate install used by SDK and asynchronous runtime phases, detached SDK reads, regression tests. Record explicit compatibility changes; retain existing architecture, package structure, JS/ESM/SigilJS/dependency versions. Low-level exported functions operate only on caller-owned detached data and are trusted-host plumbing, never canonical handles. Later lifecycle/projection/reconciliation/replay passes remain separate gates.
