# 046 — Early-stop release disposition

**Decision: NO-GO. Block 6A: BLOCKED.**

This document records the mandatory early-stop disposition, **not a completed Pass 8 independent release gate**. Passes 3–8 were not advanced after Pass 2 established unresolved foundational P0 failures. A separate read-only reviewer confirmed the stop decision; see 046-independent-stop-review.md.

## Release criteria
| Criterion | Evidence / disposition |
|---|---|
| P0 fixes complete | NO; no implementation repairs claimed |
| Required invariants pass | NO; acceptance probes exit 1, 18 fail / 3 pass |
| Existing regressions pass | YES; core 126/0, authority/adversarial 49/0, continuity 7/0, existing fault/replay 5/0 |
| Canonical example governed | NO; direct resets, no human approval |
| Whole-run CAS/isolation | NO; success without installation, dual success, live read aliases |
| Pause/rejection effect boundary | NO; effects invoked in paused/failed runs |
| Uncertainty reconciled before retry | NO; unknown re-admission produced two mock calls |
| Level B state reconstruction | NO; tasks absent, incomplete/foreign histories accepted |
| Full installed public package workflow | NOT TESTED; reducer not exported, internal example imports |
| Reproducible approved artifact/revision | NO artifact built; source differs from old HEAD; baseline evidence preserved |
| Architecture constraints | JS/ESM/SigilJS retained, no dependencies/framework added; full Pass 7 not executed |
| Publication authority | Maintainer only; no publish/tag/version/commit/push performed |

No CONDITIONAL GO: these defects undermine required execution/state/evidence guarantees. Do not reinterpret diagnostic replay, mock actor labels, successful command exits or prior GO reports as satisfying the release gate.

Original findings F6A-01 through F6A-06 remain open. The bounded next correction sequence is in 046-state-atomicity-audit.md. Resume there, not by restarting Blocks 1–6 or starting a broader feature phase. After fixes, execute all stopped passes and a new independent release gate.
