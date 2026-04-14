import { stableId } from "../utils/id.js";

export function createTaskQueue() {
  return [];
}

export function enqueueTask(registry, packet, options = {}) {
  const entry = {
    queue_id: stableId("queue"),
    task_id: packet.task_id,
    target_entity: packet.target_entity,
    status: "queued",
    priority: options.priority ?? 0,
    available_at: options.available_at ?? Date.now(),
    lease_expires_at: null,
    max_attempts: options.max_attempts ?? 3,
    retry_count: 0,
    last_error: null
  };
  registry.task_queue.push(entry);
  return entry;
}

export function dequeueReadyTask(registry, now = Date.now()) {
  const queued = registry.task_queue
    .filter(x => x.status === "queued" && x.available_at <= now)
    .sort((a, b) => 
      (b.priority - a.priority) || 
      (a.available_at - b.available_at) ||
      (a.queue_id.localeCompare(b.queue_id))
    );
  const entry = queued[0];
  if (!entry) return null;
  entry.status = "leased";
  entry.lease_expires_at = now + 30_000;
  return entry;
}

export function markQueueEntryStatus(registry, taskId, status, extra = {}) {
  const entry = registry.task_queue.find(x => x.task_id === taskId);
  if (!entry) return null;
  entry.status = status;
  Object.assign(entry, extra);
  return entry;
}

export function listQueuedTasks(registry, filters = {}) {
  return registry.task_queue.filter(q => {
    if (filters.status && q.status !== filters.status) return false;
    if (filters.target_entity && q.target_entity !== filters.target_entity) return false;
    return true;
  });
}

export function scheduleTaskRetry(registry, taskId, delayMs, error = null) {
  const entry = registry.task_queue.find(x => x.task_id === taskId);
  if (!entry) return null;
  entry.retry_count += 1;
  entry.status = entry.retry_count >= entry.max_attempts ? "dead_letter" : "queued";
  entry.available_at = Date.now() + delayMs;
  entry.lease_expires_at = null;
  entry.last_error = error ? String(error) : null;

  // Sync registry.tasks
  const task = registry.tasks[taskId];
  if (task) {
    task.status = entry.status;
    task.retry_count = entry.retry_count;
  }

  return entry;
}

export function replayDeadLetterTask(registry, taskId) {
  const entry = registry.task_queue.find(x => x.task_id === taskId && x.status === "dead_letter");
  if (!entry) return null;
  entry.status = "queued";
  entry.available_at = Date.now();
  entry.retry_count = 0;
  entry.last_error = null;

  // Sync registry.tasks
  const task = registry.tasks[taskId];
  if (task) {
    task.status = "queued";
    task.retry_count = 0;
  }

  return entry;
}
