# Pass 5 — Version and source candidate

Candidate identity: @weipertda/chord@0.4.0-preview.1, ESM, Apache-2.0. Version was already present at continuation start; name/license payload choices now documented. No internal contract/snapshot/audit/history version changed. Only dependency remains pinned @weipertda/sigiljs 0.18.0. Bun frozen install verifies workspace lock consistency.

Base Git branch main, HEAD ba3e37ea035a2862e06766ed7f90513babf945b0. Working tree includes extensive prior uncommitted kernel work; HEAD alone is NOT this candidate. Full status/diff summary: source-status.log. No staging/commit/tag/push/publish performed. Existing .gitignore/.vscode/history edits preserved.

Exact source snapshot: artifacts/chord-0.4.0-preview.1-source.tar.gz
SHA-256: 66cc9c4a9f05aa849cfd80343edddeef5ba48a4d7078bafad8d28f5fa19c1282
Input file count: 72; per-file hashes: source-manifest.json. Includes package source/tests/examples/legal/docs/lock plus root README/LICENSE/NOTICE; excludes node_modules and historical evidence. Snapshot is local release-review material, not a Git commit or published artifact.

Runtime source hashes unchanged from continuation baseline; historical reports/evidence unchanged at this pass. Registry exact-version query exit 1; see registry-target.log. A missing version is availability information only, never ownership proof. Npm authentication still E401; maintainer accepted fallback and attested control. Distribution identity is approved for local preparation; authenticated publication gate unresolved.

Tests carried forward: full source suites/examples PASS (Pass 4). Inspected source hashes, manifest/lock, registry result and Git status. Changed: this report, source manifest/archive and command evidence; no implementation changes. Next pass READY for exact tarball creation and external consumer verification.
