import { clonePlainData } from '../contracts/sigils.js';
import { canonicalProjection, sameData, stateChanges, HISTORY_VERSION } from '../platform/history.js';
import { validateNext } from '../storage/contract.js';
import { CoordinationState, CoordinationPolicy, PROTOCOL_VERSION, increment, deadline, requireTrue, fail, ADMIN_OPERATIONS } from './contracts.js';
import { evaluateAuthority } from '../platform/authorization.js';
import { validatePolicy } from './command-authorization.js';

export const vacantLease = generation => ({generation, owner_id:null, acquired_at:null, renewed_at:null, expires_at:null});
export const identityOf = c => ({run_id:c.run_id, incarnation_id:c.incarnation_id});
export function genesisState(identity, now) {
  return CoordinationState.assert({protocol_version:PROTOCOL_VERSION, ...identity, logical_now:now, lease:vacantLease(0), policy:{policy_revision:0,handoffs:[],approvals:[]}, attempts:{},commands:{},handoffs:{},approval_requests:{}});
}
export function assertOwner(c, credential, now) {
  requireTrue(credential !== null, 'NOT_OWNER');
  requireTrue(credential.run_id === c.run_id, 'RUN_MISMATCH');
  requireTrue(credential.incarnation_id === c.incarnation_id, 'INCARNATION_MISMATCH');
  requireTrue(c.lease.owner_id === credential.owner_id && c.lease.generation === credential.generation, 'OWNER_LOST');
  requireTrue(now < c.lease.expires_at, 'LEASE_EXPIRED');
}
// Pure equivalent of markTaskUncertain's state transition. The existing helper
// mints IDs and calls Date.now; neither belongs in a replay/locked reducer.
export function quarantine(registry, coordination) {
  const ids = [];
  for (const task of Object.values(registry.tasks)) {
    if (!['running','leased'].includes(task.status)) continue;
    task.status = 'uncertain';
    const operation = task.operation_id && registry.operations?.[task.operation_id];
    if (operation) operation.state = 'unknown';
    const q = registry.task_queue.find(q => q.task_id === task.task_id);
    if (q && ['leased','running'].includes(q.status)) { q.status = 'uncertain'; q.lease_expires_at = null; }
    delete registry.active_attempts[task.task_id]; delete registry.pending_attempts[task.task_id];
  }
  for (const d of Object.values(coordination.attempts)) if (d.state === 'dispatched') { d.state = 'quarantined'; ids.push(d.attempt_id); }
  return ids.sort();
}
export function lifecycle(current, change, at, finalNow) {
  const registry = clonePlainData(current.registry), coordination = clonePlainData(current.coordination);
  const before = clonePlainData(coordination.lease), action = change.kind;
  requireTrue(finalNow >= at && at >= coordination.logical_now, 'CLOCK_ROLLBACK');
  let quarantined = [];
  if (action === 'acquire') {
    requireTrue(before.owner_id === null || at >= before.expires_at, 'OWNER_HELD');
    const generation = increment(before.generation, 'GENERATION_EXHAUSTED');
    coordination.lease = {generation,owner_id:change.owner_id,acquired_at:at,renewed_at:at,expires_at:deadline(at)};
    requireTrue(finalNow < coordination.lease.expires_at, 'LEASE_EXPIRED');
    quarantined = quarantine(registry, coordination);
  } else {
    requireTrue(before.owner_id !== null && finalNow < before.expires_at, 'LEASE_EXPIRED');
    if (action === 'renew') {
      const expiry = deadline(at);
      requireTrue(expiry > before.expires_at, 'LEASE_NOT_EXTENDED');
      requireTrue(finalNow < expiry, 'LEASE_EXPIRED');
      coordination.lease = {...before,renewed_at:at,expires_at:expiry};
    } else if (action === 'release') {
      quarantined = quarantine(registry, coordination); coordination.lease = vacantLease(before.generation);
    } else fail('UNSUPPORTED_OPERATION');
  }
  coordination.logical_now = finalNow;
  return {registry,coordination,evidence:{kind:'lease',action,before,after:clonePlainData(coordination.lease),quarantined_attempt_ids:quarantined}};
}
export function adminCandidate(current, change, finalNow) {
  requireTrue(ADMIN_OPERATIONS.includes(change.operation), 'UNSUPPORTED_OPERATION');
  requireTrue(change.operation === 'coordination_policy' ? change.nextPolicy !== null : change.nextPolicy === null, 'UNSUPPORTED_OPERATION');
  const registry = clonePlainData(change.nextRegistry), coordination = clonePlainData(current.coordination);
  if (change.operation === 'coordination_policy') {
    const policy = CoordinationPolicy.assert(change.nextPolicy);
    validatePolicy(current.registry,coordination.policy,policy);
    const expected = clonePlainData(current.registry); expected.run.revision = increment(expected.run.revision);
    requireTrue(sameData(registry,expected),'INVALID_SEMANTICS');
    coordination.policy = policy;
  }
  {
    for (const task of Object.values(registry.tasks)) if (task.status === 'queued' && ['uncertain','blocked','dead_letter'].includes(current.registry.tasks[task.task_id]?.status)) {
      const old = current.registry.tasks[task.task_id], op = current.registry.operations?.[old?.operation_id];
      requireTrue(old && ['uncertain','blocked','dead_letter'].includes(old.status) && op?.state === 'not_executed' && op.reconciliation_id,'RECONCILIATION_REQUIRED');
      const decision = evaluateAuthority({stage:'admit',now:finalNow,run:registry.run,task,authority:registry.authority}); requireTrue(decision.allowed,decision.code);
    }
  }
  if (change.operation === 'reconcile_effect') {
    for (const [key,record] of Object.entries(registry.reconciliations || {})) if (!Object.hasOwn(current.registry.reconciliations || {},key)) {
      const principal = current.registry.authority?.principals.find(p => p.principal_id === record.principal_id && p.kind === 'human' && p.authenticated_at <= finalNow && finalNow < p.expires_at);
      requireTrue(principal,'PRINCIPAL_INVALID');
      const task = current.registry.tasks[record.task_id];
      const decision = evaluateAuthority({stage:'admit',now:finalNow,run:current.registry.run,task:{...task,status:'queued'},authority:current.registry.authority}); requireTrue(decision.allowed,decision.code);
    }
  }
  const prefixLength = current.registry.event_journal.length;
  requireTrue(sameData(registry.event_journal.slice(0,prefixLength), current.registry.event_journal), 'INVALID_HISTORY');
  requireTrue(registry.event_journal.slice(prefixLength).every(e => !['state_initialized','state_committed'].includes(e.type)), 'INVALID_HISTORY');
  requireTrue(registry.run.revision === increment(current.registry.run.revision), 'STALE_REVISION');
  // Host maintenance cannot manufacture or rewrite an actor-authenticated
  // handoff response through the legacy domain record.
  for (const key of Object.keys(current.coordination.handoffs)) requireTrue(sameData(current.registry.handoffs?.[key],registry.handoffs?.[key]),'FORBIDDEN');
  // Admin may close/cancel an active attempt, never mint or retoken one.
  for (const [key, active] of Object.entries(registry.active_attempts)) requireTrue(Object.hasOwn(current.registry.active_attempts,key) && sameData(active,current.registry.active_attempts[key]), 'STALE_ATTEMPT');
  for (const d of Object.values(coordination.attempts)) if (d.state === 'dispatched' && !Object.hasOwn(registry.active_attempts,d.task_id)) d.state = 'closed';
  coordination.logical_now = finalNow;
  return {registry,coordination,evidence:{kind:'admin',operation:change.operation,audit_label:change.audit_label}};
}
export function closeCandidate(current, candidate, operation, at, eventId) {
  const registry = candidate.registry;
  registry.run.revision = increment(current.registry.run.revision);
  const previous = current.registry.event_journal.at(-1);
  registry.event_journal.push({event_id:eventId,type:'state_committed',at, schema_version:registry.run.schema_version,run_id:registry.run.run_id,run_revision:registry.run.revision,
    payload:{history_version:HISTORY_VERSION,operation,sequence:registry.run.revision,previous_commit_id:previous.event_id,previous_revision:current.registry.run.revision,changes:stateChanges(canonicalProjection(current.registry),canonicalProjection(registry)),diagnostic_ids:registry.event_journal.slice(current.registry.event_journal.length).map(e => e.event_id)}});
  validateNext(current.registry,registry,operation);
  const record = {kind:'commit',protocol_version:PROTOCOL_VERSION,ordinal:registry.run.revision,revision:registry.run.revision,previous_domain_commit_id:previous.event_id,domain_commit_id:eventId,operation,at,changes:stateChanges(current.coordination,candidate.coordination),evidence:candidate.evidence};
  return {registry,coordination:candidate.coordination,coordination_history:[...current.coordination_history,record]};
}
export function crossInvariants(registry, c) {
  requireTrue(registry.run.run_id === c.run_id, 'RUN_MISMATCH');
  for (const task of Object.values(registry.tasks)) if (['running','leased'].includes(task.status)) requireTrue(Object.hasOwn(registry.active_attempts,task.task_id),'STALE_ATTEMPT');
  for (const [key,active] of Object.entries(registry.active_attempts)) {
    const a = active.attempt, d = c.attempts[a.attempt_id], task = registry.tasks[key];
    requireTrue(d && d.state === 'dispatched' && d.task_id === key && d.queue_id === a.queue_id && d.task_revision === a.task_revision && d.task_revision === (task.task_revision ?? 0) && d.dispatch_revision === active.dispatch_revision && d.authority_revision === a.authority_revision && d.task_lease_expires_at === a.lease_expires_at && d.owner_id === c.lease.owner_id && d.generation === c.lease.generation, 'STALE_ATTEMPT');
  }
  for (const d of Object.values(c.attempts)) {
    if (d.state !== 'dispatched') continue;
    const active = registry.active_attempts[d.task_id], operation = registry.operations?.[d.operation_id], queue = registry.task_queue.find(q => q.queue_id === d.queue_id);
    requireTrue(active?.attempt.attempt_id === d.attempt_id && registry.tasks[d.task_id]?.operation_id === d.operation_id && queue?.task_id === d.task_id && queue.status === 'leased' && queue.lease_expires_at === d.task_lease_expires_at && operation?.state === 'dispatched' && operation.attempt_id === d.attempt_id && operation.task_id === d.task_id, 'STALE_ATTEMPT');
  }
}
