# Block 054 — External installed-consumer proof

## Pass

**054 Pass 4 engineering gate PASS, with explicit trust/coverage limits below.** Actual private npm tarball installation, not a dry-run copy or symlink simulation. Pass 5 was not started. This report supersedes only the *current-proof interpretation* of historical `054-external-consumer.md`; that historical report is unchanged.

## Agent

`consumer-agent`, delegated Pass 4 only.

- R = `/home/d/Workspace/other-projects/chord`; P = `R/packages/core`.
- S = `/home/d/.hermes/cache/scratch/054-pass4-96pyjfmq` (new scratch root).
- N = `/home/d/.volta/tools/image/node/24.22.1/bin/node`, **v24.22.1**.
- B = `/home/d/.bun/bin/bun`, **1.4.3**; npm **12.0.2**.
- Entry HEAD `72f96ab6cdc9d6948ffb7eacba527cc27a32a8be`; inherited dirty 052/052A/053/054 work retained.

## Files inspected

- Live manifest/exports, `src/interop/index.js`, `adapter-protocol.js`, `adapter-bridge.js`, `adapter-server.js`, `conformance-participant.js`, and runner API/report boundaries in `conformance.js`.
- `src/sdk/coordinated-chord.js`, `src/sdk/chord.js`, `src/runtime/actor-ingress.js`, `src/coordination/{commands,runtime}.js`: authority, actor admission, exact approvals, dispatch/outcome and late-owner boundaries.
- Public shipped examples `cross-actor-workflow.mjs`, `two-process-coordination.mjs`, `adapter-interop.mjs`, `adapter-conformance.mjs`; relevant package README public API, trust, ownership, conformance and package sections.
- Current `054-adapter-conformance-reverification.md`, `054-reliability-disposition.md`; historical package-hygiene claims kept historical, not rerun evidence. Manifest license, LICENSE header, NOTICE and THIRD_PARTY_NOTICES.
- Tarball members, both actual installations, their dependency trees/lockfiles, consumer outputs, actor transcripts, effects, full canonical snapshots/replay/reopen and per-process exit evidence.

## Files changed

**Only repository addition:** `docs/internal/054-external-consumer-proof.md` (this report). No production, test, example, manifest, version, dependency, lockfile or historical audit edits.

All consumer programs/evidence are outside R under S:

- `package-proof.py`, `build-consumer.py`, `run-consumers.py`, `final-checks.py` reproduce packaging, composition and checks.
- `install-{a,b}/consumer.mjs`: scratch composition of the **shipped public** multiprocess example, with its actual workflow adapter routed through a public bridge to a separate public adapter-server child. No private fixture copied.
- `install-{a,b}/negative.mjs`, `request-isolation.mjs`, `public-boundaries.mjs`: public-export-only probes; boundary script deliberately attempts forbidden imports and requires rejection.
- `entry-hashes.json`, `artifact.json`, `commands.json`, `preservation.json`, `matrix.json`, import inventories, logs and outcome directories retain evidence.

A default-profile documentation-verification skill was extended outside R with actual offline tarball-install/composed-process proof guidance. No other profile changed. No staging/commit/push/tag/publication/reset/stash/clean; old `/tmp` evidence was not touched.

## Test commands

All **34** recorded subprocess argv/cwd/exit/log entries are in `S/commands.json`; all exited **0**. These are real command records, not synthesized npm responses. `package-proof.py` runs packaging/install with `TMPDIR=S`, `npm_config_userconfig=/dev/null`, `npm_config_fetch_retries=0`, `npm_config_fetch_timeout=15000`; offline installation disallows registry network access. No credentials or production secrets were supplied. No fallback was needed because npm already cached SigilJS 0.18.0.

| Actual command / expansion | Cwd | Exit / evidence |
|---|---|---|
| `npm pack --ignore-scripts --json --pack-destination S` | P | 0; `pack.log`, `artifact.json` |
| `npm install --offline --ignore-scripts --no-audit --no-fund --save-exact S/antistructured-chord-0.4.0-preview.1.tgz` | each `S/install-a`, `S/install-b` | 0 each; two new private ESM projects, real node_modules/lockfiles |
| `npm ls --all --json` | each install | 0 each; `install-a-tree.log`, `install-b-tree.log` |
| `python3 S/build-consumer.py` | S | 0; scratch-only composition, `build-final.log` |
| `H consumer.mjs S/install-X-h-w H W` | `S/install-X` | 0 for all eight X∈{a,b}, (h,w)∈{node,node; node,bun; bun,node; bun,bun}; H/W expand to N/B |
| `H request-isolation.mjs S/install-X-h-w/evidence.json W S/install-X-h-w-request-identity.json` | corresponding install | 0 for same eight pairs |
| `H negative.mjs S/install-X-h-negative` | corresponding install | 0 for four initial Node/Bun/install combinations; retained earlier handler-invalid-result probe |
| `H negative.mjs S/install-X-h-negative-final` | corresponding install | 0 for four final combinations; now injects an actually malformed **wire response** |
| `H public-boundaries.mjs` | corresponding install | 0 for four combinations; all four supported exports and intentional forbidden-subpath rejections |
| `python3 S/package-proof.py` | R | 0; invokes first five ledger entries, actual 75-member source/tar/install comparison |
| `python3 S/run-consumers.py` | R | 0; invokes build and initial 20 consumer commands |
| `python3 S/final-checks.py` | R | 0; invokes final eight commands, rechecks source/artifact/both installs and entry preservation |
| `git diff --check` | R | 0, empty output |

The scripts' own success is not substituted for their child exits. The full individual argv values (without aliases) are retained in the ledger. Reproduction needs **new** output directories; the examples intentionally reject existing directories rather than overwrite evidence. Initial successful exploratory executions `N consumer.mjs S/first-node-node N N` and `N negative.mjs S/negative-first` were also run, exit 0; their outcomes do not substitute for the final matrix. No command failure was encountered during this pass.

## Exit codes

Pack/install/tree queries, eight composed workflows, eight live per-request identity proofs, initial/final negatives, public-boundary checks, harness drivers and diff check all returned **0**. The deliberately defective conformance fixture returns structured **FAIL**; its surrounding consumer exits 0 only because it asserts that failure. No failed fixture was counted as a conforming adapter.

## Observed outcomes

### Actual local artifact and fresh installations

Package: `@antistructured/chord@0.4.0-preview.1`.

Tarball: `S/antistructured-chord-0.4.0-preview.1.tgz`.

**SHA-256:** `345be009d4d1f51e3dd543e57e1f6780e0ee8a7e4ec259f063fcc23c78d70d4a`.

Exactly **75 regular payload files** match their current P source bytes and both installed package copies by SHA-256, checked again after the final probe revision. `artifact.json` retains pack metadata and every path/hash. Both Chord and SigilJS installed directories are real directories, **not symlinks**. This is actual npm extraction/resolution, unlike the preceding pass's payload copy.

Both scratch manifests explicitly set `private:true`, `type:module`. Their lockfile v3 records Chord's local tarball with integrity `sha512-fNqBsbYtrd8IeUSTUzjX6TAtWZrWVk7Pa6fdH5/BscLiTvrOEUpZ8TfM7Y+5UJ0u0PxylI+2m3MBnhP31waPYw==`. The only runtime dependency resolves to `@weipertda/sigiljs@0.18.0`, integrity `sha512-5m+SYlCrFmC9IJMPMINJbvB2KG38VMumBx02nyEceghcu476XIuUPHkCPUASmlBeHp3d2YapM9d2cRKt2p47sg==`, from the existing npm cache. Its lockfile registry URL identifies provenance, **not an online fetch in this offline run**.

All four documented exports resolve on both runtimes: root **64**, SDK **1**, platform **22**, interop **29** exports. Root/interop runner identity agrees. Both reject the deliberately attempted `src/index.js`, `src/interop/conformance.js` and `tests/adapter-protocol.test.js` subpaths. `install-{a,b}-imports.json` statically inventories functional consumer dependencies: only documented bare root/interop imports and `node:` builtins. No relative package-source imports, private fixture imports, dependency links, registry transfer or canonical object mutation was used.

### One governed workflow, with the interop adapter actually on its effect path

The composed workflow does not combine two unrelated green examples. Host authority/policy → authenticated actor command admission → handoff/approval → coordinated runtime claim → **public bridge → independent adapter-server process → actual file write** → correlated response → canonical result → authorized observation → pure replay → fresh observer reopen are the same workflow.

Alice and the human are separate host-attested local channel identities; **Bob is an actual independent actor process** using only `createActorClient`, and the adapter participant is another actual child. Human approval is a simulated host attestation to a distinct `kind:human` principal, not a demonstrated human login or UI. Actor handoff is context exchange, not a grant or owner transfer.

Each of eight fresh runtime/install runs asserts: accepted handoff; ungranted work denied; wrong handoff actor denied; approval-required dispatch denied before invocation; nonhuman/invalid approval response denied; exact approved reserved attempt consumed; two actual `wx` file effects with distinct effect keys; two committed outcomes; authorized scoped observation; historical duplicate receipts unchanged/no effect; next cycle skips; zero extra adapter calls/file writes during replay; full envelope replay equality and independent durable reopen equality. Final deterministic metadata: **revision 14, 6 receipts, 2 attempts, 2 results, 2 file effects, replay effect delta 0**. Random run/commit/attempt IDs and actual PIDs are retained, not falsely normalized into deterministic IDs.

| Install/runtime owner→actor+adapter | Owner PID | Actor PID | Adapter PID | Standby PID |
|---|---:|---:|---:|---:|
| a, Node→Node | 155077 | 155110 | 155103 | 155117 |
| a, Node→Bun | 155362 | 155400 | 155371 | 155421 |
| a, Bun→Node | 155604 | 155640 | 155633 | 155647 |
| a, Bun→Bun | 155788 | 155842 | 155821 | 155863 |
| b, Node→Node | 156061 | 156075 | 156068 | 156082 |
| b, Node→Bun | 156224 | 156252 | 156231 | 156273 |
| b, Bun→Node | 156562 | 156599 | 156592 | 156606 |
| b, Bun→Bun | 156800 | 156867 | 156834 | 156886 |

Worker self-reported PIDs match spawned PIDs, real executable paths are resolved before spawn, and role PIDs differ. Standby denies `OWNER_HELD`/`NOT_OWNER` with unchanged state. Adapter `close`, actor client close, detach and **actual process joins** are verified; no remote nonexecution is inferred from bridge shutdown. Evidence per run: `evidence.json`, `processes.json`, `final.json`, `replay.json`, `reopened.json`, `actor-transcript.json`, `physical-effects.ndjson`, `alice.effect.txt`, `bob.effect.txt`, and role exit files. Adapter PID is independently recorded on each physical effect.

### Required negative cases: effects versus canonical knowledge

Final `negative.mjs` runs on both installed projects under both runtimes; exact reports/snapshots are under `S/install-X-h-negative-final`. These kernel fault probes use the public in-memory transport and **two independent host handles for takeover, not two owner processes**. The positive workflow and the separate identity probe are real multiprocess proofs. No process claim is made for this in-memory kernel fault fixture.

| Case | Actual observation | Measured file effects / canonical knowledge |
|---|---|---|
| `noGrant` | Alice submits foreign-scope packet: `NO_ALLOW_GRANT`; full inspected row unchanged | **0** before dispatch; no foreign admission |
| `wrongActor` | Sender tries target's handoff acceptance: `FORBIDDEN`; full row unchanged | **0** at denial; no handoff mutation |
| `invalidApproval` | Wrong approval-request identity rejected `FORBIDDEN`; Bob approval rejected as nonhuman; approval-required cycle rejects before adapter entry | **0** before valid approval; later exact reserved human approval permits **1** protected Alice effect |
| `unsupportedAdapterProtocol` | Public bridge constructor rejects `UNSUPPORTED_PROTOCOL` | **0**, no canonical run created for this constructor control |
| `malformedResponse` | Actual result wire given an extra undeclared field after the handler writes; bridge refuses false result | **1** actual append; task `uncertain`, operation `unknown`, **0** canonical results |
| `staleSession` | Result delivered with foreign session; cycle remains pending, **0** results before valid original frame released | **1** physical effect; only correct frame gives `completed/confirmed`, **1** result |
| `requestIdentity` | Result delivered with foreign request; same pending/result assertions | **1** physical effect; only correct frame commits **1** result |
| `expiredLostOwner` | Effect starts at clock 100; at 30101 fresh handle acquires successor generation and quarantines dispatch; old callback released then rejects `OWNER_LOST` | **1**, not zero; task `uncertain`, operation `unknown`, **0** results; **complete inspected snapshot unchanged** by old callback (`expiredLostOwner-before/after.json`) |
| `ambiguousEffect` | Handler physically appends then holds past bridge's explicit 30 ms timeout; no blind retry; released late result cannot modify canonical state | **1**, task `uncertain`, operation `unknown`, **0** results; subsequent cycle skips |

Every final negative canonical envelope independently equals replay and replay adds **0** file effects. Physical count is checked against retained NDJSON file lines, not inferred from canonical result count. Uncertainty is knowledge, not rollback or evidence of nonexecution.

The additional `request-isolation.mjs` uses a **real adapter child for all eight same/cross-runtime pairs**. It reuses an actual captured public packet/context. First response is withheld until the bridge times out unknown. A second send on the **same live wrapper/session**, with identical packet/context and a fresh request UUID, receives the genuine old result before its own result: old result cannot settle it. Only release of the current response resolves it. Server's explicit **in-memory handler counter is 1**, because its sequential successful-result cache deduplicates the stable key; that counter is not mislabeled a durable file effect. Each worker joins. This bridge-only probe makes **no canonical mutation or durable exactly-once claim**; it separates request identity from session replacement and logical-effect idempotency.

### Supplied-fixture conformance, not certification

Each final negative program also supplies its **own safe participant endpoint** using public `createAdapterServer`, explicit completed/failed/blocked/held actions, release/cleanup and public bridge factory. Actual returned report: **52 total / 35 pass / 0 fail / 17 skip**, `ok:true`, `verdict:INCOMPLETE`, `certification:false`.

Coverage partition: **18 supplied-participant passes + 1 registration skip; 10 supplied-bridge passes; 7 Chord-harness passes + 2 kernel safety skips; 14 absent-handler skips**. The file-writing workflow adapter is deliberately not subjected to destructive adversarial runner actions; the safe fixture is a separate conformance target, not claimed to certify that file adapter.

A deliberately defective supplied endpoint always returns completed/succeeded and has no held-action release. It yields **52 / 31 pass / 4 fail / 17 skip**, `ok:false`, `verdict:FAIL`: failed/blocked scenario outcomes report `WRONG_OUTCOME`, cancel-late reports `MISSING_FIXTURE_RELEASE`, timeout reports `EXPECTED_REJECTION`. Both runtimes assert this failure. Full check-level reports are `conformance.json`, `defective.json`; no failure details were replaced by a success summary.

**Runner `safety.no_effect_on_replay` and `safety.stale_owner_result` remain SKIP.** The actual consumer's canonical replay/file-effect and late-owner snapshot tests above are separate positive kernel evidence, not rewritten runner coverage. Portable registration remains unsupported. No third-party certification or universal exactly-once claim follows.

## Invariants verified

- Existing prior work preserved: entry universe is `git ls-files --cached --others --exclude-standard`, **607 files**, all still byte-identical. Ignored files are outside that inventory; they were not touched. Historical `054-external-consumer.md` SHA-256 remains `dbc89c6fc0194baf33e647855eec63ab3d8a3d82b4fc3c2a8f3dbfec2eaa38fc`.
- Real local tarball, all 75 member hashes match source and two actual installations; no version/dependency change, symlink dependency fallback or network dependency download.
- Functional consumer code uses only documented bare exports; administrative authority stays host-side, actors receive bounded commands/responses, adapter receives packet/context, not admin/store/registry/owner credentials.
- An actual independent interop participant performs the same governed workflow's effects. Each logical workflow effect writes once in these measured runs; duplicates/replay do not write again.
- No grant/wrong actor/invalid approval cannot dispatch; descriptor compatibility grants nothing. Accepted approval is distinct-human, exact reservation/attempt-bound and consumed at dispatch.
- Response correlation filters stale session/request frames; late lost-owner callback cannot overwrite canonical state; timeout/malformed post-effect results remain uncertain without automatic retry.
- Close and process join are separate assertions. Recorded actual spawn/self PIDs, file effects, full canonical state, trace replay and independent durable reopen agree.

## Remaining risks

- **Local engineering test only.** Manifest/first-party LICENSE identify Apache-2.0; NOTICE and THIRD_PARTY_NOTICES retain SigilJS 0.18.0's separate MIT terms. This verifies inclusion/provenance, not ownership/legal clearance, publication authorization or resolution of existing release/legal concerns. Tarball stayed private in scratch; nothing was published.
- Human identity/authentication is simulated out-of-band host attestation; no real human login, network authentication, hostile-OS sandbox or production transport was tested. Alice/human use local host channels; Bob/adapter/standby are real processes.
- Faulted kernel takeover here is two handles in one consumer process with a deterministic shared clock, not cross-process takeover or clock-fault certification. Real multiprocess runtime pairs cover normal execution and live standby denial. Broader prior safety suites are not relabeled fresh Pass 4 execution.
- Physical side effects and canonical commits are not atomic. Stale work can physically execute before higher fencing is observed; the sample file adapter does not implement production durable semantic dedupe/generation fencing. Its `wx` files and server's sequential in-memory cache are test protections, not global exactly-once guarantees.
- Conformance remains incomplete; no universal effect observer, portable registration, durable concurrent dedupe, remote cancellation guarantee or certification. Safe fixture's passing results do not certify the separate file adapter or arbitrary third parties.
- Parent Pass 1's historical startup **UNRESOLVED P2** remains exactly that under `054-reliability-disposition.md`. Green fresh installs/process runs do not classify its unknown native cause as environmental or resolved.
- Scratch evidence is local and cache-managed, not a sealed release archive. The immutable tar/source correspondence is recorded for this dirty artifact; later shipped edits require a new artifact/reverification.

## Next gate

**Pass 4 installed-consumer engineering gate PASS; report/evidence ready for parent review.** All requested case names have actual observed evidence with effect/canonical distinctions; process and conformance limits are explicit, not hidden as certification. No new supported-path state/effect-safety blocker was reproduced. Carry existing P2 and publication/legal restrictions. **Stop here: Pass 5 not executed; no Block 055, commit, version change, push, tag or publication authorized.**
