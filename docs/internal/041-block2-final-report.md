# 041 — Block 2 Final Report (Passes 1–6)

**Date:** Tue Oct 20 2026 · **Repo:** `/home/d/Workspace/other-projects/chord-v0.3.0` · **Branch:** `main` · **Commits:** `76adf7f` (Pass 4), `1e5f2e6` (Pass 5), `ba3e37e` (Pass 6)

Block 2 implements the authority design in `docs/internal/041-authority-design.md` (§4–§7) for the JS/Bun preview kernel. This report covers scope, pass completion, evidence, deviations, and the pass/fail gate.

## 1. Summary

Block 2 is **COMPLETE** against the scope defined by:
- `docs/internal/041-contract-scope.md` (Pass 1 inventory)
- `docs/internal/041-authority-design.md` (design + pass order)
- `docs/internal/040-preview-scope-lock.md` (P0 scope + public surface lock)

All required passes (contracts/ingress → evaluator+seam → transition/ambiguity guards → adversarial tests → truthful docs/examples) are implemented. Verification:
- `bun test` — **113 passed / 0 failed / 983 expect() calls** (5 files)
- `bun run src/verify-runtime.js` — **ALL RUNTIME VALIDATIONS PASSED**
- `bun run demo:via` — **=== DEMO COMPLETE ===**
- CLI scripts (`run`, `replay`, `inspect-audit`) run as designed

## 2. Pass completion (design §7)

| Pass | Scope | Status | Evidence |
|---|---|---|---|
| 1 | Real closed contracts + safe ingress | ✅ | Pass 3 commit `d28f531`: `Sigil.exact` closed contracts; ingress validation; snapshot import fixes. Contract tests updated. |
| 2 | Pure evaluator wired into SDK/runtime + trusted-host seam | ✅ | Pass 4 commit `76adf7f`: `packages/core/src/platform/authorization.js` (admit/dispatch/commit, pure, default deny); `setAuthoritySnapshot` + `hostNow` fail-closed; admit-gated `queueTaskPackets`. |
| 3 | Guarded transitions + atomic commit semantics (commit re-evaluation + dispatch-revision guard) | ✅ | Pass 5 commit `1e5f2e6`: `transitions.js` (task/queue/artifact/domain guarded graphs, `markTaskUncertain`); runtime-loop preflight + frozen packet + correlation-only adapter context + commit re-eval + dispatch-revision guard; ambiguity→`uncertain` (no blind retry); pre-dispatch `no_adapter` → bounded retry/dead-letter. |
| 4 | Adversarial matrix tests | ✅ | Pass 6 commit `ba3e37e`: `tests/adversarial.test.js` (34 tests) covering identity/forgery, roles vs capabilities, scope/version/run isolation, expiry/revocation boundaries, deny/allow ordering, approval misuse permutations, runtime boundaries (zero-call denials, batch atomicity, revision losers, no leak), approval gate end-to-end. |
| 5 | Truthful docs/examples | ✅ | Root README (preview/host responsibilities); example READMEs corrected to reflect design semantics; `tests/README.md`; `packages/core/dev_flow.md`; Block 2 final report. |

## 3. Key changes (high-level)

**Pass 5:** attempt lifecycle fixed (`pending_attempts` → `active_attempts` at dispatch; terminal paths clear both), correlated `Outcome` ingestion (requires active attempt; validate-before-mutate, zero mutation on rejection), spec text no longer mutates artifact status, `in-flight import` reconciles to `uncertain`, `cancelTask` + fresh-admission `replayTask` (legal from `dead_letter|uncertain|blocked`), no `replayDeadLetterTask` reset semantics.

**Pass 6:** added `createAdaptiveAuthority` host fixture, fixed adapter packet freeze (freeze inside `executeTask`), full adversarial coverage.

**Block 2 finalization (this pass):** restored `replayDeadLetterTask` on the `@chord/core/platform` export surface with **corrected fresh-admission semantics** (authority re-evaluated at admission, attempts/reservations reset, consumed approvals remain consumed; throws on denied grant, leaves task untouched) — preserving the locked surface while enforcing design §5 constraints. Docs/examples rewritten truthfully.

## 4. Deviation from design/spec (intentional, recorded)

| Deviation | Rationale | Location |
|---|---|---|
| Full `commitRun` clone-swap CAS deferred to **Block 3** | Scope lock (`040-preview-scope-lock.md`) explicitly defers distributed/whole-run CAS to L1/Block 3. Current path uses `validate-before-mutate` in `registerExecutionResult` with commit re-evaluation + `dispatch_revision` guard. | `registry.js` (correlated commit path). `commitRun` signature not yet exposed as full CAS. |
| `STALE_REVISION` is runtime/journal code only; not emitted as a `Decision` contract code | Evaluator never returns a `Decision` with code `STALE_REVISION`; the runtime compares `registry.run.revision === active.dispatch_revision` at commit and translates conflicts to the correct case (often `TASK_CANCELLED` or `INVALID_TRANSITION` in reconciliation paths). | `runtime-loop.js` (§6 commit guard). |
| Result storage is `Outcome` (correlated) vs bare `ExecutionResult` | Stronger correlation (run/schema/task-revision/queue/attempt) blocks foreign/duplicate/stale results and enforces exact-scope commit. | `contracts/sigils.js`, `registry.js`. |
| Restored `replayDeadLetterTask` with corrected semantics (not direct reset) | Preserves `@chord/core/platform` locked export surface (`040-preview-scope-lock.md` line 33) while enforcing design §5 (fresh admission, no reset of approvals, authority re-evaluation). Old unsafe reset behavior removed. | `platform/task-queue.js`, `platform/index.js`. |
| `running -> blocked` task transition allowed | Enables result-derived `blocked` to be represented on the task graph and matches `blocked -> queued` exit; required by guarded transitions. | `transitions.js` (TASK_TRANSITIONS). |

## 5. Test coverage summary

- **transitions.test.js** (25): graphs, ambiguity→uncertain, commit guards, cancel/replay, blocked exit, artifact/domain derivation, lease caps
- **adversarial.test.js** (34): identity/authority, roles/capabilities, scope/version/run isolation, expiry/revocation, ordering permutations, approval misuse, runtime boundaries, approval gate, batch atomicity, revision losers, no-leak assertions
- **contracts.test.js** (updated): correlated ingestion, duplicate/foreign/stale, in-flight import reconciliation
- **hardening.test.js** (updated): parsing, dead-letter (pre-dispatch exhaustion), contract enforcement
- **Total:** 113/0/983. All assertions pass; verify-runtime and demo green.

## 6. Known limits (not blockers for Block 2)

- **No sandbox.** Adapters run in-process; `./platform` exports and direct registry access remain **trusted-host** APIs. Host must not forward untrusted input as trusted configuration (documented in README).
- **In-memory only.** No crash durability, cross-process CAS, or distributed consensus (deferred to Block 3/L1 per scope lock).
- **Diagnostic journal, not authoritative historical re-execution.** Replay utilities are diagnostic and constrained by fresh-admission rules; historical reconstruction unsupported by design.
- **No lint/typecheck scripts.** `package.json` has only `test`. All verification paths still pass; this is a documented omission in the scoped preview.

## 7. Pass/Fail Gate

**GATE: PASS**

- All design passes 1–5 satisfied
- P0 acceptance items (C1–C6 equivalent) evidenced: closed contracts, result-ingestion correctness, host-authenticated authority with boundaries, guarded transitions + ambiguity handling, safe import/replay separation, truthful docs/examples
- Full regression suite green (113/0); runtime verification green; demo green
- Public surface preserved with corrected semantics (no unmitigated unsafe behavior introduced)

Block 2 is **COMPLETE**. Ready to proceed to **Block 3** (whole-run `commitRun` clone-swap CAS + per-operation `expectedRevision` enforcement per `040-preview-scope-lock.md`).
