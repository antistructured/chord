# Pass 3 — Package payload curation

Status: READY for documentation. Adopted maintainer-accepted @weipertda/chord; version already 0.4.0-preview.1 at continuation start. Updated manifest name/description/repository/keywords/publishConfig and Bun workspace name. Dependency pin unchanged. No publish command executed. publishConfig is metadata, not authorization.

Allowlist: runtime src/**/*.js excluding development verifier; canonical and forthcoming quickstart examples; README, INTEGRITY, forthcoming CHANGELOG, LICENSE, NOTICE, THIRD_PARTY_NOTICES. Excludes tests/fixtures/dev_flow, internal evidence, node_modules, archives, editor history and old prose-only examples. CLI/demo script dependency files retained. No kernel restructure.

First npm pack --dry-run --json --ignore-scripts: exit 0, 45 entries, 160775 unpacked bytes. This intermediate payload precedes final README/quickstart/changelog, not the final sealed candidate. No bundled dependencies. Metadata lists absent future quickstart/changelog intentionally supplied in next pass before real packing.

Imports: canonical example now imports @weipertda/chord. INTEGRITY package/version reference updated. Historical @chord/core references in sealed audit fixtures/reports remain unchanged; new consumer copies will use chosen package. Snapshot/audit 0.3.0 and chord.contracts.v1 identifiers intentionally untouched. Historical queue comment remains historical, not a public import instruction.

Inspected: manifest/lock, package name/version search, canonical example, INTEGRITY, prior payload proposal, dry-run full list. Files changed: package.json, bun.lock, examples/cross-actor-workflow.mjs, INTEGRITY.md, this report. Tests: dry-run PASS only; behavioral tests scheduled after docs. Blocker: npm auth E401 applies to publication, not accepted local fallback preparation. Next pass READY.
