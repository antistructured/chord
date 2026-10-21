# 047 — Pass 8: Public API compatibility

Gate: COMPLETE. Exact discovered exports/member inventory: 047-evidence/public-surface.json. No stable API designation. Package name/version/dependency/entry paths unchanged.

## Classification
- **Stable:** none (preview).
- **Experimental public:** createChord and SDK read/parse/packet/lifecycle/coordination APIs; pure replay exports reduceTrace/replayNoSideEffects/diffTraces/canonicalProjection, SCHEMA_VERSION.
- **Experimental trusted-host administration:** authority/grant configuration, queueTaskPackets/registerSpecAndQueue, prepareAttempt, runCycle, all lifecycle mutations, replayTask/reconcileTask, generic commitRun, full registry/authority/event/query/audit/export inspection and trusted snapshot import. Host resolves authenticated identities; do not expose this SDK directly as a client endpoint. projectContext is the scoped view, not an authentication service.
- **Experimental trusted-host low-level plumbing:** root/platform queue selection/lease/retry/requeue, event append/list, routing/policy/scheduler, runRuntimeCycle on caller-owned state and journal diagnostics. These are public exports, not hidden internals; they must not be forwarded as an actor surface. Plain-registry low-level runtime uses a detached simulation owner and cannot update an SDK's private state.
- **Internal:** unexported registry owner, transaction capture, contract internals, packet/result shell helpers, state invariants, raw reconciliation helper, IO/demo internals. Physical tarball src presence does not create a documented import subpath.
- **Deferred:** distributed persistence/CAS, process federation, authenticated network API, hostile adapter sandbox, arbitrary semantic/global operation dedupe, Level C simulation/fork, cryptographic evidence signing.

## Intentional safety changes / migration
1. SDK registry/getRegistry/query/audit/event/projection/export data is detached. Mutating it no longer changes canonical truth. Use SDK operations; never reset statuses/attempts/revisions directly.
2. Whole-run host commit accepts exactly expectedRevision and nextRegistry, validates clone/immutable payloads/transition/history, requires +1 and installs one winner. Caller operation overrides and journal rewriting reject. Use dedicated kernel operations for lifecycle/effect transitions.
3. Compound registration/grant/admission rejects atomically. Invalid batch/queue fields cannot leave spec or grant residue. Reentrant host callbacks fail before install/effects.
4. Resume requires active host-attested human principal; protected queued tasks need exact valid pending-attempt approval. Valid task grants do not bypass paused/terminal runs.
5. Unknown/blocked re-admission requires explicit verified no-effect evidence/reconciliation. New IDs cannot evade structural run-local operation quarantine. Confirmed/compensated work is not blindly repeated. Identical completed operation recreation now rejects; use meaningful distinct business inputs for genuinely different work.
6. Context obeys active exact grants/denies and is bounded. Grantless actors get no protected records; no implicit broad fallback. Full admin inspection is not scope-filtered and must remain host-only.
7. Authoritative reducer now requires versioned sufficient history. Empty/legacy diagnostics are no longer successful reconstruction. Diagnostic replayJournal remains distinct. Import with in-flight work adds a committed quarantine revision/event rather than silently rewriting state.
8. Public root now exports modern replay functions, projection helper and SCHEMA_VERSION. Canonical example imports public paths only, not undocumented src modules. Use root importRegistry, not a nonexistent SDK instance method.

Root/package/failure recovery docs provide current executable commands and limits in INTEGRITY.md. No language/framework/package split/dependency/version migration. Original tests retain 126 cases with explicit safe fixture migrations and stricter evidence checks; immutable046 probes unchanged.
