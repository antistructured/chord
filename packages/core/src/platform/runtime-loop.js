import { selectReadyTask, leaseTaskEntry, scheduleTaskRetry } from "./task-queue.js";
import { appendRegistryEvent } from "./event-journal.js";
import { resolveAdapter } from "./adapter-routing.js";
import { computeBackoffDelayMs } from "./policy.js";
import { evaluateAuthority } from "./authorization.js";
import { prepareAttemptRecord, activatePendingAttempt } from "./attempts.js";
import { markTaskUncertain, transitionTaskStatus } from "./transitions.js";
import { executeTask } from "../execution/task-packets.js";
import { ingestExecutionResult } from "../execution/results.js";
import { assertTaskPacket } from "../contracts/sigils.js";

const LEASE_MS = 30_000;
const SANITIZED_CODE = /^[A-Z0-9_]{1,64}$/;

function countLeased(registry, targetEntity = null) {
  return registry.task_queue.filter(x =>
    x.status === "leased" && (targetEntity === null || x.target_entity === targetEntity)
  ).length;
}

function sanitizeCode(value, fallback = "ADAPTER_ERROR") {
  const code = String(value ?? "");
  return SANITIZED_CODE.test(code) ? code : fallback;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
  }
  return value;
}

/** One governed runtime cycle (041-authority-design.md §5).
 *
 * Preflight (lease caps, adapter, dispatch authority) happens before any
 * lease or effect. After invocation, a result may only commit with fresh
 * commit-stage permission and an unchanged run revision (the dispatch
 * commit guard). Any post-dispatch ambiguity — thrown adapter, invalid or
 * uncorrelated result, expired lease, stale revision, mid-await policy
 * change — marks the attempt `uncertain` for explicit host reconciliation;
 * it is never blindly retried or redispatched.
 */
export async function runRuntimeCycle(registry, router, policy, options = {}) {
  const now = typeof options.now === "function" ? options.now() : Date.now();
  const entry = selectReadyTask(registry, now);
  if (!entry) {
    appendRegistryEvent(registry, "runtime_cycle_skipped", { reason: "no_ready_task" });
    return { ok: true, skipped: true };
  }

  const task = registry.tasks[entry.task_id];

  // Dispatch preflight (design §5 step 2): lease caps and adapter
  // existence are checked before any lease or external effect.
  if (countLeased(registry) >= policy.globalMaxLeased ||
    countLeased(registry, task.target_entity) >= policy.perEntityMaxLeased) {
    appendRegistryEvent(registry, "dispatch_deferred", { task_id: task.task_id, reason: "lease_cap" });
    return { ok: true, deferred: true, task_id: task.task_id, reason: "lease_cap" };
  }
  const adapter = resolveAdapter(router, task.target_entity);
  if (!adapter) {
    // Pre-dispatch transient routing failure: bounded retry policy only;
    // no lease, no attempt, no effect.
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

  // Lease + attempt binding commit: one synchronous section, no await
  // between this commit and the adapter invocation (design §5 step 3).
  leaseTaskEntry(entry, now, LEASE_MS);
  attempt.lease_expires_at = now + LEASE_MS;
  attempt.authority_revision = registry.authority.authority_revision;
  attempt.grant_ids = [...decision.grant_ids];
  attempt.approval_id = decision.approval_id;
  transitionTaskStatus(registry, task.task_id, "running");
  registry.run.revision += 1;
  if (decision.approval_id) {
    const approval = registry.authority.approvals.find(a => a.approval_id === decision.approval_id);
    if (approval) approval.consumed_by_attempt_id = attempt.attempt_id;
  }
  // The post-bump revision is the attempt's commit guard.
  activatePendingAttempt(registry, task.task_id, registry.run.revision);
  appendRegistryEvent(registry, "task_dispatched", { task_id: task.task_id, attempt_id: attempt.attempt_id });

  try {
    const { status, created_at, retry_count, last_result, authority_binding, ...packet } = task;
    // Adapters receive a deep-frozen cloned packet and correlation
    // context only — never the registry or authority write handles.
    const result = await executeTask(adapter, deepFreeze(assertTaskPacket(packet)), {
      run_id: registry.run.run_id,
      schema_version: registry.run.schema_version,
      task_id: task.task_id,
      task_revision: task.task_revision ?? 0,
      queue_id: entry.queue_id,
      attempt_id: attempt.attempt_id,
      lease_expires_at: attempt.lease_expires_at
    });

    // Correlated outcome (design §5 step 4): kernel-owned identifiers are
    // stamped from dispatch state; AdapterResult's closed shape already
    // rejected any adapter-authored conflicting identifiers.
    const outcome = {
      task_id: result.task_id,
      status: result.status,
      outcome: result.outcome,
      ...(result.summary !== undefined ? { summary: result.summary } : {}),
      ...(result.outputs !== undefined ? { outputs: result.outputs } : {}),
      ...(result.artifact !== undefined ? { artifact: result.artifact } : {}),
      ...(result.domain !== undefined ? { domain: result.domain } : {}),
      run_id: registry.run.run_id,
      schema_version: registry.run.schema_version,
      task_revision: task.task_revision ?? 0,
      queue_id: attempt.queue_id,
      attempt_id: attempt.attempt_id
    };

    // Commit re-evaluation (design §5 step 5): fresh decision on live
    // state plus the saved dispatch revision. A previously returned allow
    // is never reused; any intervening mutation makes this candidate stale.
    const commitNow = typeof options.now === "function" ? options.now() : Date.now();
    const active = registry.active_attempts[task.task_id];
    const revisionOk = active !== undefined && registry.run.revision === active.dispatch_revision;
    const commit = evaluateAuthority({ stage: "commit", now: commitNow, run: registry.run, task, attempt, authority: registry.authority });
    if (!commit.allowed || !revisionOk) {
      const code = !commit.allowed ? commit.code : "STALE_REVISION";
      const marked = markTaskUncertain(registry, task.task_id, { reason: code, now: commitNow });
      appendRegistryEvent(registry, "commit_rejected", { task_id: task.task_id, code: marked.code });
      return { ok: false, task_id: task.task_id, uncertain: marked.marked, code: marked.code };
    }

    ingestExecutionResult(registry, outcome);
    appendRegistryEvent(registry, "task_result_ingested", { task_id: task.task_id, outcome: outcome.outcome });
    appendRegistryEvent(registry, "runtime_cycle_completed", { task_id: task.task_id });
    return { ok: true, task_id: task.task_id, result: outcome, attempt_id: attempt.attempt_id };
  } catch (caught) {
    // Post-dispatch ambiguity (design §5 step 6): adapter errors, invalid
    // or uncorrelated results, and contract violations after dispatch have
    // unknown effect status. Mark uncertain for reconciliation; never a
    // blind retry or dead-letter redispatch.
    const code = sanitizeCode(caught?.code, "ADAPTER_ERROR");
    const marked = markTaskUncertain(registry, task.task_id, { reason: code });
    return { ok: false, task_id: task.task_id, uncertain: marked.marked, error: marked.code };
  }
}
