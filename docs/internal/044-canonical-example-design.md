# 044 — Canonical workflow design (Block 5, Pass 2)

**Date:** Tue Oct 20 2026  
**Goal:** One human-directed task crosses two mock actors, survives session boundary, requires approval for protected action, yields replayable trace.

## Actors
- Builder (independent mock actor)
- Reviewer (independent mock actor)
- Human (approval gate)

## Workflow
1. Create chord instance (session 1). Human sets authority snapshot.
2. Builder registers IntentSpec for a protected publish action.
3. Queue packets with authority; task created.
4. Builder proposes handoff to Reviewer with context projection.
5. Reviewer accepts handoff after inspecting projected context.
6. Reviewer runs cycle; adapter produces blocked outcome requiring approval.
7. Pause for human approval (protected action).
8. Export registry (snapshot) to simulate session boundary.
9. Import registry in new instance (session 2); in-flight become uncertain but paused state preserved conceptually.
10. Human approves → resume run.
11. Complete execution; export full trace.
12. Replay trace via no-side-effect replay to verify no adapter invocation.

All deterministic mock adapters.
