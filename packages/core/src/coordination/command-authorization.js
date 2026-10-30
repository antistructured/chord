import { Scope } from '../contracts/sigils.js';
import { evaluateAuthority } from '../platform/authorization.js';
import { sameData } from '../platform/history.js';
import { requireTrue, increment } from './contracts.js';

export const scopeOf = (registry, task) => Scope.assert({run_id:registry.run.run_id,project:task.project,phase:task.phase,task_id:task.task_id,target_entity:task.target_entity,resource:{kind:'task',id:task.task_id}});
export function subjectValid(registry, subject, now) {
  const authority = registry.authority;
  const p = authority?.principals.find(p => p.principal_id === subject.principal_id);
  const a = authority?.actors.find(a => a.actor_id === subject.actor_id);
  requireTrue(p && p.issuer === subject.issuer && p.authenticated_at <= now && now < p.expires_at && a && a.principal_id === p.principal_id && a.revoked_at === null, 'FORBIDDEN');
  return {principal:p,actor:a};
}
export function assertBinding(envelope, binding, command, now) {
  const c = envelope.coordination;
  requireTrue(command.run_id === c.run_id && binding.run_id === c.run_id,'RUN_MISMATCH');
  requireTrue(command.incarnation_id === c.incarnation_id && binding.incarnation_id === c.incarnation_id,'INCARNATION_MISMATCH');
  requireTrue(binding.authenticated_at <= now && now < binding.expires_at,'HOST_UNAUTHENTICATED');
  subjectValid(envelope.registry,binding,now);
}
export function permission(registry, subject, task, capability, now) {
  subjectValid(registry,subject,now);
  const scope = scopeOf(registry,task);
  const decision = evaluateAuthority({stage:'admit',now,run:registry.run,task:{...task,status:'queued',authority_binding:{principal_id:subject.principal_id,actor_id:subject.actor_id,capability,scope,approval_required:false}},authority:registry.authority});
  requireTrue(decision.allowed,decision.code);
  return decision.grant_ids;
}
export function actorSubject(registry, actorId, identity) {
  const a = registry.authority?.actors.find(a => a.actor_id === actorId);
  const p = registry.authority?.principals.find(p => p.principal_id === a?.principal_id);
  requireTrue(a && p,'FORBIDDEN');
  return {issuer:p.issuer,binding_id:'policy-counterparty',principal_id:p.principal_id,actor_id:a.actor_id,...identity};
}
export function selectRule(c, kind, from, to, scope) {
  const rules = c.policy[kind].filter(r => (kind === 'handoffs' ? r.from_actor_id === from && r.to_actor_id === to : r.requesting_actor_id === from && (to === null || r.approver_actor_id === to)) && sameData(r.scope,scope));
  requireTrue(rules.length <= 1,'POLICY_CONFLICT'); requireTrue(rules.length === 1,'POLICY_DENIED'); return rules[0];
}
export function validatePolicy(registry, currentPolicy, policy) {
  requireTrue(policy.policy_revision === increment(currentPolicy.policy_revision),'STALE_REVISION');
  const keys = new Set();
  for (const [kind,rules] of [['handoffs',policy.handoffs],['approvals',policy.approvals]]) for (const rule of rules) {
    const from = kind === 'handoffs' ? rule.from_actor_id : rule.requesting_actor_id;
    const to = kind === 'handoffs' ? rule.to_actor_id : rule.approver_actor_id;
    requireTrue(registry.authority?.actors.some(a => a.actor_id === from) && registry.authority.actors.some(a => a.actor_id === to),'POLICY_DENIED');
    const task = Object.hasOwn(registry.tasks,rule.scope.task_id) && registry.tasks[rule.scope.task_id];
    requireTrue(task && sameData(scopeOf(registry,task),rule.scope),'SCOPE_MISMATCH');
    const key = JSON.stringify([kind,from,kind === 'approvals' ? null : to,rule.scope]);
    requireTrue(!keys.has(key),'POLICY_CONFLICT'); keys.add(key);
    if (kind === 'approvals') { const actor = registry.authority.actors.find(a => a.actor_id === to); requireTrue(registry.authority.principals.find(p => p.principal_id === actor.principal_id)?.kind === 'human','POLICY_DENIED'); }
  }
}
export function liveTask(registry, taskId) {
  const task = Object.hasOwn(registry.tasks,taskId) && registry.tasks[taskId];
  requireTrue(task,'FORBIDDEN'); return task;
}
export function ttl(now, expires, rule, code) { requireTrue(now < expires && expires - now <= rule.max_ttl_ms,code); }
