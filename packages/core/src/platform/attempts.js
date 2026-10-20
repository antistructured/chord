import { stableId } from "../utils/id.js";
import { TaskAuthority, Attempt } from "../contracts/sigils.js";

/** Attempt reservations are kernel-owned state: repeating preparation of the
 * same queued task returns the same pending attempt; a retry creates a new
 * one only after the prior reservation is invalidated (cancel/dead-letter).
 */
export function prepareAttemptRecord(registry, task) {
  const existing = registry.pending_attempts[task.task_id];
  if (existing) return existing;
  const queueEntry = registry.task_queue.find(x => x.task_id === task.task_id);
  const attempt = Attempt.assert({
    run_id: registry.run.run_id,
    schema_version: registry.run.schema_version,
    task_id: task.task_id,
    task_revision: task.task_revision ?? 0,
    queue_id: queueEntry?.queue_id ?? "unqueued",
    attempt_id: stableId("attempt"),
    lease_expires_at: 0,
    authority_revision: registry.authority?.authority_revision ?? 0,
    grant_ids: [],
    approval_id: null
  });
  registry.pending_attempts[task.task_id] = attempt;
  return attempt;
}

export function invalidatePendingAttempt(registry, taskId) {
  const existing = registry.pending_attempts[taskId] || null;
  delete registry.pending_attempts[taskId];
  return existing;
}

export function assertTaskAuthorityBinding(binding) {
  return TaskAuthority.assert(binding);
}
