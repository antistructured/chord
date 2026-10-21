# 047 — Pass 8: Standards conformance

Gate: COMPLETE for the corrected kernel; release approval remains separate.

| Paradigm | Implementation evidence / boundary |
|---|---|
| Plain JavaScript / ESM | First-party src .js only, manifest type=module; ARCH-18 test enforces import/dependency allowlist. No TS/compiler introduced. |
| SigilJS spine | Existing exact contracts retained; added host CAS/context/history/operation/reconciliation contracts and persisted cross-record consistency. Patch envelopes hold plain JSON, then reconstructed canonical data is validated; no competing schema dependency. |
| FCIS / explicit effects | Pure authority evaluation, state deltas, shared transition invariants, history reduction/diff; imperative owner/clock/adapter shell controls dispatch. Callable and frozen inputs prepared under guard before claim publication. |
| Data orientation / ownership | Plain records, one private owner, detached reads, validated candidate install, exact +1 in-process CAS. No classes/framework/provider dependency. |
| Immutable-first / structural sharing | No retained mutable consumer aliases. Full candidate cloning chosen for auditable bounded whole-run rollback; structural sharing optimization deferred. O(state+history) copy/validation cost and contract limits documented; not a throughput/durability claim. |
| Authority boundaries | Host authenticates/attests identities/grants/approval/receipt references. Roles and model text confer no permission. Current context validates host clock before snapshot and exact active task grants/denies. |
| Coordination kernel | Preserves intent/task/run/attempt identity, scoped context, handoffs, human governance, revision-aware continuation, effects/quarantine and committed evidence. Canonical example uses distinct mock principals in one host; no cross-process deployment claim. |
| Framework composability | Public root/sdk/platform paths preserved; thin host adapter installation, no copied internal runtime needed. PotentiaJS/Runvia/model/cloud vendors not required. |
| Portability | Core JS/ESM and explicit host seam. Verified Bun1.3.14/Node26.7.0; no extrapolation to all engines. Demo Node stdlib is not a runtime vendor dependency. |
| Replay claims | Versioned modern baseline+commits reconstruct declared serializable projection with zero effects; legacy insufficient histories reject, end-truncated complete prefixes need external endpoint. Not simulation, signature or universal history proof. |

Public docs updated: root README, package README, INTEGRITY.md, recovery example README and test guide; historical dev tracker explicitly annotated rather than erased. No 040–046 historical audit rewritten. Existing direct Via fake adapter demo is accurately distinguished from the governed canonical proof.

Known limits: single-process in-memory atomicity only; host-managed identity/credentials/evidence; unsigned potentially sensitive trace data; no universal exactly-once/global semantic dedupe, persistence, sandbox or distributed CAS. Package file whitelist/license decision remains maintainer packaging work, not permission to grant a license or publish. Full external tarball validation belongs to resumed 6A.
