# Candidate release notes

## 0.4.0-preview.1 — UNRELEASED local candidate

Product: Chord. Package: @weipertda/chord (formerly @chord/core). Publication has not been authorized or performed. Namespace choice is maintainer-accepted; authenticated npm permissions must be revalidated before publication.

### Candidate capabilities
- Host-governed admission and dispatch with versioned SigilJS contracts, scoped grants and attempt-bound approvals.
- Private canonical SDK state, detached reads, revision-guarded transitions and coupled committed-state evidence.
- Host-mediated handoffs, scope-filtered context, approval pause/resume/reject, cancellation and snapshot restore.
- Unknown-effect quarantine and host-attested evidence reconciliation before supported re-admission.
- Pure reconstruction from supported modern complete histories without adapter/model execution.

These capabilities were implemented before this packaging continuation. This continuation changes identity, payload and public/legal documentation—not kernel behavior.

### Packaging and licensing
- Maintainer-accepted fallback name @weipertda/chord; update root, /sdk and /platform imports.
- Apache-2.0 first-party license; Antistructured Labs LLC holder wording approved by maintainer. Ownership/provenance is an attestation, not independent legal clearance.
- @weipertda/sigiljs remains pinned to 0.18.0 under MIT, separately installed and not bundled.
- Curated payload includes runtime, two public examples, README, integrity guide and legal notices. Tests, internal audits, editor files and development verifier are repository-only.

### Compatibility and limits
All public APIs are experimental. Detached registry reads replace live mutation; unknown re-admission needs verified reconciliation; incomplete diagnostic logs are not authoritative replay. Hosts must authenticate identities, supply legitimate grants/approvals, verify receipts, manage secrets and persist state. In-memory session restore is not process-crash durability or cross-process coordination. No distributed CAS, universal exactly-once external effects, cryptographic evidence authenticity, hostile-adapter sandbox or stable 1.0 promise.

Contract schema chord.contracts.v1 and existing snapshot/audit/history version identifiers remain unchanged by the npm namespace/version. Legacy/missing histories must not be silently upgraded to invented complete history. See INTEGRITY.md.
