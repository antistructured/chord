import { stableId } from "../utils/id.js";

export function appendRegistryEvent(registry, type, payload = {}, meta = {}) {
  const event = {
    event_id: stableId("evt"),
    type,
    at: Date.now(),
    schema_version: registry.run?.schema_version || null,
    run_id: registry.run?.run_id || null,
    run_revision: registry.run?.revision ?? null,
    actor_id: meta.actor_id || null,
    principal_id: meta.principal_id || null,
    correlation_id: meta.correlation_id || null,
    causation_id: meta.causation_id || null,
    authority_revision: registry.authority?.authority_revision ?? null,
    policy_decision: meta.policy_decision || null,
    payload
  };
  registry.event_journal.push(event);
  return event;
}

export function listRegistryEvents(registry, filters = {}) {
  let out = registry.event_journal || [];
  if (filters.type) out = out.filter(e => e.type === filters.type);
  if (filters.run_id) out = out.filter(e => e.run_id === filters.run_id);
  if (filters.correlation_id) out = out.filter(e => e.correlation_id === filters.correlation_id);
  if (filters.causation_id) out = out.filter(e => e.causation_id === filters.causation_id);
  if (filters.since) out = out.filter(e => e.at >= filters.since);
  if (filters.limit) out = out.slice(-filters.limit);
  return out;
}
