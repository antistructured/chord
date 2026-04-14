import { deepClone } from "../utils/clone.js";

export function exportRegistry(registry) {
  return {
    snapshot_type: "chord.registry",
    snapshot_version: "0.3.0",
    created_at: new Date().toISOString(),
    counts: {
      artifacts: Object.keys(registry.artifacts).length,
      domains: Object.keys(registry.domains).length,
      tasks: Object.keys(registry.tasks).length,
      queued_tasks: registry.task_queue.length,
      journal_events: registry.event_journal.length
    },
    registry: deepClone(registry)
  };
}

export function serializeRegistry(registry) {
  return JSON.stringify(exportRegistry(registry), null, 2);
}

export function importRegistry(snapshot) {
  return snapshot.registry;
}
