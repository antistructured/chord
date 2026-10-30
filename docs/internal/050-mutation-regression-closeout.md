# Block 050 — Mutation / regression closeout

## Pass

**A2 — test-hardening-agent. Regression and focused mutation work completed; actor/host API separation remains BLOCKED if required to be enforced by the exposed full SDK.** All final behavioral gates executed in this pass are green. This is not an unconditional Block 050 PASS, publication approval, A3, or any B pass.

Repository: `/home/d/Workspace/other-projects/chord`. Starting HEAD supplied by the handoff: `08728e48772db14a247add9143669a8e0eab01fa`, branch `base`. Tests exercise the pre-existing dirty working tree plus the additive A2 test file, not committed HEAD. Runtime: `/home/d/.bun/bin/bun` **1.4.3**, Node **v24.22.1**. No source, existing test, manifest, lock, example or prior document was modified. No install, staging, commit, push, tag, publication or destructive Git operation was performed.

## Files inspected

Paths below are relative to the repository root; `#symbol` denotes a search locator, not an HTML anchor.

- `docs/internal/050-citation-closeout.md` — A1 handoff and corrected CAS/Grant facts.
- `docs/internal/050-review.md` — original mutation findings, particularly §5 and the A1 supersession.
- `docs/internal/050-product-contract.md` — Level A scope, Class B host plumbing and gate claims.
- `docs/internal/050-developer-api-review.md` — public surface, §3 trust boundaries, §4 findings, §9 corrections.
- `docs/internal/050-developer-proof-spec.md` — current-versus-proposed distinction, Proof 1 assertions/negatives and revision semantics.
- `packages/core/src/sdk/chord.js` — public wrappers, helper assertions, authority installation, preparation, resume, replay, scheduler/policy/router and inspection methods.
- `packages/core/src/registry/{owner,registry,query,snapshot}.js` — early owner CAS, lower commit CAS, maintenance install, filters and snapshot roundtrip.
- `packages/core/src/contracts/sigils.js` — plain-data cloning, Grant, Approval, AuthoritySnapshot, TaskPacket, RegistryData, StoredTask, Snapshot and HostCommitRequest exact contracts.
- `packages/core/src/{index,platform/index}.js` and `packages/core/package.json` — shipped entry points and exports.
- `packages/core/src/platform/{authorization,task-queue,runtime-loop,state-invariants,journal-audit,policy}.js` and `packages/core/src/runtime/adapter.js`.
- `packages/core/tests/{developer-api-review,integrity,continuity}.test.js`, `packages/core/tests/fixtures/host.js`, the current test-file inventory, and all suite output.
- `packages/core/examples/{quickstart,cross-actor-workflow}.mjs` — shipped public-consumer paths, also executed with both runtimes.

## Files changed

Created only:

1. `/home/d/Workspace/other-projects/chord/packages/core/tests/mutation-regression-closeout.test.js` — **27 additive tests**, **199 assertions** in the final focused run.
2. `/home/d/Workspace/other-projects/chord/docs/internal/050-mutation-regression-closeout.md` — this report.

No production fix was needed to satisfy the supported Level A regressions. In particular, **`createTaskGrant` already calls `Grant.assert`**. No extra production assertion, double validation, new dependency or privilege redesign was added.

Evidence outside the checkout: `/home/d/.hermes/cache/scratch/chord-a2/` contains `entry-hashes.json`, `commands.json`, final command logs, `mutate.py`, `mutation-results.json`, `mutation-results-initial.json`, `mutation-run.log`, `mutation-*.log`, isolated `mutations/<name>/` package copies, and preservation results. Scratch evidence may be pruned. A generic reusable procedure was recorded in the active profile's `owner-cas-mutation-testing` skill, outside this repository.

## Test commands

Unless noted, commands ran from `/home/d/Workspace/other-projects/chord/packages/core`. Logs are in the scratch directory above.

| Command actually executed | Exit | Final result / log |
|---|---:|---|
| `/home/d/.bun/bin/bun test tests/mutation-regression-closeout.test.js` | 0 | **27 pass, 0 fail, 199 expect() calls**; `focused.log` |
| `/home/d/.bun/bin/bun test` | 0 | **193 pass, 0 fail, 1617 expect() calls, 16 files**; `full-suite.log` |
| `/home/d/.bun/bin/bun run src/verify-runtime.js` | 0 | `ALL RUNTIME VALIDATIONS PASSED!`; `runtime.log` |
| `node --test docs/internal/046-state-probes.mjs` (repository root) | 0 | **21 pass, 0 fail**; `state-probes.log` |
| `/home/d/.bun/bin/bun examples/quickstart.mjs` | 0 | `completed: true`, `adapterCalls: 1`; `quickstart-bun.log` |
| `node examples/quickstart.mjs` | 0 | same governed result; `quickstart-node.log` |
| `/home/d/.bun/bin/bun examples/cross-actor-workflow.mjs` | 0 | final revision **14**, protected effect **1**, builder effect **1**, negative effects **0**, approval consumed, snapshot restored, replay verified; `cross-actor-bun.log` |
| `node examples/cross-actor-workflow.mjs` | 0 | same governed outcomes; `cross-actor-node.log` |
| `python /home/d/.hermes/cache/scratch/chord-a2/mutate.py` (repository root; script supplies each copy's cwd) | 0 | unmodified control green; **17 killed / 18 mutants**, **1 equivalent survivor**; `mutation-results.json`, `mutation-run.log` |
| `/home/d/.bun/bin/bun test tests/mutation-regression-closeout.test.js tests/developer-api-review.test.js` (each scratch package copy) | control 0; mutants below | control **33 pass, 0 fail, 246 assertions**; individual `mutation-<name>.log` files |
| `git diff --check -- packages/core/tests/mutation-regression-closeout.test.js` (repository root) | 0 | no tracked diff error; because the new file is untracked, this is not sufficient alone; explicit new-file whitespace check is also recorded in `preservation-final.json` |
| Python entry/exit SHA-256 preservation and new-file scope/whitespace checks (repository root) | 0 | no pre-existing file changed; exactly the two permitted new artifacts; `preservation-final.json` |

## Exit codes and results

Final full suite increased from the A1 baseline **166 tests / 1418 assertions** to **193 tests / 1617 assertions**. All final checkout checks passed. The mutation runner's exit 0 means it completed its measured inventory; a killed mutant itself exits **1** through a behavioral test failure, not syntax/import failure.

### Actual isolated mutation inventory

Each copy starts fresh from the current package, excluding `node_modules`; only dependency resolution is symlinked to the installed dependencies. The runner modifies exactly one named source file per mutant, never the checkout, and runs the two-file focused command above. Exact old/new strings, cwd, exits, assertion totals and failing test names are persisted in `mutation-results.json` and `mutate.py`.

| Copy / mutation | Source locator | Exit | Observed test failure or classification |
|---|---|---:|---|
| `owner-early-cas` — remove only early run CAS | `src/registry/owner.js#transact` | 1 | **32 pass / 1 fail**; A2 owner-guard test, stale invalid snapshot no longer receives `STALE_REVISION` before payload validation |
| `snapshot-run-cas-forwarding` — replace wrapper's run expectation with `undefined` | `src/sdk/chord.js#setAuthoritySnapshot` public wrapper | 1 | **31 / 2**; run-CAS and early-validation precedence tests |
| `authority-next-guard` — remove exact next-revision requirement | `src/sdk/chord.js#setAuthoritySnapshot` inner setter | 1 | **32 / 1**; independent +1 case without the optional authority expectation |
| `authority-expectation-guard` — remove optional authority expectation | same | 1 | **32 / 1**; wrong incoming/next expectation rejects independently |
| `grant-skip-assert` — return object without `Grant.assert` | `src/sdk/chord.js#createTaskGrant` | 1 | **26 / 7**; immediate invalid identifier/type/time-window checks |
| `approval-skip-assert` — return object without `Approval.assert` | `src/sdk/chord.js#createApproval` | 1 | **31 / 2**; self-approval and helper validation (existing API test plus A2) |
| `approval-remove-pending-fallback` — require explicit attempt id | same | 1 | **25 / 8**; omitted id must reuse the reserved attempt |
| `approval-zero-task-revision` — replace `task.task_revision ?? 0` with `0` | same | 0 | **33 / 0**, equivalent for the current supported StoredTask contract; see below |
| `grant-drop-approval-required` — force helper flag false | `src/sdk/chord.js#createTaskGrant` | 1 | **32 / 1**; grant-only requirement with task binding false |
| `approval-foreign-attempt-filter` — remove exact attempt filter | `src/platform/authorization.js#evaluateAuthority` | 1 | **32 / 1**; foreign-attempt approval must not dispatch |
| `approval-stale-task-filter` — remove approval task-revision matching | same | 1 | **32 / 1**; stale approval must not dispatch |
| `raw-replay-admission` — remove authority-denial throw | `src/platform/task-queue.js#replayDeadLetterTask` | 1 | **32 / 1**; revoked allow must reject unchanged |
| `raw-replay-pending-cleanup` — omit pending-attempt invalidation | same | 1 | **32 / 1**; old reservation survives incorrectly |
| `query-consumer-filter` — omit artifact consumer predicate | `src/registry/query.js#queryArtifacts` | 1 | **32 / 1**; nonempty include/exclude fixture |
| `query-domain-state-filter` — omit domain state predicate | `src/registry/query.js#queryDomains` | 1 | **32 / 1**; mismatched owner/state combination must be empty |
| `serialize-empty-tasks` — serialize an empty task map | `src/registry/snapshot.js#serializeRegistry` | 1 | **32 / 1**; nonempty roundtrip validation rejects the lossy export |
| `runtime-no-adapter-code` — remove machine code | `src/platform/runtime-loop.js#runRuntimeCycle` | 1 | **31 / 2**; existing API-code regression and A2 raw-replay setup |
| `audit-ignore-clock` — always use wall clock | `src/platform/journal-audit.js#createDeterministicAuditReport` | 1 | **32 / 1**; existing supplied-clock API regression |

**Equivalent survivor, not silently counted as a kill:** `StoredTask` and `TaskPacket` are exact schemas and do not allow a `task_revision` property (`packages/core/src/contracts/sigils.js#StoredTask`, `#TaskPacket`). Current stored tasks therefore use the zero fallback. A2 actually submitted a whole-run candidate with `task_revision: 7`: `commitRun` rejects `INVALID_SHAPE`, with state unchanged. Hardcoding the helper's revision to zero is equivalent for supported states today. The stale-approval-revision test remains meaningful: an approval may carry revision 1, but the current task's effective revision is 0 and dispatch must reject it. The historical review's claim that forcing this helper field to zero was caught is not re-endorsed by A2.

**Iteration evidence:** the first new nonzero-task-revision fixture failed because it assumed that field was permitted in StoredTask. Both focused/full runs initially exited 1; those logs are retained as `focused-initial-failed.log` and `full-suite-initial-failed.log`. The fixture was corrected to assert the actual schema limitation, not by changing production code. An initial exact-next-guard mutation survived because every bad revision also supplied a failing optional expectation; A2 added expectation-free negative cases and the final isolated mutant fails. The first mutation orchestration attempt stopped on the failed control; another attempt stopped on a nonexistent audit replacement string. The runner was corrected against the inspected clock expression and all 18 final probes completed. These were test/probe defects, not hidden production fixes.

**Deferred / not claimed:** this is a focused inventory, not exhaustive mutation coverage. The original review's exact scripts for helper-install side effects, a missing `STALE_ATTEMPT` code on the old-active-attempt catch branch, and unspecified redundant type-check removals were not available here. Those exact historical mutations were not replayed or declared killed. The existing no-install tests plus A2's unchanged-registry assertions remain regression coverage for helper side effects, not a new measured side-effect mutation result. Redundant guards can be equivalent if an exact contract rejects the same state first; do not weaken contracts or invent unsupported stored state just to manufacture a mutation kill.

## Invariants verified

- **Two independent CAS counters:** stale `expectedRevision` on snapshot installation rejects without changing any canonical collection, revision or history; current run CAS is insufficient if exact +1 or optional incoming-authority expectation fails. Correct expectations install once and append an owner commit. A foreign-run snapshot rejects unchanged even with the correct run expectation.
- **Early owner CAS is actually mutation-sensitive:** stale invalid snapshot data yields `STALE_REVISION` before inner contract evaluation. The separate direct-owner assertion requires zero callback invocations on stale CAS. Lower `commitRun` also checks CAS, so merely testing a valid stale candidate would not prove the early guard is present. Removing only the owner guard is now killed.
- **Validated helper output:** invalid packet, identity, grant id type, negative timestamp and non-increasing windows reject at helper call, before installation. A valid grant installs through the real snapshot contract, admits a task and dispatches exactly once. Mutating the retained helper output after installation does not alter authority; a corrupted output is rejected downstream unchanged. The live `Grant.assert` is preserved without adding another assertion.
- **Approval correlation:** missing reservation cannot be implicitly approved; missing task/approver have machine codes. The pending-attempt fallback is exercised. Missing, foreign-attempt, stale-revision, expired, consumed and rejected approvals invoke zero adapters and commit zero execution results; exact approval then succeeds once and is consumed by the expected attempt. Foreign-run approval installation and unsuccessful paused-run resume reject unchanged. Grant-only approval requirements cannot disappear behind a binding-level flag.
- **Public replay:** the raw export re-evaluates authority, resets retry/lease/error state, clears both attempt reservations and preserves a **nonempty consumed approval**. Missing/non-dead-letter calls return null. It mutates caller-owned data only; SDK canonical state is unchanged until `chord.replayTask` runs through the owner. This does not equate the raw helper with the stronger SDK operation/history path.
- **Queries and serialization:** nonempty artifact producer/consumer/status and domain owner/state inclusion/exclusion, queue status/entity filtering, detached SDK query results, snapshot metadata/counts, full roundtrip, restored-instance isolation, completed work and no-effect replay canonical equality are exercised.
- **Actor-data isolation within the supported execution seam:** request-authored `commitRun` fields are rejected by exact contracts; scoped context carries no privileged function; adapter packet/context contain no owner, registry, authority or `commitRun` handle. The exact context keys are asserted. This is not a sandbox against a host that deliberately closes over or hands out the SDK.
- **Host administration remains invariant-checked but privileged:** whole-run JSON maintenance can rewind authority and add a contract-valid grant without a credential; stale maintenance returns a machine code unchanged, immutable-task rewrite throws `IMMUTABLE_TASK` unchanged, and successful host commits are evidenced as `host_commit`.
- Entry/exit hashes preserve all pre-existing dirty files. Only the two additive artifacts named above are introduced.

## Known limitations

- New tests use Bun's existing test runner; they are not a newly supported Node-native test suite. Node separately exercised both shipped examples and the 21 existing standalone probes.
- Plain JavaScript callbacks and embedding-host access are trusted. Exact data validation is not authentication, process isolation or a hostile-plugin sandbox.
- `replayDeadLetterTask` is a public caller-owned mutator, not an SDK commit port. Its synthetic old-attempt cleanup fixture deliberately uses raw caller-owned data; it is not claimed to be a RegistryData-valid imported execution history. Use `chord.replayTask` for canonical state/evidence.
- Snapshot creation and some evidence timestamps still use wall clock/random ids. Roundtrip tests compare registry data, not timestamps from independently generated exports; deterministic audit assertions supply an explicit clock.
- No durable storage, crash recovery, cross-process fencing, Proof 2/3 machinery, restricted actor facade, pack/publication verification or release identity/legal gate was implemented.
- The focused mutant count is not a repository-wide mutation score. The sole surviving tested mutant is explicitly classified above; unspecified original-review mutations remain deferred, not implicitly passed.

## Blockers

**A2-B1 — no enforced host/actor distinction on an exposed full-SDK `commitRun` endpoint.** The current API accepts exactly `{ expectedRevision, nextRegistry }`; it has no host credential or actor/host port distinction (`packages/core/src/contracts/sigils.js#HostCommitRequest`, `packages/core/src/registry/owner.js#install`, `packages/core/src/sdk/chord.js#commitRun`). A2's `BOUNDARY LIMITATION` characterization test passes a JSON roundtripped request and observes **`{ ok: true, revision: previous + 1 }`**, authority rewind and an added grant. The same bytes cannot be classified as trusted-host versus actor-authored by this exposed API.

Actor **data alone** cannot acquire a reference through supported packet/projection arguments, as the isolation regression verifies. Nevertheless, if “actors must not be able to invoke administrative commit even when the full SDK is exposed” is an acceptance criterion, **the current API cannot enforce it**. Do not report that stronger criterion as passing. Host-side authenticated allowlisting / a restricted actor port, or an explicitly approved additive API distinction, needs a separate scoped design/implementation decision. A2 did not silently alter the intentionally privileged maintenance contract or weaken its invariant checks. This blocker is not resolved by green tests or by calling the supplied JSON “host data.”

Existing release/publication blockers from A1 remain unchanged. No publication approval is granted.

## Next-pass readiness

The additive regressions and all final checks are ready for independent A3 review **if separately authorized**. The parent must carry **A2-B1** as an explicit gate decision; an unconditional Block 050 PASS or advancement to B1–B8 is not justified by this report. Preserve the existing dirty working tree and the A1/A2 evidence. **A3 and all B passes were not executed.**
