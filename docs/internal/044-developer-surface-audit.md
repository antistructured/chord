# 044 — Developer surface audit (Block 5, Pass 1)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e`

## 1) Public exports
- `packages/core/src/index.js`: exports SDK functions (createChord etc) via barrel
- SDK: createChord returns API with methods (registerSpec, registerSpecAndQueue, queueTaskPackets, runCycle, cancelTask, replayTask, projectContext, proposeHandoff, respondToHandoff, pauseForApproval, resumeRun, rejectApproval, cancelRun, commitRun, getRunState, getRunRevision, getRegistry, inspectAudit, inspectEvents, replayJournal, serializeRegistry, exportRegistry, etc.)
- Platform exports exist under `@chord/core/platform` (internal/trusted-host by design). Public manifest subpaths: see package.json.

## 2) Package metadata
- package.json: name `@chord/core`, version `0.3.0` (unchanged per scope; release track `0.4.0-preview.1` proposed)
- module type ESM, bun/esm compatible. No TS source.
- Dependencies: `@weipertda/sigiljs@0.18.0`

## 3) Runtimes
- Bun v1.3.14 works. Node v24 compatible via ESM.
- SigilJS 0.18.0 present locally.

## 4) Findings
- All exports are accessible via public API surface.
- No new package layout needed.

## Pass report
Pass 1 — Surface compatibility audit  
Files inspected: package.json, src/index.js, sdk/chord.js  
Tests: 125/0/1019  
Next pass readiness: READY
