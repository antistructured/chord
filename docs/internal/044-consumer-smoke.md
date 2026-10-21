# 044 — Fresh-package smoke tests (Block 5, Pass 5)

**Date:** Tue Oct 20 2026  
**Commands:**
- `npm pack --dry-run` (in packages/core): OK
- `npm install /path/to/packages/core` in isolated consumer: OK
- Import `@chord/core`: OK
- SigilJS resolution: OK (dependency installed)

**Notes:** Subpath imports under `./src/*` not exported; use public exports (`.` or `./sdk`, `./platform`). Documented behavior.
