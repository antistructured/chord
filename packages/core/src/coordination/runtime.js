import { clonePlainData, Attempt, AdapterResult, Outcome, TaskPacket } from '../contracts/sigils.js';
import { evaluateAuthority } from '../platform/authorization.js';
import { selectReadyTask } from '../platform/task-queue.js';
import { sameData } from '../platform/history.js';
import { canTaskTransition, canArtifactTransition, canDomainTransition } from '../platform/transitions.js';
import { DispatchRecord, ClaimEvidence, OutcomeEvidence, requireTrue, increment, deadline } from './contracts.js';

export const executable = r => ['created','active'].includes(r.run.state);
export function packetOf(task) {
  const {status,created_at,retry_count,last_result,authority_binding,operation_id,...packet} = task;
  return TaskPacket.assert(packet);
}
/** Identity-only check MUST precede authority denial/uncertainty construction. */
export function assertAttempt(current, raw) {
  const d = DispatchRecord.assert(raw), {registry:r,coordination:c} = current;
  const installed = Object.hasOwn(c.attempts,d.attempt_id) ? c.attempts[d.attempt_id] : null;
  const task = r.tasks[d.task_id], active = r.active_attempts[d.task_id];
  const queue = r.task_queue.find(q => q.queue_id === d.queue_id);
  // Keep these predicates explicit: a missing active attempt is stale too.
  requireTrue(d.state === 'dispatched' && sameData(d,installed) && d.owner_id === c.lease.owner_id && d.generation === c.lease.generation && d.run_id === c.run_id && d.incarnation_id === c.incarnation_id && task && active && active.attempt.attempt_id === d.attempt_id && active.dispatch_revision === d.dispatch_revision && active.attempt.queue_id === d.queue_id && active.attempt.task_revision === d.task_revision && (task.task_revision ?? 0) === d.task_revision && active.attempt.authority_revision === d.authority_revision && active.attempt.lease_expires_at === d.task_lease_expires_at && task.operation_id === d.operation_id && task.status === 'running' && queue?.task_id === d.task_id && queue.status === 'leased' && queue.lease_expires_at === d.task_lease_expires_at && r.operations?.[d.operation_id]?.state === 'dispatched' && r.operations[d.operation_id].attempt_id === d.attempt_id,'STALE_ATTEMPT');
  return {d,task,attempt:active.attempt,queue};
}
export function dispatchDecision(current, dispatch, now) {
  const {task,attempt} = assertAttempt(current,dispatch), r = current.registry;
  requireTrue(executable(r),'RUN_NOT_ACTIVE');
  const decision = evaluateAuthority({stage:'commit',now,run:r.run,task,attempt,authority:r.authority});
  requireTrue(decision.allowed,decision.code); return decision;
}
/** Pure shell-side plan; SQL reconstructs and compares the entire candidate. */
export function planClaim(current, taskId, attemptId, now) {
  const r = clonePlainData(current.registry), c = clonePlainData(current.coordination);
  requireTrue(executable(r),'RUN_NOT_ACTIVE');
  const q = selectReadyTask(r,now); requireTrue(q?.task_id === taskId,'STALE_ATTEMPT');
  const task = r.tasks[taskId], operation = r.operations?.[task.operation_id];
  requireTrue(operation && operation.task_id === taskId,'OPERATION_REQUIRED');
  requireTrue(operation.state === 'requested','RECONCILIATION_REQUIRED');
  if (!r.pending_attempts[taskId]) requireTrue(!JSON.stringify(current).includes(JSON.stringify(attemptId)),'INVALID_SEMANTICS');
  const attempt = Attempt.assert(r.pending_attempts[taskId] || {run_id:r.run.run_id,schema_version:r.run.schema_version,task_id:taskId,task_revision:task.task_revision ?? 0,queue_id:q.queue_id,attempt_id:attemptId,lease_expires_at:0,authority_revision:r.authority?.authority_revision ?? 0,grant_ids:[],approval_id:null});
  requireTrue(attempt.attempt_id === attemptId && attempt.queue_id === q.queue_id && attempt.task_revision === (task.task_revision ?? 0) && !Object.hasOwn(c.attempts,attemptId),'STALE_ATTEMPT');
  const decision = evaluateAuthority({stage:'dispatch',now,run:r.run,task,attempt,authority:r.authority}); requireTrue(decision.allowed,decision.code);
  attempt.lease_expires_at = deadline(now); attempt.authority_revision = r.authority.authority_revision; attempt.grant_ids = [...decision.grant_ids]; attempt.approval_id = decision.approval_id;
  if (decision.approval_id) r.authority.approvals.find(a => a.approval_id === decision.approval_id).consumed_by_attempt_id = attemptId;
  task.status = 'running'; q.status = 'leased'; q.lease_expires_at = attempt.lease_expires_at;
  delete r.pending_attempts[taskId]; r.active_attempts[taskId] = {attempt,dispatch_revision:increment(r.run.revision)};
  operation.state = 'dispatched'; operation.attempt_id = attemptId;
  const dispatch = DispatchRecord.assert({run_id:c.run_id,incarnation_id:c.incarnation_id,owner_id:c.lease.owner_id,generation:c.lease.generation,task_id:taskId,task_revision:task.task_revision ?? 0,queue_id:q.queue_id,attempt_id:attemptId,operation_id:operation.operation_id,authority_revision:r.authority.authority_revision,dispatch_revision:increment(r.run.revision),task_lease_expires_at:attempt.lease_expires_at,owner_lease_expires_at:c.lease.expires_at,idempotency_key:JSON.stringify(['chord.effect.v1',c.incarnation_id,c.run_id,operation.operation_id]),state:'dispatched'});
  c.attempts[attemptId] = dispatch; r.run.revision = increment(r.run.revision);
  return {registry:r,coordination:c,dispatch};
}
export function claimCandidate(current, change, at, finalNow) {
  if (change.dispatch === null) {
    const registry = clonePlainData(current.registry), coordination = clonePlainData(current.coordination);
    registry.run.revision = increment(registry.run.revision);
    requireTrue(sameData(registry,change.nextRegistry),'INVALID_SEMANTICS');
    coordination.logical_now = finalNow;
    return {registry,coordination,evidence:ClaimEvidence.assert({kind:'claim',attempt_id:null,generation:coordination.lease.generation}),result:{dispatch:null}};
  }
  const d = DispatchRecord.assert(change.dispatch), plannedAt = d.task_lease_expires_at - 30000;
  requireTrue(Number.isSafeInteger(plannedAt) && plannedAt >= current.coordination.logical_now && plannedAt <= at && finalNow < d.task_lease_expires_at,'STALE_ATTEMPT');
  const planned = planClaim(current,d.task_id,d.attempt_id,plannedAt);
  requireTrue(sameData(planned.dispatch,d) && sameData(planned.registry,change.nextRegistry),'STALE_ATTEMPT');
  dispatchDecision(planned,d,finalNow);
  planned.coordination.logical_now = finalNow;
  return {...planned,evidence:ClaimEvidence.assert({kind:'claim',attempt_id:d.attempt_id,generation:d.generation}),result:{dispatch:d}};
}
function uncertain(r,c,d) {
  const task = r.tasks[d.task_id], q = r.task_queue.find(q => q.queue_id === d.queue_id);
  task.status = 'uncertain'; q.status = 'uncertain'; q.lease_expires_at = null;
  r.operations[d.operation_id].state = 'unknown'; delete r.active_attempts[d.task_id]; delete r.pending_attempts[d.task_id]; c.attempts[d.attempt_id].state = 'quarantined';
}
export function outcomeCandidate(current, change, at, finalNow) {
  // No diagnostics/candidates before this fence, for BOTH successful and thrown calls.
  const {d} = assertAttempt(current,change.dispatch);
  requireTrue((change.adapter_result === null) !== (change.error_code === null),'INVALID_CONTEXT');
  const r = clonePlainData(current.registry), c = clonePlainData(current.coordination);
  let allowed = true;
  try { dispatchDecision(current,d,finalNow); } catch { allowed = false; }
  let classification = 'uncertain', result = null;
  if (!allowed || change.error_code !== null) uncertain(r,c,d);
  else {
    const raw = AdapterResult.assert(change.adapter_result);
    requireTrue(raw.task_id === undefined || raw.task_id === d.task_id,'INVALID_RESULT');
    result = Outcome.assert({...raw,task_id:d.task_id,run_id:d.run_id,schema_version:r.run.schema_version,task_revision:d.task_revision,queue_id:d.queue_id,attempt_id:d.attempt_id});
    const task = r.tasks[d.task_id], q = r.task_queue.find(q => q.queue_id === d.queue_id);
    requireTrue(canTaskTransition(task.status,result.status),'INVALID_TRANSITION');
    task.status = result.status; task.last_result = result; r.execution_results.push(result); q.status = result.status;
    const artifact = result.artifact && r.artifacts[result.artifact];
    if (artifact) { const next = result.outcome === 'succeeded' ? 'accepted' : 'rejected'; requireTrue(canArtifactTransition(artifact.status,next),'INVALID_TRANSITION'); if (artifact.status !== next) { artifact.history.push({from:artifact.status,to:next,at}); artifact.status = next; } }
    const domain = result.domain && r.domains[result.domain];
    if (domain) { const next = result.outcome === 'succeeded' ? 'complete' : 'blocked'; requireTrue(canDomainTransition(domain.state,next),'INVALID_TRANSITION'); if (domain.state !== next) { domain.state = next; domain.state_history.push({to:next,at}); } }
    delete r.active_attempts[d.task_id]; delete r.pending_attempts[d.task_id]; c.attempts[d.attempt_id].state = 'completed';
    r.operations[d.operation_id].state = result.status === 'completed' ? 'confirmed' : 'unknown'; classification = 'result';
  }
  c.logical_now = finalNow;
  return {registry:r,coordination:c,evidence:OutcomeEvidence.assert({kind:'outcome',attempt_id:d.attempt_id,generation:d.generation,classification}),result:{task_id:d.task_id,attempt_id:d.attempt_id,classification}};
}
export function replayRuntime(current,nextDomain,nextC,record) {
  if (record.operation === 'runtime_claim') {
    ClaimEvidence.assert(record.evidence);
    const d = record.evidence.attempt_id === null ? null : nextC.attempts[record.evidence.attempt_id];
    return claimCandidate(current,{dispatch:d,nextRegistry:{...nextDomain,event_journal:current.registry.event_journal}},record.at,nextC.logical_now);
  }
  OutcomeEvidence.assert(record.evidence);
  const d = current.coordination.attempts[record.evidence.attempt_id];
  let adapter_result = null;
  if (record.evidence.classification === 'result') {
    const {run_id,schema_version,task_revision,queue_id,attempt_id,...raw} = nextDomain.tasks[d.task_id].last_result;
    adapter_result = raw;
  }
  return outcomeCandidate(current,{dispatch:d,adapter_result,error_code:adapter_result ? null : 'ADAPTER_ERROR'},record.at,nextC.logical_now);
}
