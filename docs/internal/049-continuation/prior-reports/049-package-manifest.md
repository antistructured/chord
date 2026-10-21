# 049 — Pass 3: Package manifest audit (proposal only)

Gate: BLOCKED for redistributable payload verification by unresolved Pass2 rights. Existing sealed0.3.0 tarball inspected read-only; no new npm pack/install candidate generated.

Actual existing payload:63 regular files,291025 unpacked bytes. Classification inventory in049-evidence/package-file-classification.json:35 runtime/script-support,7 consumer examples,2 public docs,1 metadata,16 test-only and2 development-only files. Every entry classified programmatically.

Proposed allowlist (NOT APPLIED):
```json
["src", "!src/verify-runtime.js", "examples/cross-actor-workflow.mjs", "README.md", "INTEGRITY.md", "LICENSE", "NOTICE"]
```
package.json is npm-required metadata. NOTICE is conditional on actual provenance/notice obligations; do not fabricate or assume it is mandatory merely because Apache was selected. LICENSE content/holder clearance pending.

That proposal retains42 existing files/146713 current bytes before any approved license/notice additions. These are simulated selections, not measured release artifact size or final payload. Legacy prose example READMEs/test fixtures/dev tracker/internal verification script excluded. Keep CLI/runtime IO/demo support because existing package scripts reference them; dropping them without reviewing metadata would break commands. No API semantics change proposed.

All static relative source imports resolve; root/sdk/platform imports executed successfully. Full proposed-payload runtime resolution cannot be approved until actual licensed candidate is built and installed. No dependencies/publication metadata/version changed.
