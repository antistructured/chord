import { authorityError } from "./authorization.js";
import { appendRegistryEvent } from "./event-journal.js";
import { operationFor } from "./reconciliation.js";

/** Guarded state machines (041-authority-design.md §5).
 *
 * Task graph: design-minimal edges plus the two contract statuses the
 * kernel owns. `leased` is the dispatch reservation (queued -> leased ->
 * running); `dead_letter` is the bounded pre-dispatch retry sink
 * (queued -> dead_letter), exited only by fresh-admission replay.
 * `blocked -> queued | cancelled` is explicit host re-evaluation only.
 * `uncertain` requires explicit host reconciliation and is never entered
 * by normal result ingestion. `completed`, `failed`, `cancelled` are
 * terminal for the task ID. `running -> blocked` exists because a valid
 * adapter result may report `blocked` and the design graph already grants
 * `blocked -> queued` as an exit; without the entry edge that exit is
 * unreachable.
 */
export const TASK_TRANSITIONS = Object.freeze({
  queued: ["leased", "running", "blocked", "cancelled", "dead_letter"],
  leased: ["running", "queued", "cancelled", "dead_letter"],
  blocked: ["queued", "cancelled"],
  running: ["completed", "failed", "blocked", "uncertain", "cancelled"],
  uncertain: ["queued", "completed", "failed", "cancelled"],
  dead_letter: ["queued"],
  completed: [],
  failed: [],
  cancelled: []
});

/** Queue-entry graph. Entries sit `leased` while the task runs; post-
 * dispatch outcomes land directly on completed/failed/blocked/uncertain.
 */
export const QUEUE_TRANSITIONS = Object.freeze({
  queued: ["leased", "cancelled", "dead_letter"],
  leased: ["completed", "failed", "blocked", "cancelled", "uncertain"],
  blocked: ["queued", "cancelled"],
  uncertain: ["queued", "completed", "failed", "cancelled"],
  dead_letter: ["queued"],
  completed: [],
  failed: [],
  cancelled: []
});

export const ARTIFACT_TRANSITIONS = Object.freeze({
  declared: ["produced", "accepted", "rejected", "superseded"],
  produced: ["accepted", "rejected", "superseded"],
  accepted: [],
  rejected: [],
  superseded: []
});

/** Domain states are open strings (declared per-spec); only result-derived
 * transitions are guarded. `complete` is terminal for kernel derivation;
 * any other declared state may receive `complete` or `blocked`.
 */
const DOMAIN_RESULT_STATES = new Set(["complete", "blocked"]);
const DOMAIN_TERMINAL_STATES = new Set(["complete"]);

export function canTaskTransition(current, next) {
  return Boolean(TASK_TRANSITIONS[current]?.includes(next));
}

export function assertTaskTransition(current, next) {
  if (!canTaskTransition(current, next)) throw authorityError("INVALID_TRANSITION");
  return next;
}

export function transitionTaskStatus(registry, taskId, next) {
  const task = registry.tasks[taskId];
  if (!task || typeof task.task_id !== "string") throw authorityError("INVALID_CONTEXT");
  if (task.status === next) return task;
  assertTaskTransition(task.status, next);
  task.status = next;
  return task;
}

export function canQueueTransition(current, next) {
  return Boolean(QUEUE_TRANSITIONS[current]?.includes(next));
}

export function assertQueueTransition(current, next) {
  if (!canQueueTransition(current, next)) throw authorityError("INVALID_TRANSITION");
  return next;
}

export function transitionQueueEntryStatus(entry, next) {
  if (!entry || typeof entry.task_id !== "string") throw authorityError("INVALID_CONTEXT");
  if (entry.status === next) return entry;
  assertQueueTransition(entry.status, next);
  entry.status = next;
  return entry;
}

export function canArtifactTransition(current, next) {
  if (current === next) return true;
  return Boolean(ARTIFACT_TRANSITIONS[current]?.includes(next));
}

export function assertArtifactTransition(current, next) {
  if (!canArtifactTransition(current, next)) throw authorityError("INVALID_TRANSITION");
  return next;
}

export function canDomainTransition(current, next) {
  if (current === next) return true;
  if (!DOMAIN_RESULT_STATES.has(next)) return false;
  return !DOMAIN_TERMINAL_STATES.has(current);
}

export function assertDomainTransition(current, next) {
  if (!canDomainTransition(current, next)) throw authorityError("INVALID_TRANSITION");
  return next;
}

export function transitionDomainState(record, next) {
  if (!record || typeof record.name !== "string") throw authorityError("INVALID_CONTEXT");
  if (record.state === next) return record;
  assertDomainTransition(record.state, next);
  record.state = next;
  record.state_history ||= [];
  record.state_history.push({ to: next, at: Date.now() });
  return record;
}

const SANITIZED_CODE = /^[A-Z0-9_]{1,64}$/;

/** Mark a dispatched attempt uncertain (design §5 step 6). Only entered
 * from post-dispatch ambiguity or explicit host action, never by normal
 * result ingestion. Never overwrites a terminal state: if another mutation
 * (cancellation, completion) won while the adapter was in flight, the
 * uncertainty is journaled as an ignored result and nothing is mutated.
 * Clears attempt reservations; the attempt is not reusable.
 */
export function markTaskUncertain(registry, taskId, { reason = "UNKNOWN", now = Date.now() } = {}) {
  const task = registry.tasks[taskId];
  if (!task || typeof task.task_id !== "string") throw authorityError("INVALID_CONTEXT");
  const code = SANITIZED_CODE.test(String(reason)) ? String(reason) : "UNKNOWN";
  if (!canTaskTransition(task.status, "uncertain")) {
    appendRegistryEvent(registry, "task_result_ignored", { task_id: taskId, task_status: task.status, code });
    return { marked: false, task, code };
  }
  task.status = "uncertain";
  const operation = operationFor(registry, taskId);
  if (operation) operation.state = "unknown";
  const entry = registry.task_queue.find(x => x.task_id === taskId);
  if (entry && canQueueTransition(entry.status, "uncertain")) entry.status = "uncertain";
  delete registry.pending_attempts[taskId];
  delete registry.active_attempts[taskId];
  registry.run.revision += 1;
  appendRegistryEvent(registry, "task_uncertain", { task_id: taskId, code, at: now });
  return { marked: true, task, code };
}
