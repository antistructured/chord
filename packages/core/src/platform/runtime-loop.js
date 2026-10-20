import { dequeueReadyTask, enqueueTask, markQueueEntryStatus, scheduleTaskRetry } from "./task-queue.js";
import { appendRegistryEvent } from "./event-journal.js";
import { resolveAdapter } from "./adapter-routing.js";
import { computeBackoffDelayMs } from "./policy.js";
import { executeTask } from "../execution/task-packets.js";
import { ingestExecutionResult } from "../execution/results.js";
import { assertTaskPacket, contractError } from "../contracts/sigils.js";

export async function runRuntimeCycle(registry, router, policy) {
  const entry = dequeueReadyTask(registry);
  if (!entry) {
    appendRegistryEvent(registry, "runtime_cycle_skipped", { reason: "no_ready_task" });
    return { ok: true, skipped: true };
  }

  const task = registry.tasks[entry.task_id];
  const adapter = resolveAdapter(router, task.target_entity);
  if (!adapter) {
    scheduleTaskRetry(registry, task.task_id, computeBackoffDelayMs(policy, entry.retry_count + 1), "no_adapter");
    appendRegistryEvent(registry, "task_retry_scheduled", { task_id: task.task_id, reason: "no_adapter" });
    return { ok: false, task_id: task.task_id, reason: "no_adapter" };
  }

  try {
    const { status, created_at, retry_count, last_result, ...packet } = task;
    const result = await executeTask(adapter, assertTaskPacket(packet), { registry });
    ingestExecutionResult(registry, result);
    markQueueEntryStatus(registry, task.task_id, result.status);
    appendRegistryEvent(registry, "task_result_ingested", { task_id: task.task_id, outcome: result.outcome });
    appendRegistryEvent(registry, "runtime_cycle_completed", { task_id: task.task_id });
    return { ok: true, task_id: task.task_id, result };
  } catch (caught) {
    const error = contractError(caught?.code === "INVALID_RESULT" ? "INVALID_RESULT" : "ADAPTER_ERROR");
    const delay = computeBackoffDelayMs(policy, entry.retry_count + 1);
    const updated = scheduleTaskRetry(registry, task.task_id, delay, error);
    appendRegistryEvent(registry, updated.status === "dead_letter" ? "task_dead_lettered" : "task_retry_scheduled", {
      task_id: task.task_id,
      error: String(error)
    });
    return { ok: false, task_id: task.task_id, error: String(error), dead_letter: updated.status === "dead_letter" };
  }
}
