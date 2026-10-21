# 047 — Pass 4: Admission atomicity and read boundaries

Gate: COMPLETE for admission/inspection P0 probes. Shared owner transaction now rolls back spec, grant, queue, revision and event changes together on denial or validation failure. Reentrant grant callbacks cannot install nested changes. Invalid queue fields fail final SigilJS registry validation before installation.

projectContext now uses pure authority evaluation per task with active host principal/actor, exact scope/capability, expiry/revocation and deny precedence. No-grant identities get no protected task/queue data; related artifacts/domains/approvals/events are filtered by authorized tasks. Projection bounded to 100 tasks/20 events. ContextRequest and ContextProjection SigilJS contracts validate request/output. SDK clock is host-controlled, not client-supplied. All SDK inspection/export/query/journal results detached by Pass 2.

New admission-integrity tests: before 3 pass/1 fail, after all 4 pass; combined state/admission/authority/adversarial/continuity 64/0. Logs retained in 047-evidence/. Existing Block 2 denial checks unchanged. No 046 audit/probe edited.

Trusted-host full-registry/event administration remains distinct from actor-scoped projection: do not forward host APIs or principal IDs from unauthenticated callers. IDs do not authenticate themselves. Pure helper exports operate on detached caller data, not canonical owner references.
