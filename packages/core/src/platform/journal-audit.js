export function replayRegistryJournal(registry, options = {}) {
  return registry.event_journal
    .slice()
    .sort((a, b) => a.at - b.at)
    .slice(0, options.limit || registry.event_journal.length)
    .map((event, index) => ({
      sequence: index + 1,
      event_id: event.event_id,
      type: event.type,
      at: event.at,
      payload: event.payload
    }));
}

export function createDeterministicAuditReport(registry, options = {}) {
  return {
    audit_type: "chord.audit",
    audit_version: "0.3.0",
    created_at: new Date().toISOString(),
    counts: {
      artifacts: Object.keys(registry.artifacts).length,
      domains: Object.keys(registry.domains).length,
      tasks: Object.keys(registry.tasks).length,
      queued: registry.task_queue.length,
      events: registry.event_journal.length
    },
    artifacts: Object.values(registry.artifacts),
    domains: Object.values(registry.domains),
    tasks: Object.values(registry.tasks),
    queue: registry.task_queue,
    replay: replayRegistryJournal(registry, { limit: options.limit || 100 })
  };
}
