import { stableId } from "../utils/id.js";

export function appendRegistryEvent(registry, type, payload = {}) {
  const event = {
    event_id: stableId("evt"),
    type,
    at: Date.now(),
    payload
  };
  registry.event_journal.push(event);
  return event;
}

export function listRegistryEvents(registry, filters = {}) {
  return registry.event_journal.filter(e => {
    if (filters.type && e.type !== filters.type) return false;
    return true;
  });
}
