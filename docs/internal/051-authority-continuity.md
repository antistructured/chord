# 051 — Authority continuity across local restart

## Pass

**B4 — authority-continuity-agent: PASS within the accepted local, single-active-runtime contract. B4 complete; B5 is a separate, unexecuted gate.** Real SQLite owner close/reopen preserves run identity, declarative authority, prepared approval bindings and paused state. Dispatch and result commit recompute permission rather than treating restored data or previous decisions as transferable authorization. No Level B, full Proof 2/3, distributed scheduling, staged acknowledgement or exactly-once claim is made.

Inputs: B1 `051-storage-contract.md` including its B3 addendum; B2 `051-storage-implementation.md`; B3 `051-crash-recovery.md`; normative authentication/threat boundary in `041-authority-design.md` §§1, 3–7. Work preserves the dirty 050/B1–B3 tree at HEAD `08728e48772db14a247add9143669a8e0eab01fa`.

## Findings and bounded correction

One genuine narrow defect was reproduced: SDK `resumeRun` evaluated principal/approval validity using effective host policy time, but its lower-level pause-deadline check independently used ambient `Date.now()`. A persisted pause with deadline 200 and effective policy time 150 incorrectly threw `EXPIRED` after restart. This also meant the pause deadline did not use the persisted floor.

Correction: pass the already captured effective time from SDK resume into the platform resume helper. The helper's optional third argument defaults to `Date.now()` for existing standalone host calls; no actor-supplied option controls the SDK clock. The existing pause deadline comparison (`deadline < now`) is preserved; this pass does not redefine deadline equality. The approval/principal/grant windows remain exclusive at expiry (`now < expires_at`). Ambient journal/`paused_at` timestamps are still diagnostic, not permission time.

Regression pair: resume succeeds at floor 150/deadline 200 despite raw restart time 1, and rejects `EXPIRED` at floor 201/deadline 200 despite raw restart time 1. Denied resume leaves the exact stored row unchanged. The pre-fix focused command below genuinely failed the positive test with `EXPIRED`; it was not a syntax/import failure.

## Evidence matrix

The new shared suite contains **33 tests**, using `node:test`, Node strict assertions and the actual lazy `node:sqlite` implementation under both runtimes. Temporary databases use configured TMPDIR under `/home/d/.hermes/cache/scratch`, not the repository. They are removed in fixture cleanup.

- **Positive exact continuation:** prepare a real attempt, install its exact approval, pause, close, reopen; assert full registry/authority/pending attempt equality including run ID and revisions. A paused cycle returns `RUN_NOT_ACTIVE` with zero calls. Resume with the restored exact human/approval and current revision, dispatch once using the same attempt ID, commit completion, persist its consumed approval, reopen again and skip without another invocation. Raw store equals SDK state, and complete journal reduction equals both.
- **Approval negatives:** missing approval; foreign-run approval rejected at installation with no write; stale attempt ID; already consumed approval; expired approval exactly at its expiry with persisted floor 200 and raw restart time 1; revoked approval. Each denies paused resume without writes. A clearly labeled trusted administrative unpause then exercises the independent dispatch guard: `APPROVAL_REQUIRED`, zero effects, task still queued. The foreign approval cannot be durably admitted, so the reopened negative correctly has no installed foreign approval; the test does not fabricate a contract-invalid stored state.
- **Fresh attempt:** invalidate the old pending reservation, prepare a different ID, reopen and deny the old approval, then install a fresh exact approval and complete once. Consumed approval reset through ordinary snapshot replacement is merged back to its original consumed attempt and survives another reopen.
- **Resume identity/revision negatives:** missing human, service principal rather than human, expired human, foreign approval ID despite an otherwise valid exact approval, stale run revision; all reject without changing durable state or executing effects.
- **Dispatch reevaluation:** restored expired principal, revoked actor, expired grant, revoked grant and explicit deny. Each persists floor 200 before a backward restart at raw time 1; expected codes are respectively `PRINCIPAL_INVALID`, `ACTOR_INVALID`, `NO_ALLOW_GRANT`, `NO_ALLOW_GRANT`, `EXPLICIT_DENY`. Zero adapter effects and raw floor remains 200.
- **Commit reevaluation after restart:** positive authority is restored first; after acknowledged claim, the adapter advances policy time or performs an explicit intervening host update before returning. Principal expiry, selected grant expiry, selected approval expiry, grant revocation, approval revocation, authority-revision-only change, run-revision-only change and lease expiry reject completion. Exact observed codes are respectively `PRINCIPAL_INVALID`, `NO_ALLOW_GRANT`, `APPROVAL_REQUIRED`, `NO_ALLOW_GRANT`, `STALE_ATTEMPT`, `STALE_ATTEMPT`, `STALE_REVISION`, `STALE_ATTEMPT`. Approval revocation also advances authority revision, so the earlier stale-authority guard wins; this is not mislabeled as an isolated approval-revocation predicate. Approval expiry independently reaches `APPROVAL_REQUIRED` without a revision change. Every case has one actual invocation, durable task `uncertain`, operation `unknown`, consumed approval retained and zero blind redispatch after another reopen.
- **CAS and stale inputs:** old run revision, old authority revision, wrong expected authority revision, foreign-run authority, stale cancellation, stale administrative installation reject without durable writes. `commitRun` returns its documented `{ok:false,code:'STALE_REVISION'}` for a valid-shaped stale request; it is not asserted to throw. Foreign/stale run/task/content/authority attempt tuples are evaluated against real restored claimed data and rejected with the expected run/stale-attempt code. A public adapter result carrying the wrong attempt ID becomes uncertain instead of success and remains so after reopen. Pure tuple probes are explicitly distinct from public-runtime result-boundary coverage.
- **Services/options isolation:** reopen without a router returns `no_adapter`, with zero effects; executable adapter services were not recovered from storage. A raw `registry_json` query excludes credential/callback markers, host option keys and old/new session values. Actual adapter arguments exclude authority arrays, credentials and host options. This is no content scrubber or encryption claim.

## Host reattestation boundary — not an authentication promise

Persisted principals are declarative host-attested policy records, **not bearer credentials or logged-in sessions**. Chord has no login verifier/session service to serialize or automatically reconstruct. Full SDK possession remains the trusted-host capability; direct host methods accept trusted principal IDs and do not demand an additional login credential. Restoring a valid authority snapshot intentionally permits governed queued execution subject to current policy checks. It does not authenticate a client request.

The explicit reattestation test supplies a small **test-only embedding ingress**, not a new production Chord API. Before restart it has an authenticated host session. After actual SQLite reopen, a fresh ingress starts with an empty private session map while the human principal record remains persisted. Missing session, old session and principal ID masquerading as a session all reject `HOST_UNAUTHENTICATED` with exact durable state unchanged. Only explicit new host attestation enables resume. The host derives principal from that new session, ignoring a forged request principal; the exact approved continuation then completes once. This demonstrates the host's required boundary and isolation of sessions from storage, not that Chord now implements authentication. Exposing the SDK or a generic administrative dispatcher to an actor still defeats the boundary. No host credentials, executable callbacks, router, options bag or session service are persisted.

## Files inspected

- Complete B1/B2/B3 reports and complete normative `docs/internal/041-authority-design.md`.
- `packages/core/src/sdk/chord.js` constructor, authority/grant/approval helpers, admission, attempts, resume, runtime and administrative host methods.
- `packages/core/src/registry/{owner,snapshot}.js`.
- `packages/core/src/platform/{authorization,approval-flow,attempts,runtime-loop,state-invariants,transitions,adapter-routing}.js`.
- `packages/core/src/runtime/recovery.js`, contract approval/authority semantics in `src/contracts/sigils.js`, `src/execution/results.js`.
- Existing `tests/crash-recovery.test.js`, `tests/fixtures/host.js`; B2 shared-suite structure/results; `packages/core/package.json`.
- Entry status/hashes, new shared tests, complete execution logs and preservation comparison.

## Files changed

1. **Created** `packages/core/tests/authority-continuity.test.js` — 33 shared Node/Bun real-storage continuity/authority tests.
2. **Modified** `packages/core/src/sdk/chord.js` — one-line forwarding of captured effective policy time to resume helper; all earlier dirty changes preserved.
3. **Modified** `packages/core/src/platform/approval-flow.js` — optional time argument used for pause deadline; standalone default unchanged.
4. **Created** `docs/internal/051-authority-continuity.md` — this report.

No dependencies, manifest, lockfile, contracts/history/storage/snapshot versions, exported authentication mechanism, B5–B8 work, staging, commit, push, tags, publication or destructive Git changes. Entry SHA-256 inventory is scratch `chord-b4-entry.json`; byte comparison found only the two intended pre-existing source files changed and only the new test/report added. Existing dirty work is not reverted or normalized. A procedural lesson was appended to the existing profile skill outside the repository; it is not a product change.

## Test commands

Measured versions: `node --version` → `v24.22.1`; `/home/d/.bun/bin/bun --version` → `1.4.3`, exit 0 each. Commands below ran from `packages/core` unless marked root. Full suite uses Bun because original tests import `bun:test`; only the three explicitly shared suites are claimed runnable under Node.

| Exact command | Exit | Actual final output |
|---|---:|---|
| `node --test tests/authority-continuity.test.js` | 0 | `tests 33`, `pass 33`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0` |
| `/home/d/.bun/bin/bun test tests/authority-continuity.test.js` | 0 | `33 pass`, `0 fail`, `Ran 33 tests across 1 file. [2.74s]` |
| `node --test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js` | 0 | `tests 66`, `pass 66`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0` |
| `/home/d/.bun/bin/bun test tests/storage-adapter.test.js tests/crash-recovery.test.js tests/authority-continuity.test.js` | 0 | `66 pass`, `0 fail`, `Ran 66 tests across 3 files. [5.33s]` |
| `/home/d/.bun/bin/bun test` | 0 | `259 pass`, `0 fail`, `1635 expect() calls`, `Ran 259 tests across 19 files. [5.94s]` |
| `node --test docs/internal/046-state-probes.mjs` (root) | 0 | `tests 21`, `pass 21`, `fail 0`, no cancelled/skipped/todo |
| `/home/d/.bun/bin/bun run packages/core/src/verify-runtime.js` (root) | 0 | `🎉 ALL RUNTIME VALIDATIONS PASSED!` |
| `node /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs` (root) | 0 | Exact boundary JSON below |
| `/home/d/.bun/bin/bun /home/d/.hermes/cache/scratch/chord-a3/boundary-probe.mjs` (root) | 0 | Identical boundary JSON |
| `node packages/core/examples/cross-actor-workflow.mjs` (root) | 0 | completed; accepted handoff/approval validated/approval consumed/snapshot restored/replay verified; revision 14, 34 events, one dispatch, zero negative effects |
| `/home/d/.bun/bin/bun packages/core/examples/cross-actor-workflow.mjs` (root) | 0 | Same assertions/counts; nondeterministic run ID differs |
| `git diff --check` (root) | 2, pre-existing | Three trailing-whitespace diagnostics retained in `049-final-report.md:7`, `049-final-report.md:99`, `release-notes-and-limitations.md:4` |

Boundary probes returned exactly:

```json
{"actorFieldsRejected":3,"recursiveDataOnly":true,"forgedResultRejected":true,"canonicalAuthorityUnchanged":true,"unknownRedispatchRejected":true,"adapterCalls":1,"allowDecisionFrozen":false}
```

Complete final logs are `/home/d/.hermes/cache/scratch/chord-b4-{node-new,bun-new,node-shared,bun-shared,full,safety,verify,boundary-node,boundary-bun,example-node,example-bun}.log`; root/shared command metadata and exit codes are `chord-b4-checks.json`. Logged invocations redirect `> <log> 2>&1`, save `$?`, print a Python-selected footer, and `exit $code`, so output shortening does not mask behavioral failure. Bun expect counts exclude the new Node assertions and are not total assertion counts.

## Exit codes and results

All final behavioral commands exit **0**. Before the correction, `node --test --test-name-pattern='paused deadline' tests/authority-continuity.test.js` exited **1**, `tests 2`, `pass 1`, `fail 1`; the unexpired positive threw `EXPIRED` in platform resume. Retained in `chord-b4-pause-before.log`.

Earlier test development failed honestly on two fixture assumptions, not product defects: `globalMaxLeased:1` with the default higher per-entity cap is invalid policy (fixed by explicitly setting both caps to 1); malformed `{}` administrative payload validates before stale CAS and stale administrative CAS returns a decision rather than throwing (fixed to use the documented valid-shaped stale request). Initial/iteration logs are retained in scratch. No weakened validation or fabricated outcomes were used.

## Invariants verified

- Same durable run ID, complete reducible history and detached authority/attempt data across actual close/reopen; no snapshot import or memory-copy substitute.
- Paused state is not executable; exact current human/approval and correct revision permit the positive continuation. Foreign/stale/missing/consumed/expired/revoked approval does not.
- Persisted clock floor prevents backward-clock expiry revival for principal, grant, approval and pause deadline; current dispatch and post-effect commit checks remain distinct.
- Claim consumes exactly the selected attempt approval; stale/expired/revoked post-effect success becomes unknown/uncertain, never a successful canonical effect or blind retry. Committed consumption is preserved across snapshot replacement and restart.
- Credentials, functions, sessions, options and adapters are not recovered executable authority. Fresh host request authentication is the embedding host's responsibility; declarative principal restoration is not login.
- Real SQLite raw state, SDK reads and reducer outputs agree; preexisting memory/runtime/safety suites remain green.

## Known limitations

Single active scheduler per run with host-assured exclusive sequential restart only. B4 uses actual SQLite handle close/reopen in the test process; it is **not B5's independent continuation process**, a new crash experiment or a hardware power-loss test. B3's eight SIGKILL tests remain passing in the shared/full suites, with their original stated seams/limitations. Test effects are adapter counters, not remote business receipts. Denying a result commit cannot undo an external effect.

No built-in user authentication, credential storage, actor-accessible host endpoint, distributed revocation, sandbox, concurrent scheduler support, staged effect acknowledgement, idempotency/fencing protocol, exactly-once guarantee, cryptographic tamper proof, encryption, secret scrubber, schema migration or compaction. Trusted hosts can deliberately change policy or use privileged maintenance; this is not adversarial-host isolation. Application-authored data can contain secrets. Whole-registry/history validation is synchronous O(state/history); current size/node/1024-event budgets and bounded SQLite lock blocking remain. Linux Node v24.22.1/Bun 1.4.3 only are measured. Diagnostic timestamps and generated IDs remain ambient/nondeterministic. Full Proof 2/3 and product/release promotion gates remain deferred.

## Blockers

**No blocker to the bounded B4 gate.** One narrow policy-clock defect was fixed and covered with a failing-before/passing-after regression. Authentication-service continuity is deliberately not supplied by Chord: host authentication/reattestations and executable services must be recreated by the embedding application. A requirement for Chord itself to reject unauthenticated holders of the full host SDK would change the normative capability boundary, not describe the current supported API.

## Next-pass readiness

**B4 COMPLETE; B5 ready only when separately authorized.** Gate paths: this report and `packages/core/tests/authority-continuity.test.js`, plus the two narrow source corrections listed above. B5's independent-process continuation proof remains outstanding. No B5–B8 work or promotion was performed.
