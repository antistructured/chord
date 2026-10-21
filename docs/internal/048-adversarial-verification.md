# 048 — Resumed Block 6A Pass 6: Adversarial/invariant verification

Gate: READY subject to independent Pass8. The exact INV01–18 behavioral mapping in047-invariant-verification.md remains current; contract addendum adds malformed handoff rejection with unchanged canonical state. Original126 tests retained; new34 tests; whole160/0, immutable046 probes21/0; security49/0. Categories overlap.

Eight seeded operation sequences verify reconstruction/stale rejection at each commit; wrong actor, revoked/foreign/wrong/consumed approvals, duplicate/malformed/foreign results and clock/getter callback timing covered. Three controlled scratch mutants demonstrated tests fail when actual installation, lifecycle guard or content comparison is removed. No altered046 probes or weakened security to turn green.

Separate same-model source reviewers found and independently rechecked callback-ordering, cancel/history and host operation consistency fixes. This is not different-model certification. A fresh independent release review is required against final artifact/source rather than inheriting correction verdicts. Raw commands/exits in047/048 evidence; no pipeline truncation used to hide failures.
