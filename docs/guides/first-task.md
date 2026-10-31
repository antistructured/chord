# First local governed task

[Setup](README.md#setup) first. From the repository root:

```bash
"$N" packages/core/examples/quickstart.mjs
"$B" packages/core/examples/quickstart.mjs
```

Expected: `{ completed: true, adapterCalls: 1 }` on each. The
[shipped script](../../packages/core/examples/quickstart.mjs) is also reproduced verbatim in the
[README quickstart](../../README.md#6-runnable-quickstart). It uses public `createChord` and
`SCHEMA_VERSION`, host-installed identity, exact task grant shaping via `createTaskGrant`, atomic
`registerSpecAndQueue`, a mock router and `runCycle`.

The host installs authority; the actor/model never supplies credentials or grants. Shaping a grant
alone installs nothing. Admission is not dispatch permission; the runtime checks authority again.
This example drafts data in memory — it neither sends a message nor proves an external effect.
Memory needs no SQLite, process channel or durable close. Next: [two actors](two-actor.md).
