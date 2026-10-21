# 046 — Fresh independent review of Pass 2 stop gate

Separate read-only reviewer context, same model family (gpt-6.1-sol). This is independent checking of the early stop, **not execution of Pass 8** or cross-model certification.

Reviewer inspected the actual SDK owner, registry commit, lifecycle/runtime/evaluator, projections, journal and reducer rather than accepting audit conclusions; reran acceptance probes and reproduced 18 failures / 3 passing controls. Parent separately reproduced unsafe uncertain re-admission: calls=2, statusBefore=uncertain, both attempts uncertain; see unknown-redispatch.log. This diagnostic exit 0 means unsafe behavior reproduced, not safety PASS.

## Findings corroborated
- sdk/chord.js:21,270 and registry/registry.js:44–46: disposable holder success without SDK state installation; two commits report success from one revision.
- runtime-loop.js:44–95 and authorization.js:58–67: no paused/failed run guard; one effect in each test.
- sdk/chord.js:149–171,186–190: partial authority/spec/journal changes before admission rejection.
- handoff.js:26–30,38,69–71 and event-journal.js:23–31: writable scope/event aliases and no-grant data disclosure.
- attempts.js:8–25: reservation writes without revision or event.
- sdk/chord.js:226–248: grant-only re-admission of uncertain work without reconciliation evidence.
- trace-reducer.js:7–27,36–41 and event producers: no task/queue reconstruction and ID-set-only diff; omitted authoritative payloads require producer as well as reducer correction.

## Qualifications retained in final disposition
- 18 failing tests are not 18 independent root causes.
- Combined unknown-type/incompatible-version probe does not isolate both checks; subsequent assertions in task/queue, scope/queue and reservation/revision tests may short-circuit. Additional conclusions are source-derived, not separately executed assertions.
- Reviewer saw an earlier serialized snapshot comparison, which could vary on created_at. Parent corrected it to detached registry deep equality before the final rerun; final result remains 18 failures / 3 passing controls. Current probe: lines 50–54.
- Failed run rejection is not a demonstrated bypass of a real rejected task-bound approval. Existing Block 2 approval enforcement remains passing.
- Raw registry access is explicitly trusted-host, not a hostile plugin sandbox. Read/projection isolation is still missing.
- Dirty source is an artifact reproducibility gap, not inherently a runtime security exploit; no audit commit is authorized or required merely to remove the dirty label.
- No actual installed-tarball workflow was verified.

## Recommendation
NO-GO and stop after Pass 2 are justified. Local isolated fixes cannot satisfy the required canonical ownership, atomic candidate writes, safe unknown recovery and complete history together. Do not patch the example around them or mark diagnostic replay Level B. Resume only the bounded correction sequence in 046-state-atomicity-audit.md, preserving all prior work and acceptance requirements.
