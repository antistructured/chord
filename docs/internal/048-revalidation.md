# 048 — Resumed Block 6A: Passes 1–2 revalidation

Gates: READY. Original046 historical reports remain immutable and NO-GO until a fresh release gate below. Block6B corrected the implementation; this resumption records new evidence rather than rewriting history.

Branch main; base HEAD ba3e37ea035a2862e06766ed7f90513babf945b0; dirty pre-existing work plus authorized corrections. Package still0.3.0/SigilJS0.18.0/JS/ESM, no version/tag/publish/push/commit. Full source input identity is now the recorded package source archive + per-file SHA-256 manifest and base HEAD, **not HEAD alone**.

Affected mutation inventory revalidated: every SDK canonical mutation enters the private owner's detached candidate; generic host CAS validates exact request and installed+1/history/transition; runtime claim and result reread same owner across await; import in-flight quarantine is a committed candidate; low-level public plumbing operates only on caller-owned detached state. Scope-filtered context and full admin reads are disconnected from owner; API trust split documented. Events install with state, existing journal/payloads cannot be silently rewritten, prepared attempts participate in revisions. Known unsupported distributed/persistence/sandbox/global semantic claims remain excluded.

Current implementation matrix and tests:047-{canonical-state-commit,lifecycle-dispatch,admission-and-projection,uncertain-reconciliation,replay-and-evidence,invariant-verification,contract-addendum}.md. Revalidation additionally caught malformed object-valued handoff identity crossing generic metadata; closed SigilJS proposal/response/stored handoff/pause contracts plus before-failing regression fixed it. Final core160/0 and immutable probes21/0 required again at independent gate. No accepted security protection weakened.

This is revalidation of the changed factual basis, not rerunning Blocks1–6 or declaring full release readiness.
