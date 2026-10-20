import { selectReadyTask, leaseTaskEntry, markQueueEntryStatus, scheduleTaskRetry } from "./task-queue.js";
import { appendRegistryEvent } from "./event-journal.js";
import { resolveAdapter } from "./adapter-routing.js";
import { computeBackoffDelayMs } from "./policy.js";
import { evaluateAuthority } from "./authorization.js";
import { prepareAttemptRecord } from "./attempts.js";
import { executeTask } from "../execution/task-packets.js";
import { ingestExecutionResult } from "../execution/results.js";
import { assertTaskPacket, contractError } from "../contracts/sigils.js";

export async function runRuntimeCycle(registry, router, policy, options = {}) {
  const now = typeof options.now === "function" ? options.now() : Date.now();
  const entry = selectReadyTask(registry, now);
  if (!entry) {
    appendRegistryEvent(registry, "runtime_cycle_skipped", { reason: "no_ready_task" });
    return { ok: true, skipped: true };
  }

  const task = registry.tasks[entry.task_id];
  const adapter = resolveAdapter(router, task.target_entity);
  if (!adapter) {
    scheduleTaskRetry(registry, task.task_id, computeBackoffDelayMs(policy, entry.retry_count + 1), "no_adapter", { now });
    appendRegistryEvent(registry, "task_retry_scheduled", { task_id: task.task_id, reason: "no_adapter" });
    return { ok: false, task_id: task.task_id, reason: "no_adapter" };
  }

  // Dispatch gate: evaluate against the live snapshot before any lease or
  // effect. A denial leaves the task queued, unleased, and never touches
  // the adapter.
  const attempt = prepareAttemptRecord(registry, task);
  const decision = evaluateAuthority({ stage: "dispatch", now, run: registry.run, task, attempt, authority: registry.authority });
  if (!decision.allowed) {
    appendRegistryEvent(registry, "dispatch_denied", { task_id: task.task_id, code: decision.code });
    return { ok: false, task_id: task.task_id, code: decision.code, denied: true };
  }

  leaseTaskEntry(entry, now);
  attempt.lease_expires_at = now + 30_000;
  attempt.authority_revision = registry.authority.authority_revision;
  attempt.grant_ids = [...decision.grant_ids];
  attempt.approval_id = decision.approval_id;
  task.status = "running";
  registry.run.revision += 1;
  if (decision.approval_id) {
    const approval = registry.authority.approvals.find(a => a.approval_id === decision.approval_id);
    if (approval) approval.consumed_by_attempt_id = attempt.attempt_id;
  }
  appendRegistryEvent(registry, "task_dispatched", { task_id: task.task_id, attempt_id: attempt.attempt_id });

  try {
    const { status, created_at, retry_count, last_result, authority_binding, ...packet } = task;
    const result = await executeTask(adapter, assertTaskPacket(packet), { registry });
    ingestExecutionResult(registry, result);
    markQueueEntryStatus(registry, task.task_id, result.status);
    appendRegistryEvent(registry, "task_result_ingested", { task_id: task.task_id, outcome: result.outcome });
    appendRegistryEvent(registry, "runtime_cycle_completed", { task_id: task.task_id });
    return { ok: true, task_id: task.task_id, result, attempt_id: attempt.attempt_id };
  } catch (caught) {
    const error = contractError(caught?.code === "INVALID_RESULT" ? "INVALID_RESULT" : "ADAPTER_ERROR");
    const delay = computeBackoffDelayMs(policy, entry.retry_count + 1);
    const updated = scheduleTaskRetry(registry, task.task_id, delay, error, { now });
    appendRegistryEvent(registry, updated.status === "dead_letter" ? "task_dead_lettered" : "task_retry_scheduled", {
      task_id: task.task_id,
      error: String(error)
    });
    return { ok: false, task_id: task.task_id, error: String(error), dead_letter: updated.status === "dead_letter" };
  }
}
