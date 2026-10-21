# 047 — Pass 7: Invariant verification

Gate: COMPLETE. Independent read-only closure passed; no release/package gate implied.

Test names below are in packages/core/tests. All original 046 probes remain unchanged and pass separately (21/0). Existing and new core tests total 160/0 (126 original / 34 new); categories overlap.

| ID | Required invariant | Direct behavioral evidence |
|---|---|---|
| 01 | No unauthorized dispatch | adversarial.test.js `admission denial writes nothing and dispatch denial never leases`; authorization.test.js `unauthorized dispatch invokes zero adapters and leaves the task queued` |
| 02 | No consumer canonical aliases | integrity.test.js `STATE-04: reads and retained inputs cannot change canonical state`; admission-integrity.test.js detached nested projection; 046 probes 7,9,19 |
| 03 | Truthful installed commit | integrity.test.js `STATE-01/02: installed owner and revision-exclusive commits`; immutable 046 probe 1 |
| 04 | At most one same-revision success | same STATE-01/02 and 046 probe 2 |
| 05 | No partial admission | STATE-03/05 all-collection rollback; admission-integrity `ADMIT: grant issuance cannot survive a later batch denial`, invalid queue/reentrant callback; adversarial batch denial |
| 06 | No paused/failed/cancelled/terminal dispatch | lifecycle-integrity parameterized four states; cancellation wins late adapter; execute-accessor reentry rejects before any effect |
| 07 | No approval bypass | original authorization/adversarial approval-required zero calls, rejected/wrong/reused/consumed/expired approval checks; canonical-example real human consumption after restore; lifecycle invalid human resume |
| 08 | No stale/foreign result commit | transitions.test.js intervening real CAS/authority rotation/lease expiry/cancelTask late result; contracts.test.js foreign/duplicate correlated result |
| 09 | No grantless disclosure | admission-integrity grantless/revoked plus explicit deny/expiry/future cases; reentrant clock revocation returns current empty projection |
| 10 | No mutable journal exposure | integrity.test.js STATE-04 changes inspectEvents payload and compares detached original; 046 probe 9 |
| 11 | Uncertainty requires reconciliation | recovery-integrity simple replay rejection, missing authority/evidence, still_unknown quarantine; 046 probe 11 |
| 12 | No blind duplicate effects | recovery-integrity new task ID cannot evade signature quarantine; no-effect receipt permits explicit fresh attempt; completion not repeated; concurrent/duplicate decisions reject; cancelled effect preserves unknown/compensated and ignores late result |
| 13 | No replay effects | replay-integrity original adapter counter unchanged during full replay; canonical-example protected count remains exactly one across replay |
| 14 | Correct state reconstruction | replay-integrity projection equivalence at admission/result/uncertainty/handoff/reconciliation/pause/cancel/import; 8 deterministic seeded sequences; canonical approval consumption equality |
| 15 | Meaningful ordered/content diff | replay-integrity changed payload and reversed events differ; invalid/missing/duplicate/mixed-run/unknown/version histories reject independently |
| 16 | SigilJS boundaries | original contracts.test.js closed/negative/accessor/limit/schema suites; HostCommitRequest rejects undocumented operation override unchanged; malformed queue payload candidate rollback |
| 17 | Block 2 security regressions | authorization.test.js + adversarial.test.js 49/0, original expected security assertions retained |
| 18 | No framework/provider coupling | architecture-integrity.test.js ARCH-18: first-party JS files, ESM manifest, only SigilJS dependency, import allowlist |

## Test sensitivity
Three isolated scratch copies intentionally broke: owner installation, lifecycle dispatch gates and trace content comparison. Each targeted suite failed; real source remained untouched. Owner mutation was refined to skip only state-changing installation so the assertion fails at canonical read, not fixture setup. Raw logs and mutation-checks.json in 047-evidence/. Not exhaustive mutation testing.

## Independent review disposition
Fresh same-model read-only contexts reviewed source rather than relying on reports. Findings: dead-letter cancel/replay mismatch (already resolved by shared transition invariant while review ran); execute accessor cancellation gap; clock/snapshot revocation ordering; host operation validation/history mismatch. Each has a direct new regression. Callback fixes baseline 2 failures then pass; operation override baseline success erroneously accepted then strict SigilJS request rejection preserves state. Final independent closure passed: 18 targeted tests / 0 failures; accepted host commits reconstruct exactly; cancelRun/cancelTask with late success/rejection preserve cancelled tasks and compensated ledgers. Operation overrides reject unchanged. See 047-independent-verification.md.

Boundary: trusted-host SDK administration/configuration/full inspection is not an authenticated actor endpoint or sandbox. Actor-scoped projectContext is filtered; host must authenticate IDs and verify receipt evidence. Run-local structural duplicate prevention is not arbitrary NLP equivalence or cross-process idempotency. No broader claim is substituted for tested behavior.
