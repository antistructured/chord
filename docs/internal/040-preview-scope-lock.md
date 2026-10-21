# 040 — Preview scope and surface lock

Pass 7 COMPLETE as candidate scope proposal; preview readiness BLOCKED, Block 1 PARTIAL. Version remains 0.3.0. Proposed release label: 0.4.0-preview.1, not authorized for version change/publication. Consulted reports 1–6 and runtime export discovery.

## Concise candidate preview contract
Chord aims to preserve trustworthy coordination across independent actors and sessions, not merely run multiple agents. This checkout currently provides an **experimental in-memory coordination scaffold**, not that full guarantee. The candidate preview retains one ES-module JavaScript package and the current folders. It will expose explicitly gated host-mediated execution and truthful task/effect evidence only after P0 tests pass. Identity authentication is a host concern distinct from schema validation; actors cannot mint grants. In-process adapters are trusted host code, and all returned data is untrusted. No sandbox, distributed consensus, durable cross-session recovery, deterministic generation or exactly-once external effects promised. Journal viewing is diagnostic; historical reconstruction remains deferred. Retry is an authorized new execution attempt, never historical replay. No public API is designated stable by this audit.

## Priority / acceptance matrix (locked candidate, not a mandate to fix everything in Block 2)
| ID | Priority | Minimal scoped work | Required evidence before preview |
|---|---|---|---|
| C1 | P0 | Resolve intended SigilJS package/version; replace imitation checks at ingress/result/snapshot/policy boundaries | Actual installed API inspected; closed payload and malformed/unknown enum/key/range tests; valid fixtures retained |
| C2 | P0 | Repair result-ingestion missing bindings; consistent status/outcome and explicit completion evidence | Success fixture passes; negative/absent output cannot report completion; requested vs attempted vs confirmed distinguished |
| C3 | P0 | Trusted-host identity/grants, scoped execution gate, revocation/expiry, human approval and cancellation semantics | Deny missing/self-asserted/out-of-scope/expired/revoked grants; missing/stale approval and canceled task never invoke adapter; approvals bound to immutable action scope |
| C4 | P0 | Define single-process task/attempt ordering, admission dedupe, version/lease ownership, bounded retry and effect idempotency boundary | Duplicate delivery/stale completion/concurrent cycles tests; caps enforced; post-effect commit failure not blindly retried; ambiguous external outcomes explicit |
| C5 | P0 | Separate diagnostic journal view from authorized re-execution; validate imported snapshots and sanitize errors | View never calls adapter; re-execution requires authority; malformed import fails before mutation; secret-bearing error test redacts; documentation makes reconstruction unsupported |
| C6 | P0 | Honest executable baseline/docs/package surface | Fix advertised demo target without rebranding; unit + runtime + controlled demo green; sound negative tests; concise public experimental labels; available lint or explicit documented omission; fresh tarball consumer in later packaging/release block |
| L1 | P1 | Durable authoritative history and snapshot migration / true replay reducer | Separate design and tests for missing/corrupt entries, state reconstruction and zero effects; not implied by current journal |
| L2 | P1 | Harden ergonomic parser/query immutability and host adapter context | Compatibility review plus regression tests; no sweeping rewrite |
| L3 | P1 | CI, package file whitelist, Node portability and expanded executable examples | Isolated acceptance in later block; do not pretend current npm test is Node coverage |
| D1 | P2 | Distributed multiwriter persistence, cross-organization trust federation, hosted service | Deferred, not preview scope |
| D2 | P2 | Product-specific kernels, payments, branding rewrite, framework migration, TS conversion | Excluded |
| D3 | P2 | LLM-specific orchestration, deterministic model outputs, sandboxed hostile plugins | Deferred/no guarantees |

This scope does not claim durable independent-session coordination yet. That strategic goal requires L1 evidence and explicit promotion; do not market an in-memory preview as already satisfying it. If C3/C4 cannot fit bounded patches, disable/defer unsafe effect execution in the preview rather than invent a distributed platform.

## Public export classifications
Runtime discovery via Bun self-reference import of each manifest path succeeded (not a tarball consumer install). Source barrels match discovered symbols. Every **currently exported** value below is **experimental**, including low-level plumbing; labeling it internal would conceal its existing accessibility. No removals in this block.

| Import path / source | Exact exported names | Classification |
|---|---|---|
| `@chord/core/sdk` -> sdk/chord.js | createChord | experimental |
| `@chord/core/platform` -> platform/event-journal.js | appendRegistryEvent, listRegistryEvents | experimental diagnostic/trusted-host |
| platform/task-queue.js (same path) | createTaskQueue, enqueueTask, dequeueReadyTask, markQueueEntryStatus, listQueuedTasks, scheduleTaskRetry, replayDeadLetterTask | experimental mutable trusted-host; last item re-execution |
| platform/adapter-routing.js (same path) | createAdapterRouter, resolveAdapter | experimental routing, not authority |
| platform/policy.js (same path) | createRuntimePolicy, computeBackoffDelayMs | experimental configuration, not enforced security policy |
| platform/journal-audit.js (same path) | replayRegistryJournal, createDeterministicAuditReport | experimental diagnostic, names do not establish reconstruction/determinism |
| platform/runtime-loop.js (same path) | runRuntimeCycle | experimental, currently broken success ingestion |
| `@chord/core` | all SDK/platform names above, plus queryArtifacts, queryDomains, listDeadLetterTasks, exportRegistry, serializeRegistry, importRegistry | experimental; query/snapshot source in registry/ |

`src/types/index.js` has no runtime exports. SDK instance members all experimental: createTaskPackets, exportRegistry, inspectAudit, inspectEvents, parseText, queryArtifacts, queryDeadLetters, queryDomains, queryQueue, queueTaskPackets, registerSpec, registerSpecAndQueue, registry, replayJournal, replayTask, runCycle, serializeRegistry, setAdapterRouter, setRuntimePolicy. Raw registry is trusted-host mutable access, not a secure actor interface.

CLI script surfaces `chord:run`, `chord:replay`, `chord:audit`, `demo:via`: experimental (demo currently broken); no installed bin command. `src/contracts/`, execution helpers, registry mutation helpers, runtime IO, utilities, demo adapter/script and verification script: **internal**, no manifest subpath export; physically packed files do not imply support. Example folders are experimental descriptions, not executable implementations. Stable: **none**. Deferred: historical state replay, durable session recovery, public authenticated network API, sandboxed adapter execution, cross-process guarantees.

## Compatibility and boundary decisions
Keep package shape/export paths; stricter schemas, denial without host grants, explicit results, immutable ownership, retry gating and safe error payloads will intentionally reject inputs previously accepted. Document these preview behavioral breaks before release; no silent migration or invented validation API. No API behavior changed by this audit. Low-level exports cannot safely be exposed to untrusted actors; hosts remain responsible for their process and credentials.

## Evidence / inspection / changes
Inspected prior six reports, manifest, root/SDK/platform barrels, registry query/snapshot, SDK returned object; Bun self-import export/member enumeration succeeded with exit 0. `git diff -- packages/core/package.json packages/core/bun.lock` empty. Tests: baseline inherited from pass 6 (unit PASS, runtime/demo FAIL); no additional behavioral tests. Files changed: this scope report only. Blockers C1–C6 remain; next audit pass READY; implementation/release BLOCKED pending handoff authorization.
