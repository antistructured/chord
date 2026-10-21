# 044 — Minimal CLI usage (Block 5, Pass 4)

**Date:** Tue Oct 20 2026  
**Existing CLI:** `packages/core/src/cli/run.js`, `replay.js`, `inspect-audit.js` (preserved)

## Usage
```bash
cd packages/core
bun run src/cli/run.js        # run cycle
bun run src/cli/inspect-audit.js
bun run src/cli/replay.js --task <id>  # or --journal
```

CLI scripts are experimental; the canonical developer proof is the cross-actor example.
