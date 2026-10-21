import test from 'node:test';
import assert from 'node:assert/strict';
import { createChord, canonicalProjection, replayNoSideEffects, diffTraces, importRegistry, SCHEMA_VERSION } from '@weipertda/chord';

function fixture({ required = false, adapter } = {}) {
  let calls = 0;
  const chord = createChord({ adapterRouter: { fallback: { execute: async () => { calls++; return adapter ? adapter() : { status: 'completed', outcome: 'succeeded' }; } } } });
  const run_id = chord.getRegistry().run.run_id;
  const principal = (principal_id, kind) => ({ principal_id, kind, issuer: 'independent-gate-host', authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER });
  chord.setAuthoritySnapshot({ schema_version: SCHEMA_VERSION, run_id, authority_revision: 0, principals: [principal('service', 'service'), principal('human', 'human')], actors: [{ actor_id: 'worker', principal_id: 'service', kind: 'agent', roles: [], capabilities: ['execute'], revoked_at: null }], grants: [], approvals: [] });
  const spec = { schema_version: SCHEMA_VERSION, spec_type: 'IntentSpec', project: 'independent-gate', phase: 'verify', do: ['mock-effect'] };
  const options = { principal_id: 'service', actor_id: 'worker', capability: 'execute', approval_required: required, issueGrants: packets => packets.map(p => ({ grant_id: `grant-${p.task_id}`, principal_id: 'service', actor_id: 'worker', capability: 'execute', effect: 'allow', scope: { run_id, project: p.project, phase: p.phase, task_id: p.task_id, target_entity: p.target_entity, resource: { kind: 'task', id: p.task_id } }, issued_at: 0, expires_at: Number.MAX_SAFE_INTEGER, revoked_at: null, requires_approval: required })) };
  const task = chord.registerSpecAndQueue(spec, options).packets[0];
  function approval(attempt, overrides = {}) {
    return { approval_id: 'approval', approver_principal_id: 'human', decision: 'approved', run_id, schema_version: SCHEMA_VERSION, task_id: task.task_id, task_revision: 0, attempt_id: attempt.attempt_id, principal_id: 'service', actor_id: 'worker', capability: 'execute', scope: chord.getRegistry().tasks[task.task_id].authority_binding.scope, issued_at: 0, expires_at: Number.MAX_SAFE_INTEGER, revoked_at: null, consumed_by_attempt_id: null, ...overrides };
  }
  function installApproval(a) { const authority = chord.getAuthority(); authority.authority_revision++; authority.approvals = [a]; chord.setAuthoritySnapshot(authority); }
  return { chord, task, spec, options, calls: () => calls, approval, installApproval };
}

test('human exact-attempt approval; missing, service and wrong-attempt fail with zero effects', async () => {
  const f = fixture({ required: true });
  assert.equal((await f.chord.runCycle()).code, 'APPROVAL_REQUIRED');
  const attempt = f.chord.prepareAttempt(f.task.task_id);
  const before = f.chord.getRegistry();
  assert.throws(() => f.installApproval(f.approval(attempt, { approver_principal_id: 'service' })));
  assert.deepEqual(f.chord.getRegistry(), before);
  f.installApproval(f.approval(attempt, { attempt_id: 'wrong-attempt' }));
  assert.equal((await f.chord.runCycle()).code, 'APPROVAL_REQUIRED');
  f.chord.pauseForApproval();
  assert.throws(() => f.chord.resumeRun({ principal_id: 'service' }));
  assert.throws(() => f.chord.resumeRun({ principal_id: 'human' }));
  assert.equal((await f.chord.runCycle()).code, 'RUN_NOT_ACTIVE');
  assert.equal(f.calls(), 0);
  f.installApproval(f.approval(attempt));
  f.chord.resumeRun({ principal_id: 'human', approval_id: 'approval' });
  assert.equal((await f.chord.runCycle()).ok, true);
  assert.equal(f.calls(), 1);
  assert.equal(f.chord.getAuthority().approvals[0].consumed_by_attempt_id, attempt.attempt_id);
  await f.chord.runCycle();
  assert.equal(f.calls(), 1);
});

test('all common SDK read views detached; no-grant identity sees no tasks', () => {
  const f = fixture(); const before = f.chord.getRegistry();
  const views = [f.chord.registry, f.chord.getRegistry(), f.chord.exportRegistry(), f.chord.getAuthority(), f.chord.inspectEvents(), f.chord.queryQueue(), f.chord.projectContext({ principal_id: 'service', actor_id: 'worker' })];
  function corrupt(value) { if (!value || typeof value !== 'object') return; for (const key of Object.keys(value)) { if (value[key] && typeof value[key] === 'object') corrupt(value[key]); else value[key] = 'tampered-detached'; } }
  views.forEach(corrupt);
  assert.deepEqual(f.chord.getRegistry(), before);
  const denied = f.chord.projectContext({ principal_id: 'unknown', actor_id: 'unknown' });
  assert.equal(denied.tasks.length, 0); assert.equal(denied.queue_summary.length, 0);
});

test('same-revision CAS has one winner; rejected batch is byte-for-byte atomic', () => {
  const f = fixture(); const revision = f.chord.getRunRevision();
  const candidate = f.chord.getRegistry(); candidate.run.revision++;
  assert.equal(f.chord.commitRun({ expectedRevision: revision, nextRegistry: candidate }).ok, true);
  assert.equal(f.chord.getRunRevision(), revision + 1);
  const after = f.chord.getRegistry();
  assert.equal(f.chord.commitRun({ expectedRevision: revision, nextRegistry: candidate }).ok, false);
  assert.deepEqual(f.chord.getRegistry(), after);
  assert.throws(() => f.chord.registerSpecAndQueue({ ...f.spec, do: ['different-mock'] }, { ...f.options, actor_id: 'unknown' }));
  assert.deepEqual(f.chord.getRegistry(), after);
});

test('in-flight result loses to cancellation without changing terminal task or repeating effect', async () => {
  let finish; const result = new Promise(resolve => { finish = resolve; });
  const f = fixture({ adapter: () => result });
  const inflight = f.chord.runCycle();
  assert.equal(f.calls(), 1);
  f.chord.cancelTask(f.task.task_id, { expectedRevision: f.chord.getRunRevision() });
  finish({ status: 'completed', outcome: 'succeeded' });
  assert.equal((await inflight).ok, false);
  assert.equal(f.chord.getRegistry().tasks[f.task.task_id].status, 'cancelled');
  await f.chord.runCycle(); assert.equal(f.calls(), 1);
  assert.deepEqual(canonicalProjection(replayNoSideEffects(f.chord.inspectEvents()).projected), canonicalProjection(f.chord.getRegistry()));
});

test('unknown effect quarantined across ID churn and restore; human evidence required before readmission', async () => {
  const f = fixture({ adapter: () => { throw Error('mock ambiguous transport'); } });
  assert.equal((await f.chord.runCycle()).uncertain, true);
  assert.equal(f.calls(), 1);
  const before = f.chord.getRegistry();
  assert.throws(() => f.chord.replayTask(f.task.task_id));
  assert.throws(() => f.chord.registerSpecAndQueue({ ...f.spec, id: 'new-spec-id' }, f.options));
  assert.deepEqual(f.chord.getRegistry(), before);
  const restored = createChord({ registry: importRegistry(f.chord.exportRegistry()) });
  assert.throws(() => restored.replayTask(f.task.task_id));
  const request = { task_id: f.task.task_id, principal_id: 'human', decision: 'confirmed_not_executed', evidence: { kind: 'no_effect_confirmation', reference: 'mock-host-verified-receipt' }, expectedRevision: f.chord.getRunRevision() };
  assert.throws(() => f.chord.reconcileTask({ ...request, principal_id: 'service' }));
  f.chord.reconcileTask(request);
  f.chord.replayTask(f.task.task_id, { expectedRevision: f.chord.getRunRevision() });
  assert.equal(f.calls(), 1);
  assert.equal(f.chord.getRegistry().tasks[f.task.task_id].status, 'queued');
});

test('pure complete modern projection; malformed, missing-middle, tail and legacy reject; content diff detects edits', async () => {
  const f = fixture(); await f.chord.runCycle();
  const events = f.chord.inspectEvents();
  assert.deepEqual(canonicalProjection(replayNoSideEffects(events).projected), canonicalProjection(f.chord.getRegistry()));
  assert.equal(f.calls(), 1);
  assert.equal(replayNoSideEffects(events).effects_invoked, 0);
  assert.throws(() => replayNoSideEffects([]));
  assert.throws(() => replayNoSideEffects(events.slice(1)));
  assert.throws(() => replayNoSideEffects([...events.slice(0, 2), ...events.slice(3)]));
  assert.throws(() => replayNoSideEffects(events.slice(0, -1)));
  const changed = structuredClone(events); changed[1].payload.independentTamper = true;
  assert.equal(diffTraces(events, changed).equal, false);
  const unsupported = structuredClone(events); unsupported[0].schema_version = 'unknown';
  assert.throws(() => replayNoSideEffects(unsupported));
  assert.equal(f.calls(), 1);
});
