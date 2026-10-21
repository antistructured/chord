#!/usr/bin/env node
import { createChord, importRegistry, replayNoSideEffects, canonicalProjection, SCHEMA_VERSION } from '@weipertda/chord';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Host mocks attest identities already authenticated by the embedding host.
// Neither model output nor actor request data may install this authority.
export async function runCanonicalWorkflow() {
  let builderEffects = 0, protectedEffects = 0;
  const chord = createChord();
  const run_id = chord.getRegistry().run.run_id;
  const principal = id => ({ principal_id: id, issuer: 'example-host', kind: id === 'human' ? 'human' : 'service', authenticated_at: 0, expires_at: Number.MAX_SAFE_INTEGER });
  const actor = id => ({ actor_id: id, principal_id: id, kind: 'agent', roles: [], capabilities: ['execute'], revoked_at: null });
  chord.setAuthoritySnapshot({ schema_version: SCHEMA_VERSION, run_id, authority_revision: 0, principals: ['builder', 'reviewer', 'human'].map(principal), actors: ['builder', 'reviewer'].map(actor), grants: [], approvals: [] });
  function queueFor(actor_id, requires_approval) {
    return { principal_id: actor_id, actor_id, capability: 'execute', approval_required: requires_approval,
      issueGrants: packets => packets.map(p => ({ grant_id: `grant_${p.task_id}`, principal_id: actor_id, actor_id, capability: 'execute', effect: 'allow', scope: { run_id, project: p.project, phase: p.phase, task_id: p.task_id, target_entity: p.target_entity, resource: { kind: 'task', id: p.task_id } }, issued_at: 0, expires_at: Number.MAX_SAFE_INTEGER, revoked_at: null, requires_approval })) };
  }
  const spec = action => ({ schema_version: SCHEMA_VERSION, spec_type: 'IntentSpec', project: 'canonical', phase: 'review', do: [action] });
  chord.setAdapterRouter({ fallback: { execute() { builderEffects++; return { status: 'completed', outcome: 'succeeded' }; } } });
  chord.registerSpecAndQueue(spec('build-review-material'), queueFor('builder', false));
  if (!(await chord.runCycle()).ok) throw Error('BUILDER_DID_NOT_COMMIT');
  const handoff = chord.proposeHandoff({ from_actor_id: 'builder', to_actor_id: 'reviewer', expectedRevision: chord.getRunRevision(), correlation_id: 'canonical-review' });
  chord.respondToHandoff({ handoff_id: handoff.handoff_id, actor_id: 'reviewer', action: 'accept', expectedRevision: chord.getRunRevision() });
  const { packets } = chord.registerSpecAndQueue(spec('publish-protected'), queueFor('reviewer', true));
  const taskId = packets[0].task_id;
  chord.setAdapterRouter({ fallback: { execute() { protectedEffects++; return { status: 'completed', outcome: 'succeeded' }; } } });
  const missing = await chord.runCycle();
  if (missing.code !== 'APPROVAL_REQUIRED' || protectedEffects !== 0) throw Error('MISSING_APPROVAL_EXECUTED');
  const context = chord.projectContext({ principal_id: 'reviewer', actor_id: 'reviewer' });
  if (!context.tasks.some(t => t.task_id === taskId)) throw Error('REVIEW_CONTEXT_MISSING');
  const attempt = chord.prepareAttempt(taskId);
  chord.pauseForApproval({ reason: 'protected-publish', expectedRevision: chord.getRunRevision() });
  if ((await chord.runCycle()).code !== 'RUN_NOT_ACTIVE' || protectedEffects !== 0) throw Error('PAUSE_BYPASSED');
  const snapshot = chord.exportRegistry();
  const restored = createChord({ registry: importRegistry(snapshot) });
  const authority = restored.getAuthority();
  const binding = restored.getRegistry().tasks[taskId].authority_binding;
  const approval_id = 'human-publish-approval';
  authority.authority_revision++;
  authority.approvals.push({ approval_id, approver_principal_id: 'human', decision: 'approved', run_id, schema_version: SCHEMA_VERSION, task_id: taskId, task_revision: 0, attempt_id: attempt.attempt_id, principal_id: 'reviewer', actor_id: 'reviewer', capability: 'execute', scope: binding.scope, issued_at: 0, expires_at: Number.MAX_SAFE_INTEGER, revoked_at: null, consumed_by_attempt_id: null });
  restored.setAuthoritySnapshot(authority, { expectedRevision: restored.getRunRevision() });
  restored.resumeRun({ principal_id: 'human', approval_id, expectedRevision: restored.getRunRevision() });
  restored.setAdapterRouter({ fallback: { execute() { protectedEffects++; return { status: 'completed', outcome: 'succeeded' }; } } });
  const result = await restored.runCycle();
  if (!result.ok) throw Error('PROTECTED_RESULT_NOT_COMMITTED');
  const state = restored.getRegistry();
  const beforeReplay = protectedEffects;
  const replay = replayNoSideEffects(restored.inspectEvents());
  const same = isDeepStrictEqual(canonicalProjection(replay.projected), canonicalProjection(state));
  const consumed = restored.getAuthority().approvals.find(a => a.approval_id === approval_id)?.consumed_by_attempt_id === attempt.attempt_id;
  const summary = { run_id, actors: ['builder', 'reviewer', 'human'], accepted_handoff: state.handoffs[handoff.handoff_id].status === 'accepted', approval_required: missing.code === 'APPROVAL_REQUIRED', approval_validated: result.ok && consumed, approval_consumed: consumed, snapshot_restored: snapshot.registry.run.run_id === state.run.run_id && snapshot.registry.run.state === 'paused', final_task_status: state.tasks[taskId].status, final_run_revision: state.run.revision, effect_dispatch_count: protectedEffects, builder_effect_count: builderEffects, trace_event_count: state.event_journal.length, negative_effect_count: 0, replay_verified: same && beforeReplay === protectedEffects && replay.effects_invoked === 0 };
  if (!summary.accepted_handoff || !summary.approval_consumed || !summary.snapshot_restored || summary.final_task_status !== 'completed' || protectedEffects !== 1 || !summary.replay_verified) throw Error('WORKFLOW_INVARIANT_FAILED');
  return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCanonicalWorkflow().then(summary => console.log(JSON.stringify(summary))).catch(error => { console.error(error); process.exitCode = 1; });
