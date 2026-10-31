# Two actors, handoff and human approval

[Setup](README.md#setup) first. From the repository root:

```bash
"$N" packages/core/examples/cross-actor-workflow.mjs
"$B" packages/core/examples/cross-actor-workflow.mjs
```

Inspect JSON: `accepted_handoff`, `approval_required`, `approval_consumed`, `snapshot_restored`
and `replay_verified` are true; `final_task_status` is `completed`, with one builder and one protected
effect invocation. The [shipped public-API script](../../packages/core/examples/cross-actor-workflow.mjs)
is the [retained inline canonical workflow](../../README.md#7-complete-canonical-workflow).

The host installs separate builder/reviewer identities and a distinct human approver. It queues
ordinary work, proposes/accepts a revision-guarded handoff, observes a missing-approval denial with
zero protected adapter calls, pauses, snapshots/restores, installs an exact reserved-attempt approval,
resumes, commits once and replays with zero effects. `proposeHandoff`/`respondToHandoff` here are
**trusted-host legacy helpers**, not authenticated actor endpoints. Human attestation is simulated,
not a login or UI. Handoff does not grant permission or transfer owner authority.

This is **one process**, two actor identities and mock effects; snapshot import is not crash recovery.
No provider/framework or private source import is needed. For real local actor processes choose
[cross-process collaboration](cross-process.md); for crash recovery choose [durable restart](durable-restart.md).
