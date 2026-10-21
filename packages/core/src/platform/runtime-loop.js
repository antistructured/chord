import { selectReadyTask, leaseTaskEntry, scheduleTaskRetry } from './task-queue.js';
import { appendRegistryEvent } from './event-journal.js';
import { resolveAdapter } from './adapter-routing.js';
import { computeBackoffDelayMs } from './policy.js';
import { evaluateAuthority } from './authorization.js';
import { prepareAttemptRecord, activatePendingAttempt } from './attempts.js';
import { markTaskUncertain, transitionTaskStatus } from './transitions.js';
import { prepareTaskExecution } from '../execution/task-packets.js';
import { ingestExecutionResult } from '../execution/results.js';
import { createStateOwner } from '../registry/owner.js';
import { operationFor } from './reconciliation.js';

const LEASE_MS = 30_000;
function countLeased(registry, target = null) {
  return registry.task_queue.filter(x => x.status === 'leased' && (target === null || x.target_entity === target)).length;
}
// The SDK supplies its private owner port. A legacy plain registry argument is
// caller-owned simulation data, never a handle to an SDK's canonical state.
export async function runRuntimeCycle(input, router, policy, options = {}) {
  const store = typeof input?.transact === 'function' ? input : createStateOwner(input);
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const executable = registry => ['created', 'active'].includes(registry.run.state || 'created');
  const observed = store.read();
  if (!executable(observed)) return { ok: false, denied: true, code: 'RUN_NOT_ACTIVE' };
  const ready = selectReadyTask(observed, now());
  if (!ready) return { ok: true, skipped: true };
  if (countLeased(observed) >= policy.globalMaxLeased || countLeased(observed, ready.target_entity) >= policy.perEntityMaxLeased) return { ok: true, deferred: true, task_id: ready.task_id, reason: 'lease_cap' };
  let adapter, invoke;
  const claim = store.transact('runtime_claim', registry => {
    const at = now();
    if (!executable(registry)) return { response: { ok: false, denied: true, code: 'RUN_NOT_ACTIVE' } };
    const entry = selectReadyTask(registry, at);
    if (!entry) {
      appendRegistryEvent(registry, 'runtime_cycle_skipped', { reason: 'no_ready_task' });
      return { response: { ok: true, skipped: true } };
    }
    const task = registry.tasks[entry.task_id];
    if (countLeased(registry) >= policy.globalMaxLeased || countLeased(registry, task.target_entity) >= policy.perEntityMaxLeased) {
      appendRegistryEvent(registry, 'dispatch_deferred', { task_id: task.task_id, reason: 'lease_cap' });
      return { response: { ok: true, deferred: true, task_id: task.task_id, reason: 'lease_cap' } };
    }
    adapter = resolveAdapter(router, task.target_entity);
    if (!adapter) {
      scheduleTaskRetry(registry, task.task_id, computeBackoffDelayMs(policy, entry.retry_count + 1), 'no_adapter', { now: at });
      appendRegistryEvent(registry, 'task_retry_scheduled', { task_id: task.task_id, reason: 'no_adapter' });
      return { response: { ok: false, task_id: task.task_id, reason: 'no_adapter' } };
    }
    const attempt = prepareAttemptRecord(registry, task);
    const decision = evaluateAuthority({ stage: 'dispatch', now: at, run: registry.run, task, attempt, authority: registry.authority });
    if (!decision.allowed) {
      appendRegistryEvent(registry, 'dispatch_denied', { task_id: task.task_id, code: decision.code });
      return { response: { ok: false, task_id: task.task_id, code: decision.code, denied: true } };
    }
    const operation = operationFor(registry, task.task_id);
    if (operation && operation.state !== 'requested') throw new TypeError('RECONCILIATION_REQUIRED');
    if (operation) { operation.state = 'dispatched'; operation.attempt_id = attempt.attempt_id; }
    leaseTaskEntry(entry, at, LEASE_MS);
    attempt.lease_expires_at = at + LEASE_MS;
    attempt.authority_revision = registry.authority.authority_revision;
    attempt.grant_ids = [...decision.grant_ids];
    attempt.approval_id = decision.approval_id;
    transitionTaskStatus(registry, task.task_id, 'running');
    if (decision.approval_id) registry.authority.approvals.find(a => a.approval_id === decision.approval_id).consumed_by_attempt_id = attempt.attempt_id;
    activatePendingAttempt(registry, task.task_id, registry.run.revision + 1);
    appendRegistryEvent(registry, 'task_dispatched', { task_id: task.task_id, attempt_id: attempt.attempt_id });
    const { status, created_at, retry_count, last_result, authority_binding, operation_id, ...packet } = task;
    const context = { run_id: registry.run.run_id, schema_version: registry.run.schema_version, task_id: task.task_id, task_revision: task.task_revision ?? 0, queue_id: entry.queue_id, attempt_id: attempt.attempt_id, lease_expires_at: attempt.lease_expires_at };
    // Getter/callable validation runs while the candidate is guarded. A
    // reentrant host callback cannot install cancellation then execute anyway.
    invoke = prepareTaskExecution(adapter, packet, context);
    return { packet, attempt, context };
  });
  if (claim.response) return claim.response;
  const { packet, attempt, context } = claim;
  try {
    // No await or external callback between successful claim and invocation.
    const result = await invoke();
    const outcome = { ...result, run_id: context.run_id, schema_version: context.schema_version, task_revision: context.task_revision, queue_id: context.queue_id, attempt_id: context.attempt_id };
    return store.transact('runtime_result', registry => {
      const task = registry.tasks[packet.task_id];
      const active = registry.active_attempts[packet.task_id];
      const commit = evaluateAuthority({ stage: 'commit', now: now(), run: registry.run, task, attempt, authority: registry.authority });
      if (!executable(registry) || !commit.allowed || !active || active.dispatch_revision !== registry.run.revision || active.attempt.attempt_id !== attempt.attempt_id) {
        const code = !executable(registry) ? 'RUN_NOT_ACTIVE' : !commit.allowed ? commit.code : 'STALE_REVISION';
        const marked = markTaskUncertain(registry, packet.task_id, { reason: code });
        appendRegistryEvent(registry, 'commit_rejected', { task_id: packet.task_id, code });
        return { ok: false, task_id: packet.task_id, uncertain: marked.marked, code };
      }
      ingestExecutionResult(registry, outcome);
      const operation = operationFor(registry, packet.task_id);
      if (operation) operation.state = outcome.status === 'completed' ? 'confirmed' : 'unknown';
      appendRegistryEvent(registry, 'task_result_ingested', { task_id: packet.task_id, outcome: outcome.outcome });
      appendRegistryEvent(registry, 'runtime_cycle_completed', { task_id: packet.task_id });
      return { ok: true, task_id: packet.task_id, result: outcome, attempt_id: attempt.attempt_id };
    });
  } catch (caught) {
    const code = /^[A-Z0-9_]{1,64}$/.test(caught?.code || '') ? caught.code : 'ADAPTER_ERROR';
    return store.transact('runtime_uncertain', registry => {
      const active = registry.active_attempts[packet.task_id];
      if (active && active.attempt.attempt_id !== attempt.attempt_id) return { ok: false, uncertain: false, error: 'STALE_ATTEMPT' };
      const marked = markTaskUncertain(registry, packet.task_id, { reason: code });
      return { ok: false, task_id: packet.task_id, uncertain: marked.marked, error: code };
    });
  }
}
