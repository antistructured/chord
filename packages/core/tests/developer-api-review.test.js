import { test, expect } from 'bun:test';
import { createChord, SCHEMA_VERSION, createDeterministicAuditReport } from '../src/index.js';

const intent = { schema_version: SCHEMA_VERSION, spec_type: 'IntentSpec', project: 'api-review', phase: 'verify', do: ['mock'] };

/** Host-side fixture. Grant and approval construction goes through the
 * reviewed host helpers so the test exercises the same path a consumer uses.
 */
function installReviewHost(chord, { approvalRequired = false } = {}) {
  const run_id = chord.getRegistry().run.run_id;
  const principal = { principal_id: 'svc', issuer: 'review-host', kind: 'service', authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER };
  const human = { principal_id: 'human', issuer: 'review-host', kind: 'human', authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER };
  const actor = { actor_id: 'worker', principal_id: 'svc', kind: 'agent', roles: [], capabilities: ['execute'], revoked_at: null };
  chord.setAuthoritySnapshot({
    schema_version: SCHEMA_VERSION,
    run_id,
    authority_revision: 0,
    principals: [principal, human],
    actors: [actor],
    grants: [],
    approvals: []
  });
  return {
    run_id,
    principal_id: principal.principal_id,
    human_id: human.principal_id,
    actor_id: actor.actor_id,
    capability: 'execute',
    issueGrants: packets => packets.map(packet => chord.createTaskGrant(packet, {
      principal_id: principal.principal_id,
      actor_id: actor.actor_id,
      capability: 'execute',
      requires_approval: approvalRequired,
      expires_at: Number.MAX_SAFE_INTEGER
    }))
  };
}

function queueOptions(host, extra = {}) {
  return {
    principal_id: host.principal_id,
    actor_id: host.actor_id,
    capability: host.capability,
    issueGrants: host.issueGrants,
    ...extra
  };
}

test('API-REVIEW: every non-ok runCycle result exposes a uniform machine-readable code', async () => {
  // no adapter for the target entity
  const noAdapter = createChord();
  const noAdapterHost = installReviewHost(noAdapter);
  noAdapter.registerSpecAndQueue(intent, queueOptions(noAdapterHost));
  const missing = await noAdapter.runCycle();
  expect(missing.ok).toBe(false);
  expect(missing.code).toBe('no_adapter');
  expect(missing.reason).toBe('no_adapter');

  // explicit deny grant wins over the allow grant
  const denied = createChord({ adapterRouter: { fallback: { execute: () => ({ status: 'completed', outcome: 'succeeded' }) } } });
  const deniedHost = installReviewHost(denied);
  const { packets } = denied.registerSpecAndQueue(intent, queueOptions(deniedHost));
  const authority = denied.getAuthority();
  authority.authority_revision += 1;
  authority.grants.push(denied.createTaskGrant(packets[0], {
    principal_id: deniedHost.principal_id,
    actor_id: deniedHost.actor_id,
    capability: deniedHost.capability,
    effect: 'deny',
    grant_id: 'deny_grant'
  }));
  denied.setAuthoritySnapshot(authority, { expectedRevision: denied.getRunRevision() });
  const explicit = await denied.runCycle();
  expect(explicit.ok).toBe(false);
  expect(explicit.code).toBe('EXPLICIT_DENY');
  expect(explicit.denied).toBe(true);

  // adapter failure
  const failing = createChord({ adapterRouter: { fallback: { execute: () => { throw new Error('boom'); } } } });
  const failingHost = installReviewHost(failing);
  failing.registerSpecAndQueue(intent, queueOptions(failingHost));
  const uncertain = await failing.runCycle();
  expect(uncertain.ok).toBe(false);
  expect(uncertain.code).toBe('ADAPTER_ERROR');
  expect(uncertain.error).toBe('ADAPTER_ERROR');
  expect(uncertain.uncertain).toBe(true);

  // paused run
  const paused = createChord();
  const pausedHost = installReviewHost(paused);
  paused.registerSpecAndQueue(intent, queueOptions(pausedHost));
  paused.pauseForApproval();
  const notActive = await paused.runCycle();
  expect(notActive.ok).toBe(false);
  expect(notActive.code).toBe('RUN_NOT_ACTIVE');
});

test('API-REVIEW: the audit report is reproducible when the host supplies a clock', () => {
  const chord = createChord();
  const host = installReviewHost(chord);
  chord.registerSpecAndQueue(intent, queueOptions(host));
  const at = 1_700_000_000_000;
  const first = chord.inspectAudit({ now: at });
  const second = chord.inspectAudit({ now: at });
  expect(first).toEqual(second);
  expect(first.created_at).toBe(new Date(at).toISOString());
  expect(createDeterministicAuditReport(chord.getRegistry(), { now: at }).created_at).toBe(first.created_at);
  // Unchanged default: a live report still carries a parseable wall clock.
  const live = chord.inspectAudit();
  expect(Number.isFinite(Date.parse(live.created_at))).toBe(true);
});

test('API-REVIEW: createTaskGrant shapes a contract-valid grant that authorizes the task', async () => {
  let calls = 0;
  const chord = createChord({ adapterRouter: { fallback: { execute: () => { calls++; return { status: 'completed', outcome: 'succeeded' }; } } } });
  const host = installReviewHost(chord);
  const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
  const grant = chord.createTaskGrant(packets[0], {
    principal_id: host.principal_id,
    actor_id: host.actor_id,
    capability: host.capability
  });
  expect(grant.grant_id).toBe(`grant_${packets[0].task_id}`);
  expect(grant.scope.run_id).toBe(chord.getRegistry().run.run_id);
  expect(grant.scope.project).toBe(packets[0].project);
  expect(grant.scope.phase).toBe(packets[0].phase);
  expect(grant.scope.task_id).toBe(packets[0].task_id);
  expect(grant.scope.target_entity).toBe(packets[0].target_entity);
  expect(grant.scope.resource).toEqual({ kind: 'task', id: packets[0].task_id });
  expect(grant.effect).toBe('allow');
  expect(grant.revoked_at).toBeNull();
  const result = await chord.runCycle();
  expect(result.ok).toBe(true);
  expect(calls).toBe(1);
  expect(chord.getRegistry().tasks[packets[0].task_id].status).toBe('completed');
});

test('API-REVIEW: createTaskGrant installs nothing and never authorizes on its own', () => {
  const chord = createChord();
  const host = installReviewHost(chord);
  const packets = chord.createTaskPackets(intent);
  const grant = chord.createTaskGrant(packets[0], {
    principal_id: host.principal_id,
    actor_id: host.actor_id,
    capability: host.capability
  });
  expect(grant.effect).toBe('allow');
  expect(chord.getAuthority().grants).toEqual([]);
  // Queueing without installing the grant fails closed at admission.
  expect(() => chord.registerSpecAndQueue(intent, {
    principal_id: host.principal_id,
    actor_id: host.actor_id,
    capability: host.capability
  })).toThrow(/NO_ALLOW_GRANT/);
});

test('API-REVIEW: createApproval shapes a contract-valid approval that unblocks a protected dispatch', async () => {
  let calls = 0;
  const chord = createChord({ adapterRouter: { fallback: { execute: () => { calls++; return { status: 'completed', outcome: 'succeeded' }; } } } });
  const host = installReviewHost(chord, { approvalRequired: true });
  const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host, { approval_required: true }));
  const task_id = packets[0].task_id;

  const missing = await chord.runCycle();
  expect(missing.ok).toBe(false);
  expect(missing.code).toBe('APPROVAL_REQUIRED');
  expect(calls).toBe(0);

  const attempt = chord.prepareAttempt(task_id);
  const approval = chord.createApproval({
    task_id,
    attempt_id: attempt.attempt_id,
    approver_principal_id: host.human_id
  });
  expect(approval.attempt_id).toBe(attempt.attempt_id);
  expect(approval.task_id).toBe(task_id);
  expect(approval.task_revision).toBe(chord.getRegistry().tasks[task_id].task_revision ?? 0);
  expect(approval.principal_id).toBe(host.principal_id);
  expect(approval.actor_id).toBe(host.actor_id);
  expect(approval.scope).toEqual(chord.getRegistry().tasks[task_id].authority_binding.scope);
  expect(approval.consumed_by_attempt_id).toBeNull();

  const authority = chord.getAuthority();
  authority.authority_revision += 1;
  authority.approvals.push(approval);
  chord.setAuthoritySnapshot(authority, { expectedRevision: chord.getRunRevision() });
  chord.pauseForApproval();
  chord.resumeRun({ principal_id: host.human_id, approval_id: approval.approval_id });

  const result = await chord.runCycle();
  expect(result.ok).toBe(true);
  expect(calls).toBe(1);
  expect(chord.getRegistry().tasks[task_id].status).toBe('completed');
  const consumed = chord.getAuthority().approvals.find(a => a.approval_id === approval.approval_id);
  expect(consumed.consumed_by_attempt_id).toBe(attempt.attempt_id);
});

test('API-REVIEW: createApproval cannot mint an approval for the requesting principal or a non-human approver', () => {
  const chord = createChord();
  const host = installReviewHost(chord);
  const { packets } = chord.registerSpecAndQueue(intent, queueOptions(host));
  const task_id = packets[0].task_id;
  const attempt = chord.prepareAttempt(task_id);
  // The requesting principal may not approve its own task.
  expect(() => chord.createApproval({
    task_id,
    attempt_id: attempt.attempt_id,
    approver_principal_id: host.principal_id
  })).toThrow(/INVALID_SEMANTICS/);
  // A non-human approver is rejected when the host installs the snapshot.
  const authority = chord.getAuthority();
  authority.authority_revision += 1;
  authority.approvals.push({
    approval_id: 'service_approval',
    approver_principal_id: host.principal_id,
    decision: 'approved',
    run_id: host.run_id,
    schema_version: SCHEMA_VERSION,
    task_id,
    task_revision: 0,
    attempt_id: attempt.attempt_id,
    principal_id: host.principal_id,
    actor_id: host.actor_id,
    capability: host.capability,
    scope: chord.getRegistry().tasks[task_id].authority_binding.scope,
    issued_at: 0,
    expires_at: Number.MAX_SAFE_INTEGER,
    revoked_at: null,
    consumed_by_attempt_id: null
  });
  expect(() => chord.setAuthoritySnapshot(authority, { expectedRevision: chord.getRunRevision() })).toThrow();
});
