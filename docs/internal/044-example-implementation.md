# 044 — Standalone cross-session example (Block 5, Pass 3)

**Date:** Tue Oct 20 2026  
**Example:** `packages/core/examples/cross-actor-workflow.mjs`

## Flow demonstrated
- Session 1: Builder registers IntentSpec, projects context, proposes handoff to Reviewer, Reviewer accepts
- Protected action results in blocked → human approval pause
- Export snapshot (session boundary), import in Session 2, resume approval
- Task re-queued and completed via adapter
- Trace replayed with zero side effects

## Output
```
SESSION1_CONTEXT_TASKS: 1
SESSION1_TASK_STATUS: uncertain
SESSION1_PAUSED: paused
SESSION1_EXPORTED_REV: 8
SESSION2_INITIAL_STATE: paused
SESSION2_RESUMED
{"ok":true,"task_status":"completed","run_state":"active","trace_events":13,"replay_ok":true,"effects_invoked":0}
```

## Notes
- Uses public API only (no internal import hacks in the flow except trace replay utility)
- No Runvia/PotentiaJS/model provider dependencies
- In-memory serialization via export/import (documented limitation)

## Tests
- `bun test`: 125/0/1019
