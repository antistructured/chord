import { Sigil } from '@weipertda/sigiljs';
import { clonePlainData, RegistryData, Scope, TaskPacket, ContextProjection, AdapterResult } from '../contracts/sigils.js';

export const STORAGE_VERSION = 'chord.local-store.v2';
export const PROTOCOL_VERSION = 'chord.coordination.v1';
export const OWNER_LEASE_MS = 30_000;
export class CoordinationError extends TypeError {
  constructor(code, commitStatus = 'not_committed') {
    super(code); this.name = 'CoordinationError'; this.code = code; this.path = '$'; this.commitStatus = commitStatus;
  }
}
export const fail = code => { throw new CoordinationError(code); };
export const requireTrue = (condition, code = 'INVALID_SEMANTICS') => { if (!condition) fail(code); };
export const uint = value => { requireTrue(Number.isSafeInteger(value) && value >= 0, 'INVALID_CONTEXT'); return value; };
export const increment = (value, code = 'REVISION_EXHAUSTED') => { uint(value); requireTrue(value < Number.MAX_SAFE_INTEGER, code); return value + 1; };
export const deadline = now => { uint(now); requireTrue(now <= Number.MAX_SAFE_INTEGER - OWNER_LEASE_MS, 'REVISION_EXHAUSTED'); return now + OWNER_LEASE_MS; };
export const uuid = value => requireTrue(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value), 'INVALID_CONTEXT');
export const id = value => requireTrue(typeof value === 'string' && value.length > 0 && value.length <= 256 && value.trim() === value && !/[\u0000-\u001f\u007f*]/u.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value), 'INVALID_CONTEXT');
export function contract(shape, semantic = () => {}) {
  const schema = Sigil.exact`${shape}`.version(PROTOCOL_VERSION);
  return Object.freeze({ schema, assert(value) {
    const copy = clonePlainData(value);
    requireTrue(schema.check(copy), 'INVALID_SHAPE'); semantic(copy); return copy;
  } });
}
const leaseShape = '{ generation: number, owner_id: string | null, acquired_at: number | null, renewed_at: number | null, expires_at: number | null }';
export const LeaseRecord = contract(leaseShape, v => {
  uint(v.generation);
  if (v.owner_id === null) requireTrue(v.acquired_at === null && v.renewed_at === null && v.expires_at === null);
  else { uuid(v.owner_id); [v.acquired_at, v.renewed_at, v.expires_at].forEach(uint); requireTrue(v.generation > 0 && v.acquired_at <= v.renewed_at && v.renewed_at < v.expires_at); }
});
export const Identity = contract('{ run_id: string, incarnation_id: string }', v => { id(v.run_id); uuid(v.incarnation_id); });
export const OwnerCredential = contract('{ run_id: string, incarnation_id: string, owner_id: string, generation: number }', v => { Identity.assert({run_id:v.run_id, incarnation_id:v.incarnation_id}); uuid(v.owner_id); uint(v.generation); requireTrue(v.generation > 0); });
export const DispatchRecord = contract('{ run_id: string, incarnation_id: string, owner_id: string, generation: number, task_id: string, task_revision: number, queue_id: string, attempt_id: string, operation_id: string, authority_revision: number, dispatch_revision: number, task_lease_expires_at: number, owner_lease_expires_at: number, idempotency_key: string, state: "dispatched" | "completed" | "quarantined" | "closed" }', v => {
  OwnerCredential.assert({run_id:v.run_id, incarnation_id:v.incarnation_id, owner_id:v.owner_id, generation:v.generation});
  ['task_id','queue_id','attempt_id','operation_id'].forEach(k => id(v[k]));
  ['task_revision','authority_revision','dispatch_revision','task_lease_expires_at','owner_lease_expires_at'].forEach(k => uint(v[k]));
  requireTrue(v.idempotency_key === JSON.stringify(['chord.effect.v1',v.incarnation_id,v.run_id,v.operation_id]) && v.idempotency_key.length <= 2048);
});
const subjectShape = '{ binding_id: string, issuer: string, principal_id: string, actor_id: string, run_id: string, incarnation_id: string }';
export const BindingSubject = contract(subjectShape,v => { ['binding_id','issuer','principal_id','actor_id','run_id'].forEach(k => id(v[k])); uuid(v.incarnation_id); });
export const subjectOf = b => BindingSubject.assert(Object.fromEntries(['binding_id','issuer','principal_id','actor_id','run_id','incarnation_id'].map(k => [k,b[k]])));
export const TrustedBinding = contract('{ binding_id: string, issuer: string, principal_id: string, actor_id: string, run_id: string, incarnation_id: string, authenticated_at: number, expires_at: number, work_capability: string, work_requires_approval: boolean }',v => { subjectOf(v); uint(v.authenticated_at); uint(v.expires_at); requireTrue(v.authenticated_at < v.expires_at); id(v.work_capability); });
const handoffRule = contract('{ rule_id: string, from_actor_id: string, to_actor_id: string, scope: object, actions: string[], max_ttl_ms: number }',v => { ['rule_id','from_actor_id','to_actor_id'].forEach(k => id(v[k])); Scope.assert(v.scope); requireTrue(v.from_actor_id !== v.to_actor_id && v.actions.length > 0 && v.actions.every(a => ['accept','reject'].includes(a)) && new Set(v.actions).size === v.actions.length); uint(v.max_ttl_ms); requireTrue(v.max_ttl_ms >= 1 && v.max_ttl_ms <= OWNER_LEASE_MS); });
const approvalRule = contract('{ rule_id: string, requesting_actor_id: string, approver_actor_id: string, scope: object, max_ttl_ms: number }',v => { ['rule_id','requesting_actor_id','approver_actor_id'].forEach(k => id(v[k])); Scope.assert(v.scope); requireTrue(v.requesting_actor_id !== v.approver_actor_id); uint(v.max_ttl_ms); requireTrue(v.max_ttl_ms >= 1 && v.max_ttl_ms <= OWNER_LEASE_MS); });
export const CoordinationPolicy = contract('{ policy_revision: number, handoffs: object[], approvals: object[] }',v => { uint(v.policy_revision); v.handoffs.forEach(r => handoffRule.assert(r)); v.approvals.forEach(r => approvalRule.assert(r)); const ids = [...v.handoffs,...v.approvals].map(r => r.rule_id); requireTrue(new Set(ids).size === ids.length); if (v.policy_revision === 0) requireTrue(!ids.length); });
export const READ_TYPES = Object.freeze(['project_context','observe_outcomes']);
export const COMMAND_TYPES = Object.freeze(['submit_work','project_context','propose_handoff','respond_handoff','request_approval','respond_approval','observe_outcomes']);
const payloadContracts = {
  submit_work:contract('{ packets: object[] }',v => { requireTrue(v.packets.length > 0); v.packets.forEach(p => TaskPacket.assert(p)); }),
  project_context:contract('{}'),
  propose_handoff:contract('{ task_id: string, to_actor_id: string, payload: object, expires_at: number }',v => { id(v.task_id); id(v.to_actor_id); uint(v.expires_at); }),
  respond_handoff:contract('{ handoff_id: string, action: "accept" | "reject", reason: string | null }',v => id(v.handoff_id)),
  request_approval:contract('{ task_id: string, reason: string, expires_at: number }',v => { id(v.task_id); uint(v.expires_at); requireTrue(v.reason.trim().length > 0); }),
  respond_approval:contract('{ approval_request_id: string, decision: "approve" | "reject", reason: string | null }',v => id(v.approval_request_id)),
  observe_outcomes:contract('{ task_ids: string[] }',v => { requireTrue(v.task_ids.length <= 100 && new Set(v.task_ids).size === v.task_ids.length); v.task_ids.forEach(id); })
};
export const ActorCommand = contract('{ protocol_version: string, operation_id: string, run_id: string, incarnation_id: string, expected_revision: number | null, correlation_id: string | null, causation_id: string | null, type: string, payload: object }',v => {
  requireTrue(v.protocol_version === 'chord.actor-command.v1','UNSUPPORTED_PROTOCOL'); id(v.operation_id); id(v.run_id); uuid(v.incarnation_id); for (const k of ['correlation_id','causation_id']) if (v[k] !== null) id(v[k]); requireTrue(COMMAND_TYPES.includes(v.type),'INVALID_COMMAND');
  if (v.expected_revision !== null) uint(v.expected_revision); else requireTrue(READ_TYPES.includes(v.type),'INVALID_COMMAND'); payloadContracts[v.type].assert(v.payload);
});
export function canonicalJSON(value) { const sorted = v => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k,sorted(v[k])])) : v; return JSON.stringify(sorted(clonePlainData(value))); }
export function receiptKey(subject, operationId) { BindingSubject.assert(subject); id(operationId); const key = JSON.stringify([subject.issuer,subject.binding_id,subject.principal_id,subject.actor_id,subject.run_id,subject.incarnation_id,operationId]); requireTrue(key.length <= 2048,'LIMIT_EXCEEDED'); return key; }
const resultContracts = {
  submit_work:contract('{ task_ids: string[] }',v => { requireTrue(v.task_ids.length > 0); v.task_ids.forEach(id); }),
  propose_handoff:contract('{ handoff_id: string }',v => id(v.handoff_id)),
  respond_handoff:contract('{ handoff_id: string, status: "accepted" | "rejected" }',v => id(v.handoff_id)),
  request_approval:contract('{ approval_request_id: string, attempt_id: string }',v => { id(v.approval_request_id); id(v.attempt_id); }),
  respond_approval:contract('{ approval_request_id: string, status: "approved" | "rejected", approval_id: string | null, run_state: string }',v => { id(v.approval_request_id); if (v.approval_id !== null) id(v.approval_id); requireTrue(['paused','active','failed'].includes(v.run_state)); }),
  project_context:contract('{ context: object, handoffs: object[], approval_requests: object[] }',v => { ContextProjection.assert(v.context); requireTrue(v.handoffs.length <= 100 && v.approval_requests.length <= 100); v.handoffs.forEach(x => VisibleHandoff.assert(x)); v.approval_requests.forEach(x => VisibleApprovalRequest.assert(x)); }),
  observe_outcomes:contract('{ outcomes: object[] }',v => { requireTrue(v.outcomes.length <= 100); v.outcomes.forEach(x => contract('{ task_id: string, status?: string, last_result?: object | null, operation_state?: string | null, handoffs: { handoff_id: string, status: "proposed" | "accepted" | "rejected" }[], approval_requests: { approval_request_id: string, status: "pending" | "approved" | "rejected" }[] }',v => id(v.task_id)).assert(x)); })
};
export const validateCommandResult = (type,value) => { requireTrue(Object.hasOwn(resultContracts,type),'INVALID_COMMAND'); return resultContracts[type].assert(value); };
export const VisibleHandoff = contract('{ handoff_id: string, task_id: string, from_actor_id: string, to_actor_id: string, status: "proposed" | "accepted" | "rejected", payload: object, expires_at: number }',v => { ['handoff_id','task_id','from_actor_id','to_actor_id'].forEach(k => id(v[k])); uint(v.expires_at); });
export const VisibleApprovalRequest = contract('{ approval_request_id: string, task_id: string, attempt_id: string, requesting_actor_id: string, status: "pending" | "approved" | "rejected", reason: string, expires_at: number }',v => { ['approval_request_id','task_id','attempt_id','requesting_actor_id'].forEach(k => id(v[k])); uint(v.expires_at); });
export const SuccessResponse = contract('{ protocol_version: "chord.actor-response.v1", operation_id: string, correlation_id: string | null, causation_id: string | null, run_id: string, incarnation_id: string, ok: true, revision: number, commit_id: string, owner: { owner_id: string, generation: number, lease_expires_at: number } | null, result: object }',v => { id(v.operation_id); id(v.run_id); uuid(v.incarnation_id); uint(v.revision); id(v.commit_id); for (const k of ['correlation_id','causation_id']) if (v[k] !== null) id(v[k]); if (v.owner) { uuid(v.owner.owner_id); uint(v.owner.generation); requireTrue(v.owner.generation > 0); uint(v.owner.lease_expires_at); } });
export const CommandReceipt = contract('{ receipt_key: string, binding_subject: object, command: object, response: object }',v => {
  const s = BindingSubject.assert(v.binding_subject), cmd = ActorCommand.assert(v.command), response = SuccessResponse.assert(v.response);
  requireTrue(!READ_TYPES.includes(cmd.type) && v.receipt_key === receiptKey(s,cmd.operation_id)); validateCommandResult(cmd.type,response.result);
  for (const key of ['operation_id','run_id','incarnation_id','correlation_id','causation_id']) requireTrue(response[key] === cmd[key]);
  requireTrue(cmd.run_id === s.run_id && cmd.incarnation_id === s.incarnation_id && response.revision === increment(cmd.expected_revision) && response.owner !== null);
});
export const HandoffAuthorization = contract('{ handoff_id: string, scope: object, task_revision: number, rule_id: string, policy_revision: number, sender: object, recipient_actor_id: string, proposal_operation_id: string, response_operation_id: string | null, response_subject: object | null, proposal_authority_revision: number, response_authority_revision: number | null }',v => {
  ['handoff_id','rule_id','recipient_actor_id','proposal_operation_id'].forEach(k => id(v[k])); ['task_revision','policy_revision','proposal_authority_revision'].forEach(k => uint(v[k])); Scope.assert(v.scope); BindingSubject.assert(v.sender);
  requireTrue(v.sender.actor_id !== v.recipient_actor_id && v.scope.run_id === v.sender.run_id);
  if (v.response_operation_id === null) requireTrue(v.response_subject === null && v.response_authority_revision === null); else { id(v.response_operation_id); BindingSubject.assert(v.response_subject); uint(v.response_authority_revision); requireTrue(v.response_subject.actor_id === v.recipient_actor_id && v.response_subject.run_id === v.sender.run_id && v.response_subject.incarnation_id === v.sender.incarnation_id); }
});
export const ApprovalRequest = contract('{ approval_request_id: string, task_id: string, task_revision: number, attempt_id: string, requester: object, rule_id: string, policy_revision: number, created_at: number, expires_at: number, reason: string, status: "pending" | "approved" | "rejected", approval_id: string | null, response_operation_id: string | null, response_subject: object | null }',v => {
  ['approval_request_id','task_id','attempt_id','rule_id'].forEach(k => id(v[k])); ['task_revision','policy_revision','created_at','expires_at'].forEach(k => uint(v[k])); BindingSubject.assert(v.requester); requireTrue(v.created_at < v.expires_at);
  if (v.status === 'pending') requireTrue(v.approval_id === null && v.response_operation_id === null && v.response_subject === null); else { id(v.approval_id); id(v.response_operation_id); BindingSubject.assert(v.response_subject); requireTrue(v.response_subject.principal_id !== v.requester.principal_id && v.response_subject.run_id === v.requester.run_id && v.response_subject.incarnation_id === v.requester.incarnation_id); }
});
export const CommandEvidence = contract('{ kind: "command", receipt_key: string, subject: object, command_type: string, authority_revision: number, policy_revision: number, rule_id: string | null, grant_ids: string[] }',v => { requireTrue(v.receipt_key.length > 0 && v.receipt_key.length <= 2048); BindingSubject.assert(v.subject); requireTrue(COMMAND_TYPES.includes(v.command_type) && !READ_TYPES.includes(v.command_type)); uint(v.authority_revision); uint(v.policy_revision); if (v.rule_id !== null) id(v.rule_id); v.grant_ids.forEach(id); requireTrue(v.grant_ids.length > 0 && canonicalJSON([...new Set(v.grant_ids)].sort()) === canonicalJSON(v.grant_ids)); });
export const CoordinationState = contract('{ protocol_version: "chord.coordination.v1", run_id: string, incarnation_id: string, logical_now: number, lease: object, policy: object, attempts: object, commands: object, handoffs: object, approval_requests: object }', v => {
  Identity.assert({run_id:v.run_id, incarnation_id:v.incarnation_id}); uint(v.logical_now); LeaseRecord.assert(v.lease);
  CoordinationPolicy.assert(v.policy);
  for (const [name,shape,key] of [['commands',CommandReceipt,'receipt_key'],['handoffs',HandoffAuthorization,'handoff_id'],['approval_requests',ApprovalRequest,'approval_request_id']]) for (const [k,raw] of Object.entries(v[name])) {
    const record = shape.assert(raw); requireTrue(k === record[key]);
    const subject = record.binding_subject || record.sender || record.requester;
    requireTrue(subject.run_id === v.run_id && subject.incarnation_id === v.incarnation_id);
  }
  for (const [key, raw] of Object.entries(v.attempts)) { const d = DispatchRecord.assert(raw); requireTrue(key === d.attempt_id && d.run_id === v.run_id && d.incarnation_id === v.incarnation_id); }
});
export const Envelope = contract('{ registry: object, coordination: object, coordination_history: object[] }', v => { RegistryData.assert(v.registry); CoordinationState.assert(v.coordination); });
export const GenesisRecord = contract('{ kind: "genesis", protocol_version: "chord.coordination.v1", ordinal: number, revision: number, domain_commit_id: string, state: object }', v => { requireTrue(v.ordinal === 0 && v.revision === 0); id(v.domain_commit_id); CoordinationState.assert(v.state); });
export const CommitRecord = contract('{ kind: "commit", protocol_version: "chord.coordination.v1", ordinal: number, revision: number, previous_domain_commit_id: string, domain_commit_id: string, operation: string, at: number, changes: { path: string[], before: object, after: object }[], evidence: object }', v => { [v.ordinal,v.revision,v.at].forEach(uint); id(v.domain_commit_id); id(v.previous_domain_commit_id); });
export const LeaseEvidence = contract(`{ kind: "lease", action: "acquire" | "renew" | "release", before: ${leaseShape}, after: ${leaseShape}, quarantined_attempt_ids: string[] }`, v => { LeaseRecord.assert(v.before); LeaseRecord.assert(v.after); v.quarantined_attempt_ids.forEach(id); requireTrue(new Set(v.quarantined_attempt_ids).size === v.quarantined_attempt_ids.length); });
export const AdminEvidence = contract('{ kind: "admin", operation: string, audit_label: string }', v => { id(v.operation); id(v.audit_label); });
export const ClaimEvidence = contract('{ kind: "claim", attempt_id: string | null, generation: number }', v => { if (v.attempt_id !== null) id(v.attempt_id); uint(v.generation); requireTrue(v.generation > 0); });
export const OutcomeEvidence = contract('{ kind: "outcome", attempt_id: string, generation: number, classification: "result" | "uncertain" }', v => { id(v.attempt_id); uint(v.generation); requireTrue(v.generation > 0); });
export const RuntimeClaim = contract('{ kind: "runtime_claim", nextRegistry: object, dispatch: object | null }', v => { RegistryData.assert(v.nextRegistry); if (v.dispatch !== null) DispatchRecord.assert(v.dispatch); });
export const RuntimeOutcome = contract('{ kind: "runtime_outcome", dispatch: object, adapter_result: object | null, error_code: string | null }', v => { DispatchRecord.assert(v.dispatch); requireTrue((v.adapter_result === null) !== (v.error_code === null)); if (v.error_code !== null) id(v.error_code); else AdapterResult.assert(v.adapter_result); });
export const ADMIN_OPERATIONS = Object.freeze(['register_spec','admit_spec','admit_tasks','authority_snapshot','prepare_attempt','cancel_task','propose_handoff','respond_handoff','pause_run','resume_run','reject_approval','cancel_run','reconcile_effect','readmit_task','invalidate_attempt','host_commit','coordination_policy']);
