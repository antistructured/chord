# CHORD — Block 6C: Public Preview Release Preparation

## 1. Executive summary
**Status: BLOCKED. Independently reviewed release preparation decision: NO-GO. Publication performed: NO.**

The corrected kernel baseline remains green and unchanged. The maintainer explicitly selected Apache License2.0, but did not answer copyright/redistribution authority or npm namespace authorization before the clarification form timed out. Those are mandatory prerequisites, not non-critical publication conditions. Public-distribution steps stopped. No license/NOTICE, version, payload allowlist, public README change or new release tarball was applied/generated.

Safe work completed: baseline/provenance/package inventory, proposed payload and commit review, internal documentation/release-note drafts, current-source security regressions and independent blocked-release gate. No new kernel defect or reason to restart earlier engineering blocks was demonstrated.

## 2. Previous release gate
048 offered CONDITIONAL GO only for the exact corrected trusted-host single-process in-memory0.3.0 evidence artifact, with licensing and payload decisions still open. It was not publication permission or0.4.0 candidate approval. Block6C explicitly makes legal readiness and new-candidate proof mandatory; previous greens cannot waive them. Historical040–048 reports/seals remain unchanged.

## 3. Corrected current baseline
Repository /home/d/Workspace/other-projects/chord-v0.3.0; branch main; HEAD ba3e37ea035a2862e06766ed7f90513babf945b0. All64 package source files match048 source manifest; retained package/source checksums match. Core160/0, safety21/0 and source/old installed workflow reproduced. No unexplained runtime drift or accidental loss.

Pre-existing .gitignore/.vscode changes, two .history README deletions and uncommitted/untracked correction work were preserved. Those editor/history changes are excluded from proposed release commit review. No whole-tree-clean claim: this block adds only docs/internal/049-* audit/draft/evidence files; prior paths unchanged. No staging/commit/tag/push/publication/checkout/reset performed.

## 4. Licensing and provenance
- Selected: Apache License2.0, explicitly answered by maintainer.
- Applied/approved for redistribution: NO. Holder(s)/authority/contributor/copied/generated/AI-assisted permissions unanswered.
- First-party LICENSE/NOTICE/license metadata/contribution agreement evidence absent. Git records one author/committer identity, not proof of complete rights. Attribution marker absence does not prove originality or automatically license AI-assisted code.
- Dependency: @weipertda/sigiljs0.18.0 MIT, installed LICENSE/notice inspected; registry integrity matches lock. It is not relicensed by Chord's future Apache choice. Actual copied/vendored/external content exceptions still require maintainer disclosure.
- No copyright-holder name or legal clearance invented. See049-license-provenance.md and049-license-decision.md.

## 5. Payload curation
Existing sealed internal0.3.0 payload audited:63 files/291025 unpacked bytes. Complete inventory/classification retained. It includes16 test-only and2 development-only files plus runtime/script support, examples, metadata and docs.

Unapplied allowlist proposal retains42 existing files/146713 existing bytes before approved license/notice additions: src except verify-runtime.js, canonical public example, README/INTEGRITY and required metadata; legal LICENSE/NOTICE pending. CLI/demo support preserved because existing scripts reference it. Tests/fixtures/dev tracker/internal audit/evidence stay repository-only. This is a simulation, not final candidate size or a distributable artifact. Public export imports/static source closure pass in unchanged source; actual curated-candidate consumer remains blocked.

## 6. Public API and compatibility
No API/source/dependency/package semantics changed. All preview trust limits preserved: host-managed identity/receipt truth, single-process/in-memory authority, detached consumer reads, governed CAS/admission/lifecycle, explicit unknown-effect quarantine/reconciliation, pure modern baseline+commit replay, unsigned evidence, trusted in-process adapters and experimental APIs. No distributed CAS/durability/global exactly-once/hostile-plugin sandbox/federation claim added.

Draft positioning uses the requested description and value proposition. Host-delegated scoped grants are distinguished from arbitrary actor redelegation chains. Only actual existing checkout commands are presented as verified; no nonexistent0.4 npm install advertised. See049-public-documentation-review.md.

## 7. Release notes
Internal draft:049-release-notes-draft.md, following existing internal release-report convention. It is explicitly unreleased, not a public CHANGELOG announcement. Root/package README and all sealed inputs remain unchanged while rights/identity are unresolved. After clearance merge approved notes/positioning/legal/identity instructions into public docs and verify against exact candidate.

## 8. Test results
All listed existing-source/private-baseline commands exit0; categories overlap.

| Check | Result |
|---|---|
| Core suite |160 passed /0 failed /1371 assertions |
| Original safety probes |21 passed /0 failed, unchanged |
| Authority/adversarial |49 passed /0 failed |
| Continuity |7 passed /0 failed |
| Replay/fault |11 passed /0 failed |
| Block6B integrity |34 passed /0 failed |
| Runtime verifier |PASS |
| Canonical source example |PASS on Node/Bun |
| Existing sealed0.3.0 full workflow |PASS on Node/Bun |
| Existing public-consumer tests |8/8 on Node and8/8 on Bun |
| Static imports/public exports |PASS for current source |
| New0.4 candidate tests/consumer |NOT RUN: candidate not prepared |

Parent and independent reviewer reproduced source/security baseline. Raw commands/cwd/exits in049-evidence/commands.json and independent-review/. No failing command hidden behind an output pipeline, no counts substituted for a required legal gate.

## 9. Consumer verification
Only existing048 internal0.3.0 installed consumers were rerun. Their public workflow demonstrates authority, human approval consumption, handoff, restore and pure replay with protected effects1/negative effects0. They do not verify an unapplied license/curated/versioned0.4 candidate. No new candidate installation was performed or claimed.

## 10. Artifact identity
**New release-candidate tarball: NOT GENERATED. Candidate SHA-256: NOT APPLICABLE.**

Historical evidence, unchanged and verified, not renamed/rebranded:
-048 sealed/chord-core-0.3.0.tgz: b498bfb82729df17e8be5f0a1f73913d07f2a2ef53a31401bd2fdc8d9af74f18.
-048 sealed/chord-core-source.tar.gz: a45940faf07fc31f44d8374b3abcd5295f8642cb9b53a3a7402ca1024d479b45.

Known credential/private-key/sensitive-filename scan examined63 existing artifact files with zero findings; not comprehensive secret clearance or a future-candidate scan. No new archive was produced while redistribution authority remains blocked.

## 11. Source/version candidate
Actual manifest @chord/core@0.3.0, ESM, SigilJS0.18.0; package/lock unchanged. Proposed0.4.0-preview.1 not prepared. Local tags none; remote tags query succeeded empty. Package and exact target npm lookups returned E404. That does not establish scope control, private package absence or permission to publish. No alternate identity guessed.

Full tracked binary diff, staged diff, tracked/untracked hash inventory and exact proposed correction path list recorded in049-evidence/. Mixed root README hunks require review; unrelated changes excluded. Draft commit message recorded, not executed. Candidate branch/commit not created. No clean current release revision exists merely because old HEAD is known.

## 12. Remaining issues / pass disposition
| Pass | Actual disposition |
|---|---|
| 1 Baseline |COMPLETE; verified existing corrected source/evidence |
| 2 Licensing |BLOCKED; Apache selected, rights/holder clearance absent |
| 3 Package |Internal audit/proposal complete; actual curation/distribution gate BLOCKED |
| 4 Docs |Internal drafts prepared; public candidate docs gate BLOCKED |
| 5 Version/source |Read-only history/registry/proposal captured; candidate NOT PREPARED |
| 6 Consumer/artifact |New candidate NOT EXECUTED under legal gate; old proof explicitly separate |
| 7 Security |Independent bounded baseline PASS; new-candidate clearance BLOCKED |
| 8 Final gate |Independent NO-GO |
| 9 Handoff |COMPLETE as blocked release-preparation report |

Previous technical P0s remain resolved in their tested scope; none reopened/demonstrated here. Mandatory release blockers: rights/provenance approval, authorized namespace/identity, then actual legal/payload/docs/version/source/candidate and fresh consumer gates. The latter are dependent unfinished work, not fabricated independent kernel failures.

## 13. Final decision
**NO-GO.** Not CONDITIONAL READY: mandatory legal and exact-candidate conditions are missing. Successful existing160-test baseline is not a licensed new release candidate. No public-distribution step advanced past missing clearance.

## 14. Maintainer decision packet / exact continuation
Supply:
1. Copyright holder(s), authority to license intended first-party material under selected Apache2.0, relevant contributor/copied/generated/AI-assisted permissions and exceptions/required notices.
2. Authority for npm@chord scope/@chord/core identity, or an explicitly approved controlled alternative, plus confirmation of intended preview version.

Then resume049 Pass2—not Blocks1–6 or a kernel feature phase. Apply approved legal artifacts; perform actual Pass3 allowlist and Pass4 public docs/notes; recheck registry/version and prepare Pass5 exact source/metadata/commit proposal; build the real candidate and perform Pass6 outside-repo public-only consumers/repack/scan; repeat independent Pass7–8. Authorization for commit, Git tag, push, npm dist-tag/publication/public GitHub release remains separate and must name exact source/version/checksum/actions.

```text
CHORD — Block 6C: Public Preview Release Preparation
Status: BLOCKED
Candidate:
  Package: actual @chord/core; namespace approval unresolved
  Version: actual 0.3.0; proposed 0.4.0-preview.1 NOT PREPARED
  License: Apache License 2.0 selected; rights approval pending; NOT APPLIED
  Branch: main
  HEAD: ba3e37ea035a2862e06766ed7f90513babf945b0
  Working tree: pre-existing dirty work preserved; only new049 docs/evidence added
  Source snapshot: prior048 verified; no new licensed candidate snapshot
  Tarball: NOT GENERATED
  SHA-256: N/A for new candidate
Verification:
  Core suite: PASS 160/0 (existing source)
  Safety probes: PASS 21/0 unchanged
  Authority tests: PASS 49/0
  Continuity tests: PASS 7/0
  Replay tests: PASS 11/0
  Runtime verification: PASS
  Canonical example: PASS on available Node/Bun
  Bun consumer: old0.3.0 PASS; new candidate NOT RUN
  Node consumer: old0.3.0 PASS; new candidate NOT RUN
  Package integrity: prior seal verified; new candidate NOT RUN
  Secret scan: old63files/zero known patterns; new candidate NOT RUN
Previous P0 findings:
  Resolved: existing corrected kernel regressions remain green
  Reopened: none demonstrated
Outstanding blockers: legal rights/provenance, namespace approval and dependent candidate preparation/verification
Release gate: NO-GO
Maintainer actions required: confirm rights/holders/exceptions and controlled package identity/version; then resume049 Pass2
Publication performed: NO
```
