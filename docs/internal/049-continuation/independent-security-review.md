# Block 6C continuation — Pass 7 independent security/artifact review

## Verdict: PASS — bounded local candidate review only

No substantive release-candidate defect was reproduced in this review. This is **not** publication authorization, legal clearance, security certification, production approval or Pass 8. Parent must emit its Pass 7 report before any Pass 8 work.

### Exact reviewed identity

- Package: `@weipertda/chord@0.4.0-preview.1` (ES modules; Apache-2.0).
- Artifact: `artifacts/weipertda-chord-0.4.0-preview.1.tgz` relative to this report.
- SHA-256: `538987e90ecbaf7b2393d40d11b5cb95dfdee28c25c0a45e743f15526cd5dc9c`.
- Independently counted: **47 regular files**, **49,050 packed bytes**, **177,046 unpacked bytes**.
- Source archive: `artifacts/chord-0.4.0-preview.1-source.tar.gz`; SHA-256 `66cc9c4a9f05aa849cfd80343edddeef5ba48a4d7078bafad8d28f5fa19c1282`. All **72** archive entries match current source bytes.
- Observed HEAD: `ba3e37ea035a2862e06766ed7f90513babf945b0`. The tree contains preexisting uncommitted implementation; HEAD is not the candidate identity.

## Independent execution and payload results

Fresh consumer: `/home/d/.hermes/cache/scratch/chord049-independent-security-1nvszb3z`. Installed a copied exact tarball with `npm install ./weipertda-chord-0.4.0-preview.1.tgz --ignore-scripts --no-audit --no-fund`, outside the repository and prior consumer. No workspace link or prior installation substituted. Observed Node **24.18.1**, Bun **1.3.14**, npm **12.0.2**.

| Check | Result |
|---|---|
| Tar structure | PASS: unique regular files under `package/`; no traversal entries, links or set-ID modes |
| Payload allowlist | PASS: runtime JS, manifest, two examples and declared public/legal documents only; no tests, internal evidence, node_modules or development verifier |
| Current source / installed bytes | PASS: all 47 payload files equal source and installed files; installed file set exact |
| Install/dependency tree | PASS: candidate plus exact `@weipertda/sigiljs@0.18.0`; no other dependency in installed tree |
| Manifest execution surface | PASS: no install/prepare/publish lifecycle hooks, bundled dependency or global CLI bin |
| Public-only adversarial tests | Node **8 pass / 0 fail**; Bun **8 pass / 0 fail** |
| Public entrypoints | Root, `/sdk`, `/platform` import on both runtimes; prohibited package deep import rejects |
| Shipped quickstart | PASS on both runtimes; one mock adapter call |
| Shipped canonical example | PASS on both runtimes; accepted handoff, required/validated/consumed approval, restored snapshot, completed task, one protected dispatch, zero negative effects, verified replay |
| README JavaScript | Exact shipped quickstart bytes; copied consumer script runs on both runtimes |
| Installed repack | PASS: byte-identical SHA-256 to reviewed tarball |
| Credential literal scan | No matches for tested private-key/AWS/npm/GitHub token patterns; not universal secret detection |
| Preservation | Before/after content hashes show no changes to preexisting package, public root documents or internal reports/evidence |

Tests were independently rerun from copied continuation fixtures, not newly invented coverage or a claim to rerun the entire kernel suite. They exercise exact-attempt human approval/denials, detached reads, no-grant projection, revision CAS, atomic rejected admission, in-flight cancellation, unknown-effect quarantine across ID churn and restore, host reconciliation, pure replay rejection and caller-journal rejection. The earlier reported 160-test kernel baseline was not rerun in this pass.

Deep import errors were `ERR_PACKAGE_PATH_NOT_EXPORTED` on Node and `ERR_MODULE_NOT_FOUND` on Bun. Both are successful rejection results; no Node-only error-code assumption was used. This independently clarifies the prior Pass 6 prose naming `MODULE_NOT_FOUND`; no package defect follows from that reporting discrepancy.

## Source and README security claim review

Read the five continuation preparation/consumer reports and artifact-integrity record, root/package README, manifest, INTEGRITY and notices. Inspected relevant current SDK, state owner, authority evaluator, context/handoff, runtime dispatch and trace reducer implementation and public test fixtures. This was a focused review of the candidate boundary, not an exhaustive audit of every line or dependency.

- `src/registry/owner.js` prepares detached state, rejects reentry/async commits and stale revisions, couples history and installs via CAS. `src/sdk/chord.js` keeps the owner private and returns detached reads. These support the README's single-process state boundary, not distributed/crash atomicity.
- Authority evaluation matches actor/principal/capability/exact task scope, lets active explicit deny win and checks approval/attempt binding. Runtime checks dispatch and result authority and quarantines uncertain outcomes. Tests support the bounded claims; host-provided authentication, clock, approval truth and adapters remain trusted.
- Context projection uses authority checks and bounded task/event views. Handoff identity arguments are host administration, not an independently authenticated RPC interface. Root/package README and INTEGRITY explicitly say so.
- The shipped `src/platform/handoff.js:9` comment still says “(no secrets)”. **Nonblocking documentation debt:** the implementation filters authorized records, not arbitrary embedded content. The controlling README/INTEGRITY explicitly deny universal redaction and warn against task secrets/full-host-view exposure. Do not quote that terse source comment as a security guarantee. No runtime or public document was changed.
- Reducer validates baseline/commit linkage, changes, versions and transitions without adapter invocation. README correctly distinguishes reconstruction from execution and discloses valid-prefix truncation, unsigned evidence, missing-history rejection and lack of external receipt truth.
- Root and package README explicitly describe a local unpublished experimental candidate, local-tarball installation, trusted-host single-process/in-memory scope and no stable API promise. Federation/durable storage are labeled roadmap. No registry availability, universal exactly-once, sandboxing, cryptographic authenticity or independent legal clearance is claimed.
- Low-level exports and physically present implementation JS are not a sandbox. Export-map rejection is package API curation, not protection against arbitrary code with filesystem/process access.

## License, provenance and residual blockers

1. **Publication remains NOT AUTHORIZED.** This pass performed no publish/tag/push/commit and did not initiate Pass 8. Existing npm identity/scope checks returned E401; authenticated authority has not been independently established or rechecked here. Maintainer acceptance and attested control of fallback `@weipertda/chord` support local preparation only, not authenticated registry permission.
2. First-party Apache-2.0 text is present and has SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`, matching the documented official text and root LICENSE. NOTICE contains approved `Antistructured Labs LLC` holder wording. This checks supplied bytes/consistency, not copyright title.
3. Independently installed SigilJS manifest reports MIT/0.18.0, and its LICENSE text is retained in THIRD_PARTY_NOTICES. It is separately installed, not bundled or relicensed. No incompatible license was identified in this bounded dependency review; no comprehensive vulnerability or transitive supply-chain audit was performed.
4. Sole ownership, no outside contributors and AI-assisted development remain **maintainer attestations**. The imported baseline's chain of title, originality, patent/trademark rights and legal sufficiency are not independently established. No legal opinion or clearance is supplied; newly discovered external material requires review and notice preservation.
5. Experimental trusted-host limitations remain: no distributed durability/CAS, no universal exactly-once effects, no hostile adapter sandbox, no independent receipt/human identity verification, no universal content redaction and no cryptographic history authenticity. Only the listed runtimes/tests were exercised.

## Evidence and changes

New report: `independent-security-review.md`. New raw evidence directory: `independent-security/` only. It includes `verify.py`, command/cwd/exit records (`commands.json`), individual raw logs, copied public-only fixtures, environment/status, pre-review content hashes, exact per-file payload hashes/results (`result.json`), source comparison, installed dependency manifest and consumer lock. Two explicit non-null guards were added to the review harness after execution to satisfy optional-value static diagnostics; package code was untouched.

The harness and supplementary source comparison completed successfully. No test/install failure or substantive reproduction requiring a package fix was encountered. Historical 040–048, 049-evidence, prior reports, runtime source, package metadata and public docs were preserved. No release action was taken.
