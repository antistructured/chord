# Block 054 — Independent final verification

## Verdict

**COMPLETE for Block 054 development, with a bounded UNRESOLVED P2 reliability observation carried into Block 055.** No release-critical product, canonical-state, authority, fencing, or effect-safety defect was reproduced. All deterministic acceptance gates below were run against the exact current working tree and passed. No commit, tag, push, version change, or publication was performed.

This is an independent Pass 9 review. It does not rewrite the historical conclusions in any earlier report.

## Artifact under review

```text
repository: /home/d/Workspace/other-projects/chord
package:    packages/core (@antistructured/chord@0.4.0-preview.1)
branch:     base
HEAD:       72f96ab6cdc9d6948ffb7eacba527cc27a32a8be (Block 052 baseline)
working tree: 29 tracked modifications + 59 untracked paths = 88 status entries
git-visible universe: 622 files
```

The release candidate is the **dirty working tree**, not HEAD. Its pre-verification manifest is:

```text
entry-files.txt  sha256 82724246c61676bb29279f771a365a84e2eb5dd21e3387d493227b6cb331a963
entry-hashes.txt sha256 5f59c6556b7b77b9ca1065d8fcb0939476043fd737d18bf88548438ef63e07b4
entry.diff       sha256 098344b8efe5d38e749bc7885316ff5c293141c4aaec47e681374336a52f1c9f
```

Evidence directory: `/tmp/opencode/chord-054-pass9` (local scratch, prunable). After all verification the same 622 paths and every SHA-256 were byte-identical to entry; only the three new 054 reports were added afterwards.

Runtimes: Node **v24.22.1**, Bun **1.4.3**, Linux x64.

## Commands and outcomes

All commands were executed directly; no terminal pipeline filtered failures. Every acceptance command exited **0**.

| # | Command | Cwd | Observed outcome | Exit |
|---|---|---|---|---:|
| 1 | `/home/d/.bun/bin/bun test` | `packages/core` | **459 pass / 0 fail / 1781 expect() / 33 files**, 129.30 s | 0 |
| 2 | `node --test` on the 17 shared files | `packages/core` | **266 pass / 0 fail / 0 cancelled / 0 skipped**, 123.53 s | 0 |
| 3 | `bun test` on the same 17 shared files | `packages/core` | **266 pass / 0 fail / 17 files**, 161.32 s | 0 |
| 4 | `node --test ./docs/internal/046-state-probes.mjs` | repo root | **21 pass / 0 fail**, 0.22 s | 0 |
| 5 | `bun test ./docs/internal/046-state-probes.mjs` | repo root | **21 pass / 0 fail** | 0 |
| 6 | `node src/verify-runtime.js` | `packages/core` | ALL RUNTIME VALIDATIONS PASSED | 0 |
| 7 | `bun src/verify-runtime.js` | `packages/core` | ALL RUNTIME VALIDATIONS PASSED | 0 |
| 8 | `node examples/quickstart.mjs` | `packages/core` | `{ completed: true, adapterCalls: 1 }` | 0 |
| 9 | `bun examples/quickstart.mjs` | `packages/core` | `{ completed: true, adapterCalls: 1 }` | 0 |
| 10 | `node examples/cross-actor-workflow.mjs` | `packages/core` | completed; approval consumed; revision 14; replay verified; 0 negative effects | 0 |
| 11 | `bun examples/cross-actor-workflow.mjs` | `packages/core` | same semantic result | 0 |
| 12 | `node examples/adapter-interop.mjs` | `packages/core` | `replay_matches:true, server_executions:1` | 0 |
| 13 | `bun examples/adapter-interop.mjs` | `packages/core` | `replay_matches:true, server_executions:1` | 0 |
| 14 | `node examples/adapter-conformance.mjs` | `packages/core` | `ok:true`, `verdict:INCOMPLETE`, `certification:false` | 0 |
| 15 | `bun examples/adapter-conformance.mjs` | `packages/core` | same; includes deliberate-fixture behavior | 0 |
| 16 | `node examples/process-recovery.mjs <new-dir> <abs-node>` | `packages/core` | B5 PASS, committed effects 1, ambiguous redispatch 0 | 0 |
| 17 | `bun examples/process-recovery.mjs <new-dir> <abs-bun>` | `packages/core` | B5 PASS, committed effects 1, ambiguous redispatch 0 | 0 |
| 18 | `node examples/two-process-coordination.mjs <new-dir> <abs-node> <abs-node>` | `packages/core` | effects 2, receipts 6, revision 14, replay match, all roles joined | 0 |
| 19 | `bun examples/two-process-coordination.mjs <new-dir> <abs-bun> <abs-bun>` | `packages/core` | effects 2, receipts 6, revision 14, replay match, all roles joined | 0 |
| 20 | `npm pack --ignore-scripts --json --pack-destination <evidence>` | `packages/core` | **76 files**, 126,373 B packed, 473,432 B unpacked | 0 |
| 21 | `npm install --offline --ignore-scripts --no-audit --no-fund --save-exact <tarball>` | fresh consumer | `added 2 packages`; real extraction, no network | 0 |
| 22 | installed `quickstart`, `cross-actor-workflow`, `adapter-interop`, `adapter-conformance` on Node | consumer | all four exit 0 | 0 |
| 23 | same four installed examples on Bun | consumer | all four exit 0 | 0 |
| 24 | public-boundary probe (root/sdk/platform/interop + private subpaths) | consumer | exports 64/1/22/29; all private imports rejected | 0 |
| 25 | import-without-side-effects probe (Node and Bun) | consumer subdir | 64 exports; **no file created**; memory-only `createChord()` works | 0 |
| 26 | `node --check` on all 64 source `.js` and 6 examples | `packages/core` | all pass | 0 |
| 27 | `git diff --check` | repo root | empty | 0 |

Tarball SHA-256: `68de4f38e6c4edc21d90cd4286bcb39dec3c9c829b93b594d9eae80208d6489b`.

### Disclosed non-product iterations

- The first two Bun process-example invocations exited 1 because this reviewer passed the literal word `bun` as the child runtime. `bun` resolves on `PATH` to a broken Volta shim (`/home/d/.volta/bin/bun`, exit 126), not to the tested `/home/d/.bun/bin/bun`. Re-running with absolute runtimes passed. This is a reviewer invocation error, not a product or example defect.
- One Node shared invocation exited 1 before running tests because zsh did not word-split a quoted variable containing the file list. Re-running with command substitution ran the suite. No test executed or failed in that attempt.
- The first import-side-effect probe ran in an empty directory with no package resolution and failed `ERR_MODULE_NOT_FOUND`. Re-run inside the installed consumer tree passed and created no files.

These iterations are retained rather than reported as green gates.

## Adversarial checks

The required adversarial categories were exercised by the full and shared suites. Representative passing assertions include:

| Required check | Executing coverage (passing) |
|---|---|
| Wrong operation identity | *"wrong run/incarnation/task/attempt/operation/adapter identity rejects"* (`adapter-protocol.test.js`) |
| Stale session response | *"old session and stale replies cannot settle a replacement bridge request"*; *"wrong session or request UUID cannot settle a current execution"* |
| Repeated command receipt | duplicate session/command receipt recovery leaves the complete row unchanged (`actor-ingress`, `error-boundaries`) |
| Stale owner result | *"a delayed adapter result after owner release cannot commit canonical state"*; *"stale attempt result after evidence-backed readmission cannot consume newer active attempt"* |
| Actor authority forgery | *"invalid frames cannot select host identity or mutate canonical state"*; forged binding/context/handoff/approval rejection in four-runtime IPC pairs |
| Invalid human approval | *"an approval for a different attempt does not authorize dispatch"*; self/service forgery denied |
| Adapter capability pretending to be a grant | *"advertisement is descriptive; compatibility rejects unsupported protocol, context and operation"* |
| Late result after close | *"a delayed adapter result after owner release cannot commit canonical state"*; B3/B6 late-completion tests |
| Duplicate external effect response | *"duplicate and reordered responses settle only their exact request"*; duplicate settlement cannot duplicate evidence |
| Invalid task ID | *"absent and repeated task IDs preserve filtering, batch duplicate checks and canonical operation uniqueness"*; contract rejection tests |
| Corrupt durable history | *"layout/version/header/JSON/large integer corruption retires with no recovery"*; corrupt execution evidence aborts construction |
| Unsupported protocol | *"unsupported protocol version is rejected before the handler"*; adapter compatibility tests |
| Consumer import of unexported internals | boundary probe: root `src/index.js`, `src/interop/conformance.js`, `tests/adapter-protocol.test.js` all rejected on Node and Bun |

Additional safety probes (21/0 on both runtimes) cover full-row stale/auth/receipt rejection, replay equality, owner fencing, once-only/no-redispatch behavior, COMMIT uncertainty, and adapter protocol safety.

## Package and runtime findings

- The tarball contains exactly 76 regular files; no symlinks, device nodes, TypeScript, source maps, tests, internal docs, `.env`, SQLite files, logs, tarballs, or `src/verify-runtime.js`.
- `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.md`, `README.md`, and `package.json` are present.
- No absolute `/home/...`, `/Users/...`, or `C:\...` path, and no private-key/cloud-token/GitHub-token/OpenAI/Slack token pattern was found in the payload.
- The export map exposes exactly `.`, `./sdk`, `./platform`, `./interop`; root/SDK/platform/interop resolve to 64/1/22/29 exports on both runtimes.
- Importing the package creates no filesystem state and does not require a SQLite-backed store. Memory-only `createChord()` works.
- The sole runtime dependency is `@weipertda/sigiljs@0.18.0`; no source file imports `bun:` or a provider/framework package outside `node:`, relative modules, and SigilJS.
- All 64 source files and six public examples pass `node --check`.

## Conformance runner

The public `runAdapterConformance` utility runs from the shipped package and returns structured, inspectable reports. Reference adapters produce `verdict:INCOMPLETE`, `certification:false`, with explicit skip reasons. A deliberately defective fixture produces `ok:false`, `verdict:FAIL` with correctly classified failures (`WRONG_OUTCOME`, `MISSING_FIXTURE_RELEASE`, `EXPECTED_REJECTION`). The runner is not a certification service and does not convert skips into passes.

## Findings

### P0/P1

None reproduced.

### P2 (carried)

**Intermittent startup `STORAGE_UNAVAILABLE` / child-readiness timing.** The historical failure lacks first-native-operation evidence. During this independent review no recurrence occurred: full Bun, both shared suites, both safety probes, both verifiers, both process examples, and the external consumer workflow all passed. The condition remains bounded as a host/startup P2 under `054-reliability-disposition.md`, `054-reliability-followup.md`, and `054-reliability-followup-disposition.md`. It is not reclassified as environmental or resolved. Any future `STORAGE_CORRUPT`, unauthorized effect, duplicate effect, or post-commit inconsistency is a hard stop.

### P2/P3 (documented, not release-blocking)

- Conformance coverage remains intentionally incomplete: kernel replay/stale-owner checks and portable third-party registration are skips; the runner does not certify external servers.
- Adapter participants are not durable idempotency stores; the server's sequential in-memory result cache is not a global exactly-once guarantee.
- Human identity in examples is host-attested simulation; no network authentication or hostile-host sandbox was tested.
- Verification is Linux-only on the stated Node/Bun versions; no other OS or minimum-version certification is claimed.
- Physical effects and canonical commits are not atomic; downstream idempotency/fencing remains required.

## Invariants verified

- Working tree unchanged across the entire review (status and all 622 hashes).
- No automatic retry, nonexecution inference from timeout/disconnect/process death, or weakened fencing/approval/lease/replay behavior.
- Established historical reports retain their original bytes and conclusions; new reports are additive.
- No staging, commit, reset, clean, stash, tag, push, version bump, dependency change, or publication.

## Gate

**Block 054 independent verification: COMPLETE with bounded P2.** The exact working-tree artifact passes every deterministic release gate, the external developer workflow is demonstrated through supported exports only, and the conformance runner detects defective adapters. Proceed to the Block 054 final report and Block 055 planning. Publication remains unauthorized.
