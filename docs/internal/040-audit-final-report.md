# CHORD — Kernel Reality Audit — final report

**Block 1 of 6: PARTIAL.** Eight sequential virtual-role audit passes executed; reports produced. Required baseline checks failed, so this is not COMPLETE and does not authorize Block 2 execution or preview release. No code repaired, dependencies changed, versions bumped, tags created or package published.

## Exact checkout and change scope
- Branch `main`, commit `6b07802ba8639b29e7c48534612dbd60c946946d` (https://github.com/weipertda/chord/commit/6b07802ba8639b29e7c48534612dbd60c946946d).
- Actual package `packages/core`, `@chord/core@0.3.0`, JavaScript ES modules, Bun-oriented commands. `0.4.0-preview.1` is a proposed target only.
- Pre-existing modified files preserved: `.gitignore`, `.vscode/settings.json`, `README.md`. No tracked implementation/manifest/lock edits by audit.
- New files: the eight required reports below plus raw baseline transcript. All under `docs/internal/`; no package restructure.

## Evidence index (local working-tree evidence is authoritative for this audit)
1. [Repository/history inventory](040-reality-audit.md)
2. [Contracts/SigilJS gap matrix](040-contract-gap-matrix.md)
3. [Runtime/state trace](040-runtime-state-audit.md)
4. [Evidence/replay audit](040-replay-audit.md)
5. [Trust boundaries](040-trust-boundary-audit.md)
6. [Baseline verification](040-baseline-verification.md) and [raw transcript](040-baseline-transcript.md)
7. [Candidate preview scope/surface lock](040-preview-scope-lock.md)
8. This final report, `040-audit-final-report.md`.

## Verified capabilities, limited to evidence
- Existing parser normalizes CoordSpec fields and rejects malformed map lines; packet queue rejects the two tested malformed cases (`packages/core/tests/hardening.test.js:8-34,62-66`, targeted and full suite PASS).
- In-memory queue priority and thrown-adapter retry/dead-letter/requeue behavior pass existing tests (`:36-60,68-80`). Not a concurrent delivery or side-effect safety guarantee.
- Root/SDK/platform self-reference imports work; exact exported symbol/member classifications recorded in scope lock. No installed tarball smoke claimed.
- Empty-state CLI cycle, journal listing and audit execute. Snapshot serialization and diagnostic event logic exist; no durable recovery or historical reconstruction proven.
- Package dry-run succeeds for current 0.3.0 payload. No first-party TypeScript found; no Runvia/PotentiaJS/Via kernel imports or dependencies. Via is fake demo content only.

## Critical defects and minimal next patches
| Evidence | Defect | Bounded next action |
|---|---|---|
| `packages/core/src/registry/registry.js:84,92`; runtime validation FAIL | Unbound assertExecutionResult and markQueueEntryStatus; valid adapter success cannot ingest | Add correct local imports only with success-path regression; do not stop at import repair because effect/commit retry ambiguity remains |
| installed `node_modules/sigiljs/{package.json,src/sigil.js}`; local contracts | sigiljs 0.0.21 is unrelated web-component package; runtime uses imitation checks | Identify intended validator package/version, inspect its actual API and lock resolution, then scoped JS boundary replacement with negative tests |
| `src/execution/task-packets.js:63-72` under core | Missing adapter output becomes completed/succeeded | Reject malformed/absent outcomes; require explicit evidence and distinguish effect request from confirmation |
| `src/platform/runtime-loop.js:15-37`; registry/spec inputs | No authenticated grant/approval/cancel gate; post-effect ingestion errors retried | Trusted-host authority seam, default deny, bounded scope/expiry/revocation/approval/cancellation tests and explicit uncertain outcome |
| `src/platform/task-queue.js` | Duplicate task entries, no attempt/version ownership or idempotency, unenforced lease limits | Single-process admission/claim/result transition rules and stale/duplicate tests; no distributed rewrite |
| `src/platform/journal-audit.js`; snapshot.js | Diagnostic listing named replay; raw state import; task replay re-executes | Honest names/docs/compatibility, schema/version import rejection, gated re-execution; defer historical reducer |
| runtime errors and raw audit/registry | Errors may expose provider secrets, data mutable | Sanitized structured errors and trust-boundary docs/tests; never claim hostile plugin sandboxing |
| package.json demo script; README/dev_flow; verify-runtime negative catch | Broken documented demo and unsupported stability/SigilJS claims; weak sentinel test | Correct script target and concise truthful docs preserving user changes; test assertion must fail when validator fails to reject |

Full P0 acceptance IDs **C1–C6** are locked in scope report. P1 durable history/query ergonomics/CI/package tightening and P2 hosted/distributed/product features are not permission to expand Block 2.

## Baseline verdict
| Category | Result |
|---|---|
| test | **FAIL overall baseline**: bun test and npm test each 4 PASS / 0 FAIL / 15 assertions; existing runtime validation exit 1; advertised demo exit 1 |
| lint | **NOT AVAILABLE** (no script; not silently passed) |
| pack | **PASS** npm pack --dry-run --json, 35 entries; no publication/tarball install |
| consumer-smoke | **NOT APPLICABLE** for audit block; local export import check PASS, not fresh tarball consumer evidence |
| CLI / actual fake demo | process exits PASS; empty state/direct bypass only |
| contract failures | existing narrow tests PASS; real SigilJS/security boundary coverage missing |
| accurate public docs | FAIL; audit docs correct the record but existing public claims not edited |

Security/replay guarantees checked: no permission/approval enforcement established; no secret-redaction guarantee; no stale-write/idempotency guarantee; no authoritative durable history. Journal-view call graph invokes no providers, but does not reconstruct state. Task replay schedules re-execution. No real effects performed. Credential pattern scan found no matches in 69 tracked files; not proof no secrets exist.

Public classifications: all existing exported functions, SDK members and CLI surfaces **experimental**; unexported helpers **internal**; stable **none**; durable reconstruction, cross-process coordination, public network identity and hostile-plugin sandboxing **deferred**. Current package/API behavior unchanged by audit. Proposed tightening is intentionally incompatible with previously accepted malformed/untrusted inputs; preserve paths/layout and document those preview breaks.

## Block 2 — Execution Contracts & Authority: exact entry criteria
**STOP here.** User/reviewer must acknowledge the failed baseline and authorize remediation in Block 2; this audit is not permission to continue automatically.
1. Recheck branch/SHA/status; preserve the three existing user modifications and these reports. Read contract matrix, runtime trace, trust audit and C1–C6 scope before coding.
2. Resolve intended SigilJS identity/version from actual package metadata/source; no guessed imports, latest-version assumptions or conversion to TypeScript. Any manifest/lock replacement must be explicit and scoped.
3. Start with a regression demonstrating successful result ingestion and explicit rejection of malformed/absent results, then minimally repair bindings/validation. Run the existing runtime fixture as well as tests.
4. Design trusted-host identity/grant input separately from actor data; deny missing/self-asserted/out-of-scope grants. Bind approval to action/scope, enforce expiry/revocation and explicit cancellation before adapter dispatch. Tests must assert adapter call count stays zero for denied cases.
5. Define snapshot/spec/packet/result/policy ingress contracts using inspected SigilJS API. Validate before mutation; document behavioral compatibility impacts. Do not claim authority from schema validity.
6. Keep concurrency/effect receipts/replay redesign bounded to explicit later scope unless necessary for a safe dispatch gate. Unresolved C4/C5 remain release blockers, not implicit work expansion.
7. Verify each ordered patch with existing commands and added focused tests; retain raw failures. No publish/tag/version bump. Before any preview release require all C1–C6 evidence, fresh tarball consumer tests in the release/packaging block, and honest public classifications.

## Pass 8 record / definition-of-done disposition
Inspected: all seven preceding reports and baseline transcript, implementation/test references already enumerated, checkout/export/dependency evidence. Changed: this report and pass 1 block-status update only. Tests: inherited actual baseline, no claimed new behavior. Final verification after report creation: all 8 required reports plus raw transcript present (9 audit files), no broken relative Markdown links; `git diff --check` passed; `git diff --exit-code -- packages/core` passed with no changes. Final Git status shows only the same 3 pre-existing modified files and 9 new audit documents. No implementation/dependency changes.
- Evidence-backed claims and current package/SigilJS reality: documented.
- Limited P0 scope, no refactors/publication: documented and enforced.
- Failures/missing infrastructure: explicitly recorded.
- Successful baseline / accurate existing public claims: **not satisfied**; block remains PARTIAL.
Next recommended block: **Block 2 — Execution Contracts & Authority**, only after explicit remediation authorization above.
