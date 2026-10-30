import { clonePlainData, TaskPacket, Approval, Attempt } from '../contracts/sigils.js';
import { projectContext } from '../platform/handoff.js';
import { evaluateAuthority } from '../platform/authorization.js';
import { operationSignature } from '../platform/reconciliation.js';
import { sameData } from '../platform/history.js';
import { requireTrue, increment, subjectOf, receiptKey, SuccessResponse, CommandReceipt, validateCommandResult } from './contracts.js';
import { scopeOf, subjectValid, permission, actorSubject, selectRule, liveTask, ttl, assertBinding } from './command-authorization.js';

const identity = c => ({run_id:c.run_id,incarnation_id:c.incarnation_id});
const own = (o,k) => Object.hasOwn(o || {},k) ? o[k] : null;
const unique = a => [...new Set(a)].sort();
const activeRun = r => requireTrue(['created','active','paused'].includes(r.run.state),'INVALID_TRANSITION');
export const ownerSummary = c => c.lease.owner_id === null ? null : ({owner_id:c.lease.owner_id,generation:c.lease.generation,lease_expires_at:c.lease.expires_at});
export function responseFor(current, command, result, revision, commitId) {
  validateCommandResult(command.type,result);
  return SuccessResponse.assert({protocol_version:'chord.actor-response.v1',operation_id:command.operation_id,correlation_id:command.correlation_id,causation_id:command.causation_id,...identity(current.coordination),ok:true,revision,commit_id:commitId,owner:ownerSummary(current.coordination),result});
}
function handoffPermission(envelope, h, sidecar, binding, now, action = null) {
  const {registry:r,coordination:c} = envelope;
  const task = liveTask(r,sidecar.scope.task_id);
  requireTrue(sameData(scopeOf(r,task),sidecar.scope) && (task.task_revision ?? 0) === sidecar.task_revision,'STALE_ATTEMPT');
  const rule = selectRule(c,'handoffs',h.from_actor_id,h.to_actor_id,sidecar.scope);
  if (action) requireTrue(rule.actions.includes(action),'POLICY_DENIED');
  requireTrue(binding.actor_id === h.from_actor_id || binding.actor_id === h.to_actor_id,'FORBIDDEN');
  if (binding.actor_id === h.from_actor_id) requireTrue(binding.principal_id === sidecar.sender.principal_id && binding.issuer === sidecar.sender.issuer,'FORBIDDEN');
  const recipient = actorSubject(r,h.to_actor_id,identity(c));
  const grants = [...permission(r,sidecar.sender,task,'chord.handoff.propose',now),...permission(r,recipient,task,'chord.handoff.respond',now)];
  return {task,rule,grants};
}
function approvalPermission(envelope, request, binding, now) {
  const {registry:r,coordination:c} = envelope, task = liveTask(r,request.task_id);
  const rule = selectRule(c,'approvals',request.requester.actor_id,null,scopeOf(r,task));
  const approver = actorSubject(r,rule.approver_actor_id,identity(c));
  requireTrue(binding.actor_id === request.requester.actor_id && binding.principal_id === request.requester.principal_id && binding.issuer === request.requester.issuer || binding.actor_id === approver.actor_id && binding.principal_id === approver.principal_id,'FORBIDDEN');
  const grants = [...permission(r,request.requester,task,'chord.approval.request',now),...permission(r,approver,task,'chord.approval.respond',now)];
  return {task,rule,approver,grants};
}
function handoffVisible(envelope,h,sidecar,binding,now) {
  const {registry:r,coordination:c} = envelope, task = liveTask(r,sidecar.scope.task_id);
  selectRule(c,'handoffs',h.from_actor_id,h.to_actor_id,sidecar.scope);
  if (binding.actor_id === h.from_actor_id) {
    requireTrue(binding.principal_id === sidecar.sender.principal_id && binding.issuer === sidecar.sender.issuer,'FORBIDDEN');
    permission(r,binding,task,'chord.handoff.propose',now);
  } else { requireTrue(binding.actor_id === h.to_actor_id,'FORBIDDEN'); permission(r,binding,task,'chord.handoff.respond',now); }
}
function approvalVisible(envelope,request,binding,now) {
  const {registry:r,coordination:c} = envelope, task = liveTask(r,request.task_id);
  const rule = selectRule(c,'approvals',request.requester.actor_id,null,scopeOf(r,task));
  if (binding.actor_id === request.requester.actor_id) {
    requireTrue(binding.principal_id === request.requester.principal_id && binding.issuer === request.requester.issuer,'FORBIDDEN');
    permission(r,binding,task,'chord.approval.request',now);
  } else { requireTrue(binding.actor_id === rule.approver_actor_id && subjectValid(r,binding,now).principal.kind === 'human','FORBIDDEN'); permission(r,binding,task,'chord.approval.respond',now); }
}
export function assertReceiptVisible(envelope, binding, command, receipt, now) {
  if (command.type === 'submit_work') {
    for (const taskId of receipt.response.result.task_ids) { const task = liveTask(envelope.registry,taskId); permission(envelope.registry,binding,task,task.authority_binding.capability,now); }
  } else if (['propose_handoff','respond_handoff'].includes(command.type)) {
    const hId = receipt.response.result.handoff_id;
    handoffVisible(envelope,own(envelope.registry.handoffs,hId),own(envelope.coordination.handoffs,hId),binding,now);
  } else {
    const request = own(envelope.coordination.approval_requests,receipt.response.result.approval_request_id);
    approvalVisible(envelope,request,binding,now);
  }
}
export function duplicateReceipt(envelope,binding,command,now) {
  assertBinding(envelope,binding,command,now);
  const receipt = own(envelope.coordination.commands,receiptKey(subjectOf(binding),command.operation_id));
  if (!receipt) return null;
  requireTrue(sameData(receipt.command,command),'OPERATION_ID_MISMATCH');
  assertReceiptVisible(envelope,binding,command,receipt,now); return receipt.response;
}

/** Pure authorized transition. All IDs derive from the shell-preallocated commit
 * UUID. No ambient clock, random IDs, callbacks, adapters or hidden revisions. */
export function commandCandidate(current,binding,command,at,finalNow,eventId) {
  assertBinding(current,binding,command,finalNow);
  requireTrue(command.expected_revision === current.registry.run.revision,'STALE_REVISION');
  const registry = clonePlainData(current.registry), coordination = clonePlainData(current.coordination), r = registry, c = coordination, p = command.payload, subject = subjectOf(binding);
  const envelope = {registry:r,coordination:c};
  const grants = []; let ruleId = null, result;
  const newId = (kind,index = 0) => {
    const value = `${kind}_${eventId}_${index}`;
    // The complete journal/coordination envelope contains every prior allocated
    // identifier. New UUID reuse cannot silently overwrite any historical fact.
    requireTrue(!JSON.stringify(current).includes(JSON.stringify(value)),'INVALID_SEMANTICS'); return value;
  };
  if (command.type === 'submit_work') {
    activeRun(r); const seen = new Set(), signatures = new Set([...Object.values(r.operations || {}).map(o => o.signature),...Object.values(r.tasks).map(operationSignature)]);
    for (const [i,raw] of p.packets.entries()) {
      const packet = TaskPacket.assert(raw); requireTrue(!seen.has(packet.task_id) && !own(r.tasks,packet.task_id),'INVALID_SEMANTICS'); seen.add(packet.task_id);
      const authority_binding = {principal_id:binding.principal_id,actor_id:binding.actor_id,capability:binding.work_capability,scope:scopeOf(r,packet),approval_required:binding.work_requires_approval};
      const task = {...packet,authority_binding,status:'queued',created_at:at,retry_count:0};
      grants.push(...permission(r,binding,task,binding.work_capability,finalNow));
      const signature = operationSignature(packet); requireTrue(!signatures.has(signature),'OPERATION_EXISTS'); signatures.add(signature);
      const operation_id = newId('operation',i); task.operation_id = operation_id; r.tasks[packet.task_id] = task;
      r.operations ||= {}; r.operations[operation_id] = {operation_id,signature,task_id:packet.task_id,state:'requested',attempt_id:null,reconciliation_id:null};
      r.task_queue.push({queue_id:newId('queue',i),task_id:packet.task_id,target_entity:packet.target_entity,status:'queued',priority:0,available_at:at,lease_expires_at:null,max_attempts:3,retry_count:0,last_error:null});
    }
    result = {task_ids:p.packets.map(t => t.task_id)};
  } else if (command.type === 'propose_handoff') {
    activeRun(r); const task = liveTask(r,p.task_id); requireTrue(!['cancelled','completed','failed','dead_letter','uncertain'].includes(task.status),'INVALID_TRANSITION');
    const scope = scopeOf(r,task), recipient = actorSubject(r,p.to_actor_id,identity(c));
    const rule = selectRule(c,'handoffs',binding.actor_id,p.to_actor_id,scope); ruleId = rule.rule_id;
    grants.push(...permission(r,binding,task,'chord.handoff.propose',finalNow),...permission(r,recipient,task,'chord.handoff.respond',finalNow));
    ttl(at,p.expires_at,rule,'HANDOFF_EXPIRED'); requireTrue(finalNow < p.expires_at,'HANDOFF_EXPIRED');
    const handoff_id = newId('handoff'); r.handoffs ||= {};
    r.handoffs[handoff_id] = {handoff_id,run_id:c.run_id,from_actor_id:binding.actor_id,to_actor_id:p.to_actor_id,correlation_id:command.correlation_id,causation_id:command.causation_id,expected_revision:command.expected_revision,payload:p.payload,expires_at:p.expires_at,status:'proposed',created_at:at};
    c.handoffs[handoff_id] = {handoff_id,scope,task_revision:task.task_revision ?? 0,rule_id:rule.rule_id,policy_revision:c.policy.policy_revision,sender:subject,recipient_actor_id:p.to_actor_id,proposal_operation_id:command.operation_id,response_operation_id:null,response_subject:null,proposal_authority_revision:r.authority.authority_revision,response_authority_revision:null};
    result = {handoff_id};
  } else if (command.type === 'respond_handoff') {
    const h = own(r.handoffs,p.handoff_id), sidecar = own(c.handoffs,p.handoff_id);
    requireTrue(h && sidecar && h.to_actor_id === binding.actor_id,'FORBIDDEN');
    const auth = handoffPermission(envelope,h,sidecar,binding,finalNow,p.action); grants.push(...auth.grants); ruleId = auth.rule.rule_id;
    requireTrue(sidecar.policy_revision === c.policy.policy_revision && sidecar.rule_id === ruleId,'POLICY_STALE');
    requireTrue(h.status === 'proposed','HANDOFF_RESOLVED'); requireTrue(finalNow < h.expires_at,'HANDOFF_EXPIRED'); activeRun(r);
    h.status = p.action === 'accept' ? 'accepted' : 'rejected'; h.responded_at = at; h.responded_by = binding.actor_id; h.reason = p.reason;
    sidecar.response_subject = subject; sidecar.response_operation_id = command.operation_id; sidecar.response_authority_revision = r.authority.authority_revision;
    result = {handoff_id:h.handoff_id,status:h.status};
  } else if (command.type === 'request_approval') {
    activeRun(r); const task = liveTask(r,p.task_id);
    requireTrue(task.status === 'queued','INVALID_TRANSITION'); requireTrue(task.authority_binding.actor_id === binding.actor_id && task.authority_binding.principal_id === binding.principal_id,'FORBIDDEN');
    grants.push(...permission(r,binding,task,'chord.approval.request',finalNow));
    const rule = selectRule(c,'approvals',binding.actor_id,null,scopeOf(r,task)); ruleId = rule.rule_id;
    const approver = actorSubject(r,rule.approver_actor_id,identity(c));
    requireTrue(subjectValid(r,approver,finalNow).principal.kind === 'human' && approver.principal_id !== binding.principal_id,'FORBIDDEN');
    grants.push(...permission(r,approver,task,'chord.approval.respond',finalNow));
    ttl(at,p.expires_at,rule,'APPROVAL_REQUEST_EXPIRED'); requireTrue(finalNow < p.expires_at,'APPROVAL_REQUEST_EXPIRED');
    requireTrue(!Object.values(c.approval_requests).some(x => x.task_id === task.task_id && x.status === 'pending' && x.policy_revision === c.policy.policy_revision),'APPROVAL_REQUEST_EXISTS');
    const queue = r.task_queue.find(q => q.task_id === task.task_id); requireTrue(queue,'STALE_ATTEMPT');
    const attempt = own(r.pending_attempts,task.task_id) || Attempt.assert({run_id:c.run_id,schema_version:r.run.schema_version,task_id:task.task_id,task_revision:task.task_revision ?? 0,queue_id:queue.queue_id,attempt_id:newId('attempt'),lease_expires_at:0,authority_revision:r.authority.authority_revision,grant_ids:[],approval_id:null});
    requireTrue(attempt.task_revision === (task.task_revision ?? 0),'STALE_ATTEMPT');
    r.pending_attempts[task.task_id] = attempt;
    const approval_request_id = newId('approval_request');
    c.approval_requests[approval_request_id] = {approval_request_id,task_id:task.task_id,task_revision:task.task_revision ?? 0,attempt_id:attempt.attempt_id,requester:subject,rule_id:ruleId,policy_revision:c.policy.policy_revision,created_at:at,expires_at:p.expires_at,reason:p.reason,status:'pending',approval_id:null,response_operation_id:null,response_subject:null};
    if (r.run.state !== 'paused') { r.run.state = 'paused'; r.approval_pause = {reason:p.reason,expires_at:p.expires_at,paused_at:at}; }
    else r.approval_pause = {...r.approval_pause,expires_at:Math.min(r.approval_pause?.expires_at ?? p.expires_at,p.expires_at)};
    result = {approval_request_id,attempt_id:attempt.attempt_id};
  } else if (command.type === 'respond_approval') {
    const request = own(c.approval_requests,p.approval_request_id); requireTrue(request,'FORBIDDEN');
    const auth = approvalPermission(envelope,request,binding,finalNow), {task,rule,approver} = auth;
    requireTrue(binding.actor_id === approver.actor_id && subjectValid(r,binding,finalNow).principal.kind === 'human' && binding.principal_id !== request.requester.principal_id,'FORBIDDEN');
    ruleId = rule.rule_id; grants.push(...auth.grants);
    requireTrue(request.policy_revision === c.policy.policy_revision && request.rule_id === ruleId,'POLICY_STALE');
    requireTrue(request.status === 'pending','APPROVAL_REQUEST_RESOLVED'); requireTrue(finalNow < request.expires_at,'APPROVAL_REQUEST_EXPIRED');
    requireTrue(r.run.state === 'paused' && task.status === 'queued' && (task.task_revision ?? 0) === request.task_revision && own(r.pending_attempts,task.task_id)?.attempt_id === request.attempt_id && own(r.pending_attempts,task.task_id).task_revision === request.task_revision,'STALE_ATTEMPT');
    const approval_id = newId('approval'), b = task.authority_binding;
    const approval = Approval.assert({approval_id,approver_principal_id:binding.principal_id,decision:p.decision === 'approve' ? 'approved' : 'rejected',run_id:c.run_id,schema_version:r.run.schema_version,task_id:task.task_id,task_revision:request.task_revision,attempt_id:request.attempt_id,principal_id:b.principal_id,actor_id:b.actor_id,capability:b.capability,scope:b.scope,issued_at:at,expires_at:Math.min(request.expires_at,at + rule.max_ttl_ms),revoked_at:null,consumed_by_attempt_id:null});
    r.authority.authority_revision = increment(r.authority.authority_revision); r.authority.approvals.push(approval);
    request.status = approval.decision; request.approval_id = approval_id; request.response_operation_id = command.operation_id; request.response_subject = subject;
    if (p.decision === 'reject') { r.run.state = 'failed'; r.approval_pause = null; }
    else {
      const ready = Object.values(r.tasks).filter(t => t.status === 'queued').every(t => {
        const d = evaluateAuthority({stage:'dispatch',now:finalNow,run:r.run,task:t,attempt:own(r.pending_attempts,t.task_id),authority:r.authority});
        if (!d.allowed) return false;
        if (d.approval_id === null) return true;
        const a = r.authority.approvals.find(a => a.approval_id === d.approval_id);
        const ar = Object.values(c.approval_requests).find(x => x.approval_id === a.approval_id && x.status === 'approved');
        if (!ar) return false;
        try { const x = approvalPermission(envelope,ar,ar.response_subject,finalNow); return ar.policy_revision === c.policy.policy_revision && x.approver.principal_id === a.approver_principal_id && subjectValid(r,ar.response_subject,finalNow).principal.kind === 'human'; } catch { return false; }
      });
      if (ready) { requireTrue(r.approval_pause?.expires_at === null || finalNow < r.approval_pause.expires_at,'APPROVAL_REQUEST_EXPIRED'); r.run.state = 'active'; r.approval_pause = null; }
    }
    result = {approval_request_id:request.approval_request_id,status:request.status,approval_id,run_state:r.run.state};
  } else requireTrue(false,'INVALID_COMMAND');
  c.logical_now = finalNow;
  const receipt_key = receiptKey(subject,command.operation_id), response = responseFor(current,command,result,increment(r.run.revision),eventId);
  c.commands[receipt_key] = CommandReceipt.assert({receipt_key,binding_subject:subject,command,response});
  return {registry:r,coordination:c,evidence:{kind:'command',receipt_key,subject,command_type:command.type,authority_revision:current.registry.authority.authority_revision,policy_revision:c.policy.policy_revision,rule_id:ruleId,grant_ids:unique(grants)},result:response};
}

export function readCommand(snapshot,binding,command,now) {
  const e = snapshot.envelope, r = e.registry, c = e.coordination;
  assertBinding(e,binding,command,now);
  if (command.expected_revision !== null) requireTrue(command.expected_revision === snapshot.revision,'STALE_REVISION');
  const handoffs = [], approval_requests = [];
  for (const sidecar of Object.values(c.handoffs)) try {
    const h = r.handoffs[sidecar.handoff_id]; handoffVisible(e,h,sidecar,binding,now);
    handoffs.push({handoff_id:h.handoff_id,task_id:sidecar.scope.task_id,from_actor_id:h.from_actor_id,to_actor_id:h.to_actor_id,status:h.status,payload:h.payload,expires_at:h.expires_at});
  } catch {}
  for (const request of Object.values(c.approval_requests)) try {
    approvalVisible(e,request,binding,now);
    approval_requests.push({approval_request_id:request.approval_request_id,task_id:request.task_id,attempt_id:request.attempt_id,requesting_actor_id:request.requester.actor_id,status:request.status,reason:request.reason,expires_at:request.expires_at});
  } catch {}
  const context = projectContext(r,{actor_id:binding.actor_id,principal_id:binding.principal_id,correlation_id:command.correlation_id,now});
  let result;
  if (command.type === 'project_context') result = {context,handoffs:handoffs.slice(0,100),approval_requests:approval_requests.slice(0,100)};
  else {
    requireTrue(command.type === 'observe_outcomes','INVALID_COMMAND');
    const outcomes = [];
    for (const taskId of command.payload.task_ids) {
      // Outcomes filter each requested scope, not the first 100 tasks selected
      // for a separate context page.
      let taskVisible = false;
      const task = own(r.tasks,taskId);
      if (task) try { permission(r,binding,task,task.authority_binding.capability,now); taskVisible = true; } catch {}
      const hs = handoffs.filter(h => h.task_id === taskId).slice(0,100).map(h => ({handoff_id:h.handoff_id,status:h.status}));
      const ars = approval_requests.filter(a => a.task_id === taskId).slice(0,100).map(a => ({approval_request_id:a.approval_request_id,status:a.status}));
      if (!taskVisible && !hs.length && !ars.length) continue;
      const out = {task_id:taskId,handoffs:hs,approval_requests:ars};
      if (taskVisible) { out.status = task.status; out.last_result = task.last_result || null; out.operation_state = r.operations?.[task.operation_id]?.state || null; }
      outcomes.push(out);
    }
    result = {outcomes};
  }
  return responseFor(e,command,result,snapshot.revision,snapshot.commitId);
}

/** Reconstruct the pure command from its durable receipt. Authentication itself
 * is an external host attestation, never inferred or re-issued by replay. */
export function replayCommand(current,nextDomain,nextC,record) {
  const receipt = own(nextC.commands,record.evidence.receipt_key); requireTrue(receipt && !own(current.coordination.commands,record.evidence.receipt_key),'INVALID_HISTORY');
  const subject = receipt.binding_subject;
  const first = receipt.command.type === 'submit_work' ? nextDomain.tasks[receipt.command.payload.packets[0].task_id] : null;
  const binding = {...subject,authenticated_at:record.at,expires_at:Number.MAX_SAFE_INTEGER,work_capability:first?.authority_binding.capability || 'unused',work_requires_approval:first?.authority_binding.approval_required || false};
  return commandCandidate(current,binding,receipt.command,record.at,nextC.logical_now,record.domain_commit_id);
}
