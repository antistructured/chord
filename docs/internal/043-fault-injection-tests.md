# 043 — Fault injection tests (Block 4, Pass 6)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e`

## Tests added
- `packages/core/tests/fault-injection.test.js`: replay no-side-effects, duplicate event rejection, backwards revision rejection, trace diff, extended journal fields.

## Results
- `bun test`: **125 pass / 0 fail / 1019 expect() calls** (7 files)
- All Block 2/3 tests preserved.

## Pass report
Pass 6 — Fault injection tests  
Files: fault-injection.test.js (new), event-journal.js (modified), contracts/sigils.js (modified)  
Tests: 125/0/1019  
Next pass readiness: READY
