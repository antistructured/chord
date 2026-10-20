import { Snapshot, SCHEMA_VERSION, contractError } from "../contracts/sigils.js";

export function exportRegistry(registry) {
  return Snapshot.assert({
    schema_version: SCHEMA_VERSION,
    run: registry.run,
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
    registry
  });
}

export function serializeRegistry(registry) {
  return JSON.stringify(exportRegistry(registry), null, 2);
}

export function importRegistry(snapshot) {
  const value = Snapshot.assert(snapshot);
  // Design §6: imported in-flight work is uncertain, never silently
  // executable. Attempt state does not survive import; the host
  // reconciles through explicit replay (fresh admission).
  const registry = value.registry;
  registry.active_attempts = {};
  for (const task of Object.values(registry.tasks)) {
    if (task.status === "leased" || task.status === "running") task.status = "uncertain";
  }
  for (const entry of registry.task_queue) {
    if (entry.status === "leased" || entry.status === "running") entry.status = "uncertain";
  }
  return registry;
}
