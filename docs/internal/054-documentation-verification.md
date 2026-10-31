# Block 054 — Documentation verification

## Pass

**054 Pass 5 documentation engineering gate PASS, with the bounded verification and carried risks below.** This is the current completion artifact. Historical `054-developer-experience.md` and all earlier reports retain their original bytes and conclusions; they are not rewritten as fresh evidence. No Pass 6 or Block 055 work was performed.

## Agent

`documentation-agent`, delegated README/documentation completion only.

- R = `/home/d/Workspace/other-projects/chord`; P = `R/packages/core`.
- S = `/home/d/.hermes/cache/scratch/054-pass5-yf2dplhs`.
- C = `S/chord-guides.QQDAqy/consumer`, a newly created private ESM project with an actual offline npm tarball installation.
- N = `/home/d/.volta/tools/image/node/24.22.1/bin/node` (**v24.22.1**).
- B = `/home/d/.bun/bin/bun` (**1.4.3**).
- Entry HEAD: `72f96ab6cdc9d6948ffb7eacba527cc27a32a8be`; extensive inherited dirty work was retained, not reset or replaced.

## Files inspected

- Live repository README, package README and `packages/core/package.json`. There is **no root package.json**: package commands must use P. The configured origin was read with `git remote -v`; it now agrees with the manifest's `antistructured/chord` repository, unlike the historical mismatch claim.
- All six shipped examples: `quickstart.mjs`, `cross-actor-workflow.mjs`, `process-recovery.mjs`, `two-process-coordination.mjs`, `adapter-interop.mjs`, `adapter-conformance.mjs`.
- Public root/SDK/platform/interop entry points; legacy/coordinated SDK wrappers and source boundaries cited by the active READMEs: contracts, authorization, attempt reservation, task shaping, runtime dispatch, reconciliation, snapshots, state owner, history/replay, routing, actor client/ingress/transport, adapter bridge/server/protocol, and conformance interface/report coverage.
- 053 protocol/runtime/effect-safety/reference-adapter/consumer/conformance/developer/final reports and interoperability audit; current 054 API/conformance/reliability reverifications, parent reliability disposition and actual installed-consumer proof. Earlier 054 developer-experience, consumer, conformance, hygiene and integrity reports were treated as stage-specific history, not current acceptance evidence.
- LICENSE, package manifest license and third-party notices. These support the Apache-2.0 first-party/MIT separately installed SigilJS description, not an independent chain-of-title opinion or release permission.
- Fresh tarball members, installed payload, command outputs, conformance scopes/expected-negative results and retained proof artifacts. Active source locators were checked as searchable module/symbol references; named tests remain semantic locators rather than drifting line offsets.

## Files changed

Only documentation in the repository:

- `README.md`: clearer first screen without an internal dependency prerequisite; positioning/vision retained; all 18 numbered sections and TOC anchors; original canonical tables and inline workflows retained; updated entry-point inventory, evidence precedence, local installation, license/contribution metadata and boundary explanations. Numeric source/test references were replaced by module/symbol or named-test/file locators.
- `packages/core/README.md`: setup/guide links, six-example description, current historical measurement attribution, corrected live remote/license wording, and a standalone scratch-backed adapter-registration lifecycle block instead of `/path/to/run.sqlite` plus unclosed resources. The block explicitly does **not** claim task execution. The small conformance block asserts INCOMPLETE and prints certification status.
- New external-developer guides: `docs/guides/README.md` (setup, local offline install, mode decision table, trust roles, resource lifecycle and unknown reconciliation), plus `first-task.md`, `two-actor.md`, `durable-restart.md`, `cross-process.md`, `adapter.md`, `conformance.md`.
- `docs/internal/054-documentation-verification.md` (this report).

No production source, tests, examples, manifests, lockfiles, dependencies, versions, legal notice files or historical reports were changed in this pass. Scratch drivers/logs are outside R. The existing default-profile documentation-verification skill was extended with standalone-block and code-aware link-check lessons; no other profile changed.

### README section map

The numbered structure is discoverable through the root TOC. Existing sections 1–11 keep their numbering/content responsibilities; seven short integration/reference sections add navigation rather than replacing the long canonical material.

| Section | Heading / purpose |
|---|---|
| 1 | Chord: identity and value proposition |
| 2 | Why coordination is harder than executing tasks |
| 3 | What Chord does today — Class A/B/C boundaries |
| 4 | Core conceptual model |
| 5 | Architecture and responsibility boundaries |
| 6 | Runnable quickstart — retained inline public example |
| 7 | Complete canonical workflow — retained table and inline example |
| 8 | Supported guarantees — retained canonical table with mode scoping |
| 9 | Known limitations |
| 10 | Project vision and staged roadmap — future levels are not current features |
| 11 | Project status, license, and contributions — includes development commands |
| 12 | Installation and runtime setup |
| 13 | Choosing a storage and coordination mode |
| 14 | Actors and cross-process collaboration |
| 15 | Adapters and framework integration |
| 16 | Conformance and verification — current versus historical evidence |
| 17 | Developer workflow guides — six workflows |
| 18 | Public API and documentation map |

## Test commands

Every subprocess record includes actual argv, cwd, exit and log path in `S/commands.json` or `S/extra-commands.json`. The main reproducible driver is `/home/d/.hermes/cache/scratch/054-pass5-verify.py`; the negative probe and link/source/preservation checker are `054-pass5-negative.mjs` and `054-pass5-doc-check.py` in the same scratch parent. Setup/install and all six guide bash blocks were executed literally, with the documented shared shell environment. The package development block covers the root's identical Bun test/verifier/example commands; no separate full Node-suite claim is made.

| Exact command / explicit expansion | Cwd | Observed exit/result |
|---|---|---|
| `python /home/d/.hermes/cache/scratch/054-pass5-verify.py` | R | 0; 38 recorded command batches, no failed acceptance commands |
| Guide setup: `export CHORD_REPO="$PWD"`; private `mktemp -d "$TMPDIR/chord-guides.XXXXXX"`; `N="$(node -p process.execPath)"`; `B="$(command -v bun)"`; `(cd "$CHORD_REPO/packages/core" && "$B" install --frozen-lockfile)` | R | 0; versions printed, frozen install successful |
| `npm pack --ignore-scripts --pack-destination E` (E = `S/chord-guides.QQDAqy`) | P | 0; actual local tarball, no publication |
| `npm install --offline --ignore-scripts --no-audit --no-fund --save-exact E/antistructured-chord-0.4.0-preview.1.tgz` | C | 0; actual fresh installation, no network fallback |
| `H packages/core/examples/quickstart.mjs`; `H packages/core/examples/cross-actor-workflow.mjs`; `H packages/core/examples/adapter-interop.mjs`; `H packages/core/examples/adapter-conformance.mjs` for each H = N, B | R | 0 each; literal guide commands |
| `H packages/core/examples/process-recovery.mjs E/restart-T H` for (H,T) = (N,node), (B,bun) | R | 0 each; fresh directories, `B5 PASS` |
| `H packages/core/examples/two-process-coordination.mjs E/actors-T H H` for same pairs | R | 0 each; fresh directories, real owner/actor/standby, replay/reopen and joined exits |
| `H C/root-block-I.mjs` for I=0,1; `H C/package-block-I.mjs` for I=0,1,2,3,4, H=N,B | C | 0 all 14 executions; extracted **standalone** README JS blocks, public bare imports |
| `H C/node_modules/@antistructured/chord/examples/F.mjs` for H=N,B, F=`quickstart`, `cross-actor-workflow`, `adapter-interop`, `adapter-conformance` | C | 0 each, actual installed scripts |
| Same installed `process-recovery.mjs S/installed-restart-T H`; `two-process-coordination.mjs S/installed-actors-T H H` | C | 0 each, fresh proof directories, joined processes |
| Root quickstart shell block: `cd packages/core`; `bun install --frozen-lockfile`; `bun run examples/quickstart.mjs` | R | 0 |
| Package development shell block: `cd packages/core`; `bun install --frozen-lockfile`; `bun test`; `bun run src/verify-runtime.js`; `bun run examples/quickstart.mjs`; `bun run examples/cross-actor-workflow.mjs`; `bun run examples/adapter-conformance.mjs`; `npm pack --dry-run --ignore-scripts` | R | 0; **448 pass / 0 fail / 1777 expect calls / 31 files**, 143.91 s |
| `N src/verify-runtime.js`; `B src/verify-runtime.js` | P | 0 each; all runtime validations passed |
| `H C/documentation-negative.mjs` (exact public-only scratch negative probe), H=N,B | C | 0 each; exports 64/1/22/29; three private JS/test subpaths rejected; defective fixture correctly FAIL |
| `python /home/d/.hermes/cache/scratch/054-pass5-doc-check.py` | R | 0; section/links/symbols/named-test/preservation checks, `S/documentation-checks.json` |
| `git diff --check` | R | 0; no whitespace errors |

The driver extracts JS fences rather than reconstructing plausible snippets. Bare imports resolve from the installed private consumer, not a source symlink. Existing README setup-only JS blocks are also exercised even where not behaviorally edited. Full Bun execution is fresh; the 448 measurement in public documentation remains explicitly attributed to the earlier Pass 3 reverification rather than presented as a permanent headline guarantee. No guessed placeholder install path was executed.

## Exit codes

All final engineering acceptance commands above returned **0**. The intentionally wrong fixture returns `ok:false`, `verdict:FAIL`, `certification:false`; surrounding probes return 0 only after asserting that expected rejection. Documentation-tool iterations included an atomic patch that rejected ambiguous context without writing, oversized output/lookup guard refusals and an initially nonexistent source symbol (`prepareAttempt`, corrected to actual `prepareAttemptRecord`). These were authoring/checker corrections, not hidden runtime test failures. An initial named-test checker also exited 1 because a Markdown-wrapped title retained a newline; normalizing prose whitespace matches the actual test title without changing documentation or test behavior, and the final checker exits 0. No supported runtime example or product acceptance command failed.

## Observed outcomes

- All six concise workflows execute on Node and Bun from the repository, and all six shipped examples execute from the newly installed consumer. Restart and actor proofs use separate fresh output directories, not reused historical evidence. Single-process actor identity examples are explicitly distinguished from actual multiprocess proofs; the adapter example uses memory transport, not an independent remote service.
- All seven README JS blocks run standalone on both runtimes (14 successes). The adapter lifecycle block prints registration without dispatch; the conformance block reports `INCOMPLETE`, never certification. Root and package quickstart blocks and the root canonical workflow match their shipped scripts **verbatim** (all three comparisons true in `S/artifact.json`).
- Fresh full Bun suite: **448 pass / 0 fail / 1777 expect calls / 31 files**. Both runtime verifiers exit 0. This is not a full Node suite; files importing `bun:test` remain Bun-native.
- Fresh installed import enumeration: root **64**, `/sdk` **1**, `/platform` **22**, `/interop` **29** on both runtimes. Deliberately attempted private `src/index.js`, `src/interop/conformance.js`, `tests/adapter-protocol.test.js` subpaths reject on both; package export maps are not OS isolation.
- Reference handler and supplied safe fixture reports remain `INCOMPLETE`, `certification:false`. A deliberately always-completed endpoint yields four expected failed checks: failed and blocked outcomes → `WRONG_OUTCOME`, held/cancel scenario → `MISSING_FIXTURE_RELEASE`, timeout scenario → `EXPECTED_REJECTION`. No broken fixture is called conforming, and Chord controls are not third-party coverage.
- Fresh private tarball SHA-256: **`f05546b26f2355a98273b2748150684c187ce4868fb417269044475b3efd3abf`**, path `E/antistructured-chord-0.4.0-preview.1.tgz`. All **75** regular tarball member hashes agree with final P source and actual installed copies (`S/artifact.json`, zero mismatches). This refreshes documentation payload correspondence after editing the shipped README; it does not rewrite or replace Pass 4's historical tarball/hash/composed independent-participant evidence.
- Apache-2.0 is accurately presented as the checked-in first-party license, with separate MIT SigilJS notices. Historical speculative clearance/remote-transition blockers are not repeated as current header claims. Matching repository metadata is not authenticated registry ownership or publication permission.

## Invariants verified

- Documentation-only scope: entry inventory hashes (`/home/d/.hermes/cache/scratch/054-pass5-entry.json`) identify the inherited dirty artifact. Existing files changed only at `README.md` and `packages/core/README.md`; all existing production/tests/examples/manifests/lockfiles/historical reports and other inventoried files retain entry bytes. No reset/stash/clean/stage/commit/push/tag/version/dependency/publication action occurred.
- Public examples and docs do not recommend private source imports or exposing admin/store/owner handles to actors. Host authentication/authority installation, actor IPC, execution bridge/participant and canonical owner are distinct roles. Advertisement and descriptive capabilities confer no grant. The pure core/imperative shell and provider-neutral kernel remain unchanged.
- Default memory, exclusive sequential v1 restart and separate fenced-owner v2 are not collapsed into one durability guarantee. V1/v2 compatibility/migration limits, explicit owner lifecycle, pinned identity, fresh host enrollment and 052A framed-transport incompatibility remain explicit.
- Timeout/cancel/close/shutdown/lease loss are not evidence of remote nonexecution. Reconciliation uses human attestation, current authority, current revision and decision-matching evidence. No automatic effect retry, recreated command ID or rollback fiction is recommended. Kernel canonical fencing is separated from downstream physical-effect fencing and semantic dedupe.
- Conformance scopes, skips, INCOMPLETE, expected bad-fixture failures and `certification:false` stay visible. Replay/stale-owner and portable registration skips are not relabeled passed because separate kernel tests pass.

## Remaining risks

- Parent Pass 1's **UNRESOLVED P2** historical first-native startup cause remains unresolved under `054-reliability-disposition.md`. Green documentation runs do not establish a cause, environmental classification or closure. Any recurrence must preserve first native failure/child stderr/readiness/resource evidence.
- Local Linux/runtime verification only; no minimum-version/all-platform certification, network/provider deployment, real human authentication, hostile-code sandbox, durable participant semantic dedupe, power-cut proof, multi-machine owner consensus or exactly-once physical effect proof.
- Active local Markdown paths/headings and source symbol presence are mechanical checks, supplemented by live source review and execution; they are not a formal proof of every English guarantee. Historical reports intentionally retain obsolete counts, old selector examples and conclusions. Prefer current guides/READMEs/current reports; source `#symbol` refs are search locators, not generated HTML anchors. External URLs were not all network-fetched, and registry ownership/publication status was not independently re-probed.
- This pass refreshes one fresh actual installed consumer and all shipped examples; it does **not** re-run Pass 4's eight composed owner/actor/independent-adapter cross-runtime workflows or claim a second such independent proof. That evidence remains in the unchanged Pass 4 report. A final later shipped-file edit requires another payload/hash comparison and affected gates.
- Scratch evidence is cache-managed local material, not a signed release archive. No legal ownership audit or publication permission follows from checked-in license inspection or successful pack/install.

## Next gate

**Pass 5 documentation gate PASS; next is parent review, then the separately sequenced Pass 6 runtime/package-hygiene verification.** Read this report with the entry/final preservation check, command ledgers and artifact hashes. Carry the startup P2, incomplete conformance scopes and physical-effect limits unchanged. Existing historical `054-runtime-package-hygiene.md` is not a fresh Pass 6 completion. **Stop here: no Pass 6 execution, Block 055, commit, version change, push, tag or publication authorized or performed.**
