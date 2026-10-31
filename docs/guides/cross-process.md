# Cross-process collaboration

[Setup](README.md#setup) first. From the repository root:

```bash
"$N" packages/core/examples/two-process-coordination.mjs "$CHORD_EVIDENCE/actors-node" "$N" "$N"
"$B" packages/core/examples/two-process-coordination.mjs "$CHORD_EVIDENCE/actors-bun" "$B" "$B"
```

The [public-export-only script](../../packages/core/examples/two-process-coordination.mjs) launches
an actual owner, actor and standby on one machine. Inspect `evidence.json`, `processes.json`,
`actor-transcript.json`, `final.json`, `replay.json`, `reopened.json`, `effects.ndjson` and the two
`.effect.txt` files. Each pair asserts revision 14, six receipts, two attempts/results/file effects,
combined replay/reopen equality, standby denial and joined child exits. The human approval is
simulated fresh host attestation, not demonstrated human authentication; proof time is fixed at 100.

Use public `createCoordinatedChord` with a private v2 file and pinned run/incarnation, explicit
`owner.acquire`, preinstalled host authority/policy, dedicated fresh authenticated ingress and
actor-side `createActorClient`. Actors send bounded canonical commands, not arbitrary host methods.
Keep credentials, grants, admin/owner/store handles and database paths out of actor messages.
The [exact ports and command table](../../packages/core/README.md#052-local-fenced-owner-and-actor-mode)
are the reference: the coordinated facade intentionally omits legacy convenience methods.

052A's default framed IPC wraps unchanged canonical commands in fresh per-wrapper session and
per-send request IDs. Injected transports must echo both, including repeated reads/retries; there is
no silent raw client fallback. Raw host compatibility peers manage their own correlation. Delivery
IDs are not authentication or durable operation IDs. Unknown write acknowledgement requires the
unchanged original command and fresh authentication to inspect/recover its receipt, not blind resubmission.

Drain/join cycles, release a live owner explicitly, close handles, detach ingress, close clients and
join children; these are separate operations. Renewal is explicit before the fixed 30-second lease
expires; a lost/released owner needs a fresh handle/acquisition. No automatic failover daemon,
multi-machine consensus, hostile-OS sandbox, v1/v2 migration or exactly-once effects is provided.
See [unknown outcomes and physical fencing](README.md#unknown-means-reconcile-not-retry).
