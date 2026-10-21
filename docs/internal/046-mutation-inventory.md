# 046 — Pass 2: Canonical mutation and ownership inventory

Scope: all first-party canonical writers found in SDK, registry, queue/runtime, attempts, transitions, handoff/approval, journal and snapshot modules. Source locations below are under `packages/core/src`. Host trust is distinct from an evaluated grant. No function implements distributed CAS.

Legend: V = Sigil/closed validation; H = trusted-host operation; E = explicit evaluator; R = expected run revision; C = clone/candidate commit; J = event coupling; N = no-mutation-on-rejection. “partial” is not a guarantee.

| Operation / location | Writes | V / authority | R / C | J / N |
|---|---|---|---|---|
| createRegistry registry/registry.js:9 | initializes every field incl run identity | constructor internal | initial rev 0 / fresh object | no genesis event |
| createChord sdk/chord.js:20–26 | task_queue, pending/active defaults | injected RegistryData cloned, otherwise constructor; H | none / no general owner | none |
| setAuthoritySnapshot sdk/chord.js:40–59 | authority, run revision, journal; merges consumed approval fields on clone | AuthoritySnapshot; H, no client grants | optional authority precondition only, no run precondition / direct | event after mutation; validation-before-write for tested normal data |
| installGrants sdk/chord.js:62–80 | authority, run revision, journal | Grant+AuthoritySnapshot; H callback, no E before installation | none / replaces authority only | event after mutation; persists even if enclosing admission later fails |
| registerSpec sdk/chord.js:125; registry/registry.js:51–99 | specs, artifacts, domains, histories, journal | assertSpec; H descriptive, not E | no revision increment / progressive | event after writes; not coupled with admission |
| registerSpecAndQueue sdk/chord.js:186 | above plus queue/task/grants | validates constituents; admission E occurs later | no R / no C | **rejection retains spec/event**, probe 5 |
| queueTaskPackets sdk/chord.js:139–183 | tasks, queue, run revision, journal (+grants via callback) | packets/bindings, E admit; priority option not fully validated | no R / per-member direct writes | events before final revision increment; **grant leak on denial**, probe 6 |
| registerTask / execution/results.js batch | tasks | TaskPacket+TaskAuthority, H internal; not independent E | none / direct assignment | no own event/rev; batch may write progressively outside SDK preflight |
| enqueueTask platform/task-queue.js:10 | task_queue | no own Sigil/E; public H plumbing | none / direct push | no own event/rev; returns live entry |
| prepareAttempt sdk/chord.js:193; attempts.js:8–25 | pending_attempts | Attempt; H, queued guard; no E | none / direct | no own revision/event; probe 10 |
| invalidate/activate/clear attempt helpers attempts.js:28–49 | pending/active maps | internal caller-dependent | none / direct | no own event/rev; activation uses dispatch revision |
| cancelTask sdk/chord.js:205 | task, queue, attempts, run revision, journal | H; guarded task transition | optional R / direct multi-field | event after writes; repeated cancel may bump again (same-state helper no-op) |
| replayTask sdk/chord.js:226 | task/queue reset, attempts, run revision, journal | H + E admit; no no-effect evidence for uncertain | optional R / direct multi-field | event after writes; consumed approvals preserved; unknown outcome may be requeued (probe 11) |
| replayDeadLetterTask task-queue.js:107 | dead-letter task/queue, attempts, run revision | H + E admit | no R / direct | **no event**, returns live entry |
| selectReadyTask task-queue.js:27 | read only, returns live entry | no V/E; internal selector | n/a | alias used by writers |
| leaseTaskEntry/dequeueReadyTask task-queue.js:38–47 | queue status/lease | transition guard; H plumbing, not E | no R / direct | no own event/rev |
| markQueueEntryStatus task-queue.js:50 | queue status, arbitrary extra fields | transition guard; H plumbing | no R / direct | no own event/rev |
| scheduleTaskRetry task-queue.js:72 | queue counter/status/time/error, task status/counter, attempts, run revision | transition guards; H caller must ensure pre-dispatch | no R / progressive; counter before status validation | runtime caller appends event later; rejected transition can already change retry counter |
| runRuntimeCycle runtime-loop.js:44 | reservation, lease, task, approval consumption, active attempt, revisions, journal, results | E dispatch/commit, packet/result validators | dispatch revision guard on completion / no whole-run C | separate state/event writes; **no run-state guard**, probes 3–4 |
| registerExecutionResult registry/registry.js:135 | tasks/results/queue/artifact/domain histories, attempts, run revision | Outcome + correlation + transition validation; E in runtime caller, not helper | helper lacks own dispatch CAS / progressive writes | events added in runtime afterwards; no general rollback |
| transitionTask/Queue/Artifact/Domain helpers | record state/history | graph guard, H internal | no R / direct | caller-dependent events/rev |
| markTaskUncertain transitions.js:134 | tasks/queue, attempts, run revision, journal | graph guard; H runtime | no R / direct | event after writes; does not overwrite terminal task states |
| proposeHandoff handoff.js:82 | handoffs, run revision/correlation/causation, journal | truthy actor IDs; no closed Sigil or principal/grant E | optional R / direct | event after writes; returned handoff cloned |
| respondToHandoff handoff.js:114 | handoff status/response/reason, run fields, journal | target actor string equality/expiry; no authenticated principal input or Sigil | optional R / progressive | no general rollback (reason coercion follows status mutation); stale/duplicate tested only on subset |
| pauseForApproval approval-flow.js:7 | run state/correlation, approval_pause, revision, journal | H lifecycle guard only; no approval contract/E | optional R / direct | event after writes; params can make later snapshot invalid |
| resumeRun approval-flow.js:22 | run, clears pause, revision, journal | H state/expiry; approval_id not validated against authority | optional R / direct | event may claim any supplied approval ID, not validation evidence |
| rejectApproval/cancelRun approval-flow.js:39–78 | run/pause; cancel tasks/queue and all attempts; revision/journal | H lifecycle; no separate E | optional R / direct | separate writes/event; late results tested for cancelTask, broader run races NOT TESTED |
| appendRegistryEvent event-journal.js:3 | journal | no JournalRecord validation here; payload/meta live refs | no R / direct push | returns live event, no state coupling |
| commitRun registry/registry.js:31 | swaps owner reference; may edit caller candidate revision | RegistryData.assert return clone **discarded**; H | optional R, accepts arbitrary forward revision / reference swap on supplied owner | no event; SDK passes ephemeral owner, probes 1–2 fail |
| importRegistry snapshot.js:25 | modifies detached validated clone: clears active attempts, running/leased->uncertain | Snapshot+RegistryData; H trusted restore | no authority/source freshness check against existing owner / no store commit | no import/reconciliation event or revision bump on returned transformed state |
| setAdapterRouter/setRuntimePolicy sdk/chord.js:279 | mutable host config (outside serialized canonical data) | H; policy Sigil, router executable | no run R/revision invalidation | no event; adapter/router object aliases retained |

## Ownership / alias classification
| Surface | Actual ownership | Consequence |
|---|---|---|
| registry, getRegistry(), registerSpec().registry | live canonical object, explicitly H in root README | no actor sandbox claim; ordinary consumers cannot safely receive it; no enforcement against bypass |
| exportRegistry()/serializeRegistry() | clone through Snapshot.assert / JSON string | detached; control 19 passes |
| getAuthority() | deep clone | detached in isolation; projectContext leaks nested authority scope separately |
| getRunState()/getRunRevision() | string/number | detached primitives; values remain stale after fake SDK commit |
| projectContext() | new summaries but shared grant scope and artifact producer/consumer arrays | scope mutation changes live authority without revision; no-grant identity sees all tasks/queue |
| queryArtifacts/queryDomains/queryQueue/queryDeadLetters | new arrays with live record elements | consumers can mutate canonical records |
| inspectEvents() | journal itself if unfiltered; filtered arrays still live events | append/splice/content edits bypass governance |
| replayJournal()/inspectAudit() | diagnostic wrappers with live payloads/records/queue | audit read can mutate canonical truth |
| prepareAttempt return | deepClone | caller cannot mutate reservation through returned value |
| proposed/responded handoff return | deepClone | detached; not proof underlying transition atomicity |
| queueTaskPackets/createTaskPackets returns | stored task is cloned before retention | packet return normally detached from stored task; issueGrants host callback can run arbitrary host code |
| adapter packet/context | deeply frozen cloned packet, correlation-only context | existing adversarial test passes; adapter code remains trusted in-process |
| low-level queue/event APIs | live objects by design, publicly exported H | must not pass to untrusted callers; exported means public, not hidden |

## Coverage limits
Inventory is source-derived plus named probes, not proof of every failure mode. Whole-run same-revision commits, compound denial, projection/event aliases, and pause/rejection dispatch were exercised. Stale handoff acceptance, approval/cancelRun races, duplicate mutation delivery, all malformed snapshot cross-record variants and randomized sequences still need focused tests after ownership repair. Existing late-result/cancelTask, authority-revision changes and stale cancel tests pass. Do not label unexecuted cases PASS.

Gate: BLOCKED; see 046-state-atomicity-audit.md.
