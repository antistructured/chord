# 049 — Pass 1: Release baseline verification

Gate: READY for licensing review; not legal or publication approval.

## Current checkout
Repository /home/d/Workspace/other-projects/chord-v0.3.0; branch main; HEAD ba3e37ea035a2862e06766ed7f90513babf945b0. Working tree is dirty and unstaged. Full tracked/untracked hashes, status, binary diff and cached diff recorded in049-evidence/. No checkout/reset/cleanup/staging/commit/tag/push/publication.

The64 package input files exactly match the048 sealed-source manifest, and the retained sealed tarball SHA-256 is still b498bfb82729df17e8be5f0a1f73913d07f2a2ef53a31401bd2fdc8d9af74f18. Corrected implementation is identified by that source snapshot and base HEAD, not by HEAD alone. Original040–048 reports/sealed artifacts remain untouched.

## Classification of existing work
- Intended correction/release source: packages/core/src, corrective tests and canonical example; exact source hashes match sealed048 evidence, no unexplained kernel drift.
- Intended public/integration documentation: root/package README, INTEGRITY.md, examples/test guide; review/package selection still required.
- Internal/non-redistributable development evidence: docs/internal/040–048, test fixtures, raw logs/source archives/tarballs; preserve in repository, exclude from npm candidate.
- Unrelated pre-existing changes: .gitignore, .vscode/settings.json and two tracked .history README deletions. Preserve; exclude from proposed release commit. Editor-history deletion ownership is not inferred or silently restored. These deletions do not alter runtime inputs.
- Staged work: none. No clean-source commit exists for later blocks/corrections; exact proposed commit contents must be reviewed, not automatically committed.

## Reproduced commands (complete raw exits/logs in049-evidence/commands.json)
- bun test in packages/core: exit0,160 pass/0 fail/1371 assertions.
- node --test docs/internal/046-state-probes.mjs at root: exit0,21 pass/0 fail; unchanged probes.
- bun run src/verify-runtime.js: exit0.
- Canonical source workflow on Node/Bun: both exit0.
- Existing048 sealed-tarball consumer workflow on Node/Bun: both exit0; accepted handoff, human approval consumed, snapshot restored, protected effect1, negative effects0, replay equal. This verifies prior0.3.0 evidence, not a new0.4 candidate.

Package metadata: @chord/core@0.3.0, ESM, only @weipertda/sigiljs0.18.0, matching bun.lock. Actual exports unchanged. Read047-final-report,048-final-report and048-release-go-no-go: previous gate conditional on licensing and payload, not publication approval. No new kernel defect demonstrated.

## Release prerequisites discovered
No first-party LICENSE/NOTICE/rights/contribution policy or package license field. Git history lists one author/committer identity (weipertda); this is not proof of complete copyright/redistribution authority. Actual SigilJS dependency LICENSE is MIT with SigilJS Contributors2026 notice; registry metadata/integrity matches lock.

Read-only remote tags query succeeded with no tags; local tags absent. Public npm query for @chord/core returned E404. This does not prove control of the @chord scope or guaranteed target-version availability. Maintainer identity/scope confirmation and a final registry check are required before preparing publication identity. No rename/version bump inferred.

Next pass: request explicit maintainer license choice, rights/provenance attestation and intended npm scope authority. Do not generate a new externally distributable artifact while unresolved.
