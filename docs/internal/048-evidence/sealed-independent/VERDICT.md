# Independent sealed replacement-artifact gate

Verdict: CONDITIONAL GO for corrected, trusted-host, single-process in-memory preview only. No remaining P0 demonstrated in this narrow replacement gate. Not publication permission, production certification, licensing clearance, or distributed/exactly-once guarantee. Previous NO-GO applies to superseded /final artifact and remains historical.

Repository: /home/d/Workspace/other-projects/chord-v0.3.0
Retained artifact: docs/internal/048-evidence/artifacts/sealed/chord-core-0.3.0.tgz
SHA256: b498bfb82729df17e8be5f0a1f73913d07f2a2ef53a31401bd2fdc8d9af74f18
Retained source: docs/internal/048-evidence/artifacts/sealed/chord-core-source.tar.gz
Source SHA256: a45940faf07fc31f44d8374b3abcd5295f8642cb9b53a3a7402ca1024d479b45

Verified all 64 manifest source files against extracted archive and current packages/core source, including exact extracted path set. Rechecked current hashes after tests. npm pack from extracted source produced byte-identical retained artifact SHA256. Fresh npm consumer installation used retained /sealed tarball, not old /final. All 63 installed package files match tarball bytes and exact path set; lock integrity matches manifest.

Actual engines: Node v24.18.1, npm 12.0.2, Bun 1.3.14. No Node 26 claim by this reviewer.

Executed source commands, all exit 0:
- bun test: 160 pass, 0 fail, 1371 expect calls (core-sealed.log).
- Selected six integrity files: 34 pass, 0 fail, 339 expect calls (new-6b-sealed.log); subset, not additional unique coverage.
- node --test docs/internal/046-state-probes.mjs: 21 pass, 0 fail (safety-sealed.log).
- bun run src/verify-runtime.js: ALL RUNTIME VALIDATIONS PASSED (runtime-sealed.log).
- bun test tests/authorization.test.js tests/adversarial.test.js: 49 pass, 0 fail, 214 expect calls (authority-sealed.log); subset.

Installed public API workflow, both Node and Bun exit 0: accepted handoff, required/consumed exact-attempt human approval, paused snapshot restore, completed protected task, builder effect 1, protected effect 1, revision 14, 34 trace events, pure replay equal. Workflow copied from installed package example and changed only relative internal import to @chord/core. Logs workflow-node.log and workflow-bun.log.

Prior independent six public tests copied unchanged into fresh consumer and passed both engines. Added two journal regression tests; combined 8/8 pass on Node and Bun, exits 0. Same-run unsupported append: INVALID_HISTORY. Foreign-run append: INVALID_SEMANTICS (RegistryData run correlation fails before owner journal comparison). Both preserve full registry, canonical projection, revision, journal and zero-effect replay. Subsequent legitimate host commit succeeds and remains replay-equivalent. node-combined.log and bun-combined.log are final evidence.

Test-harness issue retained transparently: initial combined runs incorrectly expected INVALID_HISTORY also for foreign-run input. They failed only on observed INVALID_SEMANTICS; scratch test expectation corrected to the earlier valid rejection path after inspecting owner validation ordering. Initial logs retained as node-initial-expectation.log and bun-initial-expectation.log. No product/source edits were made.

Remaining P1 maintainer decisions:
1. No LICENSE file/license field: establish intended license and legal redistribution terms before external release; technical preview result is not legal clearance.
2. Default npm payload includes tests and dev_flow.md: explicitly accept or curate release payload before publication; not a demonstrated in-memory correctness defect.

Scope constraints: privileged host SDK, host-attested identity/evidence, run-local structural dedupe, single-process atomicity, unsigned baseline+commit replay, unsupported legacy history. No actor sandbox, global exactly-once, distributed CAS, provider acknowledgment protocol, or tamper-proof provenance claim.

Evidence directory: /home/d/.hermes/cache/scratch/chord-sealed-independent-gemjso3w
Machine-readable handles: results.json, combined-results.json, source-equality.json, installed-verification.json.
Extracted source: source/source/
Independent repack: repack/chord-core-0.3.0.tgz
Fresh consumer: consumer/
Created files only in scratch; repository and original 046 artifacts untouched. No commit, publication, version change, tagging, or push.
