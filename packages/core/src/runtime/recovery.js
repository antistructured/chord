import { markTaskUncertain } from '../platform/transitions.js';

// Host-assured sequential restart only: never infer takeover from lease time.
// No router, adapter, snapshot import or effect acknowledgement exists here.
export function recoverOwner(owner, now) {
  const inFlight = registry => Object.values(registry.tasks).filter(task =>
    ['running', 'leased'].includes(task.status)
  );
  const observed = owner.read();
  if (inFlight(observed).length === 0) return;
  owner.transact('restart_recovery', registry => {
    const at = now();
    for (const task of inFlight(registry)) markTaskUncertain(registry, task.task_id, { reason: 'PROCESS_RESTART', now: at });
  }, observed.run.revision);
}
