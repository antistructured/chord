# 049 — Pass 3: Package curation

Status: internal audit/proposal COMPLETE; release curation gate BLOCKED. No allowlist/ignore change applied while public rights remain unresolved. No distributable candidate produced.

Retain runtime JavaScript, public exports and supporting modules, package metadata, README/INTEGRITY, useful canonical public example and approved legal notices. Keep existing CLI/demo modules as script dependencies. Exclude tests/fixtures, dev_flow.md, src/verify-runtime.js and legacy prose-only examples from npm; retain them in repository for regression/audit. Internal040–049 reports/raw evidence/source archives must never enter npm payload. They currently sit outside packages/core and were absent from the inspected tarball.

Existing-artifact known credential/private-key/sensitive-filename scan:63 files, zero matches. This does not prove absence of all secrets and is not clearance for a future0.4 artifact. No node_modules, credentials/private evidence dataset found in current payload. Actual source/header provenance still requires human confirmation.

Once Pass2 is approved: apply reviewed files allowlist, add exact legal artifacts, inspect npm pack contents/count/size, preserve exported module closure/script targets, generate true versioned candidate and fresh consumer proof. Do not rename a0.3 tarball or substitute this simulation for release verification.
