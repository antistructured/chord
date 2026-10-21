# CHORD — Block 6A: Release Integrity Correction

## Executive summary
**Status: BLOCKED. Final release decision: NO-GO.** Audit passed into Pass 2; state/evidence reproductions require coordinated foundational correction. As directed, stopped on unresolved P0s rather than carrying unsafe shortcuts into later passes. No implementation fixes or release-ready artifact are claimed.

## Initial and ending repository state
- Repository `/home/d/Workspace/other-projects/chord-v0.3.0`; branch `main`.
- Starting and ending HEAD: `ba3e37ea035a2862e06766ed7f90513babf945b0`.
- Existing tracked modifications and untracked later-block work preserved. Baseline hashes and diff/status: 046-evidence/. Final preservation check compares every original file hash, not just git diff; see preservation.json and ending-git.txt.
- Added only `docs/internal/046-*` reports, executable audit probes and evidence. No prior reports/source/tests/manifest/lock changes. No clean/reset/squash/commit/branch switch/push/tag/version bump/publication.
- Package remains `@chord/core@0.3.0`; proposed v0.4.0-preview.1 is not prepared or approved.

## Pass disposition
| Pass | Gate and actual work |
|---|---|
| 1 — Reality Audit | READY for bounded state audit; release gaps recorded. Required source docs all present/read. |
| 2 — State & Atomicity | BLOCKED; inventory complete for inspected first-party writers; 18 failing safety acceptance probes. |
| 3 — Governed Workflow | NOT EXECUTED after stop; existing defect confirmed, no repaired example claimed. |
| 4 — Evidence & Replay | NOT EXECUTED corrective pass; source/probe evidence establishes missing Level B. |
| 5 — Consumer Package | NOT EXECUTED; dry-run only during baseline, no installed full workflow. |
| 6 — Adversarial Verification | NOT EXECUTED complete pass; existing security suites rerun and targeted state probes executed as audit evidence. |
| 7 — Architecture Conformance | NOT EXECUTED complete pass; preliminary source/metadata findings recorded. |
| 8 — Independent Release Gate | NOT EXECUTED full gate; early-stop NO-GO plus separate independent read-only stop review. |
| 9 — Final Report | Early-stop report/handoff produced; not completion of remaining requirements. |

## Prior reported guarantees independently reviewed
Blocks 3–6 claim whole-run CAS, bounded safe projection, pause enforcement, reconstruction, real approval continuation and sufficient external package APIs. The current implementation and tests substantiate narrower behavior: task-level authorization/late result guards, validated snapshots, lifecycle record changes and diagnostic event accumulation. Reports and green commands are not proof of the stronger guarantees.

## Findings confirmed/refuted
| Finding | Disposition |
|---|---|
| F6A-01 manual canonical mutation | CONFIRMED / OPEN P0: example :69–71, test :67–69 |
| F6A-02 full-state reconstruction absent | CONFIRMED / OPEN P0: no task/queue rebuilding, incomplete event data, ID-set-only diff |
| F6A-03 human approval demo incomplete | CONFIRMED / OPEN P0: no human principal/approval, requires_approval=false; initial result has invalid reason field |
| F6A-04 full tarball proof absent | CONFIRMED evidence gap / OPEN P0 gate: internal imports and missing public reducer export; fresh install workflow NOT TESTED |
| F6A-05 whole-run atomicity incomplete | CONFIRMED / OPEN P0: temporary owner, progressive writes, missing revision/event coupling, aliases |
| F6A-06 source/artifact integrity | CONFIRMED release evidence gap: later work not represented by HEAD alone; not inherently a runtime exploit, no audit commit authorized |

Additional reproduced P0s: paused and failed runs dispatch, denied operations partially mutate state, context/event reads mutate authority/history, no-grant context discloses tasks, unknown work requeues without resolution. Eighteen test failures overlap root causes; do not present them as eighteen independent vulnerabilities. None of the original six concerns refuted or fixed.

## Corrective changes / tests added
No implementation corrections. Added `046-state-probes.mjs` with 21 expected-safe acceptance tests, plus a separately labeled unsafe-redispatch diagnostic. Existing tests were not edited, deleted or weakened. The audit tests live outside the default core test discovery and are deliberately run separately; **core green does not include these failures**. Raw logs retained, no synthetic output.

## Tests and environment
Bun 1.3.14, Node v26.7.0, npm 12.0.2, Linux x86_64. Exact output/commands in 046-evidence/.

| Verification | Result |
|---|---|
| Core `bun test` | PASS exit 0; 126 pass / 0 fail / 1026 assertions / 8 files |
| Security `bun test tests/authorization.test.js tests/adversarial.test.js` | PASS exit 0; 49 pass / 0 fail |
| Continuity `bun test tests/continuity.test.js` | PASS exit 0; 7 pass / 0 fail, incomplete safety coverage |
| Existing replay `bun test tests/fault-injection.test.js` | PASS exit 0; 5 pass / 0 fail, no state fidelity test |
| New acceptance `node --test --test-reporter=tap docs/internal/046-state-probes.mjs` | **FAIL exit 1; 3 pass / 18 fail / 21 tests** |
| Runtime `bun run src/verify-runtime.js` | exit 0, does not prove unknown reconciliation safe |
| `bun run demo:via` | exit 0, direct adapter calls; queued kernel task remains |
| Canonical `node examples/cross-actor-workflow.mjs` | exit 0, but manual state reset and no human approval; acceptance FAIL |
| `npm pack --dry-run --json` | exit 0; 52 entries, not a real artifact/install |
| Bun consumer / Node consumer | NOT TESTED |
| Real tarball package smoke | NOT TESTED |
| Lint/typecheck | NOT AVAILABLE in package scripts |
| `git diff --check` | exit 0 at final audit check |

Suite totals overlap; do not sum them. The independent reviewer also reran the acceptance probes. Parent reproduced unknown re-admission: two mock adapter calls, both outcomes uncertain (diagnostic reproduction, not passing safety).

## Security invariants
Existing direct evidence supports deny-by-default when host authority missing, role strings not capabilities, exact scope and explicit deny rules, attempt-bound approval checks, authority/lease freshness, sanitized invalid adapter results, cancellation winning late task results and adapters receiving frozen cloned packets/correlation-only context. Full INV-01–18 matrix was not completed after stop. No blanket security guarantee; task-level approval success does not repair run-level pause/rejection bypass.

## Atomicity and state guarantees
Detached snapshot export is verified. Stale cancel guard rejects without state change. SDK commitRun installation and competing commits fail required safety. Reads/projections leak state; progressive compound writes fail no-mutation semantics. Only selected single-process synchronous guards exist, not consistent whole-run transactions or distributed CAS/durability. No hostile plugin sandbox is promised; raw registry/platform functions are documented trusted-host seams, separately from inappropriate consumer-read aliases.

## Replay and evidence guarantees
Current reducer performs diagnostic metadata/event accumulation. No authoritative task/queue/approval/attempt reconstruction. Foreign/incompatible/incomplete history acceptance and content/order-insensitive diff reproduced. Replay has no adapter call path in source, but full counter/equality reconstruction verification remains uncompleted. Constants and returned effects_invoked=0 are not alone proof of full replay acceptance. Level C remains deferred; Level A cannot satisfy this block's Level B requirement.

## Human approval and continuation
Genuine Block 2 approval evaluator tests pass. Canonical example does not demonstrate human approval binding/consumption/rejection across restoration. It manually requeues uncertain work; switching it to current replayTask would not solve reconciliation safety. Export clone/schema validation works for tested cases; trusted import does not authenticate snapshot contents or implement durable multiwriter freshness.

## Package and consumer verification
Manifest/lock/installed Sigil identity inspected. Three export paths verified from source; replay reducer not publicly exported. No full external consumer built after stop. Dry-run includes tests, fixture and developer files; no first-party LICENSE or license field found. No artifact digest or reproducible release claimed. Baseline source hashes are evidence of the actual inspected tree, not an approved release revision.

## Architecture and public compatibility
No TypeScript or dependencies/coupling added. JS/ESM/data records/SigilJS retained. Pure evaluator and isolated adapter entry are useful foundations; shared ownership/commit/event violations remain. No runtime dependence on Runvia, PotentiaJS, model providers, hosted DB or cloud vendor found. Mock actor naming proves no cross-process infrastructure. Full conformance pass stopped.

Public API changes: NONE. Existing APIs experimental, raw registry/platform/authority mutation trusted-host; stable none. New safety requirements may require documented incompatibility with live-object reads and unknown replay. No changes made without that design/regression work.

## Outstanding priorities
- **P0:** coherent canonical owner/candidate CAS and detached reads; all mutation revision/event coupling; run lifecycle dispatch guards; evidence-backed unknown reconciliation; complete versioned Level B producer/reducer history; genuine public approval/continuation workflow; full tarball consumer proof and source/artifact reproducibility.
- **P1:** package whitelist/licensing decision/runtime range clarity, separately tested malformed history variants, broader randomized/race coverage (promote any advertised required case to P0 as appropriate).
- **P2:** distributed durability/CAS, hostile adapter sandbox, simulation/fork, cryptographic integrity, provider/product integrations remain excluded.

## Final gate / recommended next action
**NO-GO. Do not publish.** Retain Block 6A BLOCKED, not COMPLETE or CONDITIONAL GO. Use the ordered bounded P0 follow-up in 046-state-atomicity-audit.md; do not restart Blocks 1–6 or begin a feature phase. A coordinated state/evidence correction must be reviewed before implementation resumes, then all stopped passes and final independent release gate must actually execute. Publication remains maintainer-only.

## Evidence index
- 046-repository-reality-audit.md
- 046-standards-conformance-matrix.md
- 046-mutation-inventory.md
- 046-state-atomicity-audit.md
- 046-state-probes.mjs
- 046-independent-stop-review.md
- 046-release-go-no-go.md
- 046-evidence/commands.json, raw logs, baseline hashes/diffs, preservation.json, ending-git.txt
