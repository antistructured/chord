# 046 — Pass 1: Repository reality audit

**Gate: READY for the bounded state audit; release readiness BLOCKED.** Manual virtual audit-agent pass, not a release approval.

## Baseline and preservation
- Repository `/home/d/Workspace/other-projects/chord-v0.3.0`, branch `main`, HEAD `ba3e37ea035a2862e06766ed7f90513babf945b0`.
- Required six Git commands executed before repository writes. No staged changes. Existing tracked edits and untracked Blocks 2–6 documents/runtime/tests are pre-existing work, not authored by this audit. No ownership inferred beyond that; all preserved.
- Baseline full status, binary diff, ignored inventory and SHA-256 map saved under `/home/d/.hermes/cache/scratch/chord-046/`. No clean/reset/commit/branch switch/version/tag/publication.
- No root package.json; actual package `packages/core/package.json`, `@chord/core@0.3.0`, ESM. Only dependency `@weipertda/sigiljs@0.18.0`, matching bun.lock and installed package. Actual `Sigil.exact`/version/check API is used through clonePlainData/define; schema validity is not identity authentication.
- Exports: root, `./sdk`, `./platform`. Root reexports SDK/platform/query/snapshot/types. Trace reducer and recovery policy are physically packed but **not exported**. No files whitelist, engines declaration, package license field or first-party LICENSE found. Dry-run payload includes tests, fixtures and dev_flow.md.

## Documents inspected
All 17 explicitly required paths exist and were read: 040 audit/scope, 041 authority/final, 042 lifecycle/state/context/approval/final, 043 evidence/reducer/guarantees/final, 044 design/final, 045 gate/final. No missing required documents. Historical reports remain unchanged.

Block 1 explicitly deferred authoritative reconstruction; later Block 4 claims it was implemented. Block 6A explicitly requires Level B for its declared scope: reverting to the older diagnostic-only scope cannot satisfy this block. Block 2 deferred whole-run clone-swap to Block 3; Block 3 added a helper, not consistent ownership/commit routing. Later completion reports overstate the implementation.

## Execution evidence
Commands run separately from `packages/core`; raw stdout/stderr and individual exits: scratch `commands.json` and named logs.
- Bun 1.3.14, Node v26.7.0, npm 12.0.2 on Linux x86_64.
- `bun test`: exit 0, 126 pass / 0 fail / 1026 assertions across 8 files.
- `bun run src/verify-runtime.js`: exit 0. Its uncertain replay check does not establish reconciliation safety.
- `bun run demo:via`: exit 0; adapter is invoked directly at src/demo/callaback-demo.js:88–102. Output shows the kernel task still queued: not governed end-to-end proof.
- `node examples/cross-actor-workflow.mjs`: exit 0; first task uncertain, then completed through manual state reset. Success output is not release evidence.
- `npm pack --dry-run --json`: exit 0; 52 files. No real tarball or consumer installed in this pass.
- No lint/typecheck scripts. No first-party TS/TSX found (excluding dependency/editor history).

## Suspected findings
| ID | Priority | Disposition and evidence |
|---|---|---|
| F6A-01 | P0 | CONFIRMED: canonical example :69–71 and canonical test :67–69 manually reset task/queue. |
| F6A-02 | P0 | CONFIRMED: trace-reducer.js:7–27 collects events/run metadata only; empty tasks/queues, no authoritative reconstruction. Unknown versions/types/foreign identities/history gaps accepted. diffTraces compares ID sets. |
| F6A-03 | P0 | CONFIRMED: example has only service principal, no human approval records, requires_approval=false, unsupported `reason` makes initial AdapterResult invalid/uncertain. pause/resume is not approval. Existing Block 2 genuine approval tests remain valuable. |
| F6A-04 | P0 | CONFIRMED proof gap: example imports internal src paths; reducer unavailable from documented exports. Prior install/import report does not prove full external workflow. Current full consumer NOT TESTED. |
| F6A-05 | P0 | CONFIRMED source defect: SDK commitRun passes a temporary `{registry}` holder; closure and SDK state never change on reported successful commit. Ordinary mutations bypass helper; rollback/revision/event coupling unproven. Pass 2 reproductions required. |
| F6A-06 | P0 release integrity | CONFIRMED: later work remains tracked-modified or untracked at old Block 2 HEAD; current source is not reconstructible from HEAD alone. No authorized audit commit; artifact/source-manifest evidence will be needed after corrections. |
| A046-01 | P0 | Runtime checks task status, not run.state. Paused/failed run may dispatch queued work; targeted probe required. |
| A046-02 | P0 | projectContext reveals all tasks when no grants, unfiltered queue/artifact/domain summaries, and live scope/nested array aliases. |
| A046-03 | P0 | registerSpecAndQueue writes spec/event and potentially grants before admission rejection; prepareAttempt writes without revision/event. |
| A046-04 | P0 | replayTask accepts uncertain->queued from grant alone; no no-effect confirmation/reconciliation evidence required. No automatic runtime retry is not equivalent to safe explicit replay. |
| A046-05 | P1 | Package whitelist/license/runtime-range clarity; do not invent a license grant. |
| A046-06 | P2 | Distributed store, authentication infrastructure, sandboxing, simulation, cryptographic integrity remain excluded. |

## Locked correction scope / next gate
Proceed only with Pass 2 mutation/ownership/failure reproductions. Retain JS/ESM/SigilJS and current layout. Do not patch examples to use unsafe replayTask or market diagnostic replay as reconstruction. A real owner migration across runtime, callbacks, queries and all state mutations plus a complete event protocol is not a local helper fix. If probes confirm this foundational P0 cannot be safely corrected as a focused patch, STOP, report BLOCKED and hand off an ordered bounded P0 plan, per execution directive. No broad rewrite is authorized implicitly by this audit.

Files changed by Pass 1: this report and standards matrix only. No implementation changes. Existing tests unchanged.
