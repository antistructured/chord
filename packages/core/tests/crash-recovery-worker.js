// B3 SIGKILL window worker. No production fault-injection API is installed.
import { appendFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createChord } from '../src/index.js';

const [path, window, effects] = process.argv.slice(2);
const kill = () => process.kill(process.pid, 'SIGKILL');
let commits = 0;
const exec = DatabaseSync.prototype.exec;
const c = createChord({ storage: { path, mode: 'existing' }, trustedHost: { now: () => 100 }, adapterRouter: { fallback: {
  execute() {
    if (window === 'before_dispatch') kill(); // callable entered; no external effect yet
    appendFileSync(effects, 'effect\n');
    if (window === 'dispatch_before_ack') kill(); // effect recorded, adapter has not returned
    if (window === 'reconciliation') throw Error('unknown external outcome');
    return { status: 'completed', outcome: 'succeeded' };
  }
} } });
// Arm only after startup/open transactions. Counts below are owner commits.
DatabaseSync.prototype.exec = function(sql) {
  if (sql === 'COMMIT') {
    commits++;
    if (window === 'before_commit' && commits === 1) kill();
    if (window === 'ack_before_result_commit' && commits === 2) kill();
    const value = exec.call(this, sql);
    if (window === 'after_commit' && commits === 1) kill();
    if (window === 'confirmed_committed' && commits === 2) kill();
    return value;
  }
  return exec.call(this, sql);
};
if (window === 'approval_suspension') {
  const id = Object.keys(c.registry.tasks)[0];
  c.prepareAttempt(id);
  c.pauseForApproval({ reason: 'human review' });
  kill();
} else {
  await c.runCycle();
  if (window === 'reconciliation') {
    c.reconcileTask({ task_id: Object.keys(c.registry.tasks)[0], principal_id: 'human-approver', decision: 'confirmed_not_executed', evidence: { kind: 'no_effect_confirmation', reference: 'host-receipt-8' }, expectedRevision: c.getRunRevision() });
    kill();
  }
}
throw Error('window not reached');
