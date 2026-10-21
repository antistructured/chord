# 048 — Resumed Block 6A Pass 8: Independent release gate

## Decision
**CONDITIONAL GO — corrected trusted-host, single-process in-memory preview only.** No remaining P0 demonstrated within the documented scope. **Not publication permission**, production certification, legal clearance or a distributed/exactly-once/tamper-proof claim.

This decision applies only to the SEALED artifact SHA-256 `b498bfb82729df17e8be5f0a1f73913d07f2a2ef53a31401bd2fdc8d9af74f18` and source archive SHA-256 `a45940faf07fc31f44d8374b3abcd5295f8642cb9b53a3a7402ca1024d479b45`. Historical046 NO-GO and the later prior review NO-GO remain correct for their earlier implementations/artifacts; they are not rewritten. This fresh gate supersedes their technical disposition only for these exact corrected inputs, subject to P1 conditions below.

## Independent proof, read back and verified by parent
Separate same-model reviewer used fresh source extraction and a fresh npm tarball consumer, not report claims. All64 source manifest files matched retained archive and current package, with identical path set. Repacking the extracted archive produced byte-identical artifact SHA. All63 installed files matched tarball bytes and lock integrity matched npm manifest. Parent independently rehashed retained artifact/source and reviewer repack and checked source drift (none).

Exact installed canonical example, installed package example and repository example hashes match; despite one reviewer prose line describing an import replacement, parent byte verification establishes it was a no-op. The workflow already imports @chord/core publicly; no internal import workaround was introduced.

Current-source core160/0,1371 assertions; immutable046 probes21/0; new integrity34/0 and authority49/0; runtime validation exit0. Both Node24.18.1 and Bun1.3.14 independently ran exact installed workflow and combined eight independently authored public tests, exits0. Parent also verified Node26.7.0/Bun1.3.14 installed workflow. No extrapolation to untested versions.

Canonical output: separate builder/reviewer/human IDs, accepted handoff, genuine host-attested attempt-bound approval consumed, snapshot restored, protected effect1 in this execution, builder effect1, negative effects0, terminal task completed, revision14, trace34events and full pure projection equality. No claim of universal exactly-once from that single execution count.

New consumer regressions verify both same-run unsupported and foreign caller-added journals reject, preserving full state/projection/revision/journal and replay; subsequent valid CAS succeeds. Unknown work remains quarantined through ID churn and restore, no-effect evidence enables explicit fresh admission, zero-effect negative approvals and no-grant reads, stale CAS/partial denial and late-cancellation protection tested.

## Original findings disposition
| Finding | Current sealed disposition |
|---|---|
| F6A-01 | FIXED: canonical example/test use only public governed operations; no canonical reset |
| F6A-02 | FIXED for declared modern baseline+committed serializable scope; pure reconstruction matches; insufficient legacy/missing history rejects; journal injection consistency fixed |
| F6A-03 | FIXED: active attested human, exact attempt approval and consumption, missing/wrong/service/reused/expired negative cases have direct tests |
| F6A-04 | VERIFIED: fresh actual tarball installed, full identical public workflow, independent public tests on both engines |
| F6A-05 | FIXED within single-process owner: actual CAS installation/exclusivity, detached reads, atomic candidate/event boundaries, consistent install/replay operation and immutable kernel-owned history |
| F6A-06 | VERIFIED local reproducibility: explicitly dirty Git base plus exact full source archive/manifest; independent archive extraction/repack identical; no false claim HEAD alone contains corrections |

## Conditions before external release (P1 maintainer decisions)
1. Establish intended license/redistribution rights; no LICENSE or license field exists. Agent grants no rights.
2. Explicitly accept or curate the default payload containing tests, fixtures and developer notes. Pattern scan63files/zero known matches is not universal secret clearance.
3. Publication itself still requires separate explicit maintainer authorization and approved source/version/tag preparation. No version/tag/push/publish/commit was performed here.

No outstanding known kernel P0; unknown future defects not ruled out. Do not silently treat conditional preview readiness as unrestricted release readiness. If source/package changes for licensing/payload/version preparation, regenerate artifact digest and repeat affected installed-consumer/provenance checks before publishing.

## Limits and evidence
Host-managed authenticated identity and evidence truth; raw host SDK/full inspection/low-level plumb not actor endpoints; no adapter sandbox. In-memory single-process CAS only; no cross-process durability/CAS or global semantic idempotency. Modern recorded-state replay only; no simulation, model rerun, provider acknowledgement protocol, cryptographic signatures or completeness proof for a trace ending at an earlier valid commit without expected endpoint.

Durable evidence:048-evidence/sealed-independent/{VERDICT.md,results.json,combined-results.json,source-equality.json,installed-verification.json,*logs}; artifact-manifest.json; retained sealed tarball/source archive. Original reviewer scratch: `/home/d/.hermes/cache/scratch/chord-sealed-independent-gemjso3w`. Initial scratch test overconstrained a foreign-run rejection code and failed; corrected only that scratch expectation after verifying earlier RegistryData INVALID_SEMANTICS. Full unchanged-state/effect/replay assertions remained, product/046 probes were not weakened. Initial failure logs retained.
