# 045 — Release prerequisites and version audit (Block 6, Pass 1)

**Date:** Tue Oct 20 2026  
**Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0`  
**Branch:** `main`  
**HEAD:** `ba3e37e`  
**Current version:** `0.3.0` (packages/core/package.json)  
**Candidate track:** `0.4.0-preview.1` (proposed, not fact)

## Findings
- No git tags visible in recent history
- npm not published in this environment (tarball install from local works)
- Package is ESM, single package `@chord/core`
- Dependencies minimal: `@weipertda/sigiljs@0.18.0`
- Tests: 126 pass / 0 fail / 1026 expect() (8 files)

## Decision
Candidate version `0.4.0-preview.1` is reasonable for preview given Blocks 1-5 completeness. However, I will **not** change version/tag without explicit maintainer authorization. Current version remains `0.3.0` until authorized.
