import { stableId } from "../utils/id.js";
import { transitionTaskStatus, transitionQueueEntryStatus, canQueueTransition } from "./transitions.js";
import { evaluateAuthority, authorityError } from "./authorization.js";
import { invalidatePendingAttempt, clearActiveAttempt } from "./attempts.js";

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
    available_at: options.available_at ?? (options.now ?? Date.now()),
    lease_expires_at: null,
    max_attempts: options.max_attempts ?? 3,
    retry_count: 0,
    last_error: null
  };
  registry.task_queue.push(entry);
  return entry;
}

export function selectReadyTask(registry, now = Date.now()) {
  const queued = registry.task_queue
    .filter(x => x.status === "queued" && x.available_at <= now)
    .sort((a, b) =>
      (b.priority - a.priority) ||
      (a.available_at - b.available_at) ||
      (a.queue_id.localeCompare(b.queue_id))
    );
  return queued[0] || null;
}

export function leaseTaskEntry(entry, now = Date.now(), durationMs = 30_000) {
  transitionQueueEntryStatus(entry, "leased");
  entry.lease_expires_at = now + durationMs;
  return entry;
}

export function dequeueReadyTask(registry, now = Date.now()) {
  const entry = selectReadyTask(registry, now);
  if (!entry) return null;
  return leaseTaskEntry(entry, now);
}

export function markQueueEntryStatus(registry, taskId, status, extra = {}) {
  const entry = registry.task_queue.find(x => x.task_id === taskId);
  if (!entry) return null;
  transitionQueueEntryStatus(entry, status);
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

/** Bounded pre-dispatch retry (design §5: "Pre-dispatch transient routing
 * failures may stay queued under bounded policy"). Only legal while the
 * task has not been dispatched; post-dispatch ambiguity goes to uncertain
 * through the runtime loop, never through this path. A dead-letter sink
 * invalidates any attempt reservation.
 */
export function scheduleTaskRetry(registry, taskId, delayMs, error = null, options = {}) {
  const entry = registry.task_queue.find(x => x.task_id === taskId);
  if (!entry) return null;
  entry.retry_count += 1;
  const next = entry.retry_count >= entry.max_attempts ? "dead_letter" : "queued";
  transitionQueueEntryStatus(entry, next);
  entry.available_at = (options.now ?? Date.now()) + delayMs;
  entry.lease_expires_at = null;
  entry.last_error = error ? String(error) : null;

  // Sync registry.tasks through the same guard.
  const task = registry.tasks[taskId];
  if (task) {
    transitionTaskStatus(registry, taskId, next);
    task.retry_count = entry.retry_count;
  }

  if (next === "dead_letter") {
    delete registry.pending_attempts[taskId];
    delete registry.active_attempts[taskId];
  }
  registry.run.revision += 1;

  return entry;
}

/** Fresh-admission dead-letter replay (design §5: "Dead-letter replay must
 *  go through fresh admission and attempt allocation, not reset a prior
 *  attempt/approval"). Retained on the historical `@chord/core/platform`
 *  export surface, but its semantics are corrected: replay is a *new*
 *  queued attempt, not an in-place status reset. Authority is re-evaluated
 *  at admission; a revoked or denied grant leaves the task untouched.
 *  Previously consumed approvals stay consumed (kernel-owned) — only the
 *  attempt reservations and retry counters are reset.
 */
export function replayDeadLetterTask(registry, taskId, options = {}) {
  const task = registry.tasks[taskId];
  if (!task || typeof task.task_id !== "string") return null;
  const entry = registry.task_queue.find(x => x.task_id === taskId);
  if (!entry || entry.status !== "dead_letter" || task.status !== "dead_letter") return null;
  const now = options.now ?? Date.now();
  const decision = evaluateAuthority({
    stage: "admit",
    now,
    run: registry.run,
    task: { ...task, status: "queued" },
    attempt: null,
    authority: registry.authority ?? null
  });
  if (!decision.allowed) throw authorityError(decision.code);
  transitionTaskStatus(registry, taskId, "queued");
  task.retry_count = 0;
  if (canQueueTransition(entry.status, "queued")) entry.status = "queued";
  entry.retry_count = 0;
  entry.available_at = now;
  entry.lease_expires_at = null;
  entry.last_error = null;
  invalidatePendingAttempt(registry, taskId);
  clearActiveAttempt(registry, taskId);
  registry.run.revision += 1;
  return entry;
}
