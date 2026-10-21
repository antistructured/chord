# 040 — Runtime and state audit

Pass 3 audit completed; required runtime verification FAILED. Block status PARTIAL; do not advance to implementation/Block 2 until explicit handoff review. Continue remaining audit passes to record full scope, not fixes. Consulted passes 1–2.

## Existing run traced
Executed `bun run src/verify-runtime.js` (existing fixture, in-memory fake adapter). Observed parse IntentSpec -> register one spec -> create one packet -> queue one task -> attempted success cycle -> `Completed tasks: 0` -> `Task did not complete` at verify-runtime.js:72. Script exits 1 (the following filtered test command in the same shell succeeds; shell final status is not this script's result). Baseline pass will preserve independent exits.

Source path (paths relative to packages/core):
1. `src/sdk/chord.js:20-87` parses text and normalizes, without schema/authentication. registerSpec at :89-92 mutates registry and appends summary event.
2. `src/execution/task-packets.js:4-28` creates intent packet with target default, random/time-derived ID and descriptive constraints. No actor discovery or permission evaluation.
3. SDK :101-119 validates minimal packet shape, copies to task dictionary, enqueues mutable queue entry. Registration not transactional with packet generation.
4. `src/platform/task-queue.js:24-36` orders priority descending, availability ascending, queue_id localeCompare; marks leased synchronously before await. Fixed 30-second expiry is recorded but no reclaim exists. Registry task status is not set leased.
5. `src/platform/adapter-routing.js:5-11` chooses exact, first matching prefix in insertion order, exact.default, fallback. Routing is not authentication or authorization.
6. `src/platform/runtime-loop.js:24-25` invokes adapter with live task and entire mutable registry, then ingests output. No permission, grant, approval, cancellation or expiry check before effects.
7. `src/registry/registry.js:83-102` calls **unbound `assertExecutionResult`** at :84; imports only stableId and deepClone. Thus success ingestion throws before result recording. A second **unbound `markQueueEntryStatus`** at :92 will also fail once the first is corrected. Static defects; observed fixture corroborates failed success path.
8. Runtime catches ingestion errors as execution failures and schedules retry (:30-37). A completed external effect could therefore be repeated; no idempotency/receipt protection. No actual external provider invoked in this audit.
9. Intended result transitions are outcome-based task complete/failed, artifact accepted/rejected, domain complete/blocked. These are SOURCE-ONLY intended behavior, not a successful observed run. No legal transition graph/version checks.

## Handoffs: observed code, not proven end-to-end
`src/registry/registry.js:46-59` registers producer/consumer and transitions artifact based on caller-provided status. `createHandoffTaskPackets` makes reviewer packets; authority is descriptive constraints only. Parser omits requested_action, status, handoff, evidence and other object-level fields, so text and direct object paths differ. No automatic verified handoff completion chain established by tests.

`src/demo/callaback-demo.js:51-65` calls fake adapter directly, bypassing queue/runtime; classification and notification are hardcoded console output. Not evidence of kernel-governed SMS or real-world completion.

## Concurrency / state decisions
Mutable dictionaries/arrays, queries return live records; no CAS, transaction, durable ownership, duplicate task admission guard, delivery dedupe, or immutable transition core. Requeue same ID overwrites task dictionary and appends queue entries; status helpers update first matching task ID, not lease/attempt identity. Lease limits exist in policy but runtime does not consult them. Record as P0 rather than broad refactor; retain layout.

## Evidence / tests / changes
Inspected prior reports plus `src/{sdk/chord.js,execution/task-packets.js,execution/results.js,registry/registry.js,platform/runtime-loop.js,platform/task-queue.js,platform/adapter-routing.js,platform/policy.js,verify-runtime.js,demo/callaback-demo.js,demo/fake-sms-adapter.js,demo/fake-user.js}` and hardening test.
`bun test tests/hardening.test.js -t 'Dead-Letter|Dequeue'`: 2 pass, 2 filtered out, 0 fail, 6 expect calls. These test thrown adapter failure/requeue and priority, not successful ingestion or multiworker safety.
Changed: this report only. Blockers: broken result ingestion, replayed side-effect risk, absent authority/approval/cancel/version/idempotency enforcement. Next audit pass READY; preview readiness BLOCKED.
