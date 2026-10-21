# Block 6C continuation — Pass 8 independent release-preparation gate

## Decision

- **LOCAL CANDIDATE: GO**, solely for local developer evaluation of the exact experimental, trusted-host candidate below. Technical preparation and bounded review criteria pass; this is not production approval or a security certification.
- **PUBLICATION: BLOCKED.** Authenticated npm identity/scope authority remains **UNVERIFIED (recorded E401)** and explicit publication authorization is absent. Neither maintainer acceptance, an unavailable package version, `publishConfig.access: public`, nor this GO supplies permission to publish.
- **Verified namespace decision: CONDITIONAL / incomplete.** `@weipertda/chord` is explicitly maintainer-accepted for local preparation; authenticated registry control has not been established. The user's requested verified namespace criterion is therefore **UNMET for public release**, not silently waived by fallback acceptance.

This independent decision follows the parent Pass 7 checkpoint supplied in the delegation and the on-disk independent Pass 7 review. Pass 8 does not perform Pass 9 or update the final report.

## Exact scope and identity

| Field | Independently checked value |
|---|---|
| Package | `@weipertda/chord@0.4.0-preview.1` |
| npm artifact | `artifacts/weipertda-chord-0.4.0-preview.1.tgz` |
| Artifact SHA-256 | `538987e90ecbaf7b2393d40d11b5cb95dfdee28c25c0a45e743f15526cd5dc9c` |
| Payload | 47 regular files; 49,050 packed bytes; 177,046 unpacked bytes |
| Source archive | `artifacts/chord-0.4.0-preview.1-source.tar.gz` |
| Source SHA-256 | `66cc9c4a9f05aa849cfd80343edddeef5ba48a4d7078bafad8d28f5fa19c1282` |
| Source inventory | 72 entries, all archive/manifest/current-file hashes equal |
| Checkout | `main`, HEAD `ba3e37ea035a2862e06766ed7f90513babf945b0` |

The checkout has extensive existing uncommitted implementation. HEAD is **not** a reproducible identifier for this candidate; use the exact archives and manifests. Version 0.4.0-preview.1 was already present at continuation start. No version or persisted schema change was made here.

All evidence links below are relative to this directory unless stated otherwise. Fresh checks are recorded in [verification.json](independent-gate/verification.json); the machine decision is [decision.json](independent-gate/decision.json).

## Mandatory criteria and disposition

| Criterion | Disposition | Concrete evidence and scope |
|---|---|---|
| Accepted package identity | PASS for local preparation | `license-and-namespace.md:5–7`, `package-curation.md:3`; explicit fallback acceptance supplied by maintainer, current manifest agrees. Not authenticated ownership. |
| Authenticated namespace/publishing authority | **UNMET; publication blocker** | `license-and-namespace.md:7`, `artifact-integrity.json:16–18`; recorded npm whoami/org checks E401. No authenticated success exists in reviewed evidence. Pass 8 did not log in, read credentials or retry these commands. Raw E401 command logs were not located in the evidence tree; the E401 fact is carried from the prior report/context, not claimed as a fresh execution. |
| Publication authorization | **ABSENT; publication blocker** | Supplied task explicitly forbids publication; `artifact-integrity.json:18` is false. Preparation is not permission. |
| First-party licensing/holder decision | PASS on attestation, **not legal clearance** | `license-and-namespace.md:5,9,13`; current manifest says Apache-2.0. Root and shipped LICENSE bytes agree with documented official-text SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`. Root and shipped NOTICE agree and use approved `Antistructured Labs LLC`. |
| Dependency attribution | PASS bounded check | Installed SigilJS manifest is MIT/0.18.0; its LICENSE text is retained in shipped THIRD_PARTY_NOTICES. Only declared runtime dependency is exact `@weipertda/sigiljs: 0.18.0`; it is not bundled or relicensed. See `independent-security/dependencies.log`, `dependency-package.json`, `consumer-lock.json`. |
| Exact source binding | PASS, fresh hash verification | `source-manifest.json`, source archive and current files agree for all 72 entries. This binds the reviewed source/tests/docs/lock to current bytes, rather than relying on Git HEAD. |
| Exact payload/curation | PASS, fresh verification | All 47 tar members match `payload-manifest.json`, current package files and Pass 7 installed consumer. Unique regular paths under `package/`, no traversal, links or set-ID modes. Allowlist contains runtime JS, two examples, manifest and public/legal documents; no tests, internal evidence, node_modules or verifier. |
| Manifest/import surface | PASS | Current manifest exports root/sdk/platform and each target is shipped. No install/prepare/pack/publish lifecycle hooks, bundled dependency or global CLI bin. Raw `independent-security/exports-{node,bun}.log` confirms public imports and rejected deep import. Export maps are API curation, not sandboxing. |
| Repack integrity | PASS, **fresh execution** | Ran `npm pack --ignore-scripts --json --pack-destination <new scratch>` from Pass 7's independently installed package. Exit 0; resulting bytes equal the exact candidate, not merely equivalent file lists. Command/path/hash in `independent-gate/verification.json`, raw output in `independent-gate/repack.log`. |
| Source regression/safety baseline | PASS, carried verified raw evidence | `core.log`: 160 pass / 0 fail, 1,371 assertions; `safety.log`: 21 pass / 0 fail. Command exits in `commands.json` and `additional-commands.json` are 0. `npm test` invokes Bun, not a separate Node kernel suite. No behavioral suite was rerun in Pass 8. |
| External installed consumer | PASS, carried verified raw evidence plus fresh installed-byte comparison | `consumer-node.log`, `consumer-bun.log`: 8/0 each; independent `independent-security/tests-node.log`, `tests-bun.log`: 8/0 each, with individual exit 0 in respective command manifests. Pass 7 consumer is outside the repo, is not a workspace symlink, and its entire installed file set still matches the artifact. |
| README/examples and documentation boundaries | PASS | Fresh README comparison differs only in relative links; shipped README JavaScript equals quickstart bytes; shipped Markdown relative links resolve. Independent README/quickstart logs pass on Node/Bun; canonical logs show consumed approval, snapshot restore, one protected effect, zero denied effects and verified replay. README and INTEGRITY explicitly label unpublished/experimental/trusted-host limitations and deferred distributed features. |
| Independent security/artifact review | PASS bounded review | `independent-security-review.md`, `independent-security/result.json`, raw command/log evidence; no substantive candidate defect reproduced. This is not exhaustive dependency vulnerability analysis or universal secret clearance. |
| Preservation | PASS | `independent-gate/preservation.json` compares preexisting package/internal evidence/root document contents before/after this pass. Only this new report and independent-gate evidence are authorized repo writes. |

## Legal and technical qualifications

Maintainer statements of sole ownership, no outside contributors, AI-assisted development under their direction, and approved holder wording remain **attestations**. The initial imported baseline's originality/chain of title, patent/trademark clearance and legal sufficiency are not independently established. No legal opinion is manufactured. No known incompatible dependency was identified by the bounded review; that is not proof that all distribution rights are clear. Newly discovered external material requires review and preservation of applicable notices before distribution.

The candidate is suitable for bounded local evaluation, not unqualified production use: in-memory single-process state, trusted host authentication/grants/approvals/adapters, no distributed durability, no universal exactly-once effects, no universal secret redaction, and no cryptographically authenticated history. Verified runtime coverage is Node 24.18.1 and Bun 1.3.14; other versions are not certified.

Nonblocking documentation debt from Pass 7 remains: `packages/core/src/platform/handoff.js:9` says “(no secrets)”; controlling README/INTEGRITY explicitly deny automatic content redaction. Do not elevate that comment into a guarantee. The earlier Bun export harness failure is retained in `exports-bun.log`; corrected and independent probes demonstrate rejection (`ERR_MODULE_NOT_FOUND` versus Node's `ERR_PACKAGE_PATH_NOT_EXPORTED`), not a package defect. No candidate edits were made to conceal either item.

## Public-release exit criteria

Before reconsidering publication, the maintainer must obtain successful authenticated identity and scope/package publishing-authority evidence for **the accepted `@weipertda/chord` target**, and explicitly authorize the exact artifact/version and intended release action. Preferred-scope failures do not prove fallback control. A package-not-found response proves neither ownership nor permission. Keep provenance qualifications visible; resolve any newly identified external-material/legal issue before distribution. Revalidate the exact artifact and affected checks if any bytes or dependencies change. This report neither initiates those actions nor authorizes tag/push/commit/publish.

## Files inspected, changes and next-pass readiness

Read all six requested continuation reports, artifact/source/payload manifests, command exit records, source/safety/public-consumer logs, independent security harness/results/raw consumer logs, current manifest, root/package README, INTEGRITY and legal notices; inspected archive and installed package bytes. Evidence-input hashes are retained in `independent-gate/evidence-hashes.json`.

Created only this report and new `independent-gate/` evidence (decision, verification, raw repack output, evidence hashes and preservation). Fresh repack output lives under `/home/d/.hermes/cache/scratch/`. No candidate/kernel/public docs, sealed reports or evidence were modified; no install, publish, tag, push or commit was performed. No new technical blocker was encountered. **Ready for Pass 9's bounded local-candidate handoff; not ready for public release.**
