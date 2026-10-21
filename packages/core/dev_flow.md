# Chord Core – Development Flow Tracker

Current correction evidence: `docs/internal/047-final-report.md` at repository root.
Block 6B corrects private ownership/CAS, lifecycle gates, admission/projection,
uncertainty reconciliation and versioned replay. The notes below retain the
historical Block 2 handoff; they are not the current release gate.

## 1. LAST COMPLETED ITEMS
- Block 2 (authority hardening) passes 3–6 complete: real SigilJS contracts,
  pure authorization evaluator + trusted-host seam, guarded transitions with
  ambiguity handling, and an adversarial test matrix.
- 113 tests passing; `verify-runtime.js` and `demo:via` green.

## 2. CURRENT STATE
Chord is a JS/Bun preview kernel with a governed runtime path:
- host-authenticated identity, exact-scope grants, human approvals
- guarded task/queue/artifact/domain transitions
- pre-dispatch bounded retry (dead_letter) vs post-dispatch ambiguity (uncertain)
- explicit host exits: `cancelTask`, `replayTask` (fresh admission)

Not production-ready: in-process adapters, `./platform` exports, and direct
registry access remain trusted-host APIs (no sandbox).

## 3. NEXT ITEMS (Block 3)
1. Whole-run `commitRun` clone-swap CAS and per-operation `expectedRevision`
   enforcement (deferred from Block 2 per `040-preview-scope-lock.md`).
2. Fill in runnable example scripts behind the prose in `examples/`.
3. Product strategy / GTM when the kernel stabilizes.
