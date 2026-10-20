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
  // Restoring in-flight work safely requires pass 5 reconciliation, not reset.
  if (value.registry.task_queue.some(x => x.status === "leased" || x.status === "running") || Object.values(value.registry.tasks).some(x => x.status === "leased" || x.status === "running")) throw contractError("INVALID_DATA");
  return value.registry;
}
