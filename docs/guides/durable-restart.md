# Durable restart

[Setup](README.md#setup) first. From the repository root, use fresh proof directories:

```bash
"$N" packages/core/examples/process-recovery.mjs "$CHORD_EVIDENCE/restart-node" "$N"
"$B" packages/core/examples/process-recovery.mjs "$CHORD_EVIDENCE/restart-bun" "$B"
```

The [shipped proof](../../packages/core/examples/process-recovery.mjs) prints `gate: "B5 PASS"`;
that is a proof identifier, not Level B promotion. Inspect `summary.json`, per-process evidence and
`effects.ndjson` in each output directory. Separate writer/reader PIDs and stop/join are asserted.
An exact pending approval survives restart with fresh host attestation. SIGKILL after a simulated
fsynced effect but before its acknowledgement produces uncertainty and no automatic retry.

For your host use public `createChord({storage:{path,mode:'create'|'existing'},trustedHost:{now}})`.
Use an absolute private local SQLite file and retain it. The host **must stop/join the old runtime**
before opening existing v1 storage. Recreate router/policy, executable services and authenticated
sessions; do not reinstall constructor bootstrap authority on existing storage. `close()` is synchronous,
does not drain effects and should follow awaited cycles. See the
[complete lifecycle block and failure table](../../packages/core/README.md#memory-and-durable-modes).

This is experimental exclusive sequential restart, not concurrent scheduler ownership, a migration,
power-cut proof or physical effect rollback. Snapshot import is different. A missing committed result
is not evidence of nonexecution: follow [unknown-outcome reconciliation](README.md#unknown-means-reconcile-not-retry).
For concurrent local actors use the separate v2 [cross-process mode](cross-process.md).
