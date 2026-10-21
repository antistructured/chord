import { authorityError } from './authorization.js';
import { canTaskTransition, canQueueTransition, canArtifactTransition, canDomainTransition } from './transitions.js';
import { sameData } from './history.js';

// Shared by installation and historical reconstruction. No effects or clocks.
export function assertCanonicalTransition(before, after, operation = 'host_commit') {
  if (['cancelled', 'completed', 'failed'].includes(before.run.state) && before.run.state !== after.run.state) throw authorityError('INVALID_TRANSITION');
  for (const [id, task] of Object.entries(before.tasks)) {
    const next = after.tasks[id];
    if (!next) throw authorityError('INVALID_TRANSITION');
    for (const key of ['task_id', 'schema_version', 'project', 'phase', 'target_entity', 'requested_action', 'inputs', 'constraints', 'authority_binding', 'operation_id']) if (!sameData(task[key], next[key])) throw authorityError('IMMUTABLE_TASK');
    const cancelled = operation === 'cancel_run' && after.run.state === 'cancelled' && next.status === 'cancelled' && !['completed', 'failed', 'cancelled'].includes(task.status);
    const imported = operation === 'import_quarantine' && ['running', 'leased'].includes(task.status) && next.status === 'uncertain';
    const reconciled = operation === 'reconcile_effect' && task.status === 'blocked' && ['completed', 'cancelled'].includes(next.status);
    if (task.status !== next.status && !canTaskTransition(task.status, next.status) && !cancelled && !imported && !reconciled) throw authorityError('INVALID_TRANSITION');
  }
  for (const entry of before.task_queue) {
    const next = after.task_queue.find(q => q.queue_id === entry.queue_id);
    if (!next || next.task_id !== entry.task_id) throw authorityError('INVALID_TRANSITION');
    const cancelled = operation === 'cancel_run' && after.run.state === 'cancelled' && next.status === 'cancelled' && !['completed', 'failed', 'cancelled'].includes(entry.status);
    const imported = operation === 'import_quarantine' && ['running', 'leased'].includes(entry.status) && next.status === 'uncertain';
    const reconciled = operation === 'reconcile_effect' && entry.status === 'blocked' && ['completed', 'cancelled'].includes(next.status);
    if (entry.status !== next.status && !canQueueTransition(entry.status, next.status) && !cancelled && !imported && !reconciled) throw authorityError('INVALID_TRANSITION');
  }
  for (const [id, record] of Object.entries(before.artifacts)) if (!after.artifacts[id] || !canArtifactTransition(record.status, after.artifacts[id].status)) throw authorityError('INVALID_TRANSITION');
  for (const [id, record] of Object.entries(before.domains)) if (!after.domains[id] || !canDomainTransition(record.state, after.domains[id].state)) throw authorityError('INVALID_TRANSITION');
}
