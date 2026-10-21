import { deepClone } from "../utils/clone.js";
import { ContextRequest, ContextProjection, HandoffProposal, HandoffResponse } from "../contracts/sigils.js";
import { authorityError, evaluateAuthority } from "./authorization.js";
import { stableId } from "../utils/id.js";
import { appendRegistryEvent } from "./event-journal.js";

function safeStr(v) { return typeof v === "string" ? v : null; }

/** Project a bounded, policy-filtered context packet for an actor (no secrets).
 * Includes only data authorized by the actor's identity/scope and grants.
 */
export function projectContext(registry, options = {}) {
  const { actor_id, principal_id, correlation_id = null } = ContextRequest.assert(options);
  const now = options.now ?? Date.now();
  const authority = registry.authority;
  const visible = Object.values(registry.tasks).filter(task => {
    const decision = evaluateAuthority({ stage: "admit", now, run: registry.run,
      task: { ...task, status: "queued", authority_binding: { ...task.authority_binding, actor_id, principal_id } }, authority });
    return decision.allowed;
  }).slice(0, 100);
  const ids = new Set(visible.map(t => t.task_id));
  const grants = (authority?.grants || []).filter(g => ids.has(g.scope.task_id) && g.actor_id === actor_id && g.principal_id === principal_id && g.effect === "allow" && g.revoked_at === null && g.issued_at <= now && now < g.expires_at);
  const artifacts = new Set(visible.map(t => t.inputs?.artifact).filter(Boolean));
  const domains = new Set(visible.flatMap(t => Object.keys(t.inputs?.spec?.state || {})));
  const projection = {
    schema_version: registry.run.schema_version, projection_version: "1.0", run_id: registry.run.run_id,
    run_state: registry.run.state || "unknown", run_revision: registry.run.revision,
    actor_id, principal_id, correlation_id,
    authorized_scopes: grants.map(g => ({ grant_id: g.grant_id, capability: g.capability, effect: g.effect, scope: g.scope })),
    tasks: visible.map(t => ({ task_id: t.task_id, status: t.status, target_entity: t.target_entity, project: t.project, phase: t.phase, task_revision: t.task_revision ?? 0, queue_id: registry.task_queue.find(q => q.task_id === t.task_id)?.queue_id || null, created_at: t.created_at, retry_count: t.retry_count })),
    queue_summary: registry.task_queue.filter(q => ids.has(q.task_id)).map(q => ({ queue_id: q.queue_id, task_id: q.task_id, status: q.status, target_entity: q.target_entity })),
    artifacts: Object.values(registry.artifacts).filter(a => artifacts.has(a.name)),
    domains: Object.values(registry.domains).filter(d => domains.has(d.name)),
    pending_approvals: (authority?.approvals || []).filter(a => ids.has(a.task_id) && a.actor_id === actor_id && a.principal_id === principal_id && a.revoked_at === null && a.issued_at <= now && now < a.expires_at && a.consumed_by_attempt_id === null).map(a => ({ approval_id: a.approval_id, task_id: a.task_id, expires_at: a.expires_at })),
    recent_events: registry.event_journal.filter(e => ids.has(e.payload?.task_id)).slice(-20).map(e => ({ event_id: e.event_id, type: e.type, at: e.at })),
    handoff_expectations: [], constraints: [], trusted_decisions: [],
    provenance: { generated_at: now, authority_revision: authority?.authority_revision ?? 0 }
  };
  return ContextProjection.assert(projection);
}

/** Propose a handoff between actors */
export function proposeHandoff(registry, proposal = {}) {
  proposal = HandoffProposal.assert(proposal);
  if (!registry) throw authorityError("INVALID_CONTEXT");
  const {
    from_actor_id, to_actor_id, correlation_id = null, causation_id = null,
    expectedRevision, payload = {}, expires_at = null
  } = proposal;
  if (!from_actor_id || !to_actor_id) throw authorityError("INVALID_CONTEXT");
  if (expectedRevision !== undefined && expectedRevision !== registry.run.revision) throw authorityError("STALE_REVISION");
  
  const handoff = {
    handoff_id: stableId("handoff"),
    run_id: registry.run.run_id,
    from_actor_id,
    to_actor_id,
    correlation_id,
    causation_id,
    expected_revision: expectedRevision !== undefined ? expectedRevision : registry.run.revision,
    payload: deepClone(payload),
    expires_at,
    status: "proposed",
    created_at: Date.now()
  };
  registry.handoffs ||= {};
  registry.handoffs[handoff.handoff_id] = handoff;
  registry.run.revision += 1;
  if (correlation_id) registry.run.correlation_id = correlation_id;
  if (causation_id) registry.run.causation_id = causation_id;
  appendRegistryEvent(registry, "handoff_proposed", { handoff_id: handoff.handoff_id, from_actor_id, to_actor_id });
  return deepClone(handoff);
}

/** Accept or reject a handoff proposal (with CAS) */
export function respondToHandoff(registry, options = {}) {
  const { handoff_id, actor_id, action, expectedRevision, correlation_id = null, causation_id = null, reason = null } = HandoffResponse.assert(options);
  if (!registry || !handoff_id || !actor_id || !action) throw authorityError("INVALID_CONTEXT");
  if (!["accept", "reject"].includes(action)) throw authorityError("INVALID_CONTEXT");
  if (expectedRevision !== undefined && expectedRevision !== registry.run.revision) throw authorityError("STALE_REVISION");
  
  registry.handoffs ||= {};
  const handoff = registry.handoffs[handoff_id];
  if (!handoff) throw authorityError("INVALID_CONTEXT");
  if (handoff.status !== "proposed") throw authorityError("INVALID_TRANSITION");
  if (handoff.to_actor_id !== actor_id) throw authorityError("FORBIDDEN");
  const now = Date.now();
  if (handoff.expires_at !== null && handoff.expires_at < now) throw authorityError("EXPIRED");
  
  handoff.status = action === "accept" ? "accepted" : "rejected";
  handoff.responded_at = now;
  handoff.responded_by = actor_id;
  handoff.reason = reason ? String(reason).slice(0, 64) : null;
  if (correlation_id) registry.run.correlation_id = correlation_id;
  if (causation_id) registry.run.causation_id = causation_id;
  registry.run.revision += 1;
  appendRegistryEvent(registry, "handoff_" + action + "ed", { handoff_id, actor_id, correlation_id, causation_id });
  return deepClone(handoff);
}
