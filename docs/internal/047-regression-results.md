# 047 — Pass 7: Regression results

Local execution and independent closure COMPLETE. All results from actual commands, individually captured, no failure-hiding pipelines. Exact cwd/commands/exits: 047-evidence/commands.json; full raw logs retained.

- Baseline core: 126/0, baseline safety probes 3/18 (exit 1).
- Final original eight-file core selection: 126 pass / 0 fail / 1032 assertions.
- Final new six-file Block 6B selection: 34 pass / 0 fail / 339 assertions.
- Final full core: 160 pass / 0 fail / 1371 assertions across 14 files.
- Immutable 046 probes: 21 pass / 0 fail, separate Node command.
- Authority/adversarial: 49/0; continuity: 7/0; existing+new replay selection before final cancellation edge: 11/0.
- Runtime validator: exit 0 with explicit mock no-effect receipt and sound rejection sentinel.
- Canonical workflow: Node and Bun exit 0; real human attempt-bound approval, protected effects=1, builder effects=1, negative effects=0, restored snapshot, replay equivalence=true.
- Existing demo: exit 0, still a direct fake-adapter illustration, NOT governed execution proof.
- Three controlled scratch mutants each fail targeted tests as expected.
- git diff --check: exit 0. Original 046 reports/probes/evidence unchanged by SHA-256 comparison.

Counts overlap and must not be summed. Baseline failures and intermediate failures preserved, not hidden by later greens. Original tests retain eight files/126 test cases: unsafe direct-state fixtures migrated to actual host CAS/clock and receipt-based recovery; duplicate work fixtures use distinct actions; insufficient empty history now explicitly rejected, fake duplicate/backward records replaced with valid versioned fixtures retaining rejection assertions. Canonical test asserts genuine public workflow outcomes, no manual mutation. No skip/delete/security relaxation.

Environment: Bun 1.3.14, Node v26.7.0, npm 12.0.2, Linux x86_64. These are tested local runtimes, not all Bun 1.x or Node 20+ versions. Package/tarball/full consumer release validation remains resumed Block 6A work, not a Block 6B pass claim. No version/tag/commit/push/publication.
