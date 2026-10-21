# CHORD — Block 6A Resumption: Final Report & Maintainer Handoff

## Executive summary
**Status: COMPLETE for the local corrective review and verification. Final gate: CONDITIONAL GO for the corrected trusted-host, single-process in-memory preview only. Publication is not authorized.**

Block6B completed the kernel correction; resumed6A revalidated affected audit facts and executed the previously stopped workflow/replay/consumer/adversarial/standards/release gates. Independent replacement-artifact verification found no remaining concrete P0 within the documented scope. Licensing and payload policy remain explicit P1 maintainer decisions before external release.

Original040–046 reports, including historical NO-GO, remain unchanged. Earlier /final artifact also retains its independent NO-GO; only the exact corrected /sealed artifact below receives this conditional disposition. No weakening of original046 probes or publication controls.

## Repository and source identity
- Repository: `/home/d/Workspace/other-projects/chord-v0.3.0`
- Branch: `main`
- Starting/ending HEAD: `ba3e37ea035a2862e06766ed7f90513babf945b0`
- Working tree: pre-existing modified/untracked work plus focused corrections/evidence, uncommitted and unstaged. No false claim that HEAD alone contains later blocks/corrections.
- Actual package: `@chord/core@0.3.0`, unchanged. Proposed `0.4.0-preview.1` remains a future maintainer-controlled release label; no bump/tag/push/publication/commit performed.
- Reproducible input identity: exact retained full package source archive plus64 per-file hashes and known base HEAD. Independent extraction and npm repack equal the retained tarball byte-for-byte.

## Prior guarantees / confirmed findings / corrections
Prior reports overstated whole-run CAS, isolated context, pause enforcement, real approval continuation and authoritative reconstruction.046 independently established the failures.047 corrects them, including private installed owner/CAS, whole-candidate state/event rollback, detached SDK views, run lifecycle enforcement, exact active authority/context filtering, evidence-backed unknown quarantine and versioned complete recorded-state projection.

Additional review defects received before-failing/after-passing tests: executable getter cancellation between claim/effect; clock-revocation snapshot ordering; host operation label/history mismatch; malformed handoff identity metadata; host candidate fabricated journal append. No expectation was changed to bless unsafe behavior. Host administration remains distinguished from actor endpoints, not treated as an untrusted-plugin sandbox.

| Original finding | Current sealed resolution |
|---|---|
| F6A-01 | Example/test no direct canonical resets; public governed workflow |
| F6A-02 | Modern baseline+commit reconstruction with full projected state equality; invalid/incomplete/legacy history explicitly rejected where determinable |
| F6A-03 | Distinct mock principals, active attested human, exact prepared-attempt approval, consumption and zero-effect negative paths |
| F6A-04 | Fresh real tarball installed consumers, same public workflow on Node/Bun, independent public tests |
| F6A-05 | Truthful/exclusive installed CAS, atomic compound state/evidence, detached reads, consistent shared transition invariants and kernel-owned history |
| F6A-06 | Dirty Git state disclosed; retained source archive/manifest and independent exact extracted-source repack verify actual candidate provenance |

## Pass gates
| Resumed pass | Outcome |
|---|---|
| 1 — Reality revalidation | READY/verified against corrected source; original audit preserved |
| 2 — State/atomicity revalidation | READY/verified current owner, contracts, rollback, revisions and aliases |
| 3 — Governed workflow | READY; exact public example and stronger regression assertions pass |
| 4 — Evidence/replay | READY; full declared modern projection, zero effects, corrupt/missing/foreign/unknown tests |
| 5 — Consumer package | READY; actual sealed tarball, fresh installations, runtime/API boundaries and reproducible source proof |
| 6 — Adversarial verification | READY; exact invariant mapping, immutable probes, independent tests and controlled mutations |
| 7 — Architecture/API | READY; JS/ESM/SigilJS, minimal dependency, explicit host/consumer limits and migrations |
| 8 — Independent release gate | CONDITIONAL GO for exact sealed inputs; no remaining demonstrated scoped P0 |
| 9 — Final report | COMPLETE; this handoff |

## Verification results
Categories overlap and are not summed.

| Check | Actual result |
|---|---|
| Original eight-file core selection |126 pass /0 fail |
| New Block6B tests |34 pass /0 fail |
| Whole core |160 pass /0 fail /1371 assertions /14 files |
| Immutable046 safety probes |21 pass /0 fail, separately executed |
| Authority/adversarial |49 pass /0 fail |
| Continuity |7 pass /0 fail |
| Existing+new replay selection |11 pass /0 fail |
| Runtime validation |exit0 |
| Existing fake Via demo |exit0; not governed workflow proof |
| Real npm pack / dry-run |exit0;63 packed files |
| Parent fresh installed workflow |Node26.7.0/Bun1.3.14 both exit0 |
| Independent fresh installed workflow |Node24.18.1/Bun1.3.14 both exit0 |
| Independent public consumer tests |8/8 on each engine, exits0 |
| Independent source/archive equality |64 manifest files, exact paths/current hashes |
| Installed artifact equality |63 installed files equal tarball bytes; lock integrity matches |
| Extracted-source repack |exact artifact SHA-256 match |
| Controlled faulty scratch copies |all3 mutations detected by targeted failures |
| Credential pattern scan |63 packed files, zero known pattern/filename matches; not universal absence proof |

Machine workflow: accepted handoff; human approval required/validated/consumed; snapshot restored; task completed; revision14; builder effects1; protected effects1; negative effects0; trace34events; full pure replay equality true. Count1 proves this execution, not universal exactly-once.

## Canonical state, lifecycle, approval and recovery guarantees
One private single-process owner; complete candidates validate before exact +1 install and corresponding evidence. Same-revision contender cannot also succeed. Failures preserve state/history; ordinary returned data cannot mutate canonical truth. Prepared attempts and import quarantine participate in revision/evidence accounting. Generic host CAS accepts only expectedRevision/nextRegistry and requires unchanged caller history; only kernel captures new events.

Paused/failed/cancelled/completed runs cannot dispatch new work. Host-attested human resume and exact pending-attempt approval protect queued privileged action; consumption and fresh authority/lease/revision checks protect completion. Late results cannot overwrite terminal task or reconciled effect ledger. Snapshot restoration is trusted-host input, not authentication or globally fresh multi-process authority.

Unknown/blocked work cannot silently retry; task/spec ID churn does not evade structural run-local signature quarantine. Explicit attested no-effect evidence enables fresh admission; confirmed completed is not repeated; still unknown remains quarantined; verified compensation changes the separate ledger without executing compensation or reviving a cancelled task. No provider/global semantic idempotency promise.

## Replay and architecture scope
Pure version-aware reconstruction of all serializable canonical state from declared baseline and committed deltas; recursive journal separately returned. Ordered content diff, identity/version/link/prior-value/legality checks; no adapters/models/probabilistic regeneration. Legacy insufficient histories fail. Complete-prefix truncation requires an external expected endpoint; unsigned history is not cryptographic tamper-proof evidence.

Plain JS/ESM/SigilJS, data records and FCIS retained; no runtime dependencies/framework/model-provider/hosted infrastructure added. Full cloning/validation is a bounded auditability tradeoff, not throughput/durability. Host manages authentication/credentials/evidence truth. Low-level exports/full host SDK are privileged, not actor-facing endpoints or sandbox. All APIs experimental; stable none. No distributed CAS/durability, cross-process actor deployment, universal exactly-once, provider acknowledgement protocol, simulation or cryptographic signing claims.

## Artifact handles
Sealed package:
`/home/d/Workspace/other-projects/chord-v0.3.0/docs/internal/048-evidence/artifacts/sealed/chord-core-0.3.0.tgz`

Artifact SHA-256:
`b498bfb82729df17e8be5f0a1f73913d07f2a2ef53a31401bd2fdc8d9af74f18`

Exact source archive:
`/home/d/Workspace/other-projects/chord-v0.3.0/docs/internal/048-evidence/artifacts/sealed/chord-core-source.tar.gz`

Source SHA-256:
`a45940faf07fc31f44d8374b3abcd5295f8642cb9b53a3a7402ca1024d479b45`

Full provenance:048-evidence/artifact-manifest.json. Existing Git ignore rules ignore.tgz; artifacts are deliberately retained/identified but not staged. Historical superseded artifacts remain separately labeled. Independent raw outputs/machine receipts/tests retained under048-evidence/sealed-independent/. Initial scratch foreign-run error-code expectation failure retained; only that overconstrained scratch assertion was corrected to the earlier valid semantic rejection, not product/046 safety expectations.

## Outstanding P0/P1/P2 and recommendation
- **P0:** none demonstrated within this documented corrected preview scope.
- **P1 before external release:** establish licensing/redistribution rights; explicitly accept or curate test/fixture/developer-note payload. No license grant invented. Expanded runtime/load coverage and cloning optimization remain future scoped work, not current guarantees.
- **P2/deferred:** distributed/multiwriter persistence/CAS, hostile plugin sandbox, global semantic dedupe, simulation and signed evidence.

**Recommendation:** maintainer review the corrected source and sealed evidence, decide licensing and payload, then separately authorize controlled release preparation if desired. Any source/package/license/version change invalidates this exact artifact seal and requires regeneration plus affected consumer/provenance checks. A maintainer should approve the source revision before any public version/tag/publication step. This conditional technical gate is not permission to publish.

The requested047 correction report is complete; its exact6A resumption handoff has now been executed. No broader feature phase has begun.
